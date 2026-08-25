const CONTAINER_SPECS = {
    '40HC': { id: '40HC', name: '40ft High Cube', lengthFt: 40, widthFt: 8, heightFt: 8.5, maxVolumeM3: 76.0, defaultRows: 8, badge: '40ft HC (76m³)' },
    '20GP': { id: '20GP', name: '20ft Standard', lengthFt: 20, widthFt: 8, heightFt: 8.5, maxVolumeM3: 33.2, defaultRows: 4, badge: '20ft GP (33.2m³)' }
};

class PalletCalculationEngine {
    constructor() {
        this.selectedTruckType = '40HC';
        const savedMasterData = localStorage.getItem("GlobalMasterDataMap");
        this.masterData = [];
        if (savedMasterData) {
            try {
                const globalObj = JSON.parse(savedMasterData);
                // Convert dictionary to array
                this.masterData = Object.values(globalObj);
            } catch (e) {
                this.masterData = [];
            }
        }
        
        if (!this.masterData || this.masterData.length === 0) {
            this.masterData = [
                { code: '12541204', description: 'Product A (Single Config)', capacities: [18] },
                { code: '12606915', description: 'Product B (Multi Config)', capacities: [6, 5] }
            ];
            // NOTE: do NOT persist the demo seed into GlobalMasterDataMap —
            // that key is shared with the DO/Loose load planners, and the demo
            // entries lack m3/L/W/H fields, which crashed their table render.
            // Keep the seed in-memory only for this session.
        }
        
        this.orders = [];
        
        this.init();
    }
    
    setTruckType(type) {
        if (!CONTAINER_SPECS[type]) return;
        this.selectedTruckType = type;
        this.isPalletsDirty = true;
        
        // Update 3D modal buttons if present
        const btn40 = document.getElementById('truckSize40Btn');
        const btn20 = document.getElementById('truckSize20Btn');
        if (btn40 && btn20) {
            if (type === '40HC') {
                btn40.classList.remove('ghost'); btn40.classList.add('active');
                btn20.classList.remove('active'); btn20.classList.add('ghost');
            } else {
                btn20.classList.remove('ghost'); btn20.classList.add('active');
                btn40.classList.remove('active'); btn40.classList.add('ghost');
            }
        }
        
        // Update dashboard buttons if present
        const dBtn40 = document.getElementById('dashTruckSize40Btn');
        const dBtn20 = document.getElementById('dashTruckSize20Btn');
        if (dBtn40 && dBtn20) {
            if (type === '40HC') {
                dBtn40.classList.remove('ghost'); dBtn40.classList.add('active');
                dBtn20.classList.remove('active'); dBtn20.classList.add('ghost');
            } else {
                dBtn20.classList.remove('ghost'); dBtn20.classList.add('active');
                dBtn40.classList.remove('active'); dBtn40.classList.add('ghost');
            }
        }
        
        // Update modal title if present
        const modalTitle = document.getElementById('truck3dModalTitle');
        if (modalTitle) {
            modalTitle.textContent = type === '20GP' ? '20-Footer 3D Visualization' : '40-Footer 3D Visualization';
        }
        
        this.renderDashboard();
        
        const modal = document.getElementById('truck3dModal');
        if (modal && modal.style.display !== 'none') {
            this.open3DViewer();
        }
    }
    
    saveMasterData() {
        const globalObj = {};
        this.masterData.forEach(m => {
            // Ensure code is synced and capacities exist
            if (m.code) {
                globalObj[m.code] = {
                    ...m,
                    capacities: m.capacities || []
                };
            }
        });
        localStorage.setItem("GlobalMasterDataMap", JSON.stringify(globalObj));
    }
    
    init() {
        // Check for pending items from DO Details Inspector
        try {
            const pendingOrderStr = localStorage.getItem("PendingBulkLoadOrder");
            if (pendingOrderStr) {
                const pendingItems = JSON.parse(pendingOrderStr);
                
                // Add valid items to orders
                let addedCount = 0;
                let newModelsCount = 0;
                
                pendingItems.forEach(item => {
                    let masterModel = this.masterData.find(m => m.code === item.code);

                    // If product isn't in master data, auto-add it with no capacities (Loose only)
                    if (!masterModel) {
                        masterModel = {
                            code: item.code,
                            description: item.desc || `Product ${item.code}`,
                            capacities: [],
                            maxPallet: null,
                            type: ''
                        };
                        this.masterData.push(masterModel);
                        newModelsCount++;
                    }
                    
                    const rawCaps = [...masterModel.capacities].map(c => parseInt(c)).filter(c => !isNaN(c) && c > 0).sort((a, b) => b - a);
                    const result = this.calculatePallets(item.qty, rawCaps);
                    this.orders.push({
                        id: Date.now() + Math.random(),
                        inv: item.inv || "MANUAL",
                        code: masterModel.code,
                        description: masterModel.description,
                        orderQty: item.qty,
                        route: item.route || "UNASSIGNED",
                        m3: (item.vol !== undefined && item.vol !== null && item.vol !== 0) ? item.vol : (masterModel.m3 || 0),
                        rawCaps: rawCaps,
                        selectedCap: rawCaps[0] || null,
                        strategy: 'MIX',
                        maxPallet: masterModel.maxPallet,
                        type: masterModel.type,
                        length: masterModel.palletL || masterModel.length || masterModel.l,
                        width: masterModel.palletW || masterModel.width || masterModel.w,
                        cartonL: masterModel.l,
                        cartonW: masterModel.w,
                        cartonH: masterModel.h,
                        tie: masterModel.tie,
                        high: masterModel.high,
                        palletQty: result.palletQty,
                        looseQty: result.looseQty,
                        strictLooseQty: result.strictLooseQty,
                        configUsed: result.configUsed,
                        palletsList: result.palletsList
                    });
                    addedCount++;
                });
                
                if (newModelsCount > 0) {
                    this.saveMasterData();
                }
                
                // Remove from local storage after reading
                localStorage.removeItem("PendingBulkLoadOrder");
                console.log(`Loaded ${addedCount} items from DO Details Inspector into Bulk Load Planner.`);
            }
        } catch (e) {
            console.error("Error reading pending bulk load order:", e);
        }
        
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.renderAll());
        } else {
            this.renderAll();
        }
    }
    
    renderAll() {
        this.renderMasterData();
        this.renderOrderForm();
        this.renderResults();
    }
    
    calculatePallets(qty, capacities, strategy = 'MIX') {
        if (!capacities || capacities.length === 0) {
            return { palletQty: 0, looseQty: qty, strictLooseQty: qty, configUsed: "No configuration", palletsList: [] };
        }
        
        const caps = [...capacities].map(c => parseInt(c)).filter(c => !isNaN(c) && c > 0).sort((a, b) => b - a);
        if (caps.length === 0) {
            return { palletQty: 0, looseQty: qty, strictLooseQty: qty, configUsed: "Invalid configuration", palletsList: [] };
        }
        
        let totalPallets = 0;
        let finalConfig = {};
        let configUsedStr = [];
        let bestLoose = 0;
        let strictLooseQty = 0;
        let palletsList = [];

        if (strategy === 'SPLIT' && caps.length >= 2) {
            const capA = caps[0];
            const capB = caps[1];
            const pairSum = capA + capB;
            const fullPairs = Math.floor(qty / pairSum);
            bestLoose = qty % pairSum;
            
            finalConfig[capA] = fullPairs;
            finalConfig[capB] = fullPairs;
            
            for(let i = 0; i < fullPairs; i++) {
                palletsList.push(capA);
                palletsList.push(capB);
            }
            
            if (bestLoose > 0) {
                if (bestLoose >= capA) {
                    finalConfig[capA]++;
                    palletsList.push(capA);
                    bestLoose -= capA;
                } else if (bestLoose >= capB) {
                    finalConfig[capB]++;
                    palletsList.push(capB);
                    bestLoose -= capB;
                }
            }
            
            totalPallets = (finalConfig[capA] || 0) + (finalConfig[capB] || 0);
            
            for (const cap of [capA, capB]) {
                if (finalConfig[cap] > 0) {
                    configUsedStr.push(`${finalConfig[cap]} x [${cap} pcs]`);
                }
            }
            
            if (bestLoose > 0) {
                strictLooseQty = bestLoose;
                configUsedStr.push(`${bestLoose} pcs (loose)`);
            }
            
        } else if (strategy === 'MAX') {
            const cap = caps[0];
            const sets = Math.floor(qty / cap);
            bestLoose = qty % cap;
            
            finalConfig[cap] = sets;
            for(let i=0; i<sets; i++) palletsList.push(cap);
            
            totalPallets = sets;
            if (sets > 0) configUsedStr.push(`${sets} x [${cap} pcs]`);
            
            if (bestLoose > 0) {
                strictLooseQty = bestLoose;
                configUsedStr.push(`${bestLoose} pcs (loose)`);
            }
        } else {
            // MIX Strategy
            let baseConfig = {};
            const sumCaps = caps.reduce((sum, c) => sum + c, 0);
            const sets = Math.floor(qty / sumCaps);
            const remainderQty = qty % sumCaps;
            
            if (sets > 0) {
                for (const cap of caps) {
                    baseConfig[cap] = sets;
                }
            }
            
            bestLoose = remainderQty;
            let bestRemainderConfig = {};
            
            const search = (currentQty, currentConfig, capIndex) => {
                if (currentQty === 0) {
                    bestLoose = 0;
                    bestRemainderConfig = { ...currentConfig };
                    return true;
                }
                
                if (capIndex >= caps.length) {
                    if (currentQty < bestLoose) {
                        bestLoose = currentQty;
                        bestRemainderConfig = { ...currentConfig };
                    }
                    return false;
                }
                
                const cap = caps[capIndex];
                const maxPallets = Math.floor(currentQty / cap);
                
                for (let i = maxPallets; i >= 0; i--) {
                    const rem = currentQty - (i * cap);
                    currentConfig[cap] = i;
                    if (search(rem, currentConfig, capIndex + 1)) return true;
                }
                
                return false;
            };
            
            search(remainderQty, {}, 0);
            
            for (const cap of caps) {
                const count = (baseConfig[cap] || 0) + (bestRemainderConfig[cap] || 0);
                if (count > 0) {
                    finalConfig[cap] = count;
                    totalPallets += count;
                    for(let i=0; i<count; i++) palletsList.push(cap);
                }
            }
            
            for (const cap of caps) {
                if (finalConfig[cap] > 0) {
                    configUsedStr.push(`${finalConfig[cap]} x [${cap} pcs]`);
                }
            }
            
            if (bestLoose > 0) {
                strictLooseQty = bestLoose;
                configUsedStr.push(`${bestLoose} pcs (loose)`);
            }
        }
        
        return {
            palletQty: totalPallets,
            looseQty: bestLoose,
            strictLooseQty: strictLooseQty,
            configUsed: configUsedStr.join(", "),
            palletsList: palletsList
        };
    }
    
    exportMasterData() {
        if (typeof XLSX === 'undefined') {
            return showToast('Excel library not loaded.', "warning");
        }
        
        const data = [
            ['Product Code', 'Description', 'Capacities', 'm3', 'Length (cm)', 'Width (cm)', 'Height (cm)', 'Max Pallet', 'Type', 'Pallet Length (cm)', 'Pallet Width (cm)', 'Tie (Qty per Layer)', 'High (Layers)']
        ];
        
        this.masterData.forEach(m => {
            data.push([
                m.code, m.description, (m.capacities || []).join(','), m.m3 || '', 
                m.l || '', m.w || '', m.h || '', m.maxPallet || '', m.type || '', 
                m.palletL || m.length || '', m.palletW || m.width || '',
                m.tie || '', m.high || ''
            ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Master Data");
        
        XLSX.writeFile(wb, "MasterData_Export.xlsx");
    }
    
    triggerImport() {
        document.getElementById('masterDataFileInput').click();
    }
    
    handleImportSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.pendingImportFile = file;
        
        const modal = document.getElementById('importModal');
        if (modal) modal.style.display = 'flex';
        
        event.target.value = '';
    }
    
    closeImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) modal.style.display = 'none';
        this.pendingImportFile = null;
    }
    
    processImport(mode) {
        if (!this.pendingImportFile) return this.closeImportModal();
        if (typeof XLSX === 'undefined') {
            showToast('Excel library not loaded.', "warning");
            return this.closeImportModal();
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (rows.length < 2) {
                    showToast('File does not contain valid data.', "warning");
                    return;
                }
                
                const newMasterData = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0 || row[0] == null || String(row[0]).trim() === '') continue;
                    
                    const code = String(row[0]).trim();
                    const description = row[1] ? String(row[1]).trim() : `Product ${code}`;
                    const capacitiesRaw = row[2] ? String(row[2]) : '';
                    
                    let m3 = row[3] ? parseFloat(String(row[3]).trim()) : null;
                    let l = row[4] ? parseFloat(String(row[4]).trim()) : null;
                    let w = row[5] ? parseFloat(String(row[5]).trim()) : null;
                    let h = row[6] ? parseFloat(String(row[6]).trim()) : null;

                    let maxPallet = row[7] ? parseInt(String(row[7]).trim()) : null;
                    if (isNaN(maxPallet) || maxPallet <= 0) maxPallet = null;
                    const type = row[8] ? String(row[8]).trim() : '';
                    
                    const upperType = type.toUpperCase();

                    // Calculate m3 from carton dimensions strictly for HIFI if available, otherwise use fallback
                    if ((upperType === 'HIFI' || upperType === 'HIFI AUDIO') && l > 0 && w > 0 && h > 0) {
                        m3 = (l * w * h) / 1000000;
                    } else if (isNaN(m3) || m3 < 0) {
                        m3 = null;
                    }
                    
                    let palletL = row[9] ? parseFloat(String(row[9]).trim()) : null;
                    if (isNaN(palletL) || palletL <= 0) palletL = null;
                    
                    let palletW = row[10] ? parseFloat(String(row[10]).trim()) : null;
                    if (isNaN(palletW) || palletW <= 0) palletW = null;
                    
                    const tieRaw = row[11] ? String(row[11]) : '';
                    const highRaw = row[12] ? String(row[12]) : '';
                    
                    const capacities = capacitiesRaw.split(',')
                        .map(s => parseInt(s.trim()))
                        .filter(n => !isNaN(n) && n > 0);
                        
                    newMasterData.push({ code, description, capacities, m3, l, w, h, maxPallet, type, palletL, palletW, tie: tieRaw, high: highRaw });
                }
                
                if (mode === 'replace') {
                    this.masterData = newMasterData;
                } else if (mode === 'append') {
                    newMasterData.forEach(newM => {
                        const existingIdx = this.masterData.findIndex(m => m.code === newM.code);
                        if (existingIdx >= 0) {
                            // Merge keeping old fields if new are blank
                            const oldM = this.masterData[existingIdx];
                            this.masterData[existingIdx] = {
                                ...oldM,
                                ...newM,
                                m3: newM.m3 || oldM.m3,
                                l: newM.l || oldM.l,
                                w: newM.w || oldM.w,
                                h: newM.h || oldM.h,
                                palletL: newM.palletL || oldM.palletL,
                                palletW: newM.palletW || oldM.palletW,
                                tie: newM.tie || oldM.tie,
                                high: newM.high || oldM.high,
                                capacities: newM.capacities.length > 0 ? newM.capacities : oldM.capacities
                            };
                        } else {
                            this.masterData.push(newM);
                        }
                    });
                }
                
                this.saveMasterData();
                
                this.renderMasterData();
                this.renderOrderForm();
                this.closeImportModal();
                showToast(`Successfully imported ${newMasterData.length} models.`, "warning");
            } catch (err) {
                console.error("Import error:", err);
                showToast("Error importing file. Please ensure it is a valid Excel file.", "warning");
                this.closeImportModal();
            }
        };
        
        reader.readAsArrayBuffer(this.pendingImportFile);
    }
    
    renderMasterData() {
        const statusEl = document.getElementById("masterDataStatus");
        if (!statusEl) return;
        
        statusEl.textContent = `${this.masterData.length.toLocaleString()} models loaded`;
    }
    
    renderOrderForm() {
        const datalist = document.getElementById("orderModelList");
        if (!datalist) return;
        
        datalist.innerHTML = this.masterData.map(m => `
            <option value="${m.code} - ${m.description}"></option>
        `).join('');
    }
    
    triggerOrderImport() {
        const fileInput = document.getElementById("orderDataFileInput");
        if (fileInput) fileInput.click();
    }
    
    handleOrderImportSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            if (jsonRows.length === 0) {
                showToast("The Excel file is empty", "warning");
                return;
            }
            
            // Find columns for Code and Qty (case insensitive search)
            let codeKey = null;
            let qtyKey = null;
            
            const keys = Object.keys(jsonRows[0]);
            keys.forEach(k => {
                const kLower = k.toLowerCase();
                if (!codeKey && (kLower.includes("code") || kLower.includes("item") || kLower.includes("model"))) codeKey = k;
                if (!qtyKey && (kLower.includes("qty") || kLower.includes("quantity") || kLower.includes("pcs"))) qtyKey = k;
            });
            
            if (!codeKey || !qtyKey) {
                showToast("Could not find Code or Qty columns in Excel. Please check headers.", "warning");
                return;
            }
            
            let addedCount = 0;
            
            jsonRows.forEach(row => {
                const rawCode = row[codeKey];
                const rawQty = row[qtyKey];
                
                if (!rawCode) return;
                
                const code = String(rawCode).trim();
                let qty = parseInt(rawQty);
                
                if (isNaN(qty) || qty <= 0) return;
                
                const model = this.masterData.find(m => m.code === code);
                
                if (model) {
                    const rawCaps = [...model.capacities].map(c => parseInt(c)).filter(c => !isNaN(c) && c > 0).sort((a, b) => b - a);
                    const result = this.calculatePallets(qty, rawCaps);
                    this.orders.push({
                        id: Date.now() + Math.random(),
                        code: model.code,
                        description: model.description,
                        orderQty: qty,
                        route: "UNASSIGNED",
                        m3: model.m3 || 0,
                        rawCaps: rawCaps,
                        selectedCap: rawCaps[0] || null,
                        strategy: 'MIX',
                        maxPallet: model.maxPallet,
                        type: model.type,
                        length: model.palletL || model.length || model.l,
                        width: model.palletW || model.width || model.w,
                        cartonL: model.l,
                        cartonW: model.w,
                        cartonH: model.h,
                        tie: model.tie,
                        high: model.high,
                        palletQty: result.palletQty,
                        looseQty: result.looseQty,
                        strictLooseQty: result.strictLooseQty,
                        configUsed: result.configUsed,
                        palletsList: result.palletsList
                    });
                } else {
                    // Unknown model fallback
                    const result = this.calculatePallets(qty, []);
                    this.orders.push({
                        id: Date.now() + Math.random(),
                        code: code,
                        description: "UNKNOWN (Missing from Master Data)",
                        orderQty: qty,
                        route: "UNASSIGNED",
                        m3: 0,
                        rawCaps: [],
                        selectedCap: null,
                        strategy: 'MIX',
                        maxPallet: 1,
                        type: 'UNKNOWN',
                        length: 120,
                        width: 100,
                        cartonL: 0,
                        cartonW: 0,
                        cartonH: 0,
                        tie: 0,
                        high: 0,
                        palletQty: result.palletQty,
                        looseQty: result.looseQty,
                        strictLooseQty: result.strictLooseQty,
                        configUsed: result.configUsed,
                        palletsList: result.palletsList
                    });
                }
                addedCount++;
            });
            
            if (addedCount > 0) {
                this.renderResults();
                showToast(`Imported ${addedCount} orders from Excel`, "success");
            } else {
                showToast("No valid orders found in Excel", "warning");
            }
        };
        
        reader.readAsArrayBuffer(file);
        event.target.value = ""; // Reset input
    }
    
    addOrder() {
        const input = document.getElementById("orderModelInput");
        const qtyInput = document.getElementById("orderQty");
        
        const inputValue = input.value.trim();
        const code = inputValue.split(' - ')[0].trim();
        const qty = parseInt(qtyInput.value);
        
        if (!code || isNaN(qty) || qty <= 0) return showToast("Invalid order quantity", "warning");
        
        const model = this.masterData.find(m => m.code === code);
        if (!model) return showToast("Model not found in master data", "warning");
        
        const rawCaps = [...model.capacities].map(c => parseInt(c)).filter(c => !isNaN(c) && c > 0).sort((a, b) => b - a);
        const result = this.calculatePallets(qty, rawCaps);
        
        this.orders.push({
            id: Date.now(),
            code: model.code,
            description: model.description,
            orderQty: qty,
            route: "UNASSIGNED",
            m3: model.m3 || 0,
            rawCaps: rawCaps,
            selectedCap: rawCaps[0] || null,
                        strategy: 'MIX',
            maxPallet: model.maxPallet,
            type: model.type,
            length: model.palletL || model.length || model.l,
            width: model.palletW || model.width || model.w,
            cartonL: model.l,
            cartonW: model.w,
            cartonH: model.h,
            tie: model.tie,
            high: model.high,
            palletQty: result.palletQty,
            looseQty: result.looseQty,
            strictLooseQty: result.strictLooseQty,
            configUsed: result.configUsed,
                        palletsList: result.palletsList
        });
        
        this.renderResults();
        
        // Deliberately NOT resetting input fields 
        // so users can easily add multiple orders of the same model without re-searching
    }
    
    updateOrderConfig(id, strategyVal, selectedCapVal) {
        const order = this.orders.find(o => o.id === id);
        if (!order) return;
        
        order.strategy = strategyVal;
        
        // If strategy is MAX and user picked a specific cap, keep it
        if (selectedCapVal) {
            order.selectedCap = parseInt(selectedCapVal);
        }
        
        let filteredCaps = order.rawCaps;
        if (order.strategy === 'MAX') {
            filteredCaps = [order.selectedCap || order.rawCaps[0]];
        }
        
        const result = this.calculatePallets(order.orderQty, filteredCaps, order.strategy);
        
        order.palletQty = result.palletQty;
        order.looseQty = result.looseQty;
        order.strictLooseQty = result.strictLooseQty;
        order.configUsed = result.configUsed;
        order.palletsList = result.palletsList;
        
        this.renderResults();
    }
    
    removeOrder(id) {
        this.orders = this.orders.filter(o => o.id !== id);
        this.renderResults();
    }
    
    clearOrders() {
        this.orders = [];
        this.renderResults();
    }
    
    renderResults() {
        this.renderDashboard();
        
        const tbody = document.getElementById("plannerResultsBody");
        if (!tbody) return;
        
        if (this.orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#71717a;">No orders calculated yet.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = this.orders.map(o => {
            let configCell = `<td style="font-size: 11px; color: var(--fg-muted, #a1a1aa);">${o.configUsed}</td>`;
            
            if (o.rawCaps && o.rawCaps.length > 1) {
                const isMix = o.strategy === 'MIX';
                const isSplit = o.strategy === 'SPLIT';
                const isMax = o.strategy === 'MAX';
                
                let selectHtml = `<select onchange="plannerEngine.updateOrderConfig(${o.id}, this.value, ${o.rawCaps[0]})" style="margin-bottom: 4px; background: var(--bg-card, #18181b); color: var(--fg-default, #f4f4f5); border: 1px solid var(--border, #27272a); border-radius: 4px; padding: 4px; width: 100%; cursor: pointer; font-size: 11px;">
                    ${isMax ? '<option value="" disabled selected>-- Select a Mix Strategy --</option>' : ''}
                    <option value="MIX" ${isMix ? 'selected' : ''}>Config 2: Perfect Fit (Mix)</option>
                    <option value="SPLIT" ${isSplit ? 'selected' : ''}>Config 3: Split Sides (L/R)</option>
                </select>`;
                
                // Allow them to MAX each specific capacity
                o.rawCaps.forEach(cap => {
                    const isThisMax = isMax && o.selectedCap === cap;
                    selectHtml += `<div style="margin-top: 2px;">
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <input type="radio" name="strat_${o.id}" onchange="plannerEngine.updateOrderConfig(${o.id}, 'MAX', ${cap})" ${isThisMax ? 'checked' : ''} style="accent-color: var(--accent, #8b5cf6); margin: 0;">
                            <span>Config 1: Max [${cap} pcs]</span>
                        </label>
                    </div>`;
                });
                
                configCell = `
                    <td style="font-size: 11px; color: var(--fg-muted, #a1a1aa);">
                        ${selectHtml}
                        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border, #27272a);">${o.configUsed}</div>
                    </td>
                `;
            }

            return `
            <tr>
                <td style="font-family: monospace; font-weight: 600;">${o.code}</td>
                <td>${o.description}</td>
                <td style="text-align: right; font-weight: 600;">${o.orderQty}</td>
                <td style="text-align: right; color: var(--accent, #8b5cf6); font-weight: 700;">${o.palletQty}</td>
                <td style="text-align: right; color: ${o.looseQty > 0 ? '#f59e0b' : 'inherit'}; font-weight: 600;">${o.looseQty}</td>
                ${configCell}
                <td style="text-align: center;">
                    <button onclick="plannerEngine.removeOrder(${o.id})" style="background:none; border:none; color: #ef4444; cursor:pointer; padding: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    }
    
    simulatePacking() {
        // Prepare palletsToPlace
        let palletsToPlace = [];
        this.orders.forEach(o => {
            let remainingQty = o.orderQty;
            const palletsList = o.palletsList || Array(o.palletQty).fill(o.selectedCap || 16);
            
            let pType = (o.type || "").toUpperCase();
            let pLength = o.length;
            let pWidth = o.width;
            let pCartonL = o.cartonL;
            let pCartonW = o.cartonW;
            
            if (pType === 'TV DISPLAY') {
                // If the user uploaded specific carton dims, but no pallet dims, auto-calculate them
                // Otherwise use the inch fallback for cartons
                let sizeStr = o.description || o.code || "";
                let inch = 50;
                let match = sizeStr.match(/-(\d{2,3})/);
                if (!match) match = sizeStr.match(/(\d{2,3})/);
                if (match) inch = parseInt(match[1]);
                
                if (!pCartonL) pCartonL = inch * 2.5;
                if (!pCartonW) pCartonW = 20;
                
                // CRITICAL FIX: TVs often overhang standard pallets, or their base pallet expands.
                // If there's no explicitly set pallet dimension in the master data, dynamically expand the wooden base
                // to fit the carton to prevent 3D clipping.
                // If the user DID set a pallet dimension, trust it completely.
                let hasExplicitL = o.palletL || o.length;
                let hasExplicitW = o.palletW || o.width;
                if (!hasExplicitL) pLength = Math.max(110, pCartonL);
                if (!hasExplicitW) pWidth = Math.max(110, pCartonW);
            }

            palletsList.forEach(cap => {
                let qtyInThisPallet = Math.min(remainingQty, cap);
                if (qtyInThisPallet <= 0) qtyInThisPallet = cap;
                remainingQty -= cap;
                palletsToPlace.push({
                    type: pType,
                    code: o.code,
                    description: o.description,
                    inv: o.inv,
                    qty: qtyInThisPallet,
                    length: pLength,
                    width: pWidth,
                    cartonL: pCartonL,
                    cartonW: pCartonW,
                    cartonH: o.cartonH,
                    tie: o.tie,
                    high: o.high,
                    rawCaps: o.rawCaps || [],
                    selectedCap: cap,
                    strategy: o.strategy,
                    rotated: false
                });
            });
        });
        
        if (this.calculatedMixedPallets && this.calculatedMixedPallets.length > 0) {
            this.calculatedMixedPallets.forEach(mp => {
                let mixedDesc = "Mixed: " + mp.items.map(i => i.qty + "x " + (i.description || i.code)).join(' | ');
                
                if (mp.isTvMixed) {
                    const tvItems = mp.items.filter(i => i.type === 'TV DISPLAY');
                    const otherItems = mp.items.filter(i => i.type !== 'TV DISPLAY');
                    
                    // CRITICAL FIX: If the "Mixed" TV pallet actually only contains a single SKU of TV
                    // and nothing else, treat it as a standard block-packed pallet so it respects Tie/High!
                    if (tvItems.length === 1 && otherItems.length === 0) {
                        let tv = tvItems[0];
                        
                        let l = tv.length || tv.palletL || tv.cartonL;
                        let w = tv.width || tv.palletW || tv.cartonW; 
                        let cL = tv.cartonL;
                        let cW = tv.cartonW;
                        
                        // Always calculate carton dims if missing
                        let sizeStr = tv.description || tv.code || "";
                        let inch = 50;
                        let match = sizeStr.match(/-(\d{2,3})/);
                        if (!match) match = sizeStr.match(/(\d{2,3})/);
                        if (match) inch = parseInt(match[1]);
                        
                        if (!cL) cL = inch * 2.5;
                        if (!cW) cW = 20;
                        
                        tv.cartonL = cL;
                        tv.cartonW = cW;
                        
                        let hasExplicitL = tv.palletL || tv.length;
                        let hasExplicitW = tv.palletW || tv.width;
                        if (!hasExplicitL) l = Math.max(110, cL);
                        if (!hasExplicitW) w = Math.max(110, cW);

                        palletsToPlace.push({
                            type: tv.type,
                            code: tv.code,
                            description: tv.description,
                            inv: tv.inv,
                            qty: tv.qty,
                            length: l,
                            width: w,
                            cartonL: tv.cartonL,
                            cartonW: tv.cartonW,
                            cartonH: tv.cartonH || tv.h,
                            tie: tv.tie,
                            high: tv.high,
                            isMixed: false,
                            isTvMixed: false,
                            fillPercent: mp.fillPercent,
                            rotated: false
                        });
                        return; // Skip the rest of the mixed logic
                    }
                    
                    let maxL = 0;
                    let maxW = 0;
                    
                    tvItems.forEach(tv => {
                        let l = tv.length || tv.palletL || tv.cartonL;
                        let w = tv.width || tv.palletW || tv.cartonW; 
                        let cL = tv.cartonL;
                        let cW = tv.cartonW;
                        
                        if (!l || !w) {
                            let sizeStr = tv.description || tv.code || "";
                            let inch = 50;
                            let match = sizeStr.match(/-(\d{2,3})/);
                            if (!match) match = sizeStr.match(/(\d{2,3})/);
                            if (match) inch = parseInt(match[1]);
                            
                            if (!cL) cL = inch * 2.5;
                            if (!cW) cW = 20;
                            if (!l) l = cL;
                            if (!w) w = 120;
                        }
                        
                        if (l > maxL) maxL = l;
                        if (w > maxW) maxW = w;
                    });
                    
                    palletsToPlace.push({
                        type: "MIXED TV PALLET",
                        code: "MIXED TV",
                        description: mixedDesc,
                        invs: [...new Set([...tvItems, ...otherItems].map(i => i.inv).filter(Boolean))],
                        qty: mp.items.reduce((sum, item) => sum + item.qty, 0),
                        isMixed: true,
                        isTvMixed: true,
                        tvItems: tvItems,
                        otherItems: otherItems,
                        length: maxL,
                        width: maxW,
                        fillPercent: mp.fillPercent,
                        rotated: false
                    });
                } else if (mp.isHifiPartial) {
                    const item = mp.items[0];
                    palletsToPlace.push({
                        type: item.type,
                        code: item.code,
                        description: item.description,
                        inv: item.inv,
                        invs: item.inv ? item.inv.split(',').map(s=>s.trim()) : [],
                        qty: item.qty,
                        length: item.length,
                        width: item.width,
                        cartonL: item.cartonL,
                        cartonW: item.cartonW,
                        cartonH: item.cartonH || item.h,
                        tie: item.tie,
                        high: item.high,
                        rawCaps: item.rawCaps || [],
                        selectedCap: item.selectedCap,
                        strategy: item.strategy,
                        isMixed: false,
                        isTvMixed: false,
                        isSmallMixed: false,
                        fillPercent: mp.fillPercent,
                        rotated: false
                    });
                } else {
                    palletsToPlace.push({
                        type: mp.isSmallMixed ? "SMALL ITEM PALLET" : "MIXED PALLET",
                        code: mp.isSmallMixed ? "MIXED SMALL" : "MIXED",
                        description: mp.isSmallMixed ? "Small item | " + mixedDesc : mixedDesc,
                        invs: [...new Set((mp.items || []).map(i => i.inv).filter(Boolean))],
                        qty: mp.items.reduce((sum, item) => sum + item.qty, 0),
                        isMixed: true,
                        isTvMixed: false,
                        isSmallMixed: mp.isSmallMixed,
                        items: mp.items,
                        unitM3: mp.unitM3,
                        fillPercent: mp.fillPercent,
                        length: mp.length || null,
                        width: mp.width || null,
                        rotated: false
                    });
                }
            });
        }
        
        palletsToPlace.sort((a, b) => {
            const isAtv = a.type === 'TV DISPLAY' || a.type === 'HIFI' || a.isTvMixed;
            const isBtv = b.type === 'TV DISPLAY' || b.type === 'HIFI' || b.isTvMixed;

            if (isAtv && !isBtv) return -1;
            if (!isAtv && isBtv) return 1;

            if (isAtv && isBtv) {
                let areaA = (a.length || a.cartonL || 0) * (a.width || a.cartonW || 0);
                let areaB = (b.length || b.cartonL || 0) * (b.width || b.cartonW || 0);
                return areaB - areaA; // Biggest first
            }

            return 0;
        });

        // Simulate layout dynamically based on selected container size
        const spec = CONTAINER_SPECS[this.selectedTruckType] || CONTAINER_SPECS['40HC'];
        const truckL = spec.lengthFt; 
        const truckW = spec.widthFt;
        const palletW = (truckW / 2) - 0.4;
        const palletL = (truckL / spec.defaultRows) - 0.4;

        let currentZ = -(truckL / 2) + 0.2;
        let currentX = -(truckW / 2) + 0.2;
        let maxLInRow = 0;
        
        let overflowDOs = new Set();
        let overflowPallets = [];
        
        palletsToPlace.forEach(p => {
            const baseW = p.width ? (p.width / 30.48) : palletW;
            const baseL = p.length ? (p.length / 30.48) : palletL;
            
            const w = p.rotated ? baseL : baseW;
            const l = p.rotated ? baseW : baseL;
            
            if (currentX + w > (truckW / 2) - 0.2 && currentX > -(truckW / 2) + 0.2) {
                currentX = -(truckW / 2) + 0.2;
                currentZ += maxLInRow + 0.2;
                maxLInRow = 0;
            }
            
            if (l > maxLInRow) maxLInRow = l;
            
            if (currentZ + l > (truckL / 2)) {
                if (p.inv && p.inv !== "MANUAL") {
                    if (Array.isArray(p.inv)) {
                        p.inv.forEach(i => overflowDOs.add(i));
                    } else {
                        overflowDOs.add(p.inv);
                    }
                }
                if (p.invs) {
                    p.invs.forEach(inv => {
                        if (inv !== "MANUAL") overflowDOs.add(inv);
                    });
                }
                overflowPallets.push(p);
            }
            currentX += w + 0.2;
        });
        
        return { overflowDOs, palletsToPlace, overflowPallets };
    }

        generateOverflowHtml(overflowDOs, overflowPallets) {
        let fullPalletsObj = {};
        let mixedLooseObj = {};
        
        (overflowPallets || []).forEach(p => {
            if (!p.isMixed && !p.isTvMixed && !p.isSmallMixed) {
                let key = p.code || 'UNKNOWN';
                if (!fullPalletsObj[key]) fullPalletsObj[key] = { desc: p.description, pCount: 0, qty: 0 };
                fullPalletsObj[key].pCount += 1;
                fullPalletsObj[key].qty += (p.qty || 0);
            } else {
                const processItems = (items) => {
                    if (!items) return;
                    items.forEach(it => {
                        let key = it.code || 'UNKNOWN';
                        if (!mixedLooseObj[key]) mixedLooseObj[key] = { desc: it.description, qty: 0 };
                        mixedLooseObj[key].qty += (it.qty || 0);
                    });
                };
                processItems(p.items);
                processItems(p.tvItems);
                processItems(p.otherItems);
            }
        });
        
        let doListHtml = overflowDOs.size > 0 
            ? `<div style="margin-bottom: 12px;"><strong>By DO Number:</strong> Remove DO <span id="overflow-do-list-span" style="color: #ef4444; font-weight: bold; font-size: 14px;">${Array.from(overflowDOs).join(', ')}</span></div>` 
            : `<span id="overflow-do-list-span" style="display:none;"></span>`;
            
        let priorityCuts = Object.keys(fullPalletsObj).map(k => `<li style="margin-bottom: 4px;"><strong style="color: #ef4444;">Priority Cut:</strong> ${k} (Qty: ${fullPalletsObj[k].qty}) - <em style="color:var(--fg-muted)">${fullPalletsObj[k].pCount} Full Pallet(s)</em></li>`).join('');
        let secondaryCuts = Object.keys(mixedLooseObj).map(k => `<li style="margin-bottom: 4px;"><strong style="color: #f59e0b;">Secondary Cut:</strong> ${k} (Qty: ${mixedLooseObj[k].qty}) - <em style="color:var(--fg-muted)">Loose Items</em></li>`).join('');
        
        let modelListHtml = '';
        if (priorityCuts || secondaryCuts) {
            modelListHtml = `<div><strong>By Model:</strong><ul style="margin-top: 6px; margin-bottom: 0; padding-left: 20px;">${priorityCuts}${secondaryCuts}</ul></div>`;
        }
        
        let detailedHtml = `
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 16px;">
                <h4 style="color: #ef4444; margin-top: 0; margin-bottom: 8px; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Capacity Exceeded
                </h4>
                <p style="font-size: 13px; color: var(--fg); margin-bottom: 12px;">The following items are located at the very back of the truck and are physically overflowing past the container doors.</p>
                <div style="font-size: 13px; font-weight: 600; color: #ef4444; margin-bottom: 8px;">Action Recommended:</div>
                <div style="font-size: 13px; color: var(--fg); background: rgba(0,0,0,0.2); padding: 12px; border-radius: 4px; font-family: monospace;">
                    ${doListHtml}
                    ${modelListHtml}
                </div>
            </div>
        `;
        
        let shortTextParts = [];
        if (overflowDOs.size > 0) shortTextParts.push(`DO: ${Array.from(overflowDOs).join(', ')}`);
        let shortModelParts = [];
        Object.keys(fullPalletsObj).forEach(k => shortModelParts.push(`${fullPalletsObj[k].pCount}x ${k} (Full)`));
        Object.keys(mixedLooseObj).forEach(k => shortModelParts.push(`${mixedLooseObj[k].qty}x ${k} (Loose)`));
        if (shortModelParts.length > 0) shortTextParts.push(`Models: ${shortModelParts.join(', ')}`);
        
        let shortText = shortTextParts.join(' | ');
        if (!shortText) shortText = 'Unknown models';
        
        return { detailedHtml, shortText };
    }


    renderDashboard() {
        this.isPalletsDirty = true;
        let container = document.getElementById("dashboardContainer");
        if (!container) return;
        
        if (this.orders.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
        container.style.gap = '24px';
        
        const spec = CONTAINER_SPECS[this.selectedTruckType] || CONTAINER_SPECS['40HC'];
        const basePalletCapacity = spec.defaultRows * 2; // 16 for 40HC, 8 for 20GP
        
        let totalPallets = 0;
        let strictLooseItems = [];
        let totalVolumePercent = 0;
        let hasVolumeData = false;
        let missingMaxPallets = [];
        
        this.orders.forEach(o => {
            totalPallets += o.palletQty;
            if (o.strictLooseQty > 0) {
                strictLooseItems.push(o);
            }
            
            // Calculate Volume Percentage based on type and maxPallet adapted to container size
            if (o.palletQty > 0) {
                let effectiveMax = basePalletCapacity;
                let itemType = (o.type || "").toUpperCase();
                
                if (itemType === 'TV DISPLAY') {
                    if (o.maxPallet) {
                        effectiveMax = Math.max(1, Math.round(o.maxPallet * (spec.lengthFt / 40)));
                    } else {
                        effectiveMax = basePalletCapacity; // default 16 (40ft) or 8 (20ft) if missing
                        if (!missingMaxPallets.includes(o.code)) {
                            missingMaxPallets.push(o.code);
                        }
                    }
                } else {
                    effectiveMax = basePalletCapacity; // default for Hifi and others
                }
                
                totalVolumePercent += (o.palletQty / effectiveMax) * 100;
                hasVolumeData = true;
            }
        });
        
        totalVolumePercent = parseFloat(totalVolumePercent.toFixed(1));
        
        let volumeColor = "var(--accent)";
        let volumeWarning = "";
        
        if (totalVolumePercent >= 90) {
            volumeColor = "#ef4444"; // red
            const volumeIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
            volumeWarning = `<div style="color: #ef4444; font-size: 13px; margin-top: 12px; font-weight: 600; display:flex; align-items:center; gap: 6px; background: rgba(239, 68, 68, 0.1); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
                                ${volumeIcon}
                                <span>OVERFLOW RISK: Truck capacity exceeded!</span>
                             </div>`;
        }
        
        let masterDataWarning = ``;

        let mixedPallets = [];
        let hifiPartialPallets = [];
        
        if (strictLooseItems.length > 0) {
            let smallItems = strictLooseItems.filter(i => (i.type || "").toLowerCase() === 'small').map(item => ({...item}));
            let tvLooseItems = strictLooseItems.filter(i => i.type === 'TV DISPLAY' && (i.type || "").toLowerCase() !== 'small').map(item => ({...item}));
            let otherLooseItems = strictLooseItems.filter(i => i.type !== 'TV DISPLAY' && (i.type || "").toLowerCase() !== 'small').map(item => ({...item}));
            
            // --- NEW RULE: Process HIFI Partial Pallets (>= 50% capacity) ---
            // Merge identical HIFI SKUs first, ignoring the DO number.
            let remainingOtherLooseItems = [];
            let hifiGrouped = {};
            
            for (let item of otherLooseItems) {
                let pType = (item.type || "").toUpperCase();
                if (pType === 'HIFI' || pType === 'HIFI AUDIO') {
                    if (!hifiGrouped[item.code]) {
                        hifiGrouped[item.code] = { ...item };
                    } else {
                        hifiGrouped[item.code].strictLooseQty += item.strictLooseQty;
                        // Merge DO numbers
                        let existingDOs = hifiGrouped[item.code].inv.split(",").map(s => s.trim());
                        let newDOs = (item.inv || "").split(",").map(s => s.trim());
                        hifiGrouped[item.code].inv = [...new Set([...existingDOs, ...newDOs])].filter(Boolean).join(", ");
                    }
                } else {
                    remainingOtherLooseItems.push(item);
                }
            }
            
            for (let key in hifiGrouped) {
                let item = hifiGrouped[key];
                let baseCap = (item.rawCaps && item.rawCaps.length > 0) ? item.rawCaps[item.rawCaps.length - 1] : 1;
                
                let totalQty = item.strictLooseQty;
                
                // If merging pushed the loose quantity over a full pallet's capacity, extract full pallets first!
                while (totalQty >= baseCap && baseCap > 0) {
                    hifiPartialPallets.push({
                        type: item.type,
                        code: item.code,
                        description: item.description + " (Merged Full)",
                        inv: item.inv,
                        qty: baseCap,
                        length: item.length || item.palletL || item.cartonL || 120,
                        width: item.width || item.palletW || item.cartonW || 120,
                        cartonL: item.cartonL,
                        cartonW: item.cartonW,
                        cartonH: item.cartonH || item.h,
                        tie: item.tie,
                        high: item.high,
                        rawCaps: item.rawCaps || [],
                        selectedCap: baseCap,
                        strategy: item.strategy,
                        isMixed: false,
                        isTvMixed: false,
                        isSmallMixed: false,
                        fillPercent: 1.0,
                        rotated: false
                    });
                    totalQty -= baseCap;
                }
                
                if (totalQty > 0) {
                    let fillRatio = totalQty / baseCap;
                    
                    if (fillRatio >= 0.5) {
                        // Create a strict single-SKU partial pallet
                        hifiPartialPallets.push({
                            type: item.type,
                            code: item.code,
                            description: item.description + " (Partial)",
                            inv: item.inv,
                            qty: totalQty,
                            length: item.length || item.palletL || item.cartonL || 120,
                            width: item.width || item.palletW || item.cartonW || 120,
                            cartonL: item.cartonL,
                            cartonW: item.cartonW,
                            cartonH: item.cartonH || item.h,
                            tie: item.tie,
                            high: item.high,
                            rawCaps: item.rawCaps || [],
                            selectedCap: baseCap,
                            strategy: item.strategy,
                            isMixed: false,
                            isTvMixed: false,
                            isSmallMixed: false,
                            fillPercent: fillRatio,
                            rotated: false
                        });
                    } else {
                        // Less than 50%, goes to normal mixed/top-up logic
                        item.strictLooseQty = totalQty; // Update the qty before sending to mixed pool
                        remainingOtherLooseItems.push(item);
                    }
                }
            }
            // Re-assign the array so the rest of the mixed logic only processes what's left
            otherLooseItems = remainingOtherLooseItems;

            // --- 0. Process Small Items into Pallets (Two-Path Logic: DO Level) ---
            const MAX_SMALL_PALLET_VOLUME = 1.3;
            
            const smallItemsByDO = {};
            for (let item of smallItems) {
                const inv = item.inv || "MANUAL";
                if (!smallItemsByDO[inv]) {
                    smallItemsByDO[inv] = { items: [], totalVolume: 0 };
                }
                smallItemsByDO[inv].items.push(item);
                let m3PerItem = item.m3 || 0.05;
                smallItemsByDO[inv].totalVolume += (item.strictLooseQty * m3PerItem);
            }

            const largeDOs = [];
            const smallDOs = [];

            for (const [inv, data] of Object.entries(smallItemsByDO)) {
                if (data.totalVolume > MAX_SMALL_PALLET_VOLUME) {
                    largeDOs.push({ inv, items: data.items, totalVolume: data.totalVolume });
                } else {
                    smallDOs.push({ inv, items: data.items, totalVolume: data.totalVolume });
                }
            }

            // --- SMART SORTING: Group Small DOs by Dominant Model ---
            smallDOs.forEach(doData => {
                let maxVol = -1;
                let domModel = "";
                doData.items.forEach(item => {
                    let vol = item.strictLooseQty * (item.m3 || 0.05);
                    if (vol > maxVol) {
                        maxVol = vol;
                        domModel = item.code || "";
                    }
                });
                doData.dominantModel = domModel;
            });
            
            // Sort alphabetically by dominant model so similar DOs are packed sequentially
            smallDOs.sort((a, b) => a.dominantModel.localeCompare(b.dominantModel));
            // --------------------------------------------------------

            // Path A: Large DOs (> MAX_SMALL_PALLET_VOLUME). Exclusive pallets, item splitting allowed to fill pallets.
            for (const doData of largeDOs) {
                let currentSmallPalletItems = [];
                let currentSmallVolume = 0;
                let currentSmallRoutes = new Set();
                
                const flushSmallPallet = () => {
                    if (currentSmallPalletItems.length > 0) {
                        let desc = `Consolidated Pallet (DO: ${doData.inv})`;
                        
                        let pLen = currentSmallPalletItems[0].length || 110;
                        let pWid = currentSmallPalletItems[0].width || 110;
                            
                        mixedPallets.push({ 
                            isSmallMixed: true, 
                            isTvMixed: false,
                            description: desc,
                            items: currentSmallPalletItems,
                            fillPercent: Math.min(1.0, currentSmallVolume / MAX_SMALL_PALLET_VOLUME),
                            unitM3: currentSmallVolume,
                            length: pLen,
                            width: pWid
                        });
                        currentSmallPalletItems = [];
                        currentSmallVolume = 0;
                        currentSmallRoutes = new Set();
                    }
                };

                for (let item of doData.items) {
                    let qtyRemaining = item.strictLooseQty;
                    let m3PerItem = item.m3 || 0.05;
                    let route = item.route || "UNASSIGNED";
                    
                    while (qtyRemaining > 0) {
                        let availableVol = MAX_SMALL_PALLET_VOLUME - currentSmallVolume;
                        let qtyCanFit = Math.floor(availableVol / m3PerItem);
                        
                        if (qtyCanFit <= 0 && currentSmallVolume > 0) {
                            flushSmallPallet();
                            continue;
                        }
                        
                        if (qtyCanFit === 0) qtyCanFit = 1;
                        
                        let qtyToPlace = Math.min(qtyRemaining, qtyCanFit);
                        
                        // Group similar items in the pallet
                        let existing = currentSmallPalletItems.find(i => i.code === item.code);
                        if (existing) {
                            existing.qty += qtyToPlace;
                        } else {
                            currentSmallPalletItems.push({ 
                                code: item.code, 
                                description: item.description, 
                                qty: qtyToPlace,
                                type: item.type || 'SMALL',
                                length: item.length,
                                width: item.width,
                                inv: item.inv || doData.inv
                            });
                        }
                        
                        currentSmallVolume += (qtyToPlace * m3PerItem);
                        currentSmallRoutes.add(route);
                        
                        qtyRemaining -= qtyToPlace;
                        
                        if (currentSmallVolume >= (MAX_SMALL_PALLET_VOLUME - 0.02)) {
                            flushSmallPallet();
                        }
                    }
                }
                flushSmallPallet(); // Close tail end exclusively
            }

            // Path B: Small DOs (<= MAX_SMALL_PALLET_VOLUME). Mixed pallets allowed (Choice A). DOs are never split.
            let currentMixedPalletItems = [];
            let currentMixedVolume = 0;
            let currentMixedDOs = new Set();
            
            const flushMixedPallet = () => {
                if (currentMixedPalletItems.length > 0) {
                    let doArr = Array.from(currentMixedDOs);
                    // Build a string that lists the DOs, truncated if too long
                    let doString = doArr.join(', ');
                    if (doString.length > 30) doString = doString.substring(0, 27) + '...';
                    
                    let desc = `Mixed DOs (${doString})`;
                    
                    let pLen = currentMixedPalletItems[0].length || 110;
                    let pWid = currentMixedPalletItems[0].width || 110;
                    
                    mixedPallets.push({ 
                        isSmallMixed: true, 
                        isTvMixed: false,
                        description: desc,
                        items: currentMixedPalletItems,
                        fillPercent: Math.min(1.0, currentMixedVolume / MAX_SMALL_PALLET_VOLUME),
                        unitM3: currentMixedVolume,
                        length: pLen,
                        width: pWid
                    });
                    
                    currentMixedPalletItems = [];
                    currentMixedVolume = 0;
                    currentMixedDOs = new Set();
                }
            };

            for (const doData of smallDOs) {
                // If adding this entire DO exceeds max volume, flush the current pallet first
                if (currentMixedVolume > 0 && (currentMixedVolume + doData.totalVolume > MAX_SMALL_PALLET_VOLUME)) {
                    flushMixedPallet();
                }

                // Now add the entire DO to the current pallet (no splitting!)
                for (let item of doData.items) {
                    let qtyToPlace = item.strictLooseQty;
                    let m3PerItem = item.m3 || 0.05;
                    
                    let existing = currentMixedPalletItems.find(i => i.code === item.code);
                    if (existing) {
                        existing.qty += qtyToPlace;
                    } else {
                        currentMixedPalletItems.push({ 
                            code: item.code, 
                            description: item.description, 
                            qty: qtyToPlace,
                            type: item.type || 'SMALL',
                            length: item.length,
                            width: item.width,
                            inv: item.inv || doData.inv
                        });
                    }
                }
                currentMixedVolume += doData.totalVolume;
                currentMixedDOs.add(doData.inv);
            }
            flushMixedPallet();

            
            // --- 1. Process TV Loose Items into Dedicated Mixed TV Pallets ---
            // NEW RULE: Merge identical TVs by DESCRIPTION first, so different SKUs with the same size/description group together
            let tvGrouped = {};
            for (let item of tvLooseItems) {
                // Use description as the grouping key. Fallback to code if description is missing.
                let groupKey = item.description || item.code;
                
                if (!tvGrouped[groupKey]) {
                    tvGrouped[groupKey] = { ...item };
                } else {
                    tvGrouped[groupKey].strictLooseQty += item.strictLooseQty;
                    let existingDOs = (tvGrouped[groupKey].inv || "").split(",").map(s => s.trim());
                    let newDOs = (item.inv || "").split(",").map(s => s.trim());
                    tvGrouped[groupKey].inv = [...new Set([...existingDOs, ...newDOs])].filter(Boolean).join(", ");
                    // Optional: append the extra SKU code so it's visible they were merged
                    if (!tvGrouped[groupKey].code.includes(item.code)) {
                        tvGrouped[groupKey].code += " / " + item.code;
                    }
                }
            }
            
            tvLooseItems = Object.values(tvGrouped);
            
            // Sort by capacity so similar sized TVs are near each other if mixing is required
            tvLooseItems.sort((a, b) => {
                let capA = (a.rawCaps && a.rawCaps.length > 0) ? a.rawCaps[a.rawCaps.length - 1] : 1;
                let capB = (b.rawCaps && b.rawCaps.length > 0) ? b.rawCaps[b.rawCaps.length - 1] : 1;
                return capA - capB;
            });
            
            let currentTvPallet = [];
            let currentTvPercentage = 0;
            let currentTvWidthAccum = 0;
            
            // NEW PASS 1: Extract full pure pallets for identical TV sizes first
            let tvRemainders = [];
            for (let item of tvLooseItems) {
                let baseCap = (item.rawCaps && item.rawCaps.length > 0) ? item.rawCaps[item.rawCaps.length - 1] : 1;
                let remainingQty = item.strictLooseQty;
                
                while (remainingQty >= baseCap) {
                    let pureItem = { ...item, qty: baseCap };
                    mixedPallets.push({ isTvMixed: true, items: [pureItem], fillPercent: 1.0 });
                    remainingQty -= baseCap;
                }
                
                if (remainingQty > 0) {
                    let remainderItem = { ...item, strictLooseQty: remainingQty };
                    tvRemainders.push(remainderItem);
                }
            }
            
            // PASS 2: Mix the remainders
            for (let item of tvRemainders) {
                let baseCap = (item.rawCaps && item.rawCaps.length > 0) ? item.rawCaps[item.rawCaps.length - 1] : 1;
                let percentPerItem = 1.0 / baseCap;
                
                // Estimate item thickness to match 3D rendering
                let itemW_cm = item.cartonW;
                if (!itemW_cm) {
                    if (item.tie && !isNaN(item.tie) && item.tie > 0) {
                        let bCols = item.tie > 12 ? Math.ceil(item.tie / 2) : item.tie;
                        let pW_check = item.width || item.palletW || 120;
                        itemW_cm = pW_check / bCols;
                    } else {
                        itemW_cm = 20; // 3D fallback for TVs without tie/width
                    }
                }
                let itemW = itemW_cm / 30.48; // convert to feet
                
                let remainingQty = item.strictLooseQty;
                while (remainingQty > 0) {
                    let exceedFraction = currentTvPercentage + percentPerItem > 1.05;
                    let requiresNewRow = currentTvWidthAccum + itemW > 3.65; // Max pallet width is ~3.6ft
                
                // RELAXATION: If we are adding a small item (e.g. 32" TV) to an existing pallet
                if (currentTvPallet.length > 0 && percentPerItem < 0.15) {
                    exceedFraction = currentTvPercentage + percentPerItem > 1.15; // Allow 15% overflow for small filler items
                    if (requiresNewRow) {
                        requiresNewRow = currentTvWidthAccum + itemW > 4.5; // Allow extra width (squeezing) before wrapping
                    }
                }
                
                if (exceedFraction && currentTvPallet.length > 0) {
                    // Pallet is completely full based on Master Data capacity
                    mixedPallets.push({ isTvMixed: true, items: currentTvPallet, fillPercent: currentTvPercentage });
                    currentTvPallet = [];
                    currentTvPercentage = 0;
                    currentTvWidthAccum = 0;
                } else if (requiresNewRow && currentTvPallet.length > 0) {
                    // Pallet is NOT full yet, but the front row is full. 
                    // Wrap to a new row on the SAME pallet!
                    currentTvWidthAccum = 0;
                }
                    
                    let existingInPallet = currentTvPallet.find(i => i.code === item.code);
                    if (existingInPallet) {
                        existingInPallet.qty += 1;
                    } else {
                        currentTvPallet.push({ ...item, qty: 1 }); // Push full item info for 3D size rendering
                    }
                    
                    currentTvPercentage += percentPerItem;
                    currentTvWidthAccum += itemW;
                    remainingQty -= 1;
                }
            }
            if (currentTvPallet.length > 0) {
                mixedPallets.push({ isTvMixed: true, items: currentTvPallet, fillPercent: currentTvPercentage });
            }
            
            // --- 2. Process Other Loose Items (Top-Up TVs, then new mixed pallets) ---
            otherLooseItems.sort((a, b) => {
                let capA = (a.rawCaps && a.rawCaps.length > 0) ? a.rawCaps[a.rawCaps.length - 1] : 1;
                let capB = (b.rawCaps && b.rawCaps.length > 0) ? b.rawCaps[b.rawCaps.length - 1] : 1;
                return capA - capB;
            });
            
            let currentMixedPallet = [];
            let currentMixedPercentage = 0;
            
            for (let item of otherLooseItems) {
                let baseCap = (item.rawCaps && item.rawCaps.length > 0) ? item.rawCaps[item.rawCaps.length - 1] : 1;
                let percentPerItem = 1.0 / baseCap;
                
                let remainingQty = item.strictLooseQty;
                while (remainingQty > 0) {
                    // Try to top-up an existing TV mixed pallet first
                    let toppedUp = false;
                    for (let mp of mixedPallets) {
                        let maxFill = 1.05;
                        if (percentPerItem < 0.15) maxFill = 1.15;
                        
                        // Only allow top-up if the TV pallet physically only has 1 layer based on current quantity
                        let isSingleLayer = mp.items.every(i => {
                            let tie = i.tie ? parseInt(i.tie) : null;
                            if (tie && tie > 0) {
                                return Math.ceil(i.qty / tie) <= 1; // True if qty fits purely in the first layer
                            }
                            return !i.high || parseInt(i.high) <= 1; // Fallback to master data if tie is unknown
                        });
                        if (mp.isTvMixed && isSingleLayer && (mp.fillPercent + percentPerItem <= maxFill)) {
                            let existingInPallet = mp.items.find(i => i.code === item.code);
                            if (existingInPallet) {
                                existingInPallet.qty += 1;
                            } else {
                                mp.items.push({ ...item, qty: 1 });
                            }
                            mp.fillPercent += percentPerItem;
                            remainingQty -= 1;
                            toppedUp = true;
                            break;
                        }
                    }
                    if (toppedUp) continue;
                    
                    // If no TV pallet can take it, add to regular mixed pallet
                    if (currentMixedPercentage + percentPerItem > 1.05 && currentMixedPallet.length > 0) {
                        mixedPallets.push({ isTvMixed: false, items: currentMixedPallet, fillPercent: currentMixedPercentage });
                        currentMixedPallet = [];
                        currentMixedPercentage = 0;
                    }
                    
                    let existingInPallet = currentMixedPallet.find(i => i.code === item.code);
                    if (existingInPallet) {
                        existingInPallet.qty += 1;
                    } else {
                        currentMixedPallet.push({ ...item, qty: 1 });
                    }
                    
                    currentMixedPercentage += percentPerItem;
                    remainingQty -= 1;
                }
            }
            if (currentMixedPallet.length > 0) {
                mixedPallets.push({ isTvMixed: false, items: currentMixedPallet, fillPercent: currentMixedPercentage });
            }
        }
        
        // Add the HIFI partial pallets directly to the list of mixedPallets so they get pushed to the truck
        if(hifiPartialPallets.length > 0){
            hifiPartialPallets.forEach(pallet => {
                 mixedPallets.push({
                     isTvMixed: false,
                     isSmallMixed: false,
                     isHifiPartial: true,
                     items: [{...pallet}],
                     fillPercent: pallet.fillPercent,
                     length: pallet.length,
                     width: pallet.width
                 });
            });
        }
        
        // Add mixed pallets to the total pallets count
        this.calculatedMixedPallets = mixedPallets;
        totalPallets += mixedPallets.length;
        
        // Add mixed pallet volume back to totalVolumePercent
        totalVolumePercent += (mixedPallets.length / basePalletCapacity) * 100;
        
        // Re-calculate color and warning since totalVolumePercent changed
        volumeColor = "var(--accent)";
        volumeWarning = "";
        if (totalVolumePercent >= 90) {
            volumeColor = "#ef4444";
            const volumeIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
            volumeWarning = `<div style="color: #ef4444; font-size: 13px; margin-top: 12px; font-weight: 600; display:flex; align-items:center; gap: 6px; background: rgba(239, 68, 68, 0.1); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
                                ${volumeIcon}
                                <span>OVERFLOW RISK: Truck capacity exceeded!</span>
                             </div>`;
        }

        
        let mixedPalletsHtml = '';
        const simResult = this.simulatePacking();
        const overflowDOs = simResult.overflowDOs;
        const overflowPallets = simResult.overflowPallets;
        
        let totalSmallM3 = 0;
        let totalTvHifiM3 = 0;
        
        this.orders.forEach(o => {
            let t = (o.type || "").toUpperCase();
            let qty = o.orderQty || 0;
            let vol = o.m3 || 0;
            if (vol === 0) {
                let l = o.cartonL || 0;
                let w = o.cartonW || 0;
                let h = o.cartonH || 0;
                vol = (l * w * h) / 1000000;
            }
            
            let totalM3 = vol * qty;
            
            if (t === 'SMALL') {
                totalSmallM3 += totalM3;
            } else if (t === 'TV DISPLAY' || t === 'HIFI') {
                totalTvHifiM3 += totalM3;
            }
        });
        
        let showTabs = true;

        if (showTabs) {
            let hasOverflow = overflowDOs.size > 0 || (simResult.overflowPallets && simResult.overflowPallets.length > 0);
            
            let overflowDetailsHtml = '';
            if (hasOverflow) {
                const generated = this.generateOverflowHtml(overflowDOs, simResult.overflowPallets);
                overflowDetailsHtml = generated.detailedHtml;
            }
            
            mixedPalletsHtml = `
            <div class="table-card" style="padding: 24px; margin-top: 24px;">
                <div style="display: flex; gap: 16px; border-bottom: 1px solid var(--border); margin-bottom: 16px;">
                    <button id="tab-mixed-pallets" onclick="
                        document.getElementById('content-mixed-pallets').style.display='block'; 
                        document.getElementById('content-overflow-recs').style.display='none'; 
                        document.getElementById('content-volume-summary').style.display='none'; 
                        this.style.borderBottom='2px solid var(--accent)'; 
                        this.style.color='var(--accent)'; 
                        document.getElementById('tab-overflow-recs').style.borderBottom='none'; 
                        document.getElementById('tab-overflow-recs').style.color='var(--fg-muted)';
                        document.getElementById('tab-volume-summary').style.borderBottom='none'; 
                        document.getElementById('tab-volume-summary').style.color='var(--fg-muted)';
                    " style="background: none; border: none; padding: 8px 16px; border-bottom: 2px solid var(--accent); color: var(--accent); cursor: pointer; font-weight: 600; font-size: 14px;">
                        Recommended Mixed Pallets
                    </button>
                    
                    <button id="tab-volume-summary" onclick="
                        document.getElementById('content-volume-summary').style.display='block'; 
                        document.getElementById('content-mixed-pallets').style.display='none'; 
                        document.getElementById('content-overflow-recs').style.display='none'; 
                        this.style.borderBottom='2px solid #3b82f6'; 
                        this.style.color='#3b82f6'; 
                        document.getElementById('tab-mixed-pallets').style.borderBottom='none'; 
                        document.getElementById('tab-mixed-pallets').style.color='var(--fg-muted)';
                        document.getElementById('tab-overflow-recs').style.borderBottom='none'; 
                        document.getElementById('tab-overflow-recs').style.color='var(--fg-muted)';
                    " style="background: none; border: none; padding: 8px 16px; color: var(--fg-muted); cursor: pointer; font-weight: 600; font-size: 14px;">
                        Volume Summary
                    </button>

                    <button id="tab-overflow-recs" onclick="
                        document.getElementById('content-overflow-recs').style.display='block'; 
                        document.getElementById('content-mixed-pallets').style.display='none'; 
                        document.getElementById('content-volume-summary').style.display='none'; 
                        this.style.borderBottom='2px solid #ef4444'; 
                        this.style.color='#ef4444'; 
                        document.getElementById('tab-mixed-pallets').style.borderBottom='none'; 
                        document.getElementById('tab-mixed-pallets').style.color='var(--fg-muted)';
                        document.getElementById('tab-volume-summary').style.borderBottom='none'; 
                        document.getElementById('tab-volume-summary').style.color='var(--fg-muted)';
                    " style="background: none; border: none; padding: 8px 16px; color: var(--fg-muted); cursor: pointer; font-weight: 600; font-size: 14px; display: ${hasOverflow ? 'block' : 'none'}">
                        Overflow Recommendations <span id="overflow-badge-span" style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 4px;">!</span>
                    </button>
                </div>
                
                <div id="content-mixed-pallets" style="display: block;">
                    ${mixedPallets.length === 0 ? '<div style="color: var(--fg-muted); font-size: 13px;">No mixed pallets generated.</div>' : `
                    <div class="compact-wrapper" style="max-height: 400px; overflow-y: auto;">
                        <table class="compact-table" style="width: 100%;">
                            <thead style="position: sticky; top: 0; background: var(--bg-card); z-index: 1;">
                                <tr>
                                    <th style="text-align: left; padding: 10px 12px; width: 60px;">PALLET</th>
                                    <th style="text-align: left; padding: 10px 12px;">MIXED CONTENTS</th>
                                    <th style="text-align: right; padding: 10px 12px; width: 80px;">FILL %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${mixedPallets.map((mp, index) => `
                                    <tr>
                                        <td style="font-family: monospace; font-weight: 700; padding: 12px; vertical-align: top;">#${index + 1}</td>
                                        <td style="padding: 12px; vertical-align: top;">
                                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                                ${mp.description ? `<div style="font-size: 11px; color: var(--accent); margin-bottom: 4px; font-weight: 600;">${mp.description}</div>` : ''}
                                                ${mp.items.map(i => `
                                                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: 4px;">
                                                        <div>
                                                            <span style="font-family: monospace; font-size: 12px; color: var(--fg);">${i.code}</span>
                                                            <span style="font-size: 11px; color: var(--fg-muted); margin-left: 6px;">${i.description}</span>
                                                        </div>
                                                        <span style="font-weight: 700; font-size: 13px; color: #10b981;">+${i.qty}</span>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </td>
                                        <td style="text-align: right; font-weight: 600; padding: 12px; vertical-align: top; color: ${mp.fillPercent > 1.0 ? '#ef4444' : '#10b981'};">
                                            ${Math.round(mp.fillPercent * 100)}%
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`}
                </div>
                
                <div id="content-overflow-recs" style="display: none;">
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 16px;">
                        <h4 style="color: #ef4444; margin-top: 0; margin-bottom: 8px; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            Capacity Exceeded
                        </h4>
${overflowDetailsHtml}
                    </div>
                </div>

                <div id="content-volume-summary" style="display: none;">
                    <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 16px;">
                        <h4 style="color: #3b82f6; margin-top: 0; margin-bottom: 16px; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                            Total Volume Details
                        </h4>
                        
                        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 16px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 12px; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 8px;">Small Items (CBM)</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--fg); font-family: monospace;">${totalSmallM3.toFixed(3)} <span style="font-size: 14px; color: var(--fg-muted);">m³</span></div>
                            </div>
                            
                            <div style="flex: 1; min-width: 200px; background: rgba(212, 180, 131, 0.1); border: 1px solid rgba(212, 180, 131, 0.2); padding: 16px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 12px; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 8px;">TV Display / Hi-Fi (CBM)</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--fg); font-family: monospace;">${totalTvHifiM3.toFixed(3)} <span style="font-size: 14px; color: var(--fg-muted);">m³</span></div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            `;
        }
        
        if (missingMaxPallets.length > 0) {
            masterDataWarning = `
                <div style="color: #d97706; font-size: 13px; margin-top: 12px; font-weight: 500; display:flex; align-items:flex-start; gap: 8px; background: rgba(245, 158, 11, 0.1); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.2);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 2px; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <div>
                        <strong>Master Data Warning:</strong> The following TV DISPLAY models are missing Max Pallet data. The system defaulted to 16 pallets/truck. Please update your Master Data:<br>
                        <span style="font-family: monospace; opacity: 0.8; margin-top: 4px; display: block;">${missingMaxPallets.join(', ')}</span>
                    </div>
                </div>
            `;
        }

        let volumeSection = ``;
        if (hasVolumeData) {
            volumeSection = `
                <div style="margin-top: 24px; width: 100%; padding-top: 24px; border-top: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; font-weight: 600;">
                        <span style="color: var(--fg-muted);">Truck Capacity Used</span>
                        <span style="color: ${volumeColor}">${totalVolumePercent}%</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${Math.min(100, totalVolumePercent)}%; background: ${volumeColor}; border-radius: 4px; transition: width 0.3s ease;"></div>
                    </div>
                    ${volumeWarning}
                    ${masterDataWarning}
                </div>
            `;
        }
        
        let html = `
            <div class="table-card" style="padding: 24px; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.2);">
                <!-- Container Size Selector -->
                <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 16px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 8px; border: 1px solid var(--border);">
                    <button id="dashTruckSize40Btn" onclick="plannerEngine.setTruckType('40HC')" title="40-Foot High Cube Container (76 m³)" style="background: ${this.selectedTruckType === '40HC' ? 'var(--accent, #8b5cf6)' : 'transparent'}; color: ${this.selectedTruckType === '40HC' ? '#fff' : 'var(--fg-muted, #a1a1aa)'}; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">🚛 40ft HC (76m³)</button>
                    <button id="dashTruckSize20Btn" onclick="plannerEngine.setTruckType('20GP')" title="20-Foot Standard Container (33.2 m³)" style="background: ${this.selectedTruckType === '20GP' ? 'var(--accent, #8b5cf6)' : 'transparent'}; color: ${this.selectedTruckType === '20GP' ? '#fff' : 'var(--fg-muted, #a1a1aa)'}; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">🚚 20ft GP (33.2m³)</button>
                </div>

                <div style="font-size: 14px; color: var(--fg-muted); margin-bottom: 8px; font-weight: 600; letter-spacing: 0.5px;">Total Pallets (${spec.name})</div>
                <div style="font-size: 64px; font-weight: 700; color: var(--accent); line-height: 1; margin-bottom: 8px;">${totalPallets}</div>
                ${mixedPallets.length > 0 ? `<div style="font-size: 13px; color: #10b981; font-weight: 600; background: rgba(16,185,129,0.1); padding: 4px 12px; border-radius: 12px;">${mixedPallets.length} Mixed Pallets Generated</div>` : ''}

                ${volumeSection}
                <button onclick="plannerEngine.open3DViewer()" style="margin-top: 24px; background: rgba(139, 92, 246, 0.12); border: 1px solid var(--accent, #8b5cf6); color: var(--accent, #8b5cf6); padding: 9px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(139, 92, 246, 0.15); transition: all 0.2s;" onmouseenter="this.style.background='rgba(139, 92, 246, 0.22)'; this.style.transform='translateY(-1px)'" onmouseleave="this.style.background='rgba(139, 92, 246, 0.12)'; this.style.transform='none'">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    Launch 3D Simulation
                </button>
            </div>
            
${mixedPalletsHtml}
        `;
        
        container.innerHTML = html;
    }
    
    
    
    renderPalletList() {
        const container = document.getElementById('palletListContainer');
        if (!container) return;
        
        if (!this.palletsToPlace || this.palletsToPlace.length === 0) {
            container.innerHTML = '<div style="color: var(--fg-muted, #a1a1aa); font-size: 12px;">No pallets to display.</div>';
            return;
        }
        
        let html = '';
        this.palletsToPlace.forEach((p, index) => {
            let pColor = '#3b82f6';
            if (p.isSmallMixed) pColor = '#d4b483'; // Same as TV/HiFi
            else if (p.isMixed) pColor = '#d4b483'; // Changed from green to light brown
            else if (p.type === 'TV DISPLAY' || p.type === 'HIFI') pColor = '#d4b483';
            
            html += `
                <div class="pallet-list-item" draggable="true" data-index="${index}" 
                     style="background: rgba(0,0,0,0.2); border: 1px solid var(--border, #3f3f46); border-radius: 6px; padding: 10px; display: flex; align-items: center; gap: 10px; cursor: grab; transition: transform 0.2s, background 0.2s;">
                    <div style="cursor: grab; color: var(--fg-muted, #71717a);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                    </div>
                    <div style="width: 12px; height: 12px; background: ${pColor}; border-radius: 2px; flex-shrink: 0;"></div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="color: var(--fg, #f4f4f5); font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.isSmallMixed ? 'Small Item Pallet' : (p.isMixed ? 'Mixed Pallet' : (p.description || p.code))}</div>
                        <div style="color: var(--fg-muted, #a1a1aa); font-size: 11px;">Qty: ${p.qty}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add drag events
        const items = container.querySelectorAll('.pallet-list-item');
        let draggedIndex = -1;
        
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedIndex = parseInt(e.target.dataset.index);
                e.target.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            });
            
            item.addEventListener('dragend', (e) => {
                e.target.style.opacity = '1';
                items.forEach(i => i.style.border = '1px solid var(--border, #3f3f46)');
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const closestItem = e.target.closest('.pallet-list-item');
                if (closestItem) {
                    closestItem.style.border = '1px dashed var(--accent, #8b5cf6)';
                }
            });
            
            item.addEventListener('dragleave', (e) => {
                const closestItem = e.target.closest('.pallet-list-item');
                if (closestItem) {
                    closestItem.style.border = '1px solid var(--border, #3f3f46)';
                }
            });
            
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const closestItem = e.target.closest('.pallet-list-item');
                if (closestItem && draggedIndex > -1) {
                    const targetIndex = parseInt(closestItem.dataset.index);
                    
                    if (draggedIndex !== targetIndex) {
                        // Reorder the array
                        const draggedPallet = this.palletsToPlace.splice(draggedIndex, 1)[0];
                        this.palletsToPlace.splice(targetIndex, 0, draggedPallet);
                        
                        // Re-render
                        if (this.renderPalletsLayout) this.renderPalletsLayout();
                        this.renderPalletList();
                    }
                }
            });
        });
    }

    setInteraction(mode) {

        this.interactionMode = mode;
        
        // Update UI buttons
        const swapBtn = document.getElementById('modeSwapBtn');
        const sandboxBtn = document.getElementById('modeSandboxBtn');
        const listBtn = document.getElementById('modeListBtn');
        
        if (swapBtn && sandboxBtn && listBtn) {
            const updateBtn = (btn, isActive) => {
                if (!btn) return;
                if (isActive) {
                    btn.classList.remove('ghost');
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                    btn.classList.add('ghost');
                }
            };
            
            updateBtn(swapBtn, mode === 'swap');
            updateBtn(sandboxBtn, mode === 'sandbox');
            updateBtn(listBtn, mode === 'list');
        }
        
        const sidebar = document.getElementById('truck3dSidebar');
        if (sidebar) {
            sidebar.style.display = mode === 'list' ? 'flex' : 'none';
        }
        
        // Trigger a re-render or reset if needed
        if (this.renderPalletsLayout && mode !== 'sandbox') {
            this.renderPalletsLayout(); 
        }
        
        if (mode === 'list' && this.renderPalletList) {
            this.renderPalletList();
        }
        // Force the 3D canvas to resize now that the flex layout has shifted
        setTimeout(() => window.dispatchEvent(new Event('resize')), 10);
    }
    
    syncDashboardOverflow(overflowDOs) {
        const tabBtn = document.getElementById('tab-overflow-recs');
        const badge = document.getElementById('overflow-badge-span');
        const listSpan = document.getElementById('overflow-do-list-span');
        
        if (tabBtn && badge && listSpan) {
            if (overflowDOs.size > 0) {
                tabBtn.style.display = 'block';
                badge.innerText = overflowDOs.size;
                listSpan.innerText = Array.from(overflowDOs).join(', ');
            } else {
                tabBtn.style.display = 'none';
                
                // If the user is currently viewing the overflow tab but it just emptied out, switch back to mixed pallets tab
                if (document.getElementById('content-overflow-recs') && document.getElementById('content-overflow-recs').style.display === 'block') {
                    const mixedTab = document.getElementById('tab-mixed-pallets');
                    if (mixedTab) mixedTab.click();
                }
            }
        }
    }

    open3DViewer() {
        if (typeof THREE === 'undefined') {
            return showToast("3D library is still loading. Please try again in a moment.", "warning");
        }
        
        if (this.orders.length === 0 && (!this.calculatedMixedPallets || this.calculatedMixedPallets.length === 0)) {
            return showToast("No pallets to display. Please calculate pallets first.", "warning");
        }

        const modal = document.getElementById('truck3dModal');
        if (modal) modal.style.display = 'flex';
        
        this.overflowWarningDismissed = false;
        this.setInteraction(this.interactionMode || 'swap');
        
        const container = document.getElementById('truck3dContainer');
        if (!container) return;
        
        // Clean up previous animations and event listeners before re-init
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.pointerDownListener && container) container.removeEventListener('pointerdown', this.pointerDownListener);
        if (this.pointerMoveListener && container) container.removeEventListener('pointermove', this.pointerMoveListener);
        if (this.pointerUpListener && container) container.removeEventListener('pointerup', this.pointerUpListener);
        if (this.contextMenuListener && container) container.removeEventListener('contextmenu', this.contextMenuListener);
        if (this.resizeListener) window.removeEventListener('resize', this.resizeListener);
        
        // Remove existing canvas if any
        const existingCanvas = container.querySelector('canvas');
        if (existingCanvas) existingCanvas.remove();
        
        // Sync modal title
        const modalTitle = document.getElementById('truck3dModalTitle');
        if (modalTitle) {
            modalTitle.textContent = (this.selectedTruckType === '20GP') ? '20-Footer 3D Visualization' : '40-Footer 3D Visualization';
        }
        
        // Sync modal container size buttons
        const btn40 = document.getElementById('truckSize40Btn');
        const btn20 = document.getElementById('truckSize20Btn');
        if (btn40 && btn20) {
            if (this.selectedTruckType === '40HC') {
                btn40.classList.remove('ghost'); btn40.classList.add('active');
                btn20.classList.remove('active'); btn20.classList.add('ghost');
            } else {
                btn20.classList.remove('ghost'); btn20.classList.add('active');
                btn40.classList.remove('active'); btn40.classList.add('ghost');
            }
        }

        if (this.isPalletsDirty || !this.palletsToPlace) {
        // 1. Prepare Pallets Array
        let palletsToPlace = [];
        this.orders.forEach(o => {
            let remainingQty = o.orderQty;
            const palletsList = o.palletsList || Array(o.palletQty).fill(o.selectedCap || 16);
            
            let pType = (o.type || "").toUpperCase();
            let pLength = o.length;
            let pWidth = o.width;
            let pCartonL = o.cartonL;
            let pCartonW = o.cartonW;
            
            // Smart size fallback for single-SKU TV pallets to prevent overhang
            if (pType === 'TV DISPLAY') {
                // If the user uploaded specific carton dims, but no pallet dims, auto-calculate them
                // Otherwise use the inch fallback for cartons
                let sizeStr = o.description || o.code || "";
                let inch = 50;
                let match = sizeStr.match(/-(\d{2,3})/);
                if (!match) match = sizeStr.match(/(\d{2,3})/);
                if (match) inch = parseInt(match[1]);
                
                if (!pCartonL) pCartonL = inch * 2.5;
                if (!pCartonW) pCartonW = 20;
                
                // CRITICAL FIX: TVs often overhang standard pallets, or their base pallet expands.
                // If there's no explicitly set pallet dimension in the master data, dynamically expand the wooden base
                // to fit the carton to prevent 3D clipping.
                // If the user DID set a pallet dimension, trust it completely.
                let hasExplicitL = o.palletL || o.length;
                let hasExplicitW = o.palletW || o.width;
                if (!hasExplicitL) pLength = Math.max(110, pCartonL);
                if (!hasExplicitW) pWidth = Math.max(110, pCartonW);
            }

            palletsList.forEach(cap => {
                let qtyInThisPallet = Math.min(remainingQty, cap);
                if (qtyInThisPallet <= 0) qtyInThisPallet = cap;
                remainingQty -= cap;
                palletsToPlace.push({
                    type: pType,
                    code: o.code,
                    description: o.description,
                    inv: o.inv,
                    qty: qtyInThisPallet,
                    length: pLength,
                    width: pWidth,
                    cartonL: pCartonL,
                    cartonW: pCartonW,
                    cartonH: o.cartonH,
                    tie: o.tie,
                    high: o.high,
                    rawCaps: o.rawCaps || [],
                    selectedCap: cap,
                    strategy: o.strategy,
                    rotated: false
                });
            });
        });
        
        if (this.calculatedMixedPallets && this.calculatedMixedPallets.length > 0) {
            this.calculatedMixedPallets.forEach(mp => {
                let mixedDesc = "Mixed: " + mp.items.map(i => i.qty + "x " + (i.description || i.code)).join(' | ');
                
                if (mp.isTvMixed) {
                    const tvItems = mp.items.filter(i => i.type === 'TV DISPLAY');
                    const otherItems = mp.items.filter(i => i.type !== 'TV DISPLAY');
                    
                    // CRITICAL FIX: If the "Mixed" TV pallet actually only contains a single SKU of TV
                    // and nothing else, treat it as a standard block-packed pallet so it respects Tie/High!
                    if (tvItems.length === 1 && otherItems.length === 0) {
                        let tv = tvItems[0];
                        
                        let l = tv.length || tv.palletL || tv.cartonL;
                        let w = tv.width || tv.palletW || tv.cartonW; 
                        let cL = tv.cartonL;
                        let cW = tv.cartonW;
                        
                        // Always calculate carton dims if missing
                        let sizeStr = tv.description || tv.code || "";
                        let inch = 50;
                        let match = sizeStr.match(/-(\d{2,3})/);
                        if (!match) match = sizeStr.match(/(\d{2,3})/);
                        if (match) inch = parseInt(match[1]);
                        
                        if (!cL) cL = inch * 2.5;
                        if (!cW) cW = 20;
                        
                        tv.cartonL = cL;
                        tv.cartonW = cW;
                        
                        let hasExplicitL = tv.palletL || tv.length;
                        let hasExplicitW = tv.palletW || tv.width;
                        if (!hasExplicitL) l = Math.max(110, cL);
                        if (!hasExplicitW) w = Math.max(110, cW);

                        palletsToPlace.push({
                            type: tv.type,
                            code: tv.code,
                            description: tv.description,
                            inv: tv.inv,
                            qty: tv.qty,
                            length: l,
                            width: w,
                            cartonL: tv.cartonL,
                            cartonW: tv.cartonW,
                            cartonH: tv.cartonH || tv.h,
                            tie: tv.tie,
                            high: tv.high,
                            isMixed: false,
                            isTvMixed: false,
                            fillPercent: mp.fillPercent,
                            rotated: false
                        });
                        return; // Skip the rest of the mixed logic
                    }
                    
                    let maxL = 0;
                    let maxW = 0;
                    
                    tvItems.forEach(tv => {
                        let l = tv.length || tv.palletL || tv.cartonL;
                        let w = tv.width || tv.palletW || tv.cartonW; 
                        let cL = tv.cartonL;
                        let cW = tv.cartonW;
                        
                        // Always calculate carton dims if missing
                        let sizeStr = tv.description || tv.code || "";
                        let inch = 50;
                        let match = sizeStr.match(/-(\d{2,3})/);
                        if (!match) match = sizeStr.match(/(\d{2,3})/);
                        if (match) inch = parseInt(match[1]);
                        
                        if (!cL) cL = inch * 2.5;
                        if (!cW) cW = 20;
                        
                        tv.cartonL = cL;
                        tv.cartonW = cW;
                        
                        // CRITICAL FIX: The pallet dimension MUST be at least as large as the carton
                        // to prevent the TVs from overhanging the wooden base in 3D.
                        // ONLY expand if the user didn't explicitly set a pallet length in master data.
                        let hasExplicitL = tv.palletL || tv.length;
                        let hasExplicitW = tv.palletW || tv.width;
                        if (!hasExplicitL) l = Math.max(110, cL);
                        if (!hasExplicitW) w = Math.max(110, cW);
                        
                        if (l > maxL) maxL = l;
                        if (w > maxW) maxW = w;
                    });
                    
                    // Fix: Ensure pallet length strictly follows TV base dimensions since HIFIs are top-loaded
                    if (otherItems.length > 0) {
                        // Length is not expanded; HIFIs sit on top
                    }
                    
                    palletsToPlace.push({
                        type: "MIXED TV PALLET",
                        code: "MIXED TV",
                        description: mixedDesc,
                        invs: [...new Set([...tvItems, ...otherItems].map(i => i.inv).filter(Boolean))],
                        qty: mp.items.reduce((sum, item) => sum + item.qty, 0),
                        isMixed: true,
                        isTvMixed: true,
                        tvItems: tvItems,
                        otherItems: otherItems,
                        length: maxL,
                        width: maxW,
                        fillPercent: mp.fillPercent,
                        rotated: false
                    });
                } else if (mp.isHifiPartial) {
                    const item = mp.items[0];
                    palletsToPlace.push({
                        type: item.type,
                        code: item.code,
                        description: item.description,
                        inv: item.inv,
                        invs: item.inv ? item.inv.split(',').map(s=>s.trim()) : [],
                        qty: item.qty,
                        length: item.length,
                        width: item.width,
                        cartonL: item.cartonL,
                        cartonW: item.cartonW,
                        cartonH: item.cartonH || item.h,
                        tie: item.tie,
                        high: item.high,
                        rawCaps: item.rawCaps || [],
                        selectedCap: item.selectedCap,
                        strategy: item.strategy,
                        isMixed: false,
                        isTvMixed: false,
                        isSmallMixed: false,
                        fillPercent: mp.fillPercent,
                        rotated: false
                    });
                } else {
                    palletsToPlace.push({
                        type: mp.isSmallMixed ? "SMALL ITEM PALLET" : "MIXED PALLET",
                        code: mp.isSmallMixed ? "MIXED SMALL" : "MIXED",
                        description: mp.isSmallMixed ? "Small item | " + mixedDesc : mixedDesc,
                        invs: [...new Set((mp.items || []).map(i => i.inv).filter(Boolean))],
                        qty: mp.items.reduce((sum, item) => sum + item.qty, 0),
                        isMixed: true,
                        isTvMixed: false,
                        isSmallMixed: mp.isSmallMixed,
                        items: mp.items,
                        unitM3: mp.unitM3,
                        fillPercent: mp.fillPercent,
                        length: mp.length || null,
                        width: mp.width || null,
                        rotated: false
                    });
                }
            });
        }
        
        // Sort pallets: TV DISPLAY / HIFI first, sorted by biggest size
        palletsToPlace.sort((a, b) => {
            const isAtv = a.type === 'TV DISPLAY' || a.type === 'HIFI' || a.isTvMixed;
            const isBtv = b.type === 'TV DISPLAY' || b.type === 'HIFI' || b.isTvMixed;

            if (isAtv && !isBtv) return -1;
            if (!isAtv && isBtv) return 1;

            if (isAtv && isBtv) {
                let areaA = (a.length || a.cartonL || 0) * (a.width || a.cartonW || 0);
                let areaB = (b.length || b.cartonL || 0) * (b.width || b.cartonW || 0);
                return areaB - areaA; // Biggest first
            }

            return 0;
        });

        this.palletsToPlace = palletsToPlace;
            this.isPalletsDirty = false;
        }
        if (this.interactionMode === 'list') { this.renderPalletList(); }
        
        // 2. Setup Scene dynamically based on selected container size
        const spec = CONTAINER_SPECS[this.selectedTruckType] || CONTAINER_SPECS['40HC'];
        const truckL = spec.lengthFt; 
        const truckW = spec.widthFt;
        const truckH = spec.heightFt;
        
        const palletW = (truckW / 2) - 0.4;
        const palletL = (truckL / spec.defaultRows) - 0.4;
        const palletH = 4;
        
        const tvColor = 0xd4b483; // Light Brown
        const hifiColor = 0xd4b483; // Same as TV (Light Brown)
        const overflowColor = 0xef4444; // Red
        const mixedColor = 0x10b981; // Green
        
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b0f19); // Dark warehouse atmosphere
        
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(-20, 15, -25);
        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);
        
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.screenSpacePanning = true; // 1:1 screen-space panning
        controls.panSpeed = 1.8;            // Agile, instant panning responsiveness
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(15, 25, 10);
        scene.add(dirLight);
        
        // --- 3D Materials & Geometry Helper Functions (Global for Scene) ---
        const extractTVSize = (desc) => {
            if (!desc) return "TV";
            let match = desc.match(/-(\d{2,3})/);
            if (!match) {
                match = desc.match(/(\d{2,3})/);
            }
            if (match) return match[1] + '"';
            return "TV";
        };

        // ═══════════════════════════════════════════════════════════════════
        // PRIORITY 1 — Generalized dimension resolver with confidence tiers.
        // Every rendered object resolves its size from the highest tier available
        // and carries a `source` tag so the model can flag its own accuracy:
        //   'measured' (Tier 1) → real carton L/W/H entered in master data
        //   'derived'  (Tier 2) → computed from a reliable attribute (TV inch/tie)
        //   'class'    (Tier 3) → category template default
        //   'ghost'    (Tier 4) → no usable dims (aggregate fallback only)
        // All returned dims are in FEET (planner 3D space: cm / 30.48).
        // ═══════════════════════════════════════════════════════════════════
        const CM_TO_FT = 30.48;

        // Tier-3 class templates (cm) for recurring non-TV accessories.
        const CLASS_DEFAULTS = [
            { match: /soundbar|ht-[a-z]?\d+/i,        L: 110, W: 15, H: 15, label: 'soundbar' },
            { match: /hifi|audio|speaker|subwoofer/i, L: 40,  W: 35, H: 25, label: 'hifi' },
            { match: /set[- ]?top|receiver|bluray|dvd|player/i, L: 35, W: 25, H: 8, label: 'stb' },
            { match: /.*/,                             L: 30,  W: 30, H: 30, label: 'small' }, // catch-all small accessory
        ];

        const resolveDims = (item) => {
            // Candidate measured values (cm) — support both master-data (l/w/h)
            // and order/item (cartonL/cartonW/cartonH) field spellings.
            let L = item.cartonL || item.l || null;
            let W = item.cartonW || item.w || null;
            let H = item.cartonH || item.h || null;

            // ── Tier 1: fully measured ─────────────────────────────────────
            if (L > 0 && W > 0 && H > 0) {
                return { L: L / CM_TO_FT, W: W / CM_TO_FT, H: H / CM_TO_FT, source: 'measured' };
            }

            const typeStr = (item.type || '').toUpperCase();
            const descStr = item.description || item.code || '';

            // ── Tier 2: derived from a reliable attribute ──────────────────
            if (typeStr === 'TV DISPLAY') {
                const inch = parseInt(extractTVSize(descStr)) || 50;
                const dL = L > 0 ? L : inch * 2.5;      // screen length
                const dW = W > 0 ? W : 20;              // thin edge
                const dH = H > 0 ? H : inch * 1.6;      // panel height
                return { L: dL / CM_TO_FT, W: dW / CM_TO_FT, H: dH / CM_TO_FT, source: 'derived' };
            }

            // ── Tier 3: class template (fill any missing dims) ─────────────
            const cls = CLASS_DEFAULTS.find(c => c.match.test(descStr) || c.match.test(typeStr)) || CLASS_DEFAULTS[CLASS_DEFAULTS.length - 1];
            const cL = L > 0 ? L : cls.L;
            const cW = W > 0 ? W : cls.W;
            const cH = H > 0 ? H : cls.H;
            const partial = (L > 0 || W > 0 || H > 0); // had at least one measured dim
            return { L: cL / CM_TO_FT, W: cW / CM_TO_FT, H: cH / CM_TO_FT, source: partial ? 'derived' : 'class' };
        };

        // ═══════════════════════════════════════════════════════════════════
        // PRIORITY 2 — Confidence-aware carton material. Measured dims render
        // solid; estimated dims (derived/class/ghost) render translucent so the
        // 3D model honestly communicates which boxes are approximate.
        // ═══════════════════════════════════════════════════════════════════
        const createEstimatedCartonMaterial = (colorNum, source) => {
            const isEstimated = source !== 'measured';
            return new THREE.MeshStandardMaterial({
                color: colorNum,
                roughness: 0.5,
                metalness: 0.1,
                transparent: isEstimated,
                opacity: isEstimated ? 0.62 : 1.0,
            });
        };

        const createCartonMaterial = (pType, pDesc, colorNum) => {
            if (pType !== 'TV DISPLAY' && pType !== 'HIFI' && pType !== 'HIFI AUDIO' && pType !== 'SOUNDBAR') {
                return new THREE.MeshStandardMaterial({ color: colorNum, roughness: 0.3, metalness: 0.1 });
            }
            
            let labelText = "HIFI";
            if (pType === 'TV DISPLAY') {
                labelText = extractTVSize(pDesc);
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
        };
        
        const createA4LabelMaterial = (desc) => {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 1024, 512);
            
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 20;
            ctx.strokeRect(10, 10, 1004, 492);
            
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.font = 'bold 160px Arial';
            ctx.fillText("SMALL ITEM", 512, 256);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = 4;
            return new THREE.MeshBasicMaterial({ map: texture });
        };
        
        const createRealisticPallet = (w, h, l) => {
            const palletGroup = new THREE.Group();
            const plankH = h * 0.25;
            const stringerH = h * 0.5;
            const mat = new THREE.MeshStandardMaterial({ color: 0xdcb68a, roughness: 0.8 });
            
            // Top Planks (running along width - X axis)
            const numTopPlanks = 7;
            const topPlankW = w;
            const topPlankL = l * 0.12;
            for (let i = 0; i < numTopPlanks; i++) {
                const topGeo = new THREE.BoxGeometry(topPlankW, plankH, topPlankL);
                const topMesh = new THREE.Mesh(topGeo, mat);
                topMesh.castShadow = true;
                topMesh.receiveShadow = true;
                const zPos = -(l / 2) + (topPlankL / 2) + (i * (l - topPlankL) / (numTopPlanks - 1));
                topMesh.position.set(0, h - (plankH / 2), zPos);
                palletGroup.add(topMesh);
            }
            
            // Stringers (running along length - Z axis)
            const numStringers = 3;
            const stringerW = w * 0.12;
            for (let i = 0; i < numStringers; i++) {
                const stringerGeo = new THREE.BoxGeometry(stringerW, stringerH, l * 0.98);
                const stringerMesh = new THREE.Mesh(stringerGeo, mat);
                stringerMesh.castShadow = true;
                stringerMesh.receiveShadow = true;
                const xPos = -(w / 2) + (stringerW / 2) + (i * (w - stringerW) / (numStringers - 1));
                stringerMesh.position.set(xPos, plankH + (stringerH / 2), 0);
                palletGroup.add(stringerMesh);
            }
            
            // Bottom Planks (running along length - Z axis, directly under stringers)
            for (let i = 0; i < numStringers; i++) {
                const bottomGeo = new THREE.BoxGeometry(stringerW, plankH, l);
                const bottomMesh = new THREE.Mesh(bottomGeo, mat);
                bottomMesh.castShadow = true;
                bottomMesh.receiveShadow = true;
                const xPos = -(w / 2) + (stringerW / 2) + (i * (w - stringerW) / (numStringers - 1));
                bottomMesh.position.set(xPos, plankH / 2, 0);
                palletGroup.add(bottomMesh);
            }
            
            return palletGroup;
        };
        
        // Common Materials
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.15, metalness: 0.85 });
        
        // --- Realistic Logistics Ground & Loading Bay Environment ---
        const bayGroup = new THREE.Group();
        scene.add(bayGroup);
        
        // 1. Wide Concrete / Asphalt Yard Apron Floor (Extended for Truck Departure Route)
        const groundGeo = new THREE.PlaneGeometry(140, 500);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.1 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, 0, -120);
        ground.receiveShadow = true;
        bayGroup.add(ground);

        
        // 3. Elevated Concrete Loading Dock Platform (Behind the Truck)
        const dockHeight = 1.35; // Aligns perfectly with the trailer bed
        const dockL = 30;
        const dockW = 40;
        const dockZ = (truckL / 2) + (dockL / 2) + 0.3;
        
        const dockGeo = new THREE.BoxGeometry(dockW, dockHeight, dockL);
        const dockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
        const dockMesh = new THREE.Mesh(dockGeo, dockMat);
        dockMesh.position.set(0, dockHeight / 2, dockZ);
        dockMesh.receiveShadow = true;
        bayGroup.add(dockMesh);
        
        // 4. Hazard Warning Stripes along Dock Face (Yellow / Black Chevron)
        const hazardCanvas = document.createElement('canvas');
        hazardCanvas.width = 512;
        hazardCanvas.height = 64;
        const hCtx = hazardCanvas.getContext('2d');
        hCtx.fillStyle = '#facc15';
        hCtx.fillRect(0, 0, 512, 64);
        hCtx.fillStyle = '#0f172a';
        for (let s = -64; s < 512; s += 32) {
            hCtx.beginPath();
            hCtx.moveTo(s, 0);
            hCtx.lineTo(s + 20, 0);
            hCtx.lineTo(s + 4, 64);
            hCtx.lineTo(s - 16, 64);
            hCtx.closePath();
            hCtx.fill();
        }
        const hazardTex = new THREE.CanvasTexture(hazardCanvas);
        hazardTex.wrapS = THREE.RepeatWrapping;
        hazardTex.repeat.set(8, 1);
        const hazardMat = new THREE.MeshBasicMaterial({ map: hazardTex });
        const hazardLip = new THREE.Mesh(new THREE.PlaneGeometry(dockW, 0.4), hazardMat);
        hazardLip.position.set(0, dockHeight - 0.2, (truckL / 2) + 0.31);
        bayGroup.add(hazardLip);
        
        // 5. Heavy Rubber Dock Bumpers (Left & Right of Trailer)
        const bumperRubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
        const bumperL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.6), bumperRubberMat);
        bumperL.position.set(-truckW / 2 - 0.5, dockHeight / 2, (truckL / 2) + 0.5);
        bayGroup.add(bumperL);
        const bumperR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.6), bumperRubberMat);
        bumperR.position.set(truckW / 2 + 0.5, dockHeight / 2, (truckL / 2) + 0.5);
        bayGroup.add(bumperR);
        
        // 6. Steel Dock Leveler Bridge Plate (Connecting dock to truck floor)
        const levelerMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.3 });
        const leveler = new THREE.Mesh(new THREE.BoxGeometry(truckW * 0.75, 0.08, 1.2), levelerMat);
        leveler.position.set(0, dockHeight + 0.04, (truckL / 2) + 0.2);
        bayGroup.add(leveler);
        
        // 7. Warehouse Wall & Industrial Bay Doors
        const wallH = 24;
        const wallZ = dockZ + 6;
        const wallW = 80;
        
        // Warehouse Building Facade (Industrial Blue-Slate with Horizontal Cladding Lines)
        const whWallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
        const whTrimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
        const whWallGeo = new THREE.BoxGeometry(wallW, wallH, 0.8);
        const whWall = new THREE.Mesh(whWallGeo, whWallMat);
        whWall.position.set(0, wallH / 2, wallZ);
        bayGroup.add(whWall);
        
        // Horizontal Facade Cladding Accent Grooves
        const grooveMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
        for (let g = 3; g < wallH; g += 3) {
            const groove = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.1, 0.08, 0.9), grooveMat);
            groove.position.set(0, g, wallZ);
            bayGroup.add(groove);
        }
        
        // Overhead Warehouse Roof Canopy / Eaves
        const canopyGeo = new THREE.BoxGeometry(wallW + 4, 0.8, 6);
        const canopy = new THREE.Mesh(canopyGeo, whTrimMat);
        canopy.position.set(0, wallH - 0.4, wallZ - 2.5);
        bayGroup.add(canopy);
        
        // Helper to create Sectional Industrial Roll-up Bay Door
        const createBayDoor = (bayNum, isOpen, posX) => {
            const doorGroup = new THREE.Group();
            doorGroup.position.set(posX, 0, wallZ - 0.42);
            
            const dW = 11;
            const dH = 13;
            
            // Outer Yellow/Black Hazard Frame
            const frameW = 0.5;
            const topFrame = new THREE.Mesh(new THREE.BoxGeometry(dW + (frameW * 2), frameW, 0.2), hazardMat);
            topFrame.position.set(0, dockHeight + dH + (frameW / 2), 0);
            doorGroup.add(topFrame);
            const sideFrameL = new THREE.Mesh(new THREE.BoxGeometry(frameW, dH, 0.2), hazardMat);
            sideFrameL.position.set(-dW / 2 - frameW / 2, dockHeight + (dH / 2), 0);
            doorGroup.add(sideFrameL);
            const sideFrameR = new THREE.Mesh(new THREE.BoxGeometry(frameW, dH, 0.2), hazardMat);
            sideFrameR.position.set(dW / 2 + frameW / 2, dockHeight + (dH / 2), 0);
            doorGroup.add(sideFrameR);
            
            if (isOpen) {
                // Open Door: Dark warehouse interior view behind door
                const intViewMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
                const intView = new THREE.Mesh(new THREE.PlaneGeometry(dW, dH), intViewMat);
                intView.position.set(0, dockHeight + (dH / 2), 0.01);
                doorGroup.add(intView);
                
                // Rolled-up Shutter Curtain at top
                const rollMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.4 });
                const rollCurtain = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, dW, 16), rollMat);
                rollCurtain.rotation.z = Math.PI / 2;
                rollCurtain.position.set(0, dockHeight + dH - 0.8, 0.3);
                doorGroup.add(rollCurtain);
            } else {
                // Closed Sectional Door with Horizontal Panels and Vision Windows
                const doorPanelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.2 });
                const doorPanel = new THREE.Mesh(new THREE.PlaneGeometry(dW, dH), doorPanelMat);
                doorPanel.position.set(0, dockHeight + (dH / 2), 0.01);
                doorGroup.add(doorPanel);
                
                // Sectional Horizontal Ribs
                const ribMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
                for (let r = 1.5; r < dH; r += 2) {
                    const rib = new THREE.Mesh(new THREE.BoxGeometry(dW, 0.08, 0.1), ribMat);
                    rib.position.set(0, dockHeight + r, 0.06);
                    doorGroup.add(rib);
                }
                
                // Vision Window Row
                const winMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 });
                for (let w = -4; w <= 4; w += 2) {
                    const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.12), winMat);
                    win.position.set(w, dockHeight + 7, 0.06);
                    doorGroup.add(win);
                }
            }
            
            // Bay Number Overhead Sign
            const signCanvas = document.createElement('canvas');
            signCanvas.width = 256;
            signCanvas.height = 100;
            const sCtx = signCanvas.getContext('2d');
            sCtx.fillStyle = '#0284c7';
            sCtx.fillRect(0, 0, 256, 100);
            sCtx.fillStyle = '#ffffff';
            sCtx.font = 'bold 44px "Segoe UI", Arial';
            sCtx.textAlign = 'center';
            sCtx.textBaseline = 'middle';
            sCtx.fillText('BAY ' + bayNum, 128, 50);
            const signTex = new THREE.CanvasTexture(signCanvas);
            const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.4), new THREE.MeshBasicMaterial({ map: signTex }));
            signMesh.position.set(0, dockHeight + dH + 2.0, 0.05);
            doorGroup.add(signMesh);
            
            // Dock Floodlight over Door
            const flood = new THREE.PointLight(0xfef08a, 1.2, 25);
            flood.position.set(0, dockHeight + dH + 3.0, 1.5);
            doorGroup.add(flood);
            
            return doorGroup;
        };
        
        // Add Bay Doors: Bay 01 (Open, behind truck), Bay 02 (Closed, Right), Bay 03 (Closed, Left)
        bayGroup.add(createBayDoor('01', true, 0));
        bayGroup.add(createBayDoor('02', false, 18));
        bayGroup.add(createBayDoor('03', false, -18));
        
        // 8. Personnel / Emergency Exit Door (Green Exit Door)
        const exitDoorGroup = new THREE.Group();
        exitDoorGroup.position.set(30, dockHeight, wallZ - 0.42);
        const exitDoorMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 }); // Green door
        const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(3.5, 7.5, 0.1), exitDoorMat);
        exitDoor.position.set(0, 3.75, 0.05);
        exitDoorGroup.add(exitDoor);
        
        // Exit Door Handle & Push Bar
        const pushBar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 0.15), chromeMat);
        pushBar.position.set(0, 3.5, 0.15);
        exitDoorGroup.add(pushBar);
        
        // Illuminated Green Exit Sign
        const exitSignCanvas = document.createElement('canvas');
        exitSignCanvas.width = 200;
        exitSignCanvas.height = 80;
        const eCtx = exitSignCanvas.getContext('2d');
        eCtx.fillStyle = '#16a34a';
        eCtx.fillRect(0, 0, 200, 80);
        eCtx.fillStyle = '#ffffff';
        eCtx.font = 'bold 36px Arial';
        eCtx.textAlign = 'center';
        eCtx.textBaseline = 'middle';
        eCtx.fillText('EXIT →', 100, 40);
        const exitSignTex = new THREE.CanvasTexture(exitSignCanvas);
        const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.8), new THREE.MeshBasicMaterial({ map: exitSignTex }));
        exitSign.position.set(0, 8.2, 0.1);
        exitDoorGroup.add(exitSign);
        bayGroup.add(exitDoorGroup);
        
        // 9. Yellow Safety Bollards on the Loading Dock
        const bollardGeo = new THREE.CylinderGeometry(0.25, 0.25, 3.0, 16);
        const bollardMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
        const bollardPositions = [-8, -6, 6, 8, 12, 24];
        bollardPositions.forEach(bx => {
            const bollard = new THREE.Mesh(bollardGeo, bollardMat);
            bollard.position.set(bx, dockHeight + 1.5, (truckL / 2) + 0.8);
            bayGroup.add(bollard);
        });
        
        // --- 10. 3D Industrial Forklift Model on the Loading Dock ---
        const createForkliftMesh = () => {
            const flGroup = new THREE.Group();
            
            // Materials (High-Contrast Industrial Red & Matte Black)
            const flBodyMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.25, metalness: 0.15 }); // Vibrant Industrial Red
            const flBlackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 }); // Matte Black
            const flSteelMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.7, roughness: 0.3 }); // Blackened Steel
            const flForksMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 }); // Silver steel forks
            const beaconMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.8 }); // Amber strobe
            
            // A. Main Chassis & Counterweight
            const chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 4.2), flBodyMat);
            chassisMesh.position.set(0, 1.2, 0);
            flGroup.add(chassisMesh);
            
            // Rounded Rear Counterweight
            const weightMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.2), flBlackMat);
            weightMesh.position.set(0, 1.3, -1.8);
            flGroup.add(weightMesh);
            
            // B. Overhead Safety Roll Cage (ROPS Guard)
            const postRad = 0.08;
            const postH = 3.6;
            const postGeo = new THREE.CylinderGeometry(postRad, postRad, postH, 8);
            const cagePositions = [
                [-1.1, 1.2 + postH / 2, -1.2],
                [1.1, 1.2 + postH / 2, -1.2],
                [-1.1, 1.2 + postH / 2, 1.0],
                [1.1, 1.2 + postH / 2, 1.0]
            ];
            cagePositions.forEach(cp => {
                const post = new THREE.Mesh(postGeo, flBlackMat);
                post.position.set(cp[0], cp[1], cp[2]);
                flGroup.add(post);
            });
            
            // Cage Roof Grille
            const cageRoof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 2.4), flBlackMat);
            cageRoof.position.set(0, 1.2 + postH, -0.1);
            flGroup.add(cageRoof);
            
            // Amber Strobe Beacon on Roof
            const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.35, 12), beaconMat);
            beacon.position.set(0, 1.2 + postH + 0.2, -0.8);
            flGroup.add(beacon);
            flGroup.userData.beaconMat = beaconMat;
            const beaconLight = new THREE.PointLight(0xf97316, 0, 15);
            beaconLight.position.set(0, 1.2 + postH + 0.5, -0.8);
            beaconLight.castShadow = true;
            beaconLight.shadow.bias = -0.001;
            flGroup.add(beaconLight);
            flGroup.userData.beaconLight = beaconLight;
            
            // C. Operator Cockpit: Seat & Steering Wheel
            const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.0), flBlackMat);
            seat.position.set(0, 2.0, -0.5);
            flGroup.add(seat);
            
            const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8), flBlackMat);
            steerCol.position.set(0, 2.2, 0.6);
            steerCol.rotation.x = -Math.PI / 6;
            flGroup.add(steerCol);
            
            const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 16), flBlackMat);
            steerWheel.position.set(0, 2.8, 0.4);
            steerWheel.rotation.x = -Math.PI / 3;
            flGroup.add(steerWheel);
            
            // --- 3D MINION DRIVER (From Minions Movie) ---
            const minionGroup = new THREE.Group();
            minionGroup.position.set(0, 2.4, -0.4); // Seated on forklift seat
            
            // Materials
            const mYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }); // Minion Yellow
            const mBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.6 });   // Denim Blue Overalls
            const mJacketMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.3 }); // Hi-Vis Safety Jacket
            const mSilverTapeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.85 }); // Silver Reflective Tape
            const mGoggleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.15, metalness: 0.9 }); // Silver Goggle Frame
            const mEyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
            const mIrisMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 }); // Brown Iris
            const mPupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
            const mHardHatMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.25, metalness: 0.1 }); // Orange Hard Hat
            const mGloveMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 }); // Black Rubber Gloves
            
            // 1. Minion Pill-Shaped Body
            const bodyCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.85, 18), mYellowMat);
            bodyCyl.position.set(0, 0.42, 0);
            minionGroup.add(bodyCyl);
            
            const headDome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 18, 0, Math.PI * 2, 0, Math.PI / 2), mYellowMat);
            headDome.position.set(0, 0.84, 0);
            minionGroup.add(headDome);
            
            // 2. Blue Denim Overalls (Lower half)
            const pantsBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.36, 18), mBlueMat);
            pantsBase.position.set(0, 0.18, 0);
            minionGroup.add(pantsBase);
            
            // Front Overall Bib
            const bibFront = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.1), mBlueMat);
            bibFront.position.set(0, 0.38, 0.42);
            minionGroup.add(bibFront);
            
            // 3. Hi-Vis Safety Jacket (Neon Green/Yellow with Reflective Tape)
            const safetyJacket = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.50, 0.45, 18), mJacketMat);
            safetyJacket.position.set(0, 0.5, 0);
            minionGroup.add(safetyJacket);
            
            // Reflective Horizontal Tape
            const jacketTapeH = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.08, 18), mSilverTapeMat);
            jacketTapeH.position.set(0, 0.52, 0);
            minionGroup.add(jacketTapeH);
            
            // Reflective Vertical Shoulder Straps
            const jacketTapeVL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.52), mSilverTapeMat);
            jacketTapeVL.position.set(-0.24, 0.52, 0);
            minionGroup.add(jacketTapeVL);
            const jacketTapeVR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.52), mSilverTapeMat);
            jacketTapeVR.position.set(0.24, 0.52, 0);
            minionGroup.add(jacketTapeVR);
            
            // 4. Iconic Minion Goggles & Eyes (Two Big Goggles)
            const goggleStrap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 18), mGloveMat);
            goggleStrap.position.set(0, 0.82, 0);
            minionGroup.add(goggleStrap);
            
            [-0.17, 0.17].forEach(eyeX => {
                // Silver Metallic Rim
                const goggleRim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 16), mGoggleMat);
                goggleRim.rotation.x = Math.PI / 2;
                goggleRim.position.set(eyeX, 0.82, 0.42);
                minionGroup.add(goggleRim);
                
                // Eye White
                const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), mEyeWhiteMat);
                eyeWhite.position.set(eyeX, 0.82, 0.44);
                minionGroup.add(eyeWhite);
                
                // Iris (Brown)
                const iris = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), mIrisMat);
                iris.rotation.x = Math.PI / 2;
                iris.position.set(eyeX, 0.82, 0.56);
                minionGroup.add(iris);
                
                // Pupil (Black)
                const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), mPupilMat);
                pupil.rotation.x = Math.PI / 2;
                pupil.position.set(eyeX, 0.82, 0.57);
                minionGroup.add(pupil);
            });
            
            // 5. Minion Smile
            const smileCanvas = document.createElement('canvas');
            smileCanvas.width = 128;
            smileCanvas.height = 64;
            const smCtx = smileCanvas.getContext('2d');
            smCtx.strokeStyle = '#78350f';
            smCtx.lineWidth = 6;
            smCtx.beginPath();
            smCtx.arc(64, 16, 32, 0.2, Math.PI - 0.2, false);
            smCtx.stroke();
            const smileTex = new THREE.CanvasTexture(smileCanvas);
            const smileMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: smileTex, transparent: true }));
            smileMesh.position.set(0, 0.65, 0.47);
            minionGroup.add(smileMesh);
            
            // 6. Safety Cap / Construction Hard Hat
            const hardHatDome = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 18, 0, Math.PI * 2, 0, Math.PI / 2), mHardHatMat);
            hardHatDome.position.set(0, 0.92, 0);
            minionGroup.add(hardHatDome);
            
            const hardHatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.06, 18), mHardHatMat);
            hardHatBrim.position.set(0, 0.90, 0.05);
            minionGroup.add(hardHatBrim);
            
            // 7. Yellow Arms & Black Gloves Holding Steering Wheel
            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), mYellowMat);
            armL.position.set(-0.45, 0.55, 0.3);
            armL.rotation.x = Math.PI / 3.5;
            armL.rotation.z = -Math.PI / 8;
            minionGroup.add(armL);
            
            const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), mYellowMat);
            armR.position.set(0.45, 0.55, 0.3);
            armR.rotation.x = Math.PI / 3.5;
            armR.rotation.z = Math.PI / 8;
            minionGroup.add(armR);
            
            // Black Gloves on Steering Wheel
            const gloveL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), mGloveMat);
            gloveL.position.set(-0.35, 0.42, 0.68);
            minionGroup.add(gloveL);
            
            const gloveR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), mGloveMat);
            gloveR.position.set(0.35, 0.42, 0.68);
            minionGroup.add(gloveR);
            
            flGroup.add(minionGroup);
            
            // D. Front Mast (Twin Vertical Rails)
            const mastH = 5.2;
            const mastRailL = new THREE.Mesh(new THREE.BoxGeometry(0.25, mastH, 0.3), flSteelMat);
            mastRailL.position.set(-1.0, mastH / 2 + 0.4, 2.2);
            flGroup.add(mastRailL);
            
            const mastRailR = new THREE.Mesh(new THREE.BoxGeometry(0.25, mastH, 0.3), flSteelMat);
            mastRailR.position.set(1.0, mastH / 2 + 0.4, 2.2);
            flGroup.add(mastRailR);
            
            // Hydraulic Lift Cylinder in Center
            const hydCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, mastH * 0.7, 12), chromeMat);
            hydCyl.position.set(0, (mastH * 0.7) / 2 + 0.4, 2.2);
            flGroup.add(hydCyl);
            
            // Carriage Plate and Forks Group
            const forksGroup = new THREE.Group();
            flGroup.userData.forksGroup = forksGroup;
            
            const carriage = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.15), flSteelMat);
            carriage.position.set(0, 1.6, 2.45);
            forksGroup.add(carriage);
            
            // E. Steel Fork Tines (L-Shape)
            const forkH = 1.4;
            const forkL = 3.2;
            const forkW = 0.25;
            
            [-0.7, 0.7].forEach(fx => {
                const forkV = new THREE.Mesh(new THREE.BoxGeometry(forkW, forkH, 0.1), flForksMat);
                forkV.position.set(fx, 1.4, 2.5);
                forksGroup.add(forkV);
                
                const forkHoz = new THREE.Mesh(new THREE.BoxGeometry(forkW, 0.08, forkL), flForksMat);
                forkHoz.position.set(fx, 0.7, 2.5 + forkL / 2);
                forksGroup.add(forkHoz);
            });
            flGroup.add(forksGroup);
            
            // F. Cargo Pallet Carried on Forks (Removed for realism)
            
            // G. 4 Heavy Duty Industrial Wheels (Mounted cleanly outside chassis)
            const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.45, 18);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
            const rimGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 12);
            
            const wPositions = [
                [-1.55, 0.7, 1.4],  // Front Left (Drive)
                [1.55, 0.7, 1.4],   // Front Right (Drive)
                [-1.55, 0.7, -1.4], // Rear Left (Steer)
                [1.55, 0.7, -1.4]   // Rear Right (Steer)
            ];
            wPositions.forEach(wp => {
                const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
                wMesh.rotation.z = Math.PI / 2;
                const rMesh = new THREE.Mesh(rimGeo, flSteelMat);
                wMesh.add(rMesh);
                wMesh.position.set(wp[0], wp[1], wp[2]);
                flGroup.add(wMesh);
            });
            
            // Headlights on Mast
            const flLightMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.9 });
            const flLightL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.2), flLightMat);
            flLightL.position.set(-1.0, 3.5, 2.3);
            flGroup.add(flLightL);
            const flLightR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.2), flLightMat);
            flLightR.position.set(1.0, 3.5, 2.3);
            flGroup.add(flLightR);
            
            flGroup.scale.set(1.2, 1.2, 1.2);
            return flGroup;
        };
        
        
        const createGuiderMesh = () => {
            const guiderGroup = new THREE.Group();
            
            const hiVisMat = new THREE.MeshStandardMaterial({ color: 0xccff00, roughness: 0.9 });
            const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdcb3, roughness: 0.6 });
            const hardHatMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.4 });
            const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
            const batonMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8 });

            const torsoGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.7, 12);
            const torso = new THREE.Mesh(torsoGeo, hiVisMat);
            torso.position.y = 1.05;
            guiderGroup.add(torso);

            const stripeGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 12);
            const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.5 });
            const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
            stripe1.position.y = 1.25;
            guiderGroup.add(stripe1);
            const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
            stripe2.position.y = 0.85;
            guiderGroup.add(stripe2);

            const headGeo = new THREE.SphereGeometry(0.2, 16, 16);
            const head = new THREE.Mesh(headGeo, skinMat);
            head.position.y = 1.5;
            guiderGroup.add(head);

            const hatGeo = new THREE.SphereGeometry(0.21, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
            const hat = new THREE.Mesh(hatGeo, hardHatMat);
            hat.position.y = 1.5;
            guiderGroup.add(hat);
            const brimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.02, 16);
            const brim = new THREE.Mesh(brimGeo, hardHatMat);
            brim.position.y = 1.5;
            guiderGroup.add(brim);

            const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.7, 8);
            const legL = new THREE.Mesh(legGeo, pantsMat);
            legL.position.set(-0.13, 0.35, 0);
            guiderGroup.add(legL);
            const legR = new THREE.Mesh(legGeo, pantsMat);
            legR.position.set(0.13, 0.35, 0);
            guiderGroup.add(legR);

            const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
            const batonGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);

            const armPivotL = new THREE.Group();
            armPivotL.position.set(-0.35, 1.3, 0);
            const armL = new THREE.Mesh(armGeo, hiVisMat);
            armL.position.set(0, -0.25, 0);
            armPivotL.add(armL);
            const batonL = new THREE.Mesh(batonGeo, batonMat);
            batonL.position.set(0, -0.5, 0.15);
            batonL.rotation.x = Math.PI / 2;
            armPivotL.add(batonL);
            guiderGroup.add(armPivotL);

            const armPivotR = new THREE.Group();
            armPivotR.position.set(0.35, 1.3, 0);
            const armR = new THREE.Mesh(armGeo, hiVisMat);
            armR.position.set(0, -0.25, 0);
            armPivotR.add(armR);
            const batonR = new THREE.Mesh(batonGeo, batonMat);
            batonR.position.set(0, -0.5, 0.15);
            batonR.rotation.x = Math.PI / 2;
            armPivotR.add(batonR);
            guiderGroup.add(armPivotR);

            guiderGroup.userData.armL = armPivotL;
            guiderGroup.userData.armR = armPivotR;

            guiderGroup.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            return guiderGroup;
        };

        // Place the Forklift on the Loading Dock staging area facing the container
        const forklift = createForkliftMesh();
        forklift.position.set(11, dockHeight, (truckL / 2) + 11);
        forklift.rotation.y = -Math.PI * 0.75; // Angled towards the truck loading doors
        bayGroup.add(forklift);
        this.forkliftRef = forklift;
                const guider = createGuiderMesh();
        guider.scale.set(3.5, 3.5, 3.5); // Make the guider much larger to match the environment
        guider.position.set(-4, dockHeight, (truckL / 2) + 8);
        bayGroup.add(guider);
        this.guiderRef = guider;
        
        this.forkliftHome = { x: 11, y: dockHeight, z: (truckL / 2) + 11, rotY: -Math.PI * 0.75 };
        
        // --- Elevation Parameters & Master Vehicle Group ---
        const truckElevation = dockHeight; // 1.35 ft - elevates trailer floor to match dock height perfectly
        const truckMasterGroup = new THREE.Group();
        scene.add(truckMasterGroup);
        this.truckMasterGroup = truckMasterGroup;
        this._simTruckL = truckL; // for the forklift loading simulation (dock stand-off distance)
        
        // --- Trailer Floor inside Container ---
        const floorGeo = new THREE.PlaneGeometry(truckW, truckL);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8, metalness: 0.2 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, truckElevation + 0.02, 0);
        floor.receiveShadow = true;
        truckMasterGroup.add(floor);
        this.floorRef = floor;
        
        // --- Truck Container (Semi-Transparent White Glass & Bold White Frame) ---
        const wallMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.14, 
            roughness: 0.1,
            metalness: 0.05,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.2 });
        
        const containerGroup = new THREE.Group();
        containerGroup.position.set(0, truckElevation, 0);
        truckMasterGroup.add(containerGroup);
        this.containerGroupRef = containerGroup;
        
        // Left Wall
        const leftWallGeo = new THREE.PlaneGeometry(truckL, truckH);
        const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.set(-truckW / 2, truckH / 2, 0);
        containerGroup.add(leftWall);
        const leftEdges = new THREE.LineSegments(new THREE.EdgesGeometry(leftWallGeo), edgeMat);
        leftWall.add(leftEdges);

        // Right Wall
        const rightWallGeo = new THREE.PlaneGeometry(truckL, truckH);
        const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.set(truckW / 2, truckH / 2, 0);
        containerGroup.add(rightWall);
        const rightEdges = new THREE.LineSegments(new THREE.EdgesGeometry(rightWallGeo), edgeMat);
        rightWall.add(rightEdges);

        // Front Wall (Nose)
        const frontWallGeo = new THREE.PlaneGeometry(truckW, truckH);
        const frontWall = new THREE.Mesh(frontWallGeo, wallMat);
        frontWall.position.set(0, truckH / 2, -truckL / 2);
        containerGroup.add(frontWall);
        const frontEdges = new THREE.LineSegments(new THREE.EdgesGeometry(frontWallGeo), edgeMat);
        frontWall.add(frontEdges);
        
        // Roof (Ceiling)
        const roofGeo = new THREE.PlaneGeometry(truckW, truckL);
        const roof = new THREE.Mesh(roofGeo, wallMat);
        roof.rotation.x = Math.PI / 2;
        roof.position.set(0, truckH, 0);
        containerGroup.add(roof);
        const roofEdges = new THREE.LineSegments(new THREE.EdgesGeometry(roofGeo), edgeMat);
        roof.add(roofEdges);

        // --- Solid Structural Frame Pillars (Thick White Framing) ---
        const postThickness = 0.15;
        
        // 4 Vertical Corner Posts
        const vPostGeo = new THREE.BoxGeometry(postThickness, truckH, postThickness);
        const postPositions = [
            [-truckW / 2, truckH / 2, -truckL / 2],
            [truckW / 2, truckH / 2, -truckL / 2],
            [-truckW / 2, truckH / 2, truckL / 2],
            [truckW / 2, truckH / 2, truckL / 2]
        ];
        postPositions.forEach(pos => {
            const post = new THREE.Mesh(vPostGeo, frameMat);
            post.position.set(pos[0], pos[1], pos[2]);
            containerGroup.add(post);
        });
        
        // Top Roof Rails (Longitudinal & Cross)
        const topSideRailGeo = new THREE.BoxGeometry(postThickness, postThickness, truckL);
        const topSideL = new THREE.Mesh(topSideRailGeo, frameMat);
        topSideL.position.set(-truckW / 2, truckH, 0);
        containerGroup.add(topSideL);
        const topSideR = new THREE.Mesh(topSideRailGeo, frameMat);
        topSideR.position.set(truckW / 2, truckH, 0);
        containerGroup.add(topSideR);
        
        const topCrossRailGeo = new THREE.BoxGeometry(truckW, postThickness, postThickness);
        const topFrontCross = new THREE.Mesh(topCrossRailGeo, frameMat);
        topFrontCross.position.set(0, truckH, -truckL / 2);
        containerGroup.add(topFrontCross);
        const topRearCross = new THREE.Mesh(topCrossRailGeo, frameMat);
        topRearCross.position.set(0, truckH, truckL / 2);
        containerGroup.add(topRearCross);
        
        // Bottom Base Sills (Longitudinal & Cross)
        const botSideL = new THREE.Mesh(topSideRailGeo, frameMat);
        botSideL.position.set(-truckW / 2, postThickness / 2, 0);
        containerGroup.add(botSideL);
        const botSideR = new THREE.Mesh(topSideRailGeo, frameMat);
        botSideR.position.set(truckW / 2, postThickness / 2, 0);
        containerGroup.add(botSideR);
        const botFrontCross = new THREE.Mesh(topCrossRailGeo, frameMat);
        botFrontCross.position.set(0, postThickness / 2, -truckL / 2);
        containerGroup.add(botFrontCross);

        // Rear Doors (Swung Open at Elevated Height)
        const doorGeo = new THREE.PlaneGeometry(truckW / 2, truckH);
        
        // Left Door Hinge
        const leftHinge = new THREE.Group();
        leftHinge.position.set(-truckW / 2, truckElevation + (truckH / 2), truckL / 2);
        leftHinge.rotation.y = -Math.PI / 1.6; // Open outwards past 90 degrees
        truckMasterGroup.add(leftHinge);
        
        const leftDoor = new THREE.Mesh(doorGeo, wallMat);
        leftDoor.position.set(truckW / 4, 0, 0);
        leftHinge.add(leftDoor);
        const leftDoorEdges = new THREE.LineSegments(new THREE.EdgesGeometry(doorGeo), edgeMat);
        leftDoor.add(leftDoorEdges);
        
        // Right Door Hinge
        const rightHinge = new THREE.Group();
        rightHinge.position.set(truckW / 2, truckElevation + (truckH / 2), truckL / 2);
        rightHinge.rotation.y = Math.PI / 1.6; // Open outwards
        truckMasterGroup.add(rightHinge);
        
        const rightDoor = new THREE.Mesh(doorGeo, wallMat);
        rightDoor.position.set(-truckW / 4, 0, 0);
        rightHinge.add(rightDoor);
        const rightDoorEdges = new THREE.LineSegments(new THREE.EdgesGeometry(doorGeo), edgeMat);
        rightDoor.add(rightDoorEdges);
        
        // Helper to create 3D License Plate with custom registration text
        const createPlateMesh = (text, width, height) => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 100;
            const ctx = canvas.getContext('2d');
            
            // Slate Dark Background
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 512, 100);
            
            // Red Outer Border
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 6;
            ctx.strokeRect(3, 3, 506, 94);
            
            // White Inner Border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.strokeRect(9, 9, 494, 82);
            
            // Text: DEMONSTRATION PURPOSE ONLY
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 256, 50);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = 4;
            
            const plateGeo = new THREE.PlaneGeometry(width, height);
            const plateMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide });
            return new THREE.Mesh(plateGeo, plateMat);
        };
        
        // --- Truck Cabin (Head) - Hollow Cockpit with Visible Driver ---
        const cabinGroup = new THREE.Group();
        
        // COE parameters
        const cabinW = truckW * 0.9;
        const cabinH = truckH * 0.85; 
        const cabinL = 5; 
        const chassisL = 3;
        const cabZ = -(truckL / 2) - chassisL - (cabinL / 2) - 0.5;
        
        // White & Red Modern Cabin Materials
        const cabWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.08 });
        const cabRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.1 });
        const cabChassisMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.2 });
        const cabInteriorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
        
        // 1. Lower Front Cabin Body (Below Windshield)
        const lowerCabGeo = new THREE.BoxGeometry(cabinW, cabinH * 0.55, cabinL);
        const lowerCab = new THREE.Mesh(lowerCabGeo, cabWhiteMat);
        lowerCab.position.set(0, (cabinH * 0.275) + 1.2, cabZ);
        lowerCab.castShadow = true;
        lowerCab.receiveShadow = true;
        cabinGroup.add(lowerCab);
        
        // 2. Cabin Roof Panel
        const cabRoofGeo = new THREE.BoxGeometry(cabinW, 0.4, cabinL);
        const cabRoof = new THREE.Mesh(cabRoofGeo, cabWhiteMat);
        cabRoof.position.set(0, cabinH + 1.2 - 0.2, cabZ);
        cabRoof.castShadow = true;
        cabinGroup.add(cabRoof);
        
        // 3. Cabin Rear Wall (Behind Driver)
        const cabBackGeo = new THREE.BoxGeometry(cabinW, cabinH * 0.45, 0.3);
        const cabBack = new THREE.Mesh(cabBackGeo, cabWhiteMat);
        cabBack.position.set(0, cabinH * 0.775 + 1.2, cabZ + (cabinL / 2) - 0.15);
        cabinGroup.add(cabBack);
        
        // 4. Cabin Left & Right Pillars (A & B Pillars)
        const pillarGeo = new THREE.BoxGeometry(0.3, cabinH * 0.45, cabinL);
        const pillarL = new THREE.Mesh(pillarGeo, cabWhiteMat);
        pillarL.position.set(-cabinW / 2 + 0.15, cabinH * 0.775 + 1.2, cabZ);
        cabinGroup.add(pillarL);
        const pillarR = new THREE.Mesh(pillarGeo, cabWhiteMat);
        pillarR.position.set(cabinW / 2 - 0.15, cabinH * 0.775 + 1.2, cabZ);
        cabinGroup.add(pillarR);
        
        // 5. Cockpit Floor
        const cockpitFloor = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.6, 0.2, cabinL - 0.6), cabInteriorMat);
        cockpitFloor.position.set(0, (cabinH * 0.55) + 1.2, cabZ);
        cabinGroup.add(cockpitFloor);
        
        // 6. Interior Dome Light (Illuminates the Driver)
        const cabDomeLight = new THREE.PointLight(0xffedd5, 1.8, 12);
        cabDomeLight.position.set(0, cabinH + 0.8, cabZ);
        cabinGroup.add(cabDomeLight);
        
        // Platinum White Chassis Extension
        const chassisGeo = new THREE.BoxGeometry(cabinW * 0.8, cabinH * 0.3, chassisL);
        const chassis = new THREE.Mesh(chassisGeo, cabChassisMat);
        chassis.position.set(0, (cabinH * 0.15) + 1.2, cabZ + (cabinL / 2) + (chassisL / 2));
        chassis.castShadow = true;
        cabinGroup.add(chassis);
        
        // Red Chassis Side Skirt Guards
        const skirtGeo = new THREE.BoxGeometry(0.2, cabinH * 0.2, chassisL * 0.9);
        const skirtL = new THREE.Mesh(skirtGeo, cabRedMat);
        skirtL.position.set(-cabinW * 0.42, 1.4, cabZ + (cabinL / 2) + (chassisL / 2));
        cabinGroup.add(skirtL);
        const skirtR = new THREE.Mesh(skirtGeo, cabRedMat);
        skirtR.position.set(cabinW * 0.42, 1.4, cabZ + (cabinL / 2) + (chassisL / 2));
        cabinGroup.add(skirtR);
        
        // Silver Fuel Tanks
        const tankGeo = new THREE.CylinderGeometry(0.6, 0.6, 2.5, 16);
        const tankL = new THREE.Mesh(tankGeo, chromeMat);
        tankL.rotation.x = Math.PI / 2;
        tankL.position.set(-cabinW * 0.45, 1.8, cabZ + (cabinL / 2) + (chassisL / 2));
        cabinGroup.add(tankL);
        const tankR = new THREE.Mesh(tankGeo, chromeMat);
        tankR.rotation.x = Math.PI / 2;
        tankR.position.set(cabinW * 0.45, 1.8, cabZ + (cabinL / 2) + (chassisL / 2));
        cabinGroup.add(tankR);
        
        // Red Racing Stripe on Lower Body
        const stripeGeo = new THREE.BoxGeometry(cabinW * 1.02, 0.5, cabinL * 1.02);
        const stripe = new THREE.Mesh(stripeGeo, cabRedMat);
        stripe.position.set(0, (cabinH * 0.45) + 1.2, cabZ);
        cabinGroup.add(stripe);
        
        // Red Accent Stripe angling up at the back
        const angleStripeGeo = new THREE.BoxGeometry(0.6, cabinH * 0.45, cabinL * 0.3);
        const angleStripeL = new THREE.Mesh(angleStripeGeo, cabRedMat);
        angleStripeL.position.set(-cabinW / 2 + 0.1, cabinH * 0.75 + 1.2, cabZ + (cabinL / 2) - 0.6);
        cabinGroup.add(angleStripeL);
        const angleStripeR = new THREE.Mesh(angleStripeGeo, cabRedMat);
        angleStripeR.position.set(cabinW / 2 - 0.1, cabinH * 0.75 + 1.2, cabZ + (cabinL / 2) - 0.6);
        cabinGroup.add(angleStripeR);
        
        // Aerodynamic Roof Deflector (White with Red Wing Tip)
        const deflectorH = cabinH * 0.25;
        const deflectorGeo = new THREE.BoxGeometry(cabinW * 0.95, deflectorH, cabinL * 0.9);
        const deflector = new THREE.Mesh(deflectorGeo, cabWhiteMat);
        deflector.position.set(0, cabinH + 1.2 + (deflectorH / 2) - 0.3, cabZ + 0.5);
        deflector.rotation.x = -Math.PI / 10;
        cabinGroup.add(deflector);
        
        const deflectorWingGeo = new THREE.BoxGeometry(cabinW * 0.96, 0.1, 0.4);
        const deflectorWing = new THREE.Mesh(deflectorWingGeo, cabRedMat);
        deflectorWing.position.set(0, cabinH + 1.2 + deflectorH - 0.2, cabZ + 0.9);
        cabinGroup.add(deflectorWing);
        
        // Clear Windshield (Ultra-transparent glass so driver is 100% visible)
        const windowGeo = new THREE.PlaneGeometry(cabinW - 0.6, cabinH * 0.42);
        const windowMat = new THREE.MeshStandardMaterial({ 
            color: 0x38bdf8, 
            roughness: 0.05, 
            metalness: 0.1, 
            transparent: true, 
            opacity: 0.22,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const windshield = new THREE.Mesh(windowGeo, windowMat);
        windshield.position.set(0, cabinH * 0.76 + 1.2, cabZ - cabinL / 2 + 0.02);
        cabinGroup.add(windshield);
        
        // --- 3D Driver Figure in the Driver Seat ---
        const driverGroup = new THREE.Group();
        const driverSeatX = 1.0; // Right-hand driver
        const driverSeatY = (cabinH * 0.55) + 1.2;
        const driverSeatZ = cabZ - 0.8;
        driverGroup.position.set(driverSeatX, driverSeatY, driverSeatZ);
        
        // 1. Driver Seat (Black Leather with Headrest)
        const seatMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
        const seatBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.3), seatMat);
        seatBase.position.set(0, 0.15, 0);
        driverGroup.add(seatBase);
        const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.25), seatMat);
        seatBack.position.set(0, 1.0, 0.5);
        driverGroup.add(seatBack);
        const headRest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.2), seatMat);
        headRest.position.set(0, 2.1, 0.5);
        driverGroup.add(headRest);
        
        // 2. Driver Torso with Hi-Vis Safety Vest (Bright Neon Yellow with Silver Reflective Stripes)
        const hiVisMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3 }); // Fluorescent yellow safety vest
        const shirtMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 }); // Navy blue sleeves
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.9 }); // Reflective silver tape
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.5 }); // Skin
        
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 0.7), hiVisMat);
        torso.position.set(0, 0.85, 0.1);
        driverGroup.add(torso);
        
        // Reflective Horizontal Stripes on Safety Vest
        const vestStripeH1 = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.12, 0.72), stripeMat);
        vestStripeH1.position.set(0, 0.9, 0.1);
        driverGroup.add(vestStripeH1);
        const vestStripeH2 = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.12, 0.72), stripeMat);
        vestStripeH2.position.set(0, 0.55, 0.1);
        driverGroup.add(vestStripeH2);
        
        // Vertical Harness Reflective Stripes
        const vestStripeVL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.74), stripeMat);
        vestStripeVL.position.set(-0.35, 1.15, 0.1);
        driverGroup.add(vestStripeVL);
        const vestStripeVR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.74), stripeMat);
        vestStripeVR.position.set(0.35, 1.15, 0.1);
        driverGroup.add(vestStripeVR);
        
        // 3. Driver Arms & Steering Hands
        const armGeo = new THREE.BoxGeometry(0.24, 0.8, 0.24);
        const armL = new THREE.Mesh(armGeo, shirtMat);
        armL.position.set(-0.6, 0.75, -0.2);
        armL.rotation.x = -Math.PI / 4;
        driverGroup.add(armL);
        
        const armR = new THREE.Mesh(armGeo, shirtMat);
        armR.position.set(0.6, 0.75, -0.2);
        armR.rotation.x = -Math.PI / 4;
        driverGroup.add(armR);
        
        const handGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
        const handL = new THREE.Mesh(handGeo, skinMat);
        handL.position.set(-0.55, 0.45, -0.5);
        driverGroup.add(handL);
        const handR = new THREE.Mesh(handGeo, skinMat);
        handR.position.set(0.55, 0.45, -0.5);
        driverGroup.add(handR);
        
        // 4. Steering Wheel (Angled Towards Driver)
        const steerGroup = new THREE.Group();
        steerGroup.position.set(0, 0.5, -0.55);
        steerGroup.rotation.x = -Math.PI / 3.5;
        const steerRingGeo = new THREE.TorusGeometry(0.48, 0.06, 8, 20);
        const steerRing = new THREE.Mesh(steerRingGeo, seatMat);
        steerGroup.add(steerRing);
        const steerCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), chromeMat);
        steerCenter.rotation.x = Math.PI / 2;
        steerGroup.add(steerCenter);
        driverGroup.add(steerGroup);
        
        // 5. Driver Head
        const headGeo = new THREE.SphereGeometry(0.36, 16, 16);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.8, 0.1);
        driverGroup.add(head);
        
        // Driver Eyes
        const eyeGeo = new THREE.SphereGeometry(0.045, 10, 10);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x18181b });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.11, 1.84, -0.23);
        driverGroup.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.11, 1.84, -0.23);
        driverGroup.add(eyeR);
        
        // 6. Iconic 3D Trucker Moustache
        const moustacheMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
        const moustacheGroup = new THREE.Group();
        moustacheGroup.position.set(0, 1.72, -0.24);
        
        // Left Wing of Moustache
        const stacheL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.18, 12), moustacheMat);
        stacheL.rotation.z = Math.PI / 3;
        stacheL.rotation.y = -Math.PI / 8;
        stacheL.position.set(-0.09, -0.02, 0);
        moustacheGroup.add(stacheL);
        
        // Right Wing of Moustache
        const stacheR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.18, 12), moustacheMat);
        stacheR.rotation.z = -Math.PI / 3;
        stacheR.rotation.y = Math.PI / 8;
        stacheR.position.set(0.09, -0.02, 0);
        moustacheGroup.add(stacheR);
        
        // Center Bushy Bridge
        const stacheCenter = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), moustacheMat);
        stacheCenter.scale.set(1.4, 0.8, 1.0);
        stacheCenter.position.set(0, 0, 0.01);
        moustacheGroup.add(stacheCenter);
        
        driverGroup.add(moustacheGroup);
        
        // 7. Safety Cap / Hard Hat (Yellow Helmet with Brim)
        const capMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.1 });
        const capDomeGeo = new THREE.SphereGeometry(0.42, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const capDome = new THREE.Mesh(capDomeGeo, capMat);
        capDome.position.set(0, 1.9, 0.1);
        driverGroup.add(capDome);
        
        const capBrimGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.06, 16);
        const capBrim = new THREE.Mesh(capBrimGeo, capMat);
        capBrim.position.set(0, 1.88, 0.02);
        driverGroup.add(capBrim);
        
        cabinGroup.add(driverGroup);
        
        // Chrome Sun Visor over Windshield
        const visorGeo = new THREE.BoxGeometry(cabinW * 0.9, 0.2, 0.6);
        const visor = new THREE.Mesh(visorGeo, chromeMat);
        visor.position.set(0, cabinH * 0.96 + 1.2, cabZ - cabinL / 2 - 0.2);
        visor.rotation.x = Math.PI / 16;
        cabinGroup.add(visor);
        
        // Front Grille (Large Chrome block)
        const grilleGeo = new THREE.BoxGeometry(cabinW * 0.6, cabinH * 0.3, 0.2);
        const grille = new THREE.Mesh(grilleGeo, chromeMat);
        grille.position.set(0, cabinH * 0.25 + 1.2, cabZ - cabinL / 2 - 0.05);
        cabinGroup.add(grille);
        
        // Grille Lines (Dark horizontal slits)
        const grilleLineGeo = new THREE.BoxGeometry(cabinW * 0.55, 0.04, 0.3);
        const grilleLineMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        for(let i=0; i<5; i++) {
            let gLine = new THREE.Mesh(grilleLineGeo, grilleLineMat);
            gLine.position.set(0, cabinH * 0.15 + 1.2 + (i * 0.06), cabZ - cabinL / 2 - 0.05);
            cabinGroup.add(gLine);
        }
        
        // Bumper (Chrome with Red Lower Lip)
        const bumperGeo = new THREE.BoxGeometry(cabinW * 1.05, cabinH * 0.15, 0.4);
        const bumper = new THREE.Mesh(bumperGeo, chromeMat);
        bumper.position.set(0, cabinH * 0.05 + 1.2, cabZ - cabinL / 2 - 0.1);
        cabinGroup.add(bumper);
        
        const bumperLipGeo = new THREE.BoxGeometry(cabinW * 1.06, 0.15, 0.45);
        const bumperLip = new THREE.Mesh(bumperLipGeo, cabRedMat);
        bumperLip.position.set(0, cabinH * 0.05 + 1.2 - 0.4, cabZ - cabinL / 2 - 0.1);
        cabinGroup.add(bumperLip);
        
        // Front License Plate (DEMONSTRATION PURPOSE ONLY - Unmirrored)
        const frontPlate = createPlateMesh('DEMONSTRATION PURPOSE ONLY', 3.4, 0.7);
        frontPlate.rotation.y = Math.PI; // Face forward
        frontPlate.position.set(0, cabinH * 0.05 + 1.2, cabZ - cabinL / 2 - 0.32);
        cabinGroup.add(frontPlate);
        
        // Silver Bullbar (Grille Guard)
        const barRad = 0.08;
        const barGeo = new THREE.CylinderGeometry(barRad, barRad, cabinW, 8);
        
        // Horizontal Bullbars
        for(let i=0; i<3; i++) {
            let hBar = new THREE.Mesh(barGeo, chromeMat);
            hBar.rotation.z = Math.PI / 2;
            hBar.position.set(0, cabinH * 0.1 + 1.2 + (i * 0.35), cabZ - cabinL / 2 - 0.6);
            cabinGroup.add(hBar);
        }
        // Vertical Bullbars
        const vBarGeo = new THREE.CylinderGeometry(barRad, barRad, cabinH * 0.5 + 0.3, 8);
        const vPositions = [-cabinW*0.45, -cabinW*0.25, cabinW*0.25, cabinW*0.45];
        vPositions.forEach(px => {
            let vBar = new THREE.Mesh(vBarGeo, chromeMat);
            vBar.position.set(px, cabinH * 0.25 + 1.2, cabZ - cabinL / 2 - 0.65);
            cabinGroup.add(vBar);
        });
        
        // Headlights
        const lightGeo = new THREE.BoxGeometry(1.2, 0.5, 0.2);
        const lightMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.8 });
        
        const lightL = new THREE.Mesh(lightGeo, lightMat);
        lightL.position.set(-cabinW * 0.35, cabinH * 0.05 + 1.2, cabZ - cabinL / 2 - 0.31);
        cabinGroup.add(lightL);
        
        const lightR = new THREE.Mesh(lightGeo, lightMat);
        lightR.position.set(cabinW * 0.35, cabinH * 0.05 + 1.2, cabZ - cabinL / 2 - 0.31);
        cabinGroup.add(lightR);
        
        // Turn signals (orange)
        const turnMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.5 });
        const turnL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.2), turnMat);
        turnL.position.set(-cabinW * 0.42, cabinH * 0.18 + 1.2, cabZ - cabinL / 2 - 0.05);
        cabinGroup.add(turnL);
        const turnR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.2), turnMat);
        turnR.position.set(cabinW * 0.42, cabinH * 0.18 + 1.2, cabZ - cabinL / 2 - 0.05);
        cabinGroup.add(turnR);
        
        // Exhaust Pipes (Dual Smokestacks) - Taller and positioned correctly
        const exhaustGeo = new THREE.CylinderGeometry(0.2, 0.2, 5.5, 12);
        const exhaustL = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustL.position.set(-cabinW/2 - 0.3, cabinH * 0.9 + 1.2, cabZ + cabinL/4);
        cabinGroup.add(exhaustL);
        
        const exhaustR = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustR.position.set(cabinW/2 + 0.3, cabinH * 0.9 + 1.2, cabZ + cabinL/4);
        cabinGroup.add(exhaustR);
        
        // // Wheels
        const wheelGeo = new THREE.CylinderGeometry(1.5, 1.5, 1, 24);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
        
        // Grey Rim
        const rimGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.1, 16);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.7, metalness: 0.2 });
        
        // Hubcap detail
        const hubGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.15, 8);
        
        const is20ft = (this.selectedTruckType === '20GP');
        const trailerWheelPositions = is20ft ? [
            [-truckW/2 - 0.2, 1.5, truckL/2 - 3.5], // Trailer Rear Left (Single Axle)
            [truckW/2 + 0.2, 1.5, truckL/2 - 3.5]  // Trailer Rear Right
        ] : [
            [-truckW/2 - 0.2, 1.5, truckL/2 - 4],    // Trailer Rear Left
            [truckW/2 + 0.2, 1.5, truckL/2 - 4],     // Trailer Rear Right
            [-truckW/2 - 0.2, 1.5, truckL/2 - 8],    // Trailer Rear Left 2
            [truckW/2 + 0.2, 1.5, truckL/2 - 8]      // Trailer Rear Right 2
        ];
        
        const wheelPositions = [
            [-cabinW/2 - 0.2, 1.5, cabZ - cabinL/3], // Front steer left
            [cabinW/2 + 0.2, 1.5, cabZ - cabinL/3],  // Front steer right
            [-cabinW/2 - 0.2, 1.5, cabZ + cabinL/2 + chassisL/4], // Drive axle 1 left (under chassis)
            [cabinW/2 + 0.2, 1.5, cabZ + cabinL/2 + chassisL/4],  // Drive axle 1 right
            [-cabinW/2 - 0.2, 1.5, cabZ + cabinL/2 + chassisL*0.8], // Drive axle 2 left (under chassis)
            [cabinW/2 + 0.2, 1.5, cabZ + cabinL/2 + chassisL*0.8],  // Drive axle 2 right
            ...trailerWheelPositions
        ];
        
        this.truckWheels = [];
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Group();
            
            const tireMesh = new THREE.Mesh(wheelGeo, wheelMat);
            tireMesh.castShadow = true;
            wheel.add(tireMesh);
            
            const rimMesh = new THREE.Mesh(rimGeo, rimMat);
            wheel.add(rimMesh);
            
            const hubMesh = new THREE.Mesh(hubGeo, rimMat);
            wheel.add(hubMesh);
            
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos[0], pos[1], pos[2]);
            cabinGroup.add(wheel);
            
            this.truckWheels.push(wheel);
        });
        
        // Headlights & Spotlights export
        this.headlightsMat = lightMat;
        this.turnSignalsMat = turnMat;
        
        this.spotlights = [];
        const spotL = new THREE.SpotLight(0xffffff, 0, 100, Math.PI/4, 0.5, 1);
        spotL.position.set(-cabinW * 0.35, cabinH * 0.05 + 1, cabZ - cabinL / 2 - 0.4);
        spotL.target.position.set(-cabinW * 0.35, 0, cabZ - 50);
        cabinGroup.add(spotL);
        cabinGroup.add(spotL.target);
        this.spotlights.push(spotL);
        
        const spotR = new THREE.SpotLight(0xffffff, 0, 100, Math.PI/4, 0.5, 1);
        spotR.position.set(cabinW * 0.35, cabinH * 0.05 + 1, cabZ - cabinL / 2 - 0.4);
        spotR.target.position.set(cabinW * 0.35, 0, cabZ - 50);
        cabinGroup.add(spotR);
        cabinGroup.add(spotR.target);
        this.spotlights.push(spotR);
        
        // Taillights & Rear License Plate
        this.taillightsMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 0.3 });
        const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.2), this.taillightsMat);
        tailL.position.set(-truckW/2 + 0.6, truckElevation + 0.3, truckL/2 + 0.1);
        truckMasterGroup.add(tailL);
        const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.2), this.taillightsMat);
        tailR.position.set(truckW/2 - 0.6, truckElevation + 0.3, truckL/2 + 0.1);
        truckMasterGroup.add(tailR);
        
        const rearPlate = createPlateMesh('DEMONSTRATION PURPOSE ONLY', 3.2, 0.65);
        rearPlate.rotation.y = Math.PI; // Face backwards
        rearPlate.position.set(0, truckElevation + 0.35, truckL / 2 + 0.15);
        truckMasterGroup.add(rearPlate);
        
        // Road Lines
        this.roadGroup = new THREE.Group();
        const lineGeo = new THREE.PlaneGeometry(0.4, 4);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for(let i=0; i<15; i++) {
            let line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.05, -80 + i * 10);
            this.roadGroup.add(line);
        }
        scene.add(this.roadGroup);
        this.roadGroup.visible = false;
        
        // Smoke Particles
        this.smokeParticles = [];
        const smokeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const smokeMatTemplate = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0 });
        for(let i=0; i<30; i++) {
           let p = new THREE.Mesh(smokeGeo, smokeMatTemplate.clone());
           p.position.set(0, -100, 0); 
           p.userData = { life: 0, active: false };
           scene.add(p);
           this.smokeParticles.push(p);
        }
        
        // To use inside animate loop
        this.cabinGroupRef = cabinGroup;
        this.leftDoorHingeRef = leftHinge;
        this.rightDoorHingeRef = rightHinge;
        
        this.cabinWRef = cabinW;
        this.cabinHRef = cabinH;
        this.cabZRef = cabZ;
        this.cabinLRef = cabinL;
        
        
        truckMasterGroup.add(cabinGroup);

        
        const palletsGroup = new THREE.Group();
        palletsGroup.position.set(0, truckElevation, 0);
        truckMasterGroup.add(palletsGroup);
        this.palletsGroupRef = palletsGroup;
        const palletMeshes = [];

        this.renderPalletsLayout = () => {
            // Loading simulation holds references to pallet groups — stop it before rebuilding
            if (this.loadingSim) this.stopLoadingSim(true);
            const missingTieHighTracker = new Set();
            while(palletsGroup.children.length > 0){ 
                palletsGroup.remove(palletsGroup.children[0]); 
            }
            palletMeshes.length = 0;
            
            let currentZ = -(truckL / 2) + 0.2;
            let currentX = -(truckW / 2) + 0.2;
            let maxLInRow = 0;
            let rowCount = 0;

            let overflowDOs = new Set();
            let overflowPallets = [];
            this.palletsToPlace.forEach((p, index) => {
                let baseW = p.width ? (p.width / 30.48) : palletW;
                let baseL = p.length ? (p.length / 30.48) : palletL;
                
                // For TV Display and Mixed TV pallets, constrain pallet width to truck half-lane
                const maxLaneW = (truckW / 2) - 0.3; // ~113 cm
                if ((p.type === 'TV DISPLAY' || p.isTvMixed) && !p.rotated) {
                    if (baseW > maxLaneW) {
                        baseW = maxLaneW;
                    }
                }
                
                const w = p.rotated ? baseL : baseW;
                const l = p.rotated ? baseW : baseL;
                
                if (currentX + w > (truckW / 2) - 0.2 && currentX > -(truckW / 2) + 0.2) {
                    currentX = -(truckW / 2) + 0.2;
                    currentZ += maxLInRow + 0.2;
                    maxLInRow = 0;
                    rowCount++;
                }
                
                if (l > maxLInRow) maxLInRow = l;
                
                let pColor = hifiColor;
                if (p.isSmallMixed) pColor = 0xd4b483; // Same as TV/HiFi
                else if (p.isTvMixed) pColor = tvColor;
                else if (p.isMixed) pColor = 0xd4b483; // Light brown instead of green
                else if (p.type === 'TV DISPLAY') pColor = tvColor;
                else if (p.type === 'HIFI' || p.type === 'HIFI AUDIO' || (p.description && p.description.includes("(Partial)"))) pColor = hifiColor;
                
                if (currentZ + l > (truckL / 2)) {
                    pColor = overflowColor;
                    if (p.inv && p.inv !== "MANUAL") overflowDOs.add(p.inv);
                    if (p.invs) p.invs.forEach(inv => {
                        if (inv !== "MANUAL") overflowDOs.add(inv);
                    });
                    overflowPallets.push(p);
                }
                
                const xPos = currentX + (w / 2);
                const zPos = currentZ + (l / 2);
                
                let currentTie = null;
                let currentHigh = null;
                // Re-resolve Tie/High from master data at render time. The order's own
                // tie/high are only a snapshot taken when the order was created; if the
                // master-data model gained Tie/High afterwards (or the order predates it),
                // the snapshot is empty and the renderer would fall back to a single-layer
                // "qty-wide" row (the 8-pattern). Prefer live master data, fall back to snapshot.
                let resolvedTie = p.tie;
                let resolvedHigh = p.high;
                if (this.masterData) {
                    const mDataForTieHigh = this.masterData.find(m => m.code === p.code);
                    if (mDataForTieHigh) {
                        if (mDataForTieHigh.tie) resolvedTie = mDataForTieHigh.tie;
                        if (mDataForTieHigh.high) resolvedHigh = mDataForTieHigh.high;
                    }
                }
                if (!p.isMixed && resolvedTie && resolvedHigh) {
                    let originalCaps = p.rawCaps;
                    if (this.masterData) {
                        const mData = this.masterData.find(m => m.code === p.code);
                        if (mData && mData.capacities) {
                            originalCaps = mData.capacities.map(c => parseInt(c)).filter(c => !isNaN(c) && c > 0);
                        }
                    }
                    const capIndex = originalCaps.indexOf(p.selectedCap);
                    const idx = capIndex !== -1 ? capIndex : 0;
                    const ties = String(resolvedTie).split(',').map(s => parseInt(s.trim()));
                    const highs = String(resolvedHigh).split(',').map(s => parseInt(s.trim()));
                    currentTie = ties[idx] || ties[0];
                    currentHigh = highs[idx] || highs[0];
                }
                
                let isMissingTieHigh = false;
                if (!p.isMixed && (!currentTie || !currentHigh || isNaN(currentTie) || isNaN(currentHigh) || currentTie <= 0 || currentHigh <= 0)) {
                    isMissingTieHigh = true;
                    if (p.type === 'TV DISPLAY' && p.qty > 0) {
                        currentHigh = 1;
                        currentTie = p.qty; // Smart Fallback
                    }
                }
                
                if (isMissingTieHigh) {
                    missingTieHighTracker.add(p.description || p.code || 'Unknown Item');
                }

                const groupObj = new THREE.Group();
                groupObj.position.set(xPos, 0, zPos);
                if (p.rotated) { groupObj.rotation.y = -Math.PI / 2; }
                const buildW = baseW;
                const buildL = baseL;
                
                if (p.isTvMixed && p.tvItems && p.tvItems.length > 0) {
                    const baseHeight = 15 / 30.48;
                    const baseMesh = createRealisticPallet(buildW, baseHeight, buildL);
                    groupObj.add(baseMesh);

                    let maxTvHeight = 0; // Track the tallest TV column on this pallet

                    // Sort items largest to smallest by volume to pack cleanly
                    let sortedTvItems = [...p.tvItems].sort((a,b) => {
                        let volA = (a.cartonW||20) * (a.cartonL||50) * (a.cartonH||50);
                        let volB = (b.cartonW||20) * (b.cartonL||50) * (b.cartonH||50);
                        return volB - volA;
                    });

                    // ── Helper: resolve a TV item's carton dims (cm), applying the
                    // same fallbacks the rest of the planner uses (tie-based, then
                    // inch-based from the model name). ──────────────────────────
                    const resolveTvDims = (tvItem) => {
                        let cW_cm = tvItem.cartonW;
                        let cL_cm = tvItem.cartonL;
                        let cH_cm = tvItem.cartonH;

                        let tie = tvItem.tie ? parseInt(tvItem.tie) : null;
                        let high = tvItem.high ? parseInt(tvItem.high) : 1;
                        let pW_check = tvItem.width || tvItem.palletW || (buildW * 30.48);
                        let pL_check = tvItem.length || tvItem.palletL || (buildL * 30.48);

                        if (!cW_cm || !cL_cm) {
                            if (tie && !isNaN(tie) && tie > 0) {
                                let bCols = tie > 12 ? Math.ceil(tie / 2) : tie;
                                let bRows = tie > 12 ? 2 : 1;
                                cW_cm = pW_check / bCols;
                                cL_cm = pL_check / bRows;
                            }
                        }

                        if (!cW_cm || !cL_cm) {
                            const sizeStr = extractTVSize(tvItem.description || tvItem.code);
                            const inch = parseInt(sizeStr) || 50;
                            cL_cm = inch * 2.5;
                            cW_cm = 20;
                        }

                        if (!cH_cm) {
                            const sizeStr = extractTVSize(tvItem.description || tvItem.code);
                            const inch = parseInt(sizeStr) || 50;
                            cH_cm = inch * 1.6;
                            if (cH_cm > (palletH - baseHeight) * 30.48) {
                                cH_cm = (palletH - baseHeight) * 30.48 / (high || 1);
                            }
                        }

                        // Thin dimension is always the width (TVs pack on-edge)
                        if (cW_cm > cL_cm) { const t = cL_cm; cL_cm = cW_cm; cW_cm = t; }

                        return {
                            cW: cW_cm / 30.48,
                            cL: cL_cm / 30.48,
                            cH: cH_cm / 30.48,
                            tie: (tie && !isNaN(tie) && tie > 0) ? tie : null,
                            high: (high && !isNaN(high) && high > 0) ? high : 1,
                        };
                    };

                    // ── Decide layout mode ─────────────────────────────────────
                    // If every model on this pallet has a usable Tie, stack each model
                    // as its own column block honoring that model's Tie × High. Otherwise
                    // fall back to the original flat single-row layout.
                    const itemsWithDims = sortedTvItems.map((tvItem) => ({ item: tvItem, ...resolveTvDims(tvItem) }));
                    const allHaveTie = itemsWithDims.length > 0 && itemsWithDims.every(d => d.tie !== null);

                    if (allHaveTie) {
                        // ══ PROTOTYPE: Per-model Tie × High column stacking ═══════════
                        // Build one column block per model. Each block is sized to its
                        // own Tie (cartons across) and stacked High layers vertically.
                        const blocks = itemsWithDims.map((d) => {
                            const qty = d.item.qty || 1;
                            // Columns (cartons across) = Tie, but never more than the qty
                            const cols = Math.max(1, Math.min(d.tie, qty));
                            const layers = Math.max(1, Math.min(d.high, Math.ceil(qty / cols)));
                            const blockW = cols * d.cW;      // total width of this model's block
                            const blockH = layers * d.cH;    // total stacked height
                            if (blockH > maxTvHeight) maxTvHeight = blockH;
                            return { d, qty, cols, layers, blockW, blockH };
                        });

                        const totalBlocksW = blocks.reduce((s, b) => s + b.blockW, 0);

                        blocks.forEach((blk) => {
                            const { d, qty, cols, layers } = blk;
                            // Scale this block's width to share pallet width proportionally
                            // (only if the blocks collectively exceed the pallet width).
                            const widthScale = totalBlocksW > buildW ? (buildW / totalBlocksW) : 1;
                            const slotBlockW = blk.blockW * widthScale;
                            const boxW = Math.min(d.cW * 0.95, (slotBlockW / cols) * 0.95);
                            const boxL = Math.min(d.cL * 0.98, buildL * 0.98);
                            const boxH = d.cH * 0.98;

                            const boxGeo = new THREE.BoxGeometry(boxW, boxH, boxL);
                            const edges = new THREE.EdgesGeometry(boxGeo);
                            const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                            const boxMat = createCartonMaterial('TV DISPLAY', d.item.description || d.item.code, tvColor);

                            // X origin of this block along the pallet width
                            const blockOriginX = -(buildW / 2) + 0.025 + (blocks.slice(0, blocks.indexOf(blk)).reduce((s, b) => s + b.blockW * widthScale, 0));

                            let placed = 0;
                            for (let layer = 0; layer < layers && placed < qty; layer++) {
                                for (let col = 0; col < cols && placed < qty; col++) {
                                    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
                                    boxMesh.add(new THREE.LineSegments(edges, lineMat));

                                    const bx = blockOriginX + (col + 0.5) * (slotBlockW / cols);
                                    const bz = 0; // centered along pallet length
                                    const by = baseHeight + (layer * d.cH) + (boxH / 2);

                                    boxMesh.position.set(bx, by, bz);
                                    boxMesh.castShadow = true;
                                    boxMesh.receiveShadow = true;
                                    groupObj.add(boxMesh);
                                    placed++;
                                }
                            }
                        });

                    } else {
                        // ══ FALLBACK: original flat single-row layout ═════════════════
                        // (used when one or more models lack Tie data)
                        let allTvUnits = [];
                        for (let d of itemsWithDims) {
                            if (d.cH > maxTvHeight) maxTvHeight = d.cH;
                            for (let q = 0; q < (d.item.qty || 1); q++) {
                                allTvUnits.push({ item: d.item, cW: d.cW, cL: d.cL, cH: d.cH });
                            }
                        }

                        const totalTvCount = allTvUnits.length;
                        if (totalTvCount > 0) {
                            const slotWidth = (buildW - 0.05) / totalTvCount;
                            allTvUnits.forEach((unit, idx) => {
                                const tvMat = createCartonMaterial('TV DISPLAY', unit.item.description || unit.item.code, tvColor);
                                const boxW = Math.min(unit.cW * 0.95, slotWidth * 0.95);
                                const boxL = Math.min(unit.cL * 0.98, buildL * 0.98);
                                const boxH = unit.cH * 0.98;

                                const boxGeo = new THREE.BoxGeometry(boxW, boxH, boxL);
                                const edges = new THREE.EdgesGeometry(boxGeo);
                                const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                                const boxMesh = new THREE.Mesh(boxGeo, tvMat);
                                boxMesh.add(new THREE.LineSegments(edges, lineMat));

                                const bx = -(buildW / 2) + 0.025 + (idx + 0.5) * slotWidth;
                                const bz = 0; // Centered along pallet length (Z-axis)
                                const by = baseHeight + (boxH / 2);

                                boxMesh.position.set(bx, by, bz);
                                boxMesh.castShadow = true;
                                boxMesh.receiveShadow = true;
                                groupObj.add(boxMesh);
                            });
                        }
                    }

                    // ── Accessories (otherItems) top-loaded on the TV stack ──────────
                    // PRIORITY 2: render each accessory as a REAL, individually-sized box
                    // (using resolveDims confidence tiers) instead of a fixed 45cm ghost.
                    // Fall back to the aggregate ghost slab only when the real boxes
                    // cannot fit in the remaining vertical space.
                    if (p.otherItems && p.otherItems.length > 0) {
                        if (maxTvHeight <= 0) maxTvHeight = (palletH - baseHeight);

                        const stackBaseY = baseHeight + maxTvHeight;       // top of the TVs
                        const availableH = Math.max(0, palletH - stackBaseY); // headroom above TVs

                        // Expand to individual accessory units with resolved dims
                        let accessoryUnits = [];
                        p.otherItems.forEach(it => {
                            const dims = resolveDims(it);
                            for (let k = 0; k < (it.qty || 1); k++) {
                                accessoryUnits.push({ item: it, dims });
                            }
                        });
                        // Largest footprint first for stable packing
                        accessoryUnits.sort((a, b) => (b.dims.L * b.dims.W) - (a.dims.L * a.dims.W));

                        // Greedy shelf-pack across the pallet footprint (X/Z), stacking
                        // upward in layers. Layer height = tallest unit placed in it.
                        const margin = 0.05;
                        let curX = -(buildW / 2) + margin;
                        let curZ = -(buildL / 2) + margin;
                        let layerBaseY = stackBaseY;
                        let rowMaxH = 0;
                        let rowMaxL = 0;
                        let overflow = false;
                        const placedBoxes = [];

                        accessoryUnits.forEach(u => {
                            let bw = u.dims.W * 0.98;
                            let bl = u.dims.L * 0.98;
                            let bh = u.dims.H * 0.98;

                            if (curX + bw > (buildW / 2) - margin) {        // wrap row (new Z line)
                                curX = -(buildW / 2) + margin;
                                curZ += rowMaxL + 0.02;
                                rowMaxL = 0;
                            }
                            if (curZ + bl > (buildL / 2) - margin) {        // wrap layer (new Y)
                                curZ = -(buildL / 2) + margin;
                                layerBaseY += rowMaxH;
                                rowMaxH = 0;
                            }
                            if (layerBaseY + bh > palletH) { overflow = true; return; }

                            placedBoxes.push({ u, bw, bl, bh, x: curX + bw / 2, y: layerBaseY + bh / 2, z: curZ + bl / 2 });
                            curX += bw + 0.02;
                            if (bh > rowMaxH) rowMaxH = bh;
                            if (bl > rowMaxL) rowMaxL = bl;
                        });

                        if (!overflow && placedBoxes.length === accessoryUnits.length && accessoryUnits.length > 0) {
                            // ── Real per-accessory boxes (translucent when estimated) ──
                            placedBoxes.forEach(pb => {
                                const geo = new THREE.BoxGeometry(pb.bw, pb.bh, pb.bl);
                                const mat = createEstimatedCartonMaterial(hifiColor, pb.u.dims.source);
                                const mesh = new THREE.Mesh(geo, mat);
                                const edge = new THREE.LineSegments(
                                    new THREE.EdgesGeometry(geo),
                                    new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
                                );
                                mesh.add(edge);
                                mesh.position.set(pb.x, pb.y, pb.z);
                                mesh.castShadow = true;
                                mesh.receiveShadow = true;
                                groupObj.add(mesh);
                            });
                        } else {
                            // ── LAST RESORT: aggregate ghost slab (no room for real boxes) ──
                            let ghostD = buildL * 0.8;
                            let ghostW = buildW * 0.8;
                            let ghostH = Math.min(45 / 30.48, availableH > 0 ? availableH : 45 / 30.48);

                            const ghostGeo = new THREE.BoxGeometry(ghostW, ghostH, ghostD);
                            const ghostMat = createEstimatedCartonMaterial(hifiColor, 'ghost');
                            const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);

                            const ghostEdges = new THREE.EdgesGeometry(ghostGeo);
                            const ghostLineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                            const ghostLineMesh = new THREE.LineSegments(ghostEdges, ghostLineMat);
                            ghostMesh.add(ghostLineMesh);

                            ghostMesh.position.set(0, stackBaseY + (ghostH / 2), 0);
                            groupObj.add(ghostMesh);

                            // Surface in the tooltip how many accessories were collapsed
                            // into the ghost slab so they aren't silently floating.
                            groupObj.userData = groupObj.userData || {};
                            groupObj.userData.ghostedAccessoryCount = accessoryUnits.length;
                        }
                    }

                } else if (currentTie && currentHigh && !isNaN(currentTie) && !isNaN(currentHigh) && currentTie > 0 && currentHigh > 0) {
                    const baseHeight = 15 / 30.48; 
                    const baseMesh = createRealisticPallet(buildW, baseHeight, buildL);
                    groupObj.add(baseMesh);
                    
                    let cL = p.cartonL ? (p.cartonL / 30.48) : null;
                    let cW = p.cartonW ? (p.cartonW / 30.48) : null;
                    let cH = p.cartonH ? (p.cartonH / 30.48) : null;
                    
                    let bestRows = 1;
                    let bestCols = currentTie;
                    
                    if (p.type !== 'TV DISPLAY') {
                        let minDiff = Infinity;
                        for (let r = 1; r <= currentTie; r++) {
                            if (currentTie % r === 0) {
                                const c = currentTie / r;
                                const diff = Math.abs(r - c);
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    bestRows = r;
                                    bestCols = c;
                                }
                            }
                        }
                    } else {
                        bestRows = 1;
                        bestCols = currentTie;
                    }
                    
                    if (!cL || !cW) {
                        cW = buildW / bestCols;
                        cL = buildL / bestRows;
                    }
                    
                    if (!cH || isNaN(cH) || cH <= 0) {
                        cH = (palletH - baseHeight) / currentHigh;
                    }
                    if (isNaN(cW) || cW <= 0) cW = 0.5;
                    if (isNaN(cL) || cL <= 0) cL = 0.5;
                    if (isNaN(cH) || cH <= 0) cH = 0.5;
                    
                    if (p.type !== 'TV DISPLAY') {
                        if ((cW * bestCols > buildW) && (cL * bestCols <= buildW)) {
                             const temp = cL; cL = cW; cW = temp;
                        } else if (bestCols * cL <= buildW && bestRows * cW <= buildL) {
                            const temp = cL; cL = cW; cW = temp;
                        }
                        
                        if (p.cartonL && p.cartonW && ((cW * bestCols > buildW) || (cL * bestRows > buildL))) {
                            cW = buildW / bestCols;
                            cL = buildL / bestRows;
                        }
                        
                        const boxGeo = new THREE.BoxGeometry(cW * 0.98, cH * 0.98, cL * 0.98); 
                        const boxMat = createCartonMaterial(p.type, p.description || p.code, pColor);
                        const edges = new THREE.EdgesGeometry(boxGeo);
                        const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                        
                        let placedCount = 0;
                        for (let layer = 0; layer < currentHigh; layer++) {
                            for (let row = 0; row < bestRows; row++) {
                                for (let col = 0; col < bestCols; col++) {
                                    if (placedCount >= p.qty) break;
                                    
                                    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
                                    const lineMesh = new THREE.LineSegments(edges, lineMat);
                                    boxMesh.add(lineMesh);
                                    
                                    const bx = (col * cW) - (buildW / 2) + (cW / 2);
                                    const bz = (row * cL) - (buildL / 2) + (cL / 2);
                                    const by = baseHeight + (layer * cH) + (cH / 2);
                                    
                                    boxMesh.position.set(bx, by, bz);
                                    boxMesh.castShadow = true;
                                    boxMesh.receiveShadow = true;
                                    groupObj.add(boxMesh);
                                    
                                    placedCount++;
                                }
                            }
                        }
                    } else {
                        // TV DISPLAY: Respect Tie (cartons per layer) & High (vertical layers)
                        if (cW > cL) {
                            const temp = cL; cL = cW; cW = temp;
                        }
                        const slotWidth = (buildW - 0.05) / currentTie;
                        const boxW = Math.min(cW * 0.95, slotWidth * 0.95);
                        const boxL = Math.min(cL * 0.98, buildL * 0.98);
                        const boxH = cH * 0.98;
                        
                        const boxGeo = new THREE.BoxGeometry(boxW, boxH, boxL);
                        const boxMat = createCartonMaterial(p.type, p.description || p.code, pColor);
                        const edges = new THREE.EdgesGeometry(boxGeo);
                        const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                        
                        let placedCount = 0;
                        for (let layer = 0; layer < currentHigh; layer++) {
                            for (let col = 0; col < currentTie; col++) {
                                if (placedCount >= p.qty) break;
                                
                                const boxMesh = new THREE.Mesh(boxGeo, boxMat);
                                boxMesh.add(new THREE.LineSegments(edges, lineMat));
                                
                                const bx = -(buildW / 2) + 0.025 + (col + 0.5) * slotWidth;
                                const bz = 0; // Centered along pallet length
                                const by = baseHeight + (layer * cH) + (boxH / 2);
                                
                                boxMesh.position.set(bx, by, bz);
                                boxMesh.castShadow = true;
                                boxMesh.receiveShadow = true;
                                groupObj.add(boxMesh);
                                
                                placedCount++;
                            }
                        }
                    }
                    
                } else if (p.isSmallMixed && p.items && p.items.length > 0) {
                    const baseHeight = 15 / 30.48; 
                    const baseMesh = createRealisticPallet(buildW, baseHeight, buildL);
                    groupObj.add(baseMesh);
                    
                    let cW = 30 / 30.48;
                    let cL = 30 / 30.48;
                    let cH = 30 / 30.48;
                    
                    let bestCols = Math.floor(buildW / cW);
                    let bestRows = Math.floor(buildL / cL);
                    if (bestCols <= 0) bestCols = 1;
                    if (bestRows <= 0) bestRows = 1;
                    
                    cW = buildW / bestCols;
                    cL = buildL / bestRows;
                    
                    let itemsToPlace = [];
                    p.items.forEach(it => {
                        for (let k = 0; k < it.qty; k++) {
                            itemsToPlace.push(it);
                        }
                    });
                    
                    const boxGeo = new THREE.BoxGeometry(cW * 0.96, cH * 0.96, cL * 0.96);
                    const edges = new THREE.EdgesGeometry(boxGeo);
                    const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                    
                    let placedCount = 0;
                    let targetH = p.h ? p.h : palletH;
                    let maxLayers = Math.ceil((targetH - baseHeight) / cH);
                    if(maxLayers < 1) maxLayers = 1;
                    
                    for (let layer = 0; layer < maxLayers; layer++) {
                        for (let row = 0; row < bestRows; row++) {
                            for (let col = 0; col < bestCols; col++) {
                                if (placedCount >= itemsToPlace.length) break;
                                
                                const it = itemsToPlace[placedCount];
                                let cartonColor = 0xd4b483;
                                const boxMat = createCartonMaterial(it.type || 'SMALL', it.description || it.code, cartonColor);
                                
                                const boxMesh = new THREE.Mesh(boxGeo, boxMat);
                                const lineMesh = new THREE.LineSegments(edges, lineMat);
                                boxMesh.add(lineMesh);
                                
                                const bx = (col * cW) - (buildW / 2) + (cW / 2);
                                const bz = (row * cL) - (buildL / 2) + (cL / 2);
                                const by = baseHeight + (layer * cH) + (cH / 2);
                                
                                boxMesh.position.set(bx, by, bz);
                                boxMesh.castShadow = true;
                                boxMesh.receiveShadow = true;
                                groupObj.add(boxMesh);
                                
                                placedCount++;
                            }
                        }
                    }
                    
                    // Attach A4 labels to the stack
                    const labelW = 3.2;
                    const labelH = 1.6;
                    const labelGeo = new THREE.PlaneGeometry(labelW, labelH);
                    const labelMat = createA4LabelMaterial(p.description);
                    
                    const actualStackH = Math.min(maxLayers * cH, targetH - baseHeight);
                    const labelY = baseHeight + (actualStackH / 2);
                    
                    // Front label (+Z)
                    const frontLabel = new THREE.Mesh(labelGeo, labelMat);
                    frontLabel.position.set(0, labelY, buildL / 2 + 0.01);
                    groupObj.add(frontLabel);
                    
                    // Back label (-Z)
                    const backLabel = new THREE.Mesh(labelGeo, labelMat);
                    backLabel.position.set(0, labelY, -buildL / 2 - 0.01);
                    backLabel.rotation.y = Math.PI;
                    groupObj.add(backLabel);
                    
                    // Left label (-X)
                    const leftLabel = new THREE.Mesh(labelGeo, labelMat);
                    leftLabel.position.set(-buildW / 2 - 0.01, labelY, 0);
                    leftLabel.rotation.y = -Math.PI / 2;
                    groupObj.add(leftLabel);
                    
                    // Right label (+X)
                    const rightLabel = new THREE.Mesh(labelGeo, labelMat);
                    rightLabel.position.set(buildW / 2 + 0.01, labelY, 0);
                    rightLabel.rotation.y = Math.PI / 2;
                    groupObj.add(rightLabel);
                    
                } else {
                    // Wooden Pallet Base Fix for the Generic Block Fallback
                    const baseHeight = 15 / 30.48; 
                    const baseMesh = createRealisticPallet(buildW, baseHeight, buildL);
                    groupObj.add(baseMesh);
                    
                    const blockH = palletH - baseHeight;
                    const geometry = new THREE.BoxGeometry(buildW * 0.98, blockH * 0.98, buildL * 0.98);
                    const material = createCartonMaterial(p.type, p.description || p.code, pColor);
                    const cube = new THREE.Mesh(geometry, material);
                    
                    const edges = new THREE.EdgesGeometry(geometry);
                    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 }));
                    cube.add(line);
                    
                    cube.position.set(0, baseHeight + (blockH / 2), 0);
                    cube.castShadow = true;
                    cube.receiveShadow = true;
                    groupObj.add(cube);
                }
                const hitGeo = new THREE.BoxGeometry(buildW, palletH, buildL);
                const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.set(0, palletH / 2, 0);
                
                hitMesh.userData = {
                    index: index,
                    code: p.code,
                    description: p.description,
                    qty: p.qty,
                    originalColor: pColor,
                    width: p.width,
                    length: p.length,
                    rotated: p.rotated,
                    isMixed: p.isMixed,
                    fillPercent: p.fillPercent,
                    ghostedAccessoryCount: (groupObj.userData && groupObj.userData.ghostedAccessoryCount) || 0,
                    groupObj: groupObj
                };
                
                groupObj.add(hitMesh);
                palletsGroup.add(groupObj);
                palletMeshes.push(hitMesh);
                
                currentX += w + 0.2; 
            });
            
            // UI Warning for Missing Tie/High
            let warningBox = document.getElementById('tieHighWarningBox');
            if (!warningBox) {
                warningBox = document.createElement('div');
                warningBox.id = 'tieHighWarningBox';
                warningBox.style.position = 'absolute';
                warningBox.style.top = '16px';
                warningBox.style.left = '16px';
                warningBox.style.background = 'rgba(239, 68, 68, 0.85)';
                warningBox.style.color = '#fff';
                warningBox.style.padding = '12px 16px';
                warningBox.style.borderRadius = '8px';
                warningBox.style.fontSize = '12px';
                warningBox.style.zIndex = '10';
                warningBox.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
                warningBox.style.maxWidth = '300px';
                warningBox.style.pointerEvents = 'auto';
                
                const container = document.getElementById('truck3dContainer');
                if (container) {
                    container.appendChild(warningBox);
                }
            }
            
            if (missingTieHighTracker.size > 0) {
                const listHtml = Array.from(missingTieHighTracker).map(m => `<li>${m}</li>`).join('');
                warningBox.innerHTML = `<button onclick="this.parentElement.style.display='none'" style="position: absolute; top: 4px; right: 6px; background: none; border: none; color: white; font-size: 16px; line-height: 1; cursor: pointer; opacity: 0.8; padding: 2px 4px;">&times;</button><strong>⚠️ Missing Tie/High Data</strong><br><span style="font-size:11px; opacity:0.9;">The following items lacked Master Data and are using Auto-Fallback sizing:</span><ul style="margin: 6px 0 0 0; padding-left: 16px; font-size: 11px;">${listHtml}</ul>`;
                warningBox.style.display = 'block';
            } else if (warningBox) {
                warningBox.style.display = 'none';
            }
            
            // Render Overflow Suggestion UI
            const oldWarning = document.getElementById('overflowWarningBox');
            if (oldWarning) oldWarning.remove();
            
            const hasOverflow = overflowDOs.size > 0 || (overflowPallets && overflowPallets.length > 0);
            if (hasOverflow && !this.overflowWarningDismissed) {
                const generated = this.generateOverflowHtml(overflowDOs, overflowPallets);
                
                const warningDiv = document.createElement('div');
                warningDiv.id = 'overflowWarningBox';
                warningDiv.style.position = 'absolute';
                warningDiv.style.top = '20px';
                warningDiv.style.left = '50%';
                warningDiv.style.transform = 'translateX(-50%)';
                warningDiv.style.background = 'rgba(239, 68, 68, 0.95)'; 
                warningDiv.style.color = 'white';
                warningDiv.style.padding = '12px 36px 12px 24px';
                warningDiv.style.borderRadius = '8px';
                warningDiv.style.fontWeight = 'bold';
                warningDiv.style.zIndex = '100';
                warningDiv.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)';
                warningDiv.style.textAlign = 'center';
                warningDiv.style.pointerEvents = 'auto'; // Enable close button interaction
                warningDiv.style.maxWidth = '85%';
                warningDiv.style.backdropFilter = 'blur(4px)';
                warningDiv.style.border = '1px solid rgba(255,255,255,0.2)';
                warningDiv.innerHTML = `
                    <button id="closeOverflowWarningBtn" title="Dismiss warning" style="position: absolute; top: 6px; right: 8px; background: none; border: none; color: white; font-size: 20px; line-height: 1; cursor: pointer; opacity: 0.8; padding: 2px 6px; border-radius: 4px; transition: opacity 0.2s;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.8'">&times;</button>
                    ⚠️ Capacity Exceeded<br><span style="font-size: 13px; font-weight: normal;">Suggestion: Cut [ ${generated.shortText} ] to clear overflow.</span>
                `;
                
                const closeBtn = warningDiv.querySelector('#closeOverflowWarningBtn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.overflowWarningDismissed = true;
                        warningDiv.remove();
                    });
                }
                
                const truck3dWrap = document.getElementById('truck3dContainer');
                if (truck3dWrap) {
                    truck3dWrap.style.position = 'relative';
                    truck3dWrap.appendChild(warningDiv);
                }
            }
            
            // Sync with main dashboard!
            this.syncDashboardOverflow(overflowDOs, overflowPallets);
        };
        
        this.renderPalletsLayout();
        
        // --- 3. INTERACTION ---
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let hoveredMesh = null;
        let tooltip = document.getElementById('truck3dTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'truck3dTooltip';
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
        
        this.isDragging = false;
        this.draggedMesh = null;
        this.dragStartPos = null;
        this.dragStartClientX = 0;
        this.dragStartClientY = 0;
        
        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(truckElevation + (palletH / 2)));

        this.pointerDownListener = (event) => {
            if (event.button !== 0) return; // Only Left-Click initiates pallet drag/drop; allows Right-Click to pan freely without interference
            const rect = container.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(palletMeshes);
            if (intersects.length > 0) {
                this.dragStartClientX = event.clientX;
                this.dragStartClientY = event.clientY;
                this.isDragging = true;
                this.draggedMesh = intersects[0].object;
                this.dragStartPos = this.draggedMesh.userData.groupObj ? this.draggedMesh.userData.groupObj.position.clone() : this.draggedMesh.position.clone();
                controls.enabled = false;
            }
        };
        container.addEventListener('pointerdown', this.pointerDownListener);
        
        this.contextMenuListener = (event) => event.preventDefault();
        container.addEventListener('contextmenu', this.contextMenuListener);

        this.pointerMoveListener = (event) => {
            const rect = container.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
            
            if (this.isDragging && this.draggedMesh) {
                raycaster.setFromCamera(mouse, camera);
                const target = new THREE.Vector3();
                raycaster.ray.intersectPlane(dragPlane, target);
                
                if (target) {
                    if (this.draggedMesh.userData.groupObj) {
                        this.draggedMesh.userData.groupObj.position.x = target.x;
                        this.draggedMesh.userData.groupObj.position.z = target.z;
                    } else {
                        this.draggedMesh.position.x = target.x;
                        this.draggedMesh.position.z = target.z;
                    }
                }
            }
        };
        container.addEventListener('pointermove', this.pointerMoveListener);

        this.pointerUpListener = (event) => {
            if (this.isDragging && this.draggedMesh) {
                const dist = Math.hypot(event.clientX - this.dragStartClientX, event.clientY - this.dragStartClientY);
                const pIndex = this.draggedMesh.userData.index;
                
                if (dist < 5) {
                    if (pIndex !== undefined) {
                        this.palletsToPlace[pIndex].rotated = !this.palletsToPlace[pIndex].rotated;
                        this.renderPalletsLayout();
                    }
                } else {
                    if (this.interactionMode === 'sandbox') {
                        // Leave it where it dropped
                    } else if (this.interactionMode === 'swap' || !this.interactionMode) {
                        raycaster.setFromCamera(mouse, camera);
                        const otherMeshes = palletMeshes.filter(m => m !== this.draggedMesh);
                        const intersects = raycaster.intersectObjects(otherMeshes);
                        
                        if (intersects.length > 0) {
                            const targetIndex = intersects[0].object.userData.index;
                            if (pIndex !== undefined && targetIndex !== undefined) {
                                const temp = this.palletsToPlace[pIndex];
                                this.palletsToPlace[pIndex] = this.palletsToPlace[targetIndex];
                                this.palletsToPlace[targetIndex] = temp;
                            }
                        }
                        this.renderPalletsLayout(); 
                        if (this.interactionMode === 'list') this.renderPalletList();
                    }
                }
                
                this.isDragging = false;
                this.draggedMesh = null;
                controls.enabled = true;
            }
        };
        container.addEventListener('pointerup', this.pointerUpListener);
        
        this.resizeListener = () => {
            const m = document.getElementById('truck3dModal');
            if (!m || m.style.display === 'none') return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', this.resizeListener);
        
        this.animationId = null;
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            // Door closing/opening animation
            if (this.leftDoorHingeRef && this.rightDoorHingeRef) {
                const targetLeft = this.isDriveMode ? 0 : -Math.PI / 1.6;
                const targetRight = this.isDriveMode ? 0 : Math.PI / 1.6;
                
                this.leftDoorHingeRef.rotation.y += (targetLeft - this.leftDoorHingeRef.rotation.y) * 0.05;
                this.rightDoorHingeRef.rotation.y += (targetRight - this.rightDoorHingeRef.rotation.y) * 0.05;
            }
            controls.update();

            if (!this.isDragging) {
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(palletMeshes);

                if (intersects.length > 0) {
                    const object = intersects[0].object;
                    if (hoveredMesh !== object) {
                        if (hoveredMesh) {
                            if (hoveredMesh.userData && hoveredMesh.userData.groupObj) {
                                hoveredMesh.userData.groupObj.children.forEach(c => {
                                    if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000);
                                });
                            } else if (hoveredMesh.material && hoveredMesh.material.emissive) {
                                hoveredMesh.material.emissive.setHex(0x000000);
                            }
                        }
                        hoveredMesh = object;
                        if (hoveredMesh.userData && hoveredMesh.userData.groupObj) {
                            hoveredMesh.userData.groupObj.children.forEach(c => {
                                if (c.material && c.material.emissive) c.material.emissive.setHex(0x333333);
                            });
                        } else if (hoveredMesh.material && hoveredMesh.material.emissive) {
                            hoveredMesh.material.emissive.setHex(0x333333);
                        }
                        
                        let dimsHTML = '';
                        if (object.userData.length && object.userData.width) {
                            const dispL = Math.round(object.userData.rotated ? object.userData.width : object.userData.length);
                            const dispW = Math.round(object.userData.rotated ? object.userData.length : object.userData.width);
                            dimsHTML = '<br><span style="color: var(--fg-muted, #a1a1aa); font-size: 11px;">Dim: ' + dispL + 'cm × ' + dispW + 'cm</span>';
                        }
                        
                        let mixHTML = '';
                        if (object.userData.isMixed) {
                            mixHTML = '<br><span style="color: #10b981; font-weight: 600; font-size: 11px;">Fill: ' + Math.round(object.userData.fillPercent * 100) + '%</span>';
                        }

                        let ghostHTML = '';
                        if (object.userData.ghostedAccessoryCount > 0) {
                            ghostHTML = '<br><span style="color: #f59e0b; font-size: 11px;">▲ ' + object.userData.ghostedAccessoryCount + (object.userData.ghostedAccessoryCount === 1 ? ' accessory' : ' accessories') + ' stacked above</span>';
                        }

                        tooltip.innerHTML = '<strong style="color: var(--accent, #8b5cf6);">' + (object.userData.isMixed ? 'Contents' : 'Model') + ':</strong> ' + (object.userData.description || object.userData.code) + '<br><strong>' + (object.userData.isMixed ? 'Total Qty' : 'Qty') + ':</strong> ' + object.userData.qty + ' pcs' + dimsHTML + mixHTML + ghostHTML + '<br><span style="color: #fbbf24; font-size: 10px; margin-top: 4px; display: block;">👉 Click to rotate 90°<br>👉 Drag to ' + (this.interactionMode === 'sandbox' ? 'move freely' : 'swap order') + '</span>';
                        tooltip.style.display = 'block';
                    }
                    tooltip.style.left = (this.mouseX + 15) + 'px';
                    tooltip.style.top = (this.mouseY + 15) + 'px';
                } else {
                    if (hoveredMesh) {
                        if (hoveredMesh.userData && hoveredMesh.userData.groupObj) {
                            hoveredMesh.userData.groupObj.children.forEach(c => {
                                if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000);
                            });
                        } else if (hoveredMesh.material && hoveredMesh.material.emissive) {
                            hoveredMesh.material.emissive.setHex(0x000000);
                        }
                        hoveredMesh = null;
                    }
                    tooltip.style.display = 'none';
                }
            } else {
                tooltip.style.display = 'none';
            }

            // Initialize departure physics state
            if (this.departZ === undefined) {
                this.departZ = 0;
                this.departSpeed = 0;
            }

            // --- ENGINE STARTED & TRUCK DEPARTURE / RETURN SEQUENCE ---
            const time = Date.now();
            
            if (this.isDriveMode) {
                // 1. Smooth Departure: Drive forward to open staging road (Z = -80 ft)
                const targetZ = -80;
                if (this.departZ > targetZ) {
                    this.departSpeed = Math.min(this.departSpeed + 0.006, 0.42);
                    this.departZ = Math.max(this.departZ - this.departSpeed, targetZ);
                } else {
                    this.departSpeed = Math.max(this.departSpeed - 0.015, 0); // Gentle idle stop once staged
                }
                
                if (this.truckMasterGroup) {
                    this.truckMasterGroup.position.z = this.departZ;
                }
                
                // 2. Smoothly close rear container doors upon departure
                if (this.leftDoorHingeRef) {
                    this.leftDoorHingeRef.rotation.y = THREE.MathUtils.lerp(this.leftDoorHingeRef.rotation.y, 0, 0.06);
                }
                if (this.rightDoorHingeRef) {
                    this.rightDoorHingeRef.rotation.y = THREE.MathUtils.lerp(this.rightDoorHingeRef.rotation.y, 0, 0.06);
                }
                
                // 3. Spin wheels with forward movement
                if (this.truckWheels && this.departSpeed > 0.001) {
                    this.truckWheels.forEach(w => w.rotation.x -= this.departSpeed * 1.5);
                }
                
                // 4. Authentic Engine Vibration / Idle Rumble
                const rumbleY = Math.sin(time * 0.08) * 0.02;
                const rumbleX = Math.sin(time * 0.09) * 0.01;
                if (this.cabinGroupRef) {
                    this.cabinGroupRef.position.y = rumbleY;
                    this.cabinGroupRef.position.x = rumbleX;
                }
                
                // 5. Headlights Flare & Spotlights Forward Beam
                if (this.headlightsMat) this.headlightsMat.emissiveIntensity = 2.5;
                if (this.spotlights) this.spotlights.forEach(s => s.intensity = 4.5);
                
                // 6. Taillights & Clearance Markers
                if (this.taillightsMat) {
                    this.taillightsMat.emissiveIntensity = 1.8;
                    this.taillightsMat.color.setHex(0xdc2626);
                    this.taillightsMat.emissive.setHex(0xdc2626);
                }
                if (this.turnSignalsMat) {
                    this.turnSignalsMat.emissiveIntensity = 1.2;
                }
            
                // 7. Acceleration Exhaust Smoke Particles Trailing from Smokestacks
                if (this.smokeParticles) {
                    if (Math.random() < 0.7) {
                        let p = this.smokeParticles.find(sp => !sp.userData.active);
                        if (p) {
                            p.userData.active = true;
                            p.userData.life = 1.0;
                            const side = Math.random() > 0.5 ? 1 : -1;
                            const exX = side * (this.cabinWRef / 2 + 0.3);
                            const exY = this.cabinHRef + 3.2;
                            const exZ = this.cabZRef + (this.cabinLRef / 4) + this.departZ;
                            p.position.set(exX + rumbleX, exY + rumbleY, exZ);
                            p.material.opacity = 0.55;
                            p.scale.set(0.8, 0.8, 0.8);
                            p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                        }
                    }
                    this.smokeParticles.forEach(p => {
                        if (p.userData.active) {
                            p.position.y += 0.06;
                            p.position.z += 0.12; // Drift behind moving truck
                            p.userData.life -= 0.016;
                            p.scale.multiplyScalar(1.025);
                            p.material.opacity = p.userData.life * 0.55;
                            if (p.userData.life <= 0) {
                                p.userData.active = false;
                                p.position.set(0, -100, 0);
                            }
                        }
                    });
                }
            
            } else {
                // Return smoothly to loading dock (Z = 0)
                if (this.departZ < 0) {
                    const reverseSpeed = Math.min(Math.max(Math.abs(this.departZ) * 0.06, 0.04), 0.35);
                    this.departZ = Math.min(this.departZ + reverseSpeed, 0);
                    
                    if (this.truckWheels) {
                        this.truckWheels.forEach(w => w.rotation.x += reverseSpeed * 1.5);
                    }
                }
                
                if (this.truckMasterGroup) {
                    this.truckMasterGroup.position.z = this.departZ;
                }
                
                if (this.cabinGroupRef) {
                    this.cabinGroupRef.position.y = 0;
                    this.cabinGroupRef.position.x = 0;
                }
                
                // Re-open container doors once docked back at the loading bay
                if (this.departZ >= -5) {
                    if (this.leftDoorHingeRef) {
                        this.leftDoorHingeRef.rotation.y = THREE.MathUtils.lerp(this.leftDoorHingeRef.rotation.y, -Math.PI / 1.6, 0.06);
                    }
                    if (this.rightDoorHingeRef) {
                        this.rightDoorHingeRef.rotation.y = THREE.MathUtils.lerp(this.rightDoorHingeRef.rotation.y, Math.PI / 1.6, 0.06);
                    }
                }
                
                if (this.roadGroup) this.roadGroup.visible = false;
                if (this.headlightsMat) this.headlightsMat.emissiveIntensity = 0.8;
                if (this.taillightsMat) {
                    this.taillightsMat.emissiveIntensity = 0.2;
                    this.taillightsMat.color.setHex(0x991111);
                    this.taillightsMat.emissive.setHex(0x991111);
                }
                if (this.spotlights) this.spotlights.forEach(s => s.intensity = 0);
                if (this.turnSignalsMat) this.turnSignalsMat.emissiveIntensity = 0.5;
                if (this.smokeParticles) {
                    this.smokeParticles.forEach(p => { p.userData.active = false; p.position.y = -100; });
                }
            }

            // Forklift loading simulation + truck sag (skips while driving)
            if (this.loadingSim && !this.isDriveMode) {
                this.tickLoadingSim();
            } else if (this.loadingSim && this.isDriveMode) {
                this.stopLoadingSim(true); // drive mode takes over — restore state
            }

            renderer.render(scene, camera);
        };
        animate();
    }

    // ============ FORKLIFT LOADING SIMULATION + TRUCK SAG ============

    // Starts sequential forklift loading animation with live weight-sag feedback
    startLoadingSim() {
        if (this.isLoadingSim) return; // already running
        if (!this.forkliftRef || !this.palletsGroupRef || !this.palletsToPlace || this.palletsToPlace.length === 0) {
            showToast("No pallets to load. Calculate pallets first.", "warning");
            return;
        }

        const groupObjs = this.palletsGroupRef.children.filter(c => c.type === 'Group');
        if (groupObjs.length === 0) {
            showToast("No placed pallet meshes found.", "warning");
            return;
        }

        // Hide all pallets; forklift will reveal them one by one
        groupObjs.forEach(g => { g.visible = false; });
        this.isLoadingSim = true;

        // Load order: front-to-back (nearest door last, so forklift doesn't "drive through" cargo)
        // Pallets are packed from -Z (nose) to +Z (doors); load nose-first = ascending z
        const order = groupObjs.slice().sort((a, b) => {
            if (Math.abs(a.position.z - b.position.z) > 0.5) return a.position.z - b.position.z;
            if (Math.abs(a.position.y - b.position.y) > 0.5) return a.position.y - b.position.y;
            return a.position.x - b.position.x;
        });

        // Overflow pallets sit beyond the container doors (z > truckL/2) — they will be
        // REJECTED at the door and staged on the dock instead of floating outside the truck.
        const truckL = this._simTruckL;
        order.forEach(g => {
            g.userData._targetPos = g.position.clone();
            g.userData._targetRot = g.rotation.clone();
        });
        const overflowObjs = order.filter(g => g.position.z > truckL / 2);
        overflowObjs.forEach((g, i) => {
            g.userData._origPos = { x: g.position.x, y: g.position.y, z: g.position.z };
            // Stage rejected pallets in a row beside the dock, clear of the truck
            g.userData._dockStage = { x: truckL / 2 + 8, y: 0, z: -truckL / 4 + i * 5 };
        });

        // Timing per pallet cycle: approach -> lower -> retreat
        const lower = 600, pause = 250;

        this.loadingSim = {
            order: order,
            idx: 0,
            phase: 'approach',
            phaseStart: performance.now(),
            lower: lower, pause: pause,
            placedCount: 0,
            // sag state
            sagY: 0, sagTargetY: 0, tiltZ: 0, tiltTargetZ: 0, _pitch: 0, _pitchTarget: 0,
            totalWeight: order.length, // each pallet ~= 1 unit weight
            sumX: 0, sumZ: 0, placedX: 0, placedZ: 0
        };

        // HUD
        let hud = document.getElementById('loadingSimHud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'loadingSimHud';
            hud.style.cssText = 'position:absolute; bottom:20px; left:50%; transform:translateX(-50%);' +
                'background:rgba(24,24,27,0.92); border:1px solid #3f3f46; border-radius:8px;' +
                'padding:8px 18px; font-size:13px; font-weight:600; color:#f4f4f5;' +
                'box-shadow:0 4px 12px rgba(0,0,0,0.5); z-index:50; white-space:nowrap; pointer-events:none;';
            const c = document.getElementById('truck3dContainer');
            if (c) c.appendChild(hud);
        }
        hud.style.display = 'block';
        hud.textContent = `Loading 0/${order.length} pallets · Sag: 0%`;
        this.loadingSimHud = hud;

        this.updateLoadingSimButton(true);
    }

    stopLoadingSim(silent) {
        if (!this.loadingSim) return;
        // Reveal everything, restore transforms
        if (this.palletsGroupRef) {
            this.palletsGroupRef.children.forEach(g => {
                g.visible = true;
                // Overflow pallets were relocated to dock staging — put them back
                if (g.userData && g.userData._origPos) {
                    g.position.set(g.userData._origPos.x, g.userData._origPos.y, g.userData._origPos.z);
                    delete g.userData._origPos;
                    delete g.userData._dockStage;
                }
            });
        }
        if (this.truckMasterGroup) {
            this.truckMasterGroup.position.y = 0;
            this.truckMasterGroup.rotation.z = 0;
            this.truckMasterGroup.rotation.x = 0;
        }
        if (this.forkliftRef && this.forkliftHome) {
            this.forkliftRef.position.set(this.forkliftHome.x, this.forkliftHome.y, this.forkliftHome.z);
            this.forkliftRef.rotation.y = this.forkliftHome.rotY;
            this.forkliftRef.rotation.z = 0;
            if (this.forkliftRef.userData.forksGroup) {
                this.forkliftRef.userData.forksGroup.position.y = 0; // reset to default
            }
        }
        if (this.loadingSimHud) this.loadingSimHud.style.display = 'none';
        this.loadingSim = null;
        this.isLoadingSim = false;
        this.updateLoadingSimButton(false);
        if (!silent) console.log('Loading simulation ended');
    }

    updateLoadingSimButton(running) {
        const btn = document.getElementById('modeLoadSimBtn');
        if (!btn) return;
        if (running) {
            btn.classList.remove('success');
            btn.classList.add('danger');
            btn.innerHTML = '⏹ Stop Loading';
        } else {
            btn.classList.remove('danger');
            btn.classList.add('success');
            btn.innerHTML = '📦 Simulate Loading';
        }
    }

    // Called each frame from the animate loop
    tickLoadingSim() {
        const sim = this.loadingSim;
        if (!sim) return;
        const fl = this.forkliftRef;
        if (!fl) { this.stopLoadingSim(true); return; }
        
        if (fl.userData.beaconMat) {
            // Strobe effect: quick double flash pattern
            const t = performance.now() / 1000;
            // A common strobe pattern: two rapid flashes then a short pause
            // Cycle length: 1 second
            const cycle = t % 1.0;
            let intensity = 0.2; // base glow
            let lightIntensity = 0.0;
            if ((cycle > 0.0 && cycle < 0.08) || (cycle > 0.15 && cycle < 0.23)) {
                intensity = 5.0; // intense flash
                lightIntensity = 3.0; // PointLight intensity
            }
            fl.userData.beaconMat.emissiveIntensity = intensity;
            if (fl.userData.beaconLight) {
                fl.userData.beaconLight.intensity = lightIntensity;
            }
        }

        const elapsed = performance.now() - sim.phaseStart;

        if (sim.idx >= sim.order.length) {
            const rejected = sim.rejectedCount || 0;
            this.stopLoadingSim(true);
            const hud = this.loadingSimHud;
            if (hud) {
                hud.style.display = 'block';
                hud.textContent = `✅ Loading complete — ${sim.totalWeight - rejected} loaded${rejected ? `, ${rejected} rejected` : ''}. Departing...`;
                setTimeout(() => { hud.style.display = 'none'; }, 4000);
            }
            if (!this.isDriveMode) this.toggleDriveMode();
            return;
        }

        const target = sim.order[sim.idx];
        const flHome = this.forkliftHome;
        const targetPos = target.userData._targetPos;

        const dockZ = (this._simTruckL / 2) + 7;
        const stagingPos = { x: flHome.x, z: flHome.z };
        const doorPos = { x: targetPos.x, z: dockZ };
        // The forklift must stop short of the pallet's final slot because the forks stick out 4.5 units
        const slotPos = { x: targetPos.x, z: targetPos.z + 4.5 };
        
        const isOverflow = !!target.userData._dockStage;
        const legEnd = isOverflow ? { x: doorPos.x, z: doorPos.z } : slotPos;
        
        const lerpV3 = (from, to, t) => ({ x: from.x + (to.x - from.x) * t, y: from.y !== undefined ? from.y + (to.y - from.y) * t : 0, z: from.z + (to.z - from.z) * t });
        const lerpAngle = (a, b, t) => {
            const da = (b - a) % (Math.PI * 2);
            const shortDa = (2 * da) % (Math.PI * 2) - da;
            return a + shortDa * t;
        };

        if (sim.phase === 'approach') {
            // dynamic times
            if (!sim.currentDriveIn) {
                const d1 = Math.hypot(doorPos.x - stagingPos.x, doorPos.z - stagingPos.z);
                const d2 = Math.hypot(legEnd.x - doorPos.x, legEnd.z - doorPos.z);
                const speed = 0.025;
                sim.currentDriveIn = (d1 + d2) / speed;
                sim.currentRetreat = sim.currentDriveIn * 0.8; 
                sim.currentDriveLegT = d1 / (d1 + d2);
            }

            const t = Math.min(1, elapsed / sim.currentDriveIn);
            const legT = sim.currentDriveLegT;
            
            let pos;
            if (t < legT) {
                pos = lerpV3(stagingPos, doorPos, t / legT);
            } else {
                pos = lerpV3(doorPos, legEnd, (t - legT) / (1 - legT));
            }
            fl.position.x = pos.x;
            fl.position.z = pos.z;

            // Heading
            const headingLeg1 = Math.atan2(doorPos.x - fl.position.x, doorPos.z - fl.position.z);
            const headingLeg2 = Math.PI;

            if (t < legT) {
                fl.rotation.y = headingLeg1;
            } else {
                const turnT = Math.min(1, (t - legT) / 0.1);
                fl.rotation.y = lerpAngle(headingLeg1, headingLeg2, turnT);
            }

            // --- LIFT ANIMATION LOGIC ---
            // carry height on dock (0.2 units above floor)
            const lowCarryY = 0.2; 
            // clearance height over stack (target + 0.2)
            const highCarryY = targetPos.y + 0.2; 
            
            let tinesY = lowCarryY;
            if (t >= legT) {
                // Lift while driving leg 2
                const liftT = (t - legT) / (1 - legT);
                tinesY = lowCarryY + (highCarryY - lowCarryY) * liftT;
            }
            
            // Move the actual forklift forks mesh
            if (fl.userData.forksGroup) {
                fl.userData.forksGroup.position.y = tinesY - 0.7; // 0.7 is the default modeling height
            }

            // Carry the pallet visibly ON the forks
            target.visible = true;
            target.position.x = fl.position.x + Math.sin(fl.rotation.y) * 4.5;
            target.position.z = fl.position.z + Math.cos(fl.rotation.y) * 4.5;
            target.position.y = tinesY; 
            target.rotation.y = target.userData._targetRot.y;

            if (t >= 1) {
                if (isOverflow) {
                    target.position.set(
                        target.userData._dockStage.x,
                        target.userData._dockStage.y,
                        target.userData._dockStage.z
                    );
                    target.visible = true;
                    sim.placedCount++;
                    sim.rejectedCount = (sim.rejectedCount || 0) + 1;
                    sim.rejectShake = performance.now();
                    this.updateSimHud(sim);
                    sim.phase = 'retreat';
                    sim.phaseStart = performance.now();
                    return;
                }
                
                sim.phase = 'lower';
                sim.phaseStart = performance.now();
            }
        } else if (sim.phase === 'lower') {
            const t = Math.min(1, elapsed / sim.lower);
            
            // Drop from clearance height to final target height
            const tinesY = (targetPos.y + 0.2) - (0.2 * t);
            
            if (fl.userData.forksGroup) {
                fl.userData.forksGroup.position.y = tinesY - 0.7;
            }
            target.position.y = tinesY;

            if (t >= 1) {
                target.position.copy(targetPos);
                
                sim.placedCount++;
                sim.placedX += target.position.x;
                sim.placedZ += target.position.z;
                const frac = sim.placedCount / sim.totalWeight;
                sim.sagTargetY = 0; // Removed permanent sag
                sim.sagY -= 0.15; // Exaggerated temporary bump (impossible to miss)
                
                const meanX = sim.placedX / sim.placedCount;
                const meanZ = sim.placedZ / sim.placedCount;
                sim.tiltTargetZ = 0; // THREE.MathUtils.clamp(meanX * -0.045, -0.05, 0.05); // Removed permanent tilt
                sim._pitchTarget = 0; // THREE.MathUtils.clamp(meanZ * 0.012, -0.02, 0.02); // Removed permanent pitch
                this.updateSimHud(sim);
                
                sim.phase = 'retreat';
                sim.phaseStart = performance.now();
            }
        } else if (sim.phase === 'retreat') {
            const t = Math.min(1, elapsed / sim.currentRetreat);
            const pos = lerpV3(slotPos, doorPos, t);
            fl.position.x = pos.x;
            fl.position.z = pos.z;
            // Lock rotation perfectly straight ahead while reversing out of the truck
            fl.rotation.y = Math.PI;

            if (t >= 1) {
                sim.phase = 'pause';
                sim.phaseStart = performance.now();
            }
        } else if (sim.phase === 'pause') {
            const pos = lerpV3(doorPos, stagingPos, Math.min(1, elapsed / sim.pause));
            fl.position.x = pos.x;
            fl.position.z = pos.z;
            
            // Smoothly pivot towards the home staging rotation once out on the dock
            const returnT = Math.min(1, elapsed / sim.pause);
            fl.rotation.y = lerpAngle(Math.PI, flHome.rotY, returnT);

            // Lower forks back to driving position while returning
            if (fl.userData.forksGroup) {
                const tinesY = targetPos.y + (0.2 - targetPos.y) * returnT;
                fl.userData.forksGroup.position.y = tinesY - 0.7;
            }

            if (elapsed >= sim.pause) {
                sim.idx++;
                sim.currentDriveIn = null;
                sim.phase = 'approach';
                sim.phaseStart = performance.now();
            }
        }

                if (sim.rejectShake) {
            const since = performance.now() - sim.rejectShake;
            if (since < 700) {
                fl.rotation.z = Math.sin(since / 45) * 0.06 * (1 - since / 700);
            } else {
                fl.rotation.z = 0;
                sim.rejectShake = 0;
            }
        }
        
        if (this.guiderRef) {
            const time = performance.now();
            const armL = this.guiderRef.userData.armL;
            const armR = this.guiderRef.userData.armR;
            
            if (sim.phase === 'approach') {
                const swing = Math.sin(time / 150) * 0.5 - 0.5; // swing from -1 to 0 (arms forward)
                armL.rotation.x = swing;
                armR.rotation.x = swing;
                armL.rotation.z = 0;
                armR.rotation.z = 0;
            } else if (sim.phase === 'lower') {
                // Cross arms (stop/hold)
                armL.rotation.x = -Math.PI * 0.7;
                armL.rotation.z = -Math.PI * 0.25;
                armR.rotation.x = -Math.PI * 0.7;
                armR.rotation.z = Math.PI * 0.25;
            } else if (sim.phase === 'retreat') {
                // Point forward
                armL.rotation.x = -Math.PI * 0.2;
                armL.rotation.z = 0;
                armR.rotation.x = -Math.PI * 0.2;
                armR.rotation.z = 0;
            } else if (sim.phase === 'pause') {
                armL.rotation.x = 0;
                armL.rotation.z = 0;
                armR.rotation.x = 0;
                armR.rotation.z = 0;
            }
            
            // Guider faces the forklift
            if (fl) {
                const dx = fl.position.x - this.guiderRef.position.x;
                const dz = fl.position.z - this.guiderRef.position.z;
                this.guiderRef.rotation.y = Math.atan2(dx, dz);
            }
        }

        let activeSagWobble = 0;
        let activePitchWobble = 0;
        if (fl.position.z < this._simTruckL / 2 + 1.5) {
            if (sim.phase === 'approach' || sim.phase === 'retreat') {
                activeSagWobble = Math.sin(performance.now() / 60) * 0.025; // 30% larger active wobble
                activePitchWobble = Math.sin(performance.now() / 80) * 0.008;
            }
        }
        sim.sagY += ((sim.sagTargetY + activeSagWobble) - sim.sagY) * 0.08; // slightly faster spring for the wobble
        sim.tiltZ += (sim.tiltTargetZ - sim.tiltZ) * 0.04;
        const pitch = (sim._pitchTarget || 0);
        sim._pitch = (sim._pitch || 0) + (pitch - (sim._pitch || 0)) * 0.04;
        const tmg = this.truckMasterGroup;
        if (tmg && !this.isDriveMode) {
            tmg.position.y = sim.sagY;
            tmg.rotation.z = sim.tiltZ;
            tmg.rotation.x = sim._pitch;
        }
    }

    updateSimHud(sim) {
        if (!this.loadingSimHud) return;
        const pct = Math.round((sim.placedCount / sim.totalWeight) * 100);
        const sagPct = Math.round(Math.abs(sim.sagTargetY) / 0.35 * 100);
        const rejected = sim.rejectedCount || 0;
        const rejectedHTML = rejected > 0 ? ` · ⚠ ${rejected} rejected (overflow)` : '';
        this.loadingSimHud.textContent = `Loading ${sim.placedCount}/${sim.totalWeight} pallets · Weight on suspension: ${sagPct}%${rejectedHTML}`;
    }
    
    
    toggleDriveMode() {
        this.isDriveMode = !this.isDriveMode;
        const btn = document.getElementById('modeDriveBtn');
        if (btn) {
            if (this.isDriveMode) {
                btn.classList.remove('warning');
                btn.classList.add('danger');
                btn.innerHTML = '🛑 Stop Engine';
            } else {
                btn.classList.remove('danger');
                btn.classList.add('warning');
                btn.innerHTML = '🔑 Start Engine';
            }
        }
    }

    // Button toggle for the forklift loading simulation
    toggleLoadingSim() {
        if (this.isLoadingSim) {
            this.stopLoadingSim();
        } else {
            if (this.isDriveMode) this.toggleDriveMode(); // can't load while truck is driving
            this.startLoadingSim();
        }
    }
    
    close3DViewer() {
        const modal = document.getElementById('truck3dModal');
        if (modal) modal.style.display = 'none';

        // End any running loading simulation (restores pallets/truck/forklift state)
        this.stopLoadingSim(true);

        const tooltip = document.getElementById('truck3dTooltip');
        if (tooltip) tooltip.style.display = 'none';
        
        const container = document.getElementById('truck3dContainer');
        if (container) {
            if (this.pointerDownListener) container.removeEventListener('pointerdown', this.pointerDownListener);
            if (this.pointerMoveListener) container.removeEventListener('pointermove', this.pointerMoveListener);
            if (this.pointerUpListener) container.removeEventListener('pointerup', this.pointerUpListener);
            if (this.contextMenuListener) container.removeEventListener('contextmenu', this.contextMenuListener);
            
            this.pointerDownListener = null;
            this.pointerMoveListener = null;
            this.pointerUpListener = null;
            this.contextMenuListener = null;
        }
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
            this.resizeListener = null;
        }
    }
}

window.plannerEngine = new PalletCalculationEngine();
