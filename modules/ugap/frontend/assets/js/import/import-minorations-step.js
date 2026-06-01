/**
 * FICHIER : modules/ugap/frontend/assets/js/import/import-minorations-step.js
 * RÔLE : Étape 2 workflow import — tableau minorations (assignation postes / prix).
 * ENTRÉES : `window.currentImportStaging`, helpers assign dans `import-workflow-steps.js`.
 * SORTIES : HTML étape 2 ; POST minorations via `saveImportMinorationsStep` (workflow-steps).
 * DÉPEND DE : `import-workflow-steps.js` (`__ugapRenderImportAssignStep`, `isImportMinorationOption`, …).
 * NE PAS : majorations, options de base, options/tri, publication.
 * APPELÉ PAR : `import-workflow-shell.js` (`renderImportWorkflow`).
 */
(function () {
    'use strict';

    function renderImportMinorationsStepHtml() {
        const renderAssign = window.__ugapRenderImportAssignStep;
        if (typeof renderAssign !== 'function') {
            return '<div style="color:#b45309;">Étape minorations indisponible (charger import-workflow-steps.js).</div>';
        }
        return renderAssign({
            stepTitle: 'Étape 2 — Minorations',
            filterFn: (opt) => typeof window.isImportMinorationOption === 'function' && window.isImportMinorationOption(opt),
            emptyModelsMsg: 'Validez d\'abord les modèles (étape 1) avant d\'assigner les minorations.',
            emptyRowsMsg: 'Aucune minoration détectée (réf. MINO). Réimportez le fichier Excel si besoin.',
            nextStep: 'majorations',
            nextLabel: 'Étape suivante → Majorations',
            seedHandlerName: 'runSeedImportMinorationPostes',
            saveHandlerName: 'saveImportMinorationsStep',
            priceKind: 'minoration',
            hideSuppressions: true,
            autoSeedFn: maybeAutoSeedImportMinorationPostes
        });
    }

    function importAdjRowsNeverPosteSeeded(filterFn) {
        const flat = typeof window.getImportStagingOptionsFlat === 'function'
            ? window.getImportStagingOptionsFlat()
            : [];
        const rows = flat.filter(filterFn);
        if (!rows.length) return false;
        return !rows.some((opt) => (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : []).length > 0);
    }

    function maybeAutoSeedImportMinorationPostes() {
        const models = typeof window.getImportStagingModelsForAssignment === 'function'
            ? window.getImportStagingModelsForAssignment()
            : [];
        const flat = typeof window.getImportStagingOptionsFlat === 'function'
            ? window.getImportStagingOptionsFlat()
            : [];
        const isMino = window.isImportMinorationOption;
        const minos = typeof isMino === 'function' ? flat.filter(isMino) : [];
        if (!models.length || !minos.length) return 0;
        const wf = window.importWorkflowState || (window.importWorkflowState = {});
        if (wf.minoAutoSeeded && !importAdjRowsNeverPosteSeeded(isMino)) return 0;
        const seed = window.seedImportMinorationPosteAssignments;
        const n = typeof seed === 'function' ? seed() : 0;
        wf.minoAutoSeeded = true;
        return n;
    }

    function runSeedImportMinorationPostes() {
        const seed = window.seedImportMinorationPosteAssignments;
        const n = typeof seed === 'function' ? seed() : 0;
        if (typeof window.showAlert === 'function') {
            window.showAlert(`${n} ligne(s) mise(s) à jour (postes pré-cochés).`, n ? 'success' : 'info');
        }
        if (typeof window.renderImportWorkflow === 'function') window.renderImportWorkflow();
    }

    window.renderImportMinorationsStepHtml = renderImportMinorationsStepHtml;
    window.maybeAutoSeedImportMinorationPostes = maybeAutoSeedImportMinorationPostes;
    window.runSeedImportMinorationPostes = runSeedImportMinorationPostes;
})();
