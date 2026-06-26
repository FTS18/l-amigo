import React from 'react';
import { FriendProfile, Friend } from '../../types';
import { FriendCard } from '../../popup/FriendCard';

interface Props {
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  isDarkMode?: boolean;
  selectedGlobalPlatforms?: string[];
}

export const Overview: React.FC<Props> = ({ friends, profiles, isDarkMode = true, selectedGlobalPlatforms = ['leetcode', 'codeforces', 'codechef'] }) => {
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
        <h2>Dashboard Overview</h2>
        <p>Your group's collective programming statistics for {selectedGlobalPlatforms.join(', ')}.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '24px', border: '1px solid var(--border-strong)', borderRadius: '0px' }}>
          <div style={{ fontSize: 'var(--font-size-title)', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Total Group Solves
            <span title="Aggregate count of all problems solved by tracked friends across the currently active platform filters." style={{ cursor: 'help', opacity: 0.7 }}>ⓘ</span>
          </div>
          <div style={{ fontSize: 'calc(3 * var(--font-size-base))', fontWeight: 900, color: 'var(--text-primary)' }}>{totalSolved.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '24px', border: '1px solid var(--border-strong)', borderRadius: '0px' }}>
          <div style={{ fontSize: 'var(--font-size-title)', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Tracked Friends
            <span title="Count of friends who have accounts linked to the active platform filters." style={{ cursor: 'help', opacity: 0.7 }}>ⓘ</span>
          </div>
          <div style={{ fontSize: 'calc(3 * var(--font-size-base))', fontWeight: 900, color: 'var(--text-primary)' }}>{filteredFriends.length}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '24px', border: '1px solid var(--border-strong)', borderRadius: '0px' }}>
          <div style={{ fontSize: 'var(--font-size-title)', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Active Users (Recent)
            <span title="Friends with verified submission activity within the recent activity threshold across selected platforms." style={{ cursor: 'help', opacity: 0.7 }}>ⓘ</span>
          </div>
          <div style={{ fontSize: 'calc(3 * var(--font-size-base))', fontWeight: 900, color: 'var(--text-primary)' }}>{activeUsers}</div>
        </div>
      </div>

      <div className="tab-header">
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
              isDarkMode={isDarkMode}
              platformFilters={selectedGlobalPlatforms as any}
              onRemove={() => {}}
            />
          );
        })}
      </div>
    </div>
  );
};
