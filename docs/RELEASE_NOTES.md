# L'Amigo v1.6.3 Release Notes

**Welcome to the biggest update to L'Amigo yet!** We've completely overhauled the user experience, added a massive new full-page Analytics Dashboard, improved sync reliability, and introduced a ton of requested features. 

Here are the major highlights for v1.6.3:

## NEW: Full-Page Analytics Dashboard
We've introduced a dedicated full-page dashboard (accessible via the new Layout icon in the header) to give you deep insights into your group's performance.
*   **Overview Tab:** See your group's total tracked friends, total solves, and active users across LeetCode, Codeforces, and CodeChef.
*   **Leaderboard Tab:** Rank your friends using three modes: **Power Score** (combining peak normalized rating & difficulty-weighted solves), **Peak Mastery** (cross-platform rating normalization), and **Total Solved**.
*   **Sheets Tracker Tab:** A massive new feature containing **50+ curated problem sheets** (Striver A2Z, CP-31, NeetCode, CSES, Blind 75, etc.). 
    *   *Automated Checkmarks:* Sync your LeetCode and Codeforces history to automatically see what you've solved!
    *   *Rich Data:* Links to problems, video editorials, friend avatar clusters showing who in your group solved a problem, and "Revision Star" toggles.
*   **Contest Hub Tab:** Your ultimate arena for global battles.
    *   *Upcoming Live Battles:* A sleek, brutalist dense list view of LeetCode, Codeforces, and CodeChef contests. Includes chronological sorting, 1-click Google Calendar integration, and Chrome alarm reminders.
    *   *Historical Rating Vault:* View rating trajectories on a unified multi-platform chart for any tracked friend.
    *   *Delta Analytics:* See Latest Rating Delta, All-Time Net Delta, Average Delta/Contest, and Win Rate.

## Design & UX Overhaul
*   **Responsive Typography & Zoom:** We replaced hardcoded pixels with CSS variables. You can now adjust Font Size (80-150%) and Display Zoom (75-125%) in Settings!
*   **Platform SVGs:** We built a custom `PlatformIcons` library to ensure crisp SVG logos for LeetCode, Codeforces, and CodeChef, adjusting seamlessly for Light and Dark modes.
*   **The "You" Card:** Your own configured accounts are now injected as a non-removable synthetic friend pinned to the top of your roster.
*   **Sleek Headers:** Text buttons have been replaced with compact, icon-only buttons (`lucide-react`) for a cleaner header.

## Core Reliability & Architecture
*   **Secure Secrets & Token Encryption:** OAuth tokens are now encrypted using AES-GCM before storage. Secrets have been removed from source and injected securely via Webpack.
*   **Smarter GitHub Sync:** 
    *   Added a `forceCfOnly` flag to isolate Codeforces sync issues.
    *   Implemented a 10s backoff when GitHub secondary rate limits (abuse limits) are detected.
    *   Progress bars now track actual processing, not just successful syncs.
*   **Codeforces Concurrency Queue:** Submissions are now fetched using a 2-slot concurrency-limited dispatcher with exponential backoff retries, ensuring we respect CF's API limits without stalling.
*   **Robust Type Safety:** We introduced a strict `STORAGE_KEYS` registry-typos in Chrome storage keys are now compile-time errors! Profile validation schemas (`schema.ts`) reject malformed data before saving.
*   **Atomic Undo:** Accidentally removed a friend? The new immediate "Undo" toast accurately restores their identity and full historical profiles in one atomic operation.

## Bug Fixes
*   Fixed a bug where Codeforces handles were being lowercased, causing API fetch errors (CF handles are case-sensitive!).
*   Heatmap injection on Codeforces profile pages is now debounced and more stable on SPA navigation.
*   Cleaned up background connection lifecycles to gracefully handle Service Worker restarts mid-sync.

Enjoy the update! Keep grinding.

---

# L'Amigo v1.6.0 Release Notes

L'Amigo v1.6.0 is a massive, comprehensive release featuring platform expansion (Codeforces & CodeChef), college standings dashboards, difficulty-based heatmap coloring, glassmorphic UI designs, persistent synchronization, and high-performance developer tools. This log outlines every single change made from commit `046c1a3` to `HEAD`.

---

## 1. CF College Standings Integration
* **Quick-Add Tracker Buttons (`lamigo-add-btn`)**: Injects a small `+` button next to Codeforces user handles (`a[href^="/profile/"]:not(.lamigo-processed)`) on rankings pages, standings grids, and comments. When clicked, it fires a `createIdentity` background message (adding the account under a new linked identity), updates the button UI to `✓` with a success class, and auto-removes it after 2 seconds.
* **Dark Mode Styling Sync**: Intercepts Codeforces visual mode using a `cf_dark_mode` listener. When active, it adds `lamigo-cf-dark` class to `document.documentElement` to load extension styling overlays, dark borders, and text contrasts on the Codeforces domain.
* **Organization Bookmarking Controls**: Dynamically places a "★ Bookmark" button adjacent to the organization select box (`select[name="organizationId"]`) or ratings title on `/ratings/organization/*` pages. Bookmarking triggers an asynchronous parallel page fetch (`/ratings/organization/{orgId}/page/2`) to scrape and map handles and color ranks for up to 400 members in local storage. Also injects a bookmark control directly next to organization links on individual profiles.
* **Standings Secondary Tab Injection**: Injects a custom **"COLLEGE STANDINGS"** tab into `/contest/*/standings` pages. If a bookmark hash `#college-standings` is present on load, the script triggers the tab automatically.
* **Client-side Filtering & Lookup**: On click, queries the standings REST endpoint (`contest.standings?contestId={id}&from=1&count=5000`) and executes O(1) membership matching using a local `Set` of the bookmarked college handles.
* **Standings Scraping Fallback**: If the cache is empty on standings click, automatically attempts to scrape the first ratings page of the organization as a fallback.
* **Memory Caching**: Integrates a local `_standingsCache` matching contest IDs to prevent repetitive REST calls. Subsequent tab transitions display the standings instantly.
* **High-Fidelity DOM Table Replicator**: Constructs a full HTML standings table (`class="standings"`) mirroring Codeforces' native structure, rendering custom contestant cells, points, penalties, team links, accepted submissions (`+` count and timeline), and rejected tries (`-` count).
* **Legendary User Styling**: Formats handles matching their rank colors (Expert, Master). Styles Legendary Grandmasters by coloring the first letter in black via `.legendary-first-letter` inside a `.user-legendary` class wrapper.

## 2. Rating-based Activity Heatmap
* **Interactive Toggle**: Injects a `"Rating-based Heatmap"` toggle checkbox inside the profile page activity graph header (`._UserActivityFrame_header`). Checkbox preference is stored in `chrome.storage.local`.
* **API Ingestion & Max Rating Calculation**: Queries `https://codeforces.com/api/user.status?handle={handle}` on profile navigation. Filters submissions with `verdict === 'OK'`, groups them by local date (`MM/DD/YYYY`), and computes the highest difficulty rating solved per day.
* **Clean Profile Transitions**: Automatically clears memory variables (`cachedSubmissions`, `fetchPromise`, `maxRatingByDate`, and `originalColors`) when switching between profile handles, ensuring ratings do not leak.
* **Loading & Error Status Feedback**: Temporarily replaces the toggle text (`.lamigo-heatmap-toggle-text`) with `"Loading submissions..."` or error warnings during API data fetching.
* **SVG Square Recoloring**: Modifies `<rect class="day">` SVG cells to use rank-based fill colors. Solved unrated problems map to Gray (`#888888`), while empty or unsolved days default to `#ebedf0`.
* **Color Cache Restoration**: Captures the original count-based green colors when enabled, storing them in an internal `Map`. Instantly restores the original colors when unchecked by stripping custom `data-lamigo-colored` attributes.
* **Rating Color Scale Legend**: Appends a styled rating color scale legend beneath the graph container, detailing ranges for Gray (<1200), Green (<1400), Cyan (<1600), Blue (<1900), Purple (<2100), Orange (<2400), and Red (>=2400).
* **Dynamic Observer Safety**: Listens to graph re-draws (such as year selector clicks) using a MutationObserver, applying or reverting colors on newly generated SVGs without causing recursion.

## 3. More Platforms (Codeforces & CodeChef)
* **Codeforces REST API Integration (`src/services/codeforces.ts`)**:
  * **Concurrently Fetched Multi-Endpoint Pipelines**: Designed the `CodeforcesService.fetchUserProfile` method to fire concurrent requests using `Promise.all` across three critical endpoints: `user.info?handles={handle}` for basic user details, `user.status?handle={handle}&from=1&count=2000` for parsing up to 2000 recent submissions, and `user.rating?handle={handle}` to gather historical ratings.
  * **Static Sequential Request Queue & Throttling**: Implemented a static promise chain pipeline `requestQueue` wrapping all outgoing requests. To respect Codeforces' rate limits and prevent API bans, the queue enforces a mandatory `1000ms` delay between consecutive requests (for both successful operations and caught failures).
  * **Outbound Request Circuit Breaker**: Guarded all REST calls inside `executeRequest` with a custom `CircuitBreaker` wrapper class initialized with `failureThreshold: 5` and `resetTimeout: 60000` ms, ensuring the extension fails fast and remains responsive during Codeforces outages.
  * **Dynamic Contest Division Mapping & Cache**: Built `getContestDivMap` to parse non-gym contests from `contest.list?gym=false`. It caches mappings for 1 hour (`CACHE_TTL = 3600000` ms) and dynamically parses contest titles in lowercase to build a map of contest ID to divisions (Div 1, Div 2, Div 3, Div 4) using keyword filters:
    * *Div 1*: Matches `div. 1`, `div 1`, `global`, `combined`, `hello`, `goodbye`.
    * *Div 2*: Matches `div. 2`, `div 2`, `educational`.
    * *Div 3*: Matches `div. 3`, `div 3`.
    * *Div 4*: Matches `div. 4`, `div 4`.
  * **Difficulty Heuristics & Unrated Fallbacks**: Re-engineered solved problem counts. Solved problems with explicit Codeforces ratings are categorized as Easy (`<1200`), Medium (`<1900`), and Hard (`>=1900`). For unrated problems, it evaluates the index prefix character (Easy: `A`/`B`, Medium: `C`/`D`, Hard: `>=E`), falling back to string matching for keyword indicators like `easy` or `hard`.
  * **Plaintext Submission Code Extractor**: Developed `fetchSubmissionCode(contestId, submissionId)` which fetches the submission page `https://codeforces.com/contest/{contestId}/submission/{submissionId}` and applies regex `/<pre id="program-source-text"[^>]*>([\s\S]*?)<\/pre>/i` to extract source code, followed by HTML entity decoding (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#39;`).
* **CodeChef Scraper Integration (`src/services/codechef.ts`)**:
  * **Direct DOM Profile Scraping**: Designed `CodeChefService.fetchUserProfile` to fetch `https://www.codechef.com/users/{handle}` using an `AbortController` signal matching the `REQUEST_TIMEOUT` threshold.
  * **Drupal Settings State Extraction**: Parses the raw HTML source using regex `/jQuery\.extend\(Drupal\.settings,\s*(\{.*?\})\);/s` to extract the embedded Javascript state. Deserializes the payload to parse rating history, ranks, timestamps, and contest names from `date_versus_rating.all`.
  * **Profile Data Selectors**:
    * *Real Name*: Extracted via HTML regex `<h1>` tags matching `class="h2-style"`.
    * *Avatar*: Extracted via class `profileImage` from the profile image tag.
    * *Star Rating*: Extracted via class `rating` with regex matching `/span[^>]*class='rating'[^>]*>(.*?)\&\#9733;<\/span>/`.
  * **Plaintext Solution Scraper**: Implemented `fetchSubmissionCode(submissionId)` to retrieve the raw code directly from `https://www.codechef.com/viewplaintext/{submissionId}` by matching `<pre>` blocks and decoding HTML character entities (including `&#039;`).
* **LeetCode Verdict Expansion (`src/services/leetcode.ts`)**:
  * **GraphQL Payload Querying**: Upgraded the GraphQL query payload inside `LeetCodeService.fetchAllAcceptedSubmissions` to retrieve `statusDisplay` alongside `id`, `title`, `titleSlug`, `timestamp`, and `lang` directly from the `submissionList` schema.
  * **Live Submission Mutation Monitoring**: Enhanced `leetcode-monitor.ts` to listen for console submission buttons (`console-submit-button` and fallback `submit-code-btn`). Uses a dynamic MutationObserver to scan for the submission status element (`submission-result`), capturing non-Accepted events (like `Wrong Answer` and `Time Limit Exceeded`) in real-time.
  * **Negative Feedback Renderers**: Modified `FriendCard.tsx` and `FriendProfileView.tsx` to handle deduplicated submission lists grouped by `platform` + `titleSlug`. If a submission's `statusDisplay` is not `"Accepted"`, the feed renders a red Lucide `<X size={12} color="#ff4444" />` icon next to the problem title with a hoverable "Rejected" tooltip, providing comprehensive tracking of peer activity.

## 4. React Component UI & Feed Overhaul
* **Typography Migration**: Upgraded the core typography to utilize `Bricolage Grotesque` over standard system-ui, aligning the app with a modern look.
* **Feed Deduplication**: Solved timeline pollution in `FriendCard.tsx` and `FriendProfileView.tsx`. Submissions are now grouped by `platform` + `titleSlug`, ensuring only the latest chronological attempt is rendered to the user.
* **Negative Feedback Visualization**: The feed now explicitly renders "Wrong Answer" or "Time Limit Exceeded" attempts alongside "Accepted" states to provide an accurate real-time view of a friend's active grind.
* **Glassmorphic Popup Redesign**: Split monolithic `App.css` into separate base, cards, chrome, compare, settings, and profile stylesheets. Implemented blurred translucent backgrounds (`backdrop-filter: blur(12px)`), pure-CSS border shadows, and custom neutral dark/light theme grids.
* **Advanced Recharts Graphs**: Swapped simple charts with dark-mode optimized area graphs comparing friend rating history and global ranking progressions.
* **Optimized Component Memoization**: Wrapped the dashboard `FriendCard` in `React.memo` using customized prop-comparators to eliminate redundant re-render cycles across cards.
* **Light Mode Accessibility and Contrast Correction**: Adjusted `getProfileQualityColor` to dynamically pull down dynamic badge HSL lightness to 34% (originally 45%) in Light Mode, guaranteeing compliance with WCAG AA visibility guidelines.

## 5. Lucide React Iconography Integration
* **Icon Swap**: Purged all inconsistent raw text emoji markers (`✓`, `⚡`, `+`, `❌`) across both the React application and DOM-injected content scripts.
* **SVG Standardization**: Integrated `lucide-react` to provide sharp, scalable SVG icons (e.g., `<X />` for rejected submissions). Wrapped icons in semantic HTML `<span>` tags with explicit `title` tooltip properties for maximum accessibility.

## 6. Build System & Webpack Optimizations
* **Webpack HMR Simulation**: Written a custom `DevExtensionReloadPlugin` inside the webpack compiler.
* **Background WebSockets**: Bootstrapped `setupDevAutoReload()` in `background.ts` that acts as a WebSocket client (`ws://localhost:9091`). When Webpack finishes emitting a new bundle, the extension now automatically forces a `chrome.runtime.reload()`, saving developers hundreds of manual refresh clicks per day.
* **Environment Flags**: Injected `__DEV__` constants via Webpack's `DefinePlugin` to prevent development websockets from shipping to production extension bundles.
* **Dynamic Script & Bundle Injection (`html-webpack-plugin`)**: Integrated `HtmlWebpackPlugin` to generate `popup.html` dynamically by injecting script bundle tags automatically. This avoids hardcoded script paths and excludes `popup.html` from the `CopyPlugin` patterns to prevent copy race conditions.
* **Production Optimization & Tree Shaking**: Enabled code-splitting via `splitChunks` to separate third-party vendor modules (e.g. `node_modules` dependencies) into a standalone `vendors.js` chunk. Configured `TerserPlugin` for aggressive minification and tree-shaking (`usedExports: true`) to minimize extension bundle footprint.
* **Source Map Adjustments**: Shifted devtool maps from `inline-cheap-source-map` to `cheap-source-map` to significantly optimize build compilation times.

## 7. Content Script & DOM Injection Enhancements
* **LeetCode Monitor Injection & Submission Debouncing**: Configured `leetcode-monitor.ts` to inject a green checkmark SVG and a `"Synced to GitHub"` anchor link immediately next to Accepted status elements. Enforces a `5000ms` submission debounce check to prevent concurrent API sync queries during rapid user submissions.
* **Profile Page Manager**: Adapted `profile-manager.ts` to evaluate the newly integrated `friend_identities_v2` storage instead of the legacy array. DOM buttons (e.g., "Track with L'Amigo", "Compare with Me") are now injected with inline SVG primitives and updated classes to match the zero-border-radius design spec.

## 8. Extension Manifest & Security Policies
* **API Allowlisting**: Appended `https://codeforces.com/*` and `https://www.codechef.com/*` to the `host_permissions` manifest array to permit outbound background fetching.
* **Strict Content Security**: Updated `content_security_policy` to securely permit `fonts.googleapis.com` and `fonts.gstatic.com` for dynamic font loading without violating Chrome Web Store requirements. Added `identity` to permissions for standard OAuth handling.
* **Content Script Execution**: Added a dedicated `codeforces.js` entry point explicitly configured with `"run_at": "document_start"` to track behavior on codeforces domains.

## 9. Package Management & Dependency Cleanup
* **Pruned Dead Code & Asset Purge**: Nuked obsolete legacy release bundles (`lamigo_v1.4.0_release.zip`, `lamigo_v1.5.0_release.zip`), patch logs (`app_css_diff.patch`), and HTML scratchpads (`codechef.html`, `test-codechef.js`).
* **Orphaned Components**: Deleted React files that were entirely detached from the application tree (`Spinner.tsx`, `StreakBadge.tsx`, `college-stats.ts`, `request-cache.ts`).
* **Export Cleanup**: Stripped out unused `UI_CONSTANTS`, unimported rate limiters (`syncRateLimiter`), duplicate default exports (`FriendCard`), and unused skeleton modules (`SkeletonLine`, `SkeletonRect`) resulting in a heavily optimized build graph.
* **Package Manifest**: Purged `@testing-library/react` and `style-loader` while properly locking down newly introduced `lucide-react`, `ws`, and `react-is` dependencies in the `package-lock.json`.

## 10. Type Safety Verification
* **Internal Typing Checks**: Preserved necessary internal interfaces (like `RatingHistoryEntry`) and resolved generic prop errors on SVG mappings. The system strictly passes `tsc --noEmit` and passes all `ts-jest` environment configurations.

## 11. Storage, Sync & Reminders
* **GitHub Backups**: Added an option to safely back up your settings and tracked friends to your GitHub account.
* **Upcoming Contest Alarms & Chrome Notifications (`src/services/alarms.ts` & `src/background/background.ts`)**:
  * **Unified Reminders Schema**: Developed `AlarmsService.toggleReminder` to manage user-selected contests. Reminders are saved under the `contest_reminders` key in `chrome.storage.local`.
  * **Dynamic Chrome Alarms Generation**: When a user registers a reminder for a contest, `AlarmsService` maps the contest's start time and generates three separate alarms (`contest-{id}-24h`, `contest-{id}-1h`, and `contest-{id}-10m`) scheduled at exactly 24 hours, 1 hour, and 10 minutes before the start time using `chrome.alarms.create`.
  * **Background Event Listener**: Registered a background handler in `chrome.alarms.onAlarm` that matches `contest-` prefixes. It extracts the contest ID and time interval, retrieves the reminder info from storage, and triggers high-priority desktop notifications via `chrome.notifications.create` (forcing `requireInteraction: true` for the 10-minute warning to ensure users do not miss the contest start).
  * **Clean Tear-Down**: Implemented `clearAlarms` to cleanly deregister all three alarm instances from the browser scheduler when a user un-bookmarks or toggles off a contest reminder.
* **Interactive Upcoming Contest Reminders**: Added a Bell icon toggle (`<Bell />` and `<BellRing />` using Lucide vectors) next to each contest in `UpcomingContests.tsx`.
* **Proactive Permission Requesting**: Prompts users for Chrome `"notifications"` permission using `chrome.permissions.request` when toggling a contest reminder if not previously granted.
* **Contest Countdown Timers**: Configured `UpcomingContests.tsx` to compute and display a live countdown (`Starts in {h}h {m}m {s}s`) for contests starting within 24 hours, updating dynamically using React hooks. Localized date/time is shown for later events, and the upcoming contests section is hidden entirely if no schedules remain.
* **Onboarding Device Flow Auth**: Integrates the GitHub Device Flow Authentication (`Verification Link` and `8-character User Code`) directly in `Onboarding.tsx` alongside local JSON backup imports.
* **Dynamic Toast Actions**: Upgraded the `Toast` notification component (`src/popup/Toast.tsx`) to accept custom action triggers (`action?: { label: string; onClick: () => void }`) allowing inline interactive buttons (e.g. undo, refresh) styled with theme variables.
* **Live Sync Toasts**: When you submit a solution on LeetCode, a small popup will now let you know when it successfully syncs to GitHub.
* **Identity System**: Refactored how friends are stored, allowing a single "Friend" identity to link to LeetCode, Codeforces, and CodeChef accounts simultaneously.
* **Import/Export**: Added a tool to easily download your configuration as a JSON file, or restore it if you move to a new computer.
* **Unified Identity Storage & Schema Upgrade (`src/services/storage.ts`)**: Re-engineered the storage layer to handle the `friend_identities_v2` schema. Links a single friend to multiple handles across platforms and runs automatic schema migrations on startup to convert legacy `friends` data structures safely.

