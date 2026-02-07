import React, { useState, useEffect } from 'react';
import { GitHubSyncService } from '../services/github';
import { StorageService } from '../services/storage';

interface GitHubSyncProps {
  onSync: () => void;
}

export const GitHubSync: React.FC<GitHubSyncProps> = ({ onSync }) => {
  const [token, setToken] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    checkConfig();
  }, []);

  const checkConfig = async () => {
    const config = await GitHubSyncService.getConfig();
    setIsConfigured(!!config?.token);
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
      
      alert('Data synced to GitHub successfully!');
    } catch (error) {
      alert('Sync failed: ' + (error as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('This will replace your current data. Continue?')) return;

    setSyncing(true);
    try {
      const data = await GitHubSyncService.syncFromGitHub();
      
      // Restore data
      await chrome.storage.local.set({
        leetcode_friends: data.friends,
        leetcode_profiles: data.profiles,
      });
      
      onSync();
      alert('Data restored from GitHub successfully!');
    } catch (error) {
      alert('Restore failed: ' + (error as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect GitHub sync?')) return;

    try {
      await GitHubSyncService.disconnect();
      setIsConfigured(false);
      alert('GitHub disconnected');
    } catch (error) {
      alert('Failed to disconnect');
    }
  };

  return (
    <div className="github-sync-section">
      <button 
        className="github-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="github-icon"></span> GitHub Sync {expanded ? '▼' : '▶'}
      </button>

      {expanded && (
        <div className="github-content">
          {!isConfigured ? (
            <div className="github-setup">
              <p className="github-info">
                Backup your data to a private GitHub Gist
              </p>
              <input
                type="password"
                placeholder="GitHub Personal Access Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="github-input"
              />
              <button onClick={handleConnect} disabled={!token.trim()}>
                Connect GitHub
              </button>
              <p className="github-hint">
                Create a token at{' '}
                <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
                  github.com/settings/tokens
                </a>
                {' '}with 'gist' scope
              </p>
            </div>
          ) : (
            <div className="github-actions">
              <button onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Backup to GitHub'}
              </button>
              <button onClick={handleRestore} disabled={syncing}>
                {syncing ? 'Restoring...' : 'Restore from GitHub'}
              </button>
              <button onClick={handleDisconnect} className="disconnect-btn">
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
