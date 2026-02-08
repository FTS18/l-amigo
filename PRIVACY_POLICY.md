# Privacy Policy for L'Amigo

**Last Updated:** February 8, 2026

## Overview
L'Amigo is a Chrome extension that helps you track your LeetCode progress and sync your accepted submissions to GitHub. We take your privacy seriously.

## Data Collection
L'Amigo collects and stores the following data **locally on your device only**:
- LeetCode usernames (yours and friends you add)
- LeetCode submission data (problem titles, submission times, programming languages)
- GitHub personal access token (for syncing)
- GitHub repository name
- Extension settings (dark mode, notifications, refresh intervals)

## Data Storage
- **All data is stored locally** using Chrome's storage API (`chrome.storage.local`)
- **No data is sent to our servers** - we don't operate any backend servers
- Data syncs directly between:
  - Your browser and LeetCode.com (to fetch submissions)
  - Your browser and GitHub.com (to push code to your repository)

## Third-Party Services
The extension communicates with:
1. **LeetCode.com** - To fetch your submissions and friend profiles
2. **GitHub.com** - To sync your code to your personal repository

These services have their own privacy policies:
- LeetCode: https://leetcode.com/privacy-policy/
- GitHub: https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement

## Permissions
L'Amigo requires the following permissions:
- `storage` - To save your settings and submission data locally
- `unlimitedStorage` - To store large amounts of submission data
- `alarms` - For periodic background refresh
- `notifications` - To notify you of friends' new submissions
- `cookies` - To authenticate with LeetCode (CSRF token)
- `host_permissions` for leetcode.com and api.github.com - To fetch data from these sites

## Data Security
- Your GitHub token is stored locally in Chrome's encrypted storage
- We never log, transmit, or share your personal data
- All communications with LeetCode and GitHub use HTTPS

## Data Deletion
To delete your data:
1. Uninstall the extension from Chrome
2. All locally stored data will be automatically removed

## Changes to This Policy
We may update this privacy policy from time to time. Updates will be posted on this page.

## Contact
For questions about this privacy policy, please open an issue at:
https://github.com/YOUR_USERNAME/lamigo/issues

---

**Your Privacy Rights:**
- You control all data stored by this extension
- You can delete all data at any time by uninstalling
- No data is shared with third parties beyond LeetCode and GitHub (which you directly authorize)
