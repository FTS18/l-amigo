import { AcceptedSubmission, LeetCodeService } from "./leetcode";
import { CodeforcesService } from "./codeforces";
import { CodeChefService } from "./codechef";
import { API_CONSTANTS } from "../constants";

export interface GitHubSyncConfig {
  token: string;
  repoName?: string;
  lastSync?: number;
}

/**
 * Handles all GitHub interactions: repo management, file sync,
 * and deduplication via `synced_submissions` in chrome.storage.local.
 */
export class GitHubSyncService {
  private static readonly API = "https://api.github.com";
  private static readonly CFG_KEY = "github_sync_config";
  private static readonly SYNCED_KEY = "synced_submissions";

  // OAuth Constants
  private static readonly PROD_EXT_ID = "pakknkopmiakipmbjmfejcejehmgieli";
  private static readonly DEV_CLIENT_ID = "Ov23lieYe8hkM5XO9r1y";
  private static readonly PROD_CLIENT_ID = "Ov23li9p53LfS0Ule1M0";
  // The user must insert their client secrets below.
  private static readonly DEV_CLIENT_SECRET = "6d7d9421286e48b3c2098b18d6bd6281b8c30904";
  private static readonly PROD_CLIENT_SECRET = "f17a088af033ed7c615c6abcd920a28a2ce981aa";

  // ── Config helpers ──────────────────────────────────────────────────

  static async saveConfig(config: GitHubSyncConfig): Promise<void> {
    await chrome.storage.local.set({ [this.CFG_KEY]: config });
  }

  static async getConfig(): Promise<GitHubSyncConfig | null> {
    const r = await chrome.storage.local.get(this.CFG_KEY);
    return r[this.CFG_KEY] || null;
  }

  static async disconnect(): Promise<void> {
    await chrome.storage.local.remove(this.CFG_KEY);
  }

  static async checkHealth(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      const config = await this.getConfig();
      if (!config?.token) throw new Error("No token configured");
      
      const username = await this.getGitHubUsername(config.token);
      if (config.repoName) {
        const exists = await this.repoExists(config.token, username, config.repoName);
        if (!exists) throw new Error(`Repository "${config.repoName}" not found`);
      }
      
      return { status: 'ok', message: `Connected as ${username}` };
    } catch (err: any) {
      return { status: 'error', message: err.message || "Unknown error" };
    }
  }

  static async logSyncEvent(problemsSynced: number, problems: string[] = [], status: 'success' | 'error' = 'success', error?: string): Promise<void> {
    const r = await chrome.storage.local.get('sync_history');
    const history = (r.sync_history || []) as any[];
    
    const entry = {
      timestamp: Date.now(),
      problemsSynced,
      problems: problems.slice(0, 5), // Keep it small
      status,
      error
    };
    
    // Keep last 10 entries
    const newHistory = [entry, ...history].slice(0, 10);
    await chrome.storage.local.set({ sync_history: newHistory });
  }

  // ── OAuth helpers ───────────────────────────────────────────────────

  static async loginWithOAuth(): Promise<string> {
    const isProd = chrome.runtime.id === this.PROD_EXT_ID;
    const clientId = isProd ? this.PROD_CLIENT_ID : this.DEV_CLIENT_ID;
    const clientSecret = isProd ? this.PROD_CLIENT_SECRET : this.DEV_CLIENT_SECRET;
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        async (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            return reject(new Error(chrome.runtime.lastError?.message || "OAuth failed or cancelled."));
          }
          const urlParams = new URLSearchParams(new URL(redirectUrl).search);
          const code = urlParams.get("code");
          if (!code) {
            return reject(new Error("No auth code returned from GitHub."));
          }

          try {
            // Exchange code for access token
            const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                redirect_uri: redirectUri,
              }),
            });
            const data = await tokenResponse.json();
            if (data.error) {
              throw new Error(data.error_description || data.error);
            }
            resolve(data.access_token);
          } catch (err: any) {
            reject(new Error("Token exchange failed: " + err.message));
          }
        }
      );
    });
  }

  // ── Synced-set helpers ──────────────────────────────────────────────

  static async getSyncedIds(): Promise<Set<string>> {
    const r = await chrome.storage.local.get(this.SYNCED_KEY);
    return new Set<string>(r[this.SYNCED_KEY] || []);
  }

  private static async batchMarkSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const s = await this.getSyncedIds();
    ids.forEach((id) => s.add(id));
    await chrome.storage.local.set({ [this.SYNCED_KEY]: Array.from(s) });
  }

  // ── Main sync entry-point ──────────────────────────────────────────

  /**
   * Syncs an array of accepted submissions to GitHub.
   * Skips any submission whose `id` is already in the synced set.
   * Returns the count of newly synced submissions.
   *
   * @param submissions  All accepted submissions (from `fetchAllAcceptedSubmissions`)
   * @param onProgress   Callback with (synced, total) counts
   */
  static async syncSubmissions(
    submissions: AcceptedSubmission[],
    onProgress?: (synced: number, total: number) => void,
  ): Promise<number> {
    const config = await this.getConfig();
    if (!config?.token) throw new Error("GitHub token not configured");
    const repo = config.repoName;
    if (!repo) throw new Error("Repository name not configured");

    const ghUser = await this.getGitHubUsername(config.token);

    // Ensure repo exists
    if (!(await this.repoExists(config.token, ghUser, repo))) {
      await this.createRepo(config.token, repo);
    }

    const synced = await this.getSyncedIds();

    // Group by problem slug and pre-compute try numbers in one pass
    const byProblem = new Map<string, AcceptedSubmission[]>();
    for (const s of submissions) {
      if (!byProblem.has(s.titleSlug)) byProblem.set(s.titleSlug, []);
      byProblem.get(s.titleSlug)!.push(s);
    }
    // Sort each problem's submissions oldest→newest
    for (const [, subs] of byProblem) {
      subs.sort((a, b) => a.timestamp - b.timestamp);
    }
    // Build O(1) lookup: submissionId → try number
    const tryIndexMap = new Map<string, number>();
    for (const [, subs] of byProblem) {
      for (let i = 0; i < subs.length; i++) {
        tryIndexMap.set(subs[i].id, i + 1);
      }
    }

    // Cache for problem metadata (number + difficulty)
    const metaCache = new Map<
      string,
      { num: number | null; difficulty: string }
    >();

    let syncedCount = 0;
    const toSync = submissions.filter((s) => !synced.has(s.id));
    const total = toSync.length;
    const newlySyncedIds: string[] = [];
    console.log(
      `[GH] ${total} new submissions to sync (${synced.size} already synced)`,
    );

    for (const sub of toSync) {
      // O(1) try number lookup
      const tryIndex = tryIndexMap.get(sub.id) || 1;
      
      let code: string | null = null;
      let meta = { num: null as number | null, difficulty: "Unknown" };
      const platformDir = sub.platform === 'codeforces' ? 'Codeforces' : sub.platform === 'codechef' ? 'CodeChef' : 'LeetCode';

      if (!sub.platform || sub.platform === 'leetcode') {
        const [fetchedCode, fetchedMeta] = await Promise.all([
          LeetCodeService.fetchSubmissionCode(sub.id),
          metaCache.has(sub.titleSlug) 
            ? Promise.resolve(metaCache.get(sub.titleSlug)!)
            : this.getProblemMeta(sub.titleSlug).then(m => {
                metaCache.set(sub.titleSlug, m);
                return m;
              })
        ]);
        code = fetchedCode;
        meta = fetchedMeta;
      } else if (sub.platform === 'codeforces') {
        const parts = sub.titleSlug.split('/');
        const contestId = parts[0];
        code = await CodeforcesService.fetchSubmissionCode(contestId, sub.id); 
        meta.difficulty = (sub as any).difficulty || 'Unknown';
      } else if (sub.platform === 'codechef') {
        // CodeChef code scraping logic to be added
        meta.difficulty = (sub as any).difficulty || 'Unknown';
      }

      const num = meta.num;
      const difficulty = meta.difficulty; 
      const problemFolder = num ? `${num}-${sub.titleSlug}` : sub.titleSlug;

      const ext = this.ext(sub.lang);
      const fileName = `try-${tryIndex}${ext}`;
      const filePath = `${platformDir}/${difficulty}/${problemFolder}/${fileName}`;

      const content = this.buildFile(sub, tryIndex, num, difficulty, code);

      try {
        await this.upsertFile(config.token, ghUser, repo, filePath, content);
        
        // ★ ATOMIC UPDATE: Mark as synced immediately
        await this.batchMarkSynced([sub.id]);
        
        syncedCount++;
        console.log(`[GH] ✓ ${filePath}`);
      } catch (err) {
        console.error(`[GH] ✗ ${filePath}:`, err);
      }

      onProgress?.(syncedCount, total);

      // Throttle to avoid LeetCode WAF (reduced slightly as we are more efficient)
      await sleep(
        API_CONSTANTS.SUBMISSION_FETCH_DELAY_MS / 2 +
          Math.random() * API_CONSTANTS.SUBMISSION_FETCH_JITTER_MS
      );
    }

    // config.lastSync is updated in background script if needed, or here
    config.lastSync = Date.now();
    await this.saveConfig(config);

    return syncedCount;
  }

  // ── Utility methods ─────────────────────────────────────────────────

  /**
   * Fetch problem metadata (number + difficulty) via LeetCode GraphQL.
   * Uses the centralized gql() helper for proper CSRF, credentials, and retry.
   */
  private static async getProblemMeta(
    slug: string,
  ): Promise<{ num: number | null; difficulty: string }> {
    try {
      const data = await LeetCodeService.gql<{
        question: { questionFrontendId: string; difficulty: string } | null;
      }>(
        `query getProblemMeta($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionFrontendId
            difficulty
          }
        }`,
        { titleSlug: slug },
      );
      const q = data?.question;
      return {
        num: parseInt(q?.questionFrontendId || "0", 10) || null,
        difficulty: q?.difficulty || "Unknown",
      };
    } catch (err) {
      console.error(`[GH] Failed to fetch meta for ${slug}:`, err);
      return { num: null, difficulty: "Unknown" };
    }
  }

  private static ext(lang: string): string {
    const l = lang.toLowerCase();
    if (l.includes("c++") || l.includes("cpp")) return ".cpp";
    if (l.includes("java") && !l.includes("javascript")) return ".java";
    if (l.includes("python") || l.includes("pypy")) return ".py";
    if (l.includes("javascript") || l.includes("node")) return ".js";
    if (l.includes("typescript") || l.includes("ts")) return ".ts";
    if (l.includes("c#") || l.includes("csharp")) return ".cs";
    if (l.includes("go")) return ".go";
    if (l.includes("rust")) return ".rs";
    if (l.includes("kotlin")) return ".kt";
    if (l.includes("swift")) return ".swift";
    if (l.includes("sql")) return ".sql";
    if (l.includes("ruby")) return ".rb";
    if (l.includes("scala")) return ".scala";
    if (l.includes("php")) return ".php";
    if (l.includes("dart")) return ".dart";
    if (l === "c") return ".c";
    return ".txt";
  }

  private static buildFile(
    sub: AcceptedSubmission,
    tryNum: number,
    problemNum: number | null,
    difficulty: string,
    code: string | null,
  ): string {
    const date = new Date(sub.timestamp).toLocaleString();
    const pid = problemNum ? `#${problemNum}` : "";
    
    let link = `https://leetcode.com/problems/${sub.titleSlug}/`;
    if (sub.platform === 'codeforces') {
      const parts = sub.titleSlug.split('/');
      link = `https://codeforces.com/contest/${parts[0]}/problem/${parts[1]}`;
    } else if (sub.platform === 'codechef') {
      link = `https://www.codechef.com/problems/${sub.titleSlug}`;
    }

    return `/*
 * Problem ${pid}: ${sub.title}
 * Difficulty: ${difficulty}
 * Submission: Try ${tryNum}
 * status: ${sub.statusDisplay}
 * Language: ${sub.lang}
 * Date: ${date}
${sub.runtimeBeats ? ` * Runtime Beats: ${sub.runtimeBeats}\n` : ""}${sub.memoryBeats ? ` * Memory Beats: ${sub.memoryBeats}\n` : ""} * Link: ${link}
 */

${code || "// Code not available"}
`;
  }

  // ── GitHub REST helpers ─────────────────────────────────────────────

  static async getGitHubUsername(token: string): Promise<string> {
    const r = await fetch(`${this.API}/user`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!r.ok) throw new Error("Failed to get GitHub user");
    return (await r.json()).login;
  }

  private static async repoExists(
    token: string,
    user: string,
    repo: string,
  ): Promise<boolean> {
    const r = await fetch(`${this.API}/repos/${user}/${repo}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    return r.ok;
  }

  private static async createRepo(token: string, name: string): Promise<void> {
    const r = await fetch(`${this.API}/user/repos`, {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description: "LeetCode solutions synced by L'Amigo",
        private: true,
        auto_init: true,
      }),
    });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.message || "Failed to create repo");
    }
    await sleep(2000); // wait for GitHub to initialise
  }

  private static async upsertFile(
    token: string,
    user: string,
    repo: string,
    path: string,
    content: string,
  ): Promise<void> {
    // Get SHA if file already exists
    let sha: string | undefined;
    try {
      const g = await fetch(
        `${this.API}/repos/${user}/${repo}/contents/${path}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );
      if (g.ok) sha = (await g.json()).sha;
    } catch {
      /* file doesn't exist yet */
    }

    const r = await fetch(
      `${this.API}/repos/${user}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: sha ? `Update ${path}` : `Add ${path}`,
          content: btoa(unescape(encodeURIComponent(content))),
          ...(sha && { sha }),
        }),
      },
    );
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.message || `Failed to update ${path}`);
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
