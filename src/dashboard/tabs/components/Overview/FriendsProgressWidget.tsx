import React from 'react';
import { Flame, Clock } from 'lucide-react';
import { PlatformIcon } from '../../../../utils/PlatformIcons';
import { Friend } from '../../../../types';

interface Props {
  recentFriends: any[];
  setSelectedFriend: (f: Friend | null) => void;
  setSelectedPlatform: (p: string) => void;
  setSelectedFilter: (f: 'all' | 'Easy' | 'Medium' | 'Hard') => void;
  onNavigate?: (tab: string) => void;
}

export const FriendsProgressWidget: React.FC<Props> = React.memo(({
  recentFriends, setSelectedFriend, setSelectedPlatform, setSelectedFilter, onNavigate
}) => {
  return (
<div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-strong)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
            <Flame size={20} color="#00C853" />
            <span>Recent Friend Activity</span>
          </div>
          <button 
            onClick={() => onNavigate?.('friends')} 
            style={{ background: 'transparent', border: 'none', color: '#00C853', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-sm)' }}
            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            All Friends &rarr;
          </button>
        </div>

        {recentFriends.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>No recent friend problem solving activity found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {recentFriends.map(({ friend, latestTime, latestProb, platform, avatar }) => (
              <div 
                key={friend.id || friend.username} 
                onClick={() => {
                  setSelectedFriend(friend);
                  setSelectedPlatform(platform);
                  setSelectedFilter('all');
                }}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '20px', borderRadius: '0px', cursor: 'pointer', transition: 'border-color 0.2s ease, transform 0.2s ease', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#00C853'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '0px', background: 'var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 'var(--font-size-title)', color: 'var(--text-primary)', border: '1px solid #00C853', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute' }}>{(friend.displayName || friend.username).charAt(0).toUpperCase()}</div>
                    {avatar && (
                      <img
                        src={avatar}
                        alt={friend.displayName || friend.username}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', marginBottom: '2px' }}>{friend.displayName || friend.username}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      <span>{new Date(latestTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {new Date(latestTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PlatformIcon platform={platform} size={16} />
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={latestProb}>
                    {latestProb}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
});
