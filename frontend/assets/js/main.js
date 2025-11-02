/**
 * Fichier principal JavaScript - GDRI
 * Fichier : assets/js/main.js
 * 
 * Initialise tous les modules de l'application
 */

/**
 * Initialisation au chargement du DOM
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('GDRI - Site initialisé');

    // Initialiser la navigation
    if (typeof initNavigation === 'function') {
        initNavigation();
    }

    // Initialiser le modal
    if (typeof initModal === 'function') {
        initModal();
    }

    // Initialiser la validation des formulaires
    if (typeof initFormValidation === 'function') {
        initFormValidation();
    }

    // Animation d'apparition au scroll
    initScrollAnimations();
});

/**
 * Animations au scroll
 */
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1
    });

    // Observer les éléments avec animation
    document.querySelectorAll('.card, .section').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}



