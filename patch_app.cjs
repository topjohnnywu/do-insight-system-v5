const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const target1 = `    const handleExportExcel = () => exportToExcel(header, items, undefined, { lookupDb });
    const handleExportHandwrittenTemplate = () => exportToExcel(header, items, undefined, { isHandwrittenTemplate: true, blankRowCount: 20, lookupDb });`;

const replace1 = `    const handleExportExcel = () => exportToExcel(header, items, undefined, { lookupDb });
    const handleExportSimplified = () => exportToExcel(header, items, undefined, { isSimplified: true, lookupDb });
    const handleExportHandwrittenTemplate = () => exportToExcel(header, items, undefined, { isHandwrittenTemplate: true, blankRowCount: 20, lookupDb });`;
content = content.replace(target1, replace1);

const target2 = `          onClearAll: handleClearAll,
          onExportExcel: handleExportExcel,
          onExportBulkSummary: handleExportBulkSummary,`;

const replace2 = `          onClearAll: handleClearAll,
          onExportExcel: handleExportExcel,
          onExportSimplified: handleExportSimplified,
          onExportBulkSummary: handleExportBulkSummary,`;
content = content.replace(target2, replace2);

fs.writeFileSync('packing-sheet/js/App.js', content);
