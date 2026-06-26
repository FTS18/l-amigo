import { StorageService } from "../services/storage";
import { LeetCodeService } from "../services/leetcode";
import { REFRESH_CONSTANTS, NOTIFICATION_CONSTANTS, GITHUB_SYNC_INTERVAL_MINUTES, STORAGE_KEYS } from "../constants";
import { SyncManager } from "./sync-manager";
import { FriendHandler } from "./message-handlers/friend-handler";
import { GitHubSyncService } from "../services/github";
import { ProfileHandler } from "./message-handlers/profile-handler";
import { RefreshHandler } from "./message-handlers/refresh-handler";
import { SettingsHandler } from "./message-handlers/settings-handler";
import { StatsHandler } from "./message-handlers/stats-handler";
import { SyncHandler } from "./message-handlers/sync-handler";
import { MessageHandler } from "./message-handlers/types";


function setupDevAutoReload(): void {
  if (!__DEV__) {
    return;
  }

  const connect = (): void => {
    const socket = new WebSocket("ws://localhost:9091");

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload?.type === "reload") {
          // chrome.runtime.reload(); // Disabled to prevent popup white screens
        }
      } catch {
        // Ignore malformed dev-reload messages.
      }
    };

    socket.onerror = () => socket.close();
    socket.onclose = () => {
      globalThis.setTimeout(connect, 1000);
    };
  };

  connect();
}

setupDevAutoReload();

// Initialize Handlers
const handlers: MessageHandler[] = [
  new FriendHandler(),
  new ProfileHandler(),
  new RefreshHandler(),
  new SettingsHandler(),
  new StatsHandler(),
  new SyncHandler(),
];

chrome.runtime.onInstalled.addListener(() => {
  console.log("L'Amigo installed");
  chrome.alarms.create("refreshFriends", {
    periodInMinutes: REFRESH_CONSTANTS.INTERVAL_MINUTES,
  });
  chrome.alarms.create("syncGitHub", {
    periodInMinutes: GITHUB_SYNC_INTERVAL_MINUTES,
  });
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("L'Amigo started");
  // Reset any stuck sync state from the previous session
  const r = await chrome.storage.local.get([STORAGE_KEYS.SYNC_STATUS]);
  if (r[STORAGE_KEYS.SYNC_STATUS] && r[STORAGE_KEYS.SYNC_STATUS] !== 'idle') {
    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_STATUS]: 'idle' });
  }
  // Remove alarms for contests that already started
  sweepStaleContestAlarms();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "refreshFriends") {
    const refreshHandler = new RefreshHandler();
    await refreshHandler.refreshAllFriends();
  } else if (alarm.name === "syncGitHub") {
    console.log("[L'Amigo] Periodic background sync triggered by alarm");
    await SyncManager.handleIncrementalSync();
  } else if (alarm.name.startsWith("contest-")) {
    // Expected format: contest-{contestId}-{interval}
    const parts = alarm.name.split("-");
    if (parts.length >= 3) {
      const interval = parts.pop();
      const contestId = parts.slice(1).join("-");

      const res = await chrome.storage.local.get([STORAGE_KEYS.CONTEST_REMINDERS]);
      const reminders = res[STORAGE_KEYS.CONTEST_REMINDERS] || {};
      const contest = reminders[contestId];

      if (contest) {
        const timeMsg = interval === "24h" ? "in 24 hours" : interval === "1h" ? "in 1 hour" : "in 10 minutes";
        const platformName = contest.platform === "leetcode" ? "LeetCode" : contest.platform === "codechef" ? "CodeChef" : "Codeforces";

        chrome.notifications.create(`notify-${alarm.name}`, {
          type: "basic",
          iconUrl: "android-chrome-192x192.png",
          title: `${platformName} Contest Reminder!`,
          message: `${contest.name} starts ${timeMsg}! Get ready.`,
          priority: 2,
          requireInteraction: interval === "10m",
        });

        // After the final "10m" alarm fires, clean up all alarms for this contest
        // to prevent orphaned alarms from accumulating over sessions.
        if (interval === "10m") {
          const allAlarms = await chrome.alarms.getAll();
          const contestAlarms = allAlarms.filter(a => a.name.startsWith(`contest-${contestId}-`));
          await Promise.all(contestAlarms.map(a => chrome.alarms.clear(a.name)));
          // Remove from stored reminders since the contest has started
          delete reminders[contestId];
          await chrome.storage.local.set({ [STORAGE_KEYS.CONTEST_REMINDERS]: reminders });
        }
      } else {
        // No reminder found — contest was removed by user, clean up orphaned alarm
        await chrome.alarms.clear(alarm.name);
      }
    }
  }
});

/**
 * On startup: sweep for alarms whose contest start time has already passed.
 * Prevents orphaned alarms from a previous browser session.
 */
async function sweepStaleContestAlarms(): Promise<void> {
  try {
    const [allAlarms, res] = await Promise.all([
      chrome.alarms.getAll(),
      chrome.storage.local.get(STORAGE_KEYS.CONTEST_REMINDERS),
    ]);
    const reminders: Record<string, any> = res[STORAGE_KEYS.CONTEST_REMINDERS] || {};
    const now = Date.now();

    for (const alarm of allAlarms) {
      if (!alarm.name.startsWith('contest-')) continue;
      const parts = alarm.name.split('-');
      if (parts.length < 3) continue;
      parts.pop(); // remove interval suffix
      const contestId = parts.slice(1).join('-');
      const reminder = reminders[contestId];
      // If the contest start time has passed by more than 1 hour, clear everything
      if (!reminder || (reminder.startTimeMs && reminder.startTimeMs + 3_600_000 < now)) {
        await chrome.alarms.clear(alarm.name);
        delete reminders[contestId];
      }
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.CONTEST_REMINDERS]: reminders });
  } catch (e) {
    console.warn('[L\'Amigo] sweepStaleContestAlarms failed:', e);
  }
}

// Central Message Dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Security: only process messages from this extension itself (popup, content scripts, options page).
  // Reject any message whose sender doesn't match our own extension ID.
  const ownId = chrome.runtime.id;
  const fromExtension = sender.id === ownId;
  const allowedContentScriptOrigins = [
    'https://leetcode.com',
    'https://codeforces.com',
    'https://www.codechef.com',
  ];
  const fromContentScript =
    !sender.id && // content scripts have no sender.id
    sender.url !== undefined &&
    allowedContentScriptOrigins.some(origin => sender.url?.startsWith(origin));

  if (!fromExtension && !fromContentScript) {
    console.warn("[L'Amigo] Blocked message from untrusted sender:", sender);
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }

  (async () => {
    for (const handler of handlers) {
      const response = await (handler as MessageHandler).handle(message, sender);
      if (response.error !== 'Unknown action') {
        sendResponse(response);
        return;
      }
    }
  })();

  return true; // Keep channel open for async response
});

// Helper for delay - kept for compatibility if needed by other modules importing background.ts?
// Actually background.ts is an entry point, so exports might not be used elsewhere.
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Debounced state backup to GitHub
let backupTimeout: any = null;
const BACKUP_DEBOUNCE_MS = 5000;

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  const monitoredKeys = [
    "friend_identities_v2",
    "own_username",
    "own_codeforces_handle",
    "own_codechef_handle",
    "darkMode",
    "notifications_enabled",
    "auto_refresh",
    "refresh_interval",
    "cf_dark_mode",
    "daily_goal"
  ];

  const hasRelevantChanges = Object.keys(changes).some(key => monitoredKeys.includes(key));
  if (hasRelevantChanges) {
    if (backupTimeout) {
      clearTimeout(backupTimeout);
    }
    backupTimeout = setTimeout(async () => {
      console.log("[L'Amigo] Debounced state backup triggered by storage changes");
      try {
        await GitHubSyncService.backupState();
      } catch (err) {
        console.error("[L'Amigo] Error performing auto-backup:", err);
      }
    }, BACKUP_DEBOUNCE_MS);
  }
});
