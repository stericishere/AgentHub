import { ipcMain } from 'electron';
import { IpcChannels } from '../types';
import { database } from '../services/database';

export interface UserPreference {
  key: string;
  value: string;
  category: string;
}

function getPreference(key: string): string | null {
  const rows = database.prepare(
    'SELECT value FROM user_preferences WHERE key = ?',
    [key],
  );
  return rows.length > 0 ? rows[0].value : null;
}

function setPreference(key: string, value: string, category: string = 'general'): void {
  const existing = database.prepare('SELECT key FROM user_preferences WHERE key = ?', [key]);
  if (existing.length > 0) {
    database.run('UPDATE user_preferences SET value = ? WHERE key = ?', [value, key]);
  } else {
    database.run(
      'INSERT INTO user_preferences (key, value, category) VALUES (?, ?, ?)',
      [key, value, category],
    );
  }
}

function getAllPreferences(): Record<string, string> {
  const rows = database.prepare('SELECT key, value FROM user_preferences');
  const prefs: Record<string, string> = {};
  for (const row of rows) {
    prefs[row.key] = row.value;
  }
  return prefs;
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IpcChannels.SETTINGS_GET, (_e, key: string) => {
    return getPreference(key);
  });

  ipcMain.handle(
    IpcChannels.SETTINGS_UPDATE,
    (_e, params: { key: string; value: string; category?: string }) => {
      setPreference(params.key, params.value, params.category);
      return { success: true };
    },
  );

  ipcMain.handle(IpcChannels.SETTINGS_GET_ALL, () => {
    return getAllPreferences();
  });

  ipcMain.handle(IpcChannels.AUDIT_QUERY, (_e, params) => {
    const { auditLogger } = require('../services/audit-logger');
    return auditLogger.query(params);
  });
}
