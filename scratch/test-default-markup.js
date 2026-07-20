const assert = require('assert');
const fs = require('fs');
const path = require('path');

const typesContent = fs.readFileSync(path.join(__dirname, '../lib/types.ts'), 'utf8');
const samplesContent = fs.readFileSync(path.join(__dirname, '../lib/samples.ts'), 'utf8');

try {
  assert.ok(typesContent.includes('rateMarkup: 25'), 'lib/types.ts should define rateMarkup as 25');
  console.log('types.ts verification passed.');
} catch (err) {
  console.log('types.ts verification failed:', err.message);
}

try {
  assert.ok(samplesContent.includes('rateMarkup: 25'), 'lib/samples.ts should define rateMarkup as 25');
  console.log('samples.ts verification passed.');
} catch (err) {
  console.log('samples.ts verification failed:', err.message);
}
