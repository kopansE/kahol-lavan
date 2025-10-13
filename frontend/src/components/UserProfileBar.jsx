import React from "react";
import "../App.css";

const UserProfileBar = ({ user, onSignOut }) => {
  return (
    <div className="user-profile-bar">
      {user.user_metadata?.avatar_url && (
        <img
          src={user.user_metadata.avatar_url}
          alt={user.user_metadata.full_name || user.email}
          className="user-avatar"
        />
      )}
      <div className="user-info">
        <div className="user-name">
          {user.user_metadata?.full_name || "User"}
        </div>
        <div className="user-email">{user.email}</div>
      </div>
      <button className="signout-button" onClick={onSignOut}>
        Sign Out
      </button>
    </div>
  );
};

export default UserProfileBar;
