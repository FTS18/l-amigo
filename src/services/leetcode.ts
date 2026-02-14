import { FriendProfile, RecentSubmission } from "../types";
import { API_CONSTANTS, DATA_LIMITS } from "../constants";
import { CircuitBreaker } from "../utils/circuit-breaker";

/**
 * Represents a single accepted submission fetched from LeetCode's GraphQL API.
 * Timestamp is in **milliseconds** (converted from the API's seconds).
 */
export interface AcceptedSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: number; // ms
  lang: string;
  statusDisplay: string;
  runtimeBeats?: string;
  memoryBeats?: string;
}

export class LeetCodeService {
  private static readonly GQL = API_CONSTANTS.LEETCODE_GRAPHQL;
  private static circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000,
  });

  // ── Helpers ────────────────────────────────────────────────────────

  private static sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private static async getCsrfToken(): Promise<string | undefined> {
    try {
      const cookies = await chrome.cookies.getAll({ domain: ".leetcode.com" });
      return cookies.find((c) => c.name === "csrftoken")?.value;
    } catch {
      return undefined;
    }
  }

  private static buildHeaders(csrf?: string): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Referer: "https://leetcode.com",
    };
    if (csrf) h["X-CSRFToken"] = csrf;
    return h;
  }

  /**
   * Send a GraphQL request with retry + exponential back-off.
   * Handles 429 (rate-limit) and 403 (WAF) transparently.
   * Now public to allow github.ts to use the same retry/CSRF logic.
   */
  static async gql<T = any>(
    query: string,
    variables: Record<string, any> = {},
    retries = API_CONSTANTS.MAX_RETRIES,
  ): Promise<T> {
    const csrf = await this.getCsrfToken();
    const headers = this.buildHeaders(csrf);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(
          () => ctl.abort(),
          API_CONSTANTS.REQUEST_TIMEOUT,
        );

        const res = await fetch(this.GQL, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ query, variables }),
          signal: ctl.signal,
        });
        clearTimeout(timer);

        if (res.status === 429 || res.status === 403) {
          if (attempt < retries) {
            const wait = API_CONSTANTS.RETRY_DELAY_BASE * Math.pow(2, attempt);
            console.warn(
              `[LC] ${res.status} – retry in ${wait}ms (${attempt + 1}/${retries})`,
            );
            await this.sleep(wait);
            continue;
          }
          throw new Error(
            `LeetCode ${res.status} after ${retries + 1} attempts`,
          );
        }

        if (!res.ok) throw new Error(`LeetCode HTTP ${res.status}`);
        const json = await res.json();
        if (json.errors?.length) {
          console.warn("[LC] GraphQL errors:", json.errors);
        }
        return json.data as T;
      } catch (err) {
        if (attempt === retries) throw err;
        await this.sleep(API_CONSTANTS.RETRY_DELAY_BASE * Math.pow(2, attempt));
      }
    }
    throw new Error("Max retries exceeded");
  }

  // ── Paginated ALL accepted submissions ─────────────────────────────

  /**
   * Fetches accepted submissions the logged-in user has made.
   *
   * **Full mode** (no `knownIds`): pages through every submission.
   * **Incremental mode** (`knownIds` provided): stops early once it hits
   * 2 consecutive pages where every accepted submission is already known.
   * This makes auto-sync after solving a single problem very fast (~1-2 pages).
   *
   * @param onProgress optional callback reporting how many *new* found so far
   * @param knownIds   if provided, enables incremental mode
   */
  static async fetchAllAcceptedSubmissions(
    onProgress?: (fetched: number) => void,
    knownIds?: Set<string>,
  ): Promise<AcceptedSubmission[]> {
    const PAGE = 20;
    const SAFETY_CAP = 10000;
    const all: AcceptedSubmission[] = [];
    let offset = 0;
    let consecutiveKnownPages = 0;

    while (offset < SAFETY_CAP) {
      const data = await this.gql<{
        submissionList: {
          hasNext: boolean;
          submissions: Array<{
            id: string;
            title: string;
            titleSlug: string;
            timestamp: string;
            statusDisplay: string;
            lang: string;
          }>;
        };
      }>(
        `query ($offset: Int!, $limit: Int!) {
          submissionList(offset: $offset, limit: $limit) {
            hasNext
            submissions { id title titleSlug timestamp statusDisplay lang }
          }
        }`,
        { offset, limit: PAGE },
      );

      const list = data?.submissionList;
      const subs = list?.submissions ?? [];

      let newInPage = 0;
      for (const s of subs) {
        if (s.statusDisplay !== "Accepted") continue;
        // In incremental mode, skip already-known submissions
        if (knownIds?.has(String(s.id))) continue;
        newInPage++;
        all.push({
          id: String(s.id),
          title: s.title,
          titleSlug: s.titleSlug,
          timestamp: Number(s.timestamp) * 1000,
          lang: s.lang,
          statusDisplay: "Accepted",
        });
      }

      onProgress?.(all.length);
      console.log(
        `[LC] Fetched ${all.length} new accepted (offset ${offset}, ${newInPage} new in page)`,
      );

      // Incremental: stop after 2 consecutive pages with zero new accepted
      if (knownIds) {
        if (newInPage === 0) {
          consecutiveKnownPages++;
          if (consecutiveKnownPages >= 2) {
            console.log(
              "[LC] Incremental: 2 all-known pages in a row → stopping early",
            );
            break;
          }
        } else {
          consecutiveKnownPages = 0;
        }
      }

      if (!list?.hasNext || subs.length === 0) break;
      offset += PAGE;

      // Throttle between pages
      const jitter = Math.floor(
        Math.random() * API_CONSTANTS.SUBMISSION_FETCH_JITTER_MS,
      );
      await this.sleep(API_CONSTANTS.SUBMISSION_FETCH_DELAY_MS + jitter);
    }

    console.log(`[LC] Total new accepted submissions: ${all.length}`);
    return all;
  }

  // ── Fetch code by submission ID ────────────────────────────────────

  static async fetchSubmissionCode(
    submissionId: string,
  ): Promise<string | null> {
    try {
      const data = await this.gql<{
        submissionDetails: { code: string; lang: { name: string } } | null;
      }>(
        `query submissionDetails($submissionId: Int!) {
          submissionDetails(submissionId: $submissionId) {
            code
            lang { name }
          }
        }`,
        { submissionId: parseInt(submissionId, 10) },
      );
      return data?.submissionDetails?.code ?? null;
    } catch (err) {
      console.error(`[LC] Code fetch failed for ${submissionId}:`, err);
      return null;
    }
  }

  // ── User profile (used for friend tracking) ────────────────────────

  static async fetchUserProfile(username: string): Promise<FriendProfile> {
    const data = await this.gql<{
      matchedUser: any;
      userContestRanking: any;
    }>(
      `query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          submissionCalendar
          profile { realName userAvatar ranking reputation }
          submitStats {
            acSubmissionNum { difficulty count submissions }
            totalSubmissionNum { difficulty count submissions }
          }
          tagProblemCounts {
            advanced    { tagName problemsSolved }
            intermediate{ tagName problemsSolved }
            fundamental { tagName problemsSolved }
          }
          languageProblemCount { languageName problemsSolved }
        }
        userContestRanking(username: $username) { rating globalRanking }
      }`,
      { username },
    );

    if (!data?.matchedUser) throw new Error("User not found");

    const user = data.matchedUser;
    const contest = data.userContestRanking;
    const acStats = user.submitStats?.acSubmissionNum || [];
    const totalStats = user.submitStats?.totalSubmissionNum || [];

    const solved = { total: 0, easy: 0, medium: 0, hard: 0 };
    let totalAc = 0;
    let totalSub = 0;

    for (const s of acStats) {
      const d = s.difficulty.toLowerCase();
      if (d === "all") {
        solved.total = s.count;
        totalAc = s.count;
      } else if (d === "easy") solved.easy = s.count;
      else if (d === "medium") solved.medium = s.count;
      else if (d === "hard") solved.hard = s.count;
    }
    for (const s of totalStats) {
      if (s.difficulty.toLowerCase() === "all") totalSub = s.count;
    }

    // Topic stats
    const topicMap = new Map<string, number>();
    if (user.tagProblemCounts) {
      for (const bucket of [
        user.tagProblemCounts.advanced,
        user.tagProblemCounts.intermediate,
        user.tagProblemCounts.fundamental,
      ]) {
        for (const t of bucket || []) {
          topicMap.set(
            t.tagName,
            (topicMap.get(t.tagName) || 0) + t.problemsSolved,
          );
        }
      }
    }
    const topicStats = Array.from(topicMap.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([topicName, problemsSolved]) => ({ topicName, problemsSolved }));

    // Language stats – return ALL languages, sorted by count
    const languageStats = (user.languageProblemCount || [])
      .filter((l: any) => l.problemsSolved > 0)
      .sort((a: any, b: any) => b.problemsSolved - a.problemsSolved);

    // Parse submissionCalendar – LeetCode returns a JSON string: {"1700000000": 3, ...}
    let submissionCalendar: Record<string, number> | undefined;
    try {
      const raw = user.submissionCalendar;
      if (raw && typeof raw === "string") {
        submissionCalendar = JSON.parse(raw);
      } else if (raw && typeof raw === "object") {
        submissionCalendar = raw;
      }
    } catch {
      submissionCalendar = undefined;
    }

    // Recent AC (for friend cards, max ~20 from LeetCode)
    const recentSubmissions = await this.fetchRecentAc(username);

    return {
      username: user.username,
      realName: user.profile?.realName,
      avatar: user.profile?.userAvatar,
      ranking: user.profile?.ranking,
      reputation: user.profile?.reputation,
      contestRating: contest?.rating,
      contestRanking: contest?.globalRanking,
      problemsSolved: solved,
      recentSubmissions,
      submissionCalendar,
      topicStats,
      languageStats,
      submissionStats: {
        totalSubmissions: totalSub,
        acSubmissions: totalAc,
        acceptanceRate: totalSub > 0 ? (totalAc / totalSub) * 100 : 0,
      },
    };
  }

  /** Quick fetch of recent AC submissions (max ~20) – used only for friend cards. */
  private static async fetchRecentAc(
    username: string,
  ): Promise<RecentSubmission[]> {
    try {
      const data = await this.gql<{
        recentAcSubmissionList: Array<{
          id: string;
          title: string;
          titleSlug: string;
          timestamp: string;
          statusDisplay: string;
          lang: string;
        }>;
      }>(
        `query getRecentAc($username: String!, $limit: Int!) {
          recentAcSubmissionList(username: $username, limit: $limit) {
            id title titleSlug timestamp statusDisplay lang
          }
        }`,
        { username, limit: DATA_LIMITS.MAX_RECENT_SUBMISSIONS },
      );
      return (data?.recentAcSubmissionList || []).map((s) => ({
        title: s.title,
        titleSlug: s.titleSlug,
        timestamp: parseInt(s.timestamp, 10) * 1000,
        statusDisplay: s.statusDisplay,
        lang: s.lang,
        submissionId: s.id,
      }));
    } catch {
      return [];
    }
  }
}
