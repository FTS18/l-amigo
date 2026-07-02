import { create } from 'zustand';
import { Friend, FriendProfile, RecentSubmission, Platform } from '../types';
import { StorageService } from '../services/storage';
import { SyncEntry } from '../utils/import-restore';

interface AppState {
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  isDarkMode: boolean;
  selectedGlobalPlatforms: string[];
  allSubmissions: RecentSubmission[];
  disabledPlatforms: string[];
  manuallySolvedProblems: Record<string, { solved: boolean; platform: string; title: string }>;
  dismissedContesthubInfo: boolean;
  dismissedLeaderboardInfo: boolean;
  dismissedSheetstrackerInfo: boolean;
  blindMode: boolean;
  
  // Settings & Sync
  ownUsername: string;
  ownCodeforcesHandle: string;
  ownCodechefHandle: string;
  ownCsesHandle: string;
  fontSizeScale: number;
  displayZoomScale: number;
  
  // Loading status
  loading: boolean;
  
  // Popup UI specific state
  refreshing: boolean;
  refreshingFriend: string | null;
  activeTab: 'friends' | 'compare' | 'settings' | string;
  sortBy: string;
  pinnedFriends: string[];
  selectedFriendIndex: number;
  selectedFriend: Friend | null;
  showImportExport: boolean;
  editingFriend: Friend | null;
  showAddModal: boolean;
  platformFilters: string[];
  selectedPlatform: string;
  selectedFilter: string;

  // New settings added in Phase 2 part 2
  compactView: boolean;
  dailyGoal: number;
  cfDarkMode: boolean;
  defaultStartupTab: string;
  defaultComparison: string;
  autoRefresh: boolean;
  refreshInterval: number;
  syncStrictness: boolean;
  commitFrequency: string;
  smartBgRefresh: boolean;
  lastBackupTime: number | null;
  notificationsEnabled: boolean;
  
  // Sync status variables
  syncStatus: string;
  syncProgressFetch: number;
  syncProgressDone: number;
  syncProgressTotal: number;
  syncError: string;
  syncProgressFailed: number;
  syncHistory: SyncEntry[];

  // Sheets Tracker
  followedSheets: string[];
  revisionStars: string[];

  // Ephemeral UI State (previously localStorage)
  ui_sidebarCollapsed: boolean;
  ui_stSheetId: string;
  ui_ovSelectedFriend: Friend | null;
  ui_ovSelectedPlatform: string;
  ui_ovSelectedFilter: string;
  ui_frSelectedFriend: Friend | null;
  ui_frSelectedPlatform: string;
  ui_frSelectedFilter: string;
  ui_stCatFilter: string;
  ui_stDiffFilter: string;
  ui_stStatusFilter: string;
  ui_stPlatFilter: string;
  ui_stVideoFilter: string;
  ui_stSearchQuery: string;
  ui_lbRankingMode: string;
  ui_chActiveUser: string;
  ui_chSortBy: string;
  ui_setActiveSection: string;
  ui_cmpSelectedFriends: string[];
  ui_cmpShowAllTopics: boolean;
  ui_cmpActivePlatform: Platform;
  ui_cmpShowAllLangs: boolean;
  ui_cmpHideUnrated: boolean;

  // Actions
  setPartial: (partial: Partial<AppState>) => void;
  loadData: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  friends: [],
  profiles: {},
  isDarkMode: true,
  selectedGlobalPlatforms: ["leetcode", "codeforces", "codechef"],
  allSubmissions: [] as RecentSubmission[],
  disabledPlatforms: [],
  manuallySolvedProblems: {},
  dismissedContesthubInfo: false,
  dismissedLeaderboardInfo: false,
  dismissedSheetstrackerInfo: false,
  blindMode: false,
  
  ownUsername: "",
  ownCodeforcesHandle: "",
  ownCodechefHandle: "",
  ownCsesHandle: "",
  fontSizeScale: 100,
  displayZoomScale: 100,
  
  loading: true,

  refreshing: false,
  refreshingFriend: null,
  activeTab: 'friends',
  sortBy: 'recent',
  pinnedFriends: [],
  selectedFriendIndex: 0,
  selectedFriend: null,
  showImportExport: false,
  editingFriend: null,
  showAddModal: false,
  platformFilters: ["leetcode", "codeforces", "codechef"],
  selectedPlatform: "",
  selectedFilter: "all",
  
  // New settings initial state
  compactView: false,
  dailyGoal: 3,
  cfDarkMode: false,
  defaultStartupTab: 'friends',
  defaultComparison: 'problems',
  autoRefresh: false,
  refreshInterval: 60,
  syncStrictness: true,
  commitFrequency: 'immediate',
  smartBgRefresh: true,
  lastBackupTime: null,
  notificationsEnabled: false,
  
  // Sync status initial state
  syncStatus: 'idle',
  syncProgressFetch: 0,
  syncProgressDone: 0,
  syncProgressTotal: 0,
  syncError: '',
  syncProgressFailed: 0,
  syncHistory: [],

  followedSheets: [],
  revisionStars: [],

  // Ephemeral UI State Defaults
  ui_sidebarCollapsed: false,
  ui_stSheetId: "",
  ui_ovSelectedFriend: null,
  ui_ovSelectedPlatform: "",
  ui_ovSelectedFilter: "all",
  ui_frSelectedFriend: null,
  ui_frSelectedPlatform: "",
  ui_frSelectedFilter: "all",
  ui_stCatFilter: "All",
  ui_stDiffFilter: "All",
  ui_stStatusFilter: "All",
  ui_stPlatFilter: "All",
  ui_stVideoFilter: "All",
  ui_stSearchQuery: "",
  ui_lbRankingMode: "power",
  ui_chActiveUser: "own-user",
  ui_chSortBy: "StartTime",
  ui_setActiveSection: "profile",
  ui_cmpSelectedFriends: [],
  ui_cmpShowAllTopics: false,
  ui_cmpActivePlatform: 'leetcode',
  ui_cmpShowAllLangs: false,
  ui_cmpHideUnrated: false,

  setPartial: (partial) => set((state) => ({ ...state, ...partial })),

  loadData: async () => {
    try {
      const [res, loadedFriends, loadedProfiles] = await Promise.all([
        chrome.storage.local.get([
          "own_username",
          "own_codeforces_handle",
          "own_codechef_handle",
          "own_cses_handle",
          "all_accepted_submissions",
          "theme_preference",
          "darkMode",
          "font_size_scale",
          "display_zoom_scale",
          "selected_global_platforms",
          "disabled_platforms",
          "manually_solved_problems",
          "dismissed_contesthub_info",
          "dismissed_leaderboard_info",
          "dismissed_sheetstracker_info",
          "blind_mode",
          // New settings
          "compact_view",
          "daily_goal",
          "cf_dark_mode",
          "default_startup_tab",
          "default_comparison",
          "auto_refresh",
          "refresh_interval",
          "sync_strictness",
          "commit_frequency",
          "smart_bg_refresh",
          "last_backup_time",
          "notifications_enabled",
          "sync_status",
          "sync_progress_fetch",
          "sync_progress_done",
          "sync_progress_total",
          "sync_error",
          "sync_progress_failed",
          "sync_history",
          "pinned_friends",
          "ui_sort_by",
          "ui_platform_filters",
          "ui_active_tab",
          "followed_sheets",
          "revision_stars"
        ]),
        StorageService.getFriends(),
        StorageService.getProfiles(),
      ]);

      const isDark =
        res.darkMode !== undefined
          ? res.darkMode
          : res.theme_preference !== "light";
      
      const hasOwn =
        res.own_username ||
        res.own_codeforces_handle ||
        res.own_codechef_handle ||
        res.own_cses_handle;
        
      let finalFriends = loadedFriends;
      if (hasOwn) {
        const ownAccounts = [];
        if (res.own_username)
          ownAccounts.push({
            platform: "leetcode",
            handle: res.own_username,
            status: "active",
          });
        if (res.own_codeforces_handle)
          ownAccounts.push({
            platform: "codeforces",
            handle: res.own_codeforces_handle,
            status: "active",
          });
        if (res.own_codechef_handle)
          ownAccounts.push({
            platform: "codechef",
            handle: res.own_codechef_handle,
            status: "active",
          });
        if (res.own_cses_handle)
          ownAccounts.push({
            platform: "cses",
            handle: res.own_cses_handle,
            status: "active",
          });
        if (ownAccounts.length > 0) {
          finalFriends = [
            {
              id: "own-user",
              displayName: "You",
              username:
                res.own_username ||
                res.own_codeforces_handle ||
                res.own_codechef_handle,
              accounts: ownAccounts as Friend['accounts'],
              addedAt: Date.now(),
            },
            ...loadedFriends.filter((f) => {
               const hasSameLC =
                 res.own_username &&
                 f.accounts?.some(
                   (a) =>
                     a.platform === "leetcode" &&
                     a.handle.toLowerCase() === res.own_username.toLowerCase(),
                 );
               const hasSameCF =
                 res.own_codeforces_handle &&
                 f.accounts?.some(
                   (a) =>
                     a.platform === "codeforces" &&
                     a.handle.toLowerCase() ===
                       res.own_codeforces_handle.toLowerCase(),
                 );
               const hasSameCC =
                 res.own_codechef_handle &&
                 f.accounts?.some(
                   (a) =>
                     a.platform === "codechef" &&
                     a.handle.toLowerCase() ===
                       res.own_codechef_handle.toLowerCase(),
                 );
               return !(hasSameLC || hasSameCF || hasSameCC);
            }),
          ];
        }
      }

      set({
        friends: finalFriends,
        profiles: loadedProfiles,
        isDarkMode: isDark,
        fontSizeScale: res.font_size_scale ?? 100,
        displayZoomScale: res.display_zoom_scale ?? 100,
        ownUsername: res.own_username || "",
        ownCodeforcesHandle: res.own_codeforces_handle || "",
        ownCodechefHandle: res.own_codechef_handle || "",
        ownCsesHandle: res.own_cses_handle || "",
        allSubmissions: res.all_accepted_submissions || [],
        selectedGlobalPlatforms: res.selected_global_platforms || [
          "leetcode",
          "codeforces",
          "codechef",
        ],
        disabledPlatforms: res.disabled_platforms || [],
        manuallySolvedProblems: res.manually_solved_problems || {},
        dismissedContesthubInfo: !!res.dismissed_contesthub_info,
        dismissedLeaderboardInfo: !!res.dismissed_leaderboard_info,
        dismissedSheetstrackerInfo: !!res.dismissed_sheetstracker_info,
        blindMode: !!res.blind_mode,
        
        pinnedFriends: res.pinned_friends || [],
        sortBy: res.ui_sort_by || 'name',
        platformFilters: res.ui_platform_filters ? res.ui_platform_filters.filter((p: string) => !(res.disabled_platforms || []).includes(p)) : [],
        activeTab: res.ui_active_tab || 'friends',

        compactView: !!res.compact_view,
        dailyGoal: res.daily_goal ?? 3,
        cfDarkMode: !!res.cf_dark_mode,
        defaultStartupTab: res.default_startup_tab || 'friends',
        defaultComparison: res.default_comparison || 'problems',
        autoRefresh: !!res.auto_refresh,
        refreshInterval: res.refresh_interval || 60,
        syncStrictness: res.sync_strictness ?? true,
        commitFrequency: res.commit_frequency || 'immediate',
        smartBgRefresh: res.smart_bg_refresh ?? true,
        lastBackupTime: res.last_backup_time || null,
        notificationsEnabled: !!res.notifications_enabled,
        
        syncStatus: res.sync_status || 'idle',
        syncProgressFetch: res.sync_progress_fetch || 0,
        syncProgressDone: res.sync_progress_done || 0,
        syncProgressTotal: res.sync_progress_total || 0,
        syncError: res.sync_error || '',
        syncProgressFailed: res.sync_progress_failed || 0,
        syncHistory: res.sync_history || [],
        
        followedSheets: res.followed_sheets || [],
        revisionStars: res.revision_stars || [],
        
        loading: false,
      });
    } catch (e) {
      console.error("Failed to load initial data into store", e);
      set({ loading: false });
    }
  }
}));
