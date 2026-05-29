// Replace with your deployed Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxWJzbFePEBpgz0Vfp1t7bdosRkKLWKU5BifWXdt1mN7Zg9efpqAZrnRLYiHbOUm2VF/exec';

let PRODUCTS = [];

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
let currentCategory = 'all';
let searchQuery = '';
let activeProduct = null;

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

// Initialize LIFF
async function initLiff() {
  try {
    await liff.init({ liffId: '2010169713-ao0dtP3R' });
    console.log('LIFF Initialized in catalog page');
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

  filtered.forEach(product => {
    // ตรวจสอบว่าสินค้ามีรูปภาพหรือไม่ หากไม่มีให้ใช้รูปภาพสัญลักษณ์ No Image สำรองแทน
    const productImg = (product.img && product.img.trim().startsWith('http')) 
      ? product.img.trim() 
      : 'https://placehold.co/600x600/f3f0ec/a88b62?text=No+Image';

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
  
  const productImg = (product.img && product.img.trim().startsWith('http')) 
    ? product.img.trim() 
    : 'https://placehold.co/600x600/f3f0ec/a88b62?text=No+Image';

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
        <button class="btn-outline" id="btnShareProduct">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          แชร์
        </button>
        <button class="btn-primary" id="btnOrderProduct">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4-4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          สอบถาม / สั่งซื้อ
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
                      color: '#a88b62'
                    }
                  ]
                },
                {
                  type: 'text',
                  text: product.desc,
                  wrap: true,
                  color: '#7c7267',
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
                  color: '#c5a880',
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
  const message = `สนใจสั่งซื้อสินค้าชิ้นนี้ครับ:\n☕ ${product.name}\n💰 ราคา: ฿${product.price}\n\nกรุณาแจ้งช่องทางการชำระเงินและข้อมูลจัดส่งด้วยครับ`;
  
  if (liff.isInClient()) {
    try {
      await liff.sendMessages([
        {
          type: 'text',
          text: message
        }
      ]);
      alert('ส่งคำสั่งซื้อของคุณไปยังห้องแชทแล้ว!');
    } catch (error) {
      console.error('Error sending message:', error);
      // Fallback: copy order template or open window
      navigator.clipboard.writeText(message);
      alert('คัดลอกข้อความสั่งซื้อแล้ว คุณสามารถวาง (Paste) ในแชทได้ทันทีครับ:\n\n' + message);
    }
  } else {
    // Web fallback
    navigator.clipboard.writeText(message);
    alert('คัดลอกข้อความสั่งซื้อแล้ว คุณสามารถเปิดแชท LINE เพื่อวางสั่งซื้อได้เลยครับ:\n\n' + message);
  }
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderProducts();
});

categoryTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    // Remove active from all
    categoryTabs.forEach(t => t.classList.remove('active'));
    
    // Add to current
    tab.classList.add('active');
    currentCategory = tab.dataset.category;
    
    renderProducts();
  });
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
  
  // แสดง Loading state ระหว่างดึงข้อมูลสินค้าจาก Sheets
  if (productsGrid) {
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

  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts`);
    const data = await response.json();
    if (data.status === 'success') {
      PRODUCTS = data.products || [];
    } else {
      console.warn('Google Sheets error, using mock data:', data.message);
      PRODUCTS = getMockProducts();
    }
  } catch (error) {
    console.error('Fetch error, using mock data:', error);
    PRODUCTS = getMockProducts();
  }

  renderProducts();
  
  // Check if URL has a specific product query param (deep link)
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product');
  if (productId) {
    openProductDetail(parseInt(productId, 10));
  }
}

start();
