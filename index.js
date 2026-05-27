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

  // Try a function

  switch (liff.getOS()) {
    case 'android':
      body.style.backgroundColor = '#7b8aca';
      break;
    case 'ios':
      body.style.backgroundColor = '#7b8aca';
      break;
    case 'web':
      body.style.backgroundColor = '#7b8aca';
      break;
  }
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
    userId.innerHTML = '<b>userId:</b> ' + profile.userId;
    statusMessage.innerHTML = '<b>statusMessage:</b> ' + profile.statusMessage;
    displayName.innerHTML = '<b>displayName:</b> ' + profile.displayName;
    
    const decodedIDToken = liff.getDecodedIDToken();
    const userEmail = decodedIDToken ? (decodedIDToken.email || 'ไม่พบอีเมล') : 'ไม่พบอีเมล';
    email.innerHTML = '<b>email:</b> ' + userEmail;

    // ดึงเบอร์โทรศัพท์จาก Decoded ID Token (ผ่าน LINE Profile+)
    const userPhone = decodedIDToken ? (decodedIDToken.phone || decodedIDToken.phone_number || '') : '';
    phone.innerHTML = '<b>phone:</b> ' + (userPhone || 'ไม่พบเบอร์โทรศัพท์ (กรุณาขออนุมัติสิทธิ์ LINE Profile+)');

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
    alert('เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์: ' + error.message);
  }
}

async function saveDataAutomatically() {
  if (!userProfileData) {
    alert('ไม่สามารถดึงข้อมูลโปรไฟล์ได้');
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
       alert('ระบบส่งข้อมูลเข้า Sheet สำเร็จ!');
    } else {
       alert('ส่งข้อมูลได้ แต่ Google Script แจ้งว่า: ' + JSON.stringify(result));
    }
  } catch (error) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ (อาจเป็นเพราะ URL Google Script ผิด หรือยังไม่ได้ Deploy สิทธิ์ Everyone): ' + error.message);
  }
}

if (btnSaveData) {
  btnSaveData.addEventListener('click', async () => {
    if (!userProfileData) {
      alert('ยังไม่ได้โหลดข้อมูลโปรไฟล์');
      return;
    }

    if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_WEB_APP_URL_HERE') {
      alert('กรุณาใส่ Web App URL ของ Google Apps Script ในไฟล์ index.js ก่อน');
      return;
    }

    try {
      btnSaveData.textContent = 'กำลังบันทึก...';
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
        alert('บันทึกข้อมูลสำเร็จ!');
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      btnSaveData.textContent = 'บันทึกข้อมูลลูกค้า';
      btnSaveData.disabled = false;
    }
  });
}

if (btnNextPage) {
  btnNextPage.addEventListener('click', () => {
    window.location.href = 'second.html';
  });
}
