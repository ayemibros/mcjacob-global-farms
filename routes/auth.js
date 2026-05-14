const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

// Generate unique referral code
const generateReferralCode = (name) => {
  const prefix = name.replace(/\s+/g, '').toUpperCase().slice(0, 4);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${rand}`;
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { full_name, email, phone, password, business_name, address, state, city, referrer_code } = req.body;

  if (!full_name || !email || !phone || !password) {
    return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    let referrerId = null;
    if (referrer_code) {
      const [referrer] = await db.query('SELECT id FROM users WHERE my_referral_code = ?', [referrer_code.toUpperCase()]);
      if (referrer.length > 0) referrerId = referrer[0].id;
    }

    const hashed = await bcrypt.hash(password, 10);
    const myCode = generateReferralCode(full_name);

    const [result] = await db.query(
      `INSERT INTO users (full_name, email, phone, password, business_name, address, state, city, referrer_code, my_referral_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [full_name, email, phone, hashed, business_name || null, address || null, state || null, city || null,
       referrer_code ? referrer_code.toUpperCase() : null, myCode]
    );

    if (referrerId) {
      await db.query(
        'INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)',
        [referrerId, result.insertId]
      );
    }

    const token = jwt.sign(
      { id: result.insertId, email, role: 'dealer', full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to MC-Jacob Global Farms.',
      token,
      user: { id: result.insertId, full_name, email, phone, role: 'dealer', my_referral_code: myCode }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact support.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id, full_name: user.full_name, email: user.email,
        phone: user.phone, role: user.role, business_name: user.business_name,
        my_referral_code: user.my_referral_code, status: user.status
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, full_name, email, phone, role, business_name, address, state, city, my_referral_code, status, total_orders, total_spent, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: users[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res) => {
  const { full_name, phone, business_name, address, state, city } = req.body;
  try {
    await db.query(
      'UPDATE users SET full_name=?, phone=?, business_name=?, address=?, state=?, city=? WHERE id=?',
      [full_name, phone, business_name, address, state, city, req.user.id]
    );
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;
  try {
    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(current_password, users[0].password);
    if (!match) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
