const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');

// POST /api/delivery - Admin: create delivery record
router.post('/', authenticate, adminOnly, async (req, res) => {
  const { order_id, tracking_number, courier, estimated_delivery, dispatch_address, delivery_notes } = req.body;
  if (!order_id) return res.status(400).json({ success: false, message: 'Order ID required.' });
  try {
    await db.query(
      `INSERT INTO delivery (order_id, tracking_number, courier, estimated_delivery, dispatch_address, delivery_notes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tracking_number=VALUES(tracking_number), courier=VALUES(courier),
       estimated_delivery=VALUES(estimated_delivery), dispatch_address=VALUES(dispatch_address), delivery_notes=VALUES(delivery_notes)`,
      [order_id, tracking_number || null, courier || null, estimated_delivery || null, dispatch_address || null, delivery_notes || null]
    );
    await db.query("UPDATE orders SET status='processing' WHERE id=? AND status='confirmed'", [order_id]);
    res.status(201).json({ success: true, message: 'Delivery record created.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/delivery/:order_id/status - Admin: update delivery status
router.put('/:order_id/status', authenticate, adminOnly, async (req, res) => {
  const { status, delivery_notes } = req.body;
  const validStatuses = ['preparing', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered', 'returned'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid delivery status.' });
  }
  try {
    const updates = { status, delivery_notes: delivery_notes || null };
    if (status === 'delivered') updates.actual_delivery = new Date().toISOString().split('T')[0];

    await db.query('UPDATE delivery SET status=?, delivery_notes=?, actual_delivery=? WHERE order_id=?',
      [status, updates.delivery_notes, updates.actual_delivery || null, req.params.order_id]);

    const orderStatus = status === 'delivered' ? 'delivered' : status === 'dispatched' ? 'shipped' : 'processing';
    await db.query('UPDATE orders SET status=? WHERE id=?', [orderStatus, req.params.order_id]);

    res.json({ success: true, message: 'Delivery status updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/delivery - Admin: all deliveries
router.get('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT d.*, o.order_number, o.total_amount, o.delivery_address, o.delivery_state, o.delivery_city,
                 o.recipient_name, o.recipient_phone, u.full_name, u.phone, u.email
                 FROM delivery d
                 JOIN orders o ON d.order_id = o.id
                 JOIN users u ON o.user_id = u.id`;
    const params = [];
    if (status) { query += ' WHERE d.status = ?'; params.push(status); }
    query += ' ORDER BY d.created_at DESC';
    const [deliveries] = await db.query(query, params);
    res.json({ success: true, deliveries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/delivery/track/:order_number - Public/Dealer: track by order number
router.get('/track/:order_number', authenticate, async (req, res) => {
  try {
    const [orders] = await db.query('SELECT id, user_id FROM orders WHERE order_number = ?', [req.params.order_number]);
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (req.user.role !== 'admin' && orders[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [delivery] = await db.query('SELECT * FROM delivery WHERE order_id = ?', [orders[0].id]);
    const [order] = await db.query('SELECT order_number, status, payment_status, delivery_address, delivery_state, delivery_city, created_at FROM orders WHERE id = ?', [orders[0].id]);

    res.json({ success: true, order: order[0], delivery: delivery[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
