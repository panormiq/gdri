<?php
/**
 * Page Nos Agents IA - GDRI
 * Fichier : pages/agents.php
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';

$page_title = 'Nos Agents IA';

require_once '../includes/header.php';
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Nos Agents IA</h1>
            <p class="hero-description">
                Découvrez nos 4 agents intelligents conçus pour automatiser vos processus métier
            </p>
        </div>
    </div>
</section>

<!-- Section Agents -->
<section class="section">
    <div class="container">
        <div class="section-title">
            <h2>Nos Solutions Intelligentes</h2>
            <p>Des agents IA spécialisés pour répondre à vos besoins</p>
        </div>
        
        <div class="cards-grid">
            <!-- Agent Analyse d'intention -->
            <div class="card card-large">
                <div class="card-icon">🎯</div>
                <h3 class="card-title">Agent Analyse d'intention</h3>
                <p class="card-description">
                    Caractérise un message ou un texte afin de pouvoir le classer ou faire différentes actions sur mesure
                </p>
                <div class="card-features">
                    <ul>
                        <li>✅ Analyse contextuelle avancée</li>
                        <li>✅ Classification automatique</li>
                        <li>✅ Actions personnalisées</li>
                        <li>✅ Prise en charge multilingue</li>
                    </ul>
                </div>
            </div>
            
            <!-- Agent Mail -->
            <div class="card card-large">
                <div class="card-icon">✉️</div>
                <h3 class="card-title">Agent Mail</h3>
                <p class="card-description">
                    Transfère le mail au bon service et prépare une réponse selon l'analyse d'intention
                </p>
                <div class="card-features">
                    <ul>
                        <li>✅ Routage intelligent</li>
                        <li>✅ Réponses pré-formulées</li>
                        <li>✅ Analyse des priorités</li>
                        <li>✅ Intégration multi-boîtes</li>
                    </ul>
                </div>
            </div>
            
            <!-- Agent Documentaire Dossier technique -->
            <div class="card card-large">
                <div class="card-icon">📄</div>
                <h3 class="card-title">Agent Documentaire</h3>
                <p class="card-description">
                    Transforme un document Word en modèle technique pour simplifier les rédactions futures
                </p>
                <div class="card-features">
                    <ul>
                        <li>✅ Extraction de structure</li>
                        <li>✅ Création de modèles</li>
                        <li>✅ Format Word préservé</li>
                        <li>✅ Réutilisation facilitée</li>
                    </ul>
                </div>
            </div>
            
            <!-- Agent Facebook -->
            <div class="card card-large">
                <div class="card-icon">📱</div>
                <h3 class="card-title">Agent Facebook</h3>
                <p class="card-description">
                    Récupère et analyse les notifications Facebook pour envoyer des alertes mail si nécessaire
                </p>
                <div class="card-features">
                    <ul>
                        <li>✅ Monitoring automatique</li>
                        <li>✅ Détection d'urgence</li>
                        <li>✅ Alertes email</li>
                        <li>✅ Gestion multi-comptes</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Section Contact -->
<section class="section section-alt">
    <div class="container">
        <div class="section-title">
            <h2>Intéressé par nos agents ?</h2>
            <p>Contactez-nous pour discuter de vos besoins</p>
        </div>
        
        <div style="text-align: center;">
            <a href="<?php echo url('pages/contact.php'); ?>" class="btn btn-primary btn-large">
                Nous contacter
            </a>
        </div>
    </div>
</section>

<?php require_once '../includes/footer.php'; ?>

