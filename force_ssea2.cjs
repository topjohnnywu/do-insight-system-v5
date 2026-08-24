const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/lookupParser.js', 'utf8');

// The dynamic scanning block is what we want to wipe out entirely.
const startIndex = content.indexOf('let headerRowFound = false;');
const endIndex = content.indexOf('const entries = [];');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + 
            `// Forced SSEA format based on explicit user instruction:\n` +
            `          // startIdx = 4 (Row 5)\n` +
            `          // doColIdx = 3 (Col D)\n` +
            `          // code8dColIdx = 5 (Col F)\n` +
            `          // qtyColIdx = 6 (Col G)\n` +
            `          startIdx = 4;\n          ` + 
            content.substring(endIndex);
  fs.writeFileSync('packing-sheet/js/utils/lookupParser.js', content);
  console.log('Successfully patched lookupParser.js');
} else {
  console.log('Could not find target strings for patching.');
}
