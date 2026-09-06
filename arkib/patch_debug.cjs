const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const target = "skidNo: idx === 0 ? 'SKID-01' : '',";
const replacement = "skidNo: 'QTY: ' + entry.qty,";

content = content.replace(target, replacement);
fs.writeFileSync('packing-sheet/js/App.js', content);
