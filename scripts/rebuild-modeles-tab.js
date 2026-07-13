const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const rel = 'modules/ugap/frontend/parametrage/assets/js/modeles/modeles-tab.js';
const STOP = ['variantes (ordre uniquement)', 'variant_reorder', 'orderVariants', 'VL()', 'modelActiveOrderVariant'];

const specs = [
    ['9a7d4d41', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/9a7d4d41-f898-45c3-b5ce-6352c806064b/9a7d4d41-f898-45c3-b5ce-6352c806064b.jsonl'), 99999],
    ['086033dd', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/086033dd-d8d5-469c-8909-ec6988cf88c9/086033dd-d8d5-469c-8909-ec6988cf88c9.jsonl'), 204],
    ['5e03d667', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/5e03d667-9f8a-469a-84dd-a48e08c2c21d/5e03d667-9f8a-469a-84dd-a48e08c2c21d.jsonl'), 99999],
];

let content = fs.readFileSync(path.join(ROOT, 'restore-write-9a7d4d41-f898-45c3-b5ce-6352c806064b-modeles.js'), 'utf8');
let applied = 0;
let missed = 0;

for (const [, file, stop] of specs) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    for (let li = 0; li < lines.length && li + 1 < stop; li++) {
        let row;
        try {
            row = JSON.parse(lines[li]);
        } catch {
            continue;
        }
        for (const part of row?.message?.content || []) {
            if (part?.name !== 'StrReplace') continue;
            if (!String(part.input?.path || '').includes('modeles-tab')) continue;
            const txt = `${part.input.new_string || ''}${part.input.old_string || ''}`;
            if (STOP.some((m) => txt.includes(m))) continue;
            const old = part.input.old_string || '';
            if (content.includes(old)) {
                content = content.replace(old, part.input.new_string || '');
                applied++;
            } else {
                missed++;
            }
        }
    }
}

fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
console.log(`applied ${applied}, missed ${missed}, lines ${content.split(/\r?\n/).length}`);
console.log('reorder btn', content.includes('data-modeles-preset-reorder'));
console.log('template select', content.includes('ugap-modeles-template-select'));
console.log('preset_reorder', content.includes("'preset_reorder'"));
