const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { authenticate, adminOnly } = require('../middleware/auth');

// GET /api/admin/dealers - List all dealers
router.get('/dealers', authenticate, adminOnly, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = "SELECT id, full_name, email, phone, business_name, state, city, status, total_orders, total_spent, my_referral_code, created_at FROM users WHERE role='dealer'";
    const params = [];
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (search) { query += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    query += ' ORDER BY created_at DESC';
    const [dealers] = await db.query(query, params);
    res.json({ success: true, dealers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/admin/dealers/:id/status - Update dealer status
router.put('/dealers/:id/status', authenticate, adminOnly, async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive', 'suspended'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }
  try {
    await db.query("UPDATE users SET status=? WHERE id=? AND role='dealer'", [status, req.params.id]);
    res.json({ success: true, message: `Dealer status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/admin/dealers/:id - Get dealer details
router.get('/dealers/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const [dealers] = await db.query(
      'SELECT id, full_name, email, phone, business_name, address, state, city, status, total_orders, total_spent, my_referral_code, referrer_code, created_at FROM users WHERE id=? AND role="dealer"',
      [req.params.id]
    );
    if (dealers.length === 0) return res.status(404).json({ success: false, message: 'Dealer not found.' });

    const [orders] = await db.query('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
    const [referrals] = await db.query(
      'SELECT u.full_name, u.email, u.created_at FROM referrals r JOIN users u ON r.referred_id=u.id WHERE r.referrer_id=?',
      [req.params.id]
    );

    res.json({ success: true, dealer: dealers[0], orders, referrals });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/admin/settings - Get all settings
router.get('/settings', authenticate, adminOnly, async (req, res) => {
  try {
    const [settings] = await db.query('SELECT * FROM settings');
    const result = {};
    settings.forEach(s => result[s.setting_key] = s.setting_value);
    res.json({ success: true, settings: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/admin/settings - Update settings
router.put('/settings', authenticate, adminOnly, async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await db.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)',
        [key, value]
      );
    }
    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/admin/reports/sales - Sales report
router.get('/reports/sales', authenticate, adminOnly, async (req, res) => {
  try {
    const { period } = req.query;
    let dateFilter = '';
    if (period === 'today') dateFilter = 'DATE(o.created_at) = CURDATE()';
    else if (period === 'week') dateFilter = 'o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    else if (period === 'month') dateFilter = 'o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    else dateFilter = '1=1';

    const [[totals]] = await db.query(
      `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount),0) as total_revenue,
       COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0) as paid_revenue
       FROM orders o WHERE ${dateFilter}`
    );

    const [by_status] = await db.query(
      `SELECT status, COUNT(*) as count FROM orders o WHERE ${dateFilter} GROUP BY status`
    );

    const [top_products] = await db.query(
      `SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.total_price) as total_revenue
       FROM order_items oi JOIN orders o ON oi.order_id=o.id WHERE ${dateFilter}
       GROUP BY oi.product_name ORDER BY total_revenue DESC LIMIT 5`
    );

    const [daily_sales] = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as orders, SUM(total_amount) as revenue
       FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`
    );

    res.json({ success: true, totals, by_status, top_products, daily_sales });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
