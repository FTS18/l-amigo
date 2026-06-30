import React from 'react';

interface TabNavProps {
  activeTab: 'friends' | 'compare' | 'settings';
  onTabChange: (tab: 'friends' | 'compare' | 'settings') => void;
  friendCount?: number;
  dailyGoal?: number;
  dailySolves?: number;
}

export const TabNav: React.FC<TabNavProps> = ({ activeTab, onTabChange, friendCount, dailyGoal = 3, dailySolves = 0 }) => {
  const percent = Math.min(100, Math.round((dailySolves / dailyGoal) * 100));
  return (
    <div className="header-nav-container" style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color, #222)' }}>
      <div className="tab-nav" style={{ borderBottom: 'none' }}>
        <button
          className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => onTabChange('friends')}
        >
          Friends {friendCount !== undefined && `(${friendCount})`}
        </button>
        <button
          className={`tab-button ${activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => onTabChange('compare')}
        >
          Compare
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
        >
          Settings
        </button>
      </div>
    </div>
  );
};
