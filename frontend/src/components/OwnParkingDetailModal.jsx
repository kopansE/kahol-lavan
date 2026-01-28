import React, { useEffect, useRef, useState } from "react";
import { formatParkingZone } from "../utils/parkingZoneUtils";
import "./OwnParkingDetailModal.css";

/**
 * Detects if the user is on a mobile device
 */
const isMobileDevice = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
};

/**
 * Detects if the user is on iOS
 */
const isIOS = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /iphone|ipad|ipod/i.test(userAgent.toLowerCase());
};

/**
 * Detects if the user is on Android
 */
const isAndroid = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /android/i.test(userAgent.toLowerCase());
};

/**
 * Opens the device's default navigation app with directions to the specified coordinates
 */
const openNavigation = async (lat, lng, address = '') => {
  const destination = `${lat},${lng}`;
  const label = encodeURIComponent(address || 'Parking Location');
  const googleMapsWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
  
  if (isMobileDevice()) {
    if (isIOS()) {
      const appleMapsUrl = `maps://?daddr=${destination}&dirflg=d`;
      window.location.href = appleMapsUrl;
      return true;
    } else if (isAndroid()) {
      const geoUrl = `geo:${destination}?q=${destination}(${label})`;
      window.location.href = geoUrl;
      setTimeout(() => {
        window.open(googleMapsWebUrl, '_blank');
      }, 1000);
      return true;
    }
  }
  
  window.open(googleMapsWebUrl, '_blank');
  return true;
};

/**
 * Format time as HH:MM
 */
const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('he-IL', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

/**
 * Format date as DD.M.YYYY
 */
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

/**
 * Get status display info
 */
const getStatusInfo = (status) => {
  switch (status) {
    case 'active':
      return { text: 'Active', hebrewText: 'פעיל', color: '#28a745' };
    case 'waiting':
      return { text: 'Waiting', hebrewText: 'בתור להקצאה', color: '#f0ad4e' };
    case 'reserved':
      return { text: 'Reserved', hebrewText: 'שמור', color: '#dc3545' };
    default:
      return { text: 'Active', hebrewText: 'פעיל', color: '#28a745' };
  }
};

const OwnParkingDetailModal = ({ parking, onClose }) => {
  const modalRef = useRef(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const hasValidCoordinates = parking?.position && 
    Array.isArray(parking.position) && 
    parking.position.length >= 2 &&
    typeof parking.position[0] === 'number' &&
    typeof parking.position[1] === 'number';

  const handleNavigateClick = async (e) => {
    e.stopPropagation();
    
    if (isNavigating || !hasValidCoordinates) return;

    try {
      setIsNavigating(true);
      const [lat, lng] = parking.position;
      const success = await openNavigation(lat, lng, parking.address);
      
      if (!success) {
        const coordinates = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        const message = `Could not open navigation app.\n\nParking address:\n${parking.address || coordinates}`;
        alert(message);
      }
    } catch (error) {
      console.error('Error opening navigation:', error);
      alert('Failed to open navigation. Please try again.');
    } finally {
      setTimeout(() => setIsNavigating(false), 500);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!parking) return null;

  const statusInfo = getStatusInfo(parking.status);

  return (
    <div className="own-parking-overlay">
      <div className="own-parking-modal" ref={modalRef}>
        {/* Header */}
        <div className="own-parking-header">
          <div className="header-content">
            <div className="header-text">
              <h2 className="header-title-hebrew">מקום החניה שלך</h2>
              <p className="header-title-english">Your Parking Spot</p>
            </div>
            <div className="header-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="12" r="4" fill="currentColor"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="own-parking-content">
          {/* Address Card */}
          <div className="address-card">
            <div className="address-map-preview">
              <div className="map-pin-icon">
                <svg viewBox="0 0 24 24" fill="#EA4335" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
            </div>
            <div className="address-info">
              <span className="address-label">כתובת</span>
              <p className="address-text">{parking.address || 'Unknown Address'}</p>
            </div>
          </div>

          {/* Status Bar */}
          <div className="status-bar">
            <div className="zone-badge">
              {formatParkingZone(parking.parking_zone)}
            </div>
            <div className="status-info" style={{ backgroundColor: statusInfo.color === '#f0ad4e' ? '#fff3cd' : statusInfo.color + '20' }}>
              <span className="status-text" style={{ color: statusInfo.color === '#f0ad4e' ? '#856404' : statusInfo.color }}>
                {statusInfo.text}
              </span>
              <span className="status-hebrew" style={{ color: statusInfo.color === '#f0ad4e' ? '#856404' : statusInfo.color }}>
                {statusInfo.hebrewText}
              </span>
              <div className="status-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="9" stroke={statusInfo.color === '#f0ad4e' ? '#856404' : statusInfo.color} strokeWidth="2"/>
                  <path d="M12 6v6l4 2" stroke={statusInfo.color === '#f0ad4e' ? '#856404' : statusInfo.color} strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Date and Time Info */}
          <div className="datetime-container">
            <div className="datetime-box">
              <span className="datetime-label">שעה</span>
              <div className="datetime-value">
                <span>{formatTime(parking.timestamp)}</span>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="datetime-icon">
                  <circle cx="12" cy="12" r="9" stroke="#667eea" strokeWidth="2"/>
                  <path d="M12 6v6l4 2" stroke="#667eea" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div className="datetime-box">
              <span className="datetime-label">תאריך</span>
              <div className="datetime-value">
                <span>{formatDate(parking.timestamp)}</span>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="datetime-icon">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="#667eea" strokeWidth="2"/>
                  <path d="M3 10h18" stroke="#667eea" strokeWidth="2"/>
                  <path d="M8 2v4M16 2v4" stroke="#667eea" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Navigation Button */}
          <button
            className={`own-parking-navigate-btn ${(!hasValidCoordinates || isNavigating) ? 'disabled' : ''}`}
            onClick={handleNavigateClick}
            disabled={!hasValidCoordinates || isNavigating}
          >
            {isNavigating ? (
              <span className="navigate-loading">Opening navigation...</span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="navigate-icon">
                  <path d="M12 2L19 21L12 17L5 21L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{hasValidCoordinates ? 'Navigate' : 'Location unavailable'}</span>
              </>
            )}
          </button>

          {/* Close Button */}
          <button className="own-parking-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnParkingDetailModal;
