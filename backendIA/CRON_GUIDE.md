# 🕒 Guide d'Utilisation avec les Tâches Cron

Ce guide explique comment utiliser BackendIA avec des tâches cron pour automatiser diverses opérations.

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Configuration](#configuration)
3. [API Service pour Cron](#api-service-pour-cron)
4. [Scripts Cron](#scripts-cron)
5. [Exemples d'Usage](#exemples-dusage)
6. [Monitoring et Logs](#monitoring-et-logs)
7. [Dépannage](#dépannage)

## 🎯 Vue d'ensemble

BackendIA expose une API spéciale `/service` qui permet aux tâches cron d'interagir avec le système de manière sécurisée via un token d'authentification dédié.

### Fonctionnalités disponibles pour Cron :
- ✅ Health checks automatiques
- ✅ Nettoyage de base de données
- ✅ Génération de statistiques
- ✅ Maintenance système
- ✅ Rapports automatiques

## ⚙️ Configuration

### 1. Token de Service Cron

Le token est configuré dans `app/core/config.py` :
```python
CRON_SERVICE_TOKEN: str = "cron-service-token-987654321-xyz"
```

### 2. URL de l'API

Par défaut : `http://localhost:8000/service`

### 3. Actions Disponibles

| Action | Description | Paramètres |
|--------|-------------|------------|
| `health_check` | Vérifier l'état du service | Aucun |
| `cleanup` | Nettoyer la base de données | Optionnels |
| `stats` | Générer des statistiques | Aucun |

## 🔌 API Service pour Cron

### Format de Requête

```json
{
    "service_name": "cron",
    "action": "health_check",
    "service_token": "cron-service-token-987654321-xyz",
    "parameters": {}  // Optionnel
}
```

### Format de Réponse

```json
{
    "success": true,
    "message": "Service cron opérationnel",
    "data": {
        "service": "cron",
        "status": "healthy"
    },
    "timestamp": "2024-01-01T12:00:00Z"
}
```

## 📜 Scripts Cron

### Script de Base

Créez un fichier `cron_scripts/base_cron.py` :

```python
#!/usr/bin/env python3
"""
Script de base pour les tâches cron BackendIA
"""
import requests
import json
import sys
from datetime import datetime
import logging

# Configuration
API_URL = "http://localhost:8000/service"
SERVICE_TOKEN = "cron-service-token-987654321-xyz"
LOG_FILE = "/var/log/backendIA_cron.log"

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

class CronClient:
    """Client pour interagir avec l'API BackendIA depuis cron"""
    
    def __init__(self, api_url=API_URL, token=SERVICE_TOKEN):
        self.api_url = api_url
        self.token = token
        self.session = requests.Session()
        self.session.timeout = 30
    
    def make_request(self, action, parameters=None):
        """Faire une requête à l'API service"""
        payload = {
            "service_name": "cron",
            "action": action,
            "service_token": self.token,
            "parameters": parameters or {}
        }
        
        try:
            response = self.session.post(
                self.api_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur de requête: {e}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Erreur de décodage JSON: {e}")
            return None
    
    def health_check(self):
        """Effectuer un health check"""
        logger.info("🔍 Exécution du health check...")
        result = self.make_request("health_check")
        
        if result and result.get("success"):
            logger.info("✅ Health check réussi")
            return True
        else:
            logger.error("❌ Health check échoué")
            return False
    
    def cleanup_database(self):
        """Nettoyer la base de données"""
        logger.info("🧹 Exécution du nettoyage de base de données...")
        result = self.make_request("cleanup")
        
        if result and result.get("success"):
            cleaned_items = result.get("data", {}).get("cleaned_items", 0)
            logger.info(f"✅ Nettoyage terminé: {cleaned_items} éléments supprimés")
            return True
        else:
            logger.error("❌ Nettoyage échoué")
            return False
    
    def generate_stats(self):
        """Générer des statistiques"""
        logger.info("📊 Génération des statistiques...")
        result = self.make_request("stats")
        
        if result and result.get("success"):
            data = result.get("data", {})
            logger.info(f"✅ Statistiques générées:")
            logger.info(f"   - Utilisateurs totaux: {data.get('total_users', 0)}")
            logger.info(f"   - Utilisateurs actifs: {data.get('active_users', 0)}")
            return True
        else:
            logger.error("❌ Génération des statistiques échouée")
            return False

def main():
    """Fonction principale"""
    if len(sys.argv) < 2:
        print("Usage: python base_cron.py <action>")
        print("Actions: health_check, cleanup, stats")
        sys.exit(1)
    
    action = sys.argv[1]
    client = CronClient()
    
    success = False
    if action == "health_check":
        success = client.health_check()
    elif action == "cleanup":
        success = client.cleanup_database()
    elif action == "stats":
        success = client.generate_stats()
    else:
        logger.error(f"Action inconnue: {action}")
        sys.exit(1)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
```

### Script de Health Check Rapide

Créez `cron_scripts/health_check.sh` :

```bash
#!/bin/bash
# Health check rapide pour BackendIA

API_URL="http://localhost:8000/service"
TOKEN="cron-service-token-987654321-xyz"
LOG_FILE="/var/log/backendIA_health.log"

# Fonction de logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Effectuer le health check
response=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"service_name\": \"cron\",
        \"action\": \"health_check\",
        \"service_token\": \"$TOKEN\"
    }")

# Vérifier la réponse
if echo "$response" | grep -q '"success":true'; then
    log "✅ Health check réussi"
    exit 0
else
    log "❌ Health check échoué: $response"
    exit 1
fi
```

## 📅 Exemples d'Usage

### 1. Health Check Toutes les 5 Minutes

```bash
# Ajouter à crontab avec: crontab -e
*/5 * * * * /path/to/cron_scripts/health_check.sh
```

### 2. Nettoyage Quotidien à 2h du Matin

```bash
0 2 * * * /usr/bin/python3 /path/to/cron_scripts/base_cron.py cleanup
```

### 3. Statistiques Hebdomadaires le Lundi à 8h

```bash
0 8 * * 1 /usr/bin/python3 /path/to/cron_scripts/base_cron.py stats
```

### 4. Crontab Complète

```bash
# BackendIA Maintenance Tasks
*/5 * * * * /path/to/cron_scripts/health_check.sh
0 2 * * * /usr/bin/python3 /path/to/cron_scripts/base_cron.py cleanup
0 8 * * 1 /usr/bin/python3 /path/to/cron_scripts/base_cron.py stats
0 0 1 * * /usr/bin/python3 /path/to/cron_scripts/monthly_report.py
```

## 📊 Scripts Avancés

### Script de Rapport Mensuel

Créez `cron_scripts/monthly_report.py` :

```python
#!/usr/bin/env python3
"""
Génération de rapport mensuel pour BackendIA
"""
import requests
import json
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def generate_monthly_report():
    """Générer un rapport mensuel"""
    # Configuration
    api_url = "http://localhost:8000/service"
    token = "cron-service-token-987654321-xyz"
    
    # Récupérer les statistiques
    payload = {
        "service_name": "cron",
        "action": "stats",
        "service_token": token
    }
    
    try:
        response = requests.post(api_url, json=payload)
        response.raise_for_status()
        data = response.json()
        
        if data.get("success"):
            stats = data.get("data", {})
            
            # Créer le rapport
            report = f"""
# Rapport Mensuel BackendIA - {datetime.now().strftime('%B %Y')}

## Statistiques Utilisateurs
- Utilisateurs totaux : {stats.get('total_users', 0)}
- Utilisateurs actifs : {stats.get('active_users', 0)}

## Statut Système
- Service : Opérationnel
- Dernière vérification : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---
Rapport généré automatiquement par BackendIA Cron
            """
            
            print(report)
            # Ici vous pouvez ajouter l'envoi par email
            return True
            
    except Exception as e:
        print(f"Erreur lors de la génération du rapport: {e}")
        return False

if __name__ == "__main__":
    generate_monthly_report()
```

## 📈 Monitoring et Logs

### Structure des Logs

```
/var/log/backendIA/
├── cron.log              # Logs généraux des tâches cron
├── health_check.log      # Logs des health checks
├── cleanup.log           # Logs des nettoyages
└── stats.log             # Logs des statistiques
```

### Script de Monitoring

Créez `cron_scripts/monitor.py` :

```python
#!/usr/bin/env python3
"""
Monitoring des tâches cron BackendIA
"""
import os
import re
from datetime import datetime, timedelta

def check_log_health(log_file, max_age_hours=1):
    """Vérifier la santé d'un fichier de log"""
    if not os.path.exists(log_file):
        return False, "Fichier de log inexistant"
    
    # Vérifier la dernière modification
    mtime = os.path.getmtime(log_file)
    last_modified = datetime.fromtimestamp(mtime)
    age = datetime.now() - last_modified
    
    if age > timedelta(hours=max_age_hours):
        return False, f"Log trop ancien: {age}"
    
    # Vérifier les erreurs récentes
    with open(log_file, 'r') as f:
        lines = f.readlines()
        recent_lines = lines[-50:]  # 50 dernières lignes
        
        error_count = sum(1 for line in recent_lines if 'ERROR' in line or '❌' in line)
        if error_count > 5:
            return False, f"Trop d'erreurs récentes: {error_count}"
    
    return True, "OK"

def main():
    """Fonction principale de monitoring"""
    logs_to_check = [
        "/var/log/backendIA_cron.log",
        "/var/log/backendIA_health.log"
    ]
    
    all_healthy = True
    for log_file in logs_to_check:
        healthy, message = check_log_health(log_file)
        status = "✅" if healthy else "❌"
        print(f"{status} {log_file}: {message}")
        
        if not healthy:
            all_healthy = False
    
    return 0 if all_healthy else 1

if __name__ == "__main__":
    exit(main())
```

## 🔧 Dépannage

### Problèmes Courants

#### 1. Erreur d'Authentification
```bash
# Vérifier le token dans la configuration
grep "CRON_SERVICE_TOKEN" app/core/config.py
```

#### 2. Service Non Accessible
```bash
# Vérifier que BackendIA est en cours d'exécution
curl -s http://localhost:8000/health
```

#### 3. Permissions de Fichiers
```bash
# Donner les permissions d'exécution aux scripts
chmod +x cron_scripts/*.sh
chmod +x cron_scripts/*.py
```

### Commandes de Debug

```bash
# Tester manuellement une tâche cron
python3 /path/to/cron_scripts/base_cron.py health_check

# Voir les logs cron système
tail -f /var/log/cron

# Voir les logs BackendIA
tail -f /var/log/backendIA_cron.log
```

## 🚀 Installation et Configuration

### 1. Créer les Dossiers

```bash
mkdir -p /opt/backendIA/cron_scripts
mkdir -p /var/log/backendIA
```

### 2. Copier les Scripts

```bash
cp cron_scripts/* /opt/backendIA/cron_scripts/
chmod +x /opt/backendIA/cron_scripts/*
```

### 3. Configurer Crontab

```bash
crontab -e
# Ajouter les tâches selon vos besoins
```

### 4. Tester

```bash
# Tester chaque script individuellement
/opt/backendIA/cron_scripts/health_check.sh
python3 /opt/backendIA/cron_scripts/base_cron.py stats
```

---

## 📞 Support

Pour toute question ou problème avec les tâches cron :

1. Vérifiez les logs dans `/var/log/backendIA/`
2. Testez manuellement les scripts
3. Vérifiez que BackendIA est accessible
4. Validez le token de service

**Votre BackendIA est maintenant prêt pour l'automatisation avec cron ! 🎉**

