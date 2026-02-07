import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'error' | 'success';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, message, type = 'info' }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-brutalist" onClick={(e) => e.stopPropagation()}>
        <div className={`modal-header modal-${type}`}>
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="modal-btn" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
