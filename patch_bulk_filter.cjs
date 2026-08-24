const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const target1 = `    const handleExportBulkSimplified = () => {
      const currentDo = header.doNo.trim();
      const sheets = [];
      if (currentDo) {
        sheets.push({ header, items });
      }
      Object.entries(doCache).forEach(([doNo, state]) => {
        if (doNo === currentDo) return;
        sheets.push({ header: state.header, items: state.items });
      });`;

const replace1 = `    const handleExportBulkSimplified = () => {
      const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      const currentDo = header.doNo.trim();
      const sheets = [];
      
      if (currentDo) {
        sheets.push({ header, items });
      }
      Object.entries(doCache).forEach(([doNo, state]) => {
        if (doNo === currentDo) return;
        
        const stateCustomer = state.header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
        if (stateCustomer === activeCustomer) {
          sheets.push({ header: state.header, items: state.items });
        }
      });`;
content = content.replace(target1, replace1);

const target2 = `    const handleExportBulkSummary = () => {
      const currentDo = header.doNo.trim();
      const sheets = [];

      if (currentDo) {
        sheets.push({ header, items });
      }

      Object.entries(doCache).forEach(([doNo, state]) => {
        if (doNo === currentDo) return;
        sheets.push({ header: state.header, items: state.items });
      });`;

const replace2 = `    const handleExportBulkSummary = () => {
      const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      const currentDo = header.doNo.trim();
      const sheets = [];

      if (currentDo) {
        sheets.push({ header, items });
      }

      Object.entries(doCache).forEach(([doNo, state]) => {
        if (doNo === currentDo) return;
        
        const stateCustomer = state.header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
        if (stateCustomer === activeCustomer) {
          sheets.push({ header: state.header, items: state.items });
        }
      });`;
content = content.replace(target2, replace2);

fs.writeFileSync('packing-sheet/js/App.js', content);
