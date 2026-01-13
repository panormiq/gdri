// src/modules/editor/shared/components/FormAction/FormAction.js
export default class FormAction {
  constructor({ placeholder = '', buttonText = 'Valider', onInput, onButtonClick }) {
    this.placeholder = placeholder;
    this.buttonText = buttonText;
    this.onInput = onInput;
    this.onButtonClick = onButtonClick;

    this.element = document.createElement('div');
    this.element.className = 'form-action';

    // input texte
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = this.placeholder;
    this.element.appendChild(this.input);

    // écoute input live
    this.input.addEventListener('input', () => {
      if (typeof this.onInput === 'function') this.onInput(this.input.value);
    });

    // bouton
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.textContent = this.buttonText;
    this.element.appendChild(this.button);

    // écoute clic
    this.button.addEventListener('click', () => {
      if (typeof this.onButtonClick === 'function') {
        this.onButtonClick(this.input.value);
      }
    });
  }

  render(parent) {
    parent.appendChild(this.element);
  }

  reset() {
    this.input.value = '';
  }
}
