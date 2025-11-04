# Module Mail - Service générique d'envoi d'emails

Service générique d'envoi et de réception d'emails pour les modules GDRI.

## Fonctionnalités

- ✅ Mode **standalone** : Utilisation simple avec collection par défaut
- ✅ Mode **configuré** : Configuration par module avec collections dédiées
- ✅ **Multi-profils SMTP** : Plusieurs adresses d'envoi par module
- ✅ **Routing intelligent** : Sélection automatique du profil selon contexte
- ✅ **Collections séparées** : Sécurité via collections dédiées par module
- ✅ **Templates gérés par module** : Chaque module gère ses propres templates

## Installation

Le module Mail est automatiquement chargé par le système de modules.

## Utilisation

### Mode Standalone (simple)

```javascript
const mailModule = require('../../modules/mail');
const mail = mailModule.getMailService();

// Envoi simple (nécessite configuration SMTP via initModule)
await mail.send({
  to: 'user@example.com',
  subject: 'Test',
  body: 'Corps du message'
});
```

### Mode Configuré (par module)

#### 1. Configuration dans votre module

```javascript
// backend/modules/mon-module/index.js
const mailModule = require('../../modules/mail');
const mail = mailModule.getMailService();

async function init(app, db) {
  // Configurer le module Mail pour ce module
  mail.initModule({
    module_name: 'mon-module',
    collection_name: 'emails_mon_module', // Optionnel, sinon auto
    smtp_profiles: {
      alerts: {
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'alerts@example.com',
            pass: process.env.ALERTS_SMTP_PASS
          }
        },
        from: {
          name: 'Mon Module - Alerts',
          email: 'alerts@example.com'
        }
      },
      reports: {
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'reports@example.com',
            pass: process.env.REPORTS_SMTP_PASS
          }
        },
        from: {
          name: 'Mon Module - Reports',
          email: 'reports@example.com'
        }
      }
    },
    routing_rules: [
      {
        condition: { priority: 'high', type: 'alert' },
        use_profile: 'alerts',
        default_to: 'admin@entite.fr'
      },
      {
        condition: { type: 'report' },
        use_profile: 'reports',
        default_to: 'reports@entite.fr'
      }
    ]
  });
}
```

#### 2. Utilisation dans le module

```javascript
// Envoi avec routing automatique
await mail.send({
  to: 'user@example.com',
  subject: 'Alerte importante',
  body: 'Corps du message',
  context: {
    priority: 'high',
    type: 'alert'
  },
  module_name: 'mon-module',
  entity_id: '1234567890abcdef12345678'
});

// Envoi avec profil explicite
await mail.send({
  to: 'user@example.com',
  subject: 'Rapport',
  body: 'Corps du message',
  profile: 'reports',
  module_name: 'mon-module',
  entity_id: '1234567890abcdef12345678'
});

// Envoi avec HTML
await mail.send({
  to: 'user@example.com',
  subject: 'Test HTML',
  body: 'Version texte',
  body_html: '<h1>Version HTML</h1>',
  module_name: 'mon-module'
});

// Envoi avec pièces jointes
await mail.send({
  to: 'user@example.com',
  subject: 'Avec fichiers',
  body: 'Voir pièces jointes',
  attachments: [
    { filename: 'document.pdf', path: '/chemin/vers/document.pdf' }
  ],
  module_name: 'mon-module'
});
```

#### 3. Récupération des emails

```javascript
// Récupérer les emails d'une entité
const emails = await mail.getEmails('1234567890abcdef12345678', {
  module_name: 'mon-module',
  status: 'sent',
  from_date: new Date('2024-01-01'),
  to_date: new Date('2024-12-31')
});
```

## Structure des données

### Collection d'emails

```javascript
{
  _id: ObjectId,
  module_name: String,          // 'mail' (standalone) ou 'mon-module'
  entity_id: ObjectId,          // Optionnel
  profile_used: String,          // 'alerts', 'reports', etc.
  to: String,
  from: {
    name: String,
    email: String
  },
  subject: String,
  body: String,
  body_html: String | null,
  attachments: Array,
  status: String,                // 'pending' | 'sent' | 'failed'
  sent_at: Date | null,
  error: String | null,
  message_id: String | null,
  context: Object,
  created_at: Date
}
```

## Collections

- **Mode standalone** : Collection `emails` (partagée)
- **Mode configuré** : Collection `emails_<module_name>` ou collection personnalisée

## Templates

Les templates sont gérés **par chaque module**, pas par le module Mail.

Exemple :
```
backend/modules/mon-module/
├── templates/
│   ├── alert.html
│   └── report.html
└── utils/
    └── template-engine.js
```

Le module Mail reçoit simplement le contenu final (texte/HTML).

## Sécurité

- Collections séparées par module
- Configuration SMTP isolée par module
- Pas de partage de données entre modules

