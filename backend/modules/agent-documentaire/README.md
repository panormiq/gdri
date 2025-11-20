# Module Agent Documentaire

Module pour transformer des documents Word en modèles techniques réutilisables.

## Fonctionnalités

- ✅ Upload et extraction de documents Word
- ✅ Conversion Word → JSON structuré
- ✅ Génération JSON → HTML pour affichage
- ✅ Éditeur WYSIWYG avec 3 colonnes (TOC, Contenu, Propriétés)
- ✅ Gestion des sections et hiérarchie illimitée
- ✅ Système de verrous pour les propriétés
- ✅ Gestion des images avec rognage

## Structure

```
backend/modules/agent-documentaire/
├── index.js                      # Point d'entrée
├── routes.js                     # Routes API
├── package.json                  # Dépendances
├── config.json                   # Configuration
├── README.md                     # Documentation
│
├── services/
│   └── DocumentService.js        # Service principal
│
├── extractors/                   # Extraction Word → JSON
│   ├── wordtojson.js             # Point d'entrée
│   ├── word-tags-config.js       # Configuration des balises Word supportées
│   └── methodes/                 # Méthodes d'extraction
│       ├── extract-paragraph.js
│       ├── extract-heading.js
│       ├── extract-image.js
│       ├── extract-table.js
│       ├── extract-section.js
│       └── extract-toc.js
│
├── generators/                   # Génération JSON → HTML
│   ├── jsontohtml.js             # Point d'entrée
│   └── methodes/                 # Méthodes de génération
│       ├── generate-paragraph.js
│       ├── generate-heading.js
│       ├── generate-image.js
│       ├── generate-table.js
│       └── generate-section.js
│
├── storage/                      # Stockage fichiers
│   ├── documents/                # Documents Word originaux
│   └── images/                   # Images extraites
│
├── config/
│   └── lockable-properties.json # Configuration des verrous
│
└── src-test/                     # Fichiers de test
    └── MÉMOIRE TECHNIQUE CD 22VPRO - PORT DE BONIFACIO.docx
```

## API

### POST /api/agent-documentaire/upload
Upload d'un fichier Word.

### POST /api/agent-documentaire/extract/:documentId
Extraire Word → JSON (utilise fichier par défaut si documentId null).

**Body (optionnel):**
```json
{
  "filename": "chemin/vers/fichier.docx"
}
```

### GET /api/agent-documentaire/document/:documentId
Récupérer le JSON du document.

### PUT /api/agent-documentaire/document/:documentId
Mettre à jour le JSON du document.

**Body:**
```json
{
  "json_content": { ... }
}
```

### PUT /api/agent-documentaire/document/:documentId/sections
Réorganiser les sections (drag & drop).

**Body:**
```json
{
  "sections": [ ... ]
}
```

### GET /api/agent-documentaire/document/:documentId/html
Générer HTML depuis JSON (pour affichage).

### GET /api/agent-documentaire/document/:documentId/image/:imageId
Récupérer une image.

## Configuration des balises Word

Le fichier `extractors/word-tags-config.js` centralise toutes les balises Word que l'on sait traiter et leur méthode d'extraction associée.

**Structure d'une entrée de configuration :**
```javascript
{
  tag: "w:p",                    // Nom de la balise XML Word
  type: "paragraph",              // Type dans notre JSON
  method: extractParagraph.extract, // Méthode d'extraction
  properties: ["text", "styles"], // Propriétés à extraire
  conditions: {                   // Conditions pour utiliser cette balise
    hasStyle: "Heading1"         // Ex: seulement si w:pStyle = "Heading1"
  }
}
```

**Balises actuellement supportées :**
- `w:p` - Paragraphes (avec détection des titres Heading1-6)
- `w:r` - Runs de texte (formatage)
- `w:t` - Texte
- `w:br` - Sauts de ligne
- `w:drawing` / `wp:anchor` - Images (inline et anchor)
- `w:tbl` - Tableaux
- `w:pPr` - Propriétés de paragraphe
- `w:rPr` - Propriétés de run (formatage)

**Ajouter une nouvelle balise :**
1. Ajouter l'entrée dans `word-tags-config.js`
2. Créer la méthode d'extraction dans `methodes/extract-*.js` si nécessaire
3. La balise sera automatiquement prise en compte lors de l'extraction

## Workflow

1. **Word → JSON** : Extraction unique du document Word en JSON structuré
2. **JSON stocké** : Source de vérité unique en MongoDB
3. **JSON → HTML** : Génération à la volée pour affichage dans l'éditeur
4. **Modifications** : Actions WYSIWYG → API → Mise à jour directe du JSON
5. **Affichage** : Régénération HTML depuis JSON mis à jour

## Structure JSON

```json
{
  "documentId": "doc123",
  "metadata": {
    "title": "Mémoire Technique",
    "createdAt": "2024-01-01",
    "updatedAt": "2024-01-01"
  },
  "sections": [
    {
      "id": "sec1",
      "type": "section",
      "level": 1,
      "title": "Introduction",
      "order": 1,
      "isAnnex": false,
      "children": [ ... ],
      "content": [
        {
          "type": "paragraph",
          "text": "...",
          "styles": { ... }
        }
      ]
    }
  ],
  "toc": [ ... ],
  "images": [ ... ]
}
```

## Configuration

### Verrous (lockable-properties.json)

Définit quelles propriétés peuvent être verrouillées pour maintenir la cohérence du document.

## Installation

```bash
cd backend/modules/agent-documentaire
npm install
```

## Dépendances

- `mammoth` : Extraction Word (optionnel, pour extraction texte simple)
- `adm-zip` : Manipulation ZIP (les .docx sont des ZIP)
- `xml2js` : Parsing XML du document Word

