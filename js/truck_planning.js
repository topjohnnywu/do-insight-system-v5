let isSimplifyMode = false;
// Truck Planning & Daily Summary List Controller

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

let TruckPlanningRawDOs = [];
let TruckPlanningLookupMap = {};

let SelectedTruckFilter = "ALL";
let SelectedBatchFilter = "ALL";
let SelectedTypeFilter = "ALL";
let SelectedHubFilter = "ALL";
let SelectedCategoryFilter = "ALL";
let TruckSearchTerm = "";

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
    if (typeof initTheme === 'function') initTheme();
    loadTruckPlanningData();
    updateDateDisplay();
});

// Update top date display (matches Excel 31/7/2026 timestamp format)
function updateDateDisplay() {
    const dateElem = document.getElementById("currentDateDisplay");
    if (!dateElem) return;
    const now = new Date();
    const formatted = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    dateElem.innerText = formatted;
}

// Load dataset from localStorage
function loadTruckPlanningData() {
    const rawDoData = localStorage.getItem("LastUploadedDoSummary");
    const rawRouteData = localStorage.getItem("LastUploadedRouteData");

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
    renderTruckPlanningDashboard();
}

// Helper to extract trucks array from routeMatch
function getTruckListForRoute(routeMatch) {
    let trucks = [];
    if (routeMatch.trucks && Array.isArray(routeMatch.trucks) && routeMatch.trucks.length > 0) {
        trucks = routeMatch.trucks;
    } else if (routeMatch.truck) {
        trucks = String(routeMatch.truck).split(/[,/&]+/).map(t => t.trim()).filter(Boolean);
    }
    return trucks.filter(t => typeof isStatusOrNonTruck === 'function' ? !isStatusOrNonTruck(t) : /^\d+$/.test(String(t).trim()));
}

// Helper to extract hubs array from routeMatch
function getHubListForRoute(routeMatch) {
    if (routeMatch.hubs && Array.isArray(routeMatch.hubs) && routeMatch.hubs.length > 0) {
        return routeMatch.hubs;
    }
    if (routeMatch.hub) {
        return String(routeMatch.hub).split(/[,/&]+/).map(h => h.trim()).filter(Boolean);
    }
    return [];
}

// Item-level truck helper with fallback to routeMatch
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

// Item-level hub helper with fallback to routeMatch
function getItemHubs(item, routeMatch) {
    if (item && item.hubs && Array.isArray(item.hubs) && item.hubs.length > 0) {
        return item.hubs;
    }
    if (item && item.hub) {
        return String(item.hub).split(/[,/&]+/).map(h => h.trim()).filter(Boolean);
    }
    return getHubListForRoute(routeMatch);
}

// Extract unique values and build interactive slicer button grids
// Truck and Hub slicers cross-filter: selecting a truck limits hubs to that
// truck (and vice-versa), so "All Hubs" after picking a truck = that truck's hubs.
function populateSlicerButtons() {
    const trucksSet = new Set();
    const hubsSet = new Set();
    const categoriesSet = new Set();
    const batchesSet = new Set();

    // Iterate through all records and their items to harvest unique trucks, hubs, product categories, and batches
    TruckPlanningRawDOs.forEach(doRow => {
        const routeMatch = getRouteMatch(doRow);
        const itemsList = (routeMatch.items && routeMatch.items.length > 0) ? routeMatch.items : [null];

        itemsList.forEach(item => {
            const iTrucks = getItemTrucks(item, routeMatch);
            const iHubs = getItemHubs(item, routeMatch);

            iTrucks.forEach(t => trucksSet.add(t));
            iHubs.forEach(h => hubsSet.add(h));

            const bVal = (item && item.batch) ? item.batch : (routeMatch.batch || "");
            if (bVal && bVal !== "-" && bVal !== "N/A") {
                bVal.split(",").forEach(b => {
                    const clean = b.trim();
                    if (clean) batchesSet.add(clean);
                });
            }

            if (item) {
                const desc = item.desc || "";
                if (desc.includes("(")) {
                    const catMatch = desc.match(/\(([^)]+)\)/);
                    if (catMatch) categoriesSet.add(catMatch[1].toUpperCase());
                }
            }
        });
    });

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

    // 0. Render Batch Slicer Grid
    const batchGrid = document.getElementById("batchSlicerGrid");
    if (batchGrid) {
        const sortedBatches = Array.from(batchesSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        let html = `<button class="slicer-btn ${SelectedBatchFilter === 'ALL' ? 'active' : ''}" onclick="setBatchFilter('ALL')">All Batches</button>`;
        sortedBatches.forEach(batch => {
            html += `<button class="slicer-btn ${SelectedBatchFilter === batch ? 'active' : ''}" onclick="setBatchFilter('${batch}')">${batch}</button>`;
        });
        batchGrid.innerHTML = html;
    }

    // 1. Render Truck Slicer Grid
    const truckGrid = document.getElementById("truckSlicerGrid");
    if (truckGrid) {
        const sortedTrucks = Array.from(trucksSet).sort((a, b) => parseInt(a) - parseInt(b));
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
        const sortedHubs = Array.from(hubsSet).sort();
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
        const sortedCats = Array.from(categoriesSet).sort();
        let html = `<button class="slicer-btn ${SelectedCategoryFilter === 'ALL' ? 'active' : ''}" onclick="setCategoryFilter('ALL')">All Categories</button>`;
        sortedCats.forEach(cat => {
            html += `<button class="slicer-btn ${SelectedCategoryFilter === cat ? 'active' : ''}" onclick="setCategoryFilter('${cat}')">${cat}</button>`;
        });
        catGrid.innerHTML = html;
    }
}

// Slicer Button Click Handlers
function setBatchFilter(val) {
    SelectedBatchFilter = val;
    populateSlicerButtons();
    renderTruckPlanningDashboard();
}

function setTruckFilter(val) {
    SelectedTruckFilter = val;
    populateSlicerButtons();
    renderTruckPlanningDashboard();
}

function setTypeFilter(val) {
    SelectedTypeFilter = val;
    // update type slicer active states
    document.querySelectorAll("#typeSlicerGrid .slicer-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-type") === val);
    });
    renderTruckPlanningDashboard();
}

function setHubFilter(val) {
    SelectedHubFilter = val;
    populateSlicerButtons();
    renderTruckPlanningDashboard();
}

function setCategoryFilter(val) {
    SelectedCategoryFilter = val;
    populateSlicerButtons();
    renderTruckPlanningDashboard();
}

function clearAllFilters() {
    SelectedTruckFilter = "ALL";
    SelectedBatchFilter = "ALL";
    SelectedTypeFilter = "ALL";
    SelectedHubFilter = "ALL";
    SelectedCategoryFilter = "ALL";
    TruckSearchTerm = "";
    const searchInput = document.getElementById("truckSearchInput");
    if (searchInput) searchInput.value = "";
    populateSlicerButtons();
    renderTruckPlanningDashboard();
}

// Helper to retrieve filtered rows based on current active slicers and search input
function getFilteredTruckPlanningData() {
    TruckSearchTerm = (document.getElementById("truckSearchInput")?.value || "").toLowerCase().trim();

    let filteredRows = [];

    TruckPlanningRawDOs.forEach(doRow => {
        const routeMatch = getRouteMatch(doRow);
        const doType = (routeMatch.doCategory || routeMatch.doType || "BIG").toUpperCase();
        const remark = doRow.remark || "";
        const fullDoText = remark ? `${doRow.inv} ${remark}` : doRow.inv;

        // Apply Type Slicer
        if (SelectedTypeFilter !== "ALL" && doType !== SelectedTypeFilter.toUpperCase()) return;

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

            // Apply Truck and Hub Slicers at Item Level
            if (SelectedTruckFilter !== "ALL" && !iTrucks.includes(SelectedTruckFilter)) return;
            if (SelectedHubFilter !== "ALL" && !iHubs.includes(SelectedHubFilter)) return;

            // Category Filter Check
            if (SelectedCategoryFilter !== "ALL") {
                if (!desc.toUpperCase().includes(`(${SelectedCategoryFilter})`)) return;
            }

            const batchVal = (item && item.batch) ? item.batch : (routeMatch.batch || "-");

            // Batch Slicer Filter Check
            if (SelectedBatchFilter !== "ALL") {
                const itemBatches = (batchVal && batchVal !== "-") ? batchVal.split(",").map(b => b.trim()) : [];
                if (!itemBatches.includes(SelectedBatchFilter) && batchVal !== SelectedBatchFilter) return;
            }

            // Search Term Filter Check
            if (TruckSearchTerm) {
                const searchable = `${batchVal} ${doRow.inv} ${doRow.route} ${doRow.name} ${doRow.addr} ${itemTruckStr} ${itemHubStr} ${code} ${desc} ${remark}`.toLowerCase();
                if (!searchable.includes(TruckSearchTerm)) return;
            }

            const itemVol = item.vol !== undefined && item.vol !== null ? parseFloat(item.vol) : null;
            const rowVol = itemVol !== null ? itemVol : (parseFloat(doRow.vol) || 0);

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
                vol: rowVol,
                isItemVol: itemVol !== null
            });
        });
    });

    return filteredRows;
}

// Export Filtered Manifest Data to Excel with Hub Sheet Tabs & KPI Cards
function exportTruckPlanningToExcel() {
    if (typeof XLSX === 'undefined') {
        showToast("Excel export library is loading or missing. Please refresh the page and try again.", "warning");
        return;
    }

    const filteredRows = getFilteredTruckPlanningData();
    if (!filteredRows || filteredRows.length === 0) {
        showToast("No DO records available to export with the currently selected filters.", "warning");
        return;
    }

    // Group items by Hub Number
    const hubGroups = {};
    filteredRows.forEach(row => {
        let hubs = row.hub && row.hub !== 'N/A' 
            ? row.hub.split(/[,/&]+/).map(h => h.trim()).filter(Boolean)
            : [];
        if (hubs.length === 0) {
            hubs = ["NO HUB"];
        }
        hubs.forEach(h => {
            const hubKey = h.toUpperCase();
            if (!hubGroups[hubKey]) {
                hubGroups[hubKey] = [];
            }
            hubGroups[hubKey].push(row);
        });
    });

    const wb = XLSX.utils.book_new();

    // Excel Style Definitions (Requires xlsx-js-style)
    const titleStyle = { font: { name: "Aptos Display", bold: true, sz: 14, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A8A" } }, alignment: { horizontal: "center", vertical: "center" } }; // Blue-900
    const subtitleStyle = { font: { name: "Aptos Display", bold: true, color: { rgb: "1E3A8A" } } };
    const sectionHeaderStyle = { font: { name: "Aptos Display", bold: true, sz: 12, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" } }, alignment: { horizontal: "center", vertical: "center" } }; // Blue-600
    const tableHeaderStyle = { font: { name: "Aptos Display", bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4B5563" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } }; // Gray-600
    const cellBorder = { border: { top: { style: 'thin', color: { rgb: "E5E7EB" } }, bottom: { style: 'thin', color: { rgb: "E5E7EB" } }, left: { style: 'thin', color: { rgb: "E5E7EB" } }, right: { style: 'thin', color: { rgb: "E5E7EB" } } } };
    const numberStyle = { ...cellBorder, font: { name: "Aptos Display" }, alignment: { horizontal: "right" } };
    const textStyle = { ...cellBorder, font: { name: "Aptos Display" }, alignment: { horizontal: "left" } };

    // Helper to safely apply style to a cell
    function styleCell(ws, address, styleObj) {
        if (!ws[address]) ws[address] = { t: 's', v: '' };
        ws[address].s = styleObj;
    }

    // Helper to calculate column widths based on data
    function getAutoFitColWidths(data) {
        const widths = [];
        data.forEach(row => {
            if (row.length < 5) return; // Skip title and KPI headers that span multiple columns
            row.forEach((cell, colIdx) => {
                if (cell == null) return;
                const len = cell.toString().length + 2;
                if (!widths[colIdx] || len > widths[colIdx]) {
                    widths[colIdx] = len;
                }
            });
        });
        return widths.map(w => ({ wch: Math.min(Math.max(w || 10, 10), 60) }));
    }

    // 1. OVERVIEW SUMMARY SHEET
    const overviewData = [];
    overviewData.push(["DAILY SUMMARY LIST & TRUCK PLANNING REPORT"]);
    overviewData.push(["Export Timestamp:", new Date().toLocaleString()]);
    overviewData.push(["Active Filters:", `Batch: ${SelectedBatchFilter} | Truck: ${SelectedTruckFilter} | Type: ${SelectedTypeFilter} | Hub: ${SelectedHubFilter} | Category: ${SelectedCategoryFilter} | Search: "${TruckSearchTerm || 'None'}"`]);
    overviewData.push([]);

    // Global KPIs
    const globalUniqueDos = new Set(filteredRows.map(r => r.invRaw)).size;
    const globalTotalQty = filteredRows.reduce((sum, r) => sum + r.qty, 0);
    let globalTotalM3 = 0;
    const globalVolByDo = {};
    filteredRows.forEach(r => { 
        if (r.isItemVol) {
            globalTotalM3 += r.vol;
        } else {
            globalVolByDo[r.invRaw] = r.vol; 
        }
    });
    globalTotalM3 += Object.values(globalVolByDo).reduce((sum, v) => sum + v, 0);
    const globalUniqueSkus = new Set(filteredRows.map(r => `${r.invRaw}___${r.productCode}`)).size;
    const globalTrucks = [...new Set(filteredRows.map(r => r.truck).filter(t => t && t !== 'N/A'))].join(", ") || "None";

    overviewData.push(["OVERALL SUMMARY"]);
    overviewData.push(["Total Selected DOs", "Total Quantity (Pcs)", "Total Volume (m³)", "Unique SKUs", "Active Physical Trucks"]);
    overviewData.push([globalUniqueDos, globalTotalQty, parseFloat(globalTotalM3.toFixed(2)), globalUniqueSkus, globalTrucks]);
    overviewData.push([]);

    overviewData.push(["HUB BREAKDOWN SUMMARY"]);
    overviewData.push(["Hub Name", "Total DOs", "Total Qty (Pcs)", "Total Volume (m³)", "Unique Models", "Assigned Trucks"]);

    const sortedHubKeys = Object.keys(hubGroups).sort((a, b) => {
        if (a === "NO HUB") return 1;
        if (b === "NO HUB") return -1;
        return a.localeCompare(b, undefined, { numeric: true });
    });

    sortedHubKeys.forEach(hubKey => {
        const rows = hubGroups[hubKey];
        const hubDos = new Set(rows.map(r => r.invRaw)).size;
        const hubQty = rows.reduce((sum, r) => sum + r.qty, 0);
        let hubM3 = 0;
        const hubVolByDo = {};
        rows.forEach(r => { 
            if (r.isItemVol) {
                hubM3 += r.vol;
            } else {
                hubVolByDo[r.invRaw] = r.vol; 
            }
        });
        hubM3 += Object.values(hubVolByDo).reduce((sum, v) => sum + v, 0);
        const hubModels = new Set(rows.map(r => r.modelName)).size;
        const hubTrucks = [...new Set(rows.map(r => r.truck).filter(t => t && t !== 'N/A'))].join(", ") || "None";

        overviewData.push([hubKey, hubDos, hubQty, parseFloat(hubM3.toFixed(2)), hubModels, hubTrucks]);
    });

    const overviewWs = XLSX.utils.aoa_to_sheet(overviewData);

    // Apply formatting to Overview Sheet
    // Merges
    if(!overviewWs['!merges']) overviewWs['!merges'] = [];
    overviewWs['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }); // Title
    overviewWs['!merges'].push({ s: { r: 4, c: 0 }, e: { r: 4, c: 4 } }); // KPI Header
    overviewWs['!merges'].push({ s: { r: 8, c: 0 }, e: { r: 8, c: 5 } }); // Hub Breakdown Header

    // Styles
    styleCell(overviewWs, "A1", titleStyle);
    styleCell(overviewWs, "A2", subtitleStyle);
    styleCell(overviewWs, "A3", subtitleStyle);
    styleCell(overviewWs, "A5", sectionHeaderStyle);
    
    // KPI headers
    ["A6", "B6", "C6", "D6", "E6"].forEach(cell => styleCell(overviewWs, cell, tableHeaderStyle));
    ["A7", "B7", "C7", "D7", "E7"].forEach(cell => styleCell(overviewWs, cell, textStyle));
    
    styleCell(overviewWs, "A9", sectionHeaderStyle);
    
    // Hub Breakdown Headers
    ["A10", "B10", "C10", "D10", "E10", "F10"].forEach(cell => styleCell(overviewWs, cell, tableHeaderStyle));

    // Hub Data rows
    for(let r = 10; r < 10 + sortedHubKeys.length; r++) {
        ["A", "B", "C", "D", "E", "F"].forEach(col => {
            styleCell(overviewWs, `${col}${r+1}`, textStyle);
        });
    }

    // Auto fit column widths for Overview Sheet
    overviewWs['!cols'] = getAutoFitColWidths(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewWs, "OVERVIEW");

    // 2. INDIVIDUAL HUB SHEETS
    const usedSheetNames = new Set(["OVERVIEW"]);

    sortedHubKeys.forEach(hubKey => {
        const rows = hubGroups[hubKey];

        const hubDos = new Set(rows.map(r => r.invRaw)).size;
        const hubQty = rows.reduce((sum, r) => sum + r.qty, 0);
        let hubM3 = 0;
        const hubVolByDo = {};
        rows.forEach(r => { 
            if (r.isItemVol) {
                hubM3 += r.vol;
            } else {
                hubVolByDo[r.invRaw] = r.vol; 
            }
        });
        hubM3 += Object.values(hubVolByDo).reduce((sum, v) => sum + v, 0);
        const hubModels = new Set(rows.map(r => r.modelName)).size;
        const hubTrucks = [...new Set(rows.map(r => r.truck).filter(t => t && t !== 'N/A'))].join(", ") || "None";

        const sheetData = [];
        sheetData.push([`HUB MANIFEST: ${hubKey}`]); // R0
        sheetData.push(["Export Timestamp:", new Date().toLocaleString()]); // R1
        sheetData.push([]); // R2

        // KPI Card Box Header embedded in Excel
        sheetData.push(["HUB SUMMARY"]); // R3
        sheetData.push(["Total DOs", "Total Qty (Pcs)", "Total Volume (m³)", "Unique Models", "Assigned Physical Trucks"]); // R4
        sheetData.push([hubDos, hubQty, parseFloat(hubM3.toFixed(2)), hubModels, hubTrucks]); // R5
        sheetData.push([]); // R6

        // Table Header
        sheetData.push(["DETAILED MANIFEST LIST"]); // R7
        sheetData.push(["Batch", "DO Number", "Type", "Product Code", "Model Name", "Qty (Pcs)", "Volume (m³)", "Truck", "Route", "Consignee"]); // R8

        rows.forEach(r => {
            sheetData.push([
                r.batch,
                r.doNo,
                r.type,
                r.productCode,
                r.modelName,
                r.qty,
                parseFloat(r.vol.toFixed(2)),
                r.truck,
                r.route,
                r.consignee
            ]);
        });

        // Format sheet tab name
        let cleanName = hubKey.replace(/[:\\/?*\[\]]/g, "_").trim();
        let sheetName = cleanName;
        if (!sheetName.toUpperCase().startsWith("HUB") && sheetName.toUpperCase() !== "NO HUB") {
            sheetName = `HUB ${sheetName}`;
        }
        sheetName = sheetName.substring(0, 31);

        let finalSheetName = sheetName;
        let counter = 1;
        while (usedSheetNames.has(finalSheetName.toUpperCase())) {
            finalSheetName = `${sheetName.substring(0, 28)}_${counter++}`;
        }
        usedSheetNames.add(finalSheetName.toUpperCase());

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Merges for Hub Sheet
        if(!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }); // Title
        ws['!merges'].push({ s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }); // KPI Header
        ws['!merges'].push({ s: { r: 7, c: 0 }, e: { r: 7, c: 8 } }); // Manifest Header

        // Styles
        styleCell(ws, "A1", titleStyle);
        styleCell(ws, "A2", subtitleStyle);
        styleCell(ws, "A4", sectionHeaderStyle);
        ["A5", "B5", "C5", "D5", "E5"].forEach(cell => styleCell(ws, cell, tableHeaderStyle));
        ["A6", "B6", "C6", "D6", "E6"].forEach(cell => styleCell(ws, cell, textStyle));
        
        styleCell(ws, "A8", sectionHeaderStyle);
        ["A9", "B9", "C9", "D9", "E9", "F9", "G9", "H9", "I9"].forEach(cell => styleCell(ws, cell, tableHeaderStyle));

        // Data rows
        for(let r = 9; r < 9 + rows.length; r++) {
            ["A", "B", "C", "D", "G", "H", "I"].forEach(col => { styleCell(ws, `${col}${r+1}`, textStyle); });
            ["E", "F"].forEach(col => { styleCell(ws, `${col}${r+1}`, numberStyle); });
        }

        ws['!cols'] = getAutoFitColWidths(sheetData);

        XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
    });

    const nowStr = new Date().toISOString().slice(0, 10);
    const filename = `Truck_Planning_Hubs_${nowStr}.xlsx`;
    XLSX.writeFile(wb, filename);
}

function toggleSimplifyMode() {
    isSimplifyMode = !isSimplifyMode;
    const btn = document.getElementById('btnSimplifyMode');
    if (isSimplifyMode) {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg> Simplify View: ON`;
        btn.style.backgroundColor = 'var(--accent, #8b5cf6)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'var(--accent, #8b5cf6)';
    } else {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg> Simplify View: OFF`;
        btn.style.backgroundColor = 'transparent';
        btn.style.color = 'var(--fg, #f4f4f5)';
        btn.style.borderColor = 'var(--border, #3f3f46)';
    }
    renderTruckPlanningDashboard();
}

// Filter and Render Main Manifest Table + Update KPI Boxes
function renderTruckPlanningDashboard() {
    const filteredRows = getFilteredTruckPlanningData();

    // Calculate KPI Totals
    const uniqueDos = new Set(filteredRows.map(r => r.invRaw)).size;
    const uniqueModels = new Set(filteredRows.map(r => r.modelName)).size;
    
    // Count distinct (DO, SKU) pairs so if 2 DOs contain the same SKU, it is counted as 2
    const doSkuSet = new Set();
    filteredRows.forEach(r => {
        if (r.productCode && r.productCode !== '-') {
            doSkuSet.add(`${r.invRaw}___${r.productCode}`);
        }
    });
    const totalSkus = doSkuSet.size;

    const totalQty = filteredRows.reduce((sum, r) => sum + r.qty, 0);

    // Total m3 summed over UNIQUE DOs or item-specific volumes
    let totalM3 = 0;
    const volByDo = {};
    filteredRows.forEach(r => { 
        if (r.isItemVol) {
            totalM3 += r.vol;
        } else {
            volByDo[r.invRaw] = r.vol; 
        }
    });
    totalM3 += Object.values(volByDo).reduce((sum, v) => sum + v, 0);

    document.getElementById("kpiTotalDos").innerText = uniqueDos.toLocaleString();
    const modelsKpi = document.getElementById("kpiTotalModels");
    if (modelsKpi) modelsKpi.innerText = uniqueModels.toLocaleString();
    const skuKpi = document.getElementById("kpiTotalSkus");
    if (skuKpi) skuKpi.innerText = totalSkus.toLocaleString();
    document.getElementById("kpiTotalQty").innerText = totalQty.toLocaleString();
    const m3Kpi = document.getElementById("kpiTotalM3");
    if (m3Kpi) m3Kpi.innerText = totalM3.toFixed(2) + " m³";

    // Render Table Rows
    // When a Truck is selected, hide Truck/Hub/Route/Consignee columns and show a
    // manifest header (TRUCK / HUB / CONSIGNEE / ROUTE) above the table. Selecting
    // a truck auto-filters hubs to that truck, so "All Hubs" = that truck's hubs.
    const tbody = document.getElementById("truckPlanningTableBody");
    const headRow = document.getElementById("truckPlanningTableHeadRow");
    const manifestHeader = document.getElementById("truckManifestHeader");
    if (!tbody) return;

    const showManifestView = SelectedTruckFilter !== "ALL";

    if (filteredRows.length === 0) {
        if (manifestHeader) manifestHeader.style.display = "none";
        tbody.innerHTML = `<tr><td colspan="${showManifestView ? 7 : 11}" style="text-align:center; padding:32px; color:#a1a1aa;">No DO manifests match current filter selection.</td></tr>`;
        return;
    }

    let tableHtml = "";

    if (showManifestView) {
        // Populate manifest header from filtered rows (dedupe hubs/consignees/routes cleanly)
        const uniqueConsignees = [...new Set(filteredRows.map(r => r.consignee).flatMap(c => String(c || "").split(/[,/&]+/).map(x => x.trim())).filter(Boolean))].join(", ");
        const uniqueRoutes = [...new Set(filteredRows.map(r => r.route).flatMap(rt => String(rt || "").split(/[,/&]+/).map(x => x.trim())).filter(Boolean))].join(", ");
        const uniqueHubs = [...new Set(filteredRows.map(r => r.hub).flatMap(h => String(h || "").split(/[,/&]+/).map(x => x.trim())).filter(Boolean))].join(", ");

        if (manifestHeader) {
            manifestHeader.style.display = "grid";
            document.getElementById("manifestTruck").innerText = SelectedTruckFilter;
            document.getElementById("manifestConsignee").innerText = uniqueConsignees;
            document.getElementById("manifestHub").innerText = SelectedHubFilter !== "ALL" ? SelectedHubFilter : uniqueHubs;
            document.getElementById("manifestRoute").innerText = uniqueRoutes;
        }

        if (headRow) {
            if (isSimplifyMode) {
                headRow.innerHTML = `
                    <th>Batch</th>
                    <th>DO Number</th>
                    <th>Unique SKUs</th>
                    <th class="number-col">Total Qty</th>
                    <th class="number-col">m³</th>
                    <th>Item Breakdown</th>`;
            } else {
                headRow.innerHTML = `
                    <th>Batch</th>
                    <th>DO Number</th>
                    <th>Type</th>
                    <th>Product Code</th>
                    <th>Model Name</th>
                    <th class="number-col">Total</th>
                    <th class="number-col">m³</th>`;
            }
        }

        if (isSimplifyMode) {
            const groupedByDo = {};
            filteredRows.forEach(row => {
                if (!groupedByDo[row.invRaw]) {
                    groupedByDo[row.invRaw] = {
                        batch: row.batch,
                        doNo: row.doNo,
                        invRaw: row.invRaw,
                        totalQty: 0,
                        totalVol: 0,
                        items: []
                    };
                }
                groupedByDo[row.invRaw].totalQty += row.qty;
                groupedByDo[row.invRaw].totalVol += row.vol;
                groupedByDo[row.invRaw].items.push(`${row.qty}x [${row.productCode}]`);
            });

            Object.values(groupedByDo).forEach(g => {
                const breakdown = g.items.join(' | ');
                const uniqueSkus = g.items.length;
                tableHtml += `
                <tr style="cursor: context-menu;" title="Right-click to inspect DO details" oncontextmenu="event.preventDefault(); openDoDetailsTab('${g.invRaw}')">
                    <td><strong style="color: #ef4444;">${g.batch}</strong></td>
                    <td><strong>${g.doNo}</strong></td>
                    <td><strong>${uniqueSkus}</strong></td>
                    <td class="number-col" style="font-weight: 800; color: #8b5cf6;">${g.totalQty.toLocaleString()}</td>
                    <td class="number-col" style="font-weight: 700; color: #f59e0b;">${g.totalVol.toFixed(2)}</td>
                    <td style="font-size: 11px; color: var(--fg-muted); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${breakdown}">${breakdown}</td>
                </tr>
                `;
            });
        } else {
            filteredRows.forEach(row => {
                const typeBadge = row.type === 'BIG' ? 'category-big' : row.type === 'SMALL' ? 'category-small' : 'category-mix';
                tableHtml += `
                <tr style="cursor: context-menu;" title="Right-click to inspect DO details" oncontextmenu="event.preventDefault(); openDoDetailsTab('${row.invRaw}')">
                    <td><strong style="color: #ef4444;">${row.batch}</strong></td>
                    <td><strong>${row.doNo}</strong></td>
                    <td><span class="category-badge ${typeBadge}">${row.type}</span></td>
                    <td style="font-family: monospace; font-weight: 700; color: #10b981;">${row.productCode}</td>
                    <td>${row.modelName}</td>
                    <td class="number-col" style="font-weight: 800; color: #8b5cf6;">${row.qty.toLocaleString()}</td>
                    <td class="number-col" style="font-weight: 700; color: #f59e0b;">${row.vol.toFixed(2)}</td>
                </tr>
                `;
            });
        }
    } else {
        if (manifestHeader) manifestHeader.style.display = "none";
        if (headRow) {
            if (isSimplifyMode) {
                headRow.innerHTML = `
                    <th>Batch</th>
                    <th>Truck</th>
                    <th>Hub</th>
                    <th>Route</th>
                    <th>Consignee</th>
                    <th>DO Number</th>
                    <th>Unique SKUs</th>
                    <th class="number-col">Total Qty</th>
                    <th class="number-col">m³</th>
                    <th>Item Breakdown</th>`;
            } else {
                headRow.innerHTML = `
                    <th>Batch</th>
                    <th>Truck</th>
                    <th>Hub</th>
                    <th>Route</th>
                    <th>Consignee</th>
                    <th>DO Number</th>
                    <th>Type</th>
                    <th>Product Code</th>
                    <th>Model Name</th>
                    <th class="number-col">Total</th>
                    <th class="number-col">m³</th>`;
            }
        }

        if (isSimplifyMode) {
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
                        totalVol: 0,
                        items: []
                    };
                }
                groupedByDo[row.invRaw].totalQty += row.qty;
                groupedByDo[row.invRaw].totalVol += row.vol;
                groupedByDo[row.invRaw].items.push(`${row.qty}x [${row.productCode}]`);
            });

            Object.values(groupedByDo).forEach(g => {
                const breakdown = g.items.join(' | ');
                const uniqueSkus = g.items.length;
                tableHtml += `
                <tr style="cursor: context-menu;" title="Right-click to inspect DO details" oncontextmenu="event.preventDefault(); openDoDetailsTab('${g.invRaw}')">
                    <td><strong style="color: #ef4444;">${g.batch}</strong></td>
                    <td><strong style="color: #3b82f6;">${g.truck}</strong></td>
                    <td><strong>${g.hub}</strong></td>
                    <td>${g.route}</td>
                    <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${g.consignee}</td>
                    <td><strong>${g.doNo}</strong></td>
                    <td><strong>${uniqueSkus}</strong></td>
                    <td class="number-col" style="font-weight: 800; color: #8b5cf6;">${g.totalQty.toLocaleString()}</td>
                    <td class="number-col" style="font-weight: 700; color: #f59e0b;">${g.totalVol.toFixed(2)}</td>
                    <td style="font-size: 11px; color: var(--fg-muted); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${breakdown}">${breakdown}</td>
                </tr>
                `;
            });
        } else {
            filteredRows.forEach(row => {
                const typeBadge = row.type === 'BIG' ? 'category-big' : row.type === 'SMALL' ? 'category-small' : 'category-mix';
                tableHtml += `
                <tr style="cursor: context-menu;" title="Right-click to inspect DO details" oncontextmenu="event.preventDefault(); openDoDetailsTab('${row.invRaw}')">
                    <td><strong style="color: #ef4444;">${row.batch}</strong></td>
                    <td><strong style="color: #3b82f6;">${row.truck}</strong></td>
                    <td><strong>${row.hub}</strong></td>
                    <td>${row.route}</td>
                    <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${row.consignee}</td>
                    <td><strong>${row.doNo}</strong></td>
                    <td><span class="category-badge ${typeBadge}">${row.type}</span></td>
                    <td style="font-family: monospace; font-weight: 700; color: #10b981;">${row.productCode}</td>
                    <td>${row.modelName}</td>
                    <td class="number-col" style="font-weight: 800; color: #8b5cf6;">${row.qty.toLocaleString()}</td>
                    <td class="number-col" style="font-weight: 700; color: #f59e0b;">${row.vol.toFixed(2)}</td>
                </tr>
                `;
            });
        }
    }
    tbody.innerHTML = tableHtml;
}


// Opens DO breakdown detail page in a new tab upon right-click
function openDoDetailsTab(invoiceNo) {
    if (!invoiceNo) return;
    localStorage.setItem("SelectedDoForDetails", invoiceNo);
    localStorage.setItem("DoDetailsReturnTo", "truck_planning.html");
    window.open('do_details.html', '_blank');
}
