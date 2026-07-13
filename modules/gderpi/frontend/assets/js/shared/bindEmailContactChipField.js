/**
 * Champ contacts e-mail avec pastilles (chips) + autocomplétion.
 * mode: 'single' (destinataire) | 'multi' (CC)
 */
(function initGderpiBindEmailContactChipField(global) {
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

  function normalizeContact(raw) {
    const email = String(raw?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return null;
    return {
      email,
      name: String(raw?.name || '').trim(),
      org: String(raw?.org || '').trim(),
      kind: String(raw?.kind || '').trim()
    };
  }

  function chipLabel(contact) {
    return contact.name || contact.email;
  }

  function bindEmailContactChipField(root, options) {
    if (!root || root.dataset.gderpiEmailChipBound) return null;
    root.dataset.gderpiEmailChipBound = '1';

    const opts = options && typeof options === 'object' ? options : {};
    const mode = opts.mode === 'multi' ? 'multi' : 'single';
    const placeholder = opts.placeholder || 'Tapez un nom ou un e-mail…';

    root.classList.add('gderpi-email-chip-field');
    root.dataset.mode = mode;
    root.innerHTML =
      '<div class="gderpi-email-chip-field__chips" data-chip-list></div>' +
      '<input type="text" class="gderpi-email-chip-field__input form-control" autocomplete="off" placeholder="' + esc(placeholder) + '">' +
      '<div class="gderpi-client-search__dropdown gderpi-email-chip-field__dropdown" hidden></div>';

    const chipsEl = root.querySelector('[data-chip-list]');
    const input = root.querySelector('.gderpi-email-chip-field__input');
    const dropdown = root.querySelector('.gderpi-email-chip-field__dropdown');

    let contacts = [];
    let activeIdx = -1;
    let visible = [];
    let requestId = 0;

    function hideDropdown() {
      dropdown.hidden = true;
      activeIdx = -1;
      visible = [];
    }

    function renderChips() {
      chipsEl.innerHTML = contacts.map((c) => {
        const sub = c.name && c.email !== c.name ? '<span class="gderpi-email-chip__email">' + esc(c.email) + '</span>' : '';
        return '<span class="gderpi-email-chip" data-email="' + esc(c.email) + '">' +
          '<span class="gderpi-email-chip__label">' + esc(chipLabel(c)) + '</span>' +
          sub +
          '<button type="button" class="gderpi-email-chip__remove" aria-label="Retirer" data-remove-email="' + esc(c.email) + '">×</button>' +
          '</span>';
      }).join('');
      root.classList.toggle('gderpi-email-chip-field--has-chip', contacts.length > 0);
      if (mode === 'single' && contacts.length >= 1) {
        input.placeholder = 'Remplacer le destinataire…';
      }
    }

    function emitChange() {
      root.dispatchEvent(new CustomEvent('gderpi-email-chips-change', { bubbles: true }));
    }

    function addContact(raw, { replace = false } = {}) {
      const contact = normalizeContact(raw);
      if (!contact) return false;
      if (mode === 'single') {
        contacts = [contact];
      } else if (!contacts.some((c) => c.email === contact.email)) {
        contacts.push(contact);
      }
      input.value = '';
      hideDropdown();
      renderChips();
      emitChange();
      return true;
    }

    function removeContact(email) {
      const key = String(email || '').trim().toLowerCase();
      contacts = contacts.filter((c) => c.email !== key);
      renderChips();
      emitChange();
    }

    function clearContacts() {
      contacts = [];
      input.value = '';
      hideDropdown();
      renderChips();
      emitChange();
    }

    function setContacts(list) {
      contacts = [];
      (Array.isArray(list) ? list : []).forEach((item) => {
        const c = normalizeContact(item);
        if (!c) return;
        if (mode === 'single') contacts = [c];
        else if (!contacts.some((x) => x.email === c.email)) contacts.push(c);
      });
      input.value = '';
      hideDropdown();
      renderChips();
      emitChange();
    }

    function getContacts() {
      return contacts.map((c) => ({ ...c }));
    }

    function getEmails() {
      return contacts.map((c) => c.email);
    }

    function getPrimaryEmail() {
      return contacts[0]?.email || '';
    }

    function getEmailsCsv() {
      return getEmails().join(', ');
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

    function selectItem(item) {
      if (!item?.email) return;
      addContact(item, { replace: mode === 'single' });
      input.focus();
    }

    const runSearch = debounce(async () => {
      const token = String(input.value || '').trim();
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
      const token = String(input.value || '').trim();
      if (token.length >= 2) runSearch();
    });

    input.addEventListener('keydown', (ev) => {
      if (!dropdown.hidden) {
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
          if (pick) selectItem(pick);
          return;
        }
      }

      if (ev.key === 'Backspace' && !input.value && contacts.length) {
        removeContact(contacts[contacts.length - 1].email);
        ev.preventDefault();
      }
    });

    dropdown.addEventListener('mousedown', (ev) => {
      const btn = ev.target.closest('[data-email]');
      if (!btn || btn.classList.contains('gderpi-email-chip__remove')) return;
      ev.preventDefault();
      const email = btn.getAttribute('data-email');
      const item = visible.find((x) => x.email === email) || { email };
      selectItem(item);
    });

    chipsEl.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-remove-email]');
      if (!btn) return;
      removeContact(btn.getAttribute('data-remove-email'));
      input.focus();
    });

    root.addEventListener('click', () => input.focus());

    document.addEventListener('click', (ev) => {
      if (!root.contains(ev.target)) hideDropdown();
    });

    renderChips();

    return {
      root,
      addContact,
      removeContact,
      clearContacts,
      setContacts,
      getContacts,
      getEmails,
      getPrimaryEmail,
      getEmailsCsv,
      focus() { input.focus(); },
      destroy() {
        hideDropdown();
        delete root.dataset.gderpiEmailChipBound;
        root.innerHTML = '';
        root.classList.remove('gderpi-email-chip-field', 'gderpi-email-chip-field--has-chip');
      }
    };
  }

  global.GderpiBindEmailContactChipField = { bindEmailContactChipField };
})(window);
