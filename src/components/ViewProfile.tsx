import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import './ViewProfile.css'; // Import the CSS file

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
    rating: number; // e.g., 8.5
    description: string;
    watched: boolean;
    favorite: boolean;
}

const ViewProfile = () => {
    const location = useLocation();
    const [currentUser] = useState<string>(location.state?.message || '');
    const { username } = useParams(); // Get the username from the URL
    const [friendsList, setFriendsList] = useState<Friend[]>([]);
    const [privacy, setPrivacy] = useState<'public' | 'friendsonly' | 'private' | null>(null);
    const [canViewProfile, setCanViewProfile] = useState<boolean>(false);
    const Navigate = useNavigate();
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [watchList, setWatchList] = useState<Movie[]>([]);

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
                }
                else {
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

            } catch (error) {
                console.error('❌ Error fetching user profile:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [username, canViewProfile]);

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
                    ) : canViewProfile ? (
                        userData ? (
                            <div className="profile-content">
                                <h1>{username}'s Profile</h1>
                                <p><strong>About Me:</strong> {userData.description}</p>
                                <p><strong>Favorite Genres:</strong> {userData.favoriteGenres || 'None'}</p>

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

                                <h2>WatchList</h2>
                                <ul className='friendsList'>
                                {watchList.map((movie) => (
                                    <li key={movie.id} className={`optionUser${movie.watched ? ' selected' : ''}${movie.favorite ? ' favorite' : ''}`}>
                                        {movie.title} ({movie.releaseYear}) 
                                        <div className='optionUserTools'>
                                            {movie.favorite && <span className="favoriteStar">⭐</span>}
                                            <input type="checkbox" checked={movie.watched} readOnly />
                                        </div>
                                    </li>
                                ))}
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
        </div>
    );
};

export default ViewProfile;
