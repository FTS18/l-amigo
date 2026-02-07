import React from 'react';
import { StreakInfo } from '../services/streak';

interface StreakBadgeProps {
  streak: StreakInfo;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ streak }) => {
  const { currentStreak, longestStreak } = streak;

  if (currentStreak === 0) {
    return null;
  }

  return (
    <div className="streak-badge">
      <div className="current-streak">
        <span className="streak-icon"></span>
        <div className="streak-info">
          <span className="streak-number">{currentStreak}</span>
          <span className="streak-label">day streak</span>
        </div>
      </div>
      {longestStreak > currentStreak && (
        <div className="longest-streak">
          <span className="longest-label">Best: {longestStreak} days</span>
        </div>
      )}
    </div>
  );
};
