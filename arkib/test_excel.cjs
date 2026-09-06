const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Sheet 1');

worksheet.columns = [
  { header: 'Id', key: 'id', width: 10 },
  { header: 'Name', key: 'name', width: 32 },
  { header: 'D.O.B.', key: 'DOB', width: 10, outlineLevel: 1 }
];

worksheet.addRow({id: 1, name: 'John Doe', DOB: new Date(1970,1,1)});
worksheet.addRow({id: 2, name: 'Jane Doe with a very very long name', DOB: new Date(1965,1,7)});

worksheet.columns.forEach(column => {
  let maxLength = 0;
  column.eachCell({ includeEmpty: true }, (cell) => {
    let valStr = '';
    if (cell.value && typeof cell.value === 'object' && cell.value.formula) {
      valStr = cell.value.result ? cell.value.result.toString() : '';
    } else if (cell.value) {
      valStr = cell.value.toString();
    }
    if (valStr.length > maxLength) {
      maxLength = valStr.length;
    }
  });
  column.width = maxLength < 10 ? 10 : (maxLength > 50 ? 50 : maxLength + 2);
});

console.log(worksheet.columns.map(c => c.width));
