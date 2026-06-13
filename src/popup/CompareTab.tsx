import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Friend, FriendProfile, Platform } from '../types';
import { DifficultyChart } from './DifficultyChart';
import { StreakCalculator, StreakInfo } from '../services/streak';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Toast } from './Toast'; // for error handling UI
import { Modal } from './Modal'; // documentation overlay



interface CompareTabProps {
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  isDarkMode: boolean;
  ownUsername?: string;
  ownCodeforcesHandle?: string;
  ownCodechefHandle?: string;
}

export const CompareTab: React.FC<CompareTabProps> = ({
  friends,
  profiles,
  isDarkMode,
  ownUsername,
  ownCodeforcesHandle,
  ownCodechefHandle,
}) => {
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showAllLangs, setShowAllLangs] = useState(false);
  const [activePlatform, setActivePlatform] = useState<Platform>('leetcode');
  const [hideUnrated, setHideUnrated] = useState(false);
  const [isLoadingPlatform, setIsLoadingPlatform] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDocs, setShowDocs] = useState(false);

  // Debounced platform toggle to avoid rapid clicks
  const debounceTimeout = useRef<number | null>(null);
  const setPlatformDebounced = useCallback((platform: Platform) => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = window.setTimeout(() => {
      setIsLoadingPlatform(true);
      setActivePlatform(platform);
      // Placeholder timeout – actual data fetch should clear loading when done
      setTimeout(() => setIsLoadingPlatform(false), 300);
    }, 300);
  }, []);

  // Helper to determine the platform-specific handle for a user
  const getActiveHandle = (username: string, isOwn: boolean, platform: Platform): string | undefined => {
    if (isOwn) {
      if (platform === 'leetcode') return ownUsername;
      if (platform === 'codeforces') return ownCodeforcesHandle;
      if (platform === 'codechef') return ownCodechefHandle;
      return undefined;
    }
    const friend = friends.find(f => f.username.toLowerCase() === username.toLowerCase());
    if (!friend) return undefined;

    const account = friend.accounts?.find(a => a.platform === platform);
    if (account) return account.handle;

    // Fallback for LeetCode if accounts array is not set or empty
    if (platform === 'leetcode') {
      if (!friend.accounts || friend.accounts.length === 0) {
        return friend.username;
      }
    }

    return undefined;
  };

  // Helper to retrieve the active profile
  const getActiveProfile = (username: string, isOwn: boolean, platform: Platform): FriendProfile | undefined => {
    const handle = getActiveHandle(username, isOwn, platform);
    if (!handle) return undefined;

    const prefixedKey = `${platform}:${handle.toLowerCase()}`;
    return profiles[prefixedKey] || profiles[handle.toLowerCase()];
  };

  // Helper to check if a profile is rated on the current platform
  const isProfileRated = (profile: FriendProfile | undefined): boolean => {
    if (!profile) return false;
    if (profile.platform === 'codeforces') {
      if (!profile.contestRating || profile.contestRating <= 0) return false;
      if (profile.codeforcesStats?.rankLabel === 'unrated') return false;
      return true;
    } else if (profile.platform === 'codechef') {
      return !!(profile.contestRating && profile.contestRating > 0);
    } else {
      return !!(profile.contestRating && profile.contestRating > 0);
    }
  };

  // Persist UI state to chrome.storage.local
  useEffect(() => {
    // Load persisted state on mount
    chrome.storage.local.get(['activePlatform', 'hideUnrated'], items => {
      if (items.activePlatform) setActivePlatform(items.activePlatform as Platform);
      if (typeof items.hideUnrated === 'boolean') setHideUnrated(items.hideUnrated);
    });
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    chrome.storage.local.set({ activePlatform, hideUnrated });
  }, [activePlatform, hideUnrated]);

  // Synchronize and clean up selected friends when activePlatform changes
  useEffect(() => {
    setSelectedFriends(prev => {
      return prev.filter(username => {
        const isOwn = (ownUsername && username.toLowerCase() === ownUsername.toLowerCase()) ||
                      (ownCodeforcesHandle && username.toLowerCase() === ownCodeforcesHandle.toLowerCase()) ||
                      (ownCodechefHandle && username.toLowerCase() === ownCodechefHandle.toLowerCase());
        const handle = getActiveHandle(username, !!isOwn, activePlatform);
        return !!handle;
      });
    });
  }, [activePlatform, ownUsername, ownCodeforcesHandle, ownCodechefHandle, friends]);

  // Build the list of all users that have an account on the active platform
  const allPlatformUsers = useMemo(() => {
    const list = [];
    const ownHandle = activePlatform === 'leetcode' ? ownUsername : activePlatform === 'codeforces' ? ownCodeforcesHandle : ownCodechefHandle;
    if (ownHandle) {
      list.push({ username: ownHandle, isOwn: true });
    }

    for (const f of friends) {
      const handle = getActiveHandle(f.username, false, activePlatform);
      if (handle) {
        // Prevent duplicate own user if they are also in the friends list
        const isDuplicateOfOwn = ownHandle && f.username.toLowerCase() === ownHandle.toLowerCase();
        if (!isDuplicateOfOwn) {
          list.push({ username: f.username, isOwn: false });
        }
      }
    }
    return list;
  }, [friends, activePlatform, ownUsername, ownCodeforcesHandle, ownCodechefHandle]);

  // Filter selectable users based on the "Hide Unrated" checkbox
  const filteredComparableUsers = useMemo(() => {
    return allPlatformUsers.filter(user => {
      const profile = getActiveProfile(user.username, user.isOwn, activePlatform);
      if (!profile) {
        return !hideUnrated; // Keep if not hiding unrated, otherwise filter out empty profiles
      }
      if (hideUnrated && !isProfileRated(profile)) {
        return false;
      }
      return true;
    });
  }, [allPlatformUsers, hideUnrated, activePlatform, profiles]);

  // Filter selected profiles based on selected platform and unrated filter
  const selectedProfiles = useMemo(() => {
    return selectedFriends
      .map(username => {
        const isOwn = (ownUsername && username.toLowerCase() === ownUsername.toLowerCase()) ||
                      (ownCodeforcesHandle && username.toLowerCase() === ownCodeforcesHandle.toLowerCase()) ||
                      (ownCodechefHandle && username.toLowerCase() === ownCodechefHandle.toLowerCase());
        return getActiveProfile(username, !!isOwn, activePlatform);
      })
      .filter((p): p is FriendProfile => {
        if (!p) return false;
        if (hideUnrated && !isProfileRated(p)) return false;
        return true;
      });
  }, [selectedFriends, activePlatform, hideUnrated, ownUsername, ownCodeforcesHandle, ownCodechefHandle, profiles]);

  const handleToggleFriend = (username: string) => {
    setSelectedFriends(prev => {
      if (prev.includes(username)) {
        return prev.filter(u => u !== username);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), username];
      }
      return [...prev, username];
    });
  };

  // ── Memoize expensive calculations ──────────────────────────────────

  /** Cache streak calculations */
  const streakMap = useMemo(() => {
    const map = new Map<string, StreakInfo>();
    for (const p of selectedProfiles) {
      map.set(p.username, StreakCalculator.calculateStreak(p));
    }
    return map;
  }, [selectedProfiles]);

  /** Single-pass activity stats per profile */
  const activityMap = useMemo(() => {
    const DAY = 86400000;
    const now = Date.now();
    const sevenDaysAgo = now - 7 * DAY;
    const thirtyDaysAgo = now - 30 * DAY;
    const map = new Map<string, { last7Days: number; last30Days: number; activeDays: number; weeklyAvg: string; monthlyAvg: number }>();

    for (const p of selectedProfiles) {
      const cal = p.submissionCalendar;

      if (cal && Object.keys(cal).length > 0) {
        let last7 = 0, last30 = 0;
        const daySet = new Set<string>();
        for (const [tsStr, count] of Object.entries(cal)) {
          if (count <= 0) continue;
          const tsMs = parseInt(tsStr, 10) * 1000;
          if (tsMs >= thirtyDaysAgo) {
            last30 += count;
            daySet.add(new Date(tsMs).toDateString());
            if (tsMs >= sevenDaysAgo) last7 += count;
          }
        }
        map.set(p.username, {
          last7Days: last7,
          last30Days: last30,
          activeDays: daySet.size,
          weeklyAvg: (last30 / 4.3).toFixed(1),
          monthlyAvg: last30,
        });
      } else {
        const subs = p.recentSubmissions;
        if (!subs || subs.length === 0) {
          map.set(p.username, { last7Days: 0, last30Days: 0, activeDays: 0, weeklyAvg: '0', monthlyAvg: 0 });
          continue;
        }
        let last7 = 0, last30 = 0;
        const daySet = new Set<string>();
        for (const sub of subs) {
          const ts = sub.timestamp;
          if (ts >= thirtyDaysAgo) {
            last30++;
            daySet.add(new Date(ts).toDateString());
            if (ts >= sevenDaysAgo) last7++;
          }
        }
        map.set(p.username, {
          last7Days: last7,
          last30Days: last30,
          activeDays: daySet.size,
          weeklyAvg: (last30 / 4.3).toFixed(1),
          monthlyAvg: last30,
        });
      }
    }
    return map;
  }, [selectedProfiles]);

  /** O(1) topic lookup maps per profile */
  const topicMaps = useMemo(() => {
    const maps = new Map<string, Map<string, number>>();
    for (const p of selectedProfiles) {
      const m = new Map<string, number>();
      for (const t of p.topicStats || []) m.set(t.topicName, t.problemsSolved);
      maps.set(p.username, m);
    }
    return maps;
  }, [selectedProfiles]);

  /** O(1) language lookup maps per profile */
  const langMaps = useMemo(() => {
    const maps = new Map<string, Map<string, number>>();
    for (const p of selectedProfiles) {
      const m = new Map<string, number>();
      for (const l of p.languageStats || []) m.set(l.languageName, l.problemsSolved);
      maps.set(p.username, m);
    }
    return maps;
  }, [selectedProfiles]);

  /** Pre-bucket submissions by dateString per profile for velocity chart */
  const submissionBuckets = useMemo(() => {
    const buckets = new Map<string, Map<string, number>>();
    for (const p of selectedProfiles) {
      const m = new Map<string, number>();
      const cal = p.submissionCalendar;
      if (cal && Object.keys(cal).length > 0) {
        for (const [tsStr, count] of Object.entries(cal)) {
          if (count <= 0) continue;
          const key = new Date(parseInt(tsStr, 10) * 1000).toDateString();
          m.set(key, (m.get(key) || 0) + count);
        }
      } else {
        for (const sub of p.recentSubmissions || []) {
          const key = new Date(sub.timestamp).toDateString();
          m.set(key, (m.get(key) || 0) + 1);
        }
      }
      buckets.set(p.username, m);
    }
    return buckets;
  }, [selectedProfiles]);

  // Define dynamic metrics based on the active platform
  const metrics = useMemo(() => {
    if (activePlatform === 'codeforces') {
      return [
        { key: 'Total Problems', label: 'Total Problems', getValue: (p: FriendProfile) => p.problemsSolved?.total ?? '-' },
        { key: 'Easy', label: 'Easy (<1200)', getValue: (p: FriendProfile) => p.problemsSolved?.easy ?? '-' },
        { key: 'Medium', label: 'Medium (<1900)', getValue: (p: FriendProfile) => p.problemsSolved?.medium ?? '-' },
        { key: 'Hard', label: 'Hard (≥1900)', getValue: (p: FriendProfile) => p.problemsSolved?.hard ?? '-' },
        { key: 'Current Streak', label: 'Current Streak', getValue: (p: FriendProfile) => {
            const streak = streakMap.get(p.username);
            return streak && streak.currentStreak > 0 ? `🔥 ${streak.currentStreak}` : '-';
          },
          getRawValue: (p: FriendProfile) => streakMap.get(p.username)?.currentStreak ?? 0
        },
        { key: 'Best Streak', label: 'Best Streak', getValue: (p: FriendProfile) => {
            const streak = streakMap.get(p.username);
            return streak && streak.longestStreak > 0 ? streak.longestStreak : '-';
          },
          getRawValue: (p: FriendProfile) => streakMap.get(p.username)?.longestStreak ?? 0
        },
        { key: 'Submissions', label: 'Total Submissions', getValue: (p: FriendProfile) => p.submissionStats?.totalSubmissions ?? '-' },
        { key: 'Acceptance Rate', label: 'Acceptance Rate', getValue: (p: FriendProfile) => p.submissionStats?.acceptanceRate ? `${p.submissionStats.acceptanceRate.toFixed(1)}%` : '-' },
        { key: 'Contest Rating', label: 'Contest Rating', getValue: (p: FriendProfile) => p.contestRating ? Math.round(p.contestRating) : '-' },
        { key: 'Max Rating', label: 'Max Rating', getValue: (p: FriendProfile) => p.codeforcesStats?.maxRating ?? '-' },
        { key: 'Rank Label', label: 'Rank', getValue: (p: FriendProfile) => p.codeforcesStats?.rankLabel ?? 'unrated' },
        { key: 'Contest Count', label: 'Contests Participated', getValue: (p: FriendProfile) => p.contestCount ?? '-' },
      ];
    } else if (activePlatform === 'codechef') {
      return [
        { key: 'Stars', label: 'Stars', getValue: (p: FriendProfile) => {
            const stars = Math.floor((p.contestRating || 0) / 200) - 2; // Approximate stars calculation if needed, or simply extract from profile if we saved it
            return p.contestRating ? `${Math.max(1, Math.min(7, Math.floor((p.contestRating - 1200) / 200) + 1))}★` : '-';
          }
        },
        { key: 'Current Streak', label: 'Current Streak', getValue: (p: FriendProfile) => {
            const streak = streakMap.get(p.username);
            return streak && streak.currentStreak > 0 ? `🔥 ${streak.currentStreak}` : '-';
          },
          getRawValue: (p: FriendProfile) => streakMap.get(p.username)?.currentStreak ?? 0
        },
        { key: 'Best Streak', label: 'Best Streak', getValue: (p: FriendProfile) => {
            const streak = streakMap.get(p.username);
            return streak && streak.longestStreak > 0 ? streak.longestStreak : '-';
          },
          getRawValue: (p: FriendProfile) => streakMap.get(p.username)?.longestStreak ?? 0
        },
        { key: 'Contest Rating', label: 'Contest Rating', getValue: (p: FriendProfile) => p.contestRating ? Math.round(p.contestRating) : '-' },
        { key: 'Max Rating', label: 'Max Rating', getValue: (p: FriendProfile) => p.contributionPoints ?? '-' }, // using contributionPoints for Max Rating
        { key: 'Global Rank', label: 'Global Rank', getValue: (p: FriendProfile) => p.contestRanking ? `#${p.contestRanking.toLocaleString()}` : '-',
          getRawValue: (p: FriendProfile) => p.contestRanking ? 100000000 - p.contestRanking : 0
        },
        { key: 'Contest Count', label: 'Contests Participated', getValue: (p: FriendProfile) => p.contestCount ?? '-' },
      ];
    } else {
      return [
        { key: 'Total Problems', label: 'Total Problems', getValue: (p: FriendProfile) => p.problemsSolved?.total ?? '-' },
        { key: 'Easy', label: 'Easy', getValue: (p: FriendProfile) => p.problemsSolved?.easy ?? '-' },
        { key: 'Medium', label: 'Medium', getValue: (p: FriendProfile) => p.problemsSolved?.medium ?? '-' },
        { key: 'Hard', label: 'Hard', getValue: (p: FriendProfile) => p.problemsSolved?.hard ?? '-' },
        { key: 'Current Streak', label: 'Current Streak', getValue: (p: FriendProfile) => {
            const streak = streakMap.get(p.username);
            return streak && streak.currentStreak > 0 ? `🔥 ${streak.currentStreak}` : '-';
          },
          getRawValue: (p: FriendProfile) => streakMap.get(p.username)?.currentStreak ?? 0
        },
        { key: 'Best Streak', label: 'Best Streak', getValue: (p: FriendProfile) => {
            const streak = streakMap.get(p.username);
            return streak && streak.longestStreak > 0 ? streak.longestStreak : '-';
          },
          getRawValue: (p: FriendProfile) => streakMap.get(p.username)?.longestStreak ?? 0
        },
        { key: 'Submissions', label: 'Total Submissions', getValue: (p: FriendProfile) => p.submissionStats?.totalSubmissions ?? '-' },
        { key: 'Acceptance Rate', label: 'Acceptance Rate', getValue: (p: FriendProfile) => p.submissionStats?.acceptanceRate ? `${p.submissionStats.acceptanceRate.toFixed(1)}%` : '-' },
        { key: 'Contest Rating', label: 'Contest Rating', getValue: (p: FriendProfile) => p.contestRating ? Math.round(p.contestRating) : '-' },
        { key: 'Rank', label: 'Global Rank', getValue: (p: FriendProfile) => p.ranking ? `#${p.ranking.toLocaleString()}` : '-',
          getRawValue: (p: FriendProfile) => p.ranking ? 100000000 - p.ranking : 0
        },
        { key: 'Reputation', label: 'Reputation', getValue: (p: FriendProfile) => p.reputation ?? '-' },
      ];
    }
  }, [activePlatform, streakMap]);

  /** Precompute all max values in a single pass */
  const maxValues = useMemo(() => {
    const mv: Record<string, number> = {};
    for (const metric of metrics) {
      mv[metric.key] = -Infinity;
      for (const p of selectedProfiles) {
        let val: number;
        if (metric.getRawValue) {
          val = metric.getRawValue(p);
        } else {
          const raw = metric.getValue(p);
          val = typeof raw === 'number' ? raw : parseFloat(String(raw));
        }
        if (!isNaN(val) && val > mv[metric.key]) {
          mv[metric.key] = val;
        }
      }
    }
    return mv;
  }, [selectedProfiles, metrics]);

  /** Precompute activity max values */
  const maxActivity = useMemo(() => {
    const mx = { 'Last 7 Days': 0, 'Last 30 Days': 0, 'Active Days': 0 };
    for (const p of selectedProfiles) {
      const s = activityMap.get(p.username);
      if (!s) continue;
      if (s.last7Days > mx['Last 7 Days']) mx['Last 7 Days'] = s.last7Days;
      if (s.last30Days > mx['Last 30 Days']) mx['Last 30 Days'] = s.last30Days;
      if (s.activeDays > mx['Active Days']) mx['Active Days'] = s.activeDays;
    }
    return mx;
  }, [selectedProfiles, activityMap]);

  const isMax = (metricKey: string, p: FriendProfile): boolean => {
    const metric = metrics.find(m => m.key === metricKey);
    if (!metric) return false;
    if (metricKey === 'Rank Label') return false;

    let val: number;
    if (metric.getRawValue) {
      val = metric.getRawValue(p);
    } else {
      const raw = metric.getValue(p);
      val = typeof raw === 'number' ? raw : parseFloat(String(raw));
    }
    if (isNaN(val) || val === -Infinity || val <= 0) return false;

    return val === maxValues[metricKey];
  };

  const isMaxAct = (metric: string, value: number): boolean => {
    return value > 0 && value === (maxActivity as any)[metric];
  };

  /** Sorted topics with O(1) lookups and precomputed max per topic */
  const { sortedTopics, topicMaxMap } = useMemo(() => {
    const allNames = new Set<string>();
    for (const p of selectedProfiles) {
      for (const t of p.topicStats || []) allNames.add(t.topicName);
    }
    const totals = new Map<string, number>();
    const maxMap = new Map<string, number>();
    for (const name of allNames) {
      let total = 0, mx = 0;
      for (const p of selectedProfiles) {
        const c = topicMaps.get(p.username)?.get(name) || 0;
        total += c;
        if (c > mx) mx = c;
      }
      totals.set(name, total);
      maxMap.set(name, mx);
    }
    const sorted = Array.from(allNames).sort((a, b) => (totals.get(b) || 0) - (totals.get(a) || 0));
    return { sortedTopics: sorted, topicMaxMap: maxMap };
  }, [selectedProfiles, topicMaps]);

  /** Sorted languages with O(1) lookups and precomputed max per language */
  const { sortedLangs, langMaxMap } = useMemo(() => {
    const allNames = new Set<string>();
    for (const p of selectedProfiles) {
      for (const l of p.languageStats || []) allNames.add(l.languageName);
    }
    const totals = new Map<string, number>();
    const maxMap = new Map<string, number>();
    for (const name of allNames) {
      let total = 0, mx = 0;
      for (const p of selectedProfiles) {
        const c = langMaps.get(p.username)?.get(name) || 0;
        total += c;
        if (c > mx) mx = c;
      }
      totals.set(name, total);
      maxMap.set(name, mx);
    }
    const sorted = Array.from(allNames).sort((a, b) => (totals.get(b) || 0) - (totals.get(a) || 0));
    return { sortedLangs: sorted, langMaxMap: maxMap };
  }, [selectedProfiles, langMaps]);

  /** Build radar chart data using the top 8 topics */
  const radarData = useMemo(() => {
    if (selectedProfiles.length === 0 || sortedTopics.length === 0) return [];
    
    // Take top 8 topics to make a clean hexagon/octagon
    const topTopics = sortedTopics.slice(0, 8);
    
    return topTopics.map(topic => {
      const dataPoint: any = { topic };
      for (const p of selectedProfiles) {
        dataPoint[p.username] = topicMaps.get(p.username)?.get(topic) || 0;
      }
      return dataPoint;
    });
  }, [selectedProfiles, sortedTopics, topicMaps]);

  /** Build velocity chart data using pre-bucketed submissions */
  const velocityData = useMemo(() => {
    if (selectedProfiles.length === 0) return [];
    const DAY = 86400000;
    const now = Date.now();
    const data: any[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dateKey = d.toDateString();
      const point: any = { date: dateStr };
      for (const p of selectedProfiles) {
        point[p.username] = submissionBuckets.get(p.username)?.get(dateKey) || 0;
      }
      data.push(point);
    }
    return data;
  }, [selectedProfiles, submissionBuckets]);

  return (
    <div className="compare-tab">
      <div className="compare-header-controls">
        <div className="platform-toggle-group">
          <button
            className={`platform-toggle-btn leetcode ${activePlatform === 'leetcode' ? 'active' : ''}`}
            onClick={() => setActivePlatform('leetcode')}
          >
            LeetCode
          </button>
          <button
            className={`platform-toggle-btn codeforces ${activePlatform === 'codeforces' ? 'active' : ''}`}
            onClick={() => setActivePlatform('codeforces')}
          >
            Codeforces
          </button>
          <button
            className={`platform-toggle-btn codechef ${activePlatform === 'codechef' ? 'active' : ''}`}
            onClick={() => setActivePlatform('codechef')}
          >
            CodeChef
          </button>
        </div>
        <div className="unrated-filter-control">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={hideUnrated}
              onChange={(e) => setHideUnrated(e.target.checked)}
            />
            <span>Hide Unrated</span>
          </label>
        </div>
      </div>

      <div className="compare-selector">
        <h3>Select profiles to compare (max 3)</h3>
        <div className="friend-selector-list">
          {filteredComparableUsers.map(user => {
            const profile = getActiveProfile(user.username, user.isOwn, activePlatform);
            const isSelected = selectedFriends.includes(user.username);

            return (
              <button
                key={user.username}
                className={`friend-selector-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleToggleFriend(user.username)}
              >
                {profile?.avatar && (
                  <img src={profile.avatar} alt={user.username} className="selector-avatar" />
                )}
                <span>{user.username} {user.isOwn && '(You)'}</span>
                {isSelected && <span className="check-icon">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selectedProfiles.length === 0 ? (
        <div className="compare-empty">
          <p>Select friends above to compare their progress</p>
        </div>
      ) : (
        <>
          <div className="compare-table">
            <h3>Quick Comparison Table</h3>
            <div className="compare-table-wrapper">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {selectedProfiles.map(profile => (
                      <th key={profile.username}>{profile.username}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(metric => (
                    <tr key={metric.key}>
                      <td className="metric-label">{metric.label}</td>
                      {selectedProfiles.map(profile => {
                        const val = metric.getValue(profile);
                        const mx = isMax(metric.key, profile);

                        let diffClass = '';
                        if (metric.key === 'Easy') diffClass = 'easy';
                        else if (metric.key === 'Medium') diffClass = 'medium';
                        else if (metric.key === 'Hard') diffClass = 'hard';

                        return (
                          <td key={profile.username} className={`metric-value ${diffClass} ${mx ? 'max-value' : ''}`}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedProfiles.length > 0 && selectedProfiles.some(p => p.recentSubmissions && p.recentSubmissions.length > 0) && (
            <div className="activity-table-section">
              <h3>Recent Activity</h3>
              <div className="compare-table-wrapper">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Activity Metric</th>
                      {selectedProfiles.map(profile => (
                        <th key={profile.username}>{profile.username}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="metric-label">Last 7 Days</td>
                      {selectedProfiles.map(profile => {
                        const activityStats = activityMap.get(profile.username);
                        const last7 = activityStats?.last7Days ?? 0;
                        const mx = isMaxAct('Last 7 Days', last7);
                        return (
                          <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                            {last7}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="metric-label">Last 30 Days</td>
                      {selectedProfiles.map(profile => {
                        const activityStats = activityMap.get(profile.username);
                        const last30 = activityStats?.last30Days ?? 0;
                        const mx = isMaxAct('Last 30 Days', last30);
                        return (
                          <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                            {last30}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="metric-label">Active Days</td>
                      {selectedProfiles.map(profile => {
                        const activityStats = activityMap.get(profile.username);
                        const activeDaysVal = activityStats?.activeDays ?? 0;
                        const mx = isMaxAct('Active Days', activeDaysVal);
                        return (
                          <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                            {activeDaysVal}/30
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {selectedProfiles.length > 0 && radarData.length > 0 && (
        <div className="radar-chart-section" style={{ marginTop: '24px', marginBottom: '24px' }}>
          <h3>Topic Strengths (Top 8 Topics)</h3>
          <ResponsiveContainer width="100%" height={350} minWidth={1}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke={isDarkMode ? '#444' : '#e0e0e0'} />
              <PolarAngleAxis dataKey="topic" tick={{ fill: isDarkMode ? '#aaa' : '#555', fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: isDarkMode ? '#888' : '#666', fontSize: 10 }} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9',
                  border: `1px solid ${isDarkMode ? '#555' : '#e0e0e0'}`,
                  color: isDarkMode ? '#e0e0e0' : '#333',
                }}
              />
              <Legend />
              {selectedProfiles.map((profile, idx) => {
                const colors = ['#22c55e', '#eab308', '#ef4444'];
                return (
                  <Radar
                    key={profile.username}
                    name={profile.username}
                    dataKey={profile.username}
                    stroke={colors[idx % 3]}
                    fill={colors[idx % 3]}
                    fillOpacity={0.3}
                    isAnimationActive={false}
                  />
                );
              })}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {selectedProfiles.length > 0 && selectedProfiles.some(p => p.topicStats && p.topicStats.length > 0) && (
        <div className="topics-table-section">
          <h3>Topics Sol <span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.7 }}>({sortedTopics.length} total)</span></h3>
          <div className="compare-table-wrapper">
            <table className="topics-data-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  {selectedProfiles.map(profile => (
                    <th key={profile.username}>{profile.username}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showAllTopics ? sortedTopics : sortedTopics.slice(0, 10)).map((topicName, idx) => (
                  <tr key={idx}>
                    <td className="topic-name-cell">{topicName}</td>
                    {selectedProfiles.map(profile => {
                      const count = topicMaps.get(profile.username)?.get(topicName) || 0;
                      const mx = count > 0 && count === topicMaxMap.get(topicName);
                      return (
                        <td key={profile.username} className={`topic-count-cell ${mx ? 'max-value' : ''}`}>
                          {count || '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedTopics.length > 10 && (
            <button
              className="show-all-btn"
              onClick={() => setShowAllTopics(!showAllTopics)}
            >
              {showAllTopics ? 'Show Less' : `Show All ${sortedTopics.length} Topics`}
            </button>
          )}
        </div>
      )}

      {selectedProfiles.length > 0 && selectedProfiles.some(p => p.languageStats && p.languageStats.length > 0) && (
        <div className="language-table-section">
          <h3>Languages Used <span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.7 }}>({sortedLangs.length} total)</span></h3>
          <div className="compare-table-wrapper">
            <table className="language-data-table">
              <thead>
                <tr>
                  <th>Language</th>
                  {selectedProfiles.map(profile => (
                    <th key={profile.username}>{profile.username}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showAllLangs ? sortedLangs : sortedLangs.slice(0, 10)).map((langName, idx) => (
                  <tr key={idx}>
                    <td className="language-name-cell">{langName}</td>
                    {selectedProfiles.map(profile => {
                      const count = langMaps.get(profile.username)?.get(langName) || 0;
                      const mx = count > 0 && count === langMaxMap.get(langName);
                      return (
                        <td key={profile.username} className={`language-count-cell ${mx ? 'max-value' : ''}`}>
                          {count || '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedLangs.length > 10 && (
            <button
              className="show-all-btn"
              onClick={() => setShowAllLangs(!showAllLangs)}
            >
              {showAllLangs ? 'Show Less' : `Show All ${sortedLangs.length} Languages`}
            </button>
          )}
        </div>
      )}

      {selectedProfiles.length > 0 && selectedProfiles.some(p => p.recentSubmissions && p.recentSubmissions.length > 0) && (
        <div className="velocity-chart-section">
          <h3>Submission Velocity (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300} minWidth={1}>
            <LineChart data={velocityData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#444' : '#e0e0e0'} />
              <XAxis dataKey="date" stroke={isDarkMode ? '#aaa' : '#999'} tick={{ fontSize: 11 }} />
              <YAxis stroke={isDarkMode ? '#aaa' : '#999'} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9',
                  border: `1px solid ${isDarkMode ? '#555' : '#e0e0e0'}`,
                  color: isDarkMode ? '#e0e0e0' : '#333',
                }}
                labelStyle={{ color: isDarkMode ? '#e0e0e0' : '#333' }}
              />
              <Legend />
              {selectedProfiles.map((profile, idx) => {
                const colors = ['#22c55e', '#eab308', '#ef4444'];
                return (
                  <Line
                    key={profile.username}
                    type="monotone"
                    dataKey={profile.username}
                    stroke={colors[idx % 3]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
