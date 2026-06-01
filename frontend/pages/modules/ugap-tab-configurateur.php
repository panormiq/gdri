<?php
/**
 * Configurateur UGAP — inclusion directe (sans iframe).
 */
$GLOBALS['__ugapGdriEmbed'] = true;
$ugapModuleRoot = realpath(__DIR__ . '/../../../modules/ugap/frontend');
if (!$ugapModuleRoot || !is_file($ugapModuleRoot . '/configurateur/gdri-embed.php')) {
    echo '<div class="ugap-panel ugap-panel--placeholder"><p>Configurateur UGAP introuvable.</p></div>';
    return;
}
?>
<div class="ugap-panel ugap-panel--configurateur-embed" id="ugap-configurateur-host">
    <?php require $ugapModuleRoot . '/configurateur/gdri-embed.php'; ?>
</div>
