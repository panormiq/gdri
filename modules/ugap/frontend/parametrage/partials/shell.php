<div class="ugap-param-container" id="ugap-parametrage-root">

    <div class="ugap-param-banner" role="status">
        <strong>Paramétrage UGAP</strong> — zones de configuration du module.
    </div>

    <div id="alert-container"></div>

    <nav class="ugap-param-sections" aria-label="Zones paramétrage">
        <button type="button" class="ugap-param-section-tab is-active" data-section="importation">Importation</button>
        <button type="button" class="ugap-param-section-tab" data-section="famille">Famille</button>
        <button type="button" class="ugap-param-section-tab" data-section="options">Options</button>
        <button type="button" class="ugap-param-section-tab" data-section="categorie">Catégories</button>
        <button type="button" class="ugap-param-section-tab" data-section="bateau-base">Bateau de base</button>
        <button type="button" class="ugap-param-section-tab" data-section="modeles">Modèles</button>
    </nav>

    <div class="ugap-param-section-body card">
        <?php require __DIR__ . '/section-importation.php'; ?>
        <?php require __DIR__ . '/section-famille.php'; ?>
        <?php require __DIR__ . '/section-options.php'; ?>
        <?php require __DIR__ . '/section-categorie.php'; ?>
        <?php require __DIR__ . '/section-bateau-base.php'; ?>
        <?php require __DIR__ . '/section-modeles.php'; ?>
    </div>

</div>
