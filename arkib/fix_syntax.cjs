const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

// Fix Block 1: The SyntaxError inside renderTruckBoards
const badBlock = `            // TWO DROPS MODE
            const drop1List = assignedList.filter(d => (d.dropSeq || 1) === 1);
            const drop2List = assignedList.filter(d => d.dropSeq === 2);
                const drop1Qty = drop1List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop2Qty = drop2List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop1QtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${drop1Qty.toLocaleString()} pcs]</b>\`;
                const drop2QtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${drop2Qty.toLocaleString()} pcs]</b>\`;
            const drop1Qty = drop1List.reduce((sum, d) => sum + getDoEffectiveQty(d), 0);
            const drop2Qty = drop2List.reduce((sum, d) => sum + getDoEffectiveQty(d), 0);`;

const goodBlock = `            // TWO DROPS MODE
            const drop1List = assignedList.filter(d => (d.dropSeq || 1) === 1);
            const drop2List = assignedList.filter(d => d.dropSeq === 2);
            const drop1Qty = drop1List.reduce((sum, d) => sum + getDoEffectiveQty(d), 0);
            const drop2Qty = drop2List.reduce((sum, d) => sum + getDoEffectiveQty(d), 0);`;

content = content.replace(badBlock, goodBlock);

// Fix Block 2: The ReferenceError in showFinalPlan
// We need to inject the qty calculations correctly here
const missingBlock = `                // Two Drops (1st Drop & 2nd Drop)
                const drop1List = assignedList.filter(d => (d.dropSeq || 1) === 1);
                const drop2List = assignedList.filter(d => d.dropSeq === 2);
                const dest1Str = meta.dest ? \`(\${meta.dest.trim().toUpperCase()})\` : '(Destination 1)';`;

const fixedMissingBlock = `                // Two Drops (1st Drop & 2nd Drop)
                const drop1List = assignedList.filter(d => (d.dropSeq || 1) === 1);
                const drop2List = assignedList.filter(d => d.dropSeq === 2);
                const drop1Qty = drop1List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop2Qty = drop2List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop1QtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${drop1Qty.toLocaleString()} pcs]</b>\`;
                const drop2QtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${drop2Qty.toLocaleString()} pcs]</b>\`;
                const dest1Str = meta.dest ? \`(\${meta.dest.trim().toUpperCase()})\` : '(Destination 1)';`;

content = content.replace(missingBlock, fixedMissingBlock);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed the syntax error and missing declarations.");
