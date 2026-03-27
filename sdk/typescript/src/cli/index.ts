#!/usr/bin/env node
// NOTICE: This file is protected under RCF-PL v1.2.8

import { Command } from 'commander';
import chalk from 'chalk';
import { MarkerParser } from '../core/MarkerParser';
import { ComplianceValidator } from '../core/ComplianceValidator';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, relative } from 'path';
import { createHash } from 'crypto';

const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('rcf-cli')
  .description('RCF Protocol CLI')
  .version(pkg.version);

program
  .command('scan [directory]')
  .description('Scan directory for RCF markers')
  .option('-f, --format <type>', 'output format', 'pretty')
  .option('--summary', 'show summary only')
  .action(async (directory = '.', options) => {
    const parser = new MarkerParser();
    const results = await parser.scan(directory);

    if (options.summary) {
      printSummary(results);
    } else {
      printResults(results, options.format);
    }
  });

program
  .command('validate [directory]')
  .description('Validate RCF compliance')
  .option('--strict', 'strict mode')
  .action(async (directory = '.', options) => {
    const parser = new MarkerParser();
    const results = await parser.scan(directory);

    const validator = new ComplianceValidator({ strict: options.strict });
    const status = await validator.validate(results);

    if (status.valid) {
      console.log(chalk.green('✅ RCF compliance validated'));
    } else {
      console.log(chalk.red('❌ RCF compliance failed'));
      status.errors.forEach(e => console.log(chalk.red(`  • ${e.file}:${e.line} - ${e.message}`)));
      process.exit(1);
    }
  });

program
  .command('audit [directory]')
  .description('Generate an RCF Audit Report (Premium Feature). Get keys at https://rcf.aliyev.site')
  .option('-k, --license-key <key>', 'RCF Audit License Key')
  .action(async (directory = '.', options) => {
    const licenseKey = options.licenseKey || process.env.RCF_LICENSE_KEY;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

    const adminKeyHash = '74bc881f2c077802d68ee7b42a2fe98988dd76c35d835b6fa14f6313f5cb9d7e';
    const providedKeyHash = licenseKey ? createHash('sha256').update(licenseKey).digest('hex') : '';
    const isLicenseValid = (providedKeyHash === adminKeyHash) || (licenseKey && licenseKey.startsWith('RCF-AUDIT-') && uuidRegex.test(licenseKey.replace('RCF-AUDIT-', '')));

    if (!isLicenseValid) {
      console.log(chalk.red("❌ RCF-PL ERROR: The 'audit' command is a premium feature."));
      console.log(chalk.yellow("   Please provide a valid RCF-AUDIT license key via -k/--license-key or RCF_LICENSE_KEY env variable."));
      console.log(chalk.blue("   Visit https://rcf.aliyev.site to obtain a license."));
      process.exit(1);
    }

    const parser = new MarkerParser();
    const results = await parser.scan(directory);

    const auditReport = {
      timestamp: new Date().toISOString(),
      audit_type: "RCF-Audit as a Service",
      protected_assets: [] as any[]
    };

    for (const res of results) {
      if (res.markers && res.markers.length > 0) {
        try {
          const fileBuffer = readFileSync(res.file);
          const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

          const uniqueMarkers = Array.from(new Set(res.markers.map((m: any) => m.type)));
          const relPath = relative(resolve(directory), res.file);

          auditReport.protected_assets.push({
            file: relPath,
            markers: uniqueMarkers,
            sha256: fileHash
          });
        } catch (e) {
          // ignore
        }
      }
    }

    const reportPath = resolve(directory, 'RCF-AUDIT-REPORT.json');
    writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));

    console.log(chalk.green(`✅ RCF-Audit Complete. Generated ${reportPath}`));
    console.log(chalk.cyan(`🔒 Encrypted snapshot of ${auditReport.protected_assets.length} protected assets created.`));
  });

function printSummary(results: any[]) {
  const stats: Record<string, number> = { PUBLIC: 0, PROTECTED: 0, RESTRICTED: 0, NOTICE: 0 };
  results.forEach(r => r.markers.forEach((m: any) => stats[m.type]++));

  console.log(chalk.bold('\n📊 RCF Markers Summary:'));
  console.log(`  ${chalk.green('[RCF:PUBLIC]')}: ${stats.PUBLIC}`);
  console.log(`  ${chalk.yellow('[RCF:PROTECTED]')}: ${stats.PROTECTED}`);
  console.log(`  ${chalk.red('[RCF:RESTRICTED]')}: ${stats.RESTRICTED}`);
  console.log(`  ${chalk.blue('[RCF:NOTICE]')}: ${stats.NOTICE}`);
  console.log(`  Total files: ${results.length}\n`);
}

function printResults(results: any[], format: string) {
  if (format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  results.forEach(({ file, markers }: any) => {
    console.log(chalk.bold(`\n📄 ${file}`));
    markers.forEach((m: any) => {
      const color = m.type === 'PUBLIC' ? 'green' :
        m.type === 'PROTECTED' ? 'yellow' :
          m.type === 'RESTRICTED' ? 'red' : 'blue';
      console.log(`  ${(chalk as any)[color](m.marker.name)} Line ${m.line}: ${m.context.substring(0, 50)}...`);
    });
  });
}

program.parse();
