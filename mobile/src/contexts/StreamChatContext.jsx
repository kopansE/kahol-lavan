import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { StreamChat } from 'stream-chat';
import { supabase } from '../config/supabase.js';

const StreamChatContext = createContext(null);

export const useStreamChat = () => {
  const context = useContext(StreamChatContext);
  if (!context) {
    throw new Error('useStreamChat must be used within StreamChatProvider');
  }
  return context;
};

/**
 * Ensures we have a valid, fresh session before making API calls.
 * Uses getUser() to validate the token server-side, and refreshes if needed.
 */
const ensureValidSession = async () => {
  // First, try to get the current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('No active session');
  }

  // Validate the token by calling getUser() - this checks with the server
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    // Token might be expired, try to refresh
    console.log('Token validation failed, attempting refresh...');
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      throw new Error('Failed to refresh session');
    }
    
    return refreshData.session;
  }
  
  return session;
};

/**
 * Invoke a Supabase function with automatic token refresh and retry
 */
const invokeWithRetry = async (functionName, options = {}, maxRetries = 2) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Ensure valid session before each attempt
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt} for ${functionName}, refreshing session...`);
        await supabase.auth.refreshSession();
      }
      
      const { data, error } = await supabase.functions.invoke(functionName, options);
      
      if (error) {
        // Check if it's an auth error that might be fixed by refresh
        const isAuthError = error.message?.includes('User not found') || 
                           error.message?.includes('JWT') ||
                           error.message?.includes('token') ||
                           error.message?.includes('authorization');
        
        if (isAuthError && attempt < maxRetries - 1) {
          lastError = error;
          continue; // Retry with refreshed token
        }
        throw error;
      }
      
      return { data, error: null };
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries - 1) {
        break;
      }
    }
  }
  
  return { data: null, error: lastError };
};

export const StreamChatProvider = ({ children, user }) => {
  const [chatClient, setChatClient] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const connectUser = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsConnecting(true);
      setConnectionError(null);

      // Ensure we have a valid session before proceeding
      await ensureValidSession();

      // Get Stream Chat token from backend with retry logic
      const { data, error } = await invokeWithRetry('get-stream-token');

      if (error) {
        throw new Error(`Failed to get Stream token: ${error.message}`);
      }

      if (!data || !data.token || !data.api_key) {
        throw new Error('Invalid token response from backend');
      }

      // Initialize Stream Chat client
      const client = StreamChat.getInstance(data.api_key);

      // Disconnect existing user if any
      if (client.userID) {
        await client.disconnectUser();
      }

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
  }, [user]);

  useEffect(() => {
    if (!user) {
      // User logged out, disconnect
      if (chatClient) {
        chatClient.disconnectUser();
        setChatClient(null);
      }
      return;
    }

    connectUser();

    return () => {
      if (chatClient) {
        chatClient.disconnectUser();
      }
    };
  }, [user, connectUser]);

  // Reconnect function for manual retry
  const reconnect = useCallback(() => {
    if (user && !isConnecting) {
      connectUser();
    }
  }, [user, isConnecting, connectUser]);

  const value = {
    chatClient,
    isConnecting,
    connectionError,
    isReady: !isConnecting && chatClient !== null && !connectionError,
    reconnect, // Expose reconnect for manual retry
    invokeWithRetry, // Expose for other components to use
  };

  return (
    <StreamChatContext.Provider value={value}>
      {children}
    </StreamChatContext.Provider>
  );
};
