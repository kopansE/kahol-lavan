import React, { useState, useEffect } from 'react';
import { useStreamChat } from '../contexts/StreamChatContext';
import ChatChannelList from './ChatChannelList';
import './ChatButton.css';

const ChatButton = () => {
  const { chatClient, isReady } = useStreamChat();
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!chatClient || !isReady) return;

    // Listen for unread count changes
    const updateUnreadCount = () => {
      const count = chatClient.user?.total_unread_count || 0;
      setUnreadCount(count);
    };

    updateUnreadCount();

    // Listen for new messages
    chatClient.on('message.new', updateUnreadCount);
    chatClient.on('notification.mark_read', updateUnreadCount);

    return () => {
      chatClient.off('message.new', updateUnreadCount);
      chatClient.off('notification.mark_read', updateUnreadCount);
    };
  }, [chatClient, isReady]);

  if (!isReady) {
    return null; // Don't show button until chat is ready
  }

  return (
    <>
      <button
        className={`chat-button ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setShowChat(true)}
        title="Open Chat"
      >
        💬
        {unreadCount > 0 && (
          <span className="chat-button-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showChat && (
        <ChatChannelList onClose={() => setShowChat(false)} />
      )}
    </>
  );
};

export default ChatButton;
