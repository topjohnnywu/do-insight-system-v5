/* Excel export via ExcelJS (classic script → window.ExcelExport). Verbatim logic, global ExcelJS. */
(function () {
  const ExcelJS = window.ExcelJS;

  function getPackageUnitLabel(items) {
    let hasSkid = false;
    let hasBox = false;

    items.forEach((item) => {
      const val = (item.skidNo || '').trim().toUpperCase();
      if (val.includes('BOX')) hasBox = true;
      if (val.includes('SKID')) hasSkid = true;
    });

    if (hasSkid && hasBox) {
      return {
        columnHeader: 'SKID / BOX NO.',
        totalLabel: 'Total Skids / Boxes',
        summaryHeader: 'TOTAL SKIDS / BOXES:',
        hasSkid: true,
        hasBox: true,
      };
    } else if (hasBox && !hasSkid) {
      return {
        columnHeader: 'BOX NO.',
        totalLabel: 'Total Boxes',
        summaryHeader: 'TOTAL BOXES:',
        hasSkid: false,
        hasBox: true,
      };
    } else {
      return {
        columnHeader: 'SKID NO.',
        totalLabel: 'Total Skids',
        summaryHeader: 'TOTAL SKIDS:',
        hasSkid: true,
        hasBox: false,
      };
    }
  }

  function toNum(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const str = String(val).replace(/,/g, '').trim();
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  }

  function computeSummary(rows) {
    const uniqueSkids = new Set();
    const uniqueBoxes = new Set();

    rows.forEach((r) => {
      const s = (r.skidNo || '').trim().toUpperCase();
      if (s) {
        if (s.includes('BOX')) uniqueBoxes.add(s);
        else if (s.includes('SKID')) uniqueSkids.add(s);
        else uniqueSkids.add(s);
      }
    });

    let totalSkids = uniqueSkids.size;
    let totalBoxes = uniqueBoxes.size;

    if (totalSkids === 0 && totalBoxes === 0 && rows.length > 0) {
      totalSkids = 1;
    }

    return {
      totalSkids,
      totalBoxes,
      totalQty: rows.reduce((acc, r) => acc + toNum(r.qty), 0),
      totalCartons: rows.reduce((acc, r) => acc + toNum(r.totalCarton), 0),
      grossWeight: rows.reduce((acc, r) => acc + toNum(r.weightKg), 0),
      totalCbm: rows.reduce((acc, r) => {
        const l = toNum(r.lengthCm);
        const w = toNum(r.widthCm);
        const h = toNum(r.heightCm);
        if (l > 0 && w > 0 && h > 0) return acc + (l * w * h) / 1000000;
        return acc;
      }, 0),
    };
  }

  function populateWorksheet(worksheet, header, items, options) {
    worksheet.views = [{ showGridLines: false }];
    const isSsea = (header.customer || 'SSEA') !== 'MSCSJ';
    const hideCarton = Boolean(options && (options.hideTotalCarton || (options.hideSseaTotalCarton && isSsea)));

    const baseWidthsHideCarton = [16, 16, 22, 12, 17, 17, 16, 17];
    const baseWidthsStandard = [16, 16, 22, 12, 14, 17, 17, 16, 17];

    worksheet.columns = (hideCarton ? baseWidthsHideCarton : baseWidthsStandard).map((w) => ({ width: w }));

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };

    const totalsBorder = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };

    const titleRow = worksheet.getRow(1);
    titleRow.height = 32;

    const shipByValue =
      header.shipBy === 'OTHER' && header.customShipBy ? header.customShipBy : header.shipBy;

    if (hideCarton) {
      worksheet.mergeCells('A1:E1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = options && options.isHandwrittenTemplate
        ? 'PACKING DETAILS SHEET (HANDWRITTEN TEMPLATE)'
        : 'PACKING DETAILS SHEET';
      titleCell.font = { name: 'Aptos', size: 16, bold: true, color: { argb: 'FF0F172A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

      worksheet.mergeCells('F1:H1');
      const shipByCell = worksheet.getCell('F1');
      shipByCell.value = `SHIP BY: ${shipByValue || 'FCL/LCL/AIR'}`;
      shipByCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      shipByCell.alignment = { vertical: 'middle', horizontal: 'right' };

      const metaRow = worksheet.getRow(2);
      metaRow.height = 24;

      worksheet.mergeCells('A2:C2');
      const doCell = worksheet.getCell('A2');
      doCell.value = `D.O. NO: ${header.doNo || '________________'}`;
      doCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      doCell.alignment = { vertical: 'middle', horizontal: 'left' };

      worksheet.mergeCells('D2:F2');
      const destCell = worksheet.getCell('D2');
      destCell.value = `Destination: ${header.destination || '________________'}`;
      destCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      destCell.alignment = { vertical: 'middle', horizontal: 'left' };

      worksheet.mergeCells('G2:H2');
      const dateCell = worksheet.getCell('G2');
      dateCell.value = `Date: ${header.date || ''}`;
      dateCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      dateCell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else {
      worksheet.mergeCells('A1:F1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = options && options.isHandwrittenTemplate
        ? 'PACKING DETAILS SHEET (HANDWRITTEN TEMPLATE)'
        : 'PACKING DETAILS SHEET';
      titleCell.font = { name: 'Aptos', size: 16, bold: true, color: { argb: 'FF0F172A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

      worksheet.mergeCells('G1:I1');
      const shipByCell = worksheet.getCell('G1');
      shipByCell.value = `SHIP BY: ${shipByValue || 'FCL/LCL/AIR'}`;
      shipByCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      shipByCell.alignment = { vertical: 'middle', horizontal: 'right' };

      const metaRow = worksheet.getRow(2);
      metaRow.height = 24;

      worksheet.mergeCells('A2:C2');
      const doCell = worksheet.getCell('A2');
      doCell.value = `D.O. NO: ${header.doNo || '________________'}`;
      doCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      doCell.alignment = { vertical: 'middle', horizontal: 'left' };

      worksheet.mergeCells('D2:F2');
      const destCell = worksheet.getCell('D2');
      destCell.value = `Destination: ${header.destination || '________________'}`;
      destCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      destCell.alignment = { vertical: 'middle', horizontal: 'left' };

      worksheet.mergeCells('G2:I2');
      const dateCell = worksheet.getCell('G2');
      dateCell.value = `Date: ${header.date || ''}`;
      dateCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      dateCell.alignment = { vertical: 'middle', horizontal: 'right' };
    }

    worksheet.getRow(3).height = 10;

    let displayRows = [];

    if (options && options.isHandwrittenTemplate) {
      const count = options.blankRowCount || 15;
      for (let i = 0; i < count; i++) {
        displayRows.push({
          skidNo: `SKID-${(i + 1).toString().padStart(2, '0')}`,
          code8D: '', qty: '', totalCarton: '', weightKg: '',
          lengthCm: '', widthCm: '', heightCm: '',
        });
      }
    } else {
      const filtered = items.filter(
        (item) =>
          item.skidNo || item.code8D || item.qty !== '' || item.totalCarton !== '' || item.weightKg !== ''
      );
      const activeList = filtered.length > 0 ? filtered : items;
      displayRows = activeList.map((item) => ({
        skidNo: item.skidNo || '',
        code8D: item.code8D || '',
        qty: item.qty !== '' ? Number(item.qty) : '',
        totalCarton: item.totalCarton !== '' ? Number(item.totalCarton) : '',
        weightKg: item.weightKg !== '' ? Number(item.weightKg) : '',
        lengthCm: item.lengthCm !== '' ? Number(item.lengthCm) : '',
        widthCm: item.widthCm !== '' ? Number(item.widthCm) : '',
        heightCm: item.heightCm !== '' ? Number(item.heightCm) : '',
      }));
    }

    const unitInfo = getPackageUnitLabel(displayRows.length > 0 ? displayRows : items);

    const headerRow = worksheet.getRow(4);
    headerRow.height = 32;

    const lookupDb = options && options.lookupDb ? options.lookupDb : [];
    const getDesc = (code) => {
      if (!code) return '';
      const match = lookupDb.find(e => e.code8D.toLowerCase() === String(code).trim().toLowerCase());
      return match ? (match.description || '') : '';
    };

    const headers = hideCarton
      ? [
          unitInfo.columnHeader, 'PRODUCT CODE', 'PRODUCT DESCRIPTION', 'Qty',
          'Weight (B) (CM)', 'Length (P) (CM)', 'Width (L) (CM)', 'Height (T) (CM)',
        ]
      : [
          unitInfo.columnHeader, 'PRODUCT CODE', 'PRODUCT DESCRIPTION', 'Qty', 'Total Carton',
          'Weight (B) (CM)', 'Length (P) (CM)', 'Width (L) (CM)', 'Height (T) (CM)',
        ];

    headers.forEach((hText, colIdx) => {
      const cell = headerRow.getCell(colIdx + 1);
      cell.value = hText;
      cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FFB30000' } },
        left: { style: 'thin', color: { argb: 'FFCC0000' } },
        bottom: { style: 'medium', color: { argb: 'FFB30000' } },
        right: { style: 'thin', color: { argb: 'FFCC0000' } },
      };
    });

    // Group contiguous rows into packages
    const packageGroups = [];
    let currentPkg = null;

    displayRows.forEach((r, idx) => {
      const trimmedSkid = (r.skidNo || '').trim();
      const isNew =
        idx === 0 ||
        (trimmedSkid !== '' && currentPkg && trimmedSkid.toUpperCase() !== currentPkg.skidNo.toUpperCase());

      if (isNew) {
        currentPkg = {
          skidNo: trimmedSkid,
          startIndex: idx,
          endIndex: idx,
          startRow: 5 + idx,
          endRow: 5 + idx,
          rows: [r],
        };
        packageGroups.push(currentPkg);
      } else {
        currentPkg.endIndex = idx;
        currentPkg.endRow = 5 + idx;
        currentPkg.rows.push(r);
        if (!currentPkg.skidNo && trimmedSkid) {
          currentPkg.skidNo = trimmedSkid;
        }
      }
    });

    let currentRowIdx = 5;
    const isTemplate = options && options.isHandwrittenTemplate;

    packageGroups.forEach((pkg, groupIdx) => {
      const rowBg = groupIdx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
      const isMulti = pkg.rows.length > 1;

      // Check if multiple rows in group have separate non-zero weights
      const nonZeroWeights = pkg.rows.filter(
        (it) => it.weightKg !== '' && !isNaN(Number(it.weightKg)) && Number(it.weightKg) > 0
      );
      const shouldMergeWeight = !isMulti ? false : nonZeroWeights.length <= 1;

      pkg.rows.forEach((r, rowSubIdx) => {
        const row = worksheet.getRow(currentRowIdx);
        row.height = isTemplate ? 28 : 22;

        // For multi-model package: primary row shows skidNo, dimensions, and total weight (if merged)
        const showSkidNo = rowSubIdx === 0 ? pkg.skidNo : '';
        const showLength = rowSubIdx === 0 ? r.lengthCm : (isMulti ? '' : r.lengthCm);
        const showWidth = rowSubIdx === 0 ? r.widthCm : (isMulti ? '' : r.widthCm);
        const showHeight = rowSubIdx === 0 ? r.heightCm : (isMulti ? '' : r.heightCm);

        let showWeight = r.weightKg;
        if (isMulti && shouldMergeWeight) {
          showWeight = rowSubIdx === 0 ? (nonZeroWeights[0] ? nonZeroWeights[0].weightKg : r.weightKg) : '';
        }

        const cellConfigs = [
          { val: showSkidNo, align: 'center', bold: true },
          { val: r.code8D, align: 'center' },
          { val: getDesc(r.code8D), align: 'center' },
          { val: r.qty, align: 'center', format: '#,##0' },
          ...(hideCarton ? [] : [{ val: r.totalCarton, align: 'center', format: '#,##0' }]),
          { val: showWeight, align: 'center', format: '0.0' },
          { val: showLength, align: 'center' },
          { val: showWidth, align: 'center' },
          { val: showHeight, align: 'center' },
        ];

        cellConfigs.forEach((c, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.value = c.val === undefined || c.val === null ? '' : c.val;
          cell.font = { name: 'Aptos Display', size: 11, bold: !!c.bold, family: 2 };
          if (c.format && c.val !== '') cell.numFmt = c.format;
          cell.alignment = { vertical: 'middle', horizontal: c.align };
          cell.border = thinBorder;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        });

        currentRowIdx++;
      });

      // Execute vertical merges for this package group if > 1 model row
      if (isMulti && !isTemplate) {
        // 1. Merge SKID NO. (Col 1)
        worksheet.mergeCells(pkg.startRow, 1, pkg.endRow, 1);
        worksheet.getCell(pkg.startRow, 1).alignment = { vertical: 'middle', horizontal: 'center' };

        const weightCol = hideCarton ? 5 : 6;
        const lengthCol = hideCarton ? 6 : 7;
        const widthCol = hideCarton ? 7 : 8;
        const heightCol = hideCarton ? 8 : 9;

        // 2. Merge Dimensions (L, W, H)
        worksheet.mergeCells(pkg.startRow, lengthCol, pkg.endRow, lengthCol);
        worksheet.getCell(pkg.startRow, lengthCol).alignment = { vertical: 'middle', horizontal: 'center' };

        worksheet.mergeCells(pkg.startRow, widthCol, pkg.endRow, widthCol);
        worksheet.getCell(pkg.startRow, widthCol).alignment = { vertical: 'middle', horizontal: 'center' };

        worksheet.mergeCells(pkg.startRow, heightCol, pkg.endRow, heightCol);
        worksheet.getCell(pkg.startRow, heightCol).alignment = { vertical: 'middle', horizontal: 'center' };

        // 3. Merge Weight if single package-level weight
        if (shouldMergeWeight) {
          worksheet.mergeCells(pkg.startRow, weightCol, pkg.endRow, weightCol);
          worksheet.getCell(pkg.startRow, weightCol).alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }
    });

    // Pre-compute summary so totals row formula cells have pre-calculated results for viewers that don't auto-calculate
    const summary = (!isTemplate && displayRows.length > 0) ? computeSummary(displayRows) : null;

    // Totals Row
    const startRowNumber = 5;
    const endRowNumber = currentRowIdx - 1;

    if (displayRows.length > 0) {
      const totalRow = worksheet.getRow(currentRowIdx);
      totalRow.height = 26;
      const totalCols = hideCarton ? 8 : 9;

      for (let colIdx = 1; colIdx <= totalCols; colIdx++) {
        const cell = totalRow.getCell(colIdx);
        cell.font = { name: 'Aptos Display', size: 10, bold: true, color: { argb: 'FF0F172A' }, family: 2 };
        cell.border = totalsBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };

        if (colIdx === 1) {
          cell.value = 'TOTALS';
        } else if (colIdx === 2 || colIdx === 3) {
          cell.value = '-';
        } else if (colIdx === 4 && !isTemplate) {
          cell.value = {
            formula: `SUM(D${startRowNumber}:D${endRowNumber})`,
            result: summary ? summary.totalQty : undefined,
          };
          cell.numFmt = '#,##0';
        } else if (!hideCarton && colIdx === 5 && !isTemplate) {
          cell.value = {
            formula: `SUM(E${startRowNumber}:E${endRowNumber})`,
            result: summary ? summary.totalCartons : undefined,
          };
          cell.numFmt = '#,##0';
        } else if (!hideCarton && colIdx === 6 && !isTemplate) {
          cell.value = {
            formula: `SUM(F${startRowNumber}:F${endRowNumber})`,
            result: summary ? summary.grossWeight : undefined,
          };
          cell.numFmt = '0.0';
        } else if (hideCarton && colIdx === 5 && !isTemplate) {
          cell.value = {
            formula: `SUM(E${startRowNumber}:E${endRowNumber})`,
            result: summary ? summary.grossWeight : undefined,
          };
          cell.numFmt = '0.0';
        } else {
          cell.value = '';
        }
      }

      currentRowIdx++;
    }

    // Summary Section
    if (!isTemplate && displayRows.length > 0 && summary) {

      currentRowIdx += 1;

      const summaryHeaderRow = worksheet.getRow(currentRowIdx);
      summaryHeaderRow.height = 24;
      const summaryHeaderRange = `A${currentRowIdx}:E${currentRowIdx}`;
      worksheet.mergeCells(summaryHeaderRange);
      const summaryHeaderCell = worksheet.getCell(`A${currentRowIdx}`);
      summaryHeaderCell.value = 'SUMMARY';
      summaryHeaderCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      summaryHeaderCell.alignment = { vertical: 'middle', horizontal: 'left' };
      const summaryColsCount = 5;
      for (let colIdx = 1; colIdx <= summaryColsCount; colIdx++) {
        const cell = summaryHeaderRow.getCell(colIdx);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
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
        { label: 'Total Quantity', value: summary.totalQty, format: '#,##0' }
      );
      if (!hideCarton) {
        summaryEntries.push(
          { label: 'Total Cartons', value: summary.totalCartons, format: '#,##0' }
        );
      }
      summaryEntries.push(
        { label: 'Gross Weight (kg)', value: summary.grossWeight, format: '#,##0.0' },
        { label: 'Total CBM (m³)', value: summary.totalCbm, format: '0.000' }
      );

      summaryEntries.forEach((entry, idx) => {
        const row = worksheet.getRow(currentRowIdx);
        row.height = 20;
        const rowBg = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

        worksheet.mergeCells(`A${currentRowIdx}:C${currentRowIdx}`);
        const labelCell = worksheet.getCell(`A${currentRowIdx}`);
        labelCell.value = entry.label;
        labelCell.font = { name: 'Aptos Narrow', size: 11, bold: true, color: { argb: 'FF0F172A' }, family: 2 };
        labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

        worksheet.mergeCells(`D${currentRowIdx}:E${currentRowIdx}`);
        const valueCell = worksheet.getCell(`D${currentRowIdx}`);
        valueCell.value = entry.value;
        if (entry.format) valueCell.numFmt = entry.format;
        valueCell.font = { name: 'Aptos Narrow', size: 11, bold: true, color: { argb: 'FF0F172A' }, family: 2 };
        valueCell.alignment = { vertical: 'middle', horizontal: 'right' };

        for (let colIdx = 1; colIdx <= summaryColsCount; colIdx++) {
          const cell = row.getCell(colIdx);
          cell.border = thinBorder;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        }

        currentRowIdx++;
      });
    }

    // Footer Spacing & Signatures Row
    currentRowIdx += 2;
    const sigRow = worksheet.getRow(currentRowIdx);
    sigRow.height = 28;

    worksheet.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`);
    const packCell = worksheet.getCell(`A${currentRowIdx}`);
    packCell.value = `Pack By: ${header.packBy || '___________________________'}`;
    packCell.font = { name: 'Aptos', size: 11, bold: true };
    packCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const endSigCol = hideCarton ? `H${currentRowIdx}` : `I${currentRowIdx}`;
    worksheet.mergeCells(`E${currentRowIdx}:${endSigCol}`);
    const appCell = worksheet.getCell(`E${currentRowIdx}`);
    appCell.value = `Approved By (Area PIC): ${header.approvedBy || '___________________________'}`;
    appCell.font = { name: 'Aptos', size: 11, bold: true };
    appCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Column widths matching manual reference formatting
    const targetWidths = hideCarton ? baseWidthsHideCarton : baseWidthsStandard;
    const totalColsToFit = hideCarton ? 8 : 9;
    for (let colIdx = 1; colIdx <= totalColsToFit; colIdx++) {
      const column = worksheet.getColumn(colIdx);
      column.width = targetWidths[colIdx - 1] || 16;
    }
  }

  function populateSimplifiedWorksheet(worksheet, header, items, options) {
    worksheet.views = [{ showGridLines: false }];
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
    titleCell.font = { name: 'Aptos', size: 14, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells('D1:E1');
    const shipByCell = worksheet.getCell('D1');
    const shipByValue = header.shipBy === 'OTHER' && header.customShipBy ? header.customShipBy : header.shipBy;
    shipByCell.value = `SHIP BY: ${shipByValue || 'FCL/LCL/AIR'}`;
    shipByCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    shipByCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const metaRow = worksheet.getRow(2);
    metaRow.height = 24;

    worksheet.mergeCells('A2:B2');
    const doCell = worksheet.getCell('A2');
    doCell.value = `D.O. NO: ${header.doNo || '________________'}`;
    doCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    doCell.alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells('C2:D2');
    const destCell = worksheet.getCell('C2');
    destCell.value = `Destination: ${header.destination || '________________'}`;
    destCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    destCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const dateCell = worksheet.getCell('E2');
    dateCell.value = `Date: ${header.date || ''}`;
    dateCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    dateCell.alignment = { vertical: 'middle', horizontal: 'right' };

    worksheet.getRow(3).height = 10;

    const filtered = items.filter(
      (item) => item.skidNo || item.weightKg !== '' || item.lengthCm !== '' || item.widthCm !== '' || item.heightCm !== ''
    );
    const activeList = filtered.length > 0 ? filtered : items;

    // Group contiguous rows into physical package units for simplified view
    const displayRows = [];
    let currentPkg = null;

    activeList.forEach((item, idx) => {
      const trimmedSkid = (item.skidNo || '').trim();
      const isNew =
        idx === 0 ||
        (trimmedSkid !== '' && currentPkg && trimmedSkid.toUpperCase() !== currentPkg.skidNo.toUpperCase());

      if (isNew) {
        currentPkg = {
          skidNo: trimmedSkid,
          weightKg: item.weightKg !== '' ? Number(item.weightKg) : '',
          lengthCm: item.lengthCm !== '' ? Number(item.lengthCm) : '',
          widthCm: item.widthCm !== '' ? Number(item.widthCm) : '',
          heightCm: item.heightCm !== '' ? Number(item.heightCm) : '',
          qty: item.qty !== '' ? Number(item.qty) : '',
          totalCarton: item.totalCarton !== '' ? Number(item.totalCarton) : '',
        };
        displayRows.push(currentPkg);
      } else {
        if (!currentPkg.skidNo && trimmedSkid) currentPkg.skidNo = trimmedSkid;
        if (currentPkg.weightKg === '' && item.weightKg !== '') currentPkg.weightKg = Number(item.weightKg);
        if (currentPkg.lengthCm === '' && item.lengthCm !== '') currentPkg.lengthCm = Number(item.lengthCm);
        if (currentPkg.widthCm === '' && item.widthCm !== '') currentPkg.widthCm = Number(item.widthCm);
        if (currentPkg.heightCm === '' && item.heightCm !== '') currentPkg.heightCm = Number(item.heightCm);
        if (item.qty !== '') currentPkg.qty = (Number(currentPkg.qty) || 0) + Number(item.qty);
        if (item.totalCarton !== '') currentPkg.totalCarton = (Number(currentPkg.totalCarton) || 0) + Number(item.totalCarton);
      }
    });

    const unitInfo = getPackageUnitLabel(displayRows.length > 0 ? displayRows : items);

    const headerRow = worksheet.getRow(4);
    headerRow.height = 32;

    const headers = [
      unitInfo.columnHeader, 'Weight (B) (CM)', 'Length (P) (CM)', 'Width (L) (CM)', 'Height (T) (CM)'
    ];

    headers.forEach((hText, colIdx) => {
      const cell = headerRow.getCell(colIdx + 1);
      cell.value = hText;
      cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FFB30000' } },
        left: { style: 'thin', color: { argb: 'FFCC0000' } },
        bottom: { style: 'medium', color: { argb: 'FFB30000' } },
        right: { style: 'thin', color: { argb: 'FFCC0000' } },
      };
    });

    let currentRowIdx = 5;
    displayRows.forEach((r, index) => {
      const row = worksheet.getRow(currentRowIdx);
      row.height = 22;
      const rowBg = index % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

      const cellConfigs = [
        { val: r.skidNo, align: 'center', bold: true },
        { val: r.weightKg, align: 'center', format: '0.0' },
        { val: r.lengthCm, align: 'center' },
        { val: r.widthCm, align: 'center' },
        { val: r.heightCm, align: 'center' },
      ];

      cellConfigs.forEach((c, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = c.val === undefined || c.val === null ? '' : c.val;
        cell.font = { name: 'Aptos Display', size: 11, bold: !!c.bold, family: 2 };
        if (c.format && c.val !== '') cell.numFmt = c.format;
        cell.alignment = { vertical: 'middle', horizontal: c.align };
        cell.border = thinBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      });
      currentRowIdx++;
    });

    // Summary Section
    if (displayRows.length > 0) {
      const standardFiltered = items.filter(
        (item) => item.skidNo || item.code8D || item.qty !== '' || item.totalCarton !== '' || item.weightKg !== ''
      );
      const summaryItems = standardFiltered.length > 0 ? standardFiltered : items;
      const summary = computeSummary(summaryItems);

      // Fallback: If totalQty is 0 and lookupDb is provided, cross-reference lookup DB for this DO
      if (summary.totalQty === 0 && options && options.lookupDb && header.doNo && window.LookupParser) {
        const doMatches = window.LookupParser.findMatchesForDo(options.lookupDb, header.doNo, header.customer);
        if (doMatches.length > 0) {
          const lookupTotalQty = doMatches.reduce((acc, m) => acc + toNum(m.qty), 0);
          if (lookupTotalQty > 0) summary.totalQty = lookupTotalQty;
        }
      }

      currentRowIdx += 1; // leave a blank row

      // SUMMARY header
      const summaryHeaderRow = worksheet.getRow(currentRowIdx);
      summaryHeaderRow.height = 24;
      worksheet.mergeCells(`A${currentRowIdx}:E${currentRowIdx}`);
      const summaryHeaderCell = worksheet.getCell(`A${currentRowIdx}`);
      summaryHeaderCell.value = 'SUMMARY';
      summaryHeaderCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      summaryHeaderCell.alignment = { vertical: 'middle', horizontal: 'left' };
      for (let colIdx = 1; colIdx <= 5; colIdx++) {
        const cell = summaryHeaderRow.getCell(colIdx);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
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
        
        worksheet.mergeCells(`A${currentRowIdx}:C${currentRowIdx}`);
        const labelCell = worksheet.getCell(`A${currentRowIdx}`);
        labelCell.value = entry.label;
        labelCell.font = { name: 'Aptos Narrow', size: 11, bold: true, color: { argb: 'FF0F172A' }, family: 2 };
        labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
        
        worksheet.mergeCells(`D${currentRowIdx}:E${currentRowIdx}`);
        const valueCell = worksheet.getCell(`D${currentRowIdx}`);
        valueCell.value = entry.value;
        if (entry.format) valueCell.numFmt = entry.format;
        valueCell.font = { name: 'Aptos Narrow', size: 11, bold: true, color: { argb: 'FF0F172A' }, family: 2 };
        valueCell.alignment = { vertical: 'middle', horizontal: 'right' };

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

    worksheet.mergeCells(`A${currentRowIdx}:B${currentRowIdx}`);
    const packCell = worksheet.getCell(`A${currentRowIdx}`);
    packCell.value = `Pack By: ${header.packBy || '___________________________'}`;
    packCell.font = { name: 'Aptos', size: 11, bold: true };
    packCell.alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells(`C${currentRowIdx}:E${currentRowIdx}`);
    const appCell = worksheet.getCell(`C${currentRowIdx}`);
    appCell.value = `Approved By (Area PIC): ${header.approvedBy || '___________________________'}`;
    appCell.font = { name: 'Aptos', size: 11, bold: true };
    appCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Column widths matching reference
    const targetSimplifiedWidths = [16, 17, 17, 16, 17];
    for (let colIdx = 1; colIdx <= 5; colIdx++) {
      const column = worksheet.getColumn(colIdx);
      column.width = targetSimplifiedWidths[colIdx - 1];
    }
  }

  function sanitizeSheetName(rawName, existingNames) {
    let name = rawName.replace(/[\\/?*:[\]]/g, '_').trim() || 'DO Sheet';
    if (name.length > 31) name = name.substring(0, 31).trim();
    let finalName = name;
    let counter = 1;
    while (existingNames.has(finalName.toUpperCase())) {
      const suffix = ` (${counter})`;
      const maxBaseLen = 31 - suffix.length;
      finalName = name.substring(0, maxBaseLen).trim() + suffix;
      counter++;
    }
    existingNames.add(finalName.toUpperCase());
    return finalName;
  }

  async function exportToExcel(header, items, fileName, options) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Packing Details Sheet Converter';
    workbook.created = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    const worksheet = workbook.addWorksheet('Packing Details Sheet', {
      views: [{ showGridLines: false }],
    });

    if (options && options.isSimplified) {
      populateSimplifiedWorksheet(worksheet, header, items, options);
    } else {
      populateWorksheet(worksheet, header, items, options);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    let defaultName = 'Packing_Details_Sheet.xlsx';
    if (options && options.isHandwrittenTemplate) {
      defaultName = header.doNo
        ? `Packing_Details_Handwritten_Template_${header.doNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`
        : 'Packing_Details_Handwritten_Template.xlsx';
    } else if (header.doNo) {
      defaultName = `Packing_Details_${header.doNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    }

    link.download = fileName || defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function exportBulkSummaryToExcel(doSheets, fileName, options) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Packing Details Sheet Converter';
    workbook.created = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    const existingSheetNames = new Set();

    doSheets.forEach((sheet) => {
      const rawName = sheet.header.doNo || 'DO Sheet';
      const sheetName = sanitizeSheetName(rawName, existingSheetNames);
      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: false }],
      });
      if (options && options.isSimplified) {
        populateSimplifiedWorksheet(worksheet, sheet.header, sheet.items, options);
      } else {
        populateWorksheet(worksheet, sheet.header, sheet.items, options);
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    link.download = fileName || 'Bulk_Packing_Details_Summary.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Quote a CSV value if it contains commas, quotes, or line breaks (RFC 4180).
  function escapeCsvValue(val) {
    if (val === undefined || val === null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function exportToCSV(header, items, fileName, options) {
    const isSsea = (header.customer || 'SSEA') !== 'MSCSJ';
    const hideCarton = Boolean(options && (options.hideTotalCarton || (options.hideSseaTotalCarton && isSsea)));

    const filteredItems = items.filter((item) => item.skidNo || item.code8D || item.qty !== '');
    const displayItems = filteredItems.length > 0 ? filteredItems : items;
    const unitInfo = getPackageUnitLabel(displayItems);

    const lookupDb = options && options.lookupDb ? options.lookupDb : [];
    const getDesc = (code) => {
      if (!code) return '';
      const match = lookupDb.find(e => e.code8D.toLowerCase() === String(code).trim().toLowerCase());
      return match ? (match.description || '') : '';
    };

    const headers = hideCarton
      ? [
          'D.O. NO', 'Destination', 'Ship By', unitInfo.columnHeader, 'PRODUCT CODE', 'PRODUCT DESCRIPTION',
          'Qty', 'Weight (B) (CM)', 'Length (P) (CM)', 'Width (L) (CM)',
          'Height (T) (CM)', 'Pack By', 'Approved By',
        ]
      : [
          'D.O. NO', 'Destination', 'Ship By', unitInfo.columnHeader, 'PRODUCT CODE', 'PRODUCT DESCRIPTION',
          'Qty', 'Total Carton', 'Weight (B) (CM)', 'Length (P) (CM)', 'Width (L) (CM)',
          'Height (T) (CM)', 'Pack By', 'Approved By',
        ];

    const rows = displayItems.map((item) => {
      if (hideCarton) {
        return [
          header.doNo, header.destination, header.shipBy, item.skidNo, item.code8D, getDesc(item.code8D),
          item.qty, item.weightKg, item.lengthCm, item.widthCm,
          item.heightCm, header.packBy, header.approvedBy,
        ];
      }
      return [
        header.doNo, header.destination, header.shipBy, item.skidNo, item.code8D, getDesc(item.code8D),
        item.qty, item.totalCarton, item.weightKg, item.lengthCm, item.widthCm,
        item.heightCm, header.packBy, header.approvedBy,
      ];
    });

    const summary = computeSummary(displayItems);
    rows.push([]);
    rows.push(['SUMMARY']);
    if (summary.totalSkids > 0 && summary.totalBoxes > 0) {
      rows.push(['Total Skids', summary.totalSkids]);
      rows.push(['Total Boxes', summary.totalBoxes]);
    } else if (summary.totalBoxes > 0 && summary.totalSkids === 0) {
      rows.push(['Total Boxes', summary.totalBoxes]);
    } else {
      rows.push(['Total Skids', summary.totalSkids]);
    }
    rows.push(['Total Quantity', summary.totalQty]);
    if (!hideCarton) {
      rows.push(['Total Cartons', summary.totalCartons]);
    }
    rows.push(['Gross Weight (kg)', summary.grossWeight.toFixed(1)]);
    rows.push(['Total CBM (m³)', summary.totalCbm.toFixed(3)]);

    const csvBody = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((e) => e.map(escapeCsvValue).join(',')),
    ].join('\n');

    // encodeURIComponent (not encodeURI) so characters like '#', ',', and
    // newlines are properly encoded inside the data URI.
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvBody);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName || `Packing_Details_${header.doNo || 'Export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  window.ExcelExport = {
    getPackageUnitLabel,
    computeSummary,
    populateWorksheet,
    populateSimplifiedWorksheet,
    exportToExcel,
    exportBulkSummaryToExcel,
    exportToCSV,
  };
})();
