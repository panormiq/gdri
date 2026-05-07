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

        const schedule = await this.getScheduleForPage(agentColl, entrepriseId, pageId);
        const dueFrequencies = this.getDueFrequencies(schedule, now, currentHm);
        if (dueFrequencies.length === 0) continue;

        const dueToRun = [];
        for (const frequency of dueFrequencies) {
          const periodKey = this.getPeriodKey(frequency, now);
          const runKey = { entrepriseId, pageId, frequency, periodKey };
          const already = await runsColl.findOne(runKey);
          if (!already) {
            dueToRun.push({ frequency, periodKey });
          }
        }
        if (dueToRun.length === 0) continue;

        console.log(`\n📅 ===== SYNC PLANIFIEE Facebook ${pageId} (${entrepriseId}) @ ${currentHm} =====`);

        const sinceDate = this.resolveSinceDate(fb);
        const pullResult = await this.pollingService.pullMessages(pageId, fb.pageAccessToken, sinceDate);

        for (const run of dueToRun) {
          await runsColl.insertOne({
            entrepriseId,
            pageId,
            frequency: run.frequency,
            periodKey: run.periodKey,
            pullSuccess: !!(pullResult && pullResult.success),
            lastPullDate: pullResult && pullResult.lastPullDate ? pullResult.lastPullDate : new Date(),
            created_at: new Date()
          });
        }

        if (pullResult && pullResult.success) {
          for (const run of dueToRun) {
            const sendIfNoMessages = this.shouldSendEmptyReport(schedule, run.frequency);
            await this.webhookService.sendDeferredReportsForFrequency(
              entrepriseId,
              pageId,
              run.frequency,
              sendIfNoMessages
            );
          }
        }

        console.log(`📅 ===== FIN SYNC PLANIFIEE ${pageId} =====\n`);
      }
    } finally {
      this._running = false;
    }
  }

  async getScheduleForPage(agentColl, entrepriseId, pageId) {
    let doc = await agentColl.findOne({ entrepriseId: String(entrepriseId), pageId: String(pageId) });
    if (!doc) {
      doc = await agentColl.findOne({
        entrepriseId: String(entrepriseId),
        $or: [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }]
      });
    }
    const rf = doc && doc.config && doc.config.reportFrequency ? doc.config.reportFrequency : {};
    const sanitizeHm = (value, fallback) => (/^\d{2}:\d{2}$/.test(String(value || '')) ? String(value) : fallback);
    const weekDay = rf.replyWeekDay != null ? Number(rf.replyWeekDay) : 1;
    return {
      dailyHour: sanitizeHm(rf.replyDailyHour, '09:00'),
      dailyEnabled: rf.replyDailyEnabled !== false,
      weekDay: Number.isFinite(weekDay) ? weekDay : 1,
      weeklyHour: sanitizeHm(rf.replyWeeklyHour, '09:00'),
      weeklyEnabled: rf.replyWeeklyEnabled !== false,
      monthlyAnchor: rf.replyMonthlyAnchor === 'last' ? 'last' : 'first',
      monthlyHour: sanitizeHm(rf.replyMonthlyHour, '09:00'),
      monthlyEnabled: rf.replyMonthlyEnabled !== false,
      dailySendIfEmpty: rf.replyDailySendIfNoMessages === true,
      weeklySendIfEmpty: rf.replyWeeklySendIfNoMessages === true,
      monthlySendIfEmpty: rf.replyMonthlySendIfNoMessages === true
    };
  }

  getDueFrequencies(schedule, now, currentHm) {
    const out = [];
    if (schedule.dailyEnabled && currentHm === schedule.dailyHour) out.push('daily');
    if (schedule.weeklyEnabled && now.getDay() === Number(schedule.weekDay) && currentHm === schedule.weeklyHour) out.push('weekly');
    const isFirstDay = now.getDate() === 1;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isLastDay = now.getDate() === lastDay;
    const monthlyMatch = (schedule.monthlyAnchor === 'last' ? isLastDay : isFirstDay) && currentHm === schedule.monthlyHour;
    if (schedule.monthlyEnabled && monthlyMatch) out.push('monthly');
    return out;
  }

  getPeriodKey(frequency, now) {
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    if (frequency === 'daily') return `${yyyy}-${mm}-${dd}`;
    if (frequency === 'monthly') return `${yyyy}-${mm}`;
    const week = this.getIsoWeek(now);
    return `${yyyy}-W${String(week).padStart(2, '0')}`;
  }

  getIsoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  shouldSendEmptyReport(schedule, frequency) {
    if (frequency === 'daily') return schedule.dailySendIfEmpty === true;
    if (frequency === 'weekly') return schedule.weeklySendIfEmpty === true;
    if (frequency === 'monthly') return schedule.monthlySendIfEmpty === true;
    return false;
  }

  resolveSinceDate(fb) {
    if (fb.lastPullAt) return new Date(fb.lastPullAt);
    if (fb.lastWebhookProcessedAt) return new Date(fb.lastWebhookProcessedAt);
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }
}

module.exports = DailyFacebookSyncService;
