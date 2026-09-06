const fs = require('fs');
let code = fs.readFileSync('js/volume_capacity_planner.js', 'utf8');

// 1. Correct stacking order
code = code.replace(
    /const order = groupObjs\.slice\(\)\.sort\(\(a, b\) => a\.position\.z - b\.position\.z\);/,
`const order = groupObjs.slice().sort((a, b) => {
            if (Math.abs(a.position.z - b.position.z) > 0.5) return a.position.z - b.position.z;
            if (Math.abs(a.position.y - b.position.y) > 0.5) return a.position.y - b.position.y;
            return a.position.x - b.position.x;
        });`
);

// 2. Save original positions for all
code = code.replace(
    /const truckL = this\._simTruckL;/,
`const truckL = this._simTruckL;
        order.forEach(g => {
            g.userData._targetPos = g.position.clone();
            g.userData._targetRot = g.rotation.clone();
        });`
);

// 3. Remove hardcoded driveIn/retreat
code = code.replace(
    /const driveIn = 1400, lower = 500, retreat = 1000, pause = 250;\n\s*const cycle = driveIn \+ lower \+ retreat \+ pause;/,
`const lower = 600, pause = 250;`
);

code = code.replace(
    /driveIn: driveIn, lower: lower, retreat: retreat, pause: pause,/,
`lower: lower, pause: pause,`
);

fs.writeFileSync('js/volume_capacity_planner.js', code);
