<?php
$ugapAdminFs = realpath(__DIR__ . '/../../../modules/ugap/frontend/admin.php');
$ugapAdminAssetV = ($ugapAdminFs && is_file($ugapAdminFs)) ? (int) filemtime($ugapAdminFs) : (int) time();
?>
<div class="ugap-panel">
    <?php if ($canManageUgap): ?>
        <iframe
            id="ugap-embed-frame"
            class="ugap-embed-frame"
            src="/modules/ugap/frontend/admin.php?embedded=1&amp;ugapView=prompts&amp;v=<?= $ugapAdminAssetV ?>"
            title="Module UGAP - Prompts IA"
            style="width:100%; min-height:480px; border:0; display:block;"
            scrolling="no"
            loading="eager"
            referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
    <?php else: ?>
        <div class="ugap-panel ugap-panel--placeholder">
            <h3>Prompts IA</h3>
            <p>Acces reserve aux administrateurs de l'entite.</p>
        </div>
    <?php endif; ?>
</div>
