# 🎯 Seuils d'action pour les attaques SYN Flood

## 📊 Seuils recommandés selon la situation

### ✅ Zone Verte : Surveillance normale (0-20 connexions)

**Connexions SYN_RECEIVED : 0 à 20**

**Action :** ⚠️ **SURVEILLANCE PASSIVE**
- ✅ Monitoring en continu via Security Monitor
- ✅ Vérifier que les protections sont actives
- ✅ Pas d'action urgente nécessaire

**Contexte :** C'est normal d'avoir quelques connexions SYN_RECEIVED, même en fonctionnement normal.

---

### ⚠️ Zone Jaune : Attention requise (20-50 connexions)

**Connexions SYN_RECEIVED : 20 à 50**

**Action :** 🔍 **SURVEILLANCE ACTIVE**
- ✅ **Vérifier les IPs attaquantes** : Noter les IPs dans les logs
- ✅ **Analyser les patterns** : Vérifier si c'est un pic temporaire ou une attaque continue
- ✅ **Renforcer la surveillance** : Vérifier toutes les 5 minutes au lieu de toutes les minutes
- ⚠️ **Préparer le blocage** : Préparer les commandes de blocage d'IPs

**Actions recommandées :**
1. Surveiller pendant 10-15 minutes
2. Si le nombre augmente → Passer en Zone Orange
3. Si le nombre reste stable → Continuer la surveillance

---

### 🟠 Zone Orange : Action préventive (50-100 connexions)

**Connexions SYN_RECEIVED : 50 à 100**

**Action :** 🚨 **ACTION PRÉVENTIVE IMMÉDIATE**

**Actions à prendre IMMÉDIATEMENT :**

1. **Bloquer les IPs attaquantes** ⚠️ PRIORITÉ HAUTE
   ```powershell
   # Blocage par plage IP (exemple avec 177.37.16.x)
   netsh advfirewall firewall add rule name="Block SYN Flood 177.37.16" dir=in action=block remoteip=177.37.16.0/24
   ```

2. **Réduire les timeouts Apache** ⚠️ PRIORITÉ MOYENNE
   - Modifier `Timeout` à **1 seconde** dans `apache-syn-flood-config.conf`
   - Redémarrer Apache

3. **Vérifier l'état du serveur** ⚠️ PRIORITÉ MOYENNE
   ```powershell
   # Vérifier CPU, mémoire
   Get-Process httpd | Select-Object CPU, WorkingSet
   ```

4. **Alerte email** ✅ AUTOMATIQUE (si Security Monitor actif)

**Seuil d'alerte dans Security Monitor :** **50 connexions** (défini actuellement)

---

### 🔴 Zone Rouge : Action urgente (100-200 connexions)

**Connexions SYN_RECEIVED : 100 à 200**

**Action :** 🚨🚨 **ACTION URGENTE**

**Actions à prendre URGENTEMENT :**

1. **Blocage massif des IPs** 🚨 CRITIQUE
   ```powershell
   # Blocage de toutes les plages IPs attaquantes
   netsh advfirewall firewall add rule name="Block SYN Flood 177.37" dir=in action=block remoteip=177.37.0.0/16
   ```

2. **Réduire drastiquement les timeouts** 🚨 CRITIQUE
   - Modifier `Timeout` à **1 seconde**
   - Modifier `RequestReadTimeout` à **header=5-10,MinRate=1000**
   - Redémarrer Apache IMMÉDIATEMENT

3. **Réduire le rate limiting Node.js** 🚨 CRITIQUE
   - Modifier `max: 100` → `max: 50` dans `backend/middleware/rate-limiter.js`
   - Redémarrer le backend Node.js

4. **Surveillance en temps réel** 🚨 CRITIQUE
   ```powershell
   # Monitoring toutes les 30 secondes
   .\install\monitor-syn-flood.ps1 -Continuous -Interval 30
   ```

5. **Vérifier les ressources serveur** 🚨 CRITIQUE
   - CPU > 80% : Problème
   - Mémoire > 90% : Problème
   - Disque I/O : Vérifier

---

### 🔴 Zone Critique : Action d'urgence (> 200 connexions)

**Connexions SYN_RECEIVED : > 200**

**Action :** 🚨🚨🚨 **ACTION D'URGENCE - SITE EN DANGER**

**Actions à prendre IMMÉDIATEMENT :**

1. **Blocage total de la plage IP attaquante** 🚨 URGENT
   ```powershell
   # Blocage de toute la plage
   netsh advfirewall firewall add rule name="EMERGENCY Block SYN Flood" dir=in action=block remoteip=177.37.0.0/16
   ```

2. **Réduction maximale des timeouts** 🚨 URGENT
   - `Timeout 1`
   - `RequestReadTimeout header=3-5,MinRate=2000`
   - `KeepAliveTimeout 1`
   - Redémarrer Apache

3. **Limiter drastiquement le rate limiting** 🚨 URGENT
   - `max: 20` requêtes/minute
   - Redémarrer le backend

4. **Contacter le FAI/Hébergeur** 🚨 URGENT
   - Signaler l'attaque
   - Demander un blocage au niveau réseau
   - Demander une analyse du trafic

5. **Failover si possible** 🚨 URGENT
   - Rediriger le trafic vers un autre serveur
   - Mettre en place un CDN avec protection DDoS

6. **Monitoring en temps réel** 🚨 URGENT
   ```powershell
   # Monitoring toutes les 10 secondes
   .\install\monitor-syn-flood.ps1 -Continuous -Interval 10
   ```

---

## 🎯 Seuils recommandés pour votre serveur

### Pour un serveur XAMPP (développement/test) :

| Seuil | Connexions SYN_RECEIVED | Action | Priorité |
|-------|-------------------------|--------|----------|
| **Normal** | 0-15 | Surveillance | 🟢 Basse |
| **Attention** | 15-30 | Surveillance active | 🟡 Moyenne |
| **Alerte** | 30-50 | Action préventive | 🟠 Élevée |
| **Critique** | 50-100 | Action urgente | 🔴 Très élevée |
| **Urgence** | > 100 | Action d'urgence | 🔴🚨 Critique |

### Pour un serveur de production :

| Seuil | Connexions SYN_RECEIVED | Action | Priorité |
|-------|-------------------------|--------|----------|
| **Normal** | 0-30 | Surveillance | 🟢 Basse |
| **Attention** | 30-50 | Surveillance active | 🟡 Moyenne |
| **Alerte** | 50-100 | Action préventive | 🟠 Élevée |
| **Critique** | 100-200 | Action urgente | 🔴 Très élevée |
| **Urgence** | > 200 | Action d'urgence | 🔴🚨 Critique |

---

## 📝 Configuration recommandée pour le Security Monitor

### Option 1 : Surveillance réactive (recommandé)

**Seuil d'alerte : 30 connexions SYN_RECEIVED**

```javascript
synFloodThreshold: 30, // Alerte si plus de 30 connexions
```

**Avantages :**
- ✅ Détection précoce
- ✅ Temps de réaction avant que ça devienne critique
- ✅ Alerte avant que le serveur soit impacté

### Option 2 : Surveillance standard (actuel)

**Seuil d'alerte : 50 connexions SYN_RECEIVED**

```javascript
synFloodThreshold: 50, // Alerte si plus de 50 connexions (défaut actuel)
```

**Avantages :**
- ✅ Moins de faux positifs
- ✅ Alerte quand l'attaque devient significative
- ⚠️ Mais peut être trop tard si l'attaque s'intensifie rapidement

### Option 3 : Surveillance stricte

**Seuil d'alerte : 20 connexions SYN_RECEIVED**

```javascript
synFloodThreshold: 20, // Alerte si plus de 20 connexions
```

**Avantages :**
- ✅ Détection très précoce
- ✅ Maximum de temps de réaction
- ⚠️ Plus de notifications (peut être gênant)

---

## 💡 Recommandation pour votre situation

### Situation actuelle : **13 connexions SYN_RECEIVED**

**Seuil recommandé : 30 connexions SYN_RECEIVED**

**Raisons :**
1. ✅ Avec 13 connexions, vous êtes encore loin du seuil
2. ✅ 30 connexions = zone d'alerte préventive
3. ✅ Vous aurez le temps de réagir avant que ça devienne critique
4. ✅ Équilibre entre réactivité et faux positifs

**Action immédiate :**
- Modifier le seuil dans `backend/security-monitor.js` à **30** au lieu de **50**
- Démarrer le Security Monitor
- Surveiller pendant 24h pour ajuster si nécessaire

---

## 🔧 Comment modifier le seuil

### Option 1 : Dans le fichier de configuration

Modifier `backend/security-monitor.js` ligne 34 :

```javascript
// Avant
synFloodThreshold: 50, // Alerte si plus de 50 connexions SYN_RECEIVED

// Après (recommandé pour votre situation)
synFloodThreshold: 30, // Alerte si plus de 30 connexions SYN_RECEIVED
```

### Option 2 : Via variable d'environnement (à ajouter)

Ajouter dans `.env` :
```env
SYN_FLOOD_THRESHOLD=30
```

Puis modifier le code pour utiliser cette variable.

---

## 📊 Plan d'action selon le seuil atteint

### < 20 connexions : ✅ Rien à faire
- Monitoring passif
- Vérification quotidienne

### 20-30 connexions : ⚠️ Surveillance active
- Vérifier toutes les 5 minutes
- Noter les IPs attaquantes
- Préparer les commandes de blocage

### 30-50 connexions : 🚨 Action préventive
- Bloquer les IPs attaquantes
- Réduire les timeouts Apache
- Alerte email automatique

### 50-100 connexions : 🚨🚨 Action urgente
- Blocage massif des IPs
- Réduction drastique des timeouts
- Vérification des ressources serveur
- Surveillance en temps réel

### > 100 connexions : 🚨🚨🚨 Action d'urgence
- Blocage total des plages IP
- Réduction maximale des timeouts
- Contacter le FAI
- Failover si possible

---

## ✅ Actions immédiates recommandées

1. **Modifier le seuil à 30 connexions** (au lieu de 50)
2. **Démarrer le Security Monitor** pour recevoir les alertes
3. **Surveiller pendant 24h** pour ajuster si nécessaire
4. **Préparer les commandes de blocage** pour agir rapidement si besoin
