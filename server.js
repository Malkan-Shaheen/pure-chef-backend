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

// Mount the routes to the Express app
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/pantry', pantryRoutes);

// ─────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────
app.listen(port, () => {
    console.log(`🚀 PureChef Kitchen is open and listening on port ${port}`);
});