/**
 * FICHIER : modules/gderpi/frontend/assets/js/configuration/bindConfigurationTab.js
 * RÔLE : Configuration — panneaux Boutiques / Articles / Unités / Services / Mail.
 */
(function initGderpiBindConfigurationTab(global) {
  'use strict';

  const CONFIG_PANELS = {
    boutiques: 'gderpi-config-panel-boutiques',
    'boutiques-cgv': 'gderpi-config-panel-boutiques-cgv',
    articles: 'gderpi-config-panel-articles',
    unites: 'gderpi-config-panel-unites',
    services: 'gderpi-config-panel-services',
    'mail-accounts': 'gderpi-config-panel-mail-accounts',
    'mail-devis': 'gderpi-config-panel-mail-devis'
  };

  let activeConfigTab = 'unites';

  function setPanelVisible(panelId, visible) {
    const el = document.getElementById(panelId);
    if (!el) return;
    if (visible) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }

  function showConfigTab(tabId) {
    activeConfigTab = String(tabId || 'unites').trim();
    if (!CONFIG_PANELS[activeConfigTab]) activeConfigTab = 'unites';

    Object.entries(CONFIG_PANELS).forEach(([tab, panelId]) => {
      setPanelVisible(panelId, tab === activeConfigTab);
    });

    if (activeConfigTab === 'boutiques') {
      return global.GderpiBoutiquesTab?.refreshBoutiquesList?.();
    }
    if (activeConfigTab === 'boutiques-cgv') {
      return global.GderpiBoutiqueConfig?.openCgvTab?.();
    }
    if (activeConfigTab === 'unites') {
      return global.GderpiUnitesTab?.refreshUnitesList?.();
    }
    if (activeConfigTab === 'services') {
      return global.GderpiClientServicesTab?.refreshClientServicesList?.();
    }
    if (activeConfigTab === 'mail-accounts') {
      return global.GderpiMailConfigTab?.refreshMailAccountsTab?.();
    }
    if (activeConfigTab === 'mail-devis') {
      return global.GderpiMailConfigTab?.refreshMailDevisTab?.();
    }
    return undefined;
  }

  function open(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const tab = opts.configTab || opts.articlesTab || 'unites';
    return showConfigTab(tab);
  }

  function bindConfigurationTab() {
    showConfigTab('unites');
  }

  global.GderpiConfigurationTab = {
    bindConfigurationTab,
    open,
    getActiveConfigTab: () => activeConfigTab
  };
})(window);
