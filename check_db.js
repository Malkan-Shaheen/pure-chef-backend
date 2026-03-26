require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function check() {
    // Use environment variable — never hardcode credentials here
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find().sort({ createdAt: -1 }).limit(5);
    for (let u of users) {
        console.log(`Email: ${u.email}, isPro: ${u.isPro}, stripeSubId: ${u.stripeSubscriptionId}, subStatus: ${u.subscriptionStatus}`);
        if(u.stripeSubscriptionId) {
             const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
             try {
                const sub = await stripe.subscriptions.retrieve(u.stripeSubscriptionId);
                console.log(`Stripe Sub Status: ${sub.status}`);
             } catch(e) { console.log(e.message); }
        }
    }
    process.exit(0);
}
check();
