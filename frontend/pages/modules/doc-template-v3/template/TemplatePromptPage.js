import Page from '../shared/components/page/Page.js';
import { templateApi } from '../shared/api/TemplateApi.js';
import { collectionApi } from '../shared/api/CollectionApi.js';
import { kindLabel } from './templateKinds.js?v=tpl-loop-4';
import {
  PROMPT_PRESETS,
  IA_CONTRACT_FALLBACK,
  assemblePromptContent,
  configFromPreset,
  normalizePromptConfig,
  ensurePromptCollection,
  slugFieldKey,
  IA_RESERVED_KEYS,
  integratedFieldsFromConfig,
  fillsFromValues,
  isEnvelopeKey,
  insertAlias,
  sourceSlugOf,
  rowFieldsOfSource,
  usedItemGroupsFromConfig,
} from './promptPresets.js?v=tpl-loop-4';

const MAIL_FIELDS = [
  { key: 'subject', label: 'Sujet' },
  { key: 'text', label: 'Texte / corps' },
  { key: 'from', label: 'Expéditeur' },
  { key: 'attachments', label: 'Pièces jointes' },
  { key: 'author.email', label: 'Email auteur' },
  { key: 'author.name', label: 'Nom auteur' }
];

const FACEBOOK_FIELDS = [
  { key: 'text', label: 'Texte' },
  { key: 'from', label: 'Auteur' },
  { key: 'type', label: 'Type (post / commentaire / mp)' }
];

function agentApi(path) {
  const base = String(window.API_BASE_URL || '').replace(/\/$/, '');
  return base + '/agent-flows' + path;
}

export default class TemplatePromptPage extends Page {
  constructor(router, templateId) {
    super(router);
    this.templateId = templateId;
    this.template = null;
    this.config = null;
    this.contract = IA_CONTRACT_FALLBACK;
    this.tab = 'main';
    this.collections = [];
    this.lastFocus = 'prompt';
    this.catalogs = [
      { id: 'mail', label: 'Mail', provider: 'mail', fields: MAIL_FIELDS },
      { id: 'facebook', label: 'Facebook', provider: 'facebook', fields: FACEBOOK_FIELDS }
    ];
  }

  async render(container) {
    container.innerHTML = '';
    this.loadStyles();
    const res = await templateApi.getById(this.templateId);
    if (!res.success || !res.data) {
      container.innerHTML = '<p style="padding:2rem;text-align:center;">Template introuvable.</p>';
      return;
    }
    this.template = res.data;
    this.config = normalizePromptConfig(this.template.promptConfig, this.template.content);
    ensurePromptCollection(this.template, this.config);
    if (!Array.isArray(this.template.inputSources)) this.template.inputSources = [];
    await this.loadRemote();
    this.normalizeSources();
    this.syncContent();
    container.appendChild(this.build());
  }

  async loadRemote() {
    try {
      const list = await collectionApi.getAll();
      this.collections = list.success ? (list.data || []) : [];
    } catch (_) {
      this.collections = [];
    }
    try {
      const res = await fetch(agentApi('/block-contracts/ia'), { credentials: 'include' });
      const raw = await res.json();
      if (raw && raw.success && raw.contract && Array.isArray(raw.contract.fields) && raw.contract.fields.length) {
        this.contract = raw.contract;
        if (this.config.contract) this.config.contract.version = raw.contract.version;
      }
    } catch (_) { /* fallback local */ }
    try {
      const res = await fetch(agentApi('/data-contracts'), { credentials: 'include' });
      const raw = await res.json();
      const contracts = raw && raw.contracts;
      if (!contracts) return;
      this.catalogs = this.catalogsFromDataContracts(contracts);
    } catch (_) { /* fallback local */ }
  }

  normalizeSources() {
    this.template.inputSources = this.attachedSources().map((src) => {
      const pack = this.catalogs.find((c) => c.id === src.id || c.provider === src.provider);
      const fields = this.snapshotFields(
        (src.fields && src.fields.length) ? src.fields : ((pack && pack.fields) || [])
      );
      return {
        id: src.id,
        provider: src.provider || (pack && pack.provider) || '',
        label: src.label || (pack && pack.label) || sourceSlugOf(src, src.id),
        type: src.type || (String(src.id).indexOf('col:') === 0 ? 'collection' : 'connector'),
        slug: sourceSlugOf(src, src.id),
        mapFields: !!src.mapFields,
        fields,
        collectionId: src.collectionId || ''
      };
    });
  }

  catalogsFromDataContracts(contracts) {
    const catalogs = [];
    const envelope = (contracts.envelope && contracts.envelope.fields) || [];
    const connectors = contracts.connectors || {};
    Object.keys(connectors).forEach((id) => {
      const c = connectors[id];
      const fields = [];
      const seen = {};
      const push = (f) => {
        const key = String((f && f.key) || '').trim();
        if (!key || seen[key] || isEnvelopeKey(key)) return;
        seen[key] = true;
        fields.push({
          key,
          insertKey: insertAlias(key.split('.').pop()),
          label: f.label || key,
          type: f.type || 'text',
          premap: key.split('.').pop()
        });
      };
      envelope.forEach((f) => {
        if (!f.connectors || !f.connectors.length || f.connectors.indexOf(id) >= 0 || f.connectors.indexOf(c.provider) >= 0) {
          push(f);
        }
      });
      (c.kinds || []).forEach((kind) => {
        (kind.fields || []).forEach(push);
      });
      catalogs.push({
        id,
        label: c.label || id,
        provider: c.provider || id,
        fields
      });
    });
    return catalogs.length ? catalogs : this.catalogs;
  }

  syncContent() {
    this.config.fills = fillsFromValues(this.config.values);
    this.config.variables = integratedFieldsFromConfig(this.config, this.attachedSources()).map((f) => f.key);
    this.config.role = this.config.values.context;
    this.config.instruction = this.config.values.prompt;
    this.template.content = assemblePromptContent(this.config);
    this.template.promptConfig = { ...this.config };
    ensurePromptCollection(this.template, this.config);
    this.pruneCollectionToCustomFields();
  }

  pruneCollectionToCustomFields() {
    ensurePromptCollection(this.template, this.config);
    this.template.defaultCollection.fields = (this.template.defaultCollection.fields || []).filter((f) => {
      const name = String((f && f.name) || '');
      return name && !isEnvelopeKey(name);
    });
  }

  attachedSources() {
    return Array.isArray(this.template.inputSources) ? this.template.inputSources : [];
  }

  usedItems() {
    return usedItemGroupsFromConfig(this.config, this.attachedSources());
  }

  snapshotFields(list) {
    const seen = {};
    const out = [];
    (list || []).forEach((f) => {
      const key = String((f && (f.key || f.name)) || '').trim();
      if (!key || seen[key] || isEnvelopeKey(key) || IA_RESERVED_KEYS.indexOf(key) >= 0) return;
      seen[key] = true;
      const local = key.split('.').pop();
      out.push({
        key,
        insertKey: String(f.insertKey || insertAlias(local) || local),
        label: (f && (f.label || f.key || f.name)) || key,
        type: (f && f.type) || 'text',
        premap: String((f && (f.premap || f.premapKey)) || local)
      });
    });
    return out;
  }

  customSidebarFields() {
    const used = {};
    this.attachedSources().forEach((src) => {
      used[sourceSlugOf(src, src.id)] = true;
      rowFieldsOfSource(src).forEach((f) => {
        used[f.key] = true;
        used[f.insertKey] = true;
      });
    });
    return ((this.template.defaultCollection && this.template.defaultCollection.fields) || [])
      .filter((f) => f && f.name && f.custom && !used[f.name] && !isEnvelopeKey(f.name))
      .map((f) => ({ key: f.name, label: f.label || f.name }));
  }

  fieldCategory(f) {
    const key = String((f && (f.key || f.insertKey)) || '').toLowerCase();
    const local = key.split('.').pop();
    const type = String((f && f.type) || '').toLowerCase();
    if (type === 'datetime' || type === 'date' || /^(timestamp|created_time|date|updated_at|created_at)$/.test(local) || /_at$/.test(local)) {
      return 'dates';
    }
    if (type === 'file' || type === 'image' || /attach|fichier|pj/.test(local)) return 'files';
    if (key.indexOf('author.') === 0 || local === 'author') return 'author';
    if (/^(subject|sujet|text|texte|from|expediteur|name|nom|body|corps|message)$/.test(local)) return 'content';
    return 'meta';
  }

  groupedSourceFields(fields) {
    const order = ['content', 'files', 'dates', 'author', 'meta'];
    const labels = {
      content: 'Contenu',
      files: 'Fichiers',
      dates: 'Dates',
      author: 'Auteur',
      meta: 'Références'
    };
    const buckets = {};
    (fields || []).forEach((f) => {
      const cat = this.fieldCategory(f);
      if (!buckets[cat]) buckets[cat] = [];
      buckets[cat].push(f);
    });
    order.forEach((cat) => {
      if (!buckets[cat]) return;
      buckets[cat].sort((a, b) => String(a.label || a.key).localeCompare(String(b.label || b.key), 'fr'));
    });
    return order.filter((cat) => buckets[cat] && buckets[cat].length).map((cat) => ({
      id: cat,
      label: labels[cat],
      fields: buckets[cat]
    }));
  }

  build() {
    const wrap = document.createElement('div');
    wrap.className = 'prompt-editor prompt-editor--contract';
    wrap.appendChild(this.buildHeader());
    wrap.appendChild(this.buildTabs());
    const body = document.createElement('div');
    body.className = 'prompt-editor-body';
    if (this.tab === 'main') {
      body.appendChild(this.buildMain());
    } else if (this.tab === 'output') {
      body.appendChild(this.buildOutput());
    } else {
      body.appendChild(this.buildInputs());
    }
    wrap.appendChild(body);
    return wrap;
  }

  buildHeader() {
    const header = document.createElement('div');
    header.className = 'prompt-editor-header';
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = '← Templates';
    back.onclick = () => this.navigate('/templates');
    const badge = document.createElement('span');
    badge.className = 'prompt-editor-badge';
    badge.textContent = kindLabel('prompt') + ' · contrat ' + (this.contract.version || '1.0.0');
    const title = document.createElement('input');
    title.type = 'text';
    title.value = this.template.name || 'Prompt IA';
    title.oninput = () => { this.template.name = title.value; };
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'prompt-editor-save';
    save.textContent = 'Enregistrer';
    save.onclick = () => this.save();
    header.appendChild(back);
    header.appendChild(badge);
    header.appendChild(title);
    header.appendChild(save);
    return header;
  }

  buildTabs() {
    const nav = document.createElement('div');
    nav.className = 'prompt-editor-tabs';
    [
      ['main', 'Principal'],
      ['output', 'Sortie'],
      ['inputs', 'Données d’entrée']
    ].forEach(([id, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prompt-editor-tab' + (this.tab === id ? ' is-active' : '');
      btn.textContent = label;
      btn.onclick = () => {
        this.syncContent();
        this.tab = id;
        this.rerender();
      };
      nav.appendChild(btn);
    });
    return nav;
  }

  buildMain() {
    const row = document.createElement('div');
    row.className = 'prompt-editor-main';
    const center = document.createElement('div');
    center.className = 'prompt-editor-center';
    const hint = document.createElement('p');
    hint.className = 'prompt-editor-hint';
    hint.textContent = 'Zones de contenu du contrat '
      + (this.contract.name || 'IA')
      + ' v'
      + (this.contract.version || '1.1.0')
      + '. Prompt / contexte / RAG : une zone remplie recouvre le bloc ; une zone vide reste à mapper. Le modèle et les paramètres avancés se règlent sur l’agent.';
    center.appendChild(hint);
    center.appendChild(this.buildPreset());
    (this.contract.fields || IA_CONTRACT_FALLBACK.fields)
      .filter((field) => field && field.overlay !== false && !field.advanced)
      .forEach((field) => {
      center.appendChild(this.contractField(field));
    });
    center.appendChild(this.buildPreview());
    row.appendChild(center);
    row.appendChild(this.buildSidebar());
    return row;
  }

  buildPreset() {
    const box = document.createElement('div');
    box.className = 'prompt-editor-field';
    const label = document.createElement('label');
    label.textContent = 'Modèle de départ';
    const select = document.createElement('select');
    PROMPT_PRESETS.forEach((preset) => {
      const opt = document.createElement('option');
      opt.value = preset.id;
      opt.textContent = preset.label;
      if (preset.id === this.config.preset) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = () => {
      if (!confirm('Remplacer les champs du contrat et le format de sortie par ce modèle ?')) {
        select.value = this.config.preset;
        return;
      }
      this.config = configFromPreset(select.value);
      this.rerender();
    };
    box.appendChild(label);
    box.appendChild(select);
    return box;
  }

  contractField(field) {
    const key = field.key;
    const row = document.createElement('div');
    row.className = 'prompt-editor-field';
    const label = document.createElement('label');
    label.textContent = (field.label || key) + (field.required ? ' *' : '');
    const area = document.createElement('textarea');
    area.rows = key === 'prompt' ? 8 : 4;
    area.placeholder = field.description || '';
    area.value = (this.config.values && this.config.values[key]) || '';
    area.dataset.contractField = key;
    area.onfocus = () => { this.lastFocus = key; };
    area.oninput = () => {
      if (!this.config.values) this.config.values = {};
      this.config.values[key] = area.value;
      this.syncContent();
      this.refreshPreview();
    };
    row.appendChild(label);
    row.appendChild(area);
    return row;
  }

  buildSidebar() {
    const side = document.createElement('aside');
    side.className = 'prompt-editor-side';
    const title = document.createElement('h3');
    title.textContent = 'Insérer depuis les items';
    side.appendChild(title);
    const hint = document.createElement('p');
    hint.className = 'prompt-editor-hint';
    const sources = this.attachedSources();
    const custom = this.customSidebarFields();
    hint.textContent = sources.length
      ? 'Cliquez un groupe : {{#donnees[i]}}. Changez i (0, 1, 2…). Dedans : {{ia.item[i].intention}}.'
      : 'Ajoutez Mail, Facebook ou une collection. Cliquez ensuite le groupe Données pour insérer la boucle.';
    side.appendChild(hint);

    const actions = document.createElement('div');
    actions.className = 'prompt-editor-side-actions';
    const addItems = document.createElement('button');
    addItems.type = 'button';
    addItems.textContent = 'Ajouter items';
    addItems.onclick = () => this.openItemsModal();
    const addField = document.createElement('button');
    addField.type = 'button';
    addField.textContent = 'Ajouter champ';
    addField.onclick = () => this.openAddField();
    actions.appendChild(addItems);
    actions.appendChild(addField);
    side.appendChild(actions);

    const list = document.createElement('div');
    list.className = 'prompt-editor-side-list';
    if (!sources.length && !custom.length) {
      const empty = document.createElement('p');
      empty.className = 'prompt-editor-hint';
      empty.textContent = 'Aucun item. Ajoutez Mail, Facebook, une collection, ou un champ libre.';
      list.appendChild(empty);
    }
    if (sources.length) {
      const hasDonnees = sources.some((src) => sourceSlugOf(src, src.id) === 'donnees');
      if (!hasDonnees) list.appendChild(this.buildGlobalDonneesPicker(sources));
    }
    sources.forEach((src) => list.appendChild(this.buildSourcePicker(src)));
    if (custom.length) {
      const group = document.createElement('div');
      group.className = 'prompt-compose-source is-open';
      const head = document.createElement('div');
      head.className = 'prompt-compose-source-toggle';
      head.innerHTML = '<span class="prompt-compose-source-badge">libre</span>'
        + '<span class="prompt-compose-source-name">Champs libres</span>';
      group.appendChild(head);
      custom.forEach((f) => {
        group.appendChild(this.fieldInsertButton(f.label, f.key, '{{' + f.key + '}}', 'Champ libre', 'Libre'));
      });
      list.appendChild(group);
    }
    side.appendChild(list);
    return side;
  }

  buildGlobalDonneesPicker(sources) {
    const wrap = document.createElement('div');
    wrap.className = 'prompt-compose-source is-open prompt-compose-source--table';
    wrap.dataset.itemPicker = '1';

    wrap.appendChild(this.buildLoopHead('donnees', 'Données', { global: true }));

    wrap.appendChild(this.fieldInsertButton(
      'Boucle globale',
      '#donnees',
      '{{#donnees}}\n\n{{/donnees}}',
      'Insère {{#donnees}} … {{/donnees}}. Alias global du tableau (mails, commentaires…).',
      'Données',
      { loop: true }
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Item (ligne courante / même index)',
      'item',
      '{{item}}',
      'Insère l’item en cours. Dans {{#donnees}}, {{analyse.item}} est la 2e intention si on est au 2e mail.',
      'Données',
      { defaut: true }
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Tableau (toutes les lignes)',
      'donnees',
      '{{donnees}}',
      'Insère tout le tableau. Pour une liste (intentions), pas pour un seul message.',
      'Données'
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Nombre de lignes',
      'donnees.length',
      '{{donnees.length}}',
      'Nombre de lignes du tableau.',
      'Données'
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Index de parcours (0…)',
      'itemIndex',
      '{{itemIndex}}',
      'Variable de parcours dans la boucle : 0 pour le 1er mail, 1 pour le 2e…',
      'Données'
    ));
    wrap.appendChild(this.fieldInsertButton(
      'N° de ligne (1…)',
      'itemNumber',
      '{{itemNumber}}',
      'Numéro lisible de la ligne (1, 2, 3…).',
      'Données'
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Item à l’index de parcours',
      'donnees.items.$i',
      '{{donnees.items.$i}}',
      'Cherche items[itemIndex]. Ex. {{analyse.items.$i.intention}} dans {{#donnees}}.',
      'Données'
    ));

    const seen = {};
    const fields = [];
    (sources || []).forEach((src) => {
      rowFieldsOfSource(src).forEach((f) => {
        const local = f.insertKey || f.key;
        if (!local || seen[local]) return;
        seen[local] = true;
        fields.push(f);
      });
    });
    wrap.appendChild(this.buildLoopBody('donnees', 'Données', fields));
    return wrap;
  }

  buildLoopHead(slug, label, opts) {
    const head = document.createElement('div');
    head.className = 'prompt-compose-source-head';
    const insertBtn = document.createElement('button');
    insertBtn.type = 'button';
    insertBtn.className = 'prompt-compose-source-toggle prompt-compose-source-toggle--insert';
    insertBtn.title = 'Cliquez pour insérer {{#' + slug + '[i]}} … {{/' + slug + '}}';
    insertBtn.innerHTML = '<span class="prompt-compose-source-badge">' + (opts && opts.global ? 'global' : 'item') + '</span>'
      + '<span class="prompt-compose-source-name">' + this.escape(label) + '</span>'
      + '<code class="prompt-compose-source-loop">{{#' + this.escape(slug) + '[i]}} … {{/' + this.escape(slug) + '}}</code>';
    insertBtn.onmousedown = (ev) => { ev.preventDefault(); };
    insertBtn.onclick = () => this.insertLoop(slug, 'pair');
    head.appendChild(insertBtn);
    const fold = document.createElement('button');
    fold.type = 'button';
    fold.className = 'prompt-compose-source-btn';
    fold.textContent = 'Replier';
    fold.onclick = (ev) => {
      ev.stopPropagation();
      const wrap = head.closest('.prompt-compose-source');
      if (!wrap) return;
      wrap.classList.toggle('is-open');
      fold.textContent = wrap.classList.contains('is-open') ? 'Replier' : 'Déplier';
    };
    head.appendChild(fold);
    if (opts && opts.onRemove) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'prompt-compose-source-btn';
      remove.textContent = '×';
      remove.title = 'Retirer cet item';
      remove.onclick = (ev) => {
        ev.stopPropagation();
        opts.onRemove();
      };
      head.appendChild(remove);
    }
    return head;
  }

  buildLoopBody(slug, label, fields) {
    const loop = document.createElement('div');
    loop.className = 'prompt-compose-loop';
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'prompt-compose-loop-tag';
    openBtn.innerHTML = '<code>{{#' + this.escape(slug) + '[i]}}</code>';
    openBtn.onmousedown = (ev) => { ev.preventDefault(); };
    openBtn.onclick = () => this.insertLoop(slug, 'pair');
    loop.appendChild(openBtn);

    const body = document.createElement('div');
    body.className = 'prompt-compose-loop-body';
    const groupLabel = document.createElement('div');
    groupLabel.className = 'prompt-compose-loop-group';
    groupLabel.textContent = 'Champs de « ' + label + ' »';
    body.appendChild(groupLabel);
    const groups = this.groupedSourceFields(fields);
    if (!groups.length) {
      const empty = document.createElement('p');
      empty.className = 'prompt-editor-hint';
      empty.textContent = 'Aucun champ sur cet item.';
      body.appendChild(empty);
    }
    groups.forEach((g) => {
      const cat = document.createElement('div');
      cat.className = 'prompt-compose-loop-cat';
      cat.textContent = g.label;
      body.appendChild(cat);
      g.fields.forEach((f) => {
        const token = slug + '.item[i].' + (f.insertKey || f.key);
        body.appendChild(this.fieldInsertButton(
          f.label,
          token,
          '{{' + token + '}}',
          label + ' — ' + (f.label || token) + '. Dans {{#' + slug + '[i]}}.',
          label
        ));
      });
    });
    loop.appendChild(body);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'prompt-compose-loop-tag';
    closeBtn.innerHTML = '<code>{{/' + this.escape(slug) + '}}</code>';
    closeBtn.onmousedown = (ev) => { ev.preventDefault(); };
    closeBtn.onclick = () => this.insertLoop(slug, 'close');
    loop.appendChild(closeBtn);
    return loop;
  }

  buildSourcePicker(src) {
    const slug = sourceSlugOf(src, src.id);
    const label = src.label || slug;
    const fields = rowFieldsOfSource(src);
    const wrap = document.createElement('div');
    wrap.className = 'prompt-compose-source is-open prompt-compose-source--item';
    wrap.dataset.itemPicker = '1';

    wrap.appendChild(this.buildLoopHead(slug, label, { onRemove: () => this.detachSource(src.id) }));

    wrap.appendChild(this.fieldInsertButton(
      'Boucle sur les lignes',
      '#' + slug,
      '{{#' + slug + '[i]}}\n\n{{/' + slug + '}}',
      'Insère {{#' + slug + '[i]}} … {{/' + slug + '}}. Changez i (0, 1, 2…) ou gardez i pour parcourir.',
      label,
      { loop: true }
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Boucle globale Données',
      '#donnees',
      '{{#donnees[i]}}\n\n{{/donnees}}',
      'Alias global : {{#donnees[i]}} … {{/donnees}}.',
      'Données',
      { loop: true }
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Item (ligne courante / même index)',
      'item',
      '{{item}}',
      'Insère l’item en cours. Dans une autre boucle, {{' + slug + '.item}} est la ligne n° itemIndex de ce tableau.',
      label,
      { defaut: true }
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Tableau (toutes les lignes)',
      slug,
      '{{' + slug + '}}',
      'Insère tout le tableau « ' + label + ' ». Pour une liste (intentions), pas pour un seul message.',
      label
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Nombre de lignes',
      slug + '.length',
      '{{' + slug + '.length}}',
      'Nombre de lignes de « ' + label + ' »',
      label
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Index de parcours (0…)',
      'itemIndex',
      '{{itemIndex}}',
      'Variable de parcours dans la boucle : 0 pour le 1er item, 1 pour le 2e…',
      label
    ));
    wrap.appendChild(this.fieldInsertButton(
      'N° de ligne (1…)',
      'itemNumber',
      '{{itemNumber}}',
      'Numéro lisible de la ligne (1, 2, 3…).',
      label
    ));
    wrap.appendChild(this.fieldInsertButton(
      'Item à l’index de parcours',
      slug + '.items.$i',
      '{{' + slug + '.items.$i}}',
      'Cherche items[itemIndex]. Ex. {{' + slug + '.items.$i.intention}} dans {{#donnees}}.',
      label
    ));

    wrap.appendChild(this.buildLoopBody(slug, label, fields));
    return wrap;
  }

  fieldInsertButton(label, key, insert, hint, origin, opts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'prompt-editor-side-item' + (opts && opts.defaut ? ' is-default' : '');
    btn.title = hint || '';
    btn.onmousedown = (ev) => { ev.preventDefault(); };
    const code = opts && opts.loop
      ? String(insert || '').replace(/\n+/g, ' … ')
      : '{{' + key + '}}';
    btn.innerHTML = (origin
      ? '<span class="prompt-editor-side-origin">' + this.escape(origin) + '</span>'
      : '')
      + '<span class="prompt-editor-side-item-label">' + this.escape(label) + '</span>'
      + (opts && opts.defaut ? '<span class="prompt-editor-side-default">défaut</span>' : '')
      + '<code>' + this.escape(code) + '</code>';
    btn.onclick = () => {
      if (opts && opts.loop) {
        const slug = String(key || '').replace(/^#/, '') || 'donnees';
        this.insertLoop(slug, 'pair');
        return;
      }
      this.insertSnippet(insert);
    };
    return btn;
  }

  openItemsModal() {
    const attached = this.attachedSources().map((s) => s.id);
    const modal = document.createElement('div');
    modal.className = 'prompt-editor-modal';
    modal.innerHTML = '<div class="prompt-editor-modal-card"><h3>Ajouter des items</h3><p class="prompt-editor-hint">Packs issus des connecteurs (contrat Données) et collections. On n’ajoute que les champs de l’item.</p></div>';
    const card = modal.firstChild;
    this.catalogs.forEach((pack) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'prompt-editor-pack';
      row.disabled = attached.indexOf(pack.id) >= 0;
      const count = this.snapshotFields(pack.fields).length;
      row.textContent = pack.label + (row.disabled ? ' (déjà ajouté)' : '') + ' — ' + count + ' champ' + (count > 1 ? 's' : '');
      row.onclick = () => {
        this.attachSource({
          id: pack.id,
          provider: pack.provider,
          label: pack.label,
          type: 'connector',
          slug: sourceSlugOf({ id: pack.id, provider: pack.provider, label: pack.label }),
          mapFields: false,
          fields: this.snapshotFields(pack.fields)
        });
        modal.remove();
      };
      card.appendChild(row);
    });
    this.collections.forEach((col) => {
      const id = 'col:' + String(col._id || col.id || '');
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'prompt-editor-pack';
      row.disabled = attached.indexOf(id) >= 0;
      row.textContent = (col.name || col.slug || 'Collection') + ' — collection';
      row.onclick = () => {
        this.attachCollection(col);
        modal.remove();
      };
      card.appendChild(row);
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Fermer';
    close.onclick = () => modal.remove();
    card.appendChild(close);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  }

  attachSource(src, silent) {
    if (!Array.isArray(this.template.inputSources)) this.template.inputSources = [];
    if (this.template.inputSources.some((s) => s.id === src.id)) {
      if (!silent) this.rerender();
      return;
    }
    const slug = sourceSlugOf(src, src.id);
    this.template.inputSources.push({
      id: src.id,
      provider: src.provider || '',
      label: src.label || slug,
      type: src.type || 'connector',
      slug,
      mapFields: !!src.mapFields,
      fields: this.snapshotFields(src.fields),
      collectionId: src.collectionId || ''
    });
    if (!silent) this.rerender();
  }

  detachSource(id) {
    if (!Array.isArray(this.template.inputSources)) return;
    this.template.inputSources = this.template.inputSources.filter((s) => s.id !== id);
    if (String(id).indexOf('col:') === 0) {
      const colId = String(id).slice(4);
      this.template.additionalCollections = (this.template.additionalCollections || [])
        .filter((c) => String(c.collectionId) !== colId);
    }
    this.rerender();
  }

  attachCollection(col) {
    const id = 'col:' + String(col._id || col.id || '');
    const alias = slugFieldKey(col.slug || col.name, 'modele') || 'modele';
    const fields = this.snapshotFields((col.fields || []).map((f, i) => ({
      key: String(f.name || f.key || `champ_${i + 1}`).trim(),
      label: f.label || f.name || f.key,
      type: f.type || 'text'
    })));
    this.attachSource({
      id,
      type: 'collection',
      collectionId: String(col._id || col.id),
      label: col.name || col.slug || alias,
      slug: alias,
      mapFields: false,
      fields
    }, true);
    if (!Array.isArray(this.template.additionalCollections)) this.template.additionalCollections = [];
    if (!this.template.additionalCollections.some((e) => String(e.collectionId) === String(col._id || col.id))) {
      this.template.additionalCollections.push({
        collectionId: String(col._id || col.id),
        alias,
        name: col.name || alias,
        fields: fields.map((f) => ({ name: f.key, label: f.label }))
      });
    }
    this.rerender();
  }

  insertLoop(slug, which) {
    const keySlug = String(slug || 'donnees').trim() || 'donnees';
    const open = '{{#' + keySlug + '[i]}}';
    const close = '{{/' + keySlug + '}}';
    if (which === 'close') {
      this.insertSnippet(close);
      return;
    }
    const key = this.lastFocus || 'prompt';
    const area = this.router.outlet && this.router.outlet.querySelector(`[data-contract-field="${key}"]`);
    const current = String((this.config.values && this.config.values[key]) || '');
    if (area) {
      const selStart = area.selectionStart != null ? area.selectionStart : current.length;
      const selEnd = area.selectionEnd != null ? area.selectionEnd : selStart;
      const selected = current.slice(selStart, selEnd);
      let token = open + '\n\n' + close;
      let cursorOffset = open.length + 1;
      if (selected) {
        token = open + '\n' + selected + '\n' + close;
        cursorOffset = token.length;
      }
      this.insertSnippet(token, cursorOffset);
      return;
    }
    this.insertSnippet(open + '\n\n' + close, open.length + 1);
  }

  insertSnippet(snippet, cursorOffset) {
    const key = this.lastFocus || 'prompt';
    if (!this.config.values) this.config.values = {};
    const area = this.router.outlet && this.router.outlet.querySelector(`[data-contract-field="${key}"]`);
    const current = String(this.config.values[key] || '');
    const token = String(snippet || '');
    if (area) {
      const start = area.selectionStart != null ? area.selectionStart : current.length;
      const end = area.selectionEnd != null ? area.selectionEnd : start;
      this.config.values[key] = current.slice(0, start) + token + current.slice(end);
      area.value = this.config.values[key];
      const pos = start + (cursorOffset != null ? cursorOffset : token.length);
      area.focus();
      area.setSelectionRange(pos, pos);
    } else {
      this.config.values[key] = current + token;
    }
    this.syncContent();
    this.refreshPreview();
  }

  openAddField() {
    const key = slugFieldKey(prompt('Nom du champ (ex. client)') || '');
    if (!key) return;
    if (IA_RESERVED_KEYS.indexOf(key) >= 0) {
      alert('Ce nom est un champ du contrat du bloc.');
      return;
    }
    ensurePromptCollection(this.template, this.config);
    if (this.template.defaultCollection.fields.some((f) => f.name === key)) {
      alert('Ce champ existe déjà.');
      return;
    }
    this.template.defaultCollection.fields.push({
      name: key,
      label: key,
      type: 'textarea',
      premap: key,
      custom: true
    });
    this.rerender();
  }

  buildUsedItemsList(editable) {
    const grouped = this.usedItems();
    const wrap = document.createElement('div');
    wrap.className = 'prompt-editor-fields';
    if (!grouped.groups.length && !grouped.extra.length) {
      const empty = document.createElement('p');
      empty.className = 'prompt-editor-hint';
      empty.textContent = 'Aucun item dans les zones. Dans Principal, insérez un tableau complet ou un champ dans prompt / contexte / RAG.';
      wrap.appendChild(empty);
      return wrap;
    }
    grouped.groups.forEach((g) => {
      const card = document.createElement('div');
      card.className = 'prompt-editor-item-card';
      const head = document.createElement('div');
      head.className = 'prompt-editor-field-row';
      const mode = g.mapFields ? 'champs' : 'item complet';
      head.innerHTML = '<span>' + this.escape(g.label) + '</span><em>' + mode + '</em><code>{{' + this.escape(g.slug) + '}}</code>';
      card.appendChild(head);
      if (editable) {
        const box = document.createElement('label');
        box.className = 'prompt-editor-map-fields';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!g.mapFields;
        input.onchange = () => {
          const src = this.attachedSources().find((s) => s.id === g.id);
          if (src) src.mapFields = input.checked;
          this.rerender();
        };
        box.appendChild(input);
        box.appendChild(document.createTextNode(' Mapper sur les champs'));
        const help = document.createElement('p');
        help.className = 'prompt-editor-hint';
        help.textContent = g.mapFields
          ? 'Mapping champ à champ — utile si l’item est volumineux (pièces jointes, HTML…).'
          : 'Par défaut l’agent demande l’item (ligne courante). Cochez pour brancher chaque champ.';
        card.appendChild(box);
        card.appendChild(help);
      }
      if (g.mapFields) {
        const fields = g.usedFields.length
          ? g.usedFields
          : g.fields.map((f) => ({
            key: g.slug + '.' + (f.insertKey || f.key),
            label: f.label
          }));
        fields.forEach((f) => {
          const row = document.createElement('div');
          row.className = 'prompt-editor-field-row prompt-editor-field-row--nested';
          row.innerHTML = '<span>' + this.escape(f.label) + '</span><code>{{' + this.escape(f.key) + '}}</code>';
          card.appendChild(row);
        });
      }
      wrap.appendChild(card);
    });
    grouped.extra.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'prompt-editor-field-row';
      row.innerHTML = '<span>' + this.escape(f.label) + '</span>'
        + (f.source ? '<em>' + this.escape(f.source) + '</em>' : '')
        + '<code>{{' + this.escape(f.key) + '}}</code>';
      wrap.appendChild(row);
    });
    return wrap;
  }

  buildOutput() {
    const wrap = document.createElement('div');
    wrap.className = 'prompt-editor-center';
    const itemsTitle = document.createElement('h3');
    itemsTitle.className = 'prompt-editor-section-title';
    itemsTitle.textContent = 'Items demandés';
    wrap.appendChild(itemsTitle);
    const itemsHint = document.createElement('p');
    itemsHint.className = 'prompt-editor-hint';
    itemsHint.textContent = 'Tout item inséré dans une zone du contrat apparaît ici. Un seul item → item complet, sauf mapping champ à champ.';
    wrap.appendChild(itemsHint);
    wrap.appendChild(this.buildUsedItemsList(false));

    const hint = document.createElement('p');
    hint.className = 'prompt-editor-hint';
    hint.textContent = 'Optionnel. Format attendu de la réponse du modèle. N’entre pas dans le contrat d’entrée du bloc.';
    wrap.appendChild(hint);
    const row = document.createElement('div');
    row.className = 'prompt-editor-field';
    const label = document.createElement('label');
    label.textContent = 'Format';
    const select = document.createElement('select');
    [['text', 'Texte libre'], ['json', 'JSON']].forEach(([id, name]) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      if (this.config.outputFormat === id) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = () => {
      this.config.outputFormat = select.value;
      this.syncContent();
      this.refreshPreview();
    };
    const area = document.createElement('textarea');
    area.rows = 6;
    area.placeholder = this.config.outputFormat === 'json'
      ? '[\n  { "intention": "…", "confiance": 0.0, "resume": "…" }\n]'
      : 'Ex. Uniquement le corps du mail.';
    area.value = this.config.outputHint || '';
    area.oninput = () => {
      this.config.outputHint = area.value;
      this.syncContent();
      this.refreshPreview();
    };
    row.appendChild(label);
    row.appendChild(select);
    row.appendChild(area);
    wrap.appendChild(row);
    wrap.appendChild(this.buildPreview());
    return wrap;
  }

  buildInputs() {
    const wrap = document.createElement('div');
    wrap.className = 'prompt-editor-center';
    const hint = document.createElement('p');
    hint.className = 'prompt-editor-hint';
    hint.textContent = 'Items et champs {{}} déjà intégrés dans prompt / contexte / RAG. C’est ce que l’agent devra brancher.';
    wrap.appendChild(hint);
    wrap.appendChild(this.buildUsedItemsList(true));
    return wrap;
  }

  buildPreview() {
    const box = document.createElement('details');
    box.className = 'prompt-editor-preview';
    box.open = true;
    const sum = document.createElement('summary');
    sum.textContent = 'Aperçu envoyé au modèle';
    const pre = document.createElement('pre');
    pre.id = 'prompt-editor-preview-body';
    pre.textContent = this.template.content || '';
    box.appendChild(sum);
    box.appendChild(pre);
    return box;
  }

  refreshPreview() {
    const pre = document.getElementById('prompt-editor-preview-body');
    if (pre) pre.textContent = this.template.content || '';
  }

  escape(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  rerender() {
    this.syncContent();
    const host = this.router && this.router.outlet;
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(this.build());
  }

  async save() {
    this.syncContent();
    const res = await templateApi.update(this.templateId, {
      name: this.template.name,
      kind: 'prompt',
      content: this.template.content || '',
      promptConfig: this.config,
      blockContract: this.config.contract || { brickId: 'ia', version: '1.0.0' },
      fills: this.config.fills,
      defaultCollection: this.template.defaultCollection,
      additionalCollections: this.template.additionalCollections || [],
      inputSources: this.attachedSources()
    });
    alert(res.success ? 'Template enregistré' : (res.error || 'Erreur'));
  }

  loadStyles() {
    if (document.getElementById('template-prompt-styles')) {
      document.getElementById('template-prompt-styles').href =
        (window.BASE_URL || '/') + 'pages/modules/doc-template-v3/template/TemplatePromptPage.css?v=tpl-loop-4';
      return;
    }
    const link = document.createElement('link');
    link.id = 'template-prompt-styles';
    link.rel = 'stylesheet';
    link.href = (window.BASE_URL || '/') + 'pages/modules/doc-template-v3/template/TemplatePromptPage.css?v=tpl-loop-4';
    document.head.appendChild(link);
  }
}
