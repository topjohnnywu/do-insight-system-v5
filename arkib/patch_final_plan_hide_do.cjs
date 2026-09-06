const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /if \(doLines && doLines\.trim\(\)\) \{/g,
    `if (!meta.hideDoList && doLines && doLines.trim()) {`
);

content = content.replace(
    /if \(do1Lines && do1Lines\.trim\(\)\) \{/g,
    `if (!meta.hideDoList && do1Lines && do1Lines.trim()) {`
);

content = content.replace(
    /if \(do2Lines && do2Lines\.trim\(\)\) \{/g,
    `if (!meta.hideDoList && do2Lines && do2Lines.trim()) {`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Patched final plan to respect hideDoList.");
