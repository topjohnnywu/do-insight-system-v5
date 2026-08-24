/* Packing-sheet file parser (classic script → window.PackingImport). Verbatim logic, global XLSX. */
(function () {
  const XLSX = window.XLSX;

  function parseNumber(val) {
    if (val === undefined || val === null || val === '') return '';
    const num = parseFloat(String(val));
    return isNaN(num) ? '' : num;
  }

  function parsePackingSheetFile(file) {
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
            if (rowText.includes('date:')) {
              const matchDate = row.find((cell) => String(cell).toLowerCase().includes('date:'));
              if (matchDate) {
                const val = String(matchDate).split('Date:')[1];
                if (val && val.trim()) headerData.date = val.trim();
              }
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

            const firstCell = String(row[0] || '').trim();
            if (!firstCell || firstCell.toLowerCase().includes('total')) continue;

            const isSkidRow = /^(skid|box)/i.test(firstCell);
            if (!isSkidRow && row.length < 3) continue;

            const item = {
              id: `imported-${Date.now()}-${i}`,
              skidNo: firstCell || `SKID-${(items.length + 1).toString().padStart(2, '0')}`,
              code8D: String(row[1] || '').trim(),
              qty: parseNumber(row[2]),
              totalCarton: parseNumber(row[3]),
              weightKg: parseNumber(row[4]),
              lengthCm: parseNumber(row[5]),
              widthCm: parseNumber(row[6]),
              heightCm: parseNumber(row[7]),
            };

            if (item.code8D || item.qty !== '') {
              items.push(item);
            }
          }

          resolve({ header: headerData, items, fileName: file.name });
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to parse packing sheet'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  function isValidPackingSheet(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    return ext === 'xlsx' || ext === 'xls' || ext === 'csv';
  }

  window.PackingImport = { parsePackingSheetFile, isValidPackingSheet };
})();
