import { SyncManager } from '../sync-manager';
import { GitHubSyncService } from '../../services/github';
import { MessageHandler, MessageResponse } from './types';

const SESSION_SYNC_KEY = 'sync_in_progress';

export class SyncHandler implements MessageHandler {
  async handle(message: any): Promise<MessageResponse> {
    const action = message.type || message.action;
    switch (action) {
      case 'newSubmissionDetected':
        return this.handleNewSubmission(message.data);
      case 'fullSync':
        return this.handleFullSync(message.forceCfOnly, message.historyOnly);
      case 'getSyncState':
        return this.handleGetSyncState();
      case 'githubOAuthLogin':
        return this.handleGithubOAuthLogin();
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async handleNewSubmission(data: { runtimeBeats?: string; memoryBeats?: string }): Promise<MessageResponse> {
    const { runtimeBeats, memoryBeats } = data;
    console.log('[RT] New submission detected', { runtimeBeats, memoryBeats });
    
    if (runtimeBeats || memoryBeats) {
      await chrome.storage.local.set({ 
        latest_stats: { runtimeBeats, memoryBeats, timestamp: Date.now() } 
      });
    }

    const { commit_frequency } = await chrome.storage.local.get('commit_frequency');
    if (commit_frequency === 'batch') {
      console.log('[RT] Skipping immediate incremental sync due to batch commit frequency setting.');
      return { success: true };
    }
    
    // Delay to allow LeetCode to update its servers
    setTimeout(() => {
        SyncManager.handleIncrementalSync();
    }, 3000);

    return { success: true };
  }

  private async handleFullSync(forceCfOnly?: boolean, historyOnly?: boolean): Promise<MessageResponse> {
     SyncManager.handleFullSync((res) => {
         console.log('Sync update:', res);
     }, forceCfOnly, historyOnly).catch(console.error);

     return { success: true };
  }

  private async handleGetSyncState(): Promise<MessageResponse> {
    const res = await chrome.storage.session.get(SESSION_SYNC_KEY);
    return { success: true, inProgress: !!res[SESSION_SYNC_KEY] };
  }

  private async handleGithubOAuthLogin(): Promise<MessageResponse> {
    try {
      const token = await GitHubSyncService.loginWithOAuth();
      return { success: true, token };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
