/**
 * Liste des fournisseurs IA et modèles disponibles.
 * Fichier : modules/ia/backend/data/providers.js
 */

module.exports = [
  {
    id: 'ollama_server',
    label: 'Ollama via serveur IA (backendIA)',
    description: 'Recommandé : passe par le serveur Python (proxy, file d\'attente). Modèles locaux.',
    fields: ['serverUrl', 'serviceToken', 'model'],
    models: [
      'mistral:latest',
      'mistral:7b',
      'llama3.2:latest',
      'llama3.1:latest',
      'llama2:latest',
      'codellama:latest',
      'mixtral:latest',
      'gemma:latest',
      'phi:latest',
      'qwen:latest',
      'custom'
    ],
    modelLabel: 'Modèle Ollama (ollama list)'
  },
  {
    id: 'ollama_direct',
    label: 'Ollama direct',
    description: 'Connexion directe à Ollama (sans serveur IA). Même liste de modèles.',
    fields: ['ollamaUrl', 'model'],
    models: [
      'mistral:latest',
      'mistral:7b',
      'llama3.2:latest',
      'llama3.1:latest',
      'llama2:latest',
      'codellama:latest',
      'mixtral:latest',
      'gemma:latest',
      'phi:latest',
      'qwen:latest',
      'custom'
    ],
    modelLabel: 'Modèle Ollama'
  },
  {
    id: 'openai',
    label: 'OpenAI (ChatGPT)',
    description: 'API OpenAI : GPT-4o, GPT-4, GPT-3.5. Clé API requise.',
    fields: ['apiKey', 'model'],
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1-preview',
      'o1-mini'
    ],
    modelLabel: 'Modèle OpenAI'
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    description: 'API Anthropic : Claude 3.5, Claude 3. Clé API requise.',
    fields: ['apiKey', 'model'],
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ],
    modelLabel: 'Modèle Claude'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'API DeepSeek. Clé API requise.',
    fields: ['apiKey', 'model'],
    models: [
      'deepseek-chat',
      'deepseek-coder',
      'deepseek-reasoner'
    ],
    modelLabel: 'Modèle DeepSeek'
  }
];
