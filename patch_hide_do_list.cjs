const fs = require('fs');
const file = 'js/manual_truck_planning.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add hideDoList to the default truck meta
content = content.replace(
    /size: "40HC", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "", routes: \[\], routes2: \[\] \};/,
    `size: "40HC", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "", routes: [], routes2: [], hideDoList: false };`
);

// 2. Add the hideDoList toggle button next to DropMode toggle
const dropModeToggleInject = `\${dropModeToggle}
                        <span class="badge" style="background: var(--surface); color: var(--fg-subtle); font-size: 0.75rem; border: 1px solid var(--border);">\${assignedList.length} DOs</span>`;

const hideDoListButtonHtml = `\${dropModeToggle}
                        <button type="button" onclick="window.toggleHideDoList('\${tId}')" class="action-btn" title="\${meta.hideDoList ? 'Show DO List' : 'Hide DO List'}" style="padding: 3px 6px; font-size: 0.74rem; border-radius: 4px; background: \${meta.hideDoList ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface)'}; color: \${meta.hideDoList ? '#f87171' : 'var(--fg-muted)'}; border: 1px solid \${meta.hideDoList ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                            \${meta.hideDoList 
                                ? \`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>\` 
                                : \`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>\`}
                        </button>
                        <span class="badge" style="background: var(--surface); color: var(--fg-subtle); font-size: 0.75rem; border: 1px solid var(--border);">\${assignedList.length} DOs</span>`;

content = content.replace(dropModeToggleInject, hideDoListButtonHtml);

// 3. Define window.toggleHideDoList globally
content = content.replace(
    /window.toggleTruckDropMode = function\(tId, mode\) \{/,
    `window.toggleHideDoList = function(tId) {
    if (typeof truckMeta !== 'undefined' && truckMeta[tId]) {
        truckMeta[tId].hideDoList = !truckMeta[tId].hideDoList;
        window.saveTruckPlanningState();
        window.renderTruckBoards();
    }
};

window.toggleTruckDropMode = function(tId, mode) {`
);

// 4. Hide single drop assigned table
content = content.replace(
    `<!-- Assigned Table -->
                <div style="padding: 0; overflow-y: auto; flex: 1; border-radius: 0 0 var(--radius-card) var(--radius-card);">`,
    `<!-- Assigned Table -->
                <div style="padding: 0; overflow-y: auto; flex: 1; border-radius: 0 0 var(--radius-card) var(--radius-card); display: \${meta.hideDoList ? 'none' : 'block'};">`
);

// 5. Hide two drops assigned table
content = content.replace(
    `<!-- 1st Drop Assigned Table -->
                    <div style="padding: 0; overflow-y: auto; flex: 1; min-height: 80px;">`,
    `<!-- 1st Drop Assigned Table -->
                    <div style="padding: 0; overflow-y: auto; flex: 1; min-height: 80px; display: \${meta.hideDoList ? 'none' : 'block'};">`
);
content = content.replace(
    `<!-- 2nd Drop Assigned Table -->
                    <div style="padding: 0; overflow-y: auto; flex: 1; min-height: 80px; border-radius: 0 0 var(--radius-card) var(--radius-card);">`,
    `<!-- 2nd Drop Assigned Table -->
                    <div style="padding: 0; overflow-y: auto; flex: 1; min-height: 80px; border-radius: 0 0 var(--radius-card) var(--radius-card); display: \${meta.hideDoList ? 'none' : 'block'};">`
);

// 6. Support for the Final Plan DO line skipping
// In formatDoListForManifest, if we want to skip it... wait! 
// formatDoListForManifest doesn't have access to `meta` easily from inside.
// But we call it like this: `const doLines = formatDoListForManifest(assignedList, "");`
// So we can wrap the final plan block append with `if (!meta.hideDoList)`

fs.writeFileSync(file, content, 'utf8');
console.log("Patched hideDoList logic parts 1-5.");
