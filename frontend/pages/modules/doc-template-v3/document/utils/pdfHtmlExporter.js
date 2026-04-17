// front/src/modules/editor/document/utils/pdfHtmlExporter.js

/**
 * Construit un HTML avec styles inline depuis l'éditeur (pour PDF).
 * @param {HTMLElement} editorElement
 * @returns {string}
 */
export function buildInlinePdfHtml(editorElement) {
  if (!editorElement) return '';

  const clone = editorElement.cloneNode(true);

  // Nettoyer les contrôles d'édition
  clone.querySelectorAll('.image-delete-button, .resize-handle, .image-crop-overlay, .image-crop-box, .lock-button, .image-placeholder').forEach(el => el.remove());
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));

  const copyStyles = (origNodes, cloneNodes, props) => {
    const length = Math.min(origNodes.length, cloneNodes.length);
    for (let i = 0; i < length; i += 1) {
      const style = window.getComputedStyle(origNodes[i]);
      props.forEach(prop => {
        cloneNodes[i].style[prop] = style.getPropertyValue(prop);
      });
    }
  };

  const textProps = [
    'font-family',
    'font-size',
    'font-weight',
    'color',
    'line-height',
    'text-align',
    'margin-top',
    'margin-bottom',
    'margin-left',
    'margin-right'
  ];

  const wrapperProps = [
    'display',
    'text-align',
    'margin-top',
    'margin-bottom'
  ];

  const imageProps = [
    'display',
    'width',
    'height',
    'max-width',
    'border-radius',
    'box-shadow',
    'object-fit',
    'margin-top',
    'margin-bottom'
  ];

  const textSelectors = ['p', 'h1', 'h2', 'h3', '.doc-title-level-1', '.doc-title-level-2', '.doc-title-level-3'];
  textSelectors.forEach(selector => {
    copyStyles(
      editorElement.querySelectorAll(selector),
      clone.querySelectorAll(selector),
      textProps
    );
  });

  copyStyles(
    editorElement.querySelectorAll('.image-container-wrapper'),
    clone.querySelectorAll('.image-container-wrapper'),
    wrapperProps
  );

  copyStyles(
    editorElement.querySelectorAll('img.template-image, img.collection-image'),
    clone.querySelectorAll('img.template-image, img.collection-image'),
    imageProps
  );

  const editorStyle = window.getComputedStyle(editorElement);
  clone.style.fontFamily = editorStyle.getPropertyValue('font-family');
  clone.style.fontSize = editorStyle.getPropertyValue('font-size');
  clone.style.color = editorStyle.getPropertyValue('color');
  clone.style.lineHeight = editorStyle.getPropertyValue('line-height');
  clone.style.textAlign = editorStyle.getPropertyValue('text-align');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body>${clone.outerHTML}</body></html>`;
}
