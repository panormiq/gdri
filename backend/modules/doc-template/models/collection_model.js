// backend/modules/doc-template/models/collection_model.js
const { ObjectId } = require('mongodb');
const database = require('../../../config/database');

// ⚠️ IMPORTANT: fieldTypes.json doit être disponible dans le module ou dans config
// Pour l'instant, on utilise un chemin relatif depuis le module
// Si nécessaire, il faudra copier fieldTypes.json dans gdri/backend/config/json/types/
const fieldTypes = require('../../../config/json/types/fieldTypes.json');

class Collection {
  constructor(data) {
    this.referenceField = data.referenceField;
    this.name = data.name;
    
    // Définition des champs de la collection
  this.fields = (data.fields || []).map((f, index) => ({
  id: f.id || f.name,
  position: Number.isInteger(f.position) ? f.position : index,

  typeRef: f.typeRef,
  type:f.type,
  label: f.label,
  name: f.name,

  required: f.required ?? false,
  defaultValue: f.defaultValue ?? null,
  validationOverrides: f.validationOverrides ?? {},

  relation: f.relation ?? null,
  ui: f.ui ?? {},

  createdAt: f.createdAt || new Date(),
  updatedAt: f.updatedAt || new Date()
}));
    
    // Les éléments (documents) de la collection
    this.elements = data.elements || [];
    
    // ✅ IMPORTANT : entrepriseId pour savoir à quelle entreprise appartient cette collection
    this.entrepriseId = data.entrepriseId;
    
    // ✅ NOUVEAU : Versioning
    this.version = data.version || '1.0.0';
    this.versionHistory = data.versionHistory || [];
    this.lastModifiedBy = data.lastModifiedBy || null; // ID utilisateur
    
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    
    if (data._id) {
      this._id = data._id;
    }
  }

  /**
   * Incrémente automatiquement la version (patch: 1.0.0 -> 1.0.1)
   */
  incrementVersion() {
    const parts = this.version.split('.');
    const patch = parseInt(parts[2] || 0) + 1;
    this.version = `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * Met à jour la version manuellement (pour changements structurels)
   * @param {string} newVersion - Nouvelle version (ex: "1.1.0" ou "2.0.0")
   * @param {string} changes - Description des changements
   */
  setVersion(newVersion, changes = '') {
    // Ajouter l'ancienne version à l'historique
    this.versionHistory.push({
      version: this.version,
      date: this.updatedAt,
      changes: changes || 'Mise à jour automatique'
    });
    
    this.version = newVersion;
  }

  // Valider un élément selon les fields définis
 validateElement(element) {
    const errors = [];

    for (const field of this.fields) {
      const value = element[field.id];
      const fieldType = fieldTypes[field.typeRef];

      if (!fieldType) {
        errors.push(`Type inconnu pour le champ "${field.label}"`);
        continue;
      }

      // Required
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`Le champ "${field.label}" est requis`);
        continue;
      }

      if (value === undefined || value === null) continue;

      // Type check
      const expectedType = fieldType.valueType;
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (actualType !== expectedType) {
        errors.push(`Le champ "${field.label}" doit être de type ${expectedType}`);
        continue;
      }

      // Fusion des validations
      const validation = {
        ...fieldType.validation,
        ...field.validationOverrides,
        required: field.required
      };

      // ENUM
      if (validation.allowedValues && !validation.allowedValues.includes(value)) {
        errors.push(
          `Le champ "${field.label}" doit être parmi: ${validation.allowedValues.join(', ')}`
        );
      }

      // STRING LENGTH
      if (typeof value === 'string') {
        if (validation.maxLength && value.length > validation.maxLength) {
          errors.push(`Le champ "${field.label}" dépasse ${validation.maxLength} caractères`);
        }
        if (validation.minLength && value.length < validation.minLength) {
          errors.push(`Le champ "${field.label}" est trop court`);
        }
      }

      // NUMBER RANGE
      if (typeof value === 'number') {
        if (validation.min !== null && value < validation.min) {
          errors.push(`Le champ "${field.label}" est inférieur à ${validation.min}`);
        }
        if (validation.max !== null && value > validation.max) {
          errors.push(`Le champ "${field.label}" est supérieur à ${validation.max}`);
        }
        if (validation.integerOnly && !Number.isInteger(value)) {
          errors.push(`Le champ "${field.label}" doit être un entier`);
        }
      }
    }

    return { isValid: errors.length === 0,
      errors
    };
  }

  // Ajouter un élément à la collection
  addElement(element) {
    // Copier l'élément pour ne pas muter l'original
    const elementWithDefaults = { ...element };

    // Appliquer les valeurs par défaut avant validation
    for (const field of this.fields) {
      const fieldType = fieldTypes[field.typeRef];

      if (!fieldType) {
        throw new Error(`Type inconnu pour le champ "${field.label}"`);
      }

      if (elementWithDefaults[field.id] === undefined || elementWithDefaults[field.id] === null) {
        elementWithDefaults[field.id] = field.defaultValue ?? fieldType.defaultValue ?? null;
      }
    }

    // Valider l'élément après application des defaults
    const validation = this.validateElement(elementWithDefaults);

    if (!validation.isValid) {
      throw new Error(`Validation échouée: ${validation.errors.join(', ')}`);
    }

    // Ajouter à la collection
    this.elements.push(elementWithDefaults);

    return elementWithDefaults;
  }


  // Mettre à jour un élément
  updateElement(elementId, updates) {
    const index = this.elements.findIndex(el => el._id.toString() === elementId.toString());
    
    if (index === -1) {
      throw new Error('Élément non trouvé');
    }
    
    const updatedElement = { ...this.elements[index], ...updates };
    
    const validation = this.validateElement(updatedElement);
    if (!validation.isValid) {
      throw new Error(`Validation échouée: ${validation.errors.join(', ')}`);
    }
    
    updatedElement.updatedAt = new Date();
    this.elements[index] = updatedElement;
    
    return updatedElement;
  }

  // Supprimer un élément
  removeElement(elementId) {
    const index = this.elements.findIndex(el => el._id.toString() === elementId.toString());
    
    if (index === -1) {
      throw new Error('Élément non trouvé');
    }
    
    const removed = this.elements.splice(index, 1)[0];
    return removed;
  }

  // Sauvegarder la collection dans la DB de l'entreprise
  async save(entrepriseId, options = {}) {
    if (!entrepriseId && !this.entrepriseId) {
      throw new Error('entrepriseId est requis pour sauvegarder une collection');
    }
    
    const entId = entrepriseId || this.entrepriseId;
    this.entrepriseId = entId;
    
    const entrepriseDb = await database.getEntrepriseDb(entId);
    const collection = entrepriseDb.collection('collections');
    
    console.log('💾 Sauvegarde collection dans:', `GDR-ENTREPRISE-${entId}`);
    
    const wasNew = !this._id;
    const previousVersion = this.version;
    
    // Si mise à jour et version auto activée (par défaut)
    if (!wasNew && options.autoVersion !== false) {
      this.incrementVersion();
    }
    
    this.updatedAt = new Date();
    
    if (this._id) {
      // Mise à jour
      const { _id, ...updateData } = this;
      await collection.updateOne(
        { _id: new ObjectId(_id) },
        { $set: updateData }
      );
      
      // Si version a changé, ajouter à l'historique
      if (previousVersion !== this.version) {
        await collection.updateOne(
          { _id: new ObjectId(_id) },
          { 
            $push: { 
              versionHistory: {
                version: previousVersion,
                date: this.updatedAt,
                changes: options.changes || 'Mise à jour automatique'
              }
            }
          }
        );
      }
      
      return this;
    } else {
      // Création
      const result = await collection.insertOne(this);
      this._id = result.insertedId;
      return this;
    }
  }

  // Méthodes statiques
  static async findOne(entrepriseId, query) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('collections');
    
    console.log('🔍 Recherche collection dans:', `GDR-ENTREPRISE-${entrepriseId}`);
    const collectionData = await collection.findOne(query);
    
    return collectionData ? new Collection(collectionData) : null;
  }

  static async findById(entrepriseId, id) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('collections');
    
    const collectionData = await collection.findOne({ _id: new ObjectId(id) });
    return collectionData ? new Collection(collectionData) : null;
  }

  static async find(entrepriseId, query = {}) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('collections');
    
    const collections = await collection.find(query).toArray();
    return collections.map(collectionData => new Collection(collectionData));
  }

  static async deleteOne(entrepriseId, filter) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('collections');
    
    return collection.deleteOne(filter);
  }

  static async countDocuments(entrepriseId, query = {}) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('collections');
    
    return collection.countDocuments(query);
  }

  // Créer les index pour une entreprise
  static async createIndexes(entrepriseId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    const collection = entrepriseDb.collection('collections');
    
    // Index unique sur referenceField pour cette entreprise
    await collection.createIndex({ referenceField: 1 }, { unique: true });
    await collection.createIndex({ name: 1 });
    
    console.log(`✅ Index créés sur collections pour l'entreprise ${entrepriseId}`);
  }

  // Convertir en objet simple
  toJSON() {
    return {
      _id: this._id,
      referenceField: this.referenceField,
      name: this.name,
      fields: this.fields,
      elements: this.elements,
      version: this.version,
      versionHistory: this.versionHistory,
      lastModifiedBy: this.lastModifiedBy,
      entrepriseId: this.entrepriseId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Collection;
