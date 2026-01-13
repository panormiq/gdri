export default class FieldRenderer {

  static renderSchema({ field, container, coreFields, baseTypeData, typeData }) {
    if (!field || !container || !coreFields) return;

    container.innerHTML = '';

    /* =========================
       CORE FIELDS
    ========================= */
    Object.entries(coreFields).forEach(([key, def]) => {
      const value = field.core[key] ?? def.defaultValue ?? '';
      const group = document.createElement('div');
      group.className = 'form-group';

      let input;

      switch (def.type) {
        case 'boolean':
          input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = Boolean(value);
          input.addEventListener('change', e => {
            field.core[key] = e.target.checked;
          });
          break;

        case 'number':
          input = document.createElement('input');
          input.type = 'number';
          input.value = value ?? '';
          input.addEventListener('input', e => {
            field.core[key] = e.target.value === '' ? null : Number(e.target.value);
          });
          break;

        default:
          input = document.createElement('input');
          input.type = 'text';
          input.value = value;
          input.addEventListener('input', e => {
            field.core[key] = e.target.value;
          });
      }

      const label = document.createElement('label');
      label.textContent = def.label || key;

      group.append(label, input);
      container.appendChild(group);
    });

    /* =========================
       VALIDATION (BASE TYPE)
    ========================= */
    if (baseTypeData?.validation) {
      this.renderValidation(container, field, baseTypeData.validation);
    }

    /* =========================
       VALIDATION (TYPE OVERRIDE)
    ========================= */
    if (typeData?.validation) {
      this.renderValidation(container, field, typeData.validation);
    }
  }

  static renderValidation(container, field, validations) {
    Object.entries(validations).forEach(([key, rule]) => {
      if (!rule) return;

      field.validation[key] ??= structuredClone(rule);

      const group = document.createElement('div');
      group.className = 'form-group';

      let input;

      switch (rule.type) {
        case 'boolean':
          input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = Boolean(field.validation[key].value);
          input.addEventListener('change', e => {
            field.validation[key].value = e.target.checked;
          });
          break;

        case 'number':
          input = document.createElement('input');
          input.type = 'number';
          input.value = field.validation[key].value ?? '';
          input.addEventListener('input', e => {
            field.validation[key].value =
              e.target.value === '' ? null : Number(e.target.value);
          });
          break;

        case 'array':
          input = document.createElement('input');
          input.type = 'text';
          input.value = (field.validation[key].value || []).join(',');
          input.addEventListener('input', e => {
            field.validation[key].value = e.target.value
              .split(',')
              .map(v => v.trim())
              .filter(Boolean);
          });
          break;

        default:
          input = document.createElement('input');
          input.type = 'text';
          input.value = field.validation[key].value ?? '';
          input.addEventListener('input', e => {
            field.validation[key].value = e.target.value;
          });
      }

      const label = document.createElement('label');
      label.textContent = rule.label || key;

      group.append(label, input);
      container.appendChild(group);
    });
  }
}
