<?php
/**
 * Page d'accueil - GDRI
 * Fichier : index.php
 */

require_once 'config/config.php';
require_once 'auth/session.php';
require_once 'includes/functions.php';

$page_title = 'Accueil';

require_once 'includes/header.php';
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Simplifiez-vous la vie</h1>
            <p class="hero-description">
                Découvrez nos solutions intelligentes avec nos agents IA qui automatisent vos tâches quotidiennes
            </p>
            <div class="hero-actions">
                <a href="<?php echo url('pages/agents.php'); ?>" class="btn btn-primary">Découvrir nos agents</a>
                <a href="<?php echo url('pages/contact.php'); ?>" class="btn btn-secondary">Nous contacter</a>
            </div>
        </div>
    </div>
</section>

<!-- Section Expertise -->
<section class="section">
    <div class="container">
        <div class="section-title">
            <h2>Notre Expertise</h2>
            <p>Des solutions IA sur mesure pour votre entreprise</p>
        </div>
        
        <div class="cards-grid">
            <div class="card">
                <div class="card-icon">🎯</div>
                <h3 class="card-title">Intelligence Artificielle</h3>
                <p class="card-description">
                    Des agents intelligents capables d'analyser, comprendre et agir sur vos données
                </p>
            </div>
            
            <div class="card">
                <div class="card-icon">⚡</div>
                <h3 class="card-title">Automatisation</h3>
                <p class="card-description">
                    Simplifiez vos processus métier grâce à l'automatisation intelligente
                </p>
            </div>
            
            <div class="card">
                <div class="card-icon">🔐</div>
                <h3 class="card-title">Sécurité & Confidentialité</h3>
                <p class="card-description">
                    Vos données sont traitées en toute sécurité et confidentialité
                </p>
            </div>
        </div>
    </div>
</section>

<!-- Section Pourquoi nous choisir -->
<section class="section section-alt">
    <div class="container">
        <div class="section-title">
            <h2>Pourquoi nous choisir</h2>
            <p>Des avantages concrets pour votre entreprise</p>
        </div>
        
        <div class="cards-grid">
            <div class="card">
                <div class="card-icon">🚀</div>
                <h3 class="card-title">Rapidité</h3>
                <p class="card-description">
                    Mise en place rapide et résultats immédiats
                </p>
            </div>
            
            <div class="card">
                <div class="card-icon">💰</div>
                <h3 class="card-title">Rentabilité</h3>
                <p class="card-description">
                    Réduction des coûts opérationnels grâce à l'automatisation
                </p>
            </div>
            
            <div class="card">
                <div class="card-icon">🤝</div>
                <h3 class="card-title">Accompagnement</h3>
                <p class="card-description">
                    Support dédié et formation personnalisée
                </p>
            </div>
        </div>
    </div>
</section>

<!-- Section CTA -->
<section class="section">
    <div class="container">
        <div class="cta-box">
            <h2>Prêt à transformer votre entreprise ?</h2>
            <p>Découvrez nos agents IA et leurs capacités</p>
            <a href="<?php echo url('pages/agents.php'); ?>" class="btn btn-primary btn-large">
                Voir nos agents
            </a>
        </div>
    </div>
</section>

<?php require_once 'includes/footer.php'; ?>

