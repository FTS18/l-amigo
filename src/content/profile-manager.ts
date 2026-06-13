/**
 * ProfilePageManager - Handles button injection on LeetCode profile pages.
 * Supports "Track with L'Amigo" and "Compare with Me".
 */
export class ProfilePageManager {
  private static readonly SELECTORS = {
    // Structural landmarks (more stable than tailwind classes)
    avatarImg: 'img[alt="Avatar"]',
    identityContainer: 'div.flex.flex-col.gap-1',
    actionsContainer: 'div.flex.w-full button', // Target the follow button specifically
    sidebarWrapper: 'div[class*="lc-lg:w-"], div[class*="md:w-"]'
  };

  private currentUsername: string | null = null;
  private isInjecting = false;

  constructor() {
    console.log("[L'Amigo] ProfilePageManager initialized");
    this.init();
  }

  private init() {
    this.handleUrlChange();
    this.setupUrlObserver();
  }

  private setupUrlObserver() {
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.handleUrlChange();
      }
    }).observe(document, { subtree: true, childList: true });
  }

  private handleUrlChange() {
    const username = this.extractUsernameFromUrl();
    if (username) {
      this.currentUsername = username;
      this.attemptInjection();
    } else {
      this.currentUsername = null;
      this.removeInjectedButtons();
    }
  }

  private extractUsernameFromUrl(): string | null {
    const path = window.location.pathname;
    // Matches /u/username/ or /username/
    // Exclude /problems/, /explore/, /contest/, etc.
    const excluded = ['/problems', '/explore', '/contest', '/discuss', '/interview', '/store', '/support'];
    if (excluded.some(p => path.startsWith(p))) return null;

    const match = path.match(/^\/(?:u\/)?([a-zA-Z0-9_-]+)\/?$/);
    return match ? match[1] : null;
  }

  private async attemptInjection() {
    if (this.isInjecting) return;
    this.isInjecting = true;

    try {
      // Find the avatar as the most stable landmark
      const avatar = await this.waitForElement([ProfilePageManager.SELECTORS.avatarImg]);
      if (!avatar || !this.currentUsername) return;

      // Climb up to find the sidebar container
      const anchor = avatar.closest('div.flex-col') || avatar.parentElement;
      const sidebar = avatar.closest(ProfilePageManager.SELECTORS.sidebarWrapper) || anchor;

      if (sidebar && this.currentUsername) {
        console.log("[L'Amigo] Landmark found: Avatar. Injecting to sidebar.", this.currentUsername);
        
        const identitiesResult = await chrome.storage.local.get('friend_identities_v2');
        const identities = identitiesResult.friend_identities_v2 || [];
        const isAlreadyTracked = identities.some((i: any) => 
          i.accounts.some((a: any) => 
            a.platform === 'leetcode' && a.handle.toLowerCase() === this.currentUsername?.toLowerCase()
          )
        );

        this.ensureButtonsPersistent(sidebar, isAlreadyTracked);
      }
    } catch (err) {
      console.error("[L'Amigo] Landmark search failed:", err);
    } finally {
      this.isInjecting = false;
    }
  }

  private ensureButtonsPersistent(anchor: Element, isAlreadyTracked: boolean) {
    this.injectButtons(anchor, isAlreadyTracked);

    const observer = new MutationObserver(() => {
      if (!document.getElementById('lamigo-profile-actions') && this.currentUsername) {
        this.injectButtons(anchor, isAlreadyTracked);
      }
    });

    // Observe the main sidebar container
    observer.observe(anchor, { childList: true, subtree: true });
  }

  private injectButtons(anchor: Element, isAlreadyTracked: boolean) {
    if (document.getElementById('lamigo-profile-actions')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'lamigo-profile-actions';
    wrapper.className = 'lamigo-btn-group';

    const trackBtn = document.createElement('button');
    trackBtn.className = `lamigo-btn lamigo-btn-track ${isAlreadyTracked ? 'success' : ''}`;
    trackBtn.disabled = isAlreadyTracked;
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const plusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    trackBtn.innerHTML = isAlreadyTracked ? `${checkIcon} Already Tracked` : `${plusIcon} Track with L'Amigo`;
    trackBtn.onclick = (e) => {
      e.stopPropagation();
      this.handleTrack();
    };

    const compareBtn = document.createElement('button');
    compareBtn.className = 'lamigo-btn lamigo-btn-compare';
    const zapIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
    compareBtn.innerHTML = `${zapIcon} Compare with Me`;
    compareBtn.onclick = (e) => {
      e.stopPropagation();
      this.handleCompare();
    };

    wrapper.appendChild(trackBtn);
    wrapper.appendChild(compareBtn);

    // Prepend to the found landmark area
    anchor.prepend(wrapper);
    console.log("[L'Amigo] Buttons landmark-injected");
  }

  private removeInjectedButtons() {
    const el = document.getElementById('lamigo-profile-actions');
    if (el) el.remove();
  }

  private async handleTrack() {
    if (!this.currentUsername) return;
    const btn = document.querySelector('.lamigo-btn-track') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Adding...';
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'addFriend',
        username: this.currentUsername
      });

      if (response.success) {
        if (btn) {
          const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          btn.innerHTML = `${checkIcon} Tracked`;
          btn.classList.add('success');
        }
      } else {
        alert(`Failed to track: ${response.error || 'Unknown error'}`);
        if (btn) {
          btn.disabled = false;
          const plusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
          btn.innerHTML = `${plusIcon} Track with L'Amigo`;
        }
      }
    } catch (err) {
      console.error('[L\'Amigo] Error adding friend:', err);
    }
  }

  private async handleCompare() {
    if (!this.currentUsername) return;
    
    // Show loading state
    const compareBtn = document.querySelector('.lamigo-btn-compare') as HTMLButtonElement;
    const originalText = compareBtn.innerHTML;
    compareBtn.disabled = true;
    compareBtn.innerHTML = 'Loading stats...';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getOwnProfile' });
      if (!response.success || !response.data) {
        alert('Please configure your own username in L\'Amigo extension first!');
        return;
      }

      const ownProfile = response.data.profile;
      const ownUsername = response.data.username;

      // Fetch target profile (we do this via background to get same data structure)
      // Actually, we can just use the background sync to fetch it
      // For now, let's just use the data we can get or trigger a fetch
      
      this.showComparisonOverlay(ownUsername, ownProfile, this.currentUsername);
    } catch (err) {
      console.error('[L\'Amigo] Error starting comparison:', err);
    } finally {
      compareBtn.disabled = false;
      compareBtn.innerHTML = originalText;
    }
  }

  private showComparisonOverlay(ownUsername: string, ownProfile: any, targetUsername: string) {
    const overlay = document.createElement('div');
    overlay.id = 'lamigo-compare-overlay';
    overlay.innerHTML = `
      <div class="lamigo-compare-modal">
        <div class="lamigo-compare-header">
          <h3>Squad Comparison</h3>
          <button id="close-lamigo-compare">×</button>
        </div>
        <div class="lamigo-compare-body">
          <div class="compare-col own-col">
            <p class="loading-msg">Loading your stats...</p>
          </div>
          <div class="compare-vs">VS</div>
          <div class="compare-col target-col">
            <p class="loading-msg">Fetching ${targetUsername}...</p>
          </div>
        </div>
        <div class="lamigo-compare-footer">
          <p>L'Amigo • Deep Analytics & Friends Progress</p>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('close-lamigo-compare')?.addEventListener('click', () => {
      overlay.remove();
    });

    // Render own stats immediately
    this.updateComparisonCol(ownUsername, ownProfile, overlay);

    // Fetch and render target profile
    this.fetchTargetStats(targetUsername, overlay);
  }

  private async fetchTargetStats(username: string, overlay: HTMLElement) {
    try {
      // 1. Check if we already have a reasonably fresh profile in cache
      const cachedProfile = await this.getProfile(username);
      if (cachedProfile && (Date.now() - (cachedProfile.lastFetched || 0)) < 300000) { // 5 min cache
        this.updateComparisonCol(username, cachedProfile, overlay);
        return;
      }

      // 2. Otherwise, fetch JUST this profile (much faster than refreshAll)
      const response = await chrome.runtime.sendMessage({
        action: 'fetchProfile',
        username: username
      });
      
      if (response.success && response.data) {
        this.updateComparisonCol(username, response.data, overlay);
      } else {
        const targetCol = overlay.querySelector('.target-col');
        if (targetCol) targetCol.innerHTML = `<h4 class="col-title">${username}</h4><p class="loading-msg error">User not found or private.</p>`;
      }
    } catch (err) {
      console.error('[L\'Amigo] Failed to fetch target stats:', err);
    }
  }

  private updateComparisonCol(username: string, profile: any, overlay: HTMLElement) {
    const targetCol = overlay.querySelector(username === this.currentUsername ? '.target-col' : '.own-col');
    if (!targetCol) return;

    // Sort topics by solved count and take top 5
    const topTopics = (profile.topicStats || [])
      .sort((a: any, b: any) => b.problemsSolved - a.problemsSolved)
      .slice(0, 5);

    targetCol.innerHTML = `
      <h4 class="col-title">${username} ${username !== this.currentUsername ? '(You)' : ''}</h4>
      
      <div class="stat-section">
        <div class="section-label">Solved Problems</div>
        <div class="compare-stat-row">
          <span class="stat-label">Total</span>
          <span class="stat-value">${profile.problemsSolved?.total || 0}</span>
        </div>
        <div class="compare-stat-row">
          <span class="stat-label">Easy</span>
          <span class="stat-value text-easy">${profile.problemsSolved?.easy || 0}</span>
        </div>
        <div class="compare-stat-row">
          <span class="stat-label">Medium</span>
          <span class="stat-value text-medium">${profile.problemsSolved?.medium || 0}</span>
        </div>
        <div class="compare-stat-row">
          <span class="stat-label">Hard</span>
          <span class="stat-value text-hard">${profile.problemsSolved?.hard || 0}</span>
        </div>
      </div>

      <div class="stat-section">
        <div class="section-label">Contest Performance</div>
        <div class="contest-block">
          <div class="stat-label">Rating</div>
          <div class="rating-val">${Math.floor(profile.contestRating || 0)}</div>
        </div>
        <div class="compare-stat-row">
          <span class="stat-label">Global Rank</span>
          <span class="stat-value">#${profile.contestRanking?.toLocaleString() || profile.ranking?.toLocaleString() || 'N/A'}</span>
        </div>
      </div>

      <div class="stat-section">
        <div class="section-label">Top Skills</div>
        <div class="topic-list">
          ${topTopics.map((t: any) => `
            <div class="topic-chip">${t.topicName}<b>${t.problemsSolved}</b></div>
          `).join('')}
          ${topTopics.length === 0 ? '<div class="stat-label">No topic data available</div>' : ''}
        </div>
      </div>
    `;
  }

  private async getProfile(username: string): Promise<any> {
    const key = `profile:v2:leetcode:${username.toLowerCase()}`;
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  private waitForElement(selectors: string[], timeout = 10000): Promise<Element | null> {
    return new Promise((resolve) => {
      const check = () => {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el) return el;
        }
        return null;
      };

      const existing = check();
      if (existing) return resolve(existing);

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
        resolve(null);
      }, timeout);
    });
  }
}
