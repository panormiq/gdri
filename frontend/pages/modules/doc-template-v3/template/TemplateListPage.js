// src/modules/editor/template/TemplateListPage.js
import Page from '../shared/components/page/Page.js';
import ListPage from '../shared/components/listPage/ListPage.js';
import { templateApi } from '../shared/api/TemplateApi.js';

export default class TemplateListPage extends Page {
  constructor(router) {
    super(router);
    this.items = [];
  }

  async render(container) {
    container.innerHTML = '';

    // Charger les templates
    const res = await templateApi.getAll();
    this.items = res.success ? res.data : [];

    const listPage = new ListPage({
      title: 'Templates',
      items: this.items,
      emptyText: 'Aucun template disponible',
      formAction: {
        placeholder: 'Rechercher...',
        buttonText: 'Créer un template',
        onButtonClick: () => this.createTemplate(),
        onInput: q => this.filter(q),
      },
      mapItemToCard: template => ({
        title: template.name || 'Sans nom',
        subtitle: template.defaultCollection 
          ? `Collection: ${template.defaultCollection.alias || 'Non définie'}` 
          : 'Aucune collection associée',
        onClick: () => this.editTemplate(template._id),
        actions: [
          {
            label: 'Éditer',
            onClick: (e) => {
              e.stopPropagation();
              this.editTemplate(template._id);
            },
          },
          {
            label: 'Supprimer',
            onClick: async () => this.deleteTemplate(template),
          },
        ],
      }),
    });

    listPage.render(container);
  }

  createTemplate() {
    this.navigate('/templates/create');
  }

  editTemplate(templateId) {
    this.navigate(`/templates/edit/${templateId}`);
  }

  async deleteTemplate(template) {
    if (!confirm(`Supprimer le template "${template.name}" ?`)) return;
    
    const res = await templateApi.delete(template._id);
    if (res.success) {
      this.items = this.items.filter(t => t._id !== template._id);
      // Re-render la liste
      await this.render(this.router.outlet);
    } else {
      alert(res.error || 'Erreur lors de la suppression');
    }
  }

  filter(query) {
    const q = query.toLowerCase();
    const filtered = this.items.filter(template =>
      (template.name || '').toLowerCase().includes(q)
    );

    const listPage = new ListPage({
      title: 'Templates',
      items: filtered,
      emptyText: 'Aucun template disponible',
      formAction: {
        placeholder: 'Rechercher...',
        buttonText: 'Créer un template',
        onButtonClick: () => this.createTemplate(),
        onInput: q => this.filter(q),
      },
      mapItemToCard: template => ({
        title: template.name || 'Sans nom',
        subtitle: template.defaultCollection 
          ? `Collection: ${template.defaultCollection.alias || 'Non définie'}` 
          : 'Aucune collection associée',
        onClick: () => this.editTemplate(template._id),
        actions: [
          {
            label: 'Éditer',
            onClick: (e) => {
              e.stopPropagation();
              this.editTemplate(template._id);
            },
          },
          {
            label: 'Supprimer',
            onClick: async () => this.deleteTemplate(template),
          },
        ],
      }),
    });

    listPage.render(this.router.outlet);
  }
}

