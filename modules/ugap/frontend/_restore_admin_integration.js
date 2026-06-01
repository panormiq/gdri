const fs = require('fs');
const path = require('path').join(__dirname, 'admin.php');
let s = fs.readFileSync(path, 'utf8');

// 1) Remove legacy-import-card block
s = s.replace(
    /\s*<div class="card" id="legacy-import-card">[\s\S]*?<\/motion>\s*\n\s*<div class="card" id="legacy-stats-card">/,
    '\n        <div class="card" id="legacy-stats-card">'
);
s = s.replace(
    /\s*<div class="card" id="legacy-import-card">[\s\S]*?<\/div>\s*\n\s*<div class="card" id="legacy-stats-card">/,
    '\n        <div class="card" id="legacy-stats-card">'
);

// 2) Replace backoffice includes + remove import-workflow-panel
const backofficeOld = `        <div class="card" id="legacy-backoffice-card">
            <?php require __DIR__ . '/partials/tabs/tab-navigation.php'; ?>

            <?php require __DIR__ . '/partials/tabs/tab-famille.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-models.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-categories.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-options.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-structured.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-couplings.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-prompts.php'; ?>
        </div>

        <div class="card" id="import-workflow-panel" style="display:none;">
            <div style="display:flex; gap:8px; padding:10px; border-bottom:1px solid #eef2f7; background:#f9fafb;">
                <button type="button" id="btn-import-step-models" class="btn btn-outline">1. Modèles</button>
                <button type="button" id="btn-import-step-families-tri" class="btn btn-outline">2. Options</button>
                <button type="button" id="btn-import-step-families-template" class="btn btn-outline">3. Assigner template</button>
                <button type="button" id="btn-import-step-families-base" class="btn btn-outline">4. Modèle de base</button>
                <button type="button" id="btn-import-step-families-unmatched" class="btn btn-outline">5. PR</button>
                <button type="button" id="btn-import-step-validate" class="btn btn-outline">6. Valider</button>
            </div>
            <div id="import-workflow-content-models" style="padding:12px;"></div>
            <div id="import-workflow-content-families" style="padding:12px; display:none;"></div>
        </div>`;

const backofficeNew = `        <div class="card" id="legacy-backoffice-card">
            <?php require __DIR__ . '/partials/tabs/tab-navigation.php'; ?>

            <?php require __DIR__ . '/partials/tabs/tab-import.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-famille.php'; ?>
            <?php if (is_file(__DIR__ . '/partials/tabs/tab-template-bateau.php')) {
                require __DIR__ . '/partials/tabs/tab-template-bateau.php';
            } ?>
            <?php require __DIR__ . '/partials/tabs/tab-models.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-categories.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-options.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-structured.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-couplings.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-prompts.php'; ?>
        </div>`;

if (s.includes(backofficeOld)) {
  s = s.replace(backofficeOld, backofficeNew);
} else {
  console.warn('backoffice block pattern not found');
}

// fix accidental motion tags
s = s.replace(/<motion /g, '<div ').replace(/<\/motion>/g, '</div>');

// 3) importWorkflowState fields
if (!s.includes('optionTypeFilter')) {
  s = s.replace(
    "modelStatusFilter: 'to_validate',\n            familyDetectionMinCount: 3",
    "modelStatusFilter: 'to_validate',\n            posteFilter: '',\n            optionTypeFilter: '',\n            familyDetectionMinCount: 3,\n            minoAutoSeeded: false,\n            majorationAutoSeeded: false"
  );
}
if (!s.includes('importViewMode')) {
  s = s.replace(
    'let workspaceMode = \'backoffice\';',
    "let importViewMode = 'list';\n        let importListCache = [];\n        let workspaceMode = 'backoffice';"
  );
}

// 4) applyEmbeddedLayout
const embedOld = `        function applyEmbeddedLayout() {
            if (!isEmbeddedMode()) return;

            const header = document.getElementById('header');
            if (header) header.style.display = 'none';

            const spacer = header?.nextElementSibling;
            if (spacer) spacer.style.display = 'none';

            const container = document.querySelector('.container-xl');
            if (container) container.style.paddingTop = '10px';
        }`;

const embedNew = `        function applyEmbeddedLayout() {
            if (!isEmbeddedMode()) return;

            const header = document.getElementById('header');
            if (header) header.style.display = 'none';

            const spacer = header?.nextElementSibling;
            if (spacer) spacer.style.display = 'none';

            const container = document.querySelector('.container-xl');
            if (container) container.style.paddingTop = '10px';

            const heroCard = document.getElementById('legacy-admin-hero-card');
            if (heroCard) heroCard.style.display = 'none';

            const statsCard = document.getElementById('legacy-stats-card');
            if (statsCard) statsCard.style.display = 'none';

            document.documentElement.style.overflowY = 'visible';
            document.body.style.overflowY = 'visible';
            document.body.style.height = 'auto';
            document.body.style.minHeight = '0';

            scheduleParentEmbedResize();
            if (!window.__ugapEmbedResizeObserver && typeof ResizeObserver !== 'undefined') {
                window.__ugapEmbedResizeObserver = new ResizeObserver(() => scheduleParentEmbedResize());
                const observeTargets = [
                    document.getElementById('tab-import'),
                    document.querySelector('.container-xl'),
                    document.getElementById('legacy-backoffice-card'),
                    document.getElementById('import-workflow-section'),
                    document.getElementById('import-workflow-content-models'),
                    document.getElementById('import-workflow-content-families')
                ].filter(Boolean);
                observeTargets.forEach((el) => window.__ugapEmbedResizeObserver.observe(el));
            }
        }

        function measureEmbeddedContentHeight() {
            const docH = Math.max(
                document.documentElement?.scrollHeight || 0,
                document.documentElement?.offsetHeight || 0,
                document.body?.scrollHeight || 0,
                document.body?.offsetHeight || 0
            );
            const importPanel = document.getElementById('tab-import');
            const panelH = importPanel ? Math.max(importPanel.scrollHeight, importPanel.offsetHeight, 0) : 0;
            const card = document.getElementById('legacy-backoffice-card');
            const cardH = card ? Math.max(card.scrollHeight, card.offsetHeight, 0) : 0;
            return Math.max(docH, panelH, cardH, 200);
        }

        let __ugapEmbedResizeTimer = null;
        function scheduleParentEmbedResize() {
            if (!isEmbeddedMode()) return;
            if (__ugapEmbedResizeTimer) clearTimeout(__ugapEmbedResizeTimer);
            __ugapEmbedResizeTimer = setTimeout(() => {
                __ugapEmbedResizeTimer = null;
                notifyParentEmbedResize();
            }, 50);
        }

        function notifyParentEmbedResize() {
            if (!isEmbeddedMode() || !window.parent || window.parent === window) return;
            try {
                window.parent.postMessage({ type: 'ugap-embed-resize', height: measureEmbeddedContentHeight() }, window.location.origin);
            } catch (_e) { /* ignore */ }
        }

        function publishImportWorkflowGlobals() {
            window.currentImportStaging = currentImportStaging;
            window.currentImportId = currentImportId;
            window.importWorkflowState = importWorkflowState;
            window.importViewMode = importViewMode;
        }

        function hideImportMinorationRecapDockInParent() {
            if (!isEmbeddedMode() || !window.parent || window.parent === window) return;
            try {
                window.parent.postMessage({ type: 'ugap-import-mino-recap', visible: false }, window.location.origin);
            } catch (_e) { /* ignore */ }
        }`;

if (s.includes(embedOld) && !s.includes('scheduleParentEmbedResize')) {
  s = s.replace(embedOld, embedNew);
}

// 5) switchImportWorkflowStep - update allowed set
s = s.replace(
    "const allowed = new Set(['models', 'families-template', 'families-base', 'families-unmatched', 'validate', 'families-tri']);",
    "const legacyStepRedirect = { 'families-template': 'families-tri', 'families-base': 'families-tri', 'families': 'families-tri' };\n            let stepRaw = String(step || '');\n            if (legacyStepRedirect[stepRaw]) stepRaw = legacyStepRedirect[stepRaw];\n            const allowed = new Set(['models', 'import-base-options', 'minorations', 'majorations', 'families-unmatched', 'validate', 'families-tri']);"
);

// Fix duplicate step param in switchImportWorkflowStep - the replace might break signature. Read and fix manually if needed.

// 6) renderImportWorkflow - add minorations branches before familiesRoot.innerHTML
if (!s.includes('renderImportBaseOptionsStepHtml')) {
  s = s.replace(
    `            const suggestions = detectImportFamilySuggestions();
            const newSuggestions = suggestions.filter((s) => !s.alreadyExists);
            const existingSuggestions = suggestions.filter((s) => s.alreadyExists);
            familiesRoot.innerHTML = \`
                \${renderImportFamiliesSortStepHtml()}
            \`;
            if (step === 'families-template') {
                renderTemplateBateauSharedForImport();
            }
            if (step === 'families-base') {
                renderImportBaseModelStep();
            }

            switchImportWorkflowStep(importWorkflowState.step || 'models');`,
    `            publishImportWorkflowGlobals();
            if (step === 'import-base-options') {
                familiesRoot.innerHTML = typeof renderImportBaseOptionsStepHtml === 'function'
                    ? renderImportBaseOptionsStepHtml()
                    : '<div style="color:#b45309;">Chargement options de base indisponible.</div>';
                if (typeof onImportBaseOptionsStepRendered === 'function') onImportBaseOptionsStepRendered();
            } else if (step === 'minorations') {
                familiesRoot.innerHTML = typeof renderImportMinorationsStepHtml === 'function'
                    ? renderImportMinorationsStepHtml()
                    : '<div style="color:#b45309;">Chargement minorations indisponible.</div>';
                if (typeof onImportMinorationsStepRendered === 'function') onImportMinorationsStepRendered();
            } else if (step === 'majorations') {
                familiesRoot.innerHTML = typeof renderImportMajorationsStepHtml === 'function'
                    ? renderImportMajorationsStepHtml()
                    : '<div style="color:#b45309;">Chargement majorations indisponible.</div>';
                if (typeof onImportMajorationsStepRendered === 'function') onImportMajorationsStepRendered();
            } else {
                familiesRoot.innerHTML = renderImportFamiliesSortStepHtml();
            }

            switchImportWorkflowStep(importWorkflowState.step || 'models');
            scheduleParentEmbedResize();
            setTimeout(scheduleParentEmbedResize, 120);`
  );
}

s = s.split('<motion ').join('<div ').split('</motion>').join('</div>');

// 7) setWorkspaceMode - don't hide backoffice in embedded
s = s.replace(
    `if (backofficeCard) backofficeCard.style.display = workspaceMode === 'import' ? 'none' : 'block';
            if (importWorkflowPanel) importWorkflowPanel.style.display = workspaceMode === 'import' ? 'block' : 'none';`,
    `if (backofficeCard && !isEmbeddedMode()) backofficeCard.style.display = workspaceMode === 'import' ? 'none' : 'block';
            const importPanel = document.getElementById('import-workflow-panel');
            if (importPanel) importPanel.style.display = 'none';`
);

// 8) renderActiveTab add import case
if (!s.includes("case 'import':")) {
  s = s.replace(
    "function renderActiveTab(tabName) {\n            switch(tabName) {\n                case 'models':",
    "function renderActiveTab(tabName) {\n            switch(tabName) {\n                case 'import':\n                    publishImportWorkflowGlobals();\n                    if (importViewMode === 'editor') {\n                        if (currentImportStaging && typeof applyImportStagingToCurrentData === 'function') applyImportStagingToCurrentData();\n                        if (typeof renderImportWorkflow === 'function') renderImportWorkflow();\n                    } else if (typeof loadImportList === 'function') {\n                        loadImportList();\n                    }\n                    break;\n                case 'models':"
  );
}

// 9) importExcel open editor after import
s = s.replace(
    `await refreshImportStagingIndicator();
                await loadData();`,
    `await refreshImportStagingIndicator();
                await loadData();
                if (currentImportId && typeof openImportEditor === 'function') {
                    await openImportEditor(currentImportId, { resume: false });
                }`
);

// 10) DOMContentLoaded
s = s.replace(
    `document.addEventListener('DOMContentLoaded', () => {
            applyEmbeddedLayout();
            currentImportId = '';
            setWorkspaceMode('backoffice');
            refreshImportStagingIndicator();
            loadData();
        });`,
    `document.addEventListener('DOMContentLoaded', () => {
            applyEmbeddedLayout();
            currentImportId = '';
            importViewMode = 'list';
            publishImportWorkflowGlobals();
            if (isEmbeddedMode()) {
                const statsCard = document.getElementById('legacy-stats-card');
                if (statsCard) statsCard.style.display = 'none';
            } else {
                setWorkspaceMode('backoffice');
            }
            if (typeof initUgapImportTab === 'function') initUgapImportTab();
            else if (typeof loadImportList === 'function') loadImportList();
            loadData();
        });`
);

// 11) scripts
if (!s.includes('ugap-import-minorations-workflow.js')) {
  s = s.replace(
    '<script src="/modules/ugap/frontend/assets/js/tabs/famille-tab.js?v=1"></script>',
    '<script src="/modules/ugap/frontend/assets/js/ugap-import-minorations-workflow.js?v=1"></script>\n    <script src="/modules/ugap/frontend/assets/js/ugap-import-tab.js?v=1"></script>\n    <script src="/modules/ugap/frontend/assets/js/tabs/famille-tab.js?v=1"></script>'
  );
}

// 12) Event listeners - remove obsolete workflow panel buttons, add new steps
const oldListeners = `        document.getElementById('btn-import-step-families-template')?.addEventListener('click', () => {
            switchImportWorkflowStep('families-template');
            renderImportWorkflow();
        });
        document.getElementById('btn-import-step-families-tri')?.addEventListener('click', () => {
            switchImportWorkflowStep('families-tri');
            renderImportWorkflow();
        });
        document.getElementById('btn-import-step-families-base')?.addEventListener('click', () => {
            switchImportWorkflowStep('families-base');
            renderImportWorkflow();
        });`;

const newListeners = `        document.getElementById('btn-import-step-import-base-options')?.addEventListener('click', () => {
            switchImportWorkflowStep('import-base-options');
            renderImportWorkflow();
        });
        document.getElementById('btn-import-step-minorations')?.addEventListener('click', () => {
            switchImportWorkflowStep('minorations');
            renderImportWorkflow();
        });
        document.getElementById('btn-import-step-majorations')?.addEventListener('click', () => {
            switchImportWorkflowStep('majorations');
            renderImportWorkflow();
        });
        document.getElementById('btn-import-step-families-tri')?.addEventListener('click', () => {
            switchImportWorkflowStep('families-tri');
            renderImportWorkflow();
        });`;

if (s.includes(oldListeners)) s = s.replace(oldListeners, newListeners);

// 13) tab click schedule resize
if (!s.includes('scheduleParentEmbedResize') || !s.includes("syncFamilleColumnsDock();\n                scheduleParentEmbedResize")) {
  s = s.replace(
    'syncFamilleColumnsDock();\n\n                trackAdminEvent',
    'syncFamilleColumnsDock();\n                if (typeof scheduleParentEmbedResize === \'function\') scheduleParentEmbedResize();\n\n                trackAdminEvent'
  );
}

fs.writeFileSync(path, s, 'utf8');
console.log('restore done', s.length);
