<?php
/**
 * Manifest module Chat
 * Rend le module visible dans:
 * - Administration > Modules (via page dédiée)
 * - Configuration entité
 * - Mon compte
 */

return [
    'id' => 'chat',
    'name' => 'Module Chat IA',
    'description' => 'Chat IA avec contexte, mémoire de conversation et defaults serveur/modèle.',
    'icon' => '💬',
    'view_url' => 'pages/modules/chat.php',
    'view_label' => 'Ouvrir le chat IA',
    'admin_entity' => [
        'config_url' => 'pages/modules/chat-config-entity.php',
        'config_label' => 'Configurer le chat (entité)'
    ],
    'user' => [
        'config_url' => 'pages/modules/chat-config-user.php',
        'config_label' => 'Configurer le chat (profil)'
    ]
];
