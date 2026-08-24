/* PackingSheetForm component (classic script -> window.PackingSheetForm). UI/logic verbatim. */
(function () {
  const { filterByCustomer } = window.LookupParser;
  const { getPackageUnitLabel } = window.ExcelExport;

  const PackingSheetForm = ({
    header, setHeader, items, setItems, onAutoSkidNumbering, lookupDb = [],
    onOpenMasterLookup, onDoNoSwitch, onVerify, onClearAll, onCustomerChange,
    onExportExcel, onExportSimplified, onExportBulkSummary, onExportBulkSimplified,
  }) => {
    const [containerUnit, setContainerUnit] = React.useState('SKID');

    const customerDb = React.useMemo(
      () => filterByCustomer(lookupDb, header.customer || ''),
      [lookupDb, header.customer]
    );

    const matchedLookupEntries = header.doNo
      ? window.LookupParser.findMatchesForDo(lookupDb, header.doNo, header.customer)
      : [];

    const availableModels = matchedLookupEntries.length > 0 ? matchedLookupEntries : customerDb;

    const uniqueAvailableCodes = React.useMemo(() => {
      const list = availableModels.map((m) => m.code8D.trim()).filter(Boolean);
      return Array.from(new Set(list));
    }, [availableModels]);

    const availableDoNumbers = React.useMemo(() => {
      const allDos = customerDb.map((e) => e.doNo && e.doNo.trim()).filter(Boolean);
      const isMscsj = header.customer === 'MSCSJ';
      if (isMscsj) return Array.from(new Set(allDos));
      const lclDos = allDos.filter((doNo) => doNo.toUpperCase().includes('LCL'));
      return Array.from(new Set(lclDos));
    }, [customerDb, header.customer]);

    const handleContainerUnitChange = (unit) => {
      setContainerUnit(unit);
      setItems((prev) =>
        prev.map((item) => {
          const currentLabel = item.skidNo.trim();
          if (!currentLabel) return item;
          if (/^(SKID|BOX)/i.test(currentLabel)) {
            return { ...item, skidNo: currentLabel.replace(/^(SKID|BOX)/i, unit) };
          }
          return { ...item, skidNo: unit + ' ' + currentLabel };
        })
      );
    };

    const handleAutoNumberingWithUnit = () => {
      setItems((prev) => {
        let currentNum = 0;
        let lastSkid = '';
        return prev.map((item) => {
          if (item.skidNo !== lastSkid) { currentNum++; lastSkid = item.skidNo; }
          return { ...item, skidNo: containerUnit + '-' + currentNum.toString().padStart(2, '0') };
        });
      });
    };

    const handleAutoFill8DCodes = (customMatches) => {
      const entries = Array.isArray(customMatches) && customMatches.length > 0 ? customMatches : matchedLookupEntries;
      if (entries.length === 0) return;
      const matchedDest = entries.find((e) => e.destination && e.destination.trim() !== '');
      const matchedDestVal = matchedDest ? matchedDest.destination : undefined;
      if (matchedDestVal && (!header.destination || header.destination.trim() === '')) {
        setHeader((prev) => ({ ...prev, destination: matchedDestVal }));
      }

      // If we have existing items with dimensions or weights, merge product codes and quantities into them
      const hasExistingMeasurements = items.some((it) => it.weightKg !== '' || it.lengthCm !== '' || it.widthCm !== '' || it.heightCm !== '');
      if (hasExistingMeasurements) {
        setItems((prev) => {
          const merged = prev.map((item, idx) => {
            if (idx < entries.length) {
              const entry = entries[idx];
              const qVal = entry.qty !== undefined && entry.qty !== '' ? entry.qty : item.qty;
              let ctnVal = typeof entry.totalCarton === 'number' ? entry.totalCarton : item.totalCarton;
              if (header.customer === 'MSCSJ' && qVal !== '' && qVal !== undefined) {
                const numQ = typeof qVal === 'number' ? qVal : parseFloat(String(qVal).replace(/,/g, ''));
                if (!isNaN(numQ) && numQ > 0) ctnVal = Math.ceil(numQ / 5);
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
          // If there are more lookup entries than existing items, append remaining
          if (entries.length > prev.length) {
            for (let i = prev.length; i < entries.length; i++) {
              const entry = entries[i];
              let ctnVal = typeof entry.totalCarton === 'number' ? entry.totalCarton : '';
              if (header.customer === 'MSCSJ' && entry.qty !== '' && entry.qty !== undefined) {
                const numQ = typeof entry.qty === 'number' ? entry.qty : parseFloat(String(entry.qty).replace(/,/g, ''));
                if (!isNaN(numQ) && numQ > 0) ctnVal = Math.ceil(numQ / 5);
              }
              merged.push({
                id: 'autofill-' + Date.now() + '-' + i,
                skidNo: '',
                code8D: entry.code8D,
                qty: entry.qty !== undefined ? entry.qty : '',
                totalCarton: ctnVal,
                weightKg: entry.weightKg !== undefined ? entry.weightKg : '',
                lengthCm: entry.lengthCm !== undefined ? entry.lengthCm : '',
                widthCm: entry.widthCm !== undefined ? entry.widthCm : '',
                heightCm: entry.heightCm !== undefined ? entry.heightCm : '',
              });
            }
          }
          return merged;
        });
        return;
      }

      const firstSkidLabel =
        items[0] && items[0].skidNo && items[0].skidNo.trim() !== '' ? items[0].skidNo : containerUnit + ' 01';
      const newItems = entries.map((entry, idx) => {
        const it = items[idx];
        const qVal = entry.qty !== undefined && entry.qty !== '' ? entry.qty : (it ? it.qty : '');
        let ctnVal = typeof entry.totalCarton === 'number' ? entry.totalCarton : (it && typeof it.totalCarton === 'number' ? it.totalCarton : '');
        if (header.customer === 'MSCSJ' && qVal !== '' && qVal !== undefined) {
          const numQ = typeof qVal === 'number' ? qVal : parseFloat(String(qVal).replace(/,/g, ''));
          if (!isNaN(numQ) && numQ > 0) ctnVal = Math.ceil(numQ / 5);
        }
        return {
          id: 'autofill-' + Date.now() + '-' + idx,
          skidNo: idx === 0 ? firstSkidLabel : '',
          code8D: entry.code8D,
          qty: qVal,
          totalCarton: ctnVal,
          weightKg: entry.weightKg !== undefined && entry.weightKg !== '' ? entry.weightKg : (it ? it.weightKg : ''),
          lengthCm: entry.lengthCm !== undefined && entry.lengthCm !== '' ? entry.lengthCm : (it ? it.lengthCm : ''),
          widthCm: entry.widthCm !== undefined && entry.widthCm !== '' ? entry.widthCm : (it ? it.widthCm : ''),
          heightCm: entry.heightCm !== undefined && entry.heightCm !== '' ? entry.heightCm : (it ? it.heightCm : ''),
        };
      });
      setItems(newItems);
    };

    const handleHeaderChange = (field, value) => {
      if (field === 'doNo') {
        const trimmed = String(value || '').trim();
        const matches = trimmed ? window.LookupParser.findMatchesForDo(lookupDb, trimmed, header.customer) : [];
        const destMatch = matches.find((e) => e.destination && e.destination.trim() !== '');
        if (destMatch && destMatch.destination && (!header.destination || header.destination.trim() === '')) {
          setHeader((prev) => ({ ...prev, doNo: value, destination: destMatch.destination }));
        } else {
          setHeader((prev) => ({ ...prev, doNo: value }));
        }
        return;
      }
      setHeader((prev) => ({ ...prev, [field]: value }));
    };

    const handleItemChange = (id, field, value) => {
      setItems((prevItems) =>
        prevItems.map((item) => {
          if (item.id === id) {
            const updatedItem = { ...item, [field]: value };

            if (header.customer === 'MSCSJ' && field === 'qty') {
              if (value === '' || value === undefined || value === null) {
                updatedItem.totalCarton = '';
              } else {
                const numQ = typeof value === 'number' ? value : parseFloat(String(value));
                if (!isNaN(numQ) && numQ > 0) updatedItem.totalCarton = Math.ceil(numQ / 5);
              }
            }

            if (field === 'code8D' && typeof value === 'string' && value.trim() !== '') {
              const match =
                customerDb.find(
                  (e) =>
                    e.code8D.toLowerCase() === value.trim().toLowerCase() &&
                    (!header.doNo || window.LookupParser.isDoMatch(e.doNo, header.doNo))
                ) || customerDb.find((e) => e.code8D.toLowerCase() === value.trim().toLowerCase());

              if (match) {
                if (updatedItem.qty === '' && match.qty !== undefined && match.qty !== '') updatedItem.qty = match.qty;
                if (updatedItem.totalCarton === '' && match.totalCarton !== undefined && match.totalCarton !== '') updatedItem.totalCarton = match.totalCarton;
                if (updatedItem.weightKg === '' && match.weightKg !== undefined && match.weightKg !== '') updatedItem.weightKg = match.weightKg;
                if (updatedItem.lengthCm === '' && match.lengthCm !== undefined && match.lengthCm !== '') updatedItem.lengthCm = match.lengthCm;
                if (updatedItem.widthCm === '' && match.widthCm !== undefined && match.widthCm !== '') updatedItem.widthCm = match.widthCm;
                if (updatedItem.heightCm === '' && match.heightCm !== undefined && match.heightCm !== '') updatedItem.heightCm = match.heightCm;

                if (header.customer === 'MSCSJ' && updatedItem.qty !== '' && updatedItem.qty !== undefined) {
                  const numQ2 = typeof updatedItem.qty === 'number' ? updatedItem.qty : parseFloat(String(updatedItem.qty));
                  if (!isNaN(numQ2) && numQ2 > 0) updatedItem.totalCarton = Math.ceil(numQ2 / 5);
                }

                if (match.destination && match.destination.trim() !== '' && (!header.destination || header.destination.trim() === '')) {
                  setHeader((prev) => ({ ...prev, destination: match.destination || '' }));
                }
              }
            }

            return updatedItem;
          }
          return item;
        })
      );
    };

    const handleAddRow = (unit = containerUnit, atIndex) => {
      const prefix = unit === 'BOX' ? 'BOX' : 'SKID';

      const newItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        skidNo: prefix + ' __NEW__',
        code8D: '', qty: '', totalCarton: '', weightKg: '',
        lengthCm: '', widthCm: '', heightCm: '',
      };

      const updated = [...items];
      if (atIndex !== undefined) updated.splice(atIndex + 1, 0, newItem);
      else updated.push(newItem);

      const getType = (label) => {
        const m = label.trim().match(/^(SKID|BOX)/i);
        return m ? (m[1].toUpperCase() === 'BOX' ? 'BOX' : 'SKID') : null;
      };

      const groupSize = updated.filter((it) => getType(it.skidNo) === unit).length;
      let partNum = 0;
      for (let i = 0; i < updated.length; i++) {
        if (getType(updated[i].skidNo) !== unit) continue;
        partNum++;
        updated[i] = {
          ...updated[i],
          skidNo: groupSize > 1 ? prefix + ' ' + partNum + '/' + groupSize : prefix + ' ' + partNum,
        };
      }

      setItems(updated);
    };

    const handleDuplicateRow = (index) => {
      const target = items[index];
      const duplicated = {
        ...target,
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      };

      const updated = [...items];
      updated.splice(index + 1, 0, duplicated);

      const parseGroup = (label) => {
        const m = label.trim().match(/^(SKID|BOX)[\s\-]*\d+\s*\/\s*(\d+)/i);
        if (!m) return null;
        return { prefix: m[1].toUpperCase() === 'BOX' ? 'BOX' : 'SKID', denom: parseInt(m[2], 10) };
      };

      const targetGroup = parseGroup(target.skidNo);
      const ownToken = target.skidNo.trim().match(/^(SKID|BOX)/i);
      const prefix = targetGroup
        ? targetGroup.prefix
        : ownToken
          ? (ownToken[1].toUpperCase() === 'BOX' ? 'BOX' : 'SKID')
          : containerUnit;

      const isBlankRow = (idx) => updated[idx].skidNo.trim() === '';
      const members = [];

      if (targetGroup !== null) {
        let i = index;
        while (i >= 0) {
          if (isBlankRow(i)) { i--; continue; }
          const p = parseGroup(updated[i].skidNo);
          if (p && p.prefix === targetGroup.prefix && p.denom === targetGroup.denom) {
            members.unshift(i);
            i--;
          } else {
            break;
          }
        }
        let j = index + 1;
        while (j < updated.length) {
          if (isBlankRow(j)) { j++; continue; }
          const p = parseGroup(updated[j].skidNo);
          if (p && p.prefix === targetGroup.prefix && p.denom === targetGroup.denom) {
            members.push(j);
            j++;
          } else {
            break;
          }
        }
      } else {
        members.push(index, index + 1);
      }

      const groupSize = members.length;
      members.forEach((rowIdx, partIdx) => {
        const partNum = partIdx + 1;
        updated[rowIdx] = {
          ...updated[rowIdx],
          skidNo: groupSize > 1 ? prefix + ' ' + partNum + '/' + groupSize : prefix + ' ' + partNum,
        };
      });

      setItems(updated);
    };

    const handleAddModelToSkid = (index) => {
      const target = items[index];
      const newItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        skidNo: '',
        code8D: '', qty: '', totalCarton: '',
        weightKg: '',
        lengthCm: '',
        widthCm: '',
        heightCm: '',
      };

      const updated = [...items];
      updated.splice(index + 1, 0, newItem);
      setItems(updated);
    };

    const handleMoveRow = (index, direction) => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === items.length - 1) return;

      const newItems = [...items];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = newItems[index];
      newItems[index] = newItems[targetIndex];
      newItems[targetIndex] = temp;
      setItems(newItems);
    };
    const handleDeleteRow = (id) => {
      if (items.length <= 1) {
        setItems([
          {
            id: 'item-' + Date.now(),
            skidNo: containerUnit + '-01',
            code8D: '', qty: '', totalCarton: '', weightKg: '',
            lengthCm: '', widthCm: '', heightCm: '',
          },
        ]);
        return;
      }

      const filtered = items.filter((item) => item.id !== id);

      const parseGroup = (label) => {
        const m = label.trim().match(/^(SKID|BOX)[\s\-]*\d+\s*\/\s*(\d+)/i);
        if (!m) return null;
        return { prefix: m[1].toUpperCase() === 'BOX' ? 'BOX' : 'SKID', denom: parseInt(m[2], 10) };
      };

      const updated = [...filtered];
      const n = updated.length;
      const isBlank = (idx) => updated[idx].skidNo.trim() === '';
      const parsed = updated.map((it) => parseGroup(it.skidNo));
      const visited = new Array(n).fill(false);

      for (let start = 0; start < n; start++) {
        const g = parsed[start];
        if (g === null || visited[start]) continue;

        const members = [start];
        visited[start] = true;
        let scanEnd = start;
        for (let k = start + 1; k < n; k++) {
          if (isBlank(k)) { scanEnd = k; continue; }
          const p = parsed[k];
          if (p && p.prefix === g.prefix && p.denom === g.denom) {
            members.push(k);
            visited[k] = true;
            scanEnd = k;
          } else {
            break;
          }
        }

        const count = members.length;
        members.forEach((idx, partIdx) => {
          const partNum = partIdx + 1;
          updated[idx] = {
            ...updated[idx],
            skidNo: count > 1 ? g.prefix + ' ' + partNum + '/' + count : g.prefix + ' 1',
          };
        });

        start = scanEnd;
      }

      setItems(updated);
    };

    const totalQty = items.reduce((acc, curr) => {
      const v = typeof curr.qty === 'number' ? curr.qty : parseFloat(String(curr.qty || '0').replace(/,/g, '').trim());
      return acc + (isNaN(v) ? 0 : v);
    }, 0);

    const totalCarton = items.reduce((acc, curr) => {
      const v = typeof curr.totalCarton === 'number' ? curr.totalCarton : parseFloat(String(curr.totalCarton || '0').replace(/,/g, '').trim());
      return acc + (isNaN(v) ? 0 : v);
    }, 0);

    const totalWeight = items.reduce((acc, curr) => {
      const v = typeof curr.weightKg === 'number' ? curr.weightKg : parseFloat(String(curr.weightKg || '0').replace(/,/g, '').trim());
      return acc + (isNaN(v) ? 0 : v);
    }, 0);


    // ── Render ─────────────────────────────────────────────────────────
    const segBtn = (active) =>
      'px-4 py-1.5 text-[13px] font-semibold rounded-[8px] transition cursor-pointer ' +
      (active
        ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#3A3A3C] dark:text-white'
        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200');

    const shipBySeg = h(
      'div',
      { className: 'inline-flex rounded-[10px] bg-black/[0.04] dark:bg-white/[0.08] p-[3px]' },
      ['LCL', 'AIR'].map((option) =>
        h('button', { key: option, type: 'button', onClick: () => handleHeaderChange('shipBy', option), className: segBtn(header.shipBy === option) }, option)
      )
    );

    const clearAllBtn =
      onClearAll &&
      h(
        'button',
        {
          type: 'button',
          onClick: onClearAll,
          className: 'ml-2 pl-3 border-l border-black/[0.08] dark:border-white/[0.12] px-3.5 py-2 bg-[#FF3B30]/[0.08] hover:bg-[#FF3B30]/[0.15] dark:bg-[#FF3B30]/[0.12] dark:hover:bg-[#FF3B30]/[0.2] text-[#FF3B30] text-[13px] font-semibold rounded-[10px] transition flex items-center gap-1.5 cursor-pointer print:hidden',
          title: 'Clear all rows and reset fields',
        },
        h(Icon.Trash2, { className: 'w-4 h-4', strokeWidth: 1.5 }),
        h('span', null, 'Clear')
      );

    const customerSeg = h(
      'div',
      { className: 'inline-flex rounded-[10px] bg-black/[0.04] dark:bg-white/[0.08] p-[3px]' },
      ['', 'MSCSJ'].map((option) =>
        h(
          'button',
          {
            key: option || 'default',
            type: 'button',
            onClick: () => {
              if ((header.customer || '') !== option) {
                // Auto-assign SHIP BY based on customer: SSEA → LCL, MSCSJ → AIR.
                const defaultShipBy = option === 'MSCSJ' ? 'AIR' : 'LCL';
                setHeader((prev) => ({ ...prev, customer: option, doNo: '', shipBy: defaultShipBy }));
                if (onCustomerChange) onCustomerChange(option);
              }
            },
            className: segBtn((header.customer || '') === option),
          },
          option || 'SSEA'
        )
      )
    );

    const headerInputs = h(
      'div',
      { className: 'mt-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center' },
      h(
        'div',
        { className: 'md:col-span-6 flex flex-wrap items-center gap-2' },
        h('label', { className: 'text-[13px] font-semibold text-gray-900 dark:text-gray-200 shrink-0' }, 'D.O. NO:'),
        h(
          'div',
          { className: 'relative flex-1 min-w-[150px] flex items-center gap-2' },
          h('input', {
            type: 'text',
            list: 'do-suggestions',
            value: header.doNo,
            onChange: (e) => {
              const val = e.target.value;
              handleHeaderChange('doNo', val);
              if (val && availableDoNumbers.some((d) => window.LookupParser.isDoMatch(d, val))) {
                if (onDoNoSwitch) onDoNoSwitch(val);
              }
            },
            placeholder: 'Type or select D.O...',
            className: 'w-full px-3.5 py-2 text-[14px] font-semibold text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF]/50 focus:bg-white dark:focus:bg-[#2C2C2E] transition placeholder:text-gray-400',
          }),
          availableDoNumbers.length > 0 &&
            h(
              'select',
              {
                value: header.doNo,
                onChange: (e) => {
                  if (e.target.value) {
                    if (onDoNoSwitch) onDoNoSwitch(e.target.value);
                    else handleHeaderChange('doNo', e.target.value);
                  }
                },
                className: 'px-2.5 py-2 text-[12px] font-semibold text-[#007AFF] dark:text-[#0A84FF] bg-[#007AFF]/[0.06] hover:bg-[#007AFF]/[0.12] dark:bg-[#0A84FF]/[0.12] dark:hover:bg-[#0A84FF]/[0.2] border border-[#007AFF]/20 dark:border-[#0A84FF]/25 rounded-[10px] focus:outline-none cursor-pointer shrink-0 print:hidden transition',
                title: 'Select D.O. NO from loaded source library',
              },
              h('option', { value: '' }, 'Select D.O.'),
              availableDoNumbers.map((doNo) => h('option', { key: doNo, value: doNo }, doNo))
            )
        ),
        h(
          'datalist',
          { id: 'do-suggestions' },
          availableDoNumbers.map((doNo) => h('option', { key: doNo, value: doNo }))
        ),
        matchedLookupEntries.length > 0
          ? h(
              'button',
              {
                type: 'button',
                onClick: handleAutoFill8DCodes,
                className: 'px-3 py-2 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold text-[12px] rounded-[10px] shadow-[0_1px_4px_rgba(0,122,255,0.3)] transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0',
                title: `Auto-fill ${matchedLookupEntries.length} 8D code(s) from lookup file for this DO`,
              },
              h(Icon.Zap, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
              h('span', null, `Auto-Fill (${matchedLookupEntries.length})`)
            )
          : onOpenMasterLookup &&
              h(
                'button',
                {
                  type: 'button',
                  onClick: onOpenMasterLookup,
                  className: 'px-3 py-2 bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-gray-700 dark:text-gray-200 font-semibold text-[12px] rounded-[10px] transition flex items-center gap-1.5 cursor-pointer print:hidden shrink-0',
                  title: 'Upload source lookup file',
                },
                h(Icon.Database, { className: 'w-3.5 h-3.5 text-gray-500 dark:text-gray-400', strokeWidth: 1.5 }),
                h('span', null, 'Source File')
              )
      ),
      h(
        'div',
        { className: 'md:col-span-5 flex items-center gap-2' },
        h('label', { className: 'text-[13px] font-semibold text-gray-900 dark:text-gray-200 shrink-0' }, 'Destination:'),
        h('input', {
          type: 'text',
          value: header.destination,
          onChange: (e) => handleHeaderChange('destination', e.target.value),
          placeholder: 'e.g. Shah Alam Logistic Centre / Warehouse E',
          className: 'w-full px-3.5 py-2 text-[14px] font-medium text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF]/50 focus:bg-white dark:focus:bg-[#2C2C2E] transition placeholder:text-gray-400',
        })
      ),
      h(
        'div',
        { className: 'md:col-span-2 flex items-center gap-2' },
        h('label', { className: 'text-[12px] font-medium text-gray-500 dark:text-gray-400 shrink-0' }, 'Date:'),
        h('input', {
          type: 'date',
          value: header.date,
          onChange: (e) => handleHeaderChange('date', e.target.value),
          className: 'w-full px-2.5 py-1.5 text-[13px] font-medium text-gray-800 dark:text-gray-200 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 dark:[color-scheme:dark]',
        })
      )
    );

    const topSection = h(
      'div',
      { className: 'border-b border-black/[0.08] dark:border-white/[0.1] pb-5 mb-5' },
      h(
        'div',
        { className: 'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4' },
        h(
          'div',
          null,
          h('h2', { className: 'text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white' }, 'Packing Details Sheet')
        ),
        h(
          'div',
          { className: 'flex items-center gap-3' },
          h('span', { className: 'text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide' }, 'SHIP BY:'),
          shipBySeg,
          clearAllBtn
        )
      ),
      h(
        'div',
        { className: 'mt-4 flex items-center gap-3 print:hidden' },
        h('span', { className: 'text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide shrink-0' }, 'Customer:'),
        customerSeg,
        h(
          'span',
          { className: 'text-[11px] text-gray-400 dark:text-gray-500 italic' },
          header.customer === 'MSCSJ' ? 'Data source: MSCSJ Packing List (DATA sheet)' : 'Data source: SSEA Batch Picking (Insert Batch sheet)'
        )
      ),
      headerInputs
    );


    const toolsBar = h(
      'div',
      { className: 'flex flex-wrap items-center justify-between gap-3 mb-3 text-[12px] font-medium text-gray-500 dark:text-gray-400 print:hidden' },
      h(
        'div',
        { className: 'flex flex-wrap items-center gap-2.5' },
        h('span', { className: 'inline-flex items-center px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[11px] font-semibold text-gray-600 dark:text-gray-300' }, `Rows: ${items.length}`),
        h(
          'button',
          {
            type: 'button',
            onClick: handleAutoNumberingWithUnit,
            className: 'inline-flex items-center gap-1.5 text-[#007AFF] hover:text-[#007AFF]/80 dark:text-[#0A84FF] dark:hover:text-[#0A84FF]/80 font-semibold cursor-pointer transition',
            title: `Auto-fill sequential ${containerUnit}-01, ${containerUnit}-02 numbers`,
          },
          h(Icon.Wand2, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
          `Auto-Number ${containerUnit}`
        ),
        onVerify &&
          h(
            'button',
            {
              type: 'button',
              onClick: onVerify,
              disabled: matchedLookupEntries.length === 0,
              title: matchedLookupEntries.length === 0
                ? 'Select a D.O. NO with source file data to verify against.'
                : 'Verify sheet quantities against the selected D.O. (missing / short / over / extra per model)',
              className: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-[12px] transition ${
                matchedLookupEntries.length === 0
                  ? 'bg-black/[0.03] dark:bg-white/[0.06] text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-[#34C759]/10 hover:bg-[#34C759]/20 dark:bg-[#30D158]/15 dark:hover:bg-[#30D158]/25 text-[#34C759] dark:text-[#30D158] cursor-pointer'
              }`,
            },
            h(Icon.ClipboardCheck, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            'Confirm'
          )
      ),
      h(
        'div',
        { className: 'flex flex-wrap items-center gap-2' },
        onExportExcel &&
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
          ),
        onExportBulkSummary &&
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
          )
      )
    );


    // ── Table ──
    const numInputCls =
      'w-full text-center font-semibold text-gray-900 dark:text-white text-[14px] py-2 px-1.5 bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-[#2C2C2E] focus:outline-none rounded-[8px] focus:ring-2 focus:ring-[#007AFF]/40 transition placeholder:text-gray-400 placeholder:font-normal';
    const numInputClsMedium = numInputCls.replace('font-semibold', 'font-medium');

    const numHandler = (id, field) => (e) =>
      handleItemChange(id, field, e.target.value === '' ? '' : Number(e.target.value));

    const tableHead = h(
      'thead',
      null,
      h(
        'tr',
        { className: 'bg-black/[0.02] dark:bg-white/[0.04] text-gray-500 dark:text-gray-400 text-[11px] font-semibold uppercase tracking-wide border-b border-black/[0.08] dark:border-white/[0.1] divide-x divide-black/[0.05] dark:divide-white/[0.06]' },
        h(
          'th',
          { className: 'p-2.5 w-32 text-center' },
          h(
            'div',
            { className: 'flex items-center justify-center gap-1' },
            h(
              'select',
              {
                value: containerUnit,
                onChange: (e) => handleContainerUnitChange(e.target.value),
                className: 'bg-black/[0.05] hover:bg-black/[0.09] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] font-semibold text-gray-800 dark:text-gray-200 text-[11px] uppercase px-2 py-1 rounded-[8px] cursor-pointer border border-black/[0.06] dark:border-white/[0.1] focus:outline-none print:hidden transition',
                title: 'Switch header between SKID NO. and BOX NO.',
              },
              h('option', { value: 'SKID' }, 'SKID NO.'),
              h('option', { value: 'BOX' }, 'BOX NO.')
            ),
            h('span', { className: 'hidden print:inline font-semibold uppercase' }, getPackageUnitLabel(items).columnHeader)
          )
        ),
        h('th', { className: 'p-2.5 w-32 text-center' }, 'Product Code'),
        h('th', { className: 'p-2.5 w-20 text-center' }, 'Qty'),
        h('th', { className: 'p-2.5 w-28 text-center leading-tight' }, 'Total', h('br'), 'Carton'),
        h('th', { className: 'p-2.5 w-28 text-center leading-tight' }, 'Weight (B)', h('br'), '(CM)'),
        h('th', { className: 'p-2.5 w-24 text-center leading-tight' }, 'Length (P)', h('br'), '(CM)'),
        h('th', { className: 'p-2.5 w-24 text-center leading-tight' }, 'Width (L)', h('br'), '(CM)'),
        h('th', { className: 'p-2.5 w-24 text-center leading-tight' }, 'Height (T)', h('br'), '(CM)'),
        h('th', { className: 'p-2.5 w-24 text-center print:hidden' }, 'Actions')
      )
    );
    const renderRow = (item, index) => {
      const isSameAsPrevious =
        index > 0 && (item.skidNo.trim() === '' || items[index - 1].skidNo === item.skidNo);

      const matchedEntry = customerDb.find(
        (e) => e.code8D.toLowerCase() === item.code8D.trim().toLowerCase()
      );

      const skidInputCls =
        'w-full text-center font-semibold text-[14px] py-2 px-1.5 bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-[#2C2C2E] focus:outline-none rounded-[8px] focus:ring-2 focus:ring-[#007AFF]/40 transition ' +
        (isSameAsPrevious ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white');

      const actionBtn =
        'w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-black/[0.05] dark:text-gray-500 dark:hover:text-gray-200 dark:hover:bg-white/[0.08] disabled:opacity-20 cursor-pointer transition';

      const codeCell = h(
        'td',
        { className: 'p-1.5 min-w-[170px]' },
        h(
          'div',
          { className: 'flex flex-col gap-1.5' },
          h('input', {
            type: 'text',
            list: 'code8d-suggestions',
            value: item.code8D,
            onChange: (e) => handleItemChange(item.id, 'code8D', e.target.value),
            placeholder: 'Type Product Code...',
            className: 'w-full text-center font-semibold text-gray-900 dark:text-white text-[14px] py-2 px-1.5 bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-[#2C2C2E] focus:outline-none rounded-[8px] focus:ring-2 focus:ring-[#007AFF]/40 transition placeholder:text-gray-400 placeholder:font-normal',
          }),
          uniqueAvailableCodes.length > 0 &&
            h(
              'select',
              {
                value: item.code8D,
                onChange: (e) => {
                  if (e.target.value) handleItemChange(item.id, 'code8D', e.target.value);
                },
                className: 'w-full text-[12px] font-semibold text-[#007AFF] dark:text-[#0A84FF] bg-[#007AFF]/[0.05] hover:bg-[#007AFF]/[0.1] dark:bg-[#0A84FF]/[0.1] dark:hover:bg-[#0A84FF]/[0.18] border border-[#007AFF]/15 dark:border-[#0A84FF]/20 rounded-[8px] px-1.5 py-1.5 focus:outline-none cursor-pointer print:hidden truncate transition',
                title: 'Select available product code',
              },
              h('option', { value: '' }, '-- Select Code --'),
              uniqueAvailableCodes.map((code) => h('option', { key: code, value: code }, code))
            ),
          matchedEntry &&
            matchedEntry.description &&
            h(
              'div',
              {
                className: 'text-[11px] font-semibold text-[#34C759] dark:text-[#30D158] bg-[#34C759]/[0.07] dark:bg-[#30D158]/[0.12] px-2 py-1 rounded-[8px] text-center truncate',
                title: `Model Name: ${matchedEntry.description}`,
              },
              matchedEntry.description
            )
        )
      );

      const weightInputCls =
        'w-full text-center font-semibold text-[#007AFF] dark:text-[#0A84FF] text-[14px] py-2 px-1.5 bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-[#2C2C2E] focus:outline-none rounded-[8px] focus:ring-2 focus:ring-[#007AFF]/40 transition placeholder:text-gray-400 placeholder:font-normal';

      return h(
        'tr',
        {
          key: item.id,
          className: `hover:bg-black/[0.015] dark:hover:bg-white/[0.03] transition divide-x divide-black/[0.04] dark:divide-white/[0.05] group ${isSameAsPrevious ? '' : 'border-t border-black/[0.06] dark:border-white/[0.08]'}`,
        },
        h(
          'td',
          { className: 'p-1.5' },
          h('input', {
            type: 'text',
            value: item.skidNo,
            onChange: (e) => handleItemChange(item.id, 'skidNo', e.target.value),
            placeholder: isSameAsPrevious && item.skidNo.trim() === '' ? '' : `${containerUnit}-${(index + 1).toString().padStart(2, '0')}`,
            className: skidInputCls,
          })
        ),
        codeCell,
        h('td', { className: 'p-1.5' },
          h('input', { type: 'number', value: item.qty, onChange: numHandler(item.id, 'qty'), placeholder: '0', className: numInputCls })),
        h('td', { className: 'p-1.5' },
          h('input', { type: 'number', value: item.totalCarton, onChange: numHandler(item.id, 'totalCarton'), placeholder: '0', className: numInputClsMedium })),
        h('td', { className: 'p-1.5' },
          h('input', { type: 'number', step: '0.1', value: item.weightKg, onChange: numHandler(item.id, 'weightKg'), placeholder: '0.0', className: weightInputCls })),
        h('td', { className: 'p-1.5' },
          h('input', { type: 'number', value: item.lengthCm, onChange: numHandler(item.id, 'lengthCm'), placeholder: 'cm', className: numInputClsMedium })),
        h('td', { className: 'p-1.5' },
          h('input', { type: 'number', value: item.widthCm, onChange: numHandler(item.id, 'widthCm'), placeholder: 'cm', className: numInputClsMedium })),
        h('td', { className: 'p-1.5' },
          h('input', { type: 'number', value: item.heightCm, onChange: numHandler(item.id, 'heightCm'), placeholder: 'cm', className: numInputClsMedium })),
        h(
          'td',
          { className: 'p-1.5 text-center print:hidden' },
          h(
            'div',
            { className: 'flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition' },
            h('button', { type: 'button', onClick: () => handleMoveRow(index, 'up'), disabled: index === 0, className: actionBtn, title: 'Move up' },
              h(Icon.ArrowUp, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 })),
            h('button', { type: 'button', onClick: () => handleMoveRow(index, 'down'), disabled: index === items.length - 1, className: actionBtn, title: 'Move down' },
              h(Icon.ArrowDown, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 })),
            h('button', { type: 'button', onClick: () => handleAddModelToSkid(index), className: 'px-2.5 py-1.5 text-[11px] font-semibold text-[#34C759] dark:text-[#30D158] bg-[#34C759]/10 hover:bg-[#34C759]/20 dark:bg-[#30D158]/15 dark:hover:bg-[#30D158]/25 rounded-full cursor-pointer transition active:scale-95 whitespace-nowrap', title: 'Add another model to this SKID/BOX' },
              'Add Model'),
            h('button', { type: 'button', onClick: () => handleDeleteRow(item.id), className: 'px-2.5 py-1.5 text-[11px] font-semibold text-[#FF3B30] dark:text-[#FF453A] bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 dark:bg-[#FF453A]/15 dark:hover:bg-[#FF453A]/25 rounded-full cursor-pointer transition active:scale-95 whitespace-nowrap', title: 'Delete row' },
              'Delete Row')
          )
        )
      );
    };

    const totalsRow = h(
      'tr',
      { className: 'bg-black/[0.03] dark:bg-white/[0.05] font-semibold text-gray-900 dark:text-white border-t border-black/[0.1] dark:border-white/[0.12] divide-x divide-black/[0.04] dark:divide-white/[0.06] text-[14px]' },
      h('td', { className: 'p-3 text-center uppercase tracking-wide text-[12px] text-gray-500 dark:text-gray-400 font-semibold' }, 'TOTALS'),
      h('td', { className: 'p-3 text-center text-gray-400 dark:text-gray-500' }, '—'),
      h('td', { className: 'p-3 text-center text-[#007AFF] dark:text-[#0A84FF] text-[15px] font-bold' }, totalQty.toLocaleString()),
      h('td', { className: 'p-3 text-center text-gray-900 dark:text-white text-[15px] font-bold' }, totalCarton),
      h('td', { className: 'p-3 text-center text-[#34C759] dark:text-[#30D158] text-[15px] font-bold' }, `${totalWeight.toFixed(1)} kg`),
      h('td', { colSpan: 3, className: 'p-3 text-center text-gray-400 dark:text-gray-500 text-[12px] font-normal' }, 'Calculated CBM Auto-Included in Excel'),
      h('td', { className: 'p-3 print:hidden' })
    );

    const table = h(
      'div',
      { className: 'overflow-x-auto border border-black/[0.08] dark:border-white/[0.1] rounded-[14px] bg-white dark:bg-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.04)]' },
      h(
        'table',
        { className: 'w-full text-left border-collapse min-w-[1000px]' },
        tableHead,
        h(
          'tbody',
          { className: 'text-[14px] font-medium' },
          items.map((item, index) => renderRow(item, index)),
          totalsRow
        )
      )
    );

    const addRowButtons = h(
      'div',
      { className: 'mt-4 flex flex-wrap justify-between items-center gap-2 print:hidden' },
      h(
        'div',
        { className: 'flex items-center gap-2' },
        h(
          'button',
          { type: 'button', onClick: () => handleAddRow('SKID'), className: 'inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold text-[13px] rounded-[10px] shadow-[0_1px_4px_rgba(0,122,255,0.3)] transition cursor-pointer active:scale-95', title: 'Add a new row with pre-filled SKID label' },
          h(Icon.Plus, { className: 'w-4 h-4', strokeWidth: 2 }),
          h('span', null, 'Add Skid Row')
        ),
        h(
          'button',
          { type: 'button', onClick: () => handleAddRow('BOX'), className: 'inline-flex items-center gap-1.5 px-4 py-2.5 bg-black/[0.06] hover:bg-black/[0.1] dark:bg-white/[0.1] dark:hover:bg-white/[0.15] text-gray-800 dark:text-gray-100 font-semibold text-[13px] rounded-[10px] transition cursor-pointer active:scale-95', title: 'Add a new row with pre-filled BOX label' },
          h(Icon.Plus, { className: 'w-4 h-4', strokeWidth: 2 }),
          h('span', null, 'Add Box Row')
        )
      ),
      h('span', { className: 'text-[12px] text-gray-400 dark:text-gray-500' }, 'All changes auto-calculated for Excel formula output')
    );

    const sigInputCls =
      'w-full border-b border-black/[0.15] dark:border-white/[0.2] px-1 py-1.5 bg-transparent focus:outline-none focus:border-[#007AFF] transition placeholder:text-gray-400 dark:placeholder:text-gray-500';

    const signatures = h(
      'div',
      { className: 'mt-12 pt-6 border-t border-black/[0.08] dark:border-white/[0.1] grid grid-cols-1 sm:grid-cols-2 gap-8 items-center text-[14px] font-medium text-gray-900 dark:text-gray-200' },
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h('span', { className: 'shrink-0 font-semibold text-[13px] text-gray-500 dark:text-gray-400 uppercase tracking-wide' }, 'Pack By:'),
        h('input', { type: 'text', value: header.packBy, onChange: (e) => handleHeaderChange('packBy', e.target.value), placeholder: 'Name / Signature', className: sigInputCls })
      ),
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h('span', { className: 'shrink-0 font-semibold text-[13px] text-gray-500 dark:text-gray-400 uppercase tracking-wide' }, 'Approved By (Area PIC):'),
        h('input', { type: 'text', value: header.approvedBy, onChange: (e) => handleHeaderChange('approvedBy', e.target.value), placeholder: 'Name / Signature', className: sigInputCls })
      )
    );

    const uniqueMatchedEntries = Array.from(
      new Map(matchedLookupEntries.map(e => [e.code8D, e])).values()
    );

    const codeDatalist = h(
      'datalist',
      { id: 'code8d-suggestions' },
      uniqueMatchedEntries.map((entry) =>
        h('option', { key: entry.id, value: entry.code8D },
          entry.doNo ? `[${entry.doNo}] ${entry.description || ''}` : entry.description || '')
      )
    );

    return h(
      'div',
      { className: 'bg-white dark:bg-[#1C1C1E] rounded-[20px] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6 sm:p-8 font-sans max-w-[1280px] mx-auto print:border-none print:shadow-none print:p-0 transition-colors duration-300' },
      topSection,
      toolsBar,
      table,
      addRowButtons,
      signatures,
      codeDatalist
    );
  };

  window.PackingSheetForm = PackingSheetForm;
})();

