const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

        const prompt = `A high-quality, professional, minimalist overhead food photograph of ${recipeTitle}. Set on a clean kitchen counter with a soft minimalist blue background. Natural morning lighting, high resolution, aesthetic and appetizing presentation.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: "1:1"
                }
            }
        });

        // Extract image from response parts
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                // Save to disk as PNG
                const filename = `recipe-${crypto.randomUUID()}.png`;
                const filepath = path.join(imagesDir, filename);
                fs.writeFileSync(filepath, Buffer.from(part.inlineData.data, 'base64'));

                // Build public URL using the request host
                const protocol = req.protocol || 'http';
                const host = req.get('host') || 'localhost:3000';
                const imageUrl = `${protocol}://${host}/images/${filename}`;

                console.log(`✅ Image saved: ${imageUrl}`);
                return imageUrl;
            }
        }
        console.log(`⚠️ Gemini returned no image data for "${recipeTitle}"`);
        return null;
    } catch (error) {
        console.error(`⚠️ Image generation failed for "${recipeTitle}":`, error.message);
        return null;
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

        console.log(`📸 Image: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);

        const imageBase64 = req.file.buffer.toString("base64");

        const prompt = `Look at this picture of a fridge or food items and identify ALL visible food ingredients.

You MUST respond ONLY with a valid JSON object — no markdown, no backticks, no explanation.
Use this EXACT structure:
{"ingredients":["Chicken Breast","Eggs","Milk","Tomato","Lettuce","Cheese"]}

Be specific with ingredient names (e.g. "Cherry Tomatoes" not "vegetables").
Only include food items, not containers or non-food objects.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { data: imageBase64, mimeType: req.file.mimetype } }
                ]
            }]
        });

        const rawText = response.text;
        console.log("🤖 Gemini raw response:", rawText);

        let cleanText = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleanText);

        console.log("✅ Detected ingredients:", parsed.ingredients);
        res.status(200).json({ success: true, ingredients: parsed.ingredients || [] });

    } catch (error) {
        console.error("❌ [detect-ingredients] Error:", error.message || error);
        res.status(500).json({ error: "Failed to detect ingredients: " + (error.message || "Unknown error") });
    }
};

exports.generateRecipes = async (req, res) => {
    try {
        console.log("🍳 [generate-recipes] Request received...");

        const userMood = req.body.mood || "hungry";
        const ingredientsList = req.body.ingredients || "none";

        console.log(`📋 Mood: ${userMood}`);
        console.log(`🥕 Ingredients: ${ingredientsList}`);

        const prompt = `You are a creative chef AI. Based on the following information, recommend 3 unique and delicious dishes.

Available Ingredients: ${ingredientsList}
User Mood / Preference: ${userMood}

You MUST respond ONLY with a valid JSON array — no markdown, no backticks, no explanation.
Return exactly 3 recipe objects with this EXACT structure:
[
  {
    "title": "Dish Name",
    "description": "A short catchy 1-line description",
    "time": "20 mins",
    "calories": "450 kcal",
    "protein": "35g",
    "carbs": "10g",
    "match": "Perfect Match",
    "ingredients": [
      {"name": "Salmon Fillets", "amount": "2 portions (200g each)"},
      {"name": "Fresh Lemon", "amount": "1 large"}
    ],
    "instructions": [
      "Preheat oven to 400°F (200°C).",
      "Season the fillets with salt and pepper.",
      "Bake for 12-15 minutes until flaky."
    ]
  }
]`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const rawText = response.text;
        let cleanText = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        let recipeArray = JSON.parse(cleanText);

        // Generate AI food images and save as static files
        console.log("🎨 Generating food images with Gemini...");
        recipeArray = await attachImagesToRecipes(recipeArray, req);

        console.log(`✅ Generated ${recipeArray.length} recipes with AI images!`);
        res.status(200).json({ success: true, recipes: recipeArray });

    } catch (error) {
        console.error("❌ [generate-recipes] Error:", error.message || error);
        res.status(500).json({ error: "Failed to generate recipes: " + (error.message || "Unknown error") });
    }
};

exports.analyzeFridge = async (req, res) => {
    try {
        console.log("🔔 [analyze-fridge] Request received...");

        if (!req.file) {
            return res.status(400).json({ error: "No fridge picture uploaded!" });
        }

        const userMood = req.body.mood || "hungry";
        const manualIngredients = req.body.ingredients || "none";
        const imageBase64 = req.file.buffer.toString("base64");

        const prompt = `Look at this picture of a fridge and identify the ingredients. 
User Mood: ${userMood}. Manual Ingredients: ${manualIngredients}.

Recommend 3 dishes. You MUST respond ONLY with a valid JSON array — no markdown, no backticks, no explanation.
Return exactly 3 objects with this EXACT structure:
[
  {
    "title": "Dish Name",
    "description": "Short catchy description",
    "time": "20 mins",
    "calories": "450 kcal",
    "protein": "35g",
    "carbs": "10g",
    "match": "Perfect Match",
    "ingredients": [
      {"name": "Salmon Fillets", "amount": "2 portions"},
      {"name": "Fresh Lemon", "amount": "1 large"}
    ],
    "instructions": [
      "Preheat oven to 400°F...",
      "Season the fillets...",
      "Bake for 12-15 minutes..."
    ]
  }
]`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { data: imageBase64, mimeType: req.file.mimetype } }
                ]
            }]
        });

        let cleanText = response.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        let recipeArray = JSON.parse(cleanText);

        // Generate AI food images and save as static files
        console.log("🎨 Generating food images with Gemini...");
        recipeArray = await attachImagesToRecipes(recipeArray, req);

        console.log(`✅ Generated ${recipeArray.length} recipes from fridge with AI images!`);
        res.status(200).json({ success: true, recipes: recipeArray });

    } catch (error) {
        console.error("❌ [analyze-fridge] Error:", error.message || error);
        res.status(500).json({ error: "Something went wrong: " + (error.message || "Unknown error") });
    }
};
