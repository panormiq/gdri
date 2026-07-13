<?php
/**
 * Construit la liste des cartes de configuration entité (onglet Legacy).
 */

function buildEntityConfigItems(array $authorized_service_slugs = []) {
    $entity_config_items = [
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
    ];

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

            if (empty($manifest['admin_entity']) && empty($manifest['view_url'])) {
                continue;
            }

            $id = $manifest['id'] ?? $module_dir;
            if (function_exists('isMigratedStructuralId') && isMigratedStructuralId($id)) {
                continue;
            }
            if (function_exists('isInfrastructureServiceSlug') && isInfrastructureServiceSlug($id)) {
                continue;
            }
            if (function_exists('isMigratedApplicationId') && isMigratedApplicationId($id)) {
                continue;
            }
            if (!empty($authorized_service_slugs)) {
                $manifestSlug = strtolower(trim((string) $id));
                if (!in_array($manifestSlug, $authorized_service_slugs, true)) {
                    continue;
                }
            }

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

            $links = [];
            if (!empty($manifest['view_url'])) {
                $links[] = [
                    'url' => url($manifest['view_url']),
                    'label' => $manifest['view_label'] ?? 'Voir le module',
                    'primary' => true,
                ];
            }

            $admin_entity = $manifest['admin_entity'] ?? null;
            if ($admin_entity) {
                if (!empty($admin_entity['config_url'])) {
                    $links[] = [
                        'url' => url($admin_entity['config_url']),
                        'label' => $admin_entity['config_label'] ?? 'Configurer',
                        'primary' => true,
                    ];
                } else {
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

    return array_values(array_filter($entity_config_items, function ($item) {
        if (function_exists('isMigratedApplicationId') && isMigratedApplicationId($item['id'] ?? '')) {
            return false;
        }
        if (function_exists('isMigratedStructuralId') && isMigratedStructuralId($item['id'] ?? '')) {
            return false;
        }
        if (function_exists('isMigratedNavItemId') && isMigratedNavItemId($item['id'] ?? '')) {
            return false;
        }
        if (function_exists('isMigratedConnectorId') && isMigratedConnectorId($item['id'] ?? '')) {
            return false;
        }
        if (function_exists('isInfrastructureServiceSlug') && isInfrastructureServiceSlug($item['id'] ?? '')) {
            return false;
        }
        return true;
    }));
}

function fetchAuthorizedServiceSlugsForEntity() {
    $authorized_service_slugs = [];
    try {
        if (!function_exists('getJWTToken')) {
            require_once __DIR__ . '/jwt-helper.php';
        }
        $jwtToken = getJWTToken();
        $apiBase = rtrim(getApiBaseUrl(), '/');
        if (empty($jwtToken) || empty($apiBase)) {
            return $authorized_service_slugs;
        }

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
        if ($err || $code < 200 || $code >= 300) {
            return $authorized_service_slugs;
        }

        $decoded = json_decode((string) $raw, true);
        $services = is_array($decoded['data']['services'] ?? null) ? $decoded['data']['services'] : [];
        foreach ($services as $svc) {
            if (!empty($svc['slug'])) {
                $authorized_service_slugs[] = strtolower(trim((string) $svc['slug']));
            } elseif (!empty($svc['name'])) {
                $authorized_service_slugs[] = strtolower(trim(preg_replace('/\s+/', '-', (string) $svc['name'])));
            }
        }
    } catch (Exception $e) {
        return [];
    }

    return $authorized_service_slugs;
}
