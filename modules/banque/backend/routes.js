const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const StatementParserService = require('./services/StatementParserService');
const OxygeneCsvService = require('./services/OxygeneCsvService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || String(file.originalname || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) return cb(new Error('Le fichier doit etre un PDF'));
    cb(null, true);
  }
});

router.get('/health', authenticateJWT, (req, res) => {
  res.json({ success: true, module: 'banque' });
});

router.post('/extract', authenticateJWT, upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Aucun fichier PDF recu' });
    }

    const result = await StatementParserService.extractOperationsFromPdfBuffer(req.file.buffer);
    if (!result.operations.length) {
      return res.status(422).json({
        success: false,
        message: 'Aucune operation detectee dans ce PDF',
        metadata: result.metadata
      });
    }

    const csv = OxygeneCsvService.toCsv(result.operations);
    res.json({
      success: true,
      operations: result.operations,
      metadata: result.metadata,
      csv_preview: csv.split('\n').slice(0, 8).join('\n')
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/export-csv', authenticateJWT, express.json({ limit: '2mb' }), (req, res) => {
  try {
    const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
    if (!operations.length) {
      return res.status(400).json({ success: false, message: 'Aucune operation a exporter' });
    }

    const csv = OxygeneCsvService.toCsv(operations);
    const fileName = `oxygene-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
