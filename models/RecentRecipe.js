const mongoose = require('mongoose');

const recentRecipeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    recipe: {
        title: { type: String, required: true },
        description: { type: String, default: '' },
        time: { type: String, default: 'N/A' },
        calories: { type: String, default: 'N/A' },
        protein: { type: String, default: 'N/A' },
        carbs: { type: String, default: 'N/A' },
        imageUrl: { type: String, default: null },
        ingredients: { type: Array, default: [] },
        instructions: { type: Array, default: [] },
    },
    viewedAt: {
        type: Date,
        default: Date.now,
    },
});

// Each user can only have one entry per recipe title
recentRecipeSchema.index({ userId: 1, 'recipe.title': 1 }, { unique: true });

// TTL index to automatically delete records older than 48 hours (172800 seconds)
recentRecipeSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model('RecentRecipe', recentRecipeSchema);
