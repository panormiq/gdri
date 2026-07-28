/**
 * Script one-shot : changer le rôle d'un utilisateur.
 * Usage :
 *   node set-user-role.js <email> [ADMIN_ENTITY|ADMIN_GDRI|DEV|USER_ENTITY]
 *   node set-user-role.js <email> --check
 *
 * Exemple prod stagiaire : node set-user-role.js stagiaire@example.com DEV
 * Exemple test (admin)   : node set-user-role.js stagiaire@example.com ADMIN_GDRI
 *   (sur la base TEST : charger .env.test avant d'exécuter)
 *
 * Puis déconnexion + reconnexion pour prendre le nouveau rôle en session.
 */

const path = require('path');
const envFile = process.env.GDRI_ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const database = require(path.join(__dirname, '../config/database'));

const email = (process.argv[2] || '').trim();
const arg2 = (process.argv[3] || '').trim();
const roleArg = arg2.toUpperCase();
const isCheck = arg2.toLowerCase() === '--check';

const VALID_ROLES = ['ADMIN_ENTITY', 'ADMIN_GDRI', 'DEV', 'USER_ENTITY'];

if (!email) {
  console.error('Usage: node set-user-role.js <email> [ADMIN_ENTITY|ADMIN_GDRI|DEV|USER_ENTITY]');
  console.error('       node set-user-role.js <email> --check');
  process.exit(1);
}

if (!isCheck && roleArg && !VALID_ROLES.includes(roleArg)) {
  console.error('Rôle invalide. Utiliser ADMIN_ENTITY, ADMIN_GDRI, DEV ou USER_ENTITY.');
  process.exit(1);
}

const role = isCheck ? null : (roleArg || 'ADMIN_ENTITY');

async function main() {
  await database.connect();
  const usersCollection = database.getCollection('users');

  const user = await usersCollection.findOne({ email });
  if (!user) {
    console.error('Aucun utilisateur trouvé avec l’email:', email);
    process.exit(1);
  }

  if (isCheck) {
    console.log('--- Utilisateur en base ---');
    console.log('email:', user.email);
    console.log('role (champ global):', user.role || '(non défini)');
    console.log('currentEntrepriseId:', user.currentEntrepriseId ? user.currentEntrepriseId.toString() : '(aucun)');
    console.log('entreprises:', JSON.stringify(user.entreprises || [], null, 2));
    process.exit(0);
  }

  const result = await usersCollection.updateOne(
    { email },
    { $set: { role } }
  );

  if (result.matchedCount === 0) {
    console.error('Aucun utilisateur trouvé avec l’email:', email);
    process.exit(1);
  }
  console.log('OK – Rôle de', email, 'mis à jour vers', role);
  console.log('');
  console.log('Important : déconnecte-toi puis reconnecte-toi sur le site pour que la session prenne le nouveau rôle.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
