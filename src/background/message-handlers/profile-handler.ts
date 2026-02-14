import { StorageService } from '../../services/storage';
import { LeetCodeService } from '../../services/leetcode';
import { MessageHandler, MessageResponse } from './types';

export class ProfileHandler implements MessageHandler {
  async handle(message: any): Promise<MessageResponse> {
    switch (message.action) {
      case 'fetchProfile':
        return this.handleFetchProfile(message.username);
      case 'getOwnProfile':
        return this.handleGetOwnProfile();
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async handleFetchProfile(username: string): Promise<MessageResponse> {
    try {
      const profile = await LeetCodeService.fetchUserProfile(username);
      await StorageService.saveProfile(profile);
      return { success: true, data: profile };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async handleGetOwnProfile(): Promise<MessageResponse> {
    try {
      const { own_username } = await chrome.storage.local.get('own_username');
      if (!own_username) return { success: false, error: 'Not configured' };
      
      const profile = await StorageService.getProfile(own_username);
      return { success: true, data: { profile, username: own_username } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
