import { REFRESH_CONSTANTS } from '../../constants';
import { MessageHandler, MessageResponse } from './types';

// Helper function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
// Import StorageService and LeetCodeService to break circular dependency issues if any,
// but for RefreshHandler we might need to inject dependencies or import them.
import { StorageService } from '../../services/storage';
import { LeetCodeService } from '../../services/leetcode';

export class RefreshHandler implements MessageHandler {
  async handle(message: any): Promise<MessageResponse> {
    if (message.action === 'refreshNow') {
      await this.refreshAllFriends();
      return { success: true };
    }
    return { success: false, error: 'Unknown action' };
  }

  async refreshAllFriends(): Promise<void> {
    try {
      const friends = await StorageService.getFriends();
      const { own_username: ownUsername } = await chrome.storage.local.get('own_username');

      if (ownUsername) {
        try {
          const p = await LeetCodeService.fetchUserProfile(ownUsername);
          await StorageService.saveProfile(p);
        } catch (e) {
          console.error('Error refreshing own profile:', e);
        }
      }

      for (const friend of friends) {
        try {
          const profile = await LeetCodeService.fetchUserProfile(friend.username);
          // Check for new submissions logic is currently in background.ts
          // We should ideally move that logic to a shared service or keep it here if it fits.
          // For now, let's keep it simple and just save the profile.
          // In a full refactor, we would inject a 'NotificationService' or similar.
           await this.checkForNewSubmissions(friend.username, profile);
          
          await StorageService.saveProfile(profile);
          await delay(REFRESH_CONSTANTS.DELAY_BETWEEN_REQUESTS);
        } catch (e) {
          console.error(`Error refreshing ${friend.username}:`, e);
        }
      }

      console.log('Friend refresh complete');
    } catch (e) {
      console.error('Background refresh error:', e);
    }
  }

  // Duplicating this logic for now to avoid circular dependency with background.ts
  // In a future step, this should be moved to a NotificationService.
  private async checkForNewSubmissions(username: string, newProfile: any) {
      const { notifications_enabled } = await chrome.storage.local.get('notifications_enabled');
      if (!(notifications_enabled ?? true)) return;
    
      const old = await StorageService.getProfile(username);
      if (!old?.recentSubmissions?.length || !newProfile.recentSubmissions?.length)
        return;
    
      const oldTs = old.recentSubmissions[0]?.timestamp || 0;
      const newTs = newProfile.recentSubmissions[0]?.timestamp || 0;
    
      if (newTs > oldTs) {
        const sub = newProfile.recentSubmissions[0];
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'public/favicon-32x32.png', // Hardcoded for now as constant import might be tricky
          title: `${username} solved a problem!`,
          message: `${sub.title} (${sub.lang})`,
          priority: 0,
        });
      }
    }
}
