# UGAP — Règles de liaisons entre options

> **Statut** : validé métier 2026-07-11 — référence onglet Paramétrage → Liaisons.

## 1. Quatre types de liaison

| Type | Code | Règle | Exemple |
|------|------|-------|---------|
| **Incompatibilité** | `incompatibility` | A et B ne peuvent **pas** coexister sur le devis | IBP ↔ MINO/MAJO source ; 2 moteurs |
| **Ajout automatique** | `auto_add` | Si A est sélectionnée → **ajouter** B | Remplacement moteur → MINO « non fourniture » |
| **Prérequis accessoire** | `requires` | B **nécessite** A (sinon conflit / modal) | Portative M85E ↔ VHF fixe M85E |
| **Variante recommandée** | `variant_fit` | B est la variante recommandée pour A | T-top C800 ↔ console C800 |

## 2. MINO / MAJO / IBP

### Incompatibilité IBP ↔ delta

L’option de base (IBP) et la ligne MINO/MAJO qui lui correspond **ne coexistent jamais** :
- config de base → IBP incluse, pas de MINO/MAJO source ;
- suppression / remplacement → IBP absente, MINO ou MAJO présente.

### Ajout / suppression (axe présence)

| Action | Prix | Ligne |
|--------|------|-------|
| Ajouter | + | Option / MAJO |
| Supprimer | − | MINO / moins-value |

### Remplacement (axe delta)

| Action | Prix | Ligne |
|--------|------|-------|
| Remplacement plus cher | + | MAJO |
| Remplacement moins cher | − | MINO (hors moteur de base) |

### Cas spécial moteur

Remplacement IBP moteur → **auto_add** MINO « non fourniture moteur de base » (incompatible avec IBP, compatible avec le nouveau moteur).

## 3. UX configurateur (prérequis & variantes)

- **Ne pas masquer** les options : tout reste visible.
- **Code couleur** : recommandée / neutre / incompatible / non applicable.
- **Clic sur incompatible** → modal avec équipements compatibles ou changement du parent.
- **Variante recommandée** (T-top) : tri + badge « adapté », pas de blocage dur si mauvais modèle (modal).

## 4. Stockage Mongo (`ugap_data`)

| Champ | Contenu |
|-------|---------|
| `optionLinkRules[]` | Règles `incompatibility`, `requires`, `variant_fit` (manuel + heuristique) |
| `dependencyRules[]` | Règles `auto_add` (`triggerOptionId` → `autoSelectOptionIds`) |
| `importBaseProducts[]` | Source IBP ↔ MINO (adj-links) — alimente incompatibilités système |

## 5. Heuristiques libellé Excel (proposition, validation manuelle)

| Motif | Type probable |
|-------|---------------|
| `reliée à la VHF…` | `requires` |
| `pour VHF IC-M85E` | `requires` |
| `T-top … console C800` | `variant_fit` |
| `pour console alu A800` | `variant_fit` |
