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
                    921 impasse de la grange de rideaux
                </p>
            </div>

            <!-- Liens rapides -->
            <div class="footer-section">
                <h3>Liens rapides</h3>
                <ul class="footer-links">
                    <li><a href="<?php echo url('index.php'); ?>">Accueil</a></li>
                    <li><a href="<?php echo url('pages/agents.php'); ?>">Nos Agents</a></li>
                    <li><a href="<?php echo url('pages/contact.php'); ?>">Contact</a></li>
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

</body>
</html>

