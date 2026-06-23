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
    console.log(JSON.stringify(pdg.toDict()));
  } catch (e) {
    // Avoid printing full error stack/objects to prevent Leakage of information
    console.error(e instanceof Error ? e.message : 'Normalization failed');
    process.exit(1);
  }
});
