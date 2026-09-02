/**
 * Catalogue des types de champs collection (contrat commun).
 * Source alignée : backend/config/json/types/fieldTypes.json
 * + types contrat agent/connecteur (enum, connection, secret).
 */
(function (global) {
  var TYPES = [
    { id: 'text', label: 'Texte' },
    { id: 'textarea', label: 'Zone de texte' },
    { id: 'number', label: 'Nombre' },
    { id: 'boolean', label: 'Oui / Non' },
    { id: 'date', label: 'Date' },
    { id: 'datetime', label: 'Date & heure' },
    { id: 'url', label: 'Lien' },
    { id: 'image', label: 'Image' },
    { id: 'file', label: 'Fichier' },
    { id: 'color', label: 'Couleur' },
    { id: 'enum', label: 'Liste de choix' }
  ];

  var CONTRACT_TYPES = [
    { id: 'array', label: 'Liste (tags)' },
    { id: 'connection', label: 'Connexion' },
    { id: 'secret', label: 'Secret' }
  ];

  var ALIASES = {
    string: 'text',
    texte: 'text',
    Texte: 'text',
    TextArea: 'textarea',
    Lien: 'url',
    uri: 'url',
    currency: 'number',
    nombre: 'number',
    Number: 'number',
    integer: 'number',
    html: 'textarea',
    bool: 'boolean',
    Boolean: 'boolean',
    fichier: 'file',
    Fichier: 'file',
    Image: 'image',
    couleur: 'color',
    Couleur: 'color',
    Date: 'date',
    DateTime: 'datetime',
    'date-time': 'datetime',
    Enum: 'enum',
    select: 'enum',
    Connection: 'connection',
    connector: 'connection',
    connectorRef: 'connection',
    Secret: 'secret',
    password: 'secret',
    tags: 'array'
  };

  function escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function escapeHtml(value) {
    return escapeAttr(value).replace(/>/g, '&gt;');
  }

  function allTypes() {
    return TYPES.concat(CONTRACT_TYPES);
  }

  function labels() {
    var out = {};
    allTypes().forEach(function (t) { out[t.id] = t.label; });
    return out;
  }

  function normalizeType(raw) {
    var t = String(raw || 'text');
    if (ALIASES[t]) return ALIASES[t];
    var lower = t.toLowerCase();
    if (ALIASES[lower]) return ALIASES[lower];
    return lower || 'text';
  }

  function asEnumList(value) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map(function (v) { return v.trim(); }).filter(Boolean);
    }
    return [];
  }

  function normalizeField(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var key = String(raw.key || raw.name || raw.id || '').trim();
    if (!key) return null;
    var enumValues = asEnumList(
      raw.enum || raw.allowedValues
        || (raw.validation && raw.validation.allowedValues)
        || (raw.validationOverrides && raw.validationOverrides.allowedValues)
    );
    var type = normalizeType(raw.typeRef || raw.uiType || raw.type);
    if (enumValues.length && (type === 'text' || type === 'string')) type = 'enum';
    var field = {
      key: key,
      label: String(raw.label || raw.title || key),
      type: type,
      required: raw.required === true,
      description: String(raw.description || raw.hint || ''),
      placeholder: String(raw.placeholder || ''),
      default: raw.default !== undefined ? raw.default : raw.defaultValue,
      multiple: raw.multiple === true,
      secret: type === 'secret' || raw.secret === true || raw.format === 'secret'
    };
    if (enumValues.length) field.enum = enumValues;
    if (raw.enumLabels && typeof raw.enumLabels === 'object') field.enumLabels = raw.enumLabels;
    if (raw.min != null || raw.minimum != null) field.min = Number(raw.min != null ? raw.min : raw.minimum);
    if (raw.max != null || raw.maximum != null) field.max = Number(raw.max != null ? raw.max : raw.maximum);
    if (raw.step != null) field.step = Number(raw.step);
    if (raw.unit) field.unit = String(raw.unit);
    if (raw.example !== undefined) field.example = raw.example;
    if (raw.connectionSource) field.connectionSource = String(raw.connectionSource);
    if (raw.connectorId) field.connectorId = String(raw.connectorId);
    if (type === 'connection' && !field.connectionSource) {
      field.connectionSource = field.connectorId ? 'connector-instance' : 'mail-account';
    }
    return field;
  }

  function optionsHtml(selected, includeEmpty) {
    var html = includeEmpty ? '<option value="">-- Sélectionner un type --</option>' : '';
    TYPES.forEach(function (t) {
      html += '<option value="' + t.id + '"' + (String(selected) === t.id ? ' selected' : '') + '>'
        + t.label + '</option>';
    });
    return html;
  }

  function fillSelect(select, selected) {
    if (!select) return;
    var cur = selected != null && selected !== '' ? selected : select.value;
    var keepEmpty = select.getAttribute('data-empty') === '1'
      || !!(select.querySelector && select.querySelector('option[value=""]'));
    select.innerHTML = optionsHtml(cur, keepEmpty);
    if (cur) select.value = cur;
  }

  function inputHtml(type, attrs) {
    attrs = attrs || {};
    var id = attrs.id ? ' id="' + escapeAttr(attrs.id) + '"' : '';
    var name = attrs.name ? ' name="' + escapeAttr(attrs.name) + '"' : '';
    var req = attrs.required ? ' required' : '';
    var ro = attrs.readonly ? ' readonly' : '';
    var dis = attrs.disabled ? ' disabled' : '';
    var cls = ' class="form-control"';
    var val = attrs.value != null ? escapeAttr(String(attrs.value)) : '';
    var extra = attrs.extra || '';
    var t = normalizeType(type);
    switch (t) {
      case 'number':
        return '<input type="number" step="any"' + id + name + cls + req + ro + dis + extra
          + ' value="' + val + '">';
      case 'boolean':
        return '<select' + id + name + cls + req + ro + dis + extra + '>'
          + '<option value="">-- Sélectionner --</option>'
          + '<option value="true"' + (val === 'true' ? ' selected' : '') + '>Oui</option>'
          + '<option value="false"' + (val === 'false' ? ' selected' : '') + '>Non</option>'
          + '</select>';
      case 'date':
        return '<input type="date"' + id + name + cls + req + ro + dis + extra
          + ' value="' + val.slice(0, 10) + '">';
      case 'datetime':
        return '<input type="datetime-local"' + id + name + cls + req + ro + dis + extra
          + ' value="' + (val.length >= 16 ? val.slice(0, 16) : val) + '">';
      case 'color':
        return '<input type="color"' + id + name + cls + req + ro + dis + extra
          + ' value="' + (/^#[0-9a-fA-F]{6}$/.test(val) ? val : '#000000') + '">';
      case 'textarea':
        return '<textarea rows="3"' + id + name + cls + req + ro + dis + extra + '>'
          + val + '</textarea>';
      case 'url':
        return '<input type="url" placeholder="https://"' + id + name + cls + req + ro + dis + extra
          + ' value="' + val + '">';
      case 'image':
        return '<input type="url" placeholder="URL de l’image"' + id + name + cls + req + ro + dis + extra
          + ' value="' + val + '">';
      case 'file':
        return '<input type="url" placeholder="URL du fichier"' + id + name + cls + req + ro + dis + extra
          + ' value="' + val + '">';
      case 'secret':
        return '<input type="password" autocomplete="new-password"' + id + name + cls + req + ro + dis + extra
          + ' value="' + val + '">';
      case 'enum': {
        var opts = Array.isArray(attrs.enum) ? attrs.enum : [];
        var html = '<select' + id + name + cls + req + ro + dis + extra + '>';
        if (!attrs.required) html += '<option value="">—</option>';
        opts.forEach(function (opt) {
          html += '<option value="' + escapeAttr(opt) + '"' + (String(val) === String(opt) ? ' selected' : '') + '>'
            + escapeHtml(opt) + '</option>';
        });
        html += '</select>';
        return html;
      }
      default:
        return '<input type="text"' + id + name + cls + req + ro + dis + extra
          + ' value="' + val + '">';
    }
  }

  function createInput(type, value) {
    var wrap = document.createElement('div');
    wrap.innerHTML = inputHtml(type, { value: value });
    return wrap.firstElementChild;
  }

  function parseValue(type, raw) {
    var t = normalizeType(type);
    if (t === 'number') {
      if (raw === '' || raw == null) return null;
      var n = parseFloat(raw);
      return Number.isFinite(n) ? n : null;
    }
    if (t === 'boolean') {
      if (raw === '' || raw == null) return null;
      return raw === 'true' || raw === true;
    }
    if (t === 'array' || t === 'enum') {
      if (Array.isArray(raw)) return raw;
      return raw;
    }
    return raw;
  }

  function enumLabel(field, opt) {
    if (field && field.enumLabels && field.enumLabels[opt] != null) return String(field.enumLabels[opt]);
    return String(opt);
  }

  function formGroupHtml(field, value) {
    field = normalizeField(field);
    if (!field) return '';
    var key = field.key;
    var title = field.label + (field.required ? ' *' : '');
    var desc = field.description
      ? '<p class="text-muted small" style="margin-top:0.35rem;">' + escapeHtml(field.description) + '</p>'
      : '';
    var req = field.required ? ' required' : '';
    var html = '<div class="form-group" data-field-key="' + escapeAttr(key) + '" data-field-type="' + escapeAttr(field.type) + '">';

    if (field.type === 'boolean') {
      var on = value !== false && value !== 'false' && value !== 0 && value !== '0';
      if (value == null && field.default === false) on = false;
      html += '<label><input type="checkbox" data-setting="' + escapeAttr(key) + '"' + (on ? ' checked' : '') + '> '
        + escapeHtml(title) + '</label>' + desc;
      html += '</div>';
      return html;
    }

    html += '<label for="setting_' + escapeAttr(key) + '">' + escapeHtml(title) + '</label>';

    if (field.type === 'enum' && field.multiple) {
      var selected = Array.isArray(value) ? value.map(String) : [];
      (field.enum || []).forEach(function (opt) {
        var checked = selected.indexOf(String(opt)) !== -1;
        html += '<label style="display:flex;gap:8px;align-items:center;font-weight:400;margin:6px 0;">'
          + '<input type="checkbox" data-setting="' + escapeAttr(key) + '" data-multiple="1" value="' + escapeAttr(opt) + '"'
          + (checked ? ' checked' : '') + '> ' + escapeHtml(enumLabel(field, opt)) + '</label>';
      });
      html += desc + '</div>';
      return html;
    }

    if (field.type === 'enum') {
      html += '<select id="setting_' + escapeAttr(key) + '" class="form-control" data-setting="' + escapeAttr(key) + '"' + req + '>';
      if (!field.required) html += '<option value="">—</option>';
      (field.enum || []).forEach(function (opt) {
        html += '<option value="' + escapeAttr(opt) + '"' + (String(value) === String(opt) ? ' selected' : '') + '>'
          + escapeHtml(enumLabel(field, opt)) + '</option>';
      });
      html += '</select>' + desc + '</div>';
      return html;
    }

    if (field.type === 'connection') {
      html += '<select id="setting_' + escapeAttr(key) + '" class="form-control" data-setting="' + escapeAttr(key) + '"'
        + ' data-connection="1" data-connection-source="' + escapeAttr(field.connectionSource || '') + '"'
        + (field.connectorId ? ' data-connector-id="' + escapeAttr(field.connectorId) + '"' : '')
        + req + '>';
      html += '<option value="">Chargement…</option></select>' + desc + '</div>';
      return html;
    }

    if (field.type === 'array') {
      var list = Array.isArray(value) ? value.join(', ') : (value == null ? '' : String(value));
      html += '<input type="text" id="setting_' + escapeAttr(key) + '" class="form-control" data-setting="' + escapeAttr(key) + '"'
        + ' data-array="1" placeholder="valeurs séparées par des virgules" value="' + escapeAttr(list) + '"' + req + '>';
      html += desc + '</div>';
      return html;
    }

    var attrs = {
      id: 'setting_' + key,
      extra: ' data-setting="' + escapeAttr(key) + '"' + req
        + (field.min != null ? ' min="' + field.min + '"' : '')
        + (field.max != null ? ' max="' + field.max + '"' : '')
        + (field.placeholder ? ' placeholder="' + escapeAttr(field.placeholder) + '"' : ''),
      required: field.required,
      value: value != null ? value : (field.default != null ? field.default : ''),
      enum: field.enum
    };
    html += inputHtml(field.type, attrs) + desc + '</div>';
    return html;
  }

  function mount(container, fields, values) {
    if (!container) return [];
    var list = (fields || []).map(normalizeField).filter(Boolean);
    var data = values && typeof values === 'object' ? values : {};
    container.innerHTML = list.map(function (field) {
      var val = Object.prototype.hasOwnProperty.call(data, field.key) ? data[field.key] : field.default;
      return formGroupHtml(field, val);
    }).join('');
    return list;
  }

  function collect(container, fields) {
    var settings = {};
    if (!container) return settings;
    var list = (fields || []).map(normalizeField).filter(Boolean);
    var byKey = {};
    list.forEach(function (f) { byKey[f.key] = f; });

    container.querySelectorAll('[data-setting]').forEach(function (el) {
      var key = el.getAttribute('data-setting');
      if (!key) return;
      var field = byKey[key] || { key: key, type: 'text' };
      if (el.getAttribute('data-multiple') === '1') {
        if (!Array.isArray(settings[key])) settings[key] = [];
        if (el.checked) settings[key].push(el.value);
        return;
      }
      if (el.type === 'checkbox') {
        settings[key] = el.checked;
        return;
      }
      if (el.type === 'number' || field.type === 'number') {
        if (el.value === '') {
          settings[key] = field.default != null ? field.default : null;
        } else {
          settings[key] = Number(el.value);
        }
        return;
      }
      if (el.getAttribute('data-array') === '1' || field.type === 'array') {
        settings[key] = String(el.value || '').split(',').map(function (v) { return v.trim(); }).filter(Boolean);
        return;
      }
      settings[key] = String(el.value || '').trim();
    });
    return settings;
  }

  function fillConnectionSelect(select, options, selected) {
    if (!select) return;
    var cur = selected != null ? String(selected) : String(select.getAttribute('data-current') || select.value || '');
    var html = '<option value="">— Choisir —</option>';
    (options || []).forEach(function (opt) {
      var id = String(opt.id || opt.value || '');
      var label = String(opt.label || opt.name || id);
      html += '<option value="' + escapeAttr(id) + '"' + (cur === id ? ' selected' : '') + '>'
        + escapeHtml(label) + '</option>';
    });
    if (cur && !(options || []).some(function (opt) { return String(opt.id || opt.value) === cur; })) {
      html += '<option value="' + escapeAttr(cur) + '" selected>' + escapeHtml(cur) + '</option>';
    }
    select.innerHTML = html;
    if (cur) select.value = cur;
  }

  global.COLLECTION_FIELD_TYPES = TYPES;
  global.CollectionFieldTypes = {
    list: TYPES,
    contractTypes: CONTRACT_TYPES,
    allTypes: allTypes,
    labels: labels,
    optionsHtml: optionsHtml,
    fillSelect: fillSelect,
    inputHtml: inputHtml,
    createInput: createInput,
    parseValue: parseValue,
    normalizeType: normalizeType,
    normalizeField: normalizeField,
    formGroupHtml: formGroupHtml,
    mount: mount,
    collect: collect,
    fillConnectionSelect: fillConnectionSelect
  };
})(window);
