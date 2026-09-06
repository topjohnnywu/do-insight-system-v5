const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const targetSwitch = `          setHeader((prev) => ({
            ...prev,
            doNo: trimmedNew,
            destination: autoDest,
            packBy: '',
            approvedBy: '',
          }));
          
          setItems(window.SampleData.createBlankItems(1));
        }`;

const replaceSwitch = `          setHeader((prev) => ({
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
                skidNo: idx === 0 ? (header.containerUnit ? header.containerUnit + ' 01' : 'SKID-01') : '',
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

content = content.replace(targetSwitch, replaceSwitch);
fs.writeFileSync('packing-sheet/js/App.js', content);
