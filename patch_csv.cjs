const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/excelExport.js', 'utf8');

const target = `  function exportToCSV(header, items, fileName) {
    const filteredItems = items.filter((item) => item.skidNo || item.code8D || item.qty !== '');
    const displayItems = filteredItems.length > 0 ? filteredItems : items;
    const unitInfo = getPackageUnitLabel(displayItems);

    const headers = [
      'D.O. NO', 'Destination', 'Ship By', unitInfo.columnHeader, 'PRODUCT CODE',
      'Qty', 'Total Carton', 'Weight (B) (CM)', 'Length (P) (CM)', 'Width (L) (CM)',
      'Height (T) (CM)', 'Pack By', 'Approved By',
    ];

    const rows = displayItems.map((item) => [
      header.doNo, header.destination, header.shipBy, item.skidNo, item.code8D,
      item.qty, item.totalCarton, item.weightKg, item.lengthCm, item.widthCm,
      item.heightCm, header.packBy, header.approvedBy,
    ]);`;

const replacement = `  function exportToCSV(header, items, fileName, options) {
    const filteredItems = items.filter((item) => item.skidNo || item.code8D || item.qty !== '');
    const displayItems = filteredItems.length > 0 ? filteredItems : items;
    const unitInfo = getPackageUnitLabel(displayItems);

    const lookupDb = options && options.lookupDb ? options.lookupDb : [];
    const getDesc = (code) => {
      if (!code) return '';
      const match = lookupDb.find(e => e.code8D.toLowerCase() === String(code).trim().toLowerCase());
      return match ? (match.description || '') : '';
    };

    const headers = [
      'D.O. NO', 'Destination', 'Ship By', unitInfo.columnHeader, 'PRODUCT CODE', 'PRODUCT DESCRIPTION',
      'Qty', 'Total Carton', 'Weight (B) (CM)', 'Length (P) (CM)', 'Width (L) (CM)',
      'Height (T) (CM)', 'Pack By', 'Approved By',
    ];

    const rows = displayItems.map((item) => [
      header.doNo, header.destination, header.shipBy, item.skidNo, item.code8D, getDesc(item.code8D),
      item.qty, item.totalCarton, item.weightKg, item.lengthCm, item.widthCm,
      item.heightCm, header.packBy, header.approvedBy,
    ]);`;

content = content.replace(target, replacement);

fs.writeFileSync('packing-sheet/js/utils/excelExport.js', content);
