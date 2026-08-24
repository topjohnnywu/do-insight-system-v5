/* StatsBar component (classic script → window.StatsBar). UI/logic verbatim; uses global h, Icon, ExcelExport. */
(function () {
  const { useMemo } = React;
  const getPackageUnitLabel = window.ExcelExport.getPackageUnitLabel;

  const StatsBar = ({ items, lookupDb = [], doNo = '', customer = '' }) => {
    const unitInfo = useMemo(() => getPackageUnitLabel(items), [items]);

    // Pre-defined totals for the selected D.O., aggregated from the source-file
    // lookup DB. These are the "expected" quantities that exist even when the
    // user has not typed anything into the sheet rows yet.
    const doTotals = useMemo(() => {
      const matches = window.LookupParser.findMatchesForDo(lookupDb, doNo, customer);
      let qty = 0;
      let cartons = 0;
      let hasQty = false;
      let hasCartons = false;

      matches.forEach((e) => {
        const q = typeof e.qty === 'number' ? (isNaN(e.qty) ? 0 : e.qty) : parseFloat(String(e.qty || '').replace(/,/g, '').trim());
        if (!isNaN(q) && q > 0) {
          qty += q;
          hasQty = true;
        }
        const c = typeof e.totalCarton === 'number' ? (isNaN(e.totalCarton) ? 0 : e.totalCarton) : parseFloat(String(e.totalCarton || '').replace(/,/g, '').trim());
        if (!isNaN(c) && c > 0) {
          cartons += c;
          hasCartons = true;
        }
      });

      return { qty, cartons, hasQty, hasCartons };
    }, [lookupDb, doNo, customer]);

    const stats = useMemo(() => {
      let totalQty = 0;
      let totalCartons = 0;
      let totalWeight = 0;
      let totalCbm = 0;

      const uniqueSkids = new Set();
      const uniqueBoxes = new Set();

      items.forEach((item) => {
        const skidLabel = (item.skidNo || '').trim().toUpperCase();
        if (skidLabel) {
          if (skidLabel.includes('BOX')) uniqueBoxes.add(skidLabel);
          else uniqueSkids.add(skidLabel);
        }

        const qty = typeof item.qty === 'number'
          ? (isNaN(item.qty) ? 0 : item.qty)
          : parseFloat(String(item.qty || '0').replace(/,/g, '').trim());
        if (!isNaN(qty)) totalQty += qty;

        const carton = typeof item.totalCarton === 'number'
          ? (isNaN(item.totalCarton) ? 0 : item.totalCarton)
          : parseFloat(String(item.totalCarton || '0').replace(/,/g, '').trim());
        if (!isNaN(carton)) totalCartons += carton;

        const weight = typeof item.weightKg === 'number'
          ? (isNaN(item.weightKg) ? 0 : item.weightKg)
          : parseFloat(String(item.weightKg || '0').replace(/,/g, '').trim());
        if (!isNaN(weight)) totalWeight += weight;

        const l = typeof item.lengthCm === 'number' ? item.lengthCm : parseFloat(String(item.lengthCm || '0').replace(/,/g, '').trim());
        const w = typeof item.widthCm === 'number' ? item.widthCm : parseFloat(String(item.widthCm || '0').replace(/,/g, '').trim());
        const hgt = typeof item.heightCm === 'number' ? item.heightCm : parseFloat(String(item.heightCm || '0').replace(/,/g, '').trim());
        if (!isNaN(l) && !isNaN(w) && !isNaN(hgt) && l > 0 && w > 0 && hgt > 0) {
          totalCbm += (l * w * hgt) / 1000000;
        }
      });

      let skidCountDisplay = 0;
      if (uniqueSkids.size > 0 && uniqueBoxes.size > 0) {
        skidCountDisplay = `${uniqueSkids.size} Skid${uniqueSkids.size > 1 ? 's' : ''}, ${uniqueBoxes.size} Box${uniqueBoxes.size > 1 ? 'es' : ''}`;
      } else if (uniqueBoxes.size > 0) {
        skidCountDisplay = uniqueBoxes.size;
      } else if (uniqueSkids.size > 0) {
        skidCountDisplay = uniqueSkids.size;
      } else if (items.length > 0) {
        skidCountDisplay = 1;
      }

      // Fallback: if the user hasn't typed any quantity into the rows yet,
      // show the D.O.'s pre-defined totals from the source file instead of 0.
      const qtyIsFallback = totalQty === 0 && doTotals.hasQty;
      const cartonIsFallback = totalCartons === 0 && doTotals.hasCartons;
      const displayQty = qtyIsFallback ? doTotals.qty : totalQty;
      const displayCartons = cartonIsFallback ? doTotals.cartons : totalCartons;

      return {
        skidCount: skidCountDisplay,
        totalQty: displayQty,
        totalCartons: displayCartons,
        totalWeight: Math.round(totalWeight * 100) / 100,
        totalCbm: Math.round(totalCbm * 1000) / 1000,
        qtyIsFallback,
        cartonIsFallback,
      };
    }, [items, doTotals]);

    const statCards = [
      {
        label: unitInfo.totalLabel,
        value: stats.skidCount,
        icon: h(Icon.Layers, { className: 'w-5 h-5', strokeWidth: 1.5 }),
        iconBg: 'bg-[#007AFF]/10 dark:bg-[#0A84FF]/20',
        iconColor: 'text-[#007AFF] dark:text-[#0A84FF]',
      },
      {
        label: 'Total Quantity',
        value: stats.totalQty.toLocaleString(),
        estimated: stats.qtyIsFallback,
        icon: h(Icon.Package, { className: 'w-5 h-5', strokeWidth: 1.5 }),
        iconBg: 'bg-[#34C759]/10 dark:bg-[#30D158]/20',
        iconColor: 'text-[#34C759] dark:text-[#30D158]',
      },
      {
        label: 'Total Cartons',
        value: stats.totalCartons.toLocaleString(),
        estimated: stats.cartonIsFallback,
        icon: h(Icon.Package, { className: 'w-5 h-5', strokeWidth: 1.5 }),
        iconBg: 'bg-[#FF9500]/10 dark:bg-[#FF9F0A]/20',
        iconColor: 'text-[#FF9500] dark:text-[#FF9F0A]',
      },
      {
        label: 'Gross Weight (kg)',
        value: stats.totalWeight.toLocaleString(),
        icon: h(Icon.Weight, { className: 'w-5 h-5', strokeWidth: 1.5 }),
        iconBg: 'bg-[#FF3B30]/10 dark:bg-[#FF453A]/20',
        iconColor: 'text-[#FF3B30] dark:text-[#FF453A]',
      },
      {
        label: 'Total CBM',
        value: stats.totalCbm.toFixed(3),
        icon: h(Icon.Maximize, { className: 'w-5 h-5', strokeWidth: 1.5 }),
        iconBg: 'bg-[#AF52DE]/10 dark:bg-[#BF5AF2]/20',
        iconColor: 'text-[#AF52DE] dark:text-[#BF5AF2]',
      },
    ];

    return h(
      'div',
      { className: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3' },
      statCards.map((card, idx) =>
        h(
          'div',
          {
            key: idx,
            className:
              'bg-white dark:bg-[#1C1C1E] rounded-[14px] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_0.5px_2px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3.5 transition-colors duration-300',
          },
          h(
            'div',
            {
              className: `${card.iconBg} ${card.iconColor} p-2.5 rounded-[10px] flex items-center justify-center shrink-0`,
            },
            card.icon
          ),
          h(
            'div',
            { className: 'min-w-0' },
            h(
              'p',
              { className: 'text-[13px] font-medium text-gray-500 dark:text-gray-400 leading-tight flex items-center gap-1.5' },
              h('span', null, card.label),
              card.estimated &&
                h(
                  'span',
                  {
                    className:
                      'inline-flex items-center px-1.5 py-px rounded-full bg-black/[0.05] dark:bg-white/[0.1] text-gray-500 dark:text-gray-400 text-[10px] font-semibold uppercase tracking-wide shrink-0',
                    title: 'Expected total from the selected D.O. (no quantity entered in rows yet)',
                  },
                  'est.'
                )
            ),
            h('p', { className: 'text-[20px] font-semibold text-gray-900 dark:text-white leading-tight mt-0.5 truncate' }, card.value)
          )
        )
      )
    );
  };

  window.StatsBar = StatsBar;
})();
