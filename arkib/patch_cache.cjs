const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const target = `        if (cached) {
          setHeader({ ...cached.header, doNo: trimmedNew });
          setItems(cached.items);
          showToast(\`Loaded cached sheet for \${trimmedNew}\`);
        } else {
          const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
          const matches = lookupDb.filter(
            (e) => window.LookupParser.entryCustomer(e) === activeCustomer && e.doNo.toUpperCase() === trimmedNew.toUpperCase()
          );
          const destMatch = matches.find((e) => e.destination && e.destination.trim() !== '');
          const autoDest = destMatch ? destMatch.destination : '';

          setHeader((prev) => ({
            ...prev,
            doNo: trimmedNew,
            destination: autoDest,
            packBy: '',
            approvedBy: '',
          }));
          
          if (matches.length > 0) {
            const newItems = matches.map((entry, idx) => {
              let ctnVal = typeof entry.totalCarton === 'number' ? entry.totalCarton : '';
              if (activeCustomer === 'MSCSJ' && entry.qty !== '' && entry.qty !== undefined) {
                const numQ = typeof entry.qty === 'number' ? entry.qty : parseFloat(String(entry.qty));
                if (!isNaN(numQ) && numQ > 0) ctnVal = Math.ceil(numQ / 5);
              }
              return {
                id: 'autofill-' + Date.now() + '-' + idx,
                skidNo: 'QTY: ' + entry.qty,
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
            showToast(\`Auto-filled \${newItems.length} items for \${trimmedNew}\`);
          } else {
            setItems(window.SampleData.createBlankItems(1));
          }
        }`;

const replacement = `        const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
        const matches = lookupDb.filter(
          (e) => window.LookupParser.entryCustomer(e) === activeCustomer && e.doNo.toUpperCase() === trimmedNew.toUpperCase()
        );
        const destMatch = matches.find((e) => e.destination && e.destination.trim() !== '');
        const autoDest = destMatch ? destMatch.destination : '';
        
        let newHeader = { ...header, doNo: trimmedNew, destination: autoDest, packBy: '', approvedBy: '' };
        let newItems = window.SampleData.createBlankItems(1);
        let wasCached = false;

        if (cached) {
          newHeader = { ...cached.header, doNo: trimmedNew };
          newItems = cached.items;
          wasCached = true;
        }

        // If the current items are basically empty, and we have matches, auto-fill it!
        const hasData = newItems.some(it => it.qty || it.totalCarton || it.weightKg || it.code8D);
        if (matches.length > 0 && (!wasCached || !hasData)) {
          newHeader.destination = autoDest; // Make sure dest is applied
          newItems = matches.map((entry, idx) => {
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
          setHeader(newHeader);
          setItems(newItems);
          showToast(\`Auto-filled \${newItems.length} items for \${trimmedNew}\`);
        } else {
          setHeader(newHeader);
          setItems(newItems);
          if (wasCached) showToast(\`Loaded cached sheet for \${trimmedNew}\`);
        }`;

content = content.replace(target, replacement);
fs.writeFileSync('packing-sheet/js/App.js', content);
