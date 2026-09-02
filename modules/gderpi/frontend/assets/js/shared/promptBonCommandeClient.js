/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/promptBonCommandeClient.js
 * RÔLE : Demande le n° de bon de commande client, ou une absence déclarée.
 *
 * ENTRÉES : valeur actuelle ou document { referenceClient, documentClient, sansBonCommandeClient }
 * SORTIES : Promise<{ referenceClient, sansBonCommandeClient }|null>
 *
 * DÉPEND DE : GderpiModal
 * NE PAS : persistance API (sauf ensureOnCommande)
 *
 * APPELÉ PAR : bindDevisTab, bindCommandeClientEditor, bindCommandesClientTab, bindFacturationModal
 */
(function initGderpiPromptBonCommandeClient(global) {
  'use strict';

  const MESSAGE = 'S\'il a un n° de commande, il doit figurer sur la facture. S\'il n\'en a pas, déclarez-le clairement.';
  let activeCancel = null;

  function resolveBonCommandeClient(...sources) {
    for (const src of sources) {
      if (src == null) continue;
      if (typeof src === 'string' || typeof src === 'number') {
        const value = String(src).trim();
        if (value) return value;
        continue;
      }
      if (typeof src === 'object') {
        const value = String(src.referenceClient || src.documentClient || src.refClient || '').trim();
        if (value) return value;
      }
    }
    return '';
  }

  function isSansBonCommandeClient(...sources) {
    if (resolveBonCommandeClient(...sources)) return false;
    for (const src of sources) {
      if (src && typeof src === 'object' && src.sansBonCommandeClient === true) return true;
    }
    return false;
  }

  function resultFromSources(...sources) {
    const referenceClient = resolveBonCommandeClient(...sources);
    if (referenceClient) return { referenceClient, sansBonCommandeClient: false };
    if (isSansBonCommandeClient(...sources)) return { referenceClient: '', sansBonCommandeClient: true };
    return null;
  }

  function ensureModal() {
    let root = document.getElementById('gderpi-prompt-bon-commande');
    if (root && root._gderpiModal) return root._gderpiModal;

    if (!root) {
      root = document.createElement('div');
      root.id = 'gderpi-prompt-bon-commande';
      root.className = 'gderpi-modal gderpi-modal--sm gderpi-modal--stacked';
      root.hidden = true;
      root.innerHTML =
        '<div class="gderpi-prompt-field">' +
          '<p>' + MESSAGE + '</p>' +
          '<label class="gderpi-devis-meta-fields__label" for="gderpi-prompt-bon-commande-input">N° de bon de commande client</label>' +
          '<input id="gderpi-prompt-bon-commande-input" class="form-control" type="text" maxlength="120" placeholder="Ex. BC-2026-0042" autocomplete="off">' +
          '<p class="gderpi-prompt-error" id="gderpi-prompt-bon-commande-error" hidden>Saisissez un n°, ou indiquez que le client n\'en a pas.</p>' +
          '<div class="gderpi-prompt-actions">' +
            '<button type="button" class="btn btn-outline" data-gderpi-prompt-cancel>Annuler</button>' +
            '<button type="button" class="btn btn-outline" data-gderpi-prompt-none>Pas de n° de commande</button>' +
            '<button type="button" class="btn btn-primary" data-gderpi-prompt-ok>Valider</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(root);
    }

    return global.GderpiModal.enhance(root, {
      stacked: true,
      size: 'sm',
      closeOnBackdrop: false,
      title: 'N° de commande client',
      onCloseClick() {
        if (typeof activeCancel === 'function') activeCancel();
      }
    });
  }

  function promptBonCommandeClient(currentValue) {
    const existing = resultFromSources(currentValue);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve) => {
      const modal = ensureModal();
      const input = document.getElementById('gderpi-prompt-bon-commande-input');
      const error = document.getElementById('gderpi-prompt-bon-commande-error');
      const okBtn = modal.root.querySelector('[data-gderpi-prompt-ok]');
      const noneBtn = modal.root.querySelector('[data-gderpi-prompt-none]');
      const cancelBtn = modal.root.querySelector('[data-gderpi-prompt-cancel]');
      let settled = false;

      function finish(value) {
        if (settled) return;
        settled = true;
        activeCancel = null;
        modal.root.removeEventListener('keydown', onKey);
        okBtn?.removeEventListener('click', onOk);
        noneBtn?.removeEventListener('click', onNone);
        cancelBtn?.removeEventListener('click', onCancel);
        modal.close();
        resolve(value);
      }

      function onOk() {
        const value = String(input?.value || '').trim();
        if (!value) {
          if (error) error.hidden = false;
          input?.focus();
          return;
        }
        finish({ referenceClient: value, sansBonCommandeClient: false });
      }

      function onNone() {
        if (!confirm('Confirmer que ce client n\'a pas de n° de commande ?\n\nRien ne sera imprimé sur la facture à ce titre.')) {
          return;
        }
        finish({ referenceClient: '', sansBonCommandeClient: true });
      }

      function onCancel() {
        finish(null);
      }

      function onKey(ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          onOk();
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          onCancel();
        }
      }

      if (input) input.value = '';
      if (error) error.hidden = true;
      activeCancel = onCancel;
      okBtn?.addEventListener('click', onOk);
      noneBtn?.addEventListener('click', onNone);
      cancelBtn?.addEventListener('click', onCancel);
      modal.root.addEventListener('keydown', onKey);
      modal.open();
      setTimeout(() => input?.focus(), 30);
    });
  }

  async function ensureBonCommandeClient(...sources) {
    const existing = resultFromSources(...sources);
    if (existing) return existing;
    return promptBonCommandeClient('');
  }

  const LOCKED_STATUTS = { facturee: 1, facturee_partiellement: 1, annulee: 1 };

  async function ensureOnCommande(cmd) {
    const existing = resultFromSources(cmd);
    if (existing) return { ...cmd, ...existing };
    const statut = String(cmd?.statut || '');
    if (LOCKED_STATUTS[statut]) {
      global.GderpiStatus?.showStatus?.(
        'N° de bon de commande client manquant, et une facture est déjà émise. Corrigez par un avoir / une facture rectificative.',
        'warning'
      );
      return null;
    }
    const result = await promptBonCommandeClient('');
    if (!result) return null;
    const id = cmd?.commandeClientId || cmd?.id;
    const next = {
      ...cmd,
      referenceClient: result.referenceClient,
      sansBonCommandeClient: result.sansBonCommandeClient === true
    };
    if (!id) return next;
    const res = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify({
        referenceClient: result.referenceClient,
        sansBonCommandeClient: result.sansBonCommandeClient === true
      })
    });
    return res.data || next;
  }

  global.GderpiBonCommandeClient = {
    resolve: resolveBonCommandeClient,
    isSans: isSansBonCommandeClient,
    prompt: promptBonCommandeClient,
    ensure: ensureBonCommandeClient,
    ensureOnCommande,
    MESSAGE
  };
})(window);
