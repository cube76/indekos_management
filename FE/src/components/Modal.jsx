import React from 'react';

const Modal = ({ isOpen, title, children, onClose, onConfirm, confirmText = 'Confirm', confirmColor = 'primary', isLoading = false }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="close-btn" disabled={isLoading}>&times;</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary" disabled={isLoading}>Cancel</button>
          {onConfirm && (
            <button 
                onClick={onConfirm} 
                className={`btn btn-${confirmColor}`} 
                disabled={isLoading}
            >
              {isLoading ? 'Processing...' : confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
