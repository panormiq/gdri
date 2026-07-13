/**
 * Extrait la liste des comptes mail utilisables depuis une config module mail.
 */

function listMailAccountsFromConfig(config) {
  if (!config || typeof config !== 'object') return [];

  if (Array.isArray(config.comptes) && config.comptes.length) {
    return config.comptes
      .filter((c) => c?.email)
      .map((c) => ({
        id: String(c.id || c.email).trim(),
        email: String(c.email).trim(),
        label: String(c.from_name || c.email).trim()
      }));
  }

  const profiles = config.smtp_profiles;
  if (profiles && typeof profiles === 'object') {
    return Object.keys(profiles).map((key) => {
      const p = profiles[key] || {};
      const email = p?.smtp?.auth?.user || key;
      return {
        id: key,
        email: String(email).trim(),
        label: String(p?.from?.name || email).trim()
      };
    });
  }

  return [];
}

module.exports = listMailAccountsFromConfig;
