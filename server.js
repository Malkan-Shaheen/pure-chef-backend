require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const pantryRoutes = require('./routes/pantryRoutes');

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
app.use(express.json());

// Health check (no DB required)
app.get('/api/health', (req, res) => {
    res.json({ ok: true, mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Mount the routes to the Express app
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/pantry', pantryRoutes);

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

// Prevent crashes from uncaught errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at:', p, 'reason:', reason);
});