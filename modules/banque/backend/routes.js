/**
 * FICHIER : modules/banque/backend/routes.js
 * RÔLE : Routes /api/banque — module sans état (pas de base entreprise) :
 *        le PDF est converti à la volée, rien n'est stocké.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateJWT } = require(path.join(__dirname, '../../../backend/config/jwt'));
const { requireBanqueRole } = require('./middleware/requireBanqueRole');
const banqueController = require('./controllers/banqueController');

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

const roles = ['USER_ENTITY', 'ADMIN_ENTITY'];

router.get('/health', (req, res) => {
  res.json({ success: true, module: 'banque' });
});

router.post('/extract',
  authenticateJWT,
  requireBanqueRole(roles),
  upload.single('file'),
  banqueController.extract
);

router.post('/export-csv',
  authenticateJWT,
  requireBanqueRole(roles),
  express.json({ limit: '2mb' }),
  banqueController.exportCsv
);

module.exports = router;
