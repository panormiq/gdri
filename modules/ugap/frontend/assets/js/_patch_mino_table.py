# -*- coding: utf-8 -*-
import re
from pathlib import Path

path = Path(__file__).with_name('ugap-import-minorations-workflow.js')
s = path.read_text(encoding='utf-8')

new_helpers = r'''    function formatPostesListForMinoration(opt) {
        if (typeof getSortedExplicitPosteNumbersFromLabel === 'function') {
            const nums = getSortedExplicitPosteNumbersFromLabel(opt?.name);
            if (nums.length) return nums.join(', ');
        }
        const cm = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map(String) : [];
        if (!cm.length) return '—';
        const models = getImportStagingModelsForAssignment();
        const postes = models
            .filter((m) => cm.includes(String(m?.id || '').trim()))
            .map((m) => m?.posteNumber)
            .filter((pn) => pn != null && pn !== '');
        const unique = [...new Set(postes.map((p) => Number(p)))].filter(Number.isFinite).sort((a, b) => a - b);
        return unique.length ? unique.join(', ') : '—';
    }

    function isMinorationCheckboxSuggested(opt, model) {
        if (typeof getExplicitPosteSetFromLabel !== 'function') return false;
        const explicit = getExplicitPosteSetFromLabel(opt?.name);
        if (!explicit || !explicit.size) return false;
        const pn = Number(model?.posteNumber);
        return Number.isFinite(pn) && explicit.has(pn);
    }

    function renderImportMinorationRowMeta(links, opt) {
        if (!links) return '—';
        const base = escapeHtml(links.initialProduct || '—');
        const repl = escapeHtml(links.finalProduct || '—');
        const postes = escapeHtml(formatPostesListForMinoration(opt));
        const motorCls = links.changeType === 'motor' ? ' ugap-import-mino-motor' : '';
        const raw = escapeHtml(String(opt?.name || ''));
        const optId = encodeURIComponent(String(opt?.id || '').trim());
        return `<div><strong>Option de base :</strong> <span class="${motorCls}">${base}</span></div>
            <motion class="ugap-import-mino-hint"><strong>Postes :</strong> ${postes}</div>
            <div class="ugap-import-mino-hint"><strong>Remplacer par :</strong> ${repl}</div>
            <div class="ugap-import-mino-label-raw">${raw}</div>
            <div class="ugap-import-mino-row-actions">
                <button type="button" class="btn btn-outline" onclick="toggleAllImportMinorationRow(decodeURIComponent('${optId}'), true)">Tous</button>
                <button type="button" class="btn btn-outline" onclick="toggleAllImportMinorationRow(decodeURIComponent('${optId}'), false)">Aucun</button>
            </motion>`;
    }

    function renderImportMinorationRegistrySummary(registry) {
        if (!registry || !registry.size) return '';
        const models = getImportStagingModelsForAssignment();
        const modelById = new Map(models.map((m) => [String(m?.id || '').trim(), m]));
        const items = [...registry.values()].map((entry) => {
            const postes = [...entry.modelIds]
                .map((mid) => modelById.get(String(mid))?.posteNumber)
                .filter((pn) => pn != null && pn !== '')
                .map((p) => Number(p))
                .filter(Number.isFinite);
            const uniq = [...new Set(postes)].sort((a, b) => a - b);
            return `<li><strong>${escapeHtml(entry.label)}</strong> — postes ${escapeHtml(uniq.join(', ') || '—')}</li>`;
        }).join('');
        return `<div class="ugap-import-mino-registry"><strong>Postes par option de base</strong><ul>${items}</ul></div>`;
    }

    function toggleAllImportMinorationRow(optionId, selectAll) {
        const opt = findImportStagingOptionById(optionId);
        if (!opt) return;
        const models = getImportStagingModelsForAssignment();
        opt.compatibleModels = selectAll
            ? models.map((m) => String(m?.id || '').trim()).filter(Boolean)
            : [];
        syncImportMinorationRecapDock();
        renderImportWorkflow();
    }

'''.replace('<motion ', '<motion ').replace('</motion>', '</div>')

# Fix accidental motion tags in template above
new_helpers = new_helpers.replace('<motion class=', '<div class=').replace('</motion>`', '</motion>`')

path.write_text('')  # placeholder
