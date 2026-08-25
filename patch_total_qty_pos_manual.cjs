const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

// The cross dock replace failed. Let's find exactly what's there:
// block += `${formatHub(meta.hub)}\n`;
// block += `ALL 5 ROUTES`;
content = content.replace(
    /block \+= \`\$\{formatHub\(meta\.hub\)\}\\n\`;\s*block \+= \`ALL 5 ROUTES\`;/g,
    `block += \`\${formatHub(meta.hub)} \${totalQtyStr}\\n\`;\n                block += \`ALL 5 ROUTES\`;`
);

// For single drop, let's find:
// block += `${formatHub(meta.hub)}`;
// if (status1 === 'Top Urgent' && routes1.length > 0) {
content = content.replace(
    /block \+= \`\$\{formatHub\(meta\.hub\)\}\`;\s*if \(status1 === 'Top Urgent'/g,
    `block += \`\${formatHub(meta.hub)} \${totalQtyStr}\`;\n                if (status1 === 'Top Urgent'`
);

// For Two Drops, let's check what happened to drop1:
// It looks like drop1 was not replaced!
// block += `   [1ST DROP] -> ${dest1Str} | ${hub1Str}${status1Suffix}`;
content = content.replace(
    /block \+= \`\\n   \[1ST DROP\] -> \$\{dest1Str\} \| \$\{hub1Str\}\$\{status1Suffix\}\`;/g,
    `block += \`\\n   [1ST DROP] -> \${dest1Str} | \${hub1Str}\${status1Suffix} \${drop1QtyStr}\`;`
);

// What about drop2List? Wait, my earlier script did:
/*
const drop2List = assignedList.filter(d => d.dropSeq === 2);
                const drop1Qty = drop1List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop2Qty = drop2List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop1QtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${drop1Qty.toLocaleString()} pcs]</b>\`;
                const drop2QtyStr = \`<b style="color: black; margin-left: 10px;">[Total: \${drop2Qty.toLocaleString()} pcs]</b>\`;
*/
// It did inject those successfully, wait, the `drop2QtyStr` replacement worked for 2ND DROP!
// But 1ST DROP failed because of `\\n   ` in the template string maybe? 
// Let's use simpler regex

fs.writeFileSync(file, content, 'utf8');
console.log("Patched hub qty position manual.");
