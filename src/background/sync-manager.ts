import { LeetCodeService, AcceptedSubmission } from "../services/leetcode";
import { GitHubSyncService } from "../services/github";
import { CodeforcesService } from "../services/codeforces";
import { CodeChefService } from "../services/codechef";
import { OtherPlatformsService } from "../services/other-platforms";
import { STORAGE_KEYS } from "../constants";

// ── Shared types ─────────────────────────────────────────────────────

interface SyncPipelineOptions {
  newSubs: AcceptedSubmission[];
  stored: AcceptedSubmission[];
  forceCfOnly?: boolean;
  historyOnly?: boolean;
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

  private static async _runSyncPipeline(
    opts: SyncPipelineOptions,
  ): Promise<SyncPipelineResult> {
    const { newSubs, stored, forceCfOnly, historyOnly, onProgress } = opts;
    const mergedMap = new Map<string, AcceptedSubmission>();
    stored.forEach((s) => mergedMap.set(s.id, s));
    newSubs.forEach((s) => mergedMap.set(s.id, s));
    const merged = Array.from(mergedMap.values());
    const sortedMerged = [...merged].sort((a, b) => b.timestamp - a.timestamp);
    const compactedMerged = sortedMerged.slice(0, 1000);
    const archivedMerged = sortedMerged.slice(1000);

    await chrome.storage.local.set({
      [STORAGE_KEYS.ALL_ACCEPTED_SUBS]: compactedMerged,
      [STORAGE_KEYS.LAST_SYNCED_TS]: Date.now(),
    });

    if (archivedMerged.length > 0) {
      try {
        const res = await chrome.storage.local.get("all_accepted_submissions_archive");
        const currentArchive = res.all_accepted_submissions_archive || [];
        const archiveMap = new Map<string, any>();
        currentArchive.forEach((s: any) => archiveMap.set(s.id, s));
        archivedMerged.forEach((s: any) => archiveMap.set(s.id, s));
        await chrome.storage.local.set({
          all_accepted_submissions_archive: Array.from(archiveMap.values())
        });
        console.log(`[SyncManager] Archived ${archivedMerged.length} older submissions.`);
      } catch (e) {
        console.warn("[SyncManager] Failed to archive older submissions", e);
      }
    }

    if (merged.length === 0) return { count: 0, merged };

    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_STATUS]: "syncing" });

    const { count, syncedSubmissions } =
      await GitHubSyncService.syncSubmissions(
        merged,
        (done, total, failed = 0) => {
          onProgress?.(done, total);
          chrome.storage.local.set({
            [STORAGE_KEYS.SYNC_PROGRESS_DONE]: done,
            [STORAGE_KEYS.SYNC_PROGRESS_TOTAL]: total,
            sync_progress_failed: failed,
          });
        },
        forceCfOnly,
        historyOnly
      );

    await chrome.storage.local.set({
      [STORAGE_KEYS.SYNC_STATUS]: "idle",
      [STORAGE_KEYS.SYNC_RESUME_OFFSET]: 0,
    });
    await GitHubSyncService.logSyncEvent(
      count,
      syncedSubmissions.map((s) => s.title),
    );

    if (count > 0) {
      await this._notifyUser(count, syncedSubmissions);
    }

    return { count, merged };
  }

  private static async _notifyUser(
    count: number,
    syncedSubmissions: Array<{ title: string; lang: string }>,
  ): Promise<void> {
    // Send toast to active LeetCode/CF tab
    try {
      const langCounts: Record<string, number> = {};
      syncedSubmissions.forEach((s) => {
        const lang = s.lang || "Unknown";
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      });
      const details = Object.entries(langCounts)
        .map(([l, n]) => `${n} ${l}`)
        .join(", ");
      const message = `Synced ${details} solution${count > 1 ? "s" : ""} to GitHub!`;

      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]?.id) {
        chrome.tabs
          .sendMessage(tabs[0].id, { type: "showSyncToast", message })
          .catch(() => {});
      }
    } catch {
      // Non-fatal — toast is best-effort
    }

    // System notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("android-chrome-192x192.png"),
      title: "L'Amigo – Synced!",
      message: `${count} new submission${count > 1 ? "s" : ""} pushed to GitHub.`,
    });
  }

  // ── Public API ──────────────────────────────────────────────────────

  static async handleFullSync(
    sendResponse?: (r: any) => void,
    forceCfOnly?: boolean,
    historyOnly?: boolean
  ) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYNC_STATUS]: "error",
        [STORAGE_KEYS.SYNC_ERROR]: "Offline: Sync will resume when internet connectivity is restored.",
        sync_pending_online: true,
      });
      chrome.alarms.create("retry_sync_offline", { periodInMinutes: 2 });
      sendResponse?.({ success: false, error: "Offline: Internet connectivity required." });
      return;
    }

    const { [STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS]: inProgress } =
      await chrome.storage.session.get(STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS);
    if (inProgress) {
      sendResponse?.({ success: false, error: "Sync already in progress" });
      return;
    }
    await chrome.storage.session.set({
      [STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS]: true,
    });

    try {
      await chrome.storage.session.remove('cancel_sync');
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYNC_STATUS]: "fetching",
        [STORAGE_KEYS.SYNC_PROGRESS_FETCH]: 0,
        [STORAGE_KEYS.SYNC_PROGRESS_DONE]: 0,
        [STORAGE_KEYS.SYNC_PROGRESS_TOTAL]: 0,
        [STORAGE_KEYS.SYNC_ERROR]: "",
      });
      if (__DEV__) {
        await chrome.storage.local.set({
          debug_sync_info: `[START] forceCfOnly=${forceCfOnly}`,
        });
      }

      const stored: AcceptedSubmission[] =
        ((await chrome.storage.local.get(STORAGE_KEYS.ALL_ACCEPTED_SUBS))[
          STORAGE_KEYS.ALL_ACCEPTED_SUBS
        ] || []).filter((s: any) => s.platform !== 'cses');
      const knownIds =
        stored.length > 0 ? new Set(stored.map((s) => s.id)) : undefined;

      let newSubs = await LeetCodeService.fetchAllAcceptedSubmissions(
        (n) =>
          chrome.storage.local.set({ [STORAGE_KEYS.SYNC_PROGRESS_FETCH]: n }),
        knownIds,
        0,
        false
      );

      const {
        [STORAGE_KEYS.OWN_CF_HANDLE]: cfHandle,
        [STORAGE_KEYS.OWN_CC_HANDLE]: ccHandle,
        [STORAGE_KEYS.OWN_CSES_HANDLE]: csesHandle,
        [STORAGE_KEYS.SYNC_STRICTNESS]: syncStrictness = true,
      } = await chrome.storage.local.get([
        STORAGE_KEYS.OWN_CF_HANDLE,
        STORAGE_KEYS.OWN_CC_HANDLE,
        STORAGE_KEYS.OWN_CSES_HANDLE,
        STORAGE_KEYS.SYNC_STRICTNESS,
      ]);

      const otherPromises = [];
      if (csesHandle)
        otherPromises.push(OtherPlatformsService.getCsesSubmissions(csesHandle));

      const otherResults = await Promise.allSettled(otherPromises);
      for (const result of otherResults) {
        if (result.status === "fulfilled") {
          const fetchedSubs = result.value
            .filter((s) => s.statusDisplay === "Accepted")
            .map((s) => ({
              title: s.title,
              titleSlug: s.titleSlug,
              timestamp: s.timestamp,
              statusDisplay: s.statusDisplay,
              lang: s.lang,
              id: `${s.platform}-${s.titleSlug}`, // compound ID used for dedup
              platform: s.platform,
              difficulty: "Unknown",
              rating: 0,
              code: (s as any).code,
            }));

          // Dedup by compound ID (e.g. "cses-1068", not just "1068")
          const trulyNew = fetchedSubs.filter((s) => !(knownIds && knownIds.has(s.id)));
          newSubs = [...newSubs, ...trulyNew];
        }
      }

      const { manually_solved_problems: manualSolFull } = await chrome.storage.local.get("manually_solved_problems");
      if (manualSolFull) {
        Object.entries(manualSolFull).forEach(([slug, data]: [string, any]) => {
          if (data && data.solved) {
            const id = `manual-${slug}`;
            if (!(knownIds && knownIds.has(id))) {
              newSubs.push({
                title: data.title || slug,
                titleSlug: slug,
                timestamp: Date.now(),
                statusDisplay: "Accepted",
                lang: "manual",
                id,
                platform: data.platform || "other",
              });
            }
          }
        });
      }

      // Fetch Codeforces submissions
      // Fetch CodeChef accepted submissions
      if (ccHandle) {
        try {
          const ccSubs = await CodeChefService.getAcceptedSubmissions(ccHandle);
          const newCcSubs = ccSubs
            .filter((s) => !(knownIds && knownIds.has(`codechef-${s.titleSlug}`)))
            .map((s) => ({
              title: s.title,
              titleSlug: s.titleSlug,
              timestamp: s.timestamp,
              statusDisplay: 'Accepted',
              lang: s.lang,
              id: `codechef-${s.titleSlug}`,
              platform: 'codechef',
              difficulty: 'Unknown',
              rating: 0,
            }));
          newSubs = [...newSubs, ...newCcSubs];
        } catch (e) {
          console.error('[CC] Failed to fetch CC subs during full sync', e);
        }
      }

      if (cfHandle) {
        try {
          const cfSubsRaw = await CodeforcesService.getRecentSubmissions(cfHandle, 3000);
          const newCfSubs = cfSubsRaw
            .filter(
              (s) =>
                (!syncStrictness || s.statusDisplay === "Accepted") &&
                !(knownIds && knownIds.has(s.submissionId || "")),
            )
            .map((s) => ({
              title: s.title,
              titleSlug: s.titleSlug,
              timestamp: s.timestamp,
              statusDisplay: s.statusDisplay,
              lang: s.lang,
              id: s.submissionId || "",
              platform: "codeforces",
              difficulty: (s as any).difficulty || "Unknown",
              rating: (s as any).rating || 0,
            }));
          newSubs = [...newSubs, ...newCfSubs];
        } catch (e) {
          console.error("[CF] Failed to fetch CF subs during full sync", e);
        }
      }

      if (__DEV__) {
        await chrome.storage.local.set({
          debug_sync_info: `[LC] fetched ${newSubs.length} subs`,
        });
      }

      if (newSubs.length === 0 && stored.length === 0) {
        await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_STATUS]: "idle" });
        sendResponse?.({
          success: true,
          synced: 0,
          message: "No accepted submissions found.",
        });
        return;
      }


      const { count } = await this._runSyncPipeline({
        newSubs,
        stored,
        forceCfOnly,
        historyOnly
      });
      sendResponse?.({ success: true, synced: count });
    } catch (err: any) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYNC_STATUS]: "error",
        [STORAGE_KEYS.SYNC_ERROR]: err.message,
      });
      sendResponse?.({ success: false, error: err.message });
    } finally {
      await chrome.storage.session.remove(
        STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS,
      );
    }
  }

  static async handleIncrementalSync() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYNC_STATUS]: "error",
        [STORAGE_KEYS.SYNC_ERROR]: "Offline: Sync will resume when internet connectivity is restored.",
        sync_pending_online: true,
      });
      chrome.alarms.create("retry_sync_offline", { periodInMinutes: 2 });
      return;
    }

    const { [STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS]: inProgress } =
      await chrome.storage.session.get(STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS);
    if (inProgress) return;

    const config = await GitHubSyncService.getConfig();
    if (!config?.token || !config?.repoName) return;

    await chrome.storage.session.set({
      [STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS]: true,
    });

    try {
      await chrome.storage.session.remove('cancel_sync');
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYNC_STATUS]: "fetching",
        [STORAGE_KEYS.SYNC_PROGRESS_FETCH]: 0,
        [STORAGE_KEYS.SYNC_PROGRESS_DONE]: 0,
        [STORAGE_KEYS.SYNC_PROGRESS_TOTAL]: 0,
        [STORAGE_KEYS.SYNC_ERROR]: "",
      });

      const { [STORAGE_KEYS.LAST_SYNCED_TS]: lastSyncedTs } =
        await chrome.storage.local.get(STORAGE_KEYS.LAST_SYNCED_TS);
      const stored: AcceptedSubmission[] =
        ((await chrome.storage.local.get(STORAGE_KEYS.ALL_ACCEPTED_SUBS))[
          STORAGE_KEYS.ALL_ACCEPTED_SUBS
        ] || []).filter((s: any) => s.platform !== 'cses');
      const knownIds = new Set(stored.map((s) => s.id));

      const {
        [STORAGE_KEYS.OWN_CF_HANDLE]: cfHandle,
        [STORAGE_KEYS.OWN_CC_HANDLE]: ccHandle,
        [STORAGE_KEYS.OWN_CSES_HANDLE]: csesHandle,
      } = await chrome.storage.local.get([
        STORAGE_KEYS.OWN_CF_HANDLE,
        STORAGE_KEYS.OWN_CC_HANDLE,
        STORAGE_KEYS.OWN_CSES_HANDLE,
      ]);

      let newSubs = await LeetCodeService.fetchAllAcceptedSubmissions(
        (n) =>
          chrome.storage.local.set({ [STORAGE_KEYS.SYNC_PROGRESS_FETCH]: n }),
        knownIds,
        lastSyncedTs || 0,
      );

      // Append any new Codeforces submissions from the last hour
      if (cfHandle) {
        try {
          const cfSubsRaw = await CodeforcesService.getRecentSubmissions(
            cfHandle,
            20,
          );
          const oneHourAgo = Date.now() - 3_600_000;
          const newCfSubs = cfSubsRaw
            .filter(
              (s) =>
                s.statusDisplay === "Accepted" &&
                s.timestamp >= oneHourAgo &&
                !knownIds.has(s.submissionId || ""),
            )
            .map((s) => ({
              title: s.title,
              titleSlug: s.titleSlug,
              timestamp: s.timestamp,
              statusDisplay: s.statusDisplay,
              lang: s.lang,
              id: s.submissionId || "",
              platform: s.platform,
              difficulty: (s as any).difficulty || "Unknown",
              rating: (s as any).rating || 0,
            }));
          newSubs = [...newSubs, ...newCfSubs];
        } catch (e) {
          console.warn(
            "[SyncManager] Failed to fetch CF subs for incremental sync",
            e,
          );
        }
      }

      // Append any new CodeChef accepted submissions
      if (ccHandle) {
        try {
          const ccSubs = await CodeChefService.getAcceptedSubmissions(ccHandle);
          const newCcSubs = ccSubs
            .filter((s) => !knownIds.has(`codechef-${s.titleSlug}`))
            .map((s) => ({
              title: s.title,
              titleSlug: s.titleSlug,
              timestamp: s.timestamp,
              statusDisplay: 'Accepted',
              lang: s.lang,
              id: `codechef-${s.titleSlug}`,
              platform: 'codechef',
              difficulty: 'Unknown',
              rating: 0,
            }));
          newSubs = [...newSubs, ...newCcSubs];
        } catch (e) {
          console.warn('[SyncManager] Failed to fetch CC subs for incremental sync', e);
        }
      }

      // Add other platforms
      const otherPromises = [];
      if (csesHandle)
        otherPromises.push(
          OtherPlatformsService.getCsesSubmissions(csesHandle),
        );

      const otherResults = await Promise.allSettled(otherPromises);
      for (const result of otherResults) {
        if (result.status === "fulfilled") {
          const fetchedSubs = result.value
            .filter((s) => s.statusDisplay === "Accepted")
            .map((s) => ({
              title: s.title,
              titleSlug: s.titleSlug,
              timestamp: s.timestamp,
              statusDisplay: s.statusDisplay,
              lang: s.lang,
              id: `${s.platform}-${s.titleSlug}`, // compound ID for dedup
              platform: s.platform,
              difficulty: "Unknown",
              rating: 0,
              code: (s as any).code,
            }));

          // Dedup by compound ID (e.g. "cses-1068", not just "1068")
          const trulyNew = fetchedSubs.filter((s) => !knownIds.has(s.id));
          newSubs = [...newSubs, ...trulyNew];
        }
      }

      const { manually_solved_problems: manualSolInc } = await chrome.storage.local.get("manually_solved_problems");
      if (manualSolInc) {
        Object.entries(manualSolInc).forEach(([slug, data]: [string, any]) => {
          if (data && data.solved) {
            const id = `manual-${slug}`;
            if (!knownIds.has(id)) {
              newSubs.push({
                title: data.title || slug,
                titleSlug: slug,
                timestamp: Date.now(),
                statusDisplay: "Accepted",
                lang: "manual",
                id,
                platform: data.platform || "other",
              });
            }
          }
        });
      }

      // Attach runtime stats if recently captured
      const { [STORAGE_KEYS.LATEST_STATS]: latestStats } =
        await chrome.storage.local.get(STORAGE_KEYS.LATEST_STATS);
      if (
        latestStats &&
        Date.now() - latestStats.timestamp < 60_000 &&
        newSubs.length > 0
      ) {
        newSubs[0].runtimeBeats = latestStats.runtimeBeats;
        newSubs[0].memoryBeats = latestStats.memoryBeats;
        await chrome.storage.local.remove(STORAGE_KEYS.LATEST_STATS);
      }

      if (newSubs.length === 0) {
        await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_STATUS]: "idle" });
        return;
      }

      await this._runSyncPipeline({ newSubs, stored });
    } catch (err: any) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SYNC_STATUS]: "error",
        [STORAGE_KEYS.SYNC_ERROR]: err.message,
      });
    } finally {
      await chrome.storage.session.remove(
        STORAGE_KEYS.SESSION_SYNC_IN_PROGRESS,
      );
    }
  }
}
