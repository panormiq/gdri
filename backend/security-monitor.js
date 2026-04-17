/**
 * Système de monitoring et d'alerte pour les attaques détectées
 * Fichier : backend/security-monitor.js
 * 
 * Ce script surveille les logs Apache pour détecter les attaques
 * et envoie des alertes par email via le module Mail
 */

// ⚠️ IMPORTANT : Charger dotenv EN PREMIER pour que les variables d'environnement soient disponibles
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const readline = require('readline');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const database = require('./config/database');
const mailModule = require(path.join(__dirname, '../modules/mail/backend'));

// Configuration
const CONFIG = {
  // Chemins des logs Apache
  accessLogPath: 'C:/xampp/apache/logs/gdri-ssl-access.log',
  errorLogPath: 'C:/xampp/apache/logs/gdri-ssl-error.log',
  
  // Email de destination pour les alertes
  alertEmail: process.env.SECURITY_ALERT_EMAIL || 'admin@gdri.fr',
  
  // Seuil d'alertes (nombre d'attaques avant d'envoyer une alerte)
  alertThreshold: 5, // Envoyer une alerte après 5 attaques
  
  // Seuil pour les alertes SYN flood (nombre de connexions SYN_RECEIVED)
  // Recommandation : 30 pour détection précoce, 50 pour moins de faux positifs
  synFloodThreshold: parseInt(process.env.SYN_FLOOD_THRESHOLD) || 30, // Alerte si plus de 30 connexions SYN_RECEIVED (configurable via .env)
  
  // Blocage automatique des IPs attaquantes
  autoBanEnabled: process.env.AUTO_BAN_ENABLED !== 'false', // Activé par défaut (désactiver avec AUTO_BAN_ENABLED=false)
  autoBanThreshold: parseInt(process.env.AUTO_BAN_THRESHOLD) || 30, // Bloquer automatiquement si >= 30 connexions SYN_RECEIVED
  autoBanMinConnections: parseInt(process.env.AUTO_BAN_MIN_CONNECTIONS) || 3, // Bloquer une IP si elle a au moins 3 connexions SYN_RECEIVED simultanées
  autoBanSuccessiveConnections: parseInt(process.env.AUTO_BAN_SUCCESSIVE_CONNECTIONS) || 3, // Bloquer une IP si elle a eu 3 connexions SYN_RECEIVED successives (sur plusieurs vérifications)
  autoBanPersistTime: parseInt(process.env.AUTO_BAN_PERSIST_TIME) || 10000, // Ne bloquer que si connexions persistent > 10 secondes (en ms, 0 = désactivé)
  
  // Intervalle de vérification adaptatif (en millisecondes)
  // Système adaptatif basé sur le nombre de connexions SYN_RECEIVED
  adaptiveIntervals: {
    normal: 20000,    // < 10 SYN : 20 secondes
    suspect: 10000,   // 10-19 SYN : 10 secondes
    moderate: 5000,   // 20-29 SYN : 5 secondes
    severe: 3000      // >= 30 SYN : 3 secondes
  },
  checkInterval: 20000, // Intervalle initial (sera ajusté dynamiquement)
  
  // Seuils pour le système adaptatif
  synSuspectThreshold: 10,  // Email de suspicion si >= 10 SYN
  synModerateThreshold: 20, // Passer à 5s si >= 20 SYN
  synSevereThreshold: 30,   // Passer à 3s si >= 30 SYN
  
  // Cooldown pour les emails de suspicion (en millisecondes)
  suspectAlertCooldown: 5 * 60 * 1000, // 5 minutes entre emails de suspicion
  
  // Système de réputation pour bannir les IPs récidivistes
  reputationSystem: {
    enabled: process.env.REPUTATION_SYSTEM_ENABLED !== 'false', // Activé par défaut
    detectionScore: 1,                // Score ajouté par détection d'attaque (sensitive_file_access, etc.)
    moderateScore: 2,                 // Score si attaque modérée (SQL injection, XSS, etc.)
    severeScore: 3,                   // Score si attaque sévère (directory traversal, etc.)
    banThreshold: parseInt(process.env.REPUTATION_BAN_THRESHOLD) || 5, // Ban si score >= 5 en 24h
    timeWindow: 24 * 60 * 60 * 1000,  // Fenêtre de temps : 24 heures (en ms)
    decayRate: 0.1,                    // Décroissance du score par heure (10% par heure)
    minScoreForTracking: 2,            // Commencer à tracker si score >= 2
    cleanupInterval: 60 * 60 * 1000    // Nettoyer les anciennes entrées toutes les heures
  },

  // Ban immédiat pour certains types d'attaques applicatives
  immediateBan: {
    enabled: process.env.IMMEDIATE_BAN_ENABLED !== 'false', // Activé par défaut
    attackTypes: (process.env.IMMEDIATE_BAN_ATTACK_TYPES || 'sensitive_file_access')
      .split(',')
      .map(type => type.trim())
      .filter(Boolean)
  },

  // Garde-fous pour éviter les faux positifs de ban IP
  safeBan: {
    durationMs: parseInt(process.env.AUTO_BAN_DURATION_MS) || (24 * 60 * 60 * 1000), // 24h par défaut
    trustedIPs: (process.env.AUTO_BAN_TRUSTED_IPS || '')
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean), // IPs ou CIDR (ex: 1.2.3.4,10.0.0.0/8)
    skipCloudflareProxyIPs: process.env.AUTO_BAN_SKIP_CLOUDFLARE_PROXY_IPS !== 'false'
  },
  
  // Système de réputation pour bannir les sous-réseaux récidivistes
  subnetReputationSystem: {
    enabled: process.env.SUBNET_REPUTATION_SYSTEM_ENABLED !== 'false', // Activé par défaut
    scoreMultiplier: 0.5,              // Score sous-réseau = 50% du score IP (pour éviter montée trop rapide)
    banThreshold: parseInt(process.env.SUBNET_REPUTATION_BAN_THRESHOLD) || 15, // Ban si score >= 15 en 24h
    timeWindow: 24 * 60 * 60 * 1000,  // Fenêtre de temps : 24 heures (en ms)
    decayRate: 0.1,                    // Décroissance du score par heure (10% par heure)
    minScoreForTracking: 3,            // Commencer à tracker si score >= 3
    subnetMask: 24                     // Masque de sous-réseau /24 (3 premiers octets)
  },
  
  // Fichier de suivi de la position dans les logs
  stateFile: path.join(__dirname, '.security-monitor-state.json'),
  
  // Patterns d'attaque à détecter
  attackPatterns: {
    userAgent: ['nikto', 'acunetix', 'sqlmap', 'havij', 'zmeu', 'masscan', 'nmap', 'netcat', 'nc', 'sqlsus'],
    sqlInjection: ['union.*select', 'exec\\(', 'execute\\(', '\\.\\./', 'union.*all.*select'],
    xss: ['<script', '<embed', '<object', '<iframe', '%3Cscript', '%3Cembed'],
    fileAccess: ['\\.env', '\\.git', '\\.sql', '\\.zip', '\\.tar', '\\.gz', '\\.bak', 'backup', 'dump'],
    directoryTraversal: ['\\.\\./', '\\.\\.\\\\'],
    suspiciousMethods: ['TRACE', 'TRACK', 'DEBUG']
  }
};

// État du monitoring
let state = {
  lastAccessLogPosition: 0,
  lastErrorLogPosition: 0,
  attackCount: 0,
  lastAlertTime: null,
  lastSynFloodAlertTime: null,
  lastSuspectAlertTime: null, // Dernière alerte de suspicion
  attacks: [], // Dernières attaques détectées
  bannedIPs: [], // IPs bloquées automatiquement
  bannedSubnets: [], // Sous-réseaux bloqués automatiquement
  synReceivedHistory: {}, // Historique des connexions SYN_RECEIVED par IP (pour vérifier la persistance)
  successiveConnections: {}, // Tracking des connexions successives par IP : { ip: { count: number, lastSeen: timestamp } }
  currentInterval: null, // Référence à l'intervalle actuel pour le nettoyer si nécessaire
  lastSynCount: 0, // Dernier nombre de SYN détecté (pour éviter changements inutiles)
  ipReputation: {}, // Système de réputation : { ip: { score: number, firstSeen: timestamp, lastSeen: timestamp, detections: [] } }
  subnetReputation: {}, // Système de réputation sous-réseaux : { subnet: { score: number, firstSeen: timestamp, lastSeen: timestamp, detections: [], ipCount: number } }
  banMetadata: {} // Métadonnées de ban: { ip: { bannedAt, expiresAt, reason, attackType, uri } }
};

// Plages Cloudflare IPv4 publiques (éviter de bannir les IPs proxy vues dans les logs Apache)
const CLOUDFLARE_IPV4_CIDRS = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22'
];

class SecurityMonitor {
  constructor() {
    this.mailService = null;
    this.isRunning = false;
    this.checkIntervalId = null; // Référence à l'intervalle actuel pour le nettoyer si nécessaire
  }

  ipToInt(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(part => Number.isNaN(part) || part < 0 || part > 255)) {
      return null;
    }
    return ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0);
  }

  isIPInCIDR(ip, cidr) {
    if (!cidr.includes('/')) {
      return ip === cidr;
    }

    const [baseIP, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);
    if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
      return false;
    }

    const ipInt = this.ipToInt(ip);
    const baseInt = this.ipToInt(baseIP);
    if (ipInt === null || baseInt === null) {
      return false;
    }

    const mask = prefix === 0 ? 0 : ((0xFFFFFFFF << (32 - prefix)) >>> 0);
    return (ipInt & mask) === (baseInt & mask);
  }

  isTrustedIP(ip) {
    return CONFIG.safeBan.trustedIPs.some(entry => this.isIPInCIDR(ip, entry));
  }

  isCloudflareProxyIP(ip) {
    return CLOUDFLARE_IPV4_CIDRS.some(cidr => this.isIPInCIDR(ip, cidr));
  }

  async unbanIP(ip, reason = 'ban_expired') {
    try {
      const ruleName = `Block SYN Flood ${ip}`;
      await execAsync(`netsh advfirewall firewall delete rule name="${ruleName}"`, { windowsHide: true });
      console.log(`✅ [UNBAN IP] ${ip} (${reason})`);
      return { success: true };
    } catch (error) {
      console.warn(`⚠️  [UNBAN IP] Impossible de supprimer la règle pour ${ip}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async cleanupExpiredBans() {
    if (!state.banMetadata) {
      state.banMetadata = {};
      return;
    }

    const now = Date.now();
    const expiredIPs = Object.entries(state.banMetadata)
      .filter(([, meta]) => meta && meta.expiresAt && meta.expiresAt <= now)
      .map(([ip]) => ip);

    if (expiredIPs.length === 0) {
      return;
    }

    for (const ip of expiredIPs) {
      await this.unbanIP(ip, 'ban_expired');
      state.bannedIPs = state.bannedIPs.filter(bannedIP => bannedIP !== ip);
      delete state.banMetadata[ip];
    }

    this.saveState();
  }

  /**
   * Calcule l'intervalle de vérification adaptatif basé sur le nombre de connexions SYN_RECEIVED
   * @param {number} synCount - Nombre de connexions SYN_RECEIVED détectées
   * @returns {Object} - { interval: number, level: string } - Intervalle en ms et niveau de risque
   */
  calculateAdaptiveInterval(synCount) {
    if (synCount < CONFIG.synSuspectThreshold) {
      return { interval: CONFIG.adaptiveIntervals.normal, level: 'normal' };
    } else if (synCount < CONFIG.synModerateThreshold) {
      return { interval: CONFIG.adaptiveIntervals.suspect, level: 'suspect' };
    } else if (synCount < CONFIG.synSevereThreshold) {
      return { interval: CONFIG.adaptiveIntervals.moderate, level: 'moderate' };
    } else {
      return { interval: CONFIG.adaptiveIntervals.severe, level: 'severe' };
    }
  }

  /**
   * Initialise le service Mail
   */
  async initMail() {
    try {
      // Connecter à MongoDB
      await database.connect();
      
      // Initialiser le service Mail
      const mail = mailModule.getMailService();
      await mail.init();
      
      // Configurer le module pour les alertes de sécurité
      mail.initModule({
        module_name: 'security-monitor',
        collection_name: 'security_alerts',
        smtp_profiles: {
          alerts: {
            smtp: {
              host: process.env.SMTP_HOST || 'smtp.gmail.com',
              port: parseInt(process.env.SMTP_PORT || '587'),
              secure: process.env.SMTP_SECURE === 'true',
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
              }
            },
            from: {
              name: 'GDRI Security Monitor',
              // Utiliser SMTP_USER par défaut pour éviter les erreurs de permissions SMTP
              // (Gmail/Office365 ne permet pas d'envoyer depuis une autre adresse que celle d'authentification)
              email: process.env.SMTP_USER || process.env.SMTP_FROM || 'security@gdri.fr'
            }
          }
        },
        routing_rules: [
          {
            condition: { priority: 'high', type: 'security_alert' },
            use_profile: 'alerts',
            default_to: CONFIG.alertEmail
          }
        ]
      });

      this.mailService = mail;
      console.log('✅ Service Mail initialisé');
    } catch (error) {
      console.error('❌ Erreur initialisation Mail:', error);
      throw error;
    }
  }

  /**
   * Charge l'état depuis le fichier
   */
  loadState() {
    try {
      if (fs.existsSync(CONFIG.stateFile)) {
        const data = fs.readFileSync(CONFIG.stateFile, 'utf8');
        state = { ...state, ...JSON.parse(data) };
        
        // Initialiser bannedSubnets si absent (pour compatibilité avec anciennes versions)
        if (!state.bannedSubnets) {
          state.bannedSubnets = [];
        }
        
        // Initialiser subnetReputation si absent
        if (!state.subnetReputation) {
          state.subnetReputation = {};
        }
        
        // Initialiser successiveConnections si absent
        if (!state.successiveConnections) {
          state.successiveConnections = {};
        }
        
        if (!state.banMetadata) {
          state.banMetadata = {};
        }
        
        // Convertir les ips en array si c'est un Set (pour compatibilité)
        if (state.subnetReputation) {
          Object.keys(state.subnetReputation).forEach(subnet => {
            const rep = state.subnetReputation[subnet];
            if (rep.ips && !Array.isArray(rep.ips)) {
              rep.ips = Array.from(rep.ips || []);
              rep.ipCount = rep.ips.length;
            }
          });
        }
        
        console.log('📂 État chargé depuis le fichier');
      }
    } catch (error) {
      console.warn('⚠️  Erreur chargement état:', error.message);
    }
  }

  /**
   * Sauvegarde l'état dans le fichier
   */
  saveState() {
    try {
      fs.writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.warn('⚠️  Erreur sauvegarde état:', error.message);
    }
  }

  /**
   * Analyse une ligne de log pour détecter une attaque
   */
  analyzeLogLine(line, logType = 'access') {
    const attacks = [];

    // Détecter les erreurs 403 (Forbidden)
    if (logType === 'access' && line.includes('" 403 ')) {
      // Extraire les informations de la ligne
      const ipMatch = line.match(/^(\d+\.\d+\.\d+\.\d+)/);
      const methodMatch = line.match(/"(\w+)\s+([^\s]+)/);
      const userAgentMatch = line.match(/"([^"]*)"\s*$/);
      
      const ip = ipMatch ? ipMatch[1] : 'unknown';
      const method = methodMatch ? methodMatch[1] : 'unknown';
      const uri = methodMatch ? methodMatch[2] : 'unknown';
      const userAgent = userAgentMatch ? userAgentMatch[1] : 'unknown';

      // Analyser le type d'attaque
      let attackType = 'unknown';
      let severity = 'medium';

      // Vérifier User-Agent suspect
      if (CONFIG.attackPatterns.userAgent.some(pattern => 
        userAgent.toLowerCase().includes(pattern.toLowerCase())
      )) {
        attackType = 'malicious_user_agent';
        severity = 'high';
      }
      // Vérifier injection SQL
      else if (CONFIG.attackPatterns.sqlInjection.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(uri);
      })) {
        attackType = 'sql_injection';
        severity = 'high';
      }
      // Vérifier XSS
      else if (CONFIG.attackPatterns.xss.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(uri);
      })) {
        attackType = 'xss';
        severity = 'high';
      }
      // Vérifier accès fichiers sensibles
      else if (CONFIG.attackPatterns.fileAccess.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(uri);
      })) {
        attackType = 'sensitive_file_access';
        severity = 'medium';
      }
      // Vérifier traversée de répertoires
      else if (CONFIG.attackPatterns.directoryTraversal.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(uri);
      })) {
        attackType = 'directory_traversal';
        severity = 'high';
      }
      // Vérifier méthodes suspectes
      else if (CONFIG.attackPatterns.suspiciousMethods.includes(method)) {
        attackType = 'suspicious_method';
        severity = 'medium';
      }

      if (attackType !== 'unknown') {
        attacks.push({
          timestamp: new Date(),
          ip,
          method,
          uri,
          userAgent,
          attackType,
          severity,
          logLine: line
        });
      }
    }

    return attacks;
  }

  /**
   * Lit les nouvelles lignes d'un fichier de log
   */
  async readNewLines(filePath, lastPosition, logType = 'access') {
    const attacks = [];
    
    try {
      if (!fs.existsSync(filePath)) {
        return { attacks, newPosition: lastPosition };
      }

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Si le fichier a été tronqué, repartir de 0
      if (fileSize < lastPosition) {
        lastPosition = 0;
      }

      // Si pas de nouvelles données
      if (fileSize === lastPosition) {
        return { attacks, newPosition: lastPosition };
      }

      // Lire les nouvelles lignes
      const stream = fs.createReadStream(filePath, {
        start: lastPosition,
        encoding: 'utf8'
      });

      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (line.trim()) {
          const lineAttacks = this.analyzeLogLine(line, logType);
          attacks.push(...lineAttacks);
        }
      }

      return { attacks, newPosition: fileSize };
    } catch (error) {
      console.error(`❌ Erreur lecture ${filePath}:`, error.message);
      return { attacks, newPosition: lastPosition };
    }
  }

  /**
   * Envoie une alerte par email
   */
  async sendAlert(attacks) {
    if (!this.mailService) {
      console.warn('⚠️  Service Mail non initialisé, impossible d\'envoyer l\'alerte');
      return;
    }

    try {
      // Grouper les attaques par type
      const attacksByType = {};
      const attacksByIP = {};
      
      attacks.forEach(attack => {
        if (!attacksByType[attack.attackType]) {
          attacksByType[attack.attackType] = [];
        }
        attacksByType[attack.attackType].push(attack);

        if (!attacksByIP[attack.ip]) {
          attacksByIP[attack.ip] = [];
        }
        attacksByIP[attack.ip].push(attack);
      });

      // Générer le rapport HTML
      let reportHTML = '<h2>🚨 Alerte de Sécurité - Attaques Détectées</h2>';
      reportHTML += `<p><strong>Nombre total d'attaques:</strong> ${attacks.length}</p>`;
      reportHTML += `<p><strong>Période:</strong> ${attacks[0].timestamp.toLocaleString('fr-FR')} - ${attacks[attacks.length - 1].timestamp.toLocaleString('fr-FR')}</p>`;
      
      reportHTML += '<h3>📊 Répartition par type d\'attaque:</h3><ul>';
      Object.keys(attacksByType).forEach(type => {
        reportHTML += `<li><strong>${type}:</strong> ${attacksByType[type].length} attaque(s)</li>`;
      });
      reportHTML += '</ul>';

      reportHTML += '<h3>🌐 Adresses IP suspectes:</h3><ul>';
      Object.keys(attacksByIP).forEach(ip => {
        const reputation = state.ipReputation[ip];
        const scoreInfo = reputation ? ` (score réputation: ${reputation.score.toFixed(1)}, ${reputation.detections.length} détections)` : '';
        const isBanned = state.bannedIPs.includes(ip);
        const banStatus = isBanned ? ' <span style="color: green; font-weight: bold;">[BLOQUÉE]</span>' : '';
        reportHTML += `<li><strong>${ip}:</strong> ${attacksByIP[ip].length} attaque(s)${scoreInfo}${banStatus}</li>`;
      });
      reportHTML += '</ul>';
      
      // Calculer les IPs avec réputation élevée (proches du ban) - une seule fois pour HTML et texte
      const highReputationIPs = Object.entries(state.ipReputation)
        .filter(([ip, rep]) => rep.score >= CONFIG.reputationSystem.minScoreForTracking && !state.bannedIPs.includes(ip))
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 10);
      
      if (highReputationIPs.length > 0) {
        reportHTML += '<h3>⚠️ IPs avec réputation élevée (surveillance active):</h3><ul>';
        highReputationIPs.forEach(([ip, rep]) => {
          const progress = (rep.score / CONFIG.reputationSystem.banThreshold * 100).toFixed(0);
          reportHTML += `<li><strong>${ip}:</strong> Score ${rep.score.toFixed(1)}/${CONFIG.reputationSystem.banThreshold} (${progress}%) - ${rep.detections.length} détections</li>`;
        });
        reportHTML += '</ul>';
      }

      // Afficher les sous-réseaux avec réputation élevée
      if (CONFIG.subnetReputationSystem.enabled) {
        const highReputationSubnets = Object.entries(state.subnetReputation || {})
          .filter(([subnet, rep]) => rep.score >= CONFIG.subnetReputationSystem.minScoreForTracking && (!state.bannedSubnets || !state.bannedSubnets.includes(subnet)))
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, 10);
        
        if (highReputationSubnets.length > 0) {
          reportHTML += '<h3>🌐 Sous-réseaux avec réputation élevée (surveillance active):</h3><ul>';
          highReputationSubnets.forEach(([subnet, rep]) => {
            const progress = (rep.score / CONFIG.subnetReputationSystem.banThreshold * 100).toFixed(0);
            const isBanned = state.bannedSubnets && state.bannedSubnets.includes(subnet);
            const banStatus = isBanned ? ' <span style="color: green; font-weight: bold;">[BLOQUÉ]</span>' : '';
            reportHTML += `<li><strong>${subnet}:</strong> Score ${rep.score.toFixed(1)}/${CONFIG.subnetReputationSystem.banThreshold} (${progress}%) - ${rep.ipCount} IP(s), ${rep.detections.length} détections${banStatus}</li>`;
          });
          reportHTML += '</ul>';
        }
      }

      reportHTML += '<h3>🔍 Détails des attaques:</h3><table border="1" cellpadding="5" style="border-collapse: collapse;">';
      reportHTML += '<tr><th>Heure</th><th>IP</th><th>Type</th><th>URI</th><th>User-Agent</th></tr>';
      attacks.slice(0, 20).forEach(attack => { // Limiter à 20 pour ne pas surcharger l'email
        reportHTML += `<tr>
          <td>${attack.timestamp.toLocaleString('fr-FR')}</td>
          <td>${attack.ip}</td>
          <td>${attack.attackType}</td>
          <td>${attack.uri.substring(0, 50)}</td>
          <td>${attack.userAgent.substring(0, 50)}</td>
        </tr>`;
      });
      reportHTML += '</table>';

      if (attacks.length > 20) {
        reportHTML += `<p><em>... et ${attacks.length - 20} autre(s) attaque(s)</em></p>`;
      }

      // Générer le rapport texte (pour les clients email qui ne supportent pas HTML)
      let reportText = '🚨 Alerte de Sécurité - Attaques Détectées\n\n';
      reportText += `Nombre total d'attaques: ${attacks.length}\n`;
      reportText += `Période: ${attacks[0].timestamp.toLocaleString('fr-FR')} - ${attacks[attacks.length - 1].timestamp.toLocaleString('fr-FR')}\n\n`;
      
      reportText += '📊 Répartition par type d\'attaque:\n';
      Object.keys(attacksByType).forEach(type => {
        reportText += `  - ${type}: ${attacksByType[type].length} attaque(s)\n`;
      });
      reportText += '\n';

      reportText += '🌐 Adresses IP suspectes:\n';
      Object.keys(attacksByIP).forEach(ip => {
        const reputation = state.ipReputation[ip];
        const scoreInfo = reputation ? ` (score réputation: ${reputation.score.toFixed(1)}, ${reputation.detections.length} détections)` : '';
        const isBanned = state.bannedIPs.includes(ip);
        const banStatus = isBanned ? ' [BLOQUÉE]' : '';
        reportText += `  - ${ip}: ${attacksByIP[ip].length} attaque(s)${scoreInfo}${banStatus}\n`;
      });
      reportText += '\n';
      
      // Réutiliser highReputationIPs calculé plus haut (pour éviter duplication)
      if (highReputationIPs.length > 0) {
        reportText += '⚠️ IPs avec réputation élevée (surveillance active):\n';
        highReputationIPs.forEach(([ip, rep]) => {
          const progress = (rep.score / CONFIG.reputationSystem.banThreshold * 100).toFixed(0);
          reportText += `  - ${ip}: Score ${rep.score.toFixed(1)}/${CONFIG.reputationSystem.banThreshold} (${progress}%) - ${rep.detections.length} détections\n`;
        });
        reportText += '\n';
      }

      // Afficher les sous-réseaux avec réputation élevée
      if (CONFIG.subnetReputationSystem.enabled) {
        const highReputationSubnets = Object.entries(state.subnetReputation || {})
          .filter(([subnet, rep]) => rep.score >= CONFIG.subnetReputationSystem.minScoreForTracking && (!state.bannedSubnets || !state.bannedSubnets.includes(subnet)))
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, 10);
        
        if (highReputationSubnets.length > 0) {
          reportText += '🌐 Sous-réseaux avec réputation élevée (surveillance active):\n';
          highReputationSubnets.forEach(([subnet, rep]) => {
            const progress = (rep.score / CONFIG.subnetReputationSystem.banThreshold * 100).toFixed(0);
            const isBanned = state.bannedSubnets && state.bannedSubnets.includes(subnet);
            const banStatus = isBanned ? ' [BLOQUÉ]' : '';
            reportText += `  - ${subnet}: Score ${rep.score.toFixed(1)}/${CONFIG.subnetReputationSystem.banThreshold} (${progress}%) - ${rep.ipCount} IP(s), ${rep.detections.length} détections${banStatus}\n`;
          });
          reportText += '\n';
        }
      }

      reportText += '🔍 Détails des attaques:\n';
      attacks.slice(0, 20).forEach(attack => {
        reportText += `  - [${attack.timestamp.toLocaleString('fr-FR')}] ${attack.ip} - ${attack.attackType} - ${attack.uri.substring(0, 50)}\n`;
      });
      if (attacks.length > 20) {
        reportText += `  ... et ${attacks.length - 20} autre(s) attaque(s)\n`;
      }

      // Envoyer l'email
      await this.mailService.send({
        to: CONFIG.alertEmail,
        subject: `🚨 Alerte Sécurité - ${attacks.length} attaque(s) détectée(s)`,
        body: reportText,
        body_html: reportHTML,
        context: {
          priority: 'high',
          type: 'security_alert'
        },
        module_name: 'security-monitor'
      });

      console.log(`✅ Alerte envoyée: ${attacks.length} attaque(s) détectée(s)`);
      state.lastAlertTime = new Date();
    } catch (error) {
      console.error('❌ Erreur envoi alerte:', error);
    }
  }

  /**
   * Bloque une IP via le pare-feu Windows
   * @param {string} ip - Adresse IP à bloquer
   * @param {Object} banInfo - Informations sur le ban (optionnel) { reason, score, detections, count, attackType }
   * @returns {Object} - { success: boolean, ip, ruleName, error? }
   */
  async blockIP(ip, banInfo = {}) {
    try {
      await this.cleanupExpiredBans();

      // Vérifier si l'IP est déjà bloquée
      if (state.bannedIPs.includes(ip)) {
        console.log(`⚠️  IP ${ip} déjà bloquée (ignorée)`);
        return { success: false, reason: 'already_banned' };
      }

      // Ignorer les IPs locales et privées (RFC 1918)
      const isLocalIP = ip === '127.0.0.1' || 
                       ip === '0.0.0.0' || 
                       ip === '::1' ||
                       ip.startsWith('192.168.') || 
                       ip.startsWith('10.') ||
                       (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31);
      
      if (isLocalIP) {
        console.log(`⚠️  IP locale ${ip} ignorée (pas de blocage)`);
        return { success: false, reason: 'local_ip' };
      }

      // Garde-fou: ne jamais bannir une IP de confiance
      if (this.isTrustedIP(ip)) {
        console.log(`🛡️  IP de confiance ${ip} ignorée (AUTO_BAN_TRUSTED_IPS)`);
        return { success: false, reason: 'trusted_ip' };
      }

      // Garde-fou Cloudflare: éviter de bannir le proxy au lieu du vrai attaquant
      if (CONFIG.safeBan.skipCloudflareProxyIPs && this.isCloudflareProxyIP(ip)) {
        console.log(`☁️  IP proxy Cloudflare ${ip} ignorée (AUTO_BAN_SKIP_CLOUDFLARE_PROXY_IPS=true)`);
        return { success: false, reason: 'cloudflare_proxy_ip' };
      }

      // Bloquer l'IP via netsh (pare-feu Windows)
      const ruleName = `Block SYN Flood ${ip}`;
      const command = `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=block remoteip=${ip} protocol=TCP`;
      
      try {
        await execAsync(command, { windowsHide: true });
        
        // Ajouter à la liste des IPs bloquées
        if (!state.bannedIPs.includes(ip)) {
          state.bannedIPs.push(ip);
          state.banMetadata[ip] = {
            bannedAt: Date.now(),
            expiresAt: Date.now() + CONFIG.safeBan.durationMs,
            reason: banInfo.reason || 'auto_ban',
            attackType: banInfo.attackType || null,
            uri: banInfo.uri || null
          };
          this.saveState();
        }
        
        // Log détaillé du ban
        const timestamp = new Date().toISOString();
        let logMessage = `🚫 [BAN IP] ${timestamp} - IP: ${ip}`;
        
        if (banInfo.reason) {
          logMessage += ` | Raison: ${banInfo.reason}`;
        }
        if (banInfo.score !== undefined) {
          logMessage += ` | Score réputation: ${banInfo.score.toFixed(1)}`;
        }
        if (banInfo.detections !== undefined) {
          logMessage += ` | Détections: ${banInfo.detections}`;
        }
        if (banInfo.count !== undefined) {
          logMessage += ` | Connexions SYN: ${banInfo.count}`;
        }
        if (banInfo.successiveCount !== undefined) {
          logMessage += ` | Connexions successives: ${banInfo.successiveCount}`;
        }
        if (banInfo.attackType) {
          logMessage += ` | Type attaque: ${banInfo.attackType}`;
        }
        if (banInfo.uri) {
          logMessage += ` | URI: ${banInfo.uri}`;
        }
        if (state.banMetadata[ip]?.expiresAt) {
          logMessage += ` | Expire: ${new Date(state.banMetadata[ip].expiresAt).toISOString()}`;
        }
        logMessage += ` | Règle firewall: ${ruleName}`;
        
        console.log(logMessage);
        return { success: true, ip, ruleName };
      } catch (error) {
        // Si la règle existe déjà, considérer comme succès
        if (error.message.includes('already exists') || error.message.includes('déjà existe')) {
          if (!state.bannedIPs.includes(ip)) {
            state.bannedIPs.push(ip);
            state.banMetadata[ip] = {
              bannedAt: Date.now(),
              expiresAt: Date.now() + CONFIG.safeBan.durationMs,
              reason: banInfo.reason || 'auto_ban',
              attackType: banInfo.attackType || null,
              uri: banInfo.uri || null
            };
            this.saveState();
          }
          console.log(`⚠️  [BAN IP] Règle déjà existante pour ${ip} (ajoutée à la liste)`);
          return { success: true, ip, ruleName, reason: 'already_exists' };
        }
        throw error;
      }
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`❌ [BAN IP ERREUR] ${timestamp} - IP: ${ip} | Erreur: ${error.message}`);
      return { success: false, ip, error: error.message };
    }
  }

  /**
   * Bloque un sous-réseau via le pare-feu Windows
   * @param {string} subnet - Sous-réseau à bloquer (ex: "185.177.72.0/24")
   * @returns {Object} - { success: boolean, subnet, ruleName, error? }
   */
  async blockSubnet(subnet) {
    try {
      // Vérifier si le sous-réseau est déjà bloqué
      if (!state.bannedSubnets) {
        state.bannedSubnets = [];
      }
      if (state.bannedSubnets.includes(subnet)) {
        return { success: false, reason: 'already_banned', subnet };
      }

      // Extraire la plage IP du sous-réseau (ex: "185.177.72.0/24" -> "185.177.72.0-185.177.72.255")
      const parts = subnet.split('/');
      if (parts.length !== 2 || parts[1] !== '24') {
        return { success: false, reason: 'invalid_subnet', subnet };
      }

      const ipParts = parts[0].split('.');
      if (ipParts.length !== 4) {
        return { success: false, reason: 'invalid_subnet', subnet };
      }

      // Pour un /24, bloquer la plage 185.177.72.0-185.177.72.255
      const subnetBase = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
      const subnetRange = `${subnetBase}.0-${subnetBase}.255`;

      // Bloquer le sous-réseau via netsh (pare-feu Windows)
      const ruleName = `Block Subnet ${subnet}`;
      const command = `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=block remoteip=${subnetRange} protocol=TCP`;
      
      try {
        await execAsync(command, { windowsHide: true });
        
        // Ajouter à la liste des sous-réseaux bloqués
        if (!state.bannedSubnets.includes(subnet)) {
          state.bannedSubnets.push(subnet);
          this.saveState();
        }
        
        // Log détaillé du ban de sous-réseau
        const timestamp = new Date().toISOString();
        const reputation = state.subnetReputation[subnet];
        let logMessage = `🚫 [BAN SUBNET] ${timestamp} - Sous-réseau: ${subnet}`;
        if (reputation) {
          logMessage += ` | Score: ${reputation.score.toFixed(1)} | IPs: ${reputation.ipCount} | Détections: ${reputation.detections.length}`;
        }
        logMessage += ` | Plage: ${subnetRange} | Règle firewall: ${ruleName}`;
        console.log(logMessage);
        
        return { success: true, subnet, ruleName, subnetRange };
      } catch (error) {
        // Si la règle existe déjà, considérer comme succès
        if (error.message.includes('already exists') || error.message.includes('déjà existe')) {
          if (!state.bannedSubnets.includes(subnet)) {
            state.bannedSubnets.push(subnet);
            this.saveState();
          }
          const timestamp = new Date().toISOString();
          console.log(`⚠️  [BAN SUBNET] ${timestamp} - Règle déjà existante pour ${subnet} (ajoutée à la liste)`);
          return { success: true, subnet, ruleName, subnetRange, reason: 'already_exists' };
        }
        throw error;
      }
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`❌ [BAN SUBNET ERREUR] ${timestamp} - Sous-réseau: ${subnet} | Erreur: ${error.message}`);
      return { success: false, subnet, error: error.message };
    }
  }

  /**
   * Vérifie si une IP a des connexions SYN_RECEIVED persistantes (attaques)
   */
  isIPPersistent(ip, currentTime) {
    if (!state.synReceivedHistory[ip]) {
      return false;
    }

    const history = state.synReceivedHistory[ip];
    const firstSeen = history.firstSeen;
    const persistDuration = currentTime - firstSeen;

    // Si CONFIG.autoBanPersistTime est 0, ne pas vérifier la persistance
    if (CONFIG.autoBanPersistTime === 0) {
      return true; // Blocage immédiat si persistance désactivée
    }

    // Vérifier si les connexions persistent depuis plus que le seuil
    return persistDuration >= CONFIG.autoBanPersistTime;
  }

  /**
   * Met à jour l'historique des connexions SYN_RECEIVED
   */
  updateSynReceivedHistory(ipCounts, currentTime) {
    // Mettre à jour l'historique pour chaque IP
    Object.keys(ipCounts).forEach(ip => {
      if (!state.synReceivedHistory[ip]) {
        // Première fois qu'on voit cette IP
        state.synReceivedHistory[ip] = {
          firstSeen: currentTime,
          lastSeen: currentTime,
          count: ipCounts[ip]
        };
      } else {
        // IP déjà vue, mettre à jour
        state.synReceivedHistory[ip].lastSeen = currentTime;
        state.synReceivedHistory[ip].count = ipCounts[ip];
      }
    });

    // Nettoyer l'historique : supprimer les IPs qui ne sont plus en SYN_RECEIVED
    // (elles sont devenues ESTABLISHED ou ont expiré - connexions légitimes)
    Object.keys(state.synReceivedHistory).forEach(ip => {
      if (!ipCounts[ip]) {
        // IP n'est plus en SYN_RECEIVED
        // Si elle était là depuis moins de 5 secondes, c'était probablement légitime
        const history = state.synReceivedHistory[ip];
        const duration = currentTime - history.firstSeen;
        
        if (duration < 5000) {
          // Connexion légitime qui s'est établie rapidement - supprimer de l'historique
          delete state.synReceivedHistory[ip];
        }
        // Sinon, garder l'historique un peu (elle était suspecte mais a disparu)
      }
    });

    // Nettoyer l'historique ancien (> 1 heure)
    const oneHourAgo = currentTime - 60 * 60 * 1000;
    Object.keys(state.synReceivedHistory).forEach(ip => {
      if (state.synReceivedHistory[ip].lastSeen < oneHourAgo) {
        delete state.synReceivedHistory[ip];
      }
    });

    this.saveState();
  }

  /**
   * Met à jour le tracking des connexions successives par IP
   * Une IP est bannie si elle a eu X connexions successives (sur plusieurs vérifications)
   * @param {Object} ipCounts - Objet { ip: count } des IPs avec connexions SYN_RECEIVED
   * @param {number} currentTime - Timestamp actuel
   */
  updateSuccessiveConnections(ipCounts, currentTime) {
    // Fenêtre de temps pour considérer une connexion comme "successive" (5 minutes)
    const successiveWindow = 5 * 60 * 1000; // 5 minutes
    
    // Mettre à jour le compteur pour les IPs qui ont des connexions maintenant
    Object.keys(ipCounts).forEach(ip => {
      if (!state.successiveConnections[ip]) {
        state.successiveConnections[ip] = {
          count: 1,
          lastSeen: currentTime,
          firstSeen: currentTime
        };
        console.log(`🔄 [DEBUG SUCCESSIVE] IP ${ip} - Première connexion détectée (compteur: 1/${CONFIG.autoBanSuccessiveConnections})`);
      } else {
        const timeSinceLastSeen = currentTime - state.successiveConnections[ip].lastSeen;
        
        // Si la dernière connexion était il y a moins de 5 minutes, c'est successif
        if (timeSinceLastSeen < successiveWindow) {
          state.successiveConnections[ip].count++;
          console.log(`🔄 [DEBUG SUCCESSIVE] IP ${ip} - Connexion successive détectée (${(timeSinceLastSeen / 1000).toFixed(1)}s depuis dernière) → Compteur: ${state.successiveConnections[ip].count}/${CONFIG.autoBanSuccessiveConnections}`);
        } else {
          // Trop de temps entre les connexions, réinitialiser le compteur
          const minutesSince = (timeSinceLastSeen / 60000).toFixed(1);
          console.log(`🔄 [DEBUG SUCCESSIVE] IP ${ip} - Trop de temps depuis dernière connexion (${minutesSince} min > 5 min) → Réinitialisation compteur`);
          state.successiveConnections[ip].count = 1;
          state.successiveConnections[ip].firstSeen = currentTime;
        }
        
        state.successiveConnections[ip].lastSeen = currentTime;
      }
    });
    
    // Nettoyer les IPs qui n'ont plus de connexions depuis plus de 10 minutes
    const cleanupWindow = 10 * 60 * 1000; // 10 minutes
    Object.keys(state.successiveConnections).forEach(ip => {
      if (!ipCounts[ip]) {
        const timeSinceLastSeen = currentTime - state.successiveConnections[ip].lastSeen;
        if (timeSinceLastSeen > cleanupWindow) {
          delete state.successiveConnections[ip];
        }
      }
    });
    
    this.saveState();
  }

  /**
   * Calcule le score d'une attaque selon sa sévérité
   * @param {string} attackType - Type d'attaque détectée
   * @param {string} severity - Niveau de sévérité (low, medium, high)
   * @returns {number} - Score de l'attaque
   */
  calculateAttackScore(attackType, severity) {
    if (severity === 'high') {
      return CONFIG.reputationSystem.severeScore; // 3 points
    } else if (severity === 'medium') {
      return CONFIG.reputationSystem.moderateScore; // 2 points
    } else {
      return CONFIG.reputationSystem.detectionScore; // 1 point
    }
  }

  /**
   * Met à jour la réputation d'une IP après une détection d'attaque
   * @param {string} ip - Adresse IP
   * @param {string} attackType - Type d'attaque
   * @param {string} severity - Niveau de sévérité
   * @returns {Object} - { score: number, shouldBan: boolean }
   */
  updateIPReputation(ip, attackType, severity) {
    if (!CONFIG.reputationSystem.enabled) {
      return { score: 0, shouldBan: false };
    }

    const currentTime = Date.now();
    const scoreToAdd = this.calculateAttackScore(attackType, severity);

    // Initialiser la réputation si nécessaire
    if (!state.ipReputation[ip]) {
      state.ipReputation[ip] = {
        score: 0,
        firstSeen: currentTime,
        lastSeen: currentTime,
        detections: []
      };
    }

    const reputation = state.ipReputation[ip];

    // Appliquer la décroissance du score (décroissance par heure)
    const hoursSinceLastSeen = (currentTime - reputation.lastSeen) / (60 * 60 * 1000);
    if (hoursSinceLastSeen > 0) {
      const decayAmount = reputation.score * CONFIG.reputationSystem.decayRate * hoursSinceLastSeen;
      reputation.score = Math.max(0, reputation.score - decayAmount);
    }

    // Supprimer les détections anciennes (hors fenêtre de 24h)
    const timeWindow = CONFIG.reputationSystem.timeWindow;
    reputation.detections = reputation.detections.filter(
      detection => (currentTime - detection.timestamp) < timeWindow
    );

    // Ajouter le score et la nouvelle détection
    reputation.score += scoreToAdd;
    reputation.lastSeen = currentTime;
    reputation.detections.push({
      timestamp: currentTime,
      attackType,
      severity,
      score: scoreToAdd
    });

    // Garder seulement les détections dans la fenêtre de 24h
    if (reputation.detections.length > 100) {
      reputation.detections = reputation.detections.slice(-100);
    }

    // Vérifier si l'IP doit être bannie
    const shouldBan = reputation.score >= CONFIG.reputationSystem.banThreshold;

    return {
      score: reputation.score,
      shouldBan,
      detections: reputation.detections.length
    };
  }

  /**
   * Extrait le sous-réseau /24 d'une adresse IP
   * @param {string} ip - Adresse IP (ex: "185.177.72.67")
   * @returns {string} - Sous-réseau /24 (ex: "185.177.72.0/24")
   */
  extractSubnet(ip) {
    // Ignorer les IPs locales et invalides
    if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '0.0.0.0' || ip === '::1') {
      return null;
    }

    // Extraire les 3 premiers octets pour un /24
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return null; // IPv6 ou format invalide
    }

    // Vérifier que c'est une IP valide (pas locale)
    const firstOctet = parseInt(parts[0]);
    const secondOctet = parseInt(parts[1]);
    
    // Ignorer les réseaux privés (RFC 1918)
    if (parts[0] === '192' && parts[1] === '168') return null; // 192.168.x.x
    if (parts[0] === '10') return null; // 10.x.x.x
    if (parts[0] === '172' && secondOctet >= 16 && secondOctet <= 31) return null; // 172.16-31.x.x

    return `${parts[0]}.${parts[1]}.${parts[2]}.0/${CONFIG.subnetReputationSystem.subnetMask}`;
  }

  /**
   * Met à jour la réputation d'un sous-réseau après une détection d'attaque d'une IP
   * @param {string} ip - Adresse IP qui a attaqué
   * @param {number} ipScore - Score ajouté à l'IP
   * @param {string} attackType - Type d'attaque
   * @param {string} severity - Niveau de sévérité
   * @returns {Object} - { score: number, shouldBan: boolean, subnet: string }
   */
  updateSubnetReputation(ip, ipScore, attackType, severity) {
    if (!CONFIG.subnetReputationSystem.enabled) {
      return { score: 0, shouldBan: false, subnet: null };
    }

    const subnet = this.extractSubnet(ip);
    if (!subnet) {
      return { score: 0, shouldBan: false, subnet: null };
    }

    const currentTime = Date.now();
    // Score du sous-réseau = pourcentage du score IP
    const scoreToAdd = ipScore * CONFIG.subnetReputationSystem.scoreMultiplier;

    // Initialiser la réputation si nécessaire
    const isNewSubnet = !state.subnetReputation[subnet];
    if (isNewSubnet) {
      state.subnetReputation[subnet] = {
        score: 0,
        firstSeen: currentTime,
        lastSeen: currentTime,
        detections: [],
        ipCount: 0,
        ips: [] // Array pour tracker les IPs uniques
      };
      console.log(`🆕 [SUBNET NEW] ${subnet} - Nouveau sous-réseau détecté (première attaque)`);
    }

    const reputation = state.subnetReputation[subnet];

    // Ajouter l'IP au tableau si pas déjà présente
    if (!reputation.ips.includes(ip)) {
      reputation.ips.push(ip);
      reputation.ipCount = reputation.ips.length;
    }

    // Appliquer la décroissance du score (décroissance par heure)
    // IMPORTANT: La décroissance ne s'applique que si il y a eu du temps entre les attaques
    // Si le sous-réseau attaque continuellement, le score s'accumule sans décroissance
    const hoursSinceLastSeen = (currentTime - reputation.lastSeen) / (60 * 60 * 1000);
    const scoreBeforeDecay = reputation.score;
    if (hoursSinceLastSeen > 0) {
      const decayAmount = reputation.score * CONFIG.subnetReputationSystem.decayRate * hoursSinceLastSeen;
      reputation.score = Math.max(0, reputation.score - decayAmount);
      if (decayAmount > 0.01) {
        // Log seulement si la décroissance est significative (> 0.01)
        console.log(`📉 [SUBNET DECAY] ${subnet} - Score avant: ${scoreBeforeDecay.toFixed(2)} | Décroissance: ${decayAmount.toFixed(2)} (${(hoursSinceLastSeen * 60).toFixed(1)} min) | Score après: ${reputation.score.toFixed(2)}`);
      }
    }

    // Supprimer les détections anciennes (hors fenêtre de 24h)
    const timeWindow = CONFIG.subnetReputationSystem.timeWindow;
    const detectionsBefore = reputation.detections.length;
    reputation.detections = reputation.detections.filter(
      detection => (currentTime - detection.timestamp) < timeWindow
    );
    const detectionsAfter = reputation.detections.length;

    // Ajouter le score et la nouvelle détection (CUMULATIF - le score s'accumule)
    const scoreBeforeAdd = reputation.score;
    reputation.score += scoreToAdd;
    reputation.lastSeen = currentTime;
    
    // Log de l'accumulation du score pour les sous-réseaux actifs
    if (reputation.score >= CONFIG.subnetReputationSystem.minScoreForTracking) {
      const progress = (reputation.score / CONFIG.subnetReputationSystem.banThreshold * 100).toFixed(0);
      console.log(`📊 [SUBNET SCORE] ${subnet} - Score: ${scoreBeforeAdd.toFixed(2)} + ${scoreToAdd.toFixed(2)} = ${reputation.score.toFixed(2)}/${CONFIG.subnetReputationSystem.banThreshold} (${progress}%) | IPs: ${reputation.ipCount} | Détections: ${detectionsAfter} (${detectionsBefore - detectionsAfter} anciennes supprimées)`);
    }
    reputation.detections.push({
      timestamp: currentTime,
      ip,
      attackType,
      severity,
      score: scoreToAdd
    });

    // Garder seulement les détections dans la fenêtre de 24h
    if (reputation.detections.length > 100) {
      reputation.detections = reputation.detections.slice(-100);
    }

    // Vérifier si le sous-réseau doit être banni
    const shouldBan = reputation.score >= CONFIG.subnetReputationSystem.banThreshold;

    return {
      score: reputation.score,
      shouldBan,
      detections: reputation.detections.length,
      subnet,
      ipCount: reputation.ipCount
    };
  }

  /**
   * Nettoie les anciennes entrées de réputation (nettoyage périodique)
   */
  cleanupReputationHistory() {
    if (!CONFIG.reputationSystem.enabled) {
      return;
    }

    const currentTime = Date.now();
    const timeWindow = CONFIG.reputationSystem.timeWindow;
    const cleanupAge = timeWindow * 2; // Nettoyer les entrées > 48h sans activité

    Object.keys(state.ipReputation).forEach(ip => {
      const reputation = state.ipReputation[ip];
      const timeSinceLastSeen = currentTime - reputation.lastSeen;

      // Supprimer les entrées anciennes sans activité
      if (timeSinceLastSeen > cleanupAge && reputation.score < CONFIG.reputationSystem.minScoreForTracking) {
        delete state.ipReputation[ip];
        return;
      }

      // Appliquer la décroissance du score
      const hoursSinceLastSeen = timeSinceLastSeen / (60 * 60 * 1000);
      if (hoursSinceLastSeen > 0) {
        const decayAmount = reputation.score * CONFIG.reputationSystem.decayRate * hoursSinceLastSeen;
        reputation.score = Math.max(0, reputation.score - decayAmount);
      }

      // Supprimer les détections anciennes
      reputation.detections = reputation.detections.filter(
        detection => (currentTime - detection.timestamp) < timeWindow
      );

      // Si le score est à 0 et pas d'activité récente, supprimer l'entrée
      if (reputation.score < 0.1 && timeSinceLastSeen > timeWindow) {
        delete state.ipReputation[ip];
      }
    });

    // Nettoyer aussi les sous-réseaux
    if (CONFIG.subnetReputationSystem.enabled) {
      const subnetTimeWindow = CONFIG.subnetReputationSystem.timeWindow;
      const subnetCleanupAge = subnetTimeWindow * 2;

      Object.keys(state.subnetReputation).forEach(subnet => {
        const reputation = state.subnetReputation[subnet];
        const timeSinceLastSeen = currentTime - reputation.lastSeen;

        // Supprimer les entrées anciennes sans activité
        if (timeSinceLastSeen > subnetCleanupAge && reputation.score < CONFIG.subnetReputationSystem.minScoreForTracking) {
          delete state.subnetReputation[subnet];
          return;
        }

        // Appliquer la décroissance du score
        const hoursSinceLastSeen = timeSinceLastSeen / (60 * 60 * 1000);
        if (hoursSinceLastSeen > 0) {
          const decayAmount = reputation.score * CONFIG.subnetReputationSystem.decayRate * hoursSinceLastSeen;
          reputation.score = Math.max(0, reputation.score - decayAmount);
        }

        // Supprimer les détections anciennes
        reputation.detections = reputation.detections.filter(
          detection => (currentTime - detection.timestamp) < subnetTimeWindow
        );

        // Si le score est à 0 et pas d'activité récente, supprimer l'entrée
        if (reputation.score < 0.1 && timeSinceLastSeen > subnetTimeWindow) {
          delete state.subnetReputation[subnet];
        }
      });
    }
  }

  /**
   * Bannit automatiquement les IPs avec une réputation élevée (score >= seuil)
   * @param {Array} attacks - Liste des attaques détectées
   * @returns {Object} - { bannedIPs: [], failedIPs: [] }
   */
  async banReputationIPs(attacks) {
    if (!CONFIG.reputationSystem.enabled) {
      return { bannedIPs: [], failedIPs: [] };
    }

    const bannedIPs = [];
    const failedIPs = [];
    const ipScores = {};
    const immediatelyProcessedIPs = new Set();

    // Regrouper les attaques par IP et mettre à jour les réputations
    for (const attack of attacks) {
      const { ip, attackType, severity, uri } = attack;
      
      // Ignorer les IPs locales
      const isLocalIP = ip === '127.0.0.1' || 
                       ip === '0.0.0.0' || 
                       ip === '::1' ||
                       ip.startsWith('192.168.') || 
                       ip.startsWith('10.') ||
                       (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31);
      
      if (isLocalIP) {
        continue;
      }

      // Ban immédiat pour types d'attaque critiques configurés (ex: sensitive_file_access)
      const shouldImmediateBan = CONFIG.immediateBan.enabled &&
        CONFIG.immediateBan.attackTypes.includes(attackType);

      if (shouldImmediateBan && !immediatelyProcessedIPs.has(ip) && !state.bannedIPs.includes(ip)) {
        const result = await this.blockIP(ip, {
          reason: 'immediate_attack_type',
          attackType,
          severity,
          uri
        });

        immediatelyProcessedIPs.add(ip);

        if (result.success) {
          bannedIPs.push({
            ip,
            score: null,
            detections: 1,
            ruleName: result.ruleName,
            reason: 'immediate_attack_type',
            attackType
          });
          continue; // Déjà bannie, inutile de poursuivre la réputation pour cette attaque
        } else if (result.reason !== 'already_banned' && result.reason !== 'local_ip') {
          failedIPs.push({ ip, score: null, error: result.error, reason: 'immediate_attack_type' });
          continue;
        }
      }

      // Mettre à jour la réputation de l'IP
      const result = this.updateIPReputation(ip, attackType, severity);
      
      // Mettre à jour le score maximum pour cette IP
      if (!ipScores[ip]) {
        ipScores[ip] = {
          ip,
          score: result.score,
          shouldBan: result.shouldBan,
          detections: result.detections,
          attackType,
          severity
        };
      } else if (result.score > ipScores[ip].score) {
        ipScores[ip].score = result.score;
        ipScores[ip].shouldBan = result.shouldBan;
        ipScores[ip].detections = result.detections;
        ipScores[ip].attackType = attackType;
        ipScores[ip].severity = severity;
      }

      // Mettre à jour aussi la réputation du sous-réseau
      if (CONFIG.subnetReputationSystem.enabled) {
        const scoreToAdd = this.calculateAttackScore(attackType, severity);
        this.updateSubnetReputation(ip, scoreToAdd, attackType, severity);
      }
    }

    // Bannir les IPs avec score élevé
    for (const [ip, info] of Object.entries(ipScores)) {
      if (info.shouldBan && !state.bannedIPs.includes(ip)) {
        const result = await this.blockIP(ip, {
          reason: 'reputation_threshold',
          score: info.score,
          detections: info.detections,
          attackType: info.attackType,
          severity: info.severity
        });
        if (result.success) {
          bannedIPs.push({
            ip,
            score: info.score,
            detections: info.detections,
            ruleName: result.ruleName,
            reason: 'reputation_threshold'
          });
          // Supprimer de la réputation car bannie
          delete state.ipReputation[ip];
        } else if (result.reason !== 'already_banned' && result.reason !== 'local_ip') {
          failedIPs.push({ ip, score: info.score, error: result.error });
        }
      }
    }

    // Nettoyer périodiquement l'historique de réputation
    this.cleanupReputationHistory();

    if (bannedIPs.length > 0) {
      console.log(`\n📊 Résumé: ${bannedIPs.length} IP(s) bannie(s) automatiquement (système de réputation)`);
    }

    return { bannedIPs, failedIPs };
  }

  /**
   * Bannit automatiquement les sous-réseaux avec une réputation élevée (score >= seuil)
   * @returns {Object} - { bannedSubnets: [], failedSubnets: [] }
   */
  async banReputationSubnets() {
    if (!CONFIG.subnetReputationSystem.enabled) {
      return { bannedSubnets: [], failedSubnets: [] };
    }

    const bannedSubnets = [];
    const failedSubnets = [];

    // Parcourir tous les sous-réseaux trackés
    for (const [subnet, reputation] of Object.entries(state.subnetReputation)) {
      // Vérifier si le sous-réseau doit être banni
      if (reputation.score >= CONFIG.subnetReputationSystem.banThreshold) {
        // Vérifier si déjà banni
        if (!state.bannedSubnets || !state.bannedSubnets.includes(subnet)) {
          console.log(`\n🚫 Sous-réseau récidiviste détecté: ${subnet} (score: ${reputation.score.toFixed(1)}, ${reputation.ipCount} IP(s), ${reputation.detections.length} détections)`);
          
          const result = await this.blockSubnet(subnet);
          if (result.success) {
            bannedSubnets.push({
              subnet,
              score: reputation.score,
              ipCount: reputation.ipCount,
              detections: reputation.detections.length,
              ruleName: result.ruleName,
              subnetRange: result.subnetRange,
              reason: 'reputation_threshold'
            });
            // Supprimer de la réputation car banni
            delete state.subnetReputation[subnet];
          } else if (result.reason !== 'already_banned') {
            failedSubnets.push({ subnet, score: reputation.score, error: result.error });
          }
        }
      }
    }

    if (bannedSubnets.length > 0) {
      console.log(`\n📊 Résumé: ${bannedSubnets.length} sous-réseau(x) banni(s) automatiquement (système de réputation)`);
    }

    return { bannedSubnets, failedSubnets };
  }

  /**
   * Bloque automatiquement les IPs attaquantes si le seuil est dépassé
   */
  async autoBanIPs(ipCounts, synCount) {
    if (!CONFIG.autoBanEnabled) {
      console.log(`⚠️  [DEBUG AUTO-BAN] Auto-ban désactivé (AUTO_BAN_ENABLED=false)`);
      return { bannedIPs: [], failedIPs: [] };
    }

    if (synCount < CONFIG.autoBanThreshold) {
      console.log(`⚠️  [DEBUG AUTO-BAN] Seuil non atteint: ${synCount} < ${CONFIG.autoBanThreshold}`);
      return { bannedIPs: [], failedIPs: [] };
    }

    const currentTime = Date.now();
    
    console.log(`\n🔧 [DEBUG AUTO-BAN] Analyse de ${Object.keys(ipCounts).length} IP(s) pour blocage automatique`);
    
    // Mettre à jour l'historique pour vérifier la persistance
    this.updateSynReceivedHistory(ipCounts, currentTime);
    
    // Mettre à jour le tracking des connexions successives
    this.updateSuccessiveConnections(ipCounts, currentTime);

    const bannedIPs = [];
    const failedIPs = [];
    const skippedIPs = []; // IPs non bloquées car connexions pas persistantes
    const subnetCounts = {}; // Compter les IPs par sous-réseau pour les SYN flood

    // Bloquer les IPs qui ont au moins CONFIG.autoBanMinConnections connexions
    for (const [ip, count] of Object.entries(ipCounts)) {
      // Tracker les sous-réseaux pour les SYN flood
      if (CONFIG.subnetReputationSystem.enabled) {
        const subnet = this.extractSubnet(ip);
        if (subnet) {
          if (!subnetCounts[subnet]) {
            subnetCounts[subnet] = { ipCount: 0, totalConnections: 0, ips: [] };
          }
          subnetCounts[subnet].ipCount++;
          subnetCounts[subnet].totalConnections += count;
          if (!subnetCounts[subnet].ips.includes(ip)) {
            subnetCounts[subnet].ips.push(ip);
          }
        }
      }
      console.log(`🔍 [DEBUG AUTO-BAN] Analyse IP: ${ip} - ${count} connexion(s) (seuil min: ${CONFIG.autoBanMinConnections})`);
      
      if (count >= CONFIG.autoBanMinConnections) {
        // Vérifier la persistance si activée
        if (CONFIG.autoBanPersistTime > 0 && !this.isIPPersistent(ip, currentTime)) {
          // Connexions pas encore persistantes - attendre un peu
          const history = state.synReceivedHistory[ip];
          const persistDuration = currentTime - history.firstSeen;
          const remaining = Math.ceil((CONFIG.autoBanPersistTime - persistDuration) / 1000);
          console.log(`⏳ [DEBUG AUTO-BAN] IP ${ip} pas encore persistante: ${persistDuration}ms < ${CONFIG.autoBanPersistTime}ms (reste ${remaining}s)`);
          skippedIPs.push({ ip, count, remaining });
          continue; // Ne pas bloquer encore
        }
        
        console.log(`✅ [DEBUG AUTO-BAN] IP ${ip} éligible pour ban (${count} connexions, persistance OK)`);

        // IP suspecte : connexions persistantes ou persistance désactivée
        const result = await this.blockIP(ip, {
          reason: 'syn_flood',
          count: count,
          synCount: synCount
        });
        if (result.success) {
          bannedIPs.push({ ip, count, ruleName: result.ruleName });
          // Supprimer de l'historique car bloquée
          delete state.synReceivedHistory[ip];
        } else if (result.reason !== 'already_banned' && result.reason !== 'local_ip') {
          console.log(`❌ [DEBUG AUTO-BAN] Échec ban IP ${ip}: ${result.reason || result.error}`);
          failedIPs.push({ ip, count, error: result.error });
        } else {
          console.log(`⚠️  [DEBUG AUTO-BAN] IP ${ip} ignorée: ${result.reason}`);
        }
      } else {
        console.log(`⚠️  [DEBUG AUTO-BAN] IP ${ip} sous le seuil: ${count} < ${CONFIG.autoBanMinConnections} connexions requises`);
        
        // Vérifier les connexions successives même si pas assez de connexions simultanées
        const successiveInfo = state.successiveConnections[ip];
        if (successiveInfo && successiveInfo.count >= CONFIG.autoBanSuccessiveConnections) {
          console.log(`🔄 [DEBUG AUTO-BAN] IP ${ip} a ${successiveInfo.count} connexions successives (seuil: ${CONFIG.autoBanSuccessiveConnections}) - BAN pour connexions successives`);
          
          const result = await this.blockIP(ip, {
            reason: 'syn_flood_successive',
            count: count,
            successiveCount: successiveInfo.count,
            synCount: synCount
          });
          
          if (result.success) {
            bannedIPs.push({ 
              ip, 
              count, 
              successiveCount: successiveInfo.count,
              ruleName: result.ruleName,
              reason: 'successive_connections'
            });
            // Supprimer de l'historique car bloquée
            delete state.synReceivedHistory[ip];
            delete state.successiveConnections[ip];
          } else if (result.reason !== 'already_banned' && result.reason !== 'local_ip') {
            console.log(`❌ [DEBUG AUTO-BAN] Échec ban IP ${ip} (successive): ${result.reason || result.error}`);
            failedIPs.push({ ip, count, error: result.error });
          } else {
            console.log(`⚠️  [DEBUG AUTO-BAN] IP ${ip} ignorée (successive): ${result.reason}`);
          }
        } else if (successiveInfo) {
          console.log(`🔄 [DEBUG AUTO-BAN] IP ${ip} a ${successiveInfo.count}/${CONFIG.autoBanSuccessiveConnections} connexions successives`);
        }
      }
    }

    if (bannedIPs.length > 0) {
      console.log(`\n📊 Résumé: ${bannedIPs.length} IP(s) bloquée(s) automatiquement (SYN flood)`);
    }

    if (skippedIPs.length > 0) {
      console.log(`\n⏳ ${skippedIPs.length} IP(s) surveillée(s) (connexions pas encore persistantes):`);
      skippedIPs.forEach(({ ip, count, remaining }) => {
        console.log(`   - ${ip} (${count} connexions, attendre ${remaining}s avant blocage si persistance)`);
      });
    }

    if (failedIPs.length > 0) {
      console.warn(`\n⚠️  ${failedIPs.length} IP(s) n'ont pas pu être bloquée(s):`);
      failedIPs.forEach(({ ip, error }) => {
        console.warn(`   - ${ip}: ${error}`);
      });
    }

    // Mettre à jour la réputation des sous-réseaux pour les SYN flood
    if (CONFIG.subnetReputationSystem.enabled && Object.keys(subnetCounts).length > 0) {
      console.log(`\n🌐 [DEBUG SUBNET SYN] Analyse de ${Object.keys(subnetCounts).length} sous-réseau(x) pour SYN flood`);
      
      for (const [subnet, info] of Object.entries(subnetCounts)) {
        // Pour les SYN flood, on ajoute un score basé sur le nombre d'IPs et connexions
        // Score = (nombre d'IPs * 0.5) + (connexions totales * 0.1)
        // Cela permet de tracker les sous-réseaux avec beaucoup d'IPs différentes (attaque distribuée)
        const synFloodScore = (info.ipCount * 0.5) + (info.totalConnections * 0.1);
        
        // Mettre à jour la réputation du sous-réseau
        // Pour les SYN flood, on utilise directement le score calculé (pas besoin de multiplier car c'est déjà un score agrégé)
        // On passe un score IP fictif qui sera multiplié par 0.5, donc on multiplie par 2 pour compenser
        const fakeIPScore = synFloodScore / CONFIG.subnetReputationSystem.scoreMultiplier;
        const result = this.updateSubnetReputation(
          info.ips[0], // Utiliser la première IP du sous-réseau comme référence
          fakeIPScore,
          'syn_flood',
          info.ipCount >= 10 ? 'high' : info.ipCount >= 5 ? 'medium' : 'low'
        );
        
        if (result.score >= CONFIG.subnetReputationSystem.minScoreForTracking) {
          console.log(`📊 [DEBUG SUBNET SYN] ${subnet} - Score: ${result.score.toFixed(2)}/${CONFIG.subnetReputationSystem.banThreshold} | IPs: ${info.ipCount} | Connexions: ${info.totalConnections}`);
        }
      }
      
      // Vérifier et bannir les sous-réseaux avec score élevé
      const subnetBanResult = await this.banReputationSubnets();
      if (subnetBanResult.bannedSubnets.length > 0) {
        console.log(`\n🚫 ${subnetBanResult.bannedSubnets.length} sous-réseau(x) banni(s) automatiquement (SYN flood)`);
      }
    }

    return { bannedIPs, failedIPs, skippedIPs };
  }

  /**
   * Détecte les attaques SYN flood via netstat
   * @returns {Promise<number>} - Nombre de connexions SYN_RECEIVED détectées (0 si aucune)
   */
  async checkSynFlood() {
    try {
      // Exécuter netstat pour obtenir les connexions SYN_RECEIVED sur le port 443
      const { stdout, stderr } = await execAsync('netstat -ano | findstr :443 | findstr SYN_RECEIVED', {
        windowsHide: true
      });
      
      if (!stdout || stdout.trim().length === 0) {
        state.lastSynCount = 0;
        return 0; // Aucune connexion SYN_RECEIVED
      }
      
      const lines = stdout.split('\n').filter(line => line.trim());
      const synReceived = lines.length;
      state.lastSynCount = synReceived;
      
      // Extraire les IPs attaquantes
      // Format netstat: TCP    192.168.0.32:443       177.37.16.23:36770     SYN_RECEIVED    16152
      const attackingIPs = [];
      lines.forEach(line => {
        // Parser la ligne: TCP    LOCAL_IP:PORT   REMOTE_IP:PORT   STATE   PID
        // Utiliser regex pour extraire l'IP distante (2ème adresse IP:port)
        const match = line.match(/TCP\s+\S+:\d+\s+(\d+\.\d+\.\d+\.\d+):\d+\s+SYN_RECEIVED/);
        if (match && match[1]) {
          const ip = match[1];
          // Garder toutes les IPs (même locales) pour l'analyse
          attackingIPs.push(ip);
        }
      });
      
      // Compter les occurrences par IP
      const ipCounts = {};
      attackingIPs.forEach(ip => {
        ipCounts[ip] = (ipCounts[ip] || 0) + 1;
      });
      
      // Log de debug : afficher les IPs détectées
      if (Object.keys(ipCounts).length > 0) {
        console.log(`\n🔍 [DEBUG SYN FLOOD] ${synReceived} connexions SYN_RECEIVED - IPs détectées:`);
        Object.entries(ipCounts)
          .sort((a, b) => b[1] - a[1])
          .forEach(([ip, count]) => {
            console.log(`   - ${ip}: ${count} connexion(s)`);
          });
      } else {
        console.log(`\n⚠️  [DEBUG SYN FLOOD] ${synReceived} connexions SYN_RECEIVED mais aucune IP distante extraite (peut être réseau local)`);
      }
      
      const now = new Date();
      
      // Attaque sévère (>= 30 SYN) : Alerte complète + Auto-ban
      if (synReceived >= CONFIG.synSevereThreshold) {
        console.log(`\n🚨 ALERTE SYN FLOOD SÉVÈRE : ${synReceived} connexions SYN_RECEIVED détectées!`);
        console.log(`🔧 [DEBUG] Auto-ban activé: ${CONFIG.autoBanEnabled} | Seuil: ${CONFIG.autoBanThreshold} | Min connexions/IP: ${CONFIG.autoBanMinConnections} | Persistance: ${CONFIG.autoBanPersistTime}ms`);
        
        // Blocage automatique des IPs attaquantes
        const banResult = await this.autoBanIPs(ipCounts, synReceived);
        
        // Éviter les alertes trop fréquentes (max 1 toutes les 10 minutes)
        if (!state.lastSynFloodAlertTime || (now - state.lastSynFloodAlertTime) > 10 * 60 * 1000) {
          await this.sendSynFloodAlert(synReceived, ipCounts, lines, banResult);
          state.lastSynFloodAlertTime = now;
        }
      }
      // Attaque modérée (20-29 SYN) : Log uniquement (pas d'alerte sévère encore)
      else if (synReceived >= CONFIG.synModerateThreshold) {
        console.log(`\n⚠️  ATTENTION : ${synReceived} connexions SYN_RECEIVED (niveau modéré)`);
      }
      // Suspicion (10-19 SYN) : Email de suspicion
      else if (synReceived >= CONFIG.synSuspectThreshold) {
        console.log(`\n⚠️  SUSPICION : ${synReceived} connexions SYN_RECEIVED (niveau suspect)`);
        
        // Éviter les alertes de suspicion trop fréquentes (max 1 toutes les 5 minutes)
        if (!state.lastSuspectAlertTime || (now - state.lastSuspectAlertTime) > CONFIG.suspectAlertCooldown) {
          await this.sendSuspectAlert(synReceived, ipCounts, lines);
          state.lastSuspectAlertTime = now;
        }
      }
      // Normal (< 10 SYN) : Pas de log (évite le spam)
      
      return synReceived;
    } catch (error) {
      // netstat peut échouer si aucune connexion SYN_RECEIVED (code 1) ou autre erreur
      if (error.code !== 1) { // Code 1 = aucune correspondance (normal si pas d'attaque)
        console.warn(`⚠️  Erreur détection SYN flood: ${error.message}`);
      }
      state.lastSynCount = 0;
      return 0;
    }
  }

  /**
   * Envoie une alerte email pour une attaque SYN flood
   */
  async sendSynFloodAlert(synCount, ipCounts, rawLines = [], banResult = null) {
    if (!this.mailService) {
      console.warn('⚠️  Service Mail non initialisé, impossible d\'envoyer l\'alerte SYN flood');
      return;
    }

    try {
      // Générer le rapport HTML
      let reportHTML = '<h2>🚨 ALERTE SYN FLOOD Détectée</h2>';
      reportHTML += `<p><strong>Nombre de connexions SYN_RECEIVED:</strong> ${synCount}</p>`;
      reportHTML += `<p><strong>Seuil configuré:</strong> ${CONFIG.synFloodThreshold}</p>`;
      reportHTML += `<p><strong>Blocage automatique:</strong> ${CONFIG.autoBanEnabled ? '✅ Activé' : '❌ Désactivé'}</p>`;
      reportHTML += `<p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>`;
      
      if (Object.keys(ipCounts).length > 0) {
        reportHTML += '<h3>🌐 IPs suspectes (top 10):</h3><ul>';
        const sortedIPs = Object.entries(ipCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        sortedIPs.forEach(([ip, count]) => {
          const isBanned = banResult && banResult.bannedIPs.some(b => b.ip === ip);
          const banStatus = isBanned ? ' <span style="color: green; font-weight: bold;">[BLOQUÉE]</span>' : '';
          reportHTML += `<li><strong>${ip}:</strong> ${count} connexion(s) SYN_RECEIVED${banStatus}</li>`;
        });
        reportHTML += '</ul>';
      } else {
        reportHTML += '<p><em>Aucune IP distante identifiée (peut être une attaque depuis le réseau local)</em></p>';
      }
      
      // Afficher les IPs bloquées automatiquement
      if (banResult && banResult.bannedIPs && banResult.bannedIPs.length > 0) {
        reportHTML += '<h3>🚫 IPs bloquées automatiquement:</h3><ul>';
        banResult.bannedIPs.forEach(({ ip, count, ruleName }) => {
          reportHTML += `<li><strong>${ip}:</strong> ${count} connexion(s) → Règle: ${ruleName}</li>`;
        });
        reportHTML += '</ul>';
      }
      
      // Afficher les IPs surveillées (pas encore persistantes)
      if (banResult && banResult.skippedIPs && banResult.skippedIPs.length > 0) {
        reportHTML += '<h3>⏳ IPs surveillées (connexions pas encore persistantes):</h3><ul>';
        reportHTML += '<li><em>Ces IPs sont surveillées mais pas encore bloquées car leurs connexions SYN_RECEIVED ne persistent pas assez longtemps.</em></li>';
        banResult.skippedIPs.forEach(({ ip, count, remaining }) => {
          reportHTML += `<li><strong>${ip}:</strong> ${count} connexion(s) → Blocage dans ${remaining}s si persistance</li>`;
        });
        reportHTML += '</ul>';
      }
      
      if (rawLines.length > 0 && rawLines.length <= 20) {
        reportHTML += '<h3>📋 Détails des connexions SYN_RECEIVED:</h3><pre style="background: #f5f5f5; padding: 10px; overflow-x: auto;">';
        rawLines.slice(0, 20).forEach(line => {
          reportHTML += line.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n';
        });
        reportHTML += '</pre>';
      }

      // Générer le rapport texte
      let reportText = '🚨 ALERTE SYN FLOOD Détectée\n\n';
      reportText += `Nombre de connexions SYN_RECEIVED: ${synCount}\n`;
      reportText += `Seuil configuré: ${CONFIG.synFloodThreshold}\n`;
      reportText += `Blocage automatique: ${CONFIG.autoBanEnabled ? 'Activé' : 'Désactivé'}\n`;
      reportText += `Date: ${new Date().toLocaleString('fr-FR')}\n\n`;
      
      if (Object.keys(ipCounts).length > 0) {
        reportText += '🌐 IPs suspectes (top 10):\n';
        const sortedIPs = Object.entries(ipCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        sortedIPs.forEach(([ip, count]) => {
          const isBanned = banResult && banResult.bannedIPs.some(b => b.ip === ip);
          const banStatus = isBanned ? ' [BLOQUÉE]' : '';
          reportText += `  - ${ip}: ${count} connexion(s) SYN_RECEIVED${banStatus}\n`;
        });
      }
      
      // Afficher les IPs bloquées automatiquement
      if (banResult && banResult.bannedIPs && banResult.bannedIPs.length > 0) {
        reportText += '\n🚫 IPs bloquées automatiquement:\n';
        banResult.bannedIPs.forEach(({ ip, count, ruleName }) => {
          reportText += `  - ${ip}: ${count} connexion(s) → Règle: ${ruleName}\n`;
        });
      }
      
      // Afficher les IPs surveillées (pas encore persistantes)
      if (banResult && banResult.skippedIPs && banResult.skippedIPs.length > 0) {
        reportText += '\n⏳ IPs surveillées (connexions pas encore persistantes):\n';
        reportText += '  Ces IPs sont surveillées mais pas encore bloquées car leurs connexions SYN_RECEIVED ne persistent pas assez longtemps.\n';
        banResult.skippedIPs.forEach(({ ip, count, remaining }) => {
          reportText += `  - ${ip}: ${count} connexion(s) → Blocage dans ${remaining}s si persistance\n`;
        });
      }

      // Envoyer l'email en utilisant directement le profil 'alerts'
      await this.mailService.send({
        to: CONFIG.alertEmail,
        subject: `🚨 ALERTE SYN FLOOD - ${synCount} connexions SYN_RECEIVED`,
        body: reportText,
        body_html: reportHTML,
        profile: 'alerts',
        context: {
          priority: 'high',
          type: 'syn_flood_alert'
        },
        module_name: 'security-monitor'
      });

      console.log(`✅ Alerte SYN flood envoyée: ${synCount} connexions SYN_RECEIVED`);
    } catch (error) {
      console.error('❌ Erreur envoi alerte SYN flood:', error);
    }
  }

  /**
   * Envoie un email de suspicion pour un nombre modéré de connexions SYN_RECEIVED (10-29 SYN)
   * Plus léger que l'alerte SYN flood sévère, permet une détection précoce
   */
  async sendSuspectAlert(synCount, ipCounts, rawLines = []) {
    if (!this.mailService) {
      console.warn('⚠️  Service Mail non initialisé, impossible d\'envoyer l\'alerte de suspicion');
      return;
    }

    try {
      // Générer le rapport HTML (plus léger que l'alerte sévère)
      let reportHTML = '<h2>⚠️ Suspicion d\'Attaque SYN Flood</h2>';
      reportHTML += `<p><strong>Nombre de connexions SYN_RECEIVED:</strong> ${synCount}</p>`;
      reportHTML += `<p><strong>Niveau:</strong> Suspicion (détection précoce)</p>`;
      reportHTML += `<p><strong>Seuil de suspicion:</strong> >= ${CONFIG.synSuspectThreshold} connexions</p>`;
      reportHTML += `<p><strong>Seuil d'alerte sévère:</strong> >= ${CONFIG.synSevereThreshold} connexions</p>`;
      reportHTML += `<p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>`;
      reportHTML += '<p><em>⚠️ Cette alerte est envoyée en prévention. Si le nombre de connexions augmente, une alerte sévère sera déclenchée.</em></p>';
      
      if (Object.keys(ipCounts).length > 0) {
        reportHTML += '<h3>🌐 IPs suspectes (top 10):</h3><ul>';
        const sortedIPs = Object.entries(ipCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        sortedIPs.forEach(([ip, count]) => {
          reportHTML += `<li><strong>${ip}:</strong> ${count} connexion(s) SYN_RECEIVED</li>`;
        });
        reportHTML += '</ul>';
      } else {
        reportHTML += '<p><em>Aucune IP distante identifiée (peut être une activité depuis le réseau local)</em></p>';
      }
      
      if (rawLines.length > 0 && rawLines.length <= 10) {
        reportHTML += '<h3>📋 Détails des connexions SYN_RECEIVED (échantillon):</h3><pre style="background: #f5f5f5; padding: 10px; overflow-x: auto;">';
        rawLines.slice(0, 10).forEach(line => {
          reportHTML += line.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n';
        });
        reportHTML += '</pre>';
      }

      // Générer le rapport texte
      let reportText = '⚠️ Suspicion d\'Attaque SYN Flood\n\n';
      reportText += `Nombre de connexions SYN_RECEIVED: ${synCount}\n`;
      reportText += `Niveau: Suspicion (détection précoce)\n`;
      reportText += `Seuil de suspicion: >= ${CONFIG.synSuspectThreshold} connexions\n`;
      reportText += `Seuil d'alerte sévère: >= ${CONFIG.synSevereThreshold} connexions\n`;
      reportText += `Date: ${new Date().toLocaleString('fr-FR')}\n\n`;
      reportText += '⚠️ Cette alerte est envoyée en prévention. Si le nombre de connexions augmente, une alerte sévère sera déclenchée.\n\n';
      
      if (Object.keys(ipCounts).length > 0) {
        reportText += '🌐 IPs suspectes (top 10):\n';
        const sortedIPs = Object.entries(ipCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        sortedIPs.forEach(([ip, count]) => {
          reportText += `  - ${ip}: ${count} connexion(s) SYN_RECEIVED\n`;
        });
      }

      // Envoyer l'email en utilisant directement le profil 'alerts' (priorité moyenne)
      await this.mailService.send({
        to: CONFIG.alertEmail,
        subject: `⚠️ Suspicion SYN Flood - ${synCount} connexions SYN_RECEIVED`,
        body: reportText,
        body_html: reportHTML,
        profile: 'alerts',
        context: {
          priority: 'medium',
          type: 'syn_flood_suspicion'
        },
        module_name: 'security-monitor'
      });

      console.log(`✅ Alerte de suspicion envoyée: ${synCount} connexions SYN_RECEIVED`);
    } catch (error) {
      console.error('❌ Erreur envoi alerte de suspicion:', error);
    }
  }

  /**
   * Vérifie les logs pour de nouvelles attaques
   */
  async checkLogs() {
    try {
      await this.cleanupExpiredBans();

      // Lire les nouveaux logs
      const accessResult = await this.readNewLines(
        CONFIG.accessLogPath,
        state.lastAccessLogPosition,
        'access'
      );
      
      const errorResult = await this.readNewLines(
        CONFIG.errorLogPath,
        state.lastErrorLogPosition,
        'error'
      );

      // Mettre à jour les positions
      state.lastAccessLogPosition = accessResult.newPosition;
      state.lastErrorLogPosition = errorResult.newPosition;

      // Ajouter les nouvelles attaques
      const newAttacks = [...accessResult.attacks, ...errorResult.attacks];
      state.attacks.push(...newAttacks);

      // Garder seulement les 100 dernières attaques
      if (state.attacks.length > 100) {
        state.attacks = state.attacks.slice(-100);
      }

      // Incrémenter le compteur
      state.attackCount += newAttacks.length;

      // Afficher les nouvelles attaques et bannir les IPs récidivistes (système de réputation)
      if (newAttacks.length > 0) {
        console.log(`\n🚨 ${newAttacks.length} nouvelle(s) attaque(s) détectée(s):`);
        newAttacks.forEach(attack => {
          // Afficher le score de réputation si l'IP est trackée
          const reputation = state.ipReputation[attack.ip];
          const scoreInfo = reputation ? ` (score: ${reputation.score.toFixed(1)})` : '';
          console.log(`  - [${attack.attackType}] ${attack.ip}${scoreInfo} -> ${attack.uri.substring(0, 60)}`);
        });

        // Bannir automatiquement les IPs avec réputation élevée (système de réputation)
        const reputationBanResult = await this.banReputationIPs(newAttacks);

        // Bannir automatiquement les sous-réseaux avec réputation élevée (système de réputation)
        const subnetBanResult = await this.banReputationSubnets();
      }

      // Envoyer une alerte si le seuil est atteint
      if (newAttacks.length > 0 && state.attackCount >= CONFIG.alertThreshold) {
        // Grouper les attaques récentes (dernières 5 minutes)
        const recentAttacks = state.attacks.filter(attack => {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          return attack.timestamp > fiveMinutesAgo;
        });

        if (recentAttacks.length > 0) {
          await this.sendAlert(recentAttacks);
          state.attackCount = 0; // Réinitialiser le compteur
        }
      }

      // Sauvegarder l'état
      this.saveState();
    } catch (error) {
      console.error('❌ Erreur vérification logs:', error);
    }
  }

  /**
   * Démarre le monitoring adaptatif avec intervalle dynamique basé sur le nombre de SYN_RECEIVED
   */
  startAdaptiveMonitoring() {
    // Fonction récursive pour gérer le monitoring adaptatif
    const runAdaptiveCheck = async () => {
      // Nettoyer la référence au timeout précédent (sera recréé après)
      this.checkIntervalId = null;
      
      if (!this.isRunning) {
        return;
      }

      try {
        // Vérifier les logs
        await this.checkLogs();
        
        // Vérifier les SYN flood (retourne le nombre de SYN)
        const synCount = await this.checkSynFlood();
        
        // Calculer le nouvel intervalle basé sur le nombre de SYN détecté
        const intervalInfo = this.calculateAdaptiveInterval(synCount || 0);
        const newInterval = intervalInfo.interval;
        const newLevel = intervalInfo.level;
        const oldInterval = state.currentInterval || CONFIG.adaptiveIntervals.normal;
        
        // Si l'intervalle a changé, logger le changement
        if (newInterval !== oldInterval) {
          const oldLevel = this.getLevelName(oldInterval);
          
          // Log du changement
          console.log(`\n📊 Changement d'intervalle adaptatif:`);
          console.log(`   Ancien: ${oldInterval / 1000}s (niveau: ${oldLevel || 'normal'})`);
          console.log(`   Nouveau: ${newInterval / 1000}s (niveau: ${newLevel}) - ${synCount || 0} connexions SYN_RECEIVED`);
          console.log(`\n`);
        }
        
        // Mettre à jour l'intervalle
        state.currentInterval = newInterval;
        CONFIG.checkInterval = newInterval;
        
        // Programmer le prochain check avec le nouvel intervalle
        this.checkIntervalId = setTimeout(runAdaptiveCheck, newInterval);
      } catch (error) {
        console.error('❌ Erreur dans le monitoring adaptatif:', error);
        // En cas d'erreur, retry avec l'intervalle actuel ou par défaut
        const retryInterval = state.currentInterval || CONFIG.adaptiveIntervals.normal;
        this.checkIntervalId = setTimeout(runAdaptiveCheck, retryInterval);
      }
    };

    // Démarrer la première vérification après l'intervalle actuel
    this.checkIntervalId = setTimeout(runAdaptiveCheck, state.currentInterval || CONFIG.adaptiveIntervals.normal);
  }

  /**
   * Obtient le nom du niveau basé sur l'intervalle
   */
  getLevelName(interval) {
    if (interval === CONFIG.adaptiveIntervals.normal) return 'normal';
    if (interval === CONFIG.adaptiveIntervals.suspect) return 'suspect';
    if (interval === CONFIG.adaptiveIntervals.moderate) return 'moderate';
    if (interval === CONFIG.adaptiveIntervals.severe) return 'severe';
    return 'unknown';
  }

  /**
   * Démarre le monitoring
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Le monitoring est déjà en cours');
      return;
    }

    console.log('🔒 Démarrage du Security Monitor...');
    
    // Initialiser
    await this.initMail();
    this.loadState();

    this.isRunning = true;

    // Vérification initiale
    await this.checkLogs();
    const initialSynCount = await this.checkSynFlood();
    
    // Calculer l'intervalle initial basé sur le nombre de SYN détecté
    const initialIntervalInfo = this.calculateAdaptiveInterval(initialSynCount || 0);
    CONFIG.checkInterval = initialIntervalInfo.interval;
    state.currentInterval = initialIntervalInfo.interval;

    // Démarrer la boucle de monitoring adaptative
    console.log(`✅ Monitoring démarré (intervalle adaptatif)`);
    console.log(`   - Logs Apache (attaques applicatives) - toutes les 20s`);
    console.log(`   - Connexions réseau (SYN flood) - intervalle adaptatif`);
    console.log(`   - Intervalle actuel: ${initialIntervalInfo.interval / 1000}s (niveau: ${initialIntervalInfo.level})`);
    console.log(`   - Seuil suspicion: >= ${CONFIG.synSuspectThreshold} SYN`);
    console.log(`   - Seuil sévère: >= ${CONFIG.synSevereThreshold} SYN`);
    
    // Démarrer le monitoring adaptatif
    this.startAdaptiveMonitoring();
    
    // Gérer l'arrêt propre
    process.on('SIGINT', () => {
      console.log('\n🛑 Arrêt du monitoring...');
      this.isRunning = false;
      this.saveState();
      if (this.checkIntervalId) {
        clearInterval(this.checkIntervalId);
      }
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Arrêt du monitoring...');
      this.isRunning = false;
      this.saveState();
      if (this.checkIntervalId) {
        clearInterval(this.checkIntervalId);
      }
      process.exit(0);
    });
  }

  /**
   * Arrête le monitoring
   */
  stop() {
    this.isRunning = false;
    if (this.checkIntervalId) {
      clearTimeout(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    this.saveState();
    console.log('✅ Monitoring arrêté');
  }
}

// Exécution si appelé directement
if (require.main === module) {
  const monitor = new SecurityMonitor();
  monitor.start().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = SecurityMonitor;


