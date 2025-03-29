import React from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext.tsx';
import Browse from './components/Browse.tsx'; // Import the Browse component
import EditWatchList from './components/EditWatchList.tsx';
import Home from './components/Home.tsx'; // Import the Home component
import Layout from './components/Layout.tsx';
import Login from './components/Login.tsx'; // Import the Login component
import Profile from './components/Profile.tsx';
import Register from './components/Register.tsx'; // Import the Register component
import ScrollToTop from './components/ScrollToTop.tsx';
import ViewProfile from './components/ViewProfile.tsx';
import { WatchlistProvider } from './components/WatchlistContext.tsx';

function App() {
    return (
      <AuthProvider>
        <WatchlistProvider>
          <Router>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Navigate to="/login" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<Layout />}>
                <Route path="/home" element={<Home />} />
                <Route path="/Browse" element={<Browse />} />
                <Route path="/browse/:username" element={<ViewProfile />} />
                <Route path="/EditWatchList" element={<EditWatchList />} />
                <Route path="/Profile" element={<Profile />} />
              </Route>
            </Routes>
          </Router>
        </WatchlistProvider>
      </AuthProvider>

    );
  }

export default App;
