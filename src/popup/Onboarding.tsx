import React, { useState, useEffect } from 'react';
import { LeetCodeService } from '../services/leetcode';
import { CodeforcesService } from '../services/codeforces';

interface OnboardingProps {
  onComplete: (username: string) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [username, setUsername] = useState('');
  const [cfHandle, setCfHandle] = useState('');
  const [error, setError] = useState('');

  const [lcStatus, setLcStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  const [cfStatus, setCfStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');

  // Debounced LC verification
  useEffect(() => {
    if (!username.trim()) {
      setLcStatus('idle');
      return;
    }
    setLcStatus('verifying');
    const timer = setTimeout(async () => {
      try {
        await LeetCodeService.fetchUserProfile(username.trim());
        setLcStatus('valid');
      } catch (err) {
        setLcStatus('invalid');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [username]);

  // Debounced CF verification
  useEffect(() => {
    if (!cfHandle.trim()) {
      setCfStatus('idle');
      return;
    }
    setCfStatus('verifying');
    const timer = setTimeout(async () => {
      try {
        await CodeforcesService.fetchUserProfile(cfHandle.trim());
        setCfStatus('valid');
      } catch (err) {
        setCfStatus('invalid');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [cfHandle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = username.trim();
    const cfTrimmed = cfHandle.trim();
    
    if (!trimmed && !cfTrimmed) {
      setError('Please enter at least one LeetCode username or Codeforces handle');
      return;
    }

    if (lcStatus === 'verifying' || cfStatus === 'verifying') {
      setError('Please wait for verification to complete');
      return;
    }

    if (trimmed && lcStatus === 'invalid') {
      setError('LeetCode handle is invalid');
      return;
    }

    if (cfTrimmed && cfStatus === 'invalid') {
      setError('Codeforces handle is invalid');
      return;
    }

    try {
      // Save to storage
      await chrome.storage.local.set({ 
        onboarding_complete: true,
        own_username: trimmed.toLowerCase(),
        own_codeforces_handle: cfTrimmed.toLowerCase()
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

  const renderVerificationBadge = (status: 'idle' | 'verifying' | 'valid' | 'invalid') => {
    if (status === 'idle') return null;
    if (status === 'verifying') {
      return <span className="verification-badge verifying">Verifying...</span>;
    }
    if (status === 'valid') {
      return <span className="verification-badge valid">✓ Valid</span>;
    }
    return <span className="verification-badge invalid">✗ Invalid</span>;
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <img src="/android-chrome-192x192.png" alt="L'Amigo" className="onboarding-logo" />
          <h2>Welcome to L'Amigo</h2>
          <p>Track your friends' progress across competitive programming platforms!</p>
        </div>

        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="onboarding-field">
            <label>Your LeetCode Username (Optional)</label>
            <p className="onboarding-hint">
              We'll exclude you from the friends list to avoid confusion
            </p>
            <input
              type="text"
              placeholder="LeetCode username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              className="onboarding-input"
              autoFocus
            />
            {renderVerificationBadge(lcStatus)}
          </div>

          <div className="onboarding-field">
            <label>Your Codeforces Handle (Optional)</label>
            <p className="onboarding-hint">
              Used to compare statistics and track activity
            </p>
            <input
              type="text"
              placeholder="Codeforces handle"
              value={cfHandle}
              onChange={(e) => {
                setCfHandle(e.target.value);
                setError('');
              }}
              className="onboarding-input"
            />
            {renderVerificationBadge(cfStatus)}
          </div>
          
          {error && <span className="onboarding-error" style={{ display: 'block', marginBottom: '12px' }}>{error}</span>}

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
