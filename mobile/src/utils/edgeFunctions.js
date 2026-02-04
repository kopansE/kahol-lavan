import { supabase } from '../config/supabase';
import { SUPABASE_URL } from '@env';
import { getParkingZone } from './parkingZoneUtils';

/**
 * Ensures we have a valid, fresh token before making API calls.
 * Validates the token server-side and refreshes if needed.
 */
const ensureValidToken = async () => {
  // Get current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('Authentication required. Please log in again.');
  }

  // Validate the token by calling getUser() - this checks with the server
  const { error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    // Token might be expired, try to refresh
    console.log('Token validation failed, attempting refresh...');
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      throw new Error('Session expired. Please log in again.');
    }
    
    return refreshData.session.access_token;
  }
  
  return session.access_token;
};

/**
 * Check if an error is authentication-related and might be fixed by token refresh
 */
const isAuthError = (error, response) => {
  if (response && (response.status === 401 || response.status === 403)) {
    return true;
  }
  const errorMsg = error?.message || error?.toString() || '';
  return errorMsg.includes('User not found') || 
         errorMsg.includes('JWT') ||
         errorMsg.includes('token') ||
         errorMsg.includes('authorization') ||
         errorMsg.includes('expired');
};

/**
 * Call an edge function with automatic token refresh and retry logic
 */
const callEdgeFunction = async (functionName, options = {}, maxRetries = 2) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get fresh token (validates and refreshes if needed)
      const token = await ensureValidToken();
      const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
      
      const config = {
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      };
      
      if (options.body) {
        config.body = JSON.stringify(options.body);
      }
      
      const response = await fetch(url, config);
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        const error = new Error(result.error || result.message || 'Request failed');
        
        // If it's an auth error and we have retries left, try again
        if (isAuthError(error, response) && attempt < maxRetries - 1) {
          console.log(`Auth error on attempt ${attempt + 1} for ${functionName}, refreshing and retrying...`);
          // Force session refresh before next attempt
          await supabase.auth.refreshSession();
          lastError = error;
          continue;
        }
        
        throw error;
      }
      
      return result;
    } catch (err) {
      lastError = err;
      
      // If it's an auth error and we have retries left, try again
      if (isAuthError(err) && attempt < maxRetries - 1) {
        console.log(`Error on attempt ${attempt + 1} for ${functionName}, refreshing and retrying...`);
        await supabase.auth.refreshSession();
        continue;
      }
      
      if (attempt === maxRetries - 1) {
        break;
      }
    }
  }
  
  throw lastError;
};

// Pin operations
export const savePin = async (position, address) => {
  // Calculate parking zone from position
  const [lat, lng] = position;
  const parkingZoneInfo = getParkingZone(lat, lng);
  const parkingZoneNumber = parkingZoneInfo ? parkingZoneInfo.zone : null;

  return callEdgeFunction('save-pin', {
    body: {
      position: position,
      parking_zone: parkingZoneNumber,
      address: address,
    },
  });
};

export const activatePin = async (pinId) => {
  return callEdgeFunction('activate-pin', {
    body: { pin_id: pinId },
  });
};

export const deactivatePin = async (pinId) => {
  return callEdgeFunction('deactivate-pin', {
    body: { pin_id: pinId },
  });
};

// Reservation operations
export const reserveParking = async (pinId) => {
  return callEdgeFunction('reserve-parking', {
    body: { pin_id: pinId },
  });
};

export const cancelReservation = async (pinId) => {
  return callEdgeFunction('cancel-reservation', {
    body: { pin_id: pinId },
  });
};

export const acceptReservation = async (transferRequestId) => {
  return callEdgeFunction('accept-reservation', {
    body: { transfer_request_id: transferRequestId },
  });
};

export const declineReservation = async (transferRequestId) => {
  return callEdgeFunction('decline-reservation', {
    body: { transfer_request_id: transferRequestId },
  });
};

// Chat-based reservation operations
export const approveInChat = async (sessionId) => {
  return callEdgeFunction('approve-in-chat', {
    body: { session_id: sessionId },
  });
};

export const cancelInChat = async (sessionId) => {
  return callEdgeFunction('cancel-in-chat', {
    body: { session_id: sessionId },
  });
};

export const extendInChat = async (sessionId) => {
  return callEdgeFunction('extend-in-chat', {
    body: { session_id: sessionId },
  });
};

// Data fetching operations
export const getActivePins = async () => {
  return callEdgeFunction('get-active-pins', {
    method: 'GET',
  });
};

export const getPendingNotifications = async () => {
  return callEdgeFunction('get-pending-notifications', {
    method: 'GET',
  });
};

export const getUserProfile = async () => {
  return callEdgeFunction('get-user-profile', {
    method: 'GET',
  });
};

export const getWalletBalance = async () => {
  return callEdgeFunction('get-wallet-balance', {
    method: 'GET',
  });
};

// Payment operations
export const setupPaymentMethod = async (redirectBaseUrl) => {
  return callEdgeFunction('setup-payment-method', {
    body: { redirect_base_url: redirectBaseUrl },
  });
};

export const completePaymentSetup = async () => {
  return callEdgeFunction('complete-payment-setup', {
    method: 'POST',
  });
};

// User data operations
export const updateUserCarData = async (carData) => {
  return callEdgeFunction('update-user-car-data', {
    body: carData,
  });
};

// Search/Maps operations
export const placesAutocomplete = async (input, sessionToken) => {
  let url = `places-autocomplete?input=${encodeURIComponent(input)}`;
  if (sessionToken) {
    url += `&sessionToken=${sessionToken}`;
  }
  return callEdgeFunctionGet(url);
};

export const geocodeAddress = async (placeId, sessionToken) => {
  let url = `geocode-address?placeId=${encodeURIComponent(placeId)}`;
  if (sessionToken) {
    url += `&sessionToken=${sessionToken}`;
  }
  return callEdgeFunctionGet(url);
};

export const getStreetGeometry = async (streetName, lat, lng, viewport) => {
  let url = `get-street-geometry?streetName=${encodeURIComponent(streetName)}&lat=${lat}&lng=${lng}`;
  if (viewport) {
    url += `&viewport=${encodeURIComponent(JSON.stringify(viewport))}`;
  }
  return callEdgeFunctionGet(url);
};

// Helper function for GET requests with query params (uses same retry logic)
const callEdgeFunctionGet = async (pathWithParams, maxRetries = 2) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const token = await ensureValidToken();
      const url = `${SUPABASE_URL}/functions/v1/${pathWithParams}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        const error = new Error(result.error || result.message || 'Request failed');
        
        if (isAuthError(error, response) && attempt < maxRetries - 1) {
          console.log(`Auth error on GET attempt ${attempt + 1}, refreshing and retrying...`);
          await supabase.auth.refreshSession();
          lastError = error;
          continue;
        }
        
        throw error;
      }
      
      return result;
    } catch (err) {
      lastError = err;
      
      if (isAuthError(err) && attempt < maxRetries - 1) {
        console.log(`Error on GET attempt ${attempt + 1}, refreshing and retrying...`);
        await supabase.auth.refreshSession();
        continue;
      }
      
      if (attempt === maxRetries - 1) {
        break;
      }
    }
  }
  
  throw lastError;
};
