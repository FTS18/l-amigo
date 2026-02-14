import { StorageService } from '../../services/storage';
import { MessageHandler, MessageResponse } from './types';

export class StatsHandler implements MessageHandler {
  async handle(message: any): Promise<MessageResponse> {
    switch (message.type) {
      case 'getProblemSolvers':
        return this.handleGetProblemSolvers(message.titleSlug);
      case 'getDailyProgress':
        return this.handleGetDailyProgress();
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async handleGetProblemSolvers(titleSlug: string): Promise<MessageResponse> {
    const profiles = await StorageService.getProfiles();
    const solvers: any[] = [];
    
    Object.values(profiles).forEach((p: any) => {
      const solved = p.recentSubmissions?.some(
        (s: any) => s.titleSlug === titleSlug && s.statusDisplay === 'Accepted'
      );
      if (solved) {
        solvers.push({ username: p.username, avatar: p.avatar });
      }
    });

    return { success: true, solvers };
  }

  private async handleGetDailyProgress(): Promise<MessageResponse> {
    const { own_username } = await chrome.storage.local.get('own_username');
    if (!own_username) return { success: false, error: 'No username' };
    
    const profile = await StorageService.getProfile(own_username);
    if (!profile) return { success: false, error: 'No profile' };
    
    const today = new Date().setHours(0, 0, 0, 0) / 1000;
    const count = profile.recentSubmissions?.filter(
      (s: any) => s.timestamp >= today && s.statusDisplay === 'Accepted'
    ).length || 0;
    
    const { daily_goal } = await chrome.storage.local.get('daily_goal');
    return { success: true, count, goal: daily_goal || 3 };
  }
}
