import React, { useState, useEffect, useRef } from 'react';
import { LeetCodeService } from '../services/leetcode';
import { GitHubSyncService } from '../services/github';
import { restoreFromBackupJSON } from '../utils/import-restore';
import { API_CONSTANTS } from '../constants';

interface OnboardingProps {
 onComplete: (username: string) => void;
}

/** Lightweight CF handle check — only calls user.info, no submissions/ratings */
async function verifyCFHandle(handle: string): Promise<void> {
 const url = `${API_CONSTANTS.CODEFORCES_API}/user.info?handles=${encodeURIComponent(handle)}`;
 const ctl = new AbortController();
 const timer = setTimeout(() => ctl.abort(), 8000);
 try {
 const res = await fetch(url, { signal: ctl.signal });
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 const body = await res.json();
 if (body.status !== 'OK' || !body.result?.length) {
 throw new Error(body.comment || 'Not found');
 }
 } finally {
 clearTimeout(timer);
 }
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
 const [username, setUsername] = useState('');
 const [cfHandle, setCfHandle] = useState('');
 const [ccHandle, setCcHandle] = useState('');
 const [error, setError] = useState('');
 const [submitting, setSubmitting] = useState(false);

 const [mode, setMode] = useState<'setup' | 'restore'>('setup');
 const [showPrivacy, setShowPrivacy] = useState(false);
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
 } catch {
 setLcStatus('invalid');
 }
 }, 800);
 return () => clearTimeout(timer);
 }, [username]);

 // Debounced CF verification — lightweight, only user.info
 useEffect(() => {
 if (!cfHandle.trim()) {
 setCfStatus('idle');
 return;
 }
 setCfStatus('verifying');
 const timer = setTimeout(async () => {
 try {
 await verifyCFHandle(cfHandle.trim());
 setCfStatus('valid');
 } catch {
 setCfStatus('invalid');
 }
 }, 800);
 return () => clearTimeout(timer);
 }, [cfHandle]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 const lcTrimmed = username.trim();
 // CF handles are case-sensitive — preserve the user's casing
 const cfTrimmed = cfHandle.trim();
 const ccTrimmed = ccHandle.trim();

 if (!lcTrimmed && !cfTrimmed && !ccTrimmed) {
 setError('Please enter at least one handle (LeetCode, Codeforces, or CodeChef)');
 return;
 }

 if (lcStatus === 'verifying' || cfStatus === 'verifying') {
 setError('Please wait for verification to complete');
 return;
 }

 if (lcTrimmed && lcStatus === 'invalid') {
 setError('LeetCode username is invalid');
 return;
 }

 if (cfTrimmed && cfStatus === 'invalid') {
 setError('Codeforces handle is invalid');
 return;
 }

 setSubmitting(true);
 setError('');
 try {
 await chrome.storage.local.set({
 onboarding_complete: true,
 // LC usernames are case-insensitive, lowercase is fine
 own_username: lcTrimmed.toLowerCase(),
 // CF handles ARE case-sensitive — store as-is
 own_codeforces_handle: cfTrimmed,
 // CC handles are case-insensitive
 own_codechef_handle: ccTrimmed.toLowerCase(),
 });

 onComplete(lcTrimmed || cfTrimmed || ccTrimmed);
 } catch (err) {
 setError('Failed to save settings. Please try again.');
 console.error('Error:', err);
 } finally {
 setSubmitting(false);
 }
 };

 const handleSkip = async () => {
 try {
 await chrome.storage.local.set({ onboarding_complete: true });
 onComplete('');
 } catch (err) {
 setError('Failed to save settings. Please try again.');
 console.error('Error:', err);
 }
 };

 const handleRestore = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!ghToken.trim() || !ghRepo.trim()) {
 setError('Please enter both GitHub token and repository name');
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
 setError('GitHub host permissions are required to restore backup.');
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
 setError('GitHub permissions are required to enable automatic syncing.');
 setIsLoggingIn(false);
 return;
 }

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
 return <span className="verification-badge valid"> Valid</span>;
 }
 return <span className="verification-badge invalid"> Invalid</span>;
 };

 return (
 <div className="onboarding-overlay">
 <div className="onboarding-modal">
 <div className="onboarding-header">
 <img src="android-chrome-192x192.png" alt="L'Amigo" className="onboarding-logo" />
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
 <button
 type="button"
 className={`tab-button ${showPrivacy ? 'active' : ''}`}
 onClick={() => setShowPrivacy(!showPrivacy)}
 style={{ color: showPrivacy ? '#ffa116' : 'inherit' }}
 >
 Privacy
 </button>
 </div>

 {showPrivacy && (
 <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: '0px', fontSize: 'var(--font-size-base)', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
 <strong> 100% Local & Private</strong>
 <button onClick={() => setShowPrivacy(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', fontSize: 'var(--font-size-base)' }}>×</button>
 </div>
 L'Amigo operates entirely within your browser. All friend lists, submission caches, and GitHub tokens are stored securely in <code>chrome.storage.local</code>. Zero personal data or tracking analytics are sent to any external proprietary servers.
 </div>
 )}

 {mode === 'setup' ? (
 <>
 <p className="onboarding-hint" style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
 Your handles allow L'Amigo to track your live progress and build your baseline statistics.
 </p>
 <form onSubmit={handleSubmit} className="onboarding-form">
 <div className="onboarding-field">
 <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
 <span>Your LeetCode Username (Optional)</span>
 <span title="Providing your own handle prevents you from showing up in your own friend comparison lists and helps calculate relative head-to-head stats." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
 </label>
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
 <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
 <span>Your Codeforces Handle (Optional)</span>
 <span title="Your exact Codeforces handle (case-sensitive). Allows L'Amigo to track your live submissions and compare ratings accurately." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
 </label>
 <p className="onboarding-hint">
 Handle is case-sensitive (e.g. Tourist, not tourist)
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
 <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
 <span>Your CodeChef Handle (Optional)</span>
 <span title="Your exact CodeChef handle. Used to establish your baseline star rating and practice metrics." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
 </label>
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
 <button type="button" onClick={handleSkip} className="onboarding-btn secondary" disabled={submitting}>
 Skip
 </button>
 <button type="submit" className="onboarding-btn primary" disabled={submitting || lcStatus === 'verifying' || cfStatus === 'verifying'}>
 {submitting ? 'Saving...' : 'Get Started'}
 </button>
 </div>
 </form>
 </>
 ) : (
 <>
 <form onSubmit={handleRestore} className="onboarding-form">
 {!ghToken ? (
 <div style={{ marginBottom: '16px' }}>
 <label className="onboarding-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', marginBottom: '8px', fontSize: 'var(--font-size-md)' }}>
 <span>Option A: Authenticate with GitHub (Recommended)</span>
 <span title="Securely connects L'Amigo to GitHub via OAuth device flow so you can automatically backup and sync your solved problem history." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
 </label>
 <p className="onboarding-hint" style={{ marginTop: '-4px', marginBottom: '12px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
 We'll look for a .lamigo-backup.json file in your selected repository to instantly restore your configuration and friends list.
 </p>
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
 Waiting for authorization... (Expires in {Math.floor(deviceFlowState.expires_in / 60)}m)
 </p>
 <button
 type="button"
 onClick={cancelDeviceFlow}
 className="onboarding-btn secondary"
 style={{ marginTop: '12px', padding: '6px 12px', fontSize: 'var(--font-size-base)' }}
 >
 Cancel
 </button>
 </div>
 )}
 </div>
 <div className="onboarding-divider" style={{ textAlign: 'center', margin: '16px 0', borderBottom: '1px solid var(--border)', lineHeight: '0.1em' }}>
 <span style={{ background: 'var(--bg-primary)', padding: '0 10px', fontSize: 'var(--font-size-base)', color: 'var(--text-muted)' }}>OR</span>
 </div>
 </div>
 ) : (
 <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', color: 'var(--color-easy)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <span> Connected to GitHub</span>
 <button
 type="button"
 onClick={() => { setGhToken(''); setDeviceFlowState(null); }}
 className="onboarding-btn secondary"
 style={{ padding: '4px 8px', fontSize: 'var(--font-size-sm)', width: 'auto', flex: 'none' }}
 >
 Disconnect
 </button>
 </div>
 )}

 <div className="onboarding-field">
 <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
 <span>Option B: Manual Personal Access Token (PAT)</span>
 <span title="If you prefer manual control, paste a classic GitHub Personal Access Token (PAT) with 'repo' scope enabled." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
 </label>
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
 <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
 <span>GitHub Repository Name</span>
 <span title="The exact name of the private or public repository on your GitHub account where L'Amigo stores backup files and solution code." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
 </label>
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
 <span style={{ background: 'var(--bg-primary)', padding: '0 10px', fontSize: 'var(--font-size-base)', color: 'var(--text-muted)' }}>OR</span>
 </div>

 <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
 <label className="onboarding-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: 'var(--font-size-md)' }}>
 <span>Option C: Local Import JSON</span>
 <span title="Allows you to restore your complete friends list, aliases, and custom settings from a previously exported backup file on your local drive." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
 </label>
 <p className="onboarding-hint" style={{ margin: '0 0 8px', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
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
