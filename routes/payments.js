const express = require('express');
const router = express.Router();
const db = require('../config/db');
const https = require('https');
const { authenticate, adminOnly } = require('../middleware/auth');
const { uploadReceipt } = require('../middleware/upload');

// POST /api/payments/bank-transfer - Upload payment receipt
router.post('/bank-transfer', authenticate, uploadReceipt.single('receipt'), async (req, res) => {
  const { order_id, bank_name, depositor_name, transaction_date, amount } = req.body;

  if (!order_id || !amount) {
    return res.status(400).json({ success: false, message: 'Order ID and amount are required.' });
  }
  if (!req.file && !req.body.whatsapp_sent) {
    return res.status(400).json({ success: false, message: 'Please upload your payment receipt.' });
  }

  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [order_id, req.user.id]);
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'Order not found.' });

    const receiptPath = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const reference = `BTR${Date.now()}${req.user.id}`;

    await db.query(
      `INSERT INTO payments (order_id, user_id, payment_method, amount, reference, receipt_image, bank_name, depositor_name, transaction_date)
       VALUES (?, ?, 'bank_transfer', ?, ?, ?, ?, ?, ?)`,
      [order_id, req.user.id, parseFloat(amount), reference, receiptPath,
       bank_name || null, depositor_name || null, transaction_date || null]
    );

    await db.query("UPDATE orders SET payment_status = 'pending_verification' WHERE id = ?", [order_id]);

    res.json({
      success: true,
      message: 'Payment receipt submitted. Our team will verify within 24 hours.',
      reference
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/payments/whatsapp-notify - Mark WhatsApp payment notification sent
router.post('/whatsapp-notify', authenticate, async (req, res) => {
  const { order_id, amount } = req.body;
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [order_id, req.user.id]);
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'Order not found.' });

    const reference = `WA${Date.now()}${req.user.id}`;
    await db.query(
      `INSERT INTO payments (order_id, user_id, payment_method, amount, reference, whatsapp_sent)
       VALUES (?, ?, 'whatsapp', ?, ?, TRUE)`,
      [order_id, req.user.id, parseFloat(amount || orders[0].total_amount), reference]
    );
    await db.query("UPDATE orders SET payment_status = 'pending_verification' WHERE id = ?", [order_id]);

    res.json({ success: true, message: 'WhatsApp notification logged. Please send receipt to our WhatsApp.', reference });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/payments/verify-paystack - Verify Paystack payment
router.post('/verify-paystack', authenticate, async (req, res) => {
  const { reference, order_id } = req.body;
  if (!reference || !order_id) {
    return res.status(400).json({ success: false, message: 'Reference and order ID required.' });
  }

  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [order_id, req.user.id]);
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'Order not found.' });

    // Verify with Paystack API
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: `/transaction/verify/${reference}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    };

    const verifyResult = await new Promise((resolve, reject) => {
      const paystackReq = https.request(options, (paystackRes) => {
        let data = '';
        paystackRes.on('data', chunk => data += chunk);
        paystackRes.on('end', () => resolve(JSON.parse(data)));
      });
      paystackReq.on('error', reject);
      paystackReq.end();
    });

    if (verifyResult.data && verifyResult.data.status === 'success') {
      const amountPaid = verifyResult.data.amount / 100;

      await db.query(
        `INSERT INTO payments (order_id, user_id, payment_method, amount, reference, status, verified_at)
         VALUES (?, ?, 'paystack', ?, ?, 'verified', NOW())
         ON DUPLICATE KEY UPDATE status='verified', verified_at=NOW()`,
        [order_id, req.user.id, amountPaid, reference]
      );

      await db.query(
        "UPDATE orders SET payment_status = 'paid', status = 'confirmed' WHERE id = ?",
        [order_id]
      );
      await db.query('UPDATE users SET total_spent = total_spent + ? WHERE id = ?', [amountPaid, req.user.id]);

      res.json({ success: true, message: 'Payment verified successfully! Your order is confirmed.', amount: amountPaid });
    } else {
      res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during verification.' });
  }
});

// GET /api/payments - List payments
router.get('/', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let query = `SELECT p.*, o.order_number, u.full_name, u.email, u.phone
                 FROM payments p
                 JOIN orders o ON p.order_id = o.id
                 JOIN users u ON p.user_id = u.id`;
    const params = [];
    if (!isAdmin) { query += ' WHERE p.user_id = ?'; params.push(req.user.id); }
    query += ' ORDER BY p.created_at DESC';
    const [payments] = await db.query(query, params);
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/payments/:id/verify - Admin: verify payment
router.put('/:id/verify', authenticate, adminOnly, async (req, res) => {
  const { status, admin_notes } = req.body;
  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }
  try {
    const [payments] = await db.query('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (payments.length === 0) return res.status(404).json({ success: false, message: 'Payment not found.' });

    await db.query(
      'UPDATE payments SET status=?, admin_notes=?, verified_at=NOW(), verified_by=? WHERE id=?',
      [status, admin_notes || null, req.user.id, req.params.id]
    );

    if (status === 'verified') {
      const payment = payments[0];
      await db.query("UPDATE orders SET payment_status='paid', status='confirmed' WHERE id=?", [payment.order_id]);
      await db.query('UPDATE users SET total_spent = total_spent + ? WHERE id=?', [payment.amount, payment.user_id]);
    } else {
      await db.query("UPDATE orders SET payment_status='unpaid' WHERE id=?", [payments[0].order_id]);
    }

    res.json({ success: true, message: `Payment ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/payments/settings - Get bank/payment settings (public)
router.get('/settings/public', async (req, res) => {
  try {
    const [settings] = await db.query(
      "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('bank_name','bank_account_name','bank_account_number','whatsapp_number','paystack_public_key','shipping_fee')"
    );
    const result = {};
    settings.forEach(s => result[s.setting_key] = s.setting_value);
    res.json({ success: true, settings: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
