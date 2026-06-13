import React from 'react';

const pulse: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border) 50%, var(--bg-tertiary) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '2px',
};

const line = (w: string, h = '10px', extra: React.CSSProperties = {}): React.CSSProperties => ({
  ...pulse, width: w, height: h, marginBottom: '6px', ...extra
});

/** Compact skeleton that mirrors a real friend-card row height */
const SkeletonCard: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
    {/* name row */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ ...pulse, width: '24px', height: '24px', flexShrink: 0 }} />
      <div style={line('45%', '11px')} />
      <div style={{ marginLeft: 'auto', ...pulse, width: '60px', height: '11px' }} />
    </div>
    {/* stat chips row */}
    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
      <div style={{ ...pulse, width: '52px', height: '20px' }} />
      <div style={{ ...pulse, width: '52px', height: '20px' }} />
      <div style={{ ...pulse, width: '52px', height: '20px' }} />
      <div style={{ ...pulse, width: '52px', height: '20px' }} />
    </div>
  </div>
);

/** Compact inline skeleton for recommendation items */
export const SkeletonRecItem: React.FC = () => (
  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
    <div style={line('65%', '10px')} />
    <div style={line('40%', '9px', { opacity: 0.6 })} />
  </div>
);

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const Skeleton = SkeletonList;
