import { FriendProfile } from "../types";

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastSubmissionDate: Date | null;
}

export class StreakCalculator {
  static calculateStreak(profile: FriendProfile): StreakInfo {
    const submissions = profile.recentSubmissions || [];

    if (submissions.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastSubmissionDate: null,
      };
    }

    // Group submissions by date
    const submissionDates = submissions.map((sub) => {
      const date = new Date(sub.timestamp);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    });

    // Sort dates descending
    submissionDates.sort((a, b) => b.getTime() - a.getTime());

    // Remove duplicates
    const uniqueDates = Array.from(
      new Set(submissionDates.map((d) => d.getTime())),
    )
      .map((t) => new Date(t))
      .sort((a, b) => b.getTime() - a.getTime());

    if (uniqueDates.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastSubmissionDate: null,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Calculate current streak
    let currentStreak = 0;
    const latestDate = uniqueDates[0];

    // Check if last submission was today or yesterday
    if (
      latestDate.getTime() === today.getTime() ||
      latestDate.getTime() === yesterday.getTime()
    ) {
      currentStreak = 1;
      let checkDate = new Date(latestDate);

      for (let i = 1; i < uniqueDates.length; i++) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (uniqueDates[i].getTime() === checkDate.getTime()) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 1;
    let tempStreak = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      prevDate.setDate(prevDate.getDate() - 1);

      if (uniqueDates[i].getTime() === prevDate.getTime()) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      lastSubmissionDate: latestDate,
    };
  }
}
