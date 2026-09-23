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
    if (typeof window.evaluateMathExpression === 'function') {
      const evalVal = window.evaluateMathExpression(val);
      if (typeof evalVal === 'number' && !isNaN(evalVal)) return evalVal;
    }
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

  function colLetter(colIdx) {
    let temp = colIdx;
    let letter = '';
    while (temp > 0) {
      let rem = (temp - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      temp = Math.floor((temp - 1) / 26);
    }
    return letter;
  }

  function populateWorksheet(worksheet, header, items, options) {
    worksheet.views = [{ showGridLines: false }];
    const hideCarton = Boolean(options && options.hideTotalCarton);
    const hideCols = options && options.hideColumns ? options.hideColumns : {};

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

    // Build list of active columns (omitted columns are completely excluded from the Excel file)
    const activeCols = [];
    activeCols.push({ id: 'skidNo', header: unitInfo.columnHeader, width: 16, align: 'center', bold: true });
    if (!hideCols.productCode) {
      activeCols.push({ id: 'productCode', header: 'PRODUCT CODE', width: 16, align: 'center' });
    }
    if (!hideCols.productDescription) {
      activeCols.push({ id: 'productDescription', header: 'PRODUCT DESCRIPTION', width: 22, align: 'center' });
    }
    if (!hideCols.totalQuantity) {
      activeCols.push({ id: 'qty', header: 'Qty', width: 12, align: 'center', format: '#,##0' });
    }
    if (!hideCarton && !hideCols.totalCarton) {
      activeCols.push({ id: 'totalCarton', header: 'Total Carton', width: 14, align: 'center', format: '#,##0' });
    }
    activeCols.push({ id: 'weightKg', header: 'Weight (B) (CM)', width: 17, align: 'center', format: '0.0' });
    activeCols.push({ id: 'lengthCm', header: 'Length (P) (CM)', width: 17, align: 'center' });
    activeCols.push({ id: 'widthCm', header: 'Width (L) (CM)', width: 16, align: 'center' });
    activeCols.push({ id: 'heightCm', header: 'Height (T) (CM)', width: 17, align: 'center' });

    const numCols = activeCols.length;
    worksheet.columns = activeCols.map((c) => ({ width: c.width }));

    // Row 1: Title and Ship By
    const titleRow = worksheet.getRow(1);
    titleRow.height = 32;

    const shipByValue =
      header.shipBy === 'OTHER' && header.customShipBy ? header.customShipBy : header.shipBy;

    const shipByCols = numCols >= 8 ? 3 : 2;
    const titleEndColIdx = Math.max(1, numCols - shipByCols);
    const shipByStartColIdx = titleEndColIdx + 1;

    if (titleEndColIdx > 1) {
      worksheet.mergeCells(`A1:${colLetter(titleEndColIdx)}1`);
    }
    const titleCell = worksheet.getCell('A1');
    titleCell.value = options && options.isHandwrittenTemplate
      ? 'PACKING DETAILS SHEET (HANDWRITTEN TEMPLATE)'
      : 'PACKING DETAILS SHEET';
    titleCell.font = { name: 'Aptos', size: 16, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const shipByStartCellKey = `${colLetter(shipByStartColIdx)}1`;
    if (numCols > shipByStartColIdx) {
      worksheet.mergeCells(`${shipByStartCellKey}:${colLetter(numCols)}1`);
    }
    const shipByCell = worksheet.getCell(shipByStartCellKey);
    shipByCell.value = `SHIP BY: ${shipByValue || 'FCL/LCL/AIR'}`;
    shipByCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    shipByCell.alignment = { vertical: 'middle', horizontal: 'right' };

    // Row 2: Metadata (DO NO, Destination, Date)
    const metaRow = worksheet.getRow(2);
    metaRow.height = 24;

    const dateCols = numCols >= 9 ? 3 : 2;
    const dateStartColIdx = Math.max(3, numCols - dateCols + 1);
    const rem = dateStartColIdx - 1;
    const doCols = Math.max(1, Math.floor(rem / 2));
    const destCols = rem - doCols;

    const doEndColIdx = doCols;
    const destStartColIdx = doEndColIdx + 1;
    const destEndColIdx = rem;

    if (doEndColIdx > 1) {
      worksheet.mergeCells(`A2:${colLetter(doEndColIdx)}2`);
    }
    const doCell = worksheet.getCell('A2');
    doCell.value = `D.O. NO: ${header.doNo || '________________'}`;
    doCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    doCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const destStartCellKey = `${colLetter(destStartColIdx)}2`;
    if (destEndColIdx > destStartColIdx) {
      worksheet.mergeCells(`${destStartCellKey}:${colLetter(destEndColIdx)}2`);
    }
    const destCell = worksheet.getCell(destStartCellKey);
    destCell.value = `Destination: ${header.destination || '________________'}`;
    destCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    destCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const dateStartCellKey = `${colLetter(dateStartColIdx)}2`;
    if (numCols > dateStartColIdx) {
      worksheet.mergeCells(`${dateStartCellKey}:${colLetter(numCols)}2`);
    }
    const dateCell = worksheet.getCell(dateStartCellKey);
    dateCell.value = `Date: ${header.date || ''}`;
    dateCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    dateCell.alignment = { vertical: 'middle', horizontal: 'right' };

    worksheet.getRow(3).height = 10;

    // Row 4: Column Headers
    const headerRow = worksheet.getRow(4);
    headerRow.height = 32;

    const lookupDb = options && options.lookupDb ? options.lookupDb : [];
    const getDesc = (code) => {
      if (!code) return '';
      const match = lookupDb.find((e) => e.code8D.toLowerCase() === String(code).trim().toLowerCase());
      return match ? (match.description || '') : '';
    };

    activeCols.forEach((col, colIdx) => {
      const cell = headerRow.getCell(colIdx + 1);
      cell.value = col.header;
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

        const showSkidNo = rowSubIdx === 0 ? pkg.skidNo : '';
        const showLength = rowSubIdx === 0 ? r.lengthCm : (isMulti ? '' : r.lengthCm);
        const showWidth = rowSubIdx === 0 ? r.widthCm : (isMulti ? '' : r.widthCm);
        const showHeight = rowSubIdx === 0 ? r.heightCm : (isMulti ? '' : r.heightCm);

        let showWeight = r.weightKg;
        if (isMulti && shouldMergeWeight) {
          showWeight = rowSubIdx === 0 ? (nonZeroWeights[0] ? nonZeroWeights[0].weightKg : r.weightKg) : '';
        }

        activeCols.forEach((col, colIdx) => {
          let val = '';
          if (col.id === 'skidNo') val = showSkidNo;
          else if (col.id === 'productCode') val = r.code8D || '';
          else if (col.id === 'productDescription') val = getDesc(r.code8D);
          else if (col.id === 'qty') val = r.qty;
          else if (col.id === 'totalCarton') val = r.totalCarton;
          else if (col.id === 'weightKg') val = showWeight;
          else if (col.id === 'lengthCm') val = showLength;
          else if (col.id === 'widthCm') val = showWidth;
          else if (col.id === 'heightCm') val = showHeight;

          const cell = row.getCell(colIdx + 1);
          cell.value = val === undefined || val === null ? '' : val;
          cell.font = { name: 'Aptos Display', size: 11, bold: !!col.bold, family: 2 };
          if (col.format && val !== '') cell.numFmt = col.format;
          cell.alignment = { vertical: 'middle', horizontal: col.align || 'center' };
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

        // 2. Merge Dimensions (L, W, H)
        const lengthColIdx = activeCols.findIndex((c) => c.id === 'lengthCm') + 1;
        const widthColIdx = activeCols.findIndex((c) => c.id === 'widthCm') + 1;
        const heightColIdx = activeCols.findIndex((c) => c.id === 'heightCm') + 1;

        if (lengthColIdx > 0) {
          worksheet.mergeCells(pkg.startRow, lengthColIdx, pkg.endRow, lengthColIdx);
          worksheet.getCell(pkg.startRow, lengthColIdx).alignment = { vertical: 'middle', horizontal: 'center' };
        }
        if (widthColIdx > 0) {
          worksheet.mergeCells(pkg.startRow, widthColIdx, pkg.endRow, widthColIdx);
          worksheet.getCell(pkg.startRow, widthColIdx).alignment = { vertical: 'middle', horizontal: 'center' };
        }
        if (heightColIdx > 0) {
          worksheet.mergeCells(pkg.startRow, heightColIdx, pkg.endRow, heightColIdx);
          worksheet.getCell(pkg.startRow, heightColIdx).alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // 3. Merge Weight if single package-level weight
        if (shouldMergeWeight) {
          const weightColIdx = activeCols.findIndex((c) => c.id === 'weightKg') + 1;
          if (weightColIdx > 0) {
            worksheet.mergeCells(pkg.startRow, weightColIdx, pkg.endRow, weightColIdx);
            worksheet.getCell(pkg.startRow, weightColIdx).alignment = { vertical: 'middle', horizontal: 'center' };
          }
        }
      }
    });

    // Summary calculation
    const summary = (!isTemplate && displayRows.length > 0) ? computeSummary(displayRows) : null;

    // Totals Row
    const startRowNumber = 5;
    const endRowNumber = currentRowIdx - 1;

    if (displayRows.length > 0) {
      const totalRow = worksheet.getRow(currentRowIdx);
      totalRow.height = 26;

      activeCols.forEach((col, colIdx) => {
        const cell = totalRow.getCell(colIdx + 1);
        const colNumber = colIdx + 1;
        const colLet = colLetter(colNumber);

        cell.font = { name: 'Aptos Display', size: 10, bold: true, color: { argb: 'FF0F172A' }, family: 2 };
        cell.border = totalsBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };

        if (col.id === 'skidNo') {
          cell.value = 'TOTALS';
        } else if (col.id === 'productCode' || col.id === 'productDescription') {
          cell.value = '-';
        } else if (col.id === 'qty' && !isTemplate) {
          cell.value = {
            formula: `SUM(${colLet}${startRowNumber}:${colLet}${endRowNumber})`,
            result: summary ? summary.totalQty : undefined,
          };
          cell.numFmt = '#,##0';
        } else if (col.id === 'totalCarton' && !isTemplate) {
          cell.value = {
            formula: `SUM(${colLet}${startRowNumber}:${colLet}${endRowNumber})`,
            result: summary ? summary.totalCartons : undefined,
          };
          cell.numFmt = '#,##0';
        } else if (col.id === 'weightKg' && !isTemplate) {
          cell.value = {
            formula: `SUM(${colLet}${startRowNumber}:${colLet}${endRowNumber})`,
            result: summary ? summary.grossWeight : undefined,
          };
          cell.numFmt = '0.0';
        } else {
          cell.value = '';
        }
      });

      currentRowIdx++;
    }

    // Summary Section
    if (!isTemplate && displayRows.length > 0 && summary) {
      currentRowIdx += 1;

      const summaryColsCount = Math.min(numCols, 5);
      const shouldMergeVal = summaryColsCount >= 5;
      const labelEndCol = shouldMergeVal ? 3 : Math.max(1, summaryColsCount - 1);
      const valStartCol = labelEndCol + 1;

      const summaryHeaderRow = worksheet.getRow(currentRowIdx);
      summaryHeaderRow.height = 24;
      const summaryHeaderEndColLetter = colLetter(summaryColsCount);
      worksheet.mergeCells(`A${currentRowIdx}:${summaryHeaderEndColLetter}${currentRowIdx}`);
      const summaryHeaderCell = worksheet.getCell(`A${currentRowIdx}`);
      summaryHeaderCell.value = 'SUMMARY';
      summaryHeaderCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      summaryHeaderCell.alignment = { vertical: 'middle', horizontal: 'left' };
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

      if (!hideCols.totalQuantity) {
        summaryEntries.push({ label: 'Total Quantity', value: summary.totalQty, format: '#,##0' });
      }
      if (!hideCarton && !hideCols.totalCarton) {
        summaryEntries.push({ label: 'Total Cartons', value: summary.totalCartons, format: '#,##0' });
      }
      summaryEntries.push(
        { label: 'Gross Weight (kg)', value: summary.grossWeight, format: '#,##0.0' },
        { label: 'Total CBM (m³)', value: summary.totalCbm, format: '0.000' }
      );

      summaryEntries.forEach((entry, idx) => {
        const row = worksheet.getRow(currentRowIdx);
        row.height = 20;
        const rowBg = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

        if (labelEndCol > 1) {
          worksheet.mergeCells(`A${currentRowIdx}:${colLetter(labelEndCol)}${currentRowIdx}`);
        }
        const labelCell = worksheet.getCell(`A${currentRowIdx}`);
        labelCell.value = entry.label;
        labelCell.font = { name: 'Aptos Narrow', size: 11, bold: true, color: { argb: 'FF0F172A' }, family: 2 };
        labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

        if (summaryColsCount > valStartCol) {
          worksheet.mergeCells(`${colLetter(valStartCol)}${currentRowIdx}:${colLetter(summaryColsCount)}${currentRowIdx}`);
        }
        const valueCell = worksheet.getCell(`${colLetter(valStartCol)}${currentRowIdx}`);
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

    const packEndColIdx = Math.max(1, Math.floor(numCols / 2));
    const appStartColIdx = packEndColIdx + 1;

    if (packEndColIdx > 1) {
      worksheet.mergeCells(`A${currentRowIdx}:${colLetter(packEndColIdx)}${currentRowIdx}`);
    }
    const packCell = worksheet.getCell(`A${currentRowIdx}`);
    packCell.value = `Pack By: ${header.packBy || '___________________________'}`;
    packCell.font = { name: 'Aptos', size: 11, bold: true };
    packCell.alignment = { vertical: 'middle', horizontal: 'left' };

    if (numCols > appStartColIdx) {
      worksheet.mergeCells(`${colLetter(appStartColIdx)}${currentRowIdx}:${colLetter(numCols)}${currentRowIdx}`);
    }
    const appCell = worksheet.getCell(`${colLetter(appStartColIdx)}${currentRowIdx}`);
    appCell.value = `Approved By (Area PIC): ${header.approvedBy || '___________________________'}`;
    appCell.font = { name: 'Aptos', size: 11, bold: true };
    appCell.alignment = { vertical: 'middle', horizontal: 'left' };
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

    populateWorksheet(worksheet, header, items, options);

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
      populateWorksheet(worksheet, sheet.header, sheet.items, options);
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
    const hideCarton = Boolean(options && (options.hideTotalCarton ));

    const filteredItems = items.filter((item) => item.skidNo || item.code8D || item.qty !== '');
    const displayItems = filteredItems.length > 0 ? filteredItems : items;
    const unitInfo = getPackageUnitLabel(displayItems);

    const lookupDb = options && options.lookupDb ? options.lookupDb : [];
    const getDesc = (code) => {
      if (!code) return '';
      const match = lookupDb.find(e => e.code8D.toLowerCase() === String(code).trim().toLowerCase());
      return match ? (match.description || '') : '';
    };

    const hideCols = options && options.hideColumns ? options.hideColumns : {};
    const colDefs = [
      { id: 'doNo', header: 'D.O. NO', getVal: () => header.doNo },
      { id: 'destination', header: 'Destination', getVal: () => header.destination },
      { id: 'shipBy', header: 'Ship By', getVal: () => header.shipBy },
      { id: 'skidNo', header: unitInfo.columnHeader, getVal: (item) => item.skidNo },
      { id: 'code8D', header: 'PRODUCT CODE', hide: Boolean(hideCols.productCode), getVal: (item) => item.code8D },
      { id: 'desc', header: 'PRODUCT DESCRIPTION', hide: Boolean(hideCols.productDescription), getVal: (item) => getDesc(item.code8D) },
      { id: 'qty', header: 'Qty', hide: Boolean(hideCols.totalQuantity), getVal: (item) => item.qty },
      { id: 'totalCarton', header: 'Total Carton', hide: Boolean(hideCarton || hideCols.totalCarton), getVal: (item) => item.totalCarton },
      { id: 'weightKg', header: 'Weight (B) (CM)', getVal: (item) => item.weightKg },
      { id: 'lengthCm', header: 'Length (P) (CM)', getVal: (item) => item.lengthCm },
      { id: 'widthCm', header: 'Width (L) (CM)', getVal: (item) => item.widthCm },
      { id: 'heightCm', header: 'Height (T) (CM)', getVal: (item) => item.heightCm },
      { id: 'packBy', header: 'Pack By', getVal: () => header.packBy },
      { id: 'approvedBy', header: 'Approved By', getVal: () => header.approvedBy },
    ].filter((c) => !c.hide);

    const headers = colDefs.map((c) => c.header);
    const rows = displayItems.map((item) => colDefs.map((c) => c.getVal(item)));

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
    if (!hideCols.totalQuantity) {
      rows.push(['Total Quantity', summary.totalQty]);
    }
    if (!hideCarton && !hideCols.totalCarton) {
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
    
    exportToExcel,
    exportBulkSummaryToExcel,
    exportToCSV,
  };
})();
