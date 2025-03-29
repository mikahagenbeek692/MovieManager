import axios from 'axios';
import bcrypt from 'bcryptjs';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import csrf from 'csurf';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import NodeCache from 'node-cache';




const SECRET_KEY = process.env.SECRET_KEY || 'fallback_secret_key';
const app = express();
const port = 5000;
const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 }); // Cache expires in 5 minutes

const csrfProtection = csrf({ cookie: true });

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Max 5 failed login attempts per IP
    message: "Too many login attempts. Please try again later.",
    handler: (req, res) => {
        const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
        res.status(429).json({
            message: "Too many login attempts! Try again later.",
            retryAfter: retryAfter // Send remaining time in seconds
        });
    },
    skipSuccessfulRequests: true, // ✅ We will reset manually after a successful login
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
});



// CORS configuration
const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,  
    methods: ['GET', 'POST', 'PUT', 'DELETE'], 
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'] 
};

// Middleware
app.use(helmet()); // Secure HTTP headers
app.use(cors(corsOptions)); // Enable CORS first
app.use(cookieParser()); // Parse cookies
app.use(bodyParser.json()); // Parse JSON request body

dotenv.config();

// Apply CSRF to everything *except* /login and /register
app.use((req, res, next) => {
    const skipCSRF = ['/login', '/register'];
    if (skipCSRF.includes(req.path)) return next();
    return csrfProtection(req, res, next);
  });
  



// MySQL connection pool
const db = mysql.createPool({
    host: 'mysql', 
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'projectapi',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  app.get("/api/recommendations", async (req, res) => {
    const { username } = req.query; // Get the username from the query parameters

    if (!username) {
        return res.status(400).json({ error: "Username is required." });
    }

    try {
        // Fetch the user ID based on the username
        const [userResults] = await db.query('SELECT id FROM users WHERE username = ?', [username]);

        if (userResults.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const userId = userResults[0].id;

        // Fetch recommendations for the user
        const response = await axios.get(`http://recommendation_api:8000/recommend/${userId}`);
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching recommendations:", error);
        res.status(500).json({ error: "Error fetching recommendations" });
    }
});
app.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Authenticate middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

app.get('/me', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username; // From decoded JWT

        const [user] = await db.query('SELECT username FROM users WHERE username = ?', [username]);

        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            username: user[0].username
        });
    } catch (err) {
        console.error("❌ Error in /me route:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get('/home', authenticateToken, (req, res) => {
    res.status(200).json({ message: `Welcome, ${req.user.username}!` });
});

app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });
});

app.post(
    '/register',
    csrfProtection,
    [
        // Validate & sanitize username
        body('username')
            .trim()
            .isLength({ min: 3, max: 20 })
            .withMessage('Username must be between 3 and 20 characters')
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Username can only contain letters, numbers, and underscores'),

        // Validate & sanitize email
        body('email')
            .trim()
            .isEmail()
            .withMessage('Invalid email format')
            .normalizeEmail(),

        // Validate & sanitize password
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/[A-Z]/)
            .withMessage('Password must contain at least one uppercase letter')
            .matches(/[a-z]/)
            .withMessage('Password must contain at least one lowercase letter')
            .matches(/\d/)
            .withMessage('Password must contain at least one number')
            .matches(/[@$!%*?&#]/)
            .withMessage('Password must contain at least one special character'),
    ],
    async (req, res) => {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password, email } = req.body;

        try {
            // Prevent duplicate usernames or emails
            const [results] = await db.query(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                [username, email]
            );
            if (results.length > 0) {
                return res.status(400).json({ message: 'Username or Email already in use' });
            }

            // Hash password securely
            const hashedPassword = await bcrypt.hash(password, 14);

            // Insert new user into the database
            await db.query(
                'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
                [username, hashedPassword, email]
            );

            res.status(201).json({ message: 'User registered successfully' });
        } catch (err) {
            console.error('❌ Error during registration:', err);
            res.status(500).json({ message: 'Server error' });
        }
    }
);


// 🚀 Caching helper function
const getFromCacheOrDB = async (cacheKey, dbQuery, queryParams = []) => {
    let cachedData = cache.get(cacheKey);
    if (cachedData) {
        console.log(`✅ Serving ${cacheKey} from cache`);
        return cachedData;
    }
    try {
        const [results] = await db.query(dbQuery, queryParams);
        cache.set(cacheKey, results); // Store in cache
        console.log(`🔄 Cached ${cacheKey} for 5 minutes`);
        return results;
    } catch (err) {
        console.error(`❌ Error fetching ${cacheKey}:`, err);
        throw err;
    }
};

app.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    console.log("Login attempt for:", username);

    try {
        // 1. Fetch user details
        const [results] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (results.length === 0) {
            console.warn("User not found:", username);
            return res.status(404).json({ message: 'User not found' });
        }

        const user = results[0];
        console.log("✅ User found:", user.username);

        // 2. Check password
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            console.warn("Incorrect password for:", username);
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        console.log("Password correct for:", username);

        // 3. Generate JWT token
        const token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        console.log("🔑 JWT created for:", username);

        // 4. Set token as HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
        });

        console.log("JWT token set in cookie for:", username);

        // 5. Return basic success response
        res.status(200).json({ message: 'Login successful' });

    } catch (err) {
        console.error('❌ Database error during login:', err);
        res.status(500).json({ message: 'Database error' });
    }
});




app.get('/api/getWatchList', async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ message: 'Username is required' });
    }

    try {
        const results = await getFromCacheOrDB(
            `watchlist_${username}`,
            `SELECT m.*, 
                    COALESCE(w.watched, 0) AS watched, 
                    COALESCE(w.favorite, 0) AS favorite
             FROM watchlists w 
             JOIN movies m ON w.movie_id = m.id 
             JOIN users u ON w.user_id = u.id 
             WHERE u.username = ?`,
            [username]
        );

        res.status(200).json(results.length ? results : []);
    } catch (err) {
        res.status(500).json({ message: 'Database error' });
    }
});


// Save Watchlist
app.post('/saveWatchList', async (req, res) => {
    const { username, movieTitles } = req.body;

    if (!username || !movieTitles) {
        return res.status(400).json({ message: "Invalid request: Missing username or movies." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 🚀 Get User ID
        const [userResults] = await connection.query(
            'SELECT id FROM users WHERE username = ?', [username]
        );

        if (userResults.length === 0) {
            throw new Error("User not found");
        }
        const userId = userResults[0].id;

        // 🚀 Delete Old Watchlist Data
        await connection.query('DELETE FROM watchlists WHERE user_id = ?', [userId]);

        // 🚀 Insert New Watchlist Data
        let genreCounts = {};

        if (movieTitles.length > 0) {
            const values = movieTitles.map(({ id, watched, favorite }) => {
                return [userId, id, watched, favorite !== null ? favorite : false];
            });

            await connection.query(
                'INSERT INTO watchlists (user_id, movie_id, watched, favorite) VALUES ?',
                [values]
            );

            // Fetch Movie Genres to Determine Favorite Genres
            const movieIds = movieTitles.map(movie => movie.id);
            const [moviesData] = await connection.query(
                `SELECT id, genre FROM movies WHERE id IN (?)`, [movieIds]
            );

            // Count Genres Only for Watched Movies
            moviesData.forEach(movie => {
                const movieGenres = movie.genre.split(',').map(g => g.trim());
                movieGenres.forEach(genre => {
                    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                });
            });
        }

        let favoriteGenres = "";
        if (Object.keys(genreCounts).length > 0) {
            // Sort genres by frequency and select top 2
            const sortedGenres = Object.entries(genreCounts)
                .sort((a, b) => b[1] - a[1])
                .map(entry => entry[0]);

            // Select up to 2 genres (at least 1)
            favoriteGenres = sortedGenres.slice(0, 2).join(', ');
        }

        // Update User's Favorite Genres
        await connection.query(
            'UPDATE users SET favorite_genres = ? WHERE id = ?',
            [favoriteGenres, userId]
        );

        await connection.commit();

        // Invalidate Cache
        cache.del(`watchlist_${username}`);
        cache.del(`favorite_genres_${username}`);
        cache.del(`usersWithWatchlists`);  // 🔥 Invalidates all watchlists!
        cache.del('all_users');

        console.log(`🗑️ Cache invalidated for ${username} & usersWithWatchlists`);

        res.status(200).json({ message: 'Watchlist updated successfully', favoriteGenres });
    } catch (err) {
        await connection.rollback();
        console.error("❌ Error saving watchlist:", err);
        res.status(500).json({ message: 'Database error', error: err.message });
    } finally {
        connection.release();
    }
});

// Fetch Friends List
app.get('/api/friends', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: 'Username parameter is required.' });
    }

    try {
        // Fetch user ID
        const userResult = await getFromCacheOrDB(
            `user_${username}`,
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (userResult.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userId = userResult[0].id;

        // **Fix: Ensure friend usernames are retrieved properly**
        const friends = await getFromCacheOrDB(
            `friends_${userId}`,
            `SELECT DISTINCT 
                u.id AS friend_id, 
                u.username AS friend_username 
             FROM friends f 
             JOIN users u ON u.id = CASE 
                 WHEN f.user_id = ? THEN f.friend_id 
                 ELSE f.user_id 
             END
             WHERE f.user_id = ? OR f.friend_id = ?`,
            [userId, userId, userId]
        );

        // Format response
        const formattedFriends = friends.map(friend => ({
            id: friend.friend_id,
            username: friend.friend_username || "Unknown"
        }));

        res.status(200).json(formattedFriends);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching friends.' });
    }
});


// Fetch Users With Watchlists
app.get('/api/users', async (req, res) => {
    try {
        // ✅ Check Cache First
        let cachedData = cache.get('all_users');
        if (cachedData) {
            console.log(`✅ Serving all users from cache`);
            return res.status(200).json(cachedData);
        }

        // Fetch fresh data if not cached
        const [results] = await db.query(
            `SELECT id AS user_id, username, email, favorite_genres, BIO
             FROM users`
        );

        // Format response
        const allUsers = results.map(user => ({
            id: user.user_id,
            username: user.username,
            email: user.email,
            favoriteGenres: user.favorite_genres || "",
            bio: user.BIO || "This user has no description yet"
        }));

        // Store in cache for next requests
        cache.set('all_users', allUsers);
        console.log("🔄 Cached all users for 5 minutes");

        res.status(200).json(allUsers);
    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ message: 'Database error' });
    }
});




// Update Watchlist Privacy
app.post('/api/updateWatchlistPrivacy', async (req, res) => {
    const { username, privacy } = req.body;

    if (!username || !privacy) {
        return res.status(400).json({ error: 'Username and privacy setting are required.' });
    }

    const validPrivacySettings = ['private', 'friendsonly', 'public'];
    if (!validPrivacySettings.includes(privacy)) {
        return res.status(400).json({ error: 'Invalid privacy setting.' });
    }

    try {
        // Update privacy in the database
        const query = `UPDATE users SET publicity = ? WHERE username = ?`;
        const [result] = await db.execute(query, [privacy, username]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // **Invalidate Cache** (Force refresh of public users)
        cache.del('public_users_watchlists');

        console.log(`🔄 Public users cache invalidated after updating privacy for ${username}`);

        return res.status(200).json({ message: 'Watchlist privacy updated successfully.' });
    } catch (error) {
        console.error('Error updating privacy:', error);
        return res.status(500).json({ error: 'An error occurred while updating privacy.' });
    }
});


app.get('/api/watchlistPrivacy', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username is required.' });

    try {
        // **Query the database directly instead of using cache**
        const [result] = await db.execute('SELECT publicity FROM users WHERE username = ?', [username]);

        if (result.length === 0) return res.status(404).json({ error: 'User not found.' });

        res.status(200).json({ privacy: result[0].publicity });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching publicity.' });
    }
});


app.post('/api/acceptFriendRequest', async (req, res) => {
    const { requestId } = req.body;

    if (!requestId) {
        return res.status(400).json({ error: 'Request ID is required.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Verify the friend request exists and is pending
        const [request] = await connection.query(
            'SELECT * FROM friend_requests WHERE id = ? AND status = "pending"',
            [requestId]
        );

        if (request.length === 0) {
            throw new Error('No pending friend request found.');
        }

        // Update the status of the friend request to accepted
        await connection.query(
            'UPDATE friend_requests SET status = "accepted" WHERE id = ?',
            [requestId]
        );

        // Add both users as friends
        const senderId = request[0].sender_id;
        const receiverId = request[0].receiver_id;
        await connection.query(
            'INSERT INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)',
            [receiverId, senderId, senderId, receiverId]
        );

        // Invalidate friend cache for both users
        cache.del(`friends_${senderId}`);
        cache.del(`friends_${receiverId}`);

        await connection.commit();
        res.status(200).json({ message: 'Friend request accepted successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error accepting friend request:', error);
        res.status(500).json({ error: 'An error occurred while accepting the friend request.' });
    } finally {
        connection.release();
    }
});

app.get('/api/movies', async (req, res) => {
    try {
        const results = await getFromCacheOrDB('movies', 'SELECT * FROM movies');
        res.status(200).json(results);
    } catch (err) {
        res.status(500).json({ message: 'Database error' });
    }
});

app.get('/api/friendRequests', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: 'Username parameter is required.' });
    }

    try {
        // Fetch user ID based on username
        const [userResult] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (userResult.length === 0) return res.status(404).json({ error: 'User not found.' });

        const userId = userResult[0].id;

        // Fetch pending friend requests (including sender's username)
        const [friendRequests] = await db.execute(
            `SELECT fr.id AS request_id, u.id AS sender_id, u.username AS sender_username 
             FROM friend_requests fr
             JOIN users u ON fr.sender_id = u.id
             WHERE fr.receiver_id = ? AND fr.status = 'pending'`,
            [userId]
        );

        //  Ensure username is included
        const formattedFriendRequests = friendRequests.map(request => ({
            id: request.request_id,
            username: request.sender_username || "Unknown"
        }));

        res.status(200).json(formattedFriendRequests);
    } catch (error) {
        console.error('Error fetching friend requests:', error);
        res.status(500).json({ error: 'An error occurred while fetching friend requests.' });
    }
});


app.post('/api/sendFriendRequest', async (req, res) => {
    const { senderUsername, receiverUsername } = req.body;
    
    // Prevent self-request
    if (senderUsername === receiverUsername) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
    }
  
    try {
      // Fetch both users' IDs
      const [users] = await db.execute(
        'SELECT id, username FROM users WHERE username IN (?, ?)',
        [senderUsername, receiverUsername]
      );
      if (users.length < 2) {
        return res.status(404).json({ error: 'One or both users not found.' });
      }
      const sender = users.find(u => u.username === senderUsername);
      const receiver = users.find(u => u.username === receiverUsername);
  
      // Check if they are already friends
      const [existingFriends] = await db.execute(
        `SELECT * FROM friends
         WHERE (user_id = ? AND friend_id = ?)
            OR (user_id = ? AND friend_id = ?)`,
        [sender.id, receiver.id, receiver.id, sender.id]
      );
      if (existingFriends.length > 0) {
        return res.status(400).json({ error: 'You are already friends.' });
      }
  
      // Check if there's an existing friend request from the receiver to the sender
      const [reverseRequest] = await db.execute(
        `SELECT * FROM friend_requests
         WHERE sender_id = ? AND receiver_id = ?`,
        [receiver.id, sender.id]
      );
  
      if (reverseRequest.length > 0) {
        // If a reverse request exists, automatically accept and create the friendship
        await db.execute('UPDATE friend_requests SET status = "accepted" WHERE id = ?', [reverseRequest[0].id]);
        await db.execute(
          'INSERT INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)',
          [sender.id, receiver.id, receiver.id, sender.id]
        );
        cache.del(`friendRequests_${receiver.id}`);  // Invalidate pending requests for receiver
        cache.del(`friends_${sender.id}`);            // Invalidate friends list for sender
        cache.del(`friends_${receiver.id}`);  
        return res.json({ message: 'Friend request auto-accepted. You are now friends.' });
      }
  
      // If no reverse request exists, create a new friend request
      const [existingRequest] = await db.execute(
        'SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ?',
        [sender.id, receiver.id]
      );
  
      if (existingRequest.length > 0) {
        return res.status(400).json({ error: 'Friend request already sent.' });
      }
  
      await db.execute(
        'INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)',
        [sender.id, receiver.id]
      );

    cache.del(`friendRequests_${receiver.id}`);  // Invalidate pending requests for receiver
    cache.del(`friends_${sender.id}`);            // Invalidate friends list for sender
    cache.del(`friends_${receiver.id}`);          // Invalidate friends list for receiver
  
      res.json({ message: 'Friend request sent successfully.' });
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ error: 'An error occurred while sending the friend request.' });
    }
  });
  

app.post('/api/rejectFriendRequest', async (req, res) => {
    const { requestId } = req.body;

    if (!requestId) {
        return res.status(400).json({ error: 'Request ID is required.' });
    }

    try {
        // Remove the friend request from the database
        const [result] = await db.execute(
            'DELETE FROM friend_requests WHERE id = ? AND status = "pending"',
            [requestId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Friend request not found or already handled.' });
        }

        res.status(200).json({ message: 'Friend request rejected successfully.' });
    } catch (error) {
        console.error('Error rejecting friend request:', error);
        res.status(500).json({ error: 'An error occurred while rejecting the friend request.' });
    }
});

app.post('/api/deleteFriend', async (req, res) => {
    const { username, friendId } = req.body;

    try {
        // Get the user ID based on the username
        const [user] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        const userId = user[0].id;

        // Delete the friendship
        const deleteFriendQuery = 
            `DELETE FROM friends
            WHERE (user_id = ? AND friend_id = ?)
               OR (user_id = ? AND friend_id = ?)`
        ;
        const [result] = await db.execute(deleteFriendQuery, [userId, friendId, friendId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Friendship not found.' });
        }

        // Delete any pending or past friend requests between these users
        const deleteRequestsQuery = 
            `DELETE FROM friend_requests 
            WHERE (sender_id = ? AND receiver_id = ?) 
               OR (sender_id = ? AND receiver_id = ?)`
        ;
        await db.execute(deleteRequestsQuery, [userId, friendId, friendId, userId]);

        // Invalidate cache for both users
        cache.del(`friends_${userId}`);
        cache.del(`friends_${friendId}`);

        res.status(200).json({ message: 'Friend removed successfully and friend requests cleared.' });
    } catch (error) {
        console.error('Error deleting friend:', error);
        res.status(500).json({ error: 'An error occurred while deleting the friend.' });
    }
});

app.get('/api/userProfile', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: "Username is required" });
    }

    try {
        console.log("📨 Fetching user profile for:", username);

        const [rows] = await db.query("SELECT BIO FROM users WHERE username = ?", [username]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        console.log("✅ Profile data:", rows[0]);

        res.json({ BIO: rows[0].BIO });
    } catch (error) {
        console.error("❌ Error fetching user profile:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/api/updateProfileDescription', async (req, res) => {
    console.log("📨 Received update request:", req.body);

    const { username, description } = req.body;

    if (!username || !description) {
        return res.status(400).json({ error: "Username and description are required" });
    }

    console.log(`🔄 Updating BIO for user: ${username}`);

    try {
        // **Use `db.execute()` which returns a Promise**
        const [result] = await db.execute("UPDATE users SET BIO = ? WHERE username = ?", [description, username]);

        console.log("✅ Profile description updated in database:", result);

        // **Ensure affectedRows > 0 (so we know a row was updated)**
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "User not found or no changes made" });
        }

        // Send response back to frontend
        console.log("🚀 Sending success response back to frontend...");
        return res.status(200).json({ 
            success: true, 
            message: "Profile description updated successfully!", 
            updatedDescription: description 
        });

    } catch (error) {
        console.error("❌ Database execution error:", error);
        return res.status(500).json({ error: "Failed to update profile description" });
    }
});


app.get('/api/friendStatus', async (req, res) => {
    const { senderUsername, receiverUsername } = req.query;
  
    if (!senderUsername || !receiverUsername) {
      return res.status(400).json({ error: 'Both senderUsername and receiverUsername are required.' });
    }
  
    // If the user is viewing their own profile, return a default status.
    if (senderUsername === receiverUsername) {
      return res.json({ status: 'self' });
    }
  
    try {
      // 1. Fetch the two users' IDs
      const [users] = await db.execute(
        'SELECT id, username FROM users WHERE username IN (?, ?)',
        [senderUsername, receiverUsername]
      );
  
      if (users.length < 2) {
        return res.status(404).json({ error: 'One or both users not found.' });
      }
  
      const sender = users.find(u => u.username === senderUsername);
      const receiver = users.find(u => u.username === receiverUsername);
  
      // 2. Check if they are already friends
      const [friends] = await db.execute(
        `SELECT * FROM friends
         WHERE (user_id = ? AND friend_id = ?)
            OR (user_id = ? AND friend_id = ?)`,
        [sender.id, receiver.id, receiver.id, sender.id]
      );
      if (friends.length > 0) {
        return res.json({ status: 'alreadyFriends' });
      }
  
      // 3. Check if a friend request is pending (or any other status)
      const [requests] = await db.execute(
        `SELECT status
           FROM friend_requests
          WHERE sender_id = ? AND receiver_id = ?`,
        [sender.id, receiver.id]
      );
  
      if (requests.length > 0) {
        return res.json({ status: requests[0].status }); // e.g., 'pending'
      }
  
      // No relationship found
      return res.json({ status: 'none' });
    } catch (error) {
      console.error('Error fetching friend status:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  
  app.post('/api/cancelFriendRequest', async (req, res) => {
    const { senderUsername, receiverUsername } = req.body;
  
    if (!senderUsername || !receiverUsername) {
      return res.status(400).json({ error: 'Both senderUsername and receiverUsername are required.' });
    }
  
    try {
      // 1. Get the IDs for both users
      const [users] = await db.execute(
        'SELECT id, username FROM users WHERE username IN (?, ?)',
        [senderUsername, receiverUsername]
      );
  
      if (users.length < 2) {
        return res.status(404).json({ error: 'One or both users not found.' });
      }
  
      const sender = users.find(u => u.username === senderUsername);
      const receiver = users.find(u => u.username === receiverUsername);
  
      // 2. Find the pending friend request from sender to receiver
      const [requests] = await db.execute(
        'SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = "pending"',
        [sender.id, receiver.id]
      );
  
      if (requests.length === 0) {
        return res.status(404).json({ error: 'No pending friend request found.' });
      }
  
      // 3. Cancel the request (delete it from the table)
      await db.execute(
        'DELETE FROM friend_requests WHERE id = ?',
        [requests[0].id]
      );
  
      // Optionally, you might also want to clear any cached friend request data.
      cache.del(`friendRequests_${receiver.id}`);
  
      res.status(200).json({ message: 'Friend request cancelled successfully.' });
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  

// Start Server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
