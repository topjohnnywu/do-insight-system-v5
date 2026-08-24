const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/excelExport.js', 'utf8');

const target = `    appCell.font = { name: 'Calibri', size: 11, bold: true };
    appCell.alignment = { vertical: 'middle', horizontal: 'left' };
  }`;

const replacement = `    appCell.font = { name: 'Calibri', size: 11, bold: true };
    appCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Auto-fit columns based on tabular data (Rows 4 to Totals)
    const lastRowToCheck = displayRows.length > 0 ? endRowNumber + 1 : 4;
    for (let colIdx = 1; colIdx <= 9; colIdx++) {
      let maxLength = 0;
      for (let r = 4; r <= lastRowToCheck; r++) {
        const cell = worksheet.getCell(r, colIdx);
        let valStr = '';
        if (cell.value && typeof cell.value === 'object' && cell.value.formula) {
           valStr = cell.value.result ? cell.value.result.toString() : '999999'; // fallback for formulas if result is missing
        } else if (cell.value) {
           valStr = cell.value.toString();
        }
        
        // Handle newlines in headers
        if (valStr.includes('\\n')) {
            valStr.split('\\n').forEach(line => {
                maxLength = Math.max(maxLength, line.length);
            });
        } else {
            maxLength = Math.max(maxLength, valStr.length);
        }
      }

      const column = worksheet.getColumn(colIdx);
      if (colIdx === 3) {
        column.width = Math.max(20, Math.min(60, maxLength + 3));
      } else if (colIdx === 2 || colIdx === 1) {
        column.width = Math.max(16, Math.min(30, maxLength + 2));
      } else {
        column.width = Math.max(12, Math.min(25, maxLength + 2));
      }
    }
  }`;

content = content.replace(target, replacement);

fs.writeFileSync('packing-sheet/js/utils/excelExport.js', content);
