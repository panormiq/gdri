# Onglet Liaisons — plan d'implémentation

> **Statut** : phase 1 (paramétrage) et phase 2 (configurateur) livrées.

## Phase 1 — Paramétrage (fait)

| Bloc | Fichiers | Statut |
|------|----------|--------|
| Doc métier | `REGLES-LIAISONS.md` | ✅ |
| Backend rules | `option-link-rules.js`, `PUT /liaisons/rules`, `POST /liaisons/suggest-heuristic` | ✅ |
| UI 3 sous-onglets | `liaisons-*-panel.js`, `section-liaisons.php` | ✅ |

## Phase 2 — Configurateur (fait)

| Bloc | Fichiers | Statut |
|------|----------|--------|
| Runtime liaisons | `ugap-option-link-runtime.js` | ✅ |
| Pont + modal conflit | `configurateur-link-bridge.js` | ✅ |
| Intégration app | `configurateur-app.js` (`loadData`, checkboxes, `render`) | ✅ |
| Scripts + CSS | `gdri-embed.php`, `index.php`, `configurateur.css` | ✅ |

Comportement :
- Évaluation `optionLinkRules` + `dependencyRules` à la sélection
- Code couleur : recommandée / neutre / incompatible / sélectionnée
- Modal conflit avec alternatives (VHF, T-top, IBP↔MINO)
- Nettoyage enfant si parent retiré ; auto-add via `dependencyRules`

## Test

- Paramétrage : `ugap.php?tab=parametrage&param_section=liaisons`
- Configurateur : sélectionner options avec liaisons (VHF, T-top, remplacement moteur / IBP)
