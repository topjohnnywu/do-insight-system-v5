const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/excelExport.js', 'utf8');

const target1 = `  async function exportBulkSummaryToExcel(doSheets, fileName) {`;
const replace1 = `  async function exportBulkSummaryToExcel(doSheets, fileName, options) {`;

const target2 = `      populateWorksheet(worksheet, sheet.header, sheet.items);`;
const replace2 = `      populateWorksheet(worksheet, sheet.header, sheet.items, options);`;

content = content.replace(target1, replace1);
content = content.replace(target2, replace2);

fs.writeFileSync('packing-sheet/js/utils/excelExport.js', content);
