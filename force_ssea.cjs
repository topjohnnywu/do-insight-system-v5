const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/lookupParser.js', 'utf8');

const target = `          let headerRowFound = false;
          if (rawRows.length > 3) {
            const row4 = rawRows[3];
            if (row4 && Array.isArray(row4)) {
              const colDStr = String(row4[3] || '').trim().toLowerCase();
              const colFStr = String(row4[5] || '').trim().toLowerCase();
              if (
                colDStr.includes('do') || colDStr.includes('d.o') ||
                colFStr.includes('8d') || colFStr.includes('part') || colFStr.includes('code')
              ) {
                headerRowFound = true;
                startIdx = 4;
              }
            }
          }

          if (!headerRowFound) {
            for (let r = 0; r < Math.min(10, rawRows.length); r++) {
              const row = rawRows[r];
              if (!row) continue;
              for (let c = 0; c < row.length; c++) {
                const cell = String(row[c] || '').trim().toLowerCase();
                if (cell.includes('do no') || cell === 'do' || cell === 'd.o. no') doColIdx = c;
                if (cell.includes('8d') || cell.includes('part') || cell.includes('code')) code8dColIdx = c;
                if (cell.includes('qty') || cell.includes('quantity')) qtyColIdx = c;
                if (cell.includes('dest')) destColIdx = c;
                if (cell.includes('desc') || cell.includes('model') || cell.includes('name')) descColIdx = c;
                if (cell.includes('carton') || cell.includes('ctn')) cartonColIdx = c;
                if (cell.includes('weight') || cell.includes('kg')) weightColIdx = c;
                if (cell.includes('length')) lengthColIdx = c;
                if (cell.includes('width')) widthColIdx = c;
                if (cell.includes('height')) heightColIdx = c;
              }

              if (doColIdx !== 3 || code8dColIdx !== 5) {
                startIdx = r + 1;
                break;
              }
            }
          }`;

const replacement = `          // Use exact structure for SSEA as requested:
          // Data starts at Row 5 (index 4)
          // doColIdx = 3 (Col D)
          // code8dColIdx = 5 (Col F)
          // qtyColIdx = 6 (Col G)
          startIdx = 4;`;

content = content.replace(target, replacement);
fs.writeFileSync('packing-sheet/js/utils/lookupParser.js', content);
