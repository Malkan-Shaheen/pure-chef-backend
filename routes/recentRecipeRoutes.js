const express = require('express');
const router = express.Router();
const recentRecipeController = require('../controllers/recentRecipeController');
const authMiddleware = require('../middleware/authMiddleware');

// Protect all recent recipe routes
router.use(authMiddleware);

router.post('/', recentRecipeController.recordView);
router.get('/', recentRecipeController.getRecentRecipes);

module.exports = router;
