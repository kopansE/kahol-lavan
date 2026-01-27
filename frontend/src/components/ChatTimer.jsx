import React, { useState, useEffect } from 'react';
import './ChatTimer.css';

const ChatTimer = ({ startedAt, initialMinutes = 20, onExpire }) => {
  const calculateTimeRemaining = () => {
    if (!startedAt) {
      return initialMinutes * 60;
    }
    
    const now = new Date();
    const started = new Date(startedAt);
    const elapsedSeconds = Math.floor((now - started) / 1000);
    const totalSeconds = initialMinutes * 60;
    const remaining = totalSeconds - elapsedSeconds;
    
    return Math.max(0, remaining);
  };

  const [timeRemaining, setTimeRemaining] = useState(calculateTimeRemaining());

  useEffect(() => {
    // Recalculate on mount in case component remounts
    setTimeRemaining(calculateTimeRemaining());
  }, [startedAt]);

  useEffect(() => {
    if (timeRemaining <= 0) {
      if (onExpire) onExpire();
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
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
