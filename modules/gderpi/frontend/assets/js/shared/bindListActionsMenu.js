/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/bindListActionsMenu.js
 * RÔLE : Menu d'actions compact pour les listes GDERPI (remplace les grappes de boutons).
 *
 * ENTRÉES : items [{ value, label, tone?, attrs? }], options { label?, emptyHtml? }
 * SORTIES : HTML menu + binding click
 *
 * DÉPEND DE : GderpiEscape
 * NE PAS : logique métier des actions
 *
 * APPELÉ PAR : listes Facturation, Achats, Devis, BL, Commandes client
 */

(function initGderpiListActionsMenu(global) {
  'use strict';

  const esc = (v) => (global.GderpiEscape?.escapeHtml ? global.GderpiEscape.escapeHtml(v) : String(v ?? ''));

  let documentBound = false;

  function closeAll(except) {
    document.querySelectorAll('.gderpi-actions-menu.is-open').forEach((menu) => {
      if (except && menu === except) return;
      menu.classList.remove('is-open');
      const btn = menu.querySelector('.gderpi-actions-menu__btn');
      const panel = menu.querySelector('.gderpi-actions-menu__panel');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (panel) panel.hidden = true;
    });
  }

  function ensureDocumentClose() {
    if (documentBound) return;
    documentBound = true;
    document.addEventListener('click', (ev) => {
      if (ev.target.closest('.gderpi-actions-menu')) return;
      closeAll();
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') closeAll();
    });
    window.addEventListener('scroll', () => closeAll(), true);
    window.addEventListener('resize', () => closeAll());
  }

  function attrsToHtml(attrs) {
    if (!attrs || typeof attrs !== 'object') return '';
    return Object.keys(attrs).map((key) => {
      const val = attrs[key];
      if (val == null || val === false) return '';
      if (val === true) return ' ' + esc(key);
      return ' ' + esc(key) + '="' + esc(String(val)) + '"';
    }).join('');
  }

  /**
   * @param {Array<{value:string,label:string,tone?:string,attrs?:object,dividerBefore?:boolean}>} items
   * @param {{label?:string, emptyHtml?:string, className?:string, attrs?:object}} [options]
   */
  function render(items, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const list = Array.isArray(items) ? items.filter((it) => it && it.value) : [];
    if (!list.length) {
      return opts.emptyHtml != null ? opts.emptyHtml : '<span class="text-muted small">—</span>';
    }

    const label = opts.label || 'Actions';
    const rootAttrs = attrsToHtml(opts.attrs);
    const extraClass = opts.className ? ' ' + esc(opts.className) : '';

    const itemsHtml = list.map((it) => {
      const tone = it.tone ? ' gderpi-actions-menu__item--' + esc(it.tone) : '';
      const divider = it.dividerBefore
        ? '<div class="gderpi-actions-menu__divider" role="separator"></div>'
        : '';
      return divider +
        '<button type="button" class="gderpi-actions-menu__item' + tone + '" data-action="' +
        esc(it.value) + '"' + attrsToHtml(it.attrs) + '>' +
        esc(it.label) + '</button>';
    }).join('');

    return '<div class="gderpi-actions-menu' + extraClass + '"' + rootAttrs + '>' +
      '<button type="button" class="gderpi-actions-menu__btn" aria-haspopup="menu" aria-expanded="false">' +
      '<span class="gderpi-actions-menu__btn-label">' + esc(label) + '</span>' +
      '<span class="gderpi-actions-menu__caret" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="gderpi-actions-menu__panel" role="menu" hidden>' + itemsHtml + '</div>' +
      '</div>';
  }

  function positionPanel(menu) {
    const btn = menu.querySelector('.gderpi-actions-menu__btn');
    const panel = menu.querySelector('.gderpi-actions-menu__panel');
    if (!btn || !panel) return;
    // Position fixed pour échapper overflow des tableaux
    panel.style.position = 'fixed';
    panel.style.visibility = 'hidden';
    panel.hidden = false;
    const btnRect = btn.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    let top = btnRect.bottom + 6;
    let left = btnRect.right - panelRect.width;
    if (left < 8) left = 8;
    if (top + panelRect.height > window.innerHeight - 8) {
      top = Math.max(8, btnRect.top - panelRect.height - 6);
    }
    if (left + panelRect.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - panelRect.width - 8);
    }
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
    panel.style.right = 'auto';
    panel.style.visibility = '';
  }

  function setOpen(menu, open) {
    const btn = menu.querySelector('.gderpi-actions-menu__btn');
    const panel = menu.querySelector('.gderpi-actions-menu__panel');
    if (!btn || !panel) return;
    menu.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      positionPanel(menu);
    } else {
      panel.hidden = true;
      panel.style.visibility = '';
    }
  }

  /**
   * @param {ParentNode} root
   * @param {(action:string, itemEl:Element, menuEl:Element) => (void|Promise<void>)} onAction
   */
  function bind(root, onAction) {
    ensureDocumentClose();
    const scope = root || document;
    scope.querySelectorAll('.gderpi-actions-menu').forEach((menu) => {
      if (menu.dataset.boundActionsMenu) return;
      menu.dataset.boundActionsMenu = '1';

      const btn = menu.querySelector('.gderpi-actions-menu__btn');
      btn?.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const willOpen = !menu.classList.contains('is-open');
        closeAll(willOpen ? menu : null);
        setOpen(menu, willOpen);
      });

      menu.querySelectorAll('.gderpi-actions-menu__item').forEach((item) => {
        item.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const action = item.getAttribute('data-action') || '';
          setOpen(menu, false);
          if (!action || typeof onAction !== 'function') return;
          Promise.resolve(onAction(action, item, menu)).catch((err) => {
            global.GderpiStatus?.showStatus?.(err?.message || 'Erreur action', 'danger');
          });
        });
      });
    });
  }

  global.GderpiListActionsMenu = {
    render,
    bind,
    closeAll
  };
})(window);
