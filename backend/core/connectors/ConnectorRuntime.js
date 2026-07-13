/**
 * Runtime connecteur — exécute ingest/emit pour une instance.
 * Fichier : backend/core/connectors/ConnectorRuntime.js
 */

const connectorRegistry = require('./ConnectorRegistry');
const { createCanonicalMessage } = require('./canonical-message');

class ConnectorRuntime {
  constructor(database) {
    this.database = database;
  }

  buildContext(instance) {
    return {
      entrepriseId: instance.entrepriseId,
      instance,
      secrets: instance.credentials || {},
      database: this.database
    };
  }

  getConnector(connectorId) {
    const entry = connectorRegistry.get(connectorId);
    if (!entry) {
      throw new Error(`Connecteur inconnu : ${connectorId}`);
    }
    return entry.instance;
  }

  /**
   * @param {Object} instance
   * @param {import('express').Request} req
   * @returns {Promise<Object[]>}
   */
  async ingestPush(instance, req) {
    const connector = this.getConnector(instance.connectorId);
    const ctx = this.buildContext(instance);
    const messages = await connector.ingestPush(ctx, req);
    return this.finalizeMessages(messages, instance);
  }

  /**
   * @param {Object} instance
   * @returns {Promise<{messages:Object[], cursor:Object|null}>}
   */
  async ingestPoll(instance) {
    const connector = this.getConnector(instance.connectorId);
    const ctx = this.buildContext(instance);
    const result = await connector.ingestPoll(ctx, instance.cursor || null);
    const messages = this.finalizeMessages(result.messages || [], instance);
    return {
      messages,
      cursor: result.cursor != null ? result.cursor : instance.cursor
    };
  }

  /**
   * @param {Object} instance
   * @returns {Promise<{success:boolean, message:string}>}
   */
  async testConnection(instance) {
    const connector = this.getConnector(instance.connectorId);
    const ctx = this.buildContext(instance);
    return connector.testConnection(ctx);
  }

  /**
   * @param {Object} instance
   * @param {string} operation
   * @param {Object} payload
   */
  async emit(instance, operation, payload) {
    const connector = this.getConnector(instance.connectorId);
    const ctx = this.buildContext(instance);
    return connector.emit(ctx, operation, payload);
  }

  finalizeMessages(messages, instance) {
    const list = Array.isArray(messages) ? messages : [messages];
    return list
      .filter(Boolean)
      .map((msg) => {
        const base = createCanonicalMessage({
          ...msg,
          source: msg.source || instance.connectorId,
          entrepriseId: instance.entrepriseId,
          instanceId: instance._id
        });
        return base;
      });
  }
}

module.exports = { ConnectorRuntime };
