import { REFRESH_CONSTANTS } from '../../constants';
import { MessageHandler, MessageResponse } from './types';

export class SettingsHandler implements MessageHandler {
  async handle(message: any): Promise<MessageResponse> {
    if (message.action === 'updateRefreshSettings') {
        const { autoRefresh, interval } = message;
        if (autoRefresh) {
            chrome.alarms.create('refreshFriends', {
                periodInMinutes: interval || REFRESH_CONSTANTS.INTERVAL_MINUTES,
            });
            return { success: true };
        } else {
            return new Promise((resolve) => {
                chrome.alarms.clear('refreshFriends', (ok) => {
                    resolve({ success: ok });
                });
            });
        }
    }
    return { success: false, error: 'Unknown action' };
  }
}
