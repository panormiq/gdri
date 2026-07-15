<?php
/**
 * Gestion des Entités - Admin GDRI
 * Fichier : pages/entities.php
 * 
 * Permet de gérer les entreprises/entités clientes et leurs utilisateurs
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';
require_once '../includes/entity-console-nav.php';

// Seul ADMIN_GDRI peut accéder
if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$tab = strtolower(trim((string) ($_GET['tab'] ?? '')));
if ($tab === 'users-tab') {
    redirect(url('pages/platform-users.php'));
}

$page_title = 'Gestion des Entités';

// Récupérer toutes les entités
$entities = [];
$services = [];
$allUsers = [];
try {
    $token = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if ($token && $apiBase) {
        $ch = curl_init($apiBase . '/entities/context');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if (!$err && $code >= 200 && $code < 300) {
            $decoded = json_decode((string)$raw, true);
            $payload = $decoded['data'] ?? [];
            $entities = is_array($payload['entities'] ?? null) ? $payload['entities'] : [];
            $services = is_array($payload['services'] ?? null) ? $payload['services'] : [];
            $allUsers = is_array($payload['users'] ?? null) ? $payload['users'] : [];
        }
    }
} catch (Exception $e) {
    $entities = [];
    $services = [];
    $allUsers = [];
}

$services = dedupeServicesCatalog($services);
$servicesById = [];
foreach ($services as $service) {
    $sid = (string) ($service['_id'] ?? $service['id'] ?? '');
    if ($sid !== '') {
        $servicesById[$sid] = $service;
    }
}
$entitiesById = [];
foreach ($entities as $entityRow) {
    $eid = (string) ($entityRow['_id'] ?? '');
    if ($eid !== '') {
        $entitiesById[$eid] = $entityRow;
    }
}

// Les utilisateurs par entité sont chargés à l'ouverture du modal de gestion.
?>

<?php
require_once '../includes/header.php';
renderConsoleLayoutStart(
    'Entités',
    'Gérez les entreprises clientes et leurs modules autorisés.'
);
?>

<section class="section">
    <div class="container">
        <div class="section-title">
            <h2>Liste des entités</h2>
            <button class="btn btn-primary" id="addEntityBtn" type="button">+ Ajouter une entité</button>
        </div>

        <div class="entities-grid entities-grid--compact" id="entitiesGrid">
            <?php if (empty($entities)): ?>
                <div class="empty-state">
                    <p>Aucune entité enregistrée pour le moment.</p>
                </div>
            <?php else: ?>
                <?php foreach ($entities as $entity): ?>
                    <?php
                        $entityId = (string) ($entity['_id'] ?? '');
                        $moduleCount = count(is_array($entity['services_authorized'] ?? null) ? $entity['services_authorized'] : []);
                        $isActive = ($entity['status'] ?? '') === 'active';
                    ?>
                    <button
                        type="button"
                        class="entity-card-compact"
                        data-entity-id="<?= htmlspecialchars($entityId) ?>"
                        aria-label="Gérer <?= htmlspecialchars((string) $entity['name']) ?>"
                    >
                        <?php if (!empty($entity['logo'])): ?>
                            <img class="entity-card-compact__logo" src="<?= htmlspecialchars((string) $entity['logo']) ?>" alt="">
                        <?php else: ?>
                            <span class="entity-card-compact__logo entity-card-compact__logo--placeholder">🏢</span>
                        <?php endif; ?>
                        <span class="entity-card-compact__name"><?= htmlspecialchars((string) $entity['name']) ?></span>
                        <span class="badge <?= $isActive ? 'badge-success' : 'badge-warning' ?>">
                            <?= $isActive ? 'Actif' : 'Inactif' ?>
                        </span>
                        <span class="entity-card-compact__meta"><?= (int) $moduleCount ?> module<?= $moduleCount > 1 ? 's' : '' ?></span>
                    </button>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</section>

<?php renderConsoleLayoutEnd(); ?>

<!-- Modal gestion entité (détail au clic sur une carte compacte) -->
<div class="modal-overlay" id="entityManageModal">
    <div class="modal-content modal-large">
        <button class="modal-close" id="closeEntityManageModal" type="button">×</button>
        <div class="modal-header entity-manage-header">
            <div>
                <h2 id="entityManageTitle">Entité</h2>
                <p id="entityManageStatus" class="text-muted" style="margin:0.35rem 0 0;"></p>
            </div>
            <div class="entity-manage-actions">
                <button type="button" class="btn btn-outline btn-sm" id="entityManageEditBtn">Modifier</button>
                <a class="btn btn-outline btn-sm" id="entityManageModulesLink" href="#">Modules</a>
            </div>
        </div>
        <div class="modal-body modal-scrollable">
            <div class="entity-manage-section">
                <h3>Informations</h3>
                <dl class="entity-manage-dl" id="entityManageDetails"></dl>
            </div>
            <div class="entity-manage-section">
                <h3>Modules autorisés</h3>
                <div class="modules-list" id="entityManageModules"></div>
            </div>
            <div class="entity-manage-section">
                <div class="entity-manage-section__head">
                    <h3>Utilisateurs</h3>
                    <button type="button" class="btn btn-sm btn-outline" id="entityManageAddUserBtn">+ Ajouter</button>
                </div>
                <div id="entityManageUsers" class="users-container">
                    <p class="text-muted">Chargement...</p>
                </div>
            </div>
        </div>
    </div>
</div>

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
                    <label for="entityLogo">Logo de l'entreprise</label>
                    <div class="logo-upload-container">
                        <div class="logo-preview" id="logoPreview" style="display: none;">
                            <img id="logoPreviewImg" src="" alt="Aperçu du logo" style="max-width: 150px; max-height: 150px; border-radius: 4px; margin-bottom: 10px;">
                            <button type="button" class="btn btn-sm btn-outline" id="removeLogoBtn" style="display: none;">Supprimer le logo</button>
                        </div>
                        <input type="file" id="entityLogo" name="logo" accept="image/*" style="display: none;">
                        <button type="button" class="btn btn-outline" id="selectLogoBtn">
                            <span id="selectLogoText">📷 Sélectionner un logo</span>
                        </button>
                        <small class="form-text text-muted">Formats acceptés : JPG, PNG, GIF, WebP (max 2MB)</small>
                    </div>
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
                    <label for="userId">Utilisateur *</label>
                    <select id="userId" name="userId" required>
                        <option value="">Chargement des utilisateurs...</option>
                    </select>
                    <small class="form-text text-muted">Sélectionnez un utilisateur existant à ajouter à l'entité</small>
                </div>
                
                <div class="form-group">
                    <label for="userRole">Rôle dans l'entité *</label>
                    <select id="userRole" name="role" required>
                        <option value="user">Utilisateur</option>
                        <option value="admin">Administrateur</option>
                    </select>
                </div>
                
                <div class="form-error" id="userFormError"></div>
                <div class="form-success" id="userFormSuccess"></div>
                
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" id="cancelUserForm">Annuler</button>
                    <button type="submit" class="btn btn-primary">Ajouter</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Style spécifique pour cette page -->
<style>
.entities-grid--compact {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--spacing-md);
    margin-top: var(--spacing-lg);
}

.entity-card-compact {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    padding: 0.85rem 0.65rem;
    background: white;
    border: 1px solid var(--color-light);
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    cursor: pointer;
    text-align: center;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}

.entity-card-compact:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    transform: translateY(-1px);
}

.entity-card-compact__logo {
    width: 42px;
    height: 42px;
    object-fit: contain;
    border-radius: 8px;
}

.entity-card-compact__logo--placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.35rem;
    background: var(--color-light);
}

.entity-card-compact__name {
    font-weight: 600;
    font-size: 0.92rem;
    color: var(--color-primary);
    line-height: 1.25;
    word-break: break-word;
}

.entity-card-compact__meta {
    font-size: 0.78rem;
    color: var(--color-gray);
}

.modal-large {
    max-width: 720px;
    width: min(96vw, 720px);
}

.entity-manage-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
}

.entity-manage-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.entity-manage-section {
    margin-bottom: 1.25rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-light);
}

.entity-manage-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
}

.entity-manage-section h3 {
    font-size: 0.95rem;
    margin: 0 0 0.65rem;
    color: var(--color-gray);
}

.entity-manage-section__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.65rem;
}

.entity-manage-dl {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 0.35rem 0.75rem;
    margin: 0;
}

.entity-manage-dl dt {
    font-weight: 600;
    color: var(--color-gray);
}

.entity-manage-dl dd {
    margin: 0;
}

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

.section-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
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
    gap: var(--spacing-sm);
    position: relative;
}

.users-list li .remove-user {
    margin-left: auto;
    padding: 4px 8px;
    background-color: transparent;
    border: none;
    cursor: pointer;
    font-size: 16px;
    opacity: 0.6;
    transition: opacity var(--transition-fast), background-color var(--transition-fast);
    border-radius: var(--border-radius-sm);
}

.users-list li .remove-user:hover {
    opacity: 1;
    background-color: rgba(220, 53, 69, 0.1);
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
    align-items: center;
}

.delete-user-account {
    color: #dc3545;
    font-weight: 700;
}

.user-details p {
    margin: var(--spacing-sm) 0;
    color: var(--color-gray);
}

/* Styles pour l'upload de logo */
.logo-upload-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
}

.logo-preview {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    background-color: var(--color-light);
    border-radius: var(--border-radius);
}

.logo-preview img {
    border: 1px solid var(--color-border);
}
</style>

<script>
const ENTITIES_BY_ID = <?= json_encode($entitiesById, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
const SERVICES_BY_ID = <?= json_encode($servicesById, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
let activeManageEntityId = null;

// Scripts de gestion des entités
// Fonction pour charger les utilisateurs d'une entité via l'API
async function loadEntityUsers(entityId, container) {
    try {
        const apiBaseUrl = '<?php echo getApiBaseUrl(); ?>';
        const jwtToken = '<?php echo getJWTToken(); ?>';
        
        const response = await fetch(`${apiBaseUrl}/entities/${entityId}/users`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + jwtToken,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des utilisateurs');
        }
        
        // Afficher les utilisateurs
        if (data.success && data.data && data.data.length > 0) {
            let html = '<ul class="users-list">';
            data.data.forEach(user => {
                const userId = typeof user._id === 'string'
                    ? user._id
                    : (user._id && typeof user._id === 'object' && user._id.$oid ? user._id.$oid : '');
                html += `
                    <li class="user-item">
                        <span class="user-email">${escapeHtml(user.email)}</span>
                        <span class="badge badge-info">${escapeHtml(user.role_in_entity || user.role || 'user')}</span>
                        <button class="btn-icon remove-user" 
                                data-entity-id="${escapeHtml(entityId)}" 
                                data-user-id="${escapeHtml(userId)}"
                                data-user-email="${escapeHtml(user.email || 'N/A')}"
                                title="Retirer de cette entité">
                            ✕
                        </button>
                    </li>
                `;
            });
            html += '</ul>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="text-muted">Aucun utilisateur</p>';
        }
    } catch (error) {
        console.error('❌ Erreur lors du chargement des utilisateurs:', error);
        container.innerHTML = '<p class="text-muted">Erreur lors du chargement</p>';
    }
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Page entités chargée');

    const openModal = (modalId) => {
        document.getElementById(modalId).style.display = 'flex';
    };

    const closeModal = (modalId) => {
        document.getElementById(modalId).style.display = 'none';
    };

    function renderEntityManageModal(entityId) {
        const entity = ENTITIES_BY_ID[entityId];
        if (!entity) return;

        activeManageEntityId = entityId;
        const isActive = (entity.status || '') === 'active';

        document.getElementById('entityManageTitle').textContent = entity.name || 'Entité';
        document.getElementById('entityManageStatus').textContent = isActive ? 'Statut : actif' : 'Statut : inactif';
        document.getElementById('entityManageDetails').innerHTML = `
            <dt>SIRET</dt><dd>${escapeHtml(entity.siret || '—')}</dd>
            <dt>Adresse</dt><dd>${escapeHtml(entity.address || '—')}</dd>
        `;

        const modulesWrap = document.getElementById('entityManageModules');
        const authorized = Array.isArray(entity.services_authorized) ? entity.services_authorized : [];
        if (!authorized.length) {
            modulesWrap.innerHTML = '<p class="text-muted">Aucun module autorisé</p>';
        } else {
            modulesWrap.innerHTML = authorized.map((serviceId) => {
                const service = SERVICES_BY_ID[String(serviceId)];
                if (!service) return '';
                return `<span class="module-badge" data-service-id="${escapeHtml(String(serviceId))}">${escapeHtml(service.icon || '📱')} ${escapeHtml(service.name || '')}</span>`;
            }).join('') || '<p class="text-muted">Aucun module autorisé</p>';
        }

        document.getElementById('entityManageModulesLink').href = '<?= url('pages/entity-modules.php?entityId=') ?>' + encodeURIComponent(entityId);
        loadEntityUsers(entityId, document.getElementById('entityManageUsers'));
        openModal('entityManageModal');
    }

    document.querySelectorAll('.entity-card-compact').forEach((card) => {
        card.addEventListener('click', function() {
            const entityId = this.getAttribute('data-entity-id');
            if (entityId) renderEntityManageModal(entityId);
        });
    });

    document.getElementById('closeEntityManageModal').addEventListener('click', () => closeModal('entityManageModal'));
    document.getElementById('entityManageModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('entityManageModal');
    });
    document.getElementById('entityManageEditBtn').addEventListener('click', () => {
        if (activeManageEntityId) openEditEntity(activeManageEntityId);
    });
    document.getElementById('entityManageAddUserBtn').addEventListener('click', () => {
        if (!activeManageEntityId) return;
        openModal('userModal');
        const userEntitySelect = document.getElementById('userEntity');
        if (userEntitySelect) {
            userEntitySelect.value = activeManageEntityId;
            loadAvailableUsers(activeManageEntityId);
        }
    });

    async function openEditEntity(entityId) {
        if (!entityId) return;
        try {
            const apiUrl = '<?php echo getApiBaseUrl(); ?>/entities/' + entityId;
            const jwtToken = '<?php echo getJWTToken(); ?>';
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + jwtToken },
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Erreur lors du chargement de l\'entité');
            }
            const entity = data.data;
            document.getElementById('entityId').value = entityId;
            document.getElementById('entityName').value = entity.name || '';
            document.getElementById('entitySiret').value = entity.siret || '';
            document.getElementById('entityAddress').value = entity.address || '';
            document.getElementById('modalTitle').textContent = 'Modifier l\'entité';
            ['entityName', 'entitySiret', 'entityAddress'].forEach((fieldId) => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.closest('.form-group').style.display = 'block';
                    field.setAttribute('required', 'required');
                }
            });
            const logoPreview = document.getElementById('logoPreview');
            const logoPreviewImg = document.getElementById('logoPreviewImg');
            const removeLogoBtn = document.getElementById('removeLogoBtn');
            const selectLogoBtn = document.getElementById('selectLogoBtn');
            if (entity.logo) {
                logoBase64 = entity.logo;
                logoPreviewImg.src = entity.logo;
                logoPreview.style.display = 'flex';
                removeLogoBtn.style.display = 'block';
                selectLogoBtn.querySelector('#selectLogoText').textContent = '📷 Changer le logo';
            } else {
                logoBase64 = null;
                logoPreview.style.display = 'none';
                removeLogoBtn.style.display = 'none';
                selectLogoBtn.querySelector('#selectLogoText').textContent = '📷 Sélectionner un logo';
            }
            loadEntityModules(entityId);
            closeModal('entityManageModal');
            openModal('entityModal');
        } catch (error) {
            alert(error.message || 'Erreur lors du chargement de l\'entité');
        }
    }

    let logoBase64 = null;

    function initLogoUpload() {
        const entityLogoInput = document.getElementById('entityLogo');
        const selectLogoBtn = document.getElementById('selectLogoBtn');
        const logoPreview = document.getElementById('logoPreview');
        const logoPreviewImg = document.getElementById('logoPreviewImg');
        const removeLogoBtn = document.getElementById('removeLogoBtn');
        
        console.log('🔍 Initialisation upload logo:', {
            entityLogoInput: !!entityLogoInput,
            selectLogoBtn: !!selectLogoBtn,
            logoPreview: !!logoPreview,
            logoPreviewImg: !!logoPreviewImg,
            removeLogoBtn: !!removeLogoBtn
        });
        
        // Ouvrir le sélecteur de fichier - utiliser délégation d'événements
        if (selectLogoBtn) {
            // Supprimer tous les anciens listeners en clonant le bouton
            const newSelectBtn = selectLogoBtn.cloneNode(true);
            selectLogoBtn.parentNode.replaceChild(newSelectBtn, selectLogoBtn);
            
            // Réattacher l'ID
            newSelectBtn.id = 'selectLogoBtn';
            
            newSelectBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Clic sur bouton sélectionner logo');
                const input = document.getElementById('entityLogo');
                if (input) {
                    console.log('✅ Ouverture du sélecteur de fichier');
                    input.click();
                } else {
                    console.error('❌ Input logo non trouvé');
                }
            });
        } else {
            console.error('❌ Bouton selectLogoBtn non trouvé');
        }
        
        // Gérer la sélection d'un fichier
        const currentInput = document.getElementById('entityLogo');
        if (currentInput) {
            // Supprimer les anciens listeners en clonant l'input
            const newInput = currentInput.cloneNode(true);
            currentInput.parentNode.replaceChild(newInput, currentInput);
            
            // Réattacher l'ID
            newInput.id = 'entityLogo';
            
            newInput.addEventListener('change', function(e) {
                console.log('📁 Fichier sélectionné');
                const file = e.target.files[0];
                if (!file) {
                    console.log('⚠️ Aucun fichier sélectionné');
                    return;
                }
                
                console.log('📄 Fichier:', file.name, file.size, file.type);
                
                // Vérifier la taille (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    alert('Le fichier est trop volumineux. Taille maximale : 2MB');
                    this.value = '';
                    return;
                }
                
                // Vérifier le type
                if (!file.type.startsWith('image/')) {
                    alert('Veuillez sélectionner une image');
                    this.value = '';
                    return;
                }
                
                // Convertir en base64
                const reader = new FileReader();
                reader.onload = function(event) {
                    console.log('✅ Fichier converti en base64');
                    logoBase64 = event.target.result;
                    const previewImg = document.getElementById('logoPreviewImg');
                    const preview = document.getElementById('logoPreview');
                    const removeBtn = document.getElementById('removeLogoBtn');
                    const selectText = document.getElementById('selectLogoText');
                    
                    if (previewImg) previewImg.src = logoBase64;
                    if (preview) preview.style.display = 'flex';
                    if (removeBtn) removeBtn.style.display = 'block';
                    if (selectText) selectText.textContent = '📷 Changer le logo';
                };
                reader.onerror = function() {
                    console.error('❌ Erreur lors de la lecture du fichier');
                    alert('Erreur lors de la lecture du fichier');
                };
                reader.readAsDataURL(file);
            });
        }
        
        // Supprimer le logo
        if (removeLogoBtn) {
            removeLogoBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🗑️ Suppression du logo');
                logoBase64 = null;
                const input = document.getElementById('entityLogo');
                const preview = document.getElementById('logoPreview');
                const selectText = document.getElementById('selectLogoText');
                
                if (input) input.value = '';
                if (preview) preview.style.display = 'none';
                this.style.display = 'none';
                if (selectText) selectText.textContent = '📷 Sélectionner un logo';
            });
        }
    }
    
    // Initialiser immédiatement
    initLogoUpload();
    
    // Ouvrir modal entité (nouvelle entité)
    document.getElementById('addEntityBtn').addEventListener('click', () => {
        // Réinitialiser le formulaire
        document.getElementById('entityForm').reset();
        document.getElementById('entityId').value = '';
        document.getElementById('modalTitle').textContent = 'Ajouter une entité';
        
        // Réinitialiser le logo
        logoBase64 = null;
        const logoPreview = document.getElementById('logoPreview');
        const removeLogoBtn = document.getElementById('removeLogoBtn');
        const selectLogoText = document.getElementById('selectLogoText');
        
        if (logoPreview) logoPreview.style.display = 'none';
        if (removeLogoBtn) removeLogoBtn.style.display = 'none';
        if (selectLogoText) selectLogoText.textContent = '📷 Sélectionner un logo';
        
        // Réinitialiser les listeners après ouverture du modal
        setTimeout(() => {
            initLogoUpload();
        }, 100);
        
        // Afficher tous les champs
        const fieldsToShow = ['entityName', 'entitySiret', 'entityAddress'];
        fieldsToShow.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.closest('.form-group').style.display = 'block';
                field.setAttribute('required', 'required');
            }
        });
        
        // Réinitialiser les modules sélectionnés
        selectedModules = [];
        selectOptions.forEach(opt => opt.classList.remove('selected'));
        updateSelectedModules();
        selectTrigger.querySelector('.select-placeholder').textContent = 'Rechercher et sélectionner des modules...';
        
        openModal('entityModal');
    });
    
    document.getElementById('closeEntityModal').addEventListener('click', () => {
        // Réafficher tous les champs avant de fermer
        const fieldsToShow = ['entityName', 'entitySiret', 'entityAddress'];
        fieldsToShow.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.closest('.form-group').style.display = 'block';
            }
        });
        closeModal('entityModal');
    });
    
    document.getElementById('cancelEntityForm').addEventListener('click', () => {
        // Réafficher tous les champs avant de fermer
        const fieldsToShow = ['entityName', 'entitySiret', 'entityAddress'];
        fieldsToShow.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.closest('.form-group').style.display = 'block';
            }
        });
        closeModal('entityModal');
    });
    
    document.getElementById('closeUserModal').addEventListener('click', () => closeModal('userModal'));
    document.getElementById('cancelUserForm').addEventListener('click', () => closeModal('userModal'));

    const userEntitySelect = document.getElementById('userEntity');
    if (userEntitySelect) {
        userEntitySelect.addEventListener('change', function() {
            const entityId = this.value;
            if (entityId) {
                loadAvailableUsers(entityId);
            } else {
                const userIdSelect = document.getElementById('userId');
                if (userIdSelect) {
                    userIdSelect.innerHTML = '<option value="">Sélectionner d\'abord une entité</option>';
                }
            }
        });
    }
    
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
    
    function loadEntityModules(entityId) {
        try {
            const entity = ENTITIES_BY_ID[entityId];
            if (!entity) return;
            selectedModules = [];
            selectOptions.forEach(opt => opt.classList.remove('selected'));
            const authorized = Array.isArray(entity.services_authorized) ? entity.services_authorized : [];
            authorized.forEach((serviceId) => {
                const service = SERVICES_BY_ID[String(serviceId)];
                if (!service) return;
                selectOptions.forEach(option => {
                    if (option.getAttribute('data-value') === String(serviceId)) {
                        option.classList.add('selected');
                        selectedModules.push({
                            value: String(serviceId),
                            text: ((service.icon || '') + ' ' + (service.name || '')).trim()
                        });
                    }
                });
            });
            updateSelectedModules();
            if (selectedModules.length > 0) {
                selectTrigger.querySelector('.select-placeholder').textContent = `${selectedModules.length} module(s) sélectionné(s)`;
            } else {
                selectTrigger.querySelector('.select-placeholder').textContent = 'Rechercher et sélectionner des modules...';
            }
        } catch (error) {
            console.error('Erreur lors du chargement des modules:', error);
        }
    }
    
    // Fermer le dropdown en cliquant en dehors
    document.addEventListener('click', function(e) {
        if (!modulesSelect.contains(e.target)) {
            modulesSelect.classList.remove('active');
        }
    });
    
    // Gestion de la soumission du formulaire
    const entityForm = document.getElementById('entityForm');
    entityForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const entityId = document.getElementById('entityId').value;
        const formError = document.getElementById('formError');
        const formSuccess = document.getElementById('formSuccess');
        
        // Cacher les messages précédents
        formError.style.display = 'none';
        formSuccess.style.display = 'none';
        
        try {
            // Récupérer les modules sélectionnés
            const servicesAuthorized = selectedModules.map(m => m.value);
            
            // Déterminer si on est en mode création ou mise à jour des modules
            const isUpdateModulesOnly = entityId && document.getElementById('entityName').closest('.form-group').style.display === 'none';
            
            let response;
            
            if (isUpdateModulesOnly) {
                // Mise à jour des modules uniquement
                const apiUrl = '<?php echo getApiBaseUrl(); ?>/entities/' + entityId + '/services';
                const jwtToken = '<?php echo getJWTToken(); ?>';
                
                response = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + jwtToken
                    },
                    body: JSON.stringify({
                        services_authorized: servicesAuthorized
                    })
                });
            } else if (entityId) {
                // Mise à jour d'une entité existante
                const name = document.getElementById('entityName').value;
                const siret = document.getElementById('entitySiret').value;
                const address = document.getElementById('entityAddress').value;
                
                if (!name || !siret || !address) {
                    formError.textContent = 'Veuillez remplir tous les champs requis';
                    formError.style.display = 'block';
                    return;
                }
                
                const apiUrl = '<?php echo getApiBaseUrl(); ?>/entities/' + entityId;
                const jwtToken = '<?php echo getJWTToken(); ?>';
                
                const payload = {
                    name,
                    siret,
                    address
                };
                
                // Ajouter le logo si présent (ou null pour le supprimer)
                if (logoBase64 !== null) {
                    payload.logo = logoBase64 || null; // null si supprimé
                }
                
                response = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + jwtToken
                    },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
            } else {
                // Création d'une nouvelle entité
                const name = document.getElementById('entityName').value;
                const siret = document.getElementById('entitySiret').value;
                const address = document.getElementById('entityAddress').value;
                
                if (!name || !siret || !address) {
                    formError.textContent = 'Veuillez remplir tous les champs requis';
                    formError.style.display = 'block';
                    return;
                }
                
                const apiUrl = '<?php echo getApiBaseUrl(); ?>/entities';
                const jwtToken = '<?php echo getJWTToken(); ?>';
                
                const payload = {
                    name,
                    siret,
                    address,
                    services_authorized: servicesAuthorized
                };
                
                // Ajouter le logo si présent
                if (logoBase64) {
                    payload.logo = logoBase64;
                }
                
                response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + jwtToken
                    },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la sauvegarde');
            }
            
            // Succès
            formSuccess.textContent = data.message || 'Opération réussie';
            formSuccess.style.display = 'block';
            
            // Recharger la page après 1 seconde
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (error) {
            console.error('Erreur:', error);
            formError.textContent = error.message || 'Une erreur est survenue';
            formError.style.display = 'block';
        }
    });
    
    // Charger la liste des utilisateurs disponibles
    async function loadAvailableUsers(entityId) {
        const userIdSelect = document.getElementById('userId');
        if (!userIdSelect) {
            console.error('❌ Element userIdSelect non trouvé');
            return;
        }
        
        try {
            console.log('📤 Chargement des utilisateurs disponibles pour entityId:', entityId);
            userIdSelect.innerHTML = '<option value="">Chargement...</option>';
            
            const apiUrl = '<?php echo getApiBaseUrl(); ?>/users/available?entityId=' + encodeURIComponent(entityId);
            const jwtToken = '<?php echo getJWTToken(); ?>';
            
            console.log('🔗 URL:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + jwtToken
                },
                credentials: 'include'
            });
            
            console.log('📥 Réponse status:', response.status);
            
            const data = await response.json();
            console.log('📦 Données reçues:', data);
            
            if (!response.ok) {
                throw new Error(data.message || data.error || 'Erreur lors du chargement des utilisateurs');
            }
            
            userIdSelect.innerHTML = '<option value="">Sélectionner un utilisateur</option>';
            
            if (data.success && data.data && Array.isArray(data.data) && data.data.length > 0) {
                console.log('✅ Utilisateurs disponibles:', data.data.length);
                data.data.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user._id;
                    option.textContent = user.email + (user.username ? ' (' + user.username + ')' : '');
                    userIdSelect.appendChild(option);
                });
            } else {
                console.warn('⚠️ Aucun utilisateur disponible ou données invalides');
                userIdSelect.innerHTML = '<option value="">Aucun utilisateur disponible</option>';
            }
        } catch (error) {
            console.error('❌ Erreur lors du chargement des utilisateurs:', error);
            userIdSelect.innerHTML = '<option value="">Erreur lors du chargement: ' + error.message + '</option>';
        }
    }
    
    // Le listener change est maintenant géré plus haut avec les logs
    
    // Gestion de la suppression d'utilisateur d'une entité
    document.addEventListener('click', async function(e) {
        const clickTarget = e.target instanceof Element
            ? e.target
            : (e.target && e.target.parentElement ? e.target.parentElement : null);
        const button = clickTarget ? clickTarget.closest('.remove-user') : null;
        if (button) {
            const entityId = button.getAttribute('data-entity-id');
            const userId = button.getAttribute('data-user-id');
            const userEmail = button.getAttribute('data-user-email');
            
            if (!confirm(`Voulez-vous vraiment retirer l'utilisateur "${userEmail}" de cette entité ?`)) {
                return;
            }
            
            try {
                const apiBaseUrl = '<?php echo getApiBaseUrl(); ?>';
                const response = await fetch(apiBaseUrl + '/entities/' + entityId + '/users/' + userId, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer <?php echo getJWTToken(); ?>'
                    },
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    console.log('✅ Utilisateur retiré avec succès');
                    // Recharger la page pour mettre à jour l'affichage
                    window.location.reload();
                } else {
                    console.error('❌ Erreur lors de la suppression:', data.message);
                    alert('Erreur lors de la suppression: ' + (data.message || 'Erreur inconnue'));
                }
            } catch (error) {
                console.error('❌ Erreur réseau lors de la suppression:', error);
                alert('Erreur réseau lors de la suppression.');
            }
        }
    });

    // Gestion de la soumission du formulaire utilisateur
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formError = document.getElementById('userFormError');
            const formSuccess = document.getElementById('userFormSuccess');
            
            // Cacher les messages précédents
            if (formError) formError.style.display = 'none';
            if (formSuccess) formSuccess.style.display = 'none';
            
            try {
                const entityId = document.getElementById('userEntity').value;
                const userId = document.getElementById('userId').value;
                const role = document.getElementById('userRole')?.value || 'user';
                
                if (!entityId || !userId) {
                    if (formError) {
                        formError.textContent = 'Veuillez sélectionner une entité et un utilisateur';
                        formError.style.display = 'block';
                    }
                    return;
                }
                
                const apiUrl = '<?php echo getApiBaseUrl(); ?>/entities/' + entityId + '/users';
                const jwtToken = '<?php echo getJWTToken(); ?>';
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + jwtToken
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        userId: userId,
                        role: role
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || data.error || 'Erreur lors de l\'ajout de l\'utilisateur');
                }
                
                // Succès
                if (formSuccess) {
                    formSuccess.textContent = data.message || 'Utilisateur ajouté avec succès';
                    formSuccess.style.display = 'block';
                }
                
                // Recharger la page après 1 seconde
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
                
            } catch (error) {
                console.error('Erreur:', error);
                if (formError) {
                    formError.textContent = error.message || 'Une erreur est survenue';
                    formError.style.display = 'block';
                }
            }
        });
    }
});
</script>

<?php require_once '../includes/footer.php'; ?>

