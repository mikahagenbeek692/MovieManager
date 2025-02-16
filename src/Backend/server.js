const jwt = require('jsonwebtoken');
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const NodeCache = require('node-cache');

const SECRET_KEY = 'your_secret_key';
const app = express();
const port = 5000;
const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 }); // Cache expires in 5 minutes

// CORS configuration
const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,
};

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors(corsOptions));

// MySQL connection pool
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'PASSWORD',
    database: 'projectapi',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
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

app.get('/home', authenticateToken, (req, res) => {
    res.status(200).json({ message: `Welcome, ${req.user.username}!` });
});

app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });
});

app.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    try {
        const [results] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (results.length > 0) {
            return res.status(400).json({ message: 'Username or Email already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)', [username, hashedPassword, email]);
        res.status(200).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

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

// ✅ POST route for login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [results] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (results.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = results[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ message: 'Invalid username or password' });

        const token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
        });

        console.log(`🔑 Token generated for ${username}`);

        res.status(200).json({ message: 'Login successful' });
    } catch (err) {
        res.status(500).json({ message: 'Database error' });
    }
});

// ✅ GET Watchlist
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


// ✅ Save Watchlist
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

            // 🚀 Fetch Movie Genres to Determine Favorite Genres
            const movieIds = movieTitles.map(movie => movie.id);
            const [moviesData] = await connection.query(
                `SELECT id, genre FROM movies WHERE id IN (?)`, [movieIds]
            );

            // 🚀 Count Genres Only for Watched Movies
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

        // 🚀 Update User's Favorite Genres
        await connection.query(
            'UPDATE users SET favorite_genres = ? WHERE id = ?',
            [favoriteGenres, userId]
        );

        await connection.commit();

        // 🚀 Invalidate Cache
        cache.del(`watchlist_${username}`);
        cache.del(`favorite_genres_${username}`);
        cache.del(`usersWithWatchlists`);  // 🔥 Invalidates all watchlists!

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






// ✅ Fetch Friends List
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


// ✅ Fetch Users With Watchlists
app.get('/api/users', async (req, res) => {
    try {
        // ✅ Check Cache First
        let cachedData = cache.get('all_users');
        if (cachedData) {
            console.log(`✅ Serving all users from cache`);
            return res.status(200).json(cachedData);
        }

        // ✅ Fetch fresh data if not cached
        const [results] = await db.query(
            `SELECT id AS user_id, username, email, favorite_genres, BIO
             FROM users`
        );

        // ✅ Format response
        const allUsers = results.map(user => ({
            id: user.user_id,
            username: user.username,
            email: user.email,
            favoriteGenres: user.favorite_genres || "",
            bio: user.BIO || "This user has no description yet"
        }));

        // ✅ Store in cache for next requests
        cache.set('all_users', allUsers);
        console.log("🔄 Cached all users for 5 minutes");

        res.status(200).json(allUsers);
    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ message: 'Database error' });
    }
});




// ✅ Update Watchlist Privacy
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

        // **✅ Invalidate Cache** (Force refresh of public users)
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
        // ✅ Fetch user ID based on username
        const [userResult] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (userResult.length === 0) return res.status(404).json({ error: 'User not found.' });

        const userId = userResult[0].id;

        // ✅ Fetch pending friend requests (including sender's username)
        const [friendRequests] = await db.execute(
            `SELECT fr.id AS request_id, u.id AS sender_id, u.username AS sender_username 
             FROM friend_requests fr
             JOIN users u ON fr.sender_id = u.id
             WHERE fr.receiver_id = ? AND fr.status = 'pending'`,
            [userId]
        );

        // ✅ Ensure username is included
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

    if (senderUsername === receiverUsername) {
        return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
    }

    try {
        // Check if both users exist
        const users = await getFromCacheOrDB(
            `users_${senderUsername}_${receiverUsername}`,
            'SELECT id, username FROM users WHERE username IN (?, ?)',
            [senderUsername, receiverUsername]
        );

        if (users.length !== 2) {
            return res.status(404).json({ error: 'One or both users not found.' });
        }

        const sender = users.find(user => user.username === senderUsername);
        const receiver = users.find(user => user.username === receiverUsername);

        // Check if they are already friends
        const existingFriend = await db.execute(
            `SELECT * FROM friends WHERE 
             (user_id = ? AND friend_id = ?) OR 
             (user_id = ? AND friend_id = ?)`,
            [sender.id, receiver.id, receiver.id, sender.id]
        );

        if (existingFriend[0].length > 0) {
            return res.status(400).json({ error: 'You are already friends with this user.' });
        }

        // Check if a friend request already exists
        const existingRequest = await db.execute(
            'SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ?',
            [sender.id, receiver.id]
        );

        if (existingRequest[0].length > 0) {
            return res.status(400).json({ error: 'Friend request already sent.' });
        }

        // Insert a new friend request
        await db.execute(
            'INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)',
            [sender.id, receiver.id]
        );

        // Invalidate the friend requests cache for the receiver
        cache.del(`friendRequests_${receiver.id}`);

        res.status(200).json({ message: 'Friend request sent successfully.' });
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

        // ✅ Send response back to frontend
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


// Start Server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
