const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017';
const dbName = 'mydatabase';

async function getFields(modelName) {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    const schema = await db.collection('collection_schemas').findOne({ collectionName: modelName });
    if (!schema) throw new Error('Schéma non trouvé');

    return schema.fields;
  } finally {
    await client.close();
  }
}

module.exports = { getFields };
