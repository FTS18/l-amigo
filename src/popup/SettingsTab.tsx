import React, { useState, useEffect, useRef } from 'react';
import { GitHubSyncService } from '../services/github';
import { REFRESH_CONSTANTS } from '../constants';

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
      'own_username'
    ]);
    
    setNotificationsEnabled(settings.notifications_enabled ?? true);
    setAutoRefresh(settings.auto_refresh ?? true);
    setRefreshInterval(settings.refresh_interval ?? REFRESH_CONSTANTS.INTERVAL_MINUTES);
    setNewUsername(settings.own_username || '');
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

    try {
      await GitHubSyncService.saveConfig({ token: token.trim() });
      setIsTokenSet(true);
      setToken('');
      const msg = 'Token saved! Now enter a repository name.';
      onToast ? onToast(msg, 'success') : alert(msg);
    } catch (error) {
      console.error('GitHub connect error:', error);
      const msg = 'Failed to save token: ' + (error as Error).message;
      onToast ? onToast(msg, 'error') : alert(msg);
    }
  };

  const handleFullSync = async () => {
    if (!repoName.trim()) {
      const msg = 'Please enter a repository name';
      onToast ? onToast(msg, 'error') : alert(msg);
      return;
    }

    // Save repo name first
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
        </div>
      </section>
    </div>
  );
};
