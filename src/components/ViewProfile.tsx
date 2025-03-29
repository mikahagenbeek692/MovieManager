import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import './ViewProfile.css';
import { useWatchlist } from './WatchlistContext.tsx';

interface UserProfile {
    username: string | undefined;
    favoriteGenres: string;
    friendsList: Friend[];
    description: string;
    privacy: 'public' | 'friendsonly' | 'private';
}

interface Friend {
    id: number;
    username: string;
}

interface Movie {
    id: number;
    title: string;
    releaseYear: number;
    genre: string;
    director: string;
    cast: string;
    duration: number; // in minutes
    rating: number; 
    description: string;
    watched: boolean;
    favorite: boolean;
}

const ViewProfile = () => {
    const { username } = useParams(); // Get the username from the URL
    const [privacy, setPrivacy] = useState<'public' | 'friendsonly' | 'private' | null>(null);
    const [canViewProfile, setCanViewProfile] = useState<boolean>(false);
    const Navigate = useNavigate();
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [watchList, setWatchList] = useState<Movie[]>([]);
    const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'alreadyFriends'>('none');

    const { hasUnsavedChanges } = useWatchlist();

    // useAuth for global csrf token and username
    const { currentUser, csrfToken, isLoading } = useAuth();

    // New state variables for filtering
    const [friendSearchTerm, setFriendSearchTerm] = useState<string>('');
    const [watchlistSearchTerm, setWatchlistSearchTerm] = useState<string>('');

    useEffect(() => {
        if (!username || username === currentUser) return;
        
        axios.get('/api/friendStatus', {
          params: {
            senderUsername: currentUser,
            receiverUsername: username
          }
        })
        .then(res => {
          setFriendStatus(res.data.status);
        })
        .catch(err => {
          console.error('Error fetching friend status:', err);
          // Optionally set a fallback or error status
        });
      }, [username, currentUser]);

    useEffect(() => {
            if (!isLoading && !currentUser) {
              Navigate('/login'); // Redirect if no user or csrf token and done loading
            }
          }, [isLoading, currentUser, Navigate]);

    useEffect(() => {
        if (!username) {
            Navigate('/browse');
            return;
        }
       const checkProfilePrivacy = async () => {
            try {
                const privacyResponse = await axios.get('http://localhost:5000/api/watchlistPrivacy', {
                    params: { username },
                });
                const profilePrivacy = privacyResponse.data.privacy;
                setPrivacy(profilePrivacy);

                if (profilePrivacy === 'public' || username === currentUser) {
                    setCanViewProfile(true);
                } else if (profilePrivacy === 'friendsonly') {
                    const friendsResponse = await axios.get('http://localhost:5000/api/friends', {
                        params: { username: currentUser },
                    });
                    const isFriend = friendsResponse.data.some((friend: Friend) => friend.username === username);
                    setCanViewProfile(isFriend);
                } else {
                    setCanViewProfile(false);
                }
            } catch (error) {
                console.error("Error checking profile privacy:", error);
                setCanViewProfile(false);
            }
        };

        checkProfilePrivacy();
    }, [username, currentUser, Navigate]);

    useEffect(() => {
        if (!canViewProfile) {
          setLoading(false);
          return;
        }
      
        const fetchUserProfile = async () => {
          try {
            console.log(`🔍 Fetching profile for ${username}`);
      
            // Fetch Watchlist Count
            const watchlistResponse = await axios.get('http://localhost:5000/api/getWatchList', {
              params: { username },
            });
      
            // Fetch Favorite Genres
            const genresResponse = await axios.get('http://localhost:5000/api/users');
            const genresSet = new Set<string>();
            genresResponse.data.forEach((user: UserProfile) => {
              if (user.favoriteGenres) {
                user.favoriteGenres.split(",").forEach(genre => genresSet.add(genre.trim()));
              }
            });
      
            // Fetch Friends List
            const friendsResponse = await axios.get('http://localhost:5000/api/friends', {
              params: { username },
            });
      
            // Fetch User Profile Description
            const profileResponse = await axios.get('http://localhost:5000/api/userProfile', {
              params: { username },
            });
      
            // Fetch Friend Status (assume currentUser is the sender and username is the receiver)
            const friendStatusResponse = await axios.get('http://localhost:5000/api/friendStatus', {
              params: { senderUsername: currentUser, receiverUsername: username },
            });
      
            // Update state with fetched data
            setUserData({
              username,
              favoriteGenres: Array.from(genresSet).join(', '),
              friendsList: friendsResponse.data,
              description: profileResponse.data.BIO || "No description available.",
              privacy: privacy || 'public',
            });
      
            const watchListMovies: Movie[] = watchlistResponse.data.map((movie: any) => ({
              id: movie.id,
              title: movie.title,
              releaseYear: movie.release_year,
              genre: movie.genre,
              director: movie.director,
              cast: movie.cast,
              duration: movie.duration,
              rating: movie.rating,
              description: movie.description,
              watched: !!movie.watched,
              favorite: !!movie.favorite,
            }));
            setWatchList(watchListMovies);
      
            setFriendStatus(friendStatusResponse.data.status); 
          } catch (error) {
            console.error('❌ Error fetching user profile:', error);
          } finally {
            setLoading(false);
          }
        };
      
        fetchUserProfile();
      }, [username, canViewProfile]);
      

    const handleViewProfile = (friend: Friend) => {
        Navigate(`/browse/${friend.username}`);
    };

    const handleAddFriend = async () => {
        try {
          const confirmAdd = window.confirm(
            `Are you sure you want to send a friend request to ${username}?`
          );
          if (confirmAdd) {
            const response = await axios.post(
              'http://localhost:5000/api/sendFriendRequest',
              {
                senderUsername: currentUser,
                receiverUsername: username,
              },
              {
                headers: { 'X-CSRF-Token': csrfToken },
                withCredentials: true,
              }
            );
      
            // Check the response message from the backend
            if (
              response.data.message &&
              response.data.message.toLowerCase().includes('now friends')
            ) {
              alert(`You are now friends with ${username}!`);
              setFriendStatus('alreadyFriends');
            } else {
              alert(`Friend request sent to ${username}!`);
              setFriendStatus('pending');
            }
          }
        } catch (error: any) {
          if (axios.isAxiosError(error) && error.response) {
            alert(error.response.data.error);
          } else {
            console.error('Error sending friend request:', error);
            alert('Failed to send friend request. Please try again.');
          }
        }
      };
      

    const handleCancelFriendRequest = async () => {
        const confirmCancel = window.confirm(
          `You already sent a friend request to ${username}. Do you want to cancel it?`
        );
        if (!confirmCancel) return;
      
        try {
          await axios.post(
            'http://localhost:5000/api/cancelFriendRequest',
            { senderUsername: currentUser, receiverUsername: username },
            {
              headers: { 'X-CSRF-Token': csrfToken },
              withCredentials: true,
            }
          );
          alert("Friend request cancelled successfully.");
          setFriendStatus('none');

        } catch (error) {
          console.error("Error cancelling friend request:", error);
          alert("Failed to cancel friend request. Please try again.");
        }
      };
      

    return (
            <div className="mainScreen">
                {hasUnsavedChanges && (
                    <div className="unsavedNotification">
                        You have unsaved changes!
                    </div>
                )}
                <div className="profile-container">
                    <button className="back-button" onClick={() => Navigate(-1)}>
                        ← Back
                    </button>

                    {loading ? (
                        <p>Loading profile...</p>
                    ) : canViewProfile ? (
                        userData ? (
                            <div className="profile-content">
                                <h1>{username}'s Profile</h1>
                                <div className="addFriendButtonContainer">
                                    {friendStatus === 'none' && (
                                    <button className="addFriendButton" onClick={handleAddFriend}></button>
                                    )}

                                    {friendStatus === 'pending' && (
                                        <button className="sentFriendRequestButton" onClick={handleCancelFriendRequest}></button>
                                    )}

                                    {friendStatus === 'alreadyFriends' && (
                                        <button className="alreadyFriendsButton" disabled></button>
                                    )}
                                </div>
                                <p><strong>About Me:</strong> {userData.description}</p>
                                <p><strong>Favorite Genres:</strong> {userData.favoriteGenres || 'None'}</p>

                                <h2>WatchList</h2>
                                
                                <input
                                    type="text"
                                    placeholder="Search watchlist..."
                                    value={watchlistSearchTerm}
                                    onChange={(e) => setWatchlistSearchTerm(e.target.value)}
                                    className="searchInput"
                                />
                                <ul className='friendsList'>
                                    {watchList.filter(movie =>
                                        movie.title.toLowerCase().includes(watchlistSearchTerm.toLowerCase())
                                    ).map((movie) => (
                                        <li key={movie.id} className={`optionUser${movie.watched ? ' selected' : ''}${movie.favorite ? ' favorite' : ''}`}>
                                            {movie.title} ({movie.releaseYear})
                                            <div className='optionUserTools'>
                                                {movie.favorite && <span className="favoriteStar">⭐</span>}
                                                <input type="checkbox" checked={movie.watched} readOnly />
                                            </div>
                                        </li>
                                    ))}
                                </ul>

                                <h2>Friends List:</h2>
                               
                                <input
                                    type="text"
                                    placeholder="Search friends..."
                                    value={friendSearchTerm}
                                    onChange={(e) => setFriendSearchTerm(e.target.value)}
                                    className="searchInput"
                                />
                                <ul className="friendsList">
                                    {userData.friendsList.filter(friend =>
                                        friend.username.toLowerCase().includes(friendSearchTerm.toLowerCase())
                                    ).length > 0 ? (
                                        userData.friendsList.filter(friend =>
                                            friend.username.toLowerCase().includes(friendSearchTerm.toLowerCase())
                                        ).map((friend) => (
                                            <li key={friend.id} className="friendItem">
                                                {friend.username || 'No username available'}
                                                <div className='optionUserTools'>
                                                    <button className='viewProfileInfoButton' onClick={() => handleViewProfile(friend)}>Info</button>
                                                </div>
                                            </li>
                                        ))
                                    ) : (
                                        <span>No friends found.</span>
                                    )}
                                </ul>

                            </div>
                        ) : (
                            <p>User profile not found.</p>
                        )
                    ) : (
                        <p>{privacy === 'private' ? 'This profile is private.' : 'This profile is only visible to friends.'}</p>
                    )}
                </div>
            </div>
    );
};

export default ViewProfile;
