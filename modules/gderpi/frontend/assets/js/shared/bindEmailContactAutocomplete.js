/**
 * Autocomplétion contacts e-mail (clients, fournisseurs, boutiques).
 */
(function initGderpiBindEmailContactAutocomplete(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const KIND_LABELS = {
    client: 'Client',
    fournisseur: 'Fournisseur',
    boutique: 'Boutique'
  };

  function debounce(fn, ms) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  async function fetchContacts(query) {
    const q = String(query || '').trim();
    if (!q) return [];
    const res = await global.GderpiApi.apiCall(
      '/mail/contacts?q=' + encodeURIComponent(q) + '&limit=12',
      { silent: true }
    );
    return Array.isArray(res.data) ? res.data : [];
  }

  function splitEmailTokens(value) {
    return String(value || '').split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  }

  function currentToken(value) {
    const parts = splitEmailTokens(value);
    return parts.length ? parts[parts.length - 1] : String(value || '').trim();
  }

  function replaceCurrentToken(input, email) {
    const raw = String(input.value || '');
    const idx = Math.max(raw.lastIndexOf(','), raw.lastIndexOf(';'));
    if (idx >= 0) {
      input.value = raw.slice(0, idx + 1) + ' ' + email;
      return;
    }
    input.value = email;
  }

  function appendEmailToken(input, email) {
    const parts = splitEmailTokens(input.value);
    const lower = String(email || '').trim().toLowerCase();
    if (!lower) return;
    if (!parts.some((p) => p.toLowerCase() === lower)) parts.push(email);
    input.value = parts.join(', ');
  }

  function bindEmailContactAutocomplete(input, options) {
    if (!input || input.dataset.gderpiEmailContactBound) return null;
    input.dataset.gderpiEmailContactBound = '1';
    input.setAttribute('autocomplete', 'off');

    const opts = options && typeof options === 'object' ? options : {};
    const mode = opts.mode === 'append' ? 'append' : 'replace';

    const wrap = document.createElement('div');
    wrap.className = 'gderpi-client-search gderpi-email-contact-search';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'gderpi-client-search__dropdown';
    dropdown.hidden = true;
    wrap.appendChild(dropdown);

    let activeIdx = -1;
    let visible = [];
    let requestId = 0;

    function hideDropdown() {
      dropdown.hidden = true;
      activeIdx = -1;
      visible = [];
    }

    function renderDropdown(items) {
      visible = items;
      if (!items.length) {
        dropdown.innerHTML = '<div class="gderpi-client-search__empty">Aucun contact trouvé</div>';
        dropdown.hidden = false;
        return;
      }
      dropdown.innerHTML = items.map((item, i) => {
        const kind = KIND_LABELS[item.kind] || item.kind || '';
        const meta = [item.org, item.email].filter(Boolean).join(' · ');
        return '<button type="button" class="gderpi-client-search__item' + (i === activeIdx ? ' is-active' : '') + '" data-email="' + esc(item.email) + '" tabindex="-1">' +
          '<span class="gderpi-client-search__type">' + esc(kind) + '</span>' +
          '<span class="gderpi-client-search__name">' + esc(item.name || item.email) + '</span>' +
          (meta ? '<span class="gderpi-client-search__meta">' + esc(meta) + '</span>' : '') +
          '</button>';
      }).join('');
      dropdown.hidden = false;
    }

    function selectContact(item) {
      if (!item?.email) return;
      hideDropdown();
      if (mode === 'append') appendEmailToken(input, item.email);
      else replaceCurrentToken(input, item.email);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const runSearch = debounce(async () => {
      const token = currentToken(input.value);
      if (!token || token.length < 2) {
        hideDropdown();
        return;
      }
      const reqId = ++requestId;
      try {
        const items = await fetchContacts(token);
        if (reqId !== requestId) return;
        renderDropdown(items);
      } catch (_) {
        if (reqId !== requestId) return;
        hideDropdown();
      }
    }, 220);

    input.addEventListener('input', () => runSearch());

    input.addEventListener('focus', () => {
      const token = currentToken(input.value);
      if (token.length >= 2) runSearch();
    });

    input.addEventListener('keydown', (ev) => {
      if (dropdown.hidden) return;
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
      if (ev.key === 'Enter' && visible.length) {
        ev.preventDefault();
        const pick = activeIdx >= 0 ? visible[activeIdx] : visible[0];
        if (pick) selectContact(pick);
      }
    });

    dropdown.addEventListener('mousedown', (ev) => {
      const btn = ev.target.closest('[data-email]');
      if (!btn) return;
      ev.preventDefault();
      const email = btn.getAttribute('data-email');
      const item = visible.find((x) => x.email === email) || { email };
      selectContact(item);
    });

    document.addEventListener('click', (ev) => {
      if (!wrap.contains(ev.target)) hideDropdown();
    });

    return {
      destroy() {
        hideDropdown();
        delete input.dataset.gderpiEmailContactBound;
        if (wrap.parentNode) {
          wrap.parentNode.insertBefore(input, wrap);
          wrap.remove();
        }
      }
    };
  }

  global.GderpiBindEmailContactAutocomplete = { bindEmailContactAutocomplete };
})(window);
