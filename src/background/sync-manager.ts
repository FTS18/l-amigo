import { LeetCodeService, AcceptedSubmission } from "../services/leetcode";
import { GitHubSyncService } from "../services/github";
import { CodeforcesService } from "../services/codeforces";

const ALL_SUBS_KEY = "all_accepted_submissions";
const SESSION_SYNC_KEY = "sync_in_progress";

export class SyncManager {
  static async handleFullSync(sendResponse?: (r: any) => void) {
    const { [SESSION_SYNC_KEY]: inProgress } = await chrome.storage.session.get(SESSION_SYNC_KEY);
    if (inProgress) {
      sendResponse?.({ success: false, error: "Sync already in progress" });
      return;
    }
    await chrome.storage.session.set({ [SESSION_SYNC_KEY]: true });

    try {
      await chrome.storage.local.set({
        sync_status: "fetching",
        sync_progress_fetch: 0,
        sync_progress_done: 0,
        sync_progress_total: 0,
        sync_error: "",
      });

      const stored: AcceptedSubmission[] =
        (await chrome.storage.local.get(ALL_SUBS_KEY))[ALL_SUBS_KEY] || [];
      const knownIds =
        stored.length > 0 ? new Set(stored.map((s) => s.id)) : undefined;

      const isFirstSync = !knownIds;
      const { own_codeforces_handle: cfHandle } = await chrome.storage.local.get("own_codeforces_handle");

      let newSubs = await LeetCodeService.fetchAllAcceptedSubmissions(
        (n) => chrome.storage.local.set({ sync_progress_fetch: n }),
        knownIds,
      );

      if (cfHandle) {
        try {
          const cfSubsRaw = await CodeforcesService.getRecentSubmissions(cfHandle, 500);
          const cfSubs = cfSubsRaw.map(s => ({
            title: s.title,
            titleSlug: s.titleSlug,
            timestamp: s.timestamp,
            statusDisplay: s.statusDisplay,
            lang: s.lang,
            id: s.submissionId || '',
            platform: s.platform
          }));
          const newCfSubs = cfSubs.filter(s => !knownIds?.has(s.id));
          newSubs = [...newSubs, ...newCfSubs];
        } catch (e) {
          console.warn("Failed to fetch CF subs for sync", e);
        }
      }

      const allSubs = isFirstSync ? newSubs : [...newSubs, ...stored];
      await chrome.storage.local.set({ [ALL_SUBS_KEY]: allSubs });

      if (allSubs.length === 0) {
        await chrome.storage.local.set({ sync_status: "idle" });
        sendResponse?.({
          success: true,
          synced: 0,
          message: "No accepted submissions found.",
        });
        return;
      }

      await chrome.storage.local.set({ sync_status: "syncing" });
      const count = await GitHubSyncService.syncSubmissions(
        allSubs,
        (done, total) => {
          chrome.storage.local.set({
            sync_progress_done: done,
            sync_progress_total: total,
          });
        },
      );

      await chrome.storage.local.set({
        sync_status: "idle",
        sync_resume_offset: 0,
      });
      await GitHubSyncService.logSyncEvent(count, allSubs.slice(0, count).map(s => s.title));

      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("android-chrome-192x192.png"),
        title: "L'Amigo – Sync Complete",
        message:
          count > 0
            ? `Synced ${count} new submission${count > 1 ? "s" : ""} to GitHub!`
            : "Everything is up to date.",
      });

      sendResponse?.({ success: true, synced: count });
    } catch (err: any) {
      await chrome.storage.local.set({
        sync_status: "error",
        sync_error: err.message,
      });
      sendResponse?.({ success: false, error: err.message });
    } finally {
      await chrome.storage.session.remove(SESSION_SYNC_KEY);
    }
  }

  static async handleIncrementalSync() {
    const { [SESSION_SYNC_KEY]: inProgress } = await chrome.storage.session.get(SESSION_SYNC_KEY);
    if (inProgress) return;

    const config = await GitHubSyncService.getConfig();
    if (!config?.token || !config?.repoName) return;

    await chrome.storage.session.set({ [SESSION_SYNC_KEY]: true });

    try {
      await chrome.storage.local.set({
        sync_status: "fetching",
        sync_progress_fetch: 0,
        sync_progress_done: 0,
        sync_progress_total: 0,
        sync_error: "",
      });

      const { last_synced_timestamp } = await chrome.storage.local.get("last_synced_timestamp");
      const stored: AcceptedSubmission[] =
        (await chrome.storage.local.get(ALL_SUBS_KEY))[ALL_SUBS_KEY] || [];
      const knownIds = new Set(stored.map((s) => s.id));

      const { own_codeforces_handle: cfHandle } = await chrome.storage.local.get("own_codeforces_handle");

      let newSubs = await LeetCodeService.fetchAllAcceptedSubmissions(
        (n) => chrome.storage.local.set({ sync_progress_fetch: n }),
        knownIds,
        last_synced_timestamp || 0
      );

      if (cfHandle) {
        try {
          const cfSubsRaw = await CodeforcesService.getRecentSubmissions(cfHandle, 50); // smaller limit for incremental
          const cfSubs = cfSubsRaw.map(s => ({
            title: s.title,
            titleSlug: s.titleSlug,
            timestamp: s.timestamp,
            statusDisplay: s.statusDisplay,
            lang: s.lang,
            id: s.submissionId || '',
            platform: s.platform
          }));
          const newCfSubs = cfSubs.filter(s => !knownIds.has(s.id));
          newSubs = [...newSubs, ...newCfSubs];
        } catch (e) {
          console.warn("Failed to fetch CF subs for incremental sync", e);
        }
      }

      if (newSubs.length === 0) {
        await chrome.storage.local.set({ sync_status: "idle" });
        return;
      }

      const { latest_stats } = await chrome.storage.local.get("latest_stats");
      if (latest_stats && (Date.now() - latest_stats.timestamp < 60000)) {
         newSubs[0].runtimeBeats = latest_stats.runtimeBeats;
         newSubs[0].memoryBeats = latest_stats.memoryBeats;
         await chrome.storage.local.remove("latest_stats");
      }

      const merged = [...newSubs, ...stored];
      await chrome.storage.local.set({ 
        [ALL_SUBS_KEY]: merged,
        last_synced_timestamp: Date.now()
      });

      await chrome.storage.local.set({ sync_status: "syncing" });
      const count = await GitHubSyncService.syncSubmissions(
        merged,
        (done, total) => {
          chrome.storage.local.set({
            sync_progress_done: done,
            sync_progress_total: total,
          });
        },
      );

      await chrome.storage.local.set({ sync_status: "idle" });

      if (count > 0) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("android-chrome-192x192.png"),
          title: "L'Amigo – Synced!",
          message: `${count} new submission${count > 1 ? "s" : ""} pushed to GitHub.`,
        });
      }
    } catch (err: any) {
      await chrome.storage.local.set({
        sync_status: "error",
        sync_error: err.message,
      });
    } finally {
      await chrome.storage.session.remove(SESSION_SYNC_KEY);
    }
  }
}
