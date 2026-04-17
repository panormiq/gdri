<?php
/**
 * Footer commun pour toutes les pages - GDRI
 * Fichier : includes/footer.php
 */
?>

<!-- Footer -->
<footer class="footer">
    <div class="container">
        <div class="footer-content">
            <!-- Infos entreprise -->
            <div class="footer-section">
                <h3>GDR-Innovation</h3>
                <p class="footer-slogan">Simplifiez-vous la vie</p>
                <p class="footer-info">
                    <strong>Email :</strong> contact@gdr-innovation.fr<br>
                    <strong>Téléphone :</strong> 06 84 28 63 47<br>
                    <strong>SIRET :</strong> 800944 407
                </p>
            </div>

            <!-- Adresse -->
            <div class="footer-section">
                <h3>Notre adresse</h3>
                <p class="footer-address">
                    <?php echo str_replace(', ', '<br>', SITE_ADDRESS); ?>
                </p>
            </div>

            <!-- Liens rapides -->
            <div class="footer-section">
                <h3>Liens rapides</h3>
                <ul class="footer-links">
                    <li><a href="<?php echo url('index.php'); ?>">Accueil</a></li>
                    <li><a href="<?php echo url('pages/agents.php'); ?>">Nos Agents</a></li>
                    <li><a href="<?php echo url('pages/contact.php'); ?>">Contact</a></li>
                    <li><a href="<?php echo url('pages/privacy-policy.php'); ?>">Politique de confidentialité</a></li>
                </ul>
            </div>
        </div>

        <div class="footer-bottom">
            <p>&copy; <?php echo date('Y'); ?> GDR-Innovation. Tous droits réservés.</p>
        </div>
    </div>
</footer>

<!-- JavaScript -->
<script src="<?php echo url('assets/js/main.js'); ?>"></script>
<script src="<?php echo url('assets/js/navigation.js'); ?>"></script>
<script src="<?php echo url('assets/js/modal.js'); ?>"></script>
<script src="<?php echo url('assets/js/form-validation.js'); ?>"></script>
<?php if (!empty($extra_scripts) && is_array($extra_scripts)): ?>
    <?php foreach ($extra_scripts as $scriptPath): ?>
        <?php 
        // Détecter si c'est un module ES6 (fichiers .js dans modules/)
        $isModule = strpos($scriptPath, '/modules/') !== false || strpos($scriptPath, 'app.js') !== false;
        ?>
        <script <?php echo $isModule ? 'type="module"' : ''; ?> src="<?php echo htmlspecialchars($scriptPath); ?>"></script>
    <?php endforeach; ?>
<?php endif; ?>

<?php if (function_exists('isLoggedIn') && isLoggedIn()): ?>
<script>
(function() {
    const endpoint = <?php echo json_encode(url('auth/user-activity.php')); ?>;
    const payload = {
        eventType: 'page_view',
        page: <?php echo json_encode($page_title ?? null, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>,
        url: window.location.pathname,
        referrer: document.referrer || null
    };
    fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(() => {
        // Tracking silencieux
    });
})();
</script>
<?php endif; ?>

</body>
</html>

