const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const authMiddleware = require('../middleware/authMiddleware');

// Protect all recipe routes
router.use(authMiddleware);

router.post('/save-recipe', recipeController.saveRecipe);
router.get('/', recipeController.getRecipes);
router.delete('/:id', recipeController.deleteRecipe);

module.exports = router;
