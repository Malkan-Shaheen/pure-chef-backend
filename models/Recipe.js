const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
    title: String,
    description: String,
    time: String,
    prepTime: String,
    calories: mongoose.Schema.Types.Mixed,
    protein: String,
    carbs: String,
    ingredients: Array,
    instructions: Array,
    imageUrl: String,
    nutrition_total: { calories: Number, protein_g: Number, carbs_g: Number, fat_g: Number },
    nutrition_per_serving: { calories: Number, protein_g: Number, carbs_g: Number, fat_g: Number },
    servings_count: { type: Number, default: 4 },
    nutrition_source: String,
    is_estimated: { type: Boolean, default: true },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Recipe', recipeSchema);