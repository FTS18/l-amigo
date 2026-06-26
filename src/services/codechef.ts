import { API_CONSTANTS } from "../constants";
import { FriendProfile, RecentSubmission } from "../types";
import { CircuitBreaker } from "../utils/circuit-breaker";

export class CodeChefService {
  private static circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000,
  });

  static async verifyHandle(handle: string): Promise<boolean> {
    return this.circuitBreaker.execute(async () => {
      const url = `https://www.codechef.com/users/${handle}`;
      const ctl = new AbortController();
      const timer = setTimeout(
        () => ctl.abort(),
        API_CONSTANTS.REQUEST_TIMEOUT || 10000,
      );
      try {
        const res = await fetch(url, { method: 'HEAD', signal: ctl.signal });
        if (!res.ok) {
          throw new Error("CodeChef user not found");
        }
        return true;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  static async fetchUserProfile(handle: string): Promise<FriendProfile> {
    return this.circuitBreaker.execute(async () => {
      const url = `https://www.codechef.com/users/${handle}`;
      const ctl = new AbortController();
      const timer = setTimeout(
        () => ctl.abort(),
        API_CONSTANTS.REQUEST_TIMEOUT || 10000,
      );

      try {
        const res = await fetch(url, { signal: ctl.signal });
        if (!res.ok) {
          throw new Error(`CodeChef HTTP ${res.status}`);
        }

        const html = await res.text();

        // Extract Drupal.settings
        const drupalMatch = html.match(/jQuery\.extend\(Drupal\.settings,\s*(\{.*?\})\);/s);
        let contestData: any = {};
        if (drupalMatch) {
          try {
            contestData = JSON.parse(drupalMatch[1]);
          } catch (e) {
            console.error("Failed to parse CodeChef Drupal settings", e);
          }
        }

        const allContests = contestData?.date_versus_rating?.all || [];
        const latestContest = allContests.length > 0 ? allContests[allContests.length - 1] : null;

        // Name
        const nameMatch = html.match(/<h1 class="h2-style">(.*?)<\/h1>/);
        const realName = nameMatch ? nameMatch[1].trim() : undefined;

        // Avatar
        const avatarMatch = html.match(/<img class='profileImage' src='(.*?)'/);
        const avatar = avatarMatch ? avatarMatch[1] : undefined;

        // Stars
        const starMatch = html.match(/<span[^>]*class='rating'[^>]*>(.*?)\&\#9733;<\/span>/);
        const stars = starMatch ? parseInt(starMatch[1], 10) : undefined;

        // Rating history
        const ratingHistory = allContests.map((c: any) => ({
          contestName: c.name,
          rating: parseInt(c.rating || "0", 10),
          ranking: parseInt(c.rank || "0", 10),
          timestamp: new Date(c.end_date).getTime(),
          contestId: c.code,
        }));

        let maxRating = 0;
        ratingHistory.forEach((h: any) => {
          if (h.rating > maxRating) maxRating = h.rating;
        });

        return {
          username: handle,
          platform: "codechef",
          profileUrl: `https://www.codechef.com/users/${handle}`,
          realName,
          avatar,
          contestRating: latestContest ? parseInt(latestContest.rating || "0", 10) : undefined,
          contestRanking: latestContest ? parseInt(latestContest.rank || "0", 10) : undefined,
          contributionPoints: maxRating, // Reusing this for Max Rating to show in UI
          contestCount: allContests.length,
          problemsSolved: {
            total: 0,
            easy: 0,
            medium: 0,
            hard: 0,
          },
          recentSubmissions: [],
          ratingHistory,
          submissionStats: {
            totalSubmissions: 0,
            acSubmissions: 0,
            acceptanceRate: 0,
          },
        };
      } finally {
        clearTimeout(timer);
      }
    });
  }

  static async getUpcomingContests(): Promise<any[]> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    try {
      const res = await fetch("https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=premium", {
        signal: ctl.signal
      });
      const data = await res.json();
      
      const futureContests = data.future_contests || [];
      return futureContests.map((c: any) => ({
        id: c.contest_code,
        name: c.contest_name,
        startTimeSeconds: Math.floor(new Date(c.contest_start_date).getTime() / 1000),
        durationSeconds: c.contest_duration * 60,
        platform: 'codechef'
      }));
    } catch (err) {
      console.warn('Failed to fetch CodeChef contests:', err);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  static async fetchSubmissionCode(submissionId: string | number): Promise<string | null> {
    try {
      const url = `https://www.codechef.com/viewplaintext/${submissionId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      
      const html = await res.text();
      const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      
      if (match && match[1]) {
        let code = match[1];
        code = code.replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&amp;/g, '&')
                   .replace(/&quot;/g, '"')
                   .replace(/&#39;/g, "'")
                   .replace(/&#039;/g, "'");
        return code;
      }
      return null;
    } catch (e) {
      console.warn(`Failed to fetch CodeChef submission code for ${submissionId}`, e);
      return null;
    }
  }
}
