/* QuickImportModal component (classic script → window.QuickImportModal). UI/logic verbatim. */
(function () {
  const { useState } = React;

  const QuickImportModal = ({ isOpen, onClose, onImportItems }) => {
    const [pasteText, setPasteText] = useState('');
    const [appendMode, setAppendMode] = useState(false);

    if (!isOpen) return null;

    const handleParseText = () => {
      if (!pasteText.trim()) return;
      const lines = pasteText.split('\n');
      const parsedItems = [];

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const parts = trimmed.split(/[\t,;|]/).map((p) => p.trim());
        if (parts.length > 0) {
          if (parts[0].toLowerCase().includes('skid') && idx === 0) return;
          parsedItems.push({
            id: `pasted-${Date.now()}-${idx}`,
            skidNo: parts[0] || `SKID-${(idx + 1).toString().padStart(2, '0')}`,
            code8D: parts[1] || '',
            qty: parts[2] && !isNaN(Number(parts[2])) ? Number(parts[2]) : '',
            totalCarton: parts[3] && !isNaN(Number(parts[3])) ? Number(parts[3]) : '',
            weightKg: parts[4] && !isNaN(Number(parts[4])) ? Number(parts[4]) : '',
            lengthCm: parts[5] && !isNaN(Number(parts[5])) ? Number(parts[5]) : '',
            widthCm: parts[6] && !isNaN(Number(parts[6])) ? Number(parts[6]) : '',
            heightCm: parts[7] && !isNaN(Number(parts[7])) ? Number(parts[7]) : '',
          });
        }
      });

      if (parsedItems.length > 0) {
        onImportItems(parsedItems, appendMode);
        setPasteText('');
        onClose();
      }
    };

    const header = h(
      'div',
      { className: 'flex flex-col items-center pb-4 border-b border-black/[0.06] dark:border-white/[0.08]' },
      h('div', { className: 'w-9 h-1 rounded-full bg-black/[0.15] dark:bg-white/[0.2] mb-3' }),
      h(
        'div',
        { className: 'flex justify-between items-center w-full' },
        h(
          'div',
          { className: 'flex items-center gap-3' },
          h(
            'div',
            { className: 'p-2.5 rounded-[10px] bg-[#34C759]/[0.1] dark:bg-[#30D158]/[0.15] text-[#34C759] dark:text-[#30D158]' },
            h(Icon.Clipboard, { className: 'w-5 h-5', strokeWidth: 1.5 })
          ),
          h('h3', { className: 'text-[17px] font-semibold text-gray-900 dark:text-white' }, 'Quick Paste / Bulk Insert')
        ),
        h(
          'button',
          { onClick: onClose, className: 'w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] flex items-center justify-center text-gray-500 dark:text-gray-400 transition cursor-pointer' },
          h(Icon.X, { className: 'w-4 h-4', strokeWidth: 1.5 })
        )
      )
    );

    const body = h(
      'div',
      { className: 'mt-5' },
      h(
        'p',
        { className: 'text-[13px] text-gray-500 dark:text-gray-400 mb-3' },
        'Paste tabular data directly from Excel or CSV (Tab or Comma separated):',
        h('span', { className: 'block text-gray-400 dark:text-gray-500 font-mono text-[11px] mt-1.5 bg-black/[0.03] dark:bg-white/[0.06] rounded-[8px] px-3 py-2' }, 'SKID-01, 8D-1029, 250, 25, 5, 142.5, 120, 80, 110')
      ),
      h('textarea', {
        value: pasteText,
        onChange: (e) => setPasteText(e.target.value),
        rows: 7,
        placeholder: 'SKID-01\t8D-89410-A\t250\t25\t5\t142.5\t120\t80\t110\nSKID-02\t8D-89410-B\t300\t30\t6\t168.0\t120\t80\t115',
        className: 'w-full p-4 font-mono text-[13px] text-gray-800 dark:text-gray-200 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:bg-white dark:focus:bg-[#2C2C2E] transition placeholder:text-gray-400 dark:placeholder:text-gray-500',
      }),
      h(
        'div',
        { className: 'mt-4 flex items-center gap-5 text-[13px] font-medium text-gray-700 dark:text-gray-300' },
        h(
          'label',
          { className: 'flex items-center gap-2 cursor-pointer' },
          h('input', { type: 'radio', name: 'mode', checked: !appendMode, onChange: () => setAppendMode(false), className: 'accent-[#007AFF] w-4 h-4' }),
          'Replace existing items'
        ),
        h(
          'label',
          { className: 'flex items-center gap-2 cursor-pointer' },
          h('input', { type: 'radio', name: 'mode', checked: appendMode, onChange: () => setAppendMode(true), className: 'accent-[#007AFF] w-4 h-4' }),
          'Append to current items'
        )
      )
    );

    const footer = h(
      'div',
      { className: 'mt-6 flex justify-end gap-3' },
      h('button', { onClick: onClose, className: 'px-4 py-2.5 text-[13px] font-semibold text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 rounded-[10px] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition cursor-pointer' }, 'Cancel'),
      h(
        'button',
        {
          onClick: handleParseText,
          disabled: !pasteText.trim(),
          className: 'px-5 py-2.5 text-[13px] font-semibold bg-[#007AFF] hover:bg-[#007AFF]/90 text-white rounded-[10px] shadow-[0_1px_4px_rgba(0,122,255,0.3)] transition disabled:opacity-40 disabled:shadow-none cursor-pointer',
        },
        'Insert Rows'
      )
    );

    return h(
      'div',
      { className: 'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4' },
      h(
        'div',
        { className: 'bg-white dark:bg-[#1C1C1E] rounded-[16px] max-w-xl w-full p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-black/[0.06] dark:border-white/[0.08] transition-colors' },
        header,
        body,
        footer
      )
    );
  };

  window.QuickImportModal = QuickImportModal;
})();
