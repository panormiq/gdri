# 🤖 Guide Cron pour BackendIA - Utilisation des Services

Guide pour utiliser BackendIA depuis des tâches cron externes avec le système de tokens de service intégré.

## 🎯 Vue d'ensemble

Les scripts cron peuvent utiliser BackendIA via deux approches :
- 🔧 **API Service** (`/service`) - Utilise le token cron intégré (recommandé)
- 🤖 **API Prompt** (`/api/prompt`) - Nécessite authentification utilisateur

## 🔐 Authentification avec Token de Service

### Token Cron Intégré

BackendIA dispose déjà d'un token de service cron configuré dans `app/core/config.py` :

```python
CRON_SERVICE_TOKEN: str = "cron-service-token-987654321-xyz"
```

### Actions Disponibles via `/service`

| Action | Description | Endpoint |
|--------|-------------|----------|
| `health_check` | Vérifier l'état du service | `/service` |
| `cleanup` | Nettoyer la base de données | `/service` |
| `stats` | Récupérer des statistiques | `/service` |
| `ai_task` | Exécuter une tâche IA (à implémenter) | `/service` |

### Format de Requête Service

```json
{
    "service_name": "cron",
    "action": "ai_task",
    "service_token": "cron-service-token-987654321-xyz",
    "parameters": {
        "prompt": "Votre prompt ici",
        "task_type": "report_generation"
    }
}
```

## 📜 Scripts d'Exemple

### Script Python avec Token de Service

```python
#!/usr/bin/env python3
"""
Client cron pour BackendIA utilisant l'API Service
"""
import requests
import json
import sys
import logging
from datetime import datetime
import os

# Configuration
API_BASE_URL = "http://your-backend-url:8000"
SERVICE_TOKEN = "cron-service-token-987654321-xyz"
LOG_FILE = "/var/log/backendIA_service_cron.log"

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class BackendIAServiceClient:
    """Client pour interagir avec l'API Service de BackendIA"""
    
    def __init__(self, base_url=API_BASE_URL, service_token=SERVICE_TOKEN):
        self.base_url = base_url
        self.service_token = service_token
        self.session = requests.Session()
        self.session.timeout = 60
    
    def make_service_request(self, action, parameters=None):
        """Faire une requête à l'API service"""
        payload = {
            "service_name": "cron",
            "action": action,
            "service_token": self.service_token,
            "parameters": parameters or {}
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/service",
                json=payload
            )
            response.raise_for_status()
            
            data = response.json()
            if data.get("success"):
                logger.info(f"✅ Action '{action}' exécutée avec succès")
            else:
                logger.error(f"❌ Action '{action}' échouée: {data.get('message')}")
            
            return data
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'exécution de '{action}': {e}")
            return None
    
    def generate_ai_response(self, prompt, task_type="general", **kwargs):
        """Générer une réponse IA via l'API service"""
        parameters = {
            "prompt": prompt,
            "task_type": task_type,
            **kwargs
        }
        
        return self.make_service_request("ai_task", parameters)
    
    def health_check(self):
        """Vérifier l'état du service"""
        return self.make_service_request("health_check")
    
    def get_stats(self):
        """Récupérer les statistiques"""
        return self.make_service_request("stats")
    
    def cleanup_database(self):
        """Nettoyer la base de données"""
        return self.make_service_request("cleanup")

# Exemples d'usage
def daily_report_generator():
    """Générer un rapport quotidien avec l'IA"""
    client = BackendIAServiceClient()
    
    # Prompt pour générer un rapport
    prompt = f"""
    Génère un rapport quotidien structuré pour le {datetime.now().strftime('%d/%m/%Y')}.
    
    Inclus les sections suivantes :
    1. Résumé de la journée
    2. Points importants à retenir
    3. Recommandations pour demain
    4. Métrique du jour (invente des chiffres réalistes)
    
    Format : Markdown professionnel
    Ton : Formel mais accessible
    """
    
    result = client.generate_ai_response(
        prompt=prompt,
        task_type="daily_report",
        temperature=0.7,
        max_tokens=800
    )
    
    if result and result.get("success"):
        response_data = result.get("data", {})
        ai_response = response_data.get("response", "")
        
        # Sauvegarder le rapport
        report_file = f"/tmp/daily_report_{datetime.now().strftime('%Y%m%d')}.md"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(ai_response)
        
        logger.info(f"📄 Rapport sauvegardé: {report_file}")
        logger.info(f"⏱️  Temps de traitement: {response_data.get('processing_time', 0):.2f}s")
        return True
    
    return False

def data_analysis_task():
    """Analyser des données avec l'IA"""
    client = BackendIAClient()
    
    if not client.authenticate(CRON_USERNAME, CRON_PASSWORD):
        return False
    
    # Exemple : analyser des logs fictifs
    prompt = """
    Analyse ces données de logs système (exemple) :
    
    2024-01-15 08:00: 1250 requêtes, 2ms temps moyen
    2024-01-15 09:00: 1890 requêtes, 3ms temps moyen  
    2024-01-15 10:00: 2340 requêtes, 5ms temps moyen
    2024-01-15 11:00: 1980 requêtes, 4ms temps moyen
    
    Fournis :
    1. Tendances observées
    2. Anomalies potentielles
    3. Recommandations d'optimisation
    4. Prédictions pour la prochaine heure
    
    Format : JSON structuré
    """
    
    result = client.generate_prompt(
        prompt=prompt,
        temperature=0.3,  # Plus déterministe pour l'analyse
        max_tokens=600
    )
    
    if result:
        analysis_file = f"/tmp/analysis_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
        with open(analysis_file, 'w', encoding='utf-8') as f:
            f.write(result['response'])
        
        logger.info(f"📊 Analyse sauvegardée: {analysis_file}")
        return True
    
    return False

def content_generator():
    """Générer du contenu automatisé"""
    client = BackendIAClient()
    
    if not client.authenticate(CRON_USERNAME, CRON_PASSWORD):
        return False
    
    # Générer un tip du jour
    prompt = """
    Génère un "conseil du jour" sur l'un de ces sujets (choisis aléatoirement) :
    - Productivité au travail
    - Sécurité informatique
    - Bonnes pratiques de développement
    - Gestion de projet
    - Innovation technologique
    
    Format :
    - Titre accrocheur
    - Conseil pratique (2-3 phrases)
    - Action concrète à faire aujourd'hui
    - Emoji approprié
    
    Longueur : Maximum 280 caractères (format tweet)
    """
    
    result = client.generate_prompt(
        prompt=prompt,
        temperature=0.8,  # Plus créatif
        max_tokens=200
    )
    
    if result:
        tip_file = f"/tmp/daily_tip_{datetime.now().strftime('%Y%m%d')}.txt"
        with open(tip_file, 'w', encoding='utf-8') as f:
            f.write(result['response'])
        
        logger.info(f"💡 Conseil du jour généré: {tip_file}")
        
        # Optionnel : poster sur les réseaux sociaux, envoyer par email, etc.
        print(f"💡 Conseil du jour :\n{result['response']}")
        return True
    
    return False

def main():
    """Fonction principale"""
    if len(sys.argv) < 2:
        print("Usage: python3 cron_prompt_client.py <task>")
        print("Tasks: daily_report, data_analysis, content_generator, health_check")
        sys.exit(1)
    
    task = sys.argv[1]
    success = False
    
    if task == "daily_report":
        success = daily_report_generator()
    elif task == "data_analysis":
        success = data_analysis_task()
    elif task == "content_generator":
        success = content_generator()
    elif task == "health_check":
        client = BackendIAClient()
        health = client.health_check()
        success = health is not None
        if success:
            logger.info(f"✅ Service en bonne santé: {health}")
    else:
        logger.error(f"❌ Tâche inconnue: {task}")
        sys.exit(1)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
```

### Script Bash Simple

```bash
#!/bin/bash
# Script bash simple pour appeler l'API Prompt

API_URL="http://your-backend-url:8000"
USERNAME="cron_service"
PASSWORD="secure_password_for_cron_123"
LOG_FILE="/var/log/backendIA_bash_cron.log"

# Fonction de logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Fonction d'authentification
authenticate() {
    local response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
    
    echo "$response" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4
}

# Fonction pour générer un prompt
generate_prompt() {
    local token="$1"
    local prompt="$2"
    
    curl -s -X POST "$API_URL/api/prompt" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "{\"prompt\":\"$prompt\",\"temperature\":0.7,\"max_tokens\":500}"
}

# Script principal
main() {
    log "🚀 Démarrage du script cron prompt"
    
    # Authentification
    TOKEN=$(authenticate)
    if [ -z "$TOKEN" ]; then
        log "❌ Échec de l'authentification"
        exit 1
    fi
    
    log "✅ Authentification réussie"
    
    # Générer un résumé météo (exemple)
    PROMPT="Génère un résumé météo humoristique pour aujourd'hui. Maximum 100 mots."
    
    RESPONSE=$(generate_prompt "$TOKEN" "$PROMPT")
    
    if echo "$RESPONSE" | grep -q '"response"'; then
        WEATHER_SUMMARY=$(echo "$RESPONSE" | grep -o '"response":"[^"]*"' | cut -d'"' -f4)
        log "✅ Résumé météo généré: $WEATHER_SUMMARY"
        
        # Sauvegarder dans un fichier
        echo "$WEATHER_SUMMARY" > "/tmp/weather_$(date +%Y%m%d).txt"
    else
        log "❌ Erreur lors de la génération du prompt"
        exit 1
    fi
    
    log "🎉 Script terminé avec succès"
}

main "$@"
```

## 📅 Configuration Cron

### Exemples de Crontab

```bash
# Ouvrir crontab
crontab -e

# Ajouter ces lignes :

# Rapport quotidien à 8h00
0 8 * * * /usr/bin/python3 /opt/scripts/cron_prompt_client.py daily_report

# Analyse de données toutes les 4 heures
0 */4 * * * /usr/bin/python3 /opt/scripts/cron_prompt_client.py data_analysis

# Conseil du jour à 9h00 en semaine
0 9 * * 1-5 /usr/bin/python3 /opt/scripts/cron_prompt_client.py content_generator

# Health check toutes les heures
0 * * * * /usr/bin/python3 /opt/scripts/cron_prompt_client.py health_check

# Script bash simple deux fois par jour
0 6,18 * * * /opt/scripts/simple_prompt.sh
```

## 🔧 Configuration Avancée

### Variables d'Environnement

Créez un fichier `.env` pour vos scripts :

```bash
# /opt/scripts/.env
BACKEND_IA_URL=http://your-backend-url:8000
CRON_USERNAME=cron_service
CRON_PASSWORD=secure_password_for_cron_123
LOG_LEVEL=INFO
OUTPUT_DIR=/var/backendIA/outputs
```

### Script avec Configuration

```python
#!/usr/bin/env python3
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('/opt/scripts/.env')

API_BASE_URL = os.getenv('BACKEND_IA_URL')
CRON_USERNAME = os.getenv('CRON_USERNAME')
CRON_PASSWORD = os.getenv('CRON_PASSWORD')
OUTPUT_DIR = os.getenv('OUTPUT_DIR', '/tmp')

# Reste du code...
```

## 📊 Cas d'Usage Pratiques

### 1. Rapport de Performance Hebdomadaire

```python
def weekly_performance_report():
    """Générer un rapport de performance hebdomadaire"""
    prompt = f"""
    Génère un rapport de performance hebdomadaire pour la semaine du {datetime.now().strftime('%d/%m/%Y')}.
    
    Simule des données réalistes et inclus :
    1. Métriques clés (temps de réponse, uptime, erreurs)
    2. Comparaison avec la semaine précédente
    3. Tendances observées
    4. Recommandations d'amélioration
    5. Objectifs pour la semaine suivante
    
    Format : Rapport professionnel en markdown
    """
    
    # Utiliser le client comme dans les exemples précédents
```

### 2. Monitoring Intelligent

```python
def intelligent_monitoring():
    """Monitoring avec analyse IA des patterns"""
    # Récupérer des métriques système (CPU, RAM, etc.)
    # Envoyer à l'IA pour analyse et recommandations
    
    prompt = f"""
    Analyse ces métriques système :
    - CPU: 75% (moyenne sur 1h)
    - RAM: 8.2GB/16GB utilisés
    - Disque: 450GB/1TB utilisés
    - Réseau: 125MB/s entrant, 89MB/s sortant
    
    Évalue :
    1. État général du système
    2. Risques potentiels
    3. Optimisations recommandées
    4. Seuils d'alerte à surveiller
    """
```

### 3. Génération de Documentation

```python
def auto_documentation():
    """Générer de la documentation automatiquement"""
    prompt = """
    Génère une section de documentation pour une API REST.
    
    Sujet : Endpoint /api/prompt
    Inclus :
    1. Description claire
    2. Paramètres d'entrée
    3. Exemple de requête
    4. Exemple de réponse
    5. Codes d'erreur possibles
    6. Bonnes pratiques d'utilisation
    
    Format : Markdown technique
    """
```

## 🚨 Gestion d'Erreurs et Retry

```python
import time
from functools import wraps

def retry_on_failure(max_retries=3, delay=5):
    """Décorateur pour retry automatique"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    logger.warning(f"Tentative {attempt + 1} échouée: {e}")
                    time.sleep(delay)
            return None
        return wrapper
    return decorator

@retry_on_failure(max_retries=3, delay=10)
def robust_prompt_generation(client, prompt):
    """Génération de prompt avec retry automatique"""
    return client.generate_prompt(prompt)
```

## 📝 Logging et Monitoring

### Configuration de Logging Avancée

```python
import logging
import logging.handlers

def setup_logging():
    """Configuration de logging robuste"""
    logger = logging.getLogger('backendIA_cron')
    logger.setLevel(logging.INFO)
    
    # Handler pour fichier avec rotation
    file_handler = logging.handlers.RotatingFileHandler(
        '/var/log/backendIA_cron.log',
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    
    # Handler pour syslog
    syslog_handler = logging.handlers.SysLogHandler(address='/dev/log')
    
    # Format
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    file_handler.setFormatter(formatter)
    syslog_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(syslog_handler)
    
    return logger
```

---

## 🎯 Points Clés

1. **Sécurité** : Utilisez un utilisateur dédié avec des permissions limitées
2. **Robustesse** : Implémentez des retry et une gestion d'erreurs solide
3. **Logging** : Loggez tout pour le debugging et le monitoring
4. **Performance** : Ajustez les paramètres (temperature, max_tokens) selon le contexte
5. **Maintenance** : Prévoyez la rotation des logs et le nettoyage des fichiers temporaires

Votre BackendIA est maintenant prêt pour l'automatisation intelligente ! 🚀
