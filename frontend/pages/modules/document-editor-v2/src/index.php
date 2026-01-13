<?php
$pageTitle = 'Editor SPA';
$additionalJS = [
    './src/modules/editor/app/app.js' // ton point d’entrée JS
];

// Tu peux utiliser ob_start si tu veux générer du contenu HTML ici
ob_start();
?>


<div id="app"></div>
<?php
$content = ob_get_clean();

// 🔥 CALCUL DU CHEMIN ABSOLU VERS front/
$frontRoot = realpath(__DIR__ . '/../../..');

// Sécurité
if (!$frontRoot) {
    die('❌ frontRoot introuvable');
}

include $frontRoot . '/templates/layout.php';
