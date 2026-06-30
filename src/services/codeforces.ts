import { API_CONSTANTS, DATA_LIMITS } from "../constants";
import { FriendProfile, RecentSubmission, TopicStat, LanguageStat } from "../types";
import { CircuitBreaker } from "../utils/circuit-breaker";
import { fetchWithTimeout } from '../utils/network';
import { friendAddRateLimiter } from "../utils/rate-limiter";

interface CodeforcesApiResponse<T> {
  status: "OK" | "FAILED";
  result?: T;
  comment?: string;
}

interface CodeforcesUser {
  handle: string;
  firstName?: string;
  lastName?: string;
  titlePhoto?: string;
  rank?: string;
  rating?: number;
  maxRating?: number;
  maxRank?: string;
}

interface CodeforcesSubmission {
  id: number;
  creationTimeSeconds: number;
  programmingLanguage: string;
  verdict?: string;
  problem: {
    name: string;
    contestId?: number;
    index?: string;
    tags?: string[];
    rating?: number;
  };
}

interface CodeforcesRatingChange {
  contestId: number;
  contestName: string;
  rank: number;
  oldRating: number;
  newRating: number;
  ratingUpdateTimeSeconds: number;
}

interface CodeforcesContest {
  id: number;
  name: string;
  phase: string;
  startTimeSeconds: number;
  durationSeconds: number;
  type: string;
  platform?: string; // populated by callers when merging multi-platform contest lists
}

export class CodeforcesService {
  private static readonly API = API_CONSTANTS.CODEFORCES_API;
  private static circuitBreaker = new CircuitBreaker("codeforces", {
    failureThreshold: 5,
    resetTimeout: 60000,
  });

  private static contestDivCache: Map<number, number> | null = null;
  private static lastCacheFetch = 0;
  private static readonly CACHE_TTL = 3600000; // 1 hour

  // ── Concurrency-limited request dispatcher ─────────────────────────
  // Max 2 requests in-flight simultaneously, ≥500ms between dispatches.
  // This gives ~2 req/s throughput while staying within Codeforces limits.
  private static readonly MAX_CONCURRENT = 2;
  private static readonly DISPATCH_GAP_MS = 500;
  private static activeCount = 0;
  private static lastDispatch = 0;
  private static pendingQueue: Array<() => void> = [];

  private static _scheduleNext(): void {
    if (this.pendingQueue.length === 0 || this.activeCount >= this.MAX_CONCURRENT) return;
    const wait = Math.max(0, this.DISPATCH_GAP_MS - (Date.now() - this.lastDispatch));
    setTimeout(() => {
      if (this.pendingQueue.length === 0 || this.activeCount >= this.MAX_CONCURRENT) return;
      const next = this.pendingQueue.shift()!;
      this.activeCount++;
      this.lastDispatch = Date.now();
      next();
      // Schedule the next one after this dispatch (handles queue draining)
      this._scheduleNext();
    }, wait);
  }

  private static async request<T>(endpoint: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pendingQueue.push(async () => {
        try {
          const result = await this.executeRequest<T>(endpoint);
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.activeCount--;
          // Drain the queue as each slot becomes free
          this._scheduleNext();
        }
      });
      this._scheduleNext();
    });
  }

  /**
   * Maps raw CodeforcesSubmission objects to the shared RecentSubmission shape.
   * Extracted so fetchUserProfile can reuse already-fetched data without a 2nd API call.
   */
  private static _mapToRecentSubmissions(subs: CodeforcesSubmission[]): RecentSubmission[] {
    return subs.map((s) => ({
      title: s.problem.name,
      titleSlug: `${s.problem.contestId || ''}/${s.problem.index || ''}`,
      timestamp: s.creationTimeSeconds * 1000,
      statusDisplay: s.verdict === 'OK' ? 'Accepted' : (s.verdict || 'Rejected'),
      lang: s.programmingLanguage,
      submissionId: String(s.id),
      platform: 'codeforces' as const,
      rating: s.problem.rating,
      difficulty: (() => {
        if (s.problem.rating) {
          if (s.problem.rating < 1300) return 'Easy';
          if (s.problem.rating < 1800) return 'Medium';
          return 'Hard';
        }
        const idx = s.problem.index?.toUpperCase() || '';
        if (['A', 'B', 'A1', 'A2', 'B1', 'B2'].includes(idx)) return 'Easy';
        if (['C', 'D', 'C1', 'C2'].includes(idx)) return 'Medium';
        if (idx >= 'E') return 'Hard';
        const name = s.problem.name.toLowerCase();
        if (name.includes('easy')) return 'Easy';
        if (name.includes('hard')) return 'Hard';
        return 'Unknown';
      })()
    }));
  }

  private static async executeRequest<T>(endpoint: string, retries = 2): Promise<T> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const s = await chrome.storage.local.get("codeforces_cooldown");
        if (s.codeforces_cooldown && s.codeforces_cooldown > Date.now()) {
          const wait = s.codeforces_cooldown - Date.now();
          console.warn(`[CF] Cooldown active. Delaying execution by ${wait}ms.`);
          await new Promise(r => setTimeout(r, wait));
        }
      } catch (e) { /* ignore */ }
    }

    return this.circuitBreaker.execute(async () => {
      const url = `${this.API}/${endpoint}`;
      
      for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
          const res = await fetchWithTimeout(url, {
            timeout: 45000,
          });
          if (res.status === 429 || res.status === 403) {
            const cooldownTime = Date.now() + (res.status === 429 ? 60000 : 30000);
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              await chrome.storage.local.set({ codeforces_cooldown: cooldownTime });
            }
          }
          if (!res.ok) {
            throw new Error(`Codeforces HTTP ${res.status}`);
          }

          const body = (await res.json()) as CodeforcesApiResponse<T>;
          if (body.status !== "OK" || body.result === undefined) {
            throw new Error(body.comment || "Codeforces API error");
          }
          return body.result;
        } catch (err: any) {
          if (attempt <= retries) {
            console.warn(`CF API attempt ${attempt} failed for ${endpoint}, retrying...`, err);
            await new Promise(r => setTimeout(r, 2000 * attempt));
            continue;
          }
          throw err;
        }
      }
      throw new Error("Codeforces API failed after retries");
    });
  }

  private static async getContestDivMap(): Promise<Map<number, number>> {
    const now = Date.now();
    if (this.contestDivCache && (now - this.lastCacheFetch < this.CACHE_TTL)) {
      return this.contestDivCache;
    }

    try {
      const response = await this.request<any[]>("contest.list?gym=false");
      const divMap = new Map<number, number>();
      for (const c of response) {
        const name = (c.name || '').toLowerCase();
        if (name.includes('div. 1') || name.includes('div 1') || name.includes('global') || name.includes('combined') || name.includes('hello') || name.includes('goodbye')) divMap.set(c.id, 1);
        else if (name.includes('div. 2') || name.includes('div 2') || name.includes('educational')) divMap.set(c.id, 2);
        else if (name.includes('div. 3') || name.includes('div 3')) divMap.set(c.id, 3);
        else if (name.includes('div. 4') || name.includes('div 4')) divMap.set(c.id, 4);
      }
      this.contestDivCache = divMap;
      this.lastCacheFetch = now;
      return divMap;
    } catch (err) {
      console.error("Failed to fetch contest list", err);
      return this.contestDivCache || new Map();
    }
  }

  static async verifyHandle(handle: string): Promise<boolean> {
    const users = await this.request<CodeforcesUser[]>(
      `user.info?handles=${encodeURIComponent(handle)}`,
    );
    if (!users || users.length === 0) {
      throw new Error("Codeforces user not found");
    }
    return true;
  }

  static async fetchUserProfile(handle: string): Promise<FriendProfile> {
    const [users, submissions, contests] = await Promise.all([
      this.request<CodeforcesUser[]>(
        `user.info?handles=${encodeURIComponent(handle)}`,
      ),
      this.request<CodeforcesSubmission[]>(
        `user.status?handle=${encodeURIComponent(handle)}&from=1&count=2000`,
      ),
      this.request<CodeforcesRatingChange[]>(
        `user.rating?handle=${encodeURIComponent(handle)}`,
      ),
    ]);

    const user = users[0];
    if (!user) {
      throw new Error("Codeforces user not found");
    }

    const accepted = submissions.filter((s) => s.verdict === "OK");
    
    const verdictCounts: Record<string, number> = {};
    for (const sub of submissions) {
      if (sub.verdict) {
        verdictCounts[sub.verdict] = (verdictCounts[sub.verdict] || 0) + 1;
      }
    }

    let bestGlobalRank: number | undefined = undefined;
    for (const c of contests) {
      if (c.rank && (!bestGlobalRank || c.rank < bestGlobalRank)) {
        bestGlobalRank = c.rank;
      }
    }

    // Calculate accurate difficulty counts and divisions
    const uniqueSolved = new Set<string>();
    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;
    
    let div1 = 0;
    let div2 = 0;
    let div3 = 0;
    let div4 = 0;

    const contestIdToDiv = await this.getContestDivMap();

    for (const sub of accepted) {
      const problemId = `${sub.problem.contestId}-${sub.problem.index}`;
      if (uniqueSolved.has(problemId)) continue;
      uniqueSolved.add(problemId);

      // Heuristic for difficulty
      const rating = sub.problem.rating || 0;
      const index = sub.problem.index?.toUpperCase() || '';
      
      if (rating > 0) {
        if (rating < 1200) easyCount++;
        else if (rating < 1900) mediumCount++;
        else hardCount++;
      } else {
        if (['A', 'B'].some(x => index.startsWith(x))) easyCount++;
        else if (['C', 'D'].some(x => index.startsWith(x))) mediumCount++;
        else if (index >= 'E') hardCount++;
        else mediumCount++;
      }

      // Division counting based on contest participation map
      const cId = sub.problem.contestId;
      if (cId && contestIdToDiv.has(cId)) {
        const div = contestIdToDiv.get(cId);
        if (div === 1) div1++;
        else if (div === 2) div2++;
        else if (div === 3) div3++;
        else if (div === 4) div4++;
      }
    }


    const topicMap = new Map<string, number>();
    const langMap = new Map<string, number>();

    for (const sub of accepted) {

      const tags = sub.problem.tags || [];
      for (const tag of tags) {
        topicMap.set(tag, (topicMap.get(tag) || 0) + 1);
      }

      langMap.set(
        sub.programmingLanguage,
        (langMap.get(sub.programmingLanguage) || 0) + 1,
      );
    }


    // Map recent submissions from the already-fetched submissions array.
    // No 2nd API call needed — slice the first 30 from what we have.
    const recentSubmissions = this._mapToRecentSubmissions(submissions.slice(0, 50));

    const topicStats: TopicStat[] = Array.from(topicMap.entries())
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .map(([topicName, problemsSolved]): TopicStat => ({ topicName, problemsSolved }));

    const languageStats: LanguageStat[] = Array.from(langMap.entries())
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .map(([languageName, problemsSolved]): LanguageStat => ({
        languageName,
        problemsSolved,
      }));




    const latestContest =
      contests.length > 0 ? contests[contests.length - 1] : undefined;


    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400000;
    const dailyPulse = accepted.filter((s) => s.creationTimeSeconds * 1000 >= sevenDaysAgo).length;
    const ratingDelta = latestContest ? latestContest.newRating - latestContest.oldRating : 0;

    return {
      username: handle,
      platform: "codeforces",
      profileUrl: `https://codeforces.com/profile/${handle}`,
      realName: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
      avatar: user.titlePhoto,
      contestRating: user.rating,
      contestRanking: user.rank ? 0 : undefined,
      bestGlobalRank,
      contributionPoints: user.maxRating,
      problemsSolved: {
        total: uniqueSolved.size,
        easy: easyCount,
        medium: mediumCount,
        hard: hardCount,
      },
      contestCount: contests.length,
      recentSubmissions: recentSubmissions.slice(0, 30),
      topicStats,
      languageStats,
      ratingHistory: contests.map(c => ({
        contestName: c.contestName,
        rating: c.newRating,
        ranking: c.rank,
        timestamp: c.ratingUpdateTimeSeconds * 1000,
        contestId: c.contestId,
        delta: c.newRating - c.oldRating,
      })),
      submissionStats: {
        totalSubmissions: submissions.length,
        acSubmissions: accepted.length,
        acceptanceRate:
          submissions.length > 0
            ? (accepted.length / submissions.length) * 100
            : 0,
      },
      codeforcesStats: {
        rankLabel: user.rank || 'unrated',
        ratingDelta: latestContest ? latestContest.newRating - latestContest.oldRating : 0,
        dailyPulse,
        divisionCounts: { div1, div2, div3, div4 },
        globalContests: contests.length,
        maxRating: user.maxRating || 0,
        latestRank: latestContest ? latestContest.rank : undefined,
        verdictCounts,
      },
    };
  }

  static async getRecentSubmissions(handle: string, limit: number = 50): Promise<RecentSubmission[]> {
    const submissions = await this.request<CodeforcesSubmission[]>(
      `user.status?handle=${encodeURIComponent(handle)}&from=1&count=${limit}`,
    );
    return this._mapToRecentSubmissions(submissions);
  }

  static async fetchSubmissionCode(contestId: number | string, submissionId: string | number): Promise<string | null> {
    const urls = [
      `https://codeforces.com/contest/${contestId}/submission/${submissionId}`,
      `https://codeforces.com/problemset/submission/${contestId}/${submissionId}`,
      `https://codeforces.com/gym/${contestId}/submission/${submissionId}`,
    ];

    /**
     * Use DOMParser to reliably extract code — no regex needed.
     * Handles encoded HTML entities and nested tags correctly.
     */
    const extractCode = (html: string): string | null => {
      try {
        if (typeof DOMParser !== 'undefined') {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const candidates = [
            doc.querySelector('#program-source-text'),
            doc.querySelector('[class*="source-code"]'),
            doc.querySelector('textarea[name="source"]'),
          ];
          for (const el of candidates) {
            const code = el?.textContent?.trim();
            if (code && code.length > 10) return code;
          }
        }
      } catch {
        // DOMParser unavailable in this context
      }
      
      // Fallback for Service Workers where DOMParser is unavailable!
      const regexes = [
        /<pre[^>]*id="program-source-text"[^>]*>(.*?)<\/pre>/s,
        /<pre[^>]*class="[^"]*source-code[^"]*"[^>]*>(.*?)<\/pre>/s,
        /<textarea[^>]*name="source"[^>]*>(.*?)<\/textarea>/s,
        /<pre[^>]*>(.*?)<\/pre>/s
      ];
      for (const regex of regexes) {
        const match = regex.exec(html);
        if (match && match[1]) {
          const code = match[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
          if (code.length > 10) return code;
        }
      }
      return null;
    };

    for (const url of urls) {
      try {
        const res = await fetchWithTimeout(url, {
          credentials: 'include',
          headers: {
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        
        if (res.status === 429 || res.status === 403 || res.status === 503) {
          console.warn(`[CF] Rate limit/Cloudflare hit (${res.status}) for ${url}. Waiting 8 seconds before retry...`);
          await new Promise(r => setTimeout(r, 8000));
          const retryRes = await fetchWithTimeout(url, {
            credentials: 'include',
            headers: {
              'Accept': 'text/html,application/xhtml+xml',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          if (retryRes.status === 403) {
            console.warn(`[CF] Permanent Forbidden (403) for ${url}. Treating as private group contest.`);
            return "// Codeforces Private Group Submission\n// Code is not publicly accessible.";
          }
          if (retryRes.ok) {
            const retryHtml = await retryRes.text();
            const retryCode = extractCode(retryHtml);
            if (retryCode) return retryCode;
          }
          continue;
        }

        if (!res.ok) continue;
        const html = await res.text();
        
        // Handle Cloudflare challenge pages with backoff retry
        if (html.includes('Just a moment...') || html.includes('cf-mitigated')) {
          console.warn(`[CF] Cloudflare challenge hit for ${url}. Waiting 8 seconds before retry...`);
          await new Promise(r => setTimeout(r, 8000));
          const retryRes = await fetchWithTimeout(url, {
            credentials: 'include',
            headers: {
              'Accept': 'text/html,application/xhtml+xml',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          if (retryRes.ok) {
            const retryHtml = await retryRes.text();
            const retryCode = extractCode(retryHtml);
            if (retryCode) return retryCode;
          }
          continue;
        }
        const code = extractCode(html);
        if (code) return code;
      } catch (e) {
        console.warn(`[CF] fetchSubmissionCode failed for ${url}:`, e);
      }
    }
    return null;
  }

  static async getUpcomingContests(): Promise<CodeforcesContest[]> {
    try {
      const data = await this.request<CodeforcesContest[]>('contest.list?gym=false');
      return data
        .filter(c => c.phase === 'BEFORE' || c.phase === 'CODING')
        .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    } catch (error) {
      console.error('Failed to fetch upcoming contests:', error);
      return [];
    }
  }
}
