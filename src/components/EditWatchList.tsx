import axios from 'axios'; // Import axios for API calls
import { default as React, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './EditWatchList.css';


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

interface MovieListProps {
    watchList: Movie[];
    setWatchList: React.Dispatch<React.SetStateAction<Movie[]>>;
    username: string;
}

interface MovieInfoProps {
    selectedMovieInfo: Movie | null;
}

const EditWatchList: React.FC = () => {

    const location = useLocation();
    const [currentUser, setCurrentUser] = useState<string>(location.state?.message || '');
    const [watchList, setWatchList] = useState<Movie[]>([]);
    const Navigate = useNavigate();

    const [years, setYears] = useState<number[]>([])
    const [genres, setGenres] = useState<string[]>([]);

    const fetchMovies = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/movies');
            const movies: Movie[] = response.data.map((movie: any) => ({
                id: movie.id,
                title: movie.title,
                releaseYear: movie.release_year,
                genre: movie.genre,
                director: movie.director,
                cast: movie.cast,
                duration: movie.duration,
                rating: movie.rating,
                description: movie.description,
                watched: !!movie.watched
            })).sort((a, b) => a.releaseYear - b.releaseYear); // Sorting by release year in ascending order
            
            const fetchedYears: number[] = [
                ...new Set(movies.map((movie) => movie.releaseYear)),
            ].sort((a, b) => a - b); // Sort years in ascending order

            const fetchedGenres: string[] = [
                ...new Set(
                    movies
                        .flatMap((movie) => movie.genre.split(',').map((g) => g.trim())) // Split and trim spaces
                ),
            ].sort(); // Sort genres alphabetically

            setYears(fetchedYears);
            setGenres(fetchedGenres);
        } catch (error) {
            console.error("Error fetching movies:", error);
        }
    };

    const fetchWatchList = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/getWatchList', {
                params: { username: currentUser }
            });
            const watchListMovies: Movie[] = response.data.map((movie: any) => ({
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
                favorite: !!movie.favorite  // Include favorite status
            }));
            setWatchList(watchListMovies);

        } catch (error) {
            console.error("Error fetching watchlist:", error);
        }
    };
    

    useEffect(() => {
        fetchMovies();
        fetchWatchList();
        const checkAuth = async () => {
            try {
                await axios.get('http://localhost:5000/home'); // Protected route
            } catch (err) {
                Navigate('/login'); // Redirect to login if not authenticated
            }
        };

        checkAuth();
    }, [Navigate]);

    const saveWatchListNavigate = async () => {
        try {
            const movieTitles = watchList.map(movie => ({
                id: movie.id,
                title: movie.title,
                watched: movie.watched === true,
                favorite: movie.favorite
            }));

            console.log("Saving watchlist:", { currentUser, movieTitles });

            const response = await axios.post('http://localhost:5000/saveWatchList', {
                username: currentUser,
                movieTitles: movieTitles,
            });
    
            console.log("success")
 
        } catch (error) {
            console.error('Error saving watchlist:', error.response ? error.response.data : error.message);

        };
    }
    

    const handleLogout = async () => {
        const confirmLogout = window.confirm("Make sure to save your watchlist before logging out! Click OK to proceed or Cancel to stay.");
        if (confirmLogout) {
            await axios.post('http://localhost:5000/logout');
            Navigate('/login');
        }
    };


    const handleNavigate = async (location) => {
        await saveWatchListNavigate();
        Navigate(location, { state: { message: currentUser } });
    };
    return (
        <div className="App">
        <header className="App-header">
            <h1 className='titleHome'>Edit watchlist</h1>
            <button className="logoutButton" onClick={(e) => handleNavigate("/Home")}>Add movies</button>
            <button className="logoutButton" onClick={(e) => handleNavigate("/Browse")}>Browse other accounts</button>
            <button className="logoutButton" onClick={(e) => handleNavigate("/EditWatchList")}>Edit watchlist</button>
            <button className="logoutButton" onClick={(e) => handleNavigate("/Profile")}>Edit Profile</button>
            <button className="logoutButton" onClick={handleLogout}>Logout</button>
        </header>
        <div className='mainScreen'>
            <MovieList username={currentUser} watchList={watchList} setWatchList={setWatchList}></MovieList>
        </div>
    </div>
    );  

    function MovieList({ username, watchList, setWatchList}: MovieListProps) {

        const [responseNotification, setResponseNotification] = useState<string>("unknown error");
        const [responseNotificationVisible, toggleResponseNotificationVisible] = useState<boolean>(false);
        const [selectedMovieInfo, setSelectedMovieInfo] = useState<Movie | null>(null);
        const [isFading, setIsFading] = useState<boolean>(false); 
        const [filteredWatchList, setFilteredWatchList] = useState<Movie[]>(watchList);
        
        // Filters
        const [selectedGenre, setSelectedGenre] = useState<string>("All Genres");
        const [selectedYear, setSelectedYear] = useState<string>("All Years");
        const [watchedFilter, setWatchedFilter] = useState<string>("All Movies");
        const [favoriteFilter, setFavoriteFilter,] = useState<boolean>(false);
        const [inputText, setInputText] = useState("");
    
        const saveWatchList = async () => {
            try {
                const movieTitles = watchList.map(movie => ({
                    id: movie.id,
                    title: movie.title,
                    watched: movie.watched === true,
                    favorite: movie.favorite
                }));
    
                console.log("Saving watchlist:", { username, movieTitles });
    
                const response = await axios.post('http://localhost:5000/saveWatchList', {
                    username: username,
                    movieTitles: movieTitles
                });
        
                setResponseNotification("Your watchlist was successfully saved!");
                console.log("success")
                toggleResponseNotificationVisible(true);
                setIsFading(false); // Ensure no fade-out effect initially
    
    
        
                // After 5 seconds, trigger fade-out by changing state
                setTimeout(() => {
                    setIsFading(true); // Trigger fade-out after 5 seconds
                    setTimeout(() => {
                        toggleResponseNotificationVisible(false);  // Hide the notification completely after fade-out
                    }, 1000);  // Wait for fade-out to complete (1 second)
                }, 5000);  // Wait for 5 seconds before fading out
    
    
                
        
            } catch (error) {
                console.error('Error saving watchlist:', error.response ? error.response.data : error.message);
    
                setResponseNotification("Your watchlist was NOT successfully saved due to an unknown error");
    
                toggleResponseNotificationVisible(true);
                setIsFading(false); // Ensure no fade-out effect initially
        
                // After 5 seconds, trigger fade-out by changing state
                setTimeout(() => {
                    setIsFading(true); // Trigger fade-out after 5 seconds
                    setTimeout(() => {
                        toggleResponseNotificationVisible(false);  // Hide the notification completely after fade-out
                    }, 1000);  // Wait for fade-out to complete (1 second)
                }, 5000);  // Wait for 5 seconds before fading out
            }
        };
        
        
        useEffect(() => {
            // Filter movies based on the genre, year, and title input
            
            setFilteredWatchList(
                watchList.filter((movie) => {
                    if(favoriteFilter){
                        return movie.favorite;
                    }
                    const matchesTitle = movie.title.toLowerCase().includes(inputText.toLowerCase()) ||     // Filter through title and cast
                                         movie.cast.toLowerCase().includes(inputText.toLowerCase()) 
                    const matchesGenre = selectedGenre === "All Genres" || movie.genre.toLowerCase().includes(selectedGenre.toLowerCase());
                    const matchesYear = selectedYear === "All Years" || movie.releaseYear.toString().includes(selectedYear);
                    const matchesWatched = watchedFilter === "All Movies"  || movie.watched.toString() === watchedFilter;
        
                    // Return true if all conditions are met
                    return matchesTitle && matchesGenre && matchesYear && matchesWatched;
                })
            )     
    
        }, [inputText, selectedGenre, selectedYear, watchedFilter, favoriteFilter]);
    
        const handleDeleteMovie = (movie: Movie) => {
            removeMovie(movie.id);
            if (selectedMovieInfo === movie)
                setSelectedMovieInfo(null);
        };
    
        const removeMovie = (movieId: number) => {
            setWatchList((prevMovies) => prevMovies.filter((movie) => movie.id !== movieId));
        };
    
        const handleGenreChange = (genre) => {
            setSelectedGenre(genre);
        }
    
        const handleYearChange = (year) => {
            setSelectedYear(year);
        }
    
        const handleWatchedFilter = (watched) => {
            setWatchedFilter(watched);
        }
    
        const handleWatchedMovie = (movie) => {
            setWatchList((prevWatchList) =>
                prevWatchList.map((m) =>
                    m.id === movie.id ? { ...m, watched: !m.watched } : m
                )
            );
        };
        const handleFavoriteMovie = (movie: Movie) => {
            setWatchList((prevWatchList) =>
                prevWatchList.map((m) =>
                    m.id === movie.id
                        ? { ...m, favorite: !m.favorite } 
                        : { ...m, favorite: false }       
                )
            );
        };
        
        

        const handleFavoriteFilter = () => {
            setFavoriteFilter(!favoriteFilter);
        }
    
    
        return (
            <div className='userListAndInfoAndNotification'>
                <div className='userListAndInfo'>
                    <div className='watchListTools'>
                        <button className='saveButtonBrowse' onClick={() => saveWatchList()} >
                            Save watchlist
                        </button>
                        <input
                            className="input"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Search through watchlist..."
                        />
                        <select name="genre" id="genre" value={selectedGenre} onChange={(e) => handleGenreChange(e.target.value)}>
                            <option value="All Genres">
                                All Genres
                            </option>
                            {genres.map( (genre) => (
                                <option value={genre}>
                                    {genre}
                                </option>
                            ) )}
                        </select>
            
                        <select name="year" id="year" value={selectedYear} onChange={(e) => handleYearChange(e.target.value)}>
                            <option value="All Years">
                                All Years
                            </option>
                            {years.map( (year) => (
                                <option value={year}>
                                    {year}
                                </option>
                            ) )}
                        </select>
                        <select name="watchedFilter" id="watchedFilter" value={watchedFilter} onChange={(e) => handleWatchedFilter(e.target.value)}>
                            <option value="All Movies">
                                All Movies
                            </option>
                            <option value="true">
                                Already watched movies
                            </option>
                            <option value="false">
                                Not yet watched movies
                            </option>
                        </select>
                        <div className='favoriteFilter'>
                            <span>Show Favorite</span>
                            <input
                                                type="checkbox"
                                                className='favoriteCheckBox'
                                                checked={favoriteFilter}
                                                onChange={() => handleFavoriteFilter()}
                            ></input>
                        </div>
                    </div>
    
                    <ul className="userList">
                        {filteredWatchList.map((movie) => (
                            <div key={movie.id}>
                                <li className={movie.watched ? 'optionUser selected' : 'optionUser'}>
                                    {movie.title + " (" + movie.releaseYear + ")"}
                                    <div className='optionUserTools'>
                                        <input
                                            type="checkbox"
                                            className='watchedCheckBox'
                                            checked={movie.watched}
                                            onChange={() => handleWatchedMovie(movie)}
                                        />
                                        <button className='favoriteButton' onClick={() => handleFavoriteMovie(movie)}>
                                            {movie.favorite ? '★' : '☆'}
                                        </button>
                                        <button className='showMovieInfo' onClick={() => setSelectedMovieInfo(movie)}>Info</button>
                                        <button className="removeButton" onClick={() => handleDeleteMovie(movie)}>Delete</button>
                                    </div>

                                </li>
                            </div>
                        ))}
                    </ul>
                    <MovieInfo selectedMovieInfo={selectedMovieInfo}></MovieInfo>
                </div>
                {responseNotificationVisible && <span className={`notificationEditWatchList ${isFading ? 'fade-out' : ''}`}>{responseNotification}</span>}
            </div>
        );
    }

    function MovieInfo({ selectedMovieInfo }: MovieInfoProps) {
        if (!selectedMovieInfo) {
            return (
                <div className="userInfoContainer">
                    <h2>Movie Information</h2>
                    <h3>Add a movie to your list and click info to show Movie Information!</h3>
                </div>
            );
        }
    
        const {
            id,
            title,
            releaseYear,
            genre,
            director,
            cast,
            duration,
            rating,
            description,
        } = selectedMovieInfo;
    
        return (
            <div className="userInfoContainer">
                <h2>Movie Information</h2>
                <ul>
                    <li><strong>ID:</strong> {id}</li>
                    <li><strong>Title:</strong> {title}</li>
                    <li><strong>Release Year:</strong> {releaseYear}</li>
                    <li><strong>Genre:</strong> {genre}</li>
                    <li><strong>Director:</strong> {director}</li>
                    <li><strong>Cast:</strong> {cast}</li>
                    <li><strong>Duration:</strong> {duration} minutes</li>
                    <li><strong>Rating:</strong> {rating}</li>
                    <li><strong>Description:</strong> {description}</li>
                </ul>
            </div>
        );
    }

}

export default EditWatchList;