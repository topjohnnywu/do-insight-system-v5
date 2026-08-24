const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/excelExport.js', 'utf8');

// 1. Change columns array
let target = `    worksheet.columns = [
      { width: 16 }, { width: 18 }, { width: 12 }, { width: 16 },
      { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 },
    ];`;
let replacement = `    worksheet.columns = [
      { width: 16 }, { width: 18 }, { width: 35 }, { width: 12 }, { width: 16 },
      { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 },
    ];`;
content = content.replace(target, replacement);

// 2. Change Row 1 merges
target = `    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');`;
replacement = `    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');`;
content = content.replace(target, replacement);

target = `    worksheet.mergeCells('F1:H1');
    const shipByCell = worksheet.getCell('F1');`;
replacement = `    worksheet.mergeCells('G1:I1');
    const shipByCell = worksheet.getCell('G1');`;
content = content.replace(target, replacement);

// 3. Change Row 2 merges
target = `    worksheet.mergeCells('A2:C2');
    const doCell = worksheet.getCell('A2');`;
replacement = `    worksheet.mergeCells('A2:C2');
    const doCell = worksheet.getCell('A2');`; // Unchanged, we'll keep A2:C2, D2:F2, G2:I2 instead of G2:H2.
content = content.replace(target, replacement);

target = `    worksheet.mergeCells('D2:F2');
    const destCell = worksheet.getCell('D2');`;
replacement = `    worksheet.mergeCells('D2:F2');
    const destCell = worksheet.getCell('D2');`;
content = content.replace(target, replacement);

target = `    worksheet.mergeCells('G2:H2');
    const dateCell = worksheet.getCell('G2');`;
replacement = `    worksheet.mergeCells('G2:I2');
    const dateCell = worksheet.getCell('G2');`;
content = content.replace(target, replacement);

// 4. Change Headers & Lookup
target = `    const headers = [
      unitInfo.columnHeader, 'PRODUCT CODE', 'Qty', 'Total Carton',
      'Weight (B) (CM)', 'Length (P) (CM)', 'Width (L) (CM)', 'Height (T) (CM)',
    ];`;
replacement = `    const lookupDb = options && options.lookupDb ? options.lookupDb : [];
    const getDesc = (code) => {
      if (!code) return '';
      const match = lookupDb.find(e => e.code8D.toLowerCase() === String(code).trim().toLowerCase());
      return match ? (match.description || '') : '';
    };

    const headers = [
      unitInfo.columnHeader, 'PRODUCT CODE', 'PRODUCT DESCRIPTION', 'Qty', 'Total Carton',
      'Weight (B) (CM)', 'Length (P) (CM)', 'Width (L) (CM)', 'Height (T) (CM)',
    ];`;
content = content.replace(target, replacement);

// 5. Change displayRows mapping
target = `      const cellConfigs = [
        { val: r.skidNo, align: 'center', bold: true },
        { val: r.code8D, align: 'center' },
        { val: r.qty, align: 'right', format: '#,##0' },
        { val: r.totalCarton, align: 'right', format: '#,##0' },
        { val: r.weightKg, align: 'right', format: '0.0' },
        { val: r.lengthCm, align: 'center' },
        { val: r.widthCm, align: 'center' },
        { val: r.heightCm, align: 'center' },
      ];`;
replacement = `      const cellConfigs = [
        { val: r.skidNo, align: 'center', bold: true },
        { val: r.code8D, align: 'center' },
        { val: getDesc(r.code8D), align: 'left' },
        { val: r.qty, align: 'right', format: '#,##0' },
        { val: r.totalCarton, align: 'right', format: '#,##0' },
        { val: r.weightKg, align: 'right', format: '0.0' },
        { val: r.lengthCm, align: 'center' },
        { val: r.widthCm, align: 'center' },
        { val: r.heightCm, align: 'center' },
      ];`;
content = content.replace(target, replacement);

// 6. Change totals row
target = `      for (let colIdx = 1; colIdx <= 8; colIdx++) {`;
replacement = `      for (let colIdx = 1; colIdx <= 9; colIdx++) {`;
content = content.replace(target, replacement);

target = `        } else if (colIdx === 2) {
          cell.value = '-';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colIdx === 3 && !isTemplate) {
          cell.value = { formula: \`SUM(C\${startRowNumber}:C\${endRowNumber})\` };
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colIdx === 4 && !isTemplate) {
          cell.value = { formula: \`SUM(D\${startRowNumber}:D\${endRowNumber})\` };
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colIdx === 5 && !isTemplate) {
          cell.value = { formula: \`SUM(E\${startRowNumber}:E\${endRowNumber})\` };
          cell.numFmt = '0.0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {`;
replacement = `        } else if (colIdx === 2 || colIdx === 3) {
          cell.value = '-';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colIdx === 4 && !isTemplate) {
          cell.value = { formula: \`SUM(D\${startRowNumber}:D\${endRowNumber})\` };
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colIdx === 5 && !isTemplate) {
          cell.value = { formula: \`SUM(E\${startRowNumber}:E\${endRowNumber})\` };
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colIdx === 6 && !isTemplate) {
          cell.value = { formula: \`SUM(F\${startRowNumber}:F\${endRowNumber})\` };
          cell.numFmt = '0.0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {`;
content = content.replace(target, replacement);

// We need to also patch the CBM calculation part at the bottom which spans columns
target = `    worksheet.mergeCells(\`C\${currentRowIdx}:E\${currentRowIdx}\`);
    const cbmLabel = worksheet.getCell(\`C\${currentRowIdx}\`);`;
replacement = `    worksheet.mergeCells(\`D\${currentRowIdx}:F\${currentRowIdx}\`);
    const cbmLabel = worksheet.getCell(\`D\${currentRowIdx}\`);`;
content = content.replace(target, replacement);

target = `    worksheet.mergeCells(\`F\${currentRowIdx}:H\${currentRowIdx}\`);
    const cbmValue = worksheet.getCell(\`F\${currentRowIdx}\`);`;
replacement = `    worksheet.mergeCells(\`G\${currentRowIdx}:I\${currentRowIdx}\`);
    const cbmValue = worksheet.getCell(\`G\${currentRowIdx}\`);`;
content = content.replace(target, replacement);

target = `    worksheet.mergeCells(\`A\${currentRowIdx}:B\${currentRowIdx}\`);
    const gapCell = worksheet.getCell(\`A\${currentRowIdx}\`);`;
replacement = `    worksheet.mergeCells(\`A\${currentRowIdx}:C\${currentRowIdx}\`);
    const gapCell = worksheet.getCell(\`A\${currentRowIdx}\`);`;
content = content.replace(target, replacement);

fs.writeFileSync('packing-sheet/js/utils/excelExport.js', content);
