import axios from 'axios';
import { default as React, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWatchlist } from './WatchlistContext.tsx';



import { useAuth } from './AuthContext.tsx';
import './Home.css';

axios.defaults.withCredentials = true; 

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

interface OptionMenuProps {
    movies: Movie[];
    setWatchList: React.Dispatch<React.SetStateAction<Movie[]>>;
    years: number[];
    genres: string[];
}

interface MovieInfoProps {
    selectedMovieInfo: Movie | null;
}

interface RecommendationsProps {
    recommendedMovies: Movie[];
}


const Home: React.FC = () => {
    const [recommendedMovies, setRecommendedMovies] = useState<Movie[]>([]);
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
    const [results, setResults] = useState<Movie[]>([]);
    const listRef = useRef<HTMLUListElement>(null);
    const {
        watchList, setWatchList,
        hasUnsavedChanges, setHasUnsavedChanges,
        undo, undoStack, pushUndo, clearUndo,
        recommendations, setRecommendations, hydrateFromCache
      } = useWatchlist();
      
    const [years, setYears] = useState<number[]>([])
    const [genres, setGenres] = useState<string[]>([]);
    const [showRestorePrompt, setShowRestorePrompt] = useState<boolean>(false);

    // useAuth for global csrf token and username
    const { currentUser, csrfToken, isLoading } = useAuth();


    //save watchlist limit
    const THROTTLE_MS = 10000; // 10 seconds
    const [lastSaveTime, setLastSaveTime] = useState<number>(0);

    const [selectedMovieInfo, setSelectedMovieInfo] = useState<Movie | null>(null);

    const Navigate = useNavigate();

    //notification
    const [responseNotification, setResponseNotification] = useState<string>("unknown error");
    const [responseNotificationVisible, toggleResponseNotificationVisible] = useState<boolean>(false);
    const [isFading, setIsFading] = useState<boolean>(false); 

    // update cache after each watchlist change
    useEffect(() => {
        if (currentUser && hasUnsavedChanges) {
          localStorage.setItem(`watchlist_${currentUser}`, JSON.stringify(watchList));
        }
      }, [watchList, hasUnsavedChanges, currentUser]);
      

    useEffect(() => {
        if (currentUser) {
          hydrateFromCache(currentUser);
        }
      }, [currentUser]);
      

      useEffect(() => {
        if (!isLoading && !currentUser) {
          Navigate('/login'); // Redirect if no user or csrf token and done loading
        }
      }, [isLoading, currentUser, Navigate]);

    const saveWatchList = async () => {
        try {
            const movieTitles = watchList.map(movie => ({
                id: movie.id,
                title: movie.title,
                watched: movie.watched === true,
                favorite: movie.favorite === true
            }));
    
            console.log("Saving watchlist:", { currentUser, movieTitles });
    
            await axios.post("http://localhost:5000/saveWatchList", 
                { 
                    username: currentUser, 
                    movieTitles 
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrfToken  // ✅ Include CSRF Token
                    },
                    withCredentials: true
                }
            );

            setResponseNotification("Your watchlist was successfully saved!");
            toggleResponseNotificationVisible(true);
            setIsFading(false);

            // after successful save
            localStorage.setItem(`watchlist_${currentUser}`, JSON.stringify(watchList));

    
            // Trigger recommendedMovies update immediately after saving
            fetchRecommendations();
    
            setTimeout(() => {
                setIsFading(true);
                setTimeout(() => {
                    toggleResponseNotificationVisible(false);
                }, 1000);
            }, 5000);
    
        } catch (error) {
            console.error('Error saving watchlist:', error.response ? error.response.data : error.message);
    
            setResponseNotification("Your watchlist was NOT successfully saved due to an unknown error");
            toggleResponseNotificationVisible(true);
            setIsFading(false);
        
            setTimeout(() => {
                setIsFading(true);
                setTimeout(() => {
                    toggleResponseNotificationVisible(false);
                }, 1000);
            }, 5000);
        }
    };

    const hydrateRecommendations = async () => {
        try {
          const moviesResponse = await axios.get('http://localhost:5000/api/movies');
          const hydrated = moviesResponse.data
            .filter((movie: Movie) => recommendations.includes(movie.id))
            .map((movie: any) => ({
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
              favorite: movie.favorite !== null ? !!movie.favorite : false,
            }));
          
          setRecommendedMovies(hydrated);
        } catch (error) {
          console.error("Error hydrating recommendations:", error);
        }
      };
      

    const handleSave = async () => {
        const now = Date.now();
        if (now - lastSaveTime < THROTTLE_MS) {
          alert("You're saving too frequently. Please wait a few seconds before trying again.");
          return;
        }
        setLastSaveTime(now);
      
        try {
          await saveWatchList(); 
          setHasUnsavedChanges(false);
          localStorage.removeItem('draft_watchlist'); // Clear draft after successful save
          clearUndo();
        } catch (error) {
          console.error("Error saving watchlist:", error);
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
                watched: !!movie.watched,
                favorite: movie.favorite !== null ? !!movie.favorite : false
            }));
            setWatchList(watchListMovies); // Update the state with the fetched watchlist
        } catch (error) {
            console.error("Error fetching watchlist:", error);
        }
    };

    const fetchRecommendations = async () => {
        setIsLoadingRecommendations(true);
        try {
            // Fetch recommendations for the user using their username
            const recommendationsResponse = await axios.get(`http://localhost:5000/api/recommendations`, {
                params: { username: currentUser }, // Pass the username as a query parameter
            });
    
            const recommendedMovieIds = recommendationsResponse.data.recommended_movie_ids;
    
            // Fetch all movies
            const moviesResponse = await axios.get('http://localhost:5000/api/movies');
    
            // Filter the full list of movies to get the recommended movies
            const recommendedMovies = moviesResponse.data
                .filter((movie: Movie) => recommendedMovieIds.includes(movie.id))
                .map((movie: any) => ({
                    id: movie.id,
                    title: movie.title,
                    releaseYear: movie.release_year, // Ensure this matches the API response
                    genre: movie.genre,
                    director: movie.director,
                    cast: movie.cast,
                    duration: movie.duration,
                    rating: movie.rating,
                    description: movie.description,
                    watched: !!movie.watched, // Set to false by default for recommended movies
                    favorite: movie.favorite !== null ? !!movie.favorite : false, // Set to false by default for recommended movies
                }));
    
            // Update the state with the recommended movies
            setRecommendations(recommendedMovieIds); // Cache the IDs
            setRecommendedMovies(recommendedMovies); // Show in local UI

            localStorage.setItem(`recommendations_${currentUser}`, JSON.stringify(recommendedMovieIds));

    
            // Display the recommended movie IDs (for debugging)
            console.log("Recommended Movie IDs:", recommendedMovieIds);
            console.log("Recommended Movies:", recommendedMovies);
        } catch (error) {
            console.error("Error fetching recommendations:", error);
        } finally {
            setIsLoadingRecommendations(false);
        }
    };

    const checkAuth = async () => {
        try {
            await axios.get('http://localhost:5000/home'); // Protected route
        } catch (err) {
            Navigate('/login'); // Redirect to login if not authenticated
        }
    };

    // listen for saves in editWatchList to refresh recommendations
    useEffect(() => {
        const trigger = localStorage.getItem('trigger_recommendations');
        if (trigger) {
          fetchRecommendations();
          localStorage.removeItem('trigger_recommendations'); 
        }
      
        const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'trigger_recommendations') {
            fetchRecommendations();
          }
        };
      
        window.addEventListener('storage', handleStorageChange);
        return () => {
          window.removeEventListener('storage', handleStorageChange);
        };
      }, []);
      
    
    
      useEffect(() => {
        if (!currentUser) return;
      
        fetchMovies();
        checkAuth();
      
        const fetchAll = async () => {
          const justLoggedIn = localStorage.getItem("just_logged_in") === "true";
          const cachedWatchlist = localStorage.getItem(`watchlist_${currentUser}`);
      
          if (justLoggedIn) {
            console.log("just logged in");
            if (hasUnsavedChanges && cachedWatchlist) {
                // Ask user if they want to restore local cache
                console.log("restoreable");
                setShowRestorePrompt(true);
                return; // pause backend fetch until they choose
              } else {
                //  Clear stale local cache if user chose not to restore
                localStorage.removeItem(`watchlist_${currentUser}`);
                localStorage.removeItem(`recommendations_${currentUser}`);
                localStorage.removeItem(`undoStack_${currentUser}`);
                localStorage.removeItem(`unsavedChanges_${currentUser}`);
              }
              
      
            await fetchWatchList(); // otherwise fetch normal
            localStorage.removeItem("just_logged_in");
          } else {
            // Normal refresh behavior
            if (cachedWatchlist) {
              try {
                setWatchList(JSON.parse(cachedWatchlist));
              } catch (e) {
                console.error("Failed to parse watchlist cache", e);
              }
            } else {
              await fetchWatchList();
            }
          }
      
          if (recommendations.length > 0) hydrateRecommendations();
          else fetchRecommendations();
        };
      
        fetchAll();
      }, [currentUser]);
    

    return (
            <div className='mainScreen'>


                {hasUnsavedChanges && (
                    <div className="unsavedNotification">
                        You have unsaved changes!
                    </div>
                )}

                {undoStack.length > 0 && (
                    <button className="undoButton" onClick={() => undo()}>
                        Undo last change
                    </button>
                )}

                {showRestorePrompt && (
                <>
                    <div className="restore-overlay" />
                    <div className="restore-modal">
                    <h3>Unsaved Changes Detected</h3>
                    <p>We found unsaved changes from your last session. Do you want to restore them?</p>
                    <button
                        onClick={() => {
                        const cached = localStorage.getItem(`watchlist_${currentUser}`);
                        if (cached) {
                            setWatchList(JSON.parse(cached));
                            localStorage.removeItem("just_logged_in");
                            setShowRestorePrompt(false);
                        }
                        }}
                    >
                        Restore Unsaved
                    </button>
                    <button
                        onClick={async () => {
                            await fetchWatchList(); 
                            setHasUnsavedChanges(false);
                            clearUndo(); 
                            localStorage.setItem(`hasUnsavedChanges_${currentUser}`, "false"); 
                            localStorage.removeItem("just_logged_in"); 
                            setShowRestorePrompt(false); 
                        }}
                    >
                        Discard and Load from Server
                    </button>
                    </div>
                </>
                )}



                <OptionMenu movies={results} setWatchList={setWatchList} years={years} genres={genres}></OptionMenu>
                <MovieList></MovieList>
                {isLoadingRecommendations ? (
                <p>Loading recommendations...</p>
                ) : (
                <Recommendations recommendedMovies={recommendedMovies} />
                )}

                {responseNotificationVisible && (
                        <span className={`notification ${isFading ? 'fade-out' : ''}`}>
                            {responseNotification}
                </span>
                )}
            </div>
    );

    function MovieList() {

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
            const scrollTop = listRef.current?.scrollTop ?? 0;
        
            removeMovie(movie.id);
        
            if (selectedMovieInfo === movie) {
                setSelectedMovieInfo(null);
            }
        
            // Delay scroll restoration until after the DOM updates
            requestAnimationFrame(() => {
                if (listRef.current) {
                    listRef.current.scrollTop = scrollTop;
                }
            });
        };
    
        const removeMovie = (movieId: number) => {
            pushUndo([...watchList]); 
            setWatchList((prevMovies) => prevMovies.filter((movie) => movie.id !== movieId));
            setHasUnsavedChanges(true);
        };
     
    
        return (
            <div className='userListAndInfoAndNotification'>
                <div className='userListAndInfo'>
                    <ul className="userList" ref={listRef}>
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
    
    function OptionMenu({ movies, years, genres }: OptionMenuProps) {
    
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
            pushUndo([...watchList]); 
            setWatchList((prevMovies) => {
                if (prevMovies.some((movie) => movie.id === newMovie.id)) {
                    undo();
                    return prevMovies; // Prevent duplicates
                }
                return [...prevMovies, newMovie];
            });
    
            setHasUnsavedChanges(true);

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
                                <button className='saveButton' onClick={() => handleSave()}>
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

    function Recommendations({ recommendedMovies }: RecommendationsProps) {

        const addMovie = (newMovie: Movie) => {
            if (!newMovie) return;
            pushUndo([...watchList]); 
            setWatchList((prevMovies) => {
                if (prevMovies.some((movie) => movie.id === newMovie.id)) {
                    return prevMovies; // Prevent duplicates
                }
                return [...prevMovies, newMovie];
            });

            setHasUnsavedChanges(true);
        };

        return (
            <div className="userInfoContainer">
                <h2>Recommendations</h2>
                {recommendedMovies.length > 0 ? (
                    <ul className="userList">
                        {recommendedMovies.map((movie) => (
                            <div key={movie.id}>
                                <li key={movie.id} className="optionUser">
                                    {movie.title + " (" + movie.releaseYear + ")"}
                                    <div className='optionUserTools'>
                                                <button className='showMovieInfo' onClick={() => setSelectedMovieInfo(movie)}>Info</button>
                                                <button className="addRecommendedMovie" onClick={() => {addMovie(movie)}}>Add</button>
                                                
                                    </div>
                                </li>
                            </div>
                        ))}
                    </ul>
                ) : (
                    <p>No recommendations available.</p>
                )}
            </div>
            

            
        );
    }
};





export default Home;


