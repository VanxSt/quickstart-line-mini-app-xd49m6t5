const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxdPwvYWymgprxMqGYY2YPEJZmtTUzzo4r-NRfJbQVNpMh9I0MnRYhK3zDZ8KCQUIlU/exec';

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

let isModalEditMode = false;

function viewOrder(orderId) {
  currentViewingOrderId = orderId;
  isModalEditMode = false; // Reset edit mode on view
  const order = allOrders.find(o => o.orderId === orderId);
  if (!order) return;

  document.getElementById('modalOrderId').textContent = order.orderId;
  document.getElementById('modalCustomerName').textContent = order.customerName;
  document.getElementById('modalPhone').textContent = order.phone.replace(/'/g, ""); // Remove quote if present

  // Hide edit note box by default
  const noteBox = document.getElementById('editNoteContainer');
  if (noteBox) noteBox.style.display = 'none';
  const noteInput = document.getElementById('editChangeNote');
  if (noteInput) noteInput.value = '';

  // === GPS / Map Section ===
  let gpsUrl = extractGpsUrl(order.gpsLocation, order.addressDetails, order.customerName);

  const gpsEl = document.getElementById('modalGps');
  const mapContainer = document.getElementById('modalMapContainer');
  const mapFrame = document.getElementById('modalMapFrame');

  // Hide map by default on open
  if (mapContainer) mapContainer.style.display = 'none';
  if (mapFrame) mapFrame.innerHTML = '';

  if (gpsUrl) {
    if (mapContainer) mapContainer.dataset.gpsUrl = gpsUrl;
    gpsEl.innerHTML = `
      <a href="${gpsUrl}" target="_blank" rel="noopener noreferrer" class="gps-link">📌 เปิดแผนที่ Google Maps</a>
      <button class="btn-open-map" onclick="toggleMapEmbed(true)">🗺️ ดูแผนที่ในหน้านี้</button>
    `;
  } else {
    gpsEl.textContent = order.gpsLocation || '-';
  }

  document.getElementById('modalAddress').textContent = order.addressDetails || '-';

  // === Render Items ===
  renderModalItems(order, false);

  // Dynamic action buttons
  renderModalActions(order);

  document.getElementById('orderModal').classList.add('active');
}

// Render dynamic footer action buttons
function renderModalActions(order) {
  const actionsDiv = document.getElementById('modalActions');
  if (!actionsDiv) return;
  actionsDiv.innerHTML = '';

  const isEditable = order.status !== 'ยืนยันแล้ว' && order.status !== 'ยกเลิก';

  if (isModalEditMode) {
    // Edit mode buttons
    actionsDiv.innerHTML = `
      <button id="btnSaveEditOrder" class="btn-success" onclick="saveOrderChanges()">💾 บันทึกการแก้ไข & แจ้งลูกค้า</button>
      <button id="btnCancelEditOrder" class="btn-secondary" onclick="toggleModalEditMode()">↩️ ยกเลิกการแก้ไข</button>
    `;
    actionsDiv.style.display = 'flex';
  } else {
    // Standard view mode buttons
    let buttonsHtml = '';
    
    // Add Edit Order button if order is editable
    if (isEditable) {
      buttonsHtml += `<button id="btnEditOrder" class="btn-warning" onclick="toggleModalEditMode()">✏️ แก้ไขข้อมูลออเดอร์</button>`;
    }

    if (order.status === 'รอตรวจสอบ') {
      if (order.paymentMethod === 'โอนจ่าย') {
        buttonsHtml += `
          <button id="btnConfirmOrder" class="btn-success" onclick="updateStatus('รอชำระเงิน')">✅ ยืนยันคำสั่งซื้อพร้อมส่ง QR Code</button>
          <button id="btnCancelOrder" class="btn-danger" onclick="updateStatus('ยกเลิก')">❌ ยกเลิก</button>
        `;
      } else { // ปลายทาง
        buttonsHtml += `
          <button id="btnConfirmOrder" class="btn-success" onclick="updateStatus('กำลังจัดส่ง')">✅ ยืนยันคำสั่งซื้อปลายทาง</button>
          <button id="btnCancelOrder" class="btn-danger" onclick="updateStatus('ยกเลิก')">❌ ยกเลิก</button>
        `;
      }
    } else if (order.status === 'รอชำระเงิน' && order.paymentMethod === 'โอนจ่าย') {
      buttonsHtml += `
        <button id="btnConfirmOrder" class="btn-success" onclick="updateStatus('กำลังจัดส่ง')">📦 ตรวจสอบยอดแล้ว เตรียมส่งสินค้า</button>
        <button id="btnCancelOrder" class="btn-danger" onclick="updateStatus('ยกเลิก')">❌ ยกเลิก</button>
      `;
    } else if (order.status === 'กำลังจัดส่ง') {
      buttonsHtml += `
        <button id="btnConfirmOrder" class="btn-success" onclick="updateStatus('ยืนยันแล้ว')">🎉 จัดส่งเรียบร้อย / ทำรายการสำเร็จ</button>
        <button id="btnCancelOrder" class="btn-danger" onclick="updateStatus('ยกเลิก')">❌ ยกเลิก</button>
      `;
    }

    actionsDiv.innerHTML = buttonsHtml;
    actionsDiv.style.display = buttonsHtml ? 'flex' : 'none';
  }
}

// Toggle edit mode in order details modal
function toggleModalEditMode() {
  if (!currentViewingOrderId) return;
  const order = allOrders.find(o => o.orderId === currentViewingOrderId);
  if (!order) return;

  isModalEditMode = !isModalEditMode;

  const noteBox = document.getElementById('editNoteContainer');
  if (noteBox) noteBox.style.display = isModalEditMode ? 'block' : 'none';

  renderModalItems(order, isModalEditMode);
  renderModalActions(order);
}

// === Render Items in Modal (supports both view and edit modes) ===
function renderModalItems(order, isEditMode = false) {
  const itemsBody = document.getElementById('modalItemsBody');
  itemsBody.innerHTML = '';

  const isEditable = order.status !== 'ยืนยันแล้ว' && order.status !== 'ยกเลิก';

  order.items.forEach((item, index) => {
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.qty || 1);
    const itemSubtotal = Number(item.subtotal || (itemPrice * itemQty));

    const tr = document.createElement('tr');
    tr.dataset.index = index;

    if (isEditMode) {
      tr.innerHTML = `
        <td>${item.id || '-'}</td>
        <td><strong>${item.name || '-'}</strong></td>
        <td>
          <input type="number" class="input-edit-qty" data-index="${index}" value="${itemQty}" min="1" oninput="onRowEditChange(${index})">
        </td>
        <td>
          <input type="number" class="input-edit-price" data-index="${index}" value="${itemPrice}" min="0" step="1" oninput="onRowEditChange(${index})">
        </td>
        <td><span class="row-subtotal-text" id="rowSubtotal_${index}">฿${itemSubtotal.toLocaleString()}</span></td>
        <td style="text-align:center;">
          ${order.items.length > 1
            ? `<button class="btn-delete-item" onclick="deleteOrderItem('${order.orderId}', ${index})" title="ลบรายการนี้">🗑️</button>`
            : `<span style="color:#cbd5e1; font-size:14px;">—</span>`
          }
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td>${item.id || '-'}</td>
        <td><strong>${item.name || '-'}</strong></td>
        <td>x${itemQty}</td>
        <td>฿${itemPrice.toLocaleString()}</td>
        <td>฿${itemSubtotal.toLocaleString()}</td>
        <td style="text-align:center;">
          ${isEditable && order.items.length > 1
            ? `<button class="btn-delete-item" onclick="deleteOrderItem('${order.orderId}', ${index})" title="ลบรายการนี้">🗑️</button>`
            : `<span style="color:#cbd5e1; font-size:14px;">—</span>`
          }
        </td>
      `;
    }
    itemsBody.appendChild(tr);
  });

  const grandTotal = Number(order.totalPrice || 0);
  document.getElementById('modalTotalPrice').textContent = `฿${grandTotal.toLocaleString()}`;
}

// Handle real-time input change for price and quantity
function onRowEditChange(index) {
  const qtyInput = document.querySelector(`.input-edit-qty[data-index="${index}"]`);
  const priceInput = document.querySelector(`.input-edit-price[data-index="${index}"]`);
  const subtotalEl = document.getElementById(`rowSubtotal_${index}`);

  if (!qtyInput || !priceInput) return;

  const qty = Math.max(1, parseInt(qtyInput.value) || 1);
  const price = Math.max(0, parseFloat(priceInput.value) || 0);
  const subtotal = qty * price;

  if (subtotalEl) {
    subtotalEl.textContent = `฿${subtotal.toLocaleString()}`;
  }

  recalculateModalTotalFromInputs();
}

// Recalculate grand total from all editable row inputs
function recalculateModalTotalFromInputs() {
  let grandTotal = 0;
  const qtyInputs = document.querySelectorAll('.input-edit-qty');
  const priceInputs = document.querySelectorAll('.input-edit-price');

  qtyInputs.forEach((qEl, idx) => {
    const pEl = priceInputs[idx];
    if (pEl) {
      const q = Math.max(1, parseInt(qEl.value) || 1);
      const p = Math.max(0, parseFloat(pEl.value) || 0);
      grandTotal += (q * p);
    }
  });

  const totalEl = document.getElementById('modalTotalPrice');
  if (totalEl) {
    totalEl.textContent = `฿${grandTotal.toLocaleString()}`;
  }
}

// Save order item and price changes, then notify customer via LINE
async function saveOrderChanges() {
  if (!currentViewingOrderId) return;
  const order = allOrders.find(o => o.orderId === currentViewingOrderId);
  if (!order) return;

  const qtyInputs = document.querySelectorAll('.input-edit-qty');
  const priceInputs = document.querySelectorAll('.input-edit-price');
  const updatedItems = [];
  let newTotal = 0;

  order.items.forEach((item, idx) => {
    const qInput = qtyInputs[idx];
    const pInput = priceInputs[idx];
    const qty = qInput ? Math.max(1, parseInt(qInput.value) || 1) : Number(item.qty || 1);
    const price = pInput ? Math.max(0, parseFloat(pInput.value) || 0) : Number(item.price || 0);
    const subtotal = qty * price;
    newTotal += subtotal;

    updatedItems.push({
      ...item,
      qty: qty,
      price: price,
      subtotal: subtotal
    });
  });

  const changeNoteInput = document.getElementById('editChangeNote');
  const changeNote = changeNoteInput ? changeNoteInput.value.trim() : '';

  if (!confirm(`ยืนยันการปรับเปลี่ยนข้อมูลออเดอร์ ${currentViewingOrderId} และส่งข้อความแจ้งเตือนหาลูกค้าผ่าน LINE หรือไม่?`)) {
    return;
  }

  const btnSave = document.getElementById('btnSaveEditOrder');
  const btnCancel = document.getElementById('btnCancelEditOrder');
  if (btnSave) { btnSave.disabled = true; btnSave.textContent = '⏳ กำลังบันทึก & แจ้งลูกค้า...'; }
  if (btnCancel) btnCancel.disabled = true;

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'updateOrderItems',
        orderId: currentViewingOrderId,
        items: updatedItems,
        totalPrice: newTotal,
        notifyCustomer: true,
        changeNote: changeNote
      })
    });

    const result = await response.json();

    if (result.status === 'success') {
      alert('✅ บันทึกการแก้ไขข้อมูลและแจ้งเตือนลูกค้าผ่าน LINE เรียบร้อยแล้ว!');
      order.items = updatedItems;
      order.totalPrice = newTotal;
      isModalEditMode = false;

      const noteBox = document.getElementById('editNoteContainer');
      if (noteBox) noteBox.style.display = 'none';

      renderModalItems(order, false);
      renderModalActions(order);
      renderOrders();
      updateStats();
    } else {
      alert('❌ ไม่สามารถบันทึกได้: ' + (result.message || 'Unknown error'));
      if (btnSave) { btnSave.disabled = false; btnSave.textContent = '💾 บันทึกการแก้ไข & แจ้งลูกค้า'; }
      if (btnCancel) btnCancel.disabled = false;
    }
  } catch (error) {
    console.error('Save order changes error:', error);
    alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ');
    if (btnSave) { btnSave.disabled = false; btnSave.textContent = '💾 บันทึกการแก้ไข & แจ้งลูกค้า'; }
    if (btnCancel) btnCancel.disabled = false;
  }
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
        totalPrice: newTotal,
        notifyCustomer: true,
        changeNote: `ลบรายการสินค้า "${itemName}" ออกจากออเดอร์`
      })
    });

    const result = await response.json();

    if (result.status === 'success') {
      // Update local data
      order.items = newItems;
      order.totalPrice = newTotal;

      // Re-render items
      renderModalItems(order, isModalEditMode);
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

// Helper: robustly extract Google Maps URL from HYPERLINK formula, plain text URL, coordinates, or search fallback
function extractGpsUrl(gpsRaw, addressDetails, customerName) {
  let str = (gpsRaw || '').toString().trim();

  // 1. Extract URL from HYPERLINK formula e.g. HYPERLINK("https://...", "...") or HYPERLINK('https://...', '...')
  if (str.includes('HYPERLINK')) {
    const match = str.match(/HYPERLINK\(\s*["']([^"']+)["']/i);
    if (match && match[1]) return match[1];
  }

  // 2. Extract URL starting with http:// or https:// anywhere in the string
  const urlMatch = str.match(/(https?:\/\/[^\s"'>]+)/i);
  if (urlMatch && urlMatch[1]) return urlMatch[1];

  // 3. Match coordinates (lat, lng) e.g. 13.7563, 100.5018
  const coordMatch = str.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (coordMatch) {
    return `https://www.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}`;
  }

  // 4. Fallback: Search Google Maps by address or customer name if no URL was embedded
  const query = (addressDetails || '').trim() || (customerName || '').trim();
  if (query && query !== '-') {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  return '';
}
