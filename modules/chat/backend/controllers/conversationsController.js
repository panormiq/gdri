/**
 * FICHIER : modules/chat/backend/controllers/conversationsController.js
 * RÔLE : Conversations + messages (sync / stream) + legacy /message.
 */

const path = require('path');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const startConversation = require('../services/conversations/startConversation');
const getConversation = require('../services/conversations/getConversation');
const sendConversationMessage = require('../services/messages/sendConversationMessage');
const sendConversationMessageStream = require('../services/streaming/sendConversationMessageStream');

async function create(req, res) {
  try {
    const result = await startConversation(database, req, req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    return res.status(201).json({ success: true, data: result.conversation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getById(req, res) {
  try {
    const result = await getConversation(database, req, req.params.id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    return res.json({ success: true, data: result.conversation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function sendMessage(req, res) {
  try {
    const result = await sendConversationMessage(database, req, req.params.id, req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    return res.json({
      success: true,
      data: {
        response: result.response,
        conversation: result.conversation,
        model: result.model,
        server_id: result.server_id
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function sendMessageStream(req, res) {
  try {
    await sendConversationMessageStream(database, req, res, req.params.id, req.body || {});
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
    try {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Erreur serveur' })}\n\n`);
    } catch (_) {
      /* ignore */
    }
    res.end();
  }
}

/** Compat legacy: message direct sans conversation explicite. */
async function legacyMessage(req, res) {
  try {
    const conv = await startConversation(database, req, {
      context: req.body && req.body.context ? req.body.context : ''
    });
    if (!conv.ok) {
      return res.status(conv.status || 400).json({ success: false, message: conv.message });
    }
    const result = await sendConversationMessage(database, req, conv.conversation._id, req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    return res.json({
      success: true,
      data: {
        response: result.response,
        conversation_id: conv.conversation._id,
        model: result.model,
        server_id: result.server_id
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  create,
  getById,
  sendMessage,
  sendMessageStream,
  legacyMessage
};
