/**
 * Confirme une commande via lien public devis : accepte le devis et crée la commande client.
 */

const getDevisById = require('./getDevisById');
const changeDevisStatus = require('./changeDevisStatus');
const createFromDevis = require('../commande-client/createFromDevis');
const parsePublicDevisOrderLines = require('./parsePublicDevisOrderLines');
const detectCommandeModifiedFromDevis = require('../workflow/detectCommandeModifiedFromDevis');
const { resolveDevisPublicLink } = require('./resolveDevisPublicLink');
const { parseSansBonCommandeClient } = require('../workflow/bonCommandeClient');
const sendDevisOrderConfirmationEmail = require('./sendDevisOrderConfirmationEmail');

const COLLECTION = 'gderpi_devis_public_links';

async function confirmDevisOrderByPublicLink(db, entrepriseId, token, payload = {}, meta = {}) {
  const resolved = await resolveDevisPublicLink(db, entrepriseId, token);
  if (!resolved.ok) return resolved;

  const { link, tokenHash } = resolved;

  if (link.acceptUsedAt) {
    const devis = await getDevisById(db, entrepriseId, link.devisId);
    const commande = link.commandeClientId
      ? await require('../commande-client/getCommandeClientById')(db, entrepriseId, link.commandeClientId)
      : null;
    return {
      ok: false,
      status: 409,
      message: 'Ce devis a déjà été confirmé via ce lien',
      code: 'already_accepted',
      devis,
      commande,
      modifieeParClient: link.modifieeParClient === true
    };
  }

  const devis = await getDevisById(db, entrepriseId, link.devisId);
  if (!devis) return { ok: false, status: 404, message: 'Devis introuvable' };

  if (devis.commandeClientId) {
    return {
      ok: false,
      status: 409,
      message: 'Une commande existe déjà pour ce devis',
      code: 'already_accepted',
      devis
    };
  }

  if (devis.statut !== 'envoye' && devis.statut !== 'accepte') {
    return {
      ok: false,
      status: 400,
      message: 'Ce devis ne peut plus être confirmé (statut : ' + devis.statut + ')'
    };
  }

  const body = payload && typeof payload === 'object' ? payload : {};
  const sansBonCommandeClient = parseSansBonCommandeClient(body.sansBonCommandeClient);
  const referenceClient = String(body.referenceClient || devis.referenceClient || devis.documentClient || '').trim();
  if (!referenceClient && !sansBonCommandeClient && !devis.sansBonCommandeClient) {
    return {
      ok: false,
      status: 400,
      message: 'Indiquez votre n° de bon de commande, ou cochez « Je n\'ai pas de n° de commande ».',
      code: 'missing_reference',
      devis
    };
  }
  const lignes = parsePublicDevisOrderLines(devis.lignes, body);
  if (!lignes.length) {
    return {
      ok: false,
      status: 400,
      message: 'Sélectionnez au moins un article avec une quantité supérieure à zéro',
      code: 'empty_order',
      devis
    };
  }

  const modifieeParClient = detectCommandeModifiedFromDevis(devis.lignes, lignes);
  const now = new Date();

  let updatedDevis = devis;
  if (devis.statut !== 'accepte') {
    updatedDevis = await changeDevisStatus(db, entrepriseId, link.devisId, 'accepte', {
      referenceClient,
      sansBonCommandeClient: !referenceClient
    });
    await db.collection('gderpi_devis').updateOne(
      { entrepriseId: String(entrepriseId), devisId: String(link.devisId) },
      {
        $push: {
          historique: {
            statut: 'accepte_client',
            date: now,
            source: 'lien_public',
            ip: String(meta.ip || '').trim(),
            modifieeParClient
          }
        }
      }
    );
  }

  const commande = await createFromDevis(db, entrepriseId, link.devisId, {
    lignes,
    referenceClient,
    sansBonCommandeClient: !referenceClient
  });

  await db.collection(COLLECTION).updateOne(
    { tokenHash },
    {
      $set: {
        acceptUsedAt: now,
        commandeClientId: String(commande.id || commande.commandeClientId || '').trim(),
        modifieeParClient: commande.modifieeParClient === true,
        acceptMeta: {
          ip: String(meta.ip || '').trim(),
          userAgent: String(meta.userAgent || '').trim().slice(0, 500)
        }
      }
    }
  );

  try {
    await sendDevisOrderConfirmationEmail(db, entrepriseId, {
      devisId: link.devisId,
      commandeClientId: commande.id || commande.commandeClientId,
      modifieeParClient: commande.modifieeParClient === true,
      link
    }, meta.req || null);
  } catch (error) {
    console.error('GDERPI confirmDevisOrder email:', error.message || error);
  }

  return {
    ok: true,
    devis: updatedDevis,
    commande,
    modifieeParClient: commande.modifieeParClient === true
  };
}

module.exports = confirmDevisOrderByPublicLink;
