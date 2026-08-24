// Helper to check if a value in Truck column is a status string rather than a valid physical truck identifier
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

// Sanitizes a ProductMasterLookupMap object by stripping status strings (e.g. HOLD, CANCEL) from trucks
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

// Reset specific individual file data by file type ('do', 'batch', 'shipping')
function resetSpecificFile(fileType) {
    if (fileType === 'do' || fileType === 'dosummary') {
        MasterFileStoreArray = [];
        DataHoarderArray = [];
        localStorage.removeItem("LastUploadedDoSummary");
        localStorage.removeItem("LastDoSummaryFileName");

        const filePicker = document.getElementById("filePicker");
        if (filePicker) filePicker.value = "";

        const fileSelector = document.getElementById("fileSelector");
        if (fileSelector) {
            fileSelector.innerHTML = '<option value="ALL">All Files Combined (0)</option>';
        }

        if (typeof refreshDashboard === 'function') refreshDashboard();
    } else if (fileType === 'batch' || fileType === 'route' || fileType === 'productmaster') {
        ProductMasterLookupMap = {};
        localStorage.removeItem("LastUploadedRouteData");
        localStorage.removeItem("LastRouteFileName");

        const pmPicker = document.getElementById("productMasterPicker");
        if (pmPicker) pmPicker.value = "";

        if (typeof refreshDashboard === 'function') refreshDashboard();
    } else if (fileType === 'shipping' || fileType === 'insight') {
        localStorage.removeItem("ShippingInsightData");
        localStorage.removeItem("LastShippingInsightFileName");

        const siPicker = document.getElementById("shippingInsightPicker");
        if (siPicker) siPicker.value = "";

        if (typeof refreshDashboard === 'function') refreshDashboard();
    }

    if (typeof updateMemoryBadge === 'function') updateMemoryBadge();
}

// Smart Multi-File Excel Parser with Column L (Remarks) Extraction
async function handleFileUpload(event) {
    const FileListObjects = Array.from(event.target.files);
    if (FileListObjects.length === 0) return;

    MasterFileStoreArray = [];
    const FileSelectorDropdown = document.getElementById("fileSelector");
    if (FileSelectorDropdown) {
        FileSelectorDropdown.innerHTML = `<option value="ALL">All Files Combined (${FileListObjects.length})</option>`;
    }

    for (const FilePickerElement of FileListObjects) {
        if (FileSelectorDropdown) {
            const OptionElement = document.createElement("option");
            OptionElement.value = FilePickerElement.name;
            OptionElement.textContent = FilePickerElement.name;
            FileSelectorDropdown.appendChild(OptionElement);
        }

        await new Promise((resolve) => {
            const ReaderObject = new FileReader();
            ReaderObject.onload = function(e) {
                try {
                    const RawArrayBuffer = e.target.result;
                    const WorkbookObject = XLSX.read(RawArrayBuffer, { type: 'array' });

                    // Determine sheets to parse:
                    // 1. If an explicit consolidated summary sheet exists (e.g., "Final Summary List", "Summary", "Consolidated"), use it.
                    // 2. Otherwise (e.g. workbook with "Batch 01", "Batch 02", "Batch 03"), parse ALL sheets and combine their rows.
                    let targetSheetNames = [];
                    const foundSummarySheet = WorkbookObject.SheetNames.find(name => {
                        const lower = name.toLowerCase().trim();
                        const isBatchSheet = lower.includes("batch");
                        const isSummaryKeyword = lower.includes("summary") || lower.includes("consolidated") || lower.includes("overall") || lower === "final";
                        return isSummaryKeyword && !isBatchSheet;
                    });

                    if (foundSummarySheet) {
                        targetSheetNames = [foundSummarySheet];
                    } else {
                        targetSheetNames = WorkbookObject.SheetNames;
                    }

                    targetSheetNames.forEach(SelectedSheetName => {
                        const TargetSheetHoarder = WorkbookObject.Sheets[SelectedSheetName];
                        if (!TargetSheetHoarder) return;

                        const RawRows = XLSX.utils.sheet_to_json(TargetSheetHoarder, { header: 1, raw: false });
                        if (!RawRows || RawRows.length === 0) return;

                        let DataStartRowIndex = 1;
                        let TrailingColIdx = 6;
                        let LeadingColIdx = 7;

                        for (let r = 0; r < Math.min(5, RawRows.length); r++) {
                            const rowText = (RawRows[r] || []).map(cell => String(cell || "").toLowerCase().trim());
                            
                            const firstCell = String(RawRows[r]?.[0] || "").toUpperCase();
                            if (firstCell.includes("INVOICE") || firstCell.includes("DO") || firstCell.includes("SHIPMENT")) {
                                DataStartRowIndex = r + 1;
                            }

                            const tIdx = rowText.findIndex(t => t === "trailing" || t === "status 1");
                            if (tIdx !== -1) TrailingColIdx = tIdx;

                            const lIdx = rowText.findIndex(t => t === "leading status" || t === "leading");
                            if (lIdx !== -1) LeadingColIdx = lIdx;
                        }

                        for (let HamsterWheelIndex = DataStartRowIndex; HamsterWheelIndex < RawRows.length; HamsterWheelIndex++) {
                            const row = RawRows[HamsterWheelIndex];
                            if (!row || !row[0] || String(row[0]).toUpperCase().includes("TOTAL") || String(row[0]).toUpperCase() === "SHIPMENT") continue;

                            MasterFileStoreArray.push({
                                fileName: FilePickerElement.name,
                                inv: String(row[0] || "").trim(),
                                div: String(row[1] || "N/A").trim(),
                                code: String(row[2] || "").trim(),
                                route: String(row[3] || "").trim(),
                                name: String(row[4] || "").trim(),
                                addr: [row[5]].filter(Boolean).join(" ").trim(),
                                colG: String(row[TrailingColIdx] || "Missing").trim(),
                                colH: String(row[LeadingColIdx] || "Missing").trim(),
                                vol: parseFloat(row[8]) || 0,
                                qty: parseInt(row[9]) || 0,
                                sku: parseInt(row[10]) || 0,
                                remark: String(row[11] || "").trim() // Column L (Remarks)
                            });
                        }
                    });
                } catch (err) {
                    console.error("File parsing error:", err);
                }
                resolve();
            };
            ReaderObject.readAsArrayBuffer(FilePickerElement);
        });
    }

    if (MasterFileStoreArray.length === 0) {
        showToast("Could not extract data rows from uploaded file(s)!", "warning");
    }

    localStorage.setItem("LastUploadedDoSummary", JSON.stringify(MasterFileStoreArray));
    const DoNames = FileListObjects.map(f => f.name).join(", ");
    localStorage.setItem("LastDoSummaryFileName", DoNames);

    if (typeof updateMemoryBadge === 'function') updateMemoryBadge();

    DataHoarderArray = [...MasterFileStoreArray];
    refreshDashboard();
}

// Process Planning / Source Files (.xlsm / .xlsx / .csv) targeting 'Insert Batch' sheet tab
async function handleProductMasterUpload(event) {
    const SourceFiles = Array.from(event.target.files);
    if (SourceFiles.length === 0) return;

    // Overwrite existing data (reset) instead of merging
    ProductMasterLookupMap = {};

    for (const SourceFile of SourceFiles) {
        await new Promise((resolve) => {
            const ReaderObject = new FileReader();
            const IsCsvFile = SourceFile.name.toLowerCase().endsWith('.csv');

            ReaderObject.onload = function(e) {
                let RawRows = [];

                if (IsCsvFile) {
                    const CsvText = e.target.result;
                    const WorkbookObject = XLSX.read(CsvText, { type: 'string' });
                    RawRows = XLSX.utils.sheet_to_json(WorkbookObject.Sheets[WorkbookObject.SheetNames[0]], { header: 1 });
                } else {
                    const RawArrayBuffer = e.target.result;
                    const WorkbookObject = XLSX.read(RawArrayBuffer, { type: 'array' });

                    // Target the 'Insert Batch' sheet tab specifically
                    let TargetSheetName = WorkbookObject.SheetNames.find(name => {
                        const lower = name.toLowerCase().trim();
                        return lower === "insert batch" || lower.includes("insert batch") || lower.includes("batch");
                    }) || WorkbookObject.SheetNames[0];

                    const TargetSheet = WorkbookObject.Sheets[TargetSheetName];
                    RawRows = XLSX.utils.sheet_to_json(TargetSheet, { header: 1 });
                }

                if (RawRows.length < 4) { resolve(); return; }

                // Data starts at Row 5 (Index 4), header is at Row 4 (Index 3)
                for (let i = 4; i < RawRows.length; i++) {
                    const row = RawRows[i];
                    if (!row || !row[3]) continue; // Skip empty DO rows

                    const RawDoStr = String(row[3]).trim(); // Col D (Index 3) = DO Number
                    if (!RawDoStr || RawDoStr.toUpperCase().includes("TOTAL") || RawDoStr.toUpperCase().includes("HUB")) continue;

                    // Extract full DO number
                    const CleanedFirstToken = RawDoStr.split(" ")[0].trim();
                    const InvoiceKey = CleanedFirstToken;

                    const BatchVal = String(row[0] || "").trim(); // Col A (Index 0) = Batch Number / Batch Data
                    const TruckVal = String(row[1] || "").trim(); // Col B (Index 1) = Truck Number
                    const HubVal = String(row[2] || "").trim();   // Col C (Index 2) = Hub
                    const RouteVal = String(row[4] || "").trim(); // Col E (Index 4) = Route

                    const ColFVal = String(row[5] || "").trim(); // Col F (Index 5) = Product Code
                    const ColGVal = String(row[6] || "").trim(); // Col G (Index 6) = Ship Qty
                    const ColJVal = String(row[9] || "").trim(); // Col J (Index 9) = Type (Small/Big/Mix)
                    const ColKVal = String(row[10] || "").trim(); // Col K (Index 10) = Model Name
                    const ColOVal = String(row[14] || "").trim(); // Col O (Index 14) = Volume (m3)

                    // Clean and parse Ship Quantity from Column G
                    const CleanQtyNum = parseInt(ColGVal.replace(/[^0-9]/g, ""), 10);
                    const LineQty = (!isNaN(CleanQtyNum) && CleanQtyNum > 0) ? CleanQtyNum : 1;

                    // Classify item row category directly from Column J (Type)
                    const LowerType = ColJVal.toLowerCase();
                    let RowCategory = "small";
                    if (LowerType.includes("big")) RowCategory = "big";
                    else if (LowerType.includes("mix")) RowCategory = "mix";
                    else if (LowerType.includes("small")) RowCategory = "small";

                    if (!ProductMasterLookupMap[InvoiceKey]) {
                        const initTrucks = TruckVal ? TruckVal.split(/[,/&]+/).map(t => t.trim()).filter(t => !isStatusOrNonTruck(t)) : [];
                        const initHubs = HubVal ? HubVal.split(/[,/&]+/).map(h => h.trim()).filter(Boolean) : [];
                        const initBatches = BatchVal ? [BatchVal] : [];
                        ProductMasterLookupMap[InvoiceKey] = {
                            items: [], listK: [], listL: [], sizesSet: new Set(), doCategory: RowCategory,
                            batch: BatchVal, batches: initBatches,
                            truck: TruckVal, hub: HubVal, route: RouteVal, trucks: initTrucks, hubs: initHubs,
                            status: isStatusOrNonTruck(TruckVal) ? TruckVal.toUpperCase() : "OK"
                        };
                    } else {
                        if (BatchVal) {
                            if (!ProductMasterLookupMap[InvoiceKey].batches) {
                                ProductMasterLookupMap[InvoiceKey].batches = ProductMasterLookupMap[InvoiceKey].batch ? [ProductMasterLookupMap[InvoiceKey].batch] : [];
                            }
                            if (!ProductMasterLookupMap[InvoiceKey].batches.includes(BatchVal)) {
                                ProductMasterLookupMap[InvoiceKey].batches.push(BatchVal);
                            }
                            ProductMasterLookupMap[InvoiceKey].batch = ProductMasterLookupMap[InvoiceKey].batches.join(", ");
                        }
                        if (TruckVal) {
                            if (!ProductMasterLookupMap[InvoiceKey].trucks) {
                                ProductMasterLookupMap[InvoiceKey].trucks = ProductMasterLookupMap[InvoiceKey].truck 
                                    ? ProductMasterLookupMap[InvoiceKey].truck.split(/[,/&]+/).map(t => t.trim()).filter(t => !isStatusOrNonTruck(t)) 
                                    : [];
                            }
                            const newTrucks = TruckVal.split(/[,/&]+/).map(t => t.trim()).filter(t => !isStatusOrNonTruck(t));
                            newTrucks.forEach(t => {
                                if (!ProductMasterLookupMap[InvoiceKey].trucks.includes(t)) {
                                    ProductMasterLookupMap[InvoiceKey].trucks.push(t);
                                }
                            });
                            ProductMasterLookupMap[InvoiceKey].truck = ProductMasterLookupMap[InvoiceKey].trucks.join(", ") || TruckVal;
                            if (isStatusOrNonTruck(TruckVal)) {
                                ProductMasterLookupMap[InvoiceKey].status = TruckVal.toUpperCase();
                            }
                        }
                        if (HubVal) {
                            if (!ProductMasterLookupMap[InvoiceKey].hubs) {
                                ProductMasterLookupMap[InvoiceKey].hubs = ProductMasterLookupMap[InvoiceKey].hub 
                                    ? ProductMasterLookupMap[InvoiceKey].hub.split(/[,/&]+/).map(h => h.trim()).filter(Boolean) 
                                    : [];
                            }
                            const newHubs = HubVal.split(/[,/&]+/).map(h => h.trim()).filter(Boolean);
                            newHubs.forEach(h => {
                                if (!ProductMasterLookupMap[InvoiceKey].hubs.includes(h)) {
                                    ProductMasterLookupMap[InvoiceKey].hubs.push(h);
                                }
                            });
                            ProductMasterLookupMap[InvoiceKey].hub = ProductMasterLookupMap[InvoiceKey].hubs.join(", ");
                        }
                        if (RouteVal && !ProductMasterLookupMap[InvoiceKey].route) ProductMasterLookupMap[InvoiceKey].route = RouteVal;
                    }

                    // Save Product Code, Model Name, Ship Quantity, Route, Truck, and Hub per item line
                    const itemTrucks = TruckVal ? TruckVal.split(/[,/&]+/).map(t => t.trim()).filter(t => !isStatusOrNonTruck(t)) : [];
                    const itemHubs = HubVal ? HubVal.split(/[,/&]+/).map(h => h.trim()).filter(Boolean) : [];

                    ProductMasterLookupMap[InvoiceKey].items.push({
                        code: ColFVal || "Unspecified Code",
                        desc: ColKVal || "No Description",
                        qty: LineQty,
                        batch: BatchVal,
                        route: RouteVal,
                        truck: TruckVal,
                        hub: HubVal,
                        trucks: itemTrucks,
                        hubs: itemHubs
                    });

                    if (ColFVal && !ProductMasterLookupMap[InvoiceKey].listK.includes(ColFVal)) {
                        ProductMasterLookupMap[InvoiceKey].listK.push(ColFVal);
                    }
                    if (ColKVal && !ProductMasterLookupMap[InvoiceKey].listL.includes(ColKVal)) {
                        ProductMasterLookupMap[InvoiceKey].listL.push(ColKVal);
                    }

                    // Store row category into the DO's size set
                    ProductMasterLookupMap[InvoiceKey].sizesSet.add(RowCategory);
                }
                resolve();
            };

            if (IsCsvFile) ReaderObject.readAsText(SourceFile);
            else ReaderObject.readAsArrayBuffer(SourceFile);
        });
    }

    // Compute FINAL DO Category across all item rows for each DO
    Object.keys(ProductMasterLookupMap).forEach(key => {
        const SizeSet = ProductMasterLookupMap[key].sizesSet;

        if (SizeSet.has("mix") || (SizeSet.has("big") && SizeSet.has("small"))) {
            ProductMasterLookupMap[key].doCategory = "mix";
        } else if (SizeSet.has("big")) {
            ProductMasterLookupMap[key].doCategory = "big";
        } else {
            ProductMasterLookupMap[key].doCategory = "small";
        }
    });

    // Check for unmatched DOs between Batch Picking and DO Summary
    let UnmatchedMsg = "";
    if (typeof MasterFileStoreArray !== 'undefined' && MasterFileStoreArray.length > 0) {
        const SummarySet = new Set(MasterFileStoreArray.map(item => item.inv));
        const MissingInSummary = Object.keys(ProductMasterLookupMap).filter(key => !SummarySet.has(key));

        if (MissingInSummary.length > 0) {
            const SampleList = MissingInSummary.slice(0, 4).join(", ");
            const OverflowCount = MissingInSummary.length > 4 ? ` (+${MissingInSummary.length - 4} more)` : "";
            UnmatchedMsg = `\n\n[NOTICE] Found ${MissingInSummary.length} DO(s) in Batch Picking missing from DO Summary file: ${SampleList}${OverflowCount}`;
        }
    }

    showToast(`Processed ${SourceFiles.length} Batch Picking file(s) from 'Insert Batch' sheet!${UnmatchedMsg}`, "success");

    const RouteNames = SourceFiles.map(f => f.name).join(", ");
    localStorage.setItem("LastRouteFileName", RouteNames);
    localStorage.setItem("LastUploadedRouteData", JSON.stringify(ProductMasterLookupMap));

    // LINK TO BATCH ANALYTICS
    if (window.batchManager) {
        for (const file of SourceFiles) {
            try {
                const batchData = await window.batchManager.parseBatchFile(file);
                if (batchData) {
                    window.batchManager.addBatch(batchData);
                }
            } catch (err) {
                console.error("Failed linking batch to analytics:", err);
            }
        }
    }

    if (typeof updateMemoryBadge === 'function') updateMemoryBadge();
    refreshDashboard();
}

// Save Master Catalog rules to localStorage
function handleRulesUpload(event) {
    const RulesFile = event.target.files[0];
    if (!RulesFile) return;

    const ReaderObject = new FileReader();
    ReaderObject.onload = function(e) {
        try {
            const RawArrayBuffer = e.target.result;
            const WorkbookObject = XLSX.read(RawArrayBuffer, { type: 'array' });
            const FirstSheet = WorkbookObject.Sheets[WorkbookObject.SheetNames[0]];
            const RawRows = XLSX.utils.sheet_to_json(FirstSheet, { header: 1, raw: false });

            ProductSizeRuleMap = JSON.parse(localStorage.getItem("ProductSizeVault")) || {};
            let SavedCount = 0;

            const firstRowColB = String(RawRows[0]?.[1] || "").toLowerCase().trim();
            const startIdx = (firstRowColB.includes("big") || firstRowColB.includes("small")) ? 0 : 1;

            for (let i = startIdx; i < RawRows.length; i++) {
                const row = RawRows[i];
                if (!row || !row[0]) continue;

                const ProdCode = String(row[0]).trim();
                const RawSize = String(row[1] || "").toLowerCase().trim();

                let SizeVal = "";
                if (RawSize.includes("big")) SizeVal = "big";
                else if (RawSize.includes("small")) SizeVal = "small";

                if (ProdCode && SizeVal) {
                    ProductSizeRuleMap[ProdCode] = SizeVal;
                    SavedCount++;
                }
            }

            localStorage.setItem("ProductSizeVault", JSON.stringify(ProductSizeRuleMap));
            updateRulesStatusUI();
            showToast(`Saved ${SavedCount.toLocaleString()} product rules! Total Vault: ${Object.keys(ProductSizeRuleMap).length.toLocaleString()} items.`, "success");
            refreshDashboard();

        } catch (err) {
            showToast("Failed to parse Master Catalog file: " + err.message);
        }
    };
    ReaderObject.readAsArrayBuffer(RulesFile);
}

// Separate Shipping Insight File Loader with Full Summary Reconciliation
async function handleShippingInsightUpload(event) {
    const InsightFile = event.target.files[0];
    if (!InsightFile) return;

    const ReaderObject = new FileReader();
    ReaderObject.onload = function(e) {
        try {
            const RawArrayBuffer = e.target.result;
            const WorkbookObject = XLSX.read(RawArrayBuffer, { type: 'array' });

            let TargetSheetName = WorkbookObject.SheetNames.find(name => {
                const lower = name.toLowerCase();
                return lower.includes("do summary", "error") || lower.includes("summary") || lower.includes("list") || lower.includes("insight");
            }) || WorkbookObject.SheetNames[0];

            const TargetSheet = WorkbookObject.Sheets[TargetSheetName];
            const RawRows = XLSX.utils.sheet_to_json(TargetSheet, { header: 1, raw: false });

            let ShipmentColIdx = 0, TrailingColIdx = 6, LeadingColIdx = 7, DataStartRow = 1;

            for (let r = 0; r < Math.min(5, RawRows.length); r++) {
                const rowText = (RawRows[r] || []).map(cell => String(cell || "").toLowerCase().trim());
                
                const sIdx = rowText.findIndex(t => t === "shipment" || t === "do number" || t === "invoice no");
                if (sIdx !== -1) ShipmentColIdx = sIdx;

                const tIdx = rowText.findIndex(t => t === "trailing" || t === "status 1");
                if (tIdx !== -1) TrailingColIdx = tIdx;

                const lIdx = rowText.findIndex(t => t === "leading status" || t === "leading");
                if (lIdx !== -1) LeadingColIdx = lIdx;

                if (sIdx !== -1 || tIdx !== -1 || lIdx !== -1) { DataStartRow = r + 1; break; }
            }

            // Fallback to local memory if main summary array is not in active scope
            let DoSummaryList = (typeof MasterFileStoreArray !== 'undefined' && MasterFileStoreArray.length > 0)
                ? MasterFileStoreArray 
                : (JSON.parse(localStorage.getItem("LastUploadedDoSummary")) || []);

            const SummaryDoMap = new Map();
            const SummaryDoSet = new Set();
            DoSummaryList.forEach(item => {
                SummaryDoMap.set(item.inv, item);
                SummaryDoSet.add(item.inv);
                const splitKey = item.inv.split(" ")[0].trim();
                if (splitKey && splitKey !== item.inv) {
                    if (!SummaryDoMap.has(splitKey)) SummaryDoMap.set(splitKey, item);
                    SummaryDoSet.add(splitKey);
                }
            });

            let MasterLookup = (typeof ProductMasterLookupMap !== 'undefined' && Object.keys(ProductMasterLookupMap).length > 0)
                ? ProductMasterLookupMap 
                : (JSON.parse(localStorage.getItem("LastUploadedRouteData")) || {});

            const PayloadRecords = [];
            const ProcessedDoSet = new Set();

            // 1. Process all scanned DOs from the Shipping Insight file
            for (let i = DataStartRow; i < RawRows.length; i++) {
                const row = RawRows[i];
                if (!row) continue;

                const RawInvoiceVal = String(row[ShipmentColIdx] || "").trim();
                if (!RawInvoiceVal || RawInvoiceVal.toUpperCase().includes("TOTAL") || RawInvoiceVal.toUpperCase() === "SHIPMENT") continue;

                const colGVal = String(row[TrailingColIdx] || "Missing").trim();
                const colHVal = String(row[LeadingColIdx] || "Missing").trim();

                const isCompletedScan = (colGVal.toLowerCase() === "ship confirm pending" && colHVal.toLowerCase() === "ship confirm pending");
                const existsInSummary = SummaryDoSet.has(RawInvoiceVal);

                // Skip unmatched DOs that are NOT completed
                if (!existsInSummary && !isCompletedScan) {
                    continue;
                }

                let computedType = "PENDING";
                let truckVal = "N/A";
                let hubVal = "N/A";

                if (!existsInSummary && isCompletedScan) {
                    computedType = "UNMATCHED DO";
                } else {
                    const Match = MasterLookup[RawInvoiceVal] || MasterLookup[RawInvoiceVal.split(" ")[0].trim()] || {};
                    computedType = (Match.doCategory || "pending").toUpperCase();
                    truckVal = Match.truck || "N/A";
                    hubVal = Match.hub || "N/A";
                }

                const summaryRecord = SummaryDoMap.get(RawInvoiceVal);
                const RouteVal = summaryRecord ? summaryRecord.route : "";
                const ShipToName = summaryRecord ? summaryRecord.name : String(row[9] || "").trim();
                const CombinedDestination = [RouteVal, ShipToName].filter(Boolean).join(" - ");

                PayloadRecords.push({
                    inv: RawInvoiceVal,
                    truck: truckVal,
                    hub: hubVal,
                    addr: CombinedDestination || ShipToName || "N/A",
                    colG: colGVal,
                    colH: colHVal,
                    doType: computedType
                });

                ProcessedDoSet.add(RawInvoiceVal);
            }

            // 2. Reconcile with DO Summary List: Add missing unscanned DOs as "Pending Scan"
            DoSummaryList.forEach(sumItem => {
                if (!ProcessedDoSet.has(sumItem.inv)) {
                    const Match = MasterLookup[sumItem.inv] || MasterLookup[sumItem.inv.split(" ")[0].trim()] || {};
                    const catType = (Match.doCategory || "pending").toUpperCase();
                    const CombinedDestination = [sumItem.route, sumItem.name].filter(Boolean).join(" - ");

                    PayloadRecords.push({
                        inv: sumItem.inv,
                        truck: Match.truck || "N/A",
                        hub: Match.hub || "N/A",
                        addr: CombinedDestination || sumItem.name || sumItem.addr || "N/A",
                        colG: "picking pending",
                        colH: "picking pending",
                        doType: catType
                    });
                }
            });

localStorage.setItem("ShippingInsightData", JSON.stringify(PayloadRecords));
localStorage.setItem("LastShippingInsightFileName", InsightFile.name);
if (typeof updateMemoryBadge === 'function') updateMemoryBadge();

            // If uploaded directly inside shipping_insight.html, refresh in-place
            if (typeof applyInsightFilter === 'function') {
                RawPayload = PayloadRecords;
                applyInsightFilter();
                showToast(`Refreshed dashboard with ${PayloadRecords.length} DO records!`, "success");
            } else {
                // Uploaded from summary.html: Automatically opens shipping_insight.html in a NEW TAB
                showToast(`Reconciled all ${PayloadRecords.length} DOs! Opening Shipping Insight in a new tab...`, "success");
                window.open('shipping_insight.html', '_blank');
            }

        } catch (err) {
            console.error("Shipping Insight Error Details:", err);
            showToast("[ERROR] Failed to parse Shipping Insight file: " + err.message, "warning");
        }
    };

    ReaderObject.readAsArrayBuffer(InsightFile);
}