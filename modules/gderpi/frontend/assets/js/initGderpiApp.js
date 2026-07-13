/**
 * FICHIER : modules/gderpi/frontend/assets/js/initGderpiApp.js
 * RÔLE : Bootstrap GDERPI — navigation latérale, dashboard par défaut.
 */

(function initGderpiApp(global) {
  'use strict';

  const CONFIG_DEFAULT = { configTab: 'unites' };

  const TAB_REFRESHERS = {
    dashboard: () => global.GderpiDashboardTab?.refreshDashboard?.(),
    articles: () => global.GderpiArticlesRefresh?.refreshArticlesList?.(),
    categories: () => global.GderpiNodesTab?.reloadNodes?.(),
    clients: () => global.GderpiClientsTab?.refreshClientsList?.(),
    fournisseurs: () => global.GderpiFournisseursTab?.refreshFournisseursList?.(),
    devis: () => global.GderpiDevisTab?.refreshDevisList?.(),
    commandes: () => global.GderpiCommandesClientTab?.refreshCommandesList?.(),
    'bons-livraison': () => global.GderpiBonsLivraisonTab?.refreshBonsLivraisonList?.(),
    achats: () => global.GderpiAchatsTab?.refreshAchatsList?.(),
    facturation: () => global.GderpiFacturationTab?.refreshFacturationList?.(),
    configuration: (opts) => global.GderpiConfigurationTab?.open?.(opts || CONFIG_DEFAULT)
  };

  function getConfigGroup() {
    return document.getElementById('gderpi-nav-group-configuration');
  }

  function getBoutiquesConfigGroup() {
    return document.getElementById('gderpi-nav-group-config-boutiques');
  }

  function getArticlesConfigGroup() {
    return document.getElementById('gderpi-nav-group-config-articles');
  }

  function getClientsConfigGroup() {
    return document.getElementById('gderpi-nav-group-config-clients');
  }

  function getMailConfigGroup() {
    return document.getElementById('gderpi-nav-group-config-mail');
  }

  const NESTED_NAV_GROUPS = [
    { getGroup: getBoutiquesConfigGroup, parentSelector: '.gderpi-nav-btn--subparent' },
    { getGroup: getArticlesConfigGroup, parentSelector: '.gderpi-nav-btn--subparent' },
    { getGroup: getClientsConfigGroup, parentSelector: '.gderpi-nav-btn--subparent' },
    { getGroup: getMailConfigGroup, parentSelector: '.gderpi-nav-btn--subparent' }
  ];

  function setNavGroupOpen(group, open, parentSelector) {
    if (!group) return;
    const sub = group.querySelector(':scope > .gderpi-nav-sub, :scope > .gderpi-nav-sub--nested');
    const parent = group.querySelector(parentSelector || '.gderpi-nav-btn--parent');
    group.classList.toggle('gderpi-nav-group--open', open);
    if (sub) sub.hidden = !open;
    if (parent) parent.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function toggleNavGroup(group, parentSelector) {
    if (!group) return;
    const open = !group.classList.contains('gderpi-nav-group--open');
    setNavGroupOpen(group, open, parentSelector);
  }

  function collapseNestedNavGroups() {
    NESTED_NAV_GROUPS.forEach(({ getGroup, parentSelector }) => {
      setNavGroupOpen(getGroup(), false, parentSelector);
    });
  }

  function expandNavGroup(group, parentSelector) {
    setNavGroupOpen(group, true, parentSelector);
  }

  function setConfigGroupOpen(open) {
    setNavGroupOpen(getConfigGroup(), open, '.gderpi-nav-btn--parent');
  }

  function isChevronClick(ev) {
    return Boolean(ev.target.closest('.gderpi-nav-chevron'));
  }

  function resolveConfigTab(navOpts) {
    const opts = navOpts && typeof navOpts === 'object' ? navOpts : {};
    return opts.configTab || opts.articlesTab || CONFIG_DEFAULT.configTab;
  }

  function expandNestedGroupForConfigTab(configTab) {
    if (configTab === 'boutiques' || configTab === 'boutiques-cgv') {
      expandNavGroup(getBoutiquesConfigGroup(), '.gderpi-nav-btn--subparent');
    } else if (configTab === 'articles' || configTab === 'unites') {
      expandNavGroup(getArticlesConfigGroup(), '.gderpi-nav-btn--subparent');
    } else if (configTab === 'services') {
      expandNavGroup(getClientsConfigGroup(), '.gderpi-nav-btn--subparent');
    } else if (configTab === 'mail-accounts' || configTab === 'mail-devis') {
      expandNavGroup(getMailConfigGroup(), '.gderpi-nav-btn--subparent');
    }
  }

  function updateNavState(id, navOpts) {
    const configTab = resolveConfigTab(navOpts);
    const onConfig = id === 'configuration';

    document.querySelectorAll('.gderpi-nav-btn').forEach((btn) => {
      const navId = btn.getAttribute('data-gderpi-nav');
      const isSubNested = btn.classList.contains('gderpi-nav-btn--sub-nested');
      const isSubParent = btn.classList.contains('gderpi-nav-btn--subparent');
      const isSub = btn.classList.contains('gderpi-nav-btn--sub') && !isSubNested && !isSubParent;
      const isParent = btn.classList.contains('gderpi-nav-btn--parent');

      if (isSubNested) {
        const tab = btn.getAttribute('data-gderpi-config-tab');
        btn.classList.toggle('active', onConfig && tab === configTab);
        return;
      }

      if (isSubParent) {
        const tab = btn.getAttribute('data-gderpi-config-tab');
        const boutiquesActive = onConfig && (configTab === 'boutiques' || configTab === 'boutiques-cgv');
        const articlesActive = onConfig && (configTab === 'articles' || configTab === 'unites');
        const clientsActive = onConfig && configTab === 'services';
        const mailActive = onConfig && (configTab === 'mail-accounts' || configTab === 'mail-devis');
        if (tab === 'boutiques') btn.classList.toggle('active', boutiquesActive);
        else if (tab === 'articles') btn.classList.toggle('active', articlesActive);
        else if (tab === 'services') btn.classList.toggle('active', clientsActive);
        else if (tab === 'mail-accounts') btn.classList.toggle('active', mailActive);
        else btn.classList.toggle('active', onConfig && tab === configTab);
        return;
      }

      if (isSub) {
        const tab = btn.getAttribute('data-gderpi-config-tab');
        btn.classList.toggle('active', onConfig && tab === configTab);
        return;
      }

      if (isParent) {
        btn.classList.toggle('active', onConfig);
        return;
      }

      btn.classList.toggle('active', navId === id);
    });

    setConfigGroupOpen(onConfig);
    if (!onConfig) collapseNestedNavGroups();
  }

  function navigate(tabId, options) {
    const id = String(tabId || 'dashboard').trim();
    const navOpts = options && typeof options === 'object' ? options : {};

    document.querySelectorAll('.gderpi-main-panel').forEach((p) => {
      p.hidden = p.id !== 'gderpi-panel-' + id;
    });

    updateNavState(id, navOpts);

    const refresh = TAB_REFRESHERS[id];
    if (typeof refresh === 'function') {
      global.GderpiLoading?.show?.({ immediate: true, message: 'Chargement…' });
      return Promise.resolve(refresh(navOpts))
        .catch((err) => {
          global.GderpiStatus.showStatus(err.message || 'Erreur chargement', 'danger');
        })
        .finally(() => {
          global.GderpiLoading?.hide?.();
        });
    }
    return Promise.resolve();
  }

  function openConfiguration(configTab, expandGroupFromBtn) {
    const tab = configTab || CONFIG_DEFAULT.configTab;
    navigate('configuration', { configTab: tab });
    setConfigGroupOpen(true);
    if (expandGroupFromBtn) {
      expandNavGroup(expandGroupFromBtn.closest('.gderpi-nav-group'), '.gderpi-nav-btn--subparent');
    } else {
      expandNestedGroupForConfigTab(tab);
    }
  }

  function bindNav() {
    const navRoot = document.querySelector('.gderpi-nav');

    document.querySelectorAll('.gderpi-nav-btn').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        const navId = btn.getAttribute('data-gderpi-nav');

        if (btn.classList.contains('gderpi-nav-btn--parent')) {
          const configGroup = getConfigGroup();
          if (isChevronClick(ev)) {
            ev.preventDefault();
            toggleNavGroup(configGroup, '.gderpi-nav-btn--parent');
            return;
          }
          openConfiguration(CONFIG_DEFAULT.configTab);
          return;
        }

        if (btn.classList.contains('gderpi-nav-btn--subparent')) {
          const group = btn.closest('.gderpi-nav-group');
          if (isChevronClick(ev)) {
            ev.preventDefault();
            toggleNavGroup(group, '.gderpi-nav-btn--subparent');
            return;
          }
          openConfiguration(btn.getAttribute('data-gderpi-config-tab') || 'articles', btn);
          return;
        }

        if (btn.classList.contains('gderpi-nav-btn--sub-nested') || btn.classList.contains('gderpi-nav-btn--sub')) {
          const configTab = btn.getAttribute('data-gderpi-config-tab') || CONFIG_DEFAULT.configTab;
          openConfiguration(configTab);
          return;
        }

        collapseNestedNavGroups();
        navigate(navId);
      });
    });

    if (navRoot) {
      navRoot.addEventListener('focusout', (ev) => {
        const next = ev.relatedTarget;
        if (next && navRoot.contains(next)) return;
        window.setTimeout(() => {
          if (!navRoot.contains(document.activeElement)) {
            collapseNestedNavGroups();
          }
        }, 0);
      });

      document.addEventListener('click', (ev) => {
        if (!navRoot.contains(ev.target)) {
          collapseNestedNavGroups();
        }
      });
    }
  }

  async function initGderpiApp() {
    global.GderpiAppNav = navigate;
    bindNav();
    global.GderpiDashboardTab.bindDashboardTab();
    global.GderpiBoutiquesTab.bindBoutiquesTab();
    global.GderpiBoutiqueConfig.bindBoutiqueConfig();
    global.GderpiNodesTab.bindNodesTab();
    global.GderpiArticlesTab.bindArticlesTab();
    global.GderpiClientsTab.bindClientsTab();
    global.GderpiFournisseursTab.bindFournisseursTab();
    global.GderpiDevisTab.bindDevisTab();
    global.GderpiCommandesClientTab?.bindCommandesClientTab?.();
    global.GderpiBonsLivraisonTab?.bindBonsLivraisonTab?.();
    global.GderpiCommandeClientEditor?.bindCommandeClientEditor?.();
    global.GderpiCommandeFournisseurEditor?.bindCommandeFournisseurEditor?.();
    global.GderpiAchatsTab.bindAchatsTab();
    global.GderpiCommandeFournisseurEditor?.bindAchatsCreateButtons?.();
    global.GderpiFacturationTab.bindFacturationTab();
    global.GderpiConfigurationTab.bindConfigurationTab();
    global.GderpiMailConfigTab?.bindMailConfigTab?.();
    global.GderpiUnitesTab.bindUnitesTab();
    global.GderpiClientServicesTab.bindClientServicesTab();
    global.GderpiServiceSelect.bindServiceQuickModal();
    global.GderpiServiceSelect.bindServicePicker('gderpi-client-contact-service', 'gderpi-client-contact-service-add');
    global.GderpiServiceSelect.bindServicePicker('gderpi-devis-new-contact-service', 'gderpi-devis-new-contact-service-add');

    global.GderpiLoading?.show?.({ immediate: true, message: 'Connexion à GDERPI…' });
    try {
      await global.GderpiApi.apiCall('/health', { silent: true });
      global.GderpiLoading?.hide?.();
      await navigate('dashboard');
      await global.GderpiNodesTab.reloadNodes();
      global.GderpiStatus.showStatus('GDERPI prêt.', 'success');

      const params = new URLSearchParams(window.location.search);
      const devisId = params.get('devis');
      if (devisId) {
        await navigate('devis');
        await global.GderpiDevisTab?.openDevis?.(devisId);
      }
    } catch (err) {
      global.GderpiStatus.showStatus(err.message || 'Erreur GDERPI', 'danger');
    } finally {
      global.GderpiLoading?.hide?.();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGderpiApp);
  } else {
    initGderpiApp();
  }
})(window);
