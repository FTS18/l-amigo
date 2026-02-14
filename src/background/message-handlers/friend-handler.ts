import { StorageService } from '../../services/storage';
import { LeetCodeService } from '../../services/leetcode';
import { MessageHandler, MessageResponse } from './types';

export class FriendHandler implements MessageHandler {
  async handle(message: any): Promise<MessageResponse> {
    switch (message.action) {
      case 'addFriend':
        return this.handleAddFriend(message.username);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async handleAddFriend(username: string): Promise<MessageResponse> {
    try {
      await StorageService.addFriend(username);
      const profile = await LeetCodeService.fetchUserProfile(username);
      await StorageService.saveProfile(profile);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
