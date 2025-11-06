# ✅ Checklist de Tests avant Mise en Production

## 🎯 Tests à effectuer avant de merger develop → master

### 1. Tests Frontend (Interface)

#### URLs et Navigation
- [ ] Tous les liens de navigation fonctionnent
- [ ] Les CSS se chargent correctement (pas d'erreur 404)
- [ ] Les JavaScript se chargent correctement
- [ ] Les images s'affichent (logo, etc.)
- [ ] Les formulaires fonctionnent
- [ ] Les modales s'ouvrent/ferment correctement

#### Pages principales
- [ ] Page d'accueil (`index.php`) s'affiche
- [ ] Page dashboard fonctionne
- [ ] Page modules s'affiche avec les liens
- [ ] Page agents fonctionne
- [ ] Page contact fonctionne
- [ ] Page privacy-policy accessible

#### Configuration
- [ ] Page mail-config accessible et fonctionnelle
- [ ] Page analyse-intention-config accessible
- [ ] Les formulaires de configuration sauvegardent

### 2. Tests Backend (API)

#### Connexion
- [ ] Backend Node.js démarre sans erreur
- [ ] MongoDB se connecte correctement
- [ ] API `/api/health` répond

#### Modules
- [ ] Module mail accessible (`/api/mail/*`)
- [ ] Module facebook accessible (`/api/facebook/*`)
- [ ] Module analyse-intention accessible (`/api/analyse/*`)

#### Authentification
- [ ] Login fonctionne
- [ ] JWT fonctionne pour les routes protégées
- [ ] Déconnexion fonctionne

### 3. Tests Intégration

#### Frontend → Backend
- [ ] Les appels API depuis le frontend fonctionnent
- [ ] Les erreurs sont gérées correctement
- [ ] Les timeouts sont gérés

#### BackendIA
- [ ] BackendIA démarre
- [ ] Connection à Ollama fonctionne
- [ ] Test d'analyse d'intention fonctionne

### 4. Tests Environnement

#### Localhost
- [ ] Tout fonctionne en localhost (`http://localhost/gdri/frontend/`)
- [ ] BASE_URL détecté correctement
- [ ] API_BASE_URL pointe vers `http://localhost:3000/api`

#### Production (simulation)
- [ ] Vérifier que BASE_URL sera `/frontend/` en production
- [ ] Vérifier que API_BASE_URL sera `https://www.gdri.fr/api`

### 5. Tests de Régression

- [ ] Aucune fonctionnalité existante n'est cassée
- [ ] Les données existantes sont toujours accessibles
- [ ] Les migrations de base de données sont OK (si applicable)

## 🚀 Script de Test Rapide

Utilisez `test-quick.sh` ou `test-quick.ps1` pour un test rapide.

## 📝 Notes

- Tester sur **localhost** avant de merger
- Si possible, tester sur un **environnement de staging** (copie de production)
- **JAMAIS** merger dans master sans avoir testé

