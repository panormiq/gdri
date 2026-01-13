// src/modules/editor/collections/CreatePage.js
import Page from '../shared/components/page/Page.js';
import ListPage from '../shared/components/listPage/ListPage.js';
import Card from '../shared/components/card/Card.js';
import FormAction from '../shared/components/FormAction/FormAction.js';
import CollectionCreatePage from './CollectionCreatePage.js';
import schema from './collectionSchema.json';

export default class CreatePage extends Page {
  constructor(router) {
    super(router);
    this.collectionLogic = new CollectionCreatePage();
    this.coreInputs = {}; // Inputs DOM pour coreFields
  }

  render(container) {
    container.innerHTML = '';

    // 1️⃣ Titre
    const h1 = document.createElement('h1');
    h1.textContent = 'Créer une collection';
    container.appendChild(h1);

    // 2️⃣ CoreFields
    const coreContainer = document.createElement('div');
    container.appendChild(coreContainer);
    this.renderCoreFields(coreContainer);

    // 3️⃣ Bouton ajouter un champ
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Ajouter un champ';
    addBtn.addEventListener('click', () => this.addFieldPrompt());
    container.appendChild(addBtn);

    // 4️⃣ Liste des champs ajoutés
    const fieldsContainer = document.createElement('div');
    container.appendChild(fieldsContainer);
    this.fieldsContainer = fieldsContainer;
    this.renderFields();

    // 5️⃣ Bouton soumettre
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Créer';
    submitBtn.addEventListener('click', async () => {
      const coreValues = {};
      Object.entries(this.coreInputs).forEach(([key, input]) => {
        const field = schema.coreFields[key];
        coreValues[key] = field.type === 'boolean' ? input.checked : input.value;
      });

      const res = await this.collectionLogic.submit(coreValues);
      if (res.success) this.navigate('/collections');
      else alert('Erreur lors de la création');
    });
    container.appendChild(submitBtn);
  }

  renderCoreFields(container) {
    container.innerHTML = '';
    Object.entries(schema.coreFields).forEach(([key, field]) => {
      const wrapper = document.createElement('div');
      const label = document.createElement('label');
      label.textContent = field.label;
      wrapper.appendChild(label);

      let input;
      if (field.type === 'boolean') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = field.defaultValue;
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = field.defaultValue;
      }
      wrapper.appendChild(input);
      container.appendChild(wrapper);
      this.coreInputs[key] = input;
    });
  }

  addFieldPrompt() {
    // TODO: remplacer par un mini-form dynamique plus tard
    const typeNames = Object.keys(schema.types);
    const type = prompt('Type de champ : ' + typeNames.join(', '));
    if (!schema.types[type]) return alert('Type inconnu');

    const name = prompt('Nom technique du champ :');
    const label = prompt('Libellé du champ :');

    this.collectionLogic.addField({ name, type, label });
    this.renderFields();
  }

  renderFields() {
    new ListPage({
      title: 'Champs ajoutés',
      items: this.collectionLogic.fields,
      emptyText: 'Aucun champ ajouté',
      mapItemToCard: (field) => ({
        title: field.label,
        subtitle: field.type,
        actions: [
          { label: 'Éditer', onClick: () => this.editFieldPrompt(field.position) },
          { label: 'Supprimer', onClick: () => { 
              this.collectionLogic.deleteField(field.position); 
              this.renderFields(); 
            } 
          }
        ]
      })
    }).render(this.fieldsContainer);
  }

  editFieldPrompt(position) {
    const field = this.collectionLogic.fields.find(f => f.position === position);
    if (!field) return;

    const newLabel = prompt('Libellé', field.label);
    if (newLabel) field.label = newLabel;

    this.renderFields();
  }
}
