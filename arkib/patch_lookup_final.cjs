const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/lookupParser.js', 'utf8');

// Replace the parsing block with a clean forced block
const target = `          let startIdx = 4;

          // Forced SSEA format based on explicit user instruction:
          // startIdx = 4 (Row 5)
          // doColIdx = 3 (Col D)
          // code8dColIdx = 5 (Col F)
          // qtyColIdx = 6 (Col G)
          startIdx = 4;
          const entries = [];
          const uniqueDos = new Set();

          for (let i = startIdx; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            const doNo = String(row[doColIdx] || '').trim();
            const code8D = String(row[code8dColIdx] || '').trim();
            const qty = row[qtyColIdx];
            const desc = descColIdx >= 0 ? String(row[descColIdx] || '').trim() : '';
            const dest = destColIdx >= 0 ? String(row[destColIdx] || '').trim() : '';

            if (!doNo && !code8D) continue;
            if (doNo.toUpperCase().includes('TOTAL') || code8D.toUpperCase().includes('TOTAL')) continue;

            if (doNo || code8D) {
              if (doNo) uniqueDos.add(doNo.toUpperCase());

              const numQty = qty !== undefined ? qty : '';
              const autoCarton = typeof numQty === 'number' && numQty > 0 ? Math.ceil(numQty / 5) : '';

              entries.push({
                id: \`ssea-\${i}-\${Date.now()}\`,
                doNo: doNo || 'UNKNOWN-DO',
                code8D: code8D || '',
                customer: 'SSEA',
                description: "Debug: " + JSON.stringify(row),
                destination: dest || undefined,
                qty: numQty,
                totalCarton: autoCarton,
              });
            }
          }`;

const replacement = `          // Data starts at Row 6 (Index 5). Row 5 is headers.
          let startIdx = 5;
          const entries = [];
          const uniqueDos = new Set();

          for (let i = startIdx; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            const doNo = String(row[doColIdx] || '').trim();
            const code8D = String(row[code8dColIdx] || '').trim();
            const qty = row[qtyColIdx];
            const desc = descColIdx >= 0 ? String(row[descColIdx] || '').trim() : '';
            const dest = destColIdx >= 0 ? String(row[destColIdx] || '').trim() : '';

            if (!doNo && !code8D) continue;
            if (doNo.toUpperCase().includes('TOTAL') || code8D.toUpperCase().includes('TOTAL')) continue;

            if (doNo || code8D) {
              if (doNo) uniqueDos.add(doNo.toUpperCase());

              const numQty = qty !== '' && qty !== undefined && !isNaN(Number(qty)) ? Number(qty) : '';
              const autoCarton = typeof numQty === 'number' && numQty > 0 ? Math.ceil(numQty / 5) : '';

              entries.push({
                id: \`ssea-\${i}-\${Date.now()}\`,
                doNo: doNo || 'UNKNOWN-DO',
                code8D: code8D || '',
                customer: 'SSEA',
                description: desc || undefined,
                destination: dest || undefined,
                qty: numQty,
                totalCarton: autoCarton,
              });
            }
          }`;

content = content.replace(target, replacement);
fs.writeFileSync('packing-sheet/js/utils/lookupParser.js', content);
