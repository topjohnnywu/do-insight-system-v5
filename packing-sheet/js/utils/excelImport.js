/* Generic packing-sheet Excel import (classic script → window.ExcelImport). Verbatim logic. */
(function () {
  const XLSX = window.XLSX;

  function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const buffer = e.target && e.target.result;
          if (!buffer) throw new Error('Failed to read file buffer');

          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          const items = [];
          let headerData = {};

          jsonRows.forEach((row) => {
            const rowText = row.join(' ').toLowerCase();

            if (rowText.includes('d.o. no:')) {
              const matchDo = row.find((cell) => String(cell).toLowerCase().includes('d.o. no:'));
              if (matchDo) {
                const val = String(matchDo).split('D.O. NO:')[1];
                if (val && val.trim()) headerData.doNo = val.trim();
              }
            }
            if (rowText.includes('destination:')) {
              const matchDest = row.find((cell) => String(cell).toLowerCase().includes('destination:'));
              if (matchDest) {
                const val = String(matchDest).split('Destination:')[1];
                if (val && val.trim()) headerData.destination = val.trim();
              }
            }
            if (rowText.includes('ship by:')) {
              if (rowText.includes('lcl')) headerData.shipBy = 'LCL';
              else if (rowText.includes('air')) headerData.shipBy = 'AIR';
            }
          });

          let tableHeaderIdx = -1;
          for (let i = 0; i < jsonRows.length; i++) {
            const rowStr = jsonRows[i].join(' ').toLowerCase();
            if (
              rowStr.includes('skid') ||
              rowStr.includes('8d code') ||
              rowStr.includes('product code') ||
              rowStr.includes('weight')
            ) {
              tableHeaderIdx = i;
              break;
            }
          }

          const startIdx = tableHeaderIdx !== -1 ? tableHeaderIdx + 1 : 0;

          for (let i = startIdx; i < jsonRows.length; i++) {
            const row = jsonRows[i];
            if (!row || row.length === 0) continue;

            const col0 = String(row[0] || '').trim();
            const col0Upper = col0.toUpperCase();
            if (col0Upper.includes('SUMMARY')) {
              break;
            }
            if (
              col0Upper.includes('TOTAL') ||
              col0Upper.includes('PACK BY') ||
              col0Upper.includes('GROSS WEIGHT') ||
              col0Upper.includes('APPROVED BY')
            ) {
              continue;
            }

            if (row.some((cell) => cell !== '' && cell !== null && cell !== undefined)) {
              const qtyVal = row[2] !== '' && row[2] !== undefined ? Number(row[2]) : '';
              const cartonVal = row[3] !== '' && row[3] !== undefined ? Number(row[3]) : '';
              const weight = row[4] !== '' && row[4] !== undefined ? Number(row[4]) : '';
              const length = row[5] !== '' && row[5] !== undefined ? Number(row[5]) : '';
              const width = row[6] !== '' && row[6] !== undefined ? Number(row[6]) : '';
              const height = row[7] !== '' && row[7] !== undefined ? Number(row[7]) : '';

              items.push({
                id: `imported-${Date.now()}-${i}`,
                skidNo: String(row[0] || '').trim(),
                code8D: String(row[1] || '').trim(),
                qty: isNaN(qtyVal) ? '' : qtyVal,
                totalCarton: isNaN(cartonVal) ? '' : cartonVal,
                weightKg: isNaN(weight) ? '' : weight,
                lengthCm: isNaN(length) ? '' : length,
                widthCm: isNaN(width) ? '' : width,
                heightCm: isNaN(height) ? '' : height,
              });
            }
          }

          resolve({
            header: headerData,
            items: items.length > 0 ? items : [],
            fileName: file.name,
          });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  window.ExcelImport = { parseExcelFile };
})();
