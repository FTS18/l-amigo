import React from 'react';
import { Calendar } from 'lucide-react';
import { PlatformIcon } from '../../../../utils/PlatformIcons';

interface Props {
  loadingContests: boolean;
  upcomingContests: any[];
  currentTime: number;
  onNavigate?: (tab: string) => void;
}

export const ContestsWidget: React.FC<Props> = React.memo(({ loadingContests, upcomingContests, currentTime, onNavigate }) => {
  return (
<div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-strong)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
              <Calendar size={20} color="#3b82f6" />
              <span>Upcoming Contests</span>
            </div>
            <button 
              onClick={() => onNavigate?.('contests')} 
              style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-sm)' }}
              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
            >
              All Contests &rarr;
            </button>
          </div>

          {loadingContests ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading contests...</div>
          ) : upcomingContests.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>No upcoming contests found for active platforms.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
              {upcomingContests.map(c => {
                const isLC = c.platform === 'leetcode';
                const isCC = c.platform === 'codechef';
                const href = isLC ? `https://leetcode.com/contest/${c.id}` : isCC ? `https://www.codechef.com/${c.id}` : `https://codeforces.com/contests/${c.id}`;
                const diff = c.startTimeSeconds * 1000 - currentTime;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((diff % (1000 * 60)) / 1000);

                return (
                  <div key={`${c.platform}-${c.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '12px 16px', border: '1px solid var(--border-strong)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)' }}>
                        <PlatformIcon platform={c.platform} size={16} />
                      </span>
                      <div>
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none', display: 'block', marginBottom: '2px', fontSize: 'var(--font-size-base)' }} onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}>
                          {c.name}
                        </a>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                          {new Date(c.startTimeSeconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} @ {new Date(c.startTimeSeconds * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 'var(--font-size-base)', color: diff > 0 ? 'var(--color-easy)' : 'var(--text-secondary)' }}>
                      {diff > 0 ? `${days}d ${hours}h ${mins}m ${secs}s` : '● LIVE'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
  );
});
