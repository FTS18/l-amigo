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

    if (__DEV__) {
      console.log(
        "[L'Amigo] Monitoring submissions on",
        window.location.pathname,
      );
    }
    try {
      await this.waitForElement(
        LeetCodeMonitor.SELECTORS.submitButton,
        LeetCodeMonitor.SELECTORS.submitButtonFallback,
      );
      this.setupSubmitListener();
      this.setupUrlChangeDetection();
      this.injectDailyProgress();
      this.injectSolvedByFriends();
      this.injectCompanyTags();
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
        if (currentUrl.includes("/problems/")) {
          setTimeout(() => {
            document.querySelector(".lamigo-company-tags-container")?.remove();
            this.injectCompanyTags();
            this.injectSolvedByFriends();
          }, 1200);
        }
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
      if (__DEV__) {
        console.error("[L'Amigo] Failed to check submission page:", err);
      }
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
      if (__DEV__) {
        console.error("[L'Amigo] Failed to inject progress bar:", err);
      }
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
      if (__DEV__) {
        console.error("[L'Amigo] Failed to inject solved badge:", err);
      }
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

  private static companyTagsCache: Record<string, string[]> | null = null;

  private async findProblemTitleElement(): Promise<Element | null> {
    const candidateSelectors = [
      LeetCodeMonitor.SELECTORS.problemTitle,
      'div.text-title-large',
      '[data-track-load="description_content"] div.text-title-large',
      '[data-track-load="description_content"] div.flex',
      '[data-track-load="description_content"] h4',
      'div[class*="text-title"]',
      LeetCodeMonitor.SELECTORS.problemTitleFallback,
    ];
    for (const sel of candidateSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    try {
      return await this.waitForElement(
        LeetCodeMonitor.SELECTORS.problemTitle,
        'div.text-title-large',
        4000
      );
    } catch {
      return null;
    }
  }

  private async injectCompanyTags() {
    try {
      const match = window.location.pathname.match(/\/problems\/([a-z0-9\-]+)/i);
      const titleSlug = match?.[1]?.toLowerCase();
      if (!titleSlug) return;

      const titleEl = await this.findProblemTitleElement();
      if (!titleEl) return;

      if (document.querySelector(".lamigo-company-tags-container")) return;

      if (!LeetCodeMonitor.companyTagsCache) {
        try {
          const url = chrome.runtime.getURL("data/company_tags.json");
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            LeetCodeMonitor.companyTagsCache = data.problems || {};
          }
        } catch (e) {
          console.warn("[L'Amigo] Failed to load company tags dataset:", e);
        }
      }

      const companies = LeetCodeMonitor.companyTagsCache?.[titleSlug] || [];
      if (companies.length === 0) return;

      const container = document.createElement("div");
      container.className = "lamigo-company-tags-container";

      const label = document.createElement("span");
      label.className = "lamigo-company-label";
      label.textContent = "🏢 Asked in:";
      container.appendChild(label);

      companies.forEach((comp) => {
        const badge = document.createElement("span");
        badge.className = "lamigo-company-badge";
        badge.textContent = comp;
        container.appendChild(badge);
      });

      titleEl.parentElement?.appendChild(container);
    } catch (err) {
      if (__DEV__) {
        console.warn("[L'Amigo] Failed to inject company tags:", err);
      }
    }
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

    if (__DEV__) {
      console.log("[L'Amigo] Accepted!", title, { runtimeBeats, memoryBeats });
    }

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
      badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Synced to GitHub`;
      
      resultEl.parentElement?.appendChild(badge);
    } catch (err) {
      if (__DEV__) {
        console.error("[L'Amigo] Sync badge error:", err);
      }
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

// Add global message listener for background notifications (e.g. sync toasts)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "showSyncToast") {
    const existing = document.querySelector(".lamigo-toast");
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");
    toast.className = "lamigo-toast";
    
    const icon = document.createElement("span");
    icon.className = "lamigo-toast-success-icon";
    icon.textContent = "";
    
    const text = document.createElement("span");
    text.textContent = message.message;
    
    toast.appendChild(icon);
    toast.appendChild(text);

    if (message.url) {
      const link = document.createElement("a");
      link.href = message.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "lamigo-toast-link";
      link.textContent = message.linkText || "View on GitHub ↗";
      toast.appendChild(link);
    }

    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 6500);
  }
});

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
