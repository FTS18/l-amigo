# Changelog

All notable changes to the LeetCode Friend Tracker extension.

## [1.3.0] - 2026-02-03

### Added
- 🔍 **Compare Tab**: Side-by-side comparison of up to 3 friends with selectable grid
- 🎨 **Compact Friend Card Design**: Horizontal layout with donut chart on right side
- 📂 **Collapsible Submissions**: Arrow icon to expand/collapse last 5 submissions
- 🎓 **Onboarding Modal**: First-time setup asking for your LeetCode username
- ⌨️ **Keyboard Shortcuts**: 
  - `J/K` - Navigate up/down in friend list
  - `R` - Refresh all data
  - `1/2/3` - Switch between tabs
  - `ESC` - Close overlays
- 📊 **Three-Tab Navigation**: Friends / Compare / Sync tabs
- 🛡️ **Own Username Protection**: Prevents accidentally tracking yourself

### Technical
- Created `CompareTab` component for friend comparisons
- Created `Onboarding` component for first-time setup
- Added `useKeyboardShortcuts` custom hook
- Redesigned `FriendCard` with compact horizontal layout
- Enhanced navigation with keyboard support
- Improved state management for selected friends

## [1.2.0] - 2026-02-02

### Added
- 📑 **Two-Tab Interface**: Separate tabs for Friends and Sync settings
- ⚙️ **Comprehensive Sync Settings**: Dedicated page for all sync options
- 🔄 **Background Auto-Refresh**: Toggle for automatic data updates
- 🔔 **Notification System**: Alerts for sync updates
- 🎨 **Reduced Emoji Usage**: Replaced emojis with icons for cleaner UI

### Technical
- Created `TabNav` component for tab navigation
- Created `SyncTab` component with comprehensive settings
- Restructured app layout for tabbed interface

## [1.1.0] - 2026-02-02

### Added
- 📈 **Difficulty Distribution Charts**: Visual pie charts showing problem difficulty breakdown using Chart.js
- 🔥 **Streak Tracking**: Display current and longest solving streaks for each friend
- 💡 **Problem Recommendations**: Get problem suggestions based on what your friends are solving
- 📥 **CSV Export**: Export friend data in basic or detailed CSV formats
- 🌙 **Dark Mode**: Toggle between light and dark themes with persistent preference
- ☁️ **GitHub Sync**: Backup and restore data to/from private GitHub Gist
- 📊 **Enhanced Stats Display**: Improved card layout with charts and streak badges
- ⋯ **Menu System**: Added dropdown menu for export options
- 🎨 **UI Improvements**: Better visual hierarchy and dark mode support throughout

### Technical
- Added Chart.js and react-chartjs-2 dependencies
- Created new services: export, streak, recommendations, github
- Implemented GitHub Gist API integration
- Enhanced storage service with profile caching
- Added dark mode CSS variables and transitions
- Improved component modularity

## [1.0.0] - Initial Release

### Added
- ✅ Friend management (add/remove by username)
- 📊 Problem statistics (Easy/Medium/Hard)
- 🏆 Contest ratings and rankings
- 📝 Recent submissions tracking
- 🔄 Auto-refresh every hour
- 🔔 Notifications for new submissions
- 🎯 Sorting options (name, problems, recent)
- Chrome Extension Manifest V3
- React + TypeScript frontend
- Webpack build system
