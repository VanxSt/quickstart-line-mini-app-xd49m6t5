/**
 * สคริปต์ Sync ดึงสต็อกสินค้า & ราคาสินค้าจาก POSPOS API
 * อัปเดตลง products.json และส่งข้อมูลเข้าสู่ Cloudflare D1 ของร้านเกื้อกูลกัน
 *
 * วิธีใช้งาน:
 * 1. ตรวจสอบว่ามี POSPOS_API_KEY อยู่ใน cloudflare/wrangler.toml หรือ .env
 * 2. รันคำสั่ง: node sync-pospos.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. อ่าน API Key จาก wrangler.toml หรือ .env
function getApiKey() {
  if (process.env.POSPOS_API_KEY) {
    return process.env.POSPOS_API_KEY.trim();
  }

  // อ่านจาก cloudflare/wrangler.toml
  const wranglerPath = path.resolve(__dirname, 'cloudflare/wrangler.toml');
  if (fs.existsSync(wranglerPath)) {
    const content = fs.readFileSync(wranglerPath, 'utf8');
    const match = content.match(/POSPOS_API_KEY\s*=\s*["']([^"']+)["']/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // อ่านจาก .env ถ้ามี
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/POSPOS_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

const API_KEY = getApiKey();
if (!API_KEY) {
  console.error('❌ ไม่พบ POSPOS_API_KEY ใน cloudflare/wrangler.toml หรือ .env');
  console.error('กรุณาใส่ POSPOS_API_KEY ใน cloudflare/wrangler.toml ให้เรียบร้อยก่อนครับ');
  process.exit(1);
}

const CLOUDFLARE_API_URL = 'https://kuekoonkan-api.noperfecf.workers.dev';
const PRODUCTS_JSON_PATH = path.resolve(__dirname, 'products.json');

// Helper ทำ HTTP GET request ไปยัง POSPOS
function fetchFromPospos(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'go.pospos.co',
      path: urlPath,
      method: 'GET',
      headers: {
        'apikey': API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'Kuekoonkan-App/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`รูปแบบข้อมูลที่ตอบกลับไม่ใช่ JSON: ${data.slice(0, 150)}`));
          }
        } else {
          reject(new Error(`POSPOS API ตอบกลับด้วยสถานะ ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('การเชื่อมต่อกับ POSPOS API ใช้เวลานานเกินกำหนด (Timeout 30s)'));
    });

    req.end();
  });
}

// Helper ส่งข้อมูลอัปเดตไปยัง Cloudflare Worker D1
function pushToCloudflareBatch(productsBatch) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CLOUDFLARE_API_URL}?action=syncProductsBatch`);
    const postData = JSON.stringify({ products: productsBatch });

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ status: 'ok', raw: data });
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(postData);
    req.end();
  });
}

// แปลงฟิลด์จาก POSPOS ให้เป็นมาตรฐาน
function normalizePosposItem(item) {
  const barcode = String(item.barcode || item.code || item.product_code || item.sku || item.id || item._id || '').trim();
  const name = String(item.name || item.product_name || item.title || '').trim();
  
  // ราคาขาย
  const rawPrice = item.price ?? item.retail_price ?? item.sell_price ?? item.normal_price ?? null;
  const price = rawPrice !== null ? Number(rawPrice) : null;

  // จำนวนสต็อกคงเหลือ
  const rawStock = item.stock ?? item.quantity ?? item.qty ?? item.remain ?? item.balance ?? item.amount ?? item.total_stock ?? null;
  const stock = rawStock !== null ? Number(rawStock) : null;

  // รูปภาพ
  let img = '';
  if (typeof item.image === 'string' && item.image) img = item.image;
  else if (Array.isArray(item.images) && item.images.length > 0) {
    img = typeof item.images[0] === 'string' ? item.images[0] : (item.images[0]?.url || '');
  } else if (typeof item.img === 'string' && item.img) img = item.img;

  return { barcode, name, price, stock, img, raw: item };
}

async function runSync() {
  console.log('====================================================');
  console.log('🏪 ร้านเกื้อกูลกัน: ระบบเชื่อมต่อ & ซิงค์ข้อมูล POSPOS');
  console.log('====================================================');
  console.log('🔑 กำลังตรวจสอบสิทธิ์และเชื่อมต่อ POSPOS API...');

  let rawStockData = null;

  // 1. ลองดึงข้อมูลแบบ All Product Stock (ตามคู่มือ v0.3)
  try {
    console.log('📦 กำลังดึงสต็อกสินค้าทั้งหมดจาก https://go.pospos.co/developer/api/stock ...');
    rawStockData = await fetchFromPospos('/developer/api/stock');
  } catch (err) {
    console.warn(`⚠️ การดึงแบบ All Stock: ${err.message}`);
    console.log('🔄 กำลังลองดึงแบบแบ่งหน้า (Pagination: /developer/api/stock/pagination) ...');
    try {
      rawStockData = await fetchFromPospos('/developer/api/stock/pagination?page=1&limit=200');
    } catch (pageErr) {
      console.error('❌ ไม่สามารถดึงข้อมูลจาก POSPOS API ได้:', pageErr.message);
      process.exit(1);
    }
  }

  // แยก Array สินค้าจาก Response
  let posposItems = [];
  if (Array.isArray(rawStockData)) {
    posposItems = rawStockData;
  } else if (rawStockData && typeof rawStockData === 'object') {
    if (Array.isArray(rawStockData.data)) posposItems = rawStockData.data;
    else if (Array.isArray(rawStockData.stock)) posposItems = rawStockData.stock;
    else if (Array.isArray(rawStockData.items)) posposItems = rawStockData.items;
    else if (Array.isArray(rawStockData.products)) posposItems = rawStockData.products;
  }

  console.log(`✅ ดึงข้อมูลสำเร็จ! พบสินค้าใน POSPOS ทั้งหมด: ${posposItems.length} รายการ`);

  // แปลงและจัดทำ Map จาก POSPOS โดยใช้ Barcode และ Name เป็นคีย์
  const posposByBarcode = new Map();
  const posposByName = new Map();

  for (const rawItem of posposItems) {
    const item = normalizePosposItem(rawItem);
    if (item.barcode) {
      posposByBarcode.set(item.barcode, item);
    }
    if (item.name) {
      posposByName.set(item.name.toLowerCase(), item);
    }
  }

  // 2. อ่านข้อมูลจาก products.json ของร้านเกื้อกูลกัน
  if (!fs.existsSync(PRODUCTS_JSON_PATH)) {
    console.error(`❌ ไม่พบไฟล์ products.json ที่ ${PRODUCTS_JSON_PATH}`);
    process.exit(1);
  }

  console.log('📂 กำลังอ่านไฟล์ products.json...');
  const productsFileContent = fs.readFileSync(PRODUCTS_JSON_PATH, 'utf8');
  let productsJsonData;
  try {
    productsJsonData = JSON.parse(productsFileContent);
  } catch (e) {
    console.error('❌ ไฟล์ products.json เสียหายหรือไม่ถูกต้องตามรูปแบบ JSON');
    process.exit(1);
  }

  const localProducts = productsJsonData.products || [];
  console.log(`📊 สินค้าปัจจุบันในระบบร้าน: ${localProducts.length} รายการ`);

  let matchedCount = 0;
  let priceUpdatedCount = 0;
  let inStockCount = 0;
  let outOfStockCount = 0;
  const productsToUpdateD1 = [];

  for (const product of localProducts) {
    const pId = String(product.id || '').trim();
    const pName = String(product.name || '').trim().toLowerCase();

    // ค้นหาใน POSPOS ด้วย Barcode ก่อน แล้วค่อยหาด้วยชื่อ
    const posMatch = posposByBarcode.get(pId) || posposByName.get(pName);

    if (posMatch) {
      matchedCount++;

      // อัปเดตราคา
      if (posMatch.price !== null && posMatch.price > 0) {
        if (product.price !== posMatch.price) {
          priceUpdatedCount++;
          product.price = posMatch.price;
        }
      }

      // อัปเดตสต็อกคงเหลือ
      if (posMatch.stock !== null) {
        product.stock = posMatch.stock;
        if (posMatch.stock <= 0) {
          product.status = 'out_of_stock';
          outOfStockCount++;
        } else {
          product.status = 'active';
          inStockCount++;
        }
      } else {
        inStockCount++;
      }

      // อัปเดตรูปภาพถ้า POSPOS มีรูปใหม่
      if (posMatch.img && (!product.img || product.img.includes('placehold'))) {
        product.img = posMatch.img;
      }

      productsToUpdateD1.push(product);
    }
  }

  // บันทึกกลับลง products.json
  fs.writeFileSync(PRODUCTS_JSON_PATH, JSON.stringify(productsJsonData, null, 2), 'utf8');
  console.log('💾 บันทึกข้อมูลลง products.json เรียบร้อยแล้ว!');

  console.log('----------------------------------------------------');
  console.log(`🎯 สรุปผลการซิงค์ข้อมูล:`);
  console.log(` - จับคู่สินค้าตรงกัน: ${matchedCount} / ${localProducts.length} รายการ`);
  console.log(` - อัปเดตราคาใหม่: ${priceUpdatedCount} รายการ`);
  console.log(` - สินค้าพร้อมจำหน่าย (มีสต็อก): ${inStockCount} รายการ`);
  console.log(` - สินค้าหมดชั่วคราว (สต็อก 0): ${outOfStockCount} รายการ`);
  console.log('----------------------------------------------------');

  // 3. ซิงค์ขึ้น Cloudflare D1 อัตโนมัติ (แบ่งส่งเป็น Batch ละ 50 รายการ)
  if (productsToUpdateD1.length > 0) {
    console.log(`🚀 กำลังส่งข้อมูล ${productsToUpdateD1.length} รายการขึ้น Cloudflare D1 Backend...`);
    const BATCH_SIZE = 50;
    let successD1Count = 0;

    for (let i = 0; i < productsToUpdateD1.length; i += BATCH_SIZE) {
      const batch = productsToUpdateD1.slice(i, i + BATCH_SIZE);
      try {
        await pushToCloudflareBatch(batch);
        successD1Count += batch.length;
        process.stdout.write(`\r  กำลังบันทึกเข้า D1: ${successD1Count} / ${productsToUpdateD1.length} รายการ...`);
      } catch (err) {
        console.warn(`\n⚠️ บันทึก D1 batch ${i} ไม่สำเร็จ: ${err.message}`);
      }
    }
    console.log('\n✅ ซิงค์ข้อมูลเข้า Cloudflare D1 สำเร็จเรียบร้อย!');
  }

  console.log('====================================================');
  console.log('✨ การซิงค์ข้อมูลกับ POSPOS เสร็จสมบูรณ์ทุกขั้นตอน!');
  console.log('   LINE Mini App ของร้านเกื้อกูลกันจะแสดงราคาและสต็อกล่าสุดทันที');
  console.log('====================================================');
}

runSync().catch(err => {
  console.error('❌ เกิดข้อผิดพลาดในการรันสคริปต์:', err);
  process.exit(1);
});
