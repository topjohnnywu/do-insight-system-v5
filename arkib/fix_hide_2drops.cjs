const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

// The 2 drops sub tables container
content = content.replace(
    `<!-- 2 Drops Sub-tables Container -->
                <div style="padding: 0; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; padding: 10px;">`,
    `<!-- 2 Drops Sub-tables Container -->
                <div style="padding: 0; overflow-y: auto; flex: 1; display: \${meta.hideDoList ? 'none' : 'flex'}; flex-direction: column; gap: 12px; padding: 10px;">`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed 2 drops hide logic.");
