-- ========================================================
-- Schema สำหรับฐานข้อมูล Cloudflare D1 (SQLite) ร้านเกื้อกูลกัน
-- ========================================================

-- 1. ตารางสินค้า (Products)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'ทั่วไป',
  price REAL DEFAULT 0,
  desc TEXT DEFAULT '',
  img TEXT DEFAULT '',
  tag TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- 2. ตารางคำสั่งซื้อ (Orders)
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,
  customer_name TEXT,
  phone TEXT,
  gps_location TEXT,
  address_details TEXT,
  slip_url TEXT DEFAULT '',
  total_price REAL DEFAULT 0,
  status TEXT DEFAULT 'รอตรวจสอบ',
  payment_method TEXT DEFAULT 'ปลายทาง',
  items_text TEXT,
  items_json TEXT,
  delivery_type TEXT DEFAULT 'ทันที',
  preorder_time TEXT DEFAULT '',
  shipping_option TEXT DEFAULT 'จัดส่ง',
  note TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp DESC);

-- 3. ตารางข้อมูลสมาชิกและประวัติที่อยู่ (Members)
CREATE TABLE IF NOT EXISTS members (
  user_id TEXT PRIMARY KEY,
  display_name TEXT DEFAULT '',
  status_message TEXT DEFAULT '',
  email TEXT DEFAULT '',
  picture_url TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  gps_location TEXT DEFAULT '',
  address_details TEXT DEFAULT '',
  address_label TEXT DEFAULT '',
  saved_addresses_json TEXT DEFAULT '[]',
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
