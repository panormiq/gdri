<div class="ugap-panel">
    <?php if ($canManageUgap): ?>
        <iframe
            src="/modules/ugap/frontend/admin.php?embedded=1"
            title="Module UGAP - Parametrage"
            style="width:100%; height:calc(100vh - 320px); min-height:620px; border:0; display:block;"
            loading="eager"
            referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
    <?php else: ?>
        <div class="ugap-panel ugap-panel--placeholder">
            <h3>Parametrage du module UGAP</h3>
            <p>Acces reserve aux administrateurs de l'entite.</p>
        </div>
    <?php endif; ?>
</div>
