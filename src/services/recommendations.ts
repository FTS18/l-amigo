import { FriendProfile, RecentSubmission } from "../types";
import { LeetCodeService } from "./leetcode";

export interface ProblemRecommendation {
  titleSlug: string;
  title: string;
  difficulty: string;
  reason: string;
  solvedByFriends: string[];
  platform?: string;
}

export class RecommendationService {
  static async getRecommendations(
    profiles: Record<string, FriendProfile>,
    currentUserSolvedProblems: Set<string> = new Set(),
  ): Promise<ProblemRecommendation[]> {
    // Collect all problems solved by friends
    // Key: "platform:titleSlug", Value: { sub: RecentSubmission, friends: string[] }
    const friendProblems = new Map<string, { sub: RecentSubmission, friends: string[] }>();

    Object.entries(profiles)
      .filter(([key]) => key.includes(':'))
      .map(([_, p]) => p)
      .forEach((profile) => {
        const uniqueSolved = new Map<string, RecentSubmission>();
        profile.recentSubmissions?.forEach((sub) => {
          if (sub.statusDisplay === 'Accepted') {
            const platform = sub.platform || profile.platform || 'leetcode';
            const key = `${platform}:${sub.titleSlug}`;
            uniqueSolved.set(key, sub);
          }
        });

        uniqueSolved.forEach((sub, key) => {
          if (!currentUserSolvedProblems.has(sub.titleSlug)) { // user's solved uses titleSlug, but we might want to ensure cross-platform compatibility if needed, though they don't overlap much. Let's assume titleSlug is safe.
            if (!friendProblems.has(key)) {
              friendProblems.set(key, { sub, friends: [] });
            }
            friendProblems.get(key)!.friends.push(profile.username);
          }
        });
      });

    // Calculate difficulty distribution from friends
    const difficultyPreference = this.calculateDifficultyPreference(profiles);

    // Sort problems by number of friends who solved them
    const sortedProblems = Array.from(friendProblems.values())
      .sort((a, b) => b.friends.length - a.friends.length)
      .slice(0, 10);

    const results = await Promise.all(
      sortedProblems.map(async ({ sub, friends }) => {
        let title = sub.title;
        let difficulty = sub.difficulty || 'Medium';
        const platform = sub.platform || 'leetcode';

        // For LeetCode, if difficulty isn't in RecentSubmission, fetch it (fallback)
        if (platform === 'leetcode' && !sub.difficulty) {
           try {
              const data = await LeetCodeService.gql<{
                question: { title: string; difficulty: string } | null;
              }>(
                `query getProblemDetails($titleSlug: String!) {
                  question(titleSlug: $titleSlug) {
                    title
                    difficulty
                  }
                }`,
                { titleSlug: sub.titleSlug },
              );
              if (data?.question) {
                 title = data.question.title;
                 difficulty = data.question.difficulty;
              }
           } catch(e) {}
        }

        const reason = this.generateReason(
          friends.length,
          difficulty,
          difficultyPreference,
        );

        return {
          titleSlug: sub.titleSlug,
          title,
          difficulty,
          reason,
          solvedByFriends: friends,
          platform
        } as ProblemRecommendation;
      }),
    );

    return results;
  }

  private static calculateDifficultyPreference(
    profiles: Record<string, FriendProfile>,
  ) {
    let easyCount = 0,
      mediumCount = 0,
      hardCount = 0;

    Object.entries(profiles)
      .filter(([key]) => key.includes(':'))
      .map(([_, p]) => p)
      .forEach((profile) => {
        easyCount += profile.problemsSolved.easy;
        mediumCount += profile.problemsSolved.medium;
        hardCount += profile.problemsSolved.hard;
      });

    const total = easyCount + mediumCount + hardCount;
    return {
      easy: total > 0 ? easyCount / total : 0,
      medium: total > 0 ? mediumCount / total : 0,
      hard: total > 0 ? hardCount / total : 0,
    };
  }

  private static generateReason(
    friendCount: number,
    difficulty: string,
    preference: any,
  ): string {
    let reason = `Solved by ${friendCount} friend${friendCount > 1 ? "s" : ""}`;

    const difficultyMatch =
      (difficulty === "Easy" && preference.easy > 0.4) ||
      (difficulty === "Medium" && preference.medium > 0.35) ||
      (difficulty === "Hard" && preference.hard > 0.2);

    if (difficultyMatch) {
      reason += ` · Popular ${difficulty} problem`;
    }

    return reason;
  }
}
