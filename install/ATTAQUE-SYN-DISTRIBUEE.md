# 🚨 Attaque SYN Flood Distribuée Détectée

## 📊 Situation Actuelle

### Attaque en Cours

**Date :** 10/01/2026  
**Nombre de connexions SYN_RECEIVED :** 11  
**Type d'attaque :** SYN Flood Distribuée (DDoS)

### IPs Attaquantes

```
190.111.98.156 (1 connexion)
190.111.98.76  (1 connexion)
190.111.98.248 (1 connexion)
190.111.99.133 (1 connexion)
190.111.99.86  (1 connexion)
190.111.98.6   (1 connexion)
190.111.96.111 (1 connexion)
190.111.96.85  (1 connexion)
190.111.97.77  (1 connexion)
190.111.97.204 (1 connexion)
190.111.97.99  (1 connexion)
```

**Plage réseau :** 190.111.96.0/22 (190.111.96.x - 190.111.99.x)

---

## 🔍 Analyse

### Caractéristiques de l'Attaque

1. **Attaque Distribuée :** Plusieurs IPs de la même plage réseau (190.111.96.0/22)
2. **Chaque IP :** Une seule connexion SYN_RECEIVED (pas plusieurs)
3. **Coordination :** Attaque coordonnée depuis plusieurs machines
4. **Type :** SYN Flood Distribuée (DDoS)

### Pourquoi le Ban Automatique ne Fonctionne Pas ?

Le système de ban automatique actuel requiert :
- ✅ `autoBanMinConnections: 3` → Chaque IP doit avoir >= 3 connexions
- ✅ `autoBanThreshold: 30` → Il faut >= 30 connexions SYN_RECEIVED totales

**Problème :**
- ❌ Chaque IP n'a qu'**1 connexion** (pas assez pour ban individuel)
- ❌ **11 connexions totales** (pas assez pour ban sévère, seuil: 30)
- ✅ Mais **11 >= 10** (seuil de suspicion) → Email de suspicion envoyé

---

## 🛡️ Actions Immédiates

### Option 1 : Bannir Manuellement Toute la Plage IP (Recommandé)

Bannir toute la plage réseau 190.111.96.0/22 (190.111.96.0 - 190.111.99.255) :

```powershell
# Bannir toute la plage IP
netsh advfirewall firewall add rule name="Block SYN Flood 190.111.96.0/22" dir=in action=block remoteip=190.111.96.0/255.255.252.0 protocol=TCP
```

**Avantages :**
- ✅ Bloque toutes les IPs de la plage attaquante
- ✅ Empêche les nouvelles attaques depuis cette plage
- ✅ Action immédiate et efficace

**Désavantages :**
- ⚠️ Peut bloquer des IPs légitimes si elles partagent la même plage
- ⚠️ Nécessite un déban manuel si IPs légitimes affectées

### Option 2 : Bannir les IPs Individuellement

Bannir chaque IP une par une :

```powershell
netsh advfirewall firewall add rule name="Block SYN Flood 190.111.98.156" dir=in action=block remoteip=190.111.98.156 protocol=TCP
netsh advfirewall firewall add rule name="Block SYN Flood 190.111.98.76" dir=in action=block remoteip=190.111.98.76 protocol=TCP
# ... etc pour chaque IP
```

**Avantages :**
- ✅ Plus précis, évite les faux positifs
- ✅ Moins de risque de bloquer des IPs légitimes

**Désavantages :**
- ⚠️ Plus long à mettre en place
- ⚠️ Attaquant peut changer d'IP rapidement dans la même plage

### Option 3 : Attendre que le Security Monitor Bannisse (Automatique)

Le Security Monitor devrait :
- ✅ Avoir détecté l'attaque (11 SYN >= 10, seuil de suspicion)
- ✅ Avoir envoyé un email de suspicion
- ✅ Ajusté l'intervalle à 10 secondes (suspect)
- ❌ **Ne pas bannir automatiquement** (chaque IP n'a qu'1 connexion)

**Problème :** Le système ne ban pas car chaque IP n'a qu'1 connexion.

---

## 🔧 Solutions Long Terme

### Améliorer la Détection des Attaques Distribuées

#### Solution 1 : Détection par Plage Réseau

Détecter si plusieurs IPs de la même plage réseau sont suspectes :

```javascript
// Si >= 5 IPs de la même plage /22 sont suspectes → Bannir toute la plage
if (ipsFromSameRange >= 5) {
  banEntireRange(range);
}
```

#### Solution 2 : Réduire le Seuil de Ban pour les SYN Flood

Réduire `autoBanMinConnections` de 3 à 1 pour les SYN flood :

```javascript
// Bannir même avec 1 connexion si elle persiste > 30 secondes
autoBanMinConnections: 1, // Pour SYN flood (au lieu de 3)
autoBanPersistTime: 30000, // 30 secondes (au lieu de 10 secondes)
```

#### Solution 3 : Ban Immédiat pour SYN Flood Distribuées

Si >= 10 connexions SYN_RECEIVED et >= 5 IPs différentes → Ban automatique :

```javascript
// Si >= 10 SYN total ET >= 5 IPs différentes → Bannir toutes les IPs
if (synCount >= 10 && uniqueIPs.length >= 5) {
  banAllIPs(uniqueIPs);
}
```

---

## 📊 Recommandation Immédiate

### Pour Cette Attaque Spécifique

**Action Recommandée :** Bannir toute la plage IP 190.111.96.0/22

**Raison :**
- ✅ Attaque coordonnée depuis plusieurs IPs de la même plage
- ✅ Probablement un botnet ou attaque orchestrée
- ✅ Action immédiate et efficace

**Command PowerShell :**

```powershell
netsh advfirewall firewall add rule name="Block SYN Flood 190.111.96.0/22" dir=in action=block remoteip=190.111.96.0/255.255.252.0 protocol=TCP
```

### Pour le Futur

**Améliorer le système :**
1. Détection par plage réseau
2. Réduire le seuil de ban pour les SYN flood distribuées
3. Ban automatique si >= 10 SYN ET >= 5 IPs différentes

---

## ✅ Vérification

### Vérifier si les IPs sont Bannies

```powershell
# Vérifier les règles de pare-feu
netsh advfirewall firewall show rule name="Block SYN Flood 190.111.96.0/22"
```

### Vérifier si l'Attaque Continue

```powershell
# Vérifier les connexions SYN_RECEIVED
netstat -ano | Select-String ":443" | Select-String "SYN_RECEIVED"
```

### Débaner si Nécessaire

```powershell
# Débaner la plage IP (si IPs légitimes affectées)
netsh advfirewall firewall delete rule name="Block SYN Flood 190.111.96.0/22"
```

---

## 📝 Notes

- ⚠️ **Important :** Les attaques distribuées sont plus difficiles à bloquer car chaque IP n'a qu'une seule connexion
- ✅ **Recommandation :** Bannir par plage réseau pour les attaques coordonnées
- ✅ **Surveillance :** Vérifier régulièrement si les connexions persistent
- ✅ **Amélioration :** Implémenter la détection par plage réseau dans le Security Monitor
