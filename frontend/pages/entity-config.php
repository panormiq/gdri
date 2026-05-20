<?php
/**
 * Configuration de l'entité – Admin d'une entité (ADMIN_ENTITY, ou ADMIN_GDRI avec entité sélectionnée).
 * Hub pour : IA (LLMs, droits), Mail, etc. – tout ce qui configure l'entité, pas la plateforme.
 * Les serveurs IA et la config plateforme sont dans Administration (admin GDRI).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

// ADMIN_GDRI doit avoir une entité sélectionnée pour configurer.
// Important: `$currentEntreprise` est défini dans `includes/header.php`, donc ici
// on se base sur la session.
$currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
if (hasRole(ROLE_ADMIN_GDRI) && empty($currentEntrepriseId)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Configuration de l\'entité';
require_once __DIR__ . '/../includes/header.php';

// Modules autorisés pour l'entité courante (slug), via API Node.
$authorized_service_slugs = [];
try {
    $jwtToken = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if (!empty($jwtToken) && !empty($apiBase)) {
        $ch = curl_init($apiBase . '/users/me/services-context');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $jwtToken,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if (!$err && $code >= 200 && $code < 300) {
            $decoded = json_decode((string)$raw, true);
            $services = is_array($decoded['data']['services'] ?? null) ? $decoded['data']['services'] : [];
            foreach ($services as $svc) {
                if (!empty($svc['slug'])) {
                    $authorized_service_slugs[] = strtolower(trim((string)$svc['slug']));
                } elseif (!empty($svc['name'])) {
                    $authorized_service_slugs[] = strtolower(trim(preg_replace('/\s+/', '-', (string)$svc['name'])));
                }
            }
        }
    }
} catch (Exception $e) {
    $authorized_service_slugs = [];
}

// Configurations disponibles pour l'entité (backoffice entité)
// 1) Modules historiques (avant système de modules déclarés dans /modules)
$entity_config_items = [
    [
        'id' => 'mail',
        'title' => 'Mail',
        'description' => 'Configuration des comptes mail (boîtes, envoi) pour l\'entité.',
        'icon' => '📧',
        'links' => [
            ['url' => url('pages/modules/mail-config.php'), 'label' => 'Configurer le mail', 'primary' => true],
        ],
    ],
    [
        'id' => 'facebook',
        'title' => 'Facebook',
        'description' => 'Connexion des pages Facebook et paramètres pour l\'entité.',
        'icon' => '📘',
        'links' => [
            ['url' => url('pages/modules/facebook.php') . '?tab=config', 'label' => 'Connecter Facebook', 'primary' => true],
        ],
    ],
    [
        'id' => 'analyse-intention',
        'title' => 'Analyse d\'intention',
        'description' => 'Configurer l\'agent IA pour l\'analyse des intentions.',
        'icon' => '🎯',
        'links' => [
            ['url' => url('pages/modules/analyse-intention-config.php'), 'label' => 'Configurer l\'agent', 'primary' => true],
        ],
    ],
    [
        'id' => 'ugap',
        'title' => 'UGAP',
        'description' => 'Paramétrage du module UGAP pour l\'entité (rôles et règles module).',
        'icon' => '📦',
        'links' => [
            ['url' => url('pages/modules/ugap.php?tab=parametrage'), 'label' => 'Paramétrer UGAP', 'primary' => true],
        ],
    ],
    [
        'id' => 'entity-roles',
        'title' => 'Roles',
        'description' => 'Definir les roles metier de l\'entite (service commercial, SAV, etc.).',
        'icon' => '🛡️',
        'links' => [
            ['url' => url('pages/modules/entity-roles.php'), 'label' => 'Gerer les roles', 'primary' => true],
        ],
    ],
];

// 2) Modules déclarés dans le nouveau système `modules/<nom-module>/module.php`
$modules_root = realpath(__DIR__ . '/../../modules');
if ($modules_root && is_dir($modules_root)) {
    foreach (scandir($modules_root) as $module_dir) {
        if ($module_dir === '.' || $module_dir === '..') {
            continue;
        }

        $manifest_path = $modules_root . DIRECTORY_SEPARATOR . $module_dir . DIRECTORY_SEPARATOR . 'module.php';
        if (!file_exists($manifest_path)) {
            continue;
        }

        $manifest = require $manifest_path;

        // On ne retient que les modules qui exposent une config "admin_entity"
        if (empty($manifest['admin_entity'])) {
            continue;
        }

        $id = $manifest['id'] ?? $module_dir;
        if (!empty($authorized_service_slugs)) {
            $manifestSlug = strtolower(trim((string)$id));
            if (!in_array($manifestSlug, $authorized_service_slugs, true)) {
                continue;
            }
        }

        // Éviter les doublons si un module historique a déjà été défini avec le même id
        $already_exists = false;
        foreach ($entity_config_items as $item) {
            if (!empty($item['id']) && $item['id'] === $id) {
                $already_exists = true;
                break;
            }
        }
        if ($already_exists) {
            continue;
        }

        // Construction des liens à partir du manifest
        $links = [];
        $admin_entity = $manifest['admin_entity'];

        // Cas simple : un seul lien de config
        if (!empty($admin_entity['config_url'])) {
            $links[] = [
                'url' => url($admin_entity['config_url']),
                'label' => $admin_entity['config_label'] ?? 'Configurer',
                'primary' => true,
            ];
        } else {
            // Cas IA : plusieurs écrans (serveurs, LLMs, droits)
            if (!empty($admin_entity['servers_url'])) {
                $links[] = [
                    'url' => url($admin_entity['servers_url']),
                    'label' => 'Serveurs IA de l\'entité',
                    'primary' => true,
                ];
            }
            if (!empty($admin_entity['llms_url'])) {
                $links[] = [
                    'url' => url($admin_entity['llms_url']),
                    'label' => 'LLMs de l\'entité',
                    'primary' => false,
                ];
            }
            if (!empty($admin_entity['rights_url'])) {
                $links[] = [
                    'url' => url($admin_entity['rights_url']),
                    'label' => 'Droits LLM par utilisateur',
                    'primary' => false,
                ];
            }
        }

        $entity_config_items[] = [
            'id' => $id,
            'title' => $manifest['name'] ?? ucfirst($id),
            'description' => $manifest['description'] ?? '',
            'icon' => $manifest['icon'] ?? '🧩',
            'links' => $links,
        ];
    }
}
?>

<div class="container" style="max-width: 1200px; margin: 2rem auto; padding: 0 1rem;">
    <div style="margin-bottom: 2rem;">
        <h1>Configuration de l'entité</h1>
        <p style="color: #666; font-size: 1.1em;">
            Choisissez un module pour accéder à sa configuration.
        </p>
        <div style="margin-top: 0.75rem;">
            <a class="btn btn-primary" href="<?= url('pages/modules/entity-roles.php') ?>">Rôles d'entité</a>
        </div>
    </div>

    <div class="form-group" style="margin-bottom: 1.5rem; max-width: 400px;">
        <label for="entityConfigSearch" class="small" style="display: block; margin-bottom: 0.25rem;">Rechercher un module</label>
        <input type="text" id="entityConfigSearch" class="form-control" placeholder="Ex. IA, mail..." autocomplete="off" />
    </div>

    <div id="entityConfigList"
         style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 1.2rem;
         ">
        <?php foreach ($entity_config_items as $item):
            $firstLink = reset($item['links']);
            $firstUrl = $firstLink ? $firstLink['url'] : '#';
        ?>
        <div class="card entity-config-card"
             style="cursor: pointer; border-radius: 10px; overflow: hidden; height: 100%;"
             data-config-id="<?= htmlspecialchars($item['id']) ?>"
             data-first-url="<?= htmlspecialchars($firstUrl) ?>"
             data-search="<?= htmlspecialchars(mb_strtolower($item['title'] . ' ' . $item['description'])) ?>">
            <div class="card-header"
                 style="background-color: #f8f9fa; border-bottom: 2px solid #0d6efd; padding: 1rem 1.25rem; height: 100%;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 2.2em;"><?= $item['icon'] ?></span>
                        <div>
                            <h2 style="margin: 0; font-size: 1.25rem;"><?= htmlspecialchars($item['title']) ?></h2>
                            <p style="margin: 0.35rem 0 0 0; font-size: 0.9em; color: #666; line-height: 1.3em; max-height: 2.6em; overflow: hidden;">
                                <?= htmlspecialchars($item['description']) ?>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <div id="entityConfigNoResult" style="display: none; padding: 2rem; text-align: center; color: #666;">
        Aucun module ne correspond à votre recherche.
    </div>
</div>

<script>
(function() {
    var searchEl = document.getElementById('entityConfigSearch');
    var cards = document.querySelectorAll('.entity-config-card');
    var noResult = document.getElementById('entityConfigNoResult');

    function filter() {
        var q = (searchEl && searchEl.value || '').trim().toLowerCase();
        var visible = 0;
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var text = (card.getAttribute('data-search') || '').toLowerCase();
            var show = !q || text.indexOf(q) !== -1;
            card.style.display = show ? '' : 'none';
            if (show) visible++;
        }
        if (noResult) noResult.style.display = visible === 0 ? 'block' : 'none';
    }

    cards.forEach(function(card) {
        card.addEventListener('click', function(e) {
            if (e.target.closest('a')) return;
            var url = card.getAttribute('data-first-url');
            if (url && url !== '#') window.location.href = url;
        });
    });

    if (searchEl) {
        searchEl.addEventListener('input', filter);
        searchEl.addEventListener('keyup', filter);
    }
})();
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
