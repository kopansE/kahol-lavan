import React from 'react';
import { Chat, Channel, Window, MessageList, MessageInput } from 'stream-chat-react';
import { useStreamChat } from '../contexts/StreamChatContext';
import 'stream-chat-react/dist/css/v2/index.css';
import './ChatThread.css';

const ChatThread = ({ channel, otherUser, onClose, onBack }) => {
  const { chatClient } = useStreamChat();

  if (!chatClient || !channel) {
    return null;
  }

  return (
    <div className="chat-thread-overlay" onClick={onClose}>
      <div className="chat-thread-container" onClick={(e) => e.stopPropagation()}>
        <div className="chat-thread-header">
          <button className="chat-thread-back-button" onClick={onBack}>
            ←
          </button>
          <div className="chat-thread-user-info">
            <h3 className="chat-thread-user-name">
              {otherUser?.full_name || 'User'}
            </h3>
            {otherUser && (
              <div className="chat-thread-user-details">
                {otherUser.car_make && otherUser.car_model && (
                  <>
                    {otherUser.car_make} {otherUser.car_model}
                    {otherUser.car_color && ` • ${otherUser.car_color}`}
                    {otherUser.car_license_plate && ` • ${otherUser.car_license_plate}`}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <Chat client={chatClient} theme="str-chat__theme-light">
          <Channel channel={channel}>
            <Window>
              <MessageList />
              <MessageInput />
            </Window>
          </Channel>
        </Chat>
      </div>
    </div>
  );
};

export default ChatThread;
