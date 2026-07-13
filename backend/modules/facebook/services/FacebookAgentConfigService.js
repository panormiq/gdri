/**
 * Configuration agent Facebook (prompt, intentions, emails, fréquences).
 * Fichier : backend/modules/facebook/services/FacebookAgentConfigService.js
 */

const COLLECTION = 'analyse_intention_configs';

const EMPTY_AGENT_DATA = {
  basePrompt: '',
  defaultEmail: '',
  defaultEmails: [],
  customIntentions: [],
  defaultIntentionsEnabled: {},
  smtp_profiles: {},
  pageId: null,
  reportFrequency: {}
};

function formatReportFrequency(rf = {}) {
  return {
    urgentSchedule: rf.urgentSchedule,
    urgentSendEmail: rf.urgentSendEmail !== false,
    replyDailyHour: rf.replyDailyHour || '09:00',
    replyDailyEnabled: rf.replyDailyEnabled !== false,
    replyDailySendIfNoMessages: rf.replyDailySendIfNoMessages === true,
    replyWeekDay: rf.replyWeekDay != null && rf.replyWeekDay !== '' ? String(rf.replyWeekDay) : '1',
    replyWeeklyHour: rf.replyWeeklyHour || '09:00',
    replyWeeklyEnabled: rf.replyWeeklyEnabled !== false,
    replyWeeklySendIfNoMessages: rf.replyWeeklySendIfNoMessages === true,
    replyMonthlyAnchor: rf.replyMonthlyAnchor === 'last' ? 'last' : 'first',
    replyMonthlyHour: rf.replyMonthlyHour || '09:00',
    replyMonthlyEnabled: rf.replyMonthlyEnabled !== false,
    replyMonthlySendIfNoMessages: rf.replyMonthlySendIfNoMessages === true,
    interactionFrequency: rf.interactionFrequency || 'daily',
    interactionSendEmail: rf.interactionSendEmail === true,
    skipReportIfNoNewMessages: rf.skipReportIfNoNewMessages === true
  };
}

function buildConfigPayload(body = {}) {
  const rf = body.reportFrequency || {};
  const defaultEmailsRaw = body.defaultEmails || body.default_emails || [];
  const defaultEmails = (Array.isArray(defaultEmailsRaw) ? defaultEmailsRaw : [defaultEmailsRaw])
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean);

  return {
    basePrompt: body.basePrompt || body.base_prompt || '',
    defaultEmail: body.defaultEmail || body.default_email || '',
    defaultEmails,
    customIntentions: body.customIntentions || body.intentions || [],
    defaultIntentionsEnabled: body.defaultIntentionsEnabled || {},
    smtp_profiles: body.smtp_profiles || body.smtpSettings || {},
    reportFrequency: formatReportFrequency(rf)
  };
}

function docToApiData(doc, pageId = null) {
  if (!doc || !doc.config) {
    return { ...EMPTY_AGENT_DATA, pageId: pageId || null };
  }
  const c = doc.config;
  return {
    basePrompt: c.basePrompt || c.base_prompt || '',
    defaultEmail: c.defaultEmail || c.default_email || '',
    defaultEmails: Array.isArray(c.defaultEmails)
      ? c.defaultEmails
      : (Array.isArray(c.default_emails) ? c.default_emails : []),
    customIntentions: c.customIntentions || c.intentions || [],
    defaultIntentionsEnabled: c.defaultIntentionsEnabled || {},
    smtp_profiles: c.smtp_profiles || c.smtpSettings || {},
    pageId: doc.pageId || pageId || null,
    reportFrequency: formatReportFrequency(c.reportFrequency || {})
  };
}

class FacebookAgentConfigService {
  constructor(database) {
    this.database = database;
  }

  async loadConfig(entrepriseId, pageId = null) {
    if (!entrepriseId) return null;
    const coll = this.database.getCollection(COLLECTION);
    const eid = String(entrepriseId);
    const pid = pageId != null && pageId !== '' ? String(pageId) : null;

    let doc = null;
    if (pid) {
      doc = await coll.findOne({ entrepriseId: eid, pageId: pid });
    }
    if (!doc) {
      doc = await coll.findOne({
        entrepriseId: eid,
        $or: [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }]
      });
    }
    if (!doc) {
      doc = await coll.findOne({ entity_id: eid });
    }
    return doc && doc.config ? doc.config : null;
  }

  async getAgentConfigForApi(entrepriseId, pageId = null) {
    if (!entrepriseId) {
      return { ...EMPTY_AGENT_DATA };
    }
    const coll = this.database.getCollection(COLLECTION);
    const eid = String(entrepriseId);
    const pid = pageId != null && pageId !== '' ? String(pageId) : null;

    let doc = null;
    if (pid) {
      doc = await coll.findOne({ entrepriseId: eid, pageId: pid });
    }
    if (!doc) {
      doc = await coll.findOne({
        entrepriseId: eid,
        $or: [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }]
      });
    }
    return docToApiData(doc, pid);
  }

  async saveAgentConfig(entrepriseId, userId, body = {}) {
    const pageId = body.pageId != null && body.pageId !== '' ? String(body.pageId) : null;
    const configToSave = buildConfigPayload(body);
    const coll = this.database.getCollection(COLLECTION);

    let filter = { entrepriseId: String(entrepriseId) };
    if (pageId) {
      filter.pageId = pageId;
    } else {
      filter.$or = [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }];
    }

    await coll.updateOne(
      filter,
      {
        $set: {
          entrepriseId: String(entrepriseId),
          pageId: pageId != null ? pageId : null,
          config: configToSave,
          updated_at: new Date(),
          updated_by: userId
        }
      },
      { upsert: true }
    );
  }
}

module.exports = {
  FacebookAgentConfigService,
  docToApiData,
  EMPTY_AGENT_DATA,
  formatReportFrequency,
  buildConfigPayload
};
