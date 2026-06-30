import { API_CONSTANTS } from "../constants";
import { FriendProfile, RecentSubmission } from "../types";
import { CircuitBreaker } from "../utils/circuit-breaker";
import { fetchWithTimeout } from "../utils/network";

export class CodeChefService {
  private static circuitBreaker = new CircuitBreaker("codechef", {
    failureThreshold: 5,
    resetTimeout: 60000,
  });

  static async verifyHandle(handle: string): Promise<boolean> {
    return this.circuitBreaker.execute(async () => {
      const url = `https://www.codechef.com/users/${handle}`;
      try {
        const res = await fetchWithTimeout(url, { method: 'HEAD', timeout: API_CONSTANTS.REQUEST_TIMEOUT || 10000 });
        if (!res.ok) {
          throw new Error("CodeChef user not found");
        }
        return true;
      } catch (err: any) {
        throw err;
      }
    });
  }

  static async fetchUserProfile(handle: string): Promise<FriendProfile> {
    return this.circuitBreaker.execute(async () => {
      const url = `https://www.codechef.com/users/${handle}`;
      const res = await fetchWithTimeout(url, { timeout: API_CONSTANTS.REQUEST_TIMEOUT || 10000 });
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
    });
  }

  static async getUpcomingContests(): Promise<any[]> {
    try {
      const res = await fetchWithTimeout("https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=premium", {
        timeout: 10000
      });
      const data = await res.json();
      
      const futureContests = data.future_contests || [];
      const presentContests = data.present_contests || [];
      const allContests = [...presentContests, ...futureContests];
      return allContests.map((c: any) => ({
        id: c.contest_code,
        name: c.contest_name,
        startTimeSeconds: Math.floor(new Date(c.contest_start_date).getTime() / 1000),
        durationSeconds: c.contest_duration * 60,
        platform: 'codechef'
      }));
    } catch (err) {
      console.warn('Failed to fetch CodeChef contests:', err);
      return [];
    }
  }

  /**
   * Fetch all accepted CodeChef submissions for the given handle.
   * Works when the user is logged into CodeChef in the browser (credentials: 'include').
   * Paginates through all pages until no more results.
   */
  static async getAcceptedSubmissions(handle: string): Promise<RecentSubmission[]> {
    const results: RecentSubmission[] = [];
    const seen = new Set<string>();
    const PAGE_SIZE = 20;
    const MAX_PAGES = 50; // up to 1000 AC submissions

    for (let page = 0; page < MAX_PAGES; page++) {
      try {
        let res: Response;
        try {
          res = await fetchWithTimeout(
            `https://www.codechef.com/api/submissions?username=${encodeURIComponent(handle)}&page=${page}&language=&status=AC`,
            { credentials: 'include', timeout: 10000 }
          );
        } catch (e) {
          break;
        }

        if (!res.ok) break; // 403 = not logged in, or no more pages

        const json = await res.json();
        if (json.status !== 'OK' && json.status !== 'success') break;

        // The API can return results in a couple of shapes
        const content: any[] =
          json?.data?.content ||
          json?.result?.data?.content ||
          json?.submissions ||
          [];

        if (content.length === 0) break; // last page

        for (const s of content) {
          const code: string = s.problem_code || s.problemCode || '';
          if (!code || seen.has(code)) continue; // de-dupe by problem slug
          seen.add(code);

          // Timestamp: CodeChef returns ISO strings or unix seconds
          let ts = Date.now();
          if (s.time) ts = new Date(s.time).getTime();
          else if (s.date) ts = new Date(s.date).getTime();
          else if (s.end_time) ts = new Date(s.end_time).getTime();

          const langRaw: string = s.language_code || s.language || 'Unknown';
          // Normalise language code → human label
          const langMap: Record<string, string> = {
            CPP17: 'C++17', CPP14: 'C++14', CPP: 'C++',
            C: 'C', JAVA: 'Java', PYT: 'Python 3', PYTH3: 'Python 3',
            PYTH: 'Python 2', JS: 'JavaScript',
          };
          const lang = langMap[langRaw.toUpperCase()] ?? langRaw;

          results.push({
            title: s.problem_name || code,
            titleSlug: code.toLowerCase(),
            timestamp: isNaN(ts) ? Date.now() : ts,
            statusDisplay: 'Accepted',
            lang,
            platform: 'codechef' as any,
            submissionId: s.submission_id || s.submissionId || s.id,
          });
        }

        // If fewer items than a full page, we're done
        if (content.length < PAGE_SIZE) break;
      } catch (err) {
        console.warn(`[CC] Failed to fetch page ${page}:`, err);
        break;
      }
    }

    console.log(`[CC] Fetched ${results.length} accepted submissions for ${handle}`);
    return results;
  }

  static async fetchSubmissionCode(submissionId: string | number): Promise<string | null> {
    try {
      const url = `https://www.codechef.com/viewplaintext/${submissionId}`;
      const res = await fetchWithTimeout(url, { timeout: 15000 });
      if (!res.ok) return null;
      
      const html = await res.text();
      const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      
      if (match && match[1]) {
        const code = match[1];
        if (typeof DOMParser !== 'undefined') {
          const doc = new DOMParser().parseFromString(code, 'text/html');
          return doc.documentElement.textContent || doc.body.textContent || code;
        }
        return code.replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&amp;/g, '&')
                   .replace(/&quot;/g, '"')
                   .replace(/&#39;/g, "'")
                   .replace(/&#039;/g, "'");
      }
      return null;
    } catch (e) {
      console.warn(`Failed to fetch CodeChef submission code for ${submissionId}`, e);
      return null;
    }
  }
}

