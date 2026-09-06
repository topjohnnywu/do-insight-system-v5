/* PackingSheetForm component (classic script -> window.PackingSheetForm). UI/logic verbatim. */
(function () {
  const { filterByCustomer } = window.LookupParser;
  const { getPackageUnitLabel } = window.ExcelExport;

  const PackingSheetForm = ({
    header, setHeader, items, setItems, onAutoSkidNumbering, lookupDb = [],
    onOpenMasterLookup, onDoNoSwitch, onVerify, onClearAll, onNewBatchSession, onCustomerChange,
    onExportExcel, onExportSimplified, onExportBulkSummary, onExportBulkSimplified,
    hideSseaTotalCarton = false, onToggleHideSseaTotalCarton,
  }) => {
    const [containerUnit, setContainerUnit] = React.useState('SKID');

    const [density, setDensity] = React.useState(() => {
      try {
        return localStorage.getItem('PackingApp_Density') || 'comfortable';
      } catch (e) {
        return 'comfortable';
      }
    });

    const toggleDensity = () => {
      const next = density === 'comfortable' ? 'compact' : 'comfortable';
      setDensity(next);
      try {
        localStorage.setItem('PackingApp_Density', next);
      } catch (e) {}
    };

    const [selectedRowIds, setSelectedRowIds] = React.useState(new Set());
    const tableRef = React.useRef(null);

    const handleToggleSelectRow = (id) => {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const handleToggleSelectAll = () => {
      if (selectedRowIds.size === items.length) {
        setSelectedRowIds(new Set());
      } else {
        setSelectedRowIds(new Set(items.map((it) => it.id)));
      }
    };

    const handleClearSelection = () => {
      setSelectedRowIds(new Set());
    };

    const [batchContainerInput, setBatchContainerInput] = React.useState('');

    const handleApplyBatchContainer = () => {
      if (selectedRowIds.size === 0) return;
      const targetLabel = batchContainerInput.trim() || `${containerUnit}-01`;
      setItems((prev) =>
        prev.map((item) => (selectedRowIds.has(item.id) ? { ...item, skidNo: targetLabel } : item))
      );
      setSelectedRowIds(new Set());
      setBatchContainerInput('');
    };

    const handleBatchDuplicate = () => {
      if (selectedRowIds.size === 0) return;
      setItems((prev) => {
        const next = [];
        prev.forEach((item) => {
          next.push(item);
          if (selectedRowIds.has(item.id)) {
            next.push({
              ...item,
              id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            });
          }
        });
        return next;
      });
      setSelectedRowIds(new Set());
    };

    const handleBatchDelete = async () => {
      if (selectedRowIds.size === 0) return;
      let ok = false;
      if (window.ConfirmDialog && window.ConfirmDialog.confirm) {
        ok = await window.ConfirmDialog.confirm({
          title: 'Delete Selected Rows?',
          message: `Are you sure you want to delete ${selectedRowIds.size} selected row(s)? This action cannot be undone.`,
          confirmLabel: `Delete (${selectedRowIds.size})`,
          tone: 'danger',
          icon: Icon.Trash2,
        });
      } else {
        ok = window.confirm(`Delete ${selectedRowIds.size} selected row(s)?`);
      }
      if (!ok) return;
      setItems((prev) => prev.filter((item) => !selectedRowIds.has(item.id)));
      setSelectedRowIds(new Set());
    };

    const handleTableKeyDown = (e) => {
      if (e.key === 'Enter') {
        const target = e.target;
        if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
        const rowIdx = parseInt(target.getAttribute('data-row-index'), 10);
        const colKey = target.getAttribute('data-col-key');
        if (isNaN(rowIdx) || !colKey) return;

        e.preventDefault();
        const nextRowIdx = e.shiftKey ? rowIdx - 1 : rowIdx + 1;

        if (nextRowIdx >= 0 && nextRowIdx < items.length) {
          const nextInput = tableRef.current?.querySelector(
            `input[data-row-index="${nextRowIdx}"][data-col-key="${colKey}"]`
          );
          if (nextInput) {
            nextInput.focus();
            if (typeof nextInput.select === 'function') nextInput.select();
          }
        } else if (nextRowIdx === items.length && !e.shiftKey) {
          // Auto-add next skid copying dimensions and focus Qty when pressing Enter on the last row
          handleDuplicateAsNextSkid(items.length - 1, containerUnit);
        }
      }
    };

    const customerDb = React.useMemo(
      () => filterByCustomer(lookupDb, header.customer || ''),
      [lookupDb, header.customer]
    );

    const matchedLookupEntries = header.doNo
      ? window.LookupParser.findMatchesForDo(lookupDb, header.doNo, header.customer)
      : [];

    // Aggregated entries by product code for auto-filling without duplicate rows
    const aggregatedLookupEntries = React.useMemo(() => {
      if (matchedLookupEntries.length === 0) return [];
      return window.LookupParser.aggregateEntriesByProductCode
        ? window.LookupParser.aggregateEntriesByProductCode(matchedLookupEntries, header.customer)
        : matchedLookupEntries;
    }, [matchedLookupEntries, header.customer]);

    const availableModels = aggregatedLookupEntries.length > 0 ? aggregatedLookupEntries : customerDb;

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
      let entries = Array.isArray(customMatches) && customMatches.length > 0 ? customMatches : aggregatedLookupEntries;
      if (entries.length === 0) return;
      if (window.LookupParser.aggregateEntriesByProductCode) {
        entries = window.LookupParser.aggregateEntriesByProductCode(entries, header.customer);
      }
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
              let ctnVal = '';
              if (header.customer === 'MSCSJ') {
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
          // If there are more lookup entries than existing items, append remaining
          if (entries.length > prev.length) {
            for (let i = prev.length; i < entries.length; i++) {
              const entry = entries[i];
              let ctnVal = '';
              if (header.customer === 'MSCSJ') {
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
        let ctnVal = '';
        if (header.customer === 'MSCSJ') {
          if (qVal !== '' && qVal !== undefined) {
            const numQ = typeof qVal === 'number' ? qVal : parseFloat(String(qVal).replace(/,/g, ''));
            if (!isNaN(numQ) && numQ > 0) ctnVal = Math.ceil(numQ / 5);
          } else {
            ctnVal = typeof entry.totalCarton === 'number' ? entry.totalCarton : (it && typeof it.totalCarton === 'number' ? it.totalCarton : '');
          }
        } else {
          // Customer SSEA: Never auto-fill totalCarton, retain manual entry if already present
          ctnVal = it && it.totalCarton !== undefined && it.totalCarton !== '' ? it.totalCarton : '';
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
              const searchCode = value.trim().toLowerCase();
              const match =
                aggregatedLookupEntries.find((e) => (e.code8D || '').toLowerCase() === searchCode) ||
                customerDb.find(
                  (e) =>
                    (e.code8D || '').toLowerCase() === searchCode &&
                    (!header.doNo || window.LookupParser.isDoMatch(e.doNo, header.doNo))
                ) ||
                customerDb.find((e) => (e.code8D || '').toLowerCase() === searchCode);

              if (match) {
                if (updatedItem.qty === '') {
                  if (aggregatedLookupEntries.length > 0 && window.LookupParser && window.LookupParser.getRemainingQuantityForModel) {
                    const remaining = window.LookupParser.getRemainingQuantityForModel(
                      items,
                      aggregatedLookupEntries,
                      match.code8D,
                      updatedItem.id
                    );
                    updatedItem.qty = remaining > 0 ? remaining : (match.qty !== undefined && match.qty !== '' ? match.qty : '');
                  } else if (match.qty !== undefined && match.qty !== '') {
                    updatedItem.qty = match.qty;
                  }
                }
                if (header.customer === 'MSCSJ' && updatedItem.totalCarton === '' && match.totalCarton !== undefined && match.totalCarton !== '') {
                  updatedItem.totalCarton = match.totalCarton;
                }
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

    const handleDuplicateAsNextSkid = (index, unitOverride) => {
      if (items.length === 0) {
        handleAddRow(unitOverride || containerUnit);
        return;
      }

      const targetIdx = index !== undefined && index >= 0 && index < items.length ? index : items.length - 1;
      const sourceItem = items[targetIdx];

      // Find parent row if source item is a secondary model row without skidNo
      let parentIdx = targetIdx;
      while (parentIdx >= 0 && (items[parentIdx].skidNo || '').trim() === '') {
        parentIdx--;
      }
      const parentItem = parentIdx >= 0 ? items[parentIdx] : sourceItem;

      // Extract values to inherit: dimensions, weight, and product code (Choice 1)
      const lengthCm = sourceItem.lengthCm !== '' && sourceItem.lengthCm !== undefined ? sourceItem.lengthCm : (parentItem.lengthCm || '');
      const widthCm = sourceItem.widthCm !== '' && sourceItem.widthCm !== undefined ? sourceItem.widthCm : (parentItem.widthCm || '');
      const heightCm = sourceItem.heightCm !== '' && sourceItem.heightCm !== undefined ? sourceItem.heightCm : (parentItem.heightCm || '');
      const weightKg = sourceItem.weightKg !== '' && sourceItem.weightKg !== undefined ? sourceItem.weightKg : (parentItem.weightKg || '');
      const code8D = sourceItem.code8D || parentItem.code8D || '';

      // Determine container unit (SKID vs BOX)
      const parentLabel = (parentItem.skidNo || '').trim();
      const unitMatch = parentLabel.match(/^(SKID|BOX)/i);
      const unit = unitOverride || (unitMatch ? unitMatch[1].toUpperCase() : containerUnit);
      const prefix = unit === 'BOX' ? 'BOX' : 'SKID';

      // Check if user is using hyphenated format (e.g. SKID-01) vs fractional format (SKID 1/N or SKID 1)
      const isHyphenated = /^(SKID|BOX)-\d+$/i.test(parentLabel);

      // If source had multi-model rows grouped under it, insert after the entire group
      let insertAfterIdx = targetIdx;
      while (insertAfterIdx + 1 < items.length && (items[insertAfterIdx + 1].skidNo || '').trim() === '') {
        insertAfterIdx++;
      }
      const insertIdx = insertAfterIdx + 1;

      const newItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        skidNo: prefix + ' __NEW__',
        code8D: code8D,
        qty: '', // Choice 1: Qty left empty with cursor focus ready to type
        totalCarton: '',
        weightKg: weightKg,
        lengthCm: lengthCm,
        widthCm: widthCm,
        heightCm: heightCm,
      };

      const updated = [...items];
      updated.splice(insertIdx, 0, newItem);

      if (isHyphenated) {
        // Hyphenated format: sequential numbering (SKID-01, SKID-02, SKID-03...)
        let highestNum = 0;
        updated.forEach((it) => {
          const m = (it.skidNo || '').match(/(?:SKID|BOX)-(\d+)/i);
          if (m) {
            const n = parseInt(m[1], 10);
            if (!isNaN(n) && n > highestNum) highestNum = n;
          }
        });
        const numMatch = parentLabel.match(/^(?:SKID|BOX)-(\d+)$/i);
        const padLen = numMatch ? numMatch[1].length : 2;
        newItem.skidNo = `${prefix}-${(highestNum + 1).toString().padStart(padLen, '0')}`;
      } else {
        // Fractional format (same as handleAddRow): re-sync all skids of this unit to partNum/groupSize
        const getType = (label) => {
          const m = (label || '').trim().match(/^(SKID|BOX)/i);
          return m ? (m[1].toUpperCase() === 'BOX' ? 'BOX' : 'SKID') : null;
        };

        const groupSize = updated.filter((it) => getType(it.skidNo) === unit).length;
        let partNum = 0;
        for (let i = 0; i < updated.length; i++) {
          if (getType(updated[i].skidNo) !== unit) continue;
          partNum++;
          updated[i] = {
            ...updated[i],
            skidNo: groupSize > 1 ? `${prefix} ${partNum}/${groupSize}` : `${prefix} ${partNum}`,
          };
        }
      }

      setItems(updated);

      // Auto-focus the newly created row's Qty cell
      setTimeout(() => {
        const qtyInput = tableRef.current?.querySelector(
          `input[data-row-index="${insertIdx}"][data-col-key="qty"]`
        );
        if (qtyInput) {
          qtyInput.focus();
          if (typeof qtyInput.select === 'function') qtyInput.select();
        }
      }, 60);
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
      'px-3.5 py-1.5 text-[12px] font-semibold rounded-[8px] transition cursor-pointer select-none ' +
      (active
        ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-[#3A3A3C] dark:text-white dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)]'
        : 'text-gray-500 hover:text-gray-800 dark:text-[#8E8E93] dark:hover:text-white');

    const shipBySeg = h(
      'div',
      { className: 'inline-flex rounded-[10px] bg-black/[0.05] dark:bg-white/[0.08] p-[3px] border border-black/[0.04] dark:border-white/[0.06]' },
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
      { className: 'inline-flex rounded-[10px] bg-black/[0.05] dark:bg-white/[0.08] p-[3px] border border-black/[0.04] dark:border-white/[0.06]' },
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
                className:
                  'px-2.5 py-2 text-[12px] font-semibold text-[#007AFF] dark:text-[#0A84FF] bg-[#007AFF]/[0.06] hover:bg-[#007AFF]/[0.12] dark:bg-[#2C2C2E] dark:hover:bg-[#3A3A3C] border border-[#007AFF]/20 dark:border-[#0A84FF]/30 rounded-[10px] focus:outline-none cursor-pointer shrink-0 print:hidden transition [&>option]:bg-white [&>option]:text-gray-900 dark:[&>option]:bg-[#2C2C2E] dark:[&>option]:text-white',
                title: 'Select D.O. NO from loaded source library',
              },
              h('option', { value: '', className: 'bg-white text-gray-900 dark:bg-[#2C2C2E] dark:text-white' }, 'Select D.O.'),
              availableDoNumbers.map((doNo) => h('option', { key: doNo, value: doNo, className: 'bg-white text-gray-900 dark:bg-[#2C2C2E] dark:text-white' }, doNo))
            )
        ),
        h(
          'datalist',
          { id: 'do-suggestions' },
          availableDoNumbers.map((doNo) => h('option', { key: doNo, value: doNo }))
        ),
        aggregatedLookupEntries.length > 0
          ? h(
              'button',
              {
                type: 'button',
                onClick: () => handleAutoFill8DCodes(aggregatedLookupEntries),
                className: 'px-3 py-2 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold text-[12px] rounded-[10px] shadow-[0_1px_4px_rgba(0,122,255,0.3)] transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0',
                title: `Auto-fill ${aggregatedLookupEntries.length} unique model(s) with summed quantities for this DO`,
              },
              h(Icon.Zap, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
              h('span', null, `Auto-Fill (${aggregatedLookupEntries.length})`)
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
          h('h2', { className: 'text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white' }, 'Packing Manifest Details')
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
          'div',
          { className: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/[0.04] dark:bg-white/[0.08] text-gray-600 dark:text-[#8E8E93] border border-black/[0.06] dark:border-white/[0.08] select-none' },
          h('span', { className: 'w-1.5 h-1.5 rounded-full bg-[#34C759] dark:bg-[#30D158]' }),
          header.customer === 'MSCSJ' ? 'MSCSJ Packing List (DATA)' : 'SSEA Batch Picking (Insert Batch)'
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
        h(
          'span',
          {
            className:
              'inline-flex items-center px-2.5 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.1] text-[11px] font-semibold text-gray-700 dark:text-gray-200 border border-black/[0.08] dark:border-white/[0.12]',
          },
          `Rows: ${items.length}`
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: toggleDensity,
            className:
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-gray-700 dark:text-gray-200 text-[12px] font-semibold transition cursor-pointer border border-black/[0.08] dark:border-white/[0.12]',
            title: density === 'comfortable' ? 'Switch to Compact View (fits more rows on screen)' : 'Switch to Comfortable View',
          },
          h(Icon.Maximize, { className: 'w-3.5 h-3.5 text-gray-600 dark:text-gray-300', strokeWidth: 1.5 }),
          density === 'compact' ? 'Compact View' : 'Comfortable View'
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: handleAutoNumberingWithUnit,
            className:
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#007AFF]/10 hover:bg-[#007AFF]/15 dark:bg-[#0A84FF]/15 dark:hover:bg-[#0A84FF]/25 text-[#007AFF] dark:text-[#0A84FF] font-semibold text-[12px] cursor-pointer transition border border-[#007AFF]/20 dark:border-[#0A84FF]/30',
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
              className: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] font-semibold text-[12px] transition ${
                matchedLookupEntries.length === 0
                  ? 'bg-black/[0.03] dark:bg-white/[0.05] text-gray-400 dark:text-gray-600 border border-black/[0.05] dark:border-white/[0.06] cursor-not-allowed'
                  : 'bg-[#22c55e]/15 hover:bg-[#22c55e]/25 dark:bg-[#30D158]/20 dark:hover:bg-[#30D158]/30 text-[#15803d] dark:text-[#30D158] border border-[#22c55e]/30 dark:border-[#30D158]/35 cursor-pointer'
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
              className:
                'px-3.5 py-1.5 bg-[#007AFF] hover:bg-[#007AFF]/90 dark:bg-[#0A84FF] dark:hover:bg-[#0A84FF]/90 text-white text-[12px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(0,122,255,0.3)] transition flex items-center gap-1.5 cursor-pointer active:scale-95',
              title: 'Export current D.O. packing details sheet to Excel (.xlsx)',
            },
            h(Icon.FileSpreadsheet, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'Export Excel')
          ),
        onToggleHideSseaTotalCarton &&
          header.customer !== 'MSCSJ' &&
          h(
            'label',
            {
              className:
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-gray-700 dark:text-gray-200 text-[12px] font-semibold cursor-pointer transition select-none border border-black/[0.08] dark:border-white/[0.12]',
              title:
                'When checked, the "Total Carton" column and its summary row will be hidden in exported Excel / CSV files for customer SSEA',
            },
            h('input', {
              type: 'checkbox',
              checked: hideSseaTotalCarton,
              onChange: (e) => onToggleHideSseaTotalCarton(e.target.checked),
              className: 'w-3.5 h-3.5 rounded text-[#007AFF] focus:ring-[#007AFF] cursor-pointer accent-[#007AFF]',
            }),
            h('span', null, 'Hide Total Carton for SSEA in Excel')
          ),
        onExportSimplified &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExportSimplified,
              className:
                'px-3 py-1.5 bg-gray-600 hover:bg-gray-700 dark:bg-[#3A3A3C] dark:hover:bg-[#48484A] text-white text-[12px] font-semibold rounded-[10px] shadow-sm transition flex items-center gap-1.5 cursor-pointer border border-transparent dark:border-white/10',
              title: 'Export simplified Excel sheet (Dimensions only)',
            },
            h(Icon.FileSpreadsheet, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'Simplify Excel (Dims Only)')
          ),
        onExportBulkSummary &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExportBulkSummary,
              className:
                'px-3 py-1.5 bg-[#34C759] hover:bg-[#34C759]/90 dark:bg-[#30D158] dark:hover:bg-[#30D158]/90 text-white dark:text-black font-semibold text-[12px] rounded-[10px] shadow-sm transition flex items-center gap-1.5 cursor-pointer',
              title: 'Combine all D.O. sheets into one Excel workbook with a tab sheet for each D.O.',
            },
            h(Icon.Layers, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'Bulk Summary')
          ),
        onExportBulkSimplified &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExportBulkSimplified,
              className:
                'px-3 py-1.5 bg-gray-600 hover:bg-gray-700 dark:bg-[#3A3A3C] dark:hover:bg-[#48484A] text-white text-[12px] font-semibold rounded-[10px] shadow-sm transition flex items-center gap-1.5 cursor-pointer border border-transparent dark:border-white/10',
              title: 'Combine all D.O. sheets into one Excel workbook (Simplified Dimensions)',
            },
            h(Icon.Layers, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'Bulk Simplify')
          ),
        onNewBatchSession &&
          h(
            'button',
            {
              type: 'button',
              onClick: onNewBatchSession,
              className:
                'px-3 py-1.5 bg-[#FF9500]/12 hover:bg-[#FF9500]/20 dark:bg-[#FF9F0A]/20 dark:hover:bg-[#FF9F0A]/30 text-[#b45309] dark:text-[#FF9F0A] text-[12px] font-semibold rounded-[10px] transition flex items-center gap-1.5 cursor-pointer border border-[#FF9500]/30 dark:border-[#FF9F0A]/40',
              title: 'Clear working D.O. cache to start a fresh batch session for bulk export',
            },
            h(Icon.RotateCcw, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 }),
            h('span', null, 'New Batch Session')
          )
      )
    );


    // ── Table ──
    const isCompact = density === 'compact';
    const cellPadding = isCompact ? 'p-1' : 'p-1.5';
    const inputFontSize = isCompact ? 'text-[12px]' : 'text-[14px]';
    const inputPadding = isCompact ? 'py-1 px-1' : 'py-2 px-1.5';

    const numInputCls =
      `w-full text-center font-semibold text-gray-900 dark:text-[#F5F5F7] tabular-nums font-mono ${inputFontSize} ${inputPadding} bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-[#2C2C2E] focus:outline-none rounded-[6px] focus:ring-1.5 focus:ring-[#007AFF] dark:focus:ring-[#0A84FF] transition placeholder:text-gray-400 dark:placeholder:text-[#8E8E93] placeholder:font-normal`;
    const numInputClsMedium = numInputCls.replace('font-semibold', 'font-medium');

    const numHandler = (id, field) => (e) =>
      handleItemChange(id, field, e.target.value === '' ? '' : Number(e.target.value));

    const thStickyCls =
      'p-2 text-center leading-tight sticky top-0 z-10 bg-[#FAFAFA]/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md text-gray-600 dark:text-[#8E8E93]';

    const tableHead = h(
      'thead',
      null,
      h(
        'tr',
        { className: 'bg-black/[0.02] dark:bg-white/[0.04] text-gray-600 dark:text-[#8E8E93] text-[11px] font-semibold uppercase tracking-wider border-b border-black/[0.08] dark:border-white/[0.12] divide-x divide-black/[0.05] dark:divide-white/[0.06]' },
        // Column 1: Multi-select Checkbox + Row #
        h(
          'th',
          { className: `${thStickyCls} w-14 print:hidden` },
          h(
            'div',
            { className: 'flex items-center justify-center gap-1.5' },
            h('input', {
              type: 'checkbox',
              checked: items.length > 0 && selectedRowIds.size === items.length,
              ref: (el) => {
                if (el) {
                  el.indeterminate = selectedRowIds.size > 0 && selectedRowIds.size < items.length;
                }
              },
              onChange: handleToggleSelectAll,
              title: 'Select / Deselect all rows',
              className: 'w-3.5 h-3.5 rounded text-[#007AFF] focus:ring-[#007AFF] cursor-pointer accent-[#007AFF]',
            }),
            h('span', { className: 'text-[11px] font-semibold text-gray-500 dark:text-gray-400' }, '#')
          )
        ),
        // Column 2: SKID NO. / BOX NO.
        h(
          'th',
          { className: `${thStickyCls} w-32` },
          h(
            'div',
            { className: 'flex items-center justify-center gap-1' },
            h(
              'select',
              {
                value: containerUnit,
                onChange: (e) => handleContainerUnitChange(e.target.value),
                className:
                  'bg-black/[0.05] hover:bg-black/[0.09] text-gray-800 border-black/[0.08] dark:bg-[#2C2C2E] dark:hover:bg-[#3A3A3C] dark:text-white dark:border-white/[0.15] font-semibold text-[11px] uppercase px-2 py-1 rounded-[8px] cursor-pointer border focus:outline-none print:hidden transition shadow-sm [&>option]:bg-white [&>option]:text-gray-900 dark:[&>option]:bg-[#2C2C2E] dark:[&>option]:text-white',
                title: 'Switch header between SKID NO. and BOX NO.',
              },
              h('option', { value: 'SKID', className: 'bg-white text-gray-900 dark:bg-[#2C2C2E] dark:text-white font-medium' }, 'SKID NO.'),
              h('option', { value: 'BOX', className: 'bg-white text-gray-900 dark:bg-[#2C2C2E] dark:text-white font-medium' }, 'BOX NO.')
            ),
            h('span', { className: 'hidden print:inline font-semibold uppercase' }, getPackageUnitLabel(items).columnHeader)
          )
        ),
        // Column 3: Product Code
        h('th', { className: `${thStickyCls} w-36` }, 'Product Code'),
        // Column 4: Qty
        h('th', { className: `${thStickyCls} w-20` }, 'Qty'),
        // Column 5: Total Carton with Context Feedback (SSEA vs MSCSJ)
        h(
          'th',
          { className: `${thStickyCls} w-28` },
          header.customer === 'MSCSJ'
            ? h(
                'div',
                { className: 'flex flex-col items-center justify-center gap-0.5' },
                h('span', null, 'Total Carton'),
                h(
                  'span',
                  { className: 'text-[9px] font-bold text-[#007AFF] dark:text-[#0A84FF] bg-[#007AFF]/10 dark:bg-[#0A84FF]/20 px-1.5 py-0.5 rounded-full normal-case tracking-normal' },
                  '⚡ Auto: Qty÷5'
                )
              )
            : h(
                'div',
                { className: 'flex flex-col items-center justify-center gap-0.5' },
                h('span', { className: 'text-gray-400 dark:text-gray-500' }, 'Total Carton'),
                h(
                  'span',
                  { className: 'text-[9px] font-medium text-gray-400 dark:text-gray-500 bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded-full normal-case tracking-normal' },
                  'Manual / Opt'
                )
              )
        ),
        // Column 6: Weight (KG)
        h('th', { className: `${thStickyCls} w-28` }, 'Weight (B)', h('br'), '(KG)'),
        // Column 7: Length (CM)
        h('th', { className: `${thStickyCls} w-24` }, 'Length (P)', h('br'), '(CM)'),
        // Column 8: Width (CM)
        h('th', { className: `${thStickyCls} w-24` }, 'Width (L)', h('br'), '(CM)'),
        // Column 9: Height (CM)
        h('th', { className: `${thStickyCls} w-24` }, 'Height (T)', h('br'), '(CM)'),
        // Column 10: Actions
        h('th', { className: `${thStickyCls} w-28 print:hidden` }, 'Actions')
      )
    );

    const renderRow = (item, index) => {
      const isSameAsPrevious =
        index > 0 && (item.skidNo.trim() === '' || items[index - 1].skidNo === item.skidNo);

      const isRowSelected = selectedRowIds.has(item.id);
      const rowBgCls = isRowSelected
        ? 'bg-[#007AFF]/[0.06] dark:bg-[#0A84FF]/[0.12] hover:bg-[#007AFF]/[0.1] dark:hover:bg-[#0A84FF]/[0.16]'
        : 'hover:bg-black/[0.015] dark:hover:bg-white/[0.03]';

      const matchedEntry = customerDb.find(
        (e) => e.code8D.toLowerCase() === item.code8D.trim().toLowerCase()
      );

      const skidInputCls =
        `w-full text-center font-semibold ${inputFontSize} ${inputPadding} bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-[#2C2C2E] focus:outline-none rounded-[6px] focus:ring-1.5 focus:ring-[#007AFF]/40 transition ` +
        (isSameAsPrevious ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white');

      const actionBtn =
        'w-6 h-6 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-black/[0.08] dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/[0.15] disabled:opacity-25 cursor-pointer transition';

      const rowUnitToken = (item.skidNo || '').trim().match(/^(SKID|BOX)/i)?.[1]?.toUpperCase();
      const rowUnitLabel = (rowUnitToken || containerUnit) === 'BOX' ? 'Box' : 'Skid';

      const rowAvailableCodes =
        window.LookupParser && window.LookupParser.getAvailableCodesForRow
          ? window.LookupParser.getAvailableCodesForRow({
              items,
              aggregatedLookupEntries,
              customerDb,
              item,
              rowIndex: index,
            })
          : uniqueAvailableCodes;

      const codeInputCls =
        `w-full text-center font-semibold text-gray-900 dark:text-white ${inputFontSize} ${inputPadding} bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-[#2C2C2E] focus:outline-none rounded-[6px] focus:ring-1.5 focus:ring-[#007AFF]/40 transition placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-normal`;

      const codeSelectCls =
        `w-full ${isCompact ? 'text-[11px] py-1 px-1' : 'text-[12px] py-1.5 px-1.5'} font-semibold text-[#007AFF] dark:text-[#0A84FF] bg-[#007AFF]/[0.06] hover:bg-[#007AFF]/[0.12] dark:bg-[#0A84FF]/[0.14] dark:hover:bg-[#0A84FF]/[0.22] border border-[#007AFF]/25 dark:border-[#0A84FF]/35 rounded-[6px] focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed print:hidden truncate transition [&>option]:bg-white [&>option]:text-gray-900 dark:[&>option]:bg-[#2C2C2E] dark:[&>option]:text-white`;

      const codeCell = h(
        'td',
        { className: `${cellPadding} min-w-[170px]` },
        h(
          'div',
          { className: 'flex flex-col gap-1' },
          h('input', {
            type: 'text',
            'data-row-index': index,
            'data-col-key': 'code8D',
            list: 'code8d-suggestions',
            value: item.code8D,
            onChange: (e) => handleItemChange(item.id, 'code8D', e.target.value),
            placeholder: 'Type Product Code...',
            className: codeInputCls,
          }),
          (rowAvailableCodes.length > 0 || (aggregatedLookupEntries.length > 0 && !item.code8D)) &&
            h(
              'select',
              {
                value: item.code8D,
                onChange: (e) => {
                  if (e.target.value) handleItemChange(item.id, 'code8D', e.target.value);
                },
                disabled: rowAvailableCodes.length === 0,
                className: codeSelectCls,
                title: rowAvailableCodes.length === 0 ? 'All models allocated for this DO' : 'Select available product code',
              },
              h(
                'option',
                { value: '' },
                rowAvailableCodes.length === 0 ? '-- All Models Allocated --' : '-- Select Code --'
              ),
              rowAvailableCodes.map((code) => h('option', { key: code, value: code }, code))
            ),
          matchedEntry &&
            matchedEntry.description &&
            h(
              'div',
              {
                className:
                  'text-[11px] font-semibold text-[#15803d] dark:text-[#30D158] bg-[#22c55e]/12 dark:bg-[#30D158]/20 border border-[#22c55e]/20 dark:border-[#30D158]/30 px-2 py-0.5 rounded-[6px] text-center truncate',
                title: `Model Name: ${matchedEntry.description}`,
              },
              matchedEntry.description
            )
        )
      );

      const weightInputCls =
        `w-full text-center font-semibold text-[#007AFF] dark:text-[#0A84FF] ${inputFontSize} ${inputPadding} bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-[#2C2C2E] focus:outline-none rounded-[6px] focus:ring-1.5 focus:ring-[#007AFF]/40 transition placeholder:text-gray-400 placeholder:font-normal`;

      return h(
        'tr',
        {
          key: item.id,
          className: `${rowBgCls} transition divide-x divide-black/[0.04] dark:divide-white/[0.05] group ${isSameAsPrevious ? '' : 'border-t border-black/[0.06] dark:border-white/[0.08]'}`,
        },
        // Column 1: Row # & Selection Checkbox
        h(
          'td',
          { className: `${cellPadding} text-center select-none print:hidden` },
          h(
            'div',
            { className: 'flex items-center justify-center gap-1.5' },
            h('input', {
              type: 'checkbox',
              checked: isRowSelected,
              onChange: () => handleToggleSelectRow(item.id),
              className: 'w-3.5 h-3.5 rounded text-[#007AFF] focus:ring-[#007AFF] cursor-pointer accent-[#007AFF]',
            }),
            h('span', { className: 'text-[11px] font-semibold text-gray-400 dark:text-gray-500 tabular-nums' }, index + 1)
          )
        ),
        // Column 2: Skid No
        h(
          'td',
          { className: cellPadding },
          h('input', {
            type: 'text',
            'data-row-index': index,
            'data-col-key': 'skidNo',
            value: item.skidNo,
            onChange: (e) => handleItemChange(item.id, 'skidNo', e.target.value),
            placeholder: isSameAsPrevious && item.skidNo.trim() === '' ? '' : `${containerUnit}-${(index + 1).toString().padStart(2, '0')}`,
            className: skidInputCls,
          })
        ),
        // Column 3: Product Code
        codeCell,
        // Column 4: Qty
        h('td', { className: cellPadding },
          h('input', {
            type: 'number',
            'data-row-index': index,
            'data-col-key': 'qty',
            value: item.qty,
            onChange: numHandler(item.id, 'qty'),
            placeholder: '0',
            className: numInputCls
          })
        ),
        // Column 5: Total Carton
        h('td', { className: cellPadding },
          h('input', {
            type: 'number',
            'data-row-index': index,
            'data-col-key': 'totalCarton',
            value: item.totalCarton,
            onChange: numHandler(item.id, 'totalCarton'),
            placeholder: header.customer === 'MSCSJ' ? '0' : 'Opt',
            className: numInputClsMedium
          })
        ),
        // Column 6: Weight (Kg)
        h('td', { className: cellPadding },
          h('input', {
            type: 'number',
            step: '0.1',
            'data-row-index': index,
            'data-col-key': 'weightKg',
            value: item.weightKg,
            onChange: numHandler(item.id, 'weightKg'),
            placeholder: '0.0',
            className: weightInputCls
          })
        ),
        // Column 7: Length (CM)
        h('td', { className: cellPadding },
          h('input', {
            type: 'number',
            'data-row-index': index,
            'data-col-key': 'lengthCm',
            value: item.lengthCm,
            onChange: numHandler(item.id, 'lengthCm'),
            placeholder: 'cm',
            className: numInputClsMedium
          })
        ),
        // Column 8: Width (CM)
        h('td', { className: cellPadding },
          h('input', {
            type: 'number',
            'data-row-index': index,
            'data-col-key': 'widthCm',
            value: item.widthCm,
            onChange: numHandler(item.id, 'widthCm'),
            placeholder: 'cm',
            className: numInputClsMedium
          })
        ),
        // Column 9: Height (CM)
        h('td', { className: cellPadding },
          h('input', {
            type: 'number',
            'data-row-index': index,
            'data-col-key': 'heightCm',
            value: item.heightCm,
            onChange: numHandler(item.id, 'heightCm'),
            placeholder: 'cm',
            className: numInputClsMedium
          })
        ),
        // Column 10: Actions
        h(
          'td',
          { className: `${cellPadding} text-center print:hidden` },
          h(
            'div',
            { className: 'flex items-center justify-center gap-1 transition' },
            h('button', { type: 'button', onClick: () => handleMoveRow(index, 'up'), disabled: index === 0, className: actionBtn, title: 'Move up' },
              h(Icon.ArrowUp, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 })),
            h('button', { type: 'button', onClick: () => handleMoveRow(index, 'down'), disabled: index === items.length - 1, className: actionBtn, title: 'Move down' },
              h(Icon.ArrowDown, { className: 'w-3.5 h-3.5', strokeWidth: 1.5 })),
            h('button', {
              type: 'button',
              onClick: () => handleDuplicateAsNextSkid(index),
              className: 'px-2.5 py-1 text-[11px] font-bold text-[#007AFF] dark:text-[#0A84FF] bg-[#007AFF]/12 hover:bg-[#007AFF]/22 dark:bg-[#0A84FF]/20 dark:hover:bg-[#0A84FF]/30 border border-[#007AFF]/25 dark:border-[#0A84FF]/35 rounded-full cursor-pointer transition active:scale-95 whitespace-nowrap shadow-sm flex items-center gap-1',
              title: `Add next ${rowUnitLabel} copying dimensions and product code (Qty ready to type)`,
            },
              h(Icon.Copy, { className: 'w-3 h-3', strokeWidth: 2 }),
              `+ Next ${rowUnitLabel}`),
            h('button', { type: 'button', onClick: () => handleAddModelToSkid(index), className: 'px-2.5 py-1 text-[11px] font-bold text-[#15803d] dark:text-[#30D158] bg-[#22c55e]/15 hover:bg-[#22c55e]/25 dark:bg-[#30D158]/20 dark:hover:bg-[#30D158]/30 border border-[#22c55e]/25 dark:border-[#30D158]/35 rounded-full cursor-pointer transition active:scale-95 whitespace-nowrap shadow-sm', title: 'Add another model to this SKID/BOX' },
              'Add Model'),
            h('button', { type: 'button', onClick: () => handleDeleteRow(item.id), className: 'px-2.5 py-1 text-[11px] font-bold text-[#b91c1c] dark:text-[#FF453A] bg-[#ef4444]/15 hover:bg-[#ef4444]/25 dark:bg-[#FF453A]/20 dark:hover:bg-[#FF453A]/30 border border-[#ef4444]/25 dark:border-[#FF453A]/35 rounded-full cursor-pointer transition active:scale-95 whitespace-nowrap shadow-sm', title: 'Delete row' },
              'Delete Row')
          )
        )
      );
    };

    const totalsRow = h(
      'tr',
      { className: 'bg-black/[0.02] dark:bg-white/[0.04] font-semibold text-gray-900 dark:text-white border-t-2 border-black/[0.1] dark:border-white/[0.15] divide-x divide-black/[0.04] dark:divide-white/[0.06] text-[14px]' },
      h('td', { className: 'p-2.5 text-center text-gray-400 dark:text-[#8E8E93] print:hidden' }, '—'),
      h('td', { className: 'p-2.5 text-center uppercase tracking-wider text-[11px] text-gray-600 dark:text-[#8E8E93] font-bold' }, 'TOTALS'),
      h('td', { className: 'p-2.5 text-center text-gray-400 dark:text-[#8E8E93]' }, '—'),
      h('td', { className: 'p-2.5 text-center text-[#007AFF] dark:text-[#0A84FF] text-[15px] font-bold tabular-nums font-mono' }, totalQty.toLocaleString()),
      h('td', { className: 'p-2.5 text-center text-gray-900 dark:text-[#F5F5F7] text-[15px] font-bold tabular-nums font-mono' }, totalCarton),
      h('td', { className: 'p-2.5 text-center text-[#34C759] dark:text-[#30D158] text-[15px] font-bold tabular-nums font-mono' }, `${totalWeight.toFixed(1)} kg`),
      h('td', { colSpan: 3, className: 'p-2.5 text-center text-gray-500 dark:text-[#8E8E93] text-[12px] font-normal' }, 'Calculated CBM Auto-Included in Excel'),
      h('td', { className: 'p-2.5 print:hidden' })
    );

    const table = h(
      'div',
      {
        className:
          'overflow-x-auto border border-black/[0.08] dark:border-white/[0.1] rounded-[14px] bg-white dark:bg-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative max-h-[72vh] overflow-y-auto',
      },
      h(
        'table',
        {
          ref: tableRef,
          onKeyDown: handleTableKeyDown,
          className: 'w-full text-left border-collapse min-w-[1050px]',
        },
        tableHead,
        h(
          'tbody',
          { className: density === 'compact' ? 'text-[12px] font-medium' : 'text-[14px] font-medium' },
          items.map((item, index) => renderRow(item, index)),
          totalsRow
        )
      )
    );

    const batchBar =
      selectedRowIds.size > 0 &&
      h(
        'div',
        {
          className:
            'sticky bottom-4 z-30 mx-auto mt-3 mb-2 px-4 py-2.5 bg-white/95 dark:bg-[#252528]/95 text-gray-900 dark:text-white rounded-[14px] shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.7)] backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 max-w-2xl border border-black/10 dark:border-white/15 transition duration-200 print:hidden',
        },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(
            'span',
            { className: 'px-2.5 py-0.5 rounded-full bg-[#007AFF]/12 dark:bg-[#0A84FF]/25 text-[#007AFF] dark:text-[#0A84FF] text-[12px] font-bold tracking-wide border border-[#007AFF]/20 dark:border-[#0A84FF]/35' },
            `${selectedRowIds.size} row${selectedRowIds.size > 1 ? 's' : ''} selected`
          )
        ),
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(
            'div',
            { className: 'flex items-center gap-1.5 bg-black/[0.04] dark:bg-white/[0.08] rounded-[8px] px-2 py-1 border border-black/[0.06] dark:border-white/[0.1]' },
            h('span', { className: 'text-[11px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wide' }, 'Set to:'),
            h('input', {
              type: 'text',
              value: batchContainerInput,
              onChange: (e) => setBatchContainerInput(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyBatchContainer();
                }
              },
              placeholder: `${containerUnit}-01`,
              className:
                'w-24 px-2 py-0.5 text-[12px] font-semibold rounded-[6px] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white border border-black/[0.1] dark:border-white/[0.15] focus:outline-none focus:ring-1.5 focus:ring-[#007AFF] text-center placeholder:text-gray-400 dark:placeholder:text-gray-500 transition',
            }),
            h(
              'button',
              {
                type: 'button',
                onClick: handleApplyBatchContainer,
                className:
                  'px-2.5 py-1 bg-[#007AFF] hover:bg-[#007AFF]/90 dark:bg-[#0A84FF] dark:hover:bg-[#0A84FF]/90 text-white text-[11px] font-semibold rounded-[6px] transition cursor-pointer active:scale-95 shadow-sm',
                title: 'Apply container label to selected rows',
              },
              'Apply'
            )
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: handleBatchDuplicate,
              className:
                'px-3 py-1.5 rounded-[8px] bg-black/[0.05] hover:bg-black/[0.09] dark:bg-white/[0.1] dark:hover:bg-white/[0.16] text-gray-800 dark:text-white text-[12px] font-semibold border border-black/[0.08] dark:border-white/15 transition cursor-pointer flex items-center gap-1.5 active:scale-95',
              title: 'Duplicate all selected rows',
            },
            h(Icon.Plus, { className: 'w-3.5 h-3.5 text-gray-600 dark:text-gray-300', strokeWidth: 1.5 }),
            'Duplicate'
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: handleBatchDelete,
              className:
                'px-3 py-1.5 rounded-[8px] bg-[#FF3B30]/12 hover:bg-[#FF3B30]/20 dark:bg-[#FF453A]/20 dark:hover:bg-[#FF453A]/30 text-[#D70015] dark:text-[#FF453A] text-[12px] font-semibold border border-[#FF3B30]/25 dark:border-[#FF453A]/35 transition cursor-pointer flex items-center gap-1.5 active:scale-95',
              title: 'Delete all selected rows',
            },
            h(Icon.Trash2, { className: 'w-3.5 h-3.5 text-[#D70015] dark:text-[#FF453A]', strokeWidth: 1.5 }),
            'Delete'
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: handleClearSelection,
              className:
                'p-1.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.12] text-gray-400 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition cursor-pointer ml-1',
              title: 'Clear selection',
            },
            h(Icon.X, { className: 'w-4 h-4', strokeWidth: 2 })
          )
        )
      );

    const addRowButtons = h(
      'div',
      { className: 'mt-4 flex flex-wrap justify-between items-center gap-2 print:hidden' },
      h(
        'div',
        { className: 'flex flex-wrap items-center gap-2' },
        h(
          'button',
          {
            type: 'button',
            onClick: () => handleDuplicateAsNextSkid(items.length - 1, containerUnit),
            className:
              'inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#007AFF] hover:bg-[#007AFF]/90 dark:bg-[#0A84FF] dark:hover:bg-[#0A84FF]/90 text-white font-semibold text-[13px] rounded-[10px] shadow-[0_1px_4px_rgba(0,122,255,0.3)] transition cursor-pointer active:scale-95',
            title: `Add next sequential ${containerUnit === 'BOX' ? 'box' : 'skid'} copying dimensions and product code from previous row (Qty ready to type)`,
          },
          h(Icon.Copy, { className: 'w-4 h-4', strokeWidth: 2 }),
          h('span', null, `+ Next ${containerUnit === 'BOX' ? 'Box' : 'Skid'} (Copy Dims)`)
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: () => handleAddRow('SKID'),
            className:
              'inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-black/[0.05] hover:bg-black/[0.09] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-gray-800 dark:text-gray-200 font-semibold text-[12px] rounded-[10px] border border-black/[0.08] dark:border-white/[0.1] transition cursor-pointer active:scale-95',
            title: 'Add a new blank row with pre-filled SKID label',
          },
          h(Icon.Plus, { className: 'w-3.5 h-3.5 text-gray-500 dark:text-gray-400', strokeWidth: 2 }),
          h('span', null, 'Blank Skid Row')
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: () => handleAddRow('BOX'),
            className:
              'inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-black/[0.05] hover:bg-black/[0.09] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-gray-800 dark:text-gray-200 font-semibold text-[12px] rounded-[10px] border border-black/[0.08] dark:border-white/[0.1] transition cursor-pointer active:scale-95',
            title: 'Add a new blank row with pre-filled BOX label',
          },
          h(Icon.Plus, { className: 'w-3.5 h-3.5 text-gray-500 dark:text-gray-400', strokeWidth: 2 }),
          h('span', null, 'Blank Box Row')
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
      { className: 'bg-white dark:bg-[#1C1C1E] rounded-[20px] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6 sm:p-8 font-sans max-w-[1280px] mx-auto print:border-none print:shadow-none print:p-0 transition-colors duration-300 relative' },
      topSection,
      toolsBar,
      table,
      batchBar,
      addRowButtons,
      signatures,
      codeDatalist
    );
  };

  window.PackingSheetForm = PackingSheetForm;
})();

