import { getCSSPath } from './getBasePath.js';

/**
 * Charge un fichier CSS avec détection automatique du chemin de base
 * @param {string} relativePath - Chemin relatif depuis src/ (ex: "shared/components/ListPage/ListPage.css")
 * @param {string} id - ID unique pour éviter les doublons (optionnel)
 */
export default function loadCSS(relativePath, id = null) {
  const href = getCSSPath(relativePath);
  
  // Vérifier si déjà chargé
  if (id && document.getElementById(id)) return;
  if (document.querySelector(`link[href="${href}"]`)) return;

  const link = document.createElement('link');
  if (id) link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}