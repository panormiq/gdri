# Module IA (backend)

Point d’accès unique à l’IA pour tous les modules (analyse-intention, chat, ugap, facebook, etc.).

## Objectifs

- **Paramétrer les LLM utilisables** : local (via serveur IA / Ollama), clés API (GPT, Claude, DeepSeek, etc.).
- **Backoffice** : connexion à la base de l’entité, enregistrement des LLMs par entité, gestion des droits utilisateur par LLM.
- **Front (user)** : vide pour l’instant ; les autres modules consomment l’API IA.

## Comportement

- **Priorité** : si `IA_SERVER_URL` est défini, le client appelle le **serveur IA** (backendIA) en `POST /api/generate` avec le token `IA_SERVICE_TOKEN`.
- **Fallback** : sinon, appel direct à Ollama (comportement identique à avant la mise en place du proxy).

## Variables d’environnement (backend Node)

- `IA_SERVER_URL` : URL du serveur IA (ex. `http://localhost:8000`).
- `IA_SERVICE_TOKEN` : token pour authentifier les appels à backendIA (même valeur que `IA_SERVICE_TOKEN` dans backendIA).
- En dev, backendIA accepte aussi `DEV_TOKEN` ; on peut utiliser `BACKENDIA_DEV_TOKEN` côté Node pour la même valeur.
- `OLLAMA_URL`, `OLLAMA_MODEL` : utilisés en fallback direct (et par backendIA).

## API exposée aux autres modules

- `getIAClient(config?)` : retourne le client singleton (config globale / legacy).
- `getIAClientForEntity(entityId, llmId?)` : retourne un client configuré avec le LLM de l’entité (par id ou défaut). Pour usage dans les autres modules ou via `POST /api/ia/generate`.
- Le client expose :
  - `generate(prompt, options)` → `{ success, data: { response, model, processing_time } }`
  - `sendAnalysisPrompt(prompt, options)` : alias de `generate`
  - `testConnection()` → `{ success, message }`

## Routes HTTP

### Usage app (génération par entité)

- `POST /api/ia/generate` (JWT + entité) : génère une réponse avec le LLM de l’entité (body : `prompt`, `llm_id?`, `temperature?`, `max_tokens?`). Repli sur config globale si aucun LLM pour l’entité.

### Publiques / config globale (legacy)

- `GET /api/ia/health` : test de connexion.
- `GET /api/ia/providers` : liste des fournisseurs et modèles (pour la page config).
- `GET /api/ia/config` (JWT) : configuration globale enregistrée (clés masquées).
- `POST /api/ia/config` (JWT) : enregistrer une config globale (provider, modèle, clés).

### CRUD LLMs (backoffice, scopé par entité)

Toutes ces routes exigent **JWT** et une **entité** (entreprise sélectionnée). Pour un **ADMIN_GDRI**, l’entité peut être fournie en query : `?entity_id=...`.

- `GET /api/ia/llms` : liste des LLMs de l’entité.
- `GET /api/ia/llms/:id` : détail d’un LLM.
- `POST /api/ia/llms` : créer un LLM (body : `name`, `provider`, `model`, `serverUrl` / `serviceToken` / `ollamaUrl` / `apiKey`, `is_default`).
- `PUT /api/ia/llms/:id` : modifier un LLM.
- `DELETE /api/ia/llms/:id` : supprimer un LLM.

### Droits utilisateur LLM (backoffice)

- `GET /api/ia/entity-users` : liste des utilisateurs de l’entité (pour la page droits).
- `GET /api/ia/rights` : liste des droits (user_id → llm_ids) pour l’entité.
- `GET /api/ia/rights/user/:userId` : LLMs autorisés pour un utilisateur.
- `PUT /api/ia/rights/user/:userId` : définir les LLMs autorisés (body : `{ llm_ids: string[] }`).

## Données (base principale GDR-INNOVATION)

- **ia_config** : config globale legacy (une seule config).
- **ia_llms** : un document par LLM, avec `entity_id`, `name`, `provider`, `model`, credentials, `is_default`, `created_at`, `updated_at`.
- **ia_llm_user_rights** : par entité et utilisateur, liste des `llm_ids` autorisés (`entity_id`, `user_id`, `llm_ids[]`).

## Frontend / Backoffice

- **Page de configuration (legacy)** : `frontend/pages/modules/ia-config.php` — config globale (Ollama, OpenAI, Claude, DeepSeek).
- **Backoffice à prévoir** : gestion des LLMs de l’entité ; page de gestion des droits (LLMs autorisés par utilisateur) via les routes ci-dessus.
