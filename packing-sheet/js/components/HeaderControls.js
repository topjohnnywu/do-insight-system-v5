/* HeaderControls component (classic script → window.HeaderControls). UI/logic verbatim; uses global h, Icon. */
(function () {
  const { useEffect, useState } = React;

  const HeaderControls = ({
    onExportExcel,
    onExportHandwrittenTemplate,
    onExportCSV,
    onPrint,
    onOpenMasterLookup,
    lookupCount,
    lastSavedAt,
    theme,
    onToggleTheme,
  }) => {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
      const timer = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(timer);
    }, []);

    const currentDate = now.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const currentTime = now.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });

    const btnBase =
      'px-3.5 py-2 bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-gray-700 dark:text-gray-200 text-[13px] font-semibold rounded-[10px] transition flex items-center gap-1.5 cursor-pointer';

    const brand = h(
      'div',
      { className: 'flex items-center gap-3' },
      h(
        'div',
        { className: 'bg-gradient-to-br from-[#007AFF] to-[#5AC8FA] p-2.5 rounded-[12px] shadow-[0_2px_8px_rgba(0,122,255,0.25)]' },
        h(Icon.FileSpreadsheet, { className: 'w-5 h-5 text-white', strokeWidth: 1.5 })
      ),
      h(
        'div',
        null,
        h('h1', { className: 'text-[22px] font-semibold text-gray-900 dark:text-white tracking-[-0.02em] leading-tight' }, 'Packing Details Sheet'),
        h('p', { className: 'text-[13px] text-gray-500 dark:text-gray-400 mt-0.5' }, 'Edit, calculate totals, and generate ready-to-use Excel (.xlsx) sheets'),
        h(
          'div',
          { className: 'mt-1.5 flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400' },
          h('span', null, currentDate),
          h('span', { className: 'text-gray-300 dark:text-gray-600' }, '·'),
          h('span', { className: 'font-semibold text-gray-900 dark:text-white tabular-nums tracking-wide' }, currentTime)
        )
      )
    );

    const buttons = h(
      'div',
      { className: 'flex flex-wrap items-center gap-2.5' },
      h(
        'button',
        { type: 'button', onClick: onPrint, className: btnBase, title: 'Print or Save as PDF document' },
        h(Icon.Printer, { className: 'w-4 h-4 text-gray-500 dark:text-gray-400', strokeWidth: 1.5 }),
        h('span', null, 'Print / PDF')
      ),
      h('div', { className: 'w-px h-6 bg-black/[0.08] dark:bg-white/[0.1] hidden md:block' }),
      h(
        'button',
        {
          type: 'button',
          onClick: onExportExcel,
          className:
            'px-3.5 py-2 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white text-[13px] font-semibold rounded-[10px] transition flex items-center gap-1.5 cursor-pointer shadow-[0_1px_4px_rgba(0,122,255,0.3)]',
          title: 'Download filled Excel (.xlsx) spreadsheet with complete borders and calculated formulas',
        },
        h(Icon.FileSpreadsheet, { className: 'w-4 h-4', strokeWidth: 1.5 }),
        h('span', null, 'Download Excel (.xlsx)')
      ),
      h(
        'button',
        { type: 'button', onClick: onExportHandwrittenTemplate, className: btnBase, title: 'Download blank Excel sheet formatted with tall rows and full grid borders for manual handwriting' },
        h(Icon.PenTool, { className: 'w-4 h-4 text-gray-500 dark:text-gray-400', strokeWidth: 1.5 }),
        h('span', null, 'Handwritten Template')
      ),
      h(
        'button',
        { type: 'button', onClick: onExportCSV, className: btnBase, title: 'Export CSV data' },
        h(Icon.FileText, { className: 'w-4 h-4 text-gray-500 dark:text-gray-400', strokeWidth: 1.5 }),
        h('span', null, 'CSV')
      ),
      h(
        'button',
        { type: 'button', onClick: onOpenMasterLookup, className: btnBase, title: 'Upload or manage source file for automatic DO matching' },
        h(Icon.HelpCircle, { className: 'w-4 h-4 text-gray-500 dark:text-gray-400', strokeWidth: 1.5 }),
        h('span', null, `Source File (${lookupCount})`)
      ),
      h('div', { className: 'w-px h-6 bg-black/[0.08] dark:bg-white/[0.1] hidden md:block' }),
      h(
        'button',
        {
          type: 'button',
          onClick: onToggleTheme,
          className:
            'w-9 h-9 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] flex items-center justify-center transition cursor-pointer',
          title: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        },
        theme === 'dark'
          ? h(Icon.Sun, { className: 'w-4 h-4 text-[#FF9500]', strokeWidth: 1.5 })
          : h(Icon.Moon, { className: 'w-4 h-4 text-gray-600 dark:text-gray-300', strokeWidth: 1.5 })
      )
    );

    const autosave =
      lastSavedAt &&
      h(
        'div',
        { className: 'mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2' },
        h(
          'div',
          { className: 'inline-flex items-center gap-1.5 bg-[#34C759]/[0.08] dark:bg-[#34C759]/[0.12] rounded-full px-3 py-1' },
          h('div', { className: 'w-1.5 h-1.5 rounded-full bg-[#34C759]' }),
          h('span', { className: 'text-[11px] font-semibold text-[#34C759] tracking-wide' }, `Auto-Saved · ${lastSavedAt}`)
        )
      );

    return h(
      'div',
      {
        className:
          'bg-white dark:bg-[#1C1C1E] rounded-[16px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-black/[0.06] dark:border-white/[0.08] p-5 print:hidden transition-colors duration-300',
      },
      h('div', { className: 'flex flex-col md:flex-row items-start md:items-center justify-between gap-5' }, brand, buttons),
      autosave
    );
  };

  window.HeaderControls = HeaderControls;
})();
