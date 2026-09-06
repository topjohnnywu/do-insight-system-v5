const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/excelExport.js', 'utf8');

const target = `      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }],
      });
      populateWorksheet(worksheet, sheet.header, sheet.items, options);`;

const replacement = `      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }],
      });
      if (options && options.isSimplified) {
        populateSimplifiedWorksheet(worksheet, sheet.header, sheet.items, options);
      } else {
        populateWorksheet(worksheet, sheet.header, sheet.items, options);
      }`;

content = content.replace(target, replacement);
fs.writeFileSync('packing-sheet/js/utils/excelExport.js', content);
