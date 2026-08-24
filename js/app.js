// Global Storage Vaults
let ProductMasterLookupMap = {};
let DataHoarderArray = [];
let MasterFileStoreArray = [];

// Update memory status badge with clean chip pills and individual ✕ remove buttons
function updateMemoryBadge() {
    const BadgeElement = document.getElementById("memoryStatusBadge");
    if (!BadgeElement) return;

    const SavedDoName = localStorage.getItem("LastDoSummaryFileName");
    const SavedRouteName = localStorage.getItem("LastRouteFileName");
    const SavedInsightName = localStorage.getItem("LastShippingInsightFileName");

    if (!SavedDoName && !SavedRouteName && !SavedInsightName) {
        BadgeElement.innerHTML = "";
        return;
    }

    let html = "";

    if (SavedDoName) {
        html += `<span class="file-chip green" title="DO Summary File: ${SavedDoName}">📄 ${SavedDoName} <button type="button" class="chip-remove-btn" onclick="resetSpecificFile('do')" title="Remove DO Summary File">✕</button></span>`;
    }
    if (SavedRouteName) {
        html += `<span class="file-chip blue" title="Batch Picking File: ${SavedRouteName}">📦 ${SavedRouteName} <button type="button" class="chip-remove-btn" onclick="resetSpecificFile('batch')" title="Remove Batch Picking File">✕</button></span>`;
    }
    if (SavedInsightName) {
        html += `<span class="file-chip purple" title="Shipping Insight File: ${SavedInsightName}">🚚 ${SavedInsightName} <button type="button" class="chip-remove-btn" onclick="resetSpecificFile('shipping')" title="Remove Shipping Insight File">✕</button></span>`;
    }

    BadgeElement.innerHTML = html;
}

// Refresh UI components
function refreshDashboard() {
    renderTable(DataHoarderArray);
    updateKPIs();
    if (typeof renderCharts === 'function') renderCharts();
    renderRemarksOverview(DataHoarderArray);
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

// Render Main Manifest Table with Right-Click Inspection Listener
function renderTable(dataSlice) {
    const tbody = document.getElementById("tableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!dataSlice || dataSlice.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 48px 20px; color: #94a3b8; font-size: 15px; font-weight: 500;">
                    === Welcome to DO Summary Analytics ===<br>
                    <span style="font-size: 13px; color: #64748b; margin-top: 8px; display: inline-block;">
                        Please select one or more DO Summary Files (.xlsx) using the top-right button to load analytics.
                    </span>
                </td>
            </tr>`;
        return;
    }

    dataSlice.forEach(row => {
        const Match = ProductMasterLookupMap[row.inv] || {};
        const Cat = Match.doCategory || "pending category";
        const ListK = Match.listK || [];
        const ListL = Match.listL || [];

        const catLower = (Cat || "").toLowerCase().trim();
        const badgeClass = catLower === 'big' ? 'category-big' : catLower === 'small' ? 'category-small' : catLower === 'mix' ? 'category-mix' : catLower === 'not found' ? 'category-notfound' : 'category-other';
        const CatBadge = `<span class="category-badge ${badgeClass}">${Cat}</span>`;

        const DisplayColK = ListK.length > 0 ? `<br><small style="color:#3b82f6; font-weight:600;">${ListK.join(", ")}</small>` : "";
        const DisplayColL = ListL.length > 0 ? `<br><small style="color:#10b981; font-weight:600;">${ListL.join(", ")}</small>` : "";

        const tr = document.createElement("tr");
        tr.style.cursor = "context-menu";
        tr.title = "Right-click to inspect DO details in a new tab";
        tr.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            openDoDetailsTab(row.inv);
        });

        tr.innerHTML = `
            <td><strong>${row.inv}</strong>${CatBadge}</td>
            <td>${row.route}</td>
            <td>${row.name}</td>
            <td>${row.addr}${DisplayColK}${DisplayColL}</td>
            <td class="number-col">${row.vol > 0 ? row.vol.toFixed(4) : "-"}</td>
            <td class="number-col">${row.qty}</td>
            <td class="number-col">${row.sku}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Search Filter
function filterTable() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;
    const filterValue = searchInput.value.toLowerCase().trim();
    const filteredData = DataHoarderArray.filter(item => {
        const Match = ProductMasterLookupMap[item.inv] || {};
        const listKStr = (Match.listK || []).join(" ").toLowerCase();
        const listLStr = (Match.listL || []).join(" ").toLowerCase();

        return item.inv.toLowerCase().includes(filterValue) ||
               item.div.toLowerCase().includes(filterValue) ||
               item.route.toLowerCase().includes(filterValue) ||
               item.name.toLowerCase().includes(filterValue) ||
               item.addr.toLowerCase().includes(filterValue) ||
               (item.remark && item.remark.toLowerCase().includes(filterValue)) ||
               listKStr.includes(filterValue) ||
               listLStr.includes(filterValue);
    });

    renderTable(filteredData);
    renderRemarksOverview(filteredData);
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

    localStorage.removeItem("LastUploadedDoSummary");
    localStorage.removeItem("LastUploadedRouteData");
    localStorage.removeItem("ShippingInsightData");
    localStorage.removeItem("LastDoSummaryFileName");
    localStorage.removeItem("LastRouteFileName");
    localStorage.removeItem("LastShippingInsightFileName");

    const filePicker = document.getElementById("filePicker");
    if (filePicker) filePicker.value = "";
    const productMasterPicker = document.getElementById("productMasterPicker");
    if (productMasterPicker) productMasterPicker.value = "";
    const shippingInsightPicker = document.getElementById("shippingInsightPicker");
    if (shippingInsightPicker) shippingInsightPicker.value = "";
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";

    updateMemoryBadge();
    refreshDashboard();
}

// Smart Launcher for Shipping Insight: Opens dashboard in a NEW TAB
function openShippingInsightTab() {
    const StoredInsightData = localStorage.getItem("ShippingInsightData");

    if (!StoredInsightData || JSON.parse(StoredInsightData).length === 0) {
        showToast("Please upload your Shipping Insight File (.xlsx) using the 'Shipping Insight File' upload button first!", "info");
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
    const SavedRouteData = localStorage.getItem("LastUploadedRouteData");

    if (SavedRouteData) {
        try {
            ProductMasterLookupMap = JSON.parse(SavedRouteData);
            if (typeof sanitizeProductMasterLookup === 'function') {
                ProductMasterLookupMap = sanitizeProductMasterLookup(ProductMasterLookupMap);
            }
        } catch (e) {
            console.error("Failed parsing route data from memory:", e);
        }
    }

    if (SavedDoData) {
        MasterFileStoreArray = JSON.parse(SavedDoData);
        DataHoarderArray = [...MasterFileStoreArray];
        renderRemarksOverview(DataHoarderArray);
    }

    updateMemoryBadge();
}

// Initialize on Boot
window.onload = function() {
    if (typeof initTheme === 'function') initTheme();
    bootRestoreSavedFiles();
    refreshDashboard();
};