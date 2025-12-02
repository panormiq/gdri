<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Agent Documentaire — Gestion des Modèles';

$extra_styles = [
    url('assets/css/agent-documentaire.css')
];
$extra_scripts = [
    url('assets/js/models-management.js')
];

require_once '../../../includes/header.php';
?>

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <div>
                <h1>Gestion des Modèles</h1>
                <p class="hero-description">
                    Gérez vos modèles de produits (collections) et vos templates de sections.
                </p>
            </div>
            <div class="hero-actions">
                <a class="btn btn-outline" href="<?= url('pages/modules/document-agent/index.php'); ?>">⬅️ Retour</a>
            </div>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <!-- Onglets principaux -->
        <div class="main-tabs">
            <button class="main-tab is-active" data-main-tab="models">📦 Modèles (Collections de produits)</button>
            <button class="main-tab" data-main-tab="templates">📄 Templates de sections</button>
        </div>

        <!-- Section Modèles (Collections de produits) -->
        <div class="main-tab-panel is-active" data-main-panel="models">
            <div class="panel-header">
                <h2>Modèles de produits</h2>
                <button class="btn btn-primary" id="createModelBtn">➕ Nouveau modèle</button>
            </div>
            <div class="panel-filters">
                <input type="text" id="searchModels" class="form-control" placeholder="Rechercher un modèle...">
            </div>
            <div class="models-list" id="modelsList">
                <div class="loading-message">
                    <p>Chargement des modèles...</p>
                </div>
            </div>
        </div>

        <!-- Section Templates de sections -->
        <div class="main-tab-panel" data-main-panel="templates">
            <!-- Filtres -->
            <div class="models-filters">
                <div class="filter-group">
                    <label for="filterType">Type de template :</label>
                    <select id="filterType" class="form-control">
                        <option value="all">Tous</option>
                        <option value="document">Documents</option>
                        <option value="section">Sections</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="filterScope">Scope :</label>
                    <select id="filterScope" class="form-control">
                        <option value="all">Tous les scopes</option>
                    </select>
                </div>
                <div class="filter-group">
                    <input type="text" id="searchTemplates" class="form-control" placeholder="Rechercher un template...">
                </div>
            </div>

            <!-- Liste des templates -->
            <div class="panel-header">
                <h2>Templates de sections</h2>
                <button class="btn btn-primary" id="createTemplateBtn">➕ Nouveau template</button>
            </div>
            <div class="models-list" id="templatesList">
                <div class="loading-message">
                    <p>Chargement des templates...</p>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Modal Création/Édition Template -->
<div class="modal-overlay" id="templateModal" style="display: none;">
    <div class="modal modal-large">
        <div class="modal-header">
            <h3 id="templateModalTitle">Nouveau modèle</h3>
            <button class="modal-close" id="templateModalClose">×</button>
        </div>
        <div class="modal-body">
            <form id="templateForm">
                <input type="hidden" id="templateNamespace" name="namespace">
                
                <!-- Onglets -->
                <div class="template-tabs">
                    <button type="button" class="template-tab is-active" data-tab="general">Général</button>
                    <button type="button" class="template-tab" data-tab="fields">Champs</button>
                    <button type="button" class="template-tab" data-tab="variants">Variantes</button>
                    <button type="button" class="template-tab" data-tab="preview">Aperçu</button>
                </div>

                <!-- Onglet Général -->
                <div class="template-tab-panel is-active" data-panel="general">
                    <div class="form-group">
                        <label for="templateName">Nom du modèle *</label>
                        <input type="text" id="templateName" name="name" class="form-control" required>
                        <small class="form-hint">Le nom affiché du modèle</small>
                    </div>

                    <div class="form-group">
                        <label for="templateTitle">Titre de la section</label>
                        <input type="text" id="templateTitle" name="title" class="form-control">
                        <small class="form-hint">Titre utilisé dans les documents</small>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="templateLevel">Niveau</label>
                            <input type="number" id="templateLevel" name="level" class="form-control" min="1" max="6" value="1">
                            <small class="form-hint">Niveau hiérarchique (1-6)</small>
                        </div>
                        <div class="form-group">
                            <label for="templateScope">Scope</label>
                            <input type="text" id="templateScope" name="scope" class="form-control" placeholder="dossier_technique">
                            <small class="form-hint">Namespace du template document parent (pour les sections)</small>
                        </div>
                    </div>

                    <!-- Propriétés de structure -->
                    <div class="form-section">
                        <h4>Propriétés de structure</h4>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="templateIsOptional" name="isOptional">
                                <span>Section optionnelle</span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="templateHasMultipleChoice" name="hasMultipleChoice">
                                <span>À choix multiple</span>
                            </label>
                            <small class="form-hint">Permet de choisir parmi des variantes prédéfinies</small>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="templateAllowMultiple" name="allowMultiple">
                                <span>Peut être dupliquée</span>
                            </label>
                            <small class="form-hint">Permet d'ajouter plusieurs instances de cette section</small>
                        </div>
                        <div class="form-group" id="maxInstancesGroup" style="display: none;">
                            <label for="templateMaxInstances">Nombre maximum d'instances</label>
                            <input type="number" id="templateMaxInstances" name="maxInstances" class="form-control" min="1" value="1">
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="templateIsStandalone" name="isStandalone" checked>
                                <span>Standalone (styles indépendants)</span>
                            </label>
                            <small class="form-hint">Si désactivé, hérite des styles du template document parent</small>
                        </div>
                    </div>
                </div>

                <!-- Onglet Champs -->
                <div class="template-tab-panel" data-panel="fields">
                    <div class="fields-header">
                        <h4>Champs du modèle</h4>
                        <button type="button" class="btn btn-sm btn-outline" id="addFieldBtn">➕ Ajouter un champ</button>
                    </div>
                    <div class="fields-list" id="fieldsList">
                        <p class="text-muted">Aucun champ défini. Ajoutez des champs pour créer des variables dans votre modèle.</p>
                    </div>
                </div>

                <!-- Onglet Variantes -->
                <div class="template-tab-panel" data-panel="variants">
                    <div class="variants-header">
                        <h4>Variantes (pour choix multiple)</h4>
                        <small class="form-hint">Les variantes permettent de proposer plusieurs configurations prédéfinies pour cette section.</small>
                    </div>
                    <div class="variants-list" id="variantsList">
                        <p class="text-muted">Aucune variante définie. Ajoutez des variantes pour permettre un choix multiple.</p>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline" id="addVariantBtn">➕ Ajouter une variante</button>
                </div>

                <!-- Onglet Aperçu -->
                <div class="template-tab-panel" data-panel="preview">
                    <div class="preview-header">
                        <h4>Aperçu du modèle</h4>
                        <button type="button" class="btn btn-sm btn-outline" id="refreshPreviewBtn">🔄 Actualiser</button>
                    </div>
                    <div class="preview-content" id="previewContent">
                        <p class="text-muted">L'aperçu sera généré après avoir défini au moins un champ ou une variante.</p>
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="templateModalCancel">Annuler</button>
            <button type="button" class="btn btn-primary" id="templateModalSave">Enregistrer</button>
        </div>
    </div>
</div>

<!-- Modal Champ -->
<div class="modal-overlay" id="fieldModal" style="display: none;">
    <div class="modal">
        <div class="modal-header">
            <h3 id="fieldModalTitle">Nouveau champ</h3>
            <button class="modal-close" id="fieldModalClose">×</button>
        </div>
        <div class="modal-body">
            <form id="fieldForm">
                <input type="hidden" id="fieldIndex" name="index">
                
                <div class="form-group">
                    <label for="fieldName">Nom de la variable *</label>
                    <input type="text" id="fieldName" name="name" class="form-control" required placeholder="nom_moteur">
                    <small class="form-hint">Nom utilisé comme variable dans le template (ex: {{nom_moteur}})</small>
                </div>

                <div class="form-group">
                    <label for="fieldLabel">Libellé *</label>
                    <input type="text" id="fieldLabel" name="label" class="form-control" required placeholder="Nom du moteur">
                    <small class="form-hint">Libellé affiché à l'utilisateur</small>
                </div>

                <div class="form-group">
                    <label for="fieldType">Type de champ *</label>
                    <select id="fieldType" name="type" class="form-control" required>
                        <option value="text">Texte</option>
                        <option value="number">Nombre</option>
                        <option value="image">Image</option>
                        <option value="textarea">Texte long</option>
                        <option value="date">Date</option>
                        <option value="boolean">Oui/Non</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="fieldDefault">Valeur par défaut</label>
                    <input type="text" id="fieldDefault" name="default" class="form-control" placeholder="Valeur par défaut">
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="fieldRequired" name="required">
                        <span>Champ obligatoire</span>
                    </label>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="fieldModalCancel">Annuler</button>
            <button type="button" class="btn btn-primary" id="fieldModalSave">Enregistrer</button>
        </div>
    </div>
</div>

<!-- Modal Variante -->
<div class="modal-overlay" id="variantModal" style="display: none;">
    <div class="modal modal-large">
        <div class="modal-header">
            <h3 id="variantModalTitle">Nouvelle variante</h3>
            <button class="modal-close" id="variantModalClose">×</button>
        </div>
        <div class="modal-body">
            <form id="variantForm">
                <input type="hidden" id="variantKey" name="key">
                
                <div class="form-group">
                    <label for="variantName">Nom de la variante *</label>
                    <input type="text" id="variantName" name="name" class="form-control" required placeholder="Moteur 200cv">
                    <small class="form-hint">Nom affiché dans la liste de choix</small>
                </div>

                <div class="form-group">
                    <label for="variantDescription">Description</label>
                    <textarea id="variantDescription" name="description" class="form-control" rows="3" placeholder="Description de cette variante"></textarea>
                </div>

                <div class="form-section">
                    <h4>Valeurs des champs pour cette variante</h4>
                    <div id="variantFieldsValues">
                        <p class="text-muted">Les valeurs des champs seront définies ici.</p>
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="variantModalCancel">Annuler</button>
            <button type="button" class="btn btn-primary" id="variantModalSave">Enregistrer</button>
        </div>
    </div>
</div>

<style>
.models-filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    align-items: flex-end;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 200px;
}

.filter-group label {
    font-weight: 600;
    font-size: 0.9rem;
}

.models-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
}

.template-card {
    background: white;
    border: 1px solid var(--doc-border, #e0e6f0);
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.3s ease;
    cursor: pointer;
}

.template-card:hover {
    border-color: var(--doc-accent-strong, #4b9ed8);
    box-shadow: 0 8px 24px rgba(75, 158, 216, 0.15);
    transform: translateY(-2px);
}

.template-card__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
}

.template-card__name {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2d3d;
    margin: 0;
}

.template-card__type {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(75, 158, 216, 0.15);
    color: #4b9ed8;
}

.template-card__meta {
    font-size: 0.85rem;
    color: var(--doc-text-muted, #6c7a89);
    margin-bottom: 1rem;
}

.template-card__properties {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.template-card__property {
    font-size: 0.8rem;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(15, 23, 42, 0.06);
    color: #0f172a;
}

.template-card__actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
}

.template-tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--doc-border, #e0e6f0);
    margin-bottom: 1.5rem;
}

.template-tab {
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-weight: 600;
    color: var(--doc-text-muted, #6c7a89);
    transition: all 0.2s ease;
    margin-bottom: -2px;
}

.template-tab:hover {
    color: var(--doc-accent-strong, #4b9ed8);
}

.template-tab.is-active {
    color: var(--doc-accent-strong, #4b9ed8);
    border-bottom-color: var(--doc-accent-strong, #4b9ed8);
}

.template-tab-panel {
    display: none;
}

.template-tab-panel.is-active {
    display: block;
}

.form-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--doc-border, #e0e6f0);
}

.form-section h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
}

.fields-header,
.variants-header,
.preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.fields-list,
.variants-list {
    margin-bottom: 1rem;
}

.field-item,
.variant-item {
    background: #f8fbff;
    border: 1px solid rgba(75, 158, 216, 0.2);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.field-item__info,
.variant-item__info {
    flex: 1;
}

.field-item__name,
.variant-item__name {
    font-weight: 600;
    color: #1f2d3d;
    margin-bottom: 0.25rem;
}

.field-item__meta,
.variant-item__meta {
    font-size: 0.85rem;
    color: var(--doc-text-muted, #6c7a89);
}

.field-item__actions,
.variant-item__actions {
    display: flex;
    gap: 0.5rem;
}

.preview-content {
    background: #fff;
    border: 1px solid var(--doc-border, #e0e6f0);
    border-radius: 8px;
    padding: 2rem;
    min-height: 400px;
}

.modal-large {
    max-width: 900px;
    width: 90%;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
    cursor: pointer;
}

/* Onglets principaux */
.main-tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--doc-border, #e0e6f0);
    margin-bottom: 2rem;
}

.main-tab {
    padding: 1rem 2rem;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    color: var(--doc-text-muted, #6c7a89);
    transition: all 0.2s ease;
    margin-bottom: -2px;
}

.main-tab:hover {
    color: var(--doc-accent-strong, #4b9ed8);
    background: rgba(75, 158, 216, 0.05);
}

.main-tab.is-active {
    color: var(--doc-accent-strong, #4b9ed8);
    border-bottom-color: var(--doc-accent-strong, #4b9ed8);
}

.main-tab-panel {
    display: none;
}

.main-tab-panel.is-active {
    display: block;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.panel-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1f2d3d;
}

.panel-filters {
    margin-bottom: 1.5rem;
}
</style>

<?php require_once '../../../includes/footer.php'; ?>

