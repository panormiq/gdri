/**
 * FICHIER : modules/gderpi/frontend/assets/js/shared/bindImageUploadField.js
 * RÔLE : Upload + URL externe — stockage interne séparé du champ URL visible.
 *
 * ENTRÉES : config { fileInputId, storageInputId, externalUrlInputId, previewId, scope }
 * SORTIES : handlers DOM branchés
 *
 * DÉPEND DE : GderpiImages.*
 * NE PAS : logique métier boutique/article
 *
 * APPELÉ PAR : bindBoutiquesTab, bindArticlesTab
 */
(function initGderpiBindImageUploadField(global) {
  'use strict';

  const norm = (v) => global.GderpiImages.normalizeStoredImagePath(v);

  function revokeBlob(previewEl) {
    if (previewEl && previewEl._gderpiBlobUrl) {
      URL.revokeObjectURL(previewEl._gderpiBlobUrl);
      previewEl._gderpiBlobUrl = null;
    }
  }

  function getImageValue(storageInput, externalInput) {
    const ext = externalInput ? externalInput.value.trim() : '';
    if (ext) return ext;
    return storageInput ? storageInput.value.trim() : '';
  }

  function setImageValue(storageInput, externalInput, value) {
    const raw = String(value || '').trim();
    if (/^https?:\/\//i.test(raw)) {
      if (externalInput) externalInput.value = raw;
      if (storageInput) storageInput.value = '';
      return;
    }
    const stored = norm(raw);
    if (storageInput) storageInput.value = stored;
    if (externalInput) externalInput.value = '';
  }

  function setPreview(previewEl, url, options) {
    if (!previewEl) return;

    const keepBlob = options && options.keepBlob;
    if (!keepBlob) revokeBlob(previewEl);

    const blobUrl = keepBlob ? previewEl._gderpiBlobUrl : (options && options.blobUrl);
    const src = blobUrl || global.GderpiImages.resolveImageUrl(url);
    if (!src) {
      previewEl.innerHTML = '<span class="gderpi-image-upload__placeholder">' +
        (options && options.emptyLabel ? options.emptyLabel : 'Aucun aperçu') + '</span>';
      previewEl.classList.remove('has-image');
      return;
    }

    const img = document.createElement('img');
    img.alt = 'Aperçu';
    img.src = src;
    img.onerror = () => {
      if (previewEl._gderpiBlobUrl) {
        img.onerror = null;
        img.src = previewEl._gderpiBlobUrl;
        return;
      }
      previewEl.innerHTML = '<span class="gderpi-image-upload__placeholder gderpi-image-upload__placeholder--error">Impossible d\'afficher l\'image</span>';
      previewEl.classList.remove('has-image');
    };
    previewEl.innerHTML = '';
    previewEl.appendChild(img);
    previewEl.classList.add('has-image');
    if (options && options.blobUrl) previewEl._gderpiBlobUrl = options.blobUrl;
  }

  function setFilename(fileNameEl, text) {
    if (!fileNameEl) return;
    fileNameEl.textContent = text || '';
    fileNameEl.classList.toggle('is-empty', !text);
  }

  function bindImageUploadField(config) {
    const fileInput = document.getElementById(config.fileInputId);
    const storageInput = document.getElementById(config.storageInputId || config.urlInputId);
    const externalInput = document.getElementById(
      config.externalUrlInputId || (config.storageInputId ? config.urlInputId : null)
    );
    const previewEl = document.getElementById(config.previewId);
    const clearBtn = config.clearBtnId ? document.getElementById(config.clearBtnId) : null;
    const browseBtn = document.getElementById(
      config.browseBtnId || String(config.fileInputId || '').replace(/-file$/, '-browse')
    );
    const fileNameEl = document.getElementById(
      config.fileNameId || String(config.fileInputId || '').replace(/-file$/, '-filename')
    );
    if (!fileInput || !storageInput || !previewEl) return;

    if (browseBtn) {
      browseBtn.addEventListener('click', () => fileInput.click());
    }

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const blobUrl = URL.createObjectURL(file);
      setPreview(previewEl, '', { blobUrl, emptyLabel: 'Aucun aperçu' });
      setFilename(fileNameEl, file.name);

      try {
        global.GderpiStatus.showStatus('Envoi de l\'image…', 'info');
        const result = await global.GderpiImages.uploadImage(file, config.scope);
        const storedPath = norm(result.mediaPath || result.path || '');
        setImageValue(storageInput, externalInput, storedPath);
        setPreview(previewEl, storedPath, { keepBlob: true });
        setFilename(fileNameEl, file.name);
        global.GderpiStatus.showStatus('Image enregistrée.', 'success');
        fileInput.value = '';
        if (typeof config.onChange === 'function') config.onChange(getImageValue(storageInput, externalInput));
      } catch (err) {
        revokeBlob(previewEl);
        setPreview(previewEl, getImageValue(storageInput, externalInput));
        setFilename(fileNameEl, '');
        global.GderpiStatus.showStatus(err.message || 'Erreur upload', 'danger');
        fileInput.value = '';
      }
    });

    if (externalInput) {
      externalInput.addEventListener('input', () => {
        if (storageInput) storageInput.value = '';
        revokeBlob(previewEl);
        setPreview(previewEl, externalInput.value.trim());
        setFilename(fileNameEl, '');
        if (typeof config.onChange === 'function') config.onChange(externalInput.value.trim());
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (storageInput) storageInput.value = '';
        if (externalInput) externalInput.value = '';
        revokeBlob(previewEl);
        setPreview(previewEl, '');
        setFilename(fileNameEl, '');
        fileInput.value = '';
        if (typeof config.onChange === 'function') config.onChange('');
      });
    }

    setPreview(previewEl, getImageValue(storageInput, externalInput));
  }

  global.GderpiImages = global.GderpiImages || {};
  global.GderpiImages.bindImageUploadField = bindImageUploadField;
  global.GderpiImages.setImagePreview = setPreview;
  global.GderpiImages.setImageValue = setImageValue;
  global.GderpiImages.getImageValue = getImageValue;
})(window);
