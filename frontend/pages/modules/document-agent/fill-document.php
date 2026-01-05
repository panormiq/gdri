<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Remplir un document/collection';

require_once '../../../includes/header.php';
?>

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <div>
                <h1>Remplir un document/collection</h1>
                <p class="hero-description">
                    Remplissez un document à partir d'un canevas ou une collection avec ses valeurs.
                </p>
            </div>
            <div class="hero-actions">
                <a class="btn btn-outline" href="<?= url('pages/modules/document-agent/index.php'); ?>">← Retour</a>
            </div>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="fill-document-container">
            <!-- Étape 1 : Sélection du type -->
            <div id="step1-select" class="fill-step active">
                <h2>1. Choisissez ce que vous voulez remplir</h2>
                
                <div class="type-selector" style="margin: 2rem 0; display: flex; gap: 2rem; justify-content: center;">
                    <label style="display: flex; flex-direction: column; align-items: center; cursor: pointer; padding: 2rem; border: 2px solid #e0e0e0; border-radius: 8px; transition: all 0.3s;">
                        <input type="radio" name="fillType" value="canvas" checked style="margin-bottom: 1rem;">
                        <span style="font-size: 3rem; margin-bottom: 0.5rem;">📄</span>
                        <span style="font-weight: 600;">Document (Canevas)</span>
                        <span style="font-size: 0.875rem; color: #666; margin-top: 0.5rem; text-align: center;">
                            Remplir un document à partir d'un canevas/template
                        </span>
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; cursor: pointer; padding: 2rem; border: 2px solid #e0e0e0; border-radius: 8px; transition: all 0.3s;">
                        <input type="radio" name="fillType" value="collection" style="margin-bottom: 1rem;">
                        <span style="font-size: 3rem; margin-bottom: 0.5rem;">📦</span>
                        <span style="font-weight: 600;">Collection</span>
                        <span style="font-size: 0.875rem; color: #666; margin-top: 0.5rem; text-align: center;">
                            Remplir une collection (model) avec ses variantes
                        </span>
                    </label>
                </div>

                <!-- Liste des canevas (templates document) -->
                <div id="canvasListContainer" style="display: block;">
                    <h3 style="margin-top: 2rem;">Sélectionnez un canevas</h3>
                    <div id="canvasList" class="items-list">
                        <p class="text-muted">Chargement...</p>
                    </div>
                </div>

                <!-- Liste des collections (models) -->
                <div id="collectionListContainer" style="display: none;">
                    <h3 style="margin-top: 2rem;">Sélectionnez une collection</h3>
                    <div id="collectionList" class="items-list">
                        <p class="text-muted">Chargement...</p>
                    </div>
                </div>
            </div>

            <!-- Étape 2 : Formulaire de remplissage -->
            <div id="step2-form" class="fill-step" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>2. Remplissez les valeurs</h2>
                    <button class="btn btn-outline" id="backToStep1Btn">← Retour</button>
                </div>

                <div id="fillFormContainer">
                    <!-- Le formulaire sera généré dynamiquement ici -->
                </div>

                <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                    <button class="btn btn-outline" id="cancelFillBtn">Annuler</button>
                    <button class="btn btn-primary" id="saveFillBtn">Enregistrer</button>
                </div>
            </div>

            <!-- Étape 3 : Viewer/Confirmation -->
            <div id="step3-viewer" class="fill-step" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>3. Résultat</h2>
                    <button class="btn btn-outline" id="backToStep2Btn">← Retour</button>
                </div>

                <div id="viewerContainer">
                    <!-- Contenu du viewer selon le type -->
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Modal pour ajouter une colonne -->
<div class="modal-overlay" id="addColumnModal" style="display: none;">
    <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
            <h3>Ajouter une colonne</h3>
            <button class="modal-close" id="addColumnModalClose">×</button>
        </div>
        <div class="modal-body">
            <form id="addColumnForm">
                <div class="form-field">
                    <label for="columnName">Nom de la colonne *</label>
                    <input type="text" id="columnName" name="name" class="form-control" required placeholder="Ex: Puissance">
                </div>
                <div class="form-field">
                    <label for="columnType">Type *</label>
                    <select id="columnType" name="type" class="form-control" required>
                        <option value="">-- Sélectionner un type --</option>
                        <option value="text">Texte</option>
                        <option value="number">Nombre</option>
                        <option value="boolean">Booléen</option>
                        <option value="image">Image</option>
                    </select>
                </div>
                <div class="form-field">
                    <label for="columnUnit">Unité</label>
                    <input type="text" id="columnUnit" name="unit" class="form-control" placeholder="Ex: Watt, KWatt, chevaux">
                    <small class="form-hint" style="color: #666; font-size: 0.875rem;">Optionnel : unité de mesure pour les valeurs numériques</small>
                </div>
            </form>
        </div>
        <div class="modal-footer" style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button class="btn btn-outline" id="addColumnModalCancel">Annuler</button>
            <button class="btn btn-primary" id="addColumnModalSave">Ajouter</button>
        </div>
    </div>
</div>

<!-- Modal de confirmation pour supprimer une colonne -->
<div class="modal-overlay" id="deleteColumnModal" style="display: none;">
    <div class="modal" style="max-width: 400px;">
        <div class="modal-header">
            <h3>Supprimer la colonne</h3>
            <button class="modal-close" id="deleteColumnModalClose">×</button>
        </div>
        <div class="modal-body">
            <p>Êtes-vous sûr de vouloir supprimer la colonne "<strong id="deleteColumnName"></strong>" ?</p>
            <p style="color: #dc2626; font-size: 0.9rem; margin-top: 1rem;">⚠️ Cette action supprimera également toutes les données de cette colonne dans toutes les entrées.</p>
        </div>
        <div class="modal-footer" style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button class="btn btn-outline" id="deleteColumnModalCancel">Annuler</button>
            <button class="btn btn-danger" id="deleteColumnModalConfirm">Supprimer</button>
        </div>
    </div>
</div>

<style>
.fill-document-container {
    max-width: 1200px;
    margin: 0 auto;
}

.fill-step {
    background: white;
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.type-selector label input[type="radio"]:checked + span + span {
    color: var(--color-primary, #606163);
}

.type-selector label:has(input[type="radio"]:checked) {
    border-color: var(--color-primary, #606163);
    background: #f5f9ff;
}

.items-list {
    margin-top: 1rem;
}

.item-item {
    padding: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
}

.item-item:hover {
    background: #f5f5f5;
}

.item-item.selected {
    background: #e3f2fd;
    border-color: var(--color-primary, #606163);
}

.item-item-name {
    font-weight: 600;
    color: #333;
}

.item-item-meta {
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.25rem;
}

.form-field {
    margin-bottom: 1.5rem;
}

.form-field label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #333;
}

.form-field input[type="text"],
.form-field input[type="number"],
.form-field textarea,
.form-field select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
}

.form-field textarea {
    min-height: 100px;
    resize: vertical;
}

.form-field .field-unit {
    color: #666;
    font-size: 0.875rem;
    margin-left: 0.5rem;
}

.collection-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
}

.collection-table th,
.collection-table td {
    padding: 0.75rem;
    border: 1px solid #ddd;
    text-align: left;
}

.collection-table thead th {
    background: #f5f5f5;
    font-weight: 600;
}

.collection-table tbody tr:hover {
    background: #f9f9f9;
}

.collection-table tbody tr.selected {
    background: #e3f2fd;
}

.btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
}

.delete-column-btn {
    opacity: 0.6;
    transition: opacity 0.2s;
}

.delete-column-btn:hover {
    opacity: 1;
    background: rgba(220, 38, 38, 0.1) !important;
    border-radius: 4px;
}

.btn-danger {
    background: #dc2626;
    color: white;
    border: none;
}

.btn-danger:hover {
    background: #b91c1c;
}

.document-card {
    transition: all 0.3s ease;
}

.document-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    border-color: var(--color-primary, #606163) !important;
}

.delete-document-btn:hover {
    background: rgba(220, 38, 38, 0.1) !important;
}
</style>

<script>
(function() {
    const apiBase = window.API_BASE_URL || '';
    let selectedItem = null;
    let fillType = 'canvas'; // 'canvas' ou 'collection'
    let filledData = null;
    let collectionEntries = []; // Stocker les entrées de la collection

    // Charger la liste des canevas (templates document)
    async function loadCanvases() {
        const canvasList = document.getElementById('canvasList');
        if (!canvasList) return;

        canvasList.innerHTML = '<p class="text-muted">Chargement...</p>';

        try {
            const response = await fetch(`${apiBase}/agent-documentaire/templates`);
            const payload = await response.json();
            
            if (!payload.success) {
                throw new Error(payload.error || 'Erreur lors du chargement');
            }

            const templates = payload.data || [];
            
            // Filtrer les templates document (sans ':' dans le namespace)
            const documentTemplates = templates.filter(t => !t.namespace.includes(':'));

            if (documentTemplates.length === 0) {
                canvasList.innerHTML = '<p class="text-muted">Aucun canevas disponible. Créez-en un d\'abord.</p>';
                return;
            }

            canvasList.innerHTML = documentTemplates.map(template => `
                <div class="item-item" data-namespace="${template.namespace}">
                    <div class="item-item-name">${template.name || template.namespace}</div>
                    <div class="item-item-meta">
                        Créé le ${new Date(template.metadata?.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                </div>
            `).join('');

            // Ajouter les événements de clic
            canvasList.querySelectorAll('.item-item').forEach(item => {
                item.addEventListener('click', function() {
                    canvasList.querySelectorAll('.item-item').forEach(i => i.classList.remove('selected'));
                    this.classList.add('selected');
                    loadCanvasDetails(this.dataset.namespace);
                });
            });

        } catch (error) {
            console.error('Erreur chargement canevas:', error);
            canvasList.innerHTML = '<p class="text-danger">Erreur lors du chargement</p>';
        }
    }

    // Charger la liste des collections (models)
    async function loadCollections() {
        const collectionList = document.getElementById('collectionList');
        if (!collectionList) return;

        collectionList.innerHTML = '<p class="text-muted">Chargement...</p>';

        try {
            const response = await fetch(`${apiBase}/agent-documentaire/models`);
            const payload = await response.json();
            
            if (!payload.success) {
                throw new Error(payload.error || 'Erreur lors du chargement');
            }

            const models = payload.data || [];
            
            if (models.length === 0) {
                collectionList.innerHTML = '<p class="text-muted">Aucune collection disponible. Créez-en une d\'abord.</p>';
                return;
            }

            collectionList.innerHTML = models.map(model => `
                <div class="item-item" data-namespace="${model.namespace}">
                    <div class="item-item-name">${model.name || model.namespace}</div>
                    <div class="item-item-meta">
                        ${model.fields?.length || 0} champ(s) défini(s)
                    </div>
                </div>
            `).join('');

            // Ajouter les événements de clic
            collectionList.querySelectorAll('.item-item').forEach(item => {
                item.addEventListener('click', function() {
                    collectionList.querySelectorAll('.item-item').forEach(i => i.classList.remove('selected'));
                    this.classList.add('selected');
                    loadCollectionDetails(this.dataset.namespace);
                });
            });

        } catch (error) {
            console.error('Erreur chargement collections:', error);
            collectionList.innerHTML = '<p class="text-danger">Erreur lors du chargement</p>';
        }
    }

    // Charger les détails d'un canevas et afficher les documents existants
    async function loadCanvasDetails(namespace) {
        try {
            // Charger le template
            const templateResponse = await fetch(`${apiBase}/agent-documentaire/templates/${encodeURIComponent(namespace)}`);
            const templatePayload = await templateResponse.json();
            
            if (!templatePayload.success) {
                throw new Error(templatePayload.error || 'Canevas non trouvé');
            }

            selectedItem = templatePayload.data;
            
            // Charger les documents existants créés depuis ce template
            const documentsResponse = await fetch(`${apiBase}/agent-documentaire/documents?templateNamespace=${encodeURIComponent(namespace)}`);
            const documentsPayload = await documentsResponse.json();
            
            const existingDocuments = documentsPayload.success ? (documentsPayload.data || []) : [];

            // Afficher les documents existants sous forme de cards
            displayCanvasDocuments(selectedItem, existingDocuments);

            // Passer à l'étape 2
            document.getElementById('step1-select').style.display = 'none';
            document.getElementById('step2-form').style.display = 'block';

        } catch (error) {
            console.error('Erreur chargement canevas:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    // Afficher les documents existants sous forme de cards
    function displayCanvasDocuments(canvas, documents) {
        const container = document.getElementById('fillFormContainer');
        
        let html = `
            <div style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0;">Documents créés depuis "${canvas.name || canvas.namespace}"</h2>
                    <button class="btn btn-primary" id="addNewDocumentBtn">➕ Ajouter un document</button>
                </div>
        `;

        if (documents.length === 0) {
            html += `
                <div style="text-align: center; padding: 3rem; background: #f9f9f9; border-radius: 8px; border: 2px dashed #ddd;">
                    <p style="color: #666; font-size: 1.1rem; margin-bottom: 1rem;">Aucun document créé depuis ce canevas</p>
                    <p style="color: #999;">Cliquez sur "Ajouter un document" pour créer le premier document</p>
                </div>
            `;
        } else {
            html += `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                    ${documents.map(doc => {
                        const docId = doc._id || doc.id;
                        const docTitle = doc.title || 'Document sans titre';
                        const createdAt = doc.metadata?.createdAt ? new Date(doc.metadata.createdAt).toLocaleDateString('fr-FR') : 'Date inconnue';
                        const collectionInfo = doc.templateSource?.collectionNamespace 
                            ? `<div style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">Collection: ${doc.templateSource.collectionNamespace}</div>`
                            : '';
                        
                        return `
                            <div class="document-card" data-document-id="${docId}" style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.5rem; cursor: pointer; transition: all 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative;">
                                <button class="delete-document-btn" data-document-id="${docId}" style="position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; color: #dc2626; cursor: pointer; font-size: 1.5rem; line-height: 1; padding: 0.25rem 0.5rem; border-radius: 4px; transition: background 0.2s;" title="Supprimer ce document">×</button>
                                <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #333; padding-right: 2rem;">${escapeHtml(docTitle)}</h3>
                                <div style="font-size: 0.85rem; color: #999; margin-top: 0.5rem;">Créé le ${createdAt}</div>
                                ${collectionInfo}
                                <div style="margin-top: 1rem; font-size: 0.85rem; color: #666; font-style: italic;">Double-cliquez pour ouvrir</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        html += '</div>';

        container.innerHTML = html;

        // Ajouter les événements
        // Bouton "Ajouter un document"
        document.getElementById('addNewDocumentBtn')?.addEventListener('click', function() {
            generateCanvasForm(canvas);
        });

        // Double-clic sur une card de document pour ouvrir
        container.querySelectorAll('.document-card').forEach(card => {
            card.addEventListener('dblclick', function(e) {
                // Ne pas déclencher si on clique sur le bouton de suppression
                if (e.target.closest('.delete-document-btn')) {
                    return;
                }
                const docId = this.dataset.documentId;
                if (docId) {
                    openDocument(docId);
                }
            });
        });

        // Boutons de suppression
        container.querySelectorAll('.delete-document-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const docId = this.dataset.documentId;
                if (docId) {
                    deleteDocument(docId, canvas);
                }
            });
        });
    }

    // Ouvrir un document dans l'éditeur
    function openDocument(documentId) {
        const editorUrl = `<?= url('pages/modules/document-agent/editor.php'); ?>?document=${documentId}`;
        window.location.href = editorUrl;
    }

    // Supprimer un document
    async function deleteDocument(documentId, canvas) {
        const docTitle = document.querySelector(`[data-document-id="${documentId}"] h3`)?.textContent || 'ce document';
        
        if (!confirm(`Êtes-vous sûr de vouloir supprimer "${docTitle}" ?\n\nCette action est irréversible.`)) {
            return;
        }

        try {
            const response = await fetch(`${apiBase}/agent-documentaire/document/${encodeURIComponent(documentId)}`, {
                method: 'DELETE'
            });

            const payload = await response.json();

            if (!payload.success) {
                throw new Error(payload.error || 'Erreur lors de la suppression');
            }

            // Recharger la liste des documents
            await loadCanvasDetails(canvas.namespace);

        } catch (error) {
            console.error('Erreur suppression document:', error);
            alert(`Erreur lors de la suppression : ${error.message}`);
        }
    }

    // Charger les détails d'une collection et afficher le tableau directement
    async function loadCollectionDetails(namespace) {
        try {
            const response = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(namespace)}`);
            const payload = await response.json();
            
            if (!payload.success) {
                throw new Error(payload.error || 'Collection non trouvée');
            }

            selectedItem = payload.data;
            
            // Charger les entrées existantes (variants) de la collection
            collectionEntries = (selectedItem.variants || []).map((variant, index) => ({
                id: variant.id || `entry_${index}_${Date.now()}`,
                data: variant,
                createdAt: variant.createdAt || new Date()
            }));

            // Afficher directement le tableau au lieu du formulaire
            const viewerContainer = document.getElementById('viewerContainer');
            renderCollectionTable(viewerContainer);

            // Passer directement à l'étape 3 (viewer)
            document.getElementById('step1-select').style.display = 'none';
            document.getElementById('step3-viewer').style.display = 'block';

        } catch (error) {
            console.error('Erreur chargement collection:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    // Générer le formulaire pour un canevas
    async function generateCanvasForm(canvas) {
        const container = document.getElementById('fillFormContainer');
        container.innerHTML = '<p class="text-muted">Chargement du formulaire...</p>';

        try {
            let formHTML = '';
            let collectionData = null;
            let selectedCollectionEntry = null;
            let referenceFields = []; // Définir referenceFields dans une portée plus large

            // 0. Ajouter le champ "Nom du document" en premier
            formHTML += `
                <div class="form-field" style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 2px solid #e0e0e0;">
                    <label for="documentName">Nom du document <span style="color: #dc2626;">*</span></label>
                    <input type="text" id="documentName" name="documentName" class="form-control" required placeholder="Ex: Dossier technique moteur F100T" style="font-size: 1.1rem; padding: 0.75rem;">
                    <small class="form-hint">Ce nom sera utilisé pour identifier le document créé</small>
                </div>
            `;

            // 1. Vérifier si le template a une collection rattachée
            if (canvas.modelNamespace) {
                // Charger la collection
                const collectionResponse = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(canvas.modelNamespace)}`);
                const collectionPayload = await collectionResponse.json();
                
                if (collectionPayload.success && collectionPayload.data) {
                    collectionData = collectionPayload.data;
                    referenceFields = collectionData.referenceFields || []; // Utiliser la variable de portée supérieure
                    const variants = collectionData.variants || [];

                    // Gérer la sélection selon les referenceFields
                    formHTML += '<div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e0e0e0;"><h3>Collection : ' + escapeHtml(collectionData.name) + '</h3>';
                    
                    if (referenceFields.length === 0) {
                        // Aucune case cochée : demander à l'utilisateur de choisir un champ
                        formHTML += `
                            <div class="form-field" style="background: #fff3cd; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem; border: 1px solid #ffc107;">
                                <h4 style="margin: 0 0 0.5rem 0;">⚠️ Sélection du champ de référence</h4>
                                <p style="margin: 0 0 1rem 0;">Aucun champ de référence n'a été configuré pour cette collection. Veuillez choisir un champ à utiliser comme référence :</p>
                                <select id="referenceFieldSelect" class="form-control" style="max-width: 400px;">
                                    <option value="">-- Sélectionner un champ --</option>
                                    ${collectionData.fields.map(field => `
                                        <option value="${field.name}">${field.label || field.name}${field.unit ? ` (${field.unit})` : ''}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-field" id="collectionEntrySelectContainer" style="display: none;">
                                <label for="collectionEntrySelect">Sélectionner un élément de la collection</label>
                                <select id="collectionEntrySelect" class="form-control">
                                    <option value="">-- Sélectionner --</option>
                                </select>
                            </div>
                        `;
                    } else if (referenceFields.length === 1) {
                        // Une seule case cochée : afficher le champ de référence et le sélecteur de valeur
                        const refField = collectionData.fields.find(f => f.name === referenceFields[0]);
                        if (refField) {
                            formHTML += `
                                <div class="form-field">
                                    <label for="referenceFieldSelect">Champ de référence</label>
                                    <select id="referenceFieldSelect" class="form-control" style="max-width: 400px;">
                                        <option value="${refField.name}" selected>${refField.label || refField.name}${refField.unit ? ` (${refField.unit})` : ''}</option>
                                        ${collectionData.fields.filter(f => f.name !== refField.name).map(field => `
                                            <option value="${field.name}">${field.label || field.name}${field.unit ? ` (${field.unit})` : ''}</option>
                                        `).join('')}
                                    </select>
                                    <small class="form-hint">Vous pouvez changer le champ de référence si nécessaire</small>
                                </div>
                                <div class="form-field">
                                    <label for="collectionEntrySelect">Sélectionner un élément de la collection</label>
                                    <select id="collectionEntrySelect" class="form-control">
                                        <option value="">-- Sélectionner --</option>
                                        ${variants.map((variant, index) => {
                                            const displayValue = variant[referenceFields[0]] !== undefined && variant[referenceFields[0]] !== null 
                                                ? String(variant[referenceFields[0]]) 
                                                : `Élément ${index + 1}`;
                                            return `<option value="${variant.id || index}" data-variant-index="${index}">${escapeHtml(displayValue)}</option>`;
                                        }).join('')}
                                    </select>
                                </div>
                            `;
                        }
                    } else {
                        // Plusieurs cases cochées : afficher les champs de référence et le sélecteur de valeur
                        formHTML += `
                            <div class="form-field">
                                <label>Champs de référence (vous pouvez en modifier la sélection)</label>
                                <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem;">
                                    ${collectionData.fields.map(field => {
                                        const isChecked = referenceFields.includes(field.name);
                                        return `
                                            <label class="checkbox-label" style="margin: 0;">
                                                <input type="checkbox" class="reference-field-checkbox" data-field-name="${field.name}" ${isChecked ? 'checked' : ''} style="margin-right: 0.5rem;">
                                                <span>${field.label || field.name}${field.unit ? ` (${field.unit})` : ''}</span>
                                            </label>
                                        `;
                                    }).join('')}
                                </div>
                                <small class="form-hint">Cochez les champs à utiliser comme référence</small>
                            </div>
                            <div class="form-field">
                                <label for="collectionEntrySelect">Sélectionner un élément de la collection</label>
                                <select id="collectionEntrySelect" class="form-control">
                                    <option value="">-- Sélectionner --</option>
                                    ${variants.map((variant, index) => {
                                        const displayParts = referenceFields.map(fieldName => {
                                            const field = collectionData.fields.find(f => f.name === fieldName);
                                            const value = variant[fieldName];
                                            if (value !== undefined && value !== null) {
                                                return `${field?.label || fieldName}: ${value}${field?.unit ? ` ${field.unit}` : ''}`;
                                            }
                                            return null;
                                        }).filter(Boolean);
                                        
                                        const displayValue = displayParts.length > 0 
                                            ? displayParts.join(' - ') 
                                            : `Élément ${index + 1}`;
                                        
                                        return `<option value="${variant.id || index}" data-variant-index="${index}">${escapeHtml(displayValue)}</option>`;
                                    }).join('')}
                                </select>
                            </div>
                        `;
                    }
                    
                    formHTML += '</div>';
                }
            }

            // 2. Détecter toutes les collections rattachées aux sections (récursivement)
            const sectionCollections = await extractSectionCollections(selectedItem);
            
            // 3. Générer les formulaires pour chaque collection de section
            for (const sectionCollection of sectionCollections) {
                formHTML += await generateSectionCollectionForm(sectionCollection);
            }

            // 4. Extraire les variables du template (récursivement dans toutes les sections)
            const templateVariables = extractTemplateVariables(selectedItem);
            
            // Stocker sectionCollections pour l'utiliser dans les event listeners
            container.dataset.sectionCollections = JSON.stringify(sectionCollections.map(sc => ({
                sectionId: sc.sectionId,
                collectionNamespace: sc.section.modelNamespace
            })));

            // 3. Générer les champs pour les variables de la collection (si collection rattachée)
            if (collectionData && collectionData.fields && collectionData.fields.length > 0) {
                formHTML += '<div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e0e0e0;"><h3>Variables de la collection</h3>';
                collectionData.fields.forEach((field, index) => {
                    const fieldId = `collection_field_${index}`;
                    let inputHTML = '';

                    switch (field.type) {
                        case 'number':
                            inputHTML = `<input type="number" id="${fieldId}" name="${field.name}" class="form-control" step="any" ${field.required ? 'required' : ''} readonly>`;
                            break;
                        case 'boolean':
                            inputHTML = `
                                <select id="${fieldId}" name="${field.name}" class="form-control" ${field.required ? 'required' : ''} disabled>
                                    <option value="">-- Sélectionner --</option>
                                    <option value="true">Oui</option>
                                    <option value="false">Non</option>
                                </select>
                            `;
                            break;
                        case 'text':
                        default:
                            inputHTML = `<input type="text" id="${fieldId}" name="${field.name}" class="form-control" ${field.required ? 'required' : ''} readonly>`;
                            break;
                    }

                    const unitDisplay = field.unit ? ` <span class="field-unit">(${field.unit})</span>` : '';
                    formHTML += `
                        <div class="form-field">
                            <label for="${fieldId}">${field.label || field.name}${unitDisplay} ${field.required ? '<span style="color: #dc2626;">*</span>' : ''}</label>
                            ${inputHTML}
                            <small class="form-hint" style="color: #666; font-size: 0.875rem;">Cette valeur sera remplie automatiquement lors de la sélection d'un élément de la collection</small>
                        </div>
                    `;
                });
                formHTML += '</div>';
            }

            // 4. Filtrer les variables qui ne sont pas déjà dans les collections (principale + sections)
            const collectionFieldNames = collectionData ? (collectionData.fields || []).map(f => f.name) : [];
            
            // Ajouter les noms de champs des collections de sections
            const sectionCollectionFieldNames = [];
            sectionCollections.forEach(({ collection, sectionId }) => {
                if (collection && collection.fields) {
                    collection.fields.forEach(field => {
                        // Les champs de collection de section ont le format: section_${sectionId}_${field.name}
                        // Mais dans le template, ils sont référencés juste par ${field.name}
                        // Donc on doit exclure ces noms de champs
                        sectionCollectionFieldNames.push(field.name);
                    });
                }
            });
            
            // Combiner tous les noms de champs de collections
            const allCollectionFieldNames = [...collectionFieldNames, ...sectionCollectionFieldNames];
            
            // Filtrer les variables qui ne sont pas dans les collections
            const otherVariables = templateVariables.filter(v => !allCollectionFieldNames.includes(v.name));

            // 5. Générer les champs pour les autres variables
            if (otherVariables.length > 0) {
                formHTML += '<div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e0e0e0;"><h3>Autres variables</h3>';
                otherVariables.forEach((variable, index) => {
                    const fieldId = `var_${index}`;
                    let inputHTML = '';

                    switch (variable.type) {
                        case 'number':
                            inputHTML = `<input type="number" id="${fieldId}" name="${variable.name}" class="form-control" step="any" ${variable.required ? 'required' : ''}>`;
                            break;
                        case 'boolean':
                            inputHTML = `
                                <select id="${fieldId}" name="${variable.name}" class="form-control" ${variable.required ? 'required' : ''}>
                                    <option value="">-- Sélectionner --</option>
                                    <option value="true">Oui</option>
                                    <option value="false">Non</option>
                                </select>
                            `;
                            break;
                        case 'textarea':
                        case 'text':
                        default:
                            inputHTML = `<input type="text" id="${fieldId}" name="${variable.name}" class="form-control" ${variable.required ? 'required' : ''}>`;
                            break;
                    }

                    formHTML += `
                        <div class="form-field">
                            <label for="${fieldId}">${variable.label || variable.name} ${variable.required ? '<span style="color: #dc2626;">*</span>' : ''}</label>
                            ${inputHTML}
                        </div>
                    `;
                });
                formHTML += '</div>';
            }

            container.innerHTML = formHTML;

            // 5. Gérer les sélections des collections de sections
            // Récupérer sectionCollections depuis les données stockées
            const storedSectionCollections = container.dataset.sectionCollections 
                ? JSON.parse(container.dataset.sectionCollections) 
                : [];
            // Reconstruire les objets sectionCollections complets pour les event listeners
            const fullSectionCollections = [];
            for (const stored of storedSectionCollections) {
                // Trouver la section correspondante dans selectedItem
                const findSection = (sections, targetId) => {
                    for (const section of sections || []) {
                        if (section.id === targetId) {
                            return section;
                        }
                        if (section.children) {
                            const found = findSection(section.children, targetId);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                const section = findSection(selectedItem.initialSections, stored.sectionId);
                if (section && section.modelNamespace) {
                    try {
                        const collectionResponse = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(section.modelNamespace)}`);
                        const collectionPayload = await collectionResponse.json();
                        if (collectionPayload.success && collectionPayload.data) {
                            fullSectionCollections.push({
                                section: section,
                                collection: collectionPayload.data,
                                sectionId: stored.sectionId
                            });
                        }
                    } catch (e) {
                        console.warn('⚠️ Erreur chargement collection pour event listener:', e);
                    }
                }
            }
            setupSectionCollectionEventListeners(container, fullSectionCollections);

            // 6. Gérer la sélection d'un élément de la collection principale
            const collectionSelect = document.getElementById('collectionEntrySelect');
            if (collectionSelect) {
                collectionSelect.addEventListener('change', function() {
                    const variantIndex = parseInt(this.options[this.selectedIndex]?.dataset.variantIndex);
                    if (variantIndex !== undefined && collectionData && collectionData.variants[variantIndex]) {
                        selectedCollectionEntry = collectionData.variants[variantIndex];
                        // Pré-remplir les champs avec les données de la collection
                        prefillFormFromCollection(selectedCollectionEntry, collectionData);
                    }
                });
            }

            // 6. Gérer la sélection manuelle du champ de référence (pour aucun champ configuré)
            const referenceFieldSelect = document.getElementById('referenceFieldSelect');
            if (referenceFieldSelect && referenceFields.length === 0) {
                referenceFieldSelect.addEventListener('change', function() {
                    if (this.value && collectionData) {
                        const variants = collectionData.variants || [];
                        const refField = collectionData.fields.find(f => f.name === this.value);
                        
                        if (refField) {
                            const entrySelectContainer = document.getElementById('collectionEntrySelectContainer');
                            const entrySelect = document.getElementById('collectionEntrySelect');
                            
                            if (entrySelectContainer && entrySelect) {
                                // Afficher le conteneur
                                entrySelectContainer.style.display = 'block';
                                
                                // Mettre à jour les options
                                entrySelect.innerHTML = `
                                    <option value="">-- Sélectionner --</option>
                                    ${variants.map((variant, index) => {
                                        const displayValue = variant[this.value] !== undefined && variant[this.value] !== null 
                                            ? String(variant[this.value]) 
                                            : `Élément ${index + 1}`;
                                        return `<option value="${variant.id || index}" data-variant-index="${index}">${escapeHtml(displayValue)}</option>`;
                                    }).join('')}
                                `;
                                
                                // Réinitialiser la sélection
                                entrySelect.value = '';
                            }
                        }
                    } else {
                        const entrySelectContainer = document.getElementById('collectionEntrySelectContainer');
                        if (entrySelectContainer) {
                            entrySelectContainer.style.display = 'none';
                        }
                    }
                });
            }
            
            // 7. Gérer le changement de champ de référence (pour un seul champ configuré)
            if (referenceFieldSelect && referenceFields.length === 1) {
                referenceFieldSelect.addEventListener('change', function() {
                    if (this.value && collectionData) {
                        const variants = collectionData.variants || [];
                        const refField = collectionData.fields.find(f => f.name === this.value);
                        
                        if (refField && collectionSelect) {
                            // Mettre à jour les options du sélecteur de valeur
                            collectionSelect.innerHTML = `
                                <option value="">-- Sélectionner --</option>
                                ${variants.map((variant, index) => {
                                    const displayValue = variant[this.value] !== undefined && variant[this.value] !== null 
                                        ? String(variant[this.value]) 
                                        : `Élément ${index + 1}`;
                                    return `<option value="${variant.id || index}" data-variant-index="${index}">${escapeHtml(displayValue)}</option>`;
                                }).join('')}
                            `;
                            
                            // Réinitialiser la sélection
                            collectionSelect.value = '';
                        }
                    }
                });
            }
            
            // 8. Gérer les cases à cocher pour plusieurs champs de référence
            const referenceCheckboxes = container.querySelectorAll('.reference-field-checkbox');
            if (referenceCheckboxes.length > 0) {
                // Fonction pour mettre à jour le sélecteur d'entrée selon les champs cochés
                const updateCollectionEntrySelect = () => {
                    if (!collectionData || !collectionSelect) return;
                    
                    const checkedFields = Array.from(container.querySelectorAll('.reference-field-checkbox:checked'))
                        .map(cb => cb.dataset.fieldName);
                    
                    if (checkedFields.length === 0) {
                        collectionSelect.innerHTML = '<option value="">-- Sélectionner d\'abord un champ de référence --</option>';
                        return;
                    }
                    
                    const variants = collectionData.variants || [];
                    collectionSelect.innerHTML = `
                        <option value="">-- Sélectionner --</option>
                        ${variants.map((variant, index) => {
                            const displayParts = checkedFields.map(fieldName => {
                                const field = collectionData.fields.find(f => f.name === fieldName);
                                const value = variant[fieldName];
                                if (value !== undefined && value !== null) {
                                    return `${field?.label || fieldName}: ${value}${field?.unit ? ` ${field.unit}` : ''}`;
                                }
                                return null;
                            }).filter(Boolean);
                            
                            const displayValue = displayParts.length > 0 
                                ? displayParts.join(' - ') 
                                : `Élément ${index + 1}`;
                            
                            return `<option value="${variant.id || index}" data-variant-index="${index}">${escapeHtml(displayValue)}</option>`;
                        }).join('')}
                    `;
                    
                    // Réinitialiser la sélection
                    collectionSelect.value = '';
                };
                
                referenceCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', updateCollectionEntrySelect);
                });
            }

        } catch (error) {
            console.error('Erreur génération formulaire:', error);
            container.innerHTML = `<p class="text-danger">Erreur lors de la génération du formulaire : ${error.message}</p>`;
        }
    }

    // Extraire toutes les collections rattachées aux sections (récursivement)
    async function extractSectionCollections(template) {
        const sectionCollections = [];
        
        if (!template.initialSections || !Array.isArray(template.initialSections)) {
            return sectionCollections;
        }

        // Parcourir récursivement toutes les sections
        async function processSection(section, parentPath = []) {
            if (!section) return;

            // Vérifier si cette section a une collection rattachée
            if (section.modelNamespace) {
                try {
                    // Charger la collection
                    const collectionResponse = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(section.modelNamespace)}`);
                    const collectionPayload = await collectionResponse.json();
                    
                    if (collectionPayload.success && collectionPayload.data) {
                        sectionCollections.push({
                            section: section,
                            collection: collectionPayload.data,
                            path: [...parentPath, section.title || section.id || 'Section sans titre'],
                            sectionId: section.id || `section_${sectionCollections.length}`
                        });
                    }
                } catch (error) {
                    console.warn('⚠️ Erreur chargement collection pour section:', error);
                }
            }

            // Parcourir récursivement les enfants
            if (section.children && Array.isArray(section.children)) {
                const currentPath = [...parentPath, section.title || section.id || 'Section sans titre'];
                for (const child of section.children) {
                    await processSection(child, currentPath);
                }
            }
        }

        // Traiter toutes les sections racines
        for (const section of template.initialSections) {
            await processSection(section);
        }

        return sectionCollections;
    }

    // Générer le formulaire pour une collection de section
    async function generateSectionCollectionForm(sectionCollection) {
        const { section, collection, path, sectionId } = sectionCollection;
        let formHTML = '';
        const referenceFields = collection.referenceFields || [];
        const variants = collection.variants || [];

        formHTML += `<div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e0e0e0;" data-section-collection="${sectionId}">`;
        formHTML += `<h3>Collection "${escapeHtml(collection.name)}" - Section: ${path.map(p => escapeHtml(p)).join(' > ')}</h3>`;
        
        if (referenceFields.length === 0) {
            // Aucune case cochée : demander à l'utilisateur de choisir un champ
            formHTML += `
                <div class="form-field" style="background: #fff3cd; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem; border: 1px solid #ffc107;">
                    <h4 style="margin: 0 0 0.5rem 0;">⚠️ Sélection du champ de référence</h4>
                    <p style="margin: 0 0 1rem 0;">Aucun champ de référence n'a été configuré pour cette collection. Veuillez choisir un champ à utiliser comme référence :</p>
                    <select class="section-reference-field-select form-control" data-section-id="${sectionId}" style="max-width: 400px;">
                        <option value="">-- Sélectionner un champ --</option>
                        ${collection.fields.map(field => `
                            <option value="${field.name}">${field.label || field.name}${field.unit ? ` (${field.unit})` : ''}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-field section-collection-entry-container" data-section-id="${sectionId}" style="display: none;">
                    <label for="sectionCollectionEntrySelect_${sectionId}">Sélectionner un élément de la collection</label>
                    <select id="sectionCollectionEntrySelect_${sectionId}" class="section-collection-entry-select form-control" data-section-id="${sectionId}" data-collection-namespace="${section.modelNamespace}">
                        <option value="">-- Sélectionner --</option>
                    </select>
                </div>
            `;
        } else if (referenceFields.length === 1) {
            // Une seule case cochée
            const refField = collection.fields.find(f => f.name === referenceFields[0]);
            if (refField) {
                formHTML += `
                    <div class="form-field">
                        <label for="sectionReferenceFieldSelect_${sectionId}">Champ de référence</label>
                        <select id="sectionReferenceFieldSelect_${sectionId}" class="section-reference-field-select form-control" data-section-id="${sectionId}" style="max-width: 400px;">
                            <option value="${refField.name}" selected>${refField.label || refField.name}${refField.unit ? ` (${refField.unit})` : ''}</option>
                            ${collection.fields.filter(f => f.name !== refField.name).map(field => `
                                <option value="${field.name}">${field.label || field.name}${field.unit ? ` (${field.unit})` : ''}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-field">
                        <label for="sectionCollectionEntrySelect_${sectionId}">Sélectionner un élément de la collection</label>
                        <select id="sectionCollectionEntrySelect_${sectionId}" class="section-collection-entry-select form-control" data-section-id="${sectionId}" data-collection-namespace="${section.modelNamespace}">
                            <option value="">-- Sélectionner --</option>
                            ${variants.map((variant, index) => {
                                const displayValue = variant[referenceFields[0]] !== undefined && variant[referenceFields[0]] !== null 
                                    ? String(variant[referenceFields[0]]) 
                                    : `Élément ${index + 1}`;
                                return `<option value="${variant.id || index}" data-variant-index="${index}">${escapeHtml(displayValue)}</option>`;
                            }).join('')}
                        </select>
                    </div>
                `;
            }
        } else {
            // Plusieurs cases cochées
            formHTML += `
                <div class="form-field">
                    <label>Champs de référence (vous pouvez en modifier la sélection)</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem;">
                        ${collection.fields.map(field => {
                            const isChecked = referenceFields.includes(field.name);
                            return `
                                <label class="checkbox-label" style="margin: 0;">
                                    <input type="checkbox" class="section-reference-field-checkbox" data-section-id="${sectionId}" data-field-name="${field.name}" ${isChecked ? 'checked' : ''} style="margin-right: 0.5rem;">
                                    <span>${field.label || field.name}${field.unit ? ` (${field.unit})` : ''}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="form-field">
                    <label for="sectionCollectionEntrySelect_${sectionId}">Sélectionner un élément de la collection</label>
                    <select id="sectionCollectionEntrySelect_${sectionId}" class="section-collection-entry-select form-control" data-section-id="${sectionId}" data-collection-namespace="${section.modelNamespace}">
                        <option value="">-- Sélectionner --</option>
                        ${variants.map((variant, index) => {
                            const displayParts = referenceFields.map(fieldName => {
                                const field = collection.fields.find(f => f.name === fieldName);
                                const value = variant[fieldName];
                                if (value !== undefined && value !== null) {
                                    return `${field?.label || fieldName}: ${value}${field?.unit ? ` ${field.unit}` : ''}`;
                                }
                                return null;
                            }).filter(Boolean);
                            
                            const displayValue = displayParts.length > 0 
                                ? displayParts.join(' - ') 
                                : `Élément ${index + 1}`;
                            
                            return `<option value="${variant.id || index}" data-variant-index="${index}">${escapeHtml(displayValue)}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }

        // Ajouter les champs de variables de la collection (en lecture seule, pré-remplis)
        if (collection.fields && collection.fields.length > 0) {
            formHTML += '<div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e0e0e0;"><h4>Variables de la collection (pré-remplies)</h4>';
            collection.fields.forEach((field, index) => {
                const fieldId = `section_collection_field_${sectionId}_${index}`;
                let inputHTML = '';

                switch (field.type) {
                    case 'number':
                        inputHTML = `<input type="number" id="${fieldId}" name="section_${sectionId}_${field.name}" class="form-control" step="any" readonly>`;
                        break;
                    case 'boolean':
                        inputHTML = `
                            <select id="${fieldId}" name="section_${sectionId}_${field.name}" class="form-control" disabled>
                                <option value="">-- Sélectionner --</option>
                                <option value="true">Oui</option>
                                <option value="false">Non</option>
                            </select>
                        `;
                        break;
                    case 'text':
                    default:
                        inputHTML = `<input type="text" id="${fieldId}" name="section_${sectionId}_${field.name}" class="form-control" readonly>`;
                        break;
                }

                const unitDisplay = field.unit ? ` <span class="field-unit">(${field.unit})</span>` : '';
                formHTML += `
                    <div class="form-field">
                        <label for="${fieldId}">${field.label || field.name}${unitDisplay}</label>
                        ${inputHTML}
                        <small class="form-hint" style="color: #666; font-size: 0.875rem;">Cette valeur sera remplie automatiquement lors de la sélection d'un élément de la collection</small>
                    </div>
                `;
            });
            formHTML += '</div>';
        }

        formHTML += '</div>';

        return formHTML;
    }

    // Extraire les variables du template (récursivement dans toutes les sections)
    function extractTemplateVariables(template) {
        const variableMap = new Map();

        // 1. Variables définies dans canvas.variables
        if (template.canvas && template.canvas.variables) {
            Object.keys(template.canvas.variables).forEach(varName => {
                const varData = template.canvas.variables[varName];
                variableMap.set(varName, {
                    name: varName,
                    type: varData.type || 'text',
                    label: varData.label || varName,
                    required: varData.required || false
                });
            });
        }

        // 2. Variables définies dans fields
        if (template.fields && Array.isArray(template.fields)) {
            template.fields.forEach(field => {
                if (!variableMap.has(field.name)) {
                    variableMap.set(field.name, {
                        name: field.name,
                        type: field.type || 'text',
                        label: field.label || field.name,
                        required: field.required || false
                    });
                }
            });
        }

        // 3. Extraire les variables depuis les sections initiales (récursivement)
        if (template.initialSections && Array.isArray(template.initialSections)) {
            template.initialSections.forEach(section => {
                extractVariablesFromSection(section, variableMap);
            });
        }

        // 4. Extraire les variables depuis le contenu (syntaxe {{variable}}) - pour compatibilité
        if (template.content && Array.isArray(template.content)) {
            template.content.forEach(section => {
                extractVariablesFromContent(section, variableMap);
            });
        }

        return Array.from(variableMap.values());
    }

    // Extraire les variables depuis une section récursivement (inclut les enfants)
    function extractVariablesFromSection(section, variableMap) {
        if (!section) return;

        // Extraire les variables du contenu de la section
        if (section.content && Array.isArray(section.content)) {
            section.content.forEach(item => {
                extractVariablesFromContent(item, variableMap);
            });
        }

        // Parcourir récursivement les sections enfants
        if (section.children && Array.isArray(section.children)) {
            section.children.forEach(childSection => {
                extractVariablesFromSection(childSection, variableMap);
            });
        }
    }

    // Extraire les variables depuis le contenu récursivement (tous types de contenu)
    function extractVariablesFromContent(content, variableMap) {
        if (!content) return;

        // Fonction helper pour extraire les variables d'un texte
        const extractFromText = (text) => {
            if (!text || typeof text !== 'string') return;
            const matches = text.match(/\{\{([^}]+)\}\}/g);
            if (matches) {
                matches.forEach(match => {
                    const varName = match.replace(/\{\{|\}\}/g, '').trim();
                    if (varName && !variableMap.has(varName)) {
                        variableMap.set(varName, {
                            name: varName,
                            type: 'text',
                            label: varName,
                            required: false
                        });
                    }
                });
            }
        };

        // Paragraphe avec texte
        if (content.type === 'paragraph' && content.text) {
            extractFromText(content.text);
        }

        // Titre avec texte
        if (content.type === 'heading' && content.text) {
            extractFromText(content.text);
        }

        // Tableau : parcourir toutes les cellules
        if (content.type === 'table' && content.rows && Array.isArray(content.rows)) {
            content.rows.forEach(row => {
                if (row.cells && Array.isArray(row.cells)) {
                    row.cells.forEach(cell => {
                        if (cell.content && Array.isArray(cell.content)) {
                            cell.content.forEach(cellItem => {
                                extractVariablesFromContent(cellItem, variableMap);
                            });
                        } else if (cell.text) {
                            extractFromText(cell.text);
                        }
                    });
                }
            });
        }

        // Liste : parcourir tous les éléments
        if (content.type === 'list' && content.items && Array.isArray(content.items)) {
            content.items.forEach(item => {
                if (item.content && Array.isArray(item.content)) {
                    item.content.forEach(itemContent => {
                        extractVariablesFromContent(itemContent, variableMap);
                    });
                } else if (item.text) {
                    extractFromText(item.text);
                }
            });
        }

        // Si c'est une section avec du contenu, parcourir récursivement
        if (content.content && Array.isArray(content.content)) {
            content.content.forEach(item => {
                extractVariablesFromContent(item, variableMap);
            });
        }

        // Si c'est un objet avec une propriété text (cas générique)
        if (content.text && typeof content.text === 'string') {
            extractFromText(content.text);
        }
    }

    // Configurer les event listeners pour les collections de sections
    function setupSectionCollectionEventListeners(container, sectionCollections) {
        sectionCollections.forEach(({ section, collection, sectionId }) => {
            const collectionSelect = container.querySelector(`#sectionCollectionEntrySelect_${sectionId}`);
            const referenceFieldSelect = container.querySelector(`#sectionReferenceFieldSelect_${sectionId}`);
            const referenceCheckboxes = container.querySelectorAll(`.section-reference-field-checkbox[data-section-id="${sectionId}"]`);
            
            // Gérer la sélection d'un élément de la collection
            if (collectionSelect) {
                collectionSelect.addEventListener('change', function() {
                    const variantIndex = parseInt(this.options[this.selectedIndex]?.dataset.variantIndex);
                    if (variantIndex !== undefined && collection && collection.variants[variantIndex]) {
                        const selectedEntry = collection.variants[variantIndex];
                        // Pré-remplir les champs de cette section
                        prefillSectionCollectionFields(sectionId, selectedEntry, collection);
                    }
                });
            }

            // Gérer le changement de champ de référence (un seul champ)
            if (referenceFieldSelect) {
                referenceFieldSelect.addEventListener('change', function() {
                    if (this.value && collection && collectionSelect) {
                        const variants = collection.variants || [];
                        collectionSelect.innerHTML = `
                            <option value="">-- Sélectionner --</option>
                            ${variants.map((variant, index) => {
                                const displayValue = variant[this.value] !== undefined && variant[this.value] !== null 
                                    ? String(variant[this.value]) 
                                    : `Élément ${index + 1}`;
                                return `<option value="${variant.id || index}" data-variant-index="${index}">${escapeHtml(displayValue)}</option>`;
                            }).join('')}
                        `;
                        collectionSelect.value = '';
                    }
                });
            }

            // Gérer les cases à cocher pour plusieurs champs de référence
            if (referenceCheckboxes.length > 0) {
                const updateSectionCollectionSelect = () => {
                    if (!collection || !collectionSelect) return;
                    
                    const checkedFields = Array.from(container.querySelectorAll(`.section-reference-field-checkbox[data-section-id="${sectionId}"]:checked`))
                        .map(cb => cb.dataset.fieldName);
                    
                    if (checkedFields.length === 0) {
                        collectionSelect.innerHTML = '<option value="">-- Sélectionner d\'abord un champ de référence --</option>';
                        return;
                    }
                    
                    const variants = collection.variants || [];
                    collectionSelect.innerHTML = `
                        <option value="">-- Sélectionner --</option>
                        ${variants.map((variant, index) => {
                            const displayParts = checkedFields.map(fieldName => {
                                const field = collection.fields.find(f => f.name === fieldName);
                                const value = variant[fieldName];
                                if (value !== undefined && value !== null) {
                                    return `${field?.label || fieldName}: ${value}${field?.unit ? ` ${field.unit}` : ''}`;
                                }
                                return null;
                            }).filter(Boolean);
                            
                            const displayValue = displayParts.length > 0 
                                ? displayParts.join(' - ') 
                                : `Élément ${index + 1}`;
                            
                            return `<option value="${variant.id || index}" data-variant-index="${index}">${escapeHtml(displayValue)}</option>`;
                        }).join('')}
                    `;
                    collectionSelect.value = '';
                };
                
                referenceCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', updateSectionCollectionSelect);
                });
            }
        });
    }

    // Pré-remplir les champs d'une collection de section
    function prefillSectionCollectionFields(sectionId, entry, collectionData) {
        if (!entry || !collectionData) return;

        collectionData.fields.forEach((field, index) => {
            const fieldId = `section_collection_field_${sectionId}_${index}`;
            const fieldElement = document.getElementById(fieldId);
            
            if (fieldElement && entry[field.name] !== undefined) {
                const value = entry[field.name];
                
                if (fieldElement.tagName === 'SELECT') {
                    // Pour les SELECT, mettre la valeur et garder disabled (lecture seule)
                    fieldElement.value = String(value);
                    // Ne pas réactiver - les champs doivent rester en lecture seule
                } else {
                    // Pour les INPUT, mettre la valeur et garder readonly
                    fieldElement.value = value !== null ? String(value) : '';
                    // S'assurer que le champ reste en lecture seule
                    fieldElement.setAttribute('readonly', 'readonly');
                }
            }
        });
    }

    // Pré-remplir le formulaire avec les données de la collection
    function prefillFormFromCollection(entry, collectionData) {
        if (!entry || !collectionData) return;

        collectionData.fields.forEach(field => {
            const value = entry[field.name];
            const input = document.querySelector(`[name="${field.name}"]`);
            if (input) {
                // Réactiver les champs en lecture seule
                input.removeAttribute('readonly');
                input.removeAttribute('disabled');
                
                if (value !== undefined && value !== null) {
                    if (input.tagName === 'SELECT') {
                        input.value = String(value);
                    } else {
                        input.value = value;
                    }
                } else {
                    // Si pas de valeur, laisser vide mais activer le champ
                    if (input.tagName === 'SELECT') {
                        input.value = '';
                    } else {
                        input.value = '';
                    }
                }
            }
        });
    }

    // Générer le formulaire pour une collection
    function generateCollectionForm(collection) {
        const container = document.getElementById('fillFormContainer');
        if (!container || !collection.fields || collection.fields.length === 0) {
            container.innerHTML = '<p class="text-muted">Aucun champ défini dans cette collection.</p>';
            return;
        }

        const fieldsHTML = collection.fields.map((field, index) => {
            const fieldId = `field_${index}`;
            let inputHTML = '';

            switch (field.type) {
                case 'text':
                    inputHTML = `<textarea id="${fieldId}" name="${field.name}" rows="3"></textarea>`;
                    break;
                case 'number':
                    inputHTML = `<input type="number" id="${fieldId}" name="${field.name}" step="any">`;
                    break;
                case 'boolean':
                    inputHTML = `
                        <select id="${fieldId}" name="${field.name}">
                            <option value="">-- Sélectionner --</option>
                            <option value="true">Oui</option>
                            <option value="false">Non</option>
                        </select>
                    `;
                    break;
                case 'image':
                    inputHTML = `<input type="text" id="${fieldId}" name="${field.name}" placeholder="URL de l'image">`;
                    break;
                default:
                    inputHTML = `<input type="text" id="${fieldId}" name="${field.name}">`;
            }

            const unitDisplay = field.unit ? `<span class="field-unit">(${field.unit})</span>` : '';

            return `
                <div class="form-field">
                    <label for="${fieldId}">
                        ${field.name} ${unitDisplay}
                    </label>
                    ${inputHTML}
                </div>
            `;
        }).join('');

        container.innerHTML = fieldsHTML;
    }

    // Sauvegarder les données
    async function saveFilledData() {
        const container = document.getElementById('fillFormContainer');
        const inputs = container.querySelectorAll('input, textarea, select');
        
        // Récupérer le nom du document
        const documentNameInput = document.getElementById('documentName');
        if (!documentNameInput || !documentNameInput.value.trim()) {
            alert('Veuillez saisir un nom pour le document');
            documentNameInput?.focus();
            return;
        }
        const documentName = documentNameInput.value.trim();
        
        const data = {};
        inputs.forEach(input => {
            // Exclure les champs de sélection de collection, de référence et le nom du document
            if (input.id === 'collectionEntrySelect' || input.id === 'referenceFieldSelect' || input.id === 'documentName') {
                return;
            }
            
            // Exclure les cases à cocher de référence (ce sont des contrôles UI, pas des données)
            if (input.type === 'checkbox' && input.classList.contains('reference-field-checkbox')) {
                return;
            }
            
            if (input.value) {
                let value = input.value;
                if (input.type === 'number') {
                    value = parseFloat(value);
                } else if (input.tagName === 'SELECT' && (value === 'true' || value === 'false')) {
                    value = value === 'true';
                }
                data[input.name] = value;
            }
        });

        filledData = data;

        try {
            if (fillType === 'collection') {
                // Pour les collections : ajouter ou modifier l'entrée et sauvegarder
                const container = document.getElementById('fillFormContainer');
                const editingEntryId = container.dataset.editingEntryId;
                
                if (editingEntryId) {
                    // Modifier une entrée existante
                    const entryIndex = collectionEntries.findIndex(e => e.id === editingEntryId);
                    if (entryIndex !== -1) {
                        collectionEntries[entryIndex].data = data;
                        collectionEntries[entryIndex].createdAt = new Date();
                    }
                } else {
                    // Ajouter une nouvelle entrée
                    const entryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    collectionEntries.push({
                        id: entryId,
                        data: data,
                        createdAt: new Date()
                    });
                }
                
                // Sauvegarder les variants en base de données
                await saveCollectionVariants();
                
                // Afficher le tableau mis à jour
                const viewerContainer = document.getElementById('viewerContainer');
                renderCollectionTable(viewerContainer);
                
                // Retourner au viewer (tableau)
                document.getElementById('step2-form').style.display = 'none';
                document.getElementById('step3-viewer').style.display = 'block';
            } else {
                // Pour les canevas : créer un document depuis le template avec les variables remplies
                if (!selectedItem || !selectedItem.namespace) {
                    alert('Erreur : Aucun template sélectionné');
                    return;
                }

                try {
                    // Récupérer les informations de la collection principale si une entrée a été sélectionnée
                    let templateSource = {
                        templateNamespace: selectedItem.namespace,
                        collectionNamespace: null,
                        collectionEntryId: null,
                        sectionCollections: {}, // Collections des sections : { sectionId: { collectionNamespace, collectionEntryId } }
                        variables: data
                    };

                    // Vérifier si une collection principale a été utilisée
                    const collectionSelect = document.getElementById('collectionEntrySelect');
                    if (collectionSelect && collectionSelect.value) {
                        // Une entrée de collection principale a été sélectionnée
                        const selectedOption = collectionSelect.options[collectionSelect.selectedIndex];
                        const variantIndex = parseInt(selectedOption?.dataset.variantIndex);
                        
                        // Récupérer le namespace de la collection depuis le template
                        if (selectedItem.modelNamespace) {
                            templateSource.collectionNamespace = selectedItem.modelNamespace;
                            templateSource.collectionEntryId = collectionSelect.value; // ID de l'entrée sélectionnée
                        }
                    }

                    // Récupérer les collections des sections
                    const sectionCollectionSelects = document.querySelectorAll('.section-collection-entry-select');
                    sectionCollectionSelects.forEach(select => {
                        if (select.value) {
                            const sectionId = select.dataset.sectionId;
                            const collectionNamespace = select.dataset.collectionNamespace;
                            
                            if (sectionId && collectionNamespace) {
                                templateSource.sectionCollections[sectionId] = {
                                    collectionNamespace: collectionNamespace,
                                    collectionEntryId: select.value
                                };
                            }
                        }
                    });

                    // Créer le document depuis le template avec les variables remplies
                    const response = await fetch(`${apiBase}/agent-documentaire/document/from-template`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            templateNamespace: selectedItem.namespace,
                            title: documentName, // Utiliser le nom fourni par l'utilisateur
                            variables: data,
                            templateSource: templateSource
                        })
                    });

                    const payload = await response.json();

                    if (!payload.success) {
                        throw new Error(payload.error || 'Erreur lors de la création du document');
                    }

                    const newDocument = payload.data;
                    const documentId = newDocument._id || newDocument.id;

                    if (!documentId) {
                        throw new Error('Document créé mais ID non trouvé');
                    }

                    // Rediriger vers l'éditeur avec le nouveau document
                    const editorUrl = `<?= url('pages/modules/document-agent/editor.php'); ?>?document=${documentId}`;
                    window.location.href = editorUrl;

                } catch (error) {
                    console.error('Erreur création document:', error);
                    alert(`Erreur lors de la création du document : ${error.message}`);
                }
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    // Afficher le viewer pour les collections sous forme de tableau
    function showCollectionViewer(data) {
        // Ajouter cette entrée à la liste
        const entryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        collectionEntries.push({
            id: entryId,
            data: data,
            createdAt: new Date()
        });

        const viewerContainer = document.getElementById('viewerContainer');
        renderCollectionTable(viewerContainer);

        document.getElementById('step2-form').style.display = 'none';
        document.getElementById('step3-viewer').style.display = 'block';
    }

    // Variables pour le drag and drop des colonnes
    let draggedColumnIndex = null;
    let draggedColumnElement = null;

    // Initialiser le drag and drop pour les colonnes
    function initColumnDragAndDrop(container) {
        const headers = container.querySelectorAll('.draggable-column-header');
        
        headers.forEach(header => {
            // Empêcher le drag sur le bouton de suppression
            const deleteBtn = header.querySelector('.delete-column-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
            }
            
            header.addEventListener('dragstart', handleColumnDragStart);
            header.addEventListener('dragover', handleColumnDragOver);
            header.addEventListener('dragenter', handleColumnDragEnter);
            header.addEventListener('dragleave', handleColumnDragLeave);
            header.addEventListener('drop', handleColumnDrop);
            header.addEventListener('dragend', handleColumnDragEnd);
        });
    }

    // Gestion du début du drag d'une colonne
    function handleColumnDragStart(e) {
        // Empêcher le drag si on clique sur le bouton de suppression
        if (e.target.closest('.delete-column-btn')) {
            e.preventDefault();
            return;
        }
        
        const target = e.target.closest('.draggable-column-header');
        if (!target) return;
        
        draggedColumnElement = target;
        draggedColumnIndex = parseInt(target.dataset.fieldIndex);
        
        target.classList.add('column-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', target.innerHTML);
        
        // Changer le curseur
        document.body.style.cursor = 'grabbing';
    }

    // Gestion du survol lors du drag
    function handleColumnDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const target = e.target.closest('.draggable-column-header');
        if (!target || target === draggedColumnElement) return;
        
        const rect = target.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        const dropPosition = e.clientX < midpoint ? 'before' : 'after';
        
        target.classList.remove('column-drop-before', 'column-drop-after');
        target.classList.add(`column-drop-${dropPosition}`);
    }

    // Gestion de l'entrée dans une zone de drop
    function handleColumnDragEnter(e) {
        e.preventDefault();
        const target = e.target.closest('.draggable-column-header');
        if (target && target !== draggedColumnElement) {
            target.classList.add('column-drag-over');
        }
    }

    // Gestion de la sortie d'une zone de drop
    function handleColumnDragLeave(e) {
        const target = e.target.closest('.draggable-column-header');
        if (target) {
            target.classList.remove('column-drag-over', 'column-drop-before', 'column-drop-after');
        }
    }

    // Gestion du drop d'une colonne
    async function handleColumnDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const target = e.target.closest('.draggable-column-header');
        if (!target || target === draggedColumnElement || draggedColumnIndex === null) {
            cleanupColumnDragClasses();
            return;
        }
        
        const targetIndex = parseInt(target.dataset.fieldIndex);
        if (draggedColumnIndex === targetIndex) {
            cleanupColumnDragClasses();
            return;
        }
        
        // Réorganiser les champs
        const fields = [...selectedItem.fields];
        const draggedField = fields[draggedColumnIndex];
        
        // Retirer le champ de sa position actuelle
        fields.splice(draggedColumnIndex, 1);
        
        // Calculer la nouvelle position
        // Si on déplace vers la droite, l'index cible doit être ajusté (diminué de 1 car on a retiré un élément avant)
        let newIndex = draggedColumnIndex < targetIndex ? targetIndex - 1 : targetIndex;
        
        // Insérer le champ à la nouvelle position
        fields.splice(newIndex, 0, draggedField);
        
        // Mettre à jour selectedItem.fields
        selectedItem.fields = fields;
        
        // Sauvegarder le nouvel ordre en base de données
        try {
            const response = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(selectedItem.namespace)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: fields })
            });
            
            const payload = await response.json();
            
            if (!payload.success) {
                throw new Error(payload.error || 'Erreur lors de la réorganisation');
            }
            
            // Recharger le tableau avec le nouvel ordre
            const viewerContainer = document.getElementById('viewerContainer');
            renderCollectionTable(viewerContainer);
            
        } catch (error) {
            console.error('Erreur lors de la réorganisation des colonnes:', error);
            alert(`Erreur: ${error.message}`);
            // Restaurer l'ordre original en cas d'erreur
            selectedItem.fields = [...fields];
        }
        
        cleanupColumnDragClasses();
    }

    // Gestion de la fin du drag d'une colonne
    function handleColumnDragEnd(e) {
        cleanupColumnDragClasses();
        draggedColumnIndex = null;
        draggedColumnElement = null;
        document.body.style.cursor = '';
    }

    // Nettoyer les classes CSS du drag
    function cleanupColumnDragClasses() {
        const allHeaders = document.querySelectorAll('.draggable-column-header');
        allHeaders.forEach(header => {
            header.classList.remove('column-dragging', 'column-drag-over', 'column-drop-before', 'column-drop-after');
        });
    }

    // Éditer une cellule du tableau
    function editTableCell(cell) {
        const entryId = cell.dataset.entryId;
        const fieldName = cell.dataset.fieldName;
        const fieldType = cell.dataset.fieldType;
        
        // Trouver l'entrée pour récupérer la valeur originale complète
        const entry = collectionEntries.find(e => e.id === entryId);
        if (!entry) return;
        
        const originalValue = entry.data[fieldName];
        const originalValueStr = originalValue !== undefined && originalValue !== null ? String(originalValue) : '';
        
        // Trouver le champ pour connaître son type
        const field = selectedItem.fields.find(f => f.name === fieldName);
        if (!field) return;
        
        // Créer le champ d'édition selon le type
        let input;
        switch (fieldType) {
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.step = 'any';
                input.value = originalValueStr;
                input.style.width = '100%';
                input.style.padding = '0.5rem';
                input.style.border = '2px solid #0066cc';
                input.style.borderRadius = '4px';
                input.style.fontSize = '1rem';
                break;
            case 'boolean':
                input = document.createElement('select');
                input.style.width = '100%';
                input.style.padding = '0.5rem';
                input.style.border = '2px solid #0066cc';
                input.style.borderRadius = '4px';
                input.style.fontSize = '1rem';
                input.innerHTML = `
                    <option value="">-- Sélectionner --</option>
                    <option value="true" ${originalValueStr === 'true' ? 'selected' : ''}>Oui</option>
                    <option value="false" ${originalValueStr === 'false' ? 'selected' : ''}>Non</option>
                `;
                break;
            case 'text':
            default:
                input = document.createElement('input');
                input.type = 'text';
                input.value = originalValueStr;
                input.style.width = '100%';
                input.style.padding = '0.5rem';
                input.style.border = '2px solid #0066cc';
                input.style.borderRadius = '4px';
                input.style.fontSize = '1rem';
                break;
        }
        
        // Sauvegarder la largeur originale de la cellule
        const cellWidth = cell.offsetWidth;
        input.style.minWidth = cellWidth + 'px';
        
        // Remplacer le contenu de la cellule par l'input
        const cellContent = cell.innerHTML;
        cell.innerHTML = '';
        cell.appendChild(input);
        cell.classList.add('cell-editing');
        
        // Focus et sélectionner le contenu
        input.focus();
        if (input.type === 'text' || input.type === 'number') {
            input.select();
        }
        
        // Fonction pour sauvegarder
        const saveValue = async () => {
            let newValue = input.value;
            
            // Convertir selon le type
            if (fieldType === 'number') {
                newValue = newValue !== '' ? parseFloat(newValue) : null;
                if (isNaN(newValue)) {
                    alert('Valeur numérique invalide');
                    input.focus();
                    return;
                }
            } else if (fieldType === 'boolean') {
                if (newValue === '') {
                    newValue = null;
                } else {
                    newValue = newValue === 'true';
                }
            }
            
            // Trouver l'entrée et mettre à jour la valeur
            const entry = collectionEntries.find(e => e.id === entryId);
            if (!entry) return;
            
            // Mettre à jour la valeur dans l'entrée
            if (newValue !== null && newValue !== '') {
                entry.data[fieldName] = newValue;
            } else {
                delete entry.data[fieldName];
            }
            
            // Formater la valeur pour l'affichage
            let displayValue = newValue !== null && newValue !== undefined ? String(newValue) : '-';
            
            // Limiter la longueur pour l'affichage
            if (displayValue.length > 50) {
                displayValue = displayValue.substring(0, 50) + '...';
            }
            
            // Restaurer la cellule avec la nouvelle valeur
            cell.innerHTML = escapeHtml(displayValue);
            cell.dataset.originalValue = newValue !== null && newValue !== undefined ? String(newValue) : '';
            cell.classList.remove('cell-editing');
            
            // Sauvegarder en base de données
            try {
                await saveCollectionVariants();
            } catch (error) {
                console.error('Erreur lors de la sauvegarde:', error);
                alert(`Erreur lors de la sauvegarde: ${error.message}`);
            }
        };
        
        // Fonction pour annuler
        const cancelEdit = () => {
            let displayValue = originalValueStr || '-';
            if (displayValue.length > 50) {
                displayValue = displayValue.substring(0, 50) + '...';
            }
            cell.innerHTML = escapeHtml(displayValue);
            cell.classList.remove('cell-editing');
        };
        
        // Sauvegarder avec Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveValue();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
        
        // Sauvegarder quand on perd le focus
        input.addEventListener('blur', () => {
            // Attendre un peu pour permettre le clic sur un autre élément
            setTimeout(() => {
                if (cell.classList.contains('cell-editing')) {
                    saveValue();
                }
            }, 200);
        });
    }

    // Rendre le tableau des entrées de la collection
    function renderCollectionTable(container) {
        if (!selectedItem || !selectedItem.fields) {
            container.innerHTML = '<p class="text-muted">Collection sans champs définis.</p>';
            return;
        }

        // Si aucune entrée, afficher un message avec le bouton pour créer
        if (collectionEntries.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <h3>Collection "${selectedItem.name}"</h3>
                    <p class="text-muted" style="margin: 2rem 0;">Aucune entrée dans cette collection.</p>
                    <button class="btn btn-primary" id="addFirstEntryBtn">➕ Créer une nouvelle entrée</button>
                </div>
            `;
            
            document.getElementById('addFirstEntryBtn')?.addEventListener('click', function() {
                openCollectionForm();
            });
            return;
        }

        // Créer les en-têtes du tableau à partir des champs
        const headers = selectedItem.fields.map(field => field.name).join('</th><th>');
        
        // Créer les lignes du tableau
        const rows = collectionEntries.map((entry, index) => {
            const cells = selectedItem.fields.map((field, fieldIndex) => {
                const value = entry.data[field.name];
                let displayValue = value !== undefined && value !== null ? String(value) : '-';
                
                // Limiter la longueur pour l'affichage
                if (displayValue.length > 50) {
                    displayValue = displayValue.substring(0, 50) + '...';
                }
                
                return `<td class="editable-cell" data-entry-id="${entry.id}" data-field-name="${escapeHtml(field.name)}" data-field-type="${field.type}" data-original-value="${escapeHtml(value !== undefined && value !== null ? String(value) : '')}" style="cursor: text; position: relative;">${escapeHtml(displayValue)}</td>`;
            }).join('');
            
            return `
                <tr data-entry-id="${entry.id}" style="cursor: pointer;">
                    <td style="text-align: center;">${index + 1}</td>
                    ${cells}
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>Entrées de la collection "${selectedItem.name}"</h3>
                    <button class="btn btn-primary" id="addAnotherEntryBtn">➕ Ajouter une entrée</button>
                </div>
                <div style="overflow-x: auto;">
                    <table class="collection-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="padding: 0.75rem; background: #f5f5f5; border: 1px solid #ddd; text-align: center;">
                                    <button class="btn btn-sm btn-outline" id="addColumnBtn" style="margin: 0; padding: 0.375rem 0.75rem; border: none; background: none; font-size: 1.2rem; cursor: pointer; color: #606163;" title="Ajouter une colonne">➕</button>
                                </th>
                                ${selectedItem.fields.map((field, index) => `<th class="draggable-column-header" draggable="true" data-field-index="${index}" style="padding: 0.75rem; background: #f5f5f5; border: 1px solid #ddd; position: relative; cursor: grab; user-select: none;">
                                    <span style="padding-right: 2rem;">${escapeHtml(field.name)}${field.unit ? ` (${field.unit})` : ''}</span>
                                    <button class="delete-column-btn" data-field-name="${escapeHtml(field.name)}" data-field-index="${index}" draggable="false" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #dc2626; cursor: pointer; font-size: 1.2rem; padding: 0.25rem 0.5rem; line-height: 1; z-index: 5;" title="Supprimer cette colonne">×</button>
                                </th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
                <p style="margin-top: 1rem; color: #666;">
                    Double-cliquez sur une cellule pour la modifier directement. Cliquez sur une ligne pour voir les détails.
                </p>
            </div>
        `;

        // Ajouter les événements pour les boutons
        container.querySelectorAll('.edit-entry-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const entryId = this.dataset.entryId;
                editCollectionEntry(entryId);
            });
        });

        container.querySelectorAll('.delete-entry-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const entryId = this.dataset.entryId;
                deleteCollectionEntry(entryId);
            });
        });

        // Ajouter l'événement pour ajouter une autre entrée
        document.getElementById('addAnotherEntryBtn')?.addEventListener('click', function() {
            openCollectionForm(); // Ouvrir le formulaire pour créer une nouvelle entrée
        });
        
        // Ajouter l'événement pour "Créer une nouvelle entrée" (si collection vide)
        document.getElementById('addFirstEntryBtn')?.addEventListener('click', function() {
            openCollectionForm();
        });
        
        // Ajouter l'événement pour ajouter une colonne
        document.getElementById('addColumnBtn')?.addEventListener('click', function() {
            openAddColumnModal();
        });
        
        // Ajouter les événements pour supprimer une colonne
        container.querySelectorAll('.delete-column-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const fieldName = this.dataset.fieldName;
                const fieldIndex = parseInt(this.dataset.fieldIndex);
                openDeleteColumnModal(fieldName, fieldIndex);
            });
        });
        
        // Ajouter les événements pour le drag and drop des colonnes
        initColumnDragAndDrop(container);

        // Événement de double-clic sur une cellule pour l'éditer
        container.querySelectorAll('tbody .editable-cell').forEach(cell => {
            cell.addEventListener('dblclick', function(e) {
                e.stopPropagation(); // Empêcher le clic sur la ligne
                editTableCell(this);
            });
        });

        // Événement de clic sur une ligne pour voir les détails (sauf si on clique sur une cellule éditable)
        container.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('click', function(e) {
                // Ne pas déclencher si on clique sur une cellule éditable
                if (e.target.closest('.editable-cell')) {
                    return;
                }
                const entryId = this.dataset.entryId;
                if (entryId) {
                    viewCollectionEntry(entryId);
                }
            });
        });
    }

    // Voir les détails d'une entrée
    function viewCollectionEntry(entryId) {
        const entry = collectionEntries.find(e => e.id === entryId);
        if (!entry) return;

        const viewerContainer = document.getElementById('viewerContainer');
        viewerContainer.innerHTML = `
            <div>
                <h3>Détails de l'entrée</h3>
                <div style="background: #f5f5f5; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
                    ${Object.entries(entry.data).map(([key, value]) => {
                        const field = selectedItem.fields.find(f => f.name === key);
                        const unit = field?.unit ? ` ${field.unit}` : '';
                        return `<p><strong>${escapeHtml(key)}${unit}:</strong> ${escapeHtml(String(value))}</p>`;
                    }).join('')}
                </div>
                <div style="margin-top: 1rem;">
                    <h4>JSON de l'entrée</h4>
                    <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; max-height: 300px; overflow-y: auto;">${JSON.stringify(entry.data, null, 2)}</pre>
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                    <button class="btn btn-outline" id="backToTableBtn">← Retour au tableau</button>
                    <button class="btn btn-primary" id="viewSectionBtn" data-entry-id="${entryId}">Voir la section</button>
                </div>
            </div>
        `;

        // Retour au tableau
        document.getElementById('backToTableBtn')?.addEventListener('click', function() {
            renderCollectionTable(viewerContainer);
        });

        // Voir la section (à implémenter)
        document.getElementById('viewSectionBtn')?.addEventListener('click', function() {
            const entryId = this.dataset.entryId;
            // TODO: Implémenter l'affichage de la section correspondante
            alert('Affichage de la section (à implémenter)');
        });
    }

    // Ouvrir le formulaire pour créer/modifier une entrée
    function openCollectionForm(entryToEdit = null) {
        // Générer le formulaire
        generateCollectionForm(selectedItem, entryToEdit);
        
        // Passer à l'étape 2 (formulaire)
        document.getElementById('step3-viewer').style.display = 'none';
        document.getElementById('step2-form').style.display = 'block';
        
        // Stocker l'ID de l'entrée à modifier (si modification)
        if (entryToEdit) {
            document.getElementById('fillFormContainer').dataset.editingEntryId = entryToEdit.id;
        } else {
            delete document.getElementById('fillFormContainer').dataset.editingEntryId;
        }
    }

    // Modifier une entrée existante
    function editCollectionEntry(entryId) {
        const entry = collectionEntries.find(e => e.id === entryId);
        if (!entry) return;
        
        openCollectionForm(entry);
    }

    // Supprimer une entrée
    async function deleteCollectionEntry(entryId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) {
            return;
        }

        collectionEntries = collectionEntries.filter(e => e.id !== entryId);
        
        // Sauvegarder les variants en base de données
        try {
            await saveCollectionVariants();
            const viewerContainer = document.getElementById('viewerContainer');
            renderCollectionTable(viewerContainer);
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            alert(`Erreur lors de la suppression: ${error.message}`);
        }
    }

    // Sauvegarder les variants de la collection en base de données
    async function saveCollectionVariants() {
        if (!selectedItem || !selectedItem.namespace) {
            throw new Error('Aucune collection sélectionnée');
        }

        // Convertir collectionEntries en format variants pour la base de données
        const variants = collectionEntries.map(entry => ({
            id: entry.id,
            ...entry.data,
            createdAt: entry.createdAt
        }));

        const response = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(selectedItem.namespace)}/variants`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ variants })
        });

        const payload = await response.json();

        if (!payload.success) {
            throw new Error(payload.error || 'Erreur lors de la sauvegarde');
        }

        // Mettre à jour selectedItem avec les variants sauvegardés
        selectedItem.variants = payload.data.variants || [];
    }

    // Ouvrir le modal pour ajouter une colonne
    function openAddColumnModal() {
        const modal = document.getElementById('addColumnModal');
        if (!modal) return;
        
        // Réinitialiser le formulaire
        document.getElementById('addColumnForm').reset();
        
        // Afficher le modal
        modal.style.display = 'flex';
    }

    // Fermer le modal pour ajouter une colonne
    function closeAddColumnModal() {
        const modal = document.getElementById('addColumnModal');
        if (!modal) return;
        modal.style.display = 'none';
    }

    // Variables pour la suppression de colonne
    let columnToDelete = null;

    // Ouvrir le modal de suppression de colonne
    function openDeleteColumnModal(fieldName, fieldIndex) {
        columnToDelete = { name: fieldName, index: fieldIndex };
        document.getElementById('deleteColumnName').textContent = fieldName;
        document.getElementById('deleteColumnModal').style.display = 'flex';
    }

    // Fermer le modal de suppression de colonne
    function closeDeleteColumnModal() {
        columnToDelete = null;
        document.getElementById('deleteColumnModal').style.display = 'none';
    }

    // Confirmer la suppression d'une colonne
    async function confirmDeleteColumn() {
        if (!columnToDelete || !selectedItem || !selectedItem.namespace) {
            return;
        }

        try {
            // Supprimer le champ de la liste
            const updatedFields = selectedItem.fields.filter((field, index) => index !== columnToDelete.index);
            
            // Supprimer également les données de cette colonne dans toutes les entrées
            collectionEntries.forEach(entry => {
                if (entry.data[columnToDelete.name] !== undefined) {
                    delete entry.data[columnToDelete.name];
                }
            });
            
            // Sauvegarder le modèle avec les champs mis à jour
            const response = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(selectedItem.namespace)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: updatedFields })
            });
            
            const payload = await response.json();
            
            if (!payload.success) {
                throw new Error(payload.error || 'Erreur lors de la suppression');
            }
            
            // Mettre à jour selectedItem avec les champs mis à jour
            selectedItem.fields = payload.data.fields || [];
            
            // Sauvegarder les variants mis à jour (sans la colonne supprimée)
            await saveCollectionVariants();
            
            // Fermer le modal
            closeDeleteColumnModal();
            
            // Recharger le tableau
            const viewerContainer = document.getElementById('viewerContainer');
            renderCollectionTable(viewerContainer);
            
        } catch (error) {
            console.error('Erreur lors de la suppression de la colonne:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    // Sauvegarder une nouvelle colonne
    async function saveNewColumn() {
        const nameInput = document.getElementById('columnName');
        const typeInput = document.getElementById('columnType');
        const unitInput = document.getElementById('columnUnit');
        
        if (!nameInput || !typeInput) return;
        
        const name = nameInput.value.trim();
        const type = typeInput.value;
        const unit = unitInput ? unitInput.value.trim() : '';
        
        if (!name || !type) {
            alert('Veuillez remplir tous les champs obligatoires');
            return;
        }
        
        if (!selectedItem || !selectedItem.namespace) {
            alert('Aucune collection sélectionnée');
            return;
        }
        
        try {
            // Ajouter le nouveau champ à la liste des champs
            const newField = {
                name: name,
                type: type
            };
            
            // Ajouter l'unité si elle est renseignée
            if (unit) {
                newField.unit = unit;
            }
            
            const updatedFields = [...(selectedItem.fields || []), newField];
            
            // Sauvegarder le modèle avec les nouveaux champs
            const response = await fetch(`${apiBase}/agent-documentaire/models/${encodeURIComponent(selectedItem.namespace)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: updatedFields })
            });
            
            const payload = await response.json();
            
            if (!payload.success) {
                throw new Error(payload.error || 'Erreur lors de la sauvegarde');
            }
            
            // Mettre à jour selectedItem avec les nouveaux champs
            selectedItem.fields = payload.data.fields || [];
            
            // Fermer le modal
            closeAddColumnModal();
            
            // Recharger le tableau
            const viewerContainer = document.getElementById('viewerContainer');
            renderCollectionTable(viewerContainer);
            
        } catch (error) {
            console.error('Erreur lors de l\'ajout de la colonne:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    // Fonction utilitaire pour échapper le HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Réinitialiser le formulaire
    function resetForm() {
        selectedItem = null;
        filledData = null;
        document.getElementById('fillFormContainer').innerHTML = '';
        document.getElementById('step1-select').style.display = 'block';
        document.getElementById('step2-form').style.display = 'none';
        document.getElementById('step3-viewer').style.display = 'none';
        document.querySelectorAll('.item-item').forEach(item => item.classList.remove('selected'));
    }

    // Événements
    document.querySelectorAll('input[name="fillType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            fillType = this.value;
            document.getElementById('canvasListContainer').style.display = fillType === 'canvas' ? 'block' : 'none';
            document.getElementById('collectionListContainer').style.display = fillType === 'collection' ? 'block' : 'none';
            
            // Recharger les listes si nécessaire
            if (fillType === 'canvas') {
                loadCanvases();
            } else {
                loadCollections();
            }
        });
    });

    document.getElementById('backToStep1Btn')?.addEventListener('click', function() {
        document.getElementById('step1-select').style.display = 'block';
        document.getElementById('step2-form').style.display = 'none';
    });

    document.getElementById('backToStep2Btn')?.addEventListener('click', function() {
        document.getElementById('step2-form').style.display = 'block';
        document.getElementById('step3-viewer').style.display = 'none';
    });

    document.getElementById('cancelFillBtn')?.addEventListener('click', resetForm);

    document.getElementById('saveFillBtn')?.addEventListener('click', saveFilledData);

    // Événements pour le modal d'ajout de colonne
    document.getElementById('addColumnModalClose')?.addEventListener('click', closeAddColumnModal);
    document.getElementById('addColumnModalCancel')?.addEventListener('click', closeAddColumnModal);
    document.getElementById('addColumnModalSave')?.addEventListener('click', saveNewColumn);
    
    // Événements pour le modal de suppression de colonne
    document.getElementById('deleteColumnModalClose')?.addEventListener('click', closeDeleteColumnModal);
    document.getElementById('deleteColumnModalCancel')?.addEventListener('click', closeDeleteColumnModal);
    document.getElementById('deleteColumnModalConfirm')?.addEventListener('click', confirmDeleteColumn);

    // Charger les listes au démarrage
    loadCanvases();
})();
</script>

<?php require_once '../../../includes/footer.php'; ?>

