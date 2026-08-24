// DO Summary List Generator - JavaScript Conversion of BatachSummary.bas & FinalSummary.bas

class DOSummaryGenerator {
    constructor() {
        this.batches = []; // [{ batchName: 'Batch 01', waveNumber: '01', records: [...] }]
        this.currentBatchIndex = 0;
        this.hasCompiledFinalSummary = false;
        this.searchQuery = "";
        this.targetFileName = "";

        this.defaultPresets = [
            { label: "OWN USE", color: "red" },
            { label: "CABN", color: "yellow" },
            { label: "SELF COLLECT", color: "blue" },
            { label: "SPX", color: "green" },
            { label: "OWN USE/CABN", color: "purple" },
            { label: "SGBROS DELIVERY", color: "gray" }
        ];
        this.presetRemarks = [...this.defaultPresets];

        this.init();
    }

    init() {
        this.isSimplifyMode = true;
        this.loadFromStorage();
        this.renderUI();
        this.applySimplifyModeUI();
    }

    loadFromStorage() {
        const stored = localStorage.getItem("DO_Summary_Generator_Data");
        if (stored) {
            try {
                this.batches = JSON.parse(stored);
                // Ensure all records have selected property initialized
                this.batches.forEach(b => {
                if (b.batchName === "FINAL SUMMARY") return;
                    if (b.records) {
                        b.records.forEach(r => {
                            if (r.selected === undefined) r.selected = true;
                        });
                    }
                });
            } catch (e) {
                console.error("Failed to load DO Summary Generator data", e);
                this.batches = [];
            }
        }
        this.hasCompiledFinalSummary = localStorage.getItem("DO_Summary_Generator_Compiled") === "1";
        this.targetFileName = localStorage.getItem("DO_Summary_Generator_FileName") || "";
        this.generatorDate = localStorage.getItem("DO_Summary_Generator_Date") || "";

        const savedPresets = localStorage.getItem("DSG_Preset_Remarks");
        if (savedPresets) {
            try {
                this.presetRemarks = JSON.parse(savedPresets);
            } catch (e) {
                this.presetRemarks = this.parseHTMLPresets() || [...this.defaultPresets];
            }
        } else {
            const htmlParsed = this.parseHTMLPresets();
            this.presetRemarks = (htmlParsed && htmlParsed.length > 0) ? htmlParsed : [...this.defaultPresets];
        }
    }

    parseHTMLPresets() {
        const quickContainer = document.getElementById("quickPresetChipsContainer");
        if (!quickContainer) return null;

        const chipBtns = quickContainer.querySelectorAll("button[data-preset-label]");
        if (!chipBtns || chipBtns.length === 0) return null;

        const parsed = [];
        chipBtns.forEach(btn => {
            const label = btn.getAttribute("data-preset-label");
            const color = btn.getAttribute("data-preset-color") || "blue";
            if (label) {
                parsed.push({ label: label, color: color });
            }
        });

        return parsed.length > 0 ? parsed : null;
    }

    saveToStorage() {
        localStorage.setItem("DO_Summary_Generator_Data", JSON.stringify(this.batches));
        localStorage.setItem("DO_Summary_Generator_Compiled", this.hasCompiledFinalSummary ? "1" : "0");
        if (this.targetFileName) {
            localStorage.setItem("DO_Summary_Generator_FileName", this.targetFileName);
        }
        if (this.generatorDate) {
            localStorage.setItem("DO_Summary_Generator_Date", this.generatorDate);
        }
        localStorage.setItem("DSG_Preset_Remarks", JSON.stringify(this.presetRemarks));
    }

    showToast(message, type = "info", duration = 3500) {
        const container = document.getElementById("dsgToastContainer");
        if (!container) return;

        const toast = document.createElement("div");
        toast.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 18px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border);
            pointer-events: auto;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0;
            transform: translateY(-12px) scale(0.96);
            max-width: 420px;
            line-height: 1.45;
            backdrop-filter: blur(12px);
        `;

        let icon = "ℹ️";
        let bg = "var(--surface-card, var(--bg-elevated, #ffffff))";
        let border = "1px solid var(--border)";
        let fg = "var(--fg)";

        if (type === "success") {
            icon = "✅";
            bg = "var(--bg-elevated, #ffffff)";
            border = "1px solid #10b981";
            fg = "var(--fg)";
        } else if (type === "error") {
            icon = "❌";
            bg = "var(--bg-elevated, #ffffff)";
            border = "1px solid #ef4444";
            fg = "var(--fg)";
        } else if (type === "warning") {
            icon = "⚠️";
            bg = "var(--bg-elevated, #ffffff)";
            border = "1px solid #f59e0b";
            fg = "var(--fg)";
        } else if (type === "info") {
            icon = "ℹ️";
            bg = "var(--bg-elevated, #ffffff)";
            border = "1px solid var(--accent, #3b82f6)";
            fg = "var(--fg)";
        }

        toast.style.background = bg;
        toast.style.border = border;
        toast.style.color = fg;
        toast.innerHTML = `<span style="font-size: 16px;">${icon}</span><span style="flex:1;">${message.replace(/\n/g, '<br>')}</span><span style="font-size: 12px; opacity: 0.6; padding: 2px;">✕</span>`;

        toast.onclick = () => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-12px) scale(0.96)";
            setTimeout(() => toast.remove(), 250);
        };

        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateY(0) scale(1)";
        });

        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = "0";
                toast.style.transform = "translateY(-12px) scale(0.96)";
                setTimeout(() => toast.remove(), 250);
            }
        }, duration);
    }

    showConfirmDialog({ title = "Confirm Action", message = "Are you sure?", confirmText = "Confirm", isDanger = true, icon = "⚠️" }) {
        return new Promise((resolve) => {
            const modal = document.getElementById("customConfirmModal");
            if (!modal) {
                resolve(true);
                return;
            }

            const elTitle = document.getElementById("confirmModalTitle");
            const elMsg = document.getElementById("confirmModalMessage");
            const elIcon = document.getElementById("confirmModalIcon");
            const iconBadge = document.getElementById("confirmModalIconBadge");
            const btnOk = document.getElementById("confirmModalOkBtn");
            const btnCancel = document.getElementById("confirmModalCancelBtn");

            if (elTitle) elTitle.innerText = title;
            if (elMsg) elMsg.innerHTML = message.replace(/\n/g, "<br>");
            if (elIcon) elIcon.innerText = icon;

            if (iconBadge) {
                if (isDanger) {
                    iconBadge.style.background = "rgba(239, 68, 68, 0.12)";
                    iconBadge.style.borderColor = "rgba(239, 68, 68, 0.25)";
                } else {
                    iconBadge.style.background = "rgba(59, 130, 246, 0.12)";
                    iconBadge.style.borderColor = "rgba(59, 130, 246, 0.25)";
                }
            }
            
            if (btnOk) {
                btnOk.innerText = confirmText;
                btnOk.style.background = isDanger ? "#ef4444" : "var(--accent, #2563eb)";
            }

            modal.style.display = "flex";

            const cleanup = () => {
                modal.style.display = "none";
                btnOk.onclick = null;
                btnCancel.onclick = null;
            };

            btnOk.onclick = () => {
                cleanup();
                resolve(true);
            };

            btnCancel.onclick = () => {
                cleanup();
                resolve(false);
            };
        });
    }

    async reset() {
        if (this.batches.length > 0) {
            const confirmed = await this.showConfirmDialog({
                title: "Reset All Batches?",
                message: "This will clear all imported batches, line items, and compiled summaries. This action cannot be undone.",
                confirmText: "Reset All",
                isDanger: true,
                icon: "🗑️"
            });
            if (!confirmed) return;
        }

        this.batches = [];
        this.currentBatchIndex = 0;
        this.hasCompiledFinalSummary = false;
        localStorage.removeItem("DO_Summary_Generator_Data");
        localStorage.removeItem("DO_Summary_Generator_Compiled");
        localStorage.removeItem("DO_Summary_Generator_FileName");
        localStorage.removeItem("DO_Summary_Generator_Date");
        const fileInput = document.getElementById("sourceFilePicker");
        if (fileInput) fileInput.value = "";
        this.renderUI();
        this.showToast("All batches and summary data have been reset.", "info");
    }

    async resetCurrentBatch() {
        if (this.batches.length === 0 || !this.batches[this.currentBatchIndex]) {
            this.showToast("No batch available to delete.", "warning");
            return;
        }
        
        const activeBatch = this.batches[this.currentBatchIndex];
        const confirmed = await this.showConfirmDialog({
            title: `Delete ${activeBatch.batchName}?`,
            message: `Are you sure you want to delete ${activeBatch.batchName} containing ${activeBatch.records.length} DO records?`,
            confirmText: "Delete Batch",
            isDanger: true,
            icon: "🗑️"
        });
        if (!confirmed) return;
        
        const deletedName = activeBatch.batchName;
        this.batches.splice(this.currentBatchIndex, 1);
        if (this.currentBatchIndex >= this.batches.length) {
            this.currentBatchIndex = Math.max(0, this.batches.length - 1);
        }
        this.saveToStorage();
        this.renderUI();
        this.showToast(`Deleted ${deletedName}.`, "success");
    }

    async resetFinalSummary() {
        if (!this.hasCompiledFinalSummary) {
            this.showToast("No compiled Final Summary exists.", "info");
            return;
        }
        const confirmed = await this.showConfirmDialog({
            title: "Clear Final Summary?",
            message: "Are you sure you want to clear the compiled Final Summary?",
            confirmText: "Clear Summary",
            isDanger: true,
            icon: "📑"
        });
        if (!confirmed) return;
        
        this.hasCompiledFinalSummary = false;
        
        // Remove the FINAL SUMMARY batch from the array
        const finalBatchIndex = this.batches.findIndex(b => b.batchName === "FINAL SUMMARY");
        if (finalBatchIndex >= 0) {
            this.batches.splice(finalBatchIndex, 1);
            
            // Adjust current batch index if we were looking at the deleted tab or it's out of bounds
            if (this.currentBatchIndex >= this.batches.length) {
                this.currentBatchIndex = Math.max(0, this.batches.length - 1);
            }
        }

        localStorage.removeItem("DO_Summary_Generator_Compiled");
        this.saveToStorage();
        this.renderUI();
        this.showToast("Final Summary has been cleared.", "info");
    }

    onHeaderDateChange(val) {
        if (!val) return;
        const [yyyy, mm, dd] = val.split("-");
        if (dd && mm && yyyy) {
            const dateCode = `${dd}${mm}${yyyy}`;
            this.generatorDate = dateCode;
            this.targetFileName = `DO Summary List ${dateCode}.xlsx`;
            this.saveToStorage();
            this.renderUI();
            this.showToast(`Updated Summary Date to ${dd}/${mm}/${yyyy}`, "success");
        }
    }

    onHeaderWaveChange(val) {
        if (this.batches.length === 0 || !this.batches[this.currentBatchIndex]) return;
        const cleanVal = (val || "").trim() || "01";
        const activeBatch = this.batches[this.currentBatchIndex];
        activeBatch.waveNumber = cleanVal;
        activeBatch.records.forEach(r => {
            r.fileWaveNumber = cleanVal;
        });
        this.saveToStorage();
        this.renderBatchTabs();
        this.showToast(`Updated wave for ${activeBatch.batchName} to Wave ${cleanVal}`, "success");
    }

    syncModalDateFromPicker() {
        const picker = document.getElementById("importModalDatePicker");
        const codeInput = document.getElementById("importModalDateCode");
        const targetDisplay = document.getElementById("importModalTargetFileName");
        if (!picker || !codeInput) return;

        const val = picker.value;
        if (!val) return;
        const [yyyy, mm, dd] = val.split("-");
        if (dd && mm && yyyy) {
            const code = `${dd}${mm}${yyyy}`;
            codeInput.value = code;
            if (targetDisplay) targetDisplay.innerText = `DO Summary List ${code}.xlsx`;
        }
    }

    syncModalDateFromCode() {
        const picker = document.getElementById("importModalDatePicker");
        const codeInput = document.getElementById("importModalDateCode");
        const targetDisplay = document.getElementById("importModalTargetFileName");
        if (!picker || !codeInput) return;

        const code = codeInput.value.trim().replace(/\D/g, "");
        if (code.length === 8) {
            const dd = code.substring(0, 2);
            const mm = code.substring(2, 4);
            const yyyy = code.substring(4, 8);
            picker.value = `${yyyy}-${mm}-${dd}`;
            if (targetDisplay) targetDisplay.innerText = `DO Summary List ${code}.xlsx`;
        }
    }

    setModalWave(wave) {
        const input = document.getElementById("importModalWaveInput");
        if (input) input.value = wave;
    }

    onImportDestChange() {
        const isAppend = document.getElementById("importDestAppend")?.checked;
        const select = document.getElementById("importModalAppendSelect");
        if (select) {
            select.disabled = !isAppend;
            if (isAppend) select.focus();
        }
    }

    // Opens custom setup modal and returns Promise resolved upon user action
    openImportBatchModal(file, parsedRecords, missingRouteCount, missingVolumeCount, newRecords, duplicateRecords) {
        return new Promise((resolve) => {
            this.pendingImportResolver = resolve;
            this.pendingImportPayload = {
                file,
                parsedRecords,
                missingRouteCount,
                missingVolumeCount,
                newRecords,
                duplicateRecords
            };

            const modal = document.getElementById("importBatchModal");
            if (!modal) {
                resolve({ cancelled: true });
                return;
            }

            // Populate File Details
            const elFileName = document.getElementById("importModalFileName");
            const elRecordCount = document.getElementById("importModalRecordCount");
            const elMissing = document.getElementById("importModalMissingNotice");

            if (elFileName) elFileName.innerText = file.name;
            if (elRecordCount) elRecordCount.innerText = `${parsedRecords.length} DOs found`;

            if (elMissing) {
                if (missingRouteCount > 0 || missingVolumeCount > 0) {
                    elMissing.style.display = "block";
                    elMissing.innerHTML = `⚠️ Missing Info: ` +
                        (missingRouteCount > 0 ? `${missingRouteCount} empty Route ` : '') +
                        (missingVolumeCount > 0 ? `${missingVolumeCount} 0/empty Volume` : '') +
                        ` (flagged in red).`;
                } else {
                    elMissing.style.display = "none";
                }
            }

            // Date setup
            const picker = document.getElementById("importModalDatePicker");
            const codeInput = document.getElementById("importModalDateCode");
            const targetDisplay = document.getElementById("importModalTargetFileName");

            let defaultDateCode = this.generatorDate;
            let defaultPickerVal = "";

            if (defaultDateCode && defaultDateCode.length === 8) {
                const dd = defaultDateCode.substring(0, 2);
                const mm = defaultDateCode.substring(2, 4);
                const yyyy = defaultDateCode.substring(4, 8);
                defaultPickerVal = `${yyyy}-${mm}-${dd}`;
            } else {
                const targetDate = new Date();
                if (targetDate.getDay() === 5) {
                    targetDate.setDate(targetDate.getDate() + 3);
                } else if (targetDate.getDay() === 6) {
                    targetDate.setDate(targetDate.getDate() + 2);
                } else {
                    targetDate.setDate(targetDate.getDate() + 1);
                }
                const yyyy = targetDate.getFullYear();
                const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                const dd = String(targetDate.getDate()).padStart(2, '0');
                defaultDateCode = `${dd}${mm}${yyyy}`;
                defaultPickerVal = `${yyyy}-${mm}-${dd}`;
            }

            if (picker) picker.value = defaultPickerVal;
            if (codeInput) codeInput.value = defaultDateCode;
            if (targetDisplay) targetDisplay.innerText = `DO Summary List ${defaultDateCode}.xlsx`;

            // Wave setup
            const waveInput = document.getElementById("importModalWaveInput");
            let rawFileName = file.name.replace(/\.[^/.]+$/, "").trim();
            if (rawFileName.length > 20) {
                rawFileName = rawFileName.substring(0, 20) + "...";
            }
            let defaultWave = rawFileName || "01";
            
            if (waveInput) waveInput.value = defaultWave;

            // Destination setup
            const destGroup = document.getElementById("importModalDestinationGroup");
            const destNewRadio = document.getElementById("importDestNew");
            const destAppendSelect = document.getElementById("importModalAppendSelect");
            const destNewLabel = document.getElementById("importDestNewLabel");

            if (this.batches.length > 0) {
                if (destGroup) destGroup.style.display = "block";
                if (destNewRadio) destNewRadio.checked = true;
                const nextBatchNum = this.batches.length + 1;
                if (destNewLabel) destNewLabel.innerText = `Create New Batch (Batch ${String(nextBatchNum).padStart(2, '0')})`;

                if (destAppendSelect) {
                    destAppendSelect.innerHTML = this.batches.map((b, i) => 
                        `<option value="${i}">${b.batchName} (Wave ${b.waveNumber}) - ${b.records.length} DOs</option>`
                    ).join("");
                    destAppendSelect.disabled = true;
                }
            } else {
                if (destGroup) destGroup.style.display = "none";
            }

            // Duplicate DO setup
            const dupeGroup = document.getElementById("importModalDuplicateGroup");
            const dupeSummary = document.getElementById("importModalDupeSummary");
            const dupeSamples = document.getElementById("importModalDupeSamples");
            const dupeNewCount = document.getElementById("importDupeNewCount");
            const dupeTotalCount = document.getElementById("importDupeTotalCount");

            if (duplicateRecords.length > 0) {
                if (dupeGroup) dupeGroup.style.display = "block";
                if (dupeSummary) dupeSummary.innerText = `${duplicateRecords.length} Duplicate DO(s) Detected in Existing Batches`;
                if (dupeSamples) {
                    dupeSamples.innerHTML = duplicateRecords.slice(0, 6).map(d => `• ${d.record.invoiceNo} (found in ${d.foundIn})`).join("<br>");
                }
                if (dupeNewCount) dupeNewCount.innerText = newRecords.length;
                if (dupeTotalCount) dupeTotalCount.innerText = parsedRecords.length;
            } else {
                if (dupeGroup) dupeGroup.style.display = "none";
            }

            modal.style.display = "flex";
        });
    }

    confirmImportBatch() {
        if (!this.pendingImportPayload || !this.pendingImportResolver) return;

        const { parsedRecords, newRecords, duplicateRecords } = this.pendingImportPayload;

        // Read Date
        const codeInput = document.getElementById("importModalDateCode");
        const picker = document.getElementById("importModalDatePicker");
        let dateCode = codeInput ? codeInput.value.trim().replace(/\D/g, "") : "";
        if (dateCode.length !== 8 && picker && picker.value) {
            const [yyyy, mm, dd] = picker.value.split("-");
            dateCode = `${dd}${mm}${yyyy}`;
        }
        if (!dateCode || dateCode.length !== 8) {
            const targetDate = new Date();
            if (targetDate.getDay() === 5) {
                targetDate.setDate(targetDate.getDate() + 3);
            } else if (targetDate.getDay() === 6) {
                targetDate.setDate(targetDate.getDate() + 2);
            } else {
                targetDate.setDate(targetDate.getDate() + 1);
            }
            const yyyy = targetDate.getFullYear();
            const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
            const dd = String(targetDate.getDate()).padStart(2, '0');
            dateCode = `${dd}${mm}${yyyy}`;
        }

        this.generatorDate = dateCode;
        this.targetFileName = `DO Summary List ${dateCode}.xlsx`;

        // Read Wave
        const waveInput = document.getElementById("importModalWaveInput");
        const waveNumber = (waveInput?.value || "").trim() || "01";

        // Read Duplicate Action
        let recsToImport = parsedRecords;
        if (duplicateRecords.length > 0) {
            const dupeAction = document.querySelector('input[name="importDupeAction"]:checked')?.value || "NEW_ONLY";
            if (dupeAction === "NEW_ONLY") {
                recsToImport = newRecords;
            }
        }

        if (recsToImport.length === 0) {
            this.showToast("No new DO records to import (all detected as duplicates).", "warning");
            this.cancelImportModal();
            return;
        }

        // Tag wave number on imported records
        recsToImport.forEach(r => {
            r.fileWaveNumber = waveNumber;
        });

        // Destination choice
        const isAppend = this.batches.length > 0 && document.getElementById("importDestAppend")?.checked;

        if (isAppend) {
            const appendSelect = document.getElementById("importModalAppendSelect");
            const targetIdx = parseInt(appendSelect?.value || "0", 10);
            if (!isNaN(targetIdx) && this.batches[targetIdx]) {
                const targetBatch = this.batches[targetIdx];
                const existingWaves = (targetBatch.waveNumber || "01").split(",").map(w => w.trim()).filter(Boolean);
                if (!existingWaves.includes(waveNumber)) {
                    existingWaves.push(waveNumber);
                    targetBatch.waveNumber = existingWaves.join(", ");
                }
                targetBatch.records.push(...recsToImport);
                this.currentBatchIndex = targetIdx;
                this.saveToStorage();
                this.renderUI();
                this.showToast(`Appended ${recsToImport.length} DO(s) (Wave ${waveNumber}) to ${targetBatch.batchName}!`, "success");
            }
        } else {
            const nextBatchNum = this.batches.length + 1;
            const batchName = `Batch ${String(nextBatchNum).padStart(2, '0')}`;
            this.batches.push({
                batchName: batchName,
                waveNumber: waveNumber,
                records: recsToImport
            });
            this.currentBatchIndex = this.batches.length - 1;
            this.saveToStorage();
            this.renderUI();
            this.showToast(`Created ${batchName} with ${recsToImport.length} DO records (Wave ${waveNumber})!`, "success");
        }

        const modal = document.getElementById("importBatchModal");
        if (modal) modal.style.display = "none";

        const resolver = this.pendingImportResolver;
        this.pendingImportResolver = null;
        this.pendingImportPayload = null;
        if (resolver) resolver({ success: true });
    }

    cancelImportModal() {
        const modal = document.getElementById("importBatchModal");
        if (modal) modal.style.display = "none";

        const resolver = this.pendingImportResolver;
        this.pendingImportResolver = null;
        this.pendingImportPayload = null;
        if (resolver) resolver({ cancelled: true });
    }

    // Main entry point for uploading SONY DO Summary List CSV/Excel source files
    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            await this.processSourceFile(file);
        }

        event.target.value = ""; // Reset file picker
    }

    async processSourceFile(file) {
        const fileName = file.name;

        // Validation check for source filename
        if (!fileName.toUpperCase().includes("SONY - DO SUMMARY LIST") && !fileName.toUpperCase().includes("SUMMARY")) {
            const proceed = await this.showConfirmDialog({
                title: "File Naming Warning",
                message: `Selected file "${fileName}" does not match standard convention ("SONY - DO Summary List").\n\nDo you want to process it anyway?`,
                confirmText: "Process File",
                isDanger: false,
                icon: "📄"
            });
            if (!proceed) return;
        }

        const dataBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(dataBuffer, { type: 'array' });

        // Target Sheet: Take the first sheet directly (Matches VBA: Set wsSource = wbSource.Sheets(1))
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

        if (!rawRows || rawRows.length < 2) {
            this.showToast(`File "${fileName}" has no data rows!`, "error");
            return;
        }

        // Header Map - Includes SONY CSV Aliases (SEQ, SHIP_TO, ZONE, CONSIGNEE_NAME1, TOTAL_ITEM)
        const headerRow = rawRows[0].map(h => String(h || "").trim().toUpperCase());
        
        const colMap = {
            invoiceNo: this.findColIdx(headerRow, ["INVOICE NO.", "INVOICE", "INVOICE_NO", "DO NO", "DO_NUMBER", "SEQ"]),
            division:  this.findColIdx(headerRow, ["DIVISION", "DIV"]),
            shpCode:   this.findColIdx(headerRow, ["SHP_CODE", "SHP CODE", "SHIP CODE", "SHIP_TO", "SHIP TO"]),
            route:     this.findColIdx(headerRow, ["ROUTE", "ZONE"]),
            consignee: this.findColIdx(headerRow, ["CONSIGNEE_NAME", "CONSIGNEE", "CUSTOMER", "CONSIGNEE_NAME1", "CONSIGNEE NAME1", "CONSIGNEE NAME"]),
            addr1:     this.findColIdx(headerRow, ["ADDRESS1", "ADDRESS 1", "ADDR1"]),
            addr2:     this.findColIdx(headerRow, ["ADDRESS2", "ADDRESS 2", "ADDR2"]),
            addr3:     this.findColIdx(headerRow, ["ADDRESS3", "ADDRESS 3", "ADDR3"]),
            volume:    this.findColIdx(headerRow, ["VOLUME", "M3", "VOLUME (M3)"]),
            qty:       this.findColIdx(headerRow, ["QTY", "QUANTITY"]),
            sku:       this.findColIdx(headerRow, ["TOTAL SKU", "SKU", "SKU COUNT", "TOTAL_ITEM", "TOTAL ITEM"]),
            remark:    this.findColIdx(headerRow, ["REMARK", "REMARKS"])
        };

        const parsedRecords = [];
        let missingRouteCount = 0;
        let missingVolumeCount = 0;

        for (let i = 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            const invoiceNo = String(row[colMap.invoiceNo !== -1 ? colMap.invoiceNo : 0] || "").trim();
            if (!invoiceNo) continue;

            const routeVal = String(row[colMap.route !== -1 ? colMap.route : 3] || "").trim();
            const rawVolStr = String(row[colMap.volume !== -1 ? colMap.volume : 8] ?? "").trim();
            const cleanedVolStr = rawVolStr.toLowerCase().replace(/m3|m³/g, "").trim();
            const volVal = parseFloat(cleanedVolStr) || 0;
            
            const qtyVal = parseInt(row[colMap.qty !== -1 ? colMap.qty : 9]) || 0;
            const skuVal = parseInt(row[colMap.sku !== -1 ? colMap.sku : 10]) || 1;

            const missingRoute = !routeVal || routeVal === "-" || routeVal.toUpperCase() === "MISSING";
            const missingVolume = volVal <= 0 || cleanedVolStr === "" || cleanedVolStr === "-" || cleanedVolStr === "0";

            if (missingRoute) missingRouteCount++;
            if (missingVolume) missingVolumeCount++;

            parsedRecords.push({
                invoiceNo: invoiceNo,
                division: String(row[colMap.division !== -1 ? colMap.division : 1] || "").trim(),
                shpCode: String(row[colMap.shpCode !== -1 ? colMap.shpCode : 2] || "").trim(),
                route: routeVal,
                consignee: String(row[colMap.consignee !== -1 ? colMap.consignee : 4] || "").trim(),
                addr1: String(row[colMap.addr1 !== -1 ? colMap.addr1 : 5] || "").trim(),
                addr2: String(row[colMap.addr2 !== -1 ? colMap.addr2 : 6] || "").trim(),
                addr3: String(row[colMap.addr3 !== -1 ? colMap.addr3 : 7] || "").trim(),
                volume: volVal,
                qty: qtyVal,
                sku: skuVal,
                remark: "", // Ignore CSV summary text; leave blank for manual entry
                missingRoute: missingRoute,
                missingVolume: missingVolume,
                selected: true
            });
        }

        if (parsedRecords.length === 0) {
            this.showToast(`No valid DO records found in "${fileName}"!`, "warning");
            return;
        }

        // DUPLICATE CHECK ACROSS ALL ACTIVE BATCHES
        const existingMap = {};
        this.batches.forEach(b => {
                if (b.batchName === "FINAL SUMMARY") return;
            b.records.forEach(r => {
                existingMap[r.invoiceNo] = b.batchName;
            });
        });

        const newRecords = [];
        const duplicateRecords = [];

        parsedRecords.forEach(rec => {
            if (existingMap[rec.invoiceNo]) {
                duplicateRecords.push({ record: rec, foundIn: existingMap[rec.invoiceNo] });
            } else {
                newRecords.push(rec);
            }
        });

        // Open in-app Interactive Batch Setup Modal
        await this.openImportBatchModal(file, parsedRecords, missingRouteCount, missingVolumeCount, newRecords, duplicateRecords);
    }

    // Secondary file handler to bulk-update missing Route or Volume (m3) across existing batches
    async handleUpdateFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        if (this.batches.length === 0) {
            this.showToast("No batches loaded to update! Please import your main SONY DO Summary List first.", "warning");
            event.target.value = "";
            return;
        }

        let updatedCount = 0;
        let routeUpdatedCount = 0;
        let volUpdatedCount = 0;

        for (const file of files) {
            const dataBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(dataBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

            if (!rawRows || rawRows.length < 2) continue;

            const headerRow = rawRows[0].map(h => String(h || "").trim().toUpperCase());
            const colMap = {
                invoiceNo: this.findColIdx(headerRow, ["INVOICE NO.", "INVOICE", "INVOICE_NO", "DO NO", "DO_NUMBER", "SEQ"]),
                route:     this.findColIdx(headerRow, ["ROUTE", "ZONE"]),
                volume:    this.findColIdx(headerRow, ["VOLUME", "M3", "VOLUME (M3)"])
            };

            const invoiceIdx = colMap.invoiceNo !== -1 ? colMap.invoiceNo : 0;
            const routeIdx = colMap.route !== -1 ? colMap.route : 3;
            const volIdx = colMap.volume !== -1 ? colMap.volume : 8;

            for (let i = 1; i < rawRows.length; i++) {
                const row = rawRows[i];
                if (!row || row.length === 0) continue;

                const invoiceNo = String(row[invoiceIdx] || "").trim();
                if (!invoiceNo) continue;

                const rawRoute = String(row[routeIdx] || "").trim();
                const rawVolStr = String(row[volIdx] ?? "").trim();
                const cleanedVolStr = rawVolStr.toLowerCase().replace(/m3|m³/g, "").trim();
                const volVal = parseFloat(cleanedVolStr) || 0;

                // Match against all existing batches in memory
                this.batches.forEach(b => {
                if (b.batchName === "FINAL SUMMARY") return;
                    b.records.forEach(r => {
                        if (r.invoiceNo === invoiceNo) {
                            let isUpdated = false;

                            // Update Route if valid
                            if (rawRoute && rawRoute !== "-" && rawRoute.toUpperCase() !== "MISSING") {
                                if (r.route !== rawRoute || r.missingRoute) {
                                    r.route = rawRoute.toUpperCase();
                                    r.missingRoute = false;
                                    routeUpdatedCount++;
                                    isUpdated = true;
                                }
                            }

                            // Update Volume if > 0
                            if (volVal > 0) {
                                if (r.volume !== volVal || r.missingVolume) {
                                    r.volume = volVal;
                                    r.missingVolume = false;
                                    volUpdatedCount++;
                                    isUpdated = true;
                                }
                            }

                            if (isUpdated) updatedCount++;
                        }
                    });
                });
            }
        }

        event.target.value = ""; // Reset file picker

        if (updatedCount > 0) {
            this.saveToStorage();
            this.renderUI();
            this.showToast(`Updated missing info for ${updatedCount} DO record(s) (${routeUpdatedCount} Routes, ${volUpdatedCount} Volumes).`, "success");
        } else {
            this.showToast("No matching DO records were updated. Ensure INVOICE No. matches loaded batches.", "info");
        }
    }

    findColIdx(headers, candidates) {
        for (const candidate of candidates) {
            const idx = headers.indexOf(candidate);
            if (idx !== -1) return idx;
        }
        return -1;
    }

    // Compile Final Summary List by merging all batches
    async compileFinalSummary() {
        const sourceBatches = this.batches.filter(b => b.batchName !== "FINAL SUMMARY");

        if (sourceBatches.length === 0) {
            this.showToast("No batches available to compile. Please upload a source file first!", "warning");
            return;
        }

        this.hasCompiledFinalSummary = true;

        const allRecords = [];
        sourceBatches.forEach(b => {
            b.records.filter(r => r.selected !== false).forEach(r => {
                allRecords.push({ ...r, batchOrigin: b.batchName, waveNumber: b.waveNumber });
            });
        });

        // Add or update FINAL SUMMARY batch
        const finalBatchIndex = this.batches.findIndex(b => b.batchName === "FINAL SUMMARY");
        const finalBatchObj = {
            batchName: "FINAL SUMMARY",
            waveNumber: "ALL",
            records: allRecords
        };

        if (finalBatchIndex >= 0) {
            this.batches[finalBatchIndex] = finalBatchObj;
            this.currentBatchIndex = finalBatchIndex;
        } else {
            this.batches.push(finalBatchObj);
            this.currentBatchIndex = this.batches.length - 1;
        }

        this.showToast(`Compiled Final Summary containing ${allRecords.length} total DOs across ${sourceBatches.length} batch(es)!`, "success");
        this.saveToStorage();
        this.renderUI();
        await this.exportToExcel();
        this.syncToActivityTrend(allRecords);
    }

    // Auto-sync the compiled Final Summary totals into the DO Activity Trend history
    syncToActivityTrend(allRecords) {
        try {
            if (!allRecords || allRecords.length === 0) return;

            let dateStr = "";
            const nameMatch = (this.targetFileName || "").match(/(\d{2})(\d{2})(\d{4})/);
            if (nameMatch) {
                dateStr = `${nameMatch[3]}-${nameMatch[2]}-${nameMatch[1]}`;
            } else {
                const savedDate = (this.generatorDate || "").trim().match(/(\d{2})(\d{2})(\d{4})/);
                if (savedDate) {
                    dateStr = `${savedDate[3]}-${savedDate[2]}-${savedDate[1]}`;
                } else {
                    const targetDate = new Date();
                    if (targetDate.getDay() === 5) {
                        targetDate.setDate(targetDate.getDate() + 3);
                    } else if (targetDate.getDay() === 6) {
                        targetDate.setDate(targetDate.getDate() + 2);
                    } else {
                        targetDate.setDate(targetDate.getDate() + 1);
                    }
                    const yyyy = targetDate.getFullYear();
                    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(targetDate.getDate()).padStart(2, '0');
                    dateStr = `${yyyy}-${mm}-${dd}`;
                }
            }
            if (!dateStr) return;

            let doCount = 0, skuTotal = 0, volTotal = 0, qtyTotal = 0;
            let lclDo = 0, lclSku = 0, lclVol = 0, lclQty = 0;

            allRecords.forEach(r => {
                doCount++;
                skuTotal += r.sku || 0;
                volTotal += r.volume || 0;
                qtyTotal += r.qty || 0;
                if ((r.remark || "").toUpperCase().includes("LCL")) {
                    lclDo++;
                    lclSku += r.sku || 0;
                    lclVol += r.volume || 0;
                    lclQty += r.qty || 0;
                }
            });

            let history = [];
            try {
                history = JSON.parse(localStorage.getItem("DO_Activity_Trend_History")) || [];
            } catch (e) {
                history = [];
            }
            if (!Array.isArray(history)) history = [];

            const entry = {
                date: dateStr,
                do: doCount,
                sku: skuTotal,
                vol: volTotal,
                qty: qtyTotal,
                lclDo, lclSku, lclVol, lclQty
            };

            const existingIdx = history.findIndex(h => h.date === dateStr);
            if (existingIdx !== -1) {
                history[existingIdx] = entry;
            } else {
                history.push(entry);
            }
            history.sort((a, b) => a.date.localeCompare(b.date));

            localStorage.setItem("DO_Activity_Trend_History", JSON.stringify(history));
            this.showToast(`DO Activity Trend updated for ${dateStr} (${doCount} DOs, ${skuTotal} SKUs, ${volTotal.toFixed(2)} m³).`, "info");
        } catch (err) {
            console.error("Activity Trend sync failed:", err);
        }
    }

    // Export complete Multi-Sheet Workbook
    async exportToExcel() {
        if (this.batches.length === 0) {
            this.showToast("No batch data to export! Please upload source files first.", "warning");
            return;
        }

        const workbook = XLSX.utils.book_new();

        const styleHeader = {
            font: { name: "Aptos Narrow", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "E31B23" } },
            alignment: { horizontal: "center", vertical: "center" }
        };

        const styleBatchSummaryHeader = {
            font: { name: "Aptos Narrow", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "E31B23" } },
            alignment: { horizontal: "center", vertical: "center" }
        };

        const styleBoldData = { font: { name: "Aptos Narrow", sz: 11, bold: true } };
        const styleNormalData = { font: { name: "Aptos Narrow", sz: 11, bold: false } };

        const styleRemarkHighlight = {
            font: { name: "Aptos Narrow", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "E31B23" } },
            alignment: { horizontal: "left", vertical: "center" }
        };

        // 1. Add individual Batch sheets
        this.batches.forEach((b, batchIdx) => {
            if (b.batchName === "FINAL SUMMARY") return; 
            const sheetData = [];
            const activeRecords = b.records.filter(r => r.selected !== false);
            
            const totalVol = activeRecords.reduce((sum, r) => sum + r.volume, 0);
            const totalQty = activeRecords.reduce((sum, r) => sum + r.qty, 0);
            const totalSku = activeRecords.reduce((sum, r) => sum + r.sku, 0);

            sheetData.push([
                `${activeRecords.length} DO`, "", "", "", `${b.batchName.toUpperCase()} SUMMARY`, "", "", "",
                parseFloat(totalVol.toFixed(3)), totalQty, totalSku, `Wave : ${b.waveNumber}`
            ]);

            sheetData.push([
                "INVOICE No.", "DIVISION", "SHP_CODE", "ROUTE",
                "CONSIGNEE_NAME", "ADDRESS1", "ADDRESS2", "ADDRESS3",
                "VOLUME", "QTY", "TOTAL SKU", "REMARK"
            ]);

            activeRecords.forEach(r => {
                sheetData.push([
                    r.invoiceNo, r.division, r.shpCode, r.route,
                    r.consignee, r.addr1, r.addr2, r.addr3,
                    r.volume, r.qty, r.sku, r.remark
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            const lastR = activeRecords.length + 2;

            ws['A1'] = { f: `SUBTOTAL(103,A3:A${lastR})`, z: '0 "DO"' };
            ws['E1'] = { v: `${b.batchName.toUpperCase()} SUMMARY` };
            ws['I1'] = { f: `SUBTOTAL(109,I3:I${lastR})`, z: '0.00000 "M3"' };
            ws['J1'] = { f: `SUBTOTAL(109,J3:J${lastR})`, z: '0 "QTY"' };
            ws['K1'] = { f: `SUBTOTAL(109,K3:K${lastR})`, z: '0 "SKU"' };
            ws['L1'] = { v: `Wave : ${b.waveNumber}` };

            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(col => {
                const cellRef1 = `${col}1`;
                if (!ws[cellRef1]) ws[cellRef1] = { v: "" };
                ws[cellRef1].s = styleBatchSummaryHeader;

                const cellRef2 = `${col}2`;
                if (ws[cellRef2]) ws[cellRef2].s = styleHeader;
            });

            activeRecords.forEach((rec, rIdx) => {
                const rowNum = rIdx + 3;
                ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(col => {
                    const cellRef = `${col}${rowNum}`;
                    if (ws[cellRef]) {
                        if (col === 'A') {
                            ws[cellRef].s = styleBoldData;
                        } else if (col === 'D' && (rec.missingRoute || !rec.route || rec.route.trim() === "" || rec.route === "-" || rec.route.toUpperCase() === "MISSING")) {
                            ws[cellRef].s = styleRemarkHighlight;
                        } else if (col === 'I' && (rec.missingVolume || rec.volume <= 0)) {
                            ws[cellRef].s = styleRemarkHighlight;
                        } else if (col === 'L' && rec.remark && rec.remark.trim() !== "" && rec.remark !== "-") {
                            ws[cellRef].s = styleRemarkHighlight;
                        } else {
                            ws[cellRef].s = styleNormalData;
                        }
                    }
                });
            });

            let maxRemarkLen = 12;
            activeRecords.forEach(r => {
                if (r.remark) {
                    const len = String(r.remark).trim().length;
                    if (len > maxRemarkLen) maxRemarkLen = len;
                }
            });
            if (b.waveNumber) {
                const waveLen = `Wave : ${b.waveNumber}`.length;
                if (waveLen > maxRemarkLen) maxRemarkLen = waveLen;
            }
            const remarkColWidth = Math.max(16.0, Math.min(80.0, maxRemarkLen + 4));

            ws['!cols'] = [
                { wch: 16.22 },                 // A: INVOICE No.
                { wch: 5.66 },                  // B: DIVISION
                { wch: 14.55 },                 // C: SHP_CODE
                { wch: 6.44 },                  // D: ROUTE
                { wch: 30.78 },                 // E: CONSIGNEE_NAME
                { wch: 30.78 },                 // F: ADDRESS1
                { wch: 30.78, hidden: true },   // G: ADDRESS2
                { wch: 22.44, hidden: true },   // H: ADDRESS3
                { wch: 12.44 },                 // I: VOLUME
                { wch: 11.33 },                 // J: QTY
                { wch: 10.33 },                 // K: TOTAL SKU
                { wch: Number(remarkColWidth.toFixed(2)) } // L: REMARK
            ];

            ws['!autofilter'] = { ref: `A2:L${lastR}` };
            ws['!freeze'] = { xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft', state: 'frozen' };
            ws['!tabColor'] = { rgb: "E31B23" };
            ws['!properties'] = { tabColor: { rgb: "E31B23" } };

            XLSX.utils.book_append_sheet(workbook, ws, b.batchName);
        });

        // 2. Add Final Summary List Sheet if compiled
        if (this.hasCompiledFinalSummary) {
            const allFinalRecords = [];
            const waveDict = {};
            let challengerDOCount = 0;

            this.batches.forEach(b => {
                if (b.batchName === "FINAL SUMMARY") return;
                const batchCleanName = b.batchName.replace("Batch ", "");
                const waveCleanNum = b.waveNumber || "-";

                if (waveDict[waveCleanNum]) {
                    waveDict[waveCleanNum] += `,${batchCleanName}`;
                } else {
                    waveDict[waveCleanNum] = batchCleanName;
                }

                b.records.filter(r => r.selected !== false).forEach(r => {
                    allFinalRecords.push({ ...r, batchOrigin: b.batchName, waveNumber: b.waveNumber });
                    if (r.consignee && r.consignee.toUpperCase().includes("CHALLENGER")) {
                        challengerDOCount++;
                    }
                });
            });
            const finalData = [];

            finalData.push([
                "", "", "", "", "FINAL SUMMARY LIST", "", "", "",
                0, 0, 0, "ALL WAVES"
            ]);

            finalData.push([
                "INVOICE No.", "DIVISION", "SHP_CODE", "ROUTE",
                "CONSIGNEE_NAME", "ADDRESS1", "ADDRESS2", "ADDRESS3",
                "VOLUME", "QTY", "TOTAL SKU", "REMARK"
            ]);

            allFinalRecords.forEach(r => {
                finalData.push([
                    r.invoiceNo, r.division, r.shpCode, r.route,
                    r.consignee, r.addr1, r.addr2, r.addr3,
                    r.volume, r.qty, r.sku, r.remark
                ]);
            });

            const wsFinal = XLSX.utils.aoa_to_sheet(finalData);
            const finalLastR = allFinalRecords.length + 2;

            wsFinal['A1'] = { f: `SUBTOTAL(103,A3:A${finalLastR})`, z: '0 "DO"' };
            wsFinal['E1'] = { v: "FINAL SUMMARY LIST" };
            wsFinal['I1'] = { f: `SUBTOTAL(109,I3:I${finalLastR})`, z: '0.00000 "M3"' };
            wsFinal['J1'] = { f: `SUBTOTAL(109,J3:J${finalLastR})`, z: '0 "QTY"' };
            wsFinal['K1'] = { f: `SUBTOTAL(109,K3:K${finalLastR})`, z: '0 "SKU"' };
            wsFinal['L1'] = { v: "" };

            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(col => {
                const cellRef1 = `${col}1`;
                if (!wsFinal[cellRef1]) wsFinal[cellRef1] = { v: "" };
                wsFinal[cellRef1].s = styleBatchSummaryHeader;

                const cellRef2 = `${col}2`;
                if (wsFinal[cellRef2]) wsFinal[cellRef2].s = styleHeader;
            });

            allFinalRecords.forEach((rec, rIdx) => {
                const rowNum = rIdx + 3;
                ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(col => {
                    const cellRef = `${col}${rowNum}`;
                    if (wsFinal[cellRef]) {
                        if (col === 'A') {
                            wsFinal[cellRef].s = styleBoldData;
                        } else if (col === 'D' && (rec.missingRoute || !rec.route || rec.route.trim() === "" || rec.route === "-" || rec.route.toUpperCase() === "MISSING")) {
                            wsFinal[cellRef].s = styleRemarkHighlight;
                        } else if (col === 'I' && (rec.missingVolume || rec.volume <= 0)) {
                            wsFinal[cellRef].s = styleRemarkHighlight;
                        } else if (col === 'L' && rec.remark && rec.remark.trim() !== "" && rec.remark !== "-") {
                            wsFinal[cellRef].s = styleRemarkHighlight;
                        } else {
                            wsFinal[cellRef].s = styleNormalData;
                        }
                    }
                });
            });

            wsFinal['N3'] = { v: "WAVE NUMBER", s: {
                font: { name: "Aptos Narrow", sz: 13, bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "E31B23" } },
                alignment: { horizontal: "center", vertical: "center" }
            }};

            let dashRow = 4;
            Object.keys(waveDict).forEach(wave => {
                const cellRef = `N${dashRow}`;
                wsFinal[cellRef] = {
                    v: `  • Wave ${wave}  -->  Batch ${waveDict[wave]}`,
                    s: {
                        font: { name: "Aptos Narrow", sz: 11, bold: true, color: { rgb: "000000" } },
                        fill: { fgColor: { rgb: "FFEBEE" } },
                        alignment: { horizontal: "left", vertical: "center" }
                    }
                };
                dashRow++;
            });

            const challengerCellRef = `N${dashRow + 1}`;
            wsFinal[challengerCellRef] = {
                v: `CHALLENGER DO : ${challengerDOCount}`,
                s: {
                    font: { name: "Aptos Narrow", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "E31B23" } },
                    alignment: { horizontal: "center", vertical: "center" }
                }
            };

            let maxFinalRemarkLen = 12;
            allFinalRecords.forEach(r => {
                if (r.remark) {
                    const len = String(r.remark).trim().length;
                    if (len > maxFinalRemarkLen) maxFinalRemarkLen = len;
                }
            });
            const finalRemarkColWidth = Math.max(16.0, Math.min(80.0, maxFinalRemarkLen + 4));

            wsFinal['!cols'] = [
                { wch: 16.22 }, { wch: 5.66 }, { wch: 14.55 }, { wch: 6.44 },
                { wch: 30.78 }, { wch: 30.78 }, { wch: 30.78, hidden: true }, { wch: 22.44, hidden: true },
                { wch: 12.44 }, { wch: 11.33 }, { wch: 10.33 }, { wch: Number(finalRemarkColWidth.toFixed(2)) },
                { wch: 4.00 }, { wch: 32.00 }
            ];

            const maxRow = Math.max(finalLastR, dashRow + 1);
            wsFinal['!ref'] = `A1:N${maxRow}`;
            wsFinal['!autofilter'] = { ref: `A2:L${finalLastR}` };
            wsFinal['!freeze'] = { xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft', state: 'frozen' };
            wsFinal['!tabColor'] = { rgb: "E31B23" };
            wsFinal['!properties'] = { tabColor: { rgb: "E31B23" } };

            XLSX.utils.book_append_sheet(workbook, wsFinal, "Final Summary List");
        }

        let exportFileName = this.targetFileName || "";
        if (!exportFileName) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dd = String(tomorrow.getDate()).padStart(2, '0');
            const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
            const yyyy = tomorrow.getFullYear();
            exportFileName = `DO Summary List ${dd}${mm}${yyyy}.xlsx`;
        }
        if (!exportFileName.toLowerCase().endsWith(".xlsx")) {
            exportFileName += ".xlsx";
        }

        try {
            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = exportFileName;
            
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 500);
        } catch (err) {
            console.error("Blob export failed:", err);
            this.showToast("Could not save the file. Check browser permissions.", "error");
        }
    }

    // Export Full Batch Data Session to JSON (.json)
    exportToJSON() {
        if (!this.batches || this.batches.length === 0) {
            this.showToast("No batch data to export! Please upload source files or prepare batches first.", "warning");
            return;
        }

        const totalDO = this.batches.reduce((sum, b) => sum + (b.records ? b.records.length : 0), 0);
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

        const payload = {
            app: "DO_Status_Hub",
            version: "1.0",
            type: "do_summary_batches_data",
            exportedAt: new Date().toISOString(),
            targetFileName: this.targetFileName || "",
            generatorDate: this.generatorDate || "",
            hasCompiledFinalSummary: this.hasCompiledFinalSummary || false,
            batchesCount: this.batches.length,
            totalDO: totalDO,
            presetRemarks: this.presetRemarks || [],
            batches: this.batches
        };

        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const fileDate = (this.generatorDate || "").trim() || dateStr;
        a.href = url;
        a.download = `DO_Summary_Batches_${fileDate}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast("Exported generator session to JSON successfully.", "success");
    }

    // Import Full Batch Data Session from JSON (.json)
    importFromJSON(event) {
        const file = event.target && event.target.files ? event.target.files[0] : null;
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const rawText = (e.target.result || "").replace(/^\uFEFF/, "").trim();
                if (!rawText) {
                    this.showToast("The selected JSON file is empty.", "error");
                    return;
                }

                const content = JSON.parse(rawText);
                let importedBatches = [];

                if (Array.isArray(content)) {
                    importedBatches = content;
                } else if (content && Array.isArray(content.batches)) {
                    importedBatches = content.batches;
                } else {
                    this.showToast("Invalid JSON structure. Must contain a batches array or 'batches' property.", "error");
                    return;
                }

                if (importedBatches.length === 0) {
                    this.showToast("No batches found in the selected JSON file.", "warning");
                    return;
                }

                // Sanitize and validate imported batches
                const cleanBatches = [];
                let totalImportedDO = 0;

                importedBatches.forEach((b, bIdx) => {
                    if (!b) return;
                    const batchName = b.batchName || `Batch ${String(bIdx + 1).padStart(2, '0')}`;
                    const waveNumber = b.waveNumber || "01";
                    const records = [];

                    if (Array.isArray(b.records)) {
                        b.records.forEach(r => {
                            if (!r) return;
                            const invoiceNo = String(r.invoiceNo || "").trim();
                            if (!invoiceNo) return;

                            const routeVal = String(r.route || "").trim();
                            const volVal = parseFloat(r.volume) || 0;
                            const qtyVal = parseInt(r.qty) || 0;
                            const skuVal = parseInt(r.sku) || 1;
                            const missingRoute = r.missingRoute !== undefined 
                                ? !!r.missingRoute 
                                : (!routeVal || routeVal === "-" || routeVal.toUpperCase() === "MISSING");
                            const missingVolume = r.missingVolume !== undefined
                                ? !!r.missingVolume
                                : (volVal <= 0);

                            records.push({
                                invoiceNo: invoiceNo,
                                division: String(r.division || "").trim(),
                                shpCode: String(r.shpCode || "").trim(),
                                route: routeVal,
                                consignee: String(r.consignee || "").trim(),
                                addr1: String(r.addr1 || "").trim(),
                                addr2: String(r.addr2 || "").trim(),
                                addr3: String(r.addr3 || "").trim(),
                                volume: volVal,
                                qty: qtyVal,
                                sku: skuVal,
                                remark: String(r.remark || "").trim(),
                                missingRoute: missingRoute,
                                missingVolume: missingVolume,
                                selected: r.selected !== undefined ? !!r.selected : true,
                                fileWaveNumber: r.fileWaveNumber || waveNumber
                            });
                        });
                    }

                    totalImportedDO += records.length;
                    cleanBatches.push({
                        batchName: batchName,
                        waveNumber: waveNumber,
                        records: records
                    });
                });

                if (cleanBatches.length === 0 || totalImportedDO === 0) {
                    this.showToast("No valid DO records found in the JSON file.", "warning");
                    return;
                }

                // If existing batches are present, prompt user for action
                if (this.batches && this.batches.length > 0) {
                    const choice = await this.showConfirmDialog({
                        title: "Import JSON Session",
                        message: `Existing session contains ${this.batches.length} batch(es).\n\nDo you want to REPLACE your current session (Confirm) or keep current session (Cancel)?`,
                        confirmText: "Replace All",
                        cancelText: "Cancel",
                        isDanger: true,
                        icon: "📥"
                    });

                    if (!choice) {
                        this.showToast("JSON import cancelled.", "info");
                        return;
                    }
                }

                // Load batches
                this.batches = cleanBatches;
                if (content.targetFileName) this.targetFileName = content.targetFileName;
                if (content.generatorDate) this.generatorDate = content.generatorDate;
                if (content.hasCompiledFinalSummary !== undefined) {
                    this.hasCompiledFinalSummary = !!content.hasCompiledFinalSummary;
                }

                // Restore custom preset remarks if available
                if (content && Array.isArray(content.presetRemarks) && content.presetRemarks.length > 0) {
                    this.presetRemarks = content.presetRemarks;
                }

                this.currentBatchIndex = 0;
                this.saveToStorage();
                this.renderUI();

                this.showToast(`Imported ${cleanBatches.length} batch(es) with ${totalImportedDO} DO record(s)!`, "success");
            } catch (err) {
                console.error("JSON import error:", err);
                this.showToast(`Failed to parse JSON: ${err.message}`, "error");
            } finally {
                if (event.target) event.target.value = ""; // Reset picker
            }
        };
        reader.readAsText(file);
    }

    renderUI() {
        this.renderMetadataBar();
        this.renderKPIs();
        this.renderPresetChips();
        this.renderBatchTabs();
        this.renderEmailTargets();
        this.renderTable();
    }

    renderMetadataBar() {
        const picker = document.getElementById("headerDatePicker");
        const formatted = document.getElementById("headerDateFormatted");
        const waveInput = document.getElementById("headerWaveInput");
        const targetBadge = document.getElementById("headerTargetFileName");
        const activeBatchBadge = document.getElementById("headerActiveBatch");

        let dateCode = this.generatorDate;
        if (!dateCode || dateCode.length !== 8) {
            const targetDate = new Date();
            if (targetDate.getDay() === 5) {
                targetDate.setDate(targetDate.getDate() + 3);
            } else if (targetDate.getDay() === 6) {
                targetDate.setDate(targetDate.getDate() + 2);
            } else {
                targetDate.setDate(targetDate.getDate() + 1);
            }
            const yyyy = targetDate.getFullYear();
            const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
            const dd = String(targetDate.getDate()).padStart(2, '0');
            dateCode = `${dd}${mm}${yyyy}`;
            this.generatorDate = dateCode;
            this.targetFileName = `DO Summary List ${dateCode}.xlsx`;
        }

        if (dateCode && dateCode.length === 8) {
            const dd = dateCode.substring(0, 2);
            const mm = dateCode.substring(2, 4);
            const yyyy = dateCode.substring(4, 8);
            if (picker) picker.value = `${yyyy}-${mm}-${dd}`;
            if (formatted) formatted.innerText = `${dd}/${mm}/${yyyy}`;
        }

        if (targetBadge) {
            targetBadge.innerText = this.targetFileName || `DO Summary List ${dateCode}.xlsx`;
        }

        const activeBatch = this.batches[this.currentBatchIndex];
        if (activeBatch) {
            if (waveInput) {
                waveInput.disabled = false;
                waveInput.value = activeBatch.waveNumber || "01";
            }
            if (activeBatchBadge) {
                activeBatchBadge.innerText = `${activeBatch.batchName} (${activeBatch.records.length} DOs)`;
            }
        } else {
            if (waveInput) {
                waveInput.disabled = true;
                waveInput.value = "-";
            }
            if (activeBatchBadge) {
                activeBatchBadge.innerText = "No batch active";
            }
        }
    }

    filterPresets(query, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const q = query.toLowerCase().trim();
        const buttons = container.querySelectorAll('button.preset-chip');
        buttons.forEach(btn => {
            if (btn.innerText.toLowerCase().includes(q)) {
                btn.style.display = '';
            } else {
                btn.style.display = 'none';
            }
        });
    }

    renderPresetChips() {
        const quickContainer = document.getElementById("quickPresetChipsContainer");
        const filteredContainer = document.getElementById("filteredPresetChipsContainer");

        let quickHtml = "";
        let filteredHtml = "";

        this.presetRemarks.sort((a, b) => a.label.localeCompare(b.label));
        this.presetRemarks.forEach(p => {
            const escapedLabel = p.label.replace(/'/g, "\\'");
            quickHtml += `<button type="button" class="preset-chip ${p.color}" onclick="summaryGenerator.applyQuickRemark('${escapedLabel}')">${p.label}</button>`;
            filteredHtml += `<button type="button" class="preset-chip ${p.color}" onclick="summaryGenerator.applyQuickRemarkToFiltered('${escapedLabel}')" style="font-size: 10px; padding: 3px 8px;">${p.label}</button>`;
        });

        // Always append CLEAR option
        quickHtml += `<button type="button" class="preset-chip dark" onclick="summaryGenerator.applyQuickRemark('')">CLEAR REMARK</button>`;
        filteredHtml += `<button type="button" class="preset-chip dark" onclick="summaryGenerator.applyQuickRemarkToFiltered('')" style="font-size: 10px; padding: 3px 8px;">CLEAR</button>`;

        if (quickContainer) quickContainer.innerHTML = quickHtml;
        if (filteredContainer) filteredContainer.innerHTML = filteredHtml;
    }

    openPresetManagerModal() {
        const modal = document.getElementById("presetManagerModal");
        if (modal) {
            modal.style.display = "flex";
            this.renderPresetManagerList();
        }
    }

    closePresetManagerModal() {
        const modal = document.getElementById("presetManagerModal");
        if (modal) modal.style.display = "none";
    }

    renderPresetManagerList() {
        const list = document.getElementById("presetManagerList");
        if (!list) return;

        if (this.presetRemarks.length === 0) {
            list.innerHTML = `<div style="text-align: center; color: var(--fg-muted, #94a3b8); font-size: 12px; padding: 10px;">No preset remarks added yet. Add one above!</div>`;
            return;
        }

        let html = "";
        this.presetRemarks.forEach((p, index) => {
            html += `<div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--surface-card, #1e293b); border: 1px solid var(--border, #334155); border-radius: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="preset-chip ${p.color}" style="font-size: 11px; padding: 3px 10px; pointer-events: none;">${p.label}</span>
                </div>
                <button type="button" onclick="summaryGenerator.deletePresetRemark(${index})" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid #7f1d1d; border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; font-weight: 700;">
                    Delete
                </button>
            </div>`;
        });

        list.innerHTML = html;
    }

    addNewPresetRemark() {
        const labelInput = document.getElementById("newPresetLabelInput");
        const colorSelect = document.getElementById("newPresetColorSelect");

        if (!labelInput) return;
        const rawVal = labelInput.value.trim().toUpperCase();

        if (!rawVal) {
            this.showToast("Please enter a label for the preset remark.", "warning");
            return;
        }

        const colorVal = colorSelect ? colorSelect.value : "blue";

        // Avoid duplicates
        if (this.presetRemarks.some(p => p.label === rawVal)) {
            this.showToast(`Preset remark "${rawVal}" already exists!`, "info");
            return;
        }

        this.presetRemarks.push({ label: rawVal, color: colorVal });
        this.saveToStorage();

        labelInput.value = "";
        this.renderPresetChips();
        this.renderPresetManagerList();
        this.showToast(`Added preset remark "${rawVal}".`, "success");
    }

    deletePresetRemark(index) {
        if (index < 0 || index >= this.presetRemarks.length) return;
        const removed = this.presetRemarks.splice(index, 1);
        this.saveToStorage();
        this.renderPresetChips();
        this.renderPresetManagerList();
        if (removed[0]) {
            this.showToast(`Removed preset "${removed[0].label}".`, "info");
        }
    }

    
    exportPresetRemarks() {
        const dataStr = JSON.stringify(this.presetRemarks, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "do_summary_preset_remarks.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast("Preset remarks exported successfully.", "success");
    }

    importPresetRemarks() {
        const fileInput = document.getElementById("presetImportFile");
        if (fileInput) fileInput.click();
    }

    handlePresetImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rawText = (e.target.result || "").replace(/^\uFEFF/, "").trim();
                if (!rawText) {
                    this.showToast("The selected file is empty.", "error");
                    return;
                }
                const importedData = JSON.parse(rawText);
                if (Array.isArray(importedData)) {
                    // Basic validation
                    const validData = importedData.filter(item => item && typeof item.label === 'string' && typeof item.color === 'string');
                    if (validData.length > 0) {
                        this.presetRemarks = validData;
                        this.saveToStorage();
                        this.renderPresetChips();
                        this.renderPresetManagerList();
                        this.showToast(`Imported ${validData.length} preset remarks!`, "success");
                    } else {
                        this.showToast("No valid preset remarks found in file.", "error");
                    }
                } else {
                    this.showToast("Invalid JSON format. Expected an array.", "error");
                }
            } catch (err) {
                console.error("JSON parse error:", err);
                this.showToast("Failed to parse JSON file.", "error");
            } finally {
                event.target.value = ""; // Reset input
            }
        };
        reader.readAsText(file);
    }

    async resetPresetRemarks() {
        const confirmed = await this.showConfirmDialog({
            title: "Reset Preset Remarks?",
            message: "Reset all preset remarks back to HTML defaults?",
            confirmText: "Reset Presets",
            isDanger: true,
            icon: "🏷️"
        });
        if (!confirmed) return;

        this.presetRemarks = this.parseHTMLPresets() || [...this.defaultPresets];
        this.saveToStorage();
        this.renderPresetChips();
        this.renderPresetManagerList();
        this.showToast("Preset remarks reset to default.", "success");
    }

    renderEmailTargets() {
        const select = document.getElementById("emailTargetSelect");
        if (!select) return;

        let options = "";
        this.batches.forEach((b, idx) => {
            options += `<option value="batch-${idx}">${b.batchName}</option>`;
        });

        if (options === "") {
            options = `<option value="">No batch</option>`;
            select.innerHTML = options;
            return;
        }

        select.innerHTML = options;

        // Force dropdown to sync with the currently active batch tab
        const targetBatchVal = `batch-${this.currentBatchIndex}`;
        if (Array.from(select.options).some(o => o.value === targetBatchVal)) {
            select.value = targetBatchVal;
        }
    }

    onEmailTargetChange(value) {
        if (value && value.startsWith("batch-")) {
            const idx = parseInt(value.replace("batch-", ""), 10);
            if (!isNaN(idx) && this.batches[idx]) {
                this.currentBatchIndex = idx;
                this.renderUI(); // Re-render tabs, table, and metadata header
            }
        }
    }

    async generateEmail() {
        const select = document.getElementById("emailTargetSelect");
        const target = select ? select.value : "";
        if (!target) {
            this.showToast("No batch available to generate email. Please import a source file first.", "warning");
            return;
        }

        let batchLabel = "";
        let doCount = 0;
        let skuTotal = 0;
        let doQty = 0;
        let doVol = 0;

        const idx = parseInt(target.replace("batch-", ""), 10);
        const batch = this.batches[idx];
        if (!batch) {
            this.showToast("Selected batch could not be found.", "error");
            return;
        }
        batchLabel = batch.batchName;
        batch.records.filter(r => r.selected !== false).forEach(r => {
            doCount++;
            skuTotal += r.sku;
            doQty += r.qty;
            doVol += r.volume || 0;
        });

        const emailText = "Dear all,\r\n\r\n" +
            "Kindly refer to the attached file for the D/O Summary.\r\n\r\n" +
            `Here are the details for ${batchLabel}:\r\n` +
            `• Total DO: ${doCount}\r\n` +
            `• Total SKU: ${skuTotal}\r\n` +
            `• Total QTY: ${doQty}\r\n` +
            `• Total Volume: ${doVol.toFixed(3)} m³\r\n\r\n` +
            "Please check if any DO, Qty & Remarks do not tally with your data.\r\n\r\n" +
            "Thank you.";

        try {
            await navigator.clipboard.writeText(emailText);
        } catch (e) {
            const ta = document.createElement("textarea");
            ta.value = emailText;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }

        this.showToast(`Email text copied to clipboard!\nTotal DO for ${batchLabel}: ${doCount}`, "success");
    }

    renderKPIs(customRecords = null) {
        let totalBatches = this.batches.filter(b => b.batchName !== "FINAL SUMMARY").length;
        let totalDO = 0;
        let totalVol = 0;
        let totalQty = 0;
        let totalSku = 0;
        let isFiltered = false;

        if (customRecords !== null) {
            isFiltered = true;
            const recs = customRecords.filter(r => r.selected !== false);
            totalDO = recs.length;
            recs.forEach(r => {
                totalVol += (r.volume || 0);
                totalQty += (r.qty || 0);
                totalSku += (r.sku || 0);
            });
        } else if (this.searchQuery && this.batches[this.currentBatchIndex]) {
            isFiltered = true;
            const activeBatch = this.batches[this.currentBatchIndex];
            const recs = activeBatch.records.filter(r => {
                const searchStr = `${r.invoiceNo} ${r.division} ${r.shpCode} ${r.route} ${r.consignee} ${r.addr1} ${r.addr2} ${r.addr3} ${r.remark}`.toLowerCase();
                return searchStr.includes(this.searchQuery) && r.selected !== false;
            });
            totalDO = recs.length;
            recs.forEach(r => {
                totalVol += (r.volume || 0);
                totalQty += (r.qty || 0);
                totalSku += (r.sku || 0);
            });
        } else {
            this.batches.forEach(b => {
                if (b.batchName === "FINAL SUMMARY") return;
                const activeRecs = b.records.filter(r => r.selected !== false);
                totalDO += activeRecs.length;
                activeRecs.forEach(r => {
                    totalVol += (r.volume || 0);
                    totalQty += (r.qty || 0);
                    totalSku += (r.sku || 0);
                });
            });
        }

        const elBatches = document.getElementById("gen-kpi-batches");
        const elDO = document.getElementById("gen-kpi-do");
        const elVol = document.getElementById("gen-kpi-vol");
        const elQty = document.getElementById("gen-kpi-qty");
        const elSku = document.getElementById("gen-kpi-sku");

        if (elBatches) elBatches.innerText = totalBatches;
        if (elDO) elDO.innerText = totalDO;
        if (elVol) elVol.innerText = `${totalVol.toFixed(2)} m³`;
        if (elQty) elQty.innerText = totalQty.toLocaleString();
        if (elSku) elSku.innerText = totalSku.toLocaleString();

        // Update sub-labels dynamically when filtered
        const cardDO = elDO?.closest(".kpi-card");
        const subDO = cardDO?.querySelector(".kpi-sub");
        if (subDO) subDO.innerText = isFiltered ? "Filtered Orders" : "Parsed Orders";

        const cardVol = elVol?.closest(".kpi-card");
        const subVol = cardVol?.querySelector(".kpi-sub");
        if (subVol) subVol.innerText = isFiltered ? "Filtered Volume" : "Cubic Meters";

        const cardQty = elQty?.closest(".kpi-card");
        const subQty = cardQty?.querySelector(".kpi-sub");
        if (subQty) subQty.innerText = isFiltered ? "Filtered Qty" : "Units Shipped";

        const cardSku = elSku?.closest(".kpi-card");
        const subSku = cardSku?.querySelector(".kpi-sub");
        if (subSku) subSku.innerText = isFiltered ? "Filtered SKU" : "Unique Products";
    }

    renderBatchTabs() {
        const container = document.getElementById("generatorBatchTabs");
        if (!container) return;

        if (this.batches.length === 0) {
            container.innerHTML = '<span style="color:#71717a; font-size:13px;">No batches created yet. Upload a source file to start.</span>';
            return;
        }

        let html = "";
        this.batches.forEach((b, idx) => {
            const isActive = idx === this.currentBatchIndex;
            const activeClass = isActive ? "active-tab" : "";
            html += `<button class="batch-tab-btn ${activeClass}" onclick="summaryGenerator.selectBatch(${idx})">${b.batchName} [Wave ${b.waveNumber || '-'}] (${b.records.length} DO)</button>`;
        });

        container.innerHTML = html;
    }

    selectBatch(index) {
        this.currentBatchIndex = index;
        this.renderUI();
    }

    toggleSelectAll(checked) {
        if (this.batches.length === 0 || !this.batches[this.currentBatchIndex]) return;
        const activeBatch = this.batches[this.currentBatchIndex];
        const isSelected = Boolean(checked);

        activeBatch.records.forEach(r => {
            r.selected = isSelected;
        });

        this.saveToStorage();
        this.renderUI();
    }

    toggleRowSelect(recordIdx, checked) {
        if (this.batches[this.currentBatchIndex] && this.batches[this.currentBatchIndex].records[recordIdx]) {
            this.batches[this.currentBatchIndex].records[recordIdx].selected = Boolean(checked);
            this.saveToStorage();

            const activeBatch = this.batches[this.currentBatchIndex];
            const allChecked = activeBatch.records.length > 0 && activeBatch.records.every(r => r.selected === true);
            const mainCheckbox = document.getElementById("selectAllCheckbox");
            if (mainCheckbox) mainCheckbox.checked = allChecked;

            this.renderKPIs();
        }
    }

    addManualDO() {
        if (this.batches.length === 0) {
            let defaultDateCode = this.generatorDate;
            if (!defaultDateCode || defaultDateCode.length !== 8) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const dd = String(tomorrow.getDate()).padStart(2, '0');
                const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
                const yyyy = tomorrow.getFullYear();
                defaultDateCode = `${dd}${mm}${yyyy}`;
            }

            this.batches.push({
                batchName: "Batch 01",
                waveNumber: "01",
                records: []
            });
            this.currentBatchIndex = 0;
            this.targetFileName = `DO Summary List ${defaultDateCode}.xlsx`;
            this.generatorDate = defaultDateCode;
        }

        const activeBatch = this.batches[this.currentBatchIndex];
        const existingManualCount = activeBatch.records.filter(r => r.invoiceNo.startsWith("MANUAL-")).length;
        const nextNum = String(existingManualCount + 1).padStart(3, '0');

        const newRecord = {
            invoiceNo: `MANUAL-${nextNum}`,
            division: "",
            shpCode: "",
            route: "",
            consignee: "",
            addr1: "",
            addr2: "",
            addr3: "",
            volume: 0,
            qty: 0,
            sku: 0,
            remark: "",
            missingRoute: true,
            missingVolume: true,
            selected: true
        };

        activeBatch.records.push(newRecord);
        this.saveToStorage();
        this.renderUI();
        this.showToast(`Added manual row ${newRecord.invoiceNo}.`, "info");

        requestAnimationFrame(() => {
            const wrapper = document.querySelector('.compact-wrapper');
            if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
        });
    }

    async deleteSelectedRows() {
        if (this.batches.length === 0 || !this.batches[this.currentBatchIndex]) return;
        const activeBatch = this.batches[this.currentBatchIndex];

        let selectedRecords = activeBatch.records.filter(r => r.selected === true);

        // Filter-aware: if search filter is active, only target selected records matching search filter
        if (this.searchQuery) {
            selectedRecords = selectedRecords.filter(r => {
                const searchStr = `${r.invoiceNo} ${r.division} ${r.shpCode} ${r.route} ${r.consignee} ${r.addr1} ${r.addr2} ${r.addr3} ${r.remark}`.toLowerCase();
                return searchStr.includes(this.searchQuery);
            });
        }

        if (selectedRecords.length === 0) {
            this.showToast("No selected rows matching current filter to delete.", "info");
            return;
        }

        const confirmed = await this.showConfirmDialog({
            title: "Delete Selected DOs?",
            message: `Are you sure you want to delete ${selectedRecords.length} selected DO order(s) from ${activeBatch.batchName}?`,
            confirmText: "Delete Selected",
            isDanger: true,
            icon: "🗑️"
        });
        if (!confirmed) return;

        const targetSet = new Set(selectedRecords);
        activeBatch.records = activeBatch.records.filter(r => !targetSet.has(r));

        this.saveToStorage();
        this.renderUI();
        this.showToast(`Deleted ${selectedRecords.length} selected DO order(s).`, "success");
    }

    applySimplifyModeUI() {
        const btn = document.getElementById('btnSimplifyMode');
        const table = document.querySelector('.compact-table');
        
        if (btn && table) {
            const svgIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`;
            if (this.isSimplifyMode) {
                btn.innerHTML = `${svgIcon} Simplify Mode: ON`;
                btn.style.background = 'rgba(16, 185, 129, 0.15)';
                btn.style.color = '#34d399';
                btn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                table.classList.add('do-simplify-mode');
            } else {
                btn.innerHTML = `${svgIcon} Simplify Mode`;
                btn.style.background = 'rgba(59, 130, 246, 0.15)';
                btn.style.color = '#60a5fa';
                btn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                table.classList.remove('do-simplify-mode');
            }
        }
    }

    toggleSimplifyMode() {
        this.isSimplifyMode = !this.isSimplifyMode;
        this.applySimplifyModeUI();
    }

    updateRemark(batchIdx, recordIdx, val) {
        if (this.batches[batchIdx] && this.batches[batchIdx].records[recordIdx]) {
            this.batches[batchIdx].records[recordIdx].remark = val.trim();
            this.saveToStorage();
        }
    }

    toggleRemarksPanel() {
        const panel = document.getElementById("quickRemarksPanel");
        const btn = document.getElementById("remarksToggleBtn");
        if (!panel) return;

        panel.classList.toggle("collapsed");
        if (btn) {
            btn.innerText = panel.classList.contains("collapsed") ? "▼ Expand" : "▲ Collapse";
        }
    }

    applyQuickRemark(remarkText) {
        if (this.batches.length === 0 || !this.batches[this.currentBatchIndex]) {
            this.showToast("Please upload or create a batch first!", "warning");
            return;
        }

        const activeBatch = this.batches[this.currentBatchIndex];
        let targetRecords = activeBatch.records;

        // Filter-aware: if search filter is active, only apply remark to checked records within the active search view
        if (this.searchQuery) {
            targetRecords = targetRecords.filter(r => {
                const searchStr = `${r.invoiceNo} ${r.division} ${r.shpCode} ${r.route} ${r.consignee} ${r.addr1} ${r.addr2} ${r.addr3} ${r.remark}`.toLowerCase();
                return searchStr.includes(this.searchQuery);
            });
        }

        const selectedRecords = targetRecords.filter(r => r.selected === true);

        if (selectedRecords.length === 0) {
            this.showToast(this.searchQuery
                ? "Please check/select at least one filtered DO row to apply this remark."
                : "Please check/select at least one DO row to apply this remark.", "warning");
            return;
        }

        selectedRecords.forEach(r => {
            r.remark = remarkText.trim();
        });

        this.saveToStorage();
        this.renderTable();
        const label = remarkText.trim() ? `"${remarkText.trim()}"` : "(Cleared)";
        this.showToast(`Applied remark ${label} to ${selectedRecords.length} DO(s).`, "success");
    }

    applyCustomBulkRemark() {
        const input = document.getElementById("customBulkRemarkInput");
        if (!input) return;
        const val = input.value.trim();
        if (!val) {
            this.showToast("Please enter a remark text in the box first.", "warning");
            return;
        }
        this.applyQuickRemark(val);
        input.value = "";
    }

    applyQuickRemarkToFiltered(remarkText) {
        if (this.batches.length === 0 || !this.batches[this.currentBatchIndex]) {
            this.showToast("Please upload or create a batch first!", "warning");
            return;
        }

        const activeBatch = this.batches[this.currentBatchIndex];
        let targetRecords = activeBatch.records;

        if (this.searchQuery) {
            targetRecords = targetRecords.filter(r => {
                const searchStr = `${r.invoiceNo} ${r.division} ${r.shpCode} ${r.route} ${r.consignee} ${r.addr1} ${r.addr2} ${r.addr3} ${r.remark}`.toLowerCase();
                return searchStr.includes(this.searchQuery);
            });
        }

        if (targetRecords.length === 0) {
            this.showToast("No DO records match the current filter.", "info");
            return;
        }

        const cleanRemark = remarkText.trim();
        targetRecords.forEach(r => {
            r.remark = cleanRemark;
        });

        this.saveToStorage();
        this.renderTable();

        const label = cleanRemark ? `"${cleanRemark}"` : "(Cleared)";
        this.showToast(`Applied remark ${label} to ${targetRecords.length} filtered DO record(s)!`, "success");
    }

    applyCustomFilteredRemark() {
        const input = document.getElementById("filteredRemarkInput");
        if (!input) return;
        const val = input.value.trim();
        this.applyQuickRemarkToFiltered(val);
        input.value = "";
    }

    updateRoute(batchIdx, recordIdx, val) {
        if (this.batches[batchIdx] && this.batches[batchIdx].records[recordIdx]) {
            const cleanVal = val.trim().toUpperCase();
            const rec = this.batches[batchIdx].records[recordIdx];
            rec.route = cleanVal;
            rec.missingRoute = !cleanVal || cleanVal === "-" || cleanVal === "MISSING";
            this.saveToStorage();
            this.renderKPIs();
            this.renderTable();
        }
    }

    updateVolume(batchIdx, recordIdx, val) {
        if (this.batches[batchIdx] && this.batches[batchIdx].records[recordIdx]) {
            const num = parseFloat(val) || 0;
            const rec = this.batches[batchIdx].records[recordIdx];
            rec.volume = num;
            rec.missingVolume = num <= 0;
            this.saveToStorage();
            this.renderKPIs();
            this.renderTable();
        }
    }

    setSearchQuery(val) {
        this.searchQuery = String(val || "").trim().toLowerCase();
        this.renderTable();
    }

    updateField(batchIdx, recordIdx, field, val) {
        if (this.batches[batchIdx] && this.batches[batchIdx].records[recordIdx]) {
            const rec = this.batches[batchIdx].records[recordIdx];
            if (field === 'qty' || field === 'sku') {
                rec[field] = parseInt(val) || 0;
            } else {
                rec[field] = val.trim();
            }
            this.saveToStorage();
            if (field === 'qty' || field === 'sku') {
                this.renderKPIs();
            }
        }
    }

    renderTable() {
        const tbody = document.getElementById("generatorTableBody");
        if (!tbody) return;

        const mainCheckbox = document.getElementById("selectAllCheckbox");
        const elSearchCount = document.getElementById("batchSearchCount");

        if (this.batches.length === 0 || !this.batches[this.currentBatchIndex]) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:24px; color:#71717a;">No batch data loaded. Please upload a source file.</td></tr>';
            if (mainCheckbox) mainCheckbox.checked = false;
            if (elSearchCount) elSearchCount.style.display = "none";
            return;
        }

        const activeBatch = this.batches[this.currentBatchIndex];
        const records = activeBatch.records;

        const filteredRecords = [];
        records.forEach((r, originalIdx) => {
            if (this.searchQuery) {
                const searchStr = `${r.invoiceNo} ${r.division} ${r.shpCode} ${r.route} ${r.consignee} ${r.addr1} ${r.addr2} ${r.addr3} ${r.remark}`.toLowerCase();
                if (!searchStr.includes(this.searchQuery)) return;
            }
            filteredRecords.push({ record: r, idx: originalIdx });
        });

        // Toggle Filtered DOs Remark Bar
        const filteredBar = document.getElementById("filteredRemarkBar");
        const filteredBadge = document.getElementById("filteredBarCountBadge");
        if (filteredBar) {
            if (this.searchQuery && filteredRecords.length > 0) {
                filteredBar.style.display = "flex";
                if (filteredBadge) filteredBadge.innerText = `${filteredRecords.length} DOs`;
            } else {
                filteredBar.style.display = "none";
            }
        }

        // Dynamic KPI update based on current filter state
        this.renderKPIs(this.searchQuery ? filteredRecords.map(item => item.record) : null);

        if (elSearchCount) {
            elSearchCount.style.display = "inline-block";
            if (this.searchQuery) {
                elSearchCount.innerText = `${filteredRecords.length} / ${records.length} DOs`;
            } else {
                elSearchCount.innerText = `${records.length} DOs`;
            }
        }

        const allChecked = records.length > 0 && records.every(r => r.selected === true);
        const noneChecked = records.length > 0 && records.every(r => r.selected === false);
        
        if (mainCheckbox) mainCheckbox.checked = allChecked;
        
        const btnSelectAll = document.getElementById("btnSelectAll");
        const btnDeselectAll = document.getElementById("btnDeselectAll");
        if (btnSelectAll && btnDeselectAll) {
            const setBtnState = (btn, checked, label) => {
                const icon = btn.querySelector('svg');
                const text = btn.querySelector('span');
                if (icon) {
                    if (checked) {
                        icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
                    } else {
                        icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"/>';
                    }
                }
                if (text) text.textContent = label;
            };

            if (allChecked) {
                setBtnState(btnSelectAll, true, "Select All");
                setBtnState(btnDeselectAll, false, "Deselect All");
            } else if (noneChecked) {
                setBtnState(btnSelectAll, false, "Select All");
                setBtnState(btnDeselectAll, true, "Deselect All");
            } else {
                setBtnState(btnSelectAll, false, "Select All");
                setBtnState(btnDeselectAll, false, "Deselect All");
            }
        }

        if (filteredRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:24px; color:#71717a;">No DO records match search "${this.searchQuery}".</td></tr>`;
            return;
        }

        const bi = this.currentBatchIndex;
        let html = "";
        filteredRecords.forEach((item) => {
            const r = item.record;
            const idx = item.idx;
            const isManual = r.invoiceNo.startsWith("MANUAL-");

            const isMissingRoute = r.missingRoute || !r.route || r.route.trim() === "" || r.route === "-" || r.route.toUpperCase() === "MISSING";
            const isMissingVol = r.missingVolume || r.volume <= 0;
            const isChecked = r.selected === true ? "checked" : "";

            const routeInputHtml = `<input type="text" class="compact-input ${isMissingRoute ? 'missing-highlight' : ''}" 
                value="${isMissingRoute ? '' : (r.route || '')}" placeholder="ROUTE" 
                onchange="summaryGenerator.updateRoute(${bi}, ${idx}, this.value)" 
                style="width: 75px; text-transform: uppercase;">`;

            const volInputHtml = `<input type="number" step="0.001" min="0" class="compact-input ${isMissingVol ? 'missing-highlight' : ''}" 
                value="${r.volume > 0 ? r.volume : ''}" placeholder="0.000" 
                onchange="summaryGenerator.updateVolume(${bi}, ${idx}, this.value)" 
                style="width: 80px; text-align: right;">`;

            if (isManual) {
                html += `<tr style="background: rgba(59, 130, 246, 0.05);">
                    <td style="text-align: center;">
                        <input type="checkbox" class="row-select-checkbox" ${isChecked} onchange="summaryGenerator.toggleRowSelect(${idx}, this.checked)" style="cursor: pointer;">
                    </td>
                    <td><input type="text" class="compact-input" value="${r.invoiceNo}" placeholder="DO Number" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'invoiceNo', this.value)" style="width: 110px; font-family: monospace; font-weight: 700; color: #60a5fa;"></td>
                    <td><input type="text" class="compact-input" value="${r.division || ''}" placeholder="DIV" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'division', this.value)" style="width: 50px;"></td>
                    <td><input type="text" class="compact-input" value="${r.shpCode || ''}" placeholder="SHP" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'shpCode', this.value)" style="width: 70px;"></td>
                    <td>${routeInputHtml}</td>
                    <td><input type="text" class="compact-input" value="${r.consignee || ''}" placeholder="Consignee" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'consignee', this.value)" style="width: 140px; font-weight: 600;"></td>
                    <td><input type="text" class="compact-input" value="${r.addr1 || ''}" placeholder="Address 1" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'addr1', this.value)" style="width: 120px;"></td>
                    <td><input type="text" class="compact-input" value="${r.addr2 || ''}" placeholder="Address 2" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'addr2', this.value)" style="width: 120px;"></td>
                    <td><input type="text" class="compact-input" value="${r.addr3 || ''}" placeholder="Address 3" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'addr3', this.value)" style="width: 100px;"></td>
                    <td>${volInputHtml} m³</td>
                    <td><input type="number" class="compact-input" value="${r.qty || ''}" placeholder="0" min="0" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'qty', this.value)" style="width: 60px; text-align: right;"></td>
                    <td><input type="number" class="compact-input" value="${r.sku || ''}" placeholder="0" min="0" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'sku', this.value)" style="width: 50px; text-align: right;"></td>
                    <td>
                        <input type="text" class="compact-remark-input" value="${r.remark || ''}" placeholder="Enter remark..." 
                               onchange="summaryGenerator.updateRemark(${bi}, ${idx}, this.value)">
                    </td>
                </tr>`;
            } else {
                html += `<tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="row-select-checkbox" ${isChecked} onchange="summaryGenerator.toggleRowSelect(${idx}, this.checked)" style="cursor: pointer;">
                    </td>
                    <td><input type="text" class="compact-input" value="${r.invoiceNo}" placeholder="DO Number" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'invoiceNo', this.value)" style="width: 110px; font-family: monospace; font-weight: 700; color: #60a5fa;"></td>
                    <td><input type="text" class="compact-input" value="${r.division || ''}" placeholder="DIV" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'division', this.value)" style="width: 50px;"></td>
                    <td><input type="text" class="compact-input" value="${r.shpCode || ''}" placeholder="SHP" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'shpCode', this.value)" style="width: 70px;"></td>
                    <td>${routeInputHtml}</td>
                    <td><input type="text" class="compact-input" value="${r.consignee || ''}" placeholder="Consignee" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'consignee', this.value)" style="width: 140px; font-weight: 600;"></td>
                    <td><input type="text" class="compact-input" value="${r.addr1 || ''}" placeholder="Address 1" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'addr1', this.value)" style="width: 120px;"></td>
                    <td><input type="text" class="compact-input" value="${r.addr2 || ''}" placeholder="Address 2" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'addr2', this.value)" style="width: 120px;"></td>
                    <td><input type="text" class="compact-input" value="${r.addr3 || ''}" placeholder="Address 3" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'addr3', this.value)" style="width: 100px;"></td>
                    <td>${volInputHtml} m³</td>
                    <td><input type="number" class="compact-input" value="${r.qty || ''}" placeholder="0" min="0" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'qty', this.value)" style="width: 60px; text-align: right;"></td>
                    <td><input type="number" class="compact-input" value="${r.sku || ''}" placeholder="0" min="0" 
                        onchange="summaryGenerator.updateField(${bi}, ${idx}, 'sku', this.value)" style="width: 50px; text-align: right;"></td>
                    <td>
                        <input type="text" class="compact-remark-input" value="${r.remark || ''}" placeholder="Enter remark..." 
                               onchange="summaryGenerator.updateRemark(${bi}, ${idx}, this.value)">
                    </td>
                </tr>`;
            }
        });

        tbody.innerHTML = html;
    }
}

// Global Instance
let summaryGenerator = null;
document.addEventListener("DOMContentLoaded", () => {
    summaryGenerator = new DOSummaryGenerator();
});