import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FriendProfile } from '../types';

interface GlobalActivityFeedProps {
  profiles: Record<string, FriendProfile>;
  ownUsername?: string;
}

const formatRelTime = (ts: number) => {
  const diff = Date.now() - ts;
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
        // Deduplicate: only latest accepted submission per problem for this user
        const userSolved = new Map<string, any>();
        
        p.recentSubmissions?.forEach(s => {
          if (s.statusDisplay === 'Accepted') {
            const existing = userSolved.get(s.titleSlug);
            if (!existing || s.timestamp > existing.timestamp) {
              userSolved.set(s.titleSlug, {
                username: p.username,
                problem: s.title,
                timestamp: s.timestamp,
                url: p.platform === 'codeforces'
                  ? `https://codeforces.com/problemset/problem/${s.titleSlug}`
                  : `https://leetcode.com/problems/${s.titleSlug}`
              });
            }
          }
        });
        
        all.push(...Array.from(userSolved.values()));
      });
    
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [profiles]);

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
          <div className="feed-items">
            {activities.map((act, i) => (
              <div key={`${act.username}-${i}`} className="feed-item">
                <div className="feed-item-content">
                  <span className="feed-username">{act.username === ownUsername?.toLowerCase() ? 'You' : act.username}</span>
                  <span> solved </span>
                  <a href={act.url} target="_blank" rel="noopener noreferrer" className="feed-problem">
                    {act.problem}
                  </a>
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
