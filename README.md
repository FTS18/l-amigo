# LeetCode Friend Tracker

A Chrome extension to track your friends' LeetCode progress and activity.

## Features

- ✅ **Friend Management**: Add/remove friends by LeetCode username
- 📊 **Problem Statistics**: View total problems solved (Easy/Medium/Hard breakdown)
- 📈 **Difficulty Distribution Charts**: Visual pie charts showing problem difficulty breakdown
- 🔥 **Streak Tracking**: Track current and longest solving streaks for each friend
- 🏆 **Contest Ratings**: See contest ratings and rankings
- 📝 **Recent Submissions**: Track the latest 3 problems solved by each friend
- 💡 **Problem Recommendations**: Get problem suggestions based on what friends are solving
- 📥 **CSV Export**: Export friend data to CSV (basic and detailed formats)
- 🔄 **Auto-Refresh**: Automatic background sync every hour
- 🔔 **Notifications**: Get notified when friends solve new problems
- 🌙 **Dark Mode**: Toggle between light and dark themes
- ☁️ **GitHub Sync**: Backup and restore your data to a private GitHub Gist
- 🎯 **Sorting Options**: Sort by name, problems solved, or recent activity

## Installation

### Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the extension**:
   ```bash
   npm run build
   ```
   
   For development with auto-rebuild:
   ```bash
   npm run dev
   ```

3. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

## Usage

1. **Click the extension icon** in your Chrome toolbar
2. **Add a friend**: Enter any LeetCode username (e.g., "tourist", "Errichto") and click "Add Friend"
3. **View stats**: See their problems solved, contest rating, recent submissions, and difficulty distribution chart
4. **Track streaks**: View current and best solving streaks with the 🔥 badge
5. **Get recommendations**: Click "💡 Problem Recommendations" to see problems your friends have solved
6. **Export data**: Click the menu (⋯) to export friend data as CSV
7. **GitHub Sync**: Backup your data to GitHub for safekeeping and sync across devices
8. **Toggle theme**: Click the 🌙/☀️ button to switch between light and dark mode
9. **Refresh data**: Click "🔄" to manually update all friends' information
10. **Sort friends**: Use the dropdown to sort by name, problems solved, or recent activity
11. **Remove friends**: Click the × button on any friend card

## Data Fetching

The extension uses LeetCode's GraphQL API to fetch:
- User profile information (name, avatar, ranking)
- Problem statistics (total, easy, medium, hard)
- Contest ratings and rankings
- Recent accepted submissions (last 10)
- Streak calculation based on submission history

Data is cached locally and refreshed automatically every hour, or manually via the "🔄" button.

### GitHub Sync

Optionally sync your data to GitHub:
1. Create a Personal Access Token at https://github.com/settings/tokens with `gist` scope
2. Click "⚙️ GitHub Sync" in the extension
3. Enter your token and click "Connect GitHub"
4. Use "☁️ Backup to GitHub" to save your data
5. Use "⬇️ Restore from GitHub" to retrieve your data on another device

Your data is stored in a private GitHub Gist and never shared publicly.

## Tech Stack

- **Frontend**: React + TypeScript
- **Charts**: Chart.js + react-chartjs-2
- **Build Tool**: Webpack
- **Storage**: Chrome Storage API
- **Sync**: GitHub Gist API
- **Manifest**: V3 (latest Chrome extension format)

## Project Structure

```
extension/
├── public/
│   ├── manifest.json       # Extension manifest
│   └── popup.html          # Popup HTML template
├── src/
│   ├── background/
│   │   └── background.ts   # Background service worker
│   ├── popup/
│   │   ├── App.tsx         # Main app component
│   │   ├── App.css         # Styles (with dark mode)
│   │   ├── FriendCard.tsx  # Friend card component
│   │   ├── AddFriendForm.tsx
│   │   ├── DifficultyChart.tsx  # Chart.js visualization
│   │   ├── StreakBadge.tsx      # Streak display
│   │   ├── Recommendations.tsx  # Problem recommendations
│   │   ├── GitHubSync.tsx       # GitHub sync UI
│   │   └── popup.tsx       # Entry point
│   ├── services/
│   │   ├── storage.ts      # Chrome storage wrapper
│   │   ├── leetcode.ts     # LeetCode API service
│   │   ├── export.ts       # CSV export service
│   │   ├── streak.ts       # Streak calculation
│   │   ├── recommendations.ts  # Problem recommendations
│   │   └── github.ts       # GitHub Gist sync
│   └── types/
│       └── index.ts        # TypeScript interfaces
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## Future Enhancements

- [ ] Weekly/monthly progress reports
- [ ] Compare stats between friends
- [ ] Topic-based problem recommendations
- [ ] Browser notifications for friend milestones
- [ ] Custom refresh intervals
- [ ] Filter by difficulty level
- [ ] Search friends by username
- [ ] Import/export in JSON format
- [ ] Leaderboard view

## Notes

- LeetCode's API is not officially documented and may change
- Rate limiting is handled with delays between requests
- Usernames are case-insensitive
- Only public profile data is accessible

## License

MIT
