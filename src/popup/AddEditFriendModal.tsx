import React, { useState, useEffect } from 'react';
import { FriendIdentity, Platform } from '../types';
import { StorageService } from '../services/storage';
import { LeetCodeService } from '../services/leetcode';
import { CodeforcesService } from '../services/codeforces';
import { CodeChefService } from '../services/codechef';
import { RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  friend?: FriendIdentity; // If provided, we are editing. Otherwise, adding.
}

export const AddEditFriendModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, friend }) => {
  const [displayName, setDisplayName] = useState('');
  const [lcHandle, setLcHandle] = useState('');
  const [cfHandle, setCfHandle] = useState('');
  const [ccHandle, setCcHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [initialLc, setInitialLc] = useState('');
  const [initialCf, setInitialCf] = useState('');
  const [initialCc, setInitialCc] = useState('');
  const [lcStatus, setLcStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  const [cfStatus, setCfStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  const [ccStatus, setCcStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');

  useEffect(() => {
    if (isOpen) {
      if (friend) {
        setDisplayName(friend.displayName);
        const lc = friend.accounts.find(a => a.platform === 'leetcode')?.handle || '';
        const cf = friend.accounts.find(a => a.platform === 'codeforces')?.handle || '';
        const cc = friend.accounts.find(a => a.platform === 'codechef')?.handle || '';
        setLcHandle(lc);
        setCfHandle(cf);
        setCcHandle(cc);
        setInitialLc(lc);
        setInitialCf(cf);
        setInitialCc(cc);
        setLcStatus(lc ? 'valid' : 'idle');
        setCfStatus(cf ? 'valid' : 'idle');
        setCcStatus(cc ? 'valid' : 'idle');
      } else {
        setDisplayName('');
        setLcHandle('');
        setCfHandle('');
        setCcHandle('');
        setInitialLc('');
        setInitialCf('');
        setInitialCc('');
        setLcStatus('idle');
        setCfStatus('idle');
        setCcStatus('idle');
      }
      setError('');
    }
  }, [isOpen, friend]);

  useEffect(() => {
    if (!lcHandle.trim()) {
      setLcStatus('idle');
      return;
    }
    if (lcHandle.trim() === initialLc.trim()) {
      setLcStatus('valid');
      return;
    }
    setLcStatus('verifying');
    const timer = setTimeout(async () => {
      try {
        await LeetCodeService.fetchUserProfile(lcHandle.trim());
        setLcStatus('valid');
      } catch (err) {
        setLcStatus('invalid');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [lcHandle, initialLc]);

  useEffect(() => {
    if (!cfHandle.trim()) {
      setCfStatus('idle');
      return;
    }
    if (cfHandle.trim() === initialCf.trim()) {
      setCfStatus('valid');
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
  }, [cfHandle, initialCf]);

  useEffect(() => {
    if (!ccHandle.trim()) {
      setCcStatus('idle');
      return;
    }
    if (ccHandle.trim() === initialCc.trim()) {
      setCcStatus('valid');
      return;
    }
    setCcStatus('verifying');
    const timer = setTimeout(async () => {
      try {
        await CodeChefService.fetchUserProfile(ccHandle.trim());
        setCcStatus('valid');
      } catch (err) {
        setCcStatus('invalid');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [ccHandle, initialCc]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    if (!lcHandle.trim() && !cfHandle.trim() && !ccHandle.trim()) {
      setError('At least one platform handle is required');
      return;
    }
    if (lcStatus === 'verifying' || cfStatus === 'verifying' || ccStatus === 'verifying') {
      setError('Please wait for handle verification to complete');
      return;
    }
    if (lcHandle.trim() && lcStatus === 'invalid') {
      setError('LeetCode handle is invalid');
      return;
    }
    if (cfHandle.trim() && cfStatus === 'invalid') {
      setError('Codeforces handle is invalid');
      return;
    }
    if (ccHandle.trim() && ccStatus === 'invalid') {
      setError('CodeChef handle is invalid');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const accounts: Array<{platform: Platform, handle: string}> = [];
      if (lcHandle.trim()) accounts.push({ platform: 'leetcode', handle: lcHandle.trim() });
      if (cfHandle.trim()) accounts.push({ platform: 'codeforces', handle: cfHandle.trim() });
      if (ccHandle.trim()) accounts.push({ platform: 'codechef', handle: ccHandle.trim() });

      let res;
      if (friend && friend.id) {
        res = await chrome.runtime.sendMessage({
          action: "updateIdentity",
          identityId: friend.id,
          payload: {
            displayName: displayName.trim(),
            accounts
          }
        });
      } else {
        res = await chrome.runtime.sendMessage({
          action: "createIdentity",
          payload: {
            displayName: displayName.trim(),
            accounts
          }
        });
      }

      if (res && !res.success) {
        throw new Error(res.error || "Failed to save friend.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderVerificationBadge = (status: 'idle' | 'verifying' | 'valid' | 'invalid') => {
    if (status === 'idle') return null;
    if (status === 'verifying') {
      return <span className="verification-badge verifying">Verifying...</span>;
    }
    if (status === 'valid') {
      return <span className="verification-badge valid">✓ Valid Account</span>;
    }
    return <span className="verification-badge invalid">✗ Account Not Found</span>;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-brutalist" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{friend ? 'Edit Friend' : 'Add Friend'}</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="danger-text" style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>
                {error}
              </div>
            )}
            
            <div className="modal-form-field">
              <label>Display Name</label>
              <input 
                type="text" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)} 
                placeholder="e.g., John Doe" 
                className="modal-form-input"
              />
            </div>
            
            <div className="modal-form-field">
              <label>LeetCode Handle (Optional)</label>
              <input 
                type="text" 
                value={lcHandle} 
                onChange={e => setLcHandle(e.target.value)} 
                placeholder="e.g., john_lc" 
                className="modal-form-input"
              />
              {renderVerificationBadge(lcStatus)}
            </div>

            <div className="modal-form-field">
              <label>Codeforces Handle (Optional)</label>
              <input 
                type="text" 
                value={cfHandle} 
                onChange={e => setCfHandle(e.target.value)} 
                placeholder="e.g., john_cf" 
                className="modal-form-input"
              />
              {renderVerificationBadge(cfStatus)}
            </div>
            
            <div className="modal-form-field">
              <label>CodeChef Handle (Optional)</label>
              <input 
                type="text" 
                value={ccHandle} 
                onChange={e => setCcHandle(e.target.value)} 
                placeholder="e.g., john_cc" 
                className="modal-form-input"
              />
              {renderVerificationBadge(ccStatus)}
            </div>
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              onClick={onClose}
              className="modal-btn modal-btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="modal-btn"
            >
              {loading ? <RefreshCw size={14} className="spin" style={{ margin: '0 auto' }} /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
