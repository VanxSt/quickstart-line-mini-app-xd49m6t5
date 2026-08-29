const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxqhJodVJOZpHwaRHqyLz_T0oML6XKV_YQ1aPAloacd18sGxquQhc793qqgJIcLzsX9/exec';

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

  // === GPS / Map Section ===
  let gpsUrl = '';
  let gpsRaw = order.gpsLocation || '';

  // Extract URL from HYPERLINK formula or raw URL
  if (gpsRaw.includes('HYPERLINK')) {
    const match = gpsRaw.match(/HYPERLINK\("([^"]+)"/);
    if (match) gpsUrl = match[1];
  } else if (gpsRaw.startsWith('http')) {
    gpsUrl = gpsRaw;
  }

  const gpsEl = document.getElementById('modalGps');
  const mapContainer = document.getElementById('modalMapContainer');
  const mapFrame = document.getElementById('modalMapFrame');

  // Hide map by default on open
  mapContainer.style.display = 'none';
  mapFrame.innerHTML = '';

  if (gpsUrl) {
    // Store GPS URL in data attribute for later use
    mapContainer.dataset.gpsUrl = gpsUrl;
    gpsEl.innerHTML = `
      <a href="${gpsUrl}" target="_blank" class="gps-link">📍 เปิดแผนที่บน Google Maps</a>
      <button class="btn-open-map" onclick="toggleMapEmbed(true)">🗺️ ดูแผนที่ในหน้านี้</button>
    `;
  } else {
    gpsEl.textContent = gpsRaw || '-';
  }

  document.getElementById('modalAddress').textContent = order.addressDetails || '-';

  // === Render Items (with delete buttons) ===
  renderModalItems(order);

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

// === Render Items in Modal (with delete button per row) ===
function renderModalItems(order) {
  const itemsBody = document.getElementById('modalItemsBody');
  itemsBody.innerHTML = '';

  const isEditable = order.status !== 'ยืนยันแล้ว' && order.status !== 'ยกเลิก';

  order.items.forEach((item, index) => {
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.qty || 1);
    const itemSubtotal = Number(item.subtotal || (itemPrice * itemQty));

    const tr = document.createElement('tr');
    tr.dataset.index = index;
    tr.innerHTML = `
      <td>${item.id || '-'}</td>
      <td><strong>${item.name || '-'}</strong></td>
      <td>x${itemQty}</td>
      <td>฿${itemSubtotal.toLocaleString()}</td>
      <td style="text-align:center;">
        ${isEditable && order.items.length > 1
          ? `<button class="btn-delete-item" onclick="deleteOrderItem('${order.orderId}', ${index})" title="ลบรายการนี้">🗑️</button>`
          : `<span style="color:#cbd5e1; font-size:14px;">—</span>`
        }
      </td>
    `;
    itemsBody.appendChild(tr);
  });

  const grandTotal = Number(order.totalPrice || 0);
  document.getElementById('modalTotalPrice').textContent = `฿${grandTotal.toLocaleString()}`;
}

// === Delete a single item from the order ===
async function deleteOrderItem(orderId, itemIndex) {
  const order = allOrders.find(o => o.orderId === orderId);
  if (!order || !order.items) return;

  const itemToDelete = order.items[itemIndex];
  if (!itemToDelete) return;

  const itemName = itemToDelete.name || 'รายการนี้';
  if (!confirm(`ต้องการลบ "${itemName}" ออกจากออเดอร์นี้หรือไม่?\n\n⚠️ ยอดรวมจะถูกคำนวณใหม่อัตโนมัติ`)) return;

  // Animate the row being deleted
  const row = document.querySelector(`#modalItemsBody tr[data-index="${itemIndex}"]`);
  if (row) {
    row.classList.add('item-row-deleting');
    await new Promise(r => setTimeout(r, 350));
  }

  // Remove item from array
  const newItems = order.items.filter((_, i) => i !== itemIndex);

  // Recalculate total
  let newTotal = 0;
  newItems.forEach(item => {
    newTotal += Number(item.subtotal || (Number(item.price || 0) * Number(item.qty || 1)));
  });

  // Save to backend
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'updateOrderItems',
        orderId: orderId,
        items: newItems,
        totalPrice: newTotal
      })
    });

    const result = await response.json();

    if (result.status === 'success') {
      // Update local data
      order.items = newItems;
      order.totalPrice = newTotal;

      // Re-render items
      renderModalItems(order);

      // Update table row total
      renderOrders();
      updateStats();
    } else {
      alert('❌ ไม่สามารถบันทึกได้: ' + (result.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('Delete item error:', error);
    alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ');
  }
}

// === Toggle Embedded Map ===
function toggleMapEmbed(show) {
  const mapContainer = document.getElementById('modalMapContainer');
  const mapFrame = document.getElementById('modalMapFrame');

  if (show) {
    const gpsUrl = mapContainer.dataset.gpsUrl || '';
    if (!gpsUrl) return;

    // Extract lat/lng from Google Maps URL
    let lat = '', lng = '';
    
    // Try pattern: @lat,lng
    const atMatch = gpsUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    // Try pattern: ?q=lat,lng or place/lat,lng
    const qMatch = gpsUrl.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/) ||
                   gpsUrl.match(/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);

    if (atMatch) {
      lat = atMatch[1]; lng = atMatch[2];
    } else if (qMatch) {
      lat = qMatch[1]; lng = qMatch[2];
    }

    if (lat && lng) {
      // Embed Google Maps with pin
      mapFrame.innerHTML = `<iframe 
        src="https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed" 
        allowfullscreen loading="lazy" 
        referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    } else {
      // Fallback: embed the URL directly as search query
      const searchQuery = encodeURIComponent(gpsUrl);
      mapFrame.innerHTML = `<iframe 
        src="https://maps.google.com/maps?q=${searchQuery}&z=15&output=embed" 
        allowfullscreen loading="lazy"></iframe>`;
    }

    mapContainer.style.display = 'block';
  } else {
    mapContainer.style.display = 'none';
    mapFrame.innerHTML = '';
  }
}

function closeModal() {
  document.getElementById('orderModal').classList.remove('active');
  // Clean up map
  const mapContainer = document.getElementById('modalMapContainer');
  const mapFrame = document.getElementById('modalMapFrame');
  if (mapContainer) mapContainer.style.display = 'none';
  if (mapFrame) mapFrame.innerHTML = '';
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
