const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /window\.toggleTruckDropMode = async function\(tId, targetMode\) \{/;

content = content.replace(regex, `window.toggleHideDoList = function(tId) {
    if (typeof truckMeta !== 'undefined' && truckMeta[tId]) {
        truckMeta[tId].hideDoList = !truckMeta[tId].hideDoList;
        window.saveTruckPlanningState();
        window.renderTruckBoards();
    }
};

window.toggleTruckDropMode = async function(tId, targetMode) {`);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed window.toggleHideDoList definition.");
