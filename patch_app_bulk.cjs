const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const target1 = `    const handleExportBulkSummary = () => {`;
const replace1 = `    const handleExportBulkSimplified = () => {
      const currentDo = header.doNo.trim();
      const sheets = [];
      if (currentDo) {
        sheets.push({ header, items });
      }
      Object.entries(doCache).forEach(([doNo, state]) => {
        if (doNo === currentDo) return;
        sheets.push({ header: state.header, items: state.items });
      });
      if (sheets.length === 0) {
        showToast('No D.O. sheets available to export');
        return;
      }
      exportBulkSummaryToExcel(sheets, 'Bulk_Simplified_Packing_Details.xlsx', { isSimplified: true, lookupDb });
      showToast(\`Exported \${sheets.length} simplified D.O. sheet(s) to Excel\`);
    };

    const handleExportBulkSummary = () => {`;

content = content.replace(target1, replace1);

const target2 = `          onExportExcel: handleExportExcel,
          onExportSimplified: handleExportSimplified,
          onExportBulkSummary: handleExportBulkSummary,
          onCustomerChange: (c) => showToast(\`Switched to \${c === 'MSCSJ' ? 'MSCSJ' : 'SSEA'}\`, c === 'MSCSJ' ? 'mscsj' : 'ssea'),`;

const replace2 = `          onExportExcel: handleExportExcel,
          onExportSimplified: handleExportSimplified,
          onExportBulkSummary: handleExportBulkSummary,
          onExportBulkSimplified: handleExportBulkSimplified,
          onCustomerChange: (c) => showToast(\`Switched to \${c === 'MSCSJ' ? 'MSCSJ' : 'SSEA'}\`, c === 'MSCSJ' ? 'mscsj' : 'ssea'),`;

content = content.replace(target2, replace2);
fs.writeFileSync('packing-sheet/js/App.js', content);
