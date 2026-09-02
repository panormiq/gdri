# Agents IA & automatisation (orchestrateur)

> **Statut** : architecture cible (alignée produit).  
> **Implémentation actuelle** : familles de blocs génériques (**Action** = contrat de champs, **IA** exécute un prompt s’il y en a un) + providers ; templates Mail / Facebook / validation.  
> **Connecteurs** : voir [`CONNECTOR-SDK.md`](CONNECTOR-SDK.md). Legacy FB / Mail reste en place le temps que l’outil agent soit stable.

---

## 1. Vision en une phrase

**Agent** = produit user ; derrière, un **flow** (graphe) de blocs génériques paramétrables.  
Pas de séparation produit « automatisé / assisté » : un seul catalogue d’Agents. Un badge « validation humaine » apparaît si le flow contient un bloc **Validation** (HITL).

---

## 2. Couches

| Couche | Rôle | Exemple |
|--------|------|---------|
| **Connecteur** | I/O technique + secrets | `mail-in` / `mail-out`, Facebook, (futur Drive…) |
| **Famille de bloc** | Étape canvas générique | Déclencher, Entrées, Condition, Action, IA, Validation, Sortie |
| **Provider / mode** | Paramètre de la famille | `data.provider=mail`, `trigger.mode=cron` |
| **Flow** | Graphe exécutable | Pipeline « Devis & orientation » |
| **Agent (vue user)** | App : nom, image, flow | « Agent Mail » |

- Les **comptes** restent dans **Connecteurs**.
- Les anciennes briques spécialisées (`mail-in`, `cron-trigger`, `human-doc-review`…) sont retirées du canvas.

---

## 3. Les familles

```
[Déclencher] → [Entrées] → [Condition?] → [Action…] → [IA?] → [Validation?] → [Sortie]
```

| Famille | `brickId` | Paramètre principal | Modes / providers v1 |
|---------|-----------|---------------------|----------------------|
| **Déclencher** | `trigger` | `config.mode` | `button`, `cron` |
| **Entrées** | `data` | `config.provider` | `mail`, `facebook`, `disk`, `gdrive` (stub) |
| **Condition** | `condition` | `config.op` / `field` | `if` (oui/non) |
| **Action** | `action` | Contrat de **champs** | Comme une collection : liste de champs (`to`, `body`, `prompt`…). Vide par défaut. Un prompt n’est qu’un champ, proposé si un bloc IA suit. L’éditeur ouvre ces champs. |
| **IA** | `ia` | Exécute un prompt | Lit `prompt` / `context` / `rag` dans le flux (souvent écrits par Action) ou un prompt saisi ici. Écrit `response`. |
| **Validation** | `validation` | HITL | pause `waiting_human` → page **À traiter** |
| **Sortie** | `output` | `config.provider` | `mail`, `facebook`, `webhook`, `disk`, **`collection`** (libre V3) |

Règle : le canvas ne connaît que la famille ; l’I/O réel passe par les **connecteurs** / providers (`FamilyDispatch.js`).

### Contrat de contexte

Toute donnée est un **tableau de lignes**. Un mail, un commentaire ou un document simple = **1 ligne**.

```json
{
  "channel": "mail",
  "items": [{ "text": "", "from": "", "subject": "", "attachments": [] }],
  "itemsCount": 1,
  "itemIndex": 0,
  "item": { "text": "", "from": "", "subject": "" },
  "text": "",
  "from": "",
  "subject": "",
  "options": {},
  "previous": null
}
```

`text` / `from` / `subject` = **ligne courante** (`items[itemIndex]`). Le nom du bloc Entrées est le tableau : `{{#donnees}} … {{donnees.expediteur}} … {{/donnees}}` (le slug `donnees` est conservé). `items` / `item` restent des alias. La boucle canvas mode **chaque ligne** avance `itemIndex`. Flags de contrôle : `__waitingHuman`, `__nextNodeId`, `__skipRemaining`.

---

## 4. UI produit

| Zone | Page |
|------|------|
| Liste Agents (user) | [`user-agents.php`](frontend/pages/user-agents.php) |
| Liste Agents (console entité) | [`entity-agents.php`](frontend/pages/entity-agents.php) |
| Éditeur canvas | [`entity-agent-editor.php`](frontend/pages/entity-agent-editor.php) |
| File HITL **À traiter** | [`agent-human-review.php`](frontend/pages/agent-human-review.php) |

Menu **Automatiser** : `Agents` + `À traiter` (pas deux types d’agents).

`interactionMode` / `derivedInteractionMode` : badge uniquement (`validation` → assisted). Plus de filtre produit auto/assisté obligatoire.

---

## 5. Dispatch connecteurs → agents

- Poll **mail-in** → flows qui ont un nœud `data` (Entrées) avec `provider: mail`.
- Poll / webhook **facebook** → flows avec `data.provider: facebook`.
- Scheduler cron → flows dont le trigger a `mode: cron`.

Le connecteur injecte un tableau (1 ligne par événement poll/webhook). Le bloc **Entrées** fait un passthrough s’il est déjà présent. Un lancement manuel relit le connecteur et renvoie **toutes** les lignes du lot.

---

## 6. Fichiers clés

| Zone | Chemin |
|------|--------|
| Manifests familles | `backend/core/agent-flow/bricks/{trigger,data,condition,action,ia,validation,output}/` |
| Contrats données | `backend/core/agent-flow/data-contracts.json` |
| Contrats actions | `backend/core/agent-flow/action-contracts.json` |
| Contrats zones Action | `backend/core/agent-flow/zone-contracts.json` |
| CRUD d’app (structure) | [`AGENT-APP-CRUD.md`](AGENT-APP-CRUD.md) · `backend/core/agent-flow/app-crud/` |
| Dispatch | `backend/core/agent-flow/families/FamilyDispatch.js` |
| Registre | `backend/core/agent-flow/FlowBrickRegistry.js` |
| Exécuteur | `backend/core/agent-flow/FlowExecutor.js` |
| Templates | `backend/core/agent-flow/flowTemplates.js` |
| API | `backend/routes/agent-flows.js` |
| Canvas | `frontend/assets/js/agent-flow/agent-canvas.js` |
| Liste | `frontend/assets/js/agent-flow/agents-list-app.js` |

---

## 7. Roadmap

| Phase | Contenu |
|-------|---------|
| **A (fait)** | Familles, Action (champs) + IA (exécution d’un prompt), HITL Validation, providers mail/FB |
| **B** | Webhook trigger + polling agent-side plus riche |
| **C** | Providers Drive / autres réseaux complets |
| **D** | Brique `call-flow` / sous-automatisation |
| **E** | Actions métier user + assistant IA de conception |
| **F** | CRUD d’app vers les blocs (voir [`AGENT-APP-CRUD.md`](AGENT-APP-CRUD.md)) |
