const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'fake_key_for_startup');
const User = require('../models/User');

exports.createPaymentIntent = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user?.userId;

        // Ensure amount is provided
        if (!amount) {
            return res.status(400).json({ success: false, message: 'Amount is required' });
        }

        // Build PaymentIntent params
        const params = {
            amount: amount,
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
        };

        // Attach userId as metadata so the webhook knows which user to upgrade
        if (userId) {
            params.metadata = { userId };
        }

        const paymentIntent = await stripe.paymentIntents.create(params);

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.upgradeStatus = async (req, res) => {
    try {
        const userId = req.user.userId;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { isPro: true },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'User successfully upgraded to Pro!',
            user: {
                id: updatedUser._id,
                email: updatedUser.email,
                name: updatedUser.name,
                isPro: updatedUser.isPro
            }
        });
    } catch (error) {
        console.error('Error upgrading user status:', error);
        res.status(500).json({ success: false, message: 'Failed to upgrade user status' });
    }
};

// ──────────────────────────────────────────────────────
// STRIPE WEBHOOK — safety-net for payment verification
// ──────────────────────────────────────────────────────
exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('⚠️  Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            const userId = paymentIntent.metadata?.userId;
            console.log(`✅ Webhook: payment_intent.succeeded — Amount: ${paymentIntent.amount}`);

            if (userId) {
                try {
                    await User.findByIdAndUpdate(userId, { isPro: true });
                    console.log(`✅ Webhook: User ${userId} upgraded to Pro via webhook.`);
                } catch (dbErr) {
                    console.error(`❌ Webhook: Failed to upgrade user ${userId}:`, dbErr.message);
                }
            } else {
                console.log('⚠️  Webhook: payment_intent.succeeded but no userId in metadata.');
            }
            break;
        }
        case 'payment_intent.payment_failed': {
            const failedIntent = event.data.object;
            const failedUserId = failedIntent.metadata?.userId;
            console.error(`❌ Webhook: payment_intent.payment_failed — User: ${failedUserId || 'unknown'}, Reason: ${failedIntent.last_payment_error?.message || 'unknown'}`);
            break;
        }
        default:
            console.log(`ℹ️  Webhook: Unhandled event type ${event.type}`);
    }

    // Acknowledge receipt to Stripe
    res.json({ received: true });
};
