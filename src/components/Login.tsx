import axios from 'axios'; // Import axios for API calls
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css'; // Optional: Add styling for your Login component

axios.defaults.withCredentials = true; // Ensure cookies are included in all requests

const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [csrfToken, setCsrfToken] = useState(''); // Store CSRF token
    const Navigate = useNavigate();

    // ✅ Fetch CSRF Token when component loads
    useEffect(() => {
        console.log("🔍 Fetching CSRF Token...");
        const fetchCsrfToken = async () => {
            try {
                const csrfResponse = await axios.get('http://localhost:5000/csrf-token', { withCredentials: true });
                console.log("✅ CSRF Token received:", csrfResponse.data.csrfToken);
                setCsrfToken(csrfResponse.data.csrfToken); // ✅ Store CSRF token for later use
            } catch (error) {
                console.error("❌ Failed to fetch CSRF Token", error);
                setError("Failed to fetch security token. Please refresh.");
            }
        };

        fetchCsrfToken();
    }, []);

    // ✅ Check if user is already authenticated
    useEffect(() => {
        console.log("🔍 Checking authentication...");
        const checkAuth = async () => {
            try {
                console.log("🔍 Fetching CSRF Token...");
                const csrfResponse = await axios.get('http://localhost:5000/csrf-token', { withCredentials: true });
                setCsrfToken(csrfResponse.data.csrfToken);
                console.log("✅ CSRF Token received:", csrfResponse.data.csrfToken);
        
                console.log("🔍 Checking authentication...");
                const authResponse = await axios.get('http://localhost:5000/api/checkAuth', { withCredentials: true });
        
                if (authResponse.status === 200) {
                    console.log("✅ User authenticated, navigating to home.");
                    Navigate("/home");
                }
            } catch (err) {
                console.warn("🔒 User not authenticated, staying on login page.");
                setError("Session expired. Please log in again."); // Show an error message instead of redirecting
            }
        };
        
        checkAuth();
    }, [Navigate]);

    // ✅ Handle Login Request
    const handleLogin = async () => {
        try {
            console.log("📨 Sending login request with CSRF Token:", csrfToken);

            const response = await axios.post('http://localhost:5000/login', {
                username,
                password
            }, { 
                headers: { 
                    'X-CSRF-Token': csrfToken  // ✅ Ensure CSRF token is included
                },
                withCredentials: true // ✅ Ensure cookies are sent
            });

            if (response.status === 200) {
                console.log("✅ Login successful, navigating to Home.");
                Navigate("/Home", { state: { message: username } });
            }
        } catch (err: any) {
            console.error("❌ Login failed:", err.response?.data || err.message);
            if (err.response) {
                switch (err.response.status) {
                    case 403:
                        setError('Invalid CSRF token. Please refresh and try again.');
                        break;
                    case 404:
                        setError('User not found. Please register.');
                        break;
                    case 401:
                        setError('Invalid password. Please try again.');
                        break;
                    case 500:
                        setError('Server error. Please try again later.');
                        break;
                    default:
                        setError('An unexpected error occurred.');
                }
            } else {
                setError('Network error. Please check your connection.');
            }
        }
    };

    return (
        <div className="login-page">
            <div className='login-container'>
                <h1 className='title'>Login</h1>34
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
