const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
    title: String,
    description: String,
    time: String,
    calories: String,
    protein: String,
    carbs: String,
    ingredients: Array,
    instructions: Array,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Recipe', recipeSchema);