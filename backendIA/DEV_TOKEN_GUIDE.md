# 🔑 Guide d'utilisation du DEV_TOKEN

## Qu'est-ce que le DEV_TOKEN ?

Le `DEV_TOKEN` est un token d'authentification simplifié pour le **développement uniquement**. Il vous permet de tester votre API sans avoir à créer de compte utilisateur ou à gérer des JWT.

## ⚠️ IMPORTANT - Sécurité

**🚨 NE JAMAIS UTILISER EN PRODUCTION !**

Le DEV_TOKEN doit être **désactivé en production** pour des raisons de sécurité.

Pour désactiver en production :
```python
# Dans app/core/config.py ou via variable d'environnement
enable_dev_token: bool = False
```

## 📋 Configuration

### Token par défaut
```
dev-token-123456789-quick-access
```

### Localisation
- **Fichier:** `app/core/config.py`
- **Variables:**
  - `DEV_TOKEN`: Le token lui-même
  - `enable_dev_token`: Active/désactive le système (True en dev, False en prod)

### Personnalisation via .env
Créez un fichier `.env` à la racine du projet :
```env
DEV_TOKEN=votre-token-personnalise-ici
enable_dev_token=True
```

## 🚀 Utilisation

### Python

```python
import requests

BASE_URL = "http://192.168.1.53:8000"
DEV_TOKEN = "dev-token-123456789-quick-access"

headers = {"Authorization": f"Bearer {DEV_TOKEN}"}

# Faire une requête
response = requests.post(
    f"{BASE_URL}/api/prompt",
    headers=headers,
    json={"prompt": "Bonjour !"}
)

print(response.json())
```

**Exemple complet:** Voir `example_dev_usage.py`

### JavaScript/Node.js

```javascript
const BASE_URL = "http://192.168.1.53:8000";
const DEV_TOKEN = "dev-token-123456789-quick-access";

const headers = {
    "Authorization": `Bearer ${DEV_TOKEN}`,
    "Content-Type": "application/json"
};

// Faire une requête
const response = await fetch(`${BASE_URL}/api/prompt`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
        prompt: "Bonjour !"
    })
});

const data = await response.json();
console.log(data);
```

**Exemple complet:** Voir `example_dev_usage.js`

### cURL

```bash
curl -X POST "http://192.168.1.53:8000/api/prompt" \
  -H "Authorization: Bearer dev-token-123456789-quick-access" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Bonjour !"}'
```

### Postman/Insomnia

1. **Type:** Bearer Token
2. **Token:** `dev-token-123456789-quick-access`
3. **URL:** `http://192.168.1.53:8000/api/prompt`

## 🔄 Comparaison : DEV_TOKEN vs JWT

| Critère | DEV_TOKEN | JWT (Production) |
|---------|-----------|------------------|
| **Simplicité** | ✅ Très simple | ⚠️ Nécessite login |
| **Sécurité** | ❌ Faible | ✅ Sécurisé |
| **Expiration** | ❌ Jamais | ✅ 30 minutes |
| **Multi-utilisateurs** | ❌ Non | ✅ Oui |
| **Traçabilité** | ❌ Limité | ✅ Complète |
| **Usage** | 🧪 Dev seulement | 🚀 Production |

## 📊 Utilisateur créé automatiquement

Lorsque vous utilisez le DEV_TOKEN, un utilisateur virtuel est créé automatiquement :

- **Username:** `dev_user`
- **Email:** `dev@backendai.local`
- **Role:** `admin`
- **Permissions:** Accès complet à toutes les routes

## 🎯 Routes accessibles avec le DEV_TOKEN

### ✅ Routes autorisées
- `GET /` - Health check
- `GET /auth/me` - Informations utilisateur
- `POST /api/prompt` - Génération de texte IA
- Toutes les routes nécessitant une authentification utilisateur

### ❌ Routes NON accessibles
- `POST /service` - Routes de service (nécessitent CRON_TOKEN ou ADMIN_TOKEN)
- Routes spécifiques admin via `/admin/*`

## 🔐 Migration vers la production

### Étape 1 : Désactiver le DEV_TOKEN

```python
# app/core/config.py
enable_dev_token: bool = False
```

Ou via `.env` :
```env
enable_dev_token=False
```

### Étape 2 : Utiliser JWT

```python
# 1. S'enregistrer
response = requests.post(
    f"{BASE_URL}/auth/register",
    json={
        "username": "mon_app",
        "email": "app@example.com",
        "password": "motdepasse_securise"
    }
)

# 2. Se connecter
response = requests.post(
    f"{BASE_URL}/auth/login",
    json={
        "username": "mon_app",
        "password": "motdepasse_securise"
    }
)
token = response.json()["access_token"]

# 3. Utiliser le token JWT
headers = {"Authorization": f"Bearer {token}"}
```

## 🛠️ Tests rapides

### Tester le serveur
```bash
python example_dev_usage.py
```

### Tester avec Node.js
```bash
node example_dev_usage.js
```

### Tester avec cURL
```bash
# Health check
curl http://192.168.1.53:8000/

# Test prompt
curl -X POST "http://192.168.1.53:8000/api/prompt" \
  -H "Authorization: Bearer dev-token-123456789-quick-access" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test"}'
```

## 💡 Conseils

1. **Changez le token par défaut** : Même en dev, utilisez un token unique
2. **Utilisez un .env** : Ne commitez jamais votre token dans git
3. **Testez avec JWT avant la prod** : Validez votre intégration JWT avant de déployer
4. **Surveillez enable_dev_token** : Assurez-vous qu'il est à False en production

## 🐛 Dépannage

### Le token ne fonctionne pas
1. Vérifiez que `enable_dev_token=True` dans la config
2. Vérifiez l'orthographe du token
3. Vérifiez le format du header : `Bearer TOKEN`

### Erreur 401 Unauthorized
```python
# ❌ Mauvais
headers = {"Authorization": "dev-token-123456789-quick-access"}

# ✅ Correct
headers = {"Authorization": "Bearer dev-token-123456789-quick-access"}
```

### Le serveur ne répond pas
1. Vérifiez que le serveur est démarré
2. Vérifiez l'adresse IP : `192.168.1.53` ou `localhost`
3. Vérifiez le port : `8000`
4. Vérifiez le pare-feu Windows

## 📚 Ressources

- Documentation API : `http://192.168.1.53:8000/docs`
- ReDoc : `http://192.168.1.53:8000/redoc`
- Exemple Python : `example_dev_usage.py`
- Exemple JavaScript : `example_dev_usage.js`


