import React from 'react';
import './ChatActionButtons.css';

const ChatActionButtons = ({ onCancel, onApprove, onExtension, isProcessing = false, approvalState = {} }) => {
  const { userApproved, otherUserApproved, bothApproved } = approvalState;

  const handleCancel = () => {
    if (onCancel && !isProcessing && !bothApproved) {
      onCancel();
    }
  };

  const handleApprove = () => {
    if (onApprove && !isProcessing && !bothApproved) {
      onApprove();
    }
  };

  const handleExtension = () => {
    if (onExtension && !isProcessing) {
      onExtension();
    }
  };

  // Determine button states and text
  const approveButtonDisabled = isProcessing || bothApproved;
  const cancelButtonDisabled = isProcessing || bothApproved;
  
  const getApproveButtonText = () => {
    if (bothApproved) return 'COMPLETED';
    if (isProcessing) return 'PROCESSING...';
    if (userApproved && !otherUserApproved) return 'WAITING...';
    return 'APPROVE';
  };

  const getCancelButtonText = () => {
    if (bothApproved) return 'COMPLETED';
    if (isProcessing) return 'PROCESSING...';
    return 'CANCEL';
  };

  const getApproveIcon = () => {
    if (bothApproved) return '✓✓';
    if (userApproved && !otherUserApproved) return '⏳';
    return '✓';
  };

  return (
    <div className="chat-action-buttons">
      <button 
        type="button"
        className={`chat-action-btn cancel-btn ${cancelButtonDisabled ? 'disabled' : ''}`}
        onClick={handleCancel}
        disabled={cancelButtonDisabled}
      >
        {isProcessing ? (
          <span className="chat-action-spinner">⏳</span>
        ) : (
          <>
            <span className="chat-action-icon">✕</span>
            <span className="chat-action-label">{getCancelButtonText()}</span>
          </>
        )}
      </button>
      <button 
        type="button"
        className={`chat-action-btn approve-btn ${approveButtonDisabled ? 'disabled' : ''} ${bothApproved ? 'completed' : ''}`}
        onClick={handleApprove}
        disabled={approveButtonDisabled}
      >
        {isProcessing ? (
          <span className="chat-action-spinner">⏳</span>
        ) : (
          <>
            <span className="chat-action-icon">{getApproveIcon()}</span>
            <span className={`chat-action-label ${userApproved && !otherUserApproved ? 'small' : ''}`}>
              {getApproveButtonText()}
            </span>
          </>
        )}
      </button>
      <button type="button" className="chat-action-btn extension-btn" onClick={handleExtension}>
        <span className="chat-action-icon">+</span>
        <span className="chat-action-label">EXTENSION</span>
      </button>
    </div>
  );
};

export default ChatActionButtons;
