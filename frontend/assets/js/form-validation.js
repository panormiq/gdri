/**
 * Validation des formulaires
 * Fichier : assets/js/form-validation.js
 * 
 * Fonctions :
 * - validateEmail() : Valide un email
 * - validatePassword() : Valide un mot de passe
 * - showError() : Affiche un message d'erreur
 * - hideError() : Cache le message d'erreur
 * - handleLoginSubmit() : Gère la soumission du formulaire de login
 */

/**
 * Valide un email
 * @param {string} email - L'email à valider
 * @returns {boolean} - True si valide, false sinon
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Valide un mot de passe
 * @param {string} password - Le mot de passe à valider
 * @returns {boolean} - True si valide, false sinon
 */
function validatePassword(password) {
    // Minimum 6 caractères pour l'instant
    return password.length >= 6;
}

/**
 * Affiche un message d'erreur
 * @param {string} message - Le message à afficher
 */
function showError(message) {
    const errorElement = document.querySelector('.form-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('active');
    }
}

/**
 * Cache le message d'erreur
 */
function hideError() {
    const errorElement = document.querySelector('.form-error');
    if (errorElement) {
        errorElement.classList.remove('active');
    }
}

/**
 * Affiche un message de succès
 * @param {string} message - Le message à afficher
 */
function showSuccess(message) {
    const successElement = document.querySelector('.form-success');
    if (successElement) {
        successElement.textContent = message;
        successElement.classList.add('active');
    }
}

/**
 * Gère la soumission du formulaire de login
 * @param {Event} e - L'événement de soumission
 */
async function handleLoginSubmit(e) {
    e.preventDefault();
    hideError();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Validation
    if (!email || !password) {
        showError('Veuillez remplir tous les champs');
        return;
    }

    if (!validateEmail(email)) {
        showError('Veuillez entrer une adresse email valide');
        return;
    }

    if (!validatePassword(password)) {
        showError('Le mot de passe doit contenir au moins 6 caractères');
        return;
    }

    // Afficher l'état de chargement
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        // Envoi de la requête au backend
        const baseUrl = window.BASE_URL || '/';
        const response = await fetch(`${baseUrl}auth/login-process.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Connexion réussie ! Redirection...');
            setTimeout(() => {
                const redirectUrl = data.redirect ? `${baseUrl}${data.redirect.replace(/^\//, '')}` : `${baseUrl}pages/dashboard.php`;
                window.location.href = redirectUrl;
            }, 1000);
        } else {
            showError(data.message || 'Erreur de connexion');
        }
    } catch (error) {
        showError('Erreur de connexion au serveur');
        console.error('Erreur:', error);
    } finally {
        // Retirer l'état de chargement
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

/**
 * Initialise la validation du formulaire de login
 */
function initFormValidation() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
}


