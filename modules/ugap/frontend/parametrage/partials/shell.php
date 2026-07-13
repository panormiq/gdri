<div class="ugap-param-container" id="ugap-parametrage-root">

    <div class="ugap-param-banner" role="status">
        <strong>Paramétrage UGAP</strong> — zones de configuration du module.
    </div>

    <div id="alert-container"></div>

    <nav class="ugap-param-sections" aria-label="Zones paramétrage">
        <button type="button" class="ugap-param-section-tab is-active" data-section="catalogue">Catalogue</button>
        <button type="button" class="ugap-param-section-tab" data-section="options">Options</button>
        <button type="button" class="ugap-param-section-tab" data-section="liaisons">Liaisons</button>
        <button type="button" class="ugap-param-section-tab" data-section="bateau-base">Templates de base</button>
        <button type="button" class="ugap-param-section-tab" data-section="modeles">Modèles</button>
        <button type="button" class="ugap-param-section-tab" data-section="info-entreprise">Info entreprise</button>
        <button type="button" class="ugap-param-section-tab" data-section="modele-devis">Modèle devis</button>
        <button type="button" class="ugap-param-section-tab" data-section="importation">Importation</button>
    </nav>

    <div class="ugap-param-section-body card">
        <?php require __DIR__ . '/section-catalogue.php'; ?>
        <?php require __DIR__ . '/section-options.php'; ?>
        <?php require __DIR__ . '/section-liaisons.php'; ?>
        <?php require __DIR__ . '/section-bateau-base.php'; ?>
        <?php require __DIR__ . '/section-modeles.php'; ?>
        <?php require __DIR__ . '/section-info-entreprise.php'; ?>
        <?php require __DIR__ . '/section-modele-devis.php'; ?>
        <?php require __DIR__ . '/section-importation.php'; ?>
    </div>

</div>
