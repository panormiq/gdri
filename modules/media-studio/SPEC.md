# Studio Média — spécification v1

Module de création visuelle **multi-calques** : plan IA → génération par calque → édition scène → export.  
Les modèles ne produisent pas nativement un projet éditable ; l’application **orchestre** calques, texte SVG et composition.

## Problème ciblé

| Approche actuelle (ChatGPT, Flux seul) | Approche Studio Média |
|----------------------------------------|------------------------|
| Image plate PNG | Projet avec calques indépendants |
| « Regénère tout » pour déplacer un élément | Déplacement / redimensionnement sans IA |
| Texte centré approximatif | Texte en SVG (alignement mathématique) |
| Lent à chaque itération | Édition calques sans regénérer ; Flux uniquement en v1 |

## Technique

| Élément | Valeur |
|---------|--------|
| Dossier | `modules/media-studio/` |
| API | `/api/media-studio` |
| Chat IA | `/api/chat` (Ollama via module `ia`) |
| Génération images | ComfyUI local (API `/prompt`, `/history`, `/view`) |
| Collections | `media_studio_projects`, `media_studio_generations` |
| Fichiers | `backend/uploads/media-studio/` |
| Dépendances | `ia` (LLM), ComfyUI Desktop + ComfyUI-GGUF |

## Matériel cible (référence)

| Ressource | Valeur |
|-----------|--------|
| GPU | Quadro RTX 4000 — 8 Go VRAM |
| Mode ComfyUI | `--lowvram` |
| Règle | **Ne pas** lancer LLM Ollama et ComfyUI en parallèle sur le même GPU |

---

## Pipeline v1

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌────────────┐
│ 1. Réflexion │ → │ 2. Manifest │ → │ 3. Génération   │ → │ 4. Éditeur │
│ LLM (Ollama) │    │ JSON scène   │    │ par calque      │    │ scène      │
└─────────────┘    └──────────────┘    └─────────────────┘    └────────────┘
                                              │                      │
                                              ▼                      ▼
                                        ComfyUI Flux           Éditeur SVG
                                        + texte SVG              (déplacer,
                                                                   redimensionner)
                                                                   │
                                                                   ▼
                                                            ┌────────────┐
                                                            │ 5. Export  │
                                                            │ PNG / SVG  │
                                                            └────────────┘
```

### Rôles des modèles

| Rôle | Moteur | Modèle | Usage |
|------|--------|--------|-------|
| Planification scène | Ollama | `deepseek-r1:7b` ou `mistral` | JSON manifest (calques, bbox, prompts) |
| Code / orchestration | Ollama | `qwen2.5-coder:7b` | Aide dev, pas en prod utilisateur v1 |
| Vision (option v1.5) | Ollama | `llava:7b` | QA visuelle, suggestions après génération |
| Brouillon image (option ultérieure) | ComfyUI | **SDXL Turbo** | Itérations rapides — non utilisé en v1 UI |
| Image | ComfyUI | **Flux Schnell Q4 GGUF** | Tous les calques image en v1 |
| Texte | Application | SVG natif | Jamais généré par diffusion |

---

### Workflow multi-calques (3 étapes — implémenté)

```
Étape 1 — Brouillon (LLM raisonnement)
  → découpe calques : title, description, role, bbox
  → affichage placeholders orange avec titres (pas de Flux)

Étape 2 — Prompts Flux (LLM)
  → JSON fluxPrompts : prompt anglais précis par calque image
  → badge « prompt » sur chaque calque

Étape 3 — Génération (ComfyUI Flux)
  → role object : fond vert + détourage chroma
  → role background : image pleine zone
  → badge « généré »
```

Le texte est rendu en SVG dès l'étape 1 (instantané). L'utilisateur déplace les calques entre chaque étape.

---

**Flux / ComfyUI ne produisent pas de canal alpha.** Le `VAEDecode` standard sort du RGB opaque : un prompt « fond transparent » est ignoré par le modèle.

### Stratégie v1 (implémentée)

| Type de calque | Génération | Post-traitement |
|----------------|------------|-----------------|
| Objet superposable (drapeau, logo…) | Prompt objet isolé + fond vert chroma `#00B140` | `ChromaKeyService` retire le vert → PNG RGBA |
| Fond / décor plein écran | Prompt scène classique | Aucun détourage (`transparent: false`) |

API : `POST /generate` avec `{ "transparent": true }` ou `{ "layer": true }`.

Fichiers : `ChromaKeyService.js`, `LayerPromptHelper.js`, dépendance `pngjs`.

### Améliorations ultérieures

- `rembg` / BiRefNet (ComfyUI ou Python) pour contours plus propres
- Détourage IA optionnel si le vert laisse des franges

---

## Profils de génération

**v1 UI : Flux uniquement** (`model: flux`). Le profil SDXL Turbo reste disponible côté API pour une phase ultérieure.

### `quality` — Flux (actif v1)

| Paramètre | Valeur |
|-----------|--------|
| UNet | `flux1-schnell-Q4_K_S.gguf` |
| CLIP | `clip_l.safetensors` + `t5xxl_fp8_e4m3fn.safetensors` |
| VAE | `ae.safetensors` |
| Steps | 4 |
| CFG | 1 |
| Taille max recommandée | 768×768 |
| Workflow | `UnetLoaderGGUF` → `DualCLIPLoader` → `CLIPTextEncodeFlux` → `KSampler` → `VAEDecode` |

### Règles métier profils

- Par défaut : **tous les calques** en `draft` à la création du projet.
- L’utilisateur peut **promouvoir** un calque (ou tout le projet) en `quality`.
- Régénération d’un calque : conserve `seed` optionnel pour variantes.
- Texte : pas de profil — rendu SVG instantané.

Fichier config cible (`backend/config.json`) :

```json
{
  "comfyui": {
    "baseUrl": "http://127.0.0.1:8188",
    "profiles": {
      "draft": {
        "label": "Brouillon rapide",
        "checkpoint": "sdxl_turbo.safetensors",
        "steps": 1,
        "cfg": 1,
        "defaultWidth": 512,
        "defaultHeight": 512
      },
      "quality": {
        "label": "Qualité Flux",
        "unet": "flux1-schnell-Q4_K_S.gguf",
        "clipL": "clip_l.safetensors",
        "t5": "t5xxl_fp8_e4m3fn.safetensors",
        "vae": "ae.safetensors",
        "steps": 4,
        "cfg": 1,
        "defaultWidth": 768,
        "defaultHeight": 768
      }
    }
  }
}
```

---

## Format manifest — `SceneManifest` v1

Document JSON stocké dans `media_studio_projects.manifest`. Versionné pour migrations futures.

```json
{
  "version": 1,
  "title": "Bannière événement",
  "canvas": {
    "width": 1200,
    "height": 630,
    "background": "#ffffff"
  },
  "layers": [
    {
      "id": "bg-sky",
      "type": "image",
      "zIndex": 0,
      "bbox": { "x": 0, "y": 0, "width": 1200, "height": 630 },
      "prompt": "soft blue gradient sky, minimal, no objects",
      "negativePrompt": "text, watermark, logo",
      "profile": "draft",
      "asset": null,
      "generation": null,
      "visible": true,
      "locked": false
    },
    {
      "id": "flag-fr",
      "type": "image",
      "zIndex": 10,
      "bbox": { "x": 80, "y": 120, "width": 200, "height": 133 },
      "prompt": "french flag waving, isolated on transparent background",
      "profile": "quality",
      "asset": { "filename": "img-xxx.png", "url": "/api/media-studio/media/img-xxx.png" },
      "generation": { "seed": 42, "profile": "quality", "promptId": "..." },
      "visible": true,
      "locked": false
    },
    {
      "id": "title-text",
      "type": "text",
      "zIndex": 20,
      "bbox": { "x": 320, "y": 200, "width": 560, "height": 80 },
      "content": "Journée portes ouvertes",
      "style": {
        "fontFamily": "Arial, sans-serif",
        "fontSize": 48,
        "fontWeight": "bold",
        "color": "#1a1a1a",
        "align": "center",
        "verticalAlign": "middle"
      },
      "visible": true,
      "locked": false
    }
  ],
  "meta": {
    "createdBy": "userId",
    "llmModel": "deepseek-r1:7b",
    "sourcePrompt": "Bannière avec drapeau français et titre centré"
  }
}
```

### Types de calque

| `type` | Rendu | Génération IA |
|--------|-------|---------------|
| `image` | PNG (fond transparent si possible) | ComfyUI (`draft` ou `quality`) |
| `text` | SVG / Fabric Text | Non — contenu et style explicites |
| `shape` (v1.5) | Rectangle, ligne | Non |

### Champs `generation` (calque image)

```json
{
  "seed": 123456789,
  "profile": "draft",
  "promptId": "comfy-prompt-uuid",
  "width": 512,
  "height": 512,
  "generatedAt": "2026-06-25T12:00:00.000Z"
}
```

### Schéma LLM attendu (sortie planification)

Le LLM doit répondre **uniquement** en JSON valide (pas de markdown) :

```json
{
  "title": "string",
  "canvas": { "width": 1200, "height": 630, "background": "#ffffff" },
  "layers": [
    {
      "id": "kebab-case-unique",
      "type": "image|text",
      "zIndex": 0,
      "bbox": { "x": 0, "y": 0, "width": 100, "height": 100 },
      "prompt": "pour image seulement",
      "content": "pour text seulement",
      "style": { "align": "center", "fontSize": 32 }
    }
  ]
}
```

Prompt système (résumé) : décomposer la demande utilisateur en calques superposables ; texte toujours en calque `text` séparé ; bbox en pixels relatifs au canvas ; prompts image courts et sans texte incrusté.

---

## Collections Mongo (base entreprise)

### `media_studio_projects` (nouveau v1)

| Champ | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `entity_id` | string | Entreprise |
| `user_id` | string | Créateur |
| `title` | string | |
| `manifest` | object | `SceneManifest` v1 |
| `status` | string | `draft` \| `ready` \| `archived` |
| `thumbnail` | string | URL preview composite |
| `created_at` | Date | |
| `updated_at` | Date | |

### `media_studio_generations` (existant — MVP chat)

Historique des images générées hors projet ou liées à un calque.

| Champ | Type | Description |
|-------|------|-------------|
| `entity_id`, `user_id` | string | |
| `project_id` | string? | Optionnel — lien projet |
| `layer_id` | string? | Optionnel — lien calque |
| `prompt` | string | |
| `profile` | string | `draft` \| `quality` |
| `url`, `filename` | string | |
| `seed`, `prompt_id` | number / string | |
| `width`, `height` | number | |
| `comfy_meta` | object | Métadonnées ComfyUI |
| `created_at` | Date | |

---

## Routes API

### Implémentées (MVP actuel)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/health` | JWT | ComfyUI + modèles configurés |
| POST | `/generate` | JWT | Image plate (Flux seul, prompt libre) |
| GET | `/generations` | JWT | Historique utilisateur |
| GET | `/media/:filename` | JWT | Servir PNG |
| GET | `/download/:filename` | JWT | Téléchargement |

### À implémenter (v1 scène)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/profiles` | JWT | Liste profils `draft` / `quality` + dispo modèles |
| POST | `/projects` | JWT | Créer projet (manifest vide ou fourni) |
| GET | `/projects` | JWT | Liste projets entité |
| GET | `/projects/:id` | JWT | Détail + manifest |
| PUT | `/projects/:id` | JWT | Sauver manifest (éditeur) |
| DELETE | `/projects/:id` | JWT | Archiver / supprimer |
| POST | `/projects/:id/plan` | JWT | Body `{ prompt }` → LLM → manifest |
| POST | `/projects/:id/layers/:layerId/generate` | JWT | Body `{ profile?, seed? }` → ComfyUI → met à jour calque |
| POST | `/projects/:id/render` | JWT | Composite canvas → PNG thumbnail + export |
| POST | `/generate` | JWT | **Étendre** : `{ prompt, profile, width, height }` |

### Corps `POST /projects/:id/layers/:layerId/generate`

```json
{
  "profile": "draft",
  "seed": null,
  "promptOverride": null
}
```

Réponse :

```json
{
  "success": true,
  "data": {
    "layerId": "flag-fr",
    "asset": { "filename": "...", "url": "..." },
    "generation": { "seed": 42, "profile": "draft", "promptId": "..." }
  }
}
```

### Erreurs standard

| Code | `code` | Cas |
|------|--------|-----|
| 503 | `COMFYUI_UNAVAILABLE` | ComfyUI hors ligne |
| 503 | `OLLAMA_UNAVAILABLE` | LLM hors ligne (plan) |
| 400 | `INVALID_MANIFEST` | JSON scène invalide |
| 404 | `LAYER_NOT_FOUND` | Calque inexistant |
| 422 | `MODEL_NOT_FOUND` | Checkpoint / GGUF manquant |

---

## UI — écrans v1

### Onglet « Chat simple » (implémenté)

- Chat créatif (`/api/chat`)
- Bouton « Générer » → Flux uniquement, galerie latérale
- Statut ComfyUI global

### Onglet « Multi-calques » (implémenté — client)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Onglet Chat simple] [Onglet Multi-calques]                       │
├──────────────┬─────────────────────────────┬─────────────────────┤
│ Calques      │ Canvas SVG                  │ Propriétés          │
│ + Texte      │   [aperçu temps réel]       │ prompt / texte      │
│ [Nouveau]    │   glisser-déposer           │ bbox x,y,w,h        │
│ [Export SVG] │                             │ [Régénérer Flux]    │
├──────────────┴─────────────────────────────┴─────────────────────┤
│ [Calque actif : flag-fr ×]                                        │
│ « rends le drapeau plus vif »     [Planifier] [Envoyer]           │
└──────────────────────────────────────────────────────────────────┘
```

Fichiers : `frontend/index.html`, `studio-scene.js`, `studio-app.js`.

### Dialogue avec contexte calque

Quand un calque est sélectionné (liste ou canvas), une **puce « Calque actif »** apparaît au-dessus du champ de dialogue. Les messages envoyés incluent automatiquement :

```
[CALQUE ACTIF]
id: flag-fr
type: image
bbox: x=80, y=120, w=200, h=133
prompt: drapeau français ondulant
[/CALQUE ACTIF]

Demande utilisateur: rends les couleurs plus vives
```

Le LLM peut répondre en langage naturel ou avec un **patch JSON** :

```json
{ "layerPatch": { "id": "flag-fr", "prompt": "drapeau français vif, couleurs saturées" } }
```

Bouton **Planifier** : demande un `SceneManifest` JSON complet, puis génère les calques image manquants en Flux.

Persistance v1 : `localStorage` (`gdri-media-studio-scene`). Migration Mongo prévue phase 2.

### Interactions éditeur

| Action | Comportement |
|--------|--------------|
| Glisser calque | Met à jour `bbox` (pas de regénération) |
| Propriétés panneau | Édition prompt, texte, bbox |
| Régénérer calque | `/api/media-studio/generate` (Flux, taille bbox) |
| Planifier | LLM → manifest JSON → génération auto calques image |
| Envoyer (calque actif) | LLM + contexte calque → patch ou réponse |
| Export SVG | Téléchargement client (`studio-scene.js`) |
| Détacher calque (×) | Dialogue libre, sans contexte calque |

Moteur rendu : **SVG natif** (pas Fabric.js en v1).

---

## Services backend (structure cible)

```
backend/services/
  ComfyUIService.js      # draft + quality workflows, auto-port
  ScenePlannerService.js # appel Ollama, validation manifest
  SceneRenderService.js  # composite PNG (sharp)
  ProjectService.js      # CRUD Mongo
```

### ComfyUI — génération par bbox

Pour un calque image, la taille envoyée à ComfyUI = `bbox.width` × `bbox.height` (arrondi pair, max selon profil). Le canvas final compose à la résolution `canvas.width` × `canvas.height`.

### File d’attente

v1 : génération **séquentielle** (un calque à la fois).  
v1.5 : file simple avec statut `pending` / `running` / `done` par calque.

---

## Modèles ComfyUI — chemins

Racine partagée ComfyUI Desktop :

`C:\Users\<user>\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\`

| Fichier | Dossier | Profil |
|---------|---------|--------|
| `sdxl_turbo.safetensors` | `checkpoints/` | draft |
| `flux1-schnell-Q4_K_S.gguf` | `unet/` | quality |
| `clip_l.safetensors` | `clip/` | quality |
| `t5xxl_fp8_e4m3fn.safetensors` | `clip/` | quality |
| `ae.safetensors` | `vae/` | quality |

---

## Règles métier

1. **Texte** : toujours calque `text` SVG — ne pas demander au modèle image de dessiner du texte.
2. **Transparence** : prompts image incluent « isolated on transparent background » pour calques superposables (post-traitement détourage optionnel v1.5).
3. **VRAM** : une génération à la fois ; libérer modèle ComfyUI entre sessions lourdes si besoin (redémarrage manuel).
4. **Auth** : toutes les routes JWT ; fichiers servis uniquement via API (pas d’accès direct Apache `/uploads`).
5. **Entité** : projets et générations scopés `entity_id` + `user_id`.

---

## Phases d’implémentation

| Phase | Contenu | Statut |
|-------|---------|--------|
| **0 — MVP** | Chat + génération Flux plate + galerie | ✅ Fait |
| **1 — UI multi-calques** | Onglets, éditeur SVG, dialogue + contexte calque, export SVG, localStorage | ✅ Fait |
| **2 — Projets** | CRUD `media_studio_projects`, manifest Mongo | À faire |
| **3 — Planificateur backend** | `ScenePlannerService` + `POST /plan` | À faire (LLM côté client pour l’instant) |
| **4 — Génération calque API** | `POST .../layers/:id/generate` | À faire (appel `/generate` direct pour l’instant) |
| **5 — Export PNG** | Composite `SceneRenderService` | À faire |
| **1.5 — SDXL brouillon** | Profil draft optionnel | Reporté |
| **2.0 — Vision / détourage** | llava, remove BG | Optionnel |

---

## Exemple parcours utilisateur

1. Utilisateur : *« Bannière 1200×630, drapeau français à gauche, titre centré »*
2. `POST /projects` → projet vide
3. `POST /projects/:id/plan` → LLM retourne manifest (3 calques)
4. UI affiche canvas avec bbox placeholder
5. `generate` sur chaque calque image en **draft** (~5–15 s total)
6. Utilisateur déplace le drapeau dans l’éditeur
7. Promote calque drapeau en **quality** → regénération Flux
8. Ajuste texte sans IA
9. `POST /projects/:id/render` → export PNG final

---

## Références code existant

| Fichier | Rôle |
|---------|------|
| `backend/services/ComfyUIService.js` | Workflow Flux, découverte port ComfyUI |
| `backend/routes.js` | Routes MVP |
| `backend/config.json` | Defaults Flux |
| `frontend/assets/js/studio-app.js` | UI chat + galerie |
| `frontend/pages/modules/media-studio.php` | Embed GDRI |
