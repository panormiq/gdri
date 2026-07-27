# Migration legacy Mail / Facebook → connecteurs + agents

> Script : [`backend/scripts/migrate-legacy-connectors-to-agents.js`](backend/scripts/migrate-legacy-connectors-to-agents.js)  
> Architecture : [`AGENT-AUTOMATION.md`](AGENT-AUTOMATION.md)

## Stratégie (validée)

1. **Nouvelles données connecteurs** : collection `connector_instances` (mail-in/out, facebook) — **sans toucher** aux collections legacy.
2. **Recréer le flux Facebook** en parallèle : analyse → routage **sans envoi** pour l’instant.
3. **Tester uniquement sur ton compte** (`--entityId=...`).
4. **Garder le legacy** tant que le pilote n’est pas validé, puis le supprimer.

```
Legacy FB (WebhookService)  ──► continue d'envoyer / alerter
         │
         │  (en parallèle)
         ▼
connector_instances + Agent Facebook (pilot)
         └── analyse + routage seulement (pas de mail-out)
```

## Sources → cibles

| Source (legacy, inchangée) | Cible (nouvelle) |
|----------------------------|------------------|
| `mail_configs` | `connector_instances` mail-in / mail-out |
| `facebook_configs` | `connector_instances` facebook (`pageId`, `legacyConfigRef`) — tokens restent en legacy |
| `analyse_intention_configs` | `agent_flow_brick_configs` (intentions + routage) |
| — | `agent_flows` (`agent-mail`, `agent-facebook` sans envoi) |

## Utilisation (compte pilote)

```bash
cd backend

# Lister les entités + ids
node scripts/migrate-legacy-connectors-to-agents.js --list-entities

# Dry-run sur TON compte
node scripts/migrate-legacy-connectors-to-agents.js --dry-run --entityId=<TON_ID>

# Facebook seulement (recommandé pour le pilote)
node scripts/migrate-legacy-connectors-to-agents.js --entityId=<TON_ID> --facebook-only --force-flows

# Mail aussi (si besoin)
node scripts/migrate-legacy-connectors-to-agents.js --entityId=<TON_ID> --mail-only
```

Sécurité : **apply sans `--entityId` est refusé** (éviter de migrer toute la prod d’un coup).

## Après migration (ton compte)

1. **Connecteurs** : instance(s) Facebook visibles  
2. **Agents IA** : « Agent Facebook (pilot) » — Intentions / Routage préremplis, **pas** de brique envoi  
3. Lancer manuellement le flow avec un message test → vérifier analyse + destinataires routés  
4. Legacy FB : **toujours actif** (envois inchangés)

## Cutover (plus tard)

1. Ajouter mail-out (ou reply) sur le flow pilot validé  
2. Brancher webhook → connecteur / agent  
3. Feature-flag legacy off sur ton compte, puis les autres  
4. Archiver `facebook_configs` / chemins WebhookService quand 100 % OK

## Ce que le script ne fait pas

- Ne coupe pas le legacy  
- Ne déplace pas les tokens hors de `facebook_configs`  
- N’ajoute pas l’envoi sur Agent Facebook (volontaire)
