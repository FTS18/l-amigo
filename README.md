# L'Amigo - LeetCode Peer Progress and Automation

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-orange?logo=googlechrome)](https://chromewebstore.google.com/detail/lamigo/pakknkopmiakipmbjmfejcejehmgieli)
[![Version](https://img.shields.io/badge/version-1.5.0-blue)](https://github.com/FTS18/l-amigo/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/FTS18/l-amigo?style=social)](https://github.com/FTS18/l-amigo)

L'Amigo is a browser extension engineered for competitive programmers and software engineering candidates to monitor peer performance and automate personal progress management. By integrating directly into the LeetCode environment, L'Amigo enables users to track friend activity, perform detailed statistical comparisons, and maintain an automated repository of their own solved problems on GitHub.

## Core Architectural Components

### Native UI Injection Engine
The extension utilizes a MutationObserver to modify the LeetCode Document Object Model (DOM) in real-time, providing immediate access to peer tracking tools.
- **Dynamic Action Buttons**: Adds "Track" and "Compare" utilities directly to any LeetCode user profile without requiring manual navigation.
- **Status Persistence**: Buttons cross-reference the local browser storage to provide real-time tracking status indicators.
- **Non-Invasive Integration**: Designed to operate seamlessly within LeetCode's React-based dynamic interface.

### Peer Progress Dashboard
The extension popup serves as a centralized interface for monitoring your tracked friends.
- **Individual Performance Cards**: Provides a granular view of total solved problems, difficulty breakdowns (Easy, Medium, Hard), and current activity streaks.
- **Visual Pattern Analysis**: Uses Recharts to render SVG-based distribution charts, helping users identify their peers' solving habits.
- **Submission History**: Extracts and displays the five most recent accepted problems for each tracked friend, including direct links to problem statements.

### Head-to-Head Comparison
The Comparison module allows users to perform deep-dive analytics by selecting multiple friends for side-by-side evaluation.
- **Topic Proficiency**: Analyzes public solve data to identify a user's top five mastered topics (e.g., Dynamic Programming, Graph Theory).
- **Competitiveness Index**: Compares LeetCode Contest Ratings and Global Rankings in a unified grid.
- **Interactive Metrics**: Highlights highest performers across different statistical categories for rapid comparison.

### Automated GitHub Solution Repository Sync
L'Amigo automates the preservation of the user's solved problem library by synchronizing accepted submissions with a dedicated GitHub repository.
- **Incremental Sync Algorithm**: The service worker implements a state-check mechanism that compares local submission records with the remote repository tree to ensure only new or modified solutions are pushed, minimizing API traffic and avoiding rate-limiting.
- **Static File Generation**: Solutions are converted from raw submission data into structured source files with appropriate naming conventions and file extensions based on the runtime environment (e.g., .cpp, .py, .go).
- **OAuth-Free Security**: To maximize user privacy, the extension uses Personal Access Tokens (PATs) stored exclusively within the browser's encrypted local storage via the Chrome Storage API. No external authentication servers or redirect URIs are utilized.

## Technical Specifications

### Tech Stack
- **Framework**: React 18 (Functional Components, Hooks)
- **Programming Language**: TypeScript (Strict Mode)
- **Data Visualization**: Recharts (SVG)
- **Bundler**: Webpack 5 with Hot Module Replacement (HMR) capabilities
- **Storage System**: Chrome Storage Local API (Asynchronous)
- **Style Engine**: Vanilla CSS with CSS Variables for dynamic Dark Mode implementation
- **API Interfaces**: LeetCode GraphQL API, GitHub REST API v3

### Data Lifecycle and Security
1. **Ingestion**: Data is fetched client-side directly from LeetCode servers via secure GraphQL queries.
2. **Processing**: Raw JSON responses are transformed into normalized Squad Objects within the extension's service layer.
3. **Persistence**: Objects are serialized and stored in `chrome.storage.local`.
4. **Synchronization**: Solutions are pushed via encrypted HTTPS requests to `api.github.com`.
5. **Security**: All credentials (GitHub PATs) are obfuscated within local storage. No telemetry or analytics data is ever transmitted to any third-party infrastructure.

## Installation and Deployment

### Method 1: Chrome Web Store (Recommended)
The easiest way to install L'Amigo is directly from the Chrome Web Store:

[![Add to Chrome](https://img.shields.io/badge/Add%20to-Chrome-orange?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/lamigo/pakknkopmiakipmbjmfejcejehmgieli)

1. Click the badge above or visit the [Chrome Web Store page](https://chromewebstore.google.com/detail/lamigo/pakknkopmiakipmbjmfejcejehmgieli)
2. Click "Add to Chrome"
3. Confirm the installation when prompted
4. The L'Amigo icon will appear in your browser toolbar

### Method 2: Pre-built Release (Manual Installation)
This method is recommended for users who wish to utilize L'Amigo without maintaining a local development environment.
1. Navigate to the official L'Amigo GitHub repository and access the **Releases** section.
2. Download the distribution package: `lamigo_v1.5.0_release.zip`.
3. Extract the ZIP archive contents to a persistent local directory.
4. Open the Google Chrome browser and navigate to `chrome://extensions/`.
5. Activate **Developer mode** using the toggle in the upper-right corner.
6. Click the **Load unpacked** button and select the directory containing the extracted release files.

### Method 3: Developer Installation (Build from Source)
Use this method if you intend to contribute to the codebase or utilize the most recent unreleased features.
1. Clone the repository and navigate to the project root:
   ```bash
   git clone https://github.com/FTS18/l-amigo.git
   cd l-amigo
   ```
2. Install the required dependencies:
   ```bash
   npm install
   ```
3. Generate the production distribution using the build pipeline:
   ```bash
   npm run build
   ```
4. Open `chrome://extensions/` in the browser and ensure **Developer mode** is active.
5. Click **Load unpacked** and choose the `dist/` directory generated in the previous step.

### Project Architecture
The codebase is structured into specialized modules to facilitate development scalability:
- **src/content**: Logic for LeetCode DOM manipulation and submission monitoring.
- **src/background**: Service worker for periodic data synchronization and alarm management.
- **src/popup**: React-based architecture for the main user dashboard and configuration views.
- **src/services**: Abstraction layer for API communications and internal data persistence.
- **website**: Source for the product landing page and promotional assets.

## Documentation
For more detailed information, please refer to:
- [Contributing Guidelines](docs/CONTRIBUTING.md)
- [Changelog](docs/CHANGELOG.md)
- [Privacy Policy](docs/PRIVACY_POLICY.md)

## Keyboard Shortcuts

L'Amigo includes built-in keyboard shortcuts for power users:

| Shortcut | Action |
|----------|--------|
| `r` | Refresh all friends |
| `j` | Navigate down in friends list |
| `k` | Navigate up in friends list |
| `1` | Switch to Friends tab |
| `2` | Switch to Compare tab |
| `3` | Switch to Settings tab |
| `Esc` | Close menu |

## Future Development Roadmap
- **Collaborative Squads**: Implementation of optional peer-to-peer data sharing for private community leaderboards.
- **Advanced Submission Filter**: Capability to filter peer submissions by programming language or specific timeframes.
- **Integration with Codeforces**: Expansion of tracking capabilities to include other major competitive programming platforms.
- **Code Execution Analysis**: Statistical tracking of submission success rates (Accepted vs. Runtime Error/TLE).

## License
L'Amigo is licensed under the MIT License. Commercial use, modification, and distribution are permitted provided that the original copyright and license notice are included in all copies or substantial portions of the software.
