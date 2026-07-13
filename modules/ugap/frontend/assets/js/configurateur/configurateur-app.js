        const API_BASE = '/api/ugap';
        /* isEmbeddedMode, applyEmbeddedLayout, scheduleParentEmbedResize → ugap-embed-layout.js */

        let configurateurPublishedData = null;
        if (typeof window.getUgapCurrentData !== 'function') {
            window.getUgapCurrentData = () => configurateurPublishedData;
        }
        if (typeof window.setUgapCurrentData !== 'function') {
            window.setUgapCurrentData = (next) => {
                configurateurPublishedData = next && typeof next === 'object' ? next : null;
            };
        }

        function publishConfiguratorDataToGlobals() {
            const payload = {
                models: Array.isArray(state.models) ? state.models : [],
                categories: Array.isArray(state.categories) ? state.categories : [],
                uiState: state.uiState && typeof state.uiState === 'object' ? state.uiState : {},
            };
            if (typeof window.setUgapCurrentData === 'function') {
                window.setUgapCurrentData(payload);
            } else {
                configurateurPublishedData = payload;
            }
        }

        const state = {
            showEntryScreen: true,
            step: 1,
            models: [],
            categories: [],
            uiState: null,
            optionTabs: [],
            tabFamiliesById: new Map(),
            selectedModel: null,
            selectedConfig: null,
            selectedOptions: new Set(),
            fivePercentOptions: new Set(),
            fivePercentCustomOptions: [],
            use5Percent: false,
            budget5Percent: 0,
            excelTabFilters: { name: '', selection: 'all' },
            excelAllRows: [],
            categoryTableFilters: { name: '', selection: 'all' },
            categoryTableAllRows: [],
            categoryTableExpandedGroups: new Set(),
            familyModalContext: null,
            _fivePercentGroupModalContext: null,
            templateTreePath: [],
            templateTreeRootIndex: -1,
            _boatTemplateResolved: null,
            importBaseProducts: [],
            devisName: '',
            devisPrintTemplates: [],
            devisDisplayOptions: {
                showIncludedLines: false
            },
            openedSavedDevisId: null,
            savedDevisVersions: [],
            savedDevisFilters: { name: '', dateOrder: 'desc' },
            selectedClientId: null,
            clientInfo: null,
            commercialId: null,
            devisContext: null,
            clients: [],
            showNewClientForm: false,
            clientFormIsEdit: false,
            _devisMetaLoaded: false,
            _catalogueOptionByIdMap: null,
            _validatedFamiliesPrepared: null,
            _categoryTableRowsCache: null,
            _categoryTableRowsCacheKey: '',
            _replacedIbpLinkedAdjIds: null
        };
        let ugapZones = { use: false, configure: false };
        const SAVED_DEVIS_STORAGE_KEY = 'ugap.configurateur.savedDevis.v1';
        const SAVED_DEVIS_MIGRATED_KEY = 'ugap.configurateur.savedDevis.migrated.v1';
        const DEVIS_PRINT_ICON_SVG = '<svg class="ugap-devis-print-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 19v2h12v-2H6zm12-8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H6C4.9 3 4 3.9 4 5v4c0 1.1.9 2 2 2h1v4h10v-4h1zm-2 0H6V5h12v6zm-8 4h8v2h-8v-2z"/></svg>';

        function resolveConfiguratorApiBase() {
            return API_BASE;
        }

        function normalizeDevisDisplayOptions(raw) {
            const src = raw && typeof raw === 'object' ? raw : {};
            return {
                showIncludedLines: src.showIncludedLines === true
            };
        }

        function getDevisDisplayOptions() {
            state.devisDisplayOptions = normalizeDevisDisplayOptions(state.devisDisplayOptions);
            return state.devisDisplayOptions;
        }

        function resolveTemplateQuickPrintLabel(template) {
            const tpl = template && typeof template === 'object' ? template : {};
            const shortName = String(tpl.shortName || '').trim();
            if (shortName) return shortName;
            return String(tpl.name || tpl.namespace || 'Modèle').trim() || 'Modèle';
        }

        function getDevisTemplateByNamespace(namespace) {
            const ns = String(namespace || '').trim();
            if (!ns) return null;
            return (state.devisPrintTemplates || []).find((t) => String(t?.namespace || '') === ns) || null;
        }

        function templateShowsIncludedLines(template) {
            return template?.showIncludedLines === true;
        }

        // API helper
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
                if (error.message && error.message.includes('JSON')) {
                    throw new Error('Erreur de communication avec le serveur. Vérifiez que le backend est démarré.');
                }
                throw error;
            }
        }

        // Load data
        async function loadData() {
            try {
                const perms = await apiCall('/permissions');
                ugapZones = (perms && perms.data && perms.data.zones) ? perms.data.zones : { use: false, configure: false };
                if (!ugapZones.use) {
                    throw new Error('Vous n\'avez pas la permission d\'utiliser le module UGAP.');
                }

                const result = await apiCall('/data', { allowBusinessError: true });
                if (!result.success && result.message === 'Aucune donnée configurée') {
                    state.models = [];
                    state.categories = [];
                    state.uiState = null;
                    invalidateConfiguratorCaches();
                } else {
                    state.models = (result.data && result.data.models) || [];
                    state.categories = (result.data && result.data.categories) || [];
                    state.importBaseProducts = Array.isArray(result.data?.importBaseProducts)
                        ? result.data.importBaseProducts
                        : [];
                    state.uiState = (result.data && result.data.uiState) || null;
                    applyServerUiStateToLocal(state.uiState);
                    publishConfiguratorDataToGlobals();
                    syncConfiguratorModelBaseContext();
                }
                invalidateConfiguratorCaches();
                await loadSavedDevisFromApi();
                await loadDevisPrintTemplates();
                await tryMigrateLocalStorageOnce();
                render();
                renderSavedDevisChoices();
            } catch (error) {
                const errorMsg = error.message || 'Erreur inconnue';
                if (errorMsg.includes('404') || errorMsg.includes('Aucune donnée')) {
                    state.models = [];
                    state.categories = [];
                    state.uiState = null;
                    render();
                } else {
                    alert('Erreur lors du chargement: ' + errorMsg + '\n\nVérifiez que:\n- Le backend Node.js est démarré\n- Vous êtes authentifié\n- Le module UGAP est chargé');
                }
            } finally {
                document.getElementById('loader').classList.add('hidden');
                document.getElementById('content').classList.remove('hidden');
                if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
            }
        }

        // Render
        function render() {
            const entryEl = document.getElementById('ugap-configurator-entry');
            const indicatorEl = document.querySelector('.step-indicator');
            const stepEls = document.querySelectorAll('.step-content');
            if (entryEl) {
                entryEl.style.display = state.showEntryScreen ? 'block' : 'none';
            }
            if (indicatorEl) {
                indicatorEl.style.display = state.showEntryScreen ? 'none' : '';
            }
            stepEls.forEach((el) => {
                if (state.showEntryScreen) {
                    el.classList.remove('active');
                    el.style.display = 'none';
                } else {
                    el.style.display = '';
                }
            });
            if (state.showEntryScreen) {
                if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
                return;
            }
            updateStepIndicator();
            
            if (state.step === 1) {
                if (window.UgapConfiguratorClientStep?.render) {
                    void window.UgapConfiguratorClientStep.render(state);
                }
            } else if (state.step === 2) {
                renderStep1();
            } else if (state.step === 3) {
                renderStep2();
            } else if (state.step === 4) {
                renderStep3();
            }
            if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
        }

        // Update step indicator
        function updateStepIndicator() {
            if (state.showEntryScreen) return;
            document.querySelectorAll('.step').forEach((step, index) => {
                const stepNum = index + 1;
                step.classList.remove('active', 'completed');
                if (stepNum === state.step) {
                    step.classList.add('active');
                } else if (stepNum < state.step) {
                    step.classList.add('completed');
                }
            });

            document.querySelectorAll('.step-content').forEach((content, index) => {
                content.classList.remove('active');
                if (index + 1 === state.step) {
                    content.classList.add('active');
                }
            });
        }

        // Step 1: Models
        function renderStep1() {
            const container = document.getElementById('models-container');
            container.innerHTML = '';

            state.models.forEach(model => {
                const card = document.createElement('div');
                card.className = 'model-card';
                if (state.selectedModel && state.selectedModel.id === model.id) {
                    card.classList.add('selected');
                }
                card.innerHTML = `
                    <h3>${model.name}</h3>
                    <div class="price">${(model.basePrice || 0).toFixed(2)} €</div>
                `;
                card.onclick = () => selectModel(model);
                container.appendChild(card);
            });
        }

        function selectModel(model) {
            state.selectedModel = model;
            state.selectedConfig = null;
            state.selectedOptions.clear();
            state.fivePercentOptions.clear();
            state.categoryTableExpandedGroups = new Set();
            invalidateBillableDerivationCache();
            state._categoryTableRowsCache = null;
            state._categoryTableRowsCacheKey = '';
            state._modelBaseDefaultsAppliedForModelId = '';
            if (window.UgapConfiguratorTemplateTree?.onModelSelected) {
                window.UgapConfiguratorTemplateTree.onModelSelected(state);
            }
            goToStep(3);
        }

        function getTemplateTreeHooks() {
            return {
                tabsContainer: document.getElementById('category-tabs'),
                subcategoriesContainer: document.getElementById('subcategories-container'),
                optionsContainer: document.getElementById('options-container'),
                updateSummary,
                onResize: scheduleParentEmbedResize,
                setStep3Hint: setStep3ParcoursHint,
                getOptionInclusionKind,
                getOptionInclusionLabel,
                isBaseCatalogOption,
                isMotorTarifCatalogOption: isCatalogMotorTarifOption,
                getCatalogOptionById: (optionId) => getCatalogOptionById(optionId),
                isOptionCompatibleWithModel: (opt) => isOptionCompatibleWithSelectedModel(opt),
                onCategoryTableChanged: refreshCategoryTableIfVisible,
                getBoatTemplateLabel: () => {
                    const tpl = window.UgapConfiguratorTemplateTree?.getBoatTemplateForModel?.(state);
                    return String(tpl?.label || '').trim();
                },
                renderCategoryTable: (container, opts) => {
                    const extra = opts && typeof opts === 'object' ? opts : {};
                    if (state._openDevisPerf) {
                        state._deferredCategoryTableBanner = extra.bannerHtml || '';
                        container.innerHTML = `${extra.bannerHtml || ''}
                            <div class="ugap-category-table-loading" style="padding:28px 16px;text-align:center;color:#64748b;">
                                <div class="loader" style="margin:0 auto 14px;"></div>
                                <span style="font-size:14px;font-weight:600;">Chargement des options…</span>
                            </div>`;
                        return;
                    }
                    const tab = {
                        id: '__model_category_table__',
                        name: state.selectedModel?.name || 'Modèle',
                        layoutType: 'category_table'
                    };
                    renderCategoryTableOptions(tab, container, extra);
                },
                getExcelTabLabel: () => UGAP_EXCEL_VIEW_LABEL,
                renderExcelTable: (container) => {
                    renderExcelCategoryOptions(
                        {
                            id: '__template_excel_tab__',
                            name: UGAP_EXCEL_VIEW_LABEL,
                            layoutType: 'excel'
                        },
                        container
                    );
                }
            };
        }

        function refreshCategoryTableIfVisible() {
            if (!document.getElementById('ugap-category-table-tbody')) return;
            refreshCategoryTableBody();
        }

        /** Coche les lignes du tableau Excel si l’onglet est affiché. */
        function syncConfiguratorExcelTable() {
            if (!document.getElementById('ugap-excel-options-tbody')) return;
            state.excelAllRows = collectExcelCatalogRows();
            refreshExcelOptionsTable();
        }

        /** Rafraîchit les cellules choix/prix du parcours template (mino liée visible). */
        function syncConfiguratorDevisTable() {
            const Tpl = window.UgapConfiguratorTemplateTree;
            if (typeof Tpl?.refreshDevisTableChoiceCells === 'function') {
                Tpl.refreshDevisTableChoiceCells(state, getTemplateTreeHooks());
            }
        }

        /**
         * Aligne selectedOptions sur les mino/majo facturées (appendLinkedAdjForReplacedIbps).
         * Le récap déduisait déjà le prix sans cocher la ligne dans l’UI.
         */
        function materializeReplacedIbpLinkedAdjInSelection() {
            invalidateBillableDerivationCache();
            const ids = new Set();
            appendLinkedAdjForReplacedIbps(ids);
            ids.forEach((id) => {
                const oid = String(id || '').trim();
                if (oid) state.selectedOptions.add(oid);
            });
        }

        function isMotorisationBusinessViewName(name) {
            const n = String(name || '').trim().toLowerCase();
            return /\bmotorisation\b/.test(n) || /^moteurs?$/.test(n);
        }

        /** Remplace l’onglet vue métier « Motorisation » par le tableau Excel (évite doublon). */
        function mapMotorisationTabsToExcel(viewTabs) {
            const list = Array.isArray(viewTabs) ? viewTabs : [];
            const hasExcel = list.some((t) => isExcelBusinessViewTab(t));
            return list
                .filter((tab) => !(hasExcel && isMotorisationBusinessViewName(tab?.name)))
                .map((tab) => {
                    if (!isMotorisationBusinessViewName(tab?.name)) return tab;
                    if (hasExcel) return null;
                    return {
                        ...tab,
                        name: UGAP_EXCEL_VIEW_LABEL,
                        layoutType: 'excel'
                    };
                })
                .filter(Boolean);
        }

        // Step 2: Configurations (presets paramétrage → uiState.modelConfigurations)
        function resolveConfiguratorConfigsForModel(model) {
            const mid = String(model?.id || '').trim();
            if (!mid) return [];

            const rawList = state.uiState?.modelConfigurations?.[mid];
            if (Array.isArray(rawList) && rawList.length) {
                const MBO = window.UgapModelBaseOptions;
                return rawList.map((c) => {
                    const id = String(c?.id || '').trim();
                    if (!id) return null;
                    const label = String(c?.label || 'Configuration').trim() || 'Configuration';
                    let description = c.isDefault ? 'Configuration par défaut' : 'Preset paramétré';
                    if (MBO?.getConfigurationStatus) {
                        const st = MBO.getConfigurationStatus(model, id);
                        const filled = Number(st?.filledCount) || 0;
                        const total = Number(st?.totalSlots) || 0;
                        if (total > 0) {
                            description = `${filled}/${total} option${total !== 1 ? 's' : ''} préconfigurée${filled !== 1 ? 's' : ''}`;
                            if (c.isDefault) description += ' · par défaut';
                        }
                    }
                    return {
                        id,
                        name: label,
                        description,
                        image: null,
                        slotPicks: c.slotPicks && typeof c.slotPicks === 'object' ? { ...c.slotPicks } : {},
                        isDefault: c.isDefault === true,
                    };
                }).filter(Boolean);
            }

            const legacy = Array.isArray(model?.configurations) ? model.configurations : [];
            if (legacy.length) {
                return legacy.map((c) => ({
                    id: String(c?.id || '').trim(),
                    name: String(c?.name || c?.label || 'Configuration').trim() || 'Configuration',
                    description: String(c?.description || '').trim(),
                    image: c?.image || null,
                    slotPicks: c?.slotPicks && typeof c.slotPicks === 'object' ? { ...c.slotPicks } : undefined,
                })).filter((c) => c.id);
            }

            const picks = state.uiState?.modelBaseSlotPicks?.[mid];
            if (picks && typeof picks === 'object' && Object.keys(picks).length) {
                return [{
                    id: `cfg_default_${mid}`,
                    name: 'UGAP',
                    description: 'Options de base du catalogue.',
                    image: null,
                    slotPicks: { ...picks },
                    isDefault: true,
                }];
            }
            return [];
        }

        function renderStep2() {
            document.getElementById('selected-model-name').textContent = state.selectedModel?.name || '-';
            
            const container = document.getElementById('configs-container');
            container.innerHTML = '';

            syncConfiguratorModelBaseContext();
            const configs = resolveConfiguratorConfigsForModel(state.selectedModel);
            const fallbackConfig = {
                id: 'default-config',
                name: 'Configuration par défaut',
                description: 'Aucune configuration définie — paramétrez-les dans Modèles.',
                image: null,
            };
            const configsToRender = configs.length > 0 ? configs : [fallbackConfig];

            configsToRender.forEach(config => {
                const card = document.createElement('div');
                card.className = 'config-card';
                if (state.selectedConfig && state.selectedConfig.id === config.id) {
                    card.classList.add('selected');
                }
                card.innerHTML = `
                    ${config.image ? `<img src="${config.image}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 10px;">` : ''}
                    <h3>${config.name}</h3>
                    ${config.description ? `<p style="color: #666; font-size: 14px; margin: 5px 0;">${config.description}</p>` : ''}
                `;
                card.onclick = () => selectConfig(config);
                container.appendChild(card);
            });
        }

        function selectConfig(config) {
            state.selectedConfig = config && typeof config === 'object' ? { ...config } : config;
            state.selectedOptions.clear();
            state.fivePercentOptions.clear();
            invalidateBillableDerivationCache();
            state._categoryTableRowsCache = null;
            state._categoryTableRowsCacheKey = '';
            state._modelBaseDefaultsAppliedForModelId = '';
            syncConfiguratorModelBaseContext();
            if (!String(state.devisName || '').trim()) {
                state.devisName = buildDefaultDevisName();
            }
            goToStep(4);
        }

        function mergeBoatTemplatesForConfigurator(serverList) {
            const server = Array.isArray(serverList) ? serverList : [];
            let local = [];
            try {
                const raw = localStorage.getItem('ugap.templateBateau.saved');
                local = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(local)) local = [];
            } catch (_) {
                local = [];
            }
            const byId = new Map();
            local.forEach((t) => {
                const id = String(t?.id || '').trim();
                if (id) byId.set(id, t);
            });
            server.forEach((t) => {
                const id = String(t?.id || '').trim();
                if (id) byId.set(id, t);
            });
            return Array.from(byId.values());
        }

        function setStep3ParcoursHint(templateMode, reason) {
            const title = document.getElementById('ugap-step3-views-hint');
            const desc = document.getElementById('ugap-step3-views-desc');
            if (!title || !desc) return;
            if (templateMode) {
                const tplLabel = escapeHtml(
                    window.UgapConfiguratorTemplateTree?.getBoatTemplateForModel?.(state)?.label || ''
                );
                title.textContent = 'Composez votre devis';
                if (reason === 'ok') {
                    desc.innerHTML = tplLabel
                        ? `Tableau <strong>Catégorie · Sous-nœud · Option</strong> (arbre catalogue uniquement). Cliquez sur une ligne pour choisir. Bateau : <strong>${tplLabel}</strong>.`
                        : `Liez un bateau de base dans Paramétrage → Modèles pour activer le parcours catalogue.`;
                } else {
                    const reasonMessages = {
                        missing_template: 'Template lié introuvable. Enregistrez-le dans <strong>Template bateau</strong>, puis rechargez la page.',
                        empty_tree: 'Aucun nœud catalogue pour ce modèle. Paramétrez l’arborescence dans <strong>Catalogue</strong> et les options de base dans <strong>Modèles</strong>.',
                        catalog_nodes_missing: 'Le catalogue publié n’est pas disponible dans le configurateur. Rechargez la page (Ctrl+F5) ou republiez depuis le paramétrage.',
                        no_groups: 'Aucun poste catalogue sur ce modèle. Assignez les options de base par nœud dans <strong>Modèles → Définir options de base</strong>.',
                        module_unavailable: 'Le module template bateau n’est pas chargé correctement. Rechargez la page.',
                        catalog_core_unavailable: 'Le module catalogue (catalogue-nodes-core.js) n’est pas chargé. Rechargez la page (Ctrl+F5).'
                    };
                    desc.innerHTML = reasonMessages[reason]
                        || 'Le template bateau n’est pas encore valide. Vérifiez la structure du template, puis rechargez la page.';
                }
                return;
            }
            title.textContent = 'Vues métier (sans template sur le modèle)';
            desc.innerHTML = 'Les onglets sont des <strong>vues métier</strong> (ancien flux). Pour le parcours par arbre : liez un template sur le modèle dans l’admin.';
        }

        // Step 3: template bateau OU vues métier (legacy) si le modèle n’a pas de template
        function applyServerUiStateToLocal(uiState) {
            const src = uiState && typeof uiState === 'object' ? uiState : {};
            const families = Array.isArray(src.families) ? src.families : [];
            const { rules: businessViews } = ensureConfiguratorBusinessViewRules(src.businessViews);
            const boatTemplates = mergeBoatTemplatesForConfigurator(src.boatTemplates);
            state.uiState = { ...src, businessViews, boatTemplates };
            if (families.length) {
                try {
                    localStorage.setItem('ugap.famille.validatedFamilies', JSON.stringify(families));
                } catch (_) {
                    // no-op
                }
            }
            if (boatTemplates.length) {
                try {
                    localStorage.setItem('ugap.templateBateau.saved', JSON.stringify(boatTemplates));
                } catch (_) {
                    // no-op
                }
            }
        }

        function invalidateConfiguratorCaches() {
            state._catalogueOptionByIdMap = null;
            state._validatedFamiliesPrepared = null;
            state._categoryTableRowsCache = null;
            state._categoryTableRowsCacheKey = '';
            state._replacedIbpLinkedAdjIds = null;
        }

        function invalidateBillableDerivationCache() {
            state._replacedIbpLinkedAdjIds = null;
        }

        function getCategoryTableRowsCacheKey() {
            const mid = String(state.selectedModel?.id || '');
            const catCount = (Array.isArray(state.categories) ? state.categories : []).length;
            const famCount = (Array.isArray(state.uiState?.families) ? state.uiState.families : []).length;
            const custom5 = (Array.isArray(state.fivePercentCustomOptions) ? state.fivePercentCustomOptions : []).length;
            const tplId = String(state.selectedModel?.boatTemplateId || '');
            return `${mid}|${tplId}|${catCount}|${famCount}|${custom5}`;
        }

        function collectDecisionGroupsForModelDefaults() {
            const groups = [];
            const Tree = window.UgapBoatTemplateTree;
            const catalogueFamilies = getValidatedFamiliesForBusinessViews();
            const optionById = getCatalogueOptionByIdMap();
            getCategoryTableCatalogueCategories().forEach((category) => {
                const resolved = Tree?.resolveCategoryFamiliesWithGroups
                    ? Tree.resolveCategoryFamiliesWithGroups(category, catalogueFamilies)
                    : [];
                resolved.forEach((fam) => {
                    const famLabel = String(fam?.familyLabel || '').trim();
                    const src = Tree?.findCatalogueFamily
                        ? Tree.findCatalogueFamily(catalogueFamilies, {
                            familyLabel: famLabel,
                            sourceIndex: fam.sourceIndex
                        })
                        : catalogueFamilies.find((f) =>
                            String(f?.familyLabel || '').trim().toLowerCase() === famLabel.toLowerCase()
                        );
                    const defId = src?.defaultOptionId != null
                        ? String(src.defaultOptionId).trim()
                        : '';
                    (Array.isArray(fam?.decisionGroups) ? fam.decisionGroups : []).forEach((g) => {
                        const catalogueOptionIds = (Array.isArray(g?.optionIds) ? g.optionIds : [])
                            .map((x) => String(x || '').trim())
                            .filter(Boolean);
                        if (!catalogueOptionIds.length) return;
                        groups.push(buildConfiguratorGroupObject(fam, g, optionById, defId));
                    });
                });
            });
            return groups;
        }

        /** Applique les picks du modèle de base (single + multi) avant affichage du devis. */
        function applyConfiguratorDefaultsFromModelBase(force) {
            if (!state.selectedModel) return;
            const mid = String(state.selectedModel?.id || '').trim();
            if (!force && state._modelBaseDefaultsAppliedForModelId === mid) return;
            state._modelBaseDefaultsAppliedForModelId = mid;

            syncConfiguratorModelBaseContext();
            const Tpl = window.UgapConfiguratorTemplateTree;
            const hooks = getTemplateTreeHooks();
            if (typeof Tpl?.applyDefaultSelectionsForParcours === 'function') {
                Tpl.applyDefaultSelectionsForParcours(state, hooks);
            }
            const groups = collectDecisionGroupsForModelDefaults();
            if (groups.length && typeof Tpl?.ensureSingleChoiceDefaultsForGroups === 'function') {
                Tpl.ensureSingleChoiceDefaultsForGroups(state, groups, hooks);
            }
            syncConfiguratorDevisTable();
            syncConfiguratorExcelTable();
            refreshCategoryTableIfVisible();
            invalidateBillableDerivationCache();
        }

        function getCategoryTableRows() {
            const key = getCategoryTableRowsCacheKey();
            if (state._categoryTableRowsCache && state._categoryTableRowsCacheKey === key) {
                return state._categoryTableRowsCache;
            }
            applyConfiguratorDefaultsFromModelBase();
            const rows = collectCategoryTableRows();
            state._categoryTableRowsCache = rows;
            state._categoryTableRowsCacheKey = key;
            return rows;
        }

        function getValidatedFamiliesForBusinessViews() {
            if (Array.isArray(state._validatedFamiliesPrepared)) {
                return state._validatedFamiliesPrepared;
            }
            const serverFamilies = Array.isArray(state.uiState?.families) ? state.uiState.families : [];
            let list = serverFamilies;
            if (!list.length) {
                try {
                    const raw = localStorage.getItem('ugap.famille.validatedFamilies');
                    const parsed = raw ? JSON.parse(raw) : [];
                    list = Array.isArray(parsed) ? parsed : [];
                } catch (_) {
                    list = [];
                }
            }
            if (window.UgapBoatTemplateTree?.prepareCatalogueFamiliesForConfigurator) {
                state._validatedFamiliesPrepared = window.UgapBoatTemplateTree.prepareCatalogueFamiliesForConfigurator(list);
            } else {
                state._validatedFamiliesPrepared = list.map((f, idx) => ({ ...f, __idx: idx }));
            }
            return state._validatedFamiliesPrepared;
        }

        function getCatalogueOptionByIdMap() {
            if (state._catalogueOptionByIdMap) return state._catalogueOptionByIdMap;
            const Tree = window.UgapBoatTemplateTree;
            const categories = Array.isArray(state.categories) ? state.categories : [];
            if (Tree?.buildCatalogueOptionById) {
                state._catalogueOptionByIdMap = Tree.buildCatalogueOptionById(categories);
            } else {
                const map = new Map();
                categories.forEach((cat) => {
                    (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                        const id = String(opt?.id || '').trim();
                        if (id && !map.has(id)) map.set(id, opt);
                    });
                });
                state._catalogueOptionByIdMap = map;
            }
            return state._catalogueOptionByIdMap;
        }

        function normalizeLabelAsId(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }

        function parseFamilyHierarchyLabel(value) {
            const full = String(value || '').trim();
            if (!full) {
                return { family: '', subFamily: '' };
            }
            const parts = full
                .split('/')
                .map((p) => String(p || '').trim())
                .filter(Boolean);
            if (parts.length <= 1) {
                return { family: full, subFamily: '' };
            }
            return {
                family: parts[0],
                subFamily: parts.slice(1).join(' / ')
            };
        }

        function getValidatedFamilyRootLabel(fam) {
            const parsed = parseFamilyHierarchyLabel(fam?.familyLabel || '');
            return String(parsed.family || fam?.familyLabel || '').trim();
        }

        function normalizeFamilyDecisionGroups(rawGroups) {
            const rows = Array.isArray(rawGroups) ? rawGroups : [];
            return rows
                .map((g, index) => {
                    const id = String(g?.id || `group_${index + 1}`).trim();
                    const label = String(g?.label || id || '').trim();
                    const rawType = String(g?.type || '').trim().toLowerCase();
                    const type = rawType === 'model' ? 'model' : (rawType === 'static' ? 'static' : 'option');
                    const decisionMode = String(g?.decisionMode || '').trim().toLowerCase() === 'multi_choice'
                        ? 'multi_choice'
                        : 'single_choice';
                    const optionIds = (Array.isArray(g?.optionIds) ? g.optionIds : [])
                        .map((x) => String(x || '').trim())
                        .filter(Boolean);
                    // Compat backward/forward: certains payloads exposent seulement group.options.
                    const fallbackOptionIds = (Array.isArray(g?.options) ? g.options : [])
                        .map((opt) => {
                            if (typeof opt === 'string') return String(opt || '').trim();
                            return String(opt?.id || '').trim();
                        })
                        .filter(Boolean);
                    const mergedOptionIds = Array.from(new Set([...(optionIds || []), ...fallbackOptionIds]));
                    const priceMode = String(g?.priceMode || g?.pricingMode || 'option').trim().toLowerCase() || 'option';
                    return id && label ? { id, label, type, decisionMode, optionIds: mergedOptionIds, priceMode, pricingMode: priceMode } : null;
                })
                .filter(Boolean);
        }

        function syncFamilyOptionsToDecisionGroups(family) {
            const FCmp = window.UgapFamilyComponents;
            if (FCmp?.syncOptionsToComponents) return FCmp.syncOptionsToComponents(family);
            return family;
        }

        function getCatalogOptionById(optionId) {
            const oid = String(optionId || '').trim();
            if (!oid) return null;
            for (const cat of Array.isArray(state.categories) ? state.categories : []) {
                const hit = (Array.isArray(cat?.options) ? cat.options : []).find(
                    (o) => String(o?.id || '').trim() === oid
                );
                if (hit) return hit;
            }
            syncConfiguratorModelBaseContext();
            const rec = window.UgapModelBaseOptions?.findOptionRecord?.(oid)?.option;
            return rec || null;
        }

        function isOptionCompatibleWithSelectedModel(opt) {
            const mid = String(state.selectedModel?.id || '').trim();
            if (!mid) return true;
            const comp = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map((x) => String(x)) : [];
            if (comp.length === 0) return !!opt?.isDivers;
            return comp.includes(mid);
        }

        function isSelectableCatalogOption(opt) {
            return !isBaseCatalogOption(opt) && isOptionCompatibleWithSelectedModel(opt);
        }

        function isFivePercentCatalogOption(opt) {
            return getOptionInclusionKind(opt) === 'devis_5pct';
        }

        /** Lignes catalogue d’un groupe (filtre modèle ; exclut les options 5% devis). */
        function resolveConfiguratorGroupOptions(group, optionById) {
            const model = state.selectedModel;
            const ids = Array.isArray(group?.optionIds) ? group.optionIds : [];
            return ids
                .map((id) => optionById.get(String(id || '').trim()))
                .filter((opt) => opt
                    && passesCategoryTableModelFilter(opt, model)
                    && !isFivePercentCatalogOption(opt));
        }

        function resolveConfiguratorGroupFivePercentOptions(group, optionById) {
            const model = state.selectedModel;
            const ids = Array.isArray(group?.optionIds) ? group.optionIds : [];
            return ids
                .map((id) => optionById.get(String(id || '').trim()))
                .filter((opt) => opt
                    && passesCategoryTableModelFilter(opt, model)
                    && isFivePercentCatalogOption(opt));
        }

        function buildConfiguratorGroupObject(fam, g, optionById, defaultOptionId) {
            const optionIds = (Array.isArray(g?.optionIds) ? g.optionIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            const options = resolveConfiguratorGroupOptions({ ...g, optionIds }, optionById);
            const familyLabel = String(fam?.familyLabel || g?.familyLabel || '').trim();
            const componentId = String(g?.componentId || '').trim();
            const componentLabel = String(g?.componentLabel || '').trim();
            const groupId = String(g?.id || g?.groupId || '').trim();
            const priceMode = String(g?.priceMode || g?.pricingMode || 'option').trim().toLowerCase();
            const base = {
                familyLabel,
                componentId: componentId || undefined,
                componentLabel: componentLabel || undefined,
                groupId,
                label: String(g?.label || groupId).trim(),
                decisionMode: String(g?.decisionMode || '').trim() === 'multi_choice' ? 'multi_choice' : 'single_choice',
                priceMode,
                pricingMode: priceMode,
                optionIds,
                options,
                defaultOptionId: defaultOptionId || undefined
            };
            const Tpl = window.UgapConfiguratorTemplateTree;
            const hooks = getTemplateTreeHooks();
            return Tpl?.hydrateGroupOptions ? Tpl.hydrateGroupOptions(state, base, hooks) : base;
        }

        function categoryTableGroupKey(group) {
            const fam = String(group?.familyLabel || '').trim();
            const comp = String(group?.componentId || '').trim();
            const gid = String(group?.groupId || '').trim();
            return comp ? `${fam}:${comp}:${gid}` : `${fam}:${gid}`;
        }

        function buildCategoryTableFivePctButtonHtml(gkey) {
            return `<button type="button" class="cat-table-five-pct btn btn-outline" data-cat-group="${gkey}"
                style="padding:4px 10px;font-size:11px;font-weight:600;line-height:1.3;white-space:nowrap;border-radius:6px;margin-left:auto;"
                title="Créer ou choisir une option 5%">Créer une option 5%</button>`;
        }

        function getFivePercentOptionsForGroup(ctx) {
            const group = ctx?.group;
            if (!group) return { catalogue: [], custom: [] };
            const fam = String(ctx.familyLabel || group.familyLabel || '').trim();
            const gid = String(group.groupId || '').trim();
            const optionById = getCatalogueOptionByIdMap();
            const catalogue = resolveConfiguratorGroupFivePercentOptions(group, optionById);
            const compId = String(group.componentId || '').trim();
            const custom = (state.fivePercentCustomOptions || []).filter((opt) =>
                String(opt.familyLabel || '').trim() === fam
                && String(opt.groupId || '').trim() === gid
                && (!compId || String(opt.componentId || '').trim() === compId)
            );
            return { catalogue, custom };
        }

        function isFivePercentCustomOptionCounted(opt) {
            if (!opt || typeof opt !== 'object') return false;
            const hasGroup = String(opt.familyLabel || '').trim() && String(opt.groupId || '').trim();
            if (!hasGroup) return true;
            return opt.selected === true;
        }

        function isFivePercentGroupOptionSelected(optId) {
            const id = String(optId || '').trim();
            if (!id) return false;
            if (state.fivePercentOptions.has(id)) return true;
            const custom = (state.fivePercentCustomOptions || []).find((o) => o.id === id);
            return custom ? isFivePercentCustomOptionCounted(custom) : false;
        }

        function catalogUgapPrice(opt) {
            const ODN = window.UgapOptionDisplayName;
            if (ODN?.resolveCatalogOptionUgapPrice) return ODN.resolveCatalogOptionUgapPrice(opt);
            if (!opt) return 0;
            const ugap = Number(opt.priceUgap);
            if (Number.isFinite(ugap)) return ugap;
            return Number(opt.priceClient) || 0;
        }

        function getFivePercentOptionPrice(opt) {
            if (!opt) return 0;
            if (Number.isFinite(Number(opt.price))) return Number(opt.price);
            return catalogUgapPrice(opt);
        }

        function tryAddFivePercentPriceDelta(price) {
            if (!state.use5Percent) {
                alert('Activez d\'abord les options supplémentaires à 5% du devis (section ci-dessous).');
                return false;
            }
            const p = Number(price) || 0;
            if (state.budget5Percent > 0 && getFivePercentTotal() + p > state.budget5Percent) {
                alert('Budget 5% dépassé !');
                return false;
            }
            return true;
        }

        function renderFivePercentGroupModalContent() {
            const body = document.getElementById('five-percent-group-modal-body');
            const ctx = state._fivePercentGroupModalContext;
            if (!body || !ctx?.group) return;

            const group = ctx.group;
            const familyLabel = String(ctx.familyLabel || group.familyLabel || '').trim();
            const groupLabel = String(group.label || group.groupId || '').trim();
            const { catalogue, custom } = getFivePercentOptionsForGroup(ctx);
            const existing = [
                ...catalogue.map((opt) => ({ type: 'catalogue', opt })),
                ...custom.map((opt) => ({ type: 'custom', opt }))
            ];

            const listHtml = existing.length
                ? existing.map(({ type, opt }) => {
                    const id = String(opt.id || '').trim();
                    const price = getFivePercentOptionPrice(opt);
                    const selected = isFivePercentGroupOptionSelected(id);
                    return `
                        <div class="five-pct-group-pick${selected ? ' five-pct-group-pick--selected' : ''}"
                            data-five-pct-id="${escapeHtml(id)}" data-five-pct-type="${type}" role="button" tabindex="0">
                            <span>${escapeHtml(String(opt.name || '').trim() || '—')}</span>
                            <span style="color:#64748b;font-size:13px;">${price.toFixed(2)} €${selected ? ' <span style="color:#92400e;font-weight:600;">✓</span>' : ''}</span>
                        </div>`;
                }).join('')
                : '<p style="color:#64748b;margin:0 0 12px;font-size:13px;">Aucune option 5% pour ce groupe.</p>';

            body.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div>
                        <label>Famille</label>
                        <input type="text" readonly value="${escapeHtml(familyLabel || '—')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                    </div>
                    <div>
                        <label>Groupe</label>
                        <input type="text" readonly value="${escapeHtml(groupLabel || '—')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                    </div>
                </div>
                <div style="font-weight:600;margin-bottom:8px;font-size:14px;">Options 5% de ce groupe</div>
                ${listHtml}
                <div class="five-pct-group-form">
                    <div style="font-weight:600;margin-bottom:10px;">Créer une option</div>
                    <div style="margin-bottom:10px;">
                        <label for="five-pct-group-name">Nom</label>
                        <input id="five-pct-group-name" type="text" placeholder="Libellé de l'option" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label for="five-pct-group-price">Prix (€)</label>
                        <input id="five-pct-group-price" type="number" step="0.01" min="0" placeholder="0.00" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                    </div>
                    <button type="button" class="btn btn-primary" id="five-pct-group-create-btn" style="width:100%;">Créer l'option</button>
                </div>
            `;

            body.querySelectorAll('.five-pct-group-pick').forEach((el) => {
                const handler = () => {
                    const id = el.getAttribute('data-five-pct-id');
                    const type = el.getAttribute('data-five-pct-type');
                    if (type === 'custom') selectFivePercentCustomGroupOption(id);
                    else selectFivePercentCatalogueGroupOption(id);
                };
                el.addEventListener('click', handler);
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handler();
                    }
                });
            });
            const createBtn = document.getElementById('five-pct-group-create-btn');
            if (createBtn) createBtn.addEventListener('click', createFivePercentGroupOptionFromModal);
        }

        function openFivePercentGroupModal(ctx) {
            if (!ctx?.group) return;
            state._fivePercentGroupModalContext = ctx;
            const title = document.getElementById('five-percent-group-modal-title');
            const modal = document.getElementById('five-percent-group-modal');
            if (title) {
                const gl = String(ctx.group.label || ctx.group.groupId || '').trim();
                title.textContent = gl ? `Option 5% — ${gl}` : 'Option 5%';
            }
            renderFivePercentGroupModalContent();
            if (modal) {
                if (typeof openUgapModal === 'function') openUgapModal(modal);
                else modal.classList.add('active');
            }
        }

        function closeFivePercentGroupModal() {
            state._fivePercentGroupModalContext = null;
            const modal = document.getElementById('five-percent-group-modal');
            if (modal) {
                if (typeof closeUgapModal === 'function') closeUgapModal(modal);
                else modal.classList.remove('active');
            }
            refreshCategoryTableIfVisible();
            if (state.use5Percent) render5PercentOptions();
            updateSummary();
        }

        window.closeFivePercentGroupModal = closeFivePercentGroupModal;

        function selectFivePercentCatalogueGroupOption(optId) {
            const id = String(optId || '').trim();
            if (!id) return;
            const optionById = getCatalogueOptionByIdMap();
            const opt = optionById.get(id);
            if (!opt) return;
            const price = getFivePercentOptionPrice(opt);
            const already = state.fivePercentOptions.has(id);
            if (!already && !tryAddFivePercentPriceDelta(price)) return;
            state.fivePercentOptions.add(id);
            state.selectedOptions.delete(id);
            renderFivePercentGroupModalContent();
            updateSummary();
            refreshCategoryTableIfVisible();
            if (state.use5Percent) render5PercentOptions();
        }

        function selectFivePercentCustomGroupOption(customId) {
            const id = String(customId || '').trim();
            const custom = (state.fivePercentCustomOptions || []).find((o) => o.id === id);
            if (!custom) return;
            const price = getFivePercentOptionPrice(custom);
            const already = custom.selected === true;
            if (!already && !tryAddFivePercentPriceDelta(price)) return;
            custom.selected = true;
            renderFivePercentGroupModalContent();
            updateSummary();
            refreshCategoryTableIfVisible();
            if (state.use5Percent) render5PercentOptions();
        }

        function toggleFivePercentCustomGroupOption(customId) {
            const id = String(customId || '').trim();
            const custom = (state.fivePercentCustomOptions || []).find((o) => o.id === id);
            if (!custom) return;
            if (custom.selected === true) {
                custom.selected = false;
                state.fivePercentOptions.delete(id);
                updateSummary();
                refreshCategoryTableIfVisible();
                if (state.use5Percent) render5PercentOptions();
                return;
            }
            selectFivePercentCustomGroupOption(id);
        }

        function createFivePercentGroupOptionFromModal() {
            const ctx = state._fivePercentGroupModalContext;
            if (!ctx?.group) return;
            const nameInput = document.getElementById('five-pct-group-name');
            const priceInput = document.getElementById('five-pct-group-price');
            if (!nameInput || !priceInput) return;

            const name = nameInput.value.trim();
            const price = parseFloat(priceInput.value);
            if (!name || Number.isNaN(price) || price <= 0) {
                alert('Nom et prix valides requis.');
                return;
            }
            if (!tryAddFivePercentPriceDelta(price)) return;

            const group = ctx.group;
            state.fivePercentCustomOptions.push({
                id: `fivepct_grp_${Date.now()}`,
                name,
                price,
                categoryId: String(ctx.categoryId || '').trim(),
                familyLabel: String(ctx.familyLabel || group.familyLabel || '').trim(),
                componentId: String(group.componentId || '').trim(),
                groupId: String(group.groupId || '').trim(),
                groupLabel: String(group.label || '').trim(),
                selected: true
            });

            nameInput.value = '';
            priceInput.value = '';
            renderFivePercentGroupModalContent();
            updateSummary();
            refreshCategoryTableIfVisible();
            if (state.use5Percent) render5PercentOptions();
        }

        function isCategoryTableMultiGroupExpanded(group) {
            const key = categoryTableGroupKey(group);
            return !!(state.categoryTableExpandedGroups && state.categoryTableExpandedGroups.has(key));
        }

        function toggleCategoryTableGroupExpanded(gkey) {
            if (!state.categoryTableExpandedGroups) state.categoryTableExpandedGroups = new Set();
            if (state.categoryTableExpandedGroups.has(gkey)) state.categoryTableExpandedGroups.delete(gkey);
            else state.categoryTableExpandedGroups.add(gkey);
        }

        function isCategoryTableGroupOptionSelected(opt) {
            const id = String(opt?.id || '').trim();
            return id && (state.selectedOptions.has(id) || state.fivePercentOptions.has(id));
        }

        /** Après choix du modèle : validées → bandeau groupe → à valider (œil). */
        function expandCategoryTableDisplayRows(rows) {
            if (!state.selectedModel) return rows;
            const out = [];
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                if (!row?.isGroupRow || !row.group || row.group.decisionMode !== 'multi_choice') {
                    out.push(row);
                    return;
                }
                const group = row.group;
                const eyeOn = isCategoryTableMultiGroupExpanded(group);
                const allOpts = Array.isArray(group.options) ? group.options : [];
                const seenSel = new Set();
                const selectedOpts = allOpts.filter((o) => {
                    const id = String(o?.id || '').trim();
                    if (!id || !isCategoryTableGroupOptionSelected(o)) return false;
                    if (seenSel.has(id)) return false;
                    seenSel.add(id);
                    return true;
                });
                const pendingOpts = eyeOn
                    ? allOpts.filter((o) => !isCategoryTableGroupOptionSelected(o))
                    : [];
                const base = row.rowOrder || 0;

                selectedOpts.forEach((opt, idx) => {
                    out.push({
                        isGroupOptionRow: true,
                        groupOptionPhase: 'validated',
                        parentGroup: group,
                        parentRow: row,
                        option: opt,
                        id: String(opt.id || '').trim(),
                        categoryName: row.categoryName,
                        categoryId: row.categoryId,
                        familyLabel: row.familyLabel,
                        isEmptyCategory: false,
                        isGroupRow: false,
                        rowOrder: base + (idx + 1) * 0.001
                    });
                });

                out.push({ ...row, isGroupControlRow: true, rowOrder: base + 0.05 });

                pendingOpts.forEach((opt, idx) => {
                    out.push({
                        isGroupOptionRow: true,
                        groupOptionPhase: 'pending',
                        parentGroup: group,
                        parentRow: row,
                        option: opt,
                        id: String(opt.id || '').trim(),
                        categoryName: row.categoryName,
                        categoryId: row.categoryId,
                        familyLabel: row.familyLabel,
                        isEmptyCategory: false,
                        isGroupRow: false,
                        rowOrder: base + 0.06 + (idx + 1) * 0.001
                    });
                });
            });
            return out.sort((a, b) => (a.rowOrder || 0) - (b.rowOrder || 0));
        }

        function buildFamilyNodeFromRecord(fam, optionById) {
            const familyLabel = getValidatedFamilyRootLabel(fam);
            if (!familyLabel) return null;
            const synced = syncFamilyOptionsToDecisionGroups(fam);
            const FCmp = window.UgapFamilyComponents;
            let groups = FCmp?.flattenDecisionGroups
                ? FCmp.flattenDecisionGroups(synced)
                : normalizeFamilyDecisionGroups(synced.decisionGroups);
            const familyOptionIds = (Array.isArray(synced.optionIds) ? synced.optionIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            if (!groups.length && familyOptionIds.length) {
                groups = [{
                    id: 'default',
                    componentId: FCmp?.DEFAULT_COMPONENT_ID || 'principal',
                    componentLabel: FCmp?.DEFAULT_COMPONENT_LABEL || 'Principal',
                    label: 'Choix',
                    type: 'option',
                    decisionMode: 'single_choice',
                    optionIds: familyOptionIds
                }];
            }
            const decisionGroups = groups.map((g) => {
                const options = resolveConfiguratorGroupOptions(g, optionById);
                return { ...g, options };
            });

            const allOptions = [];
            decisionGroups.forEach((g) => {
                (g.options || []).forEach((opt) => {
                    if (!allOptions.some((x) => x.id === opt.id)) allOptions.push(opt);
                });
            });

            if (!decisionGroups.length) return null;

            const defaultOptionId = fam?.defaultOptionId != null && String(fam.defaultOptionId).trim() !== ''
                ? String(fam.defaultOptionId).trim()
                : null;
            return {
                id: `family:${normalizeLabelAsId(familyLabel) || 'famille'}`,
                name: familyLabel,
                defaultOptionId,
                decisionGroups,
                allOptions
            };
        }

        function mergeFamilyNodes(existing, incoming) {
            if (!existing) return incoming;
            const groupMap = new Map((existing.decisionGroups || []).map((g) => [g.id, { ...g, options: [...(g.options || [])] }]));
            (incoming.decisionGroups || []).forEach((g) => {
                if (!groupMap.has(g.id)) {
                    groupMap.set(g.id, { ...g, options: [...(g.options || [])] });
                    return;
                }
                const cur = groupMap.get(g.id);
                const optMap = new Map((cur.options || []).map((o) => [o.id, o]));
                (g.options || []).forEach((o) => optMap.set(o.id, o));
                cur.options = Array.from(optMap.values());
                cur.optionIds = Array.from(new Set([...(cur.optionIds || []), ...(g.optionIds || [])]));
            });
            const allMap = new Map((existing.allOptions || []).map((o) => [o.id, o]));
            (incoming.allOptions || []).forEach((o) => allMap.set(o.id, o));
            return {
                ...existing,
                decisionGroups: Array.from(groupMap.values()),
                allOptions: Array.from(allMap.values())
            };
        }

        function getDecisionModeLabel(mode) {
            return mode === 'multi_choice' ? 'Choix multiple' : 'Choix unique';
        }

        function countSelectedOptions(options) {
            return (Array.isArray(options) ? options : []).filter((o) =>
                state.selectedOptions.has(o.id) || state.fivePercentOptions.has(o.id)
            ).length;
        }

        function getFamilyKeyFromLabel(value) {
            const parsed = parseFamilyHierarchyLabel(value);
            return normalizeLabelAsId(parsed.family || '');
        }

        const UGAP_EXCEL_VIEW_LABEL = 'Excel de base';
        const UGAP_CATEGORY_TABLE_VIEW_LABEL = 'Tableau catégories';
        const UGAP_INCLUSION_KIND_LABELS = {
            inclus: 'Inclus',
            option_devis: 'Option devis',
            devis_5pct: 'Devis 5%'
        };

        function buildDefaultConfiguratorBusinessViewRules() {
            return [
                {
                    viewLabel: UGAP_EXCEL_VIEW_LABEL,
                    keywords: 'excel, export, tableau, base',
                    scope: 'all',
                    families: [],
                    enabled: true,
                    layoutType: 'excel',
                    isBuiltInDefault: true
                },
                {
                    viewLabel: UGAP_CATEGORY_TABLE_VIEW_LABEL,
                    keywords: 'categorie, tableau, catalogue, inclus',
                    scope: 'all',
                    families: [],
                    enabled: true,
                    layoutType: 'category_table',
                    isBuiltInCategoryTable: true
                }
            ];
        }

        function ensureConfiguratorBusinessViewRules(rawRules) {
            const list = (Array.isArray(rawRules) ? rawRules : []).map((r) => {
                const norm = normalizeBusinessViewRule(r);
                return {
                    ...r,
                    viewLabel: norm.viewLabel || String(r?.viewLabel || '').trim(),
                    enabled: norm.enabled,
                    layoutType: norm.layoutType
                };
            });
            const defaults = buildDefaultConfiguratorBusinessViewRules();
            let merged = list.slice();
            let changed = false;
            defaults.forEach((def) => {
                const idx = merged.findIndex((r) => {
                    const norm = normalizeBusinessViewRule(r);
                    return norm.layoutType === def.layoutType
                        || norm.viewLabel.toLowerCase() === def.viewLabel.toLowerCase();
                });
                if (idx < 0) {
                    merged.push(def);
                    changed = true;
                    return;
                }
                const norm = normalizeBusinessViewRule(merged[idx]);
                if (norm.layoutType !== def.layoutType) {
                    merged[idx] = { ...merged[idx], layoutType: def.layoutType };
                    changed = true;
                }
            });
            const excel = merged.find((r) => normalizeBusinessViewRule(r).layoutType === 'excel');
            const cat = merged.find((r) => normalizeBusinessViewRule(r).layoutType === 'category_table');
            const rest = merged.filter((r) => {
                const lt = normalizeBusinessViewRule(r).layoutType;
                return lt !== 'excel' && lt !== 'category_table';
            });
            const ordered = [];
            if (excel) ordered.push(excel);
            if (cat) ordered.push(cat);
            ordered.push(...rest);
            if (ordered.length !== merged.length
                || ordered.some((r, i) => r !== merged[i])) {
                changed = true;
            }
            return { rules: ordered, changed };
        }

        function getRawBusinessViewRules() {
            let rules = Array.isArray(state.uiState?.businessViews) ? state.uiState.businessViews : [];
            if (!rules.length) {
                try {
                    const raw = localStorage.getItem('ugap.vueMetier.heuristicRules');
                    const parsed = raw ? JSON.parse(raw) : [];
                    if (Array.isArray(parsed)) rules = parsed;
                } catch (_) {
                    // no-op
                }
            }
            return ensureConfiguratorBusinessViewRules(rules).rules;
        }

        function normalizeBusinessViewRule(rule) {
            const r = rule && typeof rule === 'object' ? rule : {};
            const viewLabel = String(r.viewLabel || '').trim();
            let layoutType = String(r.layoutType || '').trim();
            if (!layoutType) {
                if (r.isBuiltInCategoryTable === true
                    || viewLabel.toLowerCase() === UGAP_CATEGORY_TABLE_VIEW_LABEL.toLowerCase()) {
                    layoutType = 'category_table';
                } else if (r.isBuiltInDefault === true
                    || viewLabel.toLowerCase() === UGAP_EXCEL_VIEW_LABEL.toLowerCase()) {
                    layoutType = 'excel';
                } else {
                    layoutType = 'families';
                }
            }
            return {
                viewLabel,
                enabled: r.enabled !== false,
                layoutType
            };
        }

        function getOptionInclusionKind(opt) {
            const raw = String(opt?.inclusionKind || '').trim().toLowerCase();
            if (raw === 'inclus' || raw === 'option_devis' || raw === 'devis_5pct') return raw;
            if (isBaseCatalogOption(opt)) return 'inclus';
            return 'option_devis';
        }

        function getOptionInclusionLabel(kind) {
            return UGAP_INCLUSION_KIND_LABELS[kind] || UGAP_INCLUSION_KIND_LABELS.option_devis;
        }

        function getBusinessViewIdForLabel(viewLabel) {
            const label = String(viewLabel || '').trim();
            if (!label) return '';
            const key = normalizeLabelAsId(label) || label.toLowerCase();
            return `rule:${key}`;
        }

        /** Vues métier activées (serveur + défauts tableau / catégories). */
        function getConfiguredBusinessViews() {
            return getRawBusinessViewRules()
                .map(normalizeBusinessViewRule)
                .filter((r) => r.viewLabel && r.enabled)
                .map((r) => ({
                    id: getBusinessViewIdForLabel(r.viewLabel),
                    name: r.viewLabel,
                    layoutType: r.layoutType || 'families'
                }));
        }

        function getDefaultOptionTabIndex(tabs) {
            const list = Array.isArray(tabs) ? tabs : [];
            const hasCatalogueCategories = getConfiguratorCatalogueCategories().length > 0;
            if (hasCatalogueCategories) {
                const catIdx = list.findIndex((t) => isCategoryTableBusinessViewTab(t));
                if (catIdx >= 0) return catIdx;
            }
            const excelIdx = list.findIndex((t) => isExcelBusinessViewTab(t));
            if (excelIdx >= 0) return excelIdx;
            const firstFamily = list.findIndex((t) =>
                !isExcelBusinessViewTab(t) && !isCategoryTableBusinessViewTab(t)
            );
            if (firstFamily >= 0) return firstFamily;
            return 0;
        }

        function familyMatchesBusinessView(fam, view) {
            const viewId = String(view?.id || '').trim();
            const viewName = String(view?.name || '').trim();
            const famId = String(fam?.businessViewId || '').trim();
            const famLabel = String(fam?.businessViewLabel || '').trim();
            if (famId && viewId && famId === viewId) return true;
            if (famLabel && viewName && famLabel === viewName) return true;
            if (famLabel && viewId === getBusinessViewIdForLabel(famLabel)) return true;
            return false;
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function formatPriceCell(value) {
            if (value == null || value === '' || (typeof value === 'number' && Number.isNaN(value))) return '—';
            const n = Number(value);
            if (Number.isNaN(n)) return '—';
            return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
        }

        function isExcelBusinessViewTab(tab) {
            if (String(tab?.layoutType || '') === 'excel') return true;
            const name = String(tab?.name || '').trim().toLowerCase();
            return name === UGAP_EXCEL_VIEW_LABEL.toLowerCase() || /\bexcel\b/.test(name);
        }

        function isCategoryTableBusinessViewTab(tab) {
            if (String(tab?.layoutType || '') === 'category_table') return true;
            const name = String(tab?.name || '').trim().toLowerCase();
            return name === UGAP_CATEGORY_TABLE_VIEW_LABEL.toLowerCase();
        }

        function isCatalogMotorTarifOption(opt) {
            if (!opt || typeof opt !== 'object') return false;
            const MBO = window.UgapModelBaseOptions;
            if (MBO?.isImportGeneratedBaseOption?.(opt)) return false;
            if (MBO?.isMotorTarifName) return MBO.isMotorTarifName(opt.name);
            const name = String(opt.name || '').replace(/\s+/g, ' ').trim();
            if (!name || /\ben\s+remplacement\b/i.test(name) || /\blieu\s+et\s+place\b/i.test(name)) return false;
            if (!/\b(moteur|motorisation)\b/i.test(name)) return false;
            if (name.length < 55) return false;
            return (
                /\b(hors-bord|essence|diesel|démarrage|direction|hélice|helice|arbre)\b/i.test(name)
                || (/\bDF\d{2,4}/i.test(name) && /\bsuzuki|mercury|yamaha|honda|oxe\b/i.test(name))
            );
        }

        function syncConfiguratorModelBaseContext() {
            publishConfiguratorDataToGlobals();
            state.getValidatedFamilies = getValidatedFamiliesForBusinessViews;
            if (window.UgapConfiguratorModelBaseBridge?.sync) {
                window.UgapConfiguratorModelBaseBridge.sync(state);
            }
        }

        function clearConfiguratorModelBaseContext() {
            window.UgapConfiguratorModelBaseBridge?.clear?.();
        }

        function isBaseCatalogOption(opt) {
            if (!opt || typeof opt !== 'object') return false;
            if (isCatalogMotorTarifOption(opt)) return false;
            if (opt.manualBaseOption === true || opt.isBaseOption === true) return true;
            if (opt.baseIncluded === true && !opt.isDivers) return true;
            // Configurateur: exclure uniquement les vraies IBP publiées/synthétiques.
            if (opt.importGeneratedFromBaseProduct === true) return true;
            if (String(opt.importBaseProductId || '').trim()) return true;
            const id = String(opt.id || '').trim();
            if (id.startsWith('opt_ibp_')) return true;
            const ref = String(opt.refUgap || '').trim().toUpperCase();
            if (ref.startsWith('IBP-')) return true;
            return false;
        }

        function isMotorBaseNonSupplyLabel(name) {
            const OLK = window.UgapOptionLineKind;
            if (OLK?.isMotorBaseNonSupplyLabel) return OLK.isMotorBaseNonSupplyLabel(name);
            const n = String(name || '').replace(/\s+/g, ' ').trim();
            if (!n || !/\bnon\s+fourniture\b/i.test(n) || !/\bmoteurs?\b/i.test(n)) return false;
            return /\bmoteurs?\s+de\s+base\b/i.test(n)
                || /\bnon\s+fourniture\s+(?:du|des)\s+(?:\d+\s+)?moteurs?\s+de\s+base\b/i.test(n);
        }

        function inferCatalogOptionLineKind(opt) {
            const OLK = window.UgapOptionLineKind;
            if (OLK?.inferOptionLineKind) return OLK.inferOptionLineKind(opt);
            const manual = String(opt?.importOptionLineKind || '').trim().toLowerCase();
            if (manual === 'minoration' || manual === 'majoration' || manual === 'pr' || manual === 'option') {
                if (manual === 'majoration' && isMotorBaseNonSupplyLabel(opt?.name)) return 'minoration';
                return manual;
            }
            if (opt?.manualMinorationAssignment === true || opt?.isMinoration === true) return 'minoration';
            if (opt?.manualMajorationAssignment === true) return 'majoration';
            if (opt?.isSparePart === true) return 'pr';
            const ref = String(opt?.refUgap || '').trim().toUpperCase();
            const name = String(opt?.name || '').replace(/\s+/g, ' ').trim();
            if (ref.includes('MINO') || /^moins-value\b/i.test(name)) return 'minoration';
            if (isMotorBaseNonSupplyLabel(name)) return 'minoration';
            if (/^PR\s/i.test(name)) return 'pr';
            if (
                /^(plus-value|plus\s+value)\b/i.test(name) ||
                /\ben\s+lieu\s+et\s+place\b/i.test(name) ||
                /\bau\s+lieu\s+et\s+place\b/i.test(name) ||
                /\ben\s+remplacement\b/i.test(name) ||
                /\bnon\s+fourniture\b/i.test(name)
            ) {
                return 'majoration';
            }
            return 'option';
        }

        function getOptionLineKind(opt) {
            const OLK = window.UgapOptionLineKind;
            if (OLK?.getOptionLineKindDisplay) return OLK.getOptionLineKindDisplay(opt);
            const kind = inferCatalogOptionLineKind(opt);
            if (kind === 'minoration') return { kind, label: 'Minoration / MV / PV', badgeClass: 'minoration' };
            if (kind === 'majoration') return { kind, label: 'Majoration', badgeClass: 'majoration' };
            if (kind === 'pr') return { kind, label: 'PR', badgeClass: 'pr' };
            return { kind: 'option', label: 'Option', badgeClass: 'option' };
        }

        function extractRowOrder(option) {
            if (typeof option?.rowIndex === 'number') return option.rowIndex;
            const match = String(option?.id || '').match(/^opt_(\d+)$/i);
            return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
        }

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

        function labelHasPosteNumberingContext(label) {
            if (getExplicitPosteSetFromLabel(label) !== null) return true;
            const raw = String(label || '');
            return (
                /\bpostes?\s+(?:n°|n\s*°|:)?\s*\d/i.test(raw) ||
                /\bpostes?\s+\d+\s*(?:à|a|-|–|—)\s*\d/i.test(raw) ||
                /\bpostes?\s+[\d,\s]{2,80}(?:et\s+\d+)?/i.test(raw)
            );
        }

        function optionHasExplicitXForModel(opt, modelId) {
            const wanted = String(modelId || '').trim();
            if (!wanted) return false;
            const cm = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
            return cm.map((x) => String(x || '').trim()).includes(wanted);
        }

        function optionTargetsPosteViaCompatibleModels(opt, posteNumber) {
            const pn = Number(posteNumber);
            if (!Number.isFinite(pn)) return false;
            const cm = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            if (!cm.length) return false;
            const models = Array.isArray(state.models) ? state.models : [];
            return models.some((m) => {
                const mid = String(m?.id || '').trim();
                const mpn = Number(m?.posteNumber);
                return mid && cm.includes(mid) && Number.isFinite(mpn) && mpn === pn;
            });
        }

        function getOptionDirectPosteNumber(opt) {
            const candidates = [opt?.posteNumber, opt?.poste, opt?.posteId, opt?.position];
            for (const candidate of candidates) {
                const str = String(candidate ?? '').trim();
                if (!str) continue;
                const n = parseInt(str, 10);
                if (!Number.isNaN(n)) return n;
            }
            return null;
        }

        function passesPosteScopeForExcelOption(opt, model) {
            const oid = String(opt?.id || '').trim();
            if (oid && getReplacedIbpLinkedAdjIdSet().has(oid)) return true;

            const pn = model?.posteNumber;
            if (pn == null || pn === '') return true;
            const mid = String(model?.id || '').trim();
            if (mid && optionHasExplicitXForModel(opt, mid)) {
                // Alignement paramétrage: une croix modèle prime sur l'analyse du libellé "Poste X".
                return true;
            }
            if (optionTargetsPosteViaCompatibleModels(opt, pn)) {
                // Même sans selectedModel.id fiable, on aligne sur "poste affecté" du paramétrage.
                return true;
            }

            const lineKind = inferCatalogOptionLineKind(opt);
            if (
                (lineKind === 'minoration' || lineKind === 'majoration')
                && optionHasExplicitXForModel(opt, model?.id)
            ) {
                return true;
            }

            const name = opt?.name || '';
            if (isMotorBaseNonSupplyLabel(name)) {
                if (mid && optionHasExplicitXForModel(opt, mid)) return true;
                const explicitPoste = getExplicitPosteSetFromLabel(name);
                if (explicitPoste !== null && explicitPoste.size > 0 && explicitPoste.has(Number(pn))) {
                    return true;
                }
                if (labelMentionsPosteNumber(name, pn)) return true;
            }

            const directPoste = getOptionDirectPosteNumber(opt);
            if (directPoste != null) return Number(pn) === directPoste;

            const explicit = getExplicitPosteSetFromLabel(name);
            if (explicit !== null && explicit.size > 0) {
                return explicit.has(Number(pn));
            }

            if (labelHasPosteNumberingContext(name)) {
                return labelMentionsPosteNumber(name, pn);
            }

            if (labelMentionsPosteNumber(name, pn)) return true;
            if (optionHasExplicitXForModel(opt, model?.id)) return true;
            const cm = opt?.compatibleModels;
            if (!Array.isArray(cm) || cm.length === 0) return true;
            return false;
        }

        function isExcelRowVisibleForModel(opt, model) {
            if (isBaseCatalogOption(opt)) return false;
            const lineKind = inferCatalogOptionLineKind(opt);
            if (lineKind === 'pr') return false;
            return passesPosteScopeForExcelOption(opt, model);
        }

        function collectExcelCatalogRows() {
            const model = state.selectedModel;
            const seen = new Set();
            const rows = [];
            const familyByOptionId = buildOptionFamilyLabelMap();
            getAllConfiguratorCatalogOptions().forEach(({ option, categoryName }) => {
                const id = String(option?.id || '').trim();
                if (!id || seen.has(id)) return;
                if (!isExcelRowVisibleForModel(option, model)) return;
                seen.add(id);
                const lineKind = getOptionLineKind(option);
                const posteLabel = formatAssignedPostesForConfigurator(option);
                const displayCategory = resolveExcelRowCategoryName(id, categoryName, familyByOptionId);
                rows.push({
                    option,
                    id,
                    categoryName: displayCategory,
                    rowOrder: extractRowOrder(option),
                    lineKindLabel: lineKind.label,
                    lineKindBadge: lineKind.badgeClass,
                    posteLabel
                });
            });
            rows.sort((a, b) => a.rowOrder - b.rowOrder);
            return rows;
        }

        function buildExcelSourceDiagnostics() {
            const all = getAllConfiguratorCatalogOptions();
            let totalOptions = 0;
            let baseExcluded = 0;
            let prExcluded = 0;
            let posteExcluded = 0;
            let visibleCandidates = 0;
            all.forEach(({ option }) => {
                totalOptions += 1;
                if (isBaseCatalogOption(option)) {
                    baseExcluded += 1;
                    return;
                }
                const lineKind = inferCatalogOptionLineKind(option);
                if (lineKind === 'pr') {
                    prExcluded += 1;
                    return;
                }
                if (!passesPosteScopeForExcelOption(option, state.selectedModel)) {
                    posteExcluded += 1;
                    return;
                }
                visibleCandidates += 1;
            });
            return {
                categoriesCount: (Array.isArray(state.categories) ? state.categories : []).length,
                totalOptions,
                baseExcluded,
                prExcluded,
                posteExcluded,
                visibleCandidates
            };
        }

        function normalizeFilterText(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
        }

        function isExcelRowSelected(row) {
            const id = String(row?.id || '').trim();
            return state.selectedOptions.has(id) || state.fivePercentOptions.has(id);
        }

        function applyExcelRowFilters(rows) {
            const filters = state.excelTabFilters || { name: '', selection: 'all' };
            const nameQuery = normalizeFilterText(filters.name);
            const selection = String(filters.selection || 'all');
            return (Array.isArray(rows) ? rows : []).filter((row) => {
                if (selection === 'selected' && !isExcelRowSelected(row)) return false;
                if (selection === 'unselected' && isExcelRowSelected(row)) return false;
                if (!nameQuery) return true;
                const opt = row.option || {};
                const haystack = normalizeFilterText([
                    opt.name,
                    opt.refUgap,
                    row.categoryName,
                    row.posteLabel,
                    row.lineKindLabel
                ].join(' '));
                return haystack.includes(nameQuery);
            });
        }

        function buildExcelTableRowHtml(row) {
            const opt = row.option;
            const checked = isExcelRowSelected(row);
            const fivePct = state.fivePercentOptions.has(row.id);
            const priceClient = formatPriceCell(opt.priceClient);
            const priceUgap = formatPriceCell(opt.priceUgap);
            return `
                <tr data-excel-row-id="${escapeHtml(row.id)}">
                    <td style="text-align:center; width:44px;">
                        <input type="checkbox" id="${escapeHtml(row.id)}" data-option-name="${escapeHtml(opt.name || '')}" ${checked ? 'checked' : ''} ${fivePct && !state.use5Percent ? 'disabled' : ''}>
                    </td>
                    <td><span class="excel-line-badge ${escapeHtml(row.lineKindBadge)}">${escapeHtml(row.lineKindLabel)}</span></td>
                    <td>
                        ${escapeHtml(opt.name || '—')}${fivePct ? ' <span style="margin-left:6px;padding:2px 6px;background:#ffe08a;color:#856404;border-radius:4px;font-size:11px;font-weight:600;">5% Devis</span>' : ''}
                        <div style="font-size:11px;color:#94a3b8;margin-top:2px;">ID: ${escapeHtml(row.id)}</div>
                    </td>
                    <td class="num">${priceClient}</td>
                    <td class="num">${priceUgap}</td>
                    <td style="font-size:12px;color:#666;">${escapeHtml(opt.refUgap || '—')}</td>
                    <td style="font-size:12px;color:#888;">${escapeHtml(row.categoryName)}</td>
                </tr>
            `;
        }

        function bindExcelTableCheckboxes(rows) {
            rows.forEach((row) => {
                const cb = document.getElementById(row.id);
                if (cb) bindOptionCheckbox(cb, row.option, true);
            });
        }

        function updateExcelOptionsMeta(allRows, filteredRows) {
            const meta = document.getElementById('ugap-excel-options-meta');
            if (!meta) return;
            const all = Array.isArray(allRows) ? allRows : [];
            const shown = Array.isArray(filteredRows) ? filteredRows : [];
            const selectedCount = all.filter((r) => isExcelRowSelected(r)).length;
            const regularCount = all.filter((r) => r.lineKindBadge === 'option').length;
            const minoCount = all.filter((r) => r.lineKindBadge === 'minoration').length;
            const majoCount = all.filter((r) => r.lineKindBadge === 'majoration').length;
            const filterActive = (state.excelTabFilters?.name || '').trim() || state.excelTabFilters?.selection !== 'all';
            meta.innerHTML = `
                <strong>${shown.length}</strong> ligne(s) affichée(s) sur <strong>${all.length}</strong>
                ${filterActive ? ' (filtre actif)' : ''} — ordre fichier Excel, mêmes types que le paramétrage (import). Poste modèle${state.selectedModel?.posteNumber != null && state.selectedModel?.posteNumber !== '' ? ` ${state.selectedModel.posteNumber}` : ''} : catalogue + mino + majo avec croix modèle ; options de base (IBP) et PR exclues.
                <strong>${selectedCount}</strong> sélectionnée(s).
                ${regularCount ? `${regularCount} option(s)` : ''}${minoCount ? ` · ${minoCount} minoration(s) / MV / PV` : ''}${majoCount ? ` · ${majoCount} majoration(s)` : ''}
            `;
        }

        function refreshExcelOptionsTable() {
            const tbody = document.getElementById('ugap-excel-options-tbody');
            if (!tbody) return;
            const allRows = state.excelAllRows || [];
            const filtered = applyExcelRowFilters(allRows);
            if (!filtered.length) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:16px;text-align:center;color:#666;">Aucune ligne ne correspond aux filtres.</td></tr>';
            } else {
                tbody.innerHTML = filtered.map(buildExcelTableRowHtml).join('');
                bindExcelTableCheckboxes(filtered);
            }
            updateExcelOptionsMeta(allRows, filtered);
        }

        function resetExcelTabFilters() {
            state.excelTabFilters = { name: '', selection: 'all' };
            const nameInput = document.getElementById('ugap-excel-filter-name');
            const selInput = document.getElementById('ugap-excel-filter-selection');
            if (nameInput) nameInput.value = '';
            if (selInput) selInput.value = 'all';
            refreshExcelOptionsTable();
        }

        function bindOptionCheckbox(checkbox, option, fromExcelTable = false, tableRow = null) {
            checkbox.onchange = () => {
                const attrKind = String(checkbox.getAttribute('data-inclusion-kind') || '').trim();
                const inclusionKind = attrKind || getOptionInclusionKind(option);
                const routeToFivePct = checkbox.checked && (
                    inclusionKind === 'devis_5pct'
                    || (fromExcelTable && state.use5Percent && !state.fivePercentOptions.has(option.id))
                );
                if (routeToFivePct) {
                    const price = catalogUgapPrice(option);
                    if (state.budget5Percent > 0 && getFivePercentTotal() + price > state.budget5Percent) {
                        alert('Budget 5% dépassé !');
                        checkbox.checked = false;
                        return;
                    }
                    state.fivePercentOptions.add(option.id);
                    state.selectedOptions.delete(option.id);
                } else if (checkbox.checked) {
                    state.selectedOptions.add(option.id);
                    state.fivePercentOptions.delete(option.id);
                } else {
                    state.selectedOptions.delete(option.id);
                    state.fivePercentOptions.delete(option.id);
                }
                invalidateBillableDerivationCache();
                autoSelectMatchingNonSupplyMotor(checkbox);
                if (state.use5Percent) render5PercentOptions();
                updateSummary();
                if (fromExcelTable) {
                    updateExcelOptionsMeta(state.excelAllRows, applyExcelRowFilters(state.excelAllRows));
                    if (state.excelTabFilters?.selection !== 'all') {
                        refreshExcelOptionsTable();
                    }
                }
                if (tableRow && document.getElementById('ugap-category-table-tbody')) {
                    const displayRows = expandCategoryTableDisplayRows(state.categoryTableAllRows || []);
                    updateCategoryTableMeta(displayRows, applyCategoryTableRowFilters(displayRows));
                    if (state.selectedModel || state.categoryTableFilters?.selection !== 'all') {
                        refreshCategoryTableBody();
                    }
                }
            };
        }

        function renderExcelCategoryOptions(tab, optionsContainer) {
            const model = state.selectedModel;
            const rows = collectExcelCatalogRows();
            state.excelAllRows = rows;
            tab.options = rows.map((r) => r.option);

            if (!rows.length) {
                const posteHint = model?.posteNumber != null && model?.posteNumber !== ''
                    ? ` (poste ${escapeHtml(String(model.posteNumber))})`
                    : '';
                const dbg = buildExcelSourceDiagnostics();
                optionsContainer.innerHTML = `
                    <p style="color:#666;">Aucune option disponible pour ce modèle${posteHint} — hors options de base et lignes PR.</p>
                    <p style="color:#94a3b8;font-size:12px;margin-top:6px;">
                        Debug source: catégories=${dbg.categoriesCount}, options=${dbg.totalOptions}, IBP exclues=${dbg.baseExcluded}, PR exclues=${dbg.prExcluded}, hors poste=${dbg.posteExcluded}, candidates=${dbg.visibleCandidates}.
                    </p>
                `;
                return;
            }

            const filters = state.excelTabFilters || { name: '', selection: 'all' };
            const filtered = applyExcelRowFilters(rows);
            const bodyHtml = filtered.length
                ? filtered.map(buildExcelTableRowHtml).join('')
                : '<tr><td colspan="7" style="padding:16px;text-align:center;color:#666;">Aucune ligne ne correspond aux filtres.</td></tr>';

            optionsContainer.innerHTML = `
                <div class="excel-options-wrap" id="ugap-excel-options-root">
                    <div class="excel-options-filters">
                        <div class="excel-filter-field" style="flex:2;min-width:260px;">
                            <label for="ugap-excel-filter-name">Filtrer par nom</label>
                            <input type="search" id="ugap-excel-filter-name" placeholder="Libellé, référence, poste…" value="${escapeHtml(filters.name || '')}" autocomplete="off">
                        </div>
                        <div class="excel-filter-field" style="flex:0 0 200px;">
                            <label for="ugap-excel-filter-selection">Sélection</label>
                            <select id="ugap-excel-filter-selection">
                                <option value="all" ${filters.selection === 'all' ? 'selected' : ''}>Toutes</option>
                                <option value="selected" ${filters.selection === 'selected' ? 'selected' : ''}>Sélectionnées</option>
                                <option value="unselected" ${filters.selection === 'unselected' ? 'selected' : ''}>Non sélectionnées</option>
                            </select>
                        </div>
                        <button type="button" class="excel-filter-reset" id="ugap-excel-filter-reset">Réinitialiser</button>
                    </div>
                    <div class="excel-options-meta" id="ugap-excel-options-meta"></div>
                    <div class="excel-options-scroll">
                        <table class="excel-options-table">
                            <thead>
                                <tr>
                                    <th style="width:44px;text-align:center;">✓</th>
                                    <th>Type</th>
                                    <th>Libellé</th>
                                    <th class="num">Prix client HT</th>
                                    <th class="num">Prix UGAP HT</th>
                                    <th>Réf. UGAP</th>
                                    <th>Catégorie</th>
                                </tr>
                            </thead>
                            <tbody id="ugap-excel-options-tbody">${bodyHtml}</tbody>
                        </table>
                    </div>
                </div>
            `;

            updateExcelOptionsMeta(rows, filtered);
            bindExcelTableCheckboxes(filtered);

            const nameInput = document.getElementById('ugap-excel-filter-name');
            const selInput = document.getElementById('ugap-excel-filter-selection');
            const resetBtn = document.getElementById('ugap-excel-filter-reset');

            if (nameInput) {
                nameInput.addEventListener('input', () => {
                    state.excelTabFilters.name = nameInput.value;
                    refreshExcelOptionsTable();
                });
            }
            if (selInput) {
                selInput.addEventListener('change', () => {
                    state.excelTabFilters.selection = selInput.value || 'all';
                    refreshExcelOptionsTable();
                });
            }
            if (resetBtn) {
                resetBtn.addEventListener('click', resetExcelTabFilters);
            }
        }

        function passesCategoryTableModelFilter(opt, model) {
            const lineKind = getOptionLineKind(opt).kind;
            if (lineKind === 'pr') return false;
            const mid = String(model?.id || '').trim();
            const comp = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map((x) => String(x)) : [];
            if (lineKind === 'minoration' || lineKind === 'majoration') {
                if (mid && comp.length > 0 && !comp.includes(mid)) return false;
            } else if (mid) {
                if (comp.length === 0) {
                    if (!opt?.isDivers) return false;
                } else if (!comp.includes(mid)) {
                    return false;
                }
            }
            return passesPosteScopeForExcelOption(opt, model);
        }

        function isSystemBucketCategory(cat) {
            const c = cat && typeof cat === 'object' ? cat : {};
            const id = String(c.id || '').trim();
            const name = String(c.name || '').trim().toLowerCase();
            return id === 'cat_non_classees' || name === 'non classées' || name === 'non classees';
        }

        function getConfiguratorCatalogueCategories() {
            return (Array.isArray(state.categories) ? state.categories : [])
                .filter((cat) => !isSystemBucketCategory(cat));
        }

        function getAllConfiguratorCatalogOptions() {
            const rows = [];
            (Array.isArray(state.categories) ? state.categories : []).forEach((category) => {
                const categoryName = String(category?.name || '').trim() || '—';
                (Array.isArray(category?.options) ? category.options : []).forEach((option) => {
                    if (!option || typeof option !== 'object') return;
                    rows.push({ option, categoryName });
                });
            });
            return rows;
        }

        function buildOptionFamilyLabelMap() {
            const map = new Map();
            const families = Array.isArray(state.uiState?.families) ? state.uiState.families : [];
            families.forEach((family) => {
                const label = String(family?.familyLabel || '').trim();
                if (!label) return;
                (Array.isArray(family?.optionIds) ? family.optionIds : []).forEach((idRaw) => {
                    const id = String(idRaw || '').trim();
                    if (id && !map.has(id)) map.set(id, label);
                });
                (Array.isArray(family?.decisionGroups) ? family.decisionGroups : []).forEach((group) => {
                    (Array.isArray(group?.optionIds) ? group.optionIds : []).forEach((idRaw) => {
                        const id = String(idRaw || '').trim();
                        if (id && !map.has(id)) map.set(id, label);
                    });
                });
            });
            return map;
        }

        function formatAssignedPostesForConfigurator(opt) {
            const explicit = getExplicitPosteSetFromLabel(opt?.name);
            if (explicit && explicit.size) {
                return [...explicit].filter(Number.isFinite).sort((a, b) => a - b).join(', ');
            }
            const modelById = new Map(
                (Array.isArray(state.models) ? state.models : [])
                    .map((m) => [String(m?.id || '').trim(), m])
                    .filter(([id]) => id)
            );
            const cm = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean);
            if (!cm.length) return opt?.isDivers ? 'Tous' : '—';
            const postes = cm
                .map((id) => modelById.get(id))
                .map((m) => Number(m?.posteNumber))
                .filter(Number.isFinite);
            const unique = [...new Set(postes)].sort((a, b) => a - b);
            if (unique.length) return unique.join(', ');
            return '—';
        }

        function resolveExcelRowCategoryName(optionId, fallbackCategoryName, familyMap) {
            const raw = String(fallbackCategoryName || '').trim();
            const lower = raw.toLowerCase();
            if (raw && lower !== 'non classées' && lower !== 'non classees') return raw;
            const byFamily = String(familyMap?.get(String(optionId || '').trim()) || '').trim();
            return byFamily || raw || '—';
        }

        function getBoatTemplateCategoryIdSetForModel() {
            const tid = String(state.selectedModel?.boatTemplateId || '').trim();
            if (!tid) return null;
            const Tpl = window.UgapConfiguratorTemplateTree;
            const resolved = Tpl?.ensureResolved?.(state);
            const ids = Array.isArray(resolved?.categoryIds) ? resolved.categoryIds : [];
            if (ids.length) {
                return new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
            }
            const tpl = Tpl?.getBoatTemplateForModel?.(state);
            const snapIds = Array.isArray(tpl?.snapshot?.categoryIds) ? tpl.snapshot.categoryIds : [];
            if (snapIds.length) {
                return new Set(snapIds.map((id) => String(id || '').trim()).filter(Boolean));
            }
            const Tree = window.UgapBoatTemplateTree;
            const tree = Tree?.normalizeBoatTemplateSnapshot
                ? Tree.normalizeBoatTemplateSnapshot(tpl?.snapshot || {}, {
                    resolveCategoryById: (id) => getConfiguratorCatalogueCategories()
                        .find((c) => String(c?.id || '').trim() === String(id || '').trim()) || null
                }).categoryTree
                : [];
            if (Tree?.flattenCategoryRefIds && tree.length) {
                const refIds = Tree.flattenCategoryRefIds(tree);
                if (refIds.length) return new Set(refIds.map((id) => String(id || '').trim()).filter(Boolean));
            }
            return null;
        }

        function getCategoryTableCatalogueCategories() {
            const all = getConfiguratorCatalogueCategories();
            const allowed = getBoatTemplateCategoryIdSetForModel();
            if (!allowed || !allowed.size) return all;
            const filtered = all.filter((cat) => allowed.has(String(cat?.id || '').trim()));
            return filtered.length ? filtered : all;
        }

        function collectCategoryTableRows() {
            const model = state.selectedModel;
            const rows = [];
            const Tree = window.UgapBoatTemplateTree;
            const catalogueFamilies = getValidatedFamiliesForBusinessViews();
            const optionById = getCatalogueOptionByIdMap();
            const Tpl = window.UgapConfiguratorTemplateTree;
            const hooks = getTemplateTreeHooks();

            getCategoryTableCatalogueCategories().forEach((category, catOrder) => {
                const categoryName = String(category?.objectName || category?.name || '').trim() || '—';
                const categoryId = String(category?.id || '').trim();
                const resolved = Tree?.resolveCategoryFamiliesWithGroups
                    ? Tree.resolveCategoryFamiliesWithGroups(category, catalogueFamilies)
                    : [];
                let groupIdx = 0;
                let hasRow = false;

                const pushFlatOptionRows = () => {
                    const seen = new Set();
                    const ids = Tree?.collectCategoryOptionIdsFromFamilies
                        ? Tree.collectCategoryOptionIdsFromFamilies(category, catalogueFamilies)
                        : [];
                    ids.forEach((id) => {
                        if (!id || seen.has(id)) return;
                        const option = optionById.get(id);
                        if (!option || !passesCategoryTableModelFilter(option, model)) return;
                        seen.add(id);
                        rows.push({
                            option,
                            id,
                            categoryName,
                            categoryId,
                            subCategoryName: '',
                            isEmptyCategory: false,
                            isGroupRow: false,
                            rowOrder: catOrder * 1000000 + 100000 + groupIdx
                        });
                        groupIdx += 1;
                        hasRow = true;
                    });
                };

                if (resolved.length) {
                    resolved.forEach((fam) => {
                        const famLabel = String(fam?.familyLabel || '').trim();
                        const src = Tree?.findCatalogueFamily
                            ? Tree.findCatalogueFamily(catalogueFamilies, {
                                familyLabel: famLabel,
                                sourceIndex: fam.sourceIndex
                            })
                            : catalogueFamilies.find((f) =>
                                String(f?.familyLabel || '').trim().toLowerCase() === famLabel.toLowerCase()
                            );
                        const defId = src?.defaultOptionId != null
                            ? String(src.defaultOptionId).trim()
                            : '';
                        (Array.isArray(fam?.decisionGroups) ? fam.decisionGroups : []).forEach((g) => {
                            const catalogueOptionIds = (Array.isArray(g?.optionIds) ? g.optionIds : [])
                                .map((x) => String(x || '').trim())
                                .filter(Boolean);
                            if (!catalogueOptionIds.length) return;
                            const group = buildConfiguratorGroupObject(fam, g, optionById, defId);
                            const compLabel = String(g?.componentLabel || '').trim();
                            const groupRowOrder = catOrder * 1000000 + groupIdx;
                            rows.push({
                                isGroupRow: true,
                                id: `grp_${categoryId}_${categoryTableGroupKey(group)}`,
                                categoryName,
                                categoryId,
                                familyLabel: famLabel,
                                componentLabel: compLabel,
                                group,
                                isEmptyCategory: false,
                                rowOrder: groupRowOrder
                            });
                            const fivePctOpts = resolveConfiguratorGroupFivePercentOptions(group, optionById);
                            fivePctOpts.forEach((opt, fpIdx) => {
                                const oid = String(opt?.id || '').trim();
                                if (!oid) return;
                                rows.push({
                                    isFivePercentCatalogRow: true,
                                    option: opt,
                                    id: oid,
                                    categoryName,
                                    categoryId,
                                    familyLabel: famLabel,
                                    parentGroup: group,
                                    isEmptyCategory: false,
                                    isGroupRow: false,
                                    rowOrder: groupRowOrder + 0.02 + fpIdx * 0.001
                                });
                            });
                            (state.fivePercentCustomOptions || [])
                                .filter((c) => String(c.categoryId || '').trim() === categoryId
                                    && String(c.familyLabel || '').trim() === famLabel
                                    && String(c.groupId || '').trim() === String(group.groupId || '').trim())
                                .forEach((custom, cIdx) => {
                                    rows.push({
                                        isFivePercentCustomRow: true,
                                        customOption: custom,
                                        id: String(custom.id || '').trim(),
                                        categoryName,
                                        categoryId,
                                        familyLabel: famLabel,
                                        parentGroup: group,
                                        isEmptyCategory: false,
                                        isGroupRow: false,
                                        rowOrder: groupRowOrder + 0.03 + cIdx * 0.001
                                    });
                                });
                            groupIdx += 1;
                            hasRow = true;
                        });
                    });
                }

                if (!hasRow) {
                    pushFlatOptionRows();
                }

                if (!hasRow) {
                    rows.push({
                        option: null,
                        id: `__empty_cat_${categoryId || catOrder}`,
                        categoryName,
                        categoryId,
                        isEmptyCategory: true,
                        rowOrder: catOrder * 1000000
                    });
                }
            });
            rows.sort((a, b) => a.rowOrder - b.rowOrder);
            return rows;
        }

        function isCategoryTableRowSelectable(row) {
            if (row?.isEmptyCategory) return false;
            return getOptionInclusionKind(row?.option) !== 'inclus';
        }

        function isCategoryTableRowSelected(row) {
            const id = String(row?.id || '').trim();
            if (row?.isFivePercentCustomRow) {
                return isFivePercentGroupOptionSelected(id);
            }
            return state.selectedOptions.has(id) || state.fivePercentOptions.has(id);
        }

        function isCategoryTableGroupRowSelected(row) {
            const group = row?.group;
            if (!group) return false;
            const ids = (group.options || []).map((o) => o.id);
            return ids.some((id) => state.selectedOptions.has(id) || state.fivePercentOptions.has(id));
        }

        function applyCategoryTableRowFilters(rows) {
            const filters = state.categoryTableFilters || { name: '', selection: 'all' };
            const nameQuery = normalizeFilterText(filters.name);
            const selection = String(filters.selection || 'all');
            return (Array.isArray(rows) ? rows : []).filter((row) => {
                if (row?.isEmptyCategory) {
                    if (selection === 'selected') return false;
                    if (!nameQuery) return true;
                    return normalizeFilterText(row.categoryName || '').includes(nameQuery);
                }
                if (row?.isGroupControlRow && row.group) {
                    if (selection === 'selected' && !isCategoryTableGroupRowSelected(row)) return false;
                    if (selection === 'unselected' && isCategoryTableGroupRowSelected(row)) return false;
                    if (!nameQuery) return true;
                    const g = row.group || {};
                    const haystack = normalizeFilterText([
                        row.categoryName,
                        row.familyLabel,
                        g.label,
                        ...(g.options || []).map((o) => o.name)
                    ].join(' '));
                    return haystack.includes(nameQuery);
                }
                if (row?.isFivePercentCatalogRow || row?.isFivePercentCustomRow) {
                    if (selection === 'selected' && !isCategoryTableRowSelected(row)) return false;
                    if (selection === 'unselected' && isCategoryTableRowSelected(row)) return false;
                    if (!nameQuery) return true;
                    const label = row?.isFivePercentCustomRow
                        ? String(row.customOption?.name || '')
                        : String(row.option?.name || '');
                    return normalizeFilterText([
                        label,
                        row.categoryName,
                        row.familyLabel,
                        'devis 5%'
                    ].join(' ')).includes(nameQuery);
                }
                if (row?.isGroupOptionRow && row.option) {
                    if (selection === 'selected' && !isCategoryTableRowSelected(row)) return false;
                    if (selection === 'unselected' && isCategoryTableRowSelected(row)) return false;
                    if (!nameQuery) return true;
                    const opt = row.option;
                    const haystack = normalizeFilterText([
                        opt.name,
                        opt.details,
                        opt.refUgap,
                        row.categoryName,
                        row.familyLabel,
                        row.parentGroup?.label,
                        getOptionInclusionLabel(getOptionInclusionKind(opt))
                    ].join(' '));
                    return haystack.includes(nameQuery);
                }
                if (row?.isGroupRow) {
                    if (selection === 'selected' && !isCategoryTableGroupRowSelected(row)) return false;
                    if (selection === 'unselected' && isCategoryTableGroupRowSelected(row)) return false;
                    if (!nameQuery) return true;
                    const g = row.group || {};
                    const haystack = normalizeFilterText([
                        row.categoryName,
                        row.familyLabel,
                        g.label,
                        ...(g.options || []).map((o) => o.name)
                    ].join(' '));
                    return haystack.includes(nameQuery);
                }
                if (selection === 'selected' && !isCategoryTableRowSelected(row)) return false;
                if (selection === 'unselected' && isCategoryTableRowSelected(row)) return false;
                if (!nameQuery) return true;
                const opt = row.option || {};
                const haystack = normalizeFilterText([
                    opt.name,
                    opt.details,
                    opt.refUgap,
                    row.categoryName,
                    row.subCategoryName,
                    getOptionInclusionLabel(getOptionInclusionKind(opt))
                ].join(' '));
                return haystack.includes(nameQuery);
            });
        }

        function buildCategoryTableGroupControlsHtml(group) {
            const gkey = escapeHtml(categoryTableGroupKey(group));
            const count = (group.options || []).length;
            const eyeOn = isCategoryTableMultiGroupExpanded(group);
            const eyeTitle = eyeOn
                ? 'Replier : n’afficher que les options sélectionnées'
                : `Déplier : afficher les ${count} option(s) disponibles (ligne par ligne)`;
            return `
                <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                    <button type="button" class="cat-table-multi-add btn btn-outline" data-cat-group="${gkey}"
                        style="width:32px;height:32px;border-radius:50%;padding:0;font-size:18px;line-height:1;"
                        title="Ajouter ou modifier la sélection">+</button>
                    ${buildCategoryTableFivePctButtonHtml(gkey)}
                    <button type="button" class="cat-table-eye btn btn-outline${eyeOn ? ' cat-table-eye--active' : ''}" data-cat-group="${gkey}"
                        style="width:32px;height:32px;border-radius:50%;padding:0;font-size:15px;line-height:1;"
                        title="${escapeHtml(eyeTitle)}" aria-label="${escapeHtml(eyeTitle)}">&#128065;</button>
                </div>`;
        }

        function isInclusionShownInCategoryTableColumn(opt) {
            if (!opt) return false;
            const kind = getOptionInclusionKind(opt);
            return kind === 'inclus' || kind === 'devis_5pct' || isBaseCatalogOption(opt);
        }

        function formatCategoryTablePriceCell(opt) {
            if (!opt) return '—';
            if (isInclusionShownInCategoryTableColumn(opt)) {
                const p = catalogUgapPrice(opt);
                if (getOptionInclusionKind(opt) === 'devis_5pct' && p > 0) {
                    return `${p.toFixed(2)} €`;
                }
                return '—';
            }
            return `${Number(opt.priceUgap ?? 0).toFixed(2)} €`;
        }

        function categoryTableComponentCell(row, group) {
            const label = String(row?.componentLabel || group?.componentLabel || '').trim();
            return label
                ? escapeHtml(label)
                : '<span style="color:#94a3b8;">—</span>';
        }

        function buildCategoryTableFivePercentRowHtml(row, prevCategory) {
            const showCategory = row.categoryName !== prevCategory;
            const kind = 'devis_5pct';
            let opt = null;
            let rowId = '';
            let name = '—';
            let price = 0;
            if (row?.isFivePercentCustomRow && row.customOption) {
                const custom = row.customOption;
                rowId = String(custom.id || '').trim();
                name = String(custom.name || '').trim() || '—';
                price = Number(custom.price) || 0;
            } else if (row?.isFivePercentCatalogRow && row.option) {
                opt = row.option;
                rowId = String(opt.id || '').trim();
                name = String(opt.name || '').trim() || '—';
                price = catalogUgapPrice(opt);
            }
            const checked = rowId && (state.fivePercentOptions.has(rowId)
                || (row?.isFivePercentCustomRow && row.customOption?.selected === true));
            const disabled = !state.use5Percent ? 'disabled title="Activez le budget 5% du devis"' : '';
            return `
                <tr class="cat-table-five-pct-row" data-category-row-id="${escapeHtml(rowId)}">
                    <td style="font-size:12px;color:#64748b;vertical-align:top;font-weight:600;">${showCategory ? escapeHtml(row.categoryName) : ''}</td>
                    <td style="vertical-align:top;color:#94a3b8;">—</td>
                    <td style="vertical-align:top;">${categoryTableComponentCell(row)}</td>
                    <td style="vertical-align:top;color:#94a3b8;">—</td>
                    <td style="vertical-align:top;font-weight:600;color:#1e293b;">${escapeHtml(name)}</td>
                    <td style="vertical-align:top;">
                        <span class="category-table-inclusion ${escapeHtml(kind)}">${escapeHtml(getOptionInclusionLabel(kind))}</span>
                    </td>
                    <td class="num" style="vertical-align:top;">${price.toFixed(2)} €</td>
                    <td style="text-align:center;width:44px;vertical-align:top;">
                        <input type="checkbox" id="${escapeHtml(rowId)}" data-option-name="${escapeHtml(name)}"
                            data-inclusion-kind="${escapeHtml(kind)}" ${checked ? 'checked' : ''} ${disabled}>
                    </td>
                </tr>`;
        }

        function buildCategoryTableGroupChoiceHtml(row) {
            const group = row.group;
            const hooks = getTemplateTreeHooks();
            const Tpl = window.UgapConfiguratorTemplateTree;
            const gkey = escapeHtml(categoryTableGroupKey(group));
            if (group.decisionMode === 'multi_choice') {
                const allOpts = Array.isArray(group.options) ? group.options : [];
                const seenChip = new Set();
                const selectedIds = (group.options || [])
                    .map((o) => String(o?.id || '').trim())
                    .filter((id) => {
                        if (!id || seenChip.has(id)) return false;
                        if (!state.selectedOptions.has(id) && !state.fivePercentOptions.has(id)) return false;
                        seenChip.add(id);
                        return true;
                    });
                const count = allOpts.length;
                let hintHtml = '';
                if (state.selectedModel) {
                    const selectedCount = selectedIds.length;
                    const eyeOn = isCategoryTableMultiGroupExpanded(group);
                    const pendingCount = eyeOn
                        ? allOpts.filter((o) => !isCategoryTableGroupOptionSelected(o)).length
                        : 0;
                    const hintValidated = selectedCount
                        ? `${selectedCount} option(s) sélectionnée(s) — listées ci-dessus`
                        : 'Aucune option sélectionnée pour l’instant';
                    const hintPending = pendingCount
                        ? `${pendingCount} option(s) à valider — listées ci-dessous`
                        : (eyeOn ? 'Toutes les options de ce groupe sont sélectionnées' : '');
                    hintHtml = `
                        <div style="font-size:12px;color:#64748b;font-style:italic;line-height:1.45;margin-bottom:8px;">
                            <div>${escapeHtml(hintValidated)}</div>
                            ${hintPending ? `<div style="margin-top:4px;">${escapeHtml(hintPending)}</div>` : ''}
                        </div>`;
                }
                return `
                    ${hintHtml}
                    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                        <button type="button" class="cat-table-multi-add btn btn-outline" data-cat-group="${gkey}"
                            style="width:32px;height:32px;border-radius:50%;padding:0;font-size:18px;line-height:1;" title="${count} option(s)">+</button>
                        ${buildCategoryTableFivePctButtonHtml(gkey)}
                    </div>`;
            }
            const display = Tpl?.getSingleChoiceDisplay
                ? Tpl.getSingleChoiceDisplay(state, group, hooks)
                : { option: null, isBaseDefault: false };
            const opt = display.option;
            const label = opt
                ? escapeHtml(String(opt.name || '').trim())
                : '<span style="color:#b45309;font-style:italic;">Sélectionnez une option</span>';
            const price = opt && !isInclusionShownInCategoryTableColumn(opt)
                ? ` <span style="color:#64748b;font-size:12px;">${getOptionBillablePrice(opt).toFixed(2)} €</span>`
                : '';
            const baseHint = display.isBaseDefault
                ? ' <span style="font-size:11px;color:#059669;">(base)</span>' : '';
            return `<button type="button" class="cat-table-single-pick" data-cat-group="${gkey}"
                style="text-align:left;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;width:100%;max-width:420px;">
                ${label}${baseHint}${price} <span style="color:#94a3b8;">›</span>
            </button>`;
        }

        function buildCategoryTableGroupOptionRowHtml(row, prevCategory) {
            const opt = row.option;
            if (isFivePercentCatalogOption(opt)) {
                return buildCategoryTableFivePercentRowHtml({
                    isFivePercentCatalogRow: true,
                    option: opt,
                    id: row.id,
                    categoryName: row.categoryName,
                    familyLabel: row.familyLabel
                }, prevCategory);
            }
            const group = row.parentGroup || {};
            const phase = row.groupOptionPhase === 'pending' ? 'pending' : 'validated';
            const showCategory = row.categoryName !== prevCategory;
            const kind = getOptionInclusionKind(opt);
            const selectable = getOptionInclusionKind(opt) !== 'inclus';
            const checked = isCategoryTableRowSelected(row);
            const details = String(opt?.details || '').trim();
            const optionName = String(opt?.name || '').trim() || '—';
            const col3Html = `${escapeHtml(optionName)}${details ? `<div style="font-size:13px;color:#475569;margin-top:4px;">${escapeHtml(details)}</div>` : ''}`;
            const rowPrice = formatCategoryTablePriceCell(opt);
            const phaseTag = phase === 'pending'
                ? '<span style="font-size:11px;color:#b45309;margin-right:6px;">À valider</span>'
                : '<span style="font-size:11px;color:#059669;margin-right:6px;" title="Sélectionnée">✓</span>';
            const optionCell = `${phaseTag}${col3Html}`;
            return `
                <tr class="cat-table-group-option-row cat-table-group-option-row--${phase}" data-category-row-id="${escapeHtml(row.id)}" data-cat-group="${escapeHtml(categoryTableGroupKey(group))}">
                    <td style="font-size:12px;color:#64748b;vertical-align:top;">${showCategory ? escapeHtml(row.categoryName) : ''}</td>
                    <td style="vertical-align:top;color:#94a3b8;">—</td>
                    <td style="vertical-align:top;">${categoryTableComponentCell(row, group)}</td>
                    <td style="vertical-align:top;color:#94a3b8;">—</td>
                    <td style="vertical-align:top;">${optionCell}</td>
                    <td style="vertical-align:top;"><span class="category-table-inclusion ${escapeHtml(kind)}">${escapeHtml(getOptionInclusionLabel(kind))}</span></td>
                    <td class="num" style="vertical-align:top;">${escapeHtml(rowPrice)}</td>
                    <td style="text-align:center;width:44px;vertical-align:top;">
                        ${selectable
                            ? `<input type="checkbox" id="${escapeHtml(row.id)}" data-option-name="${escapeHtml(opt.name || '')}" data-inclusion-kind="${escapeHtml(kind)}" ${checked ? 'checked' : ''} ${kind === 'devis_5pct' && !state.use5Percent ? 'disabled title="Activez le budget 5% du devis"' : ''}>`
                            : '<span style="color:#94a3b8;font-size:11px;">—</span>'}
                    </td>
                </tr>`;
        }

        function buildCategoryTableRowHtml(row, prevCategory) {
            if (row?.isFivePercentCatalogRow || row?.isFivePercentCustomRow) {
                return buildCategoryTableFivePercentRowHtml(row, prevCategory);
            }
            if (row?.isGroupControlRow && row.group) {
                const showCategory = row.categoryName !== prevCategory;
                const group = row.group;
                const gkey = escapeHtml(categoryTableGroupKey(group));
                const familyCol = escapeHtml(String(row.familyLabel || '').trim() || '—');
                const componentCol = categoryTableComponentCell(row, group);
                const groupCol = escapeHtml(String(group.label || '').trim() || '—');
                const choiceHtml = buildCategoryTableGroupChoiceHtml(row);
                const controlsHtml = buildCategoryTableGroupControlsHtml(group);
                return `
                <tr class="cat-table-group-control-row" data-category-row-id="${escapeHtml(row.id)}" data-cat-group="${gkey}">
                    <td style="font-size:12px;color:#64748b;vertical-align:top;font-weight:600;">${showCategory ? escapeHtml(row.categoryName) : ''}</td>
                    <td style="vertical-align:top;font-weight:600;color:#334155;">${familyCol}</td>
                    <td style="vertical-align:top;font-weight:600;color:#475569;">${componentCol}</td>
                    <td style="vertical-align:top;font-weight:600;color:#1e293b;">${groupCol}</td>
                    <td style="vertical-align:top;">
                        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;justify-content:space-between;">
                            <span style="flex:1;min-width:160px;">${choiceHtml}</span>
                            ${controlsHtml}
                        </div>
                    </td>
                    <td style="vertical-align:top;color:#94a3b8;">—</td>
                    <td class="num" style="vertical-align:top;color:#94a3b8;">—</td>
                    <td style="text-align:center;color:#94a3b8;vertical-align:top;">—</td>
                </tr>`;
            }
            if (row?.isGroupOptionRow && row.option) {
                return buildCategoryTableGroupOptionRowHtml(row, prevCategory);
            }
            if (row?.isGroupRow && row.group) {
                const showCategory = row.categoryName !== prevCategory;
                const group = row.group;
                const gkey = escapeHtml(categoryTableGroupKey(group));
                const familyCol = escapeHtml(String(row.familyLabel || '').trim() || '—');
                const componentCol = categoryTableComponentCell(row, group);
                const groupCol = escapeHtml(String(group.label || '').trim() || '—');
                const choiceHtml = buildCategoryTableGroupChoiceHtml(row);
                const selectedOpt = group.decisionMode === 'multi_choice'
                    ? (group.options || []).find((o) =>
                        state.selectedOptions.has(o.id) || state.fivePercentOptions.has(o.id))
                    : (window.UgapConfiguratorTemplateTree?.getSingleChoiceDisplay
                        ? window.UgapConfiguratorTemplateTree.getSingleChoiceDisplay(state, group, getTemplateTreeHooks()).option
                        : null);
                const kind = selectedOpt ? getOptionInclusionKind(selectedOpt) : '';
                const colInclus = selectedOpt
                    ? `<span class="category-table-inclusion ${escapeHtml(kind)}">${escapeHtml(getOptionInclusionLabel(kind))}</span>`
                    : '<span style="color:#94a3b8;">—</span>';
                const rowPrice = selectedOpt ? formatCategoryTablePriceCell(selectedOpt) : '—';
                return `
                <tr class="cat-table-group-row" data-category-row-id="${escapeHtml(row.id)}" data-cat-group="${gkey}">
                    <td style="font-size:12px;color:#64748b;vertical-align:top;font-weight:600;">${showCategory ? escapeHtml(row.categoryName) : ''}</td>
                    <td style="vertical-align:top;font-weight:600;color:#334155;">${familyCol}</td>
                    <td style="vertical-align:top;font-weight:600;color:#475569;">${componentCol}</td>
                    <td style="vertical-align:top;font-weight:600;color:#1e293b;">${groupCol}</td>
                    <td style="vertical-align:top;">${choiceHtml}</td>
                    <td style="vertical-align:top;">${colInclus}</td>
                    <td class="num" style="vertical-align:top;">${escapeHtml(rowPrice)}</td>
                    <td style="text-align:right;vertical-align:top;">${buildCategoryTableFivePctButtonHtml(gkey)}</td>
                </tr>`;
            }
            if (row?.isEmptyCategory) {
                const showCategory = row.categoryName !== prevCategory;
                return `
                <tr data-category-row-id="${escapeHtml(row.id)}" class="category-table-row--empty">
                    <td style="font-size:12px;color:#64748b;vertical-align:top;font-weight:600;">${showCategory ? escapeHtml(row.categoryName) : ''}</td>
                    <td colspan="3" style="color:#94a3b8;font-size:13px;font-style:italic;">Aucune option pour ce modèle</td>
                    <td style="text-align:center;color:#94a3b8;">—</td>
                    <td class="num" style="text-align:center;color:#94a3b8;">—</td>
                    <td style="text-align:center;color:#94a3b8;">—</td>
                </tr>
            `;
            }
            const opt = row.option;
            const kind = getOptionInclusionKind(opt);
            if (isFivePercentCatalogOption(opt)) {
                return buildCategoryTableFivePercentRowHtml({
                    isFivePercentCatalogRow: true,
                    option: opt,
                    id: row.id,
                    categoryName: row.categoryName
                }, prevCategory);
            }
            const selectable = isCategoryTableRowSelectable(row);
            const checked = isCategoryTableRowSelected(row);
            const showCategory = row.categoryName !== prevCategory;
            const subCategoryName = String(row.subCategoryName || '').trim();
            const hasSubCategory = !!subCategoryName;
            const details = String(opt?.details || '').trim();
            const optionName = String(opt?.name || '').trim() || '—';
            const colFamily = '<span style="color:#94a3b8;">—</span>';
            const colComponent = '<span style="color:#94a3b8;">—</span>';
            const colGroup = hasSubCategory
                ? escapeHtml(subCategoryName)
                : '<span style="color:#94a3b8;">—</span>';
            const colOption = `${escapeHtml(optionName)}${details ? `<div style="font-size:13px;color:#475569;margin-top:4px;">${escapeHtml(details)}</div>` : ''}`;
            const rowPrice = formatCategoryTablePriceCell(opt);
            return `
                <tr data-category-row-id="${escapeHtml(row.id)}">
                    <td style="font-size:12px;color:#64748b;vertical-align:top;font-weight:600;">${showCategory ? escapeHtml(row.categoryName) : ''}</td>
                    <td style="vertical-align:top;">${colFamily}</td>
                    <td style="vertical-align:top;">${colComponent}</td>
                    <td style="vertical-align:top;">${colGroup}</td>
                    <td style="vertical-align:top;">${colOption}</td>
                    <td style="vertical-align:top;"><span class="category-table-inclusion ${escapeHtml(kind)}">${escapeHtml(getOptionInclusionLabel(kind))}</span></td>
                    <td class="num" style="vertical-align:top;">${escapeHtml(rowPrice)}</td>
                    <td style="text-align:center;width:44px;vertical-align:top;">
                        ${selectable
                            ? `<input type="checkbox" id="${escapeHtml(row.id)}" data-option-name="${escapeHtml(opt.name || '')}" data-inclusion-kind="${escapeHtml(kind)}" ${checked ? 'checked' : ''} ${kind === 'devis_5pct' && !state.use5Percent ? 'disabled title="Activez le budget 5% du devis"' : ''}>`
                            : '<span style="color:#94a3b8;font-size:11px;">—</span>'}
                    </td>
                </tr>
            `;
        }

        function bindCategoryTableCheckboxes(rows) {
            rows.forEach((row) => {
                if (row?.isGroupRow || row?.isGroupControlRow) return;
                if (row?.isFivePercentCatalogRow && row.option) {
                    const cb = document.getElementById(row.id);
                    if (cb) bindOptionCheckbox(cb, row.option, false, row);
                    return;
                }
                if (row?.isFivePercentCustomRow && row.customOption) {
                    const cb = document.getElementById(row.id);
                    if (!cb) return;
                    const synthetic = {
                        id: row.id,
                        name: row.customOption.name,
                        priceUgap: row.customOption.price,
                        priceClient: row.customOption.price,
                        inclusionKind: 'devis_5pct'
                    };
                    cb.onchange = () => {
                        if (cb.checked) toggleFivePercentCustomGroupOption(row.id);
                        else {
                            row.customOption.selected = false;
                            state.fivePercentOptions.delete(row.id);
                            updateSummary();
                            refreshCategoryTableIfVisible();
                        }
                    };
                    return;
                }
                if (!row?.option || !isCategoryTableRowSelectable(row)) return;
                const cb = document.getElementById(row.id);
                if (!cb) return;
                bindOptionCheckbox(cb, row.option, false, row);
            });
        }

        function bindCategoryTableGroupRows(rows) {
            const byKey = new Map();
            const ctxByKey = new Map();
            rows.forEach((row) => {
                const group = row?.group || row?.parentGroup;
                if (!group) return;
                if (row.isGroupRow || row.isGroupControlRow || row.isGroupOptionRow) {
                    const gkey = categoryTableGroupKey(group);
                    byKey.set(gkey, group);
                    if (row.isGroupRow || row.isGroupControlRow) {
                        ctxByKey.set(gkey, {
                            group,
                            categoryId: row.categoryId,
                            categoryName: row.categoryName,
                            familyLabel: row.familyLabel || group.familyLabel
                        });
                    }
                }
            });
            const tbody = document.getElementById('ugap-category-table-tbody');
            if (!tbody) return;
            const hooks = getTemplateTreeHooks();
            const Tpl = window.UgapConfiguratorTemplateTree;
            const openSingle = (gkey) => {
                const group = byKey.get(gkey);
                if (group && Tpl?.openSingleChoiceModal) Tpl.openSingleChoiceModal(state, group, hooks);
            };
            const openMulti = (gkey) => {
                const group = byKey.get(gkey);
                if (group && Tpl?.openMultiChoiceModal) Tpl.openMultiChoiceModal(state, group, hooks);
            };
            const openFivePct = (gkey) => {
                const ctx = ctxByKey.get(gkey);
                if (ctx) openFivePercentGroupModal(ctx);
            };
            tbody.querySelectorAll('.cat-table-single-pick').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openSingle(btn.getAttribute('data-cat-group'));
                });
            });
            tbody.querySelectorAll('.cat-table-multi-add').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openMulti(btn.getAttribute('data-cat-group'));
                });
            });
            tbody.querySelectorAll('.cat-table-chip-remove').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const optId = btn.getAttribute('data-cat-opt');
                    if (optId) {
                        state.selectedOptions.delete(optId);
                        state.fivePercentOptions.delete(optId);
                    }
                    updateSummary();
                    refreshCategoryTableBody();
                });
            });
            tbody.querySelectorAll('.cat-table-eye').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const gkey = btn.getAttribute('data-cat-group');
                    if (!gkey) return;
                    toggleCategoryTableGroupExpanded(gkey);
                    refreshCategoryTableBody();
                });
            });
            tbody.querySelectorAll('.cat-table-five-pct').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openFivePct(btn.getAttribute('data-cat-group'));
                });
            });
        }

        function updateCategoryTableMeta(allRows, filteredRows) {
            const meta = document.getElementById('ugap-category-table-meta');
            if (!meta) return;
            const all = Array.isArray(allRows) ? allRows : [];
            const shown = Array.isArray(filteredRows) ? filteredRows : [];
            const categoryCount = new Set(all.map((r) => r.categoryName)).size;
            const groupLineCount = all.filter((r) => r.isGroupRow || r.isGroupControlRow).length;
            const selectedCount = all.filter((r) => {
                if (r.isFivePercentCatalogRow || r.isFivePercentCustomRow) return isCategoryTableRowSelected(r);
                if (r.isGroupOptionRow) return isCategoryTableRowSelected(r);
                if (r.isGroupRow || r.isGroupControlRow) return isCategoryTableGroupRowSelected(r);
                return isCategoryTableRowSelected(r);
            }).length;
            meta.innerHTML = `
                <strong>${categoryCount}</strong> catégorie(s) · <strong>${shown.length}</strong> ligne(s) affichée(s)
                (${groupLineCount} groupe(s)).
                <strong>${selectedCount}</strong> sélectionnée(s).
            `;
        }

        function refreshCategoryTableBody() {
            const tbody = document.getElementById('ugap-category-table-tbody');
            if (!tbody) return;
            const allRows = expandCategoryTableDisplayRows(state.categoryTableAllRows || []);
            const filtered = applyCategoryTableRowFilters(allRows);
            let prevCategory = '';
            if (!filtered.length) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:16px;text-align:center;color:#666;">Aucune ligne ne correspond aux filtres.</td></tr>';
            } else {
                tbody.innerHTML = filtered.map((row) => {
                    const html = buildCategoryTableRowHtml(row, prevCategory);
                    prevCategory = row.categoryName;
                    return html;
                }).join('');
                bindCategoryTableCheckboxes(filtered);
                bindCategoryTableGroupRows(filtered);
            }
            updateCategoryTableMeta(allRows, filtered);
        }

        function renderCategoryTableOptions(tab, optionsContainer, renderOpts) {
            const extra = renderOpts && typeof renderOpts === 'object' ? renderOpts : {};
            const bannerHtml = extra.bannerHtml || '';
            const catalogueCats = getCategoryTableCatalogueCategories();
            if (!catalogueCats.length) {
                optionsContainer.innerHTML = `${bannerHtml}
                    <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;color:#475569;font-size:14px;line-height:1.5;">
                        <strong>Aucune catégorie</strong> n’est définie dans le paramétrage (onglet <strong>Catégorie</strong>).
                        <br><br>
                        Créez au moins une catégorie avec des familles dans <strong>Paramétrage → Catégorie</strong>, puis rattachez-y des options.
                    </div>`;
                return;
            }

            const rows = getCategoryTableRows();
            state.categoryTableAllRows = rows;
            tab.options = rows
                .filter((r) => r.isGroupRow && r.group)
                .flatMap((r) => r.group.options || []);

            const filters = state.categoryTableFilters || { name: '', selection: 'all' };

            let prevCategory = '';
            const displayRows = expandCategoryTableDisplayRows(rows);
            const filtered = applyCategoryTableRowFilters(displayRows);
            const bodyHtml = filtered.length
                ? filtered.map((row) => {
                    const html = buildCategoryTableRowHtml(row, prevCategory);
                    prevCategory = row.categoryName;
                    return html;
                }).join('')
                : '<tr><td colspan="7" style="padding:16px;text-align:center;color:#666;">Aucune ligne ne correspond aux filtres.</td></tr>';

            optionsContainer.innerHTML = `
                ${bannerHtml}
                <div class="excel-options-wrap" id="ugap-category-table-root">
                    <div class="excel-options-filters">
                        <div class="excel-filter-field" style="flex:2;min-width:260px;">
                            <label for="ugap-category-table-filter-name">Rechercher</label>
                            <input type="search" id="ugap-category-table-filter-name" placeholder="Catégorie, option, détails…" value="${escapeHtml(filters.name || '')}" autocomplete="off">
                        </div>
                        <div class="excel-filter-field" style="flex:0 0 200px;">
                            <label for="ugap-category-table-filter-selection">Sélection</label>
                            <select id="ugap-category-table-filter-selection">
                                <option value="all" ${filters.selection === 'all' ? 'selected' : ''}>Toutes</option>
                                <option value="selected" ${filters.selection === 'selected' ? 'selected' : ''}>Sélectionnées</option>
                                <option value="unselected" ${filters.selection === 'unselected' ? 'selected' : ''}>Non sélectionnées</option>
                            </select>
                        </div>
                        <button type="button" class="excel-filter-reset" id="ugap-category-table-filter-reset">Réinitialiser</button>
                    </div>
                    <div class="excel-options-meta" id="ugap-category-table-meta"></div>
                    <div class="excel-options-scroll">
                        <table class="excel-options-table">
                            <thead>
                                <tr>
                                    <th>Catégorie</th>
                                    <th>Famille</th>
                                    <th>Composant</th>
                                    <th>Groupe</th>
                                    <th>Option</th>
                                    <th>Inclus</th>
                                    <th class="num">Prix HT</th>
                                    <th style="width:44px;text-align:center;">✓</th>
                                </tr>
                            </thead>
                            <tbody id="ugap-category-table-tbody">${bodyHtml}</tbody>
                        </table>
                    </div>
                </div>
            `;

            updateCategoryTableMeta(displayRows, filtered);
            bindCategoryTableCheckboxes(filtered);
            updateSummary();
            bindCategoryTableGroupRows(filtered);

            const nameInput = document.getElementById('ugap-category-table-filter-name');
            const selInput = document.getElementById('ugap-category-table-filter-selection');
            const resetBtn = document.getElementById('ugap-category-table-filter-reset');
            if (nameInput) {
                nameInput.addEventListener('input', () => {
                    state.categoryTableFilters = state.categoryTableFilters || { name: '', selection: 'all' };
                    state.categoryTableFilters.name = nameInput.value;
                    refreshCategoryTableBody();
                });
            }
            if (selInput) {
                selInput.addEventListener('change', () => {
                    state.categoryTableFilters = state.categoryTableFilters || { name: '', selection: 'all' };
                    state.categoryTableFilters.selection = selInput.value || 'all';
                    refreshCategoryTableBody();
                });
            }
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    state.categoryTableFilters = { name: '', selection: 'all' };
                    if (nameInput) nameInput.value = '';
                    if (selInput) selInput.value = 'all';
                    refreshCategoryTableBody();
                });
            }
        }

        function resolveFamilyBusinessViewTabId(fam, configuredViews) {
            const configured = Array.isArray(configuredViews) ? configuredViews : [];
            const match = configured.find((v) => familyMatchesBusinessView(fam, v));
            if (match) return match.id;
            const viewIdRaw = String(fam?.businessViewId || '').trim();
            const viewLabelRaw = String(fam?.businessViewLabel || '').trim();
            const resolvedViewLabel = viewLabelRaw || viewIdRaw;
            if (!resolvedViewLabel) return '';
            return viewIdRaw || getBusinessViewIdForLabel(resolvedViewLabel) || `view:${normalizeLabelAsId(resolvedViewLabel) || 'metier'}`;
        }

        function extractPosteSortInfo(option) {
            const directCandidates = [
                option?.posteNumber,
                option?.poste,
                option?.posteId,
                option?.position
            ];
            for (const candidate of directCandidates) {
                const str = String(candidate ?? '').trim();
                if (!str) continue;
                const n = parseInt(str, 10);
                if (!Number.isNaN(n)) {
                    return { key: `poste-${n}`, label: `Poste ${n}`, order: n };
                }
                return { key: `poste-${normalizeLabelAsId(str) || 'x'}`, label: str, order: 9999 };
            }

            const textCandidates = [
                String(option?.posteLabel || '').trim(),
                String(option?.name || '').trim()
            ].filter(Boolean);

            for (const txt of textCandidates) {
                const m = txt.match(/\bposte(?:s)?\s*(\d+)\b/i);
                if (m && m[1]) {
                    const n = parseInt(m[1], 10);
                    if (!Number.isNaN(n)) {
                        return { key: `poste-${n}`, label: `Poste ${n}`, order: n };
                    }
                }
            }
            return { key: 'poste-non-defini', label: 'Sans poste', order: 10000 };
        }

        function sortOptionsByPosteThenName(options) {
            const list = Array.isArray(options) ? [...options] : [];
            list.sort((a, b) => {
                const pa = extractPosteSortInfo(a);
                const pb = extractPosteSortInfo(b);
                if (pa.order !== pb.order) return pa.order - pb.order;
                const nameA = String(a?.name || '').trim();
                const nameB = String(b?.name || '').trim();
                return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
            });
            return list;
        }

        function buildPosteGroups(options) {
            const map = new Map();
            sortOptionsByPosteThenName(options).forEach((option) => {
                const poste = extractPosteSortInfo(option);
                if (!map.has(poste.key)) {
                    map.set(poste.key, {
                        key: poste.key,
                        label: poste.label,
                        order: poste.order,
                        options: []
                    });
                }
                map.get(poste.key).options.push(option);
            });
            return Array.from(map.values()).sort((a, b) => a.order - b.order);
        }

        function normalizeOptionText(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
        }

        function isMotorNonSupplyOption(name) {
            const txt = normalizeOptionText(name);
            return txt.includes('non fourniture') && txt.includes('moteur');
        }

        function isMotorSupplyReplacementOption(name) {
            const txt = normalizeOptionText(name);
            if (!txt.includes('moteur')) return false;
            const hasSupply = txt.includes('fourniture') && !txt.includes('non fourniture');
            const hasReplacement = txt.includes('en remplacement') || txt.includes('au lieu');
            return hasSupply || hasReplacement;
        }

        function autoSelectMatchingNonSupplyMotor(checkbox) {
            if (!checkbox || !checkbox.checked) return;
            const optionName = checkbox.getAttribute('data-option-name') || '';
            if (!isMotorSupplyReplacementOption(optionName)) return;

            const familyKey = checkbox.getAttribute('data-family-key') || '';
            const posteKey = checkbox.getAttribute('data-poste-key') || '';
            const candidates = document.querySelectorAll('input[type="checkbox"][data-option-name]');
            for (const other of candidates) {
                if (other === checkbox) continue;
                if (!isMotorNonSupplyOption(other.getAttribute('data-option-name') || '')) continue;
                if (familyKey && other.getAttribute('data-family-key') !== familyKey) continue;
                if (posteKey && other.getAttribute('data-poste-key') !== posteKey) continue;

                other.checked = true;
                const id = String(other.id || '').trim();
                if (id) {
                    state.selectedOptions.add(id);
                    state.fivePercentOptions.delete(id);
                }
                break;
            }
        }

        function buildOptionTabsForStep3() {
            const optionById = getCatalogueOptionByIdMap();
            const validatedFamilies = getValidatedFamiliesForBusinessViews();
            const configuredViews = getConfiguredBusinessViews();
            const viewMap = new Map();
            const familyByTab = new Map();

            configuredViews.forEach((view) => {
                viewMap.set(view.id, {
                    id: view.id,
                    name: view.name,
                    options: [],
                    subCategories: []
                });
                familyByTab.set(view.id, []);
            });

            validatedFamilies.forEach((fam) => {
                const tabId = configuredViews.length
                    ? resolveFamilyBusinessViewTabId(fam, configuredViews)
                    : (() => {
                        const viewIdRaw = String(fam?.businessViewId || '').trim();
                        const viewLabelRaw = String(fam?.businessViewLabel || '').trim();
                        const resolvedViewLabel = viewLabelRaw || viewIdRaw;
                        if (!resolvedViewLabel) return '';
                        return viewIdRaw || `view:${normalizeLabelAsId(resolvedViewLabel) || 'metier'}`;
                    })();
                if (!tabId) return;
                if (configuredViews.length && !viewMap.has(tabId)) return;

                if (!viewMap.has(tabId)) {
                    const viewLabelRaw = String(fam?.businessViewLabel || '').trim();
                    const viewIdRaw = String(fam?.businessViewId || '').trim();
                    viewMap.set(tabId, {
                        id: tabId,
                        name: viewLabelRaw || viewIdRaw || tabId,
                        options: [],
                        subCategories: []
                    });
                }
                if (!familyByTab.has(tabId)) familyByTab.set(tabId, []);

                const built = buildFamilyNodeFromRecord(fam, optionById);
                if (!built) return;

                const existingFamilies = familyByTab.get(tabId);
                const idx = existingFamilies.findIndex((x) => x.id === built.id);
                if (idx >= 0) {
                    existingFamilies[idx] = mergeFamilyNodes(existingFamilies[idx], built);
                } else {
                    existingFamilies.push(built);
                }

                const viewTab = viewMap.get(tabId);
                (built.allOptions || []).forEach((option) => {
                    if (!viewTab.options.some((x) => String(x?.id || '') === option.id)) {
                        viewTab.options.push(option);
                    }
                });
            });

            state.tabFamiliesById = new Map();
            const viewTabsSource = configuredViews.length
                ? configuredViews.map((v) => viewMap.get(v.id)).filter(Boolean)
                : Array.from(viewMap.values());
            let viewTabs = viewTabsSource.map((tab) => {
                const viewMeta = configuredViews.find((v) => v.id === tab.id);
                const families = (familyByTab.get(tab.id) || []).map((famNode) => ({
                    id: famNode.id,
                    name: famNode.name,
                    decisionGroups: famNode.decisionGroups || [],
                    allOptions: famNode.allOptions || []
                }));
                state.tabFamiliesById.set(tab.id, families);
                return {
                    ...tab,
                    layoutType: viewMeta?.layoutType || tab.layoutType || 'families'
                };
            });

            if (!configuredViews.length) {
                viewTabs = viewTabs.filter((tab) => Array.isArray(tab.options) && tab.options.length > 0);
            }

            if (configuredViews.length > 0 || viewTabs.length > 0) {
                return mapMotorisationTabsToExcel(viewTabs);
            }

            return [];
        }

        function renderStep3() {
            document.getElementById('selected-model-name-2').textContent = state.selectedModel?.name || '-';
            document.getElementById('selected-config-name').textContent = state.selectedConfig?.name || '-';
            const devisNameInput = document.getElementById('ugap-devis-name-input');
            if (devisNameInput) devisNameInput.value = state.devisName || '';

            state.isOptionSelectable = isSelectableCatalogOption;
            state.isOptionCompatibleWithSelectedModel = isOptionCompatibleWithSelectedModel;
            state.passesCategoryTableModelFilter = passesCategoryTableModelFilter;
            syncConfiguratorModelBaseContext();
            applyConfiguratorDefaultsFromModelBase(true);

            const MBO = window.UgapModelBaseOptions;
            const resolvedTemplateId = MBO?.resolveBoatTemplateIdForModel && state.selectedModel
                ? String(MBO.resolveBoatTemplateIdForModel(state.selectedModel) || '').trim()
                : String(state.selectedModel?.boatTemplateId || '').trim();
            const hasBaseBoat = !!resolvedTemplateId;
            if (!hasBaseBoat) {
                setStep3ParcoursHint(true, 'missing_template');
                state.optionTabs = [];
                state.tabFamiliesById = new Map();
                const tabs = document.getElementById('option-tabs');
                const sub = document.getElementById('subcategories-container');
                const opt = document.getElementById('options-container');
                if (tabs) tabs.innerHTML = '';
                if (sub) sub.innerHTML = '';
                if (opt) {
                    opt.innerHTML = `
                        <div style="padding:16px;border:2px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-size:14px;line-height:1.5;">
                            <strong>Configuration impossible</strong><br><br>
                            Vous devez créer un bateau de base pour ce modèle avant de configurer les options.
                        </div>
                    `;
                }
                updateSummary();
                return;
            }

            if (window.UgapConfiguratorTemplateTree?.shouldUseTemplateTree?.(state)) {
                window.UgapConfiguratorTemplateTree.renderTemplateTreeStep3(
                    state,
                    getTemplateTreeHooks()
                );
                if (state._openDevisPerf) {
                    updateSummary({ lite: true });
                    scheduleDeferredCategoryTable();
                } else {
                    updateSummary();
                }
                return;
            }

            setStep3ParcoursHint(false);
            state.optionTabs = buildOptionTabsForStep3();

            // Render tabs
            const tabsContainer = document.getElementById('category-tabs');
            tabsContainer.innerHTML = '';

            const defaultTabIndex = getDefaultOptionTabIndex(state.optionTabs);
            currentCategoryIndex = defaultTabIndex;

            state.optionTabs.forEach((category, index) => {
                const tab = document.createElement('div');
                tab.className = `tab ${index === defaultTabIndex ? 'active' : ''}`;
                const tabLabel = isCategoryTableBusinessViewTab(category)
                    ? (String(state.selectedModel?.name || category.name || 'Modèle').trim() || 'Modèle')
                    : category.name;
                tab.textContent = tabLabel;
                tab.onclick = () => switchCategoryTab(index);
                tabsContainer.appendChild(tab);
            });

            if (state.optionTabs.length > 0) {
                if (state._openDevisPerf) {
                    const opt = document.getElementById('options-container');
                    if (opt) {
                        opt.innerHTML = `<div class="ugap-category-table-loading" style="padding:28px 16px;text-align:center;color:#64748b;">
                            <div class="loader" style="margin:0 auto 14px;"></div>
                            <span style="font-size:14px;font-weight:600;">Chargement des options…</span>
                        </div>`;
                    }
                    scheduleDeferredCategoryTable();
                } else {
                    renderCategoryOptions(defaultTabIndex);
                }
            } else {
                document.getElementById('subcategories-container').innerHTML =
                    '<p style="color:#666;">Aucune vue métier activée. Configurez-les dans le paramétrage UGAP (onglet Vues métier).</p>';
                document.getElementById('options-container').innerHTML = '';
            }

            if (state._openDevisPerf) {
                updateSummary({ lite: true });
            } else {
                updateSummary();
            }
        }

        let currentCategoryIndex = 0;

        function switchCategoryTab(index) {
            currentCategoryIndex = index;
            document.querySelectorAll('.tab').forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
            });
            renderCategoryOptions(index);
            if (state.use5Percent) {
                render5PercentOptions();
            }
            if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
        }

        function renderCategoryOptions(categoryIndex) {
            const subcategoriesContainer = document.getElementById('subcategories-container');
            const optionsContainer = document.getElementById('options-container');
            subcategoriesContainer.innerHTML = '';
            optionsContainer.innerHTML = '';

            const tab = state.optionTabs[categoryIndex];
            if (!tab) return;

            if (isExcelBusinessViewTab(tab)) {
                renderExcelCategoryOptions(tab, optionsContainer);
                return;
            }
            if (isCategoryTableBusinessViewTab(tab)) {
                renderCategoryTableOptions(tab, optionsContainer);
                return;
            }

            const families = state.tabFamiliesById.get(tab.id) || [];
            if (families.length === 0 && getConfiguredBusinessViews().length > 0) {
                // Fallback robuste: ne pas bloquer la configuration si le mapping vue→famille est vide.
                renderCategoryTableOptions(
                    { id: `${tab.id}__fallback_category_table`, name: tab.name || 'Tableau catégories', layoutType: 'category_table' },
                    optionsContainer
                );
                return;
            }
            if (families.length > 0) {
                const familyGrid = document.createElement('div');
                familyGrid.className = 'subcategories-grid';

                families.forEach((family) => {
                    const groups = Array.isArray(family.decisionGroups) ? family.decisionGroups : [];
                    const optionCount = (family.allOptions || []).length;
                    const selectedCount = countSelectedOptions(family.allOptions);
                    const card = document.createElement('div');
                    card.className = 'subcategory-card';
                    card.innerHTML = `
                        <h3>${escapeHtml(family.name)}</h3>
                        <div class="count">${groups.length} groupe(s) · ${optionCount} option(s)</div>
                        ${selectedCount ? `<div class="count" style="margin-top:4px;color:#0d6efd;">${selectedCount} sélectionnée(s)</div>` : ''}
                    `;
                    card.onclick = () => openFamilyModal(family);
                    familyGrid.appendChild(card);
                });

                subcategoriesContainer.appendChild(familyGrid);
                return;
            }

            // Dernier secours: afficher le tableau catégories au lieu d'un écran bloquant.
            renderCategoryTableOptions(
                { id: `${tab.id}__fallback_category_table`, name: tab.name || 'Tableau catégories', layoutType: 'category_table' },
                optionsContainer
            );
        }

        function applyOptionSelectionFromCheckbox(checkbox, option) {
            if (checkbox.checked) {
                if (state.use5Percent && !state.fivePercentOptions.has(option.id)) {
                    const price = catalogUgapPrice(option);
                    if (state.budget5Percent > 0 && getFivePercentTotal() + price > state.budget5Percent) {
                        alert('Budget 5% dépassé !');
                        checkbox.checked = false;
                        return;
                    }
                    state.fivePercentOptions.add(option.id);
                    state.selectedOptions.delete(option.id);
                } else {
                    state.selectedOptions.add(option.id);
                    state.fivePercentOptions.delete(option.id);
                }
            } else {
                state.selectedOptions.delete(option.id);
                state.fivePercentOptions.delete(option.id);
            }
            autoSelectMatchingNonSupplyMotor(checkbox);
            if (state.use5Percent) render5PercentOptions();
            updateSummary();
        }

        function createOptionItem(option, selectionCtx = null) {
            const item = document.createElement('div');
            item.className = 'option-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = option.id;
            checkbox.setAttribute('data-option-name', String(option?.name || ''));
            checkbox.checked = state.selectedOptions.has(option.id) || state.fivePercentOptions.has(option.id);
            checkbox.disabled = state.fivePercentOptions.has(option.id) && !state.use5Percent;

            if (selectionCtx?.decisionGroupKey) {
                checkbox.setAttribute('data-decision-group-key', selectionCtx.decisionGroupKey);
                checkbox.setAttribute('data-decision-mode', selectionCtx.decisionMode || 'single_choice');
                if (selectionCtx.decisionMode === 'single_choice') {
                    checkbox.classList.add('group-exclusive');
                }
            }

            checkbox.onchange = () => {
                const familyKey = checkbox.getAttribute('data-family-key') || '';
                const subFamilyKey = checkbox.getAttribute('data-subfamily-key') || '';
                const groupKey = checkbox.getAttribute('data-decision-group-key') || '';
                const decisionMode = checkbox.getAttribute('data-decision-mode') || '';

                if (checkbox.checked && familyKey && subFamilyKey) {
                    document.querySelectorAll(`input.fam-exclusive[data-family-key="${familyKey}"][data-subfamily-key="${subFamilyKey}"]`).forEach((other) => {
                        if (other === checkbox) return;
                        other.checked = false;
                        state.selectedOptions.delete(other.id);
                        state.fivePercentOptions.delete(other.id);
                    });
                }
                if (checkbox.checked && groupKey && decisionMode === 'single_choice') {
                    document.querySelectorAll(`input.group-exclusive[data-decision-group-key="${groupKey}"]`).forEach((other) => {
                        if (other === checkbox) return;
                        other.checked = false;
                        state.selectedOptions.delete(other.id);
                        state.fivePercentOptions.delete(other.id);
                    });
                }
                applyOptionSelectionFromCheckbox(checkbox, option);
                if (state.familyModalContext?.group && groupKey) {
                    renderFamilyModalContent();
                }
            };

            const label = document.createElement('label');
            label.htmlFor = option.id;
            label.textContent = option.name;

            const price = document.createElement('div');
            price.className = 'price';
            price.textContent = `${getOptionBillablePrice(option).toFixed(2)} €`;

            if (state.fivePercentOptions.has(option.id)) {
                const badge = document.createElement('span');
                badge.textContent = '5% Devis';
                badge.style.cssText = 'margin-left: 8px; padding: 2px 6px; background: #ffe08a; color: #856404; border-radius: 4px; font-size: 12px; font-weight: 600;';
                label.appendChild(badge);
            }

            item.appendChild(checkbox);
            item.appendChild(label);
            item.appendChild(price);
            return item;
        }

        function openSubCategoryModal(subCategory, options) {
            state.familyModalContext = null;
            const modal = document.getElementById('subcategory-modal');
            modal.querySelector('.modal-content')?.classList.add('modal-picker');
            const title = document.getElementById('subcategory-modal-title');
            const optionsList = document.getElementById('subcategory-options-list');

            title.textContent = subCategory.name;
            optionsList.innerHTML = '';

            if (subCategory.description) {
                const desc = document.createElement('p');
                desc.style.color = '#666';
                desc.style.marginBottom = '20px';
                desc.textContent = subCategory.description;
                optionsList.appendChild(desc);
            }

            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-list';

            options.forEach(option => {
                const item = createOptionItem(option);
                optionsContainer.appendChild(item);
            });

            optionsList.appendChild(optionsContainer);
            if (typeof openUgapModal === 'function') openUgapModal(modal);
            else modal.classList.add('active');
        }

        function openFamilyModal(family) {
            state.familyModalContext = { family, group: null };
            const modal = document.getElementById('subcategory-modal');
            modal.querySelector('.modal-content')?.classList.add('modal-wide', 'modal-picker');
            renderFamilyModalContent();
            if (typeof openUgapModal === 'function') openUgapModal(modal);
            else modal.classList.add('active');
        }

        function renderFamilyModalContent() {
            const ctx = state.familyModalContext;
            const modal = document.getElementById('subcategory-modal');
            const title = document.getElementById('subcategory-modal-title');
            const optionsList = document.getElementById('subcategory-options-list');
            if (!ctx?.family || !title || !optionsList) return;

            optionsList.innerHTML = '';

            if (!ctx.group) {
                title.textContent = ctx.family.name;
                const groups = Array.isArray(ctx.family.decisionGroups) ? ctx.family.decisionGroups : [];
                if (!groups.length) {
                    optionsList.innerHTML = '<p style="color:#666;">Aucun groupe de décision configuré pour cette famille.</p>';
                    return;
                }
                const intro = document.createElement('p');
                intro.style.cssText = 'color:#666;margin:0 0 14px 0;';
                intro.textContent = 'Choisissez un groupe pour sélectionner les options.';
                optionsList.appendChild(intro);

                const grid = document.createElement('div');
                grid.className = 'subcategories-grid';
                groups.forEach((group) => {
                    const opts = Array.isArray(group.options) ? group.options : [];
                    const selectedInGroup = countSelectedOptions(opts);
                    const card = document.createElement('div');
                    card.className = 'subcategory-card';
                    const typeLabel = group.type === 'model' ? 'Modèle' : (group.type === 'static' ? 'Statique' : 'Option');
                    card.innerHTML = `
                        <h3>${escapeHtml(group.label)}</h3>
                        <span class="mode-badge">${escapeHtml(getDecisionModeLabel(group.decisionMode))}</span>
                        <div class="count" style="margin-top:8px;">${opts.length} option(s) · ${escapeHtml(typeLabel)}</div>
                        ${selectedInGroup ? `<div class="count" style="margin-top:4px;color:#0d6efd;">${selectedInGroup} sélectionnée(s)</div>` : ''}
                    `;
                    card.onclick = () => {
                        state.familyModalContext.group = group;
                        renderFamilyModalContent();
                    };
                    grid.appendChild(card);
                });
                optionsList.appendChild(grid);
                return;
            }

            const group = ctx.group;
            title.textContent = `${ctx.family.name} — ${group.label}`;

            const backRow = document.createElement('div');
            backRow.className = 'modal-back-row';
            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'modal-back-btn';
            backBtn.textContent = '← Retour aux groupes';
            backBtn.onclick = () => {
                state.familyModalContext.group = null;
                renderFamilyModalContent();
            };
            backRow.appendChild(backBtn);
            optionsList.appendChild(backRow);

            const groupOptions = Array.isArray(group.options) ? group.options : [];
            if (!groupOptions.length) {
                const empty = document.createElement('p');
                empty.style.color = '#666';
                empty.textContent = group.type === 'model'
                    ? 'Ce groupe est de type « modèle » (pas de ligne catalogue à sélectionner ici).'
                    : 'Aucune option compatible avec ce modèle dans ce groupe.';
                optionsList.appendChild(empty);
                return;
            }

            if (group.decisionMode === 'multi_choice') {
                const modeHint = document.createElement('p');
                modeHint.style.cssText = 'color:#666;margin:0 0 12px 0;font-size:13px;';
                modeHint.textContent = 'Choix multiple : cochez les options puis validez.';
                optionsList.appendChild(modeHint);

                const sorted = sortOptionsByPosteThenName(groupOptions);
                const posteGroups = buildPosteGroups(sorted);
                const decisionGroupKey = `${ctx.family.id}:${group.id}`;
                const selectionCtx = {
                    decisionGroupKey,
                    decisionMode: 'multi_choice'
                };

                posteGroups.forEach((posteGroup) => {
                    const posteTitle = document.createElement('div');
                    posteTitle.style.cssText = 'font-size:12px;font-weight:600;color:#666;margin:12px 0 6px;';
                    posteTitle.textContent = posteGroup.label;
                    optionsList.appendChild(posteTitle);

                    const list = document.createElement('div');
                    list.className = 'options-list';
                    posteGroup.options.forEach((option) => {
                        list.appendChild(createOptionItem(option, selectionCtx));
                    });
                    optionsList.appendChild(list);
                });
                return;
            }

            const normGroup = window.UgapConfiguratorTemplateTree?.normalizeFamilyGroupForConfigurator
                ? window.UgapConfiguratorTemplateTree.normalizeFamilyGroupForConfigurator(ctx.family, group)
                : {
                    familyLabel: ctx.family.name,
                    groupId: group.id,
                    label: group.label,
                    decisionMode: 'single_choice',
                    options: groupOptions,
                    defaultOptionId: ctx.family.defaultOptionId
                };
            const hooks = getTemplateTreeHooks();
            if (window.UgapConfiguratorTemplateTree?.hydrateGroupOptions) {
                normGroup = window.UgapConfiguratorTemplateTree.hydrateGroupOptions(state, normGroup, hooks);
            }
            if (window.UgapConfiguratorTemplateTree?.ensureSingleChoiceGroupDefault) {
                window.UgapConfiguratorTemplateTree.ensureSingleChoiceGroupDefault(state, normGroup, hooks);
            }
            if (window.UgapConfiguratorTemplateTree?.appendSingleChoicePickerToModal) {
                window.UgapConfiguratorTemplateTree.appendSingleChoicePickerToModal(
                    state,
                    normGroup,
                    hooks,
                    optionsList,
                    () => {
                        closeSubCategoryModal();
                    }
                );
            }
        }

        function closeSubCategoryModal() {
            const hadCatalogPicker = !!state._templateTreeModalGroup;
            const tplMode = state.step === 4
                && window.UgapConfiguratorTemplateTree?.shouldUseTemplateTree?.(state);
            if (tplMode && hadCatalogPicker) {
                window.UgapConfiguratorTemplateTree.closeTemplateTreeModal(state, getTemplateTreeHooks());
                return;
            }
            state.familyModalContext = null;
            state._templateTreeModalGroup = null;
            const modal = document.getElementById('subcategory-modal');
            if (modal) {
                modal.querySelector('.modal-content')?.classList.remove('modal-wide');
                if (typeof closeUgapModal === 'function') closeUgapModal(modal);
                else modal.classList.remove('active');
            }
            if (state.step === 4 && state.optionTabs.length > 0) {
                renderCategoryOptions(currentCategoryIndex);
            } else if (hadCatalogPicker) {
                refreshCategoryTableIfVisible();
            }
            if (tplMode) {
                renderStep3();
            }
        }

        window.closeSubCategoryModal = closeSubCategoryModal;

        // Fermer le modal en cliquant en dehors
        document.getElementById('subcategory-modal').addEventListener('click', (e) => {
            if (e.target.id === 'subcategory-modal') {
                closeSubCategoryModal();
            }
        });

        const fivePctGroupModalEl = document.getElementById('five-percent-group-modal');
        if (fivePctGroupModalEl) {
            fivePctGroupModalEl.addEventListener('click', (e) => {
                if (e.target.id === 'five-percent-group-modal') closeFivePercentGroupModal();
            });
        }

        function toggle5Percent() {
            state.use5Percent = document.getElementById('enable-5percent').checked;
            const container = document.getElementById('five-percent-options');
            
            if (state.use5Percent) {
                container.classList.add('active');
                calculate5PercentBudget();
                render5PercentOptions();
                const tab = state.optionTabs?.[currentCategoryIndex];
                if (tab && isCategoryTableBusinessViewTab(tab)) {
                    renderCategoryOptions(currentCategoryIndex);
                }
            } else {
                container.classList.remove('active');
                state.fivePercentOptions.clear();
                state.fivePercentCustomOptions = [];
                renderCategoryOptions(currentCategoryIndex);
                updateSummary();
            }
        }

        /** Prix facturé au récap : IBP = inclus → toujours 0 € (le tarif passe par la ligne mino/majo liée). */
        function getOptionBillablePrice(opt) {
            if (!opt || typeof opt !== 'object') return 0;
            if (isBaseCatalogOption(opt)) return 0;
            if (getOptionInclusionKind(opt) === 'inclus') return 0;
            return catalogUgapPrice(opt);
        }

        function forEachResolvedTemplateGroup(visitor) {
            const roots = state._boatTemplateResolved?.resolvedRoots;
            if (!Array.isArray(roots) || !roots.length || typeof visitor !== 'function') return;
            const walk = (nodes) => {
                (Array.isArray(nodes) ? nodes : []).forEach((node) => {
                    (Array.isArray(node?.decisionGroups) ? node.decisionGroups : []).forEach((group) => {
                        if (!group?.missing) visitor(group, node);
                    });
                    walk(node?.children);
                });
            };
            walk(roots);
        }

        /**
         * Matérialise les mino/majo liées dans selectedOptions
         * pour que les cases de l'onglet Excel reflètent l'onglet 1.
         */
        function syncLinkedAdjSelectionsForCurrentTemplateGroups() {
            const BAL = window.UgapBaseAdjLinks;
            const Tpl = window.UgapConfiguratorTemplateTree;
            if (!BAL?.syncLinkedAdjForAdjPricingGroups || !Tpl?.getGroupBaseOptionId) return;
            const groups = [];
            forEachResolvedTemplateGroup((group) => groups.push(group));
            if (!groups.length) return;
            const hooks = getTemplateTreeHooks();
            const isReplaced = Tpl?.isBaseReplacedInGroup || Tpl?.isIbpReplacedInGroup;
            BAL.syncLinkedAdjForAdjPricingGroups(
                state,
                groups,
                hooks,
                (id) => getCatalogOptionById(id),
                {
                    isBaseReplacedInGroup: (st, grp, h) => (typeof isReplaced === 'function' ? isReplaced(st, grp, h) : false),
                    getGroupBaseOptionId: (st, grp, h) => Tpl.getGroupBaseOptionId(st, grp, h),
                    getSingleChoiceDisplay: (st, grp, h) =>
                        (typeof Tpl.getSingleChoiceDisplay === 'function' ? Tpl.getSingleChoiceDisplay(st, grp, h) : null)
                }
            );
        }

        /**
         * Choix effectifs des groupes (pour retrouver les IBP et leurs lignes mino/majo liées).
         * Les IBP ne sont pas facturées (inclus, 0 €).
         */
        function collectEffectiveChoiceIdsFromFamilyGroups(ids) {
            const Tpl = window.UgapConfiguratorTemplateTree;
            if (!Tpl?.getSingleChoiceDisplay) return;
            const hooks = getTemplateTreeHooks();
            const optionById = getCatalogueOptionByIdMap();
            const catalogueFamilies = getValidatedFamiliesForBusinessViews();
            const Tree = window.UgapBoatTemplateTree;

            getCategoryTableCatalogueCategories().forEach((category) => {
                const resolved = Tree?.resolveCategoryFamiliesWithGroups
                    ? Tree.resolveCategoryFamiliesWithGroups(category, catalogueFamilies)
                    : [];
                resolved.forEach((fam) => {
                    const famLabel = String(fam?.familyLabel || '').trim();
                    const src = Tree?.findCatalogueFamily
                        ? Tree.findCatalogueFamily(catalogueFamilies, {
                            familyLabel: famLabel,
                            sourceIndex: fam.sourceIndex
                        })
                        : catalogueFamilies.find((f) =>
                            String(f?.familyLabel || '').trim().toLowerCase() === famLabel.toLowerCase()
                        );
                    const defId = src?.defaultOptionId != null
                        ? String(src.defaultOptionId).trim()
                        : '';
                    (Array.isArray(fam?.decisionGroups) ? fam.decisionGroups : []).forEach((g) => {
                        const catalogueOptionIds = (Array.isArray(g?.optionIds) ? g.optionIds : [])
                            .map((x) => String(x || '').trim())
                            .filter(Boolean);
                        if (!catalogueOptionIds.length) return;
                        const group = buildConfiguratorGroupObject(fam, g, optionById, defId);
                        if (group.decisionMode === 'multi_choice') {
                            (group.options || []).forEach((opt) => {
                                const oid = String(opt?.id || '').trim();
                                if (oid && state.selectedOptions.has(oid)) ids.add(oid);
                            });
                            return;
                        }
                        const display = Tpl.getSingleChoiceDisplay(state, group, hooks);
                        const oid = String(display?.option?.id || '').trim();
                        if (oid) ids.add(oid);
                    });
                });
            });
        }

        function isAdjOptionForConfigurator(opt) {
            const BAL = window.UgapBaseAdjLinks;
            if (BAL?.isAdjOptionForBaseLink) return BAL.isAdjOptionForBaseLink(opt);
            return getOptionLineKind(opt).kind === 'minoration' || getOptionLineKind(opt).kind === 'majoration';
        }

        function getReplacedIbpLinkedAdjIdSet() {
            if (state._replacedIbpLinkedAdjIds) return state._replacedIbpLinkedAdjIds;
            const ids = new Set();
            appendLinkedAdjForReplacedIbps(ids);
            state._replacedIbpLinkedAdjIds = ids;
            return ids;
        }

        /** Mino/majo liée auto si remplacement moteur de base (pas console / autres IBP). */
        function isAdjLinkedToReplacedIbp(adjOptionId) {
            const aid = String(adjOptionId || '').trim();
            if (!aid) return false;
            return getReplacedIbpLinkedAdjIdSet().has(aid);
        }

        function appendLinkedAdjForReplacedIbps(ids) {
            const BAL = window.UgapBaseAdjLinks;
            const Tpl = window.UgapConfiguratorTemplateTree;
            const hooks = getTemplateTreeHooks();
            const isReplaced = Tpl?.isBaseReplacedInGroup || Tpl?.isIbpReplacedInGroup;
            if (!BAL?.resolveSourceAdjOptionIdsForBase || !isReplaced || !Tpl?.getGroupBaseOptionId) return;
            const categories = Array.isArray(state.categories) ? state.categories : [];
            const importBaseProducts = Array.isArray(state.importBaseProducts) ? state.importBaseProducts : [];
            const addForGroup = (group) => {
                if (!group || group.decisionMode === 'multi_choice') return;
                if (!isReplaced(state, group, hooks)) return;
                if (BAL?.isMotorLinkedAdjGroup?.(group) !== true) return;
                const defaultBaseId = String(Tpl.getGroupBaseOptionId(state, group, hooks) || '').trim();
                if (!defaultBaseId) return;
                BAL.resolveSourceAdjOptionIdsForBase(defaultBaseId, categories, importBaseProducts)
                    .forEach((adjId) => {
                        const aid = String(adjId || '').trim();
                        if (aid) ids.add(aid);
                    });
            };
            forEachResolvedTemplateGroup(addForGroup);
            getCategoryTableCatalogueCategories().forEach((category) => {
                const catalogueFamilies = getValidatedFamiliesForBusinessViews();
                const optionById = getCatalogueOptionByIdMap();
                const Tree = window.UgapBoatTemplateTree;
                const resolved = Tree?.resolveCategoryFamiliesWithGroups
                    ? Tree.resolveCategoryFamiliesWithGroups(category, catalogueFamilies)
                    : [];
                resolved.forEach((fam) => {
                    const famLabel = String(fam?.familyLabel || '').trim();
                    const src = Tree?.findCatalogueFamily
                        ? Tree.findCatalogueFamily(catalogueFamilies, {
                            familyLabel: famLabel,
                            sourceIndex: fam.sourceIndex
                        })
                        : catalogueFamilies.find((f) =>
                            String(f?.familyLabel || '').trim().toLowerCase() === famLabel.toLowerCase()
                        );
                    const defId = src?.defaultOptionId != null
                        ? String(src.defaultOptionId).trim()
                        : '';
                    (Array.isArray(fam?.decisionGroups) ? fam.decisionGroups : []).forEach((g) => {
                        const catalogueOptionIds = (Array.isArray(g?.optionIds) ? g.optionIds : [])
                            .map((x) => String(x || '').trim())
                            .filter(Boolean);
                        if (!catalogueOptionIds.length) return;
                        addForGroup(buildConfiguratorGroupObject(fam, g, optionById, defId));
                    });
                });
            });
        }

        /** Options facturables au récap (IBP à 0 € ; mino/majo liée seulement si remplacement IBP). */
        function collectConfiguratorBillableOptionIds() {
            const ids = new Set();
            state.selectedOptions.forEach((id) => {
                const oid = String(id || '').trim();
                if (!oid) return;
                const opt = getCatalogOptionById(oid);
                if (!opt) return;
                if (isBaseCatalogOption(opt)) return;
                if (isAdjOptionForConfigurator(opt) && !isAdjLinkedToReplacedIbp(oid)) return;
                ids.add(oid);
            });

            const Tpl = window.UgapConfiguratorTemplateTree;
            const hooks = getTemplateTreeHooks();
            if (Tpl?.getSingleChoiceDisplay) {
                forEachResolvedTemplateGroup((group) => {
                    if (group.decisionMode === 'multi_choice') return;
                    const display = Tpl.getSingleChoiceDisplay(state, group, hooks);
                    const oid = String(display?.option?.id || '').trim();
                    if (oid && !isBaseCatalogOption(display.option)) ids.add(oid);
                });
            }

            collectEffectiveChoiceIdsFromFamilyGroups(ids);
            appendLinkedAdjForReplacedIbps(ids);

            return ids;
        }

        /** Toutes les lignes parcours (incluses + facturables) pour l'affichage / PDF détaillé. */
        function collectConfiguratorDisplayOptionIds() {
            const Tpl = window.UgapConfiguratorTemplateTree;
            const hooks = getTemplateTreeHooks();
            if (typeof Tpl?.collectParcoursOrderedDisplayOptionIds === 'function') {
                return Tpl.collectParcoursOrderedDisplayOptionIds(state, hooks);
            }
            return Array.from(collectConfiguratorBillableOptionIds());
        }

        /** Sous-total récap : prix bateau + options devis + mino/majo si remplacement IBP (IBP = 0 €). */
        function computeConfiguratorSubtotal() {
            let subtotal = state.selectedModel?.basePrice || 0;
            const optionById = getCatalogueOptionByIdMap();
            collectConfiguratorBillableOptionIds().forEach((optId) => {
                const option = optionById.get(String(optId || '').trim());
                if (!option) return;
                if (state.fivePercentOptions.has(optId)) return;
                subtotal += getOptionBillablePrice(option);
            });
            return subtotal;
        }

        function calculate5PercentBudget() {
            state.budget5Percent = computeConfiguratorSubtotal() * 0.05;
        }

        function getOptionById(optionId) {
            const id = String(optionId || '').trim();
            if (!id) return null;
            return getCatalogueOptionByIdMap().get(id) || null;
        }

        function getOptionCategoryId(optionId) {
            const id = String(optionId || '').trim();
            if (!id) return null;
            const Tree = window.UgapBoatTemplateTree;
            const catalogueFamilies = getValidatedFamiliesForBusinessViews();
            for (const category of getConfiguratorCatalogueCategories()) {
                const ids = Tree?.collectCategoryOptionIdsFromFamilies
                    ? Tree.collectCategoryOptionIdsFromFamilies(category, catalogueFamilies)
                    : [];
                if (ids.includes(id)) return category.id;
            }
            return null;
        }

        function getFivePercentCustomOptionsForCategory(categoryId) {
            return (state.fivePercentCustomOptions || []).filter(opt => opt.categoryId === categoryId);
        }

        function addFivePercentCustomOption(categoryId) {
            const nameInput = document.getElementById('five-percent-custom-name');
            const priceInput = document.getElementById('five-percent-custom-price');
            if (!nameInput || !priceInput) return;

            const name = nameInput.value.trim();
            const price = parseFloat(priceInput.value);
            if (!name || Number.isNaN(price) || price <= 0) {
                alert('Nom et prix valides requis.');
                return;
            }

            if (state.budget5Percent > 0 && getFivePercentTotal() + price > state.budget5Percent) {
                alert('Budget 5% dépassé !');
                return;
            }

            state.fivePercentCustomOptions.push({
                id: `fivepct_custom_${Date.now()}`,
                name,
                price,
                categoryId,
                selected: true
            });

            nameInput.value = '';
            priceInput.value = '';
            render5PercentOptions();
            updateSummary();
        }

        function removeFivePercentCustomOption(customId) {
            state.fivePercentCustomOptions = (state.fivePercentCustomOptions || []).filter(opt => opt.id !== customId);
            render5PercentOptions();
            updateSummary();
        }

        function render5PercentOptions() {
            const container = document.getElementById('five-percent-options');
            const currentCategory = state.optionTabs[currentCategoryIndex];
            const currentCategoryId = currentCategory?.id;
            const fivePercentTotal = getFivePercentTotal();
            const remaining = Math.max(0, state.budget5Percent - fivePercentTotal);
            const currentTabOptionIds = new Set(
                (Array.isArray(currentCategory?.options) ? currentCategory.options : [])
                    .map((opt) => String(opt?.id || '').trim())
                    .filter(Boolean)
            );

            const selectedInCategory = Array.from(state.fivePercentOptions)
                .filter(optId => !currentCategoryId || currentTabOptionIds.has(String(optId || '').trim()))
                .map(getOptionById)
                .filter(Boolean);

            const customInCategory = currentCategoryId ? getFivePercentCustomOptionsForCategory(currentCategoryId) : [];

            container.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <div><strong>5% Devis:</strong> ${state.budget5Percent.toFixed(2)} €</div>
                    <div><strong>Déjà ajouté:</strong> ${fivePercentTotal.toFixed(2)} €</div>
                    <div><strong>Restant:</strong> ${remaining.toFixed(2)} €</div>
                </div>
                <div style="margin-bottom: 12px; font-weight: 600;">Options 5% dans cette catégorie</div>
                ${selectedInCategory.length === 0 && customInCategory.length === 0 ? `
                    <p style="color: #666; margin-top: 0;">Aucune option 5% enregistrée pour cette catégorie.</p>
                ` : `
                    <ul style="margin: 0 0 10px 18px; padding: 0;">
                        ${selectedInCategory.map(opt => `
                            <li>${opt.name} — ${catalogUgapPrice(opt).toFixed(2)} €</li>
                        `).join('')}
                        ${customInCategory.map(opt => `
                            <li>${opt.name} — ${opt.price.toFixed(2)} € 
                                <button onclick="removeFivePercentCustomOption('${opt.id}')" style="margin-left: 8px; background: #dc3545; color: white; border: none; border-radius: 4px; padding: 2px 6px; cursor: pointer;">✕</button>
                            </li>
                        `).join('')}
                    </ul>
                `}
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #f1dca7;">
                    <div style="font-weight: 600; margin-bottom: 8px;">Créer une option 5% Devis</div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        <input id="five-percent-custom-name" type="text" placeholder="Libellé" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-width: 220px;">
                        <input id="five-percent-custom-price" type="number" step="0.01" min="0" placeholder="Prix (€)" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 140px;">
                        <button onclick="addFivePercentCustomOption('${currentCategoryId || ''}')" style="padding: 8px 14px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Ajouter
                        </button>
                    </div>
                </div>
            `;
            
            renderCategoryOptions(currentCategoryIndex);
            updateSummary();
        }

        function getFivePercentTotal() {
            let total = 0;
            const optionById = getCatalogueOptionByIdMap();
            state.fivePercentOptions.forEach((optId) => {
                const option = optionById.get(String(optId || '').trim());
                if (option) total += catalogUgapPrice(option);
            });
            (state.fivePercentCustomOptions || []).forEach((opt) => {
                if (isFivePercentCustomOptionCounted(opt)) total += opt.price || 0;
            });
            return total;
        }

        function computeConfiguratorSubtotalLite() {
            let subtotal = state.selectedModel?.basePrice || 0;
            const optionById = getCatalogueOptionByIdMap();
            state.selectedOptions.forEach((optId) => {
                const option = optionById.get(String(optId || '').trim());
                if (!option || isBaseCatalogOption(option)) return;
                if (getOptionInclusionKind(option) === 'inclus') return;
                subtotal += getOptionBillablePrice(option);
            });
            return subtotal;
        }

        function scheduleDeferredCategoryTable() {
            const run = () => {
                if (state.step !== 4 || state.showEntryScreen) return;
                const container = document.getElementById('options-container');
                if (!container) return;
                if (window.UgapConfiguratorTemplateTree?.shouldUseTemplateTree?.(state)) {
                    window.UgapConfiguratorTemplateTree.renderTemplateTreeStep3(
                        state,
                        getTemplateTreeHooks()
                    );
                } else if (state.optionTabs.length > 0) {
                    const idx = getDefaultOptionTabIndex(state.optionTabs);
                    currentCategoryIndex = idx;
                    document.querySelectorAll('.tab').forEach((tabEl, i) => {
                        tabEl.classList.toggle('active', i === idx);
                    });
                    renderCategoryOptions(idx);
                }
                state._deferredCategoryTableBanner = '';
                invalidateBillableDerivationCache();
                updateSummary();
                if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
            };
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(run, { timeout: 120 });
            } else {
                setTimeout(run, 0);
            }
        }

        function updateSummary(opts) {
            const options = opts && typeof opts === 'object' ? opts : {};
            const lite = options.lite === true;
            if (!lite) {
                syncLinkedAdjSelectionsForCurrentTemplateGroups();
                materializeReplacedIbpLinkedAdjInSelection();
                invalidateBillableDerivationCache();
            }
            document.getElementById('summary-model').textContent = state.selectedModel?.name || '-';
            document.getElementById('summary-config').textContent = state.selectedConfig?.name || '-';

            const optionsCount = state.selectedOptions.size + state.fivePercentOptions.size + (state.fivePercentCustomOptions || []).length;
            document.getElementById('summary-options-count').textContent = optionsCount;

            const subtotal = lite ? computeConfiguratorSubtotalLite() : computeConfiguratorSubtotal();

            document.getElementById('summary-subtotal').textContent = subtotal.toFixed(2) + ' €';

            if (state.use5Percent) {
                if (!lite) calculate5PercentBudget();
                else state.budget5Percent = subtotal * 0.05;
                const fivePercentTotal = getFivePercentTotal();
                document.getElementById('summary-5percent').textContent = fivePercentTotal.toFixed(2) + ' €';
                document.getElementById('summary-5percent-item').style.display = 'flex';
                document.getElementById('summary-total').textContent = (subtotal + fivePercentTotal).toFixed(2) + ' €';
            } else {
                document.getElementById('summary-5percent-item').style.display = 'none';
                document.getElementById('summary-total').textContent = subtotal.toFixed(2) + ' €';
            }
            if (!lite) {
                syncConfiguratorExcelTable();
                syncConfiguratorDevisTable();
                refreshCategoryTableIfVisible();
            }
        }

        function goToStep(step) {
            state.showEntryScreen = false;
            state.step = step;
            render();
            if (typeof onEmbeddedTabActivated === 'function') {
                onEmbeddedTabActivated();
            } else if (typeof scheduleParentEmbedResize === 'function') {
                if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
            }
        }

        async function loadDevisPrintTemplates() {
            try {
                const result = await apiCall('/devis/templates');
                state.devisPrintTemplates = Array.isArray(result?.data?.templates)
                    ? result.data.templates
                    : [];
            } catch (error) {
                console.warn('[UGAP] Modèles devis indisponibles:', error?.message || error);
                state.devisPrintTemplates = [];
            }
        }

        function getQuickPrintTemplates() {
            return (state.devisPrintTemplates || []).filter((t) => t.quickPrint === true);
        }

        function buildRenderPayloadFromSavedEntry(entry, templateNamespace) {
            const payload = entry?.payload && typeof entry.payload === 'object' ? entry.payload : {};
            const tpl = getDevisTemplateByNamespace(templateNamespace);
            const showIncludedLines = templateShowsIncludedLines(tpl)
                || payload.devisDisplayOptions?.showIncludedLines === true;
            return {
                modelId: payload.modelId,
                configId: payload.configId,
                selectedOptions: Array.isArray(payload.selectedOptions) ? payload.selectedOptions : [],
                fivePercentOptions: Array.isArray(payload.fivePercentOptions) ? payload.fivePercentOptions : [],
                fivePercentCustomOptions: Array.isArray(payload.fivePercentCustomOptions)
                    ? payload.fivePercentCustomOptions
                    : [],
                use5Percent: payload.use5Percent !== false,
                devisName: String(payload.devisName || entry?.name || '').trim(),
                configName: String(payload.devisName || entry?.name || '').trim(),
                clientId: payload.clientId || null,
                clientInfo: payload.clientInfo || null,
                commercialId: payload.commercialId || null,
                templateNamespace: String(templateNamespace || '').trim() || undefined,
                showIncludedLines,
                displayOptionIds: showIncludedLines && Array.isArray(payload.displayOptionIds)
                    ? payload.displayOptionIds
                    : [],
                billableOptionIds: Array.isArray(payload.billableOptionIds) ? payload.billableOptionIds : undefined,
                devisOptionCategories: payload.devisOptionCategories || undefined,
                devisModelCategory: payload.devisModelCategory || undefined
            };
        }

        async function downloadDevisPdf(payload) {
            const response = await fetch(`${resolveConfiguratorApiBase()}/devis/render`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const err = await response.json();
                    throw new Error(err.message || `Erreur HTTP ${response.status}`);
                }
                const raw = await response.text().catch(() => '');
                if (response.status === 502) {
                    throw new Error(
                        'Le serveur a interrompu la génération PDF (502). '
                        + 'Vérifiez que le backend GDRI tourne sur le port 3000, que Google Chrome est installé, '
                        + 'puis relancez le backend. Détail : '
                        + (raw || 'proxy Apache / timeout').slice(0, 180)
                    );
                }
                throw new Error(raw ? raw.slice(0, 220) : `Erreur HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const numero = response.headers.get('X-Ugap-Devis-Numero') || payload.devisName || 'devis';
            const safeName = String(numero).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${safeName}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        }

        function ensurePrintTemplateModal() {
            let modal = document.getElementById('ugap-print-template-modal');
            if (modal) return modal;
            modal = document.createElement('div');
            modal.id = 'ugap-print-template-modal';
            modal.className = 'ugap-print-template-modal hidden';
            modal.innerHTML = `
                <div class="ugap-print-template-modal__panel" role="dialog" aria-modal="true" aria-labelledby="ugap-print-template-title">
                    <div class="ugap-print-template-modal__head">
                        <h3 id="ugap-print-template-title">Choisir le modèle de devis</h3>
                        <button type="button" class="ugap-print-template-modal__close" data-print-template-close aria-label="Fermer">&times;</button>
                    </div>
                    <div id="ugap-print-template-list" class="ugap-print-template-list"></div>
                    <label class="ugap-print-template-default">
                        <input type="checkbox" id="ugap-print-template-save-default">
                        Utiliser comme modèle par défaut
                    </label>
                    <div class="ugap-print-template-modal__actions">
                        <button type="button" class="btn btn-outline" data-print-template-close>Annuler</button>
                        <button type="button" class="btn btn-primary" id="ugap-print-template-confirm">Imprimer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            if (window.UgapEmbedLayout?.portalUgapModalToBody) {
                window.UgapEmbedLayout.portalUgapModalToBody(modal);
            }
            return modal;
        }

        function pickPrintTemplate() {
            const templates = Array.isArray(state.devisPrintTemplates) ? state.devisPrintTemplates : [];
            if (!templates.length) {
                return Promise.resolve({
                    namespace: 'ugap:devis:default',
                    saveAsDefault: false
                });
            }
            if (templates.length === 1) {
                return Promise.resolve({
                    namespace: templates[0].namespace,
                    saveAsDefault: false
                });
            }

            return new Promise((resolve) => {
                const modal = ensurePrintTemplateModal();
                const listEl = document.getElementById('ugap-print-template-list');
                const saveDefaultEl = document.getElementById('ugap-print-template-save-default');
                const confirmBtn = document.getElementById('ugap-print-template-confirm');
                const defaultNs = templates.find((t) => t.isDefaultPrint)?.namespace
                    || templates.find((t) => t.isActive)?.namespace
                    || templates[0].namespace;
                let settled = false;

                const finish = (result) => {
                    if (settled) return;
                    settled = true;
                    modal.classList.add('hidden');
                    resolve(result);
                };

                listEl.innerHTML = templates.map((t) => `
                    <label class="ugap-print-template-option">
                        <input type="radio" name="ugap-print-template-choice" value="${escapeHtml(t.namespace)}"${t.namespace === defaultNs ? ' checked' : ''}>
                        <span>${escapeHtml(t.name || t.namespace)}</span>
                    </label>
                `).join('');
                if (saveDefaultEl) saveDefaultEl.checked = !!templates.find((t) => t.namespace === defaultNs)?.isDefaultPrint;

                const onConfirm = () => {
                    const selected = listEl.querySelector('input[name="ugap-print-template-choice"]:checked');
                    const namespace = String(selected?.value || defaultNs || '').trim();
                    if (!namespace) {
                        finish(null);
                        return;
                    }
                    finish({
                        namespace,
                        saveAsDefault: !!saveDefaultEl?.checked
                    });
                };

                const onClose = (ev) => {
                    if (ev.target === modal || ev.target.closest('[data-print-template-close]')) {
                        finish(null);
                    }
                };

                confirmBtn?.addEventListener('click', onConfirm, { once: true });
                modal.addEventListener('click', onClose, { once: true });
                modal.classList.remove('hidden');
            });
        }

        async function maybeSaveDefaultPrintTemplate(namespace, saveAsDefault) {
            if (!saveAsDefault || !namespace) return;
            try {
                await apiCall(`/devis/templates/${encodeURIComponent(namespace)}/prefs`, {
                    method: 'PATCH',
                    body: JSON.stringify({ isDefaultPrint: true })
                });
                await loadDevisPrintTemplates();
            } catch (error) {
                console.warn('[UGAP] Modèle par défaut non enregistré:', error?.message || error);
            }
        }

        async function quickPrintSavedDevis(savedId, templateNamespace, triggerBtn) {
            const id = String(savedId || '').trim();
            const ns = String(templateNamespace || '').trim();
            if (!id || !ns) return;
            const entry = (getSavedDevisStore().versions || []).find((item) => String(item?.id || '') === id);
            if (!entry?.payload) {
                alert('Devis introuvable.');
                return;
            }
            const btn = triggerBtn instanceof HTMLElement ? triggerBtn : null;
            const prevHtml = btn?.innerHTML || '';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = 'Génération…';
            }
            try {
                const payload = buildRenderPayloadFromSavedEntry(entry, ns);
                await downloadDevisPdf(payload);
            } catch (error) {
                alert(`Erreur impression : ${error.message || 'Erreur inconnue'}`);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = prevHtml;
                }
            }
        }

        function buildDevisGenerationPayload() {
            const billableOptionIds = Array.from(collectConfiguratorBillableOptionIds());
            const displayOptions = getDevisDisplayOptions();
            const Tpl = window.UgapConfiguratorTemplateTree;
            const hooks = getTemplateTreeHooks();
            const devisOptionCategories = typeof Tpl?.collectDevisOptionCategoryMap === 'function'
                ? Tpl.collectDevisOptionCategoryMap(state, hooks)
                : {};
            const devisModelCategory = typeof Tpl?.collectDevisModelCategory === 'function'
                ? Tpl.collectDevisModelCategory(state, hooks)
                : '';

            const selectedOptionsArray = Array.from(new Set([
                ...Array.from(state.selectedOptions || []),
                ...billableOptionIds
            ]));
            if (state.use5Percent) {
                Array.from(state.fivePercentOptions || []).forEach((id) => {
                    if (!selectedOptionsArray.includes(id)) selectedOptionsArray.push(id);
                });
            }
            const displayOptionIds = displayOptions.showIncludedLines
                ? collectConfiguratorDisplayOptionIds()
                : [];

            return {
                modelId: state.selectedModel.id,
                configId: state.selectedConfig?.id,
                configName: String(state.selectedConfig?.name || '').trim(),
                selectedOptions: selectedOptionsArray,
                billableOptionIds,
                displayOptionIds,
                showIncludedLines: displayOptions.showIncludedLines === true,
                devisDisplayOptions: { ...displayOptions },
                devisOptionCategories,
                devisModelCategory,
                fivePercentOptions: Array.from(state.fivePercentOptions || []),
                fivePercentCustomOptions: Array.isArray(state.fivePercentCustomOptions)
                    ? state.fivePercentCustomOptions
                    : [],
                use5Percent: state.use5Percent !== false,
                devisName: String(state.devisName || '').trim() || buildDefaultDevisName()
            };
        }

        async function persistCurrentDevisSilently() {
            if (state.step !== 4 || !state.selectedModel || !state.selectedConfig) {
                return { ok: false, error: new Error('Devis incomplet') };
            }
            const finalName = String(state.devisName || '').trim() || buildDefaultDevisName();
            state.devisName = finalName;
            const snapshot = buildDevisSnapshot();
            try {
                const result = await apiCall('/saved-devis', {
                    method: 'POST',
                    body: JSON.stringify({ name: finalName, payload: snapshot })
                });
                const entry = result?.data;
                if (!entry?.id) {
                    throw new Error('Réponse serveur invalide');
                }
                await loadSavedDevisFromApi();
                state.openedSavedDevisId = entry.id;
                renderSavedDevisChoices();
                const input = document.getElementById('ugap-devis-name-input');
                if (input) input.value = finalName;
                return { ok: true, entry };
            } catch (error) {
                return { ok: false, error };
            }
        }

        async function generateDevis() {
            if (state.step !== 4 || !state.selectedModel || !state.selectedConfig) {
                alert('Sélectionnez d\'abord un modèle et une configuration.');
                return;
            }

            const saveResult = await persistCurrentDevisSilently();
            if (!saveResult.ok) {
                alert('Erreur lors de la sauvegarde du devis avant impression: ' + (saveResult.error?.message || 'Erreur inconnue'));
                return;
            }

            if (!state.devisPrintTemplates.length) {
                await loadDevisPrintTemplates();
            }
            const picked = await pickPrintTemplate();
            if (!picked?.namespace) return;
            await maybeSaveDefaultPrintTemplate(picked.namespace, picked.saveAsDefault);

            const clientSnap = window.UgapConfiguratorClientStep?.buildSnapshot
                ? window.UgapConfiguratorClientStep.buildSnapshot(state)
                : {};

            const payload = {
                ...buildDevisGenerationPayload(),
                clientId: clientSnap.clientId || null,
                clientInfo: clientSnap.clientInfo || null,
                commercialId: clientSnap.commercialId || null,
                templateNamespace: picked.namespace
            };

            try {
                await apiCall('/devis', {
                    method: 'POST',
                    body: JSON.stringify({
                        modelId: payload.modelId,
                        configId: payload.configId,
                        selectedOptions: payload.selectedOptions,
                        billableOptionIds: payload.billableOptionIds,
                        devisOptionCategories: payload.devisOptionCategories,
                        devisModelCategory: payload.devisModelCategory,
                        fivePercentOptions: payload.fivePercentOptions,
                        fivePercentCustomOptions: payload.fivePercentCustomOptions,
                        use5Percent: payload.use5Percent,
                        devisName: payload.devisName,
                        configName: payload.configName
                    })
                });
            } catch (syncErr) {
                console.warn('[UGAP] Pré-calcul serveur avant PDF:', syncErr?.message || syncErr);
            }

            const btn = document.getElementById('ugap-generate-devis-btn')
                || document.querySelector('[onclick="generateDevis()"]');
            const prevLabel = btn ? btn.textContent : '';
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Génération…';
            }

            try {
                await downloadDevisPdf(payload);
            } catch (error) {
                alert('Erreur lors de la génération du devis: ' + (error.message || 'Erreur inconnue'));
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = prevLabel || 'Générer le devis PDF';
                }
            }
        }

        async function loadSavedDevisFromApi() {
            try {
                const result = await apiCall('/saved-devis');
                state.savedDevisVersions = Array.isArray(result?.data?.versions) ? result.data.versions : [];
            } catch (error) {
                const msg = String(error?.message || '');
                if (msg.includes('404') || msg.includes('HTTP 404')) {
                    state.savedDevisVersions = [];
                    console.warn('API saved-devis indisponible — liste vide.');
                    return;
                }
                throw error;
            }
        }

        function getSavedDevisStore() {
            return { versions: Array.isArray(state.savedDevisVersions) ? state.savedDevisVersions : [] };
        }

        function readLocalSavedDevisVersions() {
            try {
                const raw = localStorage.getItem(SAVED_DEVIS_STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : { versions: [] };
                if (!parsed || typeof parsed !== 'object') return [];
                return Array.isArray(parsed.versions) ? parsed.versions : [];
            } catch (_) {
                return [];
            }
        }

        async function tryMigrateLocalStorageOnce() {
            if (localStorage.getItem(SAVED_DEVIS_MIGRATED_KEY)) {
                return;
            }
            const localVersions = readLocalSavedDevisVersions();
            if (!localVersions.length) {
                localStorage.setItem(SAVED_DEVIS_MIGRATED_KEY, '1');
                return;
            }
            try {
                const result = await apiCall('/saved-devis/migrate-local', {
                    method: 'POST',
                    body: JSON.stringify({ versions: localVersions })
                });
                state.savedDevisVersions = Array.isArray(result?.data?.versions)
                    ? result.data.versions
                    : state.savedDevisVersions;
                localStorage.removeItem(SAVED_DEVIS_STORAGE_KEY);
                localStorage.setItem(SAVED_DEVIS_MIGRATED_KEY, '1');
            } catch (error) {
                console.warn('Migration devis localStorage → API:', error);
            }
        }

        function buildDevisSnapshot() {
            const selectedOptions = Array.from(state.selectedOptions || []);
            const fivePercentOptions = Array.from(state.fivePercentOptions || []);
            const displayOptions = getDevisDisplayOptions();
            const clientSnap = window.UgapConfiguratorClientStep?.buildSnapshot
                ? window.UgapConfiguratorClientStep.buildSnapshot(state)
                : {};
            return {
                modelId: state.selectedModel?.id || null,
                configId: state.selectedConfig?.id || null,
                selectedOptions,
                fivePercentOptions,
                fivePercentCustomOptions: Array.isArray(state.fivePercentCustomOptions)
                    ? state.fivePercentCustomOptions
                    : [],
                use5Percent: !!state.use5Percent,
                devisName: state.devisName || '',
                devisDisplayOptions: { ...displayOptions },
                displayOptionIds: displayOptions.showIncludedLines
                    ? collectConfiguratorDisplayOptionIds()
                    : [],
                billableOptionIds: Array.from(collectConfiguratorBillableOptionIds()),
                devisOptionCategories: typeof window.UgapConfiguratorTemplateTree?.collectDevisOptionCategoryMap === 'function'
                    ? window.UgapConfiguratorTemplateTree.collectDevisOptionCategoryMap(state, getTemplateTreeHooks())
                    : {},
                devisModelCategory: typeof window.UgapConfiguratorTemplateTree?.collectDevisModelCategory === 'function'
                    ? window.UgapConfiguratorTemplateTree.collectDevisModelCategory(state, getTemplateTreeHooks())
                    : '',
                clientId: clientSnap.clientId || null,
                clientInfo: clientSnap.clientInfo || null,
                commercialId: clientSnap.commercialId || null
            };
        }

        function renderSavedDevisChoices() {
            const listEl = document.getElementById('ugap-saved-devis-list');
            if (!listEl) return;
            const store = getSavedDevisStore();
            const versions = Array.isArray(store.versions) ? store.versions : [];
            const latestByName = new Map();
            versions.forEach((entry) => {
                const name = String(entry?.name || '').trim();
                if (!name) return;
                const prev = latestByName.get(name);
                if (!prev || Number(entry.version || 0) > Number(prev.version || 0)) {
                    latestByName.set(name, entry);
                }
            });
            const latestList = Array.from(latestByName.values());
            const nameFilter = String(state.savedDevisFilters?.name || '').trim().toLowerCase();
            const dateOrder = String(state.savedDevisFilters?.dateOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
            const filtered = latestList.filter((entry) => {
                const entryName = String(entry?.name || '');
                if (nameFilter && !entryName.toLowerCase().includes(nameFilter)) return false;
                return true;
            }).sort((a, b) => {
                const ta = Number(new Date(a?.savedAt || 0));
                const tb = Number(new Date(b?.savedAt || 0));
                return dateOrder === 'asc' ? ta - tb : tb - ta;
            });
            if (!filtered.length) {
                listEl.innerHTML = '<div class="ugap-entry-open-empty">Aucun devis ne correspond aux filtres.</div>';
                return;
            }
            listEl.innerHTML = filtered.map((entry) => {
                const savedDate = new Date(entry.savedAt || Date.now());
                const dateLabel = Number.isNaN(savedDate.getTime()) ? '-' : savedDate.toLocaleString('fr-FR');
                const count = versions.filter((v) => String(v?.name || '').trim() === String(entry.name || '').trim()).length;
                const activeClass = state.openedSavedDevisId && state.openedSavedDevisId === entry.id ? 'active' : '';
                const payload = entry.payload && typeof entry.payload === 'object' ? entry.payload : {};
                const fullName = String(entry.name || payload.devisName || 'Sans nom').trim() || 'Sans nom';
                const includedHint = payload?.devisDisplayOptions?.showIncludedLines === true
                    ? ' · lignes incluses'
                    : '';
                const quickTemplates = getQuickPrintTemplates();
                const quickBtns = quickTemplates.map((tpl) => {
                    const printLabel = escapeHtml(resolveTemplateQuickPrintLabel(tpl));
                    const title = `Imprimer avec le modèle « ${printLabel} »`;
                    return `
                    <button
                        type="button"
                        class="ugap-saved-devis-quick-print"
                        data-saved-id="${escapeHtml(entry.id)}"
                        data-template-ns="${escapeHtml(tpl.namespace)}"
                        title="${title}"
                        aria-label="${title}"
                    >${DEVIS_PRINT_ICON_SVG}<span class="ugap-saved-devis-quick-print__label">${printLabel}</span></button>
                `;
                }).join('');
                return `
                    <div class="ugap-entry-open-item ${activeClass}" data-saved-id="${escapeHtml(entry.id)}">
                        <div class="ugap-entry-open-item-main">
                            <div class="ugap-entry-open-item-name">${escapeHtml(fullName)}</div>
                            <div class="ugap-entry-open-item-meta">v${escapeHtml(String(entry.version || 1))} · ${escapeHtml(dateLabel)} · ${escapeHtml(String(count))} version(s)${includedHint}</div>
                        </div>
                        ${quickBtns ? `<div class="ugap-entry-open-item-actions">${quickBtns}</div>` : ''}
                    </div>
                `;
            }).join('');
            listEl.querySelectorAll('[data-saved-id]').forEach((node) => {
                node.addEventListener('click', (ev) => {
                    if (ev.target.closest('.ugap-saved-devis-quick-print')) return;
                    state.openedSavedDevisId = String(node.getAttribute('data-saved-id') || '').trim();
                    renderSavedDevisChoices();
                });
            });
            listEl.querySelectorAll('.ugap-saved-devis-quick-print').forEach((btn) => {
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    void quickPrintSavedDevis(
                        btn.getAttribute('data-saved-id'),
                        btn.getAttribute('data-template-ns'),
                        btn
                    );
                });
            });
        }

        function buildDefaultDevisName() {
            const modelName = String(state.selectedModel?.name || 'Nouveau devis').trim();
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = String(now.getFullYear());
            return `${modelName} ${dd}/${mm}/${yyyy}`;
        }

        function startNewDevis() {
            state.showEntryScreen = false;
            state.step = 1;
            state.selectedModel = null;
            state.selectedConfig = null;
            state.selectedOptions = new Set();
            state.fivePercentOptions = new Set();
            state.fivePercentCustomOptions = [];
            state.use5Percent = false;
            state.devisName = '';
            state.devisDisplayOptions = normalizeDevisDisplayOptions(null);
            state.openedSavedDevisId = null;
            if (window.UgapConfiguratorClientStep?.reset) {
                window.UgapConfiguratorClientStep.reset(state);
            } else {
                state.selectedClientId = null;
                state.clientInfo = null;
                state.commercialId = null;
                state.showNewClientForm = false;
                state.clientFormIsEdit = false;
            }
            render();
        }

        function backToDevisEntry() {
            state.showEntryScreen = true;
            render();
        }

        function confirmClientStep() {
            window.UgapConfiguratorClientStep?.syncFromForm?.(state);
            goToStep(2);
        }

        function onSavedDevisFilterChange() {
            const nameInput = document.getElementById('ugap-saved-devis-filter-name');
            const dateOrderInput = document.getElementById('ugap-saved-devis-filter-date-order');
            state.savedDevisFilters = {
                name: String(nameInput?.value || ''),
                dateOrder: String(dateOrderInput?.value || 'desc')
            };
            renderSavedDevisChoices();
        }

        function resetSavedDevisFilters() {
            const nameInput = document.getElementById('ugap-saved-devis-filter-name');
            const dateOrderInput = document.getElementById('ugap-saved-devis-filter-date-order');
            if (nameInput) nameInput.value = '';
            if (dateOrderInput) dateOrderInput.value = 'desc';
            state.savedDevisFilters = { name: '', dateOrder: 'desc' };
            renderSavedDevisChoices();
        }

        function resolveSavedConfig(model, configId) {
            const configs = resolveConfiguratorConfigsForModel(model);
            const wanted = String(configId || '').trim();
            if (wanted) {
                const exact = configs.find((c) => String(c?.id || '').trim() === wanted);
                if (exact) return exact;
            }
            if (wanted === 'default-config' || !configs.length) {
                return {
                    id: 'default-config',
                    name: 'Configuration par défaut',
                    description: 'Aucune configuration définie pour ce modèle.',
                    image: null,
                };
            }
            const def = configs.find((c) => c.isDefault) || configs[0];
            return def || null;
        }

        function onDevisNameInput(event) {
            state.devisName = String(event?.target?.value || '').trimStart();
        }

        async function saveCurrentDevis() {
            if (state.step !== 4 || !state.selectedModel || !state.selectedConfig) {
                alert('Sélectionnez d\'abord un modèle et une configuration.');
                return;
            }
            const finalName = String(state.devisName || '').trim() || buildDefaultDevisName();
            state.devisName = finalName;
            const versions = getSavedDevisStore().versions;
            const sameName = versions.filter((entry) => String(entry?.name || '').trim().toLowerCase() === finalName.toLowerCase());
            if (sameName.length > 0) {
                const ok = window.confirm(`Un devis nommé "${finalName}" existe déjà (${sameName.length} version(s)). Voulez-vous enregistrer une nouvelle version ?`);
                if (!ok) return;
            }
            const snapshot = buildDevisSnapshot();
            try {
                const result = await apiCall('/saved-devis', {
                    method: 'POST',
                    body: JSON.stringify({ name: finalName, payload: snapshot })
                });
                const entry = result?.data;
                if (!entry?.id) {
                    throw new Error('Réponse serveur invalide');
                }
                await loadSavedDevisFromApi();
                state.openedSavedDevisId = entry.id;
                renderSavedDevisChoices();
                const input = document.getElementById('ugap-devis-name-input');
                if (input) input.value = finalName;
                alert(`Devis "${finalName}" sauvegardé (v${entry.version || 1}).`);
            } catch (error) {
                alert('Erreur lors de la sauvegarde du devis: ' + (error.message || 'Erreur inconnue'));
            }
        }

        function setDevisOpenLoading(active) {
            const overlay = document.getElementById('ugap-devis-open-overlay');
            const btn = document.getElementById('ugap-saved-devis-open-btn');
            if (overlay) {
                overlay.classList.toggle('hidden', !active);
                overlay.setAttribute('aria-hidden', active ? 'false' : 'true');
            }
            if (btn) {
                btn.disabled = !!active;
                btn.setAttribute('aria-busy', active ? 'true' : 'false');
            }
            if (active && window.UgapEmbedLayout?.portalUgapModalToBody && overlay) {
                window.UgapEmbedLayout.portalUgapModalToBody(overlay);
            }
        }

        function yieldToPaint() {
            return new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });
        }

        async function openSavedDevis() {
            const savedId = String(state.openedSavedDevisId || '').trim();
            if (!savedId) {
                alert('Sélectionnez un devis sauvegardé.');
                return;
            }
            const store = getSavedDevisStore();
            const entry = (store.versions || []).find((item) => String(item?.id || '') === savedId);
            if (!entry || !entry.payload) {
                alert('Devis introuvable. Rechargez la page puis réessayez.');
                return;
            }
            const payload = entry.payload || {};
            const model = (state.models || []).find((m) => String(m?.id || '') === String(payload.modelId || ''));
            if (!model) {
                alert('Le modèle de ce devis sauvegardé n\'existe plus dans les données actuelles.');
                return;
            }

            setDevisOpenLoading(true);
            try {
                await yieldToPaint();
                invalidateBillableDerivationCache();
                state._categoryTableRowsCache = null;
                state._categoryTableRowsCacheKey = '';
                state.selectedModel = model;
                state.selectedConfig = resolveSavedConfig(model, payload.configId);
                state.selectedOptions = new Set(Array.isArray(payload.selectedOptions) ? payload.selectedOptions.map((v) => String(v)) : []);
                state.fivePercentOptions = new Set(Array.isArray(payload.fivePercentOptions) ? payload.fivePercentOptions.map((v) => String(v)) : []);
                state.fivePercentCustomOptions = Array.isArray(payload.fivePercentCustomOptions) ? payload.fivePercentCustomOptions : [];
                state.use5Percent = !!payload.use5Percent;
                state.devisName = String(payload.devisName || entry.name || '').trim();
                state.devisDisplayOptions = normalizeDevisDisplayOptions(payload.devisDisplayOptions);
                if (window.UgapConfiguratorClientStep?.applyPayload) {
                    window.UgapConfiguratorClientStep.applyPayload(state, payload);
                } else {
                    state.selectedClientId = payload.clientId || null;
                    state.clientInfo = payload.clientInfo || null;
                    state.commercialId = payload.commercialId || null;
                }
                state.openedSavedDevisId = entry.id;
                state.showEntryScreen = false;
                state.step = 4;
                state._openDevisPerf = true;
                render();
                state._openDevisPerf = false;
                await yieldToPaint();
            } finally {
                setDevisOpenLoading(false);
            }
        }

        // Init
        document.addEventListener('DOMContentLoaded', () => {
            const gdriDirect = window.UgapGdriHost && window.UgapGdriHost.isGdriDirectEmbed();
            if (window.UgapEmbedLayout?.installUgapModalViewportAlign) {
                window.UgapEmbedLayout.installUgapModalViewportAlign();
            }
            if (!gdriDirect && typeof applyEmbeddedLayout === 'function') {
                applyEmbeddedLayout();
            }
            ['subcategory-modal', 'five-percent-group-modal'].forEach((id) => {
                const el = document.getElementById(id);
                if (el && window.UgapEmbedLayout?.portalUgapModalToBody) {
                    window.UgapEmbedLayout.portalUgapModalToBody(el);
                }
            });
            loadData();
        });

        window.startNewDevis = startNewDevis;
        window.backToDevisEntry = backToDevisEntry;
        window.confirmClientStep = confirmClientStep;
        window.goToStep = goToStep;
        window.openSavedDevis = openSavedDevis;
        window.onSavedDevisFilterChange = onSavedDevisFilterChange;
        window.resetSavedDevisFilters = resetSavedDevisFilters;
        window.onDevisNameInput = onDevisNameInput;
        window.generateDevis = generateDevis;
        window.saveCurrentDevis = saveCurrentDevis;
