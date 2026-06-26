import React, { useEffect, useState, useMemo } from 'react';
import { Friend, FriendProfile, RatingHistoryEntry } from '../../types';
import { LeetCodeService } from '../../services/leetcode';
import { CodeforcesService } from '../../services/codeforces';
import { CodeChefService } from '../../services/codechef';
import { AlarmsService } from '../../services/alarms';
import { PlatformIcon, LeetCodeIcon, CodeforcesIcon, CodeChefIcon } from '../../utils/PlatformIcons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, Bell, BellRing, ExternalLink, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { STORAGE_KEYS } from '../../constants';

interface ContestHubProps {
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  isDarkMode: boolean;
  selectedGlobalPlatforms: string[];
  ownUsername?: string;
  ownCodeforcesHandle?: string;
  ownCodechefHandle?: string;
}

export const ContestHub: React.FC<ContestHubProps> = ({
  friends,
  profiles,
  isDarkMode,
  selectedGlobalPlatforms,
  ownUsername,
  ownCodeforcesHandle,
  ownCodechefHandle
}) => {
  const [contests, setContests] = useState<any[]>([]);
  const [loadingContests, setLoadingContests] = useState(true);
  const [reminders, setReminders] = useState<Record<string, any>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activeUser, setActiveUser] = useState<string>('own-user');
  const [dismissedNotice, setDismissedNotice] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['dismissed_contesthub_info'], (res) => {
      if (res.dismissed_contesthub_info) setDismissedNotice(true);
    });
  }, []);

  // Live timer for countdowns
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    AlarmsService.getReminders().then(setReminders);
  }, []);

  const handleToggleReminder = async (e: React.MouseEvent, c: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!reminders[c.id]) {
      chrome.permissions.request({ permissions: ['notifications'] }, async (granted) => {
        if (granted) {
          await AlarmsService.toggleReminder({
            id: String(c.id),
            name: c.name,
            platform: c.platform,
            startTimeSeconds: c.startTimeSeconds
          });
          setReminders(await AlarmsService.getReminders());
        }
      });
    } else {
      await AlarmsService.toggleReminder({
        id: String(c.id),
        name: c.name,
        platform: c.platform,
        startTimeSeconds: c.startTimeSeconds
      });
      setReminders(await AlarmsService.getReminders());
    }
  };

  useEffect(() => {
    const fetchContests = async () => {
      const cacheKey = STORAGE_KEYS.UPCOMING_CONTESTS_CACHE;
      const cached = await new Promise<any>(resolve => {
        chrome.storage.local.get([cacheKey], res => resolve(res[cacheKey]));
      });

      if (cached && cached.timestamp > Date.now() - 1000 * 60 * 60) {
        setContests(cached.data);
        setLoadingContests(false);
        return;
      }

      try {
        const [lcData, cfData, ccData] = await Promise.all([
          LeetCodeService.getUpcomingContests(),
          CodeforcesService.getUpcomingContests(),
          CodeChefService.getUpcomingContests()
        ]);
        
        const LC_MAX = 4;
        const CF_MAX = 6;
        const CC_MAX = 4;

        const mergedData = [
          ...lcData.map(c => ({ ...c, platform: c.platform || 'leetcode' })).slice(0, LC_MAX),
          ...cfData.map(c => ({ ...c, platform: c.platform || 'codeforces' })).slice(0, CF_MAX),
          ...ccData.map(c => ({ ...c, platform: c.platform || 'codechef' })).slice(0, CC_MAX),
        ].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

        setContests(mergedData);
        chrome.storage.local.set({
          [cacheKey]: {
            data: mergedData,
            timestamp: Date.now()
          }
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingContests(false);
      }
    };
    fetchContests();
  }, []);

  const upcomingContests = useMemo(() => {
    return contests
      .filter(c => {
        const startTimeMs = c.startTimeSeconds * 1000;
        return startTimeMs > Date.now() && startTimeMs < Date.now() + 30 * 24 * 60 * 60 * 1000;
      })
      .filter(c => selectedGlobalPlatforms.includes(c.platform));
  }, [contests, selectedGlobalPlatforms]);

  const getGoogleCalendarUrl = (c: any) => {
    const start = new Date(c.startTimeSeconds * 1000);
    const end = new Date(c.startTimeSeconds * 1000 + (c.durationSeconds || 7200) * 1000);
    const formatDT = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(c.name)}&dates=${formatDT(start)}/${formatDT(end)}&details=${encodeURIComponent(`Contest on ${c.platform}`)}`;
  };

  // Compile user selection list
  const selectableUsers = useMemo(() => {
    const list = [];
    if (ownUsername || ownCodeforcesHandle || ownCodechefHandle) {
      list.push({ id: 'own-user', name: 'You (Combined Handles)', username: ownUsername || ownCodeforcesHandle || ownCodechefHandle || 'own' });
    }
    friends.forEach(f => {
      if (f.id !== 'own-user') {
        list.push({ id: f.username, name: f.displayName || f.username, username: f.username });
      }
    });
    return list;
  }, [friends, ownUsername, ownCodeforcesHandle, ownCodechefHandle]);

  // Retrieve rating history for active user across platforms
  const ratingData = useMemo(() => {
    let lcProfile: FriendProfile | undefined;
    let cfProfile: FriendProfile | undefined;
    let ccProfile: FriendProfile | undefined;

    if (activeUser === 'own-user') {
      if (ownUsername) lcProfile = profiles[`leetcode:${ownUsername.toLowerCase()}`] || profiles[ownUsername.toLowerCase()];
      if (ownCodeforcesHandle) cfProfile = profiles[`codeforces:${ownCodeforcesHandle.toLowerCase()}`] || profiles[ownCodeforcesHandle.toLowerCase()];
      if (ownCodechefHandle) ccProfile = profiles[`codechef:${ownCodechefHandle.toLowerCase()}`] || profiles[ownCodechefHandle.toLowerCase()];
    } else {
      const friend = friends.find(f => f.username === activeUser);
      if (friend) {
        const lcAcc = friend.accounts?.find(a => a.platform === 'leetcode');
        const cfAcc = friend.accounts?.find(a => a.platform === 'codeforces');
        const ccAcc = friend.accounts?.find(a => a.platform === 'codechef');
        if (lcAcc) lcProfile = profiles[`leetcode:${lcAcc.handle.toLowerCase()}`] || profiles[lcAcc.handle.toLowerCase()];
        if (cfAcc) cfProfile = profiles[`codeforces:${cfAcc.handle.toLowerCase()}`] || profiles[cfAcc.handle.toLowerCase()];
        if (ccAcc) ccProfile = profiles[`codechef:${ccAcc.handle.toLowerCase()}`] || profiles[ccAcc.handle.toLowerCase()];
        if (!lcProfile && profiles[friend.username.toLowerCase()]?.platform === 'leetcode') {
          lcProfile = profiles[friend.username.toLowerCase()];
        }
      }
    }

    // Merge and sort all rating history entries
    const combinedHistory: {
      timestamp: number;
      dateStr: string;
      contestName: string;
      platform: string;
      rating: number;
      ranking?: number;
      lcRating?: number;
      cfRating?: number;
      ccRating?: number;
      delta: number;
      percentile: number;
      contestId?: string | number;
    }[] = [];

    const processHistory = (history: RatingHistoryEntry[] | undefined, platform: 'leetcode' | 'codeforces' | 'codechef') => {
      if (!history || history.length === 0) return;
      history.forEach((entry, idx) => {
        let delta = 0;
        if (entry.delta !== undefined) {
          delta = entry.delta;
        } else if (idx > 0) {
          delta = entry.rating - history[idx - 1].rating;
        } else {
          if (platform === 'leetcode') {
            delta = entry.rating - 1500;
          } else if (platform === 'codechef') {
            const base = entry.rating < 1000 ? 500 : entry.rating < 1500 ? 1000 : 1500;
            delta = entry.rating - base;
          } else {
            delta = entry.rating;
          }
        }
        // Estimate percentile based on ranking
        const rank = entry.ranking || 0;
        let percentile = 85.5;
        if (rank > 0) {
          if (rank < 500) percentile = 99.2;
          else if (rank < 1500) percentile = 95.4;
          else if (rank < 4000) percentile = 88.3;
          else if (rank < 10000) percentile = 76.1;
          else percentile = 54.2;
        }

        const dateObj = new Date(entry.timestamp);
        combinedHistory.push({
          timestamp: entry.timestamp,
          dateStr: dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          contestName: entry.contestName || `${platform.toUpperCase()} Contest`,
          platform,
          rating: entry.rating,
          ranking: entry.ranking,
          lcRating: platform === 'leetcode' ? entry.rating : undefined,
          cfRating: platform === 'codeforces' ? entry.rating : undefined,
          ccRating: platform === 'codechef' ? entry.rating : undefined,
          delta,
          percentile,
          contestId: entry.contestId || ''
        });
      });
    };

    if (selectedGlobalPlatforms.includes('leetcode')) processHistory(lcProfile?.ratingHistory, 'leetcode');
    if (selectedGlobalPlatforms.includes('codeforces')) processHistory(cfProfile?.ratingHistory, 'codeforces');
    if (selectedGlobalPlatforms.includes('codechef')) processHistory(ccProfile?.ratingHistory, 'codechef');

    combinedHistory.sort((a, b) => a.timestamp - b.timestamp);

    // Carry forward latest ratings for chart continuity
    let lastLC: number | undefined = undefined;
    let lastCF: number | undefined = undefined;
    let lastCC: number | undefined = undefined;

    const chartData = combinedHistory.map(entry => {
      if (entry.lcRating !== undefined) lastLC = entry.lcRating;
      if (entry.cfRating !== undefined) lastCF = entry.cfRating;
      if (entry.ccRating !== undefined) lastCC = entry.ccRating;
      return {
        ...entry,
        lcRating: lastLC,
        cfRating: lastCF,
        ccRating: lastCC
      };
    });

    // Calculate Delta Summaries
    let latestDelta = 0;
    if (combinedHistory.length > 0) {
      latestDelta = combinedHistory[combinedHistory.length - 1].delta;
    }

    let netDelta = 0;
    let positiveContests = 0;
    let ratedContestsWithDelta = 0;
    combinedHistory.forEach(c => {
      netDelta += c.delta;
      if (c.delta > 0) positiveContests++;
      if (c.delta !== 0) ratedContestsWithDelta++;
    });

    const totalContests = combinedHistory.length;
    const avgDelta = ratedContestsWithDelta > 0 ? Math.round(netDelta / ratedContestsWithDelta) : 0;

    return {
      history: combinedHistory.reverse(), // most recent first for table
      chartData,
      latestDelta,
      netDelta,
      avgDelta,
      totalContests,
      winRate: totalContests > 0 ? Math.round((positiveContests / totalContests) * 100) : 0
    };
  }, [activeUser, friends, profiles, selectedGlobalPlatforms, ownUsername, ownCodeforcesHandle, ownCodechefHandle]);

  return (
    <div className="contest-hub-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="tab-header" style={{ marginBottom: '32px' }}>
        <h2>Contest Hub</h2>
        <p>Track upcoming contests, view rating trajectories, and analyze performance.</p>
      </div>

      <div style={{ marginBottom: '48px' }}>
        <h3 style={{ fontSize: 'var(--font-size-value)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Upcoming Contests
        </h3>
        {loadingContests ? (
          <div style={{ padding: '32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
            Loading global contest schedule...
          </div>
        ) : upcomingContests.length === 0 ? (
          <div style={{ padding: '32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
            No upcoming contests found for your active platform filter.
          </div>
        ) : (
          <div className="sheets-container">
            <table className="sheets-table">
              <thead>
                <tr>
                  <th style={{ width: '5%', textAlign: 'center' }}>Platform</th>
                  <th style={{ width: '50%' }}>Contest Name</th>
                  <th style={{ width: '15%' }}>Starts At</th>
                  <th style={{ width: '15%' }}>Countdown</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {upcomingContests.map(c => {
                  const isLC = c.platform === 'leetcode';
                  const isCC = c.platform === 'codechef';
                  const isCF = c.platform === 'codeforces';
                  const accentColor = isLC ? '#ffa116' : isCC ? '#8B572A' : '#3b82f6';
                  const href = isLC 
                    ? `https://leetcode.com/contest/${c.id}` 
                    : isCC
                    ? `https://www.codechef.com/${c.id}`
                    : `https://codeforces.com/contests/${c.id}`;

                  const startDate = new Date(c.startTimeSeconds * 1000);
                  const diff = c.startTimeSeconds * 1000 - currentTime;
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                  const secs = Math.floor((diff % (1000 * 60)) / 1000);

                  return (
                    <tr key={`${c.platform}-${c.id}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={c.platform}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', borderRadius: '0px' }}>
                            <PlatformIcon platform={c.platform} size={14} />
                          </span>
                        </div>
                      </td>
                      <td>
                        <a 
                          href={href} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--font-size-base)' }}
                          onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                        >
                          {c.name}
                        </a>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                        {startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} @ {startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: diff > 0 ? 'var(--color-easy)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--font-size-base)', letterSpacing: '0.5px' }}>
                        {diff > 0 ? `${days}d ${hours}h ${mins}m ${secs}s` : 'STARTED'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button 
                            onClick={(e) => handleToggleReminder(e, c)}
                            title={reminders[c.id] ? "Remove alarm" : "Set alarm"}
                            style={{ 
                              background: reminders[c.id] ? 'rgba(255, 161, 22, 0.15)' : 'var(--bg-primary)', 
                              border: reminders[c.id] ? '1px solid #ffa116' : '1px solid var(--border-strong)', 
                              width: '26px',
                              height: '26px',
                              borderRadius: '0px', 
                              color: reminders[c.id] ? '#ffa116' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'border-color 0.2s ease'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = reminders[c.id] ? '#ffa116' : 'var(--text-primary)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = reminders[c.id] ? '#ffa116' : 'var(--border-strong)'; }}
                          >
                            {reminders[c.id] ? <BellRing size={13} /> : <Bell size={13} />}
                          </button>
                          <a 
                            href={href} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            title="Join Contest"
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              padding: '0 12px', 
                              height: '26px',
                              background: 'transparent',
                              color: accentColor, 
                              textDecoration: 'none', 
                              fontWeight: 700, 
                              fontSize: 'var(--font-size-xs)',
                              borderRadius: '0px',
                              border: `1px solid ${accentColor}`,
                              textTransform: 'uppercase',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = accentColor; e.currentTarget.style.color = '#000'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = accentColor; }}
                          >
                            JOIN
                          </a>
                          <a 
                            href={getGoogleCalendarUrl(c)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            title="Add to Google Calendar"
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              width: '26px',
                              height: '26px', 
                              background: 'var(--bg-primary)', 
                              color: 'var(--text-primary)', 
                              textDecoration: 'none', 
                              borderRadius: '0px',
                              border: '1px solid var(--border-strong)',
                              transition: 'border-color 0.2s ease'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--text-primary)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                          >
                            <Calendar size={13} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historical Rating Vault & Delta Callouts */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: 'var(--font-size-value)', fontWeight: 800, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Rating History & Analytics
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--text-secondary)' }}>Inspect User:</span>
            <select
              value={activeUser}
              onChange={(e) => setActiveUser(e.target.value)}
              style={{
                padding: '8px 16px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: '0px',
                fontSize: 'var(--font-size-md)',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {selectableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!dismissedNotice && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: '0px', fontSize: 'var(--font-size-base)', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <strong>ⓘ Rating Update Delays</strong>
              <button onClick={() => { setDismissedNotice(true); chrome.storage.local.set({ dismissed_contesthub_info: true }); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', fontSize: 'var(--font-size-base)' }}>×</button>
            </div>
            Rating graphs reflect official, finalized contest deltas. Please note that while Codeforces and CodeChef update ratings shortly after a contest, LeetCode's official contest rating calculations typically take 24 to 48 hours to finalize post-contest.
          </div>
        )}

        {/* Delta Callout Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '20px', borderRadius: '0px' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} color="#ffa116" />
              Latest Rating Delta
            </div>
            <div style={{ fontSize: 'calc(2 * var(--font-size-base))', fontWeight: 800, color: ratingData.latestDelta >= 0 ? 'var(--color-easy)' : '#ff375f' }}>
              {ratingData.latestDelta >= 0 ? `+${ratingData.latestDelta}` : ratingData.latestDelta}
            </div>
            <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginTop: '4px' }}>
              From most recent contest battle
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '20px', borderRadius: '0px' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={14} color="#00b8a3" />
              All-Time Net Delta
            </div>
            <div style={{ fontSize: 'calc(2 * var(--font-size-base))', fontWeight: 800, color: ratingData.netDelta >= 0 ? 'var(--color-easy)' : '#ff375f' }}>
              {ratingData.netDelta >= 0 ? `+${ratingData.netDelta}` : ratingData.netDelta}
            </div>
            <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Cumulative career rating gained
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '20px', borderRadius: '0px' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} color="#3b82f6" />
              Average Delta / Contest
            </div>
            <div style={{ fontSize: 'calc(2 * var(--font-size-base))', fontWeight: 800, color: ratingData.avgDelta >= 0 ? 'var(--color-easy)' : '#ff375f' }}>
              {ratingData.avgDelta >= 0 ? `+${ratingData.avgDelta}` : ratingData.avgDelta}
            </div>
            <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Across {ratingData.totalContests} active battles
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '20px', borderRadius: '0px' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={14} color="#a855f7" />
              Contest Win Rate (Gain %)
            </div>
            <div style={{ fontSize: 'calc(2 * var(--font-size-base))', fontWeight: 800, color: '#a855f7' }}>
              {ratingData.winRate}%
            </div>
            <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Percentage of contests with positive delta
            </div>
          </div>
        </div>

        {/* Rating Trajectory Graphs */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px', marginBottom: '32px' }}>
          <h4 style={{ fontSize: 'calc(1.25 * var(--font-size-base))', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
            Rating Trajectory
          </h4>
          {ratingData.chartData.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-size-title)' }}>
              No historical contest rating data available for this user on the selected platforms.
            </div>
          ) : (
            <div style={{ height: '350px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratingData.chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#222' : '#e0e0e0'} />
                  <XAxis dataKey="dateStr" stroke="var(--text-muted)" fontSize="var(--font-size-sm)" tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize="var(--font-size-sm)" tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--bg-primary)', 
                      border: '1px solid var(--border-strong)', 
                      borderRadius: '0px', 
                      color: 'var(--text-primary)',
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 700
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: 'var(--font-size-base)', fontWeight: 700, paddingTop: '16px' }} />
                  {selectedGlobalPlatforms.includes('leetcode') && (
                    <Line type="monotone" dataKey="lcRating" name="LeetCode Rating" stroke="#ffa116" strokeWidth={3} dot={{ r: 4, fill: '#ffa116' }} activeDot={{ r: 7 }} connectNulls />
                  )}
                  {selectedGlobalPlatforms.includes('codeforces') && (
                    <Line type="monotone" dataKey="cfRating" name="Codeforces Rating" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 7 }} connectNulls />
                  )}
                  {selectedGlobalPlatforms.includes('codechef') && (
                    <Line type="monotone" dataKey="ccRating" name="CodeChef Rating" stroke="#8B572A" strokeWidth={3} dot={{ r: 4, fill: '#8B572A' }} activeDot={{ r: 7 }} connectNulls />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Contest Performance Log Table */}
        <div className="sheets-container">
          <div style={{ padding: '20px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-strong)', borderTop: '1px solid var(--border-strong)', borderLeft: '1px solid var(--border-strong)', borderRight: '1px solid var(--border-strong)' }}>
            <h4 style={{ fontSize: 'calc(1.25 * var(--font-size-base))', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Contest History
            </h4>
          </div>
          <table className="sheets-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Platform</th>
                <th>Contest Name</th>
                <th>Global Rank</th>
                <th>Percentile</th>
                <th>New Rating</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody>
              {ratingData.history.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    No contest performance logs found for this user.
                  </td>
                </tr>
              ) : (
                ratingData.history.map((h, idx) => (
                  <tr key={`${h.timestamp}-${idx}`}>
                    <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{h.dateStr}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {h.platform === 'leetcode' ? <LeetCodeIcon size={16} /> : h.platform === 'codeforces' ? <CodeforcesIcon size={16} /> : <CodeChefIcon size={16} />}
                        <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{h.platform}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      <a 
                        href={h.platform === 'leetcode' ? `https://leetcode.com/contest/${h.contestId}` : h.platform === 'codeforces' ? `https://codeforces.com/contests/${h.contestId}` : `https://www.codechef.com/${h.contestId}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}
                      >
                        {h.contestName}
                      </a>
                    </td>
                    <td style={{ fontWeight: 800 }}>
                      {h.ranking ? (
                        <a 
                          href={h.platform === 'leetcode' ? `https://leetcode.com/contest/${h.contestId}/ranking` : h.platform === 'codeforces' ? `https://codeforces.com/contest/${h.contestId}/standings` : `https://www.codechef.com/rankings/${h.contestId}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: h.ranking < 1000 ? '#fbbf24' : 'var(--text-primary)', textDecoration: 'underline' }}
                        >
                          {`#${h.ranking.toLocaleString()}`}
                        </a>
                      ) : '-'}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {h.ranking ? `${h.percentile}th` : '-'}
                    </td>
                    <td style={{ fontWeight: 800 }}>{Math.round(h.rating)}</td>
                    <td style={{ fontWeight: 800, color: h.delta > 0 ? 'var(--color-easy)' : h.delta < 0 ? '#ff375f' : 'var(--text-secondary)' }}>
                      {h.delta > 0 ? `+${Math.round(h.delta)}` : h.delta < 0 ? `${Math.round(h.delta)}` : '0'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
