import axios from 'axios';
import { default as React, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import './Profile.css';
import { useWatchlist } from './WatchlistContext.tsx';

interface Friend {
    id: number;
    username: string;
}

interface FriendRequest {
    id: number;
    username: string;
}

const Profile: React.FC = () => {
    const [friendsList, setFriendsList] = useState<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [watchlistPrivacy, setWatchlistPrivacy] = useState<string>('Private');
    const [description, setDescription] = useState<string>(''); // Profile description
    const [editingDescription, setEditingDescription] = useState<boolean>(false);
    const Navigate = useNavigate();

    const { hasUnsavedChanges } = useWatchlist();

    // useAuth for global csrf token and username
    const { currentUser, csrfToken, isLoading } = useAuth();

    // New state variables for search filters
    const [friendSearchTerm, setFriendSearchTerm] = useState<string>('');
    const [friendRequestSearchTerm, setFriendRequestSearchTerm] = useState<string>('');

    useEffect(() => {
        fetchProfileData();
    }, []);

    useEffect(() => {
            if (!isLoading && !currentUser) {
              Navigate('/login'); // Redirect if no user or csrf token and done loading
            }
          }, [isLoading, currentUser, Navigate]);

    const fetchProfileData = async () => {
        try {
            console.log("🔍 Fetching profile data for", currentUser);
    
            // Fetch friends list
            const friendsResponse = await axios.get('http://localhost:5000/api/friends', {
                params: { username: currentUser },
            });
            setFriendsList(friendsResponse.data);
    
            // Fetch friend requests
            const friendRequestsResponse = await axios.get('http://localhost:5000/api/friendRequests', {
                params: { username: currentUser },
            });
            setFriendRequests(friendRequestsResponse.data);
    
            // Fetch watchlist privacy
            const privacyResponse = await axios.get('http://localhost:5000/api/watchlistPrivacy', {
                params: { username: currentUser },
            });
            console.log('Privacy Response:', privacyResponse.data);
            setWatchlistPrivacy(privacyResponse.data.privacy);
    
            // Fetch Profile Description
            const profileResponse = await axios.get('http://localhost:5000/api/userProfile', {
                params: { username: currentUser },
            });
            setDescription(profileResponse.data.BIO || "No description set yet.");
    
            console.log("✅ Profile data fetched successfully:", {
                friendsList: friendsResponse.data,
                friendRequests: friendRequestsResponse.data,
                privacy: privacyResponse.data.privacy,
                description: profileResponse.data.BIO || "No description set yet.",
            });
    
        } catch (error) {
            console.error('❌ Error fetching profile data:', error);
        }
    };
    
    const handlePrivacyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newPrivacy = e.target.value;
        setWatchlistPrivacy(newPrivacy);
    
        try {
            await axios.post('http://localhost:5000/api/updateWatchlistPrivacy', {
                username: currentUser,
                privacy: newPrivacy,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                withCredentials: true
            });
            alert('Privacy settings updated successfully!');
        } catch (error) {
            console.error('Error updating watchlist privacy:', error);
            alert('Failed to update privacy settings. Please try again.');
        }
    };
    
    const handleAcceptRequest = async (friendRequestId: number) => {
        try {
            await axios.post('http://localhost:5000/api/acceptFriendRequest', {
                requestId: friendRequestId,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                withCredentials: true
            });
            fetchProfileData(); // Refresh data
            alert("Successfully accepted friend request");
        } catch (error) {
            console.error('Error accepting friend request:', error);
            alert('Failed to accept friend request. Please try again.');
        }
    };
    
    const handleRejectRequest = async (friendRequestId: number) => {
        try {
            await axios.post('http://localhost:5000/api/rejectFriendRequest', {
                requestId: friendRequestId,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                withCredentials: true
            });
            fetchProfileData(); // Refresh data
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                alert(error.response.data.error);
            } else {
                console.error('Error rejecting friend request:', error);
            }
        }
    };

    const handleDeleteFriend = async (friend: Friend) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete ${friend.username} from your friends list?`);
    
        if (confirmDelete) {
            try {
                await axios.post('http://localhost:5000/api/deleteFriend', {
                    username: currentUser,
                    friendId: friend.id,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrfToken
                    },
                    withCredentials: true
                });
    
                setFriendsList((prevFriendsList) =>
                    prevFriendsList.filter((f) => f.id !== friend.id)
                );
    
                alert(`${friend.username} has been removed from your friends list.`);
            } catch (error) {
                console.error('Error deleting friend:', error);
                alert('Failed to delete friend. Please try again.');
            }
        }
    };

    const handleSaveDescription = async () => {
        try {
            console.log("📨 Sending update request:", {
                username: currentUser,
                description: description,
            });
    
            const response = await axios.post('http://localhost:5000/api/updateProfileDescription', {
                username: currentUser,
                description: description,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                withCredentials: true
            });
    
            if (response.status === 200) {
                console.log("✅ Profile description updated successfully!");
                setEditingDescription(false);
                setDescription(description);
                alert("Profile description updated successfully!");
            }
        } catch (error) {
            console.error('❌ Error updating profile description:', error);
            alert("Failed to update profile description. Please try again.");
        }
    };

    const handleViewProfile = (friend: Friend) => {
        Navigate(`/browse/${friend.username}`);
    };

    return (
            <div className="mainScreen">
                {hasUnsavedChanges && (
                    <div className="unsavedNotification">
                        You have unsaved changes!
                    </div>
                )}
                <div className="profileContainer">
                    <h2 className="profileHeader">Profile Settings</h2>

                    <div className="profileSection">
                        <label>Username:</label>
                        <span>{currentUser}</span>
                    </div>

                    <div className="profileSection">
                        <label>Watchlist Privacy:</label>
                        <select
                            className="privacyDropdown"
                            value={watchlistPrivacy}
                            onChange={handlePrivacyChange}
                        >
                            <option value="private">Private</option>
                            <option value="public">Public</option>
                            <option value="friendsonly">Friends only</option>
                        </select>
                    </div>

                    <div className="profileSection">
                        <label>Profile Description:</label>
                        {editingDescription ? (
                            <textarea
                                className="description-box"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        ) : (
                            <p>{description}</p>
                        )}
                        <button className="editButton" onClick={() => setEditingDescription(!editingDescription)}>
                            {editingDescription ? "Cancel" : "Edit"}
                        </button>
                        {editingDescription && (
                            <button className="saveBioButton" onClick={handleSaveDescription}>
                                Save
                            </button>
                        )}
                    </div>

                    <div className="profileSection">
                        <h3>Friends List:</h3>
                        {/* Search box for friends */}
                        <input
                            type="text"
                            placeholder="Search friends..."
                            value={friendSearchTerm}
                            onChange={(e) => setFriendSearchTerm(e.target.value)}
                            className="searchInput"
                        />
                        <ul className="friendsList">
                            {friendsList.filter(friend =>
                                friend.username.toLowerCase().includes(friendSearchTerm.toLowerCase())
                            ).length > 0 ? (
                                friendsList.filter(friend =>
                                    friend.username.toLowerCase().includes(friendSearchTerm.toLowerCase())
                                ).map((friend) => (
                                    <li key={friend.id} className="friendItem">
                                        {friend.username || 'No username available'}
                                        <div className='optionUserTools'>
                                            <button className='viewProfileInfoButton' onClick={() => handleViewProfile(friend)}>Info</button>
                                            <button className="removeButton" onClick={() => handleDeleteFriend(friend)}>Delete</button>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                <span>No friends found.</span>
                            )}
                        </ul>
                    </div>

                    <div className="profileSection">
                        <h3>Friend Requests:</h3>
                        {/* Search box for friend requests */}
                        <input
                            type="text"
                            placeholder="Search friend requests..."
                            value={friendRequestSearchTerm}
                            onChange={(e) => setFriendRequestSearchTerm(e.target.value)}
                            className="searchInput"
                        />
                        <ul className="friendRequestsList">
                            {friendRequests.filter(request =>
                                request.username.toLowerCase().includes(friendRequestSearchTerm.toLowerCase())
                            ).length > 0 ? (
                                friendRequests.filter(request =>
                                    request.username.toLowerCase().includes(friendRequestSearchTerm.toLowerCase())
                                ).map((request) => (
                                    <li key={request.id} className="friendRequestItem">
                                        <span>{request.username}</span>
                                        <div className='optionUserTools'>
                                            <button
                                                className="acceptButton"
                                                onClick={() => handleAcceptRequest(request.id)}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                className="rejectButton"
                                                onClick={() => handleRejectRequest(request.id)}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                <span>No friend requests found.</span>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
    );
};

export default Profile;
