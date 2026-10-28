import { defineConfig } from 'vite';
import { resolve } from 'path';

const POSPOS_API_KEY = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYzMjAwMWM4MGNmOTMwODA4ZjE1NDUyNiIsImVtcGxveW1lbnRfdHlwZSI6IjViZDZjOGVkZTFhNDM3NTgwNzkwODUwZiIsInVzZXJuYW1lIjoicHJpbWVzdWtwcmltZXN1a0BnbWFpbC5jb20iLCJzaG9wIjoiMTY2NzIyNDcxMjc4NyIsInZlcnNpb24iOiIxLjAiLCJsZXZlbCI6MSwiaWF0IjoxNzY4MjkyMTEzLCJleHAiOjQ5MjQwNTIxMTMsImF1ZCI6Imh0dHBzOi8vcG9zcG9zZ28uY28iLCJpc3MiOiJDb2RlTW9iaWxlcyBMdGQifQ.XNg2jc2jQCYmd47ykEW37t7bsQnw4M2avwQ33xRJBhfrPMXTaFdZTwflJUmpGVykkNwUCB_NhNH3_ornqLSR8YXo_ARfQtT8t5WRVJqP5QWAMU95ftx_ZP1aQadJE2EBpWoAmsHVBTbSC86x0cBZO9qLDABKzVrYEFBm9ZQWVPs';

function posposLocalProxyPlugin() {
  return {
    name: 'pospos-local-proxy',
    configureServer(server) {
      server.middlewares.use('/api/pospos/member', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          const urlObj = new URL(req.url, 'http://localhost');
          const rawPhone = urlObj.searchParams.get('phone') || '';
          const clean = String(rawPhone).trim().replace(/[\s\-\(\)\.]/g, '');

          if (!clean) {
            res.statusCode = 400;
            res.end(JSON.stringify({ status: 'error', message: 'Missing phone' }));
            return;
          }

          const fetchByPhone = async (q) => {
            const r = await fetch(`https://go.pospos.co/developer/api/member/find/phonenumber/${encodeURIComponent(q)}`, {
              headers: {
                apikey: POSPOS_API_KEY,
                Accept: 'application/json',
                'User-Agent': 'Kuekoonkan-App/1.0',
              },
            });
            if (r.status === 404 || r.status === 204) return { ok: true, member: null };
            const txt = await r.text();
            if (!r.ok) {
              if (r.status === 400 && (!txt || txt.toLowerCase().includes('not found') || txt.includes('ไม่พบ'))) {
                return { ok: true, member: null };
              }
              return { ok: false, status: r.status, errorText: txt };
            }
            if (!txt || !txt.trim()) return { ok: true, member: null };
            let parsed = null;
            try {
              parsed = JSON.parse(txt);
            } catch (e) {
              return { ok: true, member: null };
            }
            if (!parsed) return { ok: true, member: null };
            let rawMember = parsed.data ?? parsed.member ?? parsed.result ?? parsed;
            if (Array.isArray(rawMember)) {
              rawMember = rawMember.length > 0 ? rawMember[0] : null;
            }
            const isFound = Boolean(
              rawMember &&
                typeof rawMember === 'object' &&
                (rawMember._id ||
                  rawMember.id ||
                  rawMember.name ||
                  rawMember.fullname ||
                  rawMember.phonenumber ||
                  rawMember.phone ||
                  rawMember.tel ||
                  rawMember.code ||
                  rawMember.member_code ||
                  rawMember.point !== undefined ||
                  rawMember.points !== undefined)
            );
            return { ok: true, member: isFound ? rawMember : null };
          };

          let lookup = await fetchByPhone(clean);
          if (lookup.ok && !lookup.member && clean.length === 10) {
            const dashed = `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
            const retry = await fetchByPhone(dashed);
            if (retry.ok && retry.member) lookup = retry;
          }

          if (!lookup.ok) {
            res.statusCode = lookup.status || 502;
            res.end(JSON.stringify({ status: 'error', message: `POSPOS status ${lookup.status}` }));
            return;
          }

          if (!lookup.member) {
            res.statusCode = 200;
            res.end(JSON.stringify({ status: 'success', found: false, member: null }));
            return;
          }

          const rm = lookup.member;
          const member = {
            name: rm.name || rm.fullname || rm.first_name || 'ลูกค้าสมาชิก',
            phone: clean,
            point: Number(rm.point ?? rm.points ?? rm.score ?? rm.reward_points ?? rm.total_point ?? 0),
            code: rm.code || rm.member_code || rm.id || rm._id || '',
            group: rm.group || rm.member_group || rm.group_name || 'สมาชิกทั่วไป',
          };

          res.statusCode = 200;
          res.end(JSON.stringify({ status: 'success', found: true, member }));
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
