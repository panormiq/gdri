/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/bindArticleSearchField.js
 * RÔLE : Champ texte avec suggestions articles (réf. ou libellé).
 *
 * ENTRÉES : input HTML, options { articles, onSelect, onInput }
 * SORTIES : { destroy, setValue }
 *
 * DÉPEND DE : GderpiEscape, GderpiArticleSearch
 * NE PAS : logique devis
 *
 * APPELÉ PAR : bindDevisTab.js
 */
(function initGderpiBindArticleSearchField(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);
  const search = (articles, q) => global.GderpiArticleSearch.searchArticlesLocal(articles, q, 10);

  function bindArticleSearchField(input, options) {
    if (!input || input.dataset.gderpiArticleSearchBound) return null;
    input.dataset.gderpiArticleSearchBound = '1';
    input.setAttribute('autocomplete', 'off');

    const wrap = document.createElement('div');
    wrap.className = 'gderpi-article-search';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'gderpi-article-search__dropdown';
    dropdown.hidden = true;
    wrap.appendChild(dropdown);

    let activeIdx = -1;
    let visible = [];

    function getArticles() {
      return typeof options.getArticles === 'function' ? options.getArticles() : (options.articles || []);
    }

    function hideDropdown() {
      dropdown.hidden = true;
      activeIdx = -1;
      visible = [];
    }

    function renderDropdown(items) {
      visible = items;
      if (!items.length) {
        dropdown.innerHTML = '<div class="gderpi-article-search__empty">Aucun article — saisie libre possible</div>';
        dropdown.hidden = false;
        return;
      }
      dropdown.innerHTML = items.map((a, i) => {
        const id = a.articleId || a.id;
        const ref = a.reference ? '<span class="gderpi-article-search__ref">' + esc(a.reference) + '</span>' : '';
        const type = String(a.type || '').toLowerCase();
        const typeBadge = type === 'developpement'
          ? '<span class="gderpi-article-search__type">Dev</span>'
          : (type === 'service' ? '<span class="gderpi-article-search__type">Service</span>' : '');
        const prix = Number(a.prixHt);
        const prixLabel = a.prixSurDevis ? 'Sur devis' : (Number.isFinite(prix) ? prix.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) + ' HT' : '');
        const refFrs = a.referenceFournisseur ? '<span class="gderpi-article-search__ref-frs">Frs: ' + esc(a.referenceFournisseur) + '</span>' : '';
        return '<button type="button" class="gderpi-article-search__item' + (i === activeIdx ? ' is-active' : '') + '" data-article-id="' + esc(id) + '" tabindex="-1">' +
          ref + typeBadge + '<span class="gderpi-article-search__lib">' + esc(a.libelle || '—') + '</span>' +
          refFrs +
          (prixLabel ? '<span class="gderpi-article-search__prix">' + esc(prixLabel) + '</span>' : '') +
          '</button>';
      }).join('');
      dropdown.hidden = false;
    }

    function selectArticle(article) {
      if (!article) return;
      hideDropdown();
      if (typeof options.onSelect === 'function') options.onSelect(article);
    }

    function pickById(id) {
      const a = getArticles().find((x) => String(x.articleId || x.id) === String(id));
      if (a) selectArticle(a);
    }

    function onInputEvent() {
      const q = input.value;
      if (typeof options.onInput === 'function') options.onInput(q);
      if (!q.trim()) {
        hideDropdown();
        return;
      }
      renderDropdown(search(getArticles(), q));
    }

    input.addEventListener('input', onInputEvent);
    input.addEventListener('focus', () => {
      const q = input.value.trim();
      renderDropdown(q ? search(getArticles(), q) : getArticles().slice(0, 8));
    });

    input.addEventListener('keydown', (ev) => {
      if (dropdown.hidden) {
        if (ev.key === 'ArrowDown' && input.value.trim()) {
          renderDropdown(search(getArticles(), input.value));
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
          selectArticle(visible[activeIdx]);
        } else if (visible.length === 1) {
          selectArticle(visible[0]);
        } else {
          hideDropdown();
        }
      }
    });

    dropdown.addEventListener('mousedown', (ev) => {
      const btn = ev.target.closest('[data-article-id]');
      if (!btn) return;
      ev.preventDefault();
      pickById(btn.getAttribute('data-article-id'));
    });

    document.addEventListener('click', (ev) => {
      if (!wrap.contains(ev.target)) hideDropdown();
    });

    return {
      destroy() {
        hideDropdown();
        delete input.dataset.gderpiArticleSearchBound;
        if (wrap.parentNode) {
          wrap.parentNode.insertBefore(input, wrap);
          wrap.remove();
        }
      },
      setValue(value) {
        input.value = value ?? '';
      }
    };
  }

  global.GderpiBindArticleSearch = { bindArticleSearchField };
})(window);
