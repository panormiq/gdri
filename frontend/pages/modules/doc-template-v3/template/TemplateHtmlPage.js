import Page from '../shared/components/page/Page.js';
import { templateApi } from '../shared/api/TemplateApi.js';
import { kindLabel } from './templateKinds.js?v=tpl-kind-3';

export default class TemplateHtmlPage extends Page {
  constructor(router, templateId) {
    super(router);
    this.templateId = templateId;
    this.template = null;
  }

  async render(container) {
    container.innerHTML = '';
    const res = await templateApi.getById(this.templateId);
    if (!res.success || !res.data) {
      container.innerHTML = '<p style="padding:2rem;text-align:center;">Template introuvable.</p>';
      return;
    }
    this.template = res.data;

    const wrap = document.createElement('div');
    wrap.style.maxWidth = '960px';
    wrap.style.margin = '0 auto';
    wrap.style.padding = 'var(--spacing-md)';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.gap = '0.5rem';
    header.style.alignItems = 'center';
    header.style.marginBottom = '1rem';

    header.style.flexWrap = 'wrap';

    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = '← Templates';
    back.onclick = () => this.navigate('/templates');

    const badge = document.createElement('span');
    badge.textContent = kindLabel('html');
    badge.style.cssText = 'padding:0.2rem 0.6rem;border-radius:999px;background:#fef3c7;color:#92400e;font-size:0.8rem;font-weight:600;';

    const title = document.createElement('input');
    title.type = 'text';
    title.value = this.template.name || 'Page HTML';
    title.style.flex = '1';
    title.oninput = () => {
      this.template.name = title.value;
    };

    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Enregistrer';
    save.onclick = () => this.save();

    header.appendChild(back);
    header.appendChild(badge);
    header.appendChild(title);
    header.appendChild(save);

    const area = document.createElement('textarea');
    area.value = this.template.content || '<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"></head>\n<body>\n\n</body>\n</html>\n';
    area.style.width = '100%';
    area.style.minHeight = '60vh';
    area.style.fontFamily = 'monospace';
    area.style.fontSize = '0.9rem';
    area.oninput = () => {
      this.template.content = area.value;
    };

    wrap.appendChild(header);

    const note = document.createElement('p');
    note.style.cssText = 'margin:0 0 1rem;color:#64748b;font-size:0.9rem;line-height:1.45;';
    const brickId = String((this.template.blockContract && this.template.blockContract.brickId)
      || (this.template.promptConfig && this.template.promptConfig.contract && this.template.promptConfig.contract.brickId)
      || 'output');
    if (brickId === 'validation') {
      note.textContent = 'Lié au contrat Validation : ce HTML est le document présenté à l’humain.';
    } else {
      note.innerHTML = 'Lié au contrat <strong>Sortie</strong> : ce HTML fournit le <strong>corps</strong> du message. Destinataire, sujet et pièces jointes se branchent dans l’agent.';
    }
    wrap.appendChild(note);

    wrap.appendChild(area);
    container.appendChild(wrap);
  }

  htmlContractMeta() {
    const existing = (this.template.blockContract && typeof this.template.blockContract === 'object')
      ? this.template.blockContract
      : ((this.template.promptConfig && this.template.promptConfig.contract) || {});
    const brickId = String(existing.brickId || 'output');
    const contract = {
      brickId,
      version: String(existing.version || '1.0.0')
    };
    const fills = brickId === 'validation'
      ? { body: true }
      : { body: true, message: true };
    return { contract, fills };
  }

  async save() {
    const { contract, fills } = this.htmlContractMeta();
    const promptConfig = Object.assign({}, this.template.promptConfig || {}, { contract, fills });
    const res = await templateApi.update(this.templateId, {
      name: this.template.name,
      kind: 'html',
      content: this.template.content || '',
      blockContract: contract,
      fills,
      promptConfig
    });
    if (res.success) {
      this.template.blockContract = contract;
      this.template.fills = fills;
      this.template.promptConfig = promptConfig;
    }
    alert(res.success ? 'Template enregistré' : (res.error || 'Erreur'));
  }
}
