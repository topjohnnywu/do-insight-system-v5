/* Root App component (classic script -> window.App). UI/logic verbatim. */
(function () {
  const { useState, useEffect } = React;
  const { INITIAL_HEADER, INITIAL_ITEMS, SAMPLE_LOOKUP_DATABASE } = window.SampleData;
  const { exportToExcel, exportBulkSummaryToExcel, exportToCSV } = window.ExcelExport;
  const { verifyAgainstDo } = window.VerifyDo;
  const { entryCustomer } = window.LookupParser;

  const PACKING_SHEET_HEADER_KEY = 'packing_sheet_header_v1';
  const PACKING_SHEET_ITEMS_KEY = 'packing_sheet_items_v1';
  const PACKING_SHEET_SAVED_AT_KEY = 'packing_sheet_saved_at_v1';
  const PACKING_SHEET_LOOKUP_KEY = 'packing_sheet_lookup_v1';
  const PACKING_SHEET_THEME_KEY = 'packing_sheet_theme_v1';
  const PACKING_SHEET_DO_CACHE_KEY = 'packing_sheet_do_cache_v1';
  const PACKING_SHEET_HIDE_SSEA_CARTON_KEY = 'packing_sheet_hide_ssea_carton_v1';

  // Inline SVG customer badge for toast notifications.
  const CustomerLogo = ({ variant }) => {
    const isMscsj = variant === 'mscsj';
    const bg = isMscsj ? '#FF9500' : '#007AFF';
    const label = isMscsj ? 'M' : 'S';
    return h(
      'svg',
      { width: 24, height: 24, viewBox: '0 0 24 24', role: 'img', 'aria-label': isMscsj ? 'MSCSJ' : 'SSEA', className: 'shrink-0' },
      h('rect', { x: 0, y: 0, width: 24, height: 24, rx: 6, fill: bg }),
      h(
        'text',
        {
          x: 12, y: 16.5, textAnchor: 'middle',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 13, fontWeight: 700, fill: '#ffffff',
        },
        label
      )
    );
  };

  function App() {
    const [header, setHeader] = useState(() => {
      try {
        const savedHeader = localStorage.getItem(PACKING_SHEET_HEADER_KEY);
        if (savedHeader) {
          const parsed = JSON.parse(savedHeader);
          // Normalize SHIP BY: FCL was removed — fall back to the customer default
          // (SSEA → LCL, MSCSJ → AIR) if the saved value is FCL or missing.
          if (parsed && typeof parsed === 'object') {
            if (parsed.shipBy !== 'LCL' && parsed.shipBy !== 'AIR') {
              parsed.shipBy = parsed.customer === 'MSCSJ' ? 'AIR' : 'LCL';
            }
          }
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved header from local storage', e);
      }
      return INITIAL_HEADER;
    });

    const [items, setItems] = useState(() => {
      try {
        const savedItems = localStorage.getItem(PACKING_SHEET_ITEMS_KEY);
        if (savedItems) {
          const parsed = JSON.parse(savedItems);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved items from local storage', e);
      }
      return INITIAL_ITEMS;
    });

    const [lookupDb, setLookupDb] = useState(() => {
      try {
        const saved = localStorage.getItem(PACKING_SHEET_LOOKUP_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved lookup database from local storage', e);
      }
      return SAMPLE_LOOKUP_DATABASE;
    });

    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [isQuickImportOpen, setIsQuickImportOpen] = useState(false);
    const [isMasterLookupOpen, setIsMasterLookupOpen] = useState(false);
    const [isVerifyOpen, setIsVerifyOpen] = useState(false);
    const [verifyReport, setVerifyReport] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [toastLogo, setToastLogo] = useState(null);

    const [doCache, setDoCache] = useState(() => {
      try {
        const saved = localStorage.getItem(PACKING_SHEET_DO_CACHE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {
        console.error('Failed to parse D.O. cache from local storage', e);
      }
      return {};
    });

    const [hideSseaTotalCarton, setHideSseaTotalCarton] = useState(() => {
      try {
        const saved = localStorage.getItem(PACKING_SHEET_HIDE_SSEA_CARTON_KEY);
        return saved !== null ? JSON.parse(saved) : true;
      } catch (e) {
        return true;
      }
    });

    useEffect(() => {
      try {
        localStorage.setItem(PACKING_SHEET_HIDE_SSEA_CARTON_KEY, JSON.stringify(hideSseaTotalCarton));
      } catch (e) {
        console.error('Failed to save hideSseaTotalCarton to local storage', e);
      }
    }, [hideSseaTotalCarton]);

    const getHostTheme = () => {
      try {
        const saved = localStorage.getItem('AppThemeMode');
        return saved === 'light' ? 'light' : 'dark';
      } catch (e) {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    };

    const [theme, setTheme] = useState(getHostTheme);

    // Apply / persist theme
    useEffect(() => {
      const root = document.documentElement;
      if (theme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');

      try {
        const currentGlobalTheme = localStorage.getItem('AppThemeMode') || 'linear';
        const isGlobalLight = currentGlobalTheme === 'light';
        
        if (theme === 'light' && !isGlobalLight) {
          localStorage.setItem('AppThemeMode', 'light');
        } else if (theme === 'dark' && isGlobalLight) {
          localStorage.setItem('AppThemeMode', 'linear');
        }
      } catch (e) {
        console.error('Failed to save theme to local storage', e);
      }

      const handleStorage = (e) => {
        if (e.key === 'AppThemeMode') {
          setTheme(e.newValue === 'light' ? 'light' : 'dark');
        }
      };
      
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }, [theme]);

    // Toast with auto-dismiss
    const toastTimerRef = React.useRef(null);
    const showToast = (message, logo) => {
      setToastMessage(message);
      setToastLogo(logo || null);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
    };

    // Auto-save (debounced 300ms) header/items/lookup
    useEffect(() => {
      const t = setTimeout(() => {
        try {
          localStorage.setItem(PACKING_SHEET_HEADER_KEY, JSON.stringify(header));
          localStorage.setItem(PACKING_SHEET_ITEMS_KEY, JSON.stringify(items));
          localStorage.setItem(PACKING_SHEET_LOOKUP_KEY, JSON.stringify(lookupDb));
          const stamp = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
          localStorage.setItem(PACKING_SHEET_SAVED_AT_KEY, stamp);
          setLastSavedAt(stamp);
        } catch (e) {
          console.error('Failed to auto-save to local storage', e);
        }
      }, 300);
      return () => clearTimeout(t);
    }, [header, items, lookupDb]);

    // Persist D.O. cache
    useEffect(() => {
      try {
        localStorage.setItem(PACKING_SHEET_DO_CACHE_KEY, JSON.stringify(doCache));
      } catch (e) {
        console.error('Failed to save D.O. cache to local storage', e);
      }
    }, [doCache]);

    // Switch the active D.O., caching the outgoing sheet state per D.O. for instant recall.
    const handleDoNoSwitch = (newDoNo) => {
      const trimmedNew = (newDoNo || '').trim();
      const trimmedCurrent = (header.doNo || '').trim();

      // Save outgoing sheet to cache if we have a current DO
      if (trimmedCurrent) {
        setDoCache((prev) => ({
          ...prev,
          [trimmedCurrent]: { header, items },
        }));
      }

      const matches = window.LookupParser.findMatchesForDo(lookupDb, trimmedNew, header.customer);
      const destMatch = matches.find((e) => e.destination && e.destination.trim() !== '');
      const autoDest = destMatch ? destMatch.destination : '';
      const cached = doCache[trimmedNew];

      let newHeader = {
        ...(cached ? cached.header : header),
        doNo: trimmedNew,
        destination: autoDest || (cached && cached.header ? cached.header.destination : header.destination),
        packBy: cached && cached.header ? cached.header.packBy : (header.packBy || ''),
        approvedBy: cached && cached.header ? cached.header.approvedBy : (header.approvedBy || ''),
      };

      // Do NOT automatically fill models and quantities. Restore cached session if available, else keep existing items structure or create blank.
      let newItems = [];
      if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
        newItems = cached.items;
      } else {
        // Retain existing number of rows or start with 1 blank row without auto-filling models/qty
        newItems = items && items.length > 0
          ? items.map((it, idx) => ({
              ...it,
              skidNo: it.skidNo || (idx === 0 ? 'SKID-01' : ''),
              code8D: '',
              qty: '',
              totalCarton: '',
            }))
          : window.SampleData.createBlankItems(1);
      }

      setHeader(newHeader);
      setItems(newItems);

      if (cached) {
        showToast(`Loaded working sheet for ${trimmedNew}`);
      } else {
        showToast(`Selected ${trimmedNew}`);
      }
    };

    const handleClearAll = async () => {
      const confirmed = await window.ConfirmDialog.confirm({
        title: 'Clear All Rows?',
        subtitle: 'Reset the current sheet',
        message: 'Are you sure you want to clear all rows and reset the form?\n\nThis cannot be undone.',
        confirmLabel: 'Clear All',
        cancelLabel: 'Cancel',
        tone: 'danger',
        icon: Icon.Trash2,
      });
      if (!confirmed) return;

      setItems(window.SampleData.createBlankItems(1));
      setHeader(INITIAL_HEADER);
      showToast('Sheet cleared');
    };

    const handleAutoSkidNumbering = () => {
      setItems((prev) =>
        prev.map((item, index) => ({
          ...item,
          skidNo: `SKID-${(index + 1).toString().padStart(2, '0')}`,
        }))
      );
    };

    const handleImportPastedItems = (newItems, append) => {
      setItems((prev) => {
        if (append) return [...prev, ...newItems];
        return newItems;
      });
      showToast(append ? `Appended ${newItems.length} row(s)` : `Imported ${newItems.length} row(s)`);
    };

    const handleApplyLookupToCurrentSheet = (rawMatchingEntries, selectedDo) => {
      if (!rawMatchingEntries || rawMatchingEntries.length === 0) return;
      const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      const matchingEntries = window.LookupParser.aggregateEntriesByProductCode
        ? window.LookupParser.aggregateEntriesByProductCode(rawMatchingEntries, activeCustomer)
        : rawMatchingEntries;
      if (matchingEntries.length === 0) return;

      let newItems = [];
      const hasMeasurements = items.some(
        (it) => it.weightKg !== '' || it.lengthCm !== '' || it.widthCm !== '' || it.heightCm !== ''
      );

      if (hasMeasurements) {
        newItems = items.map((item, idx) => {
          if (idx < matchingEntries.length) {
            const entry = matchingEntries[idx];
            const qVal = entry.qty !== undefined && entry.qty !== '' ? entry.qty : item.qty;
            let ctnVal = '';
            if (activeCustomer === 'MSCSJ') {
              if (qVal !== '' && qVal !== undefined) {
                const numQ = typeof qVal === 'number' ? qVal : parseFloat(String(qVal).replace(/,/g, ''));
                if (!isNaN(numQ) && numQ > 0) ctnVal = Math.ceil(numQ / 5);
              } else {
                ctnVal = typeof entry.totalCarton === 'number' ? entry.totalCarton : item.totalCarton;
              }
            } else {
              // Customer SSEA: Never auto-fill totalCarton, retain manual entry if already present
              ctnVal = item.totalCarton !== undefined && item.totalCarton !== '' ? item.totalCarton : '';
            }
            return {
              ...item,
              code8D: entry.code8D || item.code8D,
              qty: qVal,
              totalCarton: ctnVal,
            };
          }
          return item;
        });

        if (matchingEntries.length > items.length) {
          for (let i = items.length; i < matchingEntries.length; i++) {
            const entry = matchingEntries[i];
            let ctnVal = '';
            if (activeCustomer === 'MSCSJ') {
              if (entry.qty !== '' && entry.qty !== undefined) {
                const numQ = typeof entry.qty === 'number' ? entry.qty : parseFloat(String(entry.qty).replace(/,/g, ''));
                if (!isNaN(numQ) && numQ > 0) ctnVal = Math.ceil(numQ / 5);
              } else {
                ctnVal = typeof entry.totalCarton === 'number' ? entry.totalCarton : '';
              }
            } else {
              // Customer SSEA: Leave totalCarton empty for manual entry
              ctnVal = '';
            }
            newItems.push({
              id: 'autofill-' + Date.now() + '-' + i,
              skidNo: '',
              code8D: entry.code8D || '',
              qty: entry.qty !== undefined ? entry.qty : '',
              totalCarton: ctnVal,
              weightKg: entry.weightKg !== undefined ? entry.weightKg : '',
              lengthCm: entry.lengthCm !== undefined ? entry.lengthCm : '',
              widthCm: entry.widthCm !== undefined ? entry.widthCm : '',
              heightCm: entry.heightCm !== undefined ? entry.heightCm : '',
            });
          }
        }
      } else {
        newItems = matchingEntries.map((entry, idx) => {
          let ctnVal = '';
          if (activeCustomer === 'MSCSJ') {
            if (entry.qty !== '' && entry.qty !== undefined) {
              const numQ = typeof entry.qty === 'number' ? entry.qty : parseFloat(String(entry.qty).replace(/,/g, ''));
              if (!isNaN(numQ) && numQ > 0) ctnVal = Math.ceil(numQ / 5);
            } else {
              ctnVal = typeof entry.totalCarton === 'number' ? entry.totalCarton : '';
            }
          } else {
            // Customer SSEA: Leave totalCarton empty for manual entry
            ctnVal = '';
          }
          return {
            id: `lookup-${Date.now()}-${idx}`,
            skidNo: idx === 0 ? 'SKID-01' : '',
            code8D: entry.code8D || '',
            qty: entry.qty !== undefined ? entry.qty : '',
            totalCarton: ctnVal,
            weightKg: entry.weightKg !== undefined ? entry.weightKg : '',
            lengthCm: entry.lengthCm !== undefined ? entry.lengthCm : '',
            widthCm: entry.widthCm !== undefined ? entry.widthCm : '',
            heightCm: entry.heightCm !== undefined ? entry.heightCm : '',
          };
        });
      }

      setHeader((prev) => ({
        ...prev,
        doNo: selectedDo,
        destination: matchingEntries.find((e) => e.destination)?.destination || prev.destination,
      }));
      setItems(newItems);

      const firstCustomer = matchingEntries.find((e) => e.customer)?.customer;
      const logo = firstCustomer === 'MSCSJ' ? 'mscsj' : 'ssea';
      showToast(`Loaded ${newItems.length} item(s) for ${selectedDo}`, logo);
    };

    const handleResetLookup = () => {
      const activeCustomer = header.customer || '';
      const custKey = activeCustomer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      setLookupDb((prev) => prev.filter((e) => entryCustomer(e) !== custKey));
      setDoCache((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((doNo) => {
          const stateCust = updated[doNo]?.header?.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
          if (stateCust === custKey) {
            delete updated[doNo];
          }
        });
        return updated;
      });
      showToast(`Reset source library and session cache for ${custKey}`);
    };

    const handleUploadNewSource = (newEntries, targetCustomer) => {
      const custKey = targetCustomer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      // Replace lookup database entries for this customer so old files don't accumulate
      setLookupDb((prev) => [
        ...prev.filter((e) => entryCustomer(e) !== custKey),
        ...newEntries,
      ]);

      // Clear working D.O. cache for this customer so older D.O.s from previous source are not exported
      setDoCache((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((doNo) => {
          const stateCust = updated[doNo]?.header?.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
          if (stateCust === custKey) {
            delete updated[doNo];
          }
        });
        return updated;
      });

      // Reset current active sheet for a clean slate with the new file
      setItems(window.SampleData.createBlankItems(1));
      setHeader((prev) => ({
        ...INITIAL_HEADER,
        customer: targetCustomer || '',
        shipBy: targetCustomer === 'MSCSJ' ? 'AIR' : 'LCL',
      }));

      showToast(`Source loaded: ${newEntries.length} items. D.O. cache reset for ${custKey}.`, targetCustomer === 'MSCSJ' ? 'mscsj' : 'ssea');
    };

    const handleNewBatchSession = async () => {
      const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      const confirmed = await window.ConfirmDialog.confirm({
        title: 'Start New Batch Session?',
        subtitle: `Clear cached D.O. sheets for ${activeCustomer}`,
        message: `Clear all working D.O. sheets in memory for ${activeCustomer}?\n\nThis ensures only your new D.O.s will be included when exporting Bulk Summary / Bulk Simplify. Your uploaded source file records will be kept.`,
        confirmLabel: 'New Batch Session',
        cancelLabel: 'Cancel',
        tone: 'danger',
        icon: Icon.RotateCcw,
      });
      if (!confirmed) return;

      setDoCache((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((doNo) => {
          const stateCust = updated[doNo]?.header?.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
          if (stateCust === activeCustomer) {
            delete updated[doNo];
          }
        });
        return updated;
      });

      setItems(window.SampleData.createBlankItems(1));
      setHeader((prev) => ({
        ...INITIAL_HEADER,
        customer: prev.customer || '',
        shipBy: prev.customer === 'MSCSJ' ? 'AIR' : 'LCL',
      }));

      showToast(`New batch session started for ${activeCustomer} (cache cleared)`);
    };

    const handleVerifyDo = () => {
      const matches = header.doNo
        ? window.LookupParser.findMatchesForDo(lookupDb, header.doNo, header.customer)
        : [];
      const report = verifyAgainstDo(items, matches);
      setVerifyReport(report);
      setIsVerifyOpen(true);
    };

    const handleExportExcel = () => exportToExcel(header, items, undefined, { lookupDb, hideSseaTotalCarton });
    const handleExportSimplified = () => exportToExcel(header, items, undefined, { isSimplified: true, lookupDb, hideSseaTotalCarton });
    const handleExportHandwrittenTemplate = () => exportToExcel(header, items, undefined, { isHandwrittenTemplate: true, blankRowCount: 20, lookupDb, hideSseaTotalCarton });
    const handleExportCSV = () => exportToCSV(header, items, undefined, { lookupDb, hideSseaTotalCarton });
    const handlePrint = () => window.print();

    const handleExportBulkSimplified = () => {
      const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      const currentDo = header.doNo.trim();
      const sheets = [];

      if (currentDo) {
        if (activeCustomer !== 'SSEA' || header.shipBy === 'LCL') {
          sheets.push({ header, items });
        }
      }

      Object.entries(doCache).forEach(([doNo, state]) => {
        if (doNo === currentDo) return;
        
        const stateCustomer = state.header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
        if (stateCustomer === activeCustomer) {
          if (activeCustomer !== 'SSEA' || state.header.shipBy === 'LCL') {
            sheets.push({ header: state.header, items: state.items });
          }
        }
      });
      if (sheets.length === 0) {
        showToast(activeCustomer === 'SSEA' ? 'No LCL D.O. sheets available to export' : 'No D.O. sheets available to export');
        return;
      }
      exportBulkSummaryToExcel(sheets, 'Bulk_Simplified_Packing_Details.xlsx', { isSimplified: true, lookupDb, hideSseaTotalCarton });
      showToast(`Exported ${sheets.length} ${activeCustomer === 'SSEA' ? 'LCL ' : ''}simplified D.O. sheet(s) to Excel`);
    };

    const handleExportBulkSummary = () => {
      const activeCustomer = header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
      const currentDo = header.doNo.trim();
      const sheets = [];

      if (currentDo) {
        if (activeCustomer !== 'SSEA' || header.shipBy === 'LCL') {
          sheets.push({ header, items });
        }
      }

      Object.entries(doCache).forEach(([doNo, state]) => {
        if (doNo === currentDo) return;
        
        const stateCustomer = state.header.customer === 'MSCSJ' ? 'MSCSJ' : 'SSEA';
        if (stateCustomer === activeCustomer) {
          if (activeCustomer !== 'SSEA' || state.header.shipBy === 'LCL') {
            sheets.push({ header: state.header, items: state.items });
          }
        }
      });

      if (sheets.length === 0) {
        showToast(activeCustomer === 'SSEA' ? 'No LCL D.O. sheets available to export' : 'No D.O. sheets available to export');
        return;
      }

      exportBulkSummaryToExcel(sheets, undefined, { lookupDb, hideSseaTotalCarton });
      showToast(`Exported ${sheets.length} ${activeCustomer === 'SSEA' ? 'LCL ' : ''}D.O. sheet(s) to Excel`);
    };

    const handleToggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

    const subHeader = h(
      'div',
      { className: 'flex items-end justify-between px-1 print:hidden' },
      h(
        'div',
        null,
        h('h2', { className: 'text-[28px] font-semibold text-gray-900 dark:text-white tracking-[-0.02em]' }, 'Delivery Order Packing Manifest'),
        h('p', { className: 'text-[15px] text-gray-500 dark:text-gray-400 mt-1' }, 'Auto-calculate volumetric CBM, track pallet weight, and prepare ready-to-ship LCL packing lists.')
      ),
      h(
        'div',
        { className: 'flex items-center gap-2' },
        h(
          'button',
          {
            type: 'button',
            onClick: () => setIsMasterLookupOpen(true),
            className:
              'px-3.5 py-2 bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-gray-700 dark:text-gray-200 font-semibold rounded-[10px] transition cursor-pointer flex items-center gap-1.5 text-[13px] border border-black/[0.08] dark:border-white/[0.12]',
          },
          h(Icon.Database, { className: 'w-3.5 h-3.5 text-gray-600 dark:text-gray-300', strokeWidth: 1.5 }),
          h('span', null, 'Source File')
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: () => setIsQuickImportOpen(true),
            className: 'px-3 py-1.5 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold rounded-[10px] transition cursor-pointer flex items-center gap-1.5 text-[13px] shadow-[0_0.5px_2px_rgba(0,122,255,0.3)]',
          },
          h(Icon.Sparkles, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
          h('span', null, 'Bulk Paste')
        )
      )
    );

    const toast =
      toastMessage &&
      h(
        'div',
        { className: 'fixed bottom-8 right-8 z-50 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl text-gray-900 dark:text-white px-4 py-3 rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center gap-2.5 text-sm font-medium print:hidden border border-black/[0.06] dark:border-white/[0.08]' },
        toastLogo
          ? h(CustomerLogo, { variant: toastLogo })
          : h(
              'div',
              { className: 'w-6 h-6 rounded-full bg-[#34C759]/10 flex items-center justify-center shrink-0' },
              h(Icon.CheckCircle, { className: 'w-4 h-4 text-[#34C759]', strokeWidth: 1.5 })
            ),
        h('span', null, toastMessage)
      );

    return h(
      'div',
      { className: 'min-h-screen bg-[#F2F2F7] dark:bg-black transition-colors duration-300 print:bg-white' },
      h(
        'div',
        { className: 'max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 print:px-0 print:py-0 print:space-y-0' },
        h(window.HeaderControls, {
          onExportExcel: handleExportExcel,
          onExportHandwrittenTemplate: handleExportHandwrittenTemplate,
          onExportCSV: handleExportCSV,
          onPrint: handlePrint,
          onOpenMasterLookup: () => setIsMasterLookupOpen(true),
          lookupCount: lookupDb.length,
          lastSavedAt: lastSavedAt,
          theme: theme,
          onToggleTheme: handleToggleTheme,
        }),
        subHeader,
        h('div', { className: 'print:hidden' }, h(window.StatsBar, { items: items, lookupDb: lookupDb, doNo: header.doNo, customer: header.customer })),
        h(window.PackingSheetForm, {
          header: header,
          setHeader: setHeader,
          items: items,
          setItems: setItems,
          onAutoSkidNumbering: handleAutoSkidNumbering,
          lookupDb: lookupDb,
          onOpenMasterLookup: () => setIsMasterLookupOpen(true),
          onDoNoSwitch: handleDoNoSwitch,
          onVerify: handleVerifyDo,
          onClearAll: handleClearAll,
          onNewBatchSession: handleNewBatchSession,
          onExportExcel: handleExportExcel,
          onExportSimplified: handleExportSimplified,
          onExportBulkSummary: handleExportBulkSummary,
          onExportBulkSimplified: handleExportBulkSimplified,
          hideSseaTotalCarton: hideSseaTotalCarton,
          onToggleHideSseaTotalCarton: (val) => setHideSseaTotalCarton(val),
          onCustomerChange: (c) => showToast(`Switched to ${c === 'MSCSJ' ? 'MSCSJ' : 'SSEA'}`, c === 'MSCSJ' ? 'mscsj' : 'ssea'),
        }),
        toast,
        h(window.QuickImportModal, {
          isOpen: isQuickImportOpen,
          onClose: () => setIsQuickImportOpen(false),
          onImportItems: handleImportPastedItems,
        }),
        h(window.MasterLookupModal, {
          isOpen: isMasterLookupOpen,
          onClose: () => setIsMasterLookupOpen(false),
          lookupDb: lookupDb,
          setLookupDb: setLookupDb,
          currentDoNo: header.doNo,
          onApplyToCurrentSheet: handleApplyLookupToCurrentSheet,
          onResetLookup: handleResetLookup,
          onUploadNewSource: handleUploadNewSource,
          customer: header.customer || '',
        }),
        h(window.ConfirmVerifyModal, {
          isOpen: isVerifyOpen,
          onClose: () => setIsVerifyOpen(false),
          doNo: header.doNo,
          report: verifyReport,
        }),
        h(window.ConfirmDialog.Host, null)
      )
    );
  }

  window.App = App;
})();
