/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/commandeStatusTasks.js
 * RÔLE : Tâches PM selon statut commande client GDERPI.
 */

function commandeStatusTasks(statut, extra = {}) {
  const s = String(statut || '').toLowerCase();
  const tasks = [
    { id: 'order_created', label: 'Commande client créée', done: true, autoSource: 'gderpi', autoKey: 'commande_created' }
  ];

  if (['validee_gdri', 'achats_en_cours', 'attente_livraison_frs', 'a_livrer', 'livree', 'a_facturer', 'facturee'].includes(s)) {
    tasks.push({ id: 'gdri_validated', label: 'Commande validée GDRI', done: true, autoSource: 'gderpi', autoKey: 'commande_validee_gdri' });
  }
  if (['a_livrer', 'livree', 'a_facturer', 'facturee'].includes(s)) {
    tasks.push({ id: 'delivery', label: 'Livraison / exécution', done: s === 'livree' || s === 'a_facturer' || s === 'facturee', autoSource: 'gderpi', autoKey: 'commande_livraison' });
  }
  if (s === 'facturee') {
    tasks.push({ id: 'invoiced', label: 'Facturation effectuée', done: true, autoSource: 'gderpi', autoKey: 'commande_facturee' });
    if (extra.facturePayee) {
      tasks.push({ id: 'paid', label: 'Facture payée', done: true, autoSource: 'gderpi', autoKey: 'commande_payee' });
    }
  }
  if (s === 'annulee') {
    tasks.push({ id: 'cancelled', label: 'Commande annulée', done: true, autoSource: 'gderpi', autoKey: 'commande_annulee' });
  }
  return tasks;
}

module.exports = commandeStatusTasks;
