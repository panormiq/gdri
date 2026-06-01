<?php
/**
 * Prompts IA UGAP — inclusion directe legacy (sans iframe).
 */
$GLOBALS['__ugapGdriEmbed'] = true;
$ugapModuleRoot = realpath(__DIR__ . '/../../../modules/ugap/frontend');
if (!$ugapModuleRoot || !is_file($ugapModuleRoot . '/_old/gdri-embed-prompts.php')) {
    echo '<div class="ugap-panel ugap-panel--placeholder"><p>Prompts IA UGAP introuvable.</p></div>';
    return;
}
?>
<div class="ugap-panel ugap-panel--prompts-ia">
    <?php if ($canManageUgap): ?>
        <?php require $ugapModuleRoot . '/_old/gdri-embed-prompts.php'; ?>
    <?php else: ?>
        <div class="ugap-panel ugap-panel--placeholder" style="padding:20px;">
            <h3>Prompts IA</h3>
            <p>Acces reserve aux administrateurs de l'entite.</p>
        </div>
    <?php endif; ?>
</div>
