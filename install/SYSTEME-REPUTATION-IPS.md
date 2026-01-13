# 🛡️ Système de Réputation IP - Ban Automatique des IPs Récidivistes

## 📊 Vue d'ensemble

Le système de réputation track les IPs qui commettent des attaques répétées et les ban automatiquement si elles atteignent un seuil de score.

### Principe

Chaque détection d'attaque augmente le **score de réputation** d'une IP. Si le score dépasse un seuil (par défaut : 5), l'IP est automatiquement bannie via le pare-feu Windows.

---

## 🎯 Fonctionnement

### 1. Détection d'Attaque

Quand une attaque est détectée (sensitive_file_access, SQL injection, XSS, etc.) :

```
Détection attaque → Calcul score selon sévérité → Mise à jour réputation IP
```

### 2. Calcul du Score

Le score est calculé selon la **sévérité** de l'attaque :

| Sévérité | Score ajouté | Exemples |
|----------|--------------|----------|
| **Low** | +1 point | Tentative d'accès fichier sensible |
| **Medium** | +2 points | SQL injection, XSS, accès fichiers sensibles |
| **High** | +3 points | Directory traversal, méthodes suspectes |

### 3. Décroissance du Score

Le score **décroît avec le temps** pour éviter les bans permanents :

- **Décroissance :** 10% par heure
- **Fenêtre de temps :** 24 heures (score basé sur les détections des dernières 24h)
- **Nettoyage :** Entrées supprimées si score < 0.1 et pas d'activité > 24h

### 4. Ban Automatique

Si le score >= **seuil de ban** (par défaut : 5), l'IP est automatiquement bannie :

```
Score >= 5 → Ban automatique via Windows Firewall → Suppression de la réputation
```

---

## ⚙️ Configuration

### Configuration par Défaut

```javascript
reputationSystem: {
  enabled: true,                    // Activer le système de réputation
  detectionScore: 1,                // Score par détection (low severity)
  moderateScore: 2,                 // Score si attaque modérée (medium severity)
  severeScore: 3,                   // Score si attaque sévère (high severity)
  banThreshold: 5,                  // Ban si score >= 5 en 24h
  timeWindow: 24 * 60 * 60 * 1000, // Fenêtre de temps : 24 heures
  decayRate: 0.1,                   // Décroissance : 10% par heure
  minScoreForTracking: 2,           // Commencer à tracker si score >= 2
  cleanupInterval: 60 * 60 * 1000  // Nettoyage toutes les heures
}
```

### Variables d'Environnement (.env)

```env
# Système de réputation (optionnel)
REPUTATION_SYSTEM_ENABLED=true
REPUTATION_BAN_THRESHOLD=5
```

---

## 📊 Exemple de Scénario

### Scénario : IP 185.177.72.67 (votre cas)

```
10/01/2026 02:45:35 → Accès /.env.development → Score: +2 (medium)
10/01/2026 02:45:35 → Accès /.env.bak         → Score: +2 (medium) → Total: 4
10/01/2026 02:45:35 → Accès /.env.old         → Score: +2 (medium) → Total: 6

Score 6 >= 5 → 🚫 BAN AUTOMATIQUE
```

### Scénario : Attaque Progressive

```
Jour 1, 10h00 : IP 177.37.16.23 → SQL injection → Score: +2
Jour 1, 14h30 : IP 177.37.16.23 → Accès .env    → Score: +2 → Total: 4
Jour 1, 18h00 : IP 177.37.16.23 → XSS           → Score: +2 → Total: 6

Score 6 >= 5 → 🚫 BAN AUTOMATIQUE
```

### Scénario : Décroissance du Score

```
Jour 1, 10h00 : IP 177.37.16.23 → Score: 4
Jour 1, 14h00 : IP 177.37.16.23 → Décroissance 4h → Score: 3.84 (10% * 4h = 40% de 4 = 1.6, 4 - 1.6 = 2.4...)
Jour 2, 10h00 : IP 177.37.16.23 → Décroissance 24h → Score: < 0.1 → Suppression automatique
```

---

## 🔍 Détection des Types d'Attaques

### Types d'Attaques Détectées

| Type d'Attaque | Sévérité | Score |
|----------------|----------|-------|
| **sensitive_file_access** | Medium | +2 |
| **sql_injection** | Medium | +2 |
| **xss** | High | +3 |
| **directory_traversal** | High | +3 |
| **suspicious_method** | Medium | +2 |
| **suspicious_user_agent** | Low | +1 |

### Exemples de Détection

```
GET /.env              → sensitive_file_access → Score: +2
GET /wp/.env           → sensitive_file_access → Score: +2
GET /backend/.env      → sensitive_file_access → Score: +2
GET /?id=1' OR '1'='1  → sql_injection        → Score: +2
GET /?page=<script>    → xss                  → Score: +3
GET /../../../etc/passwd → directory_traversal → Score: +3
```

---

## 💡 Avantages du Système

### 1. **Détection Précoce**
- ✅ Détecte les IPs récidivistes dès la première attaque
- ✅ Ban automatique après plusieurs détections

### 2. **Évite les Faux Positifs**
- ✅ Score basé sur plusieurs détections (pas ban immédiat)
- ✅ Décroissance du score avec le temps
- ✅ Fenêtre de temps de 24h (pas ban permanent)

### 3. **Adaptatif**
- ✅ Score varie selon la sévérité de l'attaque
- ✅ Nettoyage automatique des anciennes entrées

### 4. **Transparent**
- ✅ Logs détaillés des scores et bannissements
- ✅ Emails d'alerte incluent les scores de réputation

---

## 📧 Intégration dans les Emails d'Alerte

### Informations Ajoutées

Les emails d'alerte incluent maintenant :

1. **Score de réputation** pour chaque IP suspecte
2. **Nombre de détections** pour chaque IP
3. **IPs avec réputation élevée** (proches du ban)
4. **Statut de ban** si IP déjà bannie

### Exemple d'Email

```
🌐 Adresses IP suspectes:
  - 185.177.72.67: 5 attaque(s) (score réputation: 6.0, 3 détections) [BLOQUÉE]
  - 177.37.16.23: 3 attaque(s) (score réputation: 4.0, 2 détections)

⚠️ IPs avec réputation élevée (surveillance active):
  - 213.209.157.170: Score 3.5/5 (70%) - 2 détections
```

---

## 🔧 Dépannage

### Problème : IP non bannie malgré plusieurs attaques

**Vérifier :**
1. Le système de réputation est-il activé ? (`REPUTATION_SYSTEM_ENABLED=true`)
2. Le score atteint-il le seuil ? (par défaut : 5)
3. Y a-t-il des erreurs dans les logs console ?

**Solution :**
- Vérifier les logs console : score affiché pour chaque IP
- Vérifier le seuil de ban : `REPUTATION_BAN_THRESHOLD=5`

### Problème : Trop de bannissements

**Solution :**
- Augmenter le seuil de ban : `REPUTATION_BAN_THRESHOLD=10`
- Augmenter le décroissance : `decayRate: 0.15` (15% par heure)

### Problème : Pas assez de bannissements

**Solution :**
- Diminuer le seuil de ban : `REPUTATION_BAN_THRESHOLD=3`
- Réduire le décroissance : `decayRate: 0.05` (5% par heure)

---

## 📊 Monitoring

### Logs Console

Le système affiche des logs informatifs :

```
🚨 5 nouvelle(s) attaque(s) détectée(s):
  - [sensitive_file_access] 185.177.72.67 (score: 2.0) -> /.env.development
  - [sensitive_file_access] 185.177.72.67 (score: 4.0) -> /.env.bak
  - [sensitive_file_access] 185.177.72.67 (score: 6.0) -> /.env.old

🚫 IP récidiviste détectée: 185.177.72.67 (score: 6.0, 3 détections)

🚫 IP bloquée automatiquement: 185.177.72.67

🚫 1 IP(s) bannie(s) automatiquement (système de réputation):
   - 185.177.72.67: Score 6.0 (3 détections)
```

### État Sauvegardé

Le système sauvegarde l'état dans `.security-monitor-state.json` :

```json
{
  "ipReputation": {
    "185.177.72.67": {
      "score": 6.0,
      "firstSeen": 1704859535000,
      "lastSeen": 1704859535000,
      "detections": [
        {
          "timestamp": 1704859535000,
          "attackType": "sensitive_file_access",
          "severity": "medium",
          "score": 2
        }
      ]
    }
  },
  "bannedIPs": ["185.177.72.67"]
}
```

---

## 🎯 Réponse à Votre Cas

### IP 185.177.72.67 - 5 Tentatives d'Accès Fichiers Sensibles

**Avec le système de réputation :**

```
Tentative 1 : /.env.development → Score: +2
Tentative 2 : /.env.bak         → Score: +2 → Total: 4
Tentative 3 : /.env.old         → Score: +2 → Total: 6

Score 6 >= 5 → 🚫 BAN AUTOMATIQUE
```

**Résultat :** L'IP sera automatiquement bannie après 3 tentatives d'accès à des fichiers sensibles.

---

## 📝 Résumé

Le système de réputation :

- ✅ **Track les IPs récidivistes** automatiquement
- ✅ **Ban automatique** si score >= seuil (par défaut : 5)
- ✅ **Score adaptatif** selon sévérité de l'attaque
- ✅ **Décroissance temporelle** pour éviter bans permanents
- ✅ **Logs détaillés** pour monitoring
- ✅ **Intégration emails** avec scores de réputation

**Résultat :** Protection proactive contre les IPs récidivistes avec ban automatique après plusieurs détections.
