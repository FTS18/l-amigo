import React, { useState, useEffect, useRef } from 'react';
import { LeetCodeService } from '../services/leetcode';
import { CodeforcesService } from '../services/codeforces';
import { GitHubSyncService } from '../services/github';
import { restoreFromBackupJSON } from '../utils/import-restore';

interface OnboardingProps {
  onComplete: (username: string) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [username, setUsername] = useState('');
  const [cfHandle, setCfHandle] = useState('');
  const [ccHandle, setCcHandle] = useState('');
  const [error, setError] = useState('');

  const [mode, setMode] = useState<'setup' | 'restore'>('setup');
  const [ghToken, setGhToken] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [restoring, setRestoring] = useState(false);

  const [deviceFlowState, setDeviceFlowState] = useState<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
    const ccTrimmed = ccHandle.trim();
    
    if (!trimmed && !cfTrimmed && !ccTrimmed) {
      setError('Please enter at least one handle (LeetCode, Codeforces, or CodeChef)');
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
        own_codeforces_handle: cfTrimmed.toLowerCase(),
        own_codechef_handle: ccTrimmed.toLowerCase()
      });

      onComplete(trimmed || cfTrimmed || ccTrimmed);
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

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ghToken.trim() || !ghRepo.trim()) {
      setError('Please enter both GitHub token and repository name');
      return;
    }
    setRestoring(true);
    setError('');
    try {
      const success = await GitHubSyncService.restoreState(ghToken.trim(), ghRepo.trim());
      if (success) {
        const data = await chrome.storage.local.get('own_username');
        onComplete(data.own_username || '');
      } else {
        setError('No backup file (.lamigo-backup.json) found in that repository');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to restore backup. Check your token and repository name.');
    } finally {
      setRestoring(false);
    }
  };

  const handleLocalImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const importedUsername = await restoreFromBackupJSON(parsed);
        onComplete(importedUsername);
      } catch (err: any) {
        setError('Failed to import data: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const startDeviceFlow = async () => {
    setError('');
    setIsLoggingIn(true);
    try {
      const state = await GitHubSyncService.requestDeviceCode();
      setDeviceFlowState(state);
      
      chrome.tabs.create({ url: state.verification_uri });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const token = await GitHubSyncService.pollForToken(
        state.device_code,
        state.interval,
        controller.signal
      );

      setGhToken(token);
      setDeviceFlowState(null);
    } catch (err: any) {
      if (err.message && err.message.includes('device_flow_disabled')) {
        console.log("Device flow disabled. Falling back to standard OAuth.");
        chrome.runtime.sendMessage({ action: 'githubOAuthLogin' }, (res) => {
          if (res && res.success) {
            setGhToken(res.token);
          } else {
            setError(res?.error || 'OAuth authentication failed.');
          }
          setDeviceFlowState(null);
          setIsLoggingIn(false);
        });
        return;
      } else {
        if (err.message !== 'Device authorization cancelled.') {
          setError(err.message || 'Device authentication failed.');
        }
        setDeviceFlowState(null);
      }
    }
    setIsLoggingIn(false);
  };

  const cancelDeviceFlow = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setDeviceFlowState(null);
    setIsLoggingIn(false);
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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

        <div className="tab-nav" style={{ marginBottom: '20px' }}>
          <button
            type="button"
            className={`tab-button ${mode === 'setup' ? 'active' : ''}`}
            onClick={() => { setMode('setup'); setError(''); }}
          >
            Setup Profile
          </button>
          <button
            type="button"
            className={`tab-button ${mode === 'restore' ? 'active' : ''}`}
            onClick={() => { setMode('restore'); setError(''); }}
          >
            Restore Backup
          </button>
        </div>

        {mode === 'setup' ? (
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

            <div className="onboarding-field">
              <label>Your CodeChef Handle (Optional)</label>
              <input
                type="text"
                placeholder="CodeChef handle"
                value={ccHandle}
                onChange={(e) => {
                  setCcHandle(e.target.value);
                  setError('');
                }}
                className="onboarding-input"
              />
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
        ) : (
          <>
          <form onSubmit={handleRestore} className="onboarding-form">
            {!ghToken ? (
              <div style={{ marginBottom: '16px' }}>
                <label className="onboarding-field-label" style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
                  Option A: Authenticate with GitHub (Recommended)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {!deviceFlowState ? (
                    <button
                      type="button"
                      onClick={startDeviceFlow}
                      className="onboarding-btn primary"
                      style={{ backgroundColor: '#2da44e', color: 'white' }}
                      disabled={isLoggingIn}
                    >
                      {isLoggingIn ? 'Connecting...' : 'Login with GitHub'}
                    </button>
                  ) : (
                    <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: '4px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '13px' }}>
                        1. Open <a href={deviceFlowState.verification_uri} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 'bold', textDecoration: 'underline' }}>github.com/login/device</a>
                      </p>
                      <p style={{ margin: '0 0 12px', fontSize: '13px' }}>
                        2. Enter code:
                      </p>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '2px', margin: '8px 0', color: 'var(--text-primary)', background: 'var(--bg-primary)', padding: '8px', border: '1px solid var(--border)' }}>
                        {deviceFlowState.user_code}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                        Waiting for authorization... (Expires in {Math.floor(deviceFlowState.expires_in / 60)}m)
                      </p>
                      <button
                        type="button"
                        onClick={cancelDeviceFlow}
                        className="onboarding-btn secondary"
                        style={{ marginTop: '12px', padding: '6px 12px', fontSize: '12px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div className="onboarding-divider" style={{ textAlign: 'center', margin: '16px 0', borderBottom: '1px solid var(--border)', lineHeight: '0.1em' }}>
                  <span style={{ background: 'var(--bg-primary)', padding: '0 10px', fontSize: '12px', color: 'var(--text-muted)' }}>OR</span>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', color: 'var(--color-easy)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>✓ Connected to GitHub</span>
                <button
                  type="button"
                  onClick={() => { setGhToken(''); setDeviceFlowState(null); }}
                  className="onboarding-btn secondary"
                  style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', flex: 'none' }}
                >
                  Disconnect
                </button>
              </div>
            )}

            <div className="onboarding-field">
              <label>Option B: Manual Personal Access Token (PAT)</label>
              <p className="onboarding-hint">
                Provide token manually with "repo" scope if you prefer not to use Device Flow
              </p>
              <input
                type="password"
                placeholder="ghp_..."
                value={ghToken}
                onChange={(e) => {
                  setGhToken(e.target.value);
                  setError('');
                }}
                className="onboarding-input"
                disabled={!!deviceFlowState}
              />
            </div>

            <div className="onboarding-field">
              <label>GitHub Repository Name</label>
              <p className="onboarding-hint">
                The private repository where your L'Amigo solutions and backup are synced
              </p>
              <input
                type="text"
                placeholder="my-leetcode-solutions"
                value={ghRepo}
                onChange={(e) => {
                  setGhRepo(e.target.value);
                  setError('');
                }}
                className="onboarding-input"
              />
            </div>
            
            {error && <span className="onboarding-error" style={{ display: 'block', marginBottom: '12px' }}>{error}</span>}

            <div className="onboarding-actions">
              <button type="button" onClick={handleSkip} className="onboarding-btn secondary">
                Skip
              </button>
              <button type="submit" className="onboarding-btn primary" disabled={restoring || !!deviceFlowState}>
                {restoring ? 'Restoring...' : 'Restore Backup'}
              </button>
            </div>
          </form>

          <div className="onboarding-divider" style={{ textAlign: 'center', margin: '16px 0', borderBottom: '1px solid var(--border)', lineHeight: '0.1em' }}>
            <span style={{ background: 'var(--bg-primary)', padding: '0 10px', fontSize: '12px', color: 'var(--text-muted)' }}>OR</span>
          </div>

          <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="onboarding-field-label" style={{ display: 'block', fontWeight: 'bold', fontSize: '13px' }}>
              Option C: Local Import JSON
            </label>
            <p className="onboarding-hint" style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              Restore your complete configuration and friends list from a local JSON backup file
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleLocalImport}
              style={{ display: 'none' }}
              id="onboarding-import-json-file"
            />
            <button
              type="button"
              onClick={() => document.getElementById('onboarding-import-json-file')?.click()}
              className="onboarding-btn secondary"
              style={{ width: '100%' }}
            >
              Import Backup JSON
            </button>
          </div>
          </>
        )}

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
