<?php
/**
 * Suivi des utilisateurs GDRI (admin)
 * Fichier : pages/user-activity.php
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Suivi utilisateurs';

$entities = [];
try {
    $jwt = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if ($jwt && $apiBase) {
        $ch = curl_init($apiBase . '/entities/context');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $jwt,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if (!$err && $code >= 200 && $code < 300) {
            $decoded = json_decode((string) $raw, true);
            $entities = is_array($decoded['data']['entities'] ?? null) ? $decoded['data']['entities'] : [];
            usort($entities, function ($a, $b) {
                return strcmp((string)($a['name'] ?? ''), (string)($b['name'] ?? ''));
            });
        }
    }
} catch (Exception $e) {
    $entities = [];
}

require_once '../includes/header.php';
?>

<main class="container" style="padding: 30px 0;">
    <div class="card" style="padding: 20px;">
        <h2 style="margin-top: 0;">Suivi des utilisateurs GDRI</h2>
        <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;">
            <div>
                <label style="display: block; margin-bottom: 5px; color: #666;">Type d'événement:</label>
                <select id="filter-log-event" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 220px;">
                    <option value="">Tous</option>
                    <option value="login">Connexion</option>
                    <option value="page_view">Vue page</option>
                </select>
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; color: #666;">Entreprise:</label>
                <select id="filter-log-entreprise" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 260px;">
                    <option value="">Toutes</option>
                    <?php foreach ($entities as $entity): ?>
                        <?php
                        $entityId = isset($entity['_id']) ? (string) $entity['_id'] : '';
                        $entityName = $entity['name'] ?? 'Entreprise';
                        ?>
                        <option value="<?php echo htmlspecialchars($entityId); ?>">
                            <?php echo htmlspecialchars($entityName); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; color: #666;">Email utilisateur:</label>
                <input id="filter-log-email" type="text" placeholder="ex: admin@gdri.fr" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 260px;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; color: #666;">Du:</label>
                <input id="filter-log-from" type="datetime-local" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; color: #666;">Au:</label>
                <input id="filter-log-to" type="datetime-local" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <button id="btn-refresh-logs" class="btn btn-primary">Actualiser</button>
            <span id="activity-logs-status" style="color: #666;"></span>
        </div>

        <table id="activity-logs-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Événement</th>
                    <th>Détails</th>
                    <th>IP</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>
</main>

<script>
const USER_LOGS_ENDPOINT = <?php echo json_encode(url('auth/user-activity-logs.php')); ?>;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function loadUserActivityLogs() {
    const status = document.getElementById('activity-logs-status');
    const tbody = document.querySelector('#activity-logs-table tbody');
    if (!tbody) return;

    if (status) status.textContent = 'Chargement...';
    const params = new URLSearchParams();
    params.set('limit', '50');

    const eventType = document.getElementById('filter-log-event')?.value;
    if (eventType) params.set('event_type', eventType);

    const entrepriseId = document.getElementById('filter-log-entreprise')?.value;
    if (entrepriseId) params.set('entreprise_id', entrepriseId);

    const email = document.getElementById('filter-log-email')?.value?.trim();
    if (email) params.set('user_email', email);

    const fromValue = document.getElementById('filter-log-from')?.value;
    if (fromValue) {
        const fromDate = new Date(fromValue);
        if (!isNaN(fromDate.getTime())) {
            params.set('from', fromDate.toISOString());
        }
    }

    const toValue = document.getElementById('filter-log-to')?.value;
    if (toValue) {
        const toDate = new Date(toValue);
        if (!isNaN(toDate.getTime())) {
            params.set('to', toDate.toISOString());
        }
    }

    try {
        const response = await fetch(`${USER_LOGS_ENDPOINT}?${params.toString()}`, {
            method: 'GET',
            credentials: 'include'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erreur lors du chargement des logs');
        }

        const logs = Array.isArray(data.logs) ? data.logs : [];
        if (!logs.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">Aucun résultat</td></tr>';
        } else {
            tbody.innerHTML = logs.map(log => {
                const createdAt = log.created_at ? new Date(log.created_at).toLocaleString() : '-';
                let details = '';
                if (log.event_type === 'page_view') {
                    details = log.event_data?.url || log.event_data?.page || '';
                } else if (log.event_type === 'login') {
                    details = log.event_data?.source ? `Source: ${log.event_data.source}` : '';
                }
                return `
                    <tr>
                        <td>${escapeHtml(createdAt)}</td>
                        <td>${escapeHtml(log.user_email || '-')}</td>
                        <td>${escapeHtml(log.user_role || '-')}</td>
                        <td>${escapeHtml(log.event_type || '-')}</td>
                        <td>${escapeHtml(details || '-')}</td>
                        <td>${escapeHtml(log.ip_address || '-')}</td>
                    </tr>
                `;
            }).join('');
        }

        if (status) status.textContent = `${logs.length} log(s)`;
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #b00020;">Erreur de chargement</td></tr>';
        if (status) status.textContent = error.message;
    }
}

document.getElementById('btn-refresh-logs')?.addEventListener('click', loadUserActivityLogs);
document.getElementById('filter-log-event')?.addEventListener('change', loadUserActivityLogs);
document.getElementById('filter-log-entreprise')?.addEventListener('change', loadUserActivityLogs);
document.getElementById('filter-log-from')?.addEventListener('change', loadUserActivityLogs);
document.getElementById('filter-log-to')?.addEventListener('change', loadUserActivityLogs);
document.getElementById('filter-log-email')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        loadUserActivityLogs();
    }
});

loadUserActivityLogs();
</script>

<?php require_once '../includes/footer.php'; ?>
