/* Lookup-file parsers: SSEA "Insert Batch" + MSCSJ "DATA"/"MODEL".
   Classic script → window.LookupParser. Logic preserved verbatim. Uses global XLSX. */
(function () {
  const XLSX = window.XLSX;

  const entryCustomer = (e) => (e.customer != null ? e.customer : 'SSEA');

  const filterByCustomer = (db, activeCustomer) => {
    const target = activeCustomer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
    return (db || []).filter((e) => entryCustomer(e) === target);
  };

  // Helper to parse numbers safely from strings, handling commas, spaces, currency, etc.
  function cleanQuantity(val) {
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'number') return isNaN(val) ? '' : val;
    const str = String(val).replace(/,/g, '').trim();
    if (!str) return '';
    const num = parseFloat(str);
    return !isNaN(num) ? num : '';
  }

  // Normalize D.O. string for comparison (removes redundant spacing, punctuation)
  function normalizeDo(str) {
    if (!str) return '';
    return String(str).trim().toUpperCase();
  }

  // Extract base alphanumeric identifier (e.g. "81528920" from "81528920 LCL/FOR FSI-MDR")
  function extractDoBase(str) {
    if (!str) return '';
    const s = String(str).trim().toUpperCase();
    const match = s.match(/\b\d{6,12}\b/) || s.match(/^[A-Z0-9_-]+/);
    return match ? match[0] : s;
  }

  // Smart D.O. matching: handles exact matches, base number matches, and substring matches
  function isDoMatch(do1, do2) {
    if (!do1 || !do2) return false;
    const n1 = normalizeDo(do1);
    const n2 = normalizeDo(do2);
    if (!n1 || !n2) return false;
    if (n1 === n2) return true;

    const b1 = extractDoBase(n1);
    const b2 = extractDoBase(n2);
    if (b1 && b2 && b1 === b2) return true;

    // Check if one contains the other
    if (n1.includes(n2) || n2.includes(n1)) return true;
    if (b1 && (n2.includes(b1) || b2.includes(n1))) return true;

    return false;
  }

  // Helper to find matching records from DB for a given DO and customer
  function findMatchesForDo(db, doNo, customer) {
    if (!doNo || !db || db.length === 0) return [];
    const activeCustomer = customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
    const customerFiltered = filterByCustomer(db, activeCustomer);
    return customerFiltered.filter((e) => isDoMatch(e.doNo, doNo));
  }

  // Aggregate entries by unique product code (code8D) and calculate the sum of quantities
  function aggregateEntriesByProductCode(entries, customer) {
    if (!Array.isArray(entries) || entries.length === 0) return [];

    const groupedMap = new Map();
    const result = [];

    entries.forEach((entry, idx) => {
      const codeKey = (entry.code8D || '').trim().toUpperCase();

      // If entry has no code8D, keep it as an individual item without grouping
      if (!codeKey) {
        result.push({
          ...entry,
          qty: cleanQuantity(entry.qty),
        });
        return;
      }

      const qVal = cleanQuantity(entry.qty);
      const numQ = typeof qVal === 'number' ? qVal : 0;

      if (groupedMap.has(codeKey)) {
        const aggregated = groupedMap.get(codeKey);
        aggregated.totalQty += numQ;
        aggregated.hasQty = aggregated.hasQty || typeof qVal === 'number';

        // Keep description/destination if previous row lacked it
        if (!aggregated.description && entry.description) {
          aggregated.description = entry.description;
        }
        if (!aggregated.destination && entry.destination) {
          aggregated.destination = entry.destination;
        }
      } else {
        const itemObj = {
          ...entry,
          id: entry.id || `agg-${Date.now()}-${idx}`,
          code8D: entry.code8D ? entry.code8D.trim() : '',
          totalQty: numQ,
          hasQty: typeof qVal === 'number',
        };
        groupedMap.set(codeKey, itemObj);
        result.push(itemObj);
      }
    });

    // Finalize quantities and total cartons
    return result.map((item) => {
      if (item.totalQty !== undefined && item.hasQty !== undefined) {
        const finalQty = item.hasQty ? item.totalQty : '';
        const itemCustomer = item.customer || (customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA');
        let autoCarton = '';
        if (itemCustomer === 'MSCSJ') {
          autoCarton = typeof finalQty === 'number' && finalQty > 0 ? Math.ceil(finalQty / 5) : '';
        } else {
          // Customer SSEA: Leave empty for manual entry
          autoCarton = '';
        }

        const { totalQty, hasQty, ...rest } = item;
        return {
          ...rest,
          qty: finalQty,
          totalCarton: autoCarton,
        };
      }
      return item;
    });
  }

  /**
   * Calculates remaining quantities for each model in a DO.
   * Allocations are summed from items (optionally excluding a specific row by ID or index).
   *
   * @param {Array} items - Sheet rows with { id, code8D, qty }
   * @param {Array} aggregatedLookupEntries - Aggregated DO source entries with { code8D, qty }
   * @param {string|number} [excludeIdOrIndex] - Optional ID or index of row to exclude from allocated sum
   * @returns {Map<string, { code8D: string, sourceQty: number, allocatedQty: number, remainingQty: number }>}
   */
  function calculateRemainingModelQuantities(items, aggregatedLookupEntries, excludeIdOrIndex) {
    const allocatedMap = new Map();
    (items || []).forEach((item, idx) => {
      if (excludeIdOrIndex !== undefined && excludeIdOrIndex !== null) {
        if (item.id === excludeIdOrIndex || idx === excludeIdOrIndex) return;
      }
      if (!item || !item.code8D) return;
      const key = item.code8D.trim().toLowerCase();
      if (!key) return;
      const qVal = cleanQuantity(item.qty);
      const numQ = typeof qVal === 'number' ? qVal : 0;
      allocatedMap.set(key, (allocatedMap.get(key) || 0) + numQ);
    });

    const resultMap = new Map();
    (aggregatedLookupEntries || []).forEach((entry) => {
      if (!entry || !entry.code8D) return;
      const code = entry.code8D.trim();
      const key = code.toLowerCase();
      const srcQVal = cleanQuantity(entry.qty);
      const sourceQty = typeof srcQVal === 'number' ? srcQVal : 0;
      const allocatedQty = allocatedMap.get(key) || 0;
      const remainingQty = Math.max(0, sourceQty - allocatedQty);

      resultMap.set(key, {
        code8D: code,
        sourceQty,
        allocatedQty,
        remainingQty,
      });
    });

    return resultMap;
  }

  /**
   * Gets remaining unallocated quantity for a specific model code, excluding a specific item.
   *
   * @param {Array} items
   * @param {Array} aggregatedLookupEntries
   * @param {string} modelCode
   * @param {string|number} [excludeIdOrIndex]
   * @returns {number}
   */
  function getRemainingQuantityForModel(items, aggregatedLookupEntries, modelCode, excludeIdOrIndex) {
    if (!modelCode) return 0;
    const key = modelCode.trim().toLowerCase();
    const map = calculateRemainingModelQuantities(items, aggregatedLookupEntries, excludeIdOrIndex);
    const info = map.get(key);
    if (!info) return 0;
    return Math.max(0, info.remainingQty);
  }

  /**
   * Filters available model codes for a specific row in the packing sheet.
   * - If no aggregated lookup entries exist, returns unique codes from customerDb.
   * - If aggregated lookup entries exist, only returns models where remainingQty > 0
   *   (taking into account allocations by all other rows), OR if the model is currently
   *   selected in this row.
   *
   * @param {Object} params
   * @param {Array} params.items - Current items in the sheet
   * @param {Array} params.aggregatedLookupEntries - Aggregated entries for current DO
   * @param {Array} params.customerDb - Fallback customer database entries
   * @param {Object} [params.item] - The row's current item
   * @param {number} [params.rowIndex] - Index of the row requesting options
   * @returns {Array<string>}
   */
  function getAvailableCodesForRow(params) {
    const { items, aggregatedLookupEntries, customerDb, item, rowIndex } = params || {};

    if (!aggregatedLookupEntries || aggregatedLookupEntries.length === 0) {
      const list = (customerDb || []).map((m) => m && m.code8D && m.code8D.trim()).filter(Boolean);
      return Array.from(new Set(list));
    }

    const excludeKey = item && item.id !== undefined ? item.id : rowIndex;
    const remainingMap = calculateRemainingModelQuantities(items, aggregatedLookupEntries, excludeKey);
    const currentCodeKey = item && item.code8D ? item.code8D.trim().toLowerCase() : '';

    const availableCodes = [];
    (aggregatedLookupEntries || []).forEach((entry) => {
      if (!entry || !entry.code8D) return;
      const code = entry.code8D.trim();
      const key = code.toLowerCase();
      const stockInfo = remainingMap.get(key);
      const remainingQty = stockInfo ? stockInfo.remainingQty : 0;

      // Filter: only models with remaining quantity > 0, or currently selected in this row
      if (remainingQty > 0 || (currentCodeKey && key === currentCodeKey)) {
        if (!availableCodes.includes(code)) {
          availableCodes.push(code);
        }
      }
    });

    return availableCodes;
  }

  function parseDOLookupFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const buffer = e.target && e.target.result;
          if (!buffer) throw new Error('Failed to read file');

          const workbook = XLSX.read(buffer, { type: 'array' });

          let targetSheetName = workbook.SheetNames[0];
          const matchInsertBatch = workbook.SheetNames.find(
            (name) => name.trim().toLowerCase() === 'insert batch'
          );
          if (matchInsertBatch) targetSheetName = matchInsertBatch;

          const worksheet = workbook.Sheets[targetSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (!rawRows || rawRows.length === 0) {
            resolve({ entries: [], uniqueDoCount: 0, fileName: file.name });
            return;
          }

          // Defaults based on SSEA standard template
          let doColIdx = 3;       // Col D
          let code8dColIdx = 5;   // Col F
          let qtyColIdx = 6;      // Col G
          let destColIdx = 7;     // Col H
          let descColIdx = 10;    // Col K
          let startIdx = 5;       // Default row 6 (index 5)

          // Scan first 15 rows for dynamic header detection
          for (let r = 0; r < Math.min(15, rawRows.length); r++) {
            const row = rawRows[r];
            if (!row || !Array.isArray(row)) continue;

            let headerMatches = 0;
            row.forEach((cell, colIdx) => {
              const text = String(cell || '').trim().toLowerCase();
              if (!text) return;

              if (text === 'do' || text.includes('d.o') || text.includes('do no') || text.includes('delivery')) {
                doColIdx = colIdx;
                headerMatches++;
              } else if (
                text.includes('8d') ||
                text.includes('code') ||
                text.includes('item') ||
                text.includes('part no') ||
                text.includes('material')
              ) {
                code8dColIdx = colIdx;
                headerMatches++;
              } else if (
                text.includes('ship qt') ||
                text.includes('ship qty') ||
                text === 'qty' ||
                text.includes('quantity') ||
                text.includes('shipped')
              ) {
                qtyColIdx = colIdx;
                headerMatches++;
              } else if (
                text.includes('destination') ||
                text.includes('dest') ||
                text.includes('consignee') ||
                text.includes('country') ||
                text.includes('ship to')
              ) {
                destColIdx = colIdx;
                headerMatches++;
              } else if (text.includes('desc') || text.includes('description') || text.includes('model')) {
                descColIdx = colIdx;
                headerMatches++;
              }
            });

            if (headerMatches >= 2) {
              startIdx = r + 1;
              break;
            }
          }

          const entries = [];
          const uniqueDos = new Set();

          for (let i = startIdx; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            const doNo = String(row[doColIdx] || '').trim();
            const code8D = String(row[code8dColIdx] || '').trim();
            const rawQty = row[qtyColIdx];
            const desc = descColIdx >= 0 ? String(row[descColIdx] || '').trim() : '';
            const dest = destColIdx >= 0 ? String(row[destColIdx] || '').trim() : '';

            if (!doNo && !code8D) continue;
            if (doNo.toUpperCase().includes('TOTAL') || code8D.toUpperCase().includes('TOTAL')) continue;
            if (doNo.toUpperCase().includes('SHIP QT') || code8D.toUpperCase().includes('8D CODE')) continue;

            if (doNo || code8D) {
              if (doNo) uniqueDos.add(doNo.toUpperCase());

              const numQty = cleanQuantity(rawQty);

              entries.push({
                id: `ssea-${i}-${Date.now()}`,
                doNo: doNo || 'UNKNOWN-DO',
                code8D: code8D || '',
                customer: 'SSEA',
                description: desc || undefined,
                destination: dest || undefined,
                qty: numQty,
                totalCarton: '',
              });
            }
          }

          resolve({ entries, uniqueDoCount: uniqueDos.size, fileName: file.name });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  function parseMSCSJLookupFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const buffer = e.target && e.target.result;
          if (!buffer) throw new Error('Failed to read file');

          const workbook = XLSX.read(buffer, { type: 'array' });

          // Build MODEL sheet code -> description map (Col B=code, Col C=desc)
          const modelMap = new Map();
          const modelSheetName = workbook.SheetNames.find(
            (name) => name.trim().toLowerCase() === 'model'
          );
          if (modelSheetName) {
            const modelSheet = workbook.Sheets[modelSheetName];
            const modelRows = XLSX.utils.sheet_to_json(modelSheet, { header: 1, defval: '' });
            modelRows.forEach((row) => {
              if (!row) return;
              const code = String(row[1] || '').trim();
              const desc = String(row[2] || '').trim();
              if (code && desc) {
                modelMap.set(code.toUpperCase(), desc);
                modelMap.set(code, desc);
              }
            });
          }

          let targetSheetName = workbook.SheetNames[0];
          const matchData = workbook.SheetNames.find(
            (name) => name.trim().toLowerCase() === 'data'
          );
          if (matchData) targetSheetName = matchData;

          const worksheet = workbook.Sheets[targetSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (!rawRows || rawRows.length === 0) {
            resolve({ entries: [], uniqueDoCount: 0, fileName: file.name });
            return;
          }

          let startIdx = 1;
          let doColIdx = 0;
          let destColIdx = 4;
          let qtyColIdx = 11;
          let modelCodeColIdx = 12;

          for (let r = 0; r < Math.min(15, rawRows.length); r++) {
            const row = rawRows[r];
            if (!row || !Array.isArray(row)) continue;

            row.forEach((cell, colIdx) => {
              const text = String(cell || '').trim().toLowerCase();
              if (!text) return;
              if (text.includes('do') || text.includes('d.o')) doColIdx = colIdx;
              else if (text.includes('country') || text.includes('dest') || text.includes('consignee')) destColIdx = colIdx;
              else if (text.includes('qty') || text.includes('quantity')) qtyColIdx = colIdx;
              else if (text.includes('model') || text.includes('code') || text.includes('part')) modelCodeColIdx = colIdx;
            });

            const colAStr = String(row[0] || '').trim().toLowerCase();
            const colEStr = String(row[4] || '').trim().toLowerCase();
            const colLStr = String(row[11] || '').trim().toLowerCase();
            const colMStr = String(row[12] || '').trim().toLowerCase();
            if (
              colAStr.includes('do') || colAStr.includes('d.o') ||
              colEStr.includes('country') || colEStr.includes('dest') ||
              colLStr.includes('qty') || colLStr.includes('quantity') ||
              colMStr.includes('model') || colMStr.includes('code') || colMStr.includes('part')
            ) {
              startIdx = r + 1;
              break;
            }
          }

          const entries = [];
          const uniqueDos = new Set();

          for (let i = startIdx; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            const doNo = String(row[doColIdx] || '').trim();
            const dest = String(row[destColIdx] || '').trim();
            const rawQty = row[qtyColIdx];
            const modelCode = String(row[modelCodeColIdx] || '').trim();

            if (!doNo && !modelCode) continue;
            if (doNo.toUpperCase().includes('TOTAL') || modelCode.toUpperCase().includes('TOTAL')) continue;

            if (doNo || modelCode) {
              if (doNo) uniqueDos.add(doNo.toUpperCase());

              const mappedDesc = modelCode
                ? (modelMap.get(modelCode.toUpperCase()) || modelMap.get(modelCode) || modelCode)
                : undefined;

              const numQty = cleanQuantity(rawQty);
              const autoCarton = typeof numQty === 'number' && numQty > 0 ? Math.ceil(numQty / 5) : '';

              entries.push({
                id: `mscsj-${i}-${Date.now()}`,
                doNo: doNo || 'UNKNOWN-DO',
                code8D: modelCode || '',
                customer: 'MSCSJ',
                description: mappedDesc,
                destination: dest || undefined,
                qty: numQty,
                totalCarton: autoCarton,
              });
            }
          }

          resolve({ entries, uniqueDoCount: uniqueDos.size, fileName: file.name });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  window.LookupParser = {
    cleanQuantity,
    normalizeDo,
    extractDoBase,
    isDoMatch,
    findMatchesForDo,
    aggregateEntriesByProductCode,
    calculateRemainingModelQuantities,
    getRemainingQuantityForModel,
    getAvailableCodesForRow,
    entryCustomer,
    filterByCustomer,
    parseDOLookupFile,
    parseMSCSJLookupFile,
  };
})();

