<?php
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
                    <div class="doc-panel__header">
                        <h3>Sommaire</h3>
                    </div>
                    <div class="doc-panel__body doc-panel__body--compact">
                        <div class="sommaire-list" data-sommaire-list>
                            <p class="text-muted">Chargement...</p>
                        </div>
                    </div>
                    
                    <div class="doc-panel__separator"></div>
                    
                    <div class="doc-panel__header">
                        <h3>Annexes</h3>
                    </div>
                    <div class="doc-panel__body doc-panel__body--compact">
                        <div class="annexes-list" data-annexes-list>
                            <p class="text-muted">Aucune annexe</p>
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

<?php require_once '../../../includes/footer.php'; ?>
