/**
 * Modale — renommer une option de base (import / paramétrage).
 * ENTRÉES : open({ title, name, excelLabel, onConfirm })
 * SORTIES : Promise<string|null> (nouveau nom ou annulation)
 * DÉPEND DE : escapeHtml global optionnel
 */
(function initUgapImportBaseOptionModal(global) {
    'use strict';

    const MODAL_ID = 'ugap-import-base-option-modal';

    function esc(s) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(s);
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ensureModal() {
        let modal = document.getElementById(MODAL_ID);
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'ugap-import-bp-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="ugap-import-bp-modal__backdrop" data-bp-modal-close="1"></div>
            <div class="ugap-import-bp-modal__panel" role="dialog" aria-labelledby="ugap-import-bp-modal-title">
                <h3 id="ugap-import-bp-modal-title" class="ugap-import-bp-modal__title">Nom de l'option de base</h3>
                <p class="ugap-import-bp-modal__excel" id="ugap-import-bp-modal-excel" hidden></p>
                <label class="ugap-import-bp-modal__label" for="ugap-import-bp-modal-input">Nom affiché</label>
                <input type="text" id="ugap-import-bp-modal-input" class="ugap-import-bp-modal__input" autocomplete="off">
                <div class="ugap-import-bp-modal__actions">
                    <button type="button" class="btn btn-outline" data-bp-modal-cancel="1">Annuler</button>
                    <button type="button" class="btn btn-primary" data-bp-modal-ok="1">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * @param {{ title?: string, name?: string, excelLabel?: string }} opts
     * @returns {Promise<string|null>}
     */
    function open(opts = {}) {
        const modal = ensureModal();
        const titleEl = modal.querySelector('#ugap-import-bp-modal-title');
        const excelEl = modal.querySelector('#ugap-import-bp-modal-excel');
        const input = modal.querySelector('#ugap-import-bp-modal-input');
        const title = String(opts.title || 'Nom de l\'option de base').trim();
        const excelLabel = String(opts.excelLabel || '').trim();
        const initial = String(opts.name || '').trim();

        if (titleEl) titleEl.textContent = title;
        if (excelEl) {
            if (excelLabel) {
                excelEl.hidden = false;
                excelEl.innerHTML = `<strong>Libellé Excel :</strong> ${esc(excelLabel)}`;
            } else {
                excelEl.hidden = true;
                excelEl.textContent = '';
            }
        }
        if (input) {
            input.value = initial;
        }

        modal.hidden = false;
        document.body.classList.add('ugap-import-bp-modal-open');

        return new Promise((resolve) => {
            let done = false;
            const finish = (val) => {
                if (done) return;
                done = true;
                modal.hidden = true;
                document.body.classList.remove('ugap-import-bp-modal-open');
                document.removeEventListener('keydown', onKey);
                resolve(val);
            };

            const onKey = (e) => {
                if (e.key === 'Escape') finish(null);
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = String(input?.value || '').trim();
                    finish(v || 'de base');
                }
            };

            const onOk = () => {
                const v = String(input?.value || '').trim();
                finish(v || 'de base');
            };

            const onCancel = () => finish(null);

            modal.querySelector('[data-bp-modal-ok]')?.addEventListener('click', onOk, { once: true });
            modal.querySelector('[data-bp-modal-cancel]')?.addEventListener('click', onCancel, { once: true });
            modal.querySelector('[data-bp-modal-close]')?.addEventListener('click', onCancel, { once: true });
            document.addEventListener('keydown', onKey);

            requestAnimationFrame(() => {
                input?.focus();
                input?.select();
            });
        });
    }

    global.UgapImportBaseOptionModal = { open };
})(window);
