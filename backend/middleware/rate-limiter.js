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

/**
 * Configuration du rate limiter global
 * Limite : 100 requêtes par minute par IP
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute
  message: {
    error: 'Too many requests',
    message: 'Trop de requêtes depuis cette adresse IP. Veuillez réessayer dans une minute.',
    retryAfter: 60
  },
  standardHeaders: true, // Retourne les headers RateLimit-* dans la réponse
  legacyHeaders: false, // Désactive les headers X-RateLimit-*
  // Store par défaut (mémoire) - pour production, utiliser Redis avec store: new RedisStore()
  // Fonction pour obtenir l'IP réelle (prend en compte le reverse proxy)
  keyGenerator: (req) => {
    // Priorité : X-Forwarded-For (reverse proxy) > X-Real-IP > IP directe
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.connection.remoteAddress
      || req.socket.remoteAddress
      || req.ip
      || 'unknown';
    // Utiliser ipKeyGenerator pour gérer correctement IPv6
    return ipKeyGenerator(ip);
  },
  // Handler personnalisé pour les requêtes bloquées
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
      || req.headers['x-real-ip'] 
      || req.connection.remoteAddress 
      || 'unknown';
    
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
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.connection.remoteAddress
      || req.socket.remoteAddress
      || req.ip
      || 'unknown';
    // Utiliser ipKeyGenerator pour gérer correctement IPv6
    return ipKeyGenerator(ip);
  },
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
      || req.headers['x-real-ip'] 
      || req.connection.remoteAddress 
      || 'unknown';
    
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
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.connection.remoteAddress
      || req.socket.remoteAddress
      || req.ip
      || 'unknown';
    return ipKeyGenerator(ip);
  }
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
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.connection.remoteAddress
      || req.socket.remoteAddress
      || req.ip
      || 'unknown';
    return ipKeyGenerator(ip);
  }
});

/**
 * Middleware pour détecter les connexions suspectes (SYN flood indicators)
 * Log les connexions qui se connectent mais ne font pas de requête complète
 */
const detectSuspiciousConnections = (req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.headers['x-real-ip'] 
    || req.connection.remoteAddress 
    || req.socket.remoteAddress
    || 'unknown';
  
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


