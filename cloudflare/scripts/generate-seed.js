/**
 * Script แปลงข้อมูลสินค้าจาก products.json เป็น SQL Insert สำหรับ Cloudflare D1
 * หมายเหตุ: Cloudflare D1 ห้ามใช้ BEGIN TRANSACTION หรือ COMMIT
 */
const fs = require('fs');
const path = require('path');

const jsonPath = path.resolve(__dirname, '../../products.json');
const outputPath = path.resolve(__dirname, '../seed.sql');

console.log('กำลังอ่านไฟล์ products.json...');
const rawData = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(rawData);

const products = data.products || [];
console.log(`พบสินค้าทั้งหมด ${products.length} รายการ`);

function escapeSql(str) {
  if (str === null || str === undefined) return "''";
  return "'" + String(str).replace(/'/g, "''") + "'";
}

let sqlContent = '-- Auto-generated seed data for Cloudflare D1 (No BEGIN TRANSACTION)\n';

for (let i = 0; i < products.length; i++) {
  const p = products[i];
  const id = escapeSql(p.id);
  const name = escapeSql(p.name);
  const category = escapeSql(p.category || 'ทั่วไป');
  const price = Number(p.price || 0);
  const desc = escapeSql(p.desc || '');
  const img = escapeSql(p.img || '');
  const tag = escapeSql(p.tag || '');
  const status = escapeSql(p.status || 'active');

  sqlContent += `INSERT OR REPLACE INTO products (id, name, category, price, desc, img, tag, status) VALUES (${id}, ${name}, ${category}, ${price}, ${desc}, ${img}, ${tag}, ${status});\n`;
}

fs.writeFileSync(outputPath, sqlContent, 'utf8');
console.log(`✅ สร้างไฟล์ ${outputPath} สำเร็จเรียบร้อย! (${products.length} รายการ)`);
