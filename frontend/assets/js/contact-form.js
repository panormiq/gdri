/**
 * Gestion du formulaire de contact
 * Fichier : frontend/assets/js/contact-form.js
 */

(function() {
    'use strict';

    // Attendre que le DOM soit chargé
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        const contactForm = document.getElementById('contactForm');
        
        if (!contactForm) {
            return;
        }

        contactForm.addEventListener('submit', handleSubmit);
    }

    async function handleSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;

        // Désactiver le bouton pendant l'envoi
        submitButton.disabled = true;
        submitButton.textContent = 'Envoi en cours...';

        // Récupérer les données du formulaire
        const formData = {
            name: document.getElementById('contactName').value.trim(),
            email: document.getElementById('contactEmail').value.trim(),
            phone: document.getElementById('contactPhone').value.trim(),
            subject: document.getElementById('contactSubject').value,
            message: document.getElementById('contactMessage').value.trim()
        };

        // Validation côté client
        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            showMessage('Veuillez remplir tous les champs requis.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
            return;
        }

        // Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            showMessage('Veuillez entrer une adresse email valide.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
            return;
        }

        try {
            // Récupérer l'URL de l'API
            const apiBaseUrl = window.API_BASE_URL || 'http://localhost:3000/api';
            const response = await fetch(`${apiBaseUrl}/contact/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                showMessage(data.message || 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.', 'success');
                // Réinitialiser le formulaire
                form.reset();
            } else {
                showMessage(data.message || 'Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer plus tard.', 'error');
            }

        } catch (error) {
            console.error('Erreur envoi formulaire contact:', error);
            showMessage('Erreur de connexion au serveur. Veuillez vérifier votre connexion internet et réessayer.', 'error');
        } finally {
            // Réactiver le bouton
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }

    function showMessage(message, type) {
        // Supprimer les messages précédents
        const existingMessage = document.querySelector('.contact-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Créer le message
        const messageDiv = document.createElement('div');
        messageDiv.className = `contact-message ${type}`;
        messageDiv.textContent = message;

        // Styles pour le message
        messageDiv.style.cssText = `
            padding: 15px 20px;
            margin-bottom: 20px;
            border-radius: 5px;
            font-weight: 500;
            animation: slideDown 0.3s ease-out;
        `;

        if (type === 'success') {
            messageDiv.style.backgroundColor = '#d4edda';
            messageDiv.style.color = '#155724';
            messageDiv.style.border = '1px solid #c3e6cb';
        } else {
            messageDiv.style.backgroundColor = '#f8d7da';
            messageDiv.style.color = '#721c24';
            messageDiv.style.border = '1px solid #f5c6cb';
        }

        // Ajouter le message au début du formulaire
        const form = document.getElementById('contactForm');
        form.insertBefore(messageDiv, form.firstChild);

        // Faire défiler jusqu'au message
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Supprimer le message après 5 secondes (pour les succès)
        if (type === 'success') {
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.style.transition = 'opacity 0.3s';
                    messageDiv.style.opacity = '0';
                    setTimeout(() => {
                        if (messageDiv.parentNode) {
                            messageDiv.remove();
                        }
                    }, 300);
                }
            }, 5000);
        }
    }

})();


