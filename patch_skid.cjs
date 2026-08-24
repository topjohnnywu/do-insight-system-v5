const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');
content = content.replace("skidNo: idx === 0 ? (header.containerUnit ? header.containerUnit + ' 01' : 'SKID-01') : '',", "skidNo: idx === 0 ? 'SKID-01' : '',");
fs.writeFileSync('packing-sheet/js/App.js', content);
