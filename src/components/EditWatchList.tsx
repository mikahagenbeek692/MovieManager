import axios from 'axios'; // Import axios for API calls
import { default as React, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import './EditWatchList.css';
import { useWatchlist } from './WatchlistContext.tsx';


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
}

interface MovieInfoProps {
    selectedMovieInfo: Movie | null;
}

const EditWatchList: React.FC = () => {

    const { watchList, setWatchList, hasUnsavedChanges, setHasUnsavedChanges, undo, undoStack, pushUndo, clearUndo } = useWatchlist();
    const Navigate = useNavigate();

    const listRef = useRef<HTMLUListElement>(null);

    // useAuth for global csrf token and username
    const { currentUser, csrfToken, isLoading } = useAuth();

    //save watchlist limit
        const THROTTLE_MS = 10000; // 10 seconds
        const [lastSaveTime, setLastSaveTime] = useState<number>(0);

    // labels
    const [years, setYears] = useState<number[]>([])
    const [genres, setGenres] = useState<string[]>([]);

    // notification
    const [responseNotification, setResponseNotification] = useState<string>("unknown error");
    const [responseNotificationVisible, toggleResponseNotificationVisible] = useState<boolean>(false);
    const [isFading, setIsFading] = useState<boolean>(false); 

    // update cache after each watchlist change
    useEffect(() => {
        if (currentUser && hasUnsavedChanges) {
          localStorage.setItem(`watchlist_${currentUser}`, JSON.stringify(watchList));
        }
      }, [watchList, hasUnsavedChanges, currentUser]);
      


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
                favorite: movie.favorite !== null ? !!movie.favorite : false  // Include favorite status
            }));
            setWatchList(watchListMovies);

        } catch (error) {
            console.error("Error fetching watchlist:", error);
        }
    };

    const checkAuth = async () => {
        try {
            await axios.get('http://localhost:5000/home'); // Protected route
        } catch (err) {
            Navigate('/login'); // Redirect to login if not authenticated
        }
    };    

    useEffect(() => {
        const cached = localStorage.getItem(`watchlist_${currentUser}`);
        if (cached) {
          setWatchList(JSON.parse(cached));
        } else {
          fetchWatchList();
        }
      
        checkAuth();
      }, [Navigate]);

      useEffect(() => {
              if (!isLoading && !currentUser) {
                Navigate('/login'); // Redirect if no user or csrf token and done loading
              }
            }, [isLoading, currentUser, Navigate]);
      


    return (
        <div className='mainScreen'>
            {responseNotificationVisible && <span className={`notification ${isFading ? 'fade-out' : ''}`}>{responseNotification}</span>}
            {hasUnsavedChanges && (
                <div className="unsavedNotification">
                    You have unsaved changes!
                </div>
            )}
            {undoStack.length > 0 && (
                        <button className="undoButtonEditWatchlist" onClick={() => undo()}>
                            Undo last change
                        </button>
                )}
            <MovieList watchList={watchList} setWatchList={setWatchList}></MovieList>

        </div>
    );  

    function MovieList({ watchList, setWatchList}: MovieListProps) {
        const [selectedMovieInfo, setSelectedMovieInfo] = useState<Movie | null>(null);
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
                    favorite: movie.favorite === true
                }));
    
                console.log("Saving watchlist:", { movieTitles });
    
                const response = await axios.post("http://localhost:5000/saveWatchList", 
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
                localStorage.setItem(`watchlist_${currentUser}`, JSON.stringify(watchList));
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
              localStorage.setItem('trigger_recommendations', Date.now().toString());
              localStorage.removeItem('draft_watchlist'); // Clear draft after successful save
              clearUndo();
            } catch (error) {
              console.error("Error saving watchlist:", error);
            }
          };
        
        
        useEffect(() => {
            // Filter movies based on the genre, year, and title input
            
            setFilteredWatchList(
                watchList.filter((movie) => {
                    if(favoriteFilter){
                        return movie.favorite;
                    }
                    const matchesTitle = movie.title.toLowerCase().includes(inputText.toLowerCase()) ||     
                                         movie.cast.toLowerCase().includes(inputText.toLowerCase()) 
                    const matchesGenre = selectedGenre === "All Genres" || movie.genre.toLowerCase().includes(selectedGenre.toLowerCase());
                    const matchesYear = selectedYear === "All Years" || movie.releaseYear.toString().includes(selectedYear);
                    const matchesWatched = watchedFilter === "All Movies"  || movie.watched.toString() === watchedFilter;

                    return matchesTitle && matchesGenre && matchesYear && matchesWatched;
                })
            )     
    
        }, [inputText, selectedGenre, selectedYear, watchedFilter, favoriteFilter]);
    
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
    
        const handleGenreChange = (genre) => {
            setSelectedGenre(genre);
        }
    
        const handleYearChange = (year) => {
            setSelectedYear(year);
        }
    
        const handleWatchedFilter = (watched) => {
            setWatchedFilter(watched);
        }
    
        const handleWatchedMovie = (movie: Movie) => {
            const scrollTop = listRef.current?.scrollTop ?? 0;
        
            pushUndo([...watchList]); 
            setWatchList((prevWatchList) =>
                prevWatchList.map((m) =>
                    m.id === movie.id ? { ...m, watched: !m.watched } : m
                )
            );
            setHasUnsavedChanges(true);
        
            setSelectedMovieInfo((prevSelected) => 
                prevSelected && prevSelected.id === movie.id
                    ? { ...prevSelected, watched: !movie.watched }
                    : prevSelected
            );
        
            requestAnimationFrame(() => {
                if (listRef.current) {
                    listRef.current.scrollTop = scrollTop;
                }
            });
        };
        
        
        const handleFavoriteMovie = (movie: Movie) => {
            const scrollTop = listRef.current?.scrollTop ?? 0;
        
            pushUndo([...watchList]); 
            setWatchList((prevWatchList) =>
                prevWatchList.map((m) =>
                    m.id === movie.id ? { ...m, favorite: !m.favorite } : m
                )
            );
            setHasUnsavedChanges(true);
        
            setSelectedMovieInfo((prevSelected) => 
                prevSelected && prevSelected.id === movie.id
                    ? { ...prevSelected, favorite: !movie.favorite }
                    : prevSelected
            );
        
            requestAnimationFrame(() => {
                if (listRef.current) {
                    listRef.current.scrollTop = scrollTop;
                }
            });
        };
        
        
        
        

        const handleFavoriteFilter = () => {
            setFavoriteFilter(!favoriteFilter);
        }
    
    
        return (
            <div className='userListAndInfoAndNotification'>
                <div className='userListAndInfo'>
                    <div className='watchListTools'>
                        <button className='saveButtonBrowse' onClick={() => handleSave()} >
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
    
                    <ul className="userList" ref={listRef}>
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