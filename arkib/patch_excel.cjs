const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/excelExport.js', 'utf8');

const populateSimplifiedTarget = `  function sanitizeSheetName(rawName, existingNames) {`;
const populateSimplifiedReplacement = `  function populateSimplifiedWorksheet(worksheet, header, items, options) {
    worksheet.columns = [
      { width: 20 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }
    ];

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };

    const titleRow = worksheet.getRow(1);
    titleRow.height = 32;

    worksheet.mergeCells('A1:C1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'PACKING DETAILS SHEET (DIMENSIONS)';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells('D1:E1');
    const shipByCell = worksheet.getCell('D1');
    const shipByValue = header.shipBy === 'OTHER' && header.customShipBy ? header.customShipBy : header.shipBy;
    shipByCell.value = \`SHIP BY: \${shipByValue || 'FCL/LCL/AIR'}\`;
    shipByCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    shipByCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const metaRow = worksheet.getRow(2);
    metaRow.height = 24;

    worksheet.mergeCells('A2:B2');
    const doCell = worksheet.getCell('A2');
    doCell.value = \`D.O. NO: \${header.doNo || '________________'}\`;
    doCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    doCell.alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells('C2:D2');
    const destCell = worksheet.getCell('C2');
    destCell.value = \`Destination: \${header.destination || '________________'}\`;
    destCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    destCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const dateCell = worksheet.getCell('E2');
    dateCell.value = \`Date: \${header.date || ''}\`;
    dateCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    dateCell.alignment = { vertical: 'middle', horizontal: 'right' };

    worksheet.getRow(3).height = 10;

    let displayRows = [];
    const filtered = items.filter(
      (item) => item.skidNo || item.weightKg !== '' || item.lengthCm !== '' || item.widthCm !== '' || item.heightCm !== ''
    );
    const activeList = filtered.length > 0 ? filtered : items;
    displayRows = activeList.map((item) => ({
      skidNo: item.skidNo || '',
      weightKg: item.weightKg !== '' ? Number(item.weightKg) : '',
      lengthCm: item.lengthCm !== '' ? Number(item.lengthCm) : '',
      widthCm: item.widthCm !== '' ? Number(item.widthCm) : '',
      heightCm: item.heightCm !== '' ? Number(item.heightCm) : '',
      qty: item.qty !== '' ? Number(item.qty) : '', // keep for summary calculation
      totalCarton: item.totalCarton !== '' ? Number(item.totalCarton) : '', // keep for summary calculation
    }));

    const unitInfo = getPackageUnitLabel(displayRows.length > 0 ? displayRows : items);

    const headerRow = worksheet.getRow(4);
    headerRow.height = 32;

    const headers = [
      unitInfo.columnHeader, 'Weight (B) (CM)', 'Length (P) (CM)', 'Width (L) (CM)', 'Height (T) (CM)'
    ];

    headers.forEach((hText, colIdx) => {
      const cell = headerRow.getCell(colIdx + 1);
      cell.value = hText;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF475569' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF475569' } },
      };
    });

    let currentRowIdx = 5;
    displayRows.forEach((r, index) => {
      const row = worksheet.getRow(currentRowIdx);
      row.height = 22;
      const rowBg = index % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

      const cellConfigs = [
        { val: r.skidNo, align: 'center', bold: true },
        { val: r.weightKg, align: 'right', format: '0.0' },
        { val: r.lengthCm, align: 'center' },
        { val: r.widthCm, align: 'center' },
        { val: r.heightCm, align: 'center' },
      ];

      cellConfigs.forEach((c, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = c.val === undefined || c.val === null ? '' : c.val;
        cell.font = { name: 'Calibri', size: 10, bold: !!c.bold };
        if (c.format && c.val !== '') cell.numFmt = c.format;
        cell.alignment = { vertical: 'middle', horizontal: c.align };
        cell.border = thinBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      });
      currentRowIdx++;
    });

    // Summary Section
    if (displayRows.length > 0) {
      const summary = computeSummary(displayRows);
      currentRowIdx += 1; // leave a blank row

      // SUMMARY header
      const summaryHeaderRow = worksheet.getRow(currentRowIdx);
      summaryHeaderRow.height = 24;
      worksheet.mergeCells(\`A\${currentRowIdx}:E\${currentRowIdx}\`);
      const summaryHeaderCell = worksheet.getCell(\`A\${currentRowIdx}\`);
      summaryHeaderCell.value = 'SUMMARY';
      summaryHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      summaryHeaderCell.alignment = { vertical: 'middle', horizontal: 'left' };
      for (let colIdx = 1; colIdx <= 5; colIdx++) {
        const cell = summaryHeaderRow.getCell(colIdx);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.border = thinBorder;
      }
      currentRowIdx++;

      const summaryEntries = [];
      if (summary.totalSkids > 0 && summary.totalBoxes > 0) {
        summaryEntries.push({ label: 'Total Skids', value: summary.totalSkids, format: '#,##0' });
        summaryEntries.push({ label: 'Total Boxes', value: summary.totalBoxes, format: '#,##0' });
      } else if (summary.totalBoxes > 0 && summary.totalSkids === 0) {
        summaryEntries.push({ label: 'Total Boxes', value: summary.totalBoxes, format: '#,##0' });
      } else {
        summaryEntries.push({ label: 'Total Skids', value: summary.totalSkids, format: '#,##0' });
      }

      summaryEntries.push(
        { label: 'Total Quantity', value: summary.totalQty, format: '#,##0' },
        { label: 'Gross Weight (kg)', value: summary.grossWeight, format: '#,##0.0' },
        { label: 'Total CBM (m³)', value: summary.totalCbm, format: '0.000' }
      );

      summaryEntries.forEach((entry, idx) => {
        const row = worksheet.getRow(currentRowIdx);
        row.height = 20;
        const rowBg = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
        
        worksheet.mergeCells(\`A\${currentRowIdx}:B\${currentRowIdx}\`);
        const labelCell = worksheet.getCell(\`A\${currentRowIdx}\`);
        labelCell.value = entry.label;
        labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
        
        worksheet.mergeCells(\`C\${currentRowIdx}:E\${currentRowIdx}\`);
        const valueCell = worksheet.getCell(\`C\${currentRowIdx}\`);
        valueCell.value = entry.value;
        if (entry.format) valueCell.numFmt = entry.format;
        valueCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        valueCell.alignment = { vertical: 'middle', horizontal: 'left' }; // left aligned value to match sample

        for (let colIdx = 1; colIdx <= 5; colIdx++) {
          const cell = row.getCell(colIdx);
          cell.border = thinBorder;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        }
        currentRowIdx++;
      });
    }

    currentRowIdx += 2;
    const sigRow = worksheet.getRow(currentRowIdx);
    sigRow.height = 28;

    worksheet.mergeCells(\`A\${currentRowIdx}:B\${currentRowIdx}\`);
    const packCell = worksheet.getCell(\`A\${currentRowIdx}\`);
    packCell.value = \`Pack By: \${header.packBy || '___________________________'}\`;
    packCell.font = { name: 'Calibri', size: 11, bold: true };
    packCell.alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells(\`C\${currentRowIdx}:E\${currentRowIdx}\`);
    const appCell = worksheet.getCell(\`C\${currentRowIdx}\`);
    appCell.value = \`Approved By (Area PIC): \${header.approvedBy || '___________________________'}\`;
    appCell.font = { name: 'Calibri', size: 11, bold: true };
    appCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Auto-fit logic for simplified worksheet
    const lastRowToCheck = displayRows.length > 0 ? (currentRowIdx - 3) : 4; 
    for (let colIdx = 1; colIdx <= 5; colIdx++) {
      let maxLength = 0;
      for (let r = 4; r <= lastRowToCheck; r++) {
        const cell = worksheet.getCell(r, colIdx);
        let valStr = '';
        if (cell.value && typeof cell.value === 'object' && cell.value.formula) {
           valStr = cell.value.result ? cell.value.result.toString() : '999999';
        } else if (cell.value) {
           valStr = cell.value.toString();
        }
        
        if (valStr.includes('\\n')) {
            valStr.split('\\n').forEach(line => {
                maxLength = Math.max(maxLength, line.length);
            });
        } else {
            maxLength = Math.max(maxLength, valStr.length);
        }
      }

      const column = worksheet.getColumn(colIdx);
      if (colIdx === 1) {
        column.width = Math.max(20, Math.min(40, maxLength + 2)); // Skid no
      } else {
        column.width = Math.max(16, Math.min(25, maxLength + 2)); // Dimensions
      }
    }
  }

  function sanitizeSheetName(rawName, existingNames) {`;

content = content.replace(populateSimplifiedTarget, populateSimplifiedReplacement);

const exportTarget = `  async function exportToExcel(header, items, fileName, options) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Packing Details Sheet Converter';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Packing Details Sheet', {
      views: [{ showGridLines: true }],
    });

    populateWorksheet(worksheet, header, items, options);`;

const exportReplacement = `  async function exportToExcel(header, items, fileName, options) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Packing Details Sheet Converter';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Packing Details Sheet', {
      views: [{ showGridLines: true }],
    });

    if (options && options.isSimplified) {
      populateSimplifiedWorksheet(worksheet, header, items, options);
    } else {
      populateWorksheet(worksheet, header, items, options);
    }`;

content = content.replace(exportTarget, exportReplacement);

fs.writeFileSync('packing-sheet/js/utils/excelExport.js', content);
