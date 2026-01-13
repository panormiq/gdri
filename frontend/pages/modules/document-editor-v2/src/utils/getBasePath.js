/**
 * Détecte automatiquement le chemin de base pour charger les assets (CSS, etc.)
 * Supporte à la fois le contexte GDR et doc_template
 */
export function getBasePath() {
  const currentPath = window.location.pathname;
  
  // Si on est dans GDR
  const gdriMatch = currentPath.match(/^(\/gdri\/frontend\/pages\/modules\/document-editor-v2)/);
  if (gdriMatch) {
    return '/gdri/frontend/pages/modules/document-editor-v2/src';
  }
  
  // Sinon, chercher le chemin doc_template
  const docTemplateMatch = currentPath.match(/^(\/continue\/doc_template\/front)/);
  if (docTemplateMatch) {
    return '/continue/doc_template/front/src/modules/editor';
  }
  
  // Fallback : essayer de détecter depuis le script qui charge
  const scripts = document.getElementsByTagName('script');
  for (let script of scripts) {
    if (script.src && script.src.includes('document-editor-v2')) {
      const match = script.src.match(/(.*\/document-editor-v2\/src)/);
      if (match) {
        return match[1];
      }
    }
  }
  
  // Dernier fallback : chemin relatif depuis le module
  return '/gdri/frontend/pages/modules/document-editor-v2/src';
}

/**
 * Génère le chemin complet vers un fichier CSS
 * @param {string} relativePath - Chemin relatif depuis src/ (ex: "shared/components/ListPage/ListPage.css")
 * @returns {string} Chemin complet
 */
export function getCSSPath(relativePath) {
  const basePath = getBasePath();
  // S'assurer que le chemin commence par / et ne contient pas de doublons
  const cleanPath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
  return basePath + cleanPath;
}


