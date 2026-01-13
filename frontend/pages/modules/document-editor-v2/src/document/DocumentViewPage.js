// front/src/modules/editor/document/DocumentViewPage.js
import Page from '../shared/components/page/Page.js';
import { documentApi } from '../shared/api/DocumentApi.js';

export default class DocumentViewPage extends Page {
  constructor(router, documentId) {
    super(router);
    this.documentId = documentId;
    this.document = null;
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

    // Contenu du document
    const contentContainer = document.createElement('div');
    contentContainer.className = 'document-view-content';
    contentContainer.innerHTML = this.document.content;
    pageContainer.appendChild(contentContainer);

    container.appendChild(pageContainer);
  }

  loadStyles() {
    import('../utils/loadCSS.js').then(({ default: loadCSS }) => {
      loadCSS('document/DocumentViewPage.css', 'documentviewpage-styles');
    });
  }

  async downloadPdf() {
    try {
      const res = await documentApi.downloadPdf(this.documentId, `${this.document.name}.pdf`);
      if (!res.success) {
        alert('Erreur lors du téléchargement: ' + (res.error || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('❌ Erreur downloadPdf:', error);
      alert('Erreur lors du téléchargement: ' + error.message);
    }
  }

  printDocument() {
    // Ouvrir une nouvelle fenêtre avec le contenu pour l'impression
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${this.document.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            @media print {
              body { padding: 0; }
            }
          </style>
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

