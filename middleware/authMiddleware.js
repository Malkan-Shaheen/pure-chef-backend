const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    try {
        const secret = process.env.JWT_SECRET || 'pure-chef-backend-jwt-token-new-string';
        const decoded = jwt.verify(token, secret);
        req.user = decoded; // { userId: '...' }
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token.' });
    }
};
