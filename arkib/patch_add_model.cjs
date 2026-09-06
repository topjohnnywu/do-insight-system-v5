const fs = require('fs');
let content = fs.readFileSync('packing-sheet/js/components/PackingSheetForm.js', 'utf8');

const target = `    const handleAddModelToSkid = (index) => {
      const target = items[index];
      const newItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        skidNo: '',
        code8D: '', qty: '', totalCarton: '',
        weightKg: target.weightKg,
        lengthCm: target.lengthCm,
        widthCm: target.widthCm,
        heightCm: target.heightCm,
      };`;

const replacement = `    const handleAddModelToSkid = (index) => {
      const target = items[index];
      const newItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        skidNo: '',
        code8D: '', qty: '', totalCarton: '',
        weightKg: '',
        lengthCm: '',
        widthCm: '',
        heightCm: '',
      };`;

content = content.replace(target, replacement);
fs.writeFileSync('packing-sheet/js/components/PackingSheetForm.js', content);
