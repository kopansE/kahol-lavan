import { supabase } from '../config/supabase';
import { SUPABASE_URL } from '@env';

const getAuthToken = async () => {
  const { data: sessionData, error } = await supabase.auth.getSession();
  
  if (error || !sessionData?.session?.access_token) {
    throw new Error('Authentication required. Please log in again.');
  }
  
  return sessionData.session.access_token;
};

const callEdgeFunction = async (functionName, options = {}) => {
  const token = await getAuthToken();
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
    throw new Error(result.error || result.message || 'Request failed');
  }
  
  return result;
};

// Pin operations
export const savePin = async (position, address) => {
  return callEdgeFunction('save-pin', {
    body: {
      position: position,
      parking_zone: null,
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
