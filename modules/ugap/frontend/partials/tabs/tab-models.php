<div id="tab-models" class="tab-panel">
    <div id="models-subtabs" style="display:flex; gap:8px; margin-bottom:12px; border-bottom:1px solid #e5e7eb; padding-bottom:8px;">
        <button type="button" class="btn btn-primary" id="btn-model-subtab-models">Modèles</button>
        <button type="button" class="btn btn-outline" id="btn-model-subtab-template">Template bateau</button>
    </div>

    <div id="model-subtab-models" class="model-subtab-panel" style="display:block;">
        <?php require __DIR__ . '/extraction/subtab-model.php'; ?>
    </div>

    <div id="model-subtab-template" class="model-subtab-panel" style="display:none;">
        <div style="margin-bottom: 12px; padding: 10px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; color: #444; font-size: 13px;">
            Cet onglet permet de définir les <strong>options de base</strong> incluses dans le prix du bateau.
            <br>
            Le prix de référence peut être renseigné, mais le prix client de l'option reste à <strong>0 €</strong> quand elle est fournie de base.
            <br>
            Les options marquées "base" servent de valeurs par défaut pour les familles / sous-familles assignées.
        </div>
        <div id="base-model-content"></div>
    </div>
</div>
