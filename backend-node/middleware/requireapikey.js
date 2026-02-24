// middleware/requireApiKey.js

const requireApiKey = (req, res, next) => {
    // 1. Grab the key from the incoming request headers
    const providedKey = req.header('x-api-key');

    // 2. Grab the expected key from your Mediconnect environment variables
    const expectedKey = process.env.EXPECTED_HOSPITAL_API_KEY;

    // 3. Check if the key is missing or incorrect
    if (!providedKey) {
        return res.status(401).json({ error: 'Access denied. No API key provided.' });
    }

    if (providedKey !== expectedKey) {
        return res.status(403).json({ error: 'Access denied. Invalid API key.' });
    }

    // 4. If the key matches, move on to the actual route handler
    next();
};

module.exports = requireApiKey;