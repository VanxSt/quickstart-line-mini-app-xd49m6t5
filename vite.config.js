import { defineConfig } from 'vite';
import { resolve } from 'path';

const POSPOS_API_KEY = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYzMjAwMWM4MGNmOTMwODA4ZjE1NDUyNiIsImVtcGxveW1lbnRfdHlwZSI6IjViZDZjOGVkZTFhNDM3NTgwNzkwODUwZiIsInVzZXJuYW1lIjoicHJpbWVzdWtwcmltZXN1a0BnbWFpbC5jb20iLCJzaG9wIjoiMTY2NzIyNDcxMjc4NyIsInZlcnNpb24iOiIxLjAiLCJsZXZlbCI6MSwiaWF0IjoxNzY4MjkyMTEzLCJleHAiOjQ5MjQwNTIxMTMsImF1ZCI6Imh0dHBzOi8vcG9zcG9zZ28uY28iLCJpc3MiOiJDb2RlTW9iaWxlcyBMdGQifQ.XNg2jc2jQCYmd47ykEW37t7bsQnw4M2avwQ33xRJBhfrPMXTaFdZTwflJUmpGVykkNwUCB_NhNH3_ornqLSR8YXo_ARfQtT8t5WRVJqP5QWAMU95ftx_ZP1aQadJE2EBpWoAmsHVBTbSC86x0cBZO9qLDABKzVrYEFBm9ZQWVPs';

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

function parsePosposMemberRecord(rm, cleanPhone) {
  if (!rm || typeof rm !== 'object') return null;

  const first = String(rm.firstname || '').trim();
  const last = String(rm.lastname || '').trim();
  const fullName = `${first} ${last}`.trim() || String(rm.name || rm.nickname || '').trim() || 'ลูกค้าสมาชิก';

  const point = Number(rm.point_value ?? rm.point ?? 0);
  const code = String(rm.code || rm.key_card_id || rm._id || '').trim();
  const group = (rm.type && rm.type.name_th) ? String(rm.type.name_th).trim() : String(rm.group || 'สมาชิกทั่วไป').trim();

  return {
    name: fullName,
    phone: cleanPhone,
    point: Number.isFinite(point) ? point : 0,
    code,
    group: group || 'สมาชิกทั่วไป',
  };
}

function posposLocalProxyPlugin() {
  return {
    name: 'pospos-local-proxy',
    configureServer(server) {
      server.middlewares.use('/api/pospos/member', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

        try {
          const urlObj = new URL(req.url, 'http://localhost');
          const rawPhone = urlObj.searchParams.get('phone') || '';
          const clean = cleanPhoneNumber(rawPhone);

          if (!clean) {
            res.statusCode = 400;
            res.end(JSON.stringify({ status: 'error', message: 'Missing phone' }));
            return;
          }

          const fetchByPhoneFormat = async (phoneQuery) => {
            try {
              const r = await fetch(`https://go.pospos.co/developer/api/member/find/phonenumber/${encodeURIComponent(phoneQuery)}`, {
                headers: {
                  apikey: POSPOS_API_KEY,
                  Accept: 'application/json',
                  'Cache-Control': 'no-cache',
                  'User-Agent': 'Kuekoonkan-App/2.0',
                },
              });
              if (!r.ok) return [];
              const parsed = await r.json();
              const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.data) ? parsed.data : (parsed && parsed.data ? [parsed.data] : []));
              return list.filter(item => item && typeof item === 'object' && (item._id || item.code || item.phonenumber));
            } catch (e) {
              return [];
            }
          };

          // 1. ค้นหาแบบมีขีด (095-757-9454) ซึ่งเป็นรูปแบบหลักที่ POSPOS เก็บในฟิลด์ phonenumber
          const dashed = clean.length === 10 ? `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}` : clean;
          let records = await fetchByPhoneFormat(dashed);

          // 2. หากไม่พบ ลองค้นหาแบบตัวเลขติดกัน (0957579454)
          if (records.length === 0 && dashed !== clean) {
            records = await fetchByPhoneFormat(clean);
          }

          if (records.length === 0) {
            res.statusCode = 200;
            res.end(JSON.stringify({ status: 'success', schemaVersion: 2, found: false, member: null }));
            return;
          }

          const member = parsePosposMemberRecord(records[0], clean);

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              status: 'success',
              schemaVersion: 2,
              found: true,
              member,
              rawPospos: records,
            })
          );
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ status: 'error', message: err.message }));
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [posposLocalProxyPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        second: resolve(__dirname, 'second.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
