import React, { useState, useEffect, useMemo } from 'react';
import { Friend, FriendProfile, Platform } from '../types';
import { StorageService } from '../services/storage';
import { LeetCodeService } from '../services/leetcode';
import { CodeforcesService } from '../services/codeforces';
import { PlatformService } from '../services/platform-service';
import { DATA_LIMITS, STORAGE_KEYS } from '../constants';
import { SyncEntry } from '../utils/import-restore';
import { FriendCard } from './FriendCard';
import { TabNav } from './TabNav';
import { Onboarding } from './Onboarding';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { Modal } from './Modal';
import { Toast } from './Toast';
import { Skeleton } from './Skeleton';
import { Recommendations } from './Recommendations';
import { SettingsTab } from './SettingsTab';
import { CompareTab } from './CompareTab';
import { GlobalActivityFeed } from './GlobalActivityFeed';
import { FriendProfileView } from './FriendProfileView';
import { AddEditFriendModal } from './AddEditFriendModal';
import { UpcomingContests } from './UpcomingContests';
import { ImportExportModal } from './ImportExportModal';
import { Sun, Moon, Database, UserPlus, LayoutDashboard, RefreshCw, WifiOff } from 'lucide-react';
import { StreakCalculator } from '../services/streak';
import './App.css';

const formatTimestamp = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};

export const App: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [profiles, setProfiles] = useState<Record<string, FriendProfile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingFriend, setRefreshingFriend] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [addingFriend, setAddingFriend] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const ss = <T,>(key: string, fallback: T): T => {
    try {
      const v = sessionStorage.getItem(`app_${key}`);
      if (v !== null) return JSON.parse(v) as T;
    } catch { /* ignore */ }
    return fallback;
  };
  const setSS = <T,>(key: string, value: T) => {
    try { sessionStorage.setItem(`app_${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  };

  const [sortBy, _setSortBy] = useState<'name' | 'problems' | 'recent' | 'streak'>(() => ss('sortBy', 'recent'));
  const setSortBy = (v: 'name' | 'problems' | 'recent' | 'streak') => { setSS('sortBy', v); _setSortBy(v); };

  const [platformFilters, _setPlatformFilters] = useState<Platform[]>(() => ss('platFilters', ['leetcode', 'codeforces', 'codechef']));
  const setPlatformFilters = (v: Platform[] | ((prev: Platform[]) => Platform[])) => {
    _setPlatformFilters(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      setSS('platFilters', next);
      return next;
    });
  };

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSizeScale, setFontSizeScale] = useState(100);
  const [displayZoomScale, setDisplayZoomScale] = useState(100);
  const [disabledPlatforms, setDisabledPlatforms] = useState<string[]>([]);
  // Incrementing this key forces <UpcomingContests /> to remount and re-fetch fresh data
  const [refreshContestsKey, setRefreshContestsKey] = useState(0);


  const [activeTab, _setActiveTab] = useState<'friends' | 'compare' | 'settings'>(() => ss('activeTab', 'friends'));
  const setActiveTab = (v: 'friends' | 'compare' | 'settings') => { setSS('activeTab', v); _setActiveTab(v); };

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ownUsername, setOwnUsername] = useState<string>('');
  const [ownCodeforcesHandle, setOwnCodeforcesHandle] = useState<string>('');
  const [ownCodechefHandle, setOwnCodechefHandle] = useState<string>('');
  const [ownCsesHandle, setOwnCsesHandle] = useState<string>('');

  const [selectedFriendIndex, _setSelectedFriendIndex] = useState<number>(() => ss('selectedFriendIndex', 0));
  const setSelectedFriendIndex = (v: number | ((prev: number) => number)) => {
    _setSelectedFriendIndex(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      setSS('selectedFriendIndex', next);
      return next;
    });
  };

  const [selectedFriend, _setSelectedFriend] = useState<Friend | null>(() => ss('selectedFriend', null));
  const setSelectedFriend = (v: Friend | null | ((prev: Friend | null) => Friend | null)) => {
    _setSelectedFriend(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      setSS('selectedFriend', next);
      return next;
    });
  };

  const [selectedPlatform, _setSelectedPlatform] = useState<string>(() => ss('selectedPlatform', ''));
  const setSelectedPlatform = (v: string | ((prev: string) => string)) => {
    _setSelectedPlatform(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      setSS('selectedPlatform', next);
      return next;
    });
  };

  const [selectedFilter, _setSelectedFilter] = useState<string>(() => ss('selectedFilter', 'all'));
  const setSelectedFilter = (v: string | ((prev: string) => string)) => {
    _setSelectedFilter(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      setSS('selectedFilter', next);
      return next;
    });
  };

  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; action?: { label: string; onClick: () => void }; duration?: number } | null>(null);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());
  const [pinnedFriends, setPinnedFriends] = useState<string[]>([]);
  const [dailyGoal, setDailyGoal] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'info' | 'error' | 'success' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null);

  useEffect(() => {
    checkOnboarding();
    loadTheme();

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local') return;
      if (changes[STORAGE_KEYS.FONT_SIZE_SCALE]) setFontSizeScale(changes[STORAGE_KEYS.FONT_SIZE_SCALE].newValue ?? 100);
      if (changes[STORAGE_KEYS.DISPLAY_ZOOM_SCALE]) setDisplayZoomScale(changes[STORAGE_KEYS.DISPLAY_ZOOM_SCALE].newValue ?? 100);
      if (changes[STORAGE_KEYS.DARK_MODE]) setIsDarkMode(changes[STORAGE_KEYS.DARK_MODE].newValue);
      if (changes[STORAGE_KEYS.DISABLED_PLATFORMS]) {
        const disabled = changes[STORAGE_KEYS.DISABLED_PLATFORMS].newValue || [];
        setDisabledPlatforms(disabled);
        setPlatformFilters(prev => prev.filter(p => !disabled.includes(p)));
      }
      if (changes[STORAGE_KEYS.COMPACT_VIEW]) {
        if (changes[STORAGE_KEYS.COMPACT_VIEW].newValue) {
          document.body.classList.add('compact-view-enabled');
        } else {
          document.body.classList.remove('compact-view-enabled');
        }
      }
      if (changes.daily_goal) setDailyGoal(changes.daily_goal.newValue ?? 3);
      if (changes.pinned_friends) setPinnedFriends(changes.pinned_friends.newValue || []);
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Track network connectivity for offline banner
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);



  const checkOnboarding = async () => {
    // Save last opened timestamp for smart background refresh
    chrome.storage.local.set({ [STORAGE_KEYS.LAST_OPENED_TS]: Date.now() });

    // Single storage read — all keys merged into one call
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.ONBOARDING_COMPLETE,
      STORAGE_KEYS.OWN_USERNAME,
      STORAGE_KEYS.OWN_CF_HANDLE,
      STORAGE_KEYS.OWN_CC_HANDLE,
      STORAGE_KEYS.OWN_CSES_HANDLE,
      STORAGE_KEYS.SORT_BY,
      STORAGE_KEYS.PLATFORM_FILTERS,
      STORAGE_KEYS.ACTIVE_TAB,
      STORAGE_KEYS.LAST_UPDATED,
      STORAGE_KEYS.REFRESH_IN_PROGRESS,
      STORAGE_KEYS.FONT_SIZE_SCALE,
      STORAGE_KEYS.DISPLAY_ZOOM_SCALE,
      STORAGE_KEYS.DARK_MODE,
      STORAGE_KEYS.DEFAULT_STARTUP_TAB,
      STORAGE_KEYS.DISABLED_PLATFORMS,
      STORAGE_KEYS.COMPACT_VIEW,
      'daily_goal',
      'pinned_friends'
    ]);
    if (!result[STORAGE_KEYS.ONBOARDING_COMPLETE]) {
      setShowOnboarding(true);
      setLoading(false);
    } else {
      const username = result[STORAGE_KEYS.OWN_USERNAME] || '';
      setOwnUsername(username);
      setOwnCodeforcesHandle(result[STORAGE_KEYS.OWN_CF_HANDLE] || '');
      setOwnCodechefHandle(result[STORAGE_KEYS.OWN_CC_HANDLE] || '');
      setOwnCsesHandle(result[STORAGE_KEYS.OWN_CSES_HANDLE] || '');
      // Restore persisted UI state
      if (result[STORAGE_KEYS.SORT_BY]) setSortBy(result[STORAGE_KEYS.SORT_BY]);
      
      const disabled = result[STORAGE_KEYS.DISABLED_PLATFORMS] || [];
      setDisabledPlatforms(disabled);
      if (result[STORAGE_KEYS.PLATFORM_FILTERS]) {
        // Automatically remove disabled platforms from filters
        const activeFilters = result[STORAGE_KEYS.PLATFORM_FILTERS].filter((p: string) => !disabled.includes(p));
        setPlatformFilters(activeFilters);
      }

      // Feature 7: Default Startup Tab
      if (result[STORAGE_KEYS.DEFAULT_STARTUP_TAB]) {
        const startupTab = result[STORAGE_KEYS.DEFAULT_STARTUP_TAB];
        if (startupTab.startsWith('dash_')) {
          const dashTab = startupTab.replace('dash_', '');
          chrome.tabs.create({ url: `dashboard.html#${dashTab}` });
          setActiveTab('friends');
        } else {
          setActiveTab(startupTab);
        }
      } else if (result[STORAGE_KEYS.ACTIVE_TAB]) {
        setActiveTab(result[STORAGE_KEYS.ACTIVE_TAB]);
      }

      if (result[STORAGE_KEYS.LAST_UPDATED]) setLastUpdated(result[STORAGE_KEYS.LAST_UPDATED]);
      // Also restore theme from the same single read (avoids a separate loadTheme() call)
      if (result[STORAGE_KEYS.DARK_MODE] !== undefined) setIsDarkMode(result[STORAGE_KEYS.DARK_MODE]);
      if (result[STORAGE_KEYS.FONT_SIZE_SCALE]) setFontSizeScale(result[STORAGE_KEYS.FONT_SIZE_SCALE]);
      if (result[STORAGE_KEYS.DISPLAY_ZOOM_SCALE]) setDisplayZoomScale(result[STORAGE_KEYS.DISPLAY_ZOOM_SCALE]);
      if (result.daily_goal !== undefined) setDailyGoal(result.daily_goal);
      if (result.pinned_friends) setPinnedFriends(result.pinned_friends);
      
      // Feature 8: Compact View
      if (result[STORAGE_KEYS.COMPACT_VIEW]) {
        document.body.classList.add('compact-view-enabled');
      } else {
        document.body.classList.remove('compact-view-enabled');
      }

      // If a refresh was running when popup was last closed, re-start it after load
      loadData(username).then(() => {
        if (result[STORAGE_KEYS.REFRESH_IN_PROGRESS]) {
          handleRefresh();
        }
      });
    }
  };

  const handleOnboardingComplete = async (_passedUsername: string) => {
    setShowOnboarding(false);

    // Read handles exactly as saved by Onboarding (CF is case-sensitive — do NOT lowercase)
    const result = await chrome.storage.local.get(['own_username', 'own_codeforces_handle', 'own_codechef_handle']);
    const ownLC = result.own_username || '';
    const ownCF = result.own_codeforces_handle || '';
    const ownCC = result.own_codechef_handle || '';

    setOwnUsername(ownLC);
    setOwnCodeforcesHandle(ownCF);
    setOwnCodechefHandle(ownCC);

    // Fetch and save own LeetCode profile if provided
    if (ownLC) {
      try {
        const profile = await LeetCodeService.fetchUserProfile(ownLC);
        await StorageService.saveProfile(profile);
      } catch (error) {
        console.error('Error fetching own LC profile:', error);
      }
    }

    // Fetch and save own Codeforces profile if provided (case-sensitive handle)
    if (ownCF) {
      try {
        const profile = await CodeforcesService.fetchUserProfile(ownCF);
        await StorageService.saveProfile(profile);
      } catch (error) {
        console.error('Error fetching own CF profile:', error);
      }
    }

    // Fetch and save own CodeChef profile if provided
    if (ownCC) {
      try {
        const profile = await PlatformService.fetchProfile('codechef', ownCC);
        await StorageService.saveProfile(profile);
      } catch (error) {
        console.error('Error fetching own CC profile:', error);
      }
    }

    loadData(ownLC);
  };

  const loadTheme = async () => {
    const result = await chrome.storage.local.get(['darkMode', 'font_size_scale', 'display_zoom_scale']);
    if (result.darkMode !== undefined) {
      setIsDarkMode(result.darkMode);
    } else {
      // First time - detect system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(systemPrefersDark);
      await chrome.storage.local.set({ darkMode: systemPrefersDark });
    }
    if (result.font_size_scale) setFontSizeScale(result.font_size_scale);
    if (result.display_zoom_scale) setDisplayZoomScale(result.display_zoom_scale);
  };

  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    await chrome.storage.local.set({ darkMode: newMode });
    // Toggle body class for full background
    if (newMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  };

  useEffect(() => {
    // Apply dark mode to body when it changes
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  const verifyAndReconcileState = async (currentFriends?: Friend[], currentProfiles?: Record<string, FriendProfile>) => {
    try {
      console.log("[App] Starting state verification cycle...");
      const storageFriends = await StorageService.getFriends();
      const storageProfiles = await StorageService.getProfiles();
      
      const friendsToCompare = currentFriends || friends;
      const profilesToCompare = currentProfiles || profiles;
      
      // Fast check: length
      if (friendsToCompare.length !== storageFriends.length || 
          Object.keys(profilesToCompare).length !== Object.keys(storageProfiles).length) {
        console.warn("[App] Desynchronization detected (length mismatch).");
        setFriends(storageFriends);
        setProfiles(storageProfiles);
        setLastUpdated(Date.now());
        return false;
      }

      // Fast check: friend IDs
      const memoryIds = friendsToCompare.map(f => f.id).sort().join(',');
      const storageIds = storageFriends.map(f => f.id).sort().join(',');
      
      if (memoryIds !== storageIds) {
         console.warn("[App] Desynchronization detected (ID mismatch).");
         setFriends(storageFriends);
         setProfiles(storageProfiles);
         setLastUpdated(Date.now());
         chrome.storage.local.set({ ui_last_updated: Date.now() });
         return false;
      }
      
      console.log("[App] State in sync.");
      return true;
    } catch (error) {
      console.error("[App] State reconciliation failed:", error);
      return true; // assume synced to prevent infinite loops
    }
  };

  const loadData = async (currentUsername?: string) => {
    try {
      // 1. Load from cache instantly — popup appears immediately
      const friendsList = await StorageService.getFriends();
      const profilesData = await StorageService.getProfiles();
      setFriends(friendsList);
      setProfiles(profilesData);
      // Don't update lastUpdated here — we're just reading from cache.
      // lastUpdated is only updated after actual network refreshes (handleRefresh / background stale fetch).

      // Single storage read for all own handles — merged from two previous separate calls
      const ownHandles = await chrome.storage.local.get([
        STORAGE_KEYS.OWN_USERNAME,
        STORAGE_KEYS.OWN_CF_HANDLE,
        STORAGE_KEYS.OWN_CC_HANDLE,
      ]);
      const ownUser = ownHandles[STORAGE_KEYS.OWN_USERNAME];
      const ownCF   = ownHandles[STORAGE_KEYS.OWN_CF_HANDLE];
      const ownCC   = ownHandles[STORAGE_KEYS.OWN_CC_HANDLE];
      setOwnCodeforcesHandle(ownCF || '');
      setOwnCodechefHandle(ownCC || '');

      const username = currentUsername || ownUser || ownUsername;

      // 2. Determine which profiles need a refresh (stale or missing)
      const accountsToCheck: Array<{ platform: Platform; handle: string }> = [];

      if (ownUser)  accountsToCheck.push({ platform: 'leetcode',   handle: ownUser });
      if (ownCF)    accountsToCheck.push({ platform: 'codeforces', handle: ownCF });
      if (ownCC)    accountsToCheck.push({ platform: 'codechef',   handle: ownCC });


      // Friend profiles
      for (const f of friendsList) {
        if (f.accounts && f.accounts.length > 0) {
          for (const acc of f.accounts) {
            accountsToCheck.push({ platform: acc.platform as Platform, handle: acc.handle });
          }
        } else {
          // Fallback legacy friend
          accountsToCheck.push({ platform: 'leetcode', handle: f.username });
        }
      }

      const staleAccounts: Array<{ platform: Platform; handle: string }> = [];
      for (const acc of accountsToCheck) {
        const key = `${acc.platform}:${acc.handle.toLowerCase()}`;
        const p = profilesData[key];
        if (!p || (Date.now() - (p.lastFetched || 0)) > DATA_LIMITS.PROFILE_STALE_THRESHOLD) {
          staleAccounts.push(acc);
        }
      }

      // 3. Background-refresh only stale profiles (non-blocking UI update)
      if (staleAccounts.length > 0) {
        console.log(`[App] ${staleAccounts.length} stale profiles — refreshing in background`);
        (async () => {
          const BATCH = 3;
          for (let i = 0; i < staleAccounts.length; i += BATCH) {
            const batch = staleAccounts.slice(i, i + BATCH);
            await Promise.allSettled(
              batch.map(async (acc) => {
                try {
                  const profile = await PlatformService.fetchProfile(acc.platform, acc.handle);
                  await StorageService.saveProfile(profile);
                } catch (e) {
                  console.warn(`[App] Background refresh failed for ${acc.platform}:${acc.handle}:`, e);
                }
              }),
            );
            // Update UI incrementally after each batch
            const intermediateProfiles = await StorageService.getProfiles();
            setProfiles(intermediateProfiles);
          }
          const freshProfiles = await StorageService.getProfiles();
          setProfiles(freshProfiles);
          const refreshedAt = Date.now();
          setLastUpdated(refreshedAt);
          chrome.storage.local.set({ ui_last_updated: refreshedAt });
          // Run verification on the updated state
          await verifyAndReconcileState(friendsList, freshProfiles);
        })();
      } else {
        // Run verification on the initial state
        await verifyAndReconcileState(friendsList, profilesData);
      }

      return { friends: friendsList, profiles: profilesData };
    } catch (error) {
      console.error('Error loading data:', error);
      return { friends: [], profiles: {} };
    } finally {
      setLoading(false);
    }
  };



  const handleRemoveFriend = async (friendId: string, displayName: string) => {
    try {
      const identities = await StorageService.getIdentities();
      const identityToRestore = identities.find(i => i.id === friendId);
      if (!identityToRestore) return;

      // Get profiles belonging to this identity from state
      const profilesToDelete = Object.values(profiles).filter(p => p.id === friendId);

      // Delete immediately from storage and refresh UI
      await StorageService.removeIdentity(friendId);
      await loadData();

      setToast({ 
        message: `${displayName} removed`, 
        type: 'info',
        duration: 5000,
        action: { 
          label: 'Undo', 
          onClick: async () => {
            try {
              await StorageService.restoreIdentity(identityToRestore, profilesToDelete);
              await loadData();
              setToast(null);
            } catch (error) {
              console.error('Failed to restore friend', error);
            }
          } 
        }
      });
    } catch (error) {
      console.error('Failed to remove friend:', error);
      setToast({ message: 'Failed to remove friend', type: 'error' });
    }
  };

  const requestConfirm = (action: () => void, title: string, message: string) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'info'
    });
    setConfirmAction(() => action);
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    // Persist in-progress flag so reopening the popup shows the spinner and restarts
    await chrome.storage.local.set({ ui_refresh_in_progress: true });
    try {
      // 1. Refresh own profiles (all platforms if configured)
      const { own_username: ownUser, own_codeforces_handle: ownCodeforcesHandleObj, own_codechef_handle: ownCodechefHandleObj } =
        await chrome.storage.local.get(["own_username", "own_codeforces_handle", "own_codechef_handle"]);

      const ownTasks: Promise<any>[] = [];
      if (ownUser) {
        ownTasks.push((async () => {
          try {
            const profile = await PlatformService.fetchProfile('leetcode', ownUser);
            await StorageService.saveProfile(profile);
          } catch (e) {
            console.error('Error refreshing own LeetCode profile:', e);
          }
        })());
      }
      if (ownCodeforcesHandleObj) {
        ownTasks.push((async () => {
          try {
            const profile = await PlatformService.fetchProfile('codeforces', ownCodeforcesHandleObj);
            await StorageService.saveProfile(profile);
          } catch (e) {
            console.error('Error refreshing own Codeforces profile:', e);
          }
        })());
      }
      if (ownCodechefHandleObj) {
        ownTasks.push((async () => {
          try {
            const profile = await PlatformService.fetchProfile('codechef', ownCodechefHandleObj);
            await StorageService.saveProfile(profile);
          } catch (e) {
            console.error('Error refreshing own Codechef profile:', e);
          }
        })());
      }
      await Promise.allSettled(ownTasks);

      // 2. Collect all friend platform accounts to refresh
      const accountsToRefresh: Array<{ friendUsername: string; platform: Platform; handle: string }> = [];
      for (const friend of friends) {
        if (friend.accounts && friend.accounts.length > 0) {
          for (const acc of friend.accounts) {
            accountsToRefresh.push({
              friendUsername: friend.username,
              platform: acc.platform,
              handle: acc.handle
            });
          }
        } else {
          accountsToRefresh.push({
            friendUsername: friend.username,
            platform: 'leetcode',
            handle: friend.username
          });
        }
      }

      // 3. Refresh friend accounts in parallel batches of 3
      const BATCH_SIZE = 3;
      let failed = 0;
      for (let i = 0; i < accountsToRefresh.length; i += BATCH_SIZE) {
        const batch = accountsToRefresh.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (acc) => {
            const profile = await PlatformService.fetchProfile(acc.platform, acc.handle);
            await StorageService.saveProfile(profile);
          })
        );
        failed += results.filter(r => r.status === 'rejected').length;
      }

      // 4. Clear upcoming contests cache so it re-fetches on refresh
      await chrome.storage.local.remove('lamigo:upcomingContests:v6');
      setRefreshContestsKey(k => k + 1);

      await loadData();
      if (failed > 0) {
        setToast({ message: `Refreshed! (${failed} failed)`, type: 'info' });
      } else {
        setToast({ message: 'All friends refreshed!', type: 'success' });
      }
    } catch (error) {
      setToast({ message: 'Failed to refresh friends', type: 'error' });
    } finally {
      setRefreshing(false);
      // Clear the in-progress flag regardless of success or failure
      chrome.storage.local.remove('ui_refresh_in_progress');
    }
  };

  const handleRefreshFriend = async (username: string) => {
    setRefreshingFriend(username);
    try {
      const targetFriend = friends.find(f => f.username.toLowerCase() === username.toLowerCase());
      setToast({ message: `Refreshing ${targetFriend?.displayName || username}...`, type: 'info' });
      if (targetFriend && targetFriend.accounts && targetFriend.accounts.length > 0) {
        const tasks = targetFriend.accounts.map(async (acc) => {
          const profile = await PlatformService.fetchProfile(acc.platform, acc.handle);
          await StorageService.saveProfile(profile);
        });
        const results = await Promise.allSettled(tasks);
        const failedCount = results.filter(r => r.status === 'rejected').length;
        if (failedCount > 0) {
          setToast({ message: `Refreshed ${username} (${failedCount} failed)`, type: 'info' });
        } else {
          setToast({ message: `Refreshed ${username}!`, type: 'success' });
        }
      } else {
        const profile = await PlatformService.fetchProfile('leetcode', username);
        await StorageService.saveProfile(profile);
        setToast({ message: `Refreshed ${username}!`, type: 'success' });
      }
      await loadData();
      const t = Date.now();
      setLastUpdated(t);
      chrome.storage.local.set({ ui_last_updated: t });
    } catch (error) {
      setToast({ message: `Failed to refresh ${username}`, type: 'error' });
    } finally {
      setRefreshingFriend(null);
    }
  };

  const handleRefreshOwn = async () => {
    setRefreshingFriend('You');
    setToast({ message: 'Refreshing your profiles...', type: 'info' });
    try {
      const tasks = [];
      if (ownUsername) {
        tasks.push(PlatformService.fetchProfile('leetcode', ownUsername).then(p => StorageService.saveProfile(p)));
      }
      if (ownCodeforcesHandle) {
        tasks.push(PlatformService.fetchProfile('codeforces', ownCodeforcesHandle).then(p => StorageService.saveProfile(p)));
      }
      if (ownCodechefHandle) {
        tasks.push(PlatformService.fetchProfile('codechef', ownCodechefHandle).then(p => StorageService.saveProfile(p)));
      }
      await Promise.allSettled(tasks);
      await loadData();
      const t = Date.now();
      setLastUpdated(t);
      chrome.storage.local.set({ ui_last_updated: t });
      setToast({ message: 'Your profiles refreshed!', type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to refresh your profiles', type: 'error' });
    } finally {
      setRefreshingFriend(null);
    }
  };

  const handleTabChange = (tab: 'friends' | 'compare' | 'settings') => {
    setActiveTab(tab);
    chrome.storage.local.set({ ui_active_tab: tab });
  };

  const handleSortChange = (sort: 'name' | 'problems' | 'recent') => {
    setSortBy(sort);
    chrome.storage.local.set({ ui_sort_by: sort });
  };

  const dailySolvesCount = useMemo(() => {
    let count = 0;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;

    const getSolvesForHandle = (platform: string, handle: string) => {
      const p = profiles[`${platform}:${handle.toLowerCase()}`] || profiles[handle.toLowerCase()];
      if (!p?.recentSubmissions) return 0;
      return p.recentSubmissions.filter(s => s.timestamp >= startOfDay && (s.statusDisplay === 'Accepted' || s.statusDisplay === 'AC')).length;
    };

    if (ownUsername) count += getSolvesForHandle('leetcode', ownUsername);
    if (ownCodeforcesHandle) count += getSolvesForHandle('codeforces', ownCodeforcesHandle);
    if (ownCodechefHandle) count += getSolvesForHandle('codechef', ownCodechefHandle);

    return count;
  }, [profiles, ownUsername, ownCodeforcesHandle, ownCodechefHandle]);

  const handleTogglePin = async (friendId: string) => {
    const nextPinned = pinnedFriends.includes(friendId)
      ? pinnedFriends.filter(id => id !== friendId)
      : [...pinnedFriends, friendId];
    setPinnedFriends(nextPinned);
    await chrome.storage.local.set({ pinned_friends: nextPinned });
  };

  const sortedFriends = useMemo(() => {
    const filteredFriends = [...friends].filter(f => {
      if (pendingDeletions.has(f.id || f.username)) return false;
      
      // Prevent duplicacy: don't show the user in the regular friends list if they have configured their own handles
      const isOwnLC = ownUsername && (f.username.toLowerCase() === ownUsername.toLowerCase() || f.accounts?.some(a => a.platform === 'leetcode' && a.handle.toLowerCase() === ownUsername.toLowerCase()));
      const isOwnCF = ownCodeforcesHandle && f.accounts?.some(a => a.platform === 'codeforces' && a.handle.toLowerCase() === ownCodeforcesHandle.toLowerCase());
      const isOwnCC = ownCodechefHandle && f.accounts?.some(a => a.platform === 'codechef' && a.handle.toLowerCase() === ownCodechefHandle.toLowerCase());
      
      if (isOwnLC || isOwnCF || isOwnCC) return false;
      
      // Filter by platform buttons
      if (platformFilters.length === 0) return false;
      const hasActivePlatform = f.accounts?.some(a => platformFilters.includes(a.platform)) || 
                                (profiles[f.username.toLowerCase()]?.platform && platformFilters.includes(profiles[f.username.toLowerCase()].platform as Platform));
      if (!hasActivePlatform) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = f.displayName?.toLowerCase().includes(q) || f.username.toLowerCase().includes(q);
        const accMatch = f.accounts?.some(a => a.handle.toLowerCase().includes(q));
        if (!nameMatch && !accMatch) return false;
      }

      return true;
    });

    const ownFriend: Friend | null = (ownUsername || ownCodeforcesHandle || ownCodechefHandle) ? {
      id: 'own-user',
      displayName: 'You',
      username: ownUsername || ownCodeforcesHandle || ownCodechefHandle || 'You',
      addedAt: 0,
      accounts: [
        ...(ownUsername ? [{ platform: 'leetcode' as const, handle: ownUsername, status: 'active' as const }] : []),
        ...(ownCodeforcesHandle ? [{ platform: 'codeforces' as const, handle: ownCodeforcesHandle, status: 'active' as const }] : []),
        ...(ownCodechefHandle ? [{ platform: 'codechef' as const, handle: ownCodechefHandle, status: 'active' as const }] : [])
      ]
    } : null;

    const listToSort = ownFriend ? (searchQuery.trim() && !'you'.includes(searchQuery.toLowerCase()) && !ownUsername?.toLowerCase().includes(searchQuery.toLowerCase()) && !ownCodeforcesHandle?.toLowerCase().includes(searchQuery.toLowerCase()) && !ownCodechefHandle?.toLowerCase().includes(searchQuery.toLowerCase()) ? filteredFriends : [ownFriend, ...filteredFriends]) : filteredFriends;

    return listToSort.sort((a, b) => {
      if (a.id === 'own-user') return -1;
      if (b.id === 'own-user') return 1;
      const isPinnedA = pinnedFriends.includes(a.id || a.username);
      const isPinnedB = pinnedFriends.includes(b.id || b.username);
      if (isPinnedA && !isPinnedB) return -1;
      if (!isPinnedA && isPinnedB) return 1;

      const getProfile = (f: Friend, platform: Platform) => {
        const handle = f.accounts?.find(acc => acc.platform === platform)?.handle || (profiles[f.username.toLowerCase()]?.platform === platform ? f.username : undefined);
        if (!handle) return undefined;
        return profiles[`${platform}:${handle.toLowerCase()}`] || profiles[handle.toLowerCase()];
      };

      const compareNames = (f1: Friend, f2: Friend) => {
        const getSortName = (f: Friend) => {
          if (f.id === 'own-user') return f.username.toLowerCase();
          return (f.displayName || f.username).toLowerCase();
        };
        return getSortName(f1).localeCompare(getSortName(f2));
      };

      switch (sortBy) {
        case 'problems': {
          const solvedA = (getProfile(a, 'leetcode')?.problemsSolved.total || 0) + (getProfile(a, 'codeforces')?.problemsSolved.total || 0) + (getProfile(a, 'codechef')?.problemsSolved.total || 0);
          const solvedB = (getProfile(b, 'leetcode')?.problemsSolved.total || 0) + (getProfile(b, 'codeforces')?.problemsSolved.total || 0) + (getProfile(b, 'codechef')?.problemsSolved.total || 0);
          if (solvedA !== solvedB) return solvedB - solvedA;
          return compareNames(a, b);
        }
        case 'recent': {
          const submissionsA = [
            ...(getProfile(a, 'leetcode')?.recentSubmissions || []),
            ...(getProfile(a, 'codeforces')?.recentSubmissions || [])
          ].sort((x, y) => y.timestamp - x.timestamp);
          const submissionsB = [
            ...(getProfile(b, 'leetcode')?.recentSubmissions || []),
            ...(getProfile(b, 'codeforces')?.recentSubmissions || [])
          ].sort((x, y) => y.timestamp - x.timestamp);
          const recentA = submissionsA[0]?.timestamp || 0;
          const recentB = submissionsB[0]?.timestamp || 0;
          if (recentA !== recentB) return recentB - recentA;
          return compareNames(a, b);
        }
        case 'streak': {
          const getMaxStreak = (f: Friend) => {
            const lc = getProfile(f, 'leetcode');
            const cf = getProfile(f, 'codeforces');
            const cc = getProfile(f, 'codechef');
            return Math.max(
              lc ? StreakCalculator.calculateStreak(lc as any).currentStreak : 0,
              cf ? StreakCalculator.calculateStreak(cf as any).currentStreak : 0,
              cc ? StreakCalculator.calculateStreak(cc as any).currentStreak : 0
            );
          };
          const streakA = getMaxStreak(a);
          const streakB = getMaxStreak(b);
          if (streakA !== streakB) return streakB - streakA;
          return compareNames(a, b);
        }
        case 'name':
        default:
          return compareNames(a, b);
      }
    });
  }, [friends, profiles, sortBy, platformFilters, pendingDeletions, ownUsername, ownCodeforcesHandle, ownCodechefHandle]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'r',
      handler: () => !refreshing && handleRefresh(),
      description: 'Refresh all friends',
    },
    {
      key: 'j',
      handler: () => {
        if (activeTab === 'friends' && friends.length > 0) {
          setSelectedFriendIndex(prev => Math.min(prev + 1, friends.length - 1));
        }
      },
      description: 'Navigate down',
    },
    {
      key: 'k',
      handler: () => {
        if (activeTab === 'friends') {
          setSelectedFriendIndex(prev => Math.max(prev - 1, 0));
        }
      },
      description: 'Navigate up',
    },
    {
      key: '1',
      handler: () => handleTabChange('friends'),
      description: 'Go to Friends tab',
    },
    {
      key: '2',
      handler: () => handleTabChange('compare'),
      description: 'Go to Compare tab',
    },
    {
      key: '3',
      handler: () => handleTabChange('settings'),
      description: 'Go to Settings tab',
    },
  ]);

  useEffect(() => {
    document.body.style.background = isDarkMode ? '#0e0e0e' : '#ffffff';
  }, [isDarkMode]);

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (selectedFriend) {
    const lcAccount = selectedFriend.accounts?.find(a => a.platform === 'leetcode')?.handle || (profiles[selectedFriend.username.toLowerCase()]?.platform === 'leetcode' ? selectedFriend.username : undefined);
    const cfAccount = selectedFriend.accounts?.find(a => a.platform === 'codeforces')?.handle || (profiles[selectedFriend.username.toLowerCase()]?.platform === 'codeforces' ? selectedFriend.username : undefined);
    const ccAccount = selectedFriend.accounts?.find(a => a.platform === 'codechef')?.handle || (profiles[selectedFriend.username.toLowerCase()]?.platform === 'codechef' ? selectedFriend.username : undefined);

    return (
      <div className={`app ${isDarkMode ? 'dark' : ''}`}>
        <TabNav
          activeTab={activeTab}
          onTabChange={(tab) => {
            setSelectedFriend(null);
            setSelectedPlatform('');
            setSelectedFilter('all');
            handleTabChange(tab);
          }}
          friendCount={friends.length}
          dailyGoal={dailyGoal}
          dailySolves={dailySolvesCount}
        />

        <div className="content-area">
          <React.Suspense fallback={<Skeleton />}>
            <FriendProfileView
              friend={selectedFriend}
              leetcodeProfile={lcAccount ? (profiles[`leetcode:${lcAccount.toLowerCase()}`] || profiles[lcAccount.toLowerCase()]) : undefined}
              codeforcesProfile={cfAccount ? (profiles[`codeforces:${cfAccount.toLowerCase()}`] || profiles[cfAccount.toLowerCase()]) : undefined}
              codechefProfile={ccAccount ? (profiles[`codechef:${ccAccount.toLowerCase()}`] || profiles[ccAccount.toLowerCase()]) : undefined}
              initialPlatform={(selectedPlatform as 'leetcode' | 'codeforces' | 'codechef') || undefined}
              initialFilter={selectedFilter as 'all' | 'Easy' | 'Medium' | 'Hard'}
              onBack={() => {
                setSelectedFriend(null);
                setSelectedPlatform('');
                setSelectedFilter('all');
              }}
              isDarkMode={isDarkMode}
            />
          </React.Suspense>
        </div>

        <header className="header header-bottom" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--border-color, #222)' }}>
          <a href="https://lamigo.netlify.app" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <img src="android-chrome-192x192.png" alt="L'Amigo" className="header-logo" style={{ width: '24px', height: '24px' }} />
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="icon-btn-bottom"
              id="import-export-btn-profile"
              title="Import / Export friends and data"
              aria-label="Import or export friends and data"
              onClick={() => setShowImportExport(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', border: '1px solid var(--border-primary, #333)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '0px', padding: 0 }}
            >
              <Database size={18} />
            </button>
            <button
              className="icon-btn-bottom"
              title="Add friend"
              aria-label="Add friend"
              onClick={() => { setEditingFriend(null); setShowAddModal(true); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', border: '1px solid var(--border-primary, #333)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '0px', padding: 0 }}
            >
              <UserPlus size={18} />
            </button>
            <button 
              className="icon-btn-bottom" 
              onClick={toggleDarkMode} 
              title="Toggle dark mode"
              aria-label="Toggle dark mode"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', border: '1px solid var(--border-primary, #333)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '0px', padding: 0 }}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <AddEditFriendModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={async () => {
            setToast({ message: editingFriend ? 'Friend updated!' : 'Friend added!', type: 'success' });
            const loaded = await loadData(ownUsername);
            if (loaded) await verifyAndReconcileState(loaded.friends, loaded.profiles);
          }}
          friend={editingFriend as any}
        />

        {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          action={toast.action}
          duration={toast.duration}
          onClose={() => setToast(null)} 
        />
      )}
      </div>
    );
  }

  const fs = fontSizeScale / 100;
  const zoom = displayZoomScale / 100;
  const customStyles = {
    '--font-size-xs': `${10 * fs}px`,
    '--font-size-sm': `${11 * fs}px`,
    '--font-size-base': `${12 * fs}px`,
    '--font-size-md': `${13 * fs}px`,
    '--font-size-value': `${18 * fs}px`,
    '--font-size-label': `${10 * fs}px`,
    '--font-size-title': `${14 * fs}px`,
    width: `${400 / zoom}px`,
    minHeight: `${500 / zoom}px`,
    maxHeight: `${600 / zoom}px`,
    zoom: zoom,
  } as React.CSSProperties;

  if (loading) {
    return (
      <div className={`app ${isDarkMode ? 'dark' : ''}`} style={customStyles}>
        <TabNav 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          friendCount={0}
          dailyGoal={dailyGoal}
          dailySolves={dailySolvesCount}
        />
        <Skeleton />
      </div>
    );
  }

  return (
    <div className={`app ${isDarkMode ? 'dark' : ''}`} style={customStyles}>
      <TabNav 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          chrome.storage.local.set({ ui_active_tab: tab });
        }}
        friendCount={friends.length}
        dailyGoal={dailyGoal}
        dailySolves={dailySolvesCount}
      />

      {activeTab === 'friends' && friends.length > 0 && (
        <div className="controls-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 16px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color, #222)' }}>
          <div className="controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', padding: 0, border: 'none', background: 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <label title="Sort your friends list by different criteria" style={{ margin: 0 }}>
              Sort by:
              <select value={sortBy} onChange={(e) => {
                const val = e.target.value as 'name' | 'problems' | 'recent' | 'streak';
                setSortBy(val);
                chrome.storage.local.set({ ui_sort_by: val });
              }}>
                <option value="name">Name</option>
                <option value="problems">Problems Solved</option>
                <option value="recent">Last Submitted</option>
                <option value="streak">Current Streak</option>
              </select>
            </label>
            <div className="platform-filters" style={{ display: 'flex', gap: '4px' }}>
              {(['leetcode', 'codeforces', 'codechef'] as Platform[])
                .filter(plat => !disabledPlatforms.includes(plat))
                .map(plat => {
                const isActive = platformFilters.includes(plat);
                const initials = plat === 'leetcode' ? 'LC' : plat === 'codeforces' ? 'CF' : 'CC';
                return (
                  <button
                    key={plat}
                    onClick={() => {
                      if (isActive && platformFilters.length === 1) return;
                      const newFilters = isActive ? platformFilters.filter(p => p !== plat) : [...platformFilters, plat];
                      setPlatformFilters(newFilters);
                      chrome.storage.local.set({ ui_platform_filters: newFilters });
                    }}
                    style={{
                      padding: '2px 8px',
                      fontSize: 'var(--font-size-sm)',
                      borderRadius: '0px',
                      cursor: isActive && platformFilters.length === 1 ? 'not-allowed' : 'pointer',
                      background: isActive ? 
                        (plat === 'leetcode' ? 'rgba(234, 179, 8, 0.15)' : 
                         plat === 'codeforces' ? 'rgba(59, 130, 246, 0.15)' : 
                         'rgba(180, 83, 9, 0.15)') : 'transparent',
                      color: isActive ? 
                        (plat === 'leetcode' ? '#eab308' : 
                         plat === 'codeforces' ? '#3b82f6' : 
                         '#d97706') : '#888',
                      border: `1px solid ${isActive ? 
                        (plat === 'leetcode' ? '#eab308' : 
                         plat === 'codeforces' ? '#3b82f6' : 
                         '#b45309') : 'transparent'}`,
                      transition: 'all 0.2s ease',
                      fontWeight: isActive ? 600 : 400,
                    }}
                    title={isActive && platformFilters.length === 1 ? `Cannot disable the last active platform` : `Toggle ${plat} (${isActive ? 'Active' : 'Inactive'}) - Toggling platforms dynamically filters the active view, recalculating stats and visible friend accounts.`}
                  >
                    {initials}
                  </button>
                );
              })}
            </div>
          </div>
          <span className="last-updated-info" style={{ whiteSpace: 'nowrap', marginLeft: '8px', flexShrink: 1, textOverflow: 'ellipsis', overflow: 'hidden' }}>
            Updated {formatTimestamp(lastUpdated)}
          </span>
          </div>
        </div>
      )}

      <div className="content-area">
        <div key={activeTab} className="tab-content-enter" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <React.Suspense fallback={<Skeleton />}>
            {activeTab === 'friends' ? (
              <>
                <GlobalActivityFeed profiles={profiles} ownUsername={ownUsername} />
                <Recommendations profiles={profiles} ownUsername={ownUsername} />
                <UpcomingContests key={refreshContestsKey} />

                {(friends.length === 0 && !ownUsername && !ownCodeforcesHandle && !ownCodechefHandle) ? (
                  <div className="empty-state">
                    <img src="empty-state.svg" alt="No friends yet" style={{ width: '150px', height: '150px', marginBottom: '16px', opacity: 0.7 }} />
                    <p className="empty-title">Welcome to L'Amigo!</p>
                    <p className="empty-message">Track your friends' problem solving progress across platforms</p>
                    <p className="hint">Start by adding a friend's handle below</p>
                    <div className="example-hint">
                      <small>Examples: "john_doe" or "tourist"</small>
                    </div>
                    <button
                      onClick={() => { setEditingFriend(null); setShowAddModal(true); }}
                      style={{ marginTop: '16px', padding: '8px 16px', background: 'var(--rank-leetcode-knight, #2b7af7)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: 'var(--font-size-base)', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      Add your first friend ➔
                    </button>
                  </div>
                ) : (
                  <div className="friends-list">
                    {sortedFriends.map((friend) => {
                      const isOwn = friend.id === 'own-user';
                      const lcAccount = friend.accounts?.find(a => a.platform === 'leetcode')?.handle || (profiles[friend.username.toLowerCase()]?.platform === 'leetcode' ? friend.username : undefined);
                      const cfAccount = friend.accounts?.find(a => a.platform === 'codeforces')?.handle || (profiles[friend.username.toLowerCase()]?.platform === 'codeforces' ? friend.username : undefined);
                      const ccAccount = friend.accounts?.find(a => a.platform === 'codechef')?.handle || (profiles[friend.username.toLowerCase()]?.platform === 'codechef' ? friend.username : undefined);

                      const lcProfile = lcAccount ? (profiles[`leetcode:${lcAccount.toLowerCase()}`] || profiles[lcAccount.toLowerCase()]) : undefined;
                      const cfProfile = cfAccount ? (profiles[`codeforces:${cfAccount.toLowerCase()}`] || profiles[cfAccount.toLowerCase()]) : undefined;
                      const ccProfile = ccAccount ? (profiles[`codechef:${ccAccount.toLowerCase()}`] || profiles[ccAccount.toLowerCase()]) : undefined;
                      const mainProfile = isOwn ? (lcProfile || cfProfile || ccProfile) : profiles[friend.username.toLowerCase()];

                      return (
                        <FriendCard
                          key={isOwn ? 'own-user' : (friend.id || friend.username)}
                          friend={friend}
                          profile={mainProfile}
                          leetcodeProfile={lcProfile}
                          codeforcesProfile={cfProfile}
                          codechefProfile={ccProfile}
                          isPinned={pinnedFriends.includes(friend.id || friend.username)}
                          onTogglePin={() => { if (!isOwn) handleTogglePin(friend.id || friend.username); }}
                          onRemove={() => { if (!isOwn) handleRemoveFriend(friend.id || friend.username, friend.displayName || friend.username); }}
                          onRefresh={() => {
                            if (isOwn) {
                              return handleRefreshOwn();
                            } else {
                              return handleRefreshFriend(friend.username);
                            }
                          }}
                          onEdit={(f) => { if (!isOwn) { setEditingFriend(f); setShowAddModal(true); } }}
                          onViewProfile={(platform, filter) => {
                            setSelectedFriend(friend);
                            setSelectedPlatform(platform);
                            setSelectedFilter(filter || 'all');
                          }}
                          refreshing={refreshingFriend === friend.username}
                          isDarkMode={isDarkMode}
                          isOwn={isOwn}
                          platformFilters={platformFilters}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            ) : activeTab === 'compare' ? (
              <CompareTab 
                friends={friends} 
                profiles={profiles} 
                isDarkMode={isDarkMode} 
                ownUsername={ownUsername} 
                ownCodeforcesHandle={ownCodeforcesHandle}
                ownCodechefHandle={ownCodechefHandle}
              />
            ) : (
              <SettingsTab 
                onSync={loadData} 
                isDarkMode={isDarkMode}
                onToggleDarkMode={toggleDarkMode}
                ownUsername={ownUsername}
                onUsernameChange={setOwnUsername}
                ownCodeforcesHandle={ownCodeforcesHandle}
                onCodeforcesHandleChange={setOwnCodeforcesHandle}
                ownCodechefHandle={ownCodechefHandle}
                onCodechefHandleChange={setOwnCodechefHandle}
                ownCsesHandle={ownCsesHandle}
                onCsesHandleChange={setOwnCsesHandle}
                onToast={(message, type) => setToast({ message, type })}
                onConfirmAction={requestConfirm}
                onOpenImportExport={() => setShowImportExport(true)}
              />
            )}
          </React.Suspense>
        </div>
      </div>

      <header className="header header-bottom" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--border-color, #222)' }}>
        <a href="https://lamigo.netlify.app" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <img src="android-chrome-192x192.png" alt="L'Amigo" className="header-logo" style={{ width: '24px', height: '24px' }} />
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="icon-btn-bottom"
            id="import-export-btn-main"
            title="Import / Export friends and data"
            aria-label="Import or export friends and data"
            onClick={() => setShowImportExport(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', border: '1px solid var(--border-primary, #333)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '0px', padding: 0 }}
          >
            <Database size={18} />
          </button>
          <button 
            className={`icon-btn-bottom ${addingFriend ? 'disabled' : ''}`}
            title="Add friend"
            aria-label="Add friend"
            disabled={addingFriend}
            onClick={() => {
              if (!addingFriend) {
                setEditingFriend(null);
                setShowAddModal(true);
              }
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', border: '1px solid var(--border-primary, #333)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: addingFriend ? 'not-allowed' : 'pointer', borderRadius: '0px', padding: 0, opacity: addingFriend ? 0.7 : 1 }}
          >
            <UserPlus size={18} />
          </button>
          <button
            className="icon-btn-bottom"
            onClick={handleRefresh}
            disabled={refreshing}
            title={refreshing ? 'Refreshing...' : 'Refresh all data'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', border: '1px solid var(--border-primary, #333)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: refreshing ? 'not-allowed' : 'pointer', borderRadius: '0px', padding: 0, opacity: refreshing ? 0.6 : 1 }}
          >
            <RefreshCw size={18} style={{ transform: refreshing ? 'rotate(180deg)' : 'none', transition: 'transform 1s ease' }} />
          </button>
          <button 
            className="icon-btn-bottom" 
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })}
            title="Open Full Dashboard"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', background: 'linear-gradient(45deg, #ff375f, #ffa116)', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '0px', padding: 0 }}
          >
            <LayoutDashboard size={18} />
          </button>
          <button 
            className="icon-btn-bottom" 
            onClick={toggleDarkMode}
            title="Toggle dark mode"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', border: '1px solid var(--border-primary, #333)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '0px', padding: 0 }}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => {
          setModal({ ...modal, isOpen: false });
          setConfirmAction(null);
        }}
        onConfirm={confirmAction ? () => {
          confirmAction();
          setConfirmAction(null);
        } : undefined}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        showCancel={!!confirmAction}
      />
      
      <React.Suspense fallback={null}>
        <AddEditFriendModal 
          isOpen={showAddModal} 
          onClose={() => setShowAddModal(false)} 
          onSuccess={async () => {
            setToast({ message: editingFriend ? 'Friend updated!' : 'Friend added!', type: 'success' });
            const loaded = await loadData(ownUsername);
            if (loaded) {
              await verifyAndReconcileState(loaded.friends, loaded.profiles);
            }
          }} 
          friend={editingFriend as any} 
        />
        <ImportExportModal
          isOpen={showImportExport}
          onClose={() => setShowImportExport(false)}
          friends={friends}
          profiles={profiles}
          onFriendsImported={async () => {
            const loaded = await loadData(ownUsername);
            if (loaded) await verifyAndReconcileState(loaded.friends, loaded.profiles);
          }}
          onToast={(message, type) => setToast({ message, type })}
        />
      </React.Suspense>
      
      {isOffline && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(90deg, #1a1a2e, #16213e)',
          color: '#f0a500', padding: '6px 12px',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 'var(--font-size-base)', fontWeight: 600, letterSpacing: '0.3px',
          borderTop: '1px solid rgba(240,165,0,0.3)',
        }}>
          <WifiOff size={13} />
          You're offline — showing cached data
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          action={toast.action}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
