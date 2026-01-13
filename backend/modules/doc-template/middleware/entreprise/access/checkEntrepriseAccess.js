// middleware/entreprise/access/checkEntrepriseAccess.js
// Adapté pour GDRI : utilise req.user.entrepriseId au lieu de req.user.currentEntrepriseId

const checkEntrepriseAccess = async (req, res, next) => {
  try {
    const entrepriseId = req.params.id;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Non authentifié'
      });
    }

    if (!entrepriseId) {
      return res.status(400).json({
        success: false,
        error: 'entrepriseId requis dans l\'URL'
      });
    }

    // ✅ ADAPTÉ POUR GDRI : Superadmin GDRI → accès total
    // Dans GDRI, le rôle peut être 'ADMIN_GDRI' ou 'superadmin'
    if (user.role === 'ADMIN_GDRI' || user.role === 'superadmin') {
      return next();
    }

    // ✅ ADAPTÉ POUR GDRI : Vérifier que l'entrepriseId correspond à celle de l'utilisateur
    // Dans GDRI, l'utilisateur a un seul entrepriseId directement
    if (user.entrepriseId && user.entrepriseId.toString() === entrepriseId.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Vous devez être administrateur de cette entreprise pour effectuer cette action'
    });

  } catch (error) {
    console.error('❌ checkEntrepriseAccess error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification des permissions'
    });
  }
};

module.exports = { checkEntrepriseAccess };
