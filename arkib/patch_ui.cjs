const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/components/PackingSheetForm.js', 'utf8');

const target1 = `    onExportExcel, onExportBulkSummary,
  }) => {`;
const replace1 = `    onExportExcel, onExportSimplified, onExportBulkSummary,
  }) => {`;
content = content.replace(target1, replace1);

const target2 = `        onExportExcel &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExportExcel,
              className: 'px-3.5 py-1.5 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white text-[12px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(0,122,255,0.25)] transition flex items-center gap-1.5 cursor-pointer',
              title: 'Export current D.O. packing details sheet to Excel (.xlsx)',
            },
            h(Icon.FileSpreadsheet, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'Export Excel')
          ),`;
const replace2 = `        onExportExcel &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExportExcel,
              className: 'px-3.5 py-1.5 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white text-[12px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(0,122,255,0.25)] transition flex items-center gap-1.5 cursor-pointer',
              title: 'Export current D.O. packing details sheet to Excel (.xlsx)',
            },
            h(Icon.FileSpreadsheet, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'Export Excel')
          ),
        onExportSimplified &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExportSimplified,
              className: 'px-3.5 py-1.5 bg-[#8E8E93] hover:bg-[#8E8E93]/90 text-white text-[12px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(142,142,147,0.25)] transition flex items-center gap-1.5 cursor-pointer',
              title: 'Export simplified Excel sheet (Dimensions only)',
            },
            h(Icon.FileSpreadsheet, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'Export Simplify Excel (Only Dimension)')
          ),`;
content = content.replace(target2, replace2);

fs.writeFileSync('packing-sheet/js/components/PackingSheetForm.js', content);
