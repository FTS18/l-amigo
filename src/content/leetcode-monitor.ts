/**
 * LeetCode Content Script – Real-time Submission Monitor
 *
 * Watches for "Accepted" results on problem pages and notifies
 * the background service-worker to trigger an immediate sync.
 *
 * NO DOM scraping – all data fetching is done via GraphQL in the background.
 */

class LeetCodeMonitor {
  private static readonly SELECTORS = {
    submitButton: '[data-e2e-locator="console-submit-button"]',
    submitButtonFallback: 'button[data-cy="submit-code-btn"]',
    submissionResult: '[data-e2e-locator="submission-result"]',
    submissionResultFallback: ".result-state",
    problemTitle: '[data-cy="question-title"]',
    problemTitleFallback: 'a[href*="/problems/"] span.text-title',
  };

  private isMonitoring = false;
  private lastSubmissionTime = 0;
  private urlBeforeSubmit = "";

  constructor() {
    this.init();
  }

  private async init() {
    // Only activate on problem pages
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
    } catch {
      // Submit button not found – not a solvable problem page
    }
  }

  private setupSubmitListener() {
    const btn =
      document.querySelector(LeetCodeMonitor.SELECTORS.submitButton) ||
      document.querySelector(LeetCodeMonitor.SELECTORS.submitButtonFallback);
    if (!btn) return;
    btn.addEventListener("click", () => this.handleSubmit());
  }

  private setupUrlChangeDetection() {
    // Fallback: detect navigation to /submissions/ page after submit
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

    try {
      await this.waitForElement(
        LeetCodeMonitor.SELECTORS.submissionResult,
        LeetCodeMonitor.SELECTORS.submissionResultFallback,
        30000,
      );
      const result =
        document.querySelector(LeetCodeMonitor.SELECTORS.submissionResult) ||
        document.querySelector(
          LeetCodeMonitor.SELECTORS.submissionResultFallback,
        );
      const text = result?.textContent?.trim();

      if (text === "Accepted" || text?.toLowerCase().includes("accepted")) {
        this.handleAccepted();
      }
    } catch (err) {
      console.error("[L'Amigo] Monitor error:", err);
    } finally {
      this.isMonitoring = false;
      this.urlBeforeSubmit = "";
    }
  }

  private handleAccepted() {
    const now = Date.now();
    if (now - this.lastSubmissionTime < 5000) return; // debounce
    this.lastSubmissionTime = now;

    const title = (
      document.querySelector(LeetCodeMonitor.SELECTORS.problemTitle) ||
      document.querySelector(LeetCodeMonitor.SELECTORS.problemTitleFallback)
    )?.textContent?.trim();

    console.log("[L'Amigo] Accepted!", title);

    chrome.runtime
      .sendMessage({
        type: "newSubmissionDetected",
        data: { title, timestamp: now, url: window.location.href },
      })
      .catch(() => {
        /* extension context invalidated */
      });
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
  document.addEventListener("DOMContentLoaded", () => new LeetCodeMonitor());
} else {
  new LeetCodeMonitor();
}
