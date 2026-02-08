import { StorageService } from "../services/storage";
import { LeetCodeService, AcceptedSubmission } from "../services/leetcode";
import { GitHubSyncService } from "../services/github";
import { REFRESH_CONSTANTS, NOTIFICATION_CONSTANTS } from "../constants";

// ── Sync guard ──────────────────────────────────────────────────────
let syncInProgress = false;
const ALL_SUBS_KEY = "all_accepted_submissions";

// ── Alarms & lifecycle ──────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log("L'Amigo installed");
  chrome.alarms.create("refreshFriends", {
    periodInMinutes: REFRESH_CONSTANTS.INTERVAL_MINUTES,
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log("L'Amigo started");
  // Clear stale sync status from a previous session that may have been interrupted
  chrome.storage.local.get(["sync_status", "sync_resume_offset"], (r) => {
    if (r.sync_status && r.sync_status !== "idle") {
      // Don't clear resume offset - allow resuming on next manual sync
      chrome.storage.local.set({ sync_status: "idle" });
    }
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "refreshFriends") {
    await refreshAllFriends();
  }
});

// ── Friend refresh ──────────────────────────────────────────────────

async function refreshAllFriends() {
  try {
    const friends = await StorageService.getFriends();
    const { own_username: ownUsername } =
      await chrome.storage.local.get("own_username");

    // Refresh own profile
    if (ownUsername) {
      try {
        const p = await LeetCodeService.fetchUserProfile(ownUsername);
        await StorageService.saveProfile(p);
      } catch (e) {
        console.error("Error refreshing own profile:", e);
      }
    }

    for (const friend of friends) {
      try {
        const profile = await LeetCodeService.fetchUserProfile(friend.username);
        await checkForNewSubmissions(friend.username, profile);
        await StorageService.saveProfile(profile);
        await delay(REFRESH_CONSTANTS.DELAY_BETWEEN_REQUESTS);
      } catch (e) {
        console.error(`Error refreshing ${friend.username}:`, e);
      }
    }

    console.log("Friend refresh complete");
  } catch (e) {
    console.error("Background refresh error:", e);
  }
}

// ── Notifications ───────────────────────────────────────────────────

async function checkForNewSubmissions(username: string, newProfile: any) {
  const { notifications_enabled } = await chrome.storage.local.get(
    "notifications_enabled",
  );
  if (!(notifications_enabled ?? true)) return;

  const old = await StorageService.getProfile(username);
  if (!old?.recentSubmissions?.length || !newProfile.recentSubmissions?.length)
    return;

  const oldTs = old.recentSubmissions[0]?.timestamp || 0;
  const newTs = newProfile.recentSubmissions[0]?.timestamp || 0;

  if (newTs > oldTs) {
    const sub = newProfile.recentSubmissions[0];
    chrome.notifications.create({
      type: "basic",
      iconUrl: NOTIFICATION_CONSTANTS.getIconPath(),
      title: `${username} solved a problem!`,
      message: `${sub.title} (${sub.lang})`,
      priority: NOTIFICATION_CONSTANTS.PRIORITY,
    });
  }
}

// ── Full sync (GraphQL → GitHub) ────────────────────────────────────

/**
 * Smart sync – used by the manual "Sync With GitHub" button.
 *
 * **First-ever sync** (no stored submissions): full paginated fetch.
 * **Subsequent syncs**: loads stored submissions as knownIds, uses incremental
 * mode so it stops early once it sees 2 consecutive all-known pages.
 * Then only pushes un-synced submissions to GitHub.
 */
async function handleFullSync(sendResponse?: (r: any) => void) {
  if (syncInProgress) {
    sendResponse?.({ success: false, error: "Sync already in progress" });
    return;
  }
  syncInProgress = true;

  try {
    await chrome.storage.local.set({
      sync_status: "fetching",
      sync_progress_fetch: 0,
      sync_progress_done: 0,
      sync_progress_total: 0,
      sync_error: "",
    });

    // Load previously stored submissions (if any)
    const stored: AcceptedSubmission[] =
      (await chrome.storage.local.get(ALL_SUBS_KEY))[ALL_SUBS_KEY] || [];
    const knownIds =
      stored.length > 0 ? new Set(stored.map((s) => s.id)) : undefined;

    const isFirstSync = !knownIds;
    console.log(
      isFirstSync
        ? "[Sync] First sync – full fetch…"
        : `[Sync] Incremental sync (${knownIds!.size} already known)…`,
    );

    const newSubs = await LeetCodeService.fetchAllAcceptedSubmissions(
      (n) => chrome.storage.local.set({ sync_progress_fetch: n }),
      knownIds, // undefined on first sync → full fetch; Set on subsequent → incremental
    );

    // Merge: on first sync newSubs IS everything; on incremental it's only the new ones
    const allSubs = isFirstSync ? newSubs : [...newSubs, ...stored];

    // Persist the merged list for future incremental syncs
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

    console.log(
      `[Sync] ${allSubs.length} total accepted (${newSubs.length} new). Starting GitHub sync…`,
    );
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
    console.log(`[Sync] Done – ${count} new submissions synced`);

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
    console.error("[Sync] Error:", err);
    await chrome.storage.local.set({
      sync_status: "error",
      sync_error: err.message,
    });
    sendResponse?.({ success: false, error: err.message });
  } finally {
    syncInProgress = false;
  }
}

// ── Incremental sync (only fetch new submissions) ───────────────────

/**
 * INCREMENTAL sync – triggered automatically when a new AC is detected
 * or could be called periodically.
 * 1. Load previously stored submission list from chrome.storage.
 * 2. Fetch only new submissions (stops early once it hits known IDs).
 * 3. Merge and push only the new ones to GitHub.
 *
 * This is extremely fast compared to full sync (usually 1-2 API pages).
 */
async function handleIncrementalSync() {
  if (syncInProgress) {
    console.log("[RT] Sync already in progress, skipping incremental");
    return;
  }
  const config = await GitHubSyncService.getConfig();
  if (!config?.token || !config?.repoName) {
    console.log("[RT] GitHub not configured, skipping");
    return;
  }

  syncInProgress = true;

  try {
    await chrome.storage.local.set({
      sync_status: "fetching",
      sync_progress_fetch: 0,
      sync_progress_done: 0,
      sync_progress_total: 0,
      sync_error: "",
    });

    // Load stored submissions for known-ID check
    const stored: AcceptedSubmission[] =
      (await chrome.storage.local.get(ALL_SUBS_KEY))[ALL_SUBS_KEY] || [];
    const knownIds = new Set(stored.map((s) => s.id));

    console.log(`[RT] Incremental fetch (${knownIds.size} known)…`);
    const newSubs = await LeetCodeService.fetchAllAcceptedSubmissions(
      (n) => chrome.storage.local.set({ sync_progress_fetch: n }),
      knownIds,
    );

    if (newSubs.length === 0) {
      await chrome.storage.local.set({ sync_status: "idle" });
      console.log("[RT] No new submissions");
      return;
    }

    // Merge new + stored for correct try numbering, then persist
    const merged = [...newSubs, ...stored];
    await chrome.storage.local.set({ [ALL_SUBS_KEY]: merged });

    await chrome.storage.local.set({ sync_status: "syncing" });
    console.log(`[RT] ${newSubs.length} new – syncing to GitHub…`);

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
    console.log(`[RT] Incremental done – ${count} pushed`);
  } catch (err: any) {
    console.error("[RT] Incremental sync failed:", err);
    await chrome.storage.local.set({
      sync_status: "error",
      sync_error: err.message,
    });
  } finally {
    syncInProgress = false;
  }
}

// ── Real-time submission from content script ────────────────────────

async function handleNewSubmission() {
  console.log("[RT] New submission detected – triggering incremental sync");
  // Small delay to let LeetCode's backend register the new submission
  await delay(3000);
  await handleIncrementalSync();
}

// ── Message router ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "refreshNow") {
    refreshAllFriends().then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === "updateRefreshSettings") {
    const { autoRefresh, interval } = message;
    if (autoRefresh) {
      chrome.alarms.create("refreshFriends", {
        periodInMinutes: interval || REFRESH_CONSTANTS.INTERVAL_MINUTES,
      });
      sendResponse({ success: true });
    } else {
      chrome.alarms.clear("refreshFriends", (ok) =>
        sendResponse({ success: ok }),
      );
    }
    return true;
  }

  if (message.type === "newSubmissionDetected") {
    handleNewSubmission().catch(console.error);
    sendResponse({ success: true });
    return true;
  }

  // ★ Manual full-sync from popup
  if (message.type === "fullSync") {
    handleFullSync(sendResponse).catch(console.error);
    return true; // keep channel open
  }

  // ★ Query current sync state (popup uses this on open)
  if (message.type === "getSyncState") {
    sendResponse({ inProgress: syncInProgress });
    return true;
  }
});

// ── Utility ─────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
