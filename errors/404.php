<?php
/**
 * Page d'erreur 404 - Page non trouvée
 * Fichier : errors/404.php
 */

http_response_code(404);
$page_title = 'Page non trouvée';
require_once __DIR__ . '/../includes/header.php';
?>

<section class="section" style="min-height: 60vh; display: flex; align-items: center;">
    <div class="container" style="text-align: center;">
        <h1 style="font-size: 120px; margin-bottom: 0; color: var(--color-primary);">404</h1>
        <h2>Page non trouvée</h2>
        <p style="font-size: var(--font-size-large); color: var(--color-gray); margin: var(--spacing-lg) 0;">
            Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <div style="display: flex; gap: var(--spacing-md); justify-content: center; flex-wrap: wrap;">
            <a href="<?php echo url('index.php'); ?>" class="btn btn-primary">
                Retour à l'accueil
            </a>
            <a href="<?php echo url('pages/contact.php'); ?>" class="btn btn-outline">
                Nous contacter
            </a>
        </div>
    </div>
</section>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>




