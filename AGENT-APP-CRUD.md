# Collections agent : libre vs CRUD d’app

> **Statut** : structure posée, **pas encore branchée sur les blocs**.  
> Collections **libres** (V3, base client) : déjà sur **Sortie**.  
> CRUD **par app** : manifeste + registre ; chaque bloc (Entrées, Sortie, Action…) s’y raccroche plus tard.

Voir aussi [`AGENT-AUTOMATION.md`](AGENT-AUTOMATION.md).

---

## 1. Deux catalogues

| Catalogue | Qui le possède | Écriture | Aujourd’hui |
|-----------|----------------|----------|-------------|
| **Libre** | L’utilisateur, via l’éditeur de collections V3 | `collection_data_*` (base **client**) | Sortie `provider=collection` |
| **App** | Un module (GDERPI, etc.) | Le **service** métier de l’app (validations, numéros, workflow) | Manifeste seulement |

Un agent verra plus tard : **mes collections** + **ce que les apps ont ouvert**. Pas tout le CRUD de l’app.

L’IA ne choisit pas la base. Elle produit des champs. Le bloc (Entrées / Sortie / Action) lit ou écrit selon le contrat choisi.

---

## 2. Manifeste d’app

Chaque module qui veut exposer un CRUD aux agents dépose :

```
modules/<app>/backend/agent-crud.json
```

(ou `backend/modules/<app>/agent-crud.json` pour un module core).

```json
{
  "appId": "gderpi",
  "label": "GDERPI",
  "enabled": true,
  "collections": [
    {
      "id": "devis",
      "label": "Devis",
      "ops": ["read", "create"],
      "writeVia": "service",
      "wired": false,
      "key": "numero",
      "serviceRef": "modules/gderpi/backend/services/devis/createDevis.js",
      "fields": []
    }
  ]
}
```

| Champ | Rôle |
|-------|------|
| `ops` | `read` / `create` / `update` (whitelist, jamais le Mongo brut) |
| `writeVia` | Toujours `service` pour une app. `collection` = libre V3 uniquement. |
| `wired` | `false` tant que le service n’est pas branché. Le registre expose quand même l’entrée. |
| `key` | Clé métier pour un upsert (`numero`, `id`…) |
| `fields` | Contrat de champs (même idée que l’Action / une collection V3). Vide = à remplir au branchement. |
| `serviceRef` | Module Node à appeler plus tard. Pas d’`insertOne` dans `commandes_client`. |

Copie : [`backend/core/agent-flow/app-crud/manifest.example.json`](backend/core/agent-flow/app-crud/manifest.example.json).  
Premier stub : [`modules/gderpi/backend/agent-crud.json`](modules/gderpi/backend/agent-crud.json).

---

## 3. Fichiers

| Fichier | Rôle |
|---------|------|
| `backend/core/agent-flow/app-crud/app-crud-contract.json` | Forme d’une collection exposée |
| `backend/core/agent-flow/app-crud/appCrudRegistry.js` | Découverte des `agent-crud.json` |
| `backend/core/agent-flow/app-crud/appCrudDispatch.js` | Exécution (refuse tant que `wired` est faux) |
| `GET /api/agent-flows/app-crud` | Catalogue pour le canvas, plus tard |

Les blocs **ne lisent pas encore** ce catalogue. Quand on branchera :

- **Entrées** : picker = collections V3 + collections d’app en `read`
- **Sortie** : picker = collections V3 + collections d’app en `create` / `update`
- **Action** : optionnellement une op métier (`gderpi.devis.create`) au lieu d’un dump de champs

---

## 4. Règles

1. **Libre ≠ app.** Une collection V3 n’a pas les règles d’une commande client.
2. **Pas d’écriture Mongo métier.** GDERPI (et les autres) passent par leur service.
3. **Whitelist.** Une app n’expose que ce qu’elle déclare. Pas « tout le CRUD ».
4. **Un bloc = un contrat.** Le schéma (champs V3 ou `fields` du manifeste) est le mapping.
5. **Create vs upsert.** Même logique que Sortie libre (`sourceRef` / `key` métier).

---

## 5. Branchement ultérieur (par bloc)

Rien à faire dans le canvas tant qu’on n’a pas choisi le premier bloc.

1. Remplir `fields` + `wired: true` sur **une** collection d’une app (ex. GDERPI devis `read`).
2. Implémenter le handler dans `appCrudDispatch` (`read` / `create` / `update`).
3. Brancher le picker du bloc concerné sur `GET /app-crud`.
4. Répéter pour les autres collections, puis les autres blocs.
