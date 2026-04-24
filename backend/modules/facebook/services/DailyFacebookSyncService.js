/**
 * Synchronisation quotidienne Facebook : pull Graph API puis envoi des rapports différés.
 * L’heure est lue dans analyse_intention_configs.config.reportFrequency.replyDailyHour (défaut 09:00).
 */

const PollingService = require('./PollingService');
const WebhookService = require('./WebhookService');

const SYNC_CHECK_MS = 60 * 1000;

class DailyFacebookSyncService {
  constructor(database) {
    this.database = database;
    this.pollingService = new PollingService(database);
    this.webhookService = new WebhookService(database);
    this.timer = null;
    this._running = false;
  }

  async init() {
    await this.pollingService.init();
    await this.webhookService.init();
  }

  /**
   * Démarre la vérification chaque minute (fenêtre : même heure:minute que replyDailyHour).
   */
  start() {
    if (process.env.FACEBOOK_DAILY_SYNC_DISABLED === 'true') {
      console.log('📅 Sync quotidienne Facebook : désactivée (FACEBOOK_DAILY_SYNC_DISABLED)');
      return;
    }
    this.timer = setInterval(() => this.tick().catch((e) => console.error('DailyFacebookSync tick:', e)), SYNC_CHECK_MS);
    console.log('📅 Sync quotidienne Facebook : planificateur actif (vérif. chaque minute)');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this._running) return;
    this._running = true;
    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentHm = `${hh}:${mm}`;
      const today = now.toISOString().slice(0, 10);

      const configColl = this.database.getCollection('facebook_configs');
      const agentColl = this.database.getCollection('analyse_intention_configs');
      const runsColl = this.database.getCollection('facebook_daily_sync_runs');

      const pages = await configColl
        .find({
          pageAccessToken: { $exists: true, $ne: null },
          $or: [{ tokenStatus: { $exists: false } }, { tokenStatus: { $ne: 'reauth_required' } }]
        })
        .toArray();

      for (const fb of pages) {
        const pageId = fb.pageId != null ? String(fb.pageId) : null;
        const entrepriseId = fb.entrepriseId != null ? String(fb.entrepriseId) : null;
        if (!pageId || !entrepriseId) continue;

        const targetHm = await this.getReplyDailyHourForPage(agentColl, entrepriseId, pageId);
        if (currentHm !== targetHm) continue;

        const runKey = { entrepriseId, pageId, date: today };
        const already = await runsColl.findOne(runKey);
        if (already) continue;

        console.log(`\n📅 ===== SYNC QUOTIDIENNE Facebook ${pageId} (${entrepriseId}) @ ${currentHm} =====`);

        const sinceDate = this.resolveSinceDate(fb);
        const pullResult = await this.pollingService.pullMessages(pageId, fb.pageAccessToken, sinceDate);

        await runsColl.insertOne({
          ...runKey,
          pullSuccess: !!(pullResult && pullResult.success),
          lastPullDate: pullResult && pullResult.lastPullDate ? pullResult.lastPullDate : new Date(),
          created_at: new Date()
        });

        if (pullResult && pullResult.success) {
          await this.webhookService.sendDeferredDailyReports(entrepriseId, pageId);
        }

        console.log(`📅 ===== FIN SYNC QUOTIDIENNE ${pageId} =====\n`);
      }
    } finally {
      this._running = false;
    }
  }

  async getReplyDailyHourForPage(agentColl, entrepriseId, pageId) {
    let doc = await agentColl.findOne({ entrepriseId: String(entrepriseId), pageId: String(pageId) });
    if (!doc) {
      doc = await agentColl.findOne({
        entrepriseId: String(entrepriseId),
        $or: [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }]
      });
    }
    const rf = doc && doc.config && doc.config.reportFrequency ? doc.config.reportFrequency : {};
    const h = rf.replyDailyHour || '09:00';
    return /^\d{2}:\d{2}$/.test(h) ? h : '09:00';
  }

  resolveSinceDate(fb) {
    if (fb.lastPullAt) return new Date(fb.lastPullAt);
    if (fb.lastWebhookProcessedAt) return new Date(fb.lastWebhookProcessedAt);
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }
}

module.exports = DailyFacebookSyncService;
