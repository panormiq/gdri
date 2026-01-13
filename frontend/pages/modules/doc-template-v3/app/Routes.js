import CollectionListPage from '../collection/CollectionListPage.js';
import CollectionElementListPage from '../collection/CollectionElementListPage.js';
import CreateCollectionPage from '../collection/CollectionCreatePage.js';
import CollectionElementManagePage from '../collection/CollectionElementManagePage.js';
import HomePage from '../pages/HomePage.js';
import DocumentListPage from '../document/DocumentListPage.js';
import DocumentViewPage from '../document/DocumentViewPage.js';
import DocumentCreatePage from '../document/DocumentCreatePage.js';
import DocumentEditorPage from '../document/DocumentEditorPage.js';
import TemplateListPage from '../template/TemplateListPage.js';
import TemplateBuilderPage from '../templateBuilder/TemplateBuilderPage.js';

import { collectionApi } from '../shared/api/CollectionApi.js';
import { collectionElementApi } from '../shared/api/CollectionElementApi.js';
import { templateApi } from '../shared/api/TemplateApi.js';

export default [

  /* =====================================================
     HOME – Page d'accueil avec 3 cartes
  ===================================================== */
  {
    regex: /^\/$/,
    component: HomePage,
  },

  /* =====================================================
     TEMPLATES – Liste des templates
  ===================================================== */
  {
    regex: /^\/templates$/,
    component: TemplateListPage,
  },

  /* =====================================================
     TEMPLATES – Créer un nouveau template
  ===================================================== */
  {
    regex: /^\/templates\/create$/,
    component: router => new TemplateBuilderPage(router, null),
  },

  /* =====================================================
     TEMPLATES – Éditer un template
  ===================================================== */
  {
    regex: /^\/templates\/edit\/([^/]+)$/,
    component: (router, params) => {
      // params est un tableau retourné par match.slice(1), donc params[0] contient le templateId
      const templateId = params[0];
      console.log('🔍 Route /templates/edit/ matched, templateId:', templateId, 'params:', params);
      return new TemplateBuilderPage(router, templateId);
    },
  },

  /* =====================================================
     DOCUMENTS – Liste des documents
  ===================================================== */
  {
    regex: /^\/documents$/,
    component: DocumentListPage,
  },

  /* =====================================================
     DOCUMENTS – Créer un nouveau document
  ===================================================== */
  {
    regex: /^\/documents\/create$/,
    component: (router, params) => {
      // Vérifier si on a des paramètres de retour (depuis création élément)
      const urlParams = new URLSearchParams(window.location.search);
      const templateId = urlParams.get('templateId');
      const alias = urlParams.get('alias');
      return new DocumentCreatePage(router, templateId);
    },
  },

  /* =====================================================
     DOCUMENTS – Voir un document
  ===================================================== */
  {
    regex: /^\/documents\/([^/]+)$/,
    component: (router, params) => {
      const documentId = params[0];
      return new DocumentViewPage(router, documentId);
    },
  },

  /* =====================================================
     DOCUMENTS – Éditer un document
  ===================================================== */
  {
    regex: /^\/documents\/edit\/([^/]+)$/,
    component: (router, params) => {
      const documentId = params[0];
      return new DocumentEditorPage(router, documentId);
    },
  },

  /* =====================================================
     COLLECTIONS – Liste des collections
  ===================================================== */
  {
    regex: /^\/collections$/,
    component: CollectionListPage,
  },

  /* =====================================================
     CRÉATION DE COLLECTION
  ===================================================== */
  {
    regex: /^\/collections\/create$/,
    component: router => new CreateCollectionPage(router),
  },

  /* =====================================================
     ÉDITION D'UNE COLLECTION
  ===================================================== */
  {
    regex: /^\/collections\/edit\/([^/]+)$/,
    component: async (router, params) => {
      const collectionId = params[0];

      const res = await collectionApi.getById(collectionId);
      const typesRes = await collectionApi.getFieldTypes();

      if (!res.success || !typesRes.success) {
        router.outlet.innerHTML = '<h2>Collection non trouvée</h2>';
        return null;
      }

      const types = typesRes.data;

      // Normalisation backend → builder
      const normalizedFields = (res.data.fields || []).map(field => ({
        ...field,
        uiType: types.baseTypes[field.typeRef]?.uiType || 'Text',
      }));

      return new CreateCollectionPage(router, {
        ...res.data,
        fields: normalizedFields,
      });
    },
  },

  /* =====================================================
     LISTE DES ÉLÉMENTS D’UNE COLLECTION
     (PAGE distincte)
  ===================================================== */
  {
    regex: /^\/collections\/([^/]+)\/elements\/list$/,
    component: async (router, params) => {
      const collectionId = params[0];

      const typesRes = await collectionApi.getFieldTypes();
      if (!typesRes.success) {
        router.outlet.innerHTML = '<h2>Types non trouvés</h2>';
        return null;
      }

      const collectionRes = await collectionApi.getById(collectionId);
      if (!collectionRes.success) {
        router.outlet.innerHTML = '<h2>Collection non trouvée</h2>';
        return null;
      }

      const baseTypes = typesRes.data.baseTypes;
      const enrichedFields = (collectionRes.data.fields || []).map(field => ({
        ...field,
        uiType: baseTypes[field.typeRef]?.uiType || 'Text',
      }));

      const elementsRes = await collectionElementApi.getByCollection(collectionId);
      const elements = elementsRes.success ? elementsRes.data : [];

      return new CollectionElementListPage(router, {
        collection: {
          ...collectionRes.data,
          fields: enrichedFields,
        },
        elements,
        types: typesRes.data,
      });
    },
  },

  /* =====================================================
     CREATION / EDITION D'UN ELEMENT
     (même page pour créer ou modifier)
  ===================================================== */
  {
    regex: /^\/collections\/([^/]+)\/elements\/?$/,
    component: async (router, params) => {
      const collectionId = params[0];

      const typesRes = await collectionApi.getFieldTypes();
      const collectionRes = await collectionApi.getById(collectionId);

      if (!typesRes.success || !collectionRes.success) {
        router.outlet.innerHTML = '<h2>Erreur de chargement</h2>';
        return null;
      }

      const types = typesRes.data;
      
      // Normalisation backend → builder
      const normalizedFields = (collectionRes.data.fields || []).map(field => ({
        ...field,
        uiType: types.baseTypes[field.typeRef]?.uiType || 'Texte',
      }));

      // Création : ne pas passer d'éléments (tableau vide)
      return new CollectionElementManagePage(router, {
        collection: {
          ...collectionRes.data,
          fields: normalizedFields,
        },
        elements: [], // Tableau vide pour la création
        types: typesRes.data,
      });
    },
  },
{
  regex: /^\/collections\/([^/]+)\/elements\/([^/]+)\/?$/,
  component: async (router, params) => {
    const collectionId = params[0];
    const elementId = params[1];
    console.log("on passe apr ici")
    // Charger types
    const typesRes = await collectionApi.getFieldTypes();
    if (!typesRes.success) {
      router.outlet.innerHTML = '<h2>Types non trouvés</h2>';
      return null;
    }

    // Charger collection
    const collectionRes = await collectionApi.getById(collectionId);
    if (!collectionRes.success) {
      router.outlet.innerHTML = '<h2>Collection non trouvée</h2>';
      return null;
    }

    // Charger éléments
    const elementsRes = await collectionElementApi.getByCollection(collectionId);
    
    console.log('🔍 Recherche d\'élément:', {
      elementId,
      elementIdType: typeof elementId,
      elementIdLength: elementId?.length,
      elementsCount: elementsRes.success ? elementsRes.data.length : 0,
      availableIds: elementsRes.success ? elementsRes.data.map(e => ({
        id: String(e._id),
        type: typeof e._id,
        length: String(e._id).length
      })) : []
    });
    
    // Comparer les IDs en convertissant en string pour éviter les problèmes de type
    const element = elementsRes.success 
      ? elementsRes.data.find(e => {
          const eId = String(e._id);
          const searchId = String(elementId);
          const match = eId === searchId;
          if (match) {
            console.log('✅ Match trouvé:', { eId, searchId, element: e });
          }
          return match;
        })
      : null;

    if (!element) {
      console.error('❌ Élément non trouvé:', {
        elementId,
        elementIdType: typeof elementId,
        availableIds: elementsRes.success ? elementsRes.data.map(e => String(e._id)) : [],
        elementsCount: elementsRes.success ? elementsRes.data.length : 0,
        allElements: elementsRes.success ? elementsRes.data : []
      });
      router.outlet.innerHTML = '<h2>Élément non trouvé</h2>';
      return null;
    }
    
    console.log("✅ Élément trouvé pour édition:", element);
    
    const types = typesRes.data;
    
    // Normalisation backend → builder
    const normalizedFields = (collectionRes.data.fields || []).map(field => ({
      ...field,
      uiType: types.baseTypes[field.typeRef]?.uiType || 'Texte',
    }));

    return new CollectionElementManagePage(router, {
      collection: {
        ...collectionRes.data,
        fields: normalizedFields,
      },
      elements: [element],  // on fournit l'élément à éditer
      types: typesRes.data,
    });
  },
},

  /* =====================================================
     REDIRECTION /collections/:id → /elements/list
  ===================================================== */
  {
    regex: /^\/collections\/([^/]+)$/,
    component: (router, params) => {
      router.navigate(`/collections/${params[0]}/elements/list`);
      return null;
    },
  },

];
