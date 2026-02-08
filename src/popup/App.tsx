import React, { useState, useEffect, useMemo } from 'react';
import { Friend, FriendProfile } from '../types';
import { StorageService } from '../services/storage';
import { LeetCodeService } from '../services/leetcode';
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
  const [selectedFriendIndex, setSelectedFriendIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'info' | 'error' | 'success' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    checkOnboarding();
    loadTheme();
  }, []);

  const checkOnboarding = async () => {
    const result = await chrome.storage.local.get(['onboarding_complete', 'own_username']);
    if (!result.onboarding_complete) {
      setShowOnboarding(true);
      setLoading(false);
    } else {
      const username = result.own_username || '';
      setOwnUsername(username);
      loadData(username);
    }
  };

  const handleOnboardingComplete = async (username: string) => {
    const lowerUsername = username.toLowerCase();
    setOwnUsername(lowerUsername);
    setShowOnboarding(false);
    
    // Fetch and save own profile
    try {
      const profile = await LeetCodeService.fetchUserProfile(lowerUsername);
      await StorageService.saveProfile(profile);
    } catch (error) {
      console.error('Error fetching own profile:', error);
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

  const loadData = async (currentUsername?: string) => {
    try {
      // 1. Load from cache instantly — popup appears immediately
      const friendsList = await StorageService.getFriends();
      const profilesData = await StorageService.getProfiles();
      setFriends(friendsList);
      setProfiles(profilesData);
      setLastUpdated(Date.now());

      const username = currentUsername || ownUsername;

      // 2. Determine which profiles need a refresh (stale or missing)
      const now = Date.now();
      const staleUsernames: string[] = [];

      // Own profile
      if (username) {
        const own = profilesData[username.toLowerCase()];
        if (!own || (now - (own.lastFetched || 0)) > DATA_LIMITS.PROFILE_STALE_THRESHOLD) {
          staleUsernames.push(username);
        }
      }

      // Friend profiles
      for (const f of friendsList) {
        const p = profilesData[f.username.toLowerCase()];
        if (!p || (now - (p.lastFetched || 0)) > DATA_LIMITS.PROFILE_STALE_THRESHOLD) {
          staleUsernames.push(f.username);
        }
      }

      // 3. Background-refresh only stale profiles (non-blocking UI update)
      if (staleUsernames.length > 0) {
        console.log(`[App] ${staleUsernames.length} stale profiles — refreshing in background`);
        (async () => {
          const BATCH = 3;
          for (let i = 0; i < staleUsernames.length; i += BATCH) {
            const batch = staleUsernames.slice(i, i + BATCH);
            await Promise.allSettled(
              batch.map(async (u) => {
                try {
                  const profile = await LeetCodeService.fetchUserProfile(u);
                  await StorageService.saveProfile(profile);
                } catch (e) {
                  console.warn(`[App] Background refresh failed for ${u}:`, e);
                }
              }),
            );
          }
          // Silently update state with fresh data
          const freshProfiles = await StorageService.getProfiles();
          setProfiles(freshProfiles);
          setLastUpdated(Date.now());
        })();
      }
    } catch (error) {
      console.error('Error loading data:', error);
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
      // Refresh own profile first
      if (ownUsername) {
        try {
          const ownProfile = await LeetCodeService.fetchUserProfile(ownUsername);
          await StorageService.saveProfile(ownProfile);
        } catch (e) {
          console.error('Error refreshing own profile:', e);
        }
      }

      // Refresh friends in parallel batches of 3 to avoid rate-limiting
      const BATCH_SIZE = 3;
      let failed = 0;
      for (let i = 0; i < friends.length; i += BATCH_SIZE) {
        const batch = friends.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (friend) => {
            const profile = await LeetCodeService.fetchUserProfile(friend.username);
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
      const profile = await LeetCodeService.fetchUserProfile(username);
      await StorageService.saveProfile(profile);
      await loadData();
      setToast({ message: `Refreshed ${username}!`, type: 'success' });
    } catch (error) {
      setToast({ message: `Failed to refresh ${username}`, type: 'error' });
    } finally {
      setRefreshingFriend(null);
    }
  };

  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      const profileA = profiles[a.username.toLowerCase()];
      const profileB = profiles[b.username.toLowerCase()];

      switch (sortBy) {
        case 'problems':
          return (profileB?.problemsSolved.total || 0) - (profileA?.problemsSolved.total || 0);
        case 'recent':
          const recentA = profileA?.recentSubmissions?.[0]?.timestamp || 0;
          const recentB = profileB?.recentSubmissions?.[0]?.timestamp || 0;
          return recentB - recentA;
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

      <div className="content-area">
        {activeTab === 'friends' ? (
          <>
            <Recommendations profiles={profiles} ownUsername={ownUsername} />

            {friends.length === 0 ? (
              <div className="empty-state">
                <p className="empty-title">👋 Welcome to L'Amigo!</p>
                <p className="empty-message">Track your friends' LeetCode progress</p>
                <p className="hint">💡 Start by adding a friend's LeetCode username or profile URL below</p>
                <div className="example-hint">
                  <small>Examples: "john_doe" or "https://leetcode.com/john_doe"</small>
                </div>
              </div>
            ) : (
              <>
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

                <div className="friends-list">
                  {sortedFriends.map((friend) => (
                    <FriendCard
                      key={friend.username}
                      friend={friend}
                      profile={profiles[friend.username.toLowerCase()]}
                      onRemove={handleRemoveFriend}
                      onRefresh={handleRefreshFriend}
                      refreshing={refreshingFriend === friend.username}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : activeTab === 'compare' ? (
          <CompareTab friends={friends} profiles={profiles} isDarkMode={isDarkMode} ownUsername={ownUsername} />
        ) : (
          <SettingsTab 
            onSync={loadData} 
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            ownUsername={ownUsername}
            onUsernameChange={setOwnUsername}
            onToast={(message, type) => setToast({ message, type })}
          />
        )}
      </div>

      <header className="header header-bottom">
        <a href="https://lamigo.netlify.app" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="android-chrome-192x192.png" alt="L'Amigo" className="header-logo" />
        </a>
        <div className="header-search-add">
          <input
            type="text"
            id="friend-username-input"
            placeholder="Add friend (e.g., john_doe or URL)"
            title="Enter a LeetCode username or profile URL"
            className="header-search-input"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const input = e.currentTarget;
                const extracted = extractUsername(input.value);
                if (extracted) {
                  handleAddFriend(extracted);
                  input.value = '';
                }
              }
            }}
          />
          <button 
            className="add-friend-btn-header"
            title="Add friend to track their progress"
            disabled={addingFriend}
            onClick={() => {
              const input = document.getElementById('friend-username-input') as HTMLInputElement;
              if (input) {
                const extracted = extractUsername(input.value);
                if (extracted) {
                  handleAddFriend(extracted);
                  input.value = '';
                }
              }
            }}
          >
            {addingFriend ? '⟳' : '+'}
          </button>
        </div>
        <div className="header-actions">
          <button 
            className="theme-toggle" 
            onClick={toggleDarkMode}
            title="Toggle dark mode"
          >
            {isDarkMode ? '☀' : '☾'}
          </button>
          <div className="menu-container">
            <button 
              className="menu-btn" 
              onClick={() => setShowMenu(!showMenu)}
              title="Options"
            >
              ⋮
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
                    <button onClick={() => handleExport('csv')}>
                      📊 Export CSV
                    </button>
                    <button onClick={() => handleExport('detailed')}>
                      📈 Export Detailed CSV
                    </button>
                    <button onClick={() => handleExport('json')}>
                      📦 Export JSON
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
