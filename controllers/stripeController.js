const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'fake_key_for_startup');
const User = require('../models/User');

exports.createPaymentIntent = async (req, res) => {
    try {
        const { planType } = req.body;
        const userId = req.user?.userId;

        let amount;
        if (planType === 'yearly') {
            amount = 5900; 
        } else if (planType === 'monthly') {
            amount = 799;  
        } else {
            return res.status(400).json({ success: false, message: 'Valid planType (yearly, monthly) is required' });
        }

        const params = {
            amount: amount,
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
        };

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

exports.createSubscription = async (req, res) => {
    try {
        const { planType } = req.body; // 'monthly' or 'yearly'
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        let priceId;
        if (planType === 'yearly') {
            priceId = process.env.STRIPE_PRICE_YEARLY;
        } else if (planType === 'monthly') {
            priceId = process.env.STRIPE_PRICE_MONTHLY;
        } else {
            return res.status(400).json({ success: false, message: 'Valid planType (yearly, monthly) is required' });
        }

        if (!priceId) {
            // Dynamically auto-configure Stripe Products for testing!
            const amount = planType === 'yearly' ? 5900 : 799;
            const interval = planType === 'yearly' ? 'year' : 'month';
            
            const existingPrices = await stripe.prices.list({ active: true, limit: 100 });
            const foundPrice = existingPrices.data.find(p => p.unit_amount === amount && p.recurring?.interval === interval);
            
            if (foundPrice) {
                priceId = foundPrice.id;
            } else {
                console.log(`Creating dynamic Stripe Product/Price for ${planType}...`);
                const product = await stripe.products.create({
                    name: `Pure Chef Pro ${planType === 'yearly' ? 'Yearly' : 'Monthly'}`,
                });
                const price = await stripe.prices.create({
                    product: product.id,
                    unit_amount: amount,
                    currency: 'usd',
                    recurring: { interval: interval },
                });
                priceId = price.id;
            }
        }

        // 1. Get or Create Stripe Customer
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
                metadata: { userId: user._id.toString() }
            });
            customerId = customer.id;
            user.stripeCustomerId = customerId;
            await user.save();
        }

        // 2. Create the Subscription (with 3-day trial)
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
            trial_period_days: 3,
            metadata: { userId: user._id.toString() }
        });

        // Optimistically save the subscription ID to database so getProfile can query Stripe directly
        user.stripeSubscriptionId = subscription.id;
        user.subscriptionStatus = subscription.status; // 'trialing', 'incomplete', etc
        user.isPro = (subscription.status === 'trialing' || subscription.status === 'active');
        await user.save();

        const clientSecret = subscription.pending_setup_intent?.client_secret || 
                             subscription.latest_invoice?.payment_intent?.client_secret;

        res.json({
            success: true,
            subscriptionId: subscription.id,
            clientSecret: clientSecret,
        });

    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.cancelSubscription = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const user = await User.findById(userId);

        if (!user || !user.stripeSubscriptionId) {
            return res.status(400).json({ success: false, message: 'No active subscription found' });
        }

        const subscription = await stripe.subscriptions.cancel(user.stripeSubscriptionId);

        user.subscriptionStatus = subscription.status; // 'canceled'
        user.isPro = false;
        await user.save();

        res.json({ success: true, message: 'Subscription canceled successfully' });
    } catch (error) {
        console.error('Error canceling subscription:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        if (!endpointSecret) {
            console.log('⚠️  STRIPE_WEBHOOK_SECRET missing, parsing raw body directly structure (unsecure test mode)');
            event = JSON.parse(req.body.toString());
        } else {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        }
    } catch (err) {
        console.error('⚠️  Webhook verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                
                const user = await User.findOne({ stripeCustomerId: customerId });
                if (user) {
                    user.stripeSubscriptionId = subscription.id;
                    user.subscriptionStatus = subscription.status;
                    
                    if (subscription.status === 'trialing') {
                        user.isPro = true;
                        if (subscription.trial_start && subscription.trial_end) {
                            user.trialStartDate = new Date(subscription.trial_start * 1000);
                            user.trialEndDate = new Date(subscription.trial_end * 1000);
                        }
                    } else if (subscription.status === 'active') {
                        user.isPro = true;
                    } else {
                        user.isPro = false;
                    }
                    await user.save();
                    console.log(`✅ Webhook: Subscription ${subscription.id} sync: User ${user._id} status=${subscription.status}`);
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                const user = await User.findOne({ stripeCustomerId: customerId });
                if (user) {
                    user.stripeSubscriptionId = null;
                    user.subscriptionStatus = 'canceled';
                    user.isPro = false;
                    await user.save();
                    console.log(`❌ Webhook: Subscription canceled for user ${user._id}`);
                }
                break;
            }
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                if (invoice.subscription) {
                    const user = await User.findOne({ stripeCustomerId: invoice.customer });
                    if (user && invoice.amount_paid > 0) {
                        user.subscriptionStatus = 'active';
                        user.isPro = true;
                        await user.save();
                        console.log(`✅ Webhook: Invoice payment succeeded for user ${user._id}`);
                    }
                }
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                if (invoice.subscription) {
                    const user = await User.findOne({ stripeCustomerId: invoice.customer });
                    if (user) {
                        user.subscriptionStatus = 'past_due';
                        user.isPro = false;
                        await user.save();
                        console.log(`❌ Webhook: Invoice payment failed for user ${user._id}`);
                    }
                }
                break;
            }
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                const userId = paymentIntent.metadata?.userId;
                if (userId && !paymentIntent.invoice) {
                    await User.findByIdAndUpdate(userId, { isPro: true, subscriptionStatus: 'active' });
                    console.log(`✅ Webhook: legacy PaymentIntent for User ${userId} succeeded.`);
                }
                break;
            }
            default:
                console.log(`ℹ️  Webhook: Unhandled event type ${event.type}`);
        }
    } catch (err) {
        console.error('Webhook DB Error:', err);
    }

    res.json({ received: true });
};
