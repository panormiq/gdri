# SDK Connecteurs GDRI

> **Statut** : spécification v1 — socle pour connecteurs installables (style briques n8n).  
> Voir aussi : [`CMS-CHARTE.md`](CMS-CHARTE.md), [`ARCHITECTURE-MODULES.md`](ARCHITECTURE-MODULES.md).

## Objectif

Permettre à la plateforme et à des tiers de publier des **connecteurs installables** qui :

- reçoivent des événements (**entrée** : webhook, poll, manuel),
- envoient des actions (**sortie** : HTTP, mail, réseau social…),
- normalisent tout vers un **message canonique** consommé par les agents IA.

Le développeur livre un **package** ; l'utilisateur final configure des **instances** via une UI générée depuis le manifeste.

---

## Architecture

```
Développeur                    Plateforme GDRI                 Utilisateur
──────────                    ───────────────                 ──────────
connectors/acme-crm/    →     ConnectorRegistry        →      Instance « CRM support »
  connector.json                ConnectorRuntime                Branchée à un agent flow
  index.js                      ConnectorScheduler
```

### Emplacements découverts

| Chemin | Rôle |
|--------|------|
| `backend/connectors/<id>/` | Connecteurs core (livré avec GDRI) |
| `connectors/<id>/` | Connecteurs externes / marketplace |

Chaque dossier doit contenir **`connector.json`** + **`index.js`**.

---

## Message canonique

Tous les connecteurs produisent la même structure :

```json
{
  "id": "evt-uuid",
  "source": "facebook",
  "sourceRef": "message-id-externe",
  "entrepriseId": "abc123",
  "instanceId": "inst-uuid",
  "text": "Quels sont vos horaires ?",
  "author": { "id": "user-1", "name": "Jean Dupont", "email": null },
  "timestamp": "2026-07-10T09:00:00.000Z",
  "attachments": [],
  "metadata": {}
}
```

Fichier de référence : `backend/core/connectors/canonical-message.js`.

---

## Contrat `BaseConnector`

```js
const { BaseConnector } = require('../../backend/core/connectors/BaseConnector');

class MyConnector extends BaseConnector {
  async testConnection(ctx) {
    return { success: true, message: 'OK' };
  }

  /** Webhook / push */
  async ingestPush(ctx, req) {
    const raw = req.body;
    return [this.normalize(raw, ctx.instance.mapping)];
  }

  /** Poll planifié ou manuel */
  async ingestPoll(ctx, cursor) {
    return { messages: [], cursor };
  }

  /** Sortie : reply, alert, http… */
  async emit(ctx, operation, payload) {
    return { success: true };
  }
}

module.exports = MyConnector;
```

### Contexte `ctx`

```js
{
  entrepriseId: '...',
  instance: { /* document Mongo connector_instances */ },
  secrets: { /* credentials résolus */ },
  database: /* accès Mongo entreprise si besoin */
}
```

---

## Format `connector.json` (manifeste)

```json
{
  "id": "http-generic",
  "name": "HTTP générique",
  "version": "1.0.0",
  "author": "GDR-Innovation",
  "description": "Webhook ou poll HTTP avec mapping JSON",
  "direction": "bidirectional",
  "compatiblePlatform": ">=1.0.0",
  "capabilities": ["ingest.push", "ingest.poll", "emit.http"],
  "credentials": {
    "type": "none"
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "pollIntervalMinutes": {
        "type": "number",
        "title": "Intervalle de poll (minutes)",
        "minimum": 1,
        "default": 5
      }
    }
  },
  "operations": {
    "ingest.push": { "description": "Réception webhook" },
    "ingest.poll": { "description": "Lecture HTTP périodique" },
    "emit.http": { "description": "Envoi HTTP POST" }
  },
  "permissions": ["network"]
}
```

### Champs manifeste

| Champ | Description |
|-------|-------------|
| `id` | Identifiant unique (slug) |
| `direction` | `input` \| `output` \| `bidirectional` |
| `capabilities` | Ops supportées (`ingest.push`, `ingest.poll`, `emit.*`) |
| `credentials.type` | `none` \| `api_key` \| `bearer` \| `basic` \| `oauth2` |
| `configSchema` | JSON Schema → formulaire admin auto-généré |
| `operations` | Doc + métadonnées des ops (handlers dans le code) |
| `permissions` | `network`, `secrets`, `entity-data` (futur sandbox) |

---

## Instance connecteur (config utilisateur)

Collection Mongo : `connector_instances`

```json
{
  "entrepriseId": "abc123",
  "connectorId": "http-generic",
  "name": "Webhook CRM",
  "enabled": true,
  "settings": {
    "pollIntervalMinutes": 3,
    "pollUrl": "https://api.example.com/inbox",
    "emitUrl": "https://api.example.com/reply"
  },
  "mapping": {
    "text": "body",
    "author.name": "contact.name",
    "sourceRef": "ticket_id"
  },
  "ingestModes": ["push", "poll"],
  "presetId": "crm-ticket",
  "credentials": {},
  "created_at": "2026-07-10T00:00:00.000Z"
}
```

À la création, la plateforme fusionne automatiquement : `configSchema` defaults → `instanceDefaults` → preset choisi (`presetId`) → valeurs envoyées par l'utilisateur.

---

## Templates d'instance (`instanceDefaults` / `presets`)

Chaque connecteur peut embarquer des modèles pour préremplir les instances.

### `instanceDefaults` (connecteur codé)

Un seul modèle par défaut — utilisé pour mail, Facebook, etc.

```json
"instanceDefaults": {
  "ingestModes": ["poll"],
  "settings": {
    "mailbox": "INBOX",
    "pollIntervalMinutes": 3,
    "unseenOnly": true
  },
  "mapping": {
    "text": "text",
    "author.email": "fromEmail",
    "author.name": "fromName",
    "sourceRef": "uid",
    "metadata.subject": "subject"
  }
}
```

### `presets` (connecteur déclaratif)

Plusieurs modèles au choix — utilisé pour `http-generic`.

```json
"presets": [
  {
    "id": "webhook-simple",
    "name": "Webhook simple",
    "description": "Réception HTTP — le tiers POST vers GDRI",
    "ingestModes": ["push"],
    "mapping": { "text": "message", "sourceRef": "id" }
  },
  {
    "id": "crm-ticket",
    "name": "CRM tickets",
    "ingestModes": ["push", "poll"],
    "settings": { "pollIntervalMinutes": 5 },
    "mapping": { "text": "body", "sourceRef": "ticket_id" },
    "emitBody": { "reply": "{{message.text}}" }
  }
]
```

### Fusion à la création

Fichier : `backend/core/connectors/instance-defaults.js`

```
configSchema defaults  →  instanceDefaults  →  preset  →  payload utilisateur
```

L'utilisateur ne configure que les champs qui diffèrent du modèle.

---

## Flux agent (futur proche)

Collection `agent_flows` :

```json
{
  "entrepriseId": "abc123",
  "name": "Support réseaux",
  "inputs": [{ "instanceId": "inst-fb-page1" }],
  "agent": "analyse-intention",
  "agentConfigRef": "default",
  "outputs": [
    { "instanceId": "inst-mail-out", "when": "intention.urgent" }
  ]
}
```

L'orchestrateur (`ConnectorRuntime`) reçoit un message canonique, appelle l'agent, puis route vers les sorties.

---

## API plateforme (v1)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/connectors` | Liste des types installés |
| GET | `/api/connectors/:id` | Manifeste + liste des presets |
| GET | `/api/connectors/:id/template` | Template résolu (`?presetId=`) (JWT) |
| GET | `/api/connectors/instances` | Instances de l'entité (JWT) |
| POST | `/api/connectors/instances` | Créer une instance (`presetId` optionnel) (JWT) |
| PUT | `/api/connectors/instances/:id` | Modifier (JWT) |
| POST | `/api/connectors/instances/:id/test` | Tester la connexion (JWT) |
| POST | `/api/connectors/instances/:id/poll` | Poll manuel (JWT) |
| POST | `/api/connectors/webhook/:instanceId` | Webhook public (selon config) |

---

## Connecteurs livrés

| ID | Statut | Description |
|----|--------|-------------|
| `http-generic` | ✅ Fonctionnel | Webhook + poll + emit HTTP + 3 presets |
| `facebook` | 📋 Manifeste + stub | instanceDefaults Graph/Meta |
| `mail-in` | ✅ Fonctionnel | instanceDefaults IMAP + sync auto |
| `mail-out` | ✅ Fonctionnel | instanceDefaults SMTP + sync auto |
| `_template` | 📄 Modèle | Copier pour créer un connecteur tiers |

---

## Créer un connecteur tiers

1. Copier `connectors/_template/` vers `connectors/mon-connecteur/`.
2. Éditer `connector.json` (id, capabilities, configSchema).
3. Implémenter `index.js` (étendre `BaseConnector`).
4. Redémarrer le backend ou appeler le rechargement admin.
5. Créer une instance via l'API ou l'UI (à venir).

---

## Niveaux de richesse

| Niveau | Quand | Exemple |
|--------|-------|---------|
| Déclaratif | API REST simple | `http-generic` |
| Adaptateur | OAuth, signatures, protocoles | `facebook`, `mail-in` |
| Hybride | Manifeste riche + code ciblé | Instagram, LinkedIn |

Même modèle d'installation ; seule la profondeur du package change.

---

## Sécurité (roadmap)

- Validation du manifeste au chargement
- Permissions par connecteur (`network`, `secrets`…)
- Signature packages marketplace
- Sandbox d'exécution pour connecteurs communauté
- Secrets chiffrés par entité (pas en clair dans `connector_instances`)

---

## Fichiers core

```
backend/core/connectors/
├── canonical-message.js
├── BaseConnector.js
├── ConnectorRegistry.js
├── ConnectorRuntime.js
├── ConnectorInstanceService.js
├── ConnectorScheduler.js
├── instance-defaults.js
├── connector-loader.js
├── path-utils.js
└── template-resolver.js
```

---

*Le connecteur transporte. L'agent décide. L'infra fournit mail/IA/prompt.*
