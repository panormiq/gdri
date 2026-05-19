<div id="tab-famille" class="tab-panel">
    <?php if (!empty($__ugapDevMode)): ?>
    <div class="ugap-dev-famille-bar">
        <span class="ugap-dev-famille-bar__label">Mode dev</span>
        <button type="button" class="btn btn-danger" style="font-size:12px; padding:6px 12px;" onclick="deleteAllValidatedFamilies()">Supprimer toutes les familles</button>
    </div>
    <?php endif; ?>
    <div id="ugap-famille-lc-mount"></div>
    <div id="extraction-famille-content" class="ugap-famille-workspace"></div>
</div>
