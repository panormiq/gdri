/**
 * FICHIER : modules/gderpi/backend/controllers/workflowController.js
 * RÔLE : Handlers HTTP workflow devis → commandes → facturation.
 *
 * ENTRÉES : req.entrepriseDb, req.entrepriseId
 * SORTIES : réponses JSON
 *
 * DÉPEND DE : services/commande-client/*, services/commande-fournisseur/*
 * NE PAS : logique métier inline
 *
 * APPELÉ PAR : routes.js
 */

const createFromDevis = require('../services/commande-client/createFromDevis');
const createCommandeClient = require('../services/commande-client/createCommandeClient');
const listCommandesClient = require('../services/commande-client/listCommandesClient');
const getCommandeClientById = require('../services/commande-client/getCommandeClientById');
const updateCommandeClientStatus = require('../services/commande-client/updateCommandeClientStatus');
const updateCommandeClient = require('../services/commande-client/updateCommandeClient');
const facturerCommandeClient = require('../services/commande-client/facturerCommandeClient');
const setFacturePayee = require('../services/commande-client/setFacturePayee');
const getFactureHtml = require('../services/commande-client/getFactureHtml');
const generateFacturePdf = require('../services/commande-client/generateFacturePdf');
const sendFactureToClient = require('../services/commande-client/sendFactureToClient');
const creerAvoirSurFacture = require('../services/commande-client/creerAvoirSurFacture');
const getAvoirHtml = require('../services/commande-client/getAvoirHtml');
const generateAvoirPdf = require('../services/commande-client/generateAvoirPdf');
const sendAvoirToClient = require('../services/commande-client/sendAvoirToClient');
const setAvoirRembourse = require('../services/commande-client/setAvoirRembourse');
const sendCommandeClientToClient = require('../services/commande-client/sendCommandeClientToClient');
const validateCommandeGdri = require('../services/commande-client/validateCommandeGdri');
const genererAchatsCommande = require('../services/commande-client/genererAchatsCommande');
const envoyerAchatsCommande = require('../services/commande-client/envoyerAchatsCommande');
const confirmerReceptionAchats = require('../services/commande-client/confirmerReceptionAchats');
const enregistrerReceptionFournisseurCommande = require('../services/commande-client/enregistrerReceptionFournisseurCommande');
const applyReceptionFournisseurSideEffects = require('../services/commande-client/applyReceptionFournisseurSideEffects');
const validateRecetteCommande = require('../services/commande-client/validateRecetteCommande');
const createBonLivraison = require('../services/bon-livraison/createBonLivraison');
const listBonsLivraison = require('../services/bon-livraison/listBonsLivraison');
const generateBonLivraisonPdf = require('../services/bon-livraison/generateBonLivraisonPdf');
const getBonLivraisonHtml = require('../services/bon-livraison/getBonLivraisonHtml');
const getCommandeClientHtml = require('../services/commande-client/getCommandeClientHtml');
const generateCommandeClientPdf = require('../services/commande-client/generateCommandeClientPdf');
const getCommandeFournisseurHtml = require('../services/commande-fournisseur/getCommandeFournisseurHtml');
const generateCommandeFournisseurPdf = require('../services/commande-fournisseur/generateCommandeFournisseurPdf');
const createFromCommandeClient = require('../services/commande-fournisseur/createFromCommandeClient');
const listCommandesFournisseur = require('../services/commande-fournisseur/listCommandesFournisseur');
const getCommandeFournisseurById = require('../services/commande-fournisseur/getCommandeFournisseurById');
const updateCommandeFournisseurStatus = require('../services/commande-fournisseur/updateCommandeFournisseurStatus');
const createCommandeFournisseur = require('../services/commande-fournisseur/createCommandeFournisseur');
const updateCommandeFournisseur = require('../services/commande-fournisseur/updateCommandeFournisseur');
const enregistrerReceptionFournisseur = require('../services/commande-fournisseur/enregistrerReceptionFournisseur');
const sendCommandeFournisseurToFournisseur = require('../services/commande-fournisseur/sendCommandeFournisseurToFournisseur');
const { sendEmailSuccess, sendEmailErrorStatus } = require('../services/mail/sendEmailHttpResponse');
const setCommandeFournisseurReglee = require('../services/commande-fournisseur/setCommandeFournisseurReglee');

async function devisToCommandeClient(req, res) {
  try {
    const item = await createFromDevis(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow devisToCommandeClient:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur transformation devis' });
  }
}

async function createCommandeClientHandler(req, res) {
  try {
    const item = await createCommandeClient(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow createCommandeClient:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création commande client' });
  }
}

async function listCommandesClientHandler(req, res) {
  try {
    const data = await listCommandesClient(req.entrepriseDb, req.entrepriseId, {
      statut: req.query.statut,
      boutiqueId: req.query.boutiqueId,
      search: req.query.q || req.query.search,
      aFacturer: req.query.aFacturer === '1' || req.query.aFacturer === 'true',
      actives: req.query.actives === '1' || req.query.actives === 'true',
      execution: req.query.execution === '1' || req.query.execution === 'true',
      postFacturation: req.query.postFacturation === '1' || req.query.postFacturation === 'true',
      facturation: req.query.facturation === '1' || req.query.facturation === 'true',
      payee: req.query.payee != null ? String(req.query.payee).trim() : ''
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI workflow listCommandesClient:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getCommandeClient(req, res) {
  try {
    const item = await getCommandeClientById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Commande client introuvable' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow getCommandeClient:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateCommandeClientStatusHandler(req, res) {
  try {
    const statut = req.body?.statut || req.body?.status;
    const item = await updateCommandeClientStatus(req.entrepriseDb, req.entrepriseId, req.params.id, statut);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow updateCommandeClientStatus:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour statut' });
  }
}

async function updateCommandeClientHandler(req, res) {
  try {
    const item = await updateCommandeClient(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow updateCommandeClient:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour commande' });
  }
}

async function facturerCommandeClientHandler(req, res) {
  try {
    const item = await facturerCommandeClient(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.body || {}
    );
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow facturerCommandeClient:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur facturation' });
  }
}

async function setFacturePayeeHandler(req, res) {
  try {
    const payee = req.body?.payee ?? req.body?.paye ?? req.body?.paid;
    const factureId = req.params.factureId || req.body?.factureId || null;
    const item = await setFacturePayee(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      payee,
      factureId
    );
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow setFacturePayee:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour paiement' });
  }
}

async function renderFactureHtmlHandler(req, res) {
  try {
    const factureId = req.params.factureId || req.query.factureId || null;
    const html = await getFactureHtml(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req,
      { factureId }
    );
    res.json({ success: true, data: { html } });
  } catch (error) {
    console.error('GDERPI workflow renderFactureHtml:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération HTML facture' });
  }
}

async function downloadFacturePdf(req, res) {
  try {
    const inline = String(req.query.disposition || '').trim().toLowerCase() === 'inline';
    const factureId = req.params.factureId || req.query.factureId || null;
    const { buffer, filename, contentType } = await generateFacturePdf(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req,
      { factureId }
    );
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
    );
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI workflow downloadFacturePdf:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération PDF facture' });
  }
}

async function sendFactureToClientHandler(req, res) {
  try {
    const data = await sendFactureToClient(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      { ...(req.body || {}), factureId: req.params.factureId || req.body?.factureId },
      req
    );
    sendEmailSuccess(res, data, 'Facture envoyée');
  } catch (error) {
    console.error('GDERPI workflow sendFactureToClient:', error);
    const status = sendEmailErrorStatus(error);
    res.status(status).json({ success: false, message: error.message || 'Erreur envoi facture' });
  }
}

async function creerAvoirSurFactureHandler(req, res) {
  try {
    const item = await creerAvoirSurFacture(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.params.factureId,
      req.body || {}
    );
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow creerAvoirSurFacture:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur émission avoir' });
  }
}

async function renderAvoirHtmlHandler(req, res) {
  try {
    const html = await getAvoirHtml(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req,
      { factureId: req.params.factureId, avoirId: req.params.avoirId }
    );
    res.json({ success: true, data: { html } });
  } catch (error) {
    console.error('GDERPI workflow renderAvoirHtml:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération HTML avoir' });
  }
}

async function downloadAvoirPdf(req, res) {
  try {
    const inline = String(req.query.disposition || '').trim().toLowerCase() === 'inline';
    const { buffer, filename, contentType } = await generateAvoirPdf(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req,
      { factureId: req.params.factureId, avoirId: req.params.avoirId }
    );
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
    );
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI workflow downloadAvoirPdf:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération PDF avoir' });
  }
}

async function sendAvoirToClientHandler(req, res) {
  try {
    const data = await sendAvoirToClient(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      {
        ...(req.body || {}),
        factureId: req.params.factureId || req.body?.factureId,
        avoirId: req.params.avoirId || req.body?.avoirId
      },
      req
    );
    sendEmailSuccess(res, data, 'Avoir envoyé');
  } catch (error) {
    console.error('GDERPI workflow sendAvoirToClient:', error);
    const status = sendEmailErrorStatus(error);
    res.status(status).json({ success: false, message: error.message || 'Erreur envoi avoir' });
  }
}

async function setAvoirRembourseHandler(req, res) {
  try {
    const rembourse = req.body?.rembourse ?? req.body?.remboursement ?? true;
    const item = await setAvoirRembourse(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.params.factureId,
      req.params.avoirId,
      rembourse
    );
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow setAvoirRembourse:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour remboursement' });
  }
}

async function sendCommandeClientToClientHandler(req, res) {
  try {
    const data = await sendCommandeClientToClient(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.body || {},
      req
    );
    sendEmailSuccess(res, data, 'Accusé de réception envoyé');
  } catch (error) {
    console.error('GDERPI workflow sendCommandeClientToClient:', error);
    const status = sendEmailErrorStatus(error);
    res.status(status).json({ success: false, message: error.message || 'Erreur envoi accusé de réception' });
  }
}

async function validateRecetteHandler(req, res) {
  try {
    const item = await validateRecetteCommande(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.body || {}
    );
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow validateRecette:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur enregistrement livraison prestation' });
  }
}

async function validateCommandeGdriHandler(req, res) {
  try {
    const item = await validateCommandeGdri(req.entrepriseDb, req.entrepriseId, req.params.id);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow validateCommandeGdri:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur validation GDRI' });
  }
}

async function genererAchatsHandler(req, res) {
  try {
    const data = await genererAchatsCommande(req.entrepriseDb, req.entrepriseId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI workflow genererAchats:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur génération achats' });
  }
}

async function envoyerAchatsHandler(req, res) {
  try {
    const item = await envoyerAchatsCommande(req.entrepriseDb, req.entrepriseId, req.params.id, req);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow envoyerAchats:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur envoi achats' });
  }
}

async function confirmerReceptionHandler(req, res) {
  try {
    const item = await confirmerReceptionAchats(req.entrepriseDb, req.entrepriseId, req.params.id);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow confirmerReception:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur confirmation réception' });
  }
}

async function enregistrerReceptionFournisseurCommandeHandler(req, res) {
  try {
    const item = await enregistrerReceptionFournisseurCommande(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.body || {}
    );
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow enregistrerReceptionFournisseurCommande:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur réception fournisseur' });
  }
}

async function enregistrerReceptionFournisseurHandler(req, res) {
  try {
    const item = await enregistrerReceptionFournisseur(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.body || {}
    );
    if (item?.commandeClientId) {
      await applyReceptionFournisseurSideEffects(req.entrepriseDb, req.entrepriseId, item.commandeClientId);
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow enregistrerReceptionFournisseur:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur réception fournisseur' });
  }
}

async function listBonsLivraisonHandler(req, res) {
  try {
    const data = await listBonsLivraison(req.entrepriseDb, req.entrepriseId, {
      commandeClientId: req.params.id
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI workflow listBonsLivraison:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function listAllBonsLivraisonHandler(req, res) {
  try {
    const data = await listBonsLivraison(req.entrepriseDb, req.entrepriseId, {
      search: req.query.q || req.query.search,
      boutiqueId: req.query.boutiqueId
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI workflow listAllBonsLivraison:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function createBonLivraisonHandler(req, res) {
  try {
    const item = await createBonLivraison(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.body || {}
    );
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow createBonLivraison:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur création BL' });
  }
}

async function renderBonLivraisonHtmlHandler(req, res) {
  try {
    const html = await getBonLivraisonHtml(req.entrepriseDb, req.entrepriseId, req.params.id, req);
    res.json({ success: true, data: { html } });
  } catch (error) {
    console.error('GDERPI workflow renderBonLivraisonHtml:', error);
    const status = error.message === 'Bon de livraison introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération HTML BL' });
  }
}

async function downloadBonLivraisonPdf(req, res) {
  try {
    const inline = String(req.query.disposition || '').trim().toLowerCase() === 'inline';
    const { buffer, filename, contentType } = await generateBonLivraisonPdf(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req
    );
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
    );
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI workflow downloadBonLivraisonPdf:', error);
    const status = error.message === 'Bon de livraison introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération PDF BL' });
  }
}

async function renderCommandeClientHtmlHandler(req, res) {
  try {
    const html = await getCommandeClientHtml(req.entrepriseDb, req.entrepriseId, req.params.id, req);
    res.json({ success: true, data: { html } });
  } catch (error) {
    console.error('GDERPI workflow renderCommandeClientHtml:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération HTML commande client' });
  }
}

async function downloadCommandeClientPdf(req, res) {
  try {
    const inline = String(req.query.disposition || '').trim().toLowerCase() === 'inline';
    const { buffer, filename, contentType } = await generateCommandeClientPdf(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req
    );
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
    );
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI workflow downloadCommandeClientPdf:', error);
    const status = error.message === 'Commande client introuvable' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération PDF commande client' });
  }
}

async function renderCommandeFournisseurHtmlHandler(req, res) {
  try {
    const html = await getCommandeFournisseurHtml(req.entrepriseDb, req.entrepriseId, req.params.id, req);
    res.json({ success: true, data: { html } });
  } catch (error) {
    console.error('GDERPI workflow renderCommandeFournisseurHtml:', error);
    const status = error.message === 'Commande fournisseur introuvable' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération HTML commande fournisseur' });
  }
}

async function downloadCommandeFournisseurPdf(req, res) {
  try {
    const inline = String(req.query.disposition || '').trim().toLowerCase() === 'inline';
    const { buffer, filename, contentType } = await generateCommandeFournisseurPdf(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req
    );
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
    );
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI workflow downloadCommandeFournisseurPdf:', error);
    const status = error.message === 'Commande fournisseur introuvable' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message || 'Erreur génération PDF commande fournisseur' });
  }
}

async function toCommandesFournisseur(req, res) {
  try {
    const data = await genererAchatsCommande(req.entrepriseDb, req.entrepriseId, req.params.id);
    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('GDERPI workflow toCommandesFournisseur:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création commandes fournisseur' });
  }
}

async function listCommandesFournisseurHandler(req, res) {
  try {
    const data = await listCommandesFournisseur(req.entrepriseDb, req.entrepriseId, {
      statut: req.query.statut,
      fournisseurId: req.query.fournisseurId,
      commandeClientId: req.query.commandeClientId,
      search: req.query.q || req.query.search,
      enAttente: req.query.enAttente === '1' || req.query.enAttente === 'true',
      reglee: req.query.reglee != null ? String(req.query.reglee).trim() : ''
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GDERPI workflow listCommandesFournisseur:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function getCommandeFournisseur(req, res) {
  try {
    const item = await getCommandeFournisseurById(req.entrepriseDb, req.entrepriseId, req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Commande fournisseur introuvable' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow getCommandeFournisseur:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}

async function updateCommandeFournisseurStatusHandler(req, res) {
  try {
    const statut = req.body?.statut || req.body?.status;
    const sendEmail = req.body?.sendEmail !== false;
    const item = await updateCommandeFournisseurStatus(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      statut,
      { req, sendEmail, emailPayload: req.body || {} }
    );
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow updateCommandeFournisseurStatus:', error);
    const status = sendEmailErrorStatus(error);
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour statut' });
  }
}

async function sendCommandeFournisseurHandler(req, res) {
  try {
    const data = await sendCommandeFournisseurToFournisseur(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      req.body || {},
      req
    );
    sendEmailSuccess(res, data, 'E-mail envoyé au fournisseur');
  } catch (error) {
    console.error('GDERPI workflow sendCommandeFournisseur:', error);
    const status = sendEmailErrorStatus(error);
    res.status(status).json({ success: false, message: error.message || 'Erreur envoi e-mail fournisseur' });
  }
}

async function createCommandeFournisseurHandler(req, res) {
  try {
    const item = await createCommandeFournisseur(req.entrepriseDb, req.entrepriseId, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow createCommandeFournisseur:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur création commande fournisseur' });
  }
}

async function setCommandeFournisseurRegleeHandler(req, res) {
  try {
    const reglee = req.body?.reglee ?? req.body?.regle ?? req.body?.payee ?? req.body?.paid;
    const item = await setCommandeFournisseurReglee(
      req.entrepriseDb,
      req.entrepriseId,
      req.params.id,
      reglee
    );
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow setCommandeFournisseurReglee:', error);
    const status = error.message === 'Commande fournisseur introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour règlement' });
  }
}

async function updateCommandeFournisseurHandler(req, res) {
  try {
    const item = await updateCommandeFournisseur(req.entrepriseDb, req.entrepriseId, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GDERPI workflow updateCommandeFournisseur:', error);
    const status = error.message === 'Commande fournisseur introuvable' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message || 'Erreur mise à jour commande fournisseur' });
  }
}

module.exports = {
  devisToCommandeClient,
  createCommandeClient: createCommandeClientHandler,
  listCommandesClient: listCommandesClientHandler,
  getCommandeClient,
  updateCommandeClient: updateCommandeClientHandler,
  updateCommandeClientStatus: updateCommandeClientStatusHandler,
  facturerCommandeClient: facturerCommandeClientHandler,
  setFacturePayee: setFacturePayeeHandler,
  renderFactureHtml: renderFactureHtmlHandler,
  downloadFacturePdf,
  sendFactureToClient: sendFactureToClientHandler,
  creerAvoirSurFacture: creerAvoirSurFactureHandler,
  renderAvoirHtml: renderAvoirHtmlHandler,
  downloadAvoirPdf,
  sendAvoirToClient: sendAvoirToClientHandler,
  setAvoirRembourse: setAvoirRembourseHandler,
  sendCommandeClientToClient: sendCommandeClientToClientHandler,
  validateRecette: validateRecetteHandler,
  validateCommandeGdri: validateCommandeGdriHandler,
  genererAchats: genererAchatsHandler,
  envoyerAchats: envoyerAchatsHandler,
  confirmerReception: confirmerReceptionHandler,
  enregistrerReceptionFournisseurCommande: enregistrerReceptionFournisseurCommandeHandler,
  listBonsLivraison: listBonsLivraisonHandler,
  listAllBonsLivraison: listAllBonsLivraisonHandler,
  createBonLivraison: createBonLivraisonHandler,
  renderBonLivraisonHtml: renderBonLivraisonHtmlHandler,
  downloadBonLivraisonPdf,
  renderCommandeClientHtml: renderCommandeClientHtmlHandler,
  downloadCommandeClientPdf,
  toCommandesFournisseur,
  listCommandesFournisseur: listCommandesFournisseurHandler,
  createCommandeFournisseur: createCommandeFournisseurHandler,
  getCommandeFournisseur,
  updateCommandeFournisseur: updateCommandeFournisseurHandler,
  updateCommandeFournisseurStatus: updateCommandeFournisseurStatusHandler,
  setCommandeFournisseurReglee: setCommandeFournisseurRegleeHandler,
  sendCommandeFournisseur: sendCommandeFournisseurHandler,
  enregistrerReceptionFournisseur: enregistrerReceptionFournisseurHandler,
  renderCommandeFournisseurHtml: renderCommandeFournisseurHtmlHandler,
  downloadCommandeFournisseurPdf
};
