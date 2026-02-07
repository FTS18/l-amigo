import React, { useState, useEffect } from 'react';
import { Friend, FriendProfile } from '../types';
import { StorageService } from '../services/storage';
import { LeetCodeService } from '../services/leetcode';
import { ExportService } from '../services/export';
import { FriendCard } from './FriendCard';
import { AddFriendForm } from './AddFriendForm';
import { Recommendations } from './Recommendations';
import { TabNav } from './TabNav';
import { SyncTab } from './SyncTab';
import { CompareTab } from './CompareTab';
import { Onboarding } from './Onboarding';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { Modal } from './Modal';
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
  const [sortBy, setSortBy] = useState<'name' | 'problems' | 'recent'>('recent');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'compare' | 'sync'>('friends');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ownUsername, setOwnUsername] = useState<string>('');
  const [selectedFriendIndex, setSelectedFriendIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'info' | 'error' | 'success' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

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

  useEffect(() => {
    loadData(ownUsername);
  }, []);

  const loadData = async (currentUsername?: string) => {
    try {
      const friendsList = await StorageService.getFriends();
      const profilesData = await StorageService.getProfiles();
      setFriends(friendsList);
      setProfiles(profilesData);
      setLastUpdated(Date.now());
      
      // Fetch own profile if username is set and profile doesn't exist
      const username = currentUsername || ownUsername;
      if (username && !profilesData[username.toLowerCase()]) {
        try {
          const profile = await LeetCodeService.fetchUserProfile(username);
          await StorageService.saveProfile(profile);
          profilesData[username.toLowerCase()] = profile;
          setProfiles({ ...profilesData });
        } catch (error) {
          console.error('Error fetching own profile:', error);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (username: string) => {
    // Check if it's the user's own username
    if (ownUsername && username.toLowerCase() === ownUsername) {
      setModal({
        isOpen: true,
        title: "L'Amigo says",
        message: "You can't add yourself as a friend!",
        type: 'info'
      });
      return;
    }

    try {
      await StorageService.addFriend(username);
      
      // Fetch profile immediately
      const profile = await LeetCodeService.fetchUserProfile(username);
      await StorageService.saveProfile(profile);
      
      // Reload data
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        setModal({
          isOpen: true,
          title: 'Error',
          message: error.message,
          type: 'error'
        });
      }
    }
  };

  const handleRemoveFriend = async (username: string) => {
    if (confirm(`Remove ${username} from your friends list?`)) {
      try {
        await StorageService.removeFriend(username);
        await loadData();
      } catch (error) {
        console.error('Error removing friend:', error);
      }
    }
  };

  const handleExport = () => {
    ExportService.exportToCSV(friends, profiles);
    setShowMenu(false);
  };

  const handleExportDetailed = () => {
    ExportService.exportDetailedCSV(friends, profiles);
    setShowMenu(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      for (const friend of friends) {
        try {
          const profile = await LeetCodeService.fetchUserProfile(friend.username);
          await StorageService.saveProfile(profile);
        } catch (error) {
          console.error(`Error refreshing ${friend.username}:`, error);
        }
      }
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const getSortedFriends = () => {
    return [...friends].sort((a, b) => {
      const profileA = profiles[a.username.toLowerCase()];
      const profileB = profiles[b.username.toLowerCase()];

      switch (sortBy) {
        case 'problems':
          return (profileB?.problemsSolved.total || 0) - (profileA?.problemsSolved.total || 0);
        case 'recent':
          return (profileB?.lastFetched || 0) - (profileA?.lastFetched || 0);
        case 'name':
        default:
          return a.username.localeCompare(b.username);
      }
    });
  };

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
      handler: () => setActiveTab('sync'),
      description: 'Go to Sync tab',
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
      <div className={`app loading ${isDarkMode ? 'dark' : ''}`}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const sortedFriends = getSortedFriends();

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
            <Recommendations profiles={profiles} />

            {friends.length === 0 ? (
              <div className="empty-state">
                <p>No friends added yet!</p>
                <p className="hint">Add a LeetCode username above to start tracking.</p>
              </div>
            ) : (
              <>
                <div className="controls">
                  <label>
                    Sort by:
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                      <option value="name">Name</option>
                      <option value="problems">Problems Solved</option>
                      <option value="recent">Recently Updated</option>
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
          <SyncTab onSync={loadData} isDarkMode={isDarkMode} />
        )}
      </div>

      <header className="header header-bottom">
        <img src="/android-chrome-192x192.png" alt="L'Amigo" className="header-logo" />
        <div className="header-search-add">
          <input
            type="text"
            id="friend-username-input"
            placeholder="Enter username or LeetCode URL"
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
            title="Add friend by username or URL"
          >
            +
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
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <button onClick={handleExport}>
                  Export CSV
                </button>
                <button onClick={handleExportDetailed}>
                  Export Detailed
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
};
