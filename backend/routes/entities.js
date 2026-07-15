/**
 * Routes API pour la gestion des entités
 * Fichier : backend/routes/entities.js
 */

const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { authenticateJWT } = require('../config/jwt');
const Entity = require('../models/Entity');
const { ObjectId } = require('mongodb');
const { dedupeServicesList } = require('../core/services-catalog-dedupe');

function serializeDoc(value) {
  if (Array.isArray(value)) return value.map(serializeDoc);
  if (value && typeof value === 'object') {
    if (value instanceof ObjectId) return value.toString();
    if (value._bsontype === 'ObjectID' && typeof value.toString === 'function') return value.toString();
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = serializeDoc(value[k]); });
    return out;
  }
  return value;
}

/**
 * PUT /api/entities/:entityId/services
 * Met à jour les services autorisés d'une entité
 */
router.put('/:entityId/services', authenticateJWT, async (req, res) => {
  try {
    const { entityId } = req.params;
    const { services_authorized } = req.body;

    // Vérifier que l'utilisateur est ADMIN_GDRI
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs GDRI peuvent modifier les entités.'
      });
    }

    // Valider les IDs de services
    if (!Array.isArray(services_authorized)) {
      return res.status(400).json({
        success: false,
        message: 'services_authorized doit être un tableau'
      });
    }

    // Convertir les IDs en ObjectId
    const serviceIds = services_authorized
      .filter(id => id && id.trim() !== '')
      .map(id => new ObjectId(id));

    // Mettre à jour l'entité
    const entity = await Entity.update(entityId, {
      services_authorized: serviceIds
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entité non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Modules mis à jour avec succès',
      data: entity
    });

  } catch (error) {
    console.error('Erreur route PUT /api/entities/:entityId/services:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * PUT /api/entities/:entityId
 * Met à jour une entité (nom, siret, adresse, logo)
 */
router.put('/:entityId', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN_GDRI
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs GDRI peuvent modifier les entités.'
      });
    }

    const { entityId } = req.params;
    const { name, siret, address, logo } = req.body;

    // Validation
    if (!name || !siret || !address) {
      return res.status(400).json({
        success: false,
        message: 'Les champs name, siret et address sont requis'
      });
    }

    // Préparer les données de mise à jour
    const updateData = {
      name,
      siret,
      address,
      updated_at: new Date()
    };
    
    // Ajouter le logo si fourni (base64)
    if (logo !== undefined) {
      if (logo === null || logo === '') {
        // Supprimer le logo
        updateData.logo = null;
      } else if (typeof logo === 'string' && logo.startsWith('data:image/')) {
        // Nouveau logo base64
        updateData.logo = logo;
      }
    }

    // Mettre à jour l'entité
    const entity = await Entity.update(entityId, updateData);

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entité non trouvée'
      });
    }

    try {
      const syncEntityToOwnOrganisation = require('../../modules/annuaire/backend/services/organisations/syncEntityToOwnOrganisation');
      await syncEntityToOwnOrganisation(entityId);
    } catch (syncErr) {
      console.warn('syncEntityToOwnOrganisation (PUT):', syncErr.message);
    }

    res.json({
      success: true,
      message: 'Entité mise à jour avec succès',
      data: entity
    });

  } catch (error) {
    console.error('Erreur route PUT /api/entities/:entityId:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * POST /api/entities
 * Crée une nouvelle entité
 */
router.post('/', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN_GDRI
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs GDRI peuvent créer des entités.'
      });
    }

    const { name, siret, address, services_authorized, logo } = req.body;

    // Validation
    if (!name || !siret || !address) {
      return res.status(400).json({
        success: false,
        message: 'Les champs name, siret et address sont requis'
      });
    }

    // Convertir les IDs de services en ObjectId
    const serviceIds = (services_authorized || [])
      .filter(id => id && id.trim() !== '')
      .map(id => new ObjectId(id));

    // Créer l'entité dans MongoDB
    const entityData = {
      name,
      siret,
      address,
      services_authorized: serviceIds
    };
    
    // Ajouter le logo si fourni (base64)
    if (logo && typeof logo === 'string' && logo.startsWith('data:image/')) {
      entityData.logo = logo;
    }
    
    const entity = await Entity.create(entityData);

    // ✅ CRÉER LA BASE DE DONNÉES ET L'UTILISATEUR MONGODB DE MANIÈRE SÉCURISÉE
    const EntrepriseDatabaseService = require('../services/EntrepriseDatabaseService');
    const entrepriseId = entity._id.toString();
    
    try {
      console.log(`🏗️  Création de la base de données pour l'entreprise ${entrepriseId}...`);
      const dbInfo = await EntrepriseDatabaseService.createEntrepriseDatabase(entrepriseId);
      
      console.log(`✅ Base de données créée: ${dbInfo.dbName}`);
      console.log(`✅ Utilisateur MongoDB créé: ${dbInfo.username}`);
      // Le mot de passe est stocké de manière sécurisée, ne pas le logger ni le retourner
      
    } catch (dbError) {
      console.error(`❌ Erreur lors de la création de la base pour ${entrepriseId}:`, dbError);
      
      // Si la création de la base échoue, supprimer l'entité créée pour éviter un état incohérent
      try {
        const db = await database.connect();
        const entityCollection = db.collection('entities');
        await entityCollection.deleteOne({ _id: entity._id });
        console.log(`🗑️  Entité supprimée suite à l'échec de la création de la base`);
      } catch (deleteError) {
        console.error(`❌ Erreur lors de la suppression de l'entité:`, deleteError);
      }
      
      return res.status(500).json({
        success: false,
        message: `Erreur lors de la création de la base de données pour l'entreprise: ${dbError.message}`
      });
    }

    try {
      const syncEntityToOwnOrganisation = require('../../modules/annuaire/backend/services/organisations/syncEntityToOwnOrganisation');
      await syncEntityToOwnOrganisation(entrepriseId);
    } catch (syncErr) {
      console.warn('syncEntityToOwnOrganisation (POST):', syncErr.message);
    }

    res.json({
      success: true,
      message: 'Entité créée avec succès',
      data: entity
    });

  } catch (error) {
    console.error('Erreur route POST /api/entities:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/entities
 * Récupère toutes les entités
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN_GDRI
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    const entities = await Entity.findAll();

    res.json({
      success: true,
      data: entities
    });

  } catch (error) {
    console.error('Erreur route GET /api/entities:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/entities/context
 * Contexte de gestion des entités pour la page PHP (sans accès DB direct en PHP).
 */
router.get('/context', authenticateJWT, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    const db = await database.connect();
    const entities = await db.collection('entities').find({}).toArray();
    const services = dedupeServicesList(await db.collection('services').find({}).toArray());
    const users = await db.collection('users').find({}).toArray();
    res.json({
      success: true,
      data: {
        entities: serializeDoc(entities),
        services: serializeDoc(services),
        users: serializeDoc(users)
      }
    });
  } catch (error) {
    console.error('Erreur route GET /api/entities/context:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/entities/:entityId
 * Récupère une entité par ID
 */
router.get('/:entityId', authenticateJWT, async (req, res) => {
  try {
    const { entityId } = req.params;

    const entity = await Entity.findById(entityId);

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entité non trouvée'
      });
    }

    res.json({
      success: true,
      data: entity
    });

  } catch (error) {
    console.error('Erreur route GET /api/entities/:entityId:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * GET /api/entities/:entityId/users
 * Récupère la liste des utilisateurs d'une entité
 */
router.get('/:entityId/users', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN_GDRI ou ADMIN_ENTITY
    if (req.user.role !== 'ADMIN_GDRI' && req.user.role !== 'ADMIN_ENTITY') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    const { entityId } = req.params;

    // Vérifier que l'entité existe
    const entity = await Entity.findById(entityId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entité non trouvée'
      });
    }

    const db = await database.connect();
    const usersCollection = db.collection('users');

    // Récupérer tous les utilisateurs qui ont cette entreprise
    const allUsers = await usersCollection.find({}).toArray();
    
    // Filtrer les utilisateurs qui appartiennent à cette entité
    const entityUsers = allUsers.filter(user => {
      const entreprises = user.entreprises || [];
      return entreprises.some(e => {
        if (!e || !e.entrepriseId) return false;
        const eId = typeof e.entrepriseId === 'string' 
          ? e.entrepriseId 
          : e.entrepriseId.toString();
        return eId === entityId;
      });
    });

    // Formater la réponse
    const formattedUsers = entityUsers.map(user => {
      const entreprises = user.entreprises || [];
      const userEntreprise = entreprises.find(e => {
        if (!e || !e.entrepriseId) return false;
        const eId = typeof e.entrepriseId === 'string' 
          ? e.entrepriseId 
          : e.entrepriseId.toString();
        return eId === entityId;
      });

      return {
        _id: user._id ? user._id.toString() : '',
        email: user.email,
        username: user.username || null,
        role: userEntreprise?.role || 'user',
        role_in_entity: userEntreprise?.role || 'user',
        status: user.status || 'active'
      };
    });

    res.json({
      success: true,
      data: formattedUsers,
      count: formattedUsers.length
    });

  } catch (error) {
    console.error('Erreur route GET /api/entities/:entityId/users:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * POST /api/entities/:entityId/users
 * Ajoute un utilisateur existant à une entité (format multi-entreprises)
 */
router.post('/:entityId/users', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN_GDRI ou ADMIN_ENTITY
    if (req.user.role !== 'ADMIN_GDRI' && req.user.role !== 'ADMIN_ENTITY') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent ajouter des utilisateurs.'
      });
    }

    const { entityId } = req.params;
    const { userId, role } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID de l\'utilisateur est requis'
      });
    }

    // Validation du rôle dans l'entité
    const allowedRoles = ['admin', 'user'];
    const userRole = role || 'user';
    if (!allowedRoles.includes(userRole)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide. Rôles autorisés: admin, user'
      });
    }

    // Vérifier que l'entité existe
    const entity = await Entity.findById(entityId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entité non trouvée'
      });
    }

    // Récupérer l'utilisateur
    const db = await database.connect();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier si l'utilisateur n'est pas déjà dans cette entité
    const entreprises = user.entreprises || [];
    const existingEntreprise = entreprises.find(e => {
      const eId = e.entrepriseId ? e.entrepriseId.toString() : null;
      return eId === entityId;
    });
    
    console.log('🔍 Vérification utilisateur:', {
      userId: userId,
      entityId: entityId,
      entreprises: entreprises.map(e => ({
        entrepriseId: e.entrepriseId ? e.entrepriseId.toString() : null,
        role: e.role
      })),
      existingEntreprise: existingEntreprise ? 'OUI' : 'NON'
    });
    
    if (existingEntreprise) {
      return res.status(400).json({
        success: false,
        message: 'Cet utilisateur appartient déjà à cette entité'
      });
    }

    // Ajouter l'utilisateur à l'entité (format multi-entreprises)
    const newEntreprise = {
      entrepriseId: new ObjectId(entityId),
      role: userRole,
      joinedAt: new Date()
    };

    entreprises.push(newEntreprise);

    // Mettre à jour l'utilisateur dans la base principale
    const updateData = {
      entreprises: entreprises,
      updated_at: new Date()
    };

    // Si l'utilisateur n'a pas de currentEntrepriseId, le définir avec cette entité
    if (!user.currentEntrepriseId) {
      updateData.currentEntrepriseId = new ObjectId(entityId);
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    // ✅ CRÉER UNE RÉFÉRENCE DANS LA BASE DE L'ENTREPRISE (pour performance)
    try {
      const entrepriseDb = await database.getEntrepriseDb(entityId);
      const entrepriseUsersCollection = entrepriseDb.collection('users');
      const dbName = `GDR-ENTREPRISE-${entityId}`;
      
      // Créer une référence légère (sans mot de passe ni données sensibles)
      const userReference = {
        userId: new ObjectId(userId), // Référence vers l'utilisateur dans la base principale
        email: user.email,
        role: userRole, // Rôle spécifique dans cette entreprise
        addedAt: new Date(),
        updatedAt: new Date()
      };
      
      // Utiliser upsert pour créer ou mettre à jour
      await entrepriseUsersCollection.updateOne(
        { userId: new ObjectId(userId) },
        { $set: userReference },
        { upsert: true }
      );
      
      console.log(`✅ Référence utilisateur créée dans la base ${dbName} pour ${user.email}`);
    } catch (refError) {
      // Ne pas échouer si la référence ne peut pas être créée (la base peut ne pas exister)
      console.warn(`⚠️  Impossible de créer la référence dans la base d'entreprise: ${refError.message}`);
    }

    res.json({
      success: true,
      message: 'Utilisateur ajouté à l\'entité avec succès',
      data: {
        userId: userId,
        entityId: entityId,
        role: userRole
      }
    });

  } catch (error) {
    console.error('Erreur route POST /api/entities/:entityId/users:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

/**
 * DELETE /api/entities/:entityId/users/:userId
 * Retire un utilisateur d'une entité (format multi-entreprises)
 */
router.delete('/:entityId/users/:userId', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN_GDRI ou ADMIN_ENTITY
    if (req.user.role !== 'ADMIN_GDRI' && req.user.role !== 'ADMIN_ENTITY') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent retirer des utilisateurs.'
      });
    }

    const { entityId, userId } = req.params;

    // Validation
    if (!entityId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID de l\'entité et de l\'utilisateur sont requis'
      });
    }
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur invalide'
      });
    }

    // Vérifier que l'entité existe
    const entity = await Entity.findById(entityId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entité non trouvée'
      });
    }

    // Récupérer l'utilisateur
    const db = await database.connect();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier si l'utilisateur est dans cette entité
    // IMPORTANT: Normaliser les IDs pour comparaison (gérer ObjectId, string, etc.)
    const entreprises = user.entreprises || [];
    const entityIdNormalized = entityId.toString().toLowerCase().trim();
    
    console.log(`🔍 Recherche de l'entreprise ${entityIdNormalized} pour l'utilisateur ${user.email}`);
    console.log(`   Nombre d'entreprises de l'utilisateur: ${entreprises.length}`);
    
    const existingIndex = entreprises.findIndex(e => {
      if (!e || !e.entrepriseId) {
        console.log(`   ⚠️ Entreprise sans entrepriseId:`, e);
        return false;
      }
      
      // Normaliser l'ID de l'entreprise pour comparaison
      let eId = null;
      if (typeof e.entrepriseId === 'string') {
        eId = e.entrepriseId.toLowerCase().trim();
      } else if (e.entrepriseId instanceof ObjectId) {
        eId = e.entrepriseId.toString().toLowerCase().trim();
      } else if (e.entrepriseId.toString) {
        eId = e.entrepriseId.toString().toLowerCase().trim();
      } else {
        eId = String(e.entrepriseId).toLowerCase().trim();
      }
      
      const match = eId === entityIdNormalized;
      if (match) {
        console.log(`   ✅ Entreprise trouvée: ${eId} === ${entityIdNormalized}`);
      }
      return match;
    });
    
    console.log(`   Résultat: existingIndex = ${existingIndex}`);
    
    if (existingIndex === -1) {
      // Debug: afficher les IDs des entreprises pour comprendre le problème
      console.log(`   ❌ Aucune correspondance trouvée`);
      console.log(`   IDs des entreprises de l'utilisateur:`, entreprises.map(e => {
        if (!e || !e.entrepriseId) return 'null';
        if (typeof e.entrepriseId === 'string') return e.entrepriseId.toLowerCase().trim();
        if (e.entrepriseId instanceof ObjectId) return e.entrepriseId.toString().toLowerCase().trim();
        return String(e.entrepriseId).toLowerCase().trim();
      }));
      console.log(`   ID recherché (normalisé): ${entityIdNormalized}`);
      
      return res.status(400).json({
        success: false,
        message: 'Cet utilisateur n\'appartient pas à cette entité'
      });
    }

    // Retirer l'utilisateur de l'entité (format multi-entreprises)
    // ✅ RETIRER L'ENTREPRISE DU TABLEAU entreprises DE L'UTILISATEUR
    entreprises.splice(existingIndex, 1);
    
    console.log(`🗑️  Retrait de l'entreprise ${entityId} pour l'utilisateur ${user.email}`);
    console.log(`   Nombre d'entreprises restantes: ${entreprises.length}`);

    // Mettre à jour l'utilisateur dans la base principale avec le nouveau tableau entreprises
    const updateData = {
      entreprises: entreprises, // ✅ Tableau mis à jour sans l'entreprise retirée
      updated_at: new Date()
    };

    // Si currentEntrepriseId était cette entité, le mettre à null ou à la première entreprise disponible
    if (user.currentEntrepriseId && user.currentEntrepriseId.toString() === entityId) {
      if (entreprises.length > 0 && entreprises[0].entrepriseId) {
        updateData.currentEntrepriseId = entreprises[0].entrepriseId instanceof ObjectId 
          ? entreprises[0].entrepriseId 
          : new ObjectId(entreprises[0].entrepriseId);
      } else {
        updateData.currentEntrepriseId = null;
      }
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    // ✅ SUPPRIMER LA RÉFÉRENCE DANS LA BASE DE L'ENTREPRISE
    try {
      const entrepriseDb = await database.getEntrepriseDb(entityId);
      const entrepriseUsersCollection = entrepriseDb.collection('users');
      
      await entrepriseUsersCollection.deleteOne({ userId: new ObjectId(userId) });
      
      console.log(`✅ Référence utilisateur supprimée de la base GDR-ENTREPRISE-${entityId} pour ${user.email}`);
    } catch (refError) {
      // Ne pas échouer si la référence ne peut pas être supprimée (la base peut ne pas exister)
      console.warn(`⚠️  Impossible de supprimer la référence dans la base d'entreprise: ${refError.message}`);
    }

    res.json({
      success: true,
      message: 'Utilisateur retiré de l\'entité avec succès',
      data: {
        userId: userId,
        entityId: entityId
      }
    });

  } catch (error) {
    console.error('Erreur route DELETE /api/entities/:entityId/users/:userId:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

module.exports = router;

