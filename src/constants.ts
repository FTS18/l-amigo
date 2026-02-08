// API Configuration
export const API_CONSTANTS = {
  LEETCODE_GRAPHQL: "https://leetcode.com/graphql",
  REQUEST_TIMEOUT: 10000, // 10 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // 1 second for exponential backoff
  SUBMISSION_FETCH_DELAY_MS: 2500, // Minimum gap between submission fetches
  SUBMISSION_FETCH_JITTER_MS: 400, // Adds slight randomness to mimic humans
  SUBMISSION_LIST_PAGE_SIZE: 20, // Fetch limited batches to avoid WAF triggers
  SUBMISSION_LIST_MAX_PAGES: 10, // Up to 200 submissions per problem lookup
  SUBMISSION_TIMESTAMP_TOLERANCE_SEC: 604800, // 7-day tolerance for scraped timestamps
} as const;

// Background Refresh Configuration
export const REFRESH_CONSTANTS = {
  INTERVAL_MINUTES: 60, // 1 hour
  DELAY_BETWEEN_REQUESTS: 2000, // 2 seconds to avoid rate limiting
  MAX_CONCURRENT_REQUESTS: 3,
} as const;

// Data Limits
export const DATA_LIMITS = {
  MAX_FRIENDS: 50,
  MAX_RECENT_SUBMISSIONS: 100, // Increased to sync more problems
  PROFILE_CACHE_DURATION: 3600000, // 1 hour in ms
  PROFILE_STALE_THRESHOLD: 900000, // 15 min — skip refetch if fresher
  MAX_STORAGE_SIZE: 5242880, // 5MB in bytes
} as const;

// UI Configuration
export const UI_CONSTANTS = {
  TOAST_DURATION: 3000, // 3 seconds
  MODAL_ANIMATION_DURATION: 300, // 0.3 seconds
  DEBOUNCE_DELAY: 500, // 0.5 seconds
} as const;

// Notification Configuration
export const NOTIFICATION_CONSTANTS = {
  getIconPath: () => chrome.runtime.getURL("android-chrome-192x192.png"),
  PRIORITY: 1,
} as const;
