const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /block \+= \`   \[1ST DROP\] -> \$\{dest1Str\} \| \$\{hub1Str\}\$\{status1Suffix\}\`;/g,
    `block += \`   [1ST DROP] -> \${dest1Str} | \${hub1Str}\${status1Suffix} \${drop1QtyStr}\`;`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Patched hub qty position manual 2.");
