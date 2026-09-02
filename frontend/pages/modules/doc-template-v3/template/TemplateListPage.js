import Page from '../shared/components/page/Page.js';
import ListPage from '../shared/components/listPage/ListPage.js';
import { templateApi } from '../shared/api/TemplateApi.js';
import { canvasEditorUrl, canvasNamespaceForTemplate, templateIdOf } from '../app/canvasEditor.js';
import { kindLabel, normalizeTemplateKind, editorPath } from './templateKinds.js?v=tpl-kind-3';

export default class TemplateListPage extends Page {
  constructor(router) {
    super(router);
    this.items = [];
  }

  async render(container) {
    container.innerHTML = '';
    const res = await templateApi.getAll();
    this.items = res.success ? res.data : [];
    this.renderList(container, this.items);
  }

  openEditor(template) {
    const id = templateIdOf(template);
    const kind = normalizeTemplateKind(template);
    if (kind === 'canvas') {
      window.location.href = canvasEditorUrl({
        template: canvasNamespaceForTemplate(template),
      });
      return;
    }
    this.navigate(editorPath(kind, id));
  }

  cardOf(template) {
    const kind = normalizeTemplateKind(template);
    const collection = template.defaultCollection
      ? ` · Collection: ${template.defaultCollection.alias || 'Non définie'}`
      : '';
    return {
      title: template.name || 'Sans nom',
      subtitle: `${kindLabel(kind)}${collection}`,
      onClick: () => this.openEditor(template),
      actions: [
        {
          label: 'Éditer',
          onClick: (e) => {
            e.stopPropagation();
            this.openEditor(template);
          },
        },
        {
          label: 'Supprimer',
          onClick: async (e) => {
            e.stopPropagation();
            await this.deleteTemplate(template);
          },
        },
      ],
    };
  }

  renderList(container, items) {
    const listPage = new ListPage({
      title: 'Templates',
      items,
      emptyText: 'Aucun template. Créez-en un : Word, Canvas A4, HTML ou Prompt IA.',
      formAction: {
        placeholder: 'Rechercher...',
        buttonText: 'Créer un template',
        onButtonClick: () => this.createTemplate(),
        onInput: q => this.filter(q),
      },
      mapItemToCard: template => this.cardOf(template),
    });
    listPage.render(container);
  }

  createTemplate() {
    this.navigate('/templates/create');
  }

  async deleteTemplate(template) {
    if (!confirm(`Supprimer le template "${template.name}" ?`)) return;
    const res = await templateApi.delete(template._id);
    if (res.success) {
      this.items = this.items.filter(t => t._id !== template._id);
      await this.render(this.router.outlet);
    } else {
      alert(res.error || 'Erreur lors de la suppression');
    }
  }

  filter(query) {
    const q = query.toLowerCase();
    const filtered = this.items.filter(template =>
      (template.name || '').toLowerCase().includes(q)
      || kindLabel(normalizeTemplateKind(template)).toLowerCase().includes(q)
    );
    this.renderList(this.router.outlet, filtered);
  }
}
