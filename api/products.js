// Vercel Serverless Function — Proxy ดึงสินค้าจาก Cloudflare D1 Worker
// มือถือ → Vercel CDN (เร็ว) → Cloudflare Worker (server-to-server เร็ว)
const API_URL = 'https://kuekoonkan-api.noperfecf.workers.dev';
const GAS_URL = API_URL; // Alias for compatibility

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Cache ไว้ 60 วินาทีบน Vercel CDN, stale-while-revalidate 5 นาที
  // ลูกค้าจะได้ข้อมูลจาก CDN cache ทันที ไม่ต้องรอ Worker
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(`${API_URL}?action=getProducts&_t=${Date.now()}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy fetch error:', error.message);
    return res.status(502).json({ 
      status: 'error', 
      message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ฐานข้อมูลได้ในขณะนี้'
    });
  }
}
