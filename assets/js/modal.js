/**
 * Gestion du modal de login
 * Fichier : assets/js/modal.js
 * 
 * Fonctions :
 * - openModal() : Ouvre le modal de connexion
 * - closeModal() : Ferme le modal de connexion
 * - initModal() : Initialise les événements du modal
 */

/**
 * Ouvre le modal de connexion
 */
function openModal() {
    const modalOverlay = document.getElementById('loginModal');
    if (modalOverlay) {
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Empêche le scroll
    }
}

/**
 * Ferme le modal de connexion
 */
function closeModal() {
    const modalOverlay = document.getElementById('loginModal');
    if (modalOverlay) {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = ''; // Réactive le scroll
        
        // Réinitialise le formulaire
        const form = document.getElementById('loginForm');
        if (form) {
            form.reset();
        }
        
        // Cache les messages d'erreur
        const errorMessage = document.querySelector('.form-error');
        if (errorMessage) {
            errorMessage.classList.remove('active');
        }
    }
}

/**
 * Initialise les événements du modal
 */
function initModal() {
    // Bouton pour ouvrir le modal
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', openModal);
    }

    // Bouton pour fermer le modal
    const closeBtn = document.getElementById('closeModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Fermer en cliquant sur l'overlay
    const modalOverlay = document.getElementById('loginModal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }

    // Fermer avec la touche Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}



