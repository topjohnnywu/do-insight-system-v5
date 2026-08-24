/* D.O. verification logic (classic script → window.VerifyDo). Logic preserved verbatim. */
(function () {
  const toNum = (v) => {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (v === '' || v === undefined) return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  const norm = (code) => (code || '').trim().toLowerCase();

  function verifyAgainstDo(items, lookupEntries) {
    const expectedMap = new Map();
    lookupEntries.forEach((e) => {
      const key = norm(e.code8D);
      if (!key) return;
      const existing = expectedMap.get(key);
      const qty = toNum(e.qty);
      if (existing) {
        existing.qty += qty;
        if (!existing.description && e.description) existing.description = e.description;
      } else {
        expectedMap.set(key, { qty, description: e.description });
      }
    });

    const actualMap = new Map();
    items.forEach((it) => {
      const key = norm(it.code8D);
      if (!key) return;
      actualMap.set(key, (actualMap.get(key) || 0) + toNum(it.qty));
    });

    const results = [];

    expectedMap.forEach((exp, key) => {
      const hasRow = actualMap.has(key);
      const actual = actualMap.get(key) || 0;
      const expected = exp.qty;
      const diff = actual - expected;

      let status;
      if (!hasRow) {
        status = 'missing';
      } else if (actual < expected) {
        status = 'short';
      } else if (actual > expected) {
        status = 'over';
      } else {
        status = 'ok';
      }

      results.push({
        code8D: key,
        description: exp.description,
        expectedQty: expected,
        actualQty: actual,
        diff,
        status,
      });
    });

    actualMap.forEach((actual, key) => {
      if (!expectedMap.has(key)) {
        results.push({
          code8D: key,
          expectedQty: 0,
          actualQty: actual,
          diff: actual,
          status: 'extra',
        });
      }
    });

    const order = { missing: 0, short: 1, over: 2, extra: 3, ok: 4 };
    results.sort((a, b) => order[a.status] - order[b.status]);

    const counts = { ok: 0, short: 0, over: 0, missing: 0, extra: 0 };
    results.forEach((r) => {
      counts[r.status] += 1;
    });

    const overallPass =
      counts.missing === 0 && counts.short === 0 && counts.over === 0 && counts.extra === 0;

    return { overallPass, results, counts };
  }

  window.VerifyDo = { verifyAgainstDo };
})();
