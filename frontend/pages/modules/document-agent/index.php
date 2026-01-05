<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Agent Documentaire';

require_once '../../../includes/header.php';
?>

<section class="hero">
    <div class="container">
            <div class="hero-content">
            <div>
                <h1>Agent Documentaire</h1>
                <p class="hero-description">
                    Centralisez vos modèles de dossiers techniques.
                </p>
            </div>
            <div class="hero-actions">
                <a class="btn btn-outline" href="<?= url('pages/modules/document-agent/models.php'); ?>">⚙️ Gestion des modèles</a>
            </div>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="document-agent-home">
            <div class="home-options">
                <!-- Option 1 : Créer depuis Word -->
                <div class="home-option-card" id="createFromWordCard">
                    <div class="option-icon">📄</div>
                    <h3>Créer depuis Word</h3>
                    <p>Ouvrez le document test Word et créez un modèle à partir de celui-ci</p>
                    <button class="btn btn-primary" id="createFromWordBtn">
                        📄 Ouvrir le document test
                    </button>
                </div>

                <!-- Option 2 : Nouveau modèle -->
                <div class="home-option-card" id="createNewCard">
                    <div class="option-icon">✨</div>
                    <h3>Nouveau modèle</h3>
                    <p>Créez un modèle vierge à partir de zéro</p>
                    <button class="btn btn-primary" id="createNewModelBtn">
                        ➕ Créer un nouveau modèle
                    </button>
                </div>

                <!-- Option 3 : Charger un modèle existant -->
                <div class="home-option-card" id="loadExistingCard">
                    <div class="option-icon">📂</div>
                    <h3>Charger un modèle</h3>
                    <p>Sélectionnez un modèle existant dans la liste</p>
                    <div class="templates-list" id="templatesList">
                        <p class="text-muted">Chargement...</p>
                    </div>
                    <button class="btn btn-outline" id="refreshTemplatesBtn" style="margin-top: 1rem;">
                        🔄 Actualiser
                    </button>
                </div>

                <!-- Option 3.5 : Remplir un document ou une collection -->
                <div class="home-option-card" id="fillDocumentCard">
                    <div class="option-icon">📝</div>
                    <h3>Remplir un document/collection</h3>
                    <p>Remplissez un document à partir d'un canevas ou une collection avec ses valeurs</p>
                    <a href="<?= url('pages/modules/document-agent/fill-document.php'); ?>" class="btn btn-primary">
                        📝 Remplir un document/collection
                    </a>
                </div>

                <!-- Option 4 : Supprimer un modèle existant -->
                <div class="home-option-card" id="deleteModelsCard">
                    <div class="option-icon">🗑️</div>
                    <h3>Supprimer un modèle</h3>
                    <p>Sélectionnez un ou plusieurs modèles à supprimer</p>
                    <div class="templates-list" id="deleteTemplatesList">
                        <p class="text-muted">Chargement...</p>
                    </div>
                    <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center;">
                        <button class="btn btn-outline" id="refreshDeleteTemplatesBtn">
                            🔄 Actualiser
                        </button>
                        <button class="btn btn-danger" id="deleteSelectedTemplatesBtn" style="display: none;">
                            🗑️ Supprimer sélectionnés
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<style>
.document-agent-home {
    max-width: 1200px;
    margin: 0 auto;
}

.home-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-top: 2rem;
}

.home-option-card {
    background: white;
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    text-align: center;
    transition: transform 0.2s, box-shadow 0.2s;
}

.home-option-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.option-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
}

.home-option-card h3 {
    margin: 1rem 0;
    color: var(--color-primary, #606163);
}

.home-option-card p {
    color: #666;
    margin-bottom: 1.5rem;
    min-height: 3rem;
}

.templates-list {
    max-height: 300px;
    overflow-y: auto;
    margin: 1rem 0;
    text-align: left;
}

.template-item {
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
}

.template-item:hover {
    background: #f5f5f5;
}

.template-item-name {
    font-weight: 600;
    color: #333;
}

.template-item-meta {
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.25rem;
}

.template-item.selected {
    background: #e3f2fd;
    border-color: var(--color-primary, #606163);
}

.template-item-checkbox {
    margin-right: 0.5rem;
}

.upload-progress {
    margin: 1rem 0;
}

.progress-bar {
    width: 100%;
    height: 24px;
    background: #e0e0e0;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 1rem;
}

.progress-fill {
    height: 100%;
    background: var(--color-primary, #606163);
    transition: width 0.3s;
}

#uploadStatusText {
    text-align: center;
    color: #666;
}
</style>

<script>
(function() {
    const apiBase = window.API_BASE_URL || '';
    const createFromWordBtn = document.getElementById('createFromWordBtn');
    const createNewModelBtn = document.getElementById('createNewModelBtn');
    const templatesList = document.getElementById('templatesList');
    const refreshTemplatesBtn = document.getElementById('refreshTemplatesBtn');
    const deleteTemplatesList = document.getElementById('deleteTemplatesList');
    const refreshDeleteTemplatesBtn = document.getElementById('refreshDeleteTemplatesBtn');
    const deleteSelectedTemplatesBtn = document.getElementById('deleteSelectedTemplatesBtn');

    // Ouvrir le document test Word
    if (createFromWordBtn) {
        createFromWordBtn.addEventListener('click', function() {
            // Utiliser un documentId spécial pour indiquer qu'on veut créer un nouveau document depuis Word
            const documentId = 'new-from-word';
            window.location.href = `<?= url('pages/modules/document-agent/editor.php'); ?>?document=${documentId}`;
        });
    }


    // Créer un nouveau modèle vierge
    if (createNewModelBtn) {
        createNewModelBtn.addEventListener('click', async function() {
            if (!confirm('Créer un nouveau modèle vierge ?')) {
                return;
            }

            try {
                // Créer un document vide
                const response = await fetch(`${apiBase}/agent-documentaire/document/new`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: 'Nouveau modèle'
                    })
                });

                const payload = await response.json();
                
                if (!payload.success) {
                    throw new Error(payload.error || 'Erreur lors de la création');
                }

                const documentId = payload.data._id || payload.data.documentId;
                
                // Rediriger vers l'éditeur
                window.location.href = `<?= url('pages/modules/document-agent/editor.php'); ?>?document=${documentId}`;

            } catch (error) {
                console.error('Erreur création modèle:', error);
                alert(`Erreur: ${error.message}`);
            }
        });
    }

    // Charger la liste des templates
    async function loadTemplates() {
        if (!templatesList) return;

        templatesList.innerHTML = '<p class="text-muted">Chargement...</p>';

        try {
            const response = await fetch(`${apiBase}/agent-documentaire/templates`);
            const payload = await response.json();
            
            if (!payload.success) {
                throw new Error(payload.error || 'Erreur lors du chargement');
            }

            const templates = payload.data || [];
            
            if (templates.length === 0) {
                templatesList.innerHTML = '<p class="text-muted">Aucun template disponible</p>';
                return;
            }

            // Filtrer les templates document (sans ':' dans le namespace)
            const documentTemplates = templates.filter(t => !t.namespace.includes(':'));

            if (documentTemplates.length === 0) {
                templatesList.innerHTML = '<p class="text-muted">Aucun template document disponible</p>';
                return;
            }

            templatesList.innerHTML = documentTemplates.map(template => `
                <div class="template-item" data-namespace="${template.namespace}">
                    <div class="template-item-name">${template.name || template.namespace}</div>
                    <div class="template-item-meta">
                        Créé le ${new Date(template.metadata?.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                </div>
            `).join('');

            // Ajouter les événements de clic
            templatesList.querySelectorAll('.template-item').forEach(item => {
                item.addEventListener('click', async function(e) {
                    // Ne pas déclencher si on clique sur le texte (pour éviter les conflits avec d'autres éléments)
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') {
                        return;
                    }

                    const namespace = this.dataset.namespace;
                    const templateName = this.querySelector('.template-item-name')?.textContent || namespace;
                    
                    // Créer un nouveau document depuis le template
                    try {
                        const response = await fetch(`${apiBase}/agent-documentaire/document/from-template`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                templateNamespace: namespace,
                                title: `${templateName} - Nouveau document`
                            })
                        });

                        const payload = await response.json();
                        
                        if (!payload.success) {
                            throw new Error(payload.error || 'Erreur lors de la création du document');
                        }

                        const documentId = payload.data._id || payload.data.documentId;
                        
                        // Rediriger vers l'éditeur
                        window.location.href = `<?= url('pages/modules/document-agent/editor.php'); ?>?document=${documentId}`;

                    } catch (error) {
                        console.error('Erreur chargement template:', error);
                        alert(`Erreur: ${error.message}`);
                    }
                });
            });

        } catch (error) {
            console.error('Erreur chargement templates:', error);
            templatesList.innerHTML = '<p class="text-danger">Erreur lors du chargement</p>';
        }
    }

    // Bouton actualiser
    if (refreshTemplatesBtn) {
        refreshTemplatesBtn.addEventListener('click', loadTemplates);
    }

    // Charger les templates au démarrage
    loadTemplates();

    // ===================================
    // GESTION SUPPRESSION TEMPLATES
    // ===================================

    let selectedTemplatesForDelete = new Set();

    // Charger la liste des templates pour suppression
    async function loadDeleteTemplates() {
        if (!deleteTemplatesList) return;

        deleteTemplatesList.innerHTML = '<p class="text-muted">Chargement...</p>';
        selectedTemplatesForDelete.clear();
        deleteSelectedTemplatesBtn.style.display = 'none';

        try {
            const response = await fetch(`${apiBase}/agent-documentaire/templates`);
            const payload = await response.json();
            
            if (!payload.success) {
                throw new Error(payload.error || 'Erreur lors du chargement');
            }

            const templates = payload.data || [];
            
            if (templates.length === 0) {
                deleteTemplatesList.innerHTML = '<p class="text-muted">Aucun template disponible</p>';
                return;
            }

            // Filtrer les templates document (sans ':' dans le namespace)
            const documentTemplates = templates.filter(t => !t.namespace.includes(':'));

            if (documentTemplates.length === 0) {
                deleteTemplatesList.innerHTML = '<p class="text-muted">Aucun template document disponible</p>';
                return;
            }

            deleteTemplatesList.innerHTML = documentTemplates.map(template => `
                <div class="template-item" data-namespace="${template.namespace}">
                    <label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
                        <input type="checkbox" class="template-item-checkbox" data-namespace="${template.namespace}" style="cursor: pointer;">
                        <div style="flex: 1;">
                            <div class="template-item-name">${template.name || template.namespace}</div>
                            <div class="template-item-meta">
                                Créé le ${new Date(template.metadata?.createdAt).toLocaleDateString('fr-FR')}
                            </div>
                        </div>
                    </label>
                </div>
            `).join('');

            // Ajouter les événements de checkbox
            deleteTemplatesList.querySelectorAll('.template-item-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    const namespace = this.dataset.namespace;
                    const item = this.closest('.template-item');
                    
                    if (this.checked) {
                        selectedTemplatesForDelete.add(namespace);
                        item.classList.add('selected');
                    } else {
                        selectedTemplatesForDelete.delete(namespace);
                        item.classList.remove('selected');
                    }
                    
                    // Afficher/masquer le bouton de suppression
                    if (selectedTemplatesForDelete.size > 0) {
                        deleteSelectedTemplatesBtn.style.display = 'inline-block';
                    } else {
                        deleteSelectedTemplatesBtn.style.display = 'none';
                    }
                });
            });

        } catch (error) {
            console.error('Erreur chargement templates:', error);
            deleteTemplatesList.innerHTML = '<p class="text-danger">Erreur lors du chargement</p>';
        }
    }

    // Bouton actualiser pour suppression
    if (refreshDeleteTemplatesBtn) {
        refreshDeleteTemplatesBtn.addEventListener('click', loadDeleteTemplates);
    }

    // Bouton supprimer sélectionnés
    if (deleteSelectedTemplatesBtn) {
        deleteSelectedTemplatesBtn.addEventListener('click', async function() {
            const count = selectedTemplatesForDelete.size;
            
            if (count === 0) {
                alert('Aucun template sélectionné');
                return;
            }

            if (!confirm(`Êtes-vous sûr de vouloir supprimer ${count} modèle(s) ?\n\nCette action est irréversible.`)) {
                return;
            }

            this.disabled = true;
            this.textContent = 'Suppression...';

            try {
                const namespaces = Array.from(selectedTemplatesForDelete);
                let successCount = 0;
                let errorCount = 0;

                // Supprimer chaque template
                for (const namespace of namespaces) {
                    try {
                        const response = await fetch(`${apiBase}/agent-documentaire/templates/${namespace}`, {
                            method: 'DELETE'
                        });

                        const payload = await response.json();
                        
                        if (payload.success) {
                            successCount++;
                        } else {
                            errorCount++;
                            console.error(`Erreur suppression ${namespace}:`, payload.error);
                        }
                    } catch (error) {
                        errorCount++;
                        console.error(`Erreur suppression ${namespace}:`, error);
                    }
                }

                // Afficher le résultat
                if (errorCount === 0) {
                    alert(`✅ ${successCount} modèle(s) supprimé(s) avec succès`);
                } else {
                    alert(`⚠️ ${successCount} modèle(s) supprimé(s), ${errorCount} erreur(s)`);
                }

                // Recharger la liste
                await loadDeleteTemplates();
                
                // Recharger aussi la liste de chargement
                await loadTemplates();

            } catch (error) {
                console.error('Erreur suppression templates:', error);
                alert(`Erreur: ${error.message}`);
            } finally {
                this.disabled = false;
                this.textContent = '🗑️ Supprimer sélectionnés';
            }
        });
    }

    // Charger les templates pour suppression au démarrage
    loadDeleteTemplates();
})();
</script>

<?php require_once '../../../includes/footer.php'; ?>
