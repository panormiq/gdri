<?php
/**
 * Configuration > Roles d'entite
 * - Roles structurels : admin, user (toujours presents)
 * - Roles fonctionnels : service_commercial, sav, etc. (ajoutables)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
if (hasRole(ROLE_ADMIN_GDRI) && empty($currentEntrepriseId)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = "Roles de l'entite";
$successMessage = '';
$errorMessage = '';
$roles = [];
$structuralRoles = [];
$functionalRoles = [];

function normalizeRoleKey($name) {
    $name = strtolower(trim((string) $name));
    $name = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
    $name = preg_replace('/[^a-z0-9]+/', '_', $name);
    $name = trim($name, '_');
    return $name ?: '';
}

function callApi($method, $url, $token, $body = null) {
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
    if ($err) return ['ok' => false, 'message' => $err, 'code' => 0, 'data' => null];
    $decoded = json_decode((string) $raw, true);
    return ['ok' => $code >= 200 && $code < 300, 'message' => $decoded['message'] ?? null, 'code' => $code, 'data' => $decoded];
}

function renderRoleCard(array $role): void {
    $key = (string) ($role['key'] ?? '');
    $label = (string) ($role['label'] ?? $key);
    $description = (string) ($role['description'] ?? '');
    $isSystem = (bool) ($role['isSystem'] ?? false);
    $isActive = (bool) ($role['isActive'] ?? true);
    ?>
    <div class="card role-card">
        <div class="role-head">
            <h3><?= escape($label); ?></h3>
            <span class="badge <?= $isActive ? 'badge-success' : 'badge-warning' ?>">
                <?= $isActive ? 'Actif' : 'Inactif'; ?>
            </span>
        </div>
        <p class="text-muted"><?= escape($description ?: 'Aucune description'); ?></p>
        <p><strong>Cle:</strong> <code><?= escape($key); ?></code></p>
        <?php if ($isSystem): ?>
            <p class="small text-muted">Role structurel — toujours present, non supprimable.</p>
        <?php endif; ?>

        <div class="role-actions">
            <?php if (!$isSystem): ?>
                <form method="POST">
                    <input type="hidden" name="action" value="toggle_role">
                    <input type="hidden" name="role_key" value="<?= escape($key); ?>">
                    <button type="submit" class="btn btn-outline"><?= $isActive ? 'Desactiver' : 'Activer'; ?></button>
                </form>
                <form method="POST" onsubmit="return confirm('Supprimer ce role ?');">
                    <input type="hidden" name="action" value="delete_role">
                    <input type="hidden" name="role_key" value="<?= escape($key); ?>">
                    <button type="submit" class="btn btn-danger">Supprimer</button>
                </form>
            <?php endif; ?>
        </div>
    </div>
    <?php
}

try {
    if (empty($currentEntrepriseId)) throw new Exception("Aucune entite active.");
    $token = getJWTToken();
    if (!$token) throw new Exception("Session invalide.");
    $apiBase = rtrim(getApiBaseUrl(), '/');
    $scopeQuery = '?entity_id=' . urlencode((string)$currentEntrepriseId);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $action = $_POST['action'] ?? '';
        if ($action === 'create_role') {
            $label = trim((string) ($_POST['label'] ?? ''));
            $description = trim((string) ($_POST['description'] ?? ''));
            $key = normalizeRoleKey($label);
            $resp = callApi('POST', $apiBase . '/entity-roles' . $scopeQuery, $token, [
                'label' => $label,
                'description' => $description,
                'key' => $key
            ]);
            if ($resp['ok']) $successMessage = 'Role fonctionnel cree avec succes.';
            else $errorMessage = $resp['message'] ?: 'Erreur creation role.';
        } elseif ($action === 'toggle_role') {
            $key = trim((string) ($_POST['role_key'] ?? ''));
            $resp = callApi('PUT', $apiBase . '/entity-roles/' . rawurlencode($key) . '/toggle' . $scopeQuery, $token);
            if ($resp['ok']) $successMessage = 'Role mis a jour.';
            else $errorMessage = $resp['message'] ?: 'Erreur mise a jour role.';
        } elseif ($action === 'delete_role') {
            $key = trim((string) ($_POST['role_key'] ?? ''));
            $resp = callApi('DELETE', $apiBase . '/entity-roles/' . rawurlencode($key) . $scopeQuery, $token);
            if ($resp['ok']) $successMessage = 'Role supprime.';
            else $errorMessage = $resp['message'] ?: 'Erreur suppression role.';
        }
    }

    $resp = callApi('GET', $apiBase . '/entity-roles' . $scopeQuery, $token);
    if (!$resp['ok']) throw new Exception($resp['message'] ?: "Impossible de charger les roles.");
    $roles = $resp['data']['data'] ?? [];
    foreach ($roles as $role) {
        if (!empty($role['isSystem'])) {
            $structuralRoles[] = $role;
        } else {
            $functionalRoles[] = $role;
        }
    }
} catch (Exception $e) {
    $errorMessage = $e->getMessage();
}

require_once __DIR__ . '/../../includes/header.php';
?>

<section class="section">
    <div class="container">
        <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <h2 style="margin:0;">Roles de l'entite</h2>
        </div>

        <?php if ($successMessage): ?>
            <div class="alert alert-success"><?= escape($successMessage); ?></div>
        <?php endif; ?>
        <?php if ($errorMessage): ?>
            <div class="alert alert-error"><?= escape($errorMessage); ?></div>
        <?php endif; ?>

        <div class="card" style="margin-bottom: 14px;">
            <p class="text-muted" style="margin-top:0;">
                Les <strong>roles structurels</strong> definissent le niveau d'acces de base (administrateur ou utilisateur).
                Les <strong>roles fonctionnels</strong> permettent d'affiner les droits metier (commercial, SAV, etc.).
            </p>
        </div>

        <div class="roles-section">
            <h3>Roles structurels</h3>
            <p class="text-muted small">Toujours presents — utilises pour les permissions par defaut et l'appartenance a l'entite.</p>
            <div class="hub-cards-grid">
                <?php if (empty($structuralRoles)): ?>
                    <div class="card role-card"><p class="text-muted">Chargement des roles structurels…</p></div>
                <?php else: ?>
                    <?php foreach ($structuralRoles as $role): ?>
                        <?php renderRoleCard($role); ?>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>

        <div class="roles-section">
            <h3>Roles fonctionnels</h3>
            <p class="text-muted small">Ajoutez des roles metier pour regrouper des utilisateurs et leurs droits (IA, modules, etc.).</p>

            <div class="card" style="margin-bottom: 14px;">
                <h4 style="margin-top:0;">Nouveau role fonctionnel</h4>
                <form method="POST" style="display:grid; gap:10px;">
                    <input type="hidden" name="action" value="create_role">
                    <div>
                        <label for="label">Nom du role</label>
                        <input id="label" name="label" class="form-control" placeholder="Ex: Service commercial" required>
                    </div>
                    <div>
                        <label for="description">Description (optionnel)</label>
                        <input id="description" name="description" class="form-control" placeholder="Ex: Traite les demandes commerciales">
                    </div>
                    <div>
                        <button type="submit" class="btn btn-primary">Creer le role fonctionnel</button>
                    </div>
                </form>
            </div>

            <div class="hub-cards-grid">
                <?php if (empty($functionalRoles)): ?>
                    <div class="card role-card">
                        <p class="text-muted" style="margin:0;">Aucun role fonctionnel pour le moment.</p>
                    </div>
                <?php else: ?>
                    <?php foreach ($functionalRoles as $role): ?>
                        <?php renderRoleCard($role); ?>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
    </div>
</section>

<style>
.roles-section {
    margin-bottom: 24px;
}
.roles-section h3 {
    margin-bottom: 4px;
}
.roles-section .hub-cards-grid {
    margin-top: 12px;
}
.role-card h3 { margin: 0; }
.role-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}
.role-actions {
    margin-top: 8px;
    display: flex;
    gap: 8px;
}
.alert {
    padding: 10px 12px;
    border-radius: 6px;
    margin: 10px 0;
}
.alert-success {
    background: #d4edda;
    color: #155724;
}
.alert-error {
    background: #f8d7da;
    color: #721c24;
}
</style>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
