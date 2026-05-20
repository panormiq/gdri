/**
 * Middleware de Rate Limiting pour protection contre DDoS et SYN flood
 * Fichier : backend/middleware/rate-limiter.js
 * 
 * Protection contre :
 * - SYN flood (via limitation des connexions)
 * - DDoS applicatif (via limitation des requêtes par IP)
 * - Brute force (via limitation des tentatives)
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

function parseTrustedIpList() {
  const raw = [
    process.env.RATE_LIMIT_TRUSTED_IPS || '',
    process.env.AUTO_BAN_TRUSTED_IPS || ''
  ].join(',');
  return [...new Set(
    raw.split(',').map((entry) => entry.trim()).filter(Boolean)
  )];
}

const TRUSTED_IPS = parseTrustedIpList();
if (TRUSTED_IPS.length > 0) {
  console.log(`🛡️  Rate limit: ${TRUSTED_IPS.length} IP/CIDR de confiance exemptés (RATE_LIMIT_TRUSTED_IPS / AUTO_BAN_TRUSTED_IPS)`);
}

function ipToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0);
}

function isIPInCIDR(ip, cidr) {
  if (!cidr.includes('/')) {
    return ip === cidr;
  }
  const [baseIP, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }
  const ipInt = ipToInt(ip);
  const baseInt = ipToInt(baseIP);
  if (ipInt === null || baseInt === null) {
    return false;
  }
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return (ipInt & mask) === (baseInt & mask);
}

function normalizeClientIp(ip) {
  if (!ip || ip === 'unknown') {
    return ip;
  }
  let normalized = String(ip).trim();
  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.slice(7);
  }
  if (normalized === '::1') {
    normalized = '127.0.0.1';
  }
  return normalized;
}

function getClientIp(req) {
  const raw = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || req.ip
    || 'unknown';
  return normalizeClientIp(raw);
}

function isTrustedIP(ip) {
  const normalized = normalizeClientIp(ip);
  if (!normalized || normalized === 'unknown') {
    return false;
  }
  return TRUSTED_IPS.some((entry) => isIPInCIDR(normalized, entry));
}

const RATE_LIMIT_MAX = Math.max(
  1,
  parseInt(process.env.RATE_LIMIT_MAX, 10) || 100
);

/**
 * Configuration du rate limiter global
 * Limite : RATE_LIMIT_MAX requêtes par minute par IP (défaut 100)
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: RATE_LIMIT_MAX,
  message: {
    error: 'Too many requests',
    message: 'Trop de requêtes depuis cette adresse IP. Veuillez réessayer dans une minute.',
    retryAfter: 60
  },
  standardHeaders: true, // Retourne les headers RateLimit-* dans la réponse
  legacyHeaders: false, // Désactive les headers X-RateLimit-*
  // Store par défaut (mémoire) - pour production, utiliser Redis avec store: new RedisStore()
  // Fonction pour obtenir l'IP réelle (prend en compte le reverse proxy)
  keyGenerator: (req) => ipKeyGenerator(getClientIp(req)),
  // Handler personnalisé pour les requêtes bloquées
  handler: (req, res) => {
    const ip = getClientIp(req);
    
    console.warn(`⚠️  Rate limit dépassé pour IP: ${ip} - ${req.method} ${req.path}`);
    
    res.status(429).json({
      error: 'Too many requests',
      message: 'Trop de requêtes depuis cette adresse IP. Veuillez réessayer dans une minute.',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  },
  // Skip certaines routes (health check, webhooks, OAuth callbacks, etc.)
  skip: (req) => {
    if (isTrustedIP(getClientIp(req))) {
      return true;
    }
    // Ne pas limiter les health checks
    if (req.path === '/api/health') {
      return true;
    }
    // Ne pas limiter les webhooks Facebook (appelés directement par Facebook)
    if (req.path && req.path.includes('/facebook/webhook')) {
      return true;
    }
    // Ne pas limiter les callbacks OAuth (appelés directement par Facebook)
    if (req.path && req.path.includes('/facebook/oauth/callback')) {
      return true;
    }
    return false;
  }
});

/**
 * Rate limiter strict pour les routes sensibles (login, inscription, etc.)
 * Limite : 5 requêtes par 15 minutes par IP
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives par 15 minutes
  message: {
    error: 'Too many attempts',
    message: 'Trop de tentatives depuis cette adresse IP. Veuillez réessayer dans 15 minutes.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(getClientIp(req)),
  skip: (req) => isTrustedIP(getClientIp(req)),
  handler: (req, res) => {
    const ip = getClientIp(req);
    
    console.error(`🚨 Rate limit STRICT dépassé pour IP: ${ip} - ${req.method} ${req.path}`);
    
    res.status(429).json({
      error: 'Too many attempts',
      message: 'Trop de tentatives depuis cette adresse IP. Veuillez réessayer dans 15 minutes.',
      retryAfter: 15 * 60,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rate limiter pour les uploads de fichiers
 * Limite : 10 uploads par heure par IP
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 uploads par heure
  message: {
    error: 'Too many uploads',
    message: 'Trop d\'uploads depuis cette adresse IP. Veuillez réessayer dans une heure.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(getClientIp(req)),
  skip: (req) => isTrustedIP(getClientIp(req))
});

/**
 * Rate limiter pour les API publiques (moins restrictif)
 * Limite : 200 requêtes par minute par IP
 */
const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requêtes par minute
  message: {
    error: 'Too many requests',
    message: 'Trop de requêtes depuis cette adresse IP. Veuillez réessayer dans une minute.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(getClientIp(req)),
  skip: (req) => isTrustedIP(getClientIp(req))
});

/**
 * Middleware pour détecter les connexions suspectes (SYN flood indicators)
 * Log les connexions qui se connectent mais ne font pas de requête complète
 */
const detectSuspiciousConnections = (req, res, next) => {
  const ip = getClientIp(req);
  
  // Détecter les User-Agent suspects ou absents
  const userAgent = req.headers['user-agent'] || 'No User-Agent';
  const isSuspicious = !userAgent || 
    userAgent.length < 10 || 
    userAgent.includes('curl') && !req.headers['accept'] ||
    userAgent.includes('python') && !req.headers['accept'];
  
  if (isSuspicious) {
    console.warn(`⚠️  Connexion suspecte détectée - IP: ${ip}, UA: ${userAgent}`);
  }
  
  // Mesurer le temps de réponse pour détecter les connexions lentes (possible SYN flood)
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > 10000) { // Plus de 10 secondes
      console.warn(`⚠️  Requête lente détectée - IP: ${ip}, Durée: ${duration}ms, Path: ${req.path}`);
    }
  });
  
  next();
};

module.exports = {
  globalLimiter,
  strictLimiter,
  uploadLimiter,
  publicApiLimiter,
  detectSuspiciousConnections
};


