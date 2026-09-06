// Global Storage Vaults
let ProductMasterLookupMap = {};
let MasterBatchLookupMap = {};
let DataHoarderArray = [];
let MasterFileStoreArray = [];

// Interactive Explorer Filter & Sort State
let explorerFilters = {
    doText: "",
    selectedDos: new Set(), // Set of ticked DO invoice numbers
    isDoSelectionActive: false, // true when user explicitly restricted to a ticked DO subset
    filterOnlyTicked: false, // toggle to show only ticked rows
    onlyDirect5m3: false, // Quick filter for Addresses Exceeding 5 m³ Volume (able to go direct)
    onlyNonDirect: false, // Quick filter for Non-Direct Delivery (exclude direct DOs)
    route: "ALL",
    consignee: "",
    address: "",
    division: "ALL",
    preset: "ALL",
    minVol: "",
    minQty: "",
    category: "ALL"
};

// Excel-Style Per-Column AutoFilter State (null = All items selected, Set<string> = filtered subset)
let excelColumnFilters = {
    inv: null,
    route: null,
    name: null,
    addr: null,
    vol: null,
    qty: null,
    sku: null,
    cat: null
};

let activeExcelMenuState = {
    colKey: null,
    colTitle: '',
    items: [], // Array of { value: string, label: string, count: number }
    tempSelected: new Set(),
    searchQuery: ''
};

let explorerSort = {
    col: 'inv',
    direction: 'asc'
};

let currentFilteredDataset = [];
let isCompactDensity = false;
let activeDataSourceType = 'none'; // 'generator' | 'upload' | 'sample'
let activeDataSourceDetail = '';

// Update memory status badge with clean chip pills and individual ✕ remove buttons
function updateMemoryBadge() {
    const BadgeElement = document.getElementById("memoryStatusBadge");
    if (!BadgeElement) return;

    const SavedDoNameRaw = localStorage.getItem("LastDoSummaryFileName");
    const SavedRouteNameRaw = localStorage.getItem("LastRouteFileName");
    const SavedInsightName = localStorage.getItem("LastShippingInsightFileName");

    if (!SavedDoNameRaw && !SavedRouteNameRaw && !SavedInsightName) {
        BadgeElement.innerHTML = "";
        return;
    }

    let activeDoFilter = localStorage.getItem("ActiveDoSummaryFilter");
    let displayDoName = SavedDoNameRaw;
    if (activeDoFilter && activeDoFilter !== "ALL") {
        displayDoName = activeDoFilter;
    } else if (displayDoName && displayDoName.includes(',')) {
        displayDoName = "All DO Files Combined";
    }

    let activeBatchFilter = localStorage.getItem("ActiveBatchFilter");
    let displayRouteName = SavedRouteNameRaw;
    if (activeBatchFilter && activeBatchFilter !== "ALL") {
        displayRouteName = activeBatchFilter;
    } else if (displayRouteName && displayRouteName.includes(',')) {
        displayRouteName = "All Batch Files Combined";
    }

    let html = "";
    if (displayDoName) {
        html += `<span class="file-chip green" title="DO Summary File: ${displayDoName}">📄 ${displayDoName} <button type="button" class="chip-remove-btn" onclick="resetSpecificFile('do')" title="Remove DO Summary File">✕</button></span>`;
    }
    if (displayRouteName) {
        html += `<span class="file-chip blue" title="Batch Picking File: ${displayRouteName}">📦 ${displayRouteName} <button type="button" class="chip-remove-btn" onclick="resetSpecificFile('batch')" title="Remove Batch Picking File">✕</button></span>`;
    }
    if (SavedInsightName) {
        html += `<span class="file-chip purple" title="Shipping Insight File: ${SavedInsightName}">🚚 ${SavedInsightName} <button type="button" class="chip-remove-btn" onclick="resetSpecificFile('shipping')" title="Remove Shipping Insight File">✕</button></span>`;
    }
    BadgeElement.innerHTML = html;
}

// Update Data Source Badge in Dual-Mode Ingestion Bar
function updateDataSourceStatus(type, detail) {
    if (type) activeDataSourceType = type;
    if (detail !== undefined) activeDataSourceDetail = detail;

    const badge = document.getElementById("dataSourceStatusBadge");
    const textSpan = document.getElementById("dataSourceStatusText");
    const countPill = document.getElementById("activeRecordCountPill");

    if (!badge || !textSpan) return;

    badge.className = "sync-status-badge";
    const totalCount = DataHoarderArray.length;

    if (totalCount === 0) {
        badge.classList.add("empty");
        textSpan.innerText = "No DO Summary loaded";
        if (countPill) countPill.innerText = "0 Total DOs in Dataset";
        return;
    }

    if (activeDataSourceType === 'generator') {
        textSpan.innerText = `Synced with Generator (${activeDataSourceDetail || 'Live Batches'})`;
    } else if (activeDataSourceType === 'upload') {
        badge.classList.add("standalone");
        textSpan.innerText = `Standalone File: ${activeDataSourceDetail || 'Uploaded'}`;
    } else {
        badge.classList.add("standalone");
        textSpan.innerText = activeDataSourceDetail || "DO Summary Active";
    }

    if (countPill) {
        countPill.innerText = `${totalCount.toLocaleString()} Total DOs in Dataset`;
    }
}

// 1. Dual-Mode Ingestion: Auto-sync from active DO Summary Generator session
function syncWithGeneratorSession(showAlert = false) {
    try {
        const dsgSessionRaw = localStorage.getItem("dsg_session_state_v1") || localStorage.getItem("dsg_batch_data");
        const lastDoSummaryRaw = localStorage.getItem("LastUploadedDoSummary");

        let loadedRows = [];
        let sourceDetail = "Active Generator Session";

        if (dsgSessionRaw) {
            const parsed = JSON.parse(dsgSessionRaw);
            // Handle various DO summary generator session structures
            let batches = [];
            if (Array.isArray(parsed)) {
                batches = parsed;
            } else if (parsed && typeof parsed === 'object') {
                batches = parsed.batches || parsed.data || (parsed.items ? [parsed] : []);
            }

            if (batches.length > 0) {
                batches.forEach((b, bIdx) => {
                    const batchNo = b.batchNo || b.batch || `Batch-${bIdx + 1}`;
                    const items = b.items || b.orders || [b];
                    
                    items.forEach(item => {
                        const invNo = String(item.inv || item.invoiceNo || item.doNumber || item.invoice || '').trim();
                        if (!invNo) return;
                        
                        const volVal = parseFloat(item.vol || item.volume || item.cbm || 0) || 0;
                        const qtyVal = parseInt(item.qty || item.quantity || item.totalQty || 0, 10) || 0;
                        const skuVal = parseInt(item.sku || item.skuCount || item.uniqueSku || 1, 10) || 1;
                        
                        loadedRows.push({
                            inv: invNo,
                            div: String(item.div || item.division || 'DIV-1').trim(),
                            route: String(item.route || item.routeName || 'ROUTE-1').trim(),
                            name: String(item.name || item.consignee || item.customerName || 'Consignee').trim(),
                            addr: String(item.addr || item.address || item.deliveryAddress || '').trim(),
                            vol: volVal,
                            qty: qtyVal,
                            sku: skuVal,
                            remark: String(item.remark || item.remarks || '').trim(),
                            fileName: `Generator_${batchNo}`
                        });
                    });
                });
                sourceDetail = `${batches.length} Generator Batch${batches.length > 1 ? 'es' : ''}`;
            }
        }

        if (loadedRows.length === 0 && lastDoSummaryRaw) {
            loadedRows = JSON.parse(lastDoSummaryRaw);
            sourceDetail = "Stored Generator Session";
        }

        if (loadedRows.length === 0) {
            if (showAlert) {
                if (typeof showToast === 'function') {
                    showToast("No active batches found in Generator session. Try uploading a DO Summary file or creating batches in Generator!", "info");
                } else {
                    alert("No active batches found in DO Summary Generator session.");
                }
            }
            return;
        }

        // Deduplicate or combine
        DataHoarderArray = loadedRows;
        MasterFileStoreArray = [...loadedRows];
        localStorage.setItem("LastUploadedDoSummary", JSON.stringify(DataHoarderArray));
        localStorage.setItem("RawUploadedDoSummary", JSON.stringify(MasterFileStoreArray));
        localStorage.setItem("LastDoSummaryFileName", "DO_Generator_Batches.xlsx");

        updateDataSourceStatus('generator', sourceDetail);
        updateMemoryBadge();
        populateExplorerDropdowns();
        handleExplorerFilterChange();
        refreshDashboard();

        if (showAlert && typeof showToast === 'function') {
            showToast(`Successfully synced ${loadedRows.length} DO records from Generator session!`, "success");
        }
    } catch (e) {
        console.error("Failed to sync with Generator session:", e);
        if (showAlert) {
            if (typeof showToast === 'function') {
                showToast("Failed to sync generator session: " + e.message, "error");
            } else {
                alert("Error syncing generator session: " + e.message);
            }
        }
    }
}

// 2. Dual-Mode Ingestion: Standalone Excel/CSV file upload
function handleStandaloneExplorerUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Prefer DO Summary or first sheet
            let sheetName = workbook.SheetNames.find(s => 
                s.toLowerCase().includes('summary') || 
                s.toLowerCase().includes('do') || 
                s.toLowerCase().includes('sheet1')
            ) || workbook.SheetNames[0];

            const sheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

            if (!rawRows || rawRows.length < 2) {
                throw new Error("File contains empty or insufficient data rows.");
            }

            // Detect header row index
            let headerIdx = 0;
            let colMap = { inv: -1, div: -1, route: -1, name: -1, addr: -1, vol: -1, qty: -1, sku: -1, remark: -1 };

            for (let i = 0; i < Math.min(10, rawRows.length); i++) {
                const row = rawRows[i].map(c => String(c || '').toLowerCase().trim());
                const invIdx = row.findIndex(c => c.includes('invoice') || c.includes('do number') || c.includes('do no') || c === 'do' || c.includes('inv'));
                if (invIdx !== -1) {
                    headerIdx = i;
                    colMap.inv = invIdx;
                    colMap.div = row.findIndex(c => c.includes('div') || c.includes('division'));
                    colMap.route = row.findIndex(c => c.includes('route') || c.includes('zone') || c.includes('trip'));
                    colMap.name = row.findIndex(c => c.includes('name') || c.includes('consignee') || c.includes('customer'));
                    colMap.addr = row.findIndex(c => c.includes('address') || c.includes('addr') || c.includes('destination'));
                    colMap.vol = row.findIndex(c => c.includes('volume') || c.includes('m3') || c.includes('m³') || c.includes('cbm'));
                    colMap.qty = row.findIndex(c => c.includes('qty') || c.includes('quantity') || c.includes('pcs') || c.includes('ctn'));
                    colMap.sku = row.findIndex(c => c.includes('sku') || c.includes('item'));
                    colMap.remark = row.findIndex(c => c.includes('remark') || c.includes('note') || c.includes('remarks'));
                    break;
                }
            }

            // Fallback default column indices if header not found
            if (colMap.inv === -1) {
                colMap = { inv: 0, div: 1, route: 2, name: 3, addr: 4, vol: 5, qty: 6, sku: 7, remark: 8 };
                headerIdx = 0;
            }

            const parsedRows = [];
            for (let r = headerIdx + 1; r < rawRows.length; r++) {
                const row = rawRows[r];
                if (!row || row.length === 0) continue;

                const invVal = String(row[colMap.inv] || '').trim();
                if (!invVal || invVal.toLowerCase() === 'total' || invVal.toLowerCase().includes('grand total')) continue;

                const volNum = colMap.vol !== -1 ? (parseFloat(String(row[colMap.vol] || '').replace(/,/g, '')) || 0) : 0;
                const qtyNum = colMap.qty !== -1 ? (parseInt(String(row[colMap.qty] || '').replace(/,/g, ''), 10) || 0) : 0;
                const skuNum = colMap.sku !== -1 ? (parseInt(String(row[colMap.sku] || '').replace(/,/g, ''), 10) || 1) : 1;

                parsedRows.push({
                    inv: invVal,
                    div: colMap.div !== -1 ? String(row[colMap.div] || 'DIV-1').trim() : 'DIV-1',
                    route: colMap.route !== -1 ? String(row[colMap.route] || 'ROUTE-1').trim() : 'ROUTE-1',
                    name: colMap.name !== -1 ? String(row[colMap.name] || 'Consignee').trim() : 'Consignee',
                    addr: colMap.addr !== -1 ? String(row[colMap.addr] || '').trim() : '',
                    vol: volNum,
                    qty: qtyNum,
                    sku: skuNum,
                    remark: colMap.remark !== -1 ? String(row[colMap.remark] || '').trim() : '',
                    fileName: file.name
                });
            }

            if (parsedRows.length === 0) {
                throw new Error("No valid DO records could be extracted from file.");
            }

            DataHoarderArray = parsedRows;
            MasterFileStoreArray = [...parsedRows];
            localStorage.setItem("LastUploadedDoSummary", JSON.stringify(DataHoarderArray));
            localStorage.setItem("RawUploadedDoSummary", JSON.stringify(MasterFileStoreArray));
            localStorage.setItem("LastDoSummaryFileName", file.name);

            updateDataSourceStatus('upload', file.name);
            updateMemoryBadge();
            populateExplorerDropdowns();
            handleExplorerFilterChange();
            refreshDashboard();

            if (typeof showToast === 'function') {
                showToast(`Loaded ${parsedRows.length} DO records from ${file.name}!`, "success");
            }
        } catch (err) {
            console.error("Standalone file upload error:", err);
            if (typeof showToast === 'function') {
                showToast("Failed to parse file: " + err.message, "error");
            } else {
                alert("Failed to parse file: " + err.message);
            }
        }
    };
    reader.readAsArrayBuffer(file);
}

// =========================================================================
// DO Multi-Select Checkbox Picker & Table Selection Engine
// =========================================================================

function toggleDoPickerPopover(forceState) {
    const popover = document.getElementById("doPickerPopover");
    if (!popover) return;

    const isOpen = forceState !== undefined ? forceState : popover.classList.toggle("open");
    if (forceState !== undefined) {
        if (forceState) popover.classList.add("open");
        else popover.classList.remove("open");
    }

    if (isOpen) {
        populateDoPickerList();
        const searchInp = document.getElementById("doPickerSearchInput");
        if (searchInp) {
            searchInp.value = "";
            setTimeout(() => searchInp.focus(), 50);
        }
        
        // Add click outside listener
        setTimeout(() => {
            document.addEventListener("click", handleDoPickerClickOutside);
        }, 10);
    } else {
        document.removeEventListener("click", handleDoPickerClickOutside);
    }
}

function handleDoPickerClickOutside(e) {
    const container = document.getElementById("doPickerContainer");
    if (container && !container.contains(e.target)) {
        toggleDoPickerPopover(false);
    }
}

// Return candidate DO invoices based on active quick filters (e.g. Direct Delivery > 5m³ or Non-Direct Delivery)
function getCandidateDoList() {
    const directInvoices = getDirectDeliveryEligibleInvoices();
    if (explorerFilters.onlyDirect5m3) {
        return Array.from(new Set(DataHoarderArray.filter(r => directInvoices.has(r.inv)).map(r => r.inv))).sort();
    }
    if (explorerFilters.onlyNonDirect) {
        return Array.from(new Set(DataHoarderArray.filter(r => !directInvoices.has(r.inv)).map(r => r.inv))).sort();
    }
    return Array.from(new Set(DataHoarderArray.map(r => r.inv))).sort();
}

// Populate the scrollable checklist inside DO Multi-Select Popover
function populateDoPickerList() {
    const listEl = document.getElementById("doPickerList");
    const counterEl = document.getElementById("doPickerListCounter");
    if (!listEl) return;

    if (DataHoarderArray.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; color: var(--fg-muted); font-size: 12px; padding: 24px;">No DO records loaded. Sync or upload data first.</div>`;
        if (counterEl) counterEl.innerText = "0 of 0 selected";
        return;
    }

    // Get candidate DO list based on Direct / Non-Direct Delivery quick filter state
    const uniqueDos = getCandidateDoList();
    const isDirectFilter = explorerFilters.onlyDirect5m3;
    const isNonDirectFilter = explorerFilters.onlyNonDirect;
    
    // Map DO details for easy preview
    const doSummaryMap = {};
    DataHoarderArray.forEach(r => {
        if (!doSummaryMap[r.inv]) {
            doSummaryMap[r.inv] = {
                consignee: r.name || 'Consignee',
                route: r.route || 'Route',
                vol: r.vol || 0,
                qty: r.qty || 0
            };
        }
    });

    // If selection is not active, all candidate unique DOs are treated as selected
    const isAllSelected = !explorerFilters.isDoSelectionActive;
    let selectedCount = 0;

    let html = "";
    uniqueDos.forEach(inv => {
        const isChecked = isAllSelected || explorerFilters.selectedDos.has(inv);
        if (isChecked) selectedCount++;
        const info = doSummaryMap[inv] || {};

        html += `
            <div class="do-picker-item ${isChecked ? 'selected' : ''}" id="do_item_${escapeAttr(inv)}" onclick="toggleDoCheckboxItem('${escapeAttr(inv)}')">
                <input type="checkbox" id="do_check_${escapeAttr(inv)}" class="spreadsheet-row-check" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); handleDoCheckboxToggle('${escapeAttr(inv)}', this.checked)">
                <div class="do-picker-item-info">
                    <div class="do-picker-item-title">${inv}</div>
                    <div class="do-picker-item-sub">${escapeHtml(info.consignee)} • ${escapeHtml(info.route)} • ${info.vol > 0 ? Number(info.vol).toFixed(3) + 'm³' : '0m³'}</div>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
    if (counterEl) {
        let filterLabel = "";
        if (isDirectFilter) filterLabel = " (Direct >5m³)";
        else if (isNonDirectFilter) filterLabel = " (Non-Direct)";
        counterEl.innerText = `${selectedCount} of ${uniqueDos.length} selected${filterLabel}`;
    }
}

function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Filter items in DO Picker Popover search box
function filterDoPickerList(query) {
    const q = (query || '').toLowerCase().trim();
    const items = document.querySelectorAll('#doPickerList .do-picker-item');
    items.forEach(el => {
        const text = el.textContent.toLowerCase();
        if (!q || text.includes(q)) {
            el.style.display = 'flex';
        } else {
            el.style.display = 'none';
        }
    });
}

// Toggle DO Checkbox item when clicked
function toggleDoCheckboxItem(inv) {
    const chk = document.getElementById(`do_check_${inv}`);
    if (chk) {
        chk.checked = !chk.checked;
        handleDoCheckboxToggle(inv, chk.checked);
    }
}

// Handle single DO checkbox change in Popover
function handleDoCheckboxToggle(inv, checked) {
    const candidateDos = getCandidateDoList();
    // If transitioning from all selected, initialize the set with all candidate DOs first
    if (!explorerFilters.isDoSelectionActive) {
        explorerFilters.isDoSelectionActive = true;
        explorerFilters.selectedDos = new Set(candidateDos);
    }

    if (checked) {
        explorerFilters.selectedDos.add(inv);
    } else {
        explorerFilters.selectedDos.delete(inv);
    }

    const itemEl = document.getElementById(`do_item_${inv}`);
    if (itemEl) {
        if (checked) itemEl.classList.add('selected');
        else itemEl.classList.remove('selected');
    }

    updateDoPickerCounter();
}

// Select All / Deselect All in Popover
function selectAllDoCheckboxes(selectAll) {
    const candidateDos = getCandidateDoList();
    
    if (selectAll) {
        explorerFilters.isDoSelectionActive = false; // Reset to all
        explorerFilters.selectedDos.clear();
    } else {
        explorerFilters.isDoSelectionActive = true;
        explorerFilters.selectedDos.clear();
    }

    const checkboxes = document.querySelectorAll('#doPickerList input[type="checkbox"]');
    checkboxes.forEach(chk => {
        chk.checked = selectAll;
        const itemEl = chk.closest('.do-picker-item');
        if (itemEl) {
            if (selectAll) itemEl.classList.add('selected');
            else itemEl.classList.remove('selected');
        }
    });

    updateDoPickerCounter();
}

// Invert DO Checkbox selection in Popover
function invertDoCheckboxes() {
    const candidateDos = getCandidateDoList();
    
    if (!explorerFilters.isDoSelectionActive) {
        explorerFilters.isDoSelectionActive = true;
        explorerFilters.selectedDos = new Set();
    } else {
        const newSet = new Set();
        candidateDos.forEach(inv => {
            if (!explorerFilters.selectedDos.has(inv)) {
                newSet.add(inv);
            }
        });
        explorerFilters.selectedDos = newSet;
    }

    const checkboxes = document.querySelectorAll('#doPickerList input[type="checkbox"]');
    checkboxes.forEach(chk => {
        chk.checked = !chk.checked;
        const itemEl = chk.closest('.do-picker-item');
        if (itemEl) {
            if (chk.checked) itemEl.classList.add('selected');
            else itemEl.classList.remove('selected');
        }
    });

    updateDoPickerCounter();
}

function updateDoPickerCounter() {
    const candidateDos = getCandidateDoList();
    const totalCandidate = candidateDos.length;
    let selectedCount = 0;
    if (!explorerFilters.isDoSelectionActive) {
        selectedCount = totalCandidate;
    } else {
        candidateDos.forEach(inv => {
            if (explorerFilters.selectedDos.has(inv)) selectedCount++;
        });
    }

    const counterEl = document.getElementById("doPickerListCounter");
    if (counterEl) {
        let filterSuffix = "";
        if (explorerFilters.onlyDirect5m3) filterSuffix = " (Direct >5m³)";
        else if (explorerFilters.onlyNonDirect) filterSuffix = " (Non-Direct)";
        counterEl.innerText = `${selectedCount} of ${totalCandidate} selected${filterSuffix}`;
    }
}

// Reset DO Selection to All
function resetDoSelectionToAll() {
    explorerFilters.isDoSelectionActive = false;
    explorerFilters.selectedDos.clear();
    explorerFilters.filterOnlyTicked = false;
    
    selectAllDoCheckboxes(true);
    updateDoPickerTriggerBadge();
    toggleDoPickerPopover(false);
    applyExplorerFilters();

    if (typeof showToast === 'function') {
        showToast("DO Filter reset to include all Delivery Orders.", "info");
    }
}

// Apply selection from Popover to dashboard
function applyDoPickerSelection() {
    const candidateDos = getCandidateDoList();
    const totalCandidate = candidateDos.length;
    let selectedCount = 0;
    if (!explorerFilters.isDoSelectionActive) {
        selectedCount = totalCandidate;
    } else {
        candidateDos.forEach(inv => {
            if (explorerFilters.selectedDos.has(inv)) selectedCount++;
        });
    }

    if (explorerFilters.isDoSelectionActive && selectedCount === totalCandidate) {
        explorerFilters.isDoSelectionActive = false;
    }

    updateDoPickerTriggerBadge();
    toggleDoPickerPopover(false);
    applyExplorerFilters();

    if (typeof showToast === 'function') {
        const msg = !explorerFilters.isDoSelectionActive
            ? "Showing All Delivery Orders"
            : `Filtered to ${selectedCount} selected Delivery Order${selectedCount === 1 ? '' : 's'}`;
        showToast(msg, "success");
    }
}

// Update the DO picker trigger button label and badge
function updateDoPickerTriggerBadge() {
    const badge = document.getElementById("doPickerSelectedBadge");
    const label = document.getElementById("doPickerTriggerLabel");
    const candidateDos = getCandidateDoList();
    const totalCandidate = candidateDos.length;
    
    if (!badge || !label) return;

    if (!explorerFilters.isDoSelectionActive) {
        badge.className = "do-picker-badge all";
        let suffix = "";
        if (explorerFilters.onlyDirect5m3) suffix = " Direct";
        else if (explorerFilters.onlyNonDirect) suffix = " Non-Direct";
        badge.innerText = `All${suffix} (${totalCandidate})`;
        label.innerText = "Tick DOs";
    } else {
        let count = 0;
        candidateDos.forEach(inv => {
            if (explorerFilters.selectedDos.has(inv)) count++;
        });
        badge.className = "do-picker-badge custom";
        badge.innerText = `${count} of ${totalCandidate} DOs`;
        label.innerText = `Ticked (${count})`;
    }

    updateTickedToolbarButtons();
}

// Spreadsheet Table Row Checkbox Handlers
function toggleSelectAllVisibleRows(checked) {
    if (!explorerFilters.isDoSelectionActive) {
        explorerFilters.isDoSelectionActive = true;
        // Start with all if checking, empty if unchecking
        explorerFilters.selectedDos = checked ? new Set(DataHoarderArray.map(r => r.inv)) : new Set();
    }

    currentFilteredDataset.forEach(row => {
        if (checked) {
            explorerFilters.selectedDos.add(row.inv);
        } else {
            explorerFilters.selectedDos.delete(row.inv);
        }
    });

    // Update row checkboxes in DOM
    document.querySelectorAll('.row-do-checkbox').forEach(chk => {
        chk.checked = checked;
        const tr = chk.closest('tr');
        if (tr) {
            if (checked) tr.classList.add('row-selected');
            else tr.classList.remove('row-selected');
        }
    });

    updateDoPickerTriggerBadge();
    updateTickedToolbarButtons();

    // If in filterOnlyTicked mode, re-filter
    if (explorerFilters.filterOnlyTicked) {
        applyExplorerFilters();
    }
}

function handleRowCheckboxChange(inputEl, inv) {
    if (!explorerFilters.isDoSelectionActive) {
        explorerFilters.isDoSelectionActive = true;
        explorerFilters.selectedDos = new Set(DataHoarderArray.map(r => r.inv));
    }

    if (inputEl.checked) {
        explorerFilters.selectedDos.add(inv);
    } else {
        explorerFilters.selectedDos.delete(inv);
    }

    const tr = inputEl.closest('tr');
    if (tr) {
        if (inputEl.checked) tr.classList.add('row-selected');
        else tr.classList.remove('row-selected');
    }

    // Update master checkbox state
    updateMasterCheckboxState();
    updateDoPickerTriggerBadge();
    updateTickedToolbarButtons();

    // If in filterOnlyTicked mode, re-filter
    if (explorerFilters.filterOnlyTicked) {
        applyExplorerFilters();
    }
}

function updateMasterCheckboxState() {
    const masterChk = document.getElementById("masterDoCheckbox");
    if (!masterChk) return;

    if (currentFilteredDataset.length === 0) {
        masterChk.checked = false;
        masterChk.indeterminate = false;
        return;
    }

    const visibleDos = currentFilteredDataset.map(r => r.inv);
    const checkedCount = visibleDos.filter(inv => 
        !explorerFilters.isDoSelectionActive || explorerFilters.selectedDos.has(inv)
    ).length;

    if (checkedCount === visibleDos.length) {
        masterChk.checked = true;
        masterChk.indeterminate = false;
    } else if (checkedCount > 0) {
        masterChk.checked = false;
        masterChk.indeterminate = true;
    } else {
        masterChk.checked = false;
        masterChk.indeterminate = false;
    }
}

// Toggle Filter Only Ticked Mode
function toggleFilterOnlyTicked() {
    explorerFilters.filterOnlyTicked = !explorerFilters.filterOnlyTicked;
    
    // If enabling and no specific subset is selected yet, make currently visible rows selected
    if (explorerFilters.filterOnlyTicked && !explorerFilters.isDoSelectionActive) {
        explorerFilters.isDoSelectionActive = true;
        explorerFilters.selectedDos = new Set(currentFilteredDataset.map(r => r.inv));
    }

    updateTickedToolbarButtons();
    applyExplorerFilters();

    if (typeof showToast === 'function') {
        const msg = explorerFilters.filterOnlyTicked
            ? `Filter active: Showing ${explorerFilters.selectedDos.size} ticked DO rows only`
            : "Filter cleared: Showing all matching rows";
        showToast(msg, explorerFilters.filterOnlyTicked ? "info" : "default");
    }
}

function updateTickedToolbarButtons() {
    const toolbarBtn = document.getElementById("filterTickedToolbarBtn");
    const toolbarLabel = document.getElementById("filterTickedToolbarLabel");
    const inlineBtn = document.getElementById("inlineTickFilterBtn");
    
    const totalUnique = new Set(DataHoarderArray.map(r => r.inv)).size;
    const selectedCount = !explorerFilters.isDoSelectionActive ? totalUnique : explorerFilters.selectedDos.size;

    if (toolbarLabel) {
        toolbarLabel.innerText = explorerFilters.filterOnlyTicked 
            ? `Ticked Filter ON (${selectedCount})` 
            : `Ticked Only (${selectedCount})`;
    }

    if (toolbarBtn) {
        if (explorerFilters.filterOnlyTicked) {
            toolbarBtn.classList.add("active");
        } else {
            toolbarBtn.classList.remove("active");
        }
    }

    if (inlineBtn) {
        if (explorerFilters.filterOnlyTicked) {
            inlineBtn.classList.add("active");
            inlineBtn.innerText = "✓ ON";
        } else {
            inlineBtn.classList.remove("active");
            inlineBtn.innerText = "✓";
        }
    }
}

// =========================================================================
// Authentic Excel-Style Table Header AutoFilter System
// =========================================================================

const ACTIVE_EXCEL_COLUMNS = ['inv', 'route', 'name', 'addr', 'vol', 'qty', 'sku', 'cat'];

function getRowColumnValueString(row, colKey) {
    if (!row) return '';
    switch (colKey) {
        case 'inv': return String(row.inv || '').trim();
        case 'div': return String(row.div || '-').trim();
        case 'route': return String(row.route || '-').trim();
        case 'name': return String(row.name || '').trim();
        case 'addr': return String(row.addr || '').trim();
        case 'vol': return row.vol !== undefined && row.vol !== null && row.vol > 0 ? Number(row.vol).toFixed(4) : '0.0000';
        case 'qty': return String(row.qty !== undefined ? row.qty : 0);
        case 'sku': return String(row.sku !== undefined ? row.sku : 1);
        case 'cat': {
            const rmk = (row.remark && row.remark.trim() !== '' && row.remark.trim() !== '-') ? row.remark.trim() : '';
            if (rmk) return rmk;
            const match = ProductMasterLookupMap[row.inv] || {};
            return String(match.doCategory || 'Unassigned');
        }
        default: return String(row[colKey] || '');
    }
}

function openExcelFilterMenu(event, colKey, colTitle) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const menuEl = document.getElementById("excelFilterMenu");
    if (!menuEl) return;

    if (activeExcelMenuState.colKey === colKey && menuEl.classList.contains("open")) {
        closeExcelFilterMenu();
        return;
    }

    // Set active state
    activeExcelMenuState.colKey = colKey;
    activeExcelMenuState.colTitle = colTitle || colKey.toUpperCase();
    activeExcelMenuState.searchQuery = '';

    // Update labels for Sort and Clear Filter
    const sortAscLabel = document.getElementById("excelMenuSortAscLabel");
    const sortDescLabel = document.getElementById("excelMenuSortDescLabel");
    const clearLabel = document.getElementById("excelMenuClearFilterLabel");
    const clearItem = document.getElementById("excelMenuClearFilter");

    const isNumericCol = (colKey === 'vol' || colKey === 'qty' || colKey === 'sku');
    if (sortAscLabel) sortAscLabel.innerText = isNumericCol ? "Sort Smallest to Largest" : "Sort A to Z";
    if (sortDescLabel) sortDescLabel.innerText = isNumericCol ? "Sort Largest to Smallest" : "Sort Z to A";
    
    if (clearLabel) clearLabel.innerText = `Clear Filter From "${activeExcelMenuState.colTitle}"`;
    
    const isFilterActiveOnCol = excelColumnFilters[colKey] !== null;
    if (clearItem) {
        if (isFilterActiveOnCol) {
            clearItem.classList.remove("disabled");
        } else {
            clearItem.classList.add("disabled");
        }
    }

    // Reset search input
    const searchInp = document.getElementById("excelSearchInput");
    if (searchInp) searchInp.value = '';

    // Calculate unique values from active dataset (respecting Direct / Non-Direct Delivery quick filter if active)
    const sourceRows = (() => {
        if (explorerFilters.onlyDirect5m3) {
            const directInvoices = getDirectDeliveryEligibleInvoices();
            return DataHoarderArray.filter(r => directInvoices.has(r.inv));
        }
        if (explorerFilters.onlyNonDirect) {
            const directInvoices = getDirectDeliveryEligibleInvoices();
            return DataHoarderArray.filter(r => !directInvoices.has(r.inv));
        }
        return DataHoarderArray;
    })();

    const valueMap = {};
    sourceRows.forEach(row => {
        const val = getRowColumnValueString(row, colKey);
        valueMap[val] = (valueMap[val] || 0) + 1;
    });

    // Sort items
    const sortedVals = Object.keys(valueMap).sort((a, b) => {
        if (isNumericCol) {
            return (parseFloat(a) || 0) - (parseFloat(b) || 0);
        }
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    activeExcelMenuState.items = sortedVals.map(v => ({
        value: v,
        label: v || '(Blanks)',
        count: valueMap[v]
    }));

    // Initialize tempSelected
    if (excelColumnFilters[colKey] === null) {
        // All currently selected
        activeExcelMenuState.tempSelected = new Set(sortedVals);
    } else {
        // Copy existing selection
        activeExcelMenuState.tempSelected = new Set(excelColumnFilters[colKey]);
    }

    // Render checkbox list
    renderExcelCheckboxList();

    // Position menu under button
    const btn = event ? (event.currentTarget || event.target.closest('.excel-filter-btn')) : document.getElementById(`excel_btn_${colKey}`);
    if (btn) {
        const rect = btn.getBoundingClientRect();
        let top = rect.bottom + 4;
        let left = rect.left;

        // Check right screen boundary
        const menuWidth = 280;
        if (left + menuWidth > window.innerWidth - 12) {
            left = window.innerWidth - menuWidth - 12;
        }
        if (left < 10) left = 10;

        // Check bottom boundary
        const menuHeight = 360;
        if (top + menuHeight > window.innerHeight - 10) {
            top = Math.max(10, rect.top - menuHeight - 4);
        }

        menuEl.style.top = `${top}px`;
        menuEl.style.left = `${left}px`;
    }

    menuEl.style.display = "flex";
    menuEl.classList.add("open");

    // Prevent clicks inside the menu from propagating to document
    menuEl.onclick = function(e) {
        e.stopPropagation();
    };

    // Close on click outside
    setTimeout(() => {
        document.addEventListener("click", handleExcelFilterClickOutside);
    }, 20);

    if (searchInp) {
        setTimeout(() => searchInp.focus(), 80);
    }
}

function handleExcelFilterClickOutside(e) {
    const menuEl = document.getElementById("excelFilterMenu");
    if (!menuEl || !menuEl.classList.contains("open")) return;
    
    // Check if click was inside the menu or on any filter button
    if (e.composedPath && e.composedPath().some(el => el && (el.id === 'excelFilterMenu' || (el.classList && el.classList.contains('excel-filter-btn'))))) {
        return;
    }
    if (menuEl.contains(e.target)) return;
    if (e.target && e.target.closest && (e.target.closest('#excelFilterMenu') || e.target.closest('.excel-filter-btn'))) {
        return;
    }

    closeExcelFilterMenu();
}

function closeExcelFilterMenu() {
    const menuEl = document.getElementById("excelFilterMenu");
    if (menuEl) {
        menuEl.classList.remove("open");
        menuEl.style.display = "none";
    }
    document.removeEventListener("click", handleExcelFilterClickOutside);
}

function renderExcelCheckboxList() {
    const listEl = document.getElementById("excelCheckboxList");
    if (!listEl) return;

    const { items, tempSelected, searchQuery } = activeExcelMenuState;
    const q = (searchQuery || '').toLowerCase().trim();

    const visibleItems = items.filter(it => !q || it.label.toLowerCase().includes(q));

    if (visibleItems.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; color: var(--fg-muted); font-size: 11px; padding: 16px;">No matching values</div>`;
        return;
    }

    const allVisibleSelected = visibleItems.length > 0 && visibleItems.every(it => tempSelected.has(it.value));
    const someVisibleSelected = !allVisibleSelected && visibleItems.some(it => tempSelected.has(it.value));

    let html = `
        <label class="excel-check-item select-all-item" onclick="handleExcelSelectAllClick(event)">
            <input type="checkbox" id="excelSelectAllCheck" ${allVisibleSelected ? 'checked' : ''} onclick="event.stopPropagation()" onchange="handleExcelSelectAllChange(event, this.checked)">
            <span class="excel-check-label">${q ? '(Select All Search Results)' : '(Select All)'}</span>
        </label>
    `;

    visibleItems.forEach((it) => {
        const isChecked = tempSelected.has(it.value);
        html += `
            <label class="excel-check-item" data-val="${escapeAttr(it.value)}" onclick="handleExcelItemClick(event, '${escapeAttr(it.value)}')">
                <input type="checkbox" class="excel-row-val-check" data-val="${escapeAttr(it.value)}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation()" onchange="handleExcelItemCheckboxChange(event, '${escapeAttr(it.value)}', this.checked)">
                <span class="excel-check-label" title="${escapeAttr(it.label)}">${escapeHtml(it.label)}</span>
                <span class="excel-check-count">(${it.count})</span>
            </label>
        `;
    });

    listEl.innerHTML = html;

    const selectAllCheck = document.getElementById("excelSelectAllCheck");
    if (selectAllCheck) {
        selectAllCheck.indeterminate = someVisibleSelected;
    }
}

function handleExcelItemClick(e, value) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const { tempSelected } = activeExcelMenuState;
    if (tempSelected.has(value)) {
        tempSelected.delete(value);
    } else {
        tempSelected.add(value);
    }
    updateExcelCheckboxDOMStates();
}

function handleExcelItemCheckboxChange(e, value, checked) {
    if (e) {
        e.stopPropagation();
    }
    const { tempSelected } = activeExcelMenuState;
    if (checked) {
        tempSelected.add(value);
    } else {
        tempSelected.delete(value);
    }
    updateExcelCheckboxDOMStates();
}

function handleExcelSelectAllClick(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const selectAllCheck = document.getElementById("excelSelectAllCheck");
    const willCheck = selectAllCheck ? !selectAllCheck.checked : true;
    handleExcelSelectAllInternal(willCheck);
}

function handleExcelSelectAllChange(e, checked) {
    if (e) {
        e.stopPropagation();
    }
    handleExcelSelectAllInternal(checked);
}

function handleExcelSelectAllInternal(checked) {
    const { items, tempSelected, searchQuery } = activeExcelMenuState;
    const q = (searchQuery || '').toLowerCase().trim();
    const visibleItems = items.filter(it => !q || it.label.toLowerCase().includes(q));

    visibleItems.forEach(it => {
        if (checked) {
            tempSelected.add(it.value);
        } else {
            tempSelected.delete(it.value);
        }
    });

    updateExcelCheckboxDOMStates();
}

function updateExcelCheckboxDOMStates() {
    const listEl = document.getElementById("excelCheckboxList");
    if (!listEl) return;
    const { items, tempSelected, searchQuery } = activeExcelMenuState;
    const q = (searchQuery || '').toLowerCase().trim();
    const visibleItems = items.filter(it => !q || it.label.toLowerCase().includes(q));

    const allVisibleSelected = visibleItems.length > 0 && visibleItems.every(it => tempSelected.has(it.value));
    const someVisibleSelected = !allVisibleSelected && visibleItems.some(it => tempSelected.has(it.value));

    const selectAllCheck = document.getElementById("excelSelectAllCheck");
    if (selectAllCheck) {
        selectAllCheck.checked = allVisibleSelected;
        selectAllCheck.indeterminate = someVisibleSelected;
    }

    const checkboxes = listEl.querySelectorAll('.excel-row-val-check');
    checkboxes.forEach(cb => {
        const val = cb.getAttribute('data-val');
        cb.checked = tempSelected.has(val);
    });
}

function handleExcelSearchInput(query) {
    activeExcelMenuState.searchQuery = query;
    const q = (query || '').toLowerCase().trim();

    if (q) {
        // Excel Behavior: When searching, automatically select all search results and deselect non-matching values
        const matching = activeExcelMenuState.items.filter(it => 
            (it.label && it.label.toLowerCase().includes(q)) || 
            (it.value && String(it.value).toLowerCase().includes(q))
        );
        activeExcelMenuState.tempSelected = new Set(matching.map(it => it.value));
    } else {
        // When search box is cleared, restore checkboxes to full selection or existing column filter
        const currentColFilter = excelColumnFilters[activeExcelMenuState.colKey];
        if (currentColFilter === null) {
            activeExcelMenuState.tempSelected = new Set(activeExcelMenuState.items.map(it => it.value));
        } else {
            activeExcelMenuState.tempSelected = new Set(currentColFilter);
        }
    }

    renderExcelCheckboxList();
}

function handleExcelSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        applyExcelFilterMenu();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeExcelFilterMenu();
    }
}

function handleExcelMenuSort(direction) {
    const colKey = activeExcelMenuState.colKey;
    if (!colKey) return;
    closeExcelFilterMenu();
    
    // Sort table with direction
    explorerSort.col = colKey;
    explorerSort.direction = direction;

    // Update Header Sort Icons
    ACTIVE_EXCEL_COLUMNS.forEach(col => {
        const iconEl = document.getElementById(`sort_icon_${col}`);
        const thEl = iconEl ? iconEl.closest('th') : null;
        if (!iconEl) return;

        if (col === colKey) {
            iconEl.innerText = direction === 'asc' ? '▲' : '▼';
            if (thEl) thEl.classList.add('sorted');
        } else {
            iconEl.innerText = '⇅';
            if (thEl) thEl.classList.remove('sorted');
        }
    });

    sortDataArray(currentFilteredDataset, explorerSort.col, explorerSort.direction);
    renderTable(currentFilteredDataset);

    if (typeof showToast === 'function') {
        showToast(`Sorted by ${activeExcelMenuState.colTitle} (${direction === 'asc' ? 'Ascending' : 'Descending'})`, "info");
    }
}

function handleExcelMenuClearFilter() {
    const colKey = activeExcelMenuState.colKey;
    if (!colKey) return;
    
    excelColumnFilters[colKey] = null;
    updateExcelFilterButtonStates();
    closeExcelFilterMenu();
    applyExplorerFilters();

    if (typeof showToast === 'function') {
        showToast(`Cleared filter from ${activeExcelMenuState.colTitle}`, "info");
    }
}

function applyExcelFilterMenu() {
    const { colKey, colTitle, items, tempSelected } = activeExcelMenuState;
    if (!colKey) return;

    if (tempSelected.size === items.length) {
        excelColumnFilters[colKey] = null; // All selected = no constraint
    } else {
        excelColumnFilters[colKey] = new Set(tempSelected);
    }

    updateExcelFilterButtonStates();
    closeExcelFilterMenu();
    applyExplorerFilters();

    if (typeof showToast === 'function') {
        const msg = excelColumnFilters[colKey] === null
            ? `Filter cleared from ${colTitle}`
            : `Filtered ${colTitle} (${tempSelected.size} of ${items.length} selected)`;
        showToast(msg, "success");
    }
}

function updateExcelFilterButtonStates() {
    ACTIVE_EXCEL_COLUMNS.forEach(col => {
        const btn = document.getElementById(`excel_btn_${col}`);
        if (!btn) return;

        const isFiltered = excelColumnFilters[col] !== null;
        if (isFiltered) {
            btn.classList.add('active');
            btn.title = `AutoFilter active on ${col.toUpperCase()} (Click to change)`;
            btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`;
        } else {
            btn.classList.remove('active');
            btn.title = `AutoFilter ${col.toUpperCase()}`;
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>`;
        }
    });
}

// Populate Route and Division Filter Dropdowns with Live Data
function populateExplorerDropdowns() {
    const routeSelect = document.getElementById("explorerRouteFilter");
    const inlineRouteSelect = document.getElementById("inlineRouteFilter");
    const divSelect = document.getElementById("explorerDivisionFilter");
    const inlineDivSelect = document.getElementById("inlineDivisionFilter");

    if (!routeSelect || !divSelect) return;

    // Count records per Route
    const routeCounts = {};
    const divCounts = {};

    DataHoarderArray.forEach(row => {
        const r = (row.route || 'Unknown').trim();
        const d = (row.div || 'Unknown').trim();
        routeCounts[r] = (routeCounts[r] || 0) + 1;
        divCounts[d] = (divCounts[d] || 0) + 1;
    });

    // Populate Routes
    let routeHtml = `<option value="ALL">All Routes (${DataHoarderArray.length})</option>`;
    Object.keys(routeCounts).sort().forEach(routeKey => {
        routeHtml += `<option value="${routeKey}">${routeKey} (${routeCounts[routeKey]})</option>`;
    });
    routeSelect.innerHTML = routeHtml;
    if (inlineRouteSelect) inlineRouteSelect.innerHTML = routeHtml;
    routeSelect.value = explorerFilters.route;
    if (inlineRouteSelect) inlineRouteSelect.value = explorerFilters.route;

    // Populate Divisions
    let divHtml = `<option value="ALL">All Divisions (${DataHoarderArray.length})</option>`;
    Object.keys(divCounts).sort().forEach(divKey => {
        divHtml += `<option value="${divKey}">${divKey} (${divCounts[divKey]})</option>`;
    });
    divSelect.innerHTML = divHtml;
    if (inlineDivSelect) inlineDivSelect.innerHTML = divHtml;
    divSelect.value = explorerFilters.division;
    if (inlineDivSelect) inlineDivSelect.value = explorerFilters.division;

    // Also update DO picker trigger badge
    updateDoPickerTriggerBadge();
}

// Quick Preset Filter Handler
function setFilterPreset(preset) {
    explorerFilters.preset = preset;
    document.querySelectorAll('.filter-preset-chip').forEach(el => {
        if (el.dataset.preset === preset) el.classList.add('active');
        else el.classList.remove('active');
    });
    handleExplorerFilterChange();
}

// Multi-Dimensional Filter Handler
function handleExplorerFilterChange() {
    const doInput = document.getElementById("explorerDoInput");
    const routeSelect = document.getElementById("explorerRouteFilter");
    const addrInput = document.getElementById("explorerAddressInput");
    const divSelect = document.getElementById("explorerDivisionFilter");

    if (doInput) explorerFilters.doText = doInput.value.trim();
    if (routeSelect) explorerFilters.route = routeSelect.value;
    if (addrInput) explorerFilters.address = addrInput.value.trim();
    if (divSelect) explorerFilters.division = divSelect.value;

    // Sync inline filter controls if present
    const inlineDo = document.getElementById("inlineDoFilter");
    const inlineRoute = document.getElementById("inlineRouteFilter");
    const inlineAddr = document.getElementById("inlineAddressFilter");
    const inlineDiv = document.getElementById("inlineDivisionFilter");

    if (inlineDo && inlineDo.value !== explorerFilters.doText) inlineDo.value = explorerFilters.doText;
    if (inlineRoute && inlineRoute.value !== explorerFilters.route) inlineRoute.value = explorerFilters.route;
    if (inlineAddr && inlineAddr.value !== explorerFilters.address) inlineAddr.value = explorerFilters.address;
    if (inlineDiv && inlineDiv.value !== explorerFilters.division) inlineDiv.value = explorerFilters.division;

    applyExplorerFilters();
}

// Inline Excel Filter Row Handler
function handleInlineFilterChange(field, val) {
    if (field === 'doText') {
        explorerFilters.doText = val.trim();
        const topDo = document.getElementById("explorerDoInput");
        if (topDo) topDo.value = val;
    } else if (field === 'route') {
        explorerFilters.route = val;
        const topRoute = document.getElementById("explorerRouteFilter");
        if (topRoute) topRoute.value = val;
    } else if (field === 'consignee') {
        explorerFilters.consignee = val.trim();
    } else if (field === 'address') {
        explorerFilters.address = val.trim();
        const topAddr = document.getElementById("explorerAddressInput");
        if (topAddr) topAddr.value = val;
    } else if (field === 'division') {
        explorerFilters.division = val;
        const topDiv = document.getElementById("explorerDivisionFilter");
        if (topDiv) topDiv.value = val;
    } else if (field === 'minVol') {
        explorerFilters.minVol = val;
    } else if (field === 'minQty') {
        explorerFilters.minQty = val;
    } else if (field === 'category') {
        explorerFilters.category = val;
    }

    applyExplorerFilters();
}

// Calculate all DO invoice numbers for Addresses / Destinations Exceeding 5 m³ Volume (Direct Delivery Eligible)
function getDirectDeliveryEligibleInvoices() {
    const consigneeVol = {};
    const addrVol = {};

    DataHoarderArray.forEach(item => {
        const cName = (item.name && item.name.trim() !== "") ? item.name.trim() : "UNASSIGNED";
        const aStr = (item.addr && item.addr.trim() !== "") ? item.addr.trim().toLowerCase() : "";
        const routeStr = (item.route && item.route.trim() !== "") ? item.route.trim().toUpperCase() : "";
        const isCourts = cName.toUpperCase().includes("COURTS");
        const hasSgBros = /SG\s*BROS/i.test(item.remark || "");
        const hasSpx = /SPX/i.test(item.remark || "");
        const v = parseFloat(item.vol) || 0;

        // Rule: Exclude DOs with "SG BROS", "SGBROS", or "SPX" remark from direct delivery
        if (hasSgBros || hasSpx) {
            return;
        }

        // Rule: For COURTS, Direct Delivery only applies if ROUTE is LEA
        if (isCourts && routeStr !== "LEA") {
            return;
        }

        if (cName !== "UNASSIGNED") {
            consigneeVol[cName] = (consigneeVol[cName] || 0) + v;
        }
        if (aStr) {
            addrVol[aStr] = (addrVol[aStr] || 0) + v;
        }
    });

    const eligibleInvoices = new Set();
    DataHoarderArray.forEach(item => {
        const cName = (item.name && item.name.trim() !== "") ? item.name.trim() : "UNASSIGNED";
        const aStr = (item.addr && item.addr.trim() !== "") ? item.addr.trim().toLowerCase() : "";
        const routeStr = (item.route && item.route.trim() !== "") ? item.route.trim().toUpperCase() : "";
        const isCourts = cName.toUpperCase().includes("COURTS");
        const hasSgBros = /SG\s*BROS/i.test(item.remark || "");
        const hasSpx = /SPX/i.test(item.remark || "");
        const v = parseFloat(item.vol) || 0;

        // Rule: Exclude DOs with "SG BROS", "SGBROS", or "SPX" remark from direct delivery
        if (hasSgBros || hasSpx) {
            return;
        }

        // Rule: For COURTS, Direct Delivery only applies if ROUTE is LEA
        if (isCourts && routeStr !== "LEA") {
            return;
        }

        const isDirect = (cName !== "UNASSIGNED" && (consigneeVol[cName] || 0) > 5.0) || 
                         (aStr && (addrVol[aStr] || 0) > 5.0) || 
                         (v >= 5.0);

        if (isDirect) {
            eligibleInvoices.add(item.inv);
        }
    });

    return eligibleInvoices;
}

// Toggle Quick Filter for Addresses Exceeding 5 m³ Volume (able to go direct)
function toggleDirectDeliveryQuickFilter() {
    explorerFilters.onlyDirect5m3 = !explorerFilters.onlyDirect5m3;
    if (explorerFilters.onlyDirect5m3) {
        explorerFilters.onlyNonDirect = false;
    }
    updateDirectDeliveryButtonState();
    updateDoPickerTriggerBadge();
    populateDoPickerList();
    applyExplorerFilters();

    if (typeof showToast === 'function') {
        if (explorerFilters.onlyDirect5m3) {
            const count = currentFilteredDataset.length;
            const totalVol = currentFilteredDataset.reduce((acc, r) => acc + (parseFloat(r.vol) || 0), 0);
            showToast(`Quick Filter: Showing ${count} DOs (${totalVol.toFixed(2)} m³) for Addresses Exceeding 5 m³`, "success");
        } else {
            showToast("Direct Delivery (> 5 m³) quick filter cleared.", "info");
        }
    }
}

// Toggle Quick Filter for Non-Direct Delivery (Exclude direct delivery DOs)
function toggleNonDirectDeliveryQuickFilter() {
    explorerFilters.onlyNonDirect = !explorerFilters.onlyNonDirect;
    if (explorerFilters.onlyNonDirect) {
        explorerFilters.onlyDirect5m3 = false;
    }
    updateDirectDeliveryButtonState();
    updateDoPickerTriggerBadge();
    populateDoPickerList();
    applyExplorerFilters();

    if (typeof showToast === 'function') {
        if (explorerFilters.onlyNonDirect) {
            const count = currentFilteredDataset.length;
            const totalVol = currentFilteredDataset.reduce((acc, r) => acc + (parseFloat(r.vol) || 0), 0);
            showToast(`Quick Filter: Showing ${count} Non-Direct DOs (${totalVol.toFixed(2)} m³)`);
        } else {
            showToast("Non-Direct Delivery quick filter cleared.", "info");
        }
    }
}

// Update Direct & Non-Direct Delivery quick filter button states and badges in DOM
function updateDirectDeliveryButtonState() {
    const btn = document.getElementById("quickFilterDirectBtn");
    const nonDirectBtn = document.getElementById("quickFilterNonDirectBtn");
    const chartBtn = document.getElementById("chartFilterDirectBtn");
    const badge = document.getElementById("directFilterBadge");
    const nonDirectBadge = document.getElementById("nonDirectFilterBadge");

    const directInvoices = getDirectDeliveryEligibleInvoices();
    const count = directInvoices.size;
    const allUniqueDos = new Set(DataHoarderArray.map(r => r.inv));
    const nonDirectCount = Math.max(0, allUniqueDos.size - count);

    if (badge) {
        if (count > 0) {
            badge.innerText = `${count}`;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    if (nonDirectBadge) {
        if (nonDirectCount > 0) {
            nonDirectBadge.innerText = `${nonDirectCount}`;
            nonDirectBadge.style.display = 'inline-flex';
        } else {
            nonDirectBadge.style.display = 'none';
        }
    }

    if (btn) {
        if (explorerFilters.onlyDirect5m3) {
            btn.classList.add("active");
            btn.setAttribute("aria-pressed", "true");
        } else {
            btn.classList.remove("active");
            btn.setAttribute("aria-pressed", "false");
        }
    }

    if (nonDirectBtn) {
        if (explorerFilters.onlyNonDirect) {
            nonDirectBtn.classList.add("active");
            nonDirectBtn.setAttribute("aria-pressed", "true");
        } else {
            nonDirectBtn.classList.remove("active");
            nonDirectBtn.setAttribute("aria-pressed", "false");
        }
    }

    if (chartBtn) {
        if (explorerFilters.onlyDirect5m3) {
            chartBtn.classList.add("active");
            chartBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Active (${count} DOs)</span>`;
        } else {
            chartBtn.classList.remove("active");
            chartBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg> <span>Filter Manifest</span>`;
        }
    }
}

// Interactive filter triggered when user clicks a bar in the Consignee chart
function filterByConsigneeFromChart(consigneeName) {
    if (!consigneeName) return;
    if (explorerFilters.consignee.toLowerCase() === consigneeName.toLowerCase()) {
        explorerFilters.consignee = "";
        applyExplorerFilters();
        if (typeof showToast === 'function') showToast("Cleared consignee chart filter.", "info");
    } else {
        explorerFilters.consignee = consigneeName;
        applyExplorerFilters();
        if (typeof showToast === 'function') showToast(`Filtered manifest for "${consigneeName}"`, "success");
        const tableContainer = document.getElementById("spreadsheetContainer");
        if (tableContainer) tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Reset All Filters
function resetAllExplorerFilters() {
    explorerFilters = {
        doText: "",
        selectedDos: new Set(),
        isDoSelectionActive: false,
        filterOnlyTicked: false,
        onlyDirect5m3: false,
        onlyNonDirect: false,
        route: "ALL",
        consignee: "",
        address: "",
        division: "ALL",
        preset: "ALL",
        minVol: "",
        minQty: "",
        category: "ALL"
    };

    // Reset Excel column filters
    for (const k in excelColumnFilters) {
        excelColumnFilters[k] = null;
    }
    updateExcelFilterButtonStates();
    updateDirectDeliveryButtonState();

    const doInput = document.getElementById("explorerDoInput");
    const routeSelect = document.getElementById("explorerRouteFilter");
    const addrInput = document.getElementById("explorerAddressInput");
    const divSelect = document.getElementById("explorerDivisionFilter");
    const inlineDo = document.getElementById("inlineDoFilter");
    const inlineRoute = document.getElementById("inlineRouteFilter");
    const inlineCons = document.getElementById("inlineConsigneeFilter");
    const inlineAddr = document.getElementById("inlineAddressFilter");
    const inlineDiv = document.getElementById("inlineDivisionFilter");
    const inlineMinVol = document.getElementById("inlineMinVolFilter");
    const inlineMinQty = document.getElementById("inlineMinQtyFilter");
    const inlineCat = document.getElementById("inlineCategoryFilter");

    if (doInput) doInput.value = "";
    if (routeSelect) routeSelect.value = "ALL";
    if (addrInput) addrInput.value = "";
    if (divSelect) divSelect.value = "ALL";
    if (inlineDo) inlineDo.value = "";
    if (inlineRoute) inlineRoute.value = "ALL";
    if (inlineCons) inlineCons.value = "";
    if (inlineAddr) inlineAddr.value = "";
    if (inlineDiv) inlineDiv.value = "ALL";
    if (inlineMinVol) inlineMinVol.value = "";
    if (inlineMinQty) inlineMinQty.value = "";
    if (inlineCat) inlineCat.value = "ALL";

    document.querySelectorAll('.filter-preset-chip').forEach(el => {
        if (el.dataset.preset === 'ALL') el.classList.add('active');
        else el.classList.remove('active');
    });

    updateDoPickerTriggerBadge();
    applyExplorerFilters();
}

// Core Filter Engine & Live KPI Monitor Recalculation
function applyExplorerFilters() {
    const doTokens = explorerFilters.doText
        ? explorerFilters.doText.split(/[\s,;]+/).map(t => t.trim().toLowerCase()).filter(Boolean)
        : [];
    const addrQuery = explorerFilters.address ? explorerFilters.address.toLowerCase() : "";
    const consQuery = explorerFilters.consignee ? explorerFilters.consignee.toLowerCase() : "";
    const minVolNum = parseFloat(explorerFilters.minVol) || 0;
    const minQtyNum = parseInt(explorerFilters.minQty, 10) || 0;
    const directEligibleInvoices = (explorerFilters.onlyDirect5m3 || explorerFilters.onlyNonDirect) 
        ? getDirectDeliveryEligibleInvoices() 
        : null;

    currentFilteredDataset = DataHoarderArray.filter(row => {
        const Match = ProductMasterLookupMap[row.inv] || {};
        const catVal = (Match.doCategory || '').toLowerCase().trim();

        // 0. Filter by Selected (Ticked) DOs
        if (explorerFilters.isDoSelectionActive || explorerFilters.filterOnlyTicked) {
            if (!explorerFilters.selectedDos.has(row.inv)) {
                return false;
            }
        }

        // 0.2. Quick Filter: Direct Delivery (Addresses Exceeding 5 m³ Volume)
        if (explorerFilters.onlyDirect5m3 && directEligibleInvoices) {
            if (!directEligibleInvoices.has(row.inv)) {
                return false;
            }
        }

        // 0.3. Quick Filter: Non-Direct Delivery (Exclude direct delivery DOs)
        if (explorerFilters.onlyNonDirect && directEligibleInvoices) {
            if (directEligibleInvoices.has(row.inv)) {
                return false;
            }
        }

        // 0.5. Filter by Excel AutoFilter Column Checkbox selections
        for (const colKey in excelColumnFilters) {
            const allowedSet = excelColumnFilters[colKey];
            if (allowedSet && allowedSet instanceof Set) {
                const cellVal = getRowColumnValueString(row, colKey);
                if (!allowedSet.has(cellVal)) {
                    return false;
                }
            }
        }

        // 1. Filter by DO text query (supports comma/space-separated list or partial match)
        if (doTokens.length > 0) {
            const invLower = row.inv.toLowerCase();
            const matched = doTokens.some(tok => invLower.includes(tok));
            if (!matched) return false;
        }

        // 2. Filter by Route
        if (explorerFilters.route !== "ALL" && row.route !== explorerFilters.route) {
            return false;
        }

        // 3. Filter by Division
        if (explorerFilters.division !== "ALL" && row.div !== explorerFilters.division) {
            return false;
        }

        // 4. Filter by Consignee Name
        if (consQuery && !row.name.toLowerCase().includes(consQuery)) {
            return false;
        }

        // 5. Filter by Address
        if (addrQuery) {
            const fullAddr = `${row.name} ${row.addr} ${row.remark || ''}`.toLowerCase();
            if (!fullAddr.includes(addrQuery)) return false;
        }

        // 6. Filter by Min Volume
        if (minVolNum > 0 && row.vol < minVolNum) {
            return false;
        }

        // 7. Filter by Min Qty
        if (minQtyNum > 0 && row.qty < minQtyNum) {
            return false;
        }

        // 8. Filter by Category
        if (explorerFilters.category !== "ALL") {
            if (catVal !== explorerFilters.category) return false;
        }

        // 9. Quick Presets
        if (explorerFilters.preset === 'gt5' && row.vol < 5.0) return false;
        if (explorerFilters.preset === 'lt1' && (row.vol >= 1.0 || row.vol <= 0)) return false;
        if (explorerFilters.preset === 'cat_big' && catVal !== 'big') return false;
        if (explorerFilters.preset === 'cat_small' && catVal !== 'small') return false;
        if (explorerFilters.preset === 'cat_mix' && catVal !== 'mix') return false;

        return true;
    });

    // Apply Sorting
    sortDataArray(currentFilteredDataset, explorerSort.col, explorerSort.direction);

    // Update Live KPI Monitoring Strip
    updateLiveMonitorKPIs(currentFilteredDataset);

    // Update Active Filter Tags UI
    renderActiveFilterTags();

    // Update Direct Delivery quick filter button state
    updateDirectDeliveryButtonState();

    // Render Spreadsheet Table
    renderTable(currentFilteredDataset);
}

// Live Dynamic KPI Data Monitoring Engine
function updateLiveMonitorKPIs(dataset) {
    const totalDatasetCount = DataHoarderArray.length;
    const filteredCount = dataset.length;

    // Filtered DO Count & Ratio
    const monitorDOs = document.getElementById("monitorFilteredDOs");
    const monitorDORatio = document.getElementById("monitorFilteredDORatio");
    if (monitorDOs) monitorDOs.innerText = filteredCount.toLocaleString();
    if (monitorDORatio) {
        const pct = totalDatasetCount > 0 ? ((filteredCount / totalDatasetCount) * 100).toFixed(1) : 0;
        monitorDORatio.innerText = `${pct}% of total dataset (${totalDatasetCount})`;
    }

    // Filtered DO M³ (Volume) & Avg Volume per DO
    const totalVol = dataset.reduce((acc, r) => acc + (parseFloat(r.vol) || 0), 0);
    const avgVol = filteredCount > 0 ? totalVol / filteredCount : 0;
    const monitorVol = document.getElementById("monitorFilteredVolume");
    const monitorAvgVol = document.getElementById("monitorFilteredAvgVolume");
    if (monitorVol) monitorVol.innerText = `${totalVol.toFixed(3)} m³`;
    if (monitorAvgVol) monitorAvgVol.innerText = `Avg: ${avgVol.toFixed(3)} m³ / DO`;

    // Filtered Quantity & Unique SKUs
    const totalQty = dataset.reduce((acc, r) => acc + (parseInt(r.qty, 10) || 0), 0);
    const totalSKU = dataset.reduce((acc, r) => acc + (parseInt(r.sku, 10) || 0), 0);
    const monitorQty = document.getElementById("monitorFilteredQuantity");
    const monitorSKU = document.getElementById("monitorFilteredSKU");
    if (monitorQty) monitorQty.innerText = totalQty.toLocaleString();
    if (monitorSKU) monitorSKU.innerText = `${totalSKU.toLocaleString()} SKUs across filtered DOs`;

    // Active Routes Coverage
    const activeRoutes = new Set(dataset.map(r => r.route).filter(Boolean));
    const monitorRoutes = document.getElementById("monitorActiveRoutes");
    const monitorRoutesDesc = document.getElementById("monitorActiveRoutesDesc");
    if (monitorRoutes) monitorRoutes.innerText = `${activeRoutes.size} Route${activeRoutes.size === 1 ? '' : 's'}`;
    if (monitorRoutesDesc) {
        if (activeRoutes.size === 0) {
            monitorRoutesDesc.innerText = "No routes matching";
        } else if (activeRoutes.size <= 2) {
            monitorRoutesDesc.innerText = Array.from(activeRoutes).join(", ");
        } else {
            monitorRoutesDesc.innerText = `${Array.from(activeRoutes).slice(0, 2).join(", ")} +${activeRoutes.size - 2} more`;
        }
    }

    // Update Spreadsheet Subtotal Footer Row
    const subDo = document.getElementById("subtotalDoCount");
    const subVol = document.getElementById("subtotalVolume");
    const subQty = document.getElementById("subtotalQty");
    const subSku = document.getElementById("subtotalSKU");
    const rowCounter = document.getElementById("spreadsheetRowCounter");

    if (subDo) subDo.innerText = filteredCount.toLocaleString();
    if (subVol) subVol.innerText = `${totalVol.toFixed(4)} m³`;
    if (subQty) subQty.innerText = totalQty.toLocaleString();
    if (subSku) subSku.innerText = totalSKU.toLocaleString();
    if (rowCounter) {
        rowCounter.innerText = `Showing ${filteredCount.toLocaleString()} of ${totalDatasetCount.toLocaleString()} rows`;
    }
}

// Render Active Filter Pills in Filter Hub
function renderActiveFilterTags() {
    const container = document.getElementById("activeFilterTags");
    if (!container) return;

    const tags = [];

    // Direct Delivery (> 5 m³) Quick Filter Active Tag
    if (explorerFilters.onlyDirect5m3) {
        tags.push({
            label: `Direct Delivery (> 5 m³): Active`,
            clear: () => {
                explorerFilters.onlyDirect5m3 = false;
                updateDirectDeliveryButtonState();
                updateDoPickerTriggerBadge();
                populateDoPickerList();
                applyExplorerFilters();
            }
        });
    }

    // Non-Direct Delivery Quick Filter Active Tag
    if (explorerFilters.onlyNonDirect) {
        tags.push({
            label: `Non-Direct Delivery: Active`,
            clear: () => {
                explorerFilters.onlyNonDirect = false;
                updateDirectDeliveryButtonState();
                updateDoPickerTriggerBadge();
                populateDoPickerList();
                applyExplorerFilters();
            }
        });
    }

    // Consignee Filter Tag
    if (explorerFilters.consignee) {
        tags.push({
            label: `Consignee: "${explorerFilters.consignee}"`,
            clear: () => {
                explorerFilters.consignee = "";
                const inlineCons = document.getElementById("inlineConsigneeFilter");
                if (inlineCons) inlineCons.value = "";
            }
        });
    }

    // Excel Column AutoFilter Active Tags
    const colNameMap = {
        inv: 'INVOICE NO',
        div: 'DIV',
        route: 'ROUTE',
        name: 'CONSIGNEE',
        addr: 'ADDRESS',
        vol: 'VOLUME',
        qty: 'QTY',
        sku: 'SKU',
        cat: 'CATEGORY'
    };

    for (const colKey in excelColumnFilters) {
        const allowed = excelColumnFilters[colKey];
        if (allowed && allowed instanceof Set) {
            const title = colNameMap[colKey] || colKey.toUpperCase();
            tags.push({
                label: `Filter [${title}]: ${allowed.size} selected`,
                clear: () => {
                    excelColumnFilters[colKey] = null;
                    updateExcelFilterButtonStates();
                }
            });
        }
    }

    if (tags.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = tags.map((t, idx) => 
        `<span class="filter-pill-tag">${t.label} <button type="button" onclick="clearFilterTag(${idx})" title="Remove filter">✕</button></span>`
    ).join("");

    window._activeFilterTags = tags;
}

window.clearFilterTag = function(idx) {
    if (window._activeFilterTags && window._activeFilterTags[idx]) {
        window._activeFilterTags[idx].clear();
        applyExplorerFilters();
    }
};

// Excel-Style Table Header Sorting
function sortExplorerTable(columnKey) {
    if (explorerSort.col === columnKey) {
        explorerSort.direction = explorerSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        explorerSort.col = columnKey;
        explorerSort.direction = 'asc';
    }

    // Update Header Sort Icons
    ['inv', 'div', 'route', 'name', 'addr', 'vol', 'qty', 'sku', 'cat'].forEach(col => {
        const iconEl = document.getElementById(`sort_icon_${col}`);
        const thEl = iconEl ? iconEl.closest('th') : null;
        if (!iconEl) return;

        if (col === columnKey) {
            iconEl.innerText = explorerSort.direction === 'asc' ? '▲' : '▼';
            if (thEl) thEl.classList.add('sorted');
        } else {
            iconEl.innerText = '⇅';
            if (thEl) thEl.classList.remove('sorted');
        }
    });

    sortDataArray(currentFilteredDataset, explorerSort.col, explorerSort.direction);
    renderTable(currentFilteredDataset);
}

function sortDataArray(arr, col, dir) {
    const mult = dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
        let valA, valB;
        if (col === 'vol' || col === 'qty' || col === 'sku') {
            valA = parseFloat(a[col]) || 0;
            valB = parseFloat(b[col]) || 0;
            return (valA - valB) * mult;
        } else if (col === 'cat') {
            const matchA = ProductMasterLookupMap[a.inv] || {};
            const matchB = ProductMasterLookupMap[b.inv] || {};
            const remarkA = (a.remark && a.remark.trim() !== '-' ? a.remark.trim() : '') || matchA.doCategory || '';
            const remarkB = (b.remark && b.remark.trim() !== '-' ? b.remark.trim() : '') || matchB.doCategory || '';
            valA = remarkA.toLowerCase();
            valB = remarkB.toLowerCase();
            return valA.localeCompare(valB) * mult;
        } else {
            valA = String(a[col] || '').toLowerCase();
            valB = String(b[col] || '').toLowerCase();
            return valA.localeCompare(valB) * mult;
        }
    });
}

// Toggle Compact / Normal Spreadsheet Density
function toggleSpreadsheetDensity() {
    const container = document.getElementById("spreadsheetContainer");
    const label = document.getElementById("densityToggleLabel");
    if (!container) return;

    isCompactDensity = !isCompactDensity;
    if (isCompactDensity) {
        container.classList.add("compact");
        if (label) label.innerText = "Comfortable Density";
    } else {
        container.classList.remove("compact");
        if (label) label.innerText = "Compact Density";
    }
}

// Export Filtered Spreadsheet View to Excel (.xlsx)
function exportFilteredExplorerToExcel() {
    if (!currentFilteredDataset || currentFilteredDataset.length === 0) {
        if (typeof showToast === 'function') {
            showToast("No data rows to export.", "info");
        } else {
            alert("No data rows to export.");
        }
        return;
    }

    try {
        const rows = [
            ["DO / Invoice No", "Division", "Route", "Consignee Name", "Delivery Address", "Volume (m3)", "Quantity", "SKU Count", "Category", "Remarks Note"]
        ];

        currentFilteredDataset.forEach(r => {
            const match = ProductMasterLookupMap[r.inv] || {};
            rows.push([
                r.inv,
                r.div || "",
                r.route || "",
                r.name || "",
                r.addr || "",
                r.vol > 0 ? r.vol : 0,
                r.qty || 0,
                r.sku || 0,
                match.doCategory || "",
                r.remark || ""
            ]);
        });

        // Add Summary Subtotal Row
        const totalVol = currentFilteredDataset.reduce((acc, r) => acc + (parseFloat(r.vol) || 0), 0);
        const totalQty = currentFilteredDataset.reduce((acc, r) => acc + (parseInt(r.qty, 10) || 0), 0);
        const totalSKU = currentFilteredDataset.reduce((acc, r) => acc + (parseInt(r.sku, 10) || 0), 0);

        rows.push([
            `SUBTOTAL (${currentFilteredDataset.length} DOs)`,
            "",
            "",
            "",
            "",
            Number(totalVol.toFixed(4)),
            totalQty,
            totalSKU,
            "",
            ""
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Auto column widths
        ws['!cols'] = [
            { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 38 },
            { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 25 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Filtered DO Manifest");
        const dateStr = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `DO_Summary_Explorer_${dateStr}.xlsx`);

        if (typeof showToast === 'function') {
            showToast("Exported filtered spreadsheet to Excel successfully!", "success");
        }
    } catch (e) {
        console.error("Excel export error:", e);
        if (typeof showToast === 'function') {
            showToast("Failed to export Excel: " + e.message, "error");
        } else {
            alert("Export failed: " + e.message);
        }
    }
}

// Refresh UI components
function refreshDashboard() {
    updateDataSourceStatus();
    populateExplorerDropdowns();
    applyExplorerFilters();
    updateKPIs();
    if (typeof renderCharts === 'function') renderCharts();
    renderRemarksOverview(DataHoarderArray);
}

// Filter dashboard data by specific uploaded file
function filterByFile(selectedFile, chipElement = null) {
    if (chipElement) {
        document.querySelectorAll('#doSummaryChips .file-chip').forEach(el => el.classList.remove('active'));
        chipElement.classList.add('active');
    } else {
        document.querySelectorAll('#doSummaryChips .file-chip').forEach(el => {
            if (el.dataset.filename === selectedFile) el.classList.add('active');
            else el.classList.remove('active');
        });
    }
    if (selectedFile === "ALL") {
        DataHoarderArray = [...MasterFileStoreArray];
    } else {
        DataHoarderArray = MasterFileStoreArray.filter(row => row.fileName === selectedFile);
    }
    
    // SAVE THE FILTERED DATA FOR OTHER PAGES TO USE
    localStorage.setItem("LastUploadedDoSummary", JSON.stringify(DataHoarderArray));
    localStorage.setItem("ActiveDoSummaryFilter", selectedFile);
    
    if (typeof updateMemoryBadge === 'function') updateMemoryBadge();
    refreshDashboard();
}

// Filter batch picking data by specific uploaded file
function filterBatchByFile(selectedFile, chipElement = null) {
    if (chipElement) {
        document.querySelectorAll('#batchFileChips .file-chip').forEach(el => el.classList.remove('active'));
        chipElement.classList.add('active');
    } else {
        document.querySelectorAll('#batchFileChips .file-chip').forEach(el => {
            if (el.dataset.filename === selectedFile) el.classList.add('active');
            else el.classList.remove('active');
        });
    }
    ProductMasterLookupMap = {}; // Reset the live lookup map
    
    try {
        if (selectedFile === "ALL") {
            // Merge all files from the master vault
            Object.keys(MasterBatchLookupMap).forEach(fileName => {
                mergeBatchMap(MasterBatchLookupMap[fileName]);
            });
        } else {
            // Only merge the selected file
            if (MasterBatchLookupMap[selectedFile]) {
                mergeBatchMap(MasterBatchLookupMap[selectedFile]);
            }
        }
    } catch (err) {
        console.error("Error in filterBatchByFile:", err);
        alert("Error merging batch files: " + err.message);
    }
    
    // Serialize sets to arrays for localStorage to share with other pages
    const storageMap = {};
    Object.keys(ProductMasterLookupMap).forEach(k => {
        storageMap[k] = {
            ...ProductMasterLookupMap[k],
            sizesArray: Array.from(ProductMasterLookupMap[k].sizesSet || [])
        };
    });
    localStorage.setItem("LastUploadedRouteData", JSON.stringify(storageMap));
    localStorage.setItem("ActiveBatchFilter", selectedFile);
    
    if (typeof updateMemoryBadge === 'function') updateMemoryBadge();
    refreshDashboard(); // Re-render table and charts with new batch data
}

// Helper function to merge a specific batch map into the live ProductMasterLookupMap
function mergeBatchMap(fileMap) {
    Object.keys(fileMap).forEach(invoiceKey => {
        if (!ProductMasterLookupMap[invoiceKey]) {
            // Deep copy, but handle Set manually
            const newObj = JSON.parse(JSON.stringify(fileMap[invoiceKey]));
            newObj.sizesSet = new Set(fileMap[invoiceKey].sizesSet);
            ProductMasterLookupMap[invoiceKey] = newObj;
            if (newObj.sizesSet.has("mix") || (newObj.sizesSet.has("big") && newObj.sizesSet.has("small"))) {
                newObj.doCategory = "mix";
            } else if (newObj.sizesSet.has("big")) {
                newObj.doCategory = "big";
            } else {
                newObj.doCategory = "small";
            }
        } else {
            const existing = ProductMasterLookupMap[invoiceKey];
            const incoming = fileMap[invoiceKey];
            
            // Merge logic (similar to parsing logic)
            if (incoming.batch) {
                if (!existing.batches) existing.batches = existing.batch ? [existing.batch] : [];
                if (!existing.batches.includes(incoming.batch)) existing.batches.push(incoming.batch);
                existing.batch = existing.batches.join(", ");
            }
            if (incoming.truck) {
                if (!existing.trucks) existing.trucks = existing.truck ? existing.truck.split(/[,/&]+/).map(t => t.trim()).filter(t => t && t.toUpperCase() !== "OK") : [];
                incoming.truck.split(/[,/&]+/).map(t => t.trim()).filter(t => t && t.toUpperCase() !== "OK").forEach(t => {
                    if (!existing.trucks.includes(t)) existing.trucks.push(t);
                });
                existing.truck = existing.trucks.join(", ") || incoming.truck;
                if (["NOT READY", "NO TRUCK", "KIV", "CANCEL", "CANCELLED", "OK"].includes(incoming.truck.toUpperCase())) {
                    existing.status = incoming.truck.toUpperCase();
                }
            }
            if (incoming.hub) {
                if (!existing.hubs) existing.hubs = existing.hub ? existing.hub.split(/[,/&]+/).map(h => h.trim()).filter(Boolean) : [];
                incoming.hub.split(/[,/&]+/).map(h => h.trim()).filter(Boolean).forEach(h => {
                    if (!existing.hubs.includes(h)) existing.hubs.push(h);
                });
                existing.hub = existing.hubs.join(", ");
            }
            if (incoming.route && !existing.route) existing.route = incoming.route;
            
            incoming.items.forEach(item => {
                existing.items.push({...item});
            });
            incoming.listK.forEach(k => { if (!existing.listK.includes(k)) existing.listK.push(k); });
            incoming.listL.forEach(l => { if (!existing.listL.includes(l)) existing.listL.push(l); });
            incoming.sizesSet.forEach(s => existing.sizesSet.add(s));
            
            // Recompute DO Category
            if (existing.sizesSet.has("mix") || (existing.sizesSet.has("big") && existing.sizesSet.has("small"))) {
                existing.doCategory = "mix";
            } else if (existing.sizesSet.has("big")) {
                existing.doCategory = "big";
            } else {
                existing.doCategory = "small";
            }
        }
    });
}

// Calculate KPI totals
function updateKPIs() {
    const kpiInvoices = document.getElementById('kpi-invoices');
    if (!kpiInvoices) return;
    kpiInvoices.innerText = DataHoarderArray.length;
    
    const kpiVol = document.getElementById('kpi-volume');
    if (kpiVol) kpiVol.innerText = DataHoarderArray.reduce((acc, row) => acc + row.vol, 0).toFixed(2);
    
    const kpiQty = document.getElementById('kpi-qty');
    if (kpiQty) kpiQty.innerText = DataHoarderArray.reduce((acc, row) => acc + row.qty, 0).toLocaleString();
    
    const kpiSku = document.getElementById('kpi-sku');
    if (kpiSku) kpiSku.innerText = DataHoarderArray.reduce((acc, row) => acc + row.sku, 0).toLocaleString();
}

// Render DO Remarks Overview Card (Column L) with Dynamic Filter Population
function renderRemarksOverview(dataset) {
    const tbody = document.getElementById("remarksOverviewBody");
    const filterDropdown = document.getElementById("remarkFilter");
    if (!tbody) return;

    tbody.innerHTML = "";
    const targetData = (dataset && dataset.length > 0) ? dataset : DataHoarderArray;

    if (!targetData || targetData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#64748b; padding:20px;">No DO data loaded.</td></tr>';
        if (filterDropdown) filterDropdown.innerHTML = `<option value="ALL">All Remarks</option>`;
        return;
    }

    const UniqueRemarks = new Set();
    const RowsWithRemarks = targetData.filter(row => {
        const hasRemark = row.remark && row.remark.trim() !== "" && row.remark.trim() !== "-";
        if (hasRemark) UniqueRemarks.add(row.remark.trim());
        return hasRemark;
    });

    if (filterDropdown) {
        const currentSelection = filterDropdown.value; 
        
        let optionsHtml = `<option value="ALL">All Remarks</option>`;
        Array.from(UniqueRemarks).sort().forEach(rmk => {
            optionsHtml += `<option value="${rmk}">${rmk}</option>`;
        });
        filterDropdown.innerHTML = optionsHtml;
        
        if (UniqueRemarks.has(currentSelection)) {
            filterDropdown.value = currentSelection;
        }
    }

    if (RowsWithRemarks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#64748b; padding:20px;">No Column L remarks found in current view.</td></tr>';
        return;
    }

    const ActiveFilter = filterDropdown ? filterDropdown.value : "ALL";
    const FinalRows = ActiveFilter === "ALL" 
        ? RowsWithRemarks 
        : RowsWithRemarks.filter(r => r.remark.trim() === ActiveFilter);

    if (FinalRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#64748b; padding:20px;">No DOs match this remark filter.</td></tr>';
        return;
    }

    FinalRows.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>${row.inv}</strong></td><td><span class="remark-note-text">${row.remark}</span></td>`;
        tbody.appendChild(tr);
    });
}

// Triggered when user selects a specific remark from the dropdown
function applyRemarkFilter() {
    renderRemarksOverview(DataHoarderArray);
}

// Spreadsheet View Mode: "default" (clean manifest view) vs "batch" (expanded batch view with Col K/L codes and truck/hub info)
let spreadsheetViewMode = localStorage.getItem("spreadsheetViewMode") || "default";

function setSpreadsheetViewMode(mode) {
    spreadsheetViewMode = mode === 'batch' ? 'batch' : 'default';
    try {
        localStorage.setItem("spreadsheetViewMode", spreadsheetViewMode);
    } catch (e) {}
    updateSpreadsheetViewModeUI();
    renderTable(currentFilteredDataset);
    if (typeof showToast === 'function') {
        showToast(`Switched to ${spreadsheetViewMode === 'batch' ? 'Batch Details View (showing product codes & models)' : 'Default Manifest View (clean layout)'}.`, "info");
    }
}

function updateSpreadsheetViewModeUI() {
    const defBtn = document.getElementById("viewModeDefaultBtn");
    const batchBtn = document.getElementById("viewModeBatchBtn");
    if (defBtn) defBtn.classList.toggle("active", spreadsheetViewMode === 'default');
    if (batchBtn) batchBtn.classList.toggle("active", spreadsheetViewMode === 'batch');
}

// Render Main Manifest Spreadsheet Table with Right-Click Inspection Listener
function renderTable(dataSlice) {
    const tbody = document.getElementById("tableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!dataSlice || dataSlice.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 48px 20px; color: #94a3b8; font-size: 14px; font-weight: 500;">
                    <div style="font-size: 16px; font-weight: 700; color: var(--fg); margin-bottom: 6px;">No DO Records Found</div>
                    <span style="font-size: 13px; color: var(--fg-muted);">
                        No rows match your current filter parameters. Click "Clear Filters" or adjust column AutoFilters.
                    </span>
                </td>
            </tr>`;
        return;
    }

    const isBatchView = spreadsheetViewMode === 'batch';
    const doQuery = explorerFilters.doText ? explorerFilters.doText.toLowerCase() : "";
    const addrQuery = explorerFilters.address ? explorerFilters.address.toLowerCase() : "";

    dataSlice.forEach(row => {
        const Match = ProductMasterLookupMap[row.inv] || {};
        const Cat = Match.doCategory || "pending category";
        const ListK = Match.listK || [];
        const ListL = Match.listL || [];

        const catLower = (Cat || "").toLowerCase().trim();
        const badgeClass = catLower === 'big' ? 'category-big' : catLower === 'small' ? 'category-small' : catLower === 'mix' ? 'category-mix' : catLower === 'not found' ? 'category-notfound' : 'category-other';
        const CatBadge = `<span class="category-badge ${badgeClass}">${Cat}</span>`;

        // Only inject product codes (Col K) & model names (Col L) if in 'Batch View' mode
        const DisplayColK = (isBatchView && ListK.length > 0) ? `<br><small style="color:#3b82f6; font-weight:600;">${ListK.join(", ")}</small>` : "";
        const DisplayColL = (isBatchView && ListL.length > 0) ? `<br><small style="color:#10b981; font-weight:600;">${ListL.join(", ")}</small>` : "";

        // Optional Batch metadata (Truck / Hub) displayed nicely in Batch View
        let batchInfo = "";
        if (isBatchView && (Match.truck || Match.hub)) {
            const t = Match.truck ? `<span class="truck-badge" style="font-size:10px; padding:1px 5px; background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); border-radius:3px;">🚚 ${escapeHtml(Match.truck)}</span>` : "";
            const h = Match.hub ? `<span class="hub-badge" style="font-size:10px; padding:1px 5px; background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3); border-radius:3px;">🏢 ${escapeHtml(Match.hub)}</span>` : "";
            if (t || h) {
                batchInfo = `<div style="display:flex; gap:4px; margin-top:3px; flex-wrap:wrap;">${t}${h}</div>`;
            }
        }

        const remarkText = (row.remark && row.remark.trim() !== "" && row.remark.trim() !== "-") ? row.remark.trim() : "";
        let remarkHtml = "";
        if (remarkText) {
            remarkHtml = `<div class="remark-note-text" style="font-weight: 700; color: #f59e0b; font-size: 11px; margin-bottom: 3px; display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: rgba(245, 158, 11, 0.1); border-radius: 4px; border: 1px solid rgba(245, 158, 11, 0.25);"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/></svg>${escapeHtml(remarkText)}</div>`;
        }

        let catContent = "";
        if (isBatchView) {
            if (remarkHtml && Cat && Cat !== "pending category") {
                catContent = `${remarkHtml}<div>${CatBadge}</div>${batchInfo}`;
            } else if (remarkHtml) {
                catContent = `${remarkHtml}${batchInfo}`;
            } else if (Cat && Cat !== "pending category") {
                catContent = `${CatBadge}${batchInfo}`;
            } else {
                catContent = batchInfo || `<span style="color:var(--fg-muted);">-</span>`;
            }
        } else {
            // Default View: Clean layout without tall stacks
            if (remarkHtml && Cat && Cat !== "pending category" && Cat !== "not found") {
                catContent = `${remarkHtml}<div>${CatBadge}</div>`;
            } else if (remarkHtml) {
                catContent = remarkHtml;
            } else if (Cat && Cat !== "pending category" && Cat !== "not found") {
                catContent = CatBadge;
            } else {
                catContent = `<span style="color:var(--fg-muted);">-</span>`;
            }
        }

        // Highlight matching DO or Address text if active
        let displayInv = row.inv;
        if (doQuery && row.inv.toLowerCase().includes(doQuery)) {
            const regex = new RegExp(`(${escapeRegExp(doQuery)})`, 'gi');
            displayInv = row.inv.replace(regex, `<span class="search-highlight">$1</span>`);
        }

        let displayAddr = row.addr;
        if (addrQuery && row.addr.toLowerCase().includes(addrQuery)) {
            const regex = new RegExp(`(${escapeRegExp(addrQuery)})`, 'gi');
            displayAddr = row.addr.replace(regex, `<span class="search-highlight">$1</span>`);
        }

        const tr = document.createElement("tr");
        tr.style.cursor = "context-menu";
        tr.title = "Right-click to inspect DO details in a new tab";
        tr.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            openDoDetailsTab(row.inv);
        });

        tr.innerHTML = `
            <td class="mono-cell"><strong>${displayInv}</strong></td>
            <td><strong>${row.route}</strong></td>
            <td><strong>${row.name}</strong></td>
            <td>${displayAddr}${DisplayColK}${DisplayColL}</td>
            <td class="number-cell">${row.vol > 0 ? row.vol.toFixed(4) : "-"}</td>
            <td class="number-cell">${row.qty.toLocaleString()}</td>
            <td class="number-cell">${row.sku.toLocaleString()}</td>
            <td>${catContent}</td>
        `;
        tbody.appendChild(tr);
    });
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Search Filter (Legacy search-box connector)
function filterTable() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;
    explorerFilters.address = searchInput.value;
    const topAddr = document.getElementById("explorerAddressInput");
    if (topAddr) topAddr.value = searchInput.value;
    applyExplorerFilters();
}

// Update UI status tag showing number of saved rules
function updateRulesStatusUI() {
    const StoredCount = Object.keys(ProductSizeRuleMap).length;
    const StatusElement = document.getElementById("rulesStatusTag");
    if (StatusElement) {
        StatusElement.innerText = `(${StoredCount.toLocaleString()} rules saved)`;
    }
}

// Reset Dashboard
async function resetDashboard() {
    const proceed = await window.showConfirmDialog({
        title: "Reset Dashboard",
        message: "Are you sure you want to reset all loaded dashboard data?",
        confirmText: "Reset",
        isDanger: true,
        icon: "🗑️"
    });
    if (!proceed) return;

    DataHoarderArray = [];
    MasterFileStoreArray = [];
    ProductMasterLookupMap = {};
    currentFilteredDataset = [];

    localStorage.removeItem("LastUploadedDoSummary");
    localStorage.removeItem("RawUploadedDoSummary");
    localStorage.removeItem("LastUploadedRouteData");
    localStorage.removeItem("ShippingInsightData");
    localStorage.removeItem("LastDoSummaryFileName");
    localStorage.removeItem("LastRouteFileName");
    localStorage.removeItem("LastShippingInsightFileName");

    const filePicker = document.getElementById("filePicker");
    if (filePicker) filePicker.value = "";
    const standalonePicker = document.getElementById("standaloneFilePicker");
    if (standalonePicker) standalonePicker.value = "";
    const productMasterPicker = document.getElementById("productMasterPicker");
    if (productMasterPicker) productMasterPicker.value = "";
    const shippingInsightPicker = document.getElementById("shippingInsightPicker");
    if (shippingInsightPicker) shippingInsightPicker.value = "";
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";

    resetAllExplorerFilters();
    updateDataSourceStatus('none', '');
    updateMemoryBadge();
    refreshDashboard();
}

// Smart Launcher for Shipping Insight: Opens dashboard in a NEW TAB
function openShippingInsightTab() {
    const StoredInsightData = localStorage.getItem("ShippingInsightData");

    if (!StoredInsightData || JSON.parse(StoredInsightData).length === 0) {
        if (typeof showToast === 'function') {
            showToast("Please upload your Shipping Insight File (.xlsx) using the 'Shipping Insight File' upload button first!", "info");
        } else {
            alert("Please upload your Shipping Insight File (.xlsx) first!");
        }
        return;
    }

    // Opens Shipping Insight in a new tab
    window.open('shipping_insight.html', '_blank');
}

// Opens DO breakdown detail page in a new tab upon right-click
function openDoDetailsTab(invoiceNo) {
    if (!invoiceNo) return;
    localStorage.setItem("SelectedDoForDetails", invoiceNo);
    localStorage.setItem("DoDetailsReturnTo", "index.html");
    window.open('do_details.html', '_blank');
}


// Load saved files and display active file names on boot
function bootRestoreSavedFiles() {
    const SavedDoData = localStorage.getItem("LastUploadedDoSummary");
    const SavedRawDoData = localStorage.getItem("RawUploadedDoSummary");
    const SavedRouteData = localStorage.getItem("LastUploadedRouteData");
    const SavedBatchMap = localStorage.getItem("LastMasterBatchLookupMap");

    if (SavedBatchMap) {
        try {
            const parsedBatchMap = JSON.parse(SavedBatchMap);
            Object.keys(parsedBatchMap).forEach(fileKey => {
                Object.keys(parsedBatchMap[fileKey]).forEach(k => {
                    const item = parsedBatchMap[fileKey][k];
                    item.sizesSet = new Set(item.sizesArray || []);
                });
            });
            MasterBatchLookupMap = parsedBatchMap;

            // Rebuild Batch File Selector Chips
            const batchFileChips = document.getElementById("batchFileChips");
            if (batchFileChips) {
                const keys = Object.keys(MasterBatchLookupMap);
                let chipsHtml = `<button class="file-chip" data-filename="ALL" onclick="filterBatchByFile('ALL', this)">All Files Combined (${keys.length})</button>`;
                keys.forEach(f => {
                    chipsHtml += `<button class="file-chip" data-filename="${f}" onclick="filterBatchByFile('${f}', this)">${f}</button>`;
                });
                batchFileChips.innerHTML = chipsHtml;
                
                const savedBatchFilter = localStorage.getItem("ActiveBatchFilter") || "ALL";
                filterBatchByFile(savedBatchFilter);
            }
        } catch (e) {
            console.error("Failed parsing master batch lookup map from memory:", e);
        }
    }

    if (SavedRouteData) {
        try {
            ProductMasterLookupMap = JSON.parse(SavedRouteData);
            // Re-hydrate sizesSet in ProductMasterLookupMap
            Object.keys(ProductMasterLookupMap).forEach(k => {
                const item = ProductMasterLookupMap[k];
                item.sizesSet = new Set(item.sizesArray || []);
            });
            if (typeof sanitizeProductMasterLookup === 'function') {
                ProductMasterLookupMap = sanitizeProductMasterLookup(ProductMasterLookupMap);
            }
        } catch (e) {
            console.error("Failed parsing route data from memory:", e);
        }
    }

    if (SavedDoData || SavedRawDoData) {
        try {
            // Load the true RAW data into the master array
            if (SavedRawDoData) {
                MasterFileStoreArray = JSON.parse(SavedRawDoData);
            } else {
                MasterFileStoreArray = JSON.parse(SavedDoData); // Backwards compatibility
            }
            
            // Load the FILTERED data into the active array
            if (SavedDoData) {
                DataHoarderArray = JSON.parse(SavedDoData);
            } else {
                DataHoarderArray = [...MasterFileStoreArray];
            }
            
            // Rebuild DO Summary File Selector Chips
            const uniqueFiles = [...new Set(MasterFileStoreArray.map(item => item.fileName).filter(Boolean))];
            if (uniqueFiles.length > 0) {
                const doSummaryChips = document.getElementById("doSummaryChips");
                if (doSummaryChips) {
                    let chipsHtml = `<button class="file-chip" data-filename="ALL" onclick="filterByFile('ALL', this)">All Files Combined (${uniqueFiles.length})</button>`;
                    uniqueFiles.forEach(f => {
                        chipsHtml += `<button class="file-chip" data-filename="${f}" onclick="filterByFile('${f}', this)">${f}</button>`;
                    });
                    doSummaryChips.innerHTML = chipsHtml;
                    
                    const savedFilter = localStorage.getItem("ActiveDoSummaryFilter") || "ALL";
                    filterByFile(savedFilter);
                }
            }
            
            renderRemarksOverview(DataHoarderArray);
        } catch (e) {
            console.error("Failed parsing DO Summary data from memory:", e);
        }
    }

    updateMemoryBadge();
}

// Initialize on Boot
window.onload = function() {
    if (typeof initTheme === 'function') initTheme();
    updateSpreadsheetViewModeUI();
    bootRestoreSavedFiles();
    refreshDashboard();
};