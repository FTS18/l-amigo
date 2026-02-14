import { ProfilePageManager } from "./profile-manager";
import "./content.css";

class LeetCodeMonitor {
  private static readonly SELECTORS = {
    submitButton: '[data-e2e-locator="console-submit-button"]',
    submitButtonFallback: 'button[data-cy="submit-code-btn"]',
    submissionResult: '[data-e2e-locator="submission-result"]',
    submissionResultFallback: ".result-state",
    problemTitle: '[data-cy="question-title"]',
    problemTitleFallback: 'a[href*="/problems/"] span.text-title',
    runtimeBeats: '[data-e2e-locator="submission-runtime"]',
    memoryBeats: '[data-e2e-locator="submission-memory"]',
  };

  private isMonitoring = false;
  private lastSubmissionTime = 0;
  private urlBeforeSubmit = "";

  constructor() {
    this.init();
  }

  private async init() {
    if (!window.location.pathname.includes("/problems/")) return;

    console.log(
      "[L'Amigo] Monitoring submissions on",
      window.location.pathname,
    );
    try {
      await this.waitForElement(
        LeetCodeMonitor.SELECTORS.submitButton,
        LeetCodeMonitor.SELECTORS.submitButtonFallback,
      );
      this.setupSubmitListener();
      this.setupUrlChangeDetection();
      this.injectDailyProgress();
      this.injectSolvedByFriends();
    } catch {}
  }

  private setupSubmitListener() {
    const btn =
      document.querySelector(LeetCodeMonitor.SELECTORS.submitButton) ||
      document.querySelector(LeetCodeMonitor.SELECTORS.submitButtonFallback);
    if (!btn) return;
    btn.addEventListener("click", () => this.handleSubmit());
  }

  private setupUrlChangeDetection() {
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        if (
          this.urlBeforeSubmit &&
          currentUrl.includes("/submissions/") &&
          !lastUrl.includes("/submissions/")
        ) {
          // Just navigated to submissions page - likely after a submit
          setTimeout(() => this.checkSubmissionPage(), 1000);
        }
        lastUrl = currentUrl;
      }
    }).observe(document, { subtree: true, childList: true });
  }

  private async checkSubmissionPage() {
    // Check if the most recent submission on the page is "Accepted"
    try {
      const statusElements = document.querySelectorAll(
        '[data-e2e-locator="submission-item-status"]',
      );
      if (statusElements.length > 0) {
        const firstStatus = statusElements[0].textContent?.trim();
        if (firstStatus === "Accepted") {
          this.handleAccepted();
        }
      }
    } catch (err) {
      console.error("[L'Amigo] Failed to check submission page:", err);
    }
  }

  private async handleSubmit() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.urlBeforeSubmit = window.location.href;

    // Premium observer: Watch for the result element and specifically the "Accepted" text
    const observer = new MutationObserver((mutations, obs) => {
      const resultEl = document.querySelector(LeetCodeMonitor.SELECTORS.submissionResult) ||
                      document.querySelector(LeetCodeMonitor.SELECTORS.submissionResultFallback);
      
      if (resultEl && resultEl.textContent?.includes("Accepted")) {
        obs.disconnect();
        this.isMonitoring = false;
        this.urlBeforeSubmit = ""; // Reset after successful submission
        this.handleAccepted();
        // Refresh progress bar after submission
        setTimeout(() => this.injectDailyProgress(), 2000);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Safety timeout to prevent infinite monitoring
    setTimeout(() => {
      observer.disconnect();
      this.isMonitoring = false;
      this.urlBeforeSubmit = ""; // Reset on timeout as well
      // If submission wasn't accepted, still refresh progress bar
      setTimeout(() => this.injectDailyProgress(), 2000);
    }, 30000);
  }

  private async injectDailyProgress() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "getDailyProgress" });
      if (!response.success) return;

      let container = document.querySelector(".lamigo-daily-progress-container");
      if (!container) {
        container = document.createElement("div");
        container.className = "lamigo-daily-progress-container";
        const fill = document.createElement("div");
        fill.className = "lamigo-daily-progress-fill";
        container.appendChild(fill);
        document.body.appendChild(container);
      }

      const fill = container.querySelector(".lamigo-daily-progress-fill") as HTMLElement;
      if (fill) {
        const percentage = Math.min((response.count / response.goal) * 100, 100);
        fill.style.width = `${percentage}%`;
        fill.title = `L'Amigo: ${response.count}/${response.goal} solved today`;
      }
    } catch (err) {
      console.error("[L'Amigo] Failed to inject progress bar:", err);
    }
  }

  private async injectSolvedByFriends() {
    try {
      const titleSlug = window.location.pathname.split("/")[2];
      if (!titleSlug) return;

      const response = await chrome.runtime.sendMessage({ type: "getProblemSolvers", titleSlug });
      if (!response.success || !response.solvers || response.solvers.length === 0) return;

      const titleEl = await this.waitForElement(
        LeetCodeMonitor.SELECTORS.problemTitle,
        LeetCodeMonitor.SELECTORS.problemTitleFallback
      );

      // Avoid double injection
      if (document.querySelector(".lamigo-solved-badge")) return;

      const badge = document.createElement("div");
      badge.className = "lamigo-solved-badge";
      
      const avatarGroup = document.createElement("div");
      avatarGroup.className = "lamigo-solver-avatars";
      
      response.solvers.slice(0, 3).forEach((s: any) => {
        const img = document.createElement("img");
        img.src = s.avatar || "https://assets.leetcode.com/users/default_avatar.jpg";
        img.className = "lamigo-solver-avatar";
        img.title = s.username;
        avatarGroup.appendChild(img);
      });

      badge.appendChild(avatarGroup);
      
      const text = document.createElement("span");
      const names = response.solvers.slice(0, 2).map((s: any) => s.username).join(", ");
      const others = response.solvers.length > 2 ? ` and ${response.solvers.length - 2} others` : "";
      
      // Get most recent timestamp
      const latestTs = Math.max(...response.solvers.map((s: any) => s.timestamp || 0));
      const timeAgo = this.formatTimeAgo(latestTs);
      
      text.textContent = `Solved by ${names}${others} ${timeAgo}`;
      badge.appendChild(text);

      titleEl.parentElement?.appendChild(badge);
    } catch (err) {
      console.error("[L'Amigo] Failed to inject solved badge:", err);
    }
  }

  private formatTimeAgo(ts: number): string {
    if (!ts) return "";
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "(just now)";
    if (diff < 3600) return `(${Math.floor(diff / 60)}m ago)`;
    if (diff < 86400) return `(${Math.floor(diff / 3600)}h ago)`;
    return `(${Math.floor(diff / 86400)}d ago)`;
  }

  private async handleAccepted() {
    this.injectSyncBadge(); // Show sync badge on acceptance
    const now = Date.now();
    if (now - this.lastSubmissionTime < 5000) return; // debounce
    this.lastSubmissionTime = now;

    const title = (
      document.querySelector(LeetCodeMonitor.SELECTORS.problemTitle) ||
      document.querySelector(LeetCodeMonitor.SELECTORS.problemTitleFallback)
    )?.textContent?.trim();

    const runtimeBeats = document.querySelector(LeetCodeMonitor.SELECTORS.runtimeBeats)?.textContent?.trim();
    const memoryBeats = document.querySelector(LeetCodeMonitor.SELECTORS.memoryBeats)?.textContent?.trim();

    console.log("[L'Amigo] Accepted!", title, { runtimeBeats, memoryBeats });

    chrome.runtime.sendMessage({
        type: "newSubmissionDetected",
        data: { 
          title, 
          timestamp: now, 
          url: window.location.href,
          runtimeBeats,
          memoryBeats
        },
      })
      .then(() => {
        // Wait a bit for sync to start and show badge
        setTimeout(() => this.injectSyncBadge(), 1000);
      })
      .catch(() => {
        /* extension context invalidated */
      });
  }

  private async injectSyncBadge() {
    try {
      const resultEl = document.querySelector(LeetCodeMonitor.SELECTORS.submissionResult) ||
                      document.querySelector(LeetCodeMonitor.SELECTORS.submissionResultFallback);
      
      if (!resultEl || document.querySelector(".lamigo-sync-badge")) return;

      const { github_sync_config } = await chrome.storage.local.get("github_sync_config");
      const repoUrl = github_sync_config?.repoName 
        ? `https://github.com/${github_sync_config.repoName}` 
        : "#";

      const badge = document.createElement("a");
      badge.className = "lamigo-sync-badge";
      badge.href = repoUrl;
      badge.target = "_blank";
      badge.innerHTML = `<span>✓</span> Synced to GitHub`;
      
      resultEl.parentElement?.appendChild(badge);
    } catch (err) {
      console.error("[L'Amigo] Sync badge error:", err);
    }
  }

  private waitForElement(
    selector: string,
    fallbackSelector?: string,
    timeout = 10000,
  ): Promise<Element> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const el =
          document.querySelector(selector) ||
          (fallbackSelector ? document.querySelector(fallbackSelector) : null);
        if (el) return el;
        return null;
      };

      const el = check();
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = check();
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element not found within ${timeout}ms`));
      }, timeout);
    });
  }
}

// Kick off
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new LeetCodeMonitor();
    new ProfilePageManager();
  });
} else {
  new LeetCodeMonitor();
  new ProfilePageManager();
}
