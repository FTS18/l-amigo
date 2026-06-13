import { StreakCalculator } from "./streak";
import { StorageService } from "./storage";

export class NotificationService {
  static async checkForNewSubmissions(username: string, newProfile: any) {
    const { notifications_enabled } = await chrome.storage.local.get("notifications_enabled");
    if (!(notifications_enabled ?? true)) return;

    const old = await StorageService.getProfile(username);
    if (!old?.recentSubmissions?.length || !newProfile.recentSubmissions?.length) return;

    const oldTs = old.recentSubmissions[0]?.timestamp || 0;
    const newTs = newProfile.recentSubmissions[0]?.timestamp || 0;

    if (newTs > oldTs) {
      const sub = newProfile.recentSubmissions[0];
      chrome.notifications.create({
        type: "basic",
        iconUrl: "public/favicon-32x32.png",
        title: `${username} solved a problem!`,
        message: `${sub.title} (${sub.lang})`,
        priority: 0,
      });
    }
  }

  static async checkOwnMilestones(username: string, oldProfile: any, newProfile: any) {
    if (!oldProfile) return;

    const { notifications_enabled } = await chrome.storage.local.get("notifications_enabled");
    if (!(notifications_enabled ?? true)) return;

    // Check Hard Problems count
    const oldHard = oldProfile.problemsSolved?.hard || 0;
    const newHard = newProfile.problemsSolved?.hard || 0;

    const hardMilestones = [10, 50, 100, 200, 300, 500];
    for (const m of hardMilestones) {
      if (oldHard < m && newHard >= m) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "public/favicon-32x32.png",
          title: "Milestone Achieved! ",
          message: `Congratulations! You just solved your ${m}th Hard problem!`,
          priority: 2,
        });
        break;
      }
    }

    // Check Streak
    const oldStreak = StreakCalculator.calculateStreak(oldProfile).currentStreak;
    const newStreak = StreakCalculator.calculateStreak(newProfile).currentStreak;

    const streakMilestones = [7, 30, 50, 100, 365];
    for (const m of streakMilestones) {
      if (oldStreak < m && newStreak >= m) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "public/favicon-32x32.png",
          title: "Streak Milestone! ",
          message: `You've hit a ${m} day streak! Keep it up!`,
          priority: 2,
        });
        break;
      }
    }
  }
}
