import React from 'react';

interface TabNavProps {
  activeTab: 'friends' | 'compare' | 'sync';
  onTabChange: (tab: 'friends' | 'compare' | 'sync') => void;
  friendCount?: number;
}

export const TabNav: React.FC<TabNavProps> = ({ activeTab, onTabChange, friendCount }) => {
  return (
    <div className="tab-nav">
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
        className={`tab-button ${activeTab === 'sync' ? 'active' : ''}`}
        onClick={() => onTabChange('sync')}
      >
        Sync
      </button>
    </div>
  );
};
