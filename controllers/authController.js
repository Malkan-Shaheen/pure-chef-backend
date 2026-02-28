const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters." });
        }
        if (!process.env.JWT_SECRET) {
            console.error("❌ JWT_SECRET not set");
            return res.status(500).json({ error: "Server misconfiguration. Please try again later." });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ success: true, message: "User created successfully!", token });
    } catch (error) {
        console.error("❌ [signup] Error:", error.message || error);
        if (error.name === 'MongoServerError' && error.code === 11000) {
            return res.status(400).json({ error: "Email already exists." });
        }
        if (error.message?.includes('MongoServerSelectionError') || error.message?.includes('connect')) {
            return res.status(503).json({ error: "Database unavailable. Please try again later." });
        }
        res.status(500).json({ error: "Failed to create user." });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }
        if (!process.env.JWT_SECRET) {
            console.error("❌ JWT_SECRET not set");
            return res.status(500).json({ error: "Server misconfiguration. Please try again later." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ success: true, message: "Login successful!", token });
    } catch (error) {
        console.error("❌ [login] Error:", error.message || error);
        if (error.message?.includes('MongoServerSelectionError') || error.message?.includes('connect')) {
            return res.status(503).json({ error: "Database unavailable. Please try again later." });
        }
        res.status(500).json({ error: "Failed to log in." });
    }
};
