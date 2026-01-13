// src/modules/shared/components/listPage/ListPage.js
// ⚡ Charger le CSS pour ListPage sans bundler
(function loadCSS() {
  if (!document.getElementById('listpage-styles')) {
    const link = document.createElement('link');
    link.id = 'listpage-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/shared/components/ListPage/ListPage.css';
    document.head.appendChild(link);
  }
})();
export default class ListPage {
  constructor({ title = '', items = [], emptyText = 'Aucune donnée', mapItemToCard = null, formAction = null }) {
    this.title = title;
    this.items = items;
    this.emptyText = emptyText;
    this.mapItemToCard = mapItemToCard;
    this.formAction = formAction;
    this.container = null;
  }

  render(container) {
    this.container = container;

    // ⚠️ Réinitialiser le container passé
    container.innerHTML = '';

    // --- Container principal ---
    const mainDiv = document.createElement('div');
    mainDiv.className = 'listpage-container';
    container.appendChild(mainDiv);

    // --- Titre ---
    if (this.title) {
      const h1 = document.createElement('h1');
      h1.textContent = this.title;
      mainDiv.appendChild(h1);
    }

    // --- Formulaire / actions ---
    if (this.formAction) {
      const formContainer = document.createElement('div');
      formContainer.className = 'listpage-form';

      if (this.formAction.placeholder) {
        const input = document.createElement('input');
        input.placeholder = this.formAction.placeholder;
        input.oninput = e => this.formAction.onInput && this.formAction.onInput(e.target.value);
        formContainer.appendChild(input);
      }

      if (this.formAction.buttonText) {
        const btn = document.createElement('button');
        btn.textContent = this.formAction.buttonText;
        btn.onclick = () => this.formAction.onButtonClick && this.formAction.onButtonClick();
        formContainer.appendChild(btn);
      }

      mainDiv.appendChild(formContainer);
    }

    // --- Liste des items ---
    if (!this.items || this.items.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'listpage-empty';
      emptyDiv.textContent = this.emptyText;
      mainDiv.appendChild(emptyDiv);
      return;
    }

    // --- Grille des cartes ---
    const grid = document.createElement('div');
    grid.className = 'listpage-grid';
    mainDiv.appendChild(grid);

    this.items.forEach(item => {
      const cardData = this.mapItemToCard ? this.mapItemToCard(item) : { title: item.name };

      const card = document.createElement('div');
      card.className = 'listpage-card';

      // ⚡ Gestion du clic sur la carte
      if (cardData.onClick) {
        card.onclick = cardData.onClick;
      }

      // Titre
      const cardTitle = document.createElement('strong');
      cardTitle.textContent = cardData.title || '';
      card.appendChild(cardTitle);

      // Subtitle
      if (cardData.subtitle) {
        const sub = document.createElement('div');
        sub.textContent = cardData.subtitle;
        card.appendChild(sub);
      }

      // Content
      if (cardData.content) {
        const contentDiv = document.createElement('pre');
        contentDiv.textContent = cardData.content;
        card.appendChild(contentDiv);
      }

      // Actions
      if (cardData.actions) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'listpage-card-actions';
        cardData.actions.forEach(a => {
          const btn = document.createElement('button');
          btn.textContent = a.label;
          btn.onclick = a.onClick;
          actionsDiv.appendChild(btn);
        });
        card.appendChild(actionsDiv);
      }

      grid.appendChild(card);
    });
  }
}
