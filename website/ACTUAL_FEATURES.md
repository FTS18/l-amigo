I'll create a new comprehensive docs based on the actual codebase. Let me write this to a temporary file first to show you the structure, then we can update docs.html.

**ACTUAL FEATURES FOUND:**

## Tab 1: FRIENDS
- Add/remove friends (up to 50)
- View friend cards with:
  - Total problems solved (Easy/Medium/Hard breakdown)
  - Current streak
  - Last submission time
  - Recent submissions list
  - Contest rating & rank
 - Sort by: Name, Problems Solved, Last Submitted
- Individual friend refresh
- Refresh all friends
- Search/filter
- Problem Recommendations section

## Tab 2: COMPARE  
- Select multiple friends to compare
- Side-by-side comparison of:
  - Total solved
  - Easy/Medium/Hard breakdown
  - Current streak
  - Contest rating
  - Rank
  - Submission activity charts
- Difficulty breakdown charts
- Activity timeline graphs

## Tab 3: SETTINGS
### GitHub Sync
- Connect GitHub with Personal Access Token
- Set repository name  
- Full sync of all accepted solutions
- Creates organized folder structure
- Progress tracking during sync
- Last sync timestamp

### General Settings
- Own username management
- Dark mode toggle
- Notifications toggle
- Auto-refresh toggle
- Refresh interval (15min, 30min, 1hr, 2hr)
- Clear all data

### Export
- Export as CSV (simple)
- Export as Detailed CSV (with all metrics)
- Export as JSON

## Other Features
- Keyboard shortcuts (r=refresh, j/k=navigate, 1/2/3=switch tabs)
- Toast notifications
- Modal confirmations
- Skeleton loading states
- Caching (15min) to avoid rate limits
- Batch API requests (3 at a time)
- URL support (can paste LeetCode profile URLs)

Should I proceed with rewriting the entire docs.html with this accurate information?
