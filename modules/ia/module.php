<?php

/**
 * Manifest du module IA.
 * Règle d'or : tout le code du module vit dans `modules/ia`.
 *
 * Ce fichier ne fait que décrire le module et les URLs
 * de configuration pour chaque niveau (plateforme, entité, user).
 * La logique métier restera dans les sous-dossiers backend/frontend.
 */

return [
    'id' => 'ia',
    'name' => 'Module IA',
    'description' => 'Serveurs IA, modèles et droits (GDRI, entité, utilisateur).',
    'icon' => '🤖',

    // Configuration niveau plateforme (admin GDRI)
    'admin_gdri' => [
        // À brancher plus tard sur les routes dans `modules/ia/backend/routes/admin-plateforme`
        // Pour l’instant, on pointe vers les pages existantes du panel admin si besoin.
        'config_url' => 'pages/admin/modules/ia-servers.php',
    ],

    // Configuration niveau entité (admin d’entité)
    'admin_entity' => [
        'config_url'   => 'pages/modules/ia-entity-config.php',
        'config_label' => 'Configuration IA',
    ],

    // Configuration utilisateur : serveurs personnels (dont presets OpenAI / Anthropic / DeepSeek + clé API)
    'user' => [
        'config_url' => 'pages/modules/ia-user-config.php',
    ],

    // Plus tard : définition des "cards" IA, pour le système de cards générique
    'cards' => [
        // Exemple pour plus tard :
        // 'playground' => [
        //     'title' => 'Playground IA',
        //     'route' => '/ia/cards/playground',
        // ],
    ],
];

