const User = require('../models/User');

const DAILY_LIMIT = 3;
const LIFETIME_LIMIT = 10;

module.exports = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized', code: 'unauthorized' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found', code: 'user_not_found' });
        }

        // If user is Pro or has active/trialing subscription, allow unlimited generations
        if (user.isPro || user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') {
            return next();
        }

        // Free user path
        // Check lifetime limit
        if (user.lifetimeGenerations >= LIFETIME_LIMIT) {
            return res.status(403).json({ 
                success: false, 
                error: 'Lifetime free limit reached. Please upgrade to Pro for unlimited recipes.',
                code: 'upgrade_required_lifetime'
            });
        }

        // Check daily limit resetting
        const now = new Date();
        const lastGen = user.lastGenerationDate;
        
        if (lastGen) {
            const isSameDay = now.getFullYear() === lastGen.getFullYear() &&
                              now.getMonth() === lastGen.getMonth() &&
                              now.getDate() === lastGen.getDate();
            if (!isSameDay) {
                user.generationsToday = 0;
            }
        } else {
            user.generationsToday = 0; 
        }

        if (user.generationsToday >= DAILY_LIMIT) {
            return res.status(403).json({ 
                success: false, 
                error: 'Daily generation limit of 3 reached. Please upgrade to Pro or try again tomorrow.',
                code: 'upgrade_required_daily'
            });
        }

        // Increment and save
        user.generationsToday += 1;
        user.lifetimeGenerations += 1;
        user.lastGenerationDate = now;
        await user.save();

        next();

    } catch (error) {
        console.error("Limit Middleware Error:", error);
        res.status(500).json({ success: false, error: 'Internal server error checking usage limits', code: 'server_error' });
    }
};
