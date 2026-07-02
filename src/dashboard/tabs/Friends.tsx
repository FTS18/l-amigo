import React from 'react';
import { Users, Activity, Trophy } from 'lucide-react';
import { FriendProfile, Friend } from '../../types';
import { FriendCard } from '../../popup/FriendCard';
import { FriendProfileView } from '../../popup/FriendProfileView';

import { useAppStore } from '../../store/useAppStore';

interface Props {
  onNavigate?: (tab: string) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const Friends: React.FC<Props> = ({ onNavigate, onToast }) => {
  const friends = useAppStore(state => state.friends);
  const profiles = useAppStore(state => state.profiles);
  const isDarkMode = useAppStore(state => state.isDarkMode);
  const selectedGlobalPlatforms = useAppStore(state => state.selectedGlobalPlatforms);
  const allSubmissions = useAppStore(state => state.allSubmissions);
  const selectedFriend = useAppStore(state => state.ui_frSelectedFriend);
  const setPartial = useAppStore(state => state.setPartial);
  const setSelectedFriend = (v: Friend | null) => setPartial({ ui_frSelectedFriend: v });

  const selectedPlatform = useAppStore(state => state.ui_frSelectedPlatform);
  const setSelectedPlatform = (v: string) => setPartial({ ui_frSelectedPlatform: v });

  const selectedFilter = useAppStore(state => state.ui_frSelectedFilter) as 'all' | 'Easy' | 'Medium' | 'Hard';
  const setSelectedFilter = (v: 'all' | 'Easy' | 'Medium' | 'Hard') => setPartial({ ui_frSelectedFilter: v });

  if (selectedFriend) {
    const isOwn = selectedFriend.id === 'own-user';
    const lcAccount = selectedFriend.accounts?.find(a => a.platform === 'leetcode')?.handle || (profiles[selectedFriend.username.toLowerCase()]?.platform === 'leetcode' ? selectedFriend.username : undefined);
    const cfAccount = selectedFriend.accounts?.find(a => a.platform === 'codeforces')?.handle || (profiles[selectedFriend.username.toLowerCase()]?.platform === 'codeforces' ? selectedFriend.username : undefined);
    const ccAccount = selectedFriend.accounts?.find(a => a.platform === 'codechef')?.handle || (profiles[selectedFriend.username.toLowerCase()]?.platform === 'codechef' ? selectedFriend.username : undefined);

    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px' }}>
        <FriendProfileView 
          friend={selectedFriend}
          leetcodeProfile={lcAccount ? (profiles[`leetcode:${lcAccount.toLowerCase()}`] || profiles[lcAccount.toLowerCase()]) : undefined}
          codeforcesProfile={cfAccount ? (profiles[`codeforces:${cfAccount.toLowerCase()}`] || profiles[cfAccount.toLowerCase()]) : undefined}
          codechefProfile={ccAccount ? (profiles[`codechef:${ccAccount.toLowerCase()}`] || profiles[ccAccount.toLowerCase()]) : undefined}
          initialPlatform={(selectedPlatform as any) || undefined}
          initialFilter={selectedFilter}
          onBack={() => {
            setSelectedFriend(null);
            setSelectedPlatform('');
            setSelectedFilter('all');
          }}
          isDarkMode={isDarkMode}
          isExpanded={true}
        />
      </div>
    );
  }

  let totalSolved = 0;
  let activeUsers = 0;

  Object.values(profiles).forEach(p => {
    if (!p.platform || !selectedGlobalPlatforms.includes(p.platform)) return;
    if (p.problemsSolved?.total) totalSolved += p.problemsSolved.total;
    if (p.recentSubmissions && p.recentSubmissions.length > 0) activeUsers++;
  });

  const filteredFriends = friends.filter(friend => {
    const isOwn = friend.id === 'own-user';
    if (isOwn) {
      return selectedGlobalPlatforms.some(platform => {
        const p = profiles[`${platform}:${friend.username.toLowerCase()}`] || Object.values(profiles).find(pr => pr.username === friend.username && pr.platform === platform);
        return !!p;
      });
    }
    return selectedGlobalPlatforms.some(platform => {
      const acc = friend.accounts?.find(a => a.platform === platform)?.handle || (profiles[friend.username.toLowerCase()]?.platform === platform ? friend.username : undefined);
      return !!acc;
    });
  });

  return (
    <div>
      <div className="tab-header">
        <h2>Friends Roster</h2>
        <p>Your group's collective programming statistics and individual profiles for {selectedGlobalPlatforms.join(', ')}.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}>
          <Trophy size={90} style={{ position: 'absolute', bottom: '-15px', right: '-15px', opacity: 0.04, color: '#ffa116' }} />
          <div style={{ fontSize: 'var(--font-size-title)', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', position: 'relative', zIndex: 1 }}>
            Total Group Solves
            <span title="Aggregate count of all problems solved by tracked friends across the currently active platform filters." style={{ cursor: 'help', opacity: 0.7 }}>ⓘ</span>
          </div>
          <div style={{ fontSize: 'calc(3.5 * var(--font-size-base))', fontWeight: 900, color: '#ffa116', position: 'relative', zIndex: 1 }}>{totalSolved.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}>
          <Users size={90} style={{ position: 'absolute', bottom: '-15px', right: '-15px', opacity: 0.04, color: '#00C853' }} />
          <div style={{ fontSize: 'var(--font-size-title)', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', position: 'relative', zIndex: 1 }}>
            Tracked Friends
            <span title="Count of friends who have accounts linked to the active platform filters." style={{ cursor: 'help', opacity: 0.7 }}>ⓘ</span>
          </div>
          <div style={{ fontSize: 'calc(3.5 * var(--font-size-base))', fontWeight: 900, color: '#00C853', position: 'relative', zIndex: 1 }}>{filteredFriends.length}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}>
          <Activity size={90} style={{ position: 'absolute', bottom: '-15px', right: '-15px', opacity: 0.04, color: '#00B0FF' }} />
          <div style={{ fontSize: 'var(--font-size-title)', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', position: 'relative', zIndex: 1 }}>
            Active Users (Recent)
            <span title="Friends with verified submission activity within the recent activity threshold across selected platforms." style={{ cursor: 'help', opacity: 0.7 }}>ⓘ</span>
          </div>
          <div style={{ fontSize: 'calc(3.5 * var(--font-size-base))', fontWeight: 900, color: '#00B0FF', position: 'relative', zIndex: 1 }}>{activeUsers}</div>
        </div>
      </div>

      <div className="tab-header" style={{ marginTop: '56px' }}>
        <h2 style={{ fontSize: 'calc(2 * var(--font-size-xs))', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Friend Roster
          <span title="Individual friend cards displaying active streak, daily solve goal progress, rating badges, and platform handles." style={{ fontSize: 'var(--font-size-title)', cursor: 'help', opacity: 0.7, fontWeight: 'normal' }}>ⓘ</span>
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {filteredFriends.map(friend => {
          const isOwn = friend.id === 'own-user';
          const lcAccount = friend.accounts?.find(a => a.platform === 'leetcode')?.handle || (profiles[friend.username.toLowerCase()]?.platform === 'leetcode' ? friend.username : undefined);
          const cfAccount = friend.accounts?.find(a => a.platform === 'codeforces')?.handle || (profiles[friend.username.toLowerCase()]?.platform === 'codeforces' ? friend.username : undefined);
          const ccAccount = friend.accounts?.find(a => a.platform === 'codechef')?.handle || (profiles[friend.username.toLowerCase()]?.platform === 'codechef' ? friend.username : undefined);

          const lcProfile = lcAccount ? (profiles[`leetcode:${lcAccount.toLowerCase()}`] || profiles[lcAccount.toLowerCase()]) : undefined;
          const cfProfile = cfAccount ? (profiles[`codeforces:${cfAccount.toLowerCase()}`] || profiles[cfAccount.toLowerCase()]) : undefined;
          const ccProfile = ccAccount ? (profiles[`codechef:${ccAccount.toLowerCase()}`] || profiles[ccAccount.toLowerCase()]) : undefined;
          const mainProfile = isOwn ? (lcProfile || cfProfile || ccProfile) : profiles[friend.username.toLowerCase()];

          return (
            <FriendCard 
              key={friend.id || friend.username}
              friend={friend}
              profile={mainProfile}
              leetcodeProfile={lcProfile}
              codeforcesProfile={cfProfile}
              codechefProfile={ccProfile}
              isOwn={isOwn}
              onViewProfile={(platform, filter = 'all') => {
                setSelectedFriend(friend);
                setSelectedPlatform(platform);
                setSelectedFilter(filter);
              }}
              onRemove={() => {}}
              onToast={onToast}
            />
          );
        })}
      </div>
    </div>
  );
};
