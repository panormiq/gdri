/**
 * FICHIER : modules/gderpi/backend/services/boutiques/generateCgvPdf.js
 * RÔLE : Produit le PDF des CGV d'une boutique (profil B2B ou B2C).
 */

const getBoutiqueBySlug = require('./getBoutiqueBySlug');
const renderCgvHtml = require('../pdf/renderCgvHtml');
const htmlToPdfBuffer = require('../pdf/htmlToPdfBuffer');
const buildCgvPdfFilename = require('../pdf/buildCgvPdfFilename');

async function generateCgvPdf(db, entrepriseId, boutiqueSlug, { profil = 'b2b' } = {}) {
  const slug = String(boutiqueSlug || '').trim();
  if (!slug) throw new Error('Boutique requise');

  const boutique = await getBoutiqueBySlug(db, entrepriseId, slug);
  if (!boutique) throw new Error('CGV introuvables');
  if (boutique.actif === false) throw new Error('CGV indisponibles');

  const profile = String(profil || 'b2b').trim().toLowerCase() === 'b2c' ? 'b2c' : 'b2b';
  const html = renderCgvHtml({
    boutique,
    profil: profile,
    cgvProfilResolved: profile
  });
  const buffer = await htmlToPdfBuffer(html, { printBackground: true });

  return {
    buffer,
    filename: buildCgvPdfFilename(boutique, profile),
    contentType: 'application/pdf'
  };
}

module.exports = generateCgvPdf;
