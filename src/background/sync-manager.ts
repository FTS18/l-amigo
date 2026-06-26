import { LeetCodeService, AcceptedSubmission } from "../services/leetcode";
import { GitHubSyncService } from "../services/github";
import { CodeforcesService } from "../services/codeforces";
import { STORAGE_KEYS } from "../constants";

// ── Shared types ─────────────────────────────────────────────────────

interface SyncPipelineOptions {
  newSubs: AcceptedSubmission[];
  stored: AcceptedSubmission[];
  forceCfOnly?: boolean;
  onProgress?: (done: number, total: number) => void;
}

interface SyncPipelineResult {
  count: number;
  merged: AcceptedSubmission[];
}

export class SyncManager {
  // ── Shared pipeline ─────────────────────────────────────────────────
  // Both handleFullSync and handleIncrementalSync flow through here.
  // Any change to push logic, progress reporting, or storage keys only needs to happen once.

  private static async _runSyncPipeline(opts: SyncPipelineOptions): Promise<SyncPipelineResult> {
    const { newSubs, stored, forceCfOnly, onProgress } = opts;
    const merged = newSubs.length > 0 ? [...newSubs, ...stored] : stored;

    await chrome.storage.local.set({
      [STORAGE_KEYS.ALL_ACCEPTED_SUBS]: merged,
      [STORAGE_KEYS.LAST_SYNCED_TS]: Date.now(),
    });

    if (merged.length === 0) return { count: 0, merged };

    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_STATUS]: 'syncing' });

    const { count, syncedSubmissions } = await GitHubSyncService.syncSubmissions(
      merged,
      (done, total) => {
        onProgress?.(done, total);
        chrome.storage.local.set({
          [STORAGE_KEYS.SYNC_PROGRESS_DONE]: done,
          [STORAGE_KEYS.SYNC_PROGRESS_TOTAL]: total,
        });
      },
      forceCfOnly
    );

    await chrome.storage.local.set({
      [STORAGE_KEYS.SYNC_STATUS]: 'idle',
      [STORAGE_KEYS.SYNC_RESUME_OFFSET]: 0,
    });
    await GitHubSyncService.logSyncEvent(count, syncedSubmissions.map(s => s.title));

    if (count > 0) {
      await this._notifyUser(count, syncedSubmissions);
    }

    return { count, merged };
  }

  private static async _notifyUser(
    count: number,
    syncedSubmissions: Array<{ title: string; lang: string }>
  ): Promise<void> {
    // Send toast to active LeetCode/CF tab
    try {
      const langCounts: Record<string, number> = {};
      syncedSubmissions.forEach(s => {
        const lang = s.lang || 'Unknown';
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      });
      const details = Object.entries(langCounts).map(([l, n]) => `${n} ${l}`).join(', ');
      const message = `Synced ${details} solution${count > 1 ? 's' : ''} to GitHub!`;

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'showSyncToast', message }).catch(() => {});
      }
    } catch {
      // Non-fatal — toast is best-effort
    }

    // System notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('android-chrome-192x192.png'),
      title: "L'Amigo – Synced!",
      message: `${count} new submission${count > 1 ? 's' : ''} pushed to GitHub.`,
    });
  }

  // ── Public API ──────────────────────────────────────────────────────

  static async handleFullSync(sendResponse?: (r: any) => void, forceCfOnly?: boolean) {
    const { [STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS]: inProgress } =
      await chrome.storage.session.get(STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS);
    if (inProgress) {
      sendResponse?.({ success: false, error: 'Sync already in progress' });
      return;
    }
    await chrome.storage.session.set({ [STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS]: true });

    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYNC_STATUS]: 'fetching',
        [STORAGE_KEYS.SYNC_PROGRESS_FETCH]: 0,
        [STORAGE_KEYS.SYNC_PROGRESS_DONE]: 0,
        [STORAGE_KEYS.SYNC_PROGRESS_TOTAL]: 0,
        [STORAGE_KEYS.SYNC_ERROR]: '',
      });
      if (__DEV__) {
        await chrome.storage.local.set({ debug_sync_info: `[START] forceCfOnly=${forceCfOnly}` });
      }

      const stored: AcceptedSubmission[] =
        (await chrome.storage.local.get(STORAGE_KEYS.ALL_ACCEPTED_SUBS))[STORAGE_KEYS.ALL_ACCEPTED_SUBS] || [];
      const knownIds = stored.length > 0 ? new Set(stored.map(s => s.id)) : undefined;

      const newSubs = await LeetCodeService.fetchAllAcceptedSubmissions(
        n => chrome.storage.local.set({ [STORAGE_KEYS.SYNC_PROGRESS_FETCH]: n }),
        knownIds,
      );

      if (__DEV__) {
        await chrome.storage.local.set({ debug_sync_info: `[LC] fetched ${newSubs.length} subs` });
      }

      if (newSubs.length === 0 && stored.length === 0) {
        await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_STATUS]: 'idle' });
        sendResponse?.({ success: true, synced: 0, message: 'No accepted submissions found.' });
        return;
      }

      const { count } = await this._runSyncPipeline({ newSubs, stored, forceCfOnly });
      sendResponse?.({ success: true, synced: count });
    } catch (err: any) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYNC_STATUS]: 'error',
        [STORAGE_KEYS.SYNC_ERROR]: err.message,
      });
      sendResponse?.({ success: false, error: err.message });
    } finally {
      await chrome.storage.session.remove(STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS);
    }
  }

  static async handleIncrementalSync() {
    const { [STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS]: inProgress } =
      await chrome.storage.session.get(STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS);
    if (inProgress) return;

    const config = await GitHubSyncService.getConfig();
    if (!config?.token || !config?.repoName) return;

    await chrome.storage.session.set({ [STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS]: true });

    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYNC_STATUS]: 'fetching',
        [STORAGE_KEYS.SYNC_PROGRESS_FETCH]: 0,
        [STORAGE_KEYS.SYNC_PROGRESS_DONE]: 0,
        [STORAGE_KEYS.SYNC_PROGRESS_TOTAL]: 0,
        [STORAGE_KEYS.SYNC_ERROR]: '',
      });

      const { [STORAGE_KEYS.LAST_SYNCED_TS]: lastSyncedTs } =
        await chrome.storage.local.get(STORAGE_KEYS.LAST_SYNCED_TS);
      const stored: AcceptedSubmission[] =
        (await chrome.storage.local.get(STORAGE_KEYS.ALL_ACCEPTED_SUBS))[STORAGE_KEYS.ALL_ACCEPTED_SUBS] || [];
      const knownIds = new Set(stored.map(s => s.id));

      const { [STORAGE_KEYS.OWN_CF_HANDLE]: cfHandle } =
        await chrome.storage.local.get(STORAGE_KEYS.OWN_CF_HANDLE);

      let newSubs = await LeetCodeService.fetchAllAcceptedSubmissions(
        n => chrome.storage.local.set({ [STORAGE_KEYS.SYNC_PROGRESS_FETCH]: n }),
        knownIds,
        lastSyncedTs || 0
      );

      // Append any new Codeforces submissions from the last hour
      if (cfHandle) {
        try {
          const cfSubsRaw = await CodeforcesService.getRecentSubmissions(cfHandle, 20);
          const oneHourAgo = Date.now() - 3_600_000;
          const newCfSubs = cfSubsRaw
            .filter(s => s.statusDisplay === 'Accepted' && s.timestamp >= oneHourAgo && !knownIds.has(s.submissionId || ''))
            .map(s => ({
              title: s.title,
              titleSlug: s.titleSlug,
              timestamp: s.timestamp,
              statusDisplay: s.statusDisplay,
              lang: s.lang,
              id: s.submissionId || '',
              platform: s.platform,
              difficulty: (s as any).difficulty || 'Unknown',
              rating: (s as any).rating || 0,
            }));
          newSubs = [...newSubs, ...newCfSubs];
        } catch (e) {
          console.warn('[SyncManager] Failed to fetch CF subs for incremental sync', e);
        }
      }

      // Attach runtime stats if recently captured
      const { [STORAGE_KEYS.LATEST_STATS]: latestStats } =
        await chrome.storage.local.get(STORAGE_KEYS.LATEST_STATS);
      if (latestStats && Date.now() - latestStats.timestamp < 60_000 && newSubs.length > 0) {
        newSubs[0].runtimeBeats = latestStats.runtimeBeats;
        newSubs[0].memoryBeats = latestStats.memoryBeats;
        await chrome.storage.local.remove(STORAGE_KEYS.LATEST_STATS);
      }

      if (newSubs.length === 0) {
        await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_STATUS]: 'idle' });
        return;
      }

      await this._runSyncPipeline({ newSubs, stored });
    } catch (err: any) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYNC_STATUS]: 'error',
        [STORAGE_KEYS.SYNC_ERROR]: err.message,
      });
    } finally {
      await chrome.storage.session.remove(STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS);
    }
  }
}
