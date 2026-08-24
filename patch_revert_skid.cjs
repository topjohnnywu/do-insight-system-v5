const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const target = "skidNo: 'QTY: ' + entry.qty,";
const replacement = "skidNo: idx === 0 ? 'SKID-01' : '',";

content = content.replace(target, replacement);
fs.writeFileSync('packing-sheet/js/App.js', content);
