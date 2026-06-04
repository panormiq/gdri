/**
 * FICHIER : modules/ugap/frontend/parametrage/assets/js/catalogue/catalogue-option-create-modal.js
 * RÔLE : Modal — créer une option de base rattachée à l’objet catalogue sélectionné.
 *
 * ENTRÉES : objet catalogue, catégories import, modèles (State)
 * SORTIES : createBaseCatalogOption → POST /options + rechargement index
 *
 * DÉPEND DE : catalogue-lc-state.js, ugap-catalogue-types.js
 * NE PAS : heuristique de liaison
 *
 * APPELÉ PAR : catalogue-tab.js
 */
(function initUgapCatalogueOptionCreateModal(global) {
    'use strict';

    const MODAL_ID = 'ugap-catalogue-option-create-modal';
    const State = () => global.UgapCatalogueLcState;
    const Types = () => global.UgapCatalogueTypes;

    function esc(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function parseMoneyInput(raw) {
        const n = Number(String(raw ?? '').replace(',', '.').trim());
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    let activeContext = null;

    function ensureModal() {
        let modal = global.document.getElementById(MODAL_ID);
        if (modal) return modal;

        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="${MODAL_ID}" class="ugap-catalogue-link-modal" hidden role="dialog" aria-modal="true"
                aria-labelledby="ugap-catalogue-option-create-title">
                <div class="ugap-catalogue-link-modal__backdrop" data-catalogue-create-close></div>
                <div class="ugap-catalogue-link-modal__panel card ugap-catalogue-create-panel">
                    <header class="ugap-catalogue-link-modal__head">
                        <h3 id="ugap-catalogue-option-create-title">Créer une option</h3>
                        <button type="button" class="btn btn-outline btn-sm" data-catalogue-create-close aria-label="Fermer">×</button>
                    </header>
                    <p class="ugap-catalogue-link-modal__hint" id="ugap-catalogue-option-create-hint"></p>
                    <form class="ugap-catalogue-create-form" id="ugap-catalogue-option-create-form">
                        <label class="ugap-catalogue-modal__field">
                            <span>Libellé <span class="ugap-catalogue-muted">*</span></span>
                            <input type="text" id="ugap-catalogue-create-name" autocomplete="off" required>
                        </label>
                        <label class="ugap-catalogue-modal__field">
                            <span>Détails</span>
                            <textarea id="ugap-catalogue-create-details" rows="2" placeholder="Complément / libellé Excel"></textarea>
                        </label>
                        <label class="ugap-catalogue-modal__field">
                            <span>Réf. UGAP</span>
                            <input type="text" id="ugap-catalogue-create-ref" autocomplete="off">
                        </label>
                        <label class="ugap-catalogue-modal__field">
                            <span>Catégorie import <span class="ugap-catalogue-muted">*</span></span>
                            <select id="ugap-catalogue-create-category" required></select>
                        </label>
                        <div class="ugap-catalogue-modal__field">
                            <div class="ugap-catalogue-create-models__head">
                                <span>Modèles utilisables <span class="ugap-catalogue-muted">*</span></span>
                                <div class="ugap-catalogue-create-models__actions">
                                    <button type="button" class="btn btn-outline" id="ugap-catalogue-create-models-all">Tout cocher</button>
                                    <button type="button" class="btn btn-outline" id="ugap-catalogue-create-models-none">Tout décocher</button>
                                </div>
                            </div>
                            <div class="ugap-catalogue-create-models-grid-wrap">
                                <div id="ugap-catalogue-create-models-list" class="ugap-catalogue-create-models-grid"></div>
                            </div>
                        </div>
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
                            <input type="checkbox" id="ugap-catalogue-create-per-poste-price">
                            <span>Prix différent selon le poste</span>
                        </label>
                        <div id="ugap-catalogue-create-price-single-wrap">
                            <label class="ugap-catalogue-modal__field">
                                <span>Prix inclus (€)</span>
                                <input type="number" id="ugap-catalogue-create-price" step="0.01" min="0" value="0">
                            </label>
                        </div>
                        <div id="ugap-catalogue-create-price-per-poste-wrap" hidden>
                            <p class="ugap-catalogue-muted" style="margin:0 0 8px;font-size:12px;">Prix inclus pour chaque modèle coché :</p>
                            <div id="ugap-catalogue-create-price-per-poste-list"></div>
                        </div>
                        <p class="ugap-catalogue-muted" style="margin:0;font-size:12px;">
                            Tag par défaut : <strong>Option de base</strong> — option rattachée à cet objet catalogue.
                        </p>
                    </form>
                    <footer class="ugap-catalogue-link-modal__foot">
                        <button type="button" class="btn btn-outline" data-catalogue-create-close>Annuler</button>
                        <button type="button" class="btn btn-primary" id="ugap-catalogue-create-submit">Créer l’option</button>
                    </footer>
                </div>
            </div>`;
        modal = wrap.firstElementChild;
        global.document.body.appendChild(modal);

        modal.querySelectorAll('[data-catalogue-create-close]').forEach((el) => {
            el.addEventListener('click', close);
        });
        global.document.getElementById('ugap-catalogue-create-submit')?.addEventListener('click', () => {
            void submit();
        });
        global.document.getElementById('ugap-catalogue-option-create-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            void submit();
        });
        global.document.getElementById('ugap-catalogue-create-models-all')?.addEventListener('click', () => {
            setAllModelsChecked(true);
        });
        global.document.getElementById('ugap-catalogue-create-models-none')?.addEventListener('click', () => {
            setAllModelsChecked(false);
        });
        global.document.getElementById('ugap-catalogue-create-per-poste-price')?.addEventListener('change', () => {
            syncPerPostePriceRows();
        });
        global.document.getElementById('ugap-catalogue-create-price')?.addEventListener('input', () => {
            if (!global.document.getElementById('ugap-catalogue-create-per-poste-price')?.checked) return;
            syncPerPostePriceRows();
        });
        global.document.getElementById('ugap-catalogue-create-models-list')?.addEventListener('change', (ev) => {
            if (!ev.target.matches('[data-catalogue-create-model-id]')) return;
            syncPerPostePriceRows();
        });

        return modal;
    }

    function close() {
        const modal = global.document.getElementById(MODAL_ID);
        if (modal) modal.hidden = true;
        activeContext = null;
    }

    function sortedModels() {
        const st = State();
        return (st?.getCatalogModels?.() || []).slice().sort(
            st?.compareCatalogModelsByPoste || (() => 0)
        );
    }

    function formatModelLabel(model) {
        const st = State();
        return st?.formatCatalogModelLabel
            ? st.formatCatalogModelLabel(model)
            : String(model?.name || model?.id || '—');
    }

    function formatPosteBadge(model) {
        const pn = model?.posteNumber;
        if (pn != null && pn !== '' && Number.isFinite(Number(pn))) return `P${pn}`;
        return 'P?';
    }

    function formatMoneyTooltip(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        try {
            return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
        } catch (_) {
            return `${n} €`;
        }
    }

    function buildModelTooltipHtml(model) {
        const m = model && typeof model === 'object' ? model : {};
        const name = String(m?.name || m?.label || '').trim() || '—';
        const motor = String(m?.motorizationBase || m?.motorization || '').trim();
        const delivery = String(m?.defaultDeliveryMode || '').trim();
        const basePrice = formatMoneyTooltip(m?.basePrice ?? m?.priceClient);
        const lines = [
            `<strong>${esc(name)}</strong>`,
            `Prix de base : ${esc(basePrice)}`,
        ];
        if (motor) lines.push(`Motorisation : ${esc(motor)}`);
        if (delivery) lines.push(`Livraison : ${esc(delivery)}`);
        const id = String(m?.id || '').trim();
        if (id) lines.push(`<span class="ugap-catalogue-create-model-tooltip__id">${esc(id)}</span>`);
        return lines.join('<br>');
    }

    function renderModelsList(preCheckedAll = true) {
        const list = global.document.getElementById('ugap-catalogue-create-models-list');
        if (!list) return;
        const models = sortedModels();
        if (!models.length) {
            list.innerHTML = '<p class="ugap-catalogue-muted" style="margin:8px;">Aucun modèle (poste) dans le catalogue.</p>';
            return;
        }
        list.className = 'ugap-catalogue-create-models-grid';
        list.innerHTML = models.map((m) => {
            const mid = String(m?.id || '').trim();
            if (!mid) return '';
            const checked = preCheckedAll ? 'checked' : '';
            const poste = formatPosteBadge(m);
            const tip = buildModelTooltipHtml(m);
            const nameShort = String(m?.name || m?.label || '').trim();
            const aria = nameShort ? `${poste} — ${nameShort}` : poste;
            return `
                <label class="ugap-catalogue-create-model-chip" title="${esc(aria)}">
                    <input type="checkbox" data-catalogue-create-model-id="${esc(mid)}" ${checked}>
                    <span class="ugap-catalogue-create-model-chip__poste" tabindex="0" aria-label="${esc(aria)}">
                        ${esc(poste)}
                        <span class="ugap-catalogue-create-model-tooltip" role="tooltip">${tip}</span>
                    </span>
                </label>`;
        }).join('');
        syncPerPostePriceRows();
    }

    function setAllModelsChecked(checked) {
        const list = global.document.getElementById('ugap-catalogue-create-models-list');
        if (!list) return;
        list.querySelectorAll('[data-catalogue-create-model-id]').forEach((el) => {
            el.checked = !!checked;
        });
        syncPerPostePriceRows();
    }

    function getCheckedModelIds() {
        const list = global.document.getElementById('ugap-catalogue-create-models-list');
        if (!list) return [];
        return Array.from(list.querySelectorAll('[data-catalogue-create-model-id]:checked'))
            .map((el) => String(el.getAttribute('data-catalogue-create-model-id') || '').trim())
            .filter(Boolean);
    }

    function syncPerPostePriceRows() {
        const perPoste = global.document.getElementById('ugap-catalogue-create-per-poste-price');
        const wrap = global.document.getElementById('ugap-catalogue-create-price-per-poste-wrap');
        const singleWrap = global.document.getElementById('ugap-catalogue-create-price-single-wrap');
        const list = global.document.getElementById('ugap-catalogue-create-price-per-poste-list');
        const enabled = !!perPoste?.checked;
        if (singleWrap) singleWrap.hidden = enabled;
        if (wrap) wrap.hidden = !enabled;
        if (!enabled || !list) return;

        const defaultPrice = parseMoneyInput(global.document.getElementById('ugap-catalogue-create-price')?.value);
        const checkedIds = new Set(getCheckedModelIds());
        const models = sortedModels().filter((m) => checkedIds.has(String(m?.id || '').trim()));

        list.innerHTML = models.map((m) => {
            const mid = String(m?.id || '').trim();
            const existing = list.querySelector(`[data-catalogue-create-price-model-id="${mid}"]`);
            const prev = existing ? parseMoneyInput(existing.value) : defaultPrice;
            return `
                <div class="ugap-model-base-create-price-row">
                    <span class="ugap-model-base-create-price-row__label">${esc(formatModelLabel(m))}</span>
                    <input type="number" step="0.01" min="0" value="${esc(String(prev))}"
                        data-catalogue-create-price-model-id="${esc(mid)}"
                        style="width:120px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;">
                    <span style="font-size:12px;color:#64748b;">€</span>
                </div>`;
        }).join('');
    }

    function collectPricingPayload() {
        const compatibleModels = getCheckedModelIds();
        if (!compatibleModels.length) {
            throw new Error('Sélectionnez au moins un modèle (poste) utilisable pour cette option.');
        }
        const perPoste = !!global.document.getElementById('ugap-catalogue-create-per-poste-price')?.checked;
        const pricesByModelId = {};
        if (perPoste) {
            compatibleModels.forEach((mid) => {
                const input = global.document.querySelector(
                    `[data-catalogue-create-price-model-id="${CSS.escape(mid)}"]`
                );
                pricesByModelId[mid] = parseMoneyInput(input?.value);
            });
        } else {
            const single = parseMoneyInput(global.document.getElementById('ugap-catalogue-create-price')?.value);
            compatibleModels.forEach((mid) => {
                pricesByModelId[mid] = single;
            });
        }
        const distinct = [...new Set(Object.values(pricesByModelId).map((v) => Number(v.toFixed(2))))];
        const pricingMode = perPoste && distinct.length > 1 ? 'per_model' : 'fixed';
        const baseIncludedPrice = distinct.length === 1 ? distinct[0] : (pricesByModelId[compatibleModels[0]] ?? 0);
        return {
            compatibleModels,
            pricingMode,
            pricesByModelId,
            price: baseIncludedPrice,
        };
    }

    function fillCategorySelect(preferredCategoryId) {
        const sel = global.document.getElementById('ugap-catalogue-create-category');
        if (!sel) return;
        const cats = State()?.getImportCategories?.() || [];
        if (!cats.length) {
            sel.innerHTML = '<option value="" disabled>Aucune catégorie import</option>';
            sel.disabled = true;
            return;
        }
        sel.disabled = false;
        const pref = String(preferredCategoryId || '').trim();
        sel.innerHTML = cats.map((c) => {
            const selected = pref && c.id === pref ? ' selected' : '';
            return `<option value="${esc(c.id)}"${selected}>${esc(c.name || c.id)}</option>`;
        }).join('');
        if (pref && cats.some((c) => c.id === pref)) sel.value = pref;
    }

    function guessImportCategoryId(catalogObject) {
        const catalog = State()?.getCatalog?.() || { nodes: [] };
        const nodes = Array.isArray(catalog.nodes) ? catalog.nodes : [];
        const nid = String(catalogObject?.id || '').trim();
        const importCats = State()?.getImportCategories?.() || [];
        if (!nid || !importCats.length) return importCats[0]?.id || '';

        const labels = [];
        const node = nodes.find((n) => String(n.id) === nid);
        if (node?.label) labels.push(String(node.label).trim());
        const Core = global.UgapCatalogueNodesCore;
        if (Core?.nodeBreadcrumb) {
            String(Core.nodeBreadcrumb(nodes, nid)).split('›').forEach((p) => labels.push(p.trim()));
        }
        for (const raw of labels) {
            const part = String(raw || '').trim().toLowerCase();
            if (!part) continue;
            const hit = importCats.find((c) => String(c.name || '').trim().toLowerCase() === part);
            if (hit) return hit.id;
        }
        return importCats[0]?.id || '';
    }

    async function submit() {
        const ctx = activeContext;
        if (!ctx?.catalogObject?.id) return;

        const name = String(global.document.getElementById('ugap-catalogue-create-name')?.value || '').trim();
        const categoryId = String(global.document.getElementById('ugap-catalogue-create-category')?.value || '').trim();
        if (!name) {
            global.showAlert?.('Libellé requis.', 'warning');
            return;
        }
        if (!categoryId) {
            global.showAlert?.('Choisissez une catégorie import.', 'warning');
            return;
        }

        let pricing;
        try {
            pricing = collectPricingPayload();
        } catch (err) {
            global.showAlert?.(err?.message || String(err), 'warning');
            return;
        }

        const btn = global.document.getElementById('ugap-catalogue-create-submit');
        if (btn) btn.disabled = true;
        try {
            await State().createBaseCatalogOption({
                categoryId,
                name,
                details: global.document.getElementById('ugap-catalogue-create-details')?.value,
                refUgap: global.document.getElementById('ugap-catalogue-create-ref')?.value,
                price: pricing.price,
                pricingMode: pricing.pricingMode,
                pricesByModelId: pricing.pricesByModelId,
                compatibleModels: pricing.compatibleModels,
                catalogObjectId: ctx.catalogObject.id,
            });
            global.showAlert?.(`Option « ${name} » créée et liée à l’objet.`, 'success');
            if (typeof ctx.onCreated === 'function') await ctx.onCreated();
            close();
        } catch (err) {
            global.showAlert?.(err?.message || String(err), 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    /**
     * @param {{ catalogObject: object, onCreated?: function }} context
     */
    function open(context) {
        const catalogObject = context?.catalogObject;
        if (!catalogObject?.id) {
            global.showAlert?.('Sélectionnez un objet catalogue.', 'warning');
            return;
        }
        const cats = State()?.getImportCategories?.() || [];
        if (!cats.length) {
            global.showAlert?.('Aucune catégorie import — importez d’abord le catalogue Excel.', 'warning');
            return;
        }
        const models = State()?.getCatalogModels?.() || [];
        if (!models.length) {
            global.showAlert?.('Aucun modèle (poste) — configurez d’abord les modèles UGAP.', 'warning');
            return;
        }

        activeContext = context;
        const modal = ensureModal();
        const title = global.document.getElementById('ugap-catalogue-option-create-title');
        const hint = global.document.getElementById('ugap-catalogue-option-create-hint');
        if (title) {
            title.textContent = `Créer une option — ${catalogObject.label || catalogObject.id}`;
        }
        if (hint) {
            const tagLabel = Types()?.DEFAULT_TAG_REGISTRY?.find(
                (t) => t.id === (Types()?.BASE_OPTION_TAG_ID || 'option_de_base')
            )?.label || 'Option de base';
            hint.textContent = `L’option sera liée à « ${catalogObject.label || catalogObject.id} » avec le tag « ${tagLabel} ». Cochez les postes concernés.`;
        }

        global.document.getElementById('ugap-catalogue-create-name').value = '';
        global.document.getElementById('ugap-catalogue-create-details').value = '';
        global.document.getElementById('ugap-catalogue-create-ref').value = '';
        global.document.getElementById('ugap-catalogue-create-price').value = '0';
        const perPosteCb = global.document.getElementById('ugap-catalogue-create-per-poste-price');
        if (perPosteCb) perPosteCb.checked = false;

        fillCategorySelect(guessImportCategoryId(catalogObject));
        renderModelsList(true);
        syncPerPostePriceRows();

        modal.hidden = false;
        global.document.getElementById('ugap-catalogue-create-name')?.focus();
    }

    global.UgapCatalogueCreateOptionModal = { open, close };
})(window);
