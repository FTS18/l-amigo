import React, { useState, useEffect, useRef } from 'react';
import { GitHubSyncService } from '../services/github';
import { REFRESH_CONSTANTS } from '../constants';
import { validateGitHubToken, validateRepositoryName } from '../utils/sanitize';

interface SettingsTabProps {
  onSync: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  ownUsername: string;
  onUsernameChange: (username: string) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ 
  onSync, 
  isDarkMode, 
  onToggleDarkMode,
  ownUsername,
  onUsernameChange,
  onToast
}) => {
  // GitHub Sync
  const [token, setToken] = useState('');
  const [repoName, setRepoName] = useState('');
  const [isTokenSet, setIsTokenSet] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [syncPhase, setSyncPhase] = useState<'idle' | 'fetching' | 'syncing' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState('');
  const [syncPct, setSyncPct] = useState(0);            // 0-100
  const [syncFetched, setSyncFetched] = useState(0);
  const [syncDone, setSyncDone] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  
  // General Settings
  const [newUsername, setNewUsername] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [healthStatus, setHealthStatus] = useState<{ status: 'idle' | 'checking' | 'ok' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [dailyGoal, setDailyGoal] = useState(3);

  // Poll sync status from storage while sync is running
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncButtonLabel =
    syncPhase === 'fetching'
      ? `Fetching… ${syncFetched > 0 ? `(${syncFetched} found)` : ''}`
      : syncPhase === 'syncing'
        ? `Syncing… (${syncDone}/${syncTotal})`
        : syncPhase === 'error'
          ? 'Retry Sync'
          : 'Sync With GitHub';

  const isSyncingNow = syncPhase === 'fetching' || syncPhase === 'syncing';

  useEffect(() => {
    loadAllSettings();
    // Check if a sync was already running (e.g. popup was closed/reopened)
    checkOngoingSync();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  /** If the background is mid-sync, pick up where we left off visually */
  const checkOngoingSync = async () => {
    const s = await chrome.storage.local.get([
      'sync_status', 'sync_progress_fetch',
      'sync_progress_done', 'sync_progress_total', 'sync_error',
    ]);
    if (s.sync_status === 'fetching' || s.sync_status === 'syncing') {
      setSyncPhase(s.sync_status);
      setSyncFetched(s.sync_progress_fetch || 0);
      setSyncDone(s.sync_progress_done || 0);
      setSyncTotal(s.sync_progress_total || 0);
      if (s.sync_status === 'syncing' && s.sync_progress_total > 0) {
        setSyncPct(Math.round(((s.sync_progress_done || 0) / s.sync_progress_total) * 100));
      }
      startProgressPoll();
    } else if (s.sync_status === 'error') {
      setSyncPhase('error');
      setSyncError(s.sync_error || 'Unknown error');
    }
  };

  const loadAllSettings = async () => {
    const config = await GitHubSyncService.getConfig();
    setIsTokenSet(!!config?.token);
    setIsConfigured(!!(config?.token && config?.repoName));
    if (config?.token) {
      setRepoName(config.repoName || '');
      setLastSyncTime(config.lastSync || null);
    }

    const settings = await chrome.storage.local.get([
      'notifications_enabled',
      'auto_refresh',
      'refresh_interval',
      'own_username',
      'sync_history'
    ]);
    
    setNotificationsEnabled(settings.notifications_enabled ?? true);
    setAutoRefresh(settings.auto_refresh ?? true);
    setRefreshInterval(settings.refresh_interval ?? REFRESH_CONSTANTS.INTERVAL_MINUTES);
    setNewUsername(settings.own_username || '');
    setSyncHistory(settings.sync_history || []);
    setDailyGoal(settings.daily_goal || 3);
  };

  // Start polling sync progress from chrome.storage.local
  const startProgressPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await chrome.storage.local.get([
        'sync_status', 'sync_progress_fetch',
        'sync_progress_done', 'sync_progress_total', 'sync_error',
      ]);
      if (s.sync_status === 'fetching') {
        setSyncPhase('fetching');
        const f = s.sync_progress_fetch || 0;
        setSyncFetched(f);
        setSyncProgress(f ? `(${f} found)` : '');
        // indeterminate pulsing during fetch – use a small animation value
        setSyncPct(-1);
      } else if (s.sync_status === 'syncing') {
        setSyncPhase('syncing');
        const done = s.sync_progress_done || 0;
        const total = s.sync_progress_total || 0;
        setSyncDone(done);
        setSyncTotal(total);
        setSyncProgress(`(${done}/${total})`);
        setSyncPct(total > 0 ? Math.round((done / total) * 100) : 0);
      } else if (s.sync_status === 'error') {
        setSyncPhase('error');
        setSyncError(s.sync_error || 'Unknown error');
        setSyncProgress('');
        setSyncPct(0);
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        setSyncPhase('idle');
        setSyncProgress('');
        setSyncPct(0);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 500);
  };

  // GitHub Sync Functions
  const handleConnect = async () => {
    if (!token.trim()) {
      const msg = 'Please enter a GitHub token';
      onToast ? onToast(msg, 'error') : alert(msg);
      return;
    }

    if (!validateGitHubToken(token.trim())) {
      const msg = 'Invalid GitHub token format. Expected ghp_* or github_pat_*';
      onToast ? onToast(msg, 'error') : alert(msg);
      return;
    }

    try {
      await GitHubSyncService.saveConfig({ token: token.trim() });
      setIsTokenSet(true);
      setToken('');
      const msg = 'Token saved! Now enter a repository name.';
      onToast ? onToast(msg, 'success') : alert(msg);
      handleHealthCheck();
    } catch (error) {
      console.error('GitHub connect error:', error);
      const msg = 'Failed to save token: ' + (error as Error).message;
      onToast ? onToast(msg, 'error') : alert(msg);
    }
  };

  const handleHealthCheck = async () => {
    setHealthStatus({ status: 'checking', message: 'Checking connection...' });
    const result = await GitHubSyncService.checkHealth();
    setHealthStatus({ status: result.status, message: result.message });
    if (result.status === 'ok') {
      onToast?.('GitHub connection verified!', 'success');
    } else {
      onToast?.('GitHub connection error: ' + result.message, 'error');
    }
  };

  const handleFullSync = async () => {
    if (!repoName.trim()) {
      const msg = 'Please enter a repository name';
      onToast ? onToast(msg, 'error') : alert(msg);
      return;
    }

    if (!validateRepositoryName(repoName.trim())) {
      const msg = 'Invalid repository name. Use only letters, numbers, hyphens, and underscores.';
      onToast ? onToast(msg, 'error') : alert(msg);
      return;
    }

    try {
      const config = await GitHubSyncService.getConfig();
      if (!config?.token) {
        onToast?.('Please connect your GitHub token first', 'error');
        return;
      }
      if (config.repoName !== repoName.trim()) {
        await GitHubSyncService.saveConfig({ ...config, repoName: repoName.trim() });
      }
    } catch (error) {
      onToast?.((error as Error).message, 'error');
      return;
    }

    setSyncPhase('fetching');
    setSyncProgress('');
    setSyncFetched(0);
    setSyncDone(0);
    setSyncTotal(0);
    setSyncPct(0);
    setSyncError('');
    startProgressPoll();

    try {
      const response: any = await sendMessageWithRetry({ type: 'fullSync' });

      setIsConfigured(true);
      const config = await GitHubSyncService.getConfig();
      setLastSyncTime(config?.lastSync || Date.now());

      if (response?.success) {
        const n = response.synced || 0;
        const msg = n > 0
          ? `✓ Synced ${n} new submission${n > 1 ? 's' : ''} to GitHub!`
          : 'Everything is already up to date.';
        onToast?.(msg, n > 0 ? 'success' : 'info');
      } else {
        onToast?.('Sync failed: ' + (response?.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      setSyncPhase('error');
      setSyncError((error as Error).message);
      onToast?.('Sync failed: ' + (error as Error).message, 'error');
    } finally {
      setSyncProgress('');
      if (pollRef.current) clearInterval(pollRef.current);
    }
  };

  /**
   * Send a message to the background service worker with automatic retry.
   * MV3 service workers can go idle; this wakes them up before sending.
   */
  const sendMessageWithRetry = (
    message: any,
    maxRetries = 3,
  ): Promise<any> => {
    return new Promise(async (resolve, reject) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const resp = await new Promise<any>((res, rej) => {
            chrome.runtime.sendMessage(message, (response) => {
              if (chrome.runtime.lastError) {
                rej(new Error(chrome.runtime.lastError.message));
              } else {
                res(response);
              }
            });
          });
          return resolve(resp);
        } catch (err: any) {
          const isConnectionError =
            err.message?.includes('Receiving end does not exist') ||
            err.message?.includes('Could not establish connection');

          if (isConnectionError && attempt < maxRetries - 1) {
            console.warn(`[Popup] Service worker not ready, retrying (${attempt + 1}/${maxRetries})…`);
            // Ping the service worker to wake it up
            await new Promise<void>((r) => setTimeout(r, 500));
            continue;
          }
          return reject(err);
        }
      }
      reject(new Error('Failed to connect to background service worker'));
    });
  };

  const handleDisconnect = async () => {
    try {
      await GitHubSyncService.disconnect();
      setIsTokenSet(false);
      setIsConfigured(false);
      setRepoName('');
      setLastSyncTime(null);
      onToast?.('GitHub disconnected', 'success');
    } catch {
      onToast?.('Failed to disconnect', 'error');
    }
  };

  // General Settings Functions
  const handleUsernameUpdate = async () => {
    if (!newUsername.trim()) {
      alert('Please enter a valid username');
      return;
    }

    try {
      await chrome.storage.local.set({ own_username: newUsername.trim().toLowerCase() });
      onUsernameChange(newUsername.trim().toLowerCase());
      alert('Username updated successfully!');
    } catch (error) {
      alert('Failed to update username');
    }
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await chrome.storage.local.set({ notifications_enabled: enabled });
  };

  const handleAutoRefreshToggle = async (enabled: boolean) => {
    setAutoRefresh(enabled);
    await chrome.storage.local.set({ auto_refresh: enabled });
    
    // Notify background script to update alarm
    sendMessageWithRetry({ 
      action: 'updateRefreshSettings', 
      autoRefresh: enabled,
      interval: refreshInterval 
    }).catch(() => { /* non-critical */ });
  };

  const handleRefreshIntervalChange = async (interval: number) => {
    setRefreshInterval(interval);
    await chrome.storage.local.set({ refresh_interval: interval });
    
    if (autoRefresh) {
      sendMessageWithRetry({ 
        action: 'updateRefreshSettings', 
        autoRefresh: true,
        interval 
      }).catch(() => { /* non-critical */ });
    }
  };

  const handleDailyGoalChange = async (goal: number) => {
    setDailyGoal(goal);
    await chrome.storage.local.set({ daily_goal: goal });
    onToast?.('Daily goal updated!', 'success');
  };

  const handleClearData = async () => {
    if (!confirm('Clear all extension data? This will remove all friends and profiles.')) return;

    try {
      await chrome.storage.local.clear();
      alert('All data cleared. Please reload the extension.');
      window.location.reload();
    } catch (error) {
      alert('Failed to clear data');
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const date = new Date(lastSyncTime);
    return date.toLocaleString();
  };

  return (
    <div className="settings-tab">
      {/* General Settings */}
      <section className="settings-section">
        <h3 className="settings-title">General Settings</h3>
        
        <div className="settings-item">
          <label className="settings-label">Your LeetCode Username</label>
          <p className="settings-hint">
            Current: {ownUsername || 'Not set'}
          </p>
          <div className="settings-input-group">
            <input
              type="text"
              placeholder="Enter new username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="settings-input"
            />
            <button onClick={handleUsernameUpdate} className="settings-btn">
              Update
            </button>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-toggle">
            <div>
              <label className="settings-label">Dark Mode</label>
              <p className="settings-hint">Switch between light and dark theme</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={(e) => onToggleDarkMode()}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-toggle">
            <div>
              <label className="settings-label">Notifications</label>
              <p className="settings-hint">Get notified when friends solve problems</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => handleNotificationsToggle(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-toggle">
            <div>
              <label className="settings-label">Auto Refresh</label>
              <p className="settings-hint">Automatically refresh friend data in background</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => handleAutoRefreshToggle(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {autoRefresh && (
          <div className="settings-item">
            <label className="settings-label">Refresh Interval</label>
            <select
              value={refreshInterval}
              onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
              className="settings-select"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={360}>6 hours</option>
              <option value={720}>12 hours</option>
            </select>
          </div>
        )}

        <div className="settings-item">
          <label className="settings-label">Daily Solve Goal</label>
          <p className="settings-hint">Set your daily target for the progress bar</p>
          <div className="settings-input-group" style={{ maxWidth: '120px' }}>
            <input
              type="number"
              min="1"
              max="100"
              value={dailyGoal}
              onChange={(e) => handleDailyGoalChange(parseInt(e.target.value) || 3)}
              className="settings-input"
            />
            <span style={{ fontSize: '13px', color: '#888', marginLeft: '8px' }}>solves</span>
          </div>
        </div>
      </section>

      {/* GitHub Sync */}
      <section className="settings-section">
        <h3 className="settings-title">GitHub Backup</h3>
        
        {!isTokenSet ? (
          <div className="settings-item">
            <label className="settings-label">Step 1: GitHub Personal Access Token</label>
            <p className="settings-hint">
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=L'Amigo%20Backup" target="_blank" rel="noopener noreferrer">
                Click here to create a token
              </a>
              {' '}with 'repo' scope enabled and set expiration to 'No expiration'
            </p>
            <div className="settings-input-group">
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="settings-input"
              />
              <button 
                onClick={handleConnect} 
                disabled={!token.trim()}
                className="settings-btn"
              >
                Connect
              </button>
            </div>
          </div>
        ) : !isConfigured ? (
          <>
            <div className="settings-item">
              <p className="settings-status connected">Token Connected</p>
            </div>
            <div className="settings-item">
              <label className="settings-label">Step 2: Repository Name</label>
              <p className="settings-hint">
                Enter a name for your repository (will be created automatically). All your solved problems will be synced here.
              </p>
              <div className="settings-input-group">
                <input
                  type="text"
                  placeholder="leetcode-backup"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="settings-input"
                />
              </div>
            </div>
            <div className="settings-actions">
              <button 
                onClick={handleFullSync}
                disabled={isSyncingNow || !repoName.trim()}
                className="settings-btn settings-btn-primary"
              >
                {syncButtonLabel}
              </button>
              <button 
                onClick={handleDisconnect}
                className="settings-btn settings-btn-secondary"
              >
                Disconnect
              </button>
            </div>

            {/* ── Progress bar ── */}
            {isSyncingNow && (
              <div className="sync-progress-container">
                <div className="sync-progress-bar">
                  <div
                    className={`sync-progress-fill ${syncPct === -1 ? 'indeterminate' : ''}`}
                    style={syncPct >= 0 ? { width: `${syncPct}%` } : undefined}
                  />
                </div>
                <p className="sync-progress-text">
                  {syncPhase === 'fetching'
                    ? `Finding submissions… ${syncFetched > 0 ? `${syncFetched} found` : ''}`
                    : `Pushing to GitHub… ${syncDone}/${syncTotal} (${syncPct}%)`}
                </p>
              </div>
            )}
            {syncPhase === 'error' && (
              <p className="sync-progress-text sync-error-text">⚠ {syncError}</p>
            )}

            <p className="settings-hint" style={{ fontSize: '11px', marginTop: '10px' }}>
              💡 One click fetches every accepted submission via LeetCode API, skips ones already on GitHub, and uploads the rest.
            </p>
          </>
        ) : (
          <>
            <div className="settings-item">
              <label className="settings-label">Repository</label>
              <p className="settings-hint">{repoName || 'Not set'}</p>
              <p className="settings-status connected">✓ Active - Auto-syncing in background</p>
              {lastSyncTime && <p className="settings-hint">Last sync: {formatLastSync()}</p>}
              <p className="settings-hint">Solves auto-sync to GitHub even when popup is closed</p>
            </div>

            <div className="settings-item">
              <label className="settings-label">Change Repository</label>
              <p className="settings-hint">
                Update repository name (new problems will sync here)
              </p>
              <div className="settings-input-group">
                <input
                  type="text"
                  placeholder="e.g., leetcode-solutions"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="settings-input"
                />
              </div>
            </div>

            <div className="settings-actions">
              <button 
                onClick={handleHealthCheck}
                disabled={healthStatus.status === 'checking'}
                className="settings-btn settings-btn-secondary"
              >
                {healthStatus.status === 'checking' ? 'Checking...' : 'Verify Setup'}
              </button>
              <button 
                onClick={handleFullSync}
                disabled={isSyncingNow || !repoName.trim()}
                className="settings-btn settings-btn-primary"
              >
                {syncButtonLabel}
              </button>
              <button 
                onClick={handleDisconnect}
                className="settings-btn settings-btn-secondary"
              >
                Disconnect
              </button>
            </div>

            {healthStatus.status !== 'idle' && (
              <p className={`settings-status ${healthStatus.status === 'ok' ? 'connected' : 'error'}`}>
                {healthStatus.status === 'ok' ? '✓' : '⚠'} {healthStatus.message}
              </p>
            )}

            {/* ── Progress bar ── */}
            {isSyncingNow && (
              <div className="sync-progress-container">
                <div className="sync-progress-bar">
                  <div
                    className={`sync-progress-fill ${syncPct === -1 ? 'indeterminate' : ''}`}
                    style={syncPct >= 0 ? { width: `${syncPct}%` } : undefined}
                  />
                </div>
                <p className="sync-progress-text">
                  {syncPhase === 'fetching'
                    ? `Finding submissions… ${syncFetched > 0 ? `${syncFetched} found` : ''}`
                    : `Pushing to GitHub… ${syncDone}/${syncTotal} (${syncPct}%)`}
                </p>
              </div>
            )}
            {syncPhase === 'error' && (
              <p className="sync-progress-text sync-error-text">⚠ {syncError}</p>
            )}

            {/* ── Sync History ── */}
            {syncHistory.length > 0 && (
              <div className="sync-history-section">
                <h4 className="submenu-title">Recent Syncs</h4>
                <div className="sync-history-list">
                  {syncHistory.map((entry, idx) => (
                    <div key={idx} className="sync-history-item">
                      <div className="sync-history-meta">
                        <span className="sync-history-date">
                          {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`sync-history-status ${entry.status}`}>
                          {entry.status === 'success' ? `✓ ${entry.problemsSynced} solved` : `⚠ Failed`}
                        </span>
                      </div>
                      {entry.problems && entry.problems.length > 0 && (
                        <p className="sync-history-details">
                          {entry.problems.join(', ')}{entry.problemsSynced > 5 ? '...' : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="settings-hint" style={{ fontSize: '11px', marginTop: '10px' }}>
              💡 We remember each synced submission, so future clicks (and background auto-sync) only upload new solves. Syncs ALL your solved problems!
            </p>
          </>
        )}
      </section>

      {/* Data Management */}
      <section className="settings-section">
        <h3 className="settings-title">Data Management</h3>
        
        <div className="settings-item">
          <label className="settings-label">Clear All Data</label>
          <p className="settings-hint">Remove all friends, profiles, and settings</p>
          <button 
            onClick={handleClearData}
            className="settings-btn settings-btn-danger"
          >
            Clear Data
          </button>
        </div>
      </section>

      {/* About */}
      <section className="settings-section">
        <h3 className="settings-title">About</h3>
        <div className="settings-about">
          <p><strong>L'Amigo</strong> - LeetCode Friends Tracker</p>
          <p>Version {chrome.runtime.getManifest().version}</p>
          <p className="settings-hint">Track your friends' progress and stay motivated!</p>
          
          {isConfigured && lastSyncTime && (
            <p className="settings-hint" style={{ color: '#FFA116', marginTop: '10px' }}>
              ✓ Dynamically synced history to GitHub
            </p>
          )}

          <div className="about-links" style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a 
              href="https://lamigo.netlify.app" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#FFA116', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              Official Website
            </a>
            <a 
              href="https://github.com/FTS18/l-amigo" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#FFA116', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z"/></svg>
              Star L'Amigo on GitHub
            </a>
            <a 
              href="https://github.com/FTS18/l-amigo/issues" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#FFA116', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-1 6h2v8h-2v-8zm1 12.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/></svg>
              Report an Issue / Suggest Feature
            </a>
            <a 
              href="https://github.com/FTS18/l-amigo/blob/main/LICENSE" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#FFA116', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0 2c2.67 0 8 1.34 8 4v2H4v-2c0-2.66 5.33-4 8-4z"/></svg>
              Open Source (MIT License)
            </a>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="settings-section">
        <h3 className="settings-section-title">⌨️ Keyboard Shortcuts</h3>
        <p className="settings-hint">Power user shortcuts for faster navigation</p>
        
        <div style={{ marginTop: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '8px', fontWeight: 600 }}>Shortcut</th>
                <th style={{ padding: '8px', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '8px' }}><code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>r</code></td>
                <td style={{ padding: '8px' }}>Refresh all friends</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '8px' }}><code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>j</code></td>
                <td style={{ padding: '8px' }}>Navigate down in friends list</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '8px' }}><code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>k</code></td>
                <td style={{ padding: '8px' }}>Navigate up in friends list</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '8px' }}><code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>1</code></td>
                <td style={{ padding: '8px' }}>Switch to Friends tab</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '8px' }}><code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>2</code></td>
                <td style={{ padding: '8px' }}>Switch to Compare tab</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '8px' }}><code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>3</code></td>
                <td style={{ padding: '8px' }}>Switch to Settings tab</td>
              </tr>
              <tr>
                <td style={{ padding: '8px' }}><code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>Esc</code></td>
                <td style={{ padding: '8px' }}>Close menu</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
