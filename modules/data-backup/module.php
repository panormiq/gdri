<?php

/**
 * Manifest du module Sauvegarde (data-backup).
 */

return [
    'id' => 'data-backup',
    'name' => 'Sauvegarde des bases client',
    'description' => 'Export et historique des bases MongoDB par entité.',
    'icon' => '💾',

    'admin_gdri' => [
        'config_url' => 'pages/admin-modules-backup.php',
    ],

    'admin_entity' => [
        'config_url'   => 'pages/modules/backup-config.php',
        'config_label' => 'Sauvegarde',
    ],
];
