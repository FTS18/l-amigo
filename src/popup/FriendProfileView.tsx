import React, { useState, useEffect } from 'react';
import { Friend, FriendProfile, RecentSubmission, Platform } from '../types';
import { X } from 'lucide-react';
import { StreakCalculator } from '../services/streak';
import { LeetCodeService } from '../services/leetcode';
import { CodeforcesService } from '../services/codeforces';
import { CodeChefService } from '../services/codechef';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { getPlatformRankColor, getPlatformRankLabel, getProfileQualityColor, getProfileQualityBorderColor, getProfileQualityTextColor } from './FriendCard';
import { SkeletonList, SkeletonRecItem } from './Skeleton';

interface FriendProfileViewProps {
  friend: Friend;
  leetcodeProfile?: FriendProfile;
  codeforcesProfile?: FriendProfile;
  codechefProfile?: FriendProfile;
  isDarkMode?: boolean;
  onBack: () => void;
  initialFilter?: 'all' | 'Easy' | 'Medium' | 'Hard';
  initialPlatform?: Platform;
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
  const data = sortedHistory.map(h => ({
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
                <stop offset="5%" stopColor={themeColor} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={themeColor} stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              stroke={labelColor} 
              fontSize={9} 
              tickLine={false} 
              axisLine={false}
              dy={6}
              interval={Math.max(0, Math.floor(data.length / 6))}
            />
            <YAxis 
              stroke={labelColor} 
              fontSize={9} 
              tickLine={false} 
              axisLine={false}
              domain={['dataMin - 100', 'dataMax + 100']}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: themeColor,
                borderRadius: '0px',
                fontSize: '11px',
                padding: '8px 12px',
                boxShadow: 'none',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)'
              }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-primary)' }}
              formatter={(value: any, name: any, props: any) => {
                const rank = props.payload.rank;
                const pointColor = getPlatformRankColor({ ...activeProfile, contestRating: value });
                return [
                  <div key="details">
                    <div>Rating: <span style={{ fontWeight: 'bold', color: pointColor }}>{value}</span></div>
                    {rank ? <div>Rank: <span style={{ fontWeight: 'bold' }}>#{rank}</span></div> : null}
                  </div>,
                  ''
                ];
              }}
            />
            <Area 
              type="monotone" 
              dataKey="rating" 
              stroke={themeColor} 
              strokeWidth={2} 
              fillOpacity={0.4} 
              fill={`url(#colorRating-${platform})`} 
              isAnimationActive={false}
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
  initialPlatform
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions'>('overview');
  const [activePlatform, setActivePlatform] = useState<Platform>(
    initialPlatform || (leetcodeProfile ? 'leetcode' : codeforcesProfile ? 'codeforces' : 'codechef')
  );
  const [filterLevel, setFilterLevel] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>(initialFilter);
  const [submissions, setSubmissions] = useState<RecentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionLimit, setSubmissionLimit] = useState(30);

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
    const fetchSubmissions = async () => {
      const cacheKey = `lamigo:subcache:${leetcodeProfile?.username || ''}:${codeforcesProfile?.username || ''}:${codechefProfile?.username || ''}`;
      
      if (submissionLimit === 30) {
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
          promises.push(CodeforcesService.getRecentSubmissions(codeforcesProfile.username, Math.floor(submissionLimit * 1.5)));
        }
        // codechef doesn't currently support getRecentSubmissions
        const results = await Promise.all(promises);
        const combined = results.flat().sort((a, b) => b.timestamp - a.timestamp);
        
        setSubmissions(combined);
        if (submissionLimit === 30) {
          chrome.storage.local.set({ [cacheKey]: combined });
        }
      } catch (err) {
        console.error('Failed to fetch profile submissions:', err);
      } finally {
        setLoadingSubmissions(false);
      }
    };

    fetchSubmissions();
  }, [leetcodeProfile, codeforcesProfile, codechefProfile, submissionLimit]);

  const activeChartProfile = activePlatform === 'leetcode' ? leetcodeProfile : activePlatform === 'codechef' ? codechefProfile : codeforcesProfile;
  const platformSubmissions = submissions.filter(sub => sub.platform === activePlatform);
  const hasOverviewData = !!(activeChartProfile?.ratingHistory && activeChartProfile.ratingHistory.length > 0);

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
      <div className="profile-hero">
        <div className="profile-hero-top">
          <button className="back-button-arrow" onClick={onBack}>← Back</button>

          {activeChartProfile ? (
            <div className="profile-hero-identity">
              <img
                className="profile-avatar-small"
                src={activeChartProfile.avatar || 'default-avatar.png'}
                alt={friend.displayName || activeChartProfile.username}
                onError={(e) => { (e.target as HTMLImageElement).src = 'default-avatar.png'; }}
              />
              <div className="profile-hero-names">
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
                <span className="profile-header-handle-text">@{activeChartProfile.username}</span>
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
                >LC</button>
              )}
              {codeforcesProfile && (
                <button
                  className={`platform-selector-btn cf ${activePlatform === 'codeforces' ? 'active' : ''}`}
                  onClick={() => setActivePlatform('codeforces')}
                >CF</button>
              )}
              {codechefProfile && (
                <button
                  className={`platform-selector-btn cc ${activePlatform === 'codechef' ? 'active' : ''}`}
                  onClick={() => setActivePlatform('codechef')}
                >CC</button>
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
                  borderColor: lcRankColor,
                  background: `linear-gradient(135deg, ${lcRankColor}1a, ${lcRankColor}05)`
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
                  backgroundColor: getProfileQualityColor(leetcodeProfile, isDarkMode),
                  borderColor: getProfileQualityBorderColor(leetcodeProfile, isDarkMode),
                  color: getProfileQualityTextColor(leetcodeProfile, isDarkMode)
                }}
                onClick={() => { setActiveTab('submissions'); setFilterLevel('all'); }}
                title="Click to view all submissions"
              >
                <span className="count" style={{ color: getProfileQualityTextColor(leetcodeProfile, isDarkMode) }}>{leetcodeProfile.problemsSolved.total}</span>
                <span className="lbl" style={{ color: getProfileQualityTextColor(leetcodeProfile, isDarkMode) }}>Total</span>
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

          <div className="bottom-meta-row">
            <span 
              className="streak-tag" 
              style={{ 
                borderColor: `${lcRankColor}40`, 
                color: lcRankColor, 
                backgroundColor: `${lcRankColor}0d` 
              }}
              onClick={openExternalProfile}
              title="View profile on LeetCode"
            >
               {StreakCalculator.calculateStreak(leetcodeProfile).currentStreak} Day Streak
            </span>
            {leetcodeProfile.contestCount && (
              <span 
                className="contest-tag" 
                style={{ 
                  borderColor: `${lcRankColor}40`, 
                  color: lcRankColor, 
                  backgroundColor: `${lcRankColor}0d` 
                }}
                onClick={openExternalProfile}
                title="View profile on LeetCode"
              >
                {leetcodeProfile.contestCount} Contests
              </span>
            )}
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
                  borderColor: cfRankColor,
                  background: `linear-gradient(135deg, ${cfRankColor}1a, ${cfRankColor}05)`
                }}
                onClick={() => setActiveTab('overview')}
                title="Click to view rating chart"
              >
                <span className="value" style={{ color: cfRankColor }}>
                  {Math.round(codeforcesProfile.contestRating)}
                  {codeforcesProfile.codeforcesStats?.ratingDelta !== undefined && codeforcesProfile.codeforcesStats.ratingDelta !== 0 && (
                    <span className={`delta ${codeforcesProfile.codeforcesStats.ratingDelta > 0 ? 'pos' : 'neg'}`}>
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
                  backgroundColor: getProfileQualityColor(codeforcesProfile, isDarkMode),
                  borderColor: getProfileQualityBorderColor(codeforcesProfile, isDarkMode),
                  color: getProfileQualityTextColor(codeforcesProfile, isDarkMode)
                }}
                onClick={() => { setActiveTab('submissions'); setFilterLevel('all'); }}
                title="Click to view all submissions"
              >
                <span className="count" style={{ color: getProfileQualityTextColor(codeforcesProfile, isDarkMode) }}>{codeforcesProfile.problemsSolved.total}</span>
                <span className="lbl" style={{ color: getProfileQualityTextColor(codeforcesProfile, isDarkMode) }}>Total</span>
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
            <span 
              className="streak-tag" 
              style={{ 
                borderColor: `${cfRankColor}40`, 
                color: cfRankColor, 
                backgroundColor: `${cfRankColor}0d` 
              }}
              onClick={openExternalProfile}
              title="View profile on Codeforces"
            >
               {StreakCalculator.calculateStreak(codeforcesProfile).currentStreak} Day Streak
            </span>
            {codeforcesProfile.contestCount && (
              <span 
                className="contest-tag" 
                style={{ 
                  borderColor: `${cfRankColor}40`, 
                  color: cfRankColor, 
                  backgroundColor: `${cfRankColor}0d` 
                }}
                onClick={openExternalProfile}
                title="View profile on Codeforces"
              >
                {codeforcesProfile.contestCount} Contests
              </span>
            )}
            {codeforcesProfile.codeforcesStats?.divisionCounts && (
              <div className="cf-divisions-row">
                {codeforcesProfile.codeforcesStats.divisionCounts.div1 > 0 && <span className="div-tag div1" onClick={openExternalProfile} title="View profile on Codeforces">D1: {codeforcesProfile.codeforcesStats.divisionCounts.div1}</span>}
                {codeforcesProfile.codeforcesStats.divisionCounts.div2 > 0 && <span className="div-tag div2" onClick={openExternalProfile} title="View profile on Codeforces">D2: {codeforcesProfile.codeforcesStats.divisionCounts.div2}</span>}
                {codeforcesProfile.codeforcesStats.divisionCounts.div3 > 0 && <span className="div-tag div3" onClick={openExternalProfile} title="View profile on Codeforces">D3: {codeforcesProfile.codeforcesStats.divisionCounts.div3}</span>}
                {codeforcesProfile.codeforcesStats.divisionCounts.div4 > 0 && <span className="div-tag div4" onClick={openExternalProfile} title="View profile on Codeforces">D4: {codeforcesProfile.codeforcesStats.divisionCounts.div4}</span>}
              </div>
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
                  borderColor: ccRankColor,
                  background: `linear-gradient(135deg, ${ccRankColor}1a, ${ccRankColor}05)`
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

          <div className="bottom-meta-row-cf">
            {codechefProfile.contestCount && (
              <span 
                className="contest-tag" 
                style={{ 
                  borderColor: `${ccRankColor}40`, 
                  color: ccRankColor, 
                  backgroundColor: `${ccRankColor}0d` 
                }}
                onClick={openExternalProfile}
                title="View profile on CodeChef"
              >
                {codechefProfile.contestCount} Contests
              </span>
            )}
            {codechefProfile.contributionPoints && (
              <span className="div-tag div3" onClick={openExternalProfile} title="View profile on Codechef">Max Rating: {codechefProfile.contributionPoints}</span>
            )}
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
          Submissions Feed {platformSubmissions.length > 0 && `(${platformSubmissions.length})`}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="profile-tab-content">
        {activeTab === 'overview' && activeChartProfile && (
          <div className="overview-tab-pane">
            {activeChartProfile.ratingHistory && activeChartProfile.ratingHistory.length > 0 && (
              <>
                <RatingChart 
                  history={activeChartProfile.ratingHistory || []} 
                  platform={activePlatform} 
                  isDarkMode={isDarkMode}
                  activeProfile={activeChartProfile}
                />

                {/* Recent Contests Table */}
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
              </>
            )}
          </div>
        )}

        {activeTab === 'submissions' && (
          <div className="submissions-tab-pane">
            <div className="submission-filters">
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
                  const deduplicated = new Map<string, RecentSubmission>();
                  for (const sub of platformSubmissions.sort((a, b) => b.timestamp - a.timestamp)) {
                    const key = `${sub.platform}-${sub.titleSlug}`;
                    if (!deduplicated.has(key)) deduplicated.set(key, sub);
                  }

                  const filtered = Array.from(deduplicated.values()).filter(sub => {
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
                  }).slice(0, 30);

                  if (filtered.length === 0) {
                    return (
                      <div className="no-submissions-msg">
                        No recent {filterLevel !== 'all' ? filterLevel : ''} submissions found.
                      </div>
                    );
                  }

                  return filtered.map((sub, idx) => {
                    const url = sub.platform === 'leetcode'
                      ? `https://leetcode.com/problems/${sub.titleSlug}/`
                      : sub.platform === 'codechef'
                      ? `https://www.codechef.com/problems/${sub.titleSlug}`
                      : `https://codeforces.com/problemset/problem/${sub.titleSlug}`;
                    const diffClass = sub.difficulty 
                      ? sub.difficulty.toLowerCase() 
                      : (sub.rating 
                          ? (sub.rating < 1300 ? 'easy' : sub.rating < 1800 ? 'medium' : 'hard')
                          : 'unknown');
                    return (
                      <div key={idx} className={`submission-feed-row compact ${diffClass}`}>
                        <div className="sub-left">
                          <span className="sub-diff-dot" />
                          <span className={`sub-platform-badge ${sub.platform}`}>
                            {sub.platform === 'leetcode' ? 'LC' : sub.platform === 'codechef' ? 'CC' : 'CF'}
                          </span>
                          <a 
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sub-title-text sub-link" 
                            title={sub.title}
                          >
                            {sub.title} {sub.statusDisplay !== 'Accepted' ? <span title="Rejected" style={{ display: 'inline-flex', verticalAlign: 'text-bottom', marginLeft: '4px' }}><X size={12} color="#ff4444" /></span> : null}
                          </a>
                        </div>
                        <div className="sub-right">
                          <span className="sub-time-text">{formatTimestamp(sub.timestamp)}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              
              {platformSubmissions.length > 0 && filterLevel === 'all' && (
                <button 
                  className="load-more-btn"
                  onClick={() => setSubmissionLimit(prev => prev + 30)}
                  disabled={loadingSubmissions}
                  style={{ width: '100%', padding: '8px', marginTop: '12px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-primary)', borderRadius: '4px', cursor: loadingSubmissions ? 'not-allowed' : 'pointer' }}
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
