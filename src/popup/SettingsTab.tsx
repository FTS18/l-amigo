import React, { useState, useEffect, useRef } from 'react';
import { Check, AlertTriangle, Keyboard, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { GitHubSyncService } from '../services/github';
import { ExportService } from '../services/export';
import { REFRESH_CONSTANTS } from '../constants';
import { validateGitHubToken, validateRepositoryName } from '../utils/sanitize';
import { sendMessageWithRetry } from '../utils/messaging';
import { SyncEntry } from '../utils/import-restore';

interface SettingsTabProps {
  onSync: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  ownUsername: string;
  onUsernameChange: (username: string) => void;
  ownCodeforcesHandle?: string;
  onCodeforcesHandleChange?: (handle: string) => void;
  ownCodechefHandle?: string;
  onCodechefHandleChange?: (handle: string) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onConfirmAction?: (action: () => void, title: string, message: string) => void;
  onOpenImportExport?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ 
  onSync, 
  isDarkMode, 
  onToggleDarkMode,
  ownUsername,
  onUsernameChange,
  ownCodeforcesHandle = '',
  onCodeforcesHandleChange,
  ownCodechefHandle = '',
  onCodechefHandleChange,
  onToast,
  onConfirmAction,
  onOpenImportExport
}) => {
  const [activeSection, setActiveSection] = useState<string>('profile');
  const [repoName, setRepoName] = useState('');
  const [token, setToken] = useState('');
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

  const [deviceFlowState, setDeviceFlowState] = useState<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  } | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncEntry[]>([]);
  
  // Collapsible sections state
  const [expanded, setExpanded] = useState({
    profile: true,
    preferences: false,
    data: false,
    about: false,
    shortcuts: false
  });

  const toggleSection = (sec: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // General Settings
  const [newUsername, setNewUsername] = useState('');
  const [newCFHandle, setNewCFHandle] = useState('');
  const [newCCHandle, setNewCCHandle] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [healthStatus, setHealthStatus] = useState<{ status: 'idle' | 'checking' | 'ok' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [dailyGoal, setDailyGoal] = useState(3);
  const [cfDarkMode, setCfDarkMode] = useState(false);

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

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && changes.last_backup_time) {
        setLastBackupTime(changes.last_backup_time.newValue || null);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
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
      'own_codeforces_handle',
      'own_codechef_handle',
      'sync_history',
      'cf_dark_mode',
      'last_backup_time',
      'daily_goal'
    ]);
    
    setNotificationsEnabled(settings.notifications_enabled ?? true);
    setAutoRefresh(settings.auto_refresh ?? true);
    setRefreshInterval(settings.refresh_interval ?? REFRESH_CONSTANTS.INTERVAL_MINUTES);
    setNewUsername(settings.own_username || '');
    setNewCFHandle(settings.own_codeforces_handle || '');
    setNewCCHandle(settings.own_codechef_handle || '');
    setSyncHistory(settings.sync_history || []);
    setCfDarkMode(settings.cf_dark_mode || false);
    setDailyGoal(settings.daily_goal || 3);
    setLastBackupTime(settings.last_backup_time || null);
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

  const handleOAuthLogin = async () => {
    setSyncError('');
    setIsLoggingIn(true);
    try {
      const state = await GitHubSyncService.requestDeviceCode();
      setDeviceFlowState(state);
      
      chrome.tabs.create({ url: state.verification_uri });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const accessToken = await GitHubSyncService.pollForToken(
        state.device_code,
        state.interval,
        controller.signal
      );

      await GitHubSyncService.saveConfig({ token: accessToken });
      setIsTokenSet(true);
      setToken('');
      const msg = 'Authentication successful! Now enter a repository name.';
      onToast ? onToast(msg, 'success') : alert(msg);
      handleHealthCheck();
      setDeviceFlowState(null);
    } catch (err: any) {
      if (err.message && err.message.includes('device_flow_disabled')) {
        console.log("Device flow disabled. Falling back to standard OAuth.");
        chrome.runtime.sendMessage({ action: 'githubOAuthLogin' }, async (res) => {
          if (res && res.success) {
            await GitHubSyncService.saveConfig({ token: res.token });
            setIsTokenSet(true);
            setToken('');
            const msg = 'Authentication successful! Now enter a repository name.';
            onToast ? onToast(msg, 'success') : alert(msg);
            handleHealthCheck();
          } else {
            setSyncError(res?.error || 'OAuth authentication failed.');
            onToast?.(res?.error || 'OAuth authentication failed.', 'error');
          }
          setDeviceFlowState(null);
          setIsLoggingIn(false);
        });
        return;
      } else {
        if (err.message !== 'Device authorization cancelled.') {
          setSyncError(err.message || 'Authentication failed.');
          onToast?.(err.message || 'Authentication failed.', 'error');
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
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
          ? `Synced ${n} new submission${n > 1 ? 's' : ''} to GitHub!`
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

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    try {
      await GitHubSyncService.backupState();
      const settings = await chrome.storage.local.get('last_backup_time');
      setLastBackupTime(settings.last_backup_time || Date.now());
      onToast?.('Settings backed up successfully!', 'success');
    } catch (err: any) {
      onToast?.('Failed to backup settings: ' + err.message, 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  // General Settings Functions
  const handleUsernameUpdate = async () => {
    if (!newUsername.trim()) {
      onToast?.('Please enter a valid username', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({ own_username: newUsername.trim().toLowerCase() });
      onUsernameChange(newUsername.trim().toLowerCase());
      onToast?.('Username updated successfully!', 'success');
      onSync();
    } catch (error) {
      onToast?.('Failed to update username', 'error');
    }
  };

  const handleCFHandleUpdate = async () => {
    if (!newCFHandle.trim()) {
      onToast?.('Please enter a valid handle', 'error');
      return;
    }

    try {
      const handle = newCFHandle.trim().toLowerCase();
      await chrome.storage.local.set({ own_codeforces_handle: handle });
      if (onCodeforcesHandleChange) {
        onCodeforcesHandleChange(handle);
      }
      onToast?.('Codeforces handle updated successfully!', 'success');
      onSync();
    } catch (error) {
      onToast?.('Failed to update Codeforces handle', 'error');
    }
  };

  const handleCCHandleUpdate = async () => {
    if (!newCCHandle.trim()) {
      onToast?.('Please enter a valid handle', 'error');
      return;
    }

    try {
      const handle = newCCHandle.trim().toLowerCase();
      await chrome.storage.local.set({ own_codechef_handle: handle });
      if (onCodechefHandleChange) {
        onCodechefHandleChange(handle);
      }
      onToast?.('CodeChef handle updated successfully!', 'success');
      onSync();
    } catch (error) {
      onToast?.('Failed to update CodeChef handle', 'error');
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
    if (!onConfirmAction) return;
    
    onConfirmAction(async () => {
      try {
        await chrome.storage.local.clear();
        onToast?.('All data cleared. Please reload the extension.', 'info');
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        onToast?.('Failed to clear data', 'error');
      }
    }, 'Clear All Data', 'Clear all extension data? This will remove all friends and profiles. This action cannot be undone.');
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const date = new Date(lastSyncTime);
    return date.toLocaleString();
  };

  const renderSectionHeader = (id: keyof typeof expanded, title: React.ReactNode) => (
    <div
      onClick={() => toggleSection(id)}
      className={`settings-section-header${expanded[id] ? ' settings-section-header--expanded' : ''}`}
    >
      <h3 className="settings-title settings-title--no-margin">{title}</h3>
      {expanded[id] ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
    </div>
  );

  return (
    <div className="settings-tab">
      {/* Profile Connections */}
      <section className="settings-section">
        {renderSectionHeader('profile', 'Profile Connections')}
        
        {expanded.profile && (
          <div className="settings-section-content">
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
              <label className="settings-label">Your Codeforces Handle</label>
              <p className="settings-hint">
                Current: {ownCodeforcesHandle || 'Not set'}
              </p>
              <div className="settings-input-group">
                <input
                  type="text"
                  placeholder="Enter new handle"
                  value={newCFHandle}
                  onChange={(e) => setNewCFHandle(e.target.value)}
                  className="settings-input"
                />
                <button onClick={handleCFHandleUpdate} className="settings-btn">
                  Update
                </button>
              </div>
            </div>

            <div className="settings-item">
              <label className="settings-label">Your CodeChef Handle</label>
              <p className="settings-hint">
                Current: {ownCodechefHandle || 'Not set'}
              </p>
              <div className="settings-input-group">
                <input
                  type="text"
                  placeholder="Enter new handle"
                  value={newCCHandle}
                  onChange={(e) => setNewCCHandle(e.target.value)}
                  className="settings-input"
                />
                <button onClick={handleCCHandleUpdate} className="settings-btn">
                  Update
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Application Preferences */}
      <section className="settings-section">
        {renderSectionHeader('preferences', 'Application Preferences')}
        
        {expanded.preferences && (
          <div className="settings-section-content">
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

            <div className="settings-item toggle-row">
              <div className="toggle-info">
                <label className="settings-label">Codeforces Dark Mode</label>
                <p className="settings-hint">Enable experimental dark mode for Codeforces.com</p>
              </div>
              <div className="toggle-wrapper">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={cfDarkMode}
                    onChange={(e) => {
                      setCfDarkMode(e.target.checked);
                      chrome.storage.local.set({ cf_dark_mode: e.target.checked });
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="settings-item">
              <label className="settings-label">Daily Solve Goal</label>
              <p className="settings-hint">Set your daily target for the progress bar</p>
              <div className="settings-input-group settings-input-group-small">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={dailyGoal}
                  onChange={(e) => handleDailyGoalChange(parseInt(e.target.value) || 3)}
                  className="settings-input"
                />
                <span className="settings-goal-unit">solves</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Data Management */}
      <section className="settings-section">
        {renderSectionHeader('data', 'Data Management')}
        
        {expanded.data && (
          <div className="settings-section-content">
            <h4 className="settings-subsection-title">GitHub Backup</h4>
            {!isTokenSet ? (
              <div className="settings-item">
                <label className="settings-label">Step 1: Connect GitHub Account</label>
                <p className="settings-hint">
                  Link your GitHub account via Device Flow or use a Personal Access Token below.
                </p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexDirection: 'column' }}>
                  {!deviceFlowState ? (
                    <button onClick={handleOAuthLogin} className="settings-btn" style={{ flex: 1, backgroundColor: '#2da44e', color: 'white' }} disabled={isLoggingIn}>
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
                        Waiting for authorization...
                      </p>
                      <button
                        type="button"
                        onClick={cancelDeviceFlow}
                        className="settings-btn"
                        style={{ marginTop: '12px', padding: '6px 12px', fontSize: '12px', width: 'auto' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div className="settings-divider">OR</div>
                <p className="settings-hint">
                  <a href="https://github.com/settings/tokens/new?scopes=repo&description=L'Amigo%20Backup" target="_blank" rel="noopener noreferrer">
                    Click here to create a PAT token
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
                    className="settings-btn"
                  >
                    Save
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

                <p className="settings-hint settings-hint--sm">
                  <Lightbulb size={14} className="inline-icon hint-icon" /> One click fetches every accepted submission via LeetCode API, skips ones already on GitHub, and uploads the rest.
                </p>
              </>
            ) : (
              <>
                <div className="settings-item">
                  <label className="settings-label">Repository</label>
                  <p className="settings-hint">{repoName || 'Not set'}</p>
                  <p className="settings-status connected">✓ Active - Auto-syncing in background</p>
                  {lastSyncTime && <p className="settings-hint">Last sync: {formatLastSync()}</p>}
                  {lastBackupTime ? (
                    <p className="settings-hint">Last backup: {new Date(lastBackupTime).toLocaleString()}</p>
                  ) : (
                    <p className="settings-hint">Last backup: Never</p>
                  )}
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
                    onClick={handleManualBackup}
                    disabled={isBackingUp}
                    className="settings-btn settings-btn-secondary"
                  >
                    {isBackingUp ? 'Backing up...' : 'Backup Settings Now'}
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
                    <h4 className="settings-subsection-title sync-history-title">Recent Syncs</h4>
                    <div className="sync-history-list sync-history-list--grid">
                      {/* Show pagination / improved spacing */}
                      {syncHistory.slice(0, 10).map((entry, idx) => (
                        <div key={idx} className="sync-history-item sync-history-item--card">
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
                              {entry.problems.slice(0, 4).join(', ')}{entry.problems.length > 4 ? ` + ${entry.problems.length - 4} more` : ''}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="settings-hint settings-hint--sm">
                  <Lightbulb size={14} className="inline-icon hint-icon" /> We remember each synced submission, so future clicks (and background auto-sync) only upload new solves. Syncs ALL your solved problems!
                </p>
              </>
            )}

            <hr className="settings-subsection-divider" />

            <h4 className="settings-subsection-title">Storage Cleanup</h4>
            <div className="settings-item">
              <label className="settings-label">Local Data Backup</label>
              <p className="settings-hint">Export or import your full friends list and app settings via the Import/Export panel</p>
              <div className="settings-actions">
                <button 
                  onClick={onOpenImportExport}
                  className="settings-btn settings-btn-primary"
                >
                  Open Import / Export
                </button>
              </div>
            </div>

            <hr className="settings-subsection-divider" />

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
          </div>
        )}
      </section>

      {/* About */}
      <section className="settings-section">
        {renderSectionHeader('about', 'About L\'Amigo')}
        
        {expanded.about && (
          <div className="settings-section-content">
            <div className="settings-about">
              <p><strong>L'Amigo</strong> - LeetCode Friends Tracker</p>
              <p>Version {chrome.runtime.getManifest().version}</p>
              <p className="settings-hint">Track your friends' progress and stay motivated!</p>
              
              {isConfigured && lastSyncTime && (
                <p className="settings-hint settings-hint--accent">
                  ✓ Dynamically synced history to GitHub
                </p>
              )}

              <div className="about-links--column">
                <a href="https://lamigo.netlify.app" target="_blank" rel="noopener noreferrer" className="about-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  Official Website
                </a>
                <a href="https://github.com/FTS18/l-amigo" target="_blank" rel="noopener noreferrer" className="about-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z"/></svg>
                  Star L'Amigo on GitHub
                </a>
                <a href="https://github.com/FTS18/l-amigo/issues" target="_blank" rel="noopener noreferrer" className="about-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-1 6h2v8h-2v-8zm1 12.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/></svg>
                  Report an Issue / Suggest Feature
                </a>
                <a href="https://github.com/FTS18/l-amigo/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="about-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0 2c2.67 0 8 1.34 8 4v2H4v-2c0-2.66 5.33-4 8-4z"/></svg>
                  Open Source (MIT License)
                </a>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Keyboard Shortcuts */}
      <section className="settings-section">
        {renderSectionHeader('shortcuts', <span><Keyboard size={18} className="kbd-icon" /> Keyboard Shortcuts</span>)}
        
        {expanded.shortcuts && (
          <div className="settings-section-content">
            <p className="settings-hint">Power user shortcuts for faster navigation</p>
            
            <div className="shortcuts-wrapper">
              <table className="settings-shortcut-table">
                <thead>
                  <tr>
                    <th>Shortcut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>r</code></td>
                    <td>Refresh all friends</td>
                  </tr>
                  <tr>
                    <td><code>j</code></td>
                    <td>Navigate down in friends list</td>
                  </tr>
                  <tr>
                    <td><code>k</code></td>
                    <td>Navigate up in friends list</td>
                  </tr>
                  <tr>
                    <td><code>1</code></td>
                    <td>Switch to Friends tab</td>
                  </tr>
                  <tr>
                    <td><code>2</code></td>
                    <td>Switch to Compare tab</td>
                  </tr>
                  <tr>
                    <td><code>3</code></td>
                    <td>Switch to Settings tab</td>
                  </tr>
                  <tr>
                    <td><code>Esc</code></td>
                    <td>Close menu</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

