// src/modules/editor/templateBuilder/components/rightPanel/ImageTab.js

// Charger le CSS
(function loadCSS() {
  if (!document.getElementById('image-tab-styles')) {
    const link = document.createElement('link');
    link.id = 'image-tab-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/templateBuilder/components/rightPanel/ImageTab.css';
    document.head.appendChild(link);
  }
})();

export default class ImageTab {
  constructor({ template, onTemplateChange }) {
    this.template = template;
    this.onTemplateChange = onTemplateChange;
    this.imageStyles = template?.imageStyles || [];
    this.expandedStyles = {}; // Pour suivre quels styles sont déroulés
  }

  render(container) {
    this.container = container;
    this.container.className = 'image-tab';
    this.container.innerHTML = '';

    // Titre
    const title = document.createElement('h3');
    title.textContent = 'Styles d\'image';
    this.container.appendChild(title);

    // Liste des styles existants
    const stylesList = document.createElement('div');
    stylesList.className = 'image-styles-list';
    this.container.appendChild(stylesList);

    // Afficher les styles existants
    this.renderStylesList(stylesList);

    // Section pour créer un nouveau style
    this.createNewStyleSection(stylesList);
  }

  createNewStyleSection(parent) {
    const newStyleGroup = document.createElement('div');
    newStyleGroup.className = 'image-style-group new-style';

    // Champ nom
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'image-style-name-input';
    nameInput.placeholder = 'Nom du style (ex: Image arrondie avec ombre)';
    nameInput.oninput = () => {
      const name = nameInput.value.trim();
      if (name && !submenu.style.display || submenu.style.display === 'none') {
        // Dérrouler automatiquement quand le nom est complété
        submenu.style.display = 'block';
        toggleButton.querySelector('.toggle-icon').textContent = '▼';
        this.expandedStyles['new'] = true;
      }
    };

    // Bouton toggle (initialement caché)
    const toggleButton = document.createElement('button');
    toggleButton.className = 'image-style-toggle';
    toggleButton.innerHTML = `<span class="toggle-icon">▶</span>`;
    toggleButton.style.display = 'none';
    toggleButton.onclick = () => {
      const isExpanded = this.expandedStyles['new'] || false;
      this.expandedStyles['new'] = !isExpanded;
      submenu.style.display = this.expandedStyles['new'] ? 'block' : 'none';
      toggleButton.querySelector('.toggle-icon').textContent = this.expandedStyles['new'] ? '▼' : '▶';
    };

    // Sous-menu déroulant
    const submenu = document.createElement('div');
    submenu.className = 'image-style-submenu';
    submenu.style.display = 'none';

    // Créer les contrôles dans le sous-menu
    this.createStyleControls(submenu, null, (styleData) => {
      // Sauvegarder le nouveau style
      const newStyle = {
        name: nameInput.value.trim(),
        ...styleData
      };
      this.imageStyles.push(newStyle);
      this.saveStyles();
      // Réinitialiser le formulaire
      nameInput.value = '';
      submenu.style.display = 'none';
      toggleButton.style.display = 'none';
      this.expandedStyles['new'] = false;
      toggleButton.querySelector('.toggle-icon').textContent = '▶';
      // Re-rendre la liste
      this.renderStylesList(parent);
    });

    newStyleGroup.appendChild(nameInput);
    newStyleGroup.appendChild(toggleButton);
    newStyleGroup.appendChild(submenu);
    parent.appendChild(newStyleGroup);
  }

  renderStylesList(container) {
    // Garder la section "nouveau style" si elle existe
    const existingNewStyle = container.querySelector('.new-style');
    container.innerHTML = '';
    if (existingNewStyle) {
      container.appendChild(existingNewStyle);
    }

    if (this.imageStyles.length === 0 && !existingNewStyle) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'Aucun style d\'image défini. Créez-en un nouveau ci-dessous.';
      container.appendChild(emptyMessage);
    }

    this.imageStyles.forEach((style, index) => {
      const styleGroup = document.createElement('div');
      styleGroup.className = 'image-style-group';

      // Champ nom (éditable)
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'image-style-name-input';
      nameInput.value = style.name || `Style ${index + 1}`;
      nameInput.oninput = () => {
        style.name = nameInput.value.trim();
        this.saveStyles();
      };
      styleGroup.appendChild(nameInput);

      // Bouton toggle
      const toggleButton = document.createElement('button');
      toggleButton.className = 'image-style-toggle';
      const isExpanded = this.expandedStyles[index] || false;
      toggleButton.innerHTML = `<span class="toggle-icon">${isExpanded ? '▼' : '▶'}</span>`;
      toggleButton.onclick = () => {
        this.expandedStyles[index] = !this.expandedStyles[index];
        submenu.style.display = this.expandedStyles[index] ? 'block' : 'none';
        toggleButton.querySelector('.toggle-icon').textContent = this.expandedStyles[index] ? '▼' : '▶';
      };
      styleGroup.appendChild(toggleButton);

      // Bouton supprimer
      const deleteButton = document.createElement('button');
      deleteButton.className = 'image-style-delete';
      deleteButton.textContent = '🗑️';
      deleteButton.title = 'Supprimer';
      deleteButton.onclick = () => {
        if (confirm('Supprimer ce style ?')) {
          this.imageStyles.splice(index, 1);
          this.saveStyles();
          this.renderStylesList(container);
        }
      };
      styleGroup.appendChild(deleteButton);

      // Sous-menu déroulant
      const submenu = document.createElement('div');
      submenu.className = 'image-style-submenu';
      submenu.style.display = isExpanded ? 'block' : 'none';

      // Créer les contrôles
      this.createStyleControls(submenu, style, (styleData) => {
        // Mettre à jour le style existant
        Object.assign(style, styleData);
        this.saveStyles();
      });

      styleGroup.appendChild(submenu);
      container.appendChild(styleGroup);
    });
  }

  createStyleControls(container, existingStyle, onUpdate) {
    container.innerHTML = '';

    const styleData = existingStyle || {
      borderRadius: '0',
      boxShadow: 'none',
      border: 'none',
      opacity: 1
    };

    // Aperçu
    const previewLabel = document.createElement('label');
    previewLabel.textContent = 'Aperçu';
    previewLabel.className = 'image-style-label';
    container.appendChild(previewLabel);

    const preview = document.createElement('div');
    preview.className = 'image-style-preview';
    this.updatePreview(preview, styleData);
    container.appendChild(preview);

    // Border Radius
    const borderRadiusLabel = document.createElement('label');
    borderRadiusLabel.textContent = 'Arrondi';
    borderRadiusLabel.className = 'image-style-label';
    container.appendChild(borderRadiusLabel);

    const borderRadiusGroup = document.createElement('div');
    borderRadiusGroup.className = 'image-style-presets-group';

    // Presets pour border-radius
    const borderRadiusPresets = [
      { label: 'Aucun', value: '0' },
      { label: 'Petit', value: '4px' },
      { label: 'Moyen', value: '8px' },
      { label: 'Grand', value: '16px' },
      { label: 'Rond', value: '50%' }
    ];

    borderRadiusPresets.forEach(preset => {
      const button = document.createElement('button');
      button.className = 'image-style-preset-button';
      button.textContent = preset.label;
      if (styleData.borderRadius === preset.value) {
        button.classList.add('active');
      }
      button.onclick = () => {
        borderRadiusGroup.querySelectorAll('.image-style-preset-button').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        styleData.borderRadius = preset.value;
        customBorderRadiusButton.textContent = preset.value;
        customBorderRadiusButton.style.borderRadius = preset.value;
        const numMatch = preset.value.match(/(\d+)px/);
        if (numMatch) {
          customBorderRadiusSlider.value = numMatch[1];
        } else if (preset.value === '50%') {
          customBorderRadiusSlider.value = 50;
        } else {
          customBorderRadiusSlider.value = 0;
        }
        this.updatePreview(preview, styleData);
        onUpdate(styleData);
      };
      borderRadiusGroup.appendChild(button);
    });

    // Bouton personnalisé avec valeur + slider
    const customBorderRadiusContainer = document.createElement('div');
    customBorderRadiusContainer.className = 'image-style-custom-group';

    // Bouton qui affiche la valeur (non éditable)
    const customBorderRadiusButton = document.createElement('button');
    customBorderRadiusButton.className = 'image-style-custom-button';
    customBorderRadiusButton.textContent = styleData.borderRadius || '0';
    customBorderRadiusButton.title = 'Valeur personnalisée (ajustable avec le slider)';
    
    const customBorderRadiusSlider = document.createElement('input');
    customBorderRadiusSlider.type = 'range';
    customBorderRadiusSlider.className = 'image-style-custom-slider';
    customBorderRadiusSlider.min = 0;
    customBorderRadiusSlider.max = 50;
    customBorderRadiusSlider.value = parseInt(styleData.borderRadius) || 0;
    
    // Fonction pour vérifier si la valeur correspond à un preset
    const checkPresetMatch = (value) => {
      // Retirer tous les actifs d'abord
      borderRadiusGroup.querySelectorAll('.image-style-preset-button').forEach(b => b.classList.remove('active'));
      
      // Chercher si la valeur correspond à un preset
      const matchingPreset = borderRadiusPresets.find(p => {
        if (p.value === value) return true;
        // Vérifier aussi si c'est une valeur en px qui correspond
        const numMatch = value.match(/(\d+)px/);
        if (numMatch) {
          const presetNumMatch = p.value.match(/(\d+)px/);
          if (presetNumMatch && presetNumMatch[1] === numMatch[1]) return true;
        }
        return false;
      });
      
      if (matchingPreset) {
        // Trouver le bouton correspondant et l'activer
        const presetButtons = borderRadiusGroup.querySelectorAll('.image-style-preset-button');
        const presetIndex = borderRadiusPresets.findIndex(p => p.value === matchingPreset.value);
        if (presetIndex >= 0 && presetButtons[presetIndex]) {
          presetButtons[presetIndex].classList.add('active');
        }
      }
    };
    
    // Mettre à jour le bouton et le style quand on bouge le slider
    customBorderRadiusSlider.oninput = () => {
      const value = customBorderRadiusSlider.value + 'px';
      customBorderRadiusButton.textContent = value;
      styleData.borderRadius = value;
      // Appliquer en direct sur le bouton personnalisé pour voir l'effet
      customBorderRadiusButton.style.borderRadius = value;
      
      // Vérifier si la valeur correspond à un preset
      checkPresetMatch(value);
      
      this.updatePreview(preview, styleData);
      onUpdate(styleData);
    };
    
    // Vérifier aussi quand on relâche le slider (pour les valeurs exactes)
    customBorderRadiusSlider.onchange = () => {
      const value = customBorderRadiusSlider.value + 'px';
      checkPresetMatch(value);
    };

    // Appliquer la valeur initiale au bouton
    customBorderRadiusButton.style.borderRadius = styleData.borderRadius || '0';
    
    // Vérifier la correspondance initiale
    checkPresetMatch(styleData.borderRadius || '0');

    customBorderRadiusContainer.appendChild(customBorderRadiusButton);
    customBorderRadiusContainer.appendChild(customBorderRadiusSlider);
    borderRadiusGroup.appendChild(customBorderRadiusContainer);
    container.appendChild(borderRadiusGroup);

    // Box Shadow (Ombres)
    const boxShadowLabel = document.createElement('label');
    boxShadowLabel.textContent = 'Ombre';
    boxShadowLabel.className = 'image-style-label';
    container.appendChild(boxShadowLabel);

    const boxShadowGroup = document.createElement('div');
    boxShadowGroup.className = 'image-style-presets-group';

    // Presets d'ombres
    const shadowPresets = [
      { label: 'Aucune', value: 'none' },
      { label: 'Légère', value: 'rgba(99, 99, 99, 0.2) 0px 2px 8px 0px' },
      { label: 'Moyenne', value: 'rgba(0, 0, 0, 0.16) 0px 1px 4px, rgb(51, 51, 51) 0px 0px 0px 3px' },
      { label: 'Profonde', value: 'rgba(50, 50, 93, 0.25) 0px 50px 100px -20px, rgba(0, 0, 0, 0.3) 0px 30px 60px -30px, rgba(10, 37, 64, 0.35) 0px -2px 6px 0px inset' },
      { label: 'Intérieure', value: 'rgba(50, 50, 93, 0.25) 0px 30px 60px -12px inset, rgba(0, 0, 0, 0.3) 0px 18px 36px -18px inset' },
      { label: 'Douce', value: 'rgba(0, 0, 0, 0.15) 2.4px 2.4px 3.2px' },
      { label: 'Élevée', value: 'rgba(0, 0, 0, 0.4) 0px 2px 4px, rgba(0, 0, 0, 0.3) 0px 7px 13px -3px, rgba(0, 0, 0, 0.2) 0px -3px 0px inset' },
      { label: 'Complexe', value: 'rgba(0, 0, 0, 0.17) 0px -23px 25px 0px inset, rgba(0, 0, 0, 0.15) 0px -36px 30px 0px inset, rgba(0, 0, 0, 0.1) 0px -79px 40px 0px inset, rgba(0, 0, 0, 0.06) 0px 2px 1px, rgba(0, 0, 0, 0.09) 0px 4px 2px, rgba(0, 0, 0, 0.09) 0px 8px 4px, rgba(0, 0, 0, 0.09) 0px 16px 8px, rgba(0, 0, 0, 0.09) 0px 32px 16px' }
    ];

    shadowPresets.forEach(preset => {
      const button = document.createElement('button');
      button.className = 'image-style-preset-button shadow-preset';
      button.textContent = preset.label;
      // Appliquer la box-shadow au bouton pour prévisualisation
      if (preset.value !== 'none') {
        button.style.boxShadow = preset.value;
      }
      if (styleData.boxShadow === preset.value || (!styleData.boxShadow && preset.value === 'none')) {
        button.classList.add('active');
      }
      button.onclick = () => {
        shadowPresets.forEach((p, i) => {
          const btn = boxShadowGroup.querySelectorAll('.shadow-preset')[i];
          if (btn) btn.classList.remove('active');
        });
        button.classList.add('active');
        styleData.boxShadow = preset.value;
        this.updatePreview(preview, styleData);
        onUpdate(styleData);
      };
      boxShadowGroup.appendChild(button);
    });

    container.appendChild(boxShadowGroup);

    // Opacité
    const opacityLabel = document.createElement('label');
    opacityLabel.textContent = 'Opacité';
    opacityLabel.className = 'image-style-label';
    container.appendChild(opacityLabel);

    const opacityGroup = document.createElement('div');
    opacityGroup.className = 'image-style-opacity-group';

    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.className = 'image-style-opacity-slider';
    opacitySlider.min = 0;
    opacitySlider.max = 100;
    opacitySlider.value = (styleData.opacity || 1) * 100;

    const opacityValue = document.createElement('span');
    opacityValue.className = 'image-style-opacity-value';
    opacityValue.textContent = Math.round((styleData.opacity || 1) * 100) + '%';

    opacitySlider.oninput = () => {
      const value = opacitySlider.value / 100;
      styleData.opacity = value;
      opacityValue.textContent = Math.round(value * 100) + '%';
      this.updatePreview(preview, styleData);
      onUpdate(styleData);
    };

    opacityGroup.appendChild(opacitySlider);
    opacityGroup.appendChild(opacityValue);
    container.appendChild(opacityGroup);
  }

  updatePreview(element, style) {
    element.style.width = '100px';
    element.style.height = '100px';
    element.style.backgroundColor = '#ddd';
    element.style.display = 'block';
    element.style.margin = '10px auto';
    
    if (style.borderRadius && style.borderRadius !== '0' && style.borderRadius !== 'none') {
      element.style.borderRadius = style.borderRadius;
    } else {
      element.style.borderRadius = '0';
    }
    
    if (style.boxShadow && style.boxShadow !== 'none') {
      element.style.boxShadow = style.boxShadow;
    } else {
      element.style.boxShadow = 'none';
    }
    
    if (style.border && style.border !== 'none') {
      element.style.border = style.border;
    } else {
      element.style.border = 'none';
    }
    
    if (style.opacity !== undefined) {
      element.style.opacity = style.opacity;
    } else {
      element.style.opacity = 1;
    }
  }

  saveStyles() {
    // Mettre à jour le template
    if (this.onTemplateChange) {
      this.onTemplateChange({
        imageStyles: this.imageStyles
      });
    }
  }

  setTemplate(template) {
    this.template = template;
    this.imageStyles = template?.imageStyles || [];
    if (this.container) {
      this.render(this.container);
    }
  }

  getStyles() {
    return this.imageStyles;
  }
}
