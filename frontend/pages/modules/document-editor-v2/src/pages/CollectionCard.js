// collection/CollectionCard.js
import BaseCard from '../../shared/ui/BaseCard.js';

export default class CollectionCard {
  constructor(collection, actions) {
    this.collection = collection;
    this.actions = actions;
  }

  render() {
    const card = new BaseCard();

    const title = document.createElement('h3');
    title.textContent = this.collection.name;
    card.setHeader(title);

    if (this.collection.description) {
      const p = document.createElement('p');
      p.textContent = this.collection.description;
      card.setBody(p);
    }

    const buttons = [];

    const edit = document.createElement('button');
    edit.textContent = '✏️';
    edit.onclick = () => this.actions.onEdit(this.collection);

    const del = document.createElement('button');
    del.textContent = '🗑️';
    del.onclick = () => this.actions.onDelete(this.collection);

    buttons.push(edit, del);
    card.setActions(buttons);

    return card.render();
  }
}
