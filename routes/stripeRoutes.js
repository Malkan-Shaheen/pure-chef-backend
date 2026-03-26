const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create-payment-intent', authMiddleware, stripeController.createPaymentIntent);
router.post('/create-subscription', authMiddleware, stripeController.createSubscription);
router.post('/cancel-subscription', authMiddleware, stripeController.cancelSubscription);
module.exports = router;
