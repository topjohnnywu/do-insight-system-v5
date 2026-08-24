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

// Batch Analytics Manager - Core Data Management
class BatchAnalyticsManager {
    constructor() {
        this.batches = this.loadBatchHistory();
        this.currentSort = { field: 'batchDate', direction: 'desc' };
        this.filters = {
            batch: 'ALL',
            month: 'ALL',
            year: 'ALL',
            search: ''
        };
        this.currentPage = 1;
        this.pageSize = 5; // Default 5 rows per page (5, 10, 25, 50, 0=All)
    }

    // Load batch history from localStorage
    loadBatchHistory() {
        try {
            const data = localStorage.getItem("BatchAnalytics_History");
            const batches = data ? JSON.parse(data) : [];
            // Ensure backward compatibility for items loaded from memory
            return batches.map(b => ({
                ...b,
                holdDOCount: b.holdDOCount || 0,
                cancelDOCount: b.cancelDOCount || 0
            }));
        } catch (err) {
            console.error("Failed to load batch history:", err);
            return [];
        }
    }

    // Save batch history to localStorage
    saveBatchHistory() {
        try {
            localStorage.setItem("BatchAnalytics_History", JSON.stringify(this.batches));
            return true;
        } catch (err) {
            console.error("Failed to save batch history:", err);
            showToast("Failed to save batch data. Storage may be full.", "error");
            return false;
        }
    }

    // Parse Excel batch file (optimized: only parses the 2 needed sheets, skips the rest)
    async parseBatchFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    // First pass: read sheet names only (bookSheets: true skips all cell data - fast!)
                    const metaWorkbook = XLSX.read(e.target.result, { type: 'array', bookSheets: true });
                    const allSheetNames = metaWorkbook.SheetNames;
                    
                    // Find "Insert Batch" sheet (case-insensitive fuzzy match)
                    const insertBatchSheet = allSheetNames.find(name => {
                        const lower = name.toLowerCase().trim();
                        return lower === "insert batch" || lower.includes("insert batch") || lower.includes("batch");
                    }) || allSheetNames[0];
                    
                    // Find "Impulse-Route" sheet (case-insensitive fuzzy match)
                    const impulseSheet = allSheetNames.find(name =>
                        name.toLowerCase().includes('impulse')
                    );
                    
                    // Second pass: parse ONLY the sheets we need (skips images, other sheets, styles = major speed boost on large files)
                    const sheetsToParse = [...new Set([insertBatchSheet, impulseSheet].filter(Boolean))];
                    const workbook = XLSX.read(e.target.result, { type: 'array', sheets: sheetsToParse });
                    
                    const sheet = workbook.Sheets[insertBatchSheet];
                    if (!sheet) {
                        reject(new Error("Insert Batch sheet could not be parsed"));
                        return;
                    }
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
                    
                    if (rows.length < 5) {
                        reject(new Error("File contains insufficient data rows"));
                        return;
                    }
                    
                    // Extract volume from "Impulse-Route" sheet (Column I, row 2+)
                    const totalVolume = this.extractVolumeFromImpulseSheet(workbook);
                    
                    // Data starts at row 5 (index 4)
                    const batchData = this.extractBatchData(rows.slice(4), file.name, totalVolume);
                    resolve(batchData);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsArrayBuffer(file);
        });
    }

    // Extract total volume from "Impulse-Route" sheet
    // Column I (index 8), starting at row 2 (index 1) - straight sum of all values
    extractVolumeFromImpulseSheet(workbook) {
        try {
            // Find sheet containing "impulse" (case-insensitive)
            const impulseSheetName = workbook.SheetNames.find(name =>
                name.toLowerCase().includes('impulse')
            );
            
            if (!impulseSheetName) {
                console.warn('Impulse-Route sheet not found - volume set to 0');
                return 0;
            }
            
            const sheet = workbook.Sheets[impulseSheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
            
            let totalVolume = 0;
            
            // Data starts at row 2 (index 1) - straight sum of Column I (index 8)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
                
                const val = parseFloat(row[8]); // Column I
                if (!isNaN(val)) {
                    totalVolume += val;
                }
            }
            
            return totalVolume;
        } catch (err) {
            console.error('Error extracting volume from Impulse-Route sheet:', err);
            return 0;
        }
    }

    // Derive Batch ID and Date from filename
    // Examples: "BatchPicking_31Jul2026.xlsx" -> { batchId: "31Jul2026", date: "2026-07-31" }
    deriveBatchIdFromFileName(fileName) {
        const baseName = fileName.replace(/\.[^/.]+$/, ""); // Strip extension
        const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        
        // Pattern 1: 31Jul2026 / 31-Jul-2026 / 31_Jul_2026
        let match = baseName.match(/(\d{1,2})[-_]?([A-Za-z]{3})[-_]?(\d{4})/);
        if (match) {
            const day = parseInt(match[1]);
            const month = months[match[2].toLowerCase().substring(0,3)];
            const year = parseInt(match[3]);
            if (month !== undefined) {
                const date = new Date(year, month, day);
                return {
                    batchId: `${day}${monthNames[month]}${year}`,
                    date: date.toISOString().split('T')[0]
                };
            }
        }
        
        // Pattern 2: 2026-07-31 / 2026_07_31
        match = baseName.match(/(\d{4})[-_](\d{1,2})[-_](\d{1,2})/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const day = parseInt(match[3]);
            if (month >= 0 && month <= 11) {
                const date = new Date(year, month, day);
                return {
                    batchId: `${day}${monthNames[month]}${year}`,
                    date: date.toISOString().split('T')[0]
                };
            }
        }
        
        // Pattern 3: 31072026 (DDMMYYYY)
        match = baseName.match(/(\d{2})(\d{2})(\d{4})/);
        if (match) {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const year = parseInt(match[3]);
            if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
                const date = new Date(year, month, day);
                return {
                    batchId: `${day}${monthNames[month]}${year}`,
                    date: date.toISOString().split('T')[0]
                };
            }
        }
        
        // Fallback: use filename without extension
        return {
            batchId: baseName,
            date: new Date().toISOString().split('T')[0]
        };
    }

    // Format batch ID into a readable display name
    // "30Jul2026" -> "30 July 2026", fallback: raw ID
    formatBatchName(batchId) {
        const months = {jan:'January',feb:'February',mar:'March',apr:'April',may:'May',jun:'June',jul:'July',aug:'August',sep:'September',oct:'October',nov:'November',dec:'December'};
        const match = String(batchId).match(/^(\d{1,2})([A-Za-z]{3})(\d{4})$/);
        if (match) {
            const month = months[match[2].toLowerCase()];
            if (month) return `${parseInt(match[1])} ${month} ${match[3]}`;
        }
        return batchId;
    }

    // Extract batch data from Excel rows (ONE FILE = ONE BATCH)
// Extract batch data from Excel rows (ONE FILE = ONE BATCH)
    // Column A is IGNORED - Batch ID comes from the filename
    extractBatchData(rows, fileName, totalVolume = 0) {
        const batch = {
            batchId: null, // Will be set from filename
            trucks: new Set(),
            hubs: new Set(),
            dos: new Set(),
            routes: new Set(),
            consignees: new Set(),
            holdDOs: new Set(),
            cancelDOs: new Set(),
            doSkuPairs: new Set(), // Unique "DO|||SKU" pairs for SKU counting
            smallDO: 0,
            bigDO: 0,
            totalQty: 0,
            totalVolume: totalVolume, // Pre-extracted from Impulse-Route sheet
            items: []
        };
        
        // Map to track type per unique DO (a DO spans multiple product rows)
        const doTypeMap = new Map(); // DO Number → 'small' | 'big'
        
        let hasData = false;
        
        rows.forEach(row => {
            if (!row || row.length === 0) return; // Skip empty rows
            
            // Column A (row[0]) is intentionally IGNORED
            const truck = String(row[1] || "").trim(); // Column B: Truck
            const hub = String(row[2] || "").trim(); // Column C: Hub
            const doNumber = String(row[3] || "").trim(); // Column D: DO
            const route = String(row[4] || "").trim(); // Column E: Route
            const productCode = String(row[5] || "").trim(); // Column F: Product Code
            const shipQty = parseInt(String(row[6]).replace(/[^0-9]/g, "")) || 0; // Column G: Ship Qty
            const consignee = String(row[7] || "").trim(); // Column H: Consignee
            const type = String(row[9] || "").trim().toLowerCase(); // Column J: Type
            // Column K (row[10], Model Name) is intentionally IGNORED
            
            // Skip rows with no meaningful data
            if (!truck && !doNumber && !productCode && shipQty === 0) return;
            
            hasData = true;
            
            if (truck) {
                const lowerTruck = truck.toLowerCase();
                if (lowerTruck.includes('hold')) {
                    if (doNumber) batch.holdDOs.add(doNumber);
                } else if (lowerTruck.includes('cancel')) {
                    if (doNumber) batch.cancelDOs.add(doNumber);
                } else if (typeof isStatusOrNonTruck === 'function' ? !isStatusOrNonTruck(truck) : /^\d+$/.test(truck.trim())) {
                    batch.trucks.add(truck);
                }
            }
            if (hub) batch.hubs.add(hub);
            if (doNumber) batch.dos.add(doNumber);
            if (route) batch.routes.add(route);
            if (consignee) batch.consignees.add(consignee);
            // SKU counting: unique (DO, SKU) pair — same SKU under different DOs counts separately,
            // duplicate SKU rows within the same DO count once
            if (doNumber && productCode) batch.doSkuPairs.add(doNumber + '|||' + productCode);
            
            // Track type per unique DO (NOT per row)
            if (doNumber && type) {
                if (type.includes('small')) doTypeMap.set(doNumber, 'small');
                else if (type.includes('big')) doTypeMap.set(doNumber, 'big');
            }
            
            batch.totalQty += shipQty;
            
            batch.items.push({
                do: doNumber,
                productCode,
                qty: shipQty,
                type
            });
        });
        
        // Count unique DOs by type (each DO counted once)
        batch.smallDO = [...doTypeMap.values()].filter(t => t === 'small').length;
        batch.bigDO = [...doTypeMap.values()].filter(t => t === 'big').length;
        
        if (!hasData) return null;
        
        // Derive batch ID from filename
        const { batchId } = this.deriveBatchIdFromFileName(fileName);
        batch.batchId = batchId;
        
        // Return single batch object with calculated metrics
        return this.calculateMetrics(batch, fileName);
    }

    // Calculate derived metrics for a batch
    calculateMetrics(batch, fileName) {
        const totalDO = batch.dos.size;
        const totalTrucks = batch.trucks.size;
        const totalSKU = batch.doSkuPairs.size; // Unique (DO, SKU) pairs
        
        // Derive batch date from filename (same logic as batch ID)
        const { date: batchDate } = this.deriveBatchIdFromFileName(fileName);
        
        return {
            batchId: batch.batchId,
            batchName: this.formatBatchName(batch.batchId),
            batchDate: batchDate,
            uploadDate: new Date().toISOString(),
            uploadedBy: document.getElementById('uploadedByInput')?.value.trim() || 'Anonymous',
            fileName: fileName,
            
            totalTrucks,
            holdDOCount: batch.holdDOs.size,
            cancelDOCount: batch.cancelDOs.size,
            totalDO,
            smallDOCount: batch.smallDO,
            bigDOCount: batch.bigDO,
            totalSKU,
            totalQuantity: batch.totalQty,
            totalVolume: parseFloat(batch.totalVolume.toFixed(4)),
            totalConsignees: batch.consignees.size,
            totalRoutes: batch.routes.size,
            totalZones: batch.hubs.size,
            
            avgDOPerTruck: totalTrucks > 0 ? parseFloat((totalDO / totalTrucks).toFixed(2)) : 0,
            avgSKUPerDO: totalDO > 0 ? parseFloat((totalSKU / totalDO).toFixed(2)) : 0,
            avgQtyPerTruck: totalTrucks > 0 ? parseFloat((batch.totalQty / totalTrucks).toFixed(2)) : 0,
            
            lastUpdated: new Date().toISOString()
        };
    }

    // Add new batch to history
    addBatch(batchSummary) {
        // Check for duplicate
        const existing = this.batches.find(b => b.batchId === batchSummary.batchId);
        if (existing) {
            return { 
                success: false, 
                message: `Batch ${batchSummary.batchId} already exists`, 
                existing 
            };
        }
        
        this.batches.push(batchSummary);
        const saved = this.saveBatchHistory();
        
        return { 
            success: saved, 
            message: saved ? `Batch ${batchSummary.batchId} added successfully` : 'Failed to save batch'
        };
    }

    // Update existing batch
    updateBatch(batchSummary) {
        const index = this.batches.findIndex(b => b.batchId === batchSummary.batchId);
        if (index === -1) {
            return { 
                success: false, 
                message: `Batch ${batchSummary.batchId} not found in history` 
            };
        }
        
        // Preserve original upload date
        batchSummary.uploadDate = this.batches[index].uploadDate;
        batchSummary.lastUpdated = new Date().toISOString();
        
        this.batches[index] = batchSummary;
        const saved = this.saveBatchHistory();
        
        return { 
            success: saved, 
            message: saved ? `Batch ${batchSummary.batchId} updated successfully` : 'Failed to save batch'
        };
    }

    // Export batch analytics dataset to JSON format for sharing between users and backup
    exportToJSON() {
        if (!this.batches || this.batches.length === 0) {
            showToast("No batch analytics data to export! Please upload batch files first.", "warning");
            return;
        }

        // Sort chronologically by batchDate
        const sortedBatches = [...this.batches].sort((a, b) => (a.batchDate || "").localeCompare(b.batchDate || ""));

        const payload = {
            app: "DO_Status_Hub",
            version: "1.0",
            type: "batch_analytics_data",
            exportedAt: new Date().toISOString(),
            batchCount: sortedBatches.length,
            batches: sortedBatches
        };

        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        a.href = url;
        a.download = `Batch_Analytics_Data_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Import shared batch analytics dataset from JSON
    importFromJSON(event) {
        const file = event.target && event.target.files ? event.target.files[0] : null;
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const rawText = (e.target.result || "").replace(/^\uFEFF/, "").trim();
                if (!rawText) {
                    showToast("The selected JSON file is empty.", "error");
                    return;
                }
                const content = JSON.parse(rawText);
                let importedList = [];

                if (Array.isArray(content)) {
                    importedList = content;
                } else if (content && Array.isArray(content.batches)) {
                    importedList = content.batches;
                } else {
                    showToast("Invalid JSON structure. The file must contain a batches array or a 'batches' property.", "error");
                    return;
                }

                const cleanBatches = [];
                importedList.forEach(item => {
                    if (item && item.batchId) {
                        cleanBatches.push({
                            batchId: String(item.batchId).trim(),
                            batchName: item.batchName || this.formatBatchName(item.batchId),
                            batchDate: item.batchDate || new Date().toISOString().split('T')[0],
                            uploadDate: item.uploadDate || new Date().toISOString(),
                            uploadedBy: item.uploadedBy || 'Shared User',
                            fileName: item.fileName || `Shared_Batch_${item.batchId}.xlsx`,
                            totalTrucks: Number(item.totalTrucks) || 0,
                            holdDOCount: Number(item.holdDOCount) || 0,
                            cancelDOCount: Number(item.cancelDOCount) || 0,
                            totalDO: Number(item.totalDO) || 0,
                            smallDOCount: Number(item.smallDOCount) || 0,
                            bigDOCount: Number(item.bigDOCount) || 0,
                            totalSKU: Number(item.totalSKU) || 0,
                            totalQuantity: Number(item.totalQuantity) || 0,
                            totalVolume: Number(item.totalVolume) || 0,
                            totalConsignees: Number(item.totalConsignees) || 0,
                            totalRoutes: Number(item.totalRoutes) || 0,
                            totalZones: Number(item.totalZones) || 0,
                            avgDOPerTruck: Number(item.avgDOPerTruck) || 0,
                            avgSKUPerDO: Number(item.avgSKUPerDO) || 0,
                            avgQtyPerTruck: Number(item.avgQtyPerTruck) || 0,
                            lastUpdated: item.lastUpdated || new Date().toISOString()
                        });
                    }
                });

                if (cleanBatches.length === 0) {
                    showToast("No valid batch records found in the JSON file.", "warning");
                    return;
                }

                // Prompt user: Merge vs Replace
                const merge = await window.showConfirmDialog({
                    title: "Import Shared History",
                    message: `Found ${cleanBatches.length} batch record(s) in JSON file.\n\n` +
                             `Click [MERGE] to UPDATE with your current batch history (updates matching Batch IDs, appends new batches).\n` +
                             `Click [REPLACE] to completely OVERWRITE your entire dashboard with this shared dataset.`,
                    confirmText: "MERGE",
                    cancelText: "REPLACE",
                    isDanger: false,
                    icon: "📥"
                });
                
                if (merge) {
                    let updatedCount = 0;
                    let addedCount = 0;

                    cleanBatches.forEach(b => {
                        const existingIdx = this.batches.findIndex(ex => ex.batchId === b.batchId);
                        if (existingIdx !== -1) {
                            this.batches[existingIdx] = b;
                            updatedCount++;
                        } else {
                            this.batches.push(b);
                            addedCount++;
                        }
                    });

                    // Sort chronologically
                    this.batches.sort((a, b) => (b.batchDate || "").localeCompare(a.batchDate || ""));
                    showToast(`Batch history merged!\n• Updated: ${updatedCount} existing batch(es)\n• Added: ${addedCount} new batch(es)\n• Total: ${this.batches.length} batch(es) recorded.`, "success");
                } else {
                    this.batches = cleanBatches.sort((a, b) => (b.batchDate || "").localeCompare(a.batchDate || ""));
                    showToast(`Batch history replaced!\n• Loaded ${this.batches.length} batch record(s).`, "success");
                }

                this.saveBatchHistory();
                refreshBatchDashboard();
            } catch (err) {
                console.error("Failed to parse JSON Batch Analytics file", err);
                showToast(`Failed to read JSON file: ${err.message}\n\nPlease ensure it is valid JSON formatting.`, "error");
            } finally {
                if (event.target) event.target.value = "";
            }
        };

        reader.readAsText(file);
    }

    // Get filtered and sorted batches
    getFilteredBatches() {
        let filtered = [...this.batches];
        
        // Apply filters
        if (this.filters.batch !== 'ALL') {
            filtered = filtered.filter(b => b.batchId === this.filters.batch);
        }
        if (this.filters.month !== 'ALL') {
            filtered = filtered.filter(b => {
                const month = new Date(b.batchDate).getMonth() + 1;
                return month === parseInt(this.filters.month);
            });
        }
        if (this.filters.year !== 'ALL') {
            filtered = filtered.filter(b => {
                const year = new Date(b.batchDate).getFullYear();
                return year === parseInt(this.filters.year);
            });
        }
        if (this.filters.search) {
            const search = this.filters.search.toLowerCase();
            filtered = filtered.filter(b => 
                b.batchName.toLowerCase().includes(search) ||
                b.batchId.toLowerCase().includes(search) ||
                b.fileName.toLowerCase().includes(search) ||
                b.uploadedBy.toLowerCase().includes(search)
            );
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
            const field = this.currentSort.field;
            const dir = this.currentSort.direction === 'asc' ? 1 : -1;
            
            let aVal = a[field];
            let bVal = b[field];
            
            if (typeof aVal === 'string') {
                return aVal.localeCompare(bVal) * dir;
            }
            return (aVal - bVal) * dir;
        });
        
        return filtered;
    }

    // Get paginated slice of filtered batches
    getPaginatedBatches() {
        const filtered = this.getFilteredBatches();
        if (this.pageSize <= 0) return filtered; // 0 or negative means "All"
        
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / this.pageSize) || 1;
        
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        return filtered.slice(startIndex, startIndex + this.pageSize);
    }

    // Get total page count based on current filters and page size
    getTotalPages() {
        const filtered = this.getFilteredBatches();
        if (this.pageSize <= 0) return 1;
        return Math.ceil(filtered.length / this.pageSize) || 1;
    }

    // Calculate KPI metrics
    calculateKPIs() {
        const filtered = this.getFilteredBatches();
        
        return {
            totalBatches: filtered.length,
            totalTrucks: filtered.reduce((sum, b) => sum + b.totalTrucks, 0),
            totalDO: filtered.reduce((sum, b) => sum + b.totalDO, 0),
            totalSKU: filtered.reduce((sum, b) => sum + b.totalSKU, 0),
            totalQuantity: filtered.reduce((sum, b) => sum + b.totalQuantity, 0),
            totalVolume: filtered.reduce((sum, b) => sum + b.totalVolume, 0),
            avgTrucksPerBatch: filtered.length > 0 ? 
                parseFloat((filtered.reduce((sum, b) => sum + b.totalTrucks, 0) / filtered.length).toFixed(1)) : 0,
            avgDOPerBatch: filtered.length > 0 ? 
                parseFloat((filtered.reduce((sum, b) => sum + b.totalDO, 0) / filtered.length).toFixed(1)) : 0
        };
    }

    // Get unique values for filter dropdowns
    getUniqueBatches() {
        return [...new Set(this.batches.map(b => b.batchId))].sort();
    }

    getUniqueMonths() {
        const months = new Set();
        this.batches.forEach(b => {
            const month = new Date(b.batchDate).getMonth() + 1;
            months.add(month);
        });
        return Array.from(months).sort((a, b) => a - b);
    }

    getUniqueYears() {
        const years = new Set();
        this.batches.forEach(b => {
            const year = new Date(b.batchDate).getFullYear();
            years.add(year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }
}

// Global instance
const batchManager = new BatchAnalyticsManager();
window.batchManager = batchManager;

// File upload handlers
async function handleNewBatchUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    let totalSuccess = 0;
    let totalDuplicates = 0;
    let totalErrors = [];
    
    // Process each file (ONE FILE = ONE BATCH)
    for (const file of files) {
        try {
            const batchData = await batchManager.parseBatchFile(file);
            
            if (!batchData) {
                totalErrors.push(`${file.name}: No batch data found`);
                continue;
            }
            
            const result = batchManager.addBatch(batchData);
            if (result.success) {
                totalSuccess++;
            } else if (result.existing) {
                totalDuplicates++;
            } else {
                totalErrors.push(`${file.name}: ${result.message}`);
            }
        } catch (err) {
            console.error(`Error parsing ${file.name}:`, err);
            totalErrors.push(`${file.name}: ${err.message}`);
        }
    }
    
    // Show consolidated results
    let message = '';
    if (totalSuccess > 0) {
        message = `[SUCCESS] Added ${totalSuccess} new batch(es) from ${files.length} file(s)!`;
        if (totalDuplicates > 0) {
            message += `\n\n${totalDuplicates} duplicate(s) skipped.`;
        }
        if (totalErrors.length > 0) {
            message += `\n\n⚠️ ${totalErrors.length} error(s):\n` + totalErrors.slice(0, 5).join('\n');
            if (totalErrors.length > 5) {
                message += `\n... and ${totalErrors.length - 5} more`;
            }
        }
        showToast(message, "warning");
        refreshBatchDashboard();
    } else if (totalDuplicates > 0) {
        const proceed = await window.showConfirmDialog({
            title: "Duplicate Batches Found",
            message: `[DUPLICATE] ${totalDuplicates} batch(es) already exist. Do you want to update them with this new data?`,
            confirmText: "Update Batches",
            isDanger: false,
            icon: "🔄"
        });
        if (proceed) {
            let updateCount = 0;
            for (const file of files) {
                try {
                    const batchData = await batchManager.parseBatchFile(file);
                    if (batchData) {
                        const result = batchManager.updateBatch(batchData);
                        if (result.success) updateCount++;
                    }
                } catch (err) {
                    console.error(`Error updating from ${file.name}:`, err);
                }
            }
            showToast(`Updated ${updateCount} batch(es)!`, "success");
            refreshBatchDashboard();
        }
    } else if (totalErrors.length > 0) {
        showToast('' + totalErrors.join('\n', "error"));
    }
    
    event.target.value = ''; // Reset file input
}

async function handleUpdateBatchUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    let totalUpdated = 0;
    let totalNotFound = 0;
    let totalErrors = [];
    
    // Process each file (ONE FILE = ONE BATCH)
    for (const file of files) {
        try {
            const batchData = await batchManager.parseBatchFile(file);
            
            if (!batchData) {
                totalErrors.push(`${file.name}: No batch data found`);
                continue;
            }
            
            const result = batchManager.updateBatch(batchData);
            if (result.success) {
                totalUpdated++;
            } else if (result.message.includes('not found')) {
                totalNotFound++;
                totalErrors.push(`${file.name}: Batch ${batchData.batchId} not found in history`);
            } else {
                totalErrors.push(`${file.name}: ${result.message}`);
            }
        } catch (err) {
            console.error(`Error parsing ${file.name}:`, err);
            totalErrors.push(`${file.name}: ${err.message}`);
        }
    }
    
    // Show consolidated results
    let message = '';
    if (totalUpdated > 0) {
        message = `[SUCCESS] Updated ${totalUpdated} batch(es) from ${files.length} file(s)!`;
        if (totalNotFound > 0) {
            message += `\n\n${totalNotFound} batch(es) not found in history.`;
        }
        if (totalErrors.length > 0) {
            message += `\n\n⚠️ ${totalErrors.length} error(s):\n` + totalErrors.slice(0, 5).join('\n');
            if (totalErrors.length > 5) {
                message += `\n... and ${totalErrors.length - 5} more`;
            }
        }
        showToast(message, "warning");
        refreshBatchDashboard();
    } else if (totalErrors.length > 0) {
        showToast('' + totalErrors.join('\n', "error"));
    } else {
        showToast('No batches were updated', "error");
    }
    
    event.target.value = ''; // Reset file input
}

// UI refresh functions
function refreshBatchDashboard() {
    if (!document.getElementById('batchTableBody')) return;
    const kpis = batchManager.calculateKPIs();
    renderKPIs(kpis);
    populateFilterDropdowns();
    renderBatchTable();
    if (typeof renderBatchCharts === 'function') {
        renderBatchCharts();
    }
}

function renderKPIs(kpis) {
    document.getElementById('kpi-total-trucks').innerText = kpis.totalTrucks.toLocaleString();
    document.getElementById('kpi-avg-trucks').innerText = `Avg: ${kpis.avgTrucksPerBatch} per batch`;
    document.getElementById('kpi-total-do').innerText = kpis.totalDO.toLocaleString();
    document.getElementById('kpi-avg-do').innerText = `Avg: ${kpis.avgDOPerBatch} per batch`;
    document.getElementById('kpi-total-sku').innerText = kpis.totalSKU.toLocaleString();
    document.getElementById('kpi-total-quantity').innerText = kpis.totalQuantity.toLocaleString();
    document.getElementById('kpi-total-volume').innerText = kpis.totalVolume.toFixed(2) + ' m³';
}

function populateFilterDropdowns() {
    // Batch filter
    const batchFilter = document.getElementById('batchFilter');
    const currentBatch = batchFilter.value;
    const uniqueBatches = batchManager.getUniqueBatches();
    batchFilter.innerHTML = '<option value="ALL">All Batches</option>' +
        uniqueBatches.map(b => `<option value="${b}" ${b === currentBatch ? 'selected' : ''}>${batchManager.formatBatchName(b)}</option>`).join('');
    
    // Month filter
    const monthFilter = document.getElementById('monthFilter');
    const currentMonth = monthFilter.value;
    const uniqueMonths = batchManager.getUniqueMonths();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthFilter.innerHTML = '<option value="ALL">All Months</option>' +
        uniqueMonths.map(m => `<option value="${m}" ${m == currentMonth ? 'selected' : ''}>${monthNames[m-1]}</option>`).join('');
    
    // Year filter
    const yearFilter = document.getElementById('yearFilter');
    const currentYear = yearFilter.value;
    const uniqueYears = batchManager.getUniqueYears();
    yearFilter.innerHTML = '<option value="ALL">All Years</option>' +
        uniqueYears.map(y => `<option value="${y}" ${y == currentYear ? 'selected' : ''}>${y}</option>`).join('');
}

function changePage(page) {
    const totalPages = batchManager.getTotalPages();
    if (page < 1 || page > totalPages) return;
    batchManager.currentPage = page;
    renderBatchTable();
}

function changePageSize(size) {
    batchManager.pageSize = parseInt(size, 10) || 5;
    batchManager.currentPage = 1;
    renderBatchTable();
}

function renderBatchTable() {
    const allFiltered = batchManager.getFilteredBatches();
    const paginated = batchManager.getPaginatedBatches();
    const tbody = document.getElementById('batchTableBody');
    
    if (allFiltered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:#64748b; font-size: 13px;">No batches found. Upload a batch file to get started.</td></tr>';
        renderPagination(0);
        return;
    }
    
    tbody.innerHTML = paginated.map(b => `
        <tr>
            <td>
                <strong>${b.batchName}</strong>
                ${b.fileName ? `<div class="batch-filename-subtext" title="${b.fileName}">${b.fileName}</div>` : ''}
            </td>
            <td>${b.totalTrucks}</td>
            <td>${b.totalDO}</td>
            <td><span class="category-badge category-small">${b.smallDOCount}</span></td>
            <td><span class="category-badge category-big">${b.bigDOCount}</span></td>
            <td>${b.totalSKU}</td>
            <td>${b.totalQuantity.toLocaleString()}</td>
            <td>${b.totalVolume.toFixed(2)} m³</td>
        </tr>
    `).join('');

    renderPagination(allFiltered.length);
}

function renderPagination(totalFilteredItems) {
    const paginationContainer = document.getElementById('batchPagination');
    if (!paginationContainer) return;
    
    if (totalFilteredItems === 0) {
        paginationContainer.innerHTML = '';
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'flex';
    
    const pageSize = batchManager.pageSize;
    const currentPage = batchManager.currentPage;
    const totalPages = batchManager.getTotalPages();
    
    let startItem = 1;
    let endItem = totalFilteredItems;
    
    if (pageSize > 0) {
        startItem = (currentPage - 1) * pageSize + 1;
        endItem = Math.min(currentPage * pageSize, totalFilteredItems);
    }
    
    let paginationHTML = `
        <div class="pagination-info">
            Showing <strong>${startItem}–${endItem}</strong> of <strong>${totalFilteredItems}</strong> batch file(s)
        </div>
    `;
    
    if (pageSize > 0 && totalPages > 1) {
        paginationHTML += `<div class="pagination-controls">`;
        
        // Prev button
        paginationHTML += `
            <button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                ‹ Prev
            </button>
        `;
        
        // Page buttons logic (smart range for long page lists)
        let pageNumbers = [];
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        if (startPage > 1) {
            pageNumbers.push(1);
            if (startPage > 2) pageNumbers.push('...');
        }
        for (let p = startPage; p <= endPage; p++) {
            pageNumbers.push(p);
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) pageNumbers.push('...');
            pageNumbers.push(totalPages);
        }
        
        pageNumbers.forEach(p => {
            if (p === '...') {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            } else {
                paginationHTML += `
                    <button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="changePage(${p})">
                        ${p}
                    </button>
                `;
            }
        });
        
        // Next button
        paginationHTML += `
            <button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                Next ›
            </button>
        `;
        
        paginationHTML += `</div>`;
    }
    
    paginationContainer.innerHTML = paginationHTML;
}

function sortBatchTable(field) {
    if (batchManager.currentSort.field === field) {
        batchManager.currentSort.direction = 
            batchManager.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        batchManager.currentSort.field = field;
        batchManager.currentSort.direction = 'asc';
    }
    batchManager.currentPage = 1;
    renderBatchTable();
}

function applyBatchFilters() {
    batchManager.filters.batch = document.getElementById('batchFilter').value;
    batchManager.filters.month = document.getElementById('monthFilter').value;
    batchManager.filters.year = document.getElementById('yearFilter').value;
    batchManager.filters.search = document.getElementById('batchSearch').value.toLowerCase().trim();
    batchManager.currentPage = 1;
    refreshBatchDashboard();
}

// Reset all batch analytics data
async function resetBatchAnalytics() {
    const batchCount = batchManager.batches.length;
    
    if (batchCount === 0) {
        showToast('No batch data to reset. Dashboard is already empty.', "info");
        return;
    }
    
    const confirmMessage = `⚠️ WARNING: This will permanently delete ALL batch history data!\n\n` +
                          `• ${batchCount} batch(es) will be removed\n` +
                          `• All KPIs and charts will be reset\n` +
                          `• This action CANNOT be undone`;
    
    const proceed = await window.showConfirmDialog({
        title: "Reset Batch Analytics",
        message: confirmMessage,
        confirmText: "Delete All Data",
        isDanger: true,
        icon: "🗑️"
    });
    
    if (!proceed) return;
    
    const doubleProceed = await window.showConfirmDialog({
        title: "Final Confirmation",
        message: "Are you absolutely sure you want to permanently delete all batch data?",
        confirmText: "Yes, Delete Everything",
        isDanger: true,
        icon: "🚨"
    });
    
    if (!doubleProceed) return;
    
    try {
        // Clear batch history
        batchManager.batches = [];
        batchManager.saveBatchHistory();
        
        // Reset filters
        batchManager.filters = {
            batch: 'ALL',
            month: 'ALL',
            year: 'ALL',
            search: ''
        };
        
        // Reset sort
        batchManager.currentSort = { field: 'batchDate', direction: 'desc' };
        
        // Clear uploaded by input
        const uploadedByInput = document.getElementById('uploadedByInput');
        if (uploadedByInput) {
            uploadedByInput.value = '';
        }
        
        // Refresh dashboard
        refreshBatchDashboard();
        
        showToast(`Dashboard reset complete!\n\n${batchCount} batch(es) have been permanently deleted.`, "success");
    } catch (err) {
        console.error('Reset error:', err);
        showToast('Failed to reset dashboard: ' + err.message);
    }
}

// Global Export/Import triggers
function exportBatchAnalyticsJSON() {
    if (batchManager) {
        batchManager.exportToJSON();
    }
}

function importBatchAnalyticsJSON(event) {
    if (batchManager) {
        batchManager.importFromJSON(event);
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    if (typeof initTheme === 'function') initTheme();
    refreshBatchDashboard();
});
