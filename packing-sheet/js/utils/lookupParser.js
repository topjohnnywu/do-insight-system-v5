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
              const autoCarton = typeof numQty === 'number' && numQty > 0 ? Math.ceil(numQty / 5) : '';

              entries.push({
                id: `ssea-${i}-${Date.now()}`,
                doNo: doNo || 'UNKNOWN-DO',
                code8D: code8D || '',
                customer: 'SSEA',
                description: desc || undefined,
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
    entryCustomer,
    filterByCustomer,
    parseDOLookupFile,
    parseMSCSJLookupFile,
  };
})();

