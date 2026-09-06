const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    `const totalQtyStr = \`<b style="color: #059669; margin-left: 10px;">[Total: \${totalQty.toLocaleString()} pcs]</b>\`;`,
    `const totalQtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${totalQty.toLocaleString()} pcs]</b>\`;`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Patched to black.");
