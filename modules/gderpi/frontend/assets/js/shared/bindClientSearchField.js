/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/bindClientSearchField.js
 * RÔLE : Champ texte avec suggestions clients (nom, email, ville).
 *
 * ENTRÉES : input HTML, options { getClients, onSelect, onClear }
 * SORTIES : { destroy, setDisplayValue }
 *
 * DÉPEND DE : GderpiEscape, GderpiClientSearch
 * NE PAS : logique devis
 *
 * APPELÉ PAR : bindDevisTab.js
 */
(function initGderpiBindClientSearchField(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const search = (clients, q) => global.GderpiClientSearch.searchClientsLocal(clients, q, 10);
  const listLabel = (c) => global.GderpiClientSearch.clientSelectLabel(c);
  const fieldLabel = (c) => global.GderpiClientSearch.clientFieldLabel(c);

  function bindClientSearchField(input, options) {
    if (!input || input.dataset.gderpiClientSearchBound) return null;
    input.dataset.gderpiClientSearchBound = '1';
    input.setAttribute('autocomplete', 'off');

    const wrap = document.createElement('div');
    wrap.className = 'gderpi-client-search';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'gderpi-client-search__dropdown';
    dropdown.hidden = true;
    wrap.appendChild(dropdown);

    let activeIdx = -1;
    let visible = [];

    function getClients() {
      return typeof options.getClients === 'function' ? options.getClients() : (options.clients || []);
    }

    function hideDropdown() {
      dropdown.hidden = true;
      activeIdx = -1;
      visible = [];
    }

    function renderDropdown(items) {
      visible = items;
      if (!items.length) {
        dropdown.innerHTML = '<div class="gderpi-client-search__empty">Aucun client trouvé</div>';
        dropdown.hidden = false;
        return;
      }
      dropdown.innerHTML = items.map((c, i) => {
        const id = c.clientId || c.id;
        const type = c.type === 'particulier' ? 'Particulier' : 'Entreprise';
        const metaParts = [c.ville, c.email].filter(Boolean);
        if (c.type !== 'particulier' && Number(c.contactCount) > 0) {
          metaParts.push(c.contactCount + ' contact(s)');
        }
        const meta = metaParts.join(' · ');
        return '<button type="button" class="gderpi-client-search__item' + (i === activeIdx ? ' is-active' : '') + '" data-client-id="' + esc(id) + '" tabindex="-1">' +
          '<span class="gderpi-client-search__type">' + esc(type) + '</span>' +
          '<span class="gderpi-client-search__name">' + esc(listLabel(c)) + '</span>' +
          (meta ? '<span class="gderpi-client-search__meta">' + esc(meta) + '</span>' : '') +
          '</button>';
      }).join('');
      dropdown.hidden = false;
    }

    function selectClient(client) {
      if (!client) return;
      hideDropdown();
      input.value = fieldLabel(client);
      if (typeof options.onSelect === 'function') options.onSelect(client);
    }

    function pickById(id) {
      const c = getClients().find((x) => String(x.clientId || x.id) === String(id));
      if (c) selectClient(c);
    }

    input.addEventListener('input', () => {
      const q = input.value;
      if (!q.trim()) {
        hideDropdown();
        if (typeof options.onClear === 'function') options.onClear();
        return;
      }
      renderDropdown(search(getClients(), q));
    });

    input.addEventListener('focus', () => {
      const q = input.value.trim();
      renderDropdown(q ? search(getClients(), q) : getClients().slice(0, 8));
    });

    input.addEventListener('keydown', (ev) => {
      if (dropdown.hidden) {
        if (ev.key === 'ArrowDown' && input.value.trim()) {
          renderDropdown(search(getClients(), input.value));
          ev.preventDefault();
        }
        return;
      }
      if (ev.key === 'Escape') {
        hideDropdown();
        return;
      }
      if (ev.key === 'ArrowDown') {
        activeIdx = Math.min(activeIdx + 1, visible.length - 1);
        renderDropdown(visible);
        ev.preventDefault();
        return;
      }
      if (ev.key === 'ArrowUp') {
        activeIdx = Math.max(activeIdx - 1, 0);
        renderDropdown(visible);
        ev.preventDefault();
        return;
      }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (activeIdx >= 0 && visible[activeIdx]) {
          selectClient(visible[activeIdx]);
        } else if (visible.length === 1) {
          selectClient(visible[0]);
        } else {
          hideDropdown();
        }
      }
    });

    dropdown.addEventListener('mousedown', (ev) => {
      const btn = ev.target.closest('[data-client-id]');
      if (!btn) return;
      ev.preventDefault();
      pickById(btn.getAttribute('data-client-id'));
    });

    document.addEventListener('click', (ev) => {
      if (!wrap.contains(ev.target)) hideDropdown();
    });

    return {
      destroy() {
        hideDropdown();
        delete input.dataset.gderpiClientSearchBound;
        if (wrap.parentNode) {
          wrap.parentNode.insertBefore(input, wrap);
          wrap.remove();
        }
      },
      setDisplayValue(value) {
        input.value = value ?? '';
      }
    };
  }

  global.GderpiBindClientSearch = { bindClientSearchField };
})(window);
