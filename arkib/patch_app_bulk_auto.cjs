const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const target1 = `    const handleExportBulkSimplified = () => {
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

const replacement1 = `    const generateAllSheetsForCustomer = (customer) => {
      const sheets = [];
      const currentDo = header.doNo.trim();
      
      const customerLookups = lookupDb.filter(e => window.LookupParser.entryCustomer(e) === customer);
      const uniqueDos = Array.from(new Set(customerLookups.map(e => e.doNo.trim()).filter(Boolean)));
      
      if (currentDo && (header.customer === customer) && !uniqueDos.includes(currentDo)) {
        uniqueDos.push(currentDo);
      }

      uniqueDos.forEach(doNo => {
        if (doNo.toUpperCase() === currentDo.toUpperCase() && header.customer === customer) {
           sheets.push({ header, items });
           return;
        }
        
        const cached = Object.values(doCache).find(state => state.header.doNo.trim().toUpperCase() === doNo.toUpperCase() && state.header.customer === customer);
        if (cached) {
           sheets.push({ header: cached.header, items: cached.items });
           return;
        }

        const matches = customerLookups.filter(e => e.doNo.trim().toUpperCase() === doNo.toUpperCase());
        if (matches.length > 0) {
           const destMatch = matches.find((e) => e.destination && e.destination.trim() !== '');
           const autoDest = destMatch ? destMatch.destination : '';
           const defaultShipBy = customer === 'MSCSJ' ? 'AIR' : 'LCL';
           
           const genHeader = {
             doNo,
             customer,
             shipBy: defaultShipBy,
             destination: autoDest,
             date: '',
             customShipBy: '',
             packBy: '',
             approvedBy: ''
           };
           
           const genItems = matches.map((entry, idx) => {
             let ctnVal = typeof entry.totalCarton === 'number' ? entry.totalCarton : '';
             if (customer === 'MSCSJ' && entry.qty !== '' && entry.qty !== undefined) {
               const numQ = typeof entry.qty === 'number' ? entry.qty : parseFloat(String(entry.qty));
               if (!isNaN(numQ) && numQ > 0) ctnVal = Math.ceil(numQ / 5);
             }
             return {
               id: 'bulk-' + doNo + '-' + idx,
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
           
           sheets.push({ header: genHeader, items: genItems });
        }
      });
      
      return sheets;
    };

    const handleExportBulkSimplified = () => {
      const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      const sheets = generateAllSheetsForCustomer(activeCustomer);`;

content = content.replace(target1, replacement1);

const target2 = `    const handleExportBulkSummary = () => {
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

const replacement2 = `    const handleExportBulkSummary = () => {
      const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      const sheets = generateAllSheetsForCustomer(activeCustomer);`;

content = content.replace(target2, replacement2);

fs.writeFileSync('packing-sheet/js/App.js', content);
