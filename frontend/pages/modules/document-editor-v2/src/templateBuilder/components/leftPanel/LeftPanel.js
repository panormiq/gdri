// src/modules/editor/templateBuilder/components/leftPanel/LeftPanel.js
import { formatHierarchicalNumbering } from '../../utils/numberingUtils.js';
import { flattenSections, extractSectionFromHierarchy, insertSectionInHierarchy } from '../../utils/sectionHierarchy.js';

// Charger le CSS
import loadCSS from '../../../utils/loadCSS.js';
loadCSS('templateBuilder/components/leftPanel/LeftPanel.css', 'left-panel-styles');

export default class LeftPanel {
  constructor({ template, onSectionSelect, onSectionReorder }) {
    this.template = template;
    this.onSectionSelect = onSectionSelect;
    this.onSectionReorder = onSectionReorder;
    this.collapsed = false;
    this.selectedSectionId = null;
    this.wasDragging = false; // Flag pour détecter si un drag a eu lieu
  }

  render(container) {
    this.container = container;
    this.container.classList.add('left-panel');
    
    this.container.innerHTML = '';

    // Bouton pour réduire/agrandir
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'left-panel-toggle';
    toggleBtn.textContent = this.collapsed ? '▶' : '◀';
    toggleBtn.onclick = () => this.toggleCollapse();
    this.container.appendChild(toggleBtn);

    if (!this.collapsed) {
      // Titre
      const title = document.createElement('h3');
      title.className = 'left-panel-title';
      title.textContent = 'Sections';
      this.container.appendChild(title);

      // Liste des sections
      this.sectionsContainer = document.createElement('div');
      this.sectionsContainer.className = 'left-panel-sections';
      this.container.appendChild(this.sectionsContainer);

      // TOC Annexes
      const annexesTitle = document.createElement('h4');
      annexesTitle.className = 'left-panel-title';
      annexesTitle.textContent = 'Annexes';
      this.container.appendChild(annexesTitle);

      this.annexesContainer = document.createElement('div');
      this.annexesContainer.className = 'left-panel-annexes';
      this.container.appendChild(this.annexesContainer);

      this.renderSections();
    }
  }

  renderSections() {
    if (!this.sectionsContainer || !this.template || !this.template.structure) return;

    this.sectionsContainer.innerHTML = '';

    const sections = this.template.structure.sections || [];
    
    // Aplatir la hiérarchie pour obtenir une liste plate avec les chemins
    const flatList = flattenSections(sections);
    
    flatList.forEach(({ section, path }) => {
      const sectionEl = this.createSectionElement(section, path);
      this.sectionsContainer.appendChild(sectionEl);
    });

    // TODO: Ajouter drag & drop pour réordonner
  }

  createSectionElement(section, path) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'left-panel-section';
    sectionDiv.dataset.sectionId = section.id;
    sectionDiv.draggable = true;
    
    if (this.selectedSectionId === section.id) {
      sectionDiv.classList.add('active');
    }

    // Indentation selon le niveau (h1 = 0, h2 = 1, h3 = 2)
    const indentLevel = (section.level || 1) - 1;
    if (indentLevel > 0) {
      sectionDiv.style.paddingLeft = `${indentLevel * 20}px`;
    }
    
    // Numérotation hiérarchique
    const numberingType = this.template?.generalStyles?.numbering?.type || 'numeric';
    const numberingCustom = this.template?.generalStyles?.numbering?.custom || '{n}.';
    const numberSpan = document.createElement('span');
    numberSpan.className = 'section-number';
    numberSpan.textContent = formatHierarchicalNumbering(path, numberingType, numberingCustom);
    
    // Titre (on supprime le typeSpan)
    const titleSpan = document.createElement('span');
    titleSpan.className = 'section-title';
    titleSpan.textContent = section.title || 'Sans titre';

    sectionDiv.appendChild(numberSpan);
    sectionDiv.appendChild(titleSpan);

    // Gestion drag & drop
    sectionDiv.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', section.id);
      e.dataTransfer.effectAllowed = 'move';
      sectionDiv.classList.add('dragging');
      this.draggedSectionId = section.id;
      this.wasDragging = true;
    };

    // Click pour sélectionner (seulement si pas de drag)
    sectionDiv.onclick = (e) => {
      // Ne pas sélectionner si on vient de faire un drag
      if (!this.wasDragging) {
        this.selectSection(section.id);
      }
      // Reset le flag après un court délai pour permettre le click suivant
      setTimeout(() => {
        this.wasDragging = false;
      }, 100);
    };

    sectionDiv.ondragend = () => {
      sectionDiv.classList.remove('dragging');
      // Nettoyer les classes de drop
      const sections = this.sectionsContainer.querySelectorAll('.left-panel-section');
      sections.forEach(s => {
        s.classList.remove('drag-over');
      });
      this.draggedSectionId = null;
      // Le flag wasDragging reste true jusqu'à ce que le onclick le réinitialise
    };

    sectionDiv.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      // Ajouter classe visuelle
      if (e.currentTarget.dataset.sectionId !== this.draggedSectionId) {
        e.currentTarget.classList.add('drag-over');
      }
    };

    sectionDiv.ondragleave = (e) => {
      e.currentTarget.classList.remove('drag-over');
    };

    sectionDiv.ondrop = (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = e.currentTarget.dataset.sectionId;
      
      if (draggedId && targetId && draggedId !== targetId) {
        this.reorderSections(draggedId, targetId);
      }
    };

    return sectionDiv;
  }
  
  reorderSections(draggedId, targetId) {
    if (!this.template || !this.template.structure) return;
    
    const hierarchy = [...this.template.structure.sections || []]; // Copie profonde
    
    // Extraire la section déplacée avec toutes ses sous-sections
    const extracted = extractSectionFromHierarchy(hierarchy, draggedId);
    
    if (!extracted) {
      console.warn('⚠️ Section déplacée non trouvée:', draggedId);
      return;
    }
    
    // Si on déplace vers la même position, ne rien faire
    if (extracted.section.id === targetId) {
      return;
    }
    
    // Insérer la section (avec toutes ses sous-sections) à la nouvelle position
    // insertSectionInHierarchy va insérer juste avant la section cible
    const inserted = insertSectionInHierarchy(hierarchy, targetId, extracted.section);
    
    if (!inserted) {
      console.warn('⚠️ Section cible non trouvée:', targetId);
      // Si l'insertion a échoué, remettre la section à sa place originale
      if (extracted.parentList) {
        extracted.parentList.splice(extracted.index, 0, extracted.section);
      }
      return;
    }
    
    // Mettre à jour la structure
    this.template.structure.sections = hierarchy;
    
    // Notifier le parent
    if (this.onSectionReorder) {
      this.onSectionReorder(hierarchy);
    }
    
    // Re-render avec la nouvelle numérotation
    this.renderSections();
  }

  selectSection(sectionId, notify = true) {
    this.selectedSectionId = sectionId;
    this.renderSections(); // Re-render pour mettre à jour la classe active
    
    // Ne notifier le parent que si notify est true (pour éviter les boucles)
    if (notify && this.onSectionSelect) {
      this.onSectionSelect(sectionId);
    }
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.render(this.container);
    
    // Ajouter classe au container parent pour CSS
    const parent = this.container.parentElement;
    if (parent) {
      if (this.collapsed) {
        parent.classList.add('collapsed');
      } else {
        parent.classList.remove('collapsed');
      }
    }
  }

  setTemplate(template) {
    this.template = template;
    if (!this.collapsed) {
      this.renderSections();
    }
  }
}

