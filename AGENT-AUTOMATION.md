# Agents IA & automatisation (orchestrateur)

> **Statut** : architecture cible (alignée produit).  
> **Implémentation actuelle** : briques préfaites + flows linéaires + templates Mail/Facebook ; multi-trigger / adapteur / briques métier user = roadmap.  
> **Connecteurs** : voir [`CONNECTOR-SDK.md`](CONNECTOR-SDK.md). Legacy FB / Mail reste en place le temps que l’outil agent soit stable.

---

## 1. Vision en une phrase

**Multi-entrées (canaux) → adapteur (options selon le canal) → pipeline métier commun** ; chaque brique lit dans le contexte uniquement ce dont elle a besoin.  
L’utilisateur voit une **app agent** ; GDRI gère les automatisations derrière.

---

## 2. Couches

| Couche | Rôle | Exemple |
|--------|------|---------|
| **Connecteur** | I/O technique (récupérer / envoyer) | `mail-in`, `mail-out`, Facebook webhook/Graph, WhatsApp, formulaire contact |
| **Brique** | Étape réutilisable dans un flow | `analyse-intention`, `route-intention`, `créer-devis`, adapteur canal |
| **Flow (automatisation)** | Graphe exécutable : triggers + briques | Pipeline « Devis & orientation » |
| **App agent (vue user)** | Produit : intentions, routage, canaux on/off | « Agent devis multi-canal » |

- Les **comptes** SMTP/IMAP / tokens API restent dans **Connecteurs** (infra), pas dans l’app agent.
- L’**analyse d’intention** est une **brique**, pas une app catalogue à part.
- Facebook / Mail **legacy** continuent de tourner en parallèle jusqu’à bascule volontaire.

---

## 3. Multi-trigger + pipeline unique (modèle cible)

Si plusieurs canaux alimentent **le même** métier (ex. devis), on ne duplique **pas** 30 étapes × N canaux.

```
[mail-in]  [formulaire contact]  [whatsapp]
                 │
                 ▼
        [adapteur canal]
        écrit dans le contexte :
          - intentionSet / liste d'intentions
          - replyMode (email | whatsapp | …)
          - options utiles aux briques suivantes
                 │
                 ▼
        [normaliser message]  (optionnel)
                 │
                 ▼
        [analyse-intention]
                 │
                 ▼
        [routage]
           ├─ demande_devis     → [créer devis]
           └─ question_technique → [notifier SAV]
                 │
                 ▼
        [répondre]  selon replyMode + canal d'origine
```

### Pourquoi multi-input ici

- Même pipeline → **une** maintenance.
- Le trigger dit *d’où ça vient* ; l’adapteur dit *comment analyser / répondre*.
- Chaque run est tagué (`channel: mail | contact | whatsapp`) pour l’historique.

### Quand garder 1 trigger = 1 flow

- Process **différents** après l’entrée (commentaire public FB ≠ mail privé).
- Canaux encore expérimentaux, droits ou scaling séparés.

**Règle** : ne jamais copier un long pipeline ; soit multi-trigger sur un flow, soit mini-flow canal + brique `call-flow` vers le pipeline partagé.

---

## 4. Contexte de run (contrat entre briques)

Au démarrage (après trigger + adapteur), le contexte contient au minimum :

```json
{
  "channel": "mail",
  "message": {
    "text": "…",
    "from": "…",
    "subject": "…",
    "attachments": []
  },
  "options": {
    "intentionSet": "devis_default",
    "replyMode": "email"
  },
  "previous": null
}
```

- Chaque brique lit `message` / `options` / `previous` selon besoin.
- Chaque brique écrit un `previous` typé (`analyse-result`, `route-result`, `devis-result`…).
- L’adapteur **ne contient pas** toute la logique métier : il **prépare** les options.

Exemple d’adapteur :

| Trigger | `options` posées |
|---------|------------------|
| Mail | `intentionSet: devis_mail`, `replyMode: email` |
| Contact web | `intentionSet: devis_web`, `replyMode: email` |
| WhatsApp | `intentionSet: devis_wa`, `replyMode: whatsapp` |

---

## 5. App agent (vue utilisateur) vs flows

L’utilisateur configure une **app agent** (image + nom + flow) ; les automatisations tournent derrière.

### Modes d’interaction

| Mode | Menu | Critère |
|------|------|---------|
| **Automatique** | Automatiser → Agents automatiques | Aucune brique `interaction: human` |
| **Assisté** | Automatiser → Agents assistés | Au moins une brique HITL (ex. `human-doc-review`) |

- Champ `interactionMode` : `auto` (dérivé des briques) \| `automatic` \| `assisted` (surcharge).
- Champ `imageUrl` : avatar carte / futur catalogue Applications.
- HITL : run → statut `waiting_human` → page [`agent-human-review.php`](frontend/pages/agent-human-review.php) (WYSIWYG + Valider / Rejeter) → `POST /api/agent-flows/runs/:id/resume`.

### Pages de config par brique

Chaque brique peut déclarer `configUi: { type: "panel", tabId, tabLabel }` dans `flow-node.json`. En édition canvas : bouton « Ouvrir config » → onglet dédié (Intentions, Routage, Document…).

### Stockage actuel (`agent_flows`)

```json
{
  "entrepriseId": "…",
  "name": "Devis & orientation",
  "imageUrl": "https://…",
  "interactionMode": "auto",
  "derivedInteractionMode": "assisted",
  "trigger": { "brickId": "mail-in" },
  "steps": [ … ]
}
```

Pack « app » multi-canaux (intentions partagées, channels on/off) reste roadmap phase C ; aujourd’hui l’identité app vit sur le flow.

---

## 6. Exemple métier : devis automatique multi-canal

Un client contacte l’entreprise par **mail**, **formulaire** ou **WhatsApp**.

| Message | Intention | Action |
|---------|-----------|--------|
| « Je voudrais un devis pour … » | `demande_devis` | Créer le devis (GDERPI / UGAP…) |
| « Mon moteur ne démarre plus » | `question_technique` | Router vers le SAV |
| « Merci » | ignorer / ack | Pas d’action lourde |

« Créer le devis » = **brique métier** (module), pas le connecteur.

---

## 7. Briques aujourd’hui vs demain

### Aujourd’hui (préfaites plateforme)

| Brique | Rôle |
|--------|------|
| Triggers | `manual-trigger`, `cron-trigger`, `mail-in`, `facebook` — **multi-trigger** autorisé (`triggers[]` + canvas) |
| IA | `analyse-intention` = messages + liste + prompt → `intention_principale` (**pas** de destinataires) |
| Logique | `logic-if` (Oui/Non → `nextId` / `nextFalseId`) |
| Actions | `route-intention` (cibles typées), `human-doc-review`, `mail-out`, `data-backup`, `http-generic` |

**Séparation analyse / routage** (obligatoire) :

| Brique | Responsabilité |
|--------|----------------|
| `analyse-intention` | Classifier le message (`intention_principale`) |
| `route-intention` | Mapper l’intention → **cible** |

Types de cible `route-intention` :

| `target.type` | Effet |
|---------------|--------|
| `emails` | Destinataires mail + templates sujet/corps → souvent `mail-out` |
| `annuaire-service` | Résout les emails d’un service Annuaire |
| `flow-branch` | Saut vers un nœud canvas (`nextStepId`) — ex. « devis » → créer devis |
| `continue` | Suit le lien canvas de la brique Routage |
| `stop` | Fin du run après le routage |

La **liste d’intentions** est la source de vérité des points de routage : à chaque sauvegarde Intentions (ou chargement de preset), les règles sont resynchronisées (1 intention = 1 règle ; cibles déjà configurées conservées pour les noms qui restent).

**Facebook** : onglet éditeur (scénarios, webhook/poll, posts/comments, volume). Poll via `ConnectorScheduler` ; **push** via `/api/connectors/webhook/:instanceId` → même `dispatchFacebookToFlows`. Test manuel : dernier post (`fetchLatestPost`).

**HITL** : brique `human-doc-review` → pause + page documentaire.

Config Intentions / Routage / Facebook : onglets de l’éditeur (`agent_flow_brick_configs` + config nœud). Exécution graphe canvas (pas seulement steps linéaires).

### Suite logique — briques conçues par l’utilisateur

1. **Briques préfaites** (socle) — ce qu’on a maintenant.  
2. **Briques métier user** — format contrôlé (manifest + schéma config + code / script sandboxé ou low-code).  
   Ex. « Créer devis GDERPI », « Chercher contact Annuaire », « Notifier Slack ».  
3. **Assistant IA pour écrire la brique** — l’utilisateur décrit le besoin ; l’IA propose :
   - le `flow-node.json` (schéma, ports, label),
   - le squelette d’exécution (entrées/sorties, appels API modules),
   - des tests / exemples de contexte.  
   Un admin valide avant publication sur l’entité / la plateforme.

Principes :

- Une brique user a un **contrat** (inputs / outputs / permissions), comme les connecteurs.
- Elle ne gère **pas** les secrets de connexion (toujours via connecteurs / infra).
- Elle est versionnée et réutilisable dans plusieurs apps / flows.

---

## 8. Roadmap orchestrateur

| Phase | Contenu |
|-------|---------|
| **A (fait / en cours)** | Briques préfaites, templates Mail/FB, poll mail-in + facebook → flows, config par flow, legacy FB/Mail conservé |
| **B** | Multi-trigger + adapteur canal + normalisation message + contexte `options` |
| **C** | App agent (pack) : canaux on/off, config partagée, flows auto |
| **D** | Brique `call-flow` / sous-automatisation (si besoin hors multi-trigger) |
| **E** | Format briques métier user + assistant IA de conception |

---

## 9. Fichiers clés (code)

| Zone | Chemin |
|------|--------|
| Exécuteur | `backend/core/agent-flow/FlowExecutor.js` |
| Registre briques | `backend/core/agent-flow/FlowBrickRegistry.js` |
| Config briques / flow | `backend/core/agent-flow/AgentBrickConfigService.js` |
| Templates | `backend/core/agent-flow/flowTemplates.js` |
| API | `backend/routes/agent-flows.js` |
| UI éditeur | `frontend/pages/entity-agent-editor.php`, `frontend/assets/js/agent-flow/agent-canvas.js` |
| Poll → flow | `backend/core/connectors/ConnectorScheduler.js` |
| Briques | `modules/*/flow-node.json`, `connectors/*/flow-node.json`, `backend/core/agent-flow/bricks/` |

---

## 10. Migration legacy → connecteurs + agents

Pour pouvoir **supprimer rapidement le legacy** plus tard :

| Étape | Doc / outil |
|-------|-------------|
| Sync `mail_configs` → instances mail-in/out + seed Agent Mail | Script ci-dessous |
| Sync pages `facebook_configs` → instances facebook + seed Agent Facebook + reprise intentions | Idem |
| Cutover (couper WebhookService / dual-read) | Manuel, après validation |

- Guide : [`MIGRATION-LEGACY-TO-AGENTS.md`](MIGRATION-LEGACY-TO-AGENTS.md)  
- Script : `node backend/scripts/migrate-legacy-connectors-to-agents.js --dry-run`

Les collections legacy **ne sont pas droppées** par le script.

---

## 11. Liens

- Connecteurs (I/O) : [`CONNECTOR-SDK.md`](CONNECTOR-SDK.md)
- Charte CMS / modules / infra : [`CMS-CHARTE.md`](CMS-CHARTE.md)
- Analyse d’intention (module) : `modules/analyse-intention/`
