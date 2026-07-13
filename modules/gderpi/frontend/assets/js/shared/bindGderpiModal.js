/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/bindGderpiModal.js
 * RÔLE : Modale réutilisable GDERPI (formulaires, éditeur devis, aperçu HTML).
 *
 * ENTRÉES : élément DOM racine + options
 * SORTIES : API { open, close, isOpen, setTitle, root, body }
 *
 * DÉPEND DE : aucun
 * NE PAS : logique métier entités
 *
 * APPELÉ PAR : bindVueLc.js, bindDevisTab.js, bindNodesTab.js
 */
(function initGderpiBindModal(global) {
  'use strict';

  let openCount = 0;

  function lockScroll() {
    openCount += 1;
    document.body.classList.add('gderpi-modal-open');
  }

  function unlockScroll() {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.body.classList.remove('gderpi-modal-open');
  }

  function defaultTitle(root) {
    const el = root.querySelector(
      '[data-gderpi-modal-title], .gderpi-doc-editor__title, #gderpi-devis-editor-title, h4'
    );
    return el ? String(el.textContent || '').trim() : '';
  }

  function enhance(root, options) {
    if (!root) return null;
    if (root._gderpiModal) return root._gderpiModal;

    const opts = options && typeof options === 'object' ? options : {};
    root.classList.add('gderpi-modal');
    if (opts.size) root.classList.add('gderpi-modal--' + opts.size);
    if (opts.variant) root.classList.add('gderpi-modal--' + opts.variant);
    if (opts.stacked || opts.stack) {
      root.classList.add('gderpi-modal--stacked');
      if (root.parentElement !== document.body) {
        document.body.appendChild(root);
      }
    }

    let backdrop = root.querySelector('[data-gderpi-modal-backdrop]');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'gderpi-modal__backdrop';
      backdrop.setAttribute('data-gderpi-modal-backdrop', '');
      root.insertBefore(backdrop, root.firstChild);
    }

    let dialog = root.querySelector('[data-gderpi-modal-dialog]');
    let body = root.querySelector('[data-gderpi-modal-body]');

    if (!dialog) {
      dialog = document.createElement('div');
      dialog.className = 'gderpi-modal__dialog';
      dialog.setAttribute('data-gderpi-modal-dialog', '');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');

      if (!opts.hideHeader) {
        const header = document.createElement('div');
        header.className = 'gderpi-modal__header';
        const title = document.createElement('strong');
        title.className = 'gderpi-modal__title';
        title.setAttribute('data-gderpi-modal-title', '');
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn btn-outline btn-sm gderpi-modal__close';
        closeBtn.setAttribute('data-gderpi-modal-close', '');
        closeBtn.textContent = opts.closeLabel || 'Fermer';
        header.appendChild(title);
        header.appendChild(closeBtn);
        dialog.appendChild(header);
      }

      body = document.createElement('div');
      body.className = 'gderpi-modal__body';
      body.setAttribute('data-gderpi-modal-body', '');

      const nodes = [];
      Array.from(root.childNodes).forEach((node) => {
        if (node === backdrop || node === dialog) return;
        nodes.push(node);
      });
      nodes.forEach((node) => body.appendChild(node));

      dialog.appendChild(body);
      root.appendChild(dialog);
    }

    const titleEl = dialog.querySelector('[data-gderpi-modal-title]');
    const closeBtn = dialog.querySelector('[data-gderpi-modal-close]');

    const api = {
      root,
      body: body || root.querySelector('[data-gderpi-modal-body]'),
      open() {
        if (opts.stacked || opts.stack) {
          if (root.parentElement !== document.body) {
            document.body.appendChild(root);
          }
        }
        if (opts.title) api.setTitle(opts.title);
        else if (titleEl) titleEl.textContent = defaultTitle(root);
        root.removeAttribute('hidden');
        lockScroll();
        if (typeof opts.onOpen === 'function') opts.onOpen();
      },
      close() {
        if (root.hasAttribute('hidden')) return;
        root.setAttribute('hidden', '');
        unlockScroll();
        if (typeof opts.onClose === 'function') opts.onClose();
      },
      isOpen() {
        return !root.hasAttribute('hidden');
      },
      setTitle(text) {
        if (titleEl) titleEl.textContent = String(text || '').trim();
      }
    };

    if (!backdrop.dataset.gderpiModalBound) {
      backdrop.dataset.gderpiModalBound = '1';
      backdrop.addEventListener('click', () => {
        if (typeof opts.onBackdrop === 'function') {
          opts.onBackdrop();
          return;
        }
        if (opts.closeOnBackdrop === false) return;
        api.close();
      });
    }

    if (closeBtn && !closeBtn.dataset.gderpiModalBound) {
      closeBtn.dataset.gderpiModalBound = '1';
      closeBtn.addEventListener('click', () => {
        if (typeof opts.onCloseClick === 'function') opts.onCloseClick();
        else api.close();
      });
    }

    root._gderpiModal = api;
    return api;
  }

  global.GderpiModal = { enhance, lockScroll, unlockScroll };
})(window);
