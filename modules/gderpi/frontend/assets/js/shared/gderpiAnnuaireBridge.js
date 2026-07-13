/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/gderpiAnnuaireBridge.js
 * RÔLE : Appels Annuaire depuis GDERPI — contacts = source unique Annuaire.
 */

(function initGderpiAnnuaireBridge(global) {
  'use strict';

  function annuaireCall(path, options) {
    const cfg = global.GDERPI_CONFIG || {};
    const base = String(cfg.apiBase || '').replace(/\/$/, '');
    const token = cfg.jwt || '';
    const url = base + '/annuaire' + (path.startsWith('/') ? path : '/' + path);
    const opts = Object.assign({ credentials: 'include' }, options || {});
    opts.headers = Object.assign(
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      opts.headers || {}
    );
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        let body = {};
        if (text) {
          try { body = JSON.parse(text); } catch (e) {
            throw new Error('Réponse Annuaire invalide (' + res.status + ')');
          }
        }
        if (!res.ok || body.success === false) {
          throw new Error(body.message || ('Erreur HTTP ' + res.status));
        }
        return body;
      });
    });
  }

  function organisationPageUrl(organisationId) {
    const base = String(global.GDERPI_CONFIG?.pmUrl || '').replace(/\/pages\/modules\/pm\.php.*$/, '');
    const root = base || (window.location.origin + window.location.pathname.replace(/\/pages\/.*$/, ''));
    return root + '/pages/modules/annuaire.php?org=' + encodeURIComponent(organisationId || '');
  }

  /** Fiche existante liée → modales GDERPI, persistance Annuaire. */
  function usesAnnuaireContactApi(annuaireInstalled, editingId, organisationId) {
    return Boolean(annuaireInstalled && editingId && organisationId);
  }

  function renderAnnuaireNotice(el, item, annuaireInstalled, editingId) {
    if (!el) return;
    const esc = global.GderpiEscape?.escapeHtml || function (s) { return String(s == null ? '' : s); };
    const orgId = item?.annuaireOrganisationId;
    const linked = item?.annuaireLinked === true && orgId;

    if (!annuaireInstalled) {
      el.hidden = false;
      el.className = 'alert alert-warning gderpi-annuaire-notice';
      el.innerHTML = 'Le module <strong>Annuaire</strong> est requis — les contacts s\'y enregistrent.';
      return;
    }
    if (linked) {
      el.hidden = false;
      el.className = 'alert alert-info gderpi-annuaire-notice';
      el.innerHTML = 'Contacts enregistrés dans l\'<strong>Annuaire</strong> — '
        + 'utilisez les boutons ci-dessous ou '
        + '<a href="' + esc(organisationPageUrl(orgId)) + '" target="_blank" rel="noopener">ouvrir l\'organisation</a>.';
      return;
    }
    if (editingId) {
      el.hidden = false;
      el.className = 'alert alert-warning gderpi-annuaire-notice';
      el.textContent = 'Fiche non liée à l\'Annuaire — exécutez l\'import depuis le module Annuaire.';
      return;
    }
    el.hidden = false;
    el.className = 'alert alert-secondary gderpi-annuaire-notice';
    el.textContent = 'Les contacts saisis à la création seront enregistrés dans l\'Annuaire.';
  }

  function contactPayload(contact, scope) {
    return {
      prenom: contact.prenom || '',
      nom: contact.nom || '',
      fonction: contact.fonction || '',
      email: contact.email || '',
      telephone: contact.telephone || contact.tel || '',
      serviceLibelle: contact.service || contact.serviceLibelle || '',
      principal: contact.principal === true,
      scope: scope === 'interne' ? 'interne' : 'externe'
    };
  }

  function createContact(organisationId, contact, scope) {
    return annuaireCall('/contacts', {
      method: 'POST',
      body: JSON.stringify(Object.assign({ organisationId: organisationId }, contactPayload(contact, scope)))
    });
  }

  function updateContact(contactId, contact, scope) {
    const body = contactPayload(contact, scope);
    delete body.scope;
    if (contact.principal === true) body.principal = true;
    return annuaireCall('/contacts/' + encodeURIComponent(contactId), {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  function deleteContact(contactId) {
    return annuaireCall('/contacts/' + encodeURIComponent(contactId), { method: 'DELETE' });
  }

  function setPrincipalContact(contactId) {
    return annuaireCall('/contacts/' + encodeURIComponent(contactId), {
      method: 'PUT',
      body: JSON.stringify({ principal: true })
    });
  }

  global.GderpiAnnuaireBridge = {
    call: annuaireCall,
    organisationPageUrl: organisationPageUrl,
    usesAnnuaireContactApi: usesAnnuaireContactApi,
    renderAnnuaireNotice: renderAnnuaireNotice,
    createContact: createContact,
    updateContact: updateContact,
    deleteContact: deleteContact,
    setPrincipalContact: setPrincipalContact
  };
})(window);
