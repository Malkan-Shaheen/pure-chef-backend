const Recipe = require('../models/Recipe');

exports.saveRecipe = async (req, res) => {
    try {
        console.log("💾 Saving recipe to Cookbook...");
        const newRecipe = new Recipe({
            ...req.body,
            userId: req.user.userId
        });
        await newRecipe.save();
        console.log("✅ Recipe saved successfully!");
        res.status(201).json({ success: true, message: "Saved to Cookbook!" });
    } catch (error) {
        console.error("❌ Failed to save recipe:", error);
        res.status(500).json({ error: "Failed to save recipe to the database." });
    }
};

exports.getRecipes = async (req, res) => {
    try {
        console.log("📖 Opening Cookbook...");
        const recipes = await Recipe.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, recipes });
    } catch (error) {
        console.error("❌ Failed to fetch recipes:", error);
        res.status(500).json({ error: "Failed to load cookbook." });
    }
};

exports.deleteRecipe = async (req, res) => {
    try {
        console.log(`🗑️ Deleting recipe ${req.params.id}...`);
        const result = await Recipe.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
        if (!result) {
            return res.status(404).json({ error: "Recipe not found or not authorized." });
        }
        console.log("✅ Recipe deleted successfully!");
        res.status(200).json({ success: true, message: "Recipe deleted!" });
    } catch (error) {
        console.error("❌ Failed to delete recipe:", error);
        res.status(500).json({ error: "Failed to delete recipe." });
    }
};
