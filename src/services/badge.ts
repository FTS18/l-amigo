import { LeetCodeService } from "./leetcode";
import { STORAGE_KEYS } from "../constants";

export class BadgeService {
  /**
   * Updates the extension icon badge based on authentication status and today's solved count.
   */
  static async updateBadge(): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.action) return;

    try {
      const res = await chrome.storage.local.get([
        STORAGE_KEYS.ALL_ACCEPTED_SUBS,
        STORAGE_KEYS.OWN_USERNAME,
        "daily_goal",
      ]);

      const ownUsername = res[STORAGE_KEYS.OWN_USERNAME];

      // 1. Check LeetCode authentication if an account is configured
      if (ownUsername) {
        const auth = await LeetCodeService.checkAuthStatus();
        if (!auth.isSignedIn) {
          await chrome.action.setBadgeText({ text: "!" });
          await chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" }); // Amber warning
          await chrome.action.setTitle({ title: "L'Amigo: Not logged into LeetCode in browser" });
          return;
        }
      }

      // 2. Count unique problems solved today (since midnight local time)
      const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
      const allSubs: any[] = res[STORAGE_KEYS.ALL_ACCEPTED_SUBS] || [];
      const todaySubs = allSubs.filter((s: any) => (s.timestamp || 0) >= startOfTodayMs);
      
      const uniqueProblems = new Set<string>();
      for (const s of todaySubs) {
        const key = s.titleSlug || s.title || s.id;
        if (key) uniqueProblems.add(key);
      }

      const count = uniqueProblems.size;
      const goal = Number(res.daily_goal) || 3;

      if (count > 0) {
        await chrome.action.setBadgeText({ text: String(count) });
        // Green if daily goal reached, blue if in progress
        const color = count >= goal ? "#10b981" : "#3b82f6";
        await chrome.action.setBadgeBackgroundColor({ color });
        await chrome.action.setTitle({
          title: `L'Amigo: ${count}/${goal} problems solved today`,
        });
      } else {
        await chrome.action.setBadgeText({ text: "" });
        await chrome.action.setTitle({ title: "L'Amigo - Competitive Programming Tracker" });
      }
    } catch (err) {
      console.warn("[BadgeService] Failed to update badge:", err);
    }
  }
}
