const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/'Aptos Display'/g, "Aptos Display");

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed quotes");
