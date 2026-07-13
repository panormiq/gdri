# Module GDERPI — conventions et consignes (IA & développeurs)

> **Lire ce fichier avant toute modification** dans `modules/gderpi/`.  
> GDERPI = mini ERP commercial GDRI (multi-boutique, produits/services, devis → commandes).  
> **Indépendant d'UGAP** — aucun import depuis `modules/ugap/`.

---

## Règles obligatoires

### 1. Une fonction = un fichier

- **Chaque fonction exportée** vit dans **son propre fichier** (pas de classes multi-méthodes monolithiques).
- Nom du fichier = nom de la fonction en kebab-case : `listBoutiques.js` → `listBoutiques`.
- Si deux fonctions apparaissent dans un fichier → **scinder immédiatement**.
- Ordre de grandeur : **50–150 lignes** par fichier (hors en-tête commenté).

### 2. En-tête obligatoire

```text
/**
 * FICHIER : chemin/relatif/nomFichier.js
 * RÔLE : une phrase — ce que ce fichier fait et ne fait pas.
 *
 * ENTRÉES : d'où viennent les données
 * SORTIES : ce qui est retourné / modifié
 *
 * DÉPEND DE : fichiers/modules appelés
 * NE PAS : ce qu'il ne faut pas ajouter ici
 *
 * APPELÉ PAR : qui utilise ce fichier
 */
```

### 3. Valider avant de coder

1. Rédiger la description de la fonction dans `docs/PLAN.md`.
2. Statut `📝 à valider` → attendre validation (`✅ validé`).
3. Coder → `💻 codé` → test → `🧪 testé OK`.

### 4. Périmètre module

| Zone | Chemin | Rôle |
|------|--------|------|
| API Node | `modules/gderpi/backend/` | Routes `/api/gderpi/*`, services, Mongo entreprise |
| Paramétrage | `frontend/parametrage/` | Config boutiques, séquences, connecteurs e-facture |
| Application | `frontend/app/` | Catalogue, tiers, devis, commandes |
| Docs | `docs/PLAN.md` | Plan fonction par fonction — **source de vérité** |
| Core GDRI | `backend/` (racine) | JWT, DB, chargement module — `../../../` depuis le backend GDERPI |

### 5. Collections Mongo (préfixe `gderpi_`)

Ne pas inventer de collections hors plan. Voir `docs/PLAN.md` § Collections.

### 6. Ce qu'il ne faut pas faire

- Importer ou dépendre de `modules/ugap/`.
- Inventer des endpoints non listés dans `docs/PLAN.md` ou `backend/routes.js`.
- Regrouper plusieurs fonctions dans un même fichier « pour aller plus vite ».
- Modifier UGAP pour des besoins GDERPI (pont optionnel = adaptateur séparé, phase ultérieure).

---

## Fichiers de référence

- `docs/PLAN.md` — plan complet, une fonction par fichier
- `docs/DESIGN.md` — **guide UI** (formulaires, modales, tableaux, classes CSS)
- `README.md` — installation et démarrage (à créer en phase 0)

---

## Pour l'IA Cursor

1. Lire `CONVENTIONS.md` + `docs/PLAN.md` + `docs/DESIGN.md` avant tout code.
2. **Une fonction par fichier** — sans exception.
3. Valider les descriptions dans le plan avant d'implémenter.
4. Réutiliser les patterns GDRI (`authenticateJWT`, `getEntrepriseDb`) — pas ceux d'UGAP.
5. Tester chaque fonction isolément après implémentation.
