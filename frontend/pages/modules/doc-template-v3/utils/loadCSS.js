/**
 * Charge un fichier CSS de manière dynamique
 * @param {string} href - Chemin relatif depuis le module doc-template-v3 (ex: 'document/DocumentEditorPage.css')
 *                        ou chemin complet depuis BASE_URL (ex: 'pages/modules/doc-template-v3/document/DocumentEditorPage.css')
 */
export default function loadCSS(href) {
  // Si le href commence déjà par http:// ou https://, l'utiliser tel quel
  if (href.startsWith('http://') || href.startsWith('https://')) {
    // Ancien format avec chemin absolu, le convertir
    const match = href.match(/\/continue\/doc_template\/front\/(.+)$/);
    if (match) {
      // Convertir depuis l'ancien format vers le nouveau format GDRI
      const oldPath = match[1];
      // Remplacer src/modules/editor/ par le chemin relatif depuis le module
      href = oldPath.replace(/^src\/modules\/editor\//, '');
      // Construire le chemin complet avec BASE_URL
      const baseUrl = window.BASE_URL || '/';
      href = baseUrl + 'pages/modules/doc-template-v3/' + href;
    } else {
      // URL absolue, utiliser tel quel
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      return;
    }
  } else {
    // Construire le chemin complet depuis BASE_URL
    const baseUrl = window.BASE_URL || '/';
    
    // Si le chemin commence déjà par pages/modules/doc-template-v3/, l'utiliser tel quel
    if (href.startsWith('pages/modules/doc-template-v3/')) {
      href = baseUrl + href;
    }
    // Si c'est un chemin relatif depuis le module (sans ./ ou ../)
    else if (!href.startsWith('./') && !href.startsWith('../') && !href.startsWith('/')) {
      href = baseUrl + 'pages/modules/doc-template-v3/' + href;
    }
    // Si c'est un chemin relatif avec ./ ou ../, convertir en chemin depuis le module
    else if (href.startsWith('./src/modules/editor/')) {
      // Ancien format : ./src/modules/editor/... -> pages/modules/doc-template-v3/...
      href = href.replace(/^\.\/src\/modules\/editor\//, '');
      href = baseUrl + 'pages/modules/doc-template-v3/' + href;
    }
    else if (href.startsWith('../')) {
      // Chemins relatifs complexes, essayer de les résoudre
      console.warn('⚠️ Chemin CSS relatif complexe détecté:', href);
      href = baseUrl + 'pages/modules/doc-template-v3/' + href.replace(/^\.\.\//, '');
    }
    else {
      // Autres chemins, utiliser tel quel
      if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('/')) {
        href = baseUrl + 'pages/modules/doc-template-v3/' + href;
      }
    }
  }
  
  // Vérifier si le CSS est déjà chargé
  const existingLink = document.querySelector(`link[href="${href}"]`);
  if (existingLink) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  console.log('📦 CSS chargé:', href);
}