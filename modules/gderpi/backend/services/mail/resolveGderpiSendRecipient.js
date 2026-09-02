/**
 * Résout le destinataire par défaut avant envoi (aperçu UI).
 */

const getDevisById = require('../devis/getDevisById');
const getCommandeClientById = require('../commande-client/getCommandeClientById');
const getClientById = require('../clients/getClientById');
const getCommandeFournisseurById = require('../commande-fournisseur/getCommandeFournisseurById');
const buildCommandeFournisseurHtmlContext = require('../pdf/buildCommandeFournisseurHtmlContext');
const resolveDevisContact = require('../pdf/resolveDevisContact');

function resolveClientRecipient(devis, client) {
  if (devis?.contactEmail) {
    return {
      to: String(devis.contactEmail).trim(),
      label: String(devis.contactNom || '').trim()
    };
  }
  const contact = resolveDevisContact(devis || {}, client);
  if (contact?.email) {
    return { to: contact.email, label: contact.nom || '' };
  }
  if (client?.email) {
    return { to: String(client.email).trim(), label: client.nom || client.raisonSociale || '' };
  }
  return { to: '', label: '' };
}

function resolveFournisseurRecipient(fournisseur) {
  if (!fournisseur) return { to: '', label: '' };
  if (fournisseur.email) {
    return {
      to: String(fournisseur.email).trim(),
      label: fournisseur.contactNom || fournisseur.raisonSociale || fournisseur.displayName || ''
    };
  }
  const contacts = Array.isArray(fournisseur.contacts) ? fournisseur.contacts : [];
  const principal = contacts.find((c) => c.principal) || contacts[0];
  if (principal?.email) {
    return {
      to: String(principal.email).trim(),
      label: [principal.prenom, principal.nom].filter(Boolean).join(' ').trim()
        || fournisseur.raisonSociale
        || ''
    };
  }
  return { to: '', label: fournisseur.raisonSociale || fournisseur.displayName || '' };
}

async function resolveGderpiSendRecipient(db, entrepriseId, options = {}, req = null) {
  const type = String(options.type || '').trim();
  const id = String(options.id || '').trim();
  if (!type || !id) throw new Error('Type et identifiant requis');

  if (type === 'devis') {
    const devis = await getDevisById(db, entrepriseId, id);
    if (!devis) throw new Error('Devis introuvable');
    const client = devis.clientId ? await getClientById(db, entrepriseId, devis.clientId) : null;
    return resolveClientRecipient(devis, client);
  }

  if (['commande_client', 'facture', 'avoir'].includes(type)) {
    const commande = await getCommandeClientById(db, entrepriseId, id, { skipPipelineRepair: true });
    if (!commande) throw new Error('Commande client introuvable');
    const [client, devis] = await Promise.all([
      commande.clientId ? getClientById(db, entrepriseId, commande.clientId) : null,
      commande.devisId ? getDevisById(db, entrepriseId, commande.devisId) : null
    ]);
    return resolveClientRecipient({ ...(devis || {}), ...(commande || {}) }, client);
  }

  if (type === 'commande_fournisseur') {
    const commande = await getCommandeFournisseurById(db, entrepriseId, id);
    if (!commande) throw new Error('Commande fournisseur introuvable');
    const context = await buildCommandeFournisseurHtmlContext(db, entrepriseId, commande, req);
    return resolveFournisseurRecipient(context.fournisseur);
  }

  throw new Error('Type d\'envoi non reconnu');
}

module.exports = resolveGderpiSendRecipient;
