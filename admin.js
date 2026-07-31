const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwcTql64nZbrSRYuDknmQfuXVXNkVrcaez_kIKBPUB3zUY-YRnAyCFCAMPgx1wl5ltF/exec';

let allOrders = [];
let currentViewingOrderId = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchOrders(true); // โหลดครั้งแรกแบบมี Spinner

  // ตั้งเวลาดึงข้อมูลอัตโนมัติทุกๆ 15 วินาที (แบบเงียบๆ ไม่โชว์ Spinner)
  setInterval(() => {
    fetchOrders(false);
  }, 15000);

  document.getElementById('refreshBtn').addEventListener('click', () => fetchOrders(true));
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
});

async function fetchOrders(showLoading = true) {
  const loading = document.getElementById('loadingIndicator');

  if (showLoading) {
    loading.style.display = 'flex';
    document.getElementById('ordersBody').innerHTML = ''; // ล้างตารางเฉพาะตอนโหลดแบบมีหน้าโหลด
  }

  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllOrders`);
    const result = await response.json();

    if (result.status === 'success') {
      allOrders = result.orders;
      renderOrders();
      updateStats();
    } else {
      alert("Error fetching orders");
    }
  } catch (error) {
    console.error("Fetch error:", error);
    if (showLoading) {
      alert("Connection error: กรุณาตรวจสอบว่าได้ Deploy Google Script ล่าสุดหรือยัง");
    }
  } finally {
    if (showLoading) {
      loading.style.display = 'none';
    }
  }
}

function renderOrders() {
  const tbody = document.getElementById('ordersBody');
  tbody.innerHTML = '';

  allOrders.forEach(order => {
    const tr = document.createElement('tr');

    let statusClass = 'status-pending';
    if (order.status === 'ยืนยันแล้ว' || order.status === 'กำลังจัดส่ง') statusClass = 'status-confirmed';
    if (order.status === 'รอชำระเงิน') statusClass = 'status-pending'; // Or a new style, but pending is orange
    if (order.status === 'ยกเลิก') statusClass = 'status-cancelled';

    // Format Date
    let dateStr = order.timestamp;
    try {
      if (order.timestamp) {
        const d = new Date(order.timestamp);
        dateStr = d.toLocaleString('th-TH');
      }
    } catch (e) { }

    tr.innerHTML = `
      <td><strong>${order.orderId}</strong><br><small style="color:#666;">${order.paymentMethod}</small></td>
      <td>${dateStr}</td>
      <td>${order.customerName}</td>
      <td>฿${order.totalPrice.toLocaleString()}</td>
      <td><span class="status-badge ${statusClass}">${order.status}</span></td>
      <td>
        <button class="btn-view" onclick="viewOrder('${order.orderId}')">เปิดดูรายการ</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateStats() {
  let pendingCount = 0;
  let confirmedCount = 0;
  let totalSales = 0;

  allOrders.forEach(o => {
    if (o.status === 'รอตรวจสอบ') pendingCount++;
    if (o.status === 'ยืนยันแล้ว') {
      confirmedCount++;
      totalSales += Number(o.totalPrice || 0);
    }
  });

  document.getElementById('stat-pending').textContent = pendingCount;
  document.getElementById('stat-confirmed').textContent = confirmedCount;
  document.getElementById('stat-sales').textContent = `฿${totalSales.toLocaleString()}`;
}

function viewOrder(orderId) {
  currentViewingOrderId = orderId;
  const order = allOrders.find(o => o.orderId === orderId);
  if (!order) return;

  document.getElementById('modalOrderId').textContent = order.orderId;
  document.getElementById('modalCustomerName').textContent = order.customerName;
  document.getElementById('modalPhone').textContent = order.phone.replace(/'/g, ""); // Remove quote if present

  // Format GPS
  let gpsText = order.gpsLocation;
  if (gpsText.includes('HYPERLINK')) {
    const match = gpsText.match(/HYPERLINK\("([^"]+)"/);
    if (match) {
      gpsText = `<a href="${match[1]}" target="_blank" style="color: #3b82f6; text-decoration: underline;">📍 เปิดแผนที่บน Google Maps</a>`;
    }
  } else if (gpsText.startsWith('http')) {
    gpsText = `<a href="${gpsText}" target="_blank" style="color: #3b82f6; text-decoration: underline;">📍 เปิดแผนที่บน Google Maps</a>`;
  }
  document.getElementById('modalGps').innerHTML = gpsText || '-';
  document.getElementById('modalAddress').textContent = order.addressDetails || '-';

  // Render Items
  const itemsBody = document.getElementById('modalItemsBody');
  itemsBody.innerHTML = '';

  order.items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td><strong>${item.name}</strong></td>
      <td>x${item.qty}</td>
      <td>฿${item.subtotal.toLocaleString()}</td>
    `;
    itemsBody.appendChild(tr);
  });

  document.getElementById('modalTotalPrice').textContent = `฿${order.totalPrice.toLocaleString()}`;

  // Dynamic action buttons
  const actionsDiv = document.getElementById('modalActions');
  actionsDiv.innerHTML = ''; // Clear old buttons

  if (order.status === 'รอตรวจสอบ') {
    if (order.paymentMethod === 'โอนจ่าย') {
      actionsDiv.innerHTML = `
        <button id="btnConfirmOrder" class="btn-success" onclick="updateStatus('รอชำระเงิน')">✅ ยืนยันคำสั่งซื้อพร้อมส่ง QR Code ให้ชำระเงิน</button>
        <button id="btnCancelOrder" class="btn-danger" onclick="updateStatus('ยกเลิก')">❌ ยกเลิก</button>
      `;
    } else { // ปลายทาง
      actionsDiv.innerHTML = `
        <button id="btnConfirmOrder" class="btn-success" onclick="updateStatus('กำลังจัดส่ง')">✅ ยืนยันคำสั่งซื้อปลายทาง</button>
        <button id="btnCancelOrder" class="btn-danger" onclick="updateStatus('ยกเลิก')">❌ ยกเลิก</button>
      `;
    }
    actionsDiv.style.display = 'flex';
  } else if (order.status === 'รอชำระเงิน' && order.paymentMethod === 'โอนจ่าย') {
    actionsDiv.innerHTML = `
      <button id="btnConfirmOrder" class="btn-success" onclick="updateStatus('กำลังจัดส่ง')">📦 ตรวจสอบยอดแล้ว เตรียมสินค้ากำลังจัดส่ง</button>
      <button id="btnCancelOrder" class="btn-danger" onclick="updateStatus('ยกเลิก')">❌ ยกเลิก</button>
    `;
    actionsDiv.style.display = 'flex';
  } else {
    actionsDiv.style.display = 'none';
  }

  document.getElementById('orderModal').classList.add('active');
}

function closeModal() {
  document.getElementById('orderModal').classList.remove('active');
  currentViewingOrderId = null;
}

async function updateStatus(newStatus) {
  if (!currentViewingOrderId) return;
  if (!confirm(`ยืนยันการเปลี่ยนสถานะออเดอร์เป็น "${newStatus}" หรือไม่?`)) return;

  const btnConfirm = document.getElementById('btnConfirmOrder');
  const btnCancel = document.getElementById('btnCancelOrder');

  const originalConfirmText = btnConfirm ? btnConfirm.textContent : "กำลังบันทึก...";

  if (btnConfirm) btnConfirm.disabled = true;
  if (btnCancel) btnCancel.disabled = true;
  if (btnConfirm) btnConfirm.textContent = "กำลังบันทึก...";

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'updateOrderStatus',
        orderId: currentViewingOrderId,
        status: newStatus
      })
    });

    const result = await response.json();

    if (result.status === 'success') {
      let alertMsg = "อัปเดตสถานะออเดอร์สำเร็จ!";
      if (result.debug && result.debug !== 'No message to send') {
        alertMsg += "\n\n[LINE API Debug]:\n" + result.debug;
      }
      alert(alertMsg);
      closeModal();
      fetchOrders(); // Refresh table
    } else {
      alert("Error: " + result.message);
    }
  } catch (error) {
    console.error(error);
    alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = originalConfirmText;
    }
    if (btnCancel) {
      btnCancel.disabled = false;
    }
  }
}
