import React, { createContext, useContext, useEffect, useState } from 'react';
import { StreamChat } from 'stream-chat';
import { supabase } from '../config/supabase';

const StreamChatContext = createContext(null);

export const useStreamChat = () => {
  const context = useContext(StreamChatContext);
  if (!context) {
    throw new Error('useStreamChat must be used within StreamChatProvider');
  }
  return context;
};

export const StreamChatProvider = ({ children, user }) => {
  const [chatClient, setChatClient] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    if (!user) {
      // User logged out, disconnect
      if (chatClient) {
        chatClient.disconnectUser();
        setChatClient(null);
      }
      return;
    }

    const connectUser = async () => {
      try {
        setIsConnecting(true);
        setConnectionError(null);

        // Get auth token
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          throw new Error('No authentication token');
        }

        // Get Stream Chat token from backend
        const { data, error } = await supabase.functions.invoke('get-stream-token');

        if (error) {
          throw new Error(`Failed to get Stream token: ${error.message}`);
        }

        if (!data || !data.token || !data.api_key) {
          throw new Error('Invalid token response from backend');
        }

        // Initialize Stream Chat client
        const client = StreamChat.getInstance(data.api_key);

        // Connect user
        await client.connectUser(
          {
            id: user.id,
            name: user.user_metadata?.full_name || user.email || 'User',
            image: user.user_metadata?.avatar_url,
          },
          data.token
        );

        setChatClient(client);
      } catch (err) {
        console.error('Failed to connect to Stream Chat:', err);
        setConnectionError(err.message);
      } finally {
        setIsConnecting(false);
      }
    };

    connectUser();

    return () => {
      if (chatClient) {
        chatClient.disconnectUser();
      }
    };
  }, [user]);

  const value = {
    chatClient,
    isConnecting,
    connectionError,
    isReady: !isConnecting && chatClient !== null && !connectionError,
  };

  return (
    <StreamChatContext.Provider value={value}>
      {children}
    </StreamChatContext.Provider>
  );
};
