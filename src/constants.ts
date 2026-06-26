// API Configuration
export const API_CONSTANTS = {
  LEETCODE_GRAPHQL: "https://leetcode.com/graphql",
  CODEFORCES_API: "https://codeforces.com/api",
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
  MAX_CONCURRENT_REQUESTS: 5,
} as const;

// GitHub auto-sync alarm interval (minutes)
export const GITHUB_SYNC_INTERVAL_MINUTES = 360; // 6 hours

// Data Limits
export const DATA_LIMITS = {
  MAX_FRIENDS: 50,
  MAX_ALIASES_PER_IDENTITY: 10,
  MAX_ACCOUNTS_PER_IDENTITY: 5,
  MAX_RECENT_SUBMISSIONS: 500, // Increased to ensure filters find data across all difficulties

  PROFILE_CACHE_DURATION: 3600000, // 1 hour in ms
  PROFILE_STALE_THRESHOLD: 900000, // 15 min — skip refetch if fresher
  MAX_STORAGE_SIZE: 5242880, // 5MB in bytes
} as const;

// Notification Configuration
export const NOTIFICATION_CONSTANTS = {
  getIconPath: () => chrome.runtime.getURL("android-chrome-192x192.png"),
  PRIORITY: 1,
} as const;

/**
 * All chrome.storage keys in one place.
 * Any typo is a compile-time error, not a silent runtime bug.
 * Keys are split by storage area (local vs session).
 */
export const STORAGE_KEYS = {
  // ── Identity / Profile ──────────────────────────────────────────────
  FRIEND_IDENTITIES: 'friend_identities_v2',
  PROFILE_INDEX:     'profile_index_v2',
  OWN_USERNAME:      'own_username',
  OWN_CF_HANDLE:     'own_codeforces_handle',
  OWN_CC_HANDLE:     'own_codechef_handle',

  // ── UI State ────────────────────────────────────────────────────────
  DARK_MODE:             'darkMode',
  FONT_SIZE_SCALE:       'font_size_scale',
  DISPLAY_ZOOM_SCALE:    'display_zoom_scale',
  SORT_BY:               'ui_sort_by',
  PLATFORM_FILTERS:      'ui_platform_filters',
  ACTIVE_TAB:            'ui_active_tab',
  LAST_UPDATED:          'ui_last_updated',
  REFRESH_IN_PROGRESS:   'ui_refresh_in_progress',
  ONBOARDING_COMPLETE:   'onboarding_complete',

  // ── Sync ────────────────────────────────────────────────────────────
  ALL_ACCEPTED_SUBS:     'all_accepted_submissions',
  SYNCED_SUBMISSIONS:    'synced_submissions',
  SYNC_STATUS:           'sync_status',
  SYNC_PROGRESS_FETCH:   'sync_progress_fetch',
  SYNC_PROGRESS_DONE:    'sync_progress_done',
  SYNC_PROGRESS_TOTAL:   'sync_progress_total',
  SYNC_ERROR:            'sync_error',
  SYNC_RESUME_OFFSET:    'sync_resume_offset',
  SYNC_HISTORY:          'sync_history',
  LAST_SYNCED_TS:        'last_synced_timestamp',
  LATEST_STATS:          'latest_stats',

  // ── GitHub ──────────────────────────────────────────────────────────
  GITHUB_CONFIG:         'github_sync_config',

  // ── Misc ────────────────────────────────────────────────────────────
  CF_DARK_MODE:          'cf_dark_mode',
  DAILY_GOAL:            'daily_goal',
  NOTIFICATIONS_ENABLED: 'notifications_enabled',
  AUTO_REFRESH:          'auto_refresh',
  REFRESH_INTERVAL:      'refresh_interval',
  CONTEST_REMINDERS:     'contest_reminders',
  UPCOMING_CONTESTS_CACHE: 'lamigo:upcomingContests:v8',

  // ── session storage keys (chrome.storage.session) ───────────────────
  SESSION_SYNC_IN_PROGRESS: 'sync_in_progress',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
