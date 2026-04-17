# Repérage des blocs logiques — builder.js

Ce document résume les blocs logiques de `tutorials/builder.js` afin d’aider au découpage en modules.
Ordre = ordre d’apparition dans le fichier.

## 1) Références DOM + état global
- `const ...getElementById(...)`, `querySelectorAll(...)`
- tableaux/états globaux (`shapes`, `connections`, `groups`, etc.)
- états de drag/resize/selection
- constantes (`labelPadding`, `snapThreshold`, etc.)
- création des guides de snap (`snapGuideX`, `snapGuideY`)

## 2) Snap & guides d’alignement
- `getSnapPoints`
- `collectSnapTargets`
- `snapValue`
- `pickSnap`
- `updateSnapGuides`
- `clearSnapGuides`
- `snapMovePosition`
- `snapResize`

## 3) Outils géométrie (connexions)
- `ensureOrthogonal`
- `getSegmentMidpoints`

## 4) Utilitaires généraux + UI props
- `showProperties`
- `generateId`
- `slugify`
- `createTutorialTemplate`

## 5) Blocks (bibliothèque)
- `normalizeBlockIndex`
- `normalizeBlockEntry`
- `loadBlocks`
- `createWorkflowShapeFromBlock`

## 6) Normalisation tutoriel
- `ensureShapeTutorial`
- `needsTutorialNormalization`
- `normalizeTutorialSteps`

## 7) Mode & sélection tutoriel
- `setActiveMode`
- `refreshTutorialShapeOptions`
- `getActiveTutorialShape`

## 8) Outils d’édition texte
- `applyInlineStyle`
- `normalizeTextStepHtml`
- `applyTextareaWrap`

## 9) Crop image
- `openCropModal`
- `closeCropModal`
- `drawCropSelection`
- `colorWithAlpha`

## 10) Éditeur tutoriel (gros bloc)
- `renderTutorialEditor` + helpers de rendu d’étapes/items
- overlays: création, sélection, drag, resize
- gestion images (upload/drag/drop)
- preview tutorial

## 11) Shapes (workflow)
- `createShape`
- `renderShapes`
- `renderAnchors`
- `handleAnchorSelection`

## 12) Sélection & propriétés
- `selectConnection`
- `selectShape`
- `clearSelection`
- `updateSelectedShape`

## 13) Rendu des connexions (SVG)
- `updateConnections` (paths, labels, handles, styles)

## 14) Routing & géométrie des connexions
- `getAnchorPoint`
- `rotatePoint`
- `getAnchorPointFromAnchor`
- `getExitVector`
- `buildFixedPoints`
- `normalizeConnectionPoints`
- `buildPathWithPoints`
- `materializeConnectionPoints`
- `insertSplitPoint`
- `getConnectionSnapTargets`
- `snapAxisValue`
- `mergeClosePoints`
- `simplifyAlignedPoints`

## 15) Helpers d’interaction
- `getAnchorUnderPointer`
- `getPathMidPoint`
- `addConnection`

## 16) Groupes & import/export
- `applyGroupFilter`
- `exportJson`
- `importJson`
- `refreshGroupOptions`

## 17) Event wiring (UI)
- listeners pour boutons de formes, tabs de mode, inputs tutoriel
- drag canvas, interactions connexions, drag/resize, props, delete, keydown
- export/import, groupes, resize window, crop modal, paste image

## 18) Logos
- upload SVG (listener)
- `renderLogoList` (liste + insertion)
