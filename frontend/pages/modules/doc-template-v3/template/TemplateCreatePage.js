import Page from '../shared/components/page/Page.js';
import { templateApi } from '../shared/api/TemplateApi.js';
import { TEMPLATE_KINDS, DEFAULT_PROMPT_CONTENT, DEFAULT_PROMPT_COLLECTION, editorPath } from './templateKinds.js?v=tpl-loop-4';
import { emptyPromptConfig } from './promptPresets.js?v=tpl-loop-4';
import { canvasEditorUrl, canvasNamespaceForTemplate, templateIdOf } from '../app/canvasEditor.js';

export default class TemplateCreatePage extends Page {
  constructor(router, autoKind = null) {
    super(router);
    this.name = '';
    this.busy = false;
    this.autoKind = autoKind || null;
  }

  async render(container) {
    container.innerHTML = '';
    this.loadStyles();

    const wrap = document.createElement('div');
    wrap.className = 'template-create-page';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'template-create-back';
    back.textContent = '← Templates';
    back.onclick = () => this.navigate('/templates');
    wrap.appendChild(back);

    const title = document.createElement('h1');
    title.textContent = 'Nouveau template';
    wrap.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'template-create-hint';
    hint.textContent = 'Un template, plusieurs formats. Document visuel ou prompt IA réutilisable.';
    wrap.appendChild(hint);

    const nameLabel = document.createElement('label');
    nameLabel.className = 'template-create-name';
    nameLabel.textContent = 'Nom';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Ex. Facture, Dossier technique…';
    nameInput.value = this.name;
    nameInput.oninput = () => {
      this.name = nameInput.value;
    };
    nameLabel.appendChild(nameInput);
    wrap.appendChild(nameLabel);

    const grid = document.createElement('div');
    grid.className = 'template-create-grid';

    TEMPLATE_KINDS.forEach((kind) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'template-create-card';
      card.dataset.kind = kind.id;
      card.innerHTML = `<strong>${kind.label}</strong><span>${kind.description}</span>`;
      card.onclick = () => this.startKind(kind.id);
      grid.appendChild(card);
    });

    wrap.appendChild(grid);
    container.appendChild(wrap);
    nameInput.focus();
    if (this.autoKind) {
      this.startKind(this.autoKind);
    }
  }

  resolveName(kind) {
    const typed = String(this.name || '').trim();
    if (typed) return typed;
    const labels = { word: 'Document Word', canvas: 'Mise en page A4', html: 'Page HTML', prompt: 'Prompt IA' };
    return labels[kind] || 'Nouveau template';
  }

  async startKind(kind) {
    if (this.busy) return;
    this.busy = true;
    const name = this.resolveName(kind);
    try {
      if (kind === 'word') {
        sessionStorage.setItem('gdriNewTemplate', JSON.stringify({ name, kind: 'word' }));
        this.navigate('/templates/create/word');
        return;
      }
      const payload = { name, kind };
      if (kind === 'prompt') {
        payload.content = DEFAULT_PROMPT_CONTENT;
        payload.promptConfig = emptyPromptConfig();
        payload.defaultCollection = {
          alias: DEFAULT_PROMPT_COLLECTION.alias,
          fields: DEFAULT_PROMPT_COLLECTION.fields.slice()
        };
        payload.additionalCollections = [];
        payload.inputSources = [];
      }
      const created = await templateApi.create(payload);
      if (!created.success || !created.data) {
        throw new Error(created.error || 'Création impossible');
      }
      const template = created.data;
      if (kind === 'canvas') {
        window.location.href = canvasEditorUrl({
          template: canvasNamespaceForTemplate(template),
        });
        return;
      }
      this.navigate(editorPath(kind, templateIdOf(template)));
    } catch (err) {
      this.busy = false;
      alert(err.message || 'Erreur lors de la création');
    }
  }

  loadStyles() {
    if (document.getElementById('template-create-styles')) return;
    const link = document.createElement('link');
    link.id = 'template-create-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/template/TemplateCreatePage.css';
    document.head.appendChild(link);
  }
}
