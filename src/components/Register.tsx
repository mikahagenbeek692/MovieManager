import axios from 'axios'; // Import axios for API calls
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';

axios.defaults.withCredentials = true; 

const Register: React.FC = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [csrfToken, setCsrfToken] = useState('');
    const [error, setError] = useState('');
    const Navigate = useNavigate();

    const fetchCsrfToken = async () => {
        try {
            console.log("🔍 Fetching CSRF token...");
            const response = await axios.get('http://localhost:5000/csrf-token', { withCredentials: true });
            setCsrfToken(response.data.csrfToken);
            console.log("✅ CSRF Token received.");
        } catch (error) {
            console.error("❌ Failed to fetch CSRF token:", error);
        }
    };

    useEffect(() => {
        fetchCsrfToken();
    }, []);

    const handleRegister = async () => {
        setError(""); // Reset error message
    
        if (!username || !email || !password || !confirmPassword) {
            setError("Fill in all fields to register.");
            return;
        }
    
        if (confirmPassword !== password) {
            setError("Password and Confirm Password do not match.");
            return;
        }
    
        // Client-side validation to reduce bad requests to the server
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Please enter a valid email address.");
            return;
        }
    
        if (password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        if (!csrfToken) {
            setError("CSRF Token missing. Try refreshing the page.");
            return;
        }
    
        try {

            const response = await axios.post("http://localhost:5000/register", {
                username,
                password,
                email
            }, {
                headers: { 'X-CSRF-Token': csrfToken }, 
                withCredentials: true
            });

            if (response.status === 201) { 
                Navigate("/Login", { state: { message: "Registration Successful!" } });
            }
        } catch (err: any) {
            if (err.response && err.response.data.errors) {
                //  Handling validation errors returned by express-validator
                setError(err.response.data.errors.map((error: any) => error.msg).join("\n"));
            } else if (err.response) {

                switch (err.response.status) {
                    case 400:
                        setError("Username or Email already in use.");
                        break;
                    case 500:
                        setError("Server error. Please try again later.");
                        break;
                    default:
                        setError("An unexpected error occurred.");
                }
            } else {
                setError("Network error. Please check your connection.");
            }
        }
    };

    return (
        <div className="login-page">
            <div className='login-container'>
                <h1 className='title'>Register</h1>
                <div className="login-form">
                    <input
                        type="text"
                        placeholder="Create new Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Enter email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Create new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button className="button" onClick={handleRegister}>Register</button>

                    <button className="button">
                        <Link to="/Login">
                            Already have an account? Log in here
                        </Link>
                    </button>

                    {error && <p className="error-message">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default Register;
