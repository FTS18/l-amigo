# Changelog
 
 All notable changes to the L'Amigo (formerly LeetCode Friend Tracker) extension.
 

 ## [1.6.3] - 2026-06-27
### Added
- **Full-Page Analytics Dashboard**: Introduced a massive new dashboard interface integrating Leaderboards, Sheets Tracker, and Contest Hub.
- **Contest Hub & Rating Vault**: Tracks upcoming contests across LeetCode, Codeforces, and CodeChef in a dense, chronological list view. Includes multi-platform rating trajectory charts and performance analytics.
- **Sheets Tracker**: Integrated 50+ curated problem sheets (Striver A2Z, CP-31, NeetCode, CSES) with automated completion sync from LeetCode and Codeforces.
- **Design & UX Overhaul**: Added dynamic CSS variable-based responsive typography (Font Size 80-150% and Display Zoom 75-125%). Implemented custom `PlatformIcons` library for crisp SVG logos.
- **Core Reliability & Architecture**: 
  - OAuth tokens are now encrypted using AES-GCM before storage, keeping secrets out of the source code via Webpack injection.
  - Smarter GitHub Sync: Implemented a 10s backoff for GitHub abuse rate limits and improved progress bar accuracy.
  - Codeforces Concurrency Queue: 2-slot concurrency-limited dispatcher with exponential backoff to respect API limits.
  - Strict type safety with `STORAGE_KEYS` registry and schema validation.
- **Bug Fixes**:
  - Fixed Codeforces handles case-sensitivity bug causing API errors.
  - Debounced heatmap injection for stability during SPA navigation.
  - Cleaned up background connection lifecycles for Service Worker restarts.

## [1.6.0] - 2026-06-15
### Added
- **CF College Standings Tab**: Injects a custom tab into Codeforces standings (`/contest/*/standings`) using `_standingsCache` memory lookup for instant rendering. Replicates Codeforces' exact native table structure (`class="standings"`, `tr class="dark"`, `verdict-accepted` with timestamp) showing team links, problem details, Legendary Grandmaster rendering (`.legendary-first-letter` coloring the first letter black), and falls back to a page scraping crawling mechanism if the members cache is empty.
- **Organization Bookmarking & Profile Shortcuts**: Added bookmarking controls on ratings page (`/ratings/organization/*`) supporting parallel page 2 fetching (up to 400 members) and profile bookmarks next to organization links. Injected Quick-Add buttons next to handles (`a[href^="/profile/"]`) in standings, rankings, and comment pages sending background message `createIdentity` on click. Hooks a `cf_dark_mode` theme listener to add `lamigo-cf-dark` class on the root element.
- **Rating-based Heatmap**: Color-codes activity graph squares based on the difficulty of the hardest problem solved on each day using Codeforces rating colors. Includes a toggle checkbox inside `_UserActivityFrame_header`, preference persistence, an interactive HSL color scale legend, memory variable resetting upon profile swaps to prevent rating leaks, and observer-safe re-draw handling for year selectors.
- **Triple-Platform Identity System**: Refactored `storage.ts` to manage `friend_identities_v2`, enabling a single friend card to track LeetCode, Codeforces, and CodeChef handles in parallel.
- **Codeforces REST API Integration**: Engineered `CodeforcesService` (`src/services/codeforces.ts`) with a static promise-chain queuing mechanism `requestQueue` enforcing a `1000ms` rate limit interval. Wrapped endpoints in a `CircuitBreaker` (threshold: 5, reset: 60s) to request basic user info, submission statuses, and rating changes concurrently. Features a 1h cache (`CACHE_TTL = 3600000` ms) mapping contest IDs to divisions (Div 1-4) by keyword filtering contest titles, dynamic difficulty evaluation (Easy: <1200, Medium: <1900, Hard: >=1900), and a plaintext solution fetcher via HTML regex match on `program-source-text`.
- **CodeChef Scraper Integration**: Built a DOM scraper in `src/services/codechef.ts` (`CodeChefService`) targeting public profiles. Extracts contest rating history arrays from the page source using regular expression matches `/jQuery\.extend\(Drupal\.settings,\s*(\{.*?\})\);/s` on the Drupal settings payload. RegEx parses user's real name via `class="h2-style"`, star ratings (1★ to 7★) via `<span class='rating'>`, max ratings by analyzing history records, and pulls plaintext solution codes using regex on `/viewplaintext/` endpoints.
- **Glassmorphic Popup Redesign**: Split monolithic `App.css` into separate base, cards, chrome, compare, settings, and profile stylesheets. Implemented blurred translucent backgrounds (`backdrop-filter: blur(12px)`), pure-CSS border shadows, and modern Bricolage Grotesque typography.
- **Advanced Recharts Graphs**: Swapped simple charts with dark-mode optimized area graphs comparing friend rating history and global ranking progressions.
- **Friend Card Performance & Contrast Adjustments**: Wrapped dashboard cards in `React.memo` using custom comparators to avoid redundant renders, and adjusted `getProfileQualityColor` HSL lightness to 34% (originally 45%) in Light Mode to meet WCAG AA contrast standards.
- **Automated GitHub State Backup**: Implemented debounced backups of settings/friends directly to user GitHub repositories, complete with background-sync notification toasts.
- **Lucide Icons**: Substituted raw emoji markers with sharp, scalable SVG primitives using `lucide-react`.
- **JSON Import/Export & Onboarding Flows**: Added backup/restore tools and integrated GitHub OAuth Device Flow (`Verification Link` and `8-character User Code`) directly in `Onboarding.tsx`, alongside local JSON import backup recovery options.
- **HMR Pipeline & Webpack Build Optimizations**: Configured `DevExtensionReloadPlugin` with WebSockets reloader, integrated `html-webpack-plugin` for dynamic asset injection in `popup.html`, configured code-splitting to isolate dependencies into a distinct `vendors.js` chunk, enabled Terser minification in production, and speeded up compilation via `cheap-source-map` devtools.
- **Dynamic Toast Notifications (`src/popup/Toast.tsx`)**: Upgraded toast alerts to support interactive action buttons (`action?: { label: string; onClick: () => void }`) styled with CSS theme tokens.
- **LeetCode Verdict Expansion & Submission Interception**: Expanded GraphQL queries in `src/services/leetcode.ts` to request `statusDisplay` alongside standard fields. Configured content script `leetcode-monitor.ts` with a MutationObserver to capture non-Accepted results (Wrong Answer, TLE). Injects green checkmark SVGs and sync state anchors on success, and enforces a `5000ms` debounce threshold to avoid sync floods. Handled negative feedback in popup feeds (`FriendCard.tsx`, `FriendProfileView.tsx`) by rendering red Lucide `<X size={12} color="#ff4444" />` icons next to problems.
- **Upcoming Contest Notifications (`src/services/alarms.ts` & `src/background/background.ts`)**: Built a multi-tier Chrome Alarms reminder system scheduling alerts at three intervals (24h, 1h, and 10m before start time) via `chrome.alarms.create` with corresponding cleanup listeners via `chrome.alarms.clear`. Handled in `background.ts` by generating high-priority chrome notifications with custom requirements (e.g. `requireInteraction` for 10-minute warnings).

### Fixed
- **Contest Hover Overlap**: Fixed overlapping hover target bugs on Codeforces contest graphs.
- **Light Mode Legibility**: Corrected contrast issues on cards and settings views under light themes.
- **Unified Identity Schema Upgrade & Migrator (`src/services/storage.ts`)**: Built a migration path for legacy storage entries on startup to safely map handles to the new `friend_identities_v2` schema.
- **Release CI Automation**: Fixed Actions workflows by removing hardcoded release notes file dependencies.
- **Codebase Cleanups**: Purged obsolete release ZIP archives, draft patch files, unimported rate limiters, unused React components, and skeleton modules.

## [1.5.0] - 2026-02-14

 ### Added
- **Production Hardening**: Comprehensive testing suite with 58 unit tests covering critical utilities.
- **Security**: Content Security Policy (CSP) headers added to `manifest.json`.
- **Reliability**: Implemented Retry logic with exponential backoff and Circuit Breaker pattern for API calls.
- **Input Validation**: Added sanitization and rate limiting for storage and network operations.
- **Architecture**: SOLID refactoring of `background.ts` into modular `MessageHandler` classes using the Command pattern.

 ### Changed
- **Testing**: Updated Jest configuration with coverage thresholds.
- **Performance**: Optimized `FriendCard` rendering with `React.memo`.
- **Documentation**: Updated README with architectural details and installation steps.

 ### Fixed
- Fixed URL validation edge cases.
- Fixed type handling in retry logic.

 ## [1.4.0] - 2026-02-09
 
 ### Added
- Native LeetCode Profile Integration: 
   - "Track with L'Amigo" button injected into user profiles.
   - "Compare with Me" button opening a side-by-side stats overlay.
   - Robust mutation observer to handle React re-renders.
- Enhanced Comparison Modal:
   - Topic-wise mastery breakdown (Top 5 skills).
   - Comparative Contest Rating and Global Ranking.
   - Premium glassmorphic UI for overlays.
- GitHub Repository Sync: 
   - Full code sync (syncing actual solutions as files to a repo).
   - Incremental syncing logic to save bandwidth and rate limits.
- Brand Identity: Officially renamed to L'Amigo with new logos and premium design language.
 
 ### Technical
 - Migrated from Chart.js to Recharts for SVG-based visualizations.
 - Optimized background service worker with targeted single-profile fetching.
 - Implemented smart caching (5-minute fresh buffer) for profile comparisons.
 - Consolidated build process and removed legacy Gist sync logic in favor of Repo Sync.
- Added ProfileManager for native content injection.
 
 ## [1.3.0] - 2026-02-03
- Improved state management for selected friends

## [1.2.0] - 2026-02-02
 
 ### Added
- Two-Tab Interface: Segregated views for Dashboard and Synchronization settings.
- Comprehensive Sync Settings: Dedicated interface for repository and background refresh options.
- Background Auto-Refresh: User-configurable toggle for periodic data updates.
- Notification System: Visual alerts for synchronization status and friend activity.
- Visual Refinement: Migration to standard iconography for a more professional aesthetic.
 
 ### Technical
 - Implementation of TabNav component for seamless view switching.
 - Development of SyncTab for centralized configuration management.
 - Refactoring of the main application entry point to support tabbed architecture.
 
 ## [1.1.0] - 2026-02-02
 
 ### Added
- Difficulty Distribution Charts: Visual data representation using Chart.js.
- Streak Tracking: Real-time calculation and display of current and personal best solving sequences.
- Problem Recommendations: Intelligent logic to suggest challenges based on peer group activity.
- Data Portability: Support for Exporting friend data in multiple CSV formats.
- Themes: Implementation of persistent Dark Mode support.
- External Sync: Initial support for data backup via GitHub Gist.
- Advanced Metrics: Enhanced friend cards with contest ratings and activity badges.
 
 ### Technical
 - Integration of Chart.js and associated React wrappers.
 - Development of backend services for export, streak logic, and GitHub integration.
 - Optimization of local storage usage with profile-level caching.
 
 ## [1.0.0] - Initial Release
 
 ### Added
- Peer Management: Basic functionality to track LeetCode profiles by username.
- Problem Statistics: Core tracking for Easy, Medium, and Hard problem counts.
- Contest Tracking: Integration of contest ratings and global leaderboard rankings.
- Submission Logs: Visibility into the most recent problem solving activity.
- Automated Refresh: Background tasks to keep data current.
- Multi-Parameter Sorting: Ability to organize the dashboard by name, solve count, or recency.
- Manifest V3 Architecture: Built on the latest Chrome extension standards.
- Technology Stack: Full integration of React, TypeScript, and Webpack.
