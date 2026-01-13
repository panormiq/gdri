export default class HomePage {
  constructor(router) {
    this.router = router;
  }

  async render(container) {
    container.innerHTML = '';

    // Charger le CSS de la page
    this.loadStyles();

    // Créer le conteneur principal
    const homeContainer = document.createElement('div');
    homeContainer.className = 'home-page-container';

    // Titre
    const title = document.createElement('h1');
    title.textContent = 'Bienvenue';
    homeContainer.appendChild(title);

    // Grille pour les cartes
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'home-cards-grid';

    // Créer les 3 cartes via PHP (on va utiliser fetch pour charger le HTML)
    const cards = [
      {
        title: 'Templates',
        description: 'Gérez vos modèles de documents et créez des templates personnalisés',
        icon: 'template',
        link: '/templates',
        linkTitle: 'Gérer les templates'
      },
      {
        title: 'Documents',
        description: 'Créez et gérez vos documents à partir de vos templates',
        icon: 'document',
        link: '/documents',
        linkTitle: 'Gérer les documents'
      },
      {
        title: 'Collections',
        description: 'Créez et gérez vos collections de données dynamiques',
        icon: 'collection',
        link: '/collections',
        linkTitle: 'Gérer les collections'
      }
    ];

    // Créer les cartes en JavaScript (style similaire au composant PHP)
    cards.forEach(cardData => {
      const card = this.createCard(cardData);
      cardsGrid.appendChild(card);
    });

    homeContainer.appendChild(cardsGrid);
    container.appendChild(homeContainer);
  }

  createCard(data) {
    const card = document.createElement('div');
    card.className = 'card_general';

    // Icône
    const iconLibrary = {
      template: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-cog-icon lucide-file-cog"><path d="M13.85 22H18a2 2 0 0 0 2-2V8a2 2 0 0 0-.586-1.414l-4-4A2 2 0 0 0 14 2H6a2 2 0 0 0-2 2v6.6"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m3.305 19.53.923-.382"/><path d="m4.228 16.852-.924-.383"/><path d="m5.852 15.228-.383-.923"/><path d="m5.852 20.772-.383.924"/><path d="m8.148 15.228.383-.923"/><path d="m8.53 21.696-.382-.924"/><path d="m9.773 16.852.922-.383"/><path d="m9.773 19.148.922.383"/><circle cx="7" cy="18" r="3"/></svg>',
      document: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-pen-icon lucide-file-pen"><path d="M12.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v9.34"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10.378 12.622a1 1 0 0 1 3 3.003L8.36 20.637a2 2 0 0 1-.854.506l-2.867.837a.5.5 0 0 1-.62-.62l.836-2.869a2 2 0 0 1 .506-.853z"/></svg>',
      collection: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-braces-corner-icon lucide-file-braces-corner"><path d="M14 22h4a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v6"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M5 14a1 1 0 0 0-1 1v2a1 1 0 0 1-1 1 1 1 0 0 1 1 1v2a1 1 0 0 0 1 1"/><path d="M9 22a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-2a1 1 0 0 0-1-1"/></svg>'
    };

    const iconDiv = document.createElement('div');
    iconDiv.className = 'card-icon';
    iconDiv.innerHTML = iconLibrary[data.icon] || '';
    card.appendChild(iconDiv);

    // Body
    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = data.title;
    body.appendChild(title);

    const description = document.createElement('p');
    description.className = 'card-description';
    description.textContent = data.description;
    body.appendChild(description);

    // Bouton
    const button = document.createElement('a');
    button.href = '#';
    button.className = 'buton card link';
    button.textContent = data.linkTitle;

    // Navigation au clic
    button.addEventListener('click', (e) => {
      e.preventDefault();
      this.router.navigate(data.link);
    });

    body.appendChild(button);
    card.appendChild(body);

    return card;
  }

  loadStyles() {
    // Charger le CSS de HomePage
    if (!document.getElementById('homepage-styles')) {
      const link = document.createElement('link');
      link.id = 'homepage-styles';
      link.rel = 'stylesheet';
      // Chemin relatif depuis la racine du module doc-template-v3
      // Utiliser window.BASE_URL si disponible, sinon chemin relatif
      const baseUrl = window.BASE_URL || '/';
      link.href = baseUrl + 'pages/modules/doc-template-v3/pages/HomePage.css';
      document.head.appendChild(link);
      console.log('📦 CSS HomePage chargé:', link.href);
    }
  }
}

