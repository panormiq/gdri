/**

 * Normalise une facture client embarquée dans une commande.

 */



const crypto = require('crypto');

const { buildFactureDocId } = require('./parseFactureDocId');
const normalizeAvoir = require('./normalizeAvoir');



function normalizeFacture(raw, commandeClientId = '') {

  const f = raw && typeof raw === 'object' ? raw : {};

  const totaux = f.totaux && typeof f.totaux === 'object' ? f.totaux : {};

  const numero = String(f.numero || f.factureNumero || '').trim();

  const cmdId = String(commandeClientId || '').trim();



  let id = String(f.id || f.factureId || '').trim();

  if (!id && numero && cmdId) {

    id = buildFactureDocId(cmdId, numero);

  } else if (!id) {

    id = crypto.randomUUID();

  }



  return {

    id,

    numero,

    date: f.date || f.factureDate || null,

    payee: f.payee === true || f.facturePayee === true,

    payeeAt: f.payeeAt || f.facturePayeeAt || null,

    lignes: Array.isArray(f.lignes) ? f.lignes.map((l) => ({

      id: String(l.id || l.lineId || '').trim(),

      quantite: Number(l.quantite) || 0

    })).filter((l) => l.id && l.quantite > 0) : [],

    totaux,

    avoirs: Array.isArray(f.avoirs)
      ? f.avoirs.map((a) => normalizeAvoir(a)).filter((a) => a.numero)
      : [],

    soldeeParAvoir: f.soldeeParAvoir === true,
    soldeeParAvoirAt: f.soldeeParAvoirAt || null

  };

}



module.exports = normalizeFacture;


