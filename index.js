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

// Store profile data temporarily
let userProfileData = null;

// Replace with your deployed Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzWQHNgwWaManwhA0avqcKWmLOcHUB82c1gIBF74WlxMFiS1dEmxfzt6Vc3XwcJGO1x/exec';

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

async function main() {
  // Initialize LIFF SDK
  await liff.init({ liffId: '2010169713-ao0dtP3R' });
  getUserProfile();
}
main();

async function getUserProfile() {
  try {
    // ตรวจสอบว่าได้ล็อกอิน LINE หรือยัง (หากยังไม่ล็อกอิน ให้ทำการ redirect ไปหน้าล็อกอินของ LINE)
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    const profile = await liff.getProfile();
    pictureUrl.src = profile.pictureUrl
      ? profile.pictureUrl
      : 'https://vos.line-scdn.net/imgs/apis/ic_mini.png';
    userId.textContent = profile.userId;
    statusMessage.textContent = profile.statusMessage || 'ยินดีต้อนรับสมาชิกใหม่';
    displayName.textContent = profile.displayName;
    
    const decodedIDToken = liff.getDecodedIDToken();
    const userEmail = decodedIDToken ? (decodedIDToken.email || 'ไม่พบอีเมล') : 'ไม่พบอีเมล';
    email.textContent = userEmail;

    // ดึงเบอร์โทรศัพท์จาก Decoded ID Token (ผ่าน LINE Profile+)
    const userPhone = decodedIDToken ? (decodedIDToken.phone || decodedIDToken.phone_number || '') : '';
    phone.value = userPhone;

    // Save profile data for sending later
    userProfileData = {
      userId: profile.userId,
      displayName: profile.displayName,
      statusMessage: profile.statusMessage,
      email: userEmail,
      phone: userPhone,
      pictureUrl: profile.pictureUrl
    };

    // ทำการบันทึกข้อมูลอัตโนมัติเมื่อโหลดโปรไฟล์เสร็จ
    saveDataAutomatically();
  } catch (error) {
    console.error('Error getting profile:', error);
    showToast('เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์', false);
  }
}

async function saveDataAutomatically() {
  if (!userProfileData) {
    console.warn('ไม่สามารถดึงข้อมูลโปรไฟล์เพื่อบันทึกอัตโนมัติได้');
    return;
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(userProfileData)
    });
    
    const result = await response.json();
    if (result.status === 'success') {
       console.log('ระบบส่งข้อมูลเข้า Sheet สำเร็จ (อัตโนมัติ)');
    } else {
       console.warn('ส่งข้อมูลได้ แต่ Google Script แจ้งว่า: ' + JSON.stringify(result));
    }
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อบันทึกอัตโนมัติ: ' + error.message);
  }
}

function showToast(message, isSuccess = true) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = toast.querySelector('.toast-icon');
  
  toastMessage.textContent = message;
  if (isSuccess) {
    toastIcon.textContent = '✓';
    toastIcon.style.backgroundColor = 'var(--primary-color)';
  } else {
    toastIcon.textContent = '✗';
    toastIcon.style.backgroundColor = '#c62828';
  }
  
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

if (btnSaveData) {
  btnSaveData.addEventListener('click', async () => {
    if (!userProfileData) {
      console.warn('ยังไม่ได้โหลดข้อมูลโปรไฟล์');
      return;
    }

    if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_WEB_APP_URL_HERE') {
      showToast('กรุณาตั้งค่า Web App URL ของ Google Sheets', false);
      return;
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

      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // use text/plain to avoid CORS preflight
        },
        body: JSON.stringify(userProfileData)
      });

      const result = await response.json();
      if (result.status === 'success') {
        showToast('อัปเดตข้อมูลสมาชิกเรียบร้อยแล้ว!', true);
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
  phone.addEventListener('input', () => {
    if (userProfileData) {
      userProfileData.phone = phone.value;
    }
  });
}

if (btnNextPage) {
  btnNextPage.addEventListener('click', () => {
    window.location.href = 'second.html';
  });
}
