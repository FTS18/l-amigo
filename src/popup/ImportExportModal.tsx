import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Friend, FriendProfile, Platform } from '../types';
import { ExportService } from '../services/export';
import { StorageService } from '../services/storage';
import { extractFriendPreviewsFromJSON, ImportPreviewFriend } from '../utils/import-restore';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  onFriendsImported: () => void;
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type TabType = 'export' | 'import';
type ExportFormat = 'json-share' | 'json-backup' | 'csv' | 'csv-detailed';

const PLATFORM_LABELS: Record<string, string> = {
  leetcode: 'LC',
  codeforces: 'CF',
  codechef: 'CC',
};

const PLATFORM_COLORS: Record<string, string> = {
  leetcode: '#ffa116',
  codeforces: '#3b82f6',
  codechef: '#5B4638',
};

// ─── Hoisted Sub-components ──────────────────────────────────────

const FriendCheckRow = ({
  friend,
  checked,
  onToggle,
}: {
  friend: Friend;
  checked: boolean;
  onToggle: () => void;
}) => {
  const key = friend.id || friend.username;
  const label = friend.displayName || friend.username;
  const accounts = friend.accounts && friend.accounts.length > 0
    ? friend.accounts
    : [{ platform: 'leetcode' as Platform, handle: friend.username }];

  return (
    <label
      htmlFor={`export-friend-${key}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 10px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border-light)',
        background: checked ? 'var(--bg-secondary)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <input
        id={`export-friend-${key}`}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ accentColor: 'var(--color-easy)', width: '14px', height: '14px', flexShrink: 0 }}
      />
      <span style={{ flex: 1, fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {accounts.map(a => (
          <span
            key={a.platform + a.handle}
            style={{
              fontSize: 'calc(0.9 * var(--font-size-xs))',
              fontWeight: 700,
              padding: '2px 5px',
              borderRadius: '2px',
              background: PLATFORM_COLORS[a.platform] + '22',
              color: PLATFORM_COLORS[a.platform],
              border: `1px solid ${PLATFORM_COLORS[a.platform]}55`,
              letterSpacing: '0.03em',
            }}
          >
            {PLATFORM_LABELS[a.platform]}
          </span>
        ))}
      </span>
    </label>
  );
};

const ImportPreviewRow = ({
  friend,
  idx,
  onToggle
}: {
  friend: ImportPreviewFriend;
  idx: number;
  onToggle: () => void;
}) => (
  <label
    htmlFor={`import-friend-${idx}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '7px 10px',
      cursor: 'pointer',
      borderBottom: '1px solid var(--border-light)',
      background: friend.selected ? 'var(--bg-secondary)' : 'transparent',
      transition: 'background 0.15s',
    }}
  >
    <input
      id={`import-friend-${idx}`}
      type="checkbox"
      checked={friend.selected}
      onChange={onToggle}
      style={{ accentColor: 'var(--color-easy)', width: '14px', height: '14px', flexShrink: 0 }}
    />
    <span style={{ flex: 1, fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {friend.displayName}
    </span>
    <span style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
      {friend.accounts.map(a => (
        <span
          key={a.platform + a.handle}
          style={{
            fontSize: 'calc(0.9 * var(--font-size-xs))',
            fontWeight: 700,
            padding: '2px 5px',
            borderRadius: '2px',
            background: PLATFORM_COLORS[a.platform] + '22',
            color: PLATFORM_COLORS[a.platform],
            border: `1px solid ${PLATFORM_COLORS[a.platform]}55`,
            letterSpacing: '0.03em',
          }}
        >
          {PLATFORM_LABELS[a.platform]} {a.handle}
        </span>
      ))}
    </span>
  </label>
);

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  friends,
  profiles,
  onFriendsImported,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('export');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json-share');
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Import state
  const [importPreview, setImportPreview] = useState<ImportPreviewFriend[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importType, setImportType] = useState<'share' | 'backup' | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('export');
      setExportFormat('json-share');
      setSelectedFriendIds(new Set(friends.map(f => f.id || f.username)));
      setImportPreview([]);
      setImportFileName('');
      setImportType(null);
      setIsExporting(false);
      setIsImporting(false);
    }
  }, [isOpen, friends]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ─── Export helpers ──────────────────────────────────────────────

  const selectedFriends = friends.filter(f => selectedFriendIds.has(f.id || f.username));

  const toggleAll = () => {
    if (selectedFriendIds.size === friends.length) {
      setSelectedFriendIds(new Set());
    } else {
      setSelectedFriendIds(new Set(friends.map(f => f.id || f.username)));
    }
  };

  const toggleFriend = (key: string) => {
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleExport = async () => {
    if (selectedFriends.length === 0) {
      onToast('Select at least one friend to export.', 'info');
      return;
    }
    setIsExporting(true);
    try {
      if (exportFormat === 'json-share') {
        ExportService.exportFriendsShareableJSON(selectedFriends);
        onToast(`Exported ${selectedFriends.length} friend(s) as shareable JSON.`, 'success');
      } else if (exportFormat === 'json-backup') {
        await ExportService.exportToJSON();
        onToast('Full settings backup exported.', 'success');
      } else if (exportFormat === 'csv') {
        ExportService.exportToCSV(selectedFriends, profiles);
        onToast(`Exported ${selectedFriends.length} friend(s) as CSV.`, 'success');
      } else if (exportFormat === 'csv-detailed') {
        ExportService.exportDetailedCSV(selectedFriends, profiles);
        onToast(`Exported ${selectedFriends.length} friend(s) as detailed CSV.`, 'success');
      }
      onClose();
    } catch (err: any) {
      onToast('Export failed: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Import helpers ──────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);

        const { type, previews } = extractFriendPreviewsFromJSON(parsed);
        setImportType(type);
        setImportPreview(previews);
        return;

        onToast('Unrecognised file format. Use a L\'Amigo share or backup JSON.', 'error');
        setImportFileName('');
      } catch {
        onToast('Failed to parse file. Make sure it is valid JSON.', 'error');
        setImportFileName('');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleImportFriend = (idx: number) => {
    setImportPreview(prev =>
      prev.map((f, i) => (i === idx ? { ...f, selected: !f.selected } : f))
    );
  };

  const toggleImportAll = () => {
    const allSelected = importPreview.every(f => f.selected);
    setImportPreview(prev => prev.map(f => ({ ...f, selected: !allSelected })));
  };

  const handleImportConfirm = async () => {
    const toImport = importPreview.filter(f => f.selected);
    if (toImport.length === 0) {
      onToast('Select at least one friend to import.', 'info');
      return;
    }

    setIsImporting(true);
    let added = 0;
    let skipped = 0;

    try {
      for (const f of toImport) {
        if (f.accounts.length === 0) { skipped++; continue; }
        try {
          await StorageService.createIdentity({
            displayName: f.displayName,
            aliases: [],
            accounts: f.accounts,
          });
          added++;
        } catch {
          skipped++;
        }
      }
      onFriendsImported();
      onToast(`Imported ${added} friend(s)${skipped > 0 ? `, ${skipped} skipped (already exist)` : ''}.`, 'success');
      onClose();
    } catch (err: any) {
      onToast('Import failed: ' + err.message, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────

  const isExportDisabled = isExporting || (exportFormat !== 'json-backup' && selectedFriends.length === 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import / Export"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          maxHeight: '90vh',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-strong)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            Import / Export
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'var(--font-size-value)', lineHeight: 1, padding: '2px 6px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Nav */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['export', 'import'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '9px',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--color-easy)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'export' ? 'Export' : 'Import'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'export' ? (
            <>
              {/* Format Selector */}
              <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  <span>Format</span>
                  <span title="Choose between exporting a lightweight shareable list of friend handles, a complete app backup, or formatted CSV reports for external analysis." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {([
                    { value: 'json-share', label: 'JSON — Shareable Friends', hint: 'Recipients can import these friends directly' },
                    { value: 'json-backup', label: 'JSON — Full Settings Backup', hint: 'All settings, friends, and preferences' },
                    { value: 'csv', label: 'CSV — Summary', hint: 'Platform handles and stats per row' },
                    { value: 'csv-detailed', label: 'CSV — Detailed', hint: 'Includes recent solved problems' },
                  ] as { value: ExportFormat; label: string; hint: string }[]).map(opt => (
                    <label
                      key={opt.value}
                      htmlFor={`format-${opt.value}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '7px 9px',
                        cursor: 'pointer',
                        border: `1px solid ${exportFormat === opt.value ? 'var(--color-easy)' : 'var(--border)'}`,
                        background: exportFormat === opt.value ? 'var(--bg-secondary)' : 'transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        id={`format-${opt.value}`}
                        type="radio"
                        name="export-format"
                        value={opt.value}
                        checked={exportFormat === opt.value}
                        onChange={() => setExportFormat(opt.value)}
                        style={{ accentColor: 'var(--color-easy)', marginTop: '2px', flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '1px' }}>{opt.hint}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Friend Selection — hidden for full backup */}
              {exportFormat !== 'json-backup' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                  <div style={{ padding: '9px 14px 7px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Friends ({selectedFriends.length}/{friends.length} selected)
                    </span>
                    <button
                      onClick={toggleAll}
                      style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-easy)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '2px 4px' }}
                    >
                      {selectedFriendIds.size === friends.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {friends.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-base)' }}>
                        No friends added yet.
                      </div>
                    ) : (
                      friends.map(friend => (
                        <FriendCheckRow
                          key={friend.id || friend.username}
                          friend={friend}
                          checked={selectedFriendIds.has(friend.id || friend.username)}
                          onToggle={() => toggleFriend(friend.id || friend.username)}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {exportFormat === 'json-backup' && (
                <div style={{ padding: '16px 14px', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Exports all friends, settings, preferences, and GitHub sync configuration. Useful for migrating to a new device or browser.
                </div>
              )}
            </>
          ) : (
            /* ── Import Tab ── */
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
              {/* File picker */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  <span>Select File</span>
                  <span title="Load a previously exported L'Amigo backup JSON or shareable friends file. New friends will be safely merged without overwriting existing data." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', fontWeight: 'normal', textTransform: 'none' }}>(i)</span>
                </div>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="ie-modal-import-file"
                />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => importFileRef.current?.click()}
                    style={{
                      padding: '7px 12px',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 700,
                      border: '1px solid var(--border-strong)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Choose JSON File
                  </button>
                  {importFileName && (
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {importFileName}
                    </span>
                  )}
                </div>
                {importType && (
                  <div style={{ marginTop: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-easy)', fontWeight: 600 }}>
                    Detected: {importType === 'share' ? 'Shareable Friends JSON' : 'Full Settings Backup JSON'}
                  </div>
                )}
              </div>

              {/* Preview */}
              {importPreview.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                  <div style={{ padding: '9px 14px 7px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Preview ({importPreview.filter(f => f.selected).length}/{importPreview.length} selected)
                    </span>
                    <button
                      onClick={toggleImportAll}
                      style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-easy)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '2px 4px' }}
                    >
                      {importPreview.every(f => f.selected) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {importPreview.map((f, i) => (
                      <ImportPreviewRow key={i} friend={f} idx={i} onToggle={() => toggleImportFriend(i)} />
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-base)', flex: 1 }}>
                  <div style={{ fontSize: 'calc(2.333 * var(--font-size-base))', marginBottom: '10px', opacity: 0.3 }}>
                    &#x2193;
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>No file loaded</div>
                  <div style={{ fontSize: 'var(--font-size-sm)' }}>
                    Choose a shareable friends JSON or a full settings backup. Friends will be merged into your list.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexShrink: 0, background: 'var(--bg-secondary)' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            Cancel
          </button>
          {activeTab === 'export' ? (
            <button
              onClick={handleExport}
              disabled={isExportDisabled}
              style={{
                padding: '7px 14px',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 700,
                border: '1px solid var(--color-easy)',
                background: 'var(--color-easy)',
                color: '#000',
                cursor: isExportDisabled ? 'not-allowed' : 'pointer',
                opacity: isExportDisabled ? 0.5 : 1,
                letterSpacing: '0.03em',
              }}
            >
              {isExporting ? 'Exporting...' : `Export${(exportFormat !== 'json-backup' && selectedFriends.length > 0) ? ` (${selectedFriends.length})` : ''}`}
            </button>
          ) : (
            <button
              onClick={handleImportConfirm}
              disabled={isImporting || importPreview.filter(f => f.selected).length === 0}
              style={{
                padding: '7px 14px',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 700,
                border: '1px solid var(--color-easy)',
                background: 'var(--color-easy)',
                color: '#000',
                cursor: isImporting || importPreview.filter(f => f.selected).length === 0 ? 'not-allowed' : 'pointer',
                opacity: isImporting || importPreview.filter(f => f.selected).length === 0 ? 0.5 : 1,
                letterSpacing: '0.03em',
              }}
            >
              {isImporting ? 'Importing...' : `Import (${importPreview.filter(f => f.selected).length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
