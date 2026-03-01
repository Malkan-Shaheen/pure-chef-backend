require('dotenv').config();
const dns = require('dns');
// Fix for Node.js 17+ randomly failing to connect to MongoDB Atlas because of IPv6 DNS preference issues locally
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const pantryRoutes = require('./routes/pantryRoutes');
const recentRecipeRoutes = require('./routes/recentRecipeRoutes');

// ──────────────────────────────────────────────────
// SET UP
// ──────────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 3001;

// MongoDB
console.log("🔍 Checking the safe for the MongoDB Key...");
if (process.env.MONGO_URI) {
    console.log("✅ Key found! Attempting to drive to the Cloud Pantry...");
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("🔌 Connected to the Pantry (MongoDB)"))
        .catch(err => console.error("❌ MongoDB Connection Error:", err.message));
} else {
    console.log("❌ FATAL ERROR: The MONGO_URI key is completely missing from .env!");
}

const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim().replace(/\/$/, ''))
    : ['http://localhost:3000'];
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        if (origin.endsWith('.vercel.app')) return cb(null, true);
        cb(null, false);
    },
    credentials: true,
    optionsSuccessStatus: 200
}));
// Increase JSON payload limit for Base64 Profile Images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve generated recipe images as static files
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Health check (no DB required)
app.get('/api/health', (req, res) => {
    res.json({ ok: true, mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Debug endpoint to verify environment variables exist on Railway
app.get('/api/debug', (req, res) => {
    res.json({
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '✅ Set (' + process.env.GEMINI_API_KEY.substring(0, 8) + '...)' : '❌ MISSING',
        MONGO_URI: process.env.MONGO_URI ? '✅ Set' : '❌ MISSING',
        JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ MISSING',
        CORS_ORIGIN: process.env.CORS_ORIGIN || '(not set, using default)',
        NODE_ENV: process.env.NODE_ENV || '(not set)',
        PORT: process.env.PORT || '3001 (default)',
    });
});

// Mount the routes to the Express app
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/pantry', pantryRoutes);
app.use('/api/recent-recipes', recentRecipeRoutes);

if (!process.env.JWT_SECRET) {
    console.error("❌ FATAL: JWT_SECRET is missing! Set it in Railway env vars.");
}

// ─────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 PureChef Kitchen is open and listening on port ${port}`);
});

// Graceful shutdown (Railway sends SIGTERM on restart)
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        mongoose.connection.close(false, () => {
            console.log('Closed.');
            process.exit(0);
        });
    });
});

// Graceful shutdown on Ctrl+C (SIGINT)
process.on('SIGINT', () => {
    console.log('SIGINT (Ctrl+C) received, shutting down gracefully...');
    server.close(() => {
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed.');
            process.exit(0);
        });
    });
});

// Prevent crashes from uncaught errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at:', p, 'reason:', reason);
});