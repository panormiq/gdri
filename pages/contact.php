<?php
/**
 * Page Contact - GDRI
 * Fichier : pages/contact.php
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';

$page_title = 'Contact';

require_once '../includes/header.php';
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Contactez-nous</h1>
            <p class="hero-description">
                Une question ? Un projet ? N'hésitez pas à nous écrire
            </p>
        </div>
    </div>
</section>

<!-- Section Contact -->
<section class="section">
    <div class="container">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-xl); align-items: start;">
            
            <!-- Formulaire de contact -->
            <div class="contact-form">
                <h2>Envoyez-nous un message</h2>
                
                <form id="contactForm" method="POST" action="#">
                    <div class="form-group">
                        <label for="contactName">Nom complet</label>
                        <input type="text" id="contactName" name="name" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="contactEmail">Email</label>
                        <input type="email" id="contactEmail" name="email" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="contactPhone">Téléphone (optionnel)</label>
                        <input type="tel" id="contactPhone" name="phone">
                    </div>
                    
                    <div class="form-group">
                        <label for="contactSubject">Sujet</label>
                        <select id="contactSubject" name="subject" required>
                            <option value="">Sélectionnez un sujet</option>
                            <option value="demande">Demande d'information</option>
                            <option value="devis">Demande de devis</option>
                            <option value="support">Support technique</option>
                            <option value="autre">Autre</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="contactMessage">Message</label>
                        <textarea id="contactMessage" name="message" rows="6" required></textarea>
                    </div>
                    
                    <button type="submit" class="btn btn-primary btn-full">Envoyer le message</button>
                </form>
            </div>
            
            <!-- Informations de contact -->
            <div class="contact-info">
                <h2>Nos coordonnées</h2>
                
                <div class="info-card">
                    <div class="info-icon">🏢</div>
                    <div class="info-content">
                        <h3>GDR-Innovation</h3>
                        <p>Simplifiez-vous la vie</p>
                    </div>
                </div>
                
                <div class="info-card">
                    <div class="info-icon">📍</div>
                    <div class="info-content">
                        <h3>Adresse</h3>
                        <p>921 impasse de la grange de rideaux</p>
                    </div>
                </div>
                
                <div class="info-card">
                    <div class="info-icon">📧</div>
                    <div class="info-content">
                        <h3>Email</h3>
                        <p>
                            <a href="mailto:contact@gdr-innovation.fr">contact@gdr-innovation.fr</a>
                        </p>
                    </div>
                </div>
                
                <div class="info-card">
                    <div class="info-icon">📱</div>
                    <div class="info-content">
                        <h3>Téléphone</h3>
                        <p>
                            <a href="tel:0684286347">06 84 28 63 47</a>
                        </p>
                    </div>
                </div>
                
                <div class="info-card">
                    <div class="info-icon">📋</div>
                    <div class="info-content">
                        <h3>SIRET</h3>
                        <p>800944 407</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<?php require_once '../includes/footer.php'; ?>

