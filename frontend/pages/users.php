<?php
require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';
require_once '../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$entityId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
if (hasRole(ROLE_ADMIN_GDRI) && getGdriWorkspaceMode(!empty($entityId)) === 'platform') {
    redirect(url('pages/platform-users.php'));
}

$page_title = 'Utilisateurs & Permissions';
$successMessage = '';
$errorMessage = '';
$users = [];
$services = [];
$defaultAdminModules = [];
$defaultUserModules = [];
$defaultModuleZoneAdmin = [];
$defaultModuleZoneUser = [];
$entityOwnerUserId = '';

function callApiUsersCfg($method, $url, $token, $body = null) {
    $headers = ["Authorization: Bearer {$token}"];
    if ($body !== null) $headers[] = "Content-Type: application/json";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err) return ['ok' => false, 'message' => $err, 'data' => null];
    $decoded = json_decode((string) $raw, true);
    return ['ok' => $code >= 200 && $code < 300, 'message' => $decoded['message'] ?? null, 'data' => $decoded];
}

try {
    $entityId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
    if (empty($entityId)) throw new Exception("Aucune entite active.");
    $token = getJWTToken();
    if (!$token) throw new Exception("Session invalide.");
    $apiBase = rtrim(getApiBaseUrl(), '/');
    $scope = '?entity_id=' . urlencode((string)$entityId);

    $resp = callApiUsersCfg('GET', $apiBase . '/entity-user-config' . $scope, $token);
    if (!$resp['ok']) throw new Exception($resp['message'] ?: 'Chargement impossible.');
    $payload = $resp['data']['data'] ?? [];
    $entityMeta = $payload['entity'] ?? [];
    $users = $payload['users'] ?? [];
    $entityRoles = $payload['roles'] ?? [];
    $services = dedupeServicesCatalog($payload['services'] ?? []);
    $services = array_values(array_filter($services, function ($service) {
        $slug = strtolower(trim((string) ($service['slug'] ?? '')));
        return !isInfrastructureServiceSlug($slug);
    }));
    $usersById = [];
    foreach ($users as $user) {
        $userId = (string) ($user['id'] ?? '');
        if ($userId === '' || isset($usersById[$userId])) {
            continue;
        }
        $usersById[$userId] = $user;
    }
    $users = array_values($usersById);
    $defaultPerms = $entityMeta['defaultModulePermissions'] ?? [];
    $defaultAdminModules = is_array($defaultPerms['admin'] ?? null) ? $defaultPerms['admin'] : [];
    $defaultUserModules = is_array($defaultPerms['user'] ?? null) ? $defaultPerms['user'] : [];
    $defaultZonePerms = $entityMeta['defaultModuleZonePermissions'] ?? [];
    $defaultModuleZoneAdmin = is_array($defaultZonePerms['admin'] ?? null) ? $defaultZonePerms['admin'] : [];
    $defaultModuleZoneUser = is_array($defaultZonePerms['user'] ?? null) ? $defaultZonePerms['user'] : [];
    $entityOwnerUserId = (string) ($entityMeta['ownerUserId'] ?? '');
} catch (Exception $e) {
    $errorMessage = $e->getMessage();
}
$currentUserId = (string) ($_SESSION['user_id'] ?? '');
$canManageOwner = hasRole(ROLE_ADMIN_GDRI) || (!empty($entityOwnerUserId) && $currentUserId === $entityOwnerUserId);

function formatEntityUserRoleLabel(array $user, array $entityRoles): string {
    $byKey = [];
    foreach ($entityRoles as $roleDef) {
        $key = (string) ($roleDef['key'] ?? '');
        if ($key === '') continue;
        $byKey[$key] = (string) ($roleDef['label'] ?? $key);
    }
    $parts = [];
    if (!empty($user['entity_roles']) && is_array($user['entity_roles'])) {
        foreach ($user['entity_roles'] as $roleKey) {
            $key = (string) $roleKey;
            if ($key === '') continue;
            $parts[] = $byKey[$key] ?? $key;
        }
    }
    if (!$parts) {
        $membershipRole = (string) ($user['membership_role'] ?? $user['role'] ?? 'user');
        if ($membershipRole === 'admin') {
            $parts[] = 'Administrateur';
        } elseif ($membershipRole === 'user') {
            $parts[] = 'Utilisateur';
        } else {
            $parts[] = $byKey[$membershipRole] ?? $membershipRole;
        }
    }
    return implode(', ', $parts);
}

require_once '../includes/header.php';
renderConsoleLayoutStart(
    'Utilisateurs & Permissions',
    'Gérez les accès aux modules pour chaque utilisateur de votre entreprise.'
);
?>

<section class="section">
    <div class="container">
        <div class="section-title">
            <h2>Utilisateurs de l'entreprise</h2>
            <button type="button" class="btn btn-primary" id="inviteUserBtn">+ Inviter un utilisateur</button>
        </div>

        <?php if ($successMessage): ?>
            <div class="alert alert-success"><?= escape($successMessage); ?></div>
        <?php endif; ?>
        <?php if ($errorMessage): ?>
            <div class="alert alert-error"><?= escape($errorMessage); ?></div>
        <?php endif; ?>
        <?php if (empty($users)): ?>
            <div class="empty-state">
                <p>Aucun utilisateur trouvé dans cette entreprise.</p>
            </div>
        <?php else: ?>
            <div class="users-grid">
                <?php foreach ($users as $user): ?>
                    <?php
                    $userIdStr = (string) ($user['id'] ?? '');
                    $email = $user['email'] ?? 'Utilisateur';
                    $status = $user['status'] ?? 'active';
                    $role = $user['role'] ?? 'user';
                    $roleLabel = formatEntityUserRoleLabel($user, $entityRoles);
                    $isOwner = !empty($user['isOwner']);
                    $canTransferOwnerTarget = $canManageOwner && !$isOwner && $role === 'admin';
                    ?>
                    <div class="user-card">
                        <div class="user-header">
                            <h3><?= $isOwner ? '👑 ' : '' ?><?= escape($email); ?></h3>
                            <?php if (!$isOwner): ?>
                                <button
                                    type="button"
                                    class="btn-icon delete-user-account"
                                    data-user-id="<?= escape($userIdStr); ?>"
                                    data-user-email="<?= escape($email); ?>"
                                    title="Supprimer définitivement ce compte"
                                >
                                    ✕
                                </button>
                            <?php endif; ?>
                        </div>
                        <div>
                            <span class="badge <?= $status === 'active' ? 'badge-success' : 'badge-warning' ?>">
                                <?= $status === 'active' ? 'Actif' : 'Inactif' ?>
                            </span>
                            <?php if ($isOwner): ?>
                                <span class="badge badge-info">Owner</span>
                            <?php endif; ?>
                        </div>
                        <p><strong>Rôle:</strong> <?= escape($roleLabel); ?></p>
                        <?php if ($canTransferOwnerTarget): ?>
                            <button
                                type="button"
                                class="btn btn-sm btn-outline transfer-owner"
                                data-user-id="<?= escape($userIdStr); ?>"
                                data-user-email="<?= escape($email); ?>"
                            >
                                Donner la couronne
                            </button>
                        <?php endif; ?>
                        <button
                            type="button"
                            class="btn btn-sm btn-outline manage-user-modules"
                            data-user-id="<?= escape($userIdStr); ?>"
                            data-user-email="<?= escape($email); ?>"
                            data-user-role="<?= escape($role); ?>"
                            data-user-services='<?= escape(json_encode(array_values($user["services_authorized"] ?? []))); ?>'
                                data-user-zone-permissions='<?= escape(json_encode($user["module_zone_permissions"] ?? new stdClass())); ?>'
                        >
                            Gérer les modules
                        </button>
                    </div>
                <?php endforeach; ?>
            </div>

            <div class="permissions-panel">
                <div class="section-title">
                    <h2>Permissions par défaut</h2>
                </div>
                <?php if (empty($services)): ?>
                    <div class="empty-state">
                        <p>Aucun module autorisé pour votre entreprise.</p>
                    </div>
                <?php else: ?>
                    <div class="card" style="padding: var(--spacing-lg);">
                        <p class="text-muted" style="margin-top:0;">Définissez les modules par défaut selon le rôle. Les ajustements fins se font par utilisateur via “Gérer les modules”.</p>
                        <div class="form-group">
                            <label for="moduleFilterInput">Filtrer les modules</label>
                            <input type="text" id="moduleFilterInput" placeholder="Rechercher un module...">
                        </div>
                        <div class="defaults-table" id="defaultsTable">
                            <?php foreach ($services as $service): ?>
                                <?php $serviceId = (string) ($service['id'] ?? ''); ?>
                                <div class="defaults-row base-module-row" data-module-name="<?= escape(strtolower((string)($service['name'] ?? ''))); ?>" data-service-slug="<?= escape((string)($service['slug'] ?? '')); ?>">
                                    <div class="defaults-module">
                                        <strong><?= escape($service['icon'] ?? '🧩'); ?> <?= escape($service['name'] ?? 'Module'); ?></strong>
                                    </div>
                                    <label class="defaults-check">
                                        <input type="checkbox" class="default-admin-checkbox" value="<?= escape($serviceId); ?>" <?= in_array($serviceId, $defaultAdminModules, true) ? 'checked' : ''; ?>>
                                        Admin
                                    </label>
                                    <label class="defaults-check">
                                        <input type="checkbox" class="default-user-checkbox" value="<?= escape($serviceId); ?>" <?= in_array($serviceId, $defaultUserModules, true) ? 'checked' : ''; ?>>
                                        User
                                    </label>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <div class="form-actions" style="margin-top:var(--spacing-md);">
                            <button type="button" class="btn btn-primary" id="saveDefaultPermissionsBtn">Enregistrer les permissions par défaut</button>
                        </div>
                        <div class="form-error" id="defaultPermissionsError"></div>
                        <div class="form-success" id="defaultPermissionsSuccess"></div>
                    </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>
    </div>
</section>

<?php renderConsoleLayoutEnd(); ?>

<div class="modal-overlay" id="inviteUserModal" style="display:none;">
    <div class="modal-content" style="max-width: 520px;">
        <button class="modal-close" type="button" id="closeInviteUserModal">×</button>
        <div class="modal-header">
            <h2>Inviter un utilisateur</h2>
        </div>
        <div class="modal-body">
            <form id="inviteUserForm">
                <div class="form-group">
                    <label for="inviteUserEmail">Email *</label>
                    <input type="email" id="inviteUserEmail" required>
                </div>
                <div class="form-group">
                    <label for="inviteUserRole">Rôle *</label>
                    <select id="inviteUserRole" required>
                        <option value="user">Utilisateur</option>
                        <option value="admin">Administrateur</option>
                    </select>
                </div>
                <div class="form-error" id="inviteUserError"></div>
                <div class="form-success" id="inviteUserSuccess"></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" id="cancelInviteUser">Annuler</button>
                    <button type="submit" class="btn btn-primary">Envoyer l'invitation</button>
                </div>
            </form>
        </div>
    </div>
</div>

<div class="modal-overlay" id="userModulesModal" style="display:none;">
    <div class="modal-content" style="max-width: 760px;">
        <button class="modal-close" type="button" id="closeUserModulesModal">×</button>
        <div class="modal-header">
            <h2 id="userModulesModalTitle">Gérer les modules utilisateur</h2>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label for="userModulesFilterInput">Filtrer les modules</label>
                <input type="text" id="userModulesFilterInput" placeholder="Rechercher un module...">
            </div>
            <div id="userModulesList" class="modal-modules-list"></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="cancelUserModules">Annuler</button>
                <button type="button" class="btn btn-primary" id="saveUserModulesBtn">Enregistrer</button>
            </div>
            <div class="form-error" id="userModulesError"></div>
            <div class="form-success" id="userModulesSuccess"></div>
        </div>
    </div>
</div>

<style>
.users-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
}

.user-card {
    border: 1px solid var(--color-light);
    border-radius: 8px;
    padding: var(--spacing-md);
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
}

.user-card.active {
    border-color: var(--color-primary);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.user-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-sm);
}

.user-header h3 {
    margin: 0;
    min-width: 0;
    flex: 1 1 auto;
    font-size: 0.95rem;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.user-header .badge {
    flex: 0 0 auto;
}

.delete-user-account {
    color: #dc3545;
    font-weight: 700;
    line-height: 1;
}

.permissions-panel {
    margin-top: var(--spacing-xl);
}

.modules-form {
    margin-top: var(--spacing-lg);
}

.modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
}

.module-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    border: 1px solid var(--color-light);
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.module-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.module-card-header {
    display: flex;
    gap: var(--spacing-md);
    align-items: flex-start;
}

.module-icon {
    font-size: 2rem;
}

.module-title h3 {
    margin: 0 0 0.25rem;
}

.module-description {
    margin: 0;
    color: var(--color-gray);
}

.module-toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
}

.defaults-table {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.defaults-row {
    display: grid;
    grid-template-columns: 1fr 220px 220px;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 10px;
    border: 1px solid var(--color-light);
    border-radius: 8px;
}

.defaults-check {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-start;
}

.defaults-check input[type="checkbox"] {
    margin: 0;
}

.defaults-check.is-disabled {
    opacity: 0.45;
}

.zones-stack {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.zone-label-text {
    font-size: 12px;
    color: #555;
}

.module-zone-subrow {
    margin-top: 6px;
    border-style: dashed;
    background: #fafafa;
}

.module-zone-label {
    font-size: 13px;
    color: #444;
    padding-left: 10px;
}

.module-zone-group {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.module-zone-item {
    font-size: 13px;
    color: #444;
    padding-left: 0;
    line-height: 1.2;
}

.modal-modules-list {
    max-height: 45vh;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: var(--spacing-md);
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
}
</style>

<script>
const inviteUserBtn = document.getElementById('inviteUserBtn');
const inviteUserModal = document.getElementById('inviteUserModal');
const closeInviteUserModal = document.getElementById('closeInviteUserModal');
const cancelInviteUser = document.getElementById('cancelInviteUser');
const inviteUserForm = document.getElementById('inviteUserForm');
const inviteUserError = document.getElementById('inviteUserError');
const inviteUserSuccess = document.getElementById('inviteUserSuccess');
const entityId = <?php echo json_encode((string)($_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? ''))); ?>;
const apiBaseUrl = <?php echo json_encode(getApiBaseUrl()); ?>;
const jwtToken = <?php echo json_encode(getJWTToken()); ?>;
const servicesCatalog = <?php echo json_encode($services, JSON_UNESCAPED_UNICODE); ?>;
const defaultModuleZoneAdmin = <?php echo json_encode($defaultModuleZoneAdmin, JSON_UNESCAPED_UNICODE); ?>;
const defaultModuleZoneUser = <?php echo json_encode($defaultModuleZoneUser, JSON_UNESCAPED_UNICODE); ?>;
let moduleZoneDefinitions = [];

(async () => {
    await fetchModuleZoneDefinitions();
    renderDefaultModuleZoneRows();
})();

function openInviteUserModal() {
    inviteUserError.textContent = '';
    inviteUserSuccess.textContent = '';
    inviteUserForm.reset();
    inviteUserModal.style.display = 'flex';
}

function closeInviteModal() {
    inviteUserModal.style.display = 'none';
}

inviteUserBtn?.addEventListener('click', openInviteUserModal);
closeInviteUserModal?.addEventListener('click', closeInviteModal);
cancelInviteUser?.addEventListener('click', closeInviteModal);
inviteUserModal?.addEventListener('click', (e) => {
    if (e.target === inviteUserModal) closeInviteModal();
});

inviteUserForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    inviteUserError.textContent = '';
    inviteUserSuccess.textContent = '';

    const email = document.getElementById('inviteUserEmail').value.trim();
    const role = document.getElementById('inviteUserRole').value;
    if (!email || !entityId) {
        inviteUserError.textContent = 'Email ou entité invalide.';
        return;
    }

    try {
        const response = await fetch(`${apiBaseUrl}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(jwtToken ? { 'Authorization': 'Bearer ' + jwtToken } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ email, entityId, role })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erreur lors de l\'invitation');
        }
        inviteUserSuccess.textContent = data.message || 'Invitation envoyée.';
        setTimeout(() => window.location.reload(), 800);
    } catch (error) {
        inviteUserError.textContent = error.message || 'Erreur lors de l\'invitation';
    }
});

const moduleFilterInput = document.getElementById('moduleFilterInput');
const defaultsRows = Array.from(document.querySelectorAll('.defaults-row'));
const saveDefaultPermissionsBtn = document.getElementById('saveDefaultPermissionsBtn');
const defaultPermissionsError = document.getElementById('defaultPermissionsError');
const defaultPermissionsSuccess = document.getElementById('defaultPermissionsSuccess');
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

function formatZoneLabel(zone) {
    const key = String(zone?.key || '').toLowerCase();
    if (key === 'configure') return 'Paramétrage';
    if (key === 'use') return 'Utilisation';
    return String(zone?.label || zone?.key || '').trim();
}

async function fetchModuleZoneDefinitions() {
    const defs = [];
    for (const service of servicesCatalog) {
        const slug = String(service?.slug || '').trim();
        if (!slug) continue;
        try {
            const response = await fetch(`${apiBaseUrl}/${encodeURIComponent(slug)}/permission-zones`, {
                method: 'GET',
                headers: { ...(jwtToken ? { 'Authorization': 'Bearer ' + jwtToken } : {}) },
                credentials: 'include'
            });
            if (!response.ok) continue;
            const data = await response.json();
            const zones = Array.isArray(data?.data?.zones) ? data.data.zones : [];
            if (zones.length === 0) continue;
            defs.push({
                slug,
                name: String(service?.name || slug),
                zones: zones.map((z) => ({
                    key: String(z?.key || '').trim().toLowerCase(),
                    label: formatZoneLabel(z)
                })).filter((z) => z.key)
            });
        } catch (_) {}
    }
    moduleZoneDefinitions = defs;
}

function renderDefaultModuleZoneRows() {
    document.querySelectorAll('.module-zone-subrow').forEach((el) => el.remove());

    const rowsBySlug = new Map();
    document.querySelectorAll('.base-module-row').forEach((row) => {
        const slug = String(row.getAttribute('data-service-slug') || '').trim().toLowerCase();
        if (slug) rowsBySlug.set(slug, row);
    });

    moduleZoneDefinitions.forEach((mod) => {
        const baseRow = rowsBySlug.get(mod.slug);
        if (!baseRow) return;

        const moduleCol = baseRow.querySelector('.defaults-module');
        const baseAdmin = baseRow.querySelector('.default-admin-checkbox');
        const baseUser = baseRow.querySelector('.default-user-checkbox');
        const adminCell = baseAdmin?.closest('.defaults-check');
        const userCell = baseUser?.closest('.defaults-check');
        if (!moduleCol || !baseAdmin || !baseUser || !adminCell || !userCell) return;

        // Nettoyage ancien rendu dans la ligne module
        baseRow.querySelectorAll('.module-zones-inline').forEach((el) => el.remove());

        // Module avec zones => on n'utilise plus les checkboxes globales.
        baseAdmin.checked = false;
        baseUser.checked = false;
        baseAdmin.disabled = true;
        baseUser.disabled = true;
        adminCell.classList.remove('is-disabled');
        userCell.classList.remove('is-disabled');

        // On remplace complètement le contenu Admin/User pour éviter toute superposition.
        adminCell.innerHTML = '';
        userCell.innerHTML = '';

        const zonesInModule = document.createElement('div');
        zonesInModule.className = 'module-zones-inline module-zone-group';

        const zonesInAdmin = document.createElement('div');
        zonesInAdmin.className = 'module-zones-inline module-zone-group';

        const zonesInUser = document.createElement('div');
        zonesInUser.className = 'module-zones-inline module-zone-group';

        mod.zones.forEach((zone) => {
            const key = `${mod.slug}:${zone.key}`;

            const zoneLabel = document.createElement('div');
            zoneLabel.className = 'module-zone-item';
            zoneLabel.textContent = `${zone.label}`;
            zonesInModule.appendChild(zoneLabel);

            const adminLine = document.createElement('label');
            adminLine.className = 'defaults-check';
            adminLine.innerHTML = `<input type="checkbox" class="default-zone-admin" data-key="${key}" aria-label="Admin ${escapeHtml(zone.label)}">`;
            zonesInAdmin.appendChild(adminLine);

            const userLine = document.createElement('label');
            userLine.className = 'defaults-check';
            userLine.innerHTML = `<input type="checkbox" class="default-zone-user" data-key="${key}" aria-label="User ${escapeHtml(zone.label)}">`;
            zonesInUser.appendChild(userLine);
        });

        moduleCol.appendChild(zonesInModule);
        adminCell.appendChild(zonesInAdmin);
        userCell.appendChild(zonesInUser);
    });

    const adminMap = (defaultModuleZoneAdmin && typeof defaultModuleZoneAdmin === 'object') ? defaultModuleZoneAdmin : {};
    const userMap = (defaultModuleZoneUser && typeof defaultModuleZoneUser === 'object') ? defaultModuleZoneUser : {};

    Object.keys(adminMap).forEach((slug) => {
        (Array.isArray(adminMap[slug]) ? adminMap[slug] : []).forEach((zone) => {
            const el = document.querySelector(`.default-zone-admin[data-key="${slug}:${zone}"]`);
            if (el) el.checked = true;
        });
    });
    Object.keys(userMap).forEach((slug) => {
        (Array.isArray(userMap[slug]) ? userMap[slug] : []).forEach((zone) => {
            const el = document.querySelector(`.default-zone-user[data-key="${slug}:${zone}"]`);
            if (el) el.checked = true;
        });
    });
}

function readDefaultModuleZonePayload() {
    const module_zone_admin = {};
    const module_zone_user = {};
    document.querySelectorAll('.default-zone-admin:checked').forEach((el) => {
        const [slug, zone] = String(el.getAttribute('data-key') || '').split(':');
        if (!slug || !zone) return;
        if (!module_zone_admin[slug]) module_zone_admin[slug] = [];
        module_zone_admin[slug].push(zone);
    });
    document.querySelectorAll('.default-zone-user:checked').forEach((el) => {
        const [slug, zone] = String(el.getAttribute('data-key') || '').split(':');
        if (!slug || !zone) return;
        if (!module_zone_user[slug]) module_zone_user[slug] = [];
        module_zone_user[slug].push(zone);
    });
    return { module_zone_admin, module_zone_user };
}

moduleFilterInput?.addEventListener('input', () => {
    const term = moduleFilterInput.value.trim().toLowerCase();
    defaultsRows.forEach((row) => {
        const name = row.getAttribute('data-module-name') || '';
        row.style.display = !term || name.includes(term) ? '' : 'none';
    });
});

saveDefaultPermissionsBtn?.addEventListener('click', async () => {
    defaultPermissionsError.textContent = '';
    defaultPermissionsSuccess.textContent = '';
    try {
        const admin = Array.from(document.querySelectorAll('.default-admin-checkbox:checked')).map((el) => el.value);
        const user = Array.from(document.querySelectorAll('.default-user-checkbox:checked')).map((el) => el.value);
        const { module_zone_admin, module_zone_user } = readDefaultModuleZonePayload();
        const response = await fetch(`${apiBaseUrl}/entity-user-config/defaults?entity_id=${encodeURIComponent(entityId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(jwtToken ? { 'Authorization': 'Bearer ' + jwtToken } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ admin, user, module_zone_admin, module_zone_user })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Erreur mise à jour permissions par défaut');
        defaultPermissionsSuccess.textContent = data.message || 'Permissions par défaut enregistrées.';
    } catch (error) {
        defaultPermissionsError.textContent = error.message || 'Erreur mise à jour permissions par défaut.';
    }
});

const userModulesModal = document.getElementById('userModulesModal');
const closeUserModulesModal = document.getElementById('closeUserModulesModal');
const cancelUserModules = document.getElementById('cancelUserModules');
const saveUserModulesBtn = document.getElementById('saveUserModulesBtn');
const userModulesModalTitle = document.getElementById('userModulesModalTitle');
const userModulesList = document.getElementById('userModulesList');
const userModulesFilterInput = document.getElementById('userModulesFilterInput');
const userModulesError = document.getElementById('userModulesError');
const userModulesSuccess = document.getElementById('userModulesSuccess');
let activeUserIdForModules = '';

function renderUserModuleRows(selectedServiceIds) {
    const selectedSet = new Set(selectedServiceIds || []);
    userModulesList.innerHTML = '';
    const zonesBySlug = new Map(moduleZoneDefinitions.map((d) => [d.slug, d.zones]));
    const zonePerms = window.__activeUserZonePerms && typeof window.__activeUserZonePerms === 'object'
        ? window.__activeUserZonePerms
        : {};
    servicesCatalog.forEach((service) => {
        const id = String(service.id || '');
        const name = String(service.name || 'Module');
        const slug = String(service.slug || '').trim().toLowerCase();
        const icon = String(service.icon || '🧩');
        const row = document.createElement('div');
        row.className = 'defaults-row user-module-row';
        row.setAttribute('data-module-name', name.toLowerCase());
        const moduleZones = zonesBySlug.get(slug) || [];
        const activeZones = new Set((Array.isArray(zonePerms[slug]) ? zonePerms[slug] : []).map((z) => String(z)));
        const zonesHtml = moduleZones.length > 0
            ? `
                <div class="module-zones-inline zones-stack">
                    ${moduleZones.map((zone) => `<label class="defaults-check"><input type="checkbox" class="user-zone-checkbox" data-key="${slug}:${zone.key}" ${activeZones.has(zone.key) ? 'checked' : ''}> ${escapeHtml(name)} · ${escapeHtml(zone.label)}</label>`).join('')}
                </div>
            `
            : '';
        if (moduleZones.length > 0) {
            row.innerHTML = `
                <div class="defaults-module"><strong>${icon} ${name}</strong>${zonesHtml}</div>
                <div></div>
                <div></div>
            `;
        } else {
            row.innerHTML = `
                <div class="defaults-module"><strong>${icon} ${name}</strong></div>
                <div></div>
                <label class="defaults-check">
                    <input type="checkbox" class="user-module-checkbox" value="${id}" ${selectedSet.has(id) ? 'checked' : ''}>
                    Autorisé
                </label>
            `;
        }
        userModulesList.appendChild(row);
    });
}

function openUserModulesModal(userId, userEmail, serviceIds, zonePermissions) {
    activeUserIdForModules = userId;
    userModulesError.textContent = '';
    userModulesSuccess.textContent = '';
    userModulesModalTitle.textContent = `Gérer les modules : ${userEmail}`;
    window.__activeUserZonePerms = (zonePermissions && typeof zonePermissions === 'object' && !Array.isArray(zonePermissions)) ? zonePermissions : {};
    renderUserModuleRows(serviceIds || []);
    userModulesFilterInput.value = '';
    userModulesModal.style.display = 'flex';
}

function closeUserModules() {
    userModulesModal.style.display = 'none';
    activeUserIdForModules = '';
    window.__activeUserZonePerms = {};
}

document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const button = target ? target.closest('.manage-user-modules') : null;
    if (!button) return;
    const userId = button.getAttribute('data-user-id') || '';
    const userEmail = button.getAttribute('data-user-email') || 'Utilisateur';
    let serviceIds = [];
    let zonePermissions = {};
    try {
        serviceIds = JSON.parse(button.getAttribute('data-user-services') || '[]');
        if (!Array.isArray(serviceIds)) serviceIds = [];
    } catch (_) {
        serviceIds = [];
    }
    try {
        zonePermissions = JSON.parse(button.getAttribute('data-user-zone-permissions') || '{}');
        if (!zonePermissions || typeof zonePermissions !== 'object' || Array.isArray(zonePermissions)) zonePermissions = {};
    } catch (_) {
        zonePermissions = {};
    }
    openUserModulesModal(userId, userEmail, serviceIds.map(String), zonePermissions);
});

closeUserModulesModal?.addEventListener('click', closeUserModules);
cancelUserModules?.addEventListener('click', closeUserModules);
userModulesModal?.addEventListener('click', (e) => {
    if (e.target === userModulesModal) closeUserModules();
});

userModulesFilterInput?.addEventListener('input', () => {
    const term = userModulesFilterInput.value.trim().toLowerCase();
    userModulesList.querySelectorAll('.user-module-row').forEach((row) => {
        const name = row.getAttribute('data-module-name') || '';
        row.style.display = !term || name.includes(term) ? '' : 'none';
    });
});

saveUserModulesBtn?.addEventListener('click', async () => {
    userModulesError.textContent = '';
    userModulesSuccess.textContent = '';
    if (!activeUserIdForModules) {
        userModulesError.textContent = 'Utilisateur invalide.';
        return;
    }
    try {
        const services_authorized = Array.from(userModulesList.querySelectorAll('.user-module-checkbox:checked')).map((el) => el.value);
        const module_zone_permissions = {};
        userModulesList.querySelectorAll('.user-zone-checkbox:checked').forEach((el) => {
            const [slug, zone] = String(el.getAttribute('data-key') || '').split(':');
            if (!slug || !zone) return;
            if (!module_zone_permissions[slug]) module_zone_permissions[slug] = [];
            module_zone_permissions[slug].push(zone);
        });
        const response = await fetch(`${apiBaseUrl}/entity-user-config/user/${encodeURIComponent(activeUserIdForModules)}?entity_id=${encodeURIComponent(entityId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(jwtToken ? { 'Authorization': 'Bearer ' + jwtToken } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ services_authorized, module_zone_permissions })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Erreur lors de la mise à jour utilisateur');
        userModulesSuccess.textContent = 'Permissions utilisateur enregistrées.';
        setTimeout(() => window.location.reload(), 600);
    } catch (error) {
        userModulesError.textContent = error.message || 'Erreur lors de la mise à jour utilisateur';
    }
});

document.addEventListener('click', async function(e) {
    const target = e.target instanceof Element ? e.target : null;
    const button = target ? target.closest('.transfer-owner') : null;
    if (!button) return;

    const userId = button.getAttribute('data-user-id');
    const userEmail = button.getAttribute('data-user-email') || 'cet administrateur';
    const entityId = <?php echo json_encode((string)($_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? ''))); ?>;
    if (!userId || !entityId) {
        alert('Informations manquantes pour transferer la couronne.');
        return;
    }

    if (!confirm(`Transferer la couronne owner a "${userEmail}" ?`)) {
        return;
    }

    try {
        const apiBaseUrl = <?php echo json_encode(getApiBaseUrl()); ?>;
        const jwtToken = <?php echo json_encode(getJWTToken()); ?>;
        const response = await fetch(`${apiBaseUrl}/entity-user-config/owner/transfer?entity_id=${encodeURIComponent(entityId)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(jwtToken ? { 'Authorization': 'Bearer ' + jwtToken } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ targetUserId: userId })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erreur lors du transfert de la couronne');
        }
        window.location.reload();
    } catch (error) {
        alert(error.message || 'Erreur lors du transfert de la couronne.');
    }
});

document.addEventListener('click', async function(e) {
    const target = e.target instanceof Element ? e.target : null;
    const button = target ? target.closest('.delete-user-account') : null;
    if (!button) return;

    const userId = button.getAttribute('data-user-id');
    const userEmail = button.getAttribute('data-user-email') || 'cet utilisateur';
    if (!userId) {
        alert('ID utilisateur manquant.');
        return;
    }

    if (!confirm(`Supprimer définitivement le compte "${userEmail}" ? Cette action est irréversible.`)) {
        return;
    }

    try {
        const apiBaseUrl = <?php echo json_encode(getApiBaseUrl()); ?>;
        const jwtToken = <?php echo json_encode(getJWTToken()); ?>;
        const response = await fetch(`${apiBaseUrl}/users/${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(jwtToken ? { 'Authorization': 'Bearer ' + jwtToken } : {})
            },
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erreur lors de la suppression du compte');
        }
        window.location.reload();
    } catch (error) {
        alert(error.message || 'Erreur lors de la suppression du compte.');
    }
});
</script>

<?php require_once '../includes/footer.php'; ?>
