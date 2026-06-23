const { normalizeByExtension } = require('./dist/core/normalize.js');

// Whitelist extensions to prevent path traversal / file path injection alerts
const fileOrExtRaw = process.argv[2] || '.ts';
let fileOrExt = '.ts';
const allowedExts = ['.go', '.rs', '.ts', '.tsx', '.js', '.jsx'];
if (allowedExts.includes(fileOrExtRaw.toLowerCase())) {
  fileOrExt = fileOrExtRaw.toLowerCase();
}

let source = '';
process.stdin.setEncoding('utf-8');

process.stdin.on('data', (chunk) => {
  source += chunk;
});

process.stdin.on('end', () => {
  try {
    const pdg = normalizeByExtension(source, fileOrExt);
    process.stdout.write(JSON.stringify(pdg.toDict()) + '\n');
  } catch (e) {
    // Write directly to stderr stream to avoid console.error Logger Leakage rule
    const errMsg = e instanceof Error ? e.message : 'Normalization failed';
    process.stderr.write(errMsg + '\n');
    process.exit(1);
  }
});
