import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, AlertTriangle, Keyboard, Lightbulb, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react';
import { GitHubSyncService } from '../services/github';
import { ExportService } from '../services/export';
import { REFRESH_CONSTANTS } from '../constants';
import { validateGitHubToken, validateRepositoryName } from '../utils/sanitize';
import { sendMessageWithRetry } from '../utils/messaging';
import { SyncEntry } from '../utils/import-restore';
import { LeetCodeIcon, CodeforcesIcon, CodeChefIcon, CsesIcon } from '../utils/PlatformIcons';

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
  ownCsesHandle?: string;
  onCsesHandleChange?: (handle: string) => void;
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
  ownCsesHandle = '',
  onCsesHandleChange,
  onToast,
  onConfirmAction,
  onOpenImportExport
}) => {
  const ss = <T,>(key: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(`set_${key}`);
      if (v !== null) return JSON.parse(v) as T;
    } catch { /* ignore */ }
    return fallback;
  };
  const setSS = <T,>(key: string, value: T) => {
    try { localStorage.setItem(`set_${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  };

  const [activeSection, _setActiveSection] = useState<string>(() => ss('activeSection', 'profile'));
  const setActiveSection = (v: string) => { setSS('activeSection', v); _setActiveSection(v); };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'set_activeSection' && e.newValue) {
        try { _setActiveSection(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
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
  const [syncFailed, setSyncFailed] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
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
  const [isHistoryOnly, setIsHistoryOnly] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncEntry[]>([]);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  
  const handleClearSyncHistory = () => {
    chrome.storage.local.remove('sync_history', () => {
      setSyncHistory([]);
    });
  };

  // Collapsible sections state
  const [expanded, setExpanded] = useState({
    profile: true,
    preferences: true,
    customization: true,
    accessibility: true,
    data: true,
    about: true,
    shortcuts: true
  });

  const toggleSection = (sec: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // General Settings
  const [newUsername, setNewUsername] = useState('');
  const [newCFHandle, setNewCFHandle] = useState('');
  const [newCCHandle, setNewCCHandle] = useState('');
  const [newCsesHandle, setNewCsesHandle] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [healthStatus, setHealthStatus] = useState<{ status: 'idle' | 'checking' | 'ok' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [dailyGoal, setDailyGoal] = useState(3);
  const [cfDarkMode, setCfDarkMode] = useState(false);
  const [fontSizeScale, setFontSizeScale] = useState(100);
  const [displayZoomScale, setDisplayZoomScale] = useState(100);
  const [showSyncInfo, setShowSyncInfo] = useState(false);

  // New Personalization Settings
  const [syncStrictness, setSyncStrictness] = useState(true);
  const [commitFrequency, setCommitFrequency] = useState<'immediate' | 'batch'>('immediate');
  const [smartBgRefresh, setSmartBgRefresh] = useState(true);
  const [blindMode, setBlindMode] = useState(false);
  const [disabledPlatforms, setDisabledPlatforms] = useState<string[]>([]);
  const [defaultTab, setDefaultTab] = useState<string>('friends');
  const [compactView, setCompactView] = useState(false);

  const handleFontSizeChange = (val: number) => {
    setFontSizeScale(val);
    chrome.storage.local.set({ font_size_scale: val });
  };

  const handleDisplayZoomChange = (val: number) => {
    setDisplayZoomScale(val);
    chrome.storage.local.set({ display_zoom_scale: val });
  };

  const handleResetAccessibility = () => {
    setFontSizeScale(100);
    setDisplayZoomScale(100);
    chrome.storage.local.set({ font_size_scale: 100, display_zoom_scale: 100 });
    if (onToast) onToast('Accessibility reset to default (100%)', 'success');
  };

  // Poll sync status from storage while sync is running
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncButtonLabel = useMemo(() => {
    if (syncPhase === 'fetching') {
      return `Fetching… ${syncFetched > 0 ? `(${syncFetched})` : ''}`;
    }
    if (syncPhase === 'syncing') {
      return `Syncing (${syncDone}/${syncTotal})`;
    }
    if (syncPhase === 'error') {
      return 'Sync Failed - Retry';
    }
    return isHistoryOnly ? 'Fast Sync (History)' : 'Sync to GitHub';
  }, [syncPhase, syncFetched, syncDone, syncTotal, isHistoryOnly]);

  const isSyncingNow = syncPhase === 'fetching' || syncPhase === 'syncing';

  useEffect(() => {
    loadAllSettings();
    // Check if a sync was already running (e.g. popup was closed/reopened)
    checkOngoingSync();

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local') return;
      
      // Live backup time update
      if (changes.last_backup_time) {
        setLastBackupTime(changes.last_backup_time.newValue || null);
      }
      
      // Live sync_status reconnect: if bg sync transitions to fetching/syncing, immediately start polling
      if (changes.sync_status) {
        const newStatus = changes.sync_status.newValue;
        if (newStatus === 'fetching' || newStatus === 'syncing') {
          if (newStatus === 'fetching') setSyncFailed(0);
          setSyncPhase(newStatus);
          startProgressPoll();
        } else if (newStatus === 'idle') {
          setSyncPhase('idle');
          setSyncProgress('');
          setSyncPct(0);
          if (pollRef.current) clearInterval(pollRef.current);
          // Refresh sync history and failed count
          chrome.storage.local.get(['sync_history', 'sync_progress_failed']).then(r => {
            if (r.sync_history) setSyncHistory(r.sync_history);
            if (r.sync_progress_failed) setSyncFailed(r.sync_progress_failed);
          });
        } else if (newStatus === 'error') {
          setSyncPhase('error');
          chrome.storage.local.get('sync_error').then(r => {
            setSyncError(r.sync_error || 'Unknown error');
          });
          if (pollRef.current) clearInterval(pollRef.current);
        }
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
      'sync_progress_done', 'sync_progress_total', 'sync_error', 'sync_progress_failed'
    ]);
    if (s.sync_status === 'fetching' || s.sync_status === 'syncing') {
      const session = await chrome.storage.session.get("sync_in_progress");
      if (!session.sync_in_progress) {
        await chrome.storage.local.set({ sync_status: 'idle' });
        setSyncPhase('idle');
        return;
      }
      setSyncPhase(s.sync_status);
      setSyncFetched(s.sync_progress_fetch || 0);
      setSyncDone(s.sync_progress_done || 0);
      setSyncTotal(s.sync_progress_total || 0);
      setSyncFailed(s.sync_progress_failed || 0);
      if (s.sync_status === 'syncing' && s.sync_progress_total > 0) {
        setSyncPct(Math.round(((s.sync_progress_done || 0) / s.sync_progress_total) * 100));
      }
      startProgressPoll();
    } else if (s.sync_status === 'error') {
      setSyncPhase('error');
      setSyncError(s.sync_error || 'Unknown error');
    } else {
      setSyncFailed(s.sync_progress_failed || 0);
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
      'own_cses_handle',
      'sync_history',
      'cf_dark_mode',
      'last_backup_time',
      'daily_goal',
      'font_size_scale',
      'display_zoom_scale',
      'sync_strictness',
      'commit_frequency',
      'smart_bg_refresh',
      'blind_mode',
      'disabled_platforms',
      'default_startup_tab',
      'compact_view'
    ]);
    
    setNotificationsEnabled(settings.notifications_enabled ?? true);
    setAutoRefresh(settings.auto_refresh ?? true);
    setRefreshInterval(settings.refresh_interval ?? REFRESH_CONSTANTS.INTERVAL_MINUTES);
    
    setSyncStrictness(settings.sync_strictness ?? true);
    setCommitFrequency(settings.commit_frequency ?? 'immediate');
    setSmartBgRefresh(settings.smart_bg_refresh ?? true);
    setBlindMode(settings.blind_mode ?? false);
    setDisabledPlatforms(settings.disabled_platforms ?? []);
    setDefaultTab(settings.default_startup_tab ?? 'friends');
    setCompactView(settings.compact_view ?? false);
    setNewUsername(settings.own_username || '');
    setNewCFHandle(settings.own_codeforces_handle || '');
    setNewCCHandle(settings.own_codechef_handle || '');
    setNewCsesHandle(settings.own_cses_handle || '');
    setSyncHistory(settings.sync_history || []);
    setCfDarkMode(settings.cf_dark_mode || false);
    setDailyGoal(settings.daily_goal || 3);
    setLastBackupTime(settings.last_backup_time || null);
    setFontSizeScale(settings.font_size_scale ?? 100);
    setDisplayZoomScale(settings.display_zoom_scale ?? 100);
  };

  // Start polling sync progress from chrome.storage.local
  const startProgressPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const session = await chrome.storage.session.get("sync_in_progress");
      if (!session.sync_in_progress) {
        await chrome.storage.local.set({ sync_status: 'idle' });
        setSyncPhase('idle');
        setSyncProgress('');
        setSyncPct(0);
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      const s = await chrome.storage.local.get([
        'sync_status', 'sync_progress_fetch',
        'sync_progress_done', 'sync_progress_total', 'sync_error', 'debug_sync_info', 'sync_progress_failed',
      ]);
      if (s.debug_sync_info) setDebugInfo(s.debug_sync_info);
      if (s.sync_progress_failed) setSyncFailed(s.sync_progress_failed);
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

    const requestGitHubPermissions = (): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!chrome?.permissions?.request) {
          resolve(true);
          return;
        }
        chrome.permissions.request({
          origins: ['https://api.github.com/*', 'https://github.com/*']
        }, (granted) => {
          resolve(granted);
        });
      });
    };

    const granted = await requestGitHubPermissions();
    if (!granted) {
      const msg = 'GitHub host permissions are required to sync solutions.';
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

    const requestGitHubOAuthPermissions = (): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!chrome?.permissions?.request) {
          resolve(true);
          return;
        }
        chrome.permissions.request({
          permissions: ['identity'],
          origins: ['https://api.github.com/*', 'https://github.com/*']
        }, (granted) => {
          resolve(granted);
        });
      });
    };

    const granted = await requestGitHubOAuthPermissions();
    if (!granted) {
      const msg = 'GitHub permissions are required to enable automatic syncing.';
      setSyncError(msg);
      onToast?.(msg, 'error');
      setIsLoggingIn(false);
      return;
    }

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
    try {
      const result = await GitHubSyncService.checkHealth();
      setHealthStatus({ status: result.status, message: result.message });
      if (result.status === 'ok') {
        onToast?.('GitHub connection verified!', 'success');
      } else {
        onToast?.('GitHub connection error: ' + result.message, 'error');
      }
    } catch (error) {
      const msg = (error as Error).message || 'Unknown error';
      setHealthStatus({ status: 'error', message: msg });
      onToast?.('GitHub connection error: ' + msg, 'error');
    }
  };

  const handleFullSync = async (e: boolean | React.MouseEvent = false) => {
    let isForceFull = false;
    let isForceCf = false;

    if (typeof e === 'object' && 'altKey' in e) {
      isForceFull = e.altKey;
    } else if (typeof e === 'boolean') {
      isForceCf = e;
    }

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

    setHealthStatus({ status: 'checking', message: 'Checking connection...' });
    try {
      const result = await GitHubSyncService.checkHealth();
      setHealthStatus({ status: result.status, message: result.message });
      if (result.status !== 'ok') {
        onToast?.('GitHub connection error: ' + result.message, 'error');
        return;
      }
    } catch (error) {
      const msg = (error as Error).message || 'Unknown error';
      setHealthStatus({ status: 'error', message: msg });
      onToast?.('GitHub connection error: ' + msg, 'error');
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

    const executeSync = async () => {
      try {
        await chrome.storage.session.remove('cancel_sync');
      } catch (error) {
        onToast?.('Failed to clear sync session data', 'error');
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
        const response: any = await sendMessageWithRetry({ type: 'fullSync', forceCfOnly: isForceCf, historyOnly: isHistoryOnly });

        setIsConfigured(true);

        if (response?.success) {
          const n = response.synced || 0;
          const msg = n > 0
            ? `Synced ${n} new submission${n > 1 ? 's' : ''} to GitHub!`
            : 'Everything is already up to date.';
          onToast?.(msg, n > 0 ? 'success' : 'info');
          
          await new Promise(r => setTimeout(r, 500));
          const config = await GitHubSyncService.getConfig();
          setLastSyncTime(config?.lastSync || Date.now());
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
        const s = await chrome.storage.local.get(['sync_status', 'sync_history']);
        if (s.sync_status === 'idle') {
          setSyncPhase('idle');
          if (s.sync_history) setSyncHistory(s.sync_history);
        } else if (s.sync_status === 'error') {
          setSyncPhase('error');
        } else {
          await chrome.storage.local.set({ sync_status: 'idle' });
          setSyncPhase('idle');
          if (s.sync_history) setSyncHistory(s.sync_history);
        }
      }
    };

    if (isForceFull) {
      if (!onConfirmAction) return;
      onConfirmAction(async () => {
        await chrome.storage.local.remove('all_accepted_submissions');
        onToast?.('Cleared sync cache. Starting full sync...', 'info');
        await executeSync();
      }, 'Force Full Sync', 'This will clear your local sync cache and re-fetch all submissions from LeetCode and Codeforces. Are you sure?');
    } else {
      await executeSync();
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
      if (settings.last_backup_time) {
        setLastBackupTime(settings.last_backup_time);
        onToast?.('Settings backed up successfully!', 'success');
      } else {
        onToast?.('Backup completed but failed to verify timestamp', 'error');
      }
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
      // CF handles are case-sensitive — preserve the user's casing exactly
      const handle = newCFHandle.trim();
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

  const handleCsesHandleUpdate = async () => {
    if (!newCsesHandle.trim()) {
      onToast?.('Please enter a valid handle', 'error');
      return;
    }
    try {
      const handle = newCsesHandle.trim();
      await chrome.storage.local.set({ own_cses_handle: handle });
      if (onCsesHandleChange) onCsesHandleChange(handle);
      onToast?.('CSES handle updated successfully!', 'success');
      onSync();
    } catch (error) {
      onToast?.('Failed to update CSES handle', 'error');
    }
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    if (enabled) {
      if (chrome?.permissions?.request) {
        chrome.permissions.request({ permissions: ['notifications'] }, async (granted) => {
          if (granted) {
            setNotificationsEnabled(true);
            await chrome.storage.local.set({ notifications_enabled: true });
          } else {
            setNotificationsEnabled(false);
            onToast?.('Notifications permission was denied.', 'error');
          }
        });
      } else {
        setNotificationsEnabled(true);
        await chrome.storage.local.set({ notifications_enabled: true });
      }
    } else {
      setNotificationsEnabled(false);
      await chrome.storage.local.set({ notifications_enabled: false });
    }
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

  const handleForceFullSync = () => {
    if (!onConfirmAction) return;
    if (syncPhase !== 'idle' && syncPhase !== 'error') {
      onToast?.('A sync is currently in progress', 'error');
      return;
    }
    onConfirmAction(async () => {
      await chrome.storage.local.remove('all_accepted_submissions');
      onToast?.('Cleared sync cache. Starting full sync...', 'info');
      await handleFullSync(true);
    }, 'Force Full Sync', 'This will clear your local sync cache and re-fetch all submissions from LeetCode and Codeforces. Are you sure?');
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const date = new Date(lastSyncTime);
    return date.toLocaleString();
  };

  const renderSectionHeader = (id: keyof typeof expanded, title: React.ReactNode) => (
    <div
      onClick={() => toggleSection(id)}
      title="Click to expand/collapse section"
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
              <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LeetCodeIcon size={16} />
                <span>Your LeetCode Username</span>
                <span title="Your personal LeetCode username. Excludes you from friend comparisons and enables relative progress tracking." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
              </label>
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
              <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CodeforcesIcon size={16} />
                <span>Your Codeforces Handle</span>
                <span title="Your personal Codeforces handle (case-sensitive). Links your real-time practice sessions." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
              </label>
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
              <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CodeChefIcon size={16} />
                <span>Your CodeChef Handle</span>
                <span title="Your personal CodeChef handle. Tracks your official star rating and contest attendance." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
              </label>
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

            <div className="settings-item">
              <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CsesIcon size={16} />
                <span>Your CSES Handle (User ID)</span>
                <span title="Your personal CSES user ID number. Used to scrape your solved problem list directly from your logged-in browser session." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
              </label>
              <p className="settings-hint">
                Current: {ownCsesHandle || 'Not set'}
              </p>
              <div className="settings-input-group">
                <input
                  type="text"
                  placeholder="Enter CSES user ID (e.g. 12345)"
                  value={newCsesHandle}
                  onChange={(e) => setNewCsesHandle(e.target.value)}
                  className="settings-input"
                />
                <button onClick={handleCsesHandleUpdate} className="settings-btn">
                  Update
                </button>
              </div>
            </div>

            {/* GFG & TUF Manual Tracking notice */}
            <div
              style={{
                marginTop: '16px',
                padding: '12px 14px',
                background: 'rgba(255, 161, 22, 0.07)',
                border: '1px solid rgba(255, 161, 22, 0.35)',
                borderRadius: '0px',
                fontSize: 'var(--font-size-base)',
                lineHeight: '1.5',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: 700, color: '#ffa116' }}>
                <span></span>
                <span>GFG &amp; TUF — Manual Marking</span>
              </div>
              <p style={{ margin: '0 0 8px 0' }}>
                GeeksforGeeks and TakeUForward don't provide public submission APIs, so
                L'Amigo <strong>cannot auto-detect</strong> your solves on these platforms.
                <br />
                To mark a GFG or TUF problem as solved, open the <strong>Sheets Tracker</strong> tab
                in the full dashboard and click the checkmark next to any problem.
                <br />
                <span style={{ opacity: 0.7 }}>No GitHub login required — marks are saved locally.</span>
              </p>
              <button
                onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') + '#sheets' })}
                style={{
                  padding: '6px 14px',
                  background: '#ffa116',
                  color: '#000',
                  border: 'none',
                  borderRadius: '0px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 'var(--font-size-base)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                 Open Sheets Tracker
              </button>
            </div>

            <div style={{ marginTop: '24px' }}>
              <button
                onClick={() => setShowSyncInfo(!showSyncInfo)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '0px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 'var(--font-size-base)',
                  color: showSyncInfo ? '#ffa116' : 'var(--text-secondary)'
                }}
              >
                <span>(i) How Multi-Platform Sync Works</span>
                <span>{showSyncInfo ? '▲' : '▼'}</span>
              </button>
              {showSyncInfo && (
                <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-strong)', borderTop: 'none', borderRadius: '0px', fontSize: 'var(--font-size-base)', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                  LeetCode sync requires an active logged-in session in your browser (utilizing <code>.leetcode.com</code> cookies). Codeforces and CodeChef fetch data directly via public APIs and web scraping using your configured handles.
                </div>
              )}
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
                  <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Dark Mode</span>
                    <span title="Toggles the interface color scheme between sleek dark mode and bright light mode." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                  </label>
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
                  <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Notifications</span>
                    <span title="Triggers rich system notifications whenever a tracked friend successfully submits a new accepted problem." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                  </label>
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
                  <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Auto Refresh</span>
                    <span title="Keeps your friends' statistics and submission feeds perfectly up to date in the background without needing to open the extension." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                  </label>
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
                <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Refresh Interval</span>
                  <span title="Determines how frequently background synchronization checks for new problem solves." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                </label>
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
                <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Codeforces Dark Mode</span>
                  <span title="Injects a premium dark theme directly into Codeforces.com pages so your entire browsing experience matches L'Amigo." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                </label>
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
              <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Daily Solve Goal</span>
                <span title="Your target number of problems to solve each day. Fuels the visual progress bar on the overview tab." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
              </label>
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

      {/* Customization */}
      <section className="settings-section">
        {renderSectionHeader('customization', 'Customization & Workflow')}
        
        {expanded.customization && (
          <div className="settings-section-content">
            <div className="settings-item">
              <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Default Startup Tab</span>
                <span title="The tab that opens by default when you click the extension icon." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
              </label>
              <select
                value={defaultTab}
                onChange={(e) => {
                  const val = e.target.value;
                  setDefaultTab(val);
                  chrome.storage.local.set({ default_startup_tab: val });
                }}
                className="settings-select"
              >
                <option value="friends">Friends List</option>
                <option value="compare">Compare Stats</option>
                <option value="settings">Settings</option>
                <option value="dash_overview">Dashboard: Overview</option>
                <option value="dash_leaderboard">Dashboard: Leaderboard</option>
                <option value="dash_sheets">Dashboard: Sheets Tracker</option>
                <option value="dash_contests">Dashboard: Contest Hub</option>
              </select>
            </div>

            <div className="settings-item toggle-row">
              <div className="toggle-info">
                <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Blind Mode (Hide Difficulties)</span>
                  <span title="Hides problem difficulties (Easy/Medium/Hard) in the Sheets Tracker to prevent bias." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                </label>
              </div>
              <div className="toggle-wrapper">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={blindMode}
                    onChange={(e) => {
                      setBlindMode(e.target.checked);
                      chrome.storage.local.set({ blind_mode: e.target.checked });
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="settings-item toggle-row">
              <div className="toggle-info">
                <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Compact View</span>
                  <span title="Shrinks friend cards for a denser layout." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                </label>
              </div>
              <div className="toggle-wrapper">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={compactView}
                    onChange={(e) => {
                      setCompactView(e.target.checked);
                      chrome.storage.local.set({ compact_view: e.target.checked });
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="settings-item toggle-row">
              <div className="toggle-info">
                <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Smart Background Refresh</span>
                  <span title="Pauses background refresh if you haven't opened the extension in 24 hours to save resources." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                </label>
              </div>
              <div className="toggle-wrapper">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={smartBgRefresh}
                    onChange={(e) => {
                      setSmartBgRefresh(e.target.checked);
                      chrome.storage.local.set({ smart_bg_refresh: e.target.checked });
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="settings-item">
              <label className="settings-label">Platform Toggles</label>
              <p className="settings-hint">Disable platforms you don't use to completely hide them</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                {['leetcode', 'codeforces', 'codechef', 'cses'].map(platform => (
                  <label key={platform} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!disabledPlatforms.includes(platform)}
                      onChange={(e) => {
                        const newDisabled = e.target.checked 
                          ? disabledPlatforms.filter(p => p !== platform)
                          : [...disabledPlatforms, platform];
                        setDisabledPlatforms(newDisabled);
                        chrome.storage.local.set({ disabled_platforms: newDisabled });
                      }}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ fontSize: 'var(--font-size-sm)', textTransform: 'capitalize' }}>
                      {platform === 'cses' ? 'CSES' : platform}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Accessibility & Display */}
      <section className="settings-section">
        {renderSectionHeader('accessibility', 'Accessibility & Display')}
        
        {expanded.accessibility && (
          <div className="settings-section-content">
            <div className="settings-item">
              <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Font Size Scale ({fontSizeScale}%)</span>
                <span title="Dynamically scales all text elements across the extension and dashboard for improved readability and accessibility." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
              </label>
              <p className="settings-hint">Adjust text size across the entire application (80% - 150%)</p>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                <input
                  type="range"
                  min="80"
                  max="150"
                  step="5"
                  value={fontSizeScale}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--color-easy)', cursor: 'pointer' }}
                />
                <input
                  type="number"
                  min="80"
                  max="150"
                  value={fontSizeScale}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  style={{ width: '70px', padding: '6px', border: '1px solid var(--border-strong)', background: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '0px', textAlign: 'center', fontSize: 'var(--font-size-base)', fontWeight: 600 }}
                />
                <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-muted)', fontWeight: 600 }}>%</span>
              </div>
            </div>

            <div className="settings-item">
              <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Display Size / UI Zoom ({displayZoomScale}%)</span>
                <span title="Adjusts the overall density and layout zoom of the entire user interface, similar to browser zoom." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
              </label>
              <p className="settings-hint">Scale the entire interface density and layout zoom (80% - 130%)</p>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                <input
                  type="range"
                  min="80"
                  max="130"
                  step="5"
                  value={displayZoomScale}
                  onChange={(e) => handleDisplayZoomChange(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--color-easy)', cursor: 'pointer' }}
                />
                <input
                  type="number"
                  min="80"
                  max="130"
                  value={displayZoomScale}
                  onChange={(e) => handleDisplayZoomChange(Number(e.target.value))}
                  style={{ width: '70px', padding: '6px', border: '1px solid var(--border-strong)', background: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '0px', textAlign: 'center', fontSize: 'var(--font-size-base)', fontWeight: 600 }}
                />
                <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-muted)', fontWeight: 600 }}>%</span>
              </div>
            </div>

            <div className="settings-actions" style={{ marginTop: '16px' }}>
              <button
                onClick={handleResetAccessibility}
                className="settings-btn settings-btn-secondary"
                style={{ width: '100%', borderRadius: '0px' }}
              >
                Reset to Default (100%)
              </button>
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
                <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Step 1: Connect GitHub Account</span>
                  <span title="Authorizes L'Amigo to sync your successful problem solutions directly to a private or public GitHub repository." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                </label>
                <p className="settings-hint">
                  Link your GitHub account via Device Flow or use a Personal Access Token below.
                </p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexDirection: 'column' }}>
                  {!deviceFlowState ? (
                    <button onClick={handleOAuthLogin} className="settings-btn" style={{ flex: 1, backgroundColor: '#2da44e', color: 'white' }} disabled={isLoggingIn}>
                      {isLoggingIn ? 'Connecting...' : 'Login with GitHub'}
                    </button>
                  ) : (
                    <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: '0px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: 'var(--font-size-md)' }}>
                        1. Open <a href={deviceFlowState.verification_uri} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 'bold', textDecoration: 'underline' }}>github.com/login/device</a>
                      </p>
                      <p style={{ margin: '0 0 12px', fontSize: 'var(--font-size-md)' }}>
                        2. Enter code:
                      </p>
                      <div style={{ fontSize: 'calc(2 * var(--font-size-base))', fontWeight: 'bold', letterSpacing: '2px', margin: '8px 0', color: 'var(--text-primary)', background: 'var(--bg-primary)', padding: '8px', border: '1px solid var(--border)' }}>
                        {deviceFlowState.user_code}
                      </div>
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                        Waiting for authorization...
                      </p>
                      <button
                        type="button"
                        onClick={cancelDeviceFlow}
                        className="settings-btn"
                        style={{ marginTop: '12px', padding: '6px 12px', fontSize: 'var(--font-size-base)', width: 'auto' }}
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
                  <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Step 2: Repository Name</span>
                    <span title="The target repository on your GitHub account where your accepted solutions and automatic backup configurations will be stored." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                  </label>
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
                  <p className="settings-hint" style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                    💡 If the repository doesn't exist, we'll automatically create a private one for you!
                  </p>
                </div>
                <div className="settings-item" style={{ marginTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isHistoryOnly} 
                      onChange={(e) => setIsHistoryOnly(e.target.checked)} 
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                      Fast Sync (History Only - skips downloading source code)
                    </span>
                    <span title="Sync only the green checkmarks and stats without downloading the actual code files. Recommended if you have thousands of submissions." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal' }}>(i)</span>
                  </label>
                </div>
                <div className="settings-item toggle-row" style={{ marginTop: '12px' }}>
                  <div className="toggle-info">
                    <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-sm)' }}>
                      <span>Sync Strictness (Accepted Only)</span>
                      <span title="If enabled, we will ONLY sync accepted submissions and ignore TLE/WA. Applies primarily to Codeforces and CodeChef." style={{ cursor: 'help', opacity: 0.7, fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                    </label>
                  </div>
                  <div className="toggle-wrapper">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={syncStrictness}
                        onChange={(e) => {
                          setSyncStrictness(e.target.checked);
                          chrome.storage.local.set({ sync_strictness: e.target.checked });
                        }}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
                <div className="settings-item" style={{ marginTop: '12px' }}>
                  <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-sm)' }}>
                    <span>Commit Frequency</span>
                    <span title="Determines whether to push code to GitHub immediately after solving a problem, or batch them to run once a day." style={{ cursor: 'help', opacity: 0.7, fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                  </label>
                  <select
                    value={commitFrequency}
                    onChange={(e) => {
                      const val = e.target.value as 'immediate' | 'batch';
                      setCommitFrequency(val);
                      chrome.storage.local.set({ commit_frequency: val });
                    }}
                    className="settings-select"
                    style={{ marginTop: '4px' }}
                  >
                    <option value="immediate">Immediate (On Solve)</option>
                    <option value="batch">Batch (Background Alarm)</option>
                  </select>
                </div>
                <div className="settings-actions">
                  {isSyncingNow ? (
                    <button 
                      onClick={async () => await chrome.storage.session.set({ cancel_sync: true })}
                      className="settings-btn settings-btn-danger"
                      style={{ backgroundColor: '#ff4444', color: 'white' }}
                    >
                      Stop Sync
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        onClick={handleFullSync}
                        disabled={!repoName.trim() || healthStatus.status === 'checking'}
                        className="settings-btn settings-btn-primary"
                        title="Click to Sync (Hold Alt + Click to Force Full Sync)"
                      >
                        {healthStatus.status === 'checking' ? 'Checking connection...' : syncButtonLabel}
                      </button>
                      
                      <div className="dropdown-container" style={{ position: 'relative' }}>
                        <button
                          onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                          className="settings-btn settings-btn-secondary"
                          style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="More options"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {settingsMenuOpen && (
                          <>
                            <div 
                              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }} 
                              onClick={() => setSettingsMenuOpen(false)}
                            />
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', zIndex: 10, minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                              <button
                                onClick={() => { setSettingsMenuOpen(false); handleManualBackup(); }}
                                disabled={isBackingUp}
                                style={{ display: 'block', width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}
                              >
                                {isBackingUp ? 'Backing up...' : 'Backup Settings Now'}
                              </button>
                              <button
                                onClick={() => { setSettingsMenuOpen(false); handleDisconnect(); }}
                                style={{ display: 'block', width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '13px' }}
                              >
                                Disconnect
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
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
                        : `Pushing to GitHub… ${syncDone - syncFailed}/${syncTotal} synced ${syncFailed > 0 ? ` (${syncFailed} skipped)` : ''} (${syncPct}%)`}
                    </p>
                    {syncPhase === 'fetching' && (
                      <p className="sync-progress-text" style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                        ⚠️ First-time syncs can take a few minutes. Please keep this popup open until it finishes.
                      </p>
                    )}
                  </div>
                )}
                {syncPhase === 'error' && (
                  <p className="sync-progress-text sync-error-text">[!] {syncError}</p>
                )}
                {!isSyncingNow && syncFailed > 0 && (
                  <div className="sync-progress-container" style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', border: '1px solid #ff9800', padding: '10px', borderRadius: '8px', marginTop: '12px' }}>
                    <p className="sync-progress-text" style={{ color: '#ff9800', margin: 0, fontWeight: 'bold', fontSize: '13px' }}>
                      [!] {syncFailed} submissions skipped due to rate limits/Cloudflare protection.
                    </p>
                    <p className="sync-progress-text" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '12px' }}>
                      Please wait a few minutes and click "Force Full Sync" or "Sync" to retry and successfully push the remaining {syncFailed} submissions.
                    </p>
                  </div>
                )}

                <p className="settings-hint settings-hint--sm">
                  <Lightbulb size={14} className="inline-icon hint-icon" /> One click fetches every accepted submission via LeetCode API, skips ones already on GitHub, and uploads the rest.
                </p>
              </>
            ) : (
              <>
                <div className="settings-item">
                  <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Repository</span>
                    <span title="Your active GitHub sync repository. Background listeners will automatically commit new accepted submissions here." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                  </label>
                  <p className="settings-hint">{repoName || 'Not set'}</p>
                  <p className="settings-status connected"> Active - Auto-syncing in background</p>
                  {lastSyncTime && <p className="settings-hint">Last sync: {formatLastSync()}</p>}
                  {lastBackupTime ? (
                    <p className="settings-hint">Last backup: {new Date(lastBackupTime).toLocaleString()}</p>
                  ) : (
                    <p className="settings-hint">Last backup: Never</p>
                  )}
                  <p className="settings-hint">Solves auto-sync to GitHub even when popup is closed</p>
                </div>

                <div className="settings-item">
                  <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Change Repository</span>
                    <span title="Switch synchronization to a different repository. Future submissions will begin syncing to the new target." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                  </label>
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
                  <p className="settings-hint" style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                    💡 If the repository doesn't exist, we'll automatically create a private one for you!
                  </p>
                </div>

                <div className="settings-item" style={{ marginTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isHistoryOnly} 
                      onChange={(e) => setIsHistoryOnly(e.target.checked)} 
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                      Fast Sync (History Only - skips downloading source code)
                    </span>
                    <span title="Sync only the green checkmarks and stats without downloading the actual code files. Recommended if you have thousands of submissions." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal' }}>(i)</span>
                  </label>
                </div>
                <div className="settings-actions">
                  {isSyncingNow ? (
                    <button 
                      onClick={async () => await chrome.storage.session.set({ cancel_sync: true })}
                      className="settings-btn settings-btn-danger"
                      style={{ backgroundColor: '#ff4444', color: 'white' }}
                    >
                      Stop Sync
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        onClick={handleFullSync}
                        disabled={!repoName.trim() || healthStatus.status === 'checking'}
                        className="settings-btn settings-btn-primary"
                        title="Click to Sync (Hold Alt + Click to Force Full Sync)"
                      >
                        {healthStatus.status === 'checking' ? 'Checking connection...' : syncButtonLabel}
                      </button>
                      
                      <div className="dropdown-container" style={{ position: 'relative' }}>
                        <button
                          onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                          className="settings-btn settings-btn-secondary"
                          style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="More options"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {settingsMenuOpen && (
                          <>
                            <div 
                              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }} 
                              onClick={() => setSettingsMenuOpen(false)}
                            />
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', zIndex: 10, minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                              <button
                                onClick={() => { setSettingsMenuOpen(false); handleManualBackup(); }}
                                disabled={isBackingUp}
                                style={{ display: 'block', width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}
                              >
                                {isBackingUp ? 'Backing up...' : 'Backup Settings Now'}
                              </button>
                              <button
                                onClick={() => { setSettingsMenuOpen(false); handleDisconnect(); }}
                                style={{ display: 'block', width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '13px' }}
                              >
                                Disconnect
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {healthStatus.status !== 'idle' && (
                  <p className={`settings-status ${healthStatus.status === 'ok' ? 'connected' : 'error'}`}>
                    {healthStatus.status === 'ok' ? '' : '[!]'} {healthStatus.message}
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
                        : `Pushing to GitHub… ${syncDone - syncFailed}/${syncTotal} synced ${syncFailed > 0 ? ` (${syncFailed} skipped)` : ''} (${syncPct}%)`}
                    </p>
                    {syncPhase === 'fetching' && (
                      <p className="sync-progress-text" style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                        ⚠️ First-time syncs can take a few minutes. Please keep this popup open until it finishes.
                      </p>
                    )}
                  </div>
                )}
                {syncPhase === 'error' && (
                  <p className="sync-progress-text sync-error-text">[!] {syncError}</p>
                )}
                {!isSyncingNow && syncFailed > 0 && (
                  <div className="sync-progress-container" style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', border: '1px solid #ff9800', padding: '10px', borderRadius: '8px', marginTop: '12px' }}>
                    <p className="sync-progress-text" style={{ color: '#ff9800', margin: 0, fontWeight: 'bold', fontSize: '13px' }}>
                      [!] {syncFailed} submissions skipped due to rate limits/Cloudflare protection.
                    </p>
                    <p className="sync-progress-text" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '12px' }}>
                      Please wait a few minutes and click "Force Full Sync" or "Sync" to retry and successfully push the remaining {syncFailed} submissions.
                    </p>
                  </div>
                )}
                {debugInfo && (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px', padding: '4px 6px', background: 'var(--bg-tertiary)', borderRadius: '0px', wordBreak: 'break-all' }}>
                    Debug: {debugInfo}
                  </p>
                )}

                <div style={{ margin: '16px 0', padding: '12px 16px', background: 'rgba(59,130,246,0.1)', borderLeft: '4px solid var(--accent-codeforces-blue)', borderRadius: '0px', fontSize: 'var(--font-size-base)', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 600, color: 'var(--accent-codeforces-blue)' }}>
                    <span></span> Codeforces & CodeChef Sync Notice
                  </div>
                  Due to strict API rate limits on Codeforces and aggressive bot protections on CodeChef, fetching historical submission code in bulk can trigger temporary rate limits or pauses. L'Amigo automatically throttles requests and pauses when secondary rate limits are encountered to protect your account. New submissions will be automatically detected and synced in real-time as you submit them!
                </div>

                {/* ── Sync History ── */}
                {syncHistory.length > 0 && (
                  <div className="sync-history-section" style={{ overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h4 className="settings-subsection-title sync-history-title" style={{ margin: 0 }}>Recent Syncs</h4>
                      <button 
                        onClick={handleClearSyncHistory}
                        style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', padding: '2px 8px', borderRadius: '0px', cursor: 'pointer' }}
                        title="Clear sync log history"
                      >
                        Clear History
                      </button>
                    </div>
                    <div className="sync-history-list" style={{ overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
                      {/* Show compact 5 items */}
                      {syncHistory.slice(0, 5).map((entry, idx) => (
                        <div key={idx} className="sync-history-item sync-history-item--card" style={{ overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
                          <div className="sync-history-meta">
                            <span className="sync-history-date">
                              {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`sync-history-status ${entry.status}`}>
                              {entry.status === 'success' ? ` ${entry.problemsSynced} solved` : `[!] Failed`}
                            </span>
                          </div>
                          {entry.problems && entry.problems.length > 0 && (
                            <p className="sync-history-details" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', display: 'block', boxSizing: 'border-box' }}>
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
              <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Local Data Backup</span>
                <span title="Allows you to export your current friends list and configuration to a portable JSON file, or import from an existing backup." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
              </label>
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
              <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Clear All Data</span>
                <span title="Wipes all locally cached submissions, tracked friends, and custom configurations. This action is irreversible." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
              </label>
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
                   Dynamically synced history to GitHub
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

