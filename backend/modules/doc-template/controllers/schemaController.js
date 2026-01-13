const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017';
const dbName = 'mydatabase';

async function upsertSchema(collectionName, fields) {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    const existingSchema = await db.collection('collection_schemas').findOne({ collectionName });

    // Créer la collection si elle n'existe pas
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) await db.createCollection(collectionName);

    // Champs supprimés / ajoutés
    const oldFields = existingSchema ? existingSchema.fields.map(f => f.name) : [];
    const newFields = fields.map(f => f.name);
    const removedFields = oldFields.filter(f => !newFields.includes(f));
    const addedFields = newFields.filter(f => !oldFields.includes(f));

    // Mettre à jour le schéma
    await db.collection('collection_schemas').updateOne(
      { collectionName },
      { $set: { fields, updatedAt: new Date() } },
      { upsert: true }
    );

    // Nettoyer les champs supprimés
    if (removedFields.length > 0) {
      const unsetObj = removedFields.reduce((acc, field) => ({ ...acc, [field]: "" }), {});
      await db.collection(collectionName).updateMany({}, { $unset: unsetObj });
    }

    // Initialiser les champs ajoutés
    if (addedFields.length > 0) {
      const setObj = {};
      fields.forEach(f => {
        if (addedFields.includes(f.name)) setObj[f.name] = f.defaultValue ?? null;
      });
      await db.collection(collectionName).updateMany({}, { $set: setObj });
    }

    return { removedFields, addedFields };
  } finally {
    await client.close();
  }
}

module.exports = { upsertSchema };
