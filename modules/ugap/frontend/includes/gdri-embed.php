<?php
/**
 * FICHIER : modules/ugap/frontend/includes/gdri-embed.php
 * RÔLE : Helpers inclusion directe dans pages GDRI (sans iframe).
 *
 * ENTRÉES : $__ugapGdriEmbed défini par la page hôte
 * SORTIES : files CSS/JS en file d'attente, HTML fragment
 *
 * DÉPEND DE : —
 * NE PAS : logique métier UGAP
 * APPELÉ PAR : ugap-tab-*.php, index.php / parametrage/index.php
 */

if (!function_exists('ugap_is_gdri_embed')) {
    function ugap_is_gdri_embed(): bool
    {
        return !empty($GLOBALS['__ugapGdriEmbed']);
    }

    function ugap_set_gdri_embed(bool $on = true): void
    {
        $GLOBALS['__ugapGdriEmbed'] = $on;
    }

    function ugap_frontend_root(): string
    {
        return dirname(__DIR__);
    }

    function ugap_resolve_asset_path(string $href): string
    {
        if (str_starts_with($href, '/modules/ugap/frontend/')) {
            return ugap_frontend_root() . substr($href, strlen('/modules/ugap/frontend'));
        }
        if (str_starts_with($href, '/frontend/')) {
            return dirname(ugap_frontend_root(), 3) . $href;
        }
        return $href;
    }

    function ugap_asset_version(string $href): int
    {
        $path = ugap_resolve_asset_path($href);
        return is_file($path) ? (int) filemtime($path) : (int) time();
    }

    function ugap_enqueue_style(string $href): void
    {
        $GLOBALS['__ugapEnqueuedStyles'][$href] = $href;
    }

    function ugap_enqueue_script(string $src): void
    {
        $GLOBALS['__ugapEnqueuedScripts'][$src] = $src;
    }

    function ugap_print_enqueued_styles(): void
    {
        if (empty($GLOBALS['__ugapEnqueuedStyles'])) {
            return;
        }
        foreach ($GLOBALS['__ugapEnqueuedStyles'] as $href) {
            $sep = str_contains($href, '?') ? '&' : '?';
            $v = ugap_asset_version($href);
            echo '<link rel="stylesheet" href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . $sep . 'v=' . $v . '">' . "\n";
        }
    }

    function ugap_print_enqueued_scripts(): void
    {
        if (empty($GLOBALS['__ugapEnqueuedScripts'])) {
            return;
        }
        foreach ($GLOBALS['__ugapEnqueuedScripts'] as $src) {
            $sep = str_contains($src, '?') ? '&' : '?';
            $v = ugap_asset_version($src);
            echo '<script src="' . htmlspecialchars($src, ENT_QUOTES, 'UTF-8') . $sep . 'v=' . $v . '"></script>' . "\n";
        }
    }
}

if (!isset($GLOBALS['__ugapEnqueuedStyles'])) {
    $GLOBALS['__ugapEnqueuedStyles'] = [];
}
if (!isset($GLOBALS['__ugapEnqueuedScripts'])) {
    $GLOBALS['__ugapEnqueuedScripts'] = [];
}

if (isset($__ugapGdriEmbed) && $__ugapGdriEmbed) {
    ugap_set_gdri_embed(true);
}
