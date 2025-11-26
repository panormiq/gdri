<h2 class="section-title" style="font-family: 'Michroma'; font-size: 22.5pt; color: #ED1C24; font-weight: bold; text-transform: none; text-align: center; background-color: #F2F3F3; margin-top: 12pt; margin-bottom: 6pt; margin-left: -70.85pt; padding-left: 70.85pt; margin-right: -70.85pt; padding-right: 70.85pt">Sommaire</h2><?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Agent Documentaire — Éditeur';
$testDocumentId = 'default-test';
$documentId = isset($_GET['document']) ? trim($_GET['document']) : $testDocumentId;

$extra_styles = [url('assets/css/agent-documentaire.css')];
$extra_scripts = [url('assets/js/agent-documentaire.js')];

require_once '../../../includes/header.php';
?>

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <div>
                <h1>Éditeur de modèle documentaire</h1>
                <p class="hero-description">
                    JSON = source de vérité. Modifiez vos sections, contenu et images en temps réel.
                </p>
            </div>
            <div class="hero-actions">
                <a class="btn btn-outline" href="<?= url('pages/modules/document-agent/index.php'); ?>">⬅️ Retour</a>
                <button class="btn btn-outline view-tab is-active" data-view="text">📄 Vue texte</button>
                <button class="btn btn-outline view-tab" data-view="card">🃏 Vue card</button>
                <button class="btn btn-outline" id="editCanvasBtn" title="Éditer le canevas">⚙️ Éditer le canevas</button>
                <button class="btn btn-primary" id="saveDocumentBtn" title="Sauvegarder les modifications">💾 Sauvegarder</button>
                <button class="btn btn-primary" id="exportPdfBtn" title="Exporter en PDF">📄 Exporter PDF</button>
            </div>
        </div>
    </div>
</section>

<section class="doc-editor-wrapper">
    <div class="container">
        <div class="doc-editor" data-document-id="<?= htmlspecialchars($documentId); ?>">
            <!-- VUE TEXTE (3 colonnes) -->
            <div class="view-container view-text is-active">
                <!-- COLONNE 1 : Sommaire + Annexes -->
                <aside class="doc-panel doc-panel--toc">
                    <div class="doc-panel__body doc-panel__body--compact">
                        <!-- Sommaire -->
                        <div class="doc-panel__section">
                            <h3 class="doc-panel__section-title">Sommaire</h3>
                            <div class="sommaire-list" data-sommaire-list>
                                <p class="text-muted">Chargement...</p>
                            </div>
                        </div>
                        
                        <div class="doc-panel__separator"></div>
                        
                        <!-- Annexes -->
                        <div class="doc-panel__section">
                            <h3 class="doc-panel__section-title">Annexes</h3>
                            <div class="annexes-list" data-annexes-list>
                                <p class="text-muted">Aucune annexe</p>
                            </div>
                        </div>
                    </div>
                </aside>

                <!-- COLONNE 2 : Contenu complet -->
                <div class="doc-panel">
                    <div class="doc-panel__header">
                        <h3>Contenu</h3>
                    </div>
                    <div class="doc-panel__body">
                        <div class="content-area" data-content-area>
                            <p class="text-muted">Chargement...</p>
                        </div>
                    </div>
                </div>

                <!-- COLONNE 3 : Propriétés -->
                <aside class="doc-panel">
                    <div class="doc-panel__header">
                        <h3>Propriétés</h3>
                    </div>
                    <div class="doc-panel__body">
                        <div class="properties-area" data-properties-area>
                            <p class="text-muted">Sélectionnez une section</p>
                        </div>
                    </div>
                </aside>
            </div>
            <!-- Fin VUE TEXTE -->
            
            <!-- VUE CARD (2 colonnes) -->
            <div class="view-container view-card">
                <!-- COLONNE 1 : Cards -->
                <div class="doc-panel">
                    <div class="doc-panel__header">
                        <div>
                            <h3>Sections</h3>
                            <div class="cards-breadcrumb" data-cards-breadcrumb>
                                <span class="breadcrumb-item is-active">Niveau 1</span>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline" data-cards-back style="display: none;">⬅️ Retour</button>
                    </div>
                    <div class="doc-panel__body">
                        <div class="cards-grid" data-cards-grid>
                            <p class="text-muted">Chargement...</p>
                        </div>
                    </div>
                </div>

                <!-- COLONNE 2 : Propriétés -->
                <aside class="doc-panel">
                    <div class="doc-panel__header">
                        <h3>Propriétés</h3>
                    </div>
                    <div class="doc-panel__body">
                        <div class="properties-area" data-card-properties>
                            <p class="text-muted">Sélectionnez une section</p>
                        </div>
                    </div>
                </aside>
            </div>
            <!-- Fin VUE CARD -->
        </div>
    </div>
</section>

<!-- Modal Ajout/Édition de section -->
<div class="modal-overlay" id="sectionModal" style="display: none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3 id="modalTitle">Ajouter une section</h3>
            <button class="modal-close" id="modalClose">&times;</button>
        </div>
        <div class="modal-body">
            <form id="sectionForm">
                <input type="hidden" id="sectionId" name="sectionId">
                <input type="hidden" id="sectionLevel" name="level" value="1">
                <input type="hidden" id="sectionParent" name="parent" value="">
                <input type="hidden" id="sectionContext" name="sectionContext" value="sommaire">
                
                <div class="form-group">
                    <label for="sectionTitle">Titre</label>
                    <input type="text" id="sectionTitle" name="title" class="form-control" required autofocus>
                </div>
                
                <div id="sectionLevelInfo" class="section-level-info">
                    <!-- Info niveau/parent affichée dynamiquement -->
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="modalCancel">Annuler</button>
            <button type="button" class="btn btn-primary" id="modalSave">Enregistrer</button>
        </div>
    </div>
</div>

<!-- Modal Rogner Image -->
<div class="modal-overlay" id="imageCropModal" style="display: none;">
    <div class="modal-content modal-content--large">
        <div class="modal-header">
            <h3>Rogner l'image</h3>
            <button class="modal-close" id="imageCropModalClose">&times;</button>
        </div>
        <div class="modal-body">
            <div class="image-crop-container">
                <canvas id="imageCropCanvas"></canvas>
                <div class="image-crop-overlay" id="imageCropOverlay"></div>
            </div>
            <div class="image-crop-controls">
                <button type="button" class="btn btn-outline" id="imageCropReset">Réinitialiser</button>
                <div class="image-crop-info">
                    <span id="imageCropInfo">Sélectionnez une zone à rogner</span>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="imageCropDelete" style="display: none;">Supprimer le rognage</button>
            <div style="flex: 1;"></div>
            <button type="button" class="btn btn-outline" id="imageCropCancel">Annuler</button>
            <button type="button" class="btn btn-primary" id="imageCropSave">Valider</button>
        </div>
    </div>
</div>

<!-- Menu contextuel (clic droit) -->
<div class="context-menu" id="contextMenu" style="display: none;">
    <ul class="context-menu-list">
        <li class="context-menu-item" data-action="add-child">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Ajouter une sous-section</span>
        </li>
        <li class="context-menu-item" data-action="edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>Éditer</span>
        </li>
        <li class="context-menu-item context-menu-item--danger" data-action="delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Supprimer</span>
        </li>
    </ul>
</div>

<!-- Modal Configuration Canevas -->
<div class="modal-overlay" id="canvasModal" style="display: none;">
    <div class="modal-content modal-content--large">
        <div class="modal-header">
            <h3>⚙️ Configuration du canevas</h3>
            <button class="modal-close" id="canvasModalClose">&times;</button>
        </div>
        <div class="modal-body">
            <!-- Onglets -->
            <div class="canvas-tabs">
                <button class="canvas-tab is-active" data-tab="titles">📝 Titres</button>
                <button class="canvas-tab" data-tab="paragraphs">📄 Paragraphes</button>
                <button class="canvas-tab" data-tab="images">🖼️ Images</button>
                <button class="canvas-tab" data-tab="annexes">📎 Annexes</button>
                <button class="canvas-tab" data-tab="margins">📏 Marges</button>
            </div>

            <!-- Contenu des onglets -->
            <div class="canvas-tab-content">
                <!-- Onglet Titres -->
                <div class="canvas-tab-panel is-active" data-panel="titles">
                    <div class="canvas-presets">
                        <label>Preset rapide :</label>
                        <select id="canvasPresetSelect">
                            <option value="">Personnalisé</option>
                            <option value="standard">Standard</option>
                            <option value="compact">Compact</option>
                            <option value="large">Large</option>
                        </select>
                        <button class="btn btn-sm btn-outline" id="applyPresetBtn">Appliquer preset</button>
                    </div>
                    <div class="canvas-levels">
                        <div class="canvas-level" data-level="1">
                            <h4>Niveau 1</h4>
                            <div class="form-group">
                                <label>Police</label>
                                <input type="text" class="form-control" data-field="fontFamily" placeholder="Arial">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Taille (pt)</label>
                                    <input type="number" class="form-control" data-field="fontSize" min="8" max="72" step="0.5">
                                </div>
                                <div class="form-group">
                                    <label>Gras</label>
                                    <select class="form-control" data-field="fontWeight">
                                        <option value="normal">Normal</option>
                                        <option value="bold">Gras</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Couleur</label>
                                <input type="color" class="form-control" data-field="color">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Marge haut (pt)</label>
                                    <input type="number" class="form-control" data-field="marginTop" min="0" step="0.5">
                                </div>
                                <div class="form-group">
                                    <label>Marge bas (pt)</label>
                                    <input type="number" class="form-control" data-field="marginBottom" min="0" step="0.5">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Alignement</label>
                                <select class="form-control" data-field="alignment">
                                    <option value="left">Gauche</option>
                                    <option value="center">Centre</option>
                                    <option value="right">Droite</option>
                                    <option value="justify">Justifié</option>
                                </select>
                            </div>
                        </div>
                        <div class="canvas-level" data-level="2">
                            <h4>Niveau 2</h4>
                            <div class="form-group">
                                <label>Police</label>
                                <input type="text" class="form-control" data-field="fontFamily" placeholder="Arial">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Taille (pt)</label>
                                    <input type="number" class="form-control" data-field="fontSize" min="8" max="72" step="0.5">
                                </div>
                                <div class="form-group">
                                    <label>Gras</label>
                                    <select class="form-control" data-field="fontWeight">
                                        <option value="normal">Normal</option>
                                        <option value="bold">Gras</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Couleur</label>
                                <input type="color" class="form-control" data-field="color">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Marge haut (pt)</label>
                                    <input type="number" class="form-control" data-field="marginTop" min="0" step="0.5">
                                </div>
                                <div class="form-group">
                                    <label>Marge bas (pt)</label>
                                    <input type="number" class="form-control" data-field="marginBottom" min="0" step="0.5">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Alignement</label>
                                <select class="form-control" data-field="alignment">
                                    <option value="left">Gauche</option>
                                    <option value="center">Centre</option>
                                    <option value="right">Droite</option>
                                    <option value="justify">Justifié</option>
                                </select>
                            </div>
                        </div>
                        <div class="canvas-level" data-level="3">
                            <h4>Niveau 3</h4>
                            <div class="form-group">
                                <label>Police</label>
                                <input type="text" class="form-control" data-field="fontFamily" placeholder="Arial">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Taille (pt)</label>
                                    <input type="number" class="form-control" data-field="fontSize" min="8" max="72" step="0.5">
                                </div>
                                <div class="form-group">
                                    <label>Gras</label>
                                    <select class="form-control" data-field="fontWeight">
                                        <option value="normal">Normal</option>
                                        <option value="bold">Gras</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Couleur</label>
                                <input type="color" class="form-control" data-field="color">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Marge haut (pt)</label>
                                    <input type="number" class="form-control" data-field="marginTop" min="0" step="0.5">
                                </div>
                                <div class="form-group">
                                    <label>Marge bas (pt)</label>
                                    <input type="number" class="form-control" data-field="marginBottom" min="0" step="0.5">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Alignement</label>
                                <select class="form-control" data-field="alignment">
                                    <option value="left">Gauche</option>
                                    <option value="center">Centre</option>
                                    <option value="right">Droite</option>
                                    <option value="justify">Justifié</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Onglet Paragraphes -->
                <div class="canvas-tab-panel" data-panel="paragraphs">
                    <div class="form-group">
                        <label>Police</label>
                        <input type="text" class="form-control" data-field="fontFamily" placeholder="Arial">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Taille (pt)</label>
                            <input type="number" class="form-control" data-field="fontSize" min="8" max="72" step="0.5">
                        </div>
                        <div class="form-group">
                            <label>Interligne</label>
                            <input type="number" class="form-control" data-field="lineHeight" min="0.5" max="3" step="0.05">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Marge haut (pt)</label>
                            <input type="number" class="form-control" data-field="marginTop" min="0" step="0.5">
                        </div>
                        <div class="form-group">
                            <label>Marge bas (pt)</label>
                            <input type="number" class="form-control" data-field="marginBottom" min="0" step="0.5">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Alignement</label>
                        <select class="form-control" data-field="textAlign">
                            <option value="left">Gauche</option>
                            <option value="center">Centre</option>
                            <option value="right">Droite</option>
                            <option value="justify">Justifié</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Retrait première ligne (pt)</label>
                        <input type="number" class="form-control" data-field="textIndent" min="0" step="0.5">
                    </div>
                </div>

                <!-- Onglet Images -->
                <div class="canvas-tab-panel" data-panel="images">
                    <div class="form-group">
                        <label>Largeur max</label>
                        <input type="text" class="form-control" data-field="maxWidth" placeholder="100%">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Marge haut (pt)</label>
                            <input type="number" class="form-control" data-field="marginTop" min="0" step="0.5">
                        </div>
                        <div class="form-group">
                            <label>Marge bas (pt)</label>
                            <input type="number" class="form-control" data-field="marginBottom" min="0" step="0.5">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Rayon des coins (pt)</label>
                        <input type="number" class="form-control" data-field="borderRadius" min="0" step="0.5">
                    </div>
                </div>

                <!-- Onglet Annexes -->
                <div class="canvas-tab-panel" data-panel="annexes">
                    <div class="form-group">
                        <label>Police</label>
                        <input type="text" class="form-control" data-field="fontFamily" placeholder="Arial">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Taille (pt)</label>
                            <input type="number" class="form-control" data-field="fontSize" min="8" max="72" step="0.5">
                        </div>
                        <div class="form-group">
                            <label>Gras</label>
                            <select class="form-control" data-field="fontWeight">
                                <option value="normal">Normal</option>
                                <option value="bold">Gras</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Couleur</label>
                        <input type="color" class="form-control" data-field="color">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Marge haut (pt)</label>
                            <input type="number" class="form-control" data-field="marginTop" min="0" step="0.5">
                        </div>
                        <div class="form-group">
                            <label>Marge bas (pt)</label>
                            <input type="number" class="form-control" data-field="marginBottom" min="0" step="0.5">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Alignement</label>
                        <select class="form-control" data-field="alignment">
                            <option value="left">Gauche</option>
                            <option value="center">Centre</option>
                            <option value="right">Droite</option>
                            <option value="justify">Justifié</option>
                        </select>
                    </div>
                </div>

                <!-- Onglet Marges -->
                <div class="canvas-tab-panel" data-panel="margins">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Haut (pt)</label>
                            <input type="number" class="form-control" data-field="top" min="0" step="0.5">
                        </div>
                        <div class="form-group">
                            <label>Droite (pt)</label>
                            <input type="number" class="form-control" data-field="right" min="0" step="0.5">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Bas (pt)</label>
                            <input type="number" class="form-control" data-field="bottom" min="0" step="0.5">
                        </div>
                        <div class="form-group">
                            <label>Gauche (pt)</label>
                            <input type="number" class="form-control" data-field="left" min="0" step="0.5">
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="canvasModalCancel">Annuler</button>
            <button type="button" class="btn btn-primary" id="canvasModalSave">Enregistrer</button>
        </div>
    </div>
</div>

<?php require_once '../../../includes/footer.php'; ?>
