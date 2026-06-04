const SlotService = require('../services/SlotService');

async function list(req, res) {
  try {
    const slots = await SlotService.list(req.entrepriseDb);
    res.json({ success: true, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { list };
