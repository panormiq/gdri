# Flux OAuth Facebook - Détail Étape par Étape

## 🎯 Où se passe chaque étape ?

### Étape 1 : OAuth (Connexion)

**C'est un mélange de gdri.fr ET facebook.com** :

#### 1.1 Sur gdri.fr (Démarrage)
- L'utilisateur est sur : `https://www.gdr-innovation.fr/pages/modules/facebook-config.php`
- Il clique sur le bouton **"Se connecter avec mon compte Facebook"**
- Le JavaScript fait un appel API : `GET /api/facebook/oauth/login`
- Le serveur GDRI génère une URL Facebook et la renvoie

#### 1.2 Redirection vers Facebook (facebook.com)
- L'utilisateur est **automatiquement redirigé** vers :
  ```
  https://www.facebook.com/v24.0/dialog/oauth?
    client_id=APP_ID&
    redirect_uri=https://www.gdr-innovation.fr/api/facebook/oauth/callback&
    scope=pages_show_list,pages_read_engagement&
    state=ENCODED_STATE
  ```
- L'utilisateur est maintenant sur **facebook.com**
- Il doit :
  1. **Se connecter** avec son compte Facebook (s'il n'est pas déjà connecté)
  2. **Autoriser l'application GDRI** à accéder à ses pages
  3. Voir les permissions demandées :
     - `pages_show_list` : Voir vos pages
     - `pages_read_engagement` : Lire les posts et commentaires
     - `pages_manage_posts` : Gérer les posts

#### 1.3 Retour automatique vers gdri.fr
- Facebook **redirige automatiquement** vers :
  ```
  https://www.gdr-innovation.fr/api/facebook/oauth/callback?
    code=AUTHORIZATION_CODE&
    state=ENCODED_STATE
  ```
- L'utilisateur est maintenant de retour sur **gdri.fr**
- Le serveur GDRI :
  1. Vérifie le `state` (sécurité)
  2. Échange le `code` contre un **User Access Token**
  3. Utilise le token pour récupérer les pages de l'utilisateur
  4. Si une seule page : connexion automatique
  5. Si plusieurs pages : affiche la sélection
  6. Redirige vers : `https://www.gdr-innovation.fr/pages/modules/facebook-config.php?success=connected`

#### 1.4 Finalisation sur gdri.fr
- L'utilisateur voit la page de configuration
- La page Facebook est maintenant connectée
- Les informations sont affichées dans "Configuration actuelle"

---

## 📊 Résumé du Flux

```
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 1.1 : Sur gdri.fr                                     │
│ ─────────────────────────────────────────────────────────── │
│ Utilisateur clique "Se connecter avec Facebook"            │
│ → JavaScript appelle GET /api/facebook/oauth/login        │
│ → Serveur génère URL Facebook                              │
│ → Redirection automatique vers Facebook                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 1.2 : Sur facebook.com                                │
│ ─────────────────────────────────────────────────────────── │
│ Utilisateur se connecte (si pas connecté)                   │
│ → Voit l'écran d'autorisation                              │
│ → "GDRI demande l'accès à vos pages"                       │
│ → Clique "Autoriser"                                       │
│ → Facebook redirige vers gdri.fr avec un code              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 1.3 : Retour sur gdri.fr                             │
│ ─────────────────────────────────────────────────────────── │
│ GET /api/facebook/oauth/callback?code=XXX&state=YYY       │
│ → Serveur échange code contre token                        │
│ → Récupère les pages Facebook                              │
│ → Sauvegarde la configuration                              │
│ → Redirige vers la page de config avec succès              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 1.4 : Finalisation sur gdri.fr                       │
│ ─────────────────────────────────────────────────────────── │
│ Page de configuration affichée                              │
│ → "Configuration actuelle" montre la page connectée         │
│ → Prêt à recevoir les webhooks ✅                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎬 Pour la Vidéo

### Ce qu'il faut montrer :

1. **Sur gdri.fr** (10 secondes) :
   - "Je suis sur la page de configuration Facebook"
   - "Je clique sur 'Se connecter avec mon compte Facebook'"
   - **Montrer le clic**

2. **Redirection vers Facebook** (5 secondes) :
   - "Je suis automatiquement redirigé vers Facebook"
   - **Montrer l'URL changer vers facebook.com**

3. **Sur facebook.com** (30 secondes) :
   - "Je me connecte avec mon compte Facebook personnel"
   - "Je vois l'écran d'autorisation"
   - "GDRI demande l'accès à mes pages"
   - "Je vois les permissions : pages_show_list, pages_read_engagement..."
   - "Je clique sur 'Autoriser'"
   - **Montrer l'écran d'autorisation Facebook**

4. **Retour automatique sur gdri.fr** (10 secondes) :
   - "Je suis automatiquement redirigé vers GDRI"
   - **Montrer l'URL changer vers gdri.fr**
   - "La page est maintenant connectée"
   - **Montrer la section "Configuration actuelle"**

---

## ✅ Réponse à votre question

**L'étape 1 se fait sur les DEUX** :

1. **Démarrage** : Sur **gdri.fr** (clic sur le bouton)
2. **Connexion/Autorisation** : Sur **facebook.com** (l'utilisateur se connecte et autorise)
3. **Finalisation** : Retour sur **gdri.fr** (configuration sauvegardée)

C'est le flux OAuth standard : on démarre sur notre site, on redirige vers Facebook pour l'autorisation, puis on revient sur notre site avec le code.
