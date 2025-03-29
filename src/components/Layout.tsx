// Layout.tsx
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import './Layout.css'; // Put your nav CSS here
import { useWatchlist } from './WatchlistContext.tsx';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasUnsavedChanges, setHasUnsavedChanges, clearUndo } = useWatchlist();

  // useAuth for global csrf token and username
  const { currentUser, csrfToken } = useAuth();

      const {
          setWatchList,
          setRecommendations,
          clearUserCache
        } = useWatchlist();

  const [pendingRequests, setPendingRequests] = useState<number>(0);

  useEffect(() => {
    const fetchFriendRequests = async () => {
      if (!currentUser) return;
  
      try {
        const response = await axios.get('http://localhost:5000/api/friendRequests', {
          params: { username: currentUser },
          withCredentials: true,
        });
  
        setPendingRequests(response.data.length || 0);
      } catch (error) {
        console.error('Error fetching friend requests:', error);
      }
    };
  
    fetchFriendRequests();
  }, [location.pathname, currentUser]);
  

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleLogout = async () => {
    const confirmLogout = window.confirm(
      "Make sure to save your watchlist before logging out! Click OK to proceed or Cancel to stay."
    );
    if (!confirmLogout) return;
  
    if (!csrfToken) {
      alert("Missing CSRF token. Please try again later.");
      return;
    }
  
    try {
      await fetch('http://localhost:5000/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
  
      if (currentUser) {
        clearUserCache(currentUser);
      }

      new BroadcastChannel("auth").postMessage({ type: "logout" });
      navigate('/login');
    } catch (err) {
      console.error("❌ Logout failed:", err);
      alert("Logout failed. Please try again.");
    }
  };
  

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="titleHome">Movie Manager</h1>
        <button className="logoutButton" onClick={() => handleNavigate("/Home")}>Add movies</button>
        <button className="logoutButton" onClick={() => handleNavigate("/Browse")}>Browse other accounts</button>
        <button className="logoutButton" onClick={() => handleNavigate("/EditWatchList")}>Edit watchlist</button>
        <button
            className={`logoutButton ${pendingRequests > 0 ? 'highlightedFriendRequests' : ''}`}
            onClick={() => handleNavigate("/Profile")}
            >
            Edit Profile
            {pendingRequests > 0 && (
                <span className="friendRequestBadge">{pendingRequests}</span>
            )}
        </button>
        <button className="logoutButton" onClick={handleLogout}>Logout</button>
      </header>

      {hasUnsavedChanges && (
        <div className="unsavedNotification">You have unsaved changes!</div>
      )}

      <div className="mainScreen">
        <Outlet /> 
      </div>
    </div>
  );
};

export default Layout;
