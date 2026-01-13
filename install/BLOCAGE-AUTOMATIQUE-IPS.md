# 🚫 Blocage automatique des IPs attaquantes

## 📋 Fonctionnalité

Le Security Monitor peut **bloquer automatiquement** les IPs qui génèrent des connexions SYN_RECEIVED suspectes via le pare-feu Windows.

## ⚙️ Configuration

### Activation/Désactivation

Par défaut, le blocage automatique est **ACTIVÉ**.

Pour le désactiver, ajoutez dans `.env` :
```env
AUTO_BAN_ENABLED=false
```

### Seuils de blocage

**Seuil global :** Nombre total de connexions SYN_RECEIVED pour déclencher le blocage
```env
AUTO_BAN_THRESHOLD=30  # Bloquer si >= 30 connexions SYN_RECEIVED (défaut: 30)
```

**Seuil par IP :** Nombre minimum de connexions SYN_RECEIVED par IP pour la bloquer
```env
AUTO_BAN_MIN_CONNECTIONS=3  # Bloquer une IP si elle a >= 3 connexions (défaut: 3)
```

## 🔧 Comment ça fonctionne

### Processus automatique

1. **Détection** : Le Security Monitor vérifie toutes les minutes les connexions SYN_RECEIVED
2. **Analyse** : Si le nombre total dépasse `AUTO_BAN_THRESHOLD` (30 par défaut)
3. **Identification** : Extraction des IPs attaquantes depuis netstat
4. **Blocage** : Chaque IP avec >= `AUTO_BAN_MIN_CONNECTIONS` (3 par défaut) est bloquée
5. **Notification** : Email envoyé avec la liste des IPs bloquées

### Exemple

**Situation :**
- 35 connexions SYN_RECEIVED détectées
- IP `177.37.16.23` : 5 connexions
- IP `177.37.16.25` : 4 connexions
- IP `177.37.16.99` : 2 connexions

**Action automatique :**
- ✅ `177.37.16.23` → **BLOQUÉE** (5 >= 3)
- ✅ `177.37.16.25` → **BLOQUÉE** (4 >= 3)
- ❌ `177.37.16.99` → **Non bloquée** (2 < 3)

## 🛡️ Protection contre les faux positifs

### IPs ignorées automatiquement

Le système **ne bloque JAMAIS** :
- ✅ IPs locales (`127.0.0.1`, `0.0.0.0`)
- ✅ IPs du réseau local (`192.168.x.x`, `10.x.x.x`)
- ✅ IPs déjà bloquées (évite les doublons)

### Vérification avant blocage

- ✅ Vérifie si l'IP est déjà bloquée
- ✅ Vérifie si c'est une IP locale
- ✅ Vérifie si la règle de pare-feu existe déjà

## 📧 Notifications

### Email d'alerte

L'email d'alerte inclut :
- ✅ Nombre total de connexions SYN_RECEIVED
- ✅ Liste des IPs suspectes avec leur nombre de connexions
- ✅ **Liste des IPs bloquées automatiquement** (nouveau)
- ✅ Nom de la règle de pare-feu créée

### Console

Dans la console du Security Monitor :
```
🚨 ALERTE SYN FLOOD : 35 connexions SYN_RECEIVED détectées!
🚫 2 IP(s) bloquée(s) automatiquement:
   - 177.37.16.23 (5 connexions SYN_RECEIVED)
   - 177.37.16.25 (4 connexions SYN_RECEIVED)
```

## 🔍 Gestion des IPs bloquées

### Liste des IPs bloquées

Les IPs bloquées sont sauvegardées dans :
- **Fichier d'état** : `backend/.security-monitor-state.json`
- **Pare-feu Windows** : Règles nommées `Block SYN Flood [IP]`

### Voir les IPs bloquées

**Via le fichier d'état :**
```powershell
Get-Content backend\.security-monitor-state.json | ConvertFrom-Json | Select-Object -ExpandProperty bannedIPs
```

**Via le pare-feu Windows :**
```powershell
netsh advfirewall firewall show rule name=all | findstr "Block SYN Flood"
```

### Débloquer une IP

**Méthode 1 : Supprimer la règle du pare-feu**
```powershell
netsh advfirewall firewall delete rule name="Block SYN Flood 177.37.16.23"
```

**Méthode 2 : Supprimer de la liste (pour éviter les doublons)**
Modifier `backend/.security-monitor-state.json` et retirer l'IP de `bannedIPs`

## ⚠️ Important

### Permissions requises

Le blocage automatique nécessite :
- ✅ **Droits administrateur** pour créer des règles de pare-feu
- ✅ **Pare-feu Windows activé**

### Si le Security Monitor n'a pas les droits

Si vous voyez des erreurs comme :
```
❌ Erreur blocage IP: Access is denied
```

**Solution :** Exécuter le Security Monitor en tant qu'administrateur :
1. Clic droit sur PowerShell
2. "Exécuter en tant qu'administrateur"
3. Lancer le Security Monitor depuis cette fenêtre

## 📊 Statistiques

### Suivi des blocages

Le Security Monitor enregistre :
- ✅ Nombre d'IPs bloquées par session
- ✅ Date et heure de chaque blocage
- ✅ Nombre de connexions SYN_RECEIVED par IP bloquée

### Consulter les statistiques

Les statistiques sont dans :
- **Console** : Affichage en temps réel
- **Email** : Rapport dans chaque alerte
- **Fichier d'état** : `backend/.security-monitor-state.json`

## 🎯 Recommandations

### Configuration recommandée

Pour un serveur XAMPP (développement/test) :
```env
AUTO_BAN_ENABLED=true
AUTO_BAN_THRESHOLD=30
AUTO_BAN_MIN_CONNECTIONS=3
```

**Explication :**
- ✅ Seuil à 30 : Détection précoce mais pas trop agressive
- ✅ Minimum 3 connexions par IP : Évite les faux positifs
- ✅ Blocage automatique : Réaction immédiate sans intervention

### Pour un serveur de production

```env
AUTO_BAN_ENABLED=true
AUTO_BAN_THRESHOLD=50
AUTO_BAN_MIN_CONNECTIONS=5
```

**Explication :**
- ✅ Seuil à 50 : Moins de faux positifs
- ✅ Minimum 5 connexions : Plus strict, évite les blocages accidentels

## 🔧 Dépannage

### Les IPs ne sont pas bloquées

**Vérifications :**
1. ✅ Le blocage automatique est activé (`AUTO_BAN_ENABLED=true`)
2. ✅ Le seuil est atteint (`AUTO_BAN_THRESHOLD`)
3. ✅ Les IPs ont assez de connexions (`AUTO_BAN_MIN_CONNECTIONS`)
4. ✅ Le Security Monitor a les droits administrateur

### Trop d'IPs bloquées (faux positifs)

**Solution :** Augmenter les seuils
```env
AUTO_BAN_THRESHOLD=50        # Au lieu de 30
AUTO_BAN_MIN_CONNECTIONS=5  # Au lieu de 3
```

### Pas assez d'IPs bloquées

**Solution :** Réduire les seuils
```env
AUTO_BAN_THRESHOLD=20        # Au lieu de 30
AUTO_BAN_MIN_CONNECTIONS=2   # Au lieu de 3
```

## 📝 Exemple de configuration complète

Dans votre fichier `.env` :
```env
# Configuration SYN Flood
SYN_FLOOD_THRESHOLD=30
AUTO_BAN_ENABLED=true
AUTO_BAN_THRESHOLD=30
AUTO_BAN_MIN_CONNECTIONS=3
```

## ✅ Résumé

**Fonctionnalité :** Blocage automatique des IPs attaquantes via pare-feu Windows

**Seuil de déclenchement :** 30 connexions SYN_RECEIVED (configurable)

**Seuil par IP :** 3 connexions SYN_RECEIVED minimum (configurable)

**Protection :** Ignore les IPs locales, évite les doublons

**Notification :** Email avec liste des IPs bloquées

**État :** ✅ **ACTIVÉ par défaut**
