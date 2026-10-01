const fs = require('fs');
const https = require('https');

const url = 'https://script.google.com/macros/s/AKfycby2Uyr4iy4R3UTtJAFHij1a_HLamAGrRUBKf-A7MU5JMS536GC-LOZkBqX2RSWw2pg1/exec?action=getProducts';

console.log('กำลังดึงข้อมูลสินค้าจาก Google Sheets...');

https.get(url, (res) => {
  // Handle redirects (Google Apps Script usually redirects to another URL)
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    console.log('พบการ Redirect, กำลังดึงข้อมูลจาก URL ใหม่...');
    https.get(res.headers.location, (redirectRes) => {
      let data = '';
      redirectRes.on('data', chunk => data += chunk);
      redirectRes.on('end', () => {
        saveData(data);
      });
    }).on('error', err => console.error('เกิดข้อผิดพลาด:', err.message));
  } else {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      saveData(data);
    });
  }
}).on('error', err => console.error('เกิดข้อผิดพลาด:', err.message));

function saveData(data) {
  try {
    // Validate if it's JSON
    JSON.parse(data);
    fs.writeFileSync('products.json', data);
    console.log('✅ อัปเดตข้อมูลลงไฟล์ products.json สำเร็จแล้ว! (กรุณากด Deploy หรืออัปเดตขึ้น Vercel ได้เลย)');
  } catch (e) {
    console.error('❌ ข้อมูลที่ได้มาไม่ใช่ JSON, กรุณาลองใหม่ หรือทำแบบ Copy/Paste แทนครับ');
  }
}
