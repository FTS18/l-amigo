import React, { useState } from 'react';
import { RefreshCw, MoreVertical, ChevronUp, X } from 'lucide-react';
import { Friend, FriendProfile, Platform, RecentSubmission } from '../types';
import { StreakCalculator } from '../services/streak';
import { SkeletonList } from './Skeleton';

const getProfileQualityHue = (p: FriendProfile) => {
  const { easy, medium, hard, total } = p.problemsSolved;
  if (total === 0) return 0;
  const pMed = medium / total;
  const pHard = hard / total;
  const relativeHardness = (pMed * 0.5) + (pHard * 2.0);
  const hardnessFactor = Math.min(Math.pow(relativeHardness, 0.4), 1);
  return (1 - hardnessFactor) * 120;
};

export const getProfileQualityColor = (p: FriendProfile, isDarkMode: boolean = true) => {
  if (p.problemsSolved.total === 0) return isDarkMode ? 'var(--border-strong)' : 'var(--bg-secondary)';
  const hue = getProfileQualityHue(p);
  return isDarkMode ? `hsl(${hue}, 85%, 45%)` : `hsl(${hue}, 90%, 34%)`;
};

export const getProfileQualityBorderColor = (p: FriendProfile, isDarkMode: boolean = true) => {
  return 'transparent';
};

export const getProfileQualityTextColor = (p: FriendProfile, isDarkMode: boolean = true) => {
  return '#ffffff';
};

export const getPlatformRankColor = (profile: any): string => {
  if (!profile) return 'inherit';
  const rating = profile.contestRating || 0;
  
  // LeetCode Official Colors
  if (profile.platform === 'leetcode') {
    if (rating >= 2150) return 'var(--rank-leetcode-guardian)'; // Guardian Gold
    if (rating >= 1850) return 'var(--rank-leetcode-knight)'; // Knight Silver/Blue
    return 'var(--rank-leetcode-default)'; // Default Gray
  }

  if (profile.platform === 'codechef') {
    const stars = Math.max(1, Math.min(7, Math.floor(((rating || 0) - 1200) / 200) + 1));
    if (stars === 7) return '#D0011B';
    if (stars === 6) return '#FF7F00';
    if (stars === 5) return '#FFD819';
    if (stars === 4) return '#684273';
    if (stars === 3) return '#3366CC';
    if (stars === 2) return '#1E7D22';
    return '#666666';
  }
  
  // Codeforces Official Colors
  if (rating >= 3000) return 'var(--rank-codeforces-legendary-grandmaster)'; // LGM Deep Red
  if (rating >= 2600) return 'var(--rank-codeforces-international-grandmaster)'; // IGM Red
  if (rating >= 2400) return 'var(--rank-codeforces-grandmaster)'; // GM Bright Red
  if (rating >= 2300) return 'var(--rank-codeforces-master)'; // IM Orange
  if (rating >= 2100) return 'var(--rank-codeforces-master)'; // Master Orange
  if (rating >= 1900) return 'var(--rank-codeforces-candidate-master)'; // CM Violet
  if (rating >= 1600) return 'var(--rank-codeforces-expert)'; // Expert Blue
  if (rating >= 1400) return 'var(--rank-codeforces-specialist)'; // Specialist Cyan
  if (rating >= 1200) return 'var(--rank-codeforces-pupil)'; // Pupil Green
  return 'var(--rank-codeforces-newbie)'; // Newbie Gray
};

export const getPlatformRankLabel = (p: FriendProfile) => {
  if (p.platform === 'codeforces' && p.codeforcesStats) {
    const rawLabel = p.codeforcesStats.rankLabel.toLowerCase();
    const acronymMap: Record<string, string> = {
      'legendary grandmaster': 'LGM',
      'international grandmaster': 'IGM',
      'grandmaster': 'GM',
      'international master': 'IM',
      'candidate master': 'CM',
    };
    if (acronymMap[rawLabel]) return acronymMap[rawLabel];
    // Capitalize each word for remaining ranks (e.g. "expert" -> "Expert")
    return rawLabel.replace(/\b\w/g, l => l.toUpperCase());
  }
  if (p.platform === 'leetcode') {
    const r = p.contestRating || 0;
    if (r >= 2150) return 'Guardian';
    if (r >= 1850) return 'Knight';
  }
  if (p.platform === 'codechef') {
    const stars = Math.max(1, Math.min(7, Math.floor(((p.contestRating || 0) - 1200) / 200) + 1));
    return p.contestRating ? `${stars}★` : null;
  }
  return null;
};

const formatTimestamp = (timestamp: number) => {
  const ms = timestamp < 1000000000000 ? timestamp * 1000 : timestamp;
  const diff = Date.now() - ms;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

interface FriendCardProps {
  friend: Friend;
  profile?: FriendProfile;
  leetcodeProfile?: FriendProfile;
  codeforcesProfile?: FriendProfile;
  codechefProfile?: FriendProfile;
  onRemove: () => void;
  onEdit?: (friend: Friend) => void;
  onRefresh?: (friend: Friend) => Promise<void>;
  onViewProfile?: (platform: Platform, filter?: 'all' | 'Easy' | 'Medium' | 'Hard') => void;
  refreshing?: boolean;
  isDarkMode?: boolean;
  isOwn?: boolean;
}

export const FriendCard: React.FC<FriendCardProps> = ({ 
  friend, 
  profile, 
  leetcodeProfile, 
  codeforcesProfile, 
  codechefProfile,
  onRemove, 
  onEdit, 
  onRefresh, 
  onViewProfile,
  refreshing, 
  isDarkMode, 
  isOwn 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!profile) {
    return (
      <div className="compact-premium loading-card" style={{ opacity: 0.6, cursor: 'default' }}>
        <div className="user-header-compact">
          <div className="avatar-placeholder" style={{ borderRadius: '0' }} />
          <div className="user-identity-box">
            <span className="display-name-text">{friend.displayName || friend.username}</span>
            <div style={{ width: '80px', height: '10px', background: 'var(--border)', marginTop: '4px', borderRadius: '2px', animation: 'shimmer 1.5s infinite' }} />
          </div>
        </div>
        <div className="stats-grid-compact" style={{ marginTop: '8px' }}>
          <div className="stats-strip" style={{ height: '32px', background: 'var(--border-light)' }} />
        </div>
      </div>
    );
  }

  const linkedAccounts = friend.accounts?.length ? friend.accounts : [{ platform: profile.platform, handle: friend.username }];
  const lc = leetcodeProfile || (profile.platform === 'leetcode' ? profile : undefined);
  const cf = codeforcesProfile || (profile.platform === 'codeforces' ? profile : undefined);
  const cc = codechefProfile || (profile.platform === 'codechef' ? profile : undefined);

  const [localActivePlatform, setLocalActivePlatform] = useState<Platform>(
    lc ? 'leetcode' : cf ? 'codeforces' : 'codechef'
  );

  const activeProfile = localActivePlatform === 'codeforces' ? (cf || profile) : localActivePlatform === 'codechef' ? (cc || profile) : (lc || profile);
  const streak = StreakCalculator.calculateStreak(activeProfile);

  const allSubmissions: RecentSubmission[] = [];
  if (lc && lc.recentSubmissions) {
    allSubmissions.push(...lc.recentSubmissions.map(sub => ({ ...sub, platform: 'leetcode' as Platform })));
  }
  if (cf && cf.recentSubmissions) {
    allSubmissions.push(...cf.recentSubmissions.map(sub => ({ ...sub, platform: 'codeforces' as Platform })));
  }
  if (cc && cc.recentSubmissions) {
    allSubmissions.push(...cc.recentSubmissions.map(sub => ({ ...sub, platform: 'codechef' as Platform })));
  }
  const deduplicated = new Map<string, RecentSubmission>();
  for (const sub of allSubmissions.sort((a, b) => b.timestamp - a.timestamp)) {
    const key = `${sub.platform}-${sub.titleSlug}`;
    if (!deduplicated.has(key)) {
      deduplicated.set(key, sub);
    }
  }
  const sortedSubmissions = Array.from(deduplicated.values()).slice(0, 10);

  const handleCardClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('.friend-menu-wrap') || 
      (e.target as HTMLElement).closest('.mini-action-btn') || 
      (e.target as HTMLElement).closest('.platform-tag-pill') ||
      (e.target as HTMLElement).closest('.recent-submissions-compact')
    ) {
      return;
    }
    onViewProfile?.(localActivePlatform, 'all');
  };

  return (
    <div 
      className={`friend-card compact-premium clickable-card ${isOwn ? 'own-profile-card' : ''}`}
      onClick={handleCardClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="card-main-row">
        <div className="card-left-section">
          <div className="user-header-compact">
            {activeProfile.avatar ? (
              <img src={activeProfile.avatar} alt={friend.displayName} className="avatar-mini" />
            ) : (
              <div className="avatar-placeholder">{friend.displayName?.[0] || friend.username[0]}</div>
            )}

            <div className="user-identity-box">
              <div className="name-streak-row">
                <span className="display-name-text">
                  {friend.displayName || friend.username}
                </span>
                {streak.currentStreak > 0 && (
                  <span className="mini-streak" title="Current Streak">{streak.currentStreak}</span>
                )}
              </div>
              
              <div className="platform-tags-row">
                {linkedAccounts.map((account) => {
                  const accProfile = account.platform === 'leetcode' ? lc : account.platform === 'codechef' ? cc : cf;
                  const hasContest = accProfile && accProfile.contestCount !== 0;
                  const rating = accProfile?.contestRating && hasContest ? Math.round(accProfile.contestRating) : null;
                  const label = accProfile && hasContest ? getPlatformRankLabel(accProfile) : null;
                  const color = accProfile ? getPlatformRankColor(accProfile) : 'var(--bg-tertiary)';
                  const isActive = localActivePlatform === account.platform;

                  return (
                    <div 
                      key={account.platform} 
                      className={`platform-tag-pill ${isActive ? 'active-tag' : 'inactive-tag'}`} 
                      style={{ 
                        backgroundColor: isActive ? (color === 'inherit' ? 'var(--bg-tertiary)' : color) : 'var(--bg-pill-inactive)',
                        borderColor: isActive ? 'var(--border-pill-active)' : 'transparent'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocalActivePlatform(account.platform || 'leetcode');
                      }}
                    >
                      <span className="tag-platform-name">
                        {account.platform === 'leetcode' ? 'LC' : account.platform === 'codechef' ? 'CC' : 'CF'}
                      </span>
                      {rating && (
                        <span className="tag-rating-val">{rating}</span>
                      )}
                      {label && (
                        <span className="tag-rank-label">{label}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="card-right-section hover-actions">
          {onRefresh && (
            <button 
              className="mini-action-btn" 
              onClick={(e) => {
                e.stopPropagation();
                onRefresh(friend);
              }}
              disabled={refreshing}
              title="Refresh"
            >
              {refreshing ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />}
            </button>
          )}
          <div className="friend-menu-wrap">
            <button
              className="mini-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((s) => !s);
              }}
            >
              <MoreVertical size={14} />
            </button>
            {showMenu && (
              <div className="friend-menu-dropdown-mini">
                <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit?.(friend); }}>
                  Edit
                </button>
                {!isOwn && (
                  <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); onRemove(); }} className="danger-text">
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="stats-grid-compact">
        <div className="stats-strip profile-stats-strip">
          <div 
            className="stats-item total-item" 
            style={{ 
              backgroundColor: `color-mix(in srgb, ${getProfileQualityColor(activeProfile, !!isDarkMode)} 15%, transparent)`,
              borderColor: `color-mix(in srgb, ${getProfileQualityColor(activeProfile, !!isDarkMode)} 40%, transparent)`,
              color: getProfileQualityColor(activeProfile, !!isDarkMode)
            }}
            title="Total Solved (Color based on Difficulty Balance)"
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile?.(localActivePlatform, 'all');
            }}
          >
            <span className="stats-val" style={{ color: getProfileQualityColor(activeProfile, !!isDarkMode) }}>
              {activeProfile.problemsSolved.total}
            </span>
            <span className="stats-lbl" style={{ color: getProfileQualityColor(activeProfile, !!isDarkMode) }}>
              Total
            </span>
          </div>

          <div 
            className="stats-item easy-box-item easy-box"
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile?.(localActivePlatform, 'Easy');
            }}
          >
            <span className="stats-val">{activeProfile.problemsSolved.easy}</span>
            <span className="stats-lbl">Easy</span>
          </div>
          <div 
            className="stats-item med-box-item med-box"
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile?.(localActivePlatform, 'Medium');
            }}
          >
            <span className="stats-val">{activeProfile.problemsSolved.medium}</span>
            <span className="stats-lbl">Med</span>
          </div>
          <div 
            className="stats-item hard-box-item hard-box"
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile?.(localActivePlatform, 'Hard');
            }}
          >
            <span className="stats-val">{activeProfile.problemsSolved.hard}</span>
            <span className="stats-lbl">Hard</span>
          </div>
        </div>
      </div>

      {sortedSubmissions.length > 0 && (
        <div className="recent-submissions-compact" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button"
            className="submissions-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <span>Recent Solves</span>
            <span className="toggle-arrow">{expanded ? <ChevronUp size={12} /> : ''}</span>
          </button>
          {expanded && (
            <ul className="submissions-list">
              {sortedSubmissions.map((sub, index) => {
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

                return (
                  <li key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                      <span className={`sub-platform-badge ${sub.platform}`} style={{ 
                        fontSize: '8px', 
                        padding: '1px 3px', 
                        fontWeight: 'bold',
                        color: sub.platform === 'leetcode' ? 'var(--accent-leetcode-primary)' : sub.platform === 'codechef' ? 'var(--accent-codechef-primary, #5B4638)' : 'var(--text-secondary)',
                        border: `1px solid ${sub.platform === 'leetcode' ? 'var(--accent-leetcode-primary)' : sub.platform === 'codechef' ? 'var(--accent-codechef-primary, #5B4638)' : 'var(--border-strong)'}`,
                        backgroundColor: 'transparent',
                        textTransform: 'uppercase' as const
                      }}>
                        {sub.platform === 'leetcode' ? 'LC' : sub.platform === 'codechef' ? 'CC' : 'CF'}
                      </span>
                      <span 
                        title={sub.title}
                        className="sub-link"
                        style={{ 
                          textOverflow: 'ellipsis', 
                          overflow: 'hidden', 
                          whiteSpace: 'nowrap',
                          color: 'inherit'
                        }}
                      >
                        {sub.title} {sub.statusDisplay !== 'Accepted' ? <span title="Rejected" style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: '4px' }}><X size={10} color="#ff4444" /></span> : null}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {sub.platform === 'leetcode' && sub.difficulty && (
                        <span className={`sub-diff-badge ${sub.difficulty.toLowerCase()}`} style={{ fontSize: '9px' }}>
                          {sub.difficulty}
                        </span>
                      )}
                      {sub.platform === 'codeforces' && sub.rating && (
                        <span className="sub-rating-badge" style={{ fontSize: '9px' }}>
                          {sub.rating}
                        </span>
                      )}
                      <div className="sub-action-links" style={{ transform: 'scale(0.85)' }}>
                        <a href={questionUrl} target="_blank" rel="noopener noreferrer" className="sub-action-btn" title="Open Question">Q</a>
                        {answerUrl && (
                          <a href={answerUrl} target="_blank" rel="noopener noreferrer" className="sub-action-btn" title="View Submission">A</a>
                        )}
                      </div>
                      <span style={{ color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'right' }}>
                        {formatTimestamp(sub.timestamp)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};


