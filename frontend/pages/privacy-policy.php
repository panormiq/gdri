<?php
/**
 * Politique de confidentialité - GDRI
 * Fichier : pages/privacy-policy.php
 *
 * Page accessible publiquement pour Facebook Developers
 */

require_once '../config/config.php';
require_once '../includes/functions.php';

$page_title = 'Politique de confidentialité';

require_once '../includes/header.php';
?>

<div class="container">
    <div class="page-header">
        <h1>Politique de confidentialité</h1>
        <p class="text-muted">Dernière mise à jour : <?php echo date('d/m/Y'); ?></p>
    </div>

    <div class="content-section">
        <section>
            <h2>1. Introduction</h2>
            <p>
                La présente politique de confidentialité décrit comment GDRI (GDR Innovation) collecte, 
                utilise et protège vos informations personnelles lorsque vous utilisez notre application 
                et nos services.
            </p>
            <p>
                En utilisant notre application, vous acceptez les pratiques décrites dans cette politique.
            </p>
        </section>

        <section>
            <h2>2. Informations que nous collectons</h2>
            <h3>2.1. Informations que vous nous fournissez</h3>
            <ul>
                <li>Nom et prénom</li>
                <li>Adresse e-mail</li>
                <li>Informations de compte (identifiants, préférences)</li>
                <li>Contenu des messages et communications</li>
            </ul>

            <h3>2.2. Informations collectées automatiquement</h3>
            <ul>
                <li>Données de connexion (adresse IP, type de navigateur)</li>
                <li>Données d'utilisation de l'application</li>
                <li>Cookies et technologies similaires</li>
            </ul>

            <h3>2.3. Informations provenant de Facebook</h3>
            <p>
                Lorsque vous vous connectez via Facebook, nous pouvons recevoir certaines informations 
                de votre profil Facebook conformément aux autorisations que vous accordez.
            </p>
        </section>

        <section>
            <h2>3. Utilisation des informations</h2>
            <p>Nous utilisons vos informations pour :</p>
            <ul>
                <li>Fournir et améliorer nos services</li>
                <li>Personnaliser votre expérience</li>
                <li>Communiquer avec vous concernant nos services</li>
                <li>Analyser les tendances et améliorer l'application</li>
                <li>Assurer la sécurité et prévenir la fraude</li>
            </ul>
        </section>

        <section>
            <h2>4. Partage des informations</h2>
            <p>
                Nous ne vendons pas vos informations personnelles. Nous pouvons partager vos informations 
                uniquement dans les cas suivants :
            </p>
            <ul>
                <li>Avec votre consentement explicite</li>
                <li>Pour respecter une obligation légale</li>
                <li>Avec nos prestataires de services de confiance (sous accord de confidentialité)</li>
                <li>En cas de fusion, acquisition ou vente d'actifs</li>
            </ul>
        </section>

        <section>
            <h2>5. Protection des données</h2>
            <p>
                Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées 
                pour protéger vos informations personnelles contre l'accès non autorisé, la perte, 
                la destruction ou la modification.
            </p>
        </section>

        <section>
            <h2>6. Vos droits</h2>
            <p>Conformément au RGPD, vous avez le droit de :</p>
            <ul>
                <li>Accéder à vos données personnelles</li>
                <li>Rectifier vos données</li>
                <li>Demander l'effacement de vos données</li>
                <li>Vous opposer au traitement de vos données</li>
                <li>Demander la portabilité de vos données</li>
                <li>Retirer votre consentement à tout moment</li>
            </ul>
        </section>

        <section>
            <h2>7. Cookies</h2>
            <p>
                Notre application utilise des cookies pour améliorer votre expérience. Vous pouvez 
                configurer votre navigateur pour refuser les cookies, mais cela peut limiter 
                certaines fonctionnalités de l'application.
            </p>
        </section>

        <section>
            <h2>8. Conservation des données</h2>
            <p>
                Nous conservons vos données personnelles aussi longtemps que nécessaire pour 
                fournir nos services et respecter nos obligations légales. Lorsque vos données 
                ne sont plus nécessaires, nous les supprimons de manière sécurisée.
            </p>
        </section>

        <section>
            <h2>9. Modifications de cette politique</h2>
            <p>
                Nous pouvons mettre à jour cette politique de confidentialité de temps à autre. 
                Nous vous informerons de tout changement important en publiant la nouvelle 
                politique sur cette page.
            </p>
        </section>

        <section>
            <h2>10. Contact</h2>
            <p>Pour toute question concernant cette politique de confidentialité, vous pouvez nous contacter :</p>
            <address>
                <strong>GDRI (GDR Innovation)</strong><br>
                <?php echo SITE_ADDRESS; ?><br>
                <a href="mailto:<?php echo SITE_EMAIL; ?>"><?php echo SITE_EMAIL; ?></a>
            </address>
        </section>
    </div>
</div>

<?php require_once '../includes/footer.php'; ?>

