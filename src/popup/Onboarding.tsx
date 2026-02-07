import React, { useState, useEffect } from 'react';

interface OnboardingProps {
  onComplete: (username: string) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter your LeetCode username');
      return;
    }

    try {
      // Save to storage
      await chrome.storage.local.set({ 
        onboarding_complete: true,
        own_username: trimmed.toLowerCase()
      });

      onComplete(trimmed);
    } catch (error) {
      setError('Failed to save settings. Please try again.');
      console.error('Error:', error);
    }
  };

  const handleSkip = async () => {
    try {
      await chrome.storage.local.set({ onboarding_complete: true });
      onComplete('');
    } catch (error) {
      setError('Failed to save settings. Please try again.');
      console.error('Error:', error);
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <img src="/android-chrome-192x192.png" alt="L'Amigo" className="onboarding-logo" />
          <h2>Welcome to L'Amigo</h2>
          <p>Track your friends' LeetCode progress and stay motivated!</p>
        </div>

        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="onboarding-field">
            <label>Your LeetCode Username (Optional)</label>
            <p className="onboarding-hint">
              We'll exclude you from the friends list to avoid confusion
            </p>
            <input
              type="text"
              placeholder="your_username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              className="onboarding-input"
              autoFocus
            />
            {error && <span className="onboarding-error">{error}</span>}
          </div>

          <div className="onboarding-actions">
            <button type="button" onClick={handleSkip} className="onboarding-btn secondary">
              Skip
            </button>
            <button type="submit" className="onboarding-btn primary">
              Get Started
            </button>
          </div>
        </form>

        <div className="onboarding-features">
          <h3>What you can do:</h3>
          <ul>
            <li>Track friends' solving streaks and progress</li>
            <li>View difficulty distribution charts</li>
            <li>Get problem recommendations</li>
            <li>Compare your friends side-by-side</li>
            <li>Sync data to GitHub</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
