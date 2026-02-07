import React, { useState, useEffect } from 'react';
import { GitHubSyncService } from '../services/github';
import { StorageService } from '../services/storage';

interface SyncTabProps {
  onSync: () => void;
  isDarkMode: boolean;
}

export const SyncTab: React.FC<SyncTabProps> = ({ onSync, isDarkMode }) => {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [repository, setRepository] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  
  // Settings
  const [submitNewOnly, setSubmitNewOnly] = useState(true);
  const [syncMultiple, setSyncMultiple] = useState(false);
  const [addComments, setAddComments] = useState(false);

  useEffect(() => {
    loadConfig();
    loadSettings();
  }, []);

  const loadConfig = async () => {
    const config = await GitHubSyncService.getConfig();
    setIsConfigured(!!config?.token);
    if (config?.token) {
      // Try to get last sync time
      const result = await chrome.storage.local.get('last_sync_time');
      setLastSyncTime(result.last_sync_time || null);
    }
  };

  const loadSettings = async () => {
    const result = await chrome.storage.local.get(['submit_new_only', 'sync_multiple', 'add_comments']);
    setSubmitNewOnly(result.submit_new_only ?? true);
    setSyncMultiple(result.sync_multiple ?? false);
    setAddComments(result.add_comments ?? false);
  };

  const handleConnect = async () => {
    if (!token.trim()) return;

    try {
      await GitHubSyncService.saveConfig({ token: token.trim() });
      setIsConfigured(true);
      setToken('');
      alert('GitHub connected successfully!');
    } catch (error) {
      alert('Failed to connect GitHub');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const friends = await StorageService.getFriends();
      const profiles = await StorageService.getProfiles();
      
      await GitHubSyncService.syncToGitHub({
        friends,
        profiles,
        timestamp: Date.now(),
      });
      
      const now = Date.now();
      setLastSyncTime(now);
      await chrome.storage.local.set({ last_sync_time: now });
      
      alert('Data synced to GitHub successfully!');
    } catch (error) {
      alert('Sync failed: ' + (error as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Disconnect GitHub sync?')) return;

    try {
      await GitHubSyncService.disconnect();
      setIsConfigured(false);
      setLastSyncTime(null);
      alert('GitHub disconnected');
    } catch (error) {
      alert('Failed to disconnect');
    }
  };

  const handleSettingChange = async (key: string, value: boolean) => {
    await chrome.storage.local.set({ [key]: value });
    switch (key) {
      case 'submit_new_only':
        setSubmitNewOnly(value);
        break;
      case 'sync_multiple':
        setSyncMultiple(value);
        break;
      case 'add_comments':
        setAddComments(value);
        break;
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'No synchronization performed yet';
    const date = new Date(lastSyncTime);
    return `Last synced: ${date.toLocaleString()}`;
  };

  return (
    <div className="sync-tab">
      <div className="sync-section">
        <h3>Sync Settings</h3>
        
        <div className="setting-item">
          <div className="setting-info">
            <label>Submit only new solutions</label>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={submitNewOnly}
              onChange={(e) => handleSettingChange('submit_new_only', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <label>Sync multiple submissions</label>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={syncMultiple}
              onChange={(e) => handleSettingChange('sync_multiple', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <label>Add submission comments</label>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={addComments}
              onChange={(e) => handleSettingChange('add_comments', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="sync-section">
        <h3>GitHub Backup</h3>
        
        {!isConfigured ? (
          <div className="sync-setup">
            <p className="sync-description">
              Backup your friend data to GitHub Gist for safekeeping
            </p>
            
            <button 
              className="sync-action-btn primary authorize-btn"
              onClick={() => window.open('https://github.com/settings/tokens/new?description=LAmigo&scopes=gist&expires=0', '_blank')}
            >
              Authorize with GitHub
            </button>

            <p className="sync-hint">
              Creates a personal access token with Gist permissions (no expiration)
            </p>

            <div className="token-input-section">
              <label>Paste your token here:</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_xxxxxxxxxxxxx"
                className="token-input"
              />
              <button
                className="sync-action-btn primary"
                onClick={handleConnect}
                disabled={!token.trim()}
              >
                Connect
              </button>
            </div>
          </div>
        ) : (
          <div className="sync-connected">
            <div className="sync-info-box">
              <div className="sync-info-item">
                <label>✓ Connected</label>
                <div className="sync-info-value">
                  GitHub Gist
                  <button className="link-btn" onClick={handleLogout}>Disconnect</button>
                </div>
              </div>
            </div>

            <button 
              className="sync-action-btn primary"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>

            <p className="sync-status">{formatLastSync()}</p>
          </div>
        )}
      </div>
    </div>
  );
};
