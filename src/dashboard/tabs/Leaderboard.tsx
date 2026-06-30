import React, { useState, useMemo, useEffect } from 'react';
import { FriendProfile, Friend } from '../../types';
import { LeetCodeIcon, CodeforcesIcon, CodeChefIcon } from '../../utils/PlatformIcons';

interface Props {
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  selectedGlobalPlatforms?: string[];
}

export const Leaderboard: React.FC<Props> = ({ friends, profiles, selectedGlobalPlatforms = ['leetcode', 'codeforces', 'codechef'] }) => {
  const ss = <T,>(key: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(`lb_${key}`);
      if (v !== null) return JSON.parse(v) as T;
    } catch { /* ignore */ }
    return fallback;
  };
  const setSS = <T,>(key: string, value: T) => {
    try { localStorage.setItem(`lb_${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  };

  const [rankingMode, _setRankingMode] = useState<'power' | 'mastery' | 'solves'>(() => ss('rankingMode', 'power'));
  const setRankingMode = (v: 'power' | 'mastery' | 'solves') => { setSS('rankingMode', v); _setRankingMode(v); };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lb_rankingMode' && e.newValue) {
        try { _setRankingMode(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  const [dismissedNotice, setDismissedNotice] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['dismissed_leaderboard_info'], (res) => {
      if (res.dismissed_leaderboard_info) setDismissedNotice(true);
    });
  }, []);

  const getProfile = (f: Friend, platform: 'leetcode'|'codeforces'|'codechef') => {
    const handle = f.accounts?.find(acc => acc.platform === platform)?.handle || (profiles[f.username.toLowerCase()]?.platform === platform ? f.username : undefined);
    if (!handle) return undefined;
    return profiles[`${platform}:${handle.toLowerCase()}`] || profiles[handle.toLowerCase()];
  };

  const rankedFriends = useMemo(() => {
    return [...friends].filter(f => {
      const isOwn = f.id === 'own-user';
      if (isOwn) {
        return selectedGlobalPlatforms.some(platform => {
          const p = profiles[`${platform}:${f.username.toLowerCase()}`] || Object.values(profiles).find(pr => pr.username === f.username && pr.platform === platform);
          return !!p;
        });
      }
      return selectedGlobalPlatforms.some(platform => {
        const acc = f.accounts?.find(a => a.platform === platform)?.handle || (profiles[f.username.toLowerCase()]?.platform === platform ? f.username : undefined);
        return !!acc;
      });
    }).map(f => {
      const lc = selectedGlobalPlatforms.includes('leetcode') ? getProfile(f, 'leetcode') : undefined;
      const cf = selectedGlobalPlatforms.includes('codeforces') ? getProfile(f, 'codeforces') : undefined;
      const cc = selectedGlobalPlatforms.includes('codechef') ? getProfile(f, 'codechef') : undefined;
      
      const totalSolved = (lc?.problemsSolved.total || 0) + (cf?.problemsSolved.total || 0) + (cc?.problemsSolved.total || 0);
      
      // Calculate weighted solves bonus: Easy = 1, Med = 3, Hard = 6
      const lcBonus = (lc?.problemsSolved.easy || 0) * 1 + (lc?.problemsSolved.medium || 0) * 3 + (lc?.problemsSolved.hard || 0) * 6;
      const cfBonus = (cf?.problemsSolved.easy || 0) * 1 + (cf?.problemsSolved.medium || 0) * 3 + (cf?.problemsSolved.hard || 0) * 6;
      const ccBonus = (cc?.problemsSolved.easy || 0) * 1 + (cc?.problemsSolved.medium || 0) * 3 + (cc?.problemsSolved.hard || 0) * 6;
      const solvesBonus = lcBonus + cfBonus + ccBonus;

      // Peak Normalized Rating: Codeforces ratings are compressed, so we normalize them (CF * 1.25)
      const lcRating = lc?.contestRating || 0;
      const cfRating = cf?.contestRating || 0;
      const ccRating = cc?.contestRating || 0;
      const normCF = cfRating > 0 ? cfRating * 1.25 : 0;
      const peakRating = Math.max(lcRating, normCF, ccRating);

      const powerScore = Math.round(peakRating + solvesBonus);
      const peakNormalizedRating = Math.round(peakRating);

      const lcHandle = f.id === 'own-user' ? f.username : f.accounts?.find(a => a.platform === 'leetcode')?.handle || f.username;
      const cfHandle = f.id === 'own-user' ? f.username : f.accounts?.find(a => a.platform === 'codeforces')?.handle || f.username;
      const ccHandle = f.id === 'own-user' ? f.username : f.accounts?.find(a => a.platform === 'codechef')?.handle || f.username;

      return {
        friend: f,
        lcRating,
        cfRating,
        ccRating,
        totalSolved,
        powerScore,
        peakNormalizedRating,
        lcHandle,
        cfHandle,
        ccHandle
      };
    }).sort((a, b) => {
      if (rankingMode === 'power') return b.powerScore - a.powerScore;
      if (rankingMode === 'mastery') return b.peakNormalizedRating !== a.peakNormalizedRating ? b.peakNormalizedRating - a.peakNormalizedRating : b.totalSolved - a.totalSolved;
      return b.totalSolved - a.totalSolved;
    });
  }, [friends, profiles, rankingMode, selectedGlobalPlatforms]);

  return (
    <div>
      <div className="tab-header">
        <h2>Global Leaderboard</h2>
        <p>
          {rankingMode === 'power' && "Sorted by L'Amigo Power Score (Peak Normalized Rating + Difficulty-Weighted Solves)."}
          {rankingMode === 'mastery' && "Sorted strictly by Peak Normalized Contest Rating across LeetCode, Codeforces, and CodeChef."}
          {rankingMode === 'solves' && "Sorted by total raw problems solved across all platforms."}
        </p>
      </div>

      {!dismissedNotice && (
        <div style={{ marginBottom: '24px', padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: '0px', fontSize: 'var(--font-size-base)', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <strong>ⓘ Cross-Platform Normalization & Power Score</strong>
            <button onClick={() => { setDismissedNotice(true); chrome.storage.local.set({ dismissed_leaderboard_info: true }); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', fontSize: 'var(--font-size-base)' }}>×</button>
          </div>
          Because Codeforces ratings are structurally deflated compared to LeetCode, L'Amigo applies a <code>1.25x</code> normalization multiplier to Codeforces ratings for fair side-by-side comparison. The <strong>Power Score</strong> is a custom metric combining your total problems solved across all platforms with your highest normalized contest rating.
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setRankingMode('power')}
          style={{
            padding: '10px 20px',
            backgroundColor: rankingMode === 'power' ? 'rgba(255, 161, 22, 0.15)' : 'var(--bg-secondary)',
            borderColor: rankingMode === 'power' ? '#ffa116' : 'var(--border-strong)',
            borderWidth: '1px',
            borderStyle: 'solid',
            color: rankingMode === 'power' ? '#ffa116' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 'var(--font-size-title)',
            cursor: 'pointer',
            borderRadius: '0px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          L'Amigo Power Score
        </button>
        <button
          onClick={() => setRankingMode('mastery')}
          style={{
            padding: '10px 20px',
            backgroundColor: rankingMode === 'mastery' ? 'rgba(0, 184, 163, 0.15)' : 'var(--bg-secondary)',
            borderColor: rankingMode === 'mastery' ? '#00b8a3' : 'var(--border-strong)',
            borderWidth: '1px',
            borderStyle: 'solid',
            color: rankingMode === 'mastery' ? '#00b8a3' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 'var(--font-size-title)',
            cursor: 'pointer',
            borderRadius: '0px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          Peak Mastery
        </button>
        <button
          onClick={() => setRankingMode('solves')}
          style={{
            padding: '10px 20px',
            backgroundColor: rankingMode === 'solves' ? 'rgba(255, 55, 95, 0.15)' : 'var(--bg-secondary)',
            borderColor: rankingMode === 'solves' ? '#ff375f' : 'var(--border-strong)',
            borderWidth: '1px',
            borderStyle: 'solid',
            color: rankingMode === 'solves' ? '#ff375f' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 'var(--font-size-title)',
            cursor: 'pointer',
            borderRadius: '0px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          Total Solved
        </button>
      </div>

      <div className="sheets-container" style={{ marginBottom: '40px' }}>
        <table className="sheets-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Power Score</span>
                  <span title="Composite score balancing total problems solved, difficulty multiplier, and competitive rating tiers." style={{ cursor: 'help', opacity: 0.7 }}>ⓘ</span>
                </div>
              </th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Total Solved</span>
                  <span title="Sum of raw problems solved across active platform filters." style={{ cursor: 'help', opacity: 0.7 }}>(i)</span>
                </div>
              </th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LeetCodeIcon size={16} />
                  <span>LC Rating</span>
                  <span title="LeetCode Official Contest Rating (e.g. Guardian ≥ 2150, Knight ≥ 1850)" style={{ cursor: 'help', opacity: 0.7 }}>(i)</span>
                </div>
              </th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CodeforcesIcon size={16} />
                  <span>CF Rating</span>
                  <span title="Codeforces Official Rating (Normalized by 1.25x for cross-platform comparison)" style={{ cursor: 'help', opacity: 0.7 }}>(i)</span>
                </div>
              </th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CodeChefIcon size={16} />
                  <span>CC Rating</span>
                  <span title="CodeChef Official Rating (e.g. 3 ≥ 1600, 4 ≥ 1800)" style={{ cursor: 'help', opacity: 0.7 }}>(i)</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rankedFriends.map((rf, idx) => {
              const mainHref = rf.lcRating > 0 || (!rf.cfRating && !rf.ccRating) 
                ? `https://leetcode.com/${rf.lcHandle}` 
                : rf.cfRating > 0 
                ? `https://codeforces.com/profile/${rf.cfHandle}` 
                : `https://www.codechef.com/users/${rf.ccHandle}`;
              return (
                <tr key={rf.friend.id || rf.friend.username}>
                  <td style={{ fontWeight: 800, color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'inherit' }}>
                    #{idx + 1}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    <a href={mainHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>
                      {rf.friend.displayName || rf.friend.username}
                    </a>
                  </td>
                  <td style={{ fontWeight: 800, color: '#ffa116' }}>{rf.powerScore.toLocaleString()}</td>
                <td style={{ fontWeight: 700 }}>{rf.totalSolved.toLocaleString()}</td>
                <td style={{ fontWeight: 700 }}>
                  {rf.lcRating ? (
                    <a href={`https://leetcode.com/${rf.lcHandle}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                      {Math.round(rf.lcRating)}
                    </a>
                  ) : '-'}
                </td>
                <td style={{ fontWeight: 700 }}>
                  {rf.cfRating ? (
                    <a href={`https://codeforces.com/profile/${rf.cfHandle}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                      {Math.round(rf.cfRating)}
                    </a>
                  ) : '-'}
                </td>
                <td style={{ fontWeight: 700 }}>
                  {rf.ccRating ? (
                    <a href={`https://www.codechef.com/users/${rf.ccHandle}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                      {Math.round(rf.ccRating)}
                    </a>
                  ) : '-'}
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>

      <div style={{ background: 'var(--bg-secondary)', padding: '28px', border: '1px solid var(--border-strong)', borderRadius: '0px', marginTop: '40px' }}>
        <h3 style={{ fontSize: 'var(--font-size-value)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', marginTop: 0 }}>
          How We Calculate Leaderboard Rankings & Power Scores
        </h3>
        <p style={{ fontSize: 'var(--font-size-title)', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
          To provide a highly balanced and prestigious leaderboard that respects both elite competitive performance and consistent daily practice, L'Amigo employs an advanced multi-factor scoring architecture.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#ffa116', marginBottom: '8px', fontSize: 'calc(1.25 * var(--font-size-base))' }}>L'Amigo Power Score</div>
            <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              <strong>Power Score = Peak Normalized Rating + Difficulty-Weighted Solves</strong>.<br />
              Rather than treating all solves equally, problems are weighted by complexity (Easy = 1x, Medium = 3x, Hard = 6x). This is added to your peak rating across platforms to form a unified mastery metric.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#00b8a3', marginBottom: '8px', fontSize: 'calc(1.25 * var(--font-size-base))' }}>Peak Mastery</div>
            <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              <strong>Peak Mastery = Max(LC Rating, CF Rating * 1.25, CC Rating)</strong>.<br />
              Because Codeforces ratings operate on a significantly harder and more compressed distribution than LeetCode, CF ratings are scaled up by 1.25x to accurately align and compare peak algorithmic skill.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#ff375f', marginBottom: '8px', fontSize: 'calc(1.25 * var(--font-size-base))' }}>Total Solved</div>
            <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              <strong>Total Solved = LC Solves + CF Solves + CC Solves</strong>.<br />
              The traditional grind metric. Displays the unweighted sum of all accepted problem submissions across LeetCode, Codeforces, and CodeChef.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

