/**
 * Moteur de routing intelligent - Détermine profil SMTP et destinataire selon contexte
 * Fichier : backend/modules/mail/services/RoutingEngine.js
 */

class RoutingEngine {
  constructor() {
    this.routingRules = [];
  }

  /**
   * Configure les règles de routing pour un module
   * @param {Array} rules - Array de règles de routing
   * @example
   * [
   *   {
   *     condition: { priority: 'high', category: 'alert' },
   *     use_profile: 'alerts',
   *     default_to: 'admin@entite.fr'
   *   }
   * ]
   */
  setRules(rules) {
    this.routingRules = rules || [];
  }

  /**
   * Ajoute une règle de routing
   * @param {Object} rule - Règle à ajouter
   */
  addRule(rule) {
    this.routingRules.push(rule);
  }

  /**
   * Évalue si un contexte correspond à une condition
   * @param {Object} context - Contexte à évaluer
   * @param {Object} condition - Condition à vérifier
   * @returns {boolean} True si le contexte correspond
   */
  matchesCondition(context, condition) {
    for (const [key, value] of Object.entries(condition)) {
      if (context[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Détermine le profil SMTP et le destinataire selon le contexte
   * @param {Object} options - Options
   * @param {Object} options.context - Contexte de l'email
   * @param {string} options.profile - Profil explicitement demandé (optionnel)
   * @param {string} options.to - Destinataire explicitement fourni (optionnel)
   * @returns {Object} { profile: String, to: String }
   */
  route({ context = {}, profile = null, to = null }) {
    // Si profil et destinataire explicitement fournis, les utiliser
    if (profile && to) {
      return { profile, to };
    }

    // Chercher une règle qui correspond au contexte
    for (const rule of this.routingRules) {
      if (rule.condition && this.matchesCondition(context, rule.condition)) {
        return {
          profile: rule.use_profile || profile,
          to: rule.default_to || to
        };
      }
    }

    // Aucune règle ne correspond, retourner les valeurs par défaut
    return {
      profile: profile || null, // Doit être fourni explicitement
      to: to || null // Doit être fourni explicitement
    };
  }

  /**
   * Réinitialise les règles de routing
   */
  reset() {
    this.routingRules = [];
  }
}

module.exports = RoutingEngine;

