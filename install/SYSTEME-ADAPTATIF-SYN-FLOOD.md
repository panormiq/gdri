# ⚡ Système Adaptatif de Détection SYN Flood

## 📊 Vue d'ensemble

Le Security Monitor utilise maintenant un **système adaptatif** qui ajuste automatiquement l'intervalle de vérification en fonction du nombre de connexions SYN_RECEIVED détectées.

### Principe

Plus il y a de connexions SYN_RECEIVED suspectes, plus le système vérifie fréquemment pour une détection rapide et une réactivité accrue.

---

## 🎯 Niveaux d'Intervalle Adaptatif

| Niveau | Nombre de SYN | Intervalle | Action |
|--------|---------------|------------|--------|
| **Normal** | < 10 | **20 secondes** | Aucune action, monitoring passif |
| **Suspicion** | 10-19 | **10 secondes** | Email de suspicion (cooldown 5 min) |
| **Modéré** | 20-29 | **5 secondes** | Log console (préparation) |
| **Sévère** | >= 30 | **3 secondes** | Alerte email + Auto-ban si activé |

---

## 📧 Système d'Alertes

### 1. Email de Suspicion (10-29 SYN)

**Déclenchement :**
- ✅ Nombre de SYN >= 10 et < 30
- ✅ Cooldown : 5 minutes entre emails (évite le spam)

**Contenu :**
- Nombre de connexions SYN_RECEIVED
- IPs suspectes (top 10)
- Détails des connexions (échantillon)
- Avertissement que c'est une détection précoce

**Exemple :**
```
⚠️ Suspicion d'Attaque SYN Flood

Nombre de connexions SYN_RECEIVED: 15
Niveau: Suspicion (détection précoce)
Seuil de suspicion: >= 10 connexions
Seuil d'alerte sévère: >= 30 connexions

⚠️ Cette alerte est envoyée en prévention. 
Si le nombre de connexions augmente, une alerte sévère sera déclenchée.
```

### 2. Alerte Sévère (>= 30 SYN)

**Déclenchement :**
- ✅ Nombre de SYN >= 30
- ✅ Cooldown : 10 minutes entre emails

**Contenu :**
- Nombre de connexions SYN_RECEIVED
- IPs suspectes (top 10)
- IPs bloquées automatiquement (si auto-ban activé)
- IPs surveillées (pas encore persistantes)
- Détails des connexions

**Exemple :**
```
🚨 ALERTE SYN FLOOD Détectée

Nombre de connexions SYN_RECEIVED: 45
Blocage automatique: ✅ Activé

🚫 IPs bloquées automatiquement:
  - 177.37.16.23: 12 connexions → Règle: SYN_FLOOD_177.37.16.23
```

---

## 🔄 Fonctionnement Adaptatif

### Changement d'Intervalle Automatique

Le système adapte automatiquement l'intervalle de vérification :

```
1. Vérification des logs Apache (toujours exécutée)
2. Vérification des connexions SYN_RECEIVED
3. Calcul du nouvel intervalle basé sur le nombre de SYN
4. Si l'intervalle a changé :
   - Log du changement
   - Mise à jour de l'intervalle
5. Programmation du prochain check avec le nouvel intervalle
```

### Log des Changements

Quand l'intervalle change, un log est affiché :

```
📊 Changement d'intervalle adaptatif:
   Ancien: 20s (niveau: normal)
   Nouveau: 10s (niveau: suspect) - 15 connexions SYN_RECEIVED
```

---

## ⚙️ Configuration

### Seuils (CONFIG)

```javascript
adaptiveIntervals: {
  normal: 20000,    // < 10 SYN : 20 secondes
  suspect: 10000,   // 10-19 SYN : 10 secondes
  moderate: 5000,   // 20-29 SYN : 5 secondes
  severe: 3000      // >= 30 SYN : 3 secondes
}

synSuspectThreshold: 10,  // Email de suspicion si >= 10 SYN
synModerateThreshold: 20, // Passer à 5s si >= 20 SYN
synSevereThreshold: 30,   // Passer à 3s si >= 30 SYN

suspectAlertCooldown: 5 * 60 * 1000, // 5 minutes entre emails de suspicion
```

### Variables d'Environnement (.env)

```env
# Seuils SYN flood (optionnel, valeurs par défaut ci-dessus)
SYN_FLOOD_THRESHOLD=30
AUTO_BAN_ENABLED=true
AUTO_BAN_THRESHOLD=30
AUTO_BAN_MIN_CONNECTIONS=3
AUTO_BAN_PERSIST_TIME=10000
```

---

## 💡 Avantages du Système Adaptatif

### 1. **Économie de Ressources**
- ✅ En temps normal (< 10 SYN) : Vérification toutes les 20 secondes
- ✅ Consommation CPU/Réseau minimale

### 2. **Détection Précoce**
- ✅ Détection dès 10 SYN (email de suspicion)
- ✅ Permet d'anticiper une attaque avant qu'elle ne devienne sévère

### 3. **Réactivité Maximale**
- ✅ En cas d'attaque sévère (>= 30 SYN) : Vérification toutes les 3 secondes
- ✅ Réaction rapide aux attaques

### 4. **Évite le Spam d'Emails**
- ✅ Cooldown de 5 minutes pour les emails de suspicion
- ✅ Cooldown de 10 minutes pour les alertes sévères

### 5. **Adaptation Automatique**
- ✅ Pas besoin d'intervention manuelle
- ✅ Le système s'ajuste automatiquement à la situation

---

## 🔍 Exemple de Scénario

### Scénario 1 : Attaque Progressive

```
Temps 0s   : 5 connexions SYN_RECEIVED → Intervalle: 20s (normal)
Temps 20s  : 12 connexions SYN_RECEIVED → Changement à 10s (suspicion) + Email de suspicion
Temps 30s  : 18 connexions SYN_RECEIVED → Intervalle: 10s (toujours suspicion)
Temps 40s  : 25 connexions SYN_RECEIVED → Changement à 5s (modéré)
Temps 45s  : 35 connexions SYN_RECEIVED → Changement à 3s (sévère) + Alerte email + Auto-ban
Temps 48s  : 45 connexions SYN_RECEIVED → Intervalle: 3s (toujours sévère), IPs bloquées
Temps 51s  : 20 connexions SYN_RECEIVED → Changement à 5s (modéré), attaque en diminution
Temps 56s  : 8 connexions SYN_RECEIVED → Changement à 20s (normal), retour à la normale
```

### Scénario 2 : Attaque Soudaine

```
Temps 0s   : 5 connexions SYN_RECEIVED → Intervalle: 20s (normal)
Temps 20s  : 45 connexions SYN_RECEIVED → Changement direct à 3s (sévère) + Alerte email + Auto-ban
Temps 23s  : 40 connexions SYN_RECEIVED → Intervalle: 3s (toujours sévère)
Temps 26s  : 15 connexions SYN_RECEIVED → Changement à 10s (suspicion), IPs bloquées
Temps 36s  : 8 connexions SYN_RECEIVED → Changement à 20s (normal), retour à la normale
```

---

## 🎯 Points de Vigilance

### 1. **Cooldown des Emails**
- ✅ Les emails de suspicion ne sont envoyés qu'une fois toutes les 5 minutes maximum
- ✅ Les alertes sévères ne sont envoyées qu'une fois toutes les 10 minutes maximum
- ✅ Évite le spam même si le nombre de SYN fluctue

### 2. **Changements d'Intervalle**
- ✅ Le système log chaque changement d'intervalle
- ✅ Permet de suivre l'évolution de l'attaque

### 3. **Performance**
- ✅ En temps normal, vérification toutes les 20 secondes (faible consommation)
- ✅ En cas d'attaque, vérification plus fréquente mais nécessaire

---

## 📊 Monitoring

### Logs Console

Le système affiche des logs informatifs :

```
✅ Monitoring démarré (intervalle adaptatif)
   - Logs Apache (attaques applicatives) - toutes les 20s
   - Connexions réseau (SYN flood) - intervalle adaptatif
   - Intervalle actuel: 20s (niveau: normal)
   - Seuil suspicion: >= 10 SYN
   - Seuil sévère: >= 30 SYN

📊 Changement d'intervalle adaptatif:
   Ancien: 20s (niveau: normal)
   Nouveau: 10s (niveau: suspect) - 15 connexions SYN_RECEIVED

⚠️ SUSPICION : 15 connexions SYN_RECEIVED (niveau suspect)
✅ Alerte de suspicion envoyée: 15 connexions SYN_RECEIVED
```

### Emails

- ✅ Email de suspicion : Priorité moyenne
- ✅ Alerte sévère : Priorité haute
- ✅ Détails complets dans chaque email

---

## 🔧 Dépannage

### Problème : Intervalle ne change pas

**Vérifier :**
1. Le nombre de SYN détecté est-il correct ?
2. Les seuils sont-ils correctement configurés ?
3. Y a-t-il des erreurs dans les logs console ?

### Problème : Trop d'emails

**Solution :**
- Vérifier les cooldowns (`suspectAlertCooldown`, `lastSynFloodAlertTime`)
- Ajuster les cooldowns si nécessaire

### Problème : Performance

**Solution :**
- En temps normal (< 10 SYN), vérification toutes les 20 secondes (normal)
- Si performance dégradée, augmenter l'intervalle normal (ex: 30 secondes)

---

## 📝 Résumé

Le système adaptatif de détection SYN flood :

- ✅ **S'adapte automatiquement** à la gravité de la situation
- ✅ **Détecte précocement** les attaques (dès 10 SYN)
- ✅ **Réagit rapidement** aux attaques sévères (3 secondes)
- ✅ **Économise les ressources** en temps normal (20 secondes)
- ✅ **Évite le spam** d'emails avec des cooldowns
- ✅ **Logs informatifs** pour suivre l'évolution

**Résultat :** Détection précoce, réactivité maximale, consommation maîtrisée.
