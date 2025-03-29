// WatchlistContext.tsx
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useAuth } from './AuthContext.tsx';

export interface Movie {
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

interface WatchlistContextType {
  watchList: Movie[];
  setWatchList: React.Dispatch<React.SetStateAction<Movie[]>>;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  undoStack: Movie[][];
  pushUndo: (state: Movie[]) => void;
  undo: () => void;
  clearUndo: () => void;
  recommendations: number[];
  setRecommendations: React.Dispatch<React.SetStateAction<number[]>>;
  hydrateFromCache: (username: string) => void;
  clearUserCache: (username: string) => void;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const WatchlistProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const { currentUser } = useAuth();

  const [watchList, setWatchList] = useState<Movie[]>([]);
  const [recommendations, setRecommendations] = useState<number[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<Movie[][]>([]);

  // Hydrate local state when currentUser is available
  useEffect(() => {
    if (!currentUser) return;

    const storedWatchlist = localStorage.getItem(`watchlist_${currentUser}`);
    const storedRecommendations = localStorage.getItem(`recommendations_${currentUser}`);
    const storedUnsaved = localStorage.getItem(`hasUnsavedChanges_${currentUser}`);
    const storedUndo = localStorage.getItem(`undoStack_${currentUser}`);

    if (storedWatchlist) setWatchList(JSON.parse(storedWatchlist));
    if (storedRecommendations) setRecommendations(JSON.parse(storedRecommendations));
    if (storedUnsaved) setHasUnsavedChanges(storedUnsaved === 'true');
    if (storedUndo) setUndoStack(JSON.parse(storedUndo));
  }, [currentUser]);

  // Persist changes per user
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`watchlist_${currentUser}`, JSON.stringify(watchList));
    }
  }, [watchList, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`hasUnsavedChanges_${currentUser}`, String(hasUnsavedChanges));
    }
  }, [hasUnsavedChanges, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`undoStack_${currentUser}`, JSON.stringify(undoStack));
    }
  }, [undoStack, currentUser]);

  const pushUndo = (state: Movie[]) => setUndoStack((prev) => [...prev, state]);

  const undo = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
  
      const newStack = [...prev];
      const lastState = newStack.pop();
  
      if (lastState) setWatchList(lastState);
  
      if (newStack.length === 0) {
        setHasUnsavedChanges(false);
      }
  
      return newStack;
    });
  };
  

  const clearUndo = () => setUndoStack([]);

  const hydrateFromCache = (username: string) => {
    const storedWatchlist = localStorage.getItem(`watchlist_${username}`);
    const storedRecommendations = localStorage.getItem(`recommendations_${username}`);
    if (storedWatchlist) setWatchList(JSON.parse(storedWatchlist));
    if (storedRecommendations) setRecommendations(JSON.parse(storedRecommendations));
  };

  const clearUserCache = (username: string) => {
    localStorage.removeItem(`watchlist_${username}`);
    localStorage.removeItem(`recommendations_${username}`);
    localStorage.removeItem(`hasUnsavedChanges_${username}`);
    localStorage.removeItem(`undoStack_${username}`);


    setWatchList([]);
    setRecommendations([]);
    setHasUnsavedChanges(false);
    clearUndo();
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchList,
        setWatchList,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        undoStack,
        pushUndo,
        undo,
        clearUndo,
        recommendations,
        setRecommendations,
        hydrateFromCache,
        clearUserCache,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error('useWatchlist must be used within a WatchlistProvider');
  return context;
};
