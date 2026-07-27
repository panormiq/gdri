/**
 * Assure qu'un utilisateur d'entité a un contact Annuaire interne.
 * - Si l'email existe déjà → lie le userId si besoin
 * - Sinon → crée le contact rattaché à l'organisation interne / entreprise
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../../backend/config/database'));
const findContactByEmail = require('./findContactByEmail');
const createContact = require('./createContact');
const updateContact = require('./updateContact');
const ensureInternalOrganisation = require('../organisations/ensureInternalOrganisation');
const { getCompanyOrganisationDoc } = require('../organisations/getCompanyOrganisation');

const ORG_COL = 'annuaire_organisations';

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { prenom: '', nom: '' };
  if (parts.length === 1) return { prenom: parts[0], nom: '' };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
}

async function resolveInternalOrganisationId(db, entrepriseId) {
  const eid = String(entrepriseId);
  let own = await db.collection(ORG_COL).findOne({ entrepriseId: eid, isOwnEntity: true });
  if (!own) {
    try {
      await ensureInternalOrganisation(db, eid);
    } catch (_) {
      /* ignore */
    }
    own = await db.collection(ORG_COL).findOne({ entrepriseId: eid, isOwnEntity: true });
  }
  if (own) return own.organisationId;

  const company = await getCompanyOrganisationDoc(db, eid);
  if (company) return company.organisationId;

  return null;
}

/**
 * @param {import('mongodb').Db} db
 * @param {string} entrepriseId
 * @param {{ email: string, userId?: string|null, prenom?: string, nom?: string, name?: string, fonction?: string, principal?: boolean }} user
 */
async function ensureContactForEntityUser(db, entrepriseId, user = {}) {
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return null;

  const organisationId = await resolveInternalOrganisationId(db, entrepriseId);
  if (!organisationId) {
    throw new Error('Organisation interne Annuaire introuvable pour cette entité');
  }

  const fromName = splitName(user.name);
  const prenom = String(user.prenom || fromName.prenom || '').trim();
  const nom = String(user.nom || fromName.nom || '').trim();
  const userId = user.userId != null ? String(user.userId).trim() || null : null;

  const existing = await findContactByEmail(db, entrepriseId, email);
  if (existing) {
    const patch = {};
    if (userId && !existing.userId) patch.userId = userId;
    if (prenom && !existing.prenom) patch.prenom = prenom;
    if (nom && !existing.nom) patch.nom = nom;
    if (existing.scope !== 'interne') patch.scope = 'interne';
    if (existing.organisationId !== organisationId && !existing.organisationId) {
      patch.organisationId = organisationId;
    }
    if (Object.keys(patch).length) {
      return updateContact(db, entrepriseId, existing.contactId, patch);
    }
    return existing;
  }

  return createContact(db, entrepriseId, {
    organisationId,
    email,
    prenom,
    nom,
    fonction: String(user.fonction || '').trim(),
    scope: 'interne',
    userId,
    principal: user.principal === true,
    boutiqueOrganisationIds: []
  }, {
    actorUserId: userId
  });
}

/**
 * Variante autonome : résout la DB entreprise puis délègue.
 */
async function ensureContactForEntityUserByEntrepriseId(entrepriseId, user = {}) {
  const eid = String(entrepriseId || '').trim();
  if (!eid || eid === 'SYSTEM') return null;
  const db = await database.getEntrepriseDb(eid);
  return ensureContactForEntityUser(db, eid, user);
}

module.exports = ensureContactForEntityUser;
module.exports.ensureContactForEntityUserByEntrepriseId = ensureContactForEntityUserByEntrepriseId;
