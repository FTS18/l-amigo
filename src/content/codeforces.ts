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

// ============================================================
// RATING PREDICTION ENGINE  (carrot-accurate)
// ============================================================

/** Session cache: handle (lowercase) -> current CF rating */
const _handleRatingCache: Record<string, number> = {};

/**
 * Official rating change info from CF API.
 */
interface OfficialRatingChange {
  delta: number;
  oldRating: number;
  newRating: number;
}

/** Session cache: contestId -> actual rating changes (if contest is already rated) */
const _actualChangesCache: Record<string, Record<string, OfficialRatingChange> | null> = {};

async function fetchRatingsForHandles(handles: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const toFetch: string[] = [];

  for (const h of handles) {
    const lower = h.toLowerCase();
    if (_handleRatingCache[lower] !== undefined) {
      result[lower] = _handleRatingCache[lower];
    } else {
      toFetch.push(h);
    }
  }

  for (let i = 0; i < toFetch.length; i += 500) {
    const batch = toFetch.slice(i, i + 500);
    try {
      const res = await fetch(
        `https://codeforces.com/api/user.info?handles=${encodeURIComponent(batch.join(';'))}`
      );
      const data = await res.json();
      if (data.status === 'OK') {
        for (const u of data.result) {
          const lower = u.handle.toLowerCase();
          const rating = u.rating ?? 0;
          _handleRatingCache[lower] = rating;
          result[lower] = rating;
        }
      }
    } catch (e) {
      console.warn('[L\'Amigo] Rating batch failed', e);
    }
    if (i + 500 < toFetch.length) await new Promise(r => setTimeout(r, 400));
  }

  for (const h of handles) {
    const lower = h.toLowerCase();
    if (_handleRatingCache[lower] !== undefined && result[lower] === undefined) {
      result[lower] = _handleRatingCache[lower];
    }
  }
  return result;
}

/**
 * Fetch ACTUAL rating changes from CF once the contest is officially rated.
 * Returns null if the contest hasn't been rated yet.
 */
async function fetchActualRatingChanges(contestId: string): Promise<Record<string, OfficialRatingChange> | null> {
  if (contestId in _actualChangesCache) return _actualChangesCache[contestId];

  try {
    const res = await fetch(`https://codeforces.com/api/contest.ratingChanges?contestId=${contestId}`);
    const data = await res.json();
    if (data.status === 'OK' && Array.isArray(data.result) && data.result.length > 0) {
      const map: Record<string, OfficialRatingChange> = {};
      for (const entry of data.result) {
        map[entry.handle.toLowerCase()] = {
          delta: entry.newRating - entry.oldRating,
          oldRating: entry.oldRating,
          newRating: entry.newRating
        };
      }
      _actualChangesCache[contestId] = map;
      return map;
    }
  } catch (_) { /* silent */ }

  _actualChangesCache[contestId] = null;
  return null;
}

/** P(opponent beats target) — Elo formula used by Codeforces */
function winProbability(opponentRating: number, targetRating: number): number {
  return 1.0 / (1.0 + Math.pow(6, (targetRating - opponentRating) / 400.0));
}

/** Expected rank (seed) of myRating against a pool of contestant ratings */
function calculateSeed(myRating: number, pool: number[]): number {
  let seed = 1.0;
  for (const r of pool) seed += winProbability(r, myRating);
  return seed;
}

/** Binary-search: find the rating whose seed == targetSeed */
function getRatingForSeed(targetSeed: number, pool: number[]): number {
  let lo = 0, hi = 8000;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (calculateSeed(mid, pool) < targetSeed) hi = mid;
    else lo = mid + 1;
  }
  return lo - 1;
}

interface ContestantInput {
  handle: string;
  rating: number; // 0 = unrated/newbie (excluded from computation)
  rank: number;
}

/**
 * Compute predicted deltas for ALL contestants at once — matches carrot's algorithm exactly:
 *
 *   Step 1  Raw delta = floor((needRating - rating) / 2)
 *             where needRating satisfies: seed(needRating) == sqrt(seed(rating) * actualRank)
 *
 *   Step 2  Correction 1 (inflation): inc = clamp(-totalDelta/n, -10, 0)
 *             Add inc to all deltas so total doesn't inflate the rating pool.
 *
 *   Step 3  Correction 2 (top-rated): Highest-rated contestant must not lose points.
 *             If their delta < 0, lift everyone by |delta|.
 *
 * Returns Map<handle_lowercase, delta>.
 */
function computeBatchDeltas(contestants: ContestantInput[]): Map<string, number> {
  const rated = contestants.filter(c => c.rating > 0);
  if (rated.length === 0) return new Map();

  const allRatings = rated.map(c => c.rating);

  // Step 1: raw delta per rated contestant
  const deltas: number[] = rated.map(c => {
    let removed = false;
    const others = allRatings.filter(r => {
      if (!removed && r === c.rating) { removed = true; return false; }
      return true;
    });
    const seed = calculateSeed(c.rating, others);
    const needRank = Math.sqrt(seed * c.rank);
    const needRating = getRatingForSeed(needRank, others);
    return Math.floor((needRating - c.rating) / 2);
  });

  // Step 2: Correction 1 — zero-sum inflation fix
  const sumDelta = deltas.reduce((s, d) => s + d, 0);
  const inc1 = Math.max(Math.min(Math.floor(-sumDelta / rated.length), 0), -10);
  for (let i = 0; i < deltas.length; i++) deltas[i] += inc1;

  // Step 3: Correction 2 — top-rated participant must not lose points
  let topIdx = 0;
  for (let i = 1; i < rated.length; i++) {
    if (rated[i].rating > rated[topIdx].rating) topIdx = i;
  }
  const inc2 = Math.max(0, -deltas[topIdx]);
  if (inc2 > 0) for (let i = 0; i < deltas.length; i++) deltas[i] += inc2;

  const result = new Map<string, number>();
  rated.forEach((c, i) => result.set(c.handle.toLowerCase(), deltas[i]));
  return result;
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function deltaColor(delta: number): string {
  if (delta > 0) return '#4caf50';
  if (delta < 0) return '#f44336';
  return '#9e9e9e';
}

// ============================================================
// INJECT QUICK-ADD BUTTONS
// ============================================================

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

// ============================================================
// COLLEGE STANDINGS FEATURE
// ============================================================

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
        console.error('Failed to fetch page 2', err);
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

// Per-session standings cache: contestId -> problems + all rows (unfiltered)
const _standingsCache: Record<string, { problems: any[]; filteredRows: any[]; allRows?: any[] }> = {};

function injectCollegeStandingsTab() {
  if (!window.location.pathname.includes('/standings')) return;

  const menuList = document.querySelector<HTMLUListElement>('ul.second-level-menu-list');
  if (!menuList) return;

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

      document.querySelectorAll('.second-level-menu-list li').forEach(el => el.classList.remove('current'));
      li.classList.add('current');

      a.innerText = 'LOADING...';

      const contestIdMatch = window.location.pathname.match(/\/contest\/(\d+)\/standings/);
      if (!contestIdMatch) {
        a.innerText = 'COLLEGE STANDINGS';
        return;
      }
      const contestId = contestIdMatch[1];

      // --- CACHE HIT ---
      if (_standingsCache[contestId]) {
        const cached = _standingsCache[contestId];
        // Pre-fetch stored allRows (unfiltered) — filter now
        if (cached.allRows && cached.filteredRows === cached.allRows) {
          a.innerText = 'FILTERING...';
          const memberHandles = new Set<string>();
          for (const m of cachedMembers) memberHandles.add(m.handle.toLowerCase());
          const filteredRows = cached.allRows.filter((row: any) =>
            row.party.members.some((m: any) => memberHandles.has(m.handle.toLowerCase()))
          );
          cached.filteredRows = filteredRows;
        }
        await renderCollegeStandings(cached.problems, cached.filteredRows, cachedMembers, orgName, orgId, a, li);
        return;
      }

      // Fallback: scrape org page if members empty
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
          console.error('Failed fallback scrape', err);
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
        // CF only allows contestId for non-gym contests (anonymous GET, no extra params)
        const apiRes = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}`);
        const apiData = await apiRes.json();

        if (apiData.status !== 'OK') {
          a.innerText = 'COLLEGE STANDINGS';
          console.error('CF API error:', apiData.comment);
          return;
        }

        a.innerText = 'FILTERING...';

        const problems = apiData.result.problems;
        const allRows = apiData.result.rows;

        const memberHandles = new Set<string>();
        for (const m of cachedMembers) memberHandles.add(m.handle.toLowerCase());

        const filteredRows = allRows.filter((row: any) =>
          row.party.members.some((m: any) => memberHandles.has(m.handle.toLowerCase()))
        );

        _standingsCache[contestId] = { problems, filteredRows, allRows: filteredRows };

        await renderCollegeStandings(problems, filteredRows, cachedMembers, orgName, orgId, a, li, allRows);
      } catch (err: any) {
        console.error('Standings error', err);
        a.innerText = 'COLLEGE STANDINGS';
      }
    });

    li.appendChild(a);

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

/**
 * Render college standings table, then asynchronously add Δ column for all members.
 * `allContestRows` = every row in the contest (needed to compute seeds accurately).
 */
async function renderCollegeStandings(
  problems: any[],
  filteredRows: any[],
  cachedMembers: any[],
  orgName: string,
  orgId: string,
  a: HTMLAnchorElement,
  li: HTMLLIElement,
  allContestRows?: any[]
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

  // Build table (native CF markup) — with extra Δ column header
  let html = '<div style="overflow-x:auto;"><table class="standings"><thead><tr>';
  html += '<th class="top-pagination-box" style="width:2em;">#</th>';
  html += '<th style="width:12em;">Who</th>';
  html += '<th style="width:2.5em;">=</th>';
  html += '<th style="width:3em;">Penalty</th>';
  for (const p of problems) {
    html += `<th><a title="${p.name}">${p.index}</a></th>`;
  }
  html += '<th style="width:4em;color:#aaa;font-size:11px;" title="Predicted rating delta">Δ Pred</th>';
  html += '</tr></thead><tbody>';

  let isDark = false;
  let rank = 1;
  for (const row of filteredRows) {
    const trClass = isDark ? 'dark' : '';
    isDark = !isDark;
    html += `<tr class="${trClass}" data-lamigo-rank="${row.rank}">`;
    html += `<td>${rank++}</td>`;

    const memberLinks = row.party.members.map((m: any) => {
      const lower = m.handle.toLowerCase();
      const info = membersLookup[lower] || { handle: m.handle, ratingClass: 'user-gray' };
      if (info.ratingClass === 'user-legendary') {
        return `<a href="/profile/${info.handle}" class="rated-user user-legendary"><span class="legendary-first-letter">${info.handle[0]}</span>${info.handle.slice(1)}</a>`;
      }
      return `<a href="/profile/${info.handle}" class="rated-user ${info.ratingClass}">${info.handle}</a>`;
    });

    const handles = row.party.members.map((m: any) => m.handle.toLowerCase()).join(',');
    html += `<td class="contestant-cell" data-lamigo-handles="${handles}">${row.party.teamName || memberLinks.join(', ')}</td>`;
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

    // Δ column placeholder — will be filled after rating fetch
    html += `<td class="lamigo-delta-cell" style="text-align:center;font-size:11px;color:#aaa;">…</td>`;
    html += '</tr>';
  }
  html += '</tbody></table></div>';

  const datatable = document.querySelector('.datatable');
  if (datatable) {
    datatable.innerHTML = html;
    document.querySelectorAll('.pagination').forEach(el => el.remove());
  }
  a.innerText = 'COLLEGE STANDINGS';

  // ---- Async: compute Δ for all college members ----
  const memberHandlesInContest: string[] = [];
  for (const row of filteredRows) {
    for (const m of row.party.members) memberHandlesInContest.push(m.handle);
  }
  if (memberHandlesInContest.length === 0) return;

  const contestIdForDelta = window.location.pathname.match(/\/contest\/(\d+)\//)?.[1] || '';

  try {
    // 1. Check if contest is already rated — use actual deltas if so
    const actualChanges = contestIdForDelta ? await fetchActualRatingChanges(contestIdForDelta) : null;

    // 2. Fetch ratings for college members
    const memberRatings = await fetchRatingsForHandles(memberHandlesInContest);

    // 3. Build full contestant pool for batch computation (top 3000 for seed accuracy)
    let contestantPool: ContestantInput[] = [];
    if (!actualChanges && allContestRows && allContestRows.length > 0) {
      const top3000 = allContestRows.slice(0, 3000);
      const allHandles = top3000.flatMap((row: any) => row.party.members.map((m: any) => m.handle));
      const allRatingsMap = await fetchRatingsForHandles(allHandles);
      contestantPool = top3000.map((row: any) => ({
        handle: row.party.members[0]?.handle || '',
        rating: allRatingsMap[(row.party.members[0]?.handle || '').toLowerCase()] ?? 0,
        rank: row.rank
      })).filter((c: ContestantInput) => c.handle && c.rating > 0);
    }
    if (!actualChanges && contestantPool.length === 0) {
      // Fallback: use only college members for seed calculation
      contestantPool = filteredRows.map((row: any) => ({
        handle: row.party.members[0]?.handle || '',
        rating: memberRatings[(row.party.members[0]?.handle || '').toLowerCase()] ?? 0,
        rank: row.rank
      })).filter((c: ContestantInput) => c.handle && c.rating > 0);
    }

    // 4. Compute batch deltas (with both corrections) — or use actual if already rated
    const batchDeltas = actualChanges ? null : computeBatchDeltas(contestantPool);

    // 5. Update DOM
    for (const row of filteredRows) {
      const handles = row.party.members.map((m: any) => m.handle.toLowerCase()).join(',');
      const tr = datatable?.querySelector(`td[data-lamigo-handles="${handles}"]`)?.closest('tr');
      if (!tr) continue;
      const lastTd = tr.querySelector('td.lamigo-delta-cell');
      if (!lastTd) continue;

      const firstHandle = row.party.members[0]?.handle?.toLowerCase();
      const myRating = memberRatings[firstHandle] ?? 0;

      if (myRating === 0) {
        lastTd.textContent = 'N/A';
        (lastTd as HTMLElement).style.color = '#888';
        continue;
      }

      let delta = 0;
      let newRating = myRating;
      let isOfficial = false;

      if (actualChanges && actualChanges[firstHandle]) {
        delta = actualChanges[firstHandle].delta;
        newRating = actualChanges[firstHandle].newRating; // Exact official new rating
        isOfficial = true;
      } else if (batchDeltas && batchDeltas.has(firstHandle)) {
        delta = batchDeltas.get(firstHandle) ?? 0;
        newRating = myRating + delta; // Predicted new rating based on current rating
      } else {
        // Fallback if not found in prediction
      }

      const label = isOfficial ? '✓' : '~';
      lastTd.innerHTML = `<span style="color:${deltaColor(delta)};font-weight:700;" title="${isOfficial ? 'Official' : 'Predicted'}">${label}${formatDelta(delta)}</span><br><span style="font-size:10px;color:#888;">${newRating}</span>`;
    }
  } catch (err) {
    console.warn('[L\'Amigo] Delta computation failed', err);
  }
}

// ============================================================
// NATIVE STANDINGS DELTA COLUMN (e.g. Friends Standings)
// ============================================================

async function injectNativeStandingsDeltaColumn() {
  if (!window.location.pathname.includes('/standings')) return;
  if (window.location.search.includes('lamigo_college=true')) return; // handled by renderCollegeStandings

  const contestIdMatch = window.location.pathname.match(/\/contest\/(\d+)\/standings/);
  if (!contestIdMatch) return;
  const contestId = contestIdMatch[1];

  const table = document.querySelector('table.standings');
  if (!table) return;

  if (table.hasAttribute('data-lamigo-native-delta')) return;

  const headerTr = table.querySelector('tr:first-child');
  if (!headerTr || headerTr.querySelector('.lamigo-native-delta-col-header')) return;

  const rows = Array.from(table.querySelectorAll('tr[participantid]'));
  if (rows.length === 0) return;

  table.setAttribute('data-lamigo-native-delta', 'true');

  // 1. Add header
  const th = document.createElement('th');
  th.className = 'lamigo-native-delta-col-header';
  th.style.cssText = 'text-align:center;width:4em;font-size:11px;color:#aaa;padding-top:4px;vertical-align:middle;';
  th.textContent = 'Δ Pred';
  headerTr.appendChild(th);

  // 2. Add cells and collect handles
  const pageContestants: { handle: string; td: HTMLElement }[] = [];
  for (const tr of rows) {
    if (!tr.querySelector('.lamigo-native-delta-cell')) {
      const td = document.createElement('td');
      td.className = 'lamigo-native-delta-cell';
      td.style.cssText = 'text-align:center;font-size:11px;color:#aaa;vertical-align:middle;';
      td.innerHTML = '⏳';
      tr.appendChild(td);

      // Handle might be in a regular a.rated-user or inside a team
      const a = tr.querySelector('td.contestant-cell a.rated-user');
      const handle = a?.textContent?.trim();
      if (handle) {
        pageContestants.push({ handle, td });
      } else {
        td.innerHTML = '';
      }
    }
  }

  if (pageContestants.length === 0) return;

  try {
    const actualChanges = await fetchActualRatingChanges(contestId);
    let batchDeltas: Map<string, number> | null = null;
    let ratingsMap: Record<string, number> = {};

    if (!actualChanges) {
      if (!_standingsCache[contestId]) {
        const apiRes = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}`);
        const apiData = await apiRes.json();
        if (apiData.status === 'OK') {
          _standingsCache[contestId] = {
            problems: apiData.result.problems,
            filteredRows: apiData.result.rows,
            allRows: apiData.result.rows
          };
        } else {
          return;
        }
      }
      const allRows = _standingsCache[contestId].allRows || _standingsCache[contestId].filteredRows;
      const top3000 = allRows.slice(0, 3000);
      const allHandles = top3000.flatMap((r: any) => r.party.members.map((m: any) => m.handle));
      const extraHandles = pageContestants.map(c => c.handle);
      ratingsMap = await fetchRatingsForHandles([...allHandles, ...extraHandles]);

      const contestantPool: ContestantInput[] = top3000.map((r: any) => ({
        handle: r.party.members[0]?.handle || '',
        rating: ratingsMap[(r.party.members[0]?.handle || '').toLowerCase()] ?? 0,
        rank: r.rank
      })).filter((c: ContestantInput) => c.handle && c.rating > 0);

      batchDeltas = computeBatchDeltas(contestantPool);
    } else {
      ratingsMap = await fetchRatingsForHandles(pageContestants.map(c => c.handle));
    }

    for (const { handle, td } of pageContestants) {
      const lower = handle.toLowerCase();
      const myRating = ratingsMap[lower] ?? 0;

      if (myRating === 0) {
        td.textContent = 'N/A';
        td.style.color = '#888';
        continue;
      }

      let delta = 0;
      let newRating = myRating;
      let isOfficial = false;

      if (actualChanges && actualChanges[lower]) {
        delta = actualChanges[lower].delta;
        newRating = actualChanges[lower].newRating;
        isOfficial = true;
      } else if (batchDeltas && batchDeltas.has(lower)) {
        delta = batchDeltas.get(lower) ?? 0;
        newRating = myRating + delta;
      } else {
        td.textContent = '-';
        continue;
      }

      const label = isOfficial ? '✓' : '~';
      td.innerHTML = `<span style="color:${deltaColor(delta)};font-weight:700;" title="${isOfficial ? 'Official' : 'Predicted'}">${label}${formatDelta(delta)}</span><br><span style="font-size:10px;color:#888;">${newRating}</span>`;
    }

  } catch (err) {
    console.warn('[L\'Amigo] Native standings delta failed', err);
    pageContestants.forEach(c => c.td.innerHTML = '?');
  }
}

// ============================================================
// MAIN STANDINGS: OWN-ROW DELTA BADGE
// ============================================================

let _ownRowInjected = false;

async function injectOwnRowDeltaBadge() {
  if (!window.location.pathname.includes('/standings')) return;
  if (_ownRowInjected) return;

  const contestIdMatch = window.location.pathname.match(/\/contest\/(\d+)\/standings/);
  if (!contestIdMatch) return;
  const contestId = contestIdMatch[1];

  // Get own CF handle from settings
  const stored = await chrome.storage.local.get(['own_codeforces_handle']);
  const ownHandle: string = (stored.own_codeforces_handle || '').toLowerCase().trim();
  if (!ownHandle) return;

  // Find own row in DOM: look for a link to /profile/<ownHandle>
  const selector = `a[href="/profile/${ownHandle}"], a[href="/profile/${ownHandle.charAt(0).toUpperCase() + ownHandle.slice(1)}"]`;
  const ownLink = document.querySelector<HTMLAnchorElement>(selector)
    || Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/profile/"]'))
        .find(a => a.getAttribute('href')?.split('/profile/')[1]?.toLowerCase() === ownHandle);

  if (!ownLink) return;

  const ownRow = ownLink.closest('tr');
  if (!ownRow) return;

  // Don't double-inject
  if (ownRow.querySelector('.lamigo-own-delta')) return;
  _ownRowInjected = true;

  // Extract rank from first cell
  const rankCell = ownRow.querySelector<HTMLTableCellElement>('td:first-child');
  const rank = parseInt(rankCell?.textContent?.trim() || '0');
  if (!rank) return;

  // Show a loading badge immediately
  const badge = document.createElement('span');
  badge.className = 'lamigo-own-delta';
  badge.style.cssText = `
    display: inline-block;
    margin-left: 6px;
    padding: 1px 6px;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid #555;
    color: #aaa;
    background: rgba(0,0,0,0.15);
    vertical-align: middle;
    cursor: default;
  `;
  badge.textContent = '⏳ Δ…';
  ownLink.insertAdjacentElement('afterend', badge);

  try {
    // 1. Check if contest is already officially rated
    badge.textContent = 'checking…';
    const actualChanges = await fetchActualRatingChanges(contestId);

    if (actualChanges) {
      // Contest already rated — show exact official delta
      const change = actualChanges[ownHandle] ?? null;
      if (change === null) { badge.remove(); _ownRowInjected = false; return; }
      
      const delta = change.delta;
      const newRating = change.newRating;
      const color = deltaColor(delta);
      badge.style.color = color;
      badge.style.borderColor = color;
      badge.style.background = `${color}18`;
      badge.title = `Official delta: ${formatDelta(delta)} → ${newRating}`;
      badge.innerHTML = `✓${formatDelta(delta)} <span style="font-size:10px;opacity:0.8;">(→${newRating})</span>`;
      return;
    }

    // 2. Contest not yet rated — predict
    if (!_standingsCache[contestId]) {
      badge.textContent = 'fetching…';
      const apiRes = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}`);
      const apiData = await apiRes.json();
      if (apiData.status !== 'OK') { badge.remove(); _ownRowInjected = false; return; }
      _standingsCache[contestId] = {
        problems: apiData.result.problems,
        filteredRows: apiData.result.rows,
        allRows: apiData.result.rows
      };
    }

    const allRows = _standingsCache[contestId].allRows || _standingsCache[contestId].filteredRows;
    badge.textContent = 'rating…';

    // Fetch ratings for top 3000 for accurate seed
    const top3000 = allRows.slice(0, 3000);
    const allHandles = top3000.flatMap((row: any) => row.party.members.map((m: any) => m.handle));
    const ratingsMap = await fetchRatingsForHandles(allHandles);

    const ownRating = ratingsMap[ownHandle] ?? 0;
    if (ownRating === 0) { badge.textContent = 'unrated'; return; }

    // Build contestant pool and use batch computation (with both corrections)
    const contestantPool: ContestantInput[] = top3000.map((row: any) => ({
      handle: row.party.members[0]?.handle || '',
      rating: ratingsMap[(row.party.members[0]?.handle || '').toLowerCase()] ?? 0,
      rank: row.rank
    })).filter((c: ContestantInput) => c.handle && c.rating > 0);

    const batchDeltas = computeBatchDeltas(contestantPool);
    const delta = batchDeltas.get(ownHandle) ?? 0;
    const newRating = ownRating + delta;
    const color = deltaColor(delta);

    badge.style.color = color;
    badge.style.borderColor = color;
    badge.style.background = `${color}18`;
    badge.title = `Predicted delta: ~${formatDelta(delta)} → ${newRating} (L'Amigo)`;
    badge.innerHTML = `~${formatDelta(delta)} <span style="font-size:10px;opacity:0.8;">(→${newRating})</span>`;

  } catch (err) {
    badge.textContent = '?';
    console.warn("[L'Amigo] Own-row delta failed", err);
  }
}

// ============================================================
// PROFILE BOOKMARK BUTTON
// ============================================================

function injectProfileBookmarkButton() {
  if (!window.location.pathname.startsWith('/profile/')) return;

  const orgLink = document.querySelector<HTMLAnchorElement>('a[href*="/ratings/organization/"]');
  if (!orgLink) return;

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

// ============================================================
// RATING HEATMAP
// ============================================================

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
  if (rating < 1200) return '#888888';
  if (rating < 1400) return '#008000';
  if (rating < 1600) return '#03a89e';
  if (rating < 1900) return '#0000ff';
  if (rating < 2100) return '#aa00aa';
  if (rating < 2400) return '#ff8c00';
  return '#ff0000';
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
    if (legend && legend.style.display !== 'none') legend.style.display = 'none';
    if (toggleText && toggleText.innerText !== 'Rating-based Heatmap') toggleText.innerText = 'Rating-based Heatmap';

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

  if (legend && legend.style.display !== 'flex') legend.style.display = 'flex';

  if (!cachedSubmissions && !isFetching) {
    if (toggleText && toggleText.innerText !== 'Loading submissions...') toggleText.innerText = 'Loading submissions...';
    try {
      const subs = await fetchSubmissions(handle);
      maxRatingByDate = calculateRatingsByDate(subs);
      if (toggleText && toggleText.innerText !== 'Rating-based Heatmap') toggleText.innerText = 'Rating-based Heatmap';
    } catch (err) {
      if (toggleText && toggleText.innerText !== 'Error loading rating heatmap') toggleText.innerText = 'Error loading rating heatmap';
      console.error(err);
      return;
    }
  } else if (isFetching) {
    if (toggleText && toggleText.innerText !== 'Loading submissions...') toggleText.innerText = 'Loading submissions...';
    try {
      const subs = await fetchPromise;
      if (subs) {
        maxRatingByDate = calculateRatingsByDate(subs);
      }
      if (toggleText && toggleText.innerText !== 'Rating-based Heatmap') toggleText.innerText = 'Rating-based Heatmap';
    } catch (err) {
      if (toggleText && toggleText.innerText !== 'Error loading rating heatmap') toggleText.innerText = 'Error loading rating heatmap';
      console.error(err);
      return;
    }
  }

  if (useRating && !heatmapRatingEnabled) return;

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

let heatmapRatingEnabled = false;
let heatmapToggleContainer: HTMLDivElement | null = null;
let heatmapCheckbox: HTMLInputElement | null = null;
let heatmapLegend: HTMLDivElement | null = null;

function injectRatingHeatmap() {
  if (!window.location.pathname.startsWith('/profile/')) return;

  const graph = document.querySelector<HTMLDivElement>('#userActivityGraph');
  if (!graph) return;

  const match = window.location.pathname.match(/\/profile\/([^/]+)/);
  if (!match) return;
  const handle = match[1];

  if (handle !== currentHandle) {
    cachedSubmissions = null;
    fetchPromise = null;
    maxRatingByDate.clear();
    originalColors.clear();
    currentHandle = handle;
    heatmapRatingEnabled = false;
    // Tear down the old toggle so it's re-injected fresh for the new handle
    heatmapToggleContainer?.remove();
    heatmapLegend?.remove();
    heatmapToggleContainer = null;
    heatmapCheckbox = null;
    heatmapLegend = null;
  }

  // If our container is already in the DOM, just re-anchor it if CF swapped the graph node
  if (heatmapToggleContainer !== null) {
    if (!graph.parentNode?.contains(heatmapToggleContainer)) {
      graph.parentNode?.insertBefore(heatmapToggleContainer, graph);
    }
    // Nuke any rogue duplicates that somehow snuck in
    document.querySelectorAll('.lamigo-heatmap-toggle-container').forEach(el => {
      if (el !== heatmapToggleContainer) el.remove();
    });
    if (heatmapRatingEnabled) {
      const uncoloredRect = document.querySelector('#userActivityGraph svg rect.day:not([data-lamigo-colored])');
      if (uncoloredRect) updateHeatmap(true, handle);
    }
    return;
  }

  // First time injection — build the UI
  const container = document.createElement('div');
  container.className = 'lamigo-heatmap-toggle-container';
  heatmapToggleContainer = container;

  const label = document.createElement('label');
  label.className = 'lamigo-heatmap-toggle-label';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'lamigo-heatmap-rating-toggle';
  checkbox.checked = false;
  heatmapCheckbox = checkbox;

  const labelText = document.createElement('span');
  labelText.innerText = 'Rating-based Heatmap';
  labelText.className = 'lamigo-heatmap-toggle-text';

  label.appendChild(checkbox);
  label.appendChild(labelText);
  container.appendChild(label);

  graph.parentNode?.insertBefore(container, graph);

  const legend = document.createElement('div');
  legend.className = 'lamigo-heatmap-legend';
  legend.style.cssText = 'display: none;';

  // Build legend safely using DOM API (no innerHTML) to prevent any XSS vector
  const legendItems: Array<{ color: string; label: string }> = [
    { color: '#888888', label: '<1200' },
    { color: '#008000', label: '<1400' },
    { color: '#03a89e', label: '<1600' },
    { color: '#0000ff', label: '<1900' },
    { color: '#aa00aa', label: '<2100' },
    { color: '#ff8c00', label: '<2400' },
    { color: '#ff0000', label: '≥2400' },
  ];

  const legendTitle = document.createElement('span');
  legendTitle.style.fontWeight = 'bold';
  legendTitle.textContent = 'Rating Legend:';
  legend.appendChild(legendTitle);

  for (const item of legendItems) {
    const wrapper = document.createElement('span');
    wrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';
    const swatch = document.createElement('span');
    swatch.style.cssText = `display: inline-block; width: 11px; height: 11px; border-radius: 2px; background-color: ${item.color};`;
    const text = document.createTextNode(item.label);
    wrapper.appendChild(swatch);
    wrapper.appendChild(text);
    legend.appendChild(wrapper);
  }

  graph.insertAdjacentElement('afterend', legend);
  heatmapLegend = legend;

  checkbox.addEventListener('change', () => {
    heatmapRatingEnabled = checkbox.checked;
    updateHeatmap(heatmapRatingEnabled, handle);
  });

  heatmapRatingEnabled = false;
  checkbox.checked = false;
}

// ============================================================
// SILENT PRE-FETCH: warms standings cache on page load
// ============================================================
async function prefetchCollegeStandings() {
  if (!window.location.pathname.includes('/standings')) return;

  const contestIdMatch = window.location.pathname.match(/\/contest\/(\d+)\/standings/);
  if (!contestIdMatch) return;
  const contestId = contestIdMatch[1];

  if (_standingsCache[contestId]) return;

  try {
    const apiRes = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}`);
    const apiData = await apiRes.json();
    if (apiData.status !== 'OK') return;

    const problems = apiData.result.problems;
    const allRows = apiData.result.rows;
    _standingsCache[contestId] = { problems, filteredRows: allRows, allRows };
  } catch (_) {
    // Silent
  }
}

// ============================================================
// REAL-TIME SUBMISSION MONITOR & TOASTS
// ============================================================

class CodeforcesMonitor {
  private lastDetectedSubId = '';

  constructor() {
    this.init();
  }

  private init() {
    // Monitor status pages where user submissions appear
    if (!window.location.pathname.includes('/my') && !window.location.pathname.includes('/status')) {
      return;
    }

    console.log("[L'Amigo] Monitoring Codeforces submissions on", window.location.pathname);
    this.checkForNewAccepted();

    let monitorTimeout: number | null = null;
    const observer = new MutationObserver(() => {
      if (monitorTimeout !== null) return;
      monitorTimeout = window.setTimeout(() => {
        monitorTimeout = null;
        this.checkForNewAccepted();
      }, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  private checkForNewAccepted() {
    try {
      // Find rows in status table
      const rows = document.querySelectorAll('table.status-frame-datatable tr[data-submission-id], table.status-frame-datatable tr:not(:first-child)');
      if (rows.length === 0) return;

      // Look at the first row (most recent submission)
      const firstRow = rows[0];
      const verdictEl = firstRow.querySelector('.verdict-accepted');
      if (!verdictEl) return;

      // Get submission ID
      const subId = firstRow.getAttribute('data-submission-id') || firstRow.querySelector('a.view-source')?.textContent?.trim() || '';
      if (!subId || subId === this.lastDetectedSubId) return;

      // Check if it's our own submission by verifying if 'my' is in URL or checking author
      const isMyPage = window.location.pathname.includes('/my');
      const authorEl = firstRow.querySelector('td.author a');
      
      chrome.storage.local.get(['own_codeforces_handle'], (res) => {
        const ownHandle = (res.own_codeforces_handle || '').toLowerCase().trim();
        const authorHandle = (authorEl?.textContent || '').toLowerCase().trim();

        if (isMyPage || (ownHandle && authorHandle === ownHandle)) {
          this.lastDetectedSubId = subId;
          console.log("[L'Amigo] New Codeforces Accepted submission detected! ID:", subId);
          
          const problemTitle = firstRow.querySelector('td:nth-child(4) a')?.textContent?.trim() || 'Codeforces Problem';

          chrome.runtime.sendMessage({
            type: "newSubmissionDetected",
            data: {
              title: problemTitle,
              timestamp: Date.now(),
              url: window.location.href
            }
          }).catch(() => { /* silent */ });
        }
      });
    } catch (err) {
      console.warn("[L'Amigo] CodeforcesMonitor check failed:", err);
    }
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
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      background: #1e293b;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      border-radius: 8px;
      border: 1px solid #334155;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3);
      z-index: 999999;
    `;
    
    const icon = document.createElement("span");
    icon.className = "lamigo-toast-success-icon";
    icon.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      background: #3b82f6;
      color: #ffffff;
      border-radius: 50%;
      font-size: 12px;
      font-weight: bold;
    `;
    icon.textContent = "✓";
    
    const text = document.createElement("span");
    text.textContent = message.message;
    
    toast.appendChild(icon);
    toast.appendChild(text);
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }
});

// ============================================================
// BOOT
// ============================================================

let globalObserverTimeout: number | null = null;
const observer = new MutationObserver(() => {
  if (globalObserverTimeout !== null) return;
  globalObserverTimeout = window.setTimeout(() => {
    globalObserverTimeout = null;
    injectAddButtons();
    injectBookmarkButton();
    injectProfileBookmarkButton();
    injectCollegeStandingsTab();
    injectRatingHeatmap();
    injectOwnRowDeltaBadge();
    injectNativeStandingsDeltaColumn();
  }, 150);
});

if (document.body) {
  injectAddButtons();
  injectBookmarkButton();
  injectProfileBookmarkButton();
  injectCollegeStandingsTab();
  injectRatingHeatmap();
  prefetchCollegeStandings();
  injectOwnRowDeltaBadge();
  injectNativeStandingsDeltaColumn();
  new CodeforcesMonitor();
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    injectAddButtons();
    injectBookmarkButton();
    injectProfileBookmarkButton();
    injectCollegeStandingsTab();
    injectRatingHeatmap();
    prefetchCollegeStandings();
    injectOwnRowDeltaBadge();
    injectNativeStandingsDeltaColumn();
    new CodeforcesMonitor();
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
