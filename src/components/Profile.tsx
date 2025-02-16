import axios from 'axios';
import { default as React, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Profile.css';

interface Friend {
    id: number;
    username: string;
}

interface FriendRequest {
    id: number;
    username: string;
}

const Profile: React.FC = () => {
    const location = useLocation();
    const [currentUser, setCurrentUser] = useState<string>(location.state?.message || '');
    const [friendsList, setFriendsList] = useState<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [watchlistPrivacy, setWatchlistPrivacy] = useState<string>('Private');
    const [description, setDescription] = useState<string>(''); // New state for description
    const [editingDescription, setEditingDescription] = useState<boolean>(false); // Toggle edit mode
    const Navigate = useNavigate();

    useEffect(() => {
        fetchProfileData();
    }, []);

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
    
            console.log('Privacy Response:', privacyResponse.data); // Log the response
            setWatchlistPrivacy(privacyResponse.data.privacy);
    
            // Fetch Profile Description
            const profileResponse = await axios.get('http://localhost:5000/api/userProfile', {
                params: { username: currentUser },
            });
    
            // Ensure we are using the correct field (BIO) from the database
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
    

    const handleLogout = async () => {
        const confirmLogout = window.confirm(
            'Make sure to save your changes before logging out! Click OK to proceed or Cancel to stay.'
        );
        if (confirmLogout) {
            await axios.post('http://localhost:5000/logout');
            Navigate('/login');
        }
    };

    const handleNavigate = async (location: string) => {
        Navigate(location, { state: { message: currentUser } });
    };

    const handlePrivacyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newPrivacy = e.target.value;
        setWatchlistPrivacy(newPrivacy);
    
        try {
            await axios.post('http://localhost:5000/api/updateWatchlistPrivacy', {
                username: currentUser,
                privacy: newPrivacy,
            });
            alert('Privacy settings updated successfully!'); // Replace with a toast notification
        } catch (error) {
            console.error('Error updating watchlist privacy:', error);
            alert('Failed to update privacy settings. Please try again. ' + error); // Replace with a toast notification
        }
    };
    
    const handleAcceptRequest = async (friendRequestId: number) => {
        try {
            const response = await axios.post('http://localhost:5000/api/acceptFriendRequest', {
                requestId: friendRequestId,
            });
            fetchProfileData(); // Re-fetch or update the list directly if possible
            alert("Succesfully accepted friend request")
        } catch (error) {
            console.error('Error accepting friend request:', error);
            alert('Failed to accept friend request. Please try again.');
        }
    };
    

    const handleRejectRequest = async (friendRequestId: number) => {
        try {
            await axios.post('http://localhost:5000/api/rejectFriendRequest', {
                requestId: friendRequestId,
            });
            fetchProfileData(); // Refresh data
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                alert(error.response.data.error); // Show the error message from the server
            } else console.error('Error rejecting friend request:', error);
        }
    };

    const handleDeleteFriend = async (friend: Friend) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete ${friend.username} from your friends list?`);
    
        if (confirmDelete) {
            try {
                // Send a request to delete the friend from the database
                await axios.post('http://localhost:5000/api/deleteFriend', {
                    username: currentUser,
                    friendId: friend.id,
                });
    
                // Remove the friend from the state to reflect the deletion instantly
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
                description: description, // Ensure this is updated
            });
    
            const response = await axios.post('http://localhost:5000/api/updateProfileDescription', {
                username: currentUser,
                description: description,
            });
    
            if (response.status === 200) {
                console.log("✅ Profile description updated successfully!");
    
                // ✅ **Instantly update state to reflect new description**
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
        Navigate(`/browse/${friend.username}`, { state: { message: currentUser } });
    };
    
    
    
    

    return (
        <div className="App">
            <header className="App-header">
                <h1 className="titleHome">Profile Management</h1>
                <button className="logoutButton" onClick={() => handleNavigate('/Home')}>
                    Add movies
                </button>
                <button className="logoutButton" onClick={() => handleNavigate('/Browse')}>
                    Browse other accounts
                </button>
                <button className="logoutButton" onClick={() => handleNavigate('/EditWatchList')}>
                    Edit watchlist
                </button>
                <button className="logoutButton" onClick={() => handleNavigate('/Profile')}>
                    Edit Profile
                </button>
                <button className="logoutButton" onClick={handleLogout}>
                    Logout
                </button>
            </header>

            <div className="mainScreen">
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
                        <ul className="friendsList">
                            {friendsList.length > 0 ? (
                                friendsList.map((friend) => (
                                    <li key={friend.id} className="friendItem">
                                        {friend.username || 'No username available'}
                                        <div className='optionUserTools'>
                                            <button className='viewProfileInfoButton' onClick={(e) => handleViewProfile(friend)}>Info</button>
                                            <button className="removeButton" onClick={(e) => handleDeleteFriend(friend)}>Delete</button>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                <span>No friends yet.</span>
                            )}
                        </ul>
                    </div>

                    <div className="profileSection">
                        <h3>Friend Requests:</h3>
                        <ul className="friendRequestsList">
                            {friendRequests.length > 0 ? (
                                friendRequests.map((request) => (
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
                                <span>No pending friend requests.</span>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
