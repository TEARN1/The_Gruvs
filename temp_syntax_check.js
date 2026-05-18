const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const src = fs.readFileSync(path.join(__dirname, 'src', 'screens', 'EventDetailScreen.js'), 'utf8');
try {
  parser.parse(src, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'classProperties', 'nullishCoalescingOperator', 'optionalChaining']
  });
  console.log('PARSED OK');
} catch (err) {
  console.log('ERROR', err.message);
  console.log('LOC', err.loc);
}
