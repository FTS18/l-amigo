import { Platform } from '../types';

/**
 * Keys that are safe to include in a local backup / restore.
 * github_sync_config is intentionally excluded — it contains a raw OAuth token
 * and must never be written to an untrusted file.
 */
const SAFE_BACKUP_KEYS = [
  'friend_identities_v2',
  'own_username',
  'own_codeforces_handle',
  'own_codechef_handle',
  'darkMode',
  'notifications_enabled',
  'auto_refresh',
  'refresh_interval',
  'cf_dark_mode',
  'daily_goal',
  'sync_history',
] as const;

/** Typed sync-history entry (avoids `any[]` everywhere). */
export interface SyncEntry {
  timestamp: number;
  status: 'success' | 'error';
  problemsSynced: number;
  problems?: string[];
}

/** A friend preview used during selective import. */
export interface ImportPreviewFriend {
  displayName: string;
  accounts: Array<{ platform: Platform; handle: string }>;
  selected: boolean;
}

/**
 * Restore state from a full-backup JSON object.
 * Safe keys only — strips the GitHub token.
 * @returns The restored own_username (or '').
 */
export async function restoreFromBackupJSON(parsed: unknown): Promise<string> {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid backup file — not a JSON object.');
  }

  const data = parsed as Record<string, unknown>;
  const keysToSave: Record<string, unknown> = {};

  for (const key of SAFE_BACKUP_KEYS) {
    if (key in data && data[key] !== undefined) {
      keysToSave[key] = data[key];
    }
  }

  if (Object.keys(keysToSave).length === 0) {
    throw new Error(
      'Invalid backup file structure. No recognisable keys found.',
    );
  }

  keysToSave.onboarding_complete = true;
  await chrome.storage.local.set(keysToSave);
  return (keysToSave.own_username as string) || '';
}

/**
 * Detect what kind of L'Amigo JSON file has been loaded and return
 * a preview list of friends (all pre-selected).
 * Throws if the file is not a recognised format.
 */
export function extractFriendPreviewsFromJSON(
  parsed: unknown,
): { type: 'share' | 'backup'; previews: ImportPreviewFriend[] } {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid file — not a JSON object.');
  }

  const data = parsed as Record<string, unknown>;

  // Shareable friends JSON (lamigo_share: true)
  if (data.lamigo_share === true && Array.isArray(data.friends)) {
    const previews: ImportPreviewFriend[] = (data.friends as any[]).map(
      (f) => ({
        displayName: f.displayName || f.username || 'Unknown',
        accounts: ((f.accounts as any[]) || []).map((a) => ({
          platform: a.platform as Platform,
          handle: a.handle as string,
        })),
        selected: true,
      }),
    );
    return { type: 'share', previews };
  }

  // Full backup JSON
  if (
    'friend_identities_v2' in data ||
    'own_username' in data ||
    'darkMode' in data
  ) {
    const identities: any[] = (data.friend_identities_v2 as any[]) || [];
    const previews: ImportPreviewFriend[] = identities.map((f) => ({
      displayName: f.displayName || 'Unknown',
      accounts: ((f.accounts as any[]) || []).map((a) => ({
        platform: a.platform as Platform,
        handle: a.handle as string,
      })),
      selected: true,
    }));
    return { type: 'backup', previews };
  }

  throw new Error(
    "Unrecognised file format. Use a L'Amigo share or backup JSON.",
  );
}
