-- MC-JACOB GLOBAL FARMS LTD - Database Schema
-- Run this file to set up the database

CREATE DATABASE IF NOT EXISTS mcjacob_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mcjacob_db;

-- Users (Dealers & Admin)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('dealer', 'admin') DEFAULT 'dealer',
  business_name VARCHAR(255),
  address TEXT,
  state VARCHAR(100),
  city VARCHAR(100),
  referrer_code VARCHAR(20) DEFAULT NULL,
  my_referral_code VARCHAR(20) UNIQUE,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0.00,
  avatar VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image VARCHAR(255) DEFAULT NULL,
  net_weight VARCHAR(50),
  bundle_size INT NOT NULL DEFAULT 1 COMMENT 'Number of units per bundle/carton',
  bundle_unit VARCHAR(50) DEFAULT 'Carton' COMMENT 'e.g., Carton, Bag, Pack, Crate',
  min_order INT DEFAULT 1 COMMENT 'Minimum bundles per order',
  stock_quantity INT DEFAULT 0 COMMENT 'In bundles',
  category VARCHAR(100),
  sku VARCHAR(100) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_fee DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','confirmed','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  payment_status ENUM('unpaid','pending_verification','paid','refunded') DEFAULT 'unpaid',
  delivery_address TEXT,
  delivery_state VARCHAR(100),
  delivery_city VARCHAR(100),
  delivery_lga VARCHAR(100),
  recipient_name VARCHAR(255),
  recipient_phone VARCHAR(20),
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL COMMENT 'Number of bundles',
  bundle_size INT NOT NULL,
  bundle_unit VARCHAR(50),
  unit_price DECIMAL(10,2) NOT NULL COMMENT 'Price per bundle',
  total_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  user_id INT NOT NULL,
  payment_method ENUM('paystack','bank_transfer','whatsapp') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reference VARCHAR(150) UNIQUE,
  receipt_image VARCHAR(255) DEFAULT NULL,
  bank_name VARCHAR(100) DEFAULT NULL,
  depositor_name VARCHAR(255) DEFAULT NULL,
  transaction_date DATE DEFAULT NULL,
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  status ENUM('pending','verified','rejected') DEFAULT 'pending',
  admin_notes TEXT,
  verified_at TIMESTAMP NULL,
  verified_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Delivery
CREATE TABLE IF NOT EXISTS delivery (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL UNIQUE,
  tracking_number VARCHAR(100) DEFAULT NULL,
  courier VARCHAR(100) DEFAULT NULL,
  status ENUM('preparing','dispatched','in_transit','out_for_delivery','delivered','returned') DEFAULT 'preparing',
  estimated_delivery DATE DEFAULT NULL,
  actual_delivery DATE DEFAULT NULL,
  dispatch_address TEXT,
  delivery_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  referrer_id INT NOT NULL,
  referred_id INT NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 2.50,
  total_commission DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default settings
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
('bank_name', 'Zenith Bank'),
('bank_account_name', 'MC-JACOB GLOBAL FARMS LTD'),
('bank_account_number', '1234567890'),
('whatsapp_number', '2348012345678'),
('shipping_fee', '2500'),
('paystack_public_key', 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
('company_phone', '+234 801 234 5678'),
('company_email', 'info@mcjacobfarms.com'),
('company_address', 'No. 1 Farms Road, Abuja, Nigeria');

-- Seed admin user (password: Admin@2024)
INSERT IGNORE INTO users (full_name, email, phone, password, role, my_referral_code, status) VALUES
('Super Admin', 'admin@mcjacobfarms.com', '+2348000000000',
 '$2b$10$5QyMmb8jLm/jNEgVpGIzU.3TuEAhFo6BFMO6jRGv7eqzGQ3a8Qi.y',
 'admin', 'ADMIN001', 'active');

-- Seed sample products
INSERT IGNORE INTO products (name, description, price, net_weight, bundle_size, bundle_unit, min_order, stock_quantity, category, sku, is_featured) VALUES
('Premium Palm Oil', 'Pure, unrefined red palm oil sourced from premium palm fruits. Rich in vitamins and antioxidants.', 18500.00, '25 Litres', 4, 'Jerry Can', 1, 100, 'Oils', 'MCJ-OIL-001', TRUE),
('Groundnut Oil', 'Cold-pressed groundnut oil with a rich, nutty flavour. Ideal for frying and cooking.', 22000.00, '25 Litres', 4, 'Jerry Can', 1, 80, 'Oils', 'MCJ-OIL-002', TRUE),
('Organic Honey', 'Pure, raw organic honey harvested from our partner bee farms. No additives.', 12500.00, '1 Litre', 12, 'Bottle', 1, 200, 'Honey', 'MCJ-HON-001', TRUE),
('Dried Catfish', 'Locally sourced and naturally dried catfish. Perfect for soups and stews.', 8500.00, '5 KG', 10, 'Pack', 2, 150, 'Fish', 'MCJ-FISH-001', FALSE),
('Crayfish (Ground)', 'Premium ground crayfish with intense flavour. Essential ingredient for Nigerian cooking.', 6500.00, '1 KG', 20, 'Bag', 2, 300, 'Spices', 'MCJ-SPICE-001', TRUE),
('Cocoa Powder', 'Natural, unsweetened cocoa powder from freshly harvested cocoa beans.', 9800.00, '500g', 24, 'Pack', 1, 120, 'Beverages', 'MCJ-BEV-001', FALSE);
