const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

// Setup memory storage for image parsing (needed for fridge photos)
const upload = multer({ storage: multer.memoryStorage() });

router.post('/detect-ingredients', authMiddleware, upload.single('fridgeImage'), aiController.detectIngredients);
router.post('/detect-ingredients-base64', authMiddleware, aiController.detectIngredientsBase64);
router.post('/generate-recipes', authMiddleware, aiController.generateRecipes);
router.post('/generate-recipes-v2', authMiddleware, aiController.generateRecipesV2);
router.post('/generate-recipe-image', authMiddleware, aiController.generateRecipeImage);
router.post('/analyze-fridge', authMiddleware, upload.single('fridgeImage'), aiController.analyzeFridge);

module.exports = router;
