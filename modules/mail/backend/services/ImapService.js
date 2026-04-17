/**
 * ImapService - Gestion de la réception d'emails via IMAP
 * Fichier : backend/modules/mail/services/ImapService.js
 *
 * Objectif initial :
 * - fournir une brique générique pour se connecter en IMAP (ex. OVH) et tester la connexion
 * - permettre ensuite à d'autres modules (newsletter → posts Facebook, etc.) de récupérer les messages
 */

const { ImapFlow } = require('imapflow');

class ImapService {
  constructor(database) {
    this.database = database;
  }

  /**
   * Normalise une config IMAP venant de mail_configs.config.imap_config
   * @param {Object} rawConfig
   * @returns {{host:string, port:number, secure:boolean, auth:{user:string, pass:string}, mailbox:string}}
   */
  normalizeConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') {
      throw new Error('Configuration IMAP invalide ou manquante');
    }

    const host = rawConfig.host || rawConfig.server || rawConfig.hostname;
    const port = rawConfig.port != null ? Number(rawConfig.port) : 993;
    // OVH : SSL/TLS sur 993
    const secure = rawConfig.secure != null ? Boolean(rawConfig.secure) : true;
    const user = rawConfig.user || rawConfig.username || rawConfig.login;
    const pass = rawConfig.password || rawConfig.pass;
    const mailbox = rawConfig.mailbox || rawConfig.folder || 'INBOX';

    if (!host || !user || !pass) {
      throw new Error('Configuration IMAP incomplète (host, user, password requis)');
    }

    return {
      host,
      port,
      secure,
      auth: { user, pass },
      mailbox
    };
  }

  /**
   * Teste simplement la connexion IMAP (sans rien lire).
   * @param {Object} rawConfig - imap_config brut depuis Mongo
   * @returns {Promise<{success:boolean, message:string}>}
   */
  async testConnection(rawConfig) {
    let client;
    try {
      const cfg = this.normalizeConfig(rawConfig);
      client = new ImapFlow({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth
      });

      await client.connect();
      // Verrouiller la mailbox juste pour vérifier l'accès
      await client.getMailboxLock(cfg.mailbox);
      await client.logout();

      return {
        success: true,
        message: `Connexion IMAP OK sur ${cfg.host}:${cfg.port}, boîte ${cfg.mailbox}`
      };
    } catch (error) {
      if (client) {
        try {
          await client.logout();
        } catch (_) {
          // ignore
        }
      }
      return {
        success: false,
        message: `Erreur IMAP: ${error.message}`
      };
    }
  }
}

module.exports = ImapService;

