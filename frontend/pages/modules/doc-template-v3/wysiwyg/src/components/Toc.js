console.log('📄 FICHIER CHARGÉ: Toc.js');

/**
 * TOC - Table des matières avec numérotation et navigation
 */

export class TOC {
  constructor(containerEl) {
    this.container = containerEl;
    this.onSectionClick = null;
    this.sections = [];
    this.init();
  }

  init() {
    this.container.className = 'wysiwyg-toc';
    
    const title = document.createElement('h3');
    title.textContent = 'Table des matières';
    title.className = 'toc-title';
    this.container.appendChild(title);

    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';
    tocList.id = 'toc-list';
    this.container.appendChild(tocList);
  }

  render(sections, numbering = null) {
    this.sections = sections;
    const tocList = this.container.querySelector('#toc-list');
    if (!tocList) return;

    tocList.innerHTML = '';

    // Extraire toutes les sections de manière récursive
    const allSections = this.extractAllSections(sections);
    
    // Parcourir les sections
    allSections.forEach(section => {
      // Ignorer les sections sans titre
      if (section.titre === null && section.titre !== '') {
        return;
      }

      const li = document.createElement('li');
      li.className = `toc-item niveau-${section.niveau || 1}`;
      li.dataset.sectionId = section.id;

      // Numéro de section
      const number = numbering && numbering[section.id] ? `${numbering[section.id]} ` : '';
      
      // Titre cliquable
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'toc-link';
      link.innerHTML = `<span class="toc-number">${number}</span><span class="toc-title">${section.titre || 'Sans titre'}</span>`;
      
      link.onclick = (e) => {
        e.preventDefault();
        if (this.onSectionClick) {
          this.onSectionClick(section.id);
        }
      };

      li.appendChild(link);
      tocList.appendChild(li);
    });
  }

  extractAllSections(contentJson, level = 0) {
    const allSections = [];
    
    if (!contentJson) return [];

    // Si c'est un tableau de sections
    if (Array.isArray(contentJson)) {
      contentJson.forEach(item => {
        if (item.id && (item.titre !== undefined || item.titre === null)) {
          allSections.push({
            ...item,
            niveau: item.niveau || level + 1
          });
        }
        
        // Extraire les sous-sections récursivement
        if (item.content && Array.isArray(item.content)) {
          const subSections = this.extractAllSections(item.content, item.niveau || level + 1);
          allSections.push(...subSections);
        }
      });
    } 
    // Si c'est un objet avec une propriété sections
    else if (contentJson.sections && Array.isArray(contentJson.sections)) {
      return this.extractAllSections(contentJson.sections, level);
    }
    // Si c'est une section unique
    else if (contentJson.id) {
      allSections.push({
        ...contentJson,
        niveau: contentJson.niveau || level + 1
      });
      
      if (contentJson.content && Array.isArray(contentJson.content)) {
        const subSections = this.extractAllSections(contentJson.content, contentJson.niveau || level + 1);
        allSections.push(...subSections);
      }
    }

    return allSections;
  }


  updateNumbering(numbering) {
    // Mettre à jour les numéros dans le TOC
    const tocItems = this.container.querySelectorAll('.toc-item');
    tocItems.forEach(item => {
      const sectionId = item.dataset.sectionId;
      const numberSpan = item.querySelector('.toc-number');
      if (numberSpan && numbering && numbering[sectionId]) {
        numberSpan.textContent = `${numbering[sectionId]} `;
      }
    });
  }

  highlightSection(sectionId) {
    // Retirer le highlight de tous les items
    this.container.querySelectorAll('.toc-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Ajouter le highlight à l'item sélectionné
    const item = this.container.querySelector(`[data-section-id="${sectionId}"]`);
    if (item) {
      item.classList.add('active');
    }
  }
}

