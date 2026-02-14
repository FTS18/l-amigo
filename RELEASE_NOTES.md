# v1.5.0

Major stability and architecture update. We've hardened the extension for production and completely refactored the background service.

### 🛡️ Security
- **Content Security Policy**: Added strict CSP headers to `manifest.json`.
- **Sanitization**: All user inputs and storage data are now sanitized to prevent injection.
- **Rate Limiting**: Added throttling to API requests to prevent bans.

### 🏗️ Architecture
- **SOLID Refactoring**: Split the monolithic `background.ts` into small, testable handlers (`FriendHandler`, `SyncHandler`, etc.) using the Command pattern.
- **Type Safety**: Fixed all `any` types. Full strict mode compliance.

### ⚡ Reliability
- **Retry Logic**: Network requests now use exponential backoff.
- **Circuit Breaker**: Stops failing requests automatically when APIs are down.
- **Performance**: Added `React.memo` to `FriendCard` to stop unnecessary re-renders.

### 📊 Tests
- Added **58 unit tests** reaching **89% code coverage**.

### 📦 Install
1. Download `lamigo_v1.5.0_release.zip`.
2. Load unpacked in Chrome.
