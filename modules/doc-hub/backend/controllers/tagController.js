const TagService = require('../services/TagService');

async function list(req, res) {
  try {
    const tags = await TagService.list(req.entrepriseDb);
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function create(req, res) {
  try {
    const tag = await TagService.create(req.entrepriseDb, req.body || {});
    res.status(201).json({ success: true, data: tag });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function update(req, res) {
  try {
    const tag = await TagService.update(req.entrepriseDb, req.params.id, req.body || {});
    if (!tag) return res.status(404).json({ success: false, message: 'Tag introuvable' });
    res.json({ success: true, data: tag });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  try {
    const ok = await TagService.remove(req.entrepriseDb, req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Tag introuvable' });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { list, create, update, remove };
