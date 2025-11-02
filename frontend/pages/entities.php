<?php
/**
 * Gestion des Entités - Admin GDRI
 * Fichier : pages/entities.php
 * 
 * Permet de gérer les entreprises/entités clientes et leurs utilisateurs
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';

// Seul ADMIN_GDRI peut accéder
if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Gestion des Entités';

require_once '../includes/header.php';

// Récupérer toutes les entités
$db = getDatabase();
$entitiesCollection = $db->entities;
$entities = $entitiesCollection->find([])->toArray();

// Récupérer tous les services/modules disponibles
$servicesCollection = $db->services;
$services = $servicesCollection->find([])->toArray();

// Récupérer tous les utilisateurs
$usersCollection = $db->users;
$allUsers = $usersCollection->find([])->toArray();

// Mapper les utilisateurs par entité pour l'affichage
$usersByEntity = [];
foreach ($allUsers as $user) {
    if ($user['entity_id']) {
        $entityId = (string) $user['entity_id'];
        if (!isset($usersByEntity[$entityId])) {
            $usersByEntity[$entityId] = [];
        }
        $usersByEntity[$entityId][] = $user;
    }
}
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Gestion des Entités</h1>
            <p class="hero-description">
                Gérez les entreprises clientes et leurs accès aux modules IA
            </p>
        </div>
    </div>
</section>

<!-- Tabs Navigation -->
<section class="section">
    <div class="container">
        <div class="tabs-nav">
            <button class="tab-btn active" data-tab="entities-tab">Entités</button>
            <button class="tab-btn" data-tab="users-tab">Utilisateurs</button>
        </div>
    </div>
</section>

<!-- Section Liste des Entités -->
<section class="section">
    <div class="container">
        <div class="tab-content active" id="entities-tab">
            <div class="section-title">
                <h2>Liste des Entités</h2>
                <button class="btn btn-primary" id="addEntityBtn">+ Ajouter une entité</button>
            </div>
        
        <div class="entities-grid" id="entitiesGrid">
            <?php if (empty($entities)): ?>
                <div class="empty-state">
                    <p>Aucune entité enregistrée pour le moment.</p>
                </div>
            <?php else: ?>
                <?php foreach ($entities as $entity): ?>
                    <div class="entity-card" data-entity-id="<?= htmlspecialchars((string) $entity['_id']) ?>">
                        <div class="entity-header">
                            <h3><?= htmlspecialchars($entity['name']) ?></h3>
                            <div class="entity-actions">
                                <button class="btn-icon edit-entity" data-entity-id="<?= htmlspecialchars((string) $entity['_id']) ?>" title="Modifier">
                                    ✏️
                                </button>
                                <button class="btn-icon toggle-entity" data-entity-id="<?= htmlspecialchars((string) $entity['_id']) ?>" title="<?= $entity['status'] === 'active' ? 'Désactiver' : 'Activer' ?>">
                                    <?= $entity['status'] === 'active' ? '✅' : '❌' ?>
                                </button>
                            </div>
                        </div>
                        
                        <div class="entity-details">
                            <p><strong>SIRET :</strong> <?= htmlspecialchars($entity['siret']) ?></p>
                            <p><strong>Adresse :</strong> <?= htmlspecialchars($entity['address']) ?></p>
                            <p><strong>Statut :</strong> 
                                <span class="badge <?= $entity['status'] === 'active' ? 'badge-success' : 'badge-warning' ?>">
                                    <?= $entity['status'] === 'active' ? 'Actif' : 'Inactif' ?>
                                </span>
                            </p>
                        </div>
                        
                        <!-- Modules autorisés -->
                        <div class="entity-modules">
                            <h4>Modules autorisés :</h4>
                            <?php if (empty($entity['services_authorized'])): ?>
                                <p class="text-muted">Aucun module autorisé</p>
                            <?php else: ?>
                                <div class="modules-list">
                                    <?php foreach ($entity['services_authorized'] as $serviceId): ?>
                                        <?php 
                                        $service = array_filter($services, function($s) use ($serviceId) {
                                            return (string) $s['_id'] === (string) $serviceId;
                                        });
                                        $service = reset($service);
                                        ?>
                                        <?php if ($service): ?>
                                            <span class="module-badge"><?= htmlspecialchars($service['icon']) ?> <?= htmlspecialchars($service['name']) ?></span>
                                        <?php endif; ?>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                            <button class="btn btn-sm btn-outline manage-modules" data-entity-id="<?= htmlspecialchars((string) $entity['_id']) ?>">
                                Gérer les modules
                            </button>
                        </div>
                        
                        <!-- Utilisateurs de l'entité -->
                        <div class="entity-users">
                            <h4>Utilisateurs :</h4>
                            <?php 
                            $entityUsers = $usersByEntity[(string) $entity['_id']] ?? [];
                            ?>
                            <?php if (empty($entityUsers)): ?>
                                <p class="text-muted">Aucun utilisateur</p>
                            <?php else: ?>
                                <ul class="users-list">
                                    <?php foreach ($entityUsers as $user): ?>
                                        <li>
                                            <?= htmlspecialchars($user['email']) ?>
                                            <span class="badge badge-info">
                                                <?= htmlspecialchars($user['role']) ?>
                                            </span>
                                        </li>
                                    <?php endforeach; ?>
                                </ul>
                            <?php endif; ?>
                            <button class="btn btn-sm btn-outline add-user" data-entity-id="<?= htmlspecialchars((string) $entity['_id']) ?>">
                                + Ajouter un utilisateur
                            </button>
                        </div>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
        </div>
        
        <!-- Section Liste des Utilisateurs -->
        <div class="tab-content" id="users-tab">
            <div class="section-title">
                <h2>Liste des Utilisateurs</h2>
                <button class="btn btn-primary" id="addUserBtn">+ Ajouter un utilisateur</button>
            </div>
            
            <div class="users-grid" id="usersGrid">
                <?php if (empty($allUsers)): ?>
                    <div class="empty-state">
                        <p>Aucun utilisateur enregistré.</p>
                    </div>
                <?php else: ?>
                    <?php foreach ($allUsers as $user): ?>
                        <?php if ($user['role'] === 'ADMIN_GDRI') continue; ?>
                        <div class="user-card">
                            <div class="user-header">
                                <h3><?= htmlspecialchars($user['email']) ?></h3>
                                <div class="user-actions">
                                    <button class="btn-icon toggle-user" data-user-id="<?= htmlspecialchars((string) $user['_id']) ?>" title="<?= $user['status'] === 'active' ? 'Désactiver' : 'Activer' ?>">
                                        <?= $user['status'] === 'active' ? '✅' : '❌' ?>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="user-details">
                                <p><strong>Rôle :</strong> 
                                    <span class="badge badge-info">
                                        <?= htmlspecialchars($user['role']) ?>
                                    </span>
                                </p>
                                <p><strong>Statut :</strong> 
                                    <span class="badge <?= $user['status'] === 'active' ? 'badge-success' : 'badge-warning' ?>">
                                        <?= $user['status'] === 'active' ? 'Actif' : 'Inactif' ?>
                                    </span>
                                </p>
                                <?php if ($user['entity_id']): ?>
                                    <?php 
                                    $userEntity = array_filter($entities, function($e) use ($user) {
                                        return (string) $e['_id'] === (string) $user['entity_id'];
                                    });
                                    $userEntity = reset($userEntity);
                                    ?>
                                    <?php if ($userEntity): ?>
                                        <p><strong>Entité :</strong> <?= htmlspecialchars($userEntity['name']) ?></p>
                                    <?php endif; ?>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
    </div>
</section>

<!-- Modal Ajouter/Modifier Entité -->
<div class="modal-overlay" id="entityModal">
    <div class="modal-content modal-medium">
        <button class="modal-close" id="closeEntityModal">×</button>
        
        <div class="modal-header">
            <h2 id="modalTitle">Ajouter une entité</h2>
        </div>
        
        <div class="modal-body modal-scrollable">
            <form id="entityForm">
                <input type="hidden" id="entityId" name="entityId">
                
                <div class="form-group">
                    <label for="entityName">Nom de l'entreprise *</label>
                    <input type="text" id="entityName" name="name" required>
                </div>
                
                <div class="form-group">
                    <label for="entitySiret">SIRET *</label>
                    <input type="text" id="entitySiret" name="siret" required pattern="[0-9]{9,14}">
                </div>
                
                <div class="form-group">
                    <label for="entityAddress">Adresse *</label>
                    <textarea id="entityAddress" name="address" rows="3" required></textarea>
                </div>
                
                <div class="form-group">
                    <label for="modulesSelect">Modules autorisés</label>
                    <div class="custom-select-wrapper">
                        <div class="custom-select" id="modulesSelect">
                            <div class="select-trigger">
                                <span class="select-placeholder">Rechercher et sélectionner des modules...</span>
                                <span class="select-arrow">▼</span>
                            </div>
                            <div class="select-dropdown">
                                <input type="text" class="select-search" placeholder="Rechercher un module..." id="moduleSearch">
                                <div class="select-options" id="moduleOptions">
                                    <?php foreach ($services as $service): ?>
                                        <div class="select-option" data-value="<?= htmlspecialchars((string) $service['_id']) ?>">
                                            <span><?= htmlspecialchars($service['icon']) ?> <?= htmlspecialchars($service['name']) ?></span>
                                            <span class="select-check">✓</span>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        </div>
                        <div class="selected-modules" id="selectedModules"></div>
                    </div>
                </div>
                
                <div class="form-error" id="formError"></div>
                <div class="form-success" id="formSuccess"></div>
                
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" id="cancelEntityForm">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Modal Ajouter Utilisateur -->
<div class="modal-overlay" id="userModal">
    <div class="modal-content">
        <button class="modal-close" id="closeUserModal">×</button>
        
        <div class="modal-header">
            <h2>Ajouter un utilisateur</h2>
        </div>
        
        <div class="modal-body">
            <form id="userForm">
                <div class="form-group">
                    <label for="userEntity">Entité *</label>
                    <select id="userEntity" name="entityId" required>
                        <option value="">Sélectionner une entité</option>
                        <?php foreach ($entities as $entity): ?>
                            <option value="<?= htmlspecialchars((string) $entity['_id']) ?>">
                                <?= htmlspecialchars($entity['name']) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="userEmail">Email *</label>
                    <input type="email" id="userEmail" name="email" required>
                </div>
                
                <div class="form-group">
                    <label for="userPassword">Mot de passe *</label>
                    <input type="password" id="userPassword" name="password" required minlength="6">
                </div>
                
                <div class="form-group">
                    <label for="userRole">Rôle *</label>
                    <select id="userRole" name="role" required>
                        <option value="ADMIN_ENTITY">Administrateur d'Entité</option>
                        <option value="USER_ENTITY">Utilisateur</option>
                    </select>
                </div>
                
                <div class="form-error" id="userFormError"></div>
                <div class="form-success" id="userFormSuccess"></div>
                
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" id="cancelUserForm">Annuler</button>
                    <button type="submit" class="btn btn-primary">Créer</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Style spécifique pour cette page -->
<style>
.entities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var(--spacing-lg);
    margin-top: var(--spacing-lg);
}

.entity-card {
    background: white;
    border-radius: 8px;
    padding: var(--spacing-lg);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 1px solid var(--color-light);
}

.entity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--color-light);
}

.entity-header h3 {
    margin: 0;
    color: var(--color-primary);
}

.entity-actions {
    display: flex;
    gap: var(--spacing-sm);
}

.btn-icon {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background 0.2s;
}

.btn-icon:hover {
    background: var(--color-light);
}

.entity-details p {
    margin: var(--spacing-sm) 0;
    color: var(--color-gray);
}

.badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
}

.badge-success {
    background: #d4edda;
    color: #155724;
}

.badge-warning {
    background: #fff3cd;
    color: #856404;
}

.badge-info {
    background: #d1ecf1;
    color: #0c5460;
}

.entity-modules,
.entity-users {
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-light);
}

.entity-modules h4,
.entity-users h4 {
    font-size: 0.9rem;
    margin-bottom: var(--spacing-sm);
    color: var(--color-gray);
}

.modules-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-sm);
}

.module-badge {
    display: inline-block;
    padding: 4px 8px;
    background: var(--color-light);
    border-radius: 4px;
    font-size: 0.85rem;
}

.users-list {
    list-style: none;
    padding: 0;
    margin: var(--spacing-sm) 0;
}

.users-list li {
    padding: var(--spacing-xs) 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.text-muted {
    color: #999;
    font-style: italic;
}

.modal-medium {
    max-width: 500px;
}

.modal-scrollable {
    max-height: 60vh;
    overflow-y: auto;
    padding-right: var(--spacing-sm);
}

/* Custom Select with Search */
.custom-select-wrapper {
    position: relative;
    margin-bottom: var(--spacing-md);
}

.custom-select {
    position: relative;
}

.select-trigger {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    border: 1px solid var(--color-light);
    border-radius: 4px;
    cursor: pointer;
    background: white;
    transition: border-color 0.2s;
}

.select-trigger:hover {
    border-color: var(--color-primary);
}

.select-placeholder {
    color: #999;
}

.select-arrow {
    transition: transform 0.2s;
}

.custom-select.active .select-arrow {
    transform: rotate(180deg);
}

.select-dropdown {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--color-light);
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 1000;
    margin-top: 4px;
}

.custom-select.active .select-dropdown {
    display: block;
}

.select-search {
    width: 100%;
    padding: var(--spacing-md);
    border: none;
    border-bottom: 1px solid var(--color-light);
    border-radius: 4px 4px 0 0;
    outline: none;
}

.select-options {
    max-height: 200px;
    overflow-y: auto;
}

.select-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    cursor: pointer;
    transition: background 0.2s;
    border-bottom: 1px solid var(--color-light);
}

.select-option:last-child {
    border-bottom: none;
}

.select-option:hover {
    background: var(--color-light);
}

.select-option.selected {
    background: #e6f3ff;
}

.select-option.selected .select-check {
    display: inline;
}

.select-check {
    display: none;
    color: var(--color-primary);
    font-weight: bold;
}

.select-option.hidden {
    display: none;
}

.selected-modules {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-sm);
}

.selected-module-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 4px 8px;
    background: var(--color-light);
    border-radius: 12px;
    font-size: 0.85rem;
}

.selected-module-tag .remove-module {
    cursor: pointer;
    color: #999;
    font-weight: bold;
}

.selected-module-tag .remove-module:hover {
    color: #dc3545;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    margin-top: var(--spacing-lg);
}

.section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-gray);
}

/* Tabs Styles */
.tabs-nav {
    display: flex;
    gap: var(--spacing-md);
    border-bottom: 2px solid var(--color-light);
    margin-bottom: var(--spacing-lg);
}

.tab-btn {
    background: none;
    border: none;
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 1rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    color: var(--color-gray);
    transition: all 0.2s;
}

.tab-btn:hover {
    color: var(--color-primary);
}

.tab-btn.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
    font-weight: 600;
}

.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
}

.users-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--spacing-lg);
    margin-top: var(--spacing-lg);
}

.user-card {
    background: white;
    border-radius: 8px;
    padding: var(--spacing-lg);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 1px solid var(--color-light);
}

.user-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--color-light);
}

.user-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--color-primary);
}

.user-actions {
    display: flex;
    gap: var(--spacing-sm);
}

.user-details p {
    margin: var(--spacing-sm) 0;
    color: var(--color-gray);
}
</style>

<script>
// Scripts de gestion des entités
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page entités chargée');
    
    // Gestion des tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Désactiver tous les tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Activer le tab cliqué
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
    
    // Gestion des modals
    const openModal = (modalId) => {
        document.getElementById(modalId).style.display = 'flex';
    };
    
    const closeModal = (modalId) => {
        document.getElementById(modalId).style.display = 'none';
    };
    
    // Ouvrir modal entité
    document.getElementById('addEntityBtn').addEventListener('click', () => openModal('entityModal'));
    document.getElementById('closeEntityModal').addEventListener('click', () => closeModal('entityModal'));
    document.getElementById('cancelEntityForm').addEventListener('click', () => closeModal('entityModal'));
    
    // Ouvrir modal utilisateur
    document.getElementById('addUserBtn').addEventListener('click', () => openModal('userModal'));
    document.getElementById('closeUserModal').addEventListener('click', () => closeModal('userModal'));
    document.getElementById('cancelUserForm').addEventListener('click', () => closeModal('userModal'));
    
    // Fermer les modals en cliquant en dehors
    document.getElementById('entityModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('entityModal');
    });
    document.getElementById('userModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('userModal');
    });
    
    // Custom Select avec recherche pour les modules
    const modulesSelect = document.getElementById('modulesSelect');
    const selectTrigger = modulesSelect.querySelector('.select-trigger');
    const selectDropdown = modulesSelect.querySelector('.select-dropdown');
    const selectSearch = document.getElementById('moduleSearch');
    const selectOptions = document.querySelectorAll('.select-option');
    const selectedModulesDiv = document.getElementById('selectedModules');
    let selectedModules = [];
    
    // Ouvrir/fermer le dropdown
    selectTrigger.addEventListener('click', function(e) {
        e.stopPropagation();
        modulesSelect.classList.toggle('active');
        if (modulesSelect.classList.contains('active')) {
            selectSearch.focus();
        }
    });
    
    // Recherche dans les options
    selectSearch.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        selectOptions.forEach(option => {
            const text = option.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                option.classList.remove('hidden');
            } else {
                option.classList.add('hidden');
            }
        });
    });
    
    // Sélectionner une option
    selectOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            const value = this.getAttribute('data-value');
            const text = this.querySelector('span').textContent.trim();
            
            // Toggle sélection
            if (this.classList.contains('selected')) {
                // Désélectionner
                this.classList.remove('selected');
                selectedModules = selectedModules.filter(m => m.value !== value);
            } else {
                // Sélectionner
                this.classList.add('selected');
                selectedModules.push({ value, text });
            }
            
            updateSelectedModules();
        });
    });
    
    // Mettre à jour l'affichage des modules sélectionnés
    function updateSelectedModules() {
        selectedModulesDiv.innerHTML = '';
        if (selectedModules.length > 0) {
            selectedModules.forEach(module => {
                const tag = document.createElement('div');
                tag.className = 'selected-module-tag';
                tag.innerHTML = `
                    <span>${module.text}</span>
                    <span class="remove-module" data-value="${module.value}">×</span>
                `;
                selectedModulesDiv.appendChild(tag);
                
                // Retirer un module
                tag.querySelector('.remove-module').addEventListener('click', function() {
                    const valueToRemove = this.getAttribute('data-value');
                    selectedModules = selectedModules.filter(m => m.value !== valueToRemove);
                    selectOptions.forEach(opt => {
                        if (opt.getAttribute('data-value') === valueToRemove) {
                            opt.classList.remove('selected');
                        }
                    });
                    updateSelectedModules();
                });
            });
        }
    }
    
    // Fermer le dropdown en cliquant en dehors
    document.addEventListener('click', function(e) {
        if (!modulesSelect.contains(e.target)) {
            modulesSelect.classList.remove('active');
        }
    });
});
</script>

<?php require_once '../includes/footer.php'; ?>

