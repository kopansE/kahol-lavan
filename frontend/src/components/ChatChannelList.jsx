import React, { useState, useEffect } from 'react';
import { useStreamChat } from '../contexts/StreamChatContext';
import { supabase } from '../supabaseClient';
import ChatThread from './ChatThread';
import './ChatChannelList.css';

const ChatChannelList = ({ onClose, onBack, inSideMenu = false }) => {
  const { chatClient, isReady } = useStreamChat();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null); // Track by session ID, not Stream channel

  useEffect(() => {
    if (!isReady) return;

    loadChannels();
  }, [isReady]);

  const loadChannels = async () => {
    try {
      setLoading(true);

      // Get channels from our database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('No authentication token');
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-channels`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.channels) {
        console.error('Failed to load channels, refreshing page in 2 seconds...');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        throw new Error('Failed to load channels');
      }

      // Get Stream channels with their state
      const streamChannels = await Promise.all(
        result.channels.map(async (channelData) => {
          try {
            const channel = chatClient.channel(
              channelData.stream_channel_type,
              channelData.stream_channel_id
            );
            await channel.watch();
            return {
              ...channelData,
              streamChannel: channel,
            };
          } catch (err) {
            console.error(`Failed to load channel ${channelData.stream_channel_id}:`, err);
            console.error('Refreshing page in 2 seconds...');
            setTimeout(() => {
              window.location.reload();
            }, 2000);
            return null;
          }
        })
      );

      setChannels(streamChannels.filter(c => c !== null));
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderChannelItem = (channelData) => {
    const channel = channelData.streamChannel;
    const otherUser = channelData.other_user;
    const unreadCount = channel.countUnread();
    const lastMessage = channel.state.messages[channel.state.messages.length - 1];

    return (
      <div
        key={channelData.id}
        className="chat-channel-item"
        onClick={() => setSelectedSessionId(channelData.id)} // Use session ID, not Stream channel
      >
        <div className="chat-channel-avatar">
          {getInitials(otherUser.full_name)}
        </div>
        <div className="chat-channel-info">
          <div className="chat-channel-name">
            {otherUser.full_name}
            {otherUser.car_license_plate && ` • ${otherUser.car_license_plate}`}
          </div>
          <div className="chat-channel-preview">
            {lastMessage?.text || 'No messages yet'}
          </div>
        </div>
        <div className="chat-channel-meta">
          <div className="chat-channel-time">
            {formatTime(lastMessage?.created_at || channelData.created_at)}
          </div>
          {unreadCount > 0 && (
            <div className="chat-channel-unread">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Find selected session by ID (ensures correct session even when multiple share same Stream channel)
  const selectedChannelData = selectedSessionId 
    ? channels.find(c => c.id === selectedSessionId) 
    : null;

  if (selectedChannelData) {
    return (
      <ChatThread
        channel={selectedChannelData.streamChannel}
        otherUser={selectedChannelData.other_user}
        channelData={selectedChannelData}
        onClose={inSideMenu ? onClose : () => setSelectedSessionId(null)}
        onBack={() => setSelectedSessionId(null)}
        inSideMenu={inSideMenu}
      />
    );
  }

  // Separate channels into active and history
  const activeChannels = channels.filter(c => c.status === 'active');
  const historyChannels = channels.filter(c => c.status !== 'active');

  // Render inside side menu
  if (inSideMenu) {
    return (
      <div className="chat-channel-list-side-menu">
        <div className="page-header">
          <button className="back-button" onClick={onBack}>
            ‹
          </button>
          <h2 className="page-title">Chats</h2>
          <button className="page-close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="chat-channel-list-content side-menu-content">
          {loading ? (
            <div className="chat-loading-state">
              <div className="chat-loading-spinner"></div>
              <p>Loading conversations...</p>
            </div>
          ) : channels.length === 0 ? (
            <div className="chat-empty-state">
              <div className="chat-empty-state-icon">💬</div>
              <h3>No conversations yet</h3>
              <p>Reserve a parking spot to start chatting with other users!</p>
            </div>
          ) : (
            <>
              <div className="chat-section">
                <div className="chat-section-header">Active</div>
                {activeChannels.length > 0 ? (
                  activeChannels.map(renderChannelItem)
                ) : (
                  <div className="chat-section-empty">No active chats</div>
                )}
              </div>

              <div className="chat-section">
                <div className="chat-section-header">History</div>
                {historyChannels.length > 0 ? (
                  historyChannels.map(renderChannelItem)
                ) : (
                  <div className="chat-section-empty">No chat history</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render as overlay (original behavior)
  return (
    <div className="chat-channel-list-overlay" onClick={onClose}>
      <div className="chat-channel-list-container" onClick={(e) => e.stopPropagation()}>
        <div className="chat-channel-list-header">
          <h2>Messages</h2>
          <button className="chat-close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="chat-channel-list-content">
          {loading ? (
            <div className="chat-loading-state">
              <div className="chat-loading-spinner"></div>
              <p>Loading conversations...</p>
            </div>
          ) : channels.length === 0 ? (
            <div className="chat-empty-state">
              <div className="chat-empty-state-icon">💬</div>
              <h3>No conversations yet</h3>
              <p>Reserve a parking spot to start chatting with other users!</p>
            </div>
          ) : (
            <>
              <div className="chat-section">
                <div className="chat-section-header">Active</div>
                {activeChannels.length > 0 ? (
                  activeChannels.map(renderChannelItem)
                ) : (
                  <div className="chat-section-empty">No active chats</div>
                )}
              </div>

              <div className="chat-section">
                <div className="chat-section-header">History</div>
                {historyChannels.length > 0 ? (
                  historyChannels.map(renderChannelItem)
                ) : (
                  <div className="chat-section-empty">No chat history</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatChannelList;
