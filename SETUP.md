# MC-JACOB GLOBAL FARMS LTD — Setup Guide

## Prerequisites
- Node.js v18+ installed
- MySQL 8.0+ installed and running
- A Paystack account (for online payments)

---

## Step 1: Database Setup

1. Open MySQL Workbench or MySQL CLI
2. Run the database schema:
   ```sql
   source config/database.sql
   ```
   OR copy-paste the contents of `config/database.sql` into MySQL Workbench and execute.

3. This will:
   - Create the `mcjacob_db` database
   - Create all tables (users, products, orders, payments, delivery, referrals, settings)
   - Seed default products and admin user
   - Seed default settings

---

## Step 2: Configure Environment

Edit the `.env` file in the root folder:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD    ← Change this!
DB_NAME=mcjacob_db

# Paystack (get from dashboard.paystack.com)
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxx   ← Get from Paystack
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxx   ← Get from Paystack

# Bank Account (also configurable from Admin → Settings)
BANK_NAME=Zenith Bank
BANK_ACCOUNT_NUMBER=1234567890          ← Your actual account number
WHATSAPP_NUMBER=2348012345678           ← Your WhatsApp (with country code)
```

---

## Step 3: Update Admin Password

The default admin password hash in `database.sql` is for `Admin@2024`.

To set your own password:
1. Open MySQL
2. Run:
   ```sql
   USE mcjacob_db;
   UPDATE users SET password = '$2b$10$YOUR_BCRYPT_HASH' WHERE role = 'admin';
   ```

OR: Generate a bcrypt hash using:
   ```js
   const bcrypt = require('bcryptjs');
   console.log(bcrypt.hashSync('YourNewPassword', 10));
   ```

---

## Step 4: Start the Server

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Server starts at: **http://localhost:3000**

---

## Application URLs

| Page | URL |
|------|-----|
| Home | http://localhost:3000 |
| Shop | http://localhost:3000/shop.html |
| Register (Dealer) | http://localhost:3000/register.html |
| Login | http://localhost:3000/login.html |
| Dealer Dashboard | http://localhost:3000/dashboard.html |
| Track Order | http://localhost:3000/track-order.html |
| **Admin Dashboard** | **http://localhost:3000/admin/** |
| Admin Products | http://localhost:3000/admin/products.html |
| Admin Orders | http://localhost:3000/admin/orders.html |
| Admin Payments | http://localhost:3000/admin/payments.html |
| Admin Delivery | http://localhost:3000/admin/delivery.html |
| Admin Dealers | http://localhost:3000/admin/dealers.html |
| Admin Settings | http://localhost:3000/admin/settings.html |

---

## Default Admin Login
- **Email:** admin@mcjacobfarms.com
- **Password:** Admin@2024

**Change this immediately after first login via Admin → Settings**

---

## Payment Methods

### 1. Paystack (Online)
- Dealers pay via card, bank transfer, or USSD
- Payment verified automatically
- Requires Paystack API keys in `.env`

### 2. Bank Transfer
- Dealer transfers to your bank account
- Uploads receipt image/PDF on the platform
- Admin verifies in Admin → Payments

### 3. WhatsApp
- Dealer transfers to bank account
- Sends receipt via WhatsApp to your number
- Admin verifies in Admin → Payments

---

## Project Structure

```
Mcjacob_App/
├── config/
│   ├── db.js              # MySQL connection pool
│   └── database.sql       # Full DB schema + seed data
├── middleware/
│   ├── auth.js            # JWT authentication
│   └── upload.js          # File upload (Multer)
├── routes/
│   ├── auth.js            # Register, Login, Profile
│   ├── products.js        # Product CRUD
│   ├── orders.js          # Order management
│   ├── payments.js        # Payment submission & verification
│   ├── delivery.js        # Delivery tracking
│   ├── admin.js           # Admin: dealers, settings, reports
│   └── referrer.js        # Referral system
├── public/                # Frontend (HTML/CSS/JS)
│   ├── index.html         # Landing page
│   ├── shop.html          # Product catalogue
│   ├── cart.html          # Shopping cart
│   ├── checkout.html      # Checkout flow
│   ├── payment.html       # Payment page
│   ├── login.html         # Login
│   ├── register.html      # Dealer registration
│   ├── dashboard.html     # Dealer dashboard
│   ├── track-order.html   # Order tracker
│   ├── css/
│   │   ├── style.css      # Main stylesheet
│   │   └── admin.css      # Admin panel styles
│   ├── js/
│   │   ├── app.js         # Core JS + API client
│   │   └── cart.js        # Cart management
│   └── admin/             # Admin panel pages
│       ├── index.html     # Dashboard overview
│       ├── products.html  # Product management
│       ├── orders.html    # Order management
│       ├── payments.html  # Payment verification
│       ├── delivery.html  # Delivery tracking
│       ├── dealers.html   # Dealer management
│       ├── referrers.html # Referral leaderboard
│       └── settings.html  # Platform settings
├── uploads/
│   ├── products/          # Product images
│   └── receipts/          # Payment receipts
├── server.js              # Express app entry point
├── package.json
└── .env                   # Environment variables
```

---

## Key Features

✅ **Dealer Registration** with referral code support
✅ **Product Catalogue** — sold in bundles (not single units)
✅ **Shopping Cart** — bundle-based ordering with min. order enforcement
✅ **Checkout** — delivery address, multiple payment methods
✅ **Payment Gateway** — Paystack integration
✅ **Bank Transfer** — receipt upload + WhatsApp notification
✅ **Admin Dashboard** — full management interface
✅ **Order Management** — status updates, dealer notifications
✅ **Payment Verification** — review receipts, verify/reject
✅ **Delivery Tracking** — courier tracking, status updates
✅ **Referral System** — dealers earn via referrals
✅ **Settings Panel** — bank details, WhatsApp, shipping fee
