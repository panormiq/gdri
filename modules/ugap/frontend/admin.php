<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>UGAP Admin - Gestion des données</title>
    <link rel="stylesheet" href="/frontend/assets/css/variables.css">
    <link rel="stylesheet" href="/frontend/assets/css/main.css">
    <style>
        body { background-color: #f5f7fa; }
        .container-xl { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); padding: 20px; margin-bottom: 20px; }
        .btn { padding: 10px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s; }
        .btn-primary { background: var(--primary-color, #007bff); color: white; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-outline { background: transparent; border: 1px solid #ddd; }
        .btn-success { background: #28a745; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .alert { padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; }
        .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .alert-info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #eee; padding: 8px 10px; font-size: 14px; text-align: left; }
        th { background: #f7f7f7; font-weight: 600; }
        .badge { display: inline-block; padding: 4px 8px; background: #eef; color: #334; border-radius: 4px; font-size: 12px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; }
        .stat-card h3 { margin: 0 0 5px 0; font-size: 24px; color: var(--primary-color, #007bff); }
        .stat-card p { margin: 0; color: #666; font-size: 14px; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #eee; }
        .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
        .tab.active { border-bottom-color: var(--primary-color, #007bff); color: var(--primary-color, #007bff); font-weight: 600; }
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }
        .subtabs { display: flex; gap: 8px; margin: 0 0 14px 0; border-bottom: 1px solid #eee; padding-bottom: 8px; flex-wrap: wrap; }
        .subtab-btn { padding: 8px 14px; border: 1px solid #ddd; background: #fff; border-radius: 6px; cursor: pointer; font-weight: 600; }
        .subtab-btn.active { border-color: var(--primary-color, #007bff); color: #fff; background: var(--primary-color, #007bff); }
        .subtab-panel { display: none; }
        .subtab-panel.active { display: block; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; }
        .modal.active { display: flex; align-items: center; justify-content: center; }
        .modal-content { background: white; border-radius: 8px; padding: 30px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .modal-header h2 { margin: 0; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 600; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .image-upload-area { border: 2px dashed #ddd; border-radius: 8px; padding: 40px; text-align: center; cursor: pointer; margin-top: 10px; }
        .image-upload-area:hover { border-color: var(--primary-color, #007bff); }
        .image-preview { max-width: 100%; max-height: 200px; border-radius: 6px; margin-top: 10px; }
        .config-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 10px; }
        .config-item:hover { background: #f9f9f9; }
        .color-picker { width: 100px; height: 40px; border: 2px solid #ddd; border-radius: 4px; cursor: pointer; }
        .color-preview { width: 40px; height: 40px; border: 2px solid #ddd; border-radius: 4px; display: inline-block; vertical-align: middle; margin-left: 10px; }
        .accordion { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; margin-bottom: 10px; }
        .accordion-header { background: #f8f9fa; padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; transition: background 0.2s; }
        .accordion-header:hover { background: #e9ecef; }
        .accordion-header.active { background: #007bff; color: white; }
        .accordion-content { display: none; padding: 0; }
        .accordion-content.active { display: block; }
        .accordion-icon { transition: transform 0.3s; }
        .accordion-icon.rotated { transform: rotate(180deg); }
        .steps-container { display: flex; gap: 10px; margin: 15px 0; flex-wrap: wrap; }
        .step { flex: 1; min-width: 150px; padding: 12px; border-radius: 6px; text-align: center; cursor: pointer; transition: all 0.3s; border: 2px solid #ddd; }
        .step.disabled { background: #e9ecef; color: #6c757d; cursor: not-allowed; border-color: #dee2e6; }
        .step.completed { background: #28a745; color: white; border-color: #28a745; cursor: pointer; }
        .step.active { background: #007bff; color: white; border-color: #007bff; cursor: pointer; }
        .step:hover:not(.disabled) { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .step.completed:hover { background: #218838; box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3); }
        .step-number { font-weight: bold; font-size: 18px; margin-bottom: 5px; }
        .step-label { font-size: 13px; }
    </style>
</head>
<body>
    <header class="header" id="header">
        <div class="container">
            <div class="header-content">
                <div class="logo">
                    <a href="/frontend/pages/dashboard.php">
                        <img src="/frontend/assets/images/logo-gdri.png" alt="GDR-Innovation Logo">
                        <span class="logo-text">GDR-Innovation</span>
                    </a>
                </div>
                <nav class="nav" id="nav">
                    <ul class="nav-list">
                        <li><a href="/frontend/pages/dashboard.php" class="nav-link">Dashboard</a></li>
                        <li><a href="/frontend/pages/modules.php" class="nav-link">Modules</a></li>
                        <li><a href="/frontend/auth/logout.php" class="nav-link">Déconnexion</a></li>
                    </ul>
                </nav>
            </div>
        </div>
    </header>
    <div style="height: var(--header-height);"></div>

    <div class="container-xl">
        <div class="card" id="legacy-admin-hero-card" style="display:flex;justify-content:space-between;align-items:center;">
            <div>
                <h1>UGAP Admin</h1>
                <p style="color: #666; margin: 0;">Gestion des modèles, configurations et options</p>
            </div>
            <div>
                <a href="/modules/ugap/frontend/index.html" class="btn btn-outline">Voir Configurateur</a>
                <button id="btn-import-mode" class="btn btn-outline">Mode import</button>
                <button id="btn-refresh" class="btn btn-primary">Rafraîchir</button>
            </div>
        </div>

        <div id="alert-container"></div>
        <div class="card" id="legacy-stats-card">
            <div class="stats" id="stats-container">
                <div class="stat-card">
                    <h3 id="stat-models">0</h3>
                    <p>Modèles</p>
                </div>
                <div class="stat-card">
                    <h3 id="stat-categories">0</h3>
                    <p>Vue métier</p>
                </div>
                <div class="stat-card">
                    <h3 id="stat-options">0</h3>
                    <p>Options</p>
                </div>
            </div>
        </div>

        <div class="card" id="legacy-backoffice-card">
            <?php require __DIR__ . '/partials/tabs/tab-navigation.php'; ?>

            <?php require __DIR__ . '/partials/tabs/tab-import.php'; ?>
            <?php if (is_file(__DIR__ . '/partials/tabs/tab-template-bateau.php')) {
                require __DIR__ . '/partials/tabs/tab-template-bateau.php';
            } ?>
            <?php require __DIR__ . '/partials/tabs/tab-famille.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-models.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-categories.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-options.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-structured.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-couplings.php'; ?>
            <?php require __DIR__ . '/partials/tabs/tab-prompts.php'; ?>
        </div>


    </div>

    <script>
        const API_BASE = '/api/ugap';
        const UGAP_PROMPTS_UI_VERSION = '2026-03-31-llm-selects-v3';
        let currentData = null;
        let currentImportStaging = null;
        let currentImportId = '';
        let importWorkflowState = {
            step: 'models',
            selectedModelIds: [],
            selectedBaseModelIds: [],
            modelStatusFilter: 'to_validate',
            posteFilter: '',
            optionTypeFilter: '',
            familyDetectionMinCount: 3,
            minoAutoSeeded: false,
            majorationAutoSeeded: false
        };
        let importViewMode = 'list';
        let importListCache = [];
        let workspaceMode = 'backoffice';
        let __loadDataPromise = null;
        let __lastLoadDataAt = 0;
        let __loadDataCooldownUntil = 0;
        let __lastLoadDataSnapshot = null;
        let __ugapUiStatePersistTimer = null;
        let __ugapUiStatePersistInFlight = false;
        let __ugapUiStatePersistPending = false;
        let __ugapUiStatePersistDisabled = false;
        const __ugapMemoryStore = {};

        function memoryStoreGetItem(key) {
            const k = String(key || '');
            return Object.prototype.hasOwnProperty.call(__ugapMemoryStore, k) ? __ugapMemoryStore[k] : null;
        }

        function memoryStoreSetItem(key, value) {
            __ugapMemoryStore[String(key || '')] = String(value ?? '');
        }

        function isEmbeddedMode() {
            try {
                const params = new URLSearchParams(window.location.search || '');
                return params.get('embedded') === '1';
            } catch (error) {
                return false;
            }
        }

        function applyEmbeddedLayout() {
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
            document.documentElement.style.overflowX = 'hidden';
            document.body.style.overflowY = 'visible';
            document.body.style.overflowX = 'hidden';
            document.body.style.height = 'auto';
            document.body.style.minHeight = '0';
            document.body.style.maxWidth = '100%';

            scheduleParentEmbedResize();
            if (!window.__ugapEmbedResizeObserver && typeof ResizeObserver !== 'undefined') {
                window.__ugapEmbedResizeObserver = new ResizeObserver(() => scheduleParentEmbedResize());
                const observeTargets = [
                    document.getElementById('tab-import'),
                    document.querySelector('.container-xl'),
                    document.getElementById('legacy-backoffice-card'),
                    document.getElementById('import-workflow-section'),
                    document.getElementById('import-workflow-content-models'),
                    document.getElementById('import-workflow-content-families'),
                    document.getElementById('import-editor-section')
                ].filter(Boolean);
                observeTargets.forEach((el) => window.__ugapEmbedResizeObserver.observe(el));
            }
        }

        function measureEmbeddedContentHeight() {
            const scrollY = window.scrollY || window.pageYOffset || 0;
            const bottoms = [];
            const addBottom = (el) => {
                if (!el || typeof el.getBoundingClientRect !== 'function') return;
                const st = window.getComputedStyle(el);
                if (st.display === 'none' || st.visibility === 'hidden') return;
                const r = el.getBoundingClientRect();
                if (r.height <= 0 && r.width <= 0) return;
                bottoms.push(r.bottom + scrollY);
            };
            [document.documentElement, document.body].forEach(addBottom);
            [
                document.getElementById('tab-import'),
                document.getElementById('import-editor-section'),
                document.getElementById('import-workflow-section'),
                document.getElementById('import-workflow-content-families'),
                document.querySelector('.ugap-import-mino-wrap'),
                document.querySelector('.ugap-import-opt-tri-table-wrap'),
                document.querySelector('.ugap-import-opt-tri-table tbody tr:last-child'),
                document.getElementById('legacy-backoffice-card'),
                document.querySelector('.container-xl')
            ].forEach(addBottom);
            const docH = Math.max(
                document.documentElement?.scrollHeight || 0,
                document.documentElement?.offsetHeight || 0,
                document.body?.scrollHeight || 0,
                document.body?.offsetHeight || 0,
                ...bottoms,
                0
            );
            return Math.max(docH, 200) + 32;
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

        function syncImportGlobalsFromWindow() {
            if (window.currentImportStaging !== undefined && window.currentImportStaging !== null) {
                currentImportStaging = window.currentImportStaging;
            }
            if (window.currentImportId !== undefined && window.currentImportId !== null) {
                currentImportId = String(window.currentImportId || '');
            }
            if (window.importWorkflowState && typeof window.importWorkflowState === 'object') {
                importWorkflowState = window.importWorkflowState;
            }
            if (window.importViewMode === 'editor' || window.importViewMode === 'list') {
                importViewMode = window.importViewMode;
            }
        }

        function publishImportWorkflowGlobals() {
            syncImportGlobalsFromWindow();
            window.currentImportStaging = currentImportStaging;
            window.currentImportId = currentImportId;
            window.importWorkflowState = importWorkflowState;
            window.importViewMode = importViewMode;
        }
        window.syncImportGlobalsFromWindow = syncImportGlobalsFromWindow;
        window.publishImportWorkflowGlobals = publishImportWorkflowGlobals;

        function applyImportStagingToCurrentData() {
            if (!currentImportStaging) return;
            currentData = normalizeUgapDataContract({
                models: Array.isArray(currentImportStaging.models) ? currentImportStaging.models : [],
                categories: Array.isArray(currentImportStaging.categories) ? currentImportStaging.categories : [],
                businessViews: Array.isArray(currentImportStaging.businessViews) ? currentImportStaging.businessViews : [],
                dependencyRules: Array.isArray(currentImportStaging.dependencyRules) ? currentImportStaging.dependencyRules : [],
                uiState: currentImportStaging.uiState || {}
            });
        }
        window.applyImportStagingToCurrentData = applyImportStagingToCurrentData;

        function hideImportMinorationRecapDockInParent() {
            if (!isEmbeddedMode() || !window.parent || window.parent === window) return;
            try {
                window.parent.postMessage({ type: 'ugap-import-mino-recap', visible: false }, window.location.origin);
            } catch (_e) { /* ignore */ }
        }
        const EXTRACTION_PROMPT_SECTIONS = {
            context: `Tu extrais les informations de base d'une ligne modèle UGAP.`,
            prompt: `Découpe la ligne de base en 4 champs: modelName, motorizationBase, posteNumber, deliveryMode.
Règles:
- modelName: du début jusqu'à la motorisation.
- motorizationBase: de la motorisation jusqu'à "Poste".
- posteNumber: nombre après "Poste".
- deliveryMode: "Départ usine" si présent.`,
            lines: `LIGNE_EXEMPLE_1
LIGNE_EXEMPLE_2`,
            format: `{
  "modelName": "string",
  "motorizationBase": "string",
  "posteNumber": 1,
  "deliveryMode": "Départ usine"
}`
        };
        const EXTRACTION_PROMPT_MARKERS = {
            context: '### CONTEXTE (MODIFIABLE)',
            prompt: '### PROMPT (MODIFIABLE)',
            lines: '### LIGNES A INTERPRETER (NON MODIFIABLE)',
            format: '### FORMAT ATTENDU (MODIFIABLE)'
        };
        const EXTRACTION_FORMAT_PRESETS = {
            json_object: `{
  "modelName": "string",
  "motorizationBase": "string",
  "posteNumber": 1,
  "deliveryMode": "Départ usine"
}`,
            json_array: `[
  {
    "modelName": "string",
    "motorizationBase": "string",
    "posteNumber": 1,
    "deliveryMode": "Départ usine"
  }
]`,
            compact: `modelName|string; motorizationBase|string; posteNumber|number; deliveryMode|string`
        };
        const ADMIN_TRACKING_ENDPOINT = (() => {
            const path = window.location.pathname || '/';
            const modulesIndex = path.indexOf('/modules/');
            let basePath = '/';
            if (modulesIndex !== -1) {
                basePath = path.slice(0, modulesIndex + 1);
            } else if (path.indexOf('/frontend/') !== -1) {
                basePath = path.slice(0, path.indexOf('/frontend/') + 1);
            }
            return basePath.replace(/\/+$/, '/') + 'frontend/auth/admin-activity.php';
        })();
        const ADMIN_LOGS_ENDPOINT = ADMIN_TRACKING_ENDPOINT.replace(/admin-activity\.php$/, 'admin-activity-logs.php');

        function trackAdminEvent(eventType, data = {}) {
            if (!ADMIN_TRACKING_ENDPOINT) return;
            const payload = {
                eventType,
                page: 'GDRIadmin',
                url: window.location.pathname,
                referrer: document.referrer || null,
                ...data
            };
            fetch(ADMIN_TRACKING_ENDPOINT, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }).catch(() => {
                // Tracking silencieux : ne pas bloquer l'UI
            });
        }

        function buildSubCategoryPrompt({ contextText, promptText, linesText, formatText }) {
            return [
                EXTRACTION_PROMPT_MARKERS.context,
                (contextText || EXTRACTION_PROMPT_SECTIONS.context).trim(),
                EXTRACTION_PROMPT_MARKERS.prompt,
                (promptText || EXTRACTION_PROMPT_SECTIONS.prompt).trim(),
                EXTRACTION_PROMPT_MARKERS.lines,
                (linesText || EXTRACTION_PROMPT_SECTIONS.lines).trim(),
                EXTRACTION_PROMPT_MARKERS.format,
                (formatText || EXTRACTION_PROMPT_SECTIONS.format).trim()
            ].join('\n\n');
        }

        function parseSubCategoryPromptSections(fullPrompt) {
            const safePrompt = String(fullPrompt || '');
            const extractBetween = (fromMarker, toMarker) => {
                const from = safePrompt.indexOf(fromMarker);
                if (from === -1) return '';
                const start = from + fromMarker.length;
                const end = toMarker ? safePrompt.indexOf(toMarker, start) : -1;
                if (end === -1) return safePrompt.slice(start).trim();
                return safePrompt.slice(start, end).trim();
            };
            const contextText = extractBetween(EXTRACTION_PROMPT_MARKERS.context, EXTRACTION_PROMPT_MARKERS.prompt);
            const promptText = extractBetween(EXTRACTION_PROMPT_MARKERS.prompt, EXTRACTION_PROMPT_MARKERS.lines);
            const linesText = extractBetween(EXTRACTION_PROMPT_MARKERS.lines, EXTRACTION_PROMPT_MARKERS.format);
            const formatText = extractBetween(EXTRACTION_PROMPT_MARKERS.format, null);

            return {
                contextText: contextText || EXTRACTION_PROMPT_SECTIONS.context,
                promptText: promptText || EXTRACTION_PROMPT_SECTIONS.prompt,
                linesText: linesText || EXTRACTION_PROMPT_SECTIONS.lines,
                formatText: formatText || EXTRACTION_PROMPT_SECTIONS.format
            };
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        async function loadActivityLogs() {
            const status = document.getElementById('activity-logs-status');
            const tbody = document.querySelector('#activity-logs-table tbody');
            if (!tbody) return;

            if (status) status.textContent = 'Chargement...';
            const params = new URLSearchParams();
            params.set('limit', '50');

            const eventType = document.getElementById('filter-log-event')?.value;
            if (eventType) params.set('event_type', eventType);

            const email = document.getElementById('filter-log-email')?.value?.trim();
            if (email) params.set('user_email', email);

            const fromValue = document.getElementById('filter-log-from')?.value;
            if (fromValue) {
                const fromDate = new Date(fromValue);
                if (!isNaN(fromDate.getTime())) {
                    params.set('from', fromDate.toISOString());
                }
            }

            const toValue = document.getElementById('filter-log-to')?.value;
            if (toValue) {
                const toDate = new Date(toValue);
                if (!isNaN(toDate.getTime())) {
                    params.set('to', toDate.toISOString());
                }
            }

            try {
                const response = await fetch(`${ADMIN_LOGS_ENDPOINT}?${params.toString()}`, {
                    method: 'GET',
                    credentials: 'include'
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Erreur lors du chargement des logs');
                }

                const logs = Array.isArray(data.logs) ? data.logs : [];
                if (!logs.length) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">Aucun résultat</td></tr>';
                } else {
                    tbody.innerHTML = logs.map(log => {
                        const createdAt = log.created_at ? new Date(log.created_at).toLocaleString() : '-';
                        let details = '';
                        if (log.event_type === 'tab_view') {
                            details = log.event_data?.tab ? `Onglet: ${log.event_data.tab}` : '';
                        } else if (log.event_type === 'page_view') {
                            details = log.event_data?.url || log.event_data?.page || '';
                        } else if (log.event_type === 'login') {
                            details = log.event_data?.source ? `Source: ${log.event_data.source}` : '';
                        }
                        return `
                            <tr>
                                <td>${escapeHtml(createdAt)}</td>
                                <td>${escapeHtml(log.user_email || '-')}</td>
                                <td>${escapeHtml(log.user_role || '-')}</td>
                                <td>${escapeHtml(log.event_type || '-')}</td>
                                <td>${escapeHtml(details || '-')}</td>
                                <td>${escapeHtml(log.ip_address || '-')}</td>
                            </tr>
                        `;
                    }).join('');
                }

                if (status) status.textContent = `${logs.length} log(s)`;
            } catch (error) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #b00020;">Erreur de chargement</td></tr>';
                if (status) status.textContent = error.message;
            }
        }

        // Alert helper
        function showAlert(message, type = 'info') {
            const container = document.getElementById('alert-container');
            container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
            setTimeout(() => {
                container.innerHTML = '';
            }, 5000);
        }

        // API helpers
        async function apiCall(endpoint, options = {}) {
            try {
                const { allowBusinessError = false, ...fetchOptions } = options || {};
                const response = await fetch(`${API_BASE}${endpoint}`, {
                    ...fetchOptions,
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        ...fetchOptions.headers
                    }
                });

                // Vérifier le type de contenu
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Réponse non-JSON reçue:', text.substring(0, 200));
                    throw new Error(`L'API a retourné du HTML au lieu de JSON. Status: ${response.status}. Vérifiez que le backend est démarré et que vous êtes authentifié.`);
                }

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || `Erreur HTTP ${response.status}`);
                }

                if (!data.success && !allowBusinessError) {
                    throw new Error(data.message || 'Erreur API');
                }
                return data;
            } catch (error) {
                console.error('API Error:', error);
                if (error.message.includes('JSON')) {
                    throw new Error('Erreur de communication avec le serveur. Vérifiez que le backend est démarré.');
                }
                throw error;
            }
        }

        function normalizeUgapDataContract(raw) {
            const source = raw && typeof raw === 'object' ? raw : {};
            const categories = Array.isArray(source.categories) ? source.categories : [];
            const rawUiState = source.uiState && typeof source.uiState === 'object' ? source.uiState : {};
            const normalizedFamilies = Array.isArray(rawUiState.families)
                ? rawUiState.families
                : (Array.isArray(rawUiState.validatedFamilies) ? rawUiState.validatedFamilies : []);
            const normalizedBusinessViews = Array.isArray(rawUiState.businessViews)
                ? rawUiState.businessViews
                : (Array.isArray(rawUiState.viewHeuristicRules) ? rawUiState.viewHeuristicRules : []);
            const baseModelTemplateFamilies = Array.isArray(rawUiState.baseModelTemplateFamilies)
                ? rawUiState.baseModelTemplateFamilies.map((x) => String(x || '').trim()).filter(Boolean)
                : [];
            const normalizedViewPresets = Array.isArray(rawUiState.viewPresets)
                ? rawUiState.viewPresets
                    .map((preset) => {
                        const p = preset && typeof preset === 'object' ? preset : {};
                        return {
                            id: String(p.id || '').trim(),
                            label: String(p.label || '').trim(),
                            businessViewIds: Array.isArray(p.businessViewIds) ? p.businessViewIds.map((x) => String(x)).filter(Boolean) : []
                        };
                    })
                    .filter((p) => p.id)
                : [];
            const defaultPreset = {
                id: 'basic',
                label: 'Basic',
                businessViewIds: normalizedBusinessViews.map((v) => String(v?.id || '').trim()).filter(Boolean)
            };
            const viewPresets = normalizedViewPresets.length ? normalizedViewPresets : [defaultPreset];
            const activeViewPresetIdRaw = String(rawUiState.activeViewPresetId || '').trim();
            const activeViewPresetId = viewPresets.some((p) => p.id === activeViewPresetIdRaw)
                ? activeViewPresetIdRaw
                : (viewPresets[0]?.id || 'basic');
            return {
                ...source,
                models: Array.isArray(source.models) ? source.models : [],
                businessViews: Array.isArray(source.businessViews) ? source.businessViews : [],
                dependencyRules: Array.isArray(source.dependencyRules) ? source.dependencyRules : [],
                uiState: {
                    families: normalizedFamilies,
                    businessViews: normalizedBusinessViews,
                    baseModelTemplateFamilies,
                    viewPresets,
                    activeViewPresetId,
                    updatedAt: rawUiState.updatedAt || null
                },
                categories: categories.map((category) => {
                    const cat = category && typeof category === 'object' ? category : {};
                    const rules = cat.selectionRules && typeof cat.selectionRules === 'object' ? cat.selectionRules : {};
                    return {
                        ...cat,
                        selectionRules: {
                            unique: !!rules.unique,
                            required: !!rules.required
                        },
                        businessViewIds: Array.isArray(cat.businessViewIds) ? cat.businessViewIds : [],
                        familyIds: Array.isArray(cat.familyIds) ? cat.familyIds : [],
                        subCategories: Array.isArray(cat.subCategories) ? cat.subCategories : []
                    };
                })
            };
        }

        function sanitizeFamiliesForServer(rawFamilies) {
            return (Array.isArray(rawFamilies) ? rawFamilies : []).map((f) => ({ ...f }));
        }

        function sanitizeViewRulesForServer(rawRules) {
            return (Array.isArray(rawRules) ? rawRules : []).map((r) => ({ ...r }));
        }

        function applyServerUiStateToLocal(serverUiState) {
            const src = serverUiState && typeof serverUiState === 'object' ? serverUiState : {};
            try {
                memoryStoreSetItem('ugap.famille.validatedFamilies', JSON.stringify(
                    sanitizeFamiliesForServer(src.families)
                ));
                memoryStoreSetItem('ugap.vueMetier.heuristicRules', JSON.stringify(
                    sanitizeViewRulesForServer(src.businessViews)
                ));
            } catch (_) {
                // no-op
            }
        }

        function resetLocalUiStateStorage() {
            try {
                memoryStoreSetItem('ugap.famille.validatedFamilies', JSON.stringify([]));
                memoryStoreSetItem('ugap.vueMetier.heuristicRules', JSON.stringify([]));
            } catch (_) {
                // no-op
            }
        }

        async function persistUiStateToServer(payload) {
            if (__ugapUiStatePersistDisabled) return;
            await apiCall('/ui-state', {
                method: 'PUT',
                body: JSON.stringify({
                    families: sanitizeFamiliesForServer(payload?.families),
                    businessViews: sanitizeViewRulesForServer(payload?.businessViews)
                })
            });
        }

        function persistUiStateKeepalive(payload) {
            try {
                const body = JSON.stringify({
                    families: sanitizeFamiliesForServer(payload?.families),
                    businessViews: sanitizeViewRulesForServer(payload?.businessViews)
                });
                fetch(`${API_BASE}/ui-state`, {
                    method: 'PUT',
                    credentials: 'same-origin',
                    keepalive: true,
                    headers: { 'Content-Type': 'application/json' },
                    body
                }).catch(() => {});
            } catch (_) {
                // no-op
            }
        }

        async function flushUiStatePersistence() {
            if (__ugapUiStatePersistDisabled || __ugapUiStatePersistInFlight || !__ugapUiStatePersistPending) return;
            __ugapUiStatePersistInFlight = true;
            __ugapUiStatePersistPending = false;
            try {
                await persistUiStateToServer({
                    families: getFamilleValidatedFamilies(),
                    businessViews: getViewHeuristicRules()
                });
                if (__lastLoadDataSnapshot && typeof __lastLoadDataSnapshot === 'object') {
                    if (!__lastLoadDataSnapshot.uiState || typeof __lastLoadDataSnapshot.uiState !== 'object') {
                        __lastLoadDataSnapshot.uiState = {};
                    }
                    __lastLoadDataSnapshot.uiState.families = getFamilleValidatedFamilies();
                }
            } catch (error) {
                if (String(error?.message || '').includes('Données non trouvées')) {
                    __ugapUiStatePersistDisabled = true;
                    __ugapUiStatePersistPending = false;
                    if (__ugapUiStatePersistTimer) {
                        clearTimeout(__ugapUiStatePersistTimer);
                        __ugapUiStatePersistTimer = null;
                    }
                    showAlert('Sauvegarde des familles indisponible: données UGAP non initialisées pour cette entité.', 'warning');
                    return;
                }
                console.warn('UGAP ui-state persistence failed:', error?.message || error);
            } finally {
                __ugapUiStatePersistInFlight = false;
                if (__ugapUiStatePersistPending) {
                    if (__ugapUiStatePersistTimer) clearTimeout(__ugapUiStatePersistTimer);
                    __ugapUiStatePersistTimer = setTimeout(() => { flushUiStatePersistence(); }, 120);
                }
            }
        }

        function scheduleUiStatePersistence() {
            __ugapUiStatePersistPending = true;
            if (__ugapUiStatePersistTimer) {
                clearTimeout(__ugapUiStatePersistTimer);
            }
            __ugapUiStatePersistTimer = setTimeout(() => {
                __ugapUiStatePersistTimer = null;
                flushUiStatePersistence();
            }, 350);
        }

        function triggerUiStatePersistenceNow() {
            __ugapUiStatePersistPending = true;
            if (__ugapUiStatePersistTimer) {
                clearTimeout(__ugapUiStatePersistTimer);
                __ugapUiStatePersistTimer = null;
            }
            flushUiStatePersistence();
        }

        async function hydrateUiStateFromServer() {
            const serverUiState = currentData?.uiState && typeof currentData.uiState === 'object'
                ? currentData.uiState
                : {};
            const serverFamilies = Array.isArray(serverUiState.families) ? serverUiState.families : [];
            const serverViewRules = Array.isArray(serverUiState.businessViews) ? serverUiState.businessViews : [];
            const serverViewPresets = Array.isArray(serverUiState.viewPresets) ? serverUiState.viewPresets : [];
            // Source de verite = backend. Meme vide, on remplace l'etat local.
            applyServerUiStateToLocal(serverUiState);
            currentData.uiState = {
                families: Array.isArray(serverFamilies) ? serverFamilies : [],
                businessViews: Array.isArray(serverViewRules) ? serverViewRules : [],
                baseModelTemplateFamilies: Array.isArray(serverUiState.baseModelTemplateFamilies)
                    ? serverUiState.baseModelTemplateFamilies.map((x) => String(x || '').trim()).filter(Boolean)
                    : [],
                viewPresets: serverViewPresets.length
                    ? serverViewPresets
                    : [{
                        id: 'basic',
                        label: 'Basic',
                        businessViewIds: (Array.isArray(serverViewRules) ? serverViewRules : [])
                            .map((v) => String(v?.id || '').trim())
                            .filter(Boolean)
                    }],
                activeViewPresetId: String(serverUiState.activeViewPresetId || 'basic').trim() || 'basic',
                updatedAt: serverUiState.updatedAt || null
            };
        }

        function cleanupDeletedOptionReferences() {
            const validOptionIds = new Set(
                (Array.isArray(currentData?.categories) ? currentData.categories : [])
                    .flatMap((cat) => Array.isArray(cat?.options) ? cat.options : [])
                    .map((opt) => String(opt?.id || '').trim())
                    .filter(Boolean)
            );
            if (!validOptionIds.size) return;

            const families = getFamilleValidatedFamilies();
            const cleanedFamilies = (Array.isArray(families) ? families : []).map((f) => {
                const optionIds = (Array.isArray(f?.optionIds) ? f.optionIds : [])
                    .map((x) => String(x || '').trim())
                    .filter((x) => x && validOptionIds.has(x));
                const out = { ...f, optionIds };
                const def = String(f?.defaultOptionId || '').trim();
                if (!def || !validOptionIds.has(def) || !optionIds.includes(def)) {
                    delete out.defaultOptionId;
                }
                return out;
            });
            setFamilleValidatedFamilies(cleanedFamilies);

            const normalizeLegacyOptId = (value) => {
                const v = String(value || '').trim();
                const m = v.match(/^(.*)__\d+$/);
                return m && m[1] ? String(m[1]).trim() : v;
            };
            const normalizeLegacyItemKey = (item) => {
                const raw = String(item || '').trim();
                const sep = raw.lastIndexOf('::');
                if (sep < 0) return raw;
                const col = raw.slice(0, sep);
                const opt = normalizeLegacyOptId(raw.slice(sep + 2));
                return `${col}::${opt}`;
            };
            const keepItem = (itemKey) => {
                const normalized = normalizeLegacyItemKey(itemKey);
                const sep = normalized.lastIndexOf('::');
                if (sep < 0) return false;
                const opt = String(normalized.slice(sep + 2) || '').trim();
                return !!opt && validOptionIds.has(opt);
            };

            const couplings = getCouplingRules();
            const cleanedCouplings = (Array.isArray(couplings) ? couplings : []).map((cp) => {
                const links = (Array.isArray(cp?.links) ? cp.links : []).map((lnk) => ({
                    ...lnk,
                    masterItems: (Array.isArray(lnk?.masterItems) ? lnk.masterItems : [])
                        .map(normalizeLegacyItemKey)
                        .filter(keepItem),
                    slaveItems: (Array.isArray(lnk?.slaveItems) ? lnk.slaveItems : [])
                        .map(normalizeLegacyItemKey)
                        .filter(keepItem),
                    masterLabels: [],
                    slaveLabels: []
                })).filter((lnk) => (lnk.masterItems || []).length > 0 || (lnk.slaveItems || []).length > 0);

                return {
                    ...cp,
                    selectedMasterItems: (Array.isArray(cp?.selectedMasterItems) ? cp.selectedMasterItems : [])
                        .map(normalizeLegacyItemKey)
                        .filter(keepItem),
                    selectedSlaveItems: (Array.isArray(cp?.selectedSlaveItems) ? cp.selectedSlaveItems : [])
                        .map(normalizeLegacyItemKey)
                        .filter(keepItem),
                    links
                };
            });
            setCouplingRules(cleanedCouplings);
            if (window.__ugapCouplingColumnState && Array.isArray(window.__ugapCouplingColumnState.couplings)) {
                window.__ugapCouplingColumnState.couplings = cleanedCouplings;
            }
        }

        // Load data
        async function loadData(skipRender = false) {
            const now = Date.now();
            if (__loadDataPromise) {
                return __loadDataPromise;
            }
            if (now < __loadDataCooldownUntil) {
                if (__lastLoadDataSnapshot) {
                    currentData = __lastLoadDataSnapshot;
                    if (!skipRender) {
                        const activeTab = document.querySelector('.tab.active');
                        renderActiveTab(activeTab ? activeTab.getAttribute('data-tab') : 'famille');
                        populateCategorySelect();
                    }
                    updateStats();
                    updateAllTabWarningBadges();
                }
                return;
            }
            if (now - __lastLoadDataAt < 1200) {
                return;
            }
            __lastLoadDataAt = now;

            __loadDataPromise = (async () => {
            try {
                const result = await apiCall('/data', { allowBusinessError: true });
                
                // Gérer le cas où il n'y a pas de données
                if (!result.success && result.message === 'Aucune donnée configurée') {
                    showAlert('Aucune donnée configurée. Veuillez importer un fichier Excel.', 'info');
                    currentData = normalizeUgapDataContract(result.data || { models: [], categories: [], uiState: {} });
                    __lastLoadDataSnapshot = currentData;
                    await hydrateUiStateFromServer();
                    updateStats();
                    updateAllTabWarningBadges();
                    
                    if (!skipRender) {
                        const activeTab = document.querySelector('.tab.active');
                        renderActiveTab(activeTab ? activeTab.getAttribute('data-tab') : 'famille');
                        populateCategorySelect();
                    }
                    return;
                }
                
                currentData = normalizeUgapDataContract(result.data);
                await hydrateUiStateFromServer();
                __lastLoadDataSnapshot = currentData;
                cleanupDeletedOptionReferences();
                updateStats();
                updateAllTabWarningBadges();
                
                // Ne pas re-rendre si on est en train de streamer
                if (!skipRender) {
                    // Ne rendre que l'onglet actif pour améliorer les performances
                    const activeTab = document.querySelector('.tab.active');
                    if (activeTab) {
                        const tabName = activeTab.getAttribute('data-tab');
                        renderActiveTab(tabName);
                    } else {
                        // Par défaut, rendre l'onglet "models"
                        renderActiveTab('famille');
                    }
                }
                
                // Ne pas mettre à jour le select si on est en train de streamer (évite les événements)
                if (!skipRender) {
                    populateCategorySelect();
                }
            } catch (error) {
                if (String(error?.message || '').toLowerCase().includes('trop de requ') || String(error?.message || '').includes('429')) {
                    __loadDataCooldownUntil = Date.now() + 65000;
                    showAlert('Trop de requetes. Pause automatique 1 minute puis reessayez.', 'warning');
                    return;
                }
                if (error.message.includes('404') || error.message.includes('Aucune donnée')) {
                    showAlert('Aucune donnée configurée. Veuillez importer un fichier Excel.', 'info');
                    currentData = normalizeUgapDataContract({ models: [], categories: [] });
                    __lastLoadDataSnapshot = currentData;
                    updateStats();
                    updateAllTabWarningBadges();
                } else {
                    showAlert('Erreur lors du chargement: ' + error.message, 'error');
                }
            } finally {
                __loadDataPromise = null;
            }
            })();
            return __loadDataPromise;
        }
        
        // Rendre uniquement l'onglet actif
        function renderActiveTab(tabName) {
            switch(tabName) {
                case 'import':
                    publishImportWorkflowGlobals();
                    if (importViewMode === 'editor') {
                        if (currentImportStaging && typeof applyImportStagingToCurrentData === 'function') applyImportStagingToCurrentData();
                        if (typeof renderImportWorkflow === 'function') renderImportWorkflow();
                    } else if (typeof loadImportList === 'function') {
                        loadImportList();
                    }
                    break;
                case 'models':
                    renderModels();
                    break;
                case 'categories':
                    renderCategoriesManagement();
                    break;
                case 'famille':
                    renderExtractionInsights();
                    break;
                case 'options':
                    renderCategories();
                    break;
                case 'structured':
                    renderStructuredOptionsView();
                    break;
                case 'couplings':
                    renderOptionCouplingsTab();
                    break;
                case 'prompts':
                    loadPrompts();
                    break;
                case 'base-model':
                    // Compat legacy: redirige vers "Modèles" (sous-onglet Template).
                    switchModelSubtab('template');
                    renderModels();
                    break;
            }
        }

        function switchModelSubtab(tabName) {
            const next = tabName === 'template' ? 'template' : 'models';
            const modelsBtn = document.getElementById('btn-model-subtab-models');
            const templateBtn = document.getElementById('btn-model-subtab-template');
            const modelsPanel = document.getElementById('model-subtab-models');
            const templatePanel = document.getElementById('model-subtab-template');
            if (modelsBtn) {
                modelsBtn.classList.toggle('btn-primary', next === 'models');
                modelsBtn.classList.toggle('btn-outline', next !== 'models');
            }
            if (templateBtn) {
                templateBtn.classList.toggle('btn-primary', next === 'template');
                templateBtn.classList.toggle('btn-outline', next !== 'template');
            }
            if (modelsPanel) modelsPanel.style.display = next === 'models' ? 'block' : 'none';
            if (templatePanel) templatePanel.style.display = next === 'template' ? 'block' : 'none';
            if (next === 'template') {
                renderBaseModelTab('base-model-content');
            }
        }

        /** Blocs toujours insérés entre avant/après (alignés sur UgapDataService.js défauts). */
        const FAMILLE_LISTE_INJECTION_BLOCK = '## DONNÉES (liste injectée automatiquement)\n{{LISTE_LIGNES}}';
        const FAMILLE_FORMAT_EDITABLE_DEFAULT = `## FORMAT DE RETOUR (obligatoire)
- Un **seul** tableau JSON (array), racine directe. Aucun texte avant \`[\` ni après \`]\` (pas de markdown, pas de \`\`\`json).
- Chaque élément : \`familyLabel\` (string, non vide), \`optionIds\` (array de strings = valeurs \`id=\` **exactes** de la liste).
- Optionnel : \`defaultOptionId\` (string) ∈ \`optionIds\`, seulement si une ligne est clairement la référence / standard.
- **Choix unique** : pour un même équipement, toutes les variantes couleur / RAL / finition → **une** famille, **tous** les ids dans \`optionIds\` (on ne choisit qu'une teinte, pas plusieurs).
- Pour un même équipement, plusieurs dimensions de choix peuvent coexister: créer une famille par dimension (exemple Console de pilotage: famille \`Console de pilotage (couleur)\` + famille \`Console de pilotage (type)\`).

## Règles strictes
- Chaque \`id\` présent dans les données apparaît **exactement une fois** au total dans tous les \`optionIds\`.
- Pas de doublon d'id entre familles ; pas d'id inventé.
- \`familyLabel\` : court, en français, décrit le **choix catalogue** (pas la couleur seule).
- Couleurs du même produit : **une** famille, pas une famille par teinte.
- Console de pilotage: ne pas mélanger les variantes de couleur avec les variantes de type/changement de console.
- Liste longue : reste cohérent du début à la fin ; une seule réponse JSON couvrant **toutes** les lignes.`;
        const FAMILLE_FORMAT_JSON_FIXED_BLOCK = `[
  {"familyLabel":"Couleur du flotteur","optionIds":["opt_23","opt_24","opt_25"]},
  {"familyLabel":"Console de pilotage (couleur)","optionIds":["opt_86","opt_87","opt_88"],"defaultOptionId":"opt_86"}
]`;
        const ASSIGNATION_PROMPT_DEFAULT = `Tu dois assigner UNE famille à UNE vue métier.

Vues métier disponibles:
{{businessViews}}

Famille à classer:
- familyLabel: {{familyLabel}}
- assignation actuelle: {{assignation}}
- sousFamille: {{subFamily}}
- nombre options: {{optionsCount}}
- exemples options:
{{optionsList}}

Règles:
- Choisir exactement UNE vue métier parmi les id fournis.
- Se baser sur le sens métier de la famille et les mots-clés des vues.
- Répondre en JSON strict, sans texte autour.

Format:
{
  "businessViewId": "id_exact_si_possible",
  "businessViewLabel": "label_vue_metier",
  "confidence": 0.0,
  "reason": "explication courte"
}`;

        function splitFamillePromptForUi(full) {
            const s = String(full ?? '');
            const re = /\{\{\s*LISTE_LIGNES\s*\}\}|\{\{\s*lines\s*\}\}/i;
            const m = re.exec(s);
            if (!m) {
                return { before: s.replace(/\s+$/, ''), formatEditable: FAMILLE_FORMAT_EDITABLE_DEFAULT, after: '' };
            }
            let before = s.slice(0, m.index);
            let after = s.slice(m.index + m[0].length);
            before = before.replace(/\n*#{1,3}\s*DONN[EÉ]ES[^\n]*\s*$/i, '').trimEnd();
            let formatEditable = FAMILLE_FORMAT_EDITABLE_DEFAULT;
            const fixedIdx = after.indexOf(FAMILLE_FORMAT_JSON_FIXED_BLOCK);
            if (fixedIdx !== -1) {
                const formatPart = after.slice(0, fixedIdx).trim();
                if (formatPart) {
                    formatEditable = formatPart;
                }
                after = after.slice(fixedIdx + FAMILLE_FORMAT_JSON_FIXED_BLOCK.length);
            }
            after = after.trimStart();
            return { before, formatEditable, after };
        }

        function joinFamillePromptFromUi(before, formatEditable, after) {
            const b = String(before ?? '').trimEnd();
            const f = String(formatEditable ?? '').trim();
            const a = String(after ?? '').trimStart();
            const formatBlock = [f || FAMILLE_FORMAT_EDITABLE_DEFAULT, FAMILLE_FORMAT_JSON_FIXED_BLOCK].join('\n\n');
            const core = [FAMILLE_LISTE_INJECTION_BLOCK, formatBlock].join('\n\n');
            if (b && a) return `${b}\n\n${core}\n\n${a}`;
            if (b) return `${b}\n\n${core}`;
            if (a) return `${core}\n\n${a}`;
            return core;
        }

        function decodePromptSelection(value) {
            const raw = String(value || '').trim();
            const m = raw.match(/^server:([^|]+)\|model:(.+)$/i);
            if (!m) return { serverId: '', model: '' };
            return {
                serverId: decodeURIComponent(m[1] || '').trim(),
                model: decodeURIComponent(m[2] || '').trim()
            };
        }

        function buildPromptSelectionValue(serverId, model) {
            const sid = String(serverId || '').trim();
            const mdl = String(model || '').trim();
            if (!sid || !mdl) return '';
            return `server:${encodeURIComponent(sid)}|model:${encodeURIComponent(mdl)}`;
        }

        const PROMPT_TAB_TO_PREFIX = {
            'extraction-base': 'subcategory',
            categorization: 'categorization',
            minoration: 'minoration',
            famille: 'famille',
            assignation: 'assignation'
        };
        let __ugapRuntimeChoices = { servers: [], serverModelChoices: [] };

        function getActivePromptPrefix() {
            const activeBtn = document.querySelector('#prompt-subtabs .subtab-btn.active');
            const tabId = activeBtn?.getAttribute('data-prompt-subtab') || 'extraction-base';
            return PROMPT_TAB_TO_PREFIX[tabId] || 'subcategory';
        }

        function syncRuntimeSelectorsFromActivePrompt() {
            const serverSel = document.getElementById('prompt-runtime-server');
            const modelSel = document.getElementById('prompt-runtime-model');
            if (!serverSel || !modelSel) return;
            const prefix = getActivePromptPrefix();
            const promptServer = document.getElementById(`prompt-server-${prefix}`);
            const promptModel = document.getElementById(`prompt-model-${prefix}`);
            if (!promptServer || !promptModel) return;

            const servers = __ugapRuntimeChoices.servers || [];
            const choices = __ugapRuntimeChoices.serverModelChoices || [];
            serverSel.innerHTML = servers.length
                ? servers.map((s) => `<option value="${escapeHtml(String(s.id || ''))}">${escapeHtml(s.name || s.provider || 'Serveur')}</option>`).join('')
                : '<option value="">Aucun serveur</option>';

            const selectedServer = String(promptServer.value || serverSel.value || '').trim();
            if (selectedServer) serverSel.value = selectedServer;

            const models = choices
                .filter((x) => String(x.serverId || '').trim() === String(serverSel.value || '').trim())
                .map((x) => String(x.model || '').trim())
                .filter(Boolean);
            const uniqueModels = Array.from(new Set(models));
            modelSel.innerHTML = uniqueModels.length
                ? uniqueModels.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')
                : '<option value="">Aucun modèle</option>';
            const selectedModel = String(promptModel.value || '').trim();
            if (selectedModel && uniqueModels.includes(selectedModel)) {
                modelSel.value = selectedModel;
            }
        }

        function bindRuntimeSelectors() {
            const serverSel = document.getElementById('prompt-runtime-server');
            const modelSel = document.getElementById('prompt-runtime-model');
            if (!serverSel || !modelSel) return;

            serverSel.onchange = () => {
                const prefix = getActivePromptPrefix();
                const promptServer = document.getElementById(`prompt-server-${prefix}`);
                const promptModel = document.getElementById(`prompt-model-${prefix}`);
                if (!promptServer || !promptModel) return;
                promptServer.value = serverSel.value;
                promptServer.dispatchEvent(new Event('change'));
                setTimeout(() => {
                    const models = Array.from(promptModel.options || []).map((o) => o.value).filter(Boolean);
                    modelSel.innerHTML = models.length
                        ? models.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')
                        : '<option value="">Aucun modèle</option>';
                    if (models.length) {
                        modelSel.value = promptModel.value || models[0];
                    }
                }, 0);
            };

            modelSel.onchange = () => {
                const prefix = getActivePromptPrefix();
                const promptModel = document.getElementById(`prompt-model-${prefix}`);
                if (!promptModel) return;
                promptModel.value = modelSel.value;
            };
        }

        function populatePromptServerModelPair(prefix, servers, serverModelChoices, selectedValue) {
            const serverEl = document.getElementById(`prompt-server-${prefix}`);
            const modelEl = document.getElementById(`prompt-model-${prefix}`);
            if (!serverEl || !modelEl) return;

            const selected = decodePromptSelection(selectedValue);
            const choices = Array.isArray(serverModelChoices) ? serverModelChoices : [];
            const serversMap = new Map();
            (servers || []).forEach((s) => {
                const id = String(s.id || '').trim();
                if (!id) return;
                serversMap.set(id, s.name || s.provider || 'Serveur');
            });
            choices.forEach((c) => {
                const id = String(c.serverId || '').trim();
                if (!id) return;
                if (!serversMap.has(id)) serversMap.set(id, c.serverName || 'Serveur');
            });

            const serverIds = Array.from(serversMap.keys());
            serverEl.innerHTML = serverIds.length
                ? serverIds.map((id) => {
                    const isSel = selected.serverId && selected.serverId === id ? ' selected' : '';
                    return `<option value="${escapeHtml(id)}"${isSel}>${escapeHtml(serversMap.get(id))}</option>`;
                }).join('')
                : '<option value="">Aucun serveur disponible</option>';

            const refreshModels = (wantedModel = '') => {
                const sid = String(serverEl.value || '').trim();
                const models = choices
                    .filter((x) => String(x.serverId || '').trim() === sid)
                    .map((x) => String(x.model || '').trim())
                    .filter(Boolean);
                const uniqueModels = Array.from(new Set(models));
                modelEl.innerHTML = uniqueModels.length
                    ? uniqueModels.map((m) => {
                        const sel = wantedModel && wantedModel === m ? ' selected' : '';
                        return `<option value="${escapeHtml(m)}"${sel}>${escapeHtml(m)}</option>`;
                    }).join('')
                    : '<option value="">Aucun modèle</option>';
                if (wantedModel && !uniqueModels.includes(wantedModel)) {
                    modelEl.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(wantedModel)}" selected>Modèle non accessible (${escapeHtml(wantedModel)})</option>`);
                } else if (!wantedModel && uniqueModels.length) {
                    modelEl.selectedIndex = 0;
                }
            };

            serverEl.onchange = () => refreshModels('');
            if (serverIds.length && selected.serverId && !serverIds.includes(selected.serverId)) {
                serverEl.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(selected.serverId)}" selected>Serveur non accessible (${escapeHtml(selected.serverId)})</option>`);
            } else if (!selected.serverId && serverIds.length) {
                serverEl.selectedIndex = 0;
            }
            refreshModels(selected.model);
        }

        async function loadIaRuntimeBanner(promptData = {}) {
            const el = document.getElementById('prompt-ia-runtime');
            if (!el) return;
            el.innerHTML = '<span style="color:#666;">Chargement de la config IA…</span>';
            try {
                const r = await apiCall('/ia-context');
                const d = r.data || {};
                const fetchIaApi = async (endpoint) => {
                    const response = await fetch(`/api/ia${endpoint}`, {
                        method: 'GET',
                        credentials: 'include'
                    });
                    const data = await response.json();
                    if (!response.ok || !data.success) {
                        throw new Error(data.message || `Erreur API IA (${endpoint})`);
                    }
                    return data;
                };

                const [serversResp, llmsResp] = await Promise.all([
                    fetchIaApi('/servers'),
                    fetchIaApi('/llms')
                ]);
                const llms = Array.isArray(llmsResp.llms)
                    ? llmsResp.llms.map((m) => ({
                        id: String(m._id || ''),
                        name: m.name || '',
                        model: m.model || '',
                        provider: m.provider || '',
                        is_default: !!m.is_default
                    }))
                    : [];
                const servers = Array.isArray(serversResp.servers)
                    ? serversResp.servers.map((s) => ({
                        id: String(s._id || ''),
                        name: s.name || '',
                        provider: s.provider || '',
                        scope: s.scope || ''
                    }))
                    : [];
                const runtimeDefaultLabel = [d.provider || '', d.model || ''].filter(Boolean).join(' · ');

                let serverModelChoices = [];
                if (servers.length > 0) {
                    const modelsByServer = await Promise.all(servers.map(async (s) => {
                        const sid = String(s.id || '');
                        if (!sid) return [];
                        try {
                            const rsp = await fetchIaApi(`/servers/${encodeURIComponent(sid)}/models`);
                            const models = Array.isArray(rsp.models) ? rsp.models : [];
                            return models
                                .map((m) => {
                                    if (typeof m === 'string') return String(m).trim();
                                    if (m && typeof m === 'object' && m.name) return String(m.name).trim();
                                    return '';
                                })
                                .filter(Boolean)
                                .map((model) => ({ serverId: sid, serverName: s.name || '', model }));
                        } catch (_) {
                            return [];
                        }
                    }));
                    serverModelChoices = modelsByServer.flat();
                }
                __ugapRuntimeChoices = { servers, serverModelChoices };

                populatePromptServerModelPair('subcategory', servers, serverModelChoices, promptData.subCategoryLlmId || d.promptLlmSelection?.subCategoryLlmId);
                populatePromptServerModelPair('categorization', servers, serverModelChoices, promptData.categorizationLlmId || d.promptLlmSelection?.categorizationLlmId);
                populatePromptServerModelPair('minoration', servers, serverModelChoices, promptData.minorationLlmId || d.promptLlmSelection?.minorationLlmId);
                populatePromptServerModelPair('famille', servers, serverModelChoices, promptData.familleLlmId || d.promptLlmSelection?.familleLlmId);
                populatePromptServerModelPair('assignation', servers, serverModelChoices, promptData.assignationLlmId || d.promptLlmSelection?.assignationLlmId);

                const entityBlock = d.entityLlm
                    ? `<div style="margin-top:10px; padding-top:10px; border-top:1px solid #bee5eb; font-size:13px; color:#555;">
                        <strong>LLM enregistré (entité)</strong> : ${escapeHtml(d.entityLlm.name || '—')}
                        — modèle <code style="background:#e9ecef;padding:1px 6px;border-radius:3px;">${escapeHtml(d.entityLlm.model || '—')}</code>
                        ${d.entityLlm.serverName ? ` — serveur « ${escapeHtml(d.entityLlm.serverName)} »` : ''}
                        ${d.entityLlm.is_default ? ' <span class="badge">défaut</span>' : ''}
                       </div>`
                    : '<div style="margin-top:10px; padding-top:10px; border-top:1px solid #bee5eb; font-size:13px; color:#666;">Sélectionnez explicitement un modèle serveur (même logique que le module Chat IA).</div>';
                el.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
                        <div style="flex:1; min-width:220px;">
                            <strong>🖥️ Serveur / modèle utilisés pour les appels IA UGAP</strong>
                            <span class="badge" style="margin-left:6px; background:#0c5460; color:#fff;">${escapeHtml(d.sourceLabel || '')}</span>
                            <div style="margin-top:8px; line-height:1.5; font-size:13px; color:#333;">
                                Sélection active via les menus ci-dessous (serveur et modèle du prompt actif).
                            </div>
                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:8px; margin-top:10px;">
                                <div>
                                    <label for="prompt-runtime-server" style="display:block; font-size:12px; color:#555; margin-bottom:4px;">Serveur (prompt actif)</label>
                                    <select id="prompt-runtime-server" style="width:100%; padding:8px; border:1px solid #b8d7df; border-radius:4px; background:#fff;"></select>
                                </div>
                                <div>
                                    <label for="prompt-runtime-model" style="display:block; font-size:12px; color:#555; margin-bottom:4px;">Modèle (prompt actif)</label>
                                    <select id="prompt-runtime-model" style="width:100%; padding:8px; border:1px solid #b8d7df; border-radius:4px; background:#fff;"></select>
                                </div>
                            </div>
                            <div style="margin-top:4px; font-size:13px; color:#333;">${escapeHtml(d.endpointSummary || '')}</div>
                            ${d.llmName ? `<div style="margin-top:4px; font-size:13px;">Profil LLM : <em>${escapeHtml(d.llmName)}</em></div>` : ''}
                        </div>
                        <div style="min-width:320px; max-width:460px; font-size:12px; color:#555;">
                            <div><strong>Serveurs IA autorisés (module IA) :</strong> ${servers.length}</div>
                            <div><strong>Modèles détectés sur serveurs :</strong> ${serverModelChoices.length}</div>
                            <div><strong>Choix disponibles par prompt :</strong> ${serverModelChoices.length} (modèles serveur)</div>
                            <div style="margin-top:6px;">
                                UGAP suit la même logique que Chat IA : choix uniquement parmi les modèles des serveurs autorisés.
                            </div>
                        </div>
                    </div>
                    <div style="margin-top:8px; font-size:11px; color:#5a6a70;">UI version: ${escapeHtml(UGAP_PROMPTS_UI_VERSION)}</div>
                    ${entityBlock}
                `;
                bindRuntimeSelectors();
                syncRuntimeSelectorsFromActivePrompt();
            } catch (e) {
                el.innerHTML = `<span style="color:#842029;">Impossible de charger la config IA : ${escapeHtml(e.message)}</span>`;
            }
        }

        // Load prompts
        async function loadPrompts() {
            try {
                const result = await apiCall('/prompts');
                let subCategoryPrompt = result.data.subCategoryPrompt || '';
                const categorizationPrompt = result.data.categorizationPrompt || '';
                const minorationPrompt = result.data.minorationPrompt || '';
                const famillePrompt = result.data.famillePrompt || '';
                const familleContext = result.data.familleContext != null ? result.data.familleContext : '';
                const assignationPrompt = String(result.data.assignationPrompt || '').trim() || ASSIGNATION_PROMPT_DEFAULT;
                const subCategoryLlmId = result.data.subCategoryLlmId || '';
                const categorizationLlmId = result.data.categorizationLlmId || '';
                const minorationLlmId = result.data.minorationLlmId || '';
                const familleLlmId = result.data.familleLlmId || '';
                const assignationLlmId = result.data.assignationLlmId || '';

                const hasMarkers =
                    subCategoryPrompt.includes(EXTRACTION_PROMPT_MARKERS.context) &&
                    subCategoryPrompt.includes(EXTRACTION_PROMPT_MARKERS.prompt) &&
                    subCategoryPrompt.includes(EXTRACTION_PROMPT_MARKERS.lines) &&
                    subCategoryPrompt.includes(EXTRACTION_PROMPT_MARKERS.format);

                if (!hasMarkers) {
                    const migratedPrompt = buildSubCategoryPrompt({
                        contextText: EXTRACTION_PROMPT_SECTIONS.context,
                        promptText: EXTRACTION_PROMPT_SECTIONS.prompt,
                        linesText: EXTRACTION_PROMPT_SECTIONS.lines,
                        formatText: EXTRACTION_PROMPT_SECTIONS.format
                    });
                    try {
                        await apiCall('/prompts', {
                            method: 'PUT',
                            body: JSON.stringify({
                                subCategoryPrompt: migratedPrompt,
                                categorizationPrompt,
                                minorationPrompt,
                                famillePrompt,
                                familleContext,
                                subCategoryLlmId,
                                categorizationLlmId,
                                minorationLlmId,
                                familleLlmId,
                                assignationLlmId
                            })
                        });
                        subCategoryPrompt = migratedPrompt;
                        showAlert('Prompt extraction mis à jour avec la nouvelle structure.', 'success');
                    } catch (error) {
                        console.warn('Migration du prompt impossible:', error);
                    }
                }

                const parsed = parseSubCategoryPromptSections(subCategoryPrompt);
                const contextTarget = document.getElementById('prompt-extraction-context');
                const bodyTarget = document.getElementById('prompt-extraction-body');
                const formatTarget = document.getElementById('prompt-extraction-format-text');
                if (contextTarget) contextTarget.value = parsed.contextText;
                if (bodyTarget) bodyTarget.value = parsed.promptText;
                if (formatTarget) formatTarget.value = parsed.formatText;

                populatePromptLinesDropdown(parsed.linesText);
                populatePromptFormatDropdown(parsed.formatText);

                document.getElementById('prompt-categorization').value = categorizationPrompt;
                const minorationTarget = document.getElementById('prompt-minoration');
                if (minorationTarget) {
                    minorationTarget.value = minorationPrompt;
                }
                const familleContextTarget = document.getElementById('prompt-famille-context');
                if (familleContextTarget) {
                    familleContextTarget.value = familleContext;
                }
                const familleInjectionPre = document.getElementById('prompt-famille-injection-pre');
                if (familleInjectionPre) familleInjectionPre.textContent = FAMILLE_LISTE_INJECTION_BLOCK;
                const familleFormatPre = document.getElementById('prompt-famille-format-pre');
                if (familleFormatPre) familleFormatPre.textContent = FAMILLE_FORMAT_JSON_FIXED_BLOCK;
                const { before: familleBefore, formatEditable: familleFormatEditable, after: familleAfter } = splitFamillePromptForUi(famillePrompt);
                const familleBeforeEl = document.getElementById('prompt-famille-before');
                const familleFormatEditableEl = document.getElementById('prompt-famille-format-editable');
                const familleAfterEl = document.getElementById('prompt-famille-after');
                if (familleBeforeEl) familleBeforeEl.value = familleBefore;
                if (familleFormatEditableEl) familleFormatEditableEl.value = familleFormatEditable || FAMILLE_FORMAT_EDITABLE_DEFAULT;
                if (familleAfterEl) familleAfterEl.value = familleAfter;
                const assignationPromptEl = document.getElementById('prompt-assignation-body');
                if (assignationPromptEl) assignationPromptEl.value = assignationPrompt;

                const promptStatusDiv = document.getElementById('prompt-status');
                if (promptStatusDiv) {
                    promptStatusDiv.innerHTML = `
                        <span style="color: #28a745;">✅ <strong>Prompts chargés</strong></span>
                        <br>Extraction, catégorisation, minoration, famille (regroupement IA), assignation familles.
                    `;
                }
                await loadIaRuntimeBanner({
                    subCategoryLlmId,
                    categorizationLlmId,
                    minorationLlmId,
                    familleLlmId,
                    assignationLlmId
                });
            } catch (error) {
                showAlert('Erreur lors du chargement des prompts: ' + error.message, 'error');
            }
        }

        function switchPromptSubtab(tabId) {
            document.querySelectorAll('#prompt-subtabs .subtab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-prompt-subtab') === tabId);
            });
            document.querySelectorAll('#tab-prompts .subtab-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === `prompt-subtab-${tabId}`);
            });
            syncRuntimeSelectorsFromActivePrompt();
        }

        function populatePromptLinesDropdown(existingLinesText) {
            const select = document.getElementById('prompt-extraction-lines-select');
            const counter = document.getElementById('prompt-extraction-lines-count');
            if (!select) return;
            const modelLines = (currentData?.models || [])
                .map((m, idx) => m.baseLabel || `${idx + 1}. ${m.name || ''}`)
                .filter(Boolean);
            const mergedLines = modelLines.length > 0 ? modelLines : String(existingLinesText || '').split('\n').filter(Boolean);
            select.innerHTML = '';
            mergedLines.forEach((line, index) => {
                const option = document.createElement('option');
                option.value = line;
                option.textContent = `${index + 1}. ${line}`;
                select.appendChild(option);
            });
            if (counter) {
                counter.textContent = `${mergedLines.length} ligne(s) affichée(s)`;
            }
        }

        function populatePromptFormatDropdown(currentFormatText) {
            const select = document.getElementById('prompt-extraction-format');
            if (!select) return;
            const entries = Object.entries(EXTRACTION_FORMAT_PRESETS);
            select.innerHTML = entries.map(([key]) => `<option value="${key}">${key}</option>`).join('');

            const current = String(currentFormatText || '').trim();
            let matched = entries.find(([, value]) => String(value).trim() === current)?.[0] || null;
            if (!matched) {
                select.insertAdjacentHTML('beforeend', '<option value="custom">custom</option>');
                matched = 'custom';
            }
            select.value = matched;
            select.dataset.previousValue = matched;
        }

        function getPromptLlmSelectionFromUi() {
            const subCategoryLlmId = buildPromptSelectionValue(
                document.getElementById('prompt-server-subcategory')?.value,
                document.getElementById('prompt-model-subcategory')?.value
            );
            const categorizationLlmId = buildPromptSelectionValue(
                document.getElementById('prompt-server-categorization')?.value,
                document.getElementById('prompt-model-categorization')?.value
            );
            const minorationLlmId = buildPromptSelectionValue(
                document.getElementById('prompt-server-minoration')?.value,
                document.getElementById('prompt-model-minoration')?.value
            );
            const familleLlmId = buildPromptSelectionValue(
                document.getElementById('prompt-server-famille')?.value,
                document.getElementById('prompt-model-famille')?.value
            );
            const assignationLlmId = buildPromptSelectionValue(
                document.getElementById('prompt-server-assignation')?.value,
                document.getElementById('prompt-model-assignation')?.value
            );
            return {
                subCategoryLlmId,
                categorizationLlmId,
                minorationLlmId,
                familleLlmId,
                assignationLlmId
            };
        }

        function ensurePromptLlmSelection(selection) {
            if (!selection.subCategoryLlmId || !selection.categorizationLlmId || !selection.minorationLlmId || !selection.familleLlmId || !selection.assignationLlmId) {
                showAlert('Sélection LLM obligatoire pour chaque prompt (pas de fallback).', 'error');
                return false;
            }
            return true;
        }

        async function saveExtractionPrompt() {
            try {
                const contextText = document.getElementById('prompt-extraction-context')?.value?.trim() || '';
                const promptText = document.getElementById('prompt-extraction-body')?.value?.trim() || '';
                const linesSelect = document.getElementById('prompt-extraction-lines-select');
                const linesText = Array.from(linesSelect?.options || []).map(opt => opt.value).join('\n');
                const formatText = document.getElementById('prompt-extraction-format-text')?.value?.trim() || '';
                const subCategoryPrompt = buildSubCategoryPrompt({ contextText, promptText, linesText, formatText });

                if (!contextText || !promptText || !formatText) {
                    showAlert('Contexte, prompt et format attendu sont obligatoires.', 'error');
                    return;
                }

                const currentPrompts = await apiCall('/prompts');
                const llmSelection = getPromptLlmSelectionFromUi();
                if (!ensurePromptLlmSelection(llmSelection)) return;
                await apiCall('/prompts', {
                    method: 'PUT',
                    body: JSON.stringify({
                        subCategoryPrompt,
                        categorizationPrompt: currentPrompts.data.categorizationPrompt || '',
                        minorationPrompt: currentPrompts.data.minorationPrompt || '',
                        famillePrompt: currentPrompts.data.famillePrompt || '',
                        assignationPrompt: currentPrompts.data.assignationPrompt || '',
                        familleContext: currentPrompts.data.familleContext != null ? currentPrompts.data.familleContext : '',
                        ...llmSelection
                    })
                });

                showAlert('Prompt extraction enregistré avec succès', 'success');
                await loadPrompts();
            } catch (error) {
                showAlert('Erreur lors de l\'enregistrement: ' + error.message, 'error');
            }
        }

        // Save categorization prompt
        async function saveCategorizationPrompt() {
            try {
                const categorizationPrompt = document.getElementById('prompt-categorization').value.trim();

                if (!categorizationPrompt) {
                    showAlert('Le prompt d\'amélioration de catégorisation ne peut pas être vide', 'error');
                    return;
                }

                // Récupérer le prompt de sous-catégorie existant pour ne pas l'écraser
                const currentPrompts = await apiCall('/prompts');
                const subCategoryPrompt = currentPrompts.data.subCategoryPrompt || '';
                const minorationPrompt = currentPrompts.data.minorationPrompt || '';
                const famillePrompt = currentPrompts.data.famillePrompt || '';
                const familleContext = currentPrompts.data.familleContext != null ? currentPrompts.data.familleContext : '';
                const llmSelection = getPromptLlmSelectionFromUi();
                if (!ensurePromptLlmSelection(llmSelection)) return;

                await apiCall('/prompts', {
                    method: 'PUT',
                    body: JSON.stringify({
                        subCategoryPrompt, // Garder l'existant
                        categorizationPrompt,
                        minorationPrompt, // Garder l'existant
                        famillePrompt,
                        assignationPrompt: currentPrompts.data.assignationPrompt || '',
                        familleContext,
                        ...llmSelection
                    })
                });

                showAlert('Prompt d\'amélioration de catégorisation enregistré avec succès', 'success');
            } catch (error) {
                showAlert('Erreur lors de l\'enregistrement: ' + error.message, 'error');
            }
        }

        async function saveMinorationPrompt() {
            try {
                const minorationPrompt = document.getElementById('prompt-minoration').value.trim();

                if (!minorationPrompt) {
                    showAlert('Le prompt de minoration ne peut pas être vide', 'error');
                    return;
                }

                const currentPrompts = await apiCall('/prompts');
                const subCategoryPrompt = currentPrompts.data.subCategoryPrompt || '';
                const categorizationPrompt = currentPrompts.data.categorizationPrompt || '';
                const famillePrompt = currentPrompts.data.famillePrompt || '';
                const familleContext = currentPrompts.data.familleContext != null ? currentPrompts.data.familleContext : '';
                const llmSelection = getPromptLlmSelectionFromUi();
                if (!ensurePromptLlmSelection(llmSelection)) return;

                await apiCall('/prompts', {
                    method: 'PUT',
                    body: JSON.stringify({
                        subCategoryPrompt,
                        categorizationPrompt,
                        minorationPrompt,
                        famillePrompt,
                        assignationPrompt: currentPrompts.data.assignationPrompt || '',
                        familleContext,
                        ...llmSelection
                    })
                });

                showAlert('Prompt minoration enregistré avec succès', 'success');
            } catch (error) {
                showAlert('Erreur lors de l\'enregistrement: ' + error.message, 'error');
            }
        }

        async function saveFamillePrompt() {
            try {
                const familleContext = document.getElementById('prompt-famille-context')?.value ?? '';
                const before = document.getElementById('prompt-famille-before')?.value ?? '';
                const formatEditable = document.getElementById('prompt-famille-format-editable')?.value ?? '';
                const after = document.getElementById('prompt-famille-after')?.value ?? '';
                if (!String(before).trim() && !String(after).trim()) {
                    showAlert('Renseignez au moins une des deux parties du prompt (avant ou après la liste des lignes).', 'error');
                    return;
                }
                const famillePrompt = joinFamillePromptFromUi(before, formatEditable, after);
                const currentPrompts = await apiCall('/prompts');
                const llmSelection = getPromptLlmSelectionFromUi();
                if (!ensurePromptLlmSelection(llmSelection)) return;
                await apiCall('/prompts', {
                    method: 'PUT',
                    body: JSON.stringify({
                        subCategoryPrompt: currentPrompts.data.subCategoryPrompt || '',
                        categorizationPrompt: currentPrompts.data.categorizationPrompt || '',
                        minorationPrompt: currentPrompts.data.minorationPrompt || '',
                        famillePrompt,
                        assignationPrompt: currentPrompts.data.assignationPrompt || '',
                        familleContext,
                        ...llmSelection
                    })
                });
                showAlert('Prompt Famille enregistré avec succès', 'success');
            } catch (error) {
                showAlert('Erreur lors de l\'enregistrement: ' + error.message, 'error');
            }
        }

        async function saveAssignationPrompt() {
            try {
                const currentPrompts = await apiCall('/prompts');
                const assignationPrompt = document.getElementById('prompt-assignation-body')?.value?.trim() || ASSIGNATION_PROMPT_DEFAULT;
                const llmSelection = getPromptLlmSelectionFromUi();
                if (!ensurePromptLlmSelection(llmSelection)) return;

                await apiCall('/prompts', {
                    method: 'PUT',
                    body: JSON.stringify({
                        subCategoryPrompt: currentPrompts.data.subCategoryPrompt || '',
                        categorizationPrompt: currentPrompts.data.categorizationPrompt || '',
                        minorationPrompt: currentPrompts.data.minorationPrompt || '',
                        famillePrompt: currentPrompts.data.famillePrompt || '',
                        assignationPrompt,
                        familleContext: currentPrompts.data.familleContext != null ? currentPrompts.data.familleContext : '',
                        ...llmSelection
                    })
                });

                showAlert('Prompt assignation enregistré avec succès', 'success');
                await loadPrompts();
                switchPromptSubtab('assignation');
            } catch (error) {
                showAlert('Erreur lors de l\'enregistrement assignation: ' + error.message, 'error');
            }
        }

        // Reset prompts to default
        async function resetPrompts() {
            if (!confirm('Réinitialiser les prompts aux valeurs par défaut ? Cette action ne peut pas être annulée.')) {
                return;
            }

            try {
                const result = await apiCall('/prompts/reset', {
                    method: 'POST'
                });

                await loadPrompts();
                showAlert('Prompts réinitialisés aux valeurs par défaut', 'success');
            } catch (error) {
                showAlert('Erreur lors de la réinitialisation: ' + error.message, 'error');
            }
        }

        // Populate category select for subcategories
        function populateCategorySelect() {
            const select = document.getElementById('select-category-for-sub');
            if (!select) return;
            
            // Sauvegarder la valeur actuelle pour éviter de déclencher l'événement change
            const currentValue = select.value;
            
            select.innerHTML = '<option value="">-- Choisir une catégorie --</option>';

            if (!currentData || !currentData.categories) return;

            currentData.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                select.appendChild(option);
            });
            
            // Restaurer la valeur si elle existait (sans déclencher l'événement)
            if (currentValue) {
                select.value = currentValue;
            }
        }

        // Update stats
        function updateStats() {
            if (!currentData) {
                const modelsEl = document.getElementById('stat-models');
                const categoriesEl = document.getElementById('stat-categories');
                const optionsEl = document.getElementById('stat-options');
                if (modelsEl) modelsEl.textContent = '0';
                if (categoriesEl) categoriesEl.textContent = '0';
                if (optionsEl) optionsEl.textContent = '0';
                return;
            }

            const modelsEl = document.getElementById('stat-models');
            const categoriesEl = document.getElementById('stat-categories');
            const optionsEl = document.getElementById('stat-options');
            if (modelsEl) modelsEl.textContent = String(currentData.models?.length || 0);
            const uiBusinessViews = Array.isArray(currentData?.uiState?.businessViews) ? currentData.uiState.businessViews : [];
            if (categoriesEl) categoriesEl.textContent = String(uiBusinessViews.length || 0);
            const optionsCount = currentData.categories?.reduce((sum, cat) => sum + (cat.options?.length || 0), 0) || 0;
            if (optionsEl) optionsEl.textContent = String(optionsCount);
        }

        // Render models - OPTIMISÉ
        function renderModels() {
            const tbody = document.querySelector('#models-table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!currentData || !currentData.models || currentData.models.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #666;">Aucun modèle</td></tr>';
                renderExtractionInsights();
                return;
            }

            // Utiliser DocumentFragment pour améliorer les performances DOM
            const fragment = document.createDocumentFragment();

            currentData.models.forEach(model => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                const configsCount = (model.configurations || []).length;
                const splitByType = splitModelOptionsByType(getModelOptionsForSummary(model.id));
                const modelOptionsCount = splitByType.regularOptions.length;
                tr.innerHTML = `
                    <td><strong>${model.name}</strong></td>
                    <td>${model.posteNumber ?? '-'}</td>
                    <td style="max-width: 260px;">${escapeHtml(model.motorizationBase || '-')}</td>
                    <td>${escapeHtml(model.defaultDeliveryMode || '-')}</td>
                    <td>${(model.basePrice || 0).toFixed(2)} €</td>
                    <td>${model.image ? `<img src="${model.image}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;">` : '<span style="color: #999;">Aucune</span>'}</td>
                    <td><span class="badge">${configsCount} configuration(s)</span></td>
                    <td><span class="badge">${modelOptionsCount}</span></td>
                    <td><button class="btn btn-primary" onclick="event.stopPropagation(); openModelModal('${model.id}')">Modifier</button></td>
                `;
                tr.addEventListener('click', () => openModelModal(model.id));
                fragment.appendChild(tr);
            });

            // Ajouter toutes les lignes en une seule opération DOM
            tbody.appendChild(fragment);
            renderExtractionInsights();
        }

        // Render categories management - OPTIMISÉ
        function renderCategoriesManagement() {
            const tbody = document.querySelector('#categories-management-table tbody');
            renderViewHeuristicRulesUi();
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!currentData || !currentData.categories || currentData.categories.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #666;">Aucune vue métier</td></tr>';
                return;
            }

            // Utiliser DocumentFragment pour améliorer les performances DOM
            const fragment = document.createDocumentFragment();

            currentData.categories.forEach((category, index) => {
                const isFirst = index === 0;
                const isLast = index === currentData.categories.length - 1;
                const tr = document.createElement('tr');
                tr.draggable = true;
                tr.setAttribute('data-category-id', category.id);
                const subCategoriesCount = (category.subCategories || []).length;
                
                tr.innerHTML = `
                    <td><strong>${category.name}</strong> <span style="font-size:11px; color:#666; margin-left:6px;">(glisser-déposer)</span></td>
                    <td><span class="badge">${subCategoriesCount} sous-catégorie(s)</span></td>
                    <td>
                        <button class="btn btn-outline" ${isFirst ? 'disabled' : ''} onclick="moveCategory('${category.id}', 'up')">↑</button>
                        <button class="btn btn-outline" ${isLast ? 'disabled' : ''} onclick="moveCategory('${category.id}', 'down')">↓</button>
                    </td>
                    <td>
                        <button class="btn btn-outline" onclick="editCategory('${category.id}')">Modifier</button>
                        <button class="btn btn-danger" onclick="deleteCategory('${category.id}')">Supprimer</button>
                    </td>
                `;
                tr.addEventListener('dragstart', (e) => {
                    tr.style.opacity = '0.45';
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/category-id', String(category.id));
                });
                tr.addEventListener('dragend', () => {
                    tr.style.opacity = '';
                });
                tr.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    tr.style.outline = '2px dashed #0d6efd';
                    tr.style.outlineOffset = '-2px';
                });
                tr.addEventListener('dragleave', () => {
                    tr.style.outline = '';
                    tr.style.outlineOffset = '';
                });
                tr.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    tr.style.outline = '';
                    tr.style.outlineOffset = '';
                    const fromId = String(e.dataTransfer.getData('text/category-id') || '').trim();
                    const toId = String(category.id || '').trim();
                    if (!fromId || !toId || fromId === toId) return;
                    await reorderCategoriesByDrag(fromId, toId);
                });
                fragment.appendChild(tr);
            });

            // Ajouter toutes les lignes en une seule opération DOM
            tbody.appendChild(fragment);
        }

        async function reorderCategoriesByDrag(fromCategoryId, toCategoryId) {
            if (!currentData || !Array.isArray(currentData.categories)) return;
            const categories = currentData.categories.slice();
            const fromIndex = categories.findIndex((cat) => String(cat.id) === String(fromCategoryId));
            const toIndex = categories.findIndex((cat) => String(cat.id) === String(toCategoryId));
            if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

            const [moved] = categories.splice(fromIndex, 1);
            categories.splice(toIndex, 0, moved);

            try {
                currentData.categories = categories;
                renderCategoriesManagement();
                await apiCall('/categories/reorder', {
                    method: 'PUT',
                    body: JSON.stringify({ orderedCategoryIds: categories.map((cat) => cat.id) })
                });
                await loadData();
            } catch (error) {
                await loadData();
                showAlert('Erreur de réorganisation des vues métier: ' + error.message, 'error');
            }
        }

        function getViewHeuristicRules() {
            try {
                const raw = memoryStoreGetItem('ugap.vueMetier.heuristicRules');
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        }

        function setViewHeuristicRules(rules) {
            try {
                memoryStoreSetItem('ugap.vueMetier.heuristicRules', JSON.stringify(Array.isArray(rules) ? rules : []));
                scheduleUiStatePersistence();
            } catch (_) {
                // no-op
            }
        }

        function getStructuredSelectedViewLabels() {
            const allLabels = Array.from(new Set(
                getViewHeuristicRules()
                    .map((r) => String(r?.viewLabel || '').trim())
                    .filter(Boolean)
            ));
            try {
                const raw = memoryStoreGetItem('ugap.vueMetier.structuredSelectedViews');
                const parsed = raw ? JSON.parse(raw) : null;
                if (!Array.isArray(parsed) || parsed.length === 0) return allLabels;
                const selected = parsed
                    .map((x) => String(x || '').trim())
                    .filter((x) => x && allLabels.includes(x));
                return selected.length ? selected : allLabels;
            } catch (_) {
                return allLabels;
            }
        }

        function setStructuredSelectedViewLabels(labels) {
            const clean = Array.from(new Set(
                (Array.isArray(labels) ? labels : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean)
            ));
            memoryStoreSetItem('ugap.vueMetier.structuredSelectedViews', JSON.stringify(clean));
        }

        function getStructuredSubFamilyViewMap() {
            try {
                const raw = memoryStoreGetItem('ugap.vueMetier.structuredSubFamilyViews');
                const parsed = raw ? JSON.parse(raw) : {};
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (_) {
                return {};
            }
        }

        function setStructuredSubFamilyViewMap(mapObj) {
            const safe = mapObj && typeof mapObj === 'object' ? mapObj : {};
            memoryStoreSetItem('ugap.vueMetier.structuredSubFamilyViews', JSON.stringify(safe));
        }

        function getFamilleFoundOrder() {
            try {
                const raw = memoryStoreGetItem('ugap.famille.foundOrder');
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed.map((x) => String(x || '').trim()).filter(Boolean) : [];
            } catch (_) {
                return [];
            }
        }

        function setFamilleFoundOrder(order) {
            const clean = Array.from(new Set(
                (Array.isArray(order) ? order : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean)
            ));
            memoryStoreSetItem('ugap.famille.foundOrder', JSON.stringify(clean));
        }

        function renderViewHeuristicRulesUi() {
            const list = document.getElementById('view-heur-list');
            if (!list) return;
            const rules = getViewHeuristicRules();
            list.innerHTML = rules.length === 0
                ? '<span style="color:#666;">Aucune règle vue métier pour le moment.</span>'
                : rules.map((r, idx) => `
                    <div class="view-heur-row" draggable="true" data-view-heur-index="${idx}" style="display:flex; justify-content:space-between; gap:8px; align-items:center; border-top:1px solid #eee; padding:8px 0; cursor:move;">
                        <div style="display:flex; align-items:flex-start; gap:8px;">
                            <span style="color:#999; font-size:14px; line-height:1.2;" title="Glisser pour réordonner">⋮⋮</span>
                            <label title="Utiliser cette vue dans les onglets structurés" style="display:flex; align-items:center; gap:6px; color:#334155; font-size:12px; cursor:pointer; margin-top:1px;">
                                <input type="checkbox" class="view-heur-enabled" data-view-label="${escapeHtml(String(r.viewLabel || ''))}" ${getStructuredSelectedViewLabels().includes(String(r.viewLabel || '').trim()) ? 'checked' : ''}>
                                Actif
                            </label>
                            <div>
                                <strong>${escapeHtml(r.viewLabel || 'Vue métier')}</strong>
                                <span style="color:#666;">(${escapeHtml(r.scope || 'all')})</span>
                                ${String(r.keywords || '').trim()
                                    ? `<div style="color:#666; font-size:12px;">${escapeHtml(r.keywords || '')}</div>`
                                    : ''}
                            </div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" class="btn btn-outline" data-edit-view-heur="${idx}">Modifier</button>
                            <button type="button" class="btn btn-outline" data-del-view-heur="${idx}">Supprimer</button>
                        </div>
                    </div>
                `).join('');

            const addBtn = document.getElementById('btn-add-view-heur');
            const cancelBtn = document.getElementById('btn-cancel-view-heur-edit');
            const editIdx = Number(addBtn?.getAttribute('data-edit-index'));
            if (cancelBtn) {
                cancelBtn.style.display = Number.isInteger(editIdx) && editIdx >= 0 ? '' : 'none';
            }

            document.querySelectorAll('[data-del-view-heur]').forEach((btnDel) => {
                btnDel.onclick = null;
                btnDel.addEventListener('click', () => {
                    const idx = Number(btnDel.getAttribute('data-del-view-heur'));
                    const all = getViewHeuristicRules();
                    if (!Number.isInteger(idx) || idx < 0 || idx >= all.length) return;
                    all.splice(idx, 1);
                    setViewHeuristicRules(all);
                    renderViewHeuristicRulesUi();
                });
            });
            document.querySelectorAll('[data-edit-view-heur]').forEach((btnEdit) => {
                btnEdit.onclick = null;
                btnEdit.addEventListener('click', () => {
                    const idx = Number(btnEdit.getAttribute('data-edit-view-heur'));
                    const all = getViewHeuristicRules();
                    const rule = all[idx];
                    if (!rule) return;
                    const labelEl = document.getElementById('view-heur-label');
                    const kwEl = document.getElementById('view-heur-keywords');
                    const scopeEl = document.getElementById('view-heur-scope');
                    if (labelEl) labelEl.value = rule.viewLabel || '';
                    if (kwEl) kwEl.value = rule.keywords || '';
                    if (scopeEl) scopeEl.value = rule.scope || 'all';
                    if (addBtn) addBtn.setAttribute('data-edit-index', String(idx));
                    if (cancelBtn) cancelBtn.style.display = '';
                });
            });
            document.querySelectorAll('.view-heur-row').forEach((row) => {
                row.onclick = null;
                row.addEventListener('click', (e) => {
                    if (e.target?.closest?.('button, input, select, textarea, a, label')) return;
                    const idx = Number(row.getAttribute('data-view-heur-index'));
                    if (!Number.isInteger(idx)) return;
                    const btnEdit = row.querySelector(`[data-edit-view-heur="${idx}"]`);
                    if (btnEdit) btnEdit.click();
                });
            });
            document.querySelectorAll('.view-heur-enabled').forEach((cb) => {
                cb.onchange = null;
                cb.addEventListener('change', () => {
                    const label = String(cb.getAttribute('data-view-label') || '').trim();
                    if (!label) return;
                    const selected = new Set(getStructuredSelectedViewLabels());
                    if (cb.checked) selected.add(label);
                    else selected.delete(label);
                    setStructuredSelectedViewLabels(Array.from(selected));
                    renderStructuredOptionsView();
                });
            });

            // Drag & drop de l'ordre des règles de vues métier.
            document.querySelectorAll('.view-heur-row').forEach((row) => {
                row.addEventListener('dragstart', (e) => {
                    row.style.opacity = '0.45';
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/view-heur-index', row.getAttribute('data-view-heur-index') || '');
                });
                row.addEventListener('dragend', () => {
                    row.style.opacity = '';
                    row.style.outline = '';
                });
                row.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    row.style.outline = '2px dashed #0d6efd';
                    row.style.outlineOffset = '-2px';
                });
                row.addEventListener('dragleave', () => {
                    row.style.outline = '';
                    row.style.outlineOffset = '';
                });
                row.addEventListener('drop', (e) => {
                    e.preventDefault();
                    row.style.outline = '';
                    row.style.outlineOffset = '';
                    const fromIdx = Number(e.dataTransfer.getData('text/view-heur-index'));
                    const toIdx = Number(row.getAttribute('data-view-heur-index'));
                    const all = getViewHeuristicRules();
                    if (!Number.isInteger(fromIdx) || !Number.isInteger(toIdx) || fromIdx < 0 || toIdx < 0 || fromIdx >= all.length || toIdx >= all.length || fromIdx === toIdx) return;
                    const [moved] = all.splice(fromIdx, 1);
                    all.splice(toIdx, 0, moved);
                    setViewHeuristicRules(all);
                    renderViewHeuristicRulesUi();
                });
            });
        }

        // Render subcategories
        // Afficher les résultats SANS effacer le streaming
        function displaySubCategoriesResults(categoryId, container) {
            if (!currentData || !currentData.categories) {
                return;
            }

            // Recharger les données puis afficher l'accordéon
            loadData(true).then(() => {
                renderSubCategoriesAccordion();
            });

            const category = currentData.categories.find(c => c.id === categoryId);
            if (!category) {
                return;
            }

            const subCategories = category.subCategories || [];
            console.log(`📊 Affichage de ${subCategories.length} sous-catégorie(s) pour "${category.name}"`);
            
            if (subCategories.length === 0) {
                return;
            }

            // Créer une zone de résultats en dessous du streaming
            let resultsDiv = container.querySelector('#subcategories-results');
            if (!resultsDiv) {
                resultsDiv = document.createElement('div');
                resultsDiv.id = 'subcategories-results';
                resultsDiv.style.marginTop = '20px';
                resultsDiv.style.padding = '20px';
                resultsDiv.style.background = 'white';
                resultsDiv.style.borderRadius = '8px';
                resultsDiv.style.border = '2px solid #28a745';
                container.appendChild(resultsDiv);
            }

            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="padding: 8px; border-bottom: 1px solid #eee;">Nom</th>
                        <th style="padding: 8px; border-bottom: 1px solid #eee;">Description</th>
                        <th style="padding: 8px; border-bottom: 1px solid #eee;">Options</th>
                        <th style="padding: 8px; border-bottom: 1px solid #eee;">Actions</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;

            const tbody = table.querySelector('tbody');
            subCategories.forEach(subCat => {
                const tr = document.createElement('tr');
                const optionCount = (subCat.optionIds || []).length;
                tr.style.cursor = 'pointer';
                tr.innerHTML = `
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${subCat.name}</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${subCat.description || '-'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><span class="badge">${optionCount} option(s)</span></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;" onclick="event.stopPropagation()">
                        <button class="btn btn-outline" onclick="editSubCategory('${categoryId}', '${subCat.id}')">Modifier</button>
                        <button class="btn btn-danger" onclick="deleteSubCategory('${categoryId}', '${subCat.id}')">Supprimer</button>
                    </td>
                `;
                // Attacher l'événement APRÈS avoir défini innerHTML
                tr.addEventListener('click', (e) => {
                    if (e.target.tagName !== 'BUTTON' && e.target.closest('td')?.getAttribute('onclick') !== 'event.stopPropagation()') {
                        showSubCategoryDetails(categoryId, subCat);
                    }
                });
                tbody.appendChild(tr);
            });

            resultsDiv.innerHTML = `
                <h3 style="margin: 0 0 15px 0; color: #28a745;">✅ ${subCategories.length} sous-catégorie(s) créée(s)</h3>
            `;
            resultsDiv.appendChild(table);
        }

        function getFamiliesForAssignationTab() {
            const rows = getFamilleValidatedFamilies();
            return (Array.isArray(rows) ? rows : []).map((f, idx) => ({
                ...f,
                __idx: idx,
                uniqueChoice: !!f?.uniqueChoice,
                optionIds: Array.isArray(f.optionIds) ? f.optionIds : []
            }));
        }

        function updateFamilyUniqueChoice(familyIndex, checked) {
            const idx = Number(familyIndex);
            if (!Number.isInteger(idx) || idx < 0) return;
            const list = getFamilleValidatedFamilies();
            if (!Array.isArray(list) || idx >= list.length) return;
            list[idx] = {
                ...(list[idx] || {}),
                uniqueChoice: !!checked
            };
            setFamilleValidatedFamilies(list);
            const mainActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab') || '';
            if (mainActiveTab === 'famille') renderExtractionInsights();
            else renderSubCategoriesAccordion();
        }

        function normalizeFamilyDecisionGroups(rawGroups) {
            const rows = Array.isArray(rawGroups) ? rawGroups : [];
            return rows
                .map((g, index) => {
                    const id = String(g?.id || `group_${index + 1}`).trim();
                    const label = String(g?.label || id || '').trim();
                    const rawType = String(g?.type || '').trim().toLowerCase();
                    const type = rawType === 'model' ? 'model' : (rawType === 'static' ? 'static' : 'option');
                    const decisionMode = String(g?.decisionMode || '').trim().toLowerCase() === 'multi_choice' ? 'multi_choice' : 'single_choice';
                    const pricingMode = (type === 'static')
                        ? 'addition'
                        : (String(g?.pricingMode || '').trim().toLowerCase() === 'minoration' ? 'minoration' : 'addition');
                    return id && label ? { id, label, type, decisionMode, pricingMode } : null;
                })
                .filter(Boolean);
        }

        function slugifyFamilyDecisionGroupId(input) {
            return String(input || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');
        }

        function generateUniqueFamilyDecisionGroupId(existingIds, labelHint = 'group') {
            const used = existingIds instanceof Set ? existingIds : new Set();
            const base = slugifyFamilyDecisionGroupId(labelHint) || 'group';
            let candidate = base;
            let i = 2;
            while (used.has(candidate)) {
                candidate = `${base}_${i}`;
                i += 1;
            }
            used.add(candidate);
            return candidate;
        }

        function getFamilyCreationIdPrefix() {
            const familyName = getFamilyCreationDisplayName();
            return slugifyFamilyDecisionGroupId(familyName) || 'famille';
        }

        function materializeTemplateDecisionGroups(templateId, groups) {
            const templateKey = String(templateId || '').trim();
            const familyPrefix = getFamilyCreationIdPrefix();
            const familyName = getFamilyCreationDisplayName();
            const minimalLabel = familyName || 'Famille';
            const used = new Set();
            return normalizeFamilyDecisionGroups(groups || []).map((g, idx) => {
                const isModel = String(g?.type || '') === 'model';
                const isMinimalOption = templateKey === 'minimal' && String(g?.type || '') === 'option';
                const baseHint = isMinimalOption
                    ? familyPrefix
                    : (isModel
                        ? `${familyPrefix}_model`
                        : `${familyPrefix}_${String(g?.id || g?.label || `group_${idx + 1}`)}`);
                return {
                    ...g,
                    ...(isMinimalOption ? { label: minimalLabel } : {}),
                    id: generateUniqueFamilyDecisionGroupId(used, baseHint)
                };
            });
        }

        function openFamilyEditionModal(savedIndex) {
            const idx = Number(savedIndex);
            const list = getFamilleValidatedFamilies();
            if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
            const family = list[idx] || {};
            const familyLabel = String(family?.familyLabel || '').trim() || 'Famille';
            const objectName = String(family?.objectName || '').trim();
            const decisionGroups = normalizeFamilyDecisionGroups(family?.decisionGroups);
            const modalId = 'family-edition-modal';
            document.getElementById(modalId)?.remove();
            const modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal active';
            const rowsHtml = decisionGroups.map((g, rowIdx) => {
                return `
                <tr>
                    <td style="padding:8px; border-bottom:1px solid #eee;">
                        <input id="family-group-id-${rowIdx}" value="${escapeHtml(g.id)}" readonly tabindex="-1" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; background:#f8f9fa;">
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">
                        <input id="family-group-label-${rowIdx}" value="${escapeHtml(g.label)}" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;">
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">
                        <select id="family-group-type-${rowIdx}" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;">
                            <option value="model" ${g.type === 'model' ? 'selected' : ''}>model</option>
                            <option value="static" ${g.type === 'static' ? 'selected' : ''}>static</option>
                            <option value="option" ${g.type === 'option' ? 'selected' : ''}>option</option>
                        </select>
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">
                        <select id="family-group-decision-${rowIdx}" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;">
                            <option value="single_choice" ${g.decisionMode === 'single_choice' ? 'selected' : ''}>single_choice</option>
                            <option value="multi_choice" ${g.decisionMode === 'multi_choice' ? 'selected' : ''}>multi_choice</option>
                        </select>
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">
                        <select id="family-group-pricing-${rowIdx}" ${g.type === 'static' ? 'disabled' : ''} style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; ${g.type === 'static' ? 'background:#f8f9fa;' : ''}">
                            <option value="addition" ${g.pricingMode === 'addition' ? 'selected' : ''}>addition</option>
                            <option value="minoration" ${g.pricingMode === 'minoration' ? 'selected' : ''}>minoration</option>
                        </select>
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                        <button type="button" class="btn btn-outline" onclick="removeFamilyDecisionGroupRow(${idx}, ${rowIdx})">Suppr.</button>
                    </td>
                </tr>
            `;
            }).join('');
            modal.innerHTML = `
                <div class="modal-content" style="max-width:1000px;">
                    <div class="modal-header">
                        <h2 style="font-size:18px;">Edition famille: ${escapeHtml(familyLabel)}</h2>
                        <button type="button" class="btn btn-outline" onclick="closeFamilyEditionModal()">Fermer</button>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:6px; font-weight:600;">Nom objet (cle recherche)</label>
                        <input id="family-object-name-input" value="${escapeHtml(objectName)}" placeholder="Ex: moteur" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                            <strong>Decision groups</strong>
                            <button type="button" class="btn btn-outline" onclick="addFamilyDecisionGroupRow(${idx})">Ajouter group</button>
                        </div>
                        <table style="width:100%; border-collapse:collapse; font-size:13px;">
                            <thead>
                                <tr style="background:#f8f9fa;">
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">id</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">label</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">type</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">decisionMode</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">pricingMode</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:center;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="family-decision-groups-body">
                                ${rowsHtml || '<tr><td colspan="6" style="padding:10px; color:#666;">Aucun group pour le moment.</td></tr>'}
                            </tbody>
                        </table>
                        <div style="display:flex; justify-content:flex-end; margin-top:14px; gap:8px;">
                            <button type="button" class="btn btn-outline" onclick="closeFamilyEditionModal()">Annuler</button>
                            <button type="button" class="btn btn-success" onclick="saveFamilyEditionModal(${idx})">Enregistrer</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target.id === modalId) closeFamilyEditionModal();
            });
        }

        function closeFamilyEditionModal() {
            document.getElementById('family-edition-modal')?.remove();
        }

        function addFamilyDecisionGroupRow(savedIndex) {
            const idx = Number(savedIndex);
            const list = getFamilleValidatedFamilies();
            if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
            const family = { ...(list[idx] || {}) };
            const groups = normalizeFamilyDecisionGroups(family.decisionGroups);
            const existingIds = new Set(groups.map((g) => String(g?.id || '').trim()).filter(Boolean));
            groups.push({
                id: generateUniqueFamilyDecisionGroupId(existingIds, `group_${groups.length + 1}`),
                label: `Group ${groups.length + 1}`,
                type: 'option',
                decisionMode: 'multi_choice',
                pricingMode: 'addition'
            });
            family.decisionGroups = groups;
            list[idx] = family;
            setFamilleValidatedFamilies(list);
            openFamilyEditionModal(idx);
        }

        function removeFamilyDecisionGroupRow(savedIndex, rowIndex) {
            const idx = Number(savedIndex);
            const rIdx = Number(rowIndex);
            const list = getFamilleValidatedFamilies();
            if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
            const family = { ...(list[idx] || {}) };
            const groups = normalizeFamilyDecisionGroups(family.decisionGroups);
            if (!Number.isInteger(rIdx) || rIdx < 0 || rIdx >= groups.length) return;
            groups.splice(rIdx, 1);
            family.decisionGroups = groups;
            list[idx] = family;
            setFamilleValidatedFamilies(list);
            openFamilyEditionModal(idx);
        }

        function saveFamilyEditionModal(savedIndex) {
            const idx = Number(savedIndex);
            const list = getFamilleValidatedFamilies();
            if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
            const family = { ...(list[idx] || {}) };
            const objectName = String(document.getElementById('family-object-name-input')?.value || '').trim();
            const groups = normalizeFamilyDecisionGroups(family.decisionGroups);
            const usedIds = new Set();
            const nextGroups = groups.map((currentGroup, rowIdx) => {
                const rawId = String(document.getElementById(`family-group-id-${rowIdx}`)?.value || '').trim();
                const label = String(document.getElementById(`family-group-label-${rowIdx}`)?.value || '').trim();
                const typeRaw = String(document.getElementById(`family-group-type-${rowIdx}`)?.value || 'option').trim().toLowerCase();
                const type = typeRaw === 'model' ? 'model' : (typeRaw === 'static' ? 'static' : 'option');
                const decisionMode = String(document.getElementById(`family-group-decision-${rowIdx}`)?.value || 'single_choice').trim() === 'multi_choice' ? 'multi_choice' : 'single_choice';
                const pricingModeRaw = String(document.getElementById(`family-group-pricing-${rowIdx}`)?.value || 'addition').trim();
                const pricingMode = pricingModeRaw === 'minoration' ? 'minoration' : 'addition';
                const nextLabel = label || (type === 'model' ? 'Modèle' : (type === 'static' ? 'Statique' : 'Option'));
                const id = (!rawId || usedIds.has(rawId))
                    ? generateUniqueFamilyDecisionGroupId(usedIds, nextLabel)
                    : (usedIds.add(rawId), rawId);
                return {
                    id,
                    label: nextLabel,
                    type,
                    decisionMode,
                    pricingMode: (type === 'static') ? 'addition' : pricingMode
                };
            }).filter(Boolean);
            family.objectName = objectName;
            family.decisionGroups = nextGroups;
            list[idx] = family;
            setFamilleValidatedFamilies(list);
            closeFamilyEditionModal();
            renderExtractionInsights();
            showAlert('Famille mise a jour.', 'success');
        }

        function createValidatedFamilyFromBackofficeForm() {
            const familyLabel = String(document.getElementById('new-family-label-input')?.value || '').trim();
            const objectName = String(document.getElementById('new-family-object-input')?.value || '').trim();
            if (!familyLabel) {
                showAlert('Nom de famille requis.', 'warning');
                return;
            }
            const list = Array.isArray(getFamilleValidatedFamilies()) ? getFamilleValidatedFamilies().slice() : [];
            const exists = list.some((f) => String(f?.familyLabel || '').trim().toLowerCase() === familyLabel.toLowerCase());
            if (exists) {
                showAlert('Cette famille existe deja.', 'info');
                return;
            }
            list.push({
                familyLabel,
                objectName,
                optionIds: [],
                decisionGroups: getPendingFamilyCreationGroups()
            });
            setFamilleValidatedFamilies(list);
            const labelEl = document.getElementById('new-family-label-input');
            const objectEl = document.getElementById('new-family-object-input');
            if (labelEl) labelEl.value = '';
            if (objectEl) objectEl.value = '';
            resetFamilyCreationTemplate(true);
            renderExtractionInsights();
            showAlert('Famille creee.', 'success');
        }

        function deleteValidatedFamilyByIndex(savedIndex) {
            const idx = Number(savedIndex);
            const list = Array.isArray(getFamilleValidatedFamilies()) ? getFamilleValidatedFamilies().slice() : [];
            if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
            const label = String(list[idx]?.familyLabel || '').trim() || 'cette famille';
            if (!confirm(`Supprimer ${label} ?`)) return;
            list.splice(idx, 1);
            setFamilleValidatedFamilies(list);
            renderExtractionInsights();
            showAlert('Famille supprimee.', 'success');
        }

        function deleteAllValidatedFamilies() {
            const list = Array.isArray(getFamilleValidatedFamilies()) ? getFamilleValidatedFamilies() : [];
            if (!list.length) {
                showAlert('Aucune famille a supprimer.', 'info');
                return;
            }
            if (!confirm(`Supprimer toutes les familles (${list.length}) ?`)) return;
            setFamilleValidatedFamilies([]);
            renderExtractionInsights();
            showAlert('Toutes les familles ont ete supprimees.', 'success');
        }

        /** Gabarits intégrés (les libellés des lignes `model` sont recalculés : Modèle + nom de famille saisi). */
        function getFamilyDecisionGroupTemplates() {
            return [
                {
                    id: 'minimal',
                    title: 'Minimal',
                    description: 'Un seul groupe "Tout" (option multi_choice en addition), sans modèle.',
                    suggestedFamilyLabel: '',
                    suggestedObjectName: '',
                    decisionGroups: [
                        { id: 'tout', label: 'Tout', type: 'option', decisionMode: 'multi_choice', pricingMode: 'addition' }
                    ]
                },
                {
                    id: 'standard',
                    title: 'Standard',
                    description: 'Modèle (lié au nom de famille) + option catalogue (addition).',
                    suggestedFamilyLabel: '',
                    suggestedObjectName: '',
                    decisionGroups: [
                        { id: 'model', label: '', type: 'model', decisionMode: 'single_choice', pricingMode: 'addition' },
                        { id: 'option', label: 'Option catalogue', type: 'option', decisionMode: 'single_choice', pricingMode: 'addition' }
                    ]
                },
                {
                    id: 'minoration',
                    title: 'Avec minoration',
                    description: 'Modèle (lié au nom de famille) + ligne catalogue en minoration.',
                    suggestedFamilyLabel: '',
                    suggestedObjectName: '',
                    decisionGroups: [
                        { id: 'model', label: '', type: 'model', decisionMode: 'single_choice', pricingMode: 'addition' },
                        { id: 'ligne', label: 'Ligne catalogue', type: 'option', decisionMode: 'single_choice', pricingMode: 'minoration' }
                    ]
                },
                {
                    id: 'variantes',
                    title: 'Variantes',
                    description: 'Modèle (lié au nom de famille) + variante + compléments multi-choix.',
                    suggestedFamilyLabel: '',
                    suggestedObjectName: '',
                    decisionGroups: [
                        { id: 'model', label: '', type: 'model', decisionMode: 'single_choice', pricingMode: 'addition' },
                        { id: 'variante', label: 'Variante', type: 'option', decisionMode: 'single_choice', pricingMode: 'addition' },
                        { id: 'complements', label: 'Compléments', type: 'option', decisionMode: 'multi_choice', pricingMode: 'addition' }
                    ]
                },
                {
                    id: 'equipement',
                    title: 'Équipement + options',
                    description: 'Modèle (lié au nom de famille) + choix principal + options associées.',
                    suggestedFamilyLabel: '',
                    suggestedObjectName: '',
                    decisionGroups: [
                        { id: 'model', label: '', type: 'model', decisionMode: 'single_choice', pricingMode: 'addition' },
                        { id: 'principal', label: 'Choix principal', type: 'option', decisionMode: 'single_choice', pricingMode: 'addition' },
                        { id: 'options', label: 'Options associées', type: 'option', decisionMode: 'multi_choice', pricingMode: 'addition' }
                    ]
                }
            ];
        }

        function getFamilyCreationDisplayName() {
            return String(document.getElementById('new-family-label-input')?.value || '').trim();
        }

        function onNewFamilyLabelInputChange() {
            refreshFamilyTemplatePreview();
        }

        function resolveModelLabelsForFamilyCreationGroups(groups) {
            const name = getFamilyCreationDisplayName();
            const suffix = name || '(nom famille)';
            return (Array.isArray(groups) ? groups : []).map((g) => {
                const row = { ...(g || {}) };
                if (String(row.type || '').toLowerCase() === 'model') {
                    row.label = `Modèle ${suffix}`;
                }
                return row;
            });
        }

        function getDefaultFamilyCreationDecisionGroups() {
            return [
                { id: 'model', label: '', type: 'model', decisionMode: 'single_choice', pricingMode: 'addition' },
                { id: 'option', label: 'Option', type: 'option', decisionMode: 'multi_choice', pricingMode: 'addition' }
            ];
        }

        function getCurrentTemplateBaseGroups() {
            const templateRaw = window.__pendingFamilyTemplateGroups;
            if (Array.isArray(templateRaw) && templateRaw.length) {
                return normalizeFamilyDecisionGroups(templateRaw);
            }
            return normalizeFamilyDecisionGroups(getDefaultFamilyCreationDecisionGroups());
        }

        function getPendingFamilyRemovedGroupIdsSet() {
            const arr = Array.isArray(window.__pendingFamilyRemovedGroupIds) ? window.__pendingFamilyRemovedGroupIds : [];
            return new Set(arr.map((x) => String(x || '').trim()).filter(Boolean));
        }

        function setPendingFamilyRemovedGroupIdsSet(set) {
            window.__pendingFamilyRemovedGroupIds = Array.from(set || []).filter(Boolean);
        }

        function getPendingFamilyPersonalizedGroups() {
            return Array.isArray(window.__pendingFamilyAddedGroups)
                ? normalizeFamilyDecisionGroups(window.__pendingFamilyAddedGroups)
                : [];
        }

        function setPendingFamilyPersonalizedGroups(groups) {
            window.__pendingFamilyAddedGroups = normalizeFamilyDecisionGroups(groups || []);
        }

        function getPendingFamilyCreationGroupsWithMeta() {
            const removedIds = getPendingFamilyRemovedGroupIdsSet();
            const templateBase = getCurrentTemplateBaseGroups().filter((g) => !removedIds.has(String(g.id || '').trim()));
            const personalized = getPendingFamilyPersonalizedGroups();
            const personalizedById = new Map(personalized.map((g) => [String(g.id || '').trim(), g]));
            const merged = [];

            templateBase.forEach((g) => {
                const gid = String(g.id || '').trim();
                if (personalizedById.has(gid)) {
                    merged.push({ ...personalizedById.get(gid), __source: 'personalized' });
                    personalizedById.delete(gid);
                } else {
                    merged.push({ ...g, __source: 'template' });
                }
            });

            personalizedById.forEach((g) => merged.push({ ...g, __source: 'personalized' }));
            return merged;
        }

        function getPendingFamilyCreationGroups() {
            const merged = getPendingFamilyCreationGroupsWithMeta().map((g) => ({
                id: g.id,
                label: g.label,
                type: g.type,
                decisionMode: g.decisionMode,
                pricingMode: g.pricingMode
            }));
            return normalizeFamilyDecisionGroups(resolveModelLabelsForFamilyCreationGroups(merged));
        }

        function updatePendingFamilyCreationGroupField(groupId, field, value) {
            const gid = String(groupId || '').trim();
            const fld = String(field || '').trim();
            if (!gid || !fld) return;
            const allowed = new Set(['id', 'label', 'type', 'decisionMode', 'pricingMode']);
            if (!allowed.has(fld)) return;

            const currentPersonalized = getPendingFamilyPersonalizedGroups();
            const idxPersonalized = currentPersonalized.findIndex((g) => String(g.id || '').trim() === gid);
            let row;
            if (idxPersonalized >= 0) {
                row = { ...currentPersonalized[idxPersonalized] };
            } else {
                const base = getCurrentTemplateBaseGroups().find((g) => String(g.id || '').trim() === gid);
                if (!base) return;
                row = { ...base };
            }

            if (fld === 'type') {
                const t = String(value || '').trim().toLowerCase();
                row.type = t === 'model' ? 'model' : (t === 'static' ? 'static' : 'option');
                if (row.type === 'static') row.pricingMode = 'addition';
            } else if (fld === 'decisionMode') {
                row.decisionMode = String(value || '').trim() === 'multi_choice' ? 'multi_choice' : 'single_choice';
            } else if (fld === 'pricingMode') {
                row.pricingMode = String(value || '').trim() === 'minoration' ? 'minoration' : 'addition';
            } else if (fld === 'id') {
                const nextId = String(value || '').trim();
                if (!nextId) return;
                row.id = nextId;
            } else {
                row[fld] = String(value || '').trim();
            }

            if (String(row.type || '') === 'model' || String(row.type || '') === 'static') {
                row.pricingMode = 'addition';
            }
            if (!String(row.id || '').trim() || !String(row.label || '').trim()) return;

            if (idxPersonalized >= 0) {
                currentPersonalized[idxPersonalized] = row;
            } else {
                currentPersonalized.push(row);
            }
            setPendingFamilyPersonalizedGroups(currentPersonalized);
            refreshFamilyTemplatePreview();
        }

        function removePendingFamilyCreationGroup(groupId) {
            const gid = String(groupId || '').trim();
            if (!gid) return;
            const currentPersonalized = getPendingFamilyPersonalizedGroups();
            const nextPersonalized = currentPersonalized.filter((g) => String(g.id || '').trim() !== gid);
            if (nextPersonalized.length !== currentPersonalized.length) {
                setPendingFamilyPersonalizedGroups(nextPersonalized);
                refreshFamilyTemplatePreview();
                return;
            }
            const removedIds = getPendingFamilyRemovedGroupIdsSet();
            removedIds.add(gid);
            setPendingFamilyRemovedGroupIdsSet(removedIds);
            refreshFamilyTemplatePreview();
        }

        /** Ajoute une ligne option au groupement en cours (sans persistance navigateur). */
        function addPendingFamilyCreationGroupRow() {
            const personalized = getPendingFamilyPersonalizedGroups();
            const allCurrentIds = new Set(
                getPendingFamilyCreationGroupsWithMeta()
                    .map((g) => String(g?.id || '').trim())
                    .filter(Boolean)
            );
            const uid = generateUniqueFamilyDecisionGroupId(allCurrentIds, 'groupe');
            personalized.push({
                id: uid,
                label: 'Nouveau groupe',
                type: 'option',
                decisionMode: 'multi_choice',
                pricingMode: 'addition'
            });
            setPendingFamilyPersonalizedGroups(personalized);
            refreshFamilyTemplatePreview();
        }

        function refreshFamilyTemplatePreview() {
            const el = document.getElementById('family-template-preview');
            if (!el) return;
            const groupsWithMeta = getPendingFamilyCreationGroupsWithMeta();
            const groups = normalizeFamilyDecisionGroups(resolveModelLabelsForFamilyCreationGroups(groupsWithMeta.map((g) => ({
                id: g.id,
                label: g.label,
                type: g.type,
                decisionMode: g.decisionMode,
                pricingMode: g.pricingMode
            }))));
            const tplId = String(window.__pendingFamilyTemplateId || '').trim();
            const tpl = tplId ? getFamilyDecisionGroupTemplates().find((t) => t.id === tplId) : null;
            const title = tpl ? tpl.title : 'Par défaut';
            const rowsHtml = groups.length
                ? groups.map((g, rowIdx) => {
                    const meta = groupsWithMeta[rowIdx] || {};
                    const source = String(meta.__source || 'template');
                    const sourceBadge = source === 'personalized'
                        ? '<span style="font-size:10px; color:#7c3aed; background:#f3e8ff; border:1px solid #e9d5ff; border-radius:999px; padding:2px 6px; margin-left:6px;">personnalisé</span>'
                        : '<span style="font-size:10px; color:#64748b; background:#f8fafc; border:1px solid #e2e8f0; border-radius:999px; padding:2px 6px; margin-left:6px;">template</span>';
                    const gid = escapeHtml(String(g.id || ''));
                    return `
                <tr>
                    <td style="padding:8px; border-bottom:1px solid #eee;">
                        <input value="${escapeHtml(g.id)}" aria-label="id" readonly tabindex="-1" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; background:#f8f9fa;">
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">
                        <div style="display:flex; align-items:center;">
                            <input value="${escapeHtml(g.label)}" aria-label="label" onchange="updatePendingFamilyCreationGroupField('${gid}', 'label', this.value)" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; background:#fff;">
                            ${sourceBadge}
                        </div>
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">
                        <select aria-label="type" onchange="updatePendingFamilyCreationGroupField('${gid}', 'type', this.value)" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; background:#fff;">
                            <option value="model" ${g.type === 'model' ? 'selected' : ''}>model</option>
                            <option value="static" ${g.type === 'static' ? 'selected' : ''}>static</option>
                            <option value="option" ${g.type === 'option' ? 'selected' : ''}>option</option>
                        </select>
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">
                        <select aria-label="decisionMode" onchange="updatePendingFamilyCreationGroupField('${gid}', 'decisionMode', this.value)" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; background:#fff;">
                            <option value="single_choice" ${g.decisionMode === 'single_choice' ? 'selected' : ''}>single_choice</option>
                            <option value="multi_choice" ${g.decisionMode === 'multi_choice' ? 'selected' : ''}>multi_choice</option>
                        </select>
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">
                        <select aria-label="pricingMode" onchange="updatePendingFamilyCreationGroupField('${gid}', 'pricingMode', this.value)" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; background:#fff;" ${g.type === 'static' ? 'disabled' : ''}>
                            <option value="addition" ${g.pricingMode === 'addition' ? 'selected' : ''}>addition</option>
                            <option value="minoration" ${g.pricingMode === 'minoration' ? 'selected' : ''}>minoration</option>
                        </select>
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                        <button type="button" class="btn btn-outline" style="font-size:11px; padding:4px 8px;" onclick="removePendingFamilyCreationGroup('${gid}')">Supprimer</button>
                    </td>
                </tr>
            `;
                }).join('')
                : '<tr><td colspan="6" style="padding:10px; color:#666;">Aucun group pour le moment.</td></tr>';
            el.innerHTML = `
                <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:8px; gap:10px; padding:10px 12px 0;">
                    <div>
                        <strong style="font-size:13px; color:#334155;">Aperçu des decision groups</strong>
                        <div style="font-size:12px; color:#64748b; margin-top:2px;">Même présentation qu’après <strong>Editer</strong> (ici lecture seule). Gabarit actif : <strong>${escapeHtml(title)}</strong>.</div>
                    </div>
                </div>
                <div style="padding:0 12px 4px;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">id</th>
                            <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">label</th>
                            <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">type</th>
                            <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">decisionMode</th>
                            <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">pricingMode</th>
                            <th style="padding:8px; border-bottom:1px solid #eee; text-align:center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                </div>
                <div style="display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:0; padding:10px 12px; border-top:1px solid #e2e8f0; background:#fff; border-radius:0 0 6px 6px;">
                    <button type="button" class="btn btn-primary" style="font-size:12px;" onclick="addPendingFamilyCreationGroupRow()" title="Ajoute une ligne option à la fin du tableau">+ Ajouter un groupe</button>
                    <span style="font-size:12px; color:#64748b; line-height:1.45;">Ajoute une ligne <strong>option</strong> sous les groupes ci-dessus. Id, libellés et modes se peaufinent après <strong>Creer famille</strong> puis <strong>Editer</strong>.</span>
                </div>
            `;
        }

        function applyFamilyCreationTemplate(templateId) {
            const id = String(templateId || '').trim();
            const tpl = getFamilyDecisionGroupTemplates().find((t) => t.id === id);
            if (!tpl) return;
            window.__pendingFamilyTemplateId = id;
            window.__pendingFamilyTemplateGroups = materializeTemplateDecisionGroups(id, tpl.decisionGroups || []);
            const lab = document.getElementById('new-family-label-input');
            const obj = document.getElementById('new-family-object-input');
            if (tpl.suggestedFamilyLabel && lab) lab.value = String(tpl.suggestedFamilyLabel);
            if (tpl.suggestedObjectName && obj) obj.value = String(tpl.suggestedObjectName);
            refreshFamilyTemplatePreview();
        }

        function resetFamilyCreationTemplate(clearAddedGroups = false) {
            window.__pendingFamilyTemplateId = null;
            window.__pendingFamilyTemplateGroups = null;
            if (clearAddedGroups) {
                window.__pendingFamilyAddedGroups = null;
                window.__pendingFamilyRemovedGroupIds = null;
            }
            refreshFamilyTemplatePreview();
        }

        function renderFamilyDecisionGroupsBackofficePanel() {
            const families = getFamilleValidatedFamilies();
            const familiesCount = Array.isArray(families) ? families.length : 0;
            const templateButtonsHtml = getFamilyDecisionGroupTemplates().map((t) => {
                const tid = String(t.id || '').trim();
                return `<button type="button" class="btn btn-outline" style="font-size:12px; padding:6px 12px; white-space:nowrap;" onclick="applyFamilyCreationTemplate('${escapeHtml(tid)}')" title="${escapeHtml(String(t.description || ''))}">${escapeHtml(String(t.title || tid))}</button>`;
            }).join('');
            const rows = (Array.isArray(families) ? families : []).map((f, idx) => {
                const groups = normalizeFamilyDecisionGroups(f?.decisionGroups);
                const groupsTxt = groups.length
                    ? groups.map((g) => `${g.type}:${g.id}`).join(', ')
                    : 'Aucun';
                return `
                    <tr ondblclick="openFamilyEditionModal(${idx})" title="Double-clic pour editer">
                        <td style="padding:8px; border-bottom:1px solid #eee;"><strong>${escapeHtml(String(f?.familyLabel || 'Famille'))}</strong></td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(String(f?.objectName || '').trim() || '—')}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(groupsTxt)}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                <button type="button" class="btn btn-outline" onclick="openFamilyEditionModal(${idx})">Editer</button>
                                <button type="button" class="btn btn-outline" onclick="deleteValidatedFamilyByIndex(${idx})">Supprimer</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
            return `
                <div id="family-decision-groups-backoffice-panel" style="margin-top:14px; border:1px solid #e5e7eb; border-radius:8px; background:#fff;">
                    <div style="padding:10px 12px; border-bottom:1px solid #e5e7eb; font-weight:600;">Familles valides (object + decision groups)</div>
                    <div style="padding:10px 12px; border-bottom:1px solid #eef2f7; background:#f9fafb;">
                        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;">
                            <div style="min-width:240px; flex:1;">
                                <label style="display:block; font-size:12px; color:#555; margin-bottom:4px;">Nom famille</label>
                                <input id="new-family-label-input" type="text" placeholder="Ex: Moteur" oninput="onNewFamilyLabelInputChange()" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                            </div>
                            <div style="min-width:240px; flex:1;">
                                <label style="display:block; font-size:12px; color:#555; margin-bottom:4px;">Nom objet (cle recherche)</label>
                                <input id="new-family-object-input" type="text" placeholder="Ex: moteur" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                            </div>
                            <button type="button" class="btn btn-success" onclick="createValidatedFamilyFromBackofficeForm()">Creer famille</button>
                            <button type="button" class="btn btn-outline" onclick="deleteAllValidatedFamilies()" ${familiesCount === 0 ? 'disabled' : ''}>Supprimer toutes les familles</button>
                        </div>
                    </div>
                    <div style="padding:10px 12px; border-bottom:1px solid #eef2f7; background:#fff;">
                        <div style="font-weight:600; font-size:13px; color:#334155; margin-bottom:4px;">1. Gabarits</div>
                        <div style="font-size:12px; color:#64748b; margin-bottom:10px; line-height:1.45;">
                            Choisissez un <strong>jeu de decision groups</strong> prédéfini, ou <strong>Réinitialiser</strong> pour repartir sur modèle + option. Les lignes <strong>model</strong> affichent <strong>Modèle</strong> + le <strong>nom famille</strong> du formulaire (ou &laquo; (nom famille) &raquo; si vide).
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                            ${templateButtonsHtml}
                            <button type="button" class="btn btn-outline" style="font-size:12px;" onclick="resetFamilyCreationTemplate()" title="Revenir au groupement minimal (modèle + option)">Réinitialiser</button>
                        </div>
                    </div>
                    <div style="padding:10px 12px; border-bottom:1px solid #eef2f7; background:#fafbfc;">
                        <div style="font-weight:600; font-size:13px; color:#334155; margin-bottom:4px;">2. Aperçu et groupes supplémentaires</div>
                        <div style="font-size:12px; color:#64748b; margin-bottom:10px; line-height:1.45;">
                            Vérifiez le tableau ci-dessous. Le bouton <strong>+ Ajouter un groupe</strong> se trouve <strong>sous la dernière ligne</strong> : il prolonge la liste pour cette création uniquement. Les groupes ajoutés restent en place même si vous changez de gabarit (réglages fins dans <strong>Editer</strong> après enregistrement).
                        </div>
                        <div id="family-template-preview" style="padding:0; overflow:hidden; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; min-height:48px;"></div>
                    </div>
                    ${(Array.isArray(families) && families.length > 0)
                        ? `<table style="width:100%; border-collapse:collapse; font-size:13px;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Famille</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Nom objet</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Decision groups</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Action</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>`
                        : '<div style="padding:10px 12px; color:#6b7280;">Aucune famille validee pour le moment.</div>'
                    }
                </div>
            `;
        }

        function getFamilleRelations() {
            try {
                const raw = memoryStoreGetItem('ugap.famille.relations');
                const parsed = raw ? JSON.parse(raw) : {};
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (_) {
                return {};
            }
        }

        function setFamilleRelations(relations) {
            try {
                memoryStoreSetItem('ugap.famille.relations', JSON.stringify(relations || {}));
            } catch (_) {}
        }

        function addFamilleRelation(sourceFamilyLabel, targetFamilyLabel) {
            const source = String(sourceFamilyLabel || '').trim();
            const target = String(targetFamilyLabel || '').trim();
            if (!source || !target || source === target) return false;
            const relations = getFamilleRelations();
            const current = new Set(Array.isArray(relations[source]) ? relations[source].map((x) => String(x).trim()).filter(Boolean) : []);
            current.add(target);
            relations[source] = Array.from(current);
            setFamilleRelations(relations);
            return true;
        }

        function slugifyBusinessViewLabel(label) {
            return String(label || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .trim();
        }

        function getBusinessViewsForAssignationTab() {
            const rules = Array.isArray(getViewHeuristicRules()) ? getViewHeuristicRules() : [];
            const ruleMap = new Map();
            rules.forEach((r) => {
                const label = String(r?.viewLabel || '').trim();
                if (!label) return;
                const key = slugifyBusinessViewLabel(label) || label.toLowerCase();
                if (!ruleMap.has(key)) {
                    ruleMap.set(key, {
                        id: `rule:${key}`,
                        label,
                        source: 'rule',
                        keywords: []
                    });
                }
                const row = ruleMap.get(key);
                const rawKeywords = String(r?.keywords || '')
                    .split(/[\n,;|]+/g)
                    .map((x) => String(x || '').trim())
                    .filter(Boolean);
                row.keywords.push(...rawKeywords);
            });
            const ruleViews = Array.from(ruleMap.values()).map((v) => ({
                ...v,
                keywords: Array.from(new Set(v.keywords)).join(', ')
            }));
            return ruleViews;
        }

        function assignFamilyToBusinessView(savedIndex, viewId) {
            const idx = Number(savedIndex);
            const list = getFamilleValidatedFamilies();
            if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
            const mainActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab') || '';
            if (!String(viewId || '').trim()) {
                list[idx].businessViewId = '';
                list[idx].businessViewLabel = '';
                setFamilleValidatedFamilies(list);
                if (mainActiveTab === 'famille') renderExtractionInsights();
                else renderSubCategoriesAccordion();
                return;
            }
            const target = getBusinessViewsForAssignationTab().find((v) => String(v.id) === String(viewId));
            if (!target) {
                showAlert('Vue métier introuvable.', 'error');
                return;
            }
            list[idx].businessViewId = String(target.id || '');
            list[idx].businessViewLabel = String(target.label || '');
            setFamilleValidatedFamilies(list);
            if (mainActiveTab === 'famille') renderExtractionInsights();
            else renderSubCategoriesAccordion();
        }

        function assignFamilyTreeToBusinessView(rootFamilyLabel, viewId) {
            const root = String(rootFamilyLabel || '').trim();
            if (!root) return;
            const target = getBusinessViewsForAssignationTab().find((v) => String(v.id || '') === String(viewId || ''));
            if (!target) {
                showAlert('Vue métier introuvable.', 'error');
                return;
            }
            const list = getFamilleValidatedFamilies();
            if (!Array.isArray(list) || list.length === 0) return;
            const prefix = `${root} / `;
            let changed = 0;
            list.forEach((f) => {
                const label = String(f?.familyLabel || '').trim();
                if (!label) return;
                if (label === root || label.startsWith(prefix)) {
                    f.businessViewId = String(target.id || '');
                    f.businessViewLabel = String(target.label || '');
                    changed += 1;
                }
            });
            if (changed === 0) return;
            setFamilleValidatedFamilies(list);
            showAlert(`${changed} famille(s) assignée(s) à "${target.label}".`, 'success');
            const mainActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab') || '';
            if (mainActiveTab === 'famille') renderExtractionInsights();
            else renderSubCategoriesAccordion();
        }

        async function autoAssignFamiliesToBusinessViews() {
            const list = getFamilleValidatedFamilies();
            const views = getBusinessViewsForAssignationTab();
            if (!Array.isArray(list) || list.length === 0) {
                showAlert('Aucune famille validée à assigner.', 'warning');
                return;
            }
            if (!Array.isArray(views) || views.length === 0) {
                showAlert('Aucune vue métier disponible pour l’assignation IA.', 'warning');
                return;
            }

            const familiesPayload = list.map((f) => ({
                familyLabel: String(f?.familyLabel || '').trim(),
                assignation: String(f?.assignation || '').trim(),
                subFamily: String(f?.subFamilyLabel || f?.subFamily || '').trim(),
                optionIds: Array.isArray(f?.optionIds) ? f.optionIds : [],
                optionLabels: f?.optionLabels && typeof f.optionLabels === 'object' ? f.optionLabels : {}
            }));
            const viewsPayload = views.map((v) => ({
                id: String(v.id || '').trim(),
                label: String(v.label || '').trim(),
                keywords: String(v.keywords || '').trim()
            }));

            const runBtn = document.getElementById('btn-detect-subcategories');
            const defaultBtnText = runBtn?.dataset.defaultLabel || runBtn?.textContent || '🤖 Assigner automatiquement les familles';
            if (runBtn && !runBtn.dataset.defaultLabel) {
                runBtn.dataset.defaultLabel = defaultBtnText;
            }
            const setBtnProgress = (done, total) => {
                if (!runBtn) return;
                runBtn.textContent = `⏳ Traitement en cours (${done}/${total})`;
            };
            const setBtnIdle = () => {
                if (!runBtn) return;
                runBtn.textContent = defaultBtnText;
            };

            try {
                if (runBtn) runBtn.disabled = true;
                const total = familiesPayload.length;
                let done = 0;
                setBtnProgress(done, total);
                showAlert(`Assignation IA en cours (${done}/${total})...`, 'info');

                const assignments = [];
                for (let i = 0; i < familiesPayload.length; i += 1) {
                    const oneFamily = familiesPayload[i];
                    const result = await apiCall('/familles/assign-views-ia', {
                        method: 'POST',
                        body: JSON.stringify({
                            families: [oneFamily],
                            businessViews: viewsPayload
                        })
                    });
                    const oneAssignment = Array.isArray(result?.data?.assignments) ? result.data.assignments[0] : null;
                    if (oneAssignment) {
                        assignments.push({
                            ...oneAssignment,
                            familyIndex: i
                        });
                    } else {
                        assignments.push({
                            familyIndex: i,
                            familyLabel: oneFamily.familyLabel,
                            businessViewId: '',
                            businessViewLabel: '',
                            confidence: null,
                            reason: 'Aucune réponse IA',
                            source: 'fallback'
                        });
                    }
                    done += 1;
                    setBtnProgress(done, total);
                }

                if (assignments.length === 0) {
                    showAlert('Aucun résultat IA reçu.', 'warning');
                    return;
                }

                const byIndex = new Map(assignments.map((a) => [Number(a.familyIndex), a]));
                list.forEach((f, idx) => {
                    const item = byIndex.get(idx);
                    if (!item) return;
                    f.businessViewId = String(item.businessViewId || '').trim();
                    f.businessViewLabel = String(item.businessViewLabel || '').trim();
                    f._iaAssignReason = String(item.reason || '').trim();
                    f._iaAssignConfidence = item.confidence;
                });
                setFamilleValidatedFamilies(list);
                renderSubCategoriesAccordion();

                showAlert(`${assignments.length} famille(s) traitée(s) par l’IA.`, 'success');
            } catch (error) {
                showAlert(`Erreur assignation IA: ${error.message || error}`, 'error');
            } finally {
                if (runBtn) runBtn.disabled = false;
                setBtnIdle();
            }
        }

        function addSubCategory() {
            // Bouton supprimé dans l'UI (conservé pour compatibilité).
        }

        function renderSubCategoriesAccordion() {
            const container = document.getElementById('subcategories-accordion');
            if (!container) return;
            const categories = Array.isArray(currentData?.categories) ? currentData.categories : [];
            const rulesPanelHtml = categories.length === 0
                ? '<div style="margin-bottom:12px; padding:10px; border:1px solid #eee; border-radius:6px; color:#666;">Aucune catégorie pour configurer les règles.</div>'
                : `
                    <div style="margin-bottom:12px; border:1px solid #dee2e6; border-radius:8px; overflow:hidden;">
                        <div style="padding:10px 12px; background:#f8f9fa; border-bottom:1px solid #eee; font-weight:600;">Règles de sélection par catégorie</div>
                        <table style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#fff;">
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Catégorie</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:center;">Choix unique</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:center;">Obligatoire</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${categories.map((cat) => {
                                    const selectionRules = cat?.selectionRules || {};
                                    const unique = !!selectionRules.unique;
                                    const required = !!selectionRules.required;
                                    const categoryId = String(cat?.id || '');
                                    return `
                                        <tr>
                                            <td style="padding:8px; border-bottom:1px solid #eee;"><strong>${escapeHtml(String(cat?.name || 'Catégorie'))}</strong></td>
                                            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                                                <input type="checkbox" ${unique ? 'checked' : ''} onchange="updateCategorySelectionRule('${escapeHtml(categoryId)}', 'unique', this.checked)">
                                            </td>
                                            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                                                <input type="checkbox" ${required ? 'checked' : ''} onchange="updateCategorySelectionRule('${escapeHtml(categoryId)}', 'required', this.checked)">
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;

            const views = getBusinessViewsForAssignationTab();
            const families = getFamiliesForAssignationTab();
            const validViewIds = new Set(
                views.map((v) => String(v?.id || '').trim()).filter(Boolean)
            );

            if (views.length === 0) {
                container.innerHTML = `${rulesPanelHtml}<p style="color:#666;">Aucune vue métier disponible.</p>`;
                return;
            }

            if (families.length === 0) {
                container.innerHTML = `
                    ${rulesPanelHtml}
                    <div style="padding:14px; border:1px solid #ffe69c; border-radius:6px; background:#fff8e1; color:#8a6d3b;">
                        Aucune famille validée. Va d'abord dans l'onglet <strong>Famille</strong> puis clique sur <strong>Enregistrer</strong>.
                    </div>
                `;
                return;
            }

            const html = views.map((view) => {
                const assigned = families.filter((f) => {
                    const familyViewId = String(f.businessViewId || '').trim();
                    if (!familyViewId || !validViewIds.has(familyViewId)) return false;
                    return familyViewId === String(view.id || '').trim();
                });
                const rows = assigned.length === 0
                    ? '<tr><td colspan="5" style="padding:10px; color:#777;">Aucune famille assignée</td></tr>'
                    : assigned.map((f) => `
                        <tr ondblclick="openFamilyEditionModal(${f.__idx})" title="Double-clic pour editer la famille">
                            <td style="padding:8px; border-bottom:1px solid #eee;"><strong>${escapeHtml(f.familyLabel || 'Famille')}</strong></td>
                            <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(f.assignation || '-')}</td>
                            <td style="padding:8px; border-bottom:1px solid #eee;"><span class="badge">${(f.optionIds || []).length} option(s)</span></td>
                            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                                <input type="checkbox" ${f.uniqueChoice ? 'checked' : ''} onchange="updateFamilyUniqueChoice(${f.__idx}, this.checked)">
                            </td>
                            <td style="padding:8px; border-bottom:1px solid #eee;">
                                <select onchange="assignFamilyToBusinessView(${f.__idx}, this.value)" style="min-width:180px; padding:6px; border:1px solid #ddd; border-radius:4px;">
                                    <option value="">-- Non assignée --</option>
                                    ${views.map((v) => `<option value="${escapeHtml(String(v.id || ''))}" ${String(f.businessViewId || '').trim() === String(v.id || '').trim() ? 'selected' : ''}>${escapeHtml(v.label || 'Vue métier')}</option>`).join('')}
                                </select>
                            </td>
                        </tr>
                    `).join('');
                return `
                    <div class="accordion">
                        <div class="accordion-header active">
                            <div style="flex:1;">
                                <strong>${escapeHtml(view.label || 'Vue métier')}</strong>
                                <span style="margin-left:10px; color:#666; font-size:14px;">${assigned.length} famille(s) assignée(s)</span>
                            </div>
                        </div>
                        <div class="accordion-content active" style="display:block; padding:12px;">
                            <table style="width:100%; border-collapse:collapse;">
                                <thead>
                                    <tr style="background:#f8f9fa;">
                                        <th style="padding:8px; border-bottom:2px solid #dee2e6;">Famille</th>
                                        <th style="padding:8px; border-bottom:2px solid #dee2e6;">Assignation</th>
                                        <th style="padding:8px; border-bottom:2px solid #dee2e6;">Options</th>
                                        <th style="padding:8px; border-bottom:2px solid #dee2e6;">Choix unique</th>
                                        <th style="padding:8px; border-bottom:2px solid #dee2e6;">Action</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                `;
            }).join('');

            const assignedIds = new Set(
                families
                    .filter((f) => {
                        const id = String(f.businessViewId || '').trim();
                        return id && validViewIds.has(id);
                    })
                    .map((f) => String(f.__idx))
            );
            const unassigned = families.filter((f) => !assignedIds.has(String(f.__idx)));
            const unassignedRows = unassigned.length === 0
                ? '<tr><td colspan="4" style="padding:8px; color:#666;">Toutes les familles sont assignées.</td></tr>'
                : unassigned.map((f) => `
                    <tr ondblclick="openFamilyEditionModal(${f.__idx})" title="Double-clic pour editer la famille">
                        <td style="padding:8px; border-bottom:1px solid #eee;"><strong>${escapeHtml(f.familyLabel || 'Famille')}</strong></td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(f.assignation || '-')}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                            <input type="checkbox" ${f.uniqueChoice ? 'checked' : ''} onchange="updateFamilyUniqueChoice(${f.__idx}, this.checked)">
                        </td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">
                            <select onchange="assignFamilyToBusinessView(${f.__idx}, this.value)" style="min-width:180px; padding:6px; border:1px solid #ddd; border-radius:4px;">
                                <option value="">-- Choisir une vue métier --</option>
                                ${views.map((v) => `<option value="${escapeHtml(String(v.id || ''))}">${escapeHtml(v.label || 'Vue métier')}</option>`).join('')}
                            </select>
                        </td>
                    </tr>
                `).join('');

            container.innerHTML = `
                ${rulesPanelHtml}
                <div style="margin-bottom:12px; padding:12px; background:#f8f9fa; border-radius:6px; color:#555;">
                    Cet onglet assigne les <strong>familles</strong> aux <strong>vues métier</strong>.
                </div>
                <div style="margin-bottom:14px; border:1px solid #ddd; border-radius:6px; overflow:hidden;">
                    <div style="padding:10px 12px; background:#f8f9fa; border-bottom:1px solid #eee; font-weight:600;">Familles non assignées</div>
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#fff;">
                                <th style="padding:8px; border-bottom:1px solid #eee;">Famille</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Assignation</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Choix unique</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Affecter à</th>
                            </tr>
                        </thead>
                        <tbody>${unassignedRows}</tbody>
                    </table>
                </div>
                ${html}
            `;
        }

        async function updateCategorySelectionRule(categoryId, ruleKey, checked) {
            const normalizedCategoryId = String(categoryId || '').trim();
            const key = String(ruleKey || '').trim();
            if (!normalizedCategoryId || (key !== 'unique' && key !== 'required')) return;
            const category = (currentData?.categories || []).find((cat) => String(cat?.id || '') === normalizedCategoryId);
            if (!category) return;
            const nextRules = {
                unique: !!category?.selectionRules?.unique,
                required: !!category?.selectionRules?.required,
                [key]: !!checked
            };
            try {
                await apiCall(`/categories/${encodeURIComponent(normalizedCategoryId)}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        ...category,
                        selectionRules: nextRules
                    })
                });
                await loadData(true);
                renderSubCategoriesAccordion();
                showAlert('Règle de catégorie mise à jour', 'success');
            } catch (error) {
                showAlert('Erreur mise à jour règle catégorie: ' + error.message, 'error');
            }
        }

        // Render categories (options view)
        function renderCategories() {
            const tbody = document.querySelector('#categories-table tbody');
            const filterModel = document.getElementById('filter-model');
            const filterName = document.getElementById('filter-option-name');
            const filterFamily = document.getElementById('filter-option-family');
            const filterSubFamily = document.getElementById('filter-option-subfamily');
            const btnOnlyUnassigned = document.getElementById('btn-filter-unassigned-options');
            const btnFilterAutoAssigned = document.getElementById('btn-filter-auto-assigned-options');
            const btnOptionsResetPurgeTemp = document.getElementById('btn-options-reset-purge-temp');
            const unassignedWarning = document.getElementById('options-unassigned-warning');
            const unassignedWarningCount = document.getElementById('options-unassigned-warning-count');
            if (!tbody || !filterModel) return;
            if (btnOptionsResetPurgeTemp) {
                btnOptionsResetPurgeTemp.onclick = async () => {
                    if (!confirm('TEMPORAIRE — Supprimer tout le catalogue UGAP publié (modèles, catégories, options) pour cette entreprise ?')) return;
                    if (!confirm('Confirmer la suppression définitive des données publiées ?')) return;
                    try {
                        await apiCall('/data/purge', { method: 'POST' });
                        __lastLoadDataAt = 0;
                        await loadData(false);
                        showAlert('Catalogue publié purgé. Réimportez si nécessaire.', 'success');
                    } catch (error) {
                        showAlert('Erreur purge : ' + error.message, 'error');
                    }
                };
            }
            const isPrLabel = (label) => /^PR\s/i.test(String(label || '').trim());
            if (!window.__optionsTabFilterState || typeof window.__optionsTabFilterState !== 'object') {
                window.__optionsTabFilterState = {
                    onlyUnassigned: false,
                    autoAssignedOnly: false,
                    family: '',
                    subFamily: ''
                };
            }
            if (typeof window.__optionsTabFilterState.autoAssignedOnly !== 'boolean') {
                window.__optionsTabFilterState.autoAssignedOnly = false;
            }

            tbody.innerHTML = '';
            const categories = Array.isArray(currentData?.categories) ? currentData.categories : [];
            const models = Array.isArray(currentData?.models) ? currentData.models : [];
            if (categories.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#666;">Aucune option</td></tr>';
                return;
            }

            const prevModel = String(filterModel.value || '');
            filterModel.innerHTML = '<option value="">Tous les modèles</option>';
            models.forEach((m) => {
                const opt = document.createElement('option');
                opt.value = String(m?.id || '');
                opt.textContent = String(m?.name || m?.id || 'Modèle');
                filterModel.appendChild(opt);
            });
            filterModel.value = models.some((m) => String(m?.id || '') === prevModel) ? prevModel : '';

            const selectedModelId = String(filterModel.value || '');
            const nameQuery = String(filterName?.value || '').trim().toLowerCase();
            const onlyUnassigned = !!window.__optionsTabFilterState.onlyUnassigned;
            const autoAssignedOnly = !!window.__optionsTabFilterState.autoAssignedOnly;
            const autoAssignments = getOptionsAutoAssignments();
            const familyChoices = getFamilleChoicesForOptionTab();
            const subFamilyMap = getFamilleSubFamilyMapForOptionTab();
            const familyFilterState = String(window.__optionsTabFilterState.family || '').trim();
            const subFamilyFilterState = String(window.__optionsTabFilterState.subFamily || '').trim();

            const familyFilterChoices = Array.from(new Set([
                ...familyChoices,
                ...Array.from(subFamilyMap.keys()).map((x) => String(x || '').trim()).filter(Boolean)
            ])).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
            const hasFamilyFilterState = familyFilterChoices.includes(familyFilterState);
            const selectedFamilyFilter = hasFamilyFilterState ? familyFilterState : '';
            if (filterFamily) {
                filterFamily.innerHTML = '<option value="">Toutes les familles</option>';
                familyFilterChoices.forEach((fam) => {
                    const opt = document.createElement('option');
                    opt.value = fam;
                    opt.textContent = fam;
                    filterFamily.appendChild(opt);
                });
                filterFamily.value = selectedFamilyFilter;
            }
            if (!selectedFamilyFilter && familyFilterState) {
                window.__optionsTabFilterState.family = '';
            }

            const subFamilyFilterOptions = [];
            if (selectedFamilyFilter) {
                const familySubs = subFamilyMap.get(selectedFamilyFilter) || [];
                familySubs.forEach((sf) => {
                    const cleanSub = String(sf || '').trim();
                    if (!cleanSub) return;
                    subFamilyFilterOptions.push({
                        value: cleanSub,
                        label: cleanSub
                    });
                });
            } else {
                subFamilyMap.forEach((subs, parent) => {
                    const cleanParent = String(parent || '').trim();
                    if (!cleanParent) return;
                    (subs || []).forEach((sf) => {
                        const cleanSub = String(sf || '').trim();
                        if (!cleanSub) return;
                        subFamilyFilterOptions.push({
                            value: `${cleanParent} / ${cleanSub}`,
                            label: `${cleanParent} / ${cleanSub}`
                        });
                    });
                });
            }
            const subFamilyFilterChoices = Array.from(
                new Map(
                    subFamilyFilterOptions.map((entry) => [entry.value, entry])
                ).values()
            ).sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
            const hasSubFamilyFilterState = subFamilyFilterChoices.some((entry) => entry.value === subFamilyFilterState);
            const selectedSubFamilyFilter = hasSubFamilyFilterState ? subFamilyFilterState : '';
            if (filterSubFamily) {
                filterSubFamily.innerHTML = '<option value="">Toutes les sous-familles</option>';
                subFamilyFilterChoices.forEach((entry) => {
                    const opt = document.createElement('option');
                    opt.value = entry.value;
                    opt.textContent = entry.label;
                    filterSubFamily.appendChild(opt);
                });
                filterSubFamily.value = selectedSubFamilyFilter;
            }
            if (!selectedSubFamilyFilter && subFamilyFilterState) {
                window.__optionsTabFilterState.subFamily = '';
            }

            const fragment = document.createDocumentFragment();
            let rowCount = 0;

            categories.forEach((category) => {
                (category.options || []).forEach((option) => {
                    const compatible = Array.isArray(option?.compatibleModels) ? option.compatibleModels.map((x) => String(x)) : [];
                    if (selectedModelId && !compatible.includes(selectedModelId)) return;
                    if (isPrLabel(option?.name)) return;

                    const optionId = String(option?.id || '');
                    const selectedFamilyFull = String(getSelectedFamilyLabelForOption(optionId, option?.familyLabel) || '').trim();
                    const selectedParts = selectedFamilyFull.split(' / ').map((x) => String(x || '').trim()).filter(Boolean);
                    const selectedFamily = selectedParts.length ? selectedParts[0] : '';
                    const selectedSubFamily = selectedParts.length > 1 ? selectedParts.slice(1).join(' / ') : '';
                    const autoEntry = autoAssignments[optionId];
                    const isAutoPending = !!(autoEntry && autoEntry.status === 'pending');
                    if (onlyUnassigned && selectedFamily) return;
                    if (autoAssignedOnly && !isAutoPending) return;
                    if (nameQuery && !String(option?.name || '').toLowerCase().includes(nameQuery)) return;
                    if (selectedFamilyFilter && selectedFamily !== selectedFamilyFilter) return;
                    if (selectedSubFamilyFilter) {
                        if (selectedFamilyFilter) {
                            if (selectedSubFamily !== selectedSubFamilyFilter) return;
                        } else if (selectedFamilyFull !== selectedSubFamilyFilter) {
                            return;
                        }
                    }
                    const subFamilies = selectedFamily ? (subFamilyMap.get(selectedFamily) || []) : [];
                    const allPathChoices = [];
                    subFamilyMap.forEach((subs, parent) => {
                        (subs || []).forEach((sf) => {
                            allPathChoices.push({
                                value: `${parent}|||${sf}`,
                                label: `/${parent}/${sf}`.replace(/\/+/g, '/')
                            });
                        });
                    });
                    allPathChoices.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
                    const isColorOption = option?.type === 'couleur' || String(option?.name || '').toLowerCase().includes('couleur');
                    const familySelectOptionsHtml = [
                        '<option value="">-- Non attribuée --</option>',
                        ...familyChoices.map((name) => `<option value="${escapeHtml(name)}" ${selectedFamily === name ? 'selected' : ''}>${escapeHtml(name)}</option>`)
                    ].join('');
                    const subFamilySelectOptionsHtml = selectedFamily
                        ? (
                            subFamilies.length
                                ? [
                                    '<option value="">-- Choisir une sous-famille --</option>',
                                    ...subFamilies.map((sf) => `<option value="${escapeHtml(sf)}" ${selectedSubFamily === sf ? 'selected' : ''}>${escapeHtml(sf)}</option>`)
                                ].join('')
                                : `<option value="">Identique à "${escapeHtml(selectedFamily)}"</option>`
                        )
                        : (
                            allPathChoices.length
                                ? [
                                    '<option value="">-- Choisir via chemin --</option>',
                                    ...allPathChoices.map((p) => `<option value="${escapeHtml(p.label)}">${escapeHtml(p.label)}</option>`)
                                ].join('')
                                : '<option value="">-- Aucune sous-famille disponible --</option>'
                        );
                    const tr = document.createElement('tr');
                    const isManualBaseOption = !!option?.manualBaseOption
                        || (!!option?.baseIncluded && !!String(option?.baseRefUgap || '').trim());
                    tr.innerHTML = `
                        <td>${escapeHtml(String(option?.name || '—'))}${isColorOption ? ' 🎨' : ''}</td>
                        <td>
                            <select class="opt-family-select" data-option-id="${escapeHtml(optionId)}" style="min-width:220px; width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;">
                                ${familySelectOptionsHtml}
                            </select>
                        </td>
                        <td>
                            <select class="opt-subfamily-select" data-option-id="${escapeHtml(optionId)}" data-family-parent="${escapeHtml(selectedFamily)}" style="min-width:220px; width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;" ${selectedFamily ? (subFamilies.length ? '' : 'disabled') : ''}>
                                ${subFamilySelectOptionsHtml}
                            </select>
                        </td>
                        <td>${(Number(option?.priceClient || 0)).toFixed(2)} €</td>
                        <td>${(Number(option?.priceUgap || 0)).toFixed(2)} €</td>
                        <td><span class="badge">${compatible.length} modèle(s)</span></td>
                        <td style="color:#999; display:flex; gap:6px; align-items:center;">
                            ${isAutoPending
                                ? `<button type="button" class="btn btn-outline opt-validate-auto-btn" data-option-id="${escapeHtml(optionId)}" style="padding:2px 8px;">Valider</button>`
                                : ''}
                            ${isManualBaseOption
                                ? `<button type="button" class="opt-delete-manual-btn" data-option-id="${escapeHtml(optionId)}" title="Supprimer définitivement cette option manuelle" style="border:none; background:#dc3545; color:#fff; border-radius:4px; width:24px; height:24px; cursor:pointer; font-weight:700;">×</button>`
                                : '—'}
                        </td>
                    `;
                    fragment.appendChild(tr);
                    rowCount += 1;
                });
            });

            let unassignedCount = 0;
            categories.forEach((category) => {
                (category.options || []).forEach((option) => {
                    const compatible = Array.isArray(option?.compatibleModels) ? option.compatibleModels.map((x) => String(x)) : [];
                    if (selectedModelId && !compatible.includes(selectedModelId)) return;
                    if (isPrLabel(option?.name)) return;
                    const optionId = String(option?.id || '');
                    const selectedFamilyFull = String(getSelectedFamilyLabelForOption(optionId, option?.familyLabel) || '').trim();
                    const selectedParts = selectedFamilyFull.split(' / ').map((x) => String(x || '').trim()).filter(Boolean);
                    const selectedFamily = selectedParts.length ? selectedParts[0] : '';
                    if (!selectedFamily) unassignedCount += 1;
                });
            });

            if (rowCount === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#666;">Aucune option</td></tr>';
            } else {
                tbody.appendChild(fragment);
            }

            if (btnOnlyUnassigned) {
                btnOnlyUnassigned.textContent = onlyUnassigned ? 'Afficher toutes les options' : 'Options non assignées';
                btnOnlyUnassigned.onclick = null;
                btnOnlyUnassigned.addEventListener('click', () => {
                    window.__optionsTabFilterState.onlyUnassigned = !window.__optionsTabFilterState.onlyUnassigned;
                    renderCategories();
                });
            }
            if (btnFilterAutoAssigned) {
                btnFilterAutoAssigned.textContent = autoAssignedOnly ? 'Afficher toutes les options' : 'Assignées automatiquement';
                btnFilterAutoAssigned.onclick = null;
                btnFilterAutoAssigned.addEventListener('click', () => {
                    window.__optionsTabFilterState.autoAssignedOnly = !window.__optionsTabFilterState.autoAssignedOnly;
                    renderCategories();
                });
            }
            if (unassignedWarning && unassignedWarningCount) {
                if (unassignedCount > 0) {
                    unassignedWarning.style.display = 'inline-flex';
                    unassignedWarningCount.textContent = String(unassignedCount);
                } else {
                    unassignedWarning.style.display = 'none';
                    unassignedWarningCount.textContent = '0';
                }
            }
            updateOptionsTabWarningBadge();

            document.querySelectorAll('.opt-family-select').forEach((sel) => {
                sel.onchange = null;
                sel.addEventListener('change', async () => {
                    const optionId = String(sel.getAttribute('data-option-id') || '').trim();
                    const familyLabel = String(sel.value || '').trim();
                    if (!optionId) return;
                    await updateOptionFamilyFromOptionsTab(optionId, familyLabel);
                });
            });

            const applySubFamilySelection = async (optionId, parentFamily, subFamilyRaw) => {
                if (!optionId) return;
                let fullFamilyLabel = '';
                if (parentFamily) {
                    fullFamilyLabel = subFamilyRaw ? `${parentFamily} / ${subFamilyRaw}` : parentFamily;
                } else {
                    if (!subFamilyRaw) return;
                    const pathMatch = subFamilyRaw.match(/^\/?([^/]+)\/(.+)$/);
                    if (!pathMatch) return;
                    const pathParent = String(pathMatch[1] || '').trim();
                    const pathSub = String(pathMatch[2] || '').trim();
                    if (!pathParent) return;
                    fullFamilyLabel = pathSub ? `${pathParent} / ${pathSub}` : pathParent;
                }
                await updateOptionFamilyFromOptionsTab(optionId, fullFamilyLabel);
            };

            document.querySelectorAll('.opt-subfamily-select').forEach((sel) => {
                sel.onchange = null;
                sel.addEventListener('change', async () => {
                    const optionId = String(sel.getAttribute('data-option-id') || '').trim();
                    const parentFamily = String(sel.getAttribute('data-family-parent') || '').trim();
                    const subFamilyRaw = String(sel.value || '').trim();
                    if (!optionId) return;
                    await applySubFamilySelection(optionId, parentFamily, subFamilyRaw);
                });
            });

            document.querySelectorAll('.opt-delete-manual-btn').forEach((btn) => {
                btn.onclick = null;
                btn.addEventListener('click', async () => {
                    const optionId = String(btn.getAttribute('data-option-id') || '').trim();
                    if (!optionId) return;
                    const rec = findOptionRecordById(optionId)?.option || null;
                    const isManual = !!rec?.manualBaseOption
                        || (!!rec?.baseIncluded && !!String(rec?.baseRefUgap || '').trim());
                    if (!rec || !isManual) {
                        showAlert('Seules les options manuelles peuvent etre supprimees ici.', 'warning');
                        return;
                    }
                    if (!confirm(`Supprimer definitivement l'option manuelle "${optionId}" ?`)) return;
                    try {
                        await apiCall(`/options/${encodeURIComponent(optionId)}`, { method: 'DELETE' });
                        purgeDeletedOptionFromLocalStores(optionId);
                        await loadData(true);
                        renderCategories();
                        showAlert(`Option "${optionId}" supprimee definitivement.`, 'success');
                    } catch (error) {
                        showAlert('Erreur suppression option manuelle: ' + error.message, 'error');
                    }
                });
            });
            document.querySelectorAll('.opt-validate-auto-btn').forEach((btn) => {
                btn.onclick = null;
                btn.addEventListener('click', () => {
                    const optionId = String(btn.getAttribute('data-option-id') || '').trim();
                    if (!optionId) return;
                    const map = getOptionsAutoAssignments();
                    if (map[optionId]) {
                        map[optionId].status = 'validated';
                        setOptionsAutoAssignments(map);
                    }
                    renderCategories();
                });
            });
        }

        async function updateOptionFamilyFromOptionsTab(optionId, familyLabel) {
            const record = findOptionRecordById(optionId);
            if (!record?.option) return;
            try {
                await apiCall(`/options/${encodeURIComponent(optionId)}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        ...record.option,
                        familyLabel: String(familyLabel || '').trim()
                    })
                });
                assignOptionToValidatedFamily(optionId, String(familyLabel || '').trim());
                await loadData(true);
                renderCategories();
            } catch (error) {
                showAlert('Erreur assignation famille: ' + error.message, 'error');
            }
        }

        async function updateOptionFamilyFromOptionsTabSilent(optionId, familyLabel) {
            const record = findOptionRecordById(optionId);
            if (!record?.option) return false;
            await apiCall(`/options/${encodeURIComponent(optionId)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...record.option,
                    familyLabel: String(familyLabel || '').trim()
                })
            });
            assignOptionToValidatedFamily(optionId, String(familyLabel || '').trim());
            return true;
        }

        async function updateOptionSubFamilyFromOptionsTab(categoryId, optionId, targetSubCategoryId, currentSubCategoryId) {
            const normalizedCategoryId = String(categoryId || '').trim();
            const normalizedOptionId = String(optionId || '').trim();
            const normalizedTargetId = String(targetSubCategoryId || '').trim();
            const normalizedCurrentId = String(currentSubCategoryId || '').trim();
            if (!normalizedCategoryId || !normalizedOptionId) return;
            if (normalizedTargetId === normalizedCurrentId) return;

            try {
                const category = (currentData?.categories || []).find((cat) => String(cat?.id || '') === normalizedCategoryId);
                if (!category) throw new Error('Catégorie introuvable');

                if (normalizedCurrentId) {
                    const currentSubCat = (category.subCategories || []).find((sc) => String(sc?.id || '') === normalizedCurrentId);
                    if (currentSubCat) {
                        const updatedFromIds = (currentSubCat.optionIds || [])
                            .map((id) => String(id))
                            .filter((id) => id !== normalizedOptionId);
                        await apiCall(`/categories/${encodeURIComponent(normalizedCategoryId)}/subcategories/${encodeURIComponent(normalizedCurrentId)}`, {
                            method: 'PUT',
                            body: JSON.stringify({ optionIds: updatedFromIds })
                        });
                    }
                }

                if (normalizedTargetId) {
                    const targetSubCat = (category.subCategories || []).find((sc) => String(sc?.id || '') === normalizedTargetId);
                    if (!targetSubCat) throw new Error('Sous-famille introuvable');
                    const updatedTargetIds = Array.from(new Set([...(targetSubCat.optionIds || []).map((id) => String(id)), normalizedOptionId]));
                    await apiCall(`/categories/${encodeURIComponent(normalizedCategoryId)}/subcategories/${encodeURIComponent(normalizedTargetId)}`, {
                        method: 'PUT',
                        body: JSON.stringify({ optionIds: updatedTargetIds })
                    });
                }

                await loadData(true);
                renderCategories();
                showAlert('Sous-famille mise à jour', 'success');
            } catch (error) {
                showAlert('Erreur assignation sous-famille: ' + error.message, 'error');
            }
        }

        function getCouplingRules() {
            try {
                const raw = memoryStoreGetItem('ugap_option_coupling_rules_v1');
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        }

        function setCouplingRules(rules) {
            memoryStoreSetItem('ugap_option_coupling_rules_v1', JSON.stringify(Array.isArray(rules) ? rules : []));
        }

        function getOptionsAutoAssignments() {
            try {
                const raw = memoryStoreGetItem('ugap.options.autoAssignments.v1');
                const parsed = raw ? JSON.parse(raw) : {};
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (_) {
                return {};
            }
        }

        function setOptionsAutoAssignments(map) {
            try {
                memoryStoreSetItem('ugap.options.autoAssignments.v1', JSON.stringify(map && typeof map === 'object' ? map : {}));
            } catch (_) {
                // no-op
            }
        }

        function normalizeCouplingOptionChoiceId(rawId, fallbackLabel) {
            const cleanedRaw = String(rawId || '').trim();
            if (cleanedRaw) return cleanedRaw;
            const base = String(fallbackLabel || 'option')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '')
                .replace(/^_+|_+$/g, '') || 'option';
            return `noid_${base}`;
        }

        function normalizeLegacyCouplingItemOptionId(rawOptId) {
            const value = String(rawOptId || '').trim();
            if (!value) return '';
            // Migration robuste: ancien format "...__<idx>" => clé stable sans suffixe d'index.
            const legacy = value.match(/^(.*)__\d+$/);
            if (legacy && legacy[1]) return String(legacy[1]).trim();
            return value;
        }

        function normalizeLegacyCouplingItemKey(rawItemKey) {
            const raw = String(rawItemKey || '').trim();
            if (!raw) return '';
            const sep = raw.lastIndexOf('::');
            if (sep < 0) return raw;
            const col = raw.slice(0, sep);
            const opt = normalizeLegacyCouplingItemOptionId(raw.slice(sep + 2));
            return `${col}::${opt}`;
        }

        function getAllFlatOptionsWithContext() {
            const out = [];
            const categories = Array.isArray(currentData?.categories) ? currentData.categories : [];
            categories.forEach((cat) => {
                (cat.options || []).forEach((opt) => {
                    out.push({
                        categoryId: String(cat?.id || ''),
                        categoryName: String(cat?.name || ''),
                        option: opt
                    });
                });
            });
            return out;
        }

        function getCouplingWarningsSummary() {
            const couplings = getCouplingRules();
            if (!Array.isArray(couplings) || couplings.length === 0) {
                return { couplingsWithWarnings: 0, warningColumnsTotal: 0 };
            }
            const options = getAllFlatOptionsWithContext();
            const familyChoices = getFamilleChoicesForOptionTab();
            const subFamilyMap = getFamilleSubFamilyMapForOptionTab();
            const byFamily = new Map();
            const bySubFamily = new Map();
            familyChoices.forEach((fam) => byFamily.set(fam, []));
            subFamilyMap.forEach((subs, parent) => {
                (subs || []).forEach((sub) => {
                    const full = `${parent} / ${sub}`;
                    bySubFamily.set(full, []);
                });
            });
            options.forEach((r) => {
                const full = String(getSelectedFamilyLabelForOption(r.option?.id, r.option?.familyLabel) || '').trim();
                if (!full) return;
                const parts = full.split(' / ').map((x) => String(x || '').trim()).filter(Boolean);
                const family = parts.length ? parts[0] : '';
                const sub = parts.length > 1 ? parts.slice(1).join(' / ') : '';
                if (!family) return;
                if (!byFamily.has(family)) byFamily.set(family, []);
                byFamily.get(family).push(r.option);
                if (sub) {
                    const subKey = `${family} / ${sub}`;
                    if (!bySubFamily.has(subKey)) bySubFamily.set(subKey, []);
                    bySubFamily.get(subKey).push(r.option);
                }
            });
            const toOptionChoices = (arr) => {
                return (arr || [])
                    .map((o) => {
                        const rawId = String(o?.id || '').trim();
                        const stableId = normalizeCouplingOptionChoiceId(rawId, o?.name || o?.id);
                        return { id: stableId };
                    });
            };
            const selectableColumns = [
                ...familyChoices.map((fam) => ({ key: `F::${fam}`, options: toOptionChoices(byFamily.get(fam) || []) })),
                ...Array.from(bySubFamily.keys())
                    .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
                    .map((sf) => ({ key: `S::${sf}`, options: toOptionChoices(bySubFamily.get(sf) || []) }))
            ];

            let couplingsWithWarnings = 0;
            let warningColumnsTotal = 0;
            (couplings || []).forEach((coupling) => {
                const selected = (Array.isArray(coupling?.selectedFamilies) ? coupling.selectedFamilies : [])
                    .filter((k) => selectableColumns.some((f) => f.key === k));
                if (!selected.length) return;
                const linkedSet = new Set();
                (Array.isArray(coupling?.links) ? coupling.links : []).forEach((lnk) => {
                    (Array.isArray(lnk?.masterItems) ? lnk.masterItems : []).forEach((x) => linkedSet.add(normalizeLegacyCouplingItemKey(x)));
                    (Array.isArray(lnk?.slaveItems) ? lnk.slaveItems : []).forEach((x) => linkedSet.add(normalizeLegacyCouplingItemKey(x)));
                });
                const warningCountForCoupling = selected.reduce((acc, colKey) => {
                    const col = selectableColumns.find((c) => c.key === colKey);
                    if (!col) return acc;
                    const hasMissing = (Array.isArray(col.options) ? col.options : []).some((opt) => !linkedSet.has(`${col.key}::${opt.id}`));
                    return hasMissing ? acc + 1 : acc;
                }, 0);
                if (warningCountForCoupling > 0) {
                    couplingsWithWarnings += 1;
                    warningColumnsTotal += warningCountForCoupling;
                }
            });
            return { couplingsWithWarnings, warningColumnsTotal };
        }

        function setTabWarningBadge(tabName, count, titleText) {
            const tabEl = document.querySelector(`.tab[data-tab="${tabName}"]`);
            if (!tabEl) return;
            const fallbackLabel = tabName === 'options' ? 'Options' : (tabName === 'famille' ? 'Famille' : (tabName === 'couplings' ? 'Couplages' : tabName));
            const baseLabel = String(tabEl.getAttribute('data-base-label') || tabEl.textContent || fallbackLabel).trim() || fallbackLabel;
            tabEl.setAttribute('data-base-label', baseLabel);
            if (Number(count) > 0) {
                tabEl.innerHTML = `${escapeHtml(baseLabel)} <span title="${escapeHtml(String(titleText || 'Avertissement'))}" style="display:inline-flex; align-items:center; gap:4px; margin-left:6px; padding:2px 6px; border-radius:999px; background:#fffbeb; color:#92400e; border:1px solid #facc15; font-size:10px; font-weight:700;">⚠ ${Number(count)}</span>`;
            } else {
                tabEl.textContent = baseLabel;
            }
        }

        function getOptionsWarningsSummary() {
            const categories = Array.isArray(currentData?.categories) ? currentData.categories : [];
            let unassignedOptions = 0;
            const isPrLabel = (label) => /^PR\s/i.test(String(label || '').trim());
            categories.forEach((category) => {
                (category.options || []).forEach((option) => {
                    if (isPrLabel(option?.name)) return;
                    const optionId = String(option?.id || '').trim();
                    const selectedFamilyFull = String(getSelectedFamilyLabelForOption(optionId, option?.familyLabel) || '').trim();
                    const selectedParts = selectedFamilyFull.split(' / ').map((x) => String(x || '').trim()).filter(Boolean);
                    const selectedFamily = selectedParts.length ? selectedParts[0] : '';
                    if (!selectedFamily) unassignedOptions += 1;
                });
            });
            return { unassignedOptions };
        }

        function getFamilleWarningsSummary() {
            const families = getFamilleValidatedFamilies();
            const missingBusinessView = (Array.isArray(families) ? families : []).reduce((acc, fam) => {
                const famLabel = String(fam?.familyLabel || '').trim();
                if (!famLabel) return acc;
                const hasViewId = String(fam?.businessViewId || '').trim();
                const hasViewLabel = String(fam?.businessViewLabel || '').trim();
                return (!hasViewId && !hasViewLabel) ? acc + 1 : acc;
            }, 0);
            return { missingBusinessView };
        }

        function updateOptionsTabWarningBadge() {
            setTabWarningBadge('options', 0, '');
        }

        function updateFamilleTabWarningBadge() {
            setTabWarningBadge('famille', 0, '');
        }

        function updateCouplingsTabWarningBadge() {
            setTabWarningBadge('couplings', 0, '');
        }

        function updateAllTabWarningBadges() {
            updateOptionsTabWarningBadge();
            updateFamilleTabWarningBadge();
            updateCouplingsTabWarningBadge();
        }

        function renderStructuredOptionsView() {
            const root = document.getElementById('structured-options-root');
            if (!root) return;
            const rows = getAllFlatOptionsWithContext();
            if (!rows.length) {
                root.innerHTML = '<p style="color:#666;">Aucune option.</p>';
                return;
            }
            if (!window.__ugapStructuredUiState || typeof window.__ugapStructuredUiState !== 'object') {
                window.__ugapStructuredUiState = { openViews: {}, openFamilies: {} };
            }
            const uiState = window.__ugapStructuredUiState;
            const selectedViewLabels = getStructuredSelectedViewLabels();
            const selectedViewsSet = new Set(selectedViewLabels);
            const subFamilyViewMap = getStructuredSubFamilyViewMap();

            const validatedFamilies = getFamilleValidatedFamilies();
            const familyToViewLabel = new Map();
            (Array.isArray(validatedFamilies) ? validatedFamilies : []).forEach((f) => {
                const familyLabel = String(f?.familyLabel || '').trim();
                const viewLabel = String(f?.businessViewLabel || '').trim();
                if (familyLabel && viewLabel) familyToViewLabel.set(familyLabel.toLowerCase(), viewLabel);
            });

            const groupedByView = new Map();
            selectedViewLabels.forEach((label) => groupedByView.set(label, new Map()));

            rows.forEach((row) => {
                const opt = row.option || {};
                const family = String(getSelectedFamilyLabelForOption(opt?.id, opt?.familyLabel) || 'Sans famille');
                const parsed = parseValidatedFamilyLabel(family);
                const subFamily = String(opt?.subCategory || opt?.subFamily || parsed?.subFamilyName || '').trim();
                const subKey = `${String(parsed?.familyName || family || '').trim().toLowerCase()}::${subFamily.toLowerCase()}`;
                const mappedViews = Array.isArray(subFamilyViewMap[subKey]) ? subFamilyViewMap[subKey] : [];
                let targets = mappedViews.filter((v) => selectedViewsSet.has(String(v || '').trim()));
                if (!targets.length) {
                    const fallback = String(familyToViewLabel.get(family.toLowerCase()) || opt?.category || row?.categoryName || '').trim();
                    if (fallback && selectedViewsSet.has(fallback)) targets = [fallback];
                }
                targets.forEach((view) => {
                    if (!groupedByView.has(view)) groupedByView.set(view, new Map());
                    const famMap = groupedByView.get(view);
                    if (!famMap.has(family)) famMap.set(family, []);
                    famMap.get(family).push(opt);
                });
            });

            const html = Array.from(groupedByView.entries())
                .map(([view, famMap]) => {
                    const viewOpen = !!uiState.openViews[view];
                    const familyRows = Array.from(famMap.entries()).map(([family, opts]) => {
                        const famKey = `${view}__${family}`;
                        const famOpen = !!uiState.openFamilies[famKey];
                        const parsed = parseValidatedFamilyLabel(family);
                        const familyBase = String(parsed?.familyName || family || '').trim();
                        const subGroups = new Map();
                        opts.forEach((o) => {
                            const sub = String(o?.subCategory || o?.subFamily || parsed?.subFamilyName || '').trim();
                            const key = sub || '';
                            if (!subGroups.has(key)) subGroups.set(key, []);
                            subGroups.get(key).push(o);
                        });
                        const free = subGroups.get('') || [];
                        const subItems = Array.from(subGroups.entries()).filter(([k]) => k).sort((a, b) => a[0].localeCompare(b[0], 'fr', { sensitivity: 'base' }));
                        const subBlocks = subItems.map(([sub, subOpts]) => {
                            const subKey = `${familyBase.toLowerCase()}::${String(sub || '').toLowerCase()}`;
                            const checkedSet = new Set((Array.isArray(subFamilyViewMap[subKey]) ? subFamilyViewMap[subKey] : []).map((x) => String(x)));
                            return `
                                <div style="border:1px solid #e2e8f0; border-radius:6px; padding:8px; margin-bottom:8px; background:#fff;">
                                    <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
                                        <strong>${escapeHtml(sub)}</strong><span class="badge">${subOpts.length}</span>
                                    </div>
                                    <div style="margin-bottom:6px; font-size:12px; color:#475569;">Vues métier assignées à cette sous-famille:</div>
                                    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:6px;">
                                        ${selectedViewLabels.map((v) => `
                                            <label style="font-size:12px; color:#334155; display:flex; gap:6px; align-items:center;">
                                                <input type="checkbox" class="structured-sub-view-cb" data-sub-key="${escapeHtml(subKey)}" data-view-label="${escapeHtml(v)}" ${checkedSet.has(v) ? 'checked' : ''}>
                                                ${escapeHtml(v)}
                                            </label>
                                        `).join('')}
                                    </div>
                                    <div style="font-size:12px; color:#333;">${subOpts.map((o) => `• ${escapeHtml(String(o?.name || 'Option'))}`).join('<br>')}</div>
                                </div>
                            `;
                        }).join('');

                        return `
                            <div style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:8px; background:#fff;">
                                <button type="button" class="structured-family-toggle" data-view-key="${escapeHtml(view)}" data-family-key="${escapeHtml(String(family || ''))}" style="width:100%; text-align:left; border:none; background:#fff; padding:10px 12px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                                    <span><span style="font-size:12px; color:#666;">${famOpen ? '▼' : '▶'}</span> <strong>${escapeHtml(family)}</strong></span>
                                    <span class="badge">${opts.length} option(s)</span>
                                </button>
                                <div style="display:${famOpen ? 'block' : 'none'}; border-top:1px solid #eef2f7; padding:8px 12px; font-size:12px; color:#333;">
                                    ${free.length ? `<div style="margin-bottom:8px;"><strong>Options libres</strong><div>${free.map((o) => `• ${escapeHtml(String(o?.name || 'Option'))}`).join('<br>')}</div></div>` : ''}
                                    ${subBlocks || '<div style="color:#666;">Aucune sous-famille.</div>'}
                                </div>
                            </div>
                        `;
                    }).join('');

                    return `
                        <div style="margin-bottom:14px; border:1px solid #dbeafe; border-radius:10px; overflow:hidden;">
                            <button type="button" class="structured-view-toggle" data-view-key="${escapeHtml(view)}" style="width:100%; border:none; background:#eff6ff; padding:10px 12px; font-weight:600; text-align:left; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                                <span>${viewOpen ? '▼' : '▶'} ${escapeHtml(view)}</span>
                                <span class="badge">${famMap.size} famille(s)</span>
                            </button>
                            <div style="display:${viewOpen ? 'block' : 'none'}; padding:10px; background:#f9fcff;">
                                ${familyRows || '<div style="color:#666; font-size:12px;">Aucune famille.</div>'}
                            </div>
                        </div>
                    `;
                }).join('');

            root.innerHTML = html || '<p style="color:#666;">Aucune donnée.</p>';
            root.querySelectorAll('.structured-view-toggle').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const key = String(btn.getAttribute('data-view-key') || '');
                    uiState.openViews[key] = !uiState.openViews[key];
                    renderStructuredOptionsView();
                });
            });
            root.querySelectorAll('.structured-family-toggle').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const viewKey = String(btn.getAttribute('data-view-key') || '');
                    const familyKey = String(btn.getAttribute('data-family-key') || '');
                    const key = `${viewKey}__${familyKey}`;
                    uiState.openFamilies[key] = !uiState.openFamilies[key];
                    renderStructuredOptionsView();
                });
            });
            root.querySelectorAll('.structured-sub-view-cb').forEach((cb) => {
                cb.addEventListener('change', () => {
                    const subKey = String(cb.getAttribute('data-sub-key') || '').trim();
                    const view = String(cb.getAttribute('data-view-label') || '').trim();
                    if (!subKey || !view) return;
                    const mapObj = getStructuredSubFamilyViewMap();
                    const set = new Set(Array.isArray(mapObj[subKey]) ? mapObj[subKey].map((x) => String(x)) : []);
                    if (cb.checked) set.add(view);
                    else set.delete(view);
                    mapObj[subKey] = Array.from(set);
                    setStructuredSubFamilyViewMap(mapObj);
                    renderStructuredOptionsView();
                });
            });
        }

        function renderOptionCouplingsTab() {
            const root = document.getElementById('option-couplings-root');
            if (!root) return;
            updateCouplingsTabWarningBadge();
            const options = getAllFlatOptionsWithContext();
            const familyChoices = getFamilleChoicesForOptionTab();
            const subFamilyMap = getFamilleSubFamilyMapForOptionTab();
            const byFamily = new Map();
            const bySubFamily = new Map();
            familyChoices.forEach((fam) => byFamily.set(fam, []));
            subFamilyMap.forEach((subs, parent) => {
                (subs || []).forEach((sub) => {
                    const full = `${parent} / ${sub}`;
                    bySubFamily.set(full, []);
                });
            });
            options.forEach((r) => {
                const full = String(getSelectedFamilyLabelForOption(r.option?.id, r.option?.familyLabel) || '').trim();
                if (!full) return;
                const parts = full.split(' / ').map((x) => String(x || '').trim()).filter(Boolean);
                const family = parts.length ? parts[0] : '';
                const sub = parts.length > 1 ? parts.slice(1).join(' / ') : '';
                if (!family) return;
                if (!byFamily.has(family)) byFamily.set(family, []);
                byFamily.get(family).push(r.option);
                if (sub) {
                    const subKey = `${family} / ${sub}`;
                    if (!bySubFamily.has(subKey)) bySubFamily.set(subKey, []);
                    bySubFamily.get(subKey).push(r.option);
                }
            });
            const toOptionChoices = (arr) => {
                return (arr || [])
                    .map((o) => {
                        const rawId = String(o?.id || '').trim();
                        const stableId = normalizeCouplingOptionChoiceId(rawId, o?.name || o?.id);
                        return { id: stableId, rawId: rawId || stableId, label: String(o?.name || o?.id || 'Option') };
                    });
            };
            const familyColumns = familyChoices.map((fam) => ({
                key: `F::${fam}`,
                label: `[Famille] ${fam}`,
                options: toOptionChoices(byFamily.get(fam) || [])
            }));
            const subFamilyColumns = Array.from(bySubFamily.keys())
                .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
                .map((sf) => ({
                    key: `S::${sf}`,
                    label: `[Sous-famille] ${sf}`,
                    options: toOptionChoices(bySubFamily.get(sf) || [])
                }));
            const selectableColumns = [...familyColumns, ...subFamilyColumns];
            const familyOptionsHtml = selectableColumns.length === 0
                ? '<option value="">Aucune famille/sous-famille</option>'
                : [
                    '<option value="">Choisir une famille ou sous-famille</option>',
                    ...selectableColumns.map((f) => `<option value="${escapeHtml(f.key)}">${escapeHtml(f.label)}</option>`)
                ].join('');

            const normalizeLink = (raw, idx) => {
                const masterItems = Array.isArray(raw?.masterItems)
                    ? raw.masterItems.map((x) => normalizeLegacyCouplingItemKey(x)).filter(Boolean)
                    : [];
                const slaveItems = Array.isArray(raw?.slaveItems)
                    ? raw.slaveItems.map((x) => normalizeLegacyCouplingItemKey(x)).filter(Boolean)
                    : [];
                return {
                    id: String(raw?.id || `link_${Date.now()}_${idx}_${Math.random().toString(16).slice(2, 6)}`),
                    masterItems,
                    slaveItems,
                    masterLabels: Array.isArray(raw?.masterLabels) ? raw.masterLabels : masterItems,
                    slaveLabels: Array.isArray(raw?.slaveLabels) ? raw.slaveLabels : slaveItems
                };
            };
            const normalizeCoupling = (raw, idx) => {
                const fallbackName = `Couplage ${idx + 1}`;
                return {
                    id: String(raw?.id || `cp_${Date.now()}_${idx}_${Math.random().toString(16).slice(2, 6)}`),
                    name: String(raw?.name || fallbackName).trim() || fallbackName,
                    selectedFamilies: Array.isArray(raw?.selectedFamilies) ? raw.selectedFamilies.map((x) => String(x || '')).filter(Boolean) : [],
                    masterColumns: Array.isArray(raw?.masterColumns) ? raw.masterColumns.map((x) => String(x || '')).filter(Boolean) : [],
                    selectedMasterItems: Array.isArray(raw?.selectedMasterItems) ? raw.selectedMasterItems.map((x) => String(x || '')).filter(Boolean) : [],
                    selectedSlaveItems: Array.isArray(raw?.selectedSlaveItems) ? raw.selectedSlaveItems.map((x) => String(x || '')).filter(Boolean) : [],
                    links: (Array.isArray(raw?.links) ? raw.links : []).map((lnk, i) => normalizeLink(lnk, i))
                };
            };

            root.innerHTML = `
                <div style="margin-bottom:12px; border:1px solid #cfe8ff; border-radius:10px; padding:12px; background:#f8fbff;">
                    <div style="font-weight:600; color:#1e3a8a; margin-bottom:8px;">Couplage par colonnes</div>
                    <div style="display:grid; grid-template-columns:minmax(260px,1fr) auto auto; gap:8px; align-items:end; margin-bottom:10px;">
                        <div>
                            <label style="display:block; font-size:12px; color:#666;">Nom du couplage</label>
                            <input id="coupling-name-input" type="text" placeholder="Ex: Propulsion thermique" style="width:100%; padding:7px; border:1px solid #ddd; border-radius:4px;">
                        </div>
                        <button class="btn btn-primary" id="btn-save-coupling-name">Enregistrer le nom</button>
                        <button class="btn btn-outline" id="btn-create-coupling">Nouveau couplage</button>
                    </div>
                    <div id="coupling-list" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;"></div>
                    <p style="margin:0 0 10px 0; color:#475569; font-size:12px;">Sélectionne une famille ou sous-famille pour ajouter une colonne avec ses valeurs d'options.</p>
                    <div style="display:grid; grid-template-columns:1fr auto; gap:8px; align-items:end; max-width:560px;">
                        <div>
                            <label style="display:block; font-size:12px; color:#666;">Famille / Sous-famille</label>
                            <select id="coupling-family-column-select" style="width:100%; padding:7px; border:1px solid #ddd; border-radius:4px;">
                                ${familyOptionsHtml}
                            </select>
                        </div>
                        <button class="btn btn-primary" id="btn-add-coupling-column" style="display:none;">Ajouter colonne</button>
                    </div>
                </div>
                <div style="border:1px solid #e5e7eb; border-radius:8px; overflow:auto; background:#fff;">
                    <table id="coupling-columns-table" style="width:100%; border-collapse:collapse; min-width:600px;">
                        <thead>
                            <tr id="coupling-columns-head">
                                <th style="padding:8px; text-align:left; background:#f8fafc; border-bottom:1px solid #eee; color:#666;">Aucune colonne sélectionnée</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding:10px; color:#666;">Ajoute au moins une famille ou sous-famille pour afficher ses valeurs.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style="margin-top:10px; display:flex; align-items:center; gap:10px;">
                    <button class="btn btn-primary" id="btn-create-coupling-link">Créer un nouveau lien</button>
                    <button class="btn btn-outline" id="btn-toggle-show-all-links">Afficher tous les liens</button>
                    <span id="coupling-link-help" style="font-size:12px; color:#64748b;">Crée un lien puis clique les options: sauvegarde automatique sur le lien actif.</span>
                </div>
                <div style="margin-top:10px; border:1px solid #e5e7eb; border-radius:8px; padding:10px; background:#fff;">
                    <div id="coupling-links-list" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
                </div>
            `;

            if (!window.__ugapCouplingColumnState || typeof window.__ugapCouplingColumnState !== 'object') {
                window.__ugapCouplingColumnState = {};
            }
            const state = window.__ugapCouplingColumnState;
            const stored = getCouplingRules().map((c, idx) => normalizeCoupling(c, idx));
            if (!Array.isArray(state.couplings) || state.couplings.length === 0) {
                state.couplings = stored.length ? stored : [normalizeCoupling({ name: 'Couplage 1' }, 0)];
            }
            if (!state.activeCouplingId || !state.couplings.some((c) => c.id === state.activeCouplingId)) {
                state.activeCouplingId = state.couplings[0]?.id || '';
            }
            if (typeof state.editingLinkId !== 'string') state.editingLinkId = '';
            if (typeof state.showAllLinks !== 'boolean') state.showAllLinks = false;
            if (typeof state.hoveredLinkId !== 'string') state.hoveredLinkId = '';

            const persistCouplings = () => {
                setCouplingRules(state.couplings || []);
                updateCouplingsTabWarningBadge();
            };
            const getActiveCoupling = () => state.couplings.find((c) => c.id === state.activeCouplingId) || state.couplings[0];
            const ensureActiveLinkSelection = () => {
                const coupling = getActiveCoupling();
                if (!coupling) return;
                const links = Array.isArray(coupling.links) ? coupling.links : [];
                if (!links.length) {
                    state.editingLinkId = '';
                    coupling.selectedMasterItems = [];
                    coupling.selectedSlaveItems = [];
                    return;
                }
                const currentExists = links.some((lnk) => String(lnk?.id || '') === String(state.editingLinkId || ''));
                if (currentExists) return;
                const first = links[0];
                state.editingLinkId = String(first?.id || '');
                coupling.selectedMasterItems = Array.isArray(first?.masterItems) ? first.masterItems.slice() : [];
                coupling.selectedSlaveItems = Array.isArray(first?.slaveItems) ? first.slaveItems.slice() : [];
            };

            const table = root.querySelector('#coupling-columns-table');
            const couplingNameInput = root.querySelector('#coupling-name-input');
            const couplingListRoot = root.querySelector('#coupling-list');
            const linkHelp = root.querySelector('#coupling-link-help');
            const linksListRoot = root.querySelector('#coupling-links-list');
            const btnToggleShowAllLinks = root.querySelector('#btn-toggle-show-all-links');
            const splitCouplingItemKey = (value) => {
                const raw = String(value || '');
                const sep = raw.lastIndexOf('::');
                if (sep < 0) return { colKey: '', optId: '' };
                return {
                    colKey: raw.slice(0, sep),
                    optId: normalizeLegacyCouplingItemOptionId(raw.slice(sep + 2))
                };
            };
            const syncLabelsForCoupling = (coupling) => {
                if (!coupling) return;
                coupling.links = (Array.isArray(coupling.links) ? coupling.links : []).map((lnk, idx) => {
                    const normalized = normalizeLink(lnk, idx);
                    normalized.masterLabels = normalized.masterItems.map(resolveLabel);
                    normalized.slaveLabels = normalized.slaveItems.map(resolveLabel);
                    return normalized;
                });
            };
            const sanitizeCouplingsAgainstCurrentOptions = () => {
                const allowedColumns = new Set((selectableColumns || []).map((c) => String(c.key || '')));
                const allowedItemsByColumn = new Map(
                    (selectableColumns || []).map((c) => [
                        String(c.key || ''),
                        new Set((c.options || []).map((o) => String(o?.id || '')))
                    ])
                );
                const isValidItemKey = (value) => {
                    const normalized = normalizeLegacyCouplingItemKey(value);
                    const { colKey, optId } = splitCouplingItemKey(normalized);
                    if (!colKey || !optId) return false;
                    const allowedItems = allowedItemsByColumn.get(colKey);
                    return !!(allowedItems && allowedItems.has(String(optId)));
                };

                let changed = false;
                state.couplings = (Array.isArray(state.couplings) ? state.couplings : []).map((raw, idx) => {
                    const coupling = normalizeCoupling(raw, idx);
                    const before = JSON.stringify(coupling);

                    coupling.selectedFamilies = (coupling.selectedFamilies || []).filter((k) => allowedColumns.has(String(k)));
                    coupling.masterColumns = (coupling.masterColumns || []).filter((k) => coupling.selectedFamilies.includes(String(k)));
                    coupling.selectedMasterItems = (coupling.selectedMasterItems || []).map(normalizeLegacyCouplingItemKey).filter(isValidItemKey);
                    coupling.selectedSlaveItems = (coupling.selectedSlaveItems || []).map(normalizeLegacyCouplingItemKey).filter(isValidItemKey);
                    coupling.links = (coupling.links || [])
                        .map((lnk, lIdx) => normalizeLink(lnk, lIdx))
                        .map((lnk) => ({
                            ...lnk,
                            masterItems: (lnk.masterItems || []).map(normalizeLegacyCouplingItemKey).filter(isValidItemKey),
                            slaveItems: (lnk.slaveItems || []).map(normalizeLegacyCouplingItemKey).filter(isValidItemKey)
                        }))
                        .filter((lnk) => (lnk.masterItems || []).length > 0 || (lnk.slaveItems || []).length > 0);
                    syncLabelsForCoupling(coupling);

                    if (before !== JSON.stringify(coupling)) changed = true;
                    return coupling;
                });

                if (state.editingLinkId) {
                    const active = getActiveCoupling();
                    const exists = (active?.links || []).some((lnk) => String(lnk?.id || '') === String(state.editingLinkId));
                    if (!exists) {
                        state.editingLinkId = '';
                        changed = true;
                    }
                }

                if (changed) {
                    persistCouplings();
                }
            };
            const applyCurrentSelectionToEditingLink = () => {
                const coupling = getActiveCoupling();
                if (!coupling || !state.editingLinkId) return;
                const idx = (coupling.links || []).findIndex((lnk) => String(lnk?.id || '') === String(state.editingLinkId));
                if (idx < 0) return;
                const masterSelected = (coupling.selectedMasterItems || []).filter(Boolean);
                const slaveSelected = (coupling.selectedSlaveItems || []).filter(Boolean);
                coupling.links[idx] = {
                    ...coupling.links[idx],
                    masterItems: masterSelected,
                    slaveItems: slaveSelected,
                    masterLabels: masterSelected.map(resolveLabel),
                    slaveLabels: slaveSelected.map(resolveLabel)
                };
                syncLabelsForCoupling(coupling);
                persistCouplings();
            };
            const renderCouplingList = () => {
                if (!couplingListRoot) return;
                const couplings = Array.isArray(state.couplings) ? state.couplings : [];
                const getCouplingWarningCount = (coupling) => {
                    if (!coupling) return 0;
                    const selected = (Array.isArray(coupling.selectedFamilies) ? coupling.selectedFamilies : [])
                        .filter((k) => selectableColumns.some((f) => f.key === k));
                    if (!selected.length) return 0;
                    const linkedSet = new Set();
                    (Array.isArray(coupling.links) ? coupling.links : []).forEach((lnk) => {
                        (Array.isArray(lnk?.masterItems) ? lnk.masterItems : []).forEach((x) => linkedSet.add(normalizeLegacyCouplingItemKey(x)));
                        (Array.isArray(lnk?.slaveItems) ? lnk.slaveItems : []).forEach((x) => linkedSet.add(normalizeLegacyCouplingItemKey(x)));
                    });
                    return selected.reduce((acc, colKey) => {
                        const col = selectableColumns.find((c) => c.key === colKey);
                        if (!col) return acc;
                        const hasMissing = (Array.isArray(col.options) ? col.options : []).some((opt) => {
                            const itemKey = `${col.key}::${opt.id}`;
                            return !linkedSet.has(itemKey);
                        });
                        return hasMissing ? acc + 1 : acc;
                    }, 0);
                };
                couplingListRoot.innerHTML = couplings.map((c) => {
                    const active = c.id === state.activeCouplingId;
                    const warningCount = getCouplingWarningCount(c);
                    const warningBadge = warningCount > 0
                        ? ` <span title="${warningCount} colonne(s) avec options non liées" style="display:inline-flex; align-items:center; gap:4px; margin-left:6px; padding:2px 6px; border-radius:999px; background:#fffbeb; color:#92400e; border:1px solid #facc15; font-size:10px; font-weight:700;">⚠ ${warningCount}</span>`
                        : '';
                    return `
                        <button type="button" class="btn ${active ? 'btn-primary' : 'btn-outline'} coupling-switch-btn" data-coupling-id="${escapeHtml(c.id)}" style="display:inline-flex; align-items:center; gap:8px;">
                            <span>${escapeHtml(c.name || 'Couplage')}${warningBadge}</span>
                            <span class="coupling-delete-btn" data-coupling-id="${escapeHtml(c.id)}" title="Supprimer ce couplage" style="display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:999px; background:rgba(185,28,28,0.12); color:#b91c1c; font-weight:700; line-height:1; cursor:pointer;">×</span>
                        </button>
                    `;
                }).join('');
                root.querySelectorAll('.coupling-switch-btn').forEach((btn) => {
                    btn.onclick = null;
                    btn.addEventListener('click', () => {
                        const id = String(btn.getAttribute('data-coupling-id') || '').trim();
                        if (!id) return;
                        state.activeCouplingId = id;
                        state.editingLinkId = '';
                        ensureActiveLinkSelection();
                        renderCouplingList();
                        renderColumnsPreview();
                        renderLinksTable();
                    });
                });
                root.querySelectorAll('.coupling-delete-btn').forEach((btn) => {
                    btn.onclick = null;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const id = String(btn.getAttribute('data-coupling-id') || '').trim();
                        if (!id) return;
                        if (!confirm('Supprimer ce couplage ?')) return;
                        state.couplings = (Array.isArray(state.couplings) ? state.couplings : []).filter((c) => String(c?.id || '') !== id);
                        if (!state.couplings.length) {
                            state.couplings = [normalizeCoupling({ name: 'Couplage 1' }, 0)];
                        }
                        if (String(state.activeCouplingId || '') === id) {
                            state.activeCouplingId = String(state.couplings[0]?.id || '');
                            state.editingLinkId = '';
                        }
                        persistCouplings();
                        ensureActiveLinkSelection();
                        renderCouplingList();
                        renderColumnsPreview();
                        renderLinksTable();
                    });
                });
            };

            const renderColumnsPreview = () => {
                const coupling = getActiveCoupling();
                if (!coupling) return;
                if (couplingNameInput) couplingNameInput.value = String(coupling.name || '');
                if (btnToggleShowAllLinks) {
                    btnToggleShowAllLinks.textContent = state.showAllLinks ? 'Masquer couleurs liens' : 'Afficher tous les liens';
                }
                const selected = (coupling.selectedFamilies || []).filter((k) => selectableColumns.some((f) => f.key === k));
                coupling.selectedFamilies = selected;
                coupling.masterColumns = (coupling.masterColumns || []).filter((k) => selected.includes(k));
                const validItem = (value) => {
                    const { colKey, optId } = splitCouplingItemKey(value);
                    const col = selectableColumns.find((c) => c.key === colKey);
                    return !!(col && (col.options || []).some((o) => String(o.id) === String(optId)));
                };
                coupling.selectedMasterItems = (coupling.selectedMasterItems || []).filter(validItem);
                coupling.selectedSlaveItems = (coupling.selectedSlaveItems || []).filter(validItem);
                const linkedSet = new Set();
                (coupling.links || []).forEach((lnk) => {
                    (lnk.masterItems || []).forEach((x) => linkedSet.add(normalizeLegacyCouplingItemKey(x)));
                    (lnk.slaveItems || []).forEach((x) => linkedSet.add(normalizeLegacyCouplingItemKey(x)));
                });
                const colorPalette = ['#60a5fa', '#fca5a5', '#86efac', '#fcd34d', '#c4b5fd', '#67e8f9', '#fdba74', '#f9a8d4'];
                const getColorForLink = (idx) => colorPalette[idx % colorPalette.length];
                const linkColorMapByItem = new Map();
                (coupling.links || []).forEach((lnk, idx) => {
                    const color = getColorForLink(idx);
                    const allItems = [...(lnk.masterItems || []), ...(lnk.slaveItems || [])];
                    allItems.forEach((itemKey) => {
                        const key = normalizeLegacyCouplingItemKey(itemKey);
                        if (!key) return;
                        if (!linkColorMapByItem.has(key)) linkColorMapByItem.set(key, []);
                        const arr = linkColorMapByItem.get(key);
                        if (!arr.includes(color)) arr.push(color);
                    });
                });
                const hoveredLink = (coupling.links || []).find((lnk) => String(lnk?.id || '') === String(state.hoveredLinkId));
                const hoveredItemsSet = new Set([
                    ...((hoveredLink?.masterItems || []).map((x) => normalizeLegacyCouplingItemKey(x))),
                    ...((hoveredLink?.slaveItems || []).map((x) => normalizeLegacyCouplingItemKey(x)))
                ]);

                if (!table) return;
                const columns = selected.map((k) => selectableColumns.find((f) => f.key === k)).filter(Boolean);
                if (columns.length === 0) {
                    table.innerHTML = `
                        <thead><tr><th style="padding:8px; text-align:left; background:#f8fafc; border-bottom:1px solid #eee; color:#666;">Aucune colonne sélectionnée</th></tr></thead>
                        <tbody><tr><td style="padding:10px; color:#666;">Ajoute au moins une famille ou sous-famille pour afficher ses valeurs.</td></tr></tbody>
                    `;
                } else {
                    const maxRows = Math.max(...columns.map((c) => c.options.length), 1);
                    const headHtml = columns.map((c) => {
                        const isMaster = (coupling.masterColumns || []).includes(c.key);
                        const missingCount = (c.options || []).reduce((acc, opt) => {
                            const itemKey = `${c.key}::${opt.id}`;
                            return linkedSet.has(itemKey) ? acc : acc + 1;
                        }, 0);
                        const warningHtml = missingCount > 0
                            ? `<span title="${missingCount} option(s) sans lien dans cette colonne" style="display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:999px; background:#fffbeb; color:#92400e; border:1px solid #facc15; font-size:10px; font-weight:700;">⚠ ${missingCount}</span>`
                            : '<span style="display:inline-flex; align-items:center; padding:2px 6px; border-radius:999px; background:#ecfdf3; color:#166534; border:1px solid #86efac; font-size:10px; font-weight:700;">OK</span>';
                        return `
                            <th style="padding:8px; text-align:left; background:#f8fafc; border-bottom:1px solid #eee; vertical-align:top;">
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                                    <span>${escapeHtml(c.label)}</span>
                                    <button type="button" class="coupling-col-remove" data-family="${escapeHtml(c.key)}" style="border:none; background:transparent; color:#64748b; cursor:pointer; font-weight:700; font-size:14px;">×</button>
                                </div>
                                <div style="margin-top:6px;">${warningHtml}</div>
                                <label style="display:inline-flex; align-items:center; gap:5px; margin-top:6px; font-size:12px; color:#475569;">
                                    <input type="checkbox" class="coupling-col-master" data-family="${escapeHtml(c.key)}" ${isMaster ? 'checked' : ''}>
                                    Master
                                </label>
                            </th>
                        `;
                    }).join('');
                    const bodyRows = [];
                    for (let i = 0; i < maxRows; i += 1) {
                        const tds = columns.map((c) => {
                            const opt = c.options[i];
                            if (!opt) return `<td style="padding:8px; border-top:1px solid #f1f5f9;"></td>`;
                            const itemKey = `${c.key}::${opt.id}`;
                            const isMasterCol = (coupling.masterColumns || []).includes(c.key);
                            const selectedSet = new Set(isMasterCol ? (coupling.selectedMasterItems || []) : (coupling.selectedSlaveItems || []));
                            const active = selectedSet.has(itemKey);
                            const linkColors = state.showAllLinks ? (linkColorMapByItem.get(itemKey) || []) : [];
                            const isHoveredLinkedItem = state.showAllLinks && hoveredItemsSet.has(itemKey);
                            const hasHoverTarget = state.showAllLinks && !!hoveredLink;
                            let bg = '#fff';
                            if (linkColors.length === 1) {
                                bg = `${linkColors[0]}55`;
                            } else if (linkColors.length > 1) {
                                bg = `linear-gradient(135deg, ${linkColors.map((col, idx) => `${col}66 ${(idx * 100) / linkColors.length}% ${((idx + 1) * 100) / linkColors.length}%`).join(', ')})`;
                            }
                            let bd = linkColors.length ? (linkColors[0] || '#e5e7eb') : '#e5e7eb';
                            if (active && !state.showAllLinks) {
                                bd = isMasterCol ? '#2563eb' : '#dc2626';
                                bg = isMasterCol ? '#bfdbfe' : '#fecaca';
                            }
                            const hoverOpacity = hasHoverTarget ? (isHoveredLinkedItem ? '1' : '0.35') : '1';
                            const hoverShadow = isHoveredLinkedItem ? '0 0 0 3px rgba(15,23,42,0.18)' : 'none';
                            const mark = active
                                ? `<span style="font-weight:700; margin-left:8px; color:${state.showAllLinks ? '#0f172a' : '#16a34a'};">${state.showAllLinks ? '●' : '✓'}</span>`
                                : '';
                            return `<td style="padding:6px; border-top:1px solid #f1f5f9;">
                                <button type="button" class="coupling-item-btn" data-col="${escapeHtml(c.key)}" data-opt="${escapeHtml(opt.id)}" style="width:100%; text-align:left; border:2px solid ${bd}; background:${bg}; border-radius:8px; padding:7px 8px; cursor:${state.showAllLinks ? 'not-allowed' : 'pointer'}; font-weight:${active ? '600' : '400'}; display:flex; align-items:center; justify-content:space-between; gap:8px; opacity:${hoverOpacity}; box-shadow:${hoverShadow};">
                                    <span>${escapeHtml(opt.label)}</span>${mark}
                                </button>
                            </td>`;
                        }).join('');
                        bodyRows.push(`<tr>${tds}</tr>`);
                    }
                    table.innerHTML = `
                        <thead><tr>${headHtml}</tr></thead>
                        <tbody>${bodyRows.join('')}</tbody>
                    `;
                }

                root.querySelectorAll('.coupling-col-remove').forEach((btn) => {
                    btn.onclick = null;
                    btn.addEventListener('click', () => {
                        const family = String(btn.getAttribute('data-family') || '').trim();
                        coupling.selectedFamilies = (coupling.selectedFamilies || []).filter((k) => k !== family);
                        coupling.masterColumns = (coupling.masterColumns || []).filter((k) => k !== family);
                        persistCouplings();
                        renderColumnsPreview();
                    });
                });
                root.querySelectorAll('.coupling-col-master').forEach((cb) => {
                    cb.onchange = null;
                    cb.addEventListener('change', () => {
                        const family = String(cb.getAttribute('data-family') || '').trim();
                        if (!family) return;
                        const set = new Set(Array.isArray(coupling.masterColumns) ? coupling.masterColumns : []);
                        if (cb.checked) set.add(family);
                        else set.delete(family);
                        coupling.masterColumns = Array.from(set);
                        persistCouplings();
                        renderColumnsPreview();
                    });
                });
                root.querySelectorAll('.coupling-item-btn').forEach((btn) => {
                    btn.onclick = null;
                    btn.addEventListener('click', () => {
                        if (state.showAllLinks) {
                            showAlert('Sélectionner un seul lien pour permettre l’édition.', 'info');
                            return;
                        }
                        const col = String(btn.getAttribute('data-col') || '').trim();
                        const opt = String(btn.getAttribute('data-opt') || '').trim();
                        if (!col || !opt) return;
                        const itemKey = `${col}::${opt}`;
                        const isMasterCol = (coupling.masterColumns || []).includes(col);
                        const masterSet = new Set(coupling.selectedMasterItems || []);
                        const slaveSet = new Set(coupling.selectedSlaveItems || []);
                        if (isMasterCol) {
                            if (masterSet.has(itemKey)) masterSet.delete(itemKey);
                            else masterSet.add(itemKey);
                        } else {
                            if (slaveSet.has(itemKey)) slaveSet.delete(itemKey);
                            else slaveSet.add(itemKey);
                        }
                        coupling.selectedMasterItems = Array.from(masterSet);
                        coupling.selectedSlaveItems = Array.from(slaveSet);
                        persistCouplings();
                        renderColumnsPreview();
                    });
                });
                const masterCount = (coupling.selectedMasterItems || []).length;
                const slaveCount = (coupling.selectedSlaveItems || []).length;
                const links = Array.isArray(coupling.links) ? coupling.links : [];
                const activeIdx = links.findIndex((lnk) => String(lnk?.id || '') === String(state.editingLinkId));
                const activeLabel = activeIdx >= 0 ? `Lien ${activeIdx + 1}` : 'Aucun lien actif';
                if (linkHelp) linkHelp.textContent = `${activeLabel} | Sélection: ${masterCount} master | ${slaveCount} slave | Sauvegarde auto`;
            };

            const resolveLabel = (v) => {
                const { colKey, optId } = splitCouplingItemKey(v);
                const col = selectableColumns.find((c) => c.key === colKey);
                const opt = col?.options?.find((o) => String(o.id) === String(optId));
                return `${col?.label || colKey} -> ${opt?.label || optId}`;
            };

            // Nettoie automatiquement les références orphelines (options supprimées).
            sanitizeCouplingsAgainstCurrentOptions();
            // Garantit un lien actif cohérent avec la puce sélectionnée.
            ensureActiveLinkSelection();

            const renderLinksTable = () => {
                if (!linksListRoot) return;
                const coupling = getActiveCoupling();
                const links = Array.isArray(coupling?.links) ? coupling.links : [];
                const colorPalette = ['#60a5fa', '#fca5a5', '#86efac', '#fcd34d', '#c4b5fd', '#67e8f9', '#fdba74', '#f9a8d4'];
                const getColorForLink = (idx) => colorPalette[idx % colorPalette.length];
                linksListRoot.innerHTML = links.length === 0
                    ? '<span style="color:#666; font-size:12px;">Aucun lien.</span>'
                    : links.map((lnk, idx) => `
                        <div class="coupling-link-chip" style="display:inline-flex; align-items:center; border:1px solid ${state.showAllLinks ? getColorForLink(idx) : '#cbd5e1'}; border-radius:999px; overflow:hidden; background:${state.showAllLinks ? `${getColorForLink(idx)}22` : '#fff'};">
                            <button class="coupling-link-edit" data-link-id="${escapeHtml(String(lnk.id || ''))}" style="border:none; background:${String(state.editingLinkId) === String(lnk.id || '') ? '#dbeafe' : 'transparent'}; padding:6px 10px; cursor:pointer; font-weight:${String(state.editingLinkId) === String(lnk.id || '') ? '700' : '500'}; color:#0f172a;">Lien ${idx + 1}</button>
                            <button class="coupling-link-del" data-link-id="${escapeHtml(String(lnk.id || ''))}" title="Supprimer ce lien" style="border:none; border-left:1px solid ${state.showAllLinks ? getColorForLink(idx) : '#cbd5e1'}; background:transparent; padding:6px 8px; cursor:pointer; color:#b91c1c; font-weight:700;">×</button>
                        </div>
                    `).join('');
                root.querySelectorAll('.coupling-link-edit').forEach((btn) => {
                    btn.onclick = null;
                    btn.addEventListener('click', () => {
                        const linkId = String(btn.getAttribute('data-link-id') || '').trim();
                        if (!linkId) return;
                        const target = (coupling.links || []).find((x) => String(x?.id || '') === linkId);
                        if (!target) return;
                        if (state.showAllLinks) {
                            state.showAllLinks = false;
                            state.hoveredLinkId = '';
                        }
                        coupling.selectedMasterItems = Array.isArray(target.masterItems) ? target.masterItems.slice() : [];
                        coupling.selectedSlaveItems = Array.isArray(target.slaveItems) ? target.slaveItems.slice() : [];
                        state.editingLinkId = linkId;
                        renderColumnsPreview();
                        renderLinksTable();
                    });
                    btn.addEventListener('mouseenter', () => {
                        if (!state.showAllLinks) return;
                        state.hoveredLinkId = String(btn.getAttribute('data-link-id') || '').trim();
                        renderColumnsPreview();
                    });
                    btn.addEventListener('mouseleave', () => {
                        if (!state.showAllLinks) return;
                        state.hoveredLinkId = '';
                        renderColumnsPreview();
                    });
                });
                root.querySelectorAll('.coupling-link-del').forEach((btn) => {
                    btn.onclick = null;
                    btn.addEventListener('click', () => {
                        const linkId = String(btn.getAttribute('data-link-id') || '').trim();
                        if (!linkId) return;
                        coupling.links = (coupling.links || []).filter((lnk) => String(lnk?.id || '') !== linkId);
                        if (state.editingLinkId === linkId) state.editingLinkId = '';
                        if (!state.editingLinkId && coupling.links.length > 0) {
                            state.editingLinkId = String(coupling.links[0].id || '');
                            const first = coupling.links[0];
                            coupling.selectedMasterItems = Array.isArray(first?.masterItems) ? first.masterItems.slice() : [];
                            coupling.selectedSlaveItems = Array.isArray(first?.slaveItems) ? first.slaveItems.slice() : [];
                        }
                        persistCouplings();
                        renderColumnsPreview();
                        renderLinksTable();
                    });
                });
            };

            root.querySelector('#btn-save-coupling-name')?.addEventListener('click', () => {
                const coupling = getActiveCoupling();
                if (!coupling) return;
                const nextName = String(couplingNameInput?.value || '').trim();
                if (!nextName) {
                    showAlert('Le nom du couplage est requis.', 'warning');
                    return;
                }
                coupling.name = nextName;
                persistCouplings();
                renderCouplingList();
                showAlert('Nom du couplage enregistré.', 'success');
            });
            root.querySelector('#btn-create-coupling')?.addEventListener('click', () => {
                const nextIdx = (state.couplings || []).length + 1;
                const newCoupling = normalizeCoupling({ name: `Couplage ${nextIdx}` }, nextIdx);
                state.couplings.push(newCoupling);
                state.activeCouplingId = newCoupling.id;
                state.editingLinkId = '';
                persistCouplings();
                renderCouplingList();
                renderColumnsPreview();
                renderLinksTable();
            });

            root.querySelector('#btn-add-coupling-column')?.addEventListener('click', () => {
                const coupling = getActiveCoupling();
                if (!coupling) return;
                const select = root.querySelector('#coupling-family-column-select');
                const family = String(select?.value || '').trim();
                if (!family) {
                    showAlert('Choisis une famille ou sous-famille.', 'warning');
                    return;
                }
                if (!coupling.selectedFamilies.includes(family)) coupling.selectedFamilies.push(family);
                persistCouplings();
                renderColumnsPreview();
                renderLinksTable();
            });
            root.querySelector('#coupling-family-column-select')?.addEventListener('change', () => {
                const coupling = getActiveCoupling();
                if (!coupling) return;
                const select = root.querySelector('#coupling-family-column-select');
                const family = String(select?.value || '').trim();
                if (!family) return;
                if (!coupling.selectedFamilies.includes(family)) {
                    coupling.selectedFamilies.push(family);
                    persistCouplings();
                    renderColumnsPreview();
                    renderLinksTable();
                }
                if (select) select.value = '';
            });

            renderCouplingList();
            renderColumnsPreview();
            renderLinksTable();

            root.querySelector('#btn-create-coupling-link')?.addEventListener('click', () => {
                const coupling = getActiveCoupling();
                if (!coupling) return;
                const payload = {
                    id: `link_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
                    masterItems: [],
                    slaveItems: [],
                    masterLabels: [],
                    slaveLabels: []
                };
                coupling.links.push(payload);
                coupling.selectedMasterItems = [];
                coupling.selectedSlaveItems = [];
                state.editingLinkId = payload.id;
                persistCouplings();
                renderColumnsPreview();
                renderLinksTable();
            });
            root.querySelector('#btn-toggle-show-all-links')?.addEventListener('click', () => {
                state.showAllLinks = !state.showAllLinks;
                if (!state.showAllLinks) state.hoveredLinkId = '';
                renderColumnsPreview();
                renderLinksTable();
            });

            root.querySelector('#coupling-columns-table')?.addEventListener('click', () => {
                applyCurrentSelectionToEditingLink();
                renderLinksTable();
            });
        }

        // Import Excel
        function setWorkspaceMode(mode) {
            workspaceMode = (mode === 'import') ? 'import' : 'backoffice';
            const statsCard = document.getElementById('legacy-stats-card');
            const backofficeCard = document.getElementById('legacy-backoffice-card');
            const importWorkflowPanel = document.getElementById('import-workflow-panel');
            const importModeBtn = document.getElementById('btn-import-mode');
            const backofficeModeBtn = document.getElementById('btn-backoffice-mode');
            if (statsCard) statsCard.style.display = workspaceMode === 'import' ? 'none' : 'block';
            if (backofficeCard && !isEmbeddedMode()) backofficeCard.style.display = workspaceMode === 'import' ? 'none' : 'block';
            const importPanel = document.getElementById('import-workflow-panel');
            if (importPanel) importPanel.style.display = 'none';
            if (importModeBtn) importModeBtn.style.display = workspaceMode === 'import' ? 'none' : 'inline-flex';
            if (backofficeModeBtn) backofficeModeBtn.style.display = workspaceMode === 'import' ? 'inline-flex' : 'none';
            // Synchronise l'indicateur de reprise selon le mode (évite un bouton "Import en cours" persistant).
            renderImportStagingIndicator(currentImportStaging);

            // En mode import, on projette les donnees staging dans currentData pour reutiliser
            // les composants historiques (ex: onglet "Modele de base").
            if (workspaceMode === 'import' && currentImportStaging) {
                currentData = normalizeUgapDataContract({
                    models: Array.isArray(currentImportStaging.models) ? currentImportStaging.models : [],
                    categories: Array.isArray(currentImportStaging.categories) ? currentImportStaging.categories : [],
                    businessViews: Array.isArray(currentImportStaging.businessViews) ? currentImportStaging.businessViews : [],
                    dependencyRules: Array.isArray(currentImportStaging.dependencyRules) ? currentImportStaging.dependencyRules : [],
                    uiState: currentImportStaging.uiState || {}
                });
            } else if (workspaceMode === 'backoffice') {
                if (__lastLoadDataSnapshot) {
                    currentData = normalizeUgapDataContract(__lastLoadDataSnapshot);
                }
                const activeTab = document.querySelector('.tab.active');
                renderActiveTab(activeTab ? activeTab.getAttribute('data-tab') : 'famille');
                populateCategorySelect();
                updateStats();
                updateAllTabWarningBadges();
            }
        }

        function renderImportStagingIndicator(staging) {
            const badgeEl = document.getElementById('import-staging-badge');
            const metaEl = document.getElementById('import-staging-meta');
            const progressEl = document.getElementById('import-staging-progress');
            const resumeBtn = document.getElementById('btn-resume-import');
            if (!badgeEl || !metaEl || !resumeBtn || !progressEl) return;

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
            const importedAt = staging?.source?.importedAt ? new Date(staging.source.importedAt).toLocaleString('fr-FR') : '';
            const statusLabel = {
                draft: 'A valider',
                in_review: 'En cours',
                validated: 'Valide',
                published: 'Publie'
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
            const validatedModelsCount = models.filter((m) => importModelRowDisplayValidated(String(m?.id || ''), validatedModelIds)).length;

            const categories = Array.isArray(staging?.categories) ? staging.categories : [];
            const allOptions = categories.flatMap((cat) => Array.isArray(cat?.options) ? cat.options : []);
            const totalOptions = allOptions.length;
            const configuredOptionsCount = allOptions.filter((opt) => {
                const family = String(opt?.familyLabel || '').trim();
                const subFamily = String(opt?.subFamily || '').trim();
                return !!family || !!subFamily;
            }).length;

            const baseConfiguredModelIds = new Set();
            allOptions.forEach((opt) => {
                if (!opt?.baseIncluded) return;
                const compatible = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
                compatible.forEach((modelId) => baseConfiguredModelIds.add(String(modelId)));
            });
            let baseModelsConfiguredCount = 0;
            if (validatedModelIds.size > 0) {
                validatedModelIds.forEach((mid) => {
                    if (baseConfiguredModelIds.has(mid)) baseModelsConfiguredCount += 1;
                });
            } else {
                baseModelsConfiguredCount = baseConfiguredModelIds.size;
            }
            progressEl.textContent = `${validatedModelsCount}/${models.length} modeles valides - ${baseModelsConfiguredCount} modeles de base configures - ${configuredOptionsCount}/${totalOptions} options configurees`;
            if (status !== 'published') {
                if (workspaceMode === 'import') {
                    resumeBtn.style.display = 'none';
                } else {
                    resumeBtn.style.display = 'inline-flex';
                    resumeBtn.textContent = 'Reprendre l\'import';
                    resumeBtn.disabled = false;
                    resumeBtn.style.opacity = '';
                    resumeBtn.style.cursor = '';
                }
            } else {
                resumeBtn.style.display = 'none';
            }
        }

        function switchImportWorkflowStep(step) {
            const legacyStepRedirect = { 'families-template': 'families-tri', 'families-base': 'families-tri', 'families': 'families-tri' };
            let stepRaw = String(step || '');
            if (legacyStepRedirect[stepRaw]) stepRaw = legacyStepRedirect[stepRaw];
            const allowed = new Set(['models', 'import-base-options', 'minorations', 'majorations', 'families-unmatched', 'validate', 'families-tri']);
            const next = allowed.has(stepRaw) ? stepRaw : 'models';
            importWorkflowState.step = next;
            publishImportWorkflowGlobals();
            document.querySelectorAll('[data-import-step]').forEach((btn) => {
                const s = btn.getAttribute('data-import-step');
                btn.classList.toggle('btn-primary', s === next);
                btn.classList.toggle('btn-outline', s !== next);
            });
            const modelsContent = document.getElementById('import-workflow-content-models');
            const familiesContent = document.getElementById('import-workflow-content-families');
            const familySteps = new Set(['import-base-options', 'minorations', 'majorations', 'families-tri', 'families-unmatched', 'validate']);
            if (modelsContent) modelsContent.style.display = next === 'models' ? 'block' : 'none';
            if (familiesContent) familiesContent.style.display = familySteps.has(next) ? 'block' : 'none';
            if (next === 'families-tri') {
                const triState = getImportFamilyTriState();
                triState.activeTab = 'tri';
            }
        }

        function toggleImportModelSelection(modelId, checked) {
            const id = String(modelId || '').trim();
            if (!id) return;
            const selected = new Set(importWorkflowState.selectedModelIds || []);
            if (checked) selected.add(id); else selected.delete(id);
            importWorkflowState.selectedModelIds = Array.from(selected);
        }

        function selectAllImportModelsVisible() {
            const checkboxes = Array.from(
                document.querySelectorAll('#import-workflow-content-models input[data-import-model-id]:not(:disabled)')
            );
            if (!checkboxes.length) {
                showAlert('Aucun modele a selectionner.', 'info');
                return;
            }
            const selected = new Set(importWorkflowState.selectedModelIds || []);
            checkboxes.forEach((el) => {
                const encodedId = String(el?.getAttribute('data-import-model-id') || '').trim();
                let id = encodedId;
                try { id = decodeURIComponent(encodedId); } catch (_) {}
                if (!id) return;
                el.checked = true;
                selected.add(String(id).trim());
            });
            importWorkflowState.selectedModelIds = Array.from(selected);
        }

        function toggleImportBaseModelSelection(modelId, checked) {
            const id = String(modelId || '').trim();
            if (!id) return;
            const selected = new Set(importWorkflowState.selectedBaseModelIds || []);
            if (checked) selected.add(id); else selected.delete(id);
            importWorkflowState.selectedBaseModelIds = Array.from(selected);
        }

        function onImportModelStatusFilterChange(value) {
            const v = String(value || '').trim();
            importWorkflowState.modelStatusFilter = v === 'all' ? 'all' : 'to_validate';
            renderImportWorkflow();
        }

        /** Etat affiche import: Valide si le modele est dans progress.validatedModelIds du staging. */
        function importModelRowDisplayValidated(modelId, stagingValidatedIdSet) {
            const id = String(modelId || '').trim();
            return !!id && stagingValidatedIdSet.has(id);
        }

        function collectImportModelPriceUpdates() {
            const rows = Array.from(document.querySelectorAll('.import-model-price-input'));
            return rows.map((input) => {
                const encodedId = String(input?.getAttribute('data-model-id') || '').trim();
                let id = encodedId;
                try { id = decodeURIComponent(encodedId); } catch (_) {}
                const raw = String(input?.value || '').replace(',', '.').trim();
                const parsed = Number(raw);
                return {
                    id,
                    basePrice: Number.isFinite(parsed) ? parsed : 0
                };
            }).filter((row) => row.id);
        }

        function formatImportModelMoneyInput(inputEl) {
            const el = inputEl;
            if (!el) return;
            const raw = String(el.value || '').replace(',', '.').trim();
            const parsed = Number(raw);
            const safe = Number.isFinite(parsed) ? parsed : 0;
            el.dataset.rawValue = Number.isFinite(parsed) ? String(parsed) : '0';
            el.value = safe.toFixed(2);
        }

        function focusImportModelMoneyInput(inputEl) {
            const el = inputEl;
            if (!el) return;
            const raw = String(el.dataset.rawValue || '').trim();
            if (raw) {
                el.value = raw;
                return;
            }
            const parsed = Number(String(el.value || '').replace(',', '.').trim());
            if (Number.isFinite(parsed)) {
                el.value = String(parsed);
            }
        }

        function normalizeFamilyCandidateToken(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ' ')
                .trim();
        }

        function toDisplayFamilyCandidate(value) {
            const v = String(value || '').trim();
            if (!v) return '';
            return v.charAt(0).toUpperCase() + v.slice(1);
        }

        function detectImportFamilySuggestions() {
            const minCount = Math.max(1, Number(importWorkflowState.familyDetectionMinCount || 3));
            const categories = Array.isArray(currentImportStaging?.categories) ? currentImportStaging.categories : [];
            const allOptions = categories.flatMap((cat) => Array.isArray(cat?.options) ? cat.options : []);
            const stopWords = new Set([
                'de', 'des', 'du', 'la', 'le', 'les', 'et', 'ou', 'en', 'a', 'au', 'aux',
                'pour', 'avec', 'sans', 'sur', 'par', 'un', 'une', 'd', 'l', 'type', 'poste',
                'option', 'kit', 'pack', 'mm', 'cm', 'm', 'x', 'plus', 'moins', 'value', 'non'
            ]);
            const counts = new Map();
            allOptions.forEach((opt) => {
                const label = normalizeFamilyCandidateToken(opt?.name || '');
                if (!label) return;
                const tokens = label.split(/\s+/g).filter((t) => t.length >= 4 && !stopWords.has(t));
                const uniq = Array.from(new Set(tokens));
                uniq.forEach((token) => counts.set(token, Number(counts.get(token) || 0) + 1));
            });
            const existingFamilies = Array.isArray(__lastLoadDataSnapshot?.uiState?.families)
                ? __lastLoadDataSnapshot.uiState.families
                : [];
            const existingNormalized = new Set(
                existingFamilies
                    .map((f) => normalizeFamilyCandidateToken(String(f?.familyLabel || '')))
                    .filter(Boolean)
            );
            return Array.from(counts.entries())
                .filter(([, count]) => Number(count) >= minCount)
                .sort((a, b) => Number(b[1]) - Number(a[1]) || String(a[0]).localeCompare(String(b[0]), 'fr', { sensitivity: 'base' }))
                .map(([token, count]) => {
                    const label = toDisplayFamilyCandidate(token);
                    const normalized = normalizeFamilyCandidateToken(label);
                    return {
                        token,
                        count: Number(count),
                        suggestedFamilyLabel: label,
                        alreadyExists: existingNormalized.has(normalized)
                    };
                });
        }

        function onImportFamilyDetectionMinCountChange(value) {
            const n = Number(value);
            importWorkflowState.familyDetectionMinCount = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 3;
            renderImportWorkflow();
        }

        function getSavedBoatTemplates() {
            try {
                const raw = memoryStoreGetItem('ugap.templateBateau.saved');
                const arr = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(arr)) return [];
                return arr
                    .map((t) => ({
                        id: String(t?.id || '').trim(),
                        label: String(t?.label || '').trim(),
                        snapshot: t?.snapshot && typeof t.snapshot === 'object' ? t.snapshot : {}
                    }))
                    .filter((t) => t.id && t.label);
            } catch (_) {
                return [];
            }
        }

        function setSavedBoatTemplates(list) {
            try {
                const safe = Array.isArray(list) ? list : [];
                memoryStoreSetItem('ugap.templateBateau.saved', JSON.stringify(safe));
            } catch (_) {}
        }

        function getImportFamilyTriState() {
            if (!window.__importFamilyTriState || typeof window.__importFamilyTriState !== 'object') {
                window.__importFamilyTriState = {
                    selectedTemplateFamilyLabel: '',
                    assignmentsByOptionId: {},
                    keywordsByFamily: {},
                    expandedByFamily: {},
                    activeTab: 'template',
                    templateByModelId: {},
                    customTemplates: [],
                    boatTemplates: getSavedBoatTemplates(),
                    newTemplateName: '',
                    draftTemplateName: '',
                    draftSourceTemplateId: '',
                    draftFamilies: []
                };
            }
            return window.__importFamilyTriState;
        }

        function switchImportFamilyTriTab(tabName) {
            const state = getImportFamilyTriState();
            const next = tabName === 'template' ? 'template' : 'tri';
            state.activeTab = next;
            renderImportWorkflow();
        }

        function getImportOptionsForFamilyTri() {
            const categories = Array.isArray(currentImportStaging?.categories) ? currentImportStaging.categories : [];
            const rows = [];
            const isPrOption = (opt) => {
                const name = String(opt?.name || '').trim();
                return /^PR\s/i.test(name);
            };
            categories.forEach((cat) => {
                const opts = Array.isArray(cat?.options) ? cat.options : [];
                opts.forEach((opt) => {
                    const id = String(opt?.id || '').trim();
                    if (!id) return;
                    if (isPrOption(opt)) return;
                    rows.push({
                        id,
                        name: String(opt?.name || id).trim(),
                        refUgap: String(opt?.refUgap || '').trim(),
                        sourceFamily: String(opt?.familyLabel || '').trim()
                    });
                });
            });
            return rows;
        }

        function getImportPrOptionsForFamilyTri() {
            const categories = Array.isArray(currentImportStaging?.categories) ? currentImportStaging.categories : [];
            const rows = [];
            categories.forEach((cat) => {
                const opts = Array.isArray(cat?.options) ? cat.options : [];
                opts.forEach((opt) => {
                    const id = String(opt?.id || '').trim();
                    if (!id) return;
                    const name = String(opt?.name || id).trim();
                    if (!/^PR\s/i.test(name)) return;
                    rows.push({
                        id,
                        name,
                        refUgap: String(opt?.refUgap || '').trim()
                    });
                });
            });
            return rows;
        }

        function runImportFamiliesKeywordTri() {
            const state = getImportFamilyTriState();
            const families = getFamilleValidatedFamilies();
            const options = getImportOptionsForFamilyTri();
            const familyLabels = (Array.isArray(families) ? families : [])
                .map((f) => String(f?.familyLabel || '').trim())
                .filter(Boolean);
            const nextAssignments = {};
            options.forEach((opt) => {
                const text = normalizeFamilyCandidateToken(`${opt.name} ${opt.refUgap}`);
                let best = '';
                let bestScore = 0;
                familyLabels.forEach((label) => {
                    const custom = String(state.keywordsByFamily?.[label] || '').trim();
                    const autoKeywords = normalizeFamilyCandidateToken(label).split(/\s+/).filter((x) => x && x.length >= 3);
                    const customKeywords = custom.split(/[\n,;|]+/g).map((x) => normalizeFamilyCandidateToken(x)).filter(Boolean);
                    const keywords = Array.from(new Set([...autoKeywords, ...customKeywords]));
                    let score = 0;
                    keywords.forEach((kw) => {
                        if (!kw) return;
                        if (text.includes(kw)) score += Math.max(1, kw.length);
                    });
                    if (score > bestScore) {
                        bestScore = score;
                        best = label;
                    }
                });
                nextAssignments[opt.id] = best || '';
            });
            state.assignmentsByOptionId = nextAssignments;
        }

        function getImportAssignableTemplates() {
            const state = getImportFamilyTriState();
            return Array.isArray(state.boatTemplates) ? state.boatTemplates : [];
        }

        function cloneImportTemplateFamilies(templateId) {
            const id = String(templateId || '').trim();
            if (!id) return [];
            const tpl = getImportAssignableTemplates().find((t) => String(t?.id || '').trim() === id);
            if (!tpl) return [];
            const families = Array.isArray(tpl.families) ? tpl.families : [];
            return families.map((f) => ({
                familyLabel: String(f?.familyLabel || '').trim(),
                objectName: String(f?.objectName || '').trim(),
                decisionGroups: normalizeFamilyDecisionGroups(f?.decisionGroups)
            })).filter((f) => f.familyLabel);
        }

        function onImportTemplateDraftConfigChange() {
            const state = getImportFamilyTriState();
            const name = String(document.getElementById('import-new-template-label')?.value || '').trim();
            const sourceId = String(document.getElementById('import-template-source-select')?.value || '').trim();
            const previousSource = String(state.draftSourceTemplateId || '').trim();
            state.draftTemplateName = name;
            state.draftSourceTemplateId = sourceId;
            if (sourceId && sourceId !== previousSource) {
                state.draftFamilies = cloneImportTemplateFamilies(sourceId);
            }
            renderImportWorkflow();
        }

        function onImportModelTemplateAssignmentChange(modelId, familyLabel) {
            const mid = String(modelId || '').trim();
            if (!mid) return;
            const state = getImportFamilyTriState();
            state.templateByModelId[mid] = String(familyLabel || '').trim();
        }

        function onImportTemplateNameInput(value) {
            const state = getImportFamilyTriState();
            state.newTemplateName = String(value || '').trim();
        }

        function onImportTemplateCopySelect(value) {
            const state = getImportFamilyTriState();
            const selected = String(value || '').trim();
            state.draftSourceTemplateId = selected;
            if (selected && !String(state.newTemplateName || '').trim()) {
                const tpl = getImportAssignableTemplates().find((t) => String(t?.id || '').trim() === selected);
                if (tpl) state.newTemplateName = `${String(tpl.label || 'Template')} copie`;
            }
            renderImportWorkflow();
        }

        function saveImportTemplateNamedFromCurrentFamilies() {
            const state = getImportFamilyTriState();
            const label = String(state.newTemplateName || '').trim();
            if (!label) {
                showAlert('Nom du template requis.', 'warning');
                return;
            }
            const existing = getImportAssignableTemplates();
            if (existing.some((t) => String(t?.label || '').trim().toLowerCase() === label.toLowerCase())) {
                showAlert('Un template avec ce nom existe déjà.', 'info');
                return;
            }
            const families = (Array.isArray(getFamilleValidatedFamilies()) ? getFamilleValidatedFamilies() : [])
                .map((f) => ({
                    familyLabel: String(f?.familyLabel || '').trim(),
                    objectName: String(f?.objectName || '').trim(),
                    decisionGroups: normalizeFamilyDecisionGroups(f?.decisionGroups)
                }))
                .filter((f) => f.familyLabel);
            const genericModelId = getGenericBaseTemplateModelId();
            const baseOptionIds = getAllOptionsForSummary()
                .map((opt) => ({ opt, rec: findOptionRecordById(opt.id)?.option || null }))
                .filter(({ rec }) => {
                    const comp = Array.isArray(rec?.compatibleModels) ? rec.compatibleModels.map((x) => String(x)) : [];
                    return !!rec && !!rec.baseIncluded && comp.includes(genericModelId);
                })
                .map(({ opt }) => String(opt?.id || '').trim())
                .filter(Boolean);
            if (!families.length && !baseOptionIds.length) {
                showAlert('Aucune donnée template à enregistrer.', 'warning');
                return;
            }
            const id = `custom:${slugifyFamilyDecisionGroupId(label) || 'template'}:${Date.now()}`;
            const next = Array.isArray(state.boatTemplates) ? state.boatTemplates.slice() : [];
            next.push({
                id,
                label,
                snapshot: {
                    families,
                    baseOptionIds
                }
            });
            state.boatTemplates = next;
            setSavedBoatTemplates(next);
            state.newTemplateName = '';
            showAlert('Template enregistré.', 'success');
            renderImportWorkflow();
        }

        function addImportFamilyToTemplateDraft() {
            const state = getImportFamilyTriState();
            const familyLabel = String(document.getElementById('import-template-family-label')?.value || '').trim();
            const objectName = String(document.getElementById('import-template-family-object')?.value || '').trim();
            if (!familyLabel) {
                showAlert('Nom de famille requis.', 'warning');
                return;
            }
            const list = Array.isArray(state.draftFamilies) ? state.draftFamilies.slice() : [];
            if (list.some((f) => String(f?.familyLabel || '').trim().toLowerCase() === familyLabel.toLowerCase())) {
                showAlert('Cette famille existe déjà dans le template en cours.', 'info');
                return;
            }
            list.push({
                familyLabel,
                objectName,
                decisionGroups: getDefaultFamilyCreationDecisionGroups()
            });
            state.draftFamilies = list;
            const labelEl = document.getElementById('import-template-family-label');
            const objEl = document.getElementById('import-template-family-object');
            if (labelEl) labelEl.value = '';
            if (objEl) objEl.value = '';
            renderImportWorkflow();
        }

        function removeImportDraftFamily(index) {
            const state = getImportFamilyTriState();
            const idx = Number(index);
            const list = Array.isArray(state.draftFamilies) ? state.draftFamilies.slice() : [];
            if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
            list.splice(idx, 1);
            state.draftFamilies = list;
            renderImportWorkflow();
        }

        function saveImportTemplateFromDraft() {
            const state = getImportFamilyTriState();
            const label = String(state.draftTemplateName || '').trim();
            if (!label) {
                showAlert('Nom du template requis.', 'warning');
                return;
            }
            const families = Array.isArray(state.draftFamilies) ? state.draftFamilies : [];
            if (!families.length) {
                showAlert('Ajoutez au moins une famille au template.', 'warning');
                return;
            }
            const existing = getImportAssignableTemplates();
            if (existing.some((t) => String(t?.label || '').trim().toLowerCase() === label.toLowerCase())) {
                showAlert('Un template avec ce nom existe déjà.', 'info');
                return;
            }
            const id = `custom:${slugifyFamilyDecisionGroupId(label) || 'template'}:${Date.now()}`;
            const next = Array.isArray(state.customTemplates) ? state.customTemplates.slice() : [];
            next.push({
                id,
                label,
                families: families.map((f) => ({
                    familyLabel: String(f?.familyLabel || '').trim(),
                    objectName: String(f?.objectName || '').trim(),
                    decisionGroups: normalizeFamilyDecisionGroups(f?.decisionGroups)
                }))
            });
            state.customTemplates = next;
            state.draftTemplateName = '';
            state.draftSourceTemplateId = '';
            state.draftFamilies = [];
            showAlert('Template créé.', 'success');
            renderImportWorkflow();
        }

        function onImportFamilyOptionAssignmentChange(optionId, familyLabel) {
            const id = String(optionId || '').trim();
            if (!id) return;
            const state = getImportFamilyTriState();
            state.assignmentsByOptionId[id] = String(familyLabel || '').trim();
            renderImportWorkflow();
        }

        function onImportFamilyKeywordInputSave(familyLabel) {
            const label = String(familyLabel || '').trim();
            if (!label) return;
            const encoded = encodeURIComponent(label);
            const input = document.getElementById(`import-family-keywords-${encoded}`);
            const state = getImportFamilyTriState();
            state.keywordsByFamily[label] = String(input?.value || '').trim();
            runImportFamiliesKeywordTri();
            renderImportWorkflow();
        }

        function onImportFamilyHeaderClick(familyLabel) {
            toggleImportFamilyExpand(familyLabel);
        }

        function toggleImportFamilyExpand(familyLabel) {
            const label = String(familyLabel || '').trim();
            if (!label) return;
            const state = getImportFamilyTriState();
            state.expandedByFamily[label] = !state.expandedByFamily[label];
            renderImportWorkflow();
        }

        function createImportFamilyFromQuickForm() {
            const labelEl = document.getElementById('import-new-family-label');
            const objectEl = document.getElementById('import-new-family-object');
            const familyLabel = String(labelEl?.value || '').trim();
            const objectName = String(objectEl?.value || '').trim();
            if (!familyLabel) {
                showAlert('Nom de famille requis.', 'warning');
                return;
            }
            const list = Array.isArray(getFamilleValidatedFamilies()) ? getFamilleValidatedFamilies().slice() : [];
            if (list.some((f) => String(f?.familyLabel || '').trim().toLowerCase() === familyLabel.toLowerCase())) {
                showAlert('Cette famille existe déjà.', 'info');
                return;
            }
            const state = getImportFamilyTriState();
            const templateLabel = String(state.selectedTemplateFamilyLabel || '').trim();
            const templateFamily = list.find((f) => String(f?.familyLabel || '').trim() === templateLabel);
            const decisionGroups = templateFamily?.decisionGroups
                ? normalizeFamilyDecisionGroups(templateFamily.decisionGroups)
                : getDefaultFamilyCreationDecisionGroups();
            list.push({
                familyLabel,
                objectName,
                optionIds: [],
                decisionGroups
            });
            setFamilleValidatedFamilies(list);
            if (labelEl) labelEl.value = '';
            if (objectEl) objectEl.value = '';
            runImportFamiliesKeywordTri();
            renderImportWorkflow();
            showAlert('Nouvelle famille créée.', 'success');
            triggerUiStatePersistenceNow();
        }

        function renderImportFamiliesSortStepHtml() {
            const state = getImportFamilyTriState();
            const families = Array.isArray(getFamilleValidatedFamilies()) ? getFamilleValidatedFamilies() : [];
            const snapshotFamilies = Array.isArray(__lastLoadDataSnapshot?.uiState?.families)
                ? __lastLoadDataSnapshot.uiState.families
                : [];
            const resolveImportFamilyLabel = (family) => String(
                family?.familyLabel
                || family?.label
                || family?.name
                || ''
            ).trim();
            const catalogFamilies = (() => {
                const out = [];
                const seen = new Set();
                [...snapshotFamilies, ...families].forEach((f) => {
                    const label = resolveImportFamilyLabel(f).toLowerCase();
                    if (!label || seen.has(label)) return;
                    seen.add(label);
                    out.push(f);
                });
                return out;
            })();
            if (!Object.keys(state.assignmentsByOptionId || {}).length) {
                runImportFamiliesKeywordTri();
            }
            const options = getImportOptionsForFamilyTri();
            const prOptions = getImportPrOptionsForFamilyTri();
            const familyLabels = Array.from(new Set(
                catalogFamilies
                    .map((f) => resolveImportFamilyLabel(f))
                    .filter(Boolean)
            ));
            const byFamily = new Map(familyLabels.map((label) => [label, []]));
            const unmatched = [];
            options.forEach((opt) => {
                const picked = String(state.assignmentsByOptionId?.[opt.id] || '').trim();
                if (picked && byFamily.has(picked)) byFamily.get(picked).push(opt);
                else unmatched.push(opt);
            });

            const templates = getImportAssignableTemplates();
            const templateChoices = templates
                .map((t) => {
                    const tid = String(t?.id || '').trim();
                    const label = String(t?.label || tid).trim();
                    return `<option value="${escapeHtml(tid)}" ${state.selectedTemplateFamilyLabel === tid ? 'selected' : ''}>${escapeHtml(label)}</option>`;
                })
                .join('');
            const templateSourceChoices = templates
                .map((t) => {
                    const tid = String(t?.id || '').trim();
                    const label = String(t?.label || tid).trim();
                    return `<option value="${escapeHtml(tid)}" ${String(state.draftSourceTemplateId || '') === tid ? 'selected' : ''}>${escapeHtml(label)}</option>`;
                })
                .join('');
            const validatedModelIds = new Set((currentImportStaging?.progress?.validatedModelIds || []).map((x) => String(x || '').trim()).filter(Boolean));
            const validatedModels = (Array.isArray(currentImportStaging?.models) ? currentImportStaging.models : [])
                .filter((m) => validatedModelIds.has(String(m?.id || '').trim()));
            const modelTemplateRowsHtml = validatedModels.map((m) => {
                const mid = String(m?.id || '').trim();
                const encodedMid = encodeURIComponent(mid);
                const selectedTemplate = String(state.templateByModelId?.[mid] || '').trim();
                return `<tr>
                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(String(m?.name || mid || '—'))}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #eee; font-family:monospace;">${escapeHtml(mid)}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">
                        <select onchange="onImportModelTemplateAssignmentChange(decodeURIComponent('${encodedMid}'), this.value)" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;">
                            <option value="">-- Aucun template --</option>
                            ${templates.map((tpl) => {
                                const tid = String(tpl?.id || '').trim();
                                const tlabel = String(tpl?.label || tid).trim();
                                return `<option value="${escapeHtml(tid)}" ${selectedTemplate === tid ? 'selected' : ''}>${escapeHtml(tlabel)}</option>`;
                            }).join('')}
                        </select>
                    </td>
                </tr>`;
            }).join('');
            const showTemplateBuilder = !!String(state.draftTemplateName || '').trim() || !!String(state.draftSourceTemplateId || '').trim();
            const draftFamilies = Array.isArray(state.draftFamilies) ? state.draftFamilies : [];
            const draftRowsHtml = draftFamilies.map((f, idx) => {
                const groups = normalizeFamilyDecisionGroups(f?.decisionGroups);
                const groupsTxt = groups.length ? groups.map((g) => `${g.type}:${g.id}`).join(', ') : 'Aucun';
                return `<tr>
                    <td style="padding:6px 8px; border-bottom:1px solid #eee;"><strong>${escapeHtml(String(f?.familyLabel || ''))}</strong></td>
                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(String(f?.objectName || '—'))}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(groupsTxt)}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;"><button type="button" class="btn btn-outline" style="font-size:11px; padding:3px 8px;" onclick="removeImportDraftFamily(${idx})">Suppr.</button></td>
                </tr>`;
            }).join('');

            const familyBlocks = familyLabels.map((label) => {
                const rows = byFamily.get(label) || [];
                const expanded = !!state.expandedByFamily?.[label];
                const encodedLabel = encodeURIComponent(label);
                const keywordValue = String(state.keywordsByFamily?.[label] || '');
                const rowsHtml = rows.map((opt) => {
                    const encodedId = encodeURIComponent(opt.id);
                    return `<tr>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; font-family:monospace;">${escapeHtml(opt.id)}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(opt.name)}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee;">
                            <select style="width:100%; padding:4px 6px; border:1px solid #ddd; border-radius:4px;" onchange="onImportFamilyOptionAssignmentChange(decodeURIComponent('${encodedId}'), this.value)">
                                <option value="">-- Sans famille --</option>
                                ${familyLabels.map((fLabel) => `<option value="${escapeHtml(fLabel)}" ${fLabel === label ? 'selected' : ''}>${escapeHtml(fLabel)}</option>`).join('')}
                            </select>
                        </td>
                    </tr>`;
                }).join('');
                return `<div style="border:1px solid #e5e7eb; border-radius:8px; background:#fff; margin-bottom:10px;">
                    <div style="padding:10px 12px; border-bottom:1px solid #eef2f7; display:flex; justify-content:space-between; gap:10px; align-items:center; cursor:pointer;" onclick="onImportFamilyHeaderClick(decodeURIComponent('${encodedLabel}'))">
                        <div><strong>${escapeHtml(label)}</strong> <span style="color:#64748b; font-size:12px;">(${rows.length} option(s))</span></div>
                        <button type="button" class="btn btn-outline" style="font-size:12px;" onclick="event.preventDefault(); event.stopPropagation(); toggleImportFamilyExpand(decodeURIComponent('${encodedLabel}'))">${expanded ? 'Réduire' : 'Agrandir'}</button>
                    </div>
                    <div style="padding:10px 12px; border-bottom:1px solid #f1f5f9; background:#fafafa;">
                        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                            <div style="min-width:220px; font-size:13px; color:#334155;"><strong>${escapeHtml(label)}</strong></div>
                            <input id="import-family-keywords-${encodedLabel}" value="${escapeHtml(keywordValue)}" placeholder="Mots-clés (ex: coque, aluminium, 6.20m)" style="flex:1; min-width:260px; padding:7px; border:1px solid #ddd; border-radius:4px;">
                            <button type="button" class="btn btn-outline" style="font-size:12px;" onclick="onImportFamilyKeywordInputSave(decodeURIComponent('${encodedLabel}'))">Enregistrer mots-clés</button>
                        </div>
                    </div>
                    ${expanded
                        ? `<div style="padding:10px 12px;">
                            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">ID</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Option</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left; width:320px;">Famille</th>
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml || '<tr><td colspan="3" style="padding:8px; color:#6b7280;">Aucune option assignée.</td></tr>'}</tbody>
                            </table>
                        </div>`
                        : ''}
                </div>`;
            }).join('');

            const unmatchedHtml = unmatched.map((opt) => {
                const encodedId = encodeURIComponent(opt.id);
                return `<tr>
                    <td style="padding:6px 8px; border-bottom:1px solid #eee; font-family:monospace;">${escapeHtml(opt.id)}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(opt.name)}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">
                        <select style="width:100%; padding:4px 6px; border:1px solid #ddd; border-radius:4px;" onchange="onImportFamilyOptionAssignmentChange(decodeURIComponent('${encodedId}'), this.value)">
                            <option value="">-- Sans famille --</option>
                            ${familyLabels.map((fLabel) => `<option value="${escapeHtml(fLabel)}">${escapeHtml(fLabel)}</option>`).join('')}
                        </select>
                    </td>
                </tr>`;
            }).join('');
            const rawStep = String(importWorkflowState.step || 'models');
            const currentStep = rawStep === 'families' ? 'families-tri' : rawStep;
            const tabTemplate = currentStep === 'families-template';
            const tabTri = currentStep === 'families-tri';
            const tabBase = currentStep === 'families-base';
            const tabPr = currentStep === 'families-unmatched';
            const tabValidate = currentStep === 'validate';
            const showImportTemplateForm = !!String(state.newTemplateName || '').trim();
            const validatedCount = Number(currentImportStaging?.progress?.validatedModelIds?.length || 0);
            const totalModels = Number((currentImportStaging?.models || []).length || 0);

            return `
                <div style="display:${tabTemplate ? 'block' : 'none'}; margin-bottom:10px;">
                    <div style="margin-bottom:12px; padding:12px; border:1px solid #dbe3ea; border-radius:8px; background:#fff;">
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; justify-content:space-between;">
                            <div style="min-width:280px; flex:1;">
                                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Nom du template</label>
                                <input value="${escapeHtml(String(state.newTemplateName || ''))}" oninput="onImportTemplateNameInput(this.value)" type="text" placeholder="Ex: Template Import V1" style="padding:6px 8px; border:1px solid #ddd; border-radius:4px; min-width:280px; width:100%;">
                            </div>
                            <div style="min-width:280px; flex:1;">
                                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Copier un template existant</label>
                                <select onchange="onImportTemplateCopySelect(this.value)" style="padding:6px 8px; border:1px solid #ddd; border-radius:4px; min-width:280px; width:100%;">
                                    <option value="">-- Aucun --</option>
                                    ${templateSourceChoices}
                                </select>
                            </div>
                            <div>
                                <button class="btn btn-success" onclick="saveImportTemplateNamedFromCurrentFamilies()">Enregistrer template</button>
                            </div>
                        </div>
                    </div>
                    ${showImportTemplateForm
                        ? `<div id="import-template-shared-content"></div>`
                        : '<div style="padding:12px; color:#6b7280; border:1px solid #e5e7eb; border-radius:8px; background:#fff;">Renseignez un nom de template pour afficher le reste du formulaire.</div>'}
                    <div style="margin-top:12px; border:1px solid #e9ecef; border-radius:8px; background:#fff;">
                        <div style="padding:10px 12px; border-bottom:1px solid #e9ecef; font-weight:600;">Modèles validés -> template</div>
                        <table style="width:100%; border-collapse:collapse; font-size:13px;">
                            <thead>
                                <tr style="background:#f8f9fa;">
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Modèle</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">ID</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Template assigné</th>
                                </tr>
                            </thead>
                            <tbody>${modelTemplateRowsHtml || '<tr><td colspan="3" style="padding:10px; color:#777;">Aucun modèle validé pour le moment.</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>

                <div style="display:none; margin-bottom:10px;">
                    <div style="margin-bottom:12px; padding:12px; border:1px solid #dbe3ea; border-radius:8px; background:#fff;">
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; justify-content:space-between;">
                            <div style="min-width:240px; flex:1;">
                                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Nom famille</label>
                                <input id="import-new-family-label" type="text" placeholder="Ex: Coque aluminium" style="padding:6px 8px; border:1px solid #ddd; border-radius:4px; width:100%;">
                            </div>
                            <div style="min-width:240px; flex:1;">
                                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Nom objet</label>
                                <input id="import-new-family-object" type="text" placeholder="Ex: coque" style="padding:6px 8px; border:1px solid #ddd; border-radius:4px; width:100%;">
                            </div>
                            <div>
                                <button class="btn btn-success" onclick="createImportFamilyFromQuickForm()">Créer nouvelle famille</button>
                            </div>
                        </div>
                    </div>
                    <div style="margin-bottom:8px; display:flex; justify-content:flex-end;">
                        <button type="button" class="btn btn-outline" onclick="runImportFamiliesKeywordTri(); renderImportWorkflow();">Relancer tri</button>
                    </div>
                    ${familyBlocks || '<div style="padding:10px; color:#6b7280; border:1px solid #e5e7eb; border-radius:8px; background:#fff;">Aucune famille disponible.</div>'}
                    <div style="margin-top:12px; border:1px solid #e5e7eb; border-radius:8px; background:#fff;">
                        <div style="padding:10px 12px; border-bottom:1px solid #eef2f7; font-weight:600;">Options non assignées (${unmatched.length})</div>
                        <div style="padding:10px 12px;">
                            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">ID</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Option</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left; width:320px;">Assigner</th>
                                    </tr>
                                </thead>
                            <tbody>${unmatchedHtml || '<tr><td colspan="3" style="padding:8px; color:#16a34a;">Toutes les options ont une famille.</td></tr>'}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div style="display:${tabPr ? 'block' : 'none'}; margin-bottom:10px;">
                    <div style="margin-bottom:12px; color:#4b5563;">Etape 6 : pièces détachées PR détectées à l'import.</div>
                    <div style="border:1px solid #e5e7eb; border-radius:8px; background:#fff;">
                        <div style="padding:10px 12px; border-bottom:1px solid #eef2f7; font-weight:600;">Options PR (${prOptions.length})</div>
                        <div style="padding:10px 12px;">
                            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">ID</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Option PR</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Réf UGAP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${prOptions.map((opt) => `<tr>
                                            <td style="padding:6px 8px; border-bottom:1px solid #eee; font-family:monospace;">${escapeHtml(opt.id)}</td>
                                            <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(opt.name)}</td>
                                            <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(opt.refUgap || '—')}</td>
                                        </tr>`).join('') || '<tr><td colspan="3" style="padding:8px; color:#16a34a;">Aucune option PR détectée.</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div style="display:${tabBase ? 'block' : 'none'}; margin-bottom:10px;">
                    <div style="margin-bottom:12px; color:#4b5563;">Etape 4: définir les options du modèle de base à partir du template choisi.</div>
                    <div id="import-base-model-content"></div>
                </div>
                <div style="display:${tabValidate ? 'block' : 'none'}; margin-bottom:10px;">
                    <div style="border:1px solid #dbe3ea; border-radius:8px; background:#fff; padding:12px;">
                        <div style="font-weight:600; margin-bottom:8px;">Validation finale de l'import</div>
                        <div style="color:#475569; font-size:13px; margin-bottom:12px;">
                            Modèles validés: <strong>${validatedCount}/${totalModels}</strong> — PR détectées: <strong>${prOptions.length}</strong>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-outline" onclick="validateImportOptionsStep()">Valider options import</button>
                            <button type="button" class="btn btn-success" onclick="publishCurrentImportStep()">Publier dans le catalogue</button>
                        </div>
                    </div>
                </div>
            `;
        }

        async function validateImportModelsStep() {
            if (!currentImportStaging?._id) {
                showAlert('Aucun import en cours.', 'warning');
                return;
            }
            const models = Array.isArray(currentImportStaging.models) ? currentImportStaging.models : [];
            const validatedIds = new Set((currentImportStaging?.progress?.validatedModelIds || []).map((x) => String(x)));
            const modelIdsPresent = new Set(models.map((m) => String(m?.id || '').trim()).filter(Boolean));
            const selectedFromDom = Array.from(document.querySelectorAll('#import-workflow-content-models input[data-import-model-id]:checked:not(:disabled)'))
                .map((el) => {
                    const encodedId = String(el?.getAttribute('data-import-model-id') || '').trim();
                    try { return String(decodeURIComponent(encodedId || '')).trim(); } catch (_) { return encodedId; }
                })
                .filter(Boolean);
            const selectedIds = selectedFromDom
                .map((id) => String(id || '').trim())
                .filter((id) => id && modelIdsPresent.has(id));
            const modelIds = selectedIds.filter((id) => !importModelRowDisplayValidated(id, validatedIds));
            const modelUpdates = collectImportModelPriceUpdates()
                .filter((row) => modelIds.includes(String(row?.id || '').trim()));
            if (!modelIds.length) {
                showAlert('Selectionnez au moins un modele "A valider" puis relancez la validation.', 'warning');
                return;
            }
            try {
                const result = await apiCall(`/imports/staging/${encodeURIComponent(String(currentImportStaging._id))}/validate-models`, {
                    method: 'POST',
                    body: JSON.stringify({ modelIds, modelUpdates })
                });
                if (result?.data) {
                    currentImportStaging = result.data;
                    currentImportId = String(result.data?._id || currentImportId || '');
                }
                importWorkflowState.selectedModelIds = [];
                // Recharge immédiat du catalogue, sans dépendre du throttle/loadData en cours.
                try {
                    const freshCatalog = await apiCall('/data', { allowBusinessError: true });
                    if (freshCatalog?.data) {
                        currentData = normalizeUgapDataContract(freshCatalog.data);
                        await hydrateUiStateFromServer();
                        __lastLoadDataSnapshot = currentData;
                        cleanupDeletedOptionReferences();
                        updateStats();
                        updateAllTabWarningBadges();
                    } else {
                        __lastLoadDataAt = 0;
                        await loadData(true);
                    }
                } catch (_refreshError) {
                    __lastLoadDataAt = 0;
                    await loadData(true);
                }
                showAlert(`${modelIds.length} modèle(s) enregistré(s).`, 'success');
                renderImportStagingIndicator(currentImportStaging);
                updateStats();
                renderImportWorkflow();
                switchImportWorkflowStep('families-tri');
            } catch (error) {
                showAlert('Erreur validation modeles: ' + error.message, 'error');
            }
        }

        function confirmBaseModelsSelectionStep() {
            const ids = Array.isArray(importWorkflowState.selectedBaseModelIds) ? importWorkflowState.selectedBaseModelIds : [];
            const statusEl = document.getElementById('import-status');
            if (statusEl) {
                statusEl.textContent = ids.length
                    ? `${ids.length} modele(s) de base selectionnes`
                    : 'Aucun modele de base selectionne';
                statusEl.style.color = '#2563eb';
            }
            showAlert(ids.length
                ? `${ids.length} modele(s) de base selectionnes pour l'etape suivante.`
                : 'Aucun modele de base selectionne.', ids.length ? 'success' : 'info');
        }

        function renderImportWorkflow() {
            const modelsRoot = document.getElementById('import-workflow-content-models');
            const familiesRoot = document.getElementById('import-workflow-content-families');
            if (!modelsRoot || !familiesRoot) return;
            const triState = getImportFamilyTriState();
            const stepRaw = String(importWorkflowState.step || 'models');
            const step = stepRaw === 'families' ? 'families-tri' : stepRaw;
            if (step !== stepRaw) importWorkflowState.step = step;
            if (step === 'families-tri') triState.activeTab = 'tri';
            if (step === 'families-template') triState.activeTab = 'template';
            if (!currentImportStaging) {
                modelsRoot.innerHTML = '<div style="color:#6b7280;">Aucun workflow import actif.</div>';
                familiesRoot.innerHTML = '<div style="color:#6b7280;">Import requis pour detecter des familles.</div>';
                switchImportWorkflowStep('models');
                return;
            }

            const models = Array.isArray(currentImportStaging.models) ? currentImportStaging.models : [];
            const modelIdsPresent = new Set(models.map((m) => String(m?.id || '').trim()).filter(Boolean));
            importWorkflowState.selectedModelIds = (importWorkflowState.selectedModelIds || [])
                .map((id) => String(id || '').trim())
                .filter((id) => id && modelIdsPresent.has(id));
            importWorkflowState.selectedBaseModelIds = (importWorkflowState.selectedBaseModelIds || [])
                .map((id) => String(id || '').trim())
                .filter((id) => id && modelIdsPresent.has(id));
            const categories = Array.isArray(currentImportStaging.categories) ? currentImportStaging.categories : [];
            const validatedIds = new Set((currentImportStaging?.progress?.validatedModelIds || []).map((x) => String(x)));
            const statusFilter = String(importWorkflowState.modelStatusFilter || 'to_validate');
            const visibleModels = (models || []).filter((m) => {
                const id = String(m?.id || '');
                const displayOk = importModelRowDisplayValidated(id, validatedIds);
                if (statusFilter === 'all') return true;
                return !displayOk;
            });

            modelsRoot.innerHTML = `
                <div style="margin-bottom:10px; color:#4b5563;">Etape 1: valider les modeles detectes.</div>
                <div style="margin-bottom:10px; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" class="btn btn-outline" onclick="selectAllImportModelsVisible()" style="margin-right:auto;">Tout selectionner</button>
                    <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#4b5563;">
                        Statut
                        <select onchange="onImportModelStatusFilterChange(this.value)" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:6px;">
                            <option value="to_validate" ${statusFilter === 'to_validate' ? 'selected' : ''}>A valider</option>
                            <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Tous</option>
                        </select>
                    </label>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:center; width:52px;">OK</th>
                            <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:left;">Modele</th>
                            <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:left;">Poste</th>
                            <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:left; width:150px;">Prix</th>
                            <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:left;">Etat</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visibleModels.map((m) => {
                            const id = String(m?.id || '');
                            const encodedId = encodeURIComponent(id);
                            const displayOk = importModelRowDisplayValidated(id, validatedIds);
                            const checked = displayOk;
                            return `<tr>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">
                                    <input type="checkbox" data-import-model-id="${encodedId}" ${checked ? 'checked' : ''} ${displayOk ? 'disabled' : ''} onchange="toggleImportModelSelection(decodeURIComponent('${encodedId}'), this.checked)">
                                </td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9;">${escapeHtml(String(m?.name || id || '-'))}</td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9;">${escapeHtml(String(m?.posteNumber ?? '-'))}</td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9;">
                                    <div style="display:inline-flex; align-items:center; gap:6px; border:1px solid #ddd; border-radius:4px; padding:0 8px; background:#fff;">
                                        <input class="import-model-price-input" data-model-id="${encodedId}" data-raw-value="${escapeHtml(String(Number.isFinite(Number(m?.basePrice)) ? Number(m.basePrice) : 0))}" type="text" inputmode="decimal" value="${escapeHtml((Number.isFinite(Number(m?.basePrice)) ? Number(m.basePrice) : 0).toFixed(2))}" onfocus="focusImportModelMoneyInput(this)" onblur="formatImportModelMoneyInput(this)" style="width:100px; padding:6px 0; border:none; outline:none; background:transparent;">
                                        <span style="color:#6b7280; font-size:12px;">€</span>
                                    </div>
                                </td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9;">${displayOk ? '<span style="color:#16a34a; font-weight:600;">Valide</span>' : '<span style="color:#b45309;">A valider</span>'}</td>
                            </tr>`;
                        }).join('') || '<tr><td colspan="5" style="padding:10px; color:#6b7280;">Aucun modele a afficher pour ce filtre.</td></tr>'}
                    </tbody>
                </table>
                <div style="margin-top:12px; display:flex; justify-content:flex-end;">
                    <button type="button" class="btn btn-success" onclick="validateImportModelsStep()">Valider la selection</button>
                </div>
            `;

            publishImportWorkflowGlobals();
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
            } else if (step === 'families-tri') {
                familiesRoot.innerHTML = typeof renderImportOptionsSortStepHtml === 'function'
                    ? renderImportOptionsSortStepHtml()
                    : renderImportFamiliesSortStepHtml();
                if (typeof onImportOptionsStepRendered === 'function') onImportOptionsStepRendered();
            } else {
                familiesRoot.innerHTML = renderImportFamiliesSortStepHtml();
            }

            switchImportWorkflowStep(importWorkflowState.step || 'models');
            scheduleParentEmbedResize();
            setTimeout(scheduleParentEmbedResize, 120);
        }

        function renderTemplateBateauSharedForImport() {
            const root = document.getElementById('import-template-shared-content');
            if (!root) return;
            const previousData = currentData;
            currentData = normalizeUgapDataContract({
                models: Array.isArray(currentImportStaging?.models) ? currentImportStaging.models : [],
                categories: Array.isArray(currentImportStaging?.categories) ? currentImportStaging.categories : [],
                businessViews: Array.isArray(currentImportStaging?.businessViews) ? currentImportStaging.businessViews : [],
                dependencyRules: Array.isArray(currentImportStaging?.dependencyRules) ? currentImportStaging.dependencyRules : [],
                uiState: currentImportStaging?.uiState || {}
            });
            renderBaseModelTab('import-template-shared-content');
            currentData = previousData;
        }

        function renderImportBaseModelStep() {
            const root = document.getElementById('import-base-model-content');
            if (!root) return;
            const previousData = currentData;
            currentData = normalizeUgapDataContract({
                models: Array.isArray(currentImportStaging?.models) ? currentImportStaging.models : [],
                categories: Array.isArray(currentImportStaging?.categories) ? currentImportStaging.categories : [],
                businessViews: Array.isArray(currentImportStaging?.businessViews) ? currentImportStaging.businessViews : [],
                dependencyRules: Array.isArray(currentImportStaging?.dependencyRules) ? currentImportStaging.dependencyRules : [],
                uiState: currentImportStaging?.uiState || {}
            });
            renderBaseModelTab('import-base-model-content');
            currentData = previousData;
        }

        async function validateImportOptionsStep() {
            if (!currentImportStaging?._id) {
                showAlert('Aucun import en cours.', 'warning');
                return;
            }
            try {
                const result = await apiCall(`/imports/staging/${encodeURIComponent(String(currentImportStaging._id))}/validate-options`, {
                    method: 'POST'
                });
                if (result?.data) {
                    currentImportStaging = result.data;
                    currentImportId = String(result.data?._id || currentImportId || '');
                }
                renderImportStagingIndicator(currentImportStaging);
                showAlert('Options de l’import validées.', 'success');
                renderImportWorkflow();
            } catch (error) {
                showAlert('Erreur validation options: ' + error.message, 'error');
            }
        }

        async function publishCurrentImportStep() {
            if (!currentImportStaging?._id) {
                showAlert('Aucun import en cours.', 'warning');
                return;
            }
            try {
                const result = await apiCall(`/imports/staging/${encodeURIComponent(String(currentImportStaging._id))}/publish`, {
                    method: 'POST'
                });
                if (result?.data) {
                    currentImportStaging = result.data;
                    currentImportId = String(result.data?._id || currentImportId || '');
                }
                await loadData(true);
                renderImportStagingIndicator(currentImportStaging);
                showAlert('Import publié dans le catalogue.', 'success');
                setWorkspaceMode('backoffice');
            } catch (error) {
                showAlert('Erreur publication import: ' + error.message, 'error');
            }
        }

        async function refreshImportStagingIndicator() {
            try {
                const query = currentImportId ? `?importId=${encodeURIComponent(currentImportId)}` : '';
                const result = await apiCall(`/imports/staging${query}`);
                if (result?.data) {
                    currentImportStaging = result.data;
                    currentImportId = String(result.data?._id || currentImportId || '');
                } else if (!currentImportId) {
                    currentImportStaging = null;
                }
                renderImportStagingIndicator(currentImportStaging);
                renderImportWorkflow();
                updateStats();
            } catch (error) {
                renderImportStagingIndicator(currentImportStaging);
                renderImportWorkflow();
                updateStats();
            }
        }

        async function resumeImportWorkflow() {
            await refreshImportStagingIndicator();
            if (!currentImportStaging?._id) {
                showAlert('Aucun import en cours a reprendre.', 'warning');
                return;
            }
            const importId = String(currentImportStaging._id || currentImportId || '').trim();
            if (importId && typeof openImportEditor === 'function') {
                await openImportEditor(importId, { resume: true });
                return;
            }
            setWorkspaceMode('import');
            importWorkflowState.step = 'models';
            renderImportWorkflow();
            document.getElementById('import-workflow-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        async function importExcel() {
            const statusEl = document.getElementById('import-status');
            statusEl.textContent = 'Import en cours...';
            statusEl.style.color = '#007bff';
            setWorkspaceMode('import');

            try {
                const result = await apiCall('/import', { method: 'POST' });
                currentImportId = String(result?.data?.importId || currentImportId || '');
                showAlert(`Import réussi ! ${result.data.modelsCount} modèles, ${result.data.categoriesCount} catégories, ${result.data.optionsCount} options.`, 'success');
                statusEl.textContent = 'Import réussi';
                statusEl.style.color = '#28a745';
                await refreshImportStagingIndicator();
                await loadData();
                if (currentImportId && typeof openImportEditor === 'function') {
                    await openImportEditor(currentImportId, { resume: false });
                }
            } catch (error) {
                showAlert('Erreur lors de l\'import: ' + error.message, 'error');
                statusEl.textContent = 'Erreur';
                statusEl.style.color = '#dc3545';
            }
        }

        function closeImportAuditModal() {
            const modal = document.getElementById('import-audit-modal');
            if (modal) modal.remove();
        }

        async function reintegrateAuditLine(modelId, rowIndex) {
            try {
                await apiCall('/import-audit/reintegrate', {
                    method: 'POST',
                    body: JSON.stringify({ modelId, rowIndex })
                });
                showAlert(`Ligne ${rowIndex} reintegree pour ${modelId}.`, 'success');
                await loadData(true);
                await runImportAudit();
            } catch (error) {
                showAlert('Erreur reintegration: ' + error.message, 'error');
            }
        }

        function openImportAuditModal(reports) {
            const rows = (Array.isArray(reports) ? reports : []).map((r) => {
                const delta = Number(r?.deltas?.options || 0);
                const color = delta === 0 ? '#198754' : '#dc3545';
                const excludedRows = Array.isArray(r?.excludedRows) ? r.excludedRows : [];
                const excludedHtml = excludedRows.length === 0
                    ? '<div style="color:#666; font-size:12px;">Aucune ligne ecartee.</div>'
                    : `
                        <table style="width:100%; border-collapse:collapse; border:1px solid #f0f0f0; margin-top:8px;">
                            <thead>
                                <tr style="background:#fafafa;">
                                    <th style="padding:6px; border-bottom:1px solid #eee; text-align:right; width:80px;">Ligne</th>
                                    <th style="padding:6px; border-bottom:1px solid #eee; text-align:left;">Libelle</th>
                                    <th style="padding:6px; border-bottom:1px solid #eee; text-align:left; width:220px;">Motif</th>
                                    <th style="padding:6px; border-bottom:1px solid #eee; text-align:center; width:140px;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${excludedRows.map((x) => `
                                    <tr>
                                        <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${Number(x?.rowIndex || 0)}</td>
                                        <td style="padding:6px; border-bottom:1px solid #eee;">${escapeHtml(x?.label || '-')}</td>
                                        <td style="padding:6px; border-bottom:1px solid #eee; color:#666;">${escapeHtml(x?.reasonLabel || x?.reason || '-')}</td>
                                        <td style="padding:6px; border-bottom:1px solid #eee; text-align:center;">
                                            ${x?.reintegrable
                                                ? `<button class="btn btn-outline" onclick="reintegrateAuditLine('${escapeHtml(r.modelId)}', ${Number(x?.rowIndex || 0)})">Reintegrer</button>`
                                                : '<span style="color:#999; font-size:12px;">N/A</span>'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                return `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(r.modelName || r.modelId || '-')}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${Number(r?.excel?.crosses || 0)}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${Number(r?.excel?.pr || 0)}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${Number(r?.excel?.minorations || 0)}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${Number(r?.excel?.skippedBaseModelRow || 0)}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${Number(r?.excel?.options || 0)}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${Number(r?.parsed?.options || 0)}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right; color:${color}; font-weight:600;">${delta > 0 ? '+' : ''}${delta}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; color:#666; font-size:12px;">
                            base:${Number(r?.excel?.skippedBaseModelRow || 0)} /
                            libelle vide:${Number(r?.excel?.skippedEmptyLabel || 0)} /
                            ligne base:${Number(r?.excel?.skippedBaseRowLabel || 0)}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="9" style="padding:8px 10px; border-bottom:1px solid #eee; background:#fcfcfc;">
                            <details>
                                <summary style="cursor:pointer; color:#0d6efd;">Voir lignes ecartees (${excludedRows.length})</summary>
                                ${excludedHtml}
                            </details>
                        </td>
                    </tr>
                `;
            }).join('');

            const modal = document.createElement('div');
            modal.id = 'import-audit-modal';
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:1100px;">
                    <div class="modal-header">
                        <h2>Audit ecarts Excel vs import</h2>
                        <button class="btn btn-danger" onclick="closeImportAuditModal()">Fermer</button>
                    </div>
                    <div style="padding:12px;">
                        <table style="width:100%; border-collapse:collapse; border:1px solid #eee;">
                            <thead>
                                <tr style="background:#f8f9fa;">
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Modele</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:right;">Croix Excel</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:right;">PR Excel</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:right;">Mino Excel</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:right;">Base Excel</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:right;">Options Excel</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:right;">Options importees</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:right;">Delta</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Filtres appliques</th>
                                </tr>
                            </thead>
                            <tbody>${rows || '<tr><td colspan="9" style="padding:12px; text-align:center; color:#666;">Aucune ligne</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'import-audit-modal') closeImportAuditModal();
            });
        }

        async function runImportAudit() {
            try {
                const result = await apiCall('/import-audit');
                const reports = result?.data?.reports || [];
                openImportAuditModal(reports);
                const nonZero = reports.filter((r) => Number(r?.deltas?.options || 0) !== 0);
                if (nonZero.length === 0) {
                    showAlert('Audit OK: aucun ecart sur les options par modele.', 'success');
                } else {
                    showAlert(`Audit termine: ${nonZero.length} modele(s) avec ecart(s).`, 'warning');
                }
            } catch (error) {
                showAlert('Erreur audit import: ' + error.message, 'error');
            }
        }

        // Add category
        async function addCategory() {
            const name = prompt('Nom de la nouvelle catégorie:');
            if (name === null) return;
            const trimmedName = name.trim();
            if (!trimmedName) {
                showAlert('Le nom de catégorie est obligatoire', 'error');
                return;
            }

            try {
                await apiCall('/categories', {
                    method: 'POST',
                    body: JSON.stringify({ name: trimmedName })
                });
                showAlert('Catégorie créée avec succès', 'success');
                await loadData();
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        // Delete category
        async function deleteCategory(categoryId) {
            if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;

            try {
                await apiCall(`/categories/${categoryId}`, { method: 'DELETE' });
                showAlert('Catégorie supprimée', 'success');
                await loadData();
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        // Clear / reset categories (regroupe toutes les options dans "Non classées")
        async function clearAllCategories() {
            const warning =
                `Cette action va RÉINITIALISER toutes les catégories :\n\n` +
                `- Toutes les options seront regroupées dans une seule catégorie "Non classées"\n` +
                `- Toutes les sous-catégories seront supprimées\n\n` +
                `Continuer ?`;

            if (!confirm(warning)) return;

            try {
                showAlert('Réinitialisation des catégories...', 'info');
                await apiCall('/categories/clear', { method: 'POST' });
                showAlert('Catégories réinitialisées', 'success');
                await loadData();
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        // Move category order
        async function moveCategory(categoryId, direction) {
            if (!currentData || !currentData.categories) return;

            const categories = currentData.categories.slice();
            const index = categories.findIndex(cat => cat.id === categoryId);
            if (index === -1) return;

            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= categories.length) return;

            const temp = categories[index];
            categories[index] = categories[newIndex];
            categories[newIndex] = temp;

            try {
                currentData.categories = categories;
                renderCategoriesManagement();
                await apiCall('/categories/reorder', {
                    method: 'PUT',
                    body: JSON.stringify({ orderedCategoryIds: categories.map(cat => cat.id) })
                });
                await loadData();
            } catch (error) {
                await loadData();
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        // Detect subcategories with AI (avec progression SSE)
        async function detectSubCategories() {
            // Utiliser la catégorie sélectionnée dans l'accordéon
            if (!currentData || !currentData.categories || currentData.categories.length === 0) {
                showAlert('Aucune catégorie disponible', 'error');
                return;
            }

            // Trouver la catégorie avec l'accordéon actif
            let category = null;
            const activeAccordion = document.querySelector('.accordion-header.active');
            if (activeAccordion) {
                const accordionId = activeAccordion.closest('.accordion')?.id;
                if (accordionId) {
                    const categoryIdFromAccordion = accordionId.replace('accordion-', '');
                    category = currentData.categories.find(c => c.id === categoryIdFromAccordion);
                }
            }

            // Si aucune catégorie n'est sélectionnée, demander à l'utilisateur
            if (!category) {
                const categoryNames = currentData.categories.map(c => c.name);
                const selectedName = prompt('Quelle catégorie analyser ?\n\n' + categoryNames.map((n, i) => `${i + 1}. ${n}`).join('\n') + '\n\nEntrez le numéro ou le nom:');
                if (!selectedName) return;

                category = currentData.categories.find(c => 
                    c.name.toLowerCase() === selectedName.toLowerCase() || 
                    categoryNames.indexOf(c.name) + 1 === parseInt(selectedName)
                );
                
                if (!category) {
                    showAlert('Catégorie non trouvée', 'error');
                    return;
                }
            }

            const categoryId = category.id;
            
            // Afficher le modal de validation du prompt
            await showPromptValidationModal(categoryId, category.name, () => {
                // Lancer la détection après validation
                launchDetectSubCategories(categoryId);
            });
        }
        
        // Fonction interne pour lancer la détection (séparée pour être appelée après validation)
        async function launchDetectSubCategories(categoryId) {
            // Afficher la progression directement dans le conteneur des sous-catégories
            const container = document.getElementById('subcategories-accordion');
            const progressHtml = createProgressDisplay();
            container.innerHTML = progressHtml;
            
            const progressContainer = container.querySelector('#progress-messages');
            const progressBar = container.querySelector('.progress-bar-fill');
            const timerDisplay = container.querySelector('#timer-display');
            const streamContentDiv = container.querySelector('#stream-content');
            const streamTextDiv = container.querySelector('#stream-text');
            
            // Debug: vérifier que les conteneurs existent
            console.log('🔍 Conteneurs trouvés:', {
                streamContentDiv: !!streamContentDiv,
                streamTextDiv: !!streamTextDiv,
                progressContainer: !!progressContainer
            });
            
            let startTime = Date.now();
            let streamContent = ''; // Déclarer ici pour être accessible dans le catch
            
            // Démarrer le timer
            let seconds = 0;
            const timerInterval = setInterval(() => {
                seconds++;
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                if (timerDisplay) {
                    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                }
            }, 1000);
            
            // Mettre à jour la barre de progression progressivement
            let progressValue = 0;
            const progressInterval = setInterval(() => {
                if (progressValue < 90 && progressBar) {
                    progressValue += Math.random() * 2;
                    progressBar.style.width = Math.min(progressValue, 90) + '%';
                }
            }, 500);

            try {
                // Utiliser fetch avec streaming pour SSE (EventSource ne supporte pas POST)
                const response = await fetch(
                    `/api/ugap/categories/${categoryId}/detect-subcategories`,
                    {
                        method: 'POST',
                        headers: {
                            'Accept': 'text/event-stream',
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include'
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Vérifier le Content-Type
                const contentType = response.headers.get('content-type');
                console.log(`📡 Content-Type reçu: ${contentType}`);
                console.log(`📡 Headers reçus:`, Object.fromEntries(response.headers.entries()));

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let currentEvent = null;
                
                console.log(`✅ Reader créé, début de la lecture du stream...`);

                // Timeout de sécurité pour détecter si le stream est bloqué
                let lastDataTime = Date.now();
                const streamTimeout = setTimeout(() => {
                    const timeSinceLastData = ((Date.now() - lastDataTime) / 1000).toFixed(0);
                    if (timeSinceLastData > 30) {
                        addProgressMessage(`⚠️ Aucune donnée reçue depuis ${timeSinceLastData}s. Le serveur traite peut-être encore...`, 'info');
                    }
                }, 60000); // 60 secondes (augmenté pour éviter les faux positifs)
                
                // Mettre à jour lastDataTime à chaque message reçu
                const originalAddProgressMessage = addProgressMessage;
                addProgressMessage = function(message, type) {
                    lastDataTime = Date.now();
                    originalAddProgressMessage(message, type);
                };

                while (true) {
                    let readResult;
                    try {
                        readResult = await reader.read();
                    } catch (readError) {
                        console.error('Erreur lors de la lecture du stream:', readError);
                        
                        // Si c'est juste une erreur de timeout/fermeture, ne pas arrêter immédiatement
                        // Attendre un peu pour voir si la connexion se rétablit
                        if (readError.message.includes('input stream') || readError.message.includes('timeout')) {
                            addProgressMessage(`⚠️ Connexion interrompue: ${readError.message}. Tentative de reconnexion...`, 'error');
                            
                            // Attendre 2 secondes avant de considérer que c'est vraiment terminé
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            // Si on arrive ici, la connexion est vraiment fermée
                            clearTimeout(streamTimeout);
                            addProgressMessage(`❌ Connexion fermée. Le serveur a peut-être terminé le traitement.`, 'error');
                        } else {
                            // Pour les autres erreurs, arrêter immédiatement
                            clearTimeout(streamTimeout);
                            addProgressMessage(`⚠️ Erreur de lecture du stream: ${readError.message}`, 'error');
                        }
                        
                        // Afficher le contenu accumulé jusqu'ici
                        if (streamContentDiv) streamContentDiv.style.display = 'block';
                        if (streamTextDiv) {
                            streamTextDiv.textContent += `\n\n[ERREUR] ${readError.message}\nContenu reçu: ${streamContent.substring(0, 2000)}`;
                            streamTextDiv.scrollTop = streamTextDiv.scrollHeight;
                        }
                        
                        // Arrêter le timer
                        if (container._cleanup) {
                            container._cleanup();
                        }
                        break;
                    }
                    
                    const { done, value } = readResult;
                    if (done) {
                        clearTimeout(streamTimeout);
                        break;
                    }

                    // Mettre à jour le temps de dernière donnée reçue
                    lastDataTime = Date.now();

                    try {
                        let decoded;
                        try {
                            decoded = decoder.decode(value, { stream: true });
                        } catch (decodeError) {
                            console.error('Erreur de décodage avec stream:', decodeError);
                            // Essayer de décoder sans stream
                            try {
                                decoded = decoder.decode(value);
                            } catch (e2) {
                                // Si ça échoue aussi, utiliser une conversion basique
                                console.error('Erreur de décodage sans stream:', e2);
                                decoded = String.fromCharCode.apply(null, new Uint8Array(value));
                            }
                        }
                        
                        // Debug: afficher chaque chunk reçu
                        if (decoded.length > 0) {
                            console.log(`📥 Chunk brut reçu (${decoded.length} chars):`, decoded.substring(0, 100).replace(/\n/g, '\\n'));
                        }
                        
                        buffer += decoded;
                        streamContent += decoded; // Accumuler le contenu pour affichage en cas d'erreur
                        
                        // Debug: afficher le buffer brut toutes les 50 lignes
                        if (buffer.length > 0 && buffer.split('\n').length % 50 === 0) {
                            console.log(`📋 Buffer SSE (${buffer.length} chars, ${buffer.split('\n').length} lignes):`, buffer.substring(0, 200));
                        }
                        
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.startsWith('event: ')) {
                                currentEvent = { type: line.substring(7).trim(), data: null };
                                console.log(`📨 Événement SSE détecté: ${currentEvent.type}`);
                            } else if (line.startsWith('data: ')) {
                                if (!currentEvent) {
                                    currentEvent = { type: 'message', data: null };
                                    console.log(`⚠️ Ligne data: sans event:, création event par défaut`);
                                }
                                currentEvent.data = line.substring(6).trim();
                                console.log(`📝 Data ajoutée à event "${currentEvent.type}": ${currentEvent.data.substring(0, 50)}...`);
                            } else if (line.trim() === '') {
                                // Ligne vide = fin d'événement, traiter l'événement accumulé
                                if (currentEvent && currentEvent.data) {
                                    console.log(`📦 Traitement événement: type=${currentEvent.type}, data=${currentEvent.data.substring(0, 100)}...`);
                                    try {
                                        const data = JSON.parse(currentEvent.data);
                                        
                                        // Gérer les événements de streaming
                                        if (currentEvent.type === 'stream') {
                                            // Chunk de streaming pur - AFFICHER IMMÉDIATEMENT
                                            if (data.chunk) {
                                                console.log(`📥 Chunk reçu: "${data.chunk.substring(0, 50)}..." (${data.chunk.length} chars)`);
                                                
                                                // Afficher la zone de streaming
                                                if (streamContentDiv) {
                                                    streamContentDiv.style.display = 'block';
                                                }
                                                
                                                // Ajouter le chunk au texte
                                                if (streamTextDiv) {
                                                    streamTextDiv.textContent += data.chunk;
                                                    streamTextDiv.scrollTop = streamTextDiv.scrollHeight;
                                                }
                                                
                                                lastDataTime = Date.now();
                                            }
                                        } else if (currentEvent.type === 'progress') {
                                            // Messages de progression normaux
                                            if (data.message) {
                                                addProgressMessage(data.message, data.type || 'info');
                                                lastDataTime = Date.now();
                                            }
                                            
                                            // Si on a des sous-catégories partielles détectées en streaming, les afficher
                                            if (data.partialSubCategories && Array.isArray(data.partialSubCategories)) {
                                                const isFinal = data.isFinal === true;
                                                const isPartial = data.isPartial === true;
                                                const prefix = isFinal ? '✅' : (isPartial ? '🎯' : '🔄');
                                                const status = isFinal ? '(final)' : (isPartial ? '(partiel)' : 'en temps réel');
                                                addProgressMessage(`${prefix} ${data.partialSubCategories.length} sous-catégorie(s) détectée(s) ${status}: ${data.partialSubCategories.map(sc => sc.name).join(', ')}`, 'success');
                                                
                                                // Si c'est le résultat final, afficher le modal de validation
                                                if (isFinal) {
                                                    addProgressMessage(`✅ ${data.partialSubCategories.length} sous-catégorie(s) détectée(s) - Validation requise`, 'success');
                                                    
                                                    // Arrêter le timer et la progression
                                                    if (container._cleanup) {
                                                        container._cleanup();
                                                    }
                                                    
                                                    // Mettre à jour la barre de progression à 100%
                                                    if (progressBar) {
                                                        progressBar.style.width = '100%';
                                                    }
                                                    
                                                    // Afficher le modal de validation
                                                    showSubCategoriesValidationModal(categoryId, data.partialSubCategories);
                                                }
                                            }
                                        } else if (currentEvent.type === 'keepalive') {
                                            // Les keep-alive maintiennent la connexion active
                                            // Mettre à jour le temps de dernière activité
                                            lastDataTime = Date.now();
                                            // Afficher un indicateur visuel discret que la connexion est active
                                            // (pas de message pour éviter le spam)
                                        } else if (currentEvent.type === 'done') {
                                            clearTimeout(streamTimeout);
                                        
                                        // Arrêter le timer et la progression
                                        if (container._cleanup) {
                                            container._cleanup();
                                        }
                                        if (progressBar) {
                                            progressBar.style.width = '100%';
                                        }
                                        
                                        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                                        addProgressMessage(`✅ Terminé en ${duration}s !`, 'success');
                                        
                                        // Vérifier si les sous-catégories ont déjà été appliquées (via isFinal)
                                        const alreadyApplied = container.dataset.subCategoriesApplied === 'true';
                                        
                                        if (!alreadyApplied && data.data && data.data.length > 0) {
                                            addProgressMessage(`✅ ${data.data.length} sous-catégorie(s) détectée(s) - Validation requise`, 'success');
                                            
                                            // Afficher le modal de validation
                                            showSubCategoriesValidationModal(categoryId, data.data);
                                        } else if (alreadyApplied) {
                                            addProgressMessage('✅ Les sous-catégories ont déjà été appliquées', 'success');
                                        } else {
                                            addProgressMessage('Aucune sous-catégorie détectée', 'info');
                                        }
                                        
                                        // NE RIEN FAIRE D'AUTRE - PAS DE RENDER, PAS DE RESET
                                    } else if (currentEvent.type === 'error') {
                                        addProgressMessage(data.message || 'Erreur inconnue', 'error');
                                        
                                        // Arrêter le timer et la progression
                                        if (container._cleanup) {
                                            container._cleanup();
                                        }
                                        
                                        // Afficher un message d'erreur
                                        setTimeout(() => {
                                            container.innerHTML = `<p style="color: #dc3545; padding: 20px; text-align: center;">❌ Erreur: ${data.message || 'Erreur inconnue'}</p>`;
                                        }, 2000);
                                    }
                                } catch (e) {
                                    console.error('Erreur parsing SSE:', e);
                                }
                            }
                            currentEvent = null;
                            continue;
                        }
                        }
                    } catch (streamError) {
                        // Si erreur de décodage, afficher le contenu brut
                        console.error('Erreur de stream:', streamError);
                        streamContent += buffer;
                        addProgressMessage(`⚠️ Erreur de décodage: ${streamError.message}`, 'error');
                        
                        // Afficher le contenu brut dans la zone de stream
                        if (streamContentDiv) streamContentDiv.style.display = 'block';
                        if (streamTextDiv) {
                            streamTextDiv.textContent += `\n[ERREUR DE DÉCODAGE] ${buffer.substring(0, 1000)}`;
                            streamTextDiv.scrollTop = streamTextDiv.scrollHeight;
                        }
                        
                        addProgressMessage(`📄 Contenu brut reçu: ${buffer.substring(0, 200)}...`, 'info');
                        buffer = '';
                        
                        // Continuer à lire malgré l'erreur
                        continue;
                    }
                }
                
                // Afficher le contenu final du stream si disponible
                if (streamContent && streamTextDiv) {
                    streamTextDiv.textContent += `\n\n[FIN DU STREAM - ${streamContent.length} caractères]`;
                    streamTextDiv.scrollTop = streamTextDiv.scrollHeight;
                }

            } catch (error) {
                console.error('Erreur complète:', error);
                addProgressMessage('Erreur: ' + error.message, 'error');
                
                // Afficher le contenu du stream si disponible
                if (streamContent && streamTextDiv) {
                    streamTextDiv.textContent += `\n\n[ERREUR FINALE] ${error.message}`;
                    streamTextDiv.scrollTop = streamTextDiv.scrollHeight;
                    if (streamContentDiv) streamContentDiv.style.display = 'block';
                }
                
                // Arrêter le timer et la progression
                if (container._cleanup) {
                    container._cleanup();
                }
                
                // Afficher un message d'erreur avec le contenu du stream
                setTimeout(() => {
                    let errorHtml = `<div style="padding: 20px;">
                        <p style="color: #dc3545; font-weight: 600; margin-bottom: 10px;">❌ Erreur: ${error.message}</p>`;
                    if (streamContent) {
                        errorHtml += `<details style="margin-top: 10px;">
                            <summary style="cursor: pointer; color: #666;">Voir le contenu du stream reçu (${streamContent.length} caractères)</summary>
                            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; margin-top: 10px; font-size: 11px; max-height: 300px; overflow-y: auto;">${streamContent.substring(0, 5000)}${streamContent.length > 5000 ? '...' : ''}</pre>
                        </details>`;
                    }
                    errorHtml += `</div>`;
                    container.innerHTML = errorHtml;
                }, 2000);
            }
            
            function addProgressMessage(message, type = 'info') {
                if (!progressContainer) return;
                const messageEl = document.createElement('div');
                messageEl.className = `progress-message progress-${type}`;
                messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
                progressContainer.appendChild(messageEl);
                progressContainer.scrollTop = progressContainer.scrollHeight;
            }
            
            // Nettoyer les intervals à la fin
            const cleanup = () => {
                clearInterval(timerInterval);
                clearInterval(progressInterval);
            };
            
            // Stocker cleanup pour l'utiliser plus tard
            container._cleanup = cleanup;
        }

        // Créer l'affichage de progression dans le conteneur
        function createProgressDisplay() {
            // S'assurer que les styles CSS sont présents
            if (!document.getElementById('ugap-progress-styles')) {
                const style = document.createElement('style');
                style.id = 'ugap-progress-styles';
                style.textContent = `
                    @keyframes shine {
                        0% { left: -100%; }
                        100% { left: 100%; }
                    }
                    @keyframes hourglass {
                        0% { transform: rotate(0deg); }
                        25% { transform: rotate(90deg); }
                        50% { transform: rotate(180deg); }
                        75% { transform: rotate(270deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes hourglassSand {
                        0%, 100% { transform: scaleY(1); opacity: 1; }
                        50% { transform: scaleY(0); opacity: 0.5; }
                    }
                    .spinner-container {
                        width: 50px;
                        height: 50px;
                        position: relative;
                    }
                    .hourglass {
                        width: 40px;
                        height: 40px;
                        position: relative;
                        animation: hourglass 2s linear infinite;
                    }
                    .hourglass::before,
                    .hourglass::after {
                        content: '';
                        position: absolute;
                        width: 0;
                        height: 0;
                        border-style: solid;
                    }
                    .hourglass::before {
                        top: 0;
                        left: 0;
                        border-width: 20px 20px 0 0;
                        border-color: #007bff transparent transparent transparent;
                    }
                    .hourglass::after {
                        bottom: 0;
                        right: 0;
                        border-width: 0 0 20px 20px;
                        border-color: transparent transparent #007bff transparent;
                        animation: hourglassSand 2s ease-in-out infinite;
                    }
                    .progress-message {
                        margin-bottom: 4px;
                        padding: 4px 0;
                    }
                    .progress-info { color: #0066cc; }
                    .progress-success { color: #28a745; font-weight: 600; }
                    .progress-error { color: #dc3545; font-weight: 600; }
                    .progress-progress { color: #ffc107; }
                `;
                document.head.appendChild(style);
            }
            
            return `
                <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                        <div class="spinner-container">
                            <div class="hourglass"></div>
                        </div>
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 5px 0; color: #333;">🤖 Détection IA en cours...</h3>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 14px; color: #666;">Temps écoulé:</span>
                                <span id="timer-display" style="font-size: 18px; font-weight: 600; color: #007bff; font-family: monospace;">00:00</span>
                            </div>
                        </div>
                    </div>
                    <div style="width: 100%; height: 6px; background: #e9ecef; border-radius: 3px; margin-bottom: 15px; overflow: hidden; position: relative;">
                        <div class="progress-bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #007bff, #0056b3); transition: width 0.3s;"></div>
                        <div class="progress-bar-shine" style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent); animation: shine 2s infinite;"></div>
                    </div>
                    <div id="stream-content" style="display: block; margin-bottom: 15px;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px; font-weight: 600;">📝 Réponse IA en temps réel:</div>
                        <div id="stream-text" style="min-height: 100px; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; line-height: 1.6; padding: 15px; background: #f8f9fa; border-radius: 4px; border: 2px solid #007bff; white-space: pre-wrap; word-wrap: break-word; color: #333;">En attente des données...</div>
                    </div>
                    <div id="progress-messages" style="max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; line-height: 1.6; padding: 10px; background: white; border-radius: 4px; border: 1px solid #dee2e6;">
                        <div class="progress-message progress-info">Initialisation...</div>
                    </div>
                </div>
            `;
        }

        function closePromptValidationModal() {
            const modal = document.getElementById('prompt-validation-modal');
            if (modal) modal.remove();
        }

        function confirmPromptValidation() {
            const modal = document.getElementById('prompt-validation-modal');
            if (modal && modal._onConfirm) {
                closePromptValidationModal();
                modal._onConfirm();
            }
        }

        async function showPromptValidationModal(categoryId, categoryName, onConfirm) {
            try {
                const result = await apiCall('/prompts');
                const prompt = result.data.subCategoryPrompt || '';
                const category = currentData.categories.find(c => c.id === categoryId);
                const optionsList = (category?.options || []).map(opt => opt.name || opt.label || '').filter(Boolean);
                const totalOptions = optionsList.length;
                const previewPrompt = prompt
                    .replace(/\{\{categoryName\}\}/g, categoryName)
                    .replace(/\{\{optionsList\}\}/g, optionsList.length ? optionsList.join(', ') : 'Aucune option')
                    .replace(/\{\{totalOptions\}\}/g, totalOptions);

                const modal = document.createElement('div');
                modal.className = 'modal active';
                modal.id = 'prompt-validation-modal';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
                        <div class="modal-header">
                            <h2>📝 Validation du prompt IA</h2>
                            <button class="btn btn-danger" onclick="closePromptValidationModal()">Fermer</button>
                        </div>
                        <div style="padding: 20px;">
                            <p style="color: #666; margin-bottom: 15px;">
                                Le prompt suivant sera utilisé pour analyser la catégorie <strong>${categoryName}</strong>
                                (${totalOptions} option(s)).
                            </p>
                            <div style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Prompt à utiliser :</label>
                                <textarea id="prompt-preview" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 12px; line-height: 1.5; min-height: 300px; background: #f8f9fa;">${previewPrompt}</textarea>
                            </div>
                            <div style="display: flex; gap: 10px; justify-content: flex-end; padding-top: 20px; border-top: 2px solid #dee2e6;">
                                <button class="btn btn-outline" onclick="closePromptValidationModal()">Annuler</button>
                                <button class="btn btn-primary" onclick="confirmPromptValidation()">✅ Valider et lancer l'IA</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                modal._onConfirm = onConfirm;

                modal.addEventListener('click', (e) => {
                    if (e.target.id === 'prompt-validation-modal') closePromptValidationModal();
                });
            } catch (error) {
                console.error('Erreur lors du chargement du prompt:', error);
                showAlert('Erreur lors du chargement du prompt: ' + error.message, 'error');
            }
        }

        // Detect subcategories for all categories
        async function detectSubCategoriesForAll() {
            if (!currentData || !currentData.categories || currentData.categories.length === 0) {
                showAlert('Aucune catégorie disponible', 'error');
                return;
            }

            // Afficher le modal de validation du prompt
            try {
                const result = await apiCall('/prompts');
                const prompt = result.data.subCategoryPrompt || '';
                const totalOptions = currentData.categories.reduce((sum, cat) => sum + (cat.options || []).length, 0);
                const previewPrompt = prompt
                    .replace(/\{\{categoryName\}\}/g, 'TOUTES LES CATÉGORIES')
                    .replace(/\{\{optionsList\}\}/g, `(${totalOptions} options au total)`)
                    .replace(/\{\{totalOptions\}\}/g, totalOptions);
                
                const modal = document.createElement('div');
                modal.className = 'modal active';
                modal.id = 'prompt-validation-modal';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
                        <div class="modal-header">
                            <h2>📝 Validation du prompt IA</h2>
                            <button class="btn btn-danger" onclick="closePromptValidationModal()">Fermer</button>
                        </div>
                        <div style="padding: 20px;">
                            <p style="color: #666; margin-bottom: 15px;">
                                Le prompt suivant sera utilisé pour analyser <strong>${currentData.categories.length} catégorie(s)</strong> (${totalOptions} option(s) au total).
                                <br>Cela peut prendre plusieurs minutes.
                            </p>
                            <div style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Prompt à utiliser :</label>
                                <textarea id="prompt-preview" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 12px; line-height: 1.5; min-height: 300px; background: #f8f9fa;">${previewPrompt}</textarea>
                            </div>
                            <div style="display: flex; gap: 10px; justify-content: flex-end; padding-top: 20px; border-top: 2px solid #dee2e6;">
                                <button class="btn btn-outline" onclick="closePromptValidationModal()">Annuler</button>
                                <button class="btn btn-primary" onclick="confirmPromptValidationForAll()">✅ Valider et lancer l'IA</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                
                // Stocker la fonction de callback
                modal._onConfirm = () => launchDetectSubCategoriesForAll();
                
                // Fermer en cliquant en dehors
                modal.addEventListener('click', (e) => {
                    if (e.target.id === 'prompt-validation-modal') closePromptValidationModal();
                });
            } catch (error) {
                console.error('Erreur lors du chargement du prompt:', error);
                showAlert('Erreur lors du chargement du prompt: ' + error.message, 'error');
            }
        }
        
        function confirmPromptValidationForAll() {
            const modal = document.getElementById('prompt-validation-modal');
            if (modal && modal._onConfirm) {
                closePromptValidationModal();
                modal._onConfirm();
            }
        }
        
        // Fonction interne pour lancer la détection globale (séparée pour être appelée après validation)
        async function launchDetectSubCategoriesForAll() {

            // Afficher la progression
            const container = document.getElementById('subcategories-accordion');
            const progressHtml = createProgressDisplay();
            container.innerHTML = progressHtml;
            
            const progressContainer = container.querySelector('#progress-messages');
            const progressBar = container.querySelector('.progress-bar-fill');
            const timerDisplay = container.querySelector('#timer-display');
            const streamTextDiv = container.querySelector('#stream-text');
            let startTime = Date.now();
            let streamContent = '';
            
            // Démarrer le timer
            let seconds = 0;
            const timerInterval = setInterval(() => {
                seconds++;
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                if (timerDisplay) {
                    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                }
            }, 1000);
            
            // Mettre à jour la barre de progression
            let progressValue = 0;
            const progressInterval = setInterval(() => {
                if (progressValue < 90 && progressBar) {
                    progressValue += Math.random() * 2;
                    progressBar.style.width = Math.min(progressValue, 90) + '%';
                }
            }, 500);

            const addProgressMessage = (message, type = 'info') => {
                if (!progressContainer) return;
                const div = document.createElement('div');
                div.className = `progress-message progress-${type}`;
                div.textContent = message;
                progressContainer.appendChild(div);
                progressContainer.scrollTop = progressContainer.scrollHeight;
            };

            try {
                // Traiter chaque catégorie une par une
                const categories = currentData.categories;
                let processedCount = 0;
                
                for (const category of categories) {
                    addProgressMessage(`\n[${new Date().toLocaleTimeString()}] Analyse de la catégorie "${category.name}"...`, 'info');
                    
                    try {
                        const response = await fetch(
                            `/api/ugap/categories/${category.id}/detect-subcategories`,
                            {
                                method: 'POST',
                                headers: {
                                    'Accept': 'text/event-stream',
                                    'Content-Type': 'application/json'
                                },
                                credentials: 'include'
                            }
                        );

                        if (!response.ok) {
                            throw new Error(`Erreur HTTP: ${response.status}`);
                        }

                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '';

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || '';

                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const data = JSON.parse(line.substring(6));
                                        
                                        if (data.message) {
                                            addProgressMessage(`[${new Date().toLocaleTimeString()}] ${data.message}`, data.type || 'info');
                                        }
                                        
                                        if (data.chunk) {
                                            streamContent += data.chunk;
                                            if (streamTextDiv) {
                                                streamTextDiv.textContent = streamContent;
                                                streamTextDiv.scrollTop = streamTextDiv.scrollHeight;
                                            }
                                        }
                                        
                                        if (data.type === 'done') {
                                            if (progressBar) progressBar.style.width = '100%';
                                            addProgressMessage(`✅ Catégorie "${category.name}" terminée`, 'success');
                                        }
                                    } catch (e) {
                                        console.error('Erreur parsing SSE:', e);
                                    }
                                }
                            }
                        }
                        
                        processedCount++;
                        const progressPercent = Math.round((processedCount / categories.length) * 100);
                        if (progressBar) {
                            progressBar.style.width = `${progressPercent}%`;
                        }
                        
                    } catch (error) {
                        console.error(`Erreur pour la catégorie ${category.name}:`, error);
                        addProgressMessage(`❌ Erreur pour "${category.name}": ${error.message}`, 'error');
                    }
                }

                clearInterval(timerInterval);
                clearInterval(progressInterval);
                
                if (progressBar) progressBar.style.width = '100%';
                addProgressMessage(`\n✅ Analyse terminée pour ${processedCount}/${categories.length} catégorie(s)`, 'success');
                
                // Nettoyer les messages de progression et recharger les données
                setTimeout(async () => {
                    // Recharger les données
                    await loadData(true); // skipRender = true pour éviter de réinitialiser l'onglet
                    
                    // Nettoyer les messages de progression résiduels
                    const progressMessages = container.querySelector('#progress-messages');
                    if (progressMessages) {
                        progressMessages.remove();
                    }
                    
                    // Re-rendre l'accordéon avec les nouvelles données
                    console.log('🔄 Re-rendu de l\'accordéon après détection globale');
                    renderSubCategoriesAccordion();
                    
                    // Afficher un message de succès
                    showAlert(`✅ Analyse terminée ! ${processedCount} catégorie(s) traitée(s)`, 'success');
                }, 2000);
                
            } catch (error) {
                clearInterval(timerInterval);
                clearInterval(progressInterval);
                console.error('Erreur complète:', error);
                addProgressMessage('Erreur: ' + error.message, 'error');
                
                // Même en cas d'erreur, essayer de recharger les données
                setTimeout(async () => {
                    try {
                        await loadData(true);
                        const progressMessages = container.querySelector('#progress-messages');
                        if (progressMessages) {
                            progressMessages.remove();
                        }
                        renderSubCategoriesAccordion();
                    } catch (e) {
                        console.error('Erreur lors du rechargement:', e);
                    }
                }, 2000);
            }
        }

        // Show validation modal for detected subcategories
        function showSubCategoriesValidationModal(categoryId, detectedSubCategories) {
            // Récupérer les sous-catégories existantes
            const category = currentData.categories.find(c => c.id === categoryId);
            const existingSubCategories = (category?.subCategories || []).map(sc => ({
                ...sc,
                isExisting: true
            }));
            
            // Préparer les nouvelles sous-catégories
            const newSubCategories = detectedSubCategories.map(sc => ({
                ...sc,
                isExisting: false,
                selected: true // Par défaut, toutes sélectionnées
            }));
            
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'subcategories-validation-modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 1200px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>📋 Validation des sous-catégories détectées</h2>
                        <button class="btn btn-danger" onclick="closeSubCategoriesValidationModal()">Fermer</button>
                    </div>
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 30px;">
                            <h3 style="margin-bottom: 15px; color: #333;">Nouvelles sous-catégories détectées (${newSubCategories.length})</h3>
                            <div style="margin-bottom: 10px;">
                                <button class="btn btn-outline" onclick="selectAllNewSubCategories()">✓ Sélectionner tout</button>
                                <button class="btn btn-outline" onclick="deselectAllNewSubCategories()" style="margin-left: 10px;">✗ Désélectionner tout</button>
                            </div>
                            <div id="new-subcategories-list" style="border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; background: #f8f9fa; max-height: 400px; overflow-y: auto;">
                                ${newSubCategories.map((sc, index) => {
                                    const avgConfidence = sc.confidence && typeof sc.confidence === 'object' 
                                        ? Math.round(Object.values(sc.confidence).reduce((a, b) => a + b, 0) / Object.values(sc.confidence).length)
                                        : (sc.confidence || null);
                                    const confidenceColor = avgConfidence >= 90 ? '🟢' : avgConfidence >= 50 ? '🟠' : '🔴';
                                    return `
                                    <div style="padding: 10px; margin-bottom: 10px; background: white; border-radius: 4px; border: 1px solid #dee2e6; display: flex; align-items: start; gap: 10px;">
                                        <input type="checkbox" id="new-subcat-${index}" data-index="${index}" checked onchange="toggleNewSubCategory(${index})" style="margin-top: 5px;">
                                        <div style="flex: 1;">
                                            <strong>${sc.name}</strong>
                                            ${sc.description ? `<p style="color: #666; margin: 5px 0; font-size: 14px;">${sc.description}</p>` : ''}
                                            <p style="color: #999; margin: 5px 0; font-size: 12px;">
                                                ${(sc.optionIds || []).length} option(s)${avgConfidence !== null ? ` • Confiance: ${confidenceColor} ${avgConfidence}%` : ''}
                                            </p>
                                        </div>
                                    </div>
                                `;
                                }).join('')}
                            </div>
                        </div>
                        
                        ${existingSubCategories.length > 0 ? `
                        <div style="margin-bottom: 30px;">
                            <h3 style="margin-bottom: 15px; color: #333;">Sous-catégories existantes (${existingSubCategories.length})</h3>
                            <div style="margin-bottom: 10px;">
                                <button class="btn btn-danger" onclick="deleteSelectedExistingSubCategories('${categoryId}')">🗑️ Supprimer les sélectionnées</button>
                            </div>
                            <div id="existing-subcategories-list" style="border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; background: #f8f9fa; max-height: 400px; overflow-y: auto;">
                                ${existingSubCategories.map((sc, index) => `
                                    <div style="padding: 10px; margin-bottom: 10px; background: white; border-radius: 4px; border: 1px solid #dee2e6; display: flex; align-items: start; gap: 10px;">
                                        <input type="checkbox" id="existing-subcat-${index}" data-subcat-id="${sc.id}" style="margin-top: 5px;">
                                        <div style="flex: 1;">
                                            <strong>${sc.name}</strong>
                                            ${sc.description ? `<p style="color: #666; margin: 5px 0; font-size: 14px;">${sc.description}</p>` : ''}
                                            <p style="color: #999; margin: 5px 0; font-size: 12px;">
                                                ${(sc.optionIds || []).length} option(s)
                                            </p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 20px; border-top: 2px solid #dee2e6;">
                            <button class="btn btn-outline" onclick="closeSubCategoriesValidationModal()">Annuler</button>
                            <button class="btn btn-primary" onclick="validateSubCategories('${categoryId}')">✅ Valider et appliquer</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Stocker les données dans le modal pour y accéder plus tard
            modal._newSubCategories = newSubCategories;
            modal._existingSubCategories = existingSubCategories;
            
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'subcategories-validation-modal') closeSubCategoriesValidationModal();
            });
        }
        
        function closeSubCategoriesValidationModal() {
            const modal = document.getElementById('subcategories-validation-modal');
            if (modal) {
                // Supprimer le modal du DOM
                modal.remove();
                // Vérifier qu'il n'y a pas de modal résiduel et le supprimer si présent
                const remainingModal = document.getElementById('subcategories-validation-modal');
                if (remainingModal) {
                    remainingModal.remove();
                }
                // Supprimer aussi le backdrop si présent
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                // Supprimer la classe 'modal-open' du body si présente
                document.body.classList.remove('modal-open');
            }
        }
        
        function selectAllNewSubCategories() {
            const modal = document.getElementById('subcategories-validation-modal');
            if (!modal || !modal._newSubCategories) return;
            
            modal._newSubCategories.forEach((sc, index) => {
                sc.selected = true;
                const checkbox = document.getElementById(`new-subcat-${index}`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        function deselectAllNewSubCategories() {
            const modal = document.getElementById('subcategories-validation-modal');
            if (!modal || !modal._newSubCategories) return;
            
            modal._newSubCategories.forEach((sc, index) => {
                sc.selected = false;
                const checkbox = document.getElementById(`new-subcat-${index}`);
                if (checkbox) checkbox.checked = false;
            });
        }
        
        function toggleNewSubCategory(index) {
            const modal = document.getElementById('subcategories-validation-modal');
            if (!modal || !modal._newSubCategories) return;
            
            const checkbox = document.getElementById(`new-subcat-${index}`);
            if (checkbox && modal._newSubCategories[index]) {
                modal._newSubCategories[index].selected = checkbox.checked;
            }
        }
        
        async function deleteSelectedExistingSubCategories(categoryId) {
            const modal = document.getElementById('subcategories-validation-modal');
            if (!modal || !modal._existingSubCategories) return;
            
            const checkboxes = document.querySelectorAll('#existing-subcategories-list input[type="checkbox"]:checked');
            const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-subcat-id'));
            
            if (selectedIds.length === 0) {
                showAlert('Aucune sous-catégorie sélectionnée', 'info');
                return;
            }
            
            if (!confirm(`Supprimer ${selectedIds.length} sous-catégorie(s) existante(s) ?`)) {
                return;
            }
            
            try {
                for (const subCatId of selectedIds) {
                    await apiCall(`/categories/${categoryId}/subcategories/${subCatId}`, {
                        method: 'DELETE'
                    });
                }
                
                showAlert(`${selectedIds.length} sous-catégorie(s) supprimée(s)`, 'success');
                
                // Recharger les données et mettre à jour le modal
                await loadData(true);
                const category = currentData.categories.find(c => c.id === categoryId);
                const existingSubCategories = (category?.subCategories || []).map(sc => ({
                    ...sc,
                    isExisting: true
                }));
                modal._existingSubCategories = existingSubCategories;
                
                // Re-rendre la liste des existantes
                const existingList = document.getElementById('existing-subcategories-list');
                if (existingList) {
                    existingList.innerHTML = existingSubCategories.map((sc, index) => `
                        <div style="padding: 10px; margin-bottom: 10px; background: white; border-radius: 4px; border: 1px solid #dee2e6; display: flex; align-items: start; gap: 10px;">
                            <input type="checkbox" id="existing-subcat-${index}" data-subcat-id="${sc.id}" style="margin-top: 5px;">
                            <div style="flex: 1;">
                                <strong>${sc.name}</strong>
                                ${sc.description ? `<p style="color: #666; margin: 5px 0; font-size: 14px;">${sc.description}</p>` : ''}
                                <p style="color: #999; margin: 5px 0; font-size: 12px;">
                                    ${(sc.optionIds || []).length} option(s)
                                </p>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (error) {
                showAlert('Erreur lors de la suppression: ' + error.message, 'error');
            }
        }
        
        // Variable pour empêcher les appels multiples
        let isValidatingSubCategories = false;
        
        async function validateSubCategories(categoryId) {
            // Empêcher les appels multiples
            if (isValidatingSubCategories) {
                console.log('⚠️ Validation déjà en cours, ignore le clic');
                return;
            }
            
            const modal = document.getElementById('subcategories-validation-modal');
            if (!modal || !modal._newSubCategories) return;
            
            const selectedNew = modal._newSubCategories.filter(sc => sc.selected);
            
            if (selectedNew.length === 0) {
                showAlert('Aucune nouvelle sous-catégorie sélectionnée', 'info');
                return;
            }
            
            // Marquer comme en cours de traitement
            isValidatingSubCategories = true;
            
            // Fermer le modal IMMÉDIATEMENT pour empêcher les doubles clics
            closeSubCategoriesValidationModal();
            
            // Petite pause pour s'assurer que le modal est bien fermé
            await new Promise(resolve => setTimeout(resolve, 50));
            
            try {
                showAlert(`Création de ${selectedNew.length} sous-catégorie(s)...`, 'info');
                
                for (const subCat of selectedNew) {
                    try {
                        await apiCall(`/categories/${categoryId}/subcategories`, {
                            method: 'POST',
                            body: JSON.stringify({
                                name: subCat.name,
                                description: subCat.description,
                                optionIds: subCat.optionIds || []
                            })
                        });
                    } catch (error) {
                        console.error(`Erreur pour "${subCat.name}":`, error);
                    }
                }
                
                showAlert(`${selectedNew.length} sous-catégorie(s) créée(s) avec succès !`, 'success');
                
                // Recharger les données
                await loadData(true); // skipRender = true pour éviter de réinitialiser l'onglet
                
                // S'assurer qu'on est sur l'onglet famille
                const familleTab = document.querySelector('.tab[data-tab="famille"]');
                if (familleTab && !familleTab.classList.contains('active')) {
                    // Activer l'onglet si ce n'est pas déjà fait
                    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
                    familleTab.classList.add('active');
                    document.getElementById('tab-famille')?.classList.add('active');
                }
                
                // Attendre un peu pour que le DOM soit prêt et que les données soient chargées
                setTimeout(() => {
                    // Nettoyer les messages de progression résiduels avant de re-rendre
                    const container = document.getElementById('subcategories-accordion');
                    if (container) {
                        const progressMessages = container.querySelector('#progress-messages');
                        if (progressMessages) {
                            // Supprimer les messages de progression pour permettre le re-rendu
                            progressMessages.remove();
                        }
                    }
                    
                    // Re-rendre l'onglet famille
                    renderExtractionInsights();
                }, 200);
            } catch (error) {
                showAlert('Erreur lors de la validation: ' + error.message, 'error');
            } finally {
                // Réinitialiser le flag pour permettre de nouvelles validations
                isValidatingSubCategories = false;
            }
        }

        // Gestion de la sélection en masse des sous-catégories dans l'accordéon
        function selectAllSubCategoriesInCategory(categoryId) {
            const checkboxes = document.querySelectorAll(`.subcategory-checkbox[data-category-id="${categoryId}"]`);
            checkboxes.forEach(cb => {
                cb.checked = true;
            });
            const selectAllCheckbox = document.getElementById(`select-all-${categoryId}`);
            if (selectAllCheckbox) selectAllCheckbox.checked = true;
            updateSelectedCount(categoryId);
        }
        
        function deselectAllSubCategoriesInCategory(categoryId) {
            const checkboxes = document.querySelectorAll(`.subcategory-checkbox[data-category-id="${categoryId}"]`);
            checkboxes.forEach(cb => {
                cb.checked = false;
            });
            const selectAllCheckbox = document.getElementById(`select-all-${categoryId}`);
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            updateSelectedCount(categoryId);
        }
        
        function toggleSelectAllSubCategories(categoryId, checked) {
            const checkboxes = document.querySelectorAll(`.subcategory-checkbox[data-category-id="${categoryId}"]`);
            checkboxes.forEach(cb => {
                cb.checked = checked;
            });
            updateSelectedCount(categoryId);
        }
        
        function updateSelectedCount(categoryId) {
            const checkboxes = document.querySelectorAll(`.subcategory-checkbox[data-category-id="${categoryId}"]:checked`);
            const count = checkboxes.length;
            const countSpan = document.getElementById(`selected-count-${categoryId}`);
            if (countSpan) {
                countSpan.textContent = `${count} sélectionnée(s)`;
            }
            
            // Mettre à jour la checkbox "Sélectionner tout"
            const selectAllCheckbox = document.getElementById(`select-all-${categoryId}`);
            if (selectAllCheckbox) {
                const allCheckboxes = document.querySelectorAll(`.subcategory-checkbox[data-category-id="${categoryId}"]`);
                selectAllCheckbox.checked = allCheckboxes.length > 0 && checkboxes.length === allCheckboxes.length;
            }
        }
        
        async function deleteSelectedSubCategoriesInCategory(categoryId) {
            const checkboxes = document.querySelectorAll(`.subcategory-checkbox[data-category-id="${categoryId}"]:checked`);
            const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-subcat-id'));
            
            if (selectedIds.length === 0) {
                showAlert('Aucune sous-catégorie sélectionnée', 'info');
                return;
            }
            
            const category = currentData.categories.find(c => c.id === categoryId);
            const subCatNames = selectedIds.map(id => {
                const subCat = category?.subCategories?.find(sc => sc.id === id);
                return subCat?.name || id;
            });
            
            if (!confirm(`Supprimer ${selectedIds.length} sous-catégorie(s) ?\n\n${subCatNames.slice(0, 5).join(', ')}${subCatNames.length > 5 ? ` et ${subCatNames.length - 5} autre(s)...` : ''}`)) {
                return;
            }
            
            try {
                showAlert(`Suppression de ${selectedIds.length} sous-catégorie(s)...`, 'info');
                
                let successCount = 0;
                let errorCount = 0;
                
                for (const subCatId of selectedIds) {
                    try {
                        await apiCall(`/categories/${categoryId}/subcategories/${subCatId}`, {
                            method: 'DELETE'
                        });
                        successCount++;
                    } catch (error) {
                        console.error(`Erreur suppression ${subCatId}:`, error);
                        errorCount++;
                    }
                }
                
                if (errorCount === 0) {
                    showAlert(`${successCount} sous-catégorie(s) supprimée(s) avec succès !`, 'success');
                } else {
                    showAlert(`${successCount} supprimée(s), ${errorCount} erreur(s)`, errorCount === selectedIds.length ? 'error' : 'warning');
                }
                
                await loadData();
                renderSubCategoriesAccordion();
            } catch (error) {
                showAlert('Erreur lors de la suppression: ' + error.message, 'error');
            }
        }

        // addSubCategory() est redéfini plus haut pour gérer l'assignation famille -> vue métier.

        // Improve categorization with AI (avec streaming SSE)
        async function improveCategorization() {
            if (!confirm('L\'IA va analyser toutes les options et améliorer leur catégorisation. Continuer ?')) return;

            // Afficher la progression dans le conteneur des catégories
            const container = document.querySelector('#categories-management-table').parentElement;
            const originalContent = container.innerHTML;
            let progressHtml = createProgressDisplay();
            // Modifier le titre pour l'amélioration de catégorisation
            progressHtml = progressHtml.replace('🤖 Détection IA en cours...', '🤖 Amélioration catégorisation en cours...');
            container.innerHTML = progressHtml;
            
            const progressContainer = container.querySelector('#progress-messages');
            const progressBar = container.querySelector('.progress-bar-fill');
            const timerDisplay = container.querySelector('#timer-display');
            const streamContentDiv = container.querySelector('#stream-content');
            const streamTextDiv = container.querySelector('#stream-text');
            let startTime = Date.now();
            let streamContent = '';
            
            // Démarrer le timer
            let seconds = 0;
            const timerInterval = setInterval(() => {
                seconds++;
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                if (timerDisplay) {
                    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                }
            }, 1000);
            
            // Mettre à jour la barre de progression progressivement
            let progressValue = 0;
            const progressInterval = setInterval(() => {
                if (progressValue < 90 && progressBar) {
                    progressValue += Math.random() * 2;
                    progressBar.style.width = Math.min(progressValue, 90) + '%';
                }
            }, 500);

            try {
                // Utiliser fetch avec streaming pour SSE
                const response = await fetch(
                    `/api/ugap/improve-categorization`,
                    {
                        method: 'POST',
                        headers: {
                            'Accept': 'text/event-stream',
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include'
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let currentEvent = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const decoded = decoder.decode(value, { stream: true });
                    buffer += decoded;
                    streamContent += decoded;
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.trim() === '') {
                            if (currentEvent && currentEvent.data) {
                                try {
                                    const data = JSON.parse(currentEvent.data);
                                    
                                    if (currentEvent.type === 'progress') {
                                        if (data.message) {
                                            addProgressMessage(data.message, data.type || 'info');
                                        }
                                        
                                        // Afficher le texte streamé en temps réel
                                        if (data.streamText) {
                                            if (streamContentDiv) streamContentDiv.style.display = 'block';
                                            if (streamTextDiv) {
                                                streamTextDiv.textContent = data.streamText;
                                                streamTextDiv.scrollTop = streamTextDiv.scrollHeight;
                                            }
                                        }
                                        
                                        // Si on a un nouveau chunk, l'ajouter en temps réel
                                        if (data.streamChunk) {
                                            if (streamContentDiv) streamContentDiv.style.display = 'block';
                                            if (streamTextDiv) {
                                                streamTextDiv.textContent += data.streamChunk;
                                                streamTextDiv.scrollTop = streamTextDiv.scrollHeight;
                                            }
                                        }
                                        
                                        if (data.partialCategorizations && Array.isArray(data.partialCategorizations)) {
                                            const isFinal = data.isFinal === true;
                                            const isPartial = data.isPartial === true;
                                            const prefix = isFinal ? '✅' : (isPartial ? '🎯' : '🔄');
                                            const status = isFinal ? '(final)' : (isPartial ? '(partiel)' : 'en temps réel');
                                            addProgressMessage(`${prefix} ${data.partialCategorizations.length} catégorisation(s) détectée(s) ${status}`, 'success');
                                            
                                            if (isFinal) {
                                                addProgressMessage(`Application de ${data.partialCategorizations.length} catégorisation(s)...`, 'info');
                                                // Ici, on pourrait appliquer les catégorisations si nécessaire
                                                addProgressMessage('Terminé !', 'success');
                                                
                                                if (container._cleanup) {
                                                    container._cleanup();
                                                }
                                                
                                                if (progressBar) {
                                                    progressBar.style.width = '100%';
                                                }
                                                
                                                setTimeout(async () => {
                                                    await loadData();
                                                    container.innerHTML = originalContent;
                                                }, 1000);
                                            }
                                        }
                                    } else if (currentEvent.type === 'done') {
                                        addProgressMessage(data.message, 'success');
                                        
                                        if (data.data && data.data.length > 0) {
                                            addProgressMessage(`Application de ${data.data.length} catégorisation(s)...`, 'info');
                                            // Appliquer les catégorisations si nécessaire
                                        }
                                        
                                        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                                        addProgressMessage(`Durée totale: ${duration}s`, 'info');
                                        
                                        if (container._cleanup) {
                                            container._cleanup();
                                        }
                                        
                                        if (progressBar) {
                                            progressBar.style.width = '100%';
                                        }
                                        
                                        setTimeout(async () => {
                                            await loadData();
                                            container.innerHTML = originalContent;
                                        }, 1000);
                                    } else if (currentEvent.type === 'error') {
                                        addProgressMessage(data.message || 'Erreur inconnue', 'error');
                                        
                                        if (container._cleanup) {
                                            container._cleanup();
                                        }
                                        
                                        setTimeout(() => {
                                            container.innerHTML = `<p style="color: #dc3545; padding: 20px; text-align: center;">❌ Erreur: ${data.message || 'Erreur inconnue'}</p>`;
                                        }, 2000);
                                    }
                                } catch (e) {
                                    console.error('Erreur parsing SSE:', e);
                                }
                            }
                            currentEvent = null;
                            continue;
                        }
                        
                        if (line.startsWith('event: ')) {
                            currentEvent = { type: line.substring(7).trim(), data: null };
                        } else if (line.startsWith('data: ')) {
                            if (!currentEvent) currentEvent = { type: 'message', data: null };
                            currentEvent.data = line.substring(6).trim();
                        }
                    }
                }

            } catch (error) {
                console.error('Erreur complète:', error);
                addProgressMessage('Erreur: ' + error.message, 'error');
                
                if (container._cleanup) {
                    container._cleanup();
                }
                
                setTimeout(() => {
                    let errorHtml = `<div style="padding: 20px;">
                        <p style="color: #dc3545; font-weight: 600; margin-bottom: 10px;">❌ Erreur: ${error.message}</p>`;
                    if (streamContent) {
                        errorHtml += `<details style="margin-top: 10px;">
                            <summary style="cursor: pointer; color: #666;">Voir le contenu du stream reçu</summary>
                            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; margin-top: 10px; font-size: 11px; max-height: 300px; overflow-y: auto;">${streamContent.substring(0, 5000)}${streamContent.length > 5000 ? '...' : ''}</pre>
                        </details>`;
                    }
                    errorHtml += `</div>`;
                    container.innerHTML = errorHtml;
                }, 2000);
            }
            
            function addProgressMessage(message, type = 'info') {
                if (!progressContainer) return;
                const messageEl = document.createElement('div');
                messageEl.className = `progress-message progress-${type}`;
                messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
                progressContainer.appendChild(messageEl);
                progressContainer.scrollTop = progressContainer.scrollHeight;
            }
            
            // Nettoyer les intervals à la fin
            const cleanup = () => {
                clearInterval(timerInterval);
                clearInterval(progressInterval);
                if (typeof streamTimeout !== 'undefined') {
                    clearTimeout(streamTimeout);
                }
            };
            
            container._cleanup = cleanup;
        }

        // Edit category
        async function editCategory(categoryId) {
            const category = currentData?.categories?.find(cat => cat.id === categoryId);
            if (!category) {
                showAlert('Catégorie introuvable', 'error');
                return;
            }

            const name = prompt('Modifier le nom de la catégorie:', category.name);
            if (name === null) return;
            const trimmedName = name.trim();
            if (!trimmedName) {
                showAlert('Le nom de catégorie est obligatoire', 'error');
                return;
            }
            if (trimmedName === category.name) return;

            try {
                await apiCall(`/categories/${categoryId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name: trimmedName })
                });
                showAlert('Catégorie mise à jour', 'success');
                await loadData();
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        // Afficher les détails d'une sous-catégorie avec menu de déplacement
        function showSubCategoryDetails(categoryId, subCategory) {
            const category = currentData.categories.find(c => c.id === categoryId);
            if (!category) {
                console.error('❌ Catégorie introuvable:', categoryId);
                return;
            }

            console.log('🔍 showSubCategoryDetails:', {
                categoryId,
                subCategoryName: subCategory.name,
                subCategoryOptionIds: subCategory.optionIds,
                totalCategoryOptions: (category.options || []).length,
                categoryOptionIds: (category.options || []).map(opt => opt.id).slice(0, 10)
            });

            // Filtrer les options qui correspondent aux optionIds de la sous-catégorie
            const options = (category.options || []).filter(opt => {
                const isIncluded = (subCategory.optionIds || []).includes(opt.id);
                if (!isIncluded) {
                    console.log(`⚠️ Option "${opt.name}" (ID: ${opt.id}) non trouvée dans optionIds:`, subCategory.optionIds);
                }
                return isIncluded;
            });

            console.log(`✅ ${options.length} option(s) trouvée(s) pour la sous-catégorie "${subCategory.name}"`);

            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            modal.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 8px; max-width: 800px; max-height: 90vh; overflow-y: auto; width: 90%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0;">${subCategory.name}</h2>
                        <button id="close-modal-btn" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Fermer</button>
                    </div>
                    <p style="color: #666; margin-bottom: 20px;">${subCategory.description || 'Aucune description'}</p>
                    <div style="margin-bottom: 20px; display: flex; gap: 10px;">
                        <button onclick="createCollectionForSubCategory('${categoryId}', ${JSON.stringify(subCategory).replace(/"/g, '&quot;')})" 
                                style="padding: 10px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            📚 Créer collection
                        </button>
                        <button onclick="editSubCategory('${categoryId}', ${JSON.stringify(subCategory).replace(/"/g, '&quot;')})" 
                                style="padding: 10px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            ✏️ Modifier
                        </button>
                    </div>
                    <h3 style="margin-bottom: 15px;">Options (${options.length} / ${(subCategory.optionIds || []).length} attendues)</h3>
                    ${options.length === 0 ? `
                        <div style="padding: 20px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404;">
                            <strong>⚠️ Aucune option trouvée</strong>
                            <p style="margin: 10px 0 0 0;">
                                La sous-catégorie indique ${(subCategory.optionIds || []).length} option(s), mais aucune option correspondante n'a été trouvée dans la catégorie.
                                <br>Vérifiez que les IDs des options correspondent bien.
                            </p>
                            <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
                                OptionIds dans la sous-catégorie: ${(subCategory.optionIds || []).slice(0, 5).join(', ')}${(subCategory.optionIds || []).length > 5 ? '...' : ''}
                                <br>IDs des options de la catégorie: ${(category.options || []).slice(0, 5).map(opt => opt.id).join(', ')}${(category.options || []).length > 5 ? '...' : ''}
                            </p>
                        </div>
                    ` : `
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; width: 40px;">
                                    <input type="checkbox" id="select-all-options-${subCategory.id}" onclick="toggleAllOptionsInSubCategory('${subCategory.id}')">
                                </th>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Option</th>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Prix Client</th>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Prix UGAP</th>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Catégorie</th>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Déplacer vers</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${options.map(opt => `
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">
                                        <input type="checkbox" class="option-checkbox-${subCategory.id}" data-option-id="${opt.id}">
                                    </td>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${opt.name}</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${(opt.priceClient || 0).toFixed(2)} €</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${(opt.priceUgap || 0).toFixed(2)} €</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">
                                        <select id="category-select-${opt.id}" onchange="handleOptionCategoryChange('${categoryId}', '${subCategory.id}', '${opt.id}')" style="padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                                            ${(currentData?.categories || [])
                                                .map(cat => `<option value="${cat.id}" ${cat.id === categoryId ? 'selected' : ''}>${cat.name}</option>`)
                                                .join('')}
                                        </select>
                                    </td>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">
                                        <select id="subcategory-select-${opt.id}" onchange="handleOptionMoveFromSubCategoryRow('${categoryId}', '${subCategory.id}', '${opt.id}')" style="padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                                            <option value="">-- Choisir une destination --</option>
                                            <option value="none">Retirer de la sous-catégorie</option>
                                            ${(category.subCategories || [])
                                                .filter(sc => sc.id !== subCategory.id)
                                                .map(sc => `<option value="${sc.id}">${sc.name}</option>`)
                                                .join('')}
                                        </select>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                        <div style="font-weight: 600; margin-bottom: 10px;">Déplacer les options sélectionnées</div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                            <select id="bulk-category-select-${subCategory.id}" onchange="handleBulkCategoryChange('${categoryId}', '${subCategory.id}')" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                ${(currentData?.categories || [])
                                    .map(cat => `<option value="${cat.id}" ${cat.id === categoryId ? 'selected' : ''}>${cat.name}</option>`)
                                    .join('')}
                            </select>
                            <select id="bulk-subcategory-select-${subCategory.id}" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="">-- Choisir une sous-catégorie --</option>
                                <option value="none">Retirer de la sous-catégorie</option>
                                ${(category.subCategories || [])
                                    .map(sc => `<option value="${sc.id}">${sc.name}</option>`)
                                    .join('')}
                            </select>
                            <button onclick="applyBulkMove('${categoryId}', '${subCategory.id}')" style="padding: 8px 14px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Déplacer la sélection
                            </button>
                        </div>
                    </div>
                    `}
                </div>
            `;
            document.body.appendChild(modal);
            
            // Gérer la fermeture de la modal
            const closeBtn = modal.querySelector('#close-modal-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => modal.remove());
            }
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };
        }

        // Afficher les détails d'une option avec menu de déplacement
        function showOptionDetails(categoryId, option) {
            const category = currentData.categories.find(c => c.id === categoryId);
            if (!category) return;

            const currentSubCategory = (category.subCategories || []).find(sc => 
                (sc.optionIds || []).includes(option.id)
            );

            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            modal.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 8px; max-width: 600px; width: 90%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0;">${option.name}</h2>
                        <button id="close-option-modal-btn" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Fermer</button>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <p><strong>Prix Client:</strong> ${(option.priceClient || 0).toFixed(2)} €</p>
                        <p><strong>Prix UGAP:</strong> ${(option.priceUgap || 0).toFixed(2)} €</p>
                        <p><strong>Modèles compatibles:</strong> ${(option.compatibleModels || []).length} modèle(s)</p>
                        <p><strong>Sous-catégorie actuelle:</strong> ${currentSubCategory ? currentSubCategory.name : 'Aucune'}</p>
                        ${option.type === 'couleur' || option.name.toLowerCase().includes('couleur') ? `
                            <div style="margin-top: 15px;">
                                <button onclick="modifyOptionColor('${categoryId}', ${JSON.stringify(option).replace(/"/g, '&quot;')})" 
                                        style="padding: 10px 16px; background: #ffc107; color: #000; border: none; border-radius: 4px; cursor: pointer;">
                                    🎨 Modifier la couleur
                                </button>
                            </div>
                        ` : ''}
                        ${currentSubCategory && currentSubCategory.idDocTemplate ? `
                            <div style="margin-top: 15px;">
                                <button onclick="addOptionToCollection('${categoryId}', ${JSON.stringify(option).replace(/"/g, '&quot;')}, ${JSON.stringify(currentSubCategory).replace(/"/g, '&quot;')})" 
                                        style="padding: 10px 16px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                    📝 Ajouter à la collection
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 10px; font-weight: bold;">Déplacer vers une sous-catégorie:</label>
                        <select id="move-option-select" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px;">
                            <option value="none">Retirer de la sous-catégorie</option>
                            ${(category.subCategories || [])
                                .filter(sc => sc.id !== (currentSubCategory?.id))
                                .map(sc => `<option value="${sc.id}">${sc.name}</option>`)
                                .join('')}
                        </select>
                        <button onclick="moveOption('${categoryId}', '${currentSubCategory?.id || ''}', '${option.id}', document.getElementById('move-option-select').value)" 
                                style="width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Déplacer
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Gérer la fermeture de la modal
            const closeBtn = modal.querySelector('#close-option-modal-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => modal.remove());
            }
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };
        }

        function handleOptionCategoryChange(fromCategoryId, fromSubCategoryId, optionId) {
            const categorySelect = document.getElementById(`category-select-${optionId}`);
            const subCategorySelect = document.getElementById(`subcategory-select-${optionId}`);
            if (!categorySelect || !subCategorySelect) return;

            const targetCategoryId = categorySelect.value || fromCategoryId;
            const targetCategory = currentData?.categories?.find(cat => cat.id === targetCategoryId);
            const shouldExcludeCurrent = targetCategoryId === fromCategoryId ? fromSubCategoryId : null;

            const optionsHtml = [
                '<option value="">-- Choisir une destination --</option>',
                '<option value="none">Retirer de la sous-catégorie</option>',
                ...(targetCategory?.subCategories || [])
                    .filter(sc => !shouldExcludeCurrent || sc.id !== shouldExcludeCurrent)
                    .map(sc => `<option value="${sc.id}">${sc.name}</option>`)
            ].join('');

            subCategorySelect.innerHTML = optionsHtml;
        }

        function handleBulkCategoryChange(fromCategoryId, subCategoryId) {
            const categorySelect = document.getElementById(`bulk-category-select-${subCategoryId}`);
            const subCategorySelect = document.getElementById(`bulk-subcategory-select-${subCategoryId}`);
            if (!categorySelect || !subCategorySelect) return;

            const targetCategoryId = categorySelect.value || fromCategoryId;
            const targetCategory = currentData?.categories?.find(cat => cat.id === targetCategoryId);

            const optionsHtml = [
                '<option value="">-- Choisir une sous-catégorie --</option>',
                '<option value="none">Retirer de la sous-catégorie</option>',
                ...(targetCategory?.subCategories || [])
                    .map(sc => `<option value="${sc.id}">${sc.name}</option>`)
            ].join('');

            subCategorySelect.innerHTML = optionsHtml;
        }

        function toggleAllOptionsInSubCategory(subCategoryId) {
            const master = document.getElementById(`select-all-options-${subCategoryId}`);
            const checkboxes = document.querySelectorAll(`.option-checkbox-${subCategoryId}`);
            if (!master) return;
            checkboxes.forEach(cb => {
                cb.checked = master.checked;
            });
        }

        async function applyBulkMove(fromCategoryId, fromSubCategoryId) {
            const categorySelect = document.getElementById(`bulk-category-select-${fromSubCategoryId}`);
            const subCategorySelect = document.getElementById(`bulk-subcategory-select-${fromSubCategoryId}`);
            if (!categorySelect || !subCategorySelect) return;

            const toCategoryId = categorySelect.value || fromCategoryId;
            const toSubCategoryId = subCategorySelect.value || '';
            if (!toSubCategoryId) {
                showAlert('Choisissez une sous-catégorie de destination', 'error');
                return;
            }

            const selected = Array.from(document.querySelectorAll(`.option-checkbox-${fromSubCategoryId}:checked`))
                .map(cb => cb.getAttribute('data-option-id'))
                .filter(Boolean);

            if (selected.length === 0) {
                showAlert('Aucune option sélectionnée', 'error');
                return;
            }

            try {
                if (toCategoryId === fromCategoryId) {
                    await moveOptionsWithinCategoryBulk(fromCategoryId, fromSubCategoryId, selected, toSubCategoryId);
                } else {
                    for (const optionId of selected) {
                        await moveOptionToCategorySilent(fromCategoryId, optionId, toCategoryId, toSubCategoryId);
                    }
                }

                showAlert(`${selected.length} option(s) déplacée(s)`, 'success');
                await loadData();

                const activeTab = document.querySelector('.tab-button.active');
                if (activeTab) {
                    const tabName = activeTab.getAttribute('data-tab');
                    if (tabName === 'subcategories') {
                        renderSubCategoriesAccordion();
                    } else if (tabName === 'options') {
                        renderCategories();
                    }
                }

                document.querySelectorAll('div[style*="position: fixed"]').forEach(modal => modal.remove());
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        async function moveOptionToCategorySilent(fromCategoryId, optionId, toCategoryId, toSubCategoryId) {
            await apiCall(`/categories/${fromCategoryId}/options/${optionId}/move`, {
                method: 'POST',
                body: JSON.stringify({ toCategoryId, toSubCategoryId })
            });
        }

        async function moveOptionsWithinCategoryBulk(categoryId, fromSubCategoryId, optionIds, toSubCategoryId) {
            const category = currentData?.categories?.find(cat => cat.id === categoryId);
            if (!category) throw new Error('Catégorie introuvable');

            const fromSubCat = (category.subCategories || []).find(sc => sc.id === fromSubCategoryId);
            if (!fromSubCat) throw new Error('Sous-catégorie source introuvable');

            const selectedSet = new Set(optionIds);
            const updatedFromIds = (fromSubCat.optionIds || []).filter(id => !selectedSet.has(id));
            await apiCall(`/categories/${categoryId}/subcategories/${fromSubCategoryId}`, {
                method: 'PUT',
                body: JSON.stringify({ optionIds: updatedFromIds })
            });

            if (toSubCategoryId && toSubCategoryId !== 'none') {
                const toSubCat = (category.subCategories || []).find(sc => sc.id === toSubCategoryId);
                if (!toSubCat) throw new Error('Sous-catégorie destination introuvable');

                const updatedToIds = Array.from(new Set([...(toSubCat.optionIds || []), ...optionIds]));
                await apiCall(`/categories/${categoryId}/subcategories/${toSubCategoryId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ optionIds: updatedToIds })
                });

                const nonAssigned = (category.subCategories || []).find(sc =>
                    /non attribu(e|ées)/i.test(sc.name || '')
                );
                if (nonAssigned && nonAssigned.id !== toSubCategoryId) {
                    const cleanedIds = (nonAssigned.optionIds || []).filter(id => !selectedSet.has(id));
                    if (cleanedIds.length !== (nonAssigned.optionIds || []).length) {
                        await apiCall(`/categories/${categoryId}/subcategories/${nonAssigned.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ optionIds: cleanedIds })
                        });
                    }
                }
            }
        }

        function handleOptionMoveFromSubCategoryRow(fromCategoryId, fromSubCategoryId, optionId) {
            const categorySelect = document.getElementById(`category-select-${optionId}`);
            const subCategorySelect = document.getElementById(`subcategory-select-${optionId}`);
            if (!categorySelect || !subCategorySelect) return;

            const toCategoryId = categorySelect.value || fromCategoryId;
            const toSubCategoryId = subCategorySelect.value || '';
            if (!toSubCategoryId) return;

            if (toCategoryId === fromCategoryId) {
                moveOption(fromCategoryId, fromSubCategoryId, optionId, toSubCategoryId);
                return;
            }

            moveOptionToCategory(fromCategoryId, fromSubCategoryId, optionId, toCategoryId, toSubCategoryId);
        }

        async function moveOptionToCategory(fromCategoryId, fromSubCategoryId, optionId, toCategoryId, toSubCategoryId) {
            try {
                await apiCall(`/categories/${fromCategoryId}/options/${optionId}/move`, {
                    method: 'POST',
                    body: JSON.stringify({ toCategoryId, toSubCategoryId })
                });

                showAlert('Option déplacée avec succès', 'success');
                await loadData();

                const activeTab = document.querySelector('.tab-button.active');
                if (activeTab) {
                    const tabName = activeTab.getAttribute('data-tab');
                    if (tabName === 'subcategories') {
                        renderSubCategoriesAccordion();
                    } else if (tabName === 'options') {
                        renderCategories();
                    }
                }

                document.querySelectorAll('div[style*="position: fixed"]').forEach(modal => modal.remove());
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        // Déplacer une option entre sous-catégories
        async function moveOption(categoryId, fromSubCategoryId, optionId, toSubCategoryId) {
            try {
                // Retirer de l'ancienne sous-catégorie si elle existe
                if (fromSubCategoryId) {
                    const category = currentData.categories.find(c => c.id === categoryId);
                    const fromSubCat = (category?.subCategories || []).find(sc => sc.id === fromSubCategoryId);
                    if (fromSubCat) {
                        const updatedOptionIds = (fromSubCat.optionIds || []).filter(id => id !== optionId);
                        await apiCall(`/categories/${categoryId}/subcategories/${fromSubCategoryId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ optionIds: updatedOptionIds })
                        });
                    }
                }

                // Ajouter à la nouvelle sous-catégorie si elle existe
                if (toSubCategoryId && toSubCategoryId !== 'none') {
                    const category = currentData.categories.find(c => c.id === categoryId);
                    const toSubCat = (category?.subCategories || []).find(sc => sc.id === toSubCategoryId);
                    if (toSubCat) {
                        const updatedOptionIds = [...(toSubCat.optionIds || []), optionId];
                        await apiCall(`/categories/${categoryId}/subcategories/${toSubCategoryId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ optionIds: updatedOptionIds })
                        });
                    }

                    // Retirer de "Non attribuées" si besoin
                    const nonAssigned = (category?.subCategories || []).find(sc =>
                        /non attribu(e|ées)/i.test(sc.name || '')
                    );
                    if (nonAssigned && nonAssigned.id !== toSubCategoryId) {
                        const cleanedIds = (nonAssigned.optionIds || []).filter(id => id !== optionId);
                        if (cleanedIds.length !== (nonAssigned.optionIds || []).length) {
                            await apiCall(`/categories/${categoryId}/subcategories/${nonAssigned.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ optionIds: cleanedIds })
                            });
                        }
                    }
                }

                showAlert('Option déplacée avec succès', 'success');
                await loadData();
                
                // Re-rendre les vues
                const activeTab = document.querySelector('.tab-button.active');
                if (activeTab) {
                    const tabName = activeTab.getAttribute('data-tab');
                    if (tabName === 'subcategories') {
                        renderSubCategoriesAccordion();
                    } else if (tabName === 'options') {
                        renderCategories();
                    }
                }

                // Fermer les modals
                document.querySelectorAll('div[style*="position: fixed"]').forEach(modal => modal.remove());
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        // Modifier une sous-catégorie
        async function editSubCategory(categoryId, subCategoryId) {
            const category = currentData.categories.find(c => c.id === categoryId);
            if (!category) return;
            
            const subCategory = (category.subCategories || []).find(sc => sc.id === subCategoryId);
            if (!subCategory) return;

            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            modal.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 8px; max-width: 600px; width: 90%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0;">Modifier la sous-catégorie</h2>
                        <button id="close-edit-modal-btn" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Fermer</button>
                    </div>
                    <form id="edit-subcategory-form" style="display: flex; flex-direction: column; gap: 15px;">
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nom:</label>
                            <input type="text" id="edit-subcat-name" value="${subCategory.name || ''}" 
                                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;" required>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Description:</label>
                            <textarea id="edit-subcat-description" rows="4" 
                                      style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">${subCategory.description || ''}</textarea>
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button type="button" id="cancel-edit-btn" 
                                    style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Annuler
                            </button>
                            <button type="submit" 
                                    style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Enregistrer
                            </button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Gérer la fermeture de la modal
            const closeBtn = modal.querySelector('#close-edit-modal-btn');
            const cancelBtn = modal.querySelector('#cancel-edit-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => modal.remove());
            }
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => modal.remove());
            }
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };
            
            // Gérer la soumission du formulaire
            const form = modal.querySelector('#edit-subcategory-form');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('edit-subcat-name').value.trim();
                const description = document.getElementById('edit-subcat-description').value.trim();
                
                if (!name) {
                    showAlert('Le nom est requis', 'error');
                    return;
                }
                
                try {
                    await apiCall(`/categories/${categoryId}/subcategories/${subCategoryId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ name, description })
                    });
                    showAlert('Sous-catégorie modifiée avec succès', 'success');
                    modal.remove();
                    await loadData();
                    renderSubCategoriesAccordion();
                } catch (error) {
                    showAlert('Erreur: ' + error.message, 'error');
                }
            });
        }

        async function deleteSubCategory(categoryId, subCategoryId) {
            if (!confirm('Supprimer cette sous-catégorie ?')) return;

            try {
                await apiCall(`/categories/${categoryId}/subcategories/${subCategoryId}`, {
                    method: 'DELETE'
                });
                showAlert('Sous-catégorie supprimée', 'success');
                await loadData();
                renderSubCategoriesAccordion();
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        // Event listeners
        document.getElementById('btn-import').addEventListener('click', importExcel);
        document.getElementById('btn-import-audit')?.addEventListener('click', runImportAudit);
        document.getElementById('btn-resume-import')?.addEventListener('click', resumeImportWorkflow);
        document.getElementById('btn-import-step-models')?.addEventListener('click', () => {
            switchImportWorkflowStep('models');
            renderImportWorkflow();
        });
        document.getElementById('btn-import-step-import-base-options')?.addEventListener('click', () => {
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
        });
        document.getElementById('btn-import-step-families-unmatched')?.addEventListener('click', () => {
            switchImportWorkflowStep('families-unmatched');
            renderImportWorkflow();
        });
        document.getElementById('btn-import-step-validate')?.addEventListener('click', () => {
            switchImportWorkflowStep('validate');
            renderImportWorkflow();
        });
        document.getElementById('btn-model-subtab-models')?.addEventListener('click', () => switchModelSubtab('models'));
        document.getElementById('btn-model-subtab-template')?.addEventListener('click', () => switchModelSubtab('template'));
        document.getElementById('btn-import-mode')?.addEventListener('click', () => setWorkspaceMode('import'));
        document.getElementById('btn-backoffice-mode')?.addEventListener('click', () => setWorkspaceMode('backoffice'));
        document.getElementById('btn-refresh').addEventListener('click', loadData);
        window.addEventListener('beforeunload', () => {
            persistUiStateKeepalive({
                families: getFamilleValidatedFamilies(),
                businessViews: getViewHeuristicRules()
            });
        });
        document.getElementById('filter-model')?.addEventListener('change', renderCategories);
        document.getElementById('filter-option-name')?.addEventListener('input', renderCategories);
        document.getElementById('filter-option-family')?.addEventListener('change', (e) => {
            if (!window.__optionsTabFilterState || typeof window.__optionsTabFilterState !== 'object') {
                window.__optionsTabFilterState = { onlyUnassigned: false, autoAssignedOnly: false, family: '', subFamily: '' };
            }
            const selected = String(e?.target?.value || '').trim();
            window.__optionsTabFilterState.family = selected;
            window.__optionsTabFilterState.subFamily = '';
            renderCategories();
        });
        document.getElementById('filter-option-subfamily')?.addEventListener('change', (e) => {
            if (!window.__optionsTabFilterState || typeof window.__optionsTabFilterState !== 'object') {
                window.__optionsTabFilterState = { onlyUnassigned: false, autoAssignedOnly: false, family: '', subFamily: '' };
            }
            window.__optionsTabFilterState.subFamily = String(e?.target?.value || '').trim();
            renderCategories();
        });
        document.getElementById('btn-add-view-heur')?.addEventListener('click', () => {
            const labelEl = document.getElementById('view-heur-label');
            const kwEl = document.getElementById('view-heur-keywords');
            const scopeEl = document.getElementById('view-heur-scope');
            const addBtn = document.getElementById('btn-add-view-heur');
            const viewLabel = String(labelEl?.value || '').trim();
            const keywords = String(kwEl?.value || '').trim();
            const scope = String(scopeEl?.value || 'all').trim() || 'all';
            const rawEditIdx = addBtn?.getAttribute('data-edit-index');
            const editIdx = rawEditIdx !== null && rawEditIdx !== '' ? Number(rawEditIdx) : NaN;
            if (!viewLabel) {
                showAlert('Nom de vue métier requis.', 'warning');
                return;
            }
            const rules = getViewHeuristicRules();
            if (Number.isInteger(editIdx) && editIdx >= 0 && editIdx < rules.length) {
                rules[editIdx] = { viewLabel, keywords, scope };
            } else {
                rules.push({ viewLabel, keywords, scope });
            }
            setViewHeuristicRules(rules);
            if (labelEl) labelEl.value = '';
            if (kwEl) kwEl.value = '';
            if (scopeEl) scopeEl.value = 'all';
            addBtn?.removeAttribute('data-edit-index');
            const cancelBtn = document.getElementById('btn-cancel-view-heur-edit');
            if (cancelBtn) cancelBtn.style.display = 'none';
            renderViewHeuristicRulesUi();
        });
        document.getElementById('btn-cancel-view-heur-edit')?.addEventListener('click', () => {
            const labelEl = document.getElementById('view-heur-label');
            const kwEl = document.getElementById('view-heur-keywords');
            const scopeEl = document.getElementById('view-heur-scope');
            const addBtn = document.getElementById('btn-add-view-heur');
            if (labelEl) labelEl.value = '';
            if (kwEl) kwEl.value = '';
            if (scopeEl) scopeEl.value = 'all';
            addBtn?.removeAttribute('data-edit-index');
            const cancelBtn = document.getElementById('btn-cancel-view-heur-edit');
            if (cancelBtn) cancelBtn.style.display = 'none';
            renderViewHeuristicRulesUi();
        });
        document.getElementById('btn-add-category')?.addEventListener('click', addCategory);
        document.getElementById('btn-improve-categorization')?.addEventListener('click', improveCategorization);
        document.getElementById('btn-clear-categories')?.addEventListener('click', clearAllCategories);
        document.getElementById('btn-detect-subcategories')?.addEventListener('click', autoAssignFamiliesToBusinessViews);
        document.getElementById('btn-add-subcategory')?.addEventListener('click', addSubCategory);
        document.getElementById('btn-save-extraction-prompt').addEventListener('click', saveExtractionPrompt);
        document.getElementById('btn-save-categorization-prompt').addEventListener('click', saveCategorizationPrompt);
        document.getElementById('btn-save-minoration-prompt').addEventListener('click', saveMinorationPrompt);
        document.getElementById('btn-save-famille-prompt')?.addEventListener('click', saveFamillePrompt);
        document.getElementById('btn-save-assignation-prompt')?.addEventListener('click', saveAssignationPrompt);
        document.getElementById('btn-reset-prompts').addEventListener('click', resetPrompts);
        document.getElementById('prompt-extraction-format')?.addEventListener('change', (event) => {
            const select = event.target;
            const previous = select.dataset.previousValue || '';
            const next = select.value;
            if (next === previous) return;

            const confirmed = confirm('Confirmer le changement du format attendu ?');
            if (!confirmed) {
                select.value = previous;
                return;
            }

            const formatTarget = document.getElementById('prompt-extraction-format-text');
            if (formatTarget && EXTRACTION_FORMAT_PRESETS[next]) {
                formatTarget.value = EXTRACTION_FORMAT_PRESETS[next];
            }
            select.dataset.previousValue = next;
        });

        // Tabs - avec chargement à la demande
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.getAttribute('data-tab');
                const panelId = 'tab-' + tabName;
                document.getElementById(panelId).classList.add('active');
                
                // Charger les données uniquement pour l'onglet actif
                if (currentData || tabName === 'import') {
                    renderActiveTab(tabName);
                }
                syncFamilleColumnsDock();

                trackAdminEvent('tab_view', { tab: tabName });
            });
        });

        const initialTab = document.querySelector('.tab.active')?.getAttribute('data-tab');
        trackAdminEvent('page_view', { tab: initialTab });
        if (initialTab) {
            trackAdminEvent('tab_view', { tab: initialTab });
        }

        // ========================================
        // MODAL MODÈLE
        // ========================================
        function openModelModal(modelId) {
            const model = currentData.models.find(m => m.id === modelId);
            if (!model) return;

            const modelOptionsSplit = splitModelOptionsByType(getModelOptionsForSummary(modelId));
            const optionsForModel = modelOptionsSplit.regularOptions;

            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'model-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Modifier le modèle: ${model.name}</h2>
                        <button class="btn btn-danger" onclick="closeModelModal()">Fermer</button>
                    </div>
                    <form id="model-form">
                        <input type="hidden" id="model-id" value="${model.id}">
                        <div class="subtabs" style="margin-bottom: 16px;">
                            <button type="button" class="subtab-btn active" data-model-modal-tab="principal" onclick="switchModelModalTab('principal')">Principal</button>
                            <button type="button" class="subtab-btn" data-model-modal-tab="base" onclick="switchModelModalTab('base')">Options de base</button>
                            <button type="button" class="subtab-btn" data-model-modal-tab="options" onclick="switchModelModalTab('options')">Options</button>
                        </div>

                        <div id="model-modal-tab-principal" class="subtab-panel active">
                            <div class="form-group">
                                <label>Nom du modèle</label>
                                <input type="text" id="model-name" value="${model.name}" required>
                            </div>
                            <div class="form-group">
                                <label>Prix de base (€)</label>
                                <input type="number" id="model-price" value="${model.basePrice || 0}" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label>Image</label>
                                <div class="image-upload-area" id="model-image-upload" onclick="document.getElementById('model-image-input').click()">
                                    ${model.image ? `<img src="${model.image}" class="image-preview" id="model-image-preview">` : '<p>Cliquez pour télécharger une image</p>'}
                                </div>
                                <input type="file" id="model-image-input" accept="image/*" style="display: none;" onchange="handleModelImageUpload(event)">
                            </div>
                            <div class="form-group">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <label style="margin: 0;">Configurations</label>
                                    <button type="button" class="btn btn-success" onclick="addModelConfiguration()">+ Ajouter</button>
                                </div>
                                <div id="model-configurations-list"></div>
                                <input type="file" id="config-pdf-input" accept="application/pdf" style="display: none;">
                                <div id="config-pdf-controls" style="margin-top:10px; display:flex; gap:8px; align-items:center;">
                                    <button type="button" class="btn btn-outline" onclick="triggerConfigPdfUploadNew()">1. Importer le PDF</button>
                                    <span id="config-pdf-status" style="color:#666; margin-left:10px;">Aucun fichier importé</span>
                                </div>
                            </div>
                        </div>

                        <div id="model-modal-tab-base" class="subtab-panel">
                            <div class="form-group">
                                <label>Motorisation de base</label>
                                <input type="text" id="model-base-motorization" value="${escapeHtml(model.motorizationBase || '')}">
                            </div>
                            <div class="form-group">
                                <label>Numéro de poste</label>
                                <input type="number" id="model-poste-number" value="${model.posteNumber ?? ''}" min="1" step="1">
                            </div>
                            <div class="form-group">
                                <label>Mode de livraison</label>
                                <input type="text" id="model-delivery-mode" value="${escapeHtml(model.defaultDeliveryMode || '')}" placeholder="Ex: Départ usine">
                            </div>
                        </div>

                        <div id="model-modal-tab-options" class="subtab-panel">
                            <div style="margin-bottom: 10px; color: #666;">
                                ${optionsForModel.length} option(s) standard disponible(s) pour ce modèle (hors PR / minoration).
                            </div>
                            <table style="width:100%; border-collapse:collapse; border:1px solid #eee;">
                                <thead>
                                    <tr style="background:#f8f9fa;">
                                        <th style="padding:8px; border-bottom:1px solid #eee;">Option</th>
                                        <th style="padding:8px; border-bottom:1px solid #eee;">Vue métier</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${renderOptionRows(optionsForModel, 'Aucune option standard pour ce modèle')}
                                </tbody>
                            </table>
                        </div>

                        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                            <button type="button" class="btn btn-outline" onclick="closeModelModal()">Annuler</button>
                            <button type="submit" class="btn btn-primary">Enregistrer</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
            renderModelConfigurations(model.configurations || []);
            const pdfInput = document.getElementById('config-pdf-input');
            if (pdfInput) {
                pdfInput.addEventListener('change', handleUploadPdfChange);
            }
            
            document.getElementById('model-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveModel();
            });

            modal.addEventListener('click', (e) => {
                if (e.target.id === 'model-modal') closeModelModal();
            });
        }

        function switchModelModalTab(tabId) {
            const modal = document.getElementById('model-modal');
            if (!modal) return;
            modal.querySelectorAll('[data-model-modal-tab]').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-model-modal-tab') === tabId);
            });
            modal.querySelectorAll('#model-modal .subtab-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === `model-modal-tab-${tabId}`);
            });
        }

        function closeModelModal() {
            const modal = document.getElementById('model-modal');
            if (modal) modal.remove();
        }

        function renderModelConfigurations(configurations) {
            const container = document.getElementById('model-configurations-list');
            if (!container) return;
            container.innerHTML = '';

            if (configurations.length === 0) {
                container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Aucune configuration</p>';
                return;
            }

            // Récupérer le modelId depuis le champ caché du formulaire
            const modelId = document.getElementById('model-id')?.value || '';

            configurations.forEach((config, index) => {
                const item = document.createElement('div');
                item.className = 'config-item';
                item.dataset.configId = config.id;
                
                const pdfAnalysis = config.pdfAnalysis || null;
                const hasFile = pdfAnalysis && (pdfAnalysis.pdfFilePath || pdfAnalysis.excelFilePath);
                const hasMapping = pdfAnalysis && pdfAnalysis.mapped;
                
                // Déterminer l'état des étapes
                const step1Completed = hasFile;
                const step2Completed = hasMapping;
                
                item.innerHTML = `
                    <div style="flex: 1;">
                        <strong>${config.name}</strong>
                        ${config.description ? `<p style="color: #666; margin: 5px 0; font-size: 14px;">${config.description}</p>` : ''}
                        ${config.image ? `<img src="${config.image}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px; margin-top: 5px;">` : ''}
                        
                        <div class="steps-container" style="margin-top: 15px;">
                            <div class="step ${step1Completed ? 'completed' : ''}" onclick="triggerConfigFileImport('${config.id}')" title="${step1Completed ? 'Relancer l\'import' : 'Importer un fichier PDF ou Excel'}">
                                <div class="step-number">${step1Completed ? '✓' : '1'}</div>
                                <div class="step-label">Importer<br>PDF/Excel</div>
                            </div>
                            <div class="step ${step2Completed ? 'completed' : step1Completed ? 'active' : 'disabled'}" onclick="${step1Completed ? `mapConfigToJson('${config.id}')` : ''}" title="${step1Completed ? (step2Completed ? 'Relancer le mapping' : 'Mapper les données') : 'Importez d\'abord un fichier'}" style="${!step1Completed ? 'cursor: not-allowed;' : ''}">
                                <div class="step-number">${step2Completed ? '✓' : '2'}</div>
                                <div class="step-label">Mapper<br>les données</div>
                            </div>
                            <div class="step disabled" title="À venir">
                                <div class="step-number">3</div>
                                <div class="step-label">Comparer<br>avec IA</div>
                            </div>
                        </div>
                        
                        ${pdfAnalysis ? `
                            <p style="color: #666; margin: 10px 0 0; font-size: 12px;">
                                ${pdfAnalysis.fileName ? `Fichier: ${escapeHtml(pdfAnalysis.fileName)}` : ''}
                                ${pdfAnalysis.excelFileName ? ` • Excel: ${escapeHtml(pdfAnalysis.excelFileName)}` : ''}
                                ${pdfAnalysis.mapped ? ` • Mapping: ${pdfAnalysis.mapped?.stats?.totalCategories || 0} catégorie(s), ${pdfAnalysis.mapped?.stats?.totalItems || 0} élément(s)` : ''}
                            </p>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-start;">
                        <button type="button" class="btn btn-outline" onclick="editModelConfiguration(${index})">Modifier</button>
                        ${pdfAnalysis ? `<button type="button" class="btn btn-outline" onclick="showConfigPdfResults('${config.id}')">Voir résultats</button>` : ''}
                        <button type="button" class="btn btn-danger" onclick="deleteModelConfiguration(${index})">Supprimer</button>
                    </div>
                `;
                container.appendChild(item);
            });
        }

        async function addModelConfiguration() {
            const modelId = document.getElementById('model-id').value;
            const model = currentData.models.find(m => m.id === modelId);
            if (!model) return;

            const name = prompt('Nom de la configuration:', 'Nouvelle configuration');
            if (name === null) return;

            try {
                await apiCall(`/models/${modelId}/configurations`, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: name.trim() || 'Nouvelle configuration',
                        description: '',
                        image: null
                    })
                });
                await loadData(true);
                const refreshedModel = currentData.models.find(m => m.id === modelId);
                renderModelConfigurations(refreshedModel?.configurations || []);
                showAlert('Configuration ajoutée', 'success');
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        async function editModelConfiguration(index) {
            const modelId = document.getElementById('model-id').value;
            const model = currentData.models.find(m => m.id === modelId);
            if (!model || !model.configurations) return;

            const config = model.configurations[index];
            const name = prompt('Nom de la configuration:', config.name);
            if (name === null) return;
            
            const description = prompt('Description:', config.description || '');
            if (description === null) return;

            try {
                await apiCall(`/models/${modelId}/configurations/${config.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: name.trim(),
                        description: description.trim()
                    })
                });
                await loadData(true);
                const refreshedModel = currentData.models.find(m => m.id === modelId);
                renderModelConfigurations(refreshedModel?.configurations || []);
                showAlert('Configuration modifiée', 'success');
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        async function deleteModelConfiguration(index) {
            if (!confirm('Supprimer cette configuration ?')) return;
            const modelId = document.getElementById('model-id').value;
            const model = currentData.models.find(m => m.id === modelId);
            if (!model || !model.configurations) return;

            const config = model.configurations[index];
            try {
                await apiCall(`/models/${modelId}/configurations/${config.id}`, {
                    method: 'DELETE'
                });
                await loadData(true);
                const refreshedModel = currentData.models.find(m => m.id === modelId);
                renderModelConfigurations(refreshedModel?.configurations || []);
                showAlert('Configuration supprimée', 'success');
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        function triggerConfigPdfUpload(configId) {
            const input = document.getElementById('config-pdf-input');
            const modelId = document.getElementById('model-id')?.value;
            if (!input || !modelId) return;
            input.dataset.modelId = modelId;
            input.dataset.configId = configId;
            input.value = '';
            input.click();
        }

        // Nouvelle fonction pour importer PDF ou Excel
        function triggerConfigFileImport(configId) {
            const modelId = document.getElementById('model-id')?.value;
            if (!modelId) {
                showAlert('Modèle introuvable', 'error');
                return;
            }

            // Créer un input file qui accepte PDF et Excel
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
            input.style.display = 'none';
            input.onchange = async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                               file.type === 'application/vnd.ms-excel' ||
                               file.name.toLowerCase().endsWith('.xlsx') ||
                               file.name.toLowerCase().endsWith('.xls');

                if (!isPdf && !isExcel) {
                    showAlert('Veuillez sélectionner un fichier PDF ou Excel.', 'error');
                    return;
                }

                try {
                    showAlert(`Import de ${isPdf ? 'PDF' : 'Excel'} en cours...`, 'info');
                    
                    const formData = new FormData();
                    formData.append('file', file);

                    const response = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/import-file`, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                    });

                    const contentType = response.headers.get('content-type') || '';
                    if (!contentType.includes('application/json')) {
                        const text = await response.text();
                        console.error('Réponse non-JSON reçue:', text.substring(0, 200));
                        throw new Error(`L'API a retourné du HTML au lieu de JSON. Status: ${response.status}.`);
                    }

                    const result = await response.json();
                    if (!response.ok || !result.success) {
                        throw new Error(result.message || `Erreur HTTP ${response.status}`);
                    }

                    // Recharger les données
                    await loadData(true);
                    const refreshedModel = currentData.models.find(m => m.id === modelId);
                    renderModelConfigurations(refreshedModel?.configurations || []);
                    
                    showAlert(
                        isPdf 
                            ? `PDF importé et converti en Excel avec succès !` 
                            : `Fichier Excel importé avec succès !`,
                        'success'
                    );
                } catch (error) {
                    console.error('Erreur import fichier:', error);
                    showAlert('Erreur lors de l\'import: ' + error.message, 'error');
                } finally {
                    document.body.removeChild(input);
                }
            };
            
            document.body.appendChild(input);
            input.click();
        }

        async function handleConfigPdfUpload(event) {
            const input = event.target;
            const file = input.files?.[0];
            if (!file) return;

            if (file.type && file.type !== 'application/pdf') {
                showAlert('Veuillez sélectionner un fichier PDF.', 'error');
                return;
            }

            const { modelId, configId } = input.dataset || {};
            if (!modelId || !configId) {
                showAlert('Configuration introuvable pour l\'import PDF.', 'error');
                return;
            }

            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/import-pdf`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Réponse non-JSON reçue:', text.substring(0, 200));
                    throw new Error(`L'API a retourné du HTML au lieu de JSON. Status: ${response.status}.`);
                }

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.message || `Erreur HTTP ${response.status}`);
                }

                const refreshedModel = currentData.models.find(m => m.id === modelId);
                const refreshedConfig = refreshedModel?.configurations?.find(c => c.id === configId);
                if (refreshedConfig) {
                    refreshedConfig.pdfAnalysis = {
                        ...(refreshedConfig.pdfAnalysis || {}),
                        ...result.data.analysis
                    };
                }

                renderModelConfigurations(refreshedModel?.configurations || []);
                showAlert('Import PDF réussi', 'success');
                showConfigPdfResults(configId);
            } catch (error) {
                console.error('Erreur import PDF:', error);
                showAlert('Erreur lors de l\'import PDF: ' + error.message, 'error');
            }
        }

        // New: handle upload for stepwise flow (calls upload endpoint instead of import)
        async function handleUploadPdfChange(event) {
            const input = event.target;
            const file = input.files?.[0];
            if (!file) return;
            if (file.type && file.type !== 'application/pdf') {
                showAlert('Veuillez sélectionner un fichier PDF.', 'error');
                return;
            }
            const { modelId, configId } = input.dataset || {};
            if (!modelId || !configId) {
                showAlert('Configuration introuvable pour l\'import PDF.', 'error');
                return;
            }
            try {
                const fd = new FormData();
                fd.append('file', file);
                const statusEl = document.getElementById('config-pdf-status');
                if (statusEl) statusEl.textContent = 'Upload en cours...';
                const res = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/upload-pdf`, {
                    method: 'POST',
                    credentials: 'include',
                    body: fd
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || 'Erreur upload');
                // Update local currentData
                const model = currentData.models.find(m => m.id === modelId);
                const config = model?.configurations?.find(c => c.id === configId);
                if (config) {
                    config.pdfAnalysis = data.data.analysis;
                }
                renderModelConfigurations(model?.configurations || []);
                if (statusEl) statusEl.textContent = `Fichier importé: ${file.name}`;
                showAlert('PDF uploadé avec succès', 'success');
            } catch (err) {
                console.error('Upload error', err);
                showAlert('Erreur lors de l\'upload: ' + err.message, 'error');
                const statusEl = document.getElementById('config-pdf-status');
                if (statusEl) statusEl.textContent = 'Erreur upload';
            }
        }

        // New trigger for stepwise upload (selects first config in modal if none)
        function triggerConfigPdfUploadNew() {
            const modelId = document.getElementById('model-id')?.value;
            const item = document.querySelector('#model-configurations-list .config-item');
            const configId = item?.dataset?.configId;
            const input = document.getElementById('config-pdf-input');
            if (!input || !modelId) return;
            if (configId) {
                input.dataset.modelId = modelId;
                input.dataset.configId = configId;
            } else {
                showAlert('Aucune configuration sélectionnée', 'error');
                return;
            }
            input.value = '';
            input.click();
        }

        // Extract text step
        async function extractTextForConfigCurrent() {
            const modelId = document.getElementById('model-id')?.value;
            const configId = document.querySelector('#model-configurations-list .config-item')?.dataset?.configId;
            if (!modelId || !configId) {
                showAlert('Sélectionnez d\'abord une configuration.', 'error');
                return;
            }
            try {
                const statusEl = document.getElementById('config-pdf-status');
                if (statusEl) statusEl.textContent = 'Extraction du texte...';
                const res = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/extract-text`, {
                    method: 'POST',
                    credentials: 'include'
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || 'Erreur extraction');

                // Update local model config
                const model = currentData.models.find(m => m.id === modelId);
                const config = model?.configurations?.find(c => c.id === configId);
                if (config) {
                    config.pdfAnalysis = { ...(config.pdfAnalysis || {}), ...data.data.analysis };
                }
                renderModelConfigurations(model?.configurations || []);

                // Show extracted lines in a modal (raw JSON + pretty)
                const extracted = data.data.analysis?.extractedLines || [];
                showExtractedTextModal(extracted, config?.name || 'Configuration');

                if (statusEl) statusEl.textContent = 'Texte extrait';
                showAlert('Extraction terminée', 'success');
            } catch (err) {
                console.error('Extraction error', err);
                showAlert('Erreur lors de l\'extraction: ' + err.message, 'error');
                const statusEl = document.getElementById('config-pdf-status');
                if (statusEl) statusEl.textContent = 'Erreur extraction';
            }
        }

        // Affiche un modal avec le texte extrait (JSON + preview)
        function showExtractedTextModal(extractedLines, configName) {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'extracted-text-modal';
            const prettyJson = JSON.stringify({ extractedLines }, null, 2);
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 900px; max-height: 80vh; overflow: auto;">
                    <div class="modal-header">
                        <h2>Texte extrait - ${escapeHtml(configName)}</h2>
                        <button class="btn btn-danger" onclick="closeExtractedTextModal()">Fermer</button>
                    </div>
                    <div style="padding: 12px;">
                        <div style="margin-bottom: 8px; display:flex; gap:8px; align-items:center;">
                            <button class="btn btn-outline" id="copy-extracted-json">Copier JSON</button>
                            <button class="btn btn-outline" id="download-extracted-json">Télécharger JSON</button>
                        </div>
                        <pre id="extracted-text-pre" style="white-space: pre-wrap; background: #f8f9fa; padding: 12px; border-radius:6px; border:1px solid #eee; max-height:60vh; overflow:auto;">${escapeHtml(prettyJson)}</pre>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('copy-extracted-json').addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(prettyJson);
                    showAlert('JSON copié dans le presse-papiers', 'success');
                } catch (e) {
                    showAlert('Impossible de copier', 'error');
                }
            });

            document.getElementById('download-extracted-json').addEventListener('click', () => {
                const blob = new Blob([prettyJson], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${configName.replace(/[^a-z0-9_-]/ig, '_')}_extracted.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });
        }

        function closeExtractedTextModal() {
            const m = document.getElementById('extracted-text-modal');
            if (m) m.remove();
        }

        // Ouvrir la page de test d'extraction
        function openTestExtractionPage(modelId, configId) {
            const url = `${API_BASE}/test-extraction-page?modelId=${modelId}&configId=${configId}`;
            window.open(url, '_blank');
        }

        // Fonctions obsolètes supprimées (extraction texte, vision OCR, conversion Excel)
        // Le nouveau workflow utilise directement Camelot pour l'extraction et le mapping

        // Map Excel -> JSON/YAML (mapping simple, sans IA)
        async function mapConfigToJson(configId) {
            const modelId = document.getElementById('model-id')?.value;
            if (!modelId || !configId) {
                showAlert('Sélectionnez d\'abord une configuration.', 'error');
                return;
            }
            try {
                const statusEl = document.getElementById('config-pdf-status');
                
                // Afficher le message de progression
                if (statusEl) statusEl.textContent = '🔄 Mapping en cours...';
                showAlert('🔄 Mapping en cours...', 'info');
                
                console.log('🚀 Démarrage du mapping...');
                const startTime = Date.now();
                
                // Lancer le mapping
                const res = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/map-excel`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                
                const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`⏱️ Temps écoulé: ${elapsedTime}s`);
                
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || 'Erreur mapping');
                
                // Récupérer le mapping depuis la nouvelle structure
                const mapped = data.data.mapped || null;
                const yaml = data.data.yaml || null;
                const excelPath = data.data.excelPath || null;
                const excelFileName = data.data.excelFileName || null;
                
                console.log('📊 Données reçues du mapping:', {
                    hasMapped: !!mapped,
                    categoriesCount: mapped?.categories?.length || 0,
                    excelPath: excelPath
                });
                
                if (statusEl) statusEl.textContent = '✅ Mapping terminé';
                const stats = mapped?.stats || {};
                showAlert(`✅ Mapping terminé: ${stats.totalCategories || 0} catégorie(s), ${stats.totalItems || 0} élément(s)`, 'success');
                
                // Recharger les données pour avoir la configuration à jour depuis le serveur
                await loadData();
                
                // Récupérer la configuration mise à jour après rechargement
                const refreshedModel = currentData.models.find(m => m.id === modelId);
                const refreshedConfig = refreshedModel?.configurations?.find(c => c.id === configId);
                
                // Afficher directement le modal de résultats (même si pas de mapping)
                const pdfUrl = refreshedConfig?.pdfAnalysis?.pdfUrl || null;
                showMappingResultsModal(pdfUrl, modelId, configId, mapped || { categories: [] }, yaml, null);
            } catch (err) {
                console.error('Mapping error', err);
                showAlert('Erreur lors du mapping: ' + err.message, 'error');
                const statusEl = document.getElementById('config-pdf-status');
                if (statusEl) statusEl.textContent = '❌ Erreur mapping';
            }
        }

        function showMappedJsonModal(mappedObj, yamlStr, configName) {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'mapped-json-modal';
            const prettyJson = JSON.stringify(mappedObj || {}, null, 2);
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 900px; max-height: 80vh; overflow: auto;">
                    <div class="modal-header">
                        <h2>Mapping XLSX - ${escapeHtml(configName)}</h2>
                        <button class="btn btn-danger" onclick="closeMappedJsonModal()">Fermer</button>
                    </div>
                    <div style="padding: 12px;">
                        <div style="margin-bottom: 8px; display:flex; gap:8px; align-items:center;">
                            <button class="btn btn-outline" id="copy-mapped-json">Copier JSON</button>
                            <button class="btn btn-outline" id="download-mapped-json">Télécharger JSON</button>
                            <button class="btn btn-outline" id="copy-mapped-yaml">Copier YAML</button>
                            <button class="btn btn-outline" id="download-mapped-yaml">Télécharger YAML</button>
                        </div>
                        <pre id="mapped-json-pre" style="white-space: pre-wrap; background: #f8f9fa; padding: 12px; border-radius:6px; border:1px solid #eee; max-height:60vh; overflow:auto;">${escapeHtml(prettyJson)}</pre>
                        ${yamlStr ? `<h3 style="margin-top:10px;">YAML</h3><pre id="mapped-yaml-pre" style="white-space: pre-wrap; background: #fff7e6; padding: 12px; border-radius:6px; border:1px solid #f0e6b6; max-height:200px; overflow:auto;">${escapeHtml(yamlStr)}</pre>` : ''}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('copy-mapped-json').addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(prettyJson);
                    showAlert('JSON copié dans le presse-papiers', 'success');
                } catch (e) { showAlert('Impossible de copier', 'error'); }
            });
            document.getElementById('download-mapped-json').addEventListener('click', () => {
                const blob = new Blob([prettyJson], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${configName.replace(/[^a-z0-9_-]/ig, '_')}_mapped.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            });
            const copyYamlBtn = document.getElementById('copy-mapped-yaml');
            const dlYamlBtn = document.getElementById('download-mapped-yaml');
            if (copyYamlBtn && dlYamlBtn) {
                copyYamlBtn.addEventListener('click', async () => {
                    try { await navigator.clipboard.writeText(yamlStr || ''); showAlert('YAML copié', 'success'); } catch (e) { showAlert('Impossible de copier YAML', 'error'); }
                });
                dlYamlBtn.addEventListener('click', () => {
                    const blob = new Blob([yamlStr || ''], { type: 'text/yaml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `${configName.replace(/[^a-z0-9_-]/ig, '_')}_mapped.yaml`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                });
            }
        }

        function closeMappedJsonModal() {
            const m = document.getElementById('mapped-json-modal'); if (m) m.remove();
        }

        // Détecter les couleurs et afficher le modal de sélection avec PDF
        async function launchMappingWithDefaults(modelId, configId) {
            try {
                // Récupérer les infos de la configuration pour avoir l'URL du PDF
                const model = currentData.models.find(m => m.id === modelId);
                const config = model?.configurations?.find(c => c.id === configId);
                const pdfUrl = config?.pdfAnalysis?.pdfUrl || null;
                
                // D'abord, détecter toutes les couleurs dans le fichier Excel
                const detectRes = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/detect-colors`, {
                    method: 'GET',
                    credentials: 'include'
                });
                const detectData = await detectRes.json();
                
                if (!detectRes.ok || !detectData.success) {
                    console.warn('Color detection failed:', detectData);
                    // Continuer quand même avec les couleurs par défaut
                }
                
                const detectedColors = detectData.data?.colors || [];
                
                // Afficher le modal de sélection de couleurs avec le PDF
                showColorSelectionModalWithPdf(modelId, configId, detectedColors, pdfUrl);
            } catch (err) {
                console.error('Color detection error', err);
                // Afficher quand même le modal avec les couleurs par défaut
                const model = currentData.models.find(m => m.id === modelId);
                const config = model?.configurations?.find(c => c.id === configId);
                const pdfUrl = config?.pdfAnalysis?.pdfUrl || null;
                showColorSelectionModalWithPdf(modelId, configId, [], pdfUrl);
            }
        }

        // Afficher le modal de sélection de couleurs avec PDF à côté
        function showColorSelectionModalWithPdf(modelId, configId, detectedColors, pdfUrl) {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'color-selection-modal';
            
            // Couleurs par défaut si aucune couleur détectée
            const defaultColors = {
                category: '0F4C81',
                characteristic: 'B7D1F5',
                value: 'FFD966'
            };
            
            // Si aucune couleur détectée, utiliser les couleurs par défaut comme options
            let colorOptions = '';
            if (detectedColors.length > 0) {
                colorOptions = detectedColors.map(c => 
                    `<option value="${c.color}" data-count="${c.count}">#${c.color} (${c.count} occurrences)</option>`
                ).join('');
            } else {
                // Ajouter les couleurs par défaut comme options si aucune couleur n'a été détectée
                colorOptions = `
                    <option value="${defaultColors.category}">#${defaultColors.category} (Par défaut - Catégorie)</option>
                    <option value="${defaultColors.characteristic}">#${defaultColors.characteristic} (Par défaut - Caractéristique)</option>
                    <option value="${defaultColors.value}">#${defaultColors.value} (Par défaut - Valeur)</option>
                `;
            }
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: none; width: 95vw; height: 90vh;">
                    <div class="modal-header" style="position: sticky; top: 0; background: white; z-index: 2;">
                        <h2>Sélection des couleurs pour le mapping</h2>
                        <button class="btn btn-danger" onclick="closeColorSelectionModal()">Fermer</button>
                    </div>
                    <div style="padding: 20px; height: calc(90vh - 70px); overflow: hidden;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch; height: calc(90vh - 140px);">
                            <div style="border: 1px solid #eee; border-radius: 6px; padding: 10px; background: #fafafa; height: 100%; overflow: hidden;">
                                <div style="font-weight: 600; margin-bottom: 8px;">Aperçu PDF - Repérez les couleurs</div>
                                ${pdfUrl ? `
                                    <iframe src="${pdfUrl}" style="width: 100%; height: calc(100% - 30px); border: none;"></iframe>
                                ` : `
                                    <div style="color: #666; font-size: 13px; padding: 10px;">
                                        Aperçu PDF indisponible. Consultez le PDF pour identifier les couleurs de fond des cellules.
                                    </div>
                                `}
                            </div>
                            <div style="height: 100%; overflow: auto; border: 1px solid #eee; border-radius: 6px; padding: 20px; background: #fff;">
                                <p style="margin-bottom: 20px; color: #666; font-size: 14px;">
                                    ${detectedColors.length > 0 
                                        ? 'Sélectionnez les couleurs de fond correspondant à chaque type d\'élément dans le fichier Excel.' 
                                        : '<strong style="color: #d32f2f;">⚠️ Aucune couleur détectée dans le fichier Excel.</strong><br>Vous pouvez saisir manuellement les codes couleur hexadécimaux (sans le #) ou utiliser les couleurs par défaut.'}
                                </p>
                                
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                                        Couleur pour <strong>Catégorie</strong>:
                                    </label>
                                    <select id="select-color-category" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                                        <option value="">-- Sélectionner une couleur --</option>
                                        ${colorOptions}
                                    </select>
                                    <input type="text" id="input-color-category" placeholder="Ou saisir manuellement (ex: 0F4C81)" style="width: 100%; margin-top: 8px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; display: none;">
                                    <div id="preview-category" style="margin-top: 8px; padding: 8px; border-radius: 4px; min-height: 40px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; border: 2px solid #ddd;">
                                        Aperçu
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                                        Couleur pour <strong>Caractéristique</strong>:
                                    </label>
                                    <select id="select-color-characteristic" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                                        <option value="">-- Sélectionner une couleur --</option>
                                        ${colorOptions}
                                    </select>
                                    <input type="text" id="input-color-characteristic" placeholder="Ou saisir manuellement (ex: B7D1F5)" style="width: 100%; margin-top: 8px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; display: none;">
                                    <div id="preview-characteristic" style="margin-top: 8px; padding: 8px; border-radius: 4px; min-height: 40px; display: flex; align-items: center; justify-content: center; color: #333; font-weight: 600; border: 2px solid #ddd;">
                                        Aperçu
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                                        Couleur pour <strong>Valeur</strong>:
                                    </label>
                                    <select id="select-color-value" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                                        <option value="">-- Sélectionner une couleur --</option>
                                        ${colorOptions}
                                    </select>
                                    <input type="text" id="input-color-value" placeholder="Ou saisir manuellement (ex: FFD966)" style="width: 100%; margin-top: 8px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; display: none;">
                                    <div id="preview-value" style="margin-top: 8px; padding: 8px; border-radius: 4px; min-height: 40px; display: flex; align-items: center; justify-content: center; color: #333; font-weight: 600; border: 2px solid #ddd;">
                                        Aperçu
                                    </div>
                                </div>
                                
                                ${detectedColors.length === 0 ? `
                                    <div style="margin-bottom: 20px; padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 13px;">
                                        <strong>💡 Astuce:</strong> Si les couleurs ne sont pas détectées automatiquement, vous pouvez :
                                        <ul style="margin: 8px 0 0 20px;">
                                            <li>Ouvrir le fichier Excel et noter les codes couleur hexadécimaux des cellules</li>
                                            <li>Utiliser un outil de sélection de couleur pour obtenir le code hex</li>
                                            <li>Utiliser les couleurs par défaut ci-dessus</li>
                                        </ul>
                                    </div>
                                ` : ''}
                                
                                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 30px;">
                                    <button class="btn btn-outline" onclick="closeColorSelectionModal()">Annuler</button>
                                    <button class="btn btn-primary" id="btn-launch-mapping">Lancer le mapping</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Pré-sélectionner les couleurs par défaut si elles existent dans la liste
            const categorySelect = document.getElementById('select-color-category');
            const characteristicSelect = document.getElementById('select-color-characteristic');
            const valueSelect = document.getElementById('select-color-value');
            const categoryInput = document.getElementById('input-color-category');
            const characteristicInput = document.getElementById('input-color-characteristic');
            const valueInput = document.getElementById('input-color-value');
            
            // Afficher les champs de saisie manuelle si aucune couleur détectée
            if (detectedColors.length === 0) {
                categoryInput.style.display = 'block';
                characteristicInput.style.display = 'block';
                valueInput.style.display = 'block';
            }
            
            // Fonction pour mettre à jour l'aperçu
            const updatePreview = (selectId, inputId, previewId, defaultColor) => {
                const select = document.getElementById(selectId);
                const input = document.getElementById(inputId);
                const preview = document.getElementById(previewId);
                
                let selectedColor = select.value || input.value.trim() || defaultColor;
                
                // Nettoyer le code couleur (enlever #, espaces, etc.)
                selectedColor = selectedColor.replace(/^#/i, '').replace(/\s/g, '').toUpperCase();
                
                if (selectedColor && /^[0-9A-F]{6}$/.test(selectedColor)) {
                    preview.style.backgroundColor = '#' + selectedColor;
                    // Ajuster la couleur du texte selon la luminosité
                    const rgb = hexToRgb('#' + selectedColor);
                    if (rgb) {
                        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                        preview.style.color = brightness > 128 ? '#333' : '#fff';
                        preview.textContent = 'Aperçu - #' + selectedColor;
                    }
                } else {
                    preview.style.backgroundColor = '#f0f0f0';
                    preview.style.color = '#666';
                    preview.textContent = 'Aperçu';
                }
            };
            
            // Fonction helper pour convertir hex en RGB
            function hexToRgb(hex) {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            }
            
            // Pré-sélectionner les couleurs par défaut
            if (detectedColors.find(c => c.color === defaultColors.category)) {
                categorySelect.value = defaultColors.category;
            } else if (detectedColors.length === 0) {
                categoryInput.value = defaultColors.category;
            }
            if (detectedColors.find(c => c.color === defaultColors.characteristic)) {
                characteristicSelect.value = defaultColors.characteristic;
            } else if (detectedColors.length === 0) {
                characteristicInput.value = defaultColors.characteristic;
            }
            if (detectedColors.find(c => c.color === defaultColors.value)) {
                valueSelect.value = defaultColors.value;
            } else if (detectedColors.length === 0) {
                valueInput.value = defaultColors.value;
            }
            
            // Mettre à jour les aperçus
            updatePreview('select-color-category', 'input-color-category', 'preview-category', defaultColors.category);
            updatePreview('select-color-characteristic', 'input-color-characteristic', 'preview-characteristic', defaultColors.characteristic);
            updatePreview('select-color-value', 'input-color-value', 'preview-value', defaultColors.value);
            
            // Écouter les changements de sélection et de saisie
            categorySelect.addEventListener('change', () => {
                if (categorySelect.value) categoryInput.value = '';
                updatePreview('select-color-category', 'input-color-category', 'preview-category', defaultColors.category);
            });
            categoryInput.addEventListener('input', () => {
                if (categoryInput.value) categorySelect.value = '';
                updatePreview('select-color-category', 'input-color-category', 'preview-category', defaultColors.category);
            });
            
            characteristicSelect.addEventListener('change', () => {
                if (characteristicSelect.value) characteristicInput.value = '';
                updatePreview('select-color-characteristic', 'input-color-characteristic', 'preview-characteristic', defaultColors.characteristic);
            });
            characteristicInput.addEventListener('input', () => {
                if (characteristicInput.value) characteristicSelect.value = '';
                updatePreview('select-color-characteristic', 'input-color-characteristic', 'preview-characteristic', defaultColors.characteristic);
            });
            
            valueSelect.addEventListener('change', () => {
                if (valueSelect.value) valueInput.value = '';
                updatePreview('select-color-value', 'input-color-value', 'preview-value', defaultColors.value);
            });
            valueInput.addEventListener('input', () => {
                if (valueInput.value) valueSelect.value = '';
                updatePreview('select-color-value', 'input-color-value', 'preview-value', defaultColors.value);
            });
            
            // Lancer le mapping avec les couleurs sélectionnées
            document.getElementById('btn-launch-mapping').addEventListener('click', async () => {
                const selectedColors = {
                    category: categorySelect.value || categoryInput.value.trim().replace(/^#/i, '') || defaultColors.category,
                    characteristic: characteristicSelect.value || characteristicInput.value.trim().replace(/^#/i, '') || defaultColors.characteristic,
                    value: valueSelect.value || valueInput.value.trim().replace(/^#/i, '') || defaultColors.value
                };
                
                // Nettoyer les codes couleur
                selectedColors.category = selectedColors.category.replace(/^#/i, '').replace(/\s/g, '').toUpperCase();
                selectedColors.characteristic = selectedColors.characteristic.replace(/^#/i, '').replace(/\s/g, '').toUpperCase();
                selectedColors.value = selectedColors.value.replace(/^#/i, '').replace(/\s/g, '').toUpperCase();
                
                // Vérifier que les codes couleur sont valides
                const isValidHex = (color) => /^[0-9A-F]{6}$/.test(color);
                if (!isValidHex(selectedColors.category) || !isValidHex(selectedColors.characteristic) || !isValidHex(selectedColors.value)) {
                    showAlert('Veuillez saisir des codes couleur hexadécimaux valides (6 caractères, ex: 0F4C81)', 'error');
                    return;
                }
                
                // Fermer le modal de sélection
                closeColorSelectionModal();
                
                // Lancer le mapping
                try {
                    const res = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/map-excel`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ colors: selectedColors })
                    });
                    const data = await res.json();
                    if (!res.ok || !data.success) throw new Error(data.message || 'Erreur mapping');
                    
                    // Afficher le modal avec PDF à gauche et résultats à droite
                    const model = currentData.models.find(m => m.id === modelId);
                    const config = model?.configurations?.find(c => c.id === configId);
                    const finalPdfUrl = config?.pdfAnalysis?.pdfUrl || pdfUrl || null;
                    showMappingResultsModal(finalPdfUrl, modelId, configId, data.data.analysis?.mapped || {}, data.data.yaml || '', selectedColors);
                } catch (err) {
                    console.error('Mapping error', err);
                    showAlert('Erreur lors du mapping: ' + err.message, 'error');
                }
            });
        }

        // Afficher le modal de sélection de couleurs (ancienne version, gardée pour compatibilité)
        function showColorSelectionModal(modelId, configId, detectedColors) {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'color-selection-modal';
            
            // Couleurs par défaut si aucune couleur détectée
            const defaultColors = {
                category: '0F4C81',
                characteristic: 'B7D1F5',
                value: 'FFD966'
            };
            
            // Créer les options pour les sélecteurs
            const colorOptions = detectedColors.map(c => 
                `<option value="${c.color}" data-count="${c.count}">#${c.color} (${c.count} occurrences)</option>`
            ).join('');
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>Sélection des couleurs pour le mapping</h2>
                        <button class="btn btn-danger" onclick="closeColorSelectionModal()">Fermer</button>
                    </div>
                    <div style="padding: 20px;">
                        <p style="margin-bottom: 20px; color: #666; font-size: 14px;">
                            Sélectionnez les couleurs de fond correspondant à chaque type d'élément dans le fichier Excel.
                        </p>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                                Couleur pour <strong>Catégorie</strong>:
                            </label>
                            <select id="select-color-category" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                                <option value="">-- Sélectionner une couleur --</option>
                                ${colorOptions}
                            </select>
                            <div id="preview-category" style="margin-top: 8px; padding: 8px; border-radius: 4px; min-height: 40px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                                Aperçu
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                                Couleur pour <strong>Caractéristique</strong>:
                            </label>
                            <select id="select-color-characteristic" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                                <option value="">-- Sélectionner une couleur --</option>
                                ${colorOptions}
                            </select>
                            <div id="preview-characteristic" style="margin-top: 8px; padding: 8px; border-radius: 4px; min-height: 40px; display: flex; align-items: center; justify-content: center; color: #333; font-weight: 600;">
                                Aperçu
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                                Couleur pour <strong>Valeur</strong>:
                            </label>
                            <select id="select-color-value" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                                <option value="">-- Sélectionner une couleur --</option>
                                ${colorOptions}
                            </select>
                            <div id="preview-value" style="margin-top: 8px; padding: 8px; border-radius: 4px; min-height: 40px; display: flex; align-items: center; justify-content: center; color: #333; font-weight: 600;">
                                Aperçu
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 30px;">
                            <button class="btn btn-outline" onclick="closeColorSelectionModal()">Annuler</button>
                            <button class="btn btn-primary" id="btn-launch-mapping">Lancer le mapping</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Pré-sélectionner les couleurs par défaut si elles existent dans la liste
            const categorySelect = document.getElementById('select-color-category');
            const characteristicSelect = document.getElementById('select-color-characteristic');
            const valueSelect = document.getElementById('select-color-value');
            
            // Fonction pour mettre à jour l'aperçu
            const updatePreview = (selectId, previewId, defaultColor) => {
                const select = document.getElementById(selectId);
                const preview = document.getElementById(previewId);
                const selectedColor = select.value || defaultColor;
                
                if (selectedColor) {
                    preview.style.backgroundColor = '#' + selectedColor;
                    // Ajuster la couleur du texte selon la luminosité
                    const rgb = hexToRgb('#' + selectedColor);
                    if (rgb) {
                        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                        preview.style.color = brightness > 128 ? '#333' : '#fff';
                    }
                } else {
                    preview.style.backgroundColor = '#f0f0f0';
                    preview.style.color = '#666';
                }
            };
            
            // Fonction helper pour convertir hex en RGB
            function hexToRgb(hex) {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            }
            
            // Pré-sélectionner les couleurs par défaut
            if (detectedColors.find(c => c.color === defaultColors.category)) {
                categorySelect.value = defaultColors.category;
            }
            if (detectedColors.find(c => c.color === defaultColors.characteristic)) {
                characteristicSelect.value = defaultColors.characteristic;
            }
            if (detectedColors.find(c => c.color === defaultColors.value)) {
                valueSelect.value = defaultColors.value;
            }
            
            // Mettre à jour les aperçus
            updatePreview('select-color-category', 'preview-category', defaultColors.category);
            updatePreview('select-color-characteristic', 'preview-characteristic', defaultColors.characteristic);
            updatePreview('select-color-value', 'preview-value', defaultColors.value);
            
            // Écouter les changements de sélection
            categorySelect.addEventListener('change', () => updatePreview('select-color-category', 'preview-category', defaultColors.category));
            characteristicSelect.addEventListener('change', () => updatePreview('select-color-characteristic', 'preview-characteristic', defaultColors.characteristic));
            valueSelect.addEventListener('change', () => updatePreview('select-color-value', 'preview-value', defaultColors.value));
            
            // Lancer le mapping avec les couleurs sélectionnées
            document.getElementById('btn-launch-mapping').addEventListener('click', async () => {
                const selectedColors = {
                    category: categorySelect.value || defaultColors.category,
                    characteristic: characteristicSelect.value || defaultColors.characteristic,
                    value: valueSelect.value || defaultColors.value
                };
                
                // Vérifier que toutes les couleurs sont sélectionnées
                if (!selectedColors.category || !selectedColors.characteristic || !selectedColors.value) {
                    showAlert('Veuillez sélectionner une couleur pour chaque type (catégorie, caractéristique, valeur)', 'error');
                    return;
                }
                
                // Fermer le modal de sélection
                closeColorSelectionModal();
                
                // Lancer le mapping
                try {
                    const res = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/map-excel`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ colors: selectedColors })
                    });
                    const data = await res.json();
                    if (!res.ok || !data.success) throw new Error(data.message || 'Erreur mapping');
                    
                    // Afficher le modal avec PDF à gauche et résultats à droite
                    const model = currentData.models.find(m => m.id === modelId);
                    const config = model?.configurations?.find(c => c.id === configId);
                    const pdfUrl = config?.pdfAnalysis?.pdfUrl || null;
                    showMappingResultsModal(pdfUrl, modelId, configId, data.data.analysis?.mapped || {}, data.data.yaml || '', selectedColors);
                } catch (err) {
                    console.error('Mapping error', err);
                    showAlert('Erreur lors du mapping: ' + err.message, 'error');
                }
            });
        }

        function closeColorSelectionModal() {
            const m = document.getElementById('color-selection-modal');
            if (m) m.remove();
        }

        function getModelOptionsForSummary(modelId) {
            if (!currentData || !Array.isArray(currentData.categories)) {
                return [];
            }

            const extractRowOrder = (option) => {
                if (typeof option?.rowIndex === 'number') return option.rowIndex;
                const match = String(option?.id || '').match(/^opt_(\d+)$/i);
                return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
            };

            const options = [];
            currentData.categories.forEach(category => {
                (category.options || []).forEach(option => {
                    const compatibleModels = Array.isArray(option.compatibleModels) ? option.compatibleModels : [];
                    const isCompatible = compatibleModels.includes(modelId);
                    if (isCompatible) {
                        options.push({
                            id: option.id,
                            name: option.name || '',
                            refUgap: option.refUgap || '',
                            categoryName: category.name || 'Sans vue métier',
                            rowOrder: extractRowOrder(option),
                            optionFamilyKey: option.optionFamilyKey || '',
                            compatibleModels: Array.isArray(option.compatibleModels) ? [...option.compatibleModels] : [],
                            isDivers: !!option.isDivers,
                            initialProduct: option.initialProduct || '',
                            finalProduct: option.finalProduct || '',
                            baseAiConfidence: option.baseAiConfidence
                        });
                    }
                });
            });

            return options.sort((a, b) => a.rowOrder - b.rowOrder);
        }

        function getAllOptionsForSummary() {
            if (!currentData || !Array.isArray(currentData.categories)) {
                return [];
            }

            const extractRowOrder = (option) => {
                if (typeof option?.rowIndex === 'number') return option.rowIndex;
                const match = String(option?.id || '').match(/^opt_(\d+)$/i);
                return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
            };

            const options = [];
            currentData.categories.forEach(category => {
                (category.options || []).forEach(option => {
                    options.push({
                        id: option.id,
                        name: option.name || '',
                        refUgap: option.refUgap || '',
                        categoryName: category.name || 'Sans vue métier',
                        rowOrder: extractRowOrder(option),
                        optionFamilyKey: option.optionFamilyKey || '',
                        compatibleModels: Array.isArray(option.compatibleModels) ? [...option.compatibleModels] : [],
                        isDivers: !!option.isDivers,
                        priceClient: typeof option.priceClient === 'number' ? option.priceClient : null,
                        priceUgap: typeof option.priceUgap === 'number' ? option.priceUgap : null
                    });
                });
            });
            return options.sort((a, b) => a.rowOrder - b.rowOrder);
        }

        function findOptionRecordById(optionId) {
            const targetId = String(optionId || '').trim();
            if (!targetId || !currentData?.categories) return null;
            for (const category of (currentData.categories || [])) {
                const option = (category.options || []).find((o) => String(o?.id || '').trim() === targetId);
                if (option) return { category, option };
            }
            return null;
        }

        function formatOptionFamilyKeyLabel(key) {
            const parts = String(key || '').split('|');
            if (parts.length < 3) return escapeHtml(key || '');
            const base = parts[0] || '';
            const postes = parts[1] || '';
            const skel = parts[2] || '';
            const postesLabel = postes ? `postes ${postes.replace(/,/g, ', ')}` : 'postes non précisés';
            return escapeHtml(`${base} — ${postesLabel} — ${skel}`);
        }

        function formatOptionFamilyKeyPlain(key) {
            const parts = String(key || '').split('|');
            if (parts.length < 3) return String(key || '');
            const base = parts[0] || '';
            const postes = parts[1] || '';
            const skel = parts[2] || '';
            const postesLabel = postes ? `postes ${postes.replace(/,/g, ', ')}` : 'postes non précisés';
            return `${base} — ${postesLabel} — ${skel}`;
        }

        /** Regroupe les lignes MV/PV partageant une optionFamilyKey (≥ 2 = incompatibles entre elles). */
        function buildMvPvFamilyGroupsFromOptions(options) {
            const map = new Map();
            for (const o of options || []) {
                const k = o.optionFamilyKey;
                if (!k) continue;
                if (!map.has(k)) map.set(k, []);
                map.get(k).push(o);
            }
            return [...map.entries()]
                .filter(([, arr]) => arr.length > 1)
                .map(([familyKey, opts]) => ({ familyKey, options: opts }));
        }

        /** Taille par clé de famille (pour affichage « doublon »). */
        function buildFamilyKeyCounts(options) {
            const counts = new Map();
            for (const o of options || []) {
                const k = o.optionFamilyKey;
                if (!k) continue;
                counts.set(k, (counts.get(k) || 0) + 1);
            }
            return counts;
        }

        /** Trie par famille (même clé regroupée), puis ordre de ligne. Sans clé en dernier. */
        function sortMinorationOptionsByFamily(options) {
            const list = [...(options || [])];
            list.sort((a, b) => {
                const ka = a.optionFamilyKey || '';
                const kb = b.optionFamilyKey || '';
                if (ka !== kb) {
                    if (!ka) return 1;
                    if (!kb) return -1;
                    return ka.localeCompare(kb);
                }
                return (a.rowOrder || 0) - (b.rowOrder || 0);
            });
            return list;
        }

        function shortFamilyCellHtml(key) {
            if (!key) {
                return '<span style="color:#999;">—</span>';
            }
            const parts = String(key).split('|');
            const line = parts.length >= 2
                ? `${parts[0]} · ${parts[1] || '?'}`
                : key;
            const fullPlain = formatOptionFamilyKeyPlain(key);
            return `<span style="font-size:12px; color:#333;" title="${escapeHtml(fullPlain)}">${escapeHtml(line)}</span>`;
        }

        /** Résumé au-dessus du tableau : familles avec doublons. */
        function renderMinorationDoublonSummaryLine(groups) {
            if (!Array.isArray(groups) || groups.length === 0) {
                return '<p style="margin:0 0 10px 0; color:#666; font-size:13px;">Aucun doublon détecté par famille (clé d’équipement/postes identique sur au moins 2 lignes).</p>';
            }
            const lineCount = groups.reduce((n, g) => n + (g.options?.length || 0), 0);
            return `<p style="margin:0 0 10px 0; padding:8px 12px; background:#e8f4f8; border-radius:6px; font-size:13px; color:#0F4C81;">
                <strong>${groups.length}</strong> famille(s) avec <strong>doublons</strong> — <strong>${lineCount}</strong> ligne(s) concernées (voir colonnes ci-dessous).
            </p>`;
        }

        /**
         * Tableau minoration / MV / PV : tri par famille, colonnes Famille + Doublon pour voir les doublons sans autre bloc.
         */
        function renderMinorationOptionRows(options, emptyLabel) {
            if (!Array.isArray(options) || options.length === 0) {
                return `<tr><td colspan="4" style="padding:10px; color:#666; text-align:center;">${escapeHtml(emptyLabel || 'Aucune donnée')}</td></tr>`;
            }
            const sorted = sortMinorationOptionsByFamily(options);
            const counts = buildFamilyKeyCounts(options);
            return sorted.map(opt => {
                const key = opt.optionFamilyKey || '';
                const n = key ? (counts.get(key) || 0) : 0;
                const dupCell = key && n > 1
                    ? `<span style="display:inline-block; padding:2px 8px; background:#fff3cd; border:1px solid #f0d78c; border-radius:4px; font-size:12px; font-weight:600; color:#856404;">Doublon ×${n}</span>`
                    : '<span style="color:#bbb;">—</span>';
                return `
                <tr>
                    <td style="padding:8px; border-bottom:1px solid #eee; vertical-align:top; max-width:220px;">${shortFamilyCellHtml(key)}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee; vertical-align:top; white-space:nowrap;">${dupCell}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(opt.name || '-')}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee; color:#666;">${escapeHtml(opt.categoryName || '-')}</td>
                </tr>`;
            }).join('');
        }

        function splitModelOptionsByType(options) {
            const normalized = Array.isArray(options) ? options : [];
            const minorationRegex = /minorat/i;

            const isPrLabel = (label) => {
                const raw = String(label || '').trim();
                if (!raw) return false;
                return /^PR\s/i.test(raw);
            };
            const isMinorationByRef = (refUgap) => {
                const rawRef = String(refUgap || '').trim().toUpperCase();
                return rawRef.startsWith('MINO');
            };
            const isPlusOrMoinsTarifLine = (label) => {
                const raw = String(label || '').trim();
                return /^(moins-value|plus-value|plus\s+value)\b/i.test(raw);
            };
            const hasModelCross = (opt) => {
                const models = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
                return models.length > 0;
            };
            const isExplicitDivers = (opt) => !!opt?.isDivers;

            const prOptions = normalized.filter(opt => isPrLabel(opt?.name || ''));
            const minorationOptions = normalized.filter(opt =>
                isMinorationByRef(opt?.refUgap) ||
                minorationRegex.test((opt?.name || '').trim()) ||
                isPlusOrMoinsTarifLine(opt?.name)
            );
            const standardNonPrNonMino = normalized.filter(opt => {
                const label = (opt?.name || '').trim();
                const isPr = isPrLabel(label);
                const isMino =
                    isMinorationByRef(opt?.refUgap) ||
                    minorationRegex.test((opt?.name || '').trim()) ||
                    isPlusOrMoinsTarifLine(opt?.name);
                return !isPr && !isMino;
            });
            const regularOptions = standardNonPrNonMino.filter((opt) => !isExplicitDivers(opt) && hasModelCross(opt));
            const diversOptions = standardNonPrNonMino.filter((opt) => isExplicitDivers(opt) || !hasModelCross(opt));

            return {
                all: normalized,
                regularOptions,
                minorationOptions,
                prOptions,
                diversOptions
            };
        }

        /**
         * Heuristique : libellés souvent liés au détail « de base » (remplacement, lieu et place, non-fourniture, fourni de base).
         * Affichage exploratoire — à affiner ensuite (règles ou IA).
         */
        function isHeuristicBaseRelatedOptionLine(label) {
            const raw = String(label || '').trim();
            if (!raw) return false;
            const s = raw.toLowerCase();
            if (
                /\ben\s+remplacement\s+de\b/.test(s) ||
                /\ben\s+lieu\s+et\s+place\b/.test(s) ||
                /\bau\s+lieu\s+et\s+place\b/.test(s) ||
                /\bnon\s+fourniture\b/.test(s) ||
                /\bnon\s+fourni\b/.test(s) ||
                /\bfourni\s+de\s+base\b/.test(s) ||
                /\bfourniture\s+de\s+base\b/.test(s) ||
                /\bfourni\s+en\s+standard\b/.test(s) ||
                /\béquipement\s+en\s+standard\b/.test(s) ||
                /\béquipement\s+de\s+base\b/.test(s) ||
                /\bconfiguration\s+de\s+base\b/.test(s)
            ) {
                return true;
            }
            // Lignes tarifaires type UGAP : souvent le détail « base / remplacement » sans les mots-clés ci-dessus.
            if (/^(moins-value|plus-value|plus\s+value)\b/i.test(raw)) {
                return true;
            }
            return false;
        }

        /**
         * Extraction heuristique locale (fallback d'affichage) du produit initial/final.
         * Utilise d'abord les champs déjà extraits par le backend si présents.
         */
        function extractBaseReplacementProductsForUi(opt) {
            const backendInitial = String(opt?.initialProduct || '').trim();
            const backendFinal = String(opt?.finalProduct || '').trim();
            const backendType = String(opt?.changeType || '').trim();
            if (backendInitial || backendFinal || backendType) {
                return {
                    changeType: backendType,
                    initialProduct: backendInitial,
                    finalProduct: backendFinal
                };
            }

            const raw = String(opt?.name || '').replace(/\s+/g, ' ').trim();
            if (!raw) return { changeType: '', initialProduct: '', finalProduct: '' };
            const cleaned = raw.replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '').trim();

            if (/\bnon\s+fourniture\s+du\s+moteur\s+de\s+base\b/i.test(cleaned)) {
                return {
                    changeType: 'motor_base_non_supply',
                    initialProduct: 'moteur de base',
                    finalProduct: 'moteur choisi'
                };
            }

            const nonSupplyMatch = cleaned.match(/^non\s+fourniture\s+(?:du|de\s+la|des|de\s+l['’])\s+(.+)$/i);
            if (nonSupplyMatch) {
                return {
                    changeType: 'non_supply',
                    initialProduct: String(nonSupplyMatch[1] || '')
                        .replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '')
                        .trim(),
                    finalProduct: ''
                };
            }

            const replacementMatch = cleaned.match(/^(.*?)\s+en\s+remplacement\s+de\s+(?:l['’]|la\s+|le\s+|les\s+)?(.+?)\s+fourni\s+de\s+base\b/i);
            if (replacementMatch) {
                const before = String(replacementMatch[1] || '').trim().replace(/^(moins-value|plus-value|plus\s+value)\s+/i, '').trim();
                const replaced = String(replacementMatch[2] || '').trim();
                const finalProduct = before.replace(/^(module\s+sondeur|combin[ée]|motorisation|moteur|pack|option)\s+/i, '').trim() || before;
                const initialProduct = /^celui\s+de\s+base$/i.test(replaced)
                    ? ((before.match(/\b(flotteur|moteur|combin[ée]|sondeur|module|coque|console)\b/i)?.[1] || 'produit') + ' de base')
                    : replaced;
                return {
                    changeType: 'replacement',
                    initialProduct,
                    finalProduct
                };
            }

            return { changeType: '', initialProduct: '', finalProduct: '' };
        }

        /** Détecte « poste 10 », « postes 8, 10 et 12 », etc. pour un numéro donné. */
        function labelMentionsPosteNumber(label, posteNum) {
            const n = Number(posteNum);
            if (!Number.isFinite(n)) return false;
            const raw = String(label || '');
            if (new RegExp(`\\bpostes?\\s*(?:n°|n\\s*°|:)?\\s*${n}\\b`, 'i').test(raw)) return true;
            const m = raw.match(/\bpostes?\s+([\d\s,]+(?:et\s+\d+)?)/i);
            if (m) {
                const nums = m[1].match(/\d+/g);
                if (nums && nums.some((x) => parseInt(x, 10) === n)) return true;
            }
            return false;
        }

        /**
         * Ensemble des postes explicitement cités (plages « Postes 5 à 7 », listes « 1, 5 et 8 », etc.).
         * null = aucune contrainte de poste détectée dans le libellé.
         */
        function getExplicitPosteSetFromLabel(label) {
            const raw = String(label || '');
            if (!raw.trim()) return null;
            const set = new Set();
            let found = false;

            const rangeRe = /\bpostes?\s+(\d+)\s*(?:à|a|-|–|—)\s*(\d+)\b/gi;
            let m;
            while ((m = rangeRe.exec(raw)) !== null) {
                found = true;
                let a = parseInt(m[1], 10);
                let b = parseInt(m[2], 10);
                if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
                if (b < a) [a, b] = [b, a];
                for (let i = a; i <= b; i++) set.add(i);
            }

            const scratch = raw.replace(/\bpostes?\s+\d+\s*(?:à|a|-|–|—)\s*\d+\b/gi, ' ');

            const singlePosteRe = /\bposte\s+n°?\s*(\d+)\b/gi;
            while ((m = singlePosteRe.exec(raw)) !== null) {
                found = true;
                set.add(parseInt(m[1], 10));
            }

            const listRe = /\bpostes?\s+([\d,\s]+(?:et\s+\d+)*)/gi;
            while ((m = listRe.exec(scratch)) !== null) {
                const chunk = m[1] || '';
                if (/\d\s*(?:à|a|-|–|—)\s*\d/.test(chunk)) continue;
                found = true;
                const nums = chunk.match(/\d+/g);
                if (nums) nums.forEach((x) => set.add(parseInt(x, 10)));
            }

            if (!found) return null;
            return set;
        }

        /** Numéros de poste extraits du libellé, triés par ordre croissant (affichage). */
        function getSortedExplicitPosteNumbersFromLabel(label) {
            const s = getExplicitPosteSetFromLabel(label);
            if (!s || s.size === 0) return [];
            return [...s].sort((a, b) => a - b);
        }

        /** Pour tri des lignes : plus petit poste explicite, sinon fin de liste. */
        function getMinExplicitPosteForSortLabel(label) {
            const arr = getSortedExplicitPosteNumbersFromLabel(label);
            return arr.length ? arr[0] : null;
        }

        /**
         * Le libellé cite des postes numérotés (détecté par parse ou motifs typiques).
         * Dans ce cas on n’utilise pas la croix Excel ni « tous modèles » pour inclure la ligne.
         */
        function labelHasPosteNumberingContext(label) {
            if (getExplicitPosteSetFromLabel(label) !== null) return true;
            const raw = String(label || '');
            return (
                /\bpostes?\s+(?:n°|n\s*°|:)?\s*\d/i.test(raw) ||
                /\bpostes?\s+\d+\s*(?:à|a|-|–|—)\s*\d/i.test(raw) ||
                /\bpostes?\s+[\d,\s]{2,80}(?:et\s+\d+)?/i.test(raw)
            );
        }

        /** Croix sur la colonne du modèle : compatibilité explicite (liste non vide et contient ce modèle). */
        function optionHasExplicitXForModel(opt, modelId) {
            const cm = opt.compatibleModels;
            return Array.isArray(cm) && cm.length > 0 && cm.includes(modelId);
        }

        /**
         * Liste/plage de postes dans le libellé → seul ce sous-ensemble compte (jamais la croix).
         * Libellé avec numéros de postes détectés mais sans parse complète → uniquement mention « poste N ».
         * Sinon → mention « poste N », ou X colonne modèle, ou ligne tous modèles.
         */
        function passesPosteScopeForBaseOption(opt, model) {
            const pn = model.posteNumber;
            if (pn == null || pn === '') return true;

            const name = opt.name || '';
            const explicit = getExplicitPosteSetFromLabel(name);
            if (explicit !== null && explicit.size > 0) {
                return explicit.has(Number(pn));
            }

            if (labelHasPosteNumberingContext(name)) {
                return labelMentionsPosteNumber(name, pn);
            }

            if (labelMentionsPosteNumber(name, pn)) return true;
            if (optionHasExplicitXForModel(opt, model.id)) return true;
            const cm = opt.compatibleModels;
            if (!Array.isArray(cm) || cm.length === 0) return true;
            return false;
        }

        function posteLinkSummaryForRow(opt, model) {
            const pn = model.posteNumber;
            if (pn == null || pn === '') return '—';
            const name = opt.name || '';
            const explicit = getExplicitPosteSetFromLabel(name);
            if (explicit !== null && explicit.size > 0) {
                const sorted = getSortedExplicitPosteNumbersFromLabel(name);
                return `postes ${sorted.join(', ')}`;
            }
            const strictPoste = labelHasPosteNumberingContext(name);
            const cm = opt.compatibleModels;
            const universal = !Array.isArray(cm) || cm.length === 0;
            const byText = labelMentionsPosteNumber(name, pn);
            const byX = optionHasExplicitXForModel(opt, model.id);
            const parts = [];
            if (byText) parts.push('libellé');
            if (!strictPoste && byX) parts.push('colonne modèle (X)');
            if (!strictPoste && universal && !byText) parts.push('tous modèles');
            return parts.length ? parts.join(' + ') : '—';
        }

        function getBaseRelatedOptionsForModel(model) {
            const rows = getModelOptionsForSummary(model.id);
            return rows.filter((r) =>
                isHeuristicBaseRelatedOptionLine(r.name) && passesPosteScopeForBaseOption(r, model)
            );
        }

        function renderExtractionBaseOptionsByModelHtml(models, opts = {}) {
            const rowFilter = typeof opts?.rowFilter === 'function' ? opts.rowFilter : null;
            const showAiControls = opts?.showAiControls !== false;
            const showAiConfidence = opts?.showAiConfidence !== false;
            const sorted = [...models].sort((a, b) => {
                const pa = a.posteNumber;
                const pb = b.posteNumber;
                const na = Number(pa);
                const nb = Number(pb);
                const aOk = pa != null && pa !== '' && Number.isFinite(na);
                const bOk = pb != null && pb !== '' && Number.isFinite(nb);
                if (aOk && bOk) return na - nb;
                if (aOk && !bOk) return -1;
                if (!aOk && bOk) return 1;
                return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' });
            });
            let totalLines = 0;
            const blocks = sorted.map((model) => {
                const baseOpts = [...getBaseRelatedOptionsForModel(model)].sort((a, b) => {
                    const ma = getMinExplicitPosteForSortLabel(a.name);
                    const mb = getMinExplicitPosteForSortLabel(b.name);
                    if (ma != null && mb != null && ma !== mb) return ma - mb;
                    if (ma != null && mb == null) return -1;
                    if (ma == null && mb != null) return 1;
                    return (a.rowOrder ?? 0) - (b.rowOrder ?? 0);
                });
                totalLines += baseOpts.length;
                const hasPosteOnModel = model.posteNumber != null && model.posteNumber !== '';
                const suspectIds = buildSuspectIncoherenceSetForModelRows(baseOpts);
                const unresolvedSuspectIds = new Set(
                    [...suspectIds].filter((optId) => !isBaseIncoherenceValidated(model.id, optId))
                );
                const filterMode = getBaseIncoherenceFilterMode();
                const shownBaseOptsRaw = filterMode === 'only'
                    ? baseOpts.filter((o) => unresolvedSuspectIds.has(String(o.id || '').trim()))
                    : baseOpts;
                const shownBaseOpts = rowFilter
                    ? shownBaseOptsRaw.filter((o) => rowFilter(o, model))
                    : shownBaseOptsRaw;
                const emptyMsg = hasPosteOnModel
                    ? `Aucune ligne « option de base » pour ce modèle (mots-clés + filtre poste <strong>${escapeHtml(String(model.posteNumber))}</strong>). Vérifiez les libellés ou le n° de poste du modèle.`
                    : 'Aucune ligne détectée pour ce modèle (heuristique sur le libellé : remplacement, fourni de base, moins-value / plus-value, etc.).';
                const rowsHtml = shownBaseOpts.length === 0
                    ? `<div style="color:#888;font-size:13px;">${emptyMsg}</div>`
                    : `<table style="width:100%; border-collapse:collapse; font-size:13px;">
                        <thead>
                            <tr style="background:#f8f9fa;">
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">ID</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Nouvelle réf. base</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Libellé (brut)</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Produit initial</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Produit final</th>
                                ${showAiConfidence ? '<th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Confiance IA</th>' : ''}
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Famille</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Sous-famille</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Base incluse</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Prix ref. inclus</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Action</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Vue métier</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Poste</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">✕</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${shownBaseOpts.map((opt) => `
                                ${(() => {
                                    const parsed = extractBaseReplacementProductsForUi(opt);
                                    const optId = String(opt.id || '').trim();
                                    const isSuspect = suspectIds.has(optId);
                                    const isValidated = isBaseIncoherenceValidated(model.id, optId);
                                    const isUnresolved = isSuspect && !isValidated;
                                    const parsedFamily = parseValidatedFamilyLabel(getSelectedFamilyLabelForOption(optId, opt.familyLabel));
                                    const baseIncluded = !!opt.baseIncluded;
                                    const baseIncludedPrice = Number.isFinite(Number(opt.baseIncludedPrice))
                                        ? Number(opt.baseIncludedPrice)
                                        : (Number.isFinite(Number(opt.priceClient)) ? Number(opt.priceClient) : 0);
                                    return `
                                <tr>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee; font-family:monospace; white-space:nowrap;">${escapeHtml(opt.id || '')}</td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">
                                        <input id="base-ref-${opt.id || ''}" value="${escapeHtml(opt.baseRefUgap || '')}" placeholder="Nouvelle référence base" style="width:180px; max-width:100%; padding:4px 6px; border:1px solid #ddd; border-radius:4px; font-family:monospace;">
                                    </td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(opt.name || '')}</td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee; color:#444;">
                                        <input id="base-initial-${opt.id || ''}" value="${escapeHtml(parsed.initialProduct || '')}" placeholder="Produit initial" style="width:220px; max-width:100%; padding:4px 6px; border:1px solid #ddd; border-radius:4px;">
                                    </td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee; color:#111; font-weight:600;">
                                        <input id="base-final-${opt.id || ''}" value="${escapeHtml(parsed.finalProduct || '')}" placeholder="Produit final" style="width:220px; max-width:100%; padding:4px 6px; border:1px solid #ddd; border-radius:4px;">
                                    </td>
                                    ${showAiConfidence ? `<td style="padding:6px 8px; border-bottom:1px solid #eee; white-space:nowrap;">${escapeHtml(formatBaseConfidence(opt.baseAiConfidence))}</td>` : ''}
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee; color:#555;">${escapeHtml(parsedFamily.familyName || '—')}</td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee; color:#777;">${escapeHtml(parsedFamily.subFamilyName || '—')}</td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">
                                        <label style="display:flex; align-items:center; gap:6px; white-space:nowrap;">
                                            <input id="base-included-${opt.id || ''}" type="checkbox" ${baseIncluded ? 'checked' : ''}>
                                            <span>0 € client</span>
                                        </label>
                                    </td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">
                                        <input id="base-price-${opt.id || ''}" type="number" step="0.01" value="${escapeHtml(String(baseIncludedPrice))}" style="width:130px; max-width:100%; padding:4px 6px; border:1px solid #ddd; border-radius:4px;">
                                    </td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee;">
                                        <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="saveBaseModelOption('${opt.id || ''}')">Enregistrer</button>
                                        ${isUnresolved ? `<span style="margin-left:8px; padding:2px 6px; border-radius:4px; background:#fff3cd; color:#856404; font-size:11px;">Incohérence ?</span>` : ''}
                                        ${isValidated ? `<span style="margin-left:8px; padding:2px 6px; border-radius:4px; background:#d1e7dd; color:#0f5132; font-size:11px;">Validée</span>` : ''}
                                    </td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee; color:#666;">${escapeHtml(opt.categoryName || '')}</td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee; color:#555; font-size:12px; white-space:nowrap;">${escapeHtml(posteLinkSummaryForRow(opt, model))}</td>
                                    <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">
                                        ${isSuspect ? `
                                            <div style="display:flex; gap:4px; justify-content:center;">
                                                <button title="Retirer cette ligne pour ce modèle" style="border:none; background:#dc3545; color:#fff; border-radius:4px; width:22px; height:22px; cursor:pointer;" onclick="removeBaseOptionForModel('${opt.id || ''}', '${model.id || ''}')">✕</button>
                                                <button title="Valider et conserver cette ligne" style="border:none; background:#198754; color:#fff; border-radius:4px; padding:0 6px; height:22px; cursor:pointer; font-size:11px;" onclick="validateBaseIncoherenceForModel('${opt.id || ''}', '${model.id || ''}')">✓</button>
                                            </div>
                                        ` : '<span style="color:#bbb;">—</span>'}
                                    </td>
                                </tr>
                                `;
                                })()}
                            `).join('')}
                        </tbody>
                    </table>`;
                const posteLabel = (model.posteNumber != null && model.posteNumber !== '')
                    ? escapeHtml(String(model.posteNumber))
                    : '—';
                return `
                <div style="margin-bottom:14px; border:1px solid #e9ecef; border-radius:8px; padding:12px; background:#fff;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                            <strong style="font-size:15px;">${escapeHtml(model.name || model.id || 'Modèle')}</strong>
                            <span style="font-size:13px; color:#555;">Poste : <strong>${posteLabel}</strong></span>
                        </div>
                        <span class="badge">${baseOpts.length} ligne(s)</span>
                    </div>
                    ${rowsHtml}
                </div>`;
            }).join('');
            return `
                <div style="margin-bottom:12px; padding:10px; background:#f0f7ff; border:1px solid #cfe8ff; border-radius:6px; font-size:13px; color:#333;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
                        <strong>Options de base (par modèle)</strong>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <label style="display:flex; align-items:center; gap:6px; font-size:12px;">
                                <span>Filtre :</span>
                                <select onchange="onChangeBaseIncoherenceFilter(this.value)" style="padding:4px 6px; border:1px solid #ddd; border-radius:4px;">
                                    <option value="all" ${getBaseIncoherenceFilterMode() === 'all' ? 'selected' : ''}>Toutes</option>
                                    <option value="only" ${getBaseIncoherenceFilterMode() === 'only' ? 'selected' : ''}>Incohérences uniquement</option>
                                </select>
                            </label>
                            ${showAiControls ? '<button id="btn-base-options-complete-ia" class="btn btn-primary" onclick="runBaseOptionsAiCompletion()">Compléter avec l\'IA</button>' : ''}
                        </div>
                    </div>
                    ${showAiControls ? `<div id="base-options-ai-progress" style="display:none; margin-bottom:8px; padding:8px 10px; border-radius:6px; background:#fff; border:1px solid #b6d4fe; color:#084298;">
                        Traitement IA en cours...
                    </div>` : ''}
                    mots-clés dans le libellé :
                    <em>en remplacement de</em>, <em>en lieu et place</em>, <em>non fourniture</em> / <em>non fourni</em>, <em>fourni de base</em>, <em>équipement de base</em>, <em>configuration de base</em>.
                    <span style="display:block; margin-top:6px; color:#555;">
                        Filtre <strong>poste</strong> : dès que le libellé cite des <strong>numéros de poste</strong> (liste, plage, « poste N »), la <strong>croix Excel</strong> et la ligne <strong>tous modèles</strong> ne comptent pas : seuls le texte (poste du modèle inclus dans la liste) ou la mention directe de votre poste. Sans numéro de poste dans le libellé : X sur la colonne du modèle ou compatibilité tous modèles possibles.
                    </span>
                    <span style="display:block; margin-top:6px; color:#555;">Total : <strong>${totalLines}</strong> ligne(s) sur <strong>${sorted.length}</strong> modèle(s).</span>
                </div>
                ${blocks}
            `;
        }

        function getNextManualBaseOptionId() {
            const all = getAllOptionsForSummary();
            let maxNum = 0;
            (all || []).forEach((opt) => {
                const m = String(opt?.id || '').match(/^opt_(\d+)$/i);
                if (!m) return;
                const n = Number(m[1]);
                if (Number.isFinite(n) && n > maxNum) maxNum = n;
            });
            return `opt_${maxNum + 1}`;
        }

        function getBaseModelFamilyChoices() {
            const families = getFamilleValidatedFamilies();
            return Array.from(new Set((Array.isArray(families) ? families : [])
                .map((f) => parseValidatedFamilyLabel(f?.familyLabel || '').familyName)
                .filter(Boolean)))
                .sort((a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' }));
        }

        function getBaseModelSubFamilyChoices(familyName) {
            const family = String(familyName || '').trim();
            if (!family) return [];
            const families = getFamilleValidatedFamilies();
            return Array.from(new Set((Array.isArray(families) ? families : [])
                .map((f) => parseValidatedFamilyLabel(f?.familyLabel || ''))
                .filter((p) => String(p?.familyName || '') === family && String(p?.subFamilyName || '').trim())
                .map((p) => p.subFamilyName)))
                .sort((a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' }));
        }

        function getGenericBaseTemplateModelId() {
            return '__GENERIC_BASE_TEMPLATE__';
        }

        function isImportBaseModelTabRoot(rootId) {
            return String(rootId || '').trim() === 'import-base-model-content';
        }

        function isImportTemplateSharedRoot(rootId) {
            return String(rootId || '').trim() === 'import-template-shared-content';
        }

        function getImportValidatedModelsForBaseTab() {
            if (!currentImportStaging?.models) return [];
            const validatedIds = new Set((currentImportStaging?.progress?.validatedModelIds || []).map((x) => String(x)));
            return (currentImportStaging.models || []).filter((m) =>
                importModelRowDisplayValidated(String(m?.id || ''), validatedIds)
            );
        }

        function rerenderBaseModelTab() {
            renderBaseModelTab(window.__baseModelLastTabRootId || 'base-model-content');
        }

        function onImportBaseModelTargetChange() {
            const sel = document.getElementById('import-base-model-target-select') || document.getElementById('base-model-target-select');
            if (!sel || !window.__baseModelCreateState) return;
            const raw = String(sel.value || '').trim();
            let id = raw;
            try { id = decodeURIComponent(raw); } catch (_) {}
            window.__baseModelCreateState.modelId = String(id || '').trim();
            rerenderBaseModelTab();
        }

        function renderBaseModelTab(rootId = 'base-model-content') {
            const root = document.getElementById(rootId);
            if (!root) return;
            window.__baseModelLastTabRootId = rootId;
            const genericModelId = getGenericBaseTemplateModelId();
            const importRoot = isImportBaseModelTabRoot(rootId);

            if (!window.__baseModelCreateState) {
                window.__baseModelCreateState = {
                    modelId: genericModelId,
                    familyName: '',
                    refUgap: '',
                    name: '',
                    baseIncludedPrice: '',
                    selectedOptionId: '',
                    customFamilies: [],
                    customSubFamilies: {}
                };
            }
            const state = window.__baseModelCreateState;
            const importChoices = importRoot ? getImportValidatedModelsForBaseTab() : [];
            let selectedModelId = genericModelId;
            if (importRoot) {
                if (!importChoices.length) {
                    root.innerHTML = '<div style="padding:12px; color:#6b7280;">Aucun modèle validé disponible pour la configuration de base. Retournez à l\'étape 1.</div>';
                    return;
                }
                const allowed = new Set(importChoices.map((m) => String(m?.id || '').trim()).filter(Boolean));
                const cur = String(state.modelId || '').trim();
                if (!cur || !allowed.has(cur) || cur === genericModelId) {
                    state.modelId = String(importChoices[0]?.id || '').trim();
                }
                selectedModelId = String(state.modelId || '').trim();
            } else {
                state.modelId = genericModelId;
                selectedModelId = genericModelId;
            }
            const familyChoices = getBaseModelFamilyChoices()
                .sort((a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' }));
            if (state.familyName && !familyChoices.includes(state.familyName)) state.familyName = '';
            const hasSelectedFamily = !!String(state.familyName || '').trim();
            const optionChoices = hasSelectedFamily ? getBaseModalOptionsForSelection(state.familyName, '') : [];
            if (!optionChoices.some(({ opt }) => String(opt?.id || '') === String(state.selectedOptionId || ''))) {
                state.selectedOptionId = '';
            }

            const modelBaseOptions = getAllOptionsForSummary()
                .map((opt) => ({ opt, rec: findOptionRecordById(opt.id)?.option || null }))
                .filter(({ rec }) => {
                    const comp = Array.isArray(rec?.compatibleModels) ? rec.compatibleModels.map((x) => String(x)) : [];
                    return !!rec && !!rec.baseIncluded && comp.includes(selectedModelId);
                })
                .sort((a, b) => (a.opt.rowOrder || 0) - (b.opt.rowOrder || 0));
            const rowsHtml = modelBaseOptions.length
                ? modelBaseOptions.map(({ opt, rec }) => {
                    const parsedFamily = parseValidatedFamilyLabel(getSelectedFamilyLabelForOption(opt.id, rec.familyLabel));
                    return `<tr>
                        <td style="padding:8px; border-bottom:1px solid #eee; font-family:monospace;">${escapeHtml(opt.id || '')}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; font-family:monospace;">${escapeHtml(rec.baseRefUgap || rec.refUgap || '')}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(opt.name || '')}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(parsedFamily.familyName || '—')}</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">0.00 €</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${Number.isFinite(Number(rec.baseIncludedPrice)) ? Number(rec.baseIncludedPrice).toFixed(2) : '0.00'} €</td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                            <button type="button" title="Retirer du template" onclick="removeBaseOptionFromModel('${escapeHtml(String(opt.id || ''))}', '${escapeHtml(selectedModelId)}')" style="border:none; background:#dc3545; color:#fff; border-radius:4px; width:24px; height:24px; cursor:pointer; font-weight:700;">×</button>
                        </td>
                    </tr>`;
                }).join('')
                : '<tr><td colspan="7" style="padding:10px; color:#777;">Aucune option de base associée à ce modèle.</td></tr>';

            const targetModelLabel = importRoot && importChoices.length
                ? (importChoices.find((m) => String(m?.id || '') === selectedModelId)?.name || selectedModelId)
                : '';
            const topBanner = importRoot
                ? `<div style="margin-bottom:12px; padding:10px; border:1px solid #e9ecef; border-radius:6px; background:#eff6ff; color:#1e3a8a; font-size:13px;">
                    Modèle de base pour l'import : choisissez un des modèles validés à l'étape 1, puis associez les options de base à ce modèle.
                </div>
                <div style="margin-bottom:14px; padding:12px; border:1px solid #dbeafe; border-radius:8px; background:#fff;">
                    <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Modèle bateau (validé à l'étape 1)</label>
                    <select id="import-base-model-target-select" onchange="onImportBaseModelTargetChange()" style="padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; min-width:280px; max-width:100%; font-size:13px;">
                        ${importChoices.map((m) => {
                            const mid = String(m?.id || '');
                            const enc = encodeURIComponent(mid);
                            return `<option value="${enc}" ${mid === selectedModelId ? 'selected' : ''}>${escapeHtml(String(m?.name || mid))}</option>`;
                        }).join('')}
                    </select>
                    <div style="margin-top:6px; font-size:12px; color:#64748b;">Sélection actuelle : <strong>${escapeHtml(String(targetModelLabel || selectedModelId))}</strong></div>
                </div>`
                : `<div style="margin-bottom:12px; padding:10px; border:1px solid #e9ecef; border-radius:6px; background:#f8f9fa; color:#444; font-size:13px;">
                    Template bateau global (indépendant du modèle) : sélectionnez les familles/options que vous voulez inclure par défaut.
                </div>`;
            const importTemplateSharedRoot = isImportTemplateSharedRoot(rootId);
            const templateSaveBox = (!importRoot && !importTemplateSharedRoot)
                ? (() => {
                    const triState = getImportFamilyTriState();
                    const templates = getImportAssignableTemplates();
                    const copyChoices = templates.map((t) => {
                        const tid = String(t?.id || '').trim();
                        const label = String(t?.label || tid).trim();
                        return `<option value="${escapeHtml(tid)}" ${String(triState.draftSourceTemplateId || '') === tid ? 'selected' : ''}>${escapeHtml(label)}</option>`;
                    }).join('');
                    return `<div style="margin-bottom:12px; padding:12px; border:1px solid #dbe3ea; border-radius:8px; background:#fff;">
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; justify-content:space-between;">
                            <div style="min-width:280px; flex:1;">
                                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Nom du template</label>
                                <input value="${escapeHtml(String(triState.newTemplateName || ''))}" oninput="onImportTemplateNameInput(this.value)" type="text" placeholder="Ex: Template bateau v1" style="padding:6px 8px; border:1px solid #ddd; border-radius:4px; min-width:280px; width:100%;">
                            </div>
                            <div style="min-width:280px; flex:1;">
                                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Copier un template existant</label>
                                <select onchange="onImportTemplateCopySelect(this.value)" style="padding:6px 8px; border:1px solid #ddd; border-radius:4px; min-width:280px; width:100%;">
                                    <option value="">-- Aucun --</option>
                                    ${copyChoices}
                                </select>
                            </div>
                            <div>
                                <button class="btn btn-success" onclick="saveImportTemplateNamedFromCurrentFamilies()">Enregistrer template</button>
                            </div>
                        </div>
                    </div>`;
                })()
                : '';
            const shouldShowTemplateForm = importRoot || importTemplateSharedRoot || !!String(getImportFamilyTriState().newTemplateName || '').trim();

            root.innerHTML = `
                ${topBanner}
                ${templateSaveBox}
                ${shouldShowTemplateForm ? `
                    <div style="margin-bottom:14px; padding:12px; border:1px solid #dbe3ea; border-radius:8px; background:#fff;">
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; justify-content:space-between;">
                            <div>
                                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Famille</label>
                                <div style="display:flex; gap:6px;">
                                    <select id="base-model-family-select" onchange="onBaseAssociationSelectionChange()" style="padding:6px 8px; border:1px solid #ddd; border-radius:4px; min-width:240px;">
                                        <option value="">-- Sélectionner --</option>
                                        ${familyChoices.map((f) => `<option value="${escapeHtml(f)}" ${state.familyName === f ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('')}
                                    </select>
                                    <button type="button" class="btn btn-outline" title="Créer une famille" onclick="openBaseCreationModal('family')">+</button>
                                </div>
                            </div>
                            <div style="min-width:320px;">
                                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Option de base</label>
                                <div style="display:flex; gap:6px;">
                                    <select id="base-model-option-select" onchange="onBaseAssociationSelectionChange()" ${hasSelectedFamily ? '' : 'disabled'} style="padding:6px 8px; border:1px solid #ddd; border-radius:4px; min-width:320px; width:100%;">
                                        <option value="">${hasSelectedFamily ? '-- Sélectionner une option --' : "-- Choisir une famille d'abord --"}</option>
                                        ${optionChoices.map(({ opt, rec }) => `<option value="${escapeHtml(opt.id)}" ${String(state.selectedOptionId || '') === String(opt.id || '') ? 'selected' : ''}>${escapeHtml((rec.baseRefUgap || rec.refUgap || '-') + ' | ' + (opt.name || opt.id))}</option>`).join('')}
                                    </select>
                                    <button type="button" class="btn btn-outline" title="Créer une option" onclick="openBaseCreationModal('option')">+</button>
                                </div>
                            </div>
                            <div>
                                <button class="btn btn-primary" onclick="assignBaseOptionToModel()">${importRoot ? 'Associer au modèle' : 'Associer au template'}</button>
                            </div>
                        </div>
                    </div>

                    <div style="border:1px solid #e9ecef; border-radius:8px; background:#fff;">
                        <div style="padding:10px 12px; border-bottom:1px solid #e9ecef; font-weight:600;">${importRoot ? `Options de base du modèle sélectionné (${modelBaseOptions.length})` : `Options du template global (${modelBaseOptions.length})`}</div>
                        <table style="width:100%; border-collapse:collapse; font-size:13px;">
                            <thead>
                                <tr style="background:#f8f9fa;">
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">ID</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Réf.</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Libellé</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Famille</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:right;">Prix client</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:right;">Prix produit</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee; text-align:center;">✕</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    </div>
                ` : `<div style="padding:12px; color:#6b7280; border:1px solid #e5e7eb; border-radius:8px; background:#fff;">Renseignez un nom de template pour afficher le reste du formulaire.</div>`}
            `;
        }

        function onBaseModelFilterChange() {
            if (!window.__baseModelCreateState) return;
            window.__baseModelCreateState.modelId = getGenericBaseTemplateModelId();
            rerenderBaseModelTab();
        }

        function onBaseAssociationSelectionChange() {
            if (!window.__baseModelCreateState) return;
            window.__baseModelCreateState.familyName = String(document.getElementById('base-model-family-select')?.value || '').trim();
            window.__baseModelCreateState.selectedOptionId = String(document.getElementById('base-model-option-select')?.value || '').trim();
            rerenderBaseModelTab();
        }

        function getBaseModalOptionsForSelection(familyName, subFamilyName) {
            const family = String(familyName || '').trim();
            const sub = String(subFamilyName || '').trim();
            return getAllOptionsForSummary()
                .map((opt) => ({ opt, rec: findOptionRecordById(opt.id)?.option || {} }))
                .filter(({ opt, rec }) => {
                    const parsed = parseValidatedFamilyLabel(getSelectedFamilyLabelForOption(opt.id, rec.familyLabel));
                    if (family && String(parsed.familyName || '') !== family) return false;
                    if (sub && String(parsed.subFamilyName || '') !== sub) return false;
                    return true;
                })
                .sort((a, b) => String(a.opt?.name || '').localeCompare(String(b.opt?.name || ''), 'fr', { sensitivity: 'base' }));
        }

        function openBaseCreationModal(type) {
            const modalType = String(type || '').trim();
            if (!['family', 'subfamily', 'option'].includes(modalType)) return;
            if (document.getElementById('base-option-modal')) return;
            const state = window.__baseModelCreateState || {};
            const modal = document.createElement('div');
            modal.id = 'base-option-modal';
            modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;';
            modal.innerHTML = `
                <div style="background:#fff; width:min(980px, 96vw); max-height:90vh; overflow:auto; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.2);">
                    <div style="padding:12px 14px; border-bottom:1px solid #e9ecef; display:flex; justify-content:space-between; align-items:center;">
                        <strong>${modalType === 'family' ? 'Créer une famille' : (modalType === 'subfamily' ? 'Créer une sous-famille' : 'Créer une option')}</strong>
                        <button type="button" onclick="closeBaseOptionModal()" style="border:none; background:transparent; font-size:20px; cursor:pointer;">×</button>
                    </div>
                    <div style="padding:14px;">
                        ${modalType === 'family' ? `
                            <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Nom famille</label>
                            <input id="base-create-family-name" placeholder="Ex: Console de pilotage" style="width:100%; padding:7px; border:1px solid #ddd; border-radius:4px;">
                        ` : ''}
                        ${modalType === 'subfamily' ? `
                            <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Famille parent</label>
                            <input id="base-create-subfamily-family" value="${escapeHtml(String(state.familyName || ''))}" readonly style="width:100%; padding:7px; border:1px solid #ddd; border-radius:4px; background:#f8f9fa; margin-bottom:8px;">
                            <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Nom sous-famille</label>
                            <input id="base-create-subfamily-name" placeholder="Ex: Couleur" style="width:100%; padding:7px; border:1px solid #ddd; border-radius:4px;">
                        ` : ''}
                        ${modalType === 'option' ? `
                            <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Réf.</label>
                            <input id="base-create-option-ref" placeholder="Référence" style="width:100%; padding:7px; border:1px solid #ddd; border-radius:4px; margin-bottom:8px;">
                            <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Libellé</label>
                            <input id="base-create-option-name" placeholder="Libellé option" style="width:100%; padding:7px; border:1px solid #ddd; border-radius:4px; margin-bottom:8px;">
                            <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Prix produit (optionnel)</label>
                            <input id="base-create-option-price" type="number" step="0.01" min="0" placeholder="0.00" style="width:220px; padding:7px; border:1px solid #ddd; border-radius:4px;">
                        ` : ''}
                        <div style="margin-top:14px; display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" class="btn btn-outline" onclick="closeBaseOptionModal()">Annuler</button>
                            <button type="button" class="btn btn-primary" onclick="submitBaseCreationModal('${modalType}')">Créer</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        function closeBaseOptionModal() {
            document.getElementById('base-option-modal')?.remove();
        }

        async function submitBaseCreationModal(type) {
            try {
                const modalType = String(type || '').trim();
                const state = window.__baseModelCreateState || {};
                if (modalType === 'family') {
                    const name = String(document.getElementById('base-create-family-name')?.value || '').trim();
                    if (!name) return showAlert('Nom famille requis.', 'warning');
                    const list = getFamilleValidatedFamilies();
                    const exists = (Array.isArray(list) ? list : []).some((f) => String(f?.familyLabel || '').trim() === name);
                    if (!exists) {
                        setFamilleValidatedFamilies([...(Array.isArray(list) ? list : []), { familyLabel: name, optionIds: [] }]);
                    }
                    state.familyName = name;
                    state.subFamilyName = '';
                } else if (modalType === 'subfamily') {
                    const family = String(state.familyName || '').trim();
                    const sub = String(document.getElementById('base-create-subfamily-name')?.value || '').trim();
                    if (!family) return showAlert('Sélectionnez une famille.', 'warning');
                    if (!sub) return showAlert('Nom sous-famille requis.', 'warning');
                    const fullLabel = `${family} / ${sub}`;
                    const list = getFamilleValidatedFamilies();
                    const exists = (Array.isArray(list) ? list : []).some((f) => String(f?.familyLabel || '').trim() === fullLabel);
                    if (!exists) {
                        setFamilleValidatedFamilies([...(Array.isArray(list) ? list : []), { familyLabel: fullLabel, optionIds: [] }]);
                    }
                    state.subFamilyName = sub;
                } else if (modalType === 'option') {
                    const importCtx = isImportBaseModelTabRoot(window.__baseModelLastTabRootId);
                    const importChoices = importCtx ? getImportValidatedModelsForBaseTab() : [];
                    let modelId = getGenericBaseTemplateModelId();
                    if (importCtx) {
                        const allowed = new Set(importChoices.map((m) => String(m?.id || '').trim()).filter(Boolean));
                        const pick = String(state.modelId || '').trim();
                        modelId = allowed.has(pick) ? pick : String(importChoices[0]?.id || '').trim();
                    }
                    if (!modelId) return showAlert('Aucun modèle cible pour cette option.', 'warning');
                    const familyName = String(state.familyName || '').trim();
                    const subFamilyName = String(state.subFamilyName || '').trim();
                    if (!familyName) return showAlert('Famille requise.', 'warning');
                    const refUgap = String(document.getElementById('base-create-option-ref')?.value || '').trim();
                    const name = String(document.getElementById('base-create-option-name')?.value || '').trim();
                    const n = Number(String(document.getElementById('base-create-option-price')?.value || '').replace(',', '.'));
                    const baseIncludedPrice = Number.isFinite(n) ? n : 0;
                    if (!name) return showAlert('Libellé option requis.', 'warning');
                    const id = getNextManualBaseOptionId();
                    const categoryId = String(currentData?.categories?.[0]?.id || '').trim();
                    const fullFamilyLabel = subFamilyName ? `${familyName} / ${subFamilyName}` : familyName;
                    await apiCall('/options', {
                        method: 'POST',
                        body: JSON.stringify({
                            categoryId,
                            id,
                            name,
                            refUgap,
                            baseRefUgap: refUgap,
                            compatibleModels: [modelId],
                            familyLabel: fullFamilyLabel,
                            subFamily: subFamilyName,
                            manualBaseOption: true,
                            baseIncludedPrice,
                            priceUgap: baseIncludedPrice
                        })
                    });
                    await loadData(true);
                    state.selectedOptionId = id;
                }
                closeBaseOptionModal();
                rerenderBaseModelTab();
            } catch (error) {
                showAlert('Erreur création: ' + error.message, 'error');
            }
        }

        async function assignBaseOptionToModel() {
            try {
                const importCtx = isImportBaseModelTabRoot(window.__baseModelLastTabRootId);
                const importChoices = importCtx ? getImportValidatedModelsForBaseTab() : [];
                let modelId = getGenericBaseTemplateModelId();
                if (importCtx) {
                    const allowed = new Set(importChoices.map((m) => String(m?.id || '').trim()).filter(Boolean));
                    const pick = String(window.__baseModelCreateState?.modelId || '').trim();
                    modelId = allowed.has(pick) ? pick : String(importChoices[0]?.id || '').trim();
                }
                if (importCtx && (!modelId || modelId === getGenericBaseTemplateModelId())) {
                    showAlert('Choisissez un modèle bateau validé.', 'warning');
                    return;
                }
                const id = String(window.__baseModelCreateState?.selectedOptionId || '').trim();
                const familyName = String(window.__baseModelCreateState?.familyName || '').trim();
                if (!familyName) {
                    showAlert('Choisissez d’abord une famille.', 'warning');
                    return;
                }
                if (!id) {
                    showAlert('Choisissez une option.', 'warning');
                    return;
                }
                const rec = findOptionRecordById(id)?.option || null;
                if (!rec) {
                    showAlert(`Option introuvable (${id}).`, 'error');
                    return;
                }
                const compatible = Array.isArray(rec.compatibleModels) ? rec.compatibleModels.map((x) => String(x)) : [];
                if (!compatible.includes(modelId)) compatible.push(modelId);
                await apiCall(`/options/${encodeURIComponent(id)}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        ...rec,
                        compatibleModels: compatible,
                        baseIncluded: true,
                        priceClient: 0
                    })
                });
                await loadData(true);
                closeBaseOptionModal();
                rerenderBaseModelTab();
                showAlert(importCtx ? `Option "${id}" associée au modèle sélectionné.` : `Option "${id}" associée au template global.`, 'success');
            } catch (error) {
                showAlert('Erreur association option: ' + error.message, 'error');
            }
        }

        function purgeDeletedOptionFromLocalStores(optionId) {
            const id = String(optionId || '').trim();
            if (!id) return;

            // Nettoyage familles validées (optionIds + defaultOptionId)
            const families = getFamilleValidatedFamilies();
            const cleanedFamilies = (Array.isArray(families) ? families : []).map((f) => {
                const optionIds = (Array.isArray(f?.optionIds) ? f.optionIds : [])
                    .map((x) => String(x || '').trim())
                    .filter((x) => x && x !== id);
                const defaultOptionId = String(f?.defaultOptionId || '').trim();
                return {
                    ...f,
                    optionIds,
                    ...(defaultOptionId && defaultOptionId !== id ? { defaultOptionId } : {})
                };
            });
            setFamilleValidatedFamilies(cleanedFamilies);

            const normalizeLegacyOptId = (value) => {
                const v = String(value || '').trim();
                const m = v.match(/^(.*)__\d+$/);
                return m && m[1] ? String(m[1]).trim() : v;
            };
            const splitItem = (value) => {
                const raw = String(value || '').trim();
                const sep = raw.lastIndexOf('::');
                if (sep < 0) return { col: '', opt: '' };
                return {
                    col: raw.slice(0, sep),
                    opt: normalizeLegacyOptId(raw.slice(sep + 2))
                };
            };
            const keepItem = (itemKey) => {
                const parsed = splitItem(itemKey);
                return !!parsed.col && !!parsed.opt && parsed.opt !== id;
            };

            // Nettoyage couplages persistés
            const couplings = getCouplingRules();
            const cleanedCouplings = (Array.isArray(couplings) ? couplings : []).map((cp) => {
                const links = (Array.isArray(cp?.links) ? cp.links : []).map((lnk) => ({
                    ...lnk,
                    masterItems: (Array.isArray(lnk?.masterItems) ? lnk.masterItems : []).filter(keepItem),
                    slaveItems: (Array.isArray(lnk?.slaveItems) ? lnk.slaveItems : []).filter(keepItem),
                    masterLabels: [],
                    slaveLabels: []
                })).filter((lnk) => (lnk.masterItems || []).length > 0 || (lnk.slaveItems || []).length > 0);

                return {
                    ...cp,
                    selectedMasterItems: (Array.isArray(cp?.selectedMasterItems) ? cp.selectedMasterItems : []).filter(keepItem),
                    selectedSlaveItems: (Array.isArray(cp?.selectedSlaveItems) ? cp.selectedSlaveItems : []).filter(keepItem),
                    links
                };
            });
            setCouplingRules(cleanedCouplings);

            // Nettoyage état couplage en mémoire
            if (window.__ugapCouplingColumnState && Array.isArray(window.__ugapCouplingColumnState.couplings)) {
                window.__ugapCouplingColumnState.couplings = cleanedCouplings;
            }

            const autoMap = getOptionsAutoAssignments();
            if (autoMap[id]) {
                delete autoMap[id];
                setOptionsAutoAssignments(autoMap);
            }
        }

        async function removeBaseOptionFromModel(optionId, modelId) {
            try {
                const id = String(optionId || '').trim();
                const model = String(modelId || '').trim();
                if (!id) return;
                const rec = findOptionRecordById(id)?.option || null;
                if (!rec) return;

                if (rec.manualBaseOption) {
                    if (!confirm(`Supprimer définitivement l'option créée "${id}" ?`)) return;
                    await apiCall(`/options/${encodeURIComponent(id)}`, { method: 'DELETE' });
                    purgeDeletedOptionFromLocalStores(id);
                } else {
                    if (!confirm(`Retirer l'option "${id}" du modèle sélectionné ?`)) return;
                    const compatible = (Array.isArray(rec.compatibleModels) ? rec.compatibleModels : []).map((x) => String(x)).filter((x) => x && x !== model);
                    await apiCall(`/options/${encodeURIComponent(id)}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            ...rec,
                            compatibleModels: compatible
                        })
                    });
                }
                await loadData(true);
                rerenderBaseModelTab();
                showAlert(`Option "${id}" supprimée.`, 'success');
            } catch (error) {
                showAlert('Erreur suppression option: ' + error.message, 'error');
            }
        }

        function getBaseLikeOptionsForAiRun() {
            const all = getAllOptionsForSummary();
            const out = [];
            const seen = new Set();
            (all || []).forEach((opt) => {
                const id = String(opt?.id || '').trim();
                if (!id || seen.has(id)) return;
                if (!isHeuristicBaseRelatedOptionLine(opt?.name || '')) return;
                seen.add(id);
                out.push(opt);
            });
            out.sort((a, b) => (a.rowOrder || 0) - (b.rowOrder || 0));
            return out;
        }

        function patchOptionInCurrentData(updatedOption) {
            const id = String(updatedOption?.id || '').trim();
            if (!id || !currentData?.categories) return;
            (currentData.categories || []).forEach((cat) => {
                const idx = (cat.options || []).findIndex((o) => String(o?.id || '').trim() === id);
                if (idx >= 0) {
                    cat.options[idx] = { ...(cat.options[idx] || {}), ...(updatedOption || {}) };
                }
            });
        }

        function updateBaseOptionsAiProgressUi() {
            const run = window.__baseOptionsAiRun || null;
            const box = document.getElementById('base-options-ai-progress');
            const btn = document.getElementById('btn-base-options-complete-ia');
            if (!box || !btn) return;
            if (!run || !run.running) {
                box.style.display = 'none';
                btn.disabled = false;
                btn.textContent = "Compléter avec l'IA";
                return;
            }
            box.style.display = 'block';
            const i = Number(run.processed || 0);
            const total = Number(run.total || 0);
            const currentLabel = String(run.currentLabel || '').trim();
            box.innerHTML = `⏳ Traitement IA en cours... <strong>${i}/${total}</strong><br><span style="font-size:12px; color:#0b5ed7;">Ligne: ${escapeHtml(currentLabel || '...')}</span>`;
            btn.disabled = true;
            btn.textContent = `⏳ Traitement IA en cours... ${i}/${total}`;
        }

        function formatBaseConfidence(confidenceValue) {
            const n = Number(confidenceValue);
            if (!Number.isFinite(n)) return '—';
            const pct = Math.max(0, Math.min(100, Math.round(n * 100)));
            return `${pct}%`;
        }

        function getOptionFamilyParts(optionFamilyKey) {
            const parts = String(optionFamilyKey || '').split('|');
            return {
                baseReplaced: String(parts[0] || '').trim().toLowerCase(),
                postesKey: String(parts[1] || '').trim(),
                skeleton: String(parts[2] || '').trim().toLowerCase()
            };
        }

        function buildSuspectIncoherenceSetForModelRows(rows) {
            const bySlot = new Map();
            (rows || []).forEach((r) => {
                const fp = getOptionFamilyParts(r.optionFamilyKey || '');
                if (!fp.skeleton) return;
                const slotKey = `${fp.skeleton}|${fp.postesKey || ''}`;
                if (!bySlot.has(slotKey)) bySlot.set(slotKey, new Set());
                if (fp.baseReplaced) bySlot.get(slotKey).add(fp.baseReplaced);
            });
            const suspectSlots = new Set(
                [...bySlot.entries()]
                    .filter(([, bases]) => bases.size > 1)
                    .map(([k]) => k)
            );
            const out = new Set();
            (rows || []).forEach((r) => {
                const fp = getOptionFamilyParts(r.optionFamilyKey || '');
                const slotKey = `${fp.skeleton}|${fp.postesKey || ''}`;
                if (fp.skeleton && suspectSlots.has(slotKey)) out.add(String(r.id || '').trim());
            });
            return out;
        }

        async function removeBaseOptionForModel(optionId, modelId) {
            try {
                const rec = findOptionRecordById(optionId);
                if (!rec || !rec.option) {
                    showAlert(`Option introuvable (${optionId})`, 'error');
                    return;
                }
                const option = rec.option;
                const allModelIds = (currentData?.models || []).map((m) => m.id);
                const currentCompatible = Array.isArray(option.compatibleModels) ? [...option.compatibleModels] : [];
                let nextCompatible;
                if (currentCompatible.length === 0) {
                    nextCompatible = allModelIds.filter((id) => id !== modelId);
                } else {
                    nextCompatible = currentCompatible.filter((id) => id !== modelId);
                }
                const payload = { ...option, compatibleModels: nextCompatible };
                await apiCall(`/options/${encodeURIComponent(optionId)}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                option.compatibleModels = nextCompatible;
                renderExtractionInsights();
                showAlert('Ligne retirée de ce modèle', 'success');
            } catch (error) {
                showAlert('Erreur suppression incohérence: ' + error.message, 'error');
            }
        }

        function getBaseIncoherenceValidatedMap() {
            try {
                const raw = memoryStoreGetItem('ugap.base.incoherence.validated');
                const parsed = raw ? JSON.parse(raw) : {};
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (_) {
                return {};
            }
        }

        function setBaseIncoherenceValidatedMap(mapObj) {
            try {
                memoryStoreSetItem('ugap.base.incoherence.validated', JSON.stringify(mapObj || {}));
            } catch (_) {
                // no-op
            }
        }

        function getIncoherenceValidationKey(modelId, optionId) {
            return `${String(modelId || '').trim()}::${String(optionId || '').trim()}`;
        }

        function isBaseIncoherenceValidated(modelId, optionId) {
            const map = getBaseIncoherenceValidatedMap();
            return !!map[getIncoherenceValidationKey(modelId, optionId)];
        }

        function validateBaseIncoherenceForModel(optionId, modelId) {
            const key = getIncoherenceValidationKey(modelId, optionId);
            const map = getBaseIncoherenceValidatedMap();
            map[key] = true;
            setBaseIncoherenceValidatedMap(map);
            renderExtractionInsights();
            showAlert('Incohérence validée (ligne conservée)', 'success');
        }

        function getBaseIncoherenceFilterMode() {
            try {
                const v = memoryStoreGetItem('ugap.base.incoherence.filterMode');
                return v === 'only' ? 'only' : 'all';
            } catch (_) {
                return 'all';
            }
        }

        function onChangeBaseIncoherenceFilter(mode) {
            try {
                memoryStoreSetItem('ugap.base.incoherence.filterMode', mode === 'only' ? 'only' : 'all');
            } catch (_) {
                // no-op
            }
            renderExtractionInsights();
        }

        async function saveBaseModelOption(optionId) {
            try {
                const id = String(optionId || '').trim();
                if (!id) return;
                const rec = findOptionRecordById(id);
                if (!rec || !rec.option) {
                    showAlert(`Option introuvable (${id})`, 'error');
                    return;
                }

                const initialInput = document.getElementById(`base-initial-${id}`);
                const finalInput = document.getElementById(`base-final-${id}`);
                const baseRefInput = document.getElementById(`base-ref-${id}`);
                const includedInput = document.getElementById(`base-included-${id}`);
                const priceInput = document.getElementById(`base-price-${id}`);
                const initialProduct = String(initialInput?.value || '').trim();
                const finalProduct = String(finalInput?.value || '').trim();
                const baseRefUgap = String(baseRefInput?.value || '').trim();
                const baseIncluded = !!includedInput?.checked;
                const parsedBasePrice = Number(String(priceInput?.value || '').replace(',', '.'));
                const baseIncludedPrice = Number.isFinite(parsedBasePrice) ? parsedBasePrice : 0;

                const payload = {
                    ...rec.option,
                    initialProduct,
                    finalProduct,
                    baseRefUgap,
                    baseIncluded,
                    baseIncludedPrice,
                    // Règle métier: une option fournie de base reste à 0€ côté client.
                    priceClient: baseIncluded ? 0 : rec.option?.priceClient
                };
                await apiCall(`/options/${encodeURIComponent(id)}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });

                rec.option.initialProduct = initialProduct;
                rec.option.finalProduct = finalProduct;
                rec.option.baseRefUgap = baseRefUgap;
                rec.option.baseIncluded = baseIncluded;
                rec.option.baseIncludedPrice = baseIncludedPrice;
                if (baseIncluded) rec.option.priceClient = 0;
                const activeTab = document.querySelector('.tab.active')?.getAttribute('data-tab') || 'famille';
                renderActiveTab(activeTab);
                showAlert('Valeurs enregistrées', 'success');
            } catch (error) {
                showAlert('Erreur enregistrement modèle de base: ' + error.message, 'error');
            }
        }

        async function saveBaseProducts(optionId) {
            return saveBaseModelOption(optionId);
        }

        async function runBaseOptionsAiCompletion() {
            try {
                const lines = getBaseLikeOptionsForAiRun();
                if (!lines.length) {
                    showAlert("Aucune ligne d'option de base à traiter.", 'info');
                    return;
                }
                window.__baseOptionsAiRun = {
                    running: true,
                    processed: 0,
                    total: lines.length,
                    currentId: '',
                    currentLabel: ''
                };
                renderExtractionInsights();
                updateBaseOptionsAiProgressUi();

                let enriched = 0;
                for (let idx = 0; idx < lines.length; idx += 1) {
                    const line = lines[idx];
                    window.__baseOptionsAiRun.processed = idx;
                    window.__baseOptionsAiRun.currentId = String(line?.id || '');
                    window.__baseOptionsAiRun.currentLabel = `${line?.id || ''} — ${line?.name || ''}`;
                    updateBaseOptionsAiProgressUi();

                    const result = await apiCall('/base-options/complete-ia-line', {
                        method: 'POST',
                        body: JSON.stringify({ optionId: line.id })
                    });
                    console.log('[UGAP][BASE-OPTIONS][FRONT][LINE-RESULT]', {
                        optionId: line.id,
                        label: line?.name || '',
                        result: result?.data || null
                    });
                    if (result?.data?.updatedOption) {
                        patchOptionInCurrentData(result.data.updatedOption);
                    }
                    if (result?.data?.accepted) enriched += 1;

                    window.__baseOptionsAiRun.processed = idx + 1;
                    updateBaseOptionsAiProgressUi();
                    renderExtractionInsights();
                }

                showAlert(`Complétion terminée: ${enriched}/${lines.length} lignes enrichies.`, 'success');
            } catch (error) {
                showAlert('Erreur complétion IA options de base: ' + error.message, 'error');
            } finally {
                window.__baseOptionsAiRun = null;
                renderExtractionInsights();
                updateBaseOptionsAiProgressUi();
            }
        }

        function buildViewOptionsHtml(selectedViewLabel) {
            const rules = getViewHeuristicRules();
            const labels = Array.from(new Set(
                (Array.isArray(rules) ? rules : [])
                    .map((r) => String(r?.viewLabel || '').trim())
                    .filter(Boolean)
            ));
            const selected = String(selectedViewLabel || '').trim();
            return labels.map((label) => {
                const isSelected = selected === label ? 'selected' : '';
                return `<option value="${escapeHtml(label)}" ${isSelected}>${escapeHtml(label)}</option>`;
            }).join('');
        }

        function getSelectedFamilyLabelForOption(optionId, fallbackLabel) {
            const wanted = String(optionId || '').trim();
            const list = getFamilleValidatedFamilies();
            const row = (Array.isArray(list) ? list : []).find((f) => {
                const ids = Array.isArray(f?.optionIds) ? f.optionIds.map((x) => String(x)) : [];
                return ids.includes(wanted);
            });
            if (row && String(row.familyLabel || '').trim()) return String(row.familyLabel || '').trim();
            return String(fallbackLabel || '').trim();
        }

        function assignOptionToValidatedFamily(optionId, familyLabel) {
            const wanted = String(optionId || '').trim();
            const targetLabel = String(familyLabel || '').trim();
            const list = getFamilleValidatedFamilies();
            const cleaned = (Array.isArray(list) ? list : []).map((f) => {
                const ids = Array.isArray(f?.optionIds) ? f.optionIds.map((x) => String(x)).filter((x) => x && x !== wanted) : [];
                return { ...f, optionIds: ids };
            });
            if (!targetLabel) {
                setFamilleValidatedFamilies(cleaned);
                return;
            }
            const idx = cleaned.findIndex((f) => String(f?.familyLabel || '').trim() === targetLabel);
            if (idx < 0) {
                setFamilleValidatedFamilies(cleaned);
                return;
            }
            const ids = Array.isArray(cleaned[idx].optionIds) ? cleaned[idx].optionIds.slice() : [];
            if (!ids.includes(wanted)) ids.push(wanted);
            cleaned[idx].optionIds = ids;
            setFamilleValidatedFamilies(cleaned);
        }

        function clearValidatedFamilyAssignments() {
            const list = getFamilleValidatedFamilies();
            const cleaned = (Array.isArray(list) ? list : []).map((f) => ({
                ...f,
                optionIds: []
            }));
            setFamilleValidatedFamilies(cleaned);
        }

        function buildFamilyOptionsHtml(viewLabel, selectedFamilyLabel) {
            const selectedViewLabel = String(viewLabel || '').trim();
            const selectedLabel = String(selectedFamilyLabel || '').trim();
            const allFamilies = getFamilleValidatedFamilies();
            const filtered = (Array.isArray(allFamilies) ? allFamilies : []).filter((f) => {
                const byLabel = String(f?.businessViewLabel || '').trim();
                return !selectedViewLabel || !byLabel || byLabel === selectedViewLabel;
            });
            const labels = Array.from(new Set(filtered.map((f) => String(f?.familyLabel || '').trim()).filter(Boolean)));
            const noneSelected = !selectedLabel ? 'selected' : '';
            return [
                `<option value="" ${noneSelected}>-- Aucune --</option>`,
                ...labels.map((label) => {
                    const selected = selectedLabel === label ? 'selected' : '';
                    return `<option value="${escapeHtml(label)}" ${selected}>${escapeHtml(label)}</option>`;
                })
            ].join('');
        }

        function onExtractionViewChange(optionId) {
            const viewSel = document.getElementById(`ext-view-${optionId}`);
            const famSel = document.getElementById(`ext-family-${optionId}`);
            if (!viewSel || !famSel) return;
            famSel.innerHTML = buildFamilyOptionsHtml(viewSel.value, '');
        }

        async function saveExtractionRow(optionId) {
            const record = findOptionRecordById(optionId);
            if (!record) {
                showAlert('Option introuvable', 'error');
                return;
            }
            const nameInput = document.getElementById(`ext-name-${optionId}`);
            const refInput = document.getElementById(`ext-ref-${optionId}`);
            const pcInput = document.getElementById(`ext-pc-${optionId}`);
            const puInput = document.getElementById(`ext-pu-${optionId}`);

            const parseNumOrNull = (v) => {
                const s = String(v ?? '').trim().replace(',', '.');
                if (!s) return null;
                const n = Number(s);
                return Number.isFinite(n) ? n : null;
            };

            const mergedOption = {
                ...(record.option || {}),
                name: String(nameInput?.value || record.option?.name || '').trim(),
                refUgap: String(refInput?.value || '').trim(),
                priceClient: parseNumOrNull(pcInput?.value),
                priceUgap: parseNumOrNull(puInput?.value),
                isDivers: extractionActiveSubtab === 'divers'
                    ? true
                    : (extractionActiveSubtab === 'option' ? false : !!record.option?.isDivers),
                category: String(record.option?.category || record.category?.name || '')
            };

            try {
                await apiCall(`/options/${optionId}`, {
                    method: 'PUT',
                    body: JSON.stringify(mergedOption)
                });

                await loadData(true);
                renderExtractionInsights();
                showAlert('Ligne enregistrée', 'success');
            } catch (error) {
                showAlert('Erreur enregistrement ligne: ' + error.message, 'error');
            }
        }

        function renderEditableExtractionRows(options, emptyLabel) {
            if (!Array.isArray(options) || options.length === 0) {
                return `<tr><td colspan="5" style="padding:10px; color:#666; text-align:center;">${escapeHtml(emptyLabel || 'Aucune donnée')}</td></tr>`;
            }
            return options.map((opt) => {
                const optionId = String(opt?.id || '').trim();
                const record = findOptionRecordById(optionId);
                if (!record) return '';
                return `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #eee;">
                            <input id="ext-name-${optionId}" value="${escapeHtml(opt?.name || '')}" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;">
                        </td>
                        <td style="padding:8px; border-bottom:1px solid #eee;"><input id="ext-pc-${optionId}" value="${escapeHtml(opt?.priceClient ?? '')}" style="width:110px; padding:6px; border:1px solid #ddd; border-radius:4px;"></td>
                        <td style="padding:8px; border-bottom:1px solid #eee;"><input id="ext-pu-${optionId}" value="${escapeHtml(opt?.priceUgap ?? '')}" style="width:110px; padding:6px; border:1px solid #ddd; border-radius:4px;"></td>
                        <td style="padding:8px; border-bottom:1px solid #eee;"><input id="ext-ref-${optionId}" value="${escapeHtml(opt?.refUgap || '')}" style="width:130px; padding:6px; border:1px solid #ddd; border-radius:4px;"></td>
                        <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                            <button class="btn btn-outline" onclick="saveExtractionRow('${optionId}')">Enregistrer</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Compatibilité: certains écrans de synthèse utilisent encore un rendu simple à 2 colonnes.
        function renderOptionRows(options, emptyLabel) {
            if (!Array.isArray(options) || options.length === 0) {
                return `<tr><td colspan="2" style="padding:10px; color:#666; text-align:center;">${escapeHtml(emptyLabel || 'Aucune donnée')}</td></tr>`;
            }
            return options.map(opt => `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(opt?.name || '-')}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">${escapeHtml(opt?.refUgap || '-')}</td>
                </tr>
            `).join('');
        }

        function formatPriceUgapCell(v) {
            if (v == null || v === '' || (typeof v === 'number' && Number.isNaN(v))) return '—';
            const n = Number(v);
            if (Number.isNaN(n)) return '—';
            return escapeHtml(n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
        }

        /** Rendu des cartes familles renvoyées par l’IA (optionIds → lignes affichables). */
        function renderFamilleIaGroupCards(iaData, byId) {
            if (!iaData || !Array.isArray(iaData.families) || iaData.families.length === 0) {
                return '<p style="color:#666;">Aucune famille dans la réponse IA.</p>';
            }
            return iaData.families.map((f) => {
                const label = f.familyLabel || 'Famille';
                const ids = Array.isArray(f.optionIds) ? f.optionIds : [];
                const lockBadge = isFamNameOptionsLocked(f)
                    ? '<span style="display:inline-block; padding:2px 8px; border-radius:999px; background:#fff3cd; color:#856404; font-size:10px; font-weight:700; border:1px solid #ffe69c;">Verrouillée</span>'
                    : '';
                const defId = f.defaultOptionId != null && String(f.defaultOptionId).trim() !== '' ? String(f.defaultOptionId).trim() : null;
                const rows = ids.map((id) => byId.get(id)).filter(Boolean);
                const dupBadge = rows.length > 1
                    ? `<span style="margin-left:8px; padding:2px 8px; border-radius:4px; font-size:12px; background:#d1e7dd; color:#0f5132;">${rows.length} lignes</span>`
                    : '';
                const defaultBadge = defId && ids.includes(defId)
                    ? `<span style="margin-left:8px; padding:2px 8px; border-radius:4px; font-size:12px; background:#fff3cd; color:#664d03; border:1px solid #ffecb5;">Option par défaut : ${escapeHtml(defId)}</span>`
                    : '';
                const rowsHtml = rows.map((row) => {
                    const isDefault = defId && row.id === defId;
                    const defMark = isDefault ? ' <span style="font-size:11px; color:#664d03;">(défaut)</span>' : '';
                    return `
                        <tr>
                            <td style="padding:8px; border-bottom:1px solid #eee; white-space:nowrap;">
                                <span style="display:inline-block; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600; color:#fff; background:${row.lineKind === 'mino' ? '#6f42c1' : '#0d6efd'};">${escapeHtml(row.lineKindLabel)}</span>
                            </td>
                            <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(row.name || '—')}${defMark}</td>
                            <td style="padding:8px; border-bottom:1px solid #eee; color:#666;">${escapeHtml(row.categoryName || '—')}</td>
                            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${formatPriceUgapCell(row.priceClient)}</td>
                            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${formatPriceUgapCell(row.priceUgap)}</td>
                            <td style="padding:8px; border-bottom:1px solid #eee; color:#666; font-size:12px;">${escapeHtml(row.refUgap || '—')}</td>
                        </tr>
                    `;
                }).join('');
                return `
                        <div style="margin-bottom:14px; border:1px solid #0d6efd; border-radius:8px; overflow:hidden;">
                            <div style="background:#e7f1ff; padding:10px 12px; border-bottom:1px solid #b6d4fe;">
                                <span style="font-weight:600; color:#084298;">${escapeHtml(label)}</span>
                                ${dupBadge}
                                ${defaultBadge}
                            </div>
                            <table style="width:100%; border-collapse:collapse;">
                                <thead>
                                    <tr style="background:#fff;">
                                        <th style="padding:8px; border-bottom:1px solid #eee; text-align:left; font-size:12px;">Type</th>
                                        <th style="padding:8px; border-bottom:1px solid #eee; text-align:left; font-size:12px;">Libellé</th>
                                        <th style="padding:8px; border-bottom:1px solid #eee; text-align:left; font-size:12px;">Catégorie</th>
                                        <th style="padding:8px; border-bottom:1px solid #eee; text-align:right; font-size:12px;">Prix client</th>
                                        <th style="padding:8px; border-bottom:1px solid #eee; text-align:right; font-size:12px;">Prix UGAP</th>
                                        <th style="padding:8px; border-bottom:1px solid #eee; text-align:left; font-size:12px;">Réf.</th>
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                            </table>
                        </div>
                    `;
            }).join('');
        }

        /** Options « standard » + minorations / MV / PV dans l’ordre des lignes Excel (pour onglet Famille). */
        function buildFamilleCombinedRows(splitOptions) {
            const rows = [];
            (splitOptions.regularOptions || []).forEach((o) => {
                rows.push({ ...o, lineKind: 'option', lineKindLabel: 'Option' });
            });
            (splitOptions.minorationOptions || []).forEach((o) => {
                rows.push({ ...o, lineKind: 'mino', lineKindLabel: 'Minoration / MV / PV' });
            });
            rows.sort((a, b) => (a.rowOrder || 0) - (b.rowOrder || 0));
            return rows;
        }

        function buildFamilleModalByIdMap() {
            const all = getAllOptionsForSummary();
            const split = splitModelOptionsByType(all);
            const minoIds = new Set((split.minorationOptions || []).map((o) => String(o.id || '').trim()));
            const prIds = new Set((split.prOptions || []).map((o) => String(o.id || '').trim()));
            const rows = (all || []).map((o) => {
                const id = String(o?.id || '').trim();
                let lineKindLabel = 'Option';
                if (prIds.has(id)) lineKindLabel = 'PR';
                else if (minoIds.has(id)) lineKindLabel = 'Minoration / MV / PV';
                return { ...o, id, lineKindLabel };
            });
            return new Map(rows.map((r) => [r.id, r]));
        }

        function getFamilleChoicesForOptionTab() {
            const families = getFamilleValidatedFamilies();
            return Array.from(new Set(
                (Array.isArray(families) ? families : [])
                    .map((f) => {
                        const full = String(f?.familyLabel || '').trim();
                        if (!full) return '';
                        const parts = full.split(' / ').map((x) => String(x || '').trim()).filter(Boolean);
                        return parts.length ? parts[0] : full;
                    })
                    .filter(Boolean)
            )).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
        }

        function getFamilleSubFamilyMapForOptionTab() {
            const families = getFamilleValidatedFamilies();
            const byParent = new Map();
            (Array.isArray(families) ? families : []).forEach((f) => {
                const full = String(f?.familyLabel || '').trim();
                if (!full) return;
                const parts = full.split(' / ').map((x) => String(x || '').trim()).filter(Boolean);
                if (parts.length < 2) return;
                const parent = parts[0];
                const subPath = parts.slice(1).join(' / ');
                if (!parent || !subPath) return;
                if (!byParent.has(parent)) byParent.set(parent, new Set());
                byParent.get(parent).add(subPath);
            });
            const out = new Map();
            byParent.forEach((setVals, parent) => {
                out.set(parent, Array.from(setVals).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })));
            });
            return out;
        }

        function getFamilleValidatedFamilies() {
            return Array.isArray(currentData?.uiState?.families)
                ? currentData.uiState.families
                : [];
        }

        function setFamilleValidatedFamilies(families) {
            try {
                const next = Array.isArray(families) ? families : [];
                if (!currentData || typeof currentData !== 'object') currentData = {};
                if (!currentData.uiState || typeof currentData.uiState !== 'object') currentData.uiState = {};
                currentData.uiState.families = next;
                memoryStoreSetItem('ugap.famille.validatedFamilies', JSON.stringify(next));
                scheduleUiStatePersistence();
            } catch (_) {
                // no-op
            }
        }

        function mergeFamiliesUnique(baseFamilies, extraFamilies) {
            const assigned = new Set();
            const out = [];
            const pushFamily = (f) => {
                const label = String(f?.familyLabel || 'Famille').trim() || 'Famille';
                const ids = (Array.isArray(f?.optionIds) ? f.optionIds : [])
                    .map((id) => String(id || '').trim())
                    .filter((id) => id && !assigned.has(id));
                if (ids.length === 0) return;
                ids.forEach((id) => assigned.add(id));
                const entry = { familyLabel: label, optionIds: ids };
                const def = String(f?.defaultOptionId || '').trim();
                if (def && ids.includes(def)) entry.defaultOptionId = def;
                out.push(entry);
            };
            (Array.isArray(baseFamilies) ? baseFamilies : []).forEach(pushFamily);
            (Array.isArray(extraFamilies) ? extraFamilies : []).forEach(pushFamily);
            return out;
        }

        function buildOptionNameIndexFromCurrentData() {
            const out = new Map();
            try {
                const rows = getAllOptionsForSummary();
                (Array.isArray(rows) ? rows : []).forEach((r) => {
                    const id = String(r?.id || '').trim();
                    const name = String(r?.name || r?.label || r?.title || '').trim();
                    if (id && name && !out.has(id)) out.set(id, name);
                });
            } catch (_) {
                // no-op
            }
            const categories = Array.isArray(currentData?.categories) ? currentData.categories : [];
            categories.forEach((cat) => {
                const opts = Array.isArray(cat?.options) ? cat.options : [];
                opts.forEach((o) => {
                    const id = String(o?.id || '').trim();
                    const name = String(o?.name || o?.label || o?.title || '').trim();
                    if (id && name && !out.has(id)) out.set(id, name);
                });
            });
            return out;
        }

        function buildSavedFamiliesFromReview(editFamilies) {
            const nameIndex = buildOptionNameIndexFromCurrentData();
            const viewNameById = new Map(
                getBusinessViewsForAssignationTab()
                    .map((v) => [String(v?.id || '').trim(), String(v?.label || '').trim()])
                    .filter(([id]) => !!id)
            );
            return mergeFamiliesUnique([], (Array.isArray(editFamilies) ? editFamilies : []).map((f) => {
                const selected = Array.isArray(f.selectedOptionIds) ? f.selectedOptionIds : [];
                const labelBase = String(f.familyLabel || 'Famille').trim() || 'Famille';
                const sub = String(f.subFamilyLabel || '').trim();
                const label = sub ? `${labelBase} / ${sub}` : labelBase;
                const optionLabels = {};
                selected.forEach((id) => {
                    const sid = String(id || '').trim();
                    if (!sid) return;
                    const nm = nameIndex.get(sid) || '';
                    if (nm) optionLabels[sid] = nm;
                });
                return {
                    familyLabel: label,
                    optionIds: selected,
                    optionLabels,
                    defaultOptionId: f.defaultOptionId,
                    uniqueChoice: !!f.uniqueChoice,
                    businessViewId: String(f.businessViewId || '').trim(),
                    businessViewLabel: viewNameById.get(String(f.businessViewId || '').trim()) || ''
                };
            }));
        }

        function makeReviewFamilies(heuristicFamilies, aiFamilies) {
            let seq = 1;
            const mk = (f, source) => {
                const ids = (Array.isArray(f?.optionIds) ? f.optionIds : []).map((x) => String(x || '').trim()).filter(Boolean);
                return {
                    reviewId: `rf_${source}_${seq++}`,
                    source,
                    column: '',
                    parentReviewId: null,
                    familyLabel: String(f?.familyLabel || 'Famille').trim() || 'Famille',
                    subFamilyLabel: String(f?.subFamilyLabel || '').trim(),
                    optionIds: ids.slice(),
                    selectedOptionIds: ids.slice(),
                    defaultOptionId: String(f?.defaultOptionId || '').trim() || (ids[0] || ''),
                    uniqueChoice: !!f?.uniqueChoice
                };
            };
            return [
                ...(Array.isArray(heuristicFamilies) ? heuristicFamilies : []).map((f) => mk(f, 'heur')),
                ...(Array.isArray(aiFamilies) ? aiFamilies : []).map((f) => mk(f, 'ia'))
            ];
        }

        function syncReviewStateIntoIaResult() {
            const review = window.__ugapFamilleReview || null;
            if (!review || !Array.isArray(review.editFamilies)) return;
            const merged = [];
            const seen = new Set();
            review.editFamilies.forEach((f) => {
                const selected = (Array.isArray(f.selectedOptionIds) ? f.selectedOptionIds : [])
                    .map((x) => String(x || '').trim())
                    .filter((id) => id && !seen.has(id));
                if (selected.length === 0) return;
                selected.forEach((id) => seen.add(id));
                const labelBase = String(f.familyLabel || 'Famille').trim() || 'Famille';
                const sub = String(f.subFamilyLabel || '').trim();
                const label = sub ? `${labelBase} / ${sub}` : labelBase;
                const entry = { familyLabel: label, optionIds: selected };
                const def = String(f.defaultOptionId || '').trim();
                if (def && selected.includes(def)) entry.defaultOptionId = def;
                entry.uniqueChoice = !!f.uniqueChoice;
                merged.push(entry);
            });
            window.__ugapFamilleIa = { families: merged };
        }

        function getFamilleUiState() {
            if (!window.__ugapFamilleUiState) {
                window.__ugapFamilleUiState = {
                    hiddenIds: []
                };
            }
            return window.__ugapFamilleUiState;
        }

        function getFamilleValidatedFilterState() {
            if (!window.__ugapFamilleValidatedFilter) {
                window.__ugapFamilleValidatedFilter = {
                    businessViewId: '',
                    showNonAssigned: true,
                    familyName: '',
                    subFamilyName: ''
                };
            }
            return window.__ugapFamilleValidatedFilter;
        }

        function getFamilleRawListFilterState() {
            if (!window.__ugapFamilleRawFilter) {
                window.__ugapFamilleRawFilter = {
                    search: '',
                    onlyUnassigned: false
                };
            }
            return window.__ugapFamilleRawFilter;
        }

        function parseValidatedFamilyLabel(rawLabel) {
            const fullLabel = String(rawLabel || '').trim();
            if (!fullLabel) {
                return { fullLabel: '', familyName: '', subFamilyName: '' };
            }
            const parts = fullLabel
                .split('/')
                .map((p) => String(p || '').trim())
                .filter(Boolean);
            if (parts.length <= 1) {
                return { fullLabel, familyName: fullLabel, subFamilyName: '' };
            }
            return {
                fullLabel,
                familyName: parts[0],
                subFamilyName: parts.slice(1).join(' / ')
            };
        }

        function getFamilyLabelAncestors(label) {
            const parts = String(label || '')
                .split('/')
                .map((p) => String(p || '').trim())
                .filter(Boolean);
            if (parts.length <= 1) return [];
            const ancestors = [];
            for (let i = 1; i < parts.length; i += 1) {
                ancestors.push(parts.slice(0, i).join(' / '));
            }
            return ancestors;
        }

        function ensureNonAttribueeFamily(reviewState) {
            if (!reviewState || !Array.isArray(reviewState.editFamilies)) return null;
            let fam = reviewState.editFamilies.find((f) => String(f.familyLabel || '').toLowerCase() === 'non attribuée');
            if (!fam) {
                fam = {
                    reviewId: `rf_manual_non_attrib_${Date.now()}`,
                    source: 'manual',
                    column: 'heur',
                    parentReviewId: null,
                    familyLabel: 'Non attribuée',
                    subFamilyLabel: '',
                    optionIds: [],
                    selectedOptionIds: [],
                    defaultOptionId: ''
                };
                reviewState.editFamilies.push(fam);
            }
            return fam;
        }

        function ensureReviewFamilyFromSavedIndex(savedIndex) {
            const idx = Number(savedIndex);
            if (!Number.isInteger(idx) || idx < 0) return null;
            const saved = getFamilleValidatedFamilies();
            const entry = saved[idx];
            if (!entry) return null;
            if (!window.__ugapFamilleReview || !Array.isArray(window.__ugapFamilleReview.editFamilies)) {
                window.__ugapFamilleReview = { heuristicFamilies: [], aiFamilies: [], editFamilies: [] };
            }
            const review = window.__ugapFamilleReview;
            const ids = (Array.isArray(entry.optionIds) ? entry.optionIds : []).map((x) => String(x || '').trim()).filter(Boolean);
            let fam = review.editFamilies.find((f) => {
                const sameLabel = String(f.familyLabel || '').trim() === String(entry.familyLabel || '').trim();
                const famIds = new Set((Array.isArray(f.optionIds) ? f.optionIds : []).map((x) => String(x || '').trim()));
                const sameIds = ids.length === famIds.size && ids.every((id) => famIds.has(id));
                return sameLabel && sameIds;
            });
            const fromSavedLabels = entry.optionLabels && typeof entry.optionLabels === 'object' ? entry.optionLabels : {};
            const rebuiltLabels = {};
            ids.forEach((id) => {
                const sid = String(id || '').trim();
                const saved = String(fromSavedLabels[sid] || '').trim();
                const live = getOptionLabelById(sid);
                if (saved || live) rebuiltLabels[sid] = saved || live;
            });
            if (!fam) {
                fam = {
                    reviewId: `rf_saved_${Date.now()}_${idx}`,
                    source: 'saved',
                    column: 'heur',
                    parentReviewId: null,
                    familyLabel: String(entry.familyLabel || 'Famille').trim() || 'Famille',
                    subFamilyLabel: '',
                    optionIds: ids.slice(),
                    selectedOptionIds: ids.slice(),
                    defaultOptionId: String(entry.defaultOptionId || '').trim() || (ids[0] || ''),
                    uniqueChoice: !!entry.uniqueChoice,
                    optionLabels: rebuiltLabels,
                    businessViewId: String(entry.businessViewId || '').trim(),
                    businessViewIds: String(entry.businessViewId || '').trim() ? [String(entry.businessViewId || '').trim()] : []
                };
                review.editFamilies.push(fam);
            } else if (!fam.optionLabels || Object.keys(fam.optionLabels).length === 0) {
                fam.optionLabels = rebuiltLabels;
            }
            return fam;
        }

        function getOptionLabelById(optionId) {
            const wanted = String(optionId || '').trim();
            if (!wanted) return '';
            try {
                const raw = memoryStoreGetItem('ugap.famille.optionLabelCache');
                const parsed = raw ? JSON.parse(raw) : {};
                const cached = parsed && typeof parsed === 'object' ? String(parsed[wanted] || '').trim() : '';
                if (cached) return cached;
            } catch (_) {
                // no-op
            }
            try {
                const all = getAllOptionsForSummary();
                const row = (Array.isArray(all) ? all : []).find((o) => String(o?.id || '').trim() === wanted);
                if (row) {
                    return String(row.name || row.label || row.title || '').trim();
                }
            } catch (_) {
                // no-op
            }
            const categories = Array.isArray(currentData?.categories) ? currentData.categories : [];
            for (const cat of categories) {
                const opts = Array.isArray(cat?.options) ? cat.options : [];
                const found = opts.find((o) => String(o?.id || '').trim() === wanted);
                if (found) {
                    return String(found.name || found.label || found.title || '').trim();
                }
            }
            return '';
        }

        function normalizeOptionIdForMatch(value) {
            const s = String(value || '').trim().toLowerCase();
            if (!s) return '';
            const numMatch = s.match(/(\d+)/g);
            const lastNum = numMatch && numMatch.length ? numMatch[numMatch.length - 1] : '';
            const soft = s.replace(/[^a-z0-9]/g, '');
            return `${soft}::${lastNum}`;
        }

        function resolveOptionRowById(byId, optionId) {
            if (!byId || !(byId instanceof Map)) return null;
            const raw = String(optionId || '');
            const trimmed = raw.trim();
            if (!trimmed) return null;

            // 1) Match direct.
            let row = byId.get(raw) || byId.get(trimmed);
            if (row) return row;

            // 2) Match normalisé (préfixes/punctuations différents: opt_116 / option-116 / 116).
            const wantedNorm = normalizeOptionIdForMatch(trimmed);
            const wantedNum = wantedNorm.split('::')[1] || '';
            const values = Array.from(byId.values());
            const normMatches = values.filter((r) => normalizeOptionIdForMatch(r?.id) === wantedNorm);
            if (normMatches.length === 1) return normMatches[0];

            // 3) Fallback numérique: même suffixe numérique si unique.
            if (wantedNum) {
                const numMatches = values.filter((r) => {
                    const n = normalizeOptionIdForMatch(r?.id).split('::')[1] || '';
                    return n && n === wantedNum;
                });
                if (numMatches.length === 1) return numMatches[0];
            }

            return null;
        }

        function upsertFamilleOptionLabelCache(entries) {
            try {
                const raw = memoryStoreGetItem('ugap.famille.optionLabelCache');
                const parsed = raw ? JSON.parse(raw) : {};
                const cache = parsed && typeof parsed === 'object' ? parsed : {};
                (Array.isArray(entries) ? entries : []).forEach((e) => {
                    const id = String(e?.id || '').trim();
                    const name = String(e?.name || '').trim();
                    if (id && name) cache[id] = name;
                });
                memoryStoreSetItem('ugap.famille.optionLabelCache', JSON.stringify(cache));
            } catch (_) {
                // no-op
            }
        }

        function isFamNameOptionsLocked(fam) {
            return !!(fam && fam.nameOptionsLocked === true);
        }

        /** Fusionne la famille source dans la cible (options + sélections ; la source est retirée). */
        function mergeEditFamilies(sourceReviewId, targetReviewId) {
            const state = window.__ugapFamilleReview;
            if (!state || !Array.isArray(state.editFamilies)) return false;
            const sid = String(sourceReviewId || '').trim();
            const tid = String(targetReviewId || '').trim();
            if (!sid || !tid || sid === tid) return false;
            const fams = state.editFamilies;
            const src = fams.find((x) => x.reviewId === sid);
            const tgt = fams.find((x) => x.reviewId === tid);
            if (!src || !tgt) return false;

            const uniq = (arr) => Array.from(new Set((arr || []).map((x) => String(x || '').trim()).filter(Boolean)));

            tgt.optionIds = uniq([...(tgt.optionIds || []), ...(src.optionIds || [])]);
            tgt.selectedOptionIds = uniq([...(tgt.selectedOptionIds || []), ...(src.selectedOptionIds || [])]);

            const subT = { ...(tgt.optionSubFamilies || {}) };
            const subS = src.optionSubFamilies || {};
            Object.keys(subS).forEach((k) => {
                if (!(k in subT)) subT[k] = subS[k];
            });
            tgt.optionSubFamilies = subT;

            const def = String(tgt.defaultOptionId || '').trim();
            if (!def || !tgt.optionIds.includes(def)) {
                tgt.defaultOptionId = tgt.optionIds[0] || '';
            }

            if (String(tgt.parentReviewId || '') === sid) {
                tgt.parentReviewId = null;
            }

            fams.forEach((f) => {
                if (String(f.parentReviewId || '') === sid) {
                    f.parentReviewId = tid;
                }
            });

            state.editFamilies = fams.filter((x) => x.reviewId !== sid);
            syncReviewStateIntoIaResult();
            return true;
        }

        function getFamilleMergePick() {
            if (!window.__ugapFamilleMergePick) {
                window.__ugapFamilleMergePick = { grid: new Set(), heur: new Set(), ia: new Set() };
            }
            return window.__ugapFamilleMergePick;
        }

        function pruneFamilleMergePick() {
            const pick = getFamilleMergePick();
            const valid = new Set((window.__ugapFamilleReview?.editFamilies || []).map((f) => f.reviewId));
            ['grid', 'heur', 'ia'].forEach((k) => {
                [...pick[k]].forEach((id) => {
                    if (!valid.has(id)) pick[k].delete(id);
                });
            });
        }

        function sortReviewIdsByEditOrder(reviewIds) {
            const editFamilies = window.__ugapFamilleReview?.editFamilies || [];
            const indexMap = new Map(editFamilies.map((f, i) => [f.reviewId, i]));
            return [...reviewIds].sort((a, b) => (indexMap.get(a) ?? 1e9) - (indexMap.get(b) ?? 1e9));
        }

        /** Fusionne toutes les familles listées dans la première (ordre liste d’édition). */
        function mergeManyFamiliesIntoFirst(selectedReviewIds) {
            const ids = Array.from(new Set((selectedReviewIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
            if (ids.length < 2) return false;
            const ordered = sortReviewIdsByEditOrder(ids);
            const target = ordered[0];
            for (let i = 1; i < ordered.length; i++) {
                mergeEditFamilies(ordered[i], target);
            }
            return true;
        }

        function collectMergeIdsByScope(scope) {
            const pick = getFamilleMergePick();
            if (scope === 'heur') return [...pick.heur];
            if (scope === 'ia') return [...pick.ia];
            if (scope === 'grid') return [...pick.grid];
            const u = new Set([...pick.grid, ...pick.heur, ...pick.ia]);
            return [...u];
        }

        /**
         * Fusionne vers la première famille (ordre édition), applique le nom final et les sous-catégories
         * (optionSubFamilies) pour les options issues des familles cochées.
         */
        function mergeFamiliesWithModalResult(orderedReviewIds, finalFamilyLabel, preserveSubForReviewId) {
            const state = window.__ugapFamilleReview;
            if (!state?.editFamilies) return false;
            const ordered = sortReviewIdsByEditOrder(orderedReviewIds);
            if (ordered.length < 2) return false;
            const snapshots = ordered.map((rid) => {
                const f = state.editFamilies.find((x) => x.reviewId === rid);
                if (!f) return null;
                return {
                    reviewId: rid,
                    label: String(f.familyLabel || 'Famille').trim() || 'Famille',
                    optionIds: [...(f.optionIds || [])].map((x) => String(x).trim()).filter(Boolean)
                };
            }).filter(Boolean);
            if (snapshots.length < 2) return false;
            const targetId = snapshots[0].reviewId;
            for (let i = 1; i < ordered.length; i++) {
                mergeEditFamilies(ordered[i], targetId);
            }
            const tgt = state.editFamilies.find((x) => x.reviewId === targetId);
            if (!tgt) return false;
            tgt.familyLabel = String(finalFamilyLabel || '').trim() || snapshots[0].label;
            if (!tgt.optionSubFamilies) tgt.optionSubFamilies = {};
            snapshots.forEach((sn) => {
                sn.optionIds.forEach((oid) => {
                    if (preserveSubForReviewId[sn.reviewId]) {
                        tgt.optionSubFamilies[oid] = sn.label;
                    } else {
                        delete tgt.optionSubFamilies[oid];
                    }
                });
            });
            syncReviewStateIntoIaResult();
            return true;
        }

        function openFamilleMergeModal(scope) {
            const ids = collectMergeIdsByScope(scope);
            if (ids.length < 2) {
                showAlert('Sélectionnez au moins deux familles (cases dans la grille et/ou colonnes A et B).', 'warning');
                return;
            }
            const ordered = sortReviewIdsByEditOrder(ids);
            const state = window.__ugapFamilleReview;
            const snapshots = ordered.map((rid) => {
                const f = state?.editFamilies?.find((x) => x.reviewId === rid);
                if (!f) return null;
                const label = String(f.familyLabel || 'Famille').trim() || 'Famille';
                const n = (f.optionIds || []).length;
                return { reviewId: rid, label, n };
            }).filter(Boolean);
            if (snapshots.length < 2) return;
            const defaultName = snapshots.map((s) => s.label).join(' / ');
            const modalId = 'fam-merge-categories-modal';
            document.getElementById(modalId)?.remove();
            const wrap = document.createElement('div');
            wrap.id = modalId;
            wrap.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:10050; display:flex; align-items:center; justify-content:center; padding:12px;';
            const subRows = snapshots.map((s, i) => `
                <label style="display:flex; align-items:flex-start; gap:10px; padding:10px; border:1px solid #e9ecef; border-radius:8px; margin-bottom:8px; cursor:pointer; background:${i === 0 ? '#f8fbff' : '#fff'};">
                    <input type="checkbox" class="fam-merge-modal-sub-cb" data-review-id="${escapeHtml(s.reviewId)}" checked style="margin-top:3px; flex-shrink:0;">
                    <span style="font-size:13px; line-height:1.4;">
                        ${i === 0 ? '<span style="color:#084298; font-weight:600;">Famille cible · </span>' : ''}
                        Garder le libellé <strong>« ${escapeHtml(s.label)} »</strong> comme <strong>sous-catégorie</strong> pour les options d’origine de cette famille (${s.n} ligne(s)).
                    </span>
                </label>
            `).join('');
            wrap.innerHTML = `
                <div style="width:min(560px,100%); max-height:90vh; overflow:auto; background:#fff; border-radius:12px; border:1px solid #dee2e6; box-shadow:0 8px 32px rgba(0,0,0,.15);">
                    <div style="padding:14px 16px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <strong style="font-size:16px;">Fusionner les familles</strong>
                        <button type="button" class="btn btn-outline fam-merge-modal-close" style="padding:6px 12px;">Fermer</button>
                    </div>
                    <div style="padding:16px;">
                        <label style="display:block; font-size:12px; color:#555; margin-bottom:6px;">Nom de la catégorie fusionnée</label>
                        <input type="text" id="fam-merge-modal-cat-name" value="${escapeHtml(defaultName)}" style="width:100%; padding:10px 12px; border:1px solid #ced4da; border-radius:8px; font-size:14px; box-sizing:border-box;">
                        <p style="margin:12px 0 8px; font-size:12px; color:#666;">Cochez les familles dont vous voulez <strong>conserver le nom comme sous-catégorie</strong> (attribution par option). La première famille de la liste est la cible qui reçoit toutes les options.</p>
                        <div id="fam-merge-modal-sub-list">${subRows}</div>
                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-outline fam-merge-modal-close">Annuler</button>
                            <button type="button" class="btn btn-primary" id="fam-merge-modal-confirm">Fusionner</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(wrap);
            const close = () => wrap.remove();
            wrap.querySelectorAll('.fam-merge-modal-close').forEach((b) => b.addEventListener('click', close));
            wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
            wrap.querySelector('#fam-merge-modal-confirm')?.addEventListener('click', () => {
                const nameInp = wrap.querySelector('#fam-merge-modal-cat-name');
                const finalName = String(nameInp?.value || '').trim();
                const preserve = {};
                wrap.querySelectorAll('.fam-merge-modal-sub-cb').forEach((cb) => {
                    const rid = cb.getAttribute('data-review-id');
                    if (rid) preserve[rid] = !!cb.checked;
                });
                if (mergeFamiliesWithModalResult(ordered, finalName, preserve)) {
                    const pick = getFamilleMergePick();
                    pick.grid.clear();
                    pick.heur.clear();
                    pick.ia.clear();
                    showAlert('Familles fusionnées.', 'success');
                    close();
                    renderExtractionInsights();
                } else {
                    showAlert('Fusion impossible.', 'error');
                }
            });
        }

        function applyFamilleMergePickToDom() {
            pruneFamilleMergePick();
            const pick = getFamilleMergePick();
            document.querySelectorAll('.fam-grid-merge-cb').forEach((cb) => {
                const id = cb.getAttribute('data-review-id');
                if (id) cb.checked = pick.grid.has(id);
            });
            document.querySelectorAll('.fam-col-merge-cb').forEach((cb) => {
                const id = cb.getAttribute('data-review-id');
                const col = cb.getAttribute('data-merge-col');
                if (!id || !col) return;
                cb.checked = col === 'heur' ? pick.heur.has(id) : pick.ia.has(id);
            });
        }

        /** Corps seul (options + sous-familles indentées), sans titre — lignes d’options draggables vers l’autre famille. */
        function renderFamilleSimplifiedFamilyBodyHtml(fam, byId, reviewId) {
            if (!fam) return '<span style="color:#999;">—</span>';
            const rid = escapeHtml(String(reviewId || fam.reviewId || ''));
            const subs = fam.optionSubFamilies && typeof fam.optionSubFamilies === 'object' ? fam.optionSubFamilies : {};
            const ids = Array.isArray(fam.optionIds) ? fam.optionIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
            if (ids.length === 0) {
                return '<span style="color:#888; font-size:12px;">Aucune option</span>';
            }
            const runs = [];
            ids.forEach((id) => {
                const sub = String(subs[id] || '').trim();
                const last = runs[runs.length - 1];
                if (last && last.sub === sub) last.ids.push(id);
                else runs.push({ sub, ids: [id] });
            });
            let html = '';
            const indentOpt = 10;
            const indentSub = 6;
            runs.forEach((run) => {
                if (run.sub) {
                    html += `<div style="margin-top:6px; padding-left:${indentSub}px; font-size:11px; color:#1565c0; font-weight:600;">${escapeHtml(run.sub)}</div>`;
                    run.ids.forEach((id) => {
                        const row = resolveOptionRowById(byId, id);
                        const label = row ? String(row.name || '').trim() : String(getOptionLabelById(id) || id).trim();
                        const eid = escapeHtml(id);
                        html += `<div class="fam-simplified-opt-line" draggable="true" data-option-id="${eid}" data-from-review-id="${rid}" style="padding-left:${indentSub + indentOpt}px; font-size:12px; color:#333; line-height:1.45; cursor:grab; border-radius:4px; margin:2px 0; padding-top:3px;padding-bottom:3px;padding-right:4px; border:1px solid transparent;" title="Glisser vers l’autre famille">· ${escapeHtml(label || id)}</div>`;
                    });
                } else {
                    run.ids.forEach((id) => {
                        const row = resolveOptionRowById(byId, id);
                        const label = row ? String(row.name || '').trim() : String(getOptionLabelById(id) || id).trim();
                        const eid = escapeHtml(id);
                        html += `<div class="fam-simplified-opt-line" draggable="true" data-option-id="${eid}" data-from-review-id="${rid}" style="margin-top:4px; padding-left:${indentSub}px; font-size:12px; color:#333; line-height:1.45; cursor:grab; border-radius:4px; margin:2px 0; padding-top:3px;padding-bottom:3px;padding-right:4px; border:1px solid transparent;" title="Glisser vers l’autre famille">· ${escapeHtml(label || id)}</div>`;
                    });
                }
            });
            return html;
        }

        function moveFamilleOptionBetweenReviewFamilies(fromReviewId, toReviewId, optionId) {
            const oid = String(optionId || '').trim();
            const state = window.__ugapFamilleReview;
            const fams = Array.isArray(state?.editFamilies) ? state.editFamilies : [];
            const from = fams.find((f) => String(f.reviewId) === String(fromReviewId));
            const to = fams.find((f) => String(f.reviewId) === String(toReviewId));
            if (!from || !to || !oid || String(fromReviewId) === String(toReviewId)) return false;
            if (!(from.optionIds || []).some((id) => String(id) === String(oid))) return false;
            if (isFamNameOptionsLocked(from)) {
                const locked = new Set((Array.isArray(from.lockedOptionIds) ? from.lockedOptionIds : []).map((id) => String(id)));
                if (locked.has(oid)) {
                    showAlert('Option verrouillée : déplacement interdit depuis cette famille.', 'warning');
                    return false;
                }
            }
            from.optionIds = (from.optionIds || []).filter((id) => String(id) !== String(oid));
            from.selectedOptionIds = (from.selectedOptionIds || []).filter((id) => String(id) !== String(oid));
            if (from.optionSubFamilies && typeof from.optionSubFamilies === 'object' && from.optionSubFamilies[oid]) {
                delete from.optionSubFamilies[oid];
            }
            if (!to.optionIds) to.optionIds = [];
            if (!to.selectedOptionIds) to.selectedOptionIds = [];
            if (!to.optionIds.some((id) => String(id) === String(oid))) to.optionIds.push(oid);
            if (!to.selectedOptionIds.some((id) => String(id) === String(oid))) to.selectedOptionIds.push(oid);
            syncReviewStateIntoIaResult();
            return true;
        }

        function mountFamilleInlineEditorSimplifiedTwo(mount, famA, famB, byId) {
            const placeholderHtml = '<p style="margin:0; color:#888; font-size:13px;">Double-cliquez une carte famille dans la grille ou la liste pour afficher l’édition ici.</p>';
            const rawIdA = famA.reviewId || '';
            const rawIdB = famB.reviewId || '';
            const titleA = escapeHtml(famA.familyLabel || 'Famille');
            const titleB = escapeHtml(famB.familyLabel || 'Famille');
            const bodyA = renderFamilleSimplifiedFamilyBodyHtml(famA, byId, rawIdA);
            const bodyB = renderFamilleSimplifiedFamilyBodyHtml(famB, byId, rawIdB);
            const idA = escapeHtml(rawIdA);
            const idB = escapeHtml(rawIdB);
            mount.innerHTML = `
                <div class="fam-inline-editor-inner" style="background:#fff; border-radius:10px; border:1px solid #cfd8dc; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.06);">
                    <div style="padding:10px 14px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <span style="font-size:12px; color:#64748b;">En-tête : glisser pour inverser les blocs · ligne d’option : glisser vers l’autre famille pour corriger.</span>
                        <button type="button" class="btn btn-outline" id="fam-inline-pair-close">Fermer</button>
                    </div>
                    <div style="padding:14px; max-height:min(68vh,820px); overflow:auto;">
                        <div id="fam-simplified-pair-row" style="display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:stretch;">
                            <div class="fam-simplified-drag-panel" data-review-id="${idA}" style="border:2px solid #cbd5e1; border-radius:10px; background:#fff; box-shadow:0 2px 8px rgba(15,23,42,.07); overflow:hidden; display:flex; flex-direction:column; min-height:120px;">
                                <div class="fam-simplified-drag-head" draggable="true" style="cursor:grab; flex-shrink:0; padding:10px 12px; background:linear-gradient(180deg,#f1f5f9 0%,#e2e8f0 100%); border-bottom:1px solid #cbd5e1; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                                    <span style="font-weight:700; font-size:13px; color:#0f172a; line-height:1.3;">${titleA}</span>
                                    <span title="Glisser pour échanger les colonnes" style="font-size:14px; color:#64748b; letter-spacing:1px; user-select:none;">⠿</span>
                                </div>
                                <div class="fam-simplified-drag-body" style="padding:10px 12px; flex:1; overflow:auto; max-height:52vh; background:#fafbfc;">${bodyA}</div>
                            </div>
                            <div class="fam-simplified-drag-panel" data-review-id="${idB}" style="border:2px solid #cbd5e1; border-radius:10px; background:#fff; box-shadow:0 2px 8px rgba(15,23,42,.07); overflow:hidden; display:flex; flex-direction:column; min-height:120px;">
                                <div class="fam-simplified-drag-head" draggable="true" style="cursor:grab; flex-shrink:0; padding:10px 12px; background:linear-gradient(180deg,#f1f5f9 0%,#e2e8f0 100%); border-bottom:1px solid #cbd5e1; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                                    <span style="font-weight:700; font-size:13px; color:#0f172a; line-height:1.3;">${titleB}</span>
                                    <span title="Glisser pour échanger les colonnes" style="font-size:14px; color:#64748b; letter-spacing:1px; user-select:none;">⠿</span>
                                </div>
                                <div class="fam-simplified-drag-body" style="padding:10px 12px; flex:1; overflow:auto; max-height:52vh; background:#fafbfc;">${bodyB}</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            const row = mount.querySelector('#fam-simplified-pair-row');
            const panels = () => Array.from(mount.querySelectorAll('.fam-simplified-drag-panel'));
            const clearOver = () => {
                mount.querySelectorAll('.fam-simplified-drag-panel').forEach((el) => el.classList.remove('fam-simplified-drag-over'));
                mount.querySelectorAll('.fam-simplified-drag-body').forEach((el) => el.classList.remove('fam-simplified-body-over'));
            };
            mount.querySelectorAll('.fam-simplified-drag-head').forEach((head) => {
                head.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    clearOver();
                    const pan = head.closest('.fam-simplified-drag-panel');
                    const rid = String(pan?.getAttribute('data-review-id') || '').trim();
                    e.dataTransfer.setData('text/fam-simplified-review', rid);
                    e.dataTransfer.effectAllowed = 'move';
                    head.style.opacity = '0.88';
                });
                head.addEventListener('dragend', () => {
                    head.style.opacity = '';
                    clearOver();
                });
            });
            mount.querySelectorAll('.fam-simplified-opt-line').forEach((line) => {
                line.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    clearOver();
                    const oid = String(line.getAttribute('data-option-id') || '').trim();
                    const fr = String(line.getAttribute('data-from-review-id') || '').trim();
                    e.dataTransfer.setData('text/fam-simplified-option-id', oid);
                    e.dataTransfer.setData('text/fam-simplified-from-review', fr);
                    e.dataTransfer.effectAllowed = 'move';
                    line.style.opacity = '0.65';
                });
                line.addEventListener('dragend', () => {
                    line.style.opacity = '';
                    clearOver();
                });
            });
            mount.querySelectorAll('.fam-simplified-drag-body').forEach((body) => {
                body.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    if (e.dataTransfer.types && [...e.dataTransfer.types].includes('text/fam-simplified-option-id')) {
                        body.classList.add('fam-simplified-body-over');
                    }
                });
                body.addEventListener('dragleave', (e) => {
                    if (!body.contains(e.relatedTarget)) body.classList.remove('fam-simplified-body-over');
                });
            });
            panels().forEach((panel) => {
                panel.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    if (e.target.closest('.fam-simplified-drag-panel') === panel) panel.classList.add('fam-simplified-drag-over');
                });
                panel.addEventListener('dragleave', (e) => {
                    if (!panel.contains(e.relatedTarget)) panel.classList.remove('fam-simplified-drag-over');
                });
                panel.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                });
                panel.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const toIdRaw = String(panel.getAttribute('data-review-id') || '').trim();
                    const optId = String(e.dataTransfer.getData('text/fam-simplified-option-id') || '').trim();
                    const fromR = String(e.dataTransfer.getData('text/fam-simplified-from-review') || '').trim();
                    if (optId && fromR && toIdRaw && fromR !== toIdRaw) {
                        if (moveFamilleOptionBetweenReviewFamilies(fromR, toIdRaw, optId)) {
                            const r = window.__ugapFamilleReview;
                            const na = r.editFamilies.find((x) => String(x.reviewId) === String(rawIdA));
                            const nb = r.editFamilies.find((x) => String(x.reviewId) === String(rawIdB));
                            if (na && nb) {
                                mountFamilleInlineEditorSimplifiedTwo(mount, na, nb, buildFamilleModalByIdMap());
                            }
                        }
                        clearOver();
                        return;
                    }
                    clearOver();
                    const fromPan = String(e.dataTransfer.getData('text/fam-simplified-review') || '').trim();
                    if (!fromPan || !toIdRaw || fromPan === toIdRaw) return;
                    const kids = row ? [...row.children] : [];
                    if (kids.length === 2) {
                        row.insertBefore(kids[1], kids[0]);
                    }
                });
            });
            if (!document.getElementById('fam-simplified-pair-style')) {
                const st = document.createElement('style');
                st.id = 'fam-simplified-pair-style';
                st.textContent = '.fam-simplified-drag-panel.fam-simplified-drag-over{outline:2px dashed #2563eb;outline-offset:2px;background:#eff6ff!important;}.fam-simplified-drag-body.fam-simplified-body-over{background:#e8f4fc!important;outline:1px dashed #0284c7;}.fam-simplified-opt-line:hover{background:#f1f5f9;border-color:#cbd5e1!important;}';
                document.head.appendChild(st);
            }
            mount.querySelector('#fam-inline-pair-close')?.addEventListener('click', () => {
                mount.innerHTML = placeholderHtml;
                window.__ugapFamilleEditorPendingCompareId = null;
            });
            try {
                mount.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (_) {}
        }

        function mountFamilleInlineEditor(reviewId, byId) {
            const mount = document.getElementById('fam-inline-editor-mount');
            if (!mount) return;
            const review = window.__ugapFamilleReview || {};
            const fam = (review.editFamilies || []).find((x) => x.reviewId === reviewId);
            if (!fam) return;
            const pending = window.__ugapFamilleEditorPendingCompareId;
            if (pending && pending !== reviewId) {
                const famPending = (review.editFamilies || []).find((x) => x.reviewId === pending);
                if (famPending) {
                    window.__ugapFamilleEditorPendingCompareId = null;
                    mountFamilleInlineEditorSimplifiedTwo(mount, famPending, fam, byId);
                    return;
                }
            }
            window.__ugapFamilleEditorPendingCompareId = reviewId;
            const rows = (fam.optionIds || []).map((id) => {
                const row = resolveOptionRowById(byId, id);
                if (row) return row;
                // Fallback: garder une ligne visible même si l'ID n'est plus résolu dans le contexte courant.
                const fromFam = fam?.optionLabels && typeof fam.optionLabels === 'object'
                    ? String(fam.optionLabels[String(id || '').trim()] || '').trim()
                    : '';
                const resolvedLabel = fromFam || getOptionLabelById(id);
                return {
                    id: String(id || ''),
                    name: resolvedLabel || `Option non résolue (${String(id || '')})`,
                    lineKindLabel: 'Option',
                    categoryName: '—'
                };
            }).filter(Boolean);
            const allFamilyNames = Array.from(new Set(
                (review.editFamilies || [])
                    .map((x) => String(x.familyLabel || '').trim())
                    .filter(Boolean)
            ));
            const existingSubs = Array.from(new Set(
                Object.values(fam.optionSubFamilies || {}).map((x) => String(x || '').trim()).filter(Boolean)
            ));
            const subChoices = Array.from(new Set([...allFamilyNames, ...existingSubs])).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
            const optionSubFamilies = { ...(fam.optionSubFamilies || {}) };
            const htmlRows = rows.map((r) => {
                const curSub = String(optionSubFamilies[r.id] || '').trim();
                const hasSub = !!curSub;
                const selBorder = hasSub ? '2px solid #1976d2' : '1px solid #cfd8dc';
                const selBg = hasSub ? '#f5f9ff' : '#fff';
                return `
                <tr class="fam-modal-row" data-option-id="${escapeHtml(r.id || '')}" data-has-sub="${hasSub ? '1' : '0'}" draggable="true" style="white-space:nowrap; ${hasSub ? 'background:linear-gradient(90deg, rgba(227,242,253,.25) 0%, transparent 55%);' : ''}">
                    <td style="padding:8px; border-bottom:1px solid #e0e0e0; text-align:center; vertical-align:middle;">
                        <input type="checkbox" class="fam-modal-opt-cb" data-option-id="${escapeHtml(r.id || '')}" ${(Array.isArray(fam.selectedOptionIds) ? fam.selectedOptionIds : []).includes(r.id) ? 'checked' : ''}>
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #e0e0e0; vertical-align:middle;">${escapeHtml(r.lineKindLabel || '')}</td>
                    <td style="padding:8px; border-bottom:1px solid #e0e0e0; vertical-align:middle; font-weight:500;">${escapeHtml(r.name || '—')}</td>
                    <td class="fam-modal-sub-cell" style="padding:8px 10px; border-bottom:1px solid #e0e0e0; vertical-align:middle; min-width:200px; max-width:320px; background:${hasSub ? 'rgba(227,242,253,.35)' : '#fafafa'};">
                        <select class="fam-modal-sub-select" data-option-id="${escapeHtml(r.id || '')}" style="width:100%; max-width:100%; padding:6px 8px; border:${selBorder}; border-radius:6px; font-size:13px; font-weight:500; background:${selBg}; color:#1565c0; box-sizing:border-box;">
                            <option value="">Aucune</option>
                            ${subChoices.map((s) => `<option value="${escapeHtml(s)}" ${optionSubFamilies[r.id] === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </td>
                </tr>`;
            }).join('');
            const placeholderHtml = '<p style="margin:0; color:#888; font-size:13px;">Double-cliquez une carte famille dans la grille ou la liste pour afficher l’édition ici.</p>';
            const close = () => {
                mount.innerHTML = placeholderHtml;
                window.__ugapFamilleEditorPendingCompareId = null;
            };
            mount.innerHTML = `
                <div class="fam-inline-editor-inner" style="background:#fff; border-radius:10px; border:1px solid #cfd8dc; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.06);">
                    <div style="padding:12px 14px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <strong>Éditer la famille</strong>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            <button class="btn btn-primary" id="fam-review-modal-lock" title="Verrouille le nom + les options actuelles (ajout futur autorisé)">Valider nom + options</button>
                            <button class="btn btn-success" id="fam-review-modal-save">Valider</button>
                            <button class="btn btn-outline" id="fam-review-modal-close">Fermer</button>
                        </div>
                    </div>
                    <div style="padding:12px 14px; max-height:min(70vh,900px); overflow:auto;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                            <div>
                                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Nom de la famille</label>
                                <input id="fam-modal-label" type="text" value="${escapeHtml(fam.familyLabel || 'Famille')}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                            </div>
                            <div>
                                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">Créer une sous-famille (libellé)</label>
                                <div style="display:flex; gap:6px;">
                                    <input id="fam-modal-new-sub" type="text" placeholder="Ex: Couleur console" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:4px;">
                                    <button type="button" class="btn btn-outline" id="fam-modal-add-sub">Ajouter</button>
                                </div>
                            </div>
                        </div>
                        <div id="fam-modal-split" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; align-items:stretch;">
                            <div style="border:1px solid #dee2e6; border-radius:8px; padding:10px; background:#f8f9fa; min-height:72px;">
                                <div id="fam-modal-col-left" style="font-size:12px; color:#333; min-height:28px;"></div>
                            </div>
                            <div style="border:1px solid #dee2e6; border-radius:8px; padding:10px; background:#f8f9fa; min-height:72px;">
                                <div id="fam-modal-col-right" class="fam-modal-col-right-drop" style="min-height:40px; padding:4px; border:1px dashed #ced4da; border-radius:6px; background:#fff;"></div>
                            </div>
                        </div>
                        <table class="fam-modal-opts-table" style="width:100%; border-collapse:collapse; border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;">
                            <thead>
                                <tr>
                                    <th style="padding:10px 8px; border-bottom:2px solid #dee2e6; text-align:center; background:#f5f5f5; font-size:12px;">Valider</th>
                                    <th style="padding:10px 8px; border-bottom:2px solid #dee2e6; text-align:left; background:#f5f5f5; font-size:12px;">Type</th>
                                    <th style="padding:10px 8px; border-bottom:2px solid #dee2e6; text-align:left; background:#f5f5f5; font-size:12px;">Libellé</th>
                                    <th style="padding:10px 8px; border-bottom:2px solid #dee2e6; text-align:left; background:#f5f5f5; font-size:12px;">Sous-famille</th>
                                </tr>
                            </thead>
                            <tbody>${htmlRows || '<tr><td colspan="4" style="padding:10px; color:#999;">Aucun élément</td></tr>'}</tbody>
                        </table>
                        <p style="margin-top:12px; color:#666; font-size:12px; line-height:1.5;">Sous-famille : liste <strong>Aucune</strong> par défaut. <strong>1ᵉʳ</strong> double-clic sur une ligne : zone droite · <strong>2ᵉ</strong> double-clic : zone gauche. Double-clic sur une <strong>autre famille</strong> (carte) : vue simplifiée des deux familles.</p>
                        <p style="margin-top:8px; color:#666; font-size:12px;">Les options décochées iront dans la famille <strong>Non attribuée</strong> après validation.</p>
                    </div>
                </div>
            `;
            const wrap = mount;
            mount.querySelector('#fam-review-modal-close')?.addEventListener('click', close);
            const syncFamModalSubRow = (sel) => {
                const val = String(sel.value || '').trim();
                const tr = sel.closest('tr');
                if (!tr) return;
                sel.style.border = val ? '2px solid #1976d2' : '1px solid #cfd8dc';
                sel.style.background = val ? '#f5f9ff' : '#fff';
                tr.style.background = val ? 'linear-gradient(90deg, rgba(227,242,253,.25) 0%, transparent 55%)' : '';
                tr.setAttribute('data-has-sub', val ? '1' : '0');
                const cell = tr.querySelector('.fam-modal-sub-cell');
                if (cell) cell.style.background = val ? 'rgba(227,242,253,.35)' : '#fafafa';
            };
            wrap.querySelectorAll('.fam-modal-sub-select').forEach((sel) => {
                sel.addEventListener('change', () => syncFamModalSubRow(sel));
                syncFamModalSubRow(sel);
            });
            const rowById = new Map(rows.map((r) => [r.id, r]));
            const lineOne = (r) => {
                if (!r) return '';
                const t = escapeHtml(r.lineKindLabel || '');
                const n = escapeHtml(r.name || '—');
                return `<span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${n}">${t} · ${n}</span>`;
            };
            let rightOrder = [];
            let leftFocusId = null;
            let dblclickCount = 0;
            const applyFamModalSequenceToFamily = () => {
                if (!Array.isArray(rightOrder) || rightOrder.length === 0) return;
                const ord = rightOrder.map((x) => String(x || '').trim()).filter(Boolean);
                const seen = new Set(ord);
                const rest = (fam.optionIds || []).map((x) => String(x || '').trim()).filter((id) => id && !seen.has(id));
                fam.optionIds = [...ord, ...rest];
            };
            const colLeft = wrap.querySelector('#fam-modal-col-left');
            const colRight = wrap.querySelector('#fam-modal-col-right');
            const renderFamModalLeft = () => {
                if (!colLeft) return;
                if (!leftFocusId) {
                    colLeft.innerHTML = '<span style="color:#999;">—</span>';
                    return;
                }
                const focusRow = rowById.get(leftFocusId);
                const ids = (fam.optionIds || []).map((x) => String(x || '').trim()).filter(Boolean);
                const rest = ids.filter((id) => id !== leftFocusId);
                const above = rest.map((id) => {
                    const rr = rowById.get(id);
                    return rr ? `<div style="padding:3px 0; opacity:.9;">${lineOne(rr)}</div>` : '';
                }).join('');
                const focusBlock = focusRow
                    ? `<div style="margin-top:8px; padding-top:8px; border-top:2px solid #90caf9; font-weight:600;">${lineOne(focusRow)}</div>`
                    : '';
                colLeft.innerHTML = `
                    <div style="border:1px solid #dbeafe; border-radius:8px; background:#fff; overflow:hidden;">
                        <div style="padding:6px 10px; background:#eff6ff; border-bottom:1px solid #dbeafe; display:flex; justify-content:space-between; align-items:center;">
                            <strong style="font-size:12px; color:#1e3a8a;">${escapeHtml(fam.familyLabel || 'Famille')}</strong>
                            <button type="button" class="btn btn-outline" id="fam-col-left-clear" style="padding:2px 8px; font-size:11px;">Fermer</button>
                        </div>
                        <div style="padding:8px 10px; max-height:26vh; overflow:auto; font-size:12px;">
                            ${above || '<span style="color:#bbb; font-size:11px;">(autres lignes)</span>'}
                            ${focusBlock}
                        </div>
                    </div>`;
                wrap.querySelector('#fam-col-left-clear')?.addEventListener('click', () => {
                    leftFocusId = null;
                    renderFamModalLeft();
                });
            };
            const renderFamModalRight = () => {
                if (!colRight) return;
                if (rightOrder.length === 0) {
                    colRight.innerHTML = '<span style="color:#999; font-size:12px;">—</span>';
                    return;
                }
                const listHtml = rightOrder.map((oid, idx) => {
                    const rr = rowById.get(oid);
                    const label = rr ? lineOne(rr) : `<span>${escapeHtml(oid)}</span>`;
                    return `
                        <div class="fam-modal-seq-item" draggable="true" data-seq-idx="${idx}" data-option-id="${escapeHtml(oid)}"
                             style="padding:6px 8px; margin-bottom:4px; border:1px solid #e0e0e0; border-radius:6px; background:#fff; cursor:grab; font-size:12px;">
                            ${label}
                        </div>`;
                }).join('');
                colRight.innerHTML = `
                    <div style="border:1px solid #dbeafe; border-radius:8px; background:#fff; overflow:hidden;">
                        <div style="padding:6px 10px; background:#eff6ff; border-bottom:1px solid #dbeafe; display:flex; justify-content:space-between; align-items:center;">
                            <strong style="font-size:12px; color:#1e3a8a;">${escapeHtml(fam.familyLabel || 'Famille')}</strong>
                            <button type="button" class="btn btn-outline" id="fam-col-right-clear" style="padding:2px 8px; font-size:11px;">Fermer</button>
                        </div>
                        <div style="padding:8px 10px; max-height:26vh; overflow:auto;">${listHtml}</div>
                    </div>`;
                colRight.querySelectorAll('.fam-modal-seq-item').forEach((el) => {
                    el.addEventListener('dragstart', (ev) => {
                        ev.dataTransfer.setData('text/fam-modal-seq-from', String(el.getAttribute('data-seq-idx') || ''));
                        ev.dataTransfer.setData('text/fam-modal-option-id', String(el.getAttribute('data-option-id') || ''));
                        ev.dataTransfer.effectAllowed = 'move';
                    });
                });
                wrap.querySelector('#fam-col-right-clear')?.addEventListener('click', () => {
                    rightOrder = [];
                    renderFamModalRight();
                });
            };
            renderFamModalLeft();
            renderFamModalRight();
            wrap.querySelector('.fam-modal-opts-table')?.addEventListener('dblclick', (e) => {
                const tr = e.target.closest?.('tr.fam-modal-row');
                if (!tr || e.target.closest?.('input, select, button, label')) return;
                const oid = String(tr.getAttribute('data-option-id') || '').trim();
                if (!oid) return;
                dblclickCount += 1;
                if (dblclickCount === 1) {
                    rightOrder = [oid];
                    leftFocusId = null;
                } else {
                    leftFocusId = oid;
                }
                renderFamModalLeft();
                renderFamModalRight();
            });
            wrap.querySelectorAll('.fam-modal-row').forEach((tr) => {
                tr.addEventListener('dragstart', (e) => {
                    if (e.target && e.target.closest && e.target.closest('input, select')) {
                        e.preventDefault();
                        return;
                    }
                    const oid = String(tr.getAttribute('data-option-id') || '').trim();
                    if (!oid || !e.dataTransfer) return;
                    e.dataTransfer.setData('text/fam-modal-option-id', oid);
                    e.dataTransfer.effectAllowed = 'copy';
                });
            });
            colRight?.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });
            colRight?.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromSeq = e.dataTransfer.getData('text/fam-modal-seq-from');
                const oid = String(e.dataTransfer.getData('text/fam-modal-option-id') || '').trim();
                if (fromSeq !== '' && fromSeq !== undefined) {
                    const fromIdx = parseInt(fromSeq, 10);
                    if (Number.isNaN(fromIdx) || fromIdx < 0 || fromIdx >= rightOrder.length) {
                        renderFamModalRight();
                        return;
                    }
                    const targetItem = e.target.closest?.('.fam-modal-seq-item');
                    const arr = [...rightOrder];
                    const [moved] = arr.splice(fromIdx, 1);
                    if (!targetItem) {
                        arr.push(moved);
                    } else {
                        let toIdx = parseInt(targetItem.getAttribute('data-seq-idx') || '0', 10);
                        if (fromIdx < toIdx) toIdx -= 1;
                        toIdx = Math.max(0, Math.min(toIdx, arr.length));
                        arr.splice(toIdx, 0, moved);
                    }
                    rightOrder = arr;
                    renderFamModalRight();
                    return;
                }
                if (!oid || !fam.optionIds?.includes(oid)) return;
                if (!rightOrder.includes(oid)) rightOrder.push(oid);
                renderFamModalRight();
            });
            wrap.querySelector('#fam-modal-add-sub')?.addEventListener('click', () => {
                const input = wrap.querySelector('#fam-modal-new-sub');
                const newSub = String(input?.value || '').trim();
                if (!newSub) return;
                wrap.querySelectorAll('.fam-modal-sub-select').forEach((sel) => {
                    const exists = Array.from(sel.options).some((o) => o.value === newSub);
                    if (!exists) {
                        const opt = document.createElement('option');
                        opt.value = newSub;
                        opt.textContent = newSub;
                        sel.appendChild(opt);
                    }
                });
                if (input) input.value = '';
            });
            wrap.querySelector('#fam-review-modal-lock')?.addEventListener('click', () => {
                applyFamModalSequenceToFamily();
                const updatedLabel = String(wrap.querySelector('#fam-modal-label')?.value || '').trim() || 'Famille';
                fam.familyLabel = updatedLabel;
                if (!fam.optionSubFamilies) fam.optionSubFamilies = {};
                const checkedIds = new Set();
                wrap.querySelectorAll('.fam-modal-opt-cb').forEach((cb) => {
                    const optionId = cb.getAttribute('data-option-id');
                    if (cb.checked && optionId) checkedIds.add(optionId);
                });
                wrap.querySelectorAll('.fam-modal-sub-select').forEach((sel) => {
                    const optionId = sel.getAttribute('data-option-id');
                    if (!optionId) return;
                    const v = String(sel.value || '').trim();
                    if (v) fam.optionSubFamilies[optionId] = v;
                    else delete fam.optionSubFamilies[optionId];
                });
                // Verrouille le nom + les options actuellement validées.
                fam.selectedOptionIds = (fam.optionIds || []).filter((id) => checkedIds.has(id));
                fam.nameOptionsLocked = true;
                fam.lockedOptionIds = Array.from(new Set(fam.selectedOptionIds || []));
                syncReviewStateIntoIaResult();
                showAlert('Nom + options verrouillés. Vous pouvez ajouter des éléments ensuite, mais pas retirer cette base.', 'success');
                close();
                renderExtractionInsights();
            });
            wrap.querySelector('#fam-review-modal-save')?.addEventListener('click', () => {
                applyFamModalSequenceToFamily();
                const updatedLabel = String(wrap.querySelector('#fam-modal-label')?.value || '').trim() || 'Famille';
                fam.familyLabel = updatedLabel;
                if (!fam.optionSubFamilies) fam.optionSubFamilies = {};
                const checkedIds = new Set();
                wrap.querySelectorAll('.fam-modal-opt-cb').forEach((cb) => {
                    const optionId = cb.getAttribute('data-option-id');
                    if (cb.checked && optionId) checkedIds.add(optionId);
                });
                wrap.querySelectorAll('.fam-modal-sub-select').forEach((sel) => {
                    const optionId = sel.getAttribute('data-option-id');
                    if (!optionId) return;
                    const v = String(sel.value || '').trim();
                    if (v) fam.optionSubFamilies[optionId] = v;
                    else delete fam.optionSubFamilies[optionId];
                });
                fam.selectedOptionIds = (fam.optionIds || []).filter((id) => checkedIds.has(id));
                if (isFamNameOptionsLocked(fam)) {
                    const locked = new Set((Array.isArray(fam.lockedOptionIds) ? fam.lockedOptionIds : []).map((id) => String(id)));
                    const current = new Set((Array.isArray(fam.selectedOptionIds) ? fam.selectedOptionIds : []).map((id) => String(id)));
                    locked.forEach((id) => current.add(id));
                    fam.selectedOptionIds = Array.from(current);
                }
                const unchecked = (fam.optionIds || []).filter((id) => !checkedIds.has(id));
                if (unchecked.length > 0) {
                    if (isFamNameOptionsLocked(fam)) {
                        const locked = new Set((Array.isArray(fam.lockedOptionIds) ? fam.lockedOptionIds : []).map((id) => String(id)));
                        const denied = unchecked.filter((id) => locked.has(String(id)));
                        if (denied.length > 0) {
                            showAlert('Cette famille est verrouillée: impossible de retirer les options validées.', 'warning');
                            return;
                        }
                    }
                    const nonAttrib = ensureNonAttribueeFamily(review);
                    unchecked.forEach((id) => {
                        if (!nonAttrib.optionIds.includes(id)) nonAttrib.optionIds.push(id);
                        if (!nonAttrib.selectedOptionIds.includes(id)) nonAttrib.selectedOptionIds.push(id);
                    });
                    // Retirer de la famille courante
                    fam.optionIds = (fam.optionIds || []).filter((id) => checkedIds.has(id));
                    fam.selectedOptionIds = fam.selectedOptionIds.filter((id) => fam.optionIds.includes(id));
                }
                syncReviewStateIntoIaResult();
                close();
                renderExtractionInsights();
            });
            try {
                mount.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (_) {}
        }

        function renderFamilyCardsList(families, byId, sourceKey, allFamilies) {
            if (window.UgapFamilleTab?.renderFamilyCardsList) {
                return window.UgapFamilleTab.renderFamilyCardsList(families, byId, sourceKey, allFamilies);
            }
            return '<p style="color:#666; margin:0;">Aucune famille.</p>';
        }

        function __legacyRenderFamilleTabInner(splitOptions) {
            pruneFamilleMergePick();
            if (!window.__ugapFamilleRepassIndices) window.__ugapFamilleRepassIndices = new Set();
            const combined = buildFamilleCombinedRows(splitOptions);
            upsertFamilleOptionLabelCache(combined.map((r) => ({ id: r.id, name: r.name })));
            const byId = new Map(combined.map((r) => [r.id, r]));
            const nOpt = (splitOptions.regularOptions || []).length;
            const nMino = (splitOptions.minorationOptions || []).length;
            const iaData = window.__ugapFamilleIa || null;
            const nFamIa = iaData && Array.isArray(iaData.families) ? iaData.families.length : 0;
            const iaBlock = iaData
                ? renderFamilleIaGroupCards(iaData, byId)
                : '<p style="color:#666; margin:0;">Aucun regroupement encore : lancez <strong>Détecter familles (IA)</strong> (config IA entreprise).</p>';
            const review = window.__ugapFamilleReview || null;
            const editFamilies = Array.isArray(review?.editFamilies) ? review.editFamilies : [];
            const reviewCardsHtml = editFamilies.length
                ? `<div style="margin-top:20px; border-top:1px solid #e5e7eb; padding-top:14px;">
                    <div style="font-weight:600; margin-bottom:8px;">Relecture / édition des familles</div>
                    ${renderFamilyCardsList(editFamilies, byId, 'review', editFamilies)}
                   </div>`
                : '';

            return `
                <div class="famille-tab-root" style="padding-bottom:32px;">
                <div style="margin-top:14px;">${iaBlock}</div>
                ${reviewCardsHtml}
                ${renderFamilyDecisionGroupsBackofficePanel()}
                </div>
            `;
        }

        async function __legacyRunFamilleTraitement() {
            const btn = document.getElementById('btn-run-famille-traitement');
            const statusEl = document.getElementById('fam-traitement-status');
            window.__familleTraitementRunning = true;
            showAlert('Lancement du regroupement IA…', 'info');
            if (statusEl) {
                statusEl.textContent = 'Traitement en cours…';
                statusEl.style.color = '#0d6efd';
            }
            const splitOptions = splitModelOptionsByType(getAllOptionsForSummary());
            const combined = buildFamilleCombinedRows(splitOptions);
            upsertFamilleOptionLabelCache(combined.map((r) => ({ id: r.id, name: r.name })));
            const payloadAll = combined.map((o) => ({
                id: o.id,
                name: o.name,
                category: o.categoryName || 'Autre',
                lineKind: o.lineKind === 'mino' ? 'minoration' : 'option'
            }));
            const validated = getFamilleValidatedFamilies();
            const existingReviewFamilies = Array.isArray(window.__ugapFamilleReview?.editFamilies)
                ? window.__ugapFamilleReview.editFamilies.map((f) => ({
                    reviewId: f.reviewId,
                    familyLabel: f.familyLabel,
                    subFamilyLabel: f.subFamilyLabel || '',
                    optionIds: Array.isArray(f.optionIds) ? f.optionIds : [],
                    selectedOptionIds: Array.isArray(f.selectedOptionIds) ? f.selectedOptionIds : [],
                    businessViewIds: Array.isArray(f.businessViewIds) ? f.businessViewIds : [],
                    businessViewId: f.businessViewId || ''
                }))
                : [];
            if (!window.__ugapFamilleRepassIndices) window.__ugapFamilleRepassIndices = new Set();
            const repassIdx = [...window.__ugapFamilleRepassIndices].filter((n) => Number.isInteger(n) && n >= 0 && n < validated.length);
            const repassIds = new Set();
            repassIdx.forEach((i) => {
                const fam = validated[i];
                (fam?.optionIds || []).forEach((id) => repassIds.add(String(id)));
            });
            const validatedFrozenIds = new Set();
            validated.forEach((f) => {
                (f?.optionIds || []).forEach((id) => validatedFrozenIds.add(String(id)));
            });
            // On retire du gel les familles qu'on veut repasser.
            repassIds.forEach((id) => validatedFrozenIds.delete(id));

            const heurFamiliesFiltered = mergeFamiliesUnique([], []);
            const heurAssignedIds = new Set();
            heurFamiliesFiltered.forEach((f) => (f.optionIds || []).forEach((id) => heurAssignedIds.add(String(id))));

            const payload = payloadAll.filter((o) => !heurAssignedIds.has(o.id) && !validatedFrozenIds.has(o.id));
            if (payload.length === 0) {
                window.__ugapFamilleReview = { heuristicFamilies: heurFamiliesFiltered, aiFamilies: [], editFamilies: makeReviewFamilies(heurFamiliesFiltered, []) };
                window.__ugapFamilleIa = { families: mergeFamiliesUnique(validated, heurFamiliesFiltered) };
                window.__ugapFamilleRepassIndices = new Set();
                showAlert('Aucune ligne restante à envoyer à l\'IA : toutes sont déjà dans des familles validées (ou en repasse).', 'success');
                renderExtractionInsights();
                return;
            }
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Détection en cours…';
            }
            try {
                const result = await apiCall('/familles/suggest-ia', {
                    method: 'POST',
                    body: JSON.stringify({
                        options: payload,
                        knownFamilies: validated,
                        currentReviewFamilies: existingReviewFamilies
                    })
                });
                const aiFamilies = Array.isArray(result?.data?.families) ? result.data.families : [];
                window.__ugapFamilleReview = { heuristicFamilies: heurFamiliesFiltered, aiFamilies, editFamilies: makeReviewFamilies(heurFamiliesFiltered, aiFamilies) };
                window.__ugapFamilleIa = { families: mergeFamiliesUnique(validated, mergeFamiliesUnique(heurFamiliesFiltered, aiFamilies)) };
                window.__ugapFamilleRepassIndices = new Set();
                showAlert(`Regroupement IA terminé : ${(window.__ugapFamilleIa?.families || []).length} famille(s).`, 'success');
            } catch (err) {
                showAlert(err.message || 'Erreur IA', 'error');
            } finally {
                window.__familleTraitementRunning = false;
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Détecter familles (IA)';
                }
                if (statusEl) {
                    statusEl.textContent = 'Traitement terminé';
                    statusEl.style.color = '#198754';
                }
            }
            renderExtractionInsights();
        }

        function renderFamilleTabInner(splitOptions) {
            if (window.UgapFamilleTab?.renderFamilleTabInner) {
                return window.UgapFamilleTab.renderFamilleTabInner(splitOptions);
            }
            return __legacyRenderFamilleTabInner(splitOptions);
        }

        async function runFamilleTraitement() {
            if (window.UgapFamilleTab?.runFamilleTraitement) {
                return window.UgapFamilleTab.runFamilleTraitement();
            }
            return __legacyRunFamilleTraitement();
        }

        let extractionActiveSubtab = 'model';
        let extractionSelectedModelId = null;
        let extractionOptionsModelFilterId = '';
        let __famRawSearchDebounce = null;
        let __isRenderingExtractionInsights = false;
        let __pendingExtractionInsightsRender = false;

        function switchExtractionSubtab(tabId) {
            extractionActiveSubtab = tabId;
            document.querySelectorAll('#extraction-subtabs .subtab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-extraction-subtab') === tabId);
            });
            document.querySelectorAll('#tab-models .subtab-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === `extraction-subtab-${tabId}`);
            });
            renderExtractionInsights();
        }

        /** Ancienne barre fixe colonnes A/B — supprimée ; fonction conservée pour les appels existants. */
        function syncFamilleColumnsDock() {}

        // Fallback global: garantit drag + double-clic des cartes famille après tout re-render.
        function ensureFamilleCardGlobalInteractions() {
            if (window.UgapFamilleTab?.ensureFamilleCardGlobalInteractions) {
                window.UgapFamilleTab.ensureFamilleCardGlobalInteractions();
            }
        }

        function renderExtractionInsights() {
            if (__isRenderingExtractionInsights) {
                __pendingExtractionInsightsRender = true;
                return;
            }
            __isRenderingExtractionInsights = true;
            try {
            updateFamilleTabWarningBadge();
            ensureFamilleCardGlobalInteractions();
            const mainActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab') || '';
            const optionRoot = document.getElementById('extraction-options-content');
            const minorationRoot = document.getElementById('extraction-minoration-content');
            const prRoot = document.getElementById('extraction-pr-content');
            const diversRoot = document.getElementById('extraction-divers-content');
            const baseOptionsRoot = document.getElementById('extraction-base-options-content');
            const familleRoot = document.getElementById('extraction-famille-content');
            if (!optionRoot && !minorationRoot && !prRoot && !diversRoot && !baseOptionsRoot && !familleRoot) return;

            const models = Array.isArray(currentData?.models) ? currentData.models : [];
            if (models.length === 0) {
                const empty = '<div style="padding:14px; color:#666; border:1px solid #eee; border-radius:6px;">Aucun modèle extrait pour le moment.</div>';
                if (optionRoot) optionRoot.innerHTML = empty;
                if (minorationRoot) minorationRoot.innerHTML = empty;
                if (prRoot) prRoot.innerHTML = empty;
                if (diversRoot) diversRoot.innerHTML = empty;
                if (baseOptionsRoot) baseOptionsRoot.innerHTML = empty;
            }

            const splitOptions = splitModelOptionsByType(getAllOptionsForSummary());
            const optionsCount = splitOptions.regularOptions.length;
            const minorationsCount = splitOptions.minorationOptions.length;
            const diversCount = splitOptions.diversOptions.length;
            const mvPvFamilyGroups = buildMvPvFamilyGroupsFromOptions(splitOptions.minorationOptions);

            if (optionRoot && extractionActiveSubtab === 'option') {
                const modelFilterChoices = models
                    .map((m) => `<option value="${escapeHtml(String(m?.id || ''))}" ${String(extractionOptionsModelFilterId || '') === String(m?.id || '') ? 'selected' : ''}>${escapeHtml(String(m?.name || m?.id || 'Modèle'))}</option>`)
                    .join('');
                const optionsForRender = extractionOptionsModelFilterId
                    ? splitOptions.regularOptions.filter((opt) => {
                        const ids = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map((x) => String(x)) : [];
                        return ids.includes(String(extractionOptionsModelFilterId));
                    })
                    : splitOptions.regularOptions;
                optionRoot.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                        <span class="badge">${optionsForRender.length} option(s) assignee(s) a au moins un bateau</span>
                        <label for="ext-option-model-filter" style="font-size:12px; color:#555; margin-left:6px;">Modèle bateau:</label>
                        <select id="ext-option-model-filter" style="min-width:260px; padding:6px; border:1px solid #ddd; border-radius:4px;">
                            <option value="">Tous les modèles</option>
                            ${modelFilterChoices}
                        </select>
                    </div>
                    <table style="width:100%; border-collapse:collapse; border:1px solid #eee;">
                        <thead>
                            <tr style="background:#f8f9fa;">
                                <th style="padding:8px; border-bottom:1px solid #eee;">Option</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Prix client</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Prix UGAP</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Réf.</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Action</th>
                            </tr>
                        </thead>
                        <tbody>${renderEditableExtractionRows(optionsForRender, 'Aucune option standard trouvée')}</tbody>
                    </table>
                `;
            }

            if (diversRoot && extractionActiveSubtab === 'divers') {
                diversRoot.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                        <span class="badge">${diversCount} ligne(s) en divers</span>
                    </div>
                    <p style="color:#666; font-size:13px; margin-top:0;">Lignes standard sans croix d'assignation poste/bateau.</p>
                    <table style="width:100%; border-collapse:collapse; border:1px solid #eee;">
                        <thead>
                            <tr style="background:#f8f9fa;">
                                <th style="padding:8px; border-bottom:1px solid #eee;">Libellé</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Prix client</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Prix UGAP</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Réf.</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Action</th>
                            </tr>
                        </thead>
                        <tbody>${renderEditableExtractionRows(splitOptions.diversOptions, 'Aucune ligne divers détectée')}</tbody>
                    </table>
                `;
            }

            if (minorationRoot && extractionActiveSubtab === 'minoration') {
                minorationRoot.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                        <span class="badge">${minorationsCount} ligne(s) moins-value / plus-value / minoration</span>
                    </div>
                    ${renderMinorationDoublonSummaryLine(mvPvFamilyGroups)}
                    <div style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                        <div style="color:#666; font-size:13px;">Liste triée par <strong>famille</strong> — les doublons apparaissent en colonne (même famille, plusieurs lignes).</div>
                        <button class="btn btn-primary" onclick="showAlert('Assignation IA des minorations à implémenter', 'info')">Assigner les minorations</button>
                    </div>
                    <table style="width:100%; border-collapse:collapse; border:1px solid #eee;">
                        <thead>
                            <tr style="background:#f8f9fa;">
                                <th style="padding:8px; border-bottom:1px solid #eee;">Libellé</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Prix client</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Prix UGAP</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Réf.</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Action</th>
                            </tr>
                        </thead>
                        <tbody>${renderEditableExtractionRows(splitOptions.minorationOptions, 'Aucune minoration détectée')}</tbody>
                    </table>
                `;
            }

            if (prRoot && extractionActiveSubtab === 'pr') {
                prRoot.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                        <span class="badge">${splitOptions.prOptions.length} pièce(s) détachée(s) PR</span>
                    </div>
                    <p style="color:#666; font-size:13px; margin-top:0;">Pièces détachées commençant par PR.</p>
                    <table style="width:100%; border-collapse:collapse; border:1px solid #eee;">
                        <thead>
                            <tr style="background:#f8f9fa;">
                                <th style="padding:8px; border-bottom:1px solid #eee;">Libellé PR</th>
                                <th style="padding:8px; border-bottom:1px solid #eee;">Réf.</th>
                            </tr>
                        </thead>
                        <tbody>${renderOptionRows(splitOptions.prOptions, 'Aucune ligne PR détectée')}</tbody>
                    </table>
                `;
            }

            if (baseOptionsRoot && extractionActiveSubtab === 'baseoptions') {
                baseOptionsRoot.innerHTML = renderExtractionBaseOptionsByModelHtml(models);
                updateBaseOptionsAiProgressUi();
            }

            if (familleRoot && mainActiveTab === 'famille') {
                familleRoot.innerHTML = renderFamilleTabInner(splitOptions);
                applyFamilleMergePickToDom();
                refreshFamilyTemplatePreview();
            }

            // Liaison robuste du bouton (évite de dépendre de onclick inline).
            const runBtn = document.getElementById('btn-run-famille-traitement');
            if (runBtn) {
                runBtn.onclick = null;
                runBtn.addEventListener('click', runFamilleTraitement, { once: false });
            }
            const clearAssignmentsBtn = document.getElementById('btn-clear-old-family-assignments');
            if (clearAssignmentsBtn) {
                clearAssignmentsBtn.onclick = null;
                clearAssignmentsBtn.addEventListener('click', () => {
                    if (!confirm('Effacer tous les anciens assignements d’options vers les familles ?')) return;
                    clearValidatedFamilyAssignments();
                    showAlert('Anciens assignements effacés.', 'success');
                    renderExtractionInsights();
                }, { once: false });
            }
            const mergeBtn = document.getElementById('btn-fam-merge');
            if (mergeBtn) {
                mergeBtn.onclick = null;
                mergeBtn.addEventListener('click', () => {
                    const srcEl = document.getElementById('fam-merge-source');
                    const tgtEl = document.getElementById('fam-merge-target');
                    const sid = srcEl?.value;
                    const tid = tgtEl?.value;
                    if (!sid || !tid || sid === tid) {
                        showAlert('Choisissez deux familles distinctes (source et cible).', 'warning');
                        return;
                    }
                    if (mergeEditFamilies(sid, tid)) {
                        showAlert('Familles fusionnées : tout est regroupé dans la cible.', 'success');
                        renderExtractionInsights();
                    } else {
                        showAlert('Fusion impossible.', 'error');
                    }
                }, { once: false });
            }
            document.querySelectorAll('.fam-col-merge-cb').forEach((cb) => {
                cb.addEventListener('change', () => {
                    const pick = getFamilleMergePick();
                    const col = cb.getAttribute('data-merge-col');
                    const id = cb.getAttribute('data-review-id');
                    if (!id || !col) return;
                    const set = col === 'heur' ? pick.heur : pick.ia;
                    if (cb.checked) set.add(id);
                    else set.delete(id);
                });
            });
            document.querySelectorAll('.fam-grid-merge-cb').forEach((cb) => {
                cb.addEventListener('change', () => {
                    const pick = getFamilleMergePick();
                    const id = cb.getAttribute('data-review-id');
                    if (!id) return;
                    if (cb.checked) pick.grid.add(id);
                    else pick.grid.delete(id);
                });
            });
            document.querySelectorAll('.fam-merge-col-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const col = btn.getAttribute('data-merge-col');
                    openFamilleMergeModal(col === 'heur' ? 'heur' : 'ia');
                });
            });
            const mergeGridBtn = document.getElementById('btn-fam-merge-grid-selection');
            if (mergeGridBtn) {
                mergeGridBtn.addEventListener('click', () => {
                    openFamilleMergeModal('grid');
                });
            }
            const mergeFixedBtn = document.getElementById('btn-fam-merge-selection-fixed');
            if (mergeFixedBtn) {
                mergeFixedBtn.addEventListener('click', () => {
                    openFamilleMergeModal('all');
                });
            }
            document.querySelectorAll('.fam-found-card').forEach((card) => {
                card.addEventListener('dragstart', (e) => {
                    if (!e.dataTransfer) return;
                    const label = String(card.getAttribute('data-family-label') || '').trim();
                    if (!label) return;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/fam-found-label', label);
                    card.style.opacity = '0.5';
                });
                card.addEventListener('dragend', () => {
                    card.style.opacity = '';
                    card.style.outline = '';
                });
                card.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    card.style.outline = '2px dashed #0d6efd';
                    card.style.outlineOffset = '-2px';
                });
                card.addEventListener('dragleave', () => {
                    card.style.outline = '';
                    card.style.outlineOffset = '';
                });
                card.addEventListener('drop', (e) => {
                    e.preventDefault();
                    card.style.outline = '';
                    card.style.outlineOffset = '';
                    const from = String(e.dataTransfer?.getData('text/fam-found-label') || '').trim().toLowerCase();
                    const to = String(card.getAttribute('data-family-label') || '').trim().toLowerCase();
                    if (!from || !to || from === to) return;
                    const order = getFamilleFoundOrder();
                    const cards = Array.from(document.querySelectorAll('.fam-found-card'))
                        .map((c) => String(c.getAttribute('data-family-label') || '').trim())
                        .filter(Boolean);
                    const base = order.length ? order.slice() : cards;
                    if (!base.includes(from) && cards.find((x) => x.toLowerCase() === from)) base.push(cards.find((x) => x.toLowerCase() === from));
                    if (!base.includes(to) && cards.find((x) => x.toLowerCase() === to)) base.push(cards.find((x) => x.toLowerCase() === to));
                    const norm = base.slice();
                    const fromIdx = norm.findIndex((x) => String(x || '').toLowerCase() === from);
                    const toIdx = norm.findIndex((x) => String(x || '').toLowerCase() === to);
                    if (fromIdx < 0 || toIdx < 0) return;
                    const [moved] = norm.splice(fromIdx, 1);
                    norm.splice(toIdx, 0, moved);
                    setFamilleFoundOrder(norm);
                    renderExtractionInsights();
                });
            });
            const validateFamilyBtn = document.getElementById('btn-validate-family-stage');
            const showAllBtn = document.getElementById('btn-fam-show-all');
            const resetViewBtn = document.getElementById('btn-fam-reset-view');
            if (showAllBtn) {
                showAllBtn.onclick = null;
                showAllBtn.addEventListener('click', () => {
                    const ui = getFamilleUiState();
                    ui.hiddenIds = [];
                    renderExtractionInsights();
                });
            }
            if (resetViewBtn) {
                resetViewBtn.onclick = null;
                resetViewBtn.addEventListener('click', () => {
                    window.__ugapFamilleUiState = { hiddenIds: [] };
                    const state = window.__ugapFamilleReview;
                    if (state && Array.isArray(state.editFamilies)) {
                        state.editFamilies.forEach((f) => { f.parentReviewId = null; f.column = f.source === 'ia' ? 'ia' : 'heur'; });
                    }
                    renderExtractionInsights();
                });
            }
            if (validateFamilyBtn) {
                validateFamilyBtn.onclick = null;
                validateFamilyBtn.addEventListener('click', () => {
                    const reviewState = window.__ugapFamilleReview || { editFamilies: [] };
                    const editFamilies = Array.isArray(reviewState.editFamilies) ? reviewState.editFamilies : [];
                    if (editFamilies.length === 0) {
                        showAlert('Aucune famille à enregistrer. Lancez « Détecter familles » ou composez vos familles.', 'warning');
                        return;
                    }
                    const merged = buildSavedFamiliesFromReview(editFamilies);
                    setFamilleValidatedFamilies(merged);
                    window.__ugapFamilleIa = { families: merged };
                    showAlert(`Passe enregistrée : ${merged.length} famille(s) — IA et réglages manuels sont pris en compte.`, 'success');
                    renderExtractionInsights();
                });
            }
            const validatedViewFilter = document.getElementById('fam-validated-filter-view');
            const validatedFamilyFilter = document.getElementById('fam-validated-filter-family');
            const validatedSubFamilyFilter = document.getElementById('fam-validated-filter-subfamily');
            const validatedNonAssignedCb = document.getElementById('fam-validated-filter-non-assigned');
            if (validatedViewFilter) {
                validatedViewFilter.onchange = null;
                validatedViewFilter.addEventListener('change', () => {
                    const st = getFamilleValidatedFilterState();
                    st.businessViewId = String(validatedViewFilter.value || '').trim();
                    renderExtractionInsights();
                });
            }
            if (validatedFamilyFilter) {
                validatedFamilyFilter.onchange = null;
                validatedFamilyFilter.addEventListener('change', () => {
                    const st = getFamilleValidatedFilterState();
                    st.familyName = String(validatedFamilyFilter.value || '').trim();
                    const selectedFamily = st.familyName;
                    if (selectedFamily && validatedSubFamilyFilter) {
                        const availableSubFamilies = new Set(
                            getFamilleValidatedFamilies()
                                .map((f) => parseValidatedFamilyLabel(f?.familyLabel || ''))
                                .filter((x) => x.familyName === selectedFamily && x.subFamilyName)
                                .map((x) => x.subFamilyName)
                        );
                        if (!availableSubFamilies.has(String(st.subFamilyName || '').trim())) {
                            st.subFamilyName = '';
                        }
                    }
                    renderExtractionInsights();
                });
            }
            if (validatedSubFamilyFilter) {
                validatedSubFamilyFilter.onchange = null;
                validatedSubFamilyFilter.addEventListener('change', () => {
                    const st = getFamilleValidatedFilterState();
                    st.subFamilyName = String(validatedSubFamilyFilter.value || '').trim();
                    renderExtractionInsights();
                });
            }
            if (validatedNonAssignedCb) {
                validatedNonAssignedCb.onchange = null;
                validatedNonAssignedCb.addEventListener('change', () => {
                    const st = getFamilleValidatedFilterState();
                    st.showNonAssigned = !!validatedNonAssignedCb.checked;
                    renderExtractionInsights();
                });
            }
            const rawSearchInput = document.getElementById('fam-raw-search');
            const rawOnlyUnassignedCb = document.getElementById('fam-raw-only-unassigned');
            if (rawSearchInput) {
                rawSearchInput.oninput = null;
                rawSearchInput.addEventListener('input', () => {
                    const st = getFamilleRawListFilterState();
                    st.search = String(rawSearchInput.value || '');
                    if (__famRawSearchDebounce) clearTimeout(__famRawSearchDebounce);
                    __famRawSearchDebounce = setTimeout(() => {
                        renderExtractionInsights();
                    }, 180);
                });
            }
            if (rawOnlyUnassignedCb) {
                rawOnlyUnassignedCb.onchange = null;
                rawOnlyUnassignedCb.addEventListener('change', () => {
                    const st = getFamilleRawListFilterState();
                    st.onlyUnassigned = !!rawOnlyUnassignedCb.checked;
                    renderExtractionInsights();
                });
            }
            document.querySelectorAll('.fam-business-view-card').forEach((card) => {
                card.addEventListener('click', () => {
                    const vid = String(card.getAttribute('data-view-id') || '').trim();
                    const st = getFamilleValidatedFilterState();
                    st.businessViewId = vid;
                    renderExtractionInsights();
                });
                card.addEventListener('dragover', (e) => e.preventDefault());
                card.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const vid = String(card.getAttribute('data-view-id') || '').trim();
                    const idx = Number(e.dataTransfer?.getData('text/validated-index'));
                    const list = getFamilleValidatedFamilies();
                    if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
                    const viewLabel = String(card.textContent || '').trim();
                    list[idx].businessViewId = vid;
                    list[idx].businessViewLabel = viewLabel;
                    setFamilleValidatedFamilies(list);
                    showAlert('Vue métier assignée à la famille.', 'success');
                    renderExtractionInsights();
                });
            });
            document.querySelectorAll('.fam-view-select').forEach((sel) => {
                sel.onchange = null;
                sel.addEventListener('change', () => {
                    const idx = Number(sel.getAttribute('data-validated-index'));
                    const viewId = String(sel.value || '').trim();
                    assignFamilyToBusinessView(idx, viewId);
                });
            });
            const extOptionModelFilter = document.getElementById('ext-option-model-filter');
            if (extOptionModelFilter) {
                extOptionModelFilter.onchange = null;
                extOptionModelFilter.addEventListener('change', () => {
                    extractionOptionsModelFilterId = String(extOptionModelFilter.value || '').trim();
                    renderExtractionInsights();
                }, { once: false });
            }
            document.querySelectorAll('[id^="fam-raw-select-"]').forEach((sel) => {
                sel.onchange = null;
                sel.addEventListener('change', () => {
                    const optionId = String(sel.id || '').replace('fam-raw-select-', '');
                    const familyLabel = String(sel.value || '').trim();
                    assignOptionToValidatedFamily(optionId, familyLabel);
                    renderExtractionInsights();
                });
            });
            document.querySelectorAll('.fam-validated-card').forEach((card) => {
                card.addEventListener('dragstart', (e) => {
                    const idx = String(card.getAttribute('data-validated-index') || '').trim();
                    if (e.dataTransfer && idx !== '') {
                        e.dataTransfer.setData('text/validated-index', idx);
                    }
                });
            });
            document.querySelectorAll('.fam-validated-del-btn').forEach((btnDel) => {
                btnDel.onclick = null;
                btnDel.addEventListener('click', () => {
                    const idx = Number(btnDel.getAttribute('data-validated-index'));
                    const list = getFamilleValidatedFamilies();
                    if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
                    list.splice(idx, 1);
                    setFamilleValidatedFamilies(list);
                    if (!window.__ugapFamilleRepassIndices) window.__ugapFamilleRepassIndices = new Set();
                    const newSet = new Set();
                    window.__ugapFamilleRepassIndices.forEach((i) => {
                        if (i < idx) newSet.add(i);
                        else if (i > idx) newSet.add(i - 1);
                    });
                    window.__ugapFamilleRepassIndices = newSet;
                    showAlert('Famille retirée de la liste validée.', 'info');
                    renderExtractionInsights();
                });
            });
            document.querySelectorAll('.fam-repass-ia-btn').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = Number(btn.getAttribute('data-validated-index'));
                    const list = getFamilleValidatedFamilies();
                    if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
                    if (!window.__ugapFamilleRepassIndices) window.__ugapFamilleRepassIndices = new Set();
                    if (window.__ugapFamilleRepassIndices.has(idx)) {
                        window.__ugapFamilleRepassIndices.delete(idx);
                    } else {
                        window.__ugapFamilleRepassIndices.add(idx);
                    }
                    renderExtractionInsights();
                });
            });

            document.querySelectorAll('.fam-option-cb').forEach((cb) => {
                cb.addEventListener('change', () => {
                    const reviewId = cb.getAttribute('data-review-id');
                    const optionId = cb.getAttribute('data-option-id');
                    const state = window.__ugapFamilleReview;
                    const fam = state?.editFamilies?.find((x) => x.reviewId === reviewId);
                    if (!fam) return;
                    if (!cb.checked && isFamNameOptionsLocked(fam)) {
                        const locked = new Set((Array.isArray(fam.lockedOptionIds) ? fam.lockedOptionIds : []).map((id) => String(id)));
                        if (locked.has(String(optionId || ''))) {
                            cb.checked = true;
                            showAlert('Option verrouillée: retrait interdit pour cette famille.', 'warning');
                            return;
                        }
                    }
                    const selected = new Set(Array.isArray(fam.selectedOptionIds) ? fam.selectedOptionIds : []);
                    if (cb.checked) selected.add(optionId); else selected.delete(optionId);
                    fam.selectedOptionIds = Array.from(selected);
                    syncReviewStateIntoIaResult();
                });
            });
            document.querySelectorAll('.fam-label-input').forEach((inp) => {
                inp.addEventListener('input', () => {
                    const reviewId = inp.getAttribute('data-review-id');
                    const state = window.__ugapFamilleReview;
                    const fam = state?.editFamilies?.find((x) => x.reviewId === reviewId);
                    if (!fam) return;
                    if (isFamNameOptionsLocked(fam)) {
                        inp.value = String(fam.familyLabel || 'Famille');
                        showAlert('Nom verrouillé pour cette famille.', 'warning');
                        return;
                    }
                    fam.familyLabel = String(inp.value || '').trim() || 'Famille';
                    syncReviewStateIntoIaResult();
                });
            });
            document.querySelectorAll('.fam-sub-label-input').forEach((inp) => {
                inp.addEventListener('input', () => {
                    const reviewId = inp.getAttribute('data-review-id');
                    const state = window.__ugapFamilleReview;
                    const fam = state?.editFamilies?.find((x) => x.reviewId === reviewId);
                    if (!fam) return;
                    fam.subFamilyLabel = String(inp.value || '').trim();
                    syncReviewStateIntoIaResult();
                });
            });
            document.querySelectorAll('.fam-move-btn').forEach((btnMove) => {
                btnMove.addEventListener('click', () => {
                    const fromId = btnMove.getAttribute('data-review-id');
                    const optionId = btnMove.getAttribute('data-option-id');
                    const select = document.querySelector(`.fam-move-select[data-review-id="${fromId}"][data-option-id="${optionId}"]`);
                    const toId = select?.value;
                    if (!toId || toId === fromId) return;
                    const state = window.__ugapFamilleReview;
                    const fams = Array.isArray(state?.editFamilies) ? state.editFamilies : [];
                    const fromFam = fams.find((x) => x.reviewId === fromId);
                    const toFam = fams.find((x) => x.reviewId === toId);
                    if (!fromFam || !toFam) return;
                    if (isFamNameOptionsLocked(fromFam)) {
                        const locked = new Set((Array.isArray(fromFam.lockedOptionIds) ? fromFam.lockedOptionIds : []).map((id) => String(id)));
                        if (locked.has(String(optionId || ''))) {
                            showAlert('Option verrouillée: déplacement interdit depuis cette famille.', 'warning');
                            return;
                        }
                    }
                    fromFam.optionIds = (fromFam.optionIds || []).filter((id) => id !== optionId);
                    fromFam.selectedOptionIds = (fromFam.selectedOptionIds || []).filter((id) => id !== optionId);
                    if (!Array.isArray(toFam.optionIds)) toFam.optionIds = [];
                    if (!toFam.optionIds.includes(optionId)) toFam.optionIds.push(optionId);
                    if (!Array.isArray(toFam.selectedOptionIds)) toFam.selectedOptionIds = [];
                    if (!toFam.selectedOptionIds.includes(optionId)) toFam.selectedOptionIds.push(optionId);
                    syncReviewStateIntoIaResult();
                    renderExtractionInsights();
                });
            });
            if (window.UgapFamilleTab?.bindPostRenderInteractions) {
                window.UgapFamilleTab.bindPostRenderInteractions();
            }
            syncFamilleColumnsDock();
            } finally {
                __isRenderingExtractionInsights = false;
                if (__pendingExtractionInsightsRender) {
                    __pendingExtractionInsightsRender = false;
                    requestAnimationFrame(() => renderExtractionInsights());
                }
            }
        }

        function switchMappedSummaryTab(tabId) {
            const root = document.getElementById('mapped-summary-root');
            if (!root) return;

            root.querySelectorAll('.mapped-subtab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.target === tabId);
            });
            root.querySelectorAll('.mapped-subpanel').forEach(panel => {
                panel.style.display = panel.id === `mapped-subpanel-${tabId}` ? 'block' : 'none';
            });
        }

        // Fonction pour rendre la vue structurée des résultats
        function renderStructuredView(mappedData, modelId) {
            // Statistiques (affichées même si aucune catégorie)
            const totalCategories = mappedData?.categories?.length || 0;
            const totalItems = mappedData?.categories?.reduce((sum, cat) => {
                const itemsCount = cat.items?.length || 0;
                const subItemsCount = cat.subCategories?.reduce((s, sc) => s + (sc.items?.length || 0), 0) || 0;
                return sum + itemsCount + subItemsCount;
            }, 0) || 0;
            const totalSubCategories = mappedData?.categories?.reduce((sum, cat) => sum + (cat.subCategories?.length || 0), 0) || 0;
            const totalTables = mappedData?.stats?.totalTables ?? null;

            const statsBanner = `
                <div style="margin-bottom: 12px; padding: 10px; background: #e8f4f8; border-radius: 6px; font-size: 13px;">
                    <strong>Statistiques:</strong>
                    ${totalTables !== null ? `${totalTables} tableau(x), ` : ''}${totalCategories} catégorie(s), ${totalSubCategories} sous-catégorie(s), ${totalItems} élément(s)
                </div>
            `;

            const modelOptions = getModelOptionsForSummary(modelId);
            const splitOptions = splitModelOptionsByType(modelOptions);
            const optionsCount = splitOptions.regularOptions.length;
            const minorationsCount = splitOptions.minorationOptions.length;
            const mappedMvPvFamilyGroups = buildMvPvFamilyGroupsFromOptions(splitOptions.minorationOptions);

            const hasMappedCategories = Array.isArray(mappedData?.categories) && mappedData.categories.length > 0;
            
            let html = '<div style="max-height: calc(90vh - 200px); overflow-y: auto;">';
            
            (mappedData?.categories || []).forEach((category, catIndex) => {
                const categoryBg = '#0F4C81';
                const categoryTextColor = '#FFFFFF';
                
                html += `
                    <div style="margin-bottom: 16px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
                        <div style="background: ${categoryBg}; color: ${categoryTextColor}; padding: 12px; font-weight: 600; font-size: 15px;">
                            📁 ${escapeHtml(category.title || 'Sans titre')}
                        </div>
                        <div style="padding: 8px; background: #f9f9f9;">
                `;
                
                // Afficher les sous-catégories si elles existent
                if (category.subCategories && category.subCategories.length > 0) {
                    category.subCategories.forEach((subCategory, subIndex) => {
                        html += `
                            <div style="margin-bottom: 12px; padding: 8px; background: #e8f4f8; border-left: 3px solid #17a2b8; border-radius: 4px;">
                                <div style="font-weight: 600; color: #0F4C81; margin-bottom: 6px; font-size: 14px;">
                                    📂 ${escapeHtml(subCategory.title || 'Sans titre')}
                                </div>
                                <div style="padding-left: 12px;">
                        `;
                        
                        if (!subCategory.items || subCategory.items.length === 0) {
                            html += '<div style="padding: 4px; color: #999; font-style: italic; font-size: 12px;">Aucun élément</div>';
                        } else {
                            subCategory.items.forEach((item, itemIndex) => {
                                const hasCharacteristic = item.characteristic && item.characteristic.trim();
                                const hasValue = item.value && item.value.trim();
                                
                                if (hasCharacteristic && hasValue) {
                                    html += `
                                        <div style="margin-bottom: 4px; padding: 6px; background: white; border-left: 2px solid #B7D1F5; border-radius: 3px; font-size: 12px;">
                                            <span style="font-weight: 500; color: #0F4C81;">🔹 ${escapeHtml(item.characteristic)}</span>
                                            <span style="color: #666; margin-left: 8px;">= ${escapeHtml(item.value)}</span>
                                        </div>
                                    `;
                                } else if (hasCharacteristic) {
                                    html += `
                                        <div style="margin-bottom: 4px; padding: 6px; background: white; border-left: 2px solid #B7D1F5; border-radius: 3px; font-size: 12px;">
                                            <span style="font-weight: 500; color: #0F4C81;">🔹 ${escapeHtml(item.characteristic)}</span>
                                        </div>
                                    `;
                                } else if (hasValue) {
                                    html += `
                                        <div style="margin-bottom: 4px; padding: 6px; background: white; border-left: 2px solid #FFD966; border-radius: 3px; font-size: 12px;">
                                            <span style="color: #666;">💛 ${escapeHtml(item.value)}</span>
                                        </div>
                                    `;
                                }
                            });
                        }
                        
                        html += `
                                </div>
                            </div>
                        `;
                    });
                }
                
                // Afficher les éléments directs de la catégorie
                if (!category.items || category.items.length === 0) {
                    if (!category.subCategories || category.subCategories.length === 0) {
                        html += '<div style="padding: 8px; color: #999; font-style: italic;">Aucun élément</div>';
                    }
                } else {
                    category.items.forEach((item, itemIndex) => {
                        const hasCharacteristic = item.characteristic && item.characteristic.trim();
                        const hasValue = item.value && item.value.trim();
                        
                        if (hasCharacteristic && hasValue) {
                            // Caractéristique + Valeur
                            html += `
                                <div style="margin-bottom: 6px; padding: 8px; background: white; border-left: 3px solid #B7D1F5; border-radius: 4px;">
                                    <div style="font-weight: 500; color: #0F4C81; margin-bottom: 4px;">
                                        🔹 ${escapeHtml(item.characteristic)}
                                    </div>
                                    <div style="color: #666; font-size: 13px; padding-left: 20px;">
                                        = ${escapeHtml(item.value)}
                                    </div>
                                </div>
                            `;
                        } else if (hasCharacteristic) {
                            // Caractéristique seule
                            html += `
                                <div style="margin-bottom: 6px; padding: 8px; background: white; border-left: 3px solid #B7D1F5; border-radius: 4px;">
                                    <div style="font-weight: 500; color: #0F4C81;">
                                        🔹 ${escapeHtml(item.characteristic)}
                                    </div>
                                </div>
                            `;
                        } else if (hasValue) {
                            // Valeur seule
                            html += `
                                <div style="margin-bottom: 6px; padding: 8px; background: white; border-left: 3px solid #FFD966; border-radius: 4px;">
                                    <div style="color: #666;">
                                        💛 ${escapeHtml(item.value)}
                                    </div>
                                </div>
                            `;
                        }
                    });
                }
                
                html += `
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';

            return `
                ${statsBanner}
                <div id="mapped-summary-root">
                    <div style="display:flex; gap:8px; border-bottom:1px solid #eee; margin-bottom:12px; flex-wrap:wrap;">
                        <button class="btn btn-outline mapped-subtab active" data-target="model" onclick="switchMappedSummaryTab('model')">Model</button>
                        <button class="btn btn-outline mapped-subtab" data-target="option" onclick="switchMappedSummaryTab('option')">Option</button>
                        <button class="btn btn-outline mapped-subtab" data-target="minoration" onclick="switchMappedSummaryTab('minoration')">Minoration</button>
                        <button class="btn btn-outline mapped-subtab" data-target="pr" onclick="switchMappedSummaryTab('pr')">PR</button>
                    </div>

                    <div id="mapped-subpanel-model" class="mapped-subpanel" style="display:block;">
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px; margin-bottom:12px;">
                            <div style="padding:10px; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc;">
                                <div style="font-size:12px; color:#666;">Options disponibles (croix)</div>
                                <div style="font-size:20px; font-weight:700; color:#0F4C81;">${optionsCount}</div>
                            </div>
                            <div style="padding:10px; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc;">
                                <div style="font-size:12px; color:#666;">Minorations</div>
                                <div style="font-size:20px; font-weight:700; color:#0F4C81;">${minorationsCount}</div>
                            </div>
                            <div style="padding:10px; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc;">
                                <div style="font-size:12px; color:#666;">Total lignes compatibles modèle</div>
                                <div style="font-size:20px; font-weight:700; color:#0F4C81;">${splitOptions.all.length}</div>
                            </div>
                        </div>
                        <p style="margin:0; color:#666; font-size:12px;">Le nombre d'options est calculé sur les compatibilités du modèle détectées (croix).</p>
                    </div>

                    <div id="mapped-subpanel-option" class="mapped-subpanel" style="display:none;">
                        <table style="width:100%; border-collapse:collapse; border:1px solid #eee;">
                            <thead>
                                <tr style="background:#f8f9fa;">
                                    <th style="padding:8px; border-bottom:1px solid #eee;">Option trouvée</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee;">Réf.</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderOptionRows(splitOptions.regularOptions, 'Aucune option standard trouvée')}
                            </tbody>
                        </table>
                    </div>

                    <div id="mapped-subpanel-minoration" class="mapped-subpanel" style="display:none;">
                        ${renderMinorationDoublonSummaryLine(mappedMvPvFamilyGroups)}
                        <div style="margin-bottom:10px; display:flex; justify-content:space-between; gap:8px; align-items:center; flex-wrap:wrap;">
                            <div style="color:#666; font-size:13px;">Par famille (modèle) — doublons en colonne</div>
                            <button class="btn btn-primary" onclick="showAlert('Assignation IA des minorations à implémenter', 'info')">Assigner les minorations</button>
                        </div>
                        <table style="width:100%; border-collapse:collapse; border:1px solid #eee;">
                            <thead>
                                <tr style="background:#f8f9fa;">
                                    <th style="padding:8px; border-bottom:1px solid #eee;">Famille</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee;">Doublon</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee;">Libellé</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee;">Réf.</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderMinorationOptionRows(splitOptions.minorationOptions, 'Aucune ligne détectée')}
                            </tbody>
                        </table>
                    </div>

                    <div id="mapped-subpanel-pr" class="mapped-subpanel" style="display:none;">
                        <p style="color:#666; font-size:13px; margin-top:0;">Pièces de rechange dont le libellé commence par PR (non traitées pour le moment).</p>
                        <table style="width:100%; border-collapse:collapse; border:1px solid #eee;">
                            <thead>
                                <tr style="background:#f8f9fa;">
                                    <th style="padding:8px; border-bottom:1px solid #eee;">Libellé PR</th>
                                    <th style="padding:8px; border-bottom:1px solid #eee;">Vue métier</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderOptionRows(splitOptions.prOptions, 'Aucune ligne PR détectée')}
                            </tbody>
                        </table>
                    </div>

                    <div id="mapped-subpanel-structure" class="mapped-subpanel" style="display:none;">
                        ${hasMappedCategories
                            ? html
                            : '<div style="padding: 20px; text-align: center; color: #666;">Aucune donnée mappée</div>'}
                    </div>
                </div>
            `;
        }

        // Show mapping results modal (PDF left, results + color swap buttons on right)
        function showMappingResultsModal(pdfUrl, modelId, configId, mappedData, yamlStr, currentColors) {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'mapping-results-modal';
            const prettyJson = JSON.stringify(mappedData || {}, null, 2);
            
            // Récupérer le chemin Excel depuis la configuration si disponible
            const model = currentData.models.find(m => m.id === modelId);
            const config = model?.configurations?.find(c => c.id === configId);
            const excelFileName = config?.pdfAnalysis?.camelotExcelFileName || null;
            const hasExcelFile = !!(excelFileName);
            const excelUrl = excelFileName ? `${API_BASE}/download-excel/${encodeURIComponent(excelFileName)}` : null;
            
            // Déterminer ce qu'on affiche : Excel en priorité, sinon PDF
            const displayType = hasExcelFile ? 'excel' : (pdfUrl ? 'pdf' : 'none');
            
            console.log('🔍 showMappingResultsModal - Fichiers disponibles:', {
                hasExcelFile: hasExcelFile,
                excelFileName: excelFileName,
                excelUrl: excelUrl,
                pdfUrl: pdfUrl,
                displayType: displayType
            });
            
            // Valeurs par défaut pour les couleurs
            const catColor = (currentColors && currentColors.category) || '0F4C81';
            const charColor = (currentColors && currentColors.characteristic) || 'B7D1F5';
            const valColor = (currentColors && currentColors.value) || 'FFD966';
            
            let previewContent = '';
            if (displayType === 'excel') {
                const excelViewUrl = excelFileName ? `${API_BASE}/view-excel/${encodeURIComponent(excelFileName)}` : null;
                previewContent = `
                    <div style="font-weight: 600; margin-bottom: 8px;">Aperçu Excel</div>
                    <div style="margin-bottom: 8px; display: flex; gap: 8px;">
                        <a href="${excelUrl}" target="_blank" class="btn btn-sm btn-success" style="text-decoration: none; display: inline-block; padding: 4px 8px; font-size: 12px;">📥 Télécharger Excel</a>
                        ${excelViewUrl ? `<a href="${excelViewUrl}" target="_blank" class="btn btn-sm btn-primary" style="text-decoration: none; display: inline-block; padding: 4px 8px; font-size: 12px;">👁️ Ouvrir dans nouvel onglet</a>` : ''}
                    </div>
                    ${excelViewUrl ? `
                        <iframe src="${excelViewUrl}" style="width: 100%; height: calc(100% - 80px); border: 1px solid #ddd; border-radius: 4px;"></iframe>
                    ` : `
                        <div style="color: #666; font-size: 13px; padding: 10px; background: #f0f0f0; border-radius: 4px;">
                            <strong>Fichier:</strong> ${escapeHtml(excelFileName)}<br>
                            <em>Impossible d'afficher le fichier Excel.</em>
                        </div>
                    `}
                `;
            } else if (displayType === 'pdf') {
                previewContent = `
                    <div style="font-weight: 600; margin-bottom: 8px;">Aperçu PDF</div>
                    <iframe src="${pdfUrl}" style="width: 100%; height: calc(100% - 30px); border: none;"></iframe>
                `;
            } else {
                previewContent = `
                    <div style="font-weight: 600; margin-bottom: 8px;">Aperçu</div>
                    <div style="color: #666; font-size: 13px; padding: 10px;">
                        Aucun fichier disponible
                    </div>
                `;
            }
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: none; width: 95vw; height: 90vh;">
                    <div class="modal-header" style="position: sticky; top: 0; background: white; z-index: 2;">
                        <div style="display:flex; gap:10px; align-items: center; flex-wrap: wrap;">
                            <h2 style="margin:0;">Résultats du mapping - ${escapeHtml(configId || '')}</h2>
                            <span class="badge" id="badge-tables-count" style="background:#eef;color:#334;">
                                Tableaux: ${mappedData?.stats?.totalTables ?? '—'}
                            </span>
                        </div>
                        <button class="btn btn-danger" onclick="closeMappingResultsModal()">Fermer</button>
                    </div>
                    <div style="padding: 20px; height: calc(90vh - 70px); overflow: hidden;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch; height: calc(90vh - 140px);">
                            <div style="border: 1px solid #eee; border-radius: 6px; padding: 10px; background: #fafafa; height: 100%; overflow: hidden;">
                                ${previewContent}
                            </div>
                            <div style="height: 100%; overflow: auto; border: 1px solid #eee; border-radius: 6px; padding: 12px; background: #fff;">
                                <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                    <button class="btn btn-primary" id="btn-detect-categories">1️⃣ Détecter catégories</button>
                                    <button class="btn btn-primary" id="btn-detect-subcategories" disabled>2️⃣ Détecter sous-catégories</button>
                                    <button class="btn btn-primary" id="btn-detect-values" disabled>3️⃣ Détecter valeurs</button>
                                </div>
                                <div style="margin-bottom: 12px; display:flex; gap:8px; align-items:center; flex-wrap: wrap;">
                                    <button class="btn btn-outline" id="copy-mapped-json">Copier JSON</button>
                                    <button class="btn btn-outline" id="download-mapped-json">Télécharger JSON</button>
                                    <button class="btn btn-outline" id="copy-mapped-yaml">Copier YAML</button>
                                    <button class="btn btn-outline" id="download-mapped-yaml">Télécharger YAML</button>
                                    <button class="btn btn-danger" id="btn-clear-mapped-categories" title="Vider les catégories détectées pour cette configuration (mapping) — ne touche pas aux catégories globales">🧹 Clear catégories (résultat)</button>
                                    ${hasExcelFile ? `
                                        <button class="btn btn-success" id="download-camelot-excel" title="Télécharger le fichier Excel généré par Camelot">📥 Télécharger Excel Camelot</button>
                                    ` : `
                                        <button class="btn btn-outline" disabled title="Fichier Excel non disponible. Relancez le mapping pour générer le fichier.">📥 Excel non disponible</button>
                                    `}
                                    <button class="btn btn-outline" id="toggle-view-mode" style="margin-left: auto;">Vue JSON</button>
                                </div>
                                <!-- Interface d'édition des catégories -->
                                <div id="categories-editor" style="display: none; margin-top: 20px;">
                                    <h3 style="margin-bottom: 15px; color: #333;">Catégories détectées</h3>
                                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6;">
                                        <thead>
                                            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Nom</th>
                                                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Sous-catégories</th>
                                                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Valeurs</th>
                                                <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="categories-editor-tbody">
                                        </tbody>
                                    </table>
                                </div>
                                
                                <!-- Vue structurée (par défaut) -->
                                <div id="structured-view" style="display: block;">
                                    ${renderStructuredView(mappedData, modelId)}
                                </div>
                                
                                <!-- Vue JSON (cachée par défaut) -->
                                <div id="json-view" style="display: none;">
                                    <pre id="mapped-json-pre" style="white-space: pre-wrap; background: #f8f9fa; padding: 12px; border-radius:6px; border:1px solid #eee; max-height:60vh; overflow:auto; font-size: 12px;">${escapeHtml(prettyJson)}</pre>
                                    ${yamlStr ? `<h3 style="margin-top:10px; font-size:14px;">YAML</h3><pre id="mapped-yaml-pre" style="white-space: pre-wrap; background: #fff7e6; padding: 12px; border-radius:6px; border:1px solid #f0e6b6; max-height:200px; overflow:auto; font-size: 12px;">${escapeHtml(yamlStr)}</pre>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Store current colors and model/config IDs for remapping
            modal.dataset.modelId = modelId;
            modal.dataset.configId = configId;
            modal.dataset.currentColors = JSON.stringify(currentColors);
            
            // Boutons de détection
            document.getElementById('btn-detect-categories').addEventListener('click', async () => {
                await detectCategories(modelId, configId);
            });
            
            document.getElementById('btn-detect-subcategories').addEventListener('click', async () => {
                await detectSubCategories(modelId, configId);
            });
            
            document.getElementById('btn-detect-values').addEventListener('click', async () => {
                await detectValues(modelId, configId);
            });
            
            // Toggle view mode
            let viewMode = 'structured'; // 'structured' or 'json'
            document.getElementById('toggle-view-mode').addEventListener('click', () => {
                const structuredView = document.getElementById('structured-view');
                const jsonView = document.getElementById('json-view');
                const toggleBtn = document.getElementById('toggle-view-mode');
                
                if (viewMode === 'structured') {
                    structuredView.style.display = 'none';
                    jsonView.style.display = 'block';
                    toggleBtn.textContent = 'Vue structurée';
                    viewMode = 'json';
                } else {
                    structuredView.style.display = 'block';
                    jsonView.style.display = 'none';
                    toggleBtn.textContent = 'Vue JSON';
                    viewMode = 'structured';
                }
            });

            // Clear mapped categories (pour cette configuration)
            document.getElementById('btn-clear-mapped-categories').addEventListener('click', async () => {
                if (!confirm('Vider les catégories détectées pour cette configuration (résultat du mapping) ?')) return;
                try {
                    await apiCall(`/models/${modelId}/configurations/${configId}/clear-mapped-categories`, { method: 'POST' });
                    await loadData(true);
                    const refreshedModel = currentData.models.find(m => m.id === modelId);
                    const refreshedConfig = refreshedModel?.configurations?.find(c => c.id === configId);
                    const refreshedPdfUrl = refreshedConfig?.pdfAnalysis?.pdfUrl || null;
                    const refreshedMapped = refreshedConfig?.pdfAnalysis?.mapped || { categories: [], stats: { totalCategories: 0, totalItems: 0, totalSubCategories: 0 } };
                    closeMappingResultsModal();
                    showMappingResultsModal(refreshedPdfUrl, modelId, configId, refreshedMapped, null, null);
                    showAlert('Catégories (résultat) vidées', 'success');
                } catch (e) {
                    showAlert('Erreur: ' + (e.message || e), 'error');
                }
            });

            // Helper: update badge from mapped object
            function updateTablesBadgeFromMapped(mappedObj) {
                const badge = document.getElementById('badge-tables-count');
                if (!badge) return;
                const value = mappedObj?.stats?.totalTables;
                badge.textContent = `Tableaux: ${value === undefined || value === null ? '—' : value}`;
            }

            updateTablesBadgeFromMapped(mappedData);

            // Bouton relancer le mapping (si présent)
            const btnRemap = document.getElementById('btn-remap');
            if (btnRemap) {
                btnRemap.addEventListener('click', async () => {
                    closeMappingResultsModal();
                    
                    // Lancer directement le mapping (sans sélection de couleurs)
                    try {
                        showAlert('🔄 Relance du mapping...', 'info');
                        const res = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/map-excel`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({}) // Pas de couleurs
                        });
                        const data = await res.json();
                        if (!res.ok || !data.success) throw new Error(data.message || 'Erreur mapping');
                        
                        // Recharger les données pour avoir la configuration à jour
                        await loadData();
                        const refreshedModel = currentData.models.find(m => m.id === modelId);
                        const refreshedConfig = refreshedModel?.configurations?.find(c => c.id === configId);
                        const refreshedPdfUrl = refreshedConfig?.pdfAnalysis?.pdfUrl || null;
                        
                        // Afficher les nouveaux résultats
                        showMappingResultsModal(refreshedPdfUrl, modelId, configId, data.data.mapped || {}, data.data.yaml || '', null);
                        showAlert('Mapping relancé avec succès', 'success');
                    } catch (err) {
                        console.error('Remap error', err);
                        showAlert('Erreur lors du remapping: ' + err.message, 'error');
                    }
                });
            }

            // Copy/download buttons
            document.getElementById('copy-mapped-json').addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(prettyJson);
                    showAlert('JSON copié dans le presse-papiers', 'success');
                } catch (e) { showAlert('Impossible de copier', 'error'); }
            });
            document.getElementById('download-mapped-json').addEventListener('click', () => {
                const blob = new Blob([prettyJson], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${configId.replace(/[^a-z0-9_-]/ig, '_')}_mapped.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            });
            const copyYamlBtn = document.getElementById('copy-mapped-yaml');
            const dlYamlBtn = document.getElementById('download-mapped-yaml');
            if (copyYamlBtn && dlYamlBtn) {
                copyYamlBtn.addEventListener('click', async () => {
                    try { await navigator.clipboard.writeText(yamlStr || ''); showAlert('YAML copié', 'success'); } catch (e) { showAlert('Impossible de copier YAML', 'error'); }
                });
                dlYamlBtn.addEventListener('click', () => {
                    const blob = new Blob([yamlStr || ''], { type: 'text/yaml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `${configId.replace(/[^a-z0-9_-]/ig, '_')}_mapped.yaml`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                });
            }
            
            // Bouton télécharger Excel Camelot
            const downloadExcelBtn = document.getElementById('download-camelot-excel');
            if (downloadExcelBtn) {
                downloadExcelBtn.addEventListener('click', async () => {
                    try {
                        showAlert('Téléchargement en cours...', 'info');
                        const downloadUrl = `${API_BASE}/models/${modelId}/configurations/${configId}/download-camelot-excel`;
                        
                        // Utiliser fetch pour vérifier d'abord si le fichier existe
                        const response = await fetch(downloadUrl, {
                            method: 'GET',
                            credentials: 'include'
                        });
                        
                        if (!response.ok) {
                            let errorMessage = `Erreur ${response.status}: ${response.statusText}`;
                            try {
                                const errorData = await response.json();
                                errorMessage = errorData.message || errorMessage;
                            } catch (parseErr) {
                                // Si ce n'est pas du JSON, utiliser le texte de la réponse
                                const text = await response.text().catch(() => '');
                                if (text) errorMessage = text;
                            }
                            throw new Error(errorMessage);
                        }
                        
                        // Si OK, télécharger le fichier
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        
                        // Récupérer le nom du fichier depuis les headers
                        const contentDisposition = response.headers.get('Content-Disposition');
                        let filename = `camelot_${configId}.xlsx`;
                        if (contentDisposition) {
                            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                            if (filenameMatch) {
                                filename = filenameMatch[1];
                            }
                        }
                        a.download = filename;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        showAlert('Fichier Excel Camelot téléchargé avec succès', 'success');
                    } catch (e) {
                        console.error('Download error', e);
                        let errorMessage = e.message || 'Erreur inconnue';
                        // Si c'est une erreur de réponse, essayer de parser le JSON
                        if (e.response) {
                            try {
                                const errorData = await e.response.json();
                                errorMessage = errorData.message || errorMessage;
                            } catch (parseErr) {
                                errorMessage = `Erreur ${e.response.status}: ${e.response.statusText}`;
                            }
                        }
                        showAlert('Erreur lors du téléchargement: ' + errorMessage, 'error');
                    }
                });
            }
        }

        // Fonction remapWithColors supprimée (plus besoin de couleurs)

        function closeMappingResultsModal() {
            const m = document.getElementById('mapping-results-modal'); if (m) m.remove();
        }
        function buildOptionIndex() {
            const optionIndex = new Map();
            (currentData.categories || []).forEach(category => {
                (category.options || []).forEach(option => {
                    optionIndex.set(option.id, option);
                });
            });
            return optionIndex;
        }

        function showConfigPdfResults(configId) {
            const modelId = document.getElementById('model-id')?.value;
            const model = currentData.models.find(m => m.id === modelId);
            const config = model?.configurations?.find(c => c.id === configId);
            const analysis = config?.pdfAnalysis;

            if (!analysis) {
                showAlert('Aucune analyse PDF disponible pour cette configuration.', 'info');
                return;
            }

            // Utiliser les données du mapping Camelot (nouveau système)
            const mappedData = analysis.mapped || null;
            const pdfUrl = analysis.pdfUrl || analysis.pdfDataUrl || null;

            if (!mappedData || !mappedData.categories) {
                showAlert('Aucun mapping disponible. Lancez d\'abord le mapping depuis le bouton "🔄 Mapper (Camelot + IA)".', 'info');
                return;
            }

            console.log('🔍 showConfigPdfResults - Vérification Excel:', {
                hasConfig: !!config,
                camelotExcelPath: config?.pdfAnalysis?.camelotExcelPath,
                camelotExcelFileName: config?.pdfAnalysis?.camelotExcelFileName
            });

            // Afficher les résultats avec la vue structurée
            showMappingResultsModal(pdfUrl, modelId, configId, mappedData, null, null);
        }

        function closeConfigPdfResultsModal() {
            const modal = document.getElementById('config-pdf-results-modal');
            if (modal) modal.remove();
        }

        function handleModelImageUpload(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.getElementById('model-image-preview');
                    if (preview) {
                        preview.src = e.target.result;
                    } else {
                        const uploadArea = document.getElementById('model-image-upload');
                        uploadArea.innerHTML = `<img src="${e.target.result}" class="image-preview" id="model-image-preview">`;
                    }
                };
                reader.readAsDataURL(file);
            }
        }

        async function saveModel() {
            const modelId = document.getElementById('model-id').value;
            const name = document.getElementById('model-name').value;
            const basePrice = parseFloat(document.getElementById('model-price').value);
            const imagePreview = document.getElementById('model-image-preview');
            const image = imagePreview ? imagePreview.src : null;
            const motorizationBase = document.getElementById('model-base-motorization')?.value?.trim() || '';
            const deliveryMode = document.getElementById('model-delivery-mode')?.value?.trim() || '';
            const posteRaw = document.getElementById('model-poste-number')?.value;
            const posteNumber = posteRaw ? parseInt(posteRaw, 10) : null;

            const model = currentData.models.find(m => m.id === modelId);
            if (!model) return;

            model.name = name;
            model.basePrice = basePrice;
            model.motorizationBase = motorizationBase;
            model.defaultDeliveryMode = deliveryMode;
            model.posteNumber = Number.isFinite(posteNumber) ? posteNumber : null;
            if (image && image.startsWith('data:')) {
                // TODO: Upload image to server and get URL
                model.image = image; // Temporaire, à remplacer par l'URL réelle
            }

            try {
                // TODO: Sauvegarder via API
                showAlert('Modèle enregistré avec succès', 'success');
                await loadData();
                closeModelModal();
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        // ========================================
        // MODIFICATION COULEUR POUR OPTIONS
        // ========================================
        function modifyOptionColor(categoryId, option) {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'color-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Modifier la couleur: ${option.name}</h2>
                        <button class="btn btn-danger" onclick="closeColorModal()">Fermer</button>
                    </div>
                    <div class="form-group">
                        <label>Couleur</label>
                        <div style="display: flex; align-items: center;">
                            <input type="color" id="option-color" value="${option.color || '#000000'}" class="color-picker">
                            <div class="color-preview" id="color-preview" style="background-color: ${option.color || '#000000'}"></div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                        <button type="button" class="btn btn-outline" onclick="closeColorModal()">Annuler</button>
                        <button type="button" class="btn btn-primary" onclick="saveOptionColor('${categoryId}', '${option.id}')">Enregistrer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('option-color').addEventListener('input', (e) => {
                document.getElementById('color-preview').style.backgroundColor = e.target.value;
            });

            modal.addEventListener('click', (e) => {
                if (e.target.id === 'color-modal') closeColorModal();
            });
        }

        function closeColorModal() {
            const modal = document.getElementById('color-modal');
            if (modal) modal.remove();
        }

        async function saveOptionColor(categoryId, optionId) {
            const color = document.getElementById('option-color').value;
            try {
                // TODO: Sauvegarder via API
                showAlert('Couleur enregistrée avec succès', 'success');
                await loadData();
                closeColorModal();
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        // ========================================
        // CRÉATION COLLECTION DOC-TEMPLATE
        // ========================================
        async function createCollectionForSubCategory(categoryId, subCategory) {
            // D'abord rechercher des collections similaires
            try {
                const searchResponse = await fetch(`/api/ugap/categories/${categoryId}/subcategories/${subCategory.id}/search-collections`, {
                    credentials: 'include'
                });

                if (searchResponse.ok) {
                    const searchResult = await searchResponse.json();
                    if (searchResult.success && searchResult.data.similarCollections.length > 0) {
                        // Afficher un modal de sélection
                        showCollectionSelectionModal(categoryId, subCategory, searchResult.data.similarCollections);
                        return;
                    }
                }
            } catch (error) {
                console.warn('Erreur lors de la recherche de collections similaires:', error);
            }

            // Si aucune collection similaire, afficher directement le formulaire de création
            showCreateCollectionForm(categoryId, subCategory);
        }

        function showCollectionSelectionModal(categoryId, subCategory, similarCollections) {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'collection-selection-modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2>Collections existantes trouvées</h2>
                        <button class="btn btn-danger" onclick="closeCollectionSelectionModal()">Fermer</button>
                    </div>
                    <div style="padding: 20px;">
                        <p style="margin-bottom: 20px;">
                            Des collections similaires à "<strong>${subCategory.name}</strong>" ont été trouvées. 
                            Souhaitez-vous utiliser une collection existante ou créer une nouvelle ?
                        </p>
                        <div style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
                            ${similarCollections.map((collection, index) => `
                                <div class="config-item" style="margin-bottom: 10px; cursor: pointer;" onclick="selectExistingCollection('${categoryId}', '${subCategory.id}', '${collection._id}')">
                                    <div style="flex: 1;">
                                        <strong>${collection.name}</strong>
                                        <span class="badge" style="margin-left: 10px; background: ${collection.similarity > 0.7 ? '#28a745' : collection.similarity > 0.5 ? '#ffc107' : '#17a2b8'}; color: white;">
                                            ${Math.round(collection.similarity * 100)}% similaire
                                        </span>
                                        ${collection.description ? `<p style="color: #666; margin: 5px 0; font-size: 14px;">${collection.description}</p>` : ''}
                                        <p style="color: #999; margin: 5px 0; font-size: 12px;">
                                            ${(collection.fields || []).length} champ(s) • Créée le ${new Date(collection.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <button class="btn btn-primary">Utiliser</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
                            <button class="btn btn-success" onclick="showCreateCollectionForm('${categoryId}', ${JSON.stringify(subCategory).replace(/"/g, '&quot;')})">
                                ➕ Créer une nouvelle collection
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target.id === 'collection-selection-modal') closeCollectionSelectionModal();
            });
        }

        function closeCollectionSelectionModal() {
            const modal = document.getElementById('collection-selection-modal');
            if (modal) modal.remove();
        }

        async function selectExistingCollection(categoryId, subCategoryId, collectionId) {
            try {
                // Lier la collection à la sous-catégorie
                const linkResponse = await fetch(`/api/ugap/categories/${categoryId}/subcategories/${subCategoryId}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idDocTemplate: collectionId })
                });

                if (!linkResponse.ok) {
                    throw new Error('Erreur lors de la liaison de la collection');
                }

                closeCollectionSelectionModal();
                showAlert('Collection liée avec succès !', 'success');
                await loadData();
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        function showCreateCollectionForm(categoryId, subCategory) {
            // Fermer le modal de sélection s'il existe
            closeCollectionSelectionModal();

            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'create-collection-modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header">
                        <h2>Créer une collection pour: ${subCategory.name}</h2>
                        <button class="btn btn-danger" onclick="closeCreateCollectionModal()">Fermer</button>
                    </div>
                    <form id="collection-form">
                        <div class="form-group">
                            <label>Nom de la collection *</label>
                            <input type="text" id="collection-name" value="${subCategory.name}" required>
                        </div>
                        <div class="form-group">
                            <label>Slug *</label>
                            <input type="text" id="collection-slug" value="${subCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}" required>
                            <small style="color: #666;">Identifiant unique (lettres, chiffres, tirets uniquement)</small>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="collection-description" rows="3">${subCategory.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Champs de la collection</label>
                            <div id="collection-fields"></div>
                            <button type="button" class="btn btn-success" onclick="addCollectionField()" style="margin-top: 10px;">+ Ajouter un champ</button>
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                            <button type="button" class="btn btn-primary" onclick="buildCollectionWithAI('${categoryId}', '${subCategory.id}')">🤖 Construire la collection par IA</button>
                            <button type="button" class="btn btn-outline" onclick="closeCreateCollectionModal()">Annuler</button>
                            <button type="submit" class="btn btn-primary">Créer la collection</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            // Initialiser avec un champ par défaut
            addCollectionField();

            document.getElementById('collection-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveCollection(categoryId, subCategory.id);
            });

            modal.addEventListener('click', (e) => {
                if (e.target.id === 'create-collection-modal') closeCreateCollectionModal();
            });
        }

        function closeCreateCollectionModal() {
            const modal = document.getElementById('create-collection-modal');
            if (modal) modal.remove();
        }

        function addCollectionField() {
            const container = document.getElementById('collection-fields');
            if (!container) return;
            const fieldIndex = container.children.length;
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'form-group';
            fieldDiv.style.border = '1px solid #eee';
            fieldDiv.style.padding = '15px';
            fieldDiv.style.borderRadius = '6px';
            fieldDiv.style.marginBottom = '10px';
            fieldDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong>Champ ${fieldIndex + 1}</strong>
                    <button type="button" class="btn btn-danger" onclick="this.parentElement.parentElement.remove()">Supprimer</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label>Label *</label>
                        <input type="text" class="field-label" required>
                    </div>
                    <div>
                        <label>Type *</label>
                        <select class="field-type" required>
                            <option value="Texte" data-typeRef="string">Texte</option>
                            <option value="TextArea" data-typeRef="string">Zone de texte</option>
                            <option value="Lien" data-typeRef="string">Lien</option>
                            <option value="Number" data-typeRef="number">Nombre</option>
                            <option value="Boolean" data-typeRef="boolean">Oui / Non</option>
                            <option value="Date" data-typeRef="date">Date</option>
                            <option value="DateTime" data-typeRef="date">Date & Heure</option>
                            <option value="Couleur" data-typeRef="color">Couleur</option>
                            <option value="Fichier" data-typeRef="file">Fichier</option>
                            <option value="Image" data-typeRef="file">Image</option>
                            <option value="Enum" data-typeRef="string">Liste de valeurs</option>
                            <option value="SousCollection" data-typeRef="array">Sous-collection</option>
                            <option value="DocumentGeneré" data-typeRef="document">Document généré</option>
                            <option value="Relation" data-typeRef="Relation">Relation</option>
                        </select>
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    <label><input type="checkbox" class="field-required"> Champ requis</label>
                </div>
            `;
            container.appendChild(fieldDiv);
        }

        async function saveCollection(categoryId, subCategoryId) {
            const name = document.getElementById('collection-name').value;
            const slug = document.getElementById('collection-slug').value;
            const description = document.getElementById('collection-description').value;
            
            const fields = [];
            document.querySelectorAll('#collection-fields > div').forEach((fieldDiv, index) => {
                const label = fieldDiv.querySelector('.field-label').value;
                const typeSelect = fieldDiv.querySelector('.field-type');
                const type = typeSelect.value; // Ex: "Texte", "Number", etc.
                const selectedOption = typeSelect.options[typeSelect.selectedIndex];
                const typeRef = selectedOption.getAttribute('data-typeref'); // Ex: "string", "number", etc.
                const required = fieldDiv.querySelector('.field-required').checked;
                
                if (label && type && typeRef) {
                    const fieldName = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                    const field = {
                        id: fieldName,
                        position: index,
                        typeRef: typeRef,
                        type: type,
                        label: label,
                        name: fieldName,
                        required: required,
                        defaultValue: null,
                        validationOverrides: {},
                        relation: null,
                        ui: {}
                    };
                    
                    // Gérer les valeurs par défaut selon le type
                    if (type === 'Couleur') {
                        field.defaultValue = '#000000';
                    } else if (type === 'Number') {
                        field.defaultValue = 0;
                    } else if (type === 'Boolean') {
                        field.defaultValue = false;
                    }
                    
                    fields.push(field);
                }
            });

            try {
                const response = await fetch('/api/doc-template/collections', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, slug, description, fields })
                });

                if (!response.ok) throw new Error('Erreur lors de la création de la collection');

                const result = await response.json();
                if (!result.success) throw new Error(result.message || 'Erreur');

                // Lier la collection à la sous-catégorie
                const collectionId = result.data._id || result.data.id;
                try {
                    const linkResponse = await fetch(`/api/ugap/categories/${categoryId}/subcategories/${subCategoryId}`, {
                        method: 'PUT',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idDocTemplate: collectionId })
                    });

                    if (!linkResponse.ok) {
                        console.warn('⚠️ Impossible de lier la collection à la sous-catégorie, mais la collection a été créée');
                    }
                } catch (linkError) {
                    console.warn('⚠️ Erreur lors de la liaison:', linkError);
                }

                showAlert('Collection créée avec succès et liée à la sous-catégorie', 'success');
                closeCreateCollectionModal();
                await loadData();
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        async function buildCollectionWithAI(categoryId, subCategoryId) {
            const category = currentData.categories.find(c => c.id === categoryId);
            if (!category) return;
            
            const subCategory = (category.subCategories || []).find(sc => sc.id === subCategoryId);
            if (!subCategory) return;

            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'ai-generation-modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 700px;">
                    <div class="modal-header">
                        <h2>🤖 Génération de collection par IA</h2>
                        <button class="btn btn-danger" onclick="closeAIGenerationModal()">Fermer</button>
                    </div>
                    <div id="ai-generation-status" style="padding: 20px;">
                        <p>Analyse de la sous-catégorie "<strong>${subCategory.name}</strong>"...</p>
                        <div class="progress-bar" style="margin-top: 15px;">
                            <div class="progress-bar-fill" id="ai-progress-bar" style="width: 0%;"></div>
                        </div>
                        <div id="ai-generation-log" style="margin-top: 15px; max-height: 300px; overflow-y: auto; background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px;"></div>
                        <div id="ai-improve-section" style="margin-top: 20px; display: none;">
                            <div style="background: #e7f3ff; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff;">
                                <p style="margin: 0 0 10px 0;"><strong>💡 Première proposition générée</strong></p>
                                <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">Souhaitez-vous améliorer cette proposition avec des recherches web pour enrichir les champs ?</p>
                                <button id="btn-improve-with-web" class="btn btn-primary" style="margin-right: 10px;">🌐 Améliorer avec recherche web</button>
                                <button id="btn-keep-first" class="btn btn-outline">✓ Garder cette proposition</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const logDiv = document.getElementById('ai-generation-log');
            const progressBar = document.getElementById('ai-progress-bar');

            function addLog(message) {
                const time = new Date().toLocaleTimeString();
                logDiv.innerHTML += `<div>[${time}] ${message}</div>`;
                logDiv.scrollTop = logDiv.scrollHeight;
            }

            function updateProgress(percent) {
                progressBar.style.width = percent + '%';
            }

            // Fonction pour remplir le formulaire avec les champs
            function fillFormWithFields(fields) {
                const fieldsContainer = document.getElementById('collection-fields');
                if (!fieldsContainer) return;
                
                fieldsContainer.innerHTML = '';
                fields.forEach((field, index) => {
                        const fieldDiv = document.createElement('div');
                        fieldDiv.className = 'form-group';
                        fieldDiv.style.border = '1px solid #eee';
                        fieldDiv.style.padding = '15px';
                        fieldDiv.style.borderRadius = '6px';
                        fieldDiv.style.marginBottom = '10px';
                        fieldDiv.style.background = '#f0f8ff';
                        
                        const typeMap = {
                            'Texte': 'Texte',
                            'TextArea': 'TextArea',
                            'Number': 'Number',
                            'Boolean': 'Boolean',
                            'Date': 'Date',
                            'DateTime': 'DateTime',
                            'Couleur': 'Couleur',
                            'Fichier': 'Fichier',
                            'Image': 'Image',
                            'Enum': 'Enum'
                        };
                        
                        const fieldType = typeMap[field.type] || 'Texte';
                        
                        fieldDiv.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <strong>Champ ${index + 1} (Généré par IA)</strong>
                                <button type="button" class="btn btn-danger" onclick="this.parentElement.parentElement.remove()">Supprimer</button>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <label>Label *</label>
                                    <input type="text" class="field-label" value="${field.label || ''}" required>
                                </div>
                                <div>
                                    <label>Type *</label>
                                    <select class="field-type" required>
                                        <option value="Texte" data-typeref="string" ${fieldType === 'Texte' ? 'selected' : ''}>Texte</option>
                                        <option value="TextArea" data-typeref="string" ${fieldType === 'TextArea' ? 'selected' : ''}>Zone de texte</option>
                                        <option value="Lien" data-typeref="string">Lien</option>
                                        <option value="Number" data-typeref="number" ${fieldType === 'Number' ? 'selected' : ''}>Nombre</option>
                                        <option value="Boolean" data-typeref="boolean" ${fieldType === 'Boolean' ? 'selected' : ''}>Oui / Non</option>
                                        <option value="Date" data-typeref="date" ${fieldType === 'Date' ? 'selected' : ''}>Date</option>
                                        <option value="DateTime" data-typeref="date" ${fieldType === 'DateTime' ? 'selected' : ''}>Date & Heure</option>
                                        <option value="Couleur" data-typeref="color" ${fieldType === 'Couleur' ? 'selected' : ''}>Couleur</option>
                                        <option value="Fichier" data-typeref="file" ${fieldType === 'Fichier' ? 'selected' : ''}>Fichier</option>
                                        <option value="Image" data-typeref="file" ${fieldType === 'Image' ? 'selected' : ''}>Image</option>
                                        <option value="Enum" data-typeref="string" ${fieldType === 'Enum' ? 'selected' : ''}>Liste de valeurs</option>
                                        <option value="SousCollection" data-typeref="array">Sous-collection</option>
                                        <option value="DocumentGeneré" data-typeref="document">Document généré</option>
                                        <option value="Relation" data-typeref="Relation">Relation</option>
                                    </select>
                                </div>
                            </div>
                            <div style="margin-top: 10px;">
                                <label><input type="checkbox" class="field-required" ${field.required ? 'checked' : ''}> Champ requis</label>
                            </div>
                            ${field.description ? `<div style="margin-top: 5px; color: #666; font-size: 12px; font-style: italic;">💡 ${field.description}</div>` : ''}
                        `;
                    fieldsContainer.appendChild(fieldDiv);
                });
            }

            // Fonction pour générer la collection (avec ou sans recherche web)
            async function generateCollection(useWebSearch = false) {
                try {
                    updateProgress(10);
                    addLog('📝 Préparation de l\'analyse...');

                    updateProgress(30);
                    addLog('🔍 Envoi de la requête à l\'IA...');
                    if (useWebSearch) {
                        addLog('🌐 Recherche web en cours...');
                    }

                    // Appel à l'API UGAP pour la génération
                    addLog('🔗 Connexion à l\'IA...');
                    const aiResponse = await fetch(`/api/ugap/categories/${categoryId}/subcategories/${subCategoryId}/generate-collection`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            useWebSearch: useWebSearch
                        })
                    });

                    if (!aiResponse.ok) {
                        throw new Error('Erreur lors de l\'appel à l\'IA');
                    }

                    updateProgress(70);
                    addLog('✅ Réponse reçue, analyse en cours...');

                    const aiResult = await aiResponse.json();
                    if (!aiResult.success) {
                        throw new Error(aiResult.message || 'Erreur lors de la génération');
                    }

                    const { fields, reasoning, webResults } = aiResult.data;
                    
                    if (webResults && webResults.length > 0) {
                        addLog(`🌐 ${webResults.length} résultat(s) de recherche web utilisé(s)`);
                    }

                    updateProgress(90);
                    addLog(`✅ ${fields.length} champ(s) détecté(s)`);
                    if (reasoning) {
                        addLog(`💡 Raisonnement: ${reasoning.substring(0, 200)}...`);
                    }

                    // Remplir le formulaire avec les champs générés
                    fillFormWithFields(fields);

                    updateProgress(100);
                    
                    return { fields, reasoning, webResults };
                } catch (error) {
                    addLog('❌ Erreur: ' + error.message);
                    throw error;
                }
            }

            // Étape 1 : Générer le premier jet sans recherche web
            try {
                const firstResult = await generateCollection(false);
                
                // Afficher la section d'amélioration
                const improveSection = document.getElementById('ai-improve-section');
                if (improveSection) {
                    improveSection.style.display = 'block';
                    
                    // Bouton pour améliorer avec recherche web
                    document.getElementById('btn-improve-with-web').addEventListener('click', async () => {
                        improveSection.style.display = 'none';
                        addLog('🌐 Amélioration avec recherche web...');
                        updateProgress(0);
                        
                        try {
                            await generateCollection(true);
                            addLog('✅ Collection améliorée avec succès !');
                            setTimeout(() => {
                                closeAIGenerationModal();
                                showAlert('Collection améliorée par IA avec succès !', 'success');
                            }, 1500);
                        } catch (error) {
                            showAlert('Erreur lors de l\'amélioration: ' + error.message, 'error');
                        }
                    });
                    
                    // Bouton pour garder la première proposition
                    document.getElementById('btn-keep-first').addEventListener('click', () => {
                        closeAIGenerationModal();
                        showAlert('Collection générée par IA avec succès !', 'success');
                    });
                } else {
                    // Si pas de section d'amélioration, fermer directement
                    setTimeout(() => {
                        closeAIGenerationModal();
                        showAlert('Collection générée par IA avec succès !', 'success');
                    }, 1500);
                }
            } catch (error) {
                showAlert('Erreur lors de la génération: ' + error.message, 'error');
            }
        }

        function closeAIGenerationModal() {
            const modal = document.getElementById('ai-generation-modal');
            if (modal) modal.remove();
        }

        // ========================================
        // AJOUTER OPTION À COLLECTION
        // ========================================
        function addOptionToCollection(categoryId, option, subCategory) {
            if (!subCategory.idDocTemplate) {
                showAlert('Cette sous-catégorie n\'a pas de collection associée', 'error');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'add-to-collection-modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header">
                        <h2>Ajouter "${option.name}" à la collection</h2>
                        <button class="btn btn-danger" onclick="closeAddToCollectionModal()">Fermer</button>
                    </div>
                    <p style="color: #666; margin-bottom: 20px;">Remplissez les champs de la collection pour cet élément:</p>
                    <form id="collection-element-form">
                        <div id="collection-element-fields"></div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                            <button type="button" class="btn btn-primary" onclick="fillCollectionWithAI('${categoryId}', '${option.id}', '${subCategory.idDocTemplate}')">🤖 Remplir avec IA</button>
                            <button type="button" class="btn btn-outline" onclick="closeAddToCollectionModal()">Annuler</button>
                            <button type="submit" class="btn btn-primary">Ajouter à la collection</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            // Charger la structure de la collection
            loadCollectionStructure(subCategory.idDocTemplate);

            document.getElementById('collection-element-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveCollectionElement(subCategory.idDocTemplate, option);
            });

            modal.addEventListener('click', (e) => {
                if (e.target.id === 'add-to-collection-modal') closeAddToCollectionModal();
            });
        }

        function closeAddToCollectionModal() {
            const modal = document.getElementById('add-to-collection-modal');
            if (modal) modal.remove();
        }

        async function loadCollectionStructure(collectionId) {
            try {
                const response = await fetch(`/api/doc-template/collections/${collectionId}`, {
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Erreur lors du chargement de la collection');
                
                const result = await response.json();
                if (!result.success) throw new Error(result.message || 'Erreur');

                const collection = result.data;
                const fieldsContainer = document.getElementById('collection-element-fields');
                if (!fieldsContainer) return;
                fieldsContainer.innerHTML = '';

                (collection.fields || []).forEach(field => {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.className = 'form-group';
                    fieldDiv.innerHTML = `
                        <label>${field.label}${field.required ? ' *' : ''}</label>
                        ${getFieldInput(field)}
                    `;
                    fieldsContainer.appendChild(fieldDiv);
                });
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        function getFieldInput(field) {
            const fieldId = field.id;
            const required = field.required ? 'required' : '';
            const defaultValue = field.defaultValue || '';
            
            // Utiliser le type (nom) plutôt que typeRef pour déterminer le type d'input
            const fieldType = field.type || '';
            
            switch (fieldType) {
                case 'Texte':
                case 'Lien':
                case 'Enum':
                    return `<input type="text" class="collection-field" data-field-id="${fieldId}" value="${defaultValue}" ${required}>`;
                case 'TextArea':
                    return `<textarea class="collection-field" data-field-id="${fieldId}" ${required}>${defaultValue}</textarea>`;
                case 'Number':
                    return `<input type="number" class="collection-field" data-field-id="${fieldId}" value="${defaultValue}" ${required}>`;
                case 'Boolean':
                    return `<input type="checkbox" class="collection-field" data-field-id="${fieldId}" ${defaultValue ? 'checked' : ''}>`;
                case 'Date':
                    return `<input type="date" class="collection-field" data-field-id="${fieldId}" value="${defaultValue}" ${required}>`;
                case 'DateTime':
                    return `<input type="datetime-local" class="collection-field" data-field-id="${fieldId}" value="${defaultValue}" ${required}>`;
                case 'Couleur':
                    return `<input type="color" class="collection-field" data-field-id="${fieldId}" value="${defaultValue || '#000000'}" ${required}>`;
                case 'Fichier':
                case 'Image':
                    return `<input type="file" class="collection-field" data-field-id="${fieldId}" ${required}>`;
                case 'SousCollection':
                    return `<div class="collection-field" data-field-id="${fieldId}" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;">
                        <p style="color: #666; margin: 0;">Sous-collection (à implémenter)</p>
                    </div>`;
                case 'DocumentGeneré':
                    return `<div class="collection-field" data-field-id="${fieldId}" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;">
                        <p style="color: #666; margin: 0;">Document généré (à implémenter)</p>
                    </div>`;
                case 'Relation':
                    return `<select class="collection-field" data-field-id="${fieldId}" ${required}>
                        <option value="">-- Sélectionner --</option>
                        <!-- Les options seront chargées dynamiquement -->
                    </select>`;
                default:
                    // Fallback basé sur typeRef si type n'est pas défini
                    switch (field.typeRef) {
                        case 'string':
                            return `<input type="text" class="collection-field" data-field-id="${fieldId}" value="${defaultValue}" ${required}>`;
                        case 'number':
                            return `<input type="number" class="collection-field" data-field-id="${fieldId}" value="${defaultValue}" ${required}>`;
                        case 'boolean':
                            return `<input type="checkbox" class="collection-field" data-field-id="${fieldId}" ${defaultValue ? 'checked' : ''}>`;
                        case 'date':
                            return `<input type="date" class="collection-field" data-field-id="${fieldId}" value="${defaultValue}" ${required}>`;
                        default:
                            return `<input type="text" class="collection-field" data-field-id="${fieldId}" value="${defaultValue}" ${required}>`;
                    }
            }
        }

        async function saveCollectionElement(collectionId, option) {
            const element = {};
            document.querySelectorAll('.collection-field').forEach(input => {
                const fieldId = input.dataset.fieldId;
                if (input.type === 'checkbox') {
                    element[fieldId] = input.checked;
                } else {
                    element[fieldId] = input.value;
                }
            });

            try {
                // TODO: Ajouter l'élément à la collection via API
                showAlert('Élément ajouté à la collection avec succès', 'success');
                closeAddToCollectionModal();
            } catch (error) {
                showAlert('Erreur: ' + error.message, 'error');
            }
        }

        async function fillCollectionWithAI(categoryId, optionId, collectionId) {
            // TODO: Implémenter le remplissage par IA
            alert('Fonctionnalité "Remplir avec IA" à implémenter');
        }

        // Fonctions de détection pour le mapping
        async function detectCategories(modelId, configId) {
            try {
                showAlert('🔄 Détection des catégories en cours...', 'info');
                const res = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/map-excel`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ step: 'categories' })
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || 'Erreur détection catégories');
                
                const mapped = data.data.mapped || { categories: [] };

                // Mettre à jour l'indicateur "Tableaux" dans l'entête du modal si présent
                const badge = document.getElementById('badge-tables-count');
                if (badge) {
                    const value = mapped?.stats?.totalTables;
                    badge.textContent = `Tableaux: ${value === undefined || value === null ? '—' : value}`;
                }
                
                // Mettre à jour directement la vue canvas/sous-menus
                const structuredView = document.getElementById('structured-view');
                const jsonView = document.getElementById('json-view');
                const editorDiv = document.getElementById('categories-editor');
                if (structuredView) {
                    structuredView.style.display = 'block';
                    structuredView.innerHTML = renderStructuredView(mapped, modelId);
                }
                if (jsonView) jsonView.style.display = 'none';
                if (editorDiv) editorDiv.style.display = 'none';
                
                // Activer le bouton suivant
                document.getElementById('btn-detect-subcategories').disabled = false;
                const tablesMsg = (mapped?.stats?.totalTables !== undefined && mapped?.stats?.totalTables !== null)
                    ? ` • ${mapped.stats.totalTables} tableau(x)`
                    : '';
                showAlert(`✅ ${mapped.categories.length} catégorie(s) détectée(s)${tablesMsg}`, 'success');
            } catch (err) {
                console.error('Detect categories error', err);
                showAlert('Erreur lors de la détection des catégories: ' + err.message, 'error');
            }
        }

        async function detectSubCategories(modelId, configId) {
            try {
                showAlert('🔄 Détection des sous-catégories en cours...', 'info');
                const res = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/map-excel`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ step: 'subcategories' })
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || 'Erreur détection sous-catégories');
                
                const mapped = data.data.mapped || { categories: [] };
                
                // Mettre à jour directement la vue canvas/sous-menus
                const structuredView = document.getElementById('structured-view');
                const jsonView = document.getElementById('json-view');
                const editorDiv = document.getElementById('categories-editor');
                if (structuredView) {
                    structuredView.style.display = 'block';
                    structuredView.innerHTML = renderStructuredView(mapped, modelId);
                }
                if (jsonView) jsonView.style.display = 'none';
                if (editorDiv) editorDiv.style.display = 'none';
                
                // Activer le bouton suivant
                document.getElementById('btn-detect-values').disabled = false;
                showAlert('✅ Sous-catégories détectées', 'success');
            } catch (err) {
                console.error('Detect subcategories error', err);
                showAlert('Erreur lors de la détection des sous-catégories: ' + err.message, 'error');
            }
        }

        async function detectValues(modelId, configId) {
            try {
                showAlert('🔄 Détection des valeurs en cours...', 'info');
                const res = await fetch(`${API_BASE}/models/${modelId}/configurations/${configId}/map-excel`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ step: 'values' })
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || 'Erreur détection valeurs');
                
                const mapped = data.data.mapped || { categories: [] };
                
                // Mettre à jour directement la vue canvas/sous-menus
                const structuredView = document.getElementById('structured-view');
                const jsonView = document.getElementById('json-view');
                const editorDiv = document.getElementById('categories-editor');
                if (structuredView) {
                    structuredView.style.display = 'block';
                    structuredView.innerHTML = renderStructuredView(mapped, modelId);
                }
                if (jsonView) jsonView.style.display = 'none';
                if (editorDiv) editorDiv.style.display = 'none';
                
                showAlert('✅ Valeurs détectées', 'success');
            } catch (err) {
                console.error('Detect values error', err);
                showAlert('Erreur lors de la détection des valeurs: ' + err.message, 'error');
            }
        }

        function renderCategoriesEditor(categories) {
            const tbody = document.getElementById('categories-editor-tbody');
            const editorDiv = document.getElementById('categories-editor');
            
            if (!tbody || !editorDiv) return;
            
            editorDiv.style.display = 'block';
            tbody.innerHTML = '';
            
            if (!categories || categories.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #666;">Aucune catégorie détectée</td></tr>';
                return;
            }
            
            categories.forEach((category, index) => {
                const subCategoriesCount = (category.subCategories || []).length;
                const itemsCount = (category.items || []).length;
                const subItemsCount = (category.subCategories || []).reduce((sum, sc) => sum + (sc.items?.length || 0), 0);
                const totalValues = itemsCount + subItemsCount;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 10px; border: 1px solid #dee2e6;">
                        <input type="text" value="${escapeHtml(category.title || '')}" 
                               data-category-id="${category.id}" 
                               data-field="title"
                               style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"
                               onchange="updateCategoryField('${category.id}', 'title', this.value)">
                    </td>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">
                        <span class="badge">${subCategoriesCount} sous-catégorie(s)</span>
                    </td>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">
                        <span class="badge">${totalValues} valeur(s)</span>
                    </td>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">
                        <button class="btn btn-outline" onclick="editCategoryMapping('${category.id}')">Modifier</button>
                        <button class="btn btn-danger" onclick="deleteCategoryMapping('${category.id}')">Supprimer</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function updateCategoryField(categoryId, field, value) {
            // TODO: Sauvegarder la modification
            console.log('Update category field', categoryId, field, value);
        }

        function editCategoryMapping(categoryId) {
            // TODO: Ouvrir modal d'édition
            alert('Édition de catégorie à implémenter');
        }

        function deleteCategoryMapping(categoryId) {
            if (confirm('Supprimer cette catégorie ?')) {
                // TODO: Supprimer la catégorie
                console.log('Delete category', categoryId);
            }
        }

        // Init - Charger les données au chargement de la page
        // Les cookies sont gérés par le système GDRI central, pas par ce module
        document.addEventListener('DOMContentLoaded', () => {
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
            refreshImportStagingIndicator();
            loadData();
        });
    </script>
    <script src="/modules/ugap/frontend/assets/js/ugap-import-minorations-workflow.js?v=13"></script>
    <script src="/modules/ugap/frontend/assets/js/ugap-import-tab.js?v=2"></script>
    <script src="/modules/ugap/frontend/assets/js/tabs/famille-tab.js?v=1"></script>
</body>
</html>
