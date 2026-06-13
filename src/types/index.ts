export type Platform = "leetcode" | "codeforces" | "codechef";

export interface PlatformAccount {
  platform: Platform;
  handle: string;
  status: "active" | "pending" | "invalid";
  lastFetched?: number;
}

export interface FriendIdentity {
  id: string;
  displayName: string;
  aliases: string[];
  accounts: PlatformAccount[];
  addedAt: number;
  updatedAt: number;
}

export interface Friend {
  id?: string;
  displayName?: string;
  aliases?: string[];
  accounts?: PlatformAccount[];
  username: string;
  addedAt: number;
}

export interface FriendProfile {
  id?: string;
  platform?: Platform;
  profileUrl?: string;
  username: string;
  realName?: string;
  avatar?: string;
  ranking?: number;
  problemsSolved: {
    total: number;
    easy: number;
    medium: number;
    hard: number;
  };
  contributionPoints?: number;
  reputation?: number;
  contestRating?: number;
  contestRanking?: number;
  bestGlobalRank?: number;
  recentSubmissions?: RecentSubmission[];
  /** Daily submission counts keyed by Unix timestamp (seconds). Full year from LeetCode. */
  submissionCalendar?: Record<string, number>;
  lastFetched?: number;
  contestCount?: number;
  topicStats?: TopicStat[];
  languageStats?: LanguageStat[];
  ratingHistory?: RatingHistoryEntry[];
  submissionStats?: {
    totalSubmissions: number;
    acSubmissions: number;
    acceptanceRate: number;
  };
  codeforcesStats?: {
    rankLabel: string;
    ratingDelta: number;
    dailyPulse: number;
    divisionCounts: {
      div1: number;
      div2: number;
      div3: number;
      div4: number;
    };
    globalContests: number;
    maxRating?: number;
    latestRank?: number;
    verdictCounts?: Record<string, number>;
  };
}

export interface RatingHistoryEntry {
  contestName: string;
  rating: number;
  ranking?: number;
  timestamp: number; // in milliseconds
  contestId?: string | number;
}



export interface TopicStat {
  topicName: string;
  problemsSolved: number;
}

export interface LanguageStat {
  languageName: string;
  problemsSolved: number;
}

export interface RecentSubmission {
  title: string;
  titleSlug: string;
  timestamp: number;
  statusDisplay: string;
  lang: string;
  submissionId?: string;
  platform?: Platform;
  difficulty?: string;
  rating?: number;
}
