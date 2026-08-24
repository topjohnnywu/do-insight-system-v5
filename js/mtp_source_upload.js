/* ============================================================================
 * mtp_source_upload.js — Source-file upload for Manual Truck Planning (MTP only)
 *
 * ONE upload button reads the combined source workbook once and populates BOTH
 * datasets the page needs — but writes them to MTP-SCOPED localStorage keys so
 * no other page/module is affected:
 *   • "MtpDoSummary"  → DO list (unassigned table + truck boards)
 *   • "MtpRouteData"  → per-DO line items (split-dialog model dropdown)
 *
 * Manual Truck Planning prefers these MTP keys and falls back to the shared
 * global keys (LastUploadedDoSummary / LastUploadedRouteData) when no MTP file
 * has been uploaded — so global data keeps working until you upload here.
 *
 * Supported template (e.g. Route.csv / Route outbound export,
 * sheet "SONY - ROUTE OUTBOUND"):
 *   A SEQ | B DIVISION | C ZONE1 | D CONSIGNEE_NAME | E ADDRESS1 | F ADDRESS2 |
 *   G ADDRESS3 | H VOLUME | I SHIP_PLAN_QUANTITY | J SHIP_QUANTITY |
 *   K ITEM | L ITEM_DESC
 * Detection: a "SEQ" header cell in column A (first 10 rows). One row per line
 * item; a multi-SKU DO spans several rows and is grouped by SEQ.
 * ========================================================================== */
(function () {
    // ── Column indices (0-based) for the route/product source template ───────
    const COL = {
        SEQ: 0, DIV: 1, ZONE: 2, NAME: 3, ADDR1: 4, ADDR2: 5, ADDR3: 6,
        VOL: 7, SHIP_PLAN: 8, SHIP_QTY: 9, ITEM: 10, ITEM_DESC: 11
    };

    const MTP_DO_KEY = "MtpDoSummary";
    const MTP_ROUTE_KEY = "MtpRouteData";
    const MTP_FILENAME_KEY = "MtpSourceFileName";

    const str = (v) => (v === undefined || v === null) ? "" : String(v).trim();
    const num = (v) => { const n = parseFloat(str(v).replace(/,/g, "")); return isNaN(n) ? 0 : n; };
    const int = (v) => { const n = parseInt(str(v).replace(/,/g, ""), 10); return isNaN(n) ? 0 : n; };

    // ── Read the chosen file into an array-of-arrays ─────────────────────────
    function readWorkbook(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }));
                } catch (err) { reject(err); }
            };
            reader.onerror = () => reject(new Error("Could not read file"));
            reader.readAsArrayBuffer(file);
        });
    }

    // ── Locate the SEQ header + return data rows ─────────────────────────────
    function extractDataRows(aoa) {
        if (!aoa || aoa.length === 0) throw new Error("The sheet is empty.");
        let headerIdx = -1;
        for (let i = 0; i < Math.min(10, aoa.length); i++) {
            if (str(aoa[i][COL.SEQ]).toUpperCase() === "SEQ") { headerIdx = i; break; }
        }
        if (headerIdx === -1) throw new Error('Could not find a "SEQ" header column. This does not look like the source template.');
        const rows = aoa.slice(headerIdx + 1).filter(r => str(r[COL.SEQ]) !== "");
        if (rows.length === 0) throw new Error("No data rows found under the SEQ header.");
        return rows;
    }

    // ── Build DO Summary rows (shape mirrors parsers.js LastUploadedDoSummary) ─
    function buildDoSummary(rows, fileName) {
        return rows.map(r => ({
            fileName: fileName,
            inv: str(r[COL.SEQ]),
            div: str(r[COL.DIV]) || "N/A",
            code: str(r[COL.ITEM]),
            route: str(r[COL.ZONE]),
            name: str(r[COL.NAME]) || "Unknown Consignee",
            addr: [r[COL.ADDR1], r[COL.ADDR2], r[COL.ADDR3]].map(str).filter(Boolean).join(" "),
            colG: "", colH: "",
            vol: num(r[COL.VOL]),
            qty: int(r[COL.SHIP_QTY]),
            sku: 0,
            remark: ""
        }));
    }

    // ── Build Route/Product map (shape mirrors parsers.js LastUploadedRouteData)
    function buildRouteMap(rows) {
        const map = {};
        rows.forEach(r => {
            const inv = str(r[COL.SEQ]);
            if (!inv) return;
            const route = str(r[COL.ZONE]);
            const code = str(r[COL.ITEM]) || "Unspecified Code";
            const desc = str(r[COL.ITEM_DESC]) || "No Description";
            const qty = int(r[COL.SHIP_QTY]);
            if (!map[inv]) map[inv] = { route: route, hub: "", hubs: [], items: [], listK: [], listL: [] };
            if (route && !map[inv].route) map[inv].route = route;
            map[inv].items.push({ code, desc, qty, batch: "", route, truck: "", hub: "", trucks: [], hubs: [] });
            if (code && !map[inv].listK.includes(code)) map[inv].listK.push(code);
            if (desc && !map[inv].listL.includes(desc)) map[inv].listL.push(desc);
        });
        return map;
    }

    // ── Safe localStorage write with quota guard ─────────────────────────────
    function safeSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); }
        catch (e) { throw new Error("File too large for in-browser storage. Try a smaller extract."); }
    }

    // ── Re-render via the page's own loader (re-reads MTP/global keys) ───────
    function reload() {
        if (typeof initData === "function") initData();
        else location.reload();
    }

    // ── Append-merge helpers (union by inv; new rows/items are added) ────────
    // DO Summary: keep existing rows, then add new rows whose inv is NOT already present.
    function appendDoSummary(existingArr, newArr) {
        const existingInvs = new Set((existingArr || []).map(r => str(r.inv)));
        const additions = newArr.filter(r => !existingInvs.has(str(r.inv)));
        return (existingArr || []).concat(additions);
    }

    // Route/Product: for each inv, merge items by code+desc (summing qty); add new invs.
    function appendRouteMap(existingMap, newMap) {
        const out = Object.assign({}, existingMap || {});
        Object.keys(newMap).forEach(inv => {
            if (!out[inv]) { out[inv] = newMap[inv]; return; }
            // Merge items of an existing inv
            const existing = out[inv];
            existing.items = Array.isArray(existing.items) ? existing.items : [];
            const itemIndex = {};
            existing.items.forEach((it, i) => { itemIndex[`${str(it.code)}||${str(it.desc)}`] = i; });
            newMap[inv].items.forEach(nit => {
                const key = `${str(nit.code)}||${str(nit.desc)}`;
                if (itemIndex[key] !== undefined) {
                    existing.items[itemIndex[key]].qty = (int(existing.items[itemIndex[key]].qty) + int(nit.qty));
                } else {
                    existing.items.push(nit);
                }
            });
            if (!existing.route && newMap[inv].route) existing.route = newMap[inv].route;
            existing.listK = Array.from(new Set([].concat(existing.listK || [], newMap[inv].listK || [])));
            existing.listL = Array.from(new Set([].concat(existing.listL || [], newMap[inv].listL || [])));
        });
        return out;
    }

    // ── Feature 3: Replace vs Append dialog (only when data already exists) ──
    // Resolves to 'replace' | 'append' | null (abort).
    async function resolveConflict(kindLabel, statsText) {
        const base = statsText + "\n\nManual Truck Planning already has loaded data.";
        if (typeof window.showConfirmDialog === "function") {
            const replace = await window.showConfirmDialog({
                title: "Replace existing " + kindLabel + "?",
                message: base + "\n\nOK = REPLACE all existing data with the new file(s).\nCancel = choose Append instead.",
                confirmText: "Replace",
                cancelText: "Append…",
                isDanger: true,
                icon: "📂"
            });
            if (replace) return "replace";
            const append = await window.showConfirmDialog({
                title: "Append to existing " + kindLabel + "?",
                message: base + "\n\nOK = APPEND the new file(s) to the current data (existing entries kept; matching line quantities summed).\nCancel = abort.",
                confirmText: "Append",
                cancelText: "Cancel",
                isDanger: false,
                icon: "🔗"
            });
            return append ? "append" : null;
        }
        // Native fallback
        if (window.confirm(base + "\n\nOK = REPLACE existing data. Cancel = choose Append/abort.")) return "replace";
        if (window.confirm(base + "\n\nOK = APPEND to existing data. Cancel = abort.")) return "append";
        return null;
    }

    // ── Public: source-file upload — supports MULTIPLE files, merged ─────────
    window.handleSourceFileUpload = async function (input) {
        const files = Array.from(input.files || []);
        if (files.length === 0) return;
        try {
            // Feature 2: parse every selected file and combine their data rows.
            const perFile = await Promise.all(files.map(async (f) => {
                const aoa = await readWorkbook(f);
                return { name: f.name, rows: extractDataRows(aoa) };
            }));
            const allRows = perFile.reduce((acc, p) => acc.concat(p.rows), []);
            const fileNames = perFile.map(p => p.name).join(", ");

            const doRows = buildDoSummary(allRows, fileNames);
            const routeMap = buildRouteMap(allRows);
            const invCount = Object.keys(routeMap).length;
            const itemCount = allRows.length;
            const statsText = `Detected ${invCount} DO(s) / ${itemCount} line item(s) across ${files.length} file(s): ${fileNames}.`;

            // Feature 3: if MTP data already exists, ask Replace vs Append.
            const hasExisting = !!(localStorage.getItem(MTP_DO_KEY) || localStorage.getItem(MTP_ROUTE_KEY));
            let mode = "replace";
            if (hasExisting) {
                mode = await resolveConflict("source data", statsText);
                if (!mode) { input.value = ""; return; }
            } else if (typeof window.showConfirmDialog === "function") {
                // First load: simple confirmation
                const ok = await window.showConfirmDialog({
                    title: "Load source file?",
                    message: statsText + "\n\nThis updates Manual Truck Planning only — other pages are unaffected.\n\nOK to load it?",
                    confirmText: "Load", cancelText: "Cancel", isDanger: false, icon: "📂"
                });
                if (!ok) { input.value = ""; return; }
            }

            // Apply
            let finalDo = doRows, finalRoute = routeMap;
            if (mode === "append") {
                finalDo = appendDoSummary(JSON.parse(localStorage.getItem(MTP_DO_KEY)) || [], doRows);
                finalRoute = appendRouteMap(JSON.parse(localStorage.getItem(MTP_ROUTE_KEY)) || {}, routeMap);
            }
            safeSet(MTP_DO_KEY, finalDo);
            safeSet(MTP_ROUTE_KEY, finalRoute);
            localStorage.setItem(MTP_FILENAME_KEY, fileNames);

            window.showToast && window.showToast(
                `${mode === "append" ? "Appended" : "Loaded"} ${invCount} DO(s), ${itemCount} item(s) from ${files.length} file(s).`, "success");
            reload();
        } catch (err) {
            console.error(err);
            window.showToast ? window.showToast(err.message || "Failed to load source file.", "error")
                             : alert(err.message);
        } finally {
            input.value = ""; // allow re-uploading the same file(s)
        }
    };

    // ── Feature 1: Reset — clear ALL loaded route data back to empty ─────────
    window.resetMtpSourceData = async function () {
        let proceed = true;
        if (typeof window.showConfirmDialog === "function") {
            proceed = await window.showConfirmDialog({
                title: "Reset loaded data?",
                message: "This clears all route/product data currently loaded for Manual Truck Planning and returns the page to an empty state. Your truck assignments are also cleared.\n\nThis cannot be undone.",
                confirmText: "Reset",
                cancelText: "Cancel",
                isDanger: true,
                icon: "🗑️"
            });
        } else {
            proceed = window.confirm("Reset loaded data? This cannot be undone.");
        }
        if (!proceed) return;

        // Clear the MTP-scoped datasets
        localStorage.removeItem(MTP_DO_KEY);
        localStorage.removeItem(MTP_ROUTE_KEY);
        localStorage.removeItem(MTP_FILENAME_KEY);

        // Empty the in-memory working state + UI via the page's own reset helper
        if (typeof window.resetMtpState === "function") window.resetMtpState();

        window.showToast && window.showToast("Route data cleared. State returned to empty.", "info");
    };

    // ── Back-compat: clear the MTP-specific upload and revert to global data ─
    window.clearMtpSourceFile = function () {
        localStorage.removeItem(MTP_DO_KEY);
        localStorage.removeItem(MTP_ROUTE_KEY);
        localStorage.removeItem(MTP_FILENAME_KEY);
        window.showToast && window.showToast("Reverted to the shared dashboard data.", "info");
        reload();
    };
})();
