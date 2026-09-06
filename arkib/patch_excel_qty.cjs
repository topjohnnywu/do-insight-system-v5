const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/utils/excelExport.js', 'utf8');

const target = `    // Summary Section
    if (displayRows.length > 0) {
      const summary = computeSummary(displayRows);`;

const replace = `    // Summary Section
    if (displayRows.length > 0) {
      const standardFiltered = items.filter(
        (item) => item.skidNo || item.code8D || item.qty !== '' || item.totalCarton !== '' || item.weightKg !== ''
      );
      const summaryItems = standardFiltered.length > 0 ? standardFiltered : items;
      const summary = computeSummary(summaryItems);`;

// Only replace the second occurrence (which is inside populateSimplifiedWorksheet)
const occurrences = content.split(target);
if (occurrences.length === 3) {
    // It means the target was found twice.
    content = occurrences[0] + target + occurrences[1] + replace + occurrences[2];
    fs.writeFileSync('packing-sheet/js/utils/excelExport.js', content);
    console.log('excelExport.js patched successfully');
} else if (occurrences.length === 2) {
    // Found once, wait this doesn't match `if (!isTemplate && displayRows.length > 0)`
    // Ah, line 281 in populateWorksheet is:
    // `if (!isTemplate && displayRows.length > 0) {`
    // Line 512 in populateSimplifiedWorksheet is:
    // `if (displayRows.length > 0) {`
    // So the target is unique!
    content = occurrences[0] + replace + occurrences[1];
    fs.writeFileSync('packing-sheet/js/utils/excelExport.js', content);
    console.log('excelExport.js patched successfully (unique match)');
} else {
    console.log('Target count: ' + occurrences.length);
}
