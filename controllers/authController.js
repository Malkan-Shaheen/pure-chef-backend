const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../services/emailService');

exports.signup = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters." });
        }
        
        const secret = process.env.JWT_SECRET || 'pure-chef-backend-jwt-token-new-string';

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ userId: user._id }, secret, { expiresIn: '365d' });
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

        const secret = process.env.JWT_SECRET || 'pure-chef-backend-jwt-token-new-string';

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const token = jwt.sign({ userId: user._id }, secret, { expiresIn: '365d' });
        res.status(200).json({ success: true, message: "Login successful!", token });
    } catch (error) {
        console.error("❌ [login] Error:", error.message || error);
        if (error.message?.includes('MongoServerSelectionError') || error.message?.includes('connect')) {
            return res.status(503).json({ error: "Database unavailable. Please try again later." });
        }
        res.status(500).json({ error: "Failed to log in." });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // --- DAILY LIMIT RESET CHECK ---
        const now = new Date();
        const lastGen = user.lastGenerationDate;
        let needsSave = false;

        if (lastGen) {
            const isSameDay = now.getFullYear() === lastGen.getFullYear() &&
                              now.getMonth() === lastGen.getMonth() &&
                              now.getDate() === lastGen.getDate();
            if (!isSameDay && user.generationsToday > 0) {
                user.generationsToday = 0;
                needsSave = true;
            }
        }

        // --- LOCALHOST WEBHOOK BYPASS & SYNC ---
        // If webhooks aren't hitting localhost, safely ask Stripe directly on app launch
        if (user.stripeSubscriptionId) {
            try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'fake');
                const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
                
                const shouldBePro = (sub.status === 'trialing' || sub.status === 'active');
                if (user.subscriptionStatus !== sub.status || user.isPro !== shouldBePro) {
                    user.subscriptionStatus = sub.status;
                    user.isPro = shouldBePro;
                    needsSave = true;
                }
            } catch (err) {
                console.error("Local sync error:", err.message);
            }
        }
        
        if (needsSave) {
            await user.save();
        }
        // ----------------------------------------

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                profileImage: user.profileImage,
                isPro: user.isPro ?? false,
                generationsToday: user.generationsToday ?? 0,
                lifetimeGenerations: user.lifetimeGenerations ?? 0
            }
        });
    } catch (error) {
        console.error("❌ [getProfile] Error:", error.message || error);
        res.status(500).json({ error: "Failed to fetch profile." });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, profileImage } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (profileImage !== undefined) updateData.profileImage = profileImage;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found." });
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully!",
            user: {
                id: updatedUser._id,
                email: updatedUser.email,
                name: updatedUser.name,
                profileImage: updatedUser.profileImage
            }
        });
    } catch (error) {
        console.error("❌ [updateProfile] Error:", error.message || error);
        res.status(500).json({ error: "Failed to update profile." });
    }
};

// ── Forgot Password: send OTP ─────────────────────────────
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'No account found with this email.' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.otpCode = otp;
        user.otpExpiry = expiry;
        await user.save();

        await sendOtpEmail(email, otp);

        res.status(200).json({ success: true, message: 'OTP sent to your email.' });
    } catch (error) {
        console.error('❌ [forgotPassword] Error:', error.message || error);
        res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
};

// ── Verify OTP ────────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body || {};
        if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

        const user = await User.findOne({ email });
        if (!user || !user.otpCode) return res.status(400).json({ error: 'Invalid or expired OTP.' });
        if (new Date() > user.otpExpiry) return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        if (user.otpCode !== otp) return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });

        res.status(200).json({ success: true, message: 'OTP verified.' });
    } catch (error) {
        console.error('❌ [verifyOtp] Error:', error.message || error);
        res.status(500).json({ error: 'Failed to verify OTP.' });
    }
};

// ── Reset Password ────────────────────────────────────────
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body || {};
        if (!email || !otp || !newPassword) return res.status(400).json({ error: 'Email, OTP and new password are required.' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

        const user = await User.findOne({ email });
        if (!user || !user.otpCode) return res.status(400).json({ error: 'Invalid or expired OTP.' });
        if (new Date() > user.otpExpiry) return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        if (user.otpCode !== otp) return res.status(400).json({ error: 'Incorrect OTP.' });

        user.password = await bcrypt.hash(newPassword, 10);
        user.otpCode = null;
        user.otpExpiry = null;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
        console.error('❌ [resetPassword] Error:', error.message || error);
        res.status(500).json({ error: 'Failed to reset password.' });
    }
};
