/**
 * Script one-shot : passer un utilisateur en admin (ADMIN_ENTITY ou ADMIN_GDRI).
 * Usage :
 *   node set-user-role.js <email> [ADMIN_ENTITY|ADMIN_GDRI]   → met à jour le rôle
 *   node set-user-role.js <email> --check                     → affiche le rôle actuel (vérif en base)
 *
 * Exemple : node set-user-role.js user@example.com ADMIN_ENTITY
 * Puis déconnexion + reconnexion sur le site pour que la session prenne le nouveau rôle.
 */

const path = require('path');
const database = require(path.join(__dirname, '../config/database'));

const email = (process.argv[2] || '').trim();
const arg2 = (process.argv[3] || '').trim();
const roleArg = arg2.toUpperCase();
const isCheck = arg2.toLowerCase() === '--check';

const VALID_ROLES = ['ADMIN_ENTITY', 'ADMIN_GDRI'];

if (!email) {
  console.error('Usage: node set-user-role.js <email> [ADMIN_ENTITY|ADMIN_GDRI]');
  console.error('       node set-user-role.js <email> --check');
  process.exit(1);
}

if (!isCheck && roleArg && !VALID_ROLES.includes(roleArg)) {
  console.error('Rôle invalide. Utiliser ADMIN_ENTITY ou ADMIN_GDRI.');
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
