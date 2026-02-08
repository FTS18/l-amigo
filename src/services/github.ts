import { AcceptedSubmission, LeetCodeService } from "./leetcode";
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

      // Problem metadata (number + difficulty)
      if (!metaCache.has(sub.titleSlug)) {
        metaCache.set(sub.titleSlug, await this.getProblemMeta(sub.titleSlug));
      }
      const meta = metaCache.get(sub.titleSlug)!;
      const num = meta.num;
      const difficulty = meta.difficulty; // "Easy" | "Medium" | "Hard" | "Unknown"
      const problemFolder = num ? `${num}-${sub.titleSlug}` : sub.titleSlug;

      const ext = this.ext(sub.lang);
      const fileName = `try-${tryIndex}${ext}`;
      const filePath = `${difficulty}/${problemFolder}/${fileName}`;

      // Fetch actual source code
      const code = await LeetCodeService.fetchSubmissionCode(sub.id);

      // Throttle to avoid LeetCode WAF
      await sleep(
        API_CONSTANTS.SUBMISSION_FETCH_DELAY_MS +
          Math.random() * API_CONSTANTS.SUBMISSION_FETCH_JITTER_MS,
      );

      const content = this.buildFile(sub, tryIndex, num, difficulty, code);

      try {
        await this.upsertFile(config.token, ghUser, repo, filePath, content);
        newlySyncedIds.push(sub.id);
        syncedCount++;
        console.log(`[GH] ✓ ${filePath}`);
      } catch (err) {
        console.error(`[GH] ✗ ${filePath}:`, err);
      }

      onProgress?.(syncedCount, total);
    }

    // Batch write all newly synced IDs at once
    await this.batchMarkSynced(newlySyncedIds);

    // Update last sync timestamp
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
    const m: Record<string, string> = {
      cpp: ".cpp",
      "c++": ".cpp",
      python: ".py",
      python3: ".py",
      java: ".java",
      javascript: ".js",
      typescript: ".ts",
      c: ".c",
      csharp: ".cs",
      go: ".go",
      rust: ".rs",
      kotlin: ".kt",
      swift: ".swift",
      mysql: ".sql",
      mssql: ".sql",
      oraclesql: ".sql",
      ruby: ".rb",
      scala: ".scala",
      php: ".php",
      dart: ".dart",
    };
    return m[lang.toLowerCase()] || ".txt";
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
    return `/*
 * Problem ${pid}: ${sub.title}
 * Difficulty: ${difficulty}
 * Submission: Try ${tryNum}
 * Status: ${sub.statusDisplay}
 * Language: ${sub.lang}
 * Date: ${date}
 * Link: https://leetcode.com/problems/${sub.titleSlug}/
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
