/**
 * FICHIER : modules/gderpi/frontend/assets/js/commandes/commandeClientHelpers.js
 * RÔLE : Helpers partagés commandes client (pipeline, bloquants, BL, recette).
 */

(function initGderpiCommandeClientHelpers(global) {
  'use strict';

  const STATUT_LABELS = {
    validee_client: 'Validée client',
    a_valider_gdri: 'À valider GDRI',
    validee_gdri: 'Validée GDRI',
    prestation_en_cours: 'Prestation en cours',
    achats_en_cours: 'Achats en cours',
    attente_livraison_frs: 'Attente livraison frs',
    a_livrer: 'À livrer',
    livree: 'Livrée',
    a_facturer: 'À facturer',
    facturee: 'Facturée',
    facturee_partiellement: 'Facturée partiellement',
    annulee: 'Annulée',
    confirmee: 'Validée GDRI',
    en_cours: 'En cours'
  };

  const BLOQUANT_LABELS = {
    validation_gdri: 'Valider la commande',
    achats_a_generer: 'Créer les commandes fournisseur',
    achats_a_valider: 'Valider et envoyer les commandes fournisseur',
    achats_a_envoyer: 'Valider et envoyer les commandes fournisseur',
    reception_a_confirmer: 'Réception partielle fournisseur',
    bl_a_creer: 'Créer le bon de livraison',
    recette_a_valider: 'Saisir un avancement (heures ou %)',
    facture_a_emettre: 'Émettre la facture'
  };

  const BLOQUANT_ACTIONS = {
    validation_gdri: 'valider_gdri',
    achats_a_generer: 'generer_achats',
    achats_a_valider: 'envoyer_achats',
    achats_a_envoyer: 'envoyer_achats',
    reception_a_confirmer: 'reception_partiel',
    bl_a_creer: 'bl_partiel',
    recette_a_valider: 'avancement_complet',
    facture_a_emettre: 'emit_facture'
  };

  const AVANCEMENT_STATUTS = [
    'validee_gdri', 'prestation_en_cours', 'achats_en_cours', 'attente_livraison_frs', 'a_livrer', 'livree',
    'a_facturer', 'facturee_partiellement'
  ];

  const KIND_LABELS = {
    dev: 'Développement',
    produit: 'Produits',
    mixte: 'Mixte',
    autre: '—'
  };

  function isHeureUnite(unite) {
    const u = String(unite || '').trim().toLowerCase();
    if (!u) return false;
    return /heure|jour/.test(u) || /^(h|hrs?|jh|j\/h)$/.test(u);
  }

  function isMeaningfulLine(line) {
    if (!line) return false;
    return Boolean(String(line.libelle || '').trim()
      || line.articleId
      || String(line.reference || '').trim());
  }

  function isDevLine(line) {
    if (!isMeaningfulLine(line)) return false;
    const t = String(line?.articleType || '').toLowerCase();
    if (t === 'developpement' || t === 'service') return true;
    return isHeureUnite(line?.unite);
  }

  function commandeKind(cmd) {
    const lines = (Array.isArray(cmd?.lignes) ? cmd.lignes : []).filter(isMeaningfulLine);
    let hasDev = false;
    let hasProd = false;
    lines.forEach((line) => {
      const t = String(line.articleType || '').trim().toLowerCase();
      if (isDevLine(line)) hasDev = true;
      else if (t === 'produit') hasProd = true;
    });
    if (hasDev && hasProd) return 'mixte';
    if (hasDev) return 'dev';
    if (hasProd) return 'produit';
    return 'autre';
  }

  function isProductLine(line) {
    if (!isMeaningfulLine(line) || isDevLine(line)) return false;
    return String(line?.articleType || '').toLowerCase() === 'produit';
  }

  function lineRequiresRecette(line) {
    if (!isDevLine(line)) return false;
    if (line?.gererCommande === true) return true;
    if (line?.gererCommande === false) return false;
    return String(line?.articleType || '').toLowerCase() !== 'developpement';
  }

  function remainingPrestationQty(line) {
    if (!line || line.recetteValideeAt) return 0;
    const ordered = Number(line.quantite) || 0;
    const livree = Number(line.quantiteLivree) || 0;
    return Math.max(0, Math.round((ordered - livree) * 10000) / 10000);
  }

  function remainingQty(line) {
    const ordered = Number(line?.quantite) || 0;
    const delivered = Number(line?.quantiteLivree) || 0;
    return Math.max(0, Math.round((ordered - delivered) * 10000) / 10000);
  }

  function lineRequiresReceptionFrs(line, cmd) {
    if (!line?.articleId) return false;
    const besoins = Array.isArray(cmd?.besoins) ? cmd.besoins : [];
    const articleId = String(line.articleId).trim();
    return besoins.some((b) => String(b.statut) !== 'annule' && String(b.articleId || '').trim() === articleId);
  }

  function livrableQty(line, cmd) {
    if (Number.isFinite(Number(line?.quantiteLivrable))) {
      return Math.max(0, Number(line.quantiteLivrable));
    }
    const reste = remainingQty(line);
    if (!lineRequiresReceptionFrs(line, cmd)) return reste;
    const recue = Number(line?.quantiteRecueFrs) || 0;
    const effectiveRecue = recue > 0
      ? recue
      : (['a_livrer', 'livree', 'a_facturer', 'facturee'].includes(String(cmd?.statut || ''))
        ? Number(line?.quantite) || 0
        : 0);
    const livree = Number(line?.quantiteLivree) || 0;
    const dispo = Math.max(0, Math.round((effectiveRecue - livree) * 10000) / 10000);
    return Math.min(reste, dispo);
  }

  function productLines(cmd) {
    const lines = (Array.isArray(cmd?.lignes) ? cmd.lignes : []).filter(isMeaningfulLine);
    const kind = commandeKind(cmd);
    if (kind === 'produit' || kind === 'mixte') {
      const filtered = lines.filter(isProductLine);
      if (filtered.length) return filtered;
    }
    return lines.filter((l) => !isDevLine(l));
  }

  function devLines(cmd) {
    return (Array.isArray(cmd?.lignes) ? cmd.lignes : []).filter(isDevLine);
  }

  function remainingProductLines(cmd) {
    return productLines(cmd).filter((l) => remainingQty(l) > 0);
  }

  function livrableProductLines(cmd) {
    return productLines(cmd).filter((l) => livrableQty(l, cmd) > 0);
  }

  function hasLivrableProducts(cmd) {
    return livrableProductLines(cmd).length > 0;
  }

  function besoinForLine(cmd, line) {
    const besoins = Array.isArray(cmd?.besoins) ? cmd.besoins : [];
    const articleId = String(line?.articleId || '').trim();
    if (!articleId) return null;
    return besoins.find((b) => String(b.statut) !== 'annule' && String(b.articleId || '').trim() === articleId) || null;
  }

  function lineAchatBreakdown(line, cmd) {
    const ordered = Number(line?.quantite) || 0;
    const livree = Number(line?.quantiteLivree) || 0;
    const recue = Number(line?.quantiteRecueFrs) || 0;
    const reste = remainingQty(line);
    const unite = String(line?.unite || 'pièce').trim();

    if (isDevLine(line)) {
      const livree = Number(line.quantiteLivree) || 0;
      if (line.recetteValideeAt || remainingPrestationQty(line) <= 0) {
        return [{ qty: ordered, label: 'Prestation terminée', tone: 'done' }];
      }
      if (livree > 0) {
        const pct = ordered ? Math.round((livree / ordered) * 100) : 0;
        return [{ qty: livree, label: 'avancement ' + pct + ' %', tone: 'info' }];
      }
      return [{ qty: reste || ordered, label: 'Prestation en cours', tone: 'pending' }];
    }

    if (reste <= 0 && ordered > 0) {
      return [{ qty: ordered, label: 'Livré client', tone: 'done' }];
    }

    const besoin = besoinForLine(cmd, line);
    const needsFrs = lineRequiresReceptionFrs(line, cmd);
    const enStock = needsFrs ? livrableQty(line, cmd) : reste;
    const parts = [];

    if (enStock > 0) {
      parts.push({ qty: enStock, label: 'en stock', tone: 'ok' });
    }

    if (needsFrs) {
      const besoinQty = Math.max(0, Number(besoin?.quantite) || ordered);
      const resteAchat = Math.max(0, Math.min(reste, besoinQty) - enStock);

      if (besoin?.statut === 'commande' && resteAchat > 0) {
        parts.push({ qty: resteAchat, label: 'en attente livraison fournisseur', tone: 'pending' });
      } else if (besoin?.statut === 'ouvert' && resteAchat > 0) {
        parts.push({ qty: resteAchat, label: 'à commander', tone: 'warn' });
      } else if (!besoin && resteAchat > 0) {
        parts.push({ qty: resteAchat, label: 'à commander', tone: 'warn' });
      } else if (resteAchat > 0 && recue < besoinQty) {
        parts.push({ qty: resteAchat, label: 'en attente livraison fournisseur', tone: 'pending' });
      }
    } else if (reste > 0 && !parts.length) {
      parts.push({ qty: reste, label: 'en stock', tone: 'ok' });
    }

    if (!parts.length) {
      parts.push({ qty: reste || ordered, label: 'en attente', tone: 'muted' });
    }

    return parts.map((p) => ({ ...p, unite }));
  }

  function renderLineAchatStatut(line, cmd, esc) {
    const parts = lineAchatBreakdown(line, cmd);
    return parts.map((p) => {
      const qtyLabel = p.qty > 0 ? esc(p.qty) + ' ' : '';
      return '<div class="gderpi-cmd-achat-part">' +
        '<span class="gderpi-cmd-avail-status gderpi-cmd-avail-status--' + esc(p.tone) + '">' +
        qtyLabel + esc(p.label) + '</span></div>';
    }).join('');
  }

  /** @deprecated utiliser lineAchatBreakdown */
  function lineAchatStatus(line, cmd) {
    const ordered = Number(line?.quantite) || 0;
    const recue = Number(line?.quantiteRecueFrs) || 0;
    const livree = Number(line?.quantiteLivree) || 0;
    const dispo = livrableQty(line, cmd);
    const besoin = besoinForLine(cmd, line);

    if (dispo > 0) {
      return { label: 'Disponible', tone: 'ok', detail: dispo + ' pièce(s) à livrer' };
    }
    if (livree >= ordered && ordered > 0) {
      return { label: 'Livré client', tone: 'done', detail: '' };
    }
    if (recue > 0 && recue < ordered) {
      return { label: 'Part. reçu frs', tone: 'warn', detail: recue + '/' + ordered + ' reçu(s)' };
    }
    if (recue >= ordered && ordered > 0) {
      return { label: 'Reçu fournisseur', tone: 'info', detail: 'En attente livraison client' };
    }
    if (besoin?.statut === 'commande') {
      return { label: 'Commandé frs', tone: 'pending', detail: 'En attente réception' };
    }
    if (besoin?.statut === 'ouvert') {
      return { label: 'Besoin ouvert', tone: 'pending', detail: 'Achats non lancés' };
    }
    if (!lineRequiresReceptionFrs(line, cmd) && remainingQty(line) > 0) {
      return { label: 'Sans achat frs', tone: 'info', detail: 'Livrable directement' };
    }
    return { label: 'En attente', tone: 'muted', detail: '' };
  }

  function availabilitySummary(cmd) {
    const prod = productLines(cmd);
    if (!prod.length) return '';

    const dispoQty = prod.reduce((sum, l) => sum + livrableQty(l, cmd), 0);
    const orderedQty = prod.reduce((sum, l) => sum + (Number(l.quantite) || 0), 0);
    const recueQty = prod.reduce((sum, l) => sum + (Number(l.quantiteRecueFrs) || 0), 0);

    if (dispoQty > 0) {
      return dispoQty + ' pièce(s) dispo';
    }
    if (recueQty > 0 && recueQty < orderedQty) {
      return recueQty + '/' + orderedQty + ' reçu(s) fournisseur';
    }
    return '';
  }

  function showAvailabilityDetails(cmd) {
    if (!cmd) return false;
    const s = String(cmd.statut || '');
    if (!['achats_en_cours', 'attente_livraison_frs', 'a_livrer', 'livree', 'a_facturer', 'facturee_partiellement'].includes(s)) {
      return false;
    }
    return productLines(cmd).length > 0;
  }

  function remainingDevLines(cmd) {
    return devLines(cmd).filter((l) => remainingPrestationQty(l) > 0);
  }

  function hasBl(cmd) {
    return Boolean(cmd?.bonLivraisonId);
  }

  function hasRecette(cmd) {
    return Boolean(cmd?.recetteValideeAt);
  }

  function bloquantLabel(code) {
    return BLOQUANT_LABELS[String(code || '')] || '';
  }

  function bloquantAction(code) {
    return BLOQUANT_ACTIONS[String(code || '')] || '';
  }

  function rowHighlightClass(cmd) {
    if (cmd?.modifieeParClient && cmd?.validationGdriRequise) return 'gderpi-cmd-row--modifiee';
    if (cmd?.conformeAuDevis && cmd?.statut === 'validee_client') return 'gderpi-cmd-row--conforme';
    if (cmd?.bloquantGdri) return 'gderpi-cmd-row--bloquant-' + cmd.bloquantGdri;
    return '';
  }

  function besoinsSummary(cmd) {
    const list = Array.isArray(cmd?.besoins) ? cmd.besoins : [];
    if (!list.length) return '';
    const open = list.filter((b) => String(b.statut) === 'ouvert').length;
    const ordered = list.filter((b) => String(b.statut) === 'commande').length;
    const parts = [];
    if (open) parts.push(open + ' besoin(s) ouvert(s)');
    if (ordered) parts.push(ordered + ' commandé(s)');
    return parts.join(' · ');
  }

  function showFulfillmentColumns(cmd) {
    if (!cmd) return false;
    const s = String(cmd.statut || '');
    const hasProd = productLines(cmd).length > 0;
    const hasDev = devLines(cmd).length > 0;
    if (['achats_en_cours', 'attente_livraison_frs', 'a_livrer', 'livree', 'a_facturer', 'facturee'].includes(s)) {
      return hasProd || hasDev;
    }
    if (hasDev && devLines(cmd).some((l) => l.recetteValideeAt)) return true;
    return productLines(cmd).some((l) =>
      (Number(l.quantiteLivree) || 0) > 0 || (Number(l.quantiteRecueFrs) || 0) > 0
    );
  }

  function lineFulfillmentCells(line, cmd, esc) {
    if (isDevLine(line)) {
      const ordered = Number(line.quantite) || 0;
      const doneQty = Number(line.quantiteLivree) || 0;
      const done = remainingPrestationQty(line) <= 0;
      const pct = ordered ? Math.round((doneQty / ordered) * 100) : 0;
      const livree = done ? '100 %' : (doneQty > 0 ? pct + ' %' : '—');
      const reste = done ? '—' : (ordered - doneQty);
      return '<td class="text-muted">—</td>' +
        '<td class="text-end">' + esc(livree) + '</td>' +
        '<td class="text-muted">—</td>' +
        '<td class="text-end">' + esc(reste) + '</td>';
    }
    const recue = Number(line?.quantiteRecueFrs) || 0;
    const livree = Number(line?.quantiteLivree) || 0;
    const dispo = livrableQty(line, cmd);
    const reste = remainingQty(line);
    return '<td class="text-end">' + esc(recue || '—') + '</td>' +
      '<td class="text-end">' + esc(livree || '—') + '</td>' +
      '<td class="text-end">' + esc(dispo) + '</td>' +
      '<td class="text-end">' + esc(reste) + '</td>';
  }

  function fulfillmentLines(cmd) {
    return productLines(cmd).concat(devLines(cmd));
  }

  function isLineFulfilled(line) {
    if (isDevLine(line)) return remainingPrestationQty(line) <= 0;
    return remainingQty(line) <= 0;
  }

  function productDeliveryTotals(cmd) {
    const prod = productLines(cmd);
    const ordered = prod.reduce((s, l) => s + (Number(l.quantite) || 0), 0);
    const delivered = prod.reduce((s, l) => s + (Number(l.quantiteLivree) || 0), 0);
    const remaining = Math.max(0, Math.round((ordered - delivered) * 10000) / 10000);
    const dispo = prod.reduce((sum, l) => sum + livrableQty(l, cmd), 0);
    return { hasProducts: prod.length > 0, ordered, delivered, remaining, dispo };
  }

  function devFulfillmentCount(cmd) {
    const dev = devLines(cmd);
    if (!dev.length) return null;
    return { done: dev.filter(isLineFulfilled).length, total: dev.length };
  }

  function fulfillmentProgress(cmd) {
    const lines = fulfillmentLines(cmd);
    if (!lines.length) return null;
    const done = lines.filter(isLineFulfilled).length;
    const prodTotals = productDeliveryTotals(cmd);
    const partialQty = prodTotals.hasProducts && prodTotals.delivered > 0 && prodTotals.remaining > 0;
    return {
      done,
      total: lines.length,
      partial: partialQty || (done > 0 && done < lines.length),
      complete: done >= lines.length
    };
  }

  function statutLabel(statut, cmd) {
    const s = String(statut || '');
    const progress = cmd ? fulfillmentProgress(cmd) : null;
    const EXECUTION_STATUTS = new Set([
      'validee_gdri', 'prestation_en_cours', 'achats_en_cours', 'attente_livraison_frs', 'a_livrer'
    ]);

    if (progress?.partial && EXECUTION_STATUTS.has(s)) {
      return 'En livraison';
    }
    if (progress?.complete && EXECUTION_STATUTS.has(s)) {
      return 'Livraison terminée';
    }

    if (s === 'validee_gdri' && cmd) {
      const kind = commandeKind(cmd);
      const devDone = devLines(cmd).length > 0 && !remainingDevLines(cmd).length;
      const prodDone = productLines(cmd).length > 0 && !remainingProductLines(cmd).length;
      if (kind === 'dev' && devDone) return 'Prestation terminée — à facturer';
      if (kind === 'mixte' && devDone && prodDone) return 'Exécution terminée — à facturer';
    }
    if (s === 'livree' && cmd && commandeKind(cmd) === 'dev') return 'Prestation terminée';
    return STATUT_LABELS[s] || s.replace(/_/g, ' ') || '—';
  }

  function fulfillmentSummary(cmd) {
    const summary = livraisonColumnSummary(cmd);
    return summary === '—' ? '' : 'Livraison ' + summary;
  }

  function isLineFullyInvoiced(line) {
    const ordered = Number(line?.quantite) || 0;
    if (ordered <= 0) return true;
    const facturee = Number(line?.quantiteFacturee) || 0;
    return facturee >= ordered - 0.0001;
  }

  function billableLines(cmd) {
    return (Array.isArray(cmd?.lignes) ? cmd.lignes : [])
      .filter((l) => (Number(l.quantiteFacturable) || 0) > 0);
  }

  function livraisonColumnSummary(cmd) {
    const prodTotals = productDeliveryTotals(cmd);
    const devCount = devFulfillmentCount(cmd);
    if (!prodTotals.hasProducts && !devCount) return '—';

    const parts = [];
    if (prodTotals.hasProducts && prodTotals.ordered > 0) {
      let prodLabel = prodTotals.delivered + '/' + prodTotals.ordered;
      if (prodTotals.dispo > 0 && prodTotals.remaining > 0) {
        prodLabel += ' · ' + prodTotals.dispo + ' dispo';
      }
      parts.push(prodLabel);
    }
    if (devCount) {
      parts.push('presta ' + devCount.done + '/' + devCount.total);
    }
    return parts.join(' · ') || '—';
  }

  function facturationColumnSummary(cmd) {
    const factures = Array.isArray(cmd?.factures) ? cmd.factures : [];
    if (!factures.length) {
      const billable = billableLines(cmd).length;
      if (billable) return billable + ' à facturer';
      return '—';
    }
    let avoirCount = 0;
    factures.forEach((f) => { avoirCount += (Array.isArray(f.avoirs) ? f.avoirs : []).length; });
    let label = factures.length + ' fact.';
    if (avoirCount) label += ' · ' + avoirCount + ' avoir';
    return label;
  }

  function facturePayeLabel(facture) {
    if (facture?.remboursementEnAttente) return { label: 'Remb. attente', tone: 'warn' };
    if (facture?.soldeeParAvoir) return { label: 'Soldée avoir', tone: 'muted' };
    if (facture?.payee) return { label: 'Payée', tone: 'ok' };
    if (facture?.statutPaiement === 'partiellement_creditee') return { label: 'Part. créditée', tone: 'warn' };
    return { label: 'Non payée', tone: 'pending' };
  }

  function facturationSummary(cmd) {
    const lines = (Array.isArray(cmd?.lignes) ? cmd.lignes : [])
      .filter((l) => (Number(l.quantite) || 0) > 0);
    const factures = Array.isArray(cmd?.factures) ? cmd.factures : [];
    const factCount = factures.length;
    if (!lines.length && !factCount) return '';
    const done = lines.filter(isLineFullyInvoiced).length;
    if (!done && !billableLines(cmd).length && !factCount) return '';
    const parts = [];
    if (factCount) {
      parts.push(factCount + ' facture' + (factCount > 1 ? 's' : ''));
    }
    if (lines.length) {
      parts.push('lignes ' + done + '/' + lines.length);
    }
    return 'Facturation · ' + parts.join(' · ');
  }

  function factureApiPath(commandeClientId, factureId, suffix) {
    const cmdId = encodeURIComponent(commandeClientId);
    const tail = suffix ? '/' + suffix.replace(/^\//, '') : '';
    if (factureId) {
      return '/commandes-client/' + cmdId + '/factures/' + encodeURIComponent(factureId) + tail;
    }
    return '/commandes-client/' + cmdId + '/facture' + tail;
  }

  function avoirApiPath(commandeClientId, factureId, avoirId, suffix) {
    const base = factureApiPath(commandeClientId, factureId, '/avoirs/' + encodeURIComponent(avoirId));
    const tail = suffix ? '/' + suffix.replace(/^\//, '') : '';
    return base + tail;
  }

  function resolveFactureEntry(cmd, factureId) {
    const id = String(factureId || '').trim();
    const factures = Array.isArray(cmd?.factures) ? cmd.factures : [];
    if (!id) return factures[factures.length - 1] || null;
    return factures.find((f) => String(f.id) === id || String(f.numero) === id) || null;
  }

  function quantiteAvoirLine(facture, lineId) {
    let total = 0;
    (Array.isArray(facture?.avoirs) ? facture.avoirs : []).forEach((avoir) => {
      (Array.isArray(avoir?.lignes) ? avoir.lignes : []).forEach((entry) => {
        if (String(entry.id) === String(lineId)) total += Number(entry.quantite) || 0;
      });
    });
    return Math.round(total * 10000) / 10000;
  }

  function avoirableLines(cmd, factureId) {
    const facture = resolveFactureEntry(cmd, factureId);
    if (!facture) return [];
    const lignesCmd = Array.isArray(cmd?.lignes) ? cmd.lignes : [];
    const byId = new Map(lignesCmd.map((l) => [String(l.id || ''), l]));
    const items = [];

    (Array.isArray(facture.lignes) ? facture.lignes : []).forEach((entry) => {
      const id = String(entry.id || '').trim();
      if (!id) return;
      const onFacture = Number(entry.quantite) || 0;
      if (onFacture <= 0) return;
      const alreadyAvoir = quantiteAvoirLine(facture, id);
      const quantiteAvoirable = Math.max(0, Math.round((onFacture - alreadyAvoir) * 10000) / 10000);
      if (quantiteAvoirable <= 0) return;
      const line = byId.get(id) || {};
      items.push({
        id,
        reference: line.reference || '',
        libelle: line.libelle || '',
        quantiteFacture: onFacture,
        quantiteAvoir: alreadyAvoir,
        quantiteAvoirable,
        quantiteMax: quantiteAvoirable
      });
    });
    return items;
  }

  function hasAvoirableLines(cmd, factureId) {
    return avoirableLines(cmd, factureId).length > 0;
  }

  function workflowActions(cmd) {
    const items = [];
    const seen = new Set();
    const add = (value, label) => {
      if (!value || !label || seen.has(value)) return;
      seen.add(value);
      items.push({ value, label });
    };

    const b = String(cmd?.bloquantGdri || '');
    const s = String(cmd?.statut || '');

    if (b === 'facture_a_emettre') {
      add('facture_complet', 'Facturer lignes livrées');
      add('facture_partiel', 'Facturation partielle');
    } else if (b === 'bl_a_creer') {
      add('bl_complet', 'Livraison complète');
      add('bl_partiel', 'Livraison partielle');
    } else if (b === 'recette_a_valider') {
      add('avancement_complet', 'Soldes la prestation (100 %)');
      add('avancement_partiel', 'Avancement (heures ou %)');
    } else if (b === 'reception_a_confirmer') {
      add('reception_complet', 'Réception complète fournisseur');
      add('reception_partiel', 'Réception partielle fournisseur');
    } else if (b) {
      const action = bloquantAction(b);
      const label = bloquantLabel(b);
      if (action && label) add(action, label);
    }

    if (b !== 'reception_a_confirmer' && ['achats_en_cours', 'attente_livraison_frs', 'a_livrer'].includes(s)) {
      add('reception_partiel', 'Réception fournisseur');
    }

    const canBlStatuts = new Set(['achats_en_cours', 'attente_livraison_frs', 'a_livrer', 'livree']);
    if (b !== 'bl_a_creer' && remainingProductLines(cmd).length && canBlStatuts.has(s) && hasLivrableProducts(cmd)) {
      add('bl_complet', 'Livraison complète');
      add('bl_partiel', 'Livraison partielle');
    }
    if (b !== 'recette_a_valider' && remainingDevLines(cmd).length
      && AVANCEMENT_STATUTS.includes(s)) {
      add('avancement_complet', 'Soldes la prestation (100 %)');
      add('avancement_partiel', 'Avancement (heures ou %)');
    }

    const billable = billableLines(cmd);
    if (b !== 'facture_a_emettre' && billable.length) {
      add('facture_partiel', 'Facturation partielle');
      if (billable.length > 1) add('facture_complet', 'Facturer lignes livrées');
    }

    if (['livree', 'a_facturer', 'facturee_partiellement', 'a_livrer'].includes(s)) {
      add('goto_facturation', 'Ouvrir facturation');
    }
    if (billable.length && b !== 'facture_a_emettre') {
      add('emit_facture', 'Facturer lignes livrées');
    }
    const factures = Array.isArray(cmd?.factures) ? cmd.factures : [];
    if (factures.length || cmd?.factureNumero) {
      add('email_facture', 'E-mail dernière facture');
    }
    if (s && s !== 'annulee') {
      add('email_commande', 'E-mail AR commande client');
    }
    if (s && s !== 'annulee' && s !== 'facturee') {
      add('annuler', 'Annuler la commande');
    }
    return items;
  }

  /** @deprecated utiliser workflowActions */
  function secondaryActions(cmd) {
    return workflowActions(cmd);
  }

  function kindBadge(cmd) {
    const kind = commandeKind(cmd);
    const label = KIND_LABELS[kind] || KIND_LABELS.autre;
    return '<span class="gderpi-badge gderpi-badge--cmd-kind gderpi-badge--cmd-kind-' + kind + '">' + label + '</span>';
  }

  async function downloadBonLivraisonPdf(bonLivraisonId) {
    await global.GderpiDocumentPreview.downloadPdf(
      '/bons-livraison/' + encodeURIComponent(bonLivraisonId) + '/pdf',
      'Génération du PDF BL…'
    );
  }

  async function previewBonLivraisonHtml(bonLivraisonId) {
    await global.GderpiDocumentPreview.previewHtml(
      'Aperçu bon de livraison',
      '/bons-livraison/' + encodeURIComponent(bonLivraisonId) + '/html'
    );
  }

  async function downloadCommandeClientPdf(commandeClientId) {
    await global.GderpiDocumentPreview.downloadPdf(
      '/commandes-client/' + encodeURIComponent(commandeClientId) + '/pdf',
      'Génération du PDF commande client…'
    );
  }

  async function previewCommandeClientHtml(commandeClientId) {
    await global.GderpiDocumentPreview.previewHtml(
      'Aperçu commande client',
      '/commandes-client/' + encodeURIComponent(commandeClientId) + '/html'
    );
  }

  async function downloadCommandeFournisseurPdf(commandeFournisseurId) {
    await global.GderpiDocumentPreview.downloadPdf(
      '/commandes-fournisseur/' + encodeURIComponent(commandeFournisseurId) + '/pdf',
      'Génération du PDF commande fournisseur…'
    );
  }

  async function previewCommandeFournisseurHtml(commandeFournisseurId) {
    await global.GderpiDocumentPreview.previewHtml(
      'Aperçu commande fournisseur',
      '/commandes-fournisseur/' + encodeURIComponent(commandeFournisseurId) + '/html'
    );
  }

  async function previewFactureHtml(commandeClientId, factureId) {
    await global.GderpiDocumentPreview.previewHtml(
      'Aperçu facture',
      factureApiPath(commandeClientId, factureId, '/html')
    );
  }

  async function downloadFacturePdf(commandeClientId, factureId) {
    await global.GderpiDocumentPreview.downloadPdf(
      factureApiPath(commandeClientId, factureId, '/pdf'),
      'Génération du PDF facture…'
    );
  }

  async function previewAvoirHtml(commandeClientId, factureId, avoirId) {
    await global.GderpiDocumentPreview.previewHtml(
      avoirApiPath(commandeClientId, factureId, avoirId, '/html')
    );
  }

  async function downloadAvoirPdf(commandeClientId, factureId, avoirId) {
    await global.GderpiDocumentPreview.downloadPdf(
      avoirApiPath(commandeClientId, factureId, avoirId, '/pdf'),
      'Génération du PDF avoir…'
    );
  }

  async function sendCommandeClientToClient(commandeClientId, emailOrPayload) {
    let payload = {};
    if (emailOrPayload && typeof emailOrPayload === 'object' && !Array.isArray(emailOrPayload)) {
      payload = { ...emailOrPayload };
    } else {
      const modalResult = await global.GderpiSendEmail?.prompt?.({
      title: 'Envoyer l\'accusé de réception',
      description: 'Le client recevra un lien pour consulter et télécharger sa commande.',
      recipientContext: { type: 'commande_client', id: commandeClientId }
    });
      if (!modalResult) return null;
      payload = global.GderpiSendEmail.buildPayload(modalResult) || {};
    }

    global.GderpiStatus.showStatus('Envoi de l\'accusé de réception…', 'secondary');
    try {
      const res = await global.GderpiApi.apiCall('/commandes-client/' + encodeURIComponent(commandeClientId) + '/send', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      global.GderpiSendEmailFeedback.notifySendSuccess(res, { label: 'Accusé de réception' });
      return res.data || res;
    } catch (err) {
      global.GderpiSendEmailFeedback.notifySendError(err);
      return null;
    }
  }

  function formatPostalAddressText(addr) {
    const a = addr && typeof addr === 'object' ? addr : {};
    const lines = [];
    const libelle = String(a.libelle || '').trim();
    const street = String(a.adresse || '').trim();
    const complement = String(a.complement || a.adresseComplement || '').trim();
    const cpVille = [String(a.codePostal || '').trim(), String(a.ville || '').trim()].filter(Boolean).join(' ');
    const pays = String(a.pays || '').trim();
    if (libelle) lines.push(libelle);
    if (street) lines.push(street);
    if (complement) lines.push(complement);
    if (cpVille) lines.push(cpVille);
    if (pays && pays.toLowerCase() !== 'france') lines.push(pays);
    return lines.join('\n');
  }

  function hasAddressContent(addr) {
    const a = addr && typeof addr === 'object' ? addr : {};
    return Boolean(a.adresse || a.complement || a.codePostal || a.ville || a.libelle);
  }

  function resolveClientAdresseLivraison(client) {
    const addr = resolveDefaultClientAdresse(client);
    return addr ? formatPostalAddressText(addr) : '';
  }

  const CLIENT_ADDRESS_TYPE_LABELS = {
    generique: 'Générique',
    facturation: 'Facturation',
    livraison: 'Livraison',
    siege: 'Siège',
    autre: 'Autre'
  };

  function clientAddressTypeLabel(type) {
    return CLIENT_ADDRESS_TYPE_LABELS[String(type || '').trim()] || String(type || 'Autre');
  }

  function buildClientAdressesList(client) {
    if (!client) return [];
    const out = [];
    const seen = new Set();

    function push(addr, fallbackType) {
      const a = {
        type: fallbackType || 'autre',
        ...(addr && typeof addr === 'object' ? addr : {})
      };
      if (!hasAddressContent(a)) return;
      const key = [
        a.type,
        a.id || a.adresseId || '',
        a.libelle,
        a.adresse,
        a.complement,
        a.codePostal,
        a.ville
      ].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      out.push(a);
    }

    if (Array.isArray(client.adresses) && client.adresses.length) {
      client.adresses.forEach((a) => push(a));
      return out;
    }

    push(client.adresseFacturation, 'facturation');
    if (client.livraisonIdentiqueFacturation === false) {
      push(client.adresseLivraison, 'livraison');
    }
    if (!out.length) {
      push({
        adresse: client.adresse,
        complement: client.adresseComplement,
        codePostal: client.codePostal,
        ville: client.ville,
        pays: client.pays
      }, 'generique');
    }
    return out;
  }

  function clientAddressKey(addr, index) {
    return String(addr?.id || addr?.adresseId || ('idx-' + index)).trim();
  }

  function clientAddressSummaryLine(addr) {
    const a = addr && typeof addr === 'object' ? addr : {};
    const cpVille = [String(a.codePostal || '').trim(), String(a.ville || '').trim()].filter(Boolean).join(' ');
    return [a.libelle, a.adresse, a.complement, cpVille].filter(Boolean).join(', ') || '—';
  }

  function clientAddressOptionLabel(addr) {
    const type = clientAddressTypeLabel(addr?.type);
    const summary = clientAddressSummaryLine(addr);
    return type + ' — ' + summary;
  }

  function resolveDefaultClientAdresse(client) {
    const adresses = buildClientAdressesList(client);
    const pick = (type) => adresses.find((a) => a.type === type);
    return pick('livraison') || pick('generique') || pick('facturation') || adresses[0] || null;
  }

  function resolveDefaultClientAdresseKey(client) {
    const adresses = buildClientAdressesList(client);
    const pick = (type) => adresses.find((a) => a.type === type);
    const chosen = pick('livraison') || pick('generique') || pick('facturation') || adresses[0];
    if (!chosen) return '';
    const idx = adresses.indexOf(chosen);
    return clientAddressKey(chosen, idx);
  }

  function findClientAdresseByKey(client, key) {
    const adresses = buildClientAdressesList(client);
    const k = String(key || '').trim();
    return adresses.find((a, i) => clientAddressKey(a, i) === k) || null;
  }

  function buildClientContactsList(client) {
    if (!client) return [];
    const contacts = Array.isArray(client.contacts) ? client.contacts.filter(Boolean) : [];
    if (contacts.length) return contacts;
    if (client.type === 'particulier') {
      return [{
        id: '__particulier__',
        prenom: client.prenom || '',
        nom: client.nom || '',
        email: client.email || '',
        telephone: client.telephone || '',
        principal: true
      }];
    }
    if (client.email || client.telephone || client.contactNom) {
      const parts = String(client.contactNom || '').trim().split(/\s+/).filter(Boolean);
      return [{
        id: '__legacy__',
        prenom: parts.length > 1 ? parts[0] : '',
        nom: parts.length > 1 ? parts.slice(1).join(' ') : (parts[0] || ''),
        fonction: client.contactFonction || '',
        email: client.email || '',
        telephone: client.telephone || '',
        principal: true
      }];
    }
    return [];
  }

  function clientContactKey(contact, index) {
    return String(contact?.id || contact?.contactId || ('idx-' + index)).trim();
  }

  function clientContactOptionLabel(contact) {
    const name = [contact?.prenom, contact?.nom].filter(Boolean).join(' ').trim()
      || String(contact?.nom || '').trim()
      || 'Contact';
    const extras = [contact?.fonction, contact?.service, contact?.email].filter(Boolean);
    return extras.length ? name + ' — ' + extras.join(' · ') : name;
  }

  function resolveDefaultClientContactKey(client, devis) {
    const contacts = buildClientContactsList(client);
    if (!contacts.length) return '';
    const devisContactId = String(devis?.contactClientId || '').trim();
    if (devisContactId) {
      const idx = contacts.findIndex((c, i) => clientContactKey(c, i) === devisContactId);
      if (idx >= 0) return clientContactKey(contacts[idx], idx);
    }
    const principal = contacts.find((c) => c.principal) || contacts[0];
    const idx = contacts.indexOf(principal);
    return clientContactKey(principal, idx);
  }

  function findClientContactByKey(client, key) {
    const contacts = buildClientContactsList(client);
    const k = String(key || '').trim();
    return contacts.find((c, i) => clientContactKey(c, i) === k) || null;
  }

  function contactToBlFields(contact) {
    const fields = contactToDisplayFields(contact);
    if (!fields) return null;
    return {
      contactNom: fields.nom,
      contactFonction: fields.fonction,
      contactEmail: fields.email,
      contactTelephone: fields.telephone
    };
  }

  function contactToDisplayFields(contact) {
    if (!contact) return null;
    if (contact.prenom !== undefined || contact.nom !== undefined) {
      return {
        nom: [contact.prenom, contact.nom].filter(Boolean).join(' ').trim(),
        fonction: String(contact.fonction || '').trim(),
        email: String(contact.email || '').trim(),
        telephone: String(contact.telephone || '').trim()
      };
    }
    return {
      nom: String(contact.nom || '').trim(),
      fonction: String(contact.fonction || '').trim(),
      email: String(contact.email || '').trim(),
      telephone: String(contact.telephone || '').trim()
    };
  }

  function hasContactContent(contact) {
    if (!contact) return false;
    return Boolean(contact.nom || contact.fonction || contact.email || contact.telephone);
  }

  function resolveDevisContact(devis, client) {
    const d = devis && typeof devis === 'object' ? devis : {};
    const fromDevis = {
      nom: String(d.contactNom || '').trim(),
      fonction: String(d.contactFonction || '').trim(),
      email: String(d.contactEmail || '').trim(),
      telephone: String(d.contactTelephone || '').trim()
    };
    if (hasContactContent(fromDevis)) return fromDevis;

    const contactId = String(d.contactClientId || '').trim();
    if (contactId && client) {
      if (contactId === '__particulier__' || client.type === 'particulier') {
        const particulier = contactToDisplayFields({
          prenom: client.prenom,
          nom: client.nom,
          email: client.email,
          telephone: client.telephone
        });
        if (hasContactContent(particulier)) return particulier;
      }
      const contacts = Array.isArray(client.contacts) ? client.contacts : [];
      const match = contacts.find((ct) => String(ct.id || ct.contactId) === contactId);
      const linked = contactToDisplayFields(match);
      if (hasContactContent(linked)) return linked;
    }

    const contacts = Array.isArray(client?.contacts) ? client.contacts : [];
    const principal = contacts.find((c) => c.principal) || contacts[0];
    const fromClient = contactToDisplayFields(principal || {
      nom: client?.contactNom,
      fonction: client?.contactFonction,
      email: client?.email,
      telephone: client?.telephone
    });
    return hasContactContent(fromClient) ? fromClient : null;
  }

  function formatContactDisplay(contact) {
    if (!contact) return '';
    const parts = [];
    if (contact.nom) parts.push(contact.nom);
    const extras = [contact.fonction, contact.telephone, contact.email].filter(Boolean);
    if (extras.length) parts.push(extras.join(' · '));
    return parts.join(' — ');
  }

  function clientDisplayName(client) {
    if (!client) return '';
    return String(
      client.displayName
      || client.raisonSociale
      || [client.prenom, client.nom].filter(Boolean).join(' ')
      || ''
    ).trim();
  }

  function resolveClientContactLabel(client, devis) {
    if (devis) {
      const fromDevis = formatContactDisplay(resolveDevisContact(devis, client));
      if (fromDevis) return fromDevis;
    }
    const contacts = Array.isArray(client?.contacts) ? client.contacts : [];
    const principal = contacts.find((c) => c.principal) || contacts[0];
    if (principal) {
      const name = [principal.prenom, principal.nom].filter(Boolean).join(' ').trim();
      if (name) return name;
      if (principal.email) return principal.email;
    }
    return String(client?.contactNom || '').trim();
  }

  global.GderpiCommandeClientHelpers = {
    STATUT_LABELS,
    BLOQUANT_LABELS,
    commandeKind,
    isMeaningfulLine,
    isProductLine,
    isDevLine,
    remainingQty,
    livrableQty,
    lineRequiresReceptionFrs,
    productLines,
    devLines,
    remainingProductLines,
    remainingDevLines,
    remainingPrestationQty,
    isHeureUnite,
    livrableProductLines,
    hasLivrableProducts,
    besoinForLine,
    lineAchatBreakdown,
    renderLineAchatStatut,
    lineAchatStatus,
    availabilitySummary,
    showAvailabilityDetails,
    hasBl,
    hasRecette,
    statutLabel,
    bloquantLabel,
    bloquantAction,
    rowHighlightClass,
    besoinsSummary,
    fulfillmentLines,
    fulfillmentProgress,
    fulfillmentSummary,
    livraisonColumnSummary,
    facturationColumnSummary,
    facturePayeLabel,
    facturationSummary,
    billableLines,
    factureApiPath,
    avoirApiPath,
    resolveFactureEntry,
    avoirableLines,
    hasAvoirableLines,
    showFulfillmentColumns,
    lineFulfillmentCells,
    workflowActions,
    secondaryActions,
    kindBadge,
    downloadBonLivraisonPdf,
    previewBonLivraisonHtml,
    downloadCommandeClientPdf,
    previewCommandeClientHtml,
    downloadCommandeFournisseurPdf,
    previewCommandeFournisseurHtml,
    previewFactureHtml,
    downloadFacturePdf,
    previewAvoirHtml,
    downloadAvoirPdf,
    sendCommandeClientToClient,
    formatPostalAddressText,
    hasAddressContent,
    buildClientAdressesList,
    clientAddressTypeLabel,
    clientAddressKey,
    clientAddressOptionLabel,
    clientAddressSummaryLine,
    resolveDefaultClientAdresse,
    resolveDefaultClientAdresseKey,
    findClientAdresseByKey,
    buildClientContactsList,
    clientContactKey,
    clientContactOptionLabel,
    resolveDefaultClientContactKey,
    findClientContactByKey,
    contactToBlFields,
    resolveClientAdresseLivraison,
    resolveDevisContact,
    formatContactDisplay,
    clientDisplayName,
    resolveClientContactLabel
  };
})(window);
