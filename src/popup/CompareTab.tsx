import React, { useState } from 'react';
import { Friend, FriendProfile } from '../types';
import { DifficultyChart } from './DifficultyChart';
import { StreakCalculator } from '../services/streak';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CompareTabProps {
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  isDarkMode: boolean;
  ownUsername?: string;
}

export const CompareTab: React.FC<CompareTabProps> = ({ friends, profiles, isDarkMode, ownUsername }) => {
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  const calculateActivityStats = (profile: FriendProfile) => {
    if (!profile.recentSubmissions || profile.recentSubmissions.length === 0) {
      return {
        last7Days: 0,
        last30Days: 0,
        activeDays: 0,
        weeklyAvg: 0,
        monthlyAvg: 0,
      };
    }

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - (7 * day);
    const thirtyDaysAgo = now - (30 * day);

    const last7DaysSubmissions = profile.recentSubmissions.filter(
      sub => sub.timestamp >= sevenDaysAgo
    );
    const last30DaysSubmissions = profile.recentSubmissions.filter(
      sub => sub.timestamp >= thirtyDaysAgo
    );

    // Count unique active days in last 30 days
    const uniqueDays = new Set(
      last30DaysSubmissions.map(sub => 
        new Date(sub.timestamp).toDateString()
      )
    );

    return {
      last7Days: last7DaysSubmissions.length,
      last30Days: last30DaysSubmissions.length,
      activeDays: uniqueDays.size,
      weeklyAvg: (last30DaysSubmissions.length / 4.3).toFixed(1),
      monthlyAvg: last30DaysSubmissions.length,
    };
  };

  const getSubmissionVelocityData = () => {
    if (selectedProfiles.length === 0) return [];

    const velocityData: any[] = [];
    const days = 30;
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (let i = days - 1; i >= 0; i--) {
      const currentDate = new Date(now - i * day);
      const dateStr = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dataPoint: any = { date: dateStr };

      selectedProfiles.forEach(profile => {
        const submissionsOnDate = profile.recentSubmissions?.filter(sub => {
          const subDate = new Date(sub.timestamp).toDateString();
          const checkDate = new Date(now - i * day).toDateString();
          return subDate === checkDate;
        }).length || 0;
        dataPoint[profile.username] = submissionsOnDate;
      });

      velocityData.push(dataPoint);
    }

    return velocityData;
  };

  const getMaxValue = (metric: string): string => {
    let maxVal = -Infinity;
    selectedProfiles.forEach(profile => {
      let val = 0;
      if (metric === 'Total Problems') val = profile?.problemsSolved?.total || 0;
      else if (metric === 'Easy') val = profile?.problemsSolved?.easy || 0;
      else if (metric === 'Medium') val = profile?.problemsSolved?.medium || 0;
      else if (metric === 'Hard') val = profile?.problemsSolved?.hard || 0;
      else if (metric === 'Submissions') val = profile?.submissionStats?.totalSubmissions || 0;
      else if (metric === 'Acceptance Rate') val = profile?.submissionStats?.acceptanceRate || 0;
      else if (metric === 'Contest Rating') val = profile?.contestRating ? Math.round(profile.contestRating) : 0;
      else if (metric === 'Rank') val = profile?.ranking ? Math.max(0, 100000000 - profile.ranking) : 0;
      else if (metric === 'Reputation') val = profile?.reputation || 0;
      else {
        const streak = StreakCalculator.calculateStreak(profile);
        if (metric === 'Current Streak') val = streak.currentStreak;
        else if (metric === 'Best Streak') val = streak.longestStreak;
      }
      if (val > maxVal) maxVal = val;
    });
    return maxVal > -Infinity ? String(maxVal) : '';
  };

  const isMaxValue = (metric: string, value: string | number): boolean => {
    if (!value || value === '-') return false;
    const maxVal = getMaxValue(metric);
    return String(value) === maxVal;
  };

  const getMaxActivityValue = (metric: string): number => {
    let maxVal = -Infinity;
    selectedProfiles.forEach(profile => {
      const stats = calculateActivityStats(profile);
      let val = 0;
      if (metric === 'Last 7 Days') val = stats.last7Days;
      else if (metric === 'Last 30 Days') val = stats.last30Days;
      else if (metric === 'Active Days') val = stats.activeDays;
      if (val > maxVal) maxVal = val;
    });
    return maxVal > -Infinity ? maxVal : 0;
  };

  const isMaxActivity = (metric: string, value: number): boolean => {
    return value > 0 && value === getMaxActivityValue(metric);
  };

  const getMaxTopicCount = (topicName: string): number => {
    let maxVal = 0;
    selectedProfiles.forEach(profile => {
      const count = profile.topicStats?.find(t => t.topicName === topicName)?.problemsSolved || 0;
      if (count > maxVal) maxVal = count;
    });
    return maxVal;
  };

  const isMaxTopic = (topicName: string, count: number): boolean => {
    return count > 0 && count === getMaxTopicCount(topicName);
  };

  const getMaxLanguageCount = (langName: string): number => {
    let maxVal = 0;
    selectedProfiles.forEach(profile => {
      const count = profile.languageStats?.find(l => l.languageName === langName)?.problemsSolved || 0;
      if (count > maxVal) maxVal = count;
    });
    return maxVal;
  };

  const isMaxLanguage = (langName: string, count: number): boolean => {
    return count > 0 && count === getMaxLanguageCount(langName);
  };

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

  const getSelectedProfiles = () => {
    return selectedFriends
      .map(username => profiles[username.toLowerCase()])
      .filter(Boolean);
  };

  const selectedProfiles = getSelectedProfiles();

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
                    const isMax = isMaxValue('Total Problems', val);
                    return (
                      <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="metric-label">Easy</td>
                  {selectedProfiles.map(profile => {
                    const val = profile?.problemsSolved?.easy || '-';
                    const isMax = isMaxValue('Easy', val);
                    return (
                      <td key={profile.username} className={`metric-value easy ${isMax ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="metric-label">Medium</td>
                  {selectedProfiles.map(profile => {
                    const val = profile?.problemsSolved?.medium || '-';
                    const isMax = isMaxValue('Medium', val);
                    return (
                      <td key={profile.username} className={`metric-value medium ${isMax ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="metric-label">Hard</td>
                  {selectedProfiles.map(profile => {
                    const val = profile?.problemsSolved?.hard || '-';
                    const isMax = isMaxValue('Hard', val);
                    return (
                      <td key={profile.username} className={`metric-value hard ${isMax ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="metric-label">Current Streak</td>
                  {selectedProfiles.map(profile => {
                    const streak = StreakCalculator.calculateStreak(profile);
                    const val = streak.currentStreak > 0 ? `🔥 ${streak.currentStreak}` : '-';
                    const isMax = isMaxValue('Current Streak', streak.currentStreak);
                    return (
                      <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="metric-label">Best Streak</td>
                  {selectedProfiles.map(profile => {
                    const streak = StreakCalculator.calculateStreak(profile);
                    const val = streak.longestStreak > 0 ? streak.longestStreak : '-';
                    const isMax = isMaxValue('Best Streak', streak.longestStreak);
                    return (
                      <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
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
                        const isMax = isMaxValue('Submissions', val);
                        return (
                          <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="metric-label">Acceptance Rate</td>
                      {selectedProfiles.map(profile => {
                        const val = profile?.submissionStats?.acceptanceRate ? `${profile.submissionStats.acceptanceRate.toFixed(1)}%` : '-';
                        const isMax = isMaxValue('Acceptance Rate', profile?.submissionStats?.acceptanceRate || 0);
                        return (
                          <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
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
                      const isMax = isMaxValue('Contest Rating', val);
                      return (
                        <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
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
                      const isMax = isMaxValue('Rank', profile?.ranking ? 100000000 - profile.ranking : 0);
                      return (
                        <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
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
                      const isMax = isMaxValue('Reputation', val);
                      return (
                        <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
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
                      const activityStats = calculateActivityStats(profile);
                      const isMax = isMaxActivity('Last 7 Days', activityStats.last7Days);
                      return (
                        <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
                          {activityStats.last7Days}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="metric-label">Last 30 Days</td>
                    {selectedProfiles.map(profile => {
                      const activityStats = calculateActivityStats(profile);
                      const isMax = isMaxActivity('Last 30 Days', activityStats.last30Days);
                      return (
                        <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
                          {activityStats.last30Days}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="metric-label">Active Days</td>
                    {selectedProfiles.map(profile => {
                      const activityStats = calculateActivityStats(profile);
                      const isMax = isMaxActivity('Active Days', activityStats.activeDays);
                      return (
                        <td key={profile.username} className={`metric-value ${isMax ? 'max-value' : ''}`}>
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
          <h3>Topics Solved</h3>
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
              {(() => {
                // Merge all unique topics from all selected profiles
                const allTopics = new Map<string, number>();
                selectedProfiles.forEach(profile => {
                  profile.topicStats?.forEach(topic => {
                    if (!allTopics.has(topic.topicName)) {
                      allTopics.set(topic.topicName, 0);
                    }
                  });
                });
                
                // Sort by total problems solved across all friends (no limit)
                const sortedTopics = Array.from(allTopics.keys()).sort((a, b) => {
                  const totalA = selectedProfiles.reduce((sum, p) => sum + (p.topicStats?.find(t => t.topicName === a)?.problemsSolved || 0), 0);
                  const totalB = selectedProfiles.reduce((sum, p) => sum + (p.topicStats?.find(t => t.topicName === b)?.problemsSolved || 0), 0);
                  return totalB - totalA;
                });
                
                return sortedTopics.map((topicName, idx) => (
                  <tr key={idx}>
                    <td className="topic-name-cell">{topicName}</td>
                    {selectedProfiles.map(profile => {
                      const profileTopic = profile.topicStats?.find(t => t.topicName === topicName);
                      const count = profileTopic?.problemsSolved || 0;
                      const isMax = isMaxTopic(topicName, count);
                      return (
                        <td key={profile.username} className={`topic-count-cell ${isMax ? 'max-value' : ''}`}>
                          {count || '-'}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}

      {selectedProfiles.length > 0 && selectedProfiles.some(p => p.languageStats && p.languageStats.length > 0) && (
        <div className="language-table-section">
          <h3>Languages Used</h3>
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
              {(() => {
                // Merge all unique languages from all selected profiles
                const allLanguages = new Map<string, number>();
                selectedProfiles.forEach(profile => {
                  profile.languageStats?.forEach(lang => {
                    if (!allLanguages.has(lang.languageName)) {
                      allLanguages.set(lang.languageName, 0);
                    }
                  });
                });
                
                // Sort by total problems solved across all friends (no limit)
                const sortedLanguages = Array.from(allLanguages.keys()).sort((a, b) => {
                  const totalA = selectedProfiles.reduce((sum, p) => sum + (p.languageStats?.find(l => l.languageName === a)?.problemsSolved || 0), 0);
                  const totalB = selectedProfiles.reduce((sum, p) => sum + (p.languageStats?.find(l => l.languageName === b)?.problemsSolved || 0), 0);
                  return totalB - totalA;
                });
                
                return sortedLanguages.map((langName, idx) => (
                  <tr key={idx}>
                    <td className="language-name-cell">{langName}</td>
                    {selectedProfiles.map(profile => {
                      const profileLang = profile.languageStats?.find(l => l.languageName === langName);
                      const count = profileLang?.problemsSolved || 0;
                      const isMax = isMaxLanguage(langName, count);
                      return (
                        <td key={profile.username} className={`language-count-cell ${isMax ? 'max-value' : ''}`}>
                          {count || '-'}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}

      {selectedProfiles.length > 0 && selectedProfiles.some(p => p.recentSubmissions && p.recentSubmissions.length > 0) && (
        <div className="velocity-chart-section">
          <h3>Submission Velocity (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={getSubmissionVelocityData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="date" stroke="#999" />
              <YAxis stroke="#999" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0' }}
                labelStyle={{ color: '#333' }}
              />
              <Legend />
              {selectedProfiles.map((profile, idx) => {
                const colors = ['#009a3d', '#d6c101', '#960808'];
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
