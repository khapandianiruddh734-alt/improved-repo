
import { ApiLog, AdminSettings, ErrorCategory } from '../types';

const STORAGE_KEY = 'achievers_api_logs';
const SETTINGS_KEY = 'achievers_admin_settings';
const QUOTA_KEY = 'achievers_global_quota_used';

// Pricing constants (Approximate for Gemini 3 Flash)
const COST_PER_1M_INPUT = 0.075; 
const COST_PER_1M_OUTPUT = 0.30;

const MAX_RPM = 15; 
const DAILY_LIMIT = 1500;
const VERCEL_LIMIT = 1000000;
const DEFAULT_ALERT_EMAIL = 'khapandianiruddh734@gmail.com'; 
const DEFAULT_THRESHOLD = 80; 

const DEFAULT_SETTINGS: AdminSettings = {
  alertEmail: DEFAULT_ALERT_EMAIL,
  threshold: DEFAULT_THRESHOLD,
};

export const apiTracker = {
  logRequest: (log: Omit<ApiLog, 'id' | 'timestamp'>) => {
    const logs = apiTracker.getLogs();
    const newLog: ApiLog = {
      ...log,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    logs.unshift(newLog);
    
    const currentQuota = Number(localStorage.getItem(QUOTA_KEY) || 0);
    localStorage.setItem(QUOTA_KEY, String(currentQuota + 1));
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 200)));
    apiTracker.checkAlerts();
  },

  getLogs: (): ApiLog[] => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  },

  getSettings: (): AdminSettings => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  },

  updateSettings: (settings: AdminSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  checkAlerts: () => {
    const stats = apiTracker.getStats();
    const settings = apiTracker.getSettings();
    const usagePercent = (stats.rpm / MAX_RPM) * 100;

    if (usagePercent >= settings.threshold) {
      const now = Date.now();
      if (!settings.lastAlertSent || now - settings.lastAlertSent > 600000) {
        apiTracker.triggerEmailAlert(usagePercent, settings.alertEmail);
        apiTracker.updateSettings({ ...settings, lastAlertSent: now });
      }
    }
  },

  triggerEmailAlert: (usage: number, email: string) => {
    const alertLog: ApiLog = {
      id: 'alert-' + Date.now(),
      timestamp: Date.now(),
      tool: 'System Alert',
      model: 'N/A',
      status: 'error',
      errorCategory: 'Internal',
      latency: 0,
      fileCount: 0,
      fileFormats: [],
      errorMessage: `CRITICAL: ${usage.toFixed(1)}% RPM usage. Notified ${email}.`,
      isAlert: true
    };
    
    const logs = apiTracker.getLogs();
    logs.unshift(alertLog);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 100)));
  },

  categorizeError: (message: string): ErrorCategory => {
    const msg = message.toLowerCase();
    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) return 'Rate Limit (429)';
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) return 'Network';
    if (msg.includes('safety') || msg.includes('blocked') || msg.includes('harmful')) return 'Content Safety';
    if (msg.includes('schema') || msg.includes('invalid json') || msg.includes('parse')) return 'Schema';
    return 'Internal';
  },

  calculateAccuracy: (data: any[][]): number => {
    if (!data || data.length <= 1) return 0;
    let totalCells = 0;
    let validCells = 0;
    
    data.slice(1).forEach(row => {
      row.forEach(cell => {
        totalCells++;
        const s = String(cell || '').trim();
        if (s && s !== 'N/A' && s !== 'null' && s !== 'undefined' && s !== '""') {
          validCells++;
        }
      });
    });
    
    return totalCells > 0 ? Math.round((validCells / totalCells) * 100) : 100;
  },

  getStats: () => {
    const logs = apiTracker.getLogs();
    const now = Date.now();
    const validLogs = logs.filter(l => !l.isAlert);
    
    const oneMinuteAgo = now - 60000;
    const oneDayAgo = now - 86400000;
    
    const lastMinuteLogs = validLogs.filter(l => l.timestamp > oneMinuteAgo);
    const lastDayLogs = validLogs.filter(l => l.timestamp > oneDayAgo);
    const successLogs = validLogs.filter(l => l.status === 'success');
    
    const tokensIn = validLogs.reduce((acc, curr) => acc + (curr.inputTokens || 0), 0);
    const tokensOut = validLogs.reduce((acc, curr) => acc + (curr.outputTokens || 0), 0);
    
    const estimatedCost = (tokensIn / 1000000 * COST_PER_1M_INPUT) + (tokensOut / 1000000 * COST_PER_1M_OUTPUT);

    const accuracySum = successLogs.reduce((acc, curr) => acc + (curr.accuracyScore || 100), 0);
    const accuracyAvg = successLogs.length > 0 ? Math.round(accuracySum / successLogs.length) : 100;

    const toolUsage: Record<string, { count: number, success: number }> = {};
    validLogs.forEach(l => {
      if (!toolUsage[l.tool]) toolUsage[l.tool] = { count: 0, success: 0 };
      toolUsage[l.tool].count++;
      if (l.status === 'success') toolUsage[l.tool].success++;
    });

    const successRate = validLogs.length > 0 ? (successLogs.length / validLogs.length) * 100 : 100;
    
    let health: 'Healthy' | 'Degraded' | 'Critical' = 'Healthy';
    if (successRate < 70 || (lastMinuteLogs.length / MAX_RPM) > 0.9) health = 'Critical';
    else if (successRate < 90 || (lastMinuteLogs.length / MAX_RPM) > 0.7) health = 'Degraded';

    return {
      total: validLogs.length,
      quotaUsed: Number(localStorage.getItem(QUOTA_KEY) || 0),
      quotaLimit: VERCEL_LIMIT,
      dailyUsed: lastDayLogs.length,
      dailyLimit: DAILY_LIMIT,
      rpm: lastMinuteLogs.length,
      rpmLimit: MAX_RPM,
      tokensIn,
      tokensOut,
      estimatedCost: estimatedCost.toFixed(4),
      accuracyAvg,
      successRate,
      health,
      toolUsage,
      recentLogs: logs.slice(0, 30)
    };
  },

  clearLogs: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(QUOTA_KEY);
  }
};
