const PantryItem = require('../models/PantryItem');

exports.getPantry = async (req, res) => {
    try {
        console.log("🥫 Opening Pantry...");
        const items = await PantryItem.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, items });
    } catch (error) {
        console.error("❌ Failed to fetch pantry:", error);
        res.status(500).json({ error: "Failed to load pantry." });
    }
};

exports.addToPantry = async (req, res) => {
    try {
        console.log("📥 Adding items to Pantry...");
        const { ingredients } = req.body;

        if (!ingredients || !Array.isArray(ingredients)) {
            return res.status(400).json({ error: "Please provide an array of ingredients." });
        }

        let addedCount = 0;

        for (const name of ingredients) {
            const formattedName = name.trim();
            if (!formattedName) continue;

            const exists = await PantryItem.findOne({
                name: { $regex: new RegExp(`^${formattedName}$`, 'i') },
                userId: req.user.userId
            });
            if (!exists) {
                await PantryItem.create({
                    name: formattedName,
                    userId: req.user.userId
                });
                addedCount++;
            }
        }

        console.log(`✅ Added ${addedCount} new items to Pantry!`);
        res.status(201).json({ success: true, message: `Added ${addedCount} items to pantry.` });
    } catch (error) {
        console.error("❌ Failed to add to pantry:", error);
        res.status(500).json({ error: "Failed to save ingredients." });
    }
};

exports.deleteFromPantry = async (req, res) => {
    try {
        console.log(`🗑️ Removing item ${req.params.id} from Pantry...`);
        const result = await PantryItem.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
        if (!result) {
            return res.status(404).json({ error: "Ingredient not found or not authorized." });
        }
        console.log("✅ Ingredient removed successfully!");
        res.status(200).json({ success: true, message: "Ingredient removed!" });
    } catch (error) {
        console.error("❌ Failed to remove ingredient:", error);
        res.status(500).json({ error: "Failed to remove ingredient." });
    }
};
