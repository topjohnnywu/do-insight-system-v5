const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Change font to Aptos Display
content = content.replace(/font-family: monospace;/g, "font-family: 'Aptos Display', sans-serif;");

// 2. Modify formatHub
content = content.replace(
`            const formatHub = (rawHub, defaultLabel = "HUB NUMBER") => {
                if (!rawHub) return \`(\${defaultLabel})\`;
                const trimmed = rawHub.trim().toUpperCase();
                const hubName = trimmed.startsWith("HUB") ? trimmed : \`HUB\${trimmed}\`;
                return \`(\${hubName})\`;
            };`,
`            const formatHub = (rawHub, defaultLabel = "HUB NUMBER") => {
                let hubText = \`(\${defaultLabel})\`;
                if (rawHub) {
                    const trimmed = rawHub.trim().toUpperCase();
                    const hubName = trimmed.startsWith("HUB") ? trimmed : \`HUB\${trimmed}\`;
                    hubText = \`(\${hubName})\`;
                }
                return \`<b style="color: navy;"><i>\${hubText}</i></b>\`;
            };`
);

// 3. Format Status helper (Top Urgent / Direct)
// We will replace how status is rendered.
// Pure cross dock:
content = content.replace(
    /block \+= \`\(\$\{index \+ 1\}\) 1 x \$\{sizeStr\} \$\{destStr\}\(Top Urgent\)\\n\`;/g,
    "block += `(${index + 1}) 1 x ${sizeStr} ${destStr} <b style=\"color: red;\">(Top Urgent)</b>\\n`;"
);

content = content.replace(
    /block \+= \`\(\$\{index \+ 1\}\) 1 x \$\{sizeStr\} \$\{destStr\} \(\$\{status1\}\)\\n\`;/g,
    "const s1Formatted = status1 === 'Top Urgent' ? `<b style=\"color: red;\">(Top Urgent)</b>` : (status1 === 'Direct' ? `<b style=\"color: blue;\">(Direct)</b>` : `(${status1})`);\n                block += `(${index + 1}) 1 x ${sizeStr} ${destStr} ${s1Formatted}\\n`;"
);

content = content.replace(
    /const status1Suffix = \(status1 !== 'Direct' \|\| status1 !== status2\) \? \` \(\$\{status1\}\)\` : '';/g,
    "const status1Suffix = (status1 !== 'Direct' || status1 !== status2) ? (status1 === 'Top Urgent' ? ` <b style=\"color: red;\">(Top Urgent)</b>` : (status1 === 'Direct' ? ` <b style=\"color: blue;\">(Direct)</b>` : ` (${status1})`)) : '';"
);

content = content.replace(
    /const status2Suffix = \(status2 !== 'Direct' \|\| status1 !== status2\) \? \` \(\$\{status2\}\)\` : '';/g,
    "const status2Suffix = (status2 !== 'Direct' || status1 !== status2) ? (status2 === 'Top Urgent' ? ` <b style=\"color: red;\">(Top Urgent)</b>` : (status2 === 'Direct' ? ` <b style=\"color: blue;\">(Direct)</b>` : ` (${status2})`)) : '';"
);

// 4. Format DO bold black
content = content.replace(
    /return \`\$\{indent\}DO: \$\{doStrs\.join\(\', \'\)\}\`;/g,
    "return `${indent}<b style=\"color: black;\">DO: ${doStrs.join(', ')}</b>`;"
);

content = content.replace(
    /lines\.push\(\`\$\{indent\}DO: \$\{regularDos\.join\(\', \'\)\},\`\);/g,
    "lines.push(`${indent}<b style=\"color: black;\">DO: ${regularDos.join(', ')},</b>`);"
);

content = content.replace(
    /lines\.push\(\`\$\{indent\}DO:  \$\{splitInvLabel\}\`\);/g,
    "lines.push(`${indent}<b style=\"color: black;\">DO:  ${splitInvLabel}</b>`);"
);

content = content.replace(
    /lines\.push\(\`\$\{indent\}DO: \$\{regularDos\.join\(\', \'\)\}\`\);/g,
    "lines.push(`${indent}<b style=\"color: black;\">DO: ${regularDos.join(', ')}</b>`);"
);


fs.writeFileSync(file, content, 'utf8');
console.log("Patched correctly.");
