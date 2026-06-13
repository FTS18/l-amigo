import { API_CONSTANTS, DATA_LIMITS } from "../constants";
import { FriendProfile, RecentSubmission, TopicStat, LanguageStat } from "../types";
import { CircuitBreaker } from "../utils/circuit-breaker";

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

export class CodeforcesService {
  private static readonly API = API_CONSTANTS.CODEFORCES_API;
  private static circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000,
  });

  private static contestDivCache: Map<number, number> | null = null;
  private static lastCacheFetch = 0;
  private static readonly CACHE_TTL = 3600000; // 1 hour

  private static requestQueue = Promise.resolve();

  private static async request<T>(endpoint: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue = this.requestQueue.then(async () => {
        try {
          const result = await this.executeRequest<T>(endpoint);
          // Wait 1000ms between requests to respect Codeforces rate limits
          await new Promise(r => setTimeout(r, 1000));
          resolve(result);
        } catch (err) {
          // Still wait on error to avoid spamming
          await new Promise(r => setTimeout(r, 1000));
          reject(err);
        }
      });
    });
  }

  private static async executeRequest<T>(endpoint: string): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      const url = `${this.API}/${endpoint}`;
      const ctl = new AbortController();
      const timer = setTimeout(
        () => ctl.abort(),
        API_CONSTANTS.REQUEST_TIMEOUT,
      );

      try {
        const res = await fetch(url, { signal: ctl.signal });
        if (!res.ok) {
          throw new Error(`Codeforces HTTP ${res.status}`);
        }

        const body = (await res.json()) as CodeforcesApiResponse<T>;
        if (body.status !== "OK" || body.result === undefined) {
          throw new Error(body.comment || "Codeforces API error");
        }
        return body.result;
      } finally {
        clearTimeout(timer);
      }
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


    // Map recent submissions for the profile (limit to 30)
    const recentSubmissions = await this.getRecentSubmissions(handle);

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
        latestRank: latestContest?.rank,
      },
    };
  }

  static async getRecentSubmissions(handle: string, limit: number = 50): Promise<RecentSubmission[]> {
    const submissions = await this.request<CodeforcesSubmission[]>(
      `user.status?handle=${encodeURIComponent(handle)}&from=1&count=${limit}`,
    );

    return submissions
      .map((s) => ({
        title: s.problem.name,
        titleSlug: `${s.problem.contestId || ""}/${s.problem.index || ""}`,
        timestamp: s.creationTimeSeconds * 1000,
        statusDisplay: s.verdict === "OK" ? "Accepted" : (s.verdict || "Rejected"),
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

  static async fetchSubmissionCode(contestId: number | string, submissionId: string | number): Promise<string | null> {
    try {
      const url = `https://codeforces.com/contest/${contestId}/submission/${submissionId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      
      const html = await res.text();
      const match = html.match(/<pre id="program-source-text"[^>]*>([\s\S]*?)<\/pre>/i);
      
      if (match && match[1]) {
        let code = match[1];
        code = code.replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&amp;/g, '&')
                   .replace(/&quot;/g, '"')
                   .replace(/&#39;/g, "'");
        return code;
      }
      return null;
    } catch (e) {
      console.warn(`Failed to fetch Codeforces submission code for ${submissionId}`, e);
      return null;
    }
  }

  static async getUpcomingContests(): Promise<any[]> {
    try {
      const data = await this.request<any[]>('contest.list?gym=false');
      return data
        .filter(c => c.phase === 'BEFORE')
        .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
        .slice(0, 3); // next 3 contests
    } catch (error) {
      console.error('Failed to fetch upcoming contests:', error);
      return [];
    }
  }
}
