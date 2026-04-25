const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, default: '' },
    profileImage: { type: String, default: '' },
    isPro: { type: Boolean, default: false },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    subscriptionStatus: { type: String, enum: ['free', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'], default: 'free' },
    trialStartDate: { type: Date, default: null },
    trialEndDate: { type: Date, default: null },
    generationsToday: { type: Number, default: 0 },
    lastGenerationDate: { type: Date, default: null },
    lifetimeGenerations: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    otpCode: { type: String, default: null },
    otpExpiry: { type: Date, default: null }
});

module.exports = mongoose.model('User', userSchema);
