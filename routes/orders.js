const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');

const generateOrderNumber = () => {
  const now = Date.now().toString().slice(-8);
  const rand = Math.floor(100 + Math.random() * 900);
  return `MCJ${now}${rand}`;
};

// POST /api/orders - Dealer: place order
router.post('/', authenticate, async (req, res) => {
  const { items, delivery_address, delivery_state, delivery_city, delivery_lga, recipient_name, recipient_phone, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty.' });
  }
  if (!delivery_address || !delivery_state || !delivery_city) {
    return res.status(400).json({ success: false, message: 'Delivery address is required.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Validate items and calculate total
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const [products] = await conn.query(
        'SELECT * FROM products WHERE id = ? AND is_active = TRUE',
        [item.product_id]
      );
      if (products.length === 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Product ID ${item.product_id} not found.` });
      }
      const product = products[0];
      const qty = parseInt(item.quantity);
      if (qty < product.min_order) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Minimum order for "${product.name}" is ${product.min_order} ${product.bundle_unit}(s).`
        });
      }
      if (product.stock_quantity < qty) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock_quantity} ${product.bundle_unit}(s).`
        });
      }
      const itemTotal = product.price * qty;
      subtotal += itemTotal;
      validatedItems.push({ product, qty, itemTotal });
    }

    const [settings] = await conn.query("SELECT setting_value FROM settings WHERE setting_key = 'shipping_fee'");
    const shippingFee = settings.length > 0 ? parseFloat(settings[0].setting_value) : 2500;
    const totalAmount = subtotal + shippingFee;
    const orderNumber = generateOrderNumber();

    const [orderResult] = await conn.query(
      `INSERT INTO orders (order_number, user_id, subtotal, shipping_fee, total_amount, delivery_address, delivery_state, delivery_city, delivery_lga, recipient_name, recipient_phone, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, req.user.id, subtotal, shippingFee, totalAmount,
       delivery_address, delivery_state, delivery_city, delivery_lga || null,
       recipient_name || req.user.full_name, recipient_phone || null, notes || null]
    );
    const orderId = orderResult.insertId;

    for (const { product, qty, itemTotal } of validatedItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, bundle_size, bundle_unit, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, product.id, product.name, qty, product.bundle_size, product.bundle_unit, product.price, itemTotal]
      );
      await conn.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [qty, product.id]);
    }

    // Update user stats
    await conn.query('UPDATE users SET total_orders = total_orders + 1 WHERE id = ?', [req.user.id]);

    await conn.commit();
    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      order: { id: orderId, order_number: orderNumber, total_amount: totalAmount, shipping_fee: shippingFee, subtotal }
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to place order.' });
  } finally {
    conn.release();
  }
});

// GET /api/orders - Dealer: my orders
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user.id;
    let query = `SELECT o.*, u.full_name, u.email, u.phone,
      (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o JOIN users u ON o.user_id = u.id`;
    const params = [];
    if (userId) { query += ' WHERE o.user_id = ?'; params.push(userId); }
    query += ' ORDER BY o.created_at DESC';
    const [orders] = await db.query(query, params);
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/orders/:id - Get single order with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, u.full_name, u.email, u.phone, u.business_name
       FROM orders o JOIN users u ON o.user_id = u.id
       WHERE o.id = ?${req.user.role !== 'admin' ? ' AND o.user_id = ?' : ''}`,
      req.user.role !== 'admin' ? [req.params.id, req.user.id] : [req.params.id]
    );
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'Order not found.' });

    const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    const [payment] = await db.query('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    const [delivery] = await db.query('SELECT * FROM delivery WHERE order_id = ?', [req.params.id]);

    res.json({
      success: true,
      order: orders[0],
      items,
      payment: payment[0] || null,
      delivery: delivery[0] || null
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/orders/:id/status - Admin: update order status
router.put('/:id/status', authenticate, adminOnly, async (req, res) => {
  const { status, admin_notes } = req.body;
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }
  try {
    await db.query('UPDATE orders SET status = ?, admin_notes = ? WHERE id = ?', [status, admin_notes || null, req.params.id]);
    if (status === 'cancelled') {
      const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
      for (const item of items) {
        await db.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    }
    res.json({ success: true, message: 'Order status updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/orders/admin/stats - Admin dashboard stats
router.get('/admin/stats', authenticate, adminOnly, async (req, res) => {
  try {
    const [[{ total_orders }]] = await db.query('SELECT COUNT(*) as total_orders FROM orders');
    const [[{ total_revenue }]] = await db.query("SELECT COALESCE(SUM(total_amount),0) as total_revenue FROM orders WHERE payment_status='paid'");
    const [[{ pending_payments }]] = await db.query("SELECT COUNT(*) as pending_payments FROM payments WHERE status='pending'");
    const [[{ total_dealers }]] = await db.query("SELECT COUNT(*) as total_dealers FROM users WHERE role='dealer'");
    const [[{ pending_orders }]] = await db.query("SELECT COUNT(*) as pending_orders FROM orders WHERE status='pending'");
    const [[{ deliveries_pending }]] = await db.query("SELECT COUNT(*) as deliveries_pending FROM delivery WHERE status != 'delivered'");
    const [recent_orders] = await db.query(
      `SELECT o.order_number, o.total_amount, o.status, o.payment_status, o.created_at, u.full_name
       FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 5`
    );
    res.json({
      success: true,
      stats: { total_orders, total_revenue, pending_payments, total_dealers, pending_orders, deliveries_pending },
      recent_orders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
