/**
 * Cloudflare Worker Backend for ร้านเกื้อกูลกัน
 * เชื่อมต่อกับ Cloudflare D1 Database (SQLite Edge Database)
 * รองรับทั้ง Modern REST API (/api/...) และ Google Apps Script 100% Compatibility (?action=...)
 */

// Helper ส่งข้อความ JSON พร้อม CORS
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers,
    },
  });
}

// Helper ส่งหน้า HTML ตอบกลับ
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Helper: ตรวจสอบและจัดรูปแบบเบอร์โทรศัพท์ (Thai Phone Validation)
function cleanPhoneNumber(p) {
  if (!p) return '';
  let str = String(p).trim().replace(/[\s\-\(\)\.]/g, '');
  if (str.startsWith('+66')) {
    str = '0' + str.slice(3);
  } else if (str.startsWith('66') && str.length >= 11) {
    str = '0' + str.slice(2);
  }
  return str;
}

function isValidThaiPhone(p) {
  const clean = cleanPhoneNumber(p);
  // ต้องเป็นตัวเลข 9 หรือ 10 หลัก ขึ้นต้นด้วย 0
  if (!/^0[0-9]{8,9}$/.test(clean)) {
    return false;
  }
  // ป้องกันเลขซ้ำปลอม เช่น 0000000000 หรือ 0111111111 หรือ 001
  if (/^0([0-9])\1{7,8}$/.test(clean)) {
    return false;
  }
  return true;
}

// Flex Message Builder (ตรงตามระบบเดิม สวยงาม รองรับทุกสถานะ)
function buildStatusFlexMessage(title, orderId, bodyText, headerBgColor, name, phone, shippingOption, deliveryType, preorderTime, items, totalPrice, paymentMethod = '-') {
  const cartItems = Array.isArray(items) ? items : [];
  let calcSubtotal = 0;
  const itemBoxes = [];

  for (const item of cartItems) {
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.qty || 1);
    const itemTotal = itemPrice * itemQty;
    calcSubtotal += itemTotal;

    itemBoxes.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      spacing: 'md',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: String(item.name || 'สินค้า'),
              size: 'sm',
              wrap: true,
              weight: 'bold',
              color: '#1e293b',
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'xs',
              contents: [
                {
                  type: 'text',
                  text: `x${itemQty}  •  ฿${itemPrice.toLocaleString()}`,
                  size: 'xs',
                  color: '#64748b',
                  flex: 3,
                },
                {
                  type: 'text',
                  text: `฿${itemTotal.toLocaleString()}`,
                  size: 'xs',
                  weight: 'bold',
                  color: '#0f172a',
                  align: 'end',
                  flex: 2,
                },
              ],
            },
          ],
        },
      ],
    });
  }

  let calcShippingFee = Number(totalPrice) - calcSubtotal;
  if (calcShippingFee < 0) calcShippingFee = 0;

  const deliveryText = shippingOption === 'รับหน้าร้าน' ? '🏪 รับสินค้าเองที่หน้าร้าน' : '🚚 จัดส่งตามที่อยู่';
  const timeText = deliveryType === 'ล่วงหน้า' ? `🕒 สั่งล่วงหน้า (${preorderTime} น.)` : '🚀 ส่งทันที (ด่วนที่สุด)';

  return {
    type: 'flex',
    altText: `${title} (${orderId})`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBgColor || '#2563eb',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: title,
            weight: 'bold',
            size: 'xl',
            color: '#ffffff',
            wrap: true,
          },
          {
            type: 'text',
            text: `เลขที่: ${orderId}`,
            size: 'xs',
            color: '#ffffff',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f8fafc',
            cornerRadius: 'md',
            paddingAll: 'md',
            spacing: 'xs',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '👤 ผู้รับ', size: 'xs', color: '#64748b', flex: 2 },
                  { type: 'text', text: String(name || '-'), size: 'xs', color: '#0f172a', weight: 'bold', flex: 4 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '📞 เบอร์ติดต่อ', size: 'xs', color: '#64748b', flex: 2 },
                  { type: 'text', text: String(phone || '-'), size: 'xs', color: '#0f172a', weight: 'bold', flex: 4 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '🚚 การรับสินค้า', size: 'xs', color: '#64748b', flex: 2 },
                  { type: 'text', text: deliveryText, size: 'xs', color: '#059669', weight: 'bold', flex: 4 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '🕒 เวลาจัดส่ง/รับ', size: 'xs', color: '#64748b', flex: 2 },
                  { type: 'text', text: timeText, size: 'xs', color: '#dc2626', weight: 'bold', flex: 4, wrap: true },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '💳 ชำระเงินโดย :', size: 'xs', color: '#64748b', flex: 2 },
                  { type: 'text', text: paymentMethod || '-', size: 'xs', color: '#0f172a', weight: 'bold', flex: 4, wrap: true },
                ],
              },
            ],
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: '📦 รายการสินค้าที่สั่งซื้อ',
            weight: 'bold',
            size: 'sm',
            color: '#334155',
            margin: 'sm',
          },
          ...itemBoxes,
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'รวมค่าสินค้า', size: 'sm', color: '#64748b', flex: 3 },
              { type: 'text', text: `฿${calcSubtotal.toLocaleString()}`, size: 'sm', color: '#0f172a', align: 'end', flex: 3 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ค่าจัดส่ง', size: 'sm', color: '#64748b', flex: 3 },
              {
                type: 'text',
                text: calcShippingFee > 0 ? `฿${calcShippingFee.toLocaleString()}` : 'ฟรี (฿0)',
                size: 'sm',
                color: calcShippingFee > 0 ? '#0f172a' : '#16a34a',
                weight: 'bold',
                align: 'end',
                flex: 3,
              },
            ],
          },
          { type: 'separator', margin: 'sm' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'ยอดเงินรวมสุทธิ', size: 'md', color: '#0f172a', weight: 'bold', flex: 3 },
              { type: 'text', text: `฿${Number(totalPrice).toLocaleString()}`, size: 'xl', color: '#10b981', weight: 'bold', align: 'end', flex: 3 },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#f8fafc',
        paddingAll: '12px',
        contents: [
          {
            type: 'text',
            text: `✨ ${bodyText}`,
            size: 'xs',
            color: '#64748b',
            wrap: true,
            align: 'center',
          },
        ],
      },
    },
  };
}

// ส่งข้อความ LINE Push Message
async function sendLinePush(env, userId, messages) {
  if (!userId || userId === 'unknown' || userId === 'web-test-user' || !env.LINE_ACCESS_TOKEN) {
    return { skipped: true, reason: 'Invalid user or no token' };
  }
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.LINE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: userId.trim(),
        messages,
      }),
    });
    const resultText = await res.text();
    return { ok: res.ok, status: res.status, result: resultText };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ส่งข้อความตอบกลับ LINE Reply Message
async function sendLineReply(env, replyToken, messages) {
  if (!replyToken || !env.LINE_ACCESS_TOKEN) return { skipped: true };
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.LINE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Router หลักของ Cloudflare Worker
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const action = url.searchParams.get('action');

    // 1. ตอบสนอง CORS Preflight request
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      const db = env.DB || env.kuekoonkan_db;
      if (!db) {
        return jsonResponse({ status: 'error', message: 'D1 Database binding (env.DB or env.kuekoonkan_db) not found' }, 500);
      }

      // ==========================================
      // GET REQUEST ROUTING (GAS Compatibility & REST)
      // ==========================================
      if (method === 'GET') {
        // Health check
        if (url.pathname === '/' && !action && !url.searchParams.get('userId') && !url.searchParams.get('orderId')) {
          return jsonResponse({
            status: 'online',
            service: 'Kuekoonkan Cloudflare D1 Backend',
            timestamp: new Date().toISOString(),
          });
        }

        // Endpoint ดูรูปภาพสลิปโอนเงินตรงๆ: GET /api/orders/:orderId/slip หรือ ?action=getSlip&orderId=...
        const slipMatch = url.pathname.match(/^\/api\/orders\/([^\/]+)\/slip$/);
        const slipOrderId = slipMatch ? slipMatch[1] : (action === 'getSlip' ? url.searchParams.get('orderId') : null);

        if (slipOrderId) {
          try {
            await db.prepare(`
              CREATE TABLE IF NOT EXISTS order_slips (
                order_id TEXT PRIMARY KEY,
                mime_type TEXT DEFAULT 'image/jpeg',
                image_base64 TEXT,
                created_at TEXT
              )
            `).run();

            const row = await db.prepare('SELECT image_base64, mime_type FROM order_slips WHERE order_id = ?').bind(slipOrderId).first();
            if (!row || !row.image_base64) {
              return new Response('ไม่พบรูปภาพสลิปสำหรับออเดอร์นี้', {
                status: 404,
                headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
              });
            }

            const binaryString = atob(row.image_base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            return new Response(bytes.buffer, {
              status: 200,
              headers: {
                'Content-Type': row.mime_type || 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
              },
            });
          } catch(err) {
            return new Response('Error loading slip: ' + err.message, { status: 500 });
          }
        }

        // Action: getProducts OR GET /api/products
        if (action === 'getProducts' || url.pathname === '/api/products') {
          const includeAll = url.searchParams.get('all') === 'true';
          const category = url.searchParams.get('category');
          const search = url.searchParams.get('search');

          let query = 'SELECT * FROM products';
          const conditions = [];
          const bindings = [];

          if (!includeAll) {
            conditions.push("status != 'inactive'");
          }
          if (category && category !== 'ทั้งหมด') {
            conditions.push('category = ?');
            bindings.push(category);
          }
          if (search) {
            conditions.push('(name LIKE ? OR desc LIKE ? OR tag LIKE ?)');
            const term = `%${search}%`;
            bindings.push(term, term, term);
          }

          if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
          }
          query += ' ORDER BY id ASC';

          const stmt = bindings.length > 0 ? db.prepare(query).bind(...bindings) : db.prepare(query);
          const { results } = await stmt.all();

          const cleanedProducts = (results || []).map((row) => {
            if (row.img && typeof row.img === 'string' && row.img.includes('1779018898541-98193691087.jpg')) {
              return { ...row, img: '' };
            }
            return row;
          });

          return jsonResponse({
            status: 'success',
            products: cleanedProducts,
            total: cleanedProducts.length,
            cachedAt: Date.now(),
          });
        }

        // ==========================================
        // POSPOS DEVELOPER API (v0.3) INTEGRATION
        // ==========================================
        // Action: syncPospos OR GET/POST /api/pospos/sync
        if (action === 'syncPospos' || url.pathname === '/api/pospos/sync') {
          const apiKey = env.POSPOS_API_KEY;
          if (!apiKey) {
            return jsonResponse({ status: 'error', message: 'POSPOS_API_KEY ยังไม่ได้ตั้งค่าใน Cloudflare Worker vars' }, 500);
          }

          try {
            // ตรวจสอบและเพิ่มคอลัมน์ stock ในตาราง products อัตโนมัติ (Self-healing Schema)
            try {
              await db.prepare('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0').run();
            } catch (e) {}

            const posRes = await fetch('https://go.pospos.co/developer/api/stock', {
              headers: {
                'apikey': apiKey,
                'Accept': 'application/json',
                'User-Agent': 'Kuekoonkan-Worker/1.0'
              }
            });

            if (!posRes.ok) {
              const errText = await posRes.text();
              return jsonResponse({ status: 'error', message: `POSPOS API ตอบกลับสถานะ ${posRes.status}: ${errText}` }, posRes.status);
            }

            const rawData = await posRes.json();
            const items = Array.isArray(rawData) ? rawData : (rawData.data || rawData.stock || rawData.items || []);

            if (!Array.isArray(items) || items.length === 0) {
              return jsonResponse({ status: 'warning', message: 'POSPOS ตอบกลับข้อมูลสินค้าว่างเปล่า', count: 0 });
            }

            // 1. จัดทำ Map ข้อมูลสต็อกและราคาจาก POSPOS โดยใช้รหัสสินค้า (Barcode/ID) เป็นคีย์หลักเท่านั้น
            const posposMap = new Map();
            for (const item of items) {
              const barcode = String(item.barcode || item.code || item.product_code || item.sku || item.id || item._id || '').trim();
              if (!barcode) continue;
              const price = Number(item.price ?? item.retail_price ?? item.sell_price ?? item.normal_price ?? 0);
              const stock = Number(item.stock ?? item.quantity ?? item.qty ?? item.remain ?? item.balance ?? 0);
              posposMap.set(barcode, { price, stock });
            }

            // 2. ดึงรายการสินค้าที่มีอยู่ใน Mini App ปัจจุบันจาก D1 (หรือจากที่ Client ส่งมาถ้า D1 ยังว่าง)
            let clientProductIds = null;
            if (request.method === 'POST') {
              try {
                const body = await request.json();
                if (body && Array.isArray(body.productIds)) {
                  clientProductIds = body.productIds;
                }
              } catch (e) {}
            }

            let appProducts = [];
            try {
              const { results } = await db.prepare('SELECT id, price, stock, status FROM products').all();
              if (Array.isArray(results) && results.length > 0) {
                appProducts = results;
              }
            } catch (e) {}

            // ถ้า D1 ว่าง แต่ Client ส่งรายการสินค้ามา ให้ใช้รายการของ Client
            if (appProducts.length === 0 && clientProductIds && clientProductIds.length > 0) {
              appProducts = clientProductIds;
            }

            const totalAppProducts = appProducts.length;

            // 3. เตรียมคำสั่ง UPDATE โดยตรวจสอบจากรหัสสินค้า (id) ตรงกันเท่านั้น
            // ป้องกันการทับสถานะ inactive ที่แอดมินปิดการขายไว้
            const updateStmt = db.prepare(`
              UPDATE products
              SET price = CASE WHEN ? > 0 THEN ? ELSE price END,
                  stock = ?,
                  status = CASE WHEN ? <= 0 AND status != 'inactive' THEN 'out_of_stock'
                                WHEN ? > 0 AND status = 'out_of_stock' THEN 'active'
                                ELSE status END,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `);

            let matchedCount = 0;
            let updatedCount = 0;
            let unchangedCount = 0;
            let notFoundCount = 0;
            let failedCount = 0;
            const batch = [];
            const BATCH_SIZE = 50;

            for (const p of appProducts) {
              const pId = String(p.id || '').trim();
              if (!pId) continue;

              if (posposMap.has(pId)) {
                matchedCount++;
                const pos = posposMap.get(pId);
                const currentPrice = Number(p.price || 0);
                const currentStock = (p.stock === null || p.stock === undefined) ? -999999 : Number(p.stock);
                const currentStatus = String(p.status || '');

                // ตรวจสอบว่าราคา สต็อก หรือสถานะสินค้าเปลี่ยนแปลงจริงหรือไม่ (Changed Only)
                // ช่วยประหยัดโควตา Write ของ Cloudflare D1 ได้มากกว่า 95%
                const priceChanged = pos.price > 0 && Math.abs(currentPrice - pos.price) > 0.001;
                const stockChanged = currentStock !== pos.stock;
                const shouldBeOutOfStock = pos.stock <= 0 && currentStatus === 'active';
                const shouldBeActive = pos.stock > 0 && currentStatus === 'out_of_stock';
                const statusChanged = shouldBeOutOfStock || shouldBeActive;

                if (priceChanged || stockChanged || statusChanged) {
                  batch.push(updateStmt.bind(pos.price, pos.price, pos.stock, pos.stock, pos.stock, pId));
                  updatedCount++;

                  if (batch.length >= BATCH_SIZE) {
                    try {
                      await db.batch(batch.splice(0, batch.length));
                    } catch (batchErr) {
                      failedCount += BATCH_SIZE;
                      console.error('Batch update error:', batchErr);
                    }
                  }
                } else {
                  unchangedCount++;
                }
              } else {
                notFoundCount++;
              }
            }

            if (batch.length > 0) {
              try {
                await db.batch(batch);
              } catch (batchErr) {
                failedCount += batch.length;
                console.error('Final batch update error:', batchErr);
              }
            }

            return jsonResponse({
              status: 'success',
              message: 'ซิงค์ข้อมูลสต็อกและราคาจาก POSPOS สำหรับสินค้าใน Mini App สำเร็จ',
              totalFromPospos: items.length,
              totalInApp: totalAppProducts,
              matched: matchedCount,
              processed: matchedCount,
              updated: updatedCount,
              unchanged: unchangedCount,
              notFound: notFoundCount,
              failed: failedCount,
              syncedAt: new Date().toISOString()
            });
          } catch (syncErr) {
            return jsonResponse({ status: 'error', message: 'Sync POSPOS error: ' + syncErr.message }, 500);
          }
        }

        // Action: getPosposStockById OR GET /api/pospos/stock/:id
        if (action === 'getPosposStockById' || url.pathname.startsWith('/api/pospos/stock/')) {
          const apiKey = env.POSPOS_API_KEY;
          if (!apiKey) return jsonResponse({ status: 'error', message: 'POSPOS_API_KEY missing' }, 500);
          const posId = url.pathname.startsWith('/api/pospos/stock/') ? url.pathname.split('/')[4] : url.searchParams.get('id');
          if (!posId) return jsonResponse({ status: 'error', message: 'Missing product ID' }, 400);

          try {
            const res = await fetch(`https://go.pospos.co/developer/api/stock/${encodeURIComponent(posId)}`, {
              headers: { 'apikey': apiKey }
            });
            const data = await res.json();
            return jsonResponse({ status: 'success', data });
          } catch (e) {
            return jsonResponse({ status: 'error', message: e.message }, 500);
          }
        }

        // Action: getPosposMember OR GET /api/pospos/member/:phone
        if (action === 'getPosposMember' || url.pathname.startsWith('/api/pospos/member/')) {
          const apiKey = env.POSPOS_API_KEY;
          if (!apiKey) return jsonResponse({ status: 'error', message: 'POSPOS_API_KEY missing' }, 500);
          const rawPhone = url.pathname.startsWith('/api/pospos/member/') ? url.pathname.split('/')[4] : url.searchParams.get('phone');
          const clean = cleanPhoneNumber(rawPhone);

          if (!clean || !isValidThaiPhone(clean)) {
            return jsonResponse({ status: 'error', message: 'กรุณาระบุเบอร์โทรศัพท์ 10 หลักที่ถูกต้อง' }, 400);
          }

          try {
            const res = await fetch(`https://go.pospos.co/developer/api/member/find/phonenumber/${clean}`, {
              headers: {
                'apikey': apiKey,
                'Accept': 'application/json',
                'User-Agent': 'Kuekoonkan-App/1.0'
              }
            });

            if (res.status === 404) {
              return jsonResponse({ status: 'success', found: false, member: null });
            }

            if (!res.ok) {
              const errTxt = await res.text();
              return jsonResponse({ status: 'error', message: `POSPOS status ${res.status}: ${errTxt}` }, res.status);
            }

            const data = await res.json();
            const rawMember = data.data || data.member || data;

            // ตรวจสอบว่าพบสมาชิกจริงหรือไม่
            const isFound = Boolean(rawMember && (rawMember.name || rawMember.phonenumber || rawMember.phone || rawMember.id || rawMember.point !== undefined));

            if (!isFound) {
              return jsonResponse({ status: 'success', found: false, member: null });
            }

            // จัดรูปแบบข้อมูลสมาชิกมาตรฐานสำหรับร้านเกื้อกูลกัน
            const member = {
              name: rawMember.name || rawMember.fullname || rawMember.first_name || 'ลูกค้าสมาชิก',
              phone: clean,
              point: Number(rawMember.point ?? rawMember.points ?? rawMember.score ?? rawMember.reward_points ?? rawMember.total_point ?? 0),
              code: rawMember.code || rawMember.member_code || rawMember.id || '',
              group: rawMember.group || rawMember.member_group || rawMember.group_name || 'ทั่วไป'
            };

            return jsonResponse({ status: 'success', found: true, member });
          } catch (e) {
            return jsonResponse({ status: 'error', message: 'POSPOS API error: ' + e.message }, 500);
          }
        }

        // Action: getAllOrders OR GET /api/orders (Admin)
        if (action === 'getAllOrders' || (url.pathname === '/api/orders' && !url.searchParams.get('userId'))) {
          const { results } = await db.prepare('SELECT * FROM orders ORDER BY timestamp DESC').all();
          const orders = (results || []).map((row) => {
            let items = [];
            try {
              if (row.items_json) items = JSON.parse(row.items_json);
            } catch (e) {}

            return {
              timestamp: row.timestamp,
              orderId: row.order_id,
              userId: row.user_id,
              customerName: row.customer_name,
              phone: row.phone,
              gpsLocation: row.gps_location,
              addressDetails: row.address_details,
              slipUrl: row.slip_url,
              totalPrice: Number(row.total_price || 0),
              status: row.status || 'รอตรวจสอบ',
              paymentMethod: row.payment_method || 'ปลายทาง',
              items,
              itemsText: row.items_text,
              deliveryType: row.delivery_type || 'ทันที',
              preorderTime: row.preorder_time || '',
              shippingOption: row.shipping_option || 'จัดส่ง',
              note: row.note || '',
            };
          });

          return jsonResponse({ status: 'success', orders });
        }

        // Action: getMyOrders OR GET /api/orders?userId=...
        if (action === 'getMyOrders' || (url.pathname === '/api/orders' && url.searchParams.get('userId'))) {
          const userId = url.searchParams.get('userId');
          if (!userId) {
            return jsonResponse({ status: 'error', message: 'Missing userId' }, 400);
          }

          const { results } = await db
            .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY timestamp DESC')
            .bind(userId)
            .all();

          const orders = (results || []).map((row) => {
            let items = [];
            try {
              if (row.items_json) items = JSON.parse(row.items_json);
            } catch (e) {}
            return {
              timestamp: row.timestamp,
              orderId: row.order_id,
              totalPrice: Number(row.total_price || 0),
              status: row.status || 'รอตรวจสอบ',
              slipUrl: row.slip_url || '',
              items,
            };
          });

          return jsonResponse({ status: 'success', orders });
        }

        // Action: getAllMembers OR GET /api/members
        if (action === 'getAllMembers' || (url.pathname === '/api/members' && !url.searchParams.get('userId'))) {
          const { results } = await db.prepare('SELECT * FROM members ORDER BY registered_at DESC').all();
          const members = (results || []).map((m) => ({
            registeredAt: m.registered_at,
            userId: m.user_id,
            displayName: m.display_name,
            statusMessage: m.status_message,
            email: m.email,
            pictureUrl: m.picture_url,
            phone: m.phone,
            gpsLocation: m.gps_location,
            addressDetails: m.address_details,
            addressLabel: m.address_label,
            savedAddresses: m.saved_addresses_json || '[]',
          }));
          return jsonResponse({ status: 'success', members });
        }

        // Action: Member Profile Lookup (via ?userId=... OR /api/members?userId=...)
        if (url.searchParams.get('userId') && (!action || action === 'getMember')) {
          const userId = url.searchParams.get('userId');
          const member = await db.prepare('SELECT * FROM members WHERE user_id = ?').bind(userId).first();
          if (!member) {
            return jsonResponse({ status: 'success', found: false });
          }
          return jsonResponse({
            status: 'success',
            found: true,
            userId: member.user_id,
            displayName: member.display_name,
            statusMessage: member.status_message,
            email: member.email,
            pictureUrl: member.picture_url,
            phone: member.phone,
            gpsLocation: member.gps_location,
            addressDetails: member.address_details,
            addressLabel: member.address_label,
            savedAddresses: member.saved_addresses_json || '[]',
          });
        }

        // Action: confirmOrder (เปิดผ่านลิงก์ LINE ใน Browser)
        if (action === 'confirmOrder' || url.pathname === '/confirmOrder') {
          const orderId = url.searchParams.get('orderId');
          if (orderId) {
            await db.prepare("UPDATE orders SET status = 'ชำระเงิน' WHERE order_id = ?").bind(orderId).run();
          }
          return htmlResponse(`
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <div style="text-align:center; padding:50px 20px; font-family:sans-serif;">
              <h1 style="color:#22c55e; font-size:48px; margin-bottom:10px;">✅</h1>
              <h2 style="color:#22c55e; margin-top:0;">ยืนยันสำเร็จ</h2>
              <p>ระบบได้เปลี่ยนสถานะออเดอร์ <b>${orderId || ''}</b> เป็น "ชำระเงิน" เรียบร้อยแล้วครับ</p>
              <p style="color:#666; font-size:14px; margin-top:30px;">คุณสามารถปิดหน้านี้เพื่อกลับไปที่แชท LINE ได้เลยครับ</p>
            </div>
          `);
        }

        // Action: cancelOrder (เปิดผ่านลิงก์ LINE ใน Browser)
        if (action === 'cancelOrder' || url.pathname === '/cancelOrder') {
          const orderId = url.searchParams.get('orderId');
          if (orderId) {
            await db.prepare("UPDATE orders SET status = 'ยกเลิก' WHERE order_id = ?").bind(orderId).run();
          }
          return htmlResponse(`
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <div style="text-align:center; padding:50px 20px; font-family:sans-serif;">
              <h1 style="color:#ef4444; font-size:48px; margin-bottom:10px;">❌</h1>
              <h2 style="color:#ef4444; margin-top:0;">ยกเลิกออเดอร์แล้ว</h2>
              <p>ระบบได้ยกเลิกออเดอร์ <b>${orderId || ''}</b> เรียบร้อยแล้วครับ</p>
              <p style="color:#666; font-size:14px; margin-top:30px;">คุณสามารถปิดหน้านี้เพื่อกลับไปที่แชท LINE ได้เลยครับ</p>
            </div>
          `);
        }

        // Action: clearProductCache
        if (action === 'clearProductCache') {
          return jsonResponse({ status: 'success', message: 'ล้าง Cache เรียบร้อย' });
        }

        // Action: getInactiveProducts OR GET /api/products/inactive (ดึงเฉพาะรหัสสินค้าที่ถูกปิด เพื่อซ่อนจากลูกค้าทันที)
        if (action === 'getInactiveProducts' || url.pathname === '/api/products/inactive') {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS product_statuses (
              id TEXT PRIMARY KEY,
              status TEXT DEFAULT 'active',
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `).run();

          const { results: fromStatuses } = await db.prepare("SELECT id FROM product_statuses WHERE status = 'inactive'").all();
          let inactiveIds = (fromStatuses || []).map(r => String(r.id));

          try {
            const { results: fromProducts } = await db.prepare("SELECT id FROM products WHERE status = 'inactive'").all();
            if (fromProducts && fromProducts.length > 0) {
              const set = new Set(inactiveIds);
              fromProducts.forEach(r => set.add(String(r.id)));
              inactiveIds = Array.from(set);
            }
          } catch(e) {}

          return jsonResponse({
            status: 'success',
            inactiveIds: inactiveIds,
            total: inactiveIds.length
          });
        }

        // Action: updateProductStatus (GET fallback)
        if (action === 'updateProductStatus') {
          const targetId = url.searchParams.get('id') || url.searchParams.get('productId');
          const rawStatus = url.searchParams.get('status');
          const newStatus = (rawStatus === 'inactive' || rawStatus === false || rawStatus === '0') ? 'inactive' : 'active';
          if (targetId) {
            await db.prepare(`
              CREATE TABLE IF NOT EXISTS product_statuses (
                id TEXT PRIMARY KEY,
                status TEXT DEFAULT 'active',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `).run();

            await db.prepare(`
              INSERT INTO product_statuses (id, status, updated_at)
              VALUES (?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP
            `).bind(String(targetId), newStatus).run();

            try {
              await db.prepare("UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(newStatus, String(targetId))
                .run();
            } catch(e) {}
          }
          return jsonResponse({ status: 'success', id: targetId, productStatus: newStatus });
        }

        // Action: getPromoCodes OR GET /api/promos
        if (action === 'getPromoCodes' || url.pathname === '/api/promos') {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS promo_codes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              code TEXT UNIQUE,
              type TEXT DEFAULT 'fixed',
              amount REAL DEFAULT 0,
              percent REAL DEFAULT 0,
              min_spend REAL DEFAULT 0,
              description TEXT,
              start_date TEXT,
              end_date TEXT,
              is_active INTEGER DEFAULT 1,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run();

          // Auto-seed defaults if table is empty
          const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM promo_codes').first();
          if (!countRow || countRow.cnt === 0) {
            const seedQuery = `
              INSERT OR IGNORE INTO promo_codes (code, type, amount, percent, min_spend, description, start_date, end_date, is_active)
              VALUES 
                ('WELCOME50', 'fixed', 50, 0, 100, 'ส่วนลด ฿50 เมื่อสั่งซื้อขั้นต่ำ ฿100', '', '', 1),
                ('FREESHIP', 'shipping', 0, 0, 0, 'ฟรีค่าจัดส่งทุกระยะทาง', '', '', 1),
                ('KUE10', 'percent', 0, 10, 150, 'ลด 10% เมื่อสั่งซื้อขั้นต่ำ ฿150', '', '', 1),
                ('BAKERY20', 'fixed', 20, 0, 60, 'ส่วนลด ฿20 สำหรับวัตถุดิบและเบเกอรี่', '', '', 1)
            `;
            await db.prepare(seedQuery).run();
          }

          const activeOnly = url.searchParams.get('activeOnly') === 'true';
          const { results } = await db.prepare('SELECT * FROM promo_codes ORDER BY id DESC').all();
          let promos = results || [];

          if (activeOnly) {
            const todayStr = new Date().toISOString().slice(0, 10);
            promos = promos.filter(p => {
              if (Number(p.is_active) !== 1) return false;
              if (p.start_date && p.start_date.trim() !== '' && todayStr < p.start_date.trim()) return false;
              if (p.end_date && p.end_date.trim() !== '' && todayStr > p.end_date.trim()) return false;
              return true;
            });
          }

          return jsonResponse({
            status: 'success',
            promos: promos,
            total: promos.length
          });
        }
      }

      // ==========================================
      // POST REQUEST ROUTING (GAS Compatibility & REST)
      // ==========================================
      if (method === 'POST') {
        let postData = {};
        try {
          const rawText = await request.text();
          if (rawText) postData = JSON.parse(rawText);
        } catch (e) {
          postData = {};
        }

        const postAction = postData.action || '';

        // 1. ตรวจสอบ LINE Webhook Events
        if (url.pathname === '/webhook' || (postData.events && Array.isArray(postData.events))) {
          const events = postData.events || [];
          for (const ev of events) {
            // A. ลูกค้าส่งสลิปโอนเงิน (Image Message)
            if (ev.type === 'message' && ev.message && ev.message.type === 'image') {
              const userId = ev.source ? ev.source.userId : '';
              const messageId = ev.message.id;

              if (userId && messageId) {
                try {
                  // ค้นหาออเดอร์ของลูกค้ารายนี้ที่รอชำระเงินหรือรอตรวจสอบ
                  let order = await db
                    .prepare(`
                      SELECT order_id, status, customer_name FROM orders 
                      WHERE user_id = ? AND status IN ('ชำระเงิน', 'รอชำระเงิน', 'รอตรวจสอบ', 'กำลังตรวจสอบออเดอร์')
                      ORDER BY timestamp DESC LIMIT 1
                    `)
                    .bind(userId)
                    .first();

                  if (!order) {
                    order = await db
                      .prepare(`
                        SELECT order_id, status, customer_name FROM orders 
                        WHERE user_id = ? AND status != 'ยกเลิก'
                        ORDER BY timestamp DESC LIMIT 1
                      `)
                      .bind(userId)
                      .first();
                  }

                  if (order && order.order_id) {
                    // ⚡ 1. ส่ง Flex Message ตอบกลับลูกค้ายืนยันทันที! (< 0.5 วินาที ลูกค้าจะเห็นข้อความทันที ไม่ต้องรอโหลดรูป)
                    if (ev.replyToken) {
                      await sendLineReply(env, ev.replyToken, [
                        {
                          type: 'flex',
                          altText: `🧾 ได้รับสลิปโอนเงินเรียบร้อยแล้ว (${order.order_id})`,
                          contents: {
                            type: 'bubble',
                            header: {
                              type: 'box',
                              layout: 'vertical',
                              backgroundColor: '#16a34a',
                              paddingAll: '16px',
                              contents: [
                                {
                                  type: 'text',
                                  text: '🧾 ได้รับสลิปโอนเงินแล้ว',
                                  color: '#ffffff',
                                  weight: 'bold',
                                  size: 'md',
                                },
                                {
                                  type: 'text',
                                  text: `เลขออเดอร์: ${order.order_id}`,
                                  color: '#ffffff',
                                  size: 'xs',
                                  margin: 'xs',
                                },
                              ],
                            },
                            body: {
                              type: 'box',
                              layout: 'vertical',
                              spacing: 'sm',
                              contents: [
                                {
                                  type: 'text',
                                  text: `ขอบคุณครับ! ระบบบันทึกสลิปโอนเงินของ ${order.customer_name || 'คุณลูกค้า'} เรียบร้อยแล้ว ✨`,
                                  size: 'sm',
                                  weight: 'bold',
                                  color: '#0f172a',
                                },
                                {
                                  type: 'text',
                                  text: 'แอดมินกำลังตรวจสอบยอดเงินและจัดเตรียมออเดอร์ให้ทันทีครับ รอรับของอร่อยได้เลย! 🧑‍🍳🛵',
                                  size: 'xs',
                                  wrap: true,
                                  color: '#64748b',
                                },
                              ],
                            },
                          },
                        },
                      ]);
                    }

                    // ⚡ 2. ทำงานดาวน์โหลดรูปจาก LINE + บันทึกลง D1 ใน Background ผ่าน ctx.waitUntil ไม่บล็อกการตอบกลับ
                    const saveSlipTask = async () => {
                      try {
                        const imgRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
                          headers: { Authorization: `Bearer ${env.LINE_ACCESS_TOKEN}` },
                        });

                        if (imgRes.ok) {
                          const arrayBuffer = await imgRes.arrayBuffer();
                          const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

                          // แปลง Binary ArrayBuffer เป็น Base64 อย่างรวดเร็ว
                          let binary = '';
                          const bytes = new Uint8Array(arrayBuffer);
                          const len = bytes.byteLength;
                          const chunkSize = 32768;
                          for (let i = 0; i < len; i += chunkSize) {
                            binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
                          }
                          const base64 = btoa(binary);

                          // บันทึกลงตาราง order_slips ใน Cloudflare D1
                          await db
                            .prepare(`
                              INSERT INTO order_slips (order_id, mime_type, image_base64, created_at)
                              VALUES (?, ?, ?, ?)
                              ON CONFLICT(order_id) DO UPDATE SET
                                mime_type = excluded.mime_type,
                                image_base64 = excluded.image_base64,
                                created_at = excluded.created_at
                            `)
                            .bind(order.order_id, mimeType, base64, new Date().toISOString())
                            .run();

                          // URL รูปภาพสลิปของ Cloudflare Worker
                          const slipUrl = `${url.origin}/api/orders/${order.order_id}/slip`;

                          // อัปเดตตาราง orders
                          await db
                            .prepare(`
                              UPDATE orders SET slip_url = ?, status = 'ชำระเงิน' WHERE order_id = ?
                            `)
                            .bind(slipUrl, order.order_id)
                            .run();
                        }
                      } catch (err) {
                        console.error('Background slip save error:', err);
                      }
                    };

                    if (ctx && typeof ctx.waitUntil === 'function') {
                      ctx.waitUntil(saveSlipTask());
                    } else {
                      await saveSlipTask();
                    }
                  } else {
                    if (ev.replyToken) {
                      await sendLineReply(env, ev.replyToken, [
                        {
                          type: 'text',
                          text: 'ได้รับรูปภาพสลิปเรียบร้อยแล้วครับ! หากต้องการระบุเลขออเดอร์ สามารถพิมพ์เลขออเดอร์ (เช่น ORD-...) ส่งมาในแชทนี้ได้เลยนะครับ แอดมินจะรีบตรวจสอบให้ครับ 🙏',
                        },
                      ]);
                    }
                  }
                } catch (e) {
                  console.error('Error handling line slip in cloudflare:', e);
                }
              }
            }

            // B. ลูกค้ากดปุ่มยืนยัน/ยกเลิกจาก Flex Message
            if (ev.type === 'postback' && ev.postback && ev.postback.data) {
              const params = new URLSearchParams(ev.postback.data);
              const pbAction = params.get('action');
              const pbOrderId = params.get('orderId');

              if (pbOrderId && (pbAction === 'cancelOrder' || pbAction === 'confirmOrder')) {
                const newStatus = pbAction === 'cancelOrder' ? 'ยกเลิก' : 'ชำระเงิน';
                await db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').bind(newStatus, pbOrderId).run();
              }
            }
          }
          return jsonResponse({ status: 'ok' });
        }

        // 1.5 Action: uploadSlip OR POST /api/orders/upload-slip (สำหรับแอดมินหรือหน้าเว็บแนบสลิป)
        if (postAction === 'uploadSlip' || url.pathname === '/api/orders/upload-slip') {
          const orderId = postData.orderId;
          const slipUrlInput = postData.slipUrl || '';
          const base64Data = postData.base64 || '';

          if (!orderId) {
            return jsonResponse({ status: 'error', message: 'Missing orderId' }, 400);
          }

          await db.prepare(`
            CREATE TABLE IF NOT EXISTS order_slips (
              order_id TEXT PRIMARY KEY,
              mime_type TEXT DEFAULT 'image/jpeg',
              image_base64 TEXT,
              created_at TEXT
            )
          `).run();

          let finalSlipUrl = slipUrlInput;

          if (base64Data) {
            const cleanedBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
            const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/);
            const mimeType = (mimeMatch && mimeMatch[1]) ? mimeMatch[1] : 'image/jpeg';

            await db
              .prepare(`
                INSERT INTO order_slips (order_id, mime_type, image_base64, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(order_id) DO UPDATE SET
                  mime_type = excluded.mime_type,
                  image_base64 = excluded.image_base64,
                  created_at = excluded.created_at
              `)
              .bind(orderId, mimeType, cleanedBase64, new Date().toISOString())
              .run();

            finalSlipUrl = `${url.origin}/api/orders/${orderId}/slip`;
          }

          if (finalSlipUrl) {
            await db
              .prepare(`
                UPDATE orders SET slip_url = ?, status = CASE WHEN status IN ('รอชำระเงิน', 'รอตรวจสอบ') THEN 'ชำระเงิน' ELSE status END 
                WHERE order_id = ?
              `)
              .bind(finalSlipUrl, orderId)
              .run();

            return jsonResponse({ status: 'success', slipUrl: finalSlipUrl });
          }

          return jsonResponse({ status: 'error', message: 'No slip URL or file provided' }, 400);
        }

        // 2. Action: createOrder OR POST /api/orders
        if (postAction === 'createOrder' || url.pathname === '/api/orders') {
          const data = postData;

          // บังคับตรวจสอบเบอร์โทรศัพท์ให้ถูกต้อง (ห้ามเว้นวรรค หรือ 001)
          const rawPhone = data.phone || '';
          const cleanPhone = cleanPhoneNumber(rawPhone);
          if (!rawPhone || !isValidThaiPhone(cleanPhone)) {
            return jsonResponse({
              status: 'error',
              message: 'กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (10 หลัก ขึ้นต้นด้วย 0 เช่น 08X-XXX-XXXX)'
            }, 400);
          }

          const timestamp = new Date();
          const rand = Math.floor(Math.random() * 1000);
          const orderId =
            data.orderId ||
            `ORD-${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(
              timestamp.getDate()
            ).padStart(2, '0')}-${String(timestamp.getHours()).padStart(2, '0')}${String(
              timestamp.getMinutes()
            ).padStart(2, '0')}${String(timestamp.getSeconds()).padStart(2, '0')}-${rand}`;

          const items = data.items || [];
          const itemsText = items.map((it) => `${it.name} x${it.qty}`).join(', ');
          const itemsJson = JSON.stringify(items);

          let displayAddress = data.addressDetails || '';
          if (data.shippingOption === 'รับหน้าร้าน') {
            displayAddress = `🏪 [รับหน้าร้าน] ${
              data.deliveryType === 'ล่วงหน้า' && data.preorderTime ? `🕒 สั่งล่วงหน้า: ${data.preorderTime} น.` : 'รับทันที'
            }`;
          } else if (data.deliveryType === 'ล่วงหน้า' && data.preorderTime) {
            displayAddress = `🕒 [สั่งล่วงหน้า: ${data.preorderTime} น.] ${data.addressDetails || ''}`;
          }
          if (data.couponCode && Number(data.discountAmount) > 0) {
            displayAddress += `\n🎟️ โค้ดส่วนลด: ${data.couponCode} (-฿${Number(data.discountAmount).toLocaleString()})`;
          }
          if (data.note) {
            displayAddress += `\n📝 หมายเหตุ: ${data.note.trim()}`;
          }

          const insertQuery = `
            INSERT INTO orders (
              order_id, user_id, customer_name, phone, gps_location, address_details,
              slip_url, total_price, status, payment_method, items_text, items_json,
              delivery_type, preorder_time, shipping_option, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          await db
            .prepare(insertQuery)
            .bind(
              orderId,
              data.userId || 'unknown',
              data.displayName || data.customerName || '',
              cleanPhone,
              data.gpsLocation || '',
              displayAddress,
              data.slipUrl || '',
              Number(data.totalPrice || 0),
              'รอตรวจสอบ',
              data.paymentMethod || 'ปลายทาง',
              itemsText,
              itemsJson,
              data.deliveryType || 'ทันที',
              data.preorderTime || '',
              data.shippingOption || 'จัดส่ง',
              data.note || ''
            )
            .run();

          // บันทึก/อัปเดตที่อยู่สมาชิกล่าสุด
          if (data.userId && data.userId !== 'unknown' && data.userId !== 'web-test-user') {
            try {
              const member = await db.prepare('SELECT * FROM members WHERE user_id = ?').bind(data.userId).first();
              let savedAddresses = [];
              if (member && member.saved_addresses_json) {
                try {
                  savedAddresses = JSON.parse(member.saved_addresses_json);
                } catch (e) {}
              }

              if (data.shippingOption !== 'รับหน้าร้าน' && data.gpsLocation) {
                const exists = savedAddresses.some(
                  (a) => a.gpsLocation === data.gpsLocation && a.addressDetails === data.addressDetails
                );
                if (!exists) {
                  savedAddresses.unshift({
                    label: data.addressLabel || 'ที่อยู่ของฉัน',
                    gpsLocation: data.gpsLocation,
                    addressDetails: data.addressDetails,
                  });
                  if (savedAddresses.length > 5) savedAddresses.pop();
                }
              }

              const memberQuery = `
                INSERT INTO members (user_id, display_name, phone, gps_location, address_details, address_label, saved_addresses_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                  display_name = COALESCE(NULLIF(excluded.display_name, ''), members.display_name),
                  phone = COALESCE(NULLIF(excluded.phone, ''), members.phone),
                  gps_location = excluded.gps_location,
                  address_details = excluded.address_details,
                  address_label = excluded.address_label,
                  saved_addresses_json = excluded.saved_addresses_json,
                  updated_at = CURRENT_TIMESTAMP
              `;

              await db
                .prepare(memberQuery)
                .bind(
                  data.userId,
                  data.displayName || '',
                  cleanPhone,
                  data.gpsLocation || '',
                  data.addressDetails || '',
                  data.addressLabel || '',
                  JSON.stringify(savedAddresses)
                )
                .run();
            } catch (e) {
              console.error('Member address update error:', e);
            }
          }

          return jsonResponse({ status: 'success', orderId });
        }

        // 3. Action: updateOrderStatus OR POST /api/orders/status
        if (postAction === 'updateOrderStatus' || url.pathname === '/api/orders/status') {
          const { orderId, status } = postData;
          if (!orderId || !status) {
            return jsonResponse({ status: 'error', message: 'Missing orderId or status' }, 400);
          }

          const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
          if (!order) {
            return jsonResponse({ status: 'error', message: 'Order not found' }, 404);
          }

          await db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').bind(status, orderId).run();

          // ส่ง LINE Message แจ้งเตือนลูกค้า
          let items = [];
          try {
            if (order.items_json) items = JSON.parse(order.items_json);
          } catch (e) {}

          const messages = [];
          const pm = order.payment_method || '';

          if (
            (status === 'ชำระเงิน' || status === 'รอชำระเงิน') &&
            (pm.includes('โอน') || pm.includes('บัญชีธนาคาร') || pm.includes('ผสม'))
          ) {
            messages.push(
              buildStatusFlexMessage(
                '💳 ยืนยันออเดอร์ & แจ้งชำระเงิน',
                orderId,
                'แอดมินยืนยันออเดอร์แล้วครับ คุณลูกค้าสามารถโอนเงินตาม QR Code ด้านล่างนี้ แล้วแนบสลิปมาได้เลยครับ ✨',
                '#2563eb',
                order.customer_name,
                order.phone,
                order.shipping_option,
                order.delivery_type,
                order.preorder_time,
                items,
                order.total_price,
                pm
              )
            );

            let qrAmount = Number(order.total_price || 0);
            if (pm.includes('โอนเงินผสมเงินสด')) {
              const match = pm.match(/- โอน (\d+(?:\.\d+)?) บาท/);
              if (match && match[1]) qrAmount = Number(match[1]);
            }

            const dynamicQrUrl = `https://promptpay.io/${env.SHOP_PROMPTPAY_ID || '0957579454'}/${qrAmount}.png`;
            messages.push({
              type: 'image',
              originalContentUrl: dynamicQrUrl,
              previewImageUrl: dynamicQrUrl,
            });

            // Quick Reply ให้ลูกค้ากดแนบสลิปจากอัลบั้มหรือกล้อง
            messages.push({
              type: 'text',
              text: '💡 เมื่อโอนเงินเรียบร้อยแล้ว สามารถกดปุ่มด้านล่างนี้เพื่อเลือกรูปสลิปจากอัลบั้ม หรือถ่ายรูปส่งกลับมาในแชทนี้ได้ทันทีครับ ระบบจะบันทึกสลิปให้อัตโนมัติครับ 👇',
              quickReply: {
                items: [
                  {
                    type: 'action',
                    action: {
                      type: 'cameraRoll',
                      label: '📸 แนบสลิปจากอัลบั้ม',
                    },
                  },
                  {
                    type: 'action',
                    action: {
                      type: 'camera',
                      label: '📷 ถ่ายรูปสลิป',
                    },
                  },
                ],
              },
            });
          } else if (status === 'กำลังจัดเตรียมสินค้า' || status === 'เตรียมออเดอร์' || status === 'จัดเตรียมสินค้าพร้อมส่ง') {
            messages.push(
              buildStatusFlexMessage(
                '📦 กำลังจัดเตรียมสินค้า',
                orderId,
                'แอดมินกำลังจัดเตรียมออเดอร์ให้คุณลูกค้าอย่างตั้งใจครับ รอรับความอร่อยได้เลย! 🧑‍🍳✨',
                '#f59e0b',
                order.customer_name,
                order.phone,
                order.shipping_option,
                order.delivery_type,
                order.preorder_time,
                items,
                order.total_price,
                pm
              )
            );
          } else if (status === 'กำลังจัดส่ง') {
            messages.push(
              buildStatusFlexMessage(
                '🚚 สินค้าอยู่ระหว่างจัดส่ง',
                orderId,
                'พี่ไรเดอร์กำลังนำสินค้าส่งตรงไปถึงคุณลูกค้าแล้วครับ! ขอบคุณที่อุดหนุนครับ 😊🛵',
                '#8b5cf6',
                order.customer_name,
                order.phone,
                order.shipping_option,
                order.delivery_type,
                order.preorder_time,
                items,
                order.total_price,
                pm
              )
            );
          } else if (status === 'จัดส่งสำเร็จ' || status === 'ยืนยันแล้ว') {
            messages.push(
              buildStatusFlexMessage(
                '🎉 จัดส่งสินค้าสำเร็จเรียบร้อย',
                orderId,
                'สินค้าถึงมือคุณลูกค้าเรียบร้อยแล้ว ทานให้อร่อยนะค้าบ! ขอบคุณที่อุดหนุนร้านเกื้อกูลกันครับ 🥰❤️',
                '#16a34a',
                order.customer_name,
                order.phone,
                order.shipping_option,
                order.delivery_type,
                order.preorder_time,
                items,
                order.total_price,
                pm
              )
            );
          } else if (status === 'ยกเลิก') {
            messages.push(
              buildStatusFlexMessage(
                '🥺 แจ้งยกเลิกออเดอร์',
                orderId,
                'ทางร้านจำเป็นต้องขออนุญาตยกเลิกออเดอร์นี้ชั่วคราวครับ 🙏❤️ ต้องขออภัยในความไม่สะดวกเป็นอย่างยิ่งเลยนะครับ หวังว่าจะได้รับโอกาสดูแลคุณลูกค้าใหม่ในโอกาสหน้านะครับ 🥰✨',
                '#dc2626',
                order.customer_name,
                order.phone,
                order.shipping_option,
                order.delivery_type,
                order.preorder_time,
                items,
                order.total_price,
                pm
              )
            );
          }

          if (messages.length > 0 && order.user_id) {
            if (ctx && typeof ctx.waitUntil === 'function') {
              ctx.waitUntil(sendLinePush(env, order.user_id, messages));
            } else {
              await sendLinePush(env, order.user_id, messages);
            }
          }

          return jsonResponse({ status: 'success' });
        }

        // 4. Action: updateOrderItems OR POST /api/orders/items
        if (postAction === 'updateOrderItems' || url.pathname === '/api/orders/items') {
          const { orderId, items, totalPrice, changeNote } = postData;
          const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
          if (!order) {
            return jsonResponse({ status: 'error', message: 'Order not found' }, 404);
          }

          const newItems = items || [];
          const itemsText = newItems.map((it) => `${it.name} x${it.qty}`).join(', ');
          const itemsJson = JSON.stringify(newItems);
          const newTotal = Number(totalPrice || 0);

          await db
            .prepare(
              "UPDATE orders SET items_text = ?, items_json = ?, total_price = ?, status = 'รอการยืนยัน' WHERE order_id = ?"
            )
            .bind(itemsText, itemsJson, newTotal, orderId)
            .run();

          // แจ้งเตือนลูกค้าพร้อมปุ่ม Postback ให้กดยืนยันหรือยกเลิก
          if (order.user_id && order.user_id !== 'unknown' && order.user_id !== 'web-test-user') {
            let bodyText = 'ทางร้านได้อัปเดตราคาสินค้า/จำนวนเรียบร้อยแล้วครับ';
            if (changeNote && changeNote.trim()) {
              bodyText += ` (หมายเหตุ: ${changeNote.trim()})`;
            }

            const flexMsg = buildStatusFlexMessage(
              '✏️ แจ้งปรับเปลี่ยนออเดอร์',
              orderId,
              bodyText,
              '#0f766e',
              order.customer_name,
              order.phone,
              order.shipping_option,
              order.delivery_type,
              order.preorder_time,
              newItems,
              newTotal,
              order.payment_method
            );

            const confirmTemplate = {
              type: 'template',
              altText: 'กรุณายืนยันการเปลี่ยนแปลงออเดอร์',
              template: {
                type: 'buttons',
                text: 'คุณลูกค้ายืนยันรับออเดอร์ที่แก้ไขนี้หรือไม่ครับ?',
                actions: [
                  {
                    type: 'postback',
                    label: '✅ ยืนยันรายการสั่งซื้อ',
                    data: `action=confirmOrder&orderId=${orderId}`,
                    displayText: 'ลูกค้ายืนยันรับออเดอร์ที่แก้ไขนี้ครับ',
                  },
                  {
                    type: 'postback',
                    label: '❌ ยกเลิกคำสั่งซื้อ',
                    data: `action=cancelOrder&orderId=${orderId}`,
                    displayText: 'ลูกค้าขอยกเลิกออเดอร์นี้ครับ',
                  },
                ],
              },
            };

            if (ctx && typeof ctx.waitUntil === 'function') {
              ctx.waitUntil(sendLinePush(env, order.user_id, [flexMsg, confirmTemplate]));
            } else {
              await sendLinePush(env, order.user_id, [flexMsg, confirmTemplate]);
            }
          }

          return jsonResponse({ status: 'success', message: 'Order items updated' });
        }

        // 4.1 Action: updateProductStatus OR POST /api/products/status
        if (postAction === 'updateProductStatus' || url.pathname === '/api/products/status') {
          const targetId = postData.id || postData.productId;
          const rawStatus = postData.status;
          const newStatus = (rawStatus === 'inactive' || rawStatus === false || rawStatus === '0') ? 'inactive' : 'active';

          if (!targetId) {
            return jsonResponse({ status: 'error', message: 'Missing product id' }, 400);
          }

          await db.prepare(`
            CREATE TABLE IF NOT EXISTS product_statuses (
              id TEXT PRIMARY KEY,
              status TEXT DEFAULT 'active',
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `).run();

          await db.prepare(`
            INSERT INTO product_statuses (id, status, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP
          `).bind(String(targetId), newStatus).run();

          try {
            await db
              .prepare("UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
              .bind(newStatus, String(targetId))
              .run();
          } catch(e) {}

          return jsonResponse({
            status: 'success',
            message: `Product ${targetId} status updated to ${newStatus}`,
            id: targetId,
            productStatus: newStatus
          });
        }

        // 4.3 Action: syncProductsBatch OR POST /api/products/batch (Migrate/Sync Products from POSPOS/Sheets)
        if (postAction === 'syncProductsBatch' || url.pathname === '/api/products/batch') {
          const products = postData.products || [];
          if (!Array.isArray(products) || products.length === 0) {
            return jsonResponse({ status: 'success', imported: 0, message: 'No products provided' });
          }

          try {
            await db.prepare('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0').run();
          } catch (e) {}

          const insertStmt = db.prepare(`
            INSERT INTO products (id, name, category, price, desc, img, tag, status, stock, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              name = COALESCE(NULLIF(excluded.name, ''), products.name),
              category = COALESCE(NULLIF(excluded.category, ''), products.category),
              price = excluded.price,
              desc = COALESCE(NULLIF(excluded.desc, ''), products.desc),
              img = excluded.img,
              tag = COALESCE(NULLIF(excluded.tag, ''), products.tag),
              status = COALESCE(NULLIF(excluded.status, ''), products.status),
              stock = COALESCE(excluded.stock, products.stock),
              updated_at = CURRENT_TIMESTAMP
          `);

          const batch = [];
          for (const p of products) {
            if (!p.id) continue;
            batch.push(
              insertStmt.bind(
                String(p.id).trim(),
                p.name || '',
                p.category || 'ทั่วไป',
                Number(p.price || 0),
                p.desc || '',
                p.img || '',
                p.tag || '',
                p.status || 'active',
                Number(p.stock ?? 0)
              )
            );
          }

          if (batch.length > 0) {
            await db.batch(batch);
          }

          return jsonResponse({ status: 'success', imported: batch.length });
        }

        // 4.5 Action: syncOrdersBatch OR POST /api/orders/batch (Migrate/Sync Orders from Sheets)
        if (postAction === 'syncOrdersBatch' || url.pathname === '/api/orders/batch') {
          const orders = postData.orders || [];
          if (!Array.isArray(orders) || orders.length === 0) {
            return jsonResponse({ status: 'success', imported: 0, message: 'No orders provided' });
          }

          const insertStmt = db.prepare(`
            INSERT INTO orders (
              order_id, timestamp, user_id, customer_name, phone, gps_location, address_details,
              slip_url, total_price, status, payment_method, items_text, items_json,
              delivery_type, preorder_time, shipping_option, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(order_id) DO UPDATE SET
              status = excluded.status,
              slip_url = CASE WHEN excluded.slip_url != '' THEN excluded.slip_url ELSE orders.slip_url END,
              total_price = excluded.total_price,
              items_text = excluded.items_text,
              items_json = excluded.items_json
          `);

          const batch = [];
          for (const o of orders) {
            if (!o.orderId) continue;
            const items = o.items || [];
            const itemsText = o.itemsText || (Array.isArray(items) ? items.map((it) => `${it.name || ''} x${it.qty || 1}`).join(', ') : '');
            const itemsJson = typeof items === 'string' ? items : JSON.stringify(items);

            batch.push(
              insertStmt.bind(
                o.orderId,
                o.timestamp || new Date().toISOString(),
                o.userId || 'unknown',
                o.customerName || o.displayName || '',
                o.phone || '',
                o.gpsLocation || '',
                o.addressDetails || '',
                o.slipUrl || '',
                Number(o.totalPrice || 0),
                o.status || 'รอตรวจสอบ',
                o.paymentMethod || 'ปลายทาง',
                itemsText,
                itemsJson,
                o.deliveryType || 'ทันที',
                o.preorderTime || '',
                o.shippingOption || 'จัดส่ง',
                o.note || ''
              )
            );
          }

          if (batch.length > 0) {
            await db.batch(batch);
          }

          return jsonResponse({ status: 'success', imported: batch.length });
        }

        // 4.6 Action: syncMembersBatch OR POST /api/members/batch (Migrate/Sync Members from Sheets)
        if (postAction === 'syncMembersBatch' || url.pathname === '/api/members/batch') {
          const members = postData.members || [];
          if (!Array.isArray(members) || members.length === 0) {
            return jsonResponse({ status: 'success', imported: 0, message: 'No members provided' });
          }

          const insertStmt = db.prepare(`
            INSERT INTO members (
              user_id, display_name, status_message, email, picture_url, phone,
              gps_location, address_details, address_label, saved_addresses_json, registered_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              display_name = COALESCE(NULLIF(excluded.display_name, ''), members.display_name),
              phone = COALESCE(NULLIF(excluded.phone, ''), members.phone),
              saved_addresses_json = COALESCE(NULLIF(excluded.saved_addresses_json, '[]'), members.saved_addresses_json),
              updated_at = CURRENT_TIMESTAMP
          `);

          const batch = [];
          for (const m of members) {
            if (!m.userId) continue;
            batch.push(
              insertStmt.bind(
                m.userId,
                m.displayName || '',
                m.statusMessage || '',
                m.email || '',
                m.pictureUrl || '',
                m.phone || '',
                m.gpsLocation || '',
                m.addressDetails || '',
                m.addressLabel || '',
                m.savedAddresses || m.saved_addresses_json || '[]',
                m.registeredAt || new Date().toISOString()
              )
            );
          }

          if (batch.length > 0) {
            await db.batch(batch);
          }

          return jsonResponse({ status: 'success', imported: batch.length });
        }

        // 4.7 Action: savePromoCode OR POST /api/promos
        if (postAction === 'savePromoCode' || (url.pathname === '/api/promos' && method === 'POST')) {
          const rawCode = (postData.code || '').trim().toUpperCase();
          if (!rawCode) {
            return jsonResponse({ status: 'error', message: 'กรุณาระบุรหัสโค้ดส่วนลด' }, 400);
          }

          await db.prepare(`
            CREATE TABLE IF NOT EXISTS promo_codes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              code TEXT UNIQUE,
              type TEXT DEFAULT 'fixed',
              amount REAL DEFAULT 0,
              percent REAL DEFAULT 0,
              min_spend REAL DEFAULT 0,
              description TEXT,
              start_date TEXT,
              end_date TEXT,
              is_active INTEGER DEFAULT 1,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run();

          const type = postData.type || 'fixed'; // fixed, percent, shipping
          const amount = Number(postData.amount) || 0;
          const percent = Number(postData.percent) || 0;
          const minSpend = Number(postData.minSpend || postData.min_spend) || 0;
          const description = (postData.description || '').trim();
          const startDate = (postData.startDate || postData.start_date || '').trim();
          const endDate = (postData.endDate || postData.end_date || '').trim();
          const isActive = (postData.isActive !== undefined ? (postData.isActive ? 1 : 0) : (postData.is_active !== undefined ? (postData.is_active ? 1 : 0) : 1));

          const query = `
            INSERT INTO promo_codes (code, type, amount, percent, min_spend, description, start_date, end_date, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(code) DO UPDATE SET
              type = excluded.type,
              amount = excluded.amount,
              percent = excluded.percent,
              min_spend = excluded.min_spend,
              description = excluded.description,
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              is_active = excluded.is_active,
              updated_at = CURRENT_TIMESTAMP
          `;

          await db.prepare(query).bind(rawCode, type, amount, percent, minSpend, description, startDate, endDate, isActive).run();
          return jsonResponse({ status: 'success', message: 'บันทึกโค้ดส่วนลดเรียบร้อย', code: rawCode });
        }

        // 4.8 Action: togglePromoCode OR POST /api/promos/toggle
        if (postAction === 'togglePromoCode' || url.pathname === '/api/promos/toggle') {
          const rawCode = (postData.code || '').trim().toUpperCase();
          const isActive = postData.isActive ? 1 : 0;
          if (!rawCode) {
            return jsonResponse({ status: 'error', message: 'Missing code' }, 400);
          }

          await db.prepare(`
            CREATE TABLE IF NOT EXISTS promo_codes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              code TEXT UNIQUE,
              type TEXT DEFAULT 'fixed',
              amount REAL DEFAULT 0,
              percent REAL DEFAULT 0,
              min_spend REAL DEFAULT 0,
              description TEXT,
              start_date TEXT,
              end_date TEXT,
              is_active INTEGER DEFAULT 1,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run();

          await db.prepare('UPDATE promo_codes SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?')
            .bind(isActive, rawCode)
            .run();

          return jsonResponse({ status: 'success', code: rawCode, isActive });
        }

        // 4.9 Action: deletePromoCode OR POST /api/promos/delete
        if (postAction === 'deletePromoCode' || url.pathname === '/api/promos/delete') {
          const rawCode = (postData.code || '').trim().toUpperCase();
          if (!rawCode) {
            return jsonResponse({ status: 'error', message: 'Missing code' }, 400);
          }

          await db.prepare('DELETE FROM promo_codes WHERE code = ?')
            .bind(rawCode)
            .run();

          return jsonResponse({ status: 'success', message: 'ลบโค้ดส่วนลดแล้ว', code: rawCode });
        }

        // 5. Action: register (หรือ Default Member Upsert) OR POST /api/members
        if (postAction === 'register' || url.pathname === '/api/members' || postData.userId) {
          const userId = postData.userId;
          if (!userId) {
            return jsonResponse({ status: 'error', message: 'Missing userId' }, 400);
          }

          const rawPhone = postData.phone || '';
          const cleanPhone = cleanPhoneNumber(rawPhone);
          // ถ้ามี phone ส่งมาแต่ไม่ถูกต้อง (เช่น 001 หรือช่องว่าง) ให้ปฏิเสธเพื่อป้องกันข้อมูลเสีย
          if (rawPhone && !isValidThaiPhone(cleanPhone)) {
            return jsonResponse({
              status: 'error',
              message: 'กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (10 หลัก ขึ้นต้นด้วย 0 เช่น 08X-XXX-XXXX)'
            }, 400);
          }
          const validPhoneToSave = isValidThaiPhone(cleanPhone) ? cleanPhone : '';

          const query = `
            INSERT INTO members (user_id, display_name, status_message, email, picture_url, phone, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              display_name = excluded.display_name,
              status_message = excluded.status_message,
              email = excluded.email,
              picture_url = excluded.picture_url,
              phone = COALESCE(NULLIF(excluded.phone, ''), members.phone),
              updated_at = CURRENT_TIMESTAMP
          `;

          await db
            .prepare(query)
            .bind(
              userId,
              postData.displayName || '',
              postData.statusMessage || '',
              postData.email || '',
              postData.pictureUrl || '',
              validPhoneToSave
            )
            .run();

          return jsonResponse({ status: 'success' });
        }
      }

      // DELETE /api/products/:id
      if (url.pathname.startsWith('/api/products/') && method === 'DELETE') {
        const id = url.pathname.split('/')[3];
        await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
        return jsonResponse({ status: 'success', message: `Product ${id} deleted` });
      }

      return jsonResponse({ status: 'error', message: `Route ${url.pathname} not found` }, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return jsonResponse({ status: 'error', message: err.message }, 500);
    }
  },
};
