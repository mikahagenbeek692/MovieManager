import React from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Browse from './components/Browse.tsx'; // Import the Browse component
import EditWatchList from './components/EditWatchList.tsx';
import Home from './components/Home.tsx'; // Import the Home component
import Login from './components/Login.tsx'; // Import the Login component
import Profile from './components/Profile.tsx';
import Register from './components/Register.tsx'; // Import the Register component
import ViewProfile from './components/ViewProfile.tsx';

function App() {
    return (
        <Router>
            <Routes>
                {/* Default route redirects to /login */}
                <Route path="/" element={<Navigate to="/login" />} />

                {/* Login Route */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Home Route */}
                <Route path="/home" element={<Home />} />
                <Route path="/Browse" element={<Browse />} />
                <Route path="/browse/:username" element={<ViewProfile />} />
                <Route path="/EditWatchList" element={<EditWatchList />}/>
                <Route path="/Profile" element={<Profile />}/>
            </Routes>
        </Router>
    );
}

export default App;
