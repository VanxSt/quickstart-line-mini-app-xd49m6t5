var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...headers
    }
  });
}
__name(jsonResponse, "jsonResponse");
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(htmlResponse, "htmlResponse");
function buildStatusFlexMessage(title, orderId, bodyText, headerBgColor, name, phone, shippingOption, deliveryType, preorderTime, items, totalPrice, paymentMethod = "-") {
  const cartItems = Array.isArray(items) ? items : [];
  let calcSubtotal = 0;
  const itemBoxes = [];
  for (const item of cartItems) {
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.qty || 1);
    const itemTotal = itemPrice * itemQty;
    calcSubtotal += itemTotal;
    itemBoxes.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: String(item.name || "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32"),
              size: "sm",
              wrap: true,
              weight: "bold",
              color: "#1e293b"
            },
            {
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                {
                  type: "text",
                  text: `x${itemQty}  \u2022  \u0E3F${itemPrice.toLocaleString()}`,
                  size: "xs",
                  color: "#64748b",
                  flex: 3
                },
                {
                  type: "text",
                  text: `\u0E3F${itemTotal.toLocaleString()}`,
                  size: "xs",
                  weight: "bold",
                  color: "#0f172a",
                  align: "end",
                  flex: 2
                }
              ]
            }
          ]
        }
      ]
    });
  }
  let calcShippingFee = Number(totalPrice) - calcSubtotal;
  if (calcShippingFee < 0) calcShippingFee = 0;
  const deliveryText = shippingOption === "\u0E23\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E23\u0E49\u0E32\u0E19" ? "\u{1F3EA} \u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E40\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E23\u0E49\u0E32\u0E19" : "\u{1F69A} \u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E15\u0E32\u0E21\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48";
  const timeText = deliveryType === "\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32" ? `\u{1F552} \u0E2A\u0E31\u0E48\u0E07\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32 (${preorderTime} \u0E19.)` : "\u{1F680} \u0E2A\u0E48\u0E07\u0E17\u0E31\u0E19\u0E17\u0E35 (\u0E14\u0E48\u0E27\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14)";
  return {
    type: "flex",
    altText: `${title} (${orderId})`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerBgColor || "#2563eb",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "xl",
            color: "#ffffff",
            wrap: true
          },
          {
            type: "text",
            text: `\u0E40\u0E25\u0E02\u0E17\u0E35\u0E48: ${orderId}`,
            size: "xs",
            color: "#ffffff",
            margin: "xs"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "lg",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#f8fafc",
            cornerRadius: "md",
            paddingAll: "md",
            spacing: "xs",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "\u{1F464} \u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: String(name || "-"), size: "xs", color: "#0f172a", weight: "bold", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "\u{1F4DE} \u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: String(phone || "-"), size: "xs", color: "#0f172a", weight: "bold", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "\u{1F69A} \u0E01\u0E32\u0E23\u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: deliveryText, size: "xs", color: "#059669", weight: "bold", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "\u{1F552} \u0E40\u0E27\u0E25\u0E32\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07/\u0E23\u0E31\u0E1A", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: timeText, size: "xs", color: "#dc2626", weight: "bold", flex: 4, wrap: true }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "\u{1F4B3} \u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E42\u0E14\u0E22 :", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: paymentMethod || "-", size: "xs", color: "#0f172a", weight: "bold", flex: 4, wrap: true }
                ]
              }
            ]
          },
          { type: "separator", margin: "md" },
          {
            type: "text",
            text: "\u{1F4E6} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D",
            weight: "bold",
            size: "sm",
            color: "#334155",
            margin: "sm"
          },
          ...itemBoxes,
          { type: "separator", margin: "md" },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "\u0E23\u0E27\u0E21\u0E04\u0E48\u0E32\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32", size: "sm", color: "#64748b", flex: 3 },
              { type: "text", text: `\u0E3F${calcSubtotal.toLocaleString()}`, size: "sm", color: "#0f172a", align: "end", flex: 3 }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "\u0E04\u0E48\u0E32\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07", size: "sm", color: "#64748b", flex: 3 },
              {
                type: "text",
                text: calcShippingFee > 0 ? `\u0E3F${calcShippingFee.toLocaleString()}` : "\u0E1F\u0E23\u0E35 (\u0E3F0)",
                size: "sm",
                color: calcShippingFee > 0 ? "#0f172a" : "#16a34a",
                weight: "bold",
                align: "end",
                flex: 3
              }
            ]
          },
          { type: "separator", margin: "sm" },
          {
            type: "box",
            layout: "horizontal",
            margin: "md",
            contents: [
              { type: "text", text: "\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19\u0E23\u0E27\u0E21\u0E2A\u0E38\u0E17\u0E18\u0E34", size: "md", color: "#0f172a", weight: "bold", flex: 3 },
              { type: "text", text: `\u0E3F${Number(totalPrice).toLocaleString()}`, size: "xl", color: "#10b981", weight: "bold", align: "end", flex: 3 }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#f8fafc",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: `\u2728 ${bodyText}`,
            size: "xs",
            color: "#64748b",
            wrap: true,
            align: "center"
          }
        ]
      }
    }
  };
}
__name(buildStatusFlexMessage, "buildStatusFlexMessage");
async function sendLinePush(env, userId, messages) {
  if (!userId || userId === "unknown" || userId === "web-test-user" || !env.LINE_ACCESS_TOKEN) {
    return { skipped: true, reason: "Invalid user or no token" };
  }
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId.trim(),
        messages
      })
    });
    const resultText = await res.text();
    return { ok: res.ok, status: res.status, result: resultText };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
__name(sendLinePush, "sendLinePush");
async function sendLineReply(env, replyToken, messages) {
  if (!replyToken || !env.LINE_ACCESS_TOKEN) return { skipped: true };
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken,
        messages
      })
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
__name(sendLineReply, "sendLineReply");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const action = url.searchParams.get("action");
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    try {
      const db = env.DB || env.kuekoonkan_db;
      if (!db) {
        return jsonResponse({ status: "error", message: "D1 Database binding (env.DB or env.kuekoonkan_db) not found" }, 500);
      }
      if (method === "GET") {
        if (url.pathname === "/" && !action && !url.searchParams.get("userId") && !url.searchParams.get("orderId")) {
          return jsonResponse({
            status: "online",
            service: "Kuekoonkan Cloudflare D1 Backend",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
        const slipMatch = url.pathname.match(/^\/api\/orders\/([^\/]+)\/slip$/);
        const slipOrderId = slipMatch ? slipMatch[1] : action === "getSlip" ? url.searchParams.get("orderId") : null;
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
            const row = await db.prepare("SELECT image_base64, mime_type FROM order_slips WHERE order_id = ?").bind(slipOrderId).first();
            if (!row || !row.image_base64) {
              return new Response("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2A\u0E25\u0E34\u0E1B\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49", {
                status: 404,
                headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" }
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
                "Content-Type": row.mime_type || "image/jpeg",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*"
              }
            });
          } catch (err) {
            return new Response("Error loading slip: " + err.message, { status: 500 });
          }
        }
        if (action === "getProducts" || url.pathname === "/api/products") {
          const includeAll = url.searchParams.get("all") === "true";
          const category = url.searchParams.get("category");
          const search = url.searchParams.get("search");
          let query = "SELECT * FROM products";
          const conditions = [];
          const bindings = [];
          if (!includeAll) {
            conditions.push("status = 'active'");
          }
          if (category && category !== "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14") {
            conditions.push("category = ?");
            bindings.push(category);
          }
          if (search) {
            conditions.push("(name LIKE ? OR desc LIKE ? OR tag LIKE ?)");
            const term = `%${search}%`;
            bindings.push(term, term, term);
          }
          if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
          }
          query += " ORDER BY id ASC";
          const stmt = bindings.length > 0 ? db.prepare(query).bind(...bindings) : db.prepare(query);
          const { results } = await stmt.all();
          return jsonResponse({
            status: "success",
            products: results || [],
            total: results ? results.length : 0,
            cachedAt: Date.now()
          });
        }
        if (action === "getAllOrders" || url.pathname === "/api/orders" && !url.searchParams.get("userId")) {
          const { results } = await db.prepare("SELECT * FROM orders ORDER BY timestamp DESC").all();
          const orders = (results || []).map((row) => {
            let items = [];
            try {
              if (row.items_json) items = JSON.parse(row.items_json);
            } catch (e) {
            }
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
              status: row.status || "\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A",
              paymentMethod: row.payment_method || "\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E32\u0E07",
              items,
              itemsText: row.items_text,
              deliveryType: row.delivery_type || "\u0E17\u0E31\u0E19\u0E17\u0E35",
              preorderTime: row.preorder_time || "",
              shippingOption: row.shipping_option || "\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07",
              note: row.note || ""
            };
          });
          return jsonResponse({ status: "success", orders });
        }
        if (action === "getMyOrders" || url.pathname === "/api/orders" && url.searchParams.get("userId")) {
          const userId = url.searchParams.get("userId");
          if (!userId) {
            return jsonResponse({ status: "error", message: "Missing userId" }, 400);
          }
          const { results } = await db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY timestamp DESC").bind(userId).all();
          const orders = (results || []).map((row) => {
            let items = [];
            try {
              if (row.items_json) items = JSON.parse(row.items_json);
            } catch (e) {
            }
            return {
              timestamp: row.timestamp,
              orderId: row.order_id,
              totalPrice: Number(row.total_price || 0),
              status: row.status || "\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A",
              slipUrl: row.slip_url || "",
              items
            };
          });
          return jsonResponse({ status: "success", orders });
        }
        if (action === "getAllMembers" || url.pathname === "/api/members" && !url.searchParams.get("userId")) {
          const { results } = await db.prepare("SELECT * FROM members ORDER BY registered_at DESC").all();
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
            savedAddresses: m.saved_addresses_json || "[]"
          }));
          return jsonResponse({ status: "success", members });
        }
        if (url.searchParams.get("userId") && (!action || action === "getMember")) {
          const userId = url.searchParams.get("userId");
          const member = await db.prepare("SELECT * FROM members WHERE user_id = ?").bind(userId).first();
          if (!member) {
            return jsonResponse({ status: "success", found: false });
          }
          return jsonResponse({
            status: "success",
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
            savedAddresses: member.saved_addresses_json || "[]"
          });
        }
        if (action === "confirmOrder" || url.pathname === "/confirmOrder") {
          const orderId = url.searchParams.get("orderId");
          if (orderId) {
            await db.prepare("UPDATE orders SET status = '\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19' WHERE order_id = ?").bind(orderId).run();
          }
          return htmlResponse(`
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <div style="text-align:center; padding:50px 20px; font-family:sans-serif;">
              <h1 style="color:#22c55e; font-size:48px; margin-bottom:10px;">\u2705</h1>
              <h2 style="color:#22c55e; margin-top:0;">\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08</h2>
              <p>\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E14\u0E49\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C <b>${orderId || ""}</b> \u0E40\u0E1B\u0E47\u0E19 "\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19" \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E23\u0E31\u0E1A</p>
              <p style="color:#666; font-size:14px; margin-top:30px;">\u0E04\u0E38\u0E13\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1B\u0E34\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E01\u0E25\u0E31\u0E1A\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E41\u0E0A\u0E17 LINE \u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E04\u0E23\u0E31\u0E1A</p>
            </div>
          `);
        }
        if (action === "cancelOrder" || url.pathname === "/cancelOrder") {
          const orderId = url.searchParams.get("orderId");
          if (orderId) {
            await db.prepare("UPDATE orders SET status = '\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01' WHERE order_id = ?").bind(orderId).run();
          }
          return htmlResponse(`
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <div style="text-align:center; padding:50px 20px; font-family:sans-serif;">
              <h1 style="color:#ef4444; font-size:48px; margin-bottom:10px;">\u274C</h1>
              <h2 style="color:#ef4444; margin-top:0;">\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E49\u0E27</h2>
              <p>\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E14\u0E49\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C <b>${orderId || ""}</b> \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E23\u0E31\u0E1A</p>
              <p style="color:#666; font-size:14px; margin-top:30px;">\u0E04\u0E38\u0E13\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1B\u0E34\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E01\u0E25\u0E31\u0E1A\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E41\u0E0A\u0E17 LINE \u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E04\u0E23\u0E31\u0E1A</p>
            </div>
          `);
        }
        if (action === "clearProductCache") {
          return jsonResponse({ status: "success", message: "\u0E25\u0E49\u0E32\u0E07 Cache \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
        }
        if (action === "getInactiveProducts" || url.pathname === "/api/products/inactive") {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS product_statuses (
              id TEXT PRIMARY KEY,
              status TEXT DEFAULT 'active',
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
          const { results: fromStatuses } = await db.prepare("SELECT id FROM product_statuses WHERE status = 'inactive'").all();
          let inactiveIds = (fromStatuses || []).map((r) => String(r.id));
          try {
            const { results: fromProducts } = await db.prepare("SELECT id FROM products WHERE status = 'inactive'").all();
            if (fromProducts && fromProducts.length > 0) {
              const set = new Set(inactiveIds);
              fromProducts.forEach((r) => set.add(String(r.id)));
              inactiveIds = Array.from(set);
            }
          } catch (e) {
          }
          return jsonResponse({
            status: "success",
            inactiveIds,
            total: inactiveIds.length
          });
        }
        if (action === "updateProductStatus") {
          const targetId = url.searchParams.get("id") || url.searchParams.get("productId");
          const rawStatus = url.searchParams.get("status");
          const newStatus = rawStatus === "inactive" || rawStatus === false || rawStatus === "0" ? "inactive" : "active";
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
              await db.prepare("UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(newStatus, String(targetId)).run();
            } catch (e) {
            }
          }
          return jsonResponse({ status: "success", id: targetId, productStatus: newStatus });
        }
      }
      if (method === "POST") {
        let postData = {};
        try {
          const rawText = await request.text();
          if (rawText) postData = JSON.parse(rawText);
        } catch (e) {
          postData = {};
        }
        const postAction = postData.action || "";
        if (url.pathname === "/webhook" || postData.events && Array.isArray(postData.events)) {
          const events = postData.events || [];
          for (const ev of events) {
            if (ev.type === "message" && ev.message && ev.message.type === "image") {
              const userId = ev.source ? ev.source.userId : "";
              const messageId = ev.message.id;
              if (userId && messageId) {
                try {
                  let order = await db.prepare(`
                      SELECT order_id, status, customer_name FROM orders 
                      WHERE user_id = ? AND status IN ('\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19', '\u0E23\u0E2D\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19', '\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A', '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C')
                      ORDER BY timestamp DESC LIMIT 1
                    `).bind(userId).first();
                  if (!order) {
                    order = await db.prepare(`
                        SELECT order_id, status, customer_name FROM orders 
                        WHERE user_id = ? AND status != '\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01'
                        ORDER BY timestamp DESC LIMIT 1
                      `).bind(userId).first();
                  }
                  if (order && order.order_id) {
                    if (ev.replyToken) {
                      await sendLineReply(env, ev.replyToken, [
                        {
                          type: "flex",
                          altText: `\u{1F9FE} \u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E2A\u0E25\u0E34\u0E1B\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27 (${order.order_id})`,
                          contents: {
                            type: "bubble",
                            header: {
                              type: "box",
                              layout: "vertical",
                              backgroundColor: "#16a34a",
                              paddingAll: "16px",
                              contents: [
                                {
                                  type: "text",
                                  text: "\u{1F9FE} \u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E2A\u0E25\u0E34\u0E1B\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E49\u0E27",
                                  color: "#ffffff",
                                  weight: "bold",
                                  size: "md"
                                },
                                {
                                  type: "text",
                                  text: `\u0E40\u0E25\u0E02\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C: ${order.order_id}`,
                                  color: "#ffffff",
                                  size: "xs",
                                  margin: "xs"
                                }
                              ]
                            },
                            body: {
                              type: "box",
                              layout: "vertical",
                              spacing: "sm",
                              contents: [
                                {
                                  type: "text",
                                  text: `\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E04\u0E23\u0E31\u0E1A! \u0E23\u0E30\u0E1A\u0E1A\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2A\u0E25\u0E34\u0E1B\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E02\u0E2D\u0E07 ${order.customer_name || "\u0E04\u0E38\u0E13\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32"} \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27 \u2728`,
                                  size: "sm",
                                  weight: "bold",
                                  color: "#0f172a"
                                },
                                {
                                  type: "text",
                                  text: "\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E08\u0E31\u0E14\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E43\u0E2B\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E23\u0E31\u0E1A \u0E23\u0E2D\u0E23\u0E31\u0E1A\u0E02\u0E2D\u0E07\u0E2D\u0E23\u0E48\u0E2D\u0E22\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22! \u{1F9D1}\u200D\u{1F373}\u{1F6F5}",
                                  size: "xs",
                                  wrap: true,
                                  color: "#64748b"
                                }
                              ]
                            }
                          }
                        }
                      ]);
                    }
                    const saveSlipTask = /* @__PURE__ */ __name(async () => {
                      try {
                        const imgRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
                          headers: { Authorization: `Bearer ${env.LINE_ACCESS_TOKEN}` }
                        });
                        if (imgRes.ok) {
                          const arrayBuffer = await imgRes.arrayBuffer();
                          const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
                          let binary = "";
                          const bytes = new Uint8Array(arrayBuffer);
                          const len = bytes.byteLength;
                          const chunkSize = 32768;
                          for (let i = 0; i < len; i += chunkSize) {
                            binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
                          }
                          const base64 = btoa(binary);
                          await db.prepare(`
                              INSERT INTO order_slips (order_id, mime_type, image_base64, created_at)
                              VALUES (?, ?, ?, ?)
                              ON CONFLICT(order_id) DO UPDATE SET
                                mime_type = excluded.mime_type,
                                image_base64 = excluded.image_base64,
                                created_at = excluded.created_at
                            `).bind(order.order_id, mimeType, base64, (/* @__PURE__ */ new Date()).toISOString()).run();
                          const slipUrl = `${url.origin}/api/orders/${order.order_id}/slip`;
                          await db.prepare(`
                              UPDATE orders SET slip_url = ?, status = '\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19' WHERE order_id = ?
                            `).bind(slipUrl, order.order_id).run();
                        }
                      } catch (err) {
                        console.error("Background slip save error:", err);
                      }
                    }, "saveSlipTask");
                    if (ctx && typeof ctx.waitUntil === "function") {
                      ctx.waitUntil(saveSlipTask());
                    } else {
                      await saveSlipTask();
                    }
                  } else {
                    if (ev.replyToken) {
                      await sendLineReply(env, ev.replyToken, [
                        {
                          type: "text",
                          text: "\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2A\u0E25\u0E34\u0E1B\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E23\u0E31\u0E1A! \u0E2B\u0E32\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E25\u0E02\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C \u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E40\u0E25\u0E02\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C (\u0E40\u0E0A\u0E48\u0E19 ORD-...) \u0E2A\u0E48\u0E07\u0E21\u0E32\u0E43\u0E19\u0E41\u0E0A\u0E17\u0E19\u0E35\u0E49\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E23\u0E31\u0E1A \u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E08\u0E30\u0E23\u0E35\u0E1A\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E43\u0E2B\u0E49\u0E04\u0E23\u0E31\u0E1A \u{1F64F}"
                        }
                      ]);
                    }
                  }
                } catch (e) {
                  console.error("Error handling line slip in cloudflare:", e);
                }
              }
            }
            if (ev.type === "postback" && ev.postback && ev.postback.data) {
              const params = new URLSearchParams(ev.postback.data);
              const pbAction = params.get("action");
              const pbOrderId = params.get("orderId");
              if (pbOrderId && (pbAction === "cancelOrder" || pbAction === "confirmOrder")) {
                const newStatus = pbAction === "cancelOrder" ? "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01" : "\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19";
                await db.prepare("UPDATE orders SET status = ? WHERE order_id = ?").bind(newStatus, pbOrderId).run();
              }
            }
          }
          return jsonResponse({ status: "ok" });
        }
        if (postAction === "uploadSlip" || url.pathname === "/api/orders/upload-slip") {
          const orderId = postData.orderId;
          const slipUrlInput = postData.slipUrl || "";
          const base64Data = postData.base64 || "";
          if (!orderId) {
            return jsonResponse({ status: "error", message: "Missing orderId" }, 400);
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
            const cleanedBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
            const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch && mimeMatch[1] ? mimeMatch[1] : "image/jpeg";
            await db.prepare(`
                INSERT INTO order_slips (order_id, mime_type, image_base64, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(order_id) DO UPDATE SET
                  mime_type = excluded.mime_type,
                  image_base64 = excluded.image_base64,
                  created_at = excluded.created_at
              `).bind(orderId, mimeType, cleanedBase64, (/* @__PURE__ */ new Date()).toISOString()).run();
            finalSlipUrl = `${url.origin}/api/orders/${orderId}/slip`;
          }
          if (finalSlipUrl) {
            await db.prepare(`
                UPDATE orders SET slip_url = ?, status = CASE WHEN status IN ('\u0E23\u0E2D\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19', '\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A') THEN '\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19' ELSE status END 
                WHERE order_id = ?
              `).bind(finalSlipUrl, orderId).run();
            return jsonResponse({ status: "success", slipUrl: finalSlipUrl });
          }
          return jsonResponse({ status: "error", message: "No slip URL or file provided" }, 400);
        }
        if (postAction === "createOrder" || url.pathname === "/api/orders") {
          const data = postData;
          const timestamp = /* @__PURE__ */ new Date();
          const rand = Math.floor(Math.random() * 1e3);
          const orderId = data.orderId || `ORD-${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, "0")}${String(
            timestamp.getDate()
          ).padStart(2, "0")}-${String(timestamp.getHours()).padStart(2, "0")}${String(
            timestamp.getMinutes()
          ).padStart(2, "0")}${String(timestamp.getSeconds()).padStart(2, "0")}-${rand}`;
          const items = data.items || [];
          const itemsText = items.map((it) => `${it.name} x${it.qty}`).join(", ");
          const itemsJson = JSON.stringify(items);
          let displayAddress = data.addressDetails || "";
          if (data.shippingOption === "\u0E23\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E23\u0E49\u0E32\u0E19") {
            displayAddress = `\u{1F3EA} [\u0E23\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E23\u0E49\u0E32\u0E19] ${data.deliveryType === "\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32" && data.preorderTime ? `\u{1F552} \u0E2A\u0E31\u0E48\u0E07\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32: ${data.preorderTime} \u0E19.` : "\u0E23\u0E31\u0E1A\u0E17\u0E31\u0E19\u0E17\u0E35"}`;
          } else if (data.deliveryType === "\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32" && data.preorderTime) {
            displayAddress = `\u{1F552} [\u0E2A\u0E31\u0E48\u0E07\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32: ${data.preorderTime} \u0E19.] ${data.addressDetails || ""}`;
          }
          if (data.note) {
            displayAddress += `
\u{1F4DD} \u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38: ${data.note.trim()}`;
          }
          const insertQuery = `
            INSERT INTO orders (
              order_id, user_id, customer_name, phone, gps_location, address_details,
              slip_url, total_price, status, payment_method, items_text, items_json,
              delivery_type, preorder_time, shipping_option, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          await db.prepare(insertQuery).bind(
            orderId,
            data.userId || "unknown",
            data.displayName || data.customerName || "",
            data.phone || "",
            data.gpsLocation || "",
            displayAddress,
            data.slipUrl || "",
            Number(data.totalPrice || 0),
            "\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A",
            data.paymentMethod || "\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E32\u0E07",
            itemsText,
            itemsJson,
            data.deliveryType || "\u0E17\u0E31\u0E19\u0E17\u0E35",
            data.preorderTime || "",
            data.shippingOption || "\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07",
            data.note || ""
          ).run();
          if (data.userId && data.userId !== "unknown" && data.userId !== "web-test-user") {
            try {
              const member = await db.prepare("SELECT * FROM members WHERE user_id = ?").bind(data.userId).first();
              let savedAddresses = [];
              if (member && member.saved_addresses_json) {
                try {
                  savedAddresses = JSON.parse(member.saved_addresses_json);
                } catch (e) {
                }
              }
              if (data.shippingOption !== "\u0E23\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E23\u0E49\u0E32\u0E19" && data.gpsLocation) {
                const exists = savedAddresses.some(
                  (a) => a.gpsLocation === data.gpsLocation && a.addressDetails === data.addressDetails
                );
                if (!exists) {
                  savedAddresses.unshift({
                    label: data.addressLabel || "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19",
                    gpsLocation: data.gpsLocation,
                    addressDetails: data.addressDetails
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
              await db.prepare(memberQuery).bind(
                data.userId,
                data.displayName || "",
                data.phone || "",
                data.gpsLocation || "",
                data.addressDetails || "",
                data.addressLabel || "",
                JSON.stringify(savedAddresses)
              ).run();
            } catch (e) {
              console.error("Member address update error:", e);
            }
          }
          return jsonResponse({ status: "success", orderId });
        }
        if (postAction === "updateOrderStatus" || url.pathname === "/api/orders/status") {
          const { orderId, status } = postData;
          if (!orderId || !status) {
            return jsonResponse({ status: "error", message: "Missing orderId or status" }, 400);
          }
          const order = await db.prepare("SELECT * FROM orders WHERE order_id = ?").bind(orderId).first();
          if (!order) {
            return jsonResponse({ status: "error", message: "Order not found" }, 404);
          }
          await db.prepare("UPDATE orders SET status = ? WHERE order_id = ?").bind(status, orderId).run();
          let items = [];
          try {
            if (order.items_json) items = JSON.parse(order.items_json);
          } catch (e) {
          }
          const messages = [];
          const pm = order.payment_method || "";
          if ((status === "\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19" || status === "\u0E23\u0E2D\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19") && (pm.includes("\u0E42\u0E2D\u0E19") || pm.includes("\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E18\u0E19\u0E32\u0E04\u0E32\u0E23") || pm.includes("\u0E1C\u0E2A\u0E21"))) {
            messages.push(
              buildStatusFlexMessage(
                "\u{1F4B3} \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C & \u0E41\u0E08\u0E49\u0E07\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19",
                orderId,
                "\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E49\u0E27\u0E04\u0E23\u0E31\u0E1A \u0E04\u0E38\u0E13\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E15\u0E32\u0E21 QR Code \u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E19\u0E35\u0E49 \u0E41\u0E25\u0E49\u0E27\u0E41\u0E19\u0E1A\u0E2A\u0E25\u0E34\u0E1B\u0E21\u0E32\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E04\u0E23\u0E31\u0E1A \u2728",
                "#2563eb",
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
            if (pm.includes("\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E1C\u0E2A\u0E21\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14")) {
              const match = pm.match(/- โอน (\d+(?:\.\d+)?) บาท/);
              if (match && match[1]) qrAmount = Number(match[1]);
            }
            const dynamicQrUrl = `https://promptpay.io/${env.SHOP_PROMPTPAY_ID || "0957579454"}/${qrAmount}.png`;
            messages.push({
              type: "image",
              originalContentUrl: dynamicQrUrl,
              previewImageUrl: dynamicQrUrl
            });
            messages.push({
              type: "text",
              text: "\u{1F4A1} \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27 \u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E19\u0E35\u0E49\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E23\u0E39\u0E1B\u0E2A\u0E25\u0E34\u0E1B\u0E08\u0E32\u0E01\u0E2D\u0E31\u0E25\u0E1A\u0E31\u0E49\u0E21 \u0E2B\u0E23\u0E37\u0E2D\u0E16\u0E48\u0E32\u0E22\u0E23\u0E39\u0E1B\u0E2A\u0E48\u0E07\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E43\u0E19\u0E41\u0E0A\u0E17\u0E19\u0E35\u0E49\u0E44\u0E14\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E23\u0E31\u0E1A \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2A\u0E25\u0E34\u0E1B\u0E43\u0E2B\u0E49\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E04\u0E23\u0E31\u0E1A \u{1F447}",
              quickReply: {
                items: [
                  {
                    type: "action",
                    action: {
                      type: "cameraRoll",
                      label: "\u{1F4F8} \u0E41\u0E19\u0E1A\u0E2A\u0E25\u0E34\u0E1B\u0E08\u0E32\u0E01\u0E2D\u0E31\u0E25\u0E1A\u0E31\u0E49\u0E21"
                    }
                  },
                  {
                    type: "action",
                    action: {
                      type: "camera",
                      label: "\u{1F4F7} \u0E16\u0E48\u0E32\u0E22\u0E23\u0E39\u0E1B\u0E2A\u0E25\u0E34\u0E1B"
                    }
                  }
                ]
              }
            });
          } else if (status === "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E08\u0E31\u0E14\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" || status === "\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C" || status === "\u0E08\u0E31\u0E14\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E48\u0E07") {
            messages.push(
              buildStatusFlexMessage(
                "\u{1F4E6} \u0E01\u0E33\u0E25\u0E31\u0E07\u0E08\u0E31\u0E14\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32",
                orderId,
                "\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E01\u0E33\u0E25\u0E31\u0E07\u0E08\u0E31\u0E14\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E43\u0E2B\u0E49\u0E04\u0E38\u0E13\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E15\u0E31\u0E49\u0E07\u0E43\u0E08\u0E04\u0E23\u0E31\u0E1A \u0E23\u0E2D\u0E23\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E2D\u0E23\u0E48\u0E2D\u0E22\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22! \u{1F9D1}\u200D\u{1F373}\u2728",
                "#f59e0b",
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
          } else if (status === "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07") {
            messages.push(
              buildStatusFlexMessage(
                "\u{1F69A} \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2D\u0E22\u0E39\u0E48\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07",
                orderId,
                "\u0E1E\u0E35\u0E48\u0E44\u0E23\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E01\u0E33\u0E25\u0E31\u0E07\u0E19\u0E33\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E48\u0E07\u0E15\u0E23\u0E07\u0E44\u0E1B\u0E16\u0E36\u0E07\u0E04\u0E38\u0E13\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E41\u0E25\u0E49\u0E27\u0E04\u0E23\u0E31\u0E1A! \u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E2D\u0E38\u0E14\u0E2B\u0E19\u0E38\u0E19\u0E04\u0E23\u0E31\u0E1A \u{1F60A}\u{1F6F5}",
                "#8b5cf6",
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
          } else if (status === "\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" || status === "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27") {
            messages.push(
              buildStatusFlexMessage(
                "\u{1F389} \u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22",
                orderId,
                "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E16\u0E36\u0E07\u0E21\u0E37\u0E2D\u0E04\u0E38\u0E13\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27 \u0E17\u0E32\u0E19\u0E43\u0E2B\u0E49\u0E2D\u0E23\u0E48\u0E2D\u0E22\u0E19\u0E30\u0E04\u0E49\u0E32\u0E1A! \u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E2D\u0E38\u0E14\u0E2B\u0E19\u0E38\u0E19\u0E23\u0E49\u0E32\u0E19\u0E40\u0E01\u0E37\u0E49\u0E2D\u0E01\u0E39\u0E25\u0E01\u0E31\u0E19\u0E04\u0E23\u0E31\u0E1A \u{1F970}\u2764\uFE0F",
                "#16a34a",
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
          } else if (status === "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01") {
            messages.push(
              buildStatusFlexMessage(
                "\u{1F97A} \u0E41\u0E08\u0E49\u0E07\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C",
                orderId,
                "\u0E17\u0E32\u0E07\u0E23\u0E49\u0E32\u0E19\u0E08\u0E33\u0E40\u0E1B\u0E47\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E02\u0E2D\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E04\u0E23\u0E31\u0E1A \u{1F64F}\u2764\uFE0F \u0E15\u0E49\u0E2D\u0E07\u0E02\u0E2D\u0E2D\u0E20\u0E31\u0E22\u0E43\u0E19\u0E04\u0E27\u0E32\u0E21\u0E44\u0E21\u0E48\u0E2A\u0E30\u0E14\u0E27\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E22\u0E34\u0E48\u0E07\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E23\u0E31\u0E1A \u0E2B\u0E27\u0E31\u0E07\u0E27\u0E48\u0E32\u0E08\u0E30\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E14\u0E39\u0E41\u0E25\u0E04\u0E38\u0E13\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48\u0E43\u0E19\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E30\u0E04\u0E23\u0E31\u0E1A \u{1F970}\u2728",
                "#dc2626",
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
            if (ctx && typeof ctx.waitUntil === "function") {
              ctx.waitUntil(sendLinePush(env, order.user_id, messages));
            } else {
              await sendLinePush(env, order.user_id, messages);
            }
          }
          return jsonResponse({ status: "success" });
        }
        if (postAction === "updateOrderItems" || url.pathname === "/api/orders/items") {
          const { orderId, items, totalPrice, changeNote } = postData;
          const order = await db.prepare("SELECT * FROM orders WHERE order_id = ?").bind(orderId).first();
          if (!order) {
            return jsonResponse({ status: "error", message: "Order not found" }, 404);
          }
          const newItems = items || [];
          const itemsText = newItems.map((it) => `${it.name} x${it.qty}`).join(", ");
          const itemsJson = JSON.stringify(newItems);
          const newTotal = Number(totalPrice || 0);
          await db.prepare(
            "UPDATE orders SET items_text = ?, items_json = ?, total_price = ?, status = '\u0E23\u0E2D\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19' WHERE order_id = ?"
          ).bind(itemsText, itemsJson, newTotal, orderId).run();
          if (order.user_id && order.user_id !== "unknown" && order.user_id !== "web-test-user") {
            let bodyText = "\u0E17\u0E32\u0E07\u0E23\u0E49\u0E32\u0E19\u0E44\u0E14\u0E49\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E23\u0E32\u0E04\u0E32\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32/\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E23\u0E31\u0E1A";
            if (changeNote && changeNote.trim()) {
              bodyText += ` (\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38: ${changeNote.trim()})`;
            }
            const flexMsg = buildStatusFlexMessage(
              "\u270F\uFE0F \u0E41\u0E08\u0E49\u0E07\u0E1B\u0E23\u0E31\u0E1A\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C",
              orderId,
              bodyText,
              "#0f766e",
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
              type: "template",
              altText: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E41\u0E1B\u0E25\u0E07\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C",
              template: {
                type: "buttons",
                text: "\u0E04\u0E38\u0E13\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E17\u0E35\u0E48\u0E41\u0E01\u0E49\u0E44\u0E02\u0E19\u0E35\u0E49\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E04\u0E23\u0E31\u0E1A?",
                actions: [
                  {
                    type: "postback",
                    label: "\u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D",
                    data: `action=confirmOrder&orderId=${orderId}`,
                    displayText: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E17\u0E35\u0E48\u0E41\u0E01\u0E49\u0E44\u0E02\u0E19\u0E35\u0E49\u0E04\u0E23\u0E31\u0E1A"
                  },
                  {
                    type: "postback",
                    label: "\u274C \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D",
                    data: `action=cancelOrder&orderId=${orderId}`,
                    displayText: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E02\u0E2D\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49\u0E04\u0E23\u0E31\u0E1A"
                  }
                ]
              }
            };
            if (ctx && typeof ctx.waitUntil === "function") {
              ctx.waitUntil(sendLinePush(env, order.user_id, [flexMsg, confirmTemplate]));
            } else {
              await sendLinePush(env, order.user_id, [flexMsg, confirmTemplate]);
            }
          }
          return jsonResponse({ status: "success", message: "Order items updated" });
        }
        if (postAction === "updateProductStatus" || url.pathname === "/api/products/status") {
          const targetId = postData.id || postData.productId;
          const rawStatus = postData.status;
          const newStatus = rawStatus === "inactive" || rawStatus === false || rawStatus === "0" ? "inactive" : "active";
          if (!targetId) {
            return jsonResponse({ status: "error", message: "Missing product id" }, 400);
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
            await db.prepare("UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(newStatus, String(targetId)).run();
          } catch (e) {
          }
          return jsonResponse({
            status: "success",
            message: `Product ${targetId} status updated to ${newStatus}`,
            id: targetId,
            productStatus: newStatus
          });
        }
        if (postAction === "syncProductsBatch" || url.pathname === "/api/products/batch") {
          const products = postData.products || [];
          if (!Array.isArray(products) || products.length === 0) {
            return jsonResponse({ status: "success", imported: 0, message: "No products provided" });
          }
          const insertStmt = db.prepare(`
            INSERT INTO products (id, name, category, price, desc, img, tag, status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              name = COALESCE(NULLIF(excluded.name, ''), products.name),
              category = COALESCE(NULLIF(excluded.category, ''), products.category),
              price = excluded.price,
              desc = COALESCE(NULLIF(excluded.desc, ''), products.desc),
              img = excluded.img,
              tag = COALESCE(NULLIF(excluded.tag, ''), products.tag),
              status = COALESCE(NULLIF(excluded.status, ''), products.status),
              updated_at = CURRENT_TIMESTAMP
          `);
          const batch = [];
          for (const p of products) {
            if (!p.id) continue;
            batch.push(
              insertStmt.bind(
                String(p.id).trim(),
                p.name || "",
                p.category || "\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B",
                Number(p.price || 0),
                p.desc || "",
                p.img || "",
                p.tag || "",
                p.status || "active"
              )
            );
          }
          if (batch.length > 0) {
            await db.batch(batch);
          }
          return jsonResponse({ status: "success", imported: batch.length });
        }
        if (postAction === "syncOrdersBatch" || url.pathname === "/api/orders/batch") {
          const orders = postData.orders || [];
          if (!Array.isArray(orders) || orders.length === 0) {
            return jsonResponse({ status: "success", imported: 0, message: "No orders provided" });
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
            const itemsText = o.itemsText || (Array.isArray(items) ? items.map((it) => `${it.name || ""} x${it.qty || 1}`).join(", ") : "");
            const itemsJson = typeof items === "string" ? items : JSON.stringify(items);
            batch.push(
              insertStmt.bind(
                o.orderId,
                o.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
                o.userId || "unknown",
                o.customerName || o.displayName || "",
                o.phone || "",
                o.gpsLocation || "",
                o.addressDetails || "",
                o.slipUrl || "",
                Number(o.totalPrice || 0),
                o.status || "\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A",
                o.paymentMethod || "\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E32\u0E07",
                itemsText,
                itemsJson,
                o.deliveryType || "\u0E17\u0E31\u0E19\u0E17\u0E35",
                o.preorderTime || "",
                o.shippingOption || "\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07",
                o.note || ""
              )
            );
          }
          if (batch.length > 0) {
            await db.batch(batch);
          }
          return jsonResponse({ status: "success", imported: batch.length });
        }
        if (postAction === "syncMembersBatch" || url.pathname === "/api/members/batch") {
          const members = postData.members || [];
          if (!Array.isArray(members) || members.length === 0) {
            return jsonResponse({ status: "success", imported: 0, message: "No members provided" });
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
                m.displayName || "",
                m.statusMessage || "",
                m.email || "",
                m.pictureUrl || "",
                m.phone || "",
                m.gpsLocation || "",
                m.addressDetails || "",
                m.addressLabel || "",
                m.savedAddresses || m.saved_addresses_json || "[]",
                m.registeredAt || (/* @__PURE__ */ new Date()).toISOString()
              )
            );
          }
          if (batch.length > 0) {
            await db.batch(batch);
          }
          return jsonResponse({ status: "success", imported: batch.length });
        }
        if (postAction === "register" || url.pathname === "/api/members" || postData.userId) {
          const userId = postData.userId;
          if (!userId) {
            return jsonResponse({ status: "error", message: "Missing userId" }, 400);
          }
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
          await db.prepare(query).bind(
            userId,
            postData.displayName || "",
            postData.statusMessage || "",
            postData.email || "",
            postData.pictureUrl || "",
            postData.phone || ""
          ).run();
          return jsonResponse({ status: "success" });
        }
      }
      if (url.pathname.startsWith("/api/products/") && method === "DELETE") {
        const id = url.pathname.split("/")[3];
        await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
        return jsonResponse({ status: "success", message: `Product ${id} deleted` });
      }
      return jsonResponse({ status: "error", message: `Route ${url.pathname} not found` }, 404);
    } catch (err) {
      console.error("Worker error:", err);
      return jsonResponse({ status: "error", message: err.message }, 500);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
