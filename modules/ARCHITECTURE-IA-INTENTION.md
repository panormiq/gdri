# Architecture IA et module Analyse d’intention

## Vision

- **Module IA** : point d’accès unique à l’IA (Ollama, puis ChatGPT/Claude/DeepSeek). Priorité au **serveur IA** (backendIA) pour éviter de saturer Ollama et pour centraliser la gestion (files d’attente, retries, multi-backends plus tard).
- **Module Analyse d’intention** : utilise le module IA ; définit le **prompt** (partie fixe + partie configurable), la **liste d’intentions** (JSON) et le **format de réponse** attendu.

## 1. Pourquoi passer par un serveur IA (backendIA)

- Aujourd’hui : les modules Node appellent **Ollama en direct** → risque de surcharge si beaucoup de requêtes (Facebook, cron, chat, etc.).
- Objectif : **toutes** les requêtes IA passent par **backendIA** (Python) qui :
  - **Pour l’instant** : reçoit la requête et la transmet en brut à Ollama, renvoie la réponse (même comportement qu’aujourd’hui, mais en proxy).
  - **Plus tard** : file d’attente, rate limiting, retries, puis bascule possible vers OpenAI/Claude/DeepSeek sans toucher aux appels côté Node.

## 2. Division en deux modules

| Module | Rôle |
|--------|------|
| **`ia`** | Connexion à l’IA. Priorité : serveur IA local (backendIA). Prévoir ensuite les API des grands fournisseurs (ChatGPT, Claude, DeepSeek). |
| **`analyse-intention`** | Détection d’intentions. Utilise le module `ia` ; définit prompt (fixe + configurable), intentions (JSON), format de réponse. |

C’est cohérent : un module “moteur IA” réutilisable, un module “métier” (intentions) qui s’appuie dessus.

## 3. Flux technique

```
[Facebook / Chat / UGAP / …]
        ↓
[Module analyse-intention ou autre]
        ↓
[Module ia]  ←  client unique (getIAClient())
        ↓
[backendIA (Python)]  ←  priorité, configurable (IA_SERVER_URL)
        ↓
[Ollama]  (pour l’instant ; plus tard autres backends côté backendIA)
```

- Si **backendIA** n’est pas configuré ou injoignable : le module `ia` peut prévoir un **fallback** direct vers Ollama (optionnel, pour transition ou dev).
- Plus tard : le module `ia` (ou backendIA) pourra aussi appeler OpenAI, Claude, DeepSeek selon la config.

## 4. backendIA (serveur IA)

- **Existant** : FastAPI, `ollama_client`, route `/api/prompt` (JWT user) et `/service` (token cron + action `ai_task`).
- **À faire (phase 1)** :
  - Endpoint dédié **POST /api/generate** : reçoit `{ "prompt", "model?", "temperature?", "max_tokens?", "stream?" }`, transmet à Ollama, renvoie la réponse. Authentification par **token de service** (ou DEV_TOKEN en dev) pour que le backend Node l’appelle sans JWT utilisateur.
- Comportement : **proxy brut** vers Ollama (même contrat qu’aujourd’hui), sans file d’attente ni logique métier pour l’instant.

## 5. Module `ia` (modules/ia)

- **Rôle** : fournir un **client** que les autres modules utilisent pour envoyer un prompt et recevoir une réponse.
- **Config** (env) : `IA_SERVER_URL` (ex. `http://localhost:8000`), `IA_SERVICE_TOKEN` (token backendIA pour `/api/generate` ou `/service`).
- **Comportement** :
  - Si `IA_SERVER_URL` est défini : appeler backendIA (POST /api/generate ou /service).
  - Sinon (optionnel) : fallback appel direct Ollama pour compatibilité / dev.
- **API exposée** (pour les autres modules) : `getIAClient()` → `client.generate(prompt, options)` → `{ success, data: { response, model, processing_time } }`.
- Pas de routes HTTP propres nécessaires (ou une route minimale type GET /api/ia/health pour vérifier backendIA).

## 6. Module `analyse-intention`

- **S’appuie sur** le module `ia` (plus d’appel direct à Ollama).
- **Configuration “Agent IA”** (côté front / config) :
  - **Prompt** : partie fixe + partie éditable par l’utilisateur.
  - **Liste d’intentions** : format JSON (ex. catégories, libellés).
  - **Format de réponse attendu** : à attacher à la config (ex. schéma JSON attendu en sortie).
- Le service d’analyse construit le prompt à partir de cette config, appelle le module `ia`, parse la réponse selon le format défini.

## 7. Autres modules (Facebook, Chat, UGAP)

- **Facebook** (WebhookService), **Chat**, **UGAP** : aujourd’hui ils utilisent `AIService` (ou équivalent) du module analyse-intention.
- **Évolution** : ils utilisent tous le **module `ia`** pour les appels IA (via `getIAClient()` ou équivalent), afin que toute la charge passe par le serveur IA et non plus directement vers Ollama.

## 8. Résumé

- **backendIA** : proxy vers Ollama (+ plus tard file d’attente, multi-backends). Nouvel endpoint **POST /api/generate** avec token de service.
- **Module `ia`** : client unique, priorité backendIA, fallback Ollama optionnel ; prévu pour intégrer plus tard les API des grands fournisseurs.
- **Module `analyse-intention`** : métier “détection d’intentions”, utilise le module `ia` ; config = prompt (fixe + utilisateur), intentions JSON, format de réponse.
- **Facebook / Chat / UGAP** : basculés sur le module `ia` au lieu d’appeler l’ancien AIService du module analyse-intention.
