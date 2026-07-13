/**
 * Classe de base pour tous les connecteurs GDRI.
 * Fichier : backend/core/connectors/BaseConnector.js
 */

const { mapToCanonical } = require('./canonical-message');

class BaseConnector {
  /**
   * @param {Object} manifest - connector.json
   */
  constructor(manifest) {
    if (!manifest || !manifest.id) {
      throw new Error('Connecteur invalide : manifest.id requis');
    }
    this.manifest = manifest;
  }

  get id() {
    return this.manifest.id;
  }

  /**
   * @param {Object} ctx
   * @returns {Promise<{success:boolean, message:string, details?:Object}>}
   */
  async testConnection(ctx) {
    return {
      success: false,
      message: `testConnection non implémenté pour ${this.id}`
    };
  }

  /**
   * @param {Object} ctx
   * @param {import('express').Request} req
   * @returns {Promise<Object[]>} messages canoniques
   */
  async ingestPush(ctx, req) {
    return [];
  }

  /**
   * @param {Object} ctx
   * @param {Object|null} cursor
   * @returns {Promise<{messages:Object[], cursor:Object|null}>}
   */
  async ingestPoll(ctx, cursor = null) {
    return { messages: [], cursor };
  }

  /**
   * @param {Object} ctx
   * @param {string} operation
   * @param {Object} payload
   * @returns {Promise<{success:boolean, message?:string, data?:Object}>}
   */
  async emit(ctx, operation, payload = {}) {
    return {
      success: false,
      message: `emit.${operation} non implémenté pour ${this.id}`
    };
  }

  /**
   * @param {Object} raw
   * @param {Object} mapping
   * @param {Object} base
   * @returns {Object}
   */
  normalize(raw, mapping, base = {}) {
    return mapToCanonical(raw, mapping, base);
  }

  /**
   * @param {Object} ctx
   * @returns {boolean}
   */
  supports(capability) {
    const caps = Array.isArray(this.manifest.capabilities) ? this.manifest.capabilities : [];
    return caps.includes(capability);
  }
}

module.exports = { BaseConnector };
