import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Browse.css';

interface User {
    id: number;
    username: string;
    email: string;
    watchList: Movie[];
    favoriteGenres: string;
}

interface Movie {
    id: number;
    title: string;
    releaseYear: number;
    genre: string;
    director: string;
    cast: string;
    duration: number;
    rating: number;
    description: string;
    watched: boolean;
    favorite: boolean;
}

interface UserInfoProps {
    selectedUser: User | null;
}

interface UserListProps {
    userList: User[];
    selectedUser: User | null;
    setSelectedUser: React.Dispatch<React.SetStateAction<User | null>>;
}

interface UserSearchBarProps {
    searchTerm: string;
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
}

interface FilterProps {
    favoriteGenre: string;
    setFavoriteGenre: React.Dispatch<React.SetStateAction<string>>;
    availableGenres: string[];
}

const Browse: React.FC = () => {
    const location = useLocation();
    const [currentUser, setCurrentUser] = useState<string>(location.state?.message || '');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userList, setUserList] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [favoriteGenre, setFavoriteGenre] = useState<string>('All Genres');
    const [availableGenres, setAvailableGenres] = useState<string[]>([]);
    const Navigate = useNavigate();

    const fetchUsersWithWatchlists = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/usersWithWatchlists');
            setUserList(response.data);
            setFilteredUsers(response.data);

            // Extract unique favorite genres
            const genresSet = new Set<string>();
            response.data.forEach((user: User) => {
                if (user.favoriteGenres) {
                    user.favoriteGenres.split(",").forEach(genre => genresSet.add(genre.trim()));
                }
            });

            setAvailableGenres(['All Genres', ...Array.from(genresSet).sort()]);
        } catch (error) {
            console.error('Error fetching users with watchlists:', error);
        }
    };

    useEffect(() => {
        fetchUsersWithWatchlists();
    }, []);

    // 🔍 Apply search and filter dynamically
    useEffect(() => {
        setFilteredUsers(
            userList.filter(user => 
                user.username.toLowerCase().includes(searchTerm.toLowerCase()) &&
                (favoriteGenre === "All Genres" || user.favoriteGenres?.includes(favoriteGenre))
            )
        );
    }, [searchTerm, favoriteGenre, userList]); 

    const handleLogout = async () => {
        const confirmLogout = window.confirm("Make sure to save your watchlist before logging out! Click OK to proceed or Cancel to stay.");
        if (confirmLogout) {
            await axios.post('http://localhost:5000/logout');
            Navigate('/login');
        }
    };

    const handleNavigate = (location: string) => {
        Navigate(location, { state: { message: currentUser } });
    };

    const handleAddFriend = async (friend: User) => {
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
                <Filters favoriteGenre={favoriteGenre} setFavoriteGenre={setFavoriteGenre} availableGenres={availableGenres} />
                <UserSearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
                <UserList userList={filteredUsers} selectedUser={selectedUser} setSelectedUser={setSelectedUser} />
            </div>
        </div>
    );

    function Filters({ favoriteGenre, setFavoriteGenre, availableGenres }: FilterProps) {
        return (
            <div className="filterContainer">
                <select
                    className="filterDropdown"
                    value={favoriteGenre}
                    onChange={(e) => setFavoriteGenre(e.target.value)}
                >
                    {availableGenres.map((genre, index) => (
                        <option key={index} value={genre}>
                            {genre}
                        </option>
                    ))}
                </select>
            </div>
        );
    }

    function UserSearchBar({ searchTerm, setSearchTerm }: UserSearchBarProps) {
        return (
            <div className="searchContainer">
                <input
                    type="text"
                    className="searchInput"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus 
                />
            </div>
        );
    }

    function UserInfo({ selectedUser }: UserInfoProps) {
        if (!selectedUser) {
            return (
                <div className="userInfoContainer">
                    <h2>User WatchList</h2>
                    <h3>Please select a user to view their watchlist.</h3>
                </div>
            );
        }

        if (!selectedUser.watchList || selectedUser.watchList.length === 0) {
            return (
                <div className="userInfoContainer">
                    <h2>User WatchList</h2>
                    <h3>This user has no saved movies.</h3>
                </div>
            );
        }

        return (
            <div className="userInfoContainer">
                <h2>{selectedUser.username}'s WatchList</h2>
                <ul>
                    {selectedUser.watchList.map((movie) => (
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
        );
    }

    function UserList({ userList, selectedUser, setSelectedUser }: UserListProps) {
        return (
            <div className="userListAndInfo">
                <ul className="userList">
                    {userList.length === 0 ? (
                        <li className="noUsersFound">No users found matching your criteria.</li>
                    ) : (
                        userList.map((user) => (
                            <li key={user.id} className={`optionUser${selectedUser?.id === user.id ? ' selected' : ''}`} onClick={() => setSelectedUser(user)}>
                                <div className="userDetails">
                                    <div className='userNameViewProfileContainer'>
                                        <span className="username">{user.username}</span>
                                        <button className='viewProfileButton' onClick={() => handleNavigate(`/browse/${user.username}`)}>Info</button>
                                    </div>

    
                                    {/* ✅ Only display genres if available */}
                                    {user.favoriteGenres && user.favoriteGenres.trim() !== "" ? (
                                        <div className="genreLabels">
                                            {user.favoriteGenres.split(",").map((genre, index) => (
                                                <span key={index} className="genreLabel">
                                                    {genre.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span></span>
                                    )}
                                </div>
    
                                <div className="optionUserToolsBrowseUserList">
                                    <button
                                        className="addFriendButton"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddFriend(user);
                                        }}
                                    />
                                </div>
                            </li>
                        ))
                    )}
                </ul>
                <UserInfo selectedUser={selectedUser} />
            </div>
        );
    }
    
    
    
};

export default Browse;
