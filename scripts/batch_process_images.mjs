import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { removeBackground } from '@imgly/background-removal-node';

const API_ENDPOINT = 'https://kuekoonkan-api.noperfecf.workers.dev/api/products/image';
const TRACKER_FILE = path.resolve('scripts/processed_tracker.json');
const TEMP_DIR = path.resolve('scripts/temp');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// โหลด tracker เดิมเพื่อไม่ให้ทำรายการที่ทำไปแล้วซ้ำ
let tracker = {};
if (fs.existsSync(TRACKER_FILE)) {
  try {
    tracker = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  } catch (e) {
    tracker = {};
  }
}

function saveTracker() {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2), 'utf8');
}

// อ่าน argument จากคำสั่ง
const args = process.argv.slice(2);
let categoryFilter = null;
let limitFilter = null;

args.forEach(arg => {
  if (arg.startsWith('--category=')) {
    categoryFilter = arg.split('=')[1].replace(/['"]/g, '').trim();
  } else if (arg.startsWith('--limit=')) {
    limitFilter = parseInt(arg.split('=')[1], 10);
  }
});

// โหลดสินค้าจาก products.json
const rawProducts = JSON.parse(fs.readFileSync('products.json', 'utf8')).products || [];

let targetProducts = rawProducts.filter(p => {
  if (!p.img || !p.img.trim().startsWith('http')) return false;
  // ข้ามถ้าเป็นรูปที่อยู่ใน worker แล้ว
  if (p.img.includes('workers.dev')) return false;
  // ข้ามถ้าทำไปแล้วใน tracker
  if (tracker[p.id]) return false;
  // กรองตามหมวดหมู่ถ้ามีระบุ
  if (categoryFilter && p.category !== categoryFilter) return false;
  return true;
});

if (limitFilter && limitFilter > 0) {
  targetProducts = targetProducts.slice(0, limitFilter);
}

console.log('====================================================');
console.log(`🚀 เริ่มระบบ AI แปลงรูปสินค้าพื้นหลังขาวล้วน (ร้านเกื้อกูลกัน)`);
console.log(`📦 สินค้าที่ต้องประมวลผล: ${targetProducts.length} รายการ`);
if (categoryFilter) console.log(`📂 หมวดหมู่: ${categoryFilter}`);
if (limitFilter) console.log(`🔢 จำกัดจำนวนรอบนี้: ${limitFilter} รายการ`);
console.log('====================================================\n');

async function processProduct(p, index, total) {
  const pId = String(p.id).trim();
  const pName = p.name || 'ไม่มีชื่อสินค้า';
  console.log(`[${index + 1}/${total}] ⏳ กำลังประมวลผล: [${pId}] ${pName}...`);

  const tempPng = path.join(TEMP_DIR, `${pId}_cutout.png`);
  const tempJpg = path.join(TEMP_DIR, `${pId}_white.jpg`);

  try {
    // 1. ไดคัทตัดพื้นหลังด้วย AI (@imgly/background-removal-node)
    const blob = await removeBackground(p.img);
    const pngBuffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(tempPng, pngBuffer);

    // 2. ใส่พื้นหลังสีขาวล้วน 600x600 พร้อมจัดกึ่งกลาง
    execSync(`python scripts/make_white_square.py "${tempPng}" "${tempJpg}"`);

    // 3. อ่านไฟล์รูปและแปลงเป็น Base64
    const jpgBuffer = fs.readFileSync(tempJpg);
    const base64 = jpgBuffer.toString('base64');

    // 4. อัปโหลดขึ้น Cloudflare D1
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: pId,
        mimeType: 'image/jpeg',
        base64: base64
      })
    });

    const data = await res.json();
    if (data.status === 'success') {
      tracker[pId] = {
        name: pName,
        category: p.category,
        originalImg: p.img,
        newImg: data.imageUrl,
        processedAt: new Date().toISOString(),
        fileSizeKb: Math.round(jpgBuffer.length / 1024)
      };
      saveTracker();
      console.log(`    ✅ สำเร็จ! (${Math.round(jpgBuffer.length / 1024)} KB) -> ${data.imageUrl}\n`);
    } else {
      console.error(`    ❌ อัปโหลดไม่สำเร็จ: ${data.message || 'Unknown error'}\n`);
    }
  } catch (err) {
    console.error(`    ⚠️ เกิดข้อผิดพลาดกับ [${pId}]: ${err.message}\n`);
  } finally {
    // ลบไฟล์ชั่วคราว
    try { if (fs.existsSync(tempPng)) fs.unlinkSync(tempPng); } catch (e) {}
    try { if (fs.existsSync(tempJpg)) fs.unlinkSync(tempJpg); } catch (e) {}
  }
}

async function run() {
  const startTime = Date.now();
  for (let i = 0; i < targetProducts.length; i++) {
    await processProduct(targetProducts[i], i, targetProducts.length);
  }
  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log('====================================================');
  console.log(`🎉 ประมวลผลเสร็จสิ้น! ใช้เวลาทั้งหมด ${durationSec} วินาที`);
  console.log(`💾 บันทึกประวัติไว้ที่: scripts/processed_tracker.json`);
  console.log('====================================================');
}

run();

