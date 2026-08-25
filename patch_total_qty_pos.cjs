const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

// Remove totalQtyStr from the header lines
content = content.replace(
    `block += \`(\${index + 1}) 1 x \${sizeStr} \${destStr} <b style="color: red;">(Top Urgent)</b> \${totalQtyStr}\\n\`;`,
    `block += \`(\${index + 1}) 1 x \${sizeStr} \${destStr} <b style="color: red;">(Top Urgent)</b>\\n\`;`
);
content = content.replace(
    `block += \`(\${index + 1}) 1 x \${sizeStr} \${destStr} \${s1Formatted} \${totalQtyStr}\\n\`;`,
    `block += \`(\${index + 1}) 1 x \${sizeStr} \${destStr} \${s1Formatted}\\n\`;`
);
content = content.replace(
    `block += \`(\${index + 1}) 1 x \${sizeStr} (\${headerTypeStr}) \${totalQtyStr}\\n\`;`,
    `block += \`(\${index + 1}) 1 x \${sizeStr} (\${headerTypeStr})\\n\`;`
);

// Add totalQtyStr next to Hub for Cross Dock
content = content.replace(
    `block += \`\${formatHub(meta.hub)}\\n\`;\\n                block += \`ALL 5 ROUTES\`;`,
    `block += \`\${formatHub(meta.hub)} \${totalQtyStr}\\n\`;\n                block += \`ALL 5 ROUTES\`;`
);

// Add totalQtyStr next to Hub for Single Drop
content = content.replace(
    `block += \`\${formatHub(meta.hub)}\`;\\n                if (status1 === 'Top Urgent' && routes1.length > 0) {`,
    `block += \`\${formatHub(meta.hub)} \${totalQtyStr}\`;\n                if (status1 === 'Top Urgent' && routes1.length > 0) {`
);

// Calculate separate totals for Drop 1 and Drop 2 in Two Drops
content = content.replace(
    `const drop2List = assignedList.filter(d => d.dropSeq === 2);`,
    `const drop2List = assignedList.filter(d => d.dropSeq === 2);
                const drop1Qty = drop1List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop2Qty = drop2List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop1QtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${drop1Qty.toLocaleString()} pcs]</b>\`;
                const drop2QtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${drop2Qty.toLocaleString()} pcs]</b>\`;`
);

content = content.replace(
    `block += \`\\n   [1ST DROP] -> \${dest1Str} | \${hub1Str}\${status1Suffix}\`;`,
    `block += \`\\n   [1ST DROP] -> \${dest1Str} | \${hub1Str}\${status1Suffix} \${drop1QtyStr}\`;`
);

content = content.replace(
    `block += \`\\n   [2ND DROP] -> \${dest2Str} | \${hub2Str}\${status2Suffix}\`;`,
    `block += \`\\n   [2ND DROP] -> \${dest2Str} | \${hub2Str}\${status2Suffix} \${drop2QtyStr}\`;`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Patched hub qty position.");
