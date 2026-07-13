# GDERPI — guide design UI

> **Lire ce fichier avant d’ajouter un formulaire, une modale ou un tableau.**  
> Objectif : réutiliser les mêmes blocs CSS/HTML que le reste du module, sans styles ad hoc.

Fichier CSS unique : `modules/gderpi/frontend/assets/css/gderpi.css`  
Page de référence : `frontend/pages/modules/gderpi.php`

---

## Principes

1. **Une seule grammaire visuelle** — bordures `#e2e8f0`, fond cartes `#fff`, fond secondaire `#f8fafc`, texte `#0f172a` / `#475569`.
2. **Formulaires = `.gderpi-form`** — jamais de champs nus hors de cette classe (panneau LC, modale, carte).
3. **Champ = `.gderpi-field`** — label `.gderpi-field__label` + contrôle `.form-control` (Bootstrap GDRI).
4. **Modales = `.gderpi-modal`** + `GderpiModal.enhance()` — pas de `alert()` ni de popups custom.
5. **Listes éditables = vue LC** (`data-gderpi-vue-lc`) ou **sous-liste** (tableau + modale).

---

## Palette

| Usage | Couleur |
|-------|---------|
| Texte principal | `#0f172a` |
| Texte secondaire / hints | `#64748b` |
| Labels | `#475569` |
| Bordures | `#e2e8f0`, inputs `#cbd5e1` |
| Focus input | bordure `#3b82f6`, halo `rgba(59,130,246,.12)` |
| Fond page / nav | `#f8fafc` |
| Cartes / modales | `#fff` |
| Accent principal (étoile contact) | `#d97706` |
| Danger | `#dc3545` |

---

## Formulaires

### Structure HTML type

```html
<form class="gderpi-form" id="mon-formulaire">
  <div class="gderpi-form-section-title">Section</div>
  <div class="gderpi-form-grid">
    <div class="gderpi-field">
      <label class="gderpi-field__label" for="champ-id">Libellé</label>
      <input id="champ-id" class="form-control" type="text">
    </div>
    <div class="gderpi-field gderpi-field--full">
      <label class="gderpi-field__label" for="champ-long">Champ pleine largeur</label>
      <textarea id="champ-long" class="form-control" rows="2"></textarea>
    </div>
    <div class="gderpi-field gderpi-field--check gderpi-field--full">
      <label class="gderpi-field__check" for="champ-check">
        <input id="champ-check" type="checkbox"> Option
      </label>
    </div>
  </div>
  <p class="gderpi-field-hint">Texte d’aide optionnel.</p>
  <div class="gderpi-form-actions">
    <button type="submit" class="btn btn-primary btn-sm">Enregistrer</button>
    <button type="button" class="btn btn-outline btn-sm">Annuler</button>
  </div>
</form>
```

### Classes utiles

| Classe | Rôle |
|--------|------|
| `.gderpi-form` | Conteneur formulaire — **active le style des inputs** |
| `.gderpi-form-grid` | Grille 3 colonnes (2 en &lt; 1100px, 1 en &lt; 560px) |
| `.gderpi-field` | Colonne de champ (label au-dessus) |
| `.gderpi-field--full` | Champ sur toute la largeur de la grille |
| `.gderpi-field--check` | Case à cocher alignée en bas de ligne |
| `.gderpi-field--entreprise` / `--particulier` | Affichage conditionnel type client |
| `.gderpi-form-section-title` | Titre de section (petites capitales, bordure basse) |
| `.gderpi-form-actions` | Barre boutons (bordure haute) |
| `.gderpi-field-hint` | Aide grise sous un bloc |
| `.gderpi-required` | Astérisque rouge dans un label |

### À ne pas faire

- `<label>Texte <input></label>` sans `.gderpi-field` (legacy — éviter sur le nouveau code).
- Styles inline sur les inputs (`style="width:200px"`).
- `form-control` **sans** ancêtre `.gderpi-form` dans une modale ou un panneau LC.

---

## Modales

### Structure HTML

```html
<div id="mon-modal" class="gderpi-modal gderpi-modal--md" hidden>
  <div class="gderpi-modal__backdrop" data-gderpi-modal-backdrop></div>
  <div class="gderpi-modal__dialog" data-gderpi-modal-dialog>
    <div class="gderpi-modal__header">
      <strong class="gderpi-modal__title" data-gderpi-modal-title>Titre</strong>
      <button type="button" class="btn btn-outline btn-sm gderpi-modal__close" data-gderpi-modal-close>Fermer</button>
    </div>
    <div class="gderpi-modal__body" data-gderpi-modal-body>
      <form class="gderpi-form">…</form>
    </div>
  </div>
</div>
```

### Tailles (`gderpi-modal--*`)

| Classe | Largeur | Usage |
|--------|---------|--------|
| *(défaut)* | 920px | Formulaires moyens |
| `gderpi-modal--md` | 680px | Contact, adresse, petits formulaires |
| `gderpi-modal--lg` | 960px | — |
| `gderpi-modal--xl` | 1280px | Éditeur devis |
| `gderpi-modal--iframe` | 1000px | Aperçu HTML/PDF |

### JavaScript

```javascript
const modal = window.GderpiModal.enhance(document.getElementById('mon-modal'), {
  title: 'Titre par défaut',
  size: 'md',           // md | lg | xl
  closeOnBackdrop: true // false pour confirmation avant fermeture
});
modal.open();
modal.close();
```

Dans une modale, la grille est **2 colonnes** automatiquement (`.gderpi-modal .gderpi-form-grid`).

---

## Vue LC (liste + création)

Pattern standard pour clients, fournisseurs, articles, etc.

```html
<div class="gderpi-vue-lc" data-gderpi-vue-lc="clients">
  <div class="gderpi-vue-lc__header">… + bouton data-gderpi-lc-create …</div>
  <div class="gderpi-vue-lc__create-panel" data-gderpi-lc-create-panel="clients" hidden>
    <form class="gderpi-form">…</form>
  </div>
  <div class="gderpi-vue-lc__list-header">Liste</div>
  <div class="gderpi-vue-lc__toolbar">… recherche …</div>
  <div class="gderpi-vue-lc__table-wrap">
    <table class="gderpi-vue-lc__table">
      <thead>…</thead>
      <tbody data-gderpi-lc-tbody="clients"></tbody>
    </table>
  </div>
</div>
```

JS : `GderpiVueLc.bindVueLc({ key, root, loadRows, renderRows, … })`.

- Double-clic ligne → édition.
- Bouton **+ Nouveau** → panneau création (souvent promu en modale XL via `bindVueLc`).

---

## Sous-listes (contacts, adresses…)

Pour des collections imbriquées dans un formulaire parent :

```html
<div class="gderpi-client-sublist">
  <div class="gderpi-client-sublist__header">
    <div class="gderpi-form-section-title" style="margin:0;border:0;padding:0;">Contacts</div>
    <button type="button" class="btn btn-outline btn-sm">+ Contact</button>
  </div>
  <div class="gderpi-vue-lc__table-wrap gderpi-client-sublist__table-wrap">
    <table class="gderpi-vue-lc__table gderpi-client-sublist__table">…</table>
  </div>
  <p class="gderpi-field-hint">Double-clic pour modifier.</p>
</div>
```

- État géré en JS (tableau en mémoire), pas de formulaire inline par ligne.
- Création / édition → **modale `gderpi-modal--md`** dédiée.
- Contact principal : ★ / ☆ (`.gderpi-client-sublist__star`).

### Types d’adresse client

| Type | Rôle |
|------|------|
| `generique` | Adresse par défaut — utilisée si aucune adresse du type demandé n’existe |
| `facturation` | Facturation / devis |
| `livraison` | Livraison dédiée |
| `siege` | Siège social |
| `autre` | Autre usage |

Résolution côté API (`normalizeClient.js`) : type demandé → `generique` → première adresse renseignée.

### Devis — client & contacts

1. **Recherche client** : entreprises uniquement (`GET /clients?lite=1`). La recherche peut matcher un nom de contact, mais le résultat est toujours l’entreprise.
2. **Sélection** : `GET /clients/:id` charge la fiche complète (contacts, adresses) à la demande.
3. **Liste contacts** : `<select>` avec `<optgroup>` par **fonction** (service). Contact principal marqué ★.

---

## Tableaux devis (en-tête compact)

Pour les champs d’en-tête alignés sur les lignes de devis :

- Carte : `.gderpi-panel-card.gderpi-devis-meta-card`
- Table : `.gderpi-devis-meta-table`
- Champs compacts : hauteur 30px, padding réduit
- Détail objet/notes : `.gderpi-devis-meta-detail` + `.gderpi-devis-meta-fields__item`

Référence : section devis dans `gderpi.php` + styles § « Devis : en-tête » dans `gderpi.css`.

---

## Boutons

| Contexte | Classes |
|----------|---------|
| Action principale | `btn btn-primary btn-sm` |
| Secondaire / annuler | `btn btn-outline btn-sm` |
| Suppression ligne | `btn btn-outline-danger btn-sm` |
| Ajout compact (+) | `btn btn-outline btn-sm` ou bouton carré devis |
| Lien discret (étoile) | `btn btn-link btn-sm` |

Taille par défaut dans GDERPI : **`btn-sm`**.

---

## Cartes & layout

| Classe | Usage |
|--------|--------|
| `.gderpi-panel-card` | Bloc blanc bordé (dashboard, devis, config) |
| `.gderpi-vue-lc` | Conteneur liste + création |
| `.gderpi-kpi` | Tuile indicateur dashboard |

---

## Checklist avant merge UI

- [ ] Formulaire enveloppé dans `.gderpi-form`
- [ ] Chaque input dans `.gderpi-field` + `gderpi-field__label`
- [ ] Modale avec classes `gderpi-modal` + taille + `GderpiModal.enhance`
- [ ] Pas de CSS inline ni de nouvelle classe sans ajout dans `gderpi.css`
- [ ] Boutons `btn-sm` cohérents
- [ ] Hints via `.gderpi-field-hint`
- [ ] Responsive : tester &lt; 560px (grille 1 colonne)

---

## Fichiers de référence

| Fichier | Contenu |
|---------|---------|
| `frontend/assets/css/gderpi.css` | Tous les styles |
| `frontend/pages/modules/gderpi.php` | Markup de référence |
| `frontend/assets/js/shared/bindGderpiModal.js` | API modales |
| `frontend/assets/js/shared/bindVueLc.js` | API liste + création |
| `docs/CONVENTIONS.md` | Conventions code backend |
| `docs/PLAN.md` | Plan fonctionnel |
