/**
 * Construit le chemin complet vers un fichier CSS dans le module doc-template-v3
 * @param {string} relativePath - Chemin relatif depuis le module (ex: 'document/DocumentEditorPage.css')
 * @returns {string} Chemin complet avec BASE_URL
 */
export function getCSSPath(relativePath) {
  const baseUrl = window.BASE_URL || '/';
  
  // Si le chemin commence déjà par pages/modules/doc-template-v3/, l'utiliser tel quel
  if (relativePath.startsWith('pages/modules/doc-template-v3/')) {
    return baseUrl + relativePath;
  }
  
  // Supprimer ./ ou ../ au début
  relativePath = relativePath.replace(/^\.\//, '').replace(/^\.\.\//, '');
  
  // Si c'est l'ancien format avec src/modules/editor/, le convertir
  if (relativePath.startsWith('src/modules/editor/')) {
    relativePath = relativePath.replace(/^src\/modules\/editor\//, '');
  }
  
  // Construire le chemin complet
  return baseUrl + 'pages/modules/doc-template-v3/' + relativePath;
}
