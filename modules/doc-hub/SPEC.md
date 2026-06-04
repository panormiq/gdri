# Doc-Hub — spécification

GED par **projet** (immo, machine spé, investissement…). Partage sécurisé vers acheteurs / investisseurs (pas vendeur mandant). Pas de CNI ni RIB.

## Technique

| Élément | Valeur |
|---------|--------|
| Dossier | `modules/doc-hub/` |
| API | `/api/doc-hub` |
| Collections | `doc_hub_projects`, `doc_hub_slot_templates`, `doc_hub_documents`, `doc_hub_diffusions`, `doc_hub_download_links` |
| Dépendances | `doc-template` (champs variables), `mail` (SMTP) |

## Collections Mongo (base entreprise)

### `doc_hub_slot_templates`

Types de pièces configurables par entité (photos, DPE, plans…).

- `code`, `label`, `multiple`, `required`, `sortOrder`
- `metadataCollectionId` — optionnel, collection doc-template pour champs variables (ex. lettre DPE)
- `allowedMimeTypes[]`

### `doc_hub_projects`

- `title`, `reference`, `status` (`draft` | `active` | `closed`)
- `metadataCollectionId`, `metadata` (valeurs champs variables)
- `createdBy`, `createdAt`, `updatedAt`, `closedAt`

### `doc_hub_documents`

- `projectId`, `slotCode`, `filename`, `storagePath`, `mimeType`, `size`
- `metadata` (EXIF + champs slot), `tags[]`
- `uploadedBy`, `uploadedAt`

### `doc_hub_diffusions`

- `projectId`, `recipientEmail`, `subject`, `message`
- `documentIds[]`, `selectionMode`, `tags[]`
- `linkExpiresAt`, `maxDownloadsPerLink` (null = illimité jusqu’à expiration)
- `sentAt`, `status`, `createdBy`

### `doc_hub_download_links`

- `tokenHash`, `diffusionId`, `documentId`
- `expiresAt`, `maxDownloads`, `downloadCount`, `revokedAt`

## Routes MVP

| Méthode | Route | Auth |
|---------|-------|------|
| GET | `/health` | JWT |
| GET/POST | `/projects` | JWT |
| GET/PUT/DELETE | `/projects/:id` | JWT |
| GET/POST | `/slot-templates` | JWT |
| GET | `/projects/:id/documents` | JWT |
| POST | `/projects/:id/documents` | JWT (multipart) |
| PATCH | `/documents/:id/tags` | JWT |
| POST | `/projects/:id/diffusions` | JWT |
| GET | `/public/download/:token` | Public |

## Règles métier

- Photos : bien uniquement (charte agent).
- Diffusion : un **lien par document** dans le mail (pas de ZIP).
- SMTP : compte agent via module mail si configuré, sinon `gdri_app`.
- Liens : expiration par défaut 7 jours (configurable à l’envoi).

## Phases suivantes

- UI mobile affinée, intégration `FieldRenderer` doc-template
- Export sans EXIF pour partage externe
- Purge automatique projets clôturés
