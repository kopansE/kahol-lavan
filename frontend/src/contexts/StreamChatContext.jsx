import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { StreamChat } from 'stream-chat';
import { supabase } from '../supabaseClient';

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
 * Returns a valid access token after validation/refresh.
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
    
    return refreshData.session.access_token;
  }
  
  return session.access_token;
};

/**
 * Fetch with automatic token refresh and retry
 */
const fetchWithRetry = async (url, options = {}, maxRetries = 2) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get fresh token for each attempt
      const token = await ensureValidSession();
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's an auth error that might be fixed by refresh
        const isAuthError = response.status === 401 || 
                           response.status === 403 ||
                           data.error?.includes('User not found') ||
                           data.error?.includes('JWT') ||
                           data.error?.includes('token');
        
        if (isAuthError && attempt < maxRetries - 1) {
          console.log(`Auth error on attempt ${attempt + 1}, will retry with fresh token...`);
          // Force a session refresh before next attempt
          await supabase.auth.refreshSession();
          lastError = new Error(data.error || `HTTP ${response.status}`);
          continue;
        }
        throw new Error(data.error || `HTTP ${response.status}`);
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

      // Get Stream Chat token from backend with retry logic
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-stream-token`;
      const { data, error } = await fetchWithRetry(url, { method: 'GET' });

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
    fetchWithRetry, // Expose for other components to use
  };

  return (
    <StreamChatContext.Provider value={value}>
      {children}
    </StreamChatContext.Provider>
  );
};
