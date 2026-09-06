const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/lookupParser.js', 'utf8');

const target = `if (cell === 'qty' || cell.includes('quantity')) qtyColIdx = c;`;
const replacement = `if (cell.includes('qty') || cell.includes('quantity')) qtyColIdx = c;`;

content = content.replace(target, replacement);
fs.writeFileSync('packing-sheet/js/utils/lookupParser.js', content);
