/**
 * Modèle Email - Structure de données pour les emails
 * Fichier : backend/modules/mail/models/Email.js
 * 
 * Note: Les templates sont gérés par les modules, pas par le module Mail
 */

/**
 * Structure d'un document Email dans MongoDB
 * 
 * @typedef {Object} EmailDocument
 * @property {ObjectId} _id - ID MongoDB
 * @property {string} module_name - Nom du module émetteur ('mail' si standalone)
 * @property {ObjectId|null} entity_id - ID de l'entité (optionnel)
 * @property {string} profile_used - Profil SMTP utilisé (ex: 'alerts', 'reports')
 * @property {string} to - Destinataire
 * @property {Object} from - { name: String, email: String }
 * @property {string} subject - Sujet
 * @property {string} body - Corps texte
 * @property {string|null} body_html - Corps HTML (optionnel)
 * @property {Array} attachments - Pièces jointes [{ filename: String, path: String }]
 * @property {string} status - 'pending' | 'sent' | 'failed'
 * @property {Date|null} sent_at - Date d'envoi
 * @property {string|null} error - Message d'erreur si échec
 * @property {string|null} message_id - ID du message SMTP
 * @property {Object} context - Contexte de routing
 * @property {Date} created_at - Date de création
 */

/**
 * Crée un document email vide avec les valeurs par défaut
 * @param {Object} data - Données de l'email
 * @returns {EmailDocument}
 */
function createEmailDocument(data) {
  return {
    module_name: data.module_name || 'mail',
    entity_id: data.entity_id || null,
    profile_used: data.profile_used || 'default',
    to: data.to,
    from: data.from || { name: '', email: '' },
    subject: data.subject || '',
    body: data.body || '',
    body_html: data.body_html || null,
    attachments: data.attachments || [],
    status: 'pending',
    sent_at: null,
    error: null,
    message_id: null,
    context: data.context || {},
    created_at: new Date()
  };
}

module.exports = {
  createEmailDocument
};

