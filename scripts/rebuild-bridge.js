const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const rel = 'modules/ugap/frontend/parametrage/assets/js/shared/parametrage-parcours-bridge.js';
const STOP = ['orderVariants', 'modelActiveOrderVariant', 'variant_reorder', 'renderTemplateOrderVariants'];

function relPath(p) {
    const s = String(p || '').replace(/\\/g, '/');
    const i = s.toLowerCase().indexOf('modules/ugap');
    return i >= 0 ? s.slice(i) : null;
}

const specs = [
    ['9a7d4d41', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/9a7d4d41-f898-45c3-b5ce-6352c806064b/9a7d4d41-f898-45c3-b5ce-6352c806064b.jsonl'), 99999],
    ['5e03d667', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/5e03d667-9f8a-469a-84dd-a48e08c2c21d/5e03d667-9f8a-469a-84dd-a48e08c2c21d.jsonl'), 99999],
    ['086033dd', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/086033dd-d8d5-469c-8909-ec6988cf88c9/086033dd-d8d5-469c-8909-ec6988cf88c9.jsonl'), 204],
    ['5374a8f3', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/5374a8f3-235c-4cc6-9604-5989951ed8d7/5374a8f3-235c-4cc6-9604-5989951ed8d7.jsonl'), 99999],
    ['f48e53f0', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/f48e53f0-8879-4a44-a175-7d942f8b9cd6/f48e53f0-8879-4a44-a175-7d942f8b9cd6.jsonl'), 99999],
];

let content = fs.readFileSync(path.join(ROOT, 'restore-write-parametrage-parcours-bridge.js'), 'utf8');
let applied = 0;
let missed = 0;
const missedOps = [];

for (const [id, file, stop] of specs) {
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
            if (relPath(part.input?.path) !== rel) continue;
            const txt = `${part.input.new_string || ''}${part.input.old_string || ''}`;
            if (STOP.some((m) => txt.includes(m))) continue;
            const old = part.input.old_string || '';
            if (content.includes(old)) {
                content = content.replace(old, part.input.new_string || '');
                applied++;
            } else {
                missed++;
                missedOps.push({ id, line: li + 1, preview: old.slice(0, 70).replace(/\n/g, '\\n') });
            }
        }
    }
}

fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
const dup = (content.match(/function renderModelPresetReorderParcours/g) || []).length;
console.log(`applied ${applied}, missed ${missed}, lines ${content.split(/\r?\n/).length}, dup ${dup}`);
if (missedOps.length) {
    missedOps.slice(0, 15).forEach((o) => console.log(`${o.id}:${o.line} ${o.preview}`));
}
