const LOOSE_CONTAINER_SPECS = {
    '40HC': { id: '40HC', name: '40ft High Cube', truckL: 12.03, truckW: 2.35, truckH: 2.69, maxCBM: 67.5, label: 'Max: ~67.5 m³ (40ft HQ)' },
    '20GP': { id: '20GP', name: '20ft Standard', truckL: 5.90, truckW: 2.35, truckH: 2.39, maxCBM: 33.2, label: 'Max: ~33.2 m³ (20ft GP)' }
};

class LooseLoadPlanner {
    constructor() {
        this.masterData = {}; // key: modelCode, value: {desc, m3, l, w, h}
        this.batchData = {};  // key: modelCode, value: {qty, name}
        this.routeExtras = {}; // key: modelCode, value: {routes: [], totalVol: 0, totalQty: 0} (from Route files)
        this.batchSource = null; // 'batch' | 'route' — which source last populated batchData
        
        this.hasMaster = false;
        this.hasBatch = false;
        
        this.models = [];
        this.simMode = 'volume'; // 'volume' or 'tetris'
        this.truckType = '40HC';
        
        const spec = LOOSE_CONTAINER_SPECS[this.truckType];
        this.truckL = spec.truckL;
        this.truckW = spec.truckW;
        this.truckH = spec.truckH;
        this.maxCBM = spec.maxCBM;
        
        // Colors for visualization (cardboard-toned palette like the Volume Capacity Planner)
        // Base carton = light brown; variations keep cartons distinguishable while looking realistic.
        this.colors = [
            0xd4b483, 0xc8a06b, 0xb9905a, 0xe0c39a,
            0x10b981, 0xa9825a, 0xd4b483, 0xbf9a6b
        ];
        
        // 3D viewer lifecycle handles
        this.renderer = null;
        this.animationId = null;
        this.resizeListener = null;

        // Interaction / animation state
        this.cartonMeshes = [];       // placed cargo meshes, packing order
        this.hiddenModels = new Set(); // model ids hidden via legend (what-if view)
        this.camTween = null;          // active camera tween {t, dur, fromPos, toPos, fromTgt, toTgt}
        this.loadAnim = null;          // active fly-in animation state
        this.animSpeed = 1;            // loading animation speed multiplier (live-adjustable)
        this.animPaused = false;       // merged play/pause state for the animate button
        this.pointerMoveListener = null;
        this.scene = null;
        this.cameraRef = null;
        this.controlsRef = null;

        this.init();
    }
    
    setContainerType(type) {
        if (!LOOSE_CONTAINER_SPECS[type]) return;
        this.truckType = type;
        const spec = LOOSE_CONTAINER_SPECS[type];
        this.truckL = spec.truckL;
        this.truckW = spec.truckW;
        this.truckH = spec.truckH;
        this.maxCBM = spec.maxCBM;
        
        // Update main page buttons
        const btn40 = document.getElementById('looseTruck40Btn');
        const btn20 = document.getElementById('looseTruck20Btn');
        if (btn40 && btn20) {
            if (type === '40HC') {
                btn40.classList.remove('ghost'); btn40.classList.add('active');
                btn20.classList.remove('active'); btn20.classList.add('ghost');
            } else {
                btn20.classList.remove('ghost'); btn20.classList.add('active');
                btn40.classList.remove('active'); btn40.classList.add('ghost');
            }
        }
        
        // Update modal buttons
        const mBtn40 = document.getElementById('modalLooseTruck40Btn');
        const mBtn20 = document.getElementById('modalLooseTruck20Btn');
        if (mBtn40 && mBtn20) {
            if (type === '40HC') {
                mBtn40.classList.remove('ghost'); mBtn40.classList.add('active');
                mBtn20.classList.remove('active'); mBtn20.classList.add('ghost');
            } else {
                mBtn20.classList.remove('ghost'); mBtn20.classList.add('active');
                mBtn40.classList.remove('active'); mBtn40.classList.add('ghost');
            }
        }
        
        this.updateStats();
        
        // If 3D modal is open, rebuild 3D scene
        const modal = document.getElementById('truck3dModal');
        if (modal && modal.style.display !== 'none') {
            this.open3DViewer();
        }
    }
    
    init() {
        console.log("Loose Load Planner Initialized");
        
        // Attempt to load Master Data from LocalStorage memory (linked with Bulk Load Planner)
        try {
            const cachedMaster = localStorage.getItem('GlobalMasterDataMap') || localStorage.getItem('ProductMasterLookupMap');
            if (cachedMaster) {
                const rawObj = JSON.parse(cachedMaster);
                this.masterData = {};
                
                if (Array.isArray(rawObj)) {
                    rawObj.forEach(item => {
                        if (item && item.code) {
                            const code = String(item.code).trim().toUpperCase();
                            const descVal = (item.desc || item.description || '').trim();
                            this.masterData[code] = {
                                code: code,
                                desc: descVal,
                                description: descVal,
                                m3: parseFloat(item.m3) || 0,
                                l: parseFloat(item.l) || null,
                                w: parseFloat(item.w) || null,
                                h: parseFloat(item.h) || null,
                                type: item.type || '',
                                capacities: item.capacities || []
                            };
                        }
                    });
                } else if (typeof rawObj === 'object') {
                    for (const [code, item] of Object.entries(rawObj)) {
                        if (!item) continue;
                        const c = String(item.code || code).trim().toUpperCase();
                        const descVal = (item.desc || item.description || item.modelName || '').trim();
                        this.masterData[c] = {
                            code: c,
                            desc: descVal,
                            description: descVal,
                            m3: parseFloat(item.m3) || 0,
                            l: parseFloat(item.l) || null,
                            w: parseFloat(item.w) || null,
                            h: parseFloat(item.h) || null,
                            type: item.type || '',
                            capacities: item.capacities || []
                        };
                    }
                }
                
                this.hasMaster = Object.keys(this.masterData).length > 0;
                
                if (this.hasMaster) {
                    const statusEl = document.getElementById('masterStatus');
                    if (statusEl) statusEl.textContent = `Linked with Bulk Master (${Object.keys(this.masterData).length} items)`;
                    
                    const clearBtn = document.getElementById('clearMasterBtn');
                    if (clearBtn) clearBtn.style.display = 'inline';
                }
            }
        } catch (e) {
            console.error("Failed to load Master Data from Bulk Load memory", e);
        }
        
        // Attempt to load Batch / Route data from LocalStorage memory (Route wins if both exist)
        try {
            const cachedRoute = localStorage.getItem('LoosePlannerRouteData');
            const cachedBatch = localStorage.getItem('LoosePlannerBatchData');
            
            if (cachedRoute) {
                const parsed = JSON.parse(cachedRoute);
                this.batchData = parsed.batchData || {};
                this.routeExtras = parsed.routeExtras || {};
                this.batchSource = 'route';
                this.hasBatch = Object.keys(this.batchData).length > 0;
                
                if (this.hasBatch) {
                    const st = document.getElementById('routeStatus');
                    if (st) st.textContent = `Loaded from memory (${Object.keys(this.batchData).length} models)`;
                    const cb = document.getElementById('clearRouteBtn');
                    if (cb) cb.style.display = 'inline';
                    this.processCombinedData();
                }
            } else if (cachedBatch) {
                const parsed = JSON.parse(cachedBatch);
                this.batchData = parsed || {};
                this.routeExtras = {};
                this.batchSource = 'batch';
                this.hasBatch = Object.keys(this.batchData).length > 0;
                
                if (this.hasBatch) {
                    const st = document.getElementById('batchStatus');
                    if (st) st.textContent = `Loaded from memory (${Object.keys(this.batchData).length} models)`;
                    const cb = document.getElementById('clearBatchBtn');
                    if (cb) cb.style.display = 'inline';
                    this.processCombinedData();
                }
            }
        } catch (e) {
            console.error("Failed to load Batch/Route Data from memory", e);
        }
        
        this.renderModelDatalist();
    }

    renderModelDatalist() {
        const datalist = document.getElementById("looseModelDatalist");
        if (!datalist) return;
        
        const masterKeys = Object.keys(this.masterData);
        if (masterKeys.length === 0) {
            datalist.innerHTML = '';
            const helper = document.getElementById("manualDataHelper");
            if (helper) helper.textContent = 'Awaiting Master Data upload (or enter SKU directly)';
            return;
        }
        
        // Generate clean options: [Product Code] - [Description] and [Description] - [Product Code] without m3 clutter
        const options = [];
        masterKeys.forEach(code => {
            const m = this.masterData[code];
            const desc = (m.desc || m.description || '').trim();
            
            if (desc && desc.toUpperCase() !== code.toUpperCase()) {
                // Option 1: Product Code - Description (e.g. "12538104 - KD-32W830K E51")
                options.push(`<option value="${code} - ${desc}"></option>`);
                // Option 2: Description - Product Code (e.g. "KD-32W830K E51 - 12538104")
                options.push(`<option value="${desc} - ${code}"></option>`);
            } else {
                // If description is identical or empty, just show code
                options.push(`<option value="${code}"></option>`);
            }
        });
        
        datalist.innerHTML = options.join('');
        
        const helper = document.getElementById("manualDataHelper");
        if (helper) helper.textContent = `${masterKeys.length} model(s) available in Master Data (search by Code or Description)`;
    }

    findMasterItem(query) {
        if (!query) return null;
        const clean = query.trim().toUpperCase();
        
        // 1. Direct code match (e.g. "12538104")
        if (this.masterData[clean]) return this.masterData[clean];
        
        // 2. Extracted prefix match from "CODE - Description" or "Description - CODE"
        if (clean.includes(' - ')) {
            const parts = clean.split(' - ').map(s => s.trim());
            for (const p of parts) {
                if (this.masterData[p]) return this.masterData[p];
                for (const [code, item] of Object.entries(this.masterData)) {
                    const desc = (item.desc || item.description || '').trim().toUpperCase();
                    if (desc === p) {
                        return item;
                    }
                }
            }
        }
        
        // 3. Exact Description match (e.g. "KD-32W830K E51")
        for (const [code, item] of Object.entries(this.masterData)) {
            const desc = (item.desc || item.description || '').trim().toUpperCase();
            if (desc === clean) {
                return item;
            }
        }
        
        // 4. Description starts with query or query starts with description
        for (const [code, item] of Object.entries(this.masterData)) {
            const desc = (item.desc || item.description || '').trim().toUpperCase();
            if (desc && (desc.startsWith(clean) || clean.startsWith(desc))) {
                return item;
            }
        }
        
        // 5. Description contains query or query contains description
        for (const [code, item] of Object.entries(this.masterData)) {
            const desc = (item.desc || item.description || '').trim().toUpperCase();
            if (desc && (desc.includes(clean) || clean.includes(desc))) {
                return item;
            }
        }
        
        // 6. Code contains query
        for (const [code, item] of Object.entries(this.masterData)) {
            if (code.includes(clean)) {
                return item;
            }
        }
        
        return null;
    }

    addManualModel() {
        const modelInput = document.getElementById("manualModelInput");
        const qtyInput = document.getElementById("manualModelQty");
        if (!modelInput || !qtyInput) return;
        
        const rawValue = modelInput.value.trim();
        if (!rawValue) {
            showToast("Please enter or select a model code or description.", "warning");
            modelInput.focus();
            return;
        }
        
        const qty = parseInt(qtyInput.value);
        if (isNaN(qty) || qty <= 0) {
            showToast("Please enter a valid quantity greater than 0.", "warning");
            qtyInput.focus();
            return;
        }
        
        // Smart resolve against Master Data using either Product Code (Col A) or Description (Col B)
        const master = this.findMasterItem(rawValue);
        
        let modelCode;
        let modelName;
        
        if (master) {
            modelCode = master.code || master.modelCode || Object.keys(this.masterData).find(k => this.masterData[k] === master);
            modelName = master.desc || master.description || modelCode;
        } else {
            // Fallback for custom ad-hoc models not in master list
            modelCode = rawValue.split(' - ')[0].trim().toUpperCase();
            if (!modelCode) modelCode = rawValue.toUpperCase();
            modelName = modelCode;
        }
        
        if (!modelCode) {
            showToast("Could not identify a valid model code.", "warning");
            return;
        }
        
        let manualUnitM3 = master ? (parseFloat(master.m3) || 0) : 0;
        if (manualUnitM3 <= 0 && master && master.l && master.w && master.h) {
            manualUnitM3 = (master.l * master.w * master.h) / 1000000;
        }
        
        if (this.batchData[modelCode]) {
            this.batchData[modelCode].qty += qty;
            if (!this.batchData[modelCode].name && modelName) {
                this.batchData[modelCode].name = modelName;
            }
            if (manualUnitM3 > 0 && (!this.batchData[modelCode].unitM3 || this.batchData[modelCode].unitM3 <= 0)) {
                this.batchData[modelCode].unitM3 = manualUnitM3;
            }
        } else {
            this.batchData[modelCode] = { qty: qty, name: modelName, unitM3: manualUnitM3 };
        }
        
        this.hasBatch = true;
        this.batchSource = this.batchSource || 'manual';
        
        // Persist to memory
        try {
            if (this.batchSource === 'route') {
                localStorage.setItem('LoosePlannerRouteData', JSON.stringify({
                    batchData: this.batchData,
                    routeExtras: this.routeExtras
                }));
            } else {
                localStorage.setItem('LoosePlannerBatchData', JSON.stringify(this.batchData));
                const cb = document.getElementById('clearBatchBtn');
                if (cb) cb.style.display = 'inline';
            }
        } catch (e) {
            console.error("Failed to save manual data to memory", e);
        }
        
        this.processCombinedData();
        
        // Clear input for fast next addition and reset focus
        modelInput.value = "";
        modelInput.focus();
    }

    removeModel(modelCode) {
        if (!this.batchData[modelCode]) return;
        
        delete this.batchData[modelCode];
        if (this.routeExtras && this.routeExtras[modelCode]) {
            delete this.routeExtras[modelCode];
        }
        
        if (Object.keys(this.batchData).length === 0) {
            this.hasBatch = false;
            this.models = [];
        }
        
        // Persist updated state
        try {
            if (this.batchSource === 'route') {
                localStorage.setItem('LoosePlannerRouteData', JSON.stringify({
                    batchData: this.batchData,
                    routeExtras: this.routeExtras
                }));
            } else {
                localStorage.setItem('LoosePlannerBatchData', JSON.stringify(this.batchData));
            }
        } catch (e) {
            console.error("Failed to update storage after removing model", e);
        }
        
        if (!this.hasBatch) {
            this.updateStats();
            this.renderTable();
        } else {
            this.processCombinedData();
        }
    }

    updateModelQty(modelCode, newQtyVal) {
        const newQty = parseInt(newQtyVal);
        if (isNaN(newQty) || newQty <= 0) {
            this.removeModel(modelCode);
            return;
        }
        
        if (this.batchData[modelCode]) {
            this.batchData[modelCode].qty = newQty;
            
            try {
                if (this.batchSource === 'route') {
                    localStorage.setItem('LoosePlannerRouteData', JSON.stringify({
                        batchData: this.batchData,
                        routeExtras: this.routeExtras
                    }));
                } else {
                    localStorage.setItem('LoosePlannerBatchData', JSON.stringify(this.batchData));
                }
            } catch (e) {
                console.error("Failed to save updated quantity to storage", e);
            }
            
            this.processCombinedData();
        }
    }

    async clearAllModels() {
        if (Object.keys(this.batchData).length === 0) return;
        const proceed = await window.showConfirmDialog({ title: "Clear Planner", message: "Are you sure you want to clear all loaded models from the planner?", confirmText: "Clear", isDanger: true, icon: "🗑️" });
        if (!proceed) return;
        
        this.batchData = {};
        this.routeExtras = {};
        this.hasBatch = false;
        this.batchSource = null;
        this.models = [];
        
        try {
            localStorage.removeItem('LoosePlannerBatchData');
            localStorage.removeItem('LoosePlannerRouteData');
        } catch (e) {
            console.error(e);
        }
        
        const bStatus = document.getElementById('batchStatus');
        if (bStatus) bStatus.textContent = 'Awaiting "Insert Batch" sheet...';
        const bClear = document.getElementById('clearBatchBtn');
        if (bClear) bClear.style.display = 'none';
        
        const rStatus = document.getElementById('routeStatus');
        if (rStatus) rStatus.textContent = 'Awaiting Route Files (.csv)...';
        const rClear = document.getElementById('clearRouteBtn');
        if (rClear) rClear.style.display = 'none';
        
        this.updateStats();
        this.renderTable();
    }

    async clearMasterData() {
        const proceed = await window.showConfirmDialog({ title: "Clear Master Data", message: "Are you sure you want to clear the saved Master Data from memory?", confirmText: "Clear", isDanger: true, icon: "🗑️" });
        if (proceed) {
            localStorage.removeItem('GlobalMasterDataMap');
            this.masterData = {};
            this.hasMaster = false;
            
            const statusEl = document.getElementById('masterStatus');
            if (statusEl) statusEl.textContent = `Awaiting Master List (m³)...`;
            
            const clearBtn = document.getElementById('clearMasterBtn');
            if (clearBtn) clearBtn.style.display = 'none';
            
            this.renderModelDatalist();
            
            // Re-render UI
            this.processCombinedData();
        }
    }
    
    async clearBatchData() {
        const proceed = await window.showConfirmDialog({ title: "Clear Batch Data", message: "Are you sure you want to clear the saved Batch Picking data from memory?", confirmText: "Clear", isDanger: true, icon: "🗑️" });
        if (!proceed) return;
        
        try { localStorage.removeItem('LoosePlannerBatchData'); } catch (e) { console.error(e); }
        
        const statusEl = document.getElementById('batchStatus');
        const clearBtn = document.getElementById('clearBatchBtn');
        
        // Only wipe working state if Batch is the active source
        if (this.batchSource === 'batch') {
            this.batchData = {};
            this.routeExtras = {};
            this.hasBatch = false;
            this.batchSource = null;
            this.models = [];
            
            if (statusEl) statusEl.textContent = 'Awaiting "Insert Batch" sheet...';
            if (clearBtn) clearBtn.style.display = 'none';
            
            this.updateStats();
            this.renderTable();
        }
    }
    
    async clearRouteData() {
        const proceed = await window.showConfirmDialog({ title: "Clear Route Files", message: "Are you sure you want to clear the saved Route Files data from memory?", confirmText: "Clear", isDanger: true, icon: "🗑️" });
        if (!proceed) return;
        
        try { localStorage.removeItem('LoosePlannerRouteData'); } catch (e) { console.error(e); }
        
        const statusEl = document.getElementById('routeStatus');
        const clearBtn = document.getElementById('clearRouteBtn');
        
        // Only wipe working state if Route is the active source
        if (this.batchSource === 'route') {
            this.batchData = {};
            this.routeExtras = {};
            this.hasBatch = false;
            this.batchSource = null;
            this.models = [];
            
            if (statusEl) statusEl.textContent = 'Awaiting Route Files (.csv)...';
            if (clearBtn) clearBtn.style.display = 'none';
            
            this.updateStats();
            this.renderTable();
        }
    }

    downloadMasterTemplate() {
        const templateData = [
            { 'Product Code': 'TV-55X', 'Description': '55 Inch Smart TV', 'Capacities': '18', 'm3': 0.150, 'Length (cm)': 140, 'Width (cm)': 15, 'Height (cm)': 85, 'Max Pallet': '', 'Type': '', 'Pallet Length (cm)': '', 'Pallet Width (cm)': '', 'Tie (Qty per Layer)': '', 'High (Layers)': '' },
            { 'Product Code': 'SPK-200', 'Description': 'HiFi Soundbar', 'Capacities': '6,5', 'm3': 0.045, 'Length (cm)': 110, 'Width (cm)': 25, 'Height (cm)': 20, 'Max Pallet': '', 'Type': '', 'Pallet Length (cm)': '', 'Pallet Width (cm)': '', 'Tie (Qty per Layer)': '', 'High (Layers)': '' },
            { 'Product Code': 'W-MOUNT', 'Description': 'Wall Bracket', 'Capacities': '', 'm3': 0.012, 'Length (cm)': 45, 'Width (cm)': 30, 'Height (cm)': 10, 'Max Pallet': '', 'Type': '', 'Pallet Length (cm)': '', 'Pallet Width (cm)': '', 'Tie (Qty per Layer)': '', 'High (Layers)': '' }
        ];
        
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Master Data");
        XLSX.writeFile(wb, "Master_Data_Template.xlsx");
    }

    
    switchMode(mode) {
        this.simMode = mode;
        const modeDisplay = document.getElementById('simModeDisplay');
        if (modeDisplay) modeDisplay.textContent = mode === 'volume' ? 'Volume Fill' : 'Carton Tetris';
        this.renderTable();
    }
    
    handleMasterUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const statusEl = document.getElementById('masterStatus');
        if (statusEl) statusEl.textContent = `Loaded: ${file.name}`;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                this.processMasterDataWorkbook(workbook, file.name);
            } catch (err) {
                console.error("Master upload error:", err);
                showToast("Failed to parse Master Data file. Please ensure it is a valid Excel/CSV file.", "error");
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    processMasterDataWorkbook(workbook, fileName = "") {
        this.masterData = {};
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 1. Try positional array parsing (Bulk Planner Master format)
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        let parsedCount = 0;
        
        if (rows && rows.length > 1) {
            // Check if Row 0 has headers
            const headerRow = rows[0] || [];
            let codeCol = -1, descCol = -1, capCol = -1, m3Col = -1, lCol = -1, wCol = -1, hCol = -1, typeCol = -1;
            
            headerRow.forEach((h, idx) => {
                if (!h) return;
                const txt = String(h).toLowerCase().trim();
                
                // Product Code (Col A)
                if (txt === 'product code' || txt === 'code' || txt.includes('product code') || txt.includes('item code') || (txt.includes('code') && !txt.includes('zone'))) {
                    if (codeCol < 0) codeCol = idx;
                }
                // Description (Col B)
                if (txt === 'description' || txt === 'desc' || txt.includes('description') || txt.includes('model name')) {
                    if (descCol < 0) descCol = idx;
                }
                // Capacities (Col C)
                if (txt.includes('capacit') || txt.includes('pallet qty')) {
                    if (capCol < 0) capCol = idx;
                }
                // Unit m3 (Col D)
                if (txt === 'm3' || txt === 'cbm' || txt === 'vol' || txt.includes('volume') || txt.includes('unit m3') || txt.includes('m³')) {
                    if (m3Col < 0) m3Col = idx;
                }
                // Carton Length (cm) (Col E) - exclude pallet length
                if ((txt === 'length (cm)' || txt === 'length' || txt === 'l' || txt.includes('length')) && !txt.includes('pallet')) {
                    if (lCol < 0) lCol = idx;
                }
                // Carton Width (cm) (Col F) - exclude pallet width
                if ((txt === 'width (cm)' || txt === 'width' || txt === 'w' || txt.includes('width')) && !txt.includes('pallet')) {
                    if (wCol < 0) wCol = idx;
                }
                // Carton Height (cm) (Col G) - exclude pallet height
                if ((txt === 'height (cm)' || txt === 'height' || txt === 'h' || txt.includes('height')) && !txt.includes('pallet')) {
                    if (hCol < 0) hCol = idx;
                }
                // Type (Col I)
                if (txt === 'type' || txt.includes('category')) {
                    if (typeCol < 0) typeCol = idx;
                }
            });
            
            // Fallback default column indexes (Standard Bulk Load Planner Template)
            if (codeCol < 0) codeCol = 0;
            if (descCol < 0) descCol = 1;
            if (capCol < 0) capCol = 2;
            if (m3Col < 0) m3Col = 3;
            if (lCol < 0) lCol = 4;
            if (wCol < 0) wCol = 5;
            if (hCol < 0) hCol = 6;
            if (typeCol < 0) typeCol = 8;
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0 || row[codeCol] == null) continue;
                
                const modelCode = String(row[codeCol]).trim().toUpperCase();
                if (!modelCode || modelCode === "UNDEFINED" || modelCode === "NULL") continue;
                
                const descVal = row[descCol] ? String(row[descCol]).trim() : `Product ${modelCode}`;
                const capRaw = (capCol >= 0 && row[capCol]) ? String(row[capCol]).trim() : '';
                const capacities = capRaw ? capRaw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0) : [];
                
                let m3Val = (m3Col >= 0 && row[m3Col] != null) ? parseFloat(String(row[m3Col]).trim()) : 0;
                const lVal = (lCol >= 0 && row[lCol] != null) ? parseFloat(String(row[lCol]).trim()) : null;
                const wVal = (wCol >= 0 && row[wCol] != null) ? parseFloat(String(row[wCol]).trim()) : null;
                const hVal = (hCol >= 0 && row[hCol] != null) ? parseFloat(String(row[hCol]).trim()) : null;
                const typeVal = (typeCol >= 0 && row[typeCol] != null) ? String(row[typeCol]).trim() : '';
                
                const validL = (lVal != null && !isNaN(lVal) && lVal > 0) ? lVal : null;
                const validW = (wVal != null && !isNaN(wVal) && wVal > 0) ? wVal : null;
                const validH = (hVal != null && !isNaN(hVal) && hVal > 0) ? hVal : null;
                
                // Dynamically calculate m3 from carton dimensions if m3 column is empty or 0
                if ((isNaN(m3Val) || m3Val <= 0) && validL && validW && validH) {
                    m3Val = (validL * validW * validH) / 1000000;
                }
                
                const entry = {
                    code: modelCode,
                    desc: descVal,
                    description: descVal,
                    type: typeVal,
                    m3: isNaN(m3Val) ? 0 : m3Val,
                    l: validL,
                    w: validW,
                    h: validH,
                    capacities: capacities
                };
                
                // Primary Index: by Product Code (e.g. "12538104")
                this.masterData[modelCode] = entry;
                
                // Dual Index: by Model Name / Description (e.g. "KD-32W830K E51")
                if (descVal && descVal.toUpperCase() !== modelCode) {
                    const descUpper = descVal.toUpperCase();
                    this.masterData[descUpper] = entry;
                    
                    const cleanToken = descUpper.split(' ')[0].trim();
                    if (cleanToken && cleanToken !== modelCode && cleanToken !== descUpper) {
                        this.masterData[cleanToken] = entry;
                    }
                }
                
                parsedCount++;
            }
        }
        
        this.hasMaster = parsedCount > 0;
        
        // Save to GlobalMasterDataMap so Bulk Planner and Loose Planner are 100% linked
        try {
            localStorage.setItem('GlobalMasterDataMap', JSON.stringify(this.masterData));
            const statusEl = document.getElementById('masterStatus');
            if (statusEl) statusEl.textContent = `Linked with Bulk Master (${parsedCount} items)`;
            
            const clearBtn = document.getElementById('clearMasterBtn');
            if (clearBtn) clearBtn.style.display = 'inline';
            
            showToast(`Master Data linked: ${parsedCount} items loaded successfully.`, "success");
        } catch (e) {
            console.error("Failed to save Master Data to memory", e);
        }
        
        this.renderModelDatalist();
        this.processCombinedData();
    }
    
    handleBatchUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const statusEl = document.getElementById('batchStatus');
        if (statusEl) statusEl.textContent = `Loaded: ${file.name}`;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                this.processBatchWorkbook(workbook, file.name);
            } catch (err) {
                console.error("Batch upload error:", err);
                showToast("Failed to parse batch file. Please check file format.", "error");
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    processBatchWorkbook(workbook, fileName = "") {
        this.batchData = {};
        this.routeExtras = {};
        
        // 1. Check if workbook contains Impulse-Route and/or Impulse SN sheets
        const impulseRouteSheetName = workbook.SheetNames.find(n => {
            const lower = n.toLowerCase().trim();
            return lower === 'impulse-route' || lower === 'impulse route' || (lower.includes('impulse') && lower.includes('route'));
        });
        const impulseSnSheetName = workbook.SheetNames.find(n => {
            const lower = n.toLowerCase().trim();
            return lower === 'impulse sn' || lower === 'impulsesn' || (lower.includes('impulse') && lower.includes('sn'));
        });

        if (impulseSnSheetName || impulseRouteSheetName) {
            this.processImpulseSheets(workbook, impulseRouteSheetName, impulseSnSheetName, fileName);
            return;
        }
        
        // 2. Standard single-sheet fallback (e.g. "Insert Batch", "DO Summary", "Sheet1")
        let targetSheetName = null;
        const candidateNames = ["Insert Batch", "INSERT BATCH", "Batch", "Picking", "DO Summary", "DO_Summary", "Summary", "Sheet1"];
        
        for (const cand of candidateNames) {
            const found = workbook.SheetNames.find(s => s.toLowerCase().trim() === cand.toLowerCase());
            if (found && workbook.Sheets[found]) {
                targetSheetName = found;
                break;
            }
        }
        if (!targetSheetName) targetSheetName = workbook.SheetNames[0];
        
        const worksheet = workbook.Sheets[targetSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (!rows || rows.length === 0) {
            showToast("The selected sheet is empty.", "warning");
            return;
        }
        
        // Dynamic Header Row & Column Detection
        let headerRowIndex = -1;
        let modelCol = -1;
        let qtyCol = -1;
        let descCol = -1;
        let volCol = -1;
        
        for (let i = 0; i < Math.min(20, rows.length); i++) {
            const row = rows[i];
            if (!row || !Array.isArray(row)) continue;
            
            let mCol = -1, qCol = -1, dCol = -1, vCol = -1;
            
            row.forEach((cell, idx) => {
                if (cell == null) return;
                const txt = String(cell).toLowerCase().trim();
                
                // Model / SKU detection
                if (txt.includes('model') || txt.includes('item code') || txt.includes('material') || txt.includes('part number') || txt.includes('sku') || txt === 'code' || txt === 'item') {
                    if (mCol < 0) mCol = idx;
                }
                // Quantity detection
                if (txt.includes('qty') || txt.includes('quantity') || txt.includes('ship') || txt.includes('picked') || txt.includes('carton') || txt.includes('pcs') || txt.includes('units') || txt.includes('box')) {
                    if (qCol < 0) qCol = idx;
                }
                // Description detection
                if (txt.includes('desc') || txt.includes('name') || txt.includes('detail') || txt.includes('title')) {
                    if (dCol < 0) dCol = idx;
                }
                // Volume / m3 detection
                if (txt === 'm3' || txt === 'cbm' || txt === 'vol' || txt.includes('volume') || txt.includes('total vol')) {
                    if (vCol < 0) vCol = idx;
                }
            });
            
            if (mCol >= 0 && qCol >= 0) {
                headerRowIndex = i;
                modelCol = mCol;
                qtyCol = qCol;
                descCol = dCol;
                volCol = vCol;
                break;
            }
        }
        
        // Fallback check
        let startIndex = 0;
        if (headerRowIndex >= 0) {
            startIndex = headerRowIndex + 1;
        } else {
            if (rows.length > 4 && rows[4] && (rows[4][5] != null || rows[4][6] != null)) {
                startIndex = 4;
                modelCol = 5;
                qtyCol = 6;
                descCol = 10;
            } else {
                startIndex = 1;
                modelCol = 0;
                qtyCol = 1;
                descCol = 2;
            }
        }
        
        let totalItemsCount = 0;
        let totalCartons = 0;
        
        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            const rawModel = row[modelCol];
            const rawQty = row[qtyCol];
            
            if (rawModel == null || rawModel === "") continue;
            
            const modelCode = String(rawModel).trim().toUpperCase();
            if (!modelCode || modelCode === "MODEL" || modelCode === "ITEM" || modelCode === "CODE" || modelCode === "TOTAL") continue;
            
            let qty = 0;
            if (typeof rawQty === 'number') {
                qty = Math.round(rawQty);
            } else if (rawQty != null) {
                const cleaned = String(rawQty).replace(/[^0-9.-]/g, '');
                qty = parseInt(cleaned, 10) || 0;
            }
            
            if (qty <= 0) continue;
            
            const modelName = (descCol >= 0 && row[descCol]) ? String(row[descCol]).trim() : "";
            const rawVol = (volCol >= 0 && row[volCol] != null) ? parseFloat(row[volCol]) : 0;
            const unitM3 = (rawVol > 0 && qty > 0) ? (rawVol > 10 ? rawVol / qty : rawVol) : 0;
            
            if (this.batchData[modelCode]) {
                this.batchData[modelCode].qty += qty;
                if (modelName && !this.batchData[modelCode].name) {
                    this.batchData[modelCode].name = modelName;
                }
                if (unitM3 > 0 && (!this.batchData[modelCode].unitM3 || this.batchData[modelCode].unitM3 <= 0)) {
                    this.batchData[modelCode].unitM3 = unitM3;
                }
            } else {
                this.batchData[modelCode] = { qty: qty, name: modelName, unitM3: unitM3 };
                totalItemsCount++;
            }
            totalCartons += qty;
        }
        
        if (totalItemsCount === 0) {
            showToast("No valid model quantities found in file. Please ensure columns include Model and Quantity.", "warning");
            const st = document.getElementById('batchStatus');
            if (st) st.textContent = 'No valid data extracted';
            return;
        }
        
        this.hasBatch = true;
        this.batchSource = 'batch';
        this.routeExtras = {};
        
        // Reset the Route (mutually exclusive) source UI + storage
        const routeStatusEl = document.getElementById('routeStatus');
        if (routeStatusEl) routeStatusEl.textContent = 'Awaiting Route Files (.csv)...';
        const clearRouteBtn = document.getElementById('clearRouteBtn');
        if (clearRouteBtn) clearRouteBtn.style.display = 'none';
        try { localStorage.removeItem('LoosePlannerRouteData'); } catch (e) { console.error(e); }
        
        // Save Batch to memory
        try {
            localStorage.setItem('LoosePlannerBatchData', JSON.stringify(this.batchData));
            const st = document.getElementById('batchStatus');
            if (st) st.textContent = `Loaded ${totalItemsCount} models (${totalCartons.toLocaleString()} cartons)`;
            const cb = document.getElementById('clearBatchBtn');
            if (cb) cb.style.display = 'inline';
            
            showToast(`Loaded ${totalItemsCount} models (${totalCartons.toLocaleString()} cartons) from ${fileName || 'file'}.`, "success");
        } catch (e) {
            console.error("Failed to save Batch Data to memory", e);
        }
        
        this.processCombinedData();
    }

    processImpulseSheets(workbook, routeSheetName, snSheetName, fileName = "") {
        this.batchData = {};
        this.routeExtras = {};
        
        // 1. Parse Route Volumes from Impulse-Route (if present)
        const invoiceVolumeMap = {}; // Key: invoice number -> { totalVol, totalQty, zone, invoiceNo }
        
        if (routeSheetName && workbook.Sheets[routeSheetName]) {
            const routeRows = XLSX.utils.sheet_to_json(workbook.Sheets[routeSheetName], { header: 1 });
            if (routeRows && routeRows.length > 1) {
                let invCol = 0, zoneCol = 2, volCol = 8, qtyCol = 10;
                
                for (let i = 0; i < Math.min(5, routeRows.length); i++) {
                    const row = routeRows[i];
                    if (!row || !Array.isArray(row)) continue;
                    row.forEach((cell, idx) => {
                        if (!cell) return;
                        const txt = String(cell).toLowerCase().trim();
                        if (txt.includes('invoice') || txt.includes('ship invoice')) invCol = idx;
                        if (txt.includes('zone') || txt.includes('route')) zoneCol = idx;
                        if (txt.includes('total vol') || txt === 'volume' || txt === 'm3' || txt === 'cbm' || txt.includes('total volume')) volCol = idx;
                        if (txt.includes('ship quant') || txt.includes('ship qty') || txt === 'qty' || txt.includes('quantity')) qtyCol = idx;
                    });
                }
                
                for (let i = 1; i < routeRows.length; i++) {
                    const row = routeRows[i];
                    if (!row || !row[invCol]) continue;
                    
                    const rawInvoice = String(row[invCol]).trim();
                    if (!rawInvoice || rawInvoice.toUpperCase().includes('TOTAL')) continue;
                    
                    const firstToken = rawInvoice.split(' ')[0].trim().toUpperCase();
                    const fullKey = rawInvoice.toUpperCase();
                    
                    const totalVol = parseFloat(row[volCol]) || 0;
                    const totalQty = parseInt(row[qtyCol]) || 0;
                    const zone = (zoneCol >= 0 && row[zoneCol]) ? String(row[zoneCol]).trim() : '';
                    
                    const invData = { totalVol, totalQty, zone, invoice: rawInvoice };
                    invoiceVolumeMap[fullKey] = invData;
                    invoiceVolumeMap[firstToken] = invData;
                }
            }
        }
        
        // 2. Parse Items from Impulse SN (if present)
        let totalItemsCount = 0;
        let totalCartons = 0;
        let totalCbmCalculated = 0;
        
        if (snSheetName && workbook.Sheets[snSheetName]) {
            const snRows = XLSX.utils.sheet_to_json(workbook.Sheets[snSheetName], { header: 1 });
            if (snRows && snRows.length > 1) {
                let invCol = 1, zoneCol = 2, codeCol = 4, nameCol = 5, qtyCol = 7;
                
                for (let i = 0; i < Math.min(5, snRows.length); i++) {
                    const row = snRows[i];
                    if (!row || !Array.isArray(row)) continue;
                    row.forEach((cell, idx) => {
                        if (!cell) return;
                        const txt = String(cell).toLowerCase().trim();
                        if (txt.includes('invoice') || txt.includes('ship invoice')) invCol = idx;
                        if (txt.includes('zone') || txt.includes('route')) zoneCol = idx;
                        if (txt.includes('item code') || txt.includes('product item code') || (txt.includes('product') && txt.includes('code'))) codeCol = idx;
                        if (txt.includes('item name') || txt.includes('product item name') || (txt.includes('product') && txt.includes('name'))) nameCol = idx;
                        if (txt.includes('ship quant') || txt.includes('ship qty') || txt === 'qty' || txt.includes('quantity')) qtyCol = idx;
                    });
                }
                
                for (let i = 1; i < snRows.length; i++) {
                    const row = snRows[i];
                    if (!row || row.length === 0) continue;
                    
                    const rawCode = row[codeCol];
                    const rawName = row[nameCol];
                    const rawQty = row[qtyCol];
                    const rawInv = row[invCol] ? String(row[invCol]).trim() : '';
                    
                    if (!rawCode && !rawName) continue;
                    
                    // Product Item Code (e.g. 18062611) is the primary modelCode, fallback to Item Name
                    const modelCode = String(rawCode || rawName).trim().toUpperCase();
                    const modelName = rawName ? String(rawName).trim() : modelCode;
                    
                    if (!modelCode || modelCode.includes('TOTAL') || modelCode === 'NULL') continue;
                    
                    let qty = 0;
                    if (typeof rawQty === 'number') qty = Math.round(rawQty);
                    else if (rawQty != null) qty = parseInt(String(rawQty).replace(/[^0-9.-]/g, ''), 10) || 0;
                    
                    if (qty <= 0) continue;
                    
                    // Match with Impulse-Route volume
                    const invKeyFull = rawInv.toUpperCase();
                    const invKeyToken = rawInv.split(' ')[0].trim().toUpperCase();
                    const invData = invoiceVolumeMap[invKeyFull] || invoiceVolumeMap[invKeyToken] || {};
                    
                    let unitM3 = 0;
                    if (invData.totalVol > 0 && invData.totalQty > 0) {
                        unitM3 = invData.totalVol / invData.totalQty;
                    }
                    
                    const zone = invData.zone || (zoneCol >= 0 && row[zoneCol] ? String(row[zoneCol]).trim() : '');
                    
                    if (this.batchData[modelCode]) {
                        this.batchData[modelCode].qty += qty;
                        if (unitM3 > 0 && (!this.batchData[modelCode].unitM3 || this.batchData[modelCode].unitM3 <= 0)) {
                            this.batchData[modelCode].unitM3 = unitM3;
                        }
                    } else {
                        this.batchData[modelCode] = {
                            qty: qty,
                            name: modelName,
                            unitM3: unitM3
                        };
                        totalItemsCount++;
                    }
                    
                    if (!this.routeExtras[modelCode]) {
                        this.routeExtras[modelCode] = { routes: [], totalVol: 0, totalQty: 0 };
                    }
                    if (zone && !this.routeExtras[modelCode].routes.includes(zone)) {
                        this.routeExtras[modelCode].routes.push(zone);
                    }
                    if (unitM3 > 0) {
                        this.routeExtras[modelCode].totalVol += (unitM3 * qty);
                        this.routeExtras[modelCode].totalQty += qty;
                        totalCbmCalculated += (unitM3 * qty);
                    }
                    
                    totalCartons += qty;
                }
            }
        } else if (routeSheetName && Object.keys(invoiceVolumeMap).length > 0) {
            // Only Impulse-Route sheet exists without Impulse SN
            for (const [invKey, inv] of Object.entries(invoiceVolumeMap)) {
                if (inv.totalQty <= 0) continue;
                const mCode = inv.invoice || invKey;
                const unitM3 = inv.totalQty > 0 ? (inv.totalVol / inv.totalQty) : 0;
                
                this.batchData[mCode] = {
                    qty: inv.totalQty,
                    name: mCode,
                    unitM3: unitM3
                };
                this.routeExtras[mCode] = {
                    routes: inv.zone ? [inv.zone] : [],
                    totalVol: inv.totalVol,
                    totalQty: inv.totalQty
                };
                totalItemsCount++;
                totalCartons += inv.totalQty;
                totalCbmCalculated += inv.totalVol;
            }
        }
        
        if (totalItemsCount === 0) {
            showToast("Could not extract items from Impulse-Route / Impulse SN sheets.", "warning");
            return;
        }
        
        this.hasBatch = true;
        this.batchSource = 'impulse';
        
        // Save to memory
        try {
            localStorage.setItem('LoosePlannerBatchData', JSON.stringify(this.batchData));
            localStorage.setItem('LoosePlannerRouteData', JSON.stringify({
                batchData: this.batchData,
                routeExtras: this.routeExtras
            }));
            
            const st = document.getElementById('batchStatus');
            if (st) st.textContent = `Impulse Auto-Joined: ${totalItemsCount} models (${totalCartons.toLocaleString()} cartons, ${totalCbmCalculated.toFixed(2)} m³)`;
            const cb = document.getElementById('clearBatchBtn');
            if (cb) cb.style.display = 'inline';
            
            showToast(`Auto-Joined Impulse-Route & Impulse SN: ${totalItemsCount} models (${totalCartons.toLocaleString()} cartons, ${totalCbmCalculated.toFixed(2)} m³ total) loaded.`, "success");
        } catch (e) {
            console.error("Failed to save Impulse batch data", e);
        }
        
        this.processCombinedData();
    }

    updateModelM3(modelName, newM3) {
        const val = parseFloat(newM3);
        if (isNaN(val) || val < 0) return;
        
        if (this.batchData[modelName]) {
            this.batchData[modelName].unitM3 = val;
        }
        if (!this.masterData[modelName]) {
            this.masterData[modelName] = { code: modelName, desc: modelName, m3: val };
        } else {
            this.masterData[modelName].m3 = val;
        }
        
        try {
            localStorage.setItem('GlobalMasterDataMap', JSON.stringify(this.masterData));
        } catch(e) {}
        
        this.processCombinedData();
    }
    
    async handleRouteUpload(event) {
        const files = Array.from(event.target.files);
        event.target.value = ""; // Reset so the same file(s) can be selected again
        if (files.length === 0) return;
        
        const statusEl = document.getElementById('routeStatus');
        if (statusEl) statusEl.textContent = `Processing ${files.length} file(s)...`;
        
        let allRows = [];
        let fileCount = 0;
        
        for (const file of files) {
            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheet = workbook.Sheets[workbook.SheetNames[0]];
                        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                        
                        // Find header row: first row (within 20) with 'SEQ' or 'ITEM'
                        let headerIdx = -1;
                        for (let i = 0; i < Math.min(20, rows.length); i++) {
                            if (rows[i] && rows[i].length > 0) {
                                const rowStr = rows[i].join(" ").toUpperCase();
                                if (rowStr.includes('SEQ') || (rowStr.includes('ITEM') && rowStr.includes('QTY'))) {
                                    headerIdx = i;
                                    break;
                                }
                            }
                        }
                        const startIdx = headerIdx >= 0 ? headerIdx + 1 : 1;
                        
                        for (let i = startIdx; i < rows.length; i++) {
                            const row = rows[i];
                            if (!row || !row[0]) continue;
                            
                            const route = String(row[2] || "").trim();                // ZONE1
                            const vol = parseFloat(row[7]) || 0;                     // VOLUME
                            const qty = parseInt(row[9]) || 0;                       // SHIP_QUANTITY
                            const code = String(row[10] || "").trim().toUpperCase(); // ITEM
                            const desc = String(row[11] || "").trim();               // ITEM_DESC
                            
                            if (!code || qty <= 0) continue;
                            allRows.push({ route, vol, qty, code, desc });
                        }
                        fileCount++;
                    } catch (err) {
                        console.error("Error reading route file:", file.name, err);
                    }
                    resolve();
                };
                reader.onerror = () => resolve();
                reader.readAsArrayBuffer(file);
            });
        }
        
        if (allRows.length === 0) {
            if (statusEl) statusEl.textContent = 'No valid data found in Route file(s)';
            showToast("Could not extract valid route data from the uploaded file(s). Expected columns: SEQ, ZONE1, VOLUME, SHIP_QUANTITY, ITEM, ITEM_DESC.", "warning");
            return;
        }
        
        this.processRouteData(allRows, fileCount);
    }
    
    processRouteData(rows, fileCount) {
        this.batchData = {};
        this.routeExtras = {};
        
        rows.forEach(r => {
            if (this.batchData[r.code]) {
                this.batchData[r.code].qty += r.qty;
                if (!this.batchData[r.code].name && r.desc) this.batchData[r.code].name = r.desc;
            } else {
                this.batchData[r.code] = { qty: r.qty, name: r.desc };
            }
            
            if (!this.routeExtras[r.code]) this.routeExtras[r.code] = { routes: [], totalVol: 0, totalQty: 0 };
            if (r.route && !this.routeExtras[r.code].routes.includes(r.route)) this.routeExtras[r.code].routes.push(r.route);
            this.routeExtras[r.code].totalVol += r.vol;
            this.routeExtras[r.code].totalQty += r.qty;
        });
        
        this.hasBatch = true;
        this.batchSource = 'route';
        
        // Reset the Batch (mutually exclusive) source UI + storage
        const batchStatusEl = document.getElementById('batchStatus');
        if (batchStatusEl) batchStatusEl.textContent = 'Awaiting "Insert Batch" sheet...';
        const clearBatchBtn = document.getElementById('clearBatchBtn');
        if (clearBatchBtn) clearBatchBtn.style.display = 'none';
        try { localStorage.removeItem('LoosePlannerBatchData'); } catch (e) { console.error(e); }
        
        // Save Route to memory
        const statusEl = document.getElementById('routeStatus');
        try {
            localStorage.setItem('LoosePlannerRouteData', JSON.stringify({
                batchData: this.batchData,
                routeExtras: this.routeExtras
            }));
            if (statusEl) statusEl.textContent = `Saved to memory (${Object.keys(this.batchData).length} models, ${fileCount} file(s))`;
            const cb = document.getElementById('clearRouteBtn');
            if (cb) cb.style.display = 'inline';
        } catch (e) {
            console.error("Failed to save Route Data to memory", e);
            if (statusEl) statusEl.textContent = `Loaded: ${fileCount} Route file(s), ${Object.keys(this.batchData).length} models`;
        }
        
        this.processCombinedData();
    }
    
    processCombinedData() {
        if (!this.hasBatch || Object.keys(this.batchData).length === 0) {
            this.models = [];
            this.updateStats();
            this.renderTable();
            return;
        }
        
        this.models = [];
        let hasMissingDims = false;
        let index = 0;
        
        for (const [modelCode, batchInfo] of Object.entries(this.batchData)) {
            const qty = batchInfo.qty;
            const master = this.masterData[modelCode] || (batchInfo.name ? this.masterData[batchInfo.name.toUpperCase()] : null);
            const isMissingMaster = !master;
            
            const extras = this.routeExtras[modelCode];
            const fallbackM3 = (extras && extras.totalQty > 0) ? (extras.totalVol / extras.totalQty) : (batchInfo.unitM3 || 0);
            const masterDataObj = master || { m3: fallbackM3, l: null, w: null, h: null, desc: '', type: '' };

            // Coerce m3 to a safe number, or dynamically calculate from carton dimensions if m3 is 0
            let safeM3 = parseFloat(batchInfo.unitM3 > 0 ? batchInfo.unitM3 : (masterDataObj.m3 || fallbackM3));
            if ((isNaN(safeM3) || safeM3 <= 0) && masterDataObj.l && masterDataObj.w && masterDataObj.h) {
                safeM3 = (masterDataObj.l * masterDataObj.w * masterDataObj.h) / 1000000;
            }
            const unitM3 = isNaN(safeM3) ? 0 : safeM3;
            
            if (!masterDataObj.l || !masterDataObj.w || !masterDataObj.h) {
                hasMissingDims = true;
            }
            
            // Use Product Item Name from Batch/SN for Description, fallback to master desc
            let finalDesc = batchInfo.name || masterDataObj.desc || masterDataObj.description || '';
            if (!finalDesc && isMissingMaster) finalDesc = 'Item ' + modelCode;
            
            // Determine product type for 3D labels: master 'Type' column wins, otherwise infer from description/code
            let pType = (masterDataObj.type || '').trim();
            if (!pType) {
                const hay = ((finalDesc || '') + ' ' + modelCode).toUpperCase();
                if (/\bTV\b|\bKDL\b|\bKD-\d/.test(hay)) {
                    pType = 'TV DISPLAY';
                } else if (/HIFI|HI-FI|HI FI|SOUNDBAR|SOUND BAR|\bAUDIO\b|\bSPEAKER\b|HOME THEAT/.test(hay)) {
                    pType = 'HIFI';
                }
            }
            
            this.models.push({
                id: index,
                name: modelCode,
                description: finalDesc,
                type: pType,
                qty: qty,
                unitM3: unitM3,
                totalM3: qty * unitM3,
                l: masterDataObj.l,
                w: masterDataObj.w,
                h: masterDataObj.h,
                color: this.colors[index % this.colors.length],
                routes: extras ? extras.routes : [],
                missingMaster: isMissingMaster
            });
            index++;
        }
        
        const warning = document.getElementById('missingDimsWarning');
        if (warning) warning.style.display = (hasMissingDims && this.simMode === 'tetris') ? 'block' : 'none';
        
        this.updateStats();
        this.renderTable();
    }
    
    updateStats() {
        let totalQty = 0;
        let totalCBM = 0;

        this.models.forEach(m => {
            totalQty += (m.qty || 0);
            totalCBM += (m.totalM3 || 0);
        });
        
        const spec = LOOSE_CONTAINER_SPECS[this.truckType] || LOOSE_CONTAINER_SPECS['40HC'];
        const util = Math.round((totalCBM / this.maxCBM) * 100);

        const modelsEl = document.getElementById('statTotalModels');
        if (modelsEl) modelsEl.textContent = this.models.length;

        const qtyEl = document.getElementById('statTotalQty');
        if (qtyEl) qtyEl.textContent = totalQty.toLocaleString();

        const cbmEl = document.getElementById('statTotalCBM');
        if (cbmEl) cbmEl.textContent = totalCBM.toFixed(2);

        const maxCbmEl = document.getElementById('statMaxCBM');
        if (maxCbmEl) maxCbmEl.textContent = spec.label;

        // Volume-based trucks needed (m³ ÷ container capacity)
        const trucksNeeded = Math.max(1, Math.ceil(totalCBM / this.maxCBM));
        const trucksEl = document.getElementById('statTrucksNeeded');
        if (trucksEl) {
            trucksEl.textContent = trucksNeeded;
            trucksEl.style.color = trucksNeeded > 1 ? '#f59e0b' : '#10b981';
        }
        const trucksTypeEl = document.getElementById('statTrucksType');
        if (trucksTypeEl) trucksTypeEl.textContent = `${spec.name}: ~${this.maxCBM} m³ each`;

        const utilEl = document.getElementById('statUtilization');
        if (utilEl) {
            utilEl.textContent = `${util}%`;

            if (util > 100) utilEl.style.color = '#ef4444';
            else if (util > 95) utilEl.style.color = '#ef4444';
            else if (util > 80) utilEl.style.color = '#f59e0b';
            else utilEl.style.color = '#10b981';
        }
    }
    
    renderTable() {
        const tbody = document.getElementById('dataTableBody');
        if (!tbody) return;
        
        if (this.models.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="padding: 24px; text-align: center; color: var(--fg-muted, #a1a1aa);">No data uploaded yet. Select a model above or upload a Batch Picking / Route file.</td></tr>';
            return;
        }
        
        let html = '';
        let hasMissingDims = false;
        
        this.models.forEach(m => {
            let dimsStr = '<span style="color:#f87171">Missing Dims (skipped in Tetris)</span>';
            if (m.l && m.w && m.h) {
                dimsStr = `${m.l} × ${m.w} × ${m.h}`;
            } else if (!m.missingMaster) {
                hasMissingDims = true;
            }
            
            const warningIcon = m.missingMaster ? '<span title="Model dimensions not found in Master Data" style="color: #f59e0b; margin-right: 4px;">ℹ️</span>' : '';
            const rowStyle = 'border-bottom: 1px solid var(--border); transition: background 0.2s;';
            
            html += `
                <tr style="${rowStyle}">
                    <td style="padding: 12px 16px; color: var(--fg, #f4f4f5); display: flex; align-items: center; gap: 8px;">
                        <div style="width: 12px; height: 12px; background: #${m.color.toString(16).padStart(6, '0')}; border-radius: 2px; flex-shrink: 0;"></div>
                        <strong>${warningIcon}${m.name}</strong>
                    </td>
                    <td style="padding: 12px 16px; color: var(--fg, #f4f4f5); font-weight: 500;">${m.description}</td>
                    <td style="padding: 12px 16px; color: var(--fg, #f4f4f5);">
                        <input type="number" min="1" value="${m.qty}" onchange="loosePlanner.updateModelQty('${m.name}', this.value)" style="width: 75px; background: rgba(0,0,0,0.3); border: 1px solid var(--border); color: var(--fg, #f4f4f5); padding: 4px 8px; border-radius: 6px; font-size: 13px; font-weight: 600; outline: none; text-align: center;">
                    </td>
                    <td style="padding: 12px 16px; color: var(--fg-muted, #a1a1aa);">
                        <input type="number" step="0.001" min="0" value="${(m.unitM3 || 0).toFixed(3)}" onchange="loosePlanner.updateModelM3('${m.name}', this.value)" style="width: 80px; background: rgba(0,0,0,0.3); border: 1px solid var(--border); color: var(--fg, #f4f4f5); padding: 4px 8px; border-radius: 6px; font-size: 13px; font-weight: 600; outline: none; text-align: center;" title="Edit Unit m³">
                    </td>
                    <td style="padding: 12px 16px; color: #3b82f6; font-weight: 600;">${(m.totalM3 || 0).toFixed(2)}</td>
                    <td style="padding: 12px 16px; color: var(--fg-muted, #a1a1aa); font-size: 13px;">${dimsStr}</td>
                    <td style="padding: 12px 16px; text-align: center;">
                        <button onclick="loosePlanner.removeModel('${m.name}')" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 12px; transition: all 0.2s;" title="Remove this model">🗑️</button>
                    </td>
                </tr>
            `;
        });
        
        const warning = document.getElementById('missingDimsWarning');
        if (warning) warning.style.display = (hasMissingDims && this.simMode === 'tetris') ? 'block' : 'none';
        
        tbody.innerHTML = html;
    }
    
    open3DViewer() {
        if (this.models.length === 0) {
            showToast("Please upload your Batch Picking file with data first.", "warning");
            return;
        }
        
        if (this.models.some(m => (!m.l || !m.w || !m.h)) && this.simMode === 'tetris') {
            showToast("Strict Mode: Some products are missing Carton Dimensions (L/W/H). The Carton Tetris visualization will strictly SKIP these products.", "warning");
        }
        
        const modal = document.getElementById('truck3dModal');
        if (modal) modal.style.display = 'flex';
        
        const container = document.getElementById('truck3dContainer');
        if (!container) return;
        
        // Teardown any previous scene before rebuilding (prevents rAF + WebGL context leaks)
        this.teardown3D();
        // Remove only previous WebGL canvas — keep overlay controls + overflow banner intact
        container.querySelectorAll('canvas').forEach(c => c.remove());
        
        // Build Legend (clickable: toggle model visibility for what-if view)
        const legend = document.getElementById('legendContainer');
        if (legend) {
            legend.innerHTML = this.models.map(m => {
                const hex = m.color.toString(16).padStart(6, '0');
                const hidden = this.hiddenModels.has(m.id);
                const style = hidden
                    ? `display: flex; align-items: center; gap: 6px; cursor: pointer; opacity: 0.35; text-decoration: line-through; background: rgba(0,0,0,0.3); border: 1px solid var(--border, #3f3f46); border-radius: 6px; padding: 2px 8px;`
                    : `display: flex; align-items: center; gap: 6px; cursor: pointer; background: rgba(0,0,0,0.3); border: 1px solid var(--border, #3f3f46); border-radius: 6px; padding: 2px 8px;`;
                return `<span id="looseLegendItem-${m.id}" onclick="loosePlanner.toggleModelVisibility(${m.id})" title="Click to hide/show this model in the 3D view" style="${style}"><div style="width:12px; height:12px; background: #${hex}; border-radius: 2px;"></div> ${m.name}</span>`;
            }).join('');
        }
        
        // Sync modal container buttons
        const mBtn40 = document.getElementById('modalLooseTruck40Btn');
        const mBtn20 = document.getElementById('modalLooseTruck20Btn');
        if (mBtn40 && mBtn20) {
            if (this.truckType === '40HC') {
                mBtn40.classList.remove('ghost'); mBtn40.classList.add('active');
                mBtn20.classList.remove('active'); mBtn20.classList.add('ghost');
            } else {
                mBtn20.classList.remove('ghost'); mBtn20.classList.add('active');
                mBtn40.classList.remove('active'); mBtn40.classList.add('ghost');
            }
        }
        
        // Init Scene (Dark warehouse atmosphere, like the Volume Capacity Planner)
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b0f19);
        scene.fog = new THREE.Fog(0x0b0f19, 55, 140);
        this.scene = scene;
        
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(-14, 9, -17);
        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);
        this.renderer = renderer;
        
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.screenSpacePanning = true;
        controls.panSpeed = 1.8;
        controls.target.set(0, 1.2, 0);
        controls.maxPolarAngle = Math.PI / 2 + 0.05;

        // Keep refs for view presets / camera tweening
        this.cameraRef = camera;
        this.controlsRef = controls;
        this.camTween = null;
        this.loadAnim = null;
        this.currentView = this.currentView || 'default';
        this.updateViewButtons();

        // Hover-to-inspect: track pointer, raycast in animate loop
        const raycaster = new THREE.Raycaster();
        const mouseNDC = new THREE.Vector2(-2, -2); // off-screen default
        this.pointerMoveListener = (event) => {
            const rect = container.getBoundingClientRect();
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
            mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        };
        container.addEventListener('pointermove', this.pointerMoveListener);

        // Hover tooltip element (created once, reused across sessions)
        let tooltip = document.getElementById('loose3dTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'loose3dTooltip';
            tooltip.style.position = 'fixed';
            tooltip.style.background = 'rgba(24, 24, 27, 0.95)';
            tooltip.style.color = '#f4f4f5';
            tooltip.style.padding = '12px';
            tooltip.style.borderRadius = '8px';
            tooltip.style.fontSize = '12px';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.display = 'none';
            tooltip.style.zIndex = '3000';
            tooltip.style.border = '1px solid #3f3f46';
            tooltip.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
            tooltip.style.lineHeight = '1.5';
            document.body.appendChild(tooltip);
        }

        container.oncontextmenu = (e) => e.preventDefault();
        
        // --- Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(15, 24, 12);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -20;
        dirLight.shadow.camera.right = 20;
        dirLight.shadow.camera.top = 20;
        dirLight.shadow.camera.bottom = -20;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 80;
        dirLight.shadow.bias = -0.0005;
        scene.add(dirLight);
        
        // Cool fill light from the opposite side to soften shadows
        const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.28);
        fillLight.position.set(-18, 10, -14);
        scene.add(fillLight);
        
        // --- Realistic Ground / Asphalt Yard ---
        this.buildGround(scene);
        
        // --- Realistic Truck (Container + Cab + Wheels) ---
        this.buildTruckRig(scene);
        
        const itemsGroup = new THREE.Group();
        scene.add(itemsGroup);

        // Track placed cargo for raycast inspection + loading animation
        this.cartonMeshes = [];

        if (this.simMode === 'volume') {
            this.buildVolumeFill(itemsGroup);
        } else {
            this.buildCartonTetris(itemsGroup);
        }

        // Re-apply current view preset instantly after rebuild (no tween jump)
        if (this.currentView && this.currentView !== 'default') {
            const L = this.truckL, W = this.truckW, H = this.truckH;
            if (this.currentView === 'doors') {
                camera.position.set(0, H * 0.75, L / 2 + 9);
                controls.target.set(0, H * 0.4, 0);
            } else if (this.currentView === 'top') {
                camera.position.set(0.01, L + 6, 0.01);
                controls.target.set(0, 0, 0);
            }
        }

        // Overflow / trucks-needed banner
        this.updateOverflowBanner();

        // Animation Loop
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);

            // Camera preset tween
            if (this.camTween && camera && controls) {
                this.camTween.t += this.camTween.dur;
                const k = Math.min(1, this.camTween.t);
                const ease = 1 - Math.pow(1 - k, 3); // easeOutCubic
                camera.position.lerpVectors(this.camTween.fromPos, this.camTween.toPos, ease);
                controls.target.lerpVectors(this.camTween.fromTgt, this.camTween.toTgt, ease);
                if (k >= 1) this.camTween = null;
            }

            // Reveal-in-place loading animation (packing order, progress HUD,
            // speed-aware accumulated clock, merged pause/play control)
            if (this.loadAnim) {
                const nowMs = performance.now();
                const dt = this.loadAnim.lastTick == null ? 0 : (nowMs - this.loadAnim.lastTick);
                this.loadAnim.lastTick = nowMs;

                if (!this.loadAnim.paused) {
                    this.loadAnim.animClock += dt * (this.animSpeed || 1);
                }
                const elapsed = this.loadAnim.animClock;
                let placedCount = 0;

                this.loadAnim.items.forEach(item => {
                    const tLocal = (elapsed - item.delay) / item.dur;
                    if (tLocal <= 0) {
                        item.mesh.visible = false;
                    } else if (tLocal >= 1) {
                        item.mesh.visible = true;
                        item.mesh.scale.setScalar(1);
                        placedCount++;
                    } else {
                        item.mesh.visible = true;
                        const e = 1 - Math.pow(1 - tLocal, 3); // easeOutCubic pop-in
                        item.mesh.scale.setScalar(item.scaleFrom + (1 - item.scaleFrom) * e);
                    }
                });

                // Progress HUD
                if (this.loadAnim.hudEl) {
                    const pct = Math.min(100, Math.round((elapsed / this.loadAnim.totalDur) * 100));
                    let curLayer = 1;
                    for (const lb of this.loadAnim.layerBounds) {
                        if (elapsed >= lb.start) curLayer = lb.layer;
                    }
                    const speedTxt = (this.animSpeed && this.animSpeed !== 1) ? ` · ${(this.animSpeed).toFixed(2).replace(/\.?0+$/, '')}×` : '';
                    const pauseTxt = this.loadAnim.paused ? ' · ⏸ paused' : '';
                    this.loadAnim.hudEl.textContent =
                        `Layer ${curLayer}/${this.loadAnim.layerCount}` +
                        ` · ${placedCount}/${this.loadAnim.items.length} cartons` +
                        ` · ${pct}%${speedTxt}${pauseTxt}`;
                }

                if (elapsed >= this.loadAnim.totalDur) {
                    // Snap everything to final state
                    this.loadAnim.items.forEach(item => {
                        item.mesh.visible = true;
                        item.mesh.scale.setScalar(1);
                    });
                    if (this.loadAnim.hudEl) this.loadAnim.hudEl.style.display = 'none';
                    this.loadAnim = null;
                    this.animPaused = false;
                    this.updateAnimateButton();
                }
            }

            controls.update();

            // Hover-to-inspect raycast
            if (!this.loadAnim && this.cartonMeshes.length > 0) {
                raycaster.setFromCamera(mouseNDC, camera);
                const intersects = raycaster.intersectObjects(this.cartonMeshes);
                const object = intersects.length > 0 ? intersects[0].object : null;
                this.updateHoverHighlight(object);
            } else {
                this.updateHoverHighlight(null);
            }

            renderer.render(scene, camera);
        };
        animate();
        
        // Handle Resize
        this.resizeListener = () => {
            const m = document.getElementById('truck3dModal');
            if (!m || m.style.display === 'none') return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', this.resizeListener);
    }
    
    close3DViewer() {
        const modal = document.getElementById('truck3dModal');
        if (modal) modal.style.display = 'none';
        this.teardown3D();
    }

    teardown3D() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
            this.resizeListener = null;
        }
        const container = document.getElementById('truck3dContainer');
        if (this.pointerMoveListener && container) {
            container.removeEventListener('pointermove', this.pointerMoveListener);
            this.pointerMoveListener = null;
        }
        const tooltip = document.getElementById('loose3dTooltip');
        if (tooltip) tooltip.style.display = 'none';
        const hud = document.getElementById('looseLoadHud');
        if (hud) hud.style.display = 'none';
        this.hoveredMesh = null;
        this.camTween = null;
        this.loadAnim = null;
        this.animPaused = false;
        this.updateAnimateButton();
        this.cartonMeshes = [];
        this.cameraRef = null;
        this.controlsRef = null;
        this.scene = null;
        if (this.renderer) {
            try {
                this.renderer.dispose();
                this.renderer.forceContextLoss();
            } catch (e) {
                console.warn("Failed to dispose 3D renderer", e);
            }
            this.renderer = null;
        }
    }
    
    // --- Realistic Asphalt Yard Ground ---
    buildGround(scene) {
        const groundGeo = new THREE.PlaneGeometry(160, 300);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.92, metalness: 0.08 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, -0.02, 0);
        ground.receiveShadow = true;
        scene.add(ground);
    }
    
    // --- Realistic Truck: Container + COE Cab + Wheels ---
    buildTruckRig(scene) {
        const truckW = this.truckW, truckH = this.truckH, truckL = this.truckL;
        const truckMasterGroup = new THREE.Group();
        scene.add(truckMasterGroup);
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.15, metalness: 0.85 });
        
        // Trailer Floor (inside container)
        const floorGeo = new THREE.PlaneGeometry(truckW, truckL);
        const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8, metalness: 0.2 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0.02, 0);
        floor.receiveShadow = true;
        truckMasterGroup.add(floor);
        
        // Semi-Transparent White Container Walls + Roof
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.1, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false });
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.2 });
        const containerGroup = new THREE.Group();
        truckMasterGroup.add(containerGroup);
        
        const sideWallGeo = new THREE.PlaneGeometry(truckL, truckH);
        const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.set(-truckW / 2, truckH / 2, 0);
        containerGroup.add(leftWall);
        leftWall.add(new THREE.LineSegments(new THREE.EdgesGeometry(sideWallGeo), edgeMat));
        const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.set(truckW / 2, truckH / 2, 0);
        containerGroup.add(rightWall);
        rightWall.add(new THREE.LineSegments(new THREE.EdgesGeometry(sideWallGeo), edgeMat));
        
        const frontWallGeo = new THREE.PlaneGeometry(truckW, truckH);
        const frontWall = new THREE.Mesh(frontWallGeo, wallMat);
        frontWall.position.set(0, truckH / 2, -truckL / 2);
        containerGroup.add(frontWall);
        frontWall.add(new THREE.LineSegments(new THREE.EdgesGeometry(frontWallGeo), edgeMat));
        
        const roofGeo = new THREE.PlaneGeometry(truckW, truckL);
        const roof = new THREE.Mesh(roofGeo, wallMat);
        roof.rotation.x = Math.PI / 2;
        roof.position.set(0, truckH, 0);
        containerGroup.add(roof);
        roof.add(new THREE.LineSegments(new THREE.EdgesGeometry(roofGeo), edgeMat));
        
        // Structural Frame (White Posts & Rails)
        const pt = 0.12;
        const vPostGeo = new THREE.BoxGeometry(pt, truckH, pt);
        [[-truckW/2,truckH/2,-truckL/2],[truckW/2,truckH/2,-truckL/2],[-truckW/2,truckH/2,truckL/2],[truckW/2,truckH/2,truckL/2]].forEach(p => {
            const post = new THREE.Mesh(vPostGeo, frameMat);
            post.position.set(p[0], p[1], p[2]);
            containerGroup.add(post);
        });
        const sideRailGeo = new THREE.BoxGeometry(pt, pt, truckL);
        const crossRailGeo = new THREE.BoxGeometry(truckW, pt, pt);
        [[-truckW/2,truckH,0],[truckW/2,truckH,0],[-truckW/2,pt/2,0],[truckW/2,pt/2,0]].forEach(p => {
            const rail = new THREE.Mesh(sideRailGeo, frameMat);
            rail.position.set(p[0], p[1], p[2]);
            containerGroup.add(rail);
        });
        [[0,truckH,-truckL/2],[0,truckH,truckL/2],[0,pt/2,-truckL/2]].forEach(p => {
            const rail = new THREE.Mesh(crossRailGeo, frameMat);
            rail.position.set(p[0], p[1], p[2]);
            containerGroup.add(rail);
        });
        
        // Rear Doors (Swung Open so cargo is visible)
        const doorGeo = new THREE.PlaneGeometry(truckW / 2, truckH);
        const leftHinge = new THREE.Group();
        leftHinge.position.set(-truckW / 2, truckH / 2, truckL / 2);
        leftHinge.rotation.y = -Math.PI / 1.6;
        truckMasterGroup.add(leftHinge);
        const leftDoor = new THREE.Mesh(doorGeo, wallMat);
        leftDoor.position.set(truckW / 4, 0, 0);
        leftHinge.add(leftDoor);
        leftDoor.add(new THREE.LineSegments(new THREE.EdgesGeometry(doorGeo), edgeMat));
        const rightHinge = new THREE.Group();
        rightHinge.position.set(truckW / 2, truckH / 2, truckL / 2);
        rightHinge.rotation.y = Math.PI / 1.6;
        truckMasterGroup.add(rightHinge);
        const rightDoor = new THREE.Mesh(doorGeo, wallMat);
        rightDoor.position.set(-truckW / 4, 0, 0);
        rightHinge.add(rightDoor);
        rightDoor.add(new THREE.LineSegments(new THREE.EdgesGeometry(doorGeo), edgeMat));
        
        this.buildCab(truckMasterGroup, chromeMat);
    }
    
    // --- COE Truck Cab (Head) + Wheels ---
    buildCab(truckMasterGroup, chromeMat) {
        const truckW = this.truckW, truckH = this.truckH, truckL = this.truckL;
        const cabWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.08 });
        const cabRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.1 });
        const cabChassisMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.2 });
        const cabInteriorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
        
        const cabinGroup = new THREE.Group();
        truckMasterGroup.add(cabinGroup);
        
        const cabinW = truckW * 0.9, cabinH = truckH * 0.85, cabinL = 2.2, chassisL = 1.4;
        const cabZ = -(truckL / 2) - chassisL - (cabinL / 2) - 0.3;
        
        const lowerCab = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH * 0.55, cabinL), cabWhiteMat);
        lowerCab.position.set(0, (cabinH * 0.275) + 0.55, cabZ);
        lowerCab.castShadow = true; lowerCab.receiveShadow = true;
        cabinGroup.add(lowerCab);
        
        const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(cabinW, 0.18, cabinL), cabWhiteMat);
        cabRoof.position.set(0, cabinH + 0.55 - 0.09, cabZ);
        cabRoof.castShadow = true;
        cabinGroup.add(cabRoof);
        
        const cabBack = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH * 0.45, 0.14), cabWhiteMat);
        cabBack.position.set(0, cabinH * 0.775 + 0.55, cabZ + (cabinL / 2) - 0.07);
        cabinGroup.add(cabBack);
        
        const pillarGeo = new THREE.BoxGeometry(0.14, cabinH * 0.45, cabinL);
        const pillarL = new THREE.Mesh(pillarGeo, cabWhiteMat);
        pillarL.position.set(-cabinW / 2 + 0.07, cabinH * 0.775 + 0.55, cabZ);
        cabinGroup.add(pillarL);
        const pillarR = new THREE.Mesh(pillarGeo, cabWhiteMat);
        pillarR.position.set(cabinW / 2 - 0.07, cabinH * 0.775 + 0.55, cabZ);
        cabinGroup.add(pillarR);
        
        const cockpitFloor = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.28, 0.1, cabinL - 0.28), cabInteriorMat);
        cockpitFloor.position.set(0, (cabinH * 0.55) + 0.55, cabZ);
        cabinGroup.add(cockpitFloor);
        
        // Windshield (tinted glass)
        const windshield = new THREE.Mesh(
            new THREE.BoxGeometry(cabinW * 0.86, cabinH * 0.38, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
        );
        windshield.position.set(0, cabinH * 0.76 + 0.55, cabZ - cabinL / 2 + 0.02);
        cabinGroup.add(windshield);
        
        // Chassis extension
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.8, cabinH * 0.3, chassisL), cabChassisMat);
        chassis.position.set(0, (cabinH * 0.15) + 0.55, cabZ + (cabinL / 2) + (chassisL / 2));
        chassis.castShadow = true;
        cabinGroup.add(chassis);
        
        // Red side skirt guards
        const skirtGeo = new THREE.BoxGeometry(0.09, cabinH * 0.2, chassisL * 0.9);
        const skirtL = new THREE.Mesh(skirtGeo, cabRedMat);
        skirtL.position.set(-cabinW * 0.42, 0.62, cabZ + (cabinL / 2) + (chassisL / 2));
        cabinGroup.add(skirtL);
        const skirtR = new THREE.Mesh(skirtGeo, cabRedMat);
        skirtR.position.set(cabinW * 0.42, 0.62, cabZ + (cabinL / 2) + (chassisL / 2));
        cabinGroup.add(skirtR);
        
        // Silver fuel tanks
        const tankGeo = new THREE.CylinderGeometry(0.26, 0.26, 1.1, 16);
        const tankL = new THREE.Mesh(tankGeo, chromeMat);
        tankL.rotation.x = Math.PI / 2;
        tankL.position.set(-cabinW * 0.45, 0.8, cabZ + (cabinL / 2) + (chassisL / 2));
        cabinGroup.add(tankL);
        const tankR = new THREE.Mesh(tankGeo, chromeMat);
        tankR.rotation.x = Math.PI / 2;
        tankR.position.set(cabinW * 0.45, 0.8, cabZ + (cabinL / 2) + (chassisL / 2));
        cabinGroup.add(tankR);
        
        // Red racing stripe
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 1.02, 0.22, cabinL * 1.02), cabRedMat);
        stripe.position.set(0, (cabinH * 0.45) + 0.55, cabZ);
        cabinGroup.add(stripe);
        
        // Aerodynamic roof deflector
        const deflectorH = cabinH * 0.25;
        const deflector = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.95, deflectorH, cabinL * 0.9), cabWhiteMat);
        deflector.position.set(0, cabinH + 0.55 + (deflectorH / 2) - 0.14, cabZ + 0.22);
        deflector.rotation.x = -Math.PI / 10;
        cabinGroup.add(deflector);
        
        // Headlights
        const lightMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.8 });
        const lightGeo = new THREE.BoxGeometry(0.45, 0.22, 0.08);
        const lightL = new THREE.Mesh(lightGeo, lightMat);
        lightL.position.set(-cabinW * 0.32, (cabinH * 0.18) + 0.55, cabZ - cabinL / 2 - 0.05);
        cabinGroup.add(lightL);
        const lightR = new THREE.Mesh(lightGeo, lightMat);
        lightR.position.set(cabinW * 0.32, (cabinH * 0.18) + 0.55, cabZ - cabinL / 2 - 0.05);
        cabinGroup.add(lightR);
        
        // Front bumper
        const bumper = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.95, 0.18, 0.16), cabChassisMat);
        bumper.position.set(0, 0.6, cabZ - cabinL / 2 - 0.02);
        cabinGroup.add(bumper);
        
        this.buildWheels(truckMasterGroup, cabinGroup, chromeMat, cabZ, cabinW, cabinL);
    }
    
    // --- Wheels (with metal rims) ---
    buildWheels(truckMasterGroup, cabinGroup, chromeMat, cabZ, cabinW, cabinL) {
        const truckW = this.truckW, truckL = this.truckL;
        const wheelRadius = 0.5;
        const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.4, 20);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
        const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.55, wheelRadius * 0.55, 0.42, 16);
        const wheelPositions = [
            [-cabinW / 2 - 0.08, wheelRadius, cabZ - cabinL / 3],
            [cabinW / 2 + 0.08, wheelRadius, cabZ - cabinL / 3],
            [-cabinW / 2 - 0.08, wheelRadius, cabZ + cabinL / 3],
            [cabinW / 2 + 0.08, wheelRadius, cabZ + cabinL / 3],
            [-truckW / 2 - 0.08, wheelRadius, truckL / 2 - 1.6],
            [truckW / 2 + 0.08, wheelRadius, truckL / 2 - 1.6],
            [-truckW / 2 - 0.08, wheelRadius, truckL / 2 - 2.9],
            [truckW / 2 + 0.08, wheelRadius, truckL / 2 - 2.9]
        ];
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            const rim = new THREE.Mesh(rimGeo, chromeMat);
            wheel.add(rim);
            wheel.position.set(pos[0], pos[1], pos[2]);
            wheel.castShadow = true;
            truckMasterGroup.add(wheel);
        });
    }
    
    extractTVSize(desc) {
        if (!desc) return "TV";
        let match = desc.match(/-(\d{2,3})/);
        if (!match) {
            match = desc.match(/(\d{2,3})/);
        }
        if (match) return match[1] + '"';
        return "TV";
    }
    
    createCartonMaterial(pType, pDesc, colorNum) {
        if (pType !== 'TV DISPLAY' && pType !== 'HIFI' && pType !== 'HIFI AUDIO' && pType !== 'SOUNDBAR') {
            return new THREE.MeshStandardMaterial({ color: colorNum, roughness: 0.3, metalness: 0.1 });
        }
        
        let labelText = "HIFI";
        if (pType === 'TV DISPLAY') {
            labelText = this.extractTVSize(pDesc);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#' + colorNum.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 256, 256);
        
        ctx.fillStyle = '#27272a';
        ctx.font = pType === 'TV DISPLAY' ? 'bold 80px Arial' : 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, 128, 128);
        
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#27272a';
        ctx.strokeRect(30, 40, 196, 176);
        
        if (pType === 'TV DISPLAY') {
            ctx.font = 'bold 24px Arial';
            ctx.fillText('TV', 128, 80);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 4;
        
        const matWithTex = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5, metalness: 0.1 });
        const plainMat = new THREE.MeshStandardMaterial({ color: colorNum, roughness: 0.5, metalness: 0.1 });
        
        return [matWithTex, matWithTex, plainMat, plainMat, matWithTex, matWithTex];
    }
    
    buildVolumeFill(group) {
        let currentZ = -(this.truckL / 2);

        this.models.forEach(m => {
            if (m.totalM3 <= 0) return;
            if (this.hiddenModels.has(m.id)) return; // what-if view: hidden models skipped

            const sectionL = m.totalM3 / (this.truckW * this.truckH);

            const isOverflow = (currentZ + sectionL) > (this.truckL / 2);
            let color = m.color;
            if (isOverflow) {
                color = 0xef4444;
            }

            const geo = new THREE.BoxGeometry(this.truckW, this.truckH, sectionL);
            const cartonMats = this.createCartonMaterial(m.type, m.description, color);
            (Array.isArray(cartonMats) ? cartonMats : [cartonMats]).forEach(mm => {
                mm.transparent = true;
                mm.opacity = 0.85;
            });
            const block = new THREE.Mesh(geo, cartonMats);

            const edges = new THREE.EdgesGeometry(geo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1f2937, linewidth: 1 }));
            block.add(line);

            block.position.set(0, this.truckH / 2, currentZ + (sectionL / 2));
            block.castShadow = true;
            block.receiveShadow = true;
            block.userData = {
                model: m.name,
                description: m.description || m.name,
                qty: m.qty,
                volumeM3: m.totalM3,
                dimsText: `Fill section: ${(sectionL * 100).toFixed(0)}cm long × W${(this.truckW * 100).toFixed(0)} × H${(this.truckH * 100).toFixed(0)}`,
                overflow: isOverflow
            };
            group.add(block);
            this.cartonMeshes.push(block);

            currentZ += sectionL;
        });
    }

    // Floor-up heightmap packer — physically valid placement:
    // every carton rests on the floor or fully on another carton, no floating,
    // no overlap, no penetration, always inside the trailer, stacked only on
    // flat support surfaces, built floor-up with large/heavy cartons grounded first.
    buildCartonTetris(group) {
        // --- 1. Collect cartons (hidden models skipped, strict dims) ---
        let boxes = [];
        this.models.forEach(m => {
            if (this.hiddenModels.has(m.id)) return; // what-if view: hidden models skipped
            for (let i = 0; i < m.qty; i++) {
                if (!m.l || !m.w || !m.h) return; // STRICT MODE: Skip products missing dimensions
                boxes.push({
                    l: m.l / 100, w: m.w / 100, h: m.h / 100,
                    color: m.color, model: m.name, qtyTotal: m.qty,
                    type: m.type || '', desc: m.description || '',
                    dimsCm: `${m.l} × ${m.w} × ${m.h}`,
                    area: (m.l / 100) * (m.w / 100)
                });
            }
        });

        // --- 2. Loading order: floor-first, large/heavy before small ---
        boxes.sort((a, b) => {
            const fpDiff = b.area - a.area;          // bigger footprint first
            if (Math.abs(fpDiff) > 0.001) return fpDiff;
            const hDiff = b.h - a.h;                 // then taller (heavier) first
            if (Math.abs(hDiff) > 0.001) return hDiff;
            return (b.l * b.w * b.h) - (a.l * a.w * a.h); // then by volume
        });

        // --- 3. Heightmap grid over the trailer floor ---
        const CELL = 0.05; // 5cm grid
        const nx = Math.max(1, Math.floor(this.truckW / CELL));
        const nz = Math.max(1, Math.floor(this.truckL / CELL));
        const grid = new Float32Array(nx * nz); // support height per cell (starts 0 = bare floor)

        const cellDim = (dimMeters) => Math.max(1, Math.round(dimMeters / CELL));

        // Check a candidate footprint: all cells must share ONE support height (flat seat).
        // Returns that height, or -1 if not uniform / out of bounds.
        const supportHeightAt = (x0, z0, cw, cl) => {
            const ix0 = Math.floor(x0 / CELL);
            const iz0 = Math.floor(z0 / CELL);
            const ix1 = ix0 + cw;
            const iz1 = iz0 + cl;
            if (ix0 < 0 || iz0 < 0 || ix1 > nx || iz1 > nz) return -1; // outside trailer
            let h0 = -1;
            for (let iz = iz0; iz < iz1; iz++) {
                const row = iz * nx;
                for (let ix = ix0; ix < ix1; ix++) {
                    const h = grid[row + ix];
                    if (h0 === -1) h0 = h;
                    else if (h !== h0) return -1; // uneven surface — no flat support here
                }
            }
            return h0;
        };

        // Raise the footprint cells after placement
        const stamp = (x0, z0, cw, cl, newH) => {
            const ix0 = Math.floor(x0 / CELL);
            const iz0 = Math.floor(z0 / CELL);
            for (let iz = iz0; iz < iz0 + cl; iz++) {
                const row = iz * nx;
                for (let ix = ix0; ix < ix0 + cw; ix++) {
                    grid[row + ix] = newH;
                }
            }
        };

        const placed = [];
        let overflowCount = 0;
        const overflowByModel = {}; // { modelCode: { qty, reason, dimsCm } }
        const halfW = this.truckW / 2;
        const halfL = this.truckL / 2;

        const recordOverflow = (box, reason) => {
            overflowCount++;
            if (!overflowByModel[box.model]) {
                overflowByModel[box.model] = { qty: 0, reason: reason, dimsCm: box.dimsCm };
            }
            overflowByModel[box.model].qty++;
            // A model can overflow for both reasons across different cartons —
            // keep the first reason but note both if they diverge.
            if (overflowByModel[box.model].reason !== reason) {
                overflowByModel[box.model].reason += ' + ' + reason;
            }
        };

        for (const b of boxes) {
            // Box too tall for the trailer at all -> overflow
            if (b.h > this.truckH) { recordOverflow(b, `taller than trailer (${Math.round(this.truckH * 100)}cm)`); continue; }

            let best = null; // {x, z, h, rot}

            // Try both floor-plane orientations (0deg / 90deg rotation)
            const orientations = (b.l === b.w) ? [false] : [false, true];
            for (const rot of orientations) {
                const fw = rot ? b.l : b.w; // footprint width  (X)
                const fl = rot ? b.w : b.l; // footprint length (Z)
                if (fw > this.truckW || fl > this.truckL) continue;
                const cw = cellDim(fw);
                const cl = cellDim(fl);

                // Scan floor positions: deepest Z first (nose of truck = -Z), then X
                for (let iz = nz - cl; iz >= 0; iz--) {
                    for (let ix = 0; ix + cw <= nx; ix++) {
                        const x0 = ix * CELL;
                        const z0 = iz * CELL;
                        const h = supportHeightAt(x0, z0, cw, cl);
                        if (h < 0) continue;                 // uneven/outside
                        if (h + b.h > this.truckH) continue; // roof clearance

                        const score = h * 1000 + iz; // lowest support first, deepest first
                        if (!best || score < best.score) {
                            best = { x: x0, z: z0, h: h, rot: rot, score: score, cw: cw, cl: cl, fw: fw, fl: fl };
                        }
                        break; // first valid X at this Z already optimal for this row scan
                    }
                }
            }

            if (!best) { recordOverflow(b, 'no support space left'); continue; }

            // Convert grid cell to world coords (truck centered at origin)
            const worldX = best.x - halfW;
            const worldZ = best.z - halfL;
            stamp(best.x, best.z, best.cw, best.cl, best.h + b.h);

            placed.push({
                b: b,
                x: worldX + best.fw / 2,   // mesh center X
                y: best.h + b.h / 2,       // mesh center Y (bottom = support height)
                z: worldZ + best.fl / 2,   // mesh center Z
                fw: best.fw, fl: best.fl, fh: b.h,
                rot: best.rot
            });
        }

        // --- 4. Build meshes from physically valid placements ---
        placed.forEach(p => {
            const b = p.b;
            const geo = new THREE.BoxGeometry(p.fw, p.fh, p.fl);
            const mat = this.createCartonMaterial(b.type, b.desc, b.color);
            const mesh = new THREE.Mesh(geo, mat);

            const edges = new THREE.EdgesGeometry(geo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 }));
            mesh.add(line);

            mesh.position.set(p.x, p.y, p.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = {
                model: b.model,
                description: b.desc || b.model,
                qty: b.qtyTotal,
                dimsText: `${b.dimsCm} cm`,
                overflow: false
            };
            group.add(mesh);
            this.cartonMeshes.push(mesh);
        });

        // --- 5. Overflow report (excluded from truck body, banner reports details) ---
        this.tetrisOverflowCount = overflowCount;
        this.tetrisTotalCount = boxes.length;
        this.tetrisOverflowByModel = overflowByModel;
    }

    // ============ 3D FEATURE ADDITIONS ============

    // Hover highlight + tooltip (handles single- and multi-material meshes)
    updateHoverHighlight(object) {
        if (this.hoveredMesh === object) {
            // just move tooltip along cursor
            const tip = document.getElementById('loose3dTooltip');
            if (tip && object) {
                tip.style.left = (this.mouseX + 15) + 'px';
                tip.style.top = (this.mouseY + 15) + 'px';
            }
            return;
        }

        // un-highlight previous
        if (this.hoveredMesh) {
            const mats = Array.isArray(this.hoveredMesh.material) ? this.hoveredMesh.material : [this.hoveredMesh.material];
            mats.forEach(mm => { if (mm && mm.emissive) mm.emissive.setHex(0x000000); });
            this.hoveredMesh = null;
        }

        const tip = document.getElementById('loose3dTooltip');
        if (!object) {
            if (tip) tip.style.display = 'none';
            return;
        }

        this.hoveredMesh = object;
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        mats.forEach(mm => { if (mm && mm.emissive) mm.emissive.setHex(0x333333); });

        const u = object.userData || {};
        if (tip) {
            const overflowHTML = u.overflow
                ? '<br><span style="color: #ef4444; font-weight: 700; font-size: 11px;">⚠ OVERFLOW — does not fit this container</span>'
                : '';
            const dimsHTML = u.dimsText
                ? `<br><span style="color: var(--fg-muted, #a1a1aa); font-size: 11px;">${u.dimsText}</span>`
                : '';
            tip.innerHTML = `<strong style="color: var(--accent, #8b5cf6);">Model:</strong> ${u.model || '-'}<br>` +
                `<span style="color: var(--fg-muted, #a1a1aa);">${u.description || ''}</span><br>` +
                `<strong>Qty:</strong> ${u.qty != null ? u.qty + ' pcs' : '-'}${u.volumeM3 != null ? ' · ' + u.volumeM3.toFixed(2) + ' m³' : ''}` +
                dimsHTML + overflowHTML;
            tip.style.display = 'block';
            tip.style.left = (this.mouseX + 15) + 'px';
            tip.style.top = (this.mouseY + 15) + 'px';
        }
    }

    // Volume-based overflow / trucks-needed banner in the 3D modal
    updateOverflowBanner() {
        const banner = document.getElementById('looseOverflowBanner');
        if (!banner) return;

        let totalCBM = 0;
        this.models.forEach(m => {
            if (!this.hiddenModels.has(m.id)) totalCBM += m.totalM3;
        });

        const trucksNeeded = Math.max(1, Math.ceil(totalCBM / this.maxCBM));
        const overM3 = totalCBM - this.maxCBM;

        // Tetris mode: cartons with no legal physical position are excluded — report them
        const tetrisOverflow = (this.simMode === 'tetris' && this.tetrisOverflowCount > 0)
            ? this.tetrisOverflowCount : 0;

        if (this.hiddenModels.size > 0) {
            banner.style.display = 'block';
            banner.style.background = 'rgba(59, 130, 246, 0.15)';
            banner.style.border = '1px solid rgba(59, 130, 246, 0.5)';
            banner.style.color = '#93c5fd';
            banner.textContent = `👀 What-if view: ${this.hiddenModels.size} model(s) hidden — showing ${trucksNeeded} truck(s) needed for visible load (${totalCBM.toFixed(2)} m³)`;
            return;
        }

        if (tetrisOverflow > 0) {
            banner.style.display = 'block';
            banner.style.background = 'rgba(239, 68, 68, 0.15)';
            banner.style.border = '1px solid rgba(239, 68, 68, 0.5)';
            banner.style.color = '#fca5a5';
            banner.style.whiteSpace = 'normal';
            banner.style.maxWidth = '560px';
            banner.style.textAlign = 'center';
            banner.style.lineHeight = '1.5';
            const total = this.tetrisTotalCount || 0;

            // Per-model removal details: which model + qty + why
            let detailsHtml = '';
            if (this.tetrisOverflowByModel) {
                const lines = Object.entries(this.tetrisOverflowByModel).map(([model, info]) =>
                    `• <strong>${model}</strong> ×${info.qty} — ${info.dimsCm} cm, ${info.reason}`
                );
                if (lines.length > 0) {
                    detailsHtml = `<div style="font-size: 11px; font-weight: 500; margin-top: 4px; opacity: 0.95;">` +
                        `<div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Remove to fit this truck:</div>` +
                        lines.join('<br>') + `</div>`;
                }
            }

            banner.innerHTML = `⚠ <strong>${tetrisOverflow}/${total} cartons don't fit physically</strong> — left out of this truck · ~${trucksNeeded} truck(s) needed by volume${detailsHtml}`;
        } else if (overM3 > 0) {
            banner.style.display = 'block';
            banner.style.background = 'rgba(239, 68, 68, 0.15)';
            banner.style.border = '1px solid rgba(239, 68, 68, 0.5)';
            banner.style.color = '#fca5a5';
            banner.style.whiteSpace = 'nowrap';
            banner.style.maxWidth = 'none';
            banner.innerHTML = `⚠ Over capacity by ${overM3.toFixed(2)} m³ — ${trucksNeeded} × ${LOOSE_CONTAINER_SPECS[this.truckType].name} trucks needed`;
        } else {
            banner.style.display = 'none';
        }
    }

    // Clickable legend: toggle model visibility (what-if view)
    toggleModelVisibility(modelId) {
        if (this.hiddenModels.has(modelId)) {
            this.hiddenModels.delete(modelId);
        } else {
            this.hiddenModels.add(modelId);
        }

        // Update legend item style
        const item = document.getElementById(`looseLegendItem-${modelId}`);
        if (item) {
            if (this.hiddenModels.has(modelId)) {
                item.style.opacity = '0.35';
                item.style.textDecoration = 'line-through';
            } else {
                item.style.opacity = '1';
                item.style.textDecoration = 'none';
            }
        }

        // Rebuild 3D scene if modal is open (skips hidden models)
        const modal = document.getElementById('truck3dModal');
        if (modal && modal.style.display !== 'none') {
            this.open3DViewer();
        }
    }

    // Camera view presets with smooth tween
    setView(view) {
        this.currentView = view;
        this.updateViewButtons();
        if (!this.cameraRef || !this.controlsRef) return;

        const L = this.truckL, W = this.truckW, H = this.truckH;
        let toPos, toTgt;

        if (view === 'doors') {
            // Behind the open rear doors, looking into the container
            toPos = new THREE.Vector3(0, H * 0.75, L / 2 + 9);
            toTgt = new THREE.Vector3(0, H * 0.4, 0);
        } else if (view === 'top') {
            // Bird's-eye straight down
            toPos = new THREE.Vector3(0.01, L + 6, 0.01);
            toTgt = new THREE.Vector3(0, 0, 0);
        } else {
            // Default hero angle
            toPos = new THREE.Vector3(-14, 9, -17);
            toTgt = new THREE.Vector3(0, 1.2, 0);
        }

        this.camTween = {
            t: 0,
            dur: 1 / 48, // ~0.8s at 60fps
            fromPos: this.cameraRef.position.clone(),
            toPos: toPos,
            fromTgt: this.controlsRef.target.clone(),
            toTgt: toTgt
        };
    }

    updateViewButtons() {
        const defs = [
            ['looseViewDefaultBtn', 'default'],
            ['looseViewDoorsBtn', 'doors'],
            ['looseViewTopBtn', 'top']
        ];
        defs.forEach(([id, val]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            if (this.currentView === val) {
                btn.classList.remove('ghost');
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
                btn.classList.add('ghost');
            }
        });
    }

    // Reveal-in-place loading animation — boxes pop in at their packed seats
    // in real loading order: nose-first rows (small Z = front of truck), bottom-to-top
    // levels within a row (matches how crews floor-load a container).
    // Merged control: button is ▶ Start (idle) → ⏸ Pause (running) → ▶ Resume (paused).
    animateLoading() {
        // Toggle pause when an animation is live
        if (this.loadAnim) {
            this.loadAnim.paused = !this.loadAnim.paused;
            this.animPaused = this.loadAnim.paused;
            // reset tick anchor so resume doesn't jump the clock
            this.loadAnim.lastTick = null;
            this.updateAnimateButton();
            return;
        }

        if (!this.cartonMeshes || this.cartonMeshes.length === 0) return;

        // --- 1. Group meshes into layers (Z nose-to-doors, then Y bottom-to-top) ---
        const zBucket = (m) => Math.round(m.position.z / 0.25);
        const yBucket = (m) => Math.round(m.position.y / 0.15);

        const layerMap = new Map(); // key: `${z}|${y}` -> meshes
        this.cartonMeshes.forEach(mesh => {
            const key = `${zBucket(mesh)}|${yBucket(mesh)}`;
            if (!layerMap.has(key)) layerMap.set(key, []);
            layerMap.get(key).push(mesh);
        });

        // Sort layers: nose-first (small Z = front of truck), bottom-to-top within.
        // NOTE: iterate the VALUES only — entries would yield [key, meshes] pairs.
        const layers = Array.from(layerMap.entries()).sort((a, b) => {
            const [za, ya] = a[0].split('|').map(Number);
            const [zb, yb] = b[0].split('|').map(Number);
            if (za !== zb) return za - zb;
            return ya - yb;
        }).map(e => e[1]);

        // --- 2. Timing ---
        const perItem = 350;         // ms per box pop-in
        const layerGap = 300;        // pause between layers
        const perBoxInLayer = 45;    // stagger between boxes in same layer

        const items = [];
        let clock = 0;
        const layerStarts = [];
        layers.forEach(meshes => {
            layerStarts.push(clock);
            meshes.forEach(mesh => {
                // Reset scale so a mid-animation replay captures a clean state
                mesh.scale.setScalar(1);
                items.push({
                    mesh: mesh,
                    delay: clock,
                    dur: perItem,
                    scaleFrom: 0.01
                });
                clock += perBoxInLayer;
            });
            clock = Math.max(clock, 0) + layerGap;
        });
        let totalDur = clock + perItem;

        // Cap total duration ~10s for huge loads: compress delays proportionally
        const MAX_TOTAL = 10000;
        if (totalDur > MAX_TOTAL) {
            const squeeze = (MAX_TOTAL - perItem) / (totalDur - perItem);
            items.forEach(it => { it.delay *= squeeze; });
            totalDur = MAX_TOTAL;
        }

        // --- 3. Progress HUD ---
        let hud = document.getElementById('looseLoadHud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'looseLoadHud';
            hud.style.cssText = 'position:absolute; bottom:20px; left:50%; transform:translateX(-50%);' +
                'background:rgba(24,24,27,0.92); border:1px solid #3f3f46; border-radius:8px;' +
                'padding:8px 18px; font-size:13px; font-weight:600; color:#f4f4f5;' +
                'box-shadow:0 4px 12px rgba(0,0,0,0.5); z-index:10; white-space:nowrap; pointer-events:none;';
            const container = document.getElementById('truck3dContainer');
            if (container) container.appendChild(hud);
        }
        hud.style.display = 'block';
        hud.textContent = `Layer 1/${layers.length} · 0/${items.length} cartons · 0%`;

        this.loadAnim = {
            items: items,
            animClock: 0,          // accumulated animation time (speed-adjusted)
            lastTick: null,        // frame anchor; null after pause so resume doesn't jump
            paused: false,
            totalDur: totalDur,
            layerCount: layers.length,
            hudEl: hud,
            layerBounds: layers.map((_, idx) => ({ start: layerStarts[idx], layer: idx + 1 }))
        };
        this.animPaused = false;
        this.updateAnimateButton();
    }

    // Merged ▶/⏸ button state: idle → Start, running → Pause, paused → Resume
    updateAnimateButton() {
        const btn = document.getElementById('looseAnimateBtn');
        if (!btn) return;
        const label = btn.querySelector('span');
        const running = !!this.loadAnim && !this.loadAnim.paused;
        const paused = !!this.loadAnim && this.loadAnim.paused;
        if (running) {
            btn.innerHTML = '⏸ <span>Pause</span>';
            btn.title = 'Pause the loading animation';
            btn.classList.remove('success');
            btn.classList.add('warning');
        } else if (paused) {
            btn.innerHTML = '▶ <span>Resume</span>';
            btn.title = 'Resume the paused loading animation';
            btn.classList.remove('warning');
            btn.classList.add('success');
        } else {
            btn.innerHTML = '▶ <span>Animate Loading</span>';
            btn.title = 'Replay the carton loading sequence (nose-first, floor-up)';
            btn.classList.remove('success');
            btn.classList.add('warning');
        }
    }

    // Live animation speed multiplier (applies from the next frame)
    setAnimSpeed(v) {
        const s = parseFloat(v);
        if (!isNaN(s) && s > 0) this.animSpeed = s;
    }

    // Render-then-capture snapshot (no preserveDrawingBuffer overhead)
    snapshotPNG() {
        if (!this.renderer || !this.scene || !this.cameraRef) return;
        // hide tooltip if over canvas
        const tip = document.getElementById('loose3dTooltip');
        const tipVisible = tip && tip.style.display !== 'none';
        if (tip) tip.style.display = 'none';

        this.renderer.render(this.scene, this.cameraRef);
        const url = this.renderer.domElement.toDataURL('image/png');

        if (tipVisible && tip) tip.style.display = 'block';

        const a = document.createElement('a');
        const ts = new Date();
        const pad = (v) => String(v).padStart(2, '0');
        a.download = `loose_load_${this.truckType}_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.png`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

const loosePlanner = new LooseLoadPlanner();
