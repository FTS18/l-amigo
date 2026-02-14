# Privacy Policy for L'Amigo

**Version:** 1.4.0
**Effective Date:** February 9, 2026

## 1. Introduction
This Privacy Policy outlines the data processing practices of L'Amigo, a browser extension designed to facilitate LeetCode progress tracking and automated GitHub synchronization. We operate under a "Privacy by Design" framework, ensuring that user data is processed with maximum transparency and minimal risk.

## 2. Data Categories and Collection Methods
L'Amigo processes several categories of data, all of which are managed locally within the user's browser environment:
- **Identification Data**: Public LeetCode handles (usernames) and associated public profile metadata (avatars, real names).
- **Performance Data**: Quantitative metrics regarding problem-solving activity, including solve counts, difficulty distributions, and contest participation history.
- **Authentication Metadata**: User-provided GitHub Personal Access Tokens (PATs) and repository identifiers required for write-access to the user's designated repository.
- **Preference Data**: Application state variables including interface theme selections, synchronization intervals, and notification preferences.

## 3. Storage and Retention Policy
All data processed by L'Amigo is stored using the `chrome.storage.local` API. We do not maintain any centralized servers or databases; therefore, we have no capability to access, sell, or analyze your data.
- **Local Persistence**: Data remains on the user's local machine until the extension is uninstalled or the local storage is manually purged.
- **No Cloud Exposure**: Aside from direct API interactions with LeetCode and GitHub, no data is transmitted to cloud environments or third-party analytics providers.

## 4. Third-Party API Interoperability
L'Amigo functions as a client-side bridge between the user's browser, LeetCode, and GitHub.
- **LeetCode GraphQL API**: The extension performs read-only requests to LeetCode's official GraphQL endpoints to retrieve public profile and submission data. These requests utilize the user's active session cookies to ensure data accuracy.
- **GitHub REST API v3**: The extension performs authenticated write requests to GitHub's `api.github.com` endpoints to push source code solutions. This interacton is secured using the user-provided Personal Access Token.

## 5. Security Controls
Technical measures are implemented to protect user data from unauthorized access:
- **Credential Obfuscation**: GitHub Personal Access Tokens are stored in the browser's local secure storage, preventing exposure via standard file inspection.
- **HTTPS Enforcement**: All communications between the extension and third-party APIs are strictly conducted over encrypted TLS/SSL protocols.
- **OAuth-Free Architecture**: By using Personal Access Tokens rather than traditional OAuth flows, L'Amigo eliminates the need for middle-man authentication servers, further reducing the attack surface.

## 6. User Rights and Data Portability
As a local-first application, users retain full control over their data:
- **Access and Correction**: Users can view and modify all stored data (track lists, settings, tokens) through the extension's internal interface.
- **Deletion**: Uninstalling the L'Amigo extension immediately and permanently removes all associated data from the browser's local storage.
- **Portability**: Users can export their tracked peer data into non-proprietary CSV formats at any time for use in other systems.

## 7. Compliance and Contact
L'Amigo is designed to be compliant with global privacy standards, including the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA), through its rigorous local-only data processing model.

For inquiries regarding this policy or technical implementation of privacy controls, please submit a formal issue through the official project repository:
[https://github.com/FTS18/l-amigo/issues](https://github.com/FTS18/l-amigo/issues)
