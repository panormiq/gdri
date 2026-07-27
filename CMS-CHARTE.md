# Charte plateforme GDRI — CMS, modules, infra

> **Statut** : document de référence produit.  
> **Principe** : trois blocs distincts. Ne pas mélanger leurs périmètres.

Voir aussi : [`ARCHITECTURE-MODULES.md`](ARCHITECTURE-MODULES.md) (chargement technique).

---

## Vue d’ensemble — 3 blocs

```
┌─────────────────────────────────────────────────────────────┐
│  CMS (noyau portable)                                       │
│  Auth · entités · shell · utilisateurs                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────────┐           ┌─────────────────────┐
│ Gestion des modules │           │ Gestion de l’infra  │
│ install · activer   │           │ extensions techniques│
│ apps · agents       │           │ mail · ia · prompt…  │
└──────────┬──────────┘           └──────────┬──────────┘
           │                                  │
           └──────────────┬───────────────────┘
                          ▼
              Modules métier (GDERPI, UGAP, PM…)
              branchés sur le CMS + infra
```

**Si on installe le CMS ailleurs** (autre serveur, autre client, instance vierge) :

1. On a **login, entités, shell** — mais **aucune app, aucune infra**.
2. Il faut **brancher la gestion des modules** : découvrir ce qui est installé sur le disque, l’enregistrer, l’activer par entité.
3. Il faut **brancher la gestion de l’infra** : activer et configurer les extensions (au minimum Mail si des apps envoient des mails).
4. Ensuite seulement on installe / active les **apps** (GDERPI, UGAP…).

Le CMS seul ne suffit pas à faire tourner GDRI métier. **Modules + infra** sont les deux couches manquantes — ce n’est pas du CMS.

---

## 1. CMS — noyau portable (périmètre strict)

### Mission

Fournir le **cadre** dans lequel tout le reste s’installe : identité, tenants, navigation.  
**Sans métier. Sans mail. Sans IA. Sans catalogue de apps.**

### Dans le périmètre

| # | Responsabilité | Contenu |
|---|----------------|---------|
| 1 | **Identité & accès** | Login, sessions, JWT, rôles `ADMIN_GDRI` / `ADMIN_ENTITY` / `USER_ENTITY`, appartenance user ↔ entités |
| 2 | **Multi-entité** | CRUD entités, entité courante, isolation Mongo (`GDR-ENTREPRISE-{id}`), middleware de sélection de base |
| 3 | **Utilisateurs** | Comptes et droits au niveau plateforme et entité |
| 4 | **Shell & navigation** | Header, sidebar, layout, zones de menu **vides ou pilotées par les autres blocs** — pas le contenu des apps |

### Hors périmètre CMS (→ autres blocs)

| Sujet | Bloc concerné |
|-------|----------------|
| Quels modules existent, les activer | **Gestion des modules** |
| Mail, IA, Prompt, presets fournisseurs | **Gestion de l’infra** |
| Grille Applications, agents | **Gestion des modules** (affichage) |
| Paramètres → liens Mail / IA | **Gestion de l’infra** (+ manifests modules) |
| Console plateforme → Extensions | **Gestion de l’infra** |
| Devis, Facebook, UGAP… | **Modules métier** |

### Ce que le CMS expose (interfaces stables)

Pour rester portable, le CMS fournit des **points d’accroche**, pas le métier :

- Slots de menu (sidebar entité / sidebar plateforme).
- Zone « espace de travail » (entité courante).
- Routes API noyau : `/api/users`, `/api/entities`, auth.
- Contexte requête : `req.user`, `currentEntrepriseId`, base entité sélectionnée.

Les blocs **modules** et **infra** s’y branchent ; le CMS ne les implémente pas.

### Fichiers typiques (aujourd’hui)

`frontend/auth/`, `frontend/includes/header.php`, `admin-sidebar.php`, `backend/routes/users.js`, `backend/routes/entities.js`, `backend/config/database.js`, `backend/middleware/authenticateJWT.js`.

---

## 2. Gestion des modules

### Mission

Savoir **ce qui est installé**, **ce qui est activé** pour chaque entité, et **comment y accéder** (apps, agents).  
C’est la couche **plug-in** au-dessus du CMS.

### Dans le périmètre

| # | Responsabilité | Contenu |
|---|----------------|---------|
| 1 | **Registry** | Découverte des dossiers `modules/`, lecture `package.json`, montage routes (`module-registry`, `module-loader`) |
| 2 | **Catalogue** | Collection `services`, sync (`services-catalog-sync`), types `app` / `agent` / `extension` |
| 3 | **Activation** | Quels modules sont autorisés par entité |
| 4 | **Dépendances** | Vérifier `requiredServices` avant activation (ex. GDERPI nécessite `mail`) |
| 5 | **Affichage** | Grille **Applications**, section **Agents IA**, entrées de navigation vers les apps |
| 6 | **Admin plateforme** | Rechargement modules, statut chargé / activé (`/api/admin/modules/*`) |

### Hors périmètre

- Configurer les comptes SMTP → **infra Mail**
- Configurer les modèles IA → **infra IA**
- Logique métier d’une app → **module métier**

### Contrat module (déclaratif)

Chaque module s’enregistre via `package.json` (+ optionnel `module.php` pour liens Paramètres).  
La **gestion des modules** lit ces fichiers ; le **CMS** ne les parse pas.

```json
{
  "name": "gderpi",
  "routes": ["/api/gderpi"],
  "requiredServices": ["mail"],
  "catalog": { "type": "app", "visibility": "public" }
}
```

### Fichiers typiques (aujourd’hui)

`backend/core/module-registry.js`, `module-loader.js`, `services-catalog-sync.js`, `frontend/pages/modules.php`, `filterCatalogApplications()` dans `functions.php`.

---

## 3. Gestion de l’infra

### Mission

Extensions **techniques partagées** : installées une fois, configurées par entité, consommées par les apps via `requiredServices`.  
Pas visibles comme apps dans la grille Applications (`catalog.type: extension`, `visibility: hidden`).

### Dans le périmètre

| # | Responsabilité | Contenu |
|---|----------------|---------|
| 1 | **Extensions** | Mail, IA, Prompt, (futur : doc-template, etc.) |
| 2 | **Config entité** | Écrans accessibles depuis **Paramètres** (hub : `entity-config.php` affiche les liens, l’infra fournit les pages) |
| 3 | **Config plateforme** | Réglages globaux admin GDRI (ex. fournisseurs mail, serveurs IA plateforme) — **Console plateforme → Extensions** |
| 4 | **API infra** | `/api/mail`, `/api/ia`, `/api/prompt` — consommées par les apps, pas par le CMS |

### Règle centrale (Mail)

- **Infra Mail** = seul endroit pour les **comptes SMTP/IMAP** de l’entité.
- Les apps déclarent `"requiredServices": ["mail"]` et configurent **leurs règles métier** (quel compte pour quel envoi) dans **leur** tiroir — sans recréer des boîtes mail.

### Hors périmètre

- Apps métier (GDERPI, PM, UGAP…)
- Agents IA (analyse d’intention…) — relèvent de la **gestion des modules**, consomment l’infra

### Fichiers typiques (aujourd’hui)

`modules/mail/`, `modules/ia/`, `modules/prompt/`, `frontend/pages/modules/mail-config.php`, `ia-config.php`, `frontend/pages/admin-modules.php`, `admin-modules-mail.php`.

---

## 4. Répartition des écrans (qui fait quoi)

| Écran | Bloc |
|-------|------|
| Login, header, sidebar (structure) | **CMS** |
| Utilisateurs, entités | **CMS** |
| Applications, Agents IA | **Gestion des modules** |
| Paramètres (Structurel / Connecteurs) | **Infra** + **Connecteurs** (base propre) |
| Legacy (sidebar) | Configuration historique en migration |
| Mail config, IA config | **Gestion de l’infra** |
| Console plateforme → Extensions | **Gestion de l’infra** |
| GDERPI, UGAP, PM, Facebook… | **Modules métier** |

---

## 5. État actuel — mélanges à corriger (plus tard)

| Problème | Bloc fautif |
|----------|-------------|
| Catalogue / activation dans la charte « CMS » | À sortir du CMS → **gestion modules** |
| Détail Mail, IA, GDERPI dans la charte CMS | Hors sujet → **infra** ou **modules métier** |
| Mail affiché dans Applications | **Gestion modules** affiche une extension comme une app |
| `entity-config.php` liste hardcodée | Hub CMS OK, contenu doit venir des **manifests** infra/modules |
| `mail-config.php?module=gderpi` | Confusion **infra** vs **module métier** |

---

## 6. Connecteurs (entrées / sorties)

Les **connecteurs** sont des packages installables (webhook, poll IMAP, HTTP…) : **I/O uniquement**.

- Spec développeur : [`CONNECTOR-SDK.md`](CONNECTOR-SDK.md)
- Orchestration agents (multi-canal, pipeline, briques) : [`AGENT-AUTOMATION.md`](AGENT-AUTOMATION.md)
- Core : `backend/core/connectors/`
- Packages : `connectors/<id>/`

## 7. Prochaine étape documentaire

1. Valider CMS / modules / infra (cette charte).
2. Suivre [`AGENT-AUTOMATION.md`](AGENT-AUTOMATION.md) pour l’outil agent (phases B→E).
3. Alignement code progressif ; **ne pas couper** legacy FB/Mail avant bascule volontaire.

---

*Le CMS est le conteneur portable. La gestion des modules et la gestion de l’infra sont obligatoires pour exploiter GDRI — mais ce ne sont pas le CMS.*
