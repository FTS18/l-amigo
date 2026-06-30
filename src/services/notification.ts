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

 static async checkStreakSavior(username: string, profile: any) {
 const { streak_savior_alerts, last_streak_savior_alert_date } = await chrome.storage.local.get([
 "streak_savior_alerts", 
 "last_streak_savior_alert_date"
 ]);
 
 // Default to off if not explicitly enabled
 if (!streak_savior_alerts) return;

 const streakInfo = StreakCalculator.calculateStreak(profile);
 
 let isActiveToday = false;
 if (streakInfo.lastSubmissionDate) {
 const today = new Date();
 isActiveToday = streakInfo.lastSubmissionDate.getDate() === today.getDate() &&
 streakInfo.lastSubmissionDate.getMonth() === today.getMonth() &&
 streakInfo.lastSubmissionDate.getFullYear() === today.getFullYear();
 }

 // Only warn if they actually have a streak going but haven't solved today
 if (streakInfo.currentStreak > 0 && !isActiveToday) {
 const now = new Date();
 // Check if it's past 8 PM local time
 if (now.getHours() >= 20) {
 const todayStr = now.toDateString();
 
 // Don't spam, only once per day
 if (last_streak_savior_alert_date !== todayStr) {
 chrome.notifications.create({
 type: "basic",
 iconUrl: "public/favicon-32x32.png",
 title: " Streak Savior Warning!",
 message: `You haven't solved any problems today! Keep your ${streakInfo.currentStreak}-day streak alive before midnight!`,
 priority: 2,
 });
 
 await chrome.storage.local.set({ last_streak_savior_alert_date: todayStr });
 }
 }
 }
 }
}
