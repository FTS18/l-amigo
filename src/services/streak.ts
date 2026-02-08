import { FriendProfile } from "../types";

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastSubmissionDate: Date | null;
}

export class StreakCalculator {
  /**
   * Calculate streak using submissionCalendar (full year, 365 days) when available,
   * falling back to recentSubmissions (~20 items) otherwise.
   */
  static calculateStreak(profile: FriendProfile): StreakInfo {
    // Prefer submissionCalendar — it has full-year daily counts
    const calendar = profile.submissionCalendar;
    if (calendar && Object.keys(calendar).length > 0) {
      return this.fromCalendar(calendar);
    }

    // Fallback to recentSubmissions
    return this.fromRecent(profile.recentSubmissions || []);
  }

  /** Full-year streak from submissionCalendar: {unixTimestampSec: count} */
  private static fromCalendar(calendar: Record<string, number>): StreakInfo {
    const ONE_DAY = 86400000;

    // Convert to unique day-timestamps (midnight local) and sort descending
    const daySet = new Set<number>();
    for (const [tsStr, count] of Object.entries(calendar)) {
      if (count <= 0) continue;
      const d = new Date(parseInt(tsStr, 10) * 1000);
      daySet.add(
        new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
      );
    }

    if (daySet.size === 0) {
      return { currentStreak: 0, longestStreak: 0, lastSubmissionDate: null };
    }

    const uniqueDates = Array.from(daySet).sort((a, b) => b - a);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    const yesterdayTs = todayTs - ONE_DAY;

    // Current streak
    let currentStreak = 0;
    const latestTs = uniqueDates[0];

    if (latestTs === todayTs || latestTs === yesterdayTs) {
      currentStreak = 1;
      let prevTs = latestTs;
      for (let i = 1; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === prevTs - ONE_DAY) {
          currentStreak++;
          prevTs = uniqueDates[i];
        } else {
          break;
        }
      }
    }

    // Longest streak
    let longestStreak = 1;
    let tempStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      if (uniqueDates[i] === uniqueDates[i - 1] - ONE_DAY) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 1;
      }
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      lastSubmissionDate: new Date(latestTs),
    };
  }

  /** Fallback streak from recentSubmissions (~20 items max) */
  private static fromRecent(submissions: { timestamp: number }[]): StreakInfo {
    if (submissions.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastSubmissionDate: null };
    }

    const ONE_DAY = 86400000;
    const daySet = new Set<number>();
    for (const sub of submissions) {
      const d = new Date(sub.timestamp);
      daySet.add(
        new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
      );
    }

    const uniqueDates = Array.from(daySet).sort((a, b) => b - a);
    if (uniqueDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastSubmissionDate: null };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    const yesterdayTs = todayTs - ONE_DAY;

    let currentStreak = 0;
    const latestTs = uniqueDates[0];

    if (latestTs === todayTs || latestTs === yesterdayTs) {
      currentStreak = 1;
      let prevTs = latestTs;
      for (let i = 1; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === prevTs - ONE_DAY) {
          currentStreak++;
          prevTs = uniqueDates[i];
        } else {
          break;
        }
      }
    }

    let longestStreak = 1;
    let tempStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      if (uniqueDates[i] === uniqueDates[i - 1] - ONE_DAY) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 1;
      }
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      lastSubmissionDate: new Date(latestTs),
    };
  }
}
