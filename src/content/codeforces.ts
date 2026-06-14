import './codeforces.css';

chrome.storage.local.get(['cf_dark_mode'], (result) => {
  if (result.cf_dark_mode) {
    document.documentElement.classList.add('lamigo-cf-dark');
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.cf_dark_mode) {
    if (changes.cf_dark_mode.newValue) {
      document.documentElement.classList.add('lamigo-cf-dark');
    } else {
      document.documentElement.classList.remove('lamigo-cf-dark');
    }
  }
});

// Inject quick add button
function injectAddButtons() {
  const userLinks = document.querySelectorAll<HTMLAnchorElement>('a[href^="/profile/"]:not(.lamigo-processed)');
  if (userLinks.length === 0) return;

  userLinks.forEach(link => link.classList.add('lamigo-processed'));
  
  chrome.storage.local.get(['friend_identities_v2', 'friends'], (result) => {
    const friendUsernames = new Set<string>();
    const list = result.friend_identities_v2 || result.friends || [];
    list.forEach((f: any) => {
      if (f.username) friendUsernames.add(f.username.toLowerCase());
      if (f.displayName) friendUsernames.add(f.displayName.toLowerCase());
      if (Array.isArray(f.aliases)) {
        f.aliases.forEach((a: string) => friendUsernames.add(a.toLowerCase()));
      }
      if (Array.isArray(f.accounts)) {
        f.accounts.forEach((a: any) => {
          if (a.handle) friendUsernames.add(a.handle.toLowerCase());
        });
      }
    });

    userLinks.forEach(link => {
      const href = link.href;
      if (!href) return;
      
      let username = '';
      try {
        const url = new URL(href);
        const parts = url.pathname.split('/');
        if (parts[1] === 'profile' && parts[2]) {
          username = decodeURIComponent(parts[2]);
        }
      } catch (e) {
        username = link.getAttribute('href')?.replace('/profile/', '').split('/')[0] || '';
      }
      
      if (!username || username.trim() === '') return;
      if (friendUsernames.has(username.toLowerCase())) return;

      const btn = document.createElement('button');
      btn.className = 'lamigo-add-btn';
      btn.title = "Add to L'Amigo";
      btn.innerHTML = '+';
      
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.disabled = true;
        btn.innerHTML = '...';
        
        chrome.runtime.sendMessage({
          action: 'createIdentity',
          payload: {
            displayName: username,
            accounts: [{ platform: 'codeforces', handle: username }]
          }
        }, (response) => {
          if (response && response.success) {
            btn.innerHTML = '✓';
            btn.classList.add('lamigo-success');
            friendUsernames.add(username.toLowerCase());
            setTimeout(() => { btn.remove(); }, 2000);
          } else {
            btn.innerHTML = '+';
            btn.disabled = false;
            alert(response?.error || 'Failed to add friend');
          }
        });
      });
      
      link.insertAdjacentElement('afterend', btn);
    });
  });
}

// --- College Standings Feature ---

function injectBookmarkButton() {
  if (!window.location.pathname.startsWith('/ratings/organization/')) return;
  
  const match = window.location.pathname.match(/\/ratings\/organization\/(\d+)/);
  if (!match) return;
  const orgId = match[1];

  const select = document.querySelector<HTMLSelectElement>('select[name="organizationId"]');
  if (document.querySelector('.lamigo-bookmark-btn')) return;

  let orgName = '';
  if (select && select.value === orgId) {
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) orgName = selectedOption.text.trim();
  }

  if (!orgName) {
    const titleEl = document.querySelector('.title, h1, h2, h3');
    if (titleEl) {
      const text = titleEl.textContent || '';
      orgName = text.includes('Ratings of members of')
        ? text.replace('Ratings of members of', '').trim()
        : text.trim();
    }
  }

  if (!orgName) {
    const docTitle = document.title;
    if (docTitle.includes('Ratings of members of')) {
      orgName = docTitle.replace('Ratings of members of', '').split('-')[0].trim();
    }
  }

  if (!orgName) orgName = `Organization ${orgId}`;

  const btn = document.createElement('button');
  btn.className = 'lamigo-bookmark-btn';
  
  let isBookmarked = false;

  const updateBtnUI = () => {
    if (isBookmarked) {
      btn.innerHTML = '★ Unbookmark';
      btn.classList.add('bookmarked');
      btn.title = `Unbookmark ${orgName}`;
    } else {
      btn.innerHTML = '☆ Bookmark';
      btn.classList.remove('bookmarked');
      btn.title = `Bookmark ${orgName} for College Standings`;
    }
  };

  chrome.storage.local.get(['cf_bookmarked_org_id'], (res) => {
    isBookmarked = (res.cf_bookmarked_org_id === orgId);
    updateBtnUI();
  });

  const extractHandle = (href: string | null): string => {
    if (!href) return '';
    const parts = href.split('/profile/');
    if (parts.length < 2) return '';
    return parts[1].split('/')[0].split('?')[0].split('#')[0].trim();
  };

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isBookmarked) {
      chrome.storage.local.remove(['cf_bookmarked_org', 'cf_bookmarked_org_id', 'cf_bookmarked_org_members'], () => {
        isBookmarked = false;
        updateBtnUI();
      });
    } else {
      btn.innerText = 'Caching...';
      btn.disabled = true;

      const membersMap = new Map<string, { handle: string; ratingClass: string }>();
      document.querySelectorAll('.datatable a[href^="/profile/"]').forEach(el => {
        const handle = extractHandle(el.getAttribute('href'));
        if (handle) {
          const ratingClass = Array.from(el.classList).find(c => c.startsWith('user-')) || 'user-gray';
          membersMap.set(handle.toLowerCase(), { handle, ratingClass });
        }
      });

      try {
        const page2Res = await fetch(`/ratings/organization/${orgId}/page/2`);
        if (page2Res.ok) {
          const page2Text = await page2Res.text();
          if (page2Text) {
            const pageDoc = new DOMParser().parseFromString(page2Text, 'text/html');
            pageDoc.querySelectorAll('.datatable a[href^="/profile/"]').forEach(el => {
              const handle = extractHandle(el.getAttribute('href'));
              if (handle) {
                const ratingClass = Array.from(el.classList).find(c => c.startsWith('user-')) || 'user-gray';
                membersMap.set(handle.toLowerCase(), { handle, ratingClass });
              }
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch page 2", err);
      }

      const membersList = Array.from(membersMap.values());
      chrome.storage.local.set({ 
        cf_bookmarked_org: orgName,
        cf_bookmarked_org_id: orgId,
        cf_bookmarked_org_members: membersList
      }, () => {
        isBookmarked = true;
        btn.disabled = false;
        updateBtnUI();
      });
    }
  });

  if (select) {
    select.parentNode?.insertBefore(btn, select.nextSibling);
  } else {
    const titleEl = document.querySelector('.title');
    if (titleEl) titleEl.appendChild(btn);
  }
}

// Per-session standings cache: contestId -> filtered rows + problems
const _standingsCache: Record<string, { problems: any[]; filteredRows: any[] }> = {};

function injectCollegeStandingsTab() {
  if (!window.location.pathname.includes('/standings')) return;

  const menuList = document.querySelector<HTMLUListElement>('ul.second-level-menu-list');
  if (!menuList) return;

  // FIX: check live DOM, not a stale reference — CF AJAX destroys and recreates the menu
  if (menuList.querySelector('.lamigo-college-tab-li')) return;

  const li = document.createElement('li');
  li.className = 'lamigo-college-tab-li';
  li.style.display = 'none';
  menuList.appendChild(li);

  chrome.storage.local.get(['cf_bookmarked_org', 'cf_bookmarked_org_id', 'cf_bookmarked_org_members'], (res) => {
    const orgName = res.cf_bookmarked_org;
    const orgId = res.cf_bookmarked_org_id;
    let cachedMembers = res.cf_bookmarked_org_members || [];

    if (!orgName || !orgId) {
      li.remove();
      return;
    }

    li.style.display = '';
    
    const a = document.createElement('a');
    a.href = '#';
    a.innerText = 'COLLEGE STANDINGS';

    const extractHandle = (href: string | null): string => {
      if (!href) return '';
      const parts = href.split('/profile/');
      if (parts.length < 2) return '';
      return parts[1].split('/')[0].split('?')[0].split('#')[0].trim();
    };

    a.addEventListener('click', async (e) => {
      e?.preventDefault();

      if (window.location.hash !== '#college-standings') {
        window.history.pushState(null, '', window.location.pathname + '#college-standings');
      }

      // Highlight tab immediately on click
      document.querySelectorAll('.second-level-menu-list li').forEach(el => el.classList.remove('current'));
      li.classList.add('current');

      a.innerText = 'LOADING...';

      const contestIdMatch = window.location.pathname.match(/\/contest\/(\d+)\/standings/);
      if (!contestIdMatch) {
        a.innerText = 'COLLEGE STANDINGS';
        return;
      }
      const contestId = contestIdMatch[1];

      // --- CACHE HIT: instant render ---
      if (_standingsCache[contestId]) {
        renderStandings(_standingsCache[contestId].problems, _standingsCache[contestId].filteredRows, cachedMembers, orgName, orgId, a, li);
        return;
      }

      // Fallback: if cachedMembers is empty, try to scrape org page
      if (cachedMembers.length === 0) {
        try {
          const membersMap = new Map<string, { handle: string; ratingClass: string }>();
          const response = await fetch(`/ratings/organization/${orgId}`);
          if (response.ok) {
            const text = await response.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            doc.querySelectorAll('.datatable a[href^="/profile/"]').forEach(el => {
              const handle = extractHandle(el.getAttribute('href'));
              if (handle) {
                const ratingClass = Array.from(el.classList).find(c => c.startsWith('user-')) || 'user-gray';
                membersMap.set(handle.toLowerCase(), { handle, ratingClass });
              }
            });
            cachedMembers = Array.from(membersMap.values());
            if (cachedMembers.length > 0) {
              chrome.storage.local.set({ cf_bookmarked_org_members: cachedMembers });
            }
          }
        } catch (err) {
          console.error("Failed fallback scrape", err);
        }
      }

      if (cachedMembers.length === 0) {
        const datatable = document.querySelector('.datatable');
        if (datatable) {
          datatable.innerHTML = buildErrorHtml(
            'No cached college members found!',
            `To display your college standings, visit your organization's ratings page and click <strong>★ Bookmark</strong> to cache members.`,
            orgId, orgName
          );
        }
        a.innerText = 'COLLEGE STANDINGS';
        return;
      }

      a.innerText = 'FETCHING...';

      try {
        // CF only allows contestId (no handles param for non-gym contests).
        // from=1 & count=5000 keeps the response payload small vs full default.
        const apiRes = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=5000`);
        const apiData = await apiRes.json();

        if (apiData.status !== 'OK') {
          a.innerText = 'COLLEGE STANDINGS';
          console.error('CF API error:', apiData.comment);
          return;
        }

        a.innerText = 'FILTERING...';

        const problems = apiData.result.problems;
        const allRows = apiData.result.rows;

        // Build O(1) lookup set
        const memberHandles = new Set<string>();
        for (const m of cachedMembers) memberHandles.add(m.handle.toLowerCase());

        const filteredRows = allRows.filter((row: any) =>
          row.party.members.some((m: any) => memberHandles.has(m.handle.toLowerCase()))
        );

        // Cache so switching tabs → back is instant
        _standingsCache[contestId] = { problems, filteredRows };

        renderStandings(problems, filteredRows, cachedMembers, orgName, orgId, a, li);
      } catch (err: any) {
        console.error("Standings error", err);
        a.innerText = 'COLLEGE STANDINGS';
      }
    });

    li.appendChild(a);

    // Auto-trigger on hash
    const shouldAutoTrigger = window.location.hash === '#college-standings' || window.location.search.includes('college=true');
    if (shouldAutoTrigger && !(window as any)._lamigoCollegeTriggered) {
      (window as any)._lamigoCollegeTriggered = true;
      setTimeout(() => { a.click(); }, 150);
    }
  });
}

function buildErrorHtml(title: string, body: string, orgId: string, orgName: string): string {
  return `
    <div style="padding:24px;text-align:center;margin:15px 0;">
      <h3 style="margin:0 0 10px 0;">${title}</h3>
      <p style="margin:0 0 15px 0;font-size:13px;line-height:1.4;">${body}</p>
      <a href="/ratings/organization/${orgId}" style="display:inline-block;padding:6px 14px;background:#3b5998;color:#fff;text-decoration:none;font-weight:bold;font-size:12px;">
        Go to ${orgName} Ratings Page
      </a>
    </div>`;
}

function renderStandings(
  problems: any[],
  filteredRows: any[],
  cachedMembers: any[],
  orgName: string,
  orgId: string,
  a: HTMLAnchorElement,
  li: HTMLLIElement
) {
  const membersLookup: Record<string, { handle: string; ratingClass: string }> = {};
  for (const m of cachedMembers) membersLookup[m.handle.toLowerCase()] = m;

  if (filteredRows.length === 0) {
    const datatable = document.querySelector('.datatable');
    if (datatable) {
      datatable.innerHTML = buildErrorHtml(
        'No college members participated in this contest',
        `None of the ${cachedMembers.length} cached members from <strong>${orgName}</strong> appear in the standings.`,
        orgId, orgName
      );
    }
    a.innerText = 'COLLEGE STANDINGS';
    return;
  }

  // Build table matching CF's native standings markup exactly
  let html = '<div style="overflow-x:auto;"><table class="standings"><thead><tr>';
  html += '<th class="top-pagination-box" style="width:2em;">#</th>';
  html += '<th style="width:12em;">Who</th>';
  html += '<th style="width:2.5em;">=</th>';
  html += '<th style="width:3em;">Penalty</th>';
  for (const p of problems) {
    html += `<th><a title="${p.name}">${p.index}</a></th>`;
  }
  html += '</tr></thead><tbody>';

  let isDark = false;
  let rank = 1;
  for (const row of filteredRows) {
    const trClass = isDark ? 'dark' : '';
    isDark = !isDark;
    html += `<tr class="${trClass}">`;
    html += `<td>${rank++}</td>`;
    
    const memberLinks = row.party.members.map((m: any) => {
      const lower = m.handle.toLowerCase();
      const info = membersLookup[lower] || { handle: m.handle, ratingClass: 'user-gray' };
      if (info.ratingClass === 'user-legendary') {
        return `<a href="/profile/${info.handle}" class="rated-user user-legendary"><span class="legendary-first-letter">${info.handle[0]}</span>${info.handle.slice(1)}</a>`;
      }
      return `<a href="/profile/${info.handle}" class="rated-user ${info.ratingClass}">${info.handle}</a>`;
    });

    html += `<td class="contestant-cell">${row.party.teamName || memberLinks.join(', ')}</td>`;
    html += `<td>${row.points}</td>`;
    html += `<td>${row.penalty}</td>`;
    
    for (const pr of row.problemResults) {
      let cell = '';
      if (pr.points > 0) {
        const tries = pr.rejectedAttemptCount > 0 ? pr.rejectedAttemptCount : '';
        cell = `<span class="verdict-accepted">+${tries}</span>`;
        if (pr.bestSubmissionTimeSeconds) {
          const h = Math.floor(pr.bestSubmissionTimeSeconds / 3600).toString().padStart(2, '0');
          const m = Math.floor((pr.bestSubmissionTimeSeconds % 3600) / 60).toString().padStart(2, '0');
          cell += `<br><span class="cell-time">${h}:${m}</span>`;
        }
      } else if (pr.rejectedAttemptCount > 0) {
        cell = `<span class="verdict-rejected">-${pr.rejectedAttemptCount}</span>`;
      }
      html += `<td style="text-align:center;">${cell}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';

  const datatable = document.querySelector('.datatable');
  if (datatable) {
    datatable.innerHTML = html;
    document.querySelectorAll('.pagination').forEach(el => el.remove());
  }
  a.innerText = 'COLLEGE STANDINGS';
}

function injectProfileBookmarkButton() {
  if (!window.location.pathname.startsWith('/profile/')) return;

  const orgLink = document.querySelector<HTMLAnchorElement>('a[href*="/ratings/organization/"]');
  if (!orgLink) return;

  // Prevent double injection
  if (orgLink.parentNode?.querySelector('.lamigo-profile-bookmark-btn')) return;

  const match = orgLink.getAttribute('href')?.match(/\/ratings\/organization\/(\d+)/);
  if (!match) return;
  const orgId = match[1];
  const orgName = orgLink.textContent?.trim() || `Organization ${orgId}`;

  const btn = document.createElement('button');
  btn.className = 'lamigo-bookmark-btn-sm lamigo-profile-bookmark-btn';
  
  let isBookmarked = false;

  const updateBtnUI = () => {
    if (isBookmarked) {
      btn.innerHTML = '★ Unbookmark';
      btn.classList.add('bookmarked');
      btn.title = `Unbookmark ${orgName}`;
    } else {
      btn.innerHTML = '☆ Bookmark';
      btn.classList.remove('bookmarked');
      btn.title = `Bookmark ${orgName} for College Standings`;
    }
  };

  chrome.storage.local.get(['cf_bookmarked_org_id'], (res) => {
    isBookmarked = (res.cf_bookmarked_org_id === orgId);
    updateBtnUI();
  });

  const extractHandle = (href: string | null): string => {
    if (!href) return '';
    const parts = href.split('/profile/');
    if (parts.length < 2) return '';
    return parts[1].split('/')[0].split('?')[0].split('#')[0].trim();
  };

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isBookmarked) {
      chrome.storage.local.remove(['cf_bookmarked_org', 'cf_bookmarked_org_id', 'cf_bookmarked_org_members'], () => {
        isBookmarked = false;
        updateBtnUI();
      });
    } else {
      btn.innerText = 'Caching...';
      btn.disabled = true;

      const membersMap = new Map<string, { handle: string; ratingClass: string }>();

      const scrapePage = async (url: string) => {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const text = await res.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            doc.querySelectorAll('.datatable a[href^="/profile/"]').forEach(el => {
              const handle = extractHandle(el.getAttribute('href'));
              if (handle) {
                const ratingClass = Array.from(el.classList).find(c => c.startsWith('user-')) || 'user-gray';
                membersMap.set(handle.toLowerCase(), { handle, ratingClass });
              }
            });
          }
        } catch (err) {
          console.error(`Failed to scrape ${url}`, err);
        }
      };

      // Fetch page 1 and 2 of the org ratings
      await Promise.all([
        scrapePage(`/ratings/organization/${orgId}`),
        scrapePage(`/ratings/organization/${orgId}/page/2`)
      ]);

      const membersList = Array.from(membersMap.values());
      chrome.storage.local.set({ 
        cf_bookmarked_org: orgName,
        cf_bookmarked_org_id: orgId,
        cf_bookmarked_org_members: membersList
      }, () => {
        isBookmarked = true;
        btn.disabled = false;
        updateBtnUI();
      });
    }
  });

  orgLink.insertAdjacentElement('afterend', btn);
}

interface CFSubmission {
  creationTimeSeconds: number;
  verdict: string;
  problem: {
    rating?: number;
  };
}

let cachedSubmissions: CFSubmission[] | null = null;
let currentHandle: string = '';
let fetchPromise: Promise<CFSubmission[]> | null = null;
const originalColors = new Map<string, string>();
let maxRatingByDate = new Map<string, number>();
let isFetching = false;

function getRatingColor(rating: number): string {
  if (rating < 1200) return '#888888'; // Gray (Newbie)
  if (rating < 1400) return '#008000'; // Green (Pupil)
  if (rating < 1600) return '#03a89e'; // Cyan (Specialist)
  if (rating < 1900) return '#0000ff'; // Blue (Expert)
  if (rating < 2100) return '#aa00aa'; // Purple (Candidate Master)
  if (rating < 2400) return '#ff8c00'; // Orange (Master)
  return '#ff0000'; // Red (Grandmaster+)
}

async function fetchSubmissions(handle: string): Promise<CFSubmission[]> {
  if (currentHandle === handle && cachedSubmissions) {
    return cachedSubmissions;
  }
  if (currentHandle === handle && fetchPromise) {
    return fetchPromise;
  }
  
  currentHandle = handle;
  fetchPromise = (async () => {
    isFetching = true;
    try {
      const response = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      if (data.status === 'OK') {
        cachedSubmissions = data.result;
        return data.result;
      } else {
        throw new Error(data.comment || 'API returned failure');
      }
    } catch (e) {
      console.error('Lamigo Error fetching submissions:', e);
      cachedSubmissions = [];
      return [];
    } finally {
      isFetching = false;
    }
  })();
  
  return fetchPromise;
}

function calculateRatingsByDate(submissions: CFSubmission[]) {
  const map = new Map<string, number>();
  for (const sub of submissions) {
    if (sub.verdict !== 'OK') continue;
    
    const date = new Date(sub.creationTimeSeconds * 1000);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${month}/${day}/${year}`;
    
    const rating = sub.problem.rating || 0;
    const currentMax = map.get(dateStr);
    if (currentMax === undefined || rating > currentMax) {
      map.set(dateStr, rating);
    }
  }
  return map;
}

async function updateHeatmap(useRating: boolean, handle: string) {
  const rects = document.querySelectorAll<SVGRectElement>('#userActivityGraph svg rect.day');
  const legend = document.querySelector<HTMLDivElement>('.lamigo-heatmap-legend');
  const toggleText = document.querySelector<HTMLSpanElement>('.lamigo-heatmap-toggle-text');

  if (rects.length === 0) return;

  if (!useRating) {
    if (legend) legend.style.display = 'none';
    if (toggleText) toggleText.innerText = 'Rating-based Heatmap';
    
    rects.forEach(rect => {
      if (rect.hasAttribute('data-lamigo-colored')) {
        const dateStr = rect.getAttribute('data-date');
        if (dateStr) {
          const orig = originalColors.get(dateStr) || '#ebedf0';
          if (rect.getAttribute('fill') !== orig) {
            rect.setAttribute('fill', orig);
          }
        }
        rect.removeAttribute('data-lamigo-colored');
      }
    });
    return;
  }

  if (legend) legend.style.display = 'flex';

  if (!cachedSubmissions && !isFetching) {
    if (toggleText) toggleText.innerText = 'Loading submissions...';
    try {
      const subs = await fetchSubmissions(handle);
      maxRatingByDate = calculateRatingsByDate(subs);
      if (toggleText) toggleText.innerText = 'Rating-based Heatmap';
    } catch (err) {
      if (toggleText) toggleText.innerText = 'Error loading rating heatmap';
      console.error(err);
      return;
    }
  } else if (isFetching) {
    if (toggleText) toggleText.innerText = 'Loading submissions...';
    try {
      const subs = await fetchPromise;
      if (subs) {
        maxRatingByDate = calculateRatingsByDate(subs);
      }
      if (toggleText) toggleText.innerText = 'Rating-based Heatmap';
    } catch (err) {
      if (toggleText) toggleText.innerText = 'Error loading rating heatmap';
      console.error(err);
      return;
    }
  }

  rects.forEach(rect => {
    const dateStr = rect.getAttribute('data-date');
    if (!dateStr) return;

    if (!rect.hasAttribute('data-lamigo-colored')) {
      const currentFill = rect.getAttribute('fill') || '#ebedf0';
      const lowerFill = currentFill.toLowerCase();
      const ratingColorsList = ['#888888', '#008000', '#03a89e', '#0000ff', '#aa00aa', '#ff8c00', '#ff0000'];
      if (!ratingColorsList.includes(lowerFill)) {
        originalColors.set(dateStr, currentFill);
      }
      rect.setAttribute('data-lamigo-colored', 'true');
    }

    if (maxRatingByDate.has(dateStr)) {
      const maxRating = maxRatingByDate.get(dateStr)!;
      const targetColor = getRatingColor(maxRating);
      if (rect.getAttribute('fill') !== targetColor) {
        rect.setAttribute('fill', targetColor);
      }
    } else {
      if (rect.getAttribute('fill') !== '#ebedf0') {
        rect.setAttribute('fill', '#ebedf0');
      }
    }
  });
}

function injectRatingHeatmap() {
  if (!window.location.pathname.startsWith('/profile/')) return;
  
  const header = document.querySelector<HTMLDivElement>('._UserActivityFrame_header');
  const graph = document.querySelector<HTMLDivElement>('#userActivityGraph');
  if (!header || !graph) return;

  const match = window.location.pathname.match(/\/profile\/([^/]+)/);
  if (!match) return;
  const handle = match[1];

  if (handle !== currentHandle) {
    cachedSubmissions = null;
    fetchPromise = null;
    maxRatingByDate.clear();
    originalColors.clear();
    currentHandle = handle;
  }

  if (header.querySelector('.lamigo-heatmap-toggle-container')) {
    chrome.storage.local.get(['cf_heatmap_rating_enabled'], (res) => {
      const enabled = !!res.cf_heatmap_rating_enabled;
      updateHeatmap(enabled, handle);
    });
    return;
  }

  const container = document.createElement('div');
  container.className = 'lamigo-heatmap-toggle-container';

  const label = document.createElement('label');
  label.className = 'lamigo-heatmap-toggle-label';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'lamigo-heatmap-rating-toggle';

  const labelText = document.createElement('span');
  labelText.innerText = 'Rating-based Heatmap';
  labelText.className = 'lamigo-heatmap-toggle-text';

  label.appendChild(checkbox);
  label.appendChild(labelText);
  container.appendChild(label);

  header.appendChild(container);

  let legend = document.querySelector<HTMLDivElement>('.lamigo-heatmap-legend');
  if (!legend) {
    legend = document.createElement('div');
    legend.className = 'lamigo-heatmap-legend';
    legend.style.cssText = 'display: none;';
    legend.innerHTML = `
      <span style="font-weight: bold;">Rating Legend:</span>
      <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 11px; height: 11px; border-radius: 2px; background-color: #888888;"></span>&lt;1200</span>
      <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 11px; height: 11px; border-radius: 2px; background-color: #008000;"></span>&lt;1400</span>
      <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 11px; height: 11px; border-radius: 2px; background-color: #03a89e;"></span>&lt;1600</span>
      <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 11px; height: 11px; border-radius: 2px; background-color: #0000ff;"></span>&lt;1900</span>
      <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 11px; height: 11px; border-radius: 2px; background-color: #aa00aa;"></span>&lt;2100</span>
      <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 11px; height: 11px; border-radius: 2px; background-color: #ff8c00;"></span>&lt;2400</span>
      <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 11px; height: 11px; border-radius: 2px; background-color: #ff0000;"></span>&ge;2400</span>
    `;
    graph.insertAdjacentElement('afterend', legend);
  }

  checkbox.addEventListener('change', () => {
    const checked = checkbox.checked;
    chrome.storage.local.set({ cf_heatmap_rating_enabled: checked });
    updateHeatmap(checked, handle);
  });

  chrome.storage.local.get(['cf_heatmap_rating_enabled'], (res) => {
    const enabled = !!res.cf_heatmap_rating_enabled;
    checkbox.checked = enabled;
    updateHeatmap(enabled, handle);
  });
}

// Observe DOM for dynamic content
const observer = new MutationObserver(() => {
  injectAddButtons();
  injectBookmarkButton();
  injectProfileBookmarkButton();
  injectCollegeStandingsTab();
  injectRatingHeatmap();
});

if (document.body) {
  injectAddButtons();
  injectBookmarkButton();
  injectProfileBookmarkButton();
  injectCollegeStandingsTab();
  injectRatingHeatmap();
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    injectAddButtons();
    injectBookmarkButton();
    injectProfileBookmarkButton();
    injectCollegeStandingsTab();
    injectRatingHeatmap();
    observer.observe(document.body, { childList: true, subtree: true });
  });
}


