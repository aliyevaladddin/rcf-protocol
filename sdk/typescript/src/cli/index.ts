#!/usr/bin/env node
// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { Command } from 'commander';
import chalk from 'chalk';
import Parser from 'tree-sitter';
// @ts-ignore
import TypeScript from 'tree-sitter-typescript';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative, extname, basename, dirname } from 'path';
import { createHash } from 'crypto';
import * as https from 'https';
import { fileURLToPath } from 'url';
import { MarkerParser } from '../core/MarkerParser.js';
import { ComplianceValidator } from '../core/ComplianceValidator.js';
import { AuditReport } from '../core/types.js';
import { Scanner } from '../core/Scanner.js';
import { renderRcfRobotsBlock, mergeRobotsBlock } from '../core/constants.js';
import { loadSigma } from '../core/sigma.js';
import { buildCorpus, freezeCorpus, loadCorpus, iterFunctionUnits } from '../core/corpus.js';
import { rankSentinels } from '../core/sentinel.js';
import { buildNull, freezeNull, loadNull, prove, DEFAULT_SEED } from '../core/proof.js';
import { normalizeTypescript } from '../core/normalize_typescript.js';
import { normalizeByExtension } from '../core/normalize.js';
import { findSubgraphIsomorphisms, CanaryRegistry, extractCanaryBlock } from '../core/canary.js';
import { injectAdversarialNoiseTypescript } from '../core/noise.js';

// Generate / idempotently update robots.txt at the project root — the RCF law
// on the threshold. Shared block text lives in constants.ts (byte-identical to
// the Python SDK).
function writeRcfRobots(root: string, dryRun: boolean): void {
  const robotsPath = join(root, 'robots.txt');
  let existing: string | null = null;
  if (existsSync(robotsPath)) {
    try {
      existing = readFileSync(robotsPath, 'utf-8');
    } catch (e: any) {
      console.log(chalk.yellow('⚠️  Cannot read robots.txt: ' + e.message));
      return;
    }
  }

  const merged = mergeRobotsBlock(existing, renderRcfRobotsBlock());
  if (merged === existing) return; // already up to date — no churn

  if (dryRun) {
    const verb = existing ? 'update' : 'create';
    console.log(chalk.cyan('🔍 DRY RUN : robots.txt would ' + verb + ' the RCF-managed block'));
    return;
  }

  writeFileSync(robotsPath, merged, 'utf-8');
  console.log(chalk.green('✅ ROBOTS   : RCF law written to robots.txt (search allowed, AI training restricted)'));
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const program = new Command();

const AUDIT_BANNER = `
  ${chalk.bold.white('██████╗  ██████╗███████╗   ')}${chalk.bold.red('           ██╗        ██╗')}
  ${chalk.bold.white('██╔══██╗██╔════╝██╔════╝   ')}${chalk.bold.red('   ██╗    ██╔╝       ██╔╝')}
  ${chalk.bold.white('██████╔╝██║     █████╗     ')}${chalk.bold.red('   ╚═╝   ██╔╝       ██╔╝ ')}
  ${chalk.bold.white('██╔══██╗██║     ██╔══╝     ')}${chalk.bold.red('   ██╗  ██╔╝       ██╔╝  ')}
  ${chalk.bold.white('██║  ██║╚██████╗██║        ')}${chalk.bold.red('   ╚═╝ ██╔╝       ██╔╝   ')}
  ${chalk.bold.white('╚═╝  ╚═╝ ╚═════╝╚═╝        ')}${chalk.bold.red('      ╚═╝        ╚═╝     ')}

  ${chalk.cyan('🛡️  RCF Protocol — Restricted Correlation Framework')}
  ${chalk.gray('Sovereign Code Protection | Aladdin Aliyev')}
`;

program
  .name('rcf-cli')
  .description('RCF Protocol — Restricted Correlation Framework')
  .version('2.1.8')
  .addHelpText('before', AUDIT_BANNER)
  .arguments('[path]')
  .option('-v, --verbose', 'show details')
  .action((pathArg, options) => {
    const path = pathArg ?? '.';
    console.log(chalk.cyan('◈ Running default scan for: ' + path));
    const scanner = new Scanner();
    const results = scanner.scanDirectory(resolve(path));
    console.log(chalk.bold('\nScan complete. Found ' + results.length + ' files needing attention.'));
  });

// ─── INIT ────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize RCF in the current project')
  .option('--project <name>', 'Project name')
  .option('--author <name>', 'Author name')
  .action((options) => {
    const projectName = options.project ?? basename(process.cwd());
    const author = options.author ?? 'Author';
    const year = new Date().getFullYear();

    const noticePath = join(process.cwd(), 'NOTICE.md');
    if (existsSync(noticePath)) {
      console.log(chalk.yellow('⚠️  NOTICE.md already exists. Updating.'));
    }

    writeFileSync(noticePath, [
      `# RCF-PL NOTICE — Sovereign Code Protection`,
      ``,
      `This project (**${projectName}**) is protected under the **Restricted Correlation Framework Protocol License (RCF-PL)**.`,
      ``,
      `Copyright (c) ${year} ${author}. All rights reserved.`,
      ``,
      `## 🚨 ACTIVE ENFORCEMENT`,
      `This code implements **Active Integrity Verification**. Unauthorized modification,`,
      `replication, or analysis by AI/ML models will trigger automatic`,
      `forensic logging.`,
      ``,
      `## ⚠️ AI/ML Training Restriction`,
      `Automated extraction or use for training Machine Learning models is **STRICTLY PROHIBITED**.`,
      ``,
      `Full protocol: https://aliyev.site/rcf`,
    ].join('\n'));
    console.log(chalk.green('✅ Generated/Updated NOTICE.md for RCF'));

    const ignorePath = join(process.cwd(), '.rcfignore');
    if (!existsSync(ignorePath)) {
      writeFileSync(ignorePath, '# RCF Ignore File\nnode_modules\n.git\n__pycache__\n.venv\ndist\nbuild\n.next\ncoverage\n');
      console.log(chalk.green('✅ Generated .rcfignore'));
    }

    console.log(chalk.bold.green('\n🎉 RCF initialized for \'' + projectName + '\'.'));
  });

// ─── AUDIT ───────────────────────────────────────────────────────────────────

program
  .command('audit [path]')
  .description('Generate RCF-AUDIT-REPORT.json — fingerprint and index all protected assets')
  .option('-v, --verbose', 'show details')
  .action(async (pathArg = '.', options) => {
    const root = resolve(pathArg);
    console.log(chalk.cyan('◈ Generating Audit Report for: ' + root));

    const parser = new MarkerParser(root);
    const results = await parser.scanAll();
    const validator = new ComplianceValidator();
    const report = validator.generateReport(results, root);

    report.audit_type = 'RCF-Audit';

    const reportPath = join(root, 'RCF-AUDIT-REPORT.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    if (options.verbose) {
      for (const asset of report.protected_assets) {
        console.log(chalk.gray('  ◈ ' + asset.file + '  markers=[' + asset.markers.join(',') + ']'));
      }
    }

    console.log(chalk.green('✅ Audit complete. ' + report.protected_assets.length + ' assets recorded.'));
    console.log(chalk.gray('   Report saved to: ' + reportPath));
    console.log(chalk.gray('   Protocol docs  : https://aliyev.site/rcf'));
  });

// ─── VERIFY ──────────────────────────────────────────────────────────────────

program
  .command('verify [path]')
  .description('Verify file/directory integrity against audit report')
  .option('--against <report>', 'Path to audit report JSON (single-file verify)')
  .option('-v, --verbose', 'show details')
  .action((pathArg = '.', options) => {
    const root = resolve(pathArg);
    const validator = new ComplianceValidator();

    // Single-file verification against a specific report
    if (options.against) {
      try {
        const result = validator.verifyFile(root, resolve(options.against));
        console.log(chalk.bold('--- RCF File Verification ---'));
        console.log(chalk.gray('File    : ' + result.file));
        console.log(chalk.gray('Report  : ' + result.reportPath));
        console.log(chalk.gray('Recorded: ' + result.recordedAt));
        console.log();
        if (result.verified) {
          console.log(chalk.green('✅ VERIFIED — file matches audit record'));
          console.log(chalk.gray('   SHA-256: ' + result.currentHash));
        } else {
          console.log(chalk.red('🚨 TAMPERED — file has been modified since audit!'));
          console.log(chalk.red('   stored : ' + result.storedHash));
          console.log(chalk.red('   current: ' + result.currentHash));
          process.exit(1);
        }
      } catch (e: any) {
        console.log(chalk.red('❌ ' + e.message));
        process.exit(1);
      }
      return;
    }

    // Directory verification: SHA-256 against RCF-AUDIT-REPORT.json
    const reportPath = join(root, 'RCF-AUDIT-REPORT.json');
    if (!existsSync(reportPath)) {
      console.log(chalk.red('❌ Audit report not found at: ' + reportPath));
      console.log(chalk.gray("   Run 'rcf-cli audit .' first."));
      process.exit(1);
    }

    const report: AuditReport = JSON.parse(readFileSync(reportPath, 'utf-8'));
    const assets = report.protected_assets ?? [];

    console.log(chalk.bold('\n--- RCF Integrity Verification (' + assets.length + ' assets) ---'));
    console.log(chalk.gray('  Engine: Aladdin Audit Core\n'));

    const missing: string[] = [];
    const tampered: string[] = [];
    let verified = 0;

    for (const asset of assets) {
      const fullPath = join(root, asset.file);
      if (!existsSync(fullPath)) {
        missing.push(asset.file);
        console.log(chalk.red('❌ MISSING  : ' + asset.file));
        continue;
      }

      const current = createHash('sha256').update(readFileSync(fullPath)).digest('hex');
      if (current === asset.sha256) {
        verified++;
        if (options.verbose) console.log(chalk.green('✅ VERIFIED : ' + asset.file));
      } else {
        tampered.push(asset.file);
        console.log(chalk.red('🚨 TAMPERED : ' + asset.file));
        if (options.verbose) {
          console.log(chalk.gray('   stored : ' + asset.sha256));
          console.log(chalk.gray('   current: ' + current));
        }
      }
    }

    console.log();
    if (tampered.length || missing.length) {
      console.log(chalk.bold.red('❌ FAILED. Tampered: ' + tampered.length + ', Missing: ' + missing.length));
      process.exit(1);
    } else {
      console.log(chalk.bold.green('✅ Integrity OK: All ' + verified + ' assets verified.'));
    }
  });

// ─── DIFF ────────────────────────────────────────────────────────────────────

program
  .command('diff [path]')
  .description('Compare current markers against the audit report (CI/CD)')
  .option('-v, --verbose', 'show details')
  .action(async (pathArg = '.', options) => {
    const root = resolve(pathArg);
    const reportPath = join(root, 'RCF-AUDIT-REPORT.json');

    if (!existsSync(reportPath)) {
      console.log(chalk.red('❌ Audit report not found at: ' + reportPath));
      console.log(chalk.gray("   Run 'rcf-cli audit .' first."));
      process.exit(1);
    }

    const report: AuditReport = JSON.parse(readFileSync(reportPath, 'utf-8'));
    const parser = new MarkerParser(root);
    const results = await parser.scanAll();
    const validator = new ComplianceValidator();
    const diff = validator.diff(results, report, root);

    if (options.verbose && diff.newUnprotectedFiles.length) {
      for (const f of diff.newUnprotectedFiles) {
        console.log(chalk.yellow('⚠️  NEW UNPROTECTED LOGIC: ' + f));
      }
    }

    if (!diff.passed) {
      console.log(chalk.red('\n🚨 COMPLIANCE VIOLATIONS: ' + diff.violations.length));
      for (const v of diff.violations) {
        console.log(chalk.red('   [' + v.type.toUpperCase() + '] ' + v.file + ': ' + v.detail));
      }
      if (diff.newUnprotectedFiles.length) {
        console.log(chalk.yellow('⚠️  ' + diff.newUnprotectedFiles.length + ' new file(s) with unprotected logic.'));
      }
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ No marker violations detected. All audited assets compliant.'));
      if (diff.newUnprotectedFiles.length) {
        console.log(chalk.yellow('   ⚠️  ' + diff.newUnprotectedFiles.length + ' new file(s) with unprotected logic (run \'protect\').'));
      }
    }
  });

// ─── PROTECT ─────────────────────────────────────────────────────────────────

program
  .command('protect [path]')
  .description('Auto-insert RCF markers into unprotected logic blocks')
  .option('--dry-run', 'preview changes without writing files')
  .option('--no-robots', 'skip generating/updating robots.txt')
  .option('-v, --verbose', 'show details')
  .action((pathArg = '.', options) => {
    const root = resolve(pathArg);
    const writeRobots = options.robots !== false; // commander sets .robots=false for --no-robots
    const scanner = new Scanner();
    const results = scanner.scanDirectory(root);
    const needsWork = results.filter(r => r.hasUnprotectedLogic || !r.hasHeader);

    if (!needsWork.length) {
      console.log(chalk.green('✅ No unprotected logic found.'));
      if (writeRobots) writeRcfRobots(root, !!options.dryRun);
      return;
    }

    let modified = 0;
    let skipped = 0;

    for (const result of needsWork) {
      let lines: string[];
      try {
        lines = readFileSync(result.path, 'utf-8').split('\n');
      } catch (e: any) {
        console.log(chalk.yellow('⚠️  Cannot read ' + result.path + ': ' + e.message));
        skipped++;
        continue;
      }

      const newLines: string[] = [];

      if (!result.hasHeader) {
        newLines.push(Scanner.headerLine(result.path).trimEnd());
      }

      const gapLines = new Set(result.unprotectedLogic.map(b => b.line));
      const markerLine = Scanner.makeMarkerLine(result.path).trimEnd();

      for (let i = 0; i < lines.length; i++) {
        if (gapLines.has(i + 1)) {
          const prev = newLines[newLines.length - 1] ?? '';
          if (!prev.includes('[RCF:')) newLines.push(markerLine);
        }
        newLines.push(lines[i]);
      }

      const changed = newLines.length !== lines.length || !result.hasHeader;
      if (changed) {
        const gaps = result.unprotectedLogic.length;
        if (options.dryRun) {
          console.log(chalk.cyan('🔍 DRY RUN : ' + relative(root, result.path) + '  (' + gaps + ' block(s) would be marked)'));
        } else {
          writeFileSync(result.path, newLines.join('\n'), 'utf-8');
          console.log(chalk.green('✅ PROTECTED: ' + relative(root, result.path) + '  (' + gaps + ' block(s) marked)'));
        }
        modified++;
      } else {
        skipped++;
      }
    }

    console.log();
    const action = options.dryRun ? 'Would modify' : 'Modified';
    console.log(chalk.bold('🛡️  ' + action + ' ' + modified + ' file(s). Skipped: ' + skipped + '.'));

    if (writeRobots) writeRcfRobots(root, !!options.dryRun);

    if (options.dryRun) console.log(chalk.gray('   Run without --dry-run to apply changes.'));
  });

// ─── SENTINEL ────────────────────────────────────────────────────────────────

program
  .command('sentinel [path]')
  .description('Rank function units in a project by surprisal mass (sentinel watchlist)')
  .requiredOption('--corpus <path>', 'Path to the frozen corpus JSON')
  .option('--top <n>', 'Number of sentinels to show', '5')
  .action((pathArg = '.', options) => {
    try {
      const root = resolve(pathArg);
      const sigma = loadSigma();
      const corpus = loadCorpus(resolve(options.corpus), sigma);
      const topN = parseInt(options.top, 10);
      const res = rankSentinels(root, corpus, sigma, { topN });
      console.log(chalk.bold(`\n--- RCF Sentinel Watch-list (top ${topN}) ---`));
      res.forEach((s, idx) => {
        console.log(chalk.cyan(`  [#${idx + 1}] ${s.label}`));
        console.log(chalk.gray(`       Surprisal Mass: ${s.totalMass.toFixed(4)}`));
        console.log(chalk.gray(`       Unique Mass   : ${s.uniqueMass.toFixed(4)}`));
        console.log(chalk.gray(`       Uniqueness    : ${(s.uniquenessRatio * 100).toFixed(1)}%`));
      });
    } catch (e: any) {
      console.log(chalk.red(`❌ Error: ${e.message}`));
      process.exit(1);
    }
  });

// ─── BUILD-CORPUS ────────────────────────────────────────────────────────────

program
  .command('build-corpus [paths...]')
  .description('Build a background feature corpus from source directories')
  .requiredOption('--out <path>', 'Output JSON file path')
  .action((paths, options) => {
    try {
      const sigma = loadSigma();
      const allSources: string[] = [];
      const pathsToScan = paths.length > 0 ? paths : ['.'];
      for (const p of pathsToScan) {
        const scanner = new Scanner();
        const results = scanner.scanDirectory(resolve(p));
        for (const res of results) {
          const ext = extname(res.path).toLowerCase();
          if (['.ts', '.js', '.tsx', '.jsx', '.go', '.rs'].includes(ext)) {
            try {
              allSources.push(readFileSync(res.path, 'utf-8'));
            } catch { }
          }
        }
      }
      console.log(chalk.cyan(`◈ Building corpus from ${allSources.length} files...`));
      const corpus = buildCorpus(allSources, sigma);
      const saved = freezeCorpus(corpus, resolve(options.out));
      console.log(chalk.green(`✅ Corpus built successfully with ${corpus.totalUnits} units.`));
      console.log(chalk.gray(`   Saved to: ${saved}`));
    } catch (e: any) {
      console.log(chalk.red(`❌ Error: ${e.message}`));
      process.exit(1);
    }
  });

// ─── BUILD-NULL ──────────────────────────────────────────────────────────────

program
  .command('build-null [paths...]')
  .description('Build and freeze the null distribution for statistical significance')
  .requiredOption('--corpus <path>', 'Path to the frozen corpus JSON')
  .requiredOption('--out <path>', 'Output JSON file path')
  .option('--n-pairs <n>', 'Number of independent pairs to sample', '1000')
  .option('--seed <n>', 'Random seed', String(DEFAULT_SEED))
  .action((paths, options) => {
    try {
      const sigma = loadSigma();
      const corpus = loadCorpus(resolve(options.corpus), sigma);
      const allSources: string[] = [];
      const pathsToScan = paths.length > 0 ? paths : ['.'];
      for (const p of pathsToScan) {
        const scanner = new Scanner();
        const results = scanner.scanDirectory(resolve(p));
        for (const res of results) {
          const ext = extname(res.path).toLowerCase();
          if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
            try {
              allSources.push(readFileSync(res.path, 'utf-8'));
            } catch { }
          }
        }
      }
      console.log(chalk.cyan(`◈ Sampling independent pairs from ${allSources.length} files...`));
      const nPairs = parseInt(options.nPairs, 10);
      const seed = parseInt(options.seed, 10);
      const nullModel = buildNull(allSources, corpus, sigma, { nPairs, seed });
      const saved = freezeNull(nullModel, resolve(options.out));
      console.log(chalk.green(`✅ Null model built successfully with ${nullModel.nPairs} pairs.`));
      console.log(chalk.gray(`   Saved to: ${saved}`));
    } catch (e: any) {
      console.log(chalk.red(`❌ Error: ${e.message}`));
      process.exit(1);
    }
  });

// ─── PROVE ───────────────────────────────────────────────────────────────────

program
  .command('prove <fileA> <fileB>')
  .description('Statistically prove similarity with court-grade E-value')
  .requiredOption('--corpus <path>', 'Path to the frozen corpus JSON')
  .requiredOption('--null <path>', 'Path to the frozen null model JSON')
  .action((fileA, fileB, options) => {
    try {
      const sigma = loadSigma();
      const corpus = loadCorpus(resolve(options.corpus), sigma);
      const nullModel = loadNull(resolve(options.null), sigma);

      const resolvedA = resolve(fileA);
      const resolvedB = resolve(fileB);
      const srcA = readFileSync(resolvedA, 'utf-8');
      const srcB = readFileSync(resolvedB, 'utf-8');

      const pdgA = normalizeByExtension(srcA, resolvedA, sigma);
      const pdgB = normalizeByExtension(srcB, resolvedB, sigma);

      const rep = prove(pdgA, pdgB, nullModel, corpus);
      console.log(chalk.bold('\n--- RCF Court-Grade Similarity Proof ---'));
      console.log(chalk.gray(`Score        : ${rep.score.toFixed(4)}`));
      console.log(chalk.gray(`Z-Score      : ${rep.zScore.toFixed(2)}`));
      console.log(chalk.gray(`p-empirical  : ${rep.pEmpirical.toExponential(2)} (floor: ${rep.pEmpiricalFloor.toExponential(2)})`));
      console.log(chalk.gray(`p-parametric : ${rep.pParametric.toExponential(2)}`));
      console.log(chalk.gray(`E-value      : ${rep.eValue.toExponential(2)}`));
      if (rep.empiricalIsFloored) {
        console.log(chalk.green('✅ Statistical significance established (tail floor reached).'));
      }
    } catch (e: any) {
      console.log(chalk.red(`❌ Error: ${e.message}`));
      process.exit(1);
    }
  });

// ─── CANARY ──────────────────────────────────────────────────────────────────

const canaryCmd = program
  .command('canary')
  .description('Designed canary management');

canaryCmd
  .command('register')
  .description('Register a designed canary')
  .requiredOption('--name <name>', 'Canary name')
  .option('--desc <desc>', 'Description', '')
  .option('--registry <path>', 'Registry path', 'rcf_canaries.json')
  .option('--file <path>', 'File with canary block')
  .option('--source <source>', 'Inline code snippet')
  .action((options) => {
    try {
      const sigma = loadSigma();
      const registryPath = resolve(options.registry);
      const registry = new CanaryRegistry(registryPath, sigma);

      let source = '';
      if (options.source) {
        source = options.source;
        if (!source.trim().startsWith('function ')) {
          const indented = source.split('\n').map(line => '    ' + line).join('\n');
          source = `function __canary_dummy() {\n${indented}\n}\n`;
        }
      } else if (options.file) {
        const filePath = resolve(options.file);
        if (!existsSync(filePath)) {
          console.log(chalk.red(`❌ Error: File not found: ${filePath}`));
          process.exit(1);
        }
        const content = readFileSync(filePath, 'utf-8');
        source = extractCanaryBlock(content);
        if (!source) {
          console.log(chalk.red(`❌ Error: No [RCF:CANARY_START] and [RCF:CANARY_END] markers found.`));
          process.exit(1);
        }
      } else {
        console.log(chalk.red(`❌ Error: Either --file or --source must be specified.`));
        process.exit(1);
      }

      registry.register(options.name, source, options.desc);
      console.log(chalk.green(`✅ Successfully registered canary '${options.name}' in registry '${options.registry}'.`));
    } catch (e: any) {
      console.log(chalk.red(`❌ Error: ${e.message}`));
      process.exit(1);
    }
  });

canaryCmd
  .command('scan <path>')
  .description('Scan directory for registered canaries')
  .option('--registry <path>', 'Registry path', 'rcf_canaries.json')
  .action((targetPath, options) => {
    try {
      const sigma = loadSigma();
      const registryPath = resolve(options.registry);
      if (!existsSync(registryPath)) {
        console.log(chalk.red(`❌ Error: Registry file not found at: ${registryPath}`));
        process.exit(1);
      }
      const registry = new CanaryRegistry(registryPath, sigma);
      if (Object.keys(registry.canaries).length === 0) {
        console.log(chalk.gray('No valid canaries loaded from registry. Nothing to scan.'));
        process.exit(0);
      }

      const resolvedTarget = resolve(targetPath);
      const filesToScan: string[] = [];

      function walk(dir: string) {
        const list = readdirSync(dir);
        for (const file of list) {
          const fullPath = join(dir, file);
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else if (['.ts', '.js', '.tsx', '.jsx', '.go', '.rs'].includes(extname(file).toLowerCase())) {
            filesToScan.push(fullPath);
          }
        }
      }

      if (existsSync(resolvedTarget)) {
        const stat = statSync(resolvedTarget);
        if (stat.isFile()) {
          filesToScan.push(resolvedTarget);
        } else if (stat.isDirectory()) {
          walk(resolvedTarget);
        }
      }

      if (filesToScan.length === 0) {
        console.log(chalk.yellow('No JS/TS files found to scan.'));
        process.exit(0);
      }

      console.log(chalk.cyan(`◈ Scanning ${filesToScan.length} file(s) for ${Object.keys(registry.canaries).length} registered canary/canaries...`));
      let foundAny = false;

      for (const fpath of filesToScan) {
        let content = '';
        try {
          content = readFileSync(fpath, 'utf-8');
        } catch {
          continue;
        }

        const units = iterFunctionUnits(content);
        for (const unitSrc of units) {
          let targetPdg;
          try {
            targetPdg = normalizeByExtension(unitSrc, fpath, sigma);
          } catch {
            continue;
          }

          if (targetPdg.nodes.length === 0) {
            continue;
          }

          const lines = unitSrc.trim().split('\n');
          const fnLabel = lines[0].trim() || 'unknown_function';

          for (const [canaryName, canaryRec] of Object.entries(registry.canaries)) {
            const matches = findSubgraphIsomorphisms(canaryRec.pdg, targetPdg);
            if (matches.length > 0) {
              foundAny = true;
              const relPath = relative(resolvedTarget, fpath);
              console.log(chalk.bold.red(`🚨 CANARY DETECTED: '${canaryName}' found in ${relPath} inside '${fnLabel}'!`));
              console.log(chalk.gray(`  Description: ${canaryRec.description}`));
              console.log(chalk.gray(`  Number of match configurations: ${matches.length}`));
              const proof = matches[0];
              console.log(chalk.gray('  Sample node mapping (Canary Node ID -> Target Node ID):'));
              for (const [cIdStr, tId] of Object.entries(proof)) {
                const cId = parseInt(cIdStr, 10);
                const cNode = canaryRec.pdg.node(cId);
                const tNode = targetPdg.node(tId);
                console.log(chalk.gray(`    Node ${cId} (${cNode?.label}) -> Node ${tId} (${tNode?.label})`));
              }
              console.log();
            }
          }
        }
      }

      if (!foundAny) {
        console.log(chalk.green('🛡️  No designed canaries detected. Scan clean.'));
        process.exit(0);
      } else {
        process.exit(1);
      }
    } catch (e: any) {
      console.log(chalk.red(`❌ Error: ${e.message}`));
      process.exit(1);
    }
  });

// ─── NOISE ───────────────────────────────────────────────────────────────────

program
  .command('noise [path]')
  .description('Inject adversarial AST noise into protected files to confuse AI models')
  .option('-v, --verbose', 'show details')
  .action((pathArg, options) => {
    try {
      const targetPath = resolve(pathArg || '.');
      const filesToScan: string[] = [];

      function walk(dir: string) {
        const list = readdirSync(dir);
        for (const file of list) {
          const fullPath = join(dir, file);
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else if (['.ts', '.js', '.tsx', '.jsx'].includes(extname(file).toLowerCase())) {
            filesToScan.push(fullPath);
          }
        }
      }

      if (existsSync(targetPath)) {
        const stat = statSync(targetPath);
        if (stat.isFile()) {
          filesToScan.push(targetPath);
        } else if (stat.isDirectory()) {
          walk(targetPath);
        }
      }

      if (filesToScan.length === 0) {
        console.log(chalk.yellow('No JS/TS files found to inject noise.'));
        process.exit(0);
      }

      let modifiedCount = 0;
      for (const fpath of filesToScan) {
        let content = '';
        try {
          content = readFileSync(fpath, 'utf-8');
        } catch {
          continue;
        }

        // Only target protected files
        if (!content.includes('[RCF:PROTECTED]') && !content.includes('[RCF:RESTRICTED]') && !content.includes('protected under RCF-PL')) {
          continue;
        }

        const newContent = injectAdversarialNoiseTypescript(content);
        if (newContent !== content) {
          try {
            writeFileSync(fpath, newContent, 'utf-8');
            modifiedCount++;
            if (options.verbose) {
              console.log(chalk.green(`✅ Injected noise: ${relative(targetPath, fpath)}`));
            }
          } catch (e: any) {
            console.log(chalk.red(`❌ Error writing ${fpath}: ${e.message}`));
          }
        }
      }

      console.log(chalk.green(`🛡️  AST Adversarial Noise process complete. Modified ${modifiedCount} file(s).`));
      process.exit(0);
    } catch (e: any) {
      console.log(chalk.red(`❌ Error: ${e.message}`));
      process.exit(1);
    }
  });

// ─── GATEWAY ──────────────────────────────────────────────────────────────────

const CLOUDFLARE_WAF_CODE = `/**
 * RCF Gateway — Cloudflare Worker WAF
 * Protects repositories and source assets from AI scraper bots on the Edge.
 */

const AI_USER_AGENTS = [
  'gptbot',
  'chatgpt-user',
  'cohere-ai',
  'anthropic-ai',
  'claude-web',
  'claude-user',
  'google-extended',
  'apis-google',
  'perplexitybot',
  'applebot-extended',
  'omgilibot',
  'bytespider',
  'diffbot',
  'imagesiftbot',
  'petalbot',
  'ccbot',
  'yandexbot',
  'facebookexternalhit'
];

const SOURCE_EXTENSIONS = new Set([
  '.py', '.ts', '.js', '.tsx', '.jsx', '.go', '.rs', 
  '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', 
  '.rb', '.php', '.pyc', '.class'
]);

const ipRequestHistory = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10000;
const MAX_SOURCE_REQUESTS = 10;

function isAiAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return AI_USER_AGENTS.some(agent => ua.includes(agent));
}

function isSourceFile(urlPath: string): boolean {
  const extIndex = urlPath.lastIndexOf('.');
  if (extIndex === -1) return false;
  const ext = urlPath.substring(extIndex).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

function getRcfBlockedHtml(ip: string, reason: string): string {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>403 Forbidden — RCF Active Protection</title>
    <style>
        body {
            background-color: #0d0e12;
            color: #e2e8f0;
            font-family: 'Courier New', Courier, monospace;
            padding: 50px;
            text-align: center;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #ff3333;
            background-color: #161822;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(255, 51, 51, 0.15);
        }
        pre {
            color: #ff3333;
            font-size: 14px;
            text-align: left;
            display: inline-block;
            margin-bottom: 30px;
        }
        h1 {
            color: #ffffff;
            font-size: 24px;
            margin-bottom: 20px;
        }
        p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .meta {
            font-size: 12px;
            color: #718096;
            margin-top: 30px;
            border-top: 1px solid #2d3748;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <pre>
  ██████╗  ██████╗███████╗              ██╗        ██╗
  ██╔══██╗██╔════╝██╔════╝      ██╗    ██╔╝       ██╔╝
  ██████╔╝██║     █████╗        ╚═╝   ██╔╝       ██╔╝ 
  ██╔══██╗██║     ██╔══╝        ██╗  ██╔╝       ██╔╝  
  ██║  ██║╚██████╗██║           ╚═╝ ██╔╝       ██╔╝   
  ╚═╝  ╚═╝ ╚═════╝╚═╝              ╚═╝        ╚═╝     
        </pre>
        <h1>403 Forbidden — RCF Active Protection</h1>
        <p>Access denied under the <strong>Restricted Correlation Framework PL</strong> (RCF-PL).</p>
        <p>Reason: \${reason}</p>
        <div class="meta">
            Client IP: \${ip} | System Status: Active Enforcement | RCF Gate v1.0.0
        </div>
    </div>
</body>
</html>\`;
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    if (isAiAgent(userAgent)) {
      return new Response(
        getRcfBlockedHtml(ip, 'Automated AI harvester signature detected.'),
        {
          status: 403,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    if (isSourceFile(url.pathname)) {
      const now = Date.now();
      let history = ipRequestHistory.get(ip) || [];
      history = history.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
      history.push(now);
      ipRequestHistory.set(ip, history);

      if (history.length > MAX_SOURCE_REQUESTS) {
        return new Response(
          getRcfBlockedHtml(ip, 'Excessive code crawling pattern detected (Rate Limit Exceeded).'),
          {
            status: 429,
            headers: { 'Content-Type': 'text/html' }
          }
        );
      }
    }

    return fetch(request);
  }
};
`;

const NGINX_WAF_LUA = `-- RCF Gateway — Nginx Lua WAF
-- Protects repositories and source assets from AI scraper bots.
-- Requires OpenResty or Nginx with lua-nginx-module.

local AI_USER_AGENTS = {
    "gptbot",
    "chatgpt-user",
    "cohere-ai",
    "anthropic-ai",
    "claude-web",
    "claude-user",
    "google-extended",
    "apis-google",
    "perplexitybot",
    "applebot-extended",
    "omgilibot",
    "bytespider",
    "diffbot",
    "imagesiftbot",
    "petalbot",
    "ccbot",
    "yandexbot",
    "facebookexternalhit"
}

local SOURCE_EXTENSIONS = {
    [".py"] = true, [".ts"] = true, [".js"] = true, [".tsx"] = true, [".jsx"] = true,
    [".go"] = true, [".rs"] = true, [".java"] = true, [".c"] = true, [".cpp"] = true,
    [".h"] = true, [".hpp"] = true, [".cs"] = true, [".swift"] = true, [".rb"] = true,
    [".php"] = true, [".pyc"] = true, [".class"] = true
}

local function is_ai_agent(ua)
    if not ua then return false end
    ua = string.lower(ua)
    for _, agent in ipairs(AI_USER_AGENTS) do
        if string.find(ua, agent, 1, true) then
            return true
        end
    end
    return false
end

local function is_source_file(uri)
    local ext = string.match(uri, "%%.[^%%.]+$")
    if not ext then return false end
    ext = string.lower(ext)
    return SOURCE_EXTENSIONS[ext] ~= nil
end

local function render_blocked_html(ip, reason)
    return string.format([[<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>403 Forbidden — RCF Active Protection</title>
    <style>
        body {
            background-color: #0d0e12;
            color: #e2e8f0;
            font-family: 'Courier New', Courier, monospace;
            padding: 50px;
            text-align: center;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #ff3333;
            background-color: #161822;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(255, 51, 51, 0.15);
        }
        pre {
            color: #ff3333;
            font-size: 14px;
            text-align: left;
            display: inline-block;
            margin-bottom: 30px;
        }
        h1 {
            color: #ffffff;
            font-size: 24px;
            margin-bottom: 20px;
        }
        p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .meta {
            font-size: 12px;
            color: #718096;
            margin-top: 30px;
            border-top: 1px solid #2d3748;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <pre>
  ██████╗  ██████╗███████╗              ██╗        ██╗
  ██╔══██╗██╔════╝██╔════╝      ██╗    ██╔╝       ██╔╝
  ██████╔╝██║     █████╗        ╚═╝   ██╔╝       ██╔╝ 
  ██╔══██╗██║     ██╔══╝        ██╗  ██╔╝       ██╔╝  
  ██║  ██║╚██████╗██║           ╚═╝ ██╔╝       ██╔╝   
  ╚═╝  ╚═╝ ╚═════╝╚═╝              ╚═╝        ╚═╝     
        </pre>
        <h1>403 Forbidden — RCF Active Protection</h1>
        <p>Access denied under the <strong>Restricted Correlation Framework PL</strong> (RCF-PL).</p>
        <p>Reason: %s</p>
        <div class="meta">
            Client IP: %s | System Status: Active Enforcement | RCF Gate v1.0.0
        </div>
    </div>
</body>
</html>]], reason, ip)
end

local headers = ngx.req.get_headers()
local ua = headers["user-agent"]
local ip = ngx.var.remote_addr or "unknown"

if is_ai_agent(ua) then
    ngx.status = ngx.HTTP_FORBIDDEN
    ngx.header.content_type = "text/html; charset=UTF-8"
    ngx.say(render_blocked_html(ip, "Automated AI harvester signature detected."))
    ngx.exit(ngx.HTTP_FORBIDDEN)
end

local uri = ngx.var.uri
if is_source_file(uri) then
    local rcf_limit = ngx.shared.rcf_limit
    if rcf_limit then
        local key = "rcf:ip:" .. ip
        local count, err = rcf_limit:get(key)
        if not count then
            rcf_limit:set(key, 1, 10)
        else
            if count > 10 then
                ngx.status = ngx.HTTP_TOO_MANY_REQUESTS
                ngx.header.content_type = "text/html; charset=UTF-8"
                ngx.say(render_blocked_html(ip, "Excessive code crawling pattern detected (Rate Limit Exceeded)."))
                ngx.exit(ngx.HTTP_TOO_MANY_REQUESTS)
            else
                rcf_limit:incr(key, 1)
            end
        end
    end
end
`;

const NGINX_CONF_SNIPPET = `# RCF Gateway Nginx WAF Configuration Snippet
# Add this to your nginx.conf to protect your codebase routes.

lua_shared_dict rcf_limit 10m;

server {
    listen 80;
    server_name yourdomain.com;

    location / {
        access_by_lua_file /etc/nginx/rcf_waf.lua;
        # proxy_pass http://localhost:8080;
    }
}
`;

const gatewayCmd = program
  .command('gateway')
  .description('Export WAF configuration files for Cloudflare or Nginx');

gatewayCmd
  .command('cloudflare')
  .description('Export Cloudflare Worker WAF script')
  .option('-o, --out <path>', 'Output directory', '.')
  .action((options) => {
    try {
      const outDir = resolve(options.out);
      if (!existsSync(outDir)) {
        console.log(chalk.red(`❌ Output directory does not exist: ${outDir}`));
        process.exit(1);
      }
      const targetFile = resolve(outDir, 'cloudflare_worker.ts');
      writeFileSync(targetFile, CLOUDFLARE_WAF_CODE, 'utf-8');
      console.log(chalk.green(`✅ Cloudflare Worker WAF script exported to: ${targetFile}`));
    } catch (e: any) {
      console.log(chalk.red(`❌ Error: ${e.message}`));
      process.exit(1);
    }
  });

gatewayCmd
  .command('nginx')
  .description('Export Nginx Lua WAF script and configuration snippet')
  .option('-o, --out <path>', 'Output directory', '.')
  .action((options) => {
    try {
      const outDir = resolve(options.out);
      if (!existsSync(outDir)) {
        console.log(chalk.red(`❌ Output directory does not exist: ${outDir}`));
        process.exit(1);
      }
      const luaFile = resolve(outDir, 'rcf_waf.lua');
      const confFile = resolve(outDir, 'nginx.conf');
      writeFileSync(luaFile, NGINX_WAF_LUA, 'utf-8');
      writeFileSync(confFile, NGINX_CONF_SNIPPET, 'utf-8');
      console.log(chalk.green(`✅ Nginx WAF Lua script exported to: ${luaFile}`));
      console.log(chalk.green(`✅ Nginx configuration snippet exported to: ${confFile}`));
    } catch (e: any) {
      console.log(chalk.red(`❌ Error: ${e.message}`));
      process.exit(1);
    }
  });

// ─── Entry Point ─────────────────────────────────────────────────────────────

if (process.argv.length > 2) {
  const firstArg = process.argv[2];
  const commands = ['init', 'verify', 'audit', 'diff', 'protect', 'sentinel', 'build-corpus', 'build-null', 'prove', 'canary', 'noise', 'gateway', '--help', '-h', '--version', '-V'];
  if (!commands.includes(firstArg) && (existsSync(resolve(firstArg)) || firstArg.startsWith('.') || firstArg.startsWith('/'))) {
    process.argv.splice(2, 0, 'verify');
  }
}

program.parse();
