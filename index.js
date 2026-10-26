// CSS ถูกเรียกใช้ผ่าน <link> ใน index.html แล้ว

// Body element
const body = document.querySelector('#body');

// Button elements
const btnSend = document.querySelector('#btnSend');
const btnShare = document.querySelector('#btnShare');
const btnLogIn = document.querySelector('#btnLogIn');
const btnLogOut = document.querySelector('#btnLogOut');
const btnScanCode = document.querySelector('#btnScanCode');
const btnOpenWindow = document.querySelector('#btnOpenWindow');
const btnShortcut = document.querySelector('#btnShortcut');
const btnSaveData = document.querySelector('#btnSaveData');
const btnNextPage = document.querySelector('#btnNextPage');
const btnSavePhoneInline = document.querySelector('#btnSavePhoneInline');
const btnFavoriteOrders = document.querySelector('#btnFavoriteOrders');

// Store profile data temporarily
let userProfileData = null;

// Cloudflare Worker API URL
const GOOGLE_SCRIPT_URL = 'https://kuekoonkan-api.noperfecf.workers.dev';

// Profile elements
const email = document.querySelector('#email');
const userId = document.querySelector('#userId');
const pictureUrl = document.querySelector('#pictureUrl');
const displayName = document.querySelector('#displayName');
const statusMessage = document.querySelector('#statusMessage');
const phone = document.querySelector('#phone');

// QR element
const code = document.querySelector('#code');

// Friendship element
const friendShip = document.querySelector('#friendShip');

// ========================================================
// Helper: ตรวจสอบและจัดรูปแบบเบอร์โทรศัพท์ (Thai Phone Validation)
// ========================================================
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
// 1. โหลดข้อมูลจาก Cache ขึ้นแสดงผลทันที (0 มิลลิวินาที ไม่ต้องรอ Network)
// ========================================================
function restoreCachedProfile() {
  try {
    // ตรวจสอบ cache จาก member_info_cache หรือ kuekoonkan_member_profile
    let cached = localStorage.getItem('kuekoonkan_member_profile');
    if (!cached) {
      cached = localStorage.getItem('member_info_cache');
    }

    if (cached) {
      const data = JSON.parse(cached);
      if (data) {
        if (data.displayName && displayName) {
          displayName.textContent = data.displayName;
        }
        if (data.pictureUrl && pictureUrl) {
          pictureUrl.src = data.pictureUrl;
        }
        if (data.statusMessage && statusMessage) {
          statusMessage.textContent = data.statusMessage;
        }
        if (data.email && email) {
          email.textContent = data.email;
        }
        if (data.userId && userId) {
          const mId = data.userId;
          userId.textContent = mId.length > 8 
            ? mId.substring(0, 5) + '*****' + mId.substring(mId.length - 4) 
            : mId;
        }
        if (data.phone && phone && isValidThaiPhone(data.phone)) {
          phone.value = formatThaiPhoneNumber(data.phone);
          setPhoneInputState(true);
        } else if (phone) {
          phone.value = '';
          setPhoneInputState(false);
        }

        userProfileData = {
          userId: data.userId || 'guest',
          displayName: data.displayName || 'ลูกค้าทั่วไป',
          statusMessage: data.statusMessage || 'ยินดีต้อนรับสมาชิก',
          email: data.email || '',
          phone: data.phone || '',
          pictureUrl: data.pictureUrl || ''
        };
        return true;
      }
    }
  } catch (err) {
    console.warn('Cannot read cached profile:', err);
  }
  return false;
}

// เรียกกู้คืนข้อมูลแคชทันทีที่ไฟล์นี้โหลดเข้ามาในเบราว์เซอร์
restoreCachedProfile();

// ฟังก์ชันจัดการสถานะช่องกรอกเบอร์โทร (ReadOnly หรือแก้ไขได้)
function setPhoneInputState(isReadOnly) {
  if (!phone || !btnSavePhoneInline) return;

  if (isReadOnly) {
    phone.readOnly = true;
    phone.classList.add('readonly-mode');
    btnSavePhoneInline.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    btnSavePhoneInline.title = 'แก้ไขเบอร์โทร';
    btnSavePhoneInline.style.background = 'linear-gradient(135deg, #4a4a4a 0%, #2b2b2b 100%)';
  } else {
    phone.readOnly = false;
    phone.classList.remove('readonly-mode');
    phone.focus();
    btnSavePhoneInline.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    btnSavePhoneInline.title = 'บันทึกเบอร์โทร';
    btnSavePhoneInline.style.background = 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%)';
  }
}

// ========================================================
// 2. เริ่มต้นเชื่อมต่อ LIFF SDK พร้อม Timeout ป้องกันค้าง
// ========================================================
async function main() {
  try {
    if (typeof liff === 'undefined') {
      console.warn('LIFF SDK not found, running in standalone mode');
      fallbackStandalone();
      return;
    }

    // กำหนด Timeout 3.5 วินาที ป้องกันกรณีเครือข่ายช้าแล้วค้างที่หน้าโหลด
    const initPromise = liff.init({ liffId: '2010951634-lg8G4wUA' });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LIFF Init Timeout')), 3500)
    );

    await Promise.race([initPromise, timeoutPromise]);
    await getUserProfile();
  } catch (err) {
    console.warn('LIFF Init Warning:', err);
    fallbackStandalone();
  }
}

// Fallback เมื่อเปิดผ่าน Browser ทั่วไปหรือเชื่อมต่อ LIFF ช้า
function fallbackStandalone() {
  if (!userProfileData) {
    if (displayName && (!displayName.textContent || displayName.textContent === 'กำลังโหลด...')) {
      displayName.textContent = 'ลูกค้าเกื้อกูลกัน';
    }
    if (statusMessage && (!statusMessage.textContent || statusMessage.textContent === 'กำลังโหลด...')) {
      statusMessage.textContent = 'ยินดีต้อนรับคุณลูกค้าทุกท่าน';
    }
    if (email && (!email.textContent || email.textContent === 'กำลังโหลด...')) {
      email.textContent = 'ลูกค้าทั่วไป';
    }
    if (userId && (!userId.textContent || userId.textContent.includes('---'))) {
      userId.textContent = 'MEMBER-LINE';
    }

    const savedPhone = localStorage.getItem('user_phone_default') || '';
    if (phone && !phone.value && savedPhone) {
      phone.value = savedPhone;
      setPhoneInputState(true);
    } else {
      setPhoneInputState(false);
    }

    userProfileData = {
      userId: 'web-user',
      displayName: displayName ? displayName.textContent : 'ลูกค้าเกื้อกูลกัน',
      statusMessage: statusMessage ? statusMessage.textContent : '',
      email: email ? email.textContent : '',
      phone: phone ? phone.value : '',
      pictureUrl: pictureUrl ? pictureUrl.src : ''
    };
  }
}

// ========================================================
// 3. ดึงข้อมูลโปรไฟล์จาก LINE และซิงค์กับฐานข้อมูล D1
// ========================================================
async function getUserProfile() {
  try {
    if (!liff.isLoggedIn()) {
      if (liff.isInClient()) {
        liff.login();
        return;
      } else {
        // หากอยู่นอก LINE Client ให้แสดงข้อมูลเบื้องต้นและไม่บล็อกหน้าจอ
        fallbackStandalone();
        return;
      }
    }

    const profile = await liff.getProfile();
    if (pictureUrl && profile.pictureUrl) {
      pictureUrl.src = profile.pictureUrl;
    }

    const mId = profile.userId || '';
    if (userId) {
      userId.textContent = mId.length > 8 
        ? mId.substring(0, 5) + '*****' + mId.substring(mId.length - 4) 
        : mId;
    }
    if (statusMessage) {
      statusMessage.textContent = profile.statusMessage || 'ยินดีต้อนรับสมาชิกใหม่';
    }
    if (displayName) {
      displayName.textContent = profile.displayName || 'สมาชิกเกื้อกูลกัน';
    }

    let userEmail = 'ไม่พบอีเมล';
    let userPhone = '';
    try {
      const decodedIDToken = liff.getDecodedIDToken();
      if (decodedIDToken) {
        if (decodedIDToken.email) userEmail = decodedIDToken.email;
        if (decodedIDToken.phone || decodedIDToken.phone_number) {
          userPhone = decodedIDToken.phone || decodedIDToken.phone_number;
        }
      }
    } catch (e) {}

    if (email) {
      email.textContent = userEmail;
    }

    // ดึงเบอร์โทรจากแคชท้องถิ่นก่อน (กรองเบอร์ปลอม เช่น 001 ทิ้ง)
    const cachedPhone = localStorage.getItem('user_phone_' + profile.userId);
    let initialPhone = phone.value || cachedPhone || userPhone || '';
    if (!isValidThaiPhone(initialPhone)) {
      initialPhone = '';
    }

    if (phone) {
      phone.value = initialPhone ? formatThaiPhoneNumber(initialPhone) : '';
      if (initialPhone) {
        setPhoneInputState(true);
      } else {
        setPhoneInputState(false);
      }
    }

    userProfileData = {
      userId: profile.userId,
      displayName: profile.displayName,
      statusMessage: profile.statusMessage || 'ยินดีต้อนรับสมาชิกใหม่',
      email: userEmail,
      phone: initialPhone ? cleanPhoneNumber(initialPhone) : '',
      pictureUrl: profile.pictureUrl || ''
    };

    // บันทึกแคชทันทีเพื่อให้การเปิดครั้งต่อไปไม่ต้องรอ
    const cachePayload = JSON.stringify(userProfileData);
    localStorage.setItem('kuekoonkan_member_profile', cachePayload);
    localStorage.setItem('member_info_cache', cachePayload);

    // ดึงข้อมูลจริงจาก Cloudflare D1 เป็น Background Fetch ไม่บล็อก UI
    fetch(`${GOOGLE_SCRIPT_URL}?userId=${profile.userId}&_t=${Date.now()}`)
      .then(response => response.json())
      .then(dbData => {
        if (dbData.status === 'success') {
          if (dbData.found) {
            let savedPhone = dbData.phone || '';
            if (savedPhone && !isValidThaiPhone(savedPhone)) {
              savedPhone = ''; // ล้างค่าที่ไม่ถูกต้อง เช่น 001 ทิ้ง
            }

            if (savedPhone && savedPhone !== initialPhone) {
              phone.value = formatThaiPhoneNumber(savedPhone);
              userProfileData.phone = savedPhone;
              setPhoneInputState(true);
              localStorage.setItem('user_phone_' + profile.userId, savedPhone);
              localStorage.setItem('kuekoonkan_member_profile', JSON.stringify(userProfileData));
            }

            const isProfileChanged =
              dbData.displayName !== profile.displayName ||
              dbData.statusMessage !== (profile.statusMessage || 'ยินดีต้อนรับสมาชิกใหม่') ||
              dbData.email !== userEmail ||
              dbData.pictureUrl !== profile.pictureUrl ||
              (savedPhone && savedPhone !== initialPhone);

            if (isProfileChanged) {
              saveDataAutomatically();
            }
          } else {
            if (initialPhone) {
              localStorage.setItem('user_phone_' + profile.userId, initialPhone);
            }
            saveDataAutomatically();
          }
        }
      })
      .catch(dbError => {
        console.warn('Background member fetch:', dbError);
      });

  } catch (error) {
    console.error('Error getting profile:', error);
    fallbackStandalone();
  }
}

// เรียกเริ่มการทำงาน
main();

// ========================================================
// 4. บันทึกข้อมูลอัตโนมัติไปยัง Cloudflare Worker D1
// ========================================================
async function saveDataAutomatically() {
  if (!userProfileData || !userProfileData.userId) return;

  try {
    const payload = {
      action: 'register',
      ...userProfileData
    };
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn('Background auto save error:', error);
  }
}

// แจ้งเตือน Toast
function showToast(message, isSuccess = true) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = toast.querySelector('.toast-icon');

  if (toastMessage) toastMessage.textContent = message;
  if (toastIcon) {
    if (isSuccess) {
      toastIcon.textContent = '✓';
      toastIcon.style.backgroundColor = 'var(--primary-color)';
    } else {
      toastIcon.textContent = '✗';
      toastIcon.style.backgroundColor = '#c62828';
    }
  }

  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ========================================================
// 5. จัดการ Event Listener ปุ่มต่างๆ
// ========================================================
if (btnSaveData) {
  btnSaveData.addEventListener('click', async () => {
    if (!userProfileData) {
      fallbackStandalone();
    }

    if (phone) {
      const rawVal = phone.value.trim();
      const clean = cleanPhoneNumber(rawVal);
      const phoneErrorEl = document.getElementById('phoneError');

      // ตรวจสอบเบอร์โทร ถ้ามีกรอกต้องเป็นเบอร์ที่ถูกต้อง (ห้ามกรอกช่องว่าง หรือ 001)
      if (rawVal !== '' && !isValidThaiPhone(clean)) {
        phone.style.borderColor = '#ef4444';
        if (phoneErrorEl) {
          phoneErrorEl.style.display = 'block';
          phoneErrorEl.textContent = '* กรุณาระบุเบอร์โทรศัพท์ 10 หลักที่ถูกต้อง (ขึ้นต้นด้วย 0 เช่น 08X-XXX-XXXX)';
        }
        showToast('⚠️ กรุณากรอกเบอร์โทรศัพท์ 10 หลักให้ถูกต้อง', false);
        phone.focus();
        return;
      }

      phone.style.borderColor = '';
      if (phoneErrorEl) phoneErrorEl.style.display = 'none';
      userProfileData.phone = clean;
      if (clean) phone.value = formatThaiPhoneNumber(clean);
    }

    try {
      btnSaveData.innerHTML = `
        <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
        กำลังบันทึก...
      `;
      btnSaveData.disabled = true;

      const payload = {
        action: 'register',
        ...userProfileData
      };

      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.status === 'success') {
        showToast('อัปเดตข้อมูลสมาชิกเรียบร้อยแล้ว!', true);
        if (userProfileData.phone) {
          localStorage.setItem('user_phone_' + (userProfileData.userId || 'default'), userProfileData.phone);
          localStorage.setItem('user_phone_default', userProfileData.phone);
          localStorage.setItem('kuekoonkan_member_profile', JSON.stringify(userProfileData));
          localStorage.setItem('member_info_cache', JSON.stringify(userProfileData));
          setPhoneInputState(true);
        }
      } else {
        showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', false);
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', false);
    } finally {
      setTimeout(() => {
        btnSaveData.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          อัปเดตข้อมูลลูกค้า
        `;
        btnSaveData.disabled = false;
      }, 1500);
    }
  });
}

if (phone) {
  // จัดรูปแบบให้อ่านง่ายอัตโนมัติขณะพิมพ์ (08X-XXX-XXXX) และตรวจสอบความถูกต้อง
  phone.addEventListener('input', (e) => {
    const formatted = formatThaiPhoneNumber(e.target.value);
    e.target.value = formatted;
    const clean = cleanPhoneNumber(formatted);
    const phoneErrorEl = document.getElementById('phoneError');

    if (clean.length > 0 && !isValidThaiPhone(clean)) {
      phone.style.borderColor = '#ef4444';
      if (phoneErrorEl) {
        phoneErrorEl.style.display = 'block';
        phoneErrorEl.textContent = '* กรุณาระบุเบอร์โทรศัพท์ 10 หลักที่ถูกต้อง (ขึ้นต้นด้วย 0 เช่น 08X-XXX-XXXX)';
      }
    } else {
      phone.style.borderColor = '';
      if (phoneErrorEl) phoneErrorEl.style.display = 'none';
    }

    if (userProfileData) {
      userProfileData.phone = clean;
    }
  });

  phone.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (btnSavePhoneInline) {
        btnSavePhoneInline.click();
      }
    }
  });
}

if (btnSavePhoneInline) {
  btnSavePhoneInline.addEventListener('click', async () => {
    if (!userProfileData) {
      fallbackStandalone();
    }

    if (phone.readOnly) {
      setPhoneInputState(false);
      phone.focus();
      return;
    }

    const rawVal = phone.value.trim();
    const clean = cleanPhoneNumber(rawVal);
    const phoneErrorEl = document.getElementById('phoneError');

    // บังคับกรอกเบอร์โทรศัพท์ และต้องเป็นเบอร์ที่ถูกต้องเท่านั้น (ห้ามเว้นวรรค หรือ 001)
    if (!rawVal || !isValidThaiPhone(clean)) {
      phone.style.borderColor = '#ef4444';
      if (phoneErrorEl) {
        phoneErrorEl.style.display = 'block';
        phoneErrorEl.textContent = '* กรุณาระบุเบอร์โทรศัพท์ 10 หลักที่ถูกต้อง (ขึ้นต้นด้วย 0 เช่น 08X-XXX-XXXX)';
      }
      showToast('⚠️ กรุณากรอกเบอร์โทรศัพท์ 10 หลักให้ถูกต้อง', false);
      phone.focus();
      return;
    }

    phone.style.borderColor = '';
    if (phoneErrorEl) phoneErrorEl.style.display = 'none';

    userProfileData.phone = clean;
    phone.value = formatThaiPhoneNumber(clean);

    try {
      btnSavePhoneInline.disabled = true;
      btnSavePhoneInline.innerHTML = `
        <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
      `;

      const payload = {
        action: 'register',
        ...userProfileData
      };

      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.status === 'success') {
        showToast('บันทึกเบอร์โทรศัพท์สำเร็จ!', true);
        localStorage.setItem('user_phone_' + (userProfileData.userId || 'default'), clean);
        localStorage.setItem('user_phone_default', clean);
        localStorage.setItem('kuekoonkan_member_profile', JSON.stringify(userProfileData));
        localStorage.setItem('member_info_cache', JSON.stringify(userProfileData));
        setPhoneInputState(true);
      } else {
        showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (result.message || ''), false);
      }
    } catch (error) {
      console.error('Error saving phone inline:', error);
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', false);
    } finally {
      btnSavePhoneInline.disabled = false;
      if (!phone.readOnly) {
        btnSavePhoneInline.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
      }
    }
  });
}

// ========================================================
// 6. การสลับหน้า SPA ระหว่าง Profile View และ Catalog View
// ========================================================
window.showCatalogView = function(mode) {
  const profileView = document.getElementById('viewProfile');
  const catalogView = document.getElementById('viewCatalog');
  const floatingCart = document.getElementById('floatingCartContainer');

  if (catalogView) {
    if (profileView) profileView.style.display = 'none';
    catalogView.style.display = 'block';
    document.body.classList.remove('is-profile-view');
    document.body.classList.add('is-catalog-view');
    if (floatingCart) floatingCart.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'instant' });

    // โหลดสินค้าทันทีถ้ายังไม่ได้โหลด
    if (typeof window.loadProducts === 'function') {
      window.loadProducts();
    }

    if (window.location.hash !== '#catalog' && window.location.hash !== '#favorites') {
      history.pushState({ view: 'catalog' }, '', '#catalog');
    }

    if (mode === 'favorites') {
      setTimeout(() => {
        if (typeof window.openOrdersModal === 'function') {
          window.openOrdersModal();
          const tabFav = document.getElementById('tabFavOrders');
          if (tabFav) tabFav.click();
        }
      }, 100);
    }
  } else {
    // กรณีที่ไม่ได้เปิดในหน้าที่มี Catalog View
    if (mode === 'favorites') {
      window.location.href = 'second.html?open=favorites';
    } else {
      window.location.href = 'second.html';
    }
  }
};

window.showProfileView = function() {
  const profileView = document.getElementById('viewProfile');
  const catalogView = document.getElementById('viewCatalog');
  const floatingCart = document.getElementById('floatingCartContainer');

  if (profileView) {
    if (catalogView) catalogView.style.display = 'none';
    profileView.style.display = 'block';
    document.body.classList.remove('is-catalog-view');
    document.body.classList.add('is-profile-view');
    if (floatingCart) floatingCart.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (window.location.hash) {
      history.pushState({ view: 'profile' }, '', window.location.pathname + window.location.search);
    }
  } else {
    window.location.href = 'index.html';
  }
};

// ตรวจสอบ Hash เมื่อโหลดหน้า หรือเมื่อกดย้อนกลับในเบราว์เซอร์
function handleHashNavigation() {
  const hash = window.location.hash;
  if (hash === '#catalog') {
    window.showCatalogView();
  } else if (hash === '#favorites') {
    window.showCatalogView('favorites');
  } else {
    // ถ้าไม่มี hash และมี viewProfile ให้แสดง profile
    const profileView = document.getElementById('viewProfile');
    const catalogView = document.getElementById('viewCatalog');
    if (profileView && catalogView && catalogView.style.display === 'block') {
      window.showProfileView();
    }
  }
}

window.addEventListener('popstate', handleHashNavigation);
window.addEventListener('hashchange', handleHashNavigation);

// ตรวจสอบทันทีตอนเริ่มต้น
setTimeout(handleHashNavigation, 50);

if (btnNextPage) {
  btnNextPage.addEventListener('click', () => {
    // บันทึกเบอร์โทรศัพท์ถ้ามี
    if (phone && phone.value.trim()) {
      localStorage.setItem('user_phone_default', phone.value.trim());
      if (userProfileData) userProfileData.phone = phone.value.trim();
    }
    window.showCatalogView();
  });
}

if (btnFavoriteOrders) {
  btnFavoriteOrders.addEventListener('click', () => {
    if (phone && phone.value.trim()) {
      localStorage.setItem('user_phone_default', phone.value.trim());
      if (userProfileData) userProfileData.phone = phone.value.trim();
    }
    window.showCatalogView('favorites');
  });
}

