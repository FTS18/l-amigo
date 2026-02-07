# LeetCode Friend Tracker - Features Guide

## Overview
Track your friends' LeetCode progress with comprehensive statistics, comparisons, and insights.

---

## 🎯 Core Features

### Friend Management
- **Add Friends**: Enter any LeetCode username to start tracking
- **Remove Friends**: One-click removal from your tracking list
- **Auto-Update**: Background sync to keep data fresh
- **Own Username Protection**: Prevents tracking yourself (set during onboarding)

### Statistics Dashboard
Each friend card displays:
- **Total Problems Solved** (with breakdown by difficulty)
- **Easy/Medium/Hard Count** with color-coded badges
- **Current Solving Streak** 🔥 (consecutive days)
- **Best Streak Record** 📊 (all-time highest)
- **Contest Rating** 🏆 (if participated)
- **Real Name** (from LeetCode profile)
- **Avatar** (profile picture)

### Recent Activity
- **Last 5 Submissions**: Collapsible section with arrow toggle
- **Problem Titles**: Clickable links to LeetCode problems
- **Timestamps**: When each problem was solved
- **Compact View**: Expandable to save space

---

## 📊 Visualization

### Difficulty Distribution Chart
- **Donut Chart** positioned on right side of each card
- **Color-Coded**: 
  - 🟢 Green = Easy
  - 🟡 Yellow = Medium  
  - 🔴 Red = Hard
- **Percentage Breakdown**: Visual representation of problem distribution
- **Powered by Chart.js**: Smooth animations and interactions

---

## 🔍 Compare Tab

### Side-by-Side Comparisons
- **Select Up to 3 Friends**: Multi-select from friend grid
- **Comparison Cards**: Individual cards for each selected friend
- **Comprehensive Stats**:
  - Total solved problems
  - Difficulty breakdown
  - Streak information
  - Contest rating
  - Difficulty chart
- **Responsive Grid**: Auto-adjusts based on screen size

### Use Cases
- See who's solving more problems
- Compare difficulty preferences
- Track competitive progress
- Identify learning patterns

---

## ⚙️ Sync & Settings Tab

### Auto-Refresh
- **Background Sync**: Automatic data updates
- **Configurable Interval**: Set refresh frequency
- **Manual Refresh**: Button to force update

### GitHub Gist Backup
- **Cloud Backup**: Save data to private GitHub Gist
- **Cross-Device Sync**: Access your data anywhere
- **Restore**: Import data from Gist
- **Privacy**: Uses private Gists only

### Export Options
- **CSV Export**: Download friend data
- **Basic Format**: Username, total solved, easy/medium/hard
- **Detailed Format**: Includes streaks, ratings, recent submissions

### Notifications
- **Update Alerts**: Get notified when friends solve problems
- **Sync Status**: Visual feedback for background operations

---

## ⌨️ Keyboard Shortcuts

### Navigation
- `J` - Move down in friend list
- `K` - Move up in friend list
- `1` - Switch to Friends tab
- `2` - Switch to Compare tab
- `3` - Switch to Sync tab

### Actions
- `R` - Refresh all data
- `ESC` - Close modals/overlays

### Tips
- Shortcuts work from any tab
- Visual indicators show current selection
- Combine with mouse for hybrid navigation

---

## 💡 Smart Features

### Problem Recommendations
- **Based on Friends' Activity**: See what problems your friends are solving
- **Difficulty Filter**: Get recommendations by difficulty level
- **Problem Links**: Direct links to try the problems
- **Refresh Suggestions**: Update recommendations anytime

### Streak Tracking
- **Daily Streak**: Consecutive days with at least 1 submission
- **Best Streak Badge**: Highlights all-time record
- **Visual Indicator**: Fire emoji with gradient background
- **Motivation**: Track consistency over time

---

## 🎨 Customization

### Dark Mode
- **Toggle Switch**: Easy on/off control
- **Persistent**: Remembers your preference
- **Full Coverage**: All UI elements adapt
- **Eye-Friendly**: Reduced strain for night coding

### Compact Layout
- **Information-Dense**: More data in less space
- **Horizontal Cards**: Chart on right, info on left
- **Collapsible Sections**: Show/hide details as needed
- **Responsive**: Adapts to popup size

---

## 🎓 Onboarding

### First-Time Setup
When installing the extension for the first time:
1. **Welcome Modal** appears
2. **Enter Your Username** (optional but recommended)
3. **Feature Overview**: Learn about capabilities
4. **Keyboard Shortcuts Guide**: Quick reference
5. **Skip Option**: Can start without setup

### Why Enter Your Username?
- Prevents accidentally adding yourself to friends list
- Better recommendations (excludes your solved problems)
- Cleaner comparisons (no self-comparison)

---

## 🚀 Getting Started

### Installation
1. Load extension in Chrome (Developer Mode)
2. Complete onboarding (enter your username)
3. Click extension icon in toolbar
4. Add your first friend

### Adding Friends
1. Type LeetCode username in input field
2. Click "Add Friend" or press Enter
3. Wait for data to load (2-3 seconds)
4. Friend card appears in list

### Comparing Friends
1. Go to Compare tab (click or press `2`)
2. Click friend avatars to select (max 3)
3. View side-by-side comparison
4. Analyze stats and charts

### Syncing Data
1. Go to Sync tab (click or press `3`)
2. Generate GitHub Personal Access Token
3. Enable GitHub Sync
4. Data automatically backs up
5. Restore on other devices

---

## 🛠️ Technical Details

### Data Sources
- **LeetCode GraphQL API**: Official unofficial API
- **Real-time Data**: Fresh from LeetCode servers
- **No Authentication Required**: Public profile data only

### Storage
- **Chrome Storage API**: Local browser storage
- **Encrypted**: Secure storage of settings
- **Backup Options**: GitHub Gist sync available

### Performance
- **Lazy Loading**: Cards load as needed (future)
- **Virtual Scrolling**: Handle 100+ friends (future)
- **Offline Cache**: View data without internet (future)
- **Background Sync**: Non-blocking updates

### Privacy
- **No Server**: All data stays in your browser
- **No Tracking**: No analytics or telemetry
- **Open Source**: Full transparency
- **Private Gists**: Backup data is private

---

## 📈 Use Cases

### For Students
- Track study group progress
- Compare learning pace
- Find problems to solve together
- Stay motivated with peers

### For Interview Prep
- Monitor preparation partners
- See trending problems
- Track consistency
- Competitive motivation

### For Teams
- Team performance overview
- Identify strong problem solvers
- Plan group practice sessions
- Celebrate achievements

### For Mentors
- Monitor mentee progress
- Identify struggle areas
- Recommend appropriate problems
- Track improvement over time

---

## 🎯 Tips & Tricks

### Maximize Productivity
1. **Use Keyboard Shortcuts**: Faster than mouse
2. **Enable Auto-Refresh**: Stay up-to-date automatically
3. **Set Up GitHub Sync**: Never lose your data
4. **Check Compare Tab Daily**: Track relative progress
5. **Export CSV Weekly**: Analyze trends in spreadsheet

### Best Practices
- Add friends with similar skill levels
- Check recommendations before solving
- Use dark mode for night sessions
- Keep friend list under 20 for performance
- Back up data before clearing browser

### Troubleshooting
- **Friend Not Loading**: Check username spelling
- **Old Data**: Click refresh button manually
- **Chart Not Showing**: Friend needs solved problems
- **Sync Failed**: Check GitHub token permissions
- **Extension Broken**: Reload extension in Chrome

---

## 🔮 Coming Soon (Future Updates)

### Offline Features
- Cache problem data for offline viewing
- Queue sync operations when offline
- Offline-first architecture

### Performance Enhancements
- Lazy load friend cards
- Virtual scrolling for 100+ friends
- Optimized bundle size
- Background service worker improvements

### New Features
- Friend groups/tags
- Custom sort options
- Problem difficulty heatmaps
- Activity timeline view
- Email digest reports

---

## 📝 Version History

**v1.3.0** - Compare tab, compact design, onboarding, keyboard shortcuts
**v1.2.0** - Two-tab interface, sync settings page
**v1.1.0** - Charts, streaks, recommendations, dark mode, GitHub sync
**v1.0.0** - Initial release with core tracking features

---

## 🤝 Support

### Found a Bug?
- Check CHANGELOG.md for known issues
- Verify you're on latest version
- Try disabling/re-enabling extension
- Clear browser cache

### Feature Request?
Ideas welcome! Consider:
- Use case and value proposition
- Technical feasibility
- UI/UX impact
- Performance implications

---

**Happy Tracking! 🚀**
