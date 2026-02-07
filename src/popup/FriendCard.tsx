import React, { useState } from 'react';
import { Friend, FriendProfile } from '../types';
import { DifficultyChart } from './DifficultyChart';
import { StreakCalculator } from '../services/streak';

interface FriendCardProps {
  friend: Friend;
  profile?: FriendProfile;
  onRemove: (username: string) => void;
  isDarkMode?: boolean;
}

export const FriendCard: React.FC<FriendCardProps> = ({ friend, profile, onRemove, isDarkMode }) => {
  const [showSubmissions, setShowSubmissions] = useState(false);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (!profile) {
    return (
      <div className="friend-card loading-card">
        <div className="card-header">
          <h3>{friend.username}</h3>
          <button className="remove-btn" onClick={() => onRemove(friend.username)}>
            ✕
          </button>
        </div>
        <p className="loading-text">Loading profile...</p>
      </div>
    );
  }

  const { problemsSolved, contestRating, recentSubmissions } = profile;
  const streak = StreakCalculator.calculateStreak(profile);

  return (
    <div className="friend-card compact">
      <div className="card-layout">
        <div className="card-left">
          <div className="card-header-compact">
            <div className="user-info-compact">
              {profile.avatar && (
                <img src={profile.avatar} alt={friend.username} className="avatar-compact" />
              )}
              <div className="user-details">
                <div className="username-row">
                  <a href={`https://leetcode.com/${friend.username}`} target="_blank" rel="noopener noreferrer" className="username-link">
                    <h3>{friend.username}</h3>
                  </a>
                  {streak.currentStreak > 0 && (
                    <div className="streak-badge-top">
                      <span className="streak-number">🔥 {streak.currentStreak}</span>
                    </div>
                  )}
                </div>
                {profile.realName && <p className="real-name">{profile.realName}</p>}
              </div>
            </div>
            <button className="remove-btn" onClick={() => onRemove(friend.username)}>
              ✕
            </button>
          </div>

          <div className="stats-compact">
            <div className="stats-box-row">
              <div className="stats-box">
                <div className="stats-box-value">{problemsSolved.total}</div>
              </div>
              <div className="stats-box">
                <div className="stats-box-value">{problemsSolved.easy}</div>
              </div>
              <div className="stats-box">
                <div className="stats-box-value">{problemsSolved.medium}</div>
              </div>
              <div className="stats-box">
                <div className="stats-box-value">{problemsSolved.hard}</div>
              </div>
            </div>
            <div className="stats-box-labels">
              <div className="stats-box-label">Total</div>
              <div className="stats-box-label">Easy</div>
              <div className="stats-box-label">Medium</div>
              <div className="stats-box-label">Hard</div>
            </div>
          </div>

          {contestRating && (
            <div className="contest-info-compact">
              <span className="contest-icon">🏆</span>
              <span>Contest Rating: {Math.round(contestRating)}</span>
              {profile.contestRanking && (
                <span className="contest-rank">Rank: #{profile.contestRanking.toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {recentSubmissions && recentSubmissions.length > 0 && (
        <div className="recent-submissions-compact">
          <button 
            className="submissions-toggle"
            onClick={() => setShowSubmissions(!showSubmissions)}
          >
            <span>RECENT SUBMISSIONS</span>
            <span className="toggle-arrow">{showSubmissions ? '▼' : '▶'}</span>
          </button>
          
          {showSubmissions && (
            <ul className="submissions-list">
              {recentSubmissions.slice(0, 5).map((sub, idx) => (
                <li key={idx}>
                  <a
                    href={`https://leetcode.com/problems/${sub.titleSlug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {sub.title}
                  </a>
                  <span className="submission-time">{formatTimestamp(sub.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
