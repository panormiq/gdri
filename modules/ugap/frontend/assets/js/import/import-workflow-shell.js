/**
 * FICHIER : modules/ugap/frontend/assets/js/import/import-workflow-shell.js
 * RÔLE : Coque workflow import — indicateur, navigation étapes 1–7, orchestration rendu.
 * ENTRÉES : `window.currentImportStaging`, `importWorkflowState`, DOM workflow.
 * SORTIES : Affichage panes ; appels renderers d’étapes (modules séparés).
 * DÉPEND DE : import-models-step.js, import-workflow-steps.js (étapes 2–7).
 * NE PAS : logique métier d’une étape (tableaux minorations, etc.).
 * APPELÉ PAR : import-list.js, admin.php, import-workflow-steps.js.
 */
(function () {
    'use strict';

    const wf = () => window.importWorkflowState || (window.importWorkflowState = { step: 'models' });

    function ensureImportTabVisible() {
        const importPanel = document.getElementById('tab-import');
        if (!importPanel) return false;
        if (document.getElementById('ugap-import-app')) {
            if (typeof window.workspaceMode !== 'undefined') window.workspaceMode = 'import';
            return true;
        }
        const importTab = document.querySelector('.tab[data-tab="import"]');
        if (!importTab) return false;
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        importTab.classList.add('active');
        importPanel.classList.add('active');
        const backofficeCard = document.getElementById('legacy-backoffice-card');
        if (backofficeCard) backofficeCard.style.display = 'block';
        if (typeof window.onEmbeddedTabActivated === 'function') {
            window.onEmbeddedTabActivated();
        } else if (typeof window.scheduleParentEmbedResize === 'function') {
            window.scheduleParentEmbedResize();
        }
        return true;
    }

    function renderImportStagingIndicator(staging) {
        const badgeEl = document.getElementById('import-staging-badge');
        const metaEl = document.getElementById('import-staging-meta');
        const progressEl = document.getElementById('import-staging-progress');
        const resumeBtn = document.getElementById('btn-resume-import');
        if (!badgeEl || !metaEl || !resumeBtn || !progressEl) return;

        const rowValidated = (modelId, set) => {
            if (typeof window.importModelRowDisplayValidated === 'function') {
                return window.importModelRowDisplayValidated(modelId, set);
            }
            const id = String(modelId || '').trim();
            return !!id && set.has(id);
        };

        if (!staging) {
            badgeEl.textContent = 'Aucun';
            badgeEl.style.background = '#e5e7eb';
            badgeEl.style.color = '#374151';
            metaEl.textContent = 'Aucun import en cours.';
            progressEl.textContent = '0/0 modeles valides - 0 modeles de base configures - 0/0 options configurees';
            resumeBtn.style.display = 'none';
            return;
        }

        const status = String(staging.status || 'draft').toLowerCase();
        const sourceName = String(staging?.source?.sourceFileName || 'fichier inconnu');
        const importedAt = staging?.source?.importedAt
            ? new Date(staging.source.importedAt).toLocaleString('fr-FR')
            : '';
        const statusLabel = {
            draft: 'A valider',
            in_review: 'En cours',
            validated: 'Valide',
            published: 'Reprendre l\'importation'
        }[status] || status;
        const colorByStatus = {
            draft: { bg: '#fde68a', fg: '#92400e' },
            in_review: { bg: '#bfdbfe', fg: '#1e3a8a' },
            validated: { bg: '#bbf7d0', fg: '#166534' },
            published: { bg: '#d1fae5', fg: '#065f46' }
        }[status] || { bg: '#e5e7eb', fg: '#374151' };

        badgeEl.textContent = statusLabel;
        badgeEl.style.background = colorByStatus.bg;
        badgeEl.style.color = colorByStatus.fg;
        metaEl.textContent = importedAt
            ? `${sourceName} - importe le ${importedAt}`
            : `${sourceName} - import en zone tampon`;

        const models = Array.isArray(staging?.models) ? staging.models : [];
        const validatedModelIds = new Set((staging?.progress?.validatedModelIds || []).map((x) => String(x)));
        const validatedModelsCount = models.filter((m) =>
            rowValidated(String(m?.id || ''), validatedModelIds)
        ).length;

        const allOptions = Array.isArray(staging?.importOptions) && staging.importOptions.length
            ? staging.importOptions
            : (Array.isArray(staging?.categories) ? staging.categories : [])
                .flatMap((cat) => (Array.isArray(cat?.options) ? cat.options : []));
        const configuredOptionsCount = allOptions.filter((opt) => {
            const family = String(opt?.familyLabel || '').trim();
            const subFamily = String(opt?.subFamily || '').trim();
            return !!family || !!subFamily;
        }).length;

        const baseConfiguredModelIds = new Set();
        allOptions.forEach((opt) => {
            if (!opt?.baseIncluded) return;
            (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : []).forEach((mid) => {
                baseConfiguredModelIds.add(String(mid));
            });
        });
        let baseModelsConfiguredCount = 0;
        if (validatedModelIds.size > 0) {
            validatedModelIds.forEach((mid) => {
                if (baseConfiguredModelIds.has(mid)) baseModelsConfiguredCount += 1;
            });
        } else {
            baseModelsConfiguredCount = baseConfiguredModelIds.size;
        }
        progressEl.textContent = `${validatedModelsCount}/${models.length} modeles valides - ${baseModelsConfiguredCount} modeles de base configures - ${configuredOptionsCount}/${allOptions.length} options configurees`;

        const workspaceMode = window.workspaceMode || 'backoffice';
        if (workspaceMode === 'import') {
            resumeBtn.style.display = 'none';
        } else {
            resumeBtn.style.display = 'inline-flex';
            resumeBtn.textContent = status === 'published' ? 'Reprendre l\'importation' : 'Reprendre l\'import';
            resumeBtn.disabled = false;
            resumeBtn.style.opacity = '';
            resumeBtn.style.cursor = '';
        }
    }

    function switchImportWorkflowStep(step) {
        const legacyStepRedirect = {
            'families-template': 'families-tri',
            'families-base': 'families-tri',
            families: 'families-tri'
        };
        let stepRaw = String(step || '');
        if (legacyStepRedirect[stepRaw]) stepRaw = legacyStepRedirect[stepRaw];
        const allowed = new Set([
            'models', 'minorations', 'majorations', 'import-base-options',
            'families-unmatched', 'validate', 'families-tri'
        ]);
        const next = allowed.has(stepRaw) ? stepRaw : 'models';
        if (next === 'import-base-options' && typeof window.canOpenImportBaseOptionsStep === 'function') {
            const staging = window.currentImportStaging;
            if (staging && !window.canOpenImportBaseOptionsStep(staging)) {
                const resume = typeof window.resolveImportWorkflowResumeStep === 'function'
                    ? window.resolveImportWorkflowResumeStep(staging)
                    : 'minorations';
                wf().step = allowed.has(resume) ? resume : 'minorations';
                if (typeof window.showAlert === 'function') {
                    window.showAlert(
                        'Enregistrez d\'abord les minorations et majorations (étapes 2 et 3) avant les options de base.',
                        'warning'
                    );
                }
                if (typeof window.renderImportWorkflow === 'function') window.renderImportWorkflow();
                return;
            }
        }
        wf().step = next;
        if (typeof window.publishImportWorkflowGlobals === 'function') {
            window.publishImportWorkflowGlobals();
        }
        document.querySelectorAll('[data-import-step]').forEach((btn) => {
            const s = btn.getAttribute('data-import-step');
            btn.classList.toggle('btn-primary', s === next);
            btn.classList.toggle('btn-outline', s !== next);
        });
        const modelsContent = document.getElementById('import-workflow-content-models');
        const familiesContent = document.getElementById('import-workflow-content-families');
        const familySteps = new Set([
            'minorations', 'majorations', 'import-base-options',
            'families-tri', 'families-unmatched', 'validate'
        ]);
        if (modelsContent) modelsContent.style.display = next === 'models' ? 'block' : 'none';
        if (familiesContent) familiesContent.style.display = familySteps.has(next) ? 'block' : 'none';
        if (typeof window.syncImportActionsDock === 'function') window.syncImportActionsDock();
        if (typeof window.scheduleParentEmbedResize === 'function') {
            window.scheduleParentEmbedResize();
            setTimeout(window.scheduleParentEmbedResize, 120);
            setTimeout(window.scheduleParentEmbedResize, 400);
        }
    }

    function renderImportWorkflow() {
        const modelsRoot = document.getElementById('import-workflow-content-models');
        const familiesRoot = document.getElementById('import-workflow-content-families');
        if (!modelsRoot || !familiesRoot) return;

        let stepRaw = String(wf().step || 'models');
        if (stepRaw === 'families') stepRaw = 'families-tri';
        if (stepRaw !== wf().step) wf().step = stepRaw;
        const step = stepRaw;

        const staging = window.currentImportStaging;
        if (!staging) {
            modelsRoot.innerHTML = '<div style="color:#6b7280;">Aucun workflow import actif.</div>';
            familiesRoot.innerHTML = '<div style="color:#6b7280;">Aucun import actif.</div>';
            switchImportWorkflowStep('models');
            if (typeof window.syncImportActionsDock === 'function') window.syncImportActionsDock();
            return;
        }

        const models = Array.isArray(staging.models) ? staging.models : [];
        const modelIdsPresent = new Set(models.map((m) => String(m?.id || '').trim()).filter(Boolean));
        wf().selectedModelIds = (wf().selectedModelIds || [])
            .map((id) => String(id || '').trim())
            .filter((id) => id && modelIdsPresent.has(id));
        wf().selectedBaseModelIds = (wf().selectedBaseModelIds || [])
            .map((id) => String(id || '').trim())
            .filter((id) => id && modelIdsPresent.has(id));

        modelsRoot.innerHTML = typeof window.renderImportModelsStepHtml === 'function'
            ? window.renderImportModelsStepHtml()
            : '<div style="color:#b45309;">Étape modèles indisponible.</div>';

        if (step === 'import-base-options') {
            familiesRoot.innerHTML = typeof window.renderImportBaseOptionsStepHtml === 'function'
                ? window.renderImportBaseOptionsStepHtml()
                : '<div style="color:#b45309;">Chargement options de base indisponible.</div>';
            if (typeof window.onImportBaseOptionsStepRendered === 'function') window.onImportBaseOptionsStepRendered();
        } else if (step === 'minorations') {
            familiesRoot.innerHTML = typeof window.renderImportMinorationsStepHtml === 'function'
                ? window.renderImportMinorationsStepHtml()
                : '<div style="color:#b45309;">Chargement minorations indisponible.</div>';
            if (typeof window.onImportMinorationsStepRendered === 'function') window.onImportMinorationsStepRendered();
        } else if (step === 'majorations') {
            familiesRoot.innerHTML = typeof window.renderImportMajorationsStepHtml === 'function'
                ? window.renderImportMajorationsStepHtml()
                : '<div style="color:#b45309;">Chargement majorations indisponible.</div>';
            if (typeof window.onImportMajorationsStepRendered === 'function') window.onImportMajorationsStepRendered();
        } else if (step === 'families-tri') {
            familiesRoot.innerHTML = typeof window.renderImportOptionsSortStepHtml === 'function'
                ? window.renderImportOptionsSortStepHtml()
                : '<div style="color:#b45309;">Étape options indisponible.</div>';
            if (typeof window.onImportOptionsStepRendered === 'function') window.onImportOptionsStepRendered();
        } else if (step === 'families-unmatched') {
            familiesRoot.innerHTML = typeof window.renderImportPrStepHtml === 'function'
                ? window.renderImportPrStepHtml()
                : '<div style="color:#b45309;">Étape PR indisponible.</div>';
        } else if (step === 'validate') {
            familiesRoot.innerHTML = typeof window.renderImportValidateStepHtml === 'function'
                ? window.renderImportValidateStepHtml()
                : '<div style="color:#b45309;">Étape validation indisponible.</div>';
        } else {
            familiesRoot.innerHTML = '<div style="color:#6b7280;">Étape non disponible.</div>';
        }

        if (typeof window.publishImportWorkflowGlobals === 'function') window.publishImportWorkflowGlobals();
        switchImportWorkflowStep(wf().step || 'models');
        if (typeof window.syncImportActionsDock === 'function') window.syncImportActionsDock();
        if (typeof window.scheduleParentEmbedResize === 'function') {
            window.scheduleParentEmbedResize();
            setTimeout(window.scheduleParentEmbedResize, 120);
        }
    }

    async function refreshImportStagingIndicator() {
        try {
            const importId = String(window.currentImportId || '').trim();
            const query = importId ? `?importId=${encodeURIComponent(importId)}` : '';
            const result = await window.apiCall(`/imports/staging${query}`);
            if (result?.data) {
                window.currentImportStaging = result.data;
                window.currentImportId = String(result.data?._id || importId || '');
            } else if (!importId) {
                window.currentImportStaging = null;
            }
            if (typeof window.publishImportWorkflowGlobals === 'function') window.publishImportWorkflowGlobals();
            if (typeof window.syncImportGlobalsFromWindow === 'function') window.syncImportGlobalsFromWindow();
            renderImportStagingIndicator(window.currentImportStaging);
            renderImportWorkflow();
            if (typeof window.updateStats === 'function') window.updateStats();
        } catch (_error) {
            if (typeof window.syncImportGlobalsFromWindow === 'function') window.syncImportGlobalsFromWindow();
            renderImportStagingIndicator(window.currentImportStaging);
            renderImportWorkflow();
            if (typeof window.updateStats === 'function') window.updateStats();
        }
    }

    function bindImportWorkflowStepButtons() {
        if (window.__ugapImportWorkflowStepsBound) return;
        window.__ugapImportWorkflowStepsBound = true;
        const go = (step) => {
            switchImportWorkflowStep(step);
            renderImportWorkflow();
        };
        document.getElementById('btn-import-step-models')?.addEventListener('click', () => go('models'));
        document.getElementById('btn-import-step-import-base-options')?.addEventListener('click', () => go('import-base-options'));
        document.getElementById('btn-import-step-minorations')?.addEventListener('click', () => go('minorations'));
        document.getElementById('btn-import-step-majorations')?.addEventListener('click', () => go('majorations'));
        document.getElementById('btn-import-step-families-tri')?.addEventListener('click', () => go('families-tri'));
        document.getElementById('btn-import-step-families-unmatched')?.addEventListener('click', () => go('families-unmatched'));
        document.getElementById('btn-import-step-validate')?.addEventListener('click', () => go('validate'));
    }

    function initImportWorkflowShell() {
        bindImportWorkflowStepButtons();
    }

    window.ensureImportTabVisible = ensureImportTabVisible;
    window.renderImportStagingIndicator = renderImportStagingIndicator;
    window.switchImportWorkflowStep = switchImportWorkflowStep;
    window.renderImportWorkflow = renderImportWorkflow;
    window.refreshImportStagingIndicator = refreshImportStagingIndicator;
    window.initImportWorkflowShell = initImportWorkflowShell;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initImportWorkflowShell);
    } else {
        initImportWorkflowShell();
    }
})();
