import React, { useState, useEffect } from 'react';
import './ChatTimer.css';

const ChatTimer = ({ initialMinutes = 20, onExpire }) => {
  const [timeRemaining, setTimeRemaining] = useState(initialMinutes * 60); // Convert to seconds

  useEffect(() => {
    if (timeRemaining <= 0) {
      if (onExpire) onExpire();
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, onExpire]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="chat-timer">
      <div className="chat-timer-display">{formatTime(timeRemaining)}</div>
      <div className="chat-timer-label">REMAINING</div>
    </div>
  );
};

export default ChatTimer;
