# 🚀 คู่มือการ Deploy Cloudflare D1 + Worker (ฟรี 100%) ร้านเกื้อกูลกัน

ระบบ Backend ใหม่บน **Cloudflare D1 (Serverless SQLite)** + **Cloudflare Workers**
- ⚡ **ความเร็วสูงระดับมิลลิวินาที (20 - 50ms)** เทียบกับเดิม 2,000 - 5,000ms บน Sheets
- 🛡️ **ฟรี 100% ตลอดชีพ** (D1 ฟรี 5,000,000 อ่าน/วัน, Worker ฟรี 100,000 ครั้ง/วัน)
- 🛒 รองรับสินค้า 4,763 รายการครบถ้วน ค้นหาทันทีไม่มีหน่วง
- 📱 เชื่อมต่อ LINE OA, แจ้งเตือนสถานะ, QR พร้อมเพย์ Dynamic ตามเดิมครบ 100%

---

## 🛠️ ขั้นตอนการติดตั้งและ Deploy (ทำเพียงครั้งเดียว 5 นาที)

เปิด Terminal ในโฟลเดอร์ `cloudflare/` (หรือ cd เข้าไป) แล้วทำตามขั้นตอนดังนี้:

### 1. ล็อกอินเข้า Cloudflare
```bash
npx wrangler login
```
*(เบราว์เซอร์จะเปิดขึ้นมา ให้กดปุ่ม **Allow / Authorize**)*

---

### 2. สร้างฐานข้อมูล D1
```bash
npx wrangler d1 create kuekoonkan-db
```
เมื่อสร้างเสร็จ ระบบจะแสดงข้อความแบบนี้:
```toml
[[d1_databases]]
binding = "DB"
database_name = "kuekoonkan-db"
database_id = "xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
👉 **ให้นำค่า `database_id` ที่ได้ ไปวางแทนที่ในไฟล์ `cloudflare/wrangler.toml`** บรรทัดที่ 8

---

### 3. รัน Schema สร้างตาราง (Products, Orders, Members)
```bash
npx wrangler d1 execute kuekoonkan-db --file=./schema.sql
```

---

### 4. นำเข้าข้อมูลสินค้าทั้งหมด 4,763 รายการเข้า D1
```bash
npx wrangler d1 execute kuekoonkan-db --file=./seed.sql
```

---

### 5. สั่ง Deploy ขึ้น Cloudflare Edge Network ทั่วโลก!
```bash
npx wrangler deploy
```

เมื่อเสร็จสิ้น คุณจะได้ URL ของ API ตัวอย่างเช่น:
```
https://kuekoonkan-api.<ชื่อของคุณ>.workers.dev
```

---

## 🔗 นำ URL ไปใช้งานในเว็บ / LINE Mini App

1. นำ URL ที่ได้ไปใส่ในไฟล์ `catalog.js` บรรทัดที่ 1:
```javascript
const GOOGLE_SCRIPT_URL = 'https://kuekoonkan-api.<ชื่อของคุณ>.workers.dev';
```

2. ใส่ในไฟล์ `admin-gas.html` บรรทัดที่ 1693:
```javascript
const GOOGLE_SCRIPT_URL = 'https://kuekoonkan-api.<ชื่อของคุณ>.workers.dev';
```

✨ **เพียงเท่านี้ ทั้งหน้าร้านและหน้า Admin จะเร็วติดสปีด 20ms และไม่ติดปัญหา Apps Script ล่มหรือโหลดออเดอร์ช้าอีกต่อไป!**
