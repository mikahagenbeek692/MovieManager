import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import './Login.css';

axios.defaults.withCredentials = true; 

const Login: React.FC = () => {
    const location = useLocation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(location.state?.message || '');
    const [loading, setLoading] = useState(true); // Prevents redirection before CSRF is fetched
    const [rateLimitTime, setRateLimitTime] = useState(0);
    const { fetchAuthData } = useAuth();
    const Navigate = useNavigate();

    // useAuth for global csrf token and username
    const { currentUser, csrfToken } = useAuth();

    const checkAuth = async () => {
        try {
            const authResponse = await axios.get('http://localhost:5000/home', { withCredentials: true });

            if (authResponse.status === 200) {
                console.log("✅ User authenticated, navigating to home.");
                Navigate("/home");
            }
        } catch (err) {
            console.warn("🔒 User not authenticated, staying on login page.");
        } finally {
            setLoading(false); // Mark as finished loading
        }
    };

    useEffect(() => {
        checkAuth();   
    }, []);  
    

    const startCountdown = () => {
        const interval = setInterval(() => {
            setRateLimitTime((prevTime) => {
                if (prevTime <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prevTime - 1;
            });
        }, 1000);
    };

    const handleLogin = async () => {
        if (rateLimitTime > 0) {
          return; // Prevent login attempts while waiting
        }
      
        try {
          console.log("📨 Sending login request...");
      
          const response = await axios.post("http://localhost:5000/login", { username, password }, { withCredentials: true });
      
          if (response.status === 200) {
            console.log("Login successful");
      
            localStorage.setItem("just_logged_in", "true"); // Optional for cache logic

            // Broadcast login to other tabs
            new BroadcastChannel("auth").postMessage({ type: "login" });
      
            // Fetch and store auth data (username, CSRF token, etc.)
            await fetchAuthData();
            

            // Navigate after auth context is updated
            Navigate("/home");
          }
        } catch (err: any) {
          if (err.response) {
            console.error("❌ Login failed:", err.response.data);
      
            switch (err.response.status) {
              case 404:
                setError("User not found. Please register.");
                break;
              case 401:
                setError("Invalid password. Please try again.");
                break;
              case 429:
                const retryAfter = err.response.data.retryAfter || 900;
                setError(
                  `Too many login attempts! Try again in ${Math.floor(
                    retryAfter / 60
                  )} min ${retryAfter % 60} sec.`
                );
                setRateLimitTime(retryAfter);
                startCountdown();
                break;
              case 500:
                setError("Server error. Please try again later.");
                break;
              default:
                setError("An unexpected error occurred.");
            }
          } else {
            console.error("❌ Network error:", err);
            setError("Network error. Please check your connection.");
          }
        }
      };
      
    

    if (loading) return <p>Loading...</p>; // Prevents instant redirect before CSRF is loaded

    return (
        <div className="login-page">
            <div className='login-container'>
                <h1 className='title'>Login</h1>
                <div className="login-form">
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button className="button" onClick={handleLogin}>Login</button>

                    <button className="button">
                        <Link to="/Register">
                            No account? Register here.
                        </Link>
                    </button>

                    {error && <p className="error-message">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default Login;
