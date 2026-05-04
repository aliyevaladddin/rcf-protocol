#!/usr/bin/env node
// NOTICE: This file is protected under RCF-PL v2.0.6
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

const program = new Command();

const GHOST_BANNER = `
    ${chalk.bold.cyan('╔══════════════════════════════════════════════════════════╗')}
    ${chalk.bold.cyan('║')}  ${chalk.bold.white('🛡️  RCF GHOST SHIELD — PROTOCOL v2.0.6')}               ${chalk.bold.cyan('║')}
    ${chalk.bold.cyan('║')}  ${chalk.gray('Sovereign Code Protection | Aladdin Aliyev')}         ${chalk.bold.cyan('║')}
    ${chalk.bold.cyan('╚══════════════════════════════════════════════════════════╝')}
`;

program
  .name('rcf-ghost-shield')
  .description('RCF Ghost Shield CLI v2.0.6 — Active Protection Framework')
  .version('2.0.6')
  .addHelpText('before', GHOST_BANNER)
  .arguments('[path]')
  .option('-k, --key <secret>', 'Secret key for Ghost Protocol (optional for scan)')
  .option('-v, --verbose', 'show details')
  .action((pathArg, options) => {
    const path = pathArg ?? '.';
    console.log(chalk.cyan(`◈ Running default scan for: ${path}`));
    if (options.key) {
      program.commands.find(c => c.name() === 'verify')?.parse(['verify', path, '--key', options.key], { from: 'user' });
    } else {
      console.log(chalk.yellow('⚠️  No secret key provided. Performing basic compliance scan...'));
      const scanner = new Scanner();
      const results = scanner.scanDirectory(resolve(path));
      console.log(chalk.bold(`\nScan complete. Found ${results.length} files needing attention.`));
    }
  });

// ─── INIT ────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize RCF Ghost Protocol in the current project')
  .option('--project <name>', 'Project name')
  .option('--author <name>', 'Author name')
  .action((options) => {
    const projectName = options.project ?? basename(process.cwd());
    const author = options.author ?? 'Author';
    const year = new Date().getFullYear();

    const noticePath = join(process.cwd(), 'NOTICE.md');
    if (existsSync(noticePath)) {
      console.log(chalk.yellow('⚠️  NOTICE.md already exists. Updating for v2.0.6.'));
    }

    writeFileSync(noticePath, [
      `# RCF-PL NOTICE — Ghost Protocol`,
      ``,
      `This project (**${projectName}**) is protected under the **Restricted Correlation Framework Protocol License (RCF-PL) v2.0.6**.`,
      ``,
      `Copyright (c) ${year} ${author}. All rights reserved.`,
      ``,
      `## 🚨 ACTIVE ENFORCEMENT`,
      `This code implements **Active Integrity Chains**. Unauthorized modification,`,
      `replication, or analysis by AI/ML models will trigger automatic`,
      `execution termination and forensic logging.`,
      ``,
      `## ⚠️ AI/ML Training Restriction`,
      `Automated extraction or use for training Machine Learning models is **STRICTLY PROHIBITED**.`,
      ``,
      `Full protocol: https://aliyev.site/rcf`,
    ].join('\n'));
    console.log(chalk.green('✅ Generated/Updated NOTICE.md for RCF v2.0.6'));

    const ignorePath = join(process.cwd(), '.rcfignore');
    if (!existsSync(ignorePath)) {
      writeFileSync(ignorePath, '# RCF Ignore File\nnode_modules\n.git\n__pycache__\n.venv\ndist\nbuild\n.next\ncoverage\n');
      console.log(chalk.green('✅ Generated .rcfignore'));
    }

    console.log(chalk.bold.green(`\n🎉 RCF Ghost Protocol initialized for '${projectName}'.`));
  });

// ─── AUDIT ───────────────────────────────────────────────────────────────────

program
  .command('audit [path]')
  .description('Generate RCF-AUDIT-REPORT.json (Premium Feature)')
  .option('--license-key <key>', 'RCF audit license key')
  .option('-v, --verbose', 'show details')
  .action(async (pathArg = '.', options) => {
    const licenseKey = options.licenseKey ?? process.env['RCF_LICENSE_KEY'];
    const adminKeyHash = '74bc881f2c077802'; // RCF Ghost Admin Slice (v2.0.6)
    const providedKeyHash = licenseKey
      ? createHash('sha256').update(licenseKey).digest('hex').slice(0, 16)
      : '';

    if (providedKeyHash !== adminKeyHash) {
      if (!licenseKey) {
        console.log(chalk.red("❌ RCF-PL ERROR: License key missing. 'audit' is a premium feature."));
        console.log(chalk.gray('   Set --license-key or RCF_LICENSE_KEY env variable.'));
        process.exit(1);
      }
      if (!licenseKey.startsWith('RCF-AUDIT-')) {
        console.log(chalk.red("❌ RCF-PL ERROR: Invalid license key format. Must start with 'RCF-AUDIT-'."));
        process.exit(1);
      }
    }

    const root = resolve(pathArg);
    console.log(chalk.cyan(`◈ Generating Audit Report for: ${root}`));

    const parser = new MarkerParser(root);
    const results = await parser.scanAll();
    const validator = new ComplianceValidator();
    const report = validator.generateReport(results, root);

    report.audit_type = 'RCF-Audit v2.0.6 (Ghost Shield)';

    const reportPath = join(root, 'RCF-AUDIT-REPORT.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    if (options.verbose) {
      for (const asset of report.protected_assets) {
        console.log(chalk.gray(`  ◈ ${asset.file}  markers=[${asset.markers.join(',')}]`));
      }
    }

    console.log(chalk.green(`✅ Audit complete. ${report.protected_assets.length} assets recorded.`));
    console.log(chalk.gray(`   Report saved to: ${reportPath}`));
  });

// ─── GHOST-PROTECT ───────────────────────────────────────────────────────────

program
  .command('ghost-protect [directory]')
  .description('Apply dynamic Ghost Markers and Integrity Checks (Active Protection)')
  .requiredOption('-k, --key <secret>', 'Secret key for HMAC generation')
  .option('--dry-run', 'preview changes without writing files')
  .action((directory = '.', options) => {
    const root = resolve(directory);
    const validator = new ComplianceValidator();
    const files = collectFiles(root);

    let modified = 0;

    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf-8');
      if (content.includes('[RCF:GHOST:')) continue;

      const ghosted = validator.injectIntegrityCheck(content, options.key);
      if (ghosted !== content) {
        if (!options.dryRun) {
          writeFileSync(filePath, ghosted, 'utf-8');
          console.log(chalk.green(`✅ GHOSTED: ${relative(root, filePath)}`));
        } else {
          console.log(chalk.cyan(`🔍 WOULD GHOST: ${relative(root, filePath)}`));
        }
        modified++;
      }
    }

    console.log(chalk.bold(`\n🛡️  Ghost Protocol applied to ${modified} file(s).`));
  });

// ─── VERIFY ──────────────────────────────────────────────────────────────────

program
  .command('verify [path]')
  .description('Verify file/directory integrity against audit report')
  .option('-k, --key <secret>', 'Secret key for Ghost HMAC validation')
  .option('--against <report>', 'Path to audit report JSON (single-file verify)')
  .option('-v, --verbose', 'show details')
  .action((pathArg = '.', options) => {
    const root = resolve(pathArg);
    const validator = new ComplianceValidator();
    const secretKey = options.key ?? process.env['RCF_PRIVATE_KEY'];

    // Single-file verification against a specific report
    if (options.against) {
      try {
        const result = validator.verifyFile(root, resolve(options.against));
        console.log(chalk.bold('--- RCF File Verification ---'));
        console.log(chalk.gray(`File    : ${result.file}`));
        console.log(chalk.gray(`Report  : ${result.reportPath}`));
        console.log(chalk.gray(`Recorded: ${result.recordedAt}`));
        console.log();
        if (result.verified) {
          console.log(chalk.green(`✅ VERIFIED — file matches audit record (RCF v2.0.6)`));
          console.log(chalk.gray(`   SHA-256: ${result.currentHash}`));
        } else {
          console.log(chalk.red(`🚨 TAMPERED — file has been modified since audit!`));
          console.log(chalk.red(`   stored : ${result.storedHash}`));
          console.log(chalk.red(`   current: ${result.currentHash}`));
          process.exit(1);
        }
      } catch (e: any) {
        console.log(chalk.red(`❌ ${e.message}`));
        process.exit(1);
      }
      return;
    }

    // Directory verification: SHA-256 against RCF-AUDIT-REPORT.json
    const reportPath = join(root, 'RCF-AUDIT-REPORT.json');
    if (!existsSync(reportPath)) {
      console.log(chalk.red(`❌ Audit report not found at: ${reportPath}`));
      console.log(chalk.gray("   Run 'rcf-ghost-shield audit .' first."));
      process.exit(1);
    }

    const report: AuditReport = JSON.parse(readFileSync(reportPath, 'utf-8'));
    const assets = report.protected_assets ?? [];

    console.log(chalk.bold(`\n--- RCF Integrity Verification (${assets.length} assets) ---`));
    console.log(chalk.gray(`  Engine: Aladdin Ghost Core v2.0.6\n`));

    const missing: string[] = [];
    const tampered: string[] = [];
    let verified = 0;
    let violations = 0;

    for (const asset of assets) {
      const fullPath = join(root, asset.file);
      if (!existsSync(fullPath)) {
        missing.push(asset.file);
        console.log(chalk.red(`❌ MISSING  : ${asset.file}`));
        continue;
      }

      const current = createHash('sha256').update(readFileSync(fullPath)).digest('hex');
      if (current === asset.sha256) {
        verified++;
        if (options.verbose) console.log(chalk.green(`✅ VERIFIED : ${asset.file}`));
      } else {
        tampered.push(asset.file);
        console.log(chalk.red(`🚨 TAMPERED : ${asset.file}`));
        if (options.verbose) {
          console.log(chalk.gray(`   stored : ${asset.sha256}`));
          console.log(chalk.gray(`   current: ${current}`));
        }
      }
    }

    // Ghost chain HMAC check (only if key provided)
    if (secretKey) {
      console.log(chalk.gray(`\n  Ghost Chain verification with key...`));
      for (const asset of assets) {
        const fullPath = join(root, asset.file);
        if (!existsSync(fullPath)) continue;
        const r = validator.verifyIntegrityChain(fullPath, secretKey);
        if (!r.valid) {
          violations += r.violations;
          console.log(chalk.red(`💀 BREACHED : ${asset.file} (${r.violations} illegal mutation(s))`));
        }
      }
    }

    console.log();
    if (tampered.length || missing.length || violations) {
      console.log(chalk.bold.red(`❌ FAILED. Tampered: ${tampered.length}, Missing: ${missing.length}, Violations: ${violations}`));
      process.exit(1);
    } else {
      const status = secretKey ? '🛡️  GHOST SHIELD ACTIVE' : '✅ Integrity OK';
      console.log(chalk.bold.green(`${status}: All ${verified} assets verified.`));
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
      console.log(chalk.red(`❌ Audit report not found at: ${reportPath}`));
      console.log(chalk.gray("   Run 'rcf-ghost-shield audit .' first."));
      process.exit(1);
    }

    const report: AuditReport = JSON.parse(readFileSync(reportPath, 'utf-8'));
    const parser = new MarkerParser(root);
    const results = await parser.scanAll();
    const validator = new ComplianceValidator();
    const diff = validator.diff(results, report, root);

    if (options.verbose && diff.newUnprotectedFiles.length) {
      for (const f of diff.newUnprotectedFiles) {
        console.log(chalk.yellow(`⚠️  NEW UNPROTECTED LOGIC: ${f}`));
      }
    }

    if (!diff.passed) {
      console.log(chalk.red(`\n🚨 COMPLIANCE VIOLATIONS: ${diff.violations.length}`));
      for (const v of diff.violations) {
        console.log(chalk.red(`   [${v.type.toUpperCase()}] ${v.file}: ${v.detail}`));
      }
      if (diff.newUnprotectedFiles.length) {
        console.log(chalk.yellow(`⚠️  ${diff.newUnprotectedFiles.length} new file(s) with unprotected logic.`));
      }
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ No marker violations detected. All audited assets compliant.'));
      if (diff.newUnprotectedFiles.length) {
        console.log(chalk.yellow(`   ⚠️  ${diff.newUnprotectedFiles.length} new file(s) with unprotected logic (run 'protect').`));
      }
    }
  });

// ─── PROTECT ─────────────────────────────────────────────────────────────────

program
  .command('protect [path]')
  .description('Auto-insert RCF markers into unprotected logic blocks')
  .option('--dry-run', 'preview changes without writing files')
  .option('-v, --verbose', 'show details')
  .action((pathArg = '.', options) => {
    const root = resolve(pathArg);
    const scanner = new Scanner();
    const results = scanner.scanDirectory(root);
    const needsWork = results.filter(r => r.hasUnprotectedLogic || !r.hasHeader);

    if (!needsWork.length) {
      console.log(chalk.green('✅ No unprotected logic found. Nothing to do.'));
      return;
    }

    let modified = 0;
    let skipped = 0;

    for (const result of needsWork) {
      let lines: string[];
      try {
        lines = readFileSync(result.path, 'utf-8').split('\n');
      } catch (e: any) {
        console.log(chalk.yellow(`⚠️  Cannot read ${result.path}: ${e.message}`));
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
          console.log(chalk.cyan(`🔍 DRY RUN : ${relative(root, result.path)}  (${gaps} block(s) would be marked)`));
        } else {
          writeFileSync(result.path, newLines.join('\n'), 'utf-8');
          console.log(chalk.green(`✅ PROTECTED: ${relative(root, result.path)}  (${gaps} block(s) marked)`));
        }
        modified++;
      } else {
        skipped++;
      }
    }

    console.log();
    const action = options.dryRun ? 'Would modify' : 'Modified';
    console.log(chalk.bold(`🛡️  ${action} ${modified} file(s). Skipped: ${skipped}.`));
    if (options.dryRun) console.log(chalk.gray('   Run without --dry-run to apply changes.'));
  });

// ─── SCAN (LEGACY) ───────────────────────────────────────────────────────────

program
  .command('scan [directory]')
  .description('Scan directory for RCF markers (Legacy v2.0.6)')
  .action(() => {
    console.log(chalk.yellow('⚠️  Command [scan] is deprecated. Use [verify] for RCF v2.0.6.'));
  });

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCANNABLE = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.cpp', '.c',
  '.h', '.s', '.md', 'makefile',
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
      } else if (
        SCANNABLE.has(extname(entry).toLowerCase()) ||
        SCANNABLE.has(entry.toLowerCase())
      ) {
        files.push(full);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return files;
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

if (process.argv.length > 2) {
  const firstArg = process.argv[2];
  const commands = ['init', 'ghost-protect', 'verify', 'scan', 'audit', 'diff', 'protect', '--help', '-h', '--version', '-V'];
  if (!commands.includes(firstArg) && (existsSync(resolve(firstArg)) || firstArg.startsWith('.') || firstArg.startsWith('/'))) {
    process.argv.splice(2, 0, 'verify');
  }
}

program.parse();
