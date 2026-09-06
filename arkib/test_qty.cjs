const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/lookupParser.js', 'utf8');

const target = "const numQty = qty !== '' && qty !== undefined && !isNaN(Number(qty)) ? Number(qty) : '';";
const replacement = "const numQty = qty !== undefined ? qty : '';"; // Just pass the raw value!

content = content.replace(target, replacement);
fs.writeFileSync('packing-sheet/js/utils/lookupParser.js', content);
