const fs = require('fs');
let content = fs.readFileSync('js/volume_capacity_planner.js', 'utf8');

const target = `                    // Calculate m3 from carton dimensions if available, otherwise use fallback, otherwise 0
                    if (l > 0 && w > 0 && h > 0) {
                        m3 = (l * w * h) / 1000000;
                    } else if (isNaN(m3) || m3 < 0) {
                        m3 = null;
                    }
                    
                    let maxPallet = row[7] ? parseInt(String(row[7]).trim()) : null;
                    if (isNaN(maxPallet) || maxPallet <= 0) maxPallet = null;
                    const type = row[8] ? String(row[8]).trim() : '';`;

const replacement = `                    let maxPallet = row[7] ? parseInt(String(row[7]).trim()) : null;
                    if (isNaN(maxPallet) || maxPallet <= 0) maxPallet = null;
                    const type = row[8] ? String(row[8]).trim() : '';
                    
                    const upperType = type.toUpperCase();

                    // Calculate m3 from carton dimensions strictly for HIFI if available, otherwise use fallback
                    if ((upperType === 'HIFI' || upperType === 'HIFI AUDIO') && l > 0 && w > 0 && h > 0) {
                        m3 = (l * w * h) / 1000000;
                    } else if (isNaN(m3) || m3 < 0) {
                        m3 = null;
                    }`;

content = content.replace(target, replacement);
fs.writeFileSync('js/volume_capacity_planner.js', content);
