<?php
/**
 * Coque section paramétrage v2 (sans logique métier).
 * Variables : $__sectionId, $__sectionTitle, $__sectionLead (optionnel $__sectionPlanDoc)
 */
$__sectionId = $__sectionId ?? 'stub';
$__sectionTitle = $__sectionTitle ?? 'Section';
$__sectionLead = $__sectionLead ?? '';
$__sectionPlanDoc = $__sectionPlanDoc ?? '';
?>
<section
    class="ugap-param-section-panel"
    id="ugap-section-<?= htmlspecialchars($__sectionId, ENT_QUOTES, 'UTF-8') ?>"
    data-section-panel="<?= htmlspecialchars($__sectionId, ENT_QUOTES, 'UTF-8') ?>"
    hidden
>
    <h2><?= htmlspecialchars($__sectionTitle, ENT_QUOTES, 'UTF-8') ?></h2>
    <?php if ($__sectionLead !== ''): ?>
        <p class="ugap-param-lead"><?= $__sectionLead ?></p>
    <?php endif; ?>
    <?php if ($__sectionPlanDoc !== ''): ?>
        <p class="ugap-param-plan-link">
            <a href="<?= htmlspecialchars($__sectionPlanDoc, ENT_QUOTES, 'UTF-8') ?>" target="_blank" rel="noopener">Plan de réécriture</a>
        </p>
    <?php endif; ?>
    <div class="ugap-param-placeholder card">
        <p>Interface <strong><?= htmlspecialchars($__sectionTitle, ENT_QUOTES, 'UTF-8') ?></strong> — à brancher (v2, sans legacy).</p>
    </div>
</section>
