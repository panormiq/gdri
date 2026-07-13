/**
 * FICHIER : modules/gderpi/backend/controllers/publicController.js
 * RÔLE : Routes publiques GDERPI (CGV, devis, commande client, facture).
 */

const getBoutiqueBySlug = require('../services/boutiques/getBoutiqueBySlug');
const renderCgvHtml = require('../services/pdf/renderCgvHtml');
const resolveCgvProfil = require('../services/pdf/resolveCgvProfil');
const { buildCgvDownloadUrl } = require('../utils/publicUrl');
const getDevisById = require('../services/devis/getDevisById');
const getBoutiqueById = require('../services/boutiques/getBoutiqueById');
const getCommandeClientById = require('../services/commande-client/getCommandeClientById');
const getCommandeFournisseurById = require('../services/commande-fournisseur/getCommandeFournisseurById');
const getDevisHtml = require('../services/devis/getDevisHtml');
const getCommandeClientHtml = require('../services/commande-client/getCommandeClientHtml');
const getCommandeFournisseurHtml = require('../services/commande-fournisseur/getCommandeFournisseurHtml');
const getFactureHtml = require('../services/commande-client/getFactureHtml');
const generateDevisPdf = require('../services/devis/generateDevisPdf');
const generateCommandeClientPdf = require('../services/commande-client/generateCommandeClientPdf');
const generateCommandeFournisseurPdf = require('../services/commande-fournisseur/generateCommandeFournisseurPdf');
const generateFacturePdf = require('../services/commande-client/generateFacturePdf');
const getAvoirHtml = require('../services/commande-client/getAvoirHtml');
const generateAvoirPdf = require('../services/commande-client/generateAvoirPdf');
const generateCgvPdf = require('../services/boutiques/generateCgvPdf');
const { resolveDevisPublicLink, incrementDevisDownloadCount } = require('../services/devis/resolveDevisPublicLink');
const { resolveGderpiPublicLink, incrementGderpiPublicDownloadCount } = require('../services/public/resolveGderpiPublicLink');
const confirmDevisOrderByPublicLink = require('../services/devis/confirmDevisOrderByPublicLink');
const { renderDevisAcceptPage, renderDevisAcceptSuccessPage } = require('../services/devis/renderDevisAcceptPage');
const { getPublicApiBaseUrl } = require('../utils/publicUrl');

function buildAcceptActionUrl(entrepriseId, token) {
  const apiBase = getPublicApiBaseUrl();
  return `${apiBase}/gderpi/public/devis/${encodeURIComponent(entrepriseId)}/accept?t=${encodeURIComponent(token)}`;
}

function publicError(res, resolved) {
  return res.status(resolved.status || 404).send(resolved.message || 'Lien invalide');
}

async function renderBoutiqueCgv(req, res) {
  try {
    const slug = String(req.params.boutiqueSlug || '').trim();
    const profilRaw = String(req.query.profil || 'b2b').trim().toLowerCase();
    const profil = profilRaw === 'b2c' ? 'b2c' : 'b2b';

    const boutique = await getBoutiqueBySlug(req.entrepriseDb, req.entrepriseId, slug);
    if (!boutique) {
      return res.status(404).send('CGV introuvables');
    }
    if (boutique.actif === false) {
      return res.status(404).send('CGV indisponibles');
    }

    const html = renderCgvHtml({
      boutique,
      profil,
      cgvProfilResolved: resolveCgvProfil({ cgvProfil: profil }, null),
      downloadUrl: buildCgvDownloadUrl(req.entrepriseId, slug, { profil })
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('GDERPI public CGV:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function downloadBoutiqueCgvPdf(req, res) {
  try {
    const slug = String(req.params.boutiqueSlug || '').trim();
    const profilRaw = String(req.query.profil || 'b2b').trim().toLowerCase();
    const profil = profilRaw === 'b2c' ? 'b2c' : 'b2b';

    const { buffer, filename, contentType } = await generateCgvPdf(
      req.entrepriseDb,
      req.entrepriseId,
      slug,
      { profil }
    );

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI public CGV PDF:', error);
    const status = /introuvable|indisponibles|requise/i.test(error.message) ? 404 : 500;
    res.status(status).send(error.message || 'Erreur serveur');
  }
}

async function viewDevisHtml(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveDevisPublicLink(req.entrepriseDb, req.entrepriseId, token);
    if (!resolved.ok) return publicError(res, resolved);

    const html = await getDevisHtml(req.entrepriseDb, req.entrepriseId, resolved.link.devisId, req);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('GDERPI public devis HTML:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function downloadDevisPdf(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveDevisPublicLink(req.entrepriseDb, req.entrepriseId, token);
    if (!resolved.ok) return publicError(res, resolved);

    const devis = await getDevisById(req.entrepriseDb, req.entrepriseId, resolved.link.devisId);
    if (!devis) return res.status(404).send('Devis introuvable');

    await incrementDevisDownloadCount(req.entrepriseDb, resolved.tokenHash);

    const { buffer, filename, contentType } = await generateDevisPdf(
      req.entrepriseDb,
      req.entrepriseId,
      resolved.link.devisId,
      req
    );

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI public devis PDF:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function viewCommandeClientHtml(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveGderpiPublicLink(req.entrepriseDb, req.entrepriseId, 'commande_client', token);
    if (!resolved.ok) return publicError(res, resolved);

    const html = await getCommandeClientHtml(req.entrepriseDb, req.entrepriseId, resolved.link.docId, req);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('GDERPI public commande client HTML:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function downloadCommandeClientPdf(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveGderpiPublicLink(req.entrepriseDb, req.entrepriseId, 'commande_client', token);
    if (!resolved.ok) return publicError(res, resolved);

    const commande = await getCommandeClientById(req.entrepriseDb, req.entrepriseId, resolved.link.docId);
    if (!commande) return res.status(404).send('Commande introuvable');

    await incrementGderpiPublicDownloadCount(req.entrepriseDb, resolved.tokenHash);

    const { buffer, filename, contentType } = await generateCommandeClientPdf(
      req.entrepriseDb,
      req.entrepriseId,
      resolved.link.docId,
      req
    );

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI public commande client PDF:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function viewCommandeFournisseurHtml(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveGderpiPublicLink(req.entrepriseDb, req.entrepriseId, 'commande_fournisseur', token);
    if (!resolved.ok) return publicError(res, resolved);

    const html = await getCommandeFournisseurHtml(req.entrepriseDb, req.entrepriseId, resolved.link.docId, req);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('GDERPI public commande fournisseur HTML:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function downloadCommandeFournisseurPdf(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveGderpiPublicLink(req.entrepriseDb, req.entrepriseId, 'commande_fournisseur', token);
    if (!resolved.ok) return publicError(res, resolved);

    const commande = await getCommandeFournisseurById(req.entrepriseDb, req.entrepriseId, resolved.link.docId);
    if (!commande) return res.status(404).send('Commande fournisseur introuvable');

    await incrementGderpiPublicDownloadCount(req.entrepriseDb, resolved.tokenHash);

    const { buffer, filename, contentType } = await generateCommandeFournisseurPdf(
      req.entrepriseDb,
      req.entrepriseId,
      resolved.link.docId,
      req
    );

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI public commande fournisseur PDF:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function viewFactureHtml(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveGderpiPublicLink(req.entrepriseDb, req.entrepriseId, 'facture', token);
    if (!resolved.ok) return publicError(res, resolved);

    const { parseFactureDocId } = require('../services/facturation/parseFactureDocId');
    const { commandeClientId, factureId } = parseFactureDocId(resolved.link.docId);
    const commande = await getCommandeClientById(req.entrepriseDb, req.entrepriseId, commandeClientId);
    if (!commande?.factureNumero && !(commande?.factures || []).length) {
      return res.status(404).send('Facture introuvable');
    }

    const html = await getFactureHtml(req.entrepriseDb, req.entrepriseId, commandeClientId, req, { factureId });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('GDERPI public facture HTML:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function downloadFacturePdf(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveGderpiPublicLink(req.entrepriseDb, req.entrepriseId, 'facture', token);
    if (!resolved.ok) return publicError(res, resolved);

    const { parseFactureDocId } = require('../services/facturation/parseFactureDocId');
    const { commandeClientId, factureId } = parseFactureDocId(resolved.link.docId);
    const commande = await getCommandeClientById(req.entrepriseDb, req.entrepriseId, commandeClientId);
    if (!commande?.factureNumero && !(commande?.factures || []).length) {
      return res.status(404).send('Facture introuvable');
    }

    await incrementGderpiPublicDownloadCount(req.entrepriseDb, resolved.tokenHash);

    const { buffer, filename, contentType } = await generateFacturePdf(
      req.entrepriseDb,
      req.entrepriseId,
      commandeClientId,
      req,
      { factureId }
    );

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI public facture PDF:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function viewAvoirHtml(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveGderpiPublicLink(req.entrepriseDb, req.entrepriseId, 'avoir', token);
    if (!resolved.ok) return publicError(res, resolved);

    const { parseAvoirDocId } = require('../services/facturation/parseAvoirDocId');
    const { commandeClientId, factureId, avoirId } = parseAvoirDocId(resolved.link.docId);
    if (!factureId || !avoirId) return res.status(404).send('Avoir introuvable');

    const html = await getAvoirHtml(req.entrepriseDb, req.entrepriseId, commandeClientId, req, {
      factureId,
      avoirId
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('GDERPI public avoir HTML:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function downloadAvoirPdf(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveGderpiPublicLink(req.entrepriseDb, req.entrepriseId, 'avoir', token);
    if (!resolved.ok) return publicError(res, resolved);

    const { parseAvoirDocId } = require('../services/facturation/parseAvoirDocId');
    const { commandeClientId, factureId, avoirId } = parseAvoirDocId(resolved.link.docId);
    if (!factureId || !avoirId) return res.status(404).send('Avoir introuvable');

    await incrementGderpiPublicDownloadCount(req.entrepriseDb, resolved.tokenHash);

    const { buffer, filename, contentType } = await generateAvoirPdf(
      req.entrepriseDb,
      req.entrepriseId,
      commandeClientId,
      req,
      { factureId, avoirId }
    );

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('GDERPI public avoir PDF:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function showDevisAcceptPage(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const resolved = await resolveDevisPublicLink(req.entrepriseDb, req.entrepriseId, token);

    if (!resolved.ok) {
      const html = renderDevisAcceptPage({
        devis: null,
        boutique: null,
        acceptActionUrl: buildAcceptActionUrl(req.entrepriseId, token),
        state: resolved.status === 410 ? 'expired' : 'invalid'
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(resolved.status || 404).send(html);
    }

    const devis = await getDevisById(req.entrepriseDb, req.entrepriseId, resolved.link.devisId);
    const boutique = devis?.boutiqueId
      ? await getBoutiqueById(req.entrepriseDb, req.entrepriseId, devis.boutiqueId)
      : null;

    if (devis?.statut === 'accepte' || resolved.link.acceptUsedAt) {
      const commande = resolved.link.commandeClientId || devis?.commandeClientId
        ? await getCommandeClientById(
          req.entrepriseDb,
          req.entrepriseId,
          resolved.link.commandeClientId || devis.commandeClientId
        )
        : null;
      const html = renderDevisAcceptSuccessPage({
        devis,
        commande,
        modifieeParClient: resolved.link.modifieeParClient === true || commande?.modifieeParClient === true
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    const html = renderDevisAcceptPage({
      devis,
      boutique,
      acceptActionUrl: buildAcceptActionUrl(req.entrepriseId, token),
      state: 'ready'
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('GDERPI public devis accept page:', error);
    res.status(500).send('Erreur serveur');
  }
}

async function submitDevisAccept(req, res) {
  try {
    const token = String(req.query.t || '').trim();
    const result = await confirmDevisOrderByPublicLink(
      req.entrepriseDb,
      req.entrepriseId,
      token,
      req.body || {},
      {
        ip: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        req
      }
    );

    if (!result.ok) {
      if (result.code === 'already_accepted') {
        const html = renderDevisAcceptSuccessPage({
          devis: result.devis,
          commande: result.commande,
          modifieeParClient: result.modifieeParClient === true
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(409).send(html);
      }

      if (result.code === 'empty_order') {
        const devis = result.devis || await getDevisById(
          req.entrepriseDb,
          req.entrepriseId,
          (await resolveDevisPublicLink(req.entrepriseDb, req.entrepriseId, token)).link?.devisId
        );
        const boutique = devis?.boutiqueId
          ? await getBoutiqueById(req.entrepriseDb, req.entrepriseId, devis.boutiqueId)
          : null;
        const html = renderDevisAcceptPage({
          devis,
          boutique,
          acceptActionUrl: buildAcceptActionUrl(req.entrepriseId, token),
          state: 'ready',
          errorMessage: result.message
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(400).send(html);
      }

      const html = renderDevisAcceptPage({
        devis: null,
        boutique: null,
        acceptActionUrl: buildAcceptActionUrl(req.entrepriseId, token),
        state: result.status === 410 ? 'expired' : 'invalid'
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(result.status || 400).send(html);
    }

    const html = renderDevisAcceptSuccessPage({
      devis: result.devis,
      commande: result.commande,
      modifieeParClient: result.modifieeParClient === true
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('GDERPI public devis accept:', error);
    res.status(500).send('Erreur serveur');
  }
}

module.exports = {
  renderBoutiqueCgv,
  downloadBoutiqueCgvPdf,
  viewDevisHtml,
  downloadDevisPdf,
  viewCommandeClientHtml,
  downloadCommandeClientPdf,
  viewCommandeFournisseurHtml,
  downloadCommandeFournisseurPdf,
  viewFactureHtml,
  downloadFacturePdf,
  viewAvoirHtml,
  downloadAvoirPdf,
  showDevisAcceptPage,
  submitDevisAccept
};
