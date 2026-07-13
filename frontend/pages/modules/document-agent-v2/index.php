<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Agent Documentaire V2';

require_once '../../../includes/header.php';
?>

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <div>
                <h1>Agent Documentaire V2</h1>
                <p class="hero-description">
                    Moteur canvas A4 — collections, templates, génération PDF. V1 mise au rebus.
                </p>
            </div>
            <div class="hero-actions">
                <a class="btn btn-outline" href="<?= url('pages/modules.php'); ?>">Applications</a>
                <a class="btn btn-primary" href="<?= url('pages/modules/document-agent-v2/editor.php?template=ugap:devis:default'); ?>">Éditer modèle devis UGAP</a>
            </div>
        </div>
    </div>
</section>

<section class="section">
    <div class="container card" style="padding:20px;">
        <h2 style="margin-top:0;">Documentation</h2>
        <p>Spécification complète : <code>backend/modules/agent-documentaire-v2/SPEC.md</code></p>
        <ul>
            <li>Page A4 WYSIWYG avec zones draggables</li>
            <li>Texte en flux dans les cadres (text-frame)</li>
            <li>Guides verticaux / horizontaux + aimants</li>
            <li>Collections UGAP (phase 2)</li>
        </ul>
    </div>
</section>

<?php require_once '../../../includes/footer.php'; ?>
