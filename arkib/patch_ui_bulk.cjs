const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/components/PackingSheetForm.js', 'utf8');

const target1 = `    onExportExcel, onExportSimplified, onExportBulkSummary,`;
const replace1 = `    onExportExcel, onExportSimplified, onExportBulkSummary, onExportBulkSimplified,`;
content = content.replace(target1, replace1);

const target2 = `        onExportBulkSummary &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExportBulkSummary,
              className: 'px-3.5 py-1.5 bg-[#34C759] hover:bg-[#34C759]/90 dark:bg-[#30D158] dark:hover:bg-[#30D158]/90 text-white text-[12px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(52,199,89,0.25)] transition flex items-center gap-1.5 cursor-pointer',
              title: 'Combine all D.O. sheets into one Excel workbook with a tab sheet for each D.O.',
            },
            h(Icon.Layers, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'Bulk Summary (.xlsx)')
          )`;
          
const replace2 = `        onExportBulkSummary &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExportBulkSummary,
              className: 'px-3.5 py-1.5 bg-[#34C759] hover:bg-[#34C759]/90 dark:bg-[#30D158] dark:hover:bg-[#30D158]/90 text-white text-[12px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(52,199,89,0.25)] transition flex items-center gap-1.5 cursor-pointer',
              title: 'Combine all D.O. sheets into one Excel workbook with a tab sheet for each D.O.',
            },
            h(Icon.Layers, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'Bulk Summary (.xlsx)')
          ),
        onExportBulkSimplified &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExportBulkSimplified,
              className: 'px-3.5 py-1.5 bg-[#8E8E93] hover:bg-[#8E8E93]/90 text-white text-[12px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(142,142,147,0.25)] transition flex items-center gap-1.5 cursor-pointer',
              title: 'Combine all D.O. sheets into one Excel workbook (Simplified Dimensions)',
            },
            h(Icon.Layers, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'Bulk Simplify (.xlsx)')
          )`;
content = content.replace(target2, replace2);
fs.writeFileSync('packing-sheet/js/components/PackingSheetForm.js', content);
