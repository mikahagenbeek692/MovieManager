import axios from 'axios'; // Import axios for API calls
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Login.css'; // Optional: Add styling for your Login component

axios.defaults.withCredentials = true; // Ensure cookies are included in all requests

const Login: React.FC = () => {
    const location = useLocation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(location.state?.message || '');
    const Navigate = useNavigate();

    useEffect(() => {
        console.log("🔍 Checking authentication...");
        const checkAuth = async () => {
            try {
                const authResponse = await axios.get('http://localhost:5000/home', { withCredentials: true });

                if (authResponse.status === 200) {
                    console.log("✅ User authenticated, navigating to home.");
                    Navigate("/home");
                }
            } catch (err) {
                console.warn("🔒 User not authenticated, staying on login page.");
                // Stay on login page if authentication fails
            }
        };

        checkAuth();
    }, [Navigate]);

    const handleLogin = async () => {
        try {
            console.log("📨 Sending login request...");
            
            const response = await axios.post('http://localhost:5000/login', {
                username,
                password
            }, {
                withCredentials: true // Ensure cookies are sent
            });

            if (response.status === 200) {
                console.log("✅ Login successful, navigating to Home.");
                Navigate("/Home", { state: { message: username } });
            }
        } catch (err: any) {
            if (err.response) {
                console.error("❌ Login failed:", err.response.data);
                switch (err.response.status) {
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
                console.error("❌ Network error:", err);
                setError('Network error. Please check your connection.');
            }
        }
    };

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
