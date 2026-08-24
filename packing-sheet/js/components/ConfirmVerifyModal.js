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

    const hasResults = report && report.results && report.results.length > 0;

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
              report && report.overallPass
                ? 'bg-[#34C759]/10 text-[#34C759] dark:bg-[#30D158]/15 dark:text-[#30D158]'
                : 'bg-[#FF3B30]/10 text-[#FF3B30] dark:bg-[#FF453A]/15 dark:text-[#FF453A]'
            }`,
          },
          h(Icon.ClipboardCheck, { className: 'w-5 h-5', strokeWidth: 1.5 })
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
            h(
              'div',
              { className: `p-4 rounded-[12px] flex items-center gap-3 text-[15px] font-semibold ${
                  report.overallPass
                    ? 'bg-[#34C759]/[0.08] text-[#34C759] dark:bg-[#30D158]/[0.12] dark:text-[#30D158]'
                    : 'bg-[#FF3B30]/[0.08] text-[#FF3B30] dark:bg-[#FF453A]/[0.12] dark:text-[#FF453A]'
                }` },
              report.overallPass
                ? h(Icon.CheckCircle2, { className: 'w-5 h-5 shrink-0', strokeWidth: 1.5 })
                : h(Icon.AlertTriangle, { className: 'w-5 h-5 shrink-0', strokeWidth: 1.5 }),
              h('span', null, report.overallPass ? 'All quantities match the D.O. perfectly!' : 'Discrepancies detected — review the items below.')
            ),
            h(
              'div',
              { className: 'flex flex-wrap gap-2' },
              ['missing', 'short', 'over', 'extra', 'ok'].map((s) => {
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
                    h('th', { className: 'p-3 text-left' }, 'Product Code'),
                    h('th', { className: 'p-3 text-left' }, 'Model'),
                    h('th', { className: 'p-3 text-center' }, 'Expected Qty'),
                    h('th', { className: 'p-3 text-center' }, 'Sheet Qty'),
                    h('th', { className: 'p-3 text-center' }, 'Diff'),
                    h('th', { className: 'p-3 text-center' }, 'Status')
                  )
                ),
                h(
                  'tbody',
                  { className: 'divide-y divide-black/[0.04] dark:divide-white/[0.06]' },
                  report.results.map((r) => {
                    const style = STATUS_STYLE[r.status];
                    const Ic = style.Icon;
                    return h(
                      'tr',
                      { key: r.code8D, className: 'text-gray-800 dark:text-gray-200' },
                      h('td', { className: 'p-3 font-semibold' }, r.code8D),
                      h('td', { className: 'p-3 text-gray-500 dark:text-gray-400' }, r.description || '—'),
                      h('td', { className: 'p-3 text-center font-medium' }, r.expectedQty),
                      h('td', { className: 'p-3 text-center font-medium' }, r.actualQty),
                      h(
                        'td',
                        {
                          className: `p-3 text-center font-semibold ${
                            r.diff === 0 ? 'text-gray-400' : r.diff < 0 ? 'text-[#FF3B30] dark:text-[#FF453A]' : 'text-[#FF9500] dark:text-[#FF9F0A]'
                          }`,
                        },
                        r.diff > 0 ? `+${r.diff}` : r.diff
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
                )
              )
            )
          )
    );

    const footer = h(
      'div',
      { className: 'px-6 py-4 bg-black/[0.02] dark:bg-white/[0.04] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-end shrink-0' },
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
