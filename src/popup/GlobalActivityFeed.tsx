import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FriendProfile } from '../types';

interface GlobalActivityFeedProps {
  profiles: Record<string, FriendProfile>;
  ownUsername?: string;
}

// Normalize to milliseconds — CF gives seconds, LC gives ms
const toMs = (ts: number) => ts < 1_000_000_000_000 ? ts * 1000 : ts;

const formatRelTime = (ts: number) => {
  const diff = Date.now() - toMs(ts);
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
};

export const GlobalActivityFeed: React.FC<GlobalActivityFeedProps> = ({ profiles, ownUsername }) => {
  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const activities = useMemo(() => {
    const all: any[] = [];
    Object.entries(profiles)
      .filter(([key]) => key.includes(':'))
      .map(([_, p]) => p)
      .forEach(p => {
        // Exclude own user's solves based on user feedback
        if (ownUsername && p.username?.toLowerCase() === ownUsername.toLowerCase()) {
          return;
        }

        // Deduplicate: only latest accepted submission per problem for this user
        const userSolved = new Map<string, any>();
        
        p.recentSubmissions?.forEach(s => {
          if (s.statusDisplay === 'Accepted') {
            const existing = userSolved.get(s.titleSlug);
            const ts = toMs(s.timestamp);
            if (!existing || ts > existing.timestamp) {
              userSolved.set(s.titleSlug, {
                username: p.username,
                problem: s.title,
                timestamp: ts,
                difficulty: s.difficulty,
                platform: p.platform,
                url: p.platform === 'codeforces'
                  ? `https://codeforces.com/problemset/problem/${s.titleSlug}`
                  : `https://leetcode.com/problems/${s.titleSlug}`
              });
            }
          }
        });
        
        all.push(...Array.from(userSolved.values()));
      });
    
    // Cap at 50 items and rely on the scrollbar instead of a "Show More" button to avoid spam
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  }, [profiles, ownUsername]);

  if (activities.length === 0) return null;

  return (
    <div className="recommendations-section activity-feed-section">
      <button 
        className="recommendations-toggle"
        onClick={() => setExpanded(!expanded)}
        title="Real-time activity feed showing latest accepted problem submissions from your friends list"
      >
        Recent Solves {expanded ? <ChevronDown size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} /> : <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />}
        <span onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); if (!expanded) setExpanded(true); }} style={{ marginLeft: '6px', fontSize: 'var(--font-size-md)', opacity: showInfo ? 1 : 0.7, color: showInfo ? '#ffa116' : 'inherit', cursor: 'pointer', verticalAlign: 'middle' }} title="Click to learn about Background Refresh">(i)</span>
      </button>

      {expanded && (
        <div className="recommendations-content">
          {showInfo && (
            <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: '0px', fontSize: 'var(--font-size-sm)', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong>(i) Background Refresh & Battery Saving</strong>
                <button onClick={() => setShowInfo(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', fontSize: 'var(--font-size-base)' }}>×</button>
              </div>
              To comply with Chrome Manifest V3 efficiency standards and prevent platform IP bans, automatic background syncing runs at your configured intervals (e.g., every 30 or 60 minutes). For instant real-time updates, use the manual refresh button above.
            </div>
          )}
          <div className="feed-items submissions-list" style={{ padding: '0' }}>
            {activities.map((act, i) => (
              <div key={`${act.username}-${i}`} className="feed-item">
                <div className="feed-item-content">
                  <span className="feed-username">{act.username}</span>
                  <span> solved </span>
                  <a href={act.url} target="_blank" rel="noopener noreferrer" className="feed-problem">
                    {act.problem}
                  </a>
                  {act.difficulty && act.difficulty !== 'Unknown' && (
                    <span className={`sub-diff-badge ${act.difficulty.toLowerCase()}`} style={{ marginLeft: '4px', fontSize: 'calc(0.9 * var(--font-size-xs))' }}>
                      {act.difficulty}
                    </span>
                  )}
                </div>
                <span className="feed-time" title={`Submitted on ${new Date(act.timestamp).toLocaleString()}`}>{formatRelTime(act.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
