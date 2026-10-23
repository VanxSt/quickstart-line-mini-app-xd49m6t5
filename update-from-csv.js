/**
 * สคริปต์สำหรับอัปเดตราคาและรูปภาพลงใน products.json และ Cloudflare D1
 * อิงจากไฟล์ CSV ของแท็บ test_api โดยเทียบจาก ID สินค้า
 *
 * วิธีใช้งาน:
 * 1. วางไฟล์ test_api.csv ในโฟลเดอร์นี้
 * 2. รันคำสั่ง: node update-from-csv.js test_api.csv
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const csvFileName = process.argv[2] || 'test_api.csv';
const csvPath = path.resolve(__dirname, csvFileName);
const productsJsonPath = path.resolve(__dirname, 'products.json');

if (!fs.existsSync(csvPath)) {
  console.log(`ℹ️ ไม่พบไฟล์ "${csvFileName}" ในโฟลเดอร์`);
  console.log('คำแนะนำ: คุณสามารถส่งออก (Download) ชีต test_api เป็นไฟล์ CSV มาวางในโฟลเดอร์นี้ แล้วรัน node update-from-csv.js ได้เลยครับ');
  process.exit(0);
}

console.log(`📂 กำลังอ่านไฟล์: ${csvFileName}...`);
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');

if (lines.length <= 1) {
  console.error('❌ ไฟล์ CSV ไม่มีข้อมูลสินค้า');
  process.exit(1);
}

// แยกหัวตาราง
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/["']/g, ''));
let colId = headers.findIndex(h => h === 'id' || h.includes('id') || h.includes('รหัส') || h.includes('barcode') || h.includes('sku'));
let colPrice = headers.findIndex(h => h === 'price' || h.includes('ราคา') || h.includes('price'));
let colImg = headers.findIndex(h => h === 'img' || h === 'image' || h.includes('รูป') || h.includes('link') || h.includes('url') || h.includes('ภาพ'));

if (colId === -1) colId = 0;
if (colPrice === -1) colPrice = 3;
if (colImg === -1) colImg = 5;

console.log(`🎯 ตรวจพบคอลัมน์: ID=${colId} ("${headers[colId] || ''}"), Price=${colPrice} ("${headers[colPrice] || ''}"), Img=${colImg} ("${headers[colImg] || ''}")`);

// แปลงข้อมูลจาก CSV
const testApiMap = new Map();
for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  const rawId = cols[colId];
  if (!rawId) continue;
  const cleanId = String(rawId).replace(/["']/g, '').trim();
  
  const rawPrice = cols[colPrice];
  const cleanPrice = rawPrice ? Number(String(rawPrice).replace(/[^0-9.]/g, '')) : null;

  const rawImg = cols[colImg];
  const cleanImg = rawImg ? String(rawImg).replace(/["']/g, '').trim() : '';

  testApiMap.set(cleanId, {
    price: (!isNaN(cleanPrice) && cleanPrice !== null) ? cleanPrice : null,
    img: cleanImg
  });
}

console.log(`📊 ดึงข้อมูลจาก ${csvFileName} ได้ทั้งหมด: ${testApiMap.size} รายการ`);

// อัปเดต products.json
if (!fs.existsSync(productsJsonPath)) {
  console.error('❌ ไม่พบไฟล์ products.json');
  process.exit(1);
}

const productsData = JSON.parse(fs.readFileSync(productsJsonPath, 'utf-8'));
const productsList = productsData.products || [];
let updatedCount = 0;

for (const product of productsList) {
  const pId = String(product.id).trim();
  if (testApiMap.has(pId)) {
    const item = testApiMap.get(pId);
    if (item.price !== null) {
      product.price = item.price;
    }
    // ลบลิ้งก์รูปเดิมและใส่อันใหม่จาก test_api
    product.img = item.img || '';
    updatedCount++;
  }
}

fs.writeFileSync(productsJsonPath, JSON.stringify(productsData, null, 2), 'utf-8');
console.log(`✅ อัปเดตราคาและรูปภาพลงใน products.json สำเร็จ: ${updatedCount} รายการ!`);
