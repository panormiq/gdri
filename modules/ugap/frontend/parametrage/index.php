<?php

/**

 * FICHIER : modules/ugap/frontend/parametrage/index.php

 * RÔLE : Entrée paramétrage UGAP v2 (standalone). Import GDRI via gdri-embed.php.

 */

require __DIR__ . '/init.php';



if (ugap_is_gdri_embed()) {

    require __DIR__ . '/gdri-embed.php';

    return;

}



$ugapParamEnqueueAssets();

?>

<!DOCTYPE html>

<html lang="fr">

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">

    <title>UGAP — Paramétrage</title>
    <script>window.API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';</script>
    <link rel="stylesheet" href="/frontend/assets/css/variables.css">

    <link rel="stylesheet" href="/frontend/assets/css/main.css">

    <?php ugap_print_enqueued_styles(); ?>

</head>

<body>
    <div
        id="ugap-parametrage-app"
        data-initial-section="<?= htmlspecialchars($__ugapParamSection, ENT_QUOTES, 'UTF-8') ?>"
        data-initial-tab="<?= htmlspecialchars($__ugapParamTab, ENT_QUOTES, 'UTF-8') ?>"
    >
        <?php require $__ugapParamRoot . '/partials/shell.php'; ?>
    </div>

    <?php ugap_print_enqueued_scripts(); ?>

</body>

</html>

