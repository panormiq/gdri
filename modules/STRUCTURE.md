# Structure type d’un module (réutilisable)

Ce document décrit le **modèle à suivre pour la plupart des modules** : backend, front (app utilisateur), backoffice, et organisation des API. Le module **IA** est la référence implémentée.

---

## 1. Les trois facettes d’un module

| Facette | Rôle | Où ça vit |
|--------|------|-----------|
| **Backend** | API, logique métier, accès données | `modules/<nom>/backend/` (routes montées sous `/api/<nom>`) |
| **Front (app user)** | Pages utilisées par les utilisateurs finaux | Pages dans `frontend/pages/modules/` ; le dossier `modules/<nom>/frontend/` peut ne contenir qu’un README qui pointe vers ces pages |
| **Backoffice** | Config du module par entité, droits, paramètres | Même front principal : `frontend/pages/modules/<nom>-config.php`, `<nom>-llms.php`, etc. |

- **Un seul front** : une seule app (frontend principal) avec une **zone user** (apps) et une **zone backoffice** (admin). Les pages backoffice appellent les routes d’admin du module.

---

## 2. Organisation des API (backend)

On peut distinguer deux familles de routes (même si aujourd’hui tout est sous `/api/<nom>/`) :

- **Usage « app » (user)** : routes consommées par le front utilisateur (ex. génération, envoi, analyse). Ex. : `POST /api/ia/generate`, `POST /api/analyse/intent`.  
  → À terme possibles sous un préfixe commun type `/api/user/...` pour clarifier.

- **Backoffice** : routes de configuration (CRUD, droits, listes pour les écrans admin). Ex. : `GET/POST /api/ia/llms`, `GET/PUT /api/ia/rights/user/:userId`.  
  → À terme possibles sous `/api/bo/...` (backoffice).

Pour l’instant, les deux coexistent sous `/api/<nom>/`. Lors d’un refactor global, on pourra monter les routes user sous `/api/user/<nom>/` et les routes backoffice sous `/api/bo/<nom>/`.

---

## 3. Scoping par entité (backoffice)

- Les routes backoffice qui dépendent d’une **entité** (entreprise) utilisent l’entité courante du JWT : `req.user.currentEntrepriseId` ou `req.user.entrepriseId`.
- Si l’utilisateur n’a pas d’entité (ex. pas d’entreprise sélectionnée), renvoyer **403** avec un message clair.
- **ADMIN_GDRI** peut agir pour une entité en passant `?entity_id=...` en query sur les routes backoffice.

---

## 4. Contrat backend d’un module

- **`backend/package.json`** : `name`, `displayName`, `version`, `routes` (ex. `["/api/ia"]`), et optionnellement un bloc **`app`** pour le catalogue d’apps (id, label, description, tags, icon, entryPath, configPath).
- **`backend/index.js`** : exporte au minimum `init`, `routes` (getRoutes), et les helpers utiles aux autres modules (ex. `getIAClient`, `getIAClientForEntity`).
- **`backend/routes.js`** : routes Express ; protéger les routes sensibles avec `authenticateJWT` et, pour le backoffice, un middleware « entité requise » si besoin.

---

## 5. Référence : module IA

- **Backend** : `modules/ia/backend/` — routes `/api/ia/*` (providers, config, llms CRUD, rights, entity-users, generate, health).
- **Backoffice** :  
  - `frontend/pages/modules/ia-config.php` (config globale legacy),  
  - `frontend/pages/modules/ia-llms.php` (CRUD LLMs par entité),  
  - `frontend/pages/modules/ia-llm-rights.php` (droits LLM par utilisateur).
- **Front (user)** : vide pour l’instant ; les autres modules appellent `POST /api/ia/generate` ou `getIAClientForEntity()`.
- **Données** : collections en base principale (ex. `ia_llms`, `ia_llm_user_rights`), scopées par `entity_id`.

En s’inspirant de ce modèle (backend + front + backoffice, scoping entité, un seul front avec deux zones), la plupart des modules peuvent garder la même structure.
