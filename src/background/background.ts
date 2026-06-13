import { StorageService } from "../services/storage";
import { LeetCodeService } from "../services/leetcode";
import { REFRESH_CONSTANTS, NOTIFICATION_CONSTANTS, GITHUB_SYNC_INTERVAL_MINUTES } from "../constants";
import { SyncManager } from "./sync-manager";
import { FriendHandler } from "./message-handlers/friend-handler";
import { GitHubSyncService } from "../services/github";
import { ProfileHandler } from "./message-handlers/profile-handler";
import { RefreshHandler } from "./message-handlers/refresh-handler";
import { SettingsHandler } from "./message-handlers/settings-handler";
import { StatsHandler } from "./message-handlers/stats-handler";
import { SyncHandler } from "./message-handlers/sync-handler";
import { MessageHandler } from "./message-handlers/types";

const ALL_SUBS_KEY = "all_accepted_submissions";
const SESSION_SYNC_KEY = "sync_in_progress";

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

chrome.runtime.onStartup.addListener(() => {
  console.log("L'Amigo started");
  chrome.storage.local.get(["sync_status", "sync_resume_offset"], (r) => {
    if (r.sync_status && r.sync_status !== "idle") {
      chrome.storage.local.set({ sync_status: "idle" });
    }
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "refreshFriends") {
    // We can instantiate RefreshHandler or use the global one.
    // Ideally we should have a Service or Manager for this logic, but handler works too.
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

      chrome.storage.local.get(["contest_reminders"], (res) => {
        const reminders = res.contest_reminders || {};
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
            requireInteraction: interval === "10m"
          });
        }
      });
    }
  }
});

// Central Message Dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    for (const handler of handlers) {
      const response = await (handler as MessageHandler).handle(message, sender);
      // If the handler didn't return an error about "Unknown action", it effectively handled it (or tried to).
      // However, our current implementation returns { success: false, error: 'Unknown action' } if it doesn't match.
      // We should check if it was handled.
      // A better pattern might be handlers having a `canHandle` method or checking response error.
      
      if (response.error !== 'Unknown action') {
        sendResponse(response);
        return;
      }
    }
    // If no handler matched
    // sendResponse({ success: false, error: 'Unknown action' });
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
