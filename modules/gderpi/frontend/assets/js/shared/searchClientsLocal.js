/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/searchClientsLocal.js
 * RÔLE : Filtre local des clients (nom, email, ville, SIRET).
 *
 * ENTRÉES : clients[], query, limit
 * SORTIES : Client[] triés par pertinence
 *
 * DÉPEND DE : —
 * NE PAS : appels API
 *
 * APPELÉ PAR : bindClientSearchField.js, bindDevisTab.js
 */
(function initGderpiSearchClientsLocal(global) {
  'use strict';

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function clientFieldLabel(client) {
    if (!client) return '';
    if (client.type === 'particulier') {
      const full = [client.prenom, client.nom].filter(Boolean).join(' ').trim();
      return full || String(client.displayName || '').trim();
    }
    return String(client.raisonSociale || '').trim();
  }

  function clientLabel(client) {
    return clientFieldLabel(client);
  }

  function scoreClient(client, q) {
    const name = normalize(clientLabel(client));
    const email = normalize(client.email);
    const ville = normalize(client.ville);
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (email.startsWith(q)) return 2;
    if (name.includes(q)) return 3;
    if (email.includes(q)) return 4;
    if (ville.includes(q)) return 5;
    return 99;
  }

  function searchClientsLocal(clients, query, limit) {
    const q = normalize(query);
    const list = Array.isArray(clients) ? clients : [];
    if (!q) return list.slice(0, limit || 10);
    return list
      .filter((c) => {
        const hay = [
          clientLabel(c),
          c.email,
          c.telephone,
          c.ville,
          c.raisonSociale,
          c.siret,
          c.prenom,
          c.nom,
          c.contactSearch
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => scoreClient(a, q) - scoreClient(b, q))
      .slice(0, limit || 10);
  }

  function clientSelectLabel(client) {
    const name = clientFieldLabel(client) || 'Client';
    const parts = [name];
    if (client.ville) parts.push(client.ville);
    if (client.email) parts.push(client.email);
    return parts.filter(Boolean).join(' — ');
  }

  global.GderpiClientSearch = {
    searchClientsLocal,
    clientLabel,
    clientFieldLabel,
    clientSelectLabel
  };
})(window);
