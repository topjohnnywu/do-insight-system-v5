/* ConfirmVerifyModal component (classic script → window.ConfirmVerifyModal). UI/logic verbatim. */
(function () {
  const STATUS_STYLE = {
    ok: { badge: 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20 dark:bg-[#30D158]/15 dark:text-[#30D158] dark:border-[#30D158]/25', Icon: Icon.CheckCircle2 },
    short: { badge: 'bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/20 dark:bg-[#FF9F0A]/15 dark:text-[#FF9F0A] dark:border-[#FF9F0A]/25', Icon: Icon.MinusCircle },
    over: { badge: 'bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/20 dark:bg-[#FF9F0A]/15 dark:text-[#FF9F0A] dark:border-[#FF9F0A]/25', Icon: Icon.AlertTriangle },
    missing: { badge: 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20 dark:bg-[#FF453A]/15 dark:text-[#FF453A] dark:border-[#FF453A]/25', Icon: Icon.XCircle },
    extra: { badge: 'bg-[#8E8E93]/10 text-[#8E8E93] border-[#8E8E93]/20 dark:bg-[#98989D]/15 dark:text-[#98989D] dark:border-[#98989D]/25', Icon: Icon.PlusCircle },
  };

  const statusLabel = (s) => {
    switch (s) {
      case 'ok': return 'OK';
      case 'short': return 'Short';
      case 'over': return 'Over';
      case 'missing': return 'Missing';
      case 'extra': return 'Extra';
      default: return s;
    }
  };

  const ConfirmVerifyModal = ({ isOpen, onClose, doNo, report }) => {
    if (!isOpen) return null;

    const [hideCodeAndModel, setHideCodeAndModel] = React.useState(() => {
      try {
        const saved = localStorage.getItem('PACKING_SHEET_VERIFY_FOCUS_QTY');
        return saved === 'true';
      } catch (e) {
        return false;
      }
    });

    const toggleHideCodeAndModel = () => {
      setHideCodeAndModel((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('PACKING_SHEET_VERIFY_FOCUS_QTY', String(next));
        } catch (e) {}
        return next;
      });
    };

    const hasResults = report && report.results && report.results.length > 0;

    const totalExpected = hasResults
      ? (report.totalExpectedQty != null
          ? report.totalExpectedQty
          : report.results.reduce((acc, r) => acc + (Number(r.expectedQty) || 0), 0))
      : 0;

    const totalSheet = hasResults
      ? (report.totalSheetQty != null
          ? report.totalSheetQty
          : report.results.reduce((acc, r) => acc + (Number(r.actualQty) || 0), 0))
      : 0;

    const totalDiff = totalSheet - totalExpected;
    const isTotalQtyMatch = totalExpected > 0 && totalDiff === 0;
    const hasAnyCodeAssigned = report ? report.hasAnyCodeAssigned : true;
    const isOverallPass = Boolean(report && report.overallPass);

    const header = h(
      'div',
      { className: 'px-6 pt-4 pb-4 flex items-center justify-between shrink-0 border-b border-black/[0.06] dark:border-white/[0.08]' },
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h(
          'div',
          {
            className: `w-10 h-10 rounded-[12px] flex items-center justify-center ${
              isOverallPass
                ? 'bg-[#34C759]/10 text-[#34C759] dark:bg-[#30D158]/15 dark:text-[#30D158]'
                : 'bg-[#FF3B30]/10 text-[#FF3B30] dark:bg-[#FF453A]/15 dark:text-[#FF453A]'
            }`,
          },
          h(isOverallPass ? Icon.CheckCircle2 : Icon.ClipboardCheck, { className: 'w-5 h-5', strokeWidth: 1.5 })
        ),
        h(
          'div',
          null,
          h('h2', { className: 'text-[17px] font-semibold text-gray-900 dark:text-white' }, 'Confirm D.O. Verification'),
          h(
            'p',
            { className: 'text-[13px] text-gray-500 dark:text-gray-400' },
            'Checked against D.O.: ',
            h('span', { className: 'font-semibold text-gray-900 dark:text-white' }, doNo)
          )
        )
      ),
      h(
        'button',
        { onClick: onClose, className: 'w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] flex items-center justify-center text-gray-500 dark:text-gray-400 transition cursor-pointer' },
        h(Icon.X, { className: 'w-4 h-4', strokeWidth: 1.5 })
      )
    );

    const body = h(
      'div',
      { className: 'p-6 overflow-y-auto space-y-4 flex-1' },
      !hasResults
        ? h('p', { className: 'text-[15px] text-gray-500 dark:text-gray-400 italic text-center py-8' }, 'No data available to verify. Select a D.O. with matching source-file records and enter sheet quantities first.')
        : h(
            React.Fragment,
            null,
            // Status banner
            h(
              'div',
              { className: `p-4 rounded-[12px] flex items-start sm:items-center gap-3 text-[15px] font-semibold ${
                  isOverallPass
                    ? 'bg-[#34C759]/[0.08] text-[#34C759] dark:bg-[#30D158]/[0.12] dark:text-[#30D158]'
                    : isTotalQtyMatch
                    ? 'bg-[#34C759]/[0.08] text-[#34C759] dark:bg-[#30D158]/[0.12] dark:text-[#30D158]'
                    : 'bg-[#FF3B30]/[0.08] text-[#FF3B30] dark:bg-[#FF453A]/[0.12] dark:text-[#FF453A]'
                }` },
              (isOverallPass || isTotalQtyMatch)
                ? h(Icon.CheckCircle2, { className: 'w-5 h-5 shrink-0 mt-0.5 sm:mt-0', strokeWidth: 1.5 })
                : h(Icon.AlertTriangle, { className: 'w-5 h-5 shrink-0 mt-0.5 sm:mt-0', strokeWidth: 1.5 }),
              h(
                'div',
                { className: 'flex flex-col gap-0.5' },
                h(
                  'span',
                  null,
                  isOverallPass && (!report.hasAnyCodeAssigned || isTotalQtyMatch)
                    ? `Total Quantity matches D.O. perfectly (${totalExpected.toLocaleString()} pcs)!`
                    : isOverallPass
                    ? 'All items and quantities match the D.O. perfectly!'
                    : isTotalQtyMatch
                    ? `Grand Total Quantity matches (${totalExpected.toLocaleString()} pcs) — Line items unassigned.`
                    : 'Discrepancies detected — review the quantities below.'
                ),
                !hasAnyCodeAssigned && isTotalQtyMatch && h(
                  'span',
                  { className: 'text-[12px] font-normal opacity-90' },
                  'Overall pieces match the D.O. total. Product code & model were omitted on sheet rows.'
                )
              )
            ),

            // Total Quantity Summary Cards
            h(
              'div',
              { className: 'grid grid-cols-1 sm:grid-cols-3 gap-3' },
              // Card 1: Expected Qty
              h(
                'div',
                { className: 'p-3.5 bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-[12px] flex flex-col justify-between' },
                h('span', { className: 'text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400' }, 'Total Expected Qty'),
                h('div', { className: 'flex items-baseline gap-1.5 mt-1' },
                  h('span', { className: 'text-[22px] font-bold text-gray-900 dark:text-white tabular-nums' }, totalExpected.toLocaleString()),
                  h('span', { className: 'text-[12px] text-gray-400 dark:text-gray-500 font-medium' }, 'pcs')
                )
              ),
              // Card 2: Sheet Qty
              h(
                'div',
                { className: 'p-3.5 bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-[12px] flex flex-col justify-between' },
                h('span', { className: 'text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400' }, 'Total Sheet Qty'),
                h('div', { className: 'flex items-baseline gap-1.5 mt-1' },
                  h('span', { className: 'text-[22px] font-bold text-[#007AFF] dark:text-[#0A84FF] tabular-nums' }, totalSheet.toLocaleString()),
                  h('span', { className: 'text-[12px] text-gray-400 dark:text-gray-500 font-medium' }, 'pcs')
                )
              ),
              // Card 3: Difference
              h(
                'div',
                {
                  className: `p-3.5 border rounded-[12px] flex flex-col justify-between ${
                    totalDiff === 0
                      ? 'bg-[#34C759]/[0.06] border-[#34C759]/20 text-[#34C759] dark:bg-[#30D158]/[0.1] dark:border-[#30D158]/25 dark:text-[#30D158]'
                      : totalDiff < 0
                      ? 'bg-[#FF3B30]/[0.06] border-[#FF3B30]/20 text-[#FF3B30] dark:bg-[#FF453A]/[0.1] dark:border-[#FF453A]/25 dark:text-[#FF453A]'
                      : 'bg-[#FF9500]/[0.06] border-[#FF9500]/20 text-[#FF9500] dark:bg-[#FF9F0A]/[0.1] dark:border-[#FF9F0A]/25 dark:text-[#FF9F0A]'
                  }`,
                },
                h('span', { className: 'text-[11px] font-semibold uppercase tracking-wider opacity-80' }, 'Total Difference'),
                h('div', { className: 'flex items-baseline gap-1.5 mt-1' },
                  h(
                    'span',
                    { className: 'text-[22px] font-bold tabular-nums' },
                    totalDiff > 0 ? `+${totalDiff.toLocaleString()}` : totalDiff.toLocaleString()
                  ),
                  h('span', { className: 'text-[12px] font-medium opacity-80' }, totalDiff === 0 ? 'Exact Match' : 'pcs net diff')
                )
              )
            ),

            // Filter status chips & Focus on Quantity Toggle
            h(
              'div',
              { className: 'flex flex-wrap items-center justify-between gap-2 pt-1' },
              h(
                'div',
                { className: 'flex flex-wrap gap-2 items-center' },
                isTotalQtyMatch && !hasAnyCodeAssigned
                  ? h(
                      'span',
                      { className: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-semibold bg-[#34C759]/10 border-[#34C759]/20 text-[#34C759] dark:bg-[#30D158]/15 dark:border-[#30D158]/25 dark:text-[#30D158]' },
                      h(Icon.CheckCircle2, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
                      `Total Qty Matched (${totalExpected.toLocaleString()} pcs)`
                    )
                  : ['missing', 'short', 'over', 'extra', 'ok'].map((s) => {
                      if (report.counts[s] === 0) return null;
                      const style = STATUS_STYLE[s];
                      const Ic = style.Icon;
                      return h(
                        'span',
                        { key: s, className: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-semibold ${style.badge}` },
                        h(Ic, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
                        `${report.counts[s]} ${statusLabel(s)}`
                      );
                    })
              ),
              // View toggle button: Hide / Show Product Code & Model
              h(
                'button',
                {
                  type: 'button',
                  onClick: toggleHideCodeAndModel,
                  title: hideCodeAndModel ? 'Show Product Code and Model columns' : 'Hide Product Code and Model to focus purely on quantities',
                  className: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition cursor-pointer ${
                    hideCodeAndModel
                      ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 border-black/[0.06] dark:border-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]'
                  }`,
                },
                h(hideCodeAndModel ? Icon.EyeOff : Icon.Columns, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
                hideCodeAndModel ? 'Focus Mode Active (Code & Model Hidden)' : 'Hide Code & Model (Focus Qty)'
              )
            ),

            // Table of results with tfoot totals
            h(
              'div',
              { className: 'overflow-x-auto border border-black/[0.06] dark:border-white/[0.08] rounded-[12px]' },
              h(
                'table',
                { className: 'w-full text-[14px]' },
                h(
                  'thead',
                  null,
                  h(
                    'tr',
                    { className: 'bg-black/[0.02] dark:bg-white/[0.04] text-gray-500 dark:text-gray-400 text-[12px] font-semibold uppercase tracking-wide' },
                    !hideCodeAndModel && h('th', { className: 'p-3 text-left w-36' }, 'Product Code'),
                    !hideCodeAndModel && h('th', { className: 'p-3 text-left' }, 'Model'),
                    h('th', { className: 'p-3 text-center w-28' }, 'Expected Qty'),
                    h('th', { className: 'p-3 text-center w-28' }, 'Sheet Qty'),
                    h('th', { className: 'p-3 text-center w-24' }, 'Diff'),
                    h('th', { className: 'p-3 text-center w-28' }, 'Status')
                  )
                ),
                h(
                  'tbody',
                  { className: 'divide-y divide-black/[0.04] dark:divide-white/[0.06]' },
                  report.results.map((r, rIdx) => {
                    const style = STATUS_STYLE[r.status];
                    const Ic = style.Icon;
                    return h(
                      'tr',
                      { key: r.code8D || `res-${rIdx}`, className: 'text-gray-800 dark:text-gray-200 hover:bg-black/[0.01] dark:hover:bg-white/[0.02]' },
                      !hideCodeAndModel && h('td', { className: 'p-3 font-semibold' }, r.code8D),
                      !hideCodeAndModel && h('td', { className: 'p-3 text-gray-500 dark:text-gray-400' }, r.description || '—'),
                      h('td', { className: 'p-3 text-center font-medium tabular-nums' }, Number(r.expectedQty).toLocaleString()),
                      h('td', { className: 'p-3 text-center font-medium tabular-nums' }, Number(r.actualQty).toLocaleString()),
                      h(
                        'td',
                        {
                          className: `p-3 text-center font-semibold tabular-nums ${
                            r.diff === 0 ? 'text-gray-400' : r.diff < 0 ? 'text-[#FF3B30] dark:text-[#FF453A]' : 'text-[#FF9500] dark:text-[#FF9F0A]'
                          }`,
                        },
                        r.diff > 0 ? `+${r.diff.toLocaleString()}` : r.diff.toLocaleString()
                      ),
                      h(
                        'td',
                        { className: 'p-3 text-center' },
                        h(
                          'span',
                          { className: `inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${style.badge}` },
                          h(Ic, { className: 'w-3 h-3', strokeWidth: 1.5 }),
                          statusLabel(r.status)
                        )
                      )
                    );
                  })
                ),
                // Summary Footer with Total Quantity
                h(
                  'tfoot',
                  { className: 'bg-black/[0.03] dark:bg-white/[0.06] border-t-2 border-black/[0.08] dark:border-white/[0.12] text-gray-900 dark:text-white font-semibold' },
                  h(
                    'tr',
                    null,
                    h(
                      'td',
                      {
                        colSpan: hideCodeAndModel ? 1 : 2,
                        className: 'p-3 text-right uppercase text-[12px] tracking-wider text-gray-600 dark:text-gray-300'
                      },
                      'Total Quantity:'
                    ),
                    h('td', { className: 'p-3 text-center font-bold text-gray-900 dark:text-white tabular-nums' }, totalExpected.toLocaleString()),
                    h('td', { className: 'p-3 text-center font-bold text-[#007AFF] dark:text-[#0A84FF] tabular-nums' }, totalSheet.toLocaleString()),
                    h(
                      'td',
                      {
                        className: `p-3 text-center font-bold tabular-nums ${
                          totalDiff === 0
                            ? 'text-[#34C759] dark:text-[#30D158]'
                            : totalDiff < 0
                            ? 'text-[#FF3B30] dark:text-[#FF453A]'
                            : 'text-[#FF9500] dark:text-[#FF9F0A]'
                        }`,
                      },
                      totalDiff > 0 ? `+${totalDiff.toLocaleString()}` : totalDiff.toLocaleString()
                    ),
                    h(
                      'td',
                      { className: 'p-3 text-center text-[12px]' },
                      totalDiff === 0
                        ? h('span', { className: 'inline-flex items-center gap-1 text-[#34C759] dark:text-[#30D158] font-bold' },
                            h(Icon.CheckCircle2, { className: 'w-3.5 h-3.5' }),
                            'Match'
                          )
                        : h('span', { className: 'inline-flex items-center gap-1 text-[#FF3B30] dark:text-[#FF453A] font-bold' },
                            h(Icon.AlertTriangle, { className: 'w-3.5 h-3.5' }),
                            'Diff'
                          )
                    )
                  )
                )
              )
            )
          )
    );

    const footer = h(
      'div',
      { className: 'px-6 py-4 bg-black/[0.02] dark:bg-white/[0.04] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0' },
      h(
        'div',
        { className: 'text-[12px] text-gray-500 dark:text-gray-400' },
        hasResults && h('span', null, `Total rows compared: `, h('strong', { className: 'text-gray-800 dark:text-gray-200' }, report.results.length))
      ),
      h('button', { onClick: onClose, className: 'px-5 py-2.5 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white text-[13px] font-semibold rounded-[10px] transition cursor-pointer' }, 'Close')
    );

    return h(
      'div',
      { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm' },
      h(
        'div',
        { className: 'bg-white dark:bg-[#1C1C1E] rounded-[16px] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden transition-colors' },
        header,
        body,
        footer
      )
    );
  };

  window.ConfirmVerifyModal = ConfirmVerifyModal;
})();
