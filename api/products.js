// Vercel Serverless Function — Proxy ดึงสินค้าจาก GAS แทนมือถือ
// มือถือ → Vercel CDN (เร็ว) → GAS (server-to-server เร็ว)
const GAS_URL = 'https://script.google.com/macros/s/AKfycby2Uyr4iy4R3UTtJAFHij1a_HLamAGrRUBKf-A7MU5JMS536GC-LOZkBqX2RSWw2pg1/exec';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Cache ไว้ 60 วินาทีบน Vercel CDN, stale-while-revalidate 5 นาที
  // ลูกค้าจะได้ข้อมูลจาก CDN cache ทันที ไม่ต้องรอ GAS
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // server-side timeout ยาวกว่าได้

    const response = await fetch(`${GAS_URL}?action=getProducts&_t=${Date.now()}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy fetch error:', error.message);
    return res.status(502).json({ 
      status: 'error', 
      message: 'ไม่สามารถเชื่อมต่อกับ Google Sheets ได้ในขณะนี้'
    });
  }
}
