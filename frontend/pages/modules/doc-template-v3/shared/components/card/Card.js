export default class Card {
  constructor(data = {}) {
    this.data = data;

    // Créer l'élément racine
    this.element = document.createElement('div');
    this.element.className = 'card';

    // Contenu du card
    if (data.title) {
      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = data.title;
      this.element.appendChild(title);
    }

    if (data.subtitle) {
      const subtitle = document.createElement('div');
      subtitle.className = 'card-subtitle';
      subtitle.textContent = data.subtitle;
      this.element.appendChild(subtitle);
    }

    if (data.content) {
      const content = document.createElement('pre'); // JSON ou texte
      content.className = 'card-content';
      content.textContent = data.content;
      this.element.appendChild(content);
    }

    // Actions (Modifier / Supprimer)
    if (data.actions && data.actions.length) {
      const actions = document.createElement('div');
      actions.className = 'card-actions';

      data.actions.forEach(a => {
        const btn = document.createElement('button');
        btn.textContent = a.label;
        btn.onclick = a.onClick;
        actions.appendChild(btn);
      });

      this.element.appendChild(actions);
    }

    // Charger le CSS si pas déjà présent
    if (!document.getElementById('card-css')) {
      const link = document.createElement('link');
      link.id = 'card-css';
      link.rel = 'stylesheet';
      const baseUrl = window.BASE_URL || '/';
      link.href = baseUrl + 'pages/modules/doc-template-v3/shared/components/card/Card.css';
      document.head.appendChild(link);
    }
  }

  // Méthode pour attacher le card à un parent
  render(parent) {
    if (!parent) {
      console.error('Card.render: parent est undefined !', this);
      return;
    }
    parent.appendChild(this.element);
  }

  // Optionnel : ajouter un callback au click
  onClick(callback) {
    this.element.addEventListener('click', callback);
  }
}
