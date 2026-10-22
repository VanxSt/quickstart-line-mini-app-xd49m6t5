const GOOGLE_SCRIPT_URL = 'https://kuekoonkan-api.noperfecf.workers.dev';

let allOrders = [];
let allMembers = [];
let activeFilter = 'กำลังตรวจสอบออเดอร์';
let activePaymentFilter = 'all';
let searchQuery = '';
let memberSearchQuery = '';
let currentViewingOrderId = null;
let currentTab = 'overview'; // 'overview' | 'orders' | 'products' | 'members'

// Product Catalog State
let allProducts = [];
let filteredProducts = [];
let productSearchQuery = '';
let productSelectedCategory = 'all';
let productSelectedTag = 'all';
let productSortOrder = 'default';
let productViewMode = 'table'; // 'table' | 'grid'
let productVisibleLimit = 50;
let isProductsLoading = false;
let currentViewingProduct = null;
let adminProducts = [];
let isAdminProductsLoaded = false;

let soundEnabled = localStorage.getItem('admin_sound_enabled') !== 'false';
let readOrderIds = JSON.parse(localStorage.getItem('admin_read_orders') || '[]');
let knownOrderIds = new Set();
let isInitialOrdersLoad = true;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playNotificationChime(isTest) {
  if (!soundEnabled && !isTest) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [{ freq: 1047, s: 0, d: 0.25 }, { freq: 1319, s: 0.15, d: 0.25 }, { freq: 1568, s: 0.3, d: 0.5 }].forEach(n => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.s);
      g.gain.setValueAtTime(0.8, now + n.s);
      g.gain.exponentialRampToValueAtTime(0.001, now + n.s + n.d);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + n.s); osc.stop(now + n.s + n.d);
    });
  } catch (e) { console.error('Audio error:', e); }
}

function showNewOrderToast(count) {
  document.querySelectorAll('.toast-notification').forEach(el => el.remove());
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `<span class="toast-icon">🛒</span> มีออเดอร์ใหม่เข้ามา ${count} รายการ!`;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4200);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('admin_sound_enabled', soundEnabled);
  updateSoundButtonUI();
  if (soundEnabled) { playNotificationChime(true); showNewOrderToast(0); }
}

function testSound() {
  playNotificationChime(true);
  showNewOrderToast(1);
}

function updateSoundButtonUI() {
  const btn = document.getElementById('soundToggleBtn');
  if (!btn) return;
  if (soundEnabled) {
    btn.classList.add('active');
    btn.innerHTML = '🔔 เสียงเตือน: เปิด';
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '🔕 เสียงเตือน: ปิด';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateSoundButtonUI();

  // โหลดข้อมูล Cache เดิมก่อนทันที (0ms) หน้าเว็บจะได้ไม่ค้างหมุน
  try {
    const cached = localStorage.getItem('cached_admin_orders');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        processIncomingOrders(parsed);
      }
    }
  } catch (e) { }

  fetchOrders(true);
  fetchProducts(false);
  fetchMembers(false);

  // ตั้งเวลาดึงข้อมูลอัตโนมัติทุกๆ 12 วินาที
  setInterval(() => {
    if (currentTab === 'overview') {
      fetchOrders(false);
    } else if (currentTab === 'orders') {
      fetchOrders(false);
    } else if (currentTab === 'members') {
      fetchMembers(false);
    }
  }, 12000);

  const btnRefresh = document.getElementById('refreshBtn');
  if (btnRefresh) btnRefresh.addEventListener('click', () => fetchOrders(true));
  const btnRefreshMembers = document.getElementById('refreshMembersBtn');
  if (btnRefreshMembers) {
    btnRefreshMembers.addEventListener('click', () => fetchMembers(true));
  }
  const btnCloseModal = document.getElementById('closeModalBtn');
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

  // Navigation Switcher (Overview, Orders, Products, Members)
  const navOverview = document.getElementById('navOverview');
  const navOrders = document.getElementById('navOrders');
  const navProducts = document.getElementById('navProducts');
  const navMembers = document.getElementById('navMembers');
  const viewOverview = document.getElementById('viewOverview');
  const viewOrders = document.getElementById('viewOrders');
  const viewProducts = document.getElementById('viewProducts');
  const viewMembers = document.getElementById('viewMembers');

  function switchDashboardTab(tab) {
    currentTab = tab;
    [navOverview, navOrders, navProducts, navMembers].forEach(n => { if (n) n.classList.remove('active'); });
    [viewOverview, viewOrders, viewProducts, viewMembers].forEach(v => { if (v) v.style.display = 'none'; });

    if (tab === 'overview') {
      if (navOverview) navOverview.classList.add('active');
      if (viewOverview) viewOverview.style.display = 'block';
      if (typeof renderOverviewDashboard === 'function') renderOverviewDashboard();
      fetchOrders(false);
    } else if (tab === 'orders') {
      if (navOrders) navOrders.classList.add('active');
      if (viewOrders) viewOrders.style.display = 'block';
      fetchOrders(false);
    } else if (tab === 'products') {
      if (navProducts) navProducts.classList.add('active');
      if (viewProducts) viewProducts.style.display = 'block';
      fetchProducts(allProducts.length === 0);
    } else if (tab === 'members') {
      if (navMembers) navMembers.classList.add('active');
      if (viewMembers) viewMembers.style.display = 'block';
      fetchMembers(allMembers.length === 0);
    }
  }
  window.switchDashboardTab = switchDashboardTab;
  window.switchTab = switchDashboardTab;

  const btnRefreshProducts = document.getElementById('refreshProductsBtn');
  if (btnRefreshProducts) {
    btnRefreshProducts.addEventListener('click', () => fetchProducts(true));
  }

  if (navOverview) navOverview.addEventListener('click', (e) => { e.preventDefault(); switchDashboardTab('overview'); });
  if (navOrders) navOrders.addEventListener('click', (e) => { e.preventDefault(); switchDashboardTab('orders'); });
  if (navProducts) navProducts.addEventListener('click', (e) => { e.preventDefault(); switchDashboardTab('products'); });
  if (navMembers) navMembers.addEventListener('click', (e) => { e.preventDefault(); switchDashboardTab('members'); });


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

  // Search Input for Products
  const productSearchInput = document.getElementById('adminProductSearchInput');
  if (productSearchInput) {
    productSearchInput.addEventListener('input', (e) => {
      productSearchQuery = e.target.value.trim();
      applyProductFilters();
    });
  }
});

function setPaymentFilter(val) {
  activePaymentFilter = val;
  renderOrders();
}
window.setPaymentFilter = setPaymentFilter;

function processIncomingOrders(orders) {
  allOrders = orders || [];
  try {
    localStorage.setItem('cached_admin_orders', JSON.stringify(allOrders));
  } catch (e) { }

  let newCount = 0;
  allOrders.forEach(o => {
    if (o.orderId && !knownOrderIds.has(o.orderId)) {
      if (!isInitialOrdersLoad) newCount++;
      knownOrderIds.add(o.orderId);
    }
  });

  if (newCount > 0 && !isInitialOrdersLoad) {
    playNotificationChime(false);
    showNewOrderToast(newCount);
  }
  isInitialOrdersLoad = false;

  renderOrders();
  updateStats();
  renderOverviewDashboard();
}

function goToPendingOrders() {
  switchDashboardTab('orders');
  const pendingBtn = document.querySelector('.tab-btn[onclick*="กำลังตรวจสอบออเดอร์"]');
  if (pendingBtn) {
    setFilter('กำลังตรวจสอบออเดอร์', pendingBtn);
  } else {
    activeFilter = 'กำลังตรวจสอบออเดอร์';
    renderOrders();
  }
}
window.goToPendingOrders = goToPendingOrders;

function refreshOverviewData() {
  fetchOrders(true);
  fetchProducts(true);
  fetchMembers(true);
  renderOverviewDashboard();
  showToast('รีเฟรชข้อมูลภาพรวมแล้ว', 'success');
}
window.refreshOverviewData = refreshOverviewData;

function formatCompactNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return String(num);
}

let currentChartDisplayMode = 'all';
let overviewChartInstance = null;

function setChartDisplayMode(mode, btn) {
  currentChartDisplayMode = mode;
  document.querySelectorAll('#btnChartModeAll, #btnChartModeSales, #btnChartModeOrders').forEach(b => {
    b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  render7DayTrendChart();
}
window.setChartDisplayMode = setChartDisplayMode;

function render7DayTrendChart() {
  const canvas = document.getElementById('overviewSalesChartCanvas');
  if (!canvas) return;

  const days = [];
  const dayLabels = [];
  const daySales = [0, 0, 0, 0, 0, 0, 0];
  const dayOrders = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push(dateStr);

    if (i === 0) {
      dayLabels.push('วันนี้');
    } else {
      const thDay = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      dayLabels.push(thDay);
    }
  }

  allOrders.forEach(o => {
    if (!o.timestamp) return;
    try {
      const d = new Date(o.timestamp);
      if (isNaN(d.getTime())) return;
      const oDateStr = d.toISOString().slice(0, 10);
      const dayIndex = days.indexOf(oDateStr);
      if (dayIndex !== -1) {
        dayOrders[dayIndex]++;
        const meta = getStatusMeta(o.status);
        if (meta.name !== 'ยกเลิก') {
          daySales[dayIndex] += Number(o.totalPrice || 0);
        }
      }
    } catch(e) {}
  });

  if (typeof Chart !== 'undefined') {
    renderWithChartJs(canvas, dayLabels, daySales, dayOrders);
  } else {
    renderWithCanvasFallback(canvas, dayLabels, daySales, dayOrders);
  }
}

function renderWithChartJs(canvas, dayLabels, daySales, dayOrders) {
  const ctx = canvas.getContext('2d');
  if (overviewChartInstance) {
    overviewChartInstance.destroy();
    overviewChartInstance = null;
  }

  // Elegant gradient for Sales Bars
  const salesGrad = ctx.createLinearGradient(0, 0, 0, 240);
  salesGrad.addColorStop(0, '#2563eb');
  salesGrad.addColorStop(1, '#60a5fa');

  // Subtle fill gradient for Orders Line
  const ordersFillGrad = ctx.createLinearGradient(0, 0, 0, 240);
  ordersFillGrad.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
  ordersFillGrad.addColorStop(1, 'rgba(16, 185, 129, 0.01)');

  const showSales = (currentChartDisplayMode === 'all' || currentChartDisplayMode === 'sales');
  const showOrders = (currentChartDisplayMode === 'all' || currentChartDisplayMode === 'orders');

  const datasets = [];

  if (showSales) {
    datasets.push({
      type: 'bar',
      label: 'ยอดขาย (บาท)',
      data: daySales,
      backgroundColor: salesGrad,
      hoverBackgroundColor: '#1d4ed8',
      borderRadius: 8,
      borderSkipped: false,
      barPercentage: 0.42,
      categoryPercentage: 0.65,
      yAxisID: 'ySales',
      order: 2
    });
  }

  if (showOrders) {
    datasets.push({
      type: 'line',
      label: 'จำนวนออเดอร์',
      data: dayOrders,
      borderColor: '#10b981',
      backgroundColor: ordersFillGrad,
      borderWidth: 3,
      tension: 0.35,
      fill: (currentChartDisplayMode === 'orders'),
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#10b981',
      pointBorderWidth: 2.5,
      pointRadius: 5,
      pointHoverRadius: 8,
      pointHoverBackgroundColor: '#10b981',
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 3,
      yAxisID: showSales ? 'yOrders' : 'ySales',
      order: 1
    });
  }

  overviewChartInstance = new Chart(ctx, {
    data: {
      labels: dayLabels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 500,
        easing: 'easeOutQuart'
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          titleColor: '#93c5fd',
          bodyColor: '#ffffff',
          titleFont: { family: "'Prompt', 'Inter', sans-serif", size: 13, weight: '700' },
          bodyFont: { family: "'Prompt', 'Inter', sans-serif", size: 12.5, weight: '600' },
          padding: 12,
          cornerRadius: 12,
          boxPadding: 6,
          usePointStyle: true,
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          callbacks: {
            label: function(ctxItem) {
              const val = Number(ctxItem.raw || 0);
              if (ctxItem.dataset.label.includes('ยอดขาย')) {
                return `  💰 ยอดขาย: ฿${val.toLocaleString()}`;
              } else {
                return `  🛒 คำสั่งซื้อ: ${val.toLocaleString()} รายการ`;
              }
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "'Prompt', sans-serif", size: 12, weight: '500' },
            color: '#64748b'
          }
        },
        ySales: {
          type: 'linear',
          display: showSales,
          position: 'left',
          beginAtZero: true,
          grid: {
            color: 'rgba(226, 232, 240, 0.7)',
            drawBorder: false
          },
          ticks: {
            font: { family: "'Prompt', sans-serif", size: 11, weight: '500' },
            color: '#64748b',
            callback: function(v) {
              return '฿' + formatCompactNumber(v);
            }
          }
        },
        yOrders: {
          type: 'linear',
          display: showSales && showOrders,
          position: 'right',
          beginAtZero: true,
          grid: { display: false },
          ticks: {
            font: { family: "'Prompt', sans-serif", size: 11, weight: '600' },
            color: '#10b981',
            precision: 0,
            callback: function(v) {
              return v + ' ออเดอร์';
            }
          }
        }
      }
    }
  });
}

function renderWithCanvasFallback(canvas, dayLabels, daySales, dayOrders) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 600;
  const h = rect.height || 260;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const maxSales = Math.max(...daySales, 1000);
  const maxOrders = Math.max(...dayOrders, 5);

  const padLeft = 60;
  const padRight = 50;
  const padTop = 30;
  const padBottom = 35;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;
  const baseLineY = padTop + plotH;

  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  [0, 0.5, 1].forEach(pct => {
    const y = padTop + plotH * (1 - pct);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = "500 11px 'Prompt', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText('฿' + formatCompactNumber(Math.round(maxSales * pct)), padLeft - 10, y + 4);
  });
  ctx.setLineDash([]);

  const colW = plotW / 7;
  const orderPoints = [];

  for (let i = 0; i < 7; i++) {
    const cx = padLeft + (i + 0.5) * colW;
    const bW = Math.min(36, colW * 0.55);
    const bX = cx - bW / 2;
    const bH = (daySales[i] / maxSales) * (plotH - 15);
    const bY = baseLineY - bH;

    if (daySales[i] > 0) {
      const grad = ctx.createLinearGradient(0, bY, 0, baseLineY);
      grad.addColorStop(0, '#2563eb');
      grad.addColorStop(1, '#60a5fa');
      ctx.fillStyle = grad;

      ctx.beginPath();
      const r = Math.min(6, bH / 2);
      ctx.moveTo(bX + r, bY);
      ctx.lineTo(bX + bW - r, bY);
      ctx.quadraticCurveTo(bX + bW, bY, bX + bW, bY + r);
      ctx.lineTo(bX + bW, baseLineY);
      ctx.lineTo(bX, baseLineY);
      ctx.lineTo(bX, bY + r);
      ctx.quadraticCurveTo(bX, bY, bX + r, bY);
      ctx.fill();

      ctx.fillStyle = '#1e40af';
      ctx.font = "700 10.5px 'Prompt', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('฿' + formatCompactNumber(daySales[i]), cx, bY - 6);
    }

    ctx.fillStyle = (i === 6) ? '#2563eb' : '#64748b';
    ctx.font = (i === 6) ? "700 12px 'Prompt', sans-serif" : "500 12px 'Prompt', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(dayLabels[i], cx, baseLineY + 20);

    const oY = baseLineY - (dayOrders[i] / maxOrders) * (plotH - 25);
    orderPoints.push({ x: cx, y: oY, orders: dayOrders[i] });
  }

  if (orderPoints.length > 0) {
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(orderPoints[0].x, orderPoints[0].y);
    for (let i = 0; i < orderPoints.length - 1; i++) {
      const xc = (orderPoints[i].x + orderPoints[i + 1].x) / 2;
      const yc = (orderPoints[i].y + orderPoints[i + 1].y) / 2;
      ctx.quadraticCurveTo(orderPoints[i].x, orderPoints[i].y, xc, yc);
    }
    ctx.lineTo(orderPoints[orderPoints.length - 1].x, orderPoints[orderPoints.length - 1].y);
    ctx.stroke();

    orderPoints.forEach(pt => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (pt.orders > 0) {
        ctx.fillStyle = '#059669';
        ctx.font = "700 10px 'Prompt', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(pt.orders, pt.x, pt.y - 7);
      }
    });
  }
}

function renderStatusBreakdown(stats) {
  const container = document.getElementById('overviewStatusBreakdown');
  if (!container) return;
  const total = Math.max(stats.total, 1);

  const items = [
    { label: '⏳ รอตรวจสอบออเดอร์', count: stats.checking, color: '#f59e0b', bg: '#fef3c7' },
    { label: '💳 ชำระเงิน / รอตรวจสอบยอด', count: stats.payment, color: '#0284c7', bg: '#e0f2fe' },
    { label: '🚚 กำลังจัดเตรียม & จัดส่ง', count: stats.shipping, color: '#8b5cf6', bg: '#ede9fe' },
    { label: '✅ จัดส่งสำเร็จ (ยอดขาย)', count: stats.completed, color: '#10b981', bg: '#dcfce7' },
    { label: '❌ ยกเลิกคำสั่งซื้อ', count: stats.cancelled, color: '#ef4444', bg: '#fee2e2' }
  ];

  let html = '';
  items.forEach(it => {
    const pct = stats.total > 0 ? Math.round((it.count / total) * 100) : 0;
    html += `
      <div class="breakdown-item">
        <div class="breakdown-item-header">
          <span style="color: var(--text-main); font-weight: 600;">${it.label}</span>
          <span>
            <strong style="color: ${it.color};">${it.count.toLocaleString()}</strong> 
            <span style="font-size: 11.5px; color: var(--text-muted); font-weight: normal;">(${pct}%)</span>
          </span>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill" style="width: ${pct}%; background: ${it.color};"></div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderPaymentBreakdown(counts, total) {
  const container = document.getElementById('overviewPaymentBreakdown');
  const totalEl = document.getElementById('ovPaymentTotalCount');
  const sum = (counts['โอนจ่าย'] + counts['ปลายทาง'] + counts['เงินสด/อื่นๆ']);
  if (totalEl) totalEl.textContent = sum.toLocaleString() + ' รายการ';
  if (!container) return;

  const validTotal = Math.max(sum, 1);
  const methods = [
    { name: '🏦 โอนจ่ายผ่านบัญชี', count: counts['โอนจ่าย'], color: '#2563eb' },
    { name: '📦 ปลายทาง (เก็บเงินสด COD)', count: counts['ปลายทาง'], color: '#f59e0b' },
    { name: '💵 เงินสด / ช่องทางอื่นๆ', count: counts['เงินสด/อื่นๆ'], color: '#10b981' }
  ];

  let html = '';
  methods.forEach(m => {
    const pct = sum > 0 ? Math.round((m.count / validTotal) * 100) : 0;
    html += `
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; padding: 6px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid var(--border);">
        <span style="font-weight: 500; color: var(--text-main);">${m.name}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 700; color: ${m.color};">${m.count.toLocaleString()}</span>
          <span class="kpi-badge-pill" style="font-size: 10.5px;">${pct}%</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderRecentOrdersList() {
  const tbody = document.getElementById('overviewRecentOrdersBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const recent = allOrders.slice(0, 6);
  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px 10px; color:var(--text-muted);">ยังไม่มีรายการคำสั่งซื้อ</td></tr>';
    return;
  }

  recent.forEach(o => {
    const tr = document.createElement('tr');
    const meta = getStatusMeta(o.status);
    const dateStr = o.timestamp ? new Date(o.timestamp).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    const isTransfer = (o.paymentMethod && (o.paymentMethod.includes('โอน') || o.paymentMethod.includes('บัญชีธนาคาร') || o.paymentMethod.includes('ผสม')));
    const payBadgeClass = isTransfer ? 'pay-badge transfer' : 'pay-badge cod';

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-size:13px;">${o.orderId || '-'}</strong>
        <div style="margin-top:2px;"><span class="${payBadgeClass}" style="font-size:10px; padding:2px 6px;">${o.paymentMethod || 'โอนจ่าย'}</span></div>
      </td>
      <td style="font-size:12px; color:var(--text-muted);">${dateStr}</td>
      <td>
        <div style="font-weight:600; font-size:13px; color:var(--text-main);">${o.customerName || 'ไม่ระบุชื่อ'}</div>
        <div style="font-size:11px; color:var(--text-muted);">${(o.phone || '').replace(/'/g, '')}</div>
      </td>
      <td><strong style="font-size:13.5px; color:var(--text-main);">฿${Number(o.totalPrice || 0).toLocaleString()}</strong></td>
      <td><span class="status-badge ${meta.class}" style="font-size:11px; padding:3px 8px;">${meta.icon} ${meta.name}</span></td>
      <td style="text-align:right;">
        <button class="btn-action" onclick="viewOrder('${o.orderId || ''}')" style="padding:4px 8px; font-size:11.5px;">👁️ ดู</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTopSellersList(itemSalesMap) {
  const container = document.getElementById('overviewTopSellersList');
  if (!container) return;
  container.innerHTML = '';

  let sortedItems = Object.values(itemSalesMap).sort((a, b) => b.qty - a.qty);

  let isFallback = false;
  if (sortedItems.length === 0 && allProducts.length > 0) {
    isFallback = true;
    sortedItems = allProducts.slice(0, 5).map(p => ({
      id: p.id,
      name: p.name,
      qty: 0,
      revenue: p.price || 0,
      img: p.img
    }));
  }

  if (sortedItems.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:13px;">ยังไม่มีข้อมูลสินค้าขายดี</div>';
    return;
  }

  const top5 = sortedItems.slice(0, 5);
  top5.forEach((item, idx) => {
    const matchedProduct = allProducts.find(p => String(p.id) === String(item.id)) || {};
    const imgUrl = getOptimizedImageUrl(item.img || matchedProduct.img);
    const category = matchedProduct.category || 'ทั่วไป';

    let rankClass = 'rank-other';
    let rankLabel = String(idx + 1);
    if (idx === 0) { rankClass = 'rank-1'; rankLabel = '🥇'; }
    else if (idx === 1) { rankClass = 'rank-2'; rankLabel = '🥈'; }
    else if (idx === 2) { rankClass = 'rank-3'; rankLabel = '🥉'; }

    const div = document.createElement('div');
    div.className = 'top-seller-item';
    div.innerHTML = `
      <div class="top-seller-rank ${rankClass}">${rankLabel}</div>
      <img src="${imgUrl}" alt="${item.name || ''}" class="top-seller-img" onerror="this.onerror=null; this.src='https://placehold.co/400x400/f3f0ec/a88b62?text=No+Image';">
      <div class="top-seller-details">
        <div class="top-seller-name" title="${item.name}">${item.name || 'ไม่มีชื่อสินค้า'}</div>
        <div class="top-seller-meta">
          <span>รหัส: ${item.id}</span>
          <span>•</span>
          <span>📂 ${category}</span>
        </div>
      </div>
      <div class="top-seller-sales">
        <div class="top-seller-revenue">฿${Number(item.revenue || 0).toLocaleString()}</div>
        <div class="top-seller-qty">${isFallback ? 'ราคาเริ่มต้น' : 'ขายแล้ว ' + item.qty.toLocaleString() + ' ชิ้น'}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderOverviewDashboard() {
  const dateEl = document.getElementById('overviewCurrentDate');
  if (dateEl) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('th-TH', options);
  }

  let totalSales = 0;
  let completedCount = 0;
  let checkingCount = 0;
  let waitingCount = 0;
  let paymentCount = 0;
  let preparingCount = 0;
  let shippingCount = 0;
  let cancelledCount = 0;

  let todaySales = 0;
  let todayOrdersCount = 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  const paymentMethodCounts = {
    'โอนจ่าย': 0,
    'ปลายทาง': 0,
    'เงินสด/อื่นๆ': 0
  };

  const itemSalesMap = {};

  allOrders.forEach(o => {
    const meta = getStatusMeta(o.status);
    const normStatus = meta.name;
    const total = Number(o.totalPrice || 0);

    let orderDateStr = '';
    if (o.timestamp) {
      try {
        const dt = new Date(o.timestamp);
        if (!isNaN(dt.getTime())) {
          orderDateStr = dt.toISOString().slice(0, 10);
        }
      } catch(e) {}
    }

    if (orderDateStr === todayStr) {
      todayOrdersCount++;
      if (normStatus !== 'ยกเลิก') {
        todaySales += total;
      }
    }

    if (normStatus === 'กำลังตรวจสอบออเดอร์') checkingCount++;
    else if (normStatus === 'รอการยืนยัน') waitingCount++;
    else if (normStatus === 'ชำระเงิน') paymentCount++;
    else if (normStatus === 'กำลังจัดเตรียมสินค้า') preparingCount++;
    else if (normStatus === 'กำลังจัดส่ง') shippingCount++;
    else if (normStatus === 'จัดส่งสำเร็จ') {
      completedCount++;
      totalSales += total;
    } else if (normStatus === 'ยกเลิก') {
      cancelledCount++;
    }

    const pm = (o.paymentMethod || 'โอนจ่าย').trim();
    if (pm.includes('โอน') || pm.includes('บัญชีธนาคาร')) {
      paymentMethodCounts['โอนจ่าย']++;
    } else if (pm.includes('ปลายทาง') || pm.includes('COD')) {
      paymentMethodCounts['ปลายทาง']++;
    } else {
      paymentMethodCounts['เงินสด/อื่นๆ']++;
    }

    if (normStatus !== 'ยกเลิก' && Array.isArray(o.items)) {
      o.items.forEach(it => {
        const sku = String(it.id || it.name || 'item').trim();
        const q = Number(it.qty || 1);
        const p = Number(it.price || 0);
        const sub = Number(it.subtotal || (p * q));

        if (!itemSalesMap[sku]) {
          itemSalesMap[sku] = {
            id: it.id || sku,
            name: it.name || sku,
            qty: 0,
            revenue: 0,
            img: it.img || ''
          };
        }
        itemSalesMap[sku].qty += q;
        itemSalesMap[sku].revenue += sub;
        if (it.img && !itemSalesMap[sku].img) itemSalesMap[sku].img = it.img;
      });
    }
  });

  const ovTotalSales = document.getElementById('ovStatTotalSales');
  const ovCompletedCount = document.getElementById('ovStatCompletedCount');
  if (ovTotalSales) ovTotalSales.textContent = '฿' + totalSales.toLocaleString();
  if (ovCompletedCount) ovCompletedCount.textContent = completedCount + ' ออเดอร์';

  const ovTodaySales = document.getElementById('ovStatTodaySales');
  const ovTodayOrders = document.getElementById('ovStatTodayOrders');
  if (ovTodaySales) ovTodaySales.textContent = '฿' + todaySales.toLocaleString();
  if (ovTodayOrders) ovTodayOrders.textContent = todayOrdersCount + ' ออเดอร์';

  const ovTotalOrders = document.getElementById('ovStatTotalOrders');
  const ovCompletedPercent = document.getElementById('ovStatCompletedPercent');
  const ovCancelledCount = document.getElementById('ovStatCancelledCount');
  const totalOrdersCount = allOrders.length;
  if (ovTotalOrders) ovTotalOrders.textContent = totalOrdersCount.toLocaleString();
  const compRate = totalOrdersCount > 0 ? Math.round((completedCount / totalOrdersCount) * 100) : 0;
  if (ovCompletedPercent) ovCompletedPercent.textContent = compRate + '%';
  if (ovCancelledCount) ovCancelledCount.textContent = cancelledCount;

  const ovPendingTotal = document.getElementById('ovStatPendingTotal');
  const ovCheckingCount = document.getElementById('ovStatCheckingCount');
  const ovPaymentCount = document.getElementById('ovStatPaymentCount');
  const pendingTotalCount = checkingCount + waitingCount + paymentCount;
  if (ovPendingTotal) ovPendingTotal.textContent = pendingTotalCount;
  if (ovCheckingCount) ovCheckingCount.textContent = (checkingCount + waitingCount);
  if (ovPaymentCount) ovPaymentCount.textContent = paymentCount;

  const ovTotalMembers = document.getElementById('ovStatTotalMembers');
  const ovPhoneMembers = document.getElementById('ovStatPhoneMembers');
  if (ovTotalMembers) ovTotalMembers.textContent = allMembers.length.toLocaleString();
  let phoneCount = 0;
  allMembers.forEach(m => { if (m.phone && m.phone.trim() !== '') phoneCount++; });
  if (ovPhoneMembers) ovPhoneMembers.textContent = phoneCount + ' คน';

  const ovTotalProducts = document.getElementById('ovStatTotalProducts');
  const ovCategories = document.getElementById('ovStatCategories');
  if (ovTotalProducts) ovTotalProducts.textContent = allProducts.length.toLocaleString();
  const catSet = new Set();
  allProducts.forEach(p => { if (p.category) catSet.add(p.category); });
  if (ovCategories) ovCategories.textContent = catSet.size + ' หมวดหมู่';

  const alertBanner = document.getElementById('overviewAlertBanner');
  const alertTitle = document.getElementById('overviewAlertTitle');
  const urgentOrdersCount = checkingCount + waitingCount;
  if (alertBanner && alertTitle) {
    if (urgentOrdersCount > 0) {
      alertTitle.textContent = '⚡ มีคำสั่งซื้อรอตรวจสอบ ' + urgentOrdersCount + ' รายการ ที่ต้องดำเนินการทันที';
      alertBanner.style.display = 'flex';
    } else {
      alertBanner.style.display = 'none';
    }
  }

  render7DayTrendChart();

  renderStatusBreakdown({
    checking: checkingCount + waitingCount,
    payment: paymentCount,
    shipping: preparingCount + shippingCount,
    completed: completedCount,
    cancelled: cancelledCount,
    total: totalOrdersCount
  });

  renderPaymentBreakdown(paymentMethodCounts, totalOrdersCount);
  renderRecentOrdersList();
  renderTopSellersList(itemSalesMap);
}
window.renderOverviewDashboard = renderOverviewDashboard;

async function fetchOrders(showLoading = true) {
  const loading = document.getElementById('loadingIndicator');

  // ถ้ามีข้อมูลใน Cache แล้ว ให้ซ่อน spinner เพื่อความลื่นไหล
  if (showLoading && allOrders.length === 0) {
    if (loading) loading.style.display = 'flex';
    document.getElementById('ordersBody').innerHTML = '';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllOrders&_t=${Date.now()}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const result = await response.json();

    if (result.status === 'success') {
      processIncomingOrders(result.orders || []);
    } else {
      console.error("Error fetching orders:", result);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Fetch error:", error);
    const tbody = document.getElementById('ordersBody');
    if (allOrders.length === 0 && tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
            <div style="font-size: 36px; margin-bottom: 8px;">⚠️</div>
            <p style="font-weight: 600; color: #ef4444; margin-bottom: 6px;">ไม่สามารถดึงข้อมูลจาก Google Apps Script ได้</p>
            <p style="font-size: 13px; margin-bottom: 16px;">กรุณาตรวจสอบว่าตั้งค่า 'Who has access' เป็น 'Anyone' ใน Web App Deployment หรือยัง</p>
            <button onclick="fetchOrders(true)" style="padding: 8px 16px; border-radius: 8px; background: var(--primary); color: white; border: none; font-weight: 600; cursor: pointer;">🔄 ลองใหม่อีกครั้ง</button>
          </td>
        </tr>
      `;
    }
  } finally {
    if (loading) {
      loading.style.display = 'none';
    }
  }
}



function getStatusMeta(status) {
  const s = (status || '').trim();
  if (s === 'กำลังตรวจสอบออเดอร์' || s === 'รอตรวจสอบ') {
    return { name: 'กำลังตรวจสอบออเดอร์', class: 'status-checking', icon: '⏳' };
  } else if (s === 'รอการยืนยัน') {
    return { name: 'รอการยืนยัน', class: 'status-checking', icon: '⏳' };
  } else if (s === 'ชำระเงิน' || s === 'รอชำระเงิน') {
    return { name: 'ชำระเงิน', class: 'status-payment', icon: '💳' };
  } else if (s === 'กำลังจัดเตรียมสินค้า' || s === 'เตรียมออเดอร์' || s === 'จัดเตรียมสินค้าพร้อมส่ง') {
    return { name: 'กำลังจัดเตรียมสินค้า', class: 'status-preparing', icon: '📦' };
  } else if (s === 'กำลังจัดส่ง') {
    return { name: 'กำลังจัดส่ง', class: 'status-shipping', icon: '🚚' };
  } else if (s === 'จัดส่งสำเร็จ' || s === 'ยืนยันแล้ว') {
    return { name: 'จัดส่งสำเร็จ', class: 'status-completed', icon: '✅' };
  } else if (s === 'ยกเลิก') {
    return { name: 'ยกเลิก', class: 'status-cancelled', icon: '❌' };
  }
  return { name: s || 'กำลังตรวจสอบออเดอร์', class: 'status-checking', icon: '⏳' };
}

function renderOrders() {
  const tbody = document.getElementById('ordersBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = allOrders.filter(order => {
    const meta = getStatusMeta(order.status);
    let statusMatch = (activeFilter === 'all');
    if (!statusMatch) {
      if (activeFilter === meta.name) statusMatch = true;
      else if (activeFilter === 'กำลังตรวจสอบออเดอร์' && (order.status === 'รอตรวจสอบ' || order.status === 'กำลังตรวจสอบออเดอร์')) statusMatch = true;
      else if (activeFilter === 'ชำระเงิน' && (order.status === 'รอชำระเงิน' || order.status === 'ชำระเงิน')) statusMatch = true;
      else if (activeFilter === 'จัดส่งสำเร็จ' && (order.status === 'ยืนยันแล้ว' || order.status === 'จัดส่งสำเร็จ')) statusMatch = true;
      else statusMatch = (order.status === activeFilter);
    }

    // Payment Method Filter Match
    let paymentMatch = (activePaymentFilter === 'all');
    if (!paymentMatch) {
      const currentMethod = order.paymentMethod || 'โอนจ่าย';
      paymentMatch = (currentMethod === activePaymentFilter);
    }

    const searchMatch = !searchQuery ||
      (order.orderId && order.orderId.toLowerCase().includes(searchQuery)) ||
      (order.customerName && order.customerName.toLowerCase().includes(searchQuery)) ||
      (order.phone && order.phone.includes(searchQuery)) ||
      (order.paymentMethod && order.paymentMethod.toLowerCase().includes(searchQuery)) ||
      (meta.name.toLowerCase().includes(searchQuery));

    return statusMatch && paymentMatch && searchMatch;
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
    const meta = getStatusMeta(order.status);

    const isTransfer = (order.paymentMethod && (order.paymentMethod.includes('โอน') || order.paymentMethod.includes('บัญชีธนาคาร') || order.paymentMethod.includes('ผสม')));
    const payBadgeClass = isTransfer ? 'pay-badge transfer' : 'pay-badge cod';

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
    const isUnread = !readOrderIds.includes(order.orderId);
    const unreadDot = isUnread ? `<span class="unread-badge" title="ยังไม่ได้เปิดดู"></span>` : '';

    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center;">
          ${unreadDot}
          <div>
            <strong style="color: var(--primary); font-size: 14px;">${order.orderId}</strong>
            <div style="margin-top: 5px; display: flex; gap: 6px; flex-wrap: wrap;">
              <span class="${payBadgeClass}">${order.paymentMethod || 'โอนจ่าย'}</span>
              ${order.shippingOption === 'รับหน้าร้าน' ? '<span class="pay-badge" style="background-color: #f59e0b; color: white;">🏪 รับหน้าร้าน</span>' : '<span class="pay-badge" style="background-color: #3b82f6; color: white;">🚚 จัดส่ง</span>'}
            </div>
          </div>
        </div>
      </td>
      <td style="font-size: 13px; color: var(--text-muted);">${dateStr}</td>
      <td>
        <div style="font-weight: 600;">${order.customerName || 'ลูกค้า'}</div>
        <div style="font-size: 12px; color: var(--text-muted);">${cleanPhone}</div>
      </td>
      <td><strong style="font-size: 15px; color: #1e293b;">฿${Number(order.totalPrice || 0).toLocaleString()}</strong></td>
      <td><span class="status-badge ${meta.class}">${meta.icon} ${meta.name}</span></td>
      <td style="text-align: right;">
        <button class="btn-view" onclick="viewOrder('${order.orderId}')">📋 ดูรายละเอียด</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateStats() {
  let checkingCount = 0;
  let waitingCount = 0;
  let paymentCount = 0;
  let preparingCount = 0;
  let readyToShipCount = 0;
  let shippingCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let totalSales = 0;
  let unreadCount = 0;

  allOrders.forEach(o => {
    const meta = getStatusMeta(o.status);
    if (meta.name === 'กำลังตรวจสอบออเดอร์') checkingCount++;
    else if (meta.name === 'รอการยืนยัน') waitingCount++;
    else if (meta.name === 'ชำระเงิน') paymentCount++;
    else if (meta.name === 'กำลังจัดเตรียมสินค้า') preparingCount++;
    else if (meta.name === 'กำลังจัดส่ง') shippingCount++;
    else if (meta.name === 'จัดส่งสำเร็จ') {
      completedCount++;
      totalSales += Number(o.totalPrice || 0);
    } else if (meta.name === 'ยกเลิก') cancelledCount++;

    if (o.orderId && !readOrderIds.includes(o.orderId)) {
      unreadCount++;
    }
  });

  // Header Cards
  const elPending = document.getElementById('stat-pending');
  const elPayment = document.getElementById('stat-payment');
  const elConfirmed = document.getElementById('stat-confirmed');
  const elSales = document.getElementById('stat-sales');

  if (elPending) elPending.textContent = checkingCount;
  if (elPayment) elPayment.textContent = paymentCount;
  if (elConfirmed) elConfirmed.textContent = shippingCount + completedCount;
  if (elSales) elSales.textContent = `฿${totalSales.toLocaleString()}`;

  // Filter Tab Badges
  const cAll = document.getElementById('count-all');
  const cPending = document.getElementById('count-pending');
  const cWaiting = document.getElementById('count-waiting');
  const cPayment = document.getElementById('count-payment');
  const cShipping = document.getElementById('count-shipping');
  const cConfirmed = document.getElementById('count-confirmed');
  const cCancelled = document.getElementById('count-cancelled');

  const cPreparing = document.getElementById('count-preparing');
  const cReadyToShip = document.getElementById('count-ready-to-ship');

  if (cAll) cAll.textContent = allOrders.length;
  if (cPending) cPending.textContent = checkingCount;
  if (cWaiting) cWaiting.textContent = waitingCount;
  if (cPayment) cPayment.textContent = paymentCount;
  if (cPreparing) cPreparing.textContent = preparingCount;
  if (cReadyToShip) cReadyToShip.textContent = readyToShipCount;
  if (cShipping) cShipping.textContent = shippingCount;
  if (cConfirmed) cConfirmed.textContent = completedCount;
  if (cCancelled) cCancelled.textContent = cancelledCount;

  const navBadge = document.getElementById('navUnreadBadge');
  if (navBadge) {
    if (unreadCount > 0) {
      navBadge.style.display = 'inline-block';
      navBadge.textContent = unreadCount;
    } else {
      navBadge.style.display = 'none';
    }
  }
}

let isModalEditMode = false;

function viewOrder(orderId) {
  currentViewingOrderId = orderId;
  isModalEditMode = false; // Reset edit mode on view
  const order = allOrders.find(o => o.orderId === orderId);
  if (!order) return;

  // Mark order as read - lightweight, no full re-render
  if (!readOrderIds.includes(orderId)) {
    readOrderIds.push(orderId);
    localStorage.setItem('admin_read_orders', JSON.stringify(readOrderIds));
    document.querySelectorAll('.unread-badge').forEach(dot => {
      const row = dot.closest('tr');
      if (row && row.innerHTML.includes(orderId)) dot.remove();
    });
    updateStats();
  }

  document.getElementById('modalOrderId').textContent = order.orderId;
  document.getElementById('modalCustomerName').textContent = order.customerName;
  document.getElementById('modalPhone').textContent = order.phone.replace(/'/g, ""); // Remove quote if present
  if (document.getElementById('modalPayment')) {
    document.getElementById('modalPayment').textContent = order.paymentMethod || '-';
  }

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
    let buttonsHtml = '';
    const isEditable = order.status !== 'จัดส่งสำเร็จ' && order.status !== 'ยืนยันแล้ว' && order.status !== 'ยกเลิก';
    if (isEditable) {
      buttonsHtml += `<button id="btnEditOrder" class="btn-warning" onclick="toggleModalEditMode()">✏️ แก้ไขออเดอร์</button>`;
    }

    const isTransfer = (order.paymentMethod && (order.paymentMethod.includes('โอน') || order.paymentMethod.includes('บัญชีธนาคาร') || order.paymentMethod.includes('ผสม')));
    const isCod = !isTransfer;
    const currentMeta = getStatusMeta(order.status);
    const normStatus = currentMeta.name;

    // ปุ่มลัดไปขั้นตอนถัดไป (Quick Action Button)
    let nextStepBtn = '';
    if (isCod) {
      if (normStatus === 'กำลังตรวจสอบออเดอร์') {
        nextStepBtn = `<button class="btn-success" onclick="updateStatus('กำลังจัดเตรียมสินค้า')">📦 ยืนยันออเดอร์ -> กำลังจัดเตรียมสินค้า</button>`;
      } else if (normStatus === 'กำลังจัดเตรียมสินค้า') {
        nextStepBtn = `<button class="btn-success" onclick="updateStatus('กำลังจัดส่ง')">🚚 เตรียมเสร็จแล้ว -> กำลังจัดส่ง</button>`;
      } else if (normStatus === 'กำลังจัดส่ง') {
        nextStepBtn = `<button class="btn-success" onclick="updateStatus('จัดส่งสำเร็จ')">✅ สินค้าถึงลูกค้าแล้ว -> จัดส่งสำเร็จ</button>`;
      }
    } else {
      if (normStatus === 'กำลังตรวจสอบออเดอร์') {
        nextStepBtn = `<button class="btn-success" onclick="updateStatus('ชำระเงิน')">💳 ยืนยันออเดอร์ & ส่ง QR ชำระเงิน</button>`;
      } else if (normStatus === 'ชำระเงิน') {
        nextStepBtn = `<button class="btn-success" onclick="updateStatus('กำลังจัดเตรียมสินค้า')">📦 ตรวจสอบยอดแล้ว -> กำลังจัดเตรียมสินค้า</button>`;
      } else if (normStatus === 'กำลังจัดเตรียมสินค้า') {
        nextStepBtn = `<button class="btn-success" onclick="updateStatus('กำลังจัดส่ง')">🚚 เตรียมเสร็จแล้ว -> กำลังจัดส่ง</button>`;
      } else if (normStatus === 'กำลังจัดส่ง') {
        nextStepBtn = `<button class="btn-success" onclick="updateStatus('จัดส่งสำเร็จ')">✅ สินค้าถึงลูกค้าแล้ว -> จัดส่งสำเร็จ</button>`;
      }
    }

    if (nextStepBtn) {
      buttonsHtml += nextStepBtn;
    }

    if (isEditable) {
      buttonsHtml += `<button class="btn-danger" onclick="updateStatus('ยกเลิก')">❌ ยกเลิกออเดอร์</button>`;
    }

    actionsDiv.innerHTML = buttonsHtml;
    actionsDiv.style.display = 'flex';
  }
}

let currentEditingOrder = null;

// Toggle edit mode in order details modal
function toggleModalEditMode() {
  if (!currentViewingOrderId) return;
  const order = allOrders.find(o => o.orderId === currentViewingOrderId);
  if (!order) return;

  isModalEditMode = !isModalEditMode;

  if (isModalEditMode) {
    currentEditingOrder = JSON.parse(JSON.stringify(order));
  } else {
    currentEditingOrder = null;
  }

  const noteBox = document.getElementById('editNoteContainer');
  if (noteBox) noteBox.style.display = isModalEditMode ? 'block' : 'none';

  const addItemContainer = document.getElementById('addItemContainer');
  if (addItemContainer) addItemContainer.style.display = isModalEditMode ? 'flex' : 'none';

  const orderToRender = currentEditingOrder || order;
  renderModalItems(orderToRender, isModalEditMode);
  renderModalActions(orderToRender);
}

async function fetchAdminProducts() {
  if (isAdminProductsLoaded && adminProducts.length > 0) return;
  await fetchProducts(false);
}

async function addNewItemBySku() {
  const skuInput = document.getElementById('addSkuInput');
  const sku = skuInput ? skuInput.value.trim() : '';
  if (!sku) {
    alert('กรุณากรอกรหัสสินค้า');
    return;
  }

  const btn = document.getElementById('btnAddSku');
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

  await fetchAdminProducts();
  
  if (btn) { btn.disabled = false; btn.textContent = '+ เพิ่ม'; }

  const product = adminProducts.find(p => String(p.id) === String(sku));
  if (!product) {
    alert('ไม่พบสินค้ารหัส: ' + sku + '\n(โหลดข้อมูลมาได้ ' + adminProducts.length + ' รายการ)\n*หากเพิ่งเพิ่มรหัสใหม่ กรุณารีเฟรชหน้าเว็บ*');
    return;
  }

  const order = currentEditingOrder || allOrders.find(o => o.orderId === currentViewingOrderId);
  if (!order) return;

  syncOrderItemsFromDOM(order);

  order.items.push({
    id: product.id,
    name: product.name,
    price: Number(product.price || 0),
    qty: 1,
    subtotal: Number(product.price || 0)
  });

  renderModalItems(order, true);
  if (skuInput) skuInput.value = '';
}

function syncOrderItemsFromDOM(order) {
  const qtyInputs = document.querySelectorAll('.input-edit-qty');
  const priceInputs = document.querySelectorAll('.input-edit-price');
  
  order.items.forEach((item, idx) => {
    const qInput = qtyInputs[idx];
    const pInput = priceInputs[idx];
    if (qInput) item.qty = Math.max(1, parseInt(qInput.value) || 1);
    if (pInput) item.price = Math.max(0, parseFloat(pInput.value) || 0);
    item.subtotal = item.qty * item.price;
  });
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

  let itemsSubtotal = 0;
  order.items.forEach((item) => {
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.qty || 1);
    itemsSubtotal += Number(item.subtotal || (itemPrice * itemQty));
  });

  const grandTotal = Number(order.totalPrice || 0);
  const isPickup = order.shippingOption === 'รับหน้าร้าน';
  const shippingFee = isPickup ? 0 : Math.max(0, grandTotal - itemsSubtotal);

  const subtotalEl = document.getElementById('modalSubtotalPrice');
  if (subtotalEl) subtotalEl.textContent = `฿${itemsSubtotal.toLocaleString()}`;

  const feeEl = document.getElementById('modalShippingFee');
  if (feeEl) {
    if (isPickup) {
      feeEl.innerHTML = `<span style="color: #16a34a;">ฟรี ฿0 (รับหน้าร้าน)</span>`;
    } else if (shippingFee === 0) {
      feeEl.innerHTML = `<span style="color: #16a34a;">ฟรี ฿0</span>`;
    } else {
      feeEl.textContent = `฿${shippingFee.toLocaleString()}`;
    }
  }

  const optionLabelEl = document.getElementById('modalShippingOptionLabel');
  if (optionLabelEl) optionLabelEl.textContent = isPickup ? 'รับหน้าร้าน' : 'จัดส่ง';

  const totalEl = document.getElementById('modalTotalPrice');
  if (totalEl) totalEl.textContent = `฿${grandTotal.toLocaleString()}`;
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
  let itemsSubtotal = 0;
  const qtyInputs = document.querySelectorAll('.input-edit-qty');
  const priceInputs = document.querySelectorAll('.input-edit-price');

  qtyInputs.forEach((qEl, idx) => {
    const pEl = priceInputs[idx];
    if (pEl) {
      const q = Math.max(1, parseInt(qEl.value) || 1);
      const p = Math.max(0, parseFloat(pEl.value) || 0);
      itemsSubtotal += (q * p);
    }
  });

  const order = allOrders.find(o => o.orderId === currentViewingOrderId);
  const isPickup = order && order.shippingOption === 'รับหน้าร้าน';
  const origTotal = order ? Number(order.totalPrice || 0) : itemsSubtotal;
  const origItemsSub = order && order.items ? order.items.reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 1)), 0) : itemsSubtotal;
  const shippingFee = isPickup ? 0 : Math.max(0, origTotal - origItemsSub);
  const newGrandTotal = itemsSubtotal + shippingFee;

  const subtotalEl = document.getElementById('modalSubtotalPrice');
  if (subtotalEl) subtotalEl.textContent = `฿${itemsSubtotal.toLocaleString()}`;

  const feeEl = document.getElementById('modalShippingFee');
  if (feeEl) {
    if (isPickup) {
      feeEl.innerHTML = `<span style="color: #16a34a;">ฟรี ฿0 (รับหน้าร้าน)</span>`;
    } else if (shippingFee === 0) {
      feeEl.innerHTML = `<span style="color: #16a34a;">ฟรี ฿0</span>`;
    } else {
      feeEl.textContent = `฿${shippingFee.toLocaleString()}`;
    }
  }

  const totalEl = document.getElementById('modalTotalPrice');
  if (totalEl) totalEl.textContent = `฿${newGrandTotal.toLocaleString()}`;
}

// Save order item and price changes, then notify customer via LINE
async function saveOrderChanges() {
  if (!currentViewingOrderId) return;
  const order = currentEditingOrder || allOrders.find(o => o.orderId === currentViewingOrderId);
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

  const originalOrder = allOrders.find(o => o.orderId === currentViewingOrderId);
  const isPickup = originalOrder && originalOrder.shippingOption === 'รับหน้าร้าน';
  const origTotal = originalOrder ? Number(originalOrder.totalPrice || 0) : newTotal;
  const origItemsSub = originalOrder && originalOrder.items ? originalOrder.items.reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 1)), 0) : newTotal;
  const shippingFee = isPickup ? 0 : Math.max(0, origTotal - origItemsSub);
  const newGrandTotal = newTotal + shippingFee;

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
        totalPrice: newGrandTotal,
        notifyCustomer: true,
        changeNote: changeNote
      })
    });

    const result = await response.json();

    if (result.status === 'success') {
      alert('✅ บันทึกการแก้ไขข้อมูลและแจ้งเตือนลูกค้าผ่าน LINE เรียบร้อยแล้ว!');
      if (originalOrder) {
        originalOrder.items = updatedItems;
        originalOrder.totalPrice = newGrandTotal;
      }
      isModalEditMode = false;
      currentEditingOrder = null;

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

// Modern premium non-blocking toast notification helper (5x Larger)
function showToast(message, type = 'success') {
  const existing = document.querySelectorAll('.custom-toast');
  existing.forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = 'custom-toast';

  let bgColor = '#10b981'; // Green
  let icon = '✅';
  if (type === 'error') {
    bgColor = '#ef4444'; // Red
    icon = '❌';
  } else if (type === 'loading') {
    bgColor = '#2563eb'; // Blue
    icon = '⏳';
  } else if (type === 'info') {
    bgColor = '#f59e0b'; // Amber
    icon = '🔔';
  }

  toast.style.position = 'fixed';
  toast.style.bottom = '40px';
  toast.style.right = '40px';
  toast.style.backgroundColor = bgColor;
  toast.style.color = '#ffffff';
  toast.style.padding = '24px 48px';
  toast.style.borderRadius = '24px';
  toast.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
  toast.style.zIndex = '99999';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '20px';
  toast.style.fontWeight = '700';
  toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  toast.style.fontSize = '30px';
  toast.style.transition = 'all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(30px) scale(0.9)';

  toast.innerHTML = `<span style="font-size: 40px; display: inline-flex; align-items: center;">${icon}</span> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  }, 10);

  if (type !== 'loading') {
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 3500);
  }
  return toast;
}

async function updateStatus(newStatus) {
  if (!currentViewingOrderId) return;
  if (!confirm(`ยืนยันการเปลี่ยนสถานะออเดอร์เป็น "${newStatus}" หรือไม่?`)) return;

  const orderId = currentViewingOrderId;
  const orderIndex = allOrders.findIndex(o => o.orderId === orderId);
  if (orderIndex === -1) return;

  const originalStatus = allOrders[orderIndex].status;

  // 1. Optimistic Update (Immediate visual response)
  allOrders[orderIndex].status = newStatus;
  renderOrders();
  updateStats();
  closeModal();

  // Show temporary loading toast
  const loadingToast = showToast(`กำลังอัปเดตสถานะออเดอร์เป็น "${newStatus}"...`, 'loading');

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'updateOrderStatus',
        orderId: orderId,
        status: newStatus
      })
    });

    const result = await response.json();
    if (loadingToast && loadingToast.parentNode) loadingToast.remove();

    if (result.status === 'success') {
      showToast("อัปเดตสถานะออเดอร์สำเร็จ!");
      // Fetch silently in background to keep data fully synced
      fetchOrders(false);
    } else {
      // Rollback on failure
      allOrders[orderIndex].status = originalStatus;
      renderOrders();
      updateStats();
      showToast("ไม่สามารถอัปเดตสถานะได้: " + result.message, 'error');
    }
  } catch (error) {
    if (loadingToast && loadingToast.parentNode) loadingToast.remove();
    // Rollback on connection failure
    allOrders[orderIndex].status = originalStatus;
    renderOrders();
    updateStats();
    showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ", 'error');
    console.error("Update error:", error);
  }
}

async function fetchMembers(showLoading = true) {
  const loading = document.getElementById('membersLoadingIndicator');

  if (showLoading && loading) {
    loading.style.display = 'flex';
    document.getElementById('membersBody').innerHTML = '';
  }

  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllMembers&_t=${Date.now()}`);
    const result = await response.json();

    if (result.status === 'success') {
      allMembers = result.members || [];
      renderMembers();
      updateMemberStats();
      renderOverviewDashboard();
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

  // 1. Extract URL from HYPERLINK formula e.g. HYPERLINK("https://...", "...")
  if (str.indexOf('HYPERLINK') !== -1) {
    const hMatch = str.match(/HYPERLINK\(\s*["']([^"']+)["']/i);
    if (hMatch && hMatch[1]) return hMatch[1];
  }

  // 2. Extract URL starting with http:// or https:// anywhere in the string
  const httpIdx = str.toLowerCase().indexOf('http');
  if (httpIdx !== -1) {
    const sub = str.substring(httpIdx);
    const spaceIdx = sub.search(/[\s"'>]/);
    return spaceIdx !== -1 ? sub.substring(0, spaceIdx) : sub;
  }

  // 3. Match coordinates (lat, lng) e.g. 13.7563, 100.5018
  const coordMatch = str.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (coordMatch) {
    return 'https://www.google.com/maps?q=' + coordMatch[1] + ',' + coordMatch[2];
  }

  // 4. Fallback: Search Google Maps by address or customer name if no URL was embedded
  const query = (addressDetails || '').trim() || (customerName || '').trim();
  if (query && query !== '-') {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  }

  return '';
}

/* ==========================================================================
   Product Catalog Logic & Handlers
   ========================================================================== */

function getOptimizedImageUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return 'https://placehold.co/400x400/f3f0ec/a88b62?text=No+Image';
  }
  let optimizedUrl = url.trim();
  if (optimizedUrl.includes('drive.google.com') || optimizedUrl.includes('docs.google.com')) {
    let driveId = '';
    const match1 = optimizedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const match2 = optimizedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match1) driveId = match1[1];
    else if (match2) driveId = match2[1];
    if (driveId) {
      optimizedUrl = `https://lh3.googleusercontent.com/d/${driveId}`;
    }
  }
  return optimizedUrl;
}

async function fetchProducts(showLoading = true) {
  const loading = document.getElementById('productsLoadingIndicator');
  if (showLoading && allProducts.length === 0 && loading) {
    loading.style.display = 'flex';
  }

  isProductsLoading = true;

  // 1. โหลดข้อมูลจาก LocalStorage Cache ทันที (0ms) เพื่อให้ไม่ต้องรอ
  try {
    const cached = localStorage.getItem('cached_admin_products');
    if (cached && allProducts.length === 0) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        processIncomingProducts(parsed);
      }
    }
  } catch (e) { }

  let fetchedData = null;

  // 2. ดึงจาก static products.json (เร็วที่สุด ~50ms และมีสินค้าครบ)
  try {
    const res = await fetch(`./products.json?_t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success' && Array.isArray(data.products) && data.products.length > 0) {
        fetchedData = data.products;
      }
    }
  } catch (err) { }

  // 3. Fallback: ถ้าเปิดใน Google Apps Script หรือไม่มีไฟล์ static ให้ดึงผ่าน GAS
  if (!fetchedData) {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      fetchedData = await new Promise((resolve) => {
        google.script.run
          .withSuccessHandler(function (products) {
            resolve(products || []);
          })
          .withFailureHandler(function (err) {
            console.error('Error fetching admin products via GAS:', err);
            resolve(null);
          })
          .getProductsNative();
      });
    }

    if (!fetchedData) {
      try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts&_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === 'success' && Array.isArray(data.products) && data.products.length > 0) {
            fetchedData = data.products;
          }
        }
      } catch (err) {
        console.error('Fetch products error:', err);
      }
    }
  }

  if (fetchedData && Array.isArray(fetchedData) && fetchedData.length > 0) {
    processIncomingProducts(fetchedData);
  } else if (allProducts.length === 0) {
    const tbody = document.getElementById('productsBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
            <div style="font-size: 36px; margin-bottom: 8px;">⚠️</div>
            <p style="font-weight: 600; color: #ef4444; margin-bottom: 6px;">ไม่สามารถดึงข้อมูลสินค้าได้</p>
            <p style="font-size: 13px; margin-bottom: 16px;">กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือกดปุ่มรีเฟรชอีกครั้ง</p>
            <button onclick="fetchProducts(true)" class="btn-primary">🔄 ลองใหม่อีกครั้ง</button>
          </td>
        </tr>
      `;
    }
  }

  isProductsLoading = false;
  if (loading) loading.style.display = 'none';
}

function processIncomingProducts(products) {
  allProducts = products || [];
  adminProducts = allProducts;
  isAdminProductsLoaded = true;

  try {
    localStorage.setItem('cached_admin_products', JSON.stringify(allProducts));
  } catch (e) { }

  populateCategoryAndTagFilters();
  applyProductFilters();
  updateProductStats();
  renderOverviewDashboard();
}

function populateCategoryAndTagFilters() {
  const catSelect = document.getElementById('productCategoryFilter');
  const tagSelect = document.getElementById('productTagFilter');
  if (!catSelect || !tagSelect) return;

  const currentCatVal = catSelect.value;
  const currentTagVal = tagSelect.value;

  const categories = new Set();
  const tags = new Set();

  allProducts.forEach(p => {
    if (p.category && String(p.category).trim() !== '') {
      categories.add(String(p.category).trim());
    }
    if (p.tag && String(p.tag).trim() !== '') {
      tags.add(String(p.tag).trim());
    }
  });

  const sortedCats = Array.from(categories).sort((a, b) => a.localeCompare(b, 'th'));
  const sortedTags = Array.from(tags).sort((a, b) => a.localeCompare(b, 'th'));

  let catHtml = '<option value="all">📂 หมวดหมู่ทั้งหมด (' + allProducts.length.toLocaleString() + ')</option>';
  sortedCats.forEach(c => {
    const count = allProducts.filter(p => p.category === c).length;
    catHtml += `<option value="${c}">${c} (${count.toLocaleString()})</option>`;
  });
  catSelect.innerHTML = catHtml;
  if (sortedCats.includes(currentCatVal)) catSelect.value = currentCatVal;

  let tagHtml = '<option value="all">🏷️ แท็ก: ทั้งหมด</option>';
  sortedTags.forEach(t => {
    const count = allProducts.filter(p => p.tag === t).length;
    tagHtml += `<option value="${t}">${t} (${count.toLocaleString()})</option>`;
  });
  tagSelect.innerHTML = tagHtml;
  if (sortedTags.includes(currentTagVal)) tagSelect.value = currentTagVal;
}

function applyProductFilters() {
  const search = productSearchQuery.toLowerCase();

  filteredProducts = allProducts.filter(p => {
    if (productSelectedCategory !== 'all' && p.category !== productSelectedCategory) {
      return false;
    }
    if (productSelectedTag !== 'all' && p.tag !== productSelectedTag) {
      return false;
    }
    if (search) {
      const matchId = p.id && String(p.id).toLowerCase().includes(search);
      const matchName = p.name && p.name.toLowerCase().includes(search);
      const matchCat = p.category && p.category.toLowerCase().includes(search);
      const matchDesc = p.desc && p.desc.toLowerCase().includes(search);
      if (!matchId && !matchName && !matchCat && !matchDesc) {
        return false;
      }
    }
    return true;
  });

  if (productSortOrder === 'name_asc') {
    filteredProducts.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
  } else if (productSortOrder === 'price_asc') {
    filteredProducts.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  } else if (productSortOrder === 'price_desc') {
    filteredProducts.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  } else if (productSortOrder === 'sku_asc') {
    filteredProducts.sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  }

  productVisibleLimit = 50;
  renderProductsList();
}

function renderProductsList() {
  const showingText = document.getElementById('productShowingCountText');
  const countToDisplay = Math.min(productVisibleLimit, filteredProducts.length);
  if (showingText) {
    showingText.textContent = `แสดง ${countToDisplay.toLocaleString()} จากที่ค้นพบ ${filteredProducts.length.toLocaleString()} รายการ (สินค้าทั้งหมดในระบบ ${allProducts.length.toLocaleString()} รายการ)`;
  }

  const loadMoreBtnContainer = document.getElementById('productLoadMoreContainer');
  if (loadMoreBtnContainer) {
    loadMoreBtnContainer.style.display = (productVisibleLimit < filteredProducts.length) ? 'block' : 'none';
  }

  if (productViewMode === 'table') {
    renderProductsTable();
  } else {
    renderProductsGrid();
  }
}

function renderProductsTable() {
  const tbody = document.getElementById('productsBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const slice = filteredProducts.slice(0, productVisibleLimit);

  if (slice.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <p style="font-weight: 500;">ไม่พบสินค้าที่ตรงกับเงื่อนไขการค้นหา</p>
        </td>
      </tr>
    `;
    return;
  }

  slice.forEach(p => {
    const tr = document.createElement('tr');
    const imgUrl = getOptimizedImageUrl(p.img);
    const tagHtml = p.tag ? `<span class="tag-badge">${p.tag}</span>` : `<span style="color:#cbd5e1;">-</span>`;
    const catHtml = p.category ? `<span class="category-badge">${p.category}</span>` : `<span style="color:#cbd5e1;">-</span>`;

    tr.innerHTML = `
      <td>
        <img src="${imgUrl}" alt="${p.name}" class="product-table-thumb" onclick="openProductDetailModal('${p.id}')" onerror="this.onerror=null; this.src='https://placehold.co/400x400/f3f0ec/a88b62?text=No+Image';">
      </td>
      <td>
        <div class="sku-cell-wrapper">
          <code class="sku-code">${p.id}</code>
          <button class="btn-copy-sku" onclick="copyProductSku('${p.id}', event)" title="คัดลอกรหัสสินค้า">📋</button>
        </div>
      </td>
      <td>
        <div style="cursor: pointer;" onclick="openProductDetailModal('${p.id}')">
          <strong style="font-size: 13.5px; color: var(--text-main); display: block; line-height: 1.35;">${p.name}</strong>
        </div>
      </td>
      <td>${catHtml}</td>
      <td>
        <strong style="color: #1e293b; font-size: 14px;">฿${(Number(p.price) || 0).toLocaleString()}</strong>
      </td>
      <td>${tagHtml}</td>
      <td style="text-align: right;">
        <button class="btn-view" onclick="openProductDetailModal('${p.id}')">🔍 ดูข้อมูล</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderProductsGrid() {
  const container = document.getElementById('productCardsGrid');
  if (!container) return;
  container.innerHTML = '';

  const slice = filteredProducts.slice(0, productVisibleLimit);

  if (slice.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted);">
        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
        <p style="font-weight: 500;">ไม่พบสินค้าที่ตรงกับเงื่อนไขการค้นหา</p>
      </div>
    `;
    return;
  }

  slice.forEach(p => {
    const card = document.createElement('div');
    card.className = 'admin-product-card';
    const imgUrl = getOptimizedImageUrl(p.img);
    const tagHtml = p.tag ? `<div class="admin-product-card-tag">${p.tag}</div>` : '';

    card.innerHTML = `
      <div class="admin-product-card-img-wrap" onclick="openProductDetailModal('${p.id}')" style="cursor: pointer;">
        <img src="${imgUrl}" alt="${p.name}" class="admin-product-card-img" loading="lazy" onerror="this.onerror=null; this.src='https://placehold.co/400x400/f3f0ec/a88b62?text=No+Image';">
        ${tagHtml}
      </div>
      <div class="admin-product-card-body">
        <div class="admin-product-card-category">${p.category || 'ทั่วไป'}</div>
        <div class="admin-product-card-title" title="${p.name}" onclick="openProductDetailModal('${p.id}')" style="cursor: pointer;">${p.name}</div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <code class="sku-code">${p.id}</code>
          <button class="btn-copy-sku" onclick="copyProductSku('${p.id}', event)">📋 คัดลอก</button>
        </div>
        <div class="admin-product-card-footer">
          <div class="admin-product-card-price">฿${(Number(p.price) || 0).toLocaleString()}</div>
          <button class="btn-view" onclick="openProductDetailModal('${p.id}')">ดูข้อมูล</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function openProductDetailModal(productId) {
  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;

  currentViewingProduct = product;

  const modal = document.getElementById('productDetailModal');
  const imgEl = document.getElementById('detailProductImg');
  const nameEl = document.getElementById('detailProductName');
  const catEl = document.getElementById('detailProductCategory');
  const tagEl = document.getElementById('detailProductTag');
  const priceEl = document.getElementById('detailProductPrice');
  const skuEl = document.getElementById('detailProductSku');
  const descEl = document.getElementById('detailProductDesc');

  if (imgEl) imgEl.src = getOptimizedImageUrl(product.img);
  if (nameEl) nameEl.textContent = product.name || '-';
  if (catEl) catEl.textContent = product.category || 'ทั่วไป';
  if (tagEl) {
    if (product.tag) {
      tagEl.textContent = product.tag;
      tagEl.style.display = 'inline-block';
    } else {
      tagEl.style.display = 'none';
    }
  }
  if (priceEl) priceEl.textContent = (Number(product.price) || 0).toLocaleString();
  if (skuEl) skuEl.textContent = product.id;
  if (descEl) descEl.textContent = product.desc || 'ไม่มีคำอธิบายสินค้าเพิ่มเติม';

  if (modal) modal.classList.add('active');
}

function closeProductModal() {
  const modal = document.getElementById('productDetailModal');
  if (modal) modal.classList.remove('active');
  currentViewingProduct = null;
}

function copyProductSku(sku, event) {
  if (event) event.stopPropagation();
  if (!sku) return;
  navigator.clipboard.writeText(String(sku)).then(() => {
    showToast(`คัดลอกรหัสสินค้า ${sku} แล้ว!`, 'success');
  }).catch(() => {
    const temp = document.createElement('input');
    temp.value = sku;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
    showToast(`คัดลอกรหัสสินค้า ${sku} แล้ว!`, 'success');
  });
}

function copySkuFromModal() {
  if (currentViewingProduct && currentViewingProduct.id) {
    copyProductSku(currentViewingProduct.id);
  }
}

function loadMoreProducts() {
  productVisibleLimit += 50;
  renderProductsList();
}

function setProductViewMode(mode) {
  productViewMode = mode;
  const btnTable = document.getElementById('btnViewTable');
  const btnGrid = document.getElementById('btnViewGrid');
  const tableContainer = document.getElementById('productTableViewContainer');
  const gridContainer = document.getElementById('productGridViewContainer');

  if (mode === 'table') {
    if (btnTable) btnTable.classList.add('active');
    if (btnGrid) btnGrid.classList.remove('active');
    if (tableContainer) tableContainer.style.display = 'block';
    if (gridContainer) gridContainer.style.display = 'none';
  } else {
    if (btnGrid) btnGrid.classList.add('active');
    if (btnTable) btnTable.classList.remove('active');
    if (tableContainer) tableContainer.style.display = 'none';
    if (gridContainer) gridContainer.style.display = 'block';
  }
  renderProductsList();
}

function onProductFilterChange() {
  const catSelect = document.getElementById('productCategoryFilter');
  const tagSelect = document.getElementById('productTagFilter');
  const sortSelect = document.getElementById('productSortFilter');

  if (catSelect) productSelectedCategory = catSelect.value;
  if (tagSelect) productSelectedTag = tagSelect.value;
  if (sortSelect) productSortOrder = sortSelect.value;

  applyProductFilters();
}

function updateProductStats() {
  const statTotal = document.getElementById('stat-total-products');
  const statCat = document.getElementById('stat-total-categories');
  const statTagged = document.getElementById('stat-tagged-products');
  const statAvg = document.getElementById('stat-avg-price');

  if (statTotal) statTotal.textContent = allProducts.length.toLocaleString();

  const categories = new Set();
  let taggedCount = 0;
  let totalPriceSum = 0;

  allProducts.forEach(p => {
    if (p.category) categories.add(p.category);
    if (p.tag) taggedCount++;
    totalPriceSum += Number(p.price) || 0;
  });

  if (statCat) statCat.textContent = categories.size.toLocaleString();
  if (statTagged) statTagged.textContent = taggedCount.toLocaleString();

  const avg = allProducts.length > 0 ? Math.round(totalPriceSum / allProducts.length) : 0;
  if (statAvg) statAvg.textContent = `฿${avg.toLocaleString()}`;
}

// Window exports
window.fetchProducts = fetchProducts;
window.setProductViewMode = setProductViewMode;
window.onProductFilterChange = onProductFilterChange;
window.loadMoreProducts = loadMoreProducts;
window.openProductDetailModal = openProductDetailModal;
window.closeProductModal = closeProductModal;
window.copyProductSku = copyProductSku;
window.copySkuFromModal = copySkuFromModal;
