<?php
/**
 * FICHIER : modules/ugap/frontend/parametrage/gdri-embed.php
 * RÔLE : Fragment paramétrage v2 inclus dans ugap.php (sans iframe).
 */
$GLOBALS['__ugapGdriEmbed'] = true;
require __DIR__ . '/init.php';
$ugapParamEnqueueAssets();

$sectionFromGdri = isset($_GET['param_section']) ? (string) $_GET['param_section'] : '';
if ($sectionFromGdri !== '' && in_array($sectionFromGdri, $allowedSections, true)) {
    $__ugapParamSection = $sectionFromGdri;
}
$tabFromGdri = isset($_GET['param_tab']) ? (string) $_GET['param_tab'] : '';
if ($tabFromGdri !== '') {
    $__ugapParamTab = $tabFromGdri;
    $allowedImportTabs = ['detect', 'modeles', 'minoration', 'majoration', 'catalogue', 'base_option', 'pr', 'valider'];
    if (!in_array($__ugapParamTab, $allowedImportTabs, true)) {
        $__ugapParamTab = 'detect';
    }
}
?>
<div
    id="ugap-parametrage-app"
    class="ugap-gdri-embed"
    data-initial-section="<?= htmlspecialchars($__ugapParamSection, ENT_QUOTES, 'UTF-8') ?>"
    data-initial-tab="<?= htmlspecialchars($__ugapParamTab, ENT_QUOTES, 'UTF-8') ?>"
>
    <?php require $__ugapParamRoot . '/partials/shell.php'; ?>
</div>
