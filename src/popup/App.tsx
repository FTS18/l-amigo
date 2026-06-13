import React, { useState, useEffect, useMemo } from 'react';
import { Friend, FriendProfile, Platform } from '../types';
import { StorageService } from '../services/storage';
import { LeetCodeService } from '../services/leetcode';
import { CodeforcesService } from '../services/codeforces';
import { PlatformService } from '../services/platform-service';
import { ExportService } from '../services/export';
import { DATA_LIMITS } from '../constants';
import { FriendCard } from './FriendCard';
import { Recommendations } from './Recommendations';
import { TabNav } from './TabNav';
import { SettingsTab } from './SettingsTab';
import { CompareTab } from './CompareTab';
import { Onboarding } from './Onboarding';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { Modal } from './Modal';
import { Toast } from './Toast';
import { Skeleton } from './Skeleton';
import { GlobalActivityFeed } from './GlobalActivityFeed';
import { FriendProfileView } from './FriendProfileView';
import { AddEditFriendModal } from './AddEditFriendModal';
import { UpcomingContests } from './UpcomingContests';
import { Sun, Moon, MoreVertical, Download } from 'lucide-react';
import './App.css';
const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

const extractUsername = (input: string): string => {
  const trimmed = input.trim();
  
  // Check if it's a URL
  if (trimmed.includes('leetcode.com/')) {
    // Extract username from URL like: https://leetcode.com/username or leetcode.com/username
    const match = trimmed.match(/leetcode\.com\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Return as-is if it's just a username
  return trimmed;
};

export const App: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [profiles, setProfiles] = useState<Record<string, FriendProfile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingFriend, setRefreshingFriend] = useState<string | null>(null);
  const [addingFriend, setAddingFriend] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'problems' | 'recent'>('recent');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'compare' | 'settings'>('friends');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ownUsername, setOwnUsername] = useState<string>('');
  const [ownCodeforcesHandle, setOwnCodeforcesHandle] = useState<string>('');
  const [ownCodechefHandle, setOwnCodechefHandle] = useState<string>('');
  const [selectedFriendIndex, setSelectedFriendIndex] = useState(0);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
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
  }, []);

  const checkOnboarding = async () => {
    const result = await chrome.storage.local.get(['onboarding_complete', 'own_username', 'own_codeforces_handle', 'own_codechef_handle']);
    if (!result.onboarding_complete) {
      setShowOnboarding(true);
      setLoading(false);
    } else {
      const username = result.own_username || '';
      setOwnUsername(username);
      setOwnCodeforcesHandle(result.own_codeforces_handle || '');
      setOwnCodechefHandle(result.own_codechef_handle || '');
      loadData(username);
    }
  };

  const handleOnboardingComplete = async (username: string) => {
    const lowerUsername = username.toLowerCase();
    setOwnUsername(lowerUsername);
    setShowOnboarding(false);
    
    // Fetch and save own LeetCode profile if provided
    if (lowerUsername) {
      try {
        const profile = await LeetCodeService.fetchUserProfile(lowerUsername);
        await StorageService.saveProfile(profile);
      } catch (error) {
        console.error('Error fetching own profile:', error);
      }
    }

    // Fetch and save own Codeforces profile if provided
    const result = await chrome.storage.local.get(['own_codeforces_handle', 'own_codechef_handle']);
    const ownCF = result.own_codeforces_handle || '';
    setOwnCodeforcesHandle(ownCF);
    if (ownCF) {
      try {
        const profile = await CodeforcesService.fetchUserProfile(ownCF);
        await StorageService.saveProfile(profile);
      } catch (error) {
        console.error('Error fetching own Codeforces profile:', error);
      }
    }
    
    // Fetch and save own Codechef profile if provided
    const ownCC = result.own_codechef_handle || '';
    setOwnCodechefHandle(ownCC);
    if (ownCC) {
      try {
        const profile = await PlatformService.fetchProfile('codechef', ownCC);
        await StorageService.saveProfile(profile);
      } catch (error) {
        console.error('Error fetching own Codechef profile:', error);
      }
    }
    
    loadData(lowerUsername);
  };

  const loadTheme = async () => {
    const result = await chrome.storage.local.get('darkMode');
    if (result.darkMode !== undefined) {
      setIsDarkMode(result.darkMode);
    } else {
      // First time - detect system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(systemPrefersDark);
      await chrome.storage.local.set({ darkMode: systemPrefersDark });
    }
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
      console.log("[App] Starting deep state verification and reconciliation cycle...");
      const storageFriends = await StorageService.getFriends();
      const storageProfiles = await StorageService.getProfiles();
      
      const friendsToCompare = currentFriends || friends;
      const profilesToCompare = currentProfiles || profiles;
      
      let isFriendsSynced = true;
      if (friendsToCompare.length !== storageFriends.length) {
        isFriendsSynced = false;
      } else {
        for (const sf of storageFriends) {
          const mf = friendsToCompare.find(f => f.id === sf.id || f.username.toLowerCase() === sf.username.toLowerCase());
          if (!mf) {
            isFriendsSynced = false;
            break;
          }
          if (sf.username !== mf.username || sf.displayName !== mf.displayName) {
            isFriendsSynced = false;
            break;
          }
          if ((sf.accounts?.length || 0) !== (mf.accounts?.length || 0)) {
            isFriendsSynced = false;
            break;
          }
          for (const sa of sf.accounts || []) {
            const ma = mf.accounts?.find(a => a.platform === sa.platform && a.handle.toLowerCase() === sa.handle.toLowerCase());
            if (!ma || ma.status !== sa.status) {
              isFriendsSynced = false;
              break;
            }
          }
          if (!isFriendsSynced) break;
        }
      }

      let isProfilesSynced = true;
      const storageProfileKeys = Object.keys(storageProfiles);
      const memoryProfileKeys = Object.keys(profilesToCompare);
      if (storageProfileKeys.length !== memoryProfileKeys.length) {
        isProfilesSynced = false;
      } else {
        for (const key of storageProfileKeys) {
          const sp = storageProfiles[key];
          const mp = profilesToCompare[key];
          if (!mp) {
            isProfilesSynced = false;
            break;
          }
          if (sp.problemsSolved?.total !== mp.problemsSolved?.total ||
              sp.contestRating !== mp.contestRating ||
              (sp.recentSubmissions?.length || 0) !== (mp.recentSubmissions?.length || 0)) {
            isProfilesSynced = false;
            break;
          }
        }
      }

      if (!isFriendsSynced || !isProfilesSynced) {
        console.warn("[App] Desynchronization detected between React memory state and chrome.storage.local!", {
          friendsSynced: isFriendsSynced,
          profilesSynced: isProfilesSynced
        });
        setFriends(storageFriends);
        setProfiles(storageProfiles);
        setLastUpdated(Date.now());
        console.log("[App] State reconciled with chrome.storage.local successfully.");
        return false;
      } else {
        console.log("[App] Deep verification successful: React state matches chrome.storage.local perfectly.");
        return true;
      }
    } catch (error) {
      console.error("[App] Deep verification failed:", error);
      return false;
    }
  };

  const loadData = async (currentUsername?: string) => {
    try {
      // 1. Load from cache instantly — popup appears immediately
      const friendsList = await StorageService.getFriends();
      const profilesData = await StorageService.getProfiles();
      setFriends(friendsList);
      setProfiles(profilesData);
      setLastUpdated(Date.now());

      const { own_codeforces_handle: ownCF, own_codechef_handle: ownCC } = await chrome.storage.local.get(["own_codeforces_handle", "own_codechef_handle"]);
      setOwnCodeforcesHandle(ownCF || '');
      setOwnCodechefHandle(ownCC || '');

      const username = currentUsername || ownUsername;

      // 2. Determine which profiles need a refresh (stale or missing)
      const now = Date.now();
      const accountsToCheck: Array<{ platform: Platform; handle: string }> = [];

      // Own profiles
      const { own_username: ownUser, own_codeforces_handle: ownCodeforcesHandleObj, own_codechef_handle: ownCodechefHandleObj } =
        await chrome.storage.local.get(["own_username", "own_codeforces_handle", "own_codechef_handle"]);

      if (ownUser) {
        accountsToCheck.push({ platform: 'leetcode', handle: ownUser });
      }
      if (ownCodeforcesHandleObj) {
        accountsToCheck.push({ platform: 'codeforces', handle: ownCodeforcesHandleObj });
      }
      if (ownCodechefHandleObj) {
        accountsToCheck.push({ platform: 'codechef', handle: ownCodechefHandleObj });
      }

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
        if (!p || (now - (p.lastFetched || 0)) > DATA_LIMITS.PROFILE_STALE_THRESHOLD) {
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
          }
          // Silently update state with fresh data
          const freshProfiles = await StorageService.getProfiles();
          setProfiles(freshProfiles);
          setLastUpdated(Date.now());
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

  const handleAddFriend = async (username: string) => {
    if (!username.trim()) return;
    // Check if it's the user's own username
    if (ownUsername && username.toLowerCase() === ownUsername.toLowerCase()) {
      setToast({ message: "You can't add yourself as a friend!", type: 'info' });
      return;
    }

    setAddingFriend(true);
    try {
      await StorageService.addFriend(username);
      
      // Fetch profile immediately
      try {
        const profile = await LeetCodeService.fetchUserProfile(username);
        await StorageService.saveProfile(profile);
      } catch (profileErr) {
        console.warn(`Added ${username} but profile fetch failed:`, profileErr);
      }
      
      // Reload data
      await loadData();
      setToast({ message: `${username} added successfully!`, type: 'success' });
    } catch (error) {
      if (error instanceof Error) {
        setToast({ message: error.message, type: 'error' });
      }
    } finally {
      setAddingFriend(false);
    }
  };

  const handleRemoveFriend = async (username: string) => {
    setModal({
      isOpen: true,
      title: 'Remove Friend',
      message: `Remove ${username} from your friends list?`,
      type: 'info'
    });
    setConfirmAction(() => async () => {
      try {
        await StorageService.removeFriend(username);
        await loadData();
        setToast({ message: `${username} removed`, type: 'success' });
      } catch (error) {
        setToast({ message: 'Failed to remove friend', type: 'error' });
      }
    });
  };

  const handleExport = (format: 'csv' | 'detailed' | 'json') => {
    switch (format) {
      case 'csv':
        ExportService.exportToCSV(friends, profiles);
        setToast({ message: 'Data exported as CSV!', type: 'success' });
        break;
      case 'detailed':
        ExportService.exportDetailedCSV(friends, profiles);
        setToast({ message: 'Detailed data exported as CSV!', type: 'success' });
        break;
      case 'json':
        ExportService.exportToJSON(friends, profiles);
        setToast({ message: 'Data exported as JSON!', type: 'success' });
        break;
    }
    setShowExportMenu(false);
    setShowMenu(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
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
          // Fallback legacy friend
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
    }
  };

  const handleRefreshFriend = async (username: string) => {
    setRefreshingFriend(username);
    try {
      const targetFriend = friends.find(f => f.username.toLowerCase() === username.toLowerCase());
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
    } catch (error) {
      setToast({ message: `Failed to refresh ${username}`, type: 'error' });
    } finally {
      setRefreshingFriend(null);
    }
  };

  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      const getProfile = (f: Friend, platform: Platform) => {
        const handle = f.accounts?.find(acc => acc.platform === platform)?.handle || (profiles[f.username.toLowerCase()]?.platform === platform ? f.username : undefined);
        if (!handle) return undefined;
        return profiles[`${platform}:${handle.toLowerCase()}`] || profiles[handle.toLowerCase()];
      };

      switch (sortBy) {
        case 'problems': {
          const solvedA = (getProfile(a, 'leetcode')?.problemsSolved.total || 0) + (getProfile(a, 'codeforces')?.problemsSolved.total || 0) + (getProfile(a, 'codechef')?.problemsSolved.total || 0);
          const solvedB = (getProfile(b, 'leetcode')?.problemsSolved.total || 0) + (getProfile(b, 'codeforces')?.problemsSolved.total || 0) + (getProfile(b, 'codechef')?.problemsSolved.total || 0);
          return solvedB - solvedA;
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
          return recentB - recentA;
        }
        case 'name':
        default:
          return a.username.localeCompare(b.username);
      }
    });
  }, [friends, profiles, sortBy]);

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
      handler: () => setActiveTab('friends'),
      description: 'Go to Friends tab',
    },
    {
      key: '2',
      handler: () => setActiveTab('compare'),
      description: 'Go to Compare tab',
    },
    {
      key: '3',
      handler: () => setActiveTab('settings'),
      description: 'Go to Settings tab',
    },
    {
      key: 'Escape',
      handler: () => setShowMenu(false),
      description: 'Close menu',
    },
  ]);

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
            setActiveTab(tab);
          }}
          friendCount={friends.length}
        />

        <div className="content-area">
          <FriendProfileView
            friend={selectedFriend}
            leetcodeProfile={lcAccount ? (profiles[`leetcode:${lcAccount.toLowerCase()}`] || profiles[lcAccount.toLowerCase()]) : undefined}
            codeforcesProfile={cfAccount ? (profiles[`codeforces:${cfAccount.toLowerCase()}`] || profiles[cfAccount.toLowerCase()]) : undefined}
            codechefProfile={ccAccount ? (profiles[`codechef:${ccAccount.toLowerCase()}`] || profiles[ccAccount.toLowerCase()]) : undefined}
            initialPlatform={selectedPlatform as 'leetcode' | 'codeforces' | 'codechef'}
            initialFilter={selectedFilter as 'all' | 'Easy' | 'Medium' | 'Hard'}
            onBack={() => {
              setSelectedFriend(null);
              setSelectedPlatform('');
              setSelectedFilter('all');
            }}
            isDarkMode={isDarkMode}
          />
        </div>

        <header className="header header-bottom">
          <a href="https://lamigo.netlify.app" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="android-chrome-192x192.png" alt="L'Amigo" className="header-logo" />
          </a>
          <div className="header-search-add" style={{ display: 'flex', justifyContent: 'flex-end', flex: 1, paddingRight: '12px' }}>
            <button
              className="add-friend-btn-header"
              title="Add friend"
              onClick={() => { setEditingFriend(null); setShowAddModal(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '2px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '0px' }}
            >
              + Add Friend
            </button>
          </div>
          <div className="header-actions">
            <button className="theme-toggle" onClick={toggleDarkMode} title="Toggle dark mode">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="menu-container">
              <button 
                className="menu-btn" 
                onClick={() => setShowMenu(!showMenu)}
                title="Options"
              >
                <MoreVertical size={18} />
              </button>
              {showMenu && (
                <div className="menu-dropdown">
                  <button onClick={handleRefresh} disabled={refreshing}>
                    {refreshing ? 'Refreshing...' : 'Refresh All'}
                  </button>
                  <button onClick={() => setShowExportMenu(!showExportMenu)}>
                    Export Data {showExportMenu ? '▴' : '▾'}
                  </button>
                  {showExportMenu && (
                    <div className="submenu">
                      <button onClick={() => handleExport('csv')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={14} /> Export CSV
                      </button>
                      <button onClick={() => handleExport('detailed')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={14} /> Export Detailed CSV
                      </button>
                      <button onClick={() => handleExport('json')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={14} /> Export JSON
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`app ${isDarkMode ? 'dark' : ''}`}>
        <TabNav 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          friendCount={0}
        />
        <Skeleton />
      </div>
    );
  }

  return (
    <div className={`app ${isDarkMode ? 'dark' : ''}`}>
      <TabNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        friendCount={friends.length}
      />

      {activeTab === 'friends' && friends.length > 0 && (
        <div className="controls">
          <label title="Sort your friends list by different criteria">
            Sort by:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} title="Choose how to sort friends">
              <option value="name">Name</option>
              <option value="problems">Problems Solved</option>
              <option value="recent">Last Submitted</option>
            </select>
          </label>
          <span className="last-updated-info">Updated {formatTimestamp(lastUpdated)}</span>
          <button 
            className="refresh-btn-controls"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh all"
          >
            {refreshing ? '⟳' : '↻'}
          </button>
        </div>
      )}

      <div className="content-area">
        <div key={activeTab} className="tab-content-enter" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {activeTab === 'friends' ? (
            <>
              <GlobalActivityFeed profiles={profiles} ownUsername={ownUsername} />
              <Recommendations profiles={profiles} ownUsername={ownUsername} />
              <UpcomingContests />

              {friends.length === 0 ? (
                <div className="empty-state">
                  <img src="empty-state.svg" alt="No friends yet" style={{ width: '150px', height: '150px', marginBottom: '16px', opacity: 0.7 }} />
                  <p className="empty-title">Welcome to L'Amigo!</p>
                  <p className="empty-message">Track your friends' LeetCode progress</p>
                  <p className="hint">Start by adding a friend's LeetCode username or profile URL below</p>
                  <div className="example-hint">
                    <small>Examples: "john_doe" or "https://leetcode.com/john_doe"</small>
                  </div>
                </div>
              ) : (
                <div className="friends-list">
                  {sortedFriends.map((friend) => {
                    const lcAccount = friend.accounts?.find(a => a.platform === 'leetcode')?.handle || (profiles[friend.username.toLowerCase()]?.platform === 'leetcode' ? friend.username : undefined);
                    const cfAccount = friend.accounts?.find(a => a.platform === 'codeforces')?.handle || (profiles[friend.username.toLowerCase()]?.platform === 'codeforces' ? friend.username : undefined);
                    const ccAccount = friend.accounts?.find(a => a.platform === 'codechef')?.handle || (profiles[friend.username.toLowerCase()]?.platform === 'codechef' ? friend.username : undefined);

                    return (
                      <FriendCard
                        key={friend.username}
                        friend={friend}
                        profile={profiles[friend.username.toLowerCase()]}
                        leetcodeProfile={lcAccount ? (profiles[`leetcode:${lcAccount.toLowerCase()}`] || profiles[lcAccount.toLowerCase()]) : undefined}
                        codeforcesProfile={cfAccount ? (profiles[`codeforces:${cfAccount.toLowerCase()}`] || profiles[cfAccount.toLowerCase()]) : undefined}
                        codechefProfile={ccAccount ? (profiles[`codechef:${ccAccount.toLowerCase()}`] || profiles[ccAccount.toLowerCase()]) : undefined}
                        onRemove={() => handleRemoveFriend(friend.username)}
                        onRefresh={() => handleRefreshFriend(friend.username)}
                        onEdit={(f) => { setEditingFriend(f); setShowAddModal(true); }}
                        onViewProfile={(platform, filter) => {
                          setSelectedFriend(friend);
                          setSelectedPlatform(platform);
                          setSelectedFilter(filter || 'all');
                        }}
                        refreshing={refreshingFriend === friend.username}
                        isDarkMode={isDarkMode}
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
              onToast={(message, type) => setToast({ message, type })}
            />
          )}
        </div>
      </div>

      <header className="header header-bottom">
        <a href="https://lamigo.netlify.app" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="android-chrome-192x192.png" alt="L'Amigo" className="header-logo" />
        </a>
        <div className="header-search-add" style={{ display: 'flex', justifyContent: 'flex-end', flex: 1, paddingRight: '12px' }}>
          <button 
            className="add-friend-btn-header"
            title="Add friend"
            onClick={() => {
              setEditingFriend(null);
              setShowAddModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '2px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '0px' }}
          >
            + Add Friend
          </button>
        </div>
        <div className="header-actions">
          <button 
            className="theme-toggle" 
            onClick={toggleDarkMode}
            title="Toggle dark mode"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="menu-container">
            <button 
              className="menu-btn" 
              onClick={() => setShowMenu(!showMenu)}
              title="Options"
            >
              <MoreVertical size={18} />
            </button>
            {showMenu && (
              <div className="menu-dropdown">
                <button onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? 'Refreshing...' : 'Refresh All'}
                </button>
                <button onClick={() => {
                  setShowExportMenu(!showExportMenu);
                }}>
                  Export Data {showExportMenu ? '▴' : '▾'}
                </button>
                {showExportMenu && (
                  <div className="submenu">
                    <button onClick={() => handleExport('csv')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Download size={14} /> Export CSV
                    </button>
                    <button onClick={() => handleExport('detailed')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Download size={14} /> Export Detailed CSV
                    </button>
                    <button onClick={() => handleExport('json')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Download size={14} /> Export JSON
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
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
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
