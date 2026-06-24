<?php
/**
 * Section Paramétrage → Importation (Import Excel v2).
 * Sous-onglets : détection, relecture par type, validation.
 */
?>
<div
    class="ugap-param-section-panel is-active"
    id="ugap-section-importation"
    data-section-panel="importation"
    data-section-has-import-tabs="1"
>
    <p class="ugap-param-lead ugap-import-section-lead">
        Analyse Excel, relecture des lignes par type, puis validation et publication.
        <a href="/modules/ugap/docs/metier/EXCEL-MODELES-OPTIONS.md" target="_blank" rel="noopener">Règles métier</a>
    </p>

    <nav class="ugap-import-tabs" aria-label="Étapes import Excel">
        <button type="button" class="ugap-import-tab is-active" data-tab="detect">Détection</button>
        <button type="button" class="ugap-import-tab" data-tab="modeles">Modèles</button>
        <button type="button" class="ugap-import-tab" data-tab="minoration">Minorations</button>
        <button type="button" class="ugap-import-tab" data-tab="majoration">Majorations</button>
        <button type="button" class="ugap-import-tab" data-tab="catalogue">Options catalogue</button>
        <button type="button" class="ugap-import-tab" data-tab="base_option">Options de base</button>
        <button type="button" class="ugap-import-tab" data-tab="pr">PR</button>
        <button type="button" class="ugap-import-tab" data-tab="valider">Valider</button>
    </nav>

    <div class="ugap-param-panels card" id="ugap-import-panels">
        <?php require __DIR__ . '/panels/panel-detect.php'; ?>
        <?php require __DIR__ . '/panels/panel-models.php'; ?>
        <?php
        $linePanels = [
            ['kind' => 'minoration', 'title' => 'Minorations', 'hint' => 'Nom de l\'option = produit de base ciblé (moteur : motorisation du poste). Libellé Excel = texte complet. Postes = croix ou libellé uniquement.'],
            ['kind' => 'majoration', 'title' => 'Majorations', 'hint' => 'Nom de l\'option = produit remplacé détecté (ex. HDS PRO 12, flotteur de base). Libellé Excel = texte complet de la ligne.'],
            ['kind' => 'catalogue', 'title' => 'Options catalogue', 'hint' => 'Lignes tarif avec croix modèles, hors PR / MINO / majo.'],
            ['kind' => 'base_option', 'title' => 'Options de base', 'hint' => 'Poste obligatoire pour publication. Même nom d\'option = fond coloré → cochez et fusionnez manuellement (pas le libellé Excel).'],
            ['kind' => 'pr', 'title' => 'PR (pièces rechange)', 'hint' => 'Libellé commençant par PR — sans croix modèles automatiques.'],
        ];
        foreach ($linePanels as $p) {
            $__panelKind = $p['kind'];
            $__panelTitle = $p['title'];
            $__panelHint = $p['hint'];
            require __DIR__ . '/panels/panel-line-kind.php';
        }
        ?>
        <?php require __DIR__ . '/panels/panel-valider.php'; ?>
    </div>
</div>
