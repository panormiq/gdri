/**
 * Routes API pour la gestion des utilisateurs
 * Fichier : backend/routes/users.js
 */

const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { authenticateJWT, signToken, setAuthTokenCookie } = require('../config/jwt');
const Entity = require('../models/Entity');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const mailModule = require(path.join(__dirname, '../../modules/mail/backend'));
const {
  resolveInitialUserServiceIds,
  resolveUserEntityServices
} = require('../core/entity-user-services');

const TOKEN_INVITE_TTL_HOURS = 48;
const TOKEN_RESET_TTL_HOURS = 2;

function objectIdToString(value) {
  if (!value) return '';
  try {
    return String(value);
  } catch (_) {
    return '';
  }
}

function buildAppBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const proto = forwardedProto || req.protocol || 'https';
  const host = forwardedHost || req.get('host');

  if (!host) {
    return process.env.APP_BASE_URL || 'https://www.gdr-innovation.fr';
  }

  return `${proto}://${host}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function sendUserEmail({ entityId, fallbackEntityId = null, to, subject, body, bodyHtml, moduleName = 'mail' }) {
  const mail = mailModule.getMailService();
  const configCollection = database.getCollection('mail_configs');
  let savedConfig = await configCollection.findOne({
    module_name: moduleName,
    entity_id: entityId
  });

  if (!savedConfig && fallbackEntityId) {
    savedConfig = await configCollection.findOne({
      module_name: moduleName,
      entity_id: fallbackEntityId
    });
    if (savedConfig) {
      console.log(`ℹ️  Fallback SMTP: utilisation config de l'entité ${fallbackEntityId} pour l'entité ${entityId}`);
    }
  }

  if (savedConfig && savedConfig.config) {
    mail.initModule({
      module_name: moduleName,
      ...savedConfig.config
    });
  }

  return mail.send({
    to,
    subject,
    body,
    body_html: bodyHtml,
    module_name: moduleName,
    entity_id: entityId
  });
}

async function createInviteToken(db, { userId, entityId, email }) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const inviteExpiresAt = new Date(now.getTime() + TOKEN_INVITE_TTL_HOURS * 60 * 60 * 1000);

  const tokensCollection = db.collection('user_tokens');
  await tokensCollection.insertOne({
    userId: new ObjectId(userId),
    entityId: new ObjectId(entityId),
    email,
    type: 'invite',
    tokenHash,
    createdAt: now,
    expiresAt: inviteExpiresAt,
    usedAt: null
  });

  return { rawToken, inviteExpiresAt };
}

/**
 * GET /api/users/available
 * Récupère la liste des utilisateurs disponibles (pas déjà dans l'entité spécifiée)
 */
router.get('/available', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN_GDRI ou ADMIN_ENTITY
    if (req.user.role !== 'ADMIN_GDRI' && req.user.role !== 'ADMIN_ENTITY') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    const { entityId } = req.query;
    
    const db = await database.connect();
    const usersCollection = db.collection('users');

    console.log('🔍 GET /api/users/available - entityId:', entityId);
    
    // D'abord, récupérer TOUS les utilisateurs pour voir ce qu'on a
    const allUsers = await usersCollection.find({}).toArray();
    console.log('📦 Total utilisateurs dans la base:', allUsers.length);
    
    // Afficher la structure des premiers utilisateurs pour debug
    if (allUsers.length > 0) {
      console.log('📋 Structure du premier utilisateur:', JSON.stringify({
        _id: allUsers[0]._id.toString(),
        email: allUsers[0].email,
        entreprises: allUsers[0].entreprises,
        entity_id: allUsers[0].entity_id ? allUsers[0].entity_id.toString() : null,
        currentEntrepriseId: allUsers[0].currentEntrepriseId ? allUsers[0].currentEntrepriseId.toString() : null
      }, null, 2));
    } else {
      console.warn('⚠️ Aucun utilisateur trouvé dans la base de données');
    }

    // Filtrer manuellement : exclure ceux qui sont déjà dans cette entité
    let filteredUsers = allUsers;
    
    if (entityId) {
      console.log('🔍 Filtrage pour entityId:', entityId);
      
      filteredUsers = allUsers.filter(user => {
        // Utilisateurs qui n'ont pas de entreprises ou entreprises vide -> disponibles
        const entreprises = user.entreprises || [];
        if (!entreprises || entreprises.length === 0) {
          console.log('✅ Utilisateur disponible (pas d\'entreprises):', user.email);
          return true;
        }
        
        // Vérifier si l'utilisateur a cette entité dans son tableau entreprises
        const hasEntity = entreprises.some(e => {
          if (!e || !e.entrepriseId) return false;
          
          // Convertir en string pour comparaison
          const eId = typeof e.entrepriseId === 'string' 
            ? e.entrepriseId 
            : e.entrepriseId.toString();
          const entityIdStr = typeof entityId === 'string' 
            ? entityId 
            : entityId.toString();
          
          const match = eId === entityIdStr;
          if (match) {
            console.log('⚠️ Utilisateur exclu (déjà dans l\'entité):', user.email, 'eId:', eId, 'entityId:', entityIdStr);
          }
          return match;
        });
        
        return !hasEntity;
      });
      
      console.log('✅ Utilisateurs après filtrage:', filteredUsers.length, 'sur', allUsers.length);
    } else {
      console.log('ℹ️ Pas de entityId fourni, retour de tous les utilisateurs');
    }

    // Formater la réponse (sans le mot de passe)
    const formattedUsers = filteredUsers.map(user => ({
      _id: user._id,
      email: user.email,
      username: user.username || null,
      role: user.role || 'USER_ENTITY',
      status: user.status || 'active'
    }));

    res.json({
      success: true,
      data: formattedUsers
    });

  } catch (error) {
    console.error('Erreur route GET /api/users/available:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * POST /api/users
 * Crée un utilisateur et l'attache à une entité
 */
router.post('/', authenticateJWT, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN_GDRI' && req.user.role !== 'ADMIN_ENTITY') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    const { email, entityId, role } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const roleInEntity = role || 'user';
    const currentEntrepriseId = req.user.currentEntrepriseId || req.user.entrepriseId || null;

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse email invalide' });
    }
    if (!entityId || !/^[a-f0-9]{24}$/i.test(entityId)) {
      return res.status(400).json({ success: false, message: 'Entité invalide' });
    }
    if (!['admin', 'user'].includes(roleInEntity)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }
    if (req.user.role === 'ADMIN_ENTITY' && currentEntrepriseId && entityId !== currentEntrepriseId.toString()) {
      return res.status(403).json({ success: false, message: 'Entité non autorisée' });
    }

    const db = await database.connect();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({
      email: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    });
    if (existingUser) {
      if (existingUser.status === 'pending') {
        const { rawToken } = await createInviteToken(db, {
          userId: existingUser._id,
          entityId,
          email: normalizedEmail
        });

        const baseUrl = buildAppBaseUrl(req);
        const inviteLink = `${baseUrl}/frontend/pages/first-connection.php?token=${rawToken}`;
        const subject = 'Votre compte GDRI est prêt';
        const body = [
          'Bonjour,',
          '',
          'Un compte sur www.gdri.fr vous attend.',
          `Pour définir votre mot de passe, cliquez sur ce lien : ${inviteLink}`,
          '',
          `Ce lien expire dans ${TOKEN_INVITE_TTL_HOURS} heures.`,
          '',
          'Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.'
        ].join('\n');

        const bodyHtml = `
          <p>Bonjour,</p>
          <p>Un compte sur <strong>www.gdri.fr</strong> vous attend.</p>
          <p>Pour définir votre mot de passe, cliquez sur ce lien :</p>
          <p><a href="${inviteLink}">${inviteLink}</a></p>
          <p>Ce lien expire dans ${TOKEN_INVITE_TTL_HOURS} heures.</p>
          <p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>
        `;

        let emailSent = true;
        try {
          await sendUserEmail({
            entityId,
            fallbackEntityId: req.user.currentEntrepriseId || req.user.entrepriseId || null,
            to: normalizedEmail,
            subject,
            body,
            bodyHtml,
            moduleName: 'mail'
          });
        } catch (mailError) {
          emailSent = false;
          console.warn('⚠️  Email invitation non envoyé:', mailError.message);
        }

        return res.json({
          success: true,
          message: emailSent
            ? 'Invitation renvoyée'
            : 'Invitation créée, mais email non envoyé (vérifiez la configuration SMTP)',
          data: { userId: existingUser._id, emailSent }
        });
      }

      const entity = await Entity.findById(entityId);
      if (!entity || entity.status !== 'active') {
        return res.status(404).json({ success: false, message: 'Entité introuvable ou inactive' });
      }

      const entreprises = existingUser.entreprises || [];
      const alreadyInEntity = entreprises.some(e => {
        const entrepriseId = e.entrepriseId ? e.entrepriseId.toString() : null;
        return entrepriseId === entityId;
      });

      if (alreadyInEntity) {
        return res.status(409).json({
          success: false,
          message: 'Cet utilisateur appartient déjà à cette entité.'
        });
      }

      const now = new Date();
      const newEntreprise = {
        entrepriseId: new ObjectId(entityId),
        role: roleInEntity,
        joinedAt: now
      };

      const updateData = {
        entreprises: [...entreprises, newEntreprise],
        updated_at: now
      };

      if (!existingUser.currentEntrepriseId) {
        updateData.currentEntrepriseId = new ObjectId(entityId);
      }

      if (roleInEntity === 'admin' && existingUser.role !== 'ADMIN_GDRI') {
        updateData.role = 'ADMIN_ENTITY';
      }

      await usersCollection.updateOne(
        { _id: existingUser._id },
        { $set: updateData }
      );

      if (roleInEntity === 'admin' && !entity.ownerUserId) {
        const entitiesCollection = db.collection('entities');
        await entitiesCollection.updateOne(
          { _id: new ObjectId(entityId), ownerUserId: { $exists: false } },
          { $set: { ownerUserId: new ObjectId(existingUser._id), updated_at: new Date() } }
        );
      }

      try {
        const entrepriseDb = await database.getEntrepriseDb(entityId);
        const initialServiceIds = resolveInitialUserServiceIds(entity, roleInEntity);
        const entrepriseUsersCollection = entrepriseDb.collection('users');
        await entrepriseUsersCollection.updateOne(
          { userId: new ObjectId(existingUser._id) },
          {
            $set: {
              userId: new ObjectId(existingUser._id),
              email: normalizedEmail,
              role: roleInEntity,
              services_authorized: initialServiceIds.map((id) => new ObjectId(id)),
              addedAt: now,
              updatedAt: now
            }
          },
          { upsert: true }
        );
      } catch (refError) {
        console.warn(`⚠️  Référence entreprise non créée: ${refError.message}`);
      }

      return res.json({
        success: true,
        message: 'Utilisateur existant ajouté à l\'entité avec succès.',
        data: { userId: existingUser._id, email: normalizedEmail, alreadyExisted: true }
      });
    }

    const entity = await Entity.findById(entityId);
    if (!entity || entity.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Entité introuvable ou inactive' });
    }

    const now = new Date();
    const userRole = roleInEntity === 'admin' ? 'ADMIN_ENTITY' : 'USER_ENTITY';

    const insertResult = await usersCollection.insertOne({
      email: normalizedEmail,
      password_hash: null,
      role: userRole,
      status: 'pending',
      currentEntrepriseId: new ObjectId(entityId),
      entreprises: [{
        entrepriseId: new ObjectId(entityId),
        role: roleInEntity,
        joinedAt: now
      }],
      created_at: now,
      updated_at: now
    });

    const newUserId = insertResult.insertedId;

    if (roleInEntity === 'admin' && !entity.ownerUserId) {
      const entitiesCollection = db.collection('entities');
      await entitiesCollection.updateOne(
        { _id: new ObjectId(entityId), ownerUserId: { $exists: false } },
        { $set: { ownerUserId: new ObjectId(newUserId), updated_at: now } }
      );
    }

    const { rawToken } = await createInviteToken(db, {
      userId: newUserId,
      entityId,
      email: normalizedEmail
    });

    try {
      const entrepriseDb = await database.getEntrepriseDb(entityId);
      const initialServiceIds = resolveInitialUserServiceIds(entity, roleInEntity);
      const entrepriseUsersCollection = entrepriseDb.collection('users');
      await entrepriseUsersCollection.updateOne(
        { userId: new ObjectId(newUserId) },
        {
          $set: {
            userId: new ObjectId(newUserId),
            email: normalizedEmail,
            role: roleInEntity,
            services_authorized: initialServiceIds.map((id) => new ObjectId(id)),
            addedAt: now,
            updatedAt: now
          }
        },
        { upsert: true }
      );
    } catch (refError) {
      console.warn(`⚠️  Référence entreprise non créée: ${refError.message}`);
    }

    const baseUrl = buildAppBaseUrl(req);
    const inviteLink = `${baseUrl}/frontend/pages/first-connection.php?token=${rawToken}`;
    const subject = 'Votre compte GDRI est prêt';
    const body = [
      'Bonjour,',
      '',
      'Un compte sur www.gdri.fr vous attend.',
      `Pour définir votre mot de passe, cliquez sur ce lien : ${inviteLink}`,
      '',
      `Ce lien expire dans ${TOKEN_INVITE_TTL_HOURS} heures.`,
      '',
      'Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.'
    ].join('\n');

    const bodyHtml = `
      <p>Bonjour,</p>
      <p>Un compte sur <strong>www.gdri.fr</strong> vous attend.</p>
      <p>Pour définir votre mot de passe, cliquez sur ce lien :</p>
      <p><a href="${inviteLink}">${inviteLink}</a></p>
      <p>Ce lien expire dans ${TOKEN_INVITE_TTL_HOURS} heures.</p>
      <p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>
    `;

    let emailSent = true;
    try {
      await sendUserEmail({
        entityId,
        fallbackEntityId: req.user.currentEntrepriseId || req.user.entrepriseId || null,
        to: normalizedEmail,
        subject,
        body,
        bodyHtml,
        moduleName: 'mail'
      });
    } catch (mailError) {
      emailSent = false;
      console.warn('⚠️  Email invitation non envoyé:', mailError.message);
    }

    res.json({
      success: true,
      message: emailSent
        ? 'Invitation envoyée avec succès'
        : 'Compte créé, mais email non envoyé (vérifiez la configuration SMTP)',
      data: { userId: newUserId, emailSent }
    });
  } catch (error) {
    console.error('Erreur route POST /api/users:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * POST /api/users/first-connection
 * Active un compte via un token d'invitation
 */
router.post('/first-connection', async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Token manquant' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Mot de passe trop court (8 caractères minimum)' });
    }

    const tokenHash = hashToken(token);
    const db = await database.connect();
    const tokensCollection = db.collection('user_tokens');
    const usersCollection = db.collection('users');
    const now = new Date();

    const tokenDoc = await tokensCollection.findOne({
      tokenHash,
      type: 'invite',
      usedAt: null,
      expiresAt: { $gt: now }
    });

    if (!tokenDoc) {
      return res.status(400).json({ success: false, message: 'Lien invalide ou expiré' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await usersCollection.updateOne(
      { _id: new ObjectId(tokenDoc.userId) },
      {
        $set: {
          password_hash: hashedPassword,
          status: 'active',
          updated_at: now
        }
      }
    );

    await tokensCollection.updateOne(
      { _id: tokenDoc._id },
      { $set: { usedAt: now } }
    );

    res.json({ success: true, message: 'Mot de passe défini avec succès' });
  } catch (error) {
    console.error('Erreur route POST /api/users/first-connection:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * POST /api/users/forgot-password
 * Envoie un email de réinitialisation (si le compte existe)
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse email invalide' });
    }

    const db = await database.connect();
    const usersCollection = db.collection('users');
    const tokensCollection = db.collection('user_tokens');
    const now = new Date();

    const user = await usersCollection.findOne({
      email: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    });

    if (!user) {
      return res.json({
        success: true,
        message: 'Si un compte existe, un email a été envoyé.'
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const resetExpiresAt = new Date(now.getTime() + TOKEN_RESET_TTL_HOURS * 60 * 60 * 1000);

    await tokensCollection.insertOne({
      userId: new ObjectId(user._id),
      entityId: user.currentEntrepriseId || null,
      email: normalizedEmail,
      type: 'reset',
      tokenHash,
      createdAt: now,
      expiresAt: resetExpiresAt,
      usedAt: null
    });

    const baseUrl = buildAppBaseUrl(req);
    const resetLink = `${baseUrl}/frontend/pages/reset-password.php?token=${rawToken}`;
    const subject = 'Réinitialisation de votre mot de passe';
    const body = [
      'Bonjour,',
      '',
      'Vous avez demandé la réinitialisation de votre mot de passe.',
      `Cliquez sur ce lien pour définir un nouveau mot de passe : ${resetLink}`,
      '',
      `Ce lien expire dans ${TOKEN_RESET_TTL_HOURS} heures.`,
      '',
      'Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.'
    ].join('\n');

    const bodyHtml = `
      <p>Bonjour,</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p>Cliquez sur ce lien pour définir un nouveau mot de passe :</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Ce lien expire dans ${TOKEN_RESET_TTL_HOURS} heures.</p>
      <p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>
    `;

    try {
      await sendUserEmail({
        entityId: user.currentEntrepriseId ? user.currentEntrepriseId.toString() : null,
        to: normalizedEmail,
        subject,
        body,
        bodyHtml,
        moduleName: 'mail'
      });
    } catch (mailError) {
      console.warn('⚠️  Email reset non envoyé:', mailError.message);
    }

    res.json({
      success: true,
      message: 'Si un compte existe, un email a été envoyé.'
    });
  } catch (error) {
    console.error('Erreur route POST /api/users/forgot-password:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * POST /api/users/reset-password
 * Réinitialise le mot de passe via token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Token manquant' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Mot de passe trop court (8 caractères minimum)' });
    }

    const tokenHash = hashToken(token);
    const db = await database.connect();
    const tokensCollection = db.collection('user_tokens');
    const usersCollection = db.collection('users');
    const now = new Date();

    const tokenDoc = await tokensCollection.findOne({
      tokenHash,
      type: 'reset',
      usedAt: null,
      expiresAt: { $gt: now }
    });

    if (!tokenDoc) {
      return res.status(400).json({ success: false, message: 'Lien invalide ou expiré' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await usersCollection.updateOne(
      { _id: new ObjectId(tokenDoc.userId) },
      {
        $set: {
          password_hash: hashedPassword,
          status: 'active',
          updated_at: now
        }
      }
    );

    await tokensCollection.updateOne(
      { _id: tokenDoc._id },
      { $set: { usedAt: now } }
    );

    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Erreur route POST /api/users/reset-password:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/users/me/entreprises
 * Récupère les entreprises de l'utilisateur connecté avec vérification
 */
router.get('/me/entreprises', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const db = await database.connect();
    const usersCollection = db.collection('users');
    const entitiesCollection = db.collection('entities');
    
    // Récupérer l'utilisateur
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Récupérer les entreprises de l'utilisateur
    const userEntreprises = user.entreprises || [];
    const currentEntrepriseId = user.currentEntrepriseId 
      ? user.currentEntrepriseId.toString() 
      : null;
    
    // Vérifier chaque entreprise et récupérer ses infos
    const entreprisesValides = [];
    
    for (const userEntreprise of userEntreprises) {
      const entrepriseId = userEntreprise.entrepriseId 
        ? (typeof userEntreprise.entrepriseId === 'string' 
            ? userEntreprise.entrepriseId 
            : userEntreprise.entrepriseId.toString())
        : null;
      
      if (!entrepriseId) continue;
      
      // Vérifier que l'entreprise existe et est active
      const entreprise = await entitiesCollection.findOne({ 
        _id: new ObjectId(entrepriseId),
        status: 'active' // Uniquement les entreprises actives
      });
      
      if (entreprise) {
        entreprisesValides.push({
          _id: entreprise._id.toString(),
          name: entreprise.name,
          siret: entreprise.siret,
          logo: entreprise.logo || null, // Logo de l'entreprise
          address: entreprise.address,
          role: userEntreprise.role, // Rôle de l'utilisateur dans cette entreprise
          joinedAt: userEntreprise.joinedAt,
          isCurrent: entrepriseId === currentEntrepriseId
        });
      } else {
        console.warn(`⚠️ Entreprise ${entrepriseId} non trouvée ou inactive pour l'utilisateur ${userId}`);
      }
    }
    
    res.json({
      success: true,
      data: entreprisesValides,
      currentEntrepriseId: currentEntrepriseId
    });
    
  } catch (error) {
    console.error('Erreur route GET /api/users/me/entreprises:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/users/me/header-context
 * Retourne le contexte minimal pour le header (entreprises + entreprise active)
 * sans accès DB côté PHP.
 */
router.get('/me/header-context', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const db = await database.connect();
    const usersCollection = db.collection('users');
    const entitiesCollection = db.collection('entities');

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    let userEntreprises = [];
    const userEntreprisesList = user.entreprises || [];
    const entrepriseIds = [];
    userEntreprisesList.forEach((ue) => {
      if (ue && ue.entrepriseId) entrepriseIds.push(new ObjectId(String(ue.entrepriseId)));
    });
    if (entrepriseIds.length > 0) {
      userEntreprises = await entitiesCollection.find({
        _id: { $in: entrepriseIds },
        status: 'active'
      }).toArray();
    }

    let currentEntreprise = null;
    const currentEntrepriseId = user.currentEntrepriseId ? String(user.currentEntrepriseId) : null;
    if (currentEntrepriseId) {
      const isMember = entrepriseIds.some((id) => String(id) === currentEntrepriseId);
      if (isMember) {
        currentEntreprise = await entitiesCollection.findOne({
          _id: new ObjectId(currentEntrepriseId),
          status: 'active'
        });
      }
    }
    if (!currentEntreprise && userEntreprises.length > 0) {
      currentEntreprise = userEntreprises[0];
    }

    res.json({
      success: true,
      data: {
        entreprises: userEntreprises.map((e) => ({
          _id: String(e._id),
          name: e.name || '',
          logo: e.logo || null,
          status: e.status || 'active'
        })),
        currentEntreprise: currentEntreprise ? {
          _id: String(currentEntreprise._id),
          name: currentEntreprise.name || '',
          logo: currentEntreprise.logo || null,
          status: currentEntreprise.status || 'active'
        } : null
      }
    });
  } catch (error) {
    console.error('Erreur route GET /api/users/me/header-context:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/users/me/services-context
 * Retourne les services visibles pour l'utilisateur connecté (contextualisés entité).
 */
router.get('/me/services-context', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const role = req.user.role;
    const currentEntrepriseId = req.user.currentEntrepriseId || req.user.entrepriseId || null;

    const db = await database.connect();
    const servicesCollection = db.collection('services');

    let services = [];
    if (role === 'ADMIN_GDRI' && !currentEntrepriseId) {
      services = await servicesCollection.find({ status: 'active' }).toArray();
    } else {
      if (!currentEntrepriseId || !/^[a-f0-9]{24}$/i.test(String(currentEntrepriseId))) {
        return res.json({ success: true, data: { services: [] } });
      }

      const resolved = await resolveUserEntityServices(db, {
        userId: String(userId),
        entityId: String(currentEntrepriseId),
        jwtRole: role,
        bypassUserRestrictions: role === 'ADMIN_GDRI'
      });
      services = resolved.services;
    }

    res.json({
      success: true,
      data: {
        services: services.map((s) => ({
          _id: String(s._id),
          name: s.name || 'Module',
          slug: s.slug || null,
          description: s.description || '',
          icon: s.icon || '🧩',
          status: s.status || 'inactive',
          catalog_type: s.catalog_type || 'app',
          catalog_visibility: s.catalog_visibility || 'public',
          catalog_parent_app: s.catalog_parent_app || null,
          catalog_entry_url: s.catalog_entry_url || null,
          created_at: s.created_at || null
        }))
      }
    });
  } catch (error) {
    console.error('Erreur route GET /api/users/me/services-context:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

/**
 * PUT /api/users/me/current-entreprise
 * Change l'entreprise active de l'utilisateur
 */
router.put('/me/current-entreprise', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { entrepriseId } = req.body;
    
    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        message: 'entrepriseId est requis'
      });
    }
    
    const db = await database.connect();
    const usersCollection = db.collection('users');
    
    // Récupérer l'utilisateur
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Vérifier que l'entreprise est dans la liste des entreprises de l'utilisateur
    const userEntreprises = user.entreprises || [];
    const entrepriseIdStr = typeof entrepriseId === 'string' ? entrepriseId : entrepriseId.toString();
    
    const hasEntreprise = userEntreprises.some(e => {
      const eId = e.entrepriseId 
        ? (typeof e.entrepriseId === 'string' ? e.entrepriseId : e.entrepriseId.toString())
        : null;
      return eId === entrepriseIdStr;
    });
    
    if (!hasEntreprise) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas accès à cette entreprise'
      });
    }
    
    // Vérifier que l'entreprise existe et est active
    const entitiesCollection = db.collection('entities');
    const entreprise = await entitiesCollection.findOne({
      _id: new ObjectId(entrepriseId),
      status: 'active'
    });
    
    if (!entreprise) {
      return res.status(404).json({
        success: false,
        message: 'Entreprise non trouvée ou inactive'
      });
    }
    
    const updateDoc = {
      $set: {
        currentEntrepriseId: new ObjectId(entrepriseId),
        updated_at: new Date()
      }
    };

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      updateDoc
    );

    const freshToken = signToken({
      user_id: String(userId),
      currentEntrepriseId: entrepriseIdStr,
      entrepriseId: entrepriseIdStr,
      role: user.role || req.user.role || 'USER_ENTITY',
      email: user.email || req.user.email || ''
    });
    setAuthTokenCookie(req, res, freshToken);
    
    res.json({
      success: true,
      message: 'Entreprise active mise à jour',
      data: {
        currentEntrepriseId: entrepriseId,
        token: freshToken,
        entreprise: {
          _id: entreprise._id.toString(),
          name: entreprise.name,
          logo: entreprise.logo || null
        }
      }
    });
    
  } catch (error) {
    console.error('Erreur route PUT /api/users/me/current-entreprise:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * DELETE /api/users/:userId
 * Supprime définitivement un compte utilisateur
 */
router.delete('/:userId', authenticateJWT, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN_GDRI' && req.user.role !== 'ADMIN_ENTITY') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    const { userId } = req.params;
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur invalide'
      });
    }

    if (String(req.user.user_id) === String(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Suppression de votre propre compte interdite'
      });
    }

    const db = await database.connect();
    const usersCollection = db.collection('users');
    const userTokensCollection = db.collection('user_tokens');
    const userObjectId = new ObjectId(userId);

    const user = await usersCollection.findOne({ _id: userObjectId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const entreprises = Array.isArray(user.entreprises) ? user.entreprises : [];

    // ADMIN_ENTITY: gestion limitée à son entité active (retrait ou suppression finale)
    if (req.user.role === 'ADMIN_ENTITY') {
      if (user.role === 'ADMIN_GDRI') {
        return res.status(403).json({
          success: false,
          message: 'Suppression d\'un ADMIN_GDRI interdite'
        });
      }

      const currentEntrepriseId = String(req.user.currentEntrepriseId || req.user.entrepriseId || '');
      if (!/^[a-f0-9]{24}$/i.test(currentEntrepriseId)) {
        return res.status(403).json({
          success: false,
          message: 'Entité active invalide pour cette opération'
        });
      }

      const entitiesCollection = db.collection('entities');
      const entityDoc = await entitiesCollection.findOne({ _id: new ObjectId(currentEntrepriseId) });
      const ownerUserId = objectIdToString(entityDoc?.ownerUserId);
      if (ownerUserId && ownerUserId === String(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Le propriétaire de l\'entité ne peut pas être supprimé par un administrateur'
        });
      }

      const normalizedCurrent = currentEntrepriseId.toLowerCase();
      const inCurrentEntity = entreprises.some((e) => {
        const entrepriseId = e?.entrepriseId ? String(e.entrepriseId).toLowerCase() : '';
        return entrepriseId === normalizedCurrent;
      });

      if (!inCurrentEntity) {
        return res.status(403).json({
          success: false,
          message: 'Cet utilisateur n\'appartient pas à votre entité'
        });
      }

      const nextEntreprises = entreprises.filter((e) => {
        const entrepriseId = e?.entrepriseId ? String(e.entrepriseId).toLowerCase() : '';
        return entrepriseId !== normalizedCurrent;
      });

      try {
        const entrepriseDb = await database.getEntrepriseDb(currentEntrepriseId);
        await entrepriseDb.collection('users').deleteOne({ userId: userObjectId });
      } catch (refError) {
        console.warn(`⚠️ Impossible de supprimer la référence utilisateur dans la base entreprise: ${refError.message}`);
      }

      if (nextEntreprises.length === 0) {
        await userTokensCollection.deleteMany({ userId: userObjectId });
        await usersCollection.deleteOne({ _id: userObjectId });
        return res.json({
          success: true,
          message: 'Compte utilisateur supprimé avec succès',
          data: { userId, mode: 'full_delete' }
        });
      }

      const nextCurrentEntrepriseId = user.currentEntrepriseId
        && String(user.currentEntrepriseId).toLowerCase() === normalizedCurrent
        ? (nextEntreprises[0]?.entrepriseId || null)
        : user.currentEntrepriseId;

      await usersCollection.updateOne(
        { _id: userObjectId },
        {
          $set: {
            entreprises: nextEntreprises,
            currentEntrepriseId: nextCurrentEntrepriseId,
            updated_at: new Date()
          }
        }
      );

      return res.json({
        success: true,
        message: 'Utilisateur retiré de votre entité',
        data: { userId, mode: 'entity_unlink' }
      });
    }

    // ADMIN_GDRI: suppression globale
    for (const entreprise of entreprises) {
      try {
        const entrepriseId = entreprise?.entrepriseId ? String(entreprise.entrepriseId) : '';
        if (!/^[a-f0-9]{24}$/i.test(entrepriseId)) continue;
        const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
        await entrepriseDb.collection('users').deleteOne({ userId: userObjectId });
      } catch (refError) {
        console.warn(`⚠️ Impossible de supprimer la référence utilisateur dans une base entreprise: ${refError.message}`);
      }
    }

    await userTokensCollection.deleteMany({ userId: userObjectId });
    await usersCollection.deleteOne({ _id: userObjectId });

    return res.json({
      success: true,
      message: 'Compte utilisateur supprimé avec succès',
      data: { userId, mode: 'full_delete' }
    });
  } catch (error) {
    console.error('Erreur route DELETE /api/users/:userId:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

module.exports = router;
