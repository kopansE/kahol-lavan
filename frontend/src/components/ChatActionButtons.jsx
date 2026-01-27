import React from 'react';
import './ChatActionButtons.css';

const ChatActionButtons = ({ onCancel, onApprove, onExtension, isProcessing = false, approvalState = {} }) => {
  const { userApproved, otherUserApproved, bothApproved } = approvalState;

  console.log('ChatActionButtons rendered with:', { 
    hasOnApprove: !!onApprove, 
    hasOnCancel: !!onCancel, 
    isProcessing, 
    approvalState 
  });

  const handleCancel = () => {
    console.log('ChatActionButtons: Cancel button pressed');
    if (onCancel && !isProcessing && !bothApproved) {
      console.log('ChatActionButtons: Calling onCancel handler');
      onCancel();
    } else {
      console.log('ChatActionButtons: Cancel blocked -', { hasOnCancel: !!onCancel, isProcessing, bothApproved });
    }
  };

  const handleApprove = () => {
    console.log('ChatActionButtons: Approve button pressed');
    if (onApprove && !isProcessing && !bothApproved) {
      console.log('ChatActionButtons: Calling onApprove handler');
      onApprove();
    } else {
      console.log('ChatActionButtons: Approve blocked -', { hasOnApprove: !!onApprove, isProcessing, bothApproved });
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
