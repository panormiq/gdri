/**
 * Clone GDR-INNOVATION → GDR-INNOVATION-TEST (base plateforme uniquement).
 * Usage: node scripts/clone-mongo-to-test.js [--drop]
 *
 * Utilise MONGO_ADMIN_USER / MONGO_ADMIN_PASSWORD (backend/.env) pour créer
 * la base test — gdri_admin n'a souvent accès qu'à GDR-INNOVATION.
 *
 * Note: les bases GDR-ENTREPRISE-* restent partagées pour l'instant.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { MongoClient } = require('mongodb');

const SRC = process.env.MONGODB_SRC_DB || 'GDR-INNOVATION';
const DST = process.env.MONGODB_DB || 'GDR-INNOVATION-TEST';
const DROP = process.argv.includes('--drop');

const host = process.env.MONGODB_HOST || 'localhost';
const port = process.env.MONGODB_PORT || '27017';

// Compte admin setup (création de bases) — fallback gdri_admin
const adminUser = process.env.MONGO_ADMIN_USER || process.env.MONGODB_USER || 'gdri_admin';
const adminPassword = process.env.MONGO_ADMIN_PASSWORD || process.env.MONGODB_PASSWORD || 'gdri2024';
const adminAuthSource = process.env.MONGO_ADMIN_AUTH_SOURCE || 'admin';

async function copyCollection(srcDb, dstDb, name) {
  const docs = await srcDb.collection(name).find({}).toArray();
  if (!docs.length) {
    await dstDb.createCollection(name).catch(() => {});
    return 0;
  }
  // Insert par lots pour éviter les gros payloads
  const batchSize = 500;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await dstDb.collection(name).insertMany(batch, { ordered: false });
  }
  return docs.length;
}

async function main() {
  if (SRC === DST) {
    throw new Error('Source et destination identiques — abort.');
  }

  const uri =
    process.env.MONGO_ADMIN_URI ||
    `mongodb://${encodeURIComponent(adminUser)}:${encodeURIComponent(adminPassword)}@${host}:${port}/?authSource=${encodeURIComponent(adminAuthSource)}`;

  console.log(`🔐 Connexion admin (${adminUser}, authSource=${adminAuthSource})`);
  const client = new MongoClient(uri);
  await client.connect();
  const srcDb = client.db(SRC);
  const dstDb = client.db(DST);

  console.log(`📦 Clone Mongo: ${SRC} → ${DST}`);

  if (DROP) {
    console.log(`🗑️  Drop ${DST}...`);
    await dstDb.dropDatabase();
  }

  const collections = await srcDb.listCollections().toArray();
  let total = 0;
  for (const col of collections) {
    const name = col.name;
    if (name.startsWith('system.')) continue;
    // Si la collection existe déjà et --drop n'a pas été passé, on la vide
    const existing = await dstDb.listCollections({ name }).toArray();
    if (existing.length) {
      await dstDb.collection(name).deleteMany({});
    }
    const count = await copyCollection(srcDb, dstDb, name);
    total += count;
    console.log(`  ✓ ${name} (${count} docs)`);
  }

  console.log(`✅ Terminé — ${collections.length} collections, ${total} documents.`);

  // Donner à gdri_admin (authSource GDR-INNOVATION) les droits sur la base test
  const appUser = process.env.MONGODB_USER || 'gdri_admin';
  const appAuthDb = process.env.MONGODB_AUTH_SOURCE || SRC;
  try {
    await client.db(appAuthDb).command({
      grantRolesToUser: appUser,
      roles: [
        { role: 'readWrite', db: DST },
        { role: 'dbAdmin', db: DST }
      ]
    });
    console.log(`🔑 Droits readWrite/dbAdmin accordés à ${appUser}@${appAuthDb} sur ${DST}`);
  } catch (grantErr) {
    console.warn(`⚠️  Impossible d'accorder les droits à ${appUser}@${appAuthDb} sur ${DST}: ${grantErr.message}`);
    console.warn('   Accorde manuellement readWrite, ou connecte le backend test avec le compte admin.');
  }

  console.log('⚠️  Bases entreprise (GDR-ENTREPRISE-*) non clonées — partagées avec la prod.');
  await client.close();
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
