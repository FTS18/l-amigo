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
      >
        Recent Solves {expanded ? <ChevronDown size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} /> : <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />}
      </button>

      {expanded && (
        <div className="recommendations-content">
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
                    <span className={`sub-diff-badge ${act.difficulty.toLowerCase()}`} style={{ marginLeft: '4px', fontSize: '9px' }}>
                      {act.difficulty}
                    </span>
                  )}
                </div>
                <span className="feed-time">{formatRelTime(act.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
