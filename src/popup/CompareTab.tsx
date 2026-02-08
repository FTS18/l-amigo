import React, { useState, useMemo } from 'react';
import { Friend, FriendProfile } from '../types';
import { DifficultyChart } from './DifficultyChart';
import { StreakCalculator, StreakInfo } from '../services/streak';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CompareTabProps {
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  isDarkMode: boolean;
  ownUsername?: string;
}

export const CompareTab: React.FC<CompareTabProps> = ({ friends, profiles, isDarkMode, ownUsername }) => {
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showAllLangs, setShowAllLangs] = useState(false);

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

  const selectedProfiles = useMemo(() => {
    return selectedFriends
      .map(username => profiles[username.toLowerCase()])
      .filter(Boolean);
  }, [selectedFriends, profiles]);

  // ── Memoize expensive calculations ──────────────────────────────────

  /** Cache streak calculations — avoids recalculating 4× per profile per render */
  const streakMap = useMemo(() => {
    const map = new Map<string, StreakInfo>();
    for (const p of selectedProfiles) {
      map.set(p.username, StreakCalculator.calculateStreak(p));
    }
    return map;
  }, [selectedProfiles]);

  /** Single-pass activity stats per profile — uses submissionCalendar (full year) when available */
  const activityMap = useMemo(() => {
    const DAY = 86400000;
    const now = Date.now();
    const sevenDaysAgo = now - 7 * DAY;
    const thirtyDaysAgo = now - 30 * DAY;
    const map = new Map<string, { last7Days: number; last30Days: number; activeDays: number; weeklyAvg: string; monthlyAvg: number }>();

    for (const p of selectedProfiles) {
      const cal = p.submissionCalendar;

      if (cal && Object.keys(cal).length > 0) {
        // Use full-year calendar data — far more accurate
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
        // Fallback to recentSubmissions
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

  /** Pre-bucket submissions by dateString per profile for velocity chart.
   *  Uses submissionCalendar (full year) when available, falls back to recentSubmissions. */
  const submissionBuckets = useMemo(() => {
    const buckets = new Map<string, Map<string, number>>();
    for (const p of selectedProfiles) {
      const m = new Map<string, number>();
      const cal = p.submissionCalendar;
      if (cal && Object.keys(cal).length > 0) {
        // Calendar keys are Unix timestamps in seconds
        for (const [tsStr, count] of Object.entries(cal)) {
          if (count <= 0) continue;
          const key = new Date(parseInt(tsStr, 10) * 1000).toDateString();
          m.set(key, (m.get(key) || 0) + count);
        }
      } else {
        // Fallback to recentSubmissions
        for (const sub of p.recentSubmissions || []) {
          const key = new Date(sub.timestamp).toDateString();
          m.set(key, (m.get(key) || 0) + 1);
        }
      }
      buckets.set(p.username, m);
    }
    return buckets;
  }, [selectedProfiles]);

  /** Precompute all max values in a single pass */
  const maxValues = useMemo(() => {
    const mv: Record<string, number> = {};
    const metrics = ['Total Problems', 'Easy', 'Medium', 'Hard', 'Submissions', 'Acceptance Rate', 'Contest Rating', 'Rank', 'Reputation', 'Current Streak', 'Best Streak'];
    for (const m of metrics) mv[m] = -Infinity;

    for (const p of selectedProfiles) {
      const streak = streakMap.get(p.username);
      const vals: Record<string, number> = {
        'Total Problems': p.problemsSolved?.total || 0,
        'Easy': p.problemsSolved?.easy || 0,
        'Medium': p.problemsSolved?.medium || 0,
        'Hard': p.problemsSolved?.hard || 0,
        'Submissions': p.submissionStats?.totalSubmissions || 0,
        'Acceptance Rate': p.submissionStats?.acceptanceRate || 0,
        'Contest Rating': p.contestRating ? Math.round(p.contestRating) : 0,
        'Rank': p.ranking ? Math.max(0, 100000000 - p.ranking) : 0,
        'Reputation': p.reputation || 0,
        'Current Streak': streak?.currentStreak || 0,
        'Best Streak': streak?.longestStreak || 0,
      };
      for (const m of metrics) {
        if (vals[m] > mv[m]) mv[m] = vals[m];
      }
    }
    return mv;
  }, [selectedProfiles, streakMap]);

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

  const isMax = (metric: string, value: number | string): boolean => {
    if (!value || value === '-') return false;
    const mv = maxValues[metric];
    return mv > -Infinity && String(value) === String(mv);
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
    // Compute total per topic for sorting + max per topic for highlighting
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

  /** Build velocity chart data using pre-bucketed submissions — O(30 × profiles) instead of O(30 × profiles × subs) */
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

  // Create a list that includes own profile if available
  const allComparableUsers = ownUsername && profiles[ownUsername.toLowerCase()] 
    ? [{ username: ownUsername, isOwn: true }, ...friends.map(f => ({ username: f.username, isOwn: false }))]
    : friends.map(f => ({ username: f.username, isOwn: false }));

  return (
    <div className="compare-tab">
      <div className="compare-selector">
        <h3>Select profiles to compare (max 3)</h3>
        <div className="friend-selector-list">
          {allComparableUsers.map(user => {
            const profile = profiles[user.username.toLowerCase()];
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
                <tr>
                  <td className="metric-label">Total Problems</td>
                  {selectedProfiles.map(profile => {
                    const val = profile?.problemsSolved?.total || '-';
                    const mx = isMax('Total Problems', val);
                    return (
                      <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="metric-label">Easy</td>
                  {selectedProfiles.map(profile => {
                    const val = profile?.problemsSolved?.easy || '-';
                    const mx = isMax('Easy', val);
                    return (
                      <td key={profile.username} className={`metric-value easy ${mx ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="metric-label">Medium</td>
                  {selectedProfiles.map(profile => {
                    const val = profile?.problemsSolved?.medium || '-';
                    const mx = isMax('Medium', val);
                    return (
                      <td key={profile.username} className={`metric-value medium ${mx ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="metric-label">Hard</td>
                  {selectedProfiles.map(profile => {
                    const val = profile?.problemsSolved?.hard || '-';
                    const mx = isMax('Hard', val);
                    return (
                      <td key={profile.username} className={`metric-value hard ${mx ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="metric-label">Current Streak</td>
                  {selectedProfiles.map(profile => {
                    const streak = streakMap.get(profile.username)!;
                    const val = streak.currentStreak > 0 ? `🔥 ${streak.currentStreak}` : '-';
                    const mx = isMax('Current Streak', streak.currentStreak);
                    return (
                      <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="metric-label">Best Streak</td>
                  {selectedProfiles.map(profile => {
                    const streak = streakMap.get(profile.username)!;
                    const val = streak.longestStreak > 0 ? streak.longestStreak : '-';
                    const mx = isMax('Best Streak', streak.longestStreak);
                    return (
                      <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                {selectedProfiles.some(p => p.submissionStats) && (
                  <>
                    <tr>
                      <td className="metric-label">Total Submissions</td>
                      {selectedProfiles.map(profile => {
                        const val = profile?.submissionStats?.totalSubmissions || '-';
                        const mx = isMax('Submissions', val);
                        return (
                          <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="metric-label">Acceptance Rate</td>
                      {selectedProfiles.map(profile => {
                        const val = profile?.submissionStats?.acceptanceRate ? `${profile.submissionStats.acceptanceRate.toFixed(1)}%` : '-';
                        const mx = isMax('Acceptance Rate', profile?.submissionStats?.acceptanceRate || 0);
                        return (
                          <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                )}
                {selectedProfiles.some(p => p.contestRating) && (
                  <tr>
                    <td className="metric-label">Contest Rating</td>
                    {selectedProfiles.map(profile => {
                      const val = profile?.contestRating ? Math.round(profile.contestRating) : '-';
                      const mx = isMax('Contest Rating', val);
                      return (
                        <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                )}
                {selectedProfiles.some(p => p.ranking) && (
                  <tr>
                    <td className="metric-label">Global Rank</td>
                    {selectedProfiles.map(profile => {
                      const val = profile?.ranking ? `#${profile.ranking.toLocaleString()}` : '-';
                      const mx = isMax('Rank', profile?.ranking ? 100000000 - profile.ranking : 0);
                      return (
                        <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                )}
                {selectedProfiles.some(p => p.reputation) && (
                  <tr>
                    <td className="metric-label">Reputation</td>
                    {selectedProfiles.map(profile => {
                      const val = profile?.reputation || '-';
                      const mx = isMax('Reputation', val);
                      return (
                        <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedProfiles.length > 0 && selectedProfiles.some(p => p.recentSubmissions && p.recentSubmissions.length > 0) && (
            <div className="activity-table-section">
              <h3>Recent Activity</h3>
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
                      const activityStats = activityMap.get(profile.username)!;
                      const mx = isMaxAct('Last 7 Days', activityStats.last7Days);
                      return (
                        <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                          {activityStats.last7Days}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="metric-label">Last 30 Days</td>
                    {selectedProfiles.map(profile => {
                      const activityStats = activityMap.get(profile.username)!;
                      const mx = isMaxAct('Last 30 Days', activityStats.last30Days);
                      return (
                        <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                          {activityStats.last30Days}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="metric-label">Active Days</td>
                    {selectedProfiles.map(profile => {
                      const activityStats = activityMap.get(profile.username)!;
                      const mx = isMaxAct('Active Days', activityStats.activeDays);
                      return (
                        <td key={profile.username} className={`metric-value ${mx ? 'max-value' : ''}`}>
                          {activityStats.activeDays}/30
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedProfiles.length > 0 && selectedProfiles.some(p => p.topicStats && p.topicStats.length > 0) && (
        <div className="topics-table-section">
          <h3>Topics Solved <span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.7 }}>({sortedTopics.length} total)</span></h3>
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
          {sortedTopics.length > 10 && (
            <button
              className="show-all-btn"
              onClick={() => setShowAllTopics(!showAllTopics)}
              style={{ margin: '8px auto', display: 'block', padding: '4px 16px', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#555' : '#ddd'}`, background: isDarkMode ? '#2a2a2a' : '#f5f5f5', color: isDarkMode ? '#ccc' : '#555' }}
            >
              {showAllTopics ? 'Show Less' : `Show All ${sortedTopics.length} Topics`}
            </button>
          )}
        </div>
      )}

      {selectedProfiles.length > 0 && selectedProfiles.some(p => p.languageStats && p.languageStats.length > 0) && (
        <div className="language-table-section">
          <h3>Languages Used <span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.7 }}>({sortedLangs.length} total)</span></h3>
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
          {sortedLangs.length > 10 && (
            <button
              className="show-all-btn"
              onClick={() => setShowAllLangs(!showAllLangs)}
              style={{ margin: '8px auto', display: 'block', padding: '4px 16px', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#555' : '#ddd'}`, background: isDarkMode ? '#2a2a2a' : '#f5f5f5', color: isDarkMode ? '#ccc' : '#555' }}
            >
              {showAllLangs ? 'Show Less' : `Show All ${sortedLangs.length} Languages`}
            </button>
          )}
        </div>
      )}

      {selectedProfiles.length > 0 && selectedProfiles.some(p => p.recentSubmissions && p.recentSubmissions.length > 0) && (
        <div className="velocity-chart-section">
          <h3>Submission Velocity (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
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
