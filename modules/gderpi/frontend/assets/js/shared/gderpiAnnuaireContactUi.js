/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/gderpiAnnuaireContactUi.js
 * RÔLE : CRUD contacts via modales GDERPI → API Annuaire.
 */

(function initGderpiAnnuaireContactUi(global) {
  'use strict';

  function bridge() {
    return global.GderpiAnnuaireBridge;
  }

  function findByRowKey(contactsState, rowKey, contactRowKey) {
    return contactsState.find(function (c, i) {
      return contactRowKey(c, i) === String(rowKey);
    }) || null;
  }

  function annuaireContactId(contact) {
    const id = String(contact?.id || contact?.contactId || '').trim();
    if (!id || /^(ct-|bt-|fr-)/.test(id)) return '';
    return id;
  }

  async function persistContact(opts) {
    const B = bridge();
    const existing = opts.editingRowKey
      ? findByRowKey(opts.contactsState, opts.editingRowKey, opts.contactRowKey)
      : null;
    const cid = annuaireContactId(existing);
    if (cid) {
      return B.updateContact(cid, opts.draft, opts.scope);
    }
    return B.createContact(opts.organisationId, opts.draft, opts.scope);
  }

  async function removeContact(opts) {
    const c = findByRowKey(opts.contactsState, opts.rowKey, opts.contactRowKey);
    const cid = annuaireContactId(c);
    if (!cid) throw new Error('Contact Annuaire introuvable');
    return bridge().deleteContact(cid);
  }

  async function markPrincipal(opts) {
    const c = findByRowKey(opts.contactsState, opts.rowKey, opts.contactRowKey);
    const cid = annuaireContactId(c);
    if (!cid) throw new Error('Contact Annuaire introuvable');
    return bridge().setPrincipalContact(cid);
  }

  global.GderpiAnnuaireContactUi = {
    annuaireContactId: annuaireContactId,
    persistContact: persistContact,
    removeContact: removeContact,
    markPrincipal: markPrincipal
  };
})(window);
