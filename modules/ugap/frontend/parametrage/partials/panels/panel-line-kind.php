<?php
/** Partial générique : tableau lignes par type. Variables : $__panelKind, $__panelTitle, $__panelHint */
$__panelKind = $__panelKind ?? 'catalogue';
$__panelTitle = $__panelTitle ?? 'Options';
$__panelHint = $__panelHint ?? '';
?>
<section class="ugap-param-panel" data-panel="<?= htmlspecialchars($__panelKind, ENT_QUOTES, 'UTF-8') ?>" id="ugap-panel-<?= htmlspecialchars($__panelKind, ENT_QUOTES, 'UTF-8') ?>" hidden>
    <h2><?= htmlspecialchars($__panelTitle, ENT_QUOTES, 'UTF-8') ?></h2>
    <?php if ($__panelHint !== ''): ?>
        <p class="ugap-param-lead"><?= htmlspecialchars($__panelHint, ENT_QUOTES, 'UTF-8') ?></p>
    <?php endif; ?>
    <div class="ugap-detect-table-wrap" data-detect-kind="<?= htmlspecialchars($__panelKind, ENT_QUOTES, 'UTF-8') ?>"></div>
</section>
