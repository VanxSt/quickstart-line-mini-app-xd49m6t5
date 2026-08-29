const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyWNEVJwJUpdk9BZZq7Z_bY4CR80sNHHYTUgZpwYYUVFjVxjxnSI8rSkmvFUP1yiBtm/exec';

let allOrders = [];
let allMembers = [];
let activeFilter = 'all';
let searchQuery = '';
let memberSearchQuery = '';
let currentViewingOrderId = null;
let currentTab = 'orders'; // 'orders' | 'members'

document.addEventListener('DOMContentLoaded', () => {
  fetchOrders(true); // โหลดครั้งแรกแบบมี Spinner

  // ตั้งเวลาดึงข้อมูลอัตโนมัติทุกๆ 15 วินาที
  setInterval(() => {
    if (currentTab === 'orders') {
      fetchOrders(false);
    } else if (currentTab === 'members') {
      fetchMembers(false);
    }
  }, 15000);

  document.getElementById('refreshBtn').addEventListener('click', () => fetchOrders(true));
  const btnRefreshMembers = document.getElementById('refreshMembersBtn');
  if (btnRefreshMembers) {
    btnRefreshMembers.addEventListener('click', () => fetchMembers(true));
  }
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);

  // Navigation Switcher
  const navOrders = document.getElementById('navOrders');
  const navMembers = document.getElementById('navMembers');
  const viewOrders = document.getElementById('viewOrders');
  const viewMembers = document.getElementById('viewMembers');

  if (navOrders && navMembers) {
    navOrders.addEventListener('click', (e) => {
      e.preventDefault();
      currentTab = 'orders';
      navOrders.classList.add('active');
      navMembers.classList.remove('active');
      viewOrders.style.display = 'block';
      viewMembers.style.display = 'none';
      fetchOrders(false);
    });

    navMembers.addEventListener('click', (e) => {
      e.preventDefault();
      currentTab = 'members';
      navMembers.classList.add('active');
      navOrders.classList.remove('active');
      viewMembers.style.display = 'block';
      viewOrders.style.display = 'none';
      fetchMembers(true);
    });
  }

  // Tab Filtering for Orders
  const filterTabs = document.getElementById('filterTabs');
  if (filterTabs) {
    filterTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.status;
      renderOrders();
    });
  }

  // Search Input for Orders
  const searchInput = document.getElementById('adminSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderOrders();
    });
  }

  // Search Input for Members
  const memberSearchInput = document.getElementById('memberSearchInput');
  if (memberSearchInput) {
    memberSearchInput.addEventListener('input', (e) => {
      memberSearchQuery = e.target.value.toLowerCase().trim();
      renderMembers();
    });
  }
});

async function fetchOrders(showLoading = true) {
  const loading = document.getElementById('loadingIndicator');

  if (showLoading) {
    loading.style.display = 'flex';
    document.getElementById('ordersBody').innerHTML = '';
  }

  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllOrders`);
    const result = await response.json();

    if (result.status === 'success') {
      allOrders = result.orders || [];
      renderOrders();
      updateStats();
    } else {
      alert("Error fetching orders");
    }
  } catch (error) {
    console.error("Fetch error:", error);
    if (showLoading) {
      alert("Connection error: กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ Google Apps Script");
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

  // Filter & Search Logic
  const filtered = allOrders.filter(order => {
    const statusMatch = (activeFilter === 'all') || (order.status === activeFilter);
    const searchMatch = !searchQuery ||
      (order.orderId && order.orderId.toLowerCase().includes(searchQuery)) ||
      (order.customerName && order.customerName.toLowerCase().includes(searchQuery)) ||
      (order.phone && order.phone.includes(searchQuery)) ||
      (order.paymentMethod && order.paymentMethod.toLowerCase().includes(searchQuery));
    return statusMatch && searchMatch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <p style="font-weight: 500;">ไม่พบรายการออเดอร์ในหมวดหมู่นี้</p>
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(order => {
    const tr = document.createElement('tr');

    let statusClass = 'status-pending';
    let statusIcon = '⏳';

    if (order.status === 'รอชำระเงิน') {
      statusClass = 'status-payment';
      statusIcon = '💳';
    } else if (order.status === 'กำลังจัดส่ง') {
      statusClass = 'status-shipping';
      statusIcon = '🚚';
    } else if (order.status === 'ยืนยันแล้ว') {
      statusClass = 'status-confirmed';
      statusIcon = '✅';
    } else if (order.status === 'ยกเลิก') {
      statusClass = 'status-cancelled';
      statusIcon = '❌';
    }

    // Payment Method Badge Class
    const isTransfer = order.paymentMethod === 'โอนจ่าย';
    const payBadgeClass = isTransfer ? 'pay-badge transfer' : 'pay-badge cod';

    // Format Date
    let dateStr = order.timestamp || '-';
    try {
      if (order.timestamp) {
        const d = new Date(order.timestamp);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
        }
      }
    } catch (e) { }

    const cleanPhone = (order.phone || '').replace(/'/g, "");

    tr.innerHTML = `
      <td>
        <strong style="color: var(--primary); font-size: 14px;">${order.orderId}</strong>
        <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
          <span class="${payBadgeClass}">${order.paymentMethod || 'โอนจ่าย'}</span>
          ${order.shippingOption === 'รับหน้าร้าน' ? '<span class="pay-badge" style="background-color: #f59e0b; color: white;">🏪 รับหน้าร้าน</span>' : '<span class="pay-badge" style="background-color: #3b82f6; color: white;">🚚 จัดส่ง</span>'}
        </div>
      </td>
      <td style="font-size: 13px; color: var(--text-muted);">${dateStr}</td>
      <td>
        <div style="font-weight: 600;">${order.customerName || 'ลูกค้า'}</div>
        <div style="font-size: 12px; color: var(--text-muted);">${cleanPhone}</div>
      </td>
      <td><strong style="font-size: 15px; color: #1e293b;">฿${Number(order.totalPrice || 0).toLocaleString()}</strong></td>
      <td><span class="status-badge ${statusClass}">${statusIcon} ${order.status}</span></td>
      <td style="text-align: right;">
        <button class="btn-view" onclick="viewOrder('${order.orderId}')">📋 ดูรายละเอียด</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateStats() {
  let pendingCount = 0;
  let paymentCount = 0;
  let shippingCount = 0;
  let confirmedCount = 0;
  let cancelledCount = 0;
  let totalSales = 0;

  allOrders.forEach(o => {
    if (o.status === 'รอตรวจสอบ') pendingCount++;
    else if (o.status === 'รอชำระเงิน') paymentCount++;
    else if (o.status === 'กำลังจัดส่ง') shippingCount++;
    else if (o.status === 'ยืนยันแล้ว') confirmedCount++;
    else if (o.status === 'ยกเลิก') cancelledCount++;

    if (o.status === 'ยืนยันแล้ว' || o.status === 'กำลังจัดส่ง') {
      totalSales += Number(o.totalPrice || 0);
    }
  });

  // Header Cards
  const elPending = document.getElementById('stat-pending');
  const elPayment = document.getElementById('stat-payment');
  const elConfirmed = document.getElementById('stat-confirmed');
  const elSales = document.getElementById('stat-sales');

  if (elPending) elPending.textContent = pendingCount;
  if (elPayment) elPayment.textContent = paymentCount;
  if (elConfirmed) elConfirmed.textContent = shippingCount + confirmedCount;
  if (elSales) elSales.textContent = `฿${totalSales.toLocaleString()}`;

  // Filter Tab Badges
  const cAll = document.getElementById('count-all');
  const cPending = document.getElementById('count-pending');
  const cPayment = document.getElementById('count-payment');
  const cShipping = document.getElementById('count-shipping');
  const cConfirmed = document.getElementById('count-confirmed');
  const cCancelled = document.getElementById('count-cancelled');

  if (cAll) cAll.textContent = allOrders.length;
  if (cPending) cPending.textContent = pendingCount;
  if (cPayment) cPayment.textContent = paymentCount;
  if (cShipping) cShipping.textContent = shippingCount;
  if (cConfirmed) cConfirmed.textContent = confirmedCount;
  if (cCancelled) cCancelled.textContent = cancelledCount;
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
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.qty || 1);
    const itemSubtotal = Number(item.subtotal || (itemPrice * itemQty));

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id || '-'}</td>
      <td><strong>${item.name || '-'}</strong></td>
      <td>x${itemQty}</td>
      <td>฿${itemSubtotal.toLocaleString()}</td>
    `;
    itemsBody.appendChild(tr);
  });

  const grandTotal = Number(order.totalPrice || 0);
  document.getElementById('modalTotalPrice').textContent = `฿${grandTotal.toLocaleString()}`;

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
  } else if (order.status === 'กำลังจัดส่ง') {
    actionsDiv.innerHTML = `
      <button id="btnConfirmOrder" class="btn-success" onclick="updateStatus('ยืนยันแล้ว')">🎉 จัดส่งเรียบร้อย / ทำรายการสำเร็จ (ยืนยันแล้ว)</button>
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
      alert("Error updating order: " + result.message);
    }
  } catch (error) {
    console.error("Update error:", error);
    alert("Connection error: ไม่สามารถบันทึกสถานะได้");
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

async function fetchMembers(showLoading = true) {
  const loading = document.getElementById('membersLoadingIndicator');

  if (showLoading && loading) {
    loading.style.display = 'flex';
    document.getElementById('membersBody').innerHTML = '';
  }

  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllMembers`);
    const result = await response.json();

    if (result.status === 'success') {
      allMembers = result.members || [];
      renderMembers();
      updateMemberStats();
    } else {
      console.error("Error fetching members");
    }
  } catch (error) {
    console.error("Fetch members error:", error);
  } finally {
    if (showLoading && loading) {
      loading.style.display = 'none';
    }
  }
}

function renderMembers() {
  const tbody = document.getElementById('membersBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = allMembers.filter(m => {
    if (!memberSearchQuery) return true;
    return (m.displayName && m.displayName.toLowerCase().includes(memberSearchQuery)) ||
           (m.phone && m.phone.includes(memberSearchQuery)) ||
           (m.userId && m.userId.toLowerCase().includes(memberSearchQuery)) ||
           (m.email && m.email.toLowerCase().includes(memberSearchQuery));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">👥</div>
          <p style="font-weight: 500;">ยังไม่มีสมาชิกในระบบหรือหาไม่พบ</p>
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(m => {
    const tr = document.createElement('tr');

    let dateStr = m.registeredAt || '-';
    try {
      if (m.registeredAt) {
        const d = new Date(m.registeredAt);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
        }
      }
    } catch (e) { }

    const avatarHtml = m.pictureUrl
      ? `<img src="${m.pictureUrl}" alt="${m.displayName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-light);" />`
      : `<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px;">${(m.displayName || 'U').charAt(0)}</div>`;

    const cleanPhone = m.phone ? m.phone.replace(/'/g, "") : '-';

    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${avatarHtml}
          <div>
            <strong style="font-size: 14px; color: var(--text-main);">${m.displayName || 'ไม่ระบุชื่อ'}</strong>
            <div style="font-size: 12px; color: var(--text-muted);">${m.email || 'ไม่มีอีเมล'}</div>
          </div>
        </div>
      </td>
      <td>
        <span style="font-weight: 600; color: #1e293b;">${cleanPhone}</span>
      </td>
      <td>
        <code style="background: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-size: 12px; color: #475569;">${m.userId || '-'}</code>
      </td>
      <td style="font-size: 13px; color: var(--text-muted);">${dateStr}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateMemberStats() {
  const elTotal = document.getElementById('stat-total-members');
  const elPhone = document.getElementById('stat-phone-members');

  if (elTotal) elTotal.textContent = allMembers.length;

  let phoneCount = 0;
  allMembers.forEach(m => {
    if (m.phone && m.phone.trim() !== '') phoneCount++;
  });

  if (elPhone) elPhone.textContent = phoneCount;
}
