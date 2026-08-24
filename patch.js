const fs = require('fs');
let content = fs.readFileSync('js/do_load_planner.js', 'utf8');

const target = `                        if (matchedModel && matchedModel.type) {
                            doType = matchedModel.type.toUpperCase();
                        }`;

const replacement = `                        if (matchedModel && matchedModel.type) {
                            doType = matchedModel.type.toUpperCase();
                            if (doType === 'HIFI' || doType === 'HIFI AUDIO') {
                                if (matchedModel.l > 0 && matchedModel.w > 0 && matchedModel.h > 0) {
                                    vol = ((matchedModel.l * matchedModel.w * matchedModel.h) / 1000000) * qty;
                                }
                            }
                        }`;

content = content.replace(target, replacement);
fs.writeFileSync('js/do_load_planner.js', content);
