import axios from 'axios'; // Import axios for API calls
import { default as React, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Home.css';

axios.defaults.withCredentials = true; // Include cookies with requests

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
}

interface MovieListProps {
    watchList: Movie[];
    setWatchList: React.Dispatch<React.SetStateAction<Movie[]>>;
    username: string;
    years: number[];
    genres: string[];
}

interface OptionMenuProps {
    movies: Movie[];
    setWatchList: React.Dispatch<React.SetStateAction<Movie[]>>;
    years: number[];
    genres: string[];
}

interface MovieInfoProps {
    selectedMovieInfo: Movie | null;
}


const Home: React.FC = () => {
    const location = useLocation();
    const [currentUser, setCurrentUser] = useState<string>(location.state?.message || '');
    const [results, setResults] = useState<Movie[]>([]);
    const [watchList, setWatchList] = useState<Movie[]>([]);
    const [years, setYears] = useState<number[]>([])
    const [genres, setGenres] = useState<string[]>([]);
    const Navigate = useNavigate();

    //notification
    const [responseNotification, setResponseNotification] = useState<string>("unknown error");
    const [responseNotificationVisible, toggleResponseNotificationVisible] = useState<boolean>(false);
    const [isFading, setIsFading] = useState<boolean>(false); 

    const saveWatchList = async () => {
        try {
            const movieTitles = watchList.map(movie => ({
                id: movie.id,
                title: movie.title,
                watched: movie.watched === true
            }));

            console.log("Saving watchlist:", { currentUser , movieTitles });

            const response = await axios.post('http://localhost:5000/saveWatchList', {
                username: currentUser,
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

            setResults(movies); // Update results state with the fetched movies
            setYears(fetchedYears);
            setGenres(fetchedGenres);
        } catch (error) {
            console.error("Error fetching movies:", error);
        }
    };

    const fetchWatchList = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/getWatchList', {
                params: { username: currentUser } // Send username as a query parameter
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
                watched: !!movie.watched
            }));
            setWatchList(watchListMovies); // Update the state with the fetched watchlist
        } catch (error) {
            console.error("Error fetching watchlist:", error);
        }
    };

    const saveWatchListNavigate = async () => {
        try {
            const movieTitles = watchList.map(movie => ({
                id: movie.id,
                title: movie.title,
                watched: movie.watched === true
            }));

            console.log("Saving watchlist:", { currentUser, movieTitles });

            const response = await axios.post('http://localhost:5000/saveWatchList', {
                username: currentUser,
                movieTitles: movieTitles
            });
    
            console.log("success")
 
        } catch (error) {
            console.error('Error saving watchlist:', error.response ? error.response.data : error.message);

        };
    }
    
    
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

    const handleLogout = async () => {
        const confirmLogout = window.confirm("Make sure to save your watchlist before logging out! Click OK to proceed or Cancel to stay.");
        if (confirmLogout) {
            await axios.post('http://localhost:5000/logout');
            Navigate('/login');
        }
    };

    const handleNavigate = async (location) => {
        await saveWatchListNavigate();
        console.log("Navigated and saved")
        Navigate(location, { state: { message: currentUser } });
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1 className='titleHome'>Add Movies</h1>
                <button className="logoutButton" onClick={(e) => handleNavigate("/Home")}>Add movies</button>
                <button className="logoutButton" onClick={(e) => handleNavigate("/Browse")}>Browse other accounts</button>
                <button className="logoutButton" onClick={(e) => handleNavigate("/EditWatchList")}>Edit watchlist</button>
                <button className="logoutButton" onClick={(e) => handleNavigate("/Profile")}>Edit Profile</button>
                <button className="logoutButton" onClick={handleLogout}>Logout</button>
            </header>
            <div className='mainScreen'>
                <OptionMenu movies={results} setWatchList={setWatchList} years={years} genres={genres}></OptionMenu>
                <MovieList username={currentUser} watchList={watchList} setWatchList={setWatchList} genres={genres} years={years}></MovieList>
                {responseNotificationVisible && (
                        <span className={`notification ${isFading ? 'fade-out' : ''}`}>
                            {responseNotification}
                </span>
                )}
            </div>
        </div>
    );

    function MovieList({ username, watchList, setWatchList, genres, years }: MovieListProps) {

        const [selectedMovieInfo, setSelectedMovieInfo] = useState<Movie | null>(null);
        const [filteredWatchList, setFilteredWatchList] = useState<Movie[]>(watchList);
    
    
        
        // Filters
        const [selectedGenre, setSelectedGenre] = useState<string>("All Genres");
        const [selectedYear, setSelectedYear] = useState<string>("All Years");
        const [watchedFilter, setWatchedFilter] = useState<string>("All Movies");
        const [inputText, setInputText] = useState("");
    
    
        
        
        useEffect(() => {
            // Filter movies based on the genre, year, and title input
            
            setFilteredWatchList(
                watchList.filter((movie) => {
                    const matchesTitle = movie.title.toLowerCase().includes(inputText.toLowerCase()) ||     // Filter through title and cast
                                         movie.cast.toLowerCase().includes(inputText.toLowerCase()) 
                    const matchesGenre = selectedGenre === "All Genres" || movie.genre.toLowerCase().includes(selectedGenre.toLowerCase());
                    const matchesYear = selectedYear === "All Years" || movie.releaseYear.toString().includes(selectedYear);
                    const matchesWatched = watchedFilter === "All Movies"  || movie.watched.toString() === watchedFilter;
        
                    // Return true if all conditions are met
                    return matchesTitle && matchesGenre && matchesYear && matchesWatched;
                })
            )     
    
        }, [inputText, selectedGenre, selectedYear, watchedFilter, watchList]);
    
        const handleDeleteMovie = (movie: Movie) => {
            removeMovie(movie.id);
            if (selectedMovieInfo === movie)
                setSelectedMovieInfo(null);
        };
    
        const removeMovie = (movieId: number) => {
            setWatchList((prevMovies) => prevMovies.filter((movie) => movie.id !== movieId));
        };
     
    
        return (
            <div className='userListAndInfoAndNotification'>
                <div className='userListAndInfo'>
                    <ul className="userList">
                        {filteredWatchList.map((movie) => (
                            <div key={movie.id}>
                                <li className={movie.watched ? 'optionUser selected' : 'optionUser'}>
                                    {movie.title + " (" + movie.releaseYear + ")"}
                                    <div className='optionUserTools'>
                                        <button className='showMovieInfo' onClick={() => setSelectedMovieInfo(movie)}>Info</button>
                                        <button className="removeButton" onClick={() => handleDeleteMovie(movie)}>Delete</button>
                                    </div>
                                </li>
                            </div>
                        ))}
                    </ul>
                    <MovieInfo selectedMovieInfo={selectedMovieInfo}></MovieInfo>
    
                </div>
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
    
    function OptionMenu({ movies, setWatchList, years, genres }: OptionMenuProps) {
    
        const [selectedMovie, selectMovie] = useState<Movie | null>(null);
        const [showDropdown, setShowDropdown] = useState(false);
        const [filteredOptions, setFilteredOptions] = useState<Movie[]>(movies);
        const [showWarning, setShowWarning] = useState(false);
    
        // Filters
        const [inputText, setInputText] = useState("");
        const [selectedGenre, setSelectedGenre] = useState<string>("All Genres");
        const [selectedYear, setSelectedYear] = useState<string>("All Years");
        const[currentOrder, setCurrentOrder] = useState<string>('');
    
    
        
    
        useEffect(() => {
            // Filter movies based on the genre, year, and title input
                const sortedMovies = [...movies].sort((a, b) => {
                    if (currentOrder === "Rating") {
                        return b.rating - a.rating; // Sort by rating in descending order
                    } else if (currentOrder === "ReleaseYear") {
                        return a.releaseYear - b.releaseYear; // Sort by releaseYear in ascending order
                    }
                    else {
                        return 0; // No sorting if currentOrder doesn't match any criteria
                    }
                    
                });
            
    
            setFilteredOptions(
                sortedMovies.filter((movie) => {
                    const matchesTitle = movie.title.toLowerCase().includes(inputText.toLowerCase()) ||     // Filter through title and cast
                                         movie.cast.toLowerCase().includes(inputText.toLowerCase()) 
                    const matchesGenre = selectedGenre === "All Genres" || movie.genre.toLowerCase().includes(selectedGenre.toLowerCase());
                    const matchesYear = selectedYear === "All Years" || movie.releaseYear.toString().includes(selectedYear);
        
                    // Return true if all conditions are met
                    return matchesTitle && matchesGenre && matchesYear;
                })
            )
    
            if(inputText.length > 0) setShowDropdown(true)
           
    
        }, [inputText, selectedGenre, selectedYear, currentOrder, movies]);
    
    
        const addMovie = (newMovie: Movie) => {
            if (!newMovie) return;
            setWatchList((prevMovies) => {
                if (prevMovies.some((movie) => movie.id === newMovie.id)) {
                    return prevMovies; // Prevent duplicates
                }
                return [...prevMovies, newMovie];
            });
    
            setInputText("");
            setShowDropdown(false);
            selectMovie(null);
        };
    
        const toggleDropDown = () => {
            setShowDropdown(!showDropdown);
        };
    
        const handleAddMovie = () => {
            if (selectedMovie && selectedMovie.title.trim() !== "") {
                addMovie(selectedMovie);
                setShowWarning(false);
            } else {
                setShowWarning(true);
            }
        };
    
        const handleSelectMovie = (movie: Movie) => {
            if (selectedMovie && selectedMovie.id === movie.id) {
                selectMovie(null);
                setInputText("");
            } else {
                selectMovie(movie);
                setInputText(movie.title);
            }
        };
    
        function Filters(){
        
            const handleGenreChange = (genre) => {
                setSelectedGenre(genre);
                setShowDropdown(true);
            }
        
            const handleYearChange = (year) => {
                setSelectedYear(year);
                setShowDropdown(true);
            }
    
            const handleOrderChange = (order) => {
                console.log(order);
                setCurrentOrder(order)
                setShowDropdown(true);
            }
        
            return (
                <div>
                    
                    <div className='filterButtons'>
                        <select name="order" id="order" value={currentOrder} onChange={(e) => handleOrderChange(e.target.value)}>
                            <option value="No Order">
                                No order
                            </option>
                            <option value="Rating">
                                Order by Rating
                            </option>
                            <option value="Release Year">
                                Order by Release Year
                            </option>
                            
                        </select>
    
    
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
                    </div>
                </div>
            );
        }
    
        return (
            <div className='filtersContainer'>
                        {/* <span className='filterHeader'>
                            Filter by genres and release year or search for titles and cast members.
                        </span> */}
                    <div className='searchAndAddWarning'>
                    {showWarning && (
                            <span className='warningMessage'>Select an existing movie!</span>
                        )}
                        <div className='filtersButtons'>
                        <Filters></Filters>
                        </div>
                        
                        <div className='searchAndAdd'>
    
                        
                            <div className="addUser">
                                <input
                                    className="input"
                                    value={inputText}
                                    onClick={toggleDropDown}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Search movies..."
                                />
                                <button
                                    className="addMovie"
                                    onClick={() => {
                                        if (selectedMovie) {
                                            handleAddMovie();
                                            setShowWarning(false);
                                        } else {
                                            setShowWarning(true);
                                        }
                                    }}
                                >
                                    Add Movie
                                </button>
                                <button className='saveButton' onClick={() => saveWatchList()}>
                                    Save watchlist
                                </button>
                            </div>
    
    
                            {showDropdown && (
                                <div className="userOptions">
                                    {filteredOptions.length > 0 ? (
                                        filteredOptions.map((option) => (
                                            <div
                                                key={option.id}
                                                onClick={() => handleSelectMovie(option)}
                                                className={
                                                    selectedMovie && selectedMovie.id === option.id
                                                        ? "option selected"
                                                        : "option"
                                                }
                                            >
                                               <div> {option.title} ({option.releaseYear}) </div> <span className='rating'>{option.rating}</span> 
                                            </div>
                                        ))
                                    ) : (
                                        <span className="noMoviesFound">No movies found</span>
                                    )}
                                </div>
                            )}
    
                        </div>
                </div>
            </div>
            
        );
    }
};



export default Home;
