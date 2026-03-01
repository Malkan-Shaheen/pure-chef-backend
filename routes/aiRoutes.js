const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

// Setup memory storage for image parsing (needed for fridge photos)
const upload = multer({ storage: multer.memoryStorage() });

router.post('/detect-ingredients', authMiddleware, upload.single('fridgeImage'), aiController.detectIngredients);
router.post('/generate-recipes', authMiddleware, aiController.generateRecipes);
router.post('/analyze-fridge', authMiddleware, upload.single('fridgeImage'), aiController.analyzeFridge);

// v2 aliases (Vercel web frontend uses these)
router.post('/detect-ingredients-v2', authMiddleware, upload.single('fridgeImage'), aiController.detectIngredients);
router.post('/generate-recipes-v2', authMiddleware, aiController.generateRecipes);
router.post('/analyze-fridge-v2', authMiddleware, upload.single('fridgeImage'), aiController.analyzeFridge);

// Single image generation (used by web frontend)
router.post('/generate-recipe-image', authMiddleware, aiController.generateSingleImage);

module.exports = router;
