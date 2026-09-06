const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const target1 = `    const handleExportExcel = () => exportToExcel(header, items);
    const handleExportHandwrittenTemplate = () => exportToExcel(header, items, undefined, { isHandwrittenTemplate: true, blankRowCount: 20 });
    const handleExportCSV = () => exportToCSV(header, items);`;
const replace1 = `    const handleExportExcel = () => exportToExcel(header, items, undefined, { lookupDb });
    const handleExportHandwrittenTemplate = () => exportToExcel(header, items, undefined, { isHandwrittenTemplate: true, blankRowCount: 20, lookupDb });
    const handleExportCSV = () => exportToCSV(header, items, undefined, { lookupDb });`;

const target2 = `      exportBulkSummaryToExcel(sheets);
      showToast(\`Exported \${sheets.length} D.O. sheet(s) to Excel\`);`;
const replace2 = `      exportBulkSummaryToExcel(sheets, undefined, { lookupDb });
      showToast(\`Exported \${sheets.length} D.O. sheet(s) to Excel\`);`;

content = content.replace(target1, replace1);
content = content.replace(target2, replace2);

fs.writeFileSync('packing-sheet/js/App.js', content);
