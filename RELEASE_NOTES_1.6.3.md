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
