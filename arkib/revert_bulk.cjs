const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const targetBulkSimplified = `    const handleExportBulkSimplified = () => {
      const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      const sheets = generateAllSheetsForCustomer(activeCustomer);`;

const replaceBulkSimplified = `    const handleExportBulkSimplified = () => {
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

content = content.replace(targetBulkSimplified, replaceBulkSimplified);

const targetBulkSummary = `    const handleExportBulkSummary = () => {
      const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      const sheets = generateAllSheetsForCustomer(activeCustomer);`;

const replaceBulkSummary = `    const handleExportBulkSummary = () => {
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

content = content.replace(targetBulkSummary, replaceBulkSummary);

// Remove the `generateAllSheetsForCustomer` function
const startGen = content.indexOf('    const generateAllSheetsForCustomer');
if (startGen !== -1) {
    const endGen = content.indexOf('    const handleExportBulkSimplified');
    if (endGen !== -1) {
        content = content.substring(0, startGen) + content.substring(endGen);
    }
}

// Now revert the auto-fill in handleDoNoSwitch
const targetSwitch = `          if (matches.length > 0) {
            const newItems = matches.map((entry, idx) => {
              let ctnVal = typeof entry.totalCarton === 'number' ? entry.totalCarton : '';
              if (activeCustomer === 'MSCSJ' && entry.qty !== '' && entry.qty !== undefined) {
                const numQ = typeof entry.qty === 'number' ? entry.qty : parseFloat(String(entry.qty));
                if (!isNaN(numQ) && numQ > 0) ctnVal = Math.ceil(numQ / 5);
              }
              return {
                id: 'autofill-' + Date.now() + '-' + idx,
                skidNo: idx === 0 ? 'SKID-01' : '',
                code8D: entry.code8D,
                qty: entry.qty !== undefined ? entry.qty : '',
                totalCarton: ctnVal,
                weightKg: entry.weightKg !== undefined ? entry.weightKg : '',
                lengthCm: entry.lengthCm !== undefined ? entry.lengthCm : '',
                widthCm: entry.widthCm !== undefined ? entry.widthCm : '',
                heightCm: entry.heightCm !== undefined ? entry.heightCm : ''
              };
            });
            setItems(newItems);
          } else {
            setItems(window.SampleData.createBlankItems(1));
          }`;

const replaceSwitch = `          setItems(window.SampleData.createBlankItems(1));`;

content = content.replace(targetSwitch, replaceSwitch);

fs.writeFileSync('packing-sheet/js/App.js', content);
