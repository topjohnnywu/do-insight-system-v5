const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

const replacement1 = `            const formatHub = (rawHub, defaultLabel = "HUB NUMBER") => {`;
const insertQtyCalc = `            const totalQty = assignedList.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
            const totalQtyStr = \`<b style="color: #059669; margin-left: 10px;">[Total: \${totalQty.toLocaleString()} pcs]</b>\`;
            const formatHub = (rawHub, defaultLabel = "HUB NUMBER") => {`;

content = content.replace(replacement1, insertQtyCalc);

const replaceCrossDock = `block += \`(\${index + 1}) 1 x \${sizeStr} \${destStr} <b style="color: red;">(Top Urgent)</b>\\n\`;`;
const newCrossDock = `block += \`(\${index + 1}) 1 x \${sizeStr} \${destStr} <b style="color: red;">(Top Urgent)</b> \${totalQtyStr}\\n\`;`;
content = content.replace(replaceCrossDock, newCrossDock);

const replaceSingleDrop = `block += \`(\${index + 1}) 1 x \${sizeStr} \${destStr} \${s1Formatted}\\n\`;`;
const newSingleDrop = `block += \`(\${index + 1}) 1 x \${sizeStr} \${destStr} \${s1Formatted} \${totalQtyStr}\\n\`;`;
content = content.replace(replaceSingleDrop, newSingleDrop);

const replaceTwoDrop = `block += \`(\${index + 1}) 1 x \${sizeStr} (\${headerTypeStr})\\n\`;`;
const newTwoDrop = `block += \`(\${index + 1}) 1 x \${sizeStr} (\${headerTypeStr}) \${totalQtyStr}\\n\`;`;
content = content.replace(replaceTwoDrop, newTwoDrop);

fs.writeFileSync(file, content, 'utf8');
console.log("Patched correctly.");
