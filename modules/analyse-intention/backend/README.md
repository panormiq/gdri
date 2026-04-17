# Module Analyse d'intention (backend)

Module pour l'analyse automatique des intentions dans les messages (Facebook, etc.).

## Emplacement

- **Backend** : `modules/analyse-intention/backend/`
- **Frontend (config)** : `frontend/pages/modules/analyse-intention-config.php`

## Structure

```
modules/analyse-intention/
├── backend/
│   ├── index.js           # Point d'entrée (découvert par module-registry)
│   ├── routes.js          # Routes API /api/analyse
│   ├── config.json
│   ├── package.json       # name, displayName, routes
│   ├── services/
│   │   ├── IntentionService.js
│   │   └── AIService.js   # Ollama
│   └── README.md
└── frontend/              # Voir frontend/pages/modules/analyse-intention-config.php
```

## API

- **POST /api/analyse** — Analyser les intentions (body: `messages`, `customRules`, `entrepriseId`)
- **GET /api/analyse/config** — Configuration du module
- **GET /api/analyse/test** — Test connexion Ollama
- **GET/POST /api/analyse/agent-config** — Config agent IA (JWT)
- **POST /api/analyse/suggest-reply** — Suggestion de réponses (JWT)

## Configuration

Variables d'environnement :

- `OLLAMA_URL` : URL Ollama (défaut: http://localhost:11434)
- `OLLAMA_MODEL` : Modèle (défaut: mistral:latest)
