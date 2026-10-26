window.GOOGLE_SCRIPT_URL = window.GOOGLE_SCRIPT_URL || 'https://kuekoonkan-api.noperfecf.workers.dev';
var GOOGLE_SCRIPT_URL = window.GOOGLE_SCRIPT_URL;

let PRODUCTS = [];

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

function formatThaiPhoneNumber(raw) {
  let num = String(raw || '').replace(/[^0-9]/g, '');
  if (num.length > 10) num = num.slice(0, 10);
  if (num.length > 6) {
    return `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
  } else if (num.length > 3) {
    return `${num.slice(0, 3)}-${num.slice(3)}`;
  }
  return num;
}

// ========================================================
// 1. PROMO CODE / COUPON SYSTEM
// ========================================================
let PROMO_CODES = {
  'WELCOME50': {
    code: 'WELCOME50',
    type: 'fixed',
    amount: 50,
    percent: 0,
    minSpend: 100,
    desc: 'ส่วนลด ฿50 เมื่อสั่งซื้อขั้นต่ำ ฿100',
    startDate: '',
    endDate: ''
  },
  'FREESHIP': {
    code: 'FREESHIP',
    type: 'shipping',
    amount: 0,
    percent: 0,
    minSpend: 0,
    desc: 'ฟรีค่าจัดส่งทุกระยะทาง',
    startDate: '',
    endDate: ''
  },
  'KUE10': {
    code: 'KUE10',
    type: 'percent',
    amount: 0,
    percent: 10,
    minSpend: 150,
    desc: 'ลด 10% เมื่อสั่งซื้อขั้นต่ำ ฿150',
    startDate: '',
    endDate: ''
  },
  'BAKERY20': {
    code: 'BAKERY20',
    type: 'fixed',
    amount: 20,
    percent: 0,
    minSpend: 60,
    desc: 'ส่วนลด ฿20 สำหรับของใช้และวัตถุดิบเบเกอรี่',
    startDate: '',
    endDate: ''
  }
};

let appliedCoupon = null;

async function syncActivePromoCodes() {
  // 1. แคชเร็ว 0ms จาก LocalStorage
  try {
    const cached = localStorage.getItem('cached_active_promos');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        updatePromoCodesMap(parsed);
      }
    }
  } catch (e) {}

  // 2. ดึงข้อมูลล่าสุดจาก Cloudflare D1 Backend
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getPromoCodes&activeOnly=true&_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success' && Array.isArray(data.promos)) {
        try {
          localStorage.setItem('cached_active_promos', JSON.stringify(data.promos));
        } catch (e) {}
        updatePromoCodesMap(data.promos);
      }
    }
  } catch (err) {
    console.warn('Sync promo codes error:', err);
  }
}

function updatePromoCodesMap(promosList) {
  if (!Array.isArray(promosList) || promosList.length === 0) return;
  const newMap = {};
  promosList.forEach(p => {
    if (!p.code) return;
    const code = String(p.code).trim().toUpperCase();
    const type = p.type || 'fixed';
    const amount = Number(p.amount) || 0;
    const percent = Number(p.percent) || 0;
    const minSpend = Number(p.min_spend || p.minSpend) || 0;
    let desc = p.description;
    if (!desc) {
      if (type === 'percent') desc = `ลด ${percent}% เมื่อสั่งซื้อขั้นต่ำ ฿${minSpend}`;
      else if (type === 'shipping') desc = `ฟรีค่าจัดส่ง${minSpend > 0 ? ` เมื่อสั่งซื้อขั้นต่ำ ฿${minSpend}` : ''}`;
      else desc = `ส่วนลด ฿${amount} เมื่อสั่งซื้อขั้นต่ำ ฿${minSpend}`;
    }
    newMap[code] = {
      code,
      type,
      amount,
      percent,
      minSpend,
      desc,
      startDate: p.start_date || p.startDate || '',
      endDate: p.end_date || p.endDate || ''
    };
  });

  if (Object.keys(newMap).length > 0) {
    PROMO_CODES = newMap;
    renderQuickCouponChips();
  }
}

function renderQuickCouponChips() {
  const container = document.getElementById('quickCouponChipsContainer');
  if (!container) return;
  const codes = Object.values(PROMO_CODES);
  if (codes.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';

  let chipsHtml = '<span style="font-size: 11.5px; color: #64748b; font-weight: 500;">แนะนำ:</span>';
  codes.forEach(p => {
    let badgeText = '';
    let bg = '#eff6ff';
    let border = '#3b82f6';
    let color = '#1d4ed8';

    if (p.type === 'percent') {
      badgeText = `✨ ${p.code} (ลด ${p.percent}%)`;
      bg = '#fefce8';
      border = '#eab308';
      color = '#854d0e';
    } else if (p.type === 'shipping') {
      badgeText = `🚚 ${p.code} (ส่งฟรี)`;
      bg = '#f0fdf4';
      border = '#10b981';
      color = '#047857';
    } else {
      badgeText = `🏷️ ${p.code} (ลด ${p.amount}฿)`;
    }

    chipsHtml += `<button type="button" class="coupon-chip" onclick="applyPromoChip('${p.code}')" style="background: ${bg}; border: 1px dashed ${border}; color: ${color}; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 700; cursor: pointer;">${badgeText}</button>`;
  });
  container.innerHTML = chipsHtml;
}

async function applyPromoCode(inputCode) {
  const code = String(inputCode || '').trim().toUpperCase();
  const msgEl = document.getElementById('couponMessage');
  const badgeEl = document.getElementById('couponBadge');
  const container = document.getElementById('promoCodeContainer');
  const inputEl = document.getElementById('couponCodeInput');

  if (!code) {
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = '#ef4444';
      msgEl.textContent = 'กรุณากรอกโค้ดส่วนลด';
    }
    return;
  }

  let promo = PROMO_CODES[code];
  if (!promo) {
    // ถ้ายังไม่พบในแคช ลองดึงจาก API เซิร์ฟเวอร์อีกครั้งทันที
    try {
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getPromoCodes&activeOnly=true&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'success' && Array.isArray(data.promos)) {
          updatePromoCodesMap(data.promos);
          promo = PROMO_CODES[code];
        }
      }
    } catch (e) {}
  }

  if (!promo) {
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = '#ef4444';
      msgEl.textContent = `❌ ไม่พบโค้ด "${code}" หรือโค้ดนี้ถูกปิด/หมดอายุแล้ว`;
    }
    if (container) container.classList.remove('applied');
    if (badgeEl) badgeEl.style.display = 'none';
    appliedCoupon = null;
    calculateCheckoutTotal();
    return;
  }

  // ตรวจสอบวันเริ่มและวันสิ้นสุดโปรโมชั่น
  const today = new Date().toISOString().slice(0, 10);
  if (promo.startDate && promo.startDate.trim() !== '' && today < promo.startDate.trim()) {
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = '#ef4444';
      msgEl.textContent = `⏳ โค้ดนี้จะเริ่มใช้งานได้ในวันที่ ${promo.startDate}`;
    }
    if (container) container.classList.remove('applied');
    if (badgeEl) badgeEl.style.display = 'none';
    appliedCoupon = null;
    calculateCheckoutTotal();
    return;
  }
  if (promo.endDate && promo.endDate.trim() !== '' && today > promo.endDate.trim()) {
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = '#ef4444';
      msgEl.textContent = `🔴 โค้ดนี้หมดอายุแล้ว (สิ้นสุดเมื่อ ${promo.endDate})`;
    }
    if (container) container.classList.remove('applied');
    if (badgeEl) badgeEl.style.display = 'none';
    appliedCoupon = null;
    calculateCheckoutTotal();
    return;
  }

  // คำนวณยอดรวมสินค้าเพื่อตรวจ minSpend
  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0);
  if (subtotal < promo.minSpend) {
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = '#dc2626';
      msgEl.textContent = `⚠️ โค้ดนี้ต้องมียอดซื้อสินค้าขั้นต่ำ ฿${promo.minSpend} (ยอดปัจจุบัน ฿${subtotal})`;
    }
    if (container) container.classList.remove('applied');
    if (badgeEl) badgeEl.style.display = 'none';
    appliedCoupon = null;
    calculateCheckoutTotal();
    return;
  }

  appliedCoupon = promo;
  if (inputEl) inputEl.value = code;
  if (container) container.classList.add('applied');
  if (badgeEl) {
    badgeEl.style.display = 'inline-block';
    badgeEl.textContent = `✓ ใช้โค้ด ${code} สำเร็จ!`;
  }
  if (msgEl) {
    msgEl.style.display = 'block';
    msgEl.style.color = '#15803d';
    msgEl.textContent = `🎉 ${promo.desc}`;
  }

  calculateCheckoutTotal();
}

function removePromoCode() {
  appliedCoupon = null;
  const msgEl = document.getElementById('couponMessage');
  const badgeEl = document.getElementById('couponBadge');
  const container = document.getElementById('promoCodeContainer');
  const inputEl = document.getElementById('couponCodeInput');

  if (inputEl) inputEl.value = '';
  if (container) container.classList.remove('applied');
  if (badgeEl) badgeEl.style.display = 'none';
  if (msgEl) {
    msgEl.style.display = 'none';
  }
  calculateCheckoutTotal();
}

window.applyPromoChip = function(code) {
  const inputEl = document.getElementById('couponCodeInput');
  if (inputEl) inputEl.value = code;
  applyPromoCode(code);
};

// ========================================================
// 2. UPSELLING / CROSS-SELLING SYSTEM
// ========================================================
function renderUpsellSection(container) {
  if (!container || cart.length === 0 || !PRODUCTS || PRODUCTS.length === 0) return;

  const cartIds = new Set(cart.map(c => String(c.id)));
  let candidates = PRODUCTS.filter(p => !cartIds.has(String(p.id)) && (!p.status || String(p.status).toLowerCase() !== 'inactive'));
  if (candidates.length === 0) return;

  // จัดลำดับความน่าสนใจ: หมวดวัตถุดิบเบเกอรี่, ขนมขบเคี้ยว, ของใช้ประจำวัน หรือสินค้าแนะนำ
  const prioritized = candidates.filter(p => {
    const cat = String(p.category || '').toLowerCase();
    const name = String(p.name || '').toLowerCase();
    return cat.includes('วัตถุดิบ') || cat.includes('เบเกอรี่') || cat.includes('bakery') || cat.includes('ขนม') || cat.includes('แป้ง') || cat.includes('เนย') || cat.includes('นม') || cat.includes('ช็อกโกแลต') || cat.includes('เครื่องปรุง') || cat.includes('ของใช้');
  });

  const upsellItems = (prioritized.length >= 3 ? prioritized : candidates).slice(0, 4);
  if (upsellItems.length === 0) return;

  const upsellWrapper = document.createElement('div');
  upsellWrapper.className = 'cart-upsell-wrapper';
  upsellWrapper.innerHTML = `
    <div style="font-weight: 700; font-size: 13.5px; color: #1e293b; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 6px;">
        <span>✨</span> สินค้าแนะนำซื้อเพิ่มสุดคุ้ม (ของใช้/วัตถุดิบยอดนิยม)
      </span>
      <span style="font-size: 11px; color: #64748b; font-weight: 500;">แตะเพื่อเพิ่ม</span>
    </div>
    <div class="upsell-items-scroll">
      ${upsellItems.map(item => `
        <div class="upsell-card">
          <img src="${getOptimizedImageUrl(item.img)}" alt="${item.name}" class="upsell-img" onerror="this.onerror=null; this.src='https://placehold.co/200x200/f3f0ec/a88b62?text=Item';" />
          <div class="upsell-title" title="${item.name}">${item.name}</div>
          <div class="upsell-price">฿${(Number(item.price) || 0).toLocaleString()}</div>
          <button type="button" class="btn-upsell-add" onclick="addUpsellToCart('${item.id}')">
            <span>+</span> เพิ่ม
          </button>
        </div>
      `).join('')}
    </div>
  `;
  container.appendChild(upsellWrapper);
}

window.addUpsellToCart = function(productId) {
  const product = PRODUCTS.find(p => String(p.id) === String(productId));
  if (!product) return;
  addToCart(product, 1);
  renderCartItems();
};

// ========================================================
// 3. VISUAL ORDER TIMELINE STEPPER
// ========================================================
function renderOrderTimeline(status) {
  const normStatus = String(status || '').trim();
  let currentStep = 1;
  let isCancelled = false;

  if (normStatus === 'ยกเลิก') {
    isCancelled = true;
  } else if (normStatus === 'จัดส่งสำเร็จ') {
    currentStep = 4;
  } else if (normStatus === 'กำลังจัดส่ง' || normStatus === 'จัดส่งแล้ว') {
    currentStep = 3;
  } else if (normStatus === 'กำลังจัดเตรียมสินค้า' || normStatus === 'ชำระเงิน' || normStatus === 'ยืนยันแล้ว' || normStatus === 'รอชำระเงิน') {
    currentStep = 2;
  } else {
    currentStep = 1;
  }

  if (isCancelled) {
    return `
      <div class="order-timeline-stepper" style="background: #fef2f2; border-color: #fecaca; margin-top: 12px;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #dc2626; font-weight: 700; font-size: 13px;">
          <span>❌</span> คำสั่งซื้อนี้ถูกยกเลิกแล้ว
        </div>
      </div>
    `;
  }

  const steps = [
    { num: 1, label: 'รับออเดอร์', icon: '⏳', desc: 'ร้านค้าได้รับคำสั่งซื้อแล้ว รอการตรวจสอบ' },
    { num: 2, label: 'กำลังเตรียม', icon: '📦', desc: 'ทางร้านกำลังจัดเตรียมและแพ็คสินค้าของคุณลงกล่อง' },
    { num: 3, label: 'กำลังส่ง', icon: '🛵', desc: 'สินค้ากำลังเดินทางไปยังปลายทางของคุณ' },
    { num: 4, label: 'ส่งสำเร็จ', icon: '✅', desc: 'สินค้าจัดส่งถึงคุณเรียบร้อยแล้ว ขอบคุณที่ใช้บริการครับ' }
  ];

  const progressPercent = Math.round(((currentStep - 1) / (steps.length - 1)) * 100);
  const activeDesc = steps[currentStep - 1].desc;

  return `
    <div class="order-timeline-stepper">
      <div class="timeline-track">
        <div class="timeline-track-base"></div>
        <div class="timeline-track-progress" style="width: calc(${progressPercent}% - 30px);"></div>
        ${steps.map(s => {
          let stateClass = '';
          if (s.num < currentStep) stateClass = 'completed';
          else if (s.num === currentStep) stateClass = 'active';
          return `
            <div class="timeline-step ${stateClass}">
              <div class="step-dot">
                ${s.num < currentStep ? '✓' : s.icon}
              </div>
              <span class="step-label">${s.label}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div class="timeline-desc-box">
        💡 <strong>ความคืบหน้า:</strong> ${activeDesc}
      </div>
    </div>
  `;
}

// Helper สำหรับปรับแต่ง URL รูปภาพเพื่อประสิทธิภาพสูงสุด (แปลงเป็น WebP และย่อขนาดหากมี CDN รองรับ)
function getOptimizedImageUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return 'https://placehold.co/600x600/f3f0ec/a88b62?text=No+Image';
  }

  let optimizedUrl = url.trim();

  // ดักจับรูปเก่า / รูปเทป B.K. ที่เคยติดค้างในระบบ (1779018898541-98193691087.jpg) ไม่ให้แสดงผลเด็ดขาด
  if (optimizedUrl.includes('1779018898541-98193691087.jpg')) {
    return 'https://placehold.co/600x600/f3f0ec/a88b62?text=No+Image';
  }

  // แปลง Google Drive link ให้เป็น Direct Image Link เพื่อให้โหลดได้และเร็วขึ้น
  if (optimizedUrl.includes('drive.google.com') || optimizedUrl.includes('docs.google.com')) {
    let driveId = '';
    const match1 = optimizedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const match2 = optimizedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);

    if (match1) {
      driveId = match1[1];
    } else if (match2) {
      driveId = match2[1];
    }

    if (driveId) {
      optimizedUrl = `https://lh3.googleusercontent.com/d/${driveId}`;
    }
  }

  // ปิดการใช้ Image CDN (wsrv.nl) ชั่วคราว
  // เนื่องจากถ้ารูปเป็นลิงก์ API หรือระบบอื่นๆ CDN มักจะเข้าถึงไม่ได้ทำให้รูปไม่โหลด
  // ปล่อยให้โหลดจากลิงก์ต้นฉบับโดยตรงจะชัวร์ที่สุดครับ
  /*
  if (!optimizedUrl.includes('wsrv.nl') && !optimizedUrl.includes('placehold.co') && !optimizedUrl.includes('googleusercontent.com')) {
    optimizedUrl = `https://wsrv.nl/?url=${encodeURIComponent(optimizedUrl)}&w=400&output=webp`;
  }
  */

  return optimizedUrl;
}

// Mock Product Data for Fallback
function getMockProducts() {
  return [
    {
      id: 1,
      name: 'Iced Caramel Macchiato',
      category: 'coffee',
      price: 120,
      desc: 'เอสเพรสโซ่รสเข้มข้นผสมกับนมสดและไซรัปวานิลลา ราดด้วยซอสคาราเมลหอมหวานสูตรพิเศษ เสิร์ฟพร้อมน้ำแข็งเย็นชื่นใจ เหมาะสำหรับผู้ที่ชอบรสชาติหอมหวานมันกลมกล่อม',
      img: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&q=80&w=600',
      tag: 'ยอดนิยม'
    },
    {
      id: 2,
      name: 'Premium Hot Matcha Latte',
      category: 'tea',
      price: 95,
      desc: 'มัทฉะแท้นำเข้าจากเมืองอูจิ ประเทศญี่ปุ่น ชงอย่างพิถีพิถันผสมผสานกับนมสดแท้ 100% สตรีมจนร้อนได้ที่ ตกแต่งด้วยลาเต้อาร์ตที่งดงาม ให้กลิ่นอายความหอมแบบมัทฉะแท้ๆ ในทุกอึก',
      img: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=600',
      tag: 'แนะนำ'
    },
    {
      id: 3,
      name: 'Signature Almond Croissant',
      category: 'bakery',
      price: 110,
      desc: 'ครัวซองต์เนยสดฝรั่งเศส นำไปอบซ้ำแบบ Double-baked สอดไส้ด้วยครีมอัลมอนด์ฟรานจิเพนรสเข้มข้น โรยด้วยแผ่นอัลมอนด์อบกรอบและน้ำตาลไอซิ่ง กรอบนอกนุ่มใน หอมมันอร่อย',
      img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=600',
      tag: 'อบสดใหม่'
    },
    {
      id: 4,
      name: 'Cold Brew Citrus Coffee',
      category: 'coffee',
      price: 105,
      desc: 'กาแฟสกัดเย็นแบบพรีเมียมบ่มนานกว่า 18 ชั่วโมง เพื่อดึงรสชาติความหวานตามธรรมชาติของเมล็ดกาแฟ ผสมผสานอย่างลงตัวกับน้ำส้มยูสุคั้นสด ให้ความสดชื่นตื่นตัวในยามบ่าย',
      img: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&q=80&w=600',
      tag: 'สดชื่น'
    },
    {
      id: 5,
      name: 'Dirty Coffee',
      category: 'coffee',
      price: 115,
      desc: 'นมสดเย็นจัดสูตรลับเฉพาะของทางร้าน เสิร์ฟแยกชั้นราดทับด้วยช็อตเอสเพรสโซ่ Ristretto ที่เข้มข้น ดื่มด่ำรสสัมผัสที่แตกต่างระหว่างความร้อนและความเย็นในแก้วเดียว',
      img: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600',
      tag: 'ขวัญใจคอกาแฟ'
    },
    {
      id: 6,
      name: 'Premium Earl Grey Tea',
      category: 'tea',
      price: 85,
      desc: 'ชาเอิร์ลเกรย์เกรดพรีเมียม แช่ในน้ำร้อนอุณหภูมิที่พอดีเพื่อให้กลิ่นส้มมะกรูดอันเป็นเอกลักษณ์ฟุ้งกระจายอย่างนุ่มนวล เสิร์ฟในรูปแบบกาน้ำชาแก้วหรูหรา',
      img: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=600',
      tag: 'ออร์แกนิก'
    }
  ];
}

// App State
// กำหนดเบอร์ PromptPay สำหรับสร้าง QR Code สแกนจ่าย (กรุณาเปลี่ยนเป็นเบอร์ร้านค้าจริง)
const SHOP_PROMPTPAY_ID = '0957579454';

let currentParentCategory = 'all';
let currentSubCategory = 'all';
let searchQuery = '';
let currentSort = 'price_asc';
let activeProduct = null;
let visibleLimit = 20; // จำกัดจำนวนการแสดงผลในครั้งแรกเพื่อความรวดเร็ว (Pagination)
let cart = [];
let favoriteOrderIds = JSON.parse(localStorage.getItem('favoriteOrderIds') || '[]');
let currentOrderTab = 'all';
let currentMemberInfo = { displayName: '', phone: '' };

// โหลดข้อมูลสมาชิกจาก Cache ทันทีตั้งแต่ตอนเริ่มแอป (ก่อน LIFF init เสร็จ)
// ทำให้เบอร์โทรและชื่อปรากฏในฟอร์มได้ทันทีตั้งแต่ครั้งที่ 2 ที่ใช้งาน
try {
  const _cached = localStorage.getItem('member_info_cache');
  if (_cached) {
    const _info = JSON.parse(_cached);
    if (_info && _info.phone) {
      currentMemberInfo = { displayName: _info.displayName || '', phone: _info.phone || '' };
    }
  }
} catch (e) { }

// Elements
const productsGrid = document.getElementById('productsGrid');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
if (sortSelect) {
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderProducts();
  });
}
const modal = document.getElementById('productModal');
const modalContent = document.getElementById('modalContentBody');
const btnBack = document.getElementById('btnBack');
const lightbox = document.getElementById('imageLightbox');
const lightboxImg = document.getElementById('lightboxImage');
const lightboxCaption = document.getElementById('lightboxCaption');
const btnCloseLightbox = document.getElementById('btnCloseLightbox');

// Elements (Cart & Checkout)
const btnCart = document.getElementById('btnCart');
const cartBadge = document.getElementById('cartBadge');
const cartModal = document.getElementById('cartModal');
const btnCloseCartModal = document.getElementById('btnCloseCartModal');
const btnContinueShopping = document.getElementById('btnContinueShopping');
const btnGoToCheckout = document.getElementById('btnGoToCheckout');
const checkoutModal = document.getElementById('checkoutModal');
const btnCloseCheckoutModal = document.getElementById('btnCloseCheckoutModal');
const btnGetLocation = document.getElementById('btnGetLocation');
const btnSubmitOrder = document.getElementById('btnSubmitOrder');

// Initialize LIFF
async function initLiff() {
  try {
    if (typeof liff === 'undefined') {
      console.warn('LIFF SDK not available on window');
      return;
    }
    // ถ้า LIFF ได้รับการ init เรียบร้อยแล้ว (เช่น จาก index.js ในโหมด SPA) ไม่ต้อง init ซ้ำ
    if (!liff.id) {
      await liff.init({ liffId: '2010951634-lg8G4wUA' });
    }
    console.log('LIFF Initialized in catalog page');
    if (liff.isLoggedIn()) {
      try {
        const profile = await liff.getProfile();
        if (profile && profile.displayName) {
          currentMemberInfo.displayName = profile.displayName;
        }
        if (profile && profile.userId) {
          await fetchMemberInfo(profile.userId);
        }
      } catch (profileError) {
        console.error('Error fetching LINE profile on init:', profileError);
      }
    }
  } catch (error) {
    console.warn('LIFF initialization handled gracefully:', error);
  }
}

// Render Products
function renderProducts() {
  productsGrid.innerHTML = '';

  const filtered = PRODUCTS.filter(product => {
    if (product.status && String(product.status).toLowerCase() === 'inactive') return false;
    if (!product._parsedParent) {
      const parsed = parseProductCategory(product.category);
      product._parsedParent = parsed.parent;
      product._parsedSub = parsed.sub;
    }

    const matchesParent = currentParentCategory === 'all' || product._parsedParent === currentParentCategory;
    const matchesSub = currentSubCategory === 'all' || product._parsedSub === currentSubCategory;
    const matchesCategory = matchesParent && matchesSub;

    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const hasValidPrice = Number(product.price) > 0;
    return matchesCategory && matchesSearch && hasValidPrice;
  });

  // เรียงลำดับสินค้าจากราคาถูกไปหาแพง
  filtered.sort((a, b) => {
    if (currentSort === 'price_asc') {
      return (Number(a.price) || 0) - (Number(b.price) || 0);
    } else if (currentSort === 'price_desc') {
      return (Number(b.price) || 0) - (Number(a.price) || 0);
    } else if (currentSort === 'name_asc') {
      return a.name.localeCompare(b.name, 'th');
    }
    return 0;
  });

  if (filtered.length === 0) {
    productsGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <p>ไม่พบสินค้าที่คุณกำลังมองหา...</p>
      </div>
    `;
    return;
  }

  // แสดงผลเฉพาะจำนวนสินค้าที่จำกัดไว้ (Lazy Rendering / Pagination)
  const toRender = filtered.slice(0, visibleLimit);

  toRender.forEach(product => {
    const productImg = getOptimizedImageUrl(product.img);
    const isOutOfStock = (product.stock !== undefined && Number(product.stock) <= 0) || product.status === 'out_of_stock';
    const isLowStock = !isOutOfStock && product.stock !== undefined && Number(product.stock) > 0 && Number(product.stock) <= 5;

    const card = document.createElement('div');
    card.className = `product-card animate-fade-in ${isOutOfStock ? 'is-out-of-stock' : ''}`;
    card.innerHTML = `
      <div class="product-img-wrapper">
        <img class="product-img" src="${productImg}" alt="${product.name}" loading="lazy" onerror="this.onerror=null; this.src='https://placehold.co/600x600/f3f0ec/a88b62?text=No+Image';">
        ${isOutOfStock ? `<span class="product-tag tag-out-of-stock" style="background:#ef4444; color:#fff; font-weight:700;">สินค้าหมด</span>` : (product.tag ? `<span class="product-tag">${product.tag}</span>` : '')}
        ${isLowStock ? `<span class="product-tag tag-low-stock" style="background:#f59e0b; color:#fff; font-weight:700; top:auto; bottom:8px;">เหลือ ${product.stock} ชิ้น</span>` : ''}
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.name}</h3>
        <p class="product-desc" style="display: none;">${product.desc}</p>
        <div class="product-footer">
          <span class="product-price">฿${product.price}</span>
          ${isOutOfStock ? `
            <span class="badge-out-of-stock-label" style="font-size:11px; color:#ef4444; font-weight:700; background:#fee2e2; padding:3px 8px; border-radius:8px;">หมด</span>
          ` : `
            <button class="btn-action-sm btn-view-detail" data-id="${product.id}" title="ดูรายละเอียด">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          `}
        </div>
      </div>
    `;

    const imgWrapper = card.querySelector('.product-img-wrapper');
    if (imgWrapper) {
      imgWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        openProductDetail(product);
      });
    }
    card.addEventListener('click', () => openProductDetail(product));
    productsGrid.appendChild(card);
  });

  // เพิ่ม Sentinel element สำหรับ IntersectionObserver (ตรวจว่าเลื่อนถึงด้านล่างหรือยัง)
  if (visibleLimit < filtered.length) {
    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.style.cssText = 'width:100%;height:60px;display:flex;align-items:center;justify-content:center;gap:12px;color:#94a3b8;font-size:13px;grid-column:1/-1;';
    sentinel.innerHTML = `
      <div style="width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:#388BC2;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <span>โหลดสินค้าเพิ่มเติม...</span>`;
    productsGrid.appendChild(sentinel);
    observeSentinel();
  }
}

// IntersectionObserver — เร็วกว่า scroll event มาก ไม่บล็อก main thread
let _scrollObserver = null;
function observeSentinel() {
  if (_scrollObserver) _scrollObserver.disconnect();
  const sentinel = document.getElementById('scroll-sentinel');
  if (!sentinel) return;

  _scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      _scrollObserver.disconnect();
      visibleLimit += 20;
      renderProducts();
    }
  }, { rootMargin: '200px' }); // เริ่มโหลดก่อนถึงขอบ 200px

  _scrollObserver.observe(sentinel);
}

// Open Detail Modal
function openProductDetail(productOrId) {
  let product;
  if (typeof productOrId === 'object' && productOrId !== null) {
    product = productOrId;
  } else {
    product = PRODUCTS.find(p => p.id === productOrId || String(p.id) === String(productOrId));
  }
  if (!product) return;
  if (product.status && String(product.status).toLowerCase() === 'inactive') {
    alert('ขออภัยครับ สินค้านี้ปิดการขายชั่วคราว');
    return;
  }

  activeProduct = product;
  const isOutOfStock = (product.stock !== undefined && Number(product.stock) <= 0) || product.status === 'out_of_stock';
  const isLowStock = !isOutOfStock && product.stock !== undefined && Number(product.stock) > 0 && Number(product.stock) <= 5;
  const productImg = getOptimizedImageUrl(product.img);

  let stockNoticeHtml = '';
  if (isOutOfStock) {
    stockNoticeHtml = `<span class="modal-tag" style="background:#ef4444; color:#fff; font-weight:700;">❌ สินค้าหมดชั่วคราว</span>`;
  } else if (isLowStock) {
    stockNoticeHtml = `<span class="modal-tag" style="background:#f59e0b; color:#fff; font-weight:700;">⚡ เหลือเพียง ${product.stock} ชิ้น</span>`;
  }

  modalContent.innerHTML = `
    <img class="modal-img" src="${productImg}" alt="${product.name}" onerror="this.onerror=null; this.src='https://placehold.co/600x600/f3f0ec/a88b62?text=No+Image';">
    <h2 class="modal-title">${product.name}</h2>
    <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin: 4px 0 10px 0;">
      <span class="modal-tag">${product.tag || 'สินค้าคุณภาพ'}</span>
      ${stockNoticeHtml}
    </div>
    <div class="modal-footer">
      <div>
        <p class="modal-price-label">ราคา</p>
        <span class="modal-price">฿${product.price}</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; background: var(--bg-card, #f5f5f5); border-radius: 12px; padding: 4px 8px; ${isOutOfStock ? 'opacity:0.4; pointer-events:none;' : ''}">
          <button id="btnQtyMinus" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--primary, #388BC2); color: white; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">−</button>
          <span id="modalQty" style="font-size: 18px; font-weight: bold; min-width: 28px; text-align: center;">1</span>
          <button id="btnQtyPlus" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--primary, #388BC2); color: white; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">+</button>
        </div>
        <div class="modal-buttons">
          <button class="btn-outline" id="btnShareProduct" style="padding: 10px;" title="แชร์">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </button>
          <button class="btn-outline" id="btnOrderProduct">
            สอบถาม
          </button>
          ${isOutOfStock ? `
            <button class="btn-primary" id="btnAddToCart" disabled style="background:#94a3b8; cursor:not-allowed; opacity:0.8;">
              สินค้าหมด
            </button>
          ` : `
            <button class="btn-primary" id="btnAddToCart">
              🛒 ใส่ตะกร้า
            </button>
          `}
        </div>
      </div>
    </div>
  `;

  // Attach button events in Modal
  document.getElementById('btnShareProduct').addEventListener('click', (e) => {
    e.stopPropagation();
    shareProduct(product);
  });

  document.getElementById('btnOrderProduct').addEventListener('click', (e) => {
    e.stopPropagation();
    orderProduct(product);
  });

  // ควบคุมจำนวนสินค้า
  let modalQtyVal = 1;
  const modalQtyEl = document.getElementById('modalQty');
  document.getElementById('btnQtyMinus').addEventListener('click', (e) => {
    e.stopPropagation();
    if (modalQtyVal > 1) { modalQtyVal--; modalQtyEl.textContent = modalQtyVal; }
  });
  document.getElementById('btnQtyPlus').addEventListener('click', (e) => {
    e.stopPropagation();
    if (product.stock !== undefined && Number(product.stock) > 0 && modalQtyVal >= Number(product.stock)) {
      alert(`สินค้านี้มีสต็อกคงเหลือ ${product.stock} ชิ้นครับ`);
      return;
    }
    modalQtyVal++; modalQtyEl.textContent = modalQtyVal;
  });

  if (!isOutOfStock) {
    document.getElementById('btnAddToCart').addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(product, modalQtyVal);
      closeModal();
    });
  }

  // Click on the modal image to view in fullscreen lightbox
  const modalImg = modalContent.querySelector('.modal-img');
  if (modalImg) {
    modalImg.addEventListener('click', () => {
      openLightbox(productImg, product.name);
    });
  }

  modal.classList.add('show');
  lockBodyScroll();
}

// === MOBILE MODAL SCROLL LOCK & TOUCH STABILITY ===
let scrollLockCount = 0;
let prevBodyScrollY = 0;

function lockBodyScroll() {
  scrollLockCount++;
  if (scrollLockCount === 1) {
    prevBodyScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    document.body.style.top = `-${prevBodyScrollY}px`;
    document.body.classList.add('no-scroll');
  }
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.classList.remove('no-scroll');
    const top = Math.abs(parseInt(document.body.style.top || '0', 10));
    document.body.style.top = '';
    window.scrollTo(0, top || prevBodyScrollY);
  }
}

function setupSafeModalBackdrop(modalEl, closeFn) {
  if (!modalEl) return;
  let isPointerDownOnBackdrop = false;

  modalEl.addEventListener('pointerdown', (e) => {
    isPointerDownOnBackdrop = (e.target === modalEl);
  });

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl && isPointerDownOnBackdrop) {
      closeFn();
    }
    isPointerDownOnBackdrop = false;
  });

  const content = modalEl.querySelector('.modal-content');
  if (content) {
    content.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    content.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
  }
}

// Close Modal
function closeModal() {
  modal.classList.remove('show');
  unlockBodyScroll();
  activeProduct = null;
}

// Open Lightbox for Fullscreen Image View
function openLightbox(imgSrc, name) {
  if (lightboxImg && lightboxCaption && lightbox) {
    lightboxImg.src = imgSrc;
    lightboxCaption.textContent = name;
    lightbox.classList.add('show');
    lockBodyScroll();
  }
}

// Close Lightbox
function closeLightbox() {
  if (lightbox) {
    lightbox.classList.remove('show');
    unlockBodyScroll();
  }
}

// Share Product via LIFF
async function shareProduct(product) {
  if (!liff.isLoggedIn()) {
    alert('กรุณาล็อกอิน LINE เพื่อใช้งานการแชร์');
    liff.login();
    return;
  }

  // Check if ShareTargetPicker is available
  if (liff.isApiAvailable('shareTargetPicker')) {
    try {
      const result = await liff.shareTargetPicker([
        {
          type: 'flex',
          altText: `ดูสินค้าพรีเมียม: ${product.name}`,
          contents: {
            type: 'bubble',
            hero: {
              type: 'image',
              url: product.img,
              size: 'full',
              aspectRatio: '20:13',
              aspectMode: 'cover'
            },
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: product.name,
                  weight: 'bold',
                  size: 'xl'
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  margin: 'md',
                  contents: [
                    {
                      type: 'text',
                      text: `ราคา ฿${product.price}`,
                      weight: 'bold',
                      size: 'lg',
                      color: '#2972a0'
                    }
                  ]
                },
                {
                  type: 'text',
                  text: product.desc,
                  wrap: true,
                  color: '#4a5568',
                  size: 'sm',
                  margin: 'md'
                }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  color: '#388BC2',
                  action: {
                    type: 'uri',
                    label: 'ดูรายละเอียดสินค้า',
                    uri: window.location.href
                  }
                }
              ]
            }
          }
        }
      ]);
      if (result) {
        alert('แชร์ข้อมูลสินค้ากับเพื่อนสำเร็จแล้ว!');
      } else {
        console.log('Target picker was closed');
      }
    } catch (error) {
      console.error('Error sharing product:', error);
      alert('เกิดข้อผิดพลาดในการแชร์: ' + error.message);
    }
  } else {
    // Fallback: Copy Link
    navigator.clipboard.writeText(`${window.location.href}?product=${product.id}`)
      .then(() => alert('คัดลอกลิงก์สินค้าลงบอร์ดสำเร็จแล้ว!'))
      .catch(() => alert('ไม่สามารถคัดลอกลิงก์ได้'));
  }
}

// Order Product (Open LINE official account chat or send Message)
async function orderProduct(product) {
  const message = `สนใจสอบถามข้อมูลสินค้าชิ้นนี้ครับ:\n🛒 ${product.name}\n💰 ราคา: ฿${product.price}`;

  // แปลง URL รูปภาพสินค้าให้เป็น URL แบบสัมบูรณ์ (Absolute URL) สำหรับส่งทางไลน์
  let productImg = getOptimizedImageUrl(product.img);
  if (productImg.startsWith('/')) {
    productImg = window.location.origin + productImg;
  } else if (!productImg.startsWith('http')) {
    productImg = window.location.origin + '/' + productImg;
  }

  // ตรวจสอบความปลอดภัยของ URL รูปภาพ (LINE กำหนดให้ใช้ HTTPS เท่านั้น)
  const isHttpsImage = productImg.startsWith('https://');

  if (liff.isInClient()) {
    // 1. กรณี URL รูปภาพเป็น HTTPS และใช้งานได้
    if (isHttpsImage) {
      try {
        await liff.sendMessages([
          {
            type: 'image',
            originalContentUrl: productImg,
            previewImageUrl: productImg
          },
          {
            type: 'text',
            text: message
          }
        ]);
        alert('ส่งรูปภาพและคำสอบถามของคุณไปยังห้องแชทแล้ว!');
        return;
      } catch (imageError) {
        console.warn('Failed to send image+text, falling back to text only:', imageError);
      }
    }

    // 2. กรณีส่งรูปภาพล้มเหลว หรือรูปภาพไม่เป็น HTTPS (เช่น localhost) -> พยายามส่งเฉพาะข้อความ
    try {
      await liff.sendMessages([
        {
          type: 'text',
          text: message
        }
      ]);
      alert('ส่งคำสอบถามไปยังห้องแชทแล้ว!\n(หมายเหตุ: ไม่สามารถส่งรูปภาพได้เนื่องจากเงื่อนไขความปลอดภัยของระบบ LINE)');
    } catch (textError) {
      console.error('Failed to send text only:', textError);
      // 3. กรณีล้มเหลวทั้งหมด (เช่น ลืมเปิดสิทธิ์ chat_message.write ใน LINE Developers Console)
      navigator.clipboard.writeText(message);
      alert('ไม่สามารถส่งข้อความอัตโนมัติได้\n\nวิธีแก้สำหรับเจ้าของร้าน:\n1. กรุณาเข้าไปเปิดสิทธิ์ (Scope) ชื่อ "chat_message.write" ใน LINE Developers Console ของ LIFF นี้\n2. สมาชิกต้องกดกดยอมรับสิทธิ์นี้ในแอป LINE ก่อน\n\n*ระบบได้คัดลอกข้อความไว้แล้ว คุณสามารถกดวาง (Paste) ส่งได้ทันทีครับ*');
    }
  } else {
    // Web fallback
    navigator.clipboard.writeText(message);
    alert('คัดลอกข้อความสอบถามแล้ว คุณสามารถเปิดแชท LINE เพื่อวางสอบถามได้เลยครับ:\n\n' + message);
  }
}

// --- LOGIC FOR SHOPPING CART & CHECKOUT ---

function loadCart() {
  try {
    const savedCart = localStorage.getItem('kuekoonkan_cart');
    if (savedCart) {
      cart = JSON.parse(savedCart);
    }
  } catch (e) {
    console.error('Failed to load cart:', e);
  }
  updateCartBadge();
}

function saveCart() {
  try {
    localStorage.setItem('kuekoonkan_cart', JSON.stringify(cart));
  } catch (e) {
    console.error('Failed to save cart:', e);
  }
  updateCartBadge();
}

function addToCart(product, quantity = 1) {
  if (product && product.status && String(product.status).toLowerCase() === 'inactive') {
    alert('ขออภัยครับ สินค้านี้ปิดการขายชั่วคราว');
    return;
  }
  const isOutOfStock = (product.stock !== undefined && Number(product.stock) <= 0) || product.status === 'out_of_stock';
  if (isOutOfStock) {
    alert('ขออภัยครับ สินค้านี้หมดชั่วคราว ไม่สามารถสั่งซื้อได้ในขณะนี้');
    return;
  }

  const existingItem = cart.find(item => item.id === product.id);
  const currentQty = existingItem ? existingItem.qty : 0;
  if (product.stock !== undefined && Number(product.stock) > 0 && (currentQty + quantity) > Number(product.stock)) {
    alert(`ขออภัยครับ สินค้านี้มีสต็อกคงเหลือ ${product.stock} ชิ้น (ในตะกร้ามีแล้ว ${currentQty} ชิ้น)`);
    return;
  }

  if (existingItem) {
    existingItem.qty += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      qty: quantity,
      img: product.img
    });
  }
  saveCart();
  alert(`เพิ่ม "${product.name}" x${quantity} ลงในตะกร้าเรียบร้อย!`);
}

function updateCartItemQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(i => i.id !== id);
    }
    saveCart();
    renderCartItems();
  }
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  renderCartItems();
}

function clearCart() {
  cart = [];
  saveCart();
}

function updateCartBadge() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let floatingCartContainer = document.getElementById('floatingCartContainer');
  if (!floatingCartContainer) {
    floatingCartContainer = document.createElement('div');
    floatingCartContainer.id = 'floatingCartContainer';
    floatingCartContainer.onclick = openCartModal;
    document.body.appendChild(floatingCartContainer);
  }
  const qtySpan = floatingCartContainer.querySelector('#floatCartQty');
  const priceSpan = floatingCartContainer.querySelector('#floatCartPrice');

  if (qtySpan && priceSpan) {
    qtySpan.textContent = totalQty;
    priceSpan.textContent = totalPrice.toLocaleString();
  } else {
    floatingCartContainer.style.cssText = 'display: block; position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; z-index: 9999 !important; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--border-color); box-shadow: 0 -4px 20px rgba(0,0,0,0.06);';
    floatingCartContainer.innerHTML = `
      <div style="background-color: var(--primary-color); color: white; border-radius: 16px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 15px rgba(56, 139, 194, 0.3); cursor: pointer; transition: transform 0.2s ease;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="position: relative;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            <span style="position: absolute; top: -6px; right: -8px; background: #ff3b30; color: white; font-size: 11px; font-weight: bold; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid var(--primary-color);" id="floatCartQty">${totalQty}</span>
          </div>
          <span style="font-weight: 600; font-size: 15px;">ตะกร้าสินค้า</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 700; font-size: 16px;">฿<span id="floatCartPrice">${totalPrice.toLocaleString()}</span></span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </div>
      </div>
    `;
  }
  if (cartBadge) {
    cartBadge.textContent = totalQty;
    cartBadge.style.display = totalQty > 0 ? 'flex' : 'none';
  }





}

function renderCartItems() {
  const cartBody = document.getElementById('cartModalBody');
  const totalPriceEl = document.getElementById('cartTotalPrice');

  if (!cartBody) return;

  if (cart.length === 0) {
    cartBody.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 12px; display: block; opacity: 0.5;">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <p>ตะกร้าสินค้าของคุณยังว่างเปล่า</p>
      </div>
    `;
    totalPriceEl.textContent = '฿0';
    btnGoToCheckout.disabled = true;
    return;
  }

  cartBody.innerHTML = '';
  let total = 0;

  cart.forEach(item => {
    const subtotal = item.price * item.qty;
    total += subtotal;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-item-title">${item.name}</span>
        <span class="cart-item-price">฿${item.price} x ${item.qty} = ฿${subtotal}</span>
      </div>
      <div class="cart-item-controls">
        <button class="btn-qty-adjust" onclick="adjustQty('${item.id}', -1)">-</button>
        <span class="cart-item-qty">${item.qty}</span>
        <button class="btn-qty-adjust" onclick="adjustQty('${item.id}', 1)">+</button>
        <button class="btn-cart-remove" onclick="removeCartItem('${item.id}')" title="ลบรายการ">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    cartBody.appendChild(row);
  });

  totalPriceEl.textContent = `฿${total}`;
  btnGoToCheckout.disabled = false;

  // แสดงแถบสินค้าแนะนำ (Upselling / Cross-selling)
  renderUpsellSection(cartBody);
}

// Bind to window for inline HTML onclick handlers
window.adjustQty = function (id, delta) {
  updateCartItemQty(id, delta);
};

window.removeCartItem = function (id) {
  removeFromCart(id);
};

function openCartModal() {
  renderCartItems();
  cartModal.classList.add('show');
  lockBodyScroll();
}

function closeCartModal() {
  cartModal.classList.remove('show');
  unlockBodyScroll();
}

// === SAVED ADDRESSES SYSTEM ===
let selectedSavedAddressIndex = -1; // -1 = ใช้ที่อยู่ใหม่

// ฟังก์ชันดึงค่าละติจูดและลองจิจูดจากข้อความพิกัดรูปแบบต่างๆ อย่างปลอดภัย
function parseCoords(gpsString) {
  if (!gpsString) return null;
  const match = gpsString.match(/([\d.-]+)\s*,\s*([\d.-]+)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

function getSavedAddresses() {
  try {
    const data = localStorage.getItem('saved_addresses');
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function saveSavedAddresses(addresses) {
  try {
    localStorage.setItem('saved_addresses', JSON.stringify(addresses));
  } catch (e) { console.error('Error saving addresses:', e); }
}

function addSavedAddress(address) {
  const addresses = getSavedAddresses();
  // ป้องกันซ้ำ: เช็คว่ามีที่อยู่เดียวกันอยู่แล้วหรือไม่
  const isDuplicate = addresses.some(a =>
    a.gpsLocation === address.gpsLocation && a.addressDetails === address.addressDetails
  );
  if (!isDuplicate) {
    addresses.unshift(address); // เพิ่มล่าสุดไว้ด้านบน
    if (addresses.length > 3) addresses.length = 3; // เก็บสูงสุด 3 ที่อยู่
    saveSavedAddresses(addresses);
  }
}

function deleteSavedAddress(index) {
  const addresses = getSavedAddresses();
  addresses.splice(index, 1);
  saveSavedAddresses(addresses);
}



function getAddressIcon(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('บ้าน') || l.includes('home')) return '🏠';
  if (l.includes('ทำงาน') || l.includes('ออฟฟิศ') || l.includes('work') || l.includes('office')) return '🏢';
  if (l.includes('คอนโด') || l.includes('condo') || l.includes('หอ')) return '🏬';
  return '📍';
}

function renderSavedAddresses() {
  const addresses = getSavedAddresses();
  const section = document.getElementById('savedAddressesSection');
  const listEl = document.getElementById('savedAddressList');
  const newAddressSection = document.getElementById('newAddressSection');

  if (addresses.length === 0) {
    section.style.display = 'none';
    newAddressSection.style.display = 'block';
    return;
  }

  section.style.display = 'block';
  listEl.innerHTML = '';

  addresses.forEach((addr, idx) => {
    const card = document.createElement('div');
    card.className = 'saved-address-card' + (selectedSavedAddressIndex === idx ? ' selected' : '');

    // ดึงพิกัดจาก GPS URL และคำนวณระยะทางจากร้าน
    let coordsText = '';
    let distBadgeText = '';
    if (addr.gpsLocation) {
      const coords = parseCoords(addr.gpsLocation);
      if (coords) {
        coordsText = `📍 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
        const rawDist = calculateHaversineDistance(STORE_LOCATION.lat, STORE_LOCATION.lng, coords.lat, coords.lng);
        const distKm = rawDist < 0.1 ? 0.1 : Math.round(rawDist * 10) / 10;
        distBadgeText = `🛵 ห่างจากร้าน ~${distKm} กม.`;
      }
    }

    card.innerHTML = `
      <div class="address-label">
        <span class="address-icon">${getAddressIcon(addr.label)}</span>
        ${addr.label || 'ที่อยู่ #' + (idx + 1)}
      </div>
      <div class="address-detail">${addr.addressDetails || '-'}</div>
      ${distBadgeText ? `<div class="address-gps" style="color: #166534; font-weight: 600;">${distBadgeText}</div>` : (coordsText ? `<div class="address-gps">${coordsText}</div>` : '')}
      <button class="btn-delete-address" data-idx="${idx}" title="ลบที่อยู่นี้">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="address-check">✓</div>
    `;

    // คลิกเลือกที่อยู่
    card.addEventListener('click', (e) => {
      console.log(`[SavedAddress] Card clicked. Index: ${idx}`, addr);
      if (e.target.closest('.btn-delete-address')) {
        console.log(`[SavedAddress] Click was on delete button, ignoring selection.`);
        return;
      }
      selectSavedAddress(idx);
    });

    // ปุ่มลบ
    const deleteBtn = card.querySelector('.btn-delete-address');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (!confirm('คุณต้องการลบที่อยู่นี้ใช่หรือไม่?')) {
          return; // ถ้ายกเลิก ไม่ต้องทำอะไรต่อ
        }

        console.log(`[SavedAddress] Delete clicked for index: ${idx}`);
        deleteSavedAddress(idx);
        if (selectedSavedAddressIndex === idx) {
          selectedSavedAddressIndex = -1;
          newAddressSection.style.display = 'block';
        } else if (selectedSavedAddressIndex > idx) {
          selectedSavedAddressIndex--;
        }
        renderSavedAddresses();
        validateCheckoutForm();
      });
    }

    listEl.appendChild(card);
  });

  // ถ้ายังไม่ได้เลือกที่อยู่เก่า → แสดงฟอร์มที่อยู่ใหม่
  if (selectedSavedAddressIndex === -1) {
    newAddressSection.style.display = 'block';
  } else {
    newAddressSection.style.display = 'none';
  }
}

function selectSavedAddress(idx) {
  console.log(`[SavedAddress] selectSavedAddress starting for index: ${idx}`);
  try {
    const addresses = getSavedAddresses();
    const addr = addresses[idx];
    if (!addr) {
      console.warn(`[SavedAddress] Address at index ${idx} not found!`);
      return;
    }

    selectedSavedAddressIndex = idx;
    console.log(`[SavedAddress] Set selectedSavedAddressIndex to: ${selectedSavedAddressIndex}`);

    // เติมข้อมูลจากที่อยู่ที่เลือก
    const gpsLinkEl = document.getElementById('gpsLocationLink');
    const addrDetailsEl = document.getElementById('checkoutAddressDetails');

    if (gpsLinkEl) gpsLinkEl.value = addr.gpsLocation || '';
    if (addrDetailsEl) addrDetailsEl.value = addr.addressDetails || '';

    // คำนวณระยะทางจัดส่งจากร้านสำหรับที่อยู่ที่เลือก
    if (addr.gpsLocation) {
      const coords = parseCoords(addr.gpsLocation);
      if (coords) {
        const rawDistance = calculateHaversineDistance(STORE_LOCATION.lat, STORE_LOCATION.lng, coords.lat, coords.lng);
        const calcDistance = rawDistance < 0.1 ? 0.1 : Math.round(rawDistance * 10) / 10;
        const distInput = document.getElementById('deliveryDistance');
        if (distInput) distInput.value = calcDistance;
        const distText = document.getElementById('deliveryDistanceText');
        if (distText) distText.textContent = `${calcDistance} กม.`;
      }
    }

    const statusBadge = document.getElementById('locationStatus');
    if (statusBadge) {
      const coords = parseCoords(addr.gpsLocation);
      if (coords) {
        statusBadge.textContent = `📍 ใช้ที่อยู่: ${addr.label || 'ที่อยู่เดิม'} (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`;
        statusBadge.className = 'location-status-badge success';
        console.log(`[SavedAddress] Valid coords parsed: ${coords.lat}, ${coords.lng}. Updating map...`);
        updateMapPin(coords.lat, coords.lng, true);
      } else {
        statusBadge.textContent = `📍 ใช้ที่อยู่: ${addr.label || 'ที่อยู่เดิม'} (ไม่มีพิกัดแผนที่)`;
        statusBadge.className = 'location-status-badge success';
        console.log(`[SavedAddress] No valid coords found for address. Clearing pin.`);
        if (mapMarker && mapInstance) {
          mapInstance.removeLayer(mapMarker);
          mapMarker = null;
        }
        const instructionOverlay = document.getElementById('mapInstructionOverlay');
        if (instructionOverlay) instructionOverlay.classList.remove('hidden');
      }
    }

    // ซ่อนฟอร์มที่อยู่ใหม่
    const newAddressSection = document.getElementById('newAddressSection');
    if (newAddressSection) {
      newAddressSection.style.display = 'none';
    }

    console.log(`[SavedAddress] Updating DOM selection for index: ${selectedSavedAddressIndex}`);
    // Update DOM classes instead of re-rendering everything to improve speed
    const listEl = document.getElementById('savedAddressList');
    if (listEl) {
      const cards = listEl.querySelectorAll('.saved-address-card');
      cards.forEach((card, i) => {
        if (i === selectedSavedAddressIndex) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      });
    }
    validateCheckoutForm();
  } catch (err) {
    console.error("[SavedAddress] Critical error inside selectSavedAddress:", err);
  }
}

// ปุ่ม "เพิ่มที่อยู่ใหม่"
document.getElementById('btnUseNewAddress')?.addEventListener('click', () => {
  selectedSavedAddressIndex = -1;

  // รีเซ็ตฟอร์ม
  document.getElementById('gpsLocationLink').value = '';
  document.getElementById('checkoutAddressDetails').value = '';
  document.getElementById('addressLabel').value = '';
  document.getElementById('locationStatus').textContent = 'ยังไม่ได้ปักหมุดตำแหน่งที่ตั้ง';
  document.getElementById('locationStatus').className = 'location-status-badge';

  const distInput = document.getElementById('deliveryDistance');
  if (distInput) distInput.value = 0;
  const distText = document.getElementById('deliveryDistanceText');
  if (distText) distText.textContent = '0 กม.';
  calculateCheckoutTotal();

  // Reset map marker
  if (mapMarker && mapInstance) {
    mapInstance.removeLayer(mapMarker);
    mapMarker = null;
  }
  const instructionOverlay = document.getElementById('mapInstructionOverlay');
  if (instructionOverlay) instructionOverlay.classList.remove('hidden');

  // แสดงฟอร์มที่อยู่ใหม่
  document.getElementById('newAddressSection').style.display = 'block';

  renderSavedAddresses();
  validateCheckoutForm();

  // Init map
  setTimeout(() => { initMapPicker(); }, 450);
});

// ปุ่ม "บันทึกที่อยู่นี้ทันที"
const btnSaveAddressNow = document.getElementById('btnSaveAddressNow');
if (btnSaveAddressNow) {
  btnSaveAddressNow.addEventListener('click', () => {
    const addressDetails = document.getElementById('checkoutAddressDetails').value.trim();
    const addressLabel = document.getElementById('addressLabel').value.trim();
    const gpsLocation = document.getElementById('gpsLocationLink').value.trim();

    if (!addressDetails || !addressLabel) {
      alert('⚠️ กรุณากรอกรายละเอียดที่อยู่ และตั้งชื่อที่อยู่ก่อนกดบันทึกครับ');
      return;
    }

    btnSaveAddressNow.disabled = true;
    const originalHTML = btnSaveAddressNow.innerHTML;
    btnSaveAddressNow.innerHTML = '⏳ กำลังบันทึก...';

    addSavedAddress({
      label: addressLabel,
      gpsLocation: gpsLocation,
      addressDetails: addressDetails
    });

    renderSavedAddresses();
    selectSavedAddress(0); // เลือกที่อยู่ที่เพิ่งบันทึกทันที

    btnSaveAddressNow.innerHTML = '✅ บันทึกสำเร็จ!';
    setTimeout(() => {
      btnSaveAddressNow.innerHTML = originalHTML;
      btnSaveAddressNow.disabled = false;
    }, 1500);
  });
}

// ตั้งค่าระยะทางจัดส่งตามปุ่ม preset
function setDeliveryDistance(km) {
  const input = document.getElementById('deliveryDistance');
  if (input) {
    input.value = km;
    calculateCheckoutTotal();
  }
}

// ควบคุมการแสดงผลฟิลด์ตามช่องทางการรับสินค้า
function toggleShippingFields() {
  const shippingOption = document.querySelector('input[name="shippingOption"]:checked')?.value || 'จัดส่ง';
  const savedSection = document.getElementById('savedAddressesSection');
  const newSection = document.getElementById('newAddressSection');
  const distanceSection = document.getElementById('deliveryDistanceSection');
  const conditionsBox = document.getElementById('shippingConditionsBox');

  // ควบคุมช่องทางชำระเงิน
  if (shippingOption === 'รับหน้าร้าน') {
    document.querySelectorAll('.payment-option-delivery').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.payment-option-store').forEach(el => el.style.display = 'flex');
    const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked');
    if (selectedPayment && selectedPayment.value !== 'โอนจ่าย' && selectedPayment.value !== 'จ่ายเงินหน้าร้าน') {
      document.querySelector('input[name="paymentMethod"][value="โอนจ่าย"]').checked = true;
    }
  } else {
    document.querySelectorAll('.payment-option-delivery').forEach(el => el.style.display = 'flex');
    document.querySelectorAll('.payment-option-store').forEach(el => el.style.display = 'none');
    const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked');
    if (selectedPayment && selectedPayment.value === 'จ่ายเงินหน้าร้าน') {
      document.querySelector('input[name="paymentMethod"][value="โอนจ่าย"]').checked = true;
    }
  }

  if (shippingOption === 'รับหน้าร้าน') {
    if (savedSection) savedSection.style.display = 'none';
    if (newSection) newSection.style.display = 'none';
    if (distanceSection) distanceSection.style.display = 'none';

    if (conditionsBox) {
      conditionsBox.innerHTML = `
        <div style="font-size: 14px; font-weight: bold; color: #16a34a; display: flex; align-items: center; gap: 6px;">
          <span>🏪 มารับสินค้าเองที่หน้าร้าน : <strong style="font-size: 15px; color: #2563eb;">ฟรีค่าจัดส่ง ฿0</strong></span>
        </div>
      `;
    }
  } else {
    if (distanceSection) distanceSection.style.display = 'block';
    const savedAddresses = getSavedAddresses();
    if (savedAddresses.length > 0 && typeof selectedSavedAddressIndex !== 'undefined' && selectedSavedAddressIndex !== -1) {
      if (savedSection) savedSection.style.display = 'block';
      if (newSection) newSection.style.display = 'none';
    } else {
      if (savedSection) savedSection.style.display = savedAddresses.length > 0 ? 'block' : 'none';
      if (newSection) newSection.style.display = 'block';
    }

    if (conditionsBox) {
      conditionsBox.innerHTML = `
        <div style="font-size: 13.5px; font-weight: bold; color: var(--primary, #2563eb); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span>📋 เงื่อนไขค่าจัดส่งสินค้า:</span>
        </div>
        <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-color, #334155); line-height: 1.6;">
          <li>ยอดไม่ถึง ฿500 : คำนวณตามระยะทาง (กิโลเมตรละ 10 บาท)</li>
          <li>ยอดเกิน ฿500 : <strong style="color: #16a34a;">ส่งฟรี 5 กิโลเมตรแรก</strong> (ส่วนเกิน กม. ละ 10 บาท)</li>
          <li>ยอดเกิน ฿1,000 : <strong style="color: #16a34a;">ส่งฟรี 10 กิโลเมตรแรก</strong> (ส่วนเกิน กม. ละ 10 บาท)</li>
          <li>รับเองที่หน้าร้าน : <strong style="color: #2563eb;">ฟรีค่าจัดส่ง ฿0</strong></li>
        </ul>
      `;
    }
  }
  calculateCheckoutTotal();
  validateCheckoutForm();
}

// คำนวณค่าจัดส่งและยอดสุทธิทั้งหมด
function calculateCheckoutTotal() {
  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0);
  const shippingOption = document.querySelector('input[name="shippingOption"]:checked')?.value || 'จัดส่ง';

  let shippingFee = 0;
  let discountNote = '';
  let distKm = 0;

  const distanceInput = document.getElementById('deliveryDistance');
  if (distanceInput) {
    distKm = parseFloat(distanceInput.value) || 0;
    if (distKm < 0) distKm = 0;
  }

  const distanceLabel = document.getElementById('checkoutDistanceLabel');
  if (distanceLabel) {
    distanceLabel.textContent = `${distKm} กม.`;
  }
  const distanceText = document.getElementById('deliveryDistanceText');
  if (distanceText) {
    distanceText.textContent = `${distKm} กม.`;
  }

  if (shippingOption === 'รับหน้าร้าน') {
    shippingFee = 0;
    discountNote = '🏪 รับสินค้าเองที่หน้าร้าน (ฟรีค่าจัดส่ง ฿0)';
  } else {
    if (subtotal >= 1000) {
      if (distKm <= 10) {
        shippingFee = 0;
        discountNote = '🎉 ยอดซื้อครบ ฿1,000 ฟรีค่าจัดส่ง 10 กิโลเมตรแรก!';
      } else {
        const extraKm = distKm - 10;
        shippingFee = Math.ceil(extraKm * 10);
        discountNote = `🎉 ยอดเกิน ฿1,000 ฟรี 10 กม. แรก (ส่วนเกิน ${extraKm.toFixed(1)} กม. × 10 บาท = ฿${shippingFee})`;
      }
    } else if (subtotal >= 500) {
      if (distKm <= 5) {
        shippingFee = 0;
        discountNote = '🎉 ยอดซื้อครบ ฿500 ฟรีค่าจัดส่ง 5 กิโลเมตรแรก!';
      } else {
        const extraKm = distKm - 5;
        shippingFee = Math.ceil(extraKm * 10);
        discountNote = `🎉 ยอดเกิน ฿500 ฟรี 5 กม. แรก (ส่วนเกิน ${extraKm.toFixed(1)} กม. × 10 บาท = ฿${shippingFee})`;
      }
    } else {
      shippingFee = Math.ceil(distKm * 10);
      discountNote = `💡 ยอดไม่ถึง ฿500 คิดค่าจัดส่งตามระยะทาง (${distKm.toFixed(1)} กม. × 10 บาท = ฿${shippingFee})`;
    }
  }

  // คำนวณส่วนลดจากคูปอง (ถ้ามี)
  let discountAmount = 0;
  let couponLabel = '';

  if (appliedCoupon) {
    if (appliedCoupon.type === 'shipping') {
      discountAmount = shippingFee;
      shippingFee = 0;
      couponLabel = `${appliedCoupon.code} (ส่งฟรี)`;
    } else if (appliedCoupon.type === 'percent') {
      discountAmount = Math.round(subtotal * (appliedCoupon.percent / 100));
      couponLabel = `${appliedCoupon.code} (-${appliedCoupon.percent}%)`;
    } else if (appliedCoupon.type === 'fixed') {
      discountAmount = Math.min(subtotal, appliedCoupon.amount);
      couponLabel = `${appliedCoupon.code} (-฿${appliedCoupon.amount})`;
    }
  }

  const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);

  // อัปเดตแถวคูปองใน Banner
  const couponRow = document.getElementById('checkoutCouponRow');
  const couponCodeLabel = document.getElementById('checkoutCouponCodeLabel');
  const couponDiscountText = document.getElementById('checkoutCouponDiscountText');
  if (couponRow) {
    if (appliedCoupon && discountAmount > 0) {
      couponRow.style.display = 'flex';
      if (couponCodeLabel) couponCodeLabel.textContent = couponLabel;
      if (couponDiscountText) couponDiscountText.textContent = `-฿${discountAmount.toLocaleString()}`;
    } else {
      couponRow.style.display = 'none';
    }
  }

  const subtotalEl = document.getElementById('checkoutSubtotalText');
  if (subtotalEl) subtotalEl.textContent = `฿${subtotal.toLocaleString()}`;

  const feeEl = document.getElementById('checkoutShippingFeeText');
  if (feeEl) {
    if (shippingFee === 0) {
      feeEl.innerHTML = '<span style="color: #4ade80;">ฟรี ฿0</span>';
    } else {
      feeEl.textContent = `฿${shippingFee.toLocaleString()}`;
    }
  }

  const discountEl = document.getElementById('checkoutDiscountNote');
  if (discountEl) discountEl.textContent = discountNote;

  const checkoutItemsList = document.getElementById('checkoutItemsList');
  if (checkoutItemsList) {
    if (cart.length === 0) {
      checkoutItemsList.innerHTML = '<div style="font-size: 14px; color: #94a3b8; text-align: center;">ไม่มีสินค้าในตะกร้า</div>';
    } else {
      checkoutItemsList.innerHTML = '';
      cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        checkoutItemsList.innerHTML += `
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
            <div style="color: #e2e8f0; flex: 1;">
              <span style="font-weight: 500;">${item.name}</span>
              <span style="color: #94a3b8; font-size: 13px; margin-left: 6px;">x${item.qty}</span>
            </div>
            <div style="color: #ffffff; font-weight: 500;">฿${itemTotal.toLocaleString()}</div>
          </div>
        `;
      });
    }
  }

  const btnSubmitPrice = document.getElementById('btnSubmitPrice');
  if (btnSubmitPrice) btnSubmitPrice.textContent = `฿${grandTotal.toLocaleString()}`;
  const totalEl = document.getElementById('checkoutTotalText');
  if (totalEl) totalEl.textContent = `฿${grandTotal.toLocaleString()}`;

  return {
    subtotal: subtotal,
    shippingFee: shippingFee,
    discountAmount: discountAmount,
    couponCode: appliedCoupon ? appliedCoupon.code : '',
    grandTotal: grandTotal,
    distanceKm: distKm
  };
}

function openCheckoutModal() {
  const checkoutModal = document.getElementById('checkoutModal');
  renderQuickCouponChips();
  syncActivePromoCodes();
  calculateCheckoutTotal();

  // Prefill default info from member profile (กรองเบอร์ปลอม เช่น 001 ทิ้ง)
  document.getElementById('checkoutName').value = currentMemberInfo.displayName || '';
  const initialCheckoutPhone = currentMemberInfo.phone && isValidThaiPhone(currentMemberInfo.phone) ? formatThaiPhoneNumber(currentMemberInfo.phone) : '';
  document.getElementById('checkoutPhone').value = initialCheckoutPhone;

  // รีเซ็ตตัวเลือกช่องทางการรับสินค้า
  const defaultShippingOption = document.querySelector('input[name="shippingOption"][value="จัดส่ง"]');
  if (defaultShippingOption) defaultShippingOption.checked = true;

  // รีเซ็ตการสั่งล่วงหน้า
  const defaultDeliveryType = document.querySelector('input[name="deliveryType"][value="ทันที"]');
  if (defaultDeliveryType) defaultDeliveryType.checked = true;
  const preorderTimeSection = document.getElementById('preorderTimeSection');
  if (preorderTimeSection) preorderTimeSection.style.display = 'none';
  const preorderTimeSelect = document.getElementById('preorderTime');
  if (preorderTimeSelect) preorderTimeSelect.value = '';
  const preorderDateInput = document.getElementById('preorderDate');
  if (preorderDateInput) {
    const localDate = new Date();
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    preorderDateInput.value = `${year}-${month}-${day}`;
  }

  // Reset address label
  const addressLabelInput = document.getElementById('addressLabel');
  if (addressLabelInput) addressLabelInput.value = '';

  // Reset map marker
  if (mapMarker && mapInstance) {
    mapInstance.removeLayer(mapMarker);
    mapMarker = null;
  }
  const instructionOverlay = document.getElementById('mapInstructionOverlay');
  if (instructionOverlay) instructionOverlay.classList.remove('hidden');

  // โหลดที่อยู่ที่บันทึกไว้
  const savedAddresses = getSavedAddresses();
  renderSavedAddresses(); // Render always so it shows up in the DOM

  if (savedAddresses.length > 0) {
    selectedSavedAddressIndex = 0; // Default to first saved address
    setTimeout(() => { selectSavedAddress(0); }, 50);
  } else {
    selectedSavedAddressIndex = -1;
    // หากไม่มีที่อยู่เซฟใน LocalStorage ให้ลองดึงจาก member profile ในฐานข้อมูล D1
    if (currentMemberInfo.gpsLocation) {
      document.getElementById('gpsLocationLink').value = currentMemberInfo.gpsLocation;
      document.getElementById('checkoutAddressDetails').value = currentMemberInfo.addressDetails || '';
      const addressLabelInput = document.getElementById('addressLabel');
      if (addressLabelInput) addressLabelInput.value = currentMemberInfo.addressLabel || '';

      const gpsLocation = currentMemberInfo.gpsLocation;
      const coords = parseCoords(gpsLocation);
      if (coords) {
        document.getElementById('locationStatus').textContent = `📍 ใช้ที่อยู่จากโปรไฟล์ (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`;
        document.getElementById('locationStatus').className = 'location-status-badge success';
        // เติมพิกัดลงแผนที่หลังจากแผนที่โหลดเสร็จ
        setTimeout(() => {
          updateMapPin(coords.lat, coords.lng, true);
        }, 500);
      } else {
        document.getElementById('locationStatus').textContent = `📍 ใช้ที่อยู่จากโปรไฟล์ (ไม่มีพิกัดแผนที่)`;
        document.getElementById('locationStatus').className = 'location-status-badge success';
      }
    } else {
      document.getElementById('gpsLocationLink').value = '';
      document.getElementById('locationStatus').textContent = 'ยังไม่ได้ปักหมุดตำแหน่งที่ตั้ง';
      document.getElementById('locationStatus').className = 'location-status-badge';
      document.getElementById('checkoutAddressDetails').value = '';
      const addressLabelInput = document.getElementById('addressLabel');
      if (addressLabelInput) addressLabelInput.value = '';
    }
  }

  toggleShippingFields();
  checkoutModal.classList.add('show');
  lockBodyScroll();

  // สร้าง/รีเฟรช Map Picker หลังจาก modal แสดงเสร็จ
  setTimeout(() => {
    initMapPicker();
  }, 450);
}

function closeCheckoutModal() {
  const checkoutModal = document.getElementById('checkoutModal');
  if (checkoutModal) checkoutModal.classList.remove('show');
  unlockBodyScroll();
}

function validateCheckoutForm() {
  const name = document.getElementById('checkoutName')?.value.trim() || '';
  const rawPhone = document.getElementById('checkoutPhone')?.value.trim() || '';
  const cleanPhone = cleanPhoneNumber(rawPhone);
  const isPhoneValid = isValidThaiPhone(cleanPhone);
  const phoneInputEl = document.getElementById('checkoutPhone');
  const phoneErrorEl = document.getElementById('checkoutPhoneError');
  const btnSubmitOrder = document.getElementById('btnSubmitOrder');

  // ตรวจสอบและแสดงแจ้งเตือนสถานะเบอร์โทร
  if (phoneInputEl) {
    if (cleanPhone.length > 0 && !isPhoneValid) {
      phoneInputEl.style.borderColor = '#ef4444';
      if (phoneErrorEl) {
        phoneErrorEl.style.display = 'block';
        phoneErrorEl.textContent = '* กรุณาระบุเบอร์โทรศัพท์ 10 หลักที่ถูกต้อง (ขึ้นต้นด้วย 0 เช่น 08X-XXX-XXXX)';
      }
    } else {
      phoneInputEl.style.borderColor = '';
      if (phoneErrorEl) phoneErrorEl.style.display = 'none';
    }
  }

  // ตรวจสอบการสั่งล่วงหน้า
  const deliveryType = document.querySelector('input[name="deliveryType"]:checked')?.value || 'ทันที';
  let isPreorderValid = true;
  if (deliveryType === 'ล่วงหน้า') {
    const preorderDate = document.getElementById('preorderDate')?.value || '';
    const preorderTime = document.getElementById('preorderTime')?.value || '';
    isPreorderValid = preorderDate !== "" && preorderTime !== null && preorderTime !== "";
  }

  // ตรวจสอบข้อมูลจัดส่งกรณีเลือก "จัดส่งตามที่อยู่"
  const shippingOption = document.querySelector('input[name="shippingOption"]:checked')?.value || 'จัดส่ง';
  let isShippingValid = true;
  if (shippingOption === 'จัดส่ง') {
    const addressDetails = document.getElementById('checkoutAddressDetails')?.value.trim() || '';
    const addressLabel = document.getElementById('addressLabel')?.value.trim() || '';

    if (typeof selectedSavedAddressIndex !== 'undefined' && selectedSavedAddressIndex !== -1) {
      isShippingValid = addressDetails !== "";
    } else {
      // บังคับกรอกทั้ง รายละเอียดที่อยู่ และ ตั้งชื่อที่อยู่
      isShippingValid = addressDetails !== "" && addressLabel !== "";
    }
  }

  // Valid if Name, Valid Phone, Shipping details, and Preorder (if any) are valid
  const isValid = name !== "" && isPhoneValid && isPreorderValid && isShippingValid;
  if (btnSubmitOrder) {
    btnSubmitOrder.removeAttribute('disabled');
    if (!isValid) {
      btnSubmitOrder.classList.add('btn-gray-disabled');
    } else {
      btnSubmitOrder.classList.remove('btn-gray-disabled');
    }
  }
}

async function fetchMemberInfo(userId) {
  // 1. โหลดจาก Cache ก่อนทันที (0ms) เพื่อ prefill ฟอร์มโดยไม่รอ server
  try {
    const cached = localStorage.getItem('member_info_cache');
    if (cached) {
      const cachedInfo = JSON.parse(cached);
      if (cachedInfo && cachedInfo.userId === userId) {
        currentMemberInfo = {
          displayName: cachedInfo.displayName || '',
          phone: cachedInfo.phone || '',
          gpsLocation: cachedInfo.gpsLocation || '',
          addressDetails: cachedInfo.addressDetails || '',
          addressLabel: cachedInfo.addressLabel || ''
        };
        const nameInput = document.getElementById('checkoutName');
        const phoneInput = document.getElementById('checkoutPhone');
        if (nameInput && !nameInput.value) nameInput.value = currentMemberInfo.displayName;
        if (phoneInput && !phoneInput.value && isValidThaiPhone(currentMemberInfo.phone)) {
          phoneInput.value = formatThaiPhoneNumber(currentMemberInfo.phone);
        }
      }
    }
  } catch (e) { }

  // 2. ดึงข้อมูลจริงจาก Server เบื้องหลัง แล้วอัปเดต cache
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?userId=${userId}&_t=${Date.now()}`);
    const data = await res.json();
    if (data.status === 'success' && data.found) {
      currentMemberInfo = {
        displayName: data.displayName || '',
        phone: data.phone || '',
        gpsLocation: data.gpsLocation || '',
        addressDetails: data.addressDetails || '',
        addressLabel: data.addressLabel || ''
      };

      // ซิงค์ saved addresses จากฐานข้อมูล D1 ลง LocalStorage เพื่อให้ลูกค้ามีที่อยู่ใช้บนทุกอุปกรณ์
      if (data.savedAddresses) {
        try {
          const remoteSaved = JSON.parse(data.savedAddresses);
          if (Array.isArray(remoteSaved)) {
            const localSaved = getSavedAddresses();
            const merged = [...localSaved];
            remoteSaved.forEach(remoteAddr => {
              const isDuplicate = merged.some(localAddr =>
                localAddr.gpsLocation === remoteAddr.gpsLocation &&
                localAddr.addressDetails === remoteAddr.addressDetails
              );
              if (!isDuplicate) {
                merged.push(remoteAddr);
              }
            });
            if (merged.length > 3) {
              merged.splice(3);
            }
            localStorage.setItem('saved_addresses', JSON.stringify(merged));
          }
        } catch (err) {
          console.error("Error parsing remote saved addresses:", err);
        }
      }

      // บันทึก cache ใหม่
      localStorage.setItem('member_info_cache', JSON.stringify({
        userId,
        displayName: currentMemberInfo.displayName,
        phone: currentMemberInfo.phone,
        gpsLocation: currentMemberInfo.gpsLocation,
        addressDetails: currentMemberInfo.addressDetails,
        addressLabel: currentMemberInfo.addressLabel
      }));

      // อัปเดต form fields
      const nameInput = document.getElementById('checkoutName');
      const phoneInput = document.getElementById('checkoutPhone');
      if (nameInput) nameInput.value = currentMemberInfo.displayName;
      if (phoneInput && isValidThaiPhone(currentMemberInfo.phone)) {
        phoneInput.value = formatThaiPhoneNumber(currentMemberInfo.phone);
      }
      validateCheckoutForm();
    }
  } catch (e) {
    console.error('Error fetching member info:', e);
  }
}

async function sendOrderFlexMessage(orderId, name, phone, totalPrice, cartItems = [], deliveryType = 'ทันที', preorderTime = '', shippingOption = 'จัดส่ง', subtotal = 0, shippingFee = 0, paymentMethod = '', discountAmount = 0, couponCode = '') {
  const calcSubtotal = subtotal || cartItems.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.qty || 1)), 0);
  const calcShippingFee = shippingOption === 'รับหน้าร้าน' ? 0 : (shippingFee || Math.max(0, totalPrice - calcSubtotal));

  // สร้างรายการสินค้าสำหรับ Flex Message (พร้อมรูป และรายละเอียด)
  const itemBoxes = cartItems.map(item => {
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.qty || 1);
    const itemTotal = itemPrice * itemQty;
    return {
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
              text: String(item.name || 'สินค้า'),
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
                  text: `x${itemQty}  •  ฿${itemPrice.toLocaleString()}`,
                  size: "xs",
                  color: "#64748b",
                  flex: 3
                },
                {
                  type: "text",
                  text: `฿${itemTotal.toLocaleString()}`,
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
    };
  });

  const flexPayload = {
    type: "flex",
    altText: `🛒 คำสั่งซื้อใหม่ ${orderId}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#10b981",
        paddingAll: "16px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "🛒 คำสั่งซื้อใหม่",
                weight: "bold",
                size: "xl",
                color: "#ffffff",
                flex: 4
              },
              {
                type: "text",
                text: "รอตรวจสอบ",
                size: "xs",
                color: "#ffffff",
                weight: "bold",
                align: "end",
                flex: 2
              }
            ]
          },
          {
            type: "text",
            text: `เลขที่: ${orderId}`,
            size: "xs",
            color: "#d1fae5",
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
                  { type: "text", text: "👤 ผู้รับ", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: String(name || '-'), size: "xs", color: "#0f172a", weight: "bold", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "📞 เบอร์ติดต่อ", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: String(phone || '-'), size: "xs", color: "#0f172a", weight: "bold", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "🚚 การรับสินค้า", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: shippingOption === 'รับหน้าร้าน' ? "🏪 รับสินค้าเองที่หน้าร้าน" : "🚚 จัดส่งตามที่อยู่", size: "xs", color: "#059669", weight: "bold", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "🕒 เวลาจัดส่ง/รับ", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: deliveryType === 'ล่วงหน้า' ? `🕒 สั่งล่วงหน้า (${preorderTime} น.)` : "🚀 ส่งทันที (ด่วนที่สุด)", size: "xs", color: "#dc2626", weight: "bold", flex: 4, wrap: true }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "💳 ชำระเงินโดย :", size: "xs", color: "#64748b", flex: 2 },
                  { type: "text", text: paymentMethod || "-", size: "xs", color: "#0f172a", weight: "bold", flex: 4, wrap: true }
                ]
              }
            ]
          },
          { type: "separator", margin: "md" },
          {
            type: "text",
            text: "📦 รายการสินค้าที่สั่งซื้อ",
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
              { type: "text", text: "รวมค่าสินค้า", size: "sm", color: "#64748b", flex: 3 },
              { type: "text", text: `฿${calcSubtotal.toLocaleString()}`, size: "sm", color: "#0f172a", align: "end", flex: 3 }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ค่าจัดส่ง", size: "sm", color: "#64748b", flex: 3 },
              { type: "text", text: calcShippingFee > 0 ? `฿${calcShippingFee.toLocaleString()}` : "ฟรี (฿0)", size: "sm", color: calcShippingFee > 0 ? "#0f172a" : "#16a34a", weight: "bold", align: "end", flex: 3 }
            ]
          },
          ...(discountAmount > 0 ? [{
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: `🎟️ ส่วนลดคูปอง (${couponCode})`, size: "sm", color: "#e11d48", flex: 4 },
              { type: "text", text: `-฿${discountAmount.toLocaleString()}`, size: "sm", color: "#e11d48", weight: "bold", align: "end", flex: 2 }
            ]
          }] : []),
          { type: "separator", margin: "sm" },
          {
            type: "box",
            layout: "horizontal",
            margin: "md",
            contents: [
              { type: "text", text: "ยอดเงินรวมสุทธิ", size: "md", color: "#0f172a", weight: "bold", flex: 3 },
              { type: "text", text: `฿${totalPrice.toLocaleString()}`, size: "xl", color: "#10b981", weight: "bold", align: "end", flex: 3 }
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
            text: "✨ ทางร้านกำลังตรวจสอบรายการออเดอร์ กรุณารอสักครู่ครับ 🙏",
            size: "xs",
            color: "#64748b",
            wrap: true,
            align: "center"
          }
        ]
      }
    }
  };

  try {
    await liff.sendMessages([flexPayload]);
  } catch (err) {
    console.error("Error sending order Flex Message:", err);
    let itemsText = cartItems.map(item => {
      const p = Number(item.price || 0);
      const q = Number(item.qty || 1);
      return `• ${item.name}\n  จำนวน: ${q} ชิ้น (฿${(p * q).toLocaleString()})`;
    }).join('\n');

    const formattedText =
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🛒  คำสั่งซื้อใหม่ (รอตรวจสอบ)\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🧾 รหัสออเดอร์: ${orderId}\n` +
      `👤 ผู้รับ: ${name}\n` +
      `📞 เบอร์ติดต่อ: ${phone}\n` +
      `🚚 การรับสินค้า: ${shippingOption === 'รับหน้าร้าน' ? '🏪 รับสินค้าเองที่หน้าร้าน' : '🚚 จัดส่งตามที่อยู่'}\n` +
      `🕒 เวลา: ${deliveryType === 'ล่วงหน้า' ? `สั่งล่วงหน้า (${preorderTime} น.)` : '🚀 ส่งทันที'}\n\n` +
      `📦 รายการสินค้า:\n` +
      `-----------------------------------\n` +
      `${itemsText}\n` +
      `-----------------------------------\n` +
      `💵 รวมค่าสินค้า: ฿${calcSubtotal.toLocaleString()}\n` +
      `🚚 ค่าจัดส่ง: ${calcShippingFee > 0 ? '฿' + calcShippingFee.toLocaleString() : 'ฟรี (฿0)'}\n` +
      `💰 ยอดเงินรวมสุทธิ: ฿${totalPrice.toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━━━━━`;

    try {
      await liff.sendMessages([{
        type: 'text',
        text: formattedText
      }]);
    } catch (err2) {
      console.error("Fallback text message also failed", err2);
    }
  }
}

// Event Listeners
if (btnCart) btnCart.addEventListener('click', openCartModal);
if (btnCloseCartModal) btnCloseCartModal.addEventListener('click', closeCartModal);
if (btnContinueShopping) btnContinueShopping.addEventListener('click', closeCartModal);
if (btnGoToCheckout) btnGoToCheckout.addEventListener('click', () => {
  closeCartModal();
  openCheckoutModal();
});
if (btnCloseCheckoutModal) btnCloseCheckoutModal.addEventListener('click', closeCheckoutModal);

// NEW: Orders Modal
const btnOrders = document.getElementById('btnOrders');
const ordersModal = document.getElementById('ordersModal');
const btnCloseOrdersModal = document.getElementById('btnCloseOrdersModal');

function openOrdersModal() {
  if (ordersModal) {
    ordersModal.classList.add('show');
    lockBodyScroll();
    loadMyOrders();
  }
}

function closeOrdersModal() {
  if (ordersModal) {
    ordersModal.classList.remove('show');
    unlockBodyScroll();
  }
}

if (btnOrders) btnOrders.addEventListener('click', openOrdersModal);
if (btnCloseOrdersModal) {
  btnCloseOrdersModal.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeOrdersModal();
  });
}

setupSafeModalBackdrop(ordersModal, closeOrdersModal);

async function loadMyOrders() {
  const ordersBody = document.getElementById('ordersModalBody');
  if (!ordersBody) return;

  // ฟังก์ชันแยกสำหรับวาด UI
  const renderOrdersUI = (orders) => {
    // กรองข้อมูลตามแท็บปัจจุบัน
    let displayOrders = orders;
    if (currentOrderTab === 'fav') {
      displayOrders = orders.filter(o => favoriteOrderIds.some(fav => String(fav) === String(o.orderId)));
    }

    if (displayOrders && displayOrders.length > 0) {
      ordersBody.innerHTML = '';
      displayOrders.forEach(order => {
        let statusColor = '#aaaaaa';
        if (order.status === 'รอตรวจสอบ') statusColor = '#f59e0b';
        else if (order.status === 'ยืนยันแล้ว' || order.status === 'จัดส่งแล้ว' || order.status === 'กำลังจัดส่ง') statusColor = '#10b981';
        else if (order.status === 'รอชำระเงิน') statusColor = '#3b82f6';
        else if (order.status === 'ยกเลิก') statusColor = '#ef4444';

        const dateObj = new Date(order.timestamp);
        const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('th-TH') : order.timestamp;
        const isFav = favoriteOrderIds.some(fav => String(fav) === String(order.orderId));

        let itemsHtml = '';
        if (order.items && order.items.length > 0) {
          itemsHtml = order.items.map(item => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85em;">
              <span style="color: var(--text-main); flex: 1;">${item.name}</span>
              <span style="color: var(--text-light); width: 40px; text-align: right;">x${item.qty}</span>
            </div>
          `).join('');
        } else {
          itemsHtml = `<div style="font-size: 0.85em; color: var(--text-light);">ไม่มีรายละเอียดสินค้า</div>`;
        }

        const itemsJsonStr = encodeURIComponent(JSON.stringify(order.items || []));

        const row = document.createElement('div');
        row.className = 'cart-item';
        row.style.flexDirection = 'column';
        row.style.alignItems = 'flex-start';
        row.innerHTML = `
          <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 8px;">
            <span style="font-weight: bold; color: var(--text-main);">${order.orderId}</span>
            <span style="color: ${statusColor}; font-weight: bold; font-size: 0.9em; background: ${statusColor}15; padding: 2px 8px; border-radius: 12px;">${order.status}</span>
          </div>
          <div style="display: flex; justify-content: space-between; width: 100%; font-size: 0.9em; color: var(--text-light);">
            <span>${dateStr}</span>
            <span style="font-weight: 600; color: var(--primary-color);">฿${order.totalPrice}</span>
          </div>
          
          <!-- รายละเอียดสินค้า (Accordion style) -->
          <div style="width: 100%; margin-top: 12px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-weight: 600; font-size: 0.9em; margin-bottom: 8px; color: #475569;">รายการสินค้า:</div>
            ${itemsHtml}
          </div>

          <!-- ติดตามสถานะคำสั่งซื้อแบบ Visual Timeline Stepper -->
          ${renderOrderTimeline(order.status)}
          
          <!-- ปุ่ม Action -->
          <div style="display: flex; gap: 8px; width: 100%; margin-top: 12px;">
            <button onclick="toggleFavoriteOrder('${order.orderId}')" style="flex: 1; padding: 8px; border-radius: 8px; border: 1px solid ${isFav ? '#f59e0b' : '#cbd5e1'}; background: ${isFav ? '#fffbeb' : '#ffffff'}; color: ${isFav ? '#f59e0b' : '#64748b'}; font-weight: bold; cursor: pointer; transition: all 0.2s;">
              ${isFav ? '⭐ โปรด' : '☆ ถูกใจ'}
            </button>
            <button onclick="reorderItems('${itemsJsonStr}')" style="flex: 2; padding: 8px; border-radius: 8px; border: none; background: var(--primary-color); color: white; font-weight: bold; cursor: pointer;">
              🛒 สั่งเซ็ตนี้อีกครั้ง
            </button>
          </div>
        `;
        ordersBody.appendChild(row);
      });

      const closeBottomDiv = document.createElement('div');
      closeBottomDiv.style.textAlign = 'center';
      closeBottomDiv.style.width = '100%';
      closeBottomDiv.style.paddingTop = '10px';
      closeBottomDiv.innerHTML = `
        <button type="button" class="btn-close-modal-bottom" onclick="closeOrdersModal()">
          ✕ ปิดหน้าต่างประวัติคำสั่งซื้อ
        </button>
      `;
      ordersBody.appendChild(closeBottomDiv);
    } else {
      ordersBody.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
          ${currentOrderTab === 'fav' ? 'คุณยังไม่มีรายการสั่งซื้อโปรด' : 'ไม่พบประวัติการสั่งซื้อของคุณ'}
        </div>
      `;
    }
  };

  // 1. โหลดจาก Cache ขึ้นมาแสดงก่อนทันที (0 วินาที)
  let hasCache = false;
  try {
    const cachedStr = localStorage.getItem('myOrdersCache');
    if (cachedStr) {
      const cachedOrders = JSON.parse(cachedStr);
      if (cachedOrders && cachedOrders.length > 0) {
        renderOrdersUI(cachedOrders);
        hasCache = true;
      }
    }
  } catch (e) { }

  if (!hasCache) {
    ordersBody.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
        กำลังโหลดประวัติการสั่งซื้อ...
      </div>
    `;
  }

  // 2. ดึงข้อมูลจริงจาก Server เบื้องหลังเพื่ออัปเดตสถานะ
  let userId = 'web-test-user';
  if (liff.isLoggedIn()) {
    try {
      const profile = await liff.getProfile();
      userId = profile.userId;
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getMyOrders&userId=${userId}&_t=${Date.now()}`);
    const data = await res.json();

    if (data.status === 'success') {
      // เซฟทับ Cache ด้วยข้อมูลใหม่สุด
      localStorage.setItem('myOrdersCache', JSON.stringify(data.orders || []));
      if (typeof window.updateTrackOrdersBadge === 'function') {
        window.updateTrackOrdersBadge();
      }
      // วาด UI ใหม่อีกรอบ
      renderOrdersUI(data.orders);
    }
  } catch (error) {
    if (!hasCache) {
      ordersBody.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #ef4444;">
          เกิดข้อผิดพลาดในการโหลดข้อมูล
        </div>
      `;
    }
    console.error('Error fetching orders:', error);
  }
}

// ========================
// REORDER & FAVORITES LOGIC
// ========================
window.toggleFavoriteOrder = function (orderId) {
  const strOrderId = String(orderId);
  if (favoriteOrderIds.some(fav => String(fav) === strOrderId)) {
    favoriteOrderIds = favoriteOrderIds.filter(id => String(id) !== strOrderId);
  } else {
    favoriteOrderIds.push(strOrderId);
  }
  localStorage.setItem('favoriteOrderIds', JSON.stringify(favoriteOrderIds));
  // Re-render UI
  const cachedStr = localStorage.getItem('myOrdersCache');
  if (cachedStr) {
    try {
      const cachedOrders = JSON.parse(cachedStr);
      // Since renderOrdersUI is inside loadMyOrders and might not be globally accessible, 
      // we can just call loadMyOrders() again to refresh, which will hit the cache instantly.
      loadMyOrders();
    } catch (e) { }
  }
};

window.reorderItems = function (itemsJsonStr) {
  try {
    const items = JSON.parse(decodeURIComponent(itemsJsonStr));
    if (!items || items.length === 0) return;

    // เคลียร์ตะกร้าเดิม แล้วนำของใหม่ใส่
    cart = [];
    items.forEach(item => {
      cart.push({
        id: item.id || Date.now(),
        name: item.name,
        price: Number(item.price || 0),
        qty: Number(item.qty || 1),
        img: item.img || ''
      });
    });

    // ปิด Modal ประวัติ แล้วอัปเดต Badge และเปิด Cart Modal
    closeOrdersModal();
    if (typeof updateCartBadge === 'function') {
      updateCartBadge();
    } else {
      const badge = document.getElementById('cartBadge');
      if (badge) badge.textContent = cart.reduce((sum, it) => sum + it.qty, 0);
    }
    openCartModal();
  } catch (e) {
    console.error("Reorder failed:", e);
    alert('เกิดข้อผิดพลาดในการนำเข้ารายการสินค้า');
  }
};

const tabAllOrders = document.getElementById('tabAllOrders');
const tabFavOrders = document.getElementById('tabFavOrders');

if (tabAllOrders && tabFavOrders) {
  tabAllOrders.addEventListener('click', () => {
    currentOrderTab = 'all';
    tabAllOrders.style.color = 'var(--primary-color)';
    tabAllOrders.style.borderBottom = '2px solid var(--primary-color)';
    tabFavOrders.style.color = '#64748b';
    tabFavOrders.style.borderBottom = '2px solid transparent';
    loadMyOrders();
  });

  tabFavOrders.addEventListener('click', () => {
    currentOrderTab = 'fav';
    tabFavOrders.style.color = 'var(--primary-color)';
    tabFavOrders.style.borderBottom = '2px solid var(--primary-color)';
    tabAllOrders.style.color = '#64748b';
    tabAllOrders.style.borderBottom = '2px solid transparent';
    loadMyOrders();
  });
}

// Cart & Checkout Modal Safe Backdrop Close
setupSafeModalBackdrop(cartModal, closeCartModal);
setupSafeModalBackdrop(checkoutModal, closeCheckoutModal);

// ตำแหน่งพิกัดร้านเกื้อกูลกัน (Default Store Location)
const STORE_LOCATION = { lat: 15.7256381, lng: 100.1131528 };

// คำนวณระยะทางทรงกลม (Haversine Formula) เป็นกิโลเมตร
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // รัศมีโลก (กม.)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// แยกพิกัด lat, lng จาก URL หรือ String
function parseCoords(urlOrStr) {
  if (!urlOrStr) return null;
  const match = urlOrStr.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  const match2 = urlOrStr.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (match2) {
    return { lat: parseFloat(match2[1]), lng: parseFloat(match2[2]) };
  }
  return null;
}

// GPS Location + Interactive Map Pin Dropping
let mapInstance = null;
let mapMarker = null;
let storeMarker = null;
let mapInitialized = false;

// สร้าง Custom Icon สำหรับหมุดบนแผนที่
function createMapPinIcon() {
  return L.divIcon({
    className: 'pin-marker',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48" fill="none">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z" fill="#388BC2"/>
      <circle cx="18" cy="18" r="8" fill="white"/>
      <circle cx="18" cy="18" r="4" fill="#388BC2"/>
    </svg>`,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -48]
  });
}

// อัปเดตตำแหน่งหมุดบนแผนที่ + คำนวณระยะทางอัตโนมัติจากร้าน + แสดงสถานะ
function updateMapPin(lat, lng, flyTo = true) {
  const gpsLinkInput = document.getElementById('gpsLocationLink');
  const statusBadge = document.getElementById('locationStatus');
  const instructionOverlay = document.getElementById('mapInstructionOverlay');

  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  gpsLinkInput.value = mapUrl;

  // คำนวณระยะทางอัตโนมัติจากร้านเกื้อกูลกันถึงตำแหน่งจัดส่ง
  const rawDistance = calculateHaversineDistance(STORE_LOCATION.lat, STORE_LOCATION.lng, lat, lng);
  const calcDistance = rawDistance < 0.1 ? 0.1 : Math.round(rawDistance * 10) / 10;

  const distInput = document.getElementById('deliveryDistance');
  if (distInput) {
    distInput.value = calcDistance;
  }
  const distText = document.getElementById('deliveryDistanceText');
  if (distText) {
    distText.textContent = `${calcDistance} กม.`;
  }

  statusBadge.textContent = `📍 ปักหมุดจัดส่งสำเร็จ (${lat.toFixed(5)}, ${lng.toFixed(5)}) • ระยะทาง ~${calcDistance} กม. จากร้าน`;
  statusBadge.className = 'location-status-badge success';

  // คำนวณสรุปยอดสั่งซื้อใหม่ตามระยะทางจริงทันที
  calculateCheckoutTotal();

  // ซ่อนข้อความคำแนะนำบนแผนที่
  if (instructionOverlay) {
    instructionOverlay.classList.add('hidden');
  }

  try {
    if (mapInstance) {
      if (mapMarker) {
        mapMarker.setLatLng([lat, lng]);
      } else {
        mapMarker = L.marker([lat, lng], {
          icon: createMapPinIcon(),
          draggable: true
        }).addTo(mapInstance);

        // ลากหมุดเพื่อย้ายตำแหน่ง
        mapMarker.on('dragend', function (e) {
          const pos = e.target.getLatLng();
          updateMapPin(pos.lat, pos.lng, false);
        });

        mapMarker.bindPopup('<b>📍 ตำแหน่งจัดส่งของคุณ</b><br>ลากหมุดเพื่อปรับตำแหน่ง').openPopup();
      }

      if (flyTo) {
        mapInstance.flyTo([lat, lng], 16, { duration: 0.25 });
      }
    }
  } catch (mapErr) {
    console.error("Leaflet Map Error: ", mapErr);
  }

  validateCheckoutForm();
}

// สร้างแผนที่ Leaflet ตอนเปิด Checkout Modal
function initMapPicker() {
  const mapContainer = document.getElementById('mapPicker');
  if (!mapContainer) return;

  // ถ้าแผนที่ถูกสร้างแล้ว ให้ invalidateSize เพื่อแก้ปัญหาขนาด
  if (mapInstance) {
    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 300);
    return;
  }

  // ตำแหน่งเริ่มต้นเป็นตำแหน่งร้านเกื้อกูลกัน ( Default Store Location )
  const defaultLat = STORE_LOCATION.lat;
  const defaultLng = STORE_LOCATION.lng;

  mapInstance = L.map('mapPicker', {
    center: [defaultLat, defaultLng],
    zoom: 15,
    zoomControl: true,
    attributionControl: false
  });

  // ใช้ OpenStreetMap Tiles (ฟรี)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapInstance);

  // ปักหมุดประจำตำแหน่งร้านเกื้อกูลกัน (Store Marker)
  const storeMarkerIcon = L.divIcon({
    className: 'store-marker-badge',
    html: `<div style="background: #16a34a; color: white; padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 11px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;">🏪 ร้านเกื้อกูลกัน</div>`,
    iconSize: [110, 30],
    iconAnchor: [55, 15]
  });
  storeMarker = L.marker([defaultLat, defaultLng], { icon: storeMarkerIcon, zIndexOffset: 1000 }).addTo(mapInstance);
  storeMarker.bindPopup('<b>🏪 ร้านเกื้อกูลกัน (จุดเริ่มต้นจัดส่ง)</b><br>วัตถุดิบอาหาร กาแฟ เบเกอรี่');

  // คลิกบนแผนที่เพื่อปักหมุดจัดส่ง
  mapInstance.on('click', function (e) {
    updateMapPin(e.latlng.lat, e.latlng.lng, false);
  });

  mapInitialized = true;

  // Fix ขนาดแผนที่หลังจาก modal แสดงเสร็จ
  setTimeout(() => {
    mapInstance.invalidateSize();
  }, 400);
}

// ปุ่ม GPS ดึงพิกัดปัจจุบัน + แสดงบนแผนที่
if (btnGetLocation) {
  btnGetLocation.addEventListener('click', () => {
    const statusBadge = document.getElementById('locationStatus');

    statusBadge.textContent = '📍 กำลังดึงพิกัด GPS...';
    statusBadge.className = 'location-status-badge';

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          updateMapPin(lat, lng, true);
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMsg = 'ไม่สามารถดึงตำแหน่งได้';
          if (error.code === error.PERMISSION_DENIED) {
            errorMsg = 'ถูกปฏิเสธการเข้าถึงพิกัด GPS (กรุณาเปิดสิทธิ์ในเครื่องโทรศัพท์)';
          }
          statusBadge.textContent = `⚠️ ${errorMsg}`;
          statusBadge.className = 'location-status-badge';
          validateCheckoutForm();
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      statusBadge.textContent = '⚠️ อุปกรณ์นี้ไม่รองรับการดึงพิกัด GPS';
      validateCheckoutForm();
    }
  });
}


// Checkout input validations
const checkoutName = document.getElementById('checkoutName');
const checkoutPhone = document.getElementById('checkoutPhone');
const checkoutAddressDetails = document.getElementById('checkoutAddressDetails');
const preorderDateInput = document.getElementById('preorderDate');
const preorderTimeSelect = document.getElementById('preorderTime');
const preorderTimeSection = document.getElementById('preorderTimeSection');

if (preorderDateInput) {
  const localDate = new Date();
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const localTodayStr = `${year}-${month}-${day}`;
  preorderDateInput.min = localTodayStr;
  preorderDateInput.value = localTodayStr;
}

// จัดการการสลับรูปแบบการจัดส่ง (จัดส่ง / รับหน้าร้าน)
document.querySelectorAll('input[name="shippingOption"]').forEach(radio => {
  radio.addEventListener('change', () => {
    toggleShippingFields();
  });
});

// จัดการการแสดงตัวเลือกย่อยของช่องทางการชำระเงิน (COD)
document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const codSubOptions = document.getElementById('codSubOptions');
    if (e.target.value === 'ปลายทาง') {
      if (codSubOptions) codSubOptions.style.display = 'flex';
    } else {
      if (codSubOptions) codSubOptions.style.display = 'none';
    }
  });
});

// จัดการการแสดงช่องกรอกยอดเงินสำหรับ COD แต่ละประเภท
document.querySelectorAll('input[name="codType"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const cashInput = document.getElementById('codCashChangeInput');
    const mixInput = document.getElementById('codMixedInput');
    if (cashInput) cashInput.style.display = (e.target.value === 'ชำระเงินสดเตรียมเงินทอน') ? 'block' : 'none';
    if (mixInput) mixInput.style.display = (e.target.value === 'โอนเงินผสมเงินสด') ? 'flex' : 'none';
  });
});

// จัดการการสลับรูปแบบการสั่งซื้อ (ส่งทันที / สั่งล่วงหน้า)
document.querySelectorAll('input[name="deliveryType"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'ล่วงหน้า') {
      if (preorderTimeSection) preorderTimeSection.style.display = 'block';
    } else {
      if (preorderTimeSection) preorderTimeSection.style.display = 'none';
    }
    validateCheckoutForm();
  });
});

if (checkoutName) checkoutName.addEventListener('input', validateCheckoutForm);
if (checkoutPhone) {
  checkoutPhone.addEventListener('input', (e) => {
    e.target.value = formatThaiPhoneNumber(e.target.value);
    validateCheckoutForm();
  });
}
if (checkoutAddressDetails) checkoutAddressDetails.addEventListener('input', validateCheckoutForm);
const addressLabelEl = document.getElementById('addressLabel');
if (addressLabelEl) addressLabelEl.addEventListener('input', validateCheckoutForm);
if (preorderDateInput) preorderDateInput.addEventListener('change', validateCheckoutForm);
if (preorderTimeSelect) preorderTimeSelect.addEventListener('change', validateCheckoutForm);

// Submit Order to Cloudflare API / Server
if (btnSubmitOrder) {
  btnSubmitOrder.addEventListener('click', async () => {
    const name = checkoutName.value.trim();
    const rawPhone = checkoutPhone.value.trim();
    const cleanPhone = cleanPhoneNumber(rawPhone);
    const isPhoneValid = isValidThaiPhone(cleanPhone);
    const phone = cleanPhone;

    const shippingOption = document.querySelector('input[name="shippingOption"]:checked')?.value || 'จัดส่ง';
    let rawAddressDetails = checkoutAddressDetails ? checkoutAddressDetails.value.trim() : '';

    // ตรวจสอบความครบถ้วนของข้อมูล
    let missingFields = [];
    if (!name) missingFields.push('ชื่อผู้สั่ง');
    if (!rawPhone) {
      missingFields.push('เบอร์โทรศัพท์ติดต่อ');
    } else if (!isPhoneValid) {
      missingFields.push('เบอร์โทรศัพท์ที่ถูกต้อง (ตัวเลข 10 หลัก ขึ้นต้นด้วย 0 เช่น 08X-XXX-XXXX)');
    }
    if (shippingOption === 'จัดส่ง' && !rawAddressDetails) missingFields.push('รายละเอียดที่อยู่จัดส่ง');

    const deliveryTypeCheck = document.querySelector('input[name="deliveryType"]:checked')?.value || 'ทันที';
    if (deliveryTypeCheck === 'ล่วงหน้า') {
      const pDate = document.getElementById('preorderDate')?.value;
      const pTime = document.getElementById('preorderTime')?.value;
      if (!pDate || !pTime) missingFields.push('วันและเวลาสั่งซื้อล่วงหน้า');
    }

    if (missingFields.length > 0) {
      alert(`⚠️ ข้อมูลยังไม่ครบถ้วน!\n\nกรุณากรอกข้อมูลต่อไปนี้ก่อนยืนยันการสั่งซื้อครับ:\n• ${missingFields.join('\n• ')}`);
      return;
    }
    let addressDetails = '';
    let gpsLocation = '';
    let addressLabel = '';

    if (shippingOption === 'รับหน้าร้าน') {
      addressDetails = 'รับสินค้าเองที่หน้าร้าน';
      gpsLocation = 'รับสินค้าเองที่หน้าร้าน';
      addressLabel = 'รับสินค้าเองที่หน้าร้าน';
    } else {
      addressDetails = checkoutAddressDetails.value.trim();
      gpsLocation = document.getElementById('gpsLocationLink').value.trim();
      if (selectedSavedAddressIndex !== -1) {
        const saved = getSavedAddresses();
        if (saved[selectedSavedAddressIndex]) {
          addressLabel = saved[selectedSavedAddressIndex].label || 'ที่อยู่ของฉัน';
        }
      } else {
        const addressLabelInput = document.getElementById('addressLabel');
        addressLabel = (addressLabelInput ? addressLabelInput.value.trim() : '') || 'ที่อยู่ของฉัน';
      }
    }

    let paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    if (paymentMethod === 'ปลายทาง') {
      const codType = document.querySelector('input[name="codType"]:checked')?.value || 'ปลายทางโอน';
      if (codType === 'ปลายทางโอน') {
        paymentMethod = 'เก็บเงินปลายทาง (ปลายทางโอน)';
      } else if (codType === 'ชำระเงินสดเตรียมเงินทอน') {
        const cashAmt = document.getElementById('codCashAmount')?.value || '';
        paymentMethod = `เก็บเงินปลายทาง (ชำระเงินสดเตรียมเงินทอน${cashAmt ? ' - แบงค์ ' + cashAmt : ''})`;
      } else if (codType === 'โอนเงินผสมเงินสด') {
        const mixTrans = document.getElementById('codMixedTransfer')?.value || '';
        const mixCash = document.getElementById('codMixedCash')?.value || '';
        paymentMethod = `เก็บเงินปลายทาง (โอนเงินผสมเงินสด - โอน ${mixTrans} บาท, เงินสด ${mixCash} บาท)`;
      }
    }

    const totals = calculateCheckoutTotal();
    const totalAmount = totals.grandTotal;

    btnSubmitOrder.disabled = true;
    const btnSubmitText = document.getElementById('btnSubmitText'); if (btnSubmitText) btnSubmitText.textContent = '⏳ กำลังบันทึกคำสั่งซื้อ...'; else btnSubmitOrder.textContent = '⏳ กำลังบันทึกคำสั่งซื้อ...';

    let userId = 'web-test-user';
    let displayName = name;

    if (liff.isLoggedIn()) {
      try {
        const profile = await liff.getProfile();
        userId = profile.userId;
        displayName = profile.displayName;
      } catch (e) {
        console.error('Error getting LINE profile during checkout:', e);
      }
    }

    // สร้าง orderId จากฝั่ง Frontend ทันทีเพื่อให้ระบบตอบสนองไวที่สุด
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderId = `ORD-${dateStr}-${randomNum}`;

    const deliveryType = document.querySelector('input[name="deliveryType"]:checked')?.value || 'ทันที';
    let preorderTimeStr = '';
    if (deliveryType === 'ล่วงหน้า') {
      const pDate = document.getElementById('preorderDate').value;
      const pTime = document.getElementById('preorderTime').value;
      preorderTimeStr = `${pDate} ${pTime}`;
    }

    const note = document.getElementById('checkoutNote')?.value.trim() || '';

    const orderPayload = {
      action: 'createOrder',
      orderId: orderId,
      userId: userId,
      displayName: displayName,
      phone: phone,
      gpsLocation: gpsLocation,
      addressDetails: addressDetails,
      addressLabel: addressLabel,
      paymentMethod: paymentMethod,
      totalPrice: totals.grandTotal,
      subtotalPrice: totals.subtotal,
      shippingFee: totals.shippingFee,
      discountAmount: totals.discountAmount || 0,
      couponCode: totals.couponCode || '',
      distanceKm: totals.distanceKm,
      deliveryType: deliveryType,
      preorderTime: preorderTimeStr,
      shippingOption: shippingOption,
      note: note,
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        subtotal: (Number(item.price || 0) * Number(item.qty || 1))
      }))
    };

    try {
      // ใช้โหมด no-cors เพื่อไม่ต้องรอการตอบกลับที่มักจะติดปัญหา Redirect 302 ของ Google
      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(orderPayload)
      }).catch(e => console.error("Fetch background error:", e));

      // Cache ออเดอร์ใหม่ลง LocalStorage ทันที เพื่อให้หน้าประวัติโหลดไว 0 วินาที
      try {
        const cachedStr = localStorage.getItem('myOrdersCache');
        let cachedOrders = cachedStr ? JSON.parse(cachedStr) : [];
        cachedOrders.unshift({
          timestamp: new Date().toISOString(),
          orderId: orderId,
          totalPrice: totals.grandTotal,
          status: 'รอตรวจสอบ'
        });
        localStorage.setItem('myOrdersCache', JSON.stringify(cachedOrders));
        if (typeof window.updateTrackOrdersBadge === 'function') {
          window.updateTrackOrdersBadge();
        }
      } catch (e) { }

      // ไม่มีการบันทึกที่อยู่อัตโนมัติอีกต่อไป ผู้ใช้ต้องกดปุ่ม "บันทึกที่อยู่นี้ทันที" เอง

      // ถือว่าสั่งซื้อสำเร็จทันที (Instant feedback) ทำให้แอพลื่นไหล ไม่ค้าง
      alert(`✅ ส่งออเดอร์ให้แอดมินตรวจสอบเรียบร้อยแล้ว!\nหมายเลขสั่งซื้อของคุณคือ: ${orderId}`);

      // ส่งข้อความ Flex Message แจ้งรายละเอียดคำสั่งซื้อในห้องแชท LINE
      if (liff.isInClient()) {
        await sendOrderFlexMessage(orderId, name, formatThaiPhoneNumber(phone), totals.grandTotal, cart, deliveryType, preorderTimeStr, shippingOption, totals.subtotal, totals.shippingFee, paymentMethod, totals.discountAmount || 0, totals.couponCode || '');
      }

      // เคลียร์คูปอง ตะกร้า และปิด Modal ทันที
      removePromoCode();
      const noteInputEl = document.getElementById('checkoutNote');
      if (noteInputEl) noteInputEl.value = '';
      clearCart();
      closeCheckoutModal();
      closeCartModal();

      btnSubmitOrder.disabled = false;
      const btnSubmitText = document.getElementById('btnSubmitText'); if (btnSubmitText) btnSubmitText.textContent = 'ยืนยันการสั่งซื้อ'; else btnSubmitOrder.textContent = 'ยืนยันการสั่งซื้อและส่งข้อมูล';

      // เปิดหน้าต่างประวัติคำสั่งซื้ออัตโนมัติ (หน่วงเวลาเล็กน้อยเพื่อให้ระบบส่งข้อมูลเสร็จก่อน)
      setTimeout(() => {
        openOrdersModal();
      }, 500);

    } catch (error) {
      console.error('Checkout error:', error);
      alert('❌ เกิดข้อผิดพลาดในระบบแอปพลิเคชัน กรุณาลองใหม่อีกครั้ง');
      btnSubmitOrder.disabled = false;
      const btnSubmitText = document.getElementById('btnSubmitText'); if (btnSubmitText) btnSubmitText.textContent = 'ยืนยันการสั่งซื้อ'; else btnSubmitOrder.textContent = 'ยืนยันการสั่งซื้อและส่งข้อมูล';
    }
  });
}

// Promo Code / Coupon Event Listeners
const btnApplyCoupon = document.getElementById('btnApplyCoupon');
const couponCodeInput = document.getElementById('couponCodeInput');
if (btnApplyCoupon && couponCodeInput) {
  btnApplyCoupon.addEventListener('click', () => {
    applyPromoCode(couponCodeInput.value);
  });
  couponCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyPromoCode(couponCodeInput.value);
    }
  });
}

// Event Listeners
const navSearchContainer = document.getElementById('navSearchContainer');
const navSearchInput = document.getElementById('navSearchInput');
const btnCloseNavSearch = document.getElementById('btnCloseNavSearch');

if (document.getElementById('btnSearchNav') && navSearchContainer && navSearchInput) {
  document.getElementById('btnSearchNav').addEventListener('click', () => {
    navSearchContainer.style.display = 'block';
    navSearchInput.focus();
  });

  if (btnCloseNavSearch) {
    btnCloseNavSearch.addEventListener('click', () => {
      navSearchContainer.style.display = 'none';
      navSearchInput.value = '';
      if (searchInput) searchInput.value = '';
      searchQuery = '';
      visibleLimit = 20;
      renderProducts();
    });
  }

  navSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    resetCategoryForSearch();
    if (searchInput) searchInput.value = e.target.value;
    visibleLimit = 20;
    renderProducts();
  });
}
// const btnSearchNav = document.getElementById('btnSearchNav');
// if (btnSearchNav) {
//   btnSearchNav.addEventListener('click', () => {
//     if (typeof searchInput !== 'undefined' && searchInput) {
//       searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
//       setTimeout(() => { searchInput.focus(); }, 300);
//     }
//   });
// }
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  resetCategoryForSearch();
  if (typeof navSearchInput !== 'undefined' && navSearchInput) navSearchInput.value = e.target.value;
  visibleLimit = 20; // รีเซ็ตหน้าแรกเมื่อค้นหาใหม่
  renderProducts();
});

// เมื่อมีการค้นหาด้วยชื่อสินค้า ให้บังคับหมวดหมู่กลับไปที่ "ทั้งหมด" เพื่อค้นหาจากสินค้าทุกหมวด
function resetCategoryForSearch() {
  if (searchQuery.trim() === '') return;
  if (currentParentCategory === 'all' && currentSubCategory === 'all') return;
  currentParentCategory = 'all';
  currentSubCategory = 'all';
  initCategoryFilters(); // อัปเดตไอคอนหมวดหมู่ให้ไฮไลต์ที่ "ทั้งหมด"
}

// === MULTI-LEVEL DYNAMIC CATEGORIES SYSTEM ===

function parseProductCategory(categoryStr) {
  if (!categoryStr) return { parent: 'ทั่วไป', sub: 'ทั้งหมด' };

  const trimmed = categoryStr.trim();

  // Split by common separators: / or > or | or : or -
  const parts = trimmed.split(/[\/>|:-]/).map(p => p.trim());
  if (parts.length >= 2) {
    return { parent: parts[0], sub: parts[1] };
  }

  return { parent: parts[0] || 'ทั่วไป', sub: 'ทั้งหมด' };
}

function initCategoryFilters() {
  const categoryTree = {
    'all': new Set()
  };

  // Build tree from loaded products
  PRODUCTS.forEach(product => {
    if (product.status && String(product.status).toLowerCase() === 'inactive') return;
    const parsed = parseProductCategory(product.category);
    product._parsedParent = parsed.parent;
    product._parsedSub = parsed.sub;

    if (!categoryTree[parsed.parent]) {
      categoryTree[parsed.parent] = new Set();
    }
    categoryTree[parsed.parent].add(parsed.sub);
  });

  const parentNav = document.getElementById('parentCategoriesNav');
  if (!parentNav) return;

  // Clear and Render Parent Tabs
  // Clear and Render Parent Tabs
  parentNav.innerHTML = '';

  const iconGrid = document.createElement('div');
  iconGrid.className = 'category-icon-grid';

  const renderIconItem = (val, text) => {
    const item = document.createElement('div');
    item.className = `category-icon-item ${currentParentCategory === val ? 'active' : ''}`;
    const iconContainer = document.createElement('div');
    iconContainer.className = 'icon-container';
    let iconEmoji = '✨';
    if (val === 'all') iconEmoji = '🛍️';
    else if (val.includes('เครื่องดื่ม')) iconEmoji = '🧋';
    else if (val.includes('อาหาร') || val.includes('ปรุง')) iconEmoji = '🥘';
    else if (val.includes('ธัญพืช')) iconEmoji = '🌾';
    else if (val.includes('เบเกอรี่') || val.includes('ขนม')) iconEmoji = '🥐';
    else if (val.includes('บรรจุภัณฑ์')) iconEmoji = '📦';
    iconContainer.innerHTML = `<span class="icon-emoji">${iconEmoji}</span>`;
    const label = document.createElement('span');
    label.className = 'icon-label';
    label.textContent = text;
    item.appendChild(iconContainer);
    item.appendChild(label);
    item.addEventListener('click', () => { selectParentCategory(val); });
    iconGrid.appendChild(item);
  };
  renderIconItem('all', 'ทั้งหมด');

  // Removed parentSelect logic
  //
  //
  //
  //

  //
  //
  //
  //
  //

  Object.keys(categoryTree).forEach(parent => {
    if (parent === 'all') return;
    renderIconItem(parent, parent);
  });
  //
  //
  //
  //
  //
  //
  //

  parentNav.appendChild(iconGrid);

  // Render Subcategory Tabs
  renderSubCategoriesUI(categoryTree);
}

function renderSubCategoriesUI(categoryTree) {
  const subNav = document.getElementById('subCategoriesNav');
  if (!subNav) return;

  if (currentParentCategory === 'all' || !categoryTree[currentParentCategory] || categoryTree[currentParentCategory].size === 0) {
    subNav.style.display = 'none';
    return;
  }

  subNav.style.display = 'none'; // disabled subcategories
  subNav.innerHTML = '';

  // Add "ทั้งหมด" for subcategory
  const subSelect = document.createElement('select');
  subSelect.className = 'category-dropdown';
  subSelect.addEventListener('change', (e) => {
    selectSubCategory(e.target.value);
  });

  const allSubOption = document.createElement('option');
  allSubOption.value = 'all';
  allSubOption.textContent = 'หมวดหมู่ย่อยทั้งหมด';
  allSubOption.selected = currentSubCategory === 'all';
  subSelect.appendChild(allSubOption);

  // Add individual subcategories
  categoryTree[currentParentCategory].forEach(sub => {
    if (sub === 'ทั้งหมด') return; // Skip if 'ทั้งหมด' was added as a string
    const option = document.createElement('option');
    option.value = sub;
    option.textContent = sub;
    option.selected = currentSubCategory === sub;
    subSelect.appendChild(option);
  });

  subNav.appendChild(subSelect);
}

function selectParentCategory(parent) {
  currentParentCategory = parent;
  currentSubCategory = 'all'; // Reset subcategory when parent changes
  initCategoryFilters();
  visibleLimit = 20;
  renderProducts();
}

function selectSubCategory(sub) {
  currentSubCategory = sub;
  initCategoryFilters();
  visibleLimit = 20;
  renderProducts();
}

// Infinite Scroll — ลบ scroll event เก่าออก แทนด้วย IntersectionObserver ใน renderProducts()
// (ดูฟังก์ชัน observeSentinel() ด้านบน)


// Modal Close logic
setupSafeModalBackdrop(modal, closeModal);

const btnCloseModalEl = document.getElementById('btnCloseModal');
if (btnCloseModalEl) {
  btnCloseModalEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });
}

// Lightbox Close logic
if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    // Close if clicking outside the image (i.e. background)
    if (e.target === lightbox || e.target.classList.contains('lightbox-content') || e.target.tagName === 'IMG') {
      closeLightbox();
    }
  });
}

if (btnCloseLightbox) {
  btnCloseLightbox.addEventListener('click', closeLightbox);
}

// Back to Home
if (btnBack) {
  btnBack.addEventListener('click', () => {
    if (typeof window.showProfileView === 'function') {
      window.showProfileView();
    } else {
      window.location.href = 'index.html';
    }
  });
}


// ===== โหลดสินค้า 3 ชั้น: Cache → Static JSON → GAS =====
// ชั้น 1: localStorage (0ms) | ชั้น 2: products.json จาก Vercel CDN (~50ms) | ชั้น 3: GAS (~3-10s)
// ซิงค์และกรองสินค้าที่แอดมินปิดการขาย (inactive) จากเซิร์ฟเวอร์แบบ Real-time (รวดเร็วเพียง ~20-50ms)
async function syncInactiveProductStatuses() {
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getInactiveProducts&_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.inactiveIds)) {
        const inactiveSet = new Set(data.inactiveIds.map(String));
        let anyChanged = false;
        PRODUCTS.forEach(p => {
          const isInactive = inactiveSet.has(String(p.id));
          if (isInactive && p.status !== 'inactive') {
            p.status = 'inactive';
            anyChanged = true;
          } else if (!isInactive && p.status === 'inactive') {
            p.status = 'active';
            anyChanged = true;
          }
        });
        if (anyChanged) {
          initCategoryFilters();
          renderProducts();

          // หากสินค้าที่ถูกปิดค้างอยู่ในตะกร้า ให้นำออกอัตโนมัติ
          if (cart && cart.length > 0) {
            const beforeLen = cart.length;
            cart = cart.filter(item => !inactiveSet.has(String(item.id)));
            if (cart.length !== beforeLen) {
              saveCart();
              if (typeof renderCartItems === 'function') renderCartItems();
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('syncInactiveProductStatuses error:', e.message);
  }
}

// ตรวจจับสถานะเปิด/ปิดสินค้าแบบสดๆ (Live Update) ทุก 15 วินาทีขณะที่ลูกค้าเปิดดูแอปอยู่
setInterval(() => {
  if (document.visibilityState === 'visible') {
    syncInactiveProductStatuses();
  }
}, 15000);

// ตรวจสอบทันทีเมื่อลูกค้าสลับกลับมาที่หน้าเว็บ/แอป LINE
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    syncInactiveProductStatuses();
  }
});
window.addEventListener('focus', () => {
  syncInactiveProductStatuses();
});

let catalogRefreshInFlight = null;
let catalogLoaded = false;

async function loadProducts() {
  if (catalogRefreshInFlight) return catalogRefreshInFlight;
  catalogRefreshInFlight = doLoadProducts();
  try { return await catalogRefreshInFlight; }
  finally { catalogRefreshInFlight = null; }
}

// กรองรูปที่ไม่ต้องการ/รูปเทปเก่าออกจากรายการสินค้าทุกรายการ
function sanitizeProductList(items) {
  if (!Array.isArray(items)) return [];
  return items.map(p => {
    if (p && p.img && typeof p.img === 'string' && p.img.includes('1779018898541-98193691087.jpg')) {
      return { ...p, img: '' };
    }
    return p;
  });
}

async function doLoadProducts() {
  const grid = document.getElementById('productsGrid');

  // ล้างแคชในเครื่องทั้งหมดออกอย่างสมบูรณ์
  try {
    localStorage.removeItem('cached_products');
    localStorage.removeItem('cached_products_v2');
    localStorage.removeItem('cached_products_v3');
    localStorage.removeItem('cached_admin_products');
  } catch (e) {}

  // แสดงสถานะกำลังโหลดจากฐานข้อมูลสด
  if (!catalogLoaded && grid) {
    grid.innerHTML = `
      <div style="text-align:center;width:100%;padding:60px 20px;color:var(--text-light)">
        <div class="loading-spinner" style="margin: 0 auto 12px auto; width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: var(--primary, #388BC2); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <p style="font-size:15px;font-weight:600;">กำลังดึงข้อมูลสินค้าล่าสุดจากฐานข้อมูล...</p>
      </div>
    `;
  }

  // ดึงข้อมูลสดจาก Cloudflare D1 Database โดยตรงทุกครั้ง (ไม่ผ่าน LocalStorage และไม่ผ่าน products.json)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts&_t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.status === 'success' && Array.isArray(data.products) && data.products.length > 0) {
        PRODUCTS = sanitizeProductList(data.products);
        catalogLoaded = true;
        initCategoryFilters();
        renderProducts();
        console.log(`Live product sync from Database completed: ${PRODUCTS.length} items`);
        return;
      }
    }
    throw new Error('ไม่พบข้อมูลสินค้าจากฐานข้อมูล');
  } catch (error) {
    console.error('Database fetch error:', error.message);
    if (!catalogLoaded) {
      if (grid) {
        grid.innerHTML = `
          <div style="text-align:center;width:100%;padding:60px 20px;color:var(--text-light);">
            <p style="font-size:15px;font-weight:600;color:#ef4444;">⚠️ ไม่สามารถดึงข้อมูลสินค้าจากฐานข้อมูลได้</p>
            <p style="font-size:13px;color:#64748b;margin-top:4px;">${error.message || 'กรุณาลองใหม่อีกครั้ง'}</p>
            <button onclick="loadProducts()" class="btn-primary" style="margin-top:14px;padding:8px 18px;border-radius:10px;cursor:pointer;">🔄 ลองโหลดใหม่อีกครั้ง</button>
          </div>
        `;
      }
    }
  }
}

// Export functions to window for global access
window.loadProducts = loadProducts;
window.renderProducts = renderProducts;

// Refresh live prices and images periodically in the background
setInterval(() => {
  if (document.visibilityState === 'visible') loadProducts();
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadProducts();
});
window.addEventListener('focus', () => loadProducts());

function showProductsError(grid, icon, title, subtitle) {
  if (!grid) return;
  grid.innerHTML = `
    <div style="text-align:center;width:100%;padding:60px 20px;color:var(--text-light)">
      <div style="font-size:40px;margin-bottom:12px">${icon}</div>
      <p style="font-size:15px;font-weight:600">${title}</p>
      <p style="font-size:12px;margin-top:6px;opacity:0.7">${subtitle}</p>
      <button type="button" onclick="window.loadProducts()" style="margin-top:16px;padding:10px 24px;background:var(--primary-color,#388BC2);color:white;border:none;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;box-shadow:0 4px 10px rgba(56,139,194,0.3);">🔄 ลองใหม่อีกครั้ง</button>
    </div>`;
}



// Start application — โหลดสินค้าและ LIFF พร้อมกัน ไม่รอกัน
async function start() {
  loadCart();

  // โหลดข้อมูลสินค้าและโค้ดโปรโมชั่นเบื้องหลังแบบ Non-blocking (ไม่ต้องรอให้เสร็จก่อน)
  loadProducts();
  syncActivePromoCodes();

  // รอเพียงแค่การเชื่อมต่อกับ LINE LIFF ซึ่งทำงานเร็วกว่ามาก
  await initLiff();

  // Check if URL has an auto-process action (Cancel or Confirm Order)
  const urlParams = new URLSearchParams(window.location.search);
  const actionParam = urlParams.get('action');

  if (actionParam === 'cancelOrder' || actionParam === 'confirmOrder') {
    const orderId = urlParams.get('orderId');
    if (orderId) {
      document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#f8fafc; font-family:sans-serif;">
          <h2 style="color:var(--primary-color, #2563eb); margin-bottom:10px;">กำลังประมวลผล...</h2>
          <p style="color:#64748b;">กรุณารอสักครู่ ระบบกำลังจัดการคำสั่งซื้อ ${orderId}</p>
        </div>
      `;
      const statusStr = (actionParam === 'cancelOrder') ? 'ยกเลิก' : 'ชำระเงิน';

      try {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'updateOrderStatus', orderId: orderId, status: statusStr })
        }).then(() => {
          setTimeout(() => { if (liff.isInClient()) liff.closeWindow(); }, 600);
        }).catch(() => {
          setTimeout(() => { if (liff.isInClient()) liff.closeWindow(); }, 600);
        });
      } catch (e) {
        if (liff.isInClient()) liff.closeWindow();
      }
      return; // Stop further execution so the store doesn't load
    }
  }

  // Expose openOrdersModal globally for SPA navigation
  window.openOrdersModal = openOrdersModal;
  window.openProductDetail = openProductDetail;
  window.openCartModal = openCartModal;

  // Check if URL has a specific product query param (deep link)
  const productId = urlParams.get('product');
  if (productId) {
    if (typeof window.showCatalogView === 'function') {
      window.showCatalogView();
    }
    setTimeout(() => {
      openProductDetail(parseInt(productId, 10));
    }, 100);
  }

  const openParam = urlParams.get('open');
  if (openParam === 'favorites') {
    if (typeof window.showCatalogView === 'function') {
      window.showCatalogView('favorites');
    } else {
      openOrdersModal();
      const tabFav = document.getElementById('tabFavOrders');
      if (tabFav) tabFav.click();
    }
  } else if (openParam === 'orders') {
    if (typeof window.showCatalogView === 'function') {
      window.showCatalogView('orders');
    } else {
      openOrdersModal();
      const tabAll = document.getElementById('tabAllOrders');
      if (tabAll) tabAll.click();
    }
  }
}

start();

// Scroll to top: กดที่โลโก้/ชื่อร้าน "เกื้อกูลกัน" บน navbar แล้วเลื่อนขึ้นบนสุด
const navbarBrand = document.querySelector('.navbar-brand');
if (navbarBrand) {
  navbarBrand.style.cursor = 'pointer';
  navbarBrand.setAttribute('role', 'button');
  navbarBrand.setAttribute('title', 'เลื่อนขึ้นบนสุด');
  navbarBrand.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Scroll to top functionality (ปุ่มลอยเดิม - ถูกลบออกจาก HTML แล้ว)
const btnScrollToTop = document.getElementById('btnScrollToTop');
if (btnScrollToTop) {
  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (scrollPos > 300) {
      btnScrollToTop.classList.add('show');
    } else {
      btnScrollToTop.classList.remove('show');
    }
  });

  btnScrollToTop.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

