import React from 'react';

interface TabNavProps {
  activeTab: 'friends' | 'compare' | 'settings';
  onTabChange: (tab: 'friends' | 'compare' | 'settings') => void;
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
        className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => onTabChange('settings')}
      >
        Settings
      </button>
    </div>
  );
};
