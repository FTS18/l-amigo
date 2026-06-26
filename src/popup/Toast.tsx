import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, action, duration }) => {
  const finalDuration = duration ?? (type === 'error' ? 6000 : 4000);

  useEffect(() => {
    const timer = setTimeout(onClose, finalDuration);
    return () => clearTimeout(timer);
  }, [finalDuration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 size={16} />;
      case 'error': return <XCircle size={16} />;
      case 'info': return <Info size={16} />;
      default: return null;
    }
  };

  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">{getIcon()}</span>
      <span className="toast-message">{message}</span>
      {action && (
        <button 
          className="toast-action-btn" 
          onClick={(e) => { e.stopPropagation(); action.onClick(); }}
          style={{ marginLeft: '8px', padding: '4px 10px', fontSize: 'var(--font-size-base)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '0px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}
        >
          {action.label}
        </button>
      )}
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
};
