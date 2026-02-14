import { StorageService } from "../services/storage";
import { LeetCodeService } from "../services/leetcode";
import { REFRESH_CONSTANTS, NOTIFICATION_CONSTANTS } from "../constants";
import { SyncManager } from "./sync-manager";
import { FriendHandler } from "./message-handlers/friend-handler";
import { ProfileHandler } from "./message-handlers/profile-handler";
import { RefreshHandler } from "./message-handlers/refresh-handler";
import { SettingsHandler } from "./message-handlers/settings-handler";
import { StatsHandler } from "./message-handlers/stats-handler";
import { SyncHandler } from "./message-handlers/sync-handler";
import { MessageHandler } from "./message-handlers/types";

const ALL_SUBS_KEY = "all_accepted_submissions";
const SESSION_SYNC_KEY = "sync_in_progress";

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
