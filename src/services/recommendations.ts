import { FriendProfile, RecentSubmission } from "../types";
import { LeetCodeService } from "./leetcode";

export interface ProblemRecommendation {
  titleSlug: string;
  title: string;
  difficulty: string;
  reason: string;
  solvedByFriends: string[];
}

export class RecommendationService {
  static async getRecommendations(
    profiles: Record<string, FriendProfile>,
    currentUserSolvedProblems: Set<string> = new Set(),
  ): Promise<ProblemRecommendation[]> {
    // Collect all problems solved by friends
    const friendProblems = new Map<string, string[]>();

    Object.values(profiles).forEach((profile) => {
      profile.recentSubmissions?.forEach((sub) => {
        if (!currentUserSolvedProblems.has(sub.titleSlug)) {
          if (!friendProblems.has(sub.titleSlug)) {
            friendProblems.set(sub.titleSlug, []);
          }
          friendProblems.get(sub.titleSlug)!.push(profile.username);
        }
      });
    });

    // Calculate difficulty distribution from friends
    const difficultyPreference = this.calculateDifficultyPreference(profiles);

    // Sort problems by number of friends who solved them
    const sortedProblems = Array.from(friendProblems.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);

    // Fetch problem details in parallel (all at once – max 10 requests)
    const results = await Promise.allSettled(
      sortedProblems.map(async ([titleSlug, friendsWhoSolved]) => {
        const data = await LeetCodeService.gql<{
          question: { title: string; difficulty: string } | null;
        }>(
          `query getProblemDetails($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              title
              difficulty
            }
          }`,
          { titleSlug },
        );

        const problemDetails = data?.question;
        if (!problemDetails) return null;

        const reason = this.generateReason(
          friendsWhoSolved.length,
          problemDetails.difficulty,
          difficultyPreference,
        );
        return {
          titleSlug,
          title: problemDetails.title,
          difficulty: problemDetails.difficulty,
          reason,
          solvedByFriends: friendsWhoSolved,
        } as ProblemRecommendation;
      }),
    );

    const recommendations = results
      .filter((r): r is PromiseFulfilledResult<ProblemRecommendation | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((v): v is ProblemRecommendation => v !== null);

    return recommendations;
  }

  private static calculateDifficultyPreference(
    profiles: Record<string, FriendProfile>,
  ) {
    let easyCount = 0,
      mediumCount = 0,
      hardCount = 0;

    Object.values(profiles).forEach((profile) => {
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
