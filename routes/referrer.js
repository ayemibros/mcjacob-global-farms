const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');

// GET /api/referrer/my-stats - Dealer: my referral stats
router.get('/my-stats', authenticate, async (req, res) => {
  try {
    const [referrals] = await db.query(
      `SELECT r.*, u.full_name, u.email, u.created_at as joined_at, u.total_orders, u.total_spent
       FROM referrals r JOIN users u ON r.referred_id=u.id WHERE r.referrer_id=?`,
      [req.user.id]
    );
    const [[{ my_code }]] = await db.query('SELECT my_referral_code as my_code FROM users WHERE id=?', [req.user.id]);
    const total_referred = referrals.length;
    const total_commission = referrals.reduce((sum, r) => sum + parseFloat(r.total_commission || 0), 0);

    res.json({ success: true, my_referral_code: my_code, total_referred, total_commission, referrals });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/referrer/all - Admin: all referral data
router.get('/all', authenticate, adminOnly, async (req, res) => {
  try {
    const [data] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.my_referral_code,
       COUNT(r.id) as total_referred,
       COALESCE(SUM(r.total_commission),0) as total_commission
       FROM users u LEFT JOIN referrals r ON u.id=r.referrer_id
       WHERE u.role='dealer' GROUP BY u.id ORDER BY total_referred DESC`
    );
    res.json({ success: true, referrers: data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/referrer/validate/:code - Public: validate referral code
router.get('/validate/:code', async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT full_name, business_name FROM users WHERE my_referral_code=? AND status="active"',
      [req.params.code.toUpperCase()]
    );
    if (users.length === 0) return res.json({ success: false, message: 'Invalid referral code.' });
    res.json({ success: true, referrer: users[0].business_name || users[0].full_name });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
