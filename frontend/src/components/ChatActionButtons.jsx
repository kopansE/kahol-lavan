import React from 'react';
import './ChatActionButtons.css';

const ChatActionButtons = ({ onCancel, onApprove, onExtension }) => {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      alert('Cancel clicked');
    }
  };

  const handleApprove = () => {
    if (onApprove) {
      onApprove();
    } else {
      alert('Approve clicked');
    }
  };

  const handleExtension = () => {
    if (onExtension) {
      onExtension();
    } else {
      alert('Extension clicked');
    }
  };

  return (
    <div className="chat-action-buttons">
      <button className="chat-action-btn cancel-btn" onClick={handleCancel}>
        <span className="chat-action-icon">✕</span>
        <span className="chat-action-label">CANCEL</span>
      </button>
      <button className="chat-action-btn approve-btn" onClick={handleApprove}>
        <span className="chat-action-icon">✓</span>
        <span className="chat-action-label">APPROVE</span>
      </button>
      <button className="chat-action-btn extension-btn" onClick={handleExtension}>
        <span className="chat-action-icon">+</span>
        <span className="chat-action-label">EXTENSION</span>
      </button>
    </div>
  );
};

export default ChatActionButtons;
