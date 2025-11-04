# BackendIA

Backend API pour l'intégration avec Ollama et Mistral avec architecture modulaire.

## 🏗️ Architecture

```
backendIA/
├── app/                          # Package principal de l'application
│   ├── core/                     # Configuration et utilitaires centraux
│   │   ├── __init__.py
│   │   ├── config.py            # Configuration de l'application
│   │   ├── database.py          # Modèles MongoDB avec MongoEngine
│   │   └── auth.py              # Authentification JWT et sécurité
│   ├── models/                   # Modèles de données
│   │   ├── __init__.py
│   │   └── schemas.py           # Schémas Pydantic pour validation
│   ├── routers/                  # Routes FastAPI modulaires
│   │   ├── __init__.py
│   │   ├── auth.py              # Routes d'authentification
│   │   ├── prompt.py            # Routes pour l'API de prompts
│   │   ├── admin.py             # Routes d'administration
│   │   ├── services.py          # Routes pour services externes
│   │   └── base.py              # Routes de base (health, info)
│   └── services/                 # Couche de services (logique métier)
│       ├── __init__.py
│       ├── ollama_client.py     # Client pour Ollama
│       ├── user_service.py      # Service de gestion des utilisateurs
│       └── prompt_service.py    # Service de gestion des prompts
├── main.py                       # Point d'entrée de l'application
├── requirements.txt              # Dépendances Python
├── test_app.py                   # Script de test
└── README.md                     # Documentation
```

## 🚀 Fonctionnalités

### Authentification
- Inscription et connexion des utilisateurs
- Authentification JWT avec tokens Bearer
- Gestion des rôles (user/admin)
- Protection des routes par authentification

### API de Prompts
- Génération de réponses via Ollama/Mistral
- Paramètres configurables (temperature, max_tokens, etc.)
- Support du streaming de réponses

### Administration
- Gestion des utilisateurs (admin uniquement)
- Statistiques de l'application
- Monitoring et health checks

### Services Externes
- API dédiée pour services externes (cron, admin tools)
- Authentification par tokens de service
- Actions configurables par service

## 🔧 Installation

1. **Cloner le repository**
   ```bash
   git clone <repository-url>
   cd backendIA
   ```

2. **Installer les dépendances**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configuration MongoDB**
   - Installer MongoDB
   - Créer un utilisateur et une base de données
   - Configurer l'URL dans `app/core/config.py`

4. **Configuration Ollama**
   ```bash
   ollama serve
   ollama pull mistral:latest
   ```

5. **Lancer l'application**
   ```bash
   python main.py
   ```
   
   Le serveur sera accessible sur :
   - **Local** : `http://localhost:8000`
   - **Réseau** : `http://VOTRE_IP:8000` (par défaut écoute sur `0.0.0.0`)

6. **Accès depuis un autre PC sur le réseau**
   
   Pour trouver votre adresse IP :
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   ```
   
   Assurez-vous que le port 8000 est autorisé dans le pare-feu :
   ```powershell
   # Windows (PowerShell en administrateur)
   New-NetFirewallRule -DisplayName "BackendIA" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
   ```

## 📊 API Endpoints

### Authentification (`/auth`)
- `POST /auth/register` - Inscription
- `POST /auth/login` - Connexion
- `GET /auth/me` - Profil utilisateur

### Prompts (`/api`)
- `POST /api/prompt` - Générer une réponse

### Administration (`/admin`)
- `GET /admin/users` - Liste des utilisateurs
- `GET /admin/stats` - Statistiques

### Services (`/service`)
- `POST /service` - API pour services externes

### Base
- `GET /health` - Health check
- `GET /` - Informations de base

## 🧪 Tests

Exécuter les tests :
```bash
python test_app.py
```

Le script de test vérifie :
- Imports de tous les modules
- Fonctionnalité de hachage des mots de passe
- Modèles Pydantic
- Configuration
- Architecture modulaire

## 🔒 Sécurité

- **Authentification JWT** : Tokens sécurisés pour l'API
- **Hachage bcrypt** : Mots de passe sécurisés
- **Tokens de service** : Accès contrôlé pour services externes
- **DEV_TOKEN** : Token de développement (désactiver en production !)
- **Validation Pydantic** : Validation stricte des données
- **CORS configuré** : Contrôle d'accès cross-origin

### 🧪 Mode Développement (DEV_TOKEN)

Pour simplifier le développement, un système de DEV_TOKEN est disponible :

**Token par défaut :** `dev-token-123456789-quick-access`

```python
# Exemple d'utilisation
headers = {"Authorization": "Bearer dev-token-123456789-quick-access"}
response = requests.post(
    "http://192.168.1.53:8000/api/prompt",
    headers=headers,
    json={"prompt": "Test"}
)
```

**⚠️ IMPORTANT** : Désactivez le DEV_TOKEN en production :
```python
# app/core/config.py
enable_dev_token: bool = False  # Mettre à False en production !
```

📚 **Documentation complète** : Voir [DEV_TOKEN_GUIDE.md](DEV_TOKEN_GUIDE.md)

## 🗄️ Base de données

L'application utilise **MongoDB** avec **MongoEngine** :

```python
# Exemple de modèle utilisateur
class User(Document):
    username = StringField(required=True, unique=True)
    email = StringField(required=True, unique=True)
    hashed_password = StringField(required=True)
    role = StringField(choices=["user", "admin"], default="user")
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.utcnow)
```

## 🤖 Intégration Ollama

### Configuration
```python
# Dans app/core/config.py
ollama_base_url: str = "http://localhost:11434"
ollama_model: str = "mistral:latest"
```

### Utilisation
```python
# Exemple de requête
{
    "prompt": "Explique l'intelligence artificielle",
    "temperature": 0.7,
    "max_tokens": 1000,
    "model": "mistral:latest"
}
```

## 🏛️ Architecture Modulaire

### Avantages de la nouvelle structure :

1. **Séparation des responsabilités** : Chaque module a un rôle spécifique
2. **Facilité de maintenance** : Code organisé et facile à modifier
3. **Testabilité** : Chaque composant peut être testé indépendamment
4. **Extensibilité** : Ajout facile de nouvelles fonctionnalités
5. **Réutilisabilité** : Services réutilisables dans différents contextes

### Couches de l'application :

- **`app/core/`** : Configurations, authentification, base de données
- **`app/models/`** : Schémas de validation des données
- **`app/routers/`** : Définition des endpoints API
- **`app/services/`** : Logique métier et services externes
- **`main.py`** : Initialisation et configuration de l'application

## 🔧 Services Externes

L'API `/service` permet aux services externes d'interagir avec le backend :

### Exemple pour service cron :
```bash
curl -X POST "http://localhost:8000/service" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "cron",
    "action": "health_check",
    "service_token": "cron-service-token-987654321-xyz"
  }'
```

### Actions disponibles :
- **Cron** : `health_check`, `cleanup`, `stats`
- **Admin** : `user_management`, `system_info`

## 📈 Monitoring

- Health check : `GET /health`
- Statistiques admin : `GET /admin/stats`
- Logs de démarrage détaillés
- Gestion des erreurs centralisée

## 🚀 Déploiement

Pour déployer en production :

1. Configurer les variables d'environnement
2. Utiliser un serveur WSGI (Gunicorn)
3. Configurer un reverse proxy (Nginx)
4. Sécuriser MongoDB
5. Configurer les logs
6. Mettre en place le monitoring

---

**Documentation API interactive** : `http://localhost:8000/docs`