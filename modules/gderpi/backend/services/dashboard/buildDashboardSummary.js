/**
 * FICHIER : modules/gderpi/backend/services/dashboard/buildDashboardSummary.js
 * RÔLE : Agrège compteurs et tâches de suivi pour le tableau de bord GDERPI.
 *
 * ENTRÉES : db, entrepriseId
 * SORTIES : { counts, workflow, tasks }
 *
 * DÉPEND DE : listBoutiques, listArticles, listClients, listFournisseurs
 * NE PAS : persistance
 *
 * APPELÉ PAR : dashboardController
 */

const listBoutiques = require('../boutiques/listBoutiques');
const listArticles = require('../articles/listArticles');
const listClients = require('../clients/listClients');
const listFournisseurs = require('../fournisseurs/listFournisseurs');
const listDevis = require('../devis/listDevis');
const listCommandesFournisseur = require('../commande-fournisseur/listCommandesFournisseur');
const listCommandesClient = require('../commande-client/listCommandesClient');

async function buildDashboardSummary(db, entrepriseId) {
  const [boutiques, articles, clients, fournisseurs, devis, cmdFrs, cmdClientAFacturer, cmdClientActives] = await Promise.all([
    listBoutiques(db, entrepriseId, {}),
    listArticles(db, entrepriseId, {}),
    listClients(db, entrepriseId, {}),
    listFournisseurs(db, entrepriseId, {}),
    listDevis(db, entrepriseId, { statut: 'envoye' }),
    listCommandesFournisseur(db, entrepriseId, { enAttente: true }),
    listCommandesClient(db, entrepriseId, { aFacturer: true }),
    listCommandesClient(db, entrepriseId, { actives: true })
  ]);

  const cmdClientEnCours = cmdClientActives.filter((c) => ['confirmee', 'en_cours'].includes(c.statut)).length;
  const cmdClientAConfirmer = cmdClientActives.filter((c) => c.statut === 'validee_client').length;

  const boutiquesActives = boutiques.filter((b) => b.actif !== false);
  const counts = {
    boutiques: boutiques.length,
    boutiquesActives: boutiquesActives.length,
    articles: articles.length,
    clients: clients.length,
    fournisseurs: fournisseurs.length
  };

  const workflow = {
    devisEnvoyes: devis.length,
    devisEnAttenteReponse: devis.length,
    commandesFournisseurEnAttente: cmdFrs.length,
    facturationAFaire: cmdClientAFacturer.length,
    commandesClientEnCours: cmdClientEnCours,
    commandesClientAConfirmer: cmdClientAConfirmer
  };

  const tasks = [];

  if (boutiquesActives.length === 0) {
    tasks.push({
      id: 'setup-boutique',
      label: 'Configurer au moins une boutique active',
      count: 1,
      tab: 'configuration',
      configTab: 'boutiques',
      priority: 'high'
    });
  }
  if (articles.length === 0) {
    tasks.push({
      id: 'setup-articles',
      label: 'Ajouter des articles au catalogue',
      count: 1,
      tab: 'articles',
      priority: 'high'
    });
  }
  if (clients.length === 0) {
    tasks.push({
      id: 'setup-clients',
      label: 'Enregistrer vos premiers clients',
      count: 1,
      tab: 'clients',
      priority: 'medium'
    });
  }
  if (fournisseurs.length === 0) {
    tasks.push({
      id: 'setup-fournisseurs',
      label: 'Enregistrer vos fournisseurs',
      count: 1,
      tab: 'fournisseurs',
      priority: 'medium'
    });
  }

  tasks.push(
    {
      id: 'wf-devis-envoyes',
      label: 'Devis envoyés en attente de réponse',
      count: workflow.devisEnAttenteReponse,
      tab: 'devis',
      priority: 'medium'
    },
    {
      id: 'wf-cmd-fournisseur',
      label: 'Commandes fournisseur en attente',
      count: workflow.commandesFournisseurEnAttente,
      tab: 'achats',
      priority: 'medium'
    },
    {
      id: 'wf-cmd-client-validee',
      label: 'Commandes validées client à confirmer',
      count: workflow.commandesClientAConfirmer,
      tab: 'commandes',
      priority: 'high'
    },
    {
      id: 'wf-cmd-client',
      label: 'Commandes client en cours',
      count: workflow.commandesClientEnCours,
      tab: 'commandes',
      priority: 'medium'
    },
    {
      id: 'wf-facturation',
      label: 'Facturation à faire',
      count: workflow.facturationAFaire,
      tab: 'facturation',
      priority: 'high'
    }
  );

  return { counts, workflow, tasks };
}

module.exports = buildDashboardSummary;
