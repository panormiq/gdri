# Module Analyse d'Intention

Module pour l'analyse automatique des intentions dans les messages Facebook.

## Fonctionnalités

- Analyse multi-intentions des messages
- Détection automatique des catégories (commercial, SAV, technique, etc.)
- Intégration avec le backendIA (Ollama)
- Sauvegarde des analyses dans MongoDB

## Structure

```
backend/modules/analyse-intention/
├── index.js                    # Point d'entrée
├── routes.js                   # Routes API
├── config.json                 # Configuration
├── services/
│   ├── IntentionService.js     # Service d'analyse
│   └── AIService.js            # Service IA (backendIA)
└── README.md                    # Ce fichier
```

## API

### POST /api/analyse
Analyser les intentions d'un ou plusieurs messages.

**Body:**
```json
{
  "messages": [
    {
      "message": "Bonjour, j'ai un problème",
      "author": { "name": "John Doe" },
      "created_time": "2024-01-01T00:00:00Z"
    }
  ],
  "customRules": ["Règle personnalisée"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analyses": [...]
  },
  "metadata": {
    "processingTime": 2.5,
    "model": "mistral:latest"
  }
}
```

### GET /api/analyse/config
Obtenir la configuration du module.

### GET /api/analyse/test
Tester la connexion au backendIA.

## Configuration

Variables d'environnement :
- `BACKENDIA_URL` : URL du backendIA (défaut: http://localhost:8000)
- `BACKENDIA_APP_TOKEN` : Token d'authentification

