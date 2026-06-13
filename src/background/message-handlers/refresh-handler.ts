import { REFRESH_CONSTANTS } from "../../constants";
import { MessageHandler, MessageResponse } from "./types";
import { StorageService } from "../../services/storage";
import { LeetCodeService } from "../../services/leetcode";
import { PlatformService } from "../../services/platform-service";
import { NotificationService } from "../../services/notification";

// Helper function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class RefreshHandler implements MessageHandler {
  async handle(message: any): Promise<MessageResponse> {
    if (message.action === "refreshNow") {
      await this.refreshAllFriends();
      return { success: true };
    }
    return { success: false, error: "Unknown action" };
  }

  async refreshAllFriends(): Promise<void> {
    try {
      const identities = await StorageService.getIdentities();
      const { own_username: ownUsername, own_codeforces_handle: ownCodeforcesHandle, own_codechef_handle: ownCodechefHandle } =
        await chrome.storage.local.get(["own_username", "own_codeforces_handle", "own_codechef_handle"]);

      if (ownUsername) {
        try {
          const oldOwn = await StorageService.getProfile(ownUsername);
          const p = await LeetCodeService.fetchUserProfile(ownUsername);
          await NotificationService.checkOwnMilestones(ownUsername, oldOwn, p);
          await StorageService.saveProfile(p);
        } catch (e) {
          console.error("Error refreshing own LeetCode profile:", e);
        }
      }

      if (ownCodeforcesHandle) {
        try {
          const p = await PlatformService.fetchProfile('codeforces', ownCodeforcesHandle);
          await StorageService.saveProfile(p);
        } catch (e) {
          console.error("Error refreshing own Codeforces profile:", e);
        }
      }

      if (ownCodechefHandle) {
        try {
          const p = await PlatformService.fetchProfile('codechef', ownCodechefHandle);
          await StorageService.saveProfile(p);
        } catch (e) {
          console.error("Error refreshing own Codechef profile:", e);
        }
      }

      for (const identity of identities) {
        for (const account of identity.accounts) {
          try {
            const profile = await PlatformService.fetchProfile(
              account.platform,
              account.handle,
            );
            if (account.platform === "leetcode") {
              await NotificationService.checkForNewSubmissions(account.handle, profile);
            }

            await StorageService.saveProfile(profile);
            await delay(REFRESH_CONSTANTS.DELAY_BETWEEN_REQUESTS);
          } catch (e) {
            console.error(
              `Error refreshing ${account.platform}:${account.handle}:`,
              e,
            );
          }
        }
      }

      console.log("Friend refresh complete");
    } catch (e) {
      console.error("Background refresh error:", e);
    }
  }
}
