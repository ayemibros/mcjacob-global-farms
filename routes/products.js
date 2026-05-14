const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');
const { uploadProduct } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// GET /api/products - Public: list active products
router.get('/', async (req, res) => {
  try {
    const { category, search, featured } = req.query;
    let query = 'SELECT * FROM products WHERE is_active = TRUE';
    const params = [];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (search) { query += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (featured === 'true') { query += ' AND is_featured = TRUE'; }
    query += ' ORDER BY is_featured DESC, created_at DESC';

    const [products] = await db.query(query, params);
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
});

// GET /api/products/categories
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT DISTINCT category FROM products WHERE is_active = TRUE AND category IS NOT NULL');
    res.json({ success: true, categories: rows.map(r => r.category) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/products/:id - Public: single product
router.get('/:id', async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products WHERE id = ? AND is_active = TRUE', [req.params.id]);
    if (products.length === 0) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, product: products[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/products - Admin: create product
router.post('/', authenticate, adminOnly, uploadProduct.single('image'), async (req, res) => {
  const { name, description, price, net_weight, bundle_size, bundle_unit, min_order, stock_quantity, category, sku, is_featured } = req.body;
  if (!name || !price || !bundle_size) {
    return res.status(400).json({ success: false, message: 'Name, price and bundle size are required.' });
  }
  try {
    const imagePath = req.file ? `/uploads/products/${req.file.filename}` : null;
    const [result] = await db.query(
      `INSERT INTO products (name, description, price, image, net_weight, bundle_size, bundle_unit, min_order, stock_quantity, category, sku, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, parseFloat(price), imagePath, net_weight, parseInt(bundle_size),
       bundle_unit || 'Carton', parseInt(min_order) || 1, parseInt(stock_quantity) || 0,
       category, sku || null, is_featured === 'true' ? 1 : 0]
    );
    res.status(201).json({ success: true, message: 'Product created.', productId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'SKU already exists.' });
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/products/:id - Admin: update product
router.put('/:id', authenticate, adminOnly, uploadProduct.single('image'), async (req, res) => {
  const { name, description, price, net_weight, bundle_size, bundle_unit, min_order, stock_quantity, category, sku, is_featured, is_active } = req.body;
  try {
    const [existing] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Product not found.' });

    let imagePath = existing[0].image;
    if (req.file) {
      imagePath = `/uploads/products/${req.file.filename}`;
      if (existing[0].image) {
        const oldPath = path.join(__dirname, '..', existing[0].image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    await db.query(
      `UPDATE products SET name=?, description=?, price=?, image=?, net_weight=?, bundle_size=?, bundle_unit=?,
       min_order=?, stock_quantity=?, category=?, sku=?, is_featured=?, is_active=? WHERE id=?`,
      [name, description, parseFloat(price), imagePath, net_weight, parseInt(bundle_size),
       bundle_unit, parseInt(min_order) || 1, parseInt(stock_quantity) || 0,
       category, sku || null, is_featured === 'true' ? 1 : 0,
       is_active === 'false' ? 0 : 1, req.params.id]
    );
    res.json({ success: true, message: 'Product updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/products/:id - Admin: delete product
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (existing[0].image) {
      const imgPath = path.join(__dirname, '..', existing[0].image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/products/admin/all - Admin: all products including inactive
router.get('/admin/all', authenticate, adminOnly, async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
