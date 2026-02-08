# Changelog
 
 All notable changes to the L'Amigo (formerly LeetCode Friend Tracker) extension.
 
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
