// Replace with your deployed Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbymvaScHSDps1xC6DEQFoQj8NrP4Wr5qqrOxLtaw291IzgUz3Wuj38o2ijHF9cNAhha/exec';

let PRODUCTS = [];

// Helper สำหรับปรับแต่ง URL รูปภาพเพื่อประสิทธิภาพสูงสุด (แปลงเป็น WebP และย่อขนาดหากมี CDN รองรับ)
function getOptimizedImageUrl(url) {
  if (!url || !url.trim().startsWith('http')) {
    return 'https://placehold.co/600x600/f3f0ec/a88b62?text=No+Image';
  }

  let optimizedUrl = url.trim();

  // สำหรับรูป Unsplash (ที่ใช้ในระบบและตัวอย่าง) บังคับแปลงเป็น WebP และจำกัดความกว้างสูงสุด 600px
  if (optimizedUrl.includes('unsplash.com')) {
    optimizedUrl = optimizedUrl.replace(/auto=[a-z]+/g, 'format=webp');
    optimizedUrl = optimizedUrl.replace(/fm=[a-z]+/g, 'fm=webp');
    if (!optimizedUrl.includes('format=webp') && !optimizedUrl.includes('fm=webp')) {
      optimizedUrl += (optimizedUrl.includes('?') ? '&' : '?') + 'format=webp';
    }
    if (!optimizedUrl.includes('w=')) {
      optimizedUrl += '&w=600';
    }
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

let currentCategory = 'all';
let searchQuery = '';
let activeProduct = null;
let visibleLimit = 20; // จำกัดจำนวนการแสดงผลในครั้งแรกเพื่อความรวดเร็ว (Pagination)
let cart = [];
let slipBase64 = "";
let currentMemberInfo = { displayName: '', phone: '' };

// Elements
const productsGrid = document.getElementById('productsGrid');
const searchInput = document.getElementById('searchInput');
const categoryTabs = document.querySelectorAll('.category-tab');
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
const btnTriggerUpload = document.getElementById('btnTriggerUpload');
const btnRemoveSlip = document.getElementById('btnRemoveSlip');
const btnSubmitOrder = document.getElementById('btnSubmitOrder');
const slipInput = document.getElementById('slipInput');
const slipPreviewContainer = document.getElementById('slipPreviewContainer');
const slipPreviewImg = document.getElementById('slipPreviewImg');

// Initialize LIFF
async function initLiff() {
  try {
    await liff.init({ liffId: '2010169713-ao0dtP3R' });
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
    const matchesCategory = currentCategory === 'all' || product.category === currentCategory;
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
        <p class="product-desc">${product.desc}</p>
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
    <p class="modal-desc">${product.desc}</p>
    <div class="modal-footer">
      <div>
        <p class="modal-price-label">ราคา</p>
        <span class="modal-price">฿${product.price}</span>
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

  document.getElementById('btnAddToCart').addEventListener('click', (e) => {
    e.stopPropagation();
    addToCart(product);
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
  alert(`เพิ่ม "${product.name}" ลงในตะกร้าเรียบร้อย!`);
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

function openCheckoutModal() {
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  document.getElementById('checkoutTotalText').textContent = `฿${totalAmount}`;

  // Prefill default info from member profile
  document.getElementById('checkoutName').value = currentMemberInfo.displayName || '';
  document.getElementById('checkoutPhone').value = currentMemberInfo.phone || '';

  // Reset location & slip
  document.getElementById('gpsLocationLink').value = '';
  document.getElementById('locationStatus').textContent = 'ยังไม่ได้ปักหมุดตำแหน่งที่ตั้ง';
  document.getElementById('locationStatus').className = 'location-status-badge';

  slipInput.value = '';
  slipBase64 = "";
  slipPreviewImg.src = "";
  slipPreviewContainer.style.display = 'none';

  generatePromptPayQR(totalAmount);
  validateCheckoutForm();

  checkoutModal.classList.add('show');
}

function closeCheckoutModal() {
  checkoutModal.classList.remove('show');
}

function validateCheckoutForm() {
  const name = document.getElementById('checkoutName').value.trim();
  const phone = document.getElementById('checkoutPhone').value.trim();
  const address = document.getElementById('checkoutAddressDetails').value.trim();

  // Valid if Name, Phone, Address details are filled AND slip image is uploaded
  const isValid = name !== "" && phone !== "" && address !== "" && slipBase64 !== "";
  btnSubmitOrder.disabled = !isValid;
}

async function fetchMemberInfo(userId) {
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?userId=${userId}`);
    const data = await res.json();
    if (data.status === 'success' && data.found) {
      currentMemberInfo = {
        displayName: data.displayName || '',
        phone: data.phone || ''
      };

      // Update form fields if elements exist
      const nameInput = document.getElementById('checkoutName');
      const phoneInput = document.getElementById('checkoutPhone');
      if (nameInput) nameInput.value = currentMemberInfo.displayName;
      if (phoneInput) phoneInput.value = currentMemberInfo.phone;
    }
  } catch (e) {
    console.error('Error fetching member info:', e);
  }
}

function generatePromptPayQR(totalAmount) {
  const qrImg = document.getElementById('qrCodeImg');
  const qrLoading = document.getElementById('qrLoading');

  if (!SHOP_PROMPTPAY_ID || SHOP_PROMPTPAY_ID === '0800000000') {
    qrLoading.textContent = '⚠️ ยังไม่ได้กำหนดเบอร์ PromptPay ของร้านค้า';
    qrImg.style.display = 'none';
    return;
  }

  qrLoading.style.display = 'block';
  qrLoading.textContent = 'กำลังสร้าง QR Code...';
  qrImg.style.display = 'none';

  const qrUrl = `https://promptpay.io/${SHOP_PROMPTPAY_ID}/${totalAmount}.png`;

  qrImg.onload = () => {
    qrLoading.style.display = 'none';
    qrImg.style.display = 'block';
  };
  qrImg.onerror = () => {
    qrLoading.textContent = '⚠️ ไม่สามารถสร้าง QR Code ได้';
  };
  qrImg.src = qrUrl;
}

async function sendOrderFlexMessage(orderId, name, phone, totalPrice) {
  const flexPayload = {
    type: "flex",
    altText: `🧾 ยืนยันการสั่งซื้อใหม่ ${orderId}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🛒 สั่งซื้อสินค้าสำเร็จ",
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
                  {
                    type: "text",
                    text: "เลขที่สั่งซื้อ",
                    size: "sm",
                    color: "#aaaaaa",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: orderId,
                    size: "sm",
                    color: "#1a202c",
                    flex: 4,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "ผู้รับ",
                    size: "sm",
                    color: "#aaaaaa",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: name,
                    size: "sm",
                    color: "#1a202c",
                    flex: 4
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "เบอร์ติดต่อ",
                    size: "sm",
                    color: "#aaaaaa",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: phone,
                    size: "sm",
                    color: "#1a202c",
                    flex: 4
                  }
                ]
              },
              {
                type: "separator",
                margin: "md"
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "md",
                contents: [
                  {
                    type: "text",
                    text: "ยอดเงินรวม",
                    size: "md",
                    color: "#1a202c",
                    weight: "bold",
                    flex: 3
                  },
                  {
                    type: "text",
                    text: `฿${totalPrice}`,
                    size: "md",
                    color: "#388BC2",
                    weight: "bold",
                    align: "right",
                    flex: 3
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "เจ้าหน้าที่กำลังตรวจสอบหลักฐานการชำระเงินของคุณ ขอบคุณครับ 😊",
            size: "xs",
            color: "#aaaaaa",
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

// GPS Location Geolocation Pinning
if (btnGetLocation) {
  btnGetLocation.addEventListener('click', () => {
    const statusBadge = document.getElementById('locationStatus');
    const gpsLinkInput = document.getElementById('gpsLocationLink');

    statusBadge.textContent = '📍 กำลังดึงพิกัด GPS...';
    statusBadge.className = 'location-status-badge';

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

          gpsLinkInput.value = mapUrl;
          statusBadge.textContent = `📍 ปักหมุดพิกัดสำเร็จ (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
          statusBadge.className = 'location-status-badge success';
          validateCheckoutForm();
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

// Slip upload interactions
if (btnTriggerUpload) {
  btnTriggerUpload.addEventListener('click', () => {
    slipInput.click();
  });
}

if (slipInput) {
  slipInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('ขนาดไฟล์รูปภาพใหญ่เกินไป (จำกัดไม่เกิน 3MB)');
      slipInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      slipBase64 = event.target.result;
      slipPreviewImg.src = slipBase64;
      slipPreviewContainer.style.display = 'block';
      validateCheckoutForm();
    };
    reader.readAsDataURL(file);
  });
}

if (btnRemoveSlip) {
  btnRemoveSlip.addEventListener('click', () => {
    slipInput.value = '';
    slipBase64 = "";
    slipPreviewImg.src = "";
    slipPreviewContainer.style.display = 'none';
    validateCheckoutForm();
  });
}

// Checkout input validations
const checkoutName = document.getElementById('checkoutName');
const checkoutPhone = document.getElementById('checkoutPhone');
const checkoutAddressDetails = document.getElementById('checkoutAddressDetails');

if (checkoutName) checkoutName.addEventListener('input', validateCheckoutForm);
if (checkoutPhone) checkoutPhone.addEventListener('input', validateCheckoutForm);
if (checkoutAddressDetails) checkoutAddressDetails.addEventListener('input', validateCheckoutForm);

// Submit Order to Google Sheets
if (btnSubmitOrder) {
  btnSubmitOrder.addEventListener('click', async () => {
    const name = checkoutName.value.trim();
    const phone = checkoutPhone.value.trim();
    const addressDetails = checkoutAddressDetails.value.trim();
    const gpsLocation = document.getElementById('gpsLocationLink').value.trim();

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

    const orderPayload = {
      action: 'createOrder',
      userId: userId,
      displayName: displayName,
      phone: phone,
      gpsLocation: gpsLocation,
      addressDetails: addressDetails,
      totalPrice: totalAmount,
      slipImage: slipBase64,
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty
      }))
    };

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(orderPayload)
      });
      const result = await response.json();

      if (result.status === 'success') {
        alert(`🎉 สั่งซื้อสินค้าสำเร็จ!\nหมายเลขสั่งซื้อของคุณคือ: ${result.orderId}`);

        // ส่งข้อความ Flex Message แจ้งรายละเอียดคำสั่งซื้อในห้องแชท LINE
        if (liff.isInClient()) {
          await sendOrderFlexMessage(result.orderId, name, phone, totalAmount);
        }

        // เคลียร์ตะกร้าสินค้า
        clearCart();

        // ปิด Modal
        closeCheckoutModal();
        closeCartModal();
      } else {
        alert('❌ การสั่งซื้อล้มเหลว: ' + result.message);
        btnSubmitOrder.disabled = false;
        btnSubmitOrder.textContent = 'ยืนยันการสั่งซื้อและส่งข้อมูล';
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
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

categoryTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    // Remove active from all
    categoryTabs.forEach(t => t.classList.remove('active'));

    // Add to current
    tab.classList.add('active');
    currentCategory = tab.dataset.category;
    visibleLimit = 20; // รีเซ็ตหน้าแรกเมื่อเปลี่ยนหมวดหมู่

    renderProducts();
  });
});

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

// Start application
async function start() {
  await initLiff();
  loadCart();

  // 1. ตรวจสอบข้อมูลจาก Cache เพื่อการโหลดที่เร็วที่สุดในหลักมิลลิวินาที (Stale-While-Revalidate)
  const cachedData = localStorage.getItem('catalog_products_cache');
  const cachedTime = localStorage.getItem('catalog_products_cache_time');
  const cacheDuration = 3 * 60 * 1000; // ตั้งค่า Cache ให้มีอายุ 3 นาที

  let hasValidCache = false;
  if (cachedData && cachedTime) {
    try {
      PRODUCTS = JSON.parse(cachedData);
      if (PRODUCTS.length > 0) {
        hasValidCache = true;
        renderProducts(); // เรนเดอร์สินค้าจากแคชทันทีโดยไม่ต้องรอโหลดจากอินเทอร์เน็ต
      }
    } catch (e) {
      console.warn('Failed to parse cached products:', e);
    }
  }

  // 2. หากยังไม่มีข้อมูลในแคชเลย ให้แสดงตัวหมุนโหลดก่อน
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
        <span>กำลังโหลดเมนูสินค้าสุดพิเศษ...</span>
      </div>
    `;
  }

  // 3. ดึงข้อมูลจริงจาก Google Sheets เบื้องหลัง (หรือดึงหลักหากไม่มีแคช)
  const shouldFetchFresh = !hasValidCache || (Date.now() - Number(cachedTime) > cacheDuration);

  if (shouldFetchFresh) {
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts`);
      const data = await response.json();
      if (data.status === 'success') {
        const freshProducts = data.products || [];

        // เปรียบเทียบข้อมูลแคชเดิมและข้อมูลใหม่ หากต่างกันค่อยเรนเดอร์ใหม่ป้องกันหน้าจอกระตุก
        if (JSON.stringify(freshProducts) !== JSON.stringify(PRODUCTS)) {
          PRODUCTS = freshProducts;
          renderProducts();
        }

        // บันทึกลงใน Cache
        localStorage.setItem('catalog_products_cache', JSON.stringify(PRODUCTS));
        localStorage.setItem('catalog_products_cache_time', String(Date.now()));
      } else {
        console.warn('Google Sheets error, using fallback:', data.message);
        if (PRODUCTS.length === 0) {
          PRODUCTS = getMockProducts();
          renderProducts();
        }
      }
    } catch (error) {
      console.error('Fetch error, using fallback:', error);
      if (PRODUCTS.length === 0) {
        PRODUCTS = getMockProducts();
        renderProducts();
      }
    }
  }

  // Check if URL has a specific product query param (deep link)
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product');
  if (productId) {
    openProductDetail(parseInt(productId, 10));
  }
}

start();
