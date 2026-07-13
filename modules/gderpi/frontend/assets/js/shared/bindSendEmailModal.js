/**
 * Modale réutilisable pour confirmer un envoi d'e-mail avec message personnalisé.
 */
(function initGderpiSendEmailModal(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  let modalRoot = null;
  let modalApi = null;
  let pendingResolve = null;
  let toChipField = null;
  let ccChipField = null;

  function ensureModal() {
    if (modalRoot) return modalRoot;

    modalRoot = document.createElement('div');
    modalRoot.id = 'gderpi-send-email-modal';
    modalRoot.hidden = true;
    modalRoot.innerHTML = `
      <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
      <div class="gderpi-modal__dialog" data-gderpi-modal-dialog role="dialog" aria-modal="true">
        <div class="gderpi-modal__header">
          <strong class="gderpi-modal__title" data-gderpi-modal-title>Envoyer par e-mail</strong>
          <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close>Annuler</button>
        </div>
        <div class="gderpi-modal__body" data-gderpi-modal-body>
          <form id="gderpi-send-email-form" class="gderpi-form">
            <p class="gderpi-field-hint gderpi-send-email-desc" id="gderpi-send-email-desc"></p>
            <div class="gderpi-field" id="gderpi-send-email-recipient-block">
              <label class="gderpi-field__label">Destinataire</label>
              <div id="gderpi-send-email-to-chips"></div>
              <p class="gderpi-field-hint">Tapez pour rechercher un contact, puis sélectionnez-le dans la liste.</p>
            </div>
            <div class="gderpi-field">
              <label class="gderpi-field__label">Copie (CC) <span class="text-muted">(optionnel)</span></label>
              <div id="gderpi-send-email-cc-chips"></div>
              <p class="gderpi-field-hint">Ajoutez d'autres contacts en copie — chaque pastille peut être retirée avec la croix.</p>
            </div>
            <div class="gderpi-field">
              <label class="gderpi-field__label" for="gderpi-send-email-message">Message personnalisé <span class="text-muted">(optionnel)</span></label>
              <textarea id="gderpi-send-email-message" class="form-control" rows="4" placeholder="Ajoutez un message qui sera inséré dans l'e-mail, avant les liens de consultation."></textarea>
            </div>
            <div class="gderpi-form-actions">
              <button type="submit" class="btn btn-primary btn-sm" id="gderpi-send-email-submit" disabled>Envoyer</button>
              <button type="button" class="btn btn-outline btn-sm" id="gderpi-send-email-cancel">Annuler</button>
            </div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(modalRoot);

    if (global.GderpiModal) {
      modalApi = global.GderpiModal.enhance(modalRoot, {
        title: 'Envoyer par e-mail',
        size: 'md',
        stacked: true,
        closeLabel: 'Annuler'
      });
    }

    const bindChips = global.GderpiBindEmailContactChipField?.bindEmailContactChipField;
    if (bindChips) {
      const toRoot = document.getElementById('gderpi-send-email-to-chips');
      const ccRoot = document.getElementById('gderpi-send-email-cc-chips');
      if (toRoot) {
        toChipField = bindChips(toRoot, {
          mode: 'single',
          placeholder: 'Rechercher un destinataire…'
        });
      }
      if (ccRoot) {
        ccChipField = bindChips(ccRoot, {
          mode: 'multi',
          placeholder: 'Ajouter une copie…'
        });
      }
    }

    function updateSubmitState() {
      const submitBtn = document.getElementById('gderpi-send-email-submit');
      if (!submitBtn) return;
      submitBtn.disabled = !Boolean(toChipField?.getPrimaryEmail?.());
    }

    document.getElementById('gderpi-send-email-to-chips')?.addEventListener('gderpi-email-chips-change', updateSubmitState);

    modalRoot.querySelector('#gderpi-send-email-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const to = toChipField?.getPrimaryEmail?.() || '';
      const cc = ccChipField?.getEmailsCsv?.() || '';
      const customMessage = document.getElementById('gderpi-send-email-message')?.value?.trim() || '';
      if (!to) {
        toChipField?.focus?.();
        global.GderpiStatus?.showStatus?.('Sélectionnez un destinataire.', 'warning');
        return;
      }
      finish({ to, cc, customMessage });
    });

    modalRoot.querySelector('#gderpi-send-email-cancel')?.addEventListener('click', () => finish(null));
    modalRoot.querySelector('[data-gderpi-modal-close]')?.addEventListener('click', () => finish(null));
    modalRoot.querySelector('[data-gderpi-modal-backdrop]')?.addEventListener('click', () => finish(null));

    return modalRoot;
  }

  async function fetchRecipientFromApi(ctx) {
    const params = new URLSearchParams({
      type: String(ctx.type),
      id: String(ctx.id)
    });
    const res = await global.GderpiApi.apiCall('/mail/send-recipient?' + params.toString(), { silent: true });
    return {
      to: String(res.data?.to || '').trim(),
      label: String(res.data?.label || '').trim()
    };
  }

  async function fetchRecipientFromDocument(ctx) {
    const type = String(ctx.type || '').trim();
    const id = String(ctx.id || '').trim();
    if (!type || !id) return { to: '', label: '' };

    if (type === 'devis') {
      const res = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(id), { silent: true });
      const devis = res.data || {};
      let client = null;
      if (devis.clientId) {
        try {
          const cr = await global.GderpiApi.apiCall('/clients/' + encodeURIComponent(devis.clientId), { silent: true });
          client = cr.data || null;
        } catch (_) { /* ignore */ }
      }
      const contact = global.GderpiCommandeClientHelpers?.resolveDevisContact?.(devis, client) || {};
      return {
        to: String(contact.email || devis.contactEmail || '').trim(),
        label: String(contact.nom || devis.contactNom || '').trim()
      };
    }

    if (['commande_client', 'facture', 'avoir'].includes(type)) {
      const res = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id), { silent: true });
      const cmd = res.data || {};
      let devis = null;
      if (cmd.devisId) {
        try {
          const dr = await global.GderpiApi.apiCall('/devis/' + encodeURIComponent(cmd.devisId), { silent: true });
          devis = dr.data || null;
        } catch (_) { /* ignore */ }
      }
      let client = null;
      if (cmd.clientId) {
        try {
          const cr = await global.GderpiApi.apiCall('/clients/' + encodeURIComponent(cmd.clientId), { silent: true });
          client = cr.data || null;
        } catch (_) { /* ignore */ }
      }
      const contact = global.GderpiCommandeClientHelpers?.resolveDevisContact?.(devis || {}, client) || {};
      return {
        to: String(contact.email || '').trim(),
        label: String(contact.nom || '').trim()
      };
    }

    if (type === 'commande_fournisseur') {
      const res = await global.GderpiApi.apiCall('/commandes-fournisseur/' + encodeURIComponent(id), { silent: true });
      const cmd = res.data || {};
      if (cmd.fournisseurId) {
        try {
          const fr = await global.GderpiApi.apiCall('/fournisseurs/' + encodeURIComponent(cmd.fournisseurId), { silent: true });
          const f = fr.data || {};
          const contacts = Array.isArray(f.contacts) ? f.contacts : [];
          const principal = contacts.find((c) => c.principal) || contacts[0];
          const email = String(principal?.email || f.email || '').trim();
          return {
            to: email,
            label: String([principal?.prenom, principal?.nom].filter(Boolean).join(' ') || f.raisonSociale || f.nom || '').trim()
          };
        } catch (_) { /* ignore */ }
      }
    }

    return { to: '', label: '' };
  }

  async function resolveRecipient(opts) {
    const directTo = String(opts.to || '').trim();
    const directLabel = String(opts.toLabel || '').trim();
    const ctx = opts.recipientContext;

    if (ctx?.type && ctx?.id) {
      try {
        const fromApi = await fetchRecipientFromApi(ctx);
        if (fromApi.to) return fromApi;
      } catch (_) { /* fallback */ }
      try {
        const fromDoc = await fetchRecipientFromDocument(ctx);
        if (fromDoc.to) return fromDoc;
      } catch (_) { /* fallback */ }
    }

    if (directTo) return { to: directTo, label: directLabel };
    return { to: '', label: '' };
  }

  function finish(result) {
    if (modalApi?.close) modalApi.close();
    else if (modalRoot) modalRoot.hidden = true;
    const resolve = pendingResolve;
    pendingResolve = null;
    if (resolve) resolve(result);
  }

  function buildPayload(result) {
    if (!result) return null;
    const body = {};
    const to = String(result.to || '').trim();
    if (to) body.to = to;
    const cc = String(result.cc || '').trim();
    if (cc) body.cc = cc;
    const customMessage = String(result.customMessage || '').trim();
    if (customMessage) body.customMessage = customMessage;
    return body;
  }

  async function prompt(options) {
    const opts = options && typeof options === 'object' ? options : {};
    ensureModal();

    const title = String(opts.title || 'Envoyer par e-mail').trim();
    const desc = String(opts.description || 'Un lien de consultation et de téléchargement sera inclus dans l\'e-mail.').trim();
    const submitLabel = String(opts.submitLabel || 'Envoyer').trim();

    if (modalApi?.setTitle) modalApi.setTitle(title);
    const titleEl = modalRoot.querySelector('[data-gderpi-modal-title]');
    if (titleEl) titleEl.textContent = title;

    const descEl = document.getElementById('gderpi-send-email-desc');
    if (descEl) descEl.textContent = desc;

    ccChipField?.clearContacts?.();
    const msgInput = document.getElementById('gderpi-send-email-message');
    if (msgInput) msgInput.value = '';

    const submitBtn = document.getElementById('gderpi-send-email-submit');
    if (submitBtn) {
      submitBtn.textContent = submitLabel;
      submitBtn.disabled = true;
    }

    let resolved = { to: '', label: '' };
    try {
      resolved = await resolveRecipient(opts);
    } catch (err) {
      resolved = {
        to: String(opts.to || '').trim(),
        label: String(opts.toLabel || '').trim()
      };
      if (!resolved.to) {
        global.GderpiStatus?.showStatus?.(err.message || 'Impossible de résoudre le destinataire', 'warning');
      }
    }

    if (resolved.to) {
      toChipField?.setContacts?.([{ email: resolved.to, name: resolved.label }]);
    } else {
      toChipField?.clearContacts?.();
    }

    const submitBtnAfter = document.getElementById('gderpi-send-email-submit');
    if (submitBtnAfter) submitBtnAfter.disabled = !resolved.to;

    if (modalApi?.open) modalApi.open();
    else modalRoot.hidden = false;

    if (!resolved.to) toChipField?.focus?.();

    return new Promise((resolve) => {
      pendingResolve = resolve;
    });
  }

  global.GderpiSendEmail = {
    prompt,
    buildPayload,
    resolveRecipient
  };
})(window);
