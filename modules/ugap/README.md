# Module UGAP - Configurateur de Bateaux

> **Développement / IA** : lire d’abord [`CONVENTIONS.md`](CONVENTIONS.md) et [`STRUCTURE.md`](STRUCTURE.md).

## Version 2.0.0

Module de configuration de bateaux avec extraction Excel et génération de devis.

## Installation

1. **Vérifier les dépendances** :
   ```bash
   cd modules/ugap/backend
   npm install
   ```

2. **Démarrer le serveur backend** :
   ```bash
   cd backend
   node server.js
   ```
   
   Le module sera automatiquement découvert et chargé au démarrage.

3. **Vérifier le chargement** :
   Au démarrage du serveur, vous devriez voir :
   ```
   📦 Module découvert : Module UGAP
   🚤 Initialisation module UGAP v2.0...
   ✅ Module UGAP initialisé
   🔗 Route chargée : /api/ugap
   ✅ Module UGAP chargé avec succès
   ✅ Serveur backend démarré sur http://0.0.0.0:3000
   ```

4. **Tester le backend** :
   ```powershell
   # Depuis PowerShell
   cd modules/ugap
   .\test-backend.ps1
   ```

## Structure

```
modules/ugap/
├── backend/
│   ├── index.js                    # Point d'entrée
│   ├── routes.js                    # Routes API
│   ├── package.json                 # Configuration
│   ├── controllers/
│   │   └── ugapController.js        # Contrôleurs
│   ├── services/
│   │   ├── UgapExcelService.js      # Extraction Excel
│   │   ├── ExcelTableDetector.js    # Détection "tableaux" (= blocs de lignes consécutives non vides)
│   │   └── UgapDataService.js       # Gestion MongoDB
│   └── middleware/
│       ├── useUgapEntrepriseDb.js   # Multitenant
│       └── requireUgapRole.js       # Contrôle d'accès
└── frontend/
    ├── admin.php                    # Interface admin (back-office)
    └── index.html                   # Configurateur
```

## Détection du nombre de tableaux (Excel)

Définition (conforme à ta règle) : **un tableau = un ensemble de lignes consécutives non vides**, séparé par **au moins une ligne vide**.

- **Fichier**: `modules/ugap/backend/services/ExcelTableDetector.js`
- **Fonctions**:
  - `detectTablesFromWorksheet(ws, range, options?)` → `{ count, tables: [{start,end}] }`
  - `countTablesFromWorksheet(ws, range, options?)` → `number`
- **Paramètres**:
  - `ws`: worksheet `xlsx`
  - `range`: `XLSX.utils.decode_range(ws['!ref'])`
  - `options.startRow` (optionnel): pour commencer après une ligne (ex: après "DESCRIPTIF TECHNIQUE")
  - `options.trimEmptyColumns` (optionnel, défaut `true`): ignore les colonnes entièrement vides dans la zone et démarre à la **première colonne non vide**

## API Routes

### Routes publiques (lecture)
- `GET /api/ugap/data` - Récupère toutes les données
- `GET /api/ugap/models` - Liste des modèles
- `GET /api/ugap/categories` - Catégories et options
- `POST /api/ugap/devis` - Génère un devis

### Routes admin (écriture)
- `POST /api/ugap/import` - Importe un fichier Excel
- `PUT /api/ugap/categories/:id` - Met à jour une catégorie
- `PUT /api/ugap/options/:id` - Met à jour une option

## Utilisation

### 1. Import Excel (Admin)

1. Accéder à `/modules/ugap/frontend/admin.php`
2. Cliquer sur "Importer depuis Excel"
3. Le fichier `source/TARIF ALU UGAP 2024(6).xlsx` sera automatiquement importé

### 2. Configuration (Admin)

- Visualiser les modèles extraits
- Vérifier les catégories et options
- Modifier les catégories si nécessaire

### 3. Configurateur (Utilisateur)

1. Accéder à `/modules/ugap/frontend/index.html`
2. Choisir un modèle
3. Choisir une configuration (Config 1 à 4)
4. Sélectionner les options par catégorie
5. Optionnel : Activer les options 5% du devis
6. Générer le devis

## Dépannage

### Erreur 503 "Service Unavailable"

Cette erreur signifie que le backend Node.js n'est pas accessible via le reverse proxy Apache.

**Solutions rapides** :

1. **Vérifier que le backend est démarré** :
   ```powershell
   # Vérifier si Node.js tourne
   Get-Process node -ErrorAction SilentlyContinue
   
   # Si aucun processus, démarrer le backend
   cd C:\xampp\htdocs\gdri\backend
   node server.js
   ```

2. **Tester le backend directement** :
   ```powershell
   cd modules/ugap
   .\test-backend.ps1
   ```

3. **Vérifier la configuration Apache** :
   - Voir le guide complet : `TROUBLESHOOTING.md`
   - Vérifier que les modules proxy sont activés
   - Vérifier que le VirtualHost HTTPS contient les directives `ProxyPass`

### Erreur "JSON.parse: unexpected character"

Cette erreur signifie que l'API retourne du HTML au lieu de JSON. Vérifiez :

1. **Le serveur backend est démarré** (voir ci-dessus)
2. **Le module est chargé** : Vérifiez les logs au démarrage
3. **Vous êtes authentifié** : Assurez-vous d'être connecté
4. **Le reverse proxy fonctionne** : Voir `TROUBLESHOOTING.md`

### Le fichier Excel n'est pas trouvé

Le fichier doit être présent à :
```
modules/ugap/source/TARIF ALU UGAP 2024(6).xlsx
```

### Les données ne s'affichent pas

1. Vérifiez que l'import Excel a réussi (voir les logs du serveur)
2. Vérifiez que vous êtes sur la bonne entreprise
3. Vérifiez les données dans MongoDB :
   ```javascript
   use GDR-ENTREPRISE-{entrepriseId}
   db.ugap_data.find().pretty()
   ```

## Fonctionnalités

### Extraction Excel
- Détection automatique des colonnes (modèles, libellés, prix)
- Identification des modèles via marqueurs X
- Extraction des deux tarifs (client et UGAP)
- Catégorisation automatique des options

### Configurateur
- Navigation par étapes
- Sélection modèle → configuration → options
- Options filtrées par compatibilité
- Fonctionnalité 5% : budget calculé automatiquement

### Gestion des données
- Sauvegarde dans MongoDB (base entreprise)
- Multitenant : chaque entreprise a ses propres données

## Améliorations futures

- [ ] Upload de fichier Excel via interface
- [ ] Amélioration de la catégorisation via IA
- [ ] Génération PDF du devis
- [ ] Export Excel des configurations
- [ ] Historique des devis
