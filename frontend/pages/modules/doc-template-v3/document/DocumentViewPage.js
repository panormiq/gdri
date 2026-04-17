// front/src/modules/editor/document/DocumentViewPage.js
import Page from '../shared/components/page/Page.js';
import { documentApi } from '../shared/api/DocumentApi.js';
import { templateApi } from '../shared/api/TemplateApi.js';
import RichTextEditor from '../templateBuilder/components/editor/RichTextEditor.js';
import { replaceVariables } from './utils/variableReplacer.js';
import { buildInlinePdfHtml } from './utils/pdfHtmlExporter.js';

export default class DocumentViewPage extends Page {
  constructor(router, documentId) {
    super(router);
    this.documentId = documentId;
    this.document = null;
    this.template = null;
    this.editor = null;
  }

  async render(container) {
    container.innerHTML = '';

    // Charger le CSS
    this.loadStyles();

    // Charger le document
    const res = await documentApi.getById(this.documentId);
    if (!res.success) {
      container.innerHTML = `<div class="error-message">Erreur: ${res.error || 'Document non trouvé'}</div>`;
      return;
    }

    this.document = res.data;

    // Charger le template pour récupérer la mise en page
    const templateId = this.document?.templateId || this.document?.template?._id;
    if (templateId) {
      const templateRes = await templateApi.getById(templateId);
      if (templateRes.success) {
        this.template = templateRes.data;
      }
    }

    // Créer le conteneur principal
    const pageContainer = document.createElement('div');
    pageContainer.className = 'document-view-page';

    // Header avec titre et actions
    const header = document.createElement('div');
    header.className = 'document-view-header';

    const title = document.createElement('h1');
    title.textContent = this.document.name;
    header.appendChild(title);

    // Boutons d'action
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'document-view-actions';

    // Bouton Télécharger PDF
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-primary';
    downloadBtn.textContent = '📥 Télécharger PDF';
    downloadBtn.onclick = () => this.downloadPdf();
    actionsContainer.appendChild(downloadBtn);

    // Bouton PDF depuis HTML affiché
    const livePdfBtn = document.createElement('button');
    livePdfBtn.className = 'btn btn-secondary';
    livePdfBtn.textContent = '📄 PDF depuis viewer';
    livePdfBtn.onclick = () => this.downloadViewerPdf();
    actionsContainer.appendChild(livePdfBtn);

    // Bouton Imprimer
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-secondary';
    printBtn.textContent = '🖨️ Imprimer';
    printBtn.onclick = () => this.printDocument();
    actionsContainer.appendChild(printBtn);

    // Bouton Éditer
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.textContent = '✏️ Éditer';
    editBtn.onclick = () => this.editDocument();
    actionsContainer.appendChild(editBtn);

    header.appendChild(actionsContainer);
    pageContainer.appendChild(header);

    // Contenu du document (même moteur que le builder, en lecture seule)
    const editorContainer = document.createElement('div');
    editorContainer.className = 'document-view-editor';
    pageContainer.appendChild(editorContainer);

    this.renderReadOnlyEditor(editorContainer);

    container.appendChild(pageContainer);
  }

  renderReadOnlyEditor(container) {
    const defaultGeneralStyles = {
      default: {
        fontFamily: 'Arial',
        fontSize: 12,
        color: '#000000',
        lineHeight: 1.5,
        margin: {
          top: '2.5cm',
          right: '2cm',
          bottom: '2.5cm',
          left: '2cm'
        },
        pagination: {
          pageSize: 'A4',
          orientation: 'portrait',
          headerHeight: '1.5cm',
          footerHeight: '1.5cm'
        },
        textAlign: 'left'
      },
      overrides: {}
    };

    const variables = this.document?.variables || { simple: {}, collections: {} };
    const baseContent = this.template?.content || this.document.content || '';
    const renderedHtml = this.template?.content
      ? replaceVariables(baseContent, variables)
      : baseContent;

    const templateForEditor = {
      _id: this.template?._id || this.document?.templateId || this.document?.template?._id,
      name: this.document.name,
      content: renderedHtml,
      generalStyles: this.template?.generalStyles || defaultGeneralStyles,
      structure: this.template?.structure || { sections: [] }
    };

    this.editor = new RichTextEditor({
      template: templateForEditor,
      onContentChange: null,
      onTitleCreated: null,
      onSectionChange: null,
      onTitleLevelChanged: null
    });

    this.editor.render(container);

    if (this.editor?.editorElement) {
      this.editor.editorElement.contentEditable = false;
      this.editor.editorElement.setAttribute('contenteditable', 'false');
      this.editor.editorElement.classList.add('read-only');
    }
  }


  loadStyles() {
    if (!document.getElementById('documentviewpage-styles')) {
      const link = document.createElement('link');
      link.id = 'documentviewpage-styles';
      link.rel = 'stylesheet';
      const baseUrl = window.BASE_URL || '/';
      link.href = baseUrl + 'pages/modules/doc-template-v3/document/DocumentViewPage.css';
      document.head.appendChild(link);
    }
  }

  async downloadPdf() {
    try {
      const html = buildInlinePdfHtml(this.editor?.editorElement);
      const res = html
        ? await documentApi.downloadPdfFromHtml(html, `${this.document.name}.pdf`)
        : await documentApi.downloadPdf(this.documentId, `${this.document.name}.pdf`);
      if (!res.success) {
        alert('Erreur lors du téléchargement: ' + (res.error || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('❌ Erreur downloadPdf:', error);
      alert('Erreur lors du téléchargement: ' + error.message);
    }
  }

  async downloadViewerPdf() {
    try {
      const html = this.editor?.editorElement?.innerHTML || '';
      if (!html.trim()) {
        alert('Aucun contenu à exporter');
        return;
      }
      const res = await documentApi.downloadPdfFromHtml(
        `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body>${html}</body></html>`,
        'viewer-export.pdf'
      );
      if (!res.success) {
        alert('Erreur lors du téléchargement: ' + (res.error || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('❌ Erreur downloadViewerPdf:', error);
      alert('Erreur lors du téléchargement: ' + error.message);
    }
  }

  printDocument() {
    // Ouvrir une nouvelle fenêtre avec le contenu pour l'impression
    const printWindow = window.open('', '_blank');
    const defaultStyles = this.template?.generalStyles?.default || {};
    const headings = this.template?.generalStyles?.headings || {};
    const h1Size = headings.h1?.fontSize || 24;
    const h2Size = headings.h2?.fontSize || 20;
    const h3Size = headings.h3?.fontSize || 18;
    const h1Weight = headings.h1?.fontWeight || 600;
    const h2Weight = headings.h2?.fontWeight || 600;
    const h3Weight = headings.h3?.fontWeight || 600;
    const baseFontFamily = defaultStyles.fontFamily || 'Arial';
    const baseFontSize = defaultStyles.fontSize || 12;
    const baseColor = defaultStyles.color || '#000000';
    const baseLineHeight = defaultStyles.lineHeight || 1.5;
    const baseTextAlign = defaultStyles.textAlign || 'left';
    const printCss = `
:root {
  --scale-ratio: 1;
  --spacing-sm: 16px;
  --spacing-md: 24px;
  --doc-font-size-h1: ${h1Size}px;
  --doc-font-size-h2: ${h2Size}px;
  --doc-font-size-h3: ${h3Size}px;
}
body {
  margin: 0;
  font-family: ${baseFontFamily};
  font-size: ${baseFontSize}px;
  color: ${baseColor};
  line-height: ${baseLineHeight};
  text-align: ${baseTextAlign};
  padding: 20px;
}
.doc-title-level-1,
.doc-title-level-2,
.doc-title-level-3 {
  display: block;
  margin-top: calc(var(--spacing-md, 24px) * var(--scale-ratio, 1) * 0.7) !important;
  margin-bottom: calc(var(--spacing-sm, 16px) * var(--scale-ratio, 1) * 0.7) !important;
  font-weight: 600 !important;
  font-family: inherit !important;
  line-height: inherit !important;
  color: inherit !important;
  text-align: inherit !important;
  text-transform: none !important;
  letter-spacing: normal !important;
}
.doc-title-level-1 { font-size: calc(var(--doc-font-size-h1, ${h1Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h1Weight} !important; }
.doc-title-level-2 { font-size: calc(var(--doc-font-size-h2, ${h2Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h2Weight} !important; }
.doc-title-level-3 { font-size: calc(var(--doc-font-size-h3, ${h3Size}px) * var(--scale-ratio, 1)) !important; font-weight: ${h3Weight} !important; }
.image-container-wrapper {
  display: block;
  margin: calc(var(--spacing-sm, 16px) * var(--scale-ratio, 1) * 0.7) 0 !important;
  margin-bottom: calc(0.84cm * var(--scale-ratio, 1)) !important;
  text-align: center;
}
.template-image-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
  margin: 0 auto;
  line-height: 0;
}
.template-image-container img.template-image,
img.collection-image {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  vertical-align: top;
}
.image-delete-button,
.resize-handle,
.image-crop-overlay,
.image-crop-box,
.lock-button,
.image-placeholder {
  display: none !important;
}
@media print {
  body { padding: 0; }
}
    `.trim();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${this.document.name}</title>
          <style>${printCss}</style>
        </head>
        <body>
          ${this.document.content}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  editDocument() {
    this.navigate(`/documents/edit/${this.documentId}`);
  }
}

