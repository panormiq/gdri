/**
 * FICHIER : modules/banque/backend/controllers/banqueController.js
 * RÔLE : Contrôleur du module Banque — extraction PDF et export CSV Oxygène.
 *        Aucune logique métier ici : validation d'entrée + appel des services.
 *
 * DÉPEND DE : services/parsing/extractOperationsFromPdfBuffer, services/export/toOxygeneCsv
 * APPELÉ PAR : routes.js
 */

const extractOperationsFromPdfBuffer = require('../services/parsing/extractOperationsFromPdfBuffer');
const toOxygeneCsv = require('../services/export/toOxygeneCsv');

async function extract(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Aucun fichier PDF recu' });
    }

    const result = await extractOperationsFromPdfBuffer(req.file.buffer);
    if (!result.operations.length) {
      return res.status(422).json({
        success: false,
        message: 'Aucune operation detectee dans ce PDF',
        metadata: result.metadata
      });
    }

    const csv = toOxygeneCsv(result.operations);
    res.json({
      success: true,
      operations: result.operations,
      metadata: result.metadata,
      csv_preview: csv.split('\n').slice(0, 8).join('\n')
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function exportCsv(req, res) {
  try {
    const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
    if (!operations.length) {
      return res.status(400).json({ success: false, message: 'Aucune operation a exporter' });
    }

    const csv = toOxygeneCsv(operations);
    const fileName = `oxygene-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { extract, exportCsv };
