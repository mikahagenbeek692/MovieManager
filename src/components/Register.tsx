import axios from 'axios'; // Import axios for API calls
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css'; // Optional: Add styling for your Login component

axios.defaults.withCredentials = true; // Include cookies with requests

const Register: React.FC = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const Navigate = useNavigate();

    const handleRegister = async () => {
        try {
            if(username === '' || email === '' || password === '' || confirmPassword === ''){
                setError('Fill in all fields to register.')
                return;
            }
            if(confirmPassword !== password){
                setError('Password and Confirm Password are not the same.');
                return;
            }
            // Send a POST request to the server
            const response = await axios.post('http://localhost:5000/register', {
                username,
                password,
                email
            });

            if (response.status === 200) {
                // On success, navigate to the home page
                Navigate("/Login", {state : {message : "Register Succesful"} });
            }
        } catch (err: any) {
            if (err.response) {
                // Backend responded with an error
                switch (err.response.status) {
                    case 400:
                        setError('User already exists');
                        break;
                    case 500:
                        setError('Server error. Please try again later.');
                        break;
                    case 401:
                        setError('Email already in use');
                        break;
                    default:
                        setError('An unexpected error occurred.');
                }
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
                        placeholder="Enter email adress"
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
