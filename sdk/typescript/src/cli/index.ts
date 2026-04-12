#!/usr/bin/env node
// NOTICE: This file is protected under RCF-PL v1.3
// [RCF:PROTECTED]

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative, extname, basename, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { MarkerParser } from '../core/MarkerParser.js';
import { ComplianceValidator } from '../core/ComplianceValidator.js';
import { AuditReport } from '../core/types.js';
import { Scanner } from '../core/Scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('rcf-cli')
  .description('RCF Protocol CLI v1.3 — Restricted Correlation Framework')
  .version(pkg.version);

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
      console.log(chalk.yellow('⚠️  NOTICE.md already exists. Skipping.'));
    } else {
      writeFileSync(noticePath, [
        `# RCF-PL NOTICE`,
        ``,
        `This project (**${projectName}**) is protected under the **Restricted Correlation Framework Protocol License (RCF-PL) v1.3**.`,
        ``,
        `Copyright (c) ${year} ${author}. All rights reserved.`,
        ``,
        `## ⚠️ AI/ML Training Restriction`,
        `Automated extraction, correlation, or use of this code for training`,
        `Machine Learning models is **STRICTLY PROHIBITED** without explicit written permission.`,
        ``,
        `## Usage Rights`,
        `- **Visibility**: You are free to read, study, and audit the source code.`,
        `- **Replication**: You may not replicate methodologies marked as \`[RCF:PROTECTED]\` or \`[RCF:RESTRICTED]\`.`,
        ``,
        `Full protocol: https://rcf.aliyev.site`,
      ].join('\n'));
      console.log(chalk.green('✅ Generated NOTICE.md'));
    }

    const ignorePath = join(process.cwd(), '.rcfignore');
    if (!existsSync(ignorePath)) {
      writeFileSync(ignorePath, '# RCF Ignore File\nnode_modules\n.git\n__pycache__\n.venv\ndist\nbuild\n.next\ncoverage\n');
      console.log(chalk.green('✅ Generated .rcfignore'));
    }

    console.log(chalk.bold.green(`\n🎉 RCF Protocol initialized for '${projectName}'.`));
  });

// ─── SCAN ────────────────────────────────────────────────────────────────────

program
  .command('scan [directory]')
  .description('Scan directory for RCF markers')
  .option('-f, --format <type>', 'output format: pretty | json', 'pretty')
  .option('--summary', 'show summary only')
  .action(async (directory = '.', options) => {
    const parser = new MarkerParser(resolve(directory));
    const results = await parser.scanAll(directory);
    const withMarkers = results.filter(r => r.markers.length > 0 || r.hasHeader);

    if (options.format === 'json') {
      console.log(JSON.stringify(withMarkers, null, 2));
      return;
    }

    if (options.summary || withMarkers.length === 0) {
      printSummary(withMarkers);
      return;
    }

    for (const { file, markers } of withMarkers) {
      const rel = relative(resolve(directory), file);
      console.log(chalk.bold(`\n📄 ${rel}`));
      for (const m of markers) {
        const color = m.type === 'PUBLIC' ? 'green'
          : m.type === 'PROTECTED' ? 'yellow'
          : m.type === 'RESTRICTED' ? 'red' : 'blue';
        console.log(`  ${(chalk as any)[color](`[RCF:${m.type}]`)} Line ${m.line}: ${m.context.slice(0, 60)}`);
      }
    }

    console.log();
    printSummary(withMarkers);
  });

// ─── VALIDATE ────────────────────────────────────────────────────────────────

program
  .command('validate [directory]')
  .description('Validate RCF compliance of all files')
  .option('--strict', 'require headers and markers on every file')
  .action(async (directory = '.', options) => {
    const parser = new MarkerParser(resolve(directory));
    const results = await parser.scanAll(directory);
    const validator = new ComplianceValidator({ strict: options.strict });
    const status = await validator.validate(results);

    if (status.valid) {
      console.log(chalk.green('✅ RCF compliance validated'));
    } else {
      console.log(chalk.red('❌ RCF compliance failed'));
      for (const e of status.errors) {
        const loc = e.line ? `:${e.line}` : '';
        console.log(chalk.red(`  • ${e.file}${loc} — ${e.message}`));
      }
      process.exit(1);
    }
  });

// ─── PROTECT ─────────────────────────────────────────────────────────────────

program
  .command('protect [directory]')
  .description('Auto-insert RCF markers into unprotected logic blocks')
  .option('--dry-run', 'preview changes without writing files')
  .option('-v, --verbose', 'show all scanned files')
  .action((directory = '.', options) => {
    const root = resolve(directory);
    const scanner = new Scanner();
    const files = collectFiles(root);

    let modified = 0;
    let skipped = 0;

    for (const filePath of files) {
      const result = scanner.scanFile(filePath);
      if (!result.hasUnprotectedLogic && result.isProtected) {
        if (options.verbose) {
          console.log(chalk.gray(`  ✓ ${relative(root, filePath)}`));
        }
        skipped++;
        continue;
      }

      const lines = readFileSync(filePath, 'utf-8').split('\n');
      const newLines: string[] = [];

      if (!result.hasHeader) {
        newLines.push(Scanner.headerLine(filePath).trimEnd());
      }

      const gapLines = new Set(result.unprotectedLogic.map(b => b.line));
      const markerLine = Scanner.makeMarkerLine(filePath).trimEnd();

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        if (gapLines.has(lineNum)) {
          const prev = newLines[newLines.length - 1] ?? '';
          if (!/\[RCF:/.test(prev)) {
            newLines.push(markerLine);
          }
        }
        newLines.push(lines[i]);
      }

      const rel = relative(root, filePath);
      const blocks = result.unprotectedLogic.length;

      if (options.dryRun) {
        console.log(chalk.cyan(`🔍 DRY RUN: ${rel}  (${blocks} block(s) would be marked)`));
      } else {
        writeFileSync(filePath, newLines.join('\n'), 'utf-8');
        console.log(chalk.green(`✅ PROTECTED: ${rel}  (${blocks} block(s) marked)`));
      }
      modified++;
    }

    console.log();
    const action = options.dryRun ? 'Would modify' : 'Modified';
    console.log(chalk.bold(`🛡️  ${action} ${modified} file(s). Already protected: ${skipped}.`));
    if (options.dryRun) console.log(chalk.gray('   Run without --dry-run to apply.'));
  });

// ─── AUDIT ───────────────────────────────────────────────────────────────────

program
  .command('audit [directory]')
  .description('Generate RCF-AUDIT-REPORT.json (premium feature)')
  .option('-k, --license-key <key>', 'RCF Audit License Key')
  .option('-v, --verbose', 'show all audited files')
  .action(async (directory = '.', options) => {
    const licenseKey = options.licenseKey ?? process.env.RCF_LICENSE_KEY ?? '';
    if (!isLicenseValid(licenseKey)) {
      console.log(chalk.red('❌ RCF-PL ERROR: Invalid or missing license key.'));
      console.log(chalk.yellow('   Obtain a key at https://rcf.aliyev.site'));
      process.exit(1);
    }

    const root = resolve(directory);
    const parser = new MarkerParser(root);
    const results = await parser.scanAll(directory);
    const validator = new ComplianceValidator();
    const report = validator.generateReport(results, root);

    if (options.verbose) {
      for (const a of report.protected_assets) {
        console.log(chalk.gray(`  ${a.file}  ${a.sha256.slice(0, 16)}…`));
      }
    }

    const reportPath = join(root, 'RCF-AUDIT-REPORT.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(chalk.green(`✅ Audit complete. ${report.protected_assets.length} assets recorded.`));
    console.log(chalk.cyan(`   Report: ${reportPath}`));
  });

// ─── DIFF ────────────────────────────────────────────────────────────────────

program
  .command('diff [directory]')
  .description('Compare current marker state vs audit report (use in CI/CD)')
  .option('-v, --verbose', 'show all checked files')
  .action(async (directory = '.', options) => {
    const root = resolve(directory);
    const reportPath = join(root, 'RCF-AUDIT-REPORT.json');

    let report: AuditReport;
    try {
      report = ComplianceValidator.loadReport(reportPath);
    } catch (e: any) {
      console.log(chalk.red(`❌ ${e.message}`));
      console.log(chalk.gray("   Run 'rcf-cli audit' first."));
      process.exit(1);
    }

    const parser = new MarkerParser(root);
    const results = await parser.scanAll(directory);
    const validator = new ComplianceValidator();
    const diff = validator.diff(results, report, root);

    for (const v of diff.violations) {
      if (v.type === 'file_missing') {
        console.log(chalk.red(`🚨 MISSING  : ${v.file}`));
      } else if (v.type === 'markers_removed') {
        console.log(chalk.red(`🚨 MARKERS REMOVED: ${v.file}  [${v.removed?.join(', ')}]`));
      }
    }

    if (options.verbose && diff.violations.length === 0) {
      const audited = report.protected_assets.map(a => a.file);
      for (const f of audited) console.log(chalk.gray(`  ✅ ${f}`));
    }

    if (diff.newUnprotectedFiles.length > 0) {
      console.log();
      for (const f of diff.newUnprotectedFiles) {
        console.log(chalk.yellow(`⚠️  NEW UNPROTECTED: ${f}`));
      }
    }

    console.log();
    if (!diff.passed) {
      console.log(chalk.bold.red(`❌ ${diff.violations.length} violation(s) found.`));
      process.exit(1);
    } else {
      console.log(chalk.bold.green(`✅ No violations. ${report.protected_assets.length} asset(s) compliant.`));
      if (diff.newUnprotectedFiles.length > 0) {
        console.log(chalk.yellow(`⚠️  ${diff.newUnprotectedFiles.length} new file(s) with unprotected logic — run 'rcf-cli protect'.`));
      }
    }
  });

// ─── VERIFY ──────────────────────────────────────────────────────────────────

program
  .command('verify [path]')
  .description('Verify file integrity against audit report')
  .option('--against <report>', 'path to audit report JSON (enables single-file mode)')
  .option('-v, --verbose', 'show hash details')
  .action((pathArg = '.', options) => {
    const validator = new ComplianceValidator();

    if (options.against) {
      // Single-file mode
      try {
        const result = validator.verifyFile(pathArg, options.against);
        console.log(chalk.bold('--- RCF File Verification ---'));
        console.log(`File    : ${result.file}`);
        console.log(`Report  : ${result.reportPath}`);
        console.log(`Recorded: ${result.recordedAt}`);
        console.log();
        if (result.verified) {
          console.log(chalk.green('✅ VERIFIED — file matches audit record (RCF v1.3)'));
          if (options.verbose) console.log(chalk.gray(`   SHA-256: ${result.currentHash}`));
        } else {
          console.log(chalk.red('🚨 TAMPERED — file has been modified since audit!'));
          if (options.verbose) {
            console.log(chalk.gray(`   stored : ${result.storedHash}`));
            console.log(chalk.gray(`   current: ${result.currentHash}`));
          }
          process.exit(1);
        }
      } catch (e: any) {
        console.log(chalk.red(`❌ ${e.message}`));
        process.exit(1);
      }
    } else {
      // Directory mode
      const root = resolve(pathArg);
      const reportPath = join(root, 'RCF-AUDIT-REPORT.json');
      let report: AuditReport;
      try {
        report = ComplianceValidator.loadReport(reportPath);
      } catch (e: any) {
        console.log(chalk.red(`❌ ${e.message}`));
        process.exit(1);
      }

      console.log(chalk.bold(`--- RCF Integrity Verification (${report.protected_assets.length} assets) ---`));
      const { verified, missing, tampered } = validator.verifyAll(root, report);

      if (options.verbose) {
        for (const a of report.protected_assets) {
          const fullPath = join(root, a.file);
          if (!existsSync(fullPath)) continue;
          const hash = createHash('sha256').update(readFileSync(fullPath)).digest('hex');
          if (hash === a.sha256) console.log(chalk.gray(`  ✅ ${a.file}`));
        }
      }
      for (const f of missing)  console.log(chalk.red(`❌ MISSING  : ${f}`));
      for (const f of tampered) console.log(chalk.red(`🚨 TAMPERED : ${f}`));

      console.log();
      if (missing.length > 0 || tampered.length > 0) {
        console.log(chalk.bold.red(`❌ FAILED. Tampered: ${tampered.length}, Missing: ${missing.length}, Verified: ${verified}`));
        process.exit(1);
      } else {
        console.log(chalk.bold.green(`🛡️  All ${verified} assets verified. Integrity OK.`));
      }
    }
  });

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCANNABLE = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.cpp', '.c',
  '.h', '.s', 'makefile',
]);

const IGNORE_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '__pycache__',
  '.venv', '.next', 'coverage', '.turbo',
]);

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (!IGNORE_DIRS.has(entry)) files.push(...collectFiles(full));
      } else if (SCANNABLE.has(extname(entry).toLowerCase())) {
        files.push(full);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return files;
}

function isLicenseValid(key: string): boolean {
  const adminHash = '74bc881f2c077802d68ee7b42a2fe98988dd76c35d835b6fa14f6313f5cb9d7e';
  const providedHash = createHash('sha256').update(key).digest('hex');
  if (providedHash === adminHash) return true;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return key.startsWith('RCF-AUDIT-') && uuidRegex.test(key.replace('RCF-AUDIT-', ''));
}

function printSummary(results: any[]): void {
  const stats: Record<string, number> = { PUBLIC: 0, PROTECTED: 0, RESTRICTED: 0, NOTICE: 0 };
  results.forEach(r => r.markers.forEach((m: any) => { stats[m.type] = (stats[m.type] ?? 0) + 1; }));
  console.log(chalk.bold('\n📊 RCF Summary:'));
  console.log(`  ${chalk.green('[RCF:PUBLIC]')}     : ${stats.PUBLIC}`);
  console.log(`  ${chalk.yellow('[RCF:PROTECTED]')}  : ${stats.PROTECTED}`);
  console.log(`  ${chalk.red('[RCF:RESTRICTED]')} : ${stats.RESTRICTED}`);
  console.log(`  Total protected files: ${results.length}\n`);
}

program.parse();
