const crypto = require('crypto');
const User = require('../models/user_model');

exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email requis' });
    }

    const user = await User.findOne({ email });

    // ⚠️ Ne jamais révéler si l’email existe ou non
    if (!user) {
      return res.json({
        success: true,
        message: 'Si un compte existe, un email a été envoyé'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1h
    await user.save();

    // TODO: envoyer email ici
    console.log('🔐 Reset token:', token);

    return res.json({
      success: true,
      message: 'Email de réinitialisation envoyé'
    });

  } catch (err) {
    console.error('❌ requestPasswordReset:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Données manquantes' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Token invalide ou expiré'
      });
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    return res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (err) {
    console.error('❌ resetPassword:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
