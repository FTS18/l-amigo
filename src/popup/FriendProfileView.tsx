import React, { useState, useEffect, useMemo } from 'react';
import { Friend, FriendProfile, RecentSubmission, Platform } from '../types';
import { X, ChevronLeft } from 'lucide-react';
import { StreakCalculator } from '../services/streak';
import { LeetCodeService } from '../services/leetcode';
import { CodeforcesService } from '../services/codeforces';
import { CodeChefService } from '../services/codechef';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { getPlatformRankColor, getPlatformRankLabel, getProfileQualityColor, getProfileQualityBorderColor, getProfileQualityTextColor } from './FriendCard';
import { SkeletonList, SkeletonRecItem } from './Skeleton';
import { LeetCodeIcon, CodeforcesIcon, CodeChefIcon, PlatformIcon } from '../utils/PlatformIcons';

interface FriendProfileViewProps {
  friend: Friend;
  leetcodeProfile?: FriendProfile;
  codeforcesProfile?: FriendProfile;
  codechefProfile?: FriendProfile;
  isDarkMode?: boolean;
  onBack: () => void;
  initialFilter?: 'all' | 'Easy' | 'Medium' | 'Hard';
  initialPlatform?: Platform;
  isExpanded?: boolean;
  preloadedSubmissions?: RecentSubmission[];
}

const RatingChart: React.FC<{
  history: any[];
  platform: Platform;
  isDarkMode: boolean;
  activeProfile: FriendProfile;
}> = ({ history, platform, isDarkMode, activeProfile }) => {
  if (!history || history.length === 0) {
    return (
      <div className="no-history-placeholder">
        No rating history available for this platform.
      </div>
    );
  }

  const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
  const data = sortedHistory.map((h, i) => ({
    id: i,
    name: h.contestName,
    rating: h.rating,
    rank: h.ranking,
    date: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
  }));

  let themeColor = getPlatformRankColor(activeProfile);
  if (themeColor === 'inherit' || themeColor === 'var(--rank-leetcode-default)' || themeColor === 'var(--rank-codeforces-newbie)') {
    themeColor = platform === 'leetcode' ? 'var(--accent-leetcode-primary)' : platform === 'codechef' ? 'var(--accent-codechef-primary, #5B4638)' : 'var(--accent-codeforces-blue)';
  }
  const labelColor = 'var(--text-secondary)';

  return (
    <div className="rating-chart-container">
      <div className="chart-header-row">
        <h3>Rating Progress ({data.length} contests)</h3>
      </div>
      <div style={{ width: '100%', height: 125 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id={`colorRating-${platform}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={themeColor} stopOpacity={0.6}/>
                <stop offset="95%" stopColor={themeColor} stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="id" 
              tickFormatter={(val) => data[val]?.date || ''}
              stroke={labelColor} 
              fontSize="calc(0.9 * var(--font-size-xs))" 
              tickLine={false} 
              axisLine={false}
              dy={6}
              interval={Math.max(0, Math.floor(data.length / 6))}
            />
            <YAxis 
              stroke={labelColor} 
              fontSize="calc(0.9 * var(--font-size-xs))" 
              tickLine={false} 
              axisLine={false}
              domain={['dataMin - 100', 'dataMax + 100']}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const pointColor = getPlatformRankColor({ ...activeProfile, contestRating: data.rating });
                  return (
                    <div style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: '0px',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--font-size-sm)',
                      minWidth: '150px'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '6px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                        {data.name}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div>Rating: <span style={{ fontWeight: 'bold', color: pointColor }}>{data.rating}</span></div>
                        {data.rank ? <div>Rank: <span style={{ fontWeight: 'bold' }}>#{data.rank}</span></div> : null}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="rating" 
              stroke={themeColor} 
              strokeWidth={2} 
              fillOpacity={1} 
              fill={`url(#colorRating-${platform})`} 
              isAnimationActive={false}
              activeDot={{ r: 5, fill: themeColor, stroke: 'var(--bg-primary)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const FriendProfileView: React.FC<FriendProfileViewProps> = ({
  friend,
  leetcodeProfile,
  codeforcesProfile,
  codechefProfile,
  isDarkMode = true,
  onBack,
  initialFilter = 'all',
  initialPlatform,
  isExpanded = false,
  preloadedSubmissions
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions'>('overview');
  const [activePlatform, setActivePlatform] = useState<Platform>(
    initialPlatform || (leetcodeProfile ? 'leetcode' : codeforcesProfile ? 'codeforces' : 'codechef')
  );
  const [filterLevel, setFilterLevel] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>(initialFilter);
  const [submissions, setSubmissions] = useState<RecentSubmission[]>(preloadedSubmissions || []);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionLimit, setSubmissionLimit] = useState(isExpanded ? 150 : 30);
  const [showInfo, setShowInfo] = useState(false);

  // Sync initialFilter prop to filterLevel state
  useEffect(() => {
    setFilterLevel(initialFilter);
  }, [initialFilter]);

  // If initialFilter was set, we should open the submissions tab
  useEffect(() => {
    if (initialFilter !== 'all') {
      setActiveTab('submissions');
    }
  }, [initialFilter]);

  // Sync initialPlatform and fallbacks
  useEffect(() => {
    if (initialPlatform) {
      setActivePlatform(initialPlatform);
    } else if (leetcodeProfile && !codeforcesProfile && !codechefProfile) {
      setActivePlatform('leetcode');
    } else if (!leetcodeProfile && codeforcesProfile && !codechefProfile) {
      setActivePlatform('codeforces');
    } else if (!leetcodeProfile && !codeforcesProfile && codechefProfile) {
      setActivePlatform('codechef');
    }
  }, [initialPlatform, leetcodeProfile, codeforcesProfile, codechefProfile]);

  useEffect(() => {
    if (preloadedSubmissions && preloadedSubmissions.length > 0) {
      setSubmissions(preloadedSubmissions);
      return;
    }

    const fetchSubmissions = async () => {
      const cacheKey = `lamigo:subcache:${leetcodeProfile?.username || ''}:${codeforcesProfile?.username || ''}:${codechefProfile?.username || ''}`;
      
      if (submissionLimit <= 150) {
        chrome.storage.local.get([cacheKey], (res) => {
          if (res[cacheKey]) {
            setSubmissions(res[cacheKey]);
          }
        });
      }

      setLoadingSubmissions(true);
      try {
        const promises: Promise<RecentSubmission[]>[] = [];
        if (leetcodeProfile?.username) {
          promises.push(LeetCodeService.getRecentSubmissions(leetcodeProfile.username, submissionLimit));
        }
        if (codeforcesProfile?.username) {
          promises.push(CodeforcesService.getRecentSubmissions(codeforcesProfile.username, Math.floor(submissionLimit * (isExpanded ? 3 : 1.5))));
        }
        // codechef doesn't currently support getRecentSubmissions
        const results = await Promise.all(promises);
        const combined = results.flat().sort((a, b) => b.timestamp - a.timestamp);
        
        setSubmissions(combined);
        if (submissionLimit <= 150) {
          chrome.storage.local.set({ [cacheKey]: combined });
        }
      } catch (err) {
        console.error('Failed to fetch profile submissions:', err);
      } finally {
        setLoadingSubmissions(false);
      }
    };

    fetchSubmissions();

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local') {
        const cacheKey = `lamigo:subcache:${leetcodeProfile?.username || ''}:${codeforcesProfile?.username || ''}:${codechefProfile?.username || ''}`;
        if (changes[cacheKey] && changes[cacheKey].newValue) {
          setSubmissions(changes[cacheKey].newValue);
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [leetcodeProfile, codeforcesProfile, codechefProfile, submissionLimit, preloadedSubmissions, isExpanded]);

  const activeChartProfile = activePlatform === 'leetcode' ? leetcodeProfile : activePlatform === 'codechef' ? codechefProfile : codeforcesProfile;
  const platformSubmissions = submissions.filter(sub => sub.platform === activePlatform);
  
  const deduplicatedPlatformSubmissions = useMemo(() => {
    const deduplicated = new Map<string, RecentSubmission>();
    for (const sub of [...platformSubmissions].sort((a, b) => b.timestamp - a.timestamp)) {
      const key = `${sub.platform}-${sub.titleSlug}`;
      if (!deduplicated.has(key)) deduplicated.set(key, sub);
    }
    return Array.from(deduplicated.values());
  }, [platformSubmissions]);
  const hasOverviewData = !!(
    (activeChartProfile?.ratingHistory && activeChartProfile.ratingHistory.length > 0) ||
    (activeChartProfile?.topicStats && activeChartProfile.topicStats.length > 0) ||
    (activeChartProfile?.submissionStats)
  );

  useEffect(() => {
    if (!hasOverviewData && activeTab === 'overview') {
      setActiveTab('submissions');
    }
  }, [hasOverviewData, activeTab]);

  const lcRankColorRaw = leetcodeProfile ? getPlatformRankColor(leetcodeProfile) : 'var(--rank-leetcode-default)';
  const cfRankColorRaw = codeforcesProfile ? getPlatformRankColor(codeforcesProfile) : 'var(--rank-codeforces-newbie)';
  const ccRankColorRaw = codechefProfile ? getPlatformRankColor(codechefProfile) : 'var(--bg-tertiary)';

  const lcRankColor = lcRankColorRaw === 'var(--rank-leetcode-default)' || lcRankColorRaw === 'inherit' ? 'var(--accent-leetcode-primary)' : lcRankColorRaw;
  const cfRankColor = cfRankColorRaw === 'var(--rank-codeforces-newbie)' || cfRankColorRaw === 'inherit' ? 'var(--accent-codeforces-blue)' : cfRankColorRaw;
  const ccRankColor = ccRankColorRaw === 'var(--bg-tertiary)' || ccRankColorRaw === 'inherit' ? 'var(--accent-codechef-primary, #5B4638)' : ccRankColorRaw;

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getContestDelta = (profile: FriendProfile, contestTimestamp: number) => {
    if (!profile.ratingHistory) return 0;
    const history = [...profile.ratingHistory].sort((a, b) => a.timestamp - b.timestamp);
    const cIndex = history.findIndex(h => h.timestamp === contestTimestamp);
    if (cIndex > 0) {
      return history[cIndex].rating - history[cIndex - 1].rating;
    }
    return 0;
  };

  const themeColor = activePlatform === 'leetcode' ? lcRankColor : activePlatform === 'codechef' ? ccRankColor : cfRankColor;

  const openExternalProfile = () => {
    if (activeChartProfile?.username) {
      const url = activePlatform === 'leetcode' 
        ? `https://leetcode.com/${activeChartProfile.username}`
        : activePlatform === 'codechef'
        ? `https://www.codechef.com/users/${activeChartProfile.username}`
        : `https://codeforces.com/profile/${activeChartProfile.username}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const availablePlatforms = [
    leetcodeProfile ? 'leetcode' : null,
    codeforcesProfile ? 'codeforces' : null,
    codechefProfile ? 'codechef' : null
  ].filter(Boolean) as string[];
  const activeIndex = availablePlatforms.indexOf(activePlatform);
  const selectorWidth = `${100 / availablePlatforms.length}%`;
  const selectorTransform = `translateX(${activeIndex * 100}%)`;

  return (
    <div className="friend-profile-view" style={{ '--platform-theme-color': themeColor } as React.CSSProperties}>
      <div 
        className="profile-hero"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, color-mix(in srgb, ${themeColor} 15%, transparent) 0%, transparent 70%), var(--bg-secondary)`
        }}
      >
        <div className="profile-hero-top">
          <button className="back-button-arrow" onClick={onBack} title="Back">
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>

          {activeChartProfile ? (
            <div className="profile-hero-identity">
              <img
                className="profile-avatar-small"
                src={activeChartProfile.avatar || 'default-avatar.svg'}
                alt={friend.displayName || activeChartProfile.username}
                onError={(e) => { (e.target as HTMLImageElement).src = 'default-avatar.svg'; }}
              />
              <div className="profile-hero-names">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <a
                    className="profile-header-name-link"
                    href={activePlatform === 'leetcode'
                      ? `https://leetcode.com/${activeChartProfile.username}`
                      : activePlatform === 'codechef'
                      ? `https://www.codechef.com/users/${activeChartProfile.username}`
                      : `https://codeforces.com/profile/${activeChartProfile.username}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {friend.displayName || activeChartProfile.username}
                  </a>
                  {activeChartProfile && StreakCalculator.calculateStreak(activeChartProfile).currentStreak > 0 && (
                    <span 
                      className="name-streak-badge" 
                      title={`${StreakCalculator.calculateStreak(activeChartProfile).currentStreak} Day Streak on ${activePlatform}`}
                      style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: '#ff9800', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'default' }}
                    >
                      {StreakCalculator.calculateStreak(activeChartProfile).currentStreak} <span style={{ fontSize: 'var(--font-size-xs)', marginLeft: '2px', color: 'var(--text-muted)', fontWeight: 'normal' }}>days</span>
                    </span>
                  )}
                </div>
                <span className="profile-header-handle-text">@{activeChartProfile.username}</span>
              </div>
              <div className="profile-hero-tags" style={{ display: 'flex', gap: '6px', marginLeft: 'auto', marginRight: '4px', alignItems: 'center' }}>
                {activePlatform === 'leetcode' && leetcodeProfile?.contestCount && (
                  <span 
                    className="contest-tag" 
                    style={{ color: isDarkMode ? '#fff' : 'var(--text-primary)', border: 'none', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', whiteSpace: 'nowrap', fontWeight: 600 }}
                    onClick={openExternalProfile}
                    title="Number of LeetCode Contests"
                  >
                    {leetcodeProfile.contestCount} Contests
                  </span>
                )}
                {activePlatform === 'codeforces' && codeforcesProfile?.contestCount && (
                  <span 
                    className="contest-tag" 
                    style={{ color: isDarkMode ? '#fff' : 'var(--text-primary)', border: 'none', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', whiteSpace: 'nowrap', fontWeight: 600 }}
                    onClick={openExternalProfile}
                    title="Number of Codeforces Contests"
                  >
                    {codeforcesProfile.contestCount} Contests
                  </span>
                )}
                {activePlatform === 'codechef' && codechefProfile && (
                  <>
                    {codechefProfile.contestCount && (
                      <span 
                        className="contest-tag" 
                        style={{ color: isDarkMode ? '#fff' : 'var(--text-primary)', border: 'none', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', whiteSpace: 'nowrap', fontWeight: 600 }}
                        onClick={openExternalProfile}
                        title="Number of CodeChef Contests"
                      >
                        {codechefProfile.contestCount} Contests
                      </span>
                    )}
                    {codechefProfile.contributionPoints && (
                      <span 
                        className="div-tag div3" 
                        style={{ color: themeColor, border: 'none', backgroundColor: `${themeColor}1a`, fontSize: 'var(--font-size-xs)', padding: '3px 8px' }}
                        onClick={openExternalProfile} 
                        title="Maximum CodeChef Rating achieved"
                      >
                        Max Rating: {codechefProfile.contributionPoints}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <span className="profile-header-name">{friend.displayName}</span>
          )}

          {availablePlatforms.length > 1 && (
            <div className="profile-header-platform-selector">
              <div
                className="platform-selector-active-bg"
                style={{ width: selectorWidth, transform: selectorTransform }}
              />
              {leetcodeProfile && (
                <button
                  className={`platform-selector-btn lc ${activePlatform === 'leetcode' ? 'active' : ''}`}
                  onClick={() => setActivePlatform('leetcode')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  title="LeetCode"
                ><LeetCodeIcon size={16} /></button>
              )}
              {codeforcesProfile && (
                <button
                  className={`platform-selector-btn cf ${activePlatform === 'codeforces' ? 'active' : ''}`}
                  onClick={() => setActivePlatform('codeforces')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  title="Codeforces"
                ><CodeforcesIcon size={16} /></button>
              )}
              {codechefProfile && (
                <button
                  className={`platform-selector-btn cc ${activePlatform === 'codechef' ? 'active' : ''}`}
                  onClick={() => setActivePlatform('codechef')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  title="CodeChef"
                ><CodeChefIcon size={16} /></button>
              )}
            </div>
          )}
        </div>

        {/* Detailed Stats Row for LeetCode */}
        {activePlatform === 'leetcode' && leetcodeProfile && (
          <div className="platform-section-clean leetcode-section">
          <div className="stats-row-detailed">
            {leetcodeProfile.contestRating && leetcodeProfile.contestRating > 0 && leetcodeProfile.contestCount !== 0 ? (
              <div 
                className="detailed-rating-box"
                style={{ 
                  borderColor: 'transparent',
                  background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)'
                }}
                onClick={() => setActiveTab('overview')}
                title="Click to view rating chart"
              >
                <span className="value" style={{ color: lcRankColor }}>
                  {Math.round(leetcodeProfile.contestRating)}
                </span>
                <span className="label">Contest Rating</span>
                {getPlatformRankLabel(leetcodeProfile) && (
                  <span className="rank-tier-badge" style={{ backgroundColor: getPlatformRankColor(leetcodeProfile) }}>
                    {getPlatformRankLabel(leetcodeProfile)}
                  </span>
                )}
              </div>
            ) : null}

            <div className="solved-grid">
              <div 
                className="solved-pill total" 
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)',
                  border: 'none',
                  color: getProfileQualityColor(leetcodeProfile, isDarkMode)
                }}
                onClick={() => { setActiveTab('submissions'); setFilterLevel('all'); }}
                title="Click to view all submissions"
              >
                <span className="count" style={{ color: getProfileQualityColor(leetcodeProfile, isDarkMode) }}>{leetcodeProfile.problemsSolved.total}</span>
                <span className="lbl" style={{ color: getProfileQualityColor(leetcodeProfile, isDarkMode) }}>Total</span>
              </div>
              <div 
                className="solved-pill easy"
                onClick={() => { setActiveTab('submissions'); setFilterLevel('Easy'); }}
                title="Filter easy submissions"
              >
                <span className="count">{leetcodeProfile.problemsSolved.easy}</span>
                <span className="lbl">Easy</span>
              </div>
              <div 
                className="solved-pill medium"
                onClick={() => { setActiveTab('submissions'); setFilterLevel('Medium'); }}
                title="Filter medium submissions"
              >
                <span className="count">{leetcodeProfile.problemsSolved.medium}</span>
                <span className="lbl">Med</span>
              </div>
              <div 
                className="solved-pill hard"
                onClick={() => { setActiveTab('submissions'); setFilterLevel('Hard'); }}
                title="Filter hard submissions"
              >
                <span className="count">{leetcodeProfile.problemsSolved.hard}</span>
                <span className="lbl">Hard</span>
              </div>
            </div>
          </div>

          </div>
      )}

      {/* Detailed Stats Row for Codeforces */}
      {activePlatform === 'codeforces' && codeforcesProfile && (
        <div className="platform-section-clean codeforces-section">
          <div className="stats-row-detailed">
            {codeforcesProfile.contestRating && codeforcesProfile.contestRating > 0 && codeforcesProfile.contestCount !== 0 ? (
              <div 
                className="detailed-rating-box"
                style={{ 
                  borderColor: 'transparent',
                  background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)'
                }}
                onClick={() => setActiveTab('overview')}
                title="Click to view rating chart"
              >
                <span className="value" style={{ color: cfRankColor }}>
                  {Math.round(codeforcesProfile.contestRating)}
                  {codeforcesProfile.codeforcesStats?.ratingDelta !== undefined && codeforcesProfile.codeforcesStats.ratingDelta !== 0 && (
                    <span className={`delta ${codeforcesProfile.codeforcesStats.ratingDelta > 0 ? 'pos' : 'neg'}`} style={{ color: cfRankColor }}>
                      {codeforcesProfile.codeforcesStats.ratingDelta > 0 ? `+${codeforcesProfile.codeforcesStats.ratingDelta}` : codeforcesProfile.codeforcesStats.ratingDelta}
                    </span>
                  )}
                </span>
                <span className="label">Contest Rating</span>
                {getPlatformRankLabel(codeforcesProfile) && (
                  <span className="rank-tier-badge" style={{ backgroundColor: getPlatformRankColor(codeforcesProfile) }}>
                    {getPlatformRankLabel(codeforcesProfile)}
                  </span>
                )}
              </div>
            ) : null}

            <div className="solved-grid">
              <div 
                className="solved-pill total" 
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)',
                  border: 'none',
                  color: getProfileQualityColor(codeforcesProfile, isDarkMode)
                }}
                onClick={() => { setActiveTab('submissions'); setFilterLevel('all'); }}
                title="Click to view all submissions"
              >
                <span className="count" style={{ color: getProfileQualityColor(codeforcesProfile, isDarkMode) }}>{codeforcesProfile.problemsSolved.total}</span>
                <span className="lbl" style={{ color: getProfileQualityColor(codeforcesProfile, isDarkMode) }}>Total</span>
              </div>
              <div 
                className="solved-pill easy"
                onClick={() => { setActiveTab('submissions'); setFilterLevel('Easy'); }}
                title="Filter easy submissions"
              >
                <span className="count">{codeforcesProfile.problemsSolved.easy}</span>
                <span className="lbl">Easy</span>
              </div>
              <div 
                className="solved-pill medium"
                onClick={() => { setActiveTab('submissions'); setFilterLevel('Medium'); }}
                title="Filter medium submissions"
              >
                <span className="count">{codeforcesProfile.problemsSolved.medium}</span>
                <span className="lbl">Med</span>
              </div>
              <div 
                className="solved-pill hard"
                onClick={() => { setActiveTab('submissions'); setFilterLevel('Hard'); }}
                title="Filter hard submissions"
              >
                <span className="count">{codeforcesProfile.problemsSolved.hard}</span>
                <span className="lbl">Hard</span>
              </div>
            </div>
          </div>

          <div className="bottom-meta-row-cf">

            {codeforcesProfile.codeforcesStats?.divisionCounts && (
              (() => {
                const divs = codeforcesProfile.codeforcesStats.divisionCounts;
                const totalDiv = divs.div1 + divs.div2 + divs.div3 + divs.div4;
                if (totalDiv === 0) return null;
                return (
                  <div className="cf-divisions-wrapper" onClick={openExternalProfile} title="View profile on Codeforces" style={{ cursor: 'pointer', padding: '12px 0px 4px', width: '100%', boxSizing: 'border-box' }}>
                    <div className="cf-divisions-bar-thin" style={{ display: 'flex', height: '4px', width: '100%', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
                      {divs.div1 > 0 && <div style={{ width: `${(divs.div1 / totalDiv) * 100}%`, background: 'var(--color-hard)' }} />}
                      {divs.div2 > 0 && <div style={{ width: `${(divs.div2 / totalDiv) * 100}%`, background: 'var(--color-medium)' }} />}
                      {divs.div3 > 0 && <div style={{ width: `${(divs.div3 / totalDiv) * 100}%`, background: 'var(--accent-codeforces-blue)' }} />}
                      {divs.div4 > 0 && <div style={{ width: `${(divs.div4 / totalDiv) * 100}%`, background: 'var(--color-easy)' }} />}
                    </div>
                    <div className="cf-divisions-legend" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'calc(0.9 * var(--font-size-xs))', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {divs.div1 > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-hard)' }} /> D1: {divs.div1}</span>}
                      {divs.div2 > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-medium)' }} /> D2: {divs.div2}</span>}
                      {divs.div3 > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-codeforces-blue)' }} /> D3: {divs.div3}</span>}
                      {divs.div4 > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-easy)' }} /> D4: {divs.div4}</span>}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
      
      {/* Detailed Stats Row for CodeChef */}
      {activePlatform === 'codechef' && codechefProfile && (
        <div className="platform-section-clean codechef-section">
          <div className="stats-row-detailed">
            {codechefProfile.contestRating && codechefProfile.contestRating > 0 && codechefProfile.contestCount !== 0 ? (
              <div 
                className="detailed-rating-box"
                style={{ 
                  borderColor: 'transparent',
                  background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)'
                }}
                onClick={() => setActiveTab('overview')}
                title="Click to view rating chart"
              >
                <span className="value" style={{ color: ccRankColor }}>
                  {Math.round(codechefProfile.contestRating)}
                </span>
                <span className="label">Contest Rating</span>
                {getPlatformRankLabel(codechefProfile) && (
                  <span className="rank-tier-badge" style={{ backgroundColor: getPlatformRankColor(codechefProfile) }}>
                    {getPlatformRankLabel(codechefProfile)}
                  </span>
                )}
              </div>
            ) : null}
            
            {codechefProfile.contestRanking && codechefProfile.contestRanking > 0 ? (
              <div 
                className="detailed-rating-box"
                style={{ 
                  borderColor: 'var(--border)',
                  background: `var(--bg-tertiary)`
                }}
              >
                <span className="value" style={{ color: 'var(--text-primary)' }}>
                  #{codechefProfile.contestRanking}
                </span>
                <span className="label">Global Rank</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
      </div>  {/* close profile-hero */}

      <div className="profile-tabs-row">
        {hasOverviewData && (
          <button 
            className={`profile-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview & Contests
          </button>
        )}
        <button 
          className={`profile-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('submissions')}
        >
          Questions Solved {deduplicatedPlatformSubmissions.length > 0 && `(${deduplicatedPlatformSubmissions.length})`}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="profile-tab-content">
        {activeTab === 'overview' && activeChartProfile && (
          <div className="overview-tab-pane">
            {activeChartProfile.ratingHistory && activeChartProfile.ratingHistory.length > 0 && (
              <RatingChart 
                history={activeChartProfile.ratingHistory || []} 
                platform={activePlatform} 
                isDarkMode={isDarkMode}
                activeProfile={activeChartProfile}
              />
            )}

            <div className="advanced-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', marginBottom: '24px' }}>
                  {/* Skills Radar Chart */}
                  {activeChartProfile.topicStats && activeChartProfile.topicStats.length >= 3 && (
                    <div className="analytics-card">
                      <h4>Topic Mastery</h4>
                      <div style={{ width: '100%', height: 200, marginTop: '-10px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={activeChartProfile.topicStats.slice(0, 6)}>
                            <PolarGrid stroke="var(--border)" />
                            <PolarAngleAxis dataKey="topicName" tick={{ fill: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} tick={false} axisLine={false} />
                            <Radar name="Solved" dataKey="problemsSolved" stroke={themeColor} fill={themeColor} fillOpacity={0.3} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '0px' }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Accuracy & Verdicts or Peak Metrics */}
                  <div className="analytics-card flex-col" style={{ gridColumn: (!activeChartProfile.topicStats || activeChartProfile.topicStats.length < 3) ? '1 / -1' : 'auto' }}>
                    <h4 style={{ textAlign: (!activeChartProfile.topicStats || activeChartProfile.topicStats.length < 3) ? 'center' : 'left' }}>Peak Performance</h4>
                    <div className="peak-stats-list" style={{ alignItems: (!activeChartProfile.topicStats || activeChartProfile.topicStats.length < 3) ? 'center' : 'flex-start' }}>
                      {(activePlatform === 'codeforces' && activeChartProfile.codeforcesStats?.maxRating) ? (
                        <div className="peak-stat">
                          <span className="peak-val">{activeChartProfile.codeforcesStats.maxRating}</span>
                          <span className="peak-lbl">Max Rating</span>
                        </div>
                      ) : null}
                      
                      {activeChartProfile.bestGlobalRank ? (
                        <div className="peak-stat">
                          <span className="peak-val">#{activeChartProfile.bestGlobalRank}</span>
                          <span className="peak-lbl">Best Global Rank</span>
                        </div>
                      ) : null}
                      
                      {activeChartProfile.submissionStats ? (
                        <div className="peak-stat" style={{ marginTop: '12px' }}>
                          <span className="peak-val" style={{ color: 'var(--color-easy)' }}>
                            {activeChartProfile.submissionStats.acceptanceRate.toFixed(1)}%
                          </span>
                          <span className="peak-lbl">Acceptance Rate</span>
                        </div>
                      ) : null}
                    </div>

                  </div>

                  {/* CF Verdicts Breakdown */}
                  {activePlatform === 'codeforces' && activeChartProfile.codeforcesStats?.verdictCounts && (
                    <div className="analytics-card flex-col" style={{ gridColumn: '1 / -1', alignItems: 'center' }}>
                      <h4>Verdicts (Last 2000)</h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
                        {Object.entries(activeChartProfile.codeforcesStats.verdictCounts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 4)
                          .map(([verdict, count]) => {
                            const vLabel = verdict === 'OK' ? 'AC' : verdict === 'WRONG_ANSWER' ? 'WA' : verdict === 'TIME_LIMIT_EXCEEDED' ? 'TLE' : verdict === 'COMPILATION_ERROR' ? 'CE' : verdict === 'RUNTIME_ERROR' ? 'RE' : verdict;
                            const vColor = verdict === 'OK' ? 'var(--color-easy)' : verdict === 'WRONG_ANSWER' ? 'var(--color-hard)' : 'var(--color-medium)';
                            return (
                              <div key={verdict} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-primary)', padding: '6px 12px', borderRadius: '0px', border: '1px solid var(--border)', minWidth: '60px' }}>
                                <span style={{ fontSize: 'calc(0.8 * var(--font-size-base))', fontWeight: 600, color: vColor }}>{vLabel}</span>
                                <span style={{ fontSize: 'calc(0.75 * var(--font-size-base))', color: 'var(--text-primary)', marginTop: '2px' }}>{count}</span>
                              </div>
                            );
                        })}
                      </div>
                    </div>
                  )}
                </div>                {/* Recent Contests Table */}
                {activeChartProfile.ratingHistory && activeChartProfile.ratingHistory.length > 0 && (
                  <div className="recent-contests-section">
                    <h4>Recent Contests</h4>
                    <div className="contests-list-detailed">
                      {[...activeChartProfile.ratingHistory].reverse().slice(0, 5).map((c, idx) => {
                        const delta = getContestDelta(activeChartProfile, c.timestamp);
                        const contestUrl = activePlatform === 'leetcode'
                          ? `https://leetcode.com/contest/${c.contestId}/`
                          : activePlatform === 'codechef'
                          ? `https://www.codechef.com/${c.contestId}`
                          : `https://codeforces.com/contest/${c.contestId}`;
                        return (
                          <div key={idx} className="contest-row-detailed">
                            <a 
                              href={contestUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="contest-name-col contest-link" 
                              title={c.contestName}
                            >
                              {c.contestName}
                            </a>
                            <div className="contest-stats-col">
                              {c.ranking && <span className="rank-tag">#{c.ranking}</span>}
                              <span className="rating-tag" style={{ color: getPlatformRankColor({ ...activeChartProfile, contestRating: c.rating }) }}>
                                {c.rating}
                              </span>
                              {delta !== 0 && (
                                <span className={`delta-tag ${delta > 0 ? 'pos' : 'neg'}`}>
                                  {delta > 0 ? `+${delta}` : delta}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
          </div>
        )}

        {activeTab === 'submissions' && (
          <div className="submissions-tab-pane">
            {showInfo && (
              <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: '0px', fontSize: 'var(--font-size-base)', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong>ⓘ Recent Submissions Pagination & API Limits</strong>
                  <button onClick={() => setShowInfo(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', fontSize: 'var(--font-size-base)' }}>×</button>
                </div>
                L'Amigo fetches recent problem submissions directly from each platform's public API. Because platforms strictly throttle historical pagination requests, clicking <strong>"Load More"</strong> will incrementally request older batches while safeguarding your connection from rate limits.
              </div>
            )}
            <div className="submission-filters">
              <button 
                className={`filter-btn ${showInfo ? 'active' : ''}`}
                onClick={() => setShowInfo(!showInfo)}
                style={{ padding: '4px 10px', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: showInfo ? '#ffa116' : 'var(--text-secondary)' }}
                title="Click for API Limits Info"
              >
                ⓘ INFO
              </button>
              <button 
                className={`filter-btn ${filterLevel === 'all' ? 'active' : ''}`}
                onClick={() => setFilterLevel('all')}
              >
                All
              </button>
              <button 
                className={`filter-btn easy ${filterLevel === 'Easy' ? 'active' : ''}`}
                onClick={() => setFilterLevel('Easy')}
              >
                Easy
              </button>
              <button 
                className={`filter-btn medium ${filterLevel === 'Medium' ? 'active' : ''}`}
                onClick={() => setFilterLevel('Medium')}
              >
                Medium
              </button>
              <button 
                className={`filter-btn hard ${filterLevel === 'Hard' ? 'active' : ''}`}
                onClick={() => setFilterLevel('Hard')}
              >
                Hard
              </button>
            </div>

            {loadingSubmissions ? (
              <div className="loading-submissions">
                <SkeletonRecItem /><SkeletonRecItem /><SkeletonRecItem /><SkeletonRecItem /><SkeletonRecItem />
              </div>
            ) : (
              <>
                <div className="submissions-feed-list">
                  {(() => {
                  const filtered = deduplicatedPlatformSubmissions.filter(sub => {
                    if (filterLevel === 'all') return true;
                    
                    const subDiff = sub.difficulty?.toLowerCase();
                    const targetDiff = filterLevel.toLowerCase();
                    
                    if (subDiff && subDiff !== 'unknown') {
                      return subDiff === targetDiff;
                    }
                    
                    if (sub.platform === 'codeforces') {
                      const r = sub.rating || 0;
                      if (targetDiff === 'easy') return r > 0 && r < 1300;
                      if (targetDiff === 'medium') return r >= 1300 && r < 1800;
                      if (targetDiff === 'hard') return r >= 1800;
                    }
                    
                    return false;
                  }).slice(0, filterLevel === 'all' ? submissionLimit : undefined);

                  if (filtered.length === 0) {
                    return (
                      <div className="no-submissions-msg">
                        No recent {filterLevel !== 'all' ? filterLevel : ''} submissions found.
                      </div>
                    );
                  }

                    return filtered.map((sub, idx) => {
                    const questionUrl = sub.platform === 'leetcode'
                      ? `https://leetcode.com/problems/${sub.titleSlug}/`
                      : sub.platform === 'codechef'
                      ? `https://www.codechef.com/problems/${sub.titleSlug}`
                      : `https://codeforces.com/contest/${sub.titleSlug.split('/')[0]}/problem/${sub.titleSlug.split('/')[1]}`;
                      
                    let answerUrl: string | undefined = undefined;
                    if (sub.submissionId) {
                      if (sub.platform === 'leetcode') {
                        answerUrl = `https://leetcode.com/submissions/detail/${sub.submissionId}/`;
                      } else if (sub.platform === 'codeforces') {
                        answerUrl = `https://codeforces.com/contest/${sub.titleSlug.split('/')[0]}/submission/${sub.submissionId}`;
                      } else if (sub.platform === 'codechef') {
                        answerUrl = `https://www.codechef.com/viewsolution/${sub.submissionId}`;
                      }
                    }

                    const diffClass = sub.difficulty 
                      ? sub.difficulty.toLowerCase() 
                      : (sub.rating 
                          ? (sub.rating < 1300 ? 'easy' : sub.rating < 1800 ? 'medium' : 'hard')
                          : 'unknown');
                          
                    return (
                      <div key={idx} className={`submission-feed-row compact ${diffClass}`}>
                        <div className="sub-left">
                          <span className={`sub-platform-badge ${sub.platform}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', padding: 0 }}>
                            <PlatformIcon platform={sub.platform || 'leetcode'} size={14} />
                          </span>
                          <span className="sub-title-text" title={sub.title}>
                            {sub.title} {sub.statusDisplay !== 'Accepted' ? <span title="Rejected" style={{ display: 'inline-flex', verticalAlign: 'text-bottom', marginLeft: '4px' }}><X size={12} color="#ff4444" /></span> : null}
                          </span>
                        </div>
                        <div className="sub-right" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {sub.platform === 'leetcode' && sub.difficulty && (
                            <span className={`sub-diff-badge ${sub.difficulty.toLowerCase()}`}>
                              {sub.difficulty}
                            </span>
                          )}
                          {sub.platform === 'codeforces' && sub.rating && (
                            <span className={`sub-diff-badge ${diffClass}`}>
                              {sub.rating}
                            </span>
                          )}
                          <div className="sub-action-links">
                            <a href={questionUrl} target="_blank" rel="noopener noreferrer" className="sub-action-btn" title="Open Question">Q</a>
                            {answerUrl && (
                              <a href={answerUrl} target="_blank" rel="noopener noreferrer" className="sub-action-btn" title="View Submission">A</a>
                            )}
                          </div>
                          <span className="sub-time-text" style={{ minWidth: '45px', textAlign: 'right' }}>{formatTimestamp(sub.timestamp)}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              
              {deduplicatedPlatformSubmissions.length > submissionLimit && filterLevel === 'all' && (
                <button 
                  className="load-more-btn"
                  onClick={() => setSubmissionLimit(prev => prev + (isExpanded ? 150 : 30))}
                  disabled={loadingSubmissions}
                  style={{ width: '100%', padding: '8px', marginTop: '12px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-primary)', borderRadius: '0px', cursor: loadingSubmissions ? 'not-allowed' : 'pointer' }}
                >
                  {loadingSubmissions ? 'Loading...' : 'Load More'}
                </button>
              )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
