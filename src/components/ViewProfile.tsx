import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import './ViewProfile.css'; // Import the CSS file

interface UserProfile {
    username: string;
    favoriteGenres: string;
    friendsList: Friend[];
    description: string;
}

interface Friend {
    id: number;
    username: string;
}

const ViewProfile = () => {
    const location = useLocation();
    const [currentUser, setCurrentUser] = useState<string>(location.state?.message || '');
    const { username } = useParams(); // Get the username from the URL
    const [friendsList, setFriendsList] = useState<Friend[]>([]);
    const [favoriteGenres, setFavoriteGenres] = useState<string>('All Genres');
    const Navigate = useNavigate();
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!username) {
            Navigate('/browse');
            return;
        }

        const fetchUserProfile = async () => {
            try {
                console.log(`🔍 Fetching profile for ${username}`);
        
                // Fetch Watchlist Count
                const watchlistResponse = await axios.get('http://localhost:5000/api/getWatchList', {
                    params: { username },
                });
                const watchlistCount = watchlistResponse.data.length || 0;
        
                // Fetch Favorite Genres
                const genresResponse = await axios.get('http://localhost:5000/api/usersWithWatchlists');
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
        
                // 🆕 Fetch User Profile Description
                const profileResponse = await axios.get('http://localhost:5000/api/userProfile', {
                    params: { username },
                });
        
                setUserData({
                    username,
                    favoriteGenres,
                    friendsList: friendsResponse.data,
                    description: profileResponse.data.BIO || "No description available.", // Default if null
                });
        
                console.log("✅ User profile loaded:", { username, watchlistCount, favoriteGenres, friendsResponse, profileResponse });
        
            } catch (error) {
                console.error('❌ Error fetching user profile:', error.response ? error.response.data : error.message);
            } finally {
                setLoading(false);
            }
        };
        
        

        fetchUserProfile();
    }, [username, Navigate]);

    const handleNavigate = (location: string) => {
        Navigate(location, { state: { message: currentUser } });
    };

    const handleLogout = async () => {
        const confirmLogout = window.confirm("Make sure to save your watchlist before logging out! Click OK to proceed or Cancel to stay.");
        if (confirmLogout) {
            await axios.post('http://localhost:5000/logout');
            Navigate('/login');
        }
    };

    const handleAddFriend = async (friend: UserProfile) => {
        try {
            const confirmAdd = window.confirm(`Are you sure you want to send a friend request to ${friend.username}?`);
            if (confirmAdd) {
                await axios.post('http://localhost:5000/api/sendFriendRequest', {
                    senderUsername: currentUser,
                    receiverUsername: friend.username,
                });
                alert(`Friend request sent to ${friend.username}!`);
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
    const handleViewProfile = (friend: Friend) => {
        Navigate(`/browse/${friend.username}`, { state: { message: currentUser } });
    };

    return (
        <div className="App">
        <header className="App-header">
            <h1 className="titleHome">Browse other accounts</h1>
            <button className="logoutButton" onClick={() => handleNavigate("/Home")}>Add movies</button>
            <button className="logoutButton" onClick={() => handleNavigate("/Browse")}>Browse other accounts</button>
            <button className="logoutButton" onClick={() => handleNavigate("/EditWatchList")}>Edit watchlist</button>
            <button className="logoutButton" onClick={() => handleNavigate("/Profile")}>Edit Profile</button>
            <button className="logoutButton" onClick={handleLogout}>Logout</button>
        </header>
        
        <div className="mainScreen">
            <div className="profile-container">
                <button className="back-button" onClick={() => handleNavigate('/browse')}>
                    ← Back to Browse
                </button>

                {loading ? (
                    <p>Loading profile...</p>
                ) : userData ? (
                    <div className="profile-content">

                            <div className='addFriendContainer'>
                            <button
                                            className="addFriendButton"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddFriend(userData);
                                            }}
                                        />
                            </div>
                        <h1>{username}'s Profile</h1>

                        <div className="user-description">
                            <p><strong>About Me:</strong> {userData.description || "No description available."}</p>
                        </div>


                        <p><strong>Favorite Genres:</strong> {userData.favoriteGenres ? userData.favoriteGenres.split(', ').join(', ') : 'None'}</p>


                        {/* Friends List */}
                        <h2>Friends List:</h2>
                            <ul className="friendsList">
                                {userData.friendsList.length > 0 ? (
                                    userData.friendsList.map((friend) => (
                                        <li key={friend.id} className="friendItem">
                                            {friend.username || 'No username available'}
                                            <div className='optionUserTools'>
                                            <button className='viewProfileInfoButton' onClick={(e) => handleViewProfile(friend)}>Info</button>
                                        </div>
                                        </li>
                                    ))
                                ) : (
                                    <span>No friends yet.</span>
                                )}
                            </ul>
                    </div>
                ) : (
                    <p>User profile not found.</p>
                )}
            </div>
        </div>
    </div>
        
    );
};

export default ViewProfile;
