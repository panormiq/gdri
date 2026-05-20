/**
 * Assignations automatiques import Excel → staging UGAP.
 * - Options catalogue : compatibleModels (croix Excel)
 * - Minorations : réf. UGAP contient « MINO » (pas de croix modèles)
 * - PR : libellé « PR … » (pas de croix modèles, isSparePart)
 * - Options de base : baseIncluded + manualBaseOption (heuristique libellé + poste)
 */
class UgapImportAssignmentService {
  static isPrLabel(label) {
    return /^PR\s/i.test(String(label || '').trim());
  }

  /** Ligne minoration : la colonne réf. UGAP contient « MINO ». */
  static isMinorationLine(_label, refUgap) {
    return String(refUgap || '').trim().toUpperCase().includes('MINO');
  }

  static isPrLine(label) {
    return /^PR\s/i.test(String(label || '').trim());
  }

  /** Forfait / garantie : hors majorations. */
  static isExcludedFromMajorationLine(label) {
    const n = String(label || '').replace(/\s+/g, ' ').trim();
    if (!n) return false;
    return /\b(forfait|garanties?|extension\s+de\s+garantie)\b/i.test(n);
  }

  /** @deprecated Utiliser isExcludedFromMajorationLine */
  static isMotorForfaitOrGarantieLine(label) {
    return this.isExcludedFromMajorationLine(label);
  }

  /**
   * Ligne catalogue moteur (Motorisation Excel ou libellé type « 150 CV », « DF 140 APX »).
   * Beaucoup de références n'ont ni « moteur » ni marque dans le libellé.
   */
  static isMotorCatalogLine(label, category) {
    const cat = String(category || '').trim();
    const n = String(label || '').replace(/\s+/g, ' ').trim();
    if (!n || this.isExcludedFromMajorationLine(n)) return false;
    if (/^motorisation$/i.test(cat)) return true;
    if (/\b(moteur|motorisation|suzuki|mercury|yamaha|honda|evinrude|tohatsu|yanmar|volvo)\b/i.test(n)) {
      return true;
    }
    if (/\b\d{2,4}\s*cv\b/i.test(n)) return true;
    if (/\bdf\s*\d{2,4}\b/i.test(n)) return true;
    if (/\b(apx|apt|btx|atl)\b/i.test(n) && /\b\d{2,4}\b/.test(n)) return true;
    if (/\b(2\s+moteurs?|bi-moteur|bimoteur|double\s+moteur|jumelage\s+(?:de\s+)?moteurs?)\b/i.test(n)) {
      return true;
    }
    return false;
  }

  /** Majoration : libellé (en remplacement, en lieu et place, moteur…) — hors MINO et PR. */
  static isMajorationLine(label, refUgap, category) {
    if (this.isPrLine(label)) return false;
    if (this.isMinorationLine(label, refUgap)) return false;
    const n = String(label || '').replace(/\s+/g, ' ').trim();
    if (!n) return false;
    if (/^supp?ress(?:ion)?\b/i.test(n)) return false;
    if (this.isExcludedFromMajorationLine(n)) return false;
    // Plus-value UGAP : majoration même sans « en remplacement » dans le libellé.
    if (/^(plus-value|plus\s+value)\b/i.test(n)) return true;
    if (/\ben\s+lieux?\s+et\s+place\b/i.test(n)) return true;
    if (/\bau\s+lieu\s+et\s+place\b/i.test(n)) return true;
    if (/\ben\s+remplacement\b/i.test(n)) return true;
    if (/\bnon\s+fourniture\b/i.test(n)) return true;
    if (this.isMotorCatalogLine(label, category)) return true;
    return false;
  }

  static isBaseRelatedLine(label) {
    const raw = String(label || '').trim();
    if (!raw) return false;
    const s = raw.toLowerCase();
    if (
      /\ben\s+remplacement\s+de\b/.test(s) ||
      /\ben\s+lieu\s+et\s+place\b/.test(s) ||
      /\bau\s+lieu\s+et\s+place\b/.test(s) ||
      /\bnon\s+fourniture\b/.test(s) ||
      /\bnon\s+fourni\b/.test(s) ||
      /\bfourni\s+de\s+base\b/.test(s) ||
      /\bfourniture\s+de\s+base\b/.test(s) ||
      /\bfourni\s+en\s+standard\b/.test(s) ||
      /\béquipement\s+en\s+standard\b/.test(s) ||
      /\béquipement\s+de\s+base\b/.test(s) ||
      /\bconfiguration\s+de\s+base\b/.test(s)
    ) {
      return true;
    }
    return /^(moins-value|plus-value|plus\s+value)\b/i.test(raw);
  }

  static labelMentionsPosteNumber(label, posteNum) {
    const n = Number(posteNum);
    if (!Number.isFinite(n)) return false;
    const raw = String(label || '');
    if (new RegExp(`\\bpostes?\\s*(?:n°|n\\s*°|:)?\\s*${n}\\b`, 'i').test(raw)) return true;
    const m = raw.match(/\bpostes?\s+([\d\s,]+(?:et\s+\d+)?)/i);
    if (m) {
      const nums = m[1].match(/\d+/g);
      if (nums && nums.some((x) => parseInt(x, 10) === n)) return true;
    }
    return false;
  }

  static getExplicitPosteSetFromLabel(label) {
    const raw = String(label || '');
    if (!raw.trim()) return null;
    const set = new Set();
    let found = false;
    const rangeRe = /\bpostes?\s+(\d+)\s*(?:à|a|-|–|—)\s*(\d+)\b/gi;
    let m;
    while ((m = rangeRe.exec(raw)) !== null) {
      found = true;
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (b < a) [a, b] = [b, a];
      for (let i = a; i <= b; i++) set.add(i);
    }
    const scratch = raw.replace(/\bpostes?\s+\d+\s*(?:à|a|-|–|—)\s*\d+\b/gi, ' ');
    const singlePosteRe = /\bposte\s+n°?\s*(\d+)\b/gi;
    while ((m = singlePosteRe.exec(raw)) !== null) {
      found = true;
      set.add(parseInt(m[1], 10));
    }
    const listRe = /\bpostes?\s+([\d,\s]+(?:et\s+\d+)*)/gi;
    while ((m = listRe.exec(scratch)) !== null) {
      const chunk = m[1] || '';
      if (/\d\s*(?:à|a|-|–|—)\s*\d/.test(chunk)) continue;
      found = true;
      const nums = chunk.match(/\d+/g);
      if (nums) nums.forEach((x) => set.add(parseInt(x, 10)));
    }
    if (!found) return null;
    return set;
  }

  static labelHasPosteNumberingContext(label) {
    if (this.getExplicitPosteSetFromLabel(label) !== null) return true;
    const raw = String(label || '');
    return (
      /\bpostes?\s+(?:n°|n\s*°|:)?\s*\d/i.test(raw) ||
      /\bpostes?\s+\d+\s*(?:à|a|-|–|—)\s*\d/i.test(raw) ||
      /\bpostes?\s+[\d,\s]{2,80}(?:et\s+\d+)?/i.test(raw)
    );
  }

  static optionHasExplicitXForModel(opt, modelId) {
    const cm = opt?.compatibleModels;
    return Array.isArray(cm) && cm.length > 0 && cm.map(String).includes(String(modelId));
  }

  static passesPosteScopeForBaseOption(opt, model) {
    const pn = model?.posteNumber;
    if (pn == null || pn === '') return true;
    const name = opt?.name || '';
    const explicit = this.getExplicitPosteSetFromLabel(name);
    if (explicit !== null && explicit.size > 0) {
      return explicit.has(Number(pn));
    }
    if (this.labelHasPosteNumberingContext(name)) {
      return this.labelMentionsPosteNumber(name, pn);
    }
    if (this.labelMentionsPosteNumber(name, pn)) return true;
    if (this.optionHasExplicitXForModel(opt, model.id)) return true;
    const cm = opt?.compatibleModels;
    if (!Array.isArray(cm) || cm.length === 0) return true;
    return false;
  }

  /**
   * Marque les lignes mino / PR (les croix Excel sur les mino moteur restent dans compatibleModels).
   * @param {Array} categories
   * @param {boolean} onlyIfNotManual - pour les mino : ne pas réinitialiser le flag manuel
   */
  static clearMinorationCrossAssignments(categories, onlyIfNotManual = true) {
    let changed = false;
    (Array.isArray(categories) ? categories : []).forEach((cat) => {
      (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
        const isMino = this.isMinorationLine(opt?.name, opt?.refUgap);
        const isPr = this.isPrLabel(opt?.name);
        if (!isMino && !isPr) return;
        if (isMino && onlyIfNotManual && opt?.manualMinorationAssignment) return;
        if (isMino) {
          opt.isMinoration = true;
          if (!onlyIfNotManual) opt.manualMinorationAssignment = false;
        }
        if (isPr) {
          opt.isSparePart = true;
          const had = Array.isArray(opt.compatibleModels) && opt.compatibleModels.length > 0;
          opt.compatibleModels = [];
          if (had) changed = true;
        }
      });
    });
    return changed;
  }

  static classifyOption(opt) {
    const label = String(opt?.name || '').trim();
    const ref = String(opt?.refUgap || '').trim();
    if (this.isPrLabel(label)) return 'spare_part';
    if (this.isMinorationLine(label, ref)) return 'minoration';
    if (this.isBaseRelatedLine(label)) return 'base_candidate';
    return 'option';
  }

  /**
   * Applique les flags sur les options du staging (mutate categories).
   * @param {Object} stagingDoc
   * @returns {{ doc: Object, summary: Object }}
   */
  /** Typage / flags issus des étapes d'import (sans heuristique libellé Excel). */
  static applyOptionFlagsRespectingSavedState(opt, comp, summary) {
    const lineKind = String(opt?.importOptionLineKind || '').trim().toLowerCase();
    const bumpOption = () => {
      summary.totals.option += 1;
      comp.forEach((mid) => {
        if (summary.byModel[mid]) summary.byModel[mid].option += 1;
      });
    };

    if (lineKind === 'minoration' || opt?.manualMinorationAssignment) {
      opt.isSparePart = false;
      opt.isMinoration = true;
      opt.isDivers = false;
      opt.baseIncluded = false;
      opt.manualBaseOption = false;
      summary.totals.minoration += 1;
      comp.forEach((mid) => {
        if (summary.byModel[mid]) summary.byModel[mid].minoration += 1;
      });
      return true;
    }

    if (lineKind === 'majoration' || opt?.manualMajorationAssignment) {
      opt.isSparePart = false;
      opt.isMinoration = false;
      opt.isDivers = comp.length === 0;
      opt.baseIncluded = false;
      opt.manualBaseOption = false;
      bumpOption();
      return true;
    }

    if (lineKind === 'option') {
      opt.isSparePart = false;
      opt.isMinoration = false;
      opt.isDivers = comp.length === 0;
      opt.baseIncluded = false;
      opt.manualBaseOption = false;
      bumpOption();
      return true;
    }

    if (opt?.isSparePart || this.isPrLabel(opt?.name)) {
      opt.isSparePart = true;
      opt.isMinoration = false;
      summary.totals.spare_part += 1;
      return true;
    }

    return false;
  }

  static applyStagingAssignments(stagingDoc) {
    const doc = stagingDoc && typeof stagingDoc === 'object' ? stagingDoc : {};
    const models = Array.isArray(doc.models) ? doc.models : [];
    const validatedIds = new Set(
      (Array.isArray(doc.progress?.validatedModelIds) ? doc.progress.validatedModelIds : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    );
    const modelById = new Map(
      models.map((m) => [String(m?.id || '').trim(), m]).filter(([id]) => id)
    );

    const summary = {
      byModel: {},
      totals: { option: 0, minoration: 0, base: 0, spare_part: 0, divers: 0 }
    };

    validatedIds.forEach((mid) => {
      summary.byModel[mid] = { option: 0, minoration: 0, base: 0, spare_part: 0 };
    });

    const categories = Array.isArray(doc.categories) ? doc.categories : [];
    categories.forEach((cat) => {
      const opts = Array.isArray(cat?.options) ? cat.options : [];
      opts.forEach((opt) => {
        if (opt?.importGeneratedFromBaseProduct) {
          return;
        }

        const comp = Array.isArray(opt.compatibleModels)
          ? opt.compatibleModels.map((x) => String(x || '').trim()).filter(Boolean)
          : [];

        if (this.applyOptionFlagsRespectingSavedState(opt, comp, summary)) {
          return;
        }

        const kind = this.classifyOption(opt);

        opt.isSparePart = false;
        opt.isMinoration = false;
        opt.isDivers = comp.length === 0;

        if (kind === 'minoration') {
          opt.isMinoration = true;
          opt.isDivers = false;
          opt.baseIncluded = false;
          opt.manualBaseOption = false;
          summary.totals.minoration += 1;
          comp.forEach((mid) => {
            if (summary.byModel[mid]) summary.byModel[mid].minoration += 1;
          });
          return;
        }

        if (kind === 'spare_part') {
          opt.isSparePart = true;
          summary.totals.spare_part += 1;
          return;
        }

        if (comp.length === 0) {
          summary.totals.divers += 1;
          opt.baseIncluded = false;
          opt.manualBaseOption = false;
          return;
        }

        let baseForAnyValidated = false;
        if (kind === 'base_candidate') {
          comp.forEach((mid) => {
            if (!validatedIds.has(mid)) return;
            const model = modelById.get(mid);
            if (!model) return;
            if (!this.passesPosteScopeForBaseOption(opt, model)) return;
            baseForAnyValidated = true;
            if (summary.byModel[mid]) summary.byModel[mid].base += 1;
          });
        }

        if (baseForAnyValidated) {
          opt.baseIncluded = true;
          opt.manualBaseOption = true;
          const price = Number(opt.priceUgap);
          if (!Number.isFinite(Number(opt.baseIncludedPrice))) {
            opt.baseIncludedPrice = Number.isFinite(price) ? price : 0;
          }
          summary.totals.base += 1;
          return;
        }

        opt.baseIncluded = false;
        opt.manualBaseOption = false;
        summary.totals.option += 1;
        comp.forEach((mid) => {
          if (summary.byModel[mid]) summary.byModel[mid].option += 1;
        });
      });
    });

    doc.categories = categories;
    doc.importAssignmentsSummary = summary;
    doc.importAssignmentsAppliedAt = new Date();
    return { doc, summary };
  }

  static buildSummaryForModels(stagingDoc) {
    const { summary } = this.applyStagingAssignments(
      JSON.parse(JSON.stringify(stagingDoc || {}))
    );
    return summary;
  }
}

module.exports = UgapImportAssignmentService;
