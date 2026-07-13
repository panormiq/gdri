<?php
/**
 * Paramétrage UGAP — inclusion directe (sans iframe).
 */
$GLOBALS['__ugapGdriEmbed'] = true;
$ugapModuleRoot = realpath(__DIR__ . '/../../../modules/ugap/frontend');
if (!$ugapModuleRoot || !is_file($ugapModuleRoot . '/parametrage/gdri-embed.php')) {
    echo '<div class="ugap-panel ugap-panel--placeholder"><p>Module paramétrage UGAP introuvable.</p></div>';
    return;
}
?>
<script>window.UgapDevisTemplateEditorBase = <?= json_encode(url('pages/modules/document-agent-v2/editor.php')) ?>;</script>
<div class="ugap-module-layout" id="ugap-parametrage-embed-root">
    <div class="ugap-panel ugap-panel--parametrage">
        <?php if ($canManageUgap): ?>
            <?php require $ugapModuleRoot . '/parametrage/gdri-embed.php'; ?>
        <?php else: ?>
            <div class="ugap-panel ugap-panel--placeholder" style="padding:20px;">
                <h3>Parametrage du module UGAP</h3>
                <p>Acces reserve aux administrateurs de l'entite.</p>
            </div>
        <?php endif; ?>
    </div>
</div>
