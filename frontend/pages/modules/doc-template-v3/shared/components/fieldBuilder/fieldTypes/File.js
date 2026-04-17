// src/modules/editor/collection/FieldTypes/File.js
// Import dynamique pour éviter les problèmes de résolution lors du chargement dynamique du module
// On chargera documentApi seulement quand nécessaire (dans renderDocumentSelector)

export default class FileField {
  constructor({ field, value, onChange, collectionId = null }) {
    this.field = field;
    // Nettoyer les URLs blob dans la valeur initiale
    this.value = this.cleanBlobUrls(value) || null;
    this.onChange = onChange;
    this.collectionId = collectionId; // CollectionId pour construire les URLs d'images
    this.mode = this.value?.type || 'upload'; // 'upload' ou 'document'
    
    // Détecter si c'est une image en fonction du label ou des extensions
    this.isImage = this.detectIfImage();
  }

  /**
   * Nettoie les URLs blob dans les données d'image pour éviter les problèmes CSP
   */
  cleanBlobUrls(value) {
    if (!value) return value;
    
    // Si c'est un objet avec previewUrl blob, le nettoyer
    if (typeof value === 'object' && value.previewUrl && value.previewUrl.startsWith('blob:')) {
      console.warn('⚠️ Blob URL détectée dans previewUrl, nettoyage...');
      const cleaned = { ...value };
      // Supprimer la previewUrl blob, garder url ou filename
      delete cleaned.previewUrl;
      return cleaned;
    }
    
    // Si c'est une string blob URL, retourner null
    if (typeof value === 'string' && value.startsWith('blob:')) {
      console.warn('⚠️ Blob URL détectée comme valeur string, ignorée');
      return null;
    }
    
    return value;
  }

  detectIfImage() {
    // Vérifier le label du champ
    const label = (this.field.label || '').toLowerCase();
    if (label.includes('image') || label === 'image') {
      return true;
    }
    
    // Vérifier les extensions autorisées
    const extensions = this.field.validation?.extensions || [];
    if (Array.isArray(extensions)) {
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
      return extensions.some(ext => imageExtensions.includes(ext.toLowerCase()));
    }
    
    return false;
  }

  render(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-file';

    const label = document.createElement('label');
    label.textContent = this.field.label;
    wrapper.appendChild(label);

    // 🔹 Sélecteur de mode : Upload ou Document (seulement pour les fichiers, pas les images)
    if (!this.isImage) {
      const modeSelector = document.createElement('div');
      modeSelector.className = 'file-mode-selector';
      modeSelector.style.marginBottom = '10px';
      modeSelector.style.display = 'flex';
      modeSelector.style.gap = '10px';

      const uploadRadio = document.createElement('input');
      uploadRadio.type = 'radio';
      uploadRadio.id = `${this.field.name}_upload`;
      uploadRadio.name = `${this.field.name}_mode`;
      uploadRadio.value = 'upload';
      uploadRadio.checked = this.mode === 'upload';
      uploadRadio.onchange = () => {
        this.mode = 'upload';
        this.value = null;
        this.renderContent(wrapper);
      };

      const uploadLabel = document.createElement('label');
      uploadLabel.htmlFor = `${this.field.name}_upload`;
      uploadLabel.textContent = '📤 Uploader un fichier';
      uploadLabel.style.cursor = 'pointer';

      const documentRadio = document.createElement('input');
      documentRadio.type = 'radio';
      documentRadio.id = `${this.field.name}_document`;
      documentRadio.name = `${this.field.name}_mode`;
      documentRadio.value = 'document';
      documentRadio.checked = this.mode === 'document';
      documentRadio.onchange = () => {
        this.mode = 'document';
        this.value = null;
        this.renderContent(wrapper);
      };

      const documentLabel = document.createElement('label');
      documentLabel.htmlFor = `${this.field.name}_document`;
      documentLabel.textContent = '📄 Utiliser un document généré';
      documentLabel.style.cursor = 'pointer';

      modeSelector.appendChild(uploadRadio);
      modeSelector.appendChild(uploadLabel);
      modeSelector.appendChild(documentRadio);
      modeSelector.appendChild(documentLabel);
      wrapper.appendChild(modeSelector);
    }

    // 🔹 Zone de contenu (upload ou sélection document)
    const contentArea = document.createElement('div');
    contentArea.className = 'file-content-area';
    wrapper.appendChild(contentArea);

    this.renderContent(wrapper);

    container.appendChild(wrapper);
  }

  renderContent(wrapper) {
    const contentArea = wrapper.querySelector('.file-content-area');
    contentArea.innerHTML = '';

    if (this.mode === 'upload') {
      this.renderUpload(contentArea);
    } else {
      this.renderDocumentSelector(contentArea);
    }

    // Afficher la valeur existante si présente
    if (this.value) {
      // Si c'est une string (URL), créer un objet pour la prévisualisation
      let previewData = this.value;
      if (typeof this.value === 'string' && this.isImage) {
        previewData = {
          type: 'upload',
          url: this.value,
          name: 'Image existante'
        };
      } else if (typeof this.value === 'string' && !this.isImage) {
        previewData = {
          type: 'upload',
          url: this.value,
          name: 'Fichier existant'
        };
      } else if (typeof this.value === 'object' && (this.value.filename || this.value.fileName)) {
        // Objet avec filename (valeur depuis la base de données)
        previewData = {
          ...this.value,
          type: 'upload' // S'assurer que le type est défini
        };
        console.log('🖼️ Valeur existante avec filename:', previewData);
      }
      this.renderPreview(contentArea, previewData);
    }
  }

  renderUpload(container) {
    // Zone de drag and drop
    const dragArea = document.createElement('div');
    dragArea.className = 'file-drag-area';
    dragArea.style.cssText = `
      border: 2px dashed #ddd;
      border-radius: 8px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      background-color: #f9f9f9;
      transition: all 0.3s ease;
      position: relative;
    `;

    const dragIcon = document.createElement('div');
    dragIcon.style.cssText = 'font-size: 48px; margin-bottom: 10px;';
    dragIcon.textContent = this.isImage ? '🖼️' : '📁';
    dragArea.appendChild(dragIcon);

    const dragText = document.createElement('div');
    dragText.style.cssText = 'font-size: 16px; font-weight: 500; margin-bottom: 5px; color: #333;';
    dragText.textContent = this.isImage 
      ? 'Glissez-déposez une image ici' 
      : 'Glissez-déposez un fichier ici';
    dragArea.appendChild(dragText);

    const dragSubtext = document.createElement('div');
    dragSubtext.style.cssText = 'font-size: 14px; color: #666;';
    dragSubtext.textContent = 'ou cliquez pour sélectionner';
    dragArea.appendChild(dragSubtext);

    // Input file caché
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    
    // Accept (optionnel)
    if (this.field.validation?.extensions) {
      const extensions = Array.isArray(this.field.validation.extensions)
        ? this.field.validation.extensions
        : this.field.validation.extensions.split(',').map(e => e.trim());
      input.accept = extensions.map(e => `.${e}`).join(',');
      
      // Pour les images, accepter aussi les types MIME
      if (this.isImage) {
        const mimeTypes = extensions.map(ext => {
          const extLower = ext.toLowerCase();
          if (['jpg', 'jpeg'].includes(extLower)) return 'image/jpeg';
          if (extLower === 'png') return 'image/png';
          if (extLower === 'gif') return 'image/gif';
          if (extLower === 'webp') return 'image/webp';
          if (extLower === 'svg') return 'image/svg+xml';
          if (extLower === 'bmp') return 'image/bmp';
          return null;
        }).filter(Boolean);
        if (mimeTypes.length > 0) {
          input.accept = mimeTypes.join(',');
        }
      }
    }

    // Gestion du drag and drop
    dragArea.ondragover = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragArea.style.borderColor = '#007bff';
      dragArea.style.backgroundColor = '#e7f3ff';
    };

    dragArea.ondragleave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragArea.style.borderColor = '#ddd';
      dragArea.style.backgroundColor = '#f9f9f9';
    };

    dragArea.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragArea.style.borderColor = '#ddd';
      dragArea.style.backgroundColor = '#f9f9f9';
      
      const file = e.dataTransfer.files[0];
      if (file) {
        this.handleFileSelect(file, container);
      }
    };

    dragArea.onclick = () => input.click();

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFileSelect(file, container);
      }
    };

    container.appendChild(input);
    container.appendChild(dragArea);
  }

  handleFileSelect(file, container) {
    // Vérifier le type de fichier
    if (this.isImage && !file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image valide');
      return;
    }

    // Vérifier la taille si spécifiée
    if (this.field.validation?.maxSizeMB) {
      const maxSizeBytes = this.field.validation.maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        alert(`Le fichier est trop volumineux. Taille maximale : ${this.field.validation.maxSizeMB} MB`);
        return;
      }
    }

    const fileData = {
      type: 'upload',
      file: file,               // objet File natif
      name: file.name,
      size: file.size,
      mimeType: file.type,
      url: null  // Sera rempli après upload
    };

    // Pour les images, créer une URL de prévisualisation
    // Utiliser FileReader au lieu de createObjectURL pour éviter les problèmes CSP
    if (this.isImage && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        fileData.previewUrl = e.target.result; // Data URL (base64)
        this.value = fileData;
        this.onChange && this.onChange(fileData);
        this.renderPreview(container, fileData);
      };
      reader.onerror = (error) => {
        console.error('❌ Erreur lors de la lecture du fichier:', error);
        // En cas d'erreur, essayer avec createObjectURL en dernier recours
        try {
          fileData.previewUrl = URL.createObjectURL(file);
          this.value = fileData;
          this.onChange && this.onChange(fileData);
          this.renderPreview(container, fileData);
        } catch (blobError) {
          console.error('❌ Erreur avec createObjectURL:', blobError);
        }
      };
      reader.readAsDataURL(file);
      // Ne pas appeler renderPreview ici car on attend le résultat du FileReader
      return; // Sortir de la fonction, renderPreview sera appelé dans reader.onload
    }

    this.value = fileData;
    this.onChange && this.onChange(fileData);
    this.renderPreview(container, fileData);
  }

  async renderDocumentSelector(container) {
    // Charger documentApi dynamiquement (car le module est chargé dynamiquement par FieldRenderer)
    let documentApi;
    try {
      // Essayer le chemin depuis fieldTypes/ vers api/
      const module = await import('../../../api/DocumentApi.js');
      documentApi = module.documentApi;
    } catch (e1) {
      try {
        // Essayer le chemin depuis fieldBuilder/ vers api/ (si résolu depuis FieldRenderer)
        const module = await import('../../api/DocumentApi.js');
        documentApi = module.documentApi;
      } catch (e2) {
        console.error('❌ Erreur chargement DocumentApi:', e1, e2);
        container.innerHTML = '<p style="color: red;">Erreur lors du chargement de l\'API documents</p>';
        return;
      }
    }
    
    // Charger la liste des documents disponibles
    const documentsRes = await documentApi.getAll();
    
    if (!documentsRes.success) {
      container.innerHTML = '<p style="color: red;">Erreur lors du chargement des documents</p>';
      return;
    }

    const select = document.createElement('select');
    select.className = 'document-select';
    select.style.width = '100%';
    select.style.padding = '8px';
    select.style.marginBottom = '10px';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Sélectionner un document --';
    select.appendChild(defaultOption);

    documentsRes.data.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc._id;
      option.textContent = doc.name;
      if (this.value?.documentId === doc._id) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.onchange = e => {
      const documentId = e.target.value;
      if (!documentId) {
        this.value = null;
        this.onChange && this.onChange(null);
        return;
      }

      const selectedDoc = documentsRes.data.find(d => d._id === documentId);
      if (selectedDoc) {
        const documentData = {
          type: 'document',
          documentId: documentId,
          name: selectedDoc.name,
          url: `/api/documents/${documentId}/pdf`,
          createdAt: selectedDoc.createdAt
        };

        this.value = documentData;
        this.onChange && this.onChange(documentData);
        this.renderPreview(container, documentData);
      }
    };

    container.appendChild(select);
  }

  renderPreview(container, fileData) {
    let preview = container.querySelector('.file-preview');
    if (preview) preview.remove();

    preview = document.createElement('div');
    preview.className = 'file-preview';
    preview.style.cssText = `
      margin-top: 15px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background-color: #f9f9f9;
    `;

    // Gérer les valeurs existantes (string URL, objet avec url, ou objet avec filename)
    const isExistingValue = typeof fileData === 'string' 
      || (fileData && fileData.url && !fileData.file)
      || (fileData && (fileData.filename || fileData.fileName)); // Objet avec filename = valeur existante
    
    if (fileData.type === 'upload' || (this.isImage && isExistingValue)) {
      // Nettoyer les URLs blob (problèmes CSP) - utiliser url ou construire depuis filename
      let imageUrl = fileData.previewUrl || fileData.url || (typeof fileData === 'string' ? fileData : null);
      
      // Si on n'a pas d'URL mais qu'on a un filename, construire l'URL
      if (!imageUrl && (fileData.filename || fileData.fileName)) {
        const filename = fileData.filename || fileData.fileName;
        const apiBase = window.API_BASE_URL || '/api';
        // Utiliser le collectionId si disponible pour construire l'URL
        if (this.collectionId) {
          // Encoder le filename pour éviter les problèmes avec les caractères spéciaux
          const encodedFilename = encodeURIComponent(filename);
          imageUrl = `${apiBase}/doc-template/collections/${this.collectionId}/images/${encodedFilename}`;
          console.log('🔗 URL construite depuis filename:', {
            filename,
            encodedFilename,
            collectionId: this.collectionId,
            fullUrl: imageUrl,
            fileData: fileData
          });
        } else {
          // Sans collectionId, on ne peut pas construire l'URL complète
          console.warn('⚠️ collectionId manquant, impossible de construire l\'URL complète de l\'image', {
            fileData,
            collectionId: this.collectionId
          });
          imageUrl = null;
        }
      }
      
      // Si c'est une blob URL, l'ignorer et utiliser url ou construire depuis filename
      if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('blob:')) {
        console.warn('⚠️ Blob URL détectée dans previewUrl, utilisation de url ou filename à la place');
        // Essayer d'utiliser url à la place
        if (fileData.url && !fileData.url.startsWith('blob:')) {
          imageUrl = fileData.url;
        } else if (fileData.filename || fileData.fileName) {
          // Construire l'URL API depuis le filename
          const filename = fileData.filename || fileData.fileName;
          const apiBase = window.API_BASE_URL || '/api';
          // Utiliser le collectionId si disponible pour construire l'URL
          if (this.collectionId) {
            imageUrl = `${apiBase}/doc-template/collections/${this.collectionId}/images/${filename}`;
          } else {
            // Sans collectionId, on ne peut pas construire l'URL complète
            console.warn('⚠️ collectionId manquant, impossible de construire l\'URL complète de l\'image');
            imageUrl = null;
          }
        } else {
          // Pas d'alternative, on ne peut pas afficher l'image
          imageUrl = null;
          console.warn('⚠️ Impossible d\'afficher l\'image : blob URL détectée et aucune alternative disponible');
        }
      }
      
      // Afficher l'image uniquement si on a une URL valide (pas blob)
      if (this.isImage && imageUrl && typeof imageUrl === 'string' && !imageUrl.startsWith('blob:')) {
        // Prévisualisation d'image (uniquement si ce n'est pas une blob URL)
        const imgPreview = document.createElement('div');
        imgPreview.style.cssText = 'text-align: center;';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.cssText = `
          max-width: 100%;
          max-height: 300px;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        img.onerror = () => {
          img.style.display = 'none';
          imgPreview.innerHTML = '<p style="color: #999;">Image non disponible</p>';
        };
        imgPreview.appendChild(img);
        
        const fileName = document.createElement('div');
        fileName.style.cssText = 'margin-top: 10px; font-weight: 500; color: #333;';
        fileName.textContent = fileData.name || 'Image';
        imgPreview.appendChild(fileName);
        
        if (fileData.size) {
          const fileSize = document.createElement('div');
          fileSize.style.cssText = 'margin-top: 5px; font-size: 12px; color: #666;';
          fileSize.textContent = `${(fileData.size / 1024).toFixed(1)} KB`;
          imgPreview.appendChild(fileSize);
        }
        
        preview.appendChild(imgPreview);
      } else if (!this.isImage) {
        // Fichier non-image
        const fileName = fileData.name || 'Fichier';
        const fileSize = fileData.size ? `${(fileData.size / 1024).toFixed(1)} KB` : '';
        preview.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 32px;">📁</span>
            <div>
              <strong style="display: block; margin-bottom: 5px;">${fileName}</strong>
              ${fileSize ? `<span style="font-size: 12px; color: #666;">${fileSize}</span>` : ''}
              ${fileData.url ? `<a href="${fileData.url}" target="_blank" style="display: block; margin-top: 5px; color: #007bff; text-decoration: none; font-size: 14px;">Télécharger</a>` : ''}
            </div>
          </div>
        `;
      }
    } else if (fileData.type === 'document') {
      preview.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 32px;">📄</span>
          <div>
            <strong style="display: block; margin-bottom: 5px;">${fileData.name}</strong>
            <a href="${fileData.url}" target="_blank" style="color: #007bff; text-decoration: none; font-size: 14px;">Voir le document</a>
          </div>
        </div>
      `;
    }

    // Bouton supprimer
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕ Supprimer';
    removeBtn.style.cssText = `
      margin-top: 10px;
      padding: 6px 12px;
      background-color: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    removeBtn.onclick = () => {
      // Révoquer uniquement les URLs blob (pas les data URLs)
      if (fileData.previewUrl && fileData.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(fileData.previewUrl);
      }
      this.value = null;
      this.onChange && this.onChange(null);
      preview.remove();
    };
    preview.appendChild(removeBtn);

    container.appendChild(preview);
  }
}
