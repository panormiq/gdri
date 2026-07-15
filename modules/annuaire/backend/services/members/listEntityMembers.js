/**
 * FICHIER : modules/annuaire/backend/services/members/listEntityMembers.js
 * Membres entité (pour assignation owner contact — lecture seule, pas d'isolation).
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../../backend/config/database'));
const { findEntityMemberUsers } = require(path.join(__dirname, '../../../../../backend/core/entity-member-users'));

async function listEntityMembers(entrepriseId) {
  const eid = String(entrepriseId || '').trim();
  if (!eid || eid === 'SYSTEM') {
    return [];
  }

  const db = await database.connect();
  const members = await findEntityMemberUsers(db.collection('users'), eid, {
    excludePlatformOperators: true
  });

  return members.map((member) => {
    const label = String(member.name || '').trim()
      || String(member.email || '').trim()
      || member.userId;
    return {
      userId: member.userId,
      email: member.email || '',
      label,
      membershipRole: member.membershipRole || 'user'
    };
  });
}

module.exports = listEntityMembers;
