import { AcceptedSubmission, LeetCodeService } from "./leetcode";
import { CodeforcesService } from "./codeforces";
import { CodeChefService } from "./codechef";
import { API_CONSTANTS } from "../constants";
import { StorageService } from "./storage";

export interface SyncResult {
  count: number;
  syncedSubmissions: Array<{ title: string; lang: string }>;
}

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
  private static readonly DEVICE_CODE_URL = "https://github.com/login/device/code";
  private static readonly ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

  // OAuth Constants — Client IDs are public and safe to expose.
  // Client secrets are injected at BUILD TIME via webpack DefinePlugin from .env (never committed).
  private static readonly PROD_EXT_ID = "pakknkopmiakipmbjmfejcejehmgieli";
  private static readonly DEV_CLIENT_ID = "Ov23lieYe8hkM5XO9r1y";
  private static readonly PROD_CLIENT_ID = "Ov23li9p53LfS0Ule1M0";
  private static readonly DEV_CLIENT_SECRET: string = atob(process.env.GITHUB_DEV_SECRET as string);
  private static readonly PROD_CLIENT_SECRET: string = atob(process.env.GITHUB_PROD_SECRET as string);

  // ── Token encryption (AES-GCM via SubtleCrypto) ─────────────────────
  // Key material is derived from the extension ID so it's unique per installation.

  private static async _getEncryptionKey(): Promise<CryptoKey> {
    const raw = new TextEncoder().encode(
      `lamigo-gh-token-key:${chrome.runtime.id}`
    );
    // Use SHA-256 of the ID as raw key material
    const hash = await crypto.subtle.digest('SHA-256', raw);
    return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  private static async _encryptToken(token: string): Promise<string> {
    const key = await this._getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(token);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    // Persist as base64(iv):base64(ciphertext)
    const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
    return `${toB64(iv.buffer)}:${toB64(cipher)}`;
  }

  private static async _decryptToken(encrypted: string): Promise<string | null> {
    try {
      const [ivB64, cipherB64] = encrypted.split(':');
      if (!ivB64 || !cipherB64) return null;
      const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
      const iv = fromB64(ivB64);
      const cipher = fromB64(cipherB64);
      const key = await this._getEncryptionKey();
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
      return new TextDecoder().decode(plain);
    } catch {
      return null; // corrupted / wrong key — treat as not connected
    }
  }

  // ── Config helpers ──────────────────────────────────────────────────

  static async saveConfig(config: GitHubSyncConfig): Promise<void> {
    // Encrypt token before persisting to storage
    const encrypted = await this._encryptToken(config.token);
    await chrome.storage.local.set({ [this.CFG_KEY]: { ...config, token: encrypted, _enc: true } });
  }

  static async getConfig(): Promise<GitHubSyncConfig | null> {
    const r = await chrome.storage.local.get(this.CFG_KEY);
    const raw = r[this.CFG_KEY];
    if (!raw) return null;
    // Decrypt token if it was stored encrypted
    if (raw._enc && raw.token) {
      const plainToken = await this._decryptToken(raw.token);
      if (!plainToken) return null; // decryption failed — force re-auth
      return { ...raw, token: plainToken };
    }
    return raw;
  }

  static async disconnect(): Promise<void> {
    // Revoke the token on GitHub's side before wiping local config
    try {
      const config = await this.getConfig();
      if (config?.token) {
        const isProd = chrome.runtime.id === this.PROD_EXT_ID;
        const clientId = isProd ? this.PROD_CLIENT_ID : this.DEV_CLIENT_ID;
        const clientSecret = isProd ? this.PROD_CLIENT_SECRET : this.DEV_CLIENT_SECRET;
        await fetch(`${this.API}/applications/${clientId}/token`, {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json',
          },
          body: JSON.stringify({ access_token: config.token }),
        });
      }
    } catch {
      // Best-effort — always delete local config regardless
    }
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

  static generateHistoryMarkdown(submissions: AcceptedSubmission[]): string {
    const lines = [
      "# Submission History",
      "",
      "A complete history of all accepted submissions synced by L'Amigo.",
      "",
      "| Date | Platform | Problem | Language |",
      "| :--- | :--- | :--- | :--- |",
    ];

    // Sort newest to oldest
    const sorted = [...submissions].sort((a, b) => b.timestamp - a.timestamp);

    for (const sub of sorted) {
      const date = new Date(sub.timestamp).toISOString().split('T')[0];
      const platform = (sub.platform || 'leetcode').charAt(0).toUpperCase() + (sub.platform || 'leetcode').slice(1);
      const lang = sub.lang || 'Unknown';
      const cleanTitle = sub.title.replace(/\|/g, '\\|');
      lines.push(`| ${date} | ${platform} | ${cleanTitle} | ${lang} |`);
    }

    return lines.join('\n');
  }

  // ── README Generation ───────────────────────────────────────────────────

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

  static async requestDeviceCode(): Promise<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }> {
    const isProd = chrome.runtime.id === this.PROD_EXT_ID;
    const clientId = isProd ? this.PROD_CLIENT_ID : this.DEV_CLIENT_ID;

    const r = await fetch(this.DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: "repo",
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`Failed to request device code: ${errText || r.statusText}`);
    }

    return await r.json();
  }

  static async pollForToken(
    deviceCode: string,
    interval: number,
    abortSignal?: AbortSignal
  ): Promise<string> {
    const isProd = chrome.runtime.id === this.PROD_EXT_ID;
    const clientId = isProd ? this.PROD_CLIENT_ID : this.DEV_CLIENT_ID;
    let pollInterval = interval || 5;

    while (true) {
      if (abortSignal?.aborted) {
        throw new Error("Device authorization cancelled.");
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));

      if (abortSignal?.aborted) {
        throw new Error("Device authorization cancelled.");
      }

      const r = await fetch(this.ACCESS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });

      if (!r.ok) {
        throw new Error("Failed polling for access token");
      }

      const data = await r.json();

      if (data.error) {
        if (data.error === "authorization_pending") {
          continue;
        } else if (data.error === "slow_down") {
          pollInterval = (data.interval || pollInterval) + 2;
          continue;
        } else if (data.error === "expired_token") {
          throw new Error("The device code has expired. Please try again.");
        } else if (data.error === "access_denied") {
          throw new Error("Access denied by the user.");
        } else {
          throw new Error(data.error_description || data.error);
        }
      }

      if (data.access_token) {
        return data.access_token;
      }
    }
  }

  // ── Synced-set helpers ──────────────────────────────────────────────

  static async getSyncedIds(): Promise<Set<string>> {
    const r = await chrome.storage.local.get(this.SYNCED_KEY);
    return new Set<string>(r[this.SYNCED_KEY] || []);
  }

  private static syncQueuePromise: Promise<void> = Promise.resolve();

  private static async batchMarkSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    this.syncQueuePromise = this.syncQueuePromise.then(async () => {
      const s = await this.getSyncedIds();
      ids.forEach((id) => s.add(id));
      await chrome.storage.local.set({ [this.SYNCED_KEY]: Array.from(s) });
    });
    return this.syncQueuePromise;
  }

  static async removeSyncedIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const s = await this.getSyncedIds();
    ids.forEach((id) => s.delete(id));
    await chrome.storage.local.set({ [this.SYNCED_KEY]: Array.from(s) });
  }

  // ── Main sync entry-point ──────────────────────────────────────────

  /**
   * Syncs an array of accepted submissions to GitHub.
   * Skips any submission whose `id` is already in the synced set.
   * Returns the count of newly synced submissions.
   *
   * @param submissions  All accepted submissions (from `fetchAllAcceptedSubmissions`)
   * @param onProgress   Callback with (synced, total, failed) counts
   */
  static async syncSubmissions(
    submissions: AcceptedSubmission[],
    onProgress?: (synced: number, total: number, failed?: number) => void,
    forceCfOnly?: boolean,
    historyOnly?: boolean
  ): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config?.token) throw new Error("GitHub token not configured");
    const repo = config.repoName;
    if (!repo) throw new Error("Repository name not configured");

    const ghUser = await this.getGitHubUsername(config.token);

    // Ensure repo exists
    if (!(await this.repoExists(config.token, ghUser, repo))) {
      await this.createRepo(config.token, repo);
    }

    // Fetch remote state to prepopulate synced ids
    try {
      const remoteSyncedIds = await this.getSyncState(config.token, ghUser, repo);
      if (remoteSyncedIds.length > 0) {
        await this.batchMarkSynced(remoteSyncedIds);
      }
    } catch (e) {
      console.error("[GH] Failed to fetch remote sync state", e);
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
    let processedCount = 0;
    let failedCount = 0;
    const syncedDetails: Array<{ title: string; lang: string }> = [];
    const toSync = submissions.filter((s) => {
      const titleKey = `${s.platform}-${s.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}_folder`;
      if (s.platform === 'cses' || s.platform === 'codeforces' || s.platform === 'gfg' || s.platform === 'codechef') {
        return (!synced.has(s.id + '_folder') && !synced.has(titleKey)) || (forceCfOnly && (s.platform === 'codeforces' || s.platform === 'cses' || s.platform === 'gfg' || s.platform === 'codechef'));
      }
      return !synced.has(s.id);
    });
    const total = toSync.length;
    console.log(
      `[GH] ${total} new submissions to sync (${synced.size} already synced)`,
    );

    if (historyOnly) {
      console.log(`[GH] Fast Sync (History Only) enabled. Generating lamigo_history.md for ${submissions.length} total submissions...`);
      const historyMd = this.generateHistoryMarkdown(submissions);
      await this.upsertFile(config.token, ghUser, repo, "lamigo_history.md", historyMd);
      await this.upsertFile(config.token, ghUser, repo, "submission_history.json", JSON.stringify(submissions, null, 2));
      
      const allIds = submissions.map(s => s.id);
      await this.saveSyncState(config.token, ghUser, repo, allIds);
      
      config.lastSync = Date.now();
      await this.saveConfig(config);
      
      return { count: submissions.length, syncedSubmissions: [] };
    }

    const BATCH_SIZE = 3;
    for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
      const { cancel_sync } = await chrome.storage.session.get('cancel_sync');
      if (cancel_sync) {
        console.log('[GH] Sync cancelled by user');
        break;
      }
      
      const batch = toSync.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (sub) => {
        // O(1) try number lookup
        const tryIndex = tryIndexMap.get(sub.id) || 1;
        
        let code: string | null = null;
        let meta = { num: null as number | null, difficulty: "Unknown" };
        
        const platformMap: Record<string, string> = {
          codeforces: 'Codeforces',
          codechef: 'CodeChef',
          leetcode: 'LeetCode',
          cses: 'CSES',
          gfg: 'GeeksForGeeks'
        };
        const platformDir = platformMap[sub.platform || 'leetcode'] || 'Other';

        if (!sub.platform || sub.platform === 'leetcode' || sub.platform === 'cses' || sub.platform === 'codeforces' || sub.platform === 'gfg' || sub.platform === 'codechef') {
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
            if (!fetchedCode) {
              console.warn(`[GH] Failed to fetch LeetCode code for ${sub.title} (${sub.id}). Skipping to allow retry later.`);
              failedCount++;
              processedCount++;
              onProgress?.(processedCount, total, failedCount);
              return;
            }
            code = fetchedCode;
            meta = fetchedMeta;
          } else if (sub.platform === 'cses') {
            if (!(sub as any).code) {
              console.warn(`[GH] Failed to fetch CSES code for ${sub.title} (${sub.id}). Skipping to allow retry later.`);
              failedCount++;
              processedCount++;
              onProgress?.(processedCount, total, failedCount);
              return;
            }
            code = (sub as any).code;
            meta = { num: null, difficulty: "Unknown" };
          } else if (sub.platform === 'codeforces') {
            const contestId = sub.titleSlug.split('/')[0] || '';
            const fetchedCode = await CodeforcesService.fetchSubmissionCode(contestId, sub.id);
            if (!fetchedCode) {
              console.warn(`[GH] Failed to fetch Codeforces code for ${sub.title} (${sub.id}). Skipping to allow retry later.`);
              failedCount++;
              processedCount++;
              onProgress?.(processedCount, total, failedCount);
              return;
            }
            code = fetchedCode;
            meta = { num: null, difficulty: (sub as any).difficulty || "Unknown" };
          } else if (sub.platform === 'codechef') {
            const fetchedCode = await CodeChefService.fetchSubmissionCode((sub as any).submissionId || sub.id);
            if (!fetchedCode) {
              console.warn(`[GH] Failed to fetch CodeChef code for ${sub.title} (${sub.id}). Skipping to allow retry later.`);
              failedCount++;
              processedCount++;
              onProgress?.(processedCount, total, failedCount);
              return;
            }
            code = fetchedCode;
            meta = { num: null, difficulty: (sub as any).difficulty || "Unknown" };
          } else if (sub.platform === 'gfg') {
            code = "// Code not directly exposed by GeeksforGeeks public profile\n// Problem successfully solved and tracked by L'Amigo";
            meta = { num: null, difficulty: "Unknown" };
          }

          const num = meta.num;
          const difficulty = meta.difficulty; 
          const problemFolder = num ? `${num}-${sub.titleSlug}` : sub.titleSlug;

          const ext = this.ext(sub.lang);
          const fileName = `try-${tryIndex}${ext}`;
          const filePath = (sub.platform === 'cses' || sub.platform === 'codeforces' || sub.platform === 'gfg' || sub.platform === 'codechef')
            ? `${platformDir}/${problemFolder}/${fileName}`
            : `${platformDir}/${difficulty}/${problemFolder}/${fileName}`;

          const content = this.buildFile(sub, tryIndex, num, difficulty, code);

          try {
            await this.upsertFile(config.token, ghUser, repo, filePath, content);
            const titleKey = `${sub.platform}-${sub.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}_folder`;
            const syncKeys = (sub.platform === 'cses' || sub.platform === 'codeforces' || sub.platform === 'gfg' || sub.platform === 'codechef') 
              ? [sub.id, sub.id + '_folder', titleKey] 
              : [sub.id];
            await this.batchMarkSynced(syncKeys);
            syncKeys.forEach(k => synced.add(k));
            syncedCount++;
            syncedDetails.push({ title: sub.title, lang: sub.lang });
            console.log(`[GH]  ${filePath}`);
          } catch (err: any) {
            console.error(`[GH]  ${filePath}:`, err);
            failedCount++;
            if (err.message && (err.message.includes('rate limit') || err.message.includes('abuse') || err.message.includes('secondary'))) {
              console.warn("[GH] Secondary rate limit encountered. Pausing for 10 seconds before continuing...");
              await sleep(10000);
            }
          }

          // Throttle to avoid LeetCode WAF and Codeforces/CodeChef rate limits
          if (!sub.platform || sub.platform === 'leetcode' || sub.platform === 'codeforces' || sub.platform === 'codechef') {
            await sleep(
              sub.platform === 'codeforces' || sub.platform === 'codechef'
                ? 1500 + Math.random() * 1000
                : API_CONSTANTS.SUBMISSION_FETCH_DELAY_MS / 2 + Math.random() * API_CONSTANTS.SUBMISSION_FETCH_JITTER_MS
            );
          }
        } else {
          // For non-LeetCode/CSES/Codeforces/GFG/CodeChef platforms, only sync to history/sheets tracking, no folders or code files!
          await this.batchMarkSynced([sub.id]);
          synced.add(sub.id);
          syncedCount++;
          syncedDetails.push({ title: sub.title, lang: sub.lang });
          console.log(`[GH]  ${platformDir} history tracked (no folder): ${sub.title}`);
        }

        processedCount++;
        onProgress?.(processedCount, total, failedCount);
      }));
      
      // Delay between chunks to reduce load
      if (i + BATCH_SIZE < toSync.length) {
        await sleep(1200);
      }
    }

    // Auto-generate beautiful README.md, history files, and stats badge
    try {
      const historyMd = this.generateHistoryMarkdown(submissions);
      await this.upsertFile(config.token, ghUser, repo, "lamigo_history.md", historyMd);
      await this.upsertFile(config.token, ghUser, repo, "submission_history.json", JSON.stringify(submissions, null, 2));

      const { own_username } = await chrome.storage.local.get("own_username");
      if (own_username) {
        const ownProfile = await StorageService.getProfile(own_username);
        if (ownProfile) {
          const storedMeta = await chrome.storage.local.get("leetcode_problem_meta");
          const metaMap = storedMeta.leetcode_problem_meta || {};
          
          const readmeContent = this.generateReadme(ownProfile, submissions, metaMap);
          const badgeContent = this.generateStatsBadge(ownProfile.problemsSolved.total);
          
          await this.upsertFile(config.token, ghUser, repo, "README.md", readmeContent);
          await this.upsertFile(config.token, ghUser, repo, "leetcode-stats.svg", badgeContent);
          console.log("[GH] Successfully updated README.md, submission_history.json, and leetcode-stats.svg");
        }
      }
    } catch (err) {
      console.error("[GH] Failed to update README/Badge/History:", err);
    }

    // config.lastSync is updated in background script if needed, or here
    config.lastSync = Date.now();
    await this.saveConfig(config);

    if (syncedCount > 0) {
      try {
        const finalSynced = await this.getSyncedIds();
        await this.saveSyncState(config.token, ghUser, repo, Array.from(finalSynced));
        console.log(`[GH] Updated lamigo_sync_state.json with ${finalSynced.size} IDs.`);
      } catch (err) {
        console.error("[GH] Failed to save sync state", err);
      }
    }

    return { count: syncedCount, syncedSubmissions: syncedDetails };
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
      const cache = await chrome.storage.local.get("leetcode_problem_meta");
      const metaMap = cache.leetcode_problem_meta || {};
      if (metaMap[slug]) {
        return metaMap[slug];
      }

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
      const res = {
        num: parseInt(q?.questionFrontendId || "0", 10) || null,
        difficulty: q?.difficulty || "Unknown",
      };

      metaMap[slug] = res;
      await chrome.storage.local.set({ leetcode_problem_meta: metaMap });
      return res;
    } catch (err) {
      console.error(`[GH] Failed to fetch meta for ${slug}:`, err);
      return { num: null, difficulty: "Unknown" };
    }
  }

  private static getProgressBar(percent: number): string {
    const size = 10;
    const dots = Math.round((percent / 100) * size);
    const emptyDots = size - dots;
    return `\`[` + "█".repeat(dots) + "░".repeat(emptyDots) + `]\` (${percent.toFixed(1)}%)`;
  }

  static generateReadme(
    profile: any,
    submissions: AcceptedSubmission[],
    metaMap: Record<string, { num: number | null; difficulty: string }>
  ): string {
    const total = profile.problemsSolved?.total || 0;
    const easy = profile.problemsSolved?.easy || 0;
    const medium = profile.problemsSolved?.medium || 0;
    const hard = profile.problemsSolved?.hard || 0;

    const easyPct = total > 0 ? (easy / total) * 100 : 0;
    const mediumPct = total > 0 ? (medium / total) * 100 : 0;
    const hardPct = total > 0 ? (hard / total) * 100 : 0;

    // Generate topic tag table (top 10 topics)
    const topTopics = (profile.topicStats || []).slice(0, 10);
    let topicTable = "| Topic | Solved |\n| :--- | :--- |\n";
    if (topTopics.length > 0) {
      topTopics.forEach((t: any) => {
        topicTable += `| ${t.topicName} | ${t.problemsSolved} |\n`;
      });
    } else {
      topicTable += "| N/A | 0 |\n";
    }

    // Generate index of solutions
    const uniqueProblems = new Map<string, { title: string; lang: string; timestamp: number; platform: string; difficulty: string; rating: number }>();
    submissions.forEach(s => {
      const platform = s.platform || 'leetcode';
      const difficulty = (s as any).difficulty || 'Unknown';
      const rating = (s as any).rating || 0;
      if (!uniqueProblems.has(s.titleSlug) || s.timestamp > uniqueProblems.get(s.titleSlug)!.timestamp) {
        uniqueProblems.set(s.titleSlug, { title: s.title, lang: s.lang, timestamp: s.timestamp, platform, difficulty, rating });
      }
    });

    const sortedProblems = Array.from(uniqueProblems.entries())
      .sort((a, b) => a[1].title.localeCompare(b[1].title));

    let indexTable = "| Platform | Problem | Language | Solution Folder |\n| :--- | :--- | :--- | :--- |\n";
    if (sortedProblems.length > 0) {
      sortedProblems.forEach(([slug, p]) => {
        const meta = metaMap[slug] || { num: null, difficulty: p.difficulty };
        const difficulty = p.platform === 'leetcode' ? meta.difficulty : p.difficulty;
        const problemFolder = meta.num ? `${meta.num}-${slug}` : slug;
        const platformMapNames: Record<string, string> = {
          leetcode: 'LeetCode',
          codeforces: 'Codeforces',
          codechef: 'CodeChef',
          cses: 'CSES',
          gfg: 'GeeksforGeeks'
        };
        const platformDir = platformMapNames[p.platform] || 'LeetCode';
        
        let link = `https://leetcode.com/problems/${slug}/`;
        if (p.platform === 'codeforces') {
          const parts = slug.split('/');
          link = `https://codeforces.com/contest/${parts[0]}/problem/${parts[1]}`;
        } else if (p.platform === 'codechef') {
          link = `https://www.codechef.com/problems/${slug}`;
        } else if (p.platform === 'cses') {
          link = `https://cses.fi/problemset/task/${slug}`;
        } else if (p.platform === 'gfg') {
          link = `https://practice.geeksforgeeks.org/problems/${slug}/1`;
        }
        
        let solutionLink = `[History Tracked](./submission_history.json)`;
        if (p.platform === 'leetcode') {
          const relativePath = `${platformDir}/${difficulty}/${problemFolder}`;
          solutionLink = `[View Solution](./${encodeURI(relativePath)})`;
        } else if (p.platform === 'cses' || p.platform === 'codeforces' || p.platform === 'gfg' || p.platform === 'codechef') {
          const relativePath = `${platformDir}/${problemFolder}`;
          solutionLink = `[View Solution](./${encodeURI(relativePath)})`;
        }
        
        const cleanTitle = p.title.replace(/\|/g, '\\|');
        indexTable += `| ${platformDir} | [${cleanTitle}](${link}) | ${p.lang} | ${solutionLink} |\n`;
      });
    } else {
      indexTable += "| N/A | N/A | N/A | N/A |\n";
    }

    const uniqueList = Array.from(uniqueProblems.values());
    const lcCount = uniqueList.filter(p => !p.platform || p.platform === 'leetcode').length;
    const cfCount = uniqueList.filter(p => p.platform === 'codeforces').length;
    const csesCount = uniqueList.filter(p => p.platform === 'cses').length;
    const gfgCount = uniqueList.filter(p => p.platform === 'gfg').length;
    const totalCount = uniqueList.length;

    const cfProblems = uniqueList.filter(p => p.platform === 'codeforces');
    let cf900 = 0, cf1100 = 0, cf1300 = 0, cf1500 = 0, cf1800 = 0, cf1900 = 0, cfUnrated = 0;
    cfProblems.forEach(p => {
      const r = p.rating || 0;
      if (r === 0) cfUnrated++;
      else if (r <= 900) cf900++;
      else if (r <= 1100) cf1100++;
      else if (r <= 1300) cf1300++;
      else if (r <= 1500) cf1500++;
      else if (r <= 1800) cf1800++;
      else cf1900++;
    });

    const cfRatingTable = `## Codeforces Rating Breakdown

| Rating Bracket | Problems Solved |
| :--- | :---: |
| **<= 900** | ${cf900} |
| **1000 - 1100** | ${cf1100} |
| **1200 - 1300** | ${cf1300} |
| **1400 - 1500** | ${cf1500} |
| **1600 - 1800** | ${cf1800} |
| **1900+** | ${cf1900} |
| **Unrated** | ${cfUnrated} |
`;

    return `# Multi-Platform DSA & CP Portfolio

Showcasing my Data Structures, Algorithms, and Competitive Programming solutions synced automatically by [L'Amigo](https://github.com/FTS18/l-amigo).

<p align="center">
  <img src="https://img.shields.io/badge/LeetCode-${lcCount}_Solved-FFA116?style=for-the-badge&logo=leetcode" alt="LeetCode" />
  <img src="https://img.shields.io/badge/Codeforces-${cfCount}_Solved-1F8ACB?style=for-the-badge&logo=codeforces" alt="Codeforces" />
  <img src="https://img.shields.io/badge/CSES-${csesCount}_Solved-000000?style=for-the-badge&logo=code" alt="CSES" />
  <img src="https://img.shields.io/badge/GeeksforGeeks-${gfgCount}_Solved-2F8D46?style=for-the-badge&logo=geeksforgeeks" alt="GeeksforGeeks" />
</p>

## Multi-Platform Scoreboard

| Platform | Solved Count | Solutions Tracked |
| :--- | :---: | :--- |
| **LeetCode** | ${lcCount} | [ \`/LeetCode\`](./LeetCode) |
| **Codeforces** | ${cfCount} | [ \`/Codeforces\`](./Codeforces) |
| **CSES Problemset** | ${csesCount} | [ \`/CSES\`](./CSES) |
| **GeeksforGeeks** | ${gfgCount} | [ \`/GeeksForGeeks\`](./GeeksForGeeks) |
| **Total Solved** | **${totalCount}** | [ \`submission_history.json\`](./submission_history.json) |

${cfRatingTable}
## LeetCode Progress Dashboard

<p align="center">
  <img src="./leetcode-stats.svg" alt="LeetCode Stats Badge" />
</p>

| Difficulty | Solved | Progress Bar |
| :--- | :---: | :--- |
| **Easy** | ${easy} | ${this.getProgressBar(easyPct)} |
| **Medium** | ${medium} | ${this.getProgressBar(mediumPct)} |
| **Hard** | ${hard} | ${this.getProgressBar(hardPct)} |

## Top LeetCode Topics

${topicTable}

## Synced Solutions Index

${indexTable}
`;
  }

  static generateStatsBadge(totalSolved: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="190" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <path fill="#555" d="0 0h110v20H0z"/>
    <path fill="#ffa116" d="110 0h80v20H110z"/>
    <path fill="url(#b)" d="0 0h190v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="55" y="15" fill="#010101" fill-opacity=".3">LeetCode Solved</text>
    <text x="55" y="14">LeetCode Solved</text>
    <text x="150" y="15" fill="#010101" fill-opacity=".3">${totalSolved}</text>
    <text x="150" y="14">${totalSolved}</text>
  </g>
</svg>`;
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
    } else if (sub.platform === 'cses') {
      link = `https://cses.fi/problemset/task/${sub.titleSlug}`;
    } else if (sub.platform === 'gfg') {
      link = `https://practice.geeksforgeeks.org/problems/${sub.titleSlug}/1`;
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

  static async getSyncState(
    token: string,
    user: string,
    repo: string,
  ): Promise<string[]> {
    try {
      const g = await fetch(
        `${this.API}/repos/${user}/${repo}/contents/lamigo_sync_state.json`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3.raw",
          },
          cache: "no-store",
        },
      );
      if (g.ok) {
        const text = await g.text();
        return JSON.parse(text);
      }
    } catch {
      // file doesn't exist or is invalid
    }
    return [];
  }

  static async saveSyncState(
    token: string,
    user: string,
    repo: string,
    ids: string[],
  ): Promise<void> {
    await this.upsertFile(
      token,
      user,
      repo,
      "lamigo_sync_state.json",
      JSON.stringify(ids),
    );
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
          cache: "no-store",
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

  static async backupState(): Promise<void> {
    const config = await this.getConfig();
    if (!config?.token || !config.repoName) return;

    try {
      const ghUser = await this.getGitHubUsername(config.token);
      const data = await chrome.storage.local.get([
        "friend_identities_v2",
        "own_username",
        "own_codeforces_handle",
        "own_codechef_handle",
        "darkMode",
        "notifications_enabled",
        "auto_refresh",
        "refresh_interval",
        "cf_dark_mode",
        "daily_goal",
        "sync_history"
      ]);

      const backupContent = JSON.stringify(data, null, 2);
      await this.upsertFile(config.token, ghUser, config.repoName, ".lamigo-backup.json", backupContent);
      await chrome.storage.local.set({ last_backup_time: Date.now() });
      console.log("[GH] State backup updated successfully in repository");
    } catch (err) {
      console.error("[GH] Failed to backup state to repository:", err);
    }
  }

  static async restoreState(token: string, repo: string): Promise<boolean> {
    try {
      const ghUser = await this.getGitHubUsername(token);
      // Fetch file content from GitHub
      const r = await fetch(`${this.API}/repos/${ghUser}/${repo}/contents/.lamigo-backup.json`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
        cache: "no-store",
      });
      if (!r.ok) {
        if (r.status === 404) {
          console.log("[GH] No backup file .lamigo-backup.json found in repository");
          return false;
        }
        throw new Error(`Failed to fetch backup: ${r.status}`);
      }

      const fileData = await r.json();
      const content = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
      const parsed = JSON.parse(content);

      // Save to chrome.storage.local
      const keysToSave: Record<string, any> = {};
      if (parsed.friend_identities_v2) keysToSave.friend_identities_v2 = parsed.friend_identities_v2;
      if (parsed.own_username) keysToSave.own_username = parsed.own_username;
      if (parsed.own_codeforces_handle) keysToSave.own_codeforces_handle = parsed.own_codeforces_handle;
      if (parsed.own_codechef_handle) keysToSave.own_codechef_handle = parsed.own_codechef_handle;
      if (parsed.darkMode !== undefined) keysToSave.darkMode = parsed.darkMode;
      if (parsed.notifications_enabled !== undefined) keysToSave.notifications_enabled = parsed.notifications_enabled;
      if (parsed.auto_refresh !== undefined) keysToSave.auto_refresh = parsed.auto_refresh;
      if (parsed.refresh_interval !== undefined) keysToSave.refresh_interval = parsed.refresh_interval;
      if (parsed.cf_dark_mode !== undefined) keysToSave.cf_dark_mode = parsed.cf_dark_mode;
      if (parsed.daily_goal !== undefined) keysToSave.daily_goal = parsed.daily_goal;
      if (parsed.sync_history) keysToSave.sync_history = parsed.sync_history;

      keysToSave.onboarding_complete = true;
      keysToSave.github_sync_config = { token, repoName: repo };

      await chrome.storage.local.set(keysToSave);
      console.log("[GH] State successfully restored from backup");
      return true;
    } catch (err) {
      console.error("[GH] Failed to restore state:", err);
      throw err;
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
