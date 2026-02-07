import { StorageService } from "../services/storage";
import { LeetCodeService } from "../services/leetcode";

// Refresh interval: 1 hour
const REFRESH_INTERVAL = 60; // minutes

chrome.runtime.onInstalled.addListener(() => {
  console.log("L'Amigo installed");

  // Create periodic alarm for refreshing friend data
  chrome.alarms.create("refreshFriends", {
    periodInMinutes: REFRESH_INTERVAL,
  });
});

// Listen for alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "refreshFriends") {
    await refreshAllFriends();
  }
});

// Refresh all friends' data
async function refreshAllFriends() {
  try {
    const friends = await StorageService.getFriends();

    if (friends.length === 0) {
      return;
    }

    console.log(`Refreshing data for ${friends.length} friends...`);

    for (const friend of friends) {
      try {
        const profile = await LeetCodeService.fetchUserProfile(friend.username);
        await StorageService.saveProfile(profile);

        // Check if there's a new submission (notify user)
        await checkForNewSubmissions(friend.username, profile);

        // Add delay to avoid rate limiting
        await delay(2000);
      } catch (error) {
        console.error(`Error refreshing ${friend.username}:`, error);
      }
    }

    console.log("Finished refreshing all friends");
  } catch (error) {
    console.error("Error in background refresh:", error);
  }
}

// Check for new submissions and send notifications
async function checkForNewSubmissions(username: string, newProfile: any) {
  const oldProfile = await StorageService.getProfile(username);

  if (
    !oldProfile ||
    !oldProfile.recentSubmissions ||
    !newProfile.recentSubmissions
  ) {
    return;
  }

  const oldLatestTimestamp = oldProfile.recentSubmissions[0]?.timestamp || 0;
  const newLatestTimestamp = newProfile.recentSubmissions[0]?.timestamp || 0;

  if (newLatestTimestamp > oldLatestTimestamp) {
    const newSubmission = newProfile.recentSubmissions[0];

    // Send notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon48.png",
      title: `${username} solved a problem!`,
      message: `${newSubmission.title} (${newSubmission.lang})`,
      priority: 1,
    });
  }
}

// Utility function for delays
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "refreshNow") {
    refreshAllFriends().then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
});
