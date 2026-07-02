import React from 'react';
import { Trophy, ExternalLink } from 'lucide-react';
import { PlatformIcon } from '../../../../utils/PlatformIcons';

interface Props {
  unsolvedFriendsProblems: any[];
}

export const RecentSubmissionsWidget: React.FC<Props> = React.memo(({ unsolvedFriendsProblems }) => {
  return (
<div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-strong)', paddingBottom: '12px', fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
          <Trophy size={20} color="#ffa116" />
          <span>Recent Problems Solved by Friends (Unsolved by You)</span>
        </div>

        {unsolvedFriendsProblems.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>You are completely caught up! You have solved all recent problems attempted by your friends.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="head-to-head-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-strong)', background: 'var(--bg-primary)' }}>
                  <th style={{ padding: '14px 16px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)', width: '60px', textAlign: 'center' }}>Platform</th>
                  <th style={{ padding: '14px 16px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Problem Name</th>
                  <th style={{ padding: '14px 16px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Solved By</th>
                  <th style={{ padding: '14px 16px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Latest Activity</th>
                  <th style={{ padding: '14px 16px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'center', width: '120px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {unsolvedFriendsProblems.map((prob) => (
                  <tr key={`${prob.platform}-${prob.titleSlug}`} style={{ borderBottom: '1px solid var(--border-strong)', transition: 'background 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-primary)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'var(--bg-primary)', border: '1px solid var(--border-strong)' }}>
                        <PlatformIcon platform={prob.platform} size={16} />
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                      {prob.url ? (
                        <a href={prob.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}>
                          {prob.title}
                        </a>
                      ) : (
                        prob.title
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {prob.solvedBy.map((name: string) => (
                          <span key={name} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '2px 8px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {new Date(prob.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {new Date(prob.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {prob.url && (
                        <a 
                          href={prob.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#ffa116', color: '#000', fontWeight: 800, fontSize: 'var(--font-size-xs)', textDecoration: 'none', transition: 'opacity 0.2s ease' }}
                          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                        >
                          <span>Solve</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
  );
});
