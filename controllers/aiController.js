const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Ensure the images directory exists
const imagesDir = path.join(__dirname, '..', 'public', 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log('📁 Created public/images directory');
}

// ── Helper: generate a food photo using Gemini and save as file ──
async function generateRecipeImage(recipeTitle, req) {
    try {
        console.log(`🎨 Generating image for "${recipeTitle}"...`);

        // Note: For image generation, Gemini 1.5 doesn't currently support direct image output in this exact way in all regions,
        // but we'll adapt to the standard model.generateContent flow.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `A high-quality, professional, minimalist overhead food photograph of ${recipeTitle}. Set on a clean kitchen counter with a soft minimalist blue background. Natural morning lighting, high resolution, aesthetic and appetizing presentation.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        // If the model returns image data (inlineData), we save it.
        // Otherwise, we use a placeholder.
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                const filename = `recipe-${crypto.randomUUID()}.png`;
                const filepath = path.join(imagesDir, filename);
                fs.writeFileSync(filepath, Buffer.from(part.inlineData.data, 'base64'));

                const protocol = req.protocol || 'http';
                const host = req.get('host') || 'localhost:3001';
                const imageUrl = `${protocol}://${host}/images/${filename}`;

                console.log(`✅ Image saved: ${imageUrl}`);
                return imageUrl;
            }
        }

        console.log(`⚠️ No image data returned for "${recipeTitle}", using placeholder`);
        return `https://picsum.photos/seed/${encodeURIComponent(recipeTitle)}/600/600`;
    } catch (error) {
        console.error(`⚠️ Image generation failed for "${recipeTitle}":`, error.message);
        return `https://picsum.photos/seed/${encodeURIComponent(recipeTitle)}/600/600`;
    }
}

// ── Helper: attach generated images to all recipes in parallel ──
async function attachImagesToRecipes(recipes, req) {
    const withImages = await Promise.all(
        recipes.map(async (recipe) => {
            const imageUrl = await generateRecipeImage(recipe.title, req);
            recipe.imageUrl = imageUrl;
            return recipe;
        })
    );
    return withImages;
}

exports.detectIngredients = async (req, res) => {
    try {
        console.log("🔍 [detect-ingredients] Request received...");

        if (!req.file) {
            return res.status(400).json({ error: "No fridge picture uploaded!" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const imageBase64 = req.file.buffer.toString("base64");

        const prompt = `Look at this picture of a fridge or food items and identify ALL visible food ingredients.
        You MUST respond ONLY with a valid JSON object.
        Structure: {"ingredients":["Chicken Breast","Eggs","Milk"]}
        Only include food items.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: req.file.mimetype } }
        ]);

        const response = await result.response;
        const rawText = response.text();
        console.log("🤖 Gemini raw response:", rawText);

        let cleanText = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleanText);

        res.status(200).json({ success: true, ingredients: parsed.ingredients || [] });
    } catch (error) {
        console.error("❌ [detect-ingredients] Error:", error.message || error);
        res.status(500).json({ error: "Failed to detect ingredients: " + (error.message || "Unknown error") });
    }
};

exports.generateRecipes = async (req, res) => {
    try {
        console.log("🍳 [generate-recipes] Request received...");

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const { mood, ingredients } = req.body;
        let ingredientsList = ingredients || "none";
        if (Array.isArray(ingredientsList)) {
            ingredientsList = ingredientsList.join(", ");
        }

        const prompt = `You are a creative chef AI. Recommend 3 unique dishes.
        Available Ingredients: ${ingredientsList}
        User Mood: ${mood || "hungry"}
        Respond ONLY with a valid JSON array of objects with: title, description, time, calories, protein, carbs, match, ingredients (name/amount), instructions (array).`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text();

        const cleanText = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        let recipeArray = JSON.parse(cleanText);

        console.log("🎨 Generating food images...");
        recipeArray = await attachImagesToRecipes(recipeArray, req);

        res.status(200).json({ success: true, recipes: recipeArray });
    } catch (error) {
        console.error("❌ [generate-recipes] Error:", error.message || error);
        res.status(500).json({ error: "Failed to generate recipes" });
    }
};

exports.analyzeFridge = async (req, res) => {
    try {
        console.log("🔔 [analyze-fridge] Request received...");

        if (!req.file) {
            return res.status(400).json({ error: "No fridge picture uploaded!" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const { mood, ingredients } = req.body;
        const imageBase64 = req.file.buffer.toString("base64");

        const prompt = `Identify ingredients from this fridge photo and recommend 3 dishes based on mood: ${mood || "hungry"}.
        Respond ONLY with a JSON array of 3 objects (title, description, time, calories, protein, carbs, match, ingredients, instructions).`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: req.file.mimetype } }
        ]);

        const response = await result.response;
        const cleanText = response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        let recipeArray = JSON.parse(cleanText);

        console.log("🎨 Generating food images...");
        recipeArray = await attachImagesToRecipes(recipeArray, req);

        res.status(200).json({ success: true, recipes: recipeArray });
    } catch (error) {
        console.error("❌ [analyze-fridge] Error:", error.message || error);
        res.status(500).json({ error: "Something went wrong" });
    }
};

exports.generateSingleImage = async (req, res) => {
    try {
        const { title, recipeTitle } = req.body || {};
        const recipeName = (title || recipeTitle || "").trim();
        if (!recipeName) return res.status(400).json({ error: "Missing title" });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Minimalist overhead food photo of ${recipeName}.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                return res.status(200).json({ success: true, imageUrl: `data:image/png;base64,${part.inlineData.data}` });
            }
        }

        res.status(200).json({
            success: true,
            imageUrl: `https://picsum.photos/seed/${encodeURIComponent(recipeName)}/600/600`
        });
    } catch (error) {
        console.error("❌ [generate-single-image] Error:", error.message);
        res.status(200).json({
            success: true,
            imageUrl: `https://picsum.photos/seed/fallback/600/600`
        });
    }
};

