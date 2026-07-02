import React from 'react';
import { FileSpreadsheet, Play } from 'lucide-react';

interface Props {
  loadingSheet: boolean;
  sheetMeta: any;
  sheetProgress: { solved: number; total: number; percent: number };
  onNavigate?: (tab: string) => void;
}

export const MiniSheetWidget: React.FC<Props> = React.memo(({ loadingSheet, sheetMeta, sheetProgress, onNavigate }) => {
  return (
    <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px', borderRadius: '0px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-strong)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
              <FileSpreadsheet size={20} color="#ffa116" />
              <span>Active Practice Sheet</span>
            </div>
            <button 
              onClick={() => onNavigate?.('sheets')} 
              style={{ background: 'transparent', border: 'none', color: '#ffa116', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-sm)' }}
              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
            >
              Open Tracker &rarr;
            </button>
          </div>

          {loadingSheet ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading sheet data...</div>
          ) : !sheetMeta ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div>No active sheet tracked right now. Choose a curated roadmap from the Sheets Tracker!</div>
              <button onClick={() => onNavigate?.('sheets')} style={{ background: '#ffa116', color: '#000', border: 'none', padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>Choose Sheet</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1 }}>
              <div>
                <div style={{ fontSize: 'calc(1.4 * var(--font-size-base))', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>{sheetMeta.name}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: 'var(--border-strong)', padding: '2px 8px', borderRadius: '0px', color: 'var(--text-primary)', fontWeight: 600 }}>{sheetMeta.group}</span>
                  <span>Curated Practice Roadmap</span>
                </div>

                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
                  <span style={{ fontFamily: 'monospace', color: '#ffa116', fontSize: 'calc(1.1 * var(--font-size-base))' }}>{sheetProgress.solved} / {sheetProgress.total} ({sheetProgress.percent}%)</span>
                </div>
                <div className="dashboard-progress-bar" style={{ height: '10px', background: 'var(--bg-primary)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0px', overflow: 'hidden', marginBottom: '28px' }}>
                  <div className="dashboard-progress-fill" style={{ height: '100%', width: `${sheetProgress.percent}%`, background: '#ffa116' }}></div>
                </div>
              </div>

              <button 
                onClick={() => onNavigate?.('sheets')} 
                style={{ width: '100%', padding: '14px', background: '#ffa116', color: '#000', border: 'none', borderRadius: '0px', fontWeight: 800, fontSize: 'var(--font-size-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'opacity 0.2s ease' }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              >
                <Play size={18} fill="#000" />
                <span>Resume Practice</span>
              </button>
            </div>
          )}
        </div>
  );
});
