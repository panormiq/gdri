// src/shared/components/listPage/ListPage.js
import Card from '../card/Card.js';
import FormAction from '../FormAction/FormAction.js';

export default class ListPage {
  constructor({ title, items = [], emptyText = 'Aucun élément', formAction, mapItemToCard }) {
    this.title = title;
    this.items = items; // maintenant fourni par la page
    this.emptyText = emptyText;
    this.formAction = formAction;
    this.mapItemToCard = mapItemToCard;
  }

  render(container) {
    container.innerHTML = '';

    const h1 = document.createElement('h1');
    h1.textContent = this.title;
    container.appendChild(h1);

    if (!this.items.length) {
      const p = document.createElement('p');
      p.textContent = this.emptyText;
      container.appendChild(p);
      return;
    }

    if (this.formAction) {
      const form = new FormAction({
        ...this.formAction,
        onInput: q => this.formAction.onInput(q),
      });
      form.render(container);
    }

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    container.appendChild(cardsContainer);

    this.items.forEach(item => {
      const cardConfig = this.mapItemToCard(item);
      const card = new Card(cardConfig);
      card.render(cardsContainer);
    });
  }
}
