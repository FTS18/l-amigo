export interface Friend {
  username: string;
  addedAt: number;
}

export interface FriendProfile {
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
  recentSubmissions?: RecentSubmission[];
  /** Daily submission counts keyed by Unix timestamp (seconds). Full year from LeetCode. */
  submissionCalendar?: Record<string, number>;
  lastFetched?: number;
  topicStats?: TopicStat[];
  languageStats?: LanguageStat[];
  submissionStats?: {
    totalSubmissions: number;
    acSubmissions: number;
    acceptanceRate: number;
  };
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
}
