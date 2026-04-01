const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create-payment-intent', authMiddleware, stripeController.createPaymentIntent);

// Auth REQUIRED to update a specific user's status in the DB
router.post('/upgrade-status', authMiddleware, stripeController.upgradeStatus);

module.exports = router;
