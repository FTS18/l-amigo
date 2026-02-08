# L'Amigo - Advanced LeetCode Squad Analytics and Automation

L'Amigo is a sophisticated browser extension engineered for competitive programmers, software engineers, and technical interview candidates. The platform provides a comprehensive suite of analytics, peer-tracking metrics, and automation tools designed to optimize the LeetCode preparation workflow. By integrating directly into the LeetCode environment, L'Amigo bridges the gap between individual practice and collaborative competitive growth.

## Core Architectural Components

### Native UI Injection Engine
The extension utilizes a high-frequency MutationObserver paired with a target-specific injection algorithm to modify the LeetCode Document Object Model (DOM) in real-time. 
- **Dynamic Content Injection**: The engine identifies the profile identity block on LeetCode user pages and prepends custom action containers.
- **State-Aware UI**: Buttons dynamically reflect the tracking status of a profile (e.g., updating from "Track" to a checkmark status) by cross-referencing the local SQLite-based storage.
- **Persistence Layer**: The injection logic is designed to survive React-based partial page updates, which frequently clear non-React-managed DOM elements.

### Advanced Squad Analytics Dashboard
The primary user interface, accessible via the extension popup, serves as a high-fidelity control center for peer monitoring.
- **Quantitative Performance Metrics**: Aggregates problem solve counts across three difficulty tiers—Easy, Medium, and Hard—providing a granular view of a user's technical breadth.
- **Visual Statistical Modeling**: Implements SVG-based rendering through the Recharts library to visualize difficulty distribution, allowing for rapid identification of problem-solving patterns.
- **Consistency and Momentum Analysis**: Derived from historical submission data, the system calculates current and historical solving streaks, providing a metric for consistency that raw solve counts often obscure.
- **Interactive Submission Timeline**: Provides a recursive expansion view of the most recent five accepted submissions for every tracked peer, including direct deep-links to specific problem statements.

### Peer Comparison Infrastructure
The Comparison module is built on a custom data-aggregator that facilitates head-to-head analysis of multiple entities.
- **Topic Mastery Profiling**: The system performs a frequency analysis on the tags associated with a user's solved problems to extract their Top 5 domain specialties (e.g., Graph Theory, Dynamic Programming, Heap).
- **Competitiveness Benchmarking**: Integrates LeetCode Contest Ratings and Global Ranking positions to provide a comprehensive competitiveness index.
- **Multi-Entity Grid**: Supports simultaneous comparison of up to 50 profiles with a responsive layout that prioritizes high-impact metrics.

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

### Method 1: End-User Installation (Pre-built Release)
This method is recommended for users who wish to utilize L'Amigo without maintaining a local development environment.
1. Navigate to the official L'Amigo GitHub repository and access the **Releases** section.
2. Download the distribution package: `lamigo_v1.4.0_release.zip`.
3. Extract the ZIP archive contents to a persistent local directory.
4. Open the Google Chrome browser and navigate to `chrome://extensions/`.
5. Activate **Developer mode** using the toggle in the upper-right corner.
6. Click the **Load unpacked** button and select the directory containing the extracted release files.

### Method 2: Developer Installation (Build from Source)
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

## Future Development Roadmap
- **Collaborative Squads**: Implementation of optional peer-to-peer data sharing for private community leaderboards.
- **Advanced Submission Filter**: Capability to filter peer submissions by programming language or specific timeframes.
- **Integration with Codeforces**: Expansion of tracking capabilities to include other major competitive programming platforms.
- **Code Execution Analysis**: Statistical tracking of submission success rates (Accepted vs. Runtime Error/TLE).

## License
L'Amigo is licensed under the MIT License. Commercial use, modification, and distribution are permitted provided that the original copyright and license notice are included in all copies or substantial portions of the software.
