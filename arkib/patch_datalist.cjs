const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/components/PackingSheetForm.js', 'utf8');

const target = `    const codeDatalist = h(
      'datalist',
      { id: 'code8d-suggestions' },
      customerDb.map((entry) =>
        h('option', { key: entry.id, value: entry.code8D },
          entry.doNo ? \`[\${entry.doNo}] \${entry.description || ''}\` : entry.description || '')
      )
    );`;

const replacement = `    const codeDatalist = h(
      'datalist',
      { id: 'code8d-suggestions' },
      matchedLookupEntries.map((entry) =>
        h('option', { key: entry.id, value: entry.code8D },
          entry.doNo ? \`[\${entry.doNo}] \${entry.description || ''}\` : entry.description || '')
      )
    );`;

content = content.replace(target, replacement);
fs.writeFileSync('packing-sheet/js/components/PackingSheetForm.js', content);
