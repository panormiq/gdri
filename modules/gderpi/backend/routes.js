/**
 * FICHIER : modules/gderpi/backend/routes.js
 * RÔLE : Routes API GDERPI — boutiques, nœuds, articles, clients, fournisseurs.
 *
 * ENTRÉES : requêtes HTTP authentifiées
 * SORTIES : réponses JSON
 *
 * DÉPEND DE : middleware/, controllers/
 * NE PAS : logique métier inline
 *
 * APPELÉ PAR : backend/index.js
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const { useGderpiEntrepriseDb } = require('./middleware/useGderpiEntrepriseDb');
const { requireGderpiRole } = require('./middleware/requireGderpiRole');
const nodesController = require('./controllers/nodesController');
const articlesController = require('./controllers/articlesController');
const clientsController = require('./controllers/clientsController');
const fournisseursController = require('./controllers/fournisseursController');
const boutiquesController = require('./controllers/boutiquesController');
const dashboardController = require('./controllers/dashboardController');
const uploadController = require('./controllers/uploadController');
const mediaController = require('./controllers/mediaController');
const unitesController = require('./controllers/unitesController');
const clientServicesController = require('./controllers/clientServicesController');
const devisController = require('./controllers/devisController');
const integrationsController = require('./controllers/integrationsController');
const workflowController = require('./controllers/workflowController');
const mailSettingsController = require('./controllers/mailSettingsController');
const publicController = require('./controllers/publicController');
const { useGderpiPublicEntrepriseDb } = require('./middleware/useGderpiPublicEntrepriseDb');
const { createGderpiImageUpload } = require('./middleware/createGderpiImageUpload');
const { handleGderpiImageUploadError } = require('./middleware/handleGderpiImageUploadError');
const { createGderpiDocumentUpload } = require('./middleware/createGderpiDocumentUpload');
const { handleGderpiDocumentUploadError } = require('./middleware/handleGderpiDocumentUploadError');

const gderpiImageUpload = handleGderpiImageUploadError(createGderpiImageUpload().single('file'));
const gderpiDocumentUpload = handleGderpiDocumentUploadError(createGderpiDocumentUpload().single('file'));

router.get(
  '/public/cgv/:entrepriseId/:boutiqueSlug',
  useGderpiPublicEntrepriseDb,
  publicController.renderBoutiqueCgv
);
router.get(
  '/public/cgv/:entrepriseId/:boutiqueSlug/pdf',
  useGderpiPublicEntrepriseDb,
  publicController.downloadBoutiqueCgvPdf
);
router.get(
  '/public/devis/:entrepriseId/html',
  useGderpiPublicEntrepriseDb,
  publicController.viewDevisHtml
);
router.get(
  '/public/devis/:entrepriseId/pdf',
  useGderpiPublicEntrepriseDb,
  publicController.downloadDevisPdf
);
router.get(
  '/public/commande-client/:entrepriseId/html',
  useGderpiPublicEntrepriseDb,
  publicController.viewCommandeClientHtml
);
router.get(
  '/public/commande-client/:entrepriseId/pdf',
  useGderpiPublicEntrepriseDb,
  publicController.downloadCommandeClientPdf
);
router.get(
  '/public/commande-fournisseur/:entrepriseId/html',
  useGderpiPublicEntrepriseDb,
  publicController.viewCommandeFournisseurHtml
);
router.get(
  '/public/commande-fournisseur/:entrepriseId/pdf',
  useGderpiPublicEntrepriseDb,
  publicController.downloadCommandeFournisseurPdf
);
router.get(
  '/public/facture/:entrepriseId/html',
  useGderpiPublicEntrepriseDb,
  publicController.viewFactureHtml
);
router.get(
  '/public/facture/:entrepriseId/pdf',
  useGderpiPublicEntrepriseDb,
  publicController.downloadFacturePdf
);
router.get(
  '/public/avoir/:entrepriseId/html',
  useGderpiPublicEntrepriseDb,
  publicController.viewAvoirHtml
);
router.get(
  '/public/avoir/:entrepriseId/pdf',
  useGderpiPublicEntrepriseDb,
  publicController.downloadAvoirPdf
);
router.get(
  '/public/devis/:entrepriseId/accept',
  useGderpiPublicEntrepriseDb,
  publicController.showDevisAcceptPage
);
router.post(
  '/public/devis/:entrepriseId/accept',
  useGderpiPublicEntrepriseDb,
  publicController.submitDevisAccept
);

const readRoles = ['USER_ENTITY', 'ADMIN_ENTITY'];
const writeRoles = ['USER_ENTITY', 'ADMIN_ENTITY'];

router.get('/health', authenticateJWT, useGderpiEntrepriseDb, (req, res) => {
  res.json({
    success: true,
    message: 'Module GDERPI fonctionnel',
    version: '0.1.0',
    entrepriseId: req.entrepriseId
  });
});

router.get('/integrations/pm/status', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), integrationsController.pmStatus);
router.get('/integrations/annuaire/status', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), integrationsController.annuaireStatus);
router.get('/integrations/pm/cards', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), integrationsController.listPmCards);
router.get('/integrations/pm/cards/:cardId', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), integrationsController.getPmCard);

router.get('/dashboard', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), dashboardController.getSummary);

router.get('/media/:entrepriseId/:scope/:filename', mediaController.serveMedia);

router.post(
  '/uploads/image',
  authenticateJWT,
  useGderpiEntrepriseDb,
  requireGderpiRole(writeRoles),
  gderpiImageUpload,
  uploadController.uploadImage
);

// Boutiques (paramétrage backoffice)
router.get('/boutiques', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), boutiquesController.list);
router.get('/boutiques/conditions-templates', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), boutiquesController.getConditionsTemplates);
router.get('/boutiques/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), boutiquesController.getById);
router.post('/boutiques', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), boutiquesController.create);
router.put('/boutiques/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), boutiquesController.update);
router.delete('/boutiques/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), boutiquesController.remove);

// Nœuds catalogue (catégories — structure compatible UGAP nodes[])
router.get('/nodes', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), nodesController.list);
router.post('/nodes', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), nodesController.create);
router.put('/nodes/reorder', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), nodesController.reorder);
router.put('/nodes/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), nodesController.update);
router.delete('/nodes/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), nodesController.remove);

// Articles (produits + services)
router.get('/articles', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), articlesController.list);
router.get('/articles/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), articlesController.getById);
router.post('/articles', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), articlesController.create);
router.put('/articles/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), articlesController.update);
router.delete('/articles/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), articlesController.remove);

// Unités de mesure (configuration catalogue)
router.get('/unites', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), unitesController.list);
router.get('/unites/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), unitesController.getById);
router.post('/unites', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), unitesController.create);
router.put('/unites/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), unitesController.update);
router.delete('/unites/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), unitesController.remove);

// Services clients (contacts entreprise)
router.get('/client-services', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), clientServicesController.list);
router.get('/client-services/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), clientServicesController.getById);
router.post('/client-services', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), clientServicesController.create);
router.put('/client-services/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), clientServicesController.update);
router.delete('/client-services/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), clientServicesController.remove);

// Clients
router.get('/clients', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), clientsController.list);
router.get('/clients/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), clientsController.getById);
router.post('/clients', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), clientsController.create);
router.put('/clients/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), clientsController.update);
router.post(
  '/clients/:id/documents',
  authenticateJWT,
  useGderpiEntrepriseDb,
  requireGderpiRole(writeRoles),
  gderpiDocumentUpload,
  clientsController.addDocument
);
router.delete(
  '/clients/:id/documents/:docId',
  authenticateJWT,
  useGderpiEntrepriseDb,
  requireGderpiRole(writeRoles),
  clientsController.removeDocument
);
router.delete('/clients/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), clientsController.remove);

// Fournisseurs
router.get('/fournisseurs', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), fournisseursController.list);
router.get('/fournisseurs/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), fournisseursController.getById);
router.post('/fournisseurs', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), fournisseursController.create);
router.put('/fournisseurs/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), fournisseursController.update);
router.post(
  '/fournisseurs/:id/documents',
  authenticateJWT,
  useGderpiEntrepriseDb,
  requireGderpiRole(writeRoles),
  gderpiDocumentUpload,
  fournisseursController.addDocument
);
router.delete(
  '/fournisseurs/:id/documents/:docId',
  authenticateJWT,
  useGderpiEntrepriseDb,
  requireGderpiRole(writeRoles),
  fournisseursController.removeDocument
);
router.delete('/fournisseurs/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), fournisseursController.remove);

// Paramètres e-mail devis
router.get('/settings/mail', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), mailSettingsController.get);
router.put('/settings/mail', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), mailSettingsController.save);
router.post('/settings/mail/preview', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), mailSettingsController.preview);
router.get('/settings/mail-accounts', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), mailSettingsController.getAccounts);
router.put('/settings/mail-accounts', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), mailSettingsController.saveAccounts);
router.get('/mail/send-recipient', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), mailSettingsController.getSendRecipient);
router.get('/mail/contacts', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), mailSettingsController.searchContacts);

// Devis
router.get('/devis', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), devisController.list);
router.get('/devis/:id/html', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), devisController.renderHtml);
router.get('/devis/:id/pdf', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), devisController.downloadPdf);
router.get('/devis/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), devisController.getById);
router.post('/devis', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), devisController.create);
router.put('/devis/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), devisController.update);
router.patch('/devis/:id/pm-link', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), devisController.linkPmCard);
router.patch('/devis/:id/status', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), devisController.changeStatus);
router.post('/devis/:id/send', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), devisController.sendToClient);
router.delete('/devis/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), devisController.remove);

// Workflow commandes & facturation
router.post('/devis/:id/to-commande-client', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.devisToCommandeClient);
router.get('/commandes-client', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.listCommandesClient);
router.get('/commandes-client/:id/html', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.renderCommandeClientHtml);
router.get('/commandes-client/:id/pdf', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.downloadCommandeClientPdf);
router.get('/commandes-client/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.getCommandeClient);
router.put('/commandes-client/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.updateCommandeClient);
router.patch('/commandes-client/:id/status', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.updateCommandeClientStatus);
router.post('/commandes-client/:id/valider-gdri', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.validateCommandeGdri);
router.post('/commandes-client/:id/generer-achats', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.genererAchats);
router.post('/commandes-client/:id/envoyer-achats', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.envoyerAchats);
router.post('/commandes-client/:id/confirmer-reception', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.confirmerReception);
router.post('/commandes-client/:id/reception-fournisseur', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.enregistrerReceptionFournisseurCommande);
router.post('/commandes-client/:id/recette', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.validateRecette);
router.get('/commandes-client/:id/bons-livraison', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.listBonsLivraison);
router.post('/commandes-client/:id/bons-livraison', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.createBonLivraison);
router.get('/bons-livraison', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.listAllBonsLivraison);
router.get('/bons-livraison/:id/html', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.renderBonLivraisonHtml);
router.get('/bons-livraison/:id/pdf', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.downloadBonLivraisonPdf);
router.post('/commandes-client/:id/facturer', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.facturerCommandeClient);
router.patch('/commandes-client/:id/facture/payee', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.setFacturePayee);
router.patch('/commandes-client/:id/factures/:factureId/payee', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.setFacturePayee);
router.get('/commandes-client/:id/facture/html', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.renderFactureHtml);
router.get('/commandes-client/:id/factures/:factureId/html', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.renderFactureHtml);
router.get('/commandes-client/:id/facture/pdf', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.downloadFacturePdf);
router.get('/commandes-client/:id/factures/:factureId/pdf', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.downloadFacturePdf);
router.post('/commandes-client/:id/send', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.sendCommandeClientToClient);
router.post('/commandes-client/:id/facture/send', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.sendFactureToClient);
router.post('/commandes-client/:id/factures/:factureId/send', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.sendFactureToClient);
router.post('/commandes-client/:id/factures/:factureId/avoir', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.creerAvoirSurFacture);
router.get('/commandes-client/:id/factures/:factureId/avoirs/:avoirId/html', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.renderAvoirHtml);
router.get('/commandes-client/:id/factures/:factureId/avoirs/:avoirId/pdf', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.downloadAvoirPdf);
router.post('/commandes-client/:id/factures/:factureId/avoirs/:avoirId/send', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.sendAvoirToClient);
router.patch('/commandes-client/:id/factures/:factureId/avoirs/:avoirId/rembourse', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.setAvoirRembourse);
router.post('/commandes-client/:id/to-commandes-fournisseur', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.toCommandesFournisseur);
router.get('/commandes-fournisseur', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.listCommandesFournisseur);
router.post('/commandes-fournisseur', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.createCommandeFournisseur);
router.get('/commandes-fournisseur/:id/html', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.renderCommandeFournisseurHtml);
router.get('/commandes-fournisseur/:id/pdf', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.downloadCommandeFournisseurPdf);
router.get('/commandes-fournisseur/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(readRoles), workflowController.getCommandeFournisseur);
router.put('/commandes-fournisseur/:id', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.updateCommandeFournisseur);
router.patch('/commandes-fournisseur/:id/status', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.updateCommandeFournisseurStatus);
router.post('/commandes-fournisseur/:id/send', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.sendCommandeFournisseur);
router.post('/commandes-fournisseur/:id/reception', authenticateJWT, useGderpiEntrepriseDb, requireGderpiRole(writeRoles), workflowController.enregistrerReceptionFournisseur);

module.exports = router;
