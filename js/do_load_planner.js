
let isSimplifyMode = true;

function applySimplifyModeUI() {
    const btn = document.getElementById('btnSimplifyMode');
    const table = document.querySelector('.compact-table');
    if (btn && table) {
        if (isSimplifyMode) {
            btn.innerHTML = `Simplify View: ON`;
            btn.style.background = 'rgba(16, 185, 129, 0.15)';
            btn.style.color = '#34d399';
            btn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            table.classList.add('do-simplify-mode');
        } else {
            btn.innerHTML = `Simplify View: OFF`;
            btn.style.background = 'transparent';
            btn.style.color = 'var(--fg, #f4f4f5)';
            btn.style.borderColor = 'var(--border, #3f3f46)';
            table.classList.remove('do-simplify-mode');
        }
    }
}

function toggleSimplifyMode() {
    isSimplifyMode = !isSimplifyMode;
    applySimplifyModeUI();
}

// DO Load Planner Controller (Slicer-based)
let TruckPlanningRawDOs = [];
let TruckPlanningLookupMap = {};

let SelectedTruckFilter = "ALL";
let SelectedTypeFilter = "ALL";
let SelectedHubFilter = "ALL";
let SelectedCategoryFilter = "ALL";
let TruckSearchTerm = "";

let filteredGroupedDos = [];
let selectedDos = new Set();

document.addEventListener('DOMContentLoaded', () => {
    initDoLoadPlanner();
    applySimplifyModeUI();
});


let DataSourceMode = 'summary'; // 'summary' or 'route'
let StandaloneRouteDOs = [];

function setDataSourceMode(mode) {
    DataSourceMode = mode;
    
    document.getElementById('mode-summary-btn').style.background = mode === 'summary' ? 'var(--accent)' : 'transparent';
    document.getElementById('mode-summary-btn').style.color = mode === 'summary' ? 'white' : 'var(--fg-muted)';
    
    document.getElementById('mode-route-btn').style.background = mode === 'route' ? 'var(--accent)' : 'transparent';
    document.getElementById('mode-route-btn').style.color = mode === 'route' ? 'white' : 'var(--fg-muted)';
    
    const uploader = document.getElementById('route-upload-container');
    if (uploader) {
        uploader.style.display = mode === 'route' ? 'flex' : 'none';
    }
    
    // Clear slicers
    SelectedTypeFilter = "ALL";
    SelectedTruckFilter = "ALL";
    SelectedHubFilter = "ALL";
    SelectedCategoryFilter = "ALL";
    
    selectedDos.clear();
    
    populateSlicerButtons();
    renderTable();
}

async function handleStandaloneRouteUpload(event, isAppend = false) {
    const files = Array.from(event.target.files);
    event.target.value = ""; // Reset the input so the same file can be selected again
    if (files.length === 0) return;

    // Show loading state
    const tbody = document.getElementById('doTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--fg-muted);">Processing ${files.length} file(s)... Please wait.</td></tr>`;
    }
    
    // Give browser time to render loading state
    await new Promise(resolve => setTimeout(resolve, 50));

    const masterDataRaw = localStorage.getItem("GlobalMasterDataMap");
    const masterDataMap = masterDataRaw ? JSON.parse(masterDataRaw) : {};
    
    let allParsedDos = [];

    for (const file of files) {
        await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    
                    // Find header row
                    let headerIdx = -1;
                    for (let i = 0; i < Math.min(20, rows.length); i++) {
                        if (rows[i] && rows[i].length > 0 && String(rows[i][0]).toUpperCase().includes('SEQ')) {
                            headerIdx = i;
                            break;
                        }
                    }
                    
                    const startIdx = headerIdx >= 0 ? headerIdx + 1 : 1;
                    
                    for (let i = startIdx; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || !row[0]) continue;
                        
                        const inv = String(row[0] || "").trim(); // SEQ
                        const route = String(row[2] || "N/A").trim(); // ZONE1
                        const name = String(row[3] || "N/A").trim(); // CONSIGNEE_NAME
                        const addr = String(row[4] || "N/A").trim(); // ADDRESS1
                        let vol = parseFloat(row[7]) || 0; // VOLUME
                        const qty = parseInt(row[9]) || 0; // SHIP_QUANTITY
                        const code = String(row[10] || "").trim(); // ITEM
                        const desc = String(row[11] || "").trim(); // ITEM_DESC
                        
                        let doType = "UNKNOWN";
                        let matchedModel = masterDataMap[code];
                        
                        // Case-insensitive fallback
                        if (!matchedModel) {
                            const upperCode = code.toUpperCase();
                            const matchedKey = Object.keys(masterDataMap).find(k => k.toUpperCase() === upperCode);
                            if (matchedKey) matchedModel = masterDataMap[matchedKey];
                        }
                        
                        if (matchedModel && matchedModel.type) {
                            doType = matchedModel.type.toUpperCase();
                            if (doType === 'HIFI' || doType === 'HIFI AUDIO') {
                                if (matchedModel.l > 0 && matchedModel.w > 0 && matchedModel.h > 0) {
                                    vol = ((matchedModel.l * matchedModel.w * matchedModel.h) / 1000000) * qty;
                                }
                            }
                        }
                        
                        allParsedDos.push({
                            inv: inv,
                            route: route,
                            name: name,
                            addr: addr,
                            vol: vol,
                            qty: qty,
                            code: code,
                            desc: desc,
                            type: doType
                        });
                    }
                    resolve();
                } catch (error) {
                    console.error("Error reading file:", file.name, error);
                    resolve(); // Resolve anyway to continue with other files
                }
            };
            reader.onerror = () => resolve();
            reader.readAsArrayBuffer(file);
        });
    }
    
    if (allParsedDos.length > 0) {
        if (isAppend) {
            StandaloneRouteDOs = StandaloneRouteDOs.concat(allParsedDos);
        } else {
            StandaloneRouteDOs = allParsedDos;
        }
        localStorage.setItem("LastUploadedStandaloneRouteData", JSON.stringify(StandaloneRouteDOs));
        showToast(`Loaded ${allParsedDos.length} item rows from ${files.length} Route File(s). Total items: ${StandaloneRouteDOs.length}.`, "success");
        populateSlicerButtons();
        renderTable();
    } else {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--fg-muted);">No valid data found in the uploaded file(s).</td></tr>`;
        }
        showToast("Could not extract valid route data from the uploaded file(s).", "error");
    }
}

// Intercept type update for unknown types
function updateStandaloneType(inv, code, newType) {
    if (DataSourceMode === 'route') {
        StandaloneRouteDOs.forEach(row => {
            if (row.inv === inv && row.code === code) {
                row.type = newType;
            }
        });
        
        localStorage.setItem("LastUploadedStandaloneRouteData", JSON.stringify(StandaloneRouteDOs));
        
        // Also try saving it to master data for future use!
        try {
            const masterDataRaw = localStorage.getItem("GlobalMasterDataMap");
            const masterDataMap = masterDataRaw ? JSON.parse(masterDataRaw) : {};
            if (masterDataMap[code]) {
                masterDataMap[code].type = newType;
            } else {
                masterDataMap[code] = {
                    code: code,
                    description: StandaloneRouteDOs.find(r => r.code === code)?.desc || code,
                    type: newType,
                    capacities: []
                };
            }
            localStorage.setItem("GlobalMasterDataMap", JSON.stringify(masterDataMap));
        } catch(e) {}
        
        populateSlicerButtons();
        renderTable();
    }
}


function initDoLoadPlanner() {
    const rawDoData = localStorage.getItem("LastUploadedDoSummary");
    const rawRouteData = localStorage.getItem("LastUploadedRouteData");
    const rawStandaloneRouteData = localStorage.getItem("LastUploadedStandaloneRouteData");

    if (rawStandaloneRouteData) {
        try { 
            StandaloneRouteDOs = JSON.parse(rawStandaloneRouteData); 
            
            // Sync with latest master data
            const masterDataRaw = localStorage.getItem("GlobalMasterDataMap");
            if (masterDataRaw) {
                const masterDataMap = JSON.parse(masterDataRaw);
                let updated = false;
                StandaloneRouteDOs.forEach(row => {
                    if (!row.code) return;
                    let matchedModel = masterDataMap[row.code];
                    
                    if (!matchedModel) {
                        const upperCode = row.code.toUpperCase();
                        const matchedKey = Object.keys(masterDataMap).find(k => k.toUpperCase() === upperCode);
                        if (matchedKey) matchedModel = masterDataMap[matchedKey];
                    }
                    
                    if (matchedModel && matchedModel.type) {
                        const newType = matchedModel.type.toUpperCase();
                        if (row.type !== newType) {
                            row.type = newType;
                            updated = true;
                        }
                    }
                });
                if (updated) {
                    localStorage.setItem("LastUploadedStandaloneRouteData", JSON.stringify(StandaloneRouteDOs));
                }
            }
        } catch(e) {}
    }

    if (rawRouteData) {
        try { 
            TruckPlanningLookupMap = JSON.parse(rawRouteData); 
            if (typeof sanitizeProductMasterLookup === 'function') {
                TruckPlanningLookupMap = sanitizeProductMasterLookup(TruckPlanningLookupMap);
            }
        } catch(e) {}
    }

    if (rawDoData) {
        try { TruckPlanningRawDOs = JSON.parse(rawDoData); } catch(e) {}
    }

    populateSlicerButtons();
    renderTable();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            TruckSearchTerm = e.target.value.toLowerCase().trim();
            renderTable();
        });
    }
    
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if(selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', handleSelectAll);
    }
    
    const calcBtn = document.getElementById('calculateBtn');
    if(calcBtn) {
        calcBtn.addEventListener('click', handleCalculate);
    }
}

function isStatusOrNonTruck(val) {
    if (val === null || val === undefined) return true;
    const str = String(val).trim();
    if (!str) return true;

    // Split by common delimiters (comma, slash, ampersand) in case of multiple trucks like "1, 2" or "1 / 3"
    const tokens = str.split(/[,/&]+/).map(t => t.trim()).filter(Boolean);
    if (tokens.length === 0) return true;

    // Physical truck numbers under column B are always numerical (positive numbers).
    // Values containing non-numerical text (e.g. HOLD, CANCEL, DESTROYED, N/A, etc.) are treated as status strings.
    return !tokens.every(t => /^\d+$/.test(t) && parseInt(t, 10) > 0);
}

function getRouteMatch(doRow) {
    let match = TruckPlanningLookupMap[doRow.inv];
    if (!match && doRow.inv) {
        match = TruckPlanningLookupMap[doRow.inv.split(" ")[0].trim()];
    }
    return match || {};
}

function sanitizeProductMasterLookup(lookupMap) {
    if (!lookupMap || typeof lookupMap !== 'object') return lookupMap;
    let modified = false;
    Object.keys(lookupMap).forEach(key => {
        const item = lookupMap[key];
        if (!item) return;
        
        let statusFound = null;
        if (item.truck && isStatusOrNonTruck(item.truck)) {
            statusFound = item.truck.toUpperCase();
        }

        if (item.trucks && Array.isArray(item.trucks)) {
            const cleanTrucks = item.trucks.filter(t => {
                if (isStatusOrNonTruck(t)) {
                    if (!statusFound) statusFound = String(t).toUpperCase();
                    return false;
                }
                return true;
            });
            if (cleanTrucks.length !== item.trucks.length) modified = true;
            item.trucks = cleanTrucks;
            if (cleanTrucks.length > 0) {
                item.truck = cleanTrucks.join(", ");
            } else if (statusFound) {
                item.truck = statusFound;
                item.status = statusFound;
            }
        } else if (item.truck && isStatusOrNonTruck(item.truck)) {
            item.trucks = [];
            item.status = statusFound;
            modified = true;
        }

        if (statusFound && !item.status) {
            item.status = statusFound;
            modified = true;
        }

        if (item.items && Array.isArray(item.items)) {
            item.items.forEach(subItem => {
                if (subItem.trucks && Array.isArray(subItem.trucks)) {
                    const cleanSubTrucks = subItem.trucks.filter(t => !isStatusOrNonTruck(t));
                    if (cleanSubTrucks.length !== subItem.trucks.length) modified = true;
                    subItem.trucks = cleanSubTrucks;
                }
                if (subItem.truck && isStatusOrNonTruck(subItem.truck)) {
                    subItem.truck = "";
                    modified = true;
                }
            });
        }
    });

    if (modified) {
        try {
            localStorage.setItem("LastUploadedRouteData", JSON.stringify(lookupMap));
        } catch (e) {
            console.error("Failed saving sanitized route data to localStorage:", e);
        }
    }
    return lookupMap;
}

function getTruckListForRoute(routeMatch) {
    let trucks = [];
    if (routeMatch.trucks && Array.isArray(routeMatch.trucks) && routeMatch.trucks.length > 0) {
        trucks = routeMatch.trucks;
    } else if (routeMatch.truck) {
        trucks = String(routeMatch.truck).split(/[,/&]+/).map(t => t.trim()).filter(Boolean);
    }
    return trucks.filter(t => typeof isStatusOrNonTruck === 'function' ? !isStatusOrNonTruck(t) : /^\d+$/.test(String(t).trim()));
}

function getHubListForRoute(routeMatch) {
    if (routeMatch.hubs && Array.isArray(routeMatch.hubs) && routeMatch.hubs.length > 0) {
        return routeMatch.hubs;
    }
    if (routeMatch.hub) {
        return String(routeMatch.hub).split(/[,/&]+/).map(h => h.trim()).filter(Boolean);
    }
    return [];
}

function getItemTrucks(item, routeMatch) {
    let rawTrucks = [];
    if (item && item.trucks && Array.isArray(item.trucks) && item.trucks.length > 0) {
        rawTrucks = item.trucks;
    } else if (item && item.truck) {
        rawTrucks = String(item.truck).split(/[,/&]+/).map(t => t.trim()).filter(Boolean);
    } else {
        rawTrucks = getTruckListForRoute(routeMatch);
    }
    return rawTrucks.filter(t => typeof isStatusOrNonTruck === 'function' ? !isStatusOrNonTruck(t) : /^\d+$/.test(String(t).trim()));
}

function getItemHubs(item, routeMatch) {
    if (item && item.hubs && Array.isArray(item.hubs) && item.hubs.length > 0) {
        return item.hubs;
    }
    if (item && item.hub) {
        return String(item.hub).split(/[,/&]+/).map(h => h.trim()).filter(Boolean);
    }
    return getHubListForRoute(routeMatch);
}

function populateSlicerButtons() {
    const truckSet = new Set();
    const typeSet = new Set();
    const hubSet = new Set();
    const catSet = new Set();

    if (DataSourceMode === 'summary') {
        TruckPlanningRawDOs.forEach(doRow => {
            const routeMatch = getRouteMatch(doRow);
            const doType = (routeMatch.doCategory || routeMatch.doType || "BIG").toUpperCase();
            typeSet.add(doType);
    
            const itemsList = (routeMatch.items && routeMatch.items.length > 0) ? routeMatch.items : [];
            if (itemsList.length === 0) {
                const b = routeMatch.batch || "-";
            } else {
                itemsList.forEach(item => {
                    const b = item.batch || routeMatch.batch || "-";
                    
                    const desc = item.desc || "";
                    if (desc.includes("(")) {
                        const match = desc.match(/\(([^)]+)\)/);
                        if (match) catSet.add(match[1]);
                    }
    
                    getItemTrucks(item, routeMatch).forEach(t => truckSet.add(t));
                    getItemHubs(item, routeMatch).forEach(h => hubSet.add(h));
                });
            }
        });
    } else {
        StandaloneRouteDOs.forEach(item => {
            typeSet.add(item.type);
            const desc = item.desc || "";
            if (desc.includes("(")) {
                const match = desc.match(/\(([^)]+)\)/);
                if (match) catSet.add(match[1]);
            }
        });
    }

    // Cross-filtered subsets
    const trucksForHubSet = new Set();
    const hubsForTruckSet = new Set();
    TruckPlanningRawDOs.forEach(doRow => {
        const routeMatch = getRouteMatch(doRow);
        const itemsList = (routeMatch.items && routeMatch.items.length > 0) ? routeMatch.items : [null];

        itemsList.forEach(item => {
            const iTrucks = getItemTrucks(item, routeMatch);
            const iHubs = getItemHubs(item, routeMatch);

            if (iHubs.length > 0) {
                iHubs.forEach(h => {
                    if (iTrucks.length > 0) {
                        iTrucks.forEach(t => {
                            if (SelectedHubFilter === "ALL" || iHubs.includes(SelectedHubFilter)) trucksForHubSet.add(t);
                            if (SelectedTruckFilter === "ALL" || iTrucks.includes(SelectedTruckFilter)) hubsForTruckSet.add(h);
                        });
                    } else {
                        if (SelectedTruckFilter === "ALL") hubsForTruckSet.add(h);
                    }
                });
            } else if (iTrucks.length > 0) {
                iTrucks.forEach(t => {
                    if (SelectedHubFilter === "ALL") trucksForHubSet.add(t);
                });
            }
        });
    });

    // 1. Render Truck Slicer Grid
    const truckGrid = document.getElementById("truckSlicerGrid");
    if (truckGrid) {
        const sortedTrucks = Array.from(truckSet).sort((a, b) => parseInt(a) - parseInt(b));
        let html = `<button class="slicer-btn ${SelectedTruckFilter === 'ALL' ? 'active' : ''}" onclick="setTruckFilter('ALL')">All Trucks</button>`;
        sortedTrucks.forEach(tr => {
            const disabled = !trucksForHubSet.has(tr);
            html += `<button class="slicer-btn ${SelectedTruckFilter === tr ? 'active' : ''}" ${disabled ? 'disabled style="opacity:0.35;cursor:not-allowed;"' : `onclick="setTruckFilter('${tr}')"`}>Truck ${tr}</button>`;
        });
        truckGrid.innerHTML = html;
    }

    // 2. Render Hub Slicer Grid (limited to selected truck's hubs)
    const hubGrid = document.getElementById("hubSlicerGrid");
    if (hubGrid) {
        const sortedHubs = Array.from(hubSet).sort();
        let html = `<button class="slicer-btn ${SelectedHubFilter === 'ALL' ? 'active' : ''}" onclick="setHubFilter('ALL')">All Hubs</button>`;
        sortedHubs.forEach(hub => {
            const disabled = !hubsForTruckSet.has(hub);
            html += `<button class="slicer-btn ${SelectedHubFilter === hub ? 'active' : ''}" ${disabled ? 'disabled style="opacity:0.35;cursor:not-allowed;"' : `onclick="setHubFilter('${hub}')"`}>${hub}</button>`;
        });
        hubGrid.innerHTML = html;
    }

    // 3. Render Category Slicer Grid
    const catGrid = document.getElementById("categorySlicerGrid");
    if (catGrid) {
        const sortedCats = Array.from(catSet).sort();
        let html = `<button class="slicer-btn ${SelectedCategoryFilter === 'ALL' ? 'active' : ''}" onclick="setCategoryFilter('ALL')">All Categories</button>`;
        sortedCats.forEach(cat => {
            html += `<button class="slicer-btn ${SelectedCategoryFilter === cat ? 'active' : ''}" onclick="setCategoryFilter('${cat}')">${cat}</button>`;
        });
        catGrid.innerHTML = html;
    }
}

function getFilteredTruckPlanningData() {
    TruckSearchTerm = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
    let filteredRows = [];

    if (DataSourceMode === 'summary') {
        TruckPlanningRawDOs.forEach(doRow => {
            const routeMatch = getRouteMatch(doRow);
            const doType = (routeMatch.doCategory || routeMatch.doType || "BIG").toUpperCase();
            const remark = doRow.remark || "";
            const fullDoText = remark ? `${doRow.inv} ${remark}` : doRow.inv;
    
            if (SelectedTypeFilter !== "ALL") {
                const targetFilter = SelectedTypeFilter.toUpperCase();
                if (targetFilter === "BIG" && doType !== "BIG" && doType !== "MIX") return;
                if (targetFilter === "SMALL" && doType !== "SMALL" && doType !== "MIX") return;
                if (targetFilter === "MIX" && doType !== "MIX") return;
                if (targetFilter !== "BIG" && targetFilter !== "SMALL" && targetFilter !== "MIX" && doType !== targetFilter) return;
            }
    
            const itemsList = (routeMatch.items && routeMatch.items.length > 0) 
                ? routeMatch.items 
                : [{ code: "Unspecified", desc: "No Product Description", qty: doRow.qty }];
    
            itemsList.forEach(item => {
                const code = item.code || "-";
                const desc = item.desc || "-";
                const qty = item.qty || 0;
    
                const iTrucks = getItemTrucks(item, routeMatch);
                const itemTruckStr = iTrucks.length > 0 ? iTrucks.join(", ") : "N/A";
    
                const iHubs = getItemHubs(item, routeMatch);
                const itemHubStr = iHubs.length > 0 ? iHubs.join(", ") : "N/A";
    
                if (SelectedTruckFilter !== "ALL" && !iTrucks.includes(SelectedTruckFilter)) return;
                if (SelectedHubFilter !== "ALL" && !iHubs.includes(SelectedHubFilter)) return;
    
                if (SelectedCategoryFilter !== "ALL") {
                    if (!desc.toUpperCase().includes(`(${SelectedCategoryFilter})`)) return;
                }
    
                const batchVal = (item && item.batch) ? item.batch : (routeMatch.batch || "-");
    
    
                if (TruckSearchTerm) {
                    const searchable = `${batchVal} ${doRow.inv} ${doRow.route} ${doRow.name} ${doRow.addr} ${itemTruckStr} ${itemHubStr} ${code} ${desc} ${remark}`.toLowerCase();
                    if (!searchable.includes(TruckSearchTerm)) return;
                }
    
                filteredRows.push({
                    batch: batchVal,
                    truck: itemTruckStr,
                    hub: itemHubStr,
                    route: doRow.route || "-",
                    consignee: doRow.name || "-",
                    doNo: fullDoText,
                    invRaw: doRow.inv,
                    type: doType,
                    productCode: code,
                    modelName: desc,
                    qty: qty,
                    vol: parseFloat(doRow.vol) || 0
                });
            });
        });
    } else {
        // standalone route mode
        StandaloneRouteDOs.forEach(item => {
            const batchVal = "-";
            const itemTruckStr = "N/A";
            const itemHubStr = "N/A";
            
            if (SelectedTypeFilter !== "ALL") {
                const targetFilter = SelectedTypeFilter.toUpperCase();
                const doType = (item.type || "").toUpperCase();
                if (targetFilter === "BIG" && doType !== "BIG" && doType !== "MIX") return;
                if (targetFilter === "SMALL" && doType !== "SMALL" && doType !== "MIX") return;
                if (targetFilter === "MIX" && doType !== "MIX") return;
                if (targetFilter !== "BIG" && targetFilter !== "SMALL" && targetFilter !== "MIX" && doType !== targetFilter) return;
            }
            
            if (TruckSearchTerm) {
                const searchable = `${item.inv} ${item.route} ${item.name} ${item.addr} ${item.code} ${item.desc}`.toLowerCase();
                if (!searchable.includes(TruckSearchTerm)) return;
            }
            
            filteredRows.push({
                batch: batchVal,
                truck: itemTruckStr,
                hub: itemHubStr,
                route: item.route || "-",
                consignee: item.name || "-",
                doNo: item.inv,
                invRaw: item.inv,
                type: item.type,
                productCode: item.code,
                modelName: item.desc,
                qty: item.qty,
                vol: item.vol
            });
        });
    }

    return filteredRows;
}




function setTruckFilter(val) {
    SelectedTruckFilter = val;
    populateSlicerButtons();
    renderTable();
}

function setTypeFilter(val) {
    SelectedTypeFilter = val;
    document.querySelectorAll("#typeSlicerGrid .slicer-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-type") === val);
    });
    renderTable();
}

function setHubFilter(val) {
    SelectedHubFilter = val;
    populateSlicerButtons();
    renderTable();
}

function setCategoryFilter(val) {
    SelectedCategoryFilter = val;
    populateSlicerButtons();
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('doTableBody');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    if(!tbody) return;

    // We reuse getFilteredTruckPlanningData which gives us line items, then group by DO
    const filteredRows = getFilteredTruckPlanningData();
    
    const groupedByDo = {};
    filteredRows.forEach(row => {
        if (!groupedByDo[row.invRaw]) {
            groupedByDo[row.invRaw] = {
                batch: row.batch,
                truck: row.truck,
                hub: row.hub,
                route: row.route,
                consignee: row.consignee,
                doNo: row.doNo,
                invRaw: row.invRaw,
                totalQty: 0,
                totalVol: row.isItemVol ? 0 : row.vol, // Set once if legacy
                items: [],
                rawItems: []
            };
        }
        groupedByDo[row.invRaw].totalQty += row.qty;
        if (row.isItemVol) {
            groupedByDo[row.invRaw].totalVol += row.vol;
        }
        groupedByDo[row.invRaw].items.push(`${row.qty}x [${row.productCode}]`);
        
        groupedByDo[row.invRaw].rawItems.push({
            code: row.productCode,
            desc: row.modelName,
            qty: row.qty,
            type: row.type,
            vol: row.vol,
            isItemVol: row.isItemVol
        });
    });
    
    filteredGroupedDos = Object.values(groupedByDo);

    // Cleanup selectedDos that are no longer visible due to filter
    const visibleDoSet = new Set(filteredGroupedDos.map(g => g.invRaw));
    const currentSelectedDos = Array.from(selectedDos);
    currentSelectedDos.forEach(inv => {
        if (!visibleDoSet.has(inv)) {
            selectedDos.delete(inv);
        }
    });

    if (filteredGroupedDos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--fg-muted);">No DOs match current filters. Ensure data is uploaded.</td></tr>`;
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        return;
    }
    
    let html = '';
    
    filteredGroupedDos.forEach(g => {
        const isChecked = selectedDos.has(g.invRaw);
        
        let breakdownHtml = g.rawItems.map(item => {
            if (item.type === 'UNKNOWN') {
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding: 4px; background: rgba(239, 68, 68, 0.1); border: 1px dashed #ef4444; border-radius: 4px;">
                        <span>${item.qty}x [${item.code}] ${item.desc}</span>
                        <select onchange="updateStandaloneType('${g.invRaw}', '${item.code}', this.value)" style="font-size: 10px; padding: 2px 4px; border: 1px solid #ef4444; background: var(--bg-card); color: var(--fg); border-radius: 4px; cursor: pointer; margin-left: 8px;">
                            <option value="UNKNOWN" selected disabled>⚠️ Select Type</option>
                            <option value="TV DISPLAY">TV Display</option>
                            <option value="HIFI">Hi-Fi</option>
                            <option value="SMALL">Small Item</option>
                        </select>
                    </div>`;
            }
            return `<div style="margin-bottom: 2px;">${item.qty}x [${item.code}]</div>`;
        }).join('');
        
        const uniqueSkus = g.rawItems.length;
        
        html += `
            <tr class="hover-row" style="border-bottom: 1px solid var(--border-color);">
                <td style="text-align: center; padding: 12px 8px;">
                    <input type="checkbox" class="row-checkbox" data-do="${g.invRaw}" ${isChecked ? 'checked' : ''}>
                </td>
                <td style="padding: 12px 8px;"><strong style="color: #3b82f6;">${g.truck}</strong></td>
                <td style="padding: 12px 8px;"><strong>${g.hub}</strong></td>
                <td style="padding: 12px 8px;">${g.route}</td>
                <td style="padding: 12px 8px; font-weight: 500;">${g.consignee}</td>
                <td style="padding: 12px 8px; font-family: monospace; font-size: 13px;">${g.doNo}</td>
                <td style="text-align: right; padding: 12px 8px; color: var(--accent); font-weight: 600;">${uniqueSkus}</td>
                <td style="text-align: right; padding: 12px 8px; font-weight: 600;">${g.totalQty.toLocaleString()}</td>
                <td style="text-align: right; padding: 12px 8px; color: #10b981; font-weight: 600;">${g.totalVol.toFixed(3)}</td>
                <td style="padding: 12px 8px; font-size: 11px; color: var(--fg-muted); max-width: 300px;">${breakdownHtml}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Reattach event listeners for row checkboxes
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const doNum = e.target.getAttribute('data-do');
            handleRowCheckbox(e, doNum);
        });
    });
    
    // Check if all filtered are selected
    const allFilteredSelected = filteredGroupedDos.length > 0 && filteredGroupedDos.every(d => selectedDos.has(d.invRaw));
    if (selectAllCheckbox) selectAllCheckbox.checked = allFilteredSelected;
    
    updateCalculateButton();
}

function handleRowCheckbox(e, doNumber) {
    if (e.target.checked) {
        selectedDos.add(doNumber);
    } else {
        selectedDos.delete(doNumber);
    }
    
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const allFilteredSelected = filteredGroupedDos.length > 0 && filteredGroupedDos.every(d => selectedDos.has(d.invRaw));
    if (selectAllCheckbox) selectAllCheckbox.checked = allFilteredSelected;
    
    updateCalculateButton();
}

function handleSelectAll(e) {
    const isChecked = e.target.checked;
    
    if (isChecked) {
        filteredGroupedDos.forEach(d => selectedDos.add(d.invRaw));
    } else {
        filteredGroupedDos.forEach(d => selectedDos.delete(d.invRaw));
    }
    
    renderTable(); // to update individual checkboxes
    updateCalculateButton();
}

function updateCalculateButton() {
    const btn = document.getElementById('calculateBtn');
    if (!btn) return;
    
    if (selectedDos.size > 0) {
        btn.textContent = `Calculate Pallets (${selectedDos.size} Selected)`;
        btn.disabled = false;
    } else {
        btn.textContent = `Calculate Pallets (0 Selected)`;
        btn.disabled = true;
    }
}

function handleCalculate() {
    if (selectedDos.size === 0) return;
    
    const GroupedMap = {};
    let hasUnknowns = false;
    
    // Grab master data to check item types if needed
    const masterDataRaw = localStorage.getItem("GlobalMasterDataMap");
    const masterDataMap = masterDataRaw ? JSON.parse(masterDataRaw) : {};
    
    if (DataSourceMode === 'summary') {
        TruckPlanningRawDOs.forEach(doRow => {
            if (selectedDos.has(doRow.inv)) {
                const routeMatch = getRouteMatch(doRow);
                const route = doRow.route || "UNASSIGNED";
                const itemsList = (routeMatch.items && routeMatch.items.length > 0) 
                    ? routeMatch.items 
                    : [{ code: "Unspecified", desc: "No Product Description", qty: doRow.qty }];
                
                itemsList.forEach(item => {
                    if (!item.code || item.code === "Unspecified") return;
                    
                    // --- ITEM LEVEL FILTERING ---
                    // Determine the item's specific type from master data
                    let itemType = "UNKNOWN";
                    let upperCode = String(item.code).trim().toUpperCase();
                    let matchedModel = masterDataMap[upperCode];
                    
                    if (!matchedModel) {
                         const matchedKey = Object.keys(masterDataMap).find(k => k.toUpperCase() === upperCode);
                         if (matchedKey) matchedModel = masterDataMap[matchedKey];
                    }
                    
                    if (matchedModel && matchedModel.type) {
                         itemType = String(matchedModel.type).toUpperCase();
                    }

                    const iTrucks = typeof getItemTrucks === 'function' ? getItemTrucks(item, routeMatch) : [];
                    const iHubs = typeof getItemHubs === 'function' ? getItemHubs(item, routeMatch) : [];
                    
                    if (SelectedTruckFilter !== "ALL" && !iTrucks.includes(SelectedTruckFilter)) return;
                    if (SelectedHubFilter !== "ALL" && !iHubs.includes(SelectedHubFilter)) return;
                    
                    if (SelectedCategoryFilter !== "ALL") {
                        const descStr = (item.desc || "").toUpperCase();
                        if (!descStr.includes(`(${SelectedCategoryFilter.toUpperCase()})`)) return;
                    }
                    
                    const currentSearchTerm = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
                    if (currentSearchTerm) {
                        const batchVal = (item && item.batch) ? item.batch : (routeMatch.batch || "-");
                        const itemTruckStr = iTrucks.length > 0 ? iTrucks.join(", ") : "N/A";
                        const itemHubStr = iHubs.length > 0 ? iHubs.join(", ") : "N/A";
                        const remark = doRow.remark || "";
                        const searchable = `${batchVal} ${doRow.inv} ${route} ${doRow.name} ${doRow.addr} ${itemTruckStr} ${itemHubStr} ${item.code} ${item.desc} ${remark}`.toLowerCase();
                        if (!searchable.includes(currentSearchTerm)) return;
                    }
                    
                    if (SelectedTypeFilter !== "ALL") {
                         const targetFilter = SelectedTypeFilter.toUpperCase();
                         
                         if (targetFilter === "BIG") {
                              if (itemType !== "TV DISPLAY" && itemType !== "HIFI" && itemType !== "HIFI AUDIO" && itemType !== "BIG") return;
                         } else if (targetFilter === "SMALL") {
                              if (itemType !== "SMALL") return;
                         }
                    }
                    // ----------------------------
                    
                    const key = `${doRow.inv}||${item.code}||${item.desc}||${route}`;
                    const lineQty = (item.qty && !isNaN(item.qty)) ? parseInt(item.qty, 10) : 1;
                    
                    if (!GroupedMap[key]) {
                        GroupedMap[key] = { 
                            inv: doRow.inv, code: item.code, desc: item.desc, 
                            route: route, qty: 0, 
                            vol: item.vol !== undefined && item.vol !== null ? parseFloat(item.vol) : 0 // Fallback to 0 so MasterData is used
                        };
                    }
                    GroupedMap[key].qty += lineQty;
                });
            }
        });
    } else {
        StandaloneRouteDOs.forEach(item => {
            if (selectedDos.has(item.inv)) {
                if (item.type === "UNKNOWN") {
                    hasUnknowns = true;
                }
                if (!item.code || item.type === "UNKNOWN") return; // Skip them if unknown, but we flag it
                
                // --- ITEM LEVEL FILTERING ---
                const currentSearchTerm = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
                if (currentSearchTerm) {
                    const searchable = `${item.inv} ${item.route} ${item.name} ${item.addr} ${item.code} ${item.desc}`.toLowerCase();
                    if (!searchable.includes(currentSearchTerm)) return;
                }

                if (SelectedTypeFilter !== "ALL") {
                    const targetFilter = SelectedTypeFilter.toUpperCase();
                    const itemType = (item.type || "").toUpperCase();
                    if (targetFilter === "BIG") {
                         if (itemType !== "TV DISPLAY" && itemType !== "HIFI" && itemType !== "HIFI AUDIO" && itemType !== "BIG") return;
                    } else if (targetFilter === "SMALL") {
                         if (itemType !== "SMALL") return;
                    }
                }
                // ----------------------------
                
                const key = `${item.inv}||${item.code}||${item.desc}||${item.route}`;
                
                if (!GroupedMap[key]) {
                    GroupedMap[key] = { inv: item.inv, code: item.code, desc: item.desc, route: item.route, qty: 0, type: item.type, vol: item.vol };
                }
                GroupedMap[key].qty += item.qty;
            }
        });
    }
    
    const warningEl = document.getElementById('calculateWarning');

    if (hasUnknowns) {
        if (warningEl) {
            warningEl.style.display = 'inline-flex';
            setTimeout(() => { warningEl.style.display = 'none'; }, 4000);
        } else {
            showToast("Please assign a type to all UNKNOWN items before calculating pallets.", "warning");
        }
        return;
    }
    
    if (warningEl) warningEl.style.display = 'none';
    
    const FinalItems = Object.values(GroupedMap);
    
    if (FinalItems.length > 0) {
        localStorage.setItem("PendingBulkLoadOrder", JSON.stringify(FinalItems));
        window.location.href = "volume_capacity_planner.html";
    } else {
        showToast("No valid items found in the selected DOs.", "warning");
    }
}