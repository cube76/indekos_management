const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkOverdueAndNotify } = require('../cron/reminders');

// Trigger Reminders (Manual Test)
router.post('/trigger', authenticateToken, async (req, res) => {
    console.log('Manual trigger of payment reminders...');
    await checkOverdueAndNotify(true);
    res.send('Reminders triggered. Check server logs.');
});

// Subscribe Route
router.post('/subscribe', authenticateToken, async (req, res) => {
  const subscription = req.body;
  const userId = req.user.id; // From authenticateToken

  if (!subscription || !subscription.endpoint) {
    return res.status(400).send('Invalid subscription object');
  }

  try {
    // Check if subscription exists for this user/endpoint to avoid duplicates
    const [existing] = await db.query(
        'SELECT * FROM push_subscriptions WHERE endpoint = ?', 
        [subscription.endpoint]
    );

    if (existing.length === 0) {
        await db.query(
            'INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)',
            [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
        );
        res.status(201).json({});
    } else {
        // Update user_id if changed? Or just ignore.
        res.status(200).json({});
    }
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Helper to get VAPID Public Key (Optional, but good for FE to fetch)
router.get('/vapid-key', authenticateToken, (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

module.exports = router;
