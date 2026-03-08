#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { MarkerParser } from '../core/MarkerParser';
import { ComplianceValidator } from '../core/ComplianceValidator';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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