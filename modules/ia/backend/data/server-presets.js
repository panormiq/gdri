/**
 * Presets serveurs IA (en dur). Utilisés pour créer un serveur en base (ia_servers).
 * Dernière vérification des endpoints : à mettre à jour si un provider change son API.
 * Fichier : modules/ia/backend/data/server-presets.js
 */

module.exports = [
  {
    id: 'backendia',
    label: 'Serveur IA distant (backendIA)',
    description: 'Backend Python proxy Ollama, file d\'attente. Modèles locaux sur le serveur.',
    provider: 'ollama_server',
    scope: 'global',
    defaults: {
      baseUrl: 'http://127.0.0.1:8000',
      auth: { type: 'bearer', serviceToken: '' },
      endpoints: {
        prompt: '/api/generate',
        health: '/health',
        models: '/api/models',
        modelsAdd: '',
        modelsDelete: ''
      },
      defaultModel: 'mistral:latest'
    },
    lastCheckedAt: null
  },
  {
    id: 'ollama_local',
    label: 'Serveur IA local (Ollama)',
    description: 'Ollama sur la machine (PC client ou serveur). Sans internet.',
    provider: 'ollama_direct',
    scope: 'global',
    defaults: {
      baseUrl: 'http://127.0.0.1:11434',
      auth: null,
      endpoints: {
        prompt: '/api/generate',
        health: '/api/tags',
        models: '/api/tags',
        modelsAdd: '/api/pull',
        modelsDelete: '/api/delete'
      },
      defaultModel: 'mistral:latest'
    },
    lastCheckedAt: null
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT)',
    description: 'API OpenAI. Clé API requise.',
    provider: 'openai',
    scope: 'global',
    defaults: {
      baseUrl: 'https://api.openai.com/v1',
      auth: { type: 'bearer', apiKey: '' },
      endpoints: {
        prompt: '/chat/completions',
        health: '',
        models: '/models',
        modelsAdd: '',
        modelsDelete: ''
      },
      defaultModel: 'gpt-4o'
    },
    lastCheckedAt: null
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    description: 'API Anthropic. Clé API requise.',
    provider: 'anthropic',
    scope: 'global',
    defaults: {
      baseUrl: 'https://api.anthropic.com',
      auth: { type: 'bearer', apiKey: '' },
      endpoints: {
        prompt: '/v1/messages',
        health: '',
        models: '',
        modelsAdd: '',
        modelsDelete: ''
      },
      defaultModel: 'claude-3-5-sonnet-20241022'
    },
    lastCheckedAt: null
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'API DeepSeek. Clé API requise.',
    provider: 'deepseek',
    scope: 'global',
    defaults: {
      baseUrl: 'https://api.deepseek.com',
      auth: { type: 'bearer', apiKey: '' },
      endpoints: {
        prompt: '/v1/chat/completions',
        health: '',
        models: '',
        modelsAdd: '',
        modelsDelete: ''
      },
      defaultModel: 'deepseek-chat'
    },
    lastCheckedAt: null
  }
];
