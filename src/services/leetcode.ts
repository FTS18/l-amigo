import { FriendProfile, RecentSubmission } from "../types";

export class LeetCodeService {
  private static readonly GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";

  static async fetchUserProfile(username: string): Promise<FriendProfile> {
    try {
      // Fetch user profile data
      const profileQuery = {
        query: `
          query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              username
              profile {
                realName
                userAvatar
                ranking
                reputation
              }
              submitStats {
                acSubmissionNum {
                  difficulty
                  count
                  submissions
                }
                totalSubmissionNum {
                  difficulty
                  count
                  submissions
                }
              }
              tagProblemCounts {
                advanced {
                  tagName
                  problemsSolved
                }
                intermediate {
                  tagName
                  problemsSolved
                }
                fundamental {
                  tagName
                  problemsSolved
                }
              }
              languageProblemCount {
                languageName
                problemsSolved
              }
            }
            userContestRanking(username: $username) {
              rating
              globalRanking
            }
          }
        `,
        variables: { username },
      };

      const response = await fetch(this.GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileQuery),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user profile");
      }

      const data = await response.json();

      if (!data.data?.matchedUser) {
        throw new Error("User not found");
      }

      const user = data.data.matchedUser;
      const contestData = data.data.userContestRanking;
      const submitStats = user.submitStats?.acSubmissionNum || [];
      const totalSubmitStats = user.submitStats?.totalSubmissionNum || [];

      // Parse submission stats
      const problemsSolved = {
        total: 0,
        easy: 0,
        medium: 0,
        hard: 0,
      };

      let totalAc = 0;
      let totalSubmissions = 0;

      submitStats.forEach((stat: any) => {
        const difficulty = stat.difficulty.toLowerCase();
        const count = stat.count;

        if (difficulty === "all") {
          problemsSolved.total = count;
          totalAc = count;
        } else if (difficulty === "easy") {
          problemsSolved.easy = count;
        } else if (difficulty === "medium") {
          problemsSolved.medium = count;
        } else if (difficulty === "hard") {
          problemsSolved.hard = count;
        }
      });

      totalSubmitStats.forEach((stat: any) => {
        if (stat.difficulty.toLowerCase() === "all") {
          totalSubmissions = stat.count;
        }
      });

      // Parse topic stats
      const topicStats: any[] = [];
      if (user.tagProblemCounts) {
        const allTopics = [
          ...(user.tagProblemCounts.advanced || []),
          ...(user.tagProblemCounts.intermediate || []),
          ...(user.tagProblemCounts.fundamental || []),
        ];

        // Combine and sort by problems solved
        const topicMap = new Map();
        allTopics.forEach((topic: any) => {
          const existing = topicMap.get(topic.tagName);
          if (existing) {
            existing.problemsSolved += topic.problemsSolved;
          } else {
            topicMap.set(topic.tagName, {
              topicName: topic.tagName,
              problemsSolved: topic.problemsSolved,
            });
          }
        });

        topicStats.push(
          ...Array.from(topicMap.values())
            .filter((t) => t.problemsSolved > 0)
            .sort((a, b) => b.problemsSolved - a.problemsSolved)
            .slice(0, 10),
        ); // Top 10 topics
      }

      // Parse language stats
      const languageStats = (user.languageProblemCount || [])
        .filter((lang: any) => lang.problemsSolved > 0)
        .sort((a: any, b: any) => b.problemsSolved - a.problemsSolved)
        .slice(0, 5); // Top 5 languages

      // Fetch recent submissions
      const recentSubmissions = await this.fetchRecentSubmissions(username);

      return {
        username: user.username,
        realName: user.profile?.realName,
        avatar: user.profile?.userAvatar,
        ranking: user.profile?.ranking,
        reputation: user.profile?.reputation,
        contestRating: contestData?.rating,
        contestRanking: contestData?.globalRanking,
        problemsSolved,
        recentSubmissions,
        topicStats,
        languageStats,
        submissionStats: {
          totalSubmissions,
          acSubmissions: totalAc,
          acceptanceRate:
            totalSubmissions > 0 ? (totalAc / totalSubmissions) * 100 : 0,
        },
      };
    } catch (error) {
      console.error(`Error fetching profile for ${username}:`, error);
      throw error;
    }
  }

  private static async fetchRecentSubmissions(
    username: string,
  ): Promise<RecentSubmission[]> {
    try {
      const submissionsQuery = {
        query: `
          query getRecentSubmissions($username: String!, $limit: Int!) {
            recentAcSubmissionList(username: $username, limit: $limit) {
              id
              title
              titleSlug
              timestamp
              statusDisplay
              lang
            }
          }
        `,
        variables: { username, limit: 10 },
      };

      const response = await fetch(this.GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionsQuery),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const submissions = data.data?.recentAcSubmissionList || [];

      return submissions.map((sub: any) => ({
        title: sub.title,
        titleSlug: sub.titleSlug,
        timestamp: parseInt(sub.timestamp) * 1000,
        statusDisplay: sub.statusDisplay,
        lang: sub.lang,
      }));
    } catch (error) {
      console.error(`Error fetching submissions for ${username}:`, error);
      return [];
    }
  }
}
