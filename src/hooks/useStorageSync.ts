import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export function useStorageSync() {
  const loadData = useAppStore((state) => state.loadData);

  useEffect(() => {
    // Initial load
    loadData();

    // Listen to changes in chrome.storage
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local") {
        // We only care about keys that affect the global state
        const relevantKeys = [
          "friends",
          "identities",
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
          "followed_sheets",
          "revision_stars"
        ];
        
        // If any of the relevant keys changed, reload the data into the store.
        const shouldReload = relevantKeys.some(key => changes[key]);
        if (shouldReload) {
          loadData();
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, [loadData]);
}
