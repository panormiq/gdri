const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const rel = 'modules/ugap/frontend/assets/js/shared/ugap-model-base-options.js';
const STOP = ['orderVariants', 'modelActiveOrderVariant', 'variant_reorder', 'getActiveOrderVariantForModel'];

function relPath(p) {
    const s = String(p || '').replace(/\\/g, '/');
    const i = s.toLowerCase().indexOf('modules/ugap');
    return i >= 0 ? s.slice(i) : null;
}

const specs = [
    ['9a7d4d41', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/9a7d4d41-f898-45c3-b5ce-6352c806064b/9a7d4d41-f898-45c3-b5ce-6352c806064b.jsonl'), 99999],
    ['086033dd', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/086033dd-d8d5-469c-8909-ec6988cf88c9/086033dd-d8d5-469c-8909-ec6988cf88c9.jsonl'), 204],
    ['5e03d667', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/5e03d667-9f8a-469a-84dd-a48e08c2c21d/5e03d667-9f8a-469a-84dd-a48e08c2c21d.jsonl'), 99999],
    ['5374a8f3', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/5374a8f3-235c-4cc6-9604-5989951ed8d7/5374a8f3-235c-4cc6-9604-5989951ed8d7.jsonl'), 99999],
    ['f48e53f0', path.join(process.env.USERPROFILE, '.cursor/projects/c-xampp-htdocs-gdri/agent-transcripts/f48e53f0-8879-4a44-a175-7d942f8b9cd6/f48e53f0-8879-4a44-a175-7d942f8b9cd6.jsonl'), 99999],
];

let content = execSync(`git show HEAD:${rel}`, { encoding: 'utf8', cwd: ROOT });
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
            if (relPath(part.input?.path) !== rel) continue;
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
const dupSet = (content.match(/function setPresetEditContext/g) || []).length;
const dupGet = (content.match(/getConfigurationCatalogParcoursOrder/g) || []).length;
console.log(`applied ${applied}, missed ${missed}, lines ${content.split(/\r?\n/).length}`);
console.log(`setPresetEditContext defs: ${dupSet}, getConfigurationCatalogParcoursOrder mentions: ${dupGet}`);
