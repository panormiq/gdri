<?php
/**
 * Fonctions utilitaires PHP - GDRI
 * Fichier : includes/functions.php
 * 
 * Fonctions liées aux opérations communes du site
 */

/**
 * Échappe les caractères HTML pour éviter les injections XSS
 * @param string $string La chaîne à échapper
 * @return string La chaîne échappée
 */
function escape($string) {
    return htmlspecialchars($string, ENT_QUOTES, 'UTF-8');
}

/**
 * Redirige vers une URL
 * @param string $url L'URL de redirection
 */
function redirect($url) {
    header("Location: $url");
    exit();
}

/**
 * Vérifie si l'utilisateur est connecté
 * @return bool True si connecté, false sinon
 */
function isLoggedIn() {
    return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

/**
 * Récupère le rôle de l'utilisateur connecté
 * @return string|null Le rôle ou null si non connecté
 */
function getUserRole() {
    return $_SESSION['user_role'] ?? null;
}

/**
 * Vérifie si l'utilisateur a un rôle spécifique
 * @param string $role Le rôle à vérifier
 * @return bool True si l'utilisateur a ce rôle
 */
function hasRole($role) {
    return isLoggedIn() && getUserRole() === $role;
}

/**
 * Retourne le chemin racine du site
 * @return string Le chemin racine
 */
function getRootPath() {
    return defined('BASE_URL') ? BASE_URL : '/';
}

/**
 * Génère une URL complète à partir d'un chemin relatif
 * @param string $path Le chemin relatif
 * @return string L'URL complète (normalisée)
 */
function url($path = '') {
    $baseUrl = getRootPath();
    $cleanPath = ltrim($path, '/');
    $finalUrl = $baseUrl . $cleanPath;
    
    // Normaliser les slashes multiples (sauf après http:// ou https://)
    $finalUrl = preg_replace('#(?<!:)/+#', '/', $finalUrl);
    
    return $finalUrl;
}

/**
 * Retourne l'URL de base de l'API
 * @return string L'URL de base de l'API
 */
if (!function_exists('getApiBaseUrl')) {
    function getApiBaseUrl() {
        return defined('API_BASE_URL') ? API_BASE_URL : 'http://localhost:3000/api';
    }
}

/**
 * Retourne le titre de la page actuelle
 * @param string $pageTitle Le titre de la page
 * @return string Le titre complet avec le nom du site
 */
function pageTitle($pageTitle = '') {
    $siteName = 'GDR-Innovation';
    return $pageTitle ? "$pageTitle - $siteName" : $siteName;
}

/**
 * Filtre le catalogue pour n'afficher que les applications (masque extensions/infra).
 * @param array<int, array<string, mixed>> $services
 * @return array<int, array<string, mixed>>
 */
function filterCatalogApplications(array $services) {
    return array_values(array_filter($services, function ($service) {
        $visibility = isset($service['catalog_visibility'])
            ? strtolower(trim((string) $service['catalog_visibility']))
            : '';
        $type = isset($service['catalog_type'])
            ? strtolower(trim((string) $service['catalog_type']))
            : '';

        if ($visibility === 'hidden' || $type === 'extension' || $type === 'agent') {
            return false;
        }

        $slug = isset($service['slug']) ? strtolower(trim((string) $service['slug'])) : '';
        $name = isset($service['name']) ? strtolower(trim((string) $service['name'])) : '';
        $hiddenSlugs = ['ia', 'serveria', 'prompt', 'mail', 'analyse-intention'];
        if (in_array($slug, $hiddenSlugs, true)) {
            return false;
        }
        if (strpos($name, 'serveur ia') !== false) return false;
        if (strpos($name, 'server ia') !== false) return false;
        if (strpos($name, 'serveria') !== false) return false;
        if (strpos($name, 'module prompt') !== false) return false;
        if (strpos($name, 'service mail') !== false) return false;
        if (strpos($name, 'analyse d\'intention') !== false || strpos($name, 'analyse intention') !== false) {
            return false;
        }
        return true;
    }));
}

/**
 * Agents IA visibles (compléments IA rattachés à une application).
 * @param array<int, array<string, mixed>> $services
 * @return array<int, array<string, mixed>>
 */
function filterCatalogAgents(array $services) {
    return array_values(array_filter($services, function ($service) {
        $type = isset($service['catalog_type'])
            ? strtolower(trim((string) $service['catalog_type']))
            : '';
        $visibility = isset($service['catalog_visibility'])
            ? strtolower(trim((string) $service['catalog_visibility']))
            : '';

        if ($type === 'agent' && $visibility !== 'hidden') {
            return true;
        }

        $slug = isset($service['slug']) ? strtolower(trim((string) $service['slug'])) : '';
        return $slug === 'analyse-intention';
    }));
}

/**
 * URL d'ouverture / configuration d'un agent catalogue.
 */
function getCatalogAgentEntryUrl(array $service) {
    $entry = trim((string) ($service['catalog_entry_url'] ?? ''));
    if ($entry !== '') {
        return url($entry);
    }

    $slug = strtolower(trim((string) ($service['slug'] ?? '')));
    $defaults = [
        'analyse-intention' => 'pages/modules/analyse-intention-config.php',
    ];

    return url($defaults[$slug] ?? 'pages/modules.php');
}

/**
 * Libellé de l'application parente d'un agent.
 */
function getCatalogAgentParentLabel(array $service) {
    $parent = strtolower(trim((string) ($service['catalog_parent_app'] ?? '')));
    $labels = [
        'facebook' => 'Facebook',
        'ugap' => 'UGAP',
        'chat' => 'Chat IA',
        'gderpi' => 'GDERPI',
    ];

    return $labels[$parent] ?? ($parent !== '' ? ucfirst($parent) : '');
}

function getMigratedApplicationSlugAliases() {
    static $aliases = null;
    if ($aliases !== null) {
        return $aliases;
    }
    $aliases = [];
    foreach (getMigratedApplicationDefinitions() as $definition) {
        $canonical = strtolower(trim((string) ($definition['id'] ?? '')));
        if ($canonical === '') {
            continue;
        }
        $aliases[$canonical] = $canonical;
        foreach ($definition['slugs'] ?? [] as $slug) {
            $slugKey = strtolower(trim((string) $slug));
            if ($slugKey !== '') {
                $aliases[$slugKey] = $canonical;
            }
        }
    }
    return $aliases;
}

function normalizeCatalogServiceSlugKey($slug) {
    $slugKey = strtolower(trim((string) $slug));
    if ($slugKey === '') {
        return '';
    }
    $aliases = getMigratedApplicationSlugAliases();
    return $aliases[$slugKey] ?? $slugKey;
}

/**
 * Déduplique le catalogue services (même logique que modules.php).
 * @param array<int, array<string, mixed>> $services
 * @return array<int, array<string, mixed>>
 */
function dedupeServicesCatalog(array $services) {
    $uniqueServices = [];
    $seenBySlug = [];
    $seenByName = [];

    foreach ($services as $service) {
        $slugKey = !empty($service['slug']) ? normalizeCatalogServiceSlugKey($service['slug']) : null;
        $nameKey = !empty($service['name'])
            ? preg_replace('/\s+/', ' ', strtolower(trim((string) $service['name'])))
            : null;

        $existingKey = null;
        if ($slugKey && isset($seenBySlug[$slugKey])) {
            $existingKey = $seenBySlug[$slugKey];
        } elseif ($nameKey && isset($seenByName[$nameKey])) {
            $existingKey = $seenByName[$nameKey];
        }

        if ($existingKey !== null) {
            $existing = $uniqueServices[$existingKey] ?? null;
            $currentStatus = $existing['status'] ?? '';
            $newStatus = $service['status'] ?? '';
            if ($existing && $newStatus === 'active' && $currentStatus !== 'active') {
                $uniqueServices[$existingKey] = $service;
            }
            continue;
        }

        $key = $slugKey ?: ($nameKey ? preg_replace('/\s+/', '-', $nameKey) : (string) ($service['_id'] ?? $service['id'] ?? uniqid('service_', true)));
        $uniqueServices[$key] = $service;
        if ($slugKey) {
            $seenBySlug[$slugKey] = $key;
        }
        if ($nameKey) {
            $seenByName[$nameKey] = $key;
        }
    }

    return array_values($uniqueServices);
}

/**
 * URL principale d'ouverture d'une application catalogue.
 */
function getCatalogApplicationEntryUrl(array $service) {
    $entry = trim((string) ($service['catalog_entry_url'] ?? ''));
    if ($entry !== '') {
        return url($entry);
    }

    $slug = strtolower(trim((string) ($service['slug'] ?? '')));
    $name = strtolower(trim((string) ($service['name'] ?? '')));

    $slugMap = [
        'chat' => 'pages/modules/chat.php',
        'ugap' => 'pages/modules/ugap.php',
        'banque' => 'pages/modules/banque.php',
        'gderpi' => 'pages/modules/gderpi.php',
        'pm' => 'pages/modules/pm.php',
        'project-pm' => 'pages/modules/pm.php',
        'annuaire' => 'pages/modules/annuaire.php',
        'doc-hub' => 'pages/modules/doc-hub.php',
        'media-studio' => 'pages/modules/media-studio.php',
        'studio-media' => 'pages/modules/media-studio.php',
        'facebook' => 'pages/modules/facebook.php',
        'workflow' => '/modules/workflow/frontend/viewer/index.html',
        'mail' => 'pages/modules/mail-config.php',
    ];
    if ($slug !== '' && isset($slugMap[$slug])) {
        $target = $slugMap[$slug];
        return strpos($target, '/') === 0 ? $target : url($target);
    }

    if (strpos($name, 'chat') !== false) return url('pages/modules/chat.php');
    if (strpos($name, 'ugap') !== false) return url('pages/modules/ugap.php');
    if (strpos($name, 'banque') !== false) return url('pages/modules/banque.php');
    if (strpos($name, 'gderpi') !== false) return url('pages/modules/gderpi.php');
    if (strpos($name, 'annuaire') !== false) return url('pages/modules/annuaire.php');
    if (strpos($name, 'doc-hub') !== false || strpos($name, 'dochub') !== false) return url('pages/modules/doc-hub.php');
    if ((strpos($name, 'studio') !== false && strpos($name, 'média') !== false) || (strpos($name, 'media') !== false && strpos($name, 'studio') !== false)) {
        return url('pages/modules/media-studio.php');
    }
    if (strpos($name, 'facebook') !== false) return url('pages/modules/facebook.php');
    if (strpos($name, 'pm') !== false && strpos($name, 'gderpi') === false) return url('pages/modules/pm.php');
    if (strpos($name, 'mail') !== false) return url('pages/modules/mail-config.php');
    if (strpos($name, 'document') !== false) return url('pages/modules/doc-template-v3/index.php');

    return null;
}

/**
 * Type d'affichage Legacy pour un service catalogue.
 * @return array{0:string,1:string}
 */
function getCatalogLegacyKindMeta(array $service) {
    $type = isset($service['catalog_type'])
        ? strtolower(trim((string) $service['catalog_type']))
        : '';

    if ($type === 'agent') {
        return ['agent', 'Agent IA'];
    }
    if ($type === 'extension') {
        return ['extension', 'Extension'];
    }
    return ['application', 'Application'];
}

/**
 * Résout une URL Legacy pour tout service catalogue (apps, agents, extensions).
 */
function getCatalogLegacyEntryUrl(array $service) {
    $slug = strtolower(trim((string) ($service['slug'] ?? '')));
    $name = strtolower(trim((string) ($service['name'] ?? '')));
    if (isInfrastructureServiceSlug($slug) || isInfrastructureServiceName($name)) {
        return null;
    }

    $type = isset($service['catalog_type'])
        ? strtolower(trim((string) $service['catalog_type']))
        : '';

    if ($type === 'agent') {
        return getCatalogAgentEntryUrl($service);
    }

    $url = getCatalogApplicationEntryUrl($service);
    if ($url) {
        return $url;
    }

    $extensionMap = [
        'mail' => 'pages/modules/mail-config.php',
        'gdri-module-mail' => 'pages/modules/mail-config.php',
        'analyse-intention' => 'pages/modules/analyse-intention-config.php',
    ];
    if ($slug !== '' && isset($extensionMap[$slug])) {
        return url($extensionMap[$slug]);
    }

    if (strpos($name, 'mail') !== false) return url('pages/modules/mail-config.php');
    if (strpos($name, 'analyse') !== false && strpos($name, 'intention') !== false) {
        return url('pages/modules/analyse-intention-config.php');
    }

    if ($slug !== '') {
        $candidate = 'pages/modules/' . preg_replace('/[^a-z0-9\-]/', '', $slug) . '.php';
        $full = realpath(__DIR__ . '/../pages/modules/' . basename($candidate));
        if ($full && is_file($full)) {
            return url($candidate);
        }
    }

    return null;
}

/**
 * Services d'infrastructure (pas de carte UI — config dans Paramètres ou interne).
 * @return array<int, string>
 */
function getInfrastructureServiceSlugs() {
    return ['prompt', 'ia', 'serveria', 'data-backup', 'backup'];
}

function isInfrastructureServiceSlug($slug) {
    $slug = strtolower(trim((string) $slug));
    return $slug !== '' && in_array($slug, getInfrastructureServiceSlugs(), true);
}

function isInfrastructureServiceName($name) {
    $name = strtolower(trim((string) $name));
    if ($name === '') {
        return false;
    }
    if (strpos($name, 'module prompt') !== false || $name === 'prompt') {
        return true;
    }
    if (strpos($name, 'serveur ia') !== false || strpos($name, 'server ia') !== false || strpos($name, 'module ia') !== false) {
        return true;
    }
    return false;
}

function isInfrastructureService(array $service) {
    $slug = strtolower(trim((string) ($service['slug'] ?? '')));
    $name = strtolower(trim((string) ($service['name'] ?? ($service['displayName'] ?? ''))));
    return isInfrastructureServiceSlug($slug) || isInfrastructureServiceName($name);
}

/**
 * Infra migrée vers Paramètres > Structurel.
 * @return array<int, array<string, mixed>>
 */
function getMigratedStructuralDefinitions() {
    return [
        [
            'id' => 'ia',
            'slugs' => ['ia', 'serveria'],
            'keywords' => ['serveur ia', 'server ia', 'module ia'],
            'legacyIds' => ['svc-ia', 'svc-serveria', 'svc-prompt', 'ia-llms', 'cfg-ia'],
            'title' => 'Serveur IA',
            'description' => 'Serveurs GDRI (mutualisé, dédié) et serveurs propres entité (clés API).',
            'icon' => '🤖',
            'url' => 'pages/modules/ia-entity-servers.php',
        ],
        [
            'id' => 'data-backup',
            'slugs' => ['data-backup', 'backup'],
            'keywords' => ['sauvegarde', 'backup', 'export base'],
            'legacyIds' => ['svc-backup', 'cfg-backup'],
            'title' => 'Sauvegarde',
            'description' => 'Export, planification et historique de la base client MongoDB.',
            'icon' => '💾',
            'url' => 'pages/modules/backup-config.php',
        ],
        [
            'id' => 'annuaire-identity',
            'slugs' => ['annuaire-identity'],
            'keywords' => ['identité entreprise', 'coordonnées entreprise', 'raison sociale'],
            'legacyIds' => ['cfg-annuaire-identity'],
            'title' => 'Identité entreprise',
            'description' => 'Coordonnées légales, SIRET et adresse — synchronisées avec UGAP et la fiche entité GDRI.',
            'icon' => '🏢',
            'url' => 'pages/modules/annuaire.php?focus=identity',
        ],
    ];
}

/**
 * Entrées déjà dans la navigation latérale entité (hors Legacy).
 * @return array<int, array<string, mixed>>
 */
function getMigratedNavDefinitions() {
    return [
        [
            'id' => 'entity-roles',
            'legacyIds' => ['cfg-entity-roles-0', 'entity-roles'],
            'keywords' => ['roles', 'rôles'],
        ],
        [
            'id' => 'users',
            'legacyIds' => ['users', 'cfg-users-0'],
            'keywords' => ['utilisateurs', 'permissions'],
        ],
    ];
}

function isMigratedNavItemId($id) {
    $id = strtolower(trim((string) $id));
    if ($id === '') {
        return false;
    }
    $normalized = preg_replace('/^(svc|app|agent|cfg)-/', '', $id);
    $normalized = preg_replace('/-\d+$/', '', $normalized);
    foreach (getMigratedNavDefinitions() as $definition) {
        if ($id === strtolower(trim((string) $definition['id']))) {
            return true;
        }
        if ($normalized === strtolower(trim((string) $definition['id']))) {
            return true;
        }
        foreach ($definition['legacyIds'] ?? [] as $legacyId) {
            $legacyId = strtolower(trim((string) $legacyId));
            if ($id === $legacyId || $normalized === preg_replace('/^(svc|app|agent|cfg)-/', '', $legacyId)) {
                return true;
            }
        }
    }
    return false;
}

function isMigratedStructuralId($id) {
    $id = strtolower(trim((string) $id));
    if ($id === '' || isInfrastructureServiceSlug($id)) {
        return isInfrastructureServiceSlug($id);
    }
    foreach (getMigratedStructuralDefinitions() as $definition) {
        if ($id === $definition['id']) {
            return true;
        }
        foreach ($definition['slugs'] ?? [] as $slug) {
            if ($id === strtolower(trim((string) $slug))) {
                return true;
            }
        }
        foreach ($definition['legacyIds'] ?? [] as $legacyId) {
            if ($id === $legacyId || $id === preg_replace('/^(svc|cfg)-/', '', $legacyId)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Cartes pour Paramètres > Structurel.
 * @return array<int, array<string, mixed>>
 */
function buildStructuralHubItems() {
    $items = [];
    foreach (getMigratedStructuralDefinitions() as $definition) {
        $items[] = [
            'id' => (string) $definition['id'],
            'title' => (string) $definition['title'],
            'description' => (string) $definition['description'],
            'icon' => (string) $definition['icon'],
            'url' => resolveApplicationUrl($definition['url']),
        ];
    }
    return $items;
}

/**
 * Cartes pour Paramètres > Connecteurs.
 * @return array<int, array<string, mixed>>
 */
/**
 * Cartes pour Console plateforme > Structurel (infra globale).
 * @return array<int, array<string, mixed>>
 */
function buildPlatformStructuralHubItems() {
    return [
        [
            'id' => 'ia',
            'title' => 'Serveurs IA',
            'description' => 'Créer les serveurs mutualisés/dédiés et cocher les entités autorisées (distribution plateforme).',
            'icon' => '🤖',
            'url' => url('pages/modules/ia-config.php'),
        ],
        [
            'id' => 'data-backup',
            'title' => 'Sauvegarde des bases client',
            'description' => 'Chemins de stockage et politique globale des exports MongoDB.',
            'icon' => '💾',
            'url' => url('pages/admin-modules-backup.php'),
        ],
    ];
}

/**
 * Cartes pour Console plateforme > Agents IA (automatisations globales).
 * @return array<int, array<string, mixed>>
 */
function buildPlatformAgentHubItems() {
    return [
        [
            'id' => 'platform-backup',
            'title' => 'Sauvegarde plateforme',
            'description' => 'Supervision et politique des backups de toutes les bases entités.',
            'icon' => '💾',
            'url' => url('pages/admin-modules-backup.php'),
        ],
        [
            'id' => 'platform-activity',
            'title' => 'Suivi & exécutions',
            'description' => 'Historique des actions et automatisations sur la plateforme.',
            'icon' => '📊',
            'url' => url('pages/user-activity.php'),
        ],
    ];
}

/**
 * Cartes pour Console plateforme > Applications (catalogue global dédupliqué).
 * @return array<int, array<string, mixed>>
 */
function buildPlatformApplicationHubItems(array $services) {
    $services = dedupeServicesCatalog($services);
    $items = [];
    foreach ($services as $service) {
        if (isInfrastructureService($service)) {
            continue;
        }
        $visibility = strtolower(trim((string) ($service['catalog_visibility'] ?? 'public')));
        if ($visibility === 'hidden') {
            continue;
        }
        $items[] = [
            'id' => (string) ($service['_id'] ?? $service['id'] ?? ''),
            'title' => (string) ($service['name'] ?? 'Application'),
            'description' => (string) ($service['description'] ?? 'Module disponible sur la plateforme.'),
            'icon' => (string) ($service['icon'] ?? '📱'),
            'slug' => (string) ($service['slug'] ?? ''),
            'status' => (string) ($service['status'] ?? 'active'),
            'catalog_type' => (string) ($service['catalog_type'] ?? 'app'),
        ];
    }
    usort($items, function ($a, $b) {
        return strcasecmp((string) ($a['title'] ?? ''), (string) ($b['title'] ?? ''));
    });
    return $items;
}

/**
 * Cartes pour Console plateforme > Connecteurs (presets globaux).
 * @return array<int, array<string, mixed>>
 */
function buildPlatformConnectorHubItems() {
    return [
        [
            'id' => 'mail',
            'title' => 'Connecteur Mail',
            'description' => 'Presets IMAP/SMTP (fournisseurs) réutilisés par les comptes mail des entités.',
            'icon' => '📧',
            'url' => url('pages/admin-modules-mail.php'),
            'kind' => 'connector',
        ],
        [
            'id' => 'facebook',
            'title' => 'Connecteur Facebook',
            'description' => 'Application Meta (App ID, OAuth) pour les pages Facebook des entités.',
            'icon' => '📘',
            'url' => url('pages/modules/facebook-app-config.php'),
            'kind' => 'connector',
        ],
    ];
}

function buildUserConnectorHubItems() {
    $items = buildConnectorHubItems();
    $items[] = [
        'id' => 'account-modules',
        'title' => 'Réglages applications',
        'description' => 'Configuration personnelle des modules (presets, préférences…).',
        'icon' => '🧩',
        'url' => url('pages/account-modules.php'),
        'kind' => 'connector',
    ];
    usort($items, function ($a, $b) {
        return strcasecmp((string) ($a['title'] ?? ''), (string) ($b['title'] ?? ''));
    });
    return $items;
}

/**
 * Cartes pour Mon espace > Structurel (infra personnelle).
 * @return array<int, array<string, mixed>>
 */
function buildUserStructuralHubItems() {
    return [
        [
            'id' => 'ia-user',
            'title' => 'Serveur IA (perso)',
            'description' => 'Vos clés API, serveurs personnels et accès aux modèles autorisés par l\'entité.',
            'icon' => '🤖',
            'url' => url('pages/modules/ia-user-config.php'),
        ],
    ];
}

function buildConnectorHubItems() {
    return [
        [
            'id' => 'mail',
            'title' => 'Mail',
            'description' => 'Comptes mail : identifiant + mot de passe, réception IMAP (entrant) et envoi SMTP (sortant).',
            'icon' => '📧',
            'url' => url('pages/modules/mail-config.php?module=mail'),
            'kind' => 'connector',
        ],
        [
            'id' => 'http-generic',
            'title' => 'HTTP générique',
            'description' => 'Webhook, poll API et émission HTTP — modèles préremplis (CRM, webhook simple…).',
            'icon' => '🌐',
            'url' => url('pages/modules/connector-instances.php?connector=http-generic'),
            'kind' => 'connector',
        ],
        [
            'id' => 'facebook',
            'title' => 'Facebook',
            'description' => 'Pages Facebook : webhook Meta, poll Graph API, réponses.',
            'icon' => '📘',
            'url' => url('pages/modules/connector-instances.php?connector=facebook'),
            'kind' => 'connector',
        ],
    ];
}

function getMigratedConnectorDefinitions() {
    return [
        [
            'id' => 'mail',
            'legacyIds' => ['cfg-mail-0', 'mail-config', 'mail-test'],
            'keywords' => ['configuration mail', 'comptes mail', 'mail entrant', 'mail sortant'],
        ],
    ];
}

function isMigratedConnectorId($id) {
    $id = strtolower(trim((string) $id));
    if ($id === '') return false;
    $normalized = preg_replace('/^(svc|app|agent|cfg)-/', '', $id);
    $normalized = preg_replace('/-\d+$/', '', $normalized);
    foreach (getMigratedConnectorDefinitions() as $definition) {
        if ($id === strtolower($definition['id']) || $normalized === strtolower($definition['id'])) {
            return true;
        }
        foreach ($definition['legacyIds'] ?? [] as $legacyId) {
            if ($id === strtolower($legacyId) || $normalized === preg_replace('/^(cfg)-/', '', strtolower($legacyId))) {
                return true;
            }
        }
    }
    foreach (buildConnectorHubItems() as $item) {
        if ($id === strtolower($item['id'] ?? '')) return true;
    }
    return false;
}

/**
 * Applications migrées depuis Legacy vers la page Applications.
 * @return array<int, array<string, mixed>>
 */
function getMigratedApplicationDefinitions() {
    return [
        [
            'id' => 'ugap',
            'slugs' => ['ugap'],
            'keywords' => ['ugap'],
            'legacyIds' => ['ugap-open', 'svc-ugap'],
            'static' => true,
            'title' => 'UGAP',
            'description' => 'Configurateur bateaux, paramétrage et prompts IA.',
            'icon' => '🚤',
            'url' => 'pages/modules/ugap.php',
        ],
        [
            'id' => 'gderpi',
            'slugs' => ['gderpi', 'gderp'],
            'keywords' => ['gderpi', 'gderp'],
            'legacyIds' => ['svc-gderpi', 'svc-gderp'],
            'static' => true,
            'title' => 'GDERPI',
            'description' => 'ERP métier : devis, commandes, stocks et workflow commercial.',
            'icon' => '🏭',
            'url' => 'pages/modules/gderpi.php',
        ],
        [
            'id' => 'agent-documentaire',
            'slugs' => ['agent-documentaire-v2', 'agent-documentaire', 'document-agent', 'doc-template-v3', 'doc-template'],
            'keywords' => ['documentaire', 'agent document', 'doc-template'],
            'legacyIds' => ['agent-documentaire-v2', 'document-agent-v1', 'svc-agent-documentaire-v2', 'doc-template-v3'],
            'static' => true,
            'title' => 'Agent Documentaire',
            'description' => 'Moteur documentaire canvas A4 — templates et PDF.',
            'icon' => '📄',
            'url' => 'pages/modules/document-agent-v2/index.php',
            'links' => [
                ['label' => 'Ouvrir V2', 'url' => 'pages/modules/document-agent-v2/index.php', 'primary' => true],
                ['label' => 'V1', 'url' => 'pages/modules/document-agent/index.php'],
                ['label' => 'V3', 'url' => 'pages/modules/doc-template-v3/index.php'],
            ],
        ],
        [
            'id' => 'pm',
            'slugs' => ['pm', 'project-pm'],
            'keywords' => ['pm', 'gestion de projet'],
            'legacyIds' => ['svc-pm', 'svc-project-pm'],
            'static' => true,
            'title' => 'PM',
            'description' => 'Gestion de projet — Kanban et inbox mail.',
            'icon' => '📋',
            'url' => 'pages/modules/pm.php',
        ],
        [
            'id' => 'media-studio',
            'slugs' => ['media-studio', 'studio-media'],
            'keywords' => ['studio média', 'media studio', 'media center'],
            'legacyIds' => ['svc-media-studio', 'svc-studio-media'],
            'static' => true,
            'title' => 'Studio Média',
            'description' => 'Media center — chat IA et génération d\'images.',
            'icon' => '🎬',
            'url' => 'pages/modules/media-studio.php',
        ],
        [
            'id' => 'workflow',
            'slugs' => ['workflow'],
            'keywords' => ['workflow'],
            'legacyIds' => ['workflow-viewer', 'workflow-builder', 'svc-workflow'],
            'static' => true,
            'title' => 'Workflow',
            'description' => 'Créer et exécuter des workflows métier.',
            'icon' => '🔀',
            'links' => [
                ['label' => 'Viewer', 'url' => '/modules/workflow/frontend/viewer/index.html', 'primary' => true],
                ['label' => 'Builder', 'url' => '/modules/workflow/frontend/builder/index.html'],
            ],
        ],
        [
            'id' => 'annuaire',
            'slugs' => ['annuaire'],
            'keywords' => ['annuaire', 'contacts', 'organisations'],
            'legacyIds' => ['svc-annuaire', 'annuaire-open'],
            'static' => true,
            'title' => 'Annuaire',
            'description' => 'Organisations, contacts clients/fournisseurs et collaborateurs.',
            'icon' => '📇',
            'url' => 'pages/modules/annuaire.php',
        ],
        [
            'id' => 'banque',
            'slugs' => ['banque'],
            'keywords' => ['banque', 'oxygene', 'relevé bancaire', 'releve bancaire'],
            'legacyIds' => ['svc-banque', 'banque-open'],
            'static' => true,
            'title' => 'Import bancaire Oxygène',
            'description' => 'Relevé PDF → tableau éditable → CSV Oxygène.',
            'icon' => '🏦',
            'url' => 'pages/modules/banque.php',
        ],
        [
            'id' => 'chat',
            'slugs' => ['chat', 'module-chat-ia'],
            'keywords' => ['chat', 'chat ia', 'assistant'],
            'legacyIds' => ['svc-chat', 'chat-open', 'svc-module-chat-ia', 'module-chat-ia'],
            'static' => true,
            'title' => 'Chat IA',
            'description' => 'Assistant IA avec contexte, mémoire de conversation et choix serveur/modèle.',
            'icon' => '💬',
            'url' => 'pages/modules/chat.php',
        ],
        [
            'id' => 'doc-hub',
            'slugs' => ['doc-hub', 'dochub'],
            'keywords' => ['doc-hub', 'dochub', 'ged', 'documents'],
            'legacyIds' => ['svc-doc-hub', 'doc-hub-open', 'svc-dochub'],
            'static' => true,
            'title' => 'Doc-Hub',
            'description' => 'GED par projet — documents, tags, diffusion par liens sécurisés.',
            'icon' => '📁',
            'url' => 'pages/modules/doc-hub.php',
        ],
    ];
}

/**
 * Identifiant d'une application migrée (pas de carte paramétrage externe).
 */
function isMigratedApplicationId($id) {
    $id = strtolower(trim((string) $id));
    if ($id === '') {
        return false;
    }
    foreach (getMigratedApplicationDefinitions() as $definition) {
        if ($id === strtolower(trim((string) $definition['id']))) {
            return true;
        }
        foreach ($definition['slugs'] ?? [] as $slug) {
            if ($id === strtolower(trim((string) $slug))) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Résout une URL d'application (absolue ou relative au frontend).
 */
function resolveApplicationUrl($path) {
    $path = trim((string) $path);
    if ($path === '') {
        return '#';
    }
    if ($path[0] === '/' || preg_match('#^https?://#i', $path)) {
        return $path;
    }
    return url($path);
}

/**
 * Vérifie si un service catalogue correspond à une app migrée.
 */
function matchesMigratedApplicationDefinition(array $service, array $definition) {
    $slug = strtolower(trim((string) ($service['slug'] ?? '')));
    $name = strtolower(trim((string) ($service['name'] ?? '')));

    foreach ($definition['slugs'] ?? [] as $candidate) {
        if ($slug === strtolower(trim((string) $candidate))) {
            return true;
        }
    }
    foreach ($definition['keywords'] ?? [] as $keyword) {
        $keyword = strtolower(trim((string) $keyword));
        if ($keyword === '') {
            continue;
        }
        if (strpos($name, $keyword) !== false || strpos($slug, $keyword) !== false) {
            return true;
        }
    }
    return false;
}

/**
 * Trouve le service catalogue associé à une app migrée.
 */
function findCatalogServiceForMigratedApp(array $catalog, array $definition) {
    foreach ($catalog as $service) {
        if (matchesMigratedApplicationDefinition($service, $definition)) {
            return $service;
        }
    }
    return null;
}

/**
 * Associe un service catalogue à la meilleure app migrée (slug exact prioritaire).
 */
function findBestMigratedDefinitionForService(array $service, array $definitions) {
    $slug = strtolower(trim((string) ($service['slug'] ?? '')));
    if ($slug !== '') {
        $normalizedSlug = normalizeCatalogServiceSlugKey($slug);
        foreach ($definitions as $definition) {
            $defId = strtolower(trim((string) ($definition['id'] ?? '')));
            if ($defId !== '' && $normalizedSlug === $defId) {
                return $definition;
            }
            foreach ($definition['slugs'] ?? [] as $candidate) {
                if ($slug === strtolower(trim((string) $candidate))) {
                    return $definition;
                }
            }
        }
    }

    foreach ($definitions as $definition) {
        if (matchesMigratedApplicationDefinition($service, $definition)) {
            return $definition;
        }
    }
    return null;
}

function buildApplicationHubItemFromDefinition(array $definition, ?array $service = null) {
    $service = is_array($service) ? $service : [];
    $item = [
        'id' => (string) $definition['id'],
        'title' => (string) ($service['name'] ?? $definition['title']),
        'description' => (string) ($service['description'] ?? $definition['description']),
        'icon' => (string) ($service['icon'] ?? $definition['icon']),
        'status' => (string) ($service['status'] ?? 'active'),
        'url' => '#',
        'links' => [],
    ];

    if (!empty($definition['links']) && is_array($definition['links'])) {
        foreach ($definition['links'] as $link) {
            if (empty($link['url'])) {
                continue;
            }
            $item['links'][] = [
                'label' => (string) ($link['label'] ?? 'Ouvrir'),
                'url' => resolveApplicationUrl($link['url']),
                'primary' => !empty($link['primary']),
            ];
        }
    }

    if (!empty($definition['url'])) {
        $item['url'] = resolveApplicationUrl($definition['url']);
    }
    if ($item['url'] === '#' && !empty($item['links'])) {
        foreach ($item['links'] as $link) {
            if (!empty($link['primary'])) {
                $item['url'] = $link['url'];
                break;
            }
        }
        if ($item['url'] === '#') {
            $item['url'] = $item['links'][0]['url'];
        }
    }

    return $item;
}

/**
 * Une app migrée est visible si elle figure dans le catalogue utilisateur (déjà filtré entité → user).
 */
function isMigratedApplicationAuthorized(array $definition, array $catalog, $userIsAdmin = false) {
    return findCatalogServiceForMigratedApp($catalog, $definition) !== null;
}

/**
 * Cartes pour la page Applications (apps migrées depuis Legacy).
 * @return array<int, array<string, mixed>>
 */
function buildApplicationHubItems($userIsAdmin = false) {
    $catalog = fetchEntityServicesCatalog();
    $definitions = getMigratedApplicationDefinitions();
    $items = [];
    $seenDefinitionIds = [];
    $usedServiceIds = [];

    foreach ($catalog as $service) {
        $serviceId = (string) ($service['_id'] ?? $service['id'] ?? '');
        if ($serviceId !== '' && isset($usedServiceIds[$serviceId])) {
            continue;
        }

        $definition = findBestMigratedDefinitionForService($service, $definitions);
        if (!$definition) {
            continue;
        }

        $defId = (string) ($definition['id'] ?? '');
        if ($defId === '' || isset($seenDefinitionIds[$defId])) {
            continue;
        }

        $item = buildApplicationHubItemFromDefinition($definition, $service);
        if ($item['url'] === '#') {
            continue;
        }

        if ($serviceId !== '') {
            $usedServiceIds[$serviceId] = true;
        }
        $seenDefinitionIds[$defId] = true;
        $items[] = $item;
    }

    usort($items, function ($a, $b) {
        return strcasecmp((string) ($a['title'] ?? ''), (string) ($b['title'] ?? ''));
    });

    return $items;
}

/**
 * Catalogue entité — apps autorisées, lecture seule (sans lien d'ouverture).
 * @return array<int, array<string, mixed>>
 */
function buildEntityApplicationCatalogItems($userIsAdmin = false) {
    $catalog = dedupeServicesCatalog(fetchEntityServicesCatalog());
    $definitions = getMigratedApplicationDefinitions();
    $items = [];
    $seenDefinitionIds = [];
    $usedServiceIds = [];

    foreach ($catalog as $service) {
        if (isInfrastructureService($service)) {
            continue;
        }
        $serviceId = (string) ($service['_id'] ?? $service['id'] ?? '');
        if ($serviceId !== '' && isset($usedServiceIds[$serviceId])) {
            continue;
        }

        $definition = findBestMigratedDefinitionForService($service, $definitions);
        if (!$definition) {
            continue;
        }

        $defId = (string) ($definition['id'] ?? '');
        if ($defId === '' || isset($seenDefinitionIds[$defId])) {
            continue;
        }

        if ($serviceId !== '') {
            $usedServiceIds[$serviceId] = true;
        }
        $seenDefinitionIds[$defId] = true;
        $items[] = [
            'id' => $defId,
            'title' => (string) ($service['name'] ?? $definition['title']),
            'description' => (string) ($service['description'] ?? $definition['description']),
            'icon' => (string) ($service['icon'] ?? $definition['icon']),
            'slug' => (string) ($service['slug'] ?? ''),
            'status' => (string) ($service['status'] ?? 'active'),
            'catalog_type' => (string) ($service['catalog_type'] ?? 'app'),
        ];
    }

    usort($items, function ($a, $b) {
        return strcasecmp((string) ($a['title'] ?? ''), (string) ($b['title'] ?? ''));
    });

    return $items;
}

/**
 * Indique si un élément Legacy doit être masqué (déjà dans Applications).
 */
function shouldExcludeFromLegacyHub(array $item, ?array $service = null) {
    $rawId = (string) ($item['id'] ?? '');

    if ($service && isInfrastructureService($service)) {
        return true;
    }

    if (($item['kind'] ?? '') === 'config') {
        $cfgBaseId = preg_replace('/^cfg-/', '', $rawId);
        $cfgBaseId = preg_replace('/-\d+$/', '', $cfgBaseId);
        if (isMigratedApplicationId($cfgBaseId) || isMigratedStructuralId($cfgBaseId) || isMigratedNavItemId($cfgBaseId) || isMigratedConnectorId($cfgBaseId) || isInfrastructureServiceSlug($cfgBaseId)) {
            return true;
        }
        return false;
    }

    $needle = [
        'id' => preg_replace('/^(svc|app|agent|cfg)-/', '', $rawId),
        'slug' => strtolower(trim((string) ($service['slug'] ?? ''))),
        'title' => strtolower(trim((string) ($item['title'] ?? ''))),
    ];

    foreach (getMigratedApplicationDefinitions() as $definition) {
        if ($needle['id'] === $definition['id']) {
            return true;
        }
        foreach ($definition['legacyIds'] ?? [] as $legacyId) {
            if ($rawId === $legacyId || $needle['id'] === $legacyId) {
                return true;
            }
        }
        if ($needle['slug'] !== '' && in_array($needle['slug'], array_map('strtolower', $definition['slugs'] ?? []), true)) {
            return true;
        }
        foreach ($definition['keywords'] ?? [] as $keyword) {
            $keyword = strtolower(trim((string) $keyword));
            if ($keyword !== '' && strpos($needle['title'], $keyword) !== false) {
                return true;
            }
        }
        if ($service && matchesMigratedApplicationDefinition($service, $definition)) {
            return true;
        }
    }

    foreach (getMigratedStructuralDefinitions() as $definition) {
        if ($needle['id'] === $definition['id']) {
            return true;
        }
        foreach ($definition['legacyIds'] ?? [] as $legacyId) {
            if ($rawId === $legacyId || $needle['id'] === $legacyId) {
                return true;
            }
        }
        if ($needle['slug'] !== '' && in_array($needle['slug'], array_map('strtolower', $definition['slugs'] ?? []), true)) {
            return true;
        }
        foreach ($definition['keywords'] ?? [] as $keyword) {
            $keyword = strtolower(trim((string) $keyword));
            if ($keyword !== '' && strpos($needle['title'], $keyword) !== false) {
                return true;
            }
        }
        if ($service && matchesMigratedApplicationDefinition($service, $definition)) {
            return true;
        }
    }

    foreach (getMigratedNavDefinitions() as $definition) {
        if ($needle['id'] === $definition['id']) {
            return true;
        }
        foreach ($definition['legacyIds'] ?? [] as $legacyId) {
            if ($rawId === $legacyId || $needle['id'] === preg_replace('/^(svc|cfg|app|agent)-/', '', $legacyId)) {
                return true;
            }
        }
        foreach ($definition['keywords'] ?? [] as $keyword) {
            $keyword = strtolower(trim((string) $keyword));
            if ($keyword !== '' && strpos($needle['title'], $keyword) !== false) {
                return true;
            }
        }
    }

    return isInfrastructureServiceSlug($needle['id']) || isInfrastructureServiceName($needle['title']);
}

/**
 * Entrées Legacy pour modules sans URL catalogue fiable.
 * @return array<int, array<string, mixed>>
 */
function getLegacyStaticFallbackItems() {
    return [
        [
            'id' => 'facebook-open',
            'kind' => 'application',
            'kindLabel' => 'Application',
            'title' => 'Facebook — Module',
            'description' => 'Ouvrir le module Facebook.',
            'icon' => '📘',
            'url' => url('pages/modules/facebook.php'),
        ],
    ];
}

/**
 * Cartes unifiées pour la page Legacy (apps + agents + config).
 * @return array<int, array<string, mixed>>
 */
function buildLegacyHubItems(array $authorized_service_slugs = [], $includeConfig = true) {
    require_once __DIR__ . '/entity-config-items.php';
    $items = [];
    $seen = [];
    $catalog = fetchEntityServicesCatalog();

    $addItem = function (array $item, ?array $service = null) use (&$items, &$seen) {
        if (shouldExcludeFromLegacyHub($item, $service)) {
            return;
        }
        $url = (string) ($item['url'] ?? '#');
        $id = (string) ($item['id'] ?? '');
        $key = $id . '|' . $url;
        if ($id === '' || $url === '#' || isset($seen[$key])) {
            return;
        }
        $seen[$key] = true;
        $items[] = $item;
    };

    foreach ($catalog as $service) {
        $url = getCatalogLegacyEntryUrl($service);
        if (!$url) {
            continue;
        }
        [$kind, $kindLabel] = getCatalogLegacyKindMeta($service);
        $slug = strtolower(trim((string) ($service['slug'] ?? '')));
        $title = (string) ($service['name'] ?? ($service['displayName'] ?? 'Module'));
        $addItem([
            'id' => 'svc-' . ($slug !== '' ? $slug : md5($title)),
            'kind' => $kind,
            'kindLabel' => $kindLabel,
            'title' => $title,
            'description' => (string) ($service['description'] ?? ''),
            'icon' => $service['icon'] ?? '🧩',
            'url' => $url,
        ], $service);
    }

    if ($includeConfig) {
        foreach (buildEntityConfigItems($authorized_service_slugs) as $cfg) {
            $links = is_array($cfg['links'] ?? null) ? $cfg['links'] : [];
            if (empty($links)) {
                continue;
            }
            foreach ($links as $index => $link) {
                if (empty($link['url'])) {
                    continue;
                }
                $label = trim((string) ($link['label'] ?? ''));
                $title = (string) ($cfg['title'] ?? 'Configuration');
                if ($label !== '' && count($links) > 1) {
                    $title .= ' — ' . $label;
                }
                $addItem([
                    'id' => 'cfg-' . ($cfg['id'] ?? 'config') . '-' . $index,
                    'kind' => 'config',
                    'kindLabel' => 'Configuration',
                    'title' => $title,
                    'description' => (string) ($cfg['description'] ?? ''),
                    'icon' => $cfg['icon'] ?? '⚙️',
                    'url' => $link['url'],
                ]);
            }
        }
    }

    foreach (getLegacyStaticFallbackItems() as $fallback) {
        $addItem($fallback);
    }

    return $items;
}

/**
 * Charge le catalogue services de l'entité courante.
 * @return array<int, array<string, mixed>>
 */
function fetchEntityServicesCatalog() {
    try {
        if (!function_exists('getJWTToken')) {
            require_once __DIR__ . '/jwt-helper.php';
        }
        $token = getJWTToken();
        $apiBase = rtrim(getApiBaseUrl(), '/');
        if (!$token || !$apiBase) {
            return [];
        }
        $ch = curl_init($apiBase . '/users/me/services-context');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code < 200 || $code >= 300) {
            return [];
        }
        $decoded = json_decode((string) $raw, true);
        $services = is_array($decoded['data']['services'] ?? null) ? $decoded['data']['services'] : [];
        return dedupeServicesCatalog($services);
    } catch (Exception $e) {
        return [];
    }
}

/**
 * Pages « application » métier (layout large, mode user par défaut).
 * N'affecte plus la visibilité de la sidebar — voir shouldShowAdminSidebar().
 */
function isGdriAppPage() {
    if (!empty($GLOBALS['hide_admin_sidebar'])) {
        return true;
    }
    if (!empty($GLOBALS['show_admin_sidebar'])) {
        return false;
    }

    $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    $basename = basename($script);

    $appBasenames = [
        'facebook.php',
        'facebook-resume.php',
        'chat.php',
        'ugap.php',
        'gderpi.php',
        'pm.php',
        'doc-hub.php',
        'banque.php',
        'media-studio.php',
        'prompt.php',
    ];
    if (in_array($basename, $appBasenames, true)) {
        return true;
    }

    if (strpos($script, '/pages/modules/') !== false) {
        if (preg_match('/-config\.php$/i', $basename)) {
            return false;
        }
        if ($basename === 'entity-roles.php') {
            return false;
        }
        if (preg_match('/^(ia-|mail-|facebook-agent)/i', $basename)) {
            return false;
        }
        return true;
    }

    return false;
}

/**
 * Peut ouvrir la console plateforme GDRI.
 */
function canAccessPlatformConsole() {
    return hasRole(ROLE_ADMIN_GDRI);
}

/**
 * Peut ouvrir la console entité (admin société).
 */
function canAccessEntityConsole() {
    return hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);
}

/**
 * Pages console entité (sidebar admin entité).
 */
function isGdriEntityConsolePage() {
    if (isGdriAppPage()) {
        return false;
    }

    $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    $basename = basename($script);
    $consolePages = [
        'entity-applications.php',
        'entity-agents.php',
        'entity-agent-editor.php',
        'entity-connecteurs.php',
        'entity-structurel.php',
        'entity-console.php',
        'entity-config.php',
        'users.php',
        'entity-roles.php',
    ];
    if (in_array($basename, $consolePages, true)) {
        return true;
    }

    if ($basename === 'annuaire.php' && strtolower(trim((string) ($_GET['focus'] ?? ''))) === 'identity') {
        return true;
    }

    if (strpos($script, '/pages/modules/') !== false && preg_match('/-config\.php$/i', $basename)) {
        return !isGdriPlatformShellPage();
    }

    return false;
}

/**
 * Espace utilisateur (apps, dashboard, mon compte) — pas de sidebar admin.
 */
function isGdriUserSpacePage() {
    if (isGdriAppPage()) {
        return true;
    }

    $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    $basename = basename($script);
    $userPages = [
        'dashboard.php',
        'modules.php',
        'applications.php',
        'user-agents.php',
        'user-agents-auto.php',
        'user-agents-assisted.php',
        'agent-human-review.php',
        'user-connecteurs.php',
        'user-structurel.php',
        'account-modules.php',
        'account-profile.php',
        'account-notifications.php',
        'entity-legacy.php',
    ];
    if (in_array($basename, $userPages, true)) {
        return true;
    }

    if ($basename === 'annuaire.php') {
        $focus = strtolower(trim((string) ($_GET['focus'] ?? '')));
        return $focus !== 'identity';
    }

    return false;
}

/**
 * Mode espace de travail : platform | entity | user
 */
function getGdriWorkspaceMode($hasCurrentEntreprise = null) {
    if (!isLoggedIn()) {
        return 'user';
    }

    if ($hasCurrentEntreprise === null) {
        $hasCurrentEntreprise = !empty($_SESSION['currentEntrepriseId'] ?? $_SESSION['entrepriseId'] ?? null);
    }

    $mode = $_SESSION['gdri_workspace_mode'] ?? null;
    if ($mode === 'platform' || $mode === 'entity' || $mode === 'user') {
        if ($mode === 'platform' && !canAccessPlatformConsole()) {
            return canAccessEntityConsole() ? 'entity' : 'user';
        }
        if ($mode === 'entity' && !canAccessEntityConsole()) {
            return 'user';
        }
        if ($mode === 'entity' && canAccessPlatformConsole() && !$hasCurrentEntreprise) {
            return 'platform';
        }
        return $mode;
    }

    // Rétrocompat session gdri_admin_nav_mode
    $legacy = $_SESSION['gdri_admin_nav_mode'] ?? null;
    if ($legacy === 'platform' && canAccessPlatformConsole()) {
        return 'platform';
    }
    if (canAccessEntityConsole() && isGdriEntityConsolePage()) {
        return 'entity';
    }
    if (canAccessPlatformConsole() && !$hasCurrentEntreprise) {
        return 'platform';
    }
    return 'user';
}

function gdriWorkspaceModeUrl($mode) {
    return url('auth/set-nav-mode.php?mode=' . rawurlencode((string) $mode));
}

/**
 * Aligne le mode espace de travail sur la page courante.
 */
function syncGdriWorkspaceModeFromPage() {
    if (!canAccessEntityConsole() && !canAccessPlatformConsole()) {
        if (isGdriUserSpacePage()) {
            $_SESSION['gdri_workspace_mode'] = 'user';
        }
        return;
    }

    $basename = basename(str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '')));
    if ($basename === 'users.php') {
        $hasEntity = !empty($_SESSION['currentEntrepriseId'] ?? $_SESSION['entrepriseId'] ?? null);
        if ($hasEntity && canAccessEntityConsole()) {
            $_SESSION['gdri_workspace_mode'] = 'entity';
            $_SESSION['gdri_admin_nav_mode'] = 'entity';
        }
        return;
    }

    if (isGdriPlatformShellPage()) {
        $_SESSION['gdri_workspace_mode'] = 'platform';
        $_SESSION['gdri_admin_nav_mode'] = 'platform';
        return;
    }

    // Éditeur d'agent : reste en Mon espace si ouvert depuis Agents auto/assistés.
    if ($basename === 'entity-agent-editor.php') {
        $space = strtolower(trim((string) ($_GET['space'] ?? '')));
        $return = strtolower(trim((string) ($_GET['return'] ?? '')));
        if ($space === 'user' || in_array($return, ['auto', 'automatic', 'assisted'], true)) {
            $_SESSION['gdri_workspace_mode'] = 'user';
            return;
        }
        $_SESSION['gdri_workspace_mode'] = 'entity';
        $_SESSION['gdri_admin_nav_mode'] = 'entity';
        return;
    }

    if (isGdriEntityConsolePage()) {
        $_SESSION['gdri_workspace_mode'] = 'entity';
        $_SESSION['gdri_admin_nav_mode'] = 'entity';
        return;
    }

    if (isGdriUserSpacePage()) {
        $_SESSION['gdri_workspace_mode'] = 'user';
    }
}

/**
 * Afficher la sidebar admin (sélecteur de mode + navigation console).
 * Toujours visible pour les utilisateurs connectés (y compris dans les apps).
 * Seul $GLOBALS['hide_admin_sidebar'] peut la masquer explicitement.
 */
function shouldShowAdminSidebar() {
    if (!empty($GLOBALS['hide_admin_sidebar'])) {
        return false;
    }
    if (!isLoggedIn()) {
        return false;
    }
    return true;
}

/**
 * Mode navigation GDRI : entity | platform (legacy — dérivé du workspace).
 */
function getGdriAdminNavMode($hasCurrentEntreprise = null) {
    $workspace = getGdriWorkspaceMode($hasCurrentEntreprise);
    if ($workspace === 'platform') {
        return 'platform';
    }
    return 'entity';
}

/**
 * @deprecated Utiliser syncGdriWorkspaceModeFromPage()
 */
function syncGdriAdminNavModeFromPage() {
    syncGdriWorkspaceModeFromPage();
}

/**
 * Pages shell plateforme (console GDRI).
 */
function isGdriPlatformShellPage() {
    $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    $basename = basename($script);
    $platformPages = [
        'entities.php',
        'platform-structurel.php',
        'platform-connecteurs.php',
        'platform-users.php',
        'platform-applications.php',
        'platform-agents.php',
        'platform-roles.php',
        'platform-deploy.php',
        'admin-modules.php',
        'admin-modules-mail.php',
        'admin-modules-backup.php',
        'user-activity.php',
        'facebook-app-config.php',
        'ia-config.php',
    ];
    return in_array($basename, $platformPages, true);
}

/**
 * Pages shell entité (hors apps).
 */
function isGdriEntityShellPage() {
    if (isGdriAppPage()) {
        return false;
    }

    $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    $basename = basename($script);
    $entityPages = [
        'dashboard.php',
        'modules.php',
        'applications.php',
        'entity-applications.php',
        'entity-connecteurs.php',
        'entity-structurel.php',
        'entity-console.php',
        'entity-config.php',
        'entity-agents.php',
        'entity-agent-editor.php',
        'users.php',
        'entity-roles.php',
        'account-modules.php',
        'account-profile.php',
        'account-notifications.php',
    ];
    if (in_array($basename, $entityPages, true)) {
        return true;
    }

    if (strpos($script, '/pages/modules/') !== false && preg_match('/-config\.php$/i', $basename)) {
        return !isGdriPlatformShellPage();
    }

    return false;
}

/**
 * Accueil du logo selon le mode navigation.
 */
function getGdriLogoHomeUrl() {
    if (!isLoggedIn()) {
        return url('index.php');
    }
    $mode = getGdriWorkspaceMode();
    if ($mode === 'platform') {
        return url('pages/entities.php');
    }
    if ($mode === 'entity') {
        return url('pages/entity-applications.php');
    }
    return url('pages/dashboard.php');
}

/**
 * Peut ouvrir le sélecteur d'entité (header).
 */
function canOpenEntrepriseSelector($userEntreprises) {
    if (!isLoggedIn() || !is_array($userEntreprises)) {
        return false;
    }
    return count($userEntreprises) > 1;
}

/**
 * Initiales utilisateur pour l'avatar header.
 */
function getUserInitials() {
    $email = trim((string) ($_SESSION['user_email'] ?? ''));
    if ($email === '') {
        return '?';
    }
    $local = explode('@', $email)[0] ?? $email;
    $parts = preg_split('/[.\-_]+/', $local) ?: [];
    if (count($parts) >= 2) {
        return strtoupper(substr($parts[0], 0, 1) . substr($parts[1], 0, 1));
    }
    return strtoupper(substr($local, 0, 2));
}

/**
 * URL active dans la sidebar.
 */
function gdriNavIsActive($pathFragment) {
    $current = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    return strpos($current, $pathFragment) !== false;
}

/**
 * Synchronise la collection services avec les modules présents sur le disque
 * @param MongoDB\Database $db Instance MongoDB
 * @return void
 */
function syncServicesWithFilesystemModules($db) {
    $servicesCollection = $db->services;
    $existingServices = $servicesCollection->find([])->toArray();
    $existingBySlug = [];
    $existingByName = [];

    foreach ($existingServices as $service) {
        if (!empty($service['slug'])) {
            $existingBySlug[strtolower(trim($service['slug']))] = true;
        }
        if (!empty($service['name'])) {
            $existingByName[strtolower(trim($service['name']))] = true;
        }
    }

    $moduleRoots = [
        __DIR__ . '/../../modules'
    ];

    foreach ($moduleRoots as $rootPath) {
        if (!is_dir($rootPath)) {
            continue;
        }

        $entries = scandir($rootPath);
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            $modulePath = $rootPath . '/' . $entry;
            if (!is_dir($modulePath)) {
                continue;
            }

            $packagePath = $modulePath . '/backend/package.json';
            if (!file_exists($packagePath)) {
                $packagePath = $modulePath . '/package.json';
            }
            if (!file_exists($packagePath)) {
                continue;
            }

            $rawJson = file_get_contents($packagePath);
            $config = json_decode($rawJson, true);
            if (!$config || !is_array($config)) {
                continue;
            }

            $moduleName = $config['displayName'] ?? $config['name'] ?? $entry;
            $slugSource = $config['name'] ?? $entry;
            $slug = strtolower(trim(preg_replace('/\s+/', '-', $slugSource)));

            if ($slug && isset($existingBySlug[$slug])) {
                continue;
            }
            if (isset($existingByName[strtolower(trim($moduleName))])) {
                continue;
            }

            $description = $config['description'] ?? ('Module ' . $moduleName);
            $icon = $config['icon'] ?? '🧩';
            $status = ($config['enabled'] ?? true) ? 'active' : 'inactive';

            $servicesCollection->insertOne([
                'name' => $moduleName,
                'slug' => $slug,
                'description' => $description,
                'icon' => $icon,
                'status' => $status,
                'created_at' => new MongoDB\BSON\UTCDateTime()
            ]);

            if ($slug) {
                $existingBySlug[$slug] = true;
            }
            $existingByName[strtolower(trim($moduleName))] = true;
        }
    }
}


