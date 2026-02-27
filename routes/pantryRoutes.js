const express = require('express');
const router = express.Router();
const pantryController = require('../controllers/pantryController');
const authMiddleware = require('../middleware/authMiddleware');

// Protect all pantry routes
router.use(authMiddleware);

router.get('/', pantryController.getPantry);
router.post('/', pantryController.addToPantry);
router.delete('/:id', pantryController.deleteFromPantry);

module.exports = router;
