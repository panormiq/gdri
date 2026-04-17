<?php
require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Utilisateurs & Permissions';
$successMessage = '';
$errorMessage = '';
$selectedUserId = $_GET['userId'] ?? null;
$users = [];
$services = [];
$roles = [];

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

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $uid = (string) ($_POST['user_id'] ?? '');
        $selectedUserId = $uid;
        $moduleIds = $_POST['services_authorized'] ?? [];
        $roleKeys = $_POST['entity_roles'] ?? [];
        if (!is_array($moduleIds)) $moduleIds = [];
        if (!is_array($roleKeys)) $roleKeys = [];
        $resp = callApiUsersCfg('PUT', $apiBase . '/entity-user-config/user/' . rawurlencode($uid) . $scope, $token, [
            'services_authorized' => array_values($moduleIds),
            'entity_roles' => array_values($roleKeys)
        ]);
        if ($resp['ok']) $successMessage = 'Permissions mises à jour avec succès.';
        else $errorMessage = $resp['message'] ?: 'Erreur mise à jour.';
    }

    $resp = callApiUsersCfg('GET', $apiBase . '/entity-user-config' . $scope, $token);
    if (!$resp['ok']) throw new Exception($resp['message'] ?: 'Chargement impossible.');
    $payload = $resp['data']['data'] ?? [];
    $users = $payload['users'] ?? [];
    $services = $payload['services'] ?? [];
    $roles = $payload['roles'] ?? [];
    if (!$selectedUserId && !empty($users)) $selectedUserId = (string) ($users[0]['id'] ?? '');
} catch (Exception $e) {
    $errorMessage = $e->getMessage();
}

$selectedUser = null;
foreach ($users as $u) {
    if ((string)($u['id'] ?? '') === (string)$selectedUserId) { $selectedUser = $u; break; }
}
$selectedIds = $selectedUser['services_authorized'] ?? [];
$selectedRoleKeys = $selectedUser['entity_roles'] ?? [];

require_once '../includes/header.php';
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Utilisateurs & Permissions</h1>
            <p class="hero-description">
                Gérez les accès aux modules pour chaque utilisateur de votre entreprise
            </p>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="section-title">
            <h2>Utilisateurs de l'entreprise</h2>
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
                    $isSelected = ($selectedUserId && $selectedUserId === $userIdStr);
                    ?>
                    <div class="user-card <?= $isSelected ? 'active' : '' ?>">
                        <div class="user-header">
                            <h3><?= escape($email); ?></h3>
                            <span class="badge <?= $status === 'active' ? 'badge-success' : 'badge-warning' ?>">
                                <?= $status === 'active' ? 'Actif' : 'Inactif' ?>
                            </span>
                        </div>
                        <p><strong>Rôle:</strong> <?= escape($role); ?></p>
                        <a class="btn btn-sm btn-outline" href="<?= url('pages/users.php?userId=' . urlencode($userIdStr)); ?>">
                            Gérer les modules
                        </a>
                    </div>
                <?php endforeach; ?>
            </div>

            <div class="permissions-panel">
                <div class="section-title">
                    <h2>Permissions modules</h2>
                    <?php if ($selectedUserId): ?>
                        <p class="text-muted">
                            Utilisateur sélectionné : <?= escape($selectedUser['email'] ?? 'Utilisateur'); ?>
                        </p>
                    <?php endif; ?>
                </div>

                <?php if (empty($services)): ?>
                    <div class="empty-state">
                        <p>Aucun module autorisé pour votre entreprise.</p>
                    </div>
                <?php elseif (!$selectedUserId): ?>
                    <div class="empty-state">
                        <p>Sélectionnez un utilisateur pour configurer ses permissions.</p>
                    </div>
                <?php else: ?>
                    <form method="POST" class="modules-form">
                        <input type="hidden" name="user_id" value="<?= escape($selectedUserId); ?>">
                        <div class="card" style="margin-bottom: var(--spacing-lg);">
                            <h3 style="margin-top:0;">Roles de l'utilisateur</h3>
                            <?php if (empty($roles)): ?>
                                <p class="text-muted">Aucun role defini.</p>
                            <?php else: ?>
                                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                    <?php foreach ($roles as $roleItem): ?>
                                        <?php $rk = (string)($roleItem['key'] ?? ''); ?>
                                        <label class="form-check" style="display:flex; align-items:center; gap:6px;">
                                            <input type="checkbox" name="entity_roles[]" value="<?= escape($rk); ?>" <?= in_array($rk, $selectedRoleKeys, true) ? 'checked' : ''; ?>>
                                            <span><?= escape($roleItem['label'] ?? $rk); ?></span>
                                        </label>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                        </div>

                        <div class="modules-grid">
                            <?php foreach ($services as $service): ?>
                                <?php $serviceId = (string) ($service['id'] ?? ''); ?>
                                <label class="module-card" for="service-<?= escape($serviceId); ?>">
                                    <div class="module-card-header">
                                        <span class="module-icon"><?= escape($service['icon'] ?? '🧩'); ?></span>
                                        <div class="module-title">
                                            <h3><?= escape($service['name'] ?? 'Module'); ?></h3>
                                            <p class="module-description"><?= escape($service['description'] ?? ''); ?></p>
                                        </div>
                                    </div>
                                    <div class="module-toggle">
                                        <input
                                            type="checkbox"
                                            id="service-<?= escape($serviceId); ?>"
                                            name="services_authorized[]"
                                            value="<?= escape($serviceId); ?>"
                                            <?= in_array($serviceId, $selectedIds, true) ? 'checked' : ''; ?>
                                        >
                                        <span class="toggle-label">Autorisé</span>
                                    </div>
                                </label>
                            <?php endforeach; ?>
                        </div>

                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Enregistrer</button>
                        </div>
                    </form>
                <?php endif; ?>
            </div>
        <?php endif; ?>
    </div>
</section>

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
</style>

<?php require_once '../includes/footer.php'; ?>
