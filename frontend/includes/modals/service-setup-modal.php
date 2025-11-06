<?php
/**
 * Modal de configuration des services - Avec onglets
 * Fichier : includes/modals/service-setup-modal.php
 * 
 * Affiche un modal avec onglets pour configurer tous les services nécessitant une configuration
 */
?>

<!-- Modal Overlay -->
<div id="serviceSetupModal" class="modal-overlay" style="display: none;">
    <div class="modal modal-large">
        <div class="modal-header">
            <h2 class="modal-title">Configuration des services</h2>
            <button class="modal-close" id="closeServiceSetupModal">&times;</button>
        </div>

        <div class="modal-body">
            <p class="modal-description">
                Certains services nécessitent une configuration initiale pour fonctionner correctement.
                Configurez-les maintenant ou plus tard.
            </p>

            <!-- Onglets -->
            <div class="tabs-container" id="serviceTabsContainer">
                <div class="tabs-header" id="serviceTabsHeader">
                    <!-- Les onglets seront générés dynamiquement ici -->
                </div>

                <div class="tabs-content" id="serviceTabsContent">
                    <!-- Le contenu des onglets sera généré dynamiquement ici -->
                </div>
            </div>

            <!-- Message si aucun service à configurer -->
            <div id="noServicesMessage" class="empty-state" style="display: none;">
                <p>Tous les services sont configurés ! 🎉</p>
            </div>
        </div>

        <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="configureLaterBtn">
                Configurer plus tard
            </button>
            <button type="button" class="btn btn-primary" id="saveAllConfigsBtn" style="display: none;">
                Sauvegarder toutes les configurations
            </button>
        </div>
    </div>
</div>

<style>
.modal-large {
    max-width: 900px;
    width: 95%;
}

.modal-description {
    color: var(--color-gray);
    margin-bottom: var(--spacing-lg);
    font-size: 0.95rem;
}

.tabs-container {
    margin-top: var(--spacing-md);
}

.tabs-header {
    display: flex;
    gap: var(--spacing-xs);
    border-bottom: 2px solid var(--color-light);
    margin-bottom: var(--spacing-lg);
    overflow-x: auto;
}

.tab-button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-size: 0.95rem;
    color: var(--color-gray);
    white-space: nowrap;
    transition: all var(--transition-fast);
    position: relative;
}

.tab-button:hover {
    color: var(--color-primary);
    background: var(--color-light);
}

.tab-button.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
    font-weight: 600;
}

.tabs-content {
    min-height: 400px;
}

.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
    animation: fadeIn 0.3s ease;
}

.service-config-form {
    padding: var(--spacing-md);
}

.service-config-form .form-group {
    margin-bottom: var(--spacing-md);
}

.service-config-form label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 600;
    color: var(--color-dark);
}

.service-config-form .form-control {
    width: 100%;
    padding: var(--spacing-sm);
    border: 1px solid var(--color-light);
    border-radius: 4px;
    font-size: 1rem;
}

.service-config-form .form-control:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(158, 219, 235, 0.2);
}

.service-config-form .form-text {
    display: block;
    margin-top: var(--spacing-xs);
    font-size: 0.85rem;
    color: var(--color-gray);
}

.service-config-form .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
}

@media (max-width: 768px) {
    .service-config-form .form-row {
        grid-template-columns: 1fr;
    }
    
    .modal-large {
        width: 98%;
        max-width: none;
    }
}

.empty-state {
    text-align: center;
    padding: var(--spacing-xxl);
    color: var(--color-gray);
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Styles pour les intentions */
.intentions-list {
    margin-bottom: var(--spacing-md);
    max-height: 400px;
    overflow-y: auto;
}

.intention-item {
    background: var(--color-light);
    border-radius: 4px;
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-sm);
    border: 1px solid #ddd;
}

.intention-item-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
}

.intention-item .form-row {
    margin-bottom: 0;
}

.intention-item .form-group {
    margin-bottom: var(--spacing-sm);
}

.service-config-form code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
    color: var(--color-primary);
}

.btn-sm {
    padding: 4px 12px;
    font-size: 0.85rem;
}

.btn-block {
    width: 100%;
}

/* Styles pour les profils SMTP */
.smtp-profiles-list {
    margin-bottom: var(--spacing-md);
    max-height: 500px;
    overflow-y: auto;
}

.smtp-profile-item {
    background: var(--color-light);
    border-radius: 4px;
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-md);
    border: 1px solid #ddd;
}

.smtp-profile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid #ddd;
}

.smtp-profile-header h4 {
    margin: 0;
    font-size: 1rem;
    color: var(--color-primary);
}

.smtp-profile-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
}

.alert {
    padding: var(--spacing-sm);
    border-radius: 4px;
    margin-top: var(--spacing-sm);
}

.alert-info {
    background: #e7f3ff;
    color: #0066cc;
    border: 1px solid #b3d9ff;
}
</style>

