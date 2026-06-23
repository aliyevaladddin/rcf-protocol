import { execSync } from 'child_process';

const files = [
  'canary.test.ts',
  'correlate.test.ts',
  'cross_lang.test.ts',
  'measure.test.ts',
  'proof.test.ts',
  'rcf_core.test.ts',
  'robots.test.ts',
  'scanner.test.ts',
  'sentinel.test.ts',
  'noise.test.ts',
  'multi_lang.test.ts'
];

let failed = false;
for (const file of files) {
  console.log(`\n======================================================`);
  console.log(`Running test suite: ${file}`);
  console.log(`======================================================\n`);
  try {
    execSync(`node --experimental-vm-modules node_modules/.bin/jest tests/${file}`, { stdio: 'inherit' });
  } catch (e) {
    failed = true;
  }
}

if (failed) {
  console.error('\n❌ One or more test suites failed.');
  process.exit(1);
} else {
  console.log('\n✅ All 60 tests across 11 test suites passed successfully!');
  process.exit(0);
}
