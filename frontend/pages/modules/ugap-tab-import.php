<?php
/**
 * Import UGAP — inclusion directe (sans iframe, sans legacy).
 */
$GLOBALS['__ugapGdriEmbed'] = true;
$ugapModuleRoot = realpath(__DIR__ . '/../../../modules/ugap/frontend');
if (!$ugapModuleRoot || !is_file($ugapModuleRoot . '/import/gdri-embed.php')) {
    echo '<div class="ugap-panel ugap-panel--placeholder"><p>Module Import UGAP introuvable.</p></div>';
    return;
}
?>
<div class="ugap-module-layout ugap-import-embed-layout" id="ugap-import-embed-root">
    <div class="ugap-panel ugap-panel--import">
        <?php if ($canManageUgap): ?>
            <?php require $ugapModuleRoot . '/import/gdri-embed.php'; ?>
        <?php else: ?>
            <div class="ugap-panel ugap-panel--placeholder" style="padding:20px;">
                <h3>Import Excel UGAP</h3>
                <p>Accès réservé aux administrateurs de l'entité.</p>
            </div>
        <?php endif; ?>
    </div>
    <aside id="ugap-import-mino-recap-dock-host" class="ugap-mino-recap-dock" hidden aria-label="Rappel postes et modèles UGAP"></aside>
</div>
