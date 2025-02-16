const jwt = require('jsonwebtoken');
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const csrf = require('csurf');
const sanitizeHtml = require("sanitize-html");
const Joi = require("joi");
const helmet = require('helmet');
const multer = require("multer");

const SECRET_KEY = 'your_secret_key';
const app = express();
const port = 5000;

// 🛡️ Security: CORS Configuration
const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,
};
app.use(cors(corsOptions));

// 🛡️ Security: Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(helmet()); // Protect against common vulnerabilities

// 🛡️ Security: CSRF Protection
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// 🛡️ Security: Rate Limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts
    message: "Too many login attempts. Try again later."
});

// 🛡️ Security: Logger
const logger = winston.createLogger({
    transports: [
        new winston.transports.File({ filename: "security.log" })
    ]
});

// 🛡️ Security: Database Connection
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'WalramD1!',
    database: 'projectapi',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// 🛡️ Security: Authentication Middleware
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

// ✅ Home Route (Fix 404)
app.get('/home', authenticateToken, (req, res) => {
    res.status(200).json({ message: `Welcome, ${req.user.username}!` });
});


// ✅ API to Check Authentication Status
app.get('/api/checkAuth', authenticateToken, (req, res) => {
    res.status(200).json({ message: "User is authenticated", user: req.user });
});


// 🛡️ Security: Input Validation Schema
const userSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
});

// 🛡️ Security: File Upload Configuration (Only images)
const upload = multer({
    limits: { fileSize: 2 * 1024 * 1024 },  // Max 2MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only images are allowed!"), false);
        }
        cb(null, true);
    }
});

// ✅ User Registration
app.post('/register', async (req, res) => {
    const { error } = userSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

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

// ✅ Login with Rate Limiting
app.post('/login', loginLimiter, async (req, res) => {
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
            sameSite: 'Strict',
        });

        logger.info(`🔑 Login successful for ${username}`);
        res.status(200).json({ message: 'Login successful' });
    } catch (err) {
        res.status(500).json({ message: 'Database error' });
    }
});

// ✅ Secure Profile Update with Sanitization
app.post('/api/updateProfileDescription', async (req, res) => {
    console.log("📨 Received update request:", req.body);

    const { username, description } = req.body;

    if (!username || !description) {
        return res.status(400).json({ error: "Username and description are required" });
    }

    // Sanitize input
    const sanitizedDescription = sanitizeHtml(description);

    try {
        const [result] = await db.execute(
            "UPDATE users SET BIO = ? WHERE username = ?",
            [sanitizedDescription, username]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "User not found or no changes made" });
        }

        console.log("🚀 Sending success response back to frontend...");
        return res.status(200).json({ 
            success: true, 
            message: "Profile description updated successfully!", 
            updatedDescription: sanitizedDescription 
        });

    } catch (error) {
        console.error("❌ Database execution error:", error);
        return res.status(500).json({ error: "Failed to update profile description" });
    }
});

// ✅ Logout
app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });
});

// ✅ Fetch CSRF Token
app.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// ✅ Secure File Upload Endpoint
app.post("/upload", upload.single("file"), (req, res) => {
    res.json({ message: "File uploaded successfully!" });
});

// ✅ Start Server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
