<?php
/**
 * Console plateforme — Utilisateurs (vue globale).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requirePlatformConsoleAccess();

$entities = [];
$allUsers = [];
try {
    $token = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if ($token && $apiBase) {
        $ch = curl_init($apiBase . '/entities/context');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 200 && $code < 300) {
            $decoded = json_decode((string) $raw, true);
            $payload = $decoded['data'] ?? [];
            $entities = is_array($payload['entities'] ?? null) ? $payload['entities'] : [];
            $allUsers = is_array($payload['users'] ?? null) ? $payload['users'] : [];
        }
    }
} catch (Exception $e) {
    $entities = [];
    $allUsers = [];
}

$page_title = 'Utilisateurs';
require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Utilisateurs',
    'Vue globale de tous les comptes plateforme et rattachement aux entités.'
);
?>

<section class="section">
    <div class="container">
        <div class="section-title">
            <h2>Liste des utilisateurs</h2>
            <div class="section-actions">
                <button class="btn btn-secondary" id="createUserBtn" type="button">+ Créer un compte</button>
                <button class="btn btn-primary" id="addUserBtn" type="button">+ Ajouter un utilisateur</button>
            </div>
        </div>

        <div class="users-grid" id="usersGrid">
            <?php if (empty($allUsers)): ?>
                <div class="empty-state">
                    <p>Aucun utilisateur enregistré.</p>
                </div>
            <?php else: ?>
                <?php foreach ($allUsers as $user): ?>
                    <?php if (($user['role'] ?? '') === 'ADMIN_GDRI') continue; ?>
                    <div class="user-card">
                        <div class="user-header">
                            <h3><?= htmlspecialchars((string) ($user['email'] ?? '')) ?></h3>
                            <div class="user-actions">
                                <button
                                    class="btn-icon delete-user-account"
                                    type="button"
                                    data-user-id="<?= htmlspecialchars((string) $user['_id']) ?>"
                                    data-user-email="<?= htmlspecialchars((string) ($user['email'] ?? '')) ?>"
                                    title="Supprimer définitivement ce compte"
                                >✕</button>
                            </div>
                        </div>
                        <div class="user-details">
                            <p><strong>Rôle :</strong>
                                <span class="badge badge-info"><?= htmlspecialchars((string) ($user['role'] ?? '')) ?></span>
                            </p>
                            <p><strong>Statut :</strong>
                                <span class="badge <?= ($user['status'] ?? '') === 'active' ? 'badge-success' : 'badge-warning' ?>">
                                    <?= ($user['status'] ?? '') === 'active' ? 'Actif' : 'Inactif' ?>
                                </span>
                            </p>
                            <?php
                            $userEntities = [];
                            if (isset($user['entreprises']) && is_array($user['entreprises'])) {
                                foreach ($user['entreprises'] as $entreprise) {
                                    if (!isset($entreprise['entrepriseId'])) {
                                        continue;
                                    }
                                    $entityId = (string) $entreprise['entrepriseId'];
                                    $userEntity = array_filter($entities, function ($e) use ($entityId) {
                                        return (string) $e['_id'] === $entityId;
                                    });
                                    $userEntity = reset($userEntity);
                                    if ($userEntity) {
                                        $userEntities[] = $userEntity['name'] . ' (' . ($entreprise['role'] ?? 'user') . ')';
                                    }
                                }
                            }
                            if (empty($userEntities) && !empty($user['entity_id'])) {
                                $userEntity = array_filter($entities, function ($e) use ($user) {
                                    return (string) $e['_id'] === (string) $user['entity_id'];
                                });
                                $userEntity = reset($userEntity);
                                if ($userEntity) {
                                    $userEntities[] = $userEntity['name'];
                                }
                            }
                            ?>
                            <?php if (!empty($userEntities)): ?>
                                <p><strong>Entité(s) :</strong> <?= htmlspecialchars(implode(', ', $userEntities)) ?></p>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</section>

<?php renderConsoleLayoutEnd(); ?>

<div class="modal-overlay" id="userModal">
    <div class="modal-content">
        <button class="modal-close" id="closeUserModal" type="button">×</button>
        <div class="modal-header"><h2>Ajouter un utilisateur</h2></div>
        <div class="modal-body">
            <form id="userForm">
                <div class="form-group">
                    <label for="userEntity">Entité *</label>
                    <select id="userEntity" name="entityId" required>
                        <option value="">Sélectionner une entité</option>
                        <?php foreach ($entities as $entity): ?>
                            <option value="<?= htmlspecialchars((string) $entity['_id']) ?>">
                                <?= htmlspecialchars((string) $entity['name']) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label for="userId">Utilisateur *</label>
                    <select id="userId" name="userId" required>
                        <option value="">Sélectionner d'abord une entité</option>
                    </select>
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

<div class="modal-overlay" id="createUserModal">
    <div class="modal-content">
        <button class="modal-close" id="closeCreateUserModal" type="button">×</button>
        <div class="modal-header"><h2>Créer un compte utilisateur</h2></div>
        <div class="modal-body">
            <form id="createUserForm">
                <div class="form-group">
                    <label for="createUserEntity">Entité *</label>
                    <select id="createUserEntity" name="entityId" required>
                        <option value="">Sélectionner une entité</option>
                        <?php foreach ($entities as $entity): ?>
                            <option value="<?= htmlspecialchars((string) $entity['_id']) ?>">
                                <?= htmlspecialchars((string) $entity['name']) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label for="createUserEmail">Email *</label>
                    <input type="email" id="createUserEmail" name="email" required>
                </div>
                <div class="form-group">
                    <label for="createUserRole">Rôle dans l'entité *</label>
                    <select id="createUserRole" name="role" required>
                        <option value="user">Utilisateur</option>
                        <option value="admin">Administrateur</option>
                    </select>
                </div>
                <div class="form-error" id="createUserFormError"></div>
                <div class="form-success" id="createUserFormSuccess"></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" id="cancelCreateUserForm">Annuler</button>
                    <button type="submit" class="btn btn-primary">Envoyer l'invitation</button>
                </div>
            </form>
        </div>
    </div>
</div>

<style>
.section-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.section-title { display: flex; justify-content: space-between; align-items: center; }
.users-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--spacing-lg); margin-top: var(--spacing-lg); }
.user-card { background: white; border-radius: 8px; padding: var(--spacing-lg); box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid var(--color-light); }
.user-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md); padding-bottom: var(--spacing-md); border-bottom: 1px solid var(--color-light); }
.user-header h3 { margin: 0; color: var(--color-primary); font-size: 1rem; word-break: break-all; }
.btn-icon { background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 4px; border-radius: 4px; }
.btn-icon:hover { background: var(--color-light); }
.badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; }
.badge-success { background: #d4edda; color: #155724; }
.badge-warning { background: #fff3cd; color: #856404; }
.badge-info { background: #d1ecf1; color: #0c5460; }
.empty-state { text-align: center; padding: var(--spacing-xl); color: var(--color-gray); }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--spacing-md); margin-top: var(--spacing-lg); }
</style>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const apiBaseUrl = '<?php echo getApiBaseUrl(); ?>';
    const jwtToken = '<?php echo getJWTToken(); ?>';

    const openModal = (id) => { document.getElementById(id).style.display = 'flex'; };
    const closeModal = (id) => { document.getElementById(id).style.display = 'none'; };

    document.getElementById('addUserBtn').addEventListener('click', () => openModal('userModal'));
    document.getElementById('createUserBtn').addEventListener('click', () => openModal('createUserModal'));
    document.getElementById('closeUserModal').addEventListener('click', () => closeModal('userModal'));
    document.getElementById('cancelUserForm').addEventListener('click', () => closeModal('userModal'));
    document.getElementById('closeCreateUserModal').addEventListener('click', () => closeModal('createUserModal'));
    document.getElementById('cancelCreateUserForm').addEventListener('click', () => closeModal('createUserModal'));

    ['userModal', 'createUserModal'].forEach((id) => {
        document.getElementById(id).addEventListener('click', function(e) {
            if (e.target === this) closeModal(id);
        });
    });

    async function loadAvailableUsers(entityId) {
        const userIdSelect = document.getElementById('userId');
        userIdSelect.innerHTML = '<option value="">Chargement...</option>';
        const response = await fetch(apiBaseUrl + '/users/available?entityId=' + encodeURIComponent(entityId), {
            headers: { 'Authorization': 'Bearer ' + jwtToken },
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) {
            userIdSelect.innerHTML = '<option value="">Erreur de chargement</option>';
            return;
        }
        userIdSelect.innerHTML = '<option value="">Sélectionner un utilisateur</option>';
        (data.data || []).forEach((user) => {
            const option = document.createElement('option');
            option.value = user._id;
            option.textContent = user.email + (user.username ? ' (' + user.username + ')' : '');
            userIdSelect.appendChild(option);
        });
    }

    document.getElementById('userEntity').addEventListener('change', function() {
        if (this.value) loadAvailableUsers(this.value);
    });

    document.getElementById('userForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formError = document.getElementById('userFormError');
        const formSuccess = document.getElementById('userFormSuccess');
        formError.style.display = 'none';
        formSuccess.style.display = 'none';
        const entityId = document.getElementById('userEntity').value;
        const userId = document.getElementById('userId').value;
        const role = document.getElementById('userRole').value;
        const response = await fetch(apiBaseUrl + '/entities/' + entityId + '/users', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + jwtToken, 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId, role })
        });
        const data = await response.json();
        if (!response.ok) {
            formError.textContent = data.message || 'Erreur';
            formError.style.display = 'block';
            return;
        }
        formSuccess.textContent = data.message || 'Utilisateur ajouté';
        formSuccess.style.display = 'block';
        setTimeout(() => window.location.reload(), 800);
    });

    document.getElementById('createUserForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formError = document.getElementById('createUserFormError');
        const formSuccess = document.getElementById('createUserFormSuccess');
        formError.textContent = '';
        formSuccess.textContent = '';
        const entityId = document.getElementById('createUserEntity').value;
        const email = document.getElementById('createUserEmail').value.trim();
        const role = document.getElementById('createUserRole').value;
        const response = await fetch(apiBaseUrl + '/users', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + jwtToken, 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ entityId, email, role })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            formError.textContent = data.message || 'Erreur';
            return;
        }
        formSuccess.textContent = data.message || 'Invitation envoyée';
        setTimeout(() => window.location.reload(), 800);
    });

    document.addEventListener('click', async function(e) {
        const button = e.target.closest('.delete-user-account');
        if (!button) return;
        const userId = button.getAttribute('data-user-id');
        const userEmail = button.getAttribute('data-user-email') || 'cet utilisateur';
        if (!confirm('Supprimer définitivement le compte "' + userEmail + '" ?')) return;
        const response = await fetch(apiBaseUrl + '/users/' + encodeURIComponent(userId), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + jwtToken, 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            alert(data.message || 'Erreur lors de la suppression');
            return;
        }
        window.location.reload();
    });
});
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
