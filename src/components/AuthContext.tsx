// src/contexts/AuthContext.tsx
import axios from 'axios';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  currentUser: string | null;
  csrfToken: string | null;
  isLoading: boolean;
  fetchAuthData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAuthData = async () => {
    setIsLoading(true);
    try {
      const [meRes, csrfRes] = await Promise.all([
        axios.get("http://localhost:5000/me", { withCredentials: true }),
        axios.get("http://localhost:5000/csrf-token", { withCredentials: true }),
      ]);
  
      setCurrentUser(meRes.data.username);
      setCsrfToken(csrfRes.data.csrfToken);
    } catch (err) {
      console.warn("Session invalid or expired");
      setCurrentUser(null);
      setCsrfToken(null);
    } finally {
      setIsLoading(false);
    }
  };
  

  useEffect(() => {
    const channel = new BroadcastChannel("auth");
  
    channel.onmessage = async (event) => {
      const { type } = event.data;
  
      if (type === "login" || type === "logout") {
        console.log(`[Auth Sync] Received "${type}" from another tab`);
        await fetchAuthData(); // Sync currentUser & csrfToken
      }
    };
  
    return () => channel.close();
  }, []);
  
  

  useEffect(() => {
    fetchAuthData(); 
  }, []);
  
  

  return (
    <AuthContext.Provider value={{ currentUser, csrfToken, isLoading, fetchAuthData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
