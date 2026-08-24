const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/App.js', 'utf8');

const target = `        if (cached) {
          setHeader({ ...cached.header, doNo: trimmedNew });
          setItems(cached.items);
          showToast(\`Loaded cached sheet for \${trimmedNew}\`);
        } else {
          setHeader((prev) => ({
            ...prev,
            doNo: trimmedNew,
            destination: '',
            packBy: '',
            approvedBy: '',
          }));
          setItems(window.SampleData.createBlankItems(1));
        }`;

const replace = `        if (cached) {
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
          setItems(window.SampleData.createBlankItems(1));
        }`;

if (content.includes(target)) {
    content = content.replace(target, replace);
    fs.writeFileSync('packing-sheet/js/App.js', content);
    console.log('App.js patched successfully');
} else {
    console.log('Target not found in App.js');
}
