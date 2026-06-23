const { normalizeByExtension } = require('./dist/core/normalize.js');
const fs = require('fs');

// argv[2] = extension (e.g. ".go"), source is always read from stdin
// This prevents source code from appearing in OS process argument lists.
const fileOrExt = process.argv[2] || '.ts';
const source = fs.readFileSync(0, 'utf-8');

try {
  const pdg = normalizeByExtension(source, fileOrExt);
  console.log(JSON.stringify(pdg.toDict()));
} catch (e) {
  console.error(e);
  process.exit(1);
}
