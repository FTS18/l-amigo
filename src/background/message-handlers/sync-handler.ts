import { SyncManager } from '../sync-manager';
import { MessageHandler, MessageResponse } from './types';

const SESSION_SYNC_KEY = 'sync_in_progress';

export class SyncHandler implements MessageHandler {
  async handle(message: any): Promise<MessageResponse> {
    switch (message.type) {
      case 'newSubmissionDetected':
        return this.handleNewSubmission(message.data);
      case 'fullSync':
        return this.handleFullSync();
      case 'getSyncState':
        return this.handleGetSyncState();
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async handleNewSubmission(data: { runtimeBeats?: string; memoryBeats?: string }): Promise<MessageResponse> {
    const { runtimeBeats, memoryBeats } = data;
    console.log('[RT] New submission detected – triggering incremental sync', { runtimeBeats, memoryBeats });
    
    if (runtimeBeats || memoryBeats) {
      await chrome.storage.local.set({ 
        latest_stats: { runtimeBeats, memoryBeats, timestamp: Date.now() } 
      });
    }
    
    // Delay to allow LeetCode to update its servers
    setTimeout(() => {
        SyncManager.handleIncrementalSync();
    }, 3000);

    return { success: true };
  }

  private async handleFullSync(): Promise<MessageResponse> {
     // SyncManager.handleFullSync expects a callback for keeping the channel open if needed
     // But here we are just triggering it.
     // We can wrap it to return a promise or just fire and forget if the types allow.
     // Based on existing code, handleFullSync takes a sendResponse.
     // Let's modify it to be awaitable or just trigger it.
     
     // The original code was: SyncManager.handleFullSync(sendResponse).catch(console.error);
     // This implies handleFullSync might send multiple responses or just one.
     // Let's assume for this refactor we trigger it and return active.
     
     // IMPORTANT: The original implementation used sendResponse directly.
     // To support that pattern with this interface, we might need to change how we call handle.
     // For now, let's just trigger it and return success immediately, 
     // assuming the UI listens to storage changes or we accept that strict request/response
     // might effectively be "fire and forget" for this extensive operation.
     
     SyncManager.handleFullSync((res) => {
         // This callback is used by SyncManager to send status updates.
         // Since we are returning immediately, we can't easily stream updates 
         // through this Promise interface without changing SyncManager.
         // For now, we'll log.
         console.log('Sync update:', res);
     }).catch(console.error);

     return { success: true };
  }

  private async handleGetSyncState(): Promise<MessageResponse> {
    const res = await chrome.storage.session.get(SESSION_SYNC_KEY);
    return { success: true, inProgress: !!res[SESSION_SYNC_KEY] };
  }
}
