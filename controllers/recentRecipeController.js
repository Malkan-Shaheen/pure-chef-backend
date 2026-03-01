const RecentRecipe = require('../models/RecentRecipe');

// POST /api/recent-recipes — record or update a recipe view
exports.recordView = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { recipe } = req.body;

        if (!recipe || !recipe.title) {
            return res.status(400).json({ error: 'Recipe with title is required.' });
        }

        console.log(`👁️ Recording view for "${recipe.title}"...`);

        const result = await RecentRecipe.findOneAndUpdate(
            { userId, 'recipe.title': recipe.title },
            { $set: { recipe, viewedAt: new Date() } },
            { upsert: true, new: true }
        );

        // Keep only the 20 most recent per user, or anything older than 48 hours manually
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        await RecentRecipe.deleteMany({ userId, viewedAt: { $lt: twoDaysAgo } });

        const count = await RecentRecipe.countDocuments({ userId });
        if (count > 20) {
            const oldest = await RecentRecipe.find({ userId })
                .sort({ viewedAt: 1 })
                .limit(count - 20);
            const idsToDelete = oldest.map((doc) => doc._id);
            await RecentRecipe.deleteMany({ _id: { $in: idsToDelete } });
        }

        console.log(`✅ View recorded for "${recipe.title}"`);
        res.status(200).json({ success: true, message: 'View recorded', recentRecipe: result });
    } catch (error) {
        console.error('❌ Failed to record view:', error);
        res.status(500).json({ error: 'Failed to record recipe view.' });
    }
};

// GET /api/recent-recipes — get the user's recently viewed recipes
exports.getRecentRecipes = async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log('📋 Fetching recent recipes...');

        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const recipes = await RecentRecipe.find({ userId, viewedAt: { $gte: twoDaysAgo } })
            .sort({ viewedAt: -1 })
            .limit(10);

        console.log(`✅ Found ${recipes.length} recent recipes`);
        res.status(200).json({ success: true, recentRecipes: recipes });
    } catch (error) {
        console.error('❌ Failed to fetch recent recipes:', error);
        res.status(500).json({ error: 'Failed to load recent recipes.' });
    }
};
