/**
 * Gestion de la navigation responsive
 * Fichier : assets/js/navigation.js
 * 
 * Fonctions :
 * - toggleMobileMenu() : Bascule l'affichage du menu mobile
 * - closeMobileMenu() : Ferme le menu mobile
 * - handleScroll() : Gère l'effet du header au scroll
 * - initNavigation() : Initialise la navigation
 */

/**
 * Bascule l'affichage du menu mobile
 */
function toggleMobileMenu() {
    const nav = document.querySelector('.nav');
    const menuToggle = document.querySelector('.menu-toggle');
    
    if (nav && menuToggle) {
        nav.classList.toggle('active');
        menuToggle.classList.toggle('active');
    }
}

/**
 * Ferme le menu mobile
 */
function closeMobileMenu() {
    const nav = document.querySelector('.nav');
    const menuToggle = document.querySelector('.menu-toggle');
    
    if (nav && menuToggle) {
        nav.classList.remove('active');
        menuToggle.classList.remove('active');
    }
}

/**
 * Gère l'effet du header au scroll
 */
function handleScroll() {
    const header = document.querySelector('.header');
    
    if (header) {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
}

/**
 * Marque le lien actif dans la navigation
 */
function setActiveLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && currentPath.includes(href)) {
            link.classList.add('active');
        }
    });
}

/**
 * Initialise la navigation
 */
function initNavigation() {
    // Menu toggle pour mobile
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }

    // Fermer le menu en cliquant sur un lien
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    // Effet scroll sur le header
    window.addEventListener('scroll', handleScroll);

    // Marquer le lien actif
    setActiveLink();

    // Smooth scroll pour les ancres
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}



