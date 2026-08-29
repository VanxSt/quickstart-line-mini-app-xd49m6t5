const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxyxWAvFyaJs8mu7EolH4ziXCByqrNKjhrW97A8RLsnEha2oyufuC7PuYPpGmWRFnr7/exec';

let PRODUCTS = [];

// Helper สำหรับปรับแต่ง URL รูปภาพเพื่อประสิทธิภาพสูงสุด (แปลงเป็น WebP และย่อขนาดหากมี CDN รองรับ)
function getOptimizedImageUrl(url) {
  if (!url || !url.trim().startsWith('http')) {
    return 'https://placehold.co/600x600/f3f0ec/a88b62?text=No+Image';
  }

  let optimizedUrl = url.trim();

  // ใช้ Image CDN ฟรี (wsrv.nl) ช่วยย่อขนาดและแปลงรูปทุกชนิดเป็น WebP อัตโนมัติ
  // ซึ่งจะช่วยลดขนาดรูปจาก 5MB เหลือไม่เกิน 50KB ทำให้แสดงผลหน้าสินค้าได้ไวขึ้นถึง 100 เท่า
  if (!optimizedUrl.includes('wsrv.nl') && !optimizedUrl.includes('placehold.co')) {
    optimizedUrl = `https://wsrv.nl/?url=${encodeURIComponent(optimizedUrl)}&w=400&output=webp&we`;
  }

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
let activeProduct = null;
let visibleLimit = 20; // จำกัดจำนวนการแสดงผลในครั้งแรกเพื่อความรวดเร็ว (Pagination)
let cart = [];
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
    await liff.init({ liffId: '2010951634-lg8G4wUA' });
    console.log('LIFF Initialized in catalog page');
    if (liff.isLoggedIn()) {
      try {
        const profile = await liff.getProfile();
        currentMemberInfo.displayName = profile.displayName;
        await fetchMemberInfo(profile.userId);
      } catch (profileError) {
        console.error('Error fetching LINE profile on init:', profileError);
      }
    }
  } catch (error) {
    console.error('LIFF initialization failed:', error);
  }
}

// Render Products
function renderProducts() {
  productsGrid.innerHTML = '';

  const filtered = PRODUCTS.filter(product => {
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
    return matchesCategory && matchesSearch;
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
    // ดึง URL รูปภาพที่ปรับประสิทธิภาพแล้ว (รองรับ WebP อัตโนมัติสำหรับ CDN)
    const productImg = getOptimizedImageUrl(product.img);

    const card = document.createElement('div');
    card.className = 'product-card animate-fade-in';
    card.innerHTML = `
      <div class="product-img-wrapper">
        <img class="product-img" src="${productImg}" alt="${product.name}" loading="lazy">
        ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ''}
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.name}</h3>
        <p class="product-desc" style="display: none;">${product.desc}</p>
        <div class="product-footer">
          <span class="product-price">฿${product.price}</span>
          <button class="btn-action-sm btn-view-detail" data-id="${product.id}" title="ดูรายละเอียด">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Click on product image specifically opens the fullscreen lightbox
    const imgWrapper = card.querySelector('.product-img-wrapper');
    if (imgWrapper) {
      imgWrapper.addEventListener('click', (e) => {
        e.stopPropagation(); // Don't trigger the card's click event (which opens the detail modal)
        openLightbox(productImg, product.name);
      });
    }

    // Click on card to open detail modal
    card.addEventListener('click', (e) => {
      // Don't open detail if clicking action button directly (though we can open detail for both)
      openProductDetail(product.id);
    });

    productsGrid.appendChild(card);
  });
}

// Open Detail Modal
function openProductDetail(id) {
  const product = PRODUCTS.find(p => p.id === id);
  if (!product) return;

  activeProduct = product;

  const productImg = getOptimizedImageUrl(product.img);

  modalContent.innerHTML = `
    <img class="modal-img" src="${productImg}" alt="${product.name}">
    <h2 class="modal-title">${product.name}</h2>
    <span class="modal-tag">${product.tag || 'สินค้าคุณภาพ'}</span>
    <div class="modal-footer">
      <div>
        <p class="modal-price-label">ราคา</p>
        <span class="modal-price">฿${product.price}</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; background: var(--bg-card, #f5f5f5); border-radius: 12px; padding: 4px 8px;">
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
          <button class="btn-primary" id="btnAddToCart">
            🛒 ใส่ตะกร้า
          </button>
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
    modalQtyVal++; modalQtyEl.textContent = modalQtyVal;
  });

  document.getElementById('btnAddToCart').addEventListener('click', (e) => {
    e.stopPropagation();
    addToCart(product, modalQtyVal);
    closeModal();
  });

  // Click on the modal image to view in fullscreen lightbox
  const modalImg = modalContent.querySelector('.modal-img');
  if (modalImg) {
    modalImg.addEventListener('click', () => {
      openLightbox(productImg, product.name);
    });
  }

  modal.classList.add('show');
}

// Close Modal
function closeModal() {
  modal.classList.remove('show');
  activeProduct = null;
}

// Open Lightbox for Fullscreen Image View
function openLightbox(imgSrc, name) {
  if (lightboxImg && lightboxCaption && lightbox) {
    lightboxImg.src = imgSrc;
    lightboxCaption.textContent = name;
    lightbox.classList.add('show');
  }
}

// Close Lightbox
function closeLightbox() {
  if (lightbox) {
    lightbox.classList.remove('show');
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
  const message = `สนใจสอบถามข้อมูลสินค้าชิ้นนี้ครับ:\n☕ ${product.name}\n💰 ราคา: ฿${product.price}`;

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
  const existingItem = cart.find(item => item.id === product.id);
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
        <button class="btn-qty-adjust" onclick="adjustQty(${item.id}, -1)">-</button>
        <span class="cart-item-qty">${item.qty}</span>
        <button class="btn-qty-adjust" onclick="adjustQty(${item.id}, 1)">+</button>
        <button class="btn-cart-remove" onclick="removeCartItem(${item.id})" title="ลบรายการ">
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
}

function closeCartModal() {
  cartModal.classList.remove('show');
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
    if (addresses.length > 5) addresses.pop(); // เก็บสูงสุด 5 ที่อยู่
    saveSavedAddresses(addresses);
  }
}

function deleteSavedAddress(index) {
  const addresses = getSavedAddresses();
  addresses.splice(index, 1);
  saveSavedAddresses(addresses);
}

function toggleShippingFields() {
  const shippingOption = document.querySelector('input[name="shippingOption"]:checked')?.value || 'จัดส่ง';
  const savedAddressesSection = document.getElementById('savedAddressesSection');
  const newAddressSection = document.getElementById('newAddressSection');

  if (shippingOption === 'รับหน้าร้าน') {
    if (savedAddressesSection) savedAddressesSection.style.display = 'none';
    if (newAddressSection) newAddressSection.style.display = 'none';
  } else {
    const savedAddresses = getSavedAddresses();
    if (savedAddresses.length > 0 && selectedSavedAddressIndex !== -1) {
      if (savedAddressesSection) savedAddressesSection.style.display = 'block';
      if (newAddressSection) newAddressSection.style.display = 'none';
    } else {
      if (savedAddressesSection) savedAddressesSection.style.display = 'none';
      if (newAddressSection) newAddressSection.style.display = 'block';
    }
  }
  validateCheckoutForm();
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

    // ดึงพิกัดจาก GPS URL
    let coordsText = '';
    if (addr.gpsLocation) {
      const coords = parseCoords(addr.gpsLocation);
      if (coords) coordsText = `📍 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    }

    card.innerHTML = `
      <div class="address-label">
        <span class="address-icon">${getAddressIcon(addr.label)}</span>
        ${addr.label || 'ที่อยู่ #' + (idx + 1)}
      </div>
      <div class="address-detail">${addr.addressDetails || '-'}</div>
      ${coordsText ? `<div class="address-gps">${coordsText}</div>` : ''}
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

    console.log(`[SavedAddress] Re-rendering list with selected index: ${selectedSavedAddressIndex}`);
    renderSavedAddresses();
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

function openCheckoutModal() {
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  document.getElementById('checkoutTotalText').textContent = `฿${totalAmount}`;

  // Prefill default info from member profile
  document.getElementById('checkoutName').value = currentMemberInfo.displayName || '';
  document.getElementById('checkoutPhone').value = currentMemberInfo.phone || '';

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

  // Reset address label + checkbox
  const addressLabelInput = document.getElementById('addressLabel');
  if (addressLabelInput) addressLabelInput.value = '';
  const chkSave = document.getElementById('chkSaveAddress');
  if (chkSave) chkSave.checked = true;

  // Reset map marker
  if (mapMarker && mapInstance) {
    mapInstance.removeLayer(mapMarker);
    mapMarker = null;
  }
  const instructionOverlay = document.getElementById('mapInstructionOverlay');
  if (instructionOverlay) instructionOverlay.classList.remove('hidden');

  // โหลดที่อยู่ที่บันทึกไว้
  const savedAddresses = getSavedAddresses();
  if (savedAddresses.length > 0) {
    selectedSavedAddressIndex = 0; // Default to first saved address
    setTimeout(() => { selectSavedAddress(0); }, 50);
  } else {
    selectedSavedAddressIndex = -1;
    // หากไม่มีที่อยู่เซฟใน LocalStorage ให้ลองดึงจาก member profile ใน Google Sheet
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
    renderSavedAddresses();
  }

  toggleShippingFields();

  checkoutModal.classList.add('show');

  // สร้าง/รีเฟรช Map Picker หลังจาก modal แสดงเสร็จ
  setTimeout(() => {
    initMapPicker();
  }, 450);
}

function closeCheckoutModal() {
  checkoutModal.classList.remove('show');
}

function validateCheckoutForm() {
  const name = document.getElementById('checkoutName').value.trim();
  const phone = document.getElementById('checkoutPhone').value.trim();

  // ตรวจสอบการสั่งล่วงหน้า
  const deliveryType = document.querySelector('input[name="deliveryType"]:checked')?.value || 'ทันที';
  let isPreorderValid = true;
  if (deliveryType === 'ล่วงหน้า') {
    const preorderDate = document.getElementById('preorderDate').value;
    const preorderTime = document.getElementById('preorderTime').value;
    isPreorderValid = preorderDate !== "" && preorderTime !== null && preorderTime !== "";
  }

  // Valid if Name and Phone are filled, and if preorder, date and time are selected
  const isValid = name !== "" && phone !== "" && isPreorderValid;
  btnSubmitOrder.disabled = !isValid;
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
        if (phoneInput && !phoneInput.value) phoneInput.value = currentMemberInfo.phone;
      }
    }
  } catch (e) { }

  // 2. ดึงข้อมูลจริงจาก Server เบื้องหลัง แล้วอัปเดต cache
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?userId=${userId}`);
    const data = await res.json();
    if (data.status === 'success' && data.found) {
      currentMemberInfo = {
        displayName: data.displayName || '',
        phone: data.phone || '',
        gpsLocation: data.gpsLocation || '',
        addressDetails: data.addressDetails || '',
        addressLabel: data.addressLabel || ''
      };

      // ซิงค์ saved addresses จาก Google Sheet ลง LocalStorage เพื่อให้ลูกค้ามีที่อยู่ใช้บนทุกอุปกรณ์
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
            if (merged.length > 5) {
              merged.splice(5);
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
      if (phoneInput) phoneInput.value = currentMemberInfo.phone;
      validateCheckoutForm();
    }
  } catch (e) {
    console.error('Error fetching member info:', e);
  }
}


async function sendOrderFlexMessage(orderId, name, phone, totalPrice, cartItems = [], deliveryType = 'ทันที', preorderTime = '', shippingOption = 'จัดส่ง') {
  // สร้างรายการสินค้าสำหรับ Flex Message
  const itemBoxes = cartItems.map(item => ({
    type: "box",
    layout: "horizontal",
    margin: "md",
    spacing: "md",
    contents: [
      {
        type: "image",
        url: (item.image && item.image.startsWith('http')) ? item.image : "https://placehold.co/600x600/f3f0ec/a88b62.png?text=No+Image",
        size: "sm",
        aspectRatio: "1:1",
        aspectMode: "cover",
        flex: 1
      },
      {
        type: "box",
        layout: "vertical",
        flex: 3,
        contents: [
          {
            type: "text",
            text: `รหัส: ${item.id}`,
            size: "xxs",
            color: "#aaaaaa"
          },
          {
            type: "text",
            text: item.name,
            size: "sm",
            wrap: true,
            weight: "bold",
            color: "#1a202c"
          },
          {
            type: "text",
            text: `${item.qty} x ฿${item.price}`,
            size: "sm",
            color: "#388BC2"
          }
        ]
      }
    ]
  }));

  const flexPayload = {
    type: "flex",
    altText: `🧾 สั่งซื้อใหม่ ${orderId}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🛒 คำสั่งซื้อใหม่ (รอตรวจสอบ)",
            weight: "bold",
            size: "xl",
            color: "#388BC2"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เลขที่สั่งซื้อ", size: "sm", color: "#aaaaaa", flex: 2 },
                  { type: "text", text: orderId, size: "sm", color: "#1a202c", flex: 4, weight: "bold" }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ผู้รับ", size: "sm", color: "#aaaaaa", flex: 2 },
                  { type: "text", text: name, size: "sm", color: "#1a202c", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เบอร์ติดต่อ", size: "sm", color: "#aaaaaa", flex: 2 },
                  { type: "text", text: phone, size: "sm", color: "#1a202c", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "การรับสินค้า", size: "sm", color: "#aaaaaa", flex: 2 },
                  { type: "text", text: shippingOption === 'รับหน้าร้าน' ? "🏪 รับสินค้าเองที่หน้าร้าน" : "🚚 จัดส่งตามที่อยู่", size: "sm", color: "#1a202c", flex: 4, weight: "bold" }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เวลาส่ง/รับ", size: "sm", color: "#aaaaaa", flex: 2 },
                  { type: "text", text: deliveryType === 'ล่วงหน้า' ? `🕒 สั่งล่วงหน้า (${preorderTime} น.)` : "🚀 ส่งทันที (ด่วนที่สุด)", size: "sm", color: "#e11d48", flex: 4, weight: "bold", wrap: true }
                ]
              },
              { type: "separator", margin: "md" },
              // ใส่รายการสินค้าที่นี่
              ...itemBoxes,
              { type: "separator", margin: "md" },
              {
                type: "box",
                layout: "horizontal",
                margin: "md",
                contents: [
                  { type: "text", text: "ยอดเงินรวม", size: "md", color: "#1a202c", weight: "bold", flex: 3 },
                  { type: "text", text: `฿${totalPrice}`, size: "md", color: "#388BC2", weight: "bold", align: "right", flex: 3 }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "แอดมินกำลังตรวจสอบคำสั่งซื้อและหลักฐานการโอนเงิน กรุณารอสักครู่ครับ 😊",
            size: "xs",
            color: "#aaaaaa",
            wrap: true,
            align: "center",
            margin: "sm"
          }
        ]
      }
    }
  };

  try {
    await liff.sendMessages([flexPayload]);
  } catch (err) {
    console.error("Error sending order Flex Message:", err);
    // Fallback: สร้างข้อความแสดงรายการสินค้า
    let itemsText = cartItems.map(item => `- [${item.id}] ${item.name} (x${item.qty})`).join('\n');
    try {
      await liff.sendMessages([{
        type: 'text',
        text: `🛒 คำสั่งซื้อใหม่\nรหัส: ${orderId}\nผู้รับ: ${name}\nเบอร์: ${phone}\n\nรายการสินค้า:\n${itemsText}\n\nยอดรวม: ฿${totalPrice}`
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
    loadMyOrders();
  }
}

function closeOrdersModal() {
  if (ordersModal) {
    ordersModal.classList.remove('show');
  }
}

if (btnOrders) btnOrders.addEventListener('click', openOrdersModal);
if (btnCloseOrdersModal) btnCloseOrdersModal.addEventListener('click', closeOrdersModal);

if (ordersModal) {
  ordersModal.addEventListener('click', (e) => {
    if (e.target === ordersModal) closeOrdersModal();
  });
}

async function loadMyOrders() {
  const ordersBody = document.getElementById('ordersModalBody');
  if (!ordersBody) return;

  // ฟังก์ชันแยกสำหรับวาด UI
  const renderOrdersUI = (orders) => {
    if (orders && orders.length > 0) {
      ordersBody.innerHTML = '';
      orders.forEach(order => {
        let statusColor = '#aaaaaa';
        if (order.status === 'รอตรวจสอบ') statusColor = '#f59e0b';
        else if (order.status === 'ยืนยันแล้ว' || order.status === 'จัดส่งแล้ว' || order.status === 'กำลังจัดส่ง') statusColor = '#10b981';
        else if (order.status === 'รอชำระเงิน') statusColor = '#3b82f6';
        else if (order.status === 'ยกเลิก') statusColor = '#ef4444';

        const dateObj = new Date(order.timestamp);
        const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('th-TH') : order.timestamp;

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
        `;
        ordersBody.appendChild(row);
      });
    } else {
      ordersBody.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
          ไม่พบประวัติการสั่งซื้อของคุณ
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
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getMyOrders&userId=${userId}`);
    const data = await res.json();

    if (data.status === 'success') {
      // เซฟทับ Cache ด้วยข้อมูลใหม่สุด
      localStorage.setItem('myOrdersCache', JSON.stringify(data.orders || []));
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

// Cart Modal Backdrop Close
if (cartModal) {
  cartModal.addEventListener('click', (e) => {
    if (e.target === cartModal) closeCartModal();
  });
}

// Checkout Modal Backdrop Close
if (checkoutModal) {
  checkoutModal.addEventListener('click', (e) => {
    if (e.target === checkoutModal) closeCheckoutModal();
  });
}

// GPS Location + Interactive Map Pin Dropping
let mapInstance = null;
let mapMarker = null;
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

// อัปเดตตำแหน่งหมุดบนแผนที่ + อัปเดต GPS Link + แสดงสถานะ
function updateMapPin(lat, lng, flyTo = true) {
  const gpsLinkInput = document.getElementById('gpsLocationLink');
  const statusBadge = document.getElementById('locationStatus');
  const instructionOverlay = document.getElementById('mapInstructionOverlay');

  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  gpsLinkInput.value = mapUrl;

  statusBadge.textContent = `📍 ปักหมุดพิกัดสำเร็จ (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  statusBadge.className = 'location-status-badge success';

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

        mapMarker.bindPopup('<b>📍 ตำแหน่งจัดส่ง</b><br>ลากหมุดเพื่อปรับตำแหน่ง').openPopup();
      }

      if (flyTo) {
        mapInstance.flyTo([lat, lng], 16, { duration: 1 });
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

  // ตำแหน่งเริ่มต้น (กรุงเทพ)
  const defaultLat = 13.7563;
  const defaultLng = 100.5018;

  mapInstance = L.map('mapPicker', {
    center: [defaultLat, defaultLng],
    zoom: 13,
    zoomControl: true,
    attributionControl: false
  });

  // ใช้ OpenStreetMap Tiles (ฟรี)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapInstance);

  // คลิกบนแผนที่เพื่อปักหมุด
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
if (checkoutPhone) checkoutPhone.addEventListener('input', validateCheckoutForm);
if (checkoutAddressDetails) checkoutAddressDetails.addEventListener('input', validateCheckoutForm);
if (preorderDateInput) preorderDateInput.addEventListener('change', validateCheckoutForm);
if (preorderTimeSelect) preorderTimeSelect.addEventListener('change', validateCheckoutForm);

// Submit Order to Google Sheets
if (btnSubmitOrder) {
  btnSubmitOrder.addEventListener('click', async () => {
    const name = checkoutName.value.trim();
    const phone = checkoutPhone.value.trim();

    const shippingOption = document.querySelector('input[name="shippingOption"]:checked')?.value || 'จัดส่ง';
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

    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    btnSubmitOrder.disabled = true;
    btnSubmitOrder.textContent = '⏳ กำลังบันทึกคำสั่งซื้อ...';

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
      totalPrice: totalAmount,
      deliveryType: deliveryType,
      preorderTime: preorderTimeStr,
      shippingOption: shippingOption,
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
          totalPrice: totalAmount,
          status: 'รอตรวจสอบ'
        });
        localStorage.setItem('myOrdersCache', JSON.stringify(cachedOrders));
      } catch (e) { }

      // บันทึกที่อยู่ใหม่ (ถ้าเลือก checkbox บันทึก + ไม่ได้ใช้ที่อยู่เดิม)
      const chkSave = document.getElementById('chkSaveAddress');
      if (chkSave && chkSave.checked && selectedSavedAddressIndex === -1 && gpsLocation && shippingOption !== 'รับหน้าร้าน') {
        const addressLabelInput = document.getElementById('addressLabel');
        const label = (addressLabelInput ? addressLabelInput.value.trim() : '') || 'ที่อยู่ของฉัน';
        addSavedAddress({
          label: label,
          gpsLocation: gpsLocation,
          addressDetails: addressDetails
        });
      }

      // ถือว่าสั่งซื้อสำเร็จทันที (Instant feedback) ทำให้แอพลื่นไหล ไม่ค้าง
      alert(`✅ ส่งออเดอร์ให้แอดมินตรวจสอบเรียบร้อยแล้ว!\nหมายเลขสั่งซื้อของคุณคือ: ${orderId}`);

      // ส่งข้อความ Flex Message แจ้งรายละเอียดคำสั่งซื้อในห้องแชท LINE
      if (liff.isInClient()) {
        await sendOrderFlexMessage(orderId, name, phone, totalAmount, cart, deliveryType, preorderTimeStr, shippingOption);
      }

      // เคลียร์ตะกร้าและปิด Modal ทันที
      clearCart();
      closeCheckoutModal();
      closeCartModal();

      btnSubmitOrder.disabled = false;
      btnSubmitOrder.textContent = 'ยืนยันการสั่งซื้อและส่งข้อมูล';

      // เปิดหน้าต่างประวัติคำสั่งซื้ออัตโนมัติ (หน่วงเวลาเล็กน้อยเพื่อให้ระบบส่งข้อมูลเสร็จก่อน)
      setTimeout(() => {
        openOrdersModal();
      }, 500);

    } catch (error) {
      console.error('Checkout error:', error);
      alert('❌ เกิดข้อผิดพลาดในระบบแอปพลิเคชัน กรุณาลองใหม่อีกครั้ง');
      btnSubmitOrder.disabled = false;
      btnSubmitOrder.textContent = 'ยืนยันการสั่งซื้อและส่งข้อมูล';
    }
  });
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  visibleLimit = 20; // รีเซ็ตหน้าแรกเมื่อค้นหาใหม่
  renderProducts();
});

// === MULTI-LEVEL DYNAMIC CATEGORIES SYSTEM ===

function parseProductCategory(categoryStr) {
  if (!categoryStr) return { parent: 'ทั่วไป', sub: 'ทั้งหมด' };

  const trimmed = categoryStr.trim();
  const lower = trimmed.toLowerCase();

  // Custom mapping for mock data & standard English names
  if (lower === 'coffee') return { parent: 'เครื่องดื่ม', sub: 'กาแฟ' };
  if (lower === 'tea') return { parent: 'เครื่องดื่ม', sub: 'ชา' };
  if (lower === 'bakery') return { parent: 'เบเกอรี่', sub: 'เบเกอรี่' };
  if (lower === 'food') return { parent: 'อาหาร', sub: 'ทั่วไป' };
  if (lower === 'dessert') return { parent: 'ของหวาน', sub: 'ทั่วไป' };

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
  parentNav.innerHTML = '';

  // All Parent Tab
  const allParentTab = document.createElement('button');
  allParentTab.className = `category-tab ${currentParentCategory === 'all' ? 'active' : ''}`;
  allParentTab.textContent = 'ทั้งหมด';
  allParentTab.addEventListener('click', () => {
    selectParentCategory('all');
  });
  parentNav.appendChild(allParentTab);

  // Render parent tabs
  Object.keys(categoryTree).forEach(parent => {
    if (parent === 'all') return;
    const tab = document.createElement('button');
    tab.className = `category-tab ${currentParentCategory === parent ? 'active' : ''}`;
    tab.textContent = parent;
    tab.addEventListener('click', () => {
      selectParentCategory(parent);
    });
    parentNav.appendChild(tab);
  });

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

  subNav.style.display = 'flex';
  subNav.innerHTML = '';

  // Add "ทั้งหมด" for subcategory
  const allSubTab = document.createElement('button');
  allSubTab.className = `category-tab ${currentSubCategory === 'all' ? 'active' : ''}`;
  allSubTab.textContent = 'ทั้งหมด';
  allSubTab.addEventListener('click', () => {
    selectSubCategory('all');
  });
  subNav.appendChild(allSubTab);

  // Add individual subcategories
  categoryTree[currentParentCategory].forEach(sub => {
    if (sub === 'ทั้งหมด') return; // Skip if 'ทั้งหมด' was added as a string
    const tab = document.createElement('button');
    tab.className = `category-tab ${currentSubCategory === sub ? 'active' : ''}`;
    tab.textContent = sub;
    tab.addEventListener('click', () => {
      selectSubCategory(sub);
    });
    subNav.appendChild(tab);
  });
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

// Infinite Scroll - โหลดสินค้าเพิ่มทีละ 20 รายการเมื่อเลื่อนจอถึงด้านล่าง
window.addEventListener('scroll', () => {
  // หากแสดงสินค้าครบทั้งหมดในระบบแล้ว ไม่ต้องทำอะไรเพิ่ม
  if (visibleLimit >= PRODUCTS.length) return;

  // ตรวจสอบว่าเลื่อนหน้าจอลงมาใกล้ถึงด้านล่าง (ห่างจากขอบล่าง 250px)
  if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 250) {
    visibleLimit += 20;
    renderProducts();
  }
});

// Modal Close logic
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

document.getElementById('btnCloseModal').addEventListener('click', closeModal);

// Lightbox Close logic
if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    // Close if clicking outside the image (i.e. background)
    if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
      closeLightbox();
    }
  });
}

if (btnCloseLightbox) {
  btnCloseLightbox.addEventListener('click', closeLightbox);
}

// Back to Home
btnBack.addEventListener('click', () => {
  window.location.href = 'index.html';
});


// ===== โหลดสินค้าแยกออกมา ทำงานได้ทันทีโดยไม่ต้องรอ LIFF =====
async function loadProducts() {
  // 1. โชว์สินค้าจาก Cache ทันที (0ms) ถ้ามี
  const cachedData = localStorage.getItem('catalog_products_cache');
  const cachedTime = localStorage.getItem('catalog_products_cache_time');
  const cacheDuration = 15 * 60 * 1000; // Cache นาน 15 นาที (เพิ่มจาก 3 นาที)

  let hasValidCache = false;
  if (cachedData && cachedTime) {
    try {
      const parsed = JSON.parse(cachedData);
      if (parsed && parsed.length > 0) {
        PRODUCTS = parsed;
        hasValidCache = true;
        initCategoryFilters();
        renderProducts(); // แสดงผลทันทีจาก cache
      }
    } catch (e) { }
  }

  // 2. ถ้ายังไม่มี cache ให้แสดง loading
  if (!hasValidCache && productsGrid) {
    productsGrid.innerHTML = `
      <div class="loading-state" style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-light);">
        <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 12px; display: block;">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
        <span>กำลังโหลดเมนูสินค้า...</span>
      </div>
    `;
  }

  // 3. ดึงข้อมูลใหม่จาก Google Sheets ถ้า cache หมดอายุหรือยังไม่มี
  const shouldFetchFresh = !hasValidCache || (Date.now() - Number(cachedTime) > cacheDuration);
  if (shouldFetchFresh) {
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts`);
      const data = await response.json();
      if (data.status === 'success') {
        const freshProducts = data.products || [];
        if (JSON.stringify(freshProducts) !== JSON.stringify(PRODUCTS)) {
          PRODUCTS = freshProducts;
          initCategoryFilters();
          renderProducts();
        }
        localStorage.setItem('catalog_products_cache', JSON.stringify(PRODUCTS));
        localStorage.setItem('catalog_products_cache_time', String(Date.now()));
      } else if (PRODUCTS.length === 0) {
        PRODUCTS = getMockProducts();
        initCategoryFilters();
        renderProducts();
      }
    } catch (error) {
      console.error('Fetch error:', error);
      if (PRODUCTS.length === 0) {
        PRODUCTS = getMockProducts();
        initCategoryFilters();
        renderProducts();
      }
    }
  }
}

// Start application — โหลดสินค้าและ LIFF พร้อมกัน ไม่รอกัน
async function start() {
  loadCart();

  // รัน loadProducts() และ initLiff() พร้อมกันทันที ไม่รอกัน
  const [,] = await Promise.all([
    loadProducts(),
    initLiff()
  ]);

  // Check if URL has a specific product query param (deep link)
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product');
  if (productId) {
    openProductDetail(parseInt(productId, 10));
  }
}

start();

