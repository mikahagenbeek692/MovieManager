import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import './Browse.css';
import { useWatchlist } from './WatchlistContext.tsx';

interface User {
    id: number;
    username: string;
    email: string;
    watchList: Movie[];
    favoriteGenres: string;
    bio: string;
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
interface UserListProps {
    userList: User[];
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
    const [userList, setUserList] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [favoriteGenre, setFavoriteGenre] = useState<string>('All Genres');
    const [availableGenres, setAvailableGenres] = useState<string[]>([]);
    const Navigate = useNavigate();

    // useAuth for global csrf token and username
    const { currentUser, csrfToken, isLoading } = useAuth();


    const { hasUnsavedChanges } = useWatchlist();



    const fetchUsersWithWatchlists = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/users');
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

    const handleNavigate = (location: string) => {
        Navigate(location);
    };

    useEffect(() => {
            if (!isLoading && !currentUser) {
              Navigate('/login'); // Redirect if no user or csrf token and done loading
            }
          }, [isLoading, currentUser, Navigate]);


    return (
            
            <div className="mainScreen">
                {hasUnsavedChanges && (
                    <div className="unsavedNotification">
                        You have unsaved changes!
                    </div>
                )}
                <Filters favoriteGenre={favoriteGenre} setFavoriteGenre={setFavoriteGenre} availableGenres={availableGenres} />
                <UserSearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
                <UserList userList={filteredUsers} />
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

    function UserList({ userList }: UserListProps) {
        return (
            <div className="userListAndInfo">
                <ul className="userList">
                    {userList.length === 0 ? (
                        <li className="noUsersFound">No users found matching your criteria.</li>
                    ) : (
                        userList.map((user) => (
                            <li key={user.id} className={`optionUser`}>
                                <div className="userDetails">
                                    <span className="username">{user.username}</span>
                                    
    
                                    {/* Only display genres if available */}
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
                                
                                <div className='optionUserToolsBrowse'>
                                    <button className='viewProfileButton' onClick={() => handleNavigate(`/browse/${user.username}`)}>Info</button>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>
        );
    }
    
    
    
};

export default Browse;
