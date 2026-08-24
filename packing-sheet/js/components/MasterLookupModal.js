/* MasterLookupModal component (classic script → window.MasterLookupModal). UI/logic verbatim. */
(function () {
  const { useRef, useState } = React;
  const { parseDOLookupFile, parseMSCSJLookupFile, filterByCustomer } = window.LookupParser;

  const MasterLookupModal = ({
    isOpen,
    onClose,
    lookupDb,
    setLookupDb,
    currentDoNo,
    onApplyToCurrentSheet,
    onResetLookup,
    customer = '',
  }) => {
    const fileInputRef = useRef(null);
    const [statusMessage, setStatusMessage] = useState(null);

    const isMscsj = customer === 'MSCSJ';

    const customerDb = React.useMemo(() => filterByCustomer(lookupDb, customer), [lookupDb, customer]);

    const uniqueDosWithCounts = React.useMemo(() => {
      const map = new Map();
      customerDb.forEach((entry) => {
        const raw = entry.doNo.trim();
        if (!raw) return;
        const key = raw.toUpperCase();
        const isLcl = !isMscsj && key.includes('LCL');
        if (!map.has(key)) map.set(key, { rawDo: raw, isLcl, count: 1 });
        else map.get(key).count += 1;
      });
      return Array.from(map.values());
    }, [customerDb, isMscsj]);

    const lclDosCount = isMscsj ? 0 : uniqueDosWithCounts.filter((d) => d.isLcl).length;

    const currentDoMatches = currentDoNo
      ? window.LookupParser.findMatchesForDo(customerDb, currentDoNo, customer)
      : [];

    const handleFileUpload = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const result = customer === 'MSCSJ' ? await parseMSCSJLookupFile(file) : await parseDOLookupFile(file);
        const sheetLabel = customer === 'MSCSJ' ? 'DATA' : 'Insert Batch';
        if (result.entries.length > 0) {
          setLookupDb((prev) => [...prev, ...result.entries]);
          const lclCountInFile = isMscsj ? 0 : Array.from(new Set(result.entries.filter((x) => x.doNo.toUpperCase().includes('LCL')).map((x) => x.doNo))).length;
          setStatusMessage(
            `Loaded ${result.entries.length} rows from sheet "${sheetLabel}" in "${file.name}"! (${result.uniqueDoCount} D.O. numbers${isMscsj ? '' : `, including ${lclCountInFile} LCL D.O.s`})`
          );
        } else {
          setStatusMessage(`Uploaded "${file.name}", but no records were found in sheet "${sheetLabel}".`);
        }
      } catch (err) {
        console.error(err);
        setStatusMessage('Error parsing uploaded lookup Excel (.xlsm/.xlsx) file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    const handleSelectDo = (doNo) => {
      const matches = window.LookupParser.findMatchesForDo(customerDb, doNo, customer);
      if (matches.length > 0) {
        onApplyToCurrentSheet(matches, doNo);
        onClose();
      }
    };

    if (!isOpen) return null;

    const header = h(
      'div',
      { className: 'px-6 pt-4 pb-4 flex items-center justify-between shrink-0 border-b border-black/[0.06] dark:border-white/[0.08]' },
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h(
          'div',
          { className: 'w-10 h-10 rounded-[12px] bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#0A84FF] flex items-center justify-center' },
          h(Icon.Database, { className: 'w-5 h-5', strokeWidth: 1.5 })
        ),
        h(
          'div',
          null,
          h('h2', { className: 'text-[17px] font-semibold text-gray-900 dark:text-white' },
            customer === 'MSCSJ' ? 'MSCSJ Packing List Source Library' : 'Source File Library'),
          h(
            'p',
            { className: 'text-[13px] text-gray-500 dark:text-gray-400' },
            'Parses ',
            h('code', { className: 'bg-black/[0.04] dark:bg-white/[0.08] px-1.5 py-0.5 rounded-[6px] text-[#007AFF] dark:text-[#0A84FF] font-medium' }, customer === 'MSCSJ' ? 'DATA' : 'Insert Batch'),
            ' sheet (.xlsm/.xlsx)',
            customer === 'MSCSJ'
              ? ' — Col A: D.O., Col L: Qty, Col M: Model (joined with MODEL sheet for description)'
              : ' — Row 4 Header, Row 5+ Data'
          )
        )
      ),
      h(
        'button',
        { onClick: onClose, className: 'w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] flex items-center justify-center text-gray-500 dark:text-gray-400 transition cursor-pointer' },
        h(Icon.X, { className: 'w-4 h-4', strokeWidth: 1.5 })
      )
    );

    const statusBanner =
      statusMessage &&
      h(
        'div',
        { className: 'p-4 bg-[#34C759]/[0.08] dark:bg-[#30D158]/[0.12] rounded-[12px] flex items-center gap-3 text-[13px] text-[#34C759] dark:text-[#30D158] font-medium' },
        h(Icon.CheckCircle2, { className: 'w-5 h-5 shrink-0', strokeWidth: 1.5 }),
        h('span', null, statusMessage)
      );

    const quickMatch =
      currentDoNo &&
      h(
        'div',
        { className: 'p-4 rounded-[12px] bg-[#007AFF]/[0.06] dark:bg-[#0A84FF]/[0.1] flex flex-wrap items-center justify-between gap-3' },
        h(
          'div',
          null,
          h(
            'div',
            { className: 'text-[12px] font-semibold text-[#007AFF] dark:text-[#0A84FF] uppercase tracking-wide' },
            'Current Sheet D.O. NO: ',
            h('span', { className: 'text-gray-900 dark:text-white font-bold' }, currentDoNo)
          ),
          h(
            'p',
            { className: 'text-[13px] text-gray-600 dark:text-gray-400 mt-1' },
            currentDoMatches.length > 0
              ? `Found ${currentDoMatches.length} Product Code item(s) in source file for this D.O.!`
              : 'No matching Product Codes found in source library for this D.O. yet.'
          )
        ),
        currentDoMatches.length > 0 &&
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                onApplyToCurrentSheet(currentDoMatches, currentDoNo);
                onClose();
              },
              className: 'px-4 py-2.5 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold text-[13px] rounded-[10px] shadow-[0_1px_4px_rgba(0,122,255,0.3)] transition flex items-center gap-1.5 cursor-pointer',
            },
            h(Icon.Zap, { className: 'w-4 h-4', strokeWidth: 1.5 }),
            h('span', null, `Auto-Fill ${currentDoMatches.length} Rows`)
          )
      );

    const uploadControls = h(
      'div',
      null,
      h('input', { type: 'file', ref: fileInputRef, onChange: handleFileUpload, accept: '.xlsm, .xlsx, .xls, .csv', className: 'hidden' }),
      h(
        'button',
        {
          onClick: () => fileInputRef.current && fileInputRef.current.click(),
          className: 'w-full p-5 border-2 border-dashed border-black/[0.1] hover:border-[#007AFF]/40 dark:border-white/[0.12] dark:hover:border-[#0A84FF]/40 bg-black/[0.02] hover:bg-[#007AFF]/[0.04] dark:bg-white/[0.04] dark:hover:bg-[#0A84FF]/[0.08] rounded-[14px] flex items-center justify-between gap-4 transition cursor-pointer group text-left',
        },
        h(
          'div',
          { className: 'flex items-center gap-4' },
          h(
            'div',
            { className: 'w-12 h-12 rounded-[12px] bg-[#007AFF] text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-[0_2px_8px_rgba(0,122,255,0.25)]' },
            h(Icon.Upload, { className: 'w-5 h-5', strokeWidth: 1.5 })
          ),
          h(
            'div',
            null,
            h('div', { className: 'text-[15px] font-semibold text-gray-900 dark:text-white' },
              customer === 'MSCSJ' ? 'Upload MSCSJ Packing List File' : 'Upload Source File'),
            h('div', { className: 'text-[13px] text-gray-500 dark:text-gray-400' },
              `Supports .xlsm / .xlsx — reads "${customer === 'MSCSJ' ? 'DATA' : 'Insert Batch'}" sheet`)
          )
        ),
        h('span', { className: 'px-4 py-2 bg-[#007AFF] text-white font-semibold text-[13px] rounded-[10px] group-hover:bg-[#007AFF]/90 transition shadow-[0_1px_4px_rgba(0,122,255,0.3)]' }, 'Select File')
      )
    );

    const lclList = uniqueDosWithCounts.filter((d) => d.isLcl);
    const lclBar =
      !isMscsj &&
      h(
        'div',
        { className: 'bg-[#FF9500]/[0.06] dark:bg-[#FF9F0A]/[0.08] rounded-[14px] p-4 space-y-3' },
        h(
          'div',
          { className: 'flex flex-wrap items-center justify-between gap-2' },
          h(
            'div',
            { className: 'flex items-center gap-2' },
            h(Icon.Ship, { className: 'w-4 h-4 text-[#FF9500] dark:text-[#FF9F0A]', strokeWidth: 1.5 }),
            h('h3', { className: 'text-[12px] font-semibold text-[#FF9500] dark:text-[#FF9F0A] uppercase tracking-wide' }, `Available LCL D.O. Selection (${lclDosCount} Found)`)
          )
        ),
        lclList.length === 0
          ? h('p', { className: 'text-[13px] text-gray-500 dark:text-gray-400 italic' }, 'No DO numbers containing "LCL" detected. Upload your source file above to detect LCL DOs.')
          : h(
              'div',
              { className: 'flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-1' },
              lclList.map((d) =>
                h(
                  'button',
                  {
                    key: d.rawDo,
                    type: 'button',
                    onClick: () => handleSelectDo(d.rawDo),
                    className: 'px-3 py-2 bg-white hover:bg-[#FF9500] hover:text-white border border-black/[0.08] text-gray-800 dark:bg-[#2C2C2E] dark:border-white/[0.1] dark:text-gray-200 dark:hover:bg-[#FF9F0A] dark:hover:text-white text-[13px] font-semibold rounded-[10px] transition cursor-pointer flex items-center gap-2 group shadow-[0_0.5px_2px_rgba(0,0,0,0.04)]',
                    title: `Click to select D.O. "${d.rawDo}" and auto-fill its ${d.count} item(s)`,
                  },
                  h('span', null, d.rawDo),
                  h('span', { className: 'px-2 py-0.5 bg-[#FF9500]/10 text-[#FF9500] group-hover:bg-white/20 group-hover:text-white rounded-full text-[11px] font-semibold' }, `${d.count} items`)
                )
              )
            )
      );

    const resetBar =
      customerDb.length > 0 &&
      h(
        'div',
        { className: 'flex justify-end' },
        h(
          'button',
          {
            type: 'button',
            onClick: async () => {
              const confirmed = await window.ConfirmDialog.confirm({
                title: 'Reset Source File?',
                subtitle: `Clear ${customerDb.length} record(s)`,
                message: `Clear all ${customerDb.length} ${isMscsj ? 'MSCSJ' : 'SSEA'} source file record(s)?\n\nThis cannot be undone.`,
                confirmLabel: 'Clear Records',
                cancelLabel: 'Cancel',
                tone: 'danger',
                icon: Icon.RotateCcw,
              });
              if (!confirmed) return;
              onResetLookup();
            },
            title: 'Clear all loaded source file records',
            className: 'px-3 py-1.5 bg-[#FF3B30]/[0.08] hover:bg-[#FF3B30]/[0.15] dark:bg-[#FF453A]/[0.12] dark:hover:bg-[#FF453A]/[0.2] text-[#FF3B30] dark:text-[#FF453A] text-[12px] font-semibold rounded-[8px] transition cursor-pointer flex items-center gap-1.5',
          },
          h(Icon.RotateCcw, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
          h('span', null, `Reset Source File (${customerDb.length})`)
        )
      );

    const body = h('div', { className: 'p-6 overflow-y-auto space-y-4 flex-1' }, statusBanner, quickMatch, uploadControls, lclBar, resetBar);

    const footer = h(
      'div',
      { className: 'px-6 py-4 bg-black/[0.02] dark:bg-white/[0.04] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0' },
      h(
        'div',
        { className: 'text-[13px] text-gray-500 dark:text-gray-400' },
        'Excel sheet parser ready for ',
        h('code', { className: 'text-[#007AFF] dark:text-[#0A84FF] font-semibold' }, customer === 'MSCSJ' ? 'DATA' : 'Insert Batch'),
        ' tab'
      ),
      h('button', { onClick: onClose, className: 'px-5 py-2.5 bg-black/[0.06] hover:bg-black/[0.1] dark:bg-white/[0.1] dark:hover:bg-white/[0.15] text-gray-800 dark:text-gray-200 text-[13px] font-semibold rounded-[10px] transition cursor-pointer' }, 'Close')
    );

    return h(
      'div',
      { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm' },
      h(
        'div',
        { className: 'bg-white dark:bg-[#1C1C1E] rounded-[16px] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden transition-colors' },
        header,
        body,
        footer
      )
    );
  };

  window.MasterLookupModal = MasterLookupModal;
})();
