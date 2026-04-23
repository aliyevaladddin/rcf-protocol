#!/usr/bin/env node
// NOTICE: This file is protected under RCF-PL v2.0
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

const GHOST_BANNER = `
    ${chalk.bold.cyan('╔══════════════════════════════════════════════════════════╗')}
    ${chalk.bold.cyan('║')}  ${chalk.bold.white('🛡️  RCF GHOST SHIELD — PROTOCOL v2.0.0')}             ${chalk.bold.cyan('║')}
    ${chalk.bold.cyan('║')}  ${chalk.gray('Sovereign Code Protection | Aladdin Aliyev')}         ${chalk.bold.cyan('║')}
    ${chalk.bold.cyan('╚══════════════════════════════════════════════════════════╝')}
`;

program
  .name('rcf-ghost-shield')
  .description('RCF Ghost Shield CLI v2.0.0 — Active Protection Framework')
  .version('2.0.0')
  .addHelpText('before', GHOST_BANNER)
  .arguments('[path]')
  .option('-k, --key <secret>', 'Secret key for Ghost Protocol (optional for scan)')
  .option('-v, --verbose', 'show details')
  .action((pathArg, options) => {
    // Default action if no command is specified
    const path = pathArg ?? '.';
    console.log(chalk.cyan(`◈ Running default scan for: ${path}`));
    // Trigger legacy scan behavior or verify if key provided
    if (options.key) {
      program.commands.find(c => c.name() === 'verify')?.parse(['verify', path, '--key', options.key], { from: 'user' });
    } else {
      console.log(chalk.yellow('⚠️  No secret key provided. Performing basic compliance scan...'));
      const scanner = new Scanner(resolve(path));
      const results = scanner.scanDirectory();
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
      console.log(chalk.yellow('⚠️  NOTICE.md already exists. Updating for v2.0.'));
    }

    writeFileSync(noticePath, [
      `# RCF-PL NOTICE — Ghost Protocol`,
      ``,
      `This project (**${projectName}**) is protected under the **Restricted Correlation Framework Protocol License (RCF-PL) v2.0**.`,
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
      `Full protocol: https://rcf.aliyev.site`,
    ].join('\n'));
    console.log(chalk.green('✅ Generated/Updated NOTICE.md for RCF v2.0'));

    const ignorePath = join(process.cwd(), '.rcfignore');
    if (!existsSync(ignorePath)) {
      writeFileSync(ignorePath, '# RCF Ignore File\nnode_modules\n.git\n__pycache__\n.venv\ndist\nbuild\n.next\ncoverage\n');
      console.log(chalk.green('✅ Generated .rcfignore'));
    }

    console.log(chalk.bold.green(`\n🎉 RCF Ghost Protocol initialized for '${projectName}'.`));
  });

// ─── GHOST-PROTECT (v2.0) ───────────────────────────────────────────────────

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
      if (content.includes('[RCF:GHOST:')) continue; // Already ghosted

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
  .description('Verify file/directory integrity (Active v2.0 verification)')
  .option('-k, --key <secret>', 'Secret key for HMAC validation')
  .option('-v, --verbose', 'show details')
  .action((pathArg = '.', options) => {
    const root = resolve(pathArg);
    const validator = new ComplianceValidator();
    const secretKey = options.key ?? process.env.RCF_PRIVATE_KEY;

    if (!secretKey) {
      console.log(chalk.red('❌ ERROR: Secret key required for Ghost Protocol verification.'));
      process.exit(1);
    }

    const files = collectFiles(root);
    let verifiedCount = 0;
    let totalViolations = 0;

    console.log(chalk.bold(`\n${chalk.cyan('◈')} Initializing Integrity Scan...`));
    console.log(chalk.gray(`  Path: ${root}`));
    console.log(chalk.gray(`  Engine: Aladdin Ghost Core v2.0`));
    console.log();

    for (const file of files) {
      const { valid, violations } = validator.verifyIntegrityChain(file, secretKey);
      const rel = relative(root, file);
      if (valid) {
        verifiedCount++;
        if (options.verbose) {
          console.log(`${chalk.green('  [PASS]')} ${chalk.gray('◈')} ${rel}`);
        }
      } else {
        totalViolations += violations;
        console.log(`${chalk.red('  [TAMPERED]')} ${chalk.bold.red('⚠')} ${rel}`);
        console.log(chalk.red(`    ╰── Integrity Chain broken: ${violations} illegal mutation(s) detected.`));
      }
    }

    console.log(`\n${chalk.cyan('◈')} Finalizing Report...`);
    if (totalViolations > 0) {
      console.log(chalk.bold.red(`\n❌ SHIELD BREACHED: ${totalViolations} violations found.`));
      console.log(chalk.red(`   Unauthorized logic replication or modification is a violation of RCF-PL v2.0.`));
      process.exit(1);
    } else {
      console.log(chalk.bold.green(`\n🛡️  GHOST SHIELD ACTIVE: ${verifiedCount} logic blocks verified.`));
      console.log(chalk.green(`   Integrity Chain verified against Sovereign Key.`));
    }
  });

// ─── LEGACY COMMANDS (STUBBED FOR v2.0) ──────────────────────────────────────

program
  .command('scan [directory]')
  .description('Scan directory for RCF markers (Legacy v2.0)')
  .action(() => {
    console.log(chalk.yellow('⚠️  Command [scan] is deprecated. Use [verify] for RCF v2.0.'));
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

// If no command is provided and first arg is a path, default to 'verify'
if (process.argv.length > 2) {
  const firstArg = process.argv[2];
  const commands = ['init', 'ghost-protect', 'verify', 'scan', 'audit', 'diff', 'protect', '--help', '-h', '--version', '-V'];
  if (!commands.includes(firstArg) && (existsSync(resolve(firstArg)) || firstArg.startsWith('.') || firstArg.startsWith('/'))) {
    process.argv.splice(2, 0, 'verify');
  }
}

program.parse();
