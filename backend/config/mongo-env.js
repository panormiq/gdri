/**
 * Résolution de la config MongoDB via variables d'environnement.
 * Permet de faire coexister un backend prod (:3000) et un backend test (:3001).
 */

const DEFAULT_DB = 'GDR-INNOVATION';
const DEFAULT_USER = 'gdri_admin';
const DEFAULT_PASSWORD = 'gdri2024';
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = '27017';

function resolveMongoConfig() {
  const database = process.env.MONGODB_DB || DEFAULT_DB;
  const user = process.env.MONGODB_USER || DEFAULT_USER;
  const password = process.env.MONGODB_PASSWORD || DEFAULT_PASSWORD;
  const host = process.env.MONGODB_HOST || DEFAULT_HOST;
  const port = process.env.MONGODB_PORT || DEFAULT_PORT;
  // L'utilisateur gdri_admin vit en général dans GDR-INNOVATION (authSource),
  // même si la base applicative est GDR-INNOVATION-TEST.
  const authSource = process.env.MONGODB_AUTH_SOURCE || DEFAULT_DB;

  const uri =
    process.env.MONGODB_URI ||
    `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=${encodeURIComponent(authSource)}`;

  return {
    uri,
    database,
    user,
    password,
    host,
    port,
    authSource,
    entreprisePrefix: process.env.MONGODB_ENTREPRISE_PREFIX || 'GDR-ENTREPRISE-'
  };
}

module.exports = { resolveMongoConfig, DEFAULT_DB };
