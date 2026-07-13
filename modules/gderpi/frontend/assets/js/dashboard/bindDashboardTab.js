/**
 * FICHIER : modules/gderpi/frontend/assets/js/dashboard/bindDashboardTab.js
 * RÔLE : Tableau de bord GDERPI — KPI et tâches de suivi.
 *
 * ENTRÉES : DOM dashboard + API /dashboard
 * SORTIES : cartes et liste de tâches
 *
 * DÉPEND DE : GderpiApi, GderpiEscape
 * NE PAS : CRUD entités
 *
 * APPELÉ PAR : initGderpiApp.js
 */
(function initGderpiBindDashboardTab(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);

  function renderKpi(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value ?? '—');
  }

  function renderTasks(tasks) {
    const ul = document.getElementById('gderpi-dashboard-tasks');
    if (!ul) return;
    const list = Array.isArray(tasks) ? tasks : [];
    if (!list.length) {
      ul.innerHTML = '<li class="text-muted">Aucune tâche en cours.</li>';
      return;
    }
    ul.innerHTML = list.map((t) => {
      const upcoming = t.upcoming === true;
      const badge = upcoming ? ' <span class="gderpi-badge gderpi-badge--soon">Bientôt</span>' : '';
      const count = Number(t.count) > 0 ? ' <strong>(' + t.count + ')</strong>' : '';
      const tab = t.tab ? ' data-gderpi-nav="' + esc(t.tab) + '"' : '';
      const configTab = t.configTab || t.articlesTab;
      const configTabAttr = configTab ? ' data-gderpi-config-tab="' + esc(configTab) + '"' : '';
      const prio = t.priority === 'high' ? ' gderpi-task--high' : '';
      return '<li class="gderpi-task' + prio + '"' + tab + configTabAttr + ' role="button" tabindex="0">' +
        esc(t.label) + count + badge + '</li>';
    }).join('');

    ul.querySelectorAll('[data-gderpi-nav]').forEach((li) => {
      const go = () => {
        const tab = li.getAttribute('data-gderpi-nav');
        if (!tab) return;
        if (!document.getElementById('gderpi-panel-' + tab)) {
          global.GderpiStatus.showStatus('Section à venir (phase devis / achats / facturation).', 'info');
          return;
        }
        const configTab = li.getAttribute('data-gderpi-config-tab');
        if (typeof global.GderpiAppNav === 'function') {
          global.GderpiAppNav(tab, configTab ? { configTab } : undefined);
        }
      };
      li.addEventListener('click', go);
      li.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); }
      });
    });
  }

  async function refreshDashboard() {
    const res = await global.GderpiApi.apiCall('/dashboard');
    const data = res.data || {};
    const c = data.counts || {};
    const w = data.workflow || {};
    renderKpi('gderpi-kpi-boutiques', c.boutiquesActives ?? c.boutiques);
    renderKpi('gderpi-kpi-articles', c.articles);
    renderKpi('gderpi-kpi-clients', c.clients);
    renderKpi('gderpi-kpi-fournisseurs', c.fournisseurs);
    renderKpi('gderpi-kpi-devis', w.devisEnAttenteReponse);
    renderKpi('gderpi-kpi-cmd-fourn', w.commandesFournisseurEnAttente);
    renderKpi('gderpi-kpi-facture', w.facturationAFaire);
    renderTasks(data.tasks);
  }

  function bindDashboardTab() {
    const btn = document.getElementById('gderpi-dashboard-refresh');
    if (btn) btn.addEventListener('click', () => refreshDashboard().catch(handleErr));
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err.message || 'Erreur dashboard', 'danger');
  }

  global.GderpiDashboardTab = { bindDashboardTab, refreshDashboard };
})(window);
