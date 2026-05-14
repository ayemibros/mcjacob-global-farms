require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/delivery', require('./routes/delivery'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/referrer', require('./routes/referrer'));

// ONE-TIME ADMIN SETUP — visit /api/setup-mcj-admin once, then this will be removed
app.get('/api/setup-mcj-admin', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const db = require('./config/db');
    const [existing] = await db.query("SELECT id FROM users WHERE email = 'admin@mcjacobfarms.com'");
    if (existing.length > 0) {
      return res.json({ success: true, message: 'Admin already exists. Login with admin@mcjacobfarms.com / Admin@2024' });
    }
    const hash = await bcrypt.hash('Admin@2024', 10);
    await db.query(
      "INSERT INTO users (full_name, email, phone, password, role, my_referral_code, status) VALUES (?, ?, ?, ?, 'admin', 'ADMIN001', 'active')",
      ['Super Admin', 'admin@mcjacobfarms.com', '07044784949', hash]
    );
    res.json({ success: true, message: 'Admin created! Login: admin@mcjacobfarms.com / Admin@2024' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SPA fallback for HTML pages
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', company: 'MC-JACOB GLOBAL FARMS LTD', timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File size too large.' });
  }
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌿 ================================================`);
  console.log(`   MC-JACOB GLOBAL FARMS LTD`);
  console.log(`   Server running on http://localhost:${PORT}`);
  console.log(`   Admin: http://localhost:${PORT}/admin`);
  console.log(`🌿 ================================================\n`);
});
