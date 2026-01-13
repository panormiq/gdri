// src/modules/editor/shared/components/FormSearch/FormSearch.js
export default class FormSearch {
  constructor({ placeholder = 'Rechercher...', buttonLabel = 'Rechercher', onSubmit }) {
    this.placeholder = placeholder;
    this.buttonLabel = buttonLabel;
    this.onSubmit = onSubmit;
    
    this.element = document.createElement('form');
    this.element.className = 'form-search';
    
    // input texte
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = this.placeholder;
    this.element.appendChild(this.input);

    // bouton submit
    this.button = document.createElement('button');
    this.button.type = 'submit';
    this.button.textContent = this.buttonLabel;
    this.element.appendChild(this.button);

    // bind submit
    this.element.addEventListener('submit', e => {
      e.preventDefault();
      if (typeof this.onSubmit === 'function') {
        this.onSubmit(this.input.value);
      }
    });
  }

  render(parent) {
    parent.appendChild(this.element);
  }

  // possibilité de reset le champ
  reset() {
    this.input.value = '';
  }
}
