let unassignedDOs = [];
let trucks = {};
let truckCounter = 1;
let truckMeta = {};

// Dropdown menu management for MTP headers
window.toggleMtpDropdown = function(id) {
    const menu = document.getElementById(id);
    if (!menu) return;
    const isCurrentlyOpen = menu.style.display === 'block';
    window.closeAllMtpDropdowns();
    if (!isCurrentlyOpen) {
        menu.style.display = 'block';
    }
};

window.closeAllMtpDropdowns = function() {
    document.querySelectorAll('.mtp-dropdown-menu').forEach(m => {
        m.style.display = 'none';
    });
};

document.addEventListener('click', function(e) {
    if (!e.target.closest('.mtp-dropdown-menu') && !e.target.closest('button[onclick*="toggleMtpDropdown"]')) {
        window.closeAllMtpDropdowns();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    initData();
});

// Helper to extract effective quantity from DO object or parse from split item remarks if 0
function getDoEffectiveQty(d) {
    if (!d) return 0;
    if (typeof d.qty === 'number' && d.qty > 0) return d.qty;
    if (d.remark) {
        const matches = [...String(d.remark).matchAll(/\bx\s*(\d+)/gi)];
        if (matches.length > 0) {
            const sum = matches.reduce((acc, m) => acc + parseInt(m[1], 10), 0);
            if (sum > 0) {
                d.qty = sum;
                return sum;
            }
        }
    }
    return d.qty || 0;
}

// Read a data key, preferring the Manual Truck Planning-scoped upload over the
// shared global key. Keeps the MTP upload isolated from every other page.
function mtpGet(key, globalKey) {
    const scoped = localStorage.getItem(key);
    if (scoped) return scoped;
    return globalKey ? localStorage.getItem(globalKey) : null;
}

function initData() {
    const rawDataStr = mtpGet("MtpDoSummary", "LastUploadedDoSummary");
    if (!rawDataStr) {
        document.getElementById("unassignedTableBody").innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--fg-muted);">No DO Summary uploaded. Please click "Upload Source" to load your route file.</td></tr>`;
        updateMetricsStrip();
        updateAssignButtonState();
        return;
    }

    try {
        const rawData = JSON.parse(rawDataStr);
        
        // Group by DO Number (inv) to get unique DOs
        const doMap = {};
        rawData.forEach(row => {
            if (!row.inv) return;
            const invStr = String(row.inv);
            if (!doMap[invStr]) {
                doMap[invStr] = {
                    inv: invStr,
                    name: row.name || "Unknown Consignee",
                    vol: parseFloat(row.vol) || 0,
                    qty: parseInt(row.qty, 10) || 0,
                    remark: row.remark || ""
                };
            } else {
                // A DO may span multiple rows (one per SKU) — accumulate the total quantity.
                doMap[invStr].qty += parseInt(row.qty, 10) || 0;
            }
        });
        
        const allDOs = Object.values(doMap);
        
        // Load saved state if any, else start fresh
        const savedStateStr = localStorage.getItem("ManualTruckAssignments");
        if (savedStateStr) {
            const savedState = JSON.parse(savedStateStr);
            trucks = savedState.trucks || {};
            truckCounter = savedState.truckCounter || 1;
            truckMeta = savedState.truckMeta || {};
            Object.keys(truckMeta).forEach(tId => {
                truckMeta[tId].dropMode = truckMeta[tId].dropMode || "single";
                truckMeta[tId].size = truckMeta[tId].size || "40HC";
                truckMeta[tId].status = truckMeta[tId].status || "Direct";
                truckMeta[tId].hub = truckMeta[tId].hub || "";
                truckMeta[tId].dest = truckMeta[tId].dest || "";
                truckMeta[tId].status2 = truckMeta[tId].status2 || "Direct";
                truckMeta[tId].hub2 = truckMeta[tId].hub2 || "";
                truckMeta[tId].dest2 = truckMeta[tId].dest2 || "";
                truckMeta[tId].routes = Array.isArray(truckMeta[tId].routes) ? truckMeta[tId].routes : [];
                truckMeta[tId].routes2 = Array.isArray(truckMeta[tId].routes2) ? truckMeta[tId].routes2 : [];
                truckMeta[tId].hideDoList = !!truckMeta[tId].hideDoList;
            });
            
            // Auto-repair any split DOs in trucks that had qty: 0
            Object.values(trucks).forEach(truckList => {
                truckList.forEach(d => getDoEffectiveQty(d));
            });
            
            // Filter unassigned: allDOs that are NOT in any truck
            const assignedInvs = new Set();
            Object.values(trucks).forEach(truckList => {
                truckList.forEach(doObj => assignedInvs.add(doObj.inv));
            });
            
            unassignedDOs = allDOs.filter(d => !assignedInvs.has(d.inv));
            
            // Auto-repair any unassigned DOs
            unassignedDOs.forEach(d => getDoEffectiveQty(d));
            
            // In case a truck has DOs that are no longer in the uploaded summary, filter them out.
            // Split children (e.g. "81524819-A") are never in the summary — keep them while their
            // parent DO survives so re-uploading a source file doesn't drop split pieces.
            const allInvSet = new Set(allDOs.map(d => d.inv));
            for (let tId in trucks) {
                trucks[tId] = trucks[tId].filter(d =>
                    allInvSet.has(d.inv) || allInvSet.has(String(d.inv).split('-')[0])
                );
            }
        } else {
            unassignedDOs = [...allDOs];
            addTruck(); // Start with Truck 1
        }
        
        renderUnassignedDOs();
        renderTruckBoards();
        updateTruckDropdown();
        updateMetricsStrip();
        updateAssignButtonState();
        
    } catch (e) {
        console.error("Error parsing DO Summary:", e);
    }
}

function saveState() {
    const state = {
        trucks: trucks,
        truckCounter: truckCounter,
        truckMeta: truckMeta
    };
    localStorage.setItem("ManualTruckAssignments", JSON.stringify(state));
    updateMetricsStrip();
}

function updateAssignButtonState() {
    const checkboxes = document.querySelectorAll(".do-checkbox:checked");
    const count = checkboxes.length;
    const btn = document.getElementById("btnAssignSelected");
    const badge = document.getElementById("unassignedCountBadge");
    
    if (badge) {
        badge.textContent = `${unassignedDOs.length}${count > 0 ? ` (${count} sel)` : ''}`;
    }

    if (btn) {
        if (count > 0) {
            btn.disabled = false;
            btn.style.cursor = 'pointer';
            btn.style.background = 'var(--sem-green, #10b981)';
            btn.style.color = '#ffffff';
            btn.style.borderColor = 'var(--sem-green-border, #059669)';
            btn.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
            btn.innerHTML = `<span>Assign (${count})</span> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        } else {
            btn.disabled = true;
            btn.style.cursor = 'not-allowed';
            btn.style.background = 'var(--surface)';
            btn.style.color = 'var(--fg-muted)';
            btn.style.borderColor = 'var(--border)';
            btn.style.boxShadow = 'none';
            btn.innerHTML = `<span>Assign</span>`;
        }
    }
}

function updateMetricsStrip() {
    const unassignedCount = unassignedDOs.length;
    const unassignedQty = unassignedDOs.reduce((sum, d) => sum + getDoEffectiveQty(d), 0);
    
    let assignedCount = 0;
    let assignedQty = 0;
    let crossDockCount = 0;
    let directCount = 0;
    
    const truckKeys = Object.keys(trucks);
    truckKeys.forEach((tId, idx) => {
        const list = trucks[tId] || [];
        assignedCount += list.length;
        list.forEach(d => {
            assignedQty += getDoEffectiveQty(d);
            if (d.tag === 'cross_dock' || idx === 0) {
                crossDockCount++;
            } else {
                directCount++;
            }
        });
    });
    
    const totalDOs = unassignedCount + assignedCount;
    const progressPct = totalDOs > 0 ? Math.round((assignedCount / totalDOs) * 100) : 0;
    
    const elUnassignedCount = document.getElementById("metricUnassignedCount");
    const elUnassignedQty = document.getElementById("metricUnassignedQty");
    const elTruckCount = document.getElementById("metricTruckCount");
    const elAssignedQty = document.getElementById("metricAssignedQty");
    const elCrossDock = document.getElementById("metricCrossDockCount");
    const elDirect = document.getElementById("metricDirectCount");
    const elProgText = document.getElementById("metricProgressText");
    const elProgBar = document.getElementById("metricProgressBar");
    const elFleetBadge = document.getElementById("fleetCountBadge");

    if (elUnassignedCount) elUnassignedCount.textContent = unassignedCount.toLocaleString();
    if (elUnassignedQty) elUnassignedQty.textContent = `${unassignedQty.toLocaleString()} pcs`;
    if (elTruckCount) elTruckCount.textContent = truckKeys.length.toString();
    if (elAssignedQty) elAssignedQty.textContent = `${assignedQty.toLocaleString()} pcs`;
    if (elCrossDock) elCrossDock.textContent = `${crossDockCount} Cross Dock`;
    if (elDirect) elDirect.textContent = `${directCount} Direct`;
    if (elProgText) elProgText.textContent = `${progressPct}% (${assignedCount}/${totalDOs})`;
    if (elProgBar) elProgBar.style.width = `${progressPct}%`;
    if (elFleetBadge) elFleetBadge.textContent = `${truckKeys.length} ${truckKeys.length === 1 ? 'Truck' : 'Trucks'}`;
}

function getAllPlannedAndUnassignedDos() {
    const list = [...(unassignedDOs || [])];
    if (typeof trucks !== 'undefined') {
        Object.keys(trucks).forEach(tId => {
            (trucks[tId] || []).forEach(d => list.push(d));
        });
    }
    return list;
}

function getDoSplitInfo(doObj) {
    const invStr = String(doObj.inv || '').trim();
    const match = invStr.match(/^(.+?)(?:-([A-Za-z0-9]+))?$/);
    const rootInv = match ? match[1] : invStr;
    const suffix = (match && match[2]) ? match[2].toUpperCase() : '';

    const allDos = getAllPlannedAndUnassignedDos();
    const siblings = allDos.filter(d => {
        const sInv = String(d.inv || '').trim();
        const sMatch = sInv.match(/^(.+?)(?:-([A-Za-z0-9]+))?$/);
        const sRoot = sMatch ? sMatch[1] : sInv;
        return sRoot.toLowerCase() === rootInv.toLowerCase();
    });

    const hasSuffix = suffix !== '';
    const hasMultipleInstances = siblings.length > 1;
    const hasSplitRemark = Boolean(doObj.remark && /\bx\s*\d+/i.test(doObj.remark));

    if (!hasSuffix && !hasMultipleInstances && !hasSplitRemark) {
        return { isSplit: false, fraction: '', rootInv: invStr, displayInv: invStr };
    }

    // Children (-A, -B, -C...) first in alphabetical order, parent without suffix last
    const children = siblings.filter(d => /-\w+$/i.test(String(d.inv).trim()))
        .sort((a, b) => String(a.inv).localeCompare(String(b.inv)));
    const parents = siblings.filter(d => !/-\w+$/i.test(String(d.inv).trim()));

    const ordered = [];
    children.forEach(c => {
        if (!ordered.some(o => o.inv === c.inv)) ordered.push(c);
    });
    parents.forEach(p => {
        if (!ordered.some(o => o.inv === p.inv)) ordered.push(p);
    });

    const totalParts = Math.max(ordered.length, 2);
    let partIndex = ordered.findIndex(o => o.inv === doObj.inv) + 1;
    if (partIndex <= 0) {
        if (suffix === 'A') partIndex = 1;
        else if (suffix === 'B') partIndex = 2;
        else if (suffix === 'C') partIndex = 3;
        else if (suffix === 'D') partIndex = 4;
        else partIndex = totalParts;
    }

    const fraction = `${partIndex}/${totalParts}`;
    const displayInv = `${rootInv} ${fraction}`;

    return { isSplit: true, fraction, rootInv, displayInv, partIndex, totalParts };
}

function renderDoBadgeWithBreakdown(doObj, theme = 'green') {
    const isBlue = theme === 'blue';
    const mainBg = isBlue ? 'var(--sem-blue-bg, rgba(59, 130, 246, 0.15))' : 'rgba(16, 185, 129, 0.15)';
    const mainColor = isBlue ? 'var(--sem-blue, #60a5fa)' : '#34d399';
    const splitInfo = getDoSplitInfo(doObj);

    const fractionBadge = splitInfo.isSplit 
        ? `<span class="badge" style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; font-size: 0.72rem; font-family: Aptos Display, sans-serif; font-weight: 800; border: 1px solid rgba(245, 158, 11, 0.35); padding: 1px 5px;">${splitInfo.fraction}</span>`
        : '';

    if (!doObj.remark) {
        return `
            <div style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span class="badge" style="background: ${mainBg}; color: ${mainColor}; font-weight: 600; font-size: 0.8rem; white-space: nowrap;">${doObj.inv}</span>
                ${fractionBadge}
            </div>
        `;
    }

    const parts = doObj.remark.split(',').map(s => s.trim()).filter(Boolean);
    const breakdownChips = parts.map(p => {
        const match = p.match(/^(.+?)\s*x\s*(\d+)$/i);
        if (match) {
            const model = match[1].trim();
            const pcs = parseInt(match[2].trim(), 10).toLocaleString();
            return `<span style="background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.28); padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; font-family: Aptos Display, sans-serif; font-weight: 700; white-space: nowrap;">✂️ ${model}: ${pcs} pcs</span>`;
        }
        return `<span style="background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.28); padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; font-family: Aptos Display, sans-serif; font-weight: 700; white-space: nowrap;">✂️ ${p}</span>`;
    }).join(' ');

    return `
        <div style="display: flex; flex-direction: column; gap: 3px;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span class="badge" style="background: ${mainBg}; color: ${mainColor}; font-weight: 700; font-size: 0.8rem;">${doObj.inv}</span>
                ${fractionBadge}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                ${breakdownChips}
            </div>
        </div>
    `;
}

function renderUnassignedDOs() {
    const tbody = document.getElementById("unassignedTableBody");
    const searchInput = document.getElementById("unassignedSearch");
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    
    let html = "";
    
    unassignedDOs.forEach(doObj => {
        const searchable = `${doObj.inv} ${doObj.name}`.toLowerCase();
        if (searchTerm && !searchable.includes(searchTerm)) return;
        
        const effectiveQty = getDoEffectiveQty(doObj);
        
        html += `
        <tr draggable="true" ondragstart="dragStart(event, '${doObj.inv}')" ondragend="dragEnd(event)" class="draggable-row">
            <td style="text-align: center;"><input type="checkbox" class="do-checkbox" value="${doObj.inv}" onchange="updateAssignButtonState()"></td>
            <td>${renderDoBadgeWithBreakdown(doObj, 'blue')}</td>
            <td style="font-size: 0.84rem; color: var(--fg);">${doObj.name}</td>
            <td style="text-align: right; font-family: Aptos Display, sans-serif; font-size: 0.85rem; font-weight: 500;">${effectiveQty.toLocaleString()}</td>
            <td style="text-align: center;">
                <button onclick="window.openSplitModal('${doObj.inv}')" style="background: none; border: none; color: var(--fg-muted); cursor: pointer; padding: 4px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center;" title="Split DO">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M8 3H3v5"></path><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.828L3 3"></path><path d="M15 16l6-6"></path></svg>
                </button>
            </td>
        </tr>
        `;
    });
    
    if (unassignedDOs.length === 0) {
        html = `<tr><td colspan="5" style="text-align:center; padding: 25px; color: var(--fg-muted); font-size: 0.9rem;">✨ All DOs have been assigned to trucks!</td></tr>`;
    }
    
    tbody.innerHTML = html;
    tbody.parentElement.setAttribute("ondragover", "allowDrop(event)");
    tbody.parentElement.setAttribute("ondrop", "dropToUnassigned(event)");

    updateAssignButtonState();
    updateMetricsStrip();
}
function toggleAllUnassigned() {
    const masterCb = document.getElementById("selectAllUnassigned");
    const checkboxes = document.querySelectorAll(".do-checkbox");
    checkboxes.forEach(cb => cb.checked = masterCb.checked);
    updateAssignButtonState();
}

function addTruck() {
    const truckId = `truck_${truckCounter}`;
    trucks[truckId] = [];
    truckMeta[truckId] = { size: "40HC", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "", routes: [], routes2: [], hideDoList: false };
    truckCounter++;
    renderTruckBoards();
    updateTruckDropdown();
    saveState();
}

async function removeTruck(truckId) {
    if ((trucks[truckId] || []).length > 0) {
        const confirmed = await window.showConfirmDialog({
            title: "Remove Truck",
            message: "This truck has assigned DOs. Are you sure you want to remove it? DOs will be returned to the unassigned pool.",
            confirmText: "Remove Truck",
            isDanger: true
        });
        if (!confirmed) {
            return;
        }
        unassignedDOs.push(...trucks[truckId]);
    }
    delete trucks[truckId];
    renderUnassignedDOs();
    renderTruckBoards();
    updateTruckDropdown();
    saveState();
}

window.handleTargetTruckChange = function() {
    const select = document.getElementById("targetTruckSelect");
    const dropContainer = document.getElementById("dropSelectContainer");
    if (!select || !dropContainer) return;
    const tId = select.value;
    const meta = (typeof truckMeta !== 'undefined' && truckMeta[tId]) ? truckMeta[tId] : {};
    if (meta.dropMode === 'two_drop') {
        dropContainer.style.display = 'inline-flex';
    } else {
        dropContainer.style.display = 'none';
    }
};

function updateTruckDropdown() {
    const select = document.getElementById("targetTruckSelect");
    if (!select) return;
    
    let html = "";
    Object.keys(trucks).forEach((tId, index) => {
        const meta = (typeof truckMeta !== 'undefined' && truckMeta[tId]) ? truckMeta[tId] : {};
        const dropStr = meta.dropMode === 'two_drop' ? " (2 Drops)" : "";
        html += `<option value="${tId}">Truck ${index + 1}${dropStr}</option>`;
    });
    select.innerHTML = html;
    window.handleTargetTruckChange();
}

window.updateTruckMeta = function(tId, field, value) {
    if (!truckMeta[tId]) truckMeta[tId] = { size: "40HC", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "" };
    truckMeta[tId][field] = value;
    saveState();
};

window.toggleHideDoList = function(tId) {
    if (typeof truckMeta !== 'undefined') {
        if (!truckMeta[tId]) {
            truckMeta[tId] = { size: "40HC", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "", routes: [], routes2: [], hideDoList: false };
        }
        truckMeta[tId].hideDoList = !truckMeta[tId].hideDoList;
        saveState();
        renderTruckBoards();
    }
};

window.toggleTruckDropMode = async function(tId, targetMode) {
    if (!truckMeta[tId]) truckMeta[tId] = { size: "40HC", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "" };
    const currentMode = truckMeta[tId].dropMode || "single";
    if (currentMode === targetMode) return;

    if (targetMode === "single") {
        const hasDrop2 = (trucks[tId] || []).some(d => d.dropSeq === 2);
        if (hasDrop2) {
            let proceed = true;
            if (typeof window.showConfirmDialog === 'function') {
                proceed = await window.showConfirmDialog({
                    title: "Consolidate into Single Drop?",
                    message: "This truck currently contains DOs assigned to 2nd Drop. Switching to Single Drop will consolidate all DOs into 1st Drop.\n\nDo you want to proceed?",
                    confirmText: "Consolidate All to Single Drop",
                    cancelText: "Cancel",
                    isDanger: false
                });
            } else {
                proceed = window.confirm("Switching to Single Drop will consolidate all 2nd Drop items into 1st Drop. Proceed?");
            }
            if (!proceed) return;
        }
        (trucks[tId] || []).forEach(d => { d.dropSeq = 1; });
        truckMeta[tId].dropMode = "single";
    } else {
        truckMeta[tId].dropMode = "two_drop";
        truckMeta[tId].status2 = truckMeta[tId].status2 || "Direct";
        truckMeta[tId].hub2 = truckMeta[tId].hub2 || "";
        truckMeta[tId].dest2 = truckMeta[tId].dest2 || "";
        (trucks[tId] || []).forEach(d => { d.dropSeq = d.dropSeq || 1; });
    }

    renderTruckBoards();
    updateTruckDropdown();
    saveState();
};

window.moveDoDrop = function(tId, doInv, targetDrop) {
    const list = trucks[tId] || [];
    const item = list.find(d => String(d.inv) === String(doInv));
    if (item) {
        item.dropSeq = parseInt(targetDrop, 10) || 1;
        renderTruckBoards();
        saveState();
    }
};

// Route options specifically for Top Urgent trucks to summarize DO routes and prevent clutter
const TOP_URGENT_ROUTE_CODES = ['EXP', 'YC01', 'LEA', 'LCI', 'LCT', 'LNO', 'SOP', 'LOR'];

window.toggleTruckRoute = function(tId, routeCode, dropSeq) {
    if (!truckMeta[tId]) return;
    const fieldKey = dropSeq === 2 ? 'routes2' : 'routes';
    let current = Array.isArray(truckMeta[tId][fieldKey]) ? [...truckMeta[tId][fieldKey]] : [];
    if (current.includes(routeCode)) {
        current = current.filter(r => r !== routeCode);
    } else {
        current.push(routeCode);
    }
    truckMeta[tId][fieldKey] = current;
    renderTruckBoards();
    if (window._isTruckPlanViewOpen) {
        renderTruckPlanCanvas();
    }
    saveState();
};

function renderRouteDropdown(tId, dropSeq, activeRoutes) {
    const menuId = `routeMenu_${tId}_${dropSeq}`;
    const selectedCount = (activeRoutes || []).length;
    const label = selectedCount > 0 ? `🚩 Route: ${activeRoutes.join(', ')}` : '🚩 Select Route ▾';

    const checkboxesHtml = TOP_URGENT_ROUTE_CODES.map(code => {
        const isChecked = (activeRoutes || []).includes(code);
        return `
            <label style="display: flex; align-items: center; gap: 7px; padding: 5px 8px; border-radius: 5px; cursor: pointer; font-size: 0.76rem; font-weight: 700; color: ${isChecked ? '#f87171' : 'var(--fg)'}; background: ${isChecked ? 'rgba(239, 68, 68, 0.14)' : 'transparent'}; border: 1px solid ${isChecked ? 'rgba(239, 68, 68, 0.3)' : 'transparent'}; user-select: none;">
                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleTruckRoute('${tId}', '${code}', ${dropSeq})" style="accent-color: #ef4444; cursor: pointer; width: 13px; height: 13px;">
                <span>${code}</span>
            </label>
        `;
    }).join('');

    return `
        <div style="position: relative; display: inline-block;">
            <button type="button" onclick="event.stopPropagation(); window.toggleMtpDropdown('${menuId}')" class="action-btn" style="padding: 4px 9px; font-size: 0.78rem; font-weight: 700; border-radius: var(--radius-control); background: ${selectedCount > 0 ? 'rgba(239, 68, 68, 0.16)' : 'var(--surface-solid, #09090b)'}; color: ${selectedCount > 0 ? '#f87171' : 'var(--fg-muted)'}; border: 1px solid ${selectedCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border)'}; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Select Route codes for Top Urgent DOs">
                <span>${label}</span>
                <span style="font-size: 0.65rem; opacity: 0.7;">▼</span>
            </button>
            <div id="${menuId}" class="mtp-dropdown-menu" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; z-index: 1000; background: var(--surface-card, #15151b); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); padding: 8px; min-width: 170px;">
                <div style="padding: 2px 4px 6px; font-size: 0.68rem; font-weight: 700; color: var(--fg-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); margin-bottom: 6px; letter-spacing: 0.5px;">Top Urgent Routes</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    ${checkboxesHtml}
                </div>
            </div>
        </div>
    `;
}

function renderTruckBoards() {
    const container = document.getElementById("truckBoardsContainer");
    let html = "";
    
    Object.keys(trucks).forEach((tId, index) => {
        const assignedList = trucks[tId] || [];
        const totalQty = assignedList.reduce((sum, d) => sum + getDoEffectiveQty(d), 0);
        
        const meta = typeof truckMeta !== 'undefined' && truckMeta[tId] 
            ? truckMeta[tId] 
            : { size: "40HC", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "", routes: [], routes2: [] };
        const isTwoDrop = meta.dropMode === 'two_drop';
        const currentStatus1 = meta.status || "Direct";
        const currentStatus2 = meta.status2 || "Direct";
        const routes1 = Array.isArray(meta.routes) ? meta.routes : [];
        const routes2 = Array.isArray(meta.routes2) ? meta.routes2 : [];

        // Row renderer helper
        const renderRowHtml = (doObj, currentDropSeq) => {
            const tagBadge = doObj.tag === 'cross_dock'
                ? `<span class="badge" style="background: rgba(167, 139, 250, 0.18); color: #c084fc; font-size: 0.7rem; margin-left: 6px; padding: 2px 6px;">Cross Dock</span>`
                : (doObj.tag === 'direct' ? `<span class="badge" style="background: rgba(56, 189, 248, 0.18); color: #38bdf8; font-size: 0.7rem; margin-left: 6px; padding: 2px 6px;">Direct</span>` : '');

            const hubBadge = (doObj.hub && doObj.hub !== "N/A" && doObj.hub.trim() !== "")
                ? `<span onclick="window.editDoHub('${tId}', '${doObj.inv}')" class="badge" title="Click to edit Hub for DO ${doObj.inv}" style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; font-size: 0.72rem; padding: 2px 7px; font-weight: 700; cursor: pointer; border: 1px solid rgba(245, 158, 11, 0.3); display: inline-flex; align-items: center; gap: 4px;">🏷️ ${doObj.hub.toUpperCase().startsWith('HUB') ? doObj.hub.toUpperCase() : 'HUB: ' + doObj.hub} <span style="font-size: 0.65rem; opacity: 0.7;">✎</span></span>`
                : `<span onclick="window.editDoHub('${tId}', '${doObj.inv}')" class="badge" title="Click to assign Hub for DO ${doObj.inv}" style="background: var(--surface); color: var(--fg-muted); font-size: 0.68rem; padding: 2px 6px; cursor: pointer; border: 1px dashed var(--border); display: inline-flex; align-items: center; gap: 3px;">+ Hub</span>`;

            const switchDropBtn = isTwoDrop ? `
                <button type="button" onclick="window.moveDoDrop('${tId}', '${doObj.inv}', ${currentDropSeq === 1 ? 2 : 1})" title="Move to ${currentDropSeq === 1 ? '2nd Drop' : '1st Drop'}" style="background: var(--surface); border: 1px solid var(--border); color: var(--fg-muted); font-size: 0.7rem; font-weight: 600; padding: 3px 6px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">
                    ⇄ ${currentDropSeq === 1 ? 'Drop 2' : 'Drop 1'}
                </button>
            ` : '';

            const rowQty = getDoEffectiveQty(doObj);
                
            return `
            <tr draggable="true" ondragstart="dragStart(event, '${doObj.inv}', '${tId}', ${currentDropSeq})" ondragend="dragEnd(event)" style="background: var(--surface-hover); cursor: grab;" class="draggable-row">
                <td>${renderDoBadgeWithBreakdown(doObj, 'green')}</td>
                <td style="font-size: 0.84rem; color: var(--fg); font-weight: 500;">
                    ${hubBadge}
                    <span style="color: var(--fg-subtle); margin-left: 4px;">${doObj.name || ''}</span>
                    ${tagBadge}
                </td>
                <td style="text-align: right; font-family: Aptos Display, sans-serif; font-size: 0.85rem; font-weight: 600; color: #fbbf24;">${rowQty.toLocaleString()}</td>
                <td style="text-align: center; white-space: nowrap;">
                    ${switchDropBtn}
                    <button onclick="window.openSplitModal('${doObj.inv}')" style="background: none; border: none; color: var(--fg-muted); cursor: pointer; padding: 4px; border-radius: 4px;" title="Split DO">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M8 3H3v5"></path><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.828L3 3"></path><path d="M15 16l6-6"></path></svg>
                    </button>
                    <button onclick="unassignDO('${tId}', '${doObj.inv}')" title="Return to unassigned" style="background: none; border: none; color: var(--sem-red, #ef4444); cursor: pointer; padding: 4px; border-radius: 4px;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </td>
            </tr>
            `;
        };

        const getStatusBadgeStyle = (statusVal) => {
            if (statusVal === 'Top Urgent') return 'background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);';
            if (statusVal === 'Stuffing') return 'background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);';
            return 'background: rgba(56, 189, 248, 0.18); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);';
        };

        const routeBadge1 = (currentStatus1 === 'Top Urgent' && routes1.length > 0)
            ? `<span class="badge" style="background: rgba(239, 68, 68, 0.25); color: #fca5a5; font-size: 0.72rem; font-weight: 800; border: 1px solid rgba(239, 68, 68, 0.45); padding: 2px 7px; letter-spacing: 0.5px;">ROUTE: ${routes1.join(', ')}</span>`
            : '';

        const typeBadge = isTwoDrop
            ? `<span class="badge" style="background: rgba(167, 139, 250, 0.2); color: #c084fc; font-weight: 600; font-size: 0.72rem; padding: 2px 8px; border: 1px solid rgba(167, 139, 250, 0.3);">2 Drops</span>`
            : `<span class="badge" style="${getStatusBadgeStyle(currentStatus1)} font-weight: 600; font-size: 0.72rem; padding: 2px 8px;">${currentStatus1}</span>${routeBadge1}`;

        // Mode segmented button toggle for ALL trucks
        const dropModeToggle = `
            <div style="display: inline-flex; align-items: center; background: var(--surface-solid, #09090b); border: 1px solid var(--border); border-radius: 6px; padding: 2px;">
                <button type="button" onclick="window.toggleTruckDropMode('${tId}', 'single')" style="background: ${!isTwoDrop ? 'var(--accent, #5E6AD2)' : 'transparent'}; color: ${!isTwoDrop ? '#fff' : 'var(--fg-muted)'}; border: none; padding: 3px 8px; font-size: 0.75rem; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
                    Single Drop
                </button>
                <button type="button" onclick="window.toggleTruckDropMode('${tId}', 'two_drop')" style="background: ${isTwoDrop ? 'var(--accent, #5E6AD2)' : 'transparent'}; color: ${isTwoDrop ? '#fff' : 'var(--fg-muted)'}; border: none; padding: 3px 8px; font-size: 0.75rem; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
                    2 Drops
                </button>
            </div>
        `;

        // Helper to render the status dropdown
        const renderStatusSelect = (fieldKey, activeVal) => `
            <select onchange="window.updateTruckMeta('${tId}', '${fieldKey}', this.value); renderTruckBoards();" style="padding: 4px 8px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: ${activeVal === 'Top Urgent' ? '#f87171' : (activeVal === 'Stuffing' ? '#fbbf24' : '#60a5fa')}; font-weight: 600; outline: none; font-size: 0.8rem; cursor: pointer;">
                <option value="Direct" ${activeVal === 'Direct' ? 'selected' : ''} style="color: #60a5fa; background: #15151b;">Direct</option>
                <option value="Top Urgent" ${activeVal === 'Top Urgent' ? 'selected' : ''} style="color: #f87171; background: #15151b;">Top Urgent</option>
                <option value="Stuffing" ${activeVal === 'Stuffing' ? 'selected' : ''} style="color: #fbbf24; background: #15151b;">Stuffing</option>
            </select>
        `;

        // Content Area rendering (Single vs Two Drops)
        let tablesContentHtml = '';

        if (!isTwoDrop) {
            // SINGLE DROP MODE
            let rowsHtml = '';
            assignedList.forEach(doObj => {
                rowsHtml += renderRowHtml(doObj, 1);
            });
            if (assignedList.length === 0) {
                rowsHtml = `<tr><td colspan="4" style="text-align:center; padding: 18px; color: var(--fg-muted, #64748b); font-size: 0.85rem;">Drag & drop DOs here or use the "+ Add Manual" button in the header</td></tr>`;
            }

            tablesContentHtml = `
                <!-- Config Input Row -->
                <div style="padding: 10px 18px; border-bottom: 1px solid var(--border); display: flex; gap: 8px; font-size: 0.82rem; align-items: center; background: var(--surface-hover, transparent); flex-wrap: wrap;">
                    <select onchange="window.updateTruckMeta('${tId}', 'size', this.value)" style="padding: 4px 8px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); font-weight: 500; outline: none; font-size: 0.8rem;">
                        <option value="40HC" ${meta.size === '40HC' ? 'selected' : ''}>40HC</option>
                        <option value="20GP" ${meta.size === '20GP' ? 'selected' : ''}>20GP</option>
                        <option value="24FT" ${meta.size === '24FT' ? 'selected' : ''}>24FT</option>
                        <option value="14FT" ${meta.size === '14FT' ? 'selected' : ''}>14FT</option>
                    </select>
                    ${renderStatusSelect('status', currentStatus1)}
                    <input type="text" placeholder="Hub (e.g. HUB2601001)" value="${meta.hub || ''}" onchange="window.updateTruckMeta('${tId}', 'hub', this.value)" style="padding: 4px 8px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); width: 140px; outline: none; font-size: 0.8rem;">
                    <input type="text" placeholder="Destination (e.g. Nippon S'Pore)" value="${meta.dest || ''}" onchange="window.updateTruckMeta('${tId}', 'dest', this.value)" style="padding: 4px 8px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); flex: 1; min-width: 140px; outline: none; font-size: 0.8rem;">
                    <button type="button" onclick="window.toggleTruckDropMode('${tId}', 'two_drop')" class="action-btn" style="padding: 4px 8px; font-size: 0.76rem; border-radius: var(--radius-control); background: rgba(167, 139, 250, 0.12); color: #c084fc; border: 1px solid rgba(167, 139, 250, 0.25); font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Add another sequential hub drop">
                        + Add 2nd Hub
                    </button>
                </div>

                <!-- Assigned Table -->
                <div style="padding: 0; overflow-y: auto; flex: 1; border-radius: 0 0 var(--radius-card) var(--radius-card);">
                    <table class="data-table" style="width: 100%; margin: 0; border: none;">
                        <tbody style="border: none;">
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            // TWO DROPS MODE
            const drop1List = assignedList.filter(d => (d.dropSeq || 1) === 1);
            const drop2List = assignedList.filter(d => d.dropSeq === 2);
            const drop1Qty = drop1List.reduce((sum, d) => sum + getDoEffectiveQty(d), 0);
            const drop2Qty = drop2List.reduce((sum, d) => sum + getDoEffectiveQty(d), 0);

            let drop1Rows = '';
            drop1List.forEach(doObj => { drop1Rows += renderRowHtml(doObj, 1); });
            if (drop1List.length === 0) {
                drop1Rows = `<tr><td colspan="4" style="text-align:center; padding: 12px; color: var(--fg-muted); font-size: 0.8rem;">No DOs in 1st Drop</td></tr>`;
            }

            let drop2Rows = '';
            drop2List.forEach(doObj => { drop2Rows += renderRowHtml(doObj, 2); });
            if (drop2List.length === 0) {
                drop2Rows = `<tr><td colspan="4" style="text-align:center; padding: 12px; color: var(--fg-muted); font-size: 0.8rem;">No DOs in 2nd Drop</td></tr>`;
            }

            tablesContentHtml = `
                <!-- Size & Drops Config Area -->
                <div style="padding: 10px 18px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; background: var(--surface-hover, transparent);">
                    <!-- Size selector -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.78rem; color: var(--fg-muted); font-weight: 600;">Size:</span>
                        <select onchange="window.updateTruckMeta('${tId}', 'size', this.value)" style="padding: 3px 8px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); font-weight: 500; outline: none; font-size: 0.8rem;">
                            <option value="40HC" ${meta.size === '40HC' ? 'selected' : ''}>40HC</option>
                            <option value="20GP" ${meta.size === '20GP' ? 'selected' : ''}>20GP</option>
                            <option value="24FT" ${meta.size === '24FT' ? 'selected' : ''}>24FT</option>
                            <option value="14FT" ${meta.size === '14FT' ? 'selected' : ''}>14FT</option>
                        </select>
                    </div>

                    <!-- Drop 1 Config Row -->
                    <div style="display: flex; gap: 8px; font-size: 0.82rem; align-items: center; flex-wrap: wrap;">
                        <span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 0.75rem; font-weight: 700; width: 75px; text-align: center;">1st Drop</span>
                        ${renderStatusSelect('status', currentStatus1)}
                        <input type="text" placeholder="Hub 1 (e.g. HB01)" value="${meta.hub || ''}" onchange="window.updateTruckMeta('${tId}', 'hub', this.value)" style="padding: 4px 8px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); width: 100px; outline: none; font-size: 0.8rem;">
                        <input type="text" placeholder="Destination 1 (e.g. Pawa Brothers)" value="${meta.dest || ''}" onchange="window.updateTruckMeta('${tId}', 'dest', this.value)" style="padding: 4px 8px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); flex: 1; min-width: 140px; outline: none; font-size: 0.8rem;">
                    </div>

                    <!-- Drop 2 Config Row -->
                    <div style="display: flex; gap: 8px; font-size: 0.82rem; align-items: center; flex-wrap: wrap;">
                        <span class="badge" style="background: rgba(167, 139, 250, 0.2); color: #c084fc; font-size: 0.75rem; font-weight: 700; width: 75px; text-align: center;">2nd Drop</span>
                        ${renderStatusSelect('status2', currentStatus2)}
                        <input type="text" placeholder="Hub 2 (e.g. HB02)" value="${meta.hub2 || ''}" onchange="window.updateTruckMeta('${tId}', 'hub2', this.value)" style="padding: 4px 8px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); width: 100px; outline: none; font-size: 0.8rem;">
                        <input type="text" placeholder="Destination 2 (e.g. Harvey Norman)" value="${meta.dest2 || ''}" onchange="window.updateTruckMeta('${tId}', 'dest2', this.value)" style="padding: 4px 8px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); flex: 1; min-width: 140px; outline: none; font-size: 0.8rem;">
                    </div>
                </div>

                <!-- 2 Drops Sub-tables Container -->
                <div style="padding: 0; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; padding: 10px;">
                    <!-- Drop 1 Box -->
                    <div class="truck-board-dropzone" ondragover="allowDrop(event)" ondrop="dropToTruck(event, '${tId}', 1)" ondragenter="dragEnterTruck(event)" ondragleave="dragLeaveTruck(event)" style="border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 8px; overflow: visible; background: rgba(59, 130, 246, 0.02);">
                        <div style="padding: 6px 12px; background: rgba(59, 130, 246, 0.1); border-bottom: 1px solid rgba(59, 130, 246, 0.2); display: flex; justify-content: space-between; align-items: center; border-radius: 7px 7px 0 0; flex-wrap: wrap; gap: 6px;">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span style="font-size: 0.78rem; font-weight: 700; color: #60a5fa;">🔵 1st Drop — ${meta.dest || 'Stop 1'}</span>
                                <span class="badge" style="${getStatusBadgeStyle(currentStatus1)} font-size: 0.68rem; padding: 1px 6px;">${currentStatus1}</span>
                                ${(currentStatus1 === 'Top Urgent') ? renderRouteDropdown(tId, 1, routes1) : ''}
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 0.72rem; color: var(--fg-muted); font-family: Aptos Display, sans-serif;">${drop1List.length} DOs • ${drop1Qty.toLocaleString()} pcs</span>
                                <button type="button" onclick="window.openManualDoModal('${tId}', 1)" class="action-btn" style="padding: 2px 7px; font-size: 0.7rem; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="Add manual DO to 1st Drop">
                                    + Add DO
                                </button>
                            </div>
                        </div>
                        <table class="data-table" style="width: 100%; margin: 0; border: none;">
                            <tbody style="border: none;">
                                ${drop1Rows}
                            </tbody>
                        </table>
                    </div>

                    <!-- Drop 2 Box -->
                    <div class="truck-board-dropzone" ondragover="allowDrop(event)" ondrop="dropToTruck(event, '${tId}', 2)" ondragenter="dragEnterTruck(event)" ondragleave="dragLeaveTruck(event)" style="border: 1px solid rgba(167, 139, 250, 0.25); border-radius: 8px; overflow: visible; background: rgba(167, 139, 250, 0.02);">
                        <div style="padding: 6px 12px; background: rgba(167, 139, 250, 0.1); border-bottom: 1px solid rgba(167, 139, 250, 0.2); display: flex; justify-content: space-between; align-items: center; border-radius: 7px 7px 0 0; flex-wrap: wrap; gap: 6px;">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span style="font-size: 0.78rem; font-weight: 700; color: #c084fc;">🟣 2nd Drop — ${meta.dest2 || 'Stop 2'}</span>
                                <span class="badge" style="${getStatusBadgeStyle(currentStatus2)} font-size: 0.68rem; padding: 1px 6px;">${currentStatus2}</span>
                                ${(currentStatus2 === 'Top Urgent') ? renderRouteDropdown(tId, 2, routes2) : ''}
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 0.72rem; color: var(--fg-muted); font-family: Aptos Display, sans-serif;">${drop2List.length} DOs • ${drop2Qty.toLocaleString()} pcs</span>
                                <button type="button" onclick="window.openManualDoModal('${tId}', 2)" class="action-btn" style="padding: 2px 7px; font-size: 0.7rem; border-radius: 4px; background: rgba(167, 139, 250, 0.15); color: #c084fc; border: 1px solid rgba(167, 139, 250, 0.3); font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="Add manual DO to 2nd Drop">
                                    + Add DO
                                </button>
                            </div>
                        </div>
                        <table class="data-table" style="width: 100%; margin: 0; border: none;">
                            <tbody style="border: none;">
                                ${drop2Rows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        html += `
            <div class="glass-card truck-board-dropzone" ondragover="allowDrop(event)" ondrop="dropToTruck(event, '${tId}')" ondragenter="dragEnterTruck(event)" ondragleave="dragLeaveTruck(event)" style="display: flex; flex-direction: column; max-height: 480px; transition: all 0.2s; border-radius: var(--radius-card); border: 1px solid var(--border); overflow: visible; background: var(--surface-card, var(--bg-elevated)); position: relative;">
                <!-- Board Header -->
                <div style="padding: 10px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--surface-hover, transparent); gap: 8px; flex-wrap: wrap; border-radius: var(--radius-card) var(--radius-card) 0 0;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--fg);">Truck ${index + 1}</h3>
                        ${typeBadge}
                        ${(!isTwoDrop && currentStatus1 === 'Top Urgent') ? renderRouteDropdown(tId, 1, routes1) : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        ${dropModeToggle}
                        <button type="button" onclick="window.toggleHideDoList('${tId}')" class="action-btn" title="${meta.hideDoList ? 'DOs hidden in Final Plan (Items with Hubs still shown with Qty). Click to show all DOs in Plan.' : 'Hide DOs in Final Plan (Items with Hubs remain visible with Qty).'}" style="padding: 3px 8px; font-size: 0.74rem; border-radius: 4px; background: ${meta.hideDoList ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface)'}; color: ${meta.hideDoList ? '#f87171' : 'var(--fg-muted)'}; border: 1px solid ${meta.hideDoList ? 'rgba(239, 68, 68, 0.35)' : 'var(--border)'}; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s; font-weight: 600;">
                            ${meta.hideDoList 
                                ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg><span>Hidden in Plan</span>` 
                                : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span>Hide in Plan</span>`}
                        </button>
                        <span class="badge" style="background: var(--surface); color: var(--fg-subtle); font-size: 0.75rem; border: 1px solid var(--border);">${assignedList.length} DOs</span>
                        <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-size: 0.75rem; font-family: Aptos Display, sans-serif; font-weight: 600;">${totalQty.toLocaleString()} pcs</span>
                        <button type="button" onclick="window.openManualDoModal('${tId}', 1)" class="action-btn" style="padding: 3px 8px; font-size: 0.74rem; border-radius: var(--radius-control); background: rgba(94, 106, 210, 0.12); color: var(--accent, #5E6AD2); border: 1px solid rgba(94, 106, 210, 0.25); font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Manually add a DO to this truck">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Add Manual
                        </button>
                        <button onclick="removeTruck('${tId}')" title="Delete Truck" style="background: none; border: none; color: var(--fg-muted); cursor: pointer; display: flex; align-items: center; padding: 4px; border-radius: 4px; transition: color 0.2s;" onmouseover="this.style.color='var(--btn-danger-fg)'" onmouseout="this.style.color='var(--fg-muted)'">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>

                ${tablesContentHtml}
            </div>
        `;
    });
    
    container.innerHTML = html;
    updateMetricsStrip();
}

function assignSelectedDOs() {
    const select = document.getElementById("targetTruckSelect");
    const dropSelect = document.getElementById("targetDropSelect");
    
    const targetTruckId = select ? select.value : null;
    const selectedDropSeq = (dropSelect && dropSelect.value) ? parseInt(dropSelect.value, 10) : 1;
    
    if (!targetTruckId) {
        showToast("Please select a target truck.", "error");
        return;
    }
    
    const checkboxes = document.querySelectorAll(".do-checkbox:checked");
    if (checkboxes.length === 0) {
        showToast("Please select at least one DO to assign.", "error");
        return;
    }
    
    const selectedInvs = Array.from(checkboxes).map(cb => String(cb.value));
    const selectedDOs = unassignedDOs.filter(d => selectedInvs.includes(String(d.inv)));
    const remainingUnassigned = unassignedDOs.filter(d => !selectedInvs.includes(String(d.inv)));
    
    const meta = (typeof truckMeta !== 'undefined' && truckMeta[targetTruckId]) ? truckMeta[targetTruckId] : {};
    const finalDropSeq = meta.dropMode === 'two_drop' ? selectedDropSeq : 1;

    // Apply dropSeq, keeping DO natural attributes
    selectedDOs.forEach(d => {
        d.dropSeq = finalDropSeq;
    });
    
    trucks[targetTruckId].push(...selectedDOs);
    unassignedDOs = remainingUnassigned;
    
    const selectAllCb = document.getElementById("selectAllUnassigned");
    if (selectAllCb) selectAllCb.checked = false;
    
    renderUnassignedDOs();
    renderTruckBoards();
    saveState();
}

function unassignDO(truckId, doInv) {
    const truckList = trucks[truckId];
    const index = truckList.findIndex(d => String(d.inv) === String(doInv));
    if (index !== -1) {
        const doObj = truckList.splice(index, 1)[0];
        unassignedDOs.push(doObj);
        
        renderUnassignedDOs();
        renderTruckBoards();
        if (window._isTruckPlanViewOpen) {
            renderTruckPlanCanvas();
        }
        saveState();
    }
}

window.openManualDoModal = function(truckId, dropSeq = 1) {
    let modal = document.getElementById('manualDoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'manualDoModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 10000; justify-content: center; align-items: center; padding: 20px;';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        document.body.appendChild(modal);
    }
    
    const truckKeys = Object.keys(trucks);
    const truckIdx = truckKeys.indexOf(truckId) + 1;
    const meta = (typeof truckMeta !== 'undefined' && truckMeta[truckId]) ? truckMeta[truckId] : {};
    const defaultHub = (dropSeq === 2 ? meta.hub2 : meta.hub) || "";
    const dropLabel = meta.dropMode === 'two_drop' ? (dropSeq === 2 ? '2nd Drop' : '1st Drop') : 'Single Drop';
    
    modal.innerHTML = `
        <div style="width: 100%; max-width: 440px; background: var(--surface-card, var(--bg-elevated)); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); overflow: hidden; display: flex; flex-direction: column;">
            <!-- Header -->
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--surface-hover, transparent);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(94, 106, 210, 0.15); color: var(--accent, #5E6AD2); display: flex; align-items: center; justify-content: center; font-weight: 700;">
                        ➕
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--fg);">Add Manual DO</h3>
                        <div style="font-size: 0.75rem; color: var(--fg-muted);">Truck ${truckIdx} • ${dropLabel}</div>
                    </div>
                </div>
                <button type="button" onclick="document.getElementById('manualDoModal').style.display='none'" style="background: none; border: none; color: var(--fg-muted); font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px; line-height: 1;">✕</button>
            </div>
            <!-- Body -->
            <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
                <div>
                    <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--fg-subtle); margin-bottom: 6px;">DO Number <span style="color: #f87171;">*</span></label>
                    <input type="text" id="modalManualDoInput" placeholder="e.g. 81524819" style="width: 100%; padding: 8px 12px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); font-size: 0.85rem; outline: none; font-weight: 600;">
                </div>
                <div style="display: flex; gap: 12px;">
                    <div style="flex: 1;">
                        <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--fg-subtle); margin-bottom: 6px;">Quantity (pcs)</label>
                        <input type="number" id="modalManualQtyInput" placeholder="0" style="width: 100%; padding: 8px 12px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); font-size: 0.85rem; outline: none;">
                    </div>
                    <div style="flex: 1.4;">
                        <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--fg-subtle); margin-bottom: 6px;">Hub Number</label>
                        <input type="text" id="modalManualHubInput" placeholder="e.g. HUB2601001" value="${defaultHub}" style="width: 100%; padding: 8px 12px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); font-size: 0.85rem; outline: none;">
                    </div>
                </div>
            </div>
            <!-- Footer -->
            <div style="padding: 12px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; background: var(--surface-hover, transparent);">
                <button type="button" class="action-btn" onclick="document.getElementById('manualDoModal').style.display='none'" style="padding: 7px 16px; font-size: 0.82rem; border-radius: var(--radius-control); background: var(--surface); color: var(--fg); border: 1px solid var(--border); cursor: pointer;">Cancel</button>
                <button type="button" class="action-btn primary" onclick="window.submitModalManualDo('${truckId}', ${dropSeq})" style="padding: 7px 18px; font-size: 0.82rem; font-weight: 700; border-radius: var(--radius-control); background: var(--accent, #5E6AD2); color: #fff; cursor: pointer;">Add to Truck</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    setTimeout(() => {
        const inp = document.getElementById('modalManualDoInput');
        if (inp) {
            inp.focus();
            inp.onkeydown = (e) => { if (e.key === 'Enter') window.submitModalManualDo(truckId, dropSeq); };
        }
        const qtyInp = document.getElementById('modalManualQtyInput');
        if (qtyInp) {
            qtyInp.onkeydown = (e) => { if (e.key === 'Enter') window.submitModalManualDo(truckId, dropSeq); };
        }
        const hubInp = document.getElementById('modalManualHubInput');
        if (hubInp) {
            hubInp.onkeydown = (e) => { if (e.key === 'Enter') window.submitModalManualDo(truckId, dropSeq); };
        }
    }, 50);
};

window.submitModalManualDo = function(truckId, dropSeq) {
    const doInput = document.getElementById('modalManualDoInput');
    const qtyInput = document.getElementById('modalManualQtyInput');
    const hubInput = document.getElementById('modalManualHubInput');
    
    if (!doInput) return;
    const inv = doInput.value.trim();
    if (!inv) {
        showToast("Please key in a DO number.", "error");
        doInput.focus();
        return;
    }
    
    const qty = qtyInput && qtyInput.value ? parseInt(qtyInput.value, 10) : 0;
    const enteredHub = hubInput && hubInput.value ? hubInput.value.trim() : "";
    const meta = (typeof truckMeta !== 'undefined' && truckMeta[truckId]) ? truckMeta[truckId] : {};
    
    const finalHub = enteredHub || (dropSeq === 2 ? meta.hub2 : meta.hub) || "N/A";
    const finalDestName = (dropSeq === 2 ? (meta.dest2 || 'Stop 2') : (meta.dest || 'Stop 1'));
    
    // 1. Check if DO already exists in unassigned pool
    const unassignedIdx = unassignedDOs.findIndex(d => String(d.inv).toLowerCase() === inv.toLowerCase());
    if (unassignedIdx !== -1) {
        const doObj = unassignedDOs.splice(unassignedIdx, 1)[0];
        doObj.dropSeq = dropSeq;
        if (qty > 0) doObj.qty = qty;
        if (enteredHub) doObj.hub = enteredHub;
        trucks[truckId].push(doObj);
        showToast(`Moved DO ${inv} from Unassigned pool into ${truckId.replace('truck_', 'Truck ')}.`, "success");
    } else {
        // 2. Check if DO already exists across any truck
        let existingTruckId = null;
        let existingIdx = -1;
        for (let t in trucks) {
            const idx = trucks[t].findIndex(d => String(d.inv).toLowerCase() === inv.toLowerCase());
            if (idx !== -1) {
                existingTruckId = t;
                existingIdx = idx;
                break;
            }
        }
        
        if (existingTruckId) {
            if (existingTruckId === truckId) {
                const existingDo = trucks[existingTruckId][existingIdx];
                if (qty > 0) existingDo.qty = qty;
                if (enteredHub) existingDo.hub = enteredHub;
                existingDo.dropSeq = dropSeq;
                showToast(`Updated DO ${inv} in ${truckId.replace('truck_', 'Truck ')}.`, "info");
            } else {
                const doObj = trucks[existingTruckId].splice(existingIdx, 1)[0];
                doObj.dropSeq = dropSeq;
                if (qty > 0) doObj.qty = qty;
                if (enteredHub) doObj.hub = enteredHub;
                trucks[truckId].push(doObj);
                showToast(`Reassigned DO ${inv} from ${existingTruckId.replace('truck_', 'Truck ')} into ${truckId.replace('truck_', 'Truck ')}.`, "success");
            }
        } else {
            // 3. Create a brand new manual DO entry
            const newDo = {
                inv: inv,
                name: finalDestName,
                qty: qty || 0,
                vol: 0,
                remark: "",
                tag: "direct",
                hub: finalHub,
                dropSeq: dropSeq
            };
            trucks[truckId].push(newDo);
            showToast(`Added DO ${inv} (Hub: ${finalHub}) to ${truckId.replace('truck_', 'Truck ')}.`, "success");
        }
    }
    
    const modal = document.getElementById('manualDoModal');
    if (modal) modal.style.display = 'none';
    
    renderUnassignedDOs();
    renderTruckBoards();
    if (window._isTruckPlanViewOpen) {
        renderTruckPlanCanvas();
    }
    saveState();
};

window.editDoHub = function(truckId, doInv) {
    let doObj = null;
    let list = trucks[truckId] || [];
    doObj = list.find(d => String(d.inv) === String(doInv));
    if (!doObj) {
        doObj = unassignedDOs.find(d => String(d.inv) === String(doInv));
    }
    if (!doObj) return;

    let modal = document.getElementById('editHubModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editHubModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 10000; justify-content: center; align-items: center; padding: 20px;';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        document.body.appendChild(modal);
    }

    const currentHub = (doObj.hub && doObj.hub !== 'N/A') ? doObj.hub : '';

    modal.innerHTML = `
        <div style="width: 100%; max-width: 380px; background: var(--surface-card, var(--bg-elevated)); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); overflow: hidden; display: flex; flex-direction: column;">
            <div style="padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--surface-hover, transparent);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem;">
                        🏷️
                    </div>
                    <div>
                        <h4 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: var(--fg);">Assign Hub to DO</h4>
                        <div style="font-size: 0.72rem; color: var(--fg-muted);">DO #${doObj.inv}</div>
                    </div>
                </div>
                <button type="button" onclick="document.getElementById('editHubModal').style.display='none'" style="background: none; border: none; color: var(--fg-muted); font-size: 18px; cursor: pointer; padding: 4px; line-height: 1;">✕</button>
            </div>
            <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 10px;">
                <label style="font-size: 0.76rem; font-weight: 600; color: var(--fg-subtle);">Hub Number</label>
                <input type="text" id="editHubModalInput" placeholder="e.g. HUB2608091 or HB01" value="${currentHub}" style="width: 100%; padding: 8px 12px; border-radius: var(--radius-control); background: var(--surface-solid, #09090b); border: 1px solid var(--border); color: var(--fg); font-size: 0.85rem; outline: none; font-weight: 600;">
                <div style="font-size: 0.7rem; color: var(--fg-muted);">Leave blank to clear or inherit default drop hub.</div>
            </div>
            <div style="padding: 10px 18px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; background: var(--surface-hover, transparent);">
                <button type="button" class="action-btn" onclick="document.getElementById('editHubModal').style.display='none'" style="padding: 6px 14px; font-size: 0.78rem; border-radius: var(--radius-control); background: var(--surface); color: var(--fg); border: 1px solid var(--border); cursor: pointer;">Cancel</button>
                <button type="button" class="action-btn primary" onclick="window.saveDoHub('${truckId}', '${doInv}')" style="padding: 6px 16px; font-size: 0.78rem; font-weight: 700; border-radius: var(--radius-control); background: #f59e0b; color: #000; cursor: pointer;">Save Hub</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => {
        const inp = document.getElementById('editHubModalInput');
        if (inp) {
            inp.focus();
            inp.select();
            inp.onkeydown = (e) => { if (e.key === 'Enter') window.saveDoHub(truckId, doInv); };
        }
    }, 50);
};

window.saveDoHub = function(truckId, doInv) {
    const inp = document.getElementById('editHubModalInput');
    if (!inp) return;
    const newHub = inp.value.trim();

    let doObj = null;
    let list = trucks[truckId] || [];
    doObj = list.find(d => String(d.inv) === String(doInv));
    if (!doObj) {
        doObj = unassignedDOs.find(d => String(d.inv) === String(doInv));
    }

    if (doObj) {
        doObj.hub = newHub || "N/A";
        showToast(`Updated Hub for DO ${doInv} to ${newHub || 'None'}.`, "success");
    }

    const modal = document.getElementById('editHubModal');
    if (modal) modal.style.display = 'none';

    renderUnassignedDOs();
    renderTruckBoards();
    if (window._isTruckPlanViewOpen) {
        renderTruckPlanCanvas();
    }
    saveState();
};

async function exportTruckPlan() {
    if (!window.XLSX) {
        showToast("Excel export library is not loaded.", "error");
        return;
    }
    
    let hasAssignedDOs = false;
    for (let tId in trucks) {
        if (trucks[tId].length > 0) {
            hasAssignedDOs = true;
            break;
        }
    }
    
    if (!hasAssignedDOs) {
        showToast("No DOs have been assigned to any trucks yet.", "error");
        return;
    }
    
    const wb = XLSX.utils.book_new();
    const wsData = [];
    
    // --- Styles ---
    const styleEtd = {
        font: { bold: true, sz: 14 },
        fill: { fgColor: { rgb: "FFFFFF00" } }, // Yellow background
        border: {
            top: { style: "thick", color: { rgb: "000000" } },
            bottom: { style: "thick", color: { rgb: "000000" } },
            left: { style: "thick", color: { rgb: "000000" } },
            right: { style: "thick", color: { rgb: "000000" } }
        },
        alignment: { horizontal: "center", vertical: "center" }
    };
    
    const styleTruckIdx = { font: { bold: true, sz: 12 } };
    const styleTruckName = { font: { bold: true, sz: 12 } };
    const styleDropHeader = { font: { bold: true, sz: 11, color: { rgb: "7030A0" } }, fill: { fgColor: { rgb: "F2F2F2" } } };
    const styleConsignee = { font: { bold: true, color: { rgb: "0070C0" } } }; // Blue for Consignee
    const styleHub = { font: { bold: true, italic: true, color: { rgb: "0000FF" } } }; // Blue Italic for Hub
    const styleDoNum = { font: { sz: 11 } };
    const styleVol = { font: { sz: 11 } };
    const styleSubtotal = { font: { bold: true, sz: 11, italic: true } };
    
    // 1. Add ETD Row
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    
    wsData.push([
        null, // Col A
        { v: `ETD:${dateStr}`, s: styleEtd }, // Col B
        null, // Col C
        null,
        { v: `ETD:${dateStr}`, s: styleEtd },
        null,
    ]);
    wsData.push([]); 
    
    let truckIdx = 1;
    Object.keys(trucks).forEach((tId) => {
        const assignedList = trucks[tId] || [];
        if (assignedList.length === 0) return;
        
        const meta = (typeof truckMeta !== 'undefined' && truckMeta[tId]) ? truckMeta[tId] : { size: "", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "" };
        const isTwoDrop = meta.dropMode === 'two_drop';
        const hasCrossDock = assignedList.some(d => d.tag === 'cross_dock');
        const isPureCrossDock = hasCrossDock && assignedList.every(d => d.tag === 'cross_dock') && !meta.dest;
        const status1 = meta.status || "Direct";
        const status2 = meta.status2 || "Direct";
        const truckType = isPureCrossDock ? "TOP URGENT" : (isTwoDrop ? (status1 === status2 ? `${status1.toUpperCase()} (2 DROPS)` : "2 DROPS") : status1.toUpperCase());
        
        // Build Truck Header Row
        const metaStrParts = [];
        if (meta.size) metaStrParts.push(`[${meta.size}]`);
        if (!isTwoDrop) {
            if (meta.hub) metaStrParts.push(`HUB: ${meta.hub.toUpperCase()}`);
            if (meta.dest) metaStrParts.push(`TO: ${meta.dest.toUpperCase()}`);
        } else {
            metaStrParts.push(`[2 DROPS]`);
        }
        const metaStr = metaStrParts.length > 0 ? `  -  ${metaStrParts.join(" | ")}` : "";
        
        wsData.push([
            { v: `(${truckIdx})`, s: styleTruckIdx },
            { v: `TRUCK ${truckIdx} (${truckType})${metaStr}`, s: styleTruckName }
        ]);
        
        if (isPureCrossDock) {
            const totalTruckQty = assignedList.reduce((sum, d) => sum + (parseInt(d.qty, 10) || 0), 0);
            wsData.push([{ v: "ALL 5 ROUTES", s: styleConsignee }]);
            wsData.push([{ v: `${totalTruckQty.toLocaleString()} pcs`, s: styleVol }]);
            wsData.push([]);
            truckIdx++;
            return;
        }

        const appendDropToWs = (dropDos, dropLabel, dropHub, dropDest, dropStatus) => {
            if (isTwoDrop) {
                const dropHubStr = dropHub ? `HUB: ${dropHub.toUpperCase()}` : "";
                const dropDestStr = dropDest ? `TO: ${dropDest.toUpperCase()}` : "";
                const dropStatusStr = dropStatus ? `[${dropStatus.toUpperCase()}]` : "";
                const headerText = `=== ${dropLabel} === ${[dropStatusStr, dropHubStr, dropDestStr].filter(Boolean).join(" | ")}`;
                wsData.push([
                    { v: headerText, s: styleDropHeader }
                ]);
            }

            const consigneeGroups = {};
            dropDos.forEach(d => {
                if (!consigneeGroups[d.name]) consigneeGroups[d.name] = [];
                consigneeGroups[d.name].push(d);
            });
            
            for (let cName in consigneeGroups) {
                const cDOs = consigneeGroups[cName];
                const cTotalVol = cDOs.reduce((sum, d) => sum + (parseFloat(d.vol) || 0), 0);
                const cTotalQty = cDOs.reduce((sum, d) => sum + (parseInt(d.qty, 10) || 0), 0);
                
                wsData.push([
                    { v: `${cName.toUpperCase()} (${(dropStatus || 'DIRECT').toUpperCase()})`, s: styleConsignee }
                ]);
                
                const cHub = (cDOs.find(d => d.hub && d.hub !== 'N/A') || {}).hub || dropHub || "";
                if (cHub) {
                    wsData.push([{ v: `(HUB:${cHub})`, s: styleHub }]);
                }
                
                cDOs.forEach(d => {
                    const doText = d.remark ? `DO: '${d.inv} ${d.remark}'` : `DO: '${d.inv}'`;
                    wsData.push([{ v: doText, s: styleDO }]);
                });
                
                wsData.push([{ v: `VOL: ${cTotalVol.toFixed(2)} M3 (${cTotalQty.toLocaleString()} pcs)`, s: styleVol }]);
                wsData.push([]);
            }
        };
        
        if (!isTwoDrop) {
            appendDropToWs(assignedList, "SINGLE DROP", meta.hub, meta.dest, status1);
        } else {
            const drop1List = assignedList.filter(d => (d.dropSeq || 1) === 1);
            const drop2List = assignedList.filter(d => d.dropSeq === 2);
            if (drop1List.length > 0 || meta.dest || meta.hub) {
                appendDropToWs(drop1List, "1ST DROP", meta.hub, meta.dest, status1);
            }
            if (drop2List.length > 0 || meta.dest2 || meta.hub2) {
                appendDropToWs(drop2List, "2ND DROP", meta.hub2, meta.dest2, status2);
            }
        }

        wsData.push([]); // Space after truck
        truckIdx++;
    });
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Merge cells for ETD (B1:C1)
    ws['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }
    ];
    
    // Set column widths
    ws['!cols'] = [
        { wch: 60 }, // Col A (Contains Consignee, Hub, DO + Remark, Vol)
        { wch: 45 }, // Col B (Contains ETD, Truck Name)
        { wch: 15 }  // Col C
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, "Truck Plan");
    const exportDate = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `DO_Truck_Plan_${exportDate}.xlsx`);
}

// --- Drag and Drop Logic ---
function dragStart(ev, doInv, sourceTruckId = null, fromDropSeq = null) {
    let invsToDrag = [String(doInv)];
    
    // If dragging from unassigned, check if multiple DOs are selected
    if (!sourceTruckId) {
        const checkedInvs = Array.from(document.querySelectorAll('.do-checkbox:checked')).map(cb => String(cb.value));
        if (checkedInvs.includes(String(doInv)) && checkedInvs.length > 1) {
            invsToDrag = checkedInvs;
        }
    }
    
    ev.dataTransfer.setData("text/plain", JSON.stringify({
        inv: doInv,
        invs: invsToDrag,
        source: sourceTruckId,
        fromDrop: fromDropSeq
    }));
    
    // Custom drag ghost preview for multi-select
    if (invsToDrag.length > 1) {
        const ghost = document.createElement("div");
        ghost.id = "multiDragGhost";
        ghost.style.cssText = "position: absolute; top: -9999px; left: -9999px; background: #5E6AD2; color: #fff; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); pointer-events: none; z-index: 10000; border: 1px solid rgba(255,255,255,0.3); font-family: inherit;";
        ghost.textContent = `📦 Moving ${invsToDrag.length} Delivery Orders`;
        document.body.appendChild(ghost);
        ev.dataTransfer.setDragImage(ghost, 20, 20);
        setTimeout(() => { ghost.remove(); }, 0);
    }
    
    ev.target.style.opacity = "0.5";
    ev.target.classList.add("dragging");
}

function dragEnd(ev) {
    ev.target.style.opacity = "1";
    ev.target.classList.remove("dragging");
    document.querySelectorAll('.truck-board-dropzone').forEach(el => el.style.border = "");
}

function allowDrop(ev) {
    ev.preventDefault(); // Necessary to allow dropping
}

function dragEnterTruck(ev) {
    ev.preventDefault();
    const board = ev.currentTarget;
    board.style.border = "2px dashed var(--accent, #3b82f6)";
    board.style.transform = "scale(1.01)";
}

function dragLeaveTruck(ev) {
    const board = ev.currentTarget;
    board.style.border = "";
    board.style.transform = "";
}

function dropToTruck(ev, targetTruckId, targetDrop = null) {
    ev.preventDefault();
    ev.stopPropagation();
    const board = ev.currentTarget;
    board.style.border = "";
    board.style.transform = "";
    
    try {
        const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
        const invList = (data.invs && Array.isArray(data.invs) && data.invs.length > 0) 
            ? data.invs.map(String) 
            : [String(data.inv)];
        const sourceTruckId = data.source;
        const meta = (typeof truckMeta !== 'undefined' && truckMeta[targetTruckId]) ? truckMeta[targetTruckId] : {};
        
        const movedDOs = [];
        
        invList.forEach(doInv => {
            let doObj = null;
            if (sourceTruckId) {
                const idx = (trucks[sourceTruckId] || []).findIndex(d => String(d.inv) === doInv);
                if (idx !== -1) {
                    doObj = trucks[sourceTruckId].splice(idx, 1)[0];
                }
            } else {
                const idx = unassignedDOs.findIndex(d => String(d.inv) === doInv);
                if (idx !== -1) {
                    doObj = unassignedDOs.splice(idx, 1)[0];
                }
            }
            
            if (doObj) {
                if (meta.dropMode === 'two_drop') {
                    doObj.dropSeq = targetDrop ? parseInt(targetDrop, 10) : (doObj.dropSeq || 1);
                } else {
                    doObj.dropSeq = 1;
                }
                movedDOs.push(doObj);
            }
        });
        
        if (movedDOs.length > 0) {
            trucks[targetTruckId].push(...movedDOs);
            
            // Clear selection
            const selectAllCb = document.getElementById("selectAllUnassigned");
            if (selectAllCb) selectAllCb.checked = false;
            
            renderUnassignedDOs();
            renderTruckBoards();
            saveState();
        }
    } catch (e) {
        console.error("Drop error", e);
    }
}

function dropToUnassigned(ev) {
    ev.preventDefault();
    try {
        const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
        const invList = (data.invs && Array.isArray(data.invs) && data.invs.length > 0) 
            ? data.invs.map(String) 
            : [String(data.inv)];
        const sourceTruckId = data.source;
        
        if (!sourceTruckId) return; // Already unassigned
        
        invList.forEach(doInv => {
            const idx = (trucks[sourceTruckId] || []).findIndex(d => String(d.inv) === doInv);
            if (idx !== -1) {
                const doObj = trucks[sourceTruckId].splice(idx, 1)[0];
                unassignedDOs.push(doObj);
            }
        });
        
        renderUnassignedDOs();
        renderTruckBoards();
        saveState();
    } catch (e) {
        console.error("Drop unassigned error", e);
    }
}

async function removeLastTruck() {
    const truckKeys = Object.keys(trucks);
    if (truckKeys.length <= 1) {
        showToast("At least one truck is required in the plan.", "info");
        return;
    }
    
    const lastTruckId = truckKeys[truckKeys.length - 1];
    
    if (trucks[lastTruckId].length > 0) {
        const confirmed = await window.showConfirmDialog({
            title: "Remove Last Truck",
            message: "The last truck has assigned DOs. Are you sure you want to remove it? DOs will be returned to the unassigned pool.",
            confirmText: "Remove Truck",
            isDanger: true
        });
        if (!confirmed) {
            return;
        }
        unassignedDOs.push(...trucks[lastTruckId]);
    }
    
    delete trucks[lastTruckId];
    renderUnassignedDOs();
    renderTruckBoards();
    updateTruckDropdown();
    saveState();
}

async function resetPlan() {
    const confirmed = await window.showConfirmDialog({
        title: "Reset Plan",
        message: "Are you sure you want to completely reset the truck plan? All DOs will be returned to the unassigned pool and all trucks will be deleted.",
        confirmText: "Reset All",
        isDanger: true
    });
    if (!confirmed) {
        return;
    }
    
    // Return all DOs
    for (let tId in trucks) {
        unassignedDOs.push(...trucks[tId]);
    }
    
    // Clear trucks
    trucks = {
        "truck_1": []
    };
    if (typeof truckMeta !== 'undefined') {
        truckMeta = {
            "truck_1": { size: "40HC", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "" }
        };
    }
    truckCounter = 1;
    
    // Reset search & filters
    const searchInput = document.getElementById("unassignedSearch");
    if (searchInput) searchInput.value = "";
    
    const selectAllCb = document.getElementById("selectAllUnassigned");
    if (selectAllCb) selectAllCb.checked = false;
    
    renderUnassignedDOs();
    renderTruckBoards();
    updateTruckDropdown();
    saveState();
}

// Empty ALL loaded route data + working state, returning the page to a blank slate.
// Called by the Route CSV "Reset" button (defined in mtp_source_upload.js).
window.resetMtpState = function() {
    unassignedDOs = [];
    trucks = {};
    if (typeof truckMeta !== 'undefined') truckMeta = {};
    truckCounter = 1;
    localStorage.removeItem("ManualTruckAssignments");

    const searchInput = document.getElementById("unassignedSearch");
    if (searchInput) searchInput.value = "";
    const selectAllCb = document.getElementById("selectAllUnassigned");
    if (selectAllCb) selectAllCb.checked = false;

    renderUnassignedDOs();
    renderTruckBoards();
    updateTruckDropdown();
    updateMetricsStrip();
    updateAssignButtonState();

    const tbody = document.getElementById("unassignedTableBody");
    if (tbody && unassignedDOs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--fg-muted);">No data loaded. Upload a Route CSV to begin.</td></tr>`;
    }
};

// --- DO Assignment Consistency Verification Engine ---
window.closeVerificationErrorModal = function() {
    const modal = document.getElementById('finalPlanVerificationErrorModal');
    if (modal) modal.style.display = 'none';
};

window.ignoreVerificationAndShowFinalPlan = function() {
    window.closeVerificationErrorModal();
    window.renderAndShowFinalPlanModal();
};

window.verifyDoAssignments = function() {
    const consigneeMap = {};
    const truckKeys = Object.keys(trucks);

    truckKeys.forEach((tId, tIndex) => {
        const assignedList = trucks[tId] || [];
        const meta = (typeof truckMeta !== 'undefined' && truckMeta[tId]) 
            ? truckMeta[tId] 
            : { size: "40HC", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "" };
        const isTwoDrop = meta.dropMode === 'two_drop';
        const hasCrossDock = assignedList.some(d => d.tag === 'cross_dock');
        const isPureCrossDock = hasCrossDock && assignedList.every(d => d.tag === 'cross_dock') && !meta.dest;

        assignedList.forEach(d => {
            const consigneeName = (d.name || 'Unknown Consignee').trim();
            const consigneeKey = consigneeName.toUpperCase();

            let status = 'Direct';
            let dropLabel = 'Single Drop';

            if (isPureCrossDock) {
                status = 'Top Urgent';
                dropLabel = 'Cross Dock';
            } else if (isTwoDrop) {
                const dropSeq = d.dropSeq === 2 ? 2 : 1;
                if (dropSeq === 1) {
                    status = meta.status || 'Direct';
                    dropLabel = '1st Drop' + (meta.dest ? ` (${meta.dest})` : '');
                } else {
                    status = meta.status2 || 'Direct';
                    dropLabel = '2nd Drop' + (meta.dest2 ? ` (${meta.dest2})` : '');
                }
            } else {
                status = meta.status || 'Direct';
                dropLabel = 'Single Drop' + (meta.dest ? ` (${meta.dest})` : '');
            }

            const splitInfo = (typeof getDoSplitInfo === 'function') ? getDoSplitInfo(d) : { isSplit: false, displayInv: d.inv };
            const invDisplay = splitInfo.isSplit ? splitInfo.displayInv : (d.remark ? `${d.inv} ${d.remark}` : d.inv);

            if (!consigneeMap[consigneeKey]) {
                consigneeMap[consigneeKey] = {
                    name: consigneeName,
                    items: []
                };
            }

            consigneeMap[consigneeKey].items.push({
                inv: d.inv,
                displayInv: invDisplay,
                truckId: tId,
                truckNum: tIndex + 1,
                truckLabel: `Truck ${tIndex + 1}`,
                dropSeq: d.dropSeq || 1,
                dropLabel: dropLabel,
                status: status,
                isDirect: (status || '').trim().toLowerCase() === 'direct',
                qty: (typeof getDoEffectiveQty === 'function') ? getDoEffectiveQty(d) : (d.qty || 0)
            });
        });
    });

    // Business Rule Check:
    // If multiple DOs share the same consignee name, and at least one DO is assigned to "Direct",
    // then all remaining DOs for that same consignee must also be assigned to "Direct".
    const violations = [];

    Object.values(consigneeMap).forEach(group => {
        if (group.items.length > 1) {
            const hasDirect = group.items.some(item => item.isDirect);
            if (hasDirect) {
                const nonDirectItems = group.items.filter(item => !item.isDirect);
                if (nonDirectItems.length > 0) {
                    const directItems = group.items.filter(item => item.isDirect);
                    violations.push({
                        consignee: group.name,
                        totalDos: group.items.length,
                        directItems: directItems,
                        problematicItems: nonDirectItems
                    });
                }
            }
        }
    });

    return {
        isValid: violations.length === 0,
        violations: violations
    };
};

window.renderVerificationErrors = function(violations) {
    const container = document.getElementById('verificationErrorList');
    if (!container) return;

    let html = '';
    violations.forEach((v, idx) => {
        const directListHtml = v.directItems.map(d => 
            `<div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px; font-size: 12px; margin-bottom: 4px;">
                <div>
                    <strong style="color: var(--fg); font-family: monospace;">${d.displayInv}</strong>
                    <span style="color: var(--fg-muted); margin-left: 6px;">(${d.truckLabel} • ${d.dropLabel})</span>
                </div>
                <span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">Direct</span>
            </div>`
        ).join('');

        const problematicListHtml = v.problematicItems.map(d => 
            `<div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 6px; font-size: 12px; margin-bottom: 4px;">
                <div>
                    <strong style="color: #ef4444; font-family: monospace;">${d.displayInv}</strong>
                    <span style="color: var(--fg-muted); margin-left: 6px;">(${d.truckLabel} • ${d.dropLabel})</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">Assigned: ${d.status}</span>
                    <span style="font-size: 11px; color: #f59e0b; font-weight: 600;">→ Must be Direct</span>
                </div>
            </div>`
        ).join('');

        html += `
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 22px; height: 22px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">${idx + 1}</span>
                        <strong style="font-size: 13px; color: var(--fg);">${v.consignee}</strong>
                    </div>
                    <span style="font-size: 11px; color: var(--fg-muted); background: var(--surface-hover); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border);">${v.totalDos} Total DOs</span>
                </div>

                <div style="margin-bottom: 8px;">
                    <div style="font-size: 11px; font-weight: 600; color: #60a5fa; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Assigned as Direct (${v.directItems.length}):
                    </div>
                    ${directListHtml}
                </div>

                <div>
                    <div style="font-size: 11px; font-weight: 600; color: #ef4444; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Conflicting Non-Direct DOs (${v.problematicItems.length}):
                    </div>
                    ${problematicListHtml}
                </div>
            </div>`;
    });

    container.innerHTML = html;
};

// Internal function to render and show final plan after verification passes
window.renderAndShowFinalPlanModal = function() {
    const modal = document.getElementById('finalPlanModal');
    const content = document.getElementById('finalPlanContent');
    if (!modal || !content) return;
    
    let html = '<div class="manifest-plan-container" style="font-family: Aptos Display, sans-serif; font-size: 1.05rem; line-height: 1.5; color: var(--fg); background: var(--surface); padding: 16px; border-radius: 8px; border: 1px solid var(--border);">';
    
    const truckKeys = Object.keys(trucks);
    if (truckKeys.length === 0) {
        html += 'No trucks planned yet.';
    } else {
        const truckBlocks = [];

        // Helper to format DO items (both regular and split DOs with model/quantity breakdown, fractions e.g. 1/2, 2/2, and distinct DO hubs)
        const formatDoListForManifest = (list, indent = "      ") => {
            if (!list || list.length === 0) return "";

            const lines = [];
            const regularDos = [];

            const flushRegularDos = () => {
                if (regularDos.length > 0) {
                    lines.push(`${indent}<b style="color: black;">DO: ${regularDos.join(', ')}</b>`);
                    regularDos.length = 0;
                }
            };

            list.forEach(d => {
                const splitInfo = getDoSplitInfo(d);
                const invText = splitInfo.isSplit ? splitInfo.displayInv : (d.remark ? `${d.inv} ${d.remark}` : d.inv);
                const hasHub = Boolean(d.hub && d.hub !== "N/A" && d.hub.trim() !== "");
                const hasItemBreakdown = Boolean(d.remark && /\bx\s*\d+/i.test(d.remark));

                if (!hasHub && !hasItemBreakdown) {
                    regularDos.push(invText);
                } else {
                    flushRegularDos();

                    if (hasHub) {
                        const trimmed = d.hub.trim().toUpperCase();
                        const hubFormatted = trimmed.startsWith("HUB") ? trimmed : `HUB${trimmed}`;
                        const effectiveQty = (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0));
                        const hubBadge = `<b style="color: navy;"><i>(${hubFormatted})</i></b>`;
                        const qtyBadge = `<b style="color: black; margin-left: 10px;">[Total: ${effectiveQty.toLocaleString()} pcs]</b>`;

                        lines.push(`${indent}<b style="color: black;">DO: ${invText}</b>`);
                        lines.push(`${indent}${hubBadge} ${qtyBadge}`);
                    } else {
                        lines.push(`${indent}<b style="color: black;">DO: ${invText}</b>`);
                    }

                    if (hasItemBreakdown) {
                        const parts = d.remark.split(',').map(s => s.trim()).filter(Boolean);
                        parts.forEach(p => {
                            const match = p.match(/^(.+?)\s*x\s*(\d+)$/i);
                            if (match) {
                                const model = match[1].trim();
                                const pcs = match[2].trim();
                                lines.push(`${indent}       ${model} : ${pcs} pcs`);
                            } else {
                                lines.push(`${indent}       ${p}`);
                            }
                        });
                    }
                }
            });

            flushRegularDos();
            return lines.join('\n');
        };

        truckKeys.forEach((tId, index) => {
            const assignedList = trucks[tId] || [];
            const meta = (typeof truckMeta !== 'undefined' && truckMeta[tId]) ? truckMeta[tId] : { size: "40HC", dropMode: "single", hub: "", dest: "", hub2: "", dest2: "" };
            const isTwoDrop = meta.dropMode === 'two_drop';
            const hasCrossDock = assignedList.some(d => d.tag === 'cross_dock');
            const isPureCrossDock = hasCrossDock && assignedList.every(d => d.tag === 'cross_dock') && !meta.dest;
            const sizeNumMatch = meta.size ? meta.size.match(/\d+/) : null;
            const sizeStr = sizeNumMatch ? sizeNumMatch[0] : (meta.size || "40");
            const totalQty = assignedList.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
            const totalQtyStr = `<b style="color: black; margin-left: 10px;">[Total: ${totalQty.toLocaleString()} pcs]</b>`;

            const formatHub = (rawHub, defaultLabel = "HUB NUMBER") => {
                let hubText = `(${defaultLabel})`;
                if (rawHub) {
                    const trimmed = rawHub.trim().toUpperCase();
                    const hubName = trimmed.startsWith("HUB") ? trimmed : `HUB${trimmed}`;
                    hubText = `(${hubName})`;
                }
                return `<b style="color: navy;"><i>${hubText}</i></b>`;
            };

            let block = "";
            const hasHub = (d) => Boolean(d.hub && d.hub !== "N/A" && d.hub.trim() !== "");
            const status1 = meta.status || 'Direct';
            const status2 = meta.status2 || 'Direct';
            const routes1 = Array.isArray(meta.routes) ? meta.routes : [];
            const routes2 = Array.isArray(meta.routes2) ? meta.routes2 : [];

            if (isPureCrossDock) {
                const destStr = meta.dest ? `(${meta.dest.trim().toUpperCase()}) ` : '';
                block += `(${index + 1}) 1 x ${sizeStr} ${destStr} <b style="color: red;">(Top Urgent)</b>\n`;
                block += `${formatHub(meta.hub)} ${totalQtyStr}\n`;
                block += `ALL 5 ROUTES`;
            } else if (!isTwoDrop) {
                // Single Drop
                const destStr = meta.dest ? `(${meta.dest.trim().toUpperCase()})` : '(Destination)';
                const listToRender = meta.hideDoList ? assignedList.filter(hasHub) : assignedList;
                const doLines = formatDoListForManifest(listToRender, "");
                const s1Formatted = status1 === 'Top Urgent' ? `<b style="color: red;">(Top Urgent)</b>` : (status1 === 'Direct' ? `<b style="color: blue;">(Direct)</b>` : `(${status1})`);
                block += `(${index + 1}) 1 x ${sizeStr} ${destStr} ${s1Formatted}\n`;
                block += `${formatHub(meta.hub)} ${totalQtyStr}`;
                if (status1 === 'Top Urgent' && routes1.length > 0) {
                    block += `\n${routes1.join(', ')}`;
                }
                if (doLines && doLines.trim()) {
                    block += `\n${doLines}`;
                }
            } else {
                // Two Drops (1st Drop & 2nd Drop)
                const drop1List = assignedList.filter(d => (d.dropSeq || 1) === 1);
                const drop2List = assignedList.filter(d => d.dropSeq === 2);
                const drop1Qty = drop1List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop2Qty = drop2List.reduce((sum, d) => sum + (typeof getDoEffectiveQty === 'function' ? getDoEffectiveQty(d) : (d.qty || 0)), 0);
                const drop1QtyStr = `<b style="color: black; margin-left: 10px;">[Total: ${drop1Qty.toLocaleString()} pcs]</b>`;
                const drop2QtyStr = `<b style="color: black; margin-left: 10px;">[Total: ${drop2Qty.toLocaleString()} pcs]</b>`;
                const dest1Str = meta.dest ? `(${meta.dest.trim().toUpperCase()})` : '(Destination 1)';
                const hub1Str = formatHub(meta.hub, "HUB 1");
                const drop1ListToRender = meta.hideDoList ? drop1List.filter(hasHub) : drop1List;
                const do1Lines = formatDoListForManifest(drop1ListToRender, "      ");
                const dest2Str = meta.dest2 ? `(${meta.dest2.trim().toUpperCase()})` : '(Destination 2)';
                const hub2Str = formatHub(meta.hub2, "HUB 2");
                const drop2ListToRender = meta.hideDoList ? drop2List.filter(hasHub) : drop2List;
                const do2Lines = formatDoListForManifest(drop2ListToRender, "      ");
                const headerTypeStr = (status1 === status2 && status1 === 'Direct') ? 'Direct (2 Drops)' : '2 Drops';
                const status1Suffix = (status1 !== 'Direct' || status1 !== status2) ? (status1 === 'Top Urgent' ? ` <b style="color: red;">(Top Urgent)</b>` : (status1 === 'Direct' ? ` <b style="color: blue;">(Direct)</b>` : ` (${status1})`)) : '';
                const status2Suffix = (status2 !== 'Direct' || status1 !== status2) ? (status2 === 'Top Urgent' ? ` <b style="color: red;">(Top Urgent)</b>` : (status2 === 'Direct' ? ` <b style="color: blue;">(Direct)</b>` : ` (${status2})`)) : '';

                block += `(${index + 1}) 1 x ${sizeStr} (${headerTypeStr})\n`;
                block += `   [1ST DROP] -> ${dest1Str} | ${hub1Str}${status1Suffix} ${drop1QtyStr}`;
                if (status1 === 'Top Urgent' && routes1.length > 0) {
                    block += `\n      ${routes1.join(', ')}`;
                }
                if (do1Lines && do1Lines.trim()) {
                    block += `\n${do1Lines}`;
                }
                block += `\n   [2ND DROP] -> ${dest2Str} | ${hub2Str}${status2Suffix} ${drop2QtyStr}`;
                if (status2 === 'Top Urgent' && routes2.length > 0) {
                    block += `\n      ${routes2.join(', ')}`;
                }
                if (do2Lines && do2Lines.trim()) {
                    block += `\n${do2Lines}`;
                }
            }

            truckBlocks.push('<div class="manifest-truck-entry" style="margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; white-space: pre-wrap;">' + block + '</div>');
        });

        html += truckBlocks.join('');
    }
    
    html += '</div>';
    
    content.innerHTML = html;
    modal.style.display = 'flex';
};

window.closeFinalPlan = function() {
    const modal = document.getElementById('finalPlanModal');
    if (modal) modal.style.display = 'none';
};

// Main trigger when user clicks "View Final Plan"
window.showFinalPlan = function() {
    const verifyingModal = document.getElementById('finalPlanVerifyingModal');
    const progressBar = document.getElementById('verifyingProgressBar');

    if (verifyingModal) {
        if (progressBar) progressBar.style.width = '20%';
        verifyingModal.style.display = 'flex';
        
        setTimeout(() => {
            if (progressBar) progressBar.style.width = '70%';
        }, 150);
        
        setTimeout(() => {
            if (progressBar) progressBar.style.width = '100%';
            
            setTimeout(() => {
                verifyingModal.style.display = 'none';
                
                // Run verification
                const check = window.verifyDoAssignments();
                if (!check.isValid) {
                    window.renderVerificationErrors(check.violations);
                    const errorModal = document.getElementById('finalPlanVerificationErrorModal');
                    if (errorModal) errorModal.style.display = 'flex';
                } else {
                    window.renderAndShowFinalPlanModal();
                }
            }, 250);
        }, 350);
    } else {
        // Fallback without verifying modal
        const check = window.verifyDoAssignments();
        if (!check.isValid) {
            window.renderVerificationErrors(check.violations);
            const errorModal = document.getElementById('finalPlanVerificationErrorModal');
            if (errorModal) errorModal.style.display = 'flex';
        } else {
            window.renderAndShowFinalPlanModal();
        }
    }
};

window.printFinalPlan = function() {
    const content = document.getElementById('finalPlanContent').innerHTML;
    
    // Create a hidden iframe to hold the print content
    let printIframe = document.getElementById('print-iframe');
    if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'print-iframe';
        printIframe.style.position = 'absolute';
        printIframe.style.width = '0px';
        printIframe.style.height = '0px';
        printIframe.style.border = 'none';
        document.body.appendChild(printIframe);
    }
    
    const doc = printIframe.contentWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><title>Print Truck Plan</title>');
    doc.write('<style>');
    doc.write('@page { size: landscape; margin: 10mm 12mm; }');
    doc.write('* { box-sizing: border-box; }');
    doc.write('body { font-family: Aptos Display, "Segoe UI", Arial, sans-serif; font-size: 12.5px; line-height: 1.45; margin: 0; padding: 12px; color: black; background: #fff; }');
    doc.write('.manifest-plan-container { columns: 2; column-gap: 32px; column-fill: auto; width: 100%; border: none !important; padding: 0 !important; background: transparent !important; }');
    doc.write('.manifest-truck-entry { break-inside: avoid-page; page-break-inside: avoid; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px dashed #cbd5e1; white-space: pre-wrap; display: inline-block; width: 100%; }');
    doc.write('.manifest-truck-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }');
    doc.write('@media print {');
    doc.write('  body { padding: 0; font-size: 12px; line-height: 1.4; }');
    doc.write('  .manifest-plan-container { columns: 2; column-gap: 28px; width: 100%; }');
    doc.write('  .manifest-truck-entry { break-inside: avoid; page-break-inside: avoid; margin-bottom: 16px; padding-bottom: 10px; }');
    doc.write('}');
    doc.write('</style>');
    doc.write('</head><body>');
    doc.write(content);
    doc.write('</body></html>');
    doc.close();
    
    // Focus the iframe and trigger print
    setTimeout(() => {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
    }, 250);
};

// --- Split DO Logic ---
window.openSplitModal = function(doInv) {
    // Find the DO
    
    let doObj = unassignedDOs.find(d => String(d.inv) === String(doInv));
    let parentTruckId = null;
    
    if (!doObj) {
        for (let tId in trucks) {
            doObj = trucks[tId].find(d => String(d.inv) === String(doInv));
            if (doObj) {
                parentTruckId = tId;
                break;
            }
        }
    }
    
    if (!doObj) {
        console.error("DO not found for splitting: " + doInv);
        return;
    }
    
    // Store parentTruckId globally so confirmSplit knows where to put the child
    window.currentSplitParentTruck = parentTruckId;


    // Create modal if it doesn't exist — styled to match the Summary Generator
    // dialog anatomy (overlay blur, icon badge, structured header/body/footer).
    let modal = document.getElementById('splitDoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'splitDoModal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.6);
            backdrop-filter: blur(8px); display: flex; align-items: center;
            justify-content: center; z-index: 10000; padding: 20px;
        `;
        // Backdrop click closes (only when clicking the overlay itself)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
        // Escape key closes while open
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') modal.style.display = 'none';
        });
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';

    // Load this DO's real line items to power the Model dropdown.
    const items = getDoLineItems(doObj.inv);

    modal.innerHTML = `
        <div style="background: var(--surface-card, var(--bg-elevated)); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 520px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px var(--border); overflow: hidden; display: flex; flex-direction: column; max-height: 90vh;">
            <!-- Header: icon badge + title + subtitle + close -->
            <div style="padding: 18px 22px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; background: var(--surface-hover, transparent); flex-shrink: 0;">
                <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--accent-glow, rgba(94,106,210,0.12)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border-accent, rgba(94,106,210,0.25)); color: var(--accent, #5E6AD2);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M8 3H3v5"></path><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.828L3 3"></path><path d="M15 16l6-6"></path></svg>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--fg);">Split Delivery Order</h3>
                    <div style="font-size: 11px; color: var(--fg-muted); margin-top: 2px;">Splitting <strong style="color: var(--fg-subtle);">${doObj.inv}</strong> into a partial piece</div>
                </div>
                <button type="button" onclick="document.getElementById('splitDoModal').style.display='none'" style="background: none; border: none; color: var(--fg-muted); font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px; line-height: 1;" title="Close">✕</button>
            </div>
            <!-- Body: Model + Quantity rows -->
            <div style="padding: 20px 22px; font-size: 13px; color: var(--fg-subtle, var(--fg)); line-height: 1.6; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label style="font-size: 12px; color: var(--fg-muted); font-weight: 600;">Items to split off</label>
                    <button type="button" id="splitAddRowBtn" style="background: var(--accent-glow, rgba(94,106,210,0.12)); border: 1px solid var(--border-accent, rgba(94,106,210,0.25)); color: var(--accent, #5E6AD2); font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                        <span style="font-size: 14px; line-height: 1;">+</span> Add model
                    </button>
                </div>
                <div id="splitRowsContainer" style="display: flex; flex-direction: column; gap: 10px;"></div>
                <p style="margin: 12px 0 0; font-size: 11px; color: var(--fg-muted);">Note: Quantity will remain on the parent DO.</p>
            </div>
            <!-- Footer: right-aligned Cancel + Confirm -->
            <div style="padding: 14px 22px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; background: var(--surface-hover, transparent); flex-shrink: 0;">
                <button type="button" class="action-btn" style="font-size: 12px; font-weight: 600; padding: 8px 18px; border-radius: 8px; background: var(--surface, transparent); color: var(--fg); border: 1px solid var(--border); cursor: pointer;" onclick="document.getElementById('splitDoModal').style.display='none'">Cancel</button>
                <button type="button" class="action-btn primary" style="font-size: 12px; font-weight: 700; padding: 8px 20px; border-radius: 8px; box-shadow: 0 4px 12px var(--accent-glow, rgba(94,106,210,0.3)); cursor: pointer;" onclick="confirmSplit('${doObj.inv}')">Create Split</button>
            </div>
        </div>
    `;

    // Build the dynamic Model + Quantity rows (one by default)
    window._splitDoItems = items;               // line items available on this DO
    window._splitDoHasItems = items.length > 0; // whether we can use a real dropdown
    addSplitRow();                              // start with a single row
    document.getElementById('splitAddRowBtn').addEventListener('click', () => addSplitRow());

    // Autofocus the first interactive control
    setTimeout(() => {
        const first = modal.querySelector('#splitRowsContainer select, #splitRowsContainer input');
        if (first) first.focus();
    }, 50);
}

// ── Helpers for the structured Split dialog ────────────────────────────────
// Load the real line items (code/desc/qty) for a DO, deducting any quantities already split out
function getDoLineItems(doInv) {
    try {
        const RouteMasterData = JSON.parse(mtpGet("MtpRouteData", "LastUploadedRouteData")) || {};
        
        const isChildDo = String(doInv).includes('-');
        const baseParentInv = String(doInv).split('-')[0];
        
        // Find all active DOs across unassigned pool and all trucks
        const allActiveDos = [...unassignedDOs];
        Object.values(trucks).forEach(list => allActiveDos.push(...list));

        if (isChildDo) {
            // If splitting a child DO directly, extract items from its own remark
            const targetChild = allActiveDos.find(d => String(d.inv) === String(doInv));
            if (!targetChild || !targetChild.remark) return [];
            
            const childItems = [];
            const parts = targetChild.remark.split(',').map(s => s.trim()).filter(Boolean);
            parts.forEach(p => {
                const match = p.match(/^(.+?)\s*x\s*(\d+)$/i);
                if (match) {
                    childItems.push({ code: match[1].trim(), desc: '', qty: parseInt(match[2], 10) || 0 });
                } else {
                    childItems.push({ code: p, desc: '', qty: targetChild.qty || 1 });
                }
            });
            return childItems;
        }

        // Parent DO lookup:
        const rec = RouteMasterData[doInv] || RouteMasterData[baseParentInv];
        const rawItems = (rec && Array.isArray(rec.items)) ? rec.items : [];
        
        // Aggregate original line items by code
        const map = {};
        rawItems.forEach(it => {
            if (!it.code) return;
            const key = it.code;
            const q = (it.qty && !isNaN(it.qty)) ? parseInt(it.qty, 10) : 0;
            if (!map[key]) map[key] = { code: it.code, desc: it.desc || '', qty: 0 };
            map[key].qty += q;
        });

        // Find all existing sibling split DOs for this parent DO (e.g. 81529063-A, 81529063-B)
        const siblingPrefix = `${doInv}-`;
        const existingSplits = allActiveDos.filter(d => String(d.inv).startsWith(siblingPrefix));

        const usedQtyMap = {};
        existingSplits.forEach(splitDo => {
            if (splitDo.remark) {
                const parts = splitDo.remark.split(',').map(s => s.trim()).filter(Boolean);
                parts.forEach(p => {
                    const match = p.match(/^(.+?)\s*x\s*(\d+)$/i);
                    if (match) {
                        const code = match[1].trim();
                        const pcs = parseInt(match[2], 10) || 0;
                        usedQtyMap[code] = (usedQtyMap[code] || 0) + pcs;
                    }
                });
            }
        });

        // Compute net remaining available items
        const availableItems = [];
        Object.values(map).forEach(it => {
            const used = usedQtyMap[it.code] || 0;
            const remaining = Math.max(0, it.qty - used);
            if (remaining > 0) {
                availableItems.push({
                    code: it.code,
                    desc: it.desc,
                    qty: remaining,
                    originalQty: it.qty
                });
            }
        });

        return availableItems;
    } catch (e) {
        console.error("Error computing dynamic DO line items:", e);
        return [];
    }
}

// Append one Model + Quantity row to the split dialog.
// Each row supports TWO input modes, switchable via the toggle button:
//   'dropdown' → pick a model from the DO's remaining available line items
//   'manual'   → free-text model entry (works even when route data exists)
function addSplitRow() {
    const container = document.getElementById('splitRowsContainer');
    if (!container) return;
    const items = window._splitDoItems || [];
    const hasItems = window._splitDoHasItems;

    const row = document.createElement('div');
    row.className = 'split-row';
    row.dataset.mode = hasItems ? 'dropdown' : 'manual';
    row.style.cssText = 'display: flex; gap: 8px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;';

    const inputBase = 'background: var(--bg); border: 1px solid var(--border); color: var(--fg); border-radius: 8px; padding: 8px 10px; font-size: 13px; outline: none; font-family: inherit;';
    const stepBtn = 'width: 28px; height: 28px; border-radius: 6px; background: var(--surface-hover); border: 1px solid var(--border); color: var(--fg); font-size: 15px; line-height: 1; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;';
    const toggleBtnStyle = 'background: var(--surface-hover); border: 1px solid var(--border); color: var(--fg-muted); font-size: 11px; font-weight: 700; padding: 5px 9px; border-radius: 6px; cursor: pointer; white-space: nowrap; flex-shrink: 0;';

    // Build options showing current remaining stock
    const opts = ['<option value="" disabled selected>Select model…</option>']
        .concat(items.map((it, i) => `<option value="${i}">${it.code}${it.desc ? ' — ' + it.desc : ''} (${it.qty} avail)</option>`));
    const dropdownHtml = `<select class="split-model" style="${inputBase} flex: 1; min-width: 0; ${hasItems ? '' : 'display:none;'}">${opts.join('')}</select>`;
    const manualHtml = `<input type="text" class="split-model-text" placeholder="Model code (e.g., KD-65X85L)" style="${inputBase} flex: 1; min-width: 0; ${hasItems ? 'display:none;' : ''}">`;
    const toggleHtml = hasItems
        ? `<button type="button" class="split-mode-toggle" title="Switch between dropdown and manual entry" style="${toggleBtnStyle}">✎ Manual</button>`
        : '';

    row.innerHTML = `
        ${toggleHtml}
        ${dropdownHtml}
        ${manualHtml}
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <button type="button" class="split-qty-minus" style="${stepBtn}" title="Decrease">−</button>
            <input type="number" class="split-qty" min="1" value="1" style="${inputBase} width: 64px; text-align: center; -moz-appearance: textfield;">
            <button type="button" class="split-qty-plus" style="${stepBtn}" title="Increase">+</button>
        </div>
        <span class="split-avail" style="font-size: 11px; color: #fbbf24; font-weight: 600; white-space: nowrap; min-width: 54px; text-align: right;"></span>
        <button type="button" class="split-row-del" title="Remove row" style="background: none; border: none; color: var(--fg-muted); cursor: pointer; padding: 4px; border-radius: 6px; flex-shrink: 0; line-height: 1; font-size: 15px;">🗑</button>
    `;

    // Wire interactions
    const qtyInput = row.querySelector('.split-qty');
    const availEl = row.querySelector('.split-avail');
    const modelSel = row.querySelector('.split-model');
    const modelTxt = row.querySelector('.split-model-text');
    const toggleBtn = row.querySelector('.split-mode-toggle');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const toManual = row.dataset.mode === 'dropdown';
            row.dataset.mode = toManual ? 'manual' : 'dropdown';
            modelSel.style.display = toManual ? 'none' : '';
            modelTxt.style.display = toManual ? '' : 'none';
            toggleBtn.textContent = toManual ? '▾ List' : '✎ Manual';
            if (toManual) { modelTxt.focus(); availEl.textContent = ''; }
            else { refreshAvail(); clampQty(); }
        });
    }

    const isManualMode = () => row.dataset.mode === 'manual';

    const currentMax = () => {
        if (isManualMode() || !hasItems || !modelSel) return Infinity;
        const it = items[parseInt(modelSel.value, 10)];
        return (it && it.qty > 0) ? it.qty : Infinity;
    };
    const refreshAvail = () => {
        if (isManualMode() || !hasItems || !modelSel) { availEl.textContent = ''; return; }
        const it = items[parseInt(modelSel.value, 10)];
        availEl.textContent = it && it.qty > 0 ? `avail: ${it.qty.toLocaleString()}` : '';
    };
    const clampQty = () => {
        let v = parseInt(qtyInput.value, 10);
        if (isNaN(v) || v < 1) v = 1;
        const mx = currentMax();
        if (v > mx) v = mx;
        qtyInput.value = v;
    };

    if (modelSel) modelSel.addEventListener('change', () => { refreshAvail(); clampQty(); });
    row.querySelector('.split-qty-minus').addEventListener('click', () => { qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1); });
    row.querySelector('.split-qty-plus').addEventListener('click', () => { qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + 1; clampQty(); });
    qtyInput.addEventListener('change', clampQty);
    row.querySelector('.split-row-del').addEventListener('click', () => {
        if (container.querySelectorAll('.split-row').length > 1) row.remove();
        else showToast('At least one item is required.', 'warning');
    });

    // Enter inside the qty field submits
    qtyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); document.querySelector('#splitDoModal .action-btn.primary').click(); }
    });
    // Enter inside the manual text field submits too
    if (modelTxt) modelTxt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); document.querySelector('#splitDoModal .action-btn.primary').click(); }
    });

    container.appendChild(row);
    refreshAvail();
}


window.confirmSplit = function(doInv) {
    // Build the remark from the structured Model + Quantity rows.
    const items = window._splitDoItems || [];
    const rows = Array.from(document.querySelectorAll('#splitRowsContainer .split-row'));

    const parts = [];
    let splitTotalQty = 0;
    for (const row of rows) {
        let code = '';
        const isManual = row.dataset.mode === 'manual';
        if (isManual) {
            const txt = row.querySelector('.split-model-text');
            code = txt ? txt.value.trim() : '';
            if (!code) { showToast('Please enter a model code for every manual row.', 'warning'); return; }
        } else {
            const sel = row.querySelector('.split-model');
            const it = sel ? items[parseInt(sel.value, 10)] : null;
            if (!it) { showToast('Please select a model for every row.', 'warning'); return; }
            code = it.code;
        }
        let qty = parseInt(row.querySelector('.split-qty').value, 10);
        if (isNaN(qty) || qty < 1) { showToast('Quantity must be at least 1.', 'warning'); return; }
        splitTotalQty += qty;
        parts.push(`${code} x ${qty}`);
    }

    const remarkInput = parts.join(', ');
    if (!remarkInput) {
        showToast("Please add at least one model and quantity.", "warning");
        return;
    }

    let parentArr = unassignedDOs;
    if (window.currentSplitParentTruck && trucks[window.currentSplitParentTruck]) {
        parentArr = trucks[window.currentSplitParentTruck];
    }

    const parentIdx = parentArr.findIndex(d => String(d.inv) === String(doInv));
    if (parentIdx === -1) return;
    
    const parentDo = parentArr[parentIdx];
    
    // Create a suffix (e.g., -A, -B)
    let suffixCode = 65; // 'A'
    let newInv = `${parentDo.inv}-${String.fromCharCode(suffixCode)}`;
    
    // Check if it exists, increment suffix if so (looks through unassigned and trucks)
    const checkExists = (inv) => {
        if (unassignedDOs.some(d => String(d.inv) === inv)) return true;
        for (let tId in trucks) {
            if (trucks[tId].some(d => String(d.inv) === inv)) return true;
        }
        return false;
    };
    
    while (checkExists(newInv)) {
        suffixCode++;
        newInv = `${parentDo.inv}-${String.fromCharCode(suffixCode)}`;
    }
    
    // Deduct splitTotalQty from parent if parent has quantity
    if (typeof parentDo.qty === 'number' && parentDo.qty >= splitTotalQty) {
        parentDo.qty = Math.max(0, parentDo.qty - splitTotalQty);
    }
    
    // Create the child DO with the split quantity
    const childDo = {
        inv: newInv,
        name: parentDo.name,
        vol: 0,
        qty: splitTotalQty,
        remark: remarkInput,
        tag: parentDo.tag,
        hub: parentDo.hub,
        dropSeq: parentDo.dropSeq || 1
    };
    
    // Push child right after parent
    parentArr.splice(parentIdx + 1, 0, childDo);
    
    document.getElementById('splitDoModal').style.display = 'none';
    renderUnassignedDOs();
    renderTruckBoards();
    if (window._isTruckPlanViewOpen) {
        renderTruckPlanCanvas();
    }
    saveState();
};

// ============================================================================
// --- LARGE SCREEN TRUCK PLAN VIEW & ROUTE TRANSIT SIMULATOR ---
// ============================================================================

window._mtpSimSpeed = 1;
window._mtpSimPaused = false;
window._isTruckPlanViewOpen = false;

window.toggleTruckPlanView = function() {
    const standardView = document.getElementById("standardFleetView");
    const canvasView = document.getElementById("truckPlanCanvasView");
    const toggleLabel = document.getElementById("truckPlanToggleLabel");
    const toggleBtn = document.getElementById("btnTruckPlanToggle");
    
    if (!standardView || !canvasView) return;
    
    window._isTruckPlanViewOpen = !window._isTruckPlanViewOpen;
    
    if (window._isTruckPlanViewOpen) {
        standardView.style.display = "none";
        canvasView.style.display = "flex";
        if (toggleLabel) toggleLabel.textContent = "Exit Plan View";
        if (toggleBtn) {
            toggleBtn.style.background = "var(--surface)";
            toggleBtn.style.color = "var(--fg)";
            toggleBtn.style.borderColor = "var(--border)";
        }
        renderTruckPlanCanvas();
    } else {
        standardView.style.display = "flex";
        canvasView.style.display = "none";
        if (toggleLabel) toggleLabel.textContent = "Truck Plan View";
        if (toggleBtn) {
            toggleBtn.style.background = "linear-gradient(135deg, rgba(94, 106, 210, 0.15), rgba(56, 189, 248, 0.15))";
            toggleBtn.style.color = "#38bdf8";
            toggleBtn.style.borderColor = "rgba(56, 189, 248, 0.35)";
        }
        renderTruckBoards();
        renderUnassignedDOs();
    }
};

window.toggleTruckSimulation = function() {
    window._mtpSimPaused = !window._mtpSimPaused;
    const container = document.getElementById("truckPlanLanesContainer");
    const icon = document.getElementById("simPlayIcon");
    const text = document.getElementById("simPlayText");
    
    if (container) {
        if (window._mtpSimPaused) {
            container.classList.add("sim-paused");
            if (icon) icon.textContent = "▶";
            if (text) text.textContent = "Play";
        } else {
            container.classList.remove("sim-paused");
            if (icon) icon.textContent = "⏸";
            if (text) text.textContent = "Pause";
        }
    }
};

window.setTruckSimSpeed = function(multiplier) {
    window._mtpSimSpeed = multiplier;
    document.querySelectorAll(".sim-speed-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`btnSpeed${multiplier}x`);
    if (activeBtn) activeBtn.classList.add("active");
    
    // Update active vehicles animation duration
    const baseDuration = 10; // seconds for single loop
    const newDuration = (baseDuration / multiplier).toFixed(2);
    document.querySelectorAll(".moving-truck-vehicle").forEach(vehicle => {
        vehicle.style.animationDuration = `${newDuration}s`;
    });
};

window.toggleFullscreenCanvas = function() {
    const canvasView = document.getElementById("truckPlanCanvasView");
    if (!canvasView) return;
    
    if (!document.fullscreenElement) {
        if (canvasView.requestFullscreen) {
            canvasView.requestFullscreen();
        } else if (canvasView.webkitRequestFullscreen) {
            canvasView.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};

window.renderTruckPlanCanvas = function() {
    const container = document.getElementById("truckPlanLanesContainer");
    if (!container) return;
    
    const filterEl = document.getElementById("canvasStatusFilter");
    const filterStatus = filterEl ? filterEl.value : "ALL";
    
    const truckKeys = Object.keys(trucks);
    if (truckKeys.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--fg-muted);">
                <div style="font-size: 3rem; margin-bottom: 12px;">🚚</div>
                <h3 style="font-size: 1.1rem; color: var(--fg); margin-bottom: 6px;">No Trucks in Plan Yet</h3>
                <p style="font-size: 0.85rem; max-width: 400px; margin: 0 auto 16px;">Add trucks or load route data to start the interactive highway transit visualization.</p>
                <button onclick="addTruck(); renderTruckPlanCanvas();" class="action-btn primary" style="padding: 8px 18px; font-weight: 600;">+ Add First Truck</button>
            </div>
        `;
        return;
    }
    
    let html = "";
    const baseDuration = (10 / (window._mtpSimSpeed || 1)).toFixed(2);
    
    truckKeys.forEach((tId, index) => {
        const assignedList = trucks[tId] || [];
        const meta = (typeof truckMeta !== 'undefined' && truckMeta[tId]) ? truckMeta[tId] : { size: "40HC", dropMode: "single", status: "Direct", hub: "", dest: "", status2: "Direct", hub2: "", dest2: "" };
        const isTwoDrop = meta.dropMode === 'two_drop';
        const status1 = meta.status || "Direct";
        const status2 = meta.status2 || "Direct";
        
        // Status Filter Check
        if (filterStatus !== "ALL" && status1 !== filterStatus && (!isTwoDrop || status2 !== filterStatus)) {
            return;
        }
        
        const totalQty = assignedList.reduce((sum, d) => sum + (d.qty || 0), 0);
        const totalVol = assignedList.reduce((sum, d) => sum + (d.vol || 0), 0);
        
        const drop1List = assignedList.filter(d => (d.dropSeq || 1) === 1);
        const drop2List = assignedList.filter(d => d.dropSeq === 2);
        const drop1Qty = drop1List.reduce((sum, d) => sum + (d.qty || 0), 0);
        const drop2Qty = drop2List.reduce((sum, d) => sum + (d.qty || 0), 0);
        
        const hub1Label = meta.hub ? (meta.hub.toUpperCase().startsWith("HUB") ? meta.hub.toUpperCase() : `HUB${meta.hub.toUpperCase()}`) : "ORIGIN HUB";
        const dest1Label = meta.dest ? meta.dest.toUpperCase() : "1ST DROP DESTINATION";
        const hub2Label = meta.hub2 ? (meta.hub2.toUpperCase().startsWith("HUB") ? meta.hub2.toUpperCase() : `HUB${meta.hub2.toUpperCase()}`) : "HUB 2";
        const dest2Label = meta.dest2 ? meta.dest2.toUpperCase() : "2ND DROP DESTINATION";
        
        // Color tokens
        const getStatusColor = (st) => st === 'Top Urgent' ? '#f87171' : (st === 'Stuffing' ? '#fbbf24' : '#38bdf8');
        const status1Color = getStatusColor(status1);
        const status2Color = getStatusColor(status2);
        const animName = isTwoDrop ? "driveTruckTwoDrop" : "driveTruckSingleDrop";
        
        // Build DO chips for the bottom drawer
        let doChipsHtml = "";
        assignedList.forEach(d => {
            const dropTag = isTwoDrop ? `<span style="font-size: 0.65rem; padding: 1px 4px; border-radius: 3px; background: ${(d.dropSeq === 2) ? 'rgba(192,132,252,0.2)' : 'rgba(56,189,248,0.2)'}; color: ${(d.dropSeq === 2) ? '#c084fc' : '#38bdf8'}; font-weight: 700;">D${d.dropSeq || 1}</span>` : "";
            const remarkTag = d.remark ? `<span style="color: #fbbf24; font-size: 0.7rem; font-weight: 600;">${d.remark}</span>` : '';
            doChipsHtml += `
                <span class="badge" title="${d.name} (${(d.qty || 0).toLocaleString()} pcs)" style="background: var(--surface); color: var(--fg); border: 1px solid var(--border); font-size: 0.73rem; padding: 3px 8px; display: inline-flex; align-items: center; gap: 5px;">
                    ${dropTag}
                    <strong style="color: var(--fg-subtle);">${d.inv}</strong>
                    ${remarkTag}
                    ${d.qty ? `<span style="color: var(--fg-muted); font-family: Aptos Display, sans-serif;">${(d.qty || 0).toLocaleString()} pcs</span>` : ''}
                </span>
            `;
        });
        if (assignedList.length === 0) {
            doChipsHtml = `<span style="font-size: 0.75rem; color: var(--fg-muted); font-style: italic;">No Delivery Orders loaded yet.</span>`;
        }

        html += `
            <div class="glass-card" style="padding: 16px 20px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface-card, #12131a); display: flex; flex-direction: column; gap: 14px; transition: border-color 0.2s;">
                
                <!-- Truck Route Header Row -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <span style="font-size: 1.05rem; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">TRUCK ${index + 1}</span>
                        <span class="badge" style="background: rgba(255,255,255,0.08); color: var(--fg); font-weight: 700; font-size: 0.75rem; padding: 3px 8px; border: 1px solid var(--border);">${meta.size || '40HC'}</span>
                        <span class="badge" style="background: ${status1 === 'Top Urgent' ? 'rgba(239,68,68,0.18)' : (status1 === 'Stuffing' ? 'rgba(245,158,11,0.18)' : 'rgba(56,189,248,0.18)')}; color: ${status1Color}; font-weight: 700; font-size: 0.75rem; padding: 3px 8px; border: 1px solid ${status1Color}40;">${status1}</span>
                        ${(status1 === 'Top Urgent' && Array.isArray(meta.routes) && meta.routes.length > 0) ? `<span class="badge" style="background: rgba(239,68,68,0.25); color: #fca5a5; font-weight: 800; font-size: 0.75rem; padding: 3px 8px; border: 1px solid rgba(239,68,68,0.5);">ROUTE: ${meta.routes.join(', ')}</span>` : ''}
                        ${(isTwoDrop && status2 === 'Top Urgent' && Array.isArray(meta.routes2) && meta.routes2.length > 0) ? `<span class="badge" style="background: rgba(239,68,68,0.25); color: #fca5a5; font-weight: 800; font-size: 0.75rem; padding: 3px 8px; border: 1px solid rgba(239,68,68,0.5);">D2 ROUTE: ${meta.routes2.join(', ')}</span>` : ''}
                        ${isTwoDrop ? `<span class="badge" style="background: rgba(192,132,252,0.18); color: #c084fc; font-weight: 700; font-size: 0.75rem; padding: 3px 8px; border: 1px solid rgba(192,132,252,0.3);">2 Drops Sequential</span>` : ''}
                    </div>

                    <div style="display: flex; align-items: center; gap: 14px; font-size: 0.82rem;">
                        <div style="display: flex; align-items: center; gap: 6px; color: var(--fg-muted);">
                            <span>DOs:</span>
                            <strong style="color: var(--fg); font-family: Aptos Display, sans-serif;">${assignedList.length}</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; color: var(--fg-muted);">
                            <span>Total Qty:</span>
                            <strong style="color: #fbbf24; font-family: Aptos Display, sans-serif;">${totalQty.toLocaleString()} pcs</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; color: var(--fg-muted);">
                            <span>Volume:</span>
                            <strong style="color: #34d399; font-family: Aptos Display, sans-serif;">${totalVol.toFixed(2)} m³</strong>
                        </div>
                    </div>
                </div>

                <!-- Animated Highway Transit Track -->
                <div class="highway-lane-track">
                    <!-- Roadbed with asphalt & animated dashes -->
                    <div class="highway-lane-roadbed">
                        <div class="highway-lane-dashes"></div>
                    </div>

                    <!-- Waypoint 0: Origin Departure Terminal (SALC) -->
                    <div class="route-waypoint-node" style="left: 4%;">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: #1e293b; border: 2px solid #64748b; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(0,0,0,0.5);">
                            🛫
                        </div>
                        <div style="font-size: 0.72rem; font-weight: 800; color: #cbd5e1; margin-top: 4px; white-space: nowrap; letter-spacing: 0.04em;">SALC</div>
                        <div style="font-size: 0.65rem; color: var(--fg-muted);">DEPARTURE</div>
                    </div>

                    <!-- Moving Animated Truck Vehicle -->
                    <div class="moving-truck-vehicle" style="animation: ${animName} ${baseDuration}s ease-in-out infinite;" title="Truck ${index + 1} (${totalQty.toLocaleString()} pcs loaded)">
                        <div style="display: flex; flex-direction: column; align-items: center; position: relative;">
                            <!-- Pulsing Beacon -->
                            <div style="width: 7px; height: 7px; border-radius: 50%; background: ${status1Color}; box-shadow: 0 0 8px ${status1Color}; animation: pulseBeacon 1s infinite; margin-bottom: 2px;"></div>
                            
                            <!-- Truck Vector Body -->
                            <div style="display: flex; align-items: center; background: #1e1b4b; border: 1.5px solid ${status1Color}; border-radius: 6px; padding: 4px 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.6), 0 0 10px ${status1Color}40; gap: 6px;">
                                <!-- Container Box -->
                                <div style="font-size: 0.7rem; font-weight: 800; color: #ffffff; font-family: Aptos Display, sans-serif; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
                                    <span>🚛 T${index + 1}</span>
                                    <span style="font-size: 0.65rem; color: ${status1Color}; opacity: 0.9;">${meta.size || '40'}</span>
                                </div>
                                <!-- Headlight Beam -->
                                <div style="width: 14px; height: 10px; background: linear-gradient(90deg, #38bdf8, transparent); border-radius: 0 4px 4px 0; animation: headlightBeam 1.2s infinite;"></div>
                            </div>
                            
                            <!-- Payload floating tag -->
                            <div style="font-size: 0.65rem; font-weight: 700; color: #fbbf24; font-family: Aptos Display, sans-serif; background: rgba(0,0,0,0.8); padding: 1px 5px; border-radius: 4px; margin-top: 3px; white-space: nowrap;">
                                ${totalQty.toLocaleString()} pcs
                            </div>
                        </div>
                    </div>

                    <!-- Waypoint 1: 1st Drop Destination -->
                    <div class="route-waypoint-node" style="left: ${isTwoDrop ? '44%' : '84%'};">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #0f172a; border: 2px solid #38bdf8; display: flex; align-items: center; justify-content: center; color: #38bdf8; font-size: 13px; font-weight: 800; box-shadow: 0 0 14px rgba(56,189,248,0.4);">
                            📍
                        </div>
                        <div style="font-size: 0.74rem; font-weight: 700; color: #38bdf8; margin-top: 4px; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis;">
                            ${isTwoDrop ? '1st Drop: ' : ''}${dest1Label}
                        </div>
                        <div style="font-size: 0.65rem; color: var(--fg-muted); font-family: Aptos Display, sans-serif;">
                            ${meta.hub ? hub1Label + ' • ' : ''}${drop1List.length} DOs (${drop1Qty.toLocaleString()} pcs)
                        </div>
                    </div>

                    <!-- Waypoint 2: 2nd Drop Destination (if 2 Drops) -->
                    ${isTwoDrop ? `
                        <div class="route-waypoint-node" style="left: 86%;">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: #0f172a; border: 2px solid #c084fc; display: flex; align-items: center; justify-content: center; color: #c084fc; font-size: 13px; font-weight: 800; box-shadow: 0 0 14px rgba(192,132,252,0.4);">
                                🏁
                            </div>
                            <div style="font-size: 0.74rem; font-weight: 700; color: #c084fc; margin-top: 4px; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis;">
                                2nd Drop: ${dest2Label}
                            </div>
                            <div style="font-size: 0.65rem; color: var(--fg-muted); font-family: Aptos Display, sans-serif;">
                                ${meta.hub2 ? hub2Label + ' • ' : ''}${drop2List.length} DOs (${drop2Qty.toLocaleString()} pcs)
                            </div>
                        </div>
                    ` : `
                        <div class="route-waypoint-node" style="left: 96%;">
                            <div style="font-size: 16px;">🏁</div>
                            <div style="font-size: 0.65rem; color: var(--fg-muted);">COMPLETE</div>
                        </div>
                    `}
                </div>

                <!-- Assigned DO Manifest Chips -->
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 4px;">
                    <span style="font-size: 0.72rem; color: var(--fg-muted); font-weight: 600; text-transform: uppercase;">Cargo Items:</span>
                    ${doChipsHtml}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
};
