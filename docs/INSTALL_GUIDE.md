# 🎉 LeetCode Friend Tracker - Installation Guide

## ✅ Extension is Built and Ready!

Your extension has been successfully built and is located in the `dist/` folder.

## 📦 How to Load the Extension in Chrome

1. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Or click: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the **top-right corner**

3. **Load the Extension**
   - Click the "**Load unpacked**" button
   - Navigate to and select: `C:\Users\dubey\extension\dist`
   - Click "Select Folder"

4. **Verify Installation**
   - You should see "LeetCode Friend Tracker" appear in your extensions list
   - The extension icon should appear in your toolbar

## 🚀 How to Use

1. **Click the extension icon** in your Chrome toolbar
2. **Add a friend**: Enter any LeetCode username (e.g., "tourist", "Errichto") and click "Add Friend"
3. **View comprehensive stats**: 
   - Problems solved with Easy/Medium/Hard breakdown
   - Visual difficulty distribution chart
   - Current solving streak (🔥 badge)
   - Contest ratings and rankings
   - Recent 3 submissions
4. **Get recommendations**: Click "💡 Problem Recommendations" to discover problems your friends have solved
5. **Export your data**: Click the menu button (⋯) to export friend data as CSV
6. **Setup GitHub Sync** (optional):
   - Click "⚙️ GitHub Sync"
   - Create a token at https://github.com/settings/tokens with `gist` scope
   - Enter token to backup/restore data across devices
7. **Toggle dark mode**: Click 🌙/☀️ button for light/dark theme
8. **Refresh data**: Click "🔄" to manually update all friends
9. **Sort friends**: Use dropdown to sort by name, problems, or recent activity
10. **Remove friends**: Click × button on any card

## 🔧 Development Commands

- **Build for production**: `npm run build`
- **Development mode** (auto-rebuild): `npm run dev`
- **Type checking**: `npm run type-check`

## 📋 Features

✅ Track multiple friends by LeetCode username  
✅ View problem statistics (Easy/Medium/Hard breakdown)  
✅ Visual difficulty distribution charts (Chart.js)  
✅ Solving streak tracking with 🔥 badges  
✅ See contest ratings and global rankings  
✅ Monitor recent submissions (last 3 per friend)  
✅ Problem recommendations based on friends' activity  
✅ Export data to CSV (basic & detailed formats)  
✅ Auto-refresh every hour via background service  
✅ Get notifications when friends solve new problems  
✅ Dark mode with persistent theme preference  
✅ GitHub Gist sync for backup/restore across devices  
✅ Sort and filter your friends list  
✅ Clean, modern UI with responsive design  

## 🐛 Troubleshooting

**Extension not loading?**
- Make sure you selected the `dist` folder, not the root `extension` folder
- Check that all files are present in the `dist` folder

**Data not loading?**
- Check your internet connection
- Verify the username is correct (usernames are case-insensitive)
- LeetCode's API may occasionally be slow or rate-limited

**TypeScript errors in VS Code?**
- These are just editor warnings
- The extension builds and runs successfully despite these warnings
- Run `npm run build` to verify everything compiles correctly

## 📝 Next Steps

Want to enhance the extension? Check out the future enhancements list in [README.md](README.md):
- Add charts and visualizations
- Implement streak tracking
- Export data functionality
- Dark mode support
- And more!

## 🎯 Testing Suggestions

Try adding these popular LeetCode users to see the extension in action:
- `tourist` - Competitive programming legend
- `Errichto` - Popular YouTuber
- `tmwilliamlin168` - Top rated competitor
- Or add your own username!

---

**Enjoy tracking your friends' LeetCode progress!** 🚀
