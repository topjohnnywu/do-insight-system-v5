const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ Two Drops \(1st Drop & 2nd Drop\)\s+const drop1List = assignedList\.filter\(d => \(d\.dropSeq \|\| 1\) === 1\);\s+const drop2List = assignedList\.filter\(d => d\.dropSeq === 2\);\s+const dest1Str =/g;

const replacement = `// Two Drops (1st Drop & 2nd Drop)
                const drop1List = assignedList.filter(d => (d.dropSeq || 1) === 1);
                const drop2List = assignedList.filter(d => d.dropSeq === 2);
                const drop1Qty = drop1List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop2Qty = drop2List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop1QtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${drop1Qty.toLocaleString()} pcs]</b>\`;
                const drop2QtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${drop2Qty.toLocaleString()} pcs]</b>\`;
                const dest1Str =`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed missing dropQty declarations.");
