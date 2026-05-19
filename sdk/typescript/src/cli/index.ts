#!/usr/bin/env node
// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative, extname, basename, dirname } from 'path';
import { createHash } from 'crypto';
import * as https from 'https';
import { fileURLToPath } from 'url';
import { MarkerParser } from '../core/MarkerParser.js';
import { ComplianceValidator } from '../core/ComplianceValidator.js';
import { AuditReport } from '../core/types.js';
import { Scanner } from '../core/Scanner.js';

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
  .version('2.1.1')
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
  .description('Generate RCF-AUDIT-REPORT.json (Premium Feature)')
  .option('--license-key <key>', 'RCF audit license key')
  .option('-v, --verbose', 'show details')
  .action(async (pathArg = '.', options) => {
    const licenseKey = options.licenseKey ?? process.env['RCF_LICENSE_KEY'];
    const adminKeyHash = '74bc881f2c077802'; // RCF Admin Slice
    const providedKeyHash = licenseKey
      ? createHash('sha256').update(licenseKey).digest('hex').slice(0, 16)
      : '';

    const root = resolve(pathArg);

    function detectProjectName(dir: string): string {
      const noticePath = join(dir, 'NOTICE.md');
      if (existsSync(noticePath)) {
        try {
          const content = readFileSync(noticePath, 'utf8');
          const match = content.match(/This project \(\*\*(.*?)\*\*\)/);
          if (match && match[1]) {
            return match[1].trim();
          }
        } catch (e) { }
      }
      const pkgPath = join(dir, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
          if (pkg.name) return pkg.name;
        } catch (e) { }
      }
      return basename(dir);
    }

    if (providedKeyHash !== adminKeyHash) {
      if (!licenseKey) {
        console.log(chalk.red("❌ RCF-PL ERROR: Audit token missing. 'audit' is a premium feature."));
        console.log(chalk.gray('   Purchase a key at: https://aliyev.site/rcf'));
        console.log(chalk.gray('   Then set the required CLI argument or environment variable.'));
        process.exit(1);
      }
      if (!licenseKey.startsWith('RCF-AUDIT-')) {
        console.log(chalk.red("❌ RCF-PL ERROR: Invalid audit token format. Must start with 'RCF-AUDIT-'."));
        console.log(chalk.gray('   Purchase a valid key at: https://aliyev.site/rcf'));
        process.exit(1);
      }

      const projectName = detectProjectName(root);

      console.log(chalk.yellow('📡 Verifying audit status for \'' + projectName + '\' with aliyev.site...'));
      const isOnlineValid = await new Promise<boolean>((resolveValidation) => {
        const postData = JSON.stringify({ key: licenseKey, project: projectName });
        const req = https.request({
          hostname: 'aliyev.site',
          port: 443,
          path: '/api/rcf-verify',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolveValidation(res.statusCode === 200 && json.valid === true);
            } catch (e) {
              resolveValidation(false);
            }
          });
        });

        req.on('error', () => {
          console.log(chalk.red("❌ Network Error: Could not reach aliyev.site to verify credentials."));
          resolveValidation(false);
        });

        req.write(postData);
        req.end();
      });

      if (!isOnlineValid) {
        console.log(chalk.red("❌ RCF-PL ERROR: Audit token is invalid, expired, or not found in database."));
        console.log(chalk.gray('   Purchase a valid key at: https://aliyev.site/rcf'));
        process.exit(1);
      }
      console.log(chalk.green("✅ Audit credentials verified successfully."));
    }
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
    if (options.dryRun) console.log(chalk.gray('   Run without --dry-run to apply changes.'));
  });

// ─── Entry Point ─────────────────────────────────────────────────────────────

if (process.argv.length > 2) {
  const firstArg = process.argv[2];
  const commands = ['init', 'verify', 'audit', 'diff', 'protect', '--help', '-h', '--version', '-V'];
  if (!commands.includes(firstArg) && (existsSync(resolve(firstArg)) || firstArg.startsWith('.') || firstArg.startsWith('/'))) {
    process.argv.splice(2, 0, 'verify');
  }
}

program.parse();
