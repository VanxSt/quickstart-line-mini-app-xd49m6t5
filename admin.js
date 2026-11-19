const GOOGLE_SCRIPT_URL = 'https://kuekoonkan-api.noperfecf.workers.dev';

    // Helper: ตรวจสอบและจัดรูปแบบเบอร์โทรศัพท์ (Thai Phone Validation)
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
      if (!/^0[0-9]{8,9}$/.test(clean)) {
        return false;
      }
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

    let allOrders = [];
    let allMembers = [];
    let activeFilter = 'รอตรวจของ';
    let activePaymentFilter = 'all';
    let searchQuery = '';
    let memberSearchQuery = '';
    let currentViewingOrderId = null;
    let currentTab = 'overview';

    // Helper: ตรวจสอบว่าเป็นรายการแลกแต้มสะสมหรือไม่ (เช่น ราคา >= 50,000 บาท หรือชื่อมีคำว่า แลกแต้ม/สะสมแต้ม)
    function isPointRedemptionProduct(p) {
      if (!p) return false;
      const price = Number(p.price || 0);
      const name = String(p.name || '');
      const cat = String(p.category || '');
      const tag = String(p.tag || '');
      if (price >= 50000) return true;
      if (/แลกแต้ม|สะสมแต้ม|ของรางวัลแลกแต้ม|ใช้แต้มแลก/.test(name + ' ' + cat + ' ' + tag)) return true;
      return false;
    }

    // Helper: คำนวณเวลาที่รอดำเนินการ (Waiting Time) ของออเดอร์ที่ยังไม่เสร็จสิ้น
    function getOrderWaitingTimeInfo(order) {
      if (!order || !order.timestamp) return { text: '-', badgeHtml: '' };
      const meta = getStatusMeta(order.status, order);
      if (meta.name === 'จัดส่งสำเร็จ' || meta.name === 'ยกเลิก') {
        return { text: 'เสร็จสิ้น', badgeHtml: '<span style="font-size:11px; color:#64748b;">เสร็จสิ้นแล้ว</span>' };
      }
      const created = new Date(order.timestamp).getTime();
      if (isNaN(created)) return { text: '-', badgeHtml: '' };
      const diffMins = Math.max(0, Math.floor((Date.now() - created) / 60000));
      let label = '';
      if (diffMins < 1) label = 'เพิ่งสั่งเมื่อสักครู่';
      else if (diffMins < 60) label = 'รอ ' + diffMins + ' นาที';
      else {
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        label = hrs < 24 ? ('รอ ' + hrs + ' ชม. ' + (mins > 0 ? mins + ' น.' : '')) : ('รอ ' + Math.floor(hrs / 24) + ' วัน');
      }
      let bg = '#f0fdf4', col = '#15803d', border = '#bbf7d0';
      if (diffMins >= 60) { bg = '#fef2f2'; col = '#dc2626'; border = '#fecaca'; }
      else if (diffMins >= 20) { bg = '#fffbeb'; col = '#b45309'; border = '#fde68a'; }
      return {
        text: label,
        diffMins: diffMins,
        badgeHtml: '<span style="display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:700; padding:2px 7px; border-radius:6px; background:' + bg + '; color:' + col + '; border:1px solid ' + border + ';">⏱️ ' + label + '</span>'
      };
    }

    // Helper: ดึงข้อมูลรอบจัดส่ง (09:00, 13:00, 16:30)
    function getOrderDeliveryRoundHtml(order) {
      if (!order) return '-';
      if (order.shippingOption === 'รับหน้าร้าน') {
        const pt = order.preorderTime ? (' (' + order.preorderTime + ' น.)') : '';
        return '<span style="font-size:11.5px; font-weight:700; color:#b45309; background:#fef3c7; padding:2px 7px; border-radius:6px;">🏪 รับหน้าร้าน' + pt + '</span>';
      }
      if (order.deliveryType === 'ล่วงหน้า' && order.preorderTime) {
        return '<span style="font-size:11.5px; font-weight:700; color:#1d4ed8; background:#dbeafe; padding:2px 7px; border-radius:6px;">🕒 รอบส่ง ' + order.preorderTime + ' น.</span>';
      }
      // คำนวณรอบส่งถัดไปจากเวลาที่สั่ง (09:00, 13:00, 16:30)
      let roundLabel = 'ส่งด่วน / รอบถัดไป';
      if (order.timestamp) {
        const d = new Date(order.timestamp);
        if (!isNaN(d.getTime())) {
          const hm = d.getHours() * 60 + d.getMinutes();
          if (hm <= 9 * 60) roundLabel = 'รอบ 09:00 น.';
          else if (hm <= 13 * 60) roundLabel = 'รอบ 13:00 น.';
          else if (hm <= 16 * 60 + 30) roundLabel = 'รอบ 16:30 น.';
          else roundLabel = 'รอบ 09:00 น. (พรุ่งนี้)';
        }
      }
      return '<span style="font-size:11.5px; font-weight:700; color:#0369a1; background:#e0f2fe; padding:2px 7px; border-radius:6px;">🚚 ' + roundLabel + '</span>';
    }

    // Helper: ดึงชื่อพนักงานผู้ดูแลออเดอร์
    function getOrderStaffName(order) {
      if (!order) return '';
      if (order.staffName && String(order.staffName).trim()) return String(order.staffName).trim();
      try {
        const map = JSON.parse(LS.getItem('admin_order_staff_map') || '{}');
        if (order.orderId && map[order.orderId]) return map[order.orderId];
      } catch (e) {}
      return '';
    }

    // Helper: ดึงประวัติการแก้ไขออเดอร์ (ใครแก้ เมื่อไหร่ เหตุผล ค่าเดิม-ค่าใหม่)
    function getOrderEditHistory(order) {
      if (!order) return [];
      if (Array.isArray(order.editHistory) && order.editHistory.length > 0) return order.editHistory;
      if (order.editHistoryJson) {
        try {
          const parsed = JSON.parse(order.editHistoryJson);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
      try {
        const map = JSON.parse(LS.getItem('admin_order_edit_history_map') || '{}');
        if (order.orderId && Array.isArray(map[order.orderId])) return map[order.orderId];
      } catch (e) {}
      return [];
    }

    // Product Catalog State
    let allProducts = [];
    let filteredProducts = [];
    let productSearchQuery = '';
    let productSelectedCategory = 'all';
    let productSelectedTag = 'all';
    let productSelectedStatus = 'all';
    let productSortOrder = 'default';
    let productViewMode = 'grid';
    let productVisibleLimit = 50;
    let isProductsLoading = false;
    let currentViewingProduct = null;
    let adminProducts = [];
    let isAdminProductsLoaded = false;

    // Unread Red Dot & Audio Notification State
    let soundEnabled = LS.getItem('admin_sound_enabled') !== 'false';
    let readOrderIds = [];
    try { readOrderIds = JSON.parse(LS.getItem('admin_read_orders') || '[]') || []; } catch (e) { readOrderIds = []; }
    let knownOrderIds = new Set();
    let isInitialOrdersLoad = true;
    let audioCtx = null;

    function getAudioContext() {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      return audioCtx;
    }

    function playNotificationChime(isTest) {
      if (!soundEnabled && !isTest) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) { console.warn('No AudioContext'); return; }

        const now = ctx.currentTime;
        // 3-note chime: C6 → E6 → G6 (louder)
        const notes = [
          { freq: 1047, start: 0, dur: 0.25 },
          { freq: 1319, start: 0.15, dur: 0.25 },
          { freq: 1568, start: 0.3, dur: 0.5 }
        ];
        notes.forEach(n => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(n.freq, now + n.start);
          gain.gain.setValueAtTime(0.8, now + n.start);
          gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + n.start);
          osc.stop(now + n.start + n.dur);
        });
        console.log('🔔 Chime played!');
      } catch (e) {
        console.error("Audio playback error:", e);
      }
    }

    function showNewOrderToast(count) {
      const existing = document.querySelectorAll('.toast-notification');
      existing.forEach(el => el.remove());

      const toast = document.createElement('div');
      toast.className = 'toast-notification';
      toast.innerHTML = '<span class="toast-icon">🛒</span> มีออเดอร์ใหม่เข้ามา ' + count + ' รายการ!';
      document.body.appendChild(toast);
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4200);
    }

    function toggleSound() {
      soundEnabled = !soundEnabled;
      LS.setItem('admin_sound_enabled', soundEnabled);
      updateSoundButtonUI();
      if (soundEnabled) {
        playNotificationChime(true);
        showNewOrderToast(0);
      }
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

    // ==========================================
    // ADMIN AUTHENTICATION SYSTEM
    // ==========================================
    var DEFAULT_ADMIN_PASSWORD = 'admin1234';
    var isInitialized = false;

    function getAdminPassword() {
      return LS.getItem('kuekoonkan_admin_pwd') || DEFAULT_ADMIN_PASSWORD;
    }

    function checkAdminAuth() {
      var isSessionAuth = false;
      try {
        isSessionAuth = (window.sessionStorage && window.sessionStorage.getItem('admin_logged_in') === 'true');
      } catch (e) { }

      var isRemembered = (LS.getItem('admin_remember_token') === 'true');

      if (isSessionAuth || isRemembered) {
        showDashboard();
      } else {
        showLoginOverlay();
      }
    }

    function showDashboard() {
      var overlay = document.getElementById('adminLoginOverlay');
      var container = document.getElementById('dashboardContainer');
      if (overlay) overlay.style.display = 'none';
      if (container) container.style.display = 'flex';

      if (!isInitialized) {
        isInitialized = true;
        initAdmin();
      }
    }

    function showLoginOverlay() {
      var overlay = document.getElementById('adminLoginOverlay');
      var container = document.getElementById('dashboardContainer');
      if (container) container.style.display = 'none';
      if (overlay) overlay.style.display = 'flex';

      var pwdInput = document.getElementById('adminPasswordInput');
      if (pwdInput) {
        pwdInput.value = '';
        setTimeout(function () { pwdInput.focus(); }, 150);
      }
      var errBox = document.getElementById('loginErrorAlert');
      if (errBox) errBox.style.display = 'none';
    }

    function handleAdminLogin(e) {
      if (e && e.preventDefault) e.preventDefault();
      var pwdInput = document.getElementById('adminPasswordInput');
      var enteredPwd = pwdInput ? pwdInput.value : '';
      var correctPwd = getAdminPassword();
      var errAlert = document.getElementById('loginErrorAlert');
      var loginCard = document.getElementById('adminLoginCard');
      var rememberCheck = document.getElementById('rememberAdminLogin');

      if (enteredPwd === correctPwd) {
        if (errAlert) errAlert.style.display = 'none';
        try {
          if (window.sessionStorage) window.sessionStorage.setItem('admin_logged_in', 'true');
        } catch (e) { }

        if (rememberCheck && rememberCheck.checked) {
          LS.setItem('admin_remember_token', 'true');
        } else {
          LS.removeItem('admin_remember_token');
        }

        showDashboard();
      } else {
        if (errAlert) {
          errAlert.style.display = 'flex';
          var errText = document.getElementById('loginErrorText');
          if (errText) errText.textContent = 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง';
        }
        if (loginCard) {
          loginCard.classList.remove('shake');
          void loginCard.offsetWidth;
          loginCard.classList.add('shake');
        }
        if (pwdInput) {
          pwdInput.focus();
          pwdInput.select();
        }
      }
    }

    function toggleAdminPasswordEye() {
      var pwdInput = document.getElementById('adminPasswordInput');
      if (!pwdInput) return;
      var btn = document.querySelector('.password-input-box .btn-toggle-eye');
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        if (btn) btn.textContent = '🙈';
      } else {
        pwdInput.type = 'password';
        if (btn) btn.textContent = '👁️';
      }
    }

    function adminLogout() {
      if (confirm('คุณต้องการออกจากระบบผู้ดูแลระบบใช่หรือไม่?')) {
        try {
          if (window.sessionStorage) window.sessionStorage.removeItem('admin_logged_in');
        } catch (e) { }
        LS.removeItem('admin_remember_token');
        showLoginOverlay();
      }
    }

    function openChangePasswordModal() {
      var modal = document.getElementById('changePasswordModal');
      var curInput = document.getElementById('inputCurrentPassword');
      var newInput = document.getElementById('inputNewPassword');
      var confInput = document.getElementById('inputConfirmPassword');
      var errDiv = document.getElementById('changePwdError');

      if (curInput) curInput.value = '';
      if (newInput) newInput.value = '';
      if (confInput) confInput.value = '';
      if (errDiv) { errDiv.style.display = 'none'; errDiv.textContent = ''; }
      if (modal) modal.classList.add('active');
    }

    function closeChangePasswordModal() {
      var modal = document.getElementById('changePasswordModal');
      if (modal) modal.classList.remove('active');
    }

    function handleSaveNewPassword(e) {
      if (e && e.preventDefault) e.preventDefault();
      var curInput = document.getElementById('inputCurrentPassword');
      var newInput = document.getElementById('inputNewPassword');
      var confInput = document.getElementById('inputConfirmPassword');
      var errDiv = document.getElementById('changePwdError');

      var curPwd = curInput ? curInput.value : '';
      var newPwd = newInput ? newInput.value : '';
      var confPwd = confInput ? confInput.value : '';

      var savedPwd = getAdminPassword();
      if (curPwd !== savedPwd) {
        if (errDiv) {
          errDiv.textContent = 'รหัสผ่านเดิมไม่ถูกต้อง';
          errDiv.style.display = 'block';
        }
        if (curInput) { curInput.focus(); curInput.select(); }
        return;
      }

      if (!newPwd || newPwd.length < 4) {
        if (errDiv) {
          errDiv.textContent = 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร';
          errDiv.style.display = 'block';
        }
        if (newInput) newInput.focus();
        return;
      }

      if (newPwd !== confPwd) {
        if (errDiv) {
          errDiv.textContent = 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน';
          errDiv.style.display = 'block';
        }
        if (confInput) { confInput.focus(); confInput.select(); }
        return;
      }

      LS.setItem('kuekoonkan_admin_pwd', newPwd);
      alert('✅ เปลี่ยนรหัสผ่านผู้ดูแลระบบสำเร็จเรียบร้อยแล้ว!');
      closeChangePasswordModal();
    }

    function initAdmin() {
      updateSoundButtonUI();
      fetchOrders(true);
      fetchProducts(false);
      fetchMembers(false);
      fetchPromoCodes(false);
      renderOverviewDashboard();
      setInterval(() => {
        if (currentTab === 'overview') {
          fetchOrders(false);
        } else if (currentTab === 'orders') {
          fetchOrders(false);
        } else if (currentTab === 'members') {
          fetchMembers(false);
        } else if (currentTab === 'promo') {
          fetchPromoCodes(false);
        }
      }, 12000);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkAdminAuth);
    } else {
      checkAdminAuth();
    }

    function switchTab(tab) {
      currentTab = tab;
      const navOverview = document.getElementById('navOverview');
      const navOrders = document.getElementById('navOrders');
      const navProducts = document.getElementById('navProducts');
      const navMembers = document.getElementById('navMembers');
      const navPromo = document.getElementById('navPromo');

      const viewOverview = document.getElementById('viewOverview');
      const viewOrders = document.getElementById('viewOrders');
      const viewProducts = document.getElementById('viewProducts');
      const viewMembers = document.getElementById('viewMembers');
      const viewPromo = document.getElementById('viewPromo');

      [navOverview, navOrders, navProducts, navMembers, navPromo].forEach(n => { if (n) n.classList.remove('active'); });
      [viewOverview, viewOrders, viewProducts, viewMembers, viewPromo].forEach(v => { if (v) v.style.display = 'none'; });

      if (tab === 'overview') {
        if (navOverview) navOverview.classList.add('active');
        if (viewOverview) viewOverview.style.display = 'block';
        renderOverviewDashboard();
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
      } else if (tab === 'promo') {
        if (navPromo) navPromo.classList.add('active');
        if (viewPromo) viewPromo.style.display = 'block';
        fetchPromoCodes(allPromoCodes.length === 0);
      }
    }

    function goToPendingOrders() {
      switchTab('orders');
      const pendingBtn = document.querySelector('.tab-btn[onclick*="รอตรวจของ"]');
      if (pendingBtn) {
        setFilter('รอตรวจของ', pendingBtn);
      } else {
        activeFilter = 'รอตรวจของ';
        renderOrders();
      }
    }

    function refreshOverviewData() {
      fetchOrders(true);
      fetchProducts(true);
      fetchMembers(true);
      fetchPromoCodes(true);
      renderOverviewDashboard();
      showToast('รีเฟรชข้อมูลภาพรวมแล้ว', 'success');
    }

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
            const meta = getStatusMeta(o.status, o);
            // นับยอดขายเฉพาะออเดอร์ที่ชำระแล้ว / จัดส่งสำเร็จเท่านั้น (ไม่รวมออเดอร์ที่ยังรอลูกค้ายืนยันหรือรอตรวจของ)
            if (meta.name === 'จัดส่งสำเร็จ' || meta.name === 'ต้องส่งรอบถัดไป' || meta.name === 'กำลังจัดส่ง') {
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
        { label: '⏳ รอตรวจของ', count: stats.checking || 0, color: '#f59e0b', bg: '#fef3c7' },
        { label: '📩 รอลูกค้ายืนยัน', count: stats.waitingConfirm || 0, color: '#7c3aed', bg: '#f3e8ff' },
        { label: '💳 รอชำระ (ส่ง QR)', count: stats.payment || 0, color: '#0284c7', bg: '#e0f2fe' },
        { label: '🧾 รอตรวจสลิป (รอตรวจเงิน)', count: stats.slipCheck || 0, color: '#0d9488', bg: '#ccfbf1' },
        { label: '📦 ชำระแล้ว / ต้องส่งรอบถัดไป & กำลังจัดส่ง', count: stats.shipping || 0, color: '#2563eb', bg: '#dbeafe' },
        { label: '✅ จัดส่งสำเร็จ (ยอดขายจริง)', count: stats.completed || 0, color: '#10b981', bg: '#dcfce7' },
        { label: '❌ ยกเลิกคำสั่งซื้อ', count: stats.cancelled || 0, color: '#ef4444', bg: '#fee2e2' }
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
        const meta = getStatusMeta(o.status, o);
        const dateStr = o.timestamp ? new Date(o.timestamp).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
        const roundHtml = getOrderDeliveryRoundHtml(o);
        const waitInfo = getOrderWaitingTimeInfo(o);
        const staffName = getOrderStaffName(o);
        const isTransfer = (o.paymentMethod && (o.paymentMethod.includes('โอน') || o.paymentMethod.includes('บัญชีธนาคาร') || o.paymentMethod.includes('ผสม')));
        const payBadgeClass = isTransfer ? 'pay-badge transfer' : 'pay-badge cod';
        const slipPill = o.slipUrl
          ? `<button type="button" class="btn-slip-pill" style="font-size:10px; padding:2px 6px;" onclick="event.stopPropagation(); openSlipModal('${o.slipUrl}', '${o.orderId || ''}')">🧾 มีสลิป</button>`
          : '';

        tr.innerHTML = `
          <td>
            <strong style="color:var(--primary); font-size:13px;">${o.orderId || '-'}</strong>
            <div style="margin-top:2px; display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
              <span class="${payBadgeClass}" style="font-size:10px; padding:2px 6px;">${o.paymentMethod || 'โอนจ่าย'}</span>
              ${slipPill}
            </div>
          </td>
          <td>
            <div style="margin-bottom:3px;">${roundHtml}</div>
            <div>${waitInfo.badgeHtml} <span style="font-size:10.5px; color:#94a3b8;">(${dateStr})</span></div>
          </td>
          <td>
            <div style="font-weight:600; font-size:13px; color:var(--text-main);">${o.customerName || 'ไม่ระบุชื่อ'}</div>
            <div style="font-size:11px; color:var(--text-muted);">${(o.phone || '').replace(/'/g, '')}</div>
            <div style="margin-top:2px;">
              ${staffName
                ? `<span style="font-size:10.5px; font-weight:700; color:#0369a1; background:#e0f2fe; padding:1px 6px; border-radius:4px;">👤 ผู้ดูแล: ${staffName}</span>`
                : `<span style="font-size:10.5px; color:#94a3b8;">👤 ยังไม่ระบุผู้ดูแล</span>`}
            </div>
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

      // คัดกรองรายการราคา 0 บาท และรายการแลกแต้ม (เช่น 150,000 บาท) ออกจากการจัดอันดับสินค้าขายดี
      let sortedItems = Object.values(itemSalesMap).filter(item => {
        const matched = allProducts.find(p => String(p.id) === String(item.id));
        const unitPrice = Number(item.price || (matched ? matched.price : 0) || (item.qty > 0 ? item.revenue / item.qty : 0));
        if (unitPrice <= 0) return false;
        if (isPointRedemptionProduct({ price: unitPrice, name: item.name, category: matched?.category, tag: matched?.tag })) return false;
        return true;
      }).sort((a, b) => b.qty - a.qty);

      let isFallback = false;
      if (sortedItems.length === 0 && allProducts.length > 0) {
        isFallback = true;
        const validNormalProducts = allProducts.filter(p => {
          const pr = Number(p.price || 0);
          const st = Number(p.stock ?? 0);
          return pr > 0 && st >= 1 && p.status !== 'inactive' && !isPointRedemptionProduct(p);
        });
        sortedItems = validNormalProducts.slice(0, 5).map(p => ({
          id: p.id,
          name: p.name,
          qty: 0,
          price: Number(p.price || 0),
          revenue: Number(p.price || 0),
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
        const unitInfo = getProductUnitInfo(item.name || matchedProduct.name || '');

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
            <div class="top-seller-qty">${isFallback ? ('ราคา ฿' + Number(item.revenue || 0).toLocaleString() + '/' + unitInfo.unit) : ('ขายแล้ว ' + item.qty.toLocaleString() + ' ' + unitInfo.unit)}</div>
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
      let slipCheckCount = 0;
      let preparingCount = 0;
      let shippingCount = 0;
      let cancelledCount = 0;

      let todaySales = 0;
      let todayOrdersCount = 0;
      let todayCompletedCount = 0;
      const todayStr = new Date().toISOString().slice(0, 10);

      const paymentMethodCounts = {
        'โอนจ่าย': 0,
        'ปลายทาง': 0,
        'เงินสด/อื่นๆ': 0
      };

      const itemSalesMap = {};

      allOrders.forEach(o => {
        const meta = getStatusMeta(o.status, o);
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

        // ยอดขายวันนี้นับเฉพาะออเดอร์ที่ส่งสำเร็จแล้ว หรือชำระเงินเรียบร้อยแล้วเท่านั้น (ไม่นับออเดอร์ที่ยังรอลูกค้ายืนยันหรือรอตรวจของ)
        const isPaidOrCompleted = (normStatus === 'จัดส่งสำเร็จ' || normStatus === 'ต้องส่งรอบถัดไป' || normStatus === 'กำลังจัดส่ง');

        if (orderDateStr === todayStr) {
          todayOrdersCount++;
          if (isPaidOrCompleted) {
            todaySales += total;
            todayCompletedCount++;
          }
        }

        if (normStatus === 'รอตรวจของ') checkingCount++;
        else if (normStatus === 'รอลูกค้ายืนยัน') waitingCount++;
        else if (normStatus === 'รอชำระ') paymentCount++;
        else if (normStatus === 'รอตรวจสลิป') slipCheckCount++;
        else if (normStatus === 'ต้องส่งรอบถัดไป') preparingCount++;
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
            // ข้ามรายการราคา 0 บาท หรือรายการแลกแต้มสะสม
            if (p <= 0 || isPointRedemptionProduct({ price: p, name: it.name })) return;

            if (!itemSalesMap[sku]) {
              itemSalesMap[sku] = {
                id: it.id || sku,
                name: it.name || sku,
                price: p,
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
      if (ovTodayOrders) ovTodayOrders.textContent = 'สำเร็จ ' + todayCompletedCount + ' / ทั้งหมด ' + todayOrdersCount + ' ออเดอร์';

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
      const ovWaitingConfirmCount = document.getElementById('ovStatWaitingConfirmCount');
      const ovPaymentCount = document.getElementById('ovStatPaymentCount');
      const pendingTotalCount = checkingCount + waitingCount + paymentCount + slipCheckCount;
      if (ovPendingTotal) ovPendingTotal.textContent = pendingTotalCount;
      if (ovCheckingCount) ovCheckingCount.textContent = checkingCount;
      if (ovWaitingConfirmCount) ovWaitingConfirmCount.textContent = waitingCount;
      if (ovPaymentCount) ovPaymentCount.textContent = (paymentCount + slipCheckCount);

      const ovTotalMembers = document.getElementById('ovStatTotalMembers');
      const ovPhoneMembers = document.getElementById('ovStatPhoneMembers');
      if (ovTotalMembers) ovTotalMembers.textContent = allMembers.length.toLocaleString();
      let phoneCount = 0;
      allMembers.forEach(m => { if (m.phone && m.phone.trim() !== '') phoneCount++; });
      if (ovPhoneMembers) ovPhoneMembers.textContent = phoneCount + ' คน';

      const ovTotalProducts = document.getElementById('ovStatTotalProducts');
      const ovInStockProducts = document.getElementById('ovStatInStockProducts');
      const ovOutStockProducts = document.getElementById('ovStatOutStockProducts');
      const ovCategories = document.getElementById('ovStatCategories');
      if (ovTotalProducts) ovTotalProducts.textContent = allProducts.length.toLocaleString();
      const catSet = new Set();
      let inStockCnt = 0;
      let outStockCnt = 0;
      allProducts.forEach(p => {
        if (p.category) catSet.add(p.category);
        const rawStock = Number(p.stock !== undefined && p.stock !== null ? p.stock : 0);
        const stockQty = rawStock >= 1 ? Math.floor(rawStock) : 0;
        if (stockQty >= 1 && p.status !== 'out_of_stock' && p.status !== 'inactive') inStockCnt++;
        else outStockCnt++;
      });
      if (ovInStockProducts) ovInStockProducts.textContent = 'พร้อมขาย ' + inStockCnt.toLocaleString();
      if (ovOutStockProducts) ovOutStockProducts.textContent = 'ของหมด ' + outStockCnt.toLocaleString();
      if (ovCategories) ovCategories.textContent = '(' + catSet.size + ' หมวดหมู่)';

      const alertBanner = document.getElementById('overviewAlertBanner');
      const alertTitle = document.getElementById('overviewAlertTitle');
      const urgentOrdersCount = checkingCount + slipCheckCount;
      if (alertBanner && alertTitle) {
        if (urgentOrdersCount > 0) {
          alertTitle.textContent = '⚡ มีรายการรอตรวจของ ' + checkingCount + ' รายการ และรอตรวจสลิป ' + slipCheckCount + ' รายการ (รอลูกค้ายืนยัน ' + waitingCount + ' รายการ)';
          alertBanner.style.display = 'flex';
        } else {
          alertBanner.style.display = 'none';
        }
      }

      render7DayTrendChart();

      renderStatusBreakdown({
        checking: checkingCount,
        waitingConfirm: waitingCount,
        payment: paymentCount,
        slipCheck: slipCheckCount,
        shipping: preparingCount + shippingCount,
        completed: completedCount,
        cancelled: cancelledCount,
        total: totalOrdersCount
      });

      renderPaymentBreakdown(paymentMethodCounts, totalOrdersCount);
      renderRecentOrdersList();
      renderTopSellersList(itemSalesMap);
    }

    function setFilter(status, el) {
      activeFilter = status;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      renderOrders();
    }

    function setPaymentFilter(val) {
      activePaymentFilter = val;
      renderOrders();
    }

    function onSearch(val) {
      searchQuery = val.toLowerCase().trim();
      renderOrders();
    }

    function onMemberSearch(val) {
      memberSearchQuery = val.toLowerCase().trim();
      renderMembers();
    }

    function processIncomingOrders(orders) {
      allOrders = orders || [];

      try {
        LS.setItem('cached_admin_orders', JSON.stringify(allOrders));
      } catch (e) { }

      let newCount = 0;
      allOrders.forEach(o => {
        if (o.orderId && !knownOrderIds.has(o.orderId)) {
          if (!isInitialOrdersLoad) {
            newCount++;
          }
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

    async function fetchOrders(showLoading = true) {
      const loading = document.getElementById('loadingIndicator');

      // 1. ตรวจสอบข้อมูลจาก Cache ก่อน เพื่อแสดงผลทันทีแบบ 0ms
      try {
        const cached = LS.getItem('cached_admin_orders');
        if (cached && allOrders.length === 0) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            allOrders = parsed;
            renderOrders();
            updateStats();
            if (loading) loading.style.display = 'none';
          }
        }
      } catch (e) { }

      if (showLoading && allOrders.length === 0) {
        if (loading) loading.style.display = 'flex';
        const tbody = document.getElementById('ordersBody');
        if (tbody) tbody.innerHTML = '';
      }

      // ดึงข้อมูลผ่าน Cloudflare Worker API (D1 Edge) โดยตรงเพื่อความรวดเร็วสูงสุด
      await fetchOrdersViaFetch(showLoading);
    }

    async function fetchOrdersViaFetch(showLoading) {
      const loading = document.getElementById('loadingIndicator');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);
        const res = await fetch(GOOGLE_SCRIPT_URL + '?action=getAllOrders&_t=' + Date.now(), {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data && (data.status === 'success' || Array.isArray(data.orders))) {
            processIncomingOrders(data.orders || []);
            if (loading) loading.style.display = 'none';
            return;
          }
        }
      } catch (err) {
        console.error("fetch API failed:", err);
      }

      if (loading) loading.style.display = 'none';

      if (allOrders.length === 0) {
        const tbody = document.getElementById('ordersBody');
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">' +
            '<div style="font-size: 32px; margin-bottom: 8px;">📦</div>' +
            '<p style="font-weight: 600; color: #64748b; margin-bottom: 6px;">ยังไม่พบข้อมูลคำสั่งซื้อในระบบ</p>' +
            '<p style="font-size: 13px; margin-bottom: 16px; color: #94a3b8;">ยังไม่มีรายการสั่งซื้อ หรือเซิร์ฟเวอร์กำลังเชื่อมต่อกับฐานข้อมูล Cloudflare D1</p>' +
            '<button onclick="fetchOrders(true)" class="btn-primary" style="display:inline-flex; align-items:center; gap:8px;">🔄 รีเฟรชข้อมูล</button>' +
            '</td></tr>';
        }
      }
    }

    function getStatusMeta(status, order) {
      const s = (status || '').trim();
      const hasSlip = !!(order && order.slipUrl && String(order.slipUrl).trim() !== '');
      if (s === 'กำลังตรวจสอบออเดอร์' || s === 'รอตรวจสอบ' || s === 'รอตรวจของ' || s === 'รอพนักงานยืนยันสินค้า') {
        return { name: 'รอตรวจของ', class: 'status-checking', icon: '⏳' };
      } else if (s === 'รอการยืนยัน' || s === 'รอลูกค้ายืนยัน') {
        return { name: 'รอลูกค้ายืนยัน', class: 'status-checking', icon: '🗣️' };
      } else if (s === 'รอตรวจสลิป' || s === 'รอตรวจเงิน') {
        return { name: 'รอตรวจสลิป', class: 'status-payment', icon: '🧾' };
      } else if (s === 'ชำระเงิน' || s === 'รอชำระเงิน' || s === 'รอชำระ') {
        if (hasSlip) {
          return { name: 'รอตรวจสลิป', class: 'status-payment', icon: '🧾' };
        }
        return { name: 'รอชำระ', class: 'status-payment', icon: '💳' };
      } else if (s === 'กำลังจัดเตรียมสินค้า' || s === 'เตรียมออเดอร์' || s === 'จัดเตรียมสินค้าพร้อมส่ง' || s === 'ต้องส่งรอบถัดไป' || s === 'ชำระแล้ว') {
        return { name: 'ต้องส่งรอบถัดไป', class: 'status-preparing', icon: '📦' };
      } else if (s === 'กำลังจัดส่ง') {
        return { name: 'กำลังจัดส่ง', class: 'status-shipping', icon: '🚚' };
      } else if (s === 'จัดส่งสำเร็จ' || s === 'ยืนยันแล้ว') {
        return { name: 'จัดส่งสำเร็จ', class: 'status-completed', icon: '✅' };
      } else if (s === 'ยกเลิก') {
        return { name: 'ยกเลิก', class: 'status-cancelled', icon: '❌' };
      }
      return { name: s || 'รอตรวจของ', class: 'status-checking', icon: '⏳' };
    }

    function renderOrders() {
      const tbody = document.getElementById('ordersBody');
      tbody.innerHTML = '';

      const filtered = allOrders.filter(order => {
        const meta = getStatusMeta(order.status, order);
        let statusMatch = (activeFilter === 'all');
        if (!statusMatch) {
          if (activeFilter === meta.name) statusMatch = true;
          else if ((activeFilter === 'รอตรวจของ' || activeFilter === 'กำลังตรวจสอบออเดอร์') && meta.name === 'รอตรวจของ') statusMatch = true;
          else if ((activeFilter === 'รอลูกค้ายืนยัน' || activeFilter === 'รอการยืนยัน') && meta.name === 'รอลูกค้ายืนยัน') statusMatch = true;
          else if ((activeFilter === 'รอชำระ' || activeFilter === 'ชำระเงิน') && meta.name === 'รอชำระ') statusMatch = true;
          else if ((activeFilter === 'รอตรวจสลิป' || activeFilter === 'รอตรวจเงิน') && meta.name === 'รอตรวจสลิป') statusMatch = true;
          else if ((activeFilter === 'ต้องส่งรอบถัดไป' || activeFilter === 'กำลังจัดเตรียมสินค้า' || activeFilter === 'จัดเตรียมสินค้าพร้อมส่ง') && meta.name === 'ต้องส่งรอบถัดไป') statusMatch = true;
          else if (activeFilter === 'จัดส่งสำเร็จ' && meta.name === 'จัดส่งสำเร็จ') statusMatch = true;
          else statusMatch = (order.status === activeFilter);
        }

        // Payment Method Filter Match
        let paymentMatch = (activePaymentFilter === 'all');
        if (!paymentMatch) {
          const currentMethod = order.paymentMethod || 'โอนจ่าย';
          paymentMatch = (currentMethod === activePaymentFilter);
        }

        const staffName = getOrderStaffName(order);
        const searchMatch = !searchQuery ||
          (order.orderId && order.orderId.toLowerCase().includes(searchQuery)) ||
          (order.customerName && order.customerName.toLowerCase().includes(searchQuery)) ||
          (order.phone && order.phone.includes(searchQuery)) ||
          (order.paymentMethod && order.paymentMethod.toLowerCase().includes(searchQuery)) ||
          (staffName && staffName.toLowerCase().includes(searchQuery)) ||
          (meta.name.toLowerCase().includes(searchQuery));

        return statusMatch && paymentMatch && searchMatch;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr>' +
          '<td colspan="6" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">' +
          '<div style="font-size: 32px; margin-bottom: 8px;">🔍</div>' +
          '<p style="font-weight: 500;">ไม่พบรายการออเดอร์ในหมวดหมู่นี้</p>' +
          '</td>' +
          '</tr>';
        return;
      }

      filtered.forEach(order => {
        const tr = document.createElement('tr');
        const meta = getStatusMeta(order.status, order);

        const dateStr = order.timestamp ? new Date(order.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';
        const cleanPhone = (order.phone || '').replace(/'/g, "");
        const isUnread = !readOrderIds.includes(order.orderId);
        const unreadDot = isUnread ? '<span class="unread-badge" title="ยังไม่ได้เปิดดู"></span>' : '';

        const isTransfer = (order.paymentMethod && (order.paymentMethod.includes('โอน') || order.paymentMethod.includes('บัญชีธนาคาร') || order.paymentMethod.includes('ผสม')));
        const payBadgeClass = isTransfer ? 'pay-badge transfer' : 'pay-badge cod';
        const shipBadge = (order.shippingOption === 'รับหน้าร้าน')
          ? '<span class="pay-badge" style="background-color: #f59e0b; color: white;">🏪 รับหน้าร้าน</span>'
          : '<span class="pay-badge" style="background-color: #3b82f6; color: white;">🚚 จัดส่ง</span>';
        const slipBadge = order.slipUrl
          ? '<button type="button" class="btn-slip-pill" title="คลิกเพื่อดูสลิป" onclick="event.stopPropagation(); openSlipModal(\'' + order.slipUrl + '\', \'' + (order.orderId || '') + '\')">🧾 มีสลิป</button>'
          : '';

        const roundHtml = getOrderDeliveryRoundHtml(order);
        const waitInfo = getOrderWaitingTimeInfo(order);
        const staffName = getOrderStaffName(order);
        const staffBadgeHtml = staffName
          ? '<span style="font-size:11px; font-weight:700; color:#4f46e5; background:#eef2ff; border:1px solid #c7d2fe; padding:2px 7px; border-radius:6px; display:inline-flex; align-items:center; gap:3px;">👤 ' + staffName + '</span>'
          : '<span style="font-size:11px; color:#94a3b8; font-weight:500;">👤 ยังไม่ระบุผู้ดูแล</span>';
        const editHistory = getOrderEditHistory(order);
        const editHistoryBadge = editHistory.length > 0
          ? '<span style="font-size:10.5px; font-weight:700; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:2px 6px; border-radius:6px;" title="มีประวัติการแก้ไขออเดอร์">📝 แก้ไข ' + editHistory.length + ' ครั้ง</span>'
          : '';

        tr.innerHTML = '<td><div style="display: flex; align-items: center;">' +
          unreadDot +
          '<div><strong style="color: var(--primary); font-size: 14px;">' + (order.orderId || '-') + '</strong>' +
          '<div style="margin-top: 5px; display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">' +
          '<span class="' + payBadgeClass + '">' + (order.paymentMethod || 'โอนจ่าย') + '</span>' +
          shipBadge +
          slipBadge +
          editHistoryBadge +
          '</div></div></div></td>' +
          '<td style="font-size: 12.5px; color: var(--text-muted);">' +
          '<div style="margin-bottom: 4px;">' + roundHtml + '</div>' +
          '<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">' +
          '<span>' + dateStr + '</span>' +
          waitInfo.badgeHtml +
          '</div>' +
          '</td>' +
          '<td><div style="font-weight: 600; color: var(--text-main);">' + (order.customerName || 'ไม่ระบุชื่อ') + '</div>' +
          '<div style="font-size: 12px; color: var(--text-muted); margin-bottom: 3px;">📞 ' + cleanPhone + '</div>' +
          '<div>' + staffBadgeHtml + '</div></td>' +
          '<td style="font-weight: 700; color: var(--text-main); font-size: 14.5px;">฿' + Number(order.totalPrice || 0).toLocaleString() + '</td>' +
          '<td><span class="status-badge ' + meta.class + '">' + meta.icon + ' ' + meta.name + '</span></td>' +
          '<td><button class="btn-action" onclick="viewOrder(\'' + (order.orderId || '') + '\')">👁️ ดูรายละเอียด</button></td>';
        tbody.appendChild(tr);
      });
    }

    function updateStats() {
      let checkingCount = 0;      // รอตรวจของ
      let waitingCount = 0;       // รอลูกค้ายืนยัน
      let paymentCount = 0;       // รอชำระ (ส่ง QR)
      let slipCheckCount = 0;     // รอตรวจสลิป / รอตรวจเงิน
      let preparingCount = 0;     // ชำระแล้ว / ต้องส่งรอบถัดไป
      let shippingCount = 0;      // กำลังจัดส่ง
      let completedCount = 0;     // จัดส่งสำเร็จ
      let cancelledCount = 0;     // ยกเลิก
      let confirmedTodaySales = 0;
      let unreadCount = 0;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      allOrders.forEach(o => {
        const meta = getStatusMeta(o.status, o);
        if (meta.name === 'รอตรวจของ') checkingCount++;
        else if (meta.name === 'รอลูกค้ายืนยัน') waitingCount++;
        else if (meta.name === 'รอชำระ') paymentCount++;
        else if (meta.name === 'รอตรวจสลิป') slipCheckCount++;
        else if (meta.name === 'ต้องส่งรอบถัดไป') preparingCount++;
        else if (meta.name === 'กำลังจัดส่ง') shippingCount++;
        else if (meta.name === 'จัดส่งสำเร็จ') completedCount++;
        else if (meta.name === 'ยกเลิก') cancelledCount++;

        // นับยอดขายเฉพาะออเดอร์ที่ชำระแล้วหรือจัดส่งสำเร็จเท่านั้น (ไม่นับออเดอร์ที่ยังรอลูกค้ายืนยันหรือรอตรวจของ)
        const isConfirmedSale = (meta.name === 'จัดส่งสำเร็จ' || meta.name === 'กำลังจัดส่ง' || meta.name === 'ต้องส่งรอบถัดไป');
        if (isConfirmedSale) {
          confirmedTodaySales += Number(o.totalPrice || 0);
        }

        if (o.orderId && !readOrderIds.includes(o.orderId)) {
          unreadCount++;
        }
      });

      if (document.getElementById('stat-pending')) {
        document.getElementById('stat-pending').innerHTML = checkingCount + (waitingCount > 0 ? ' <span style="font-size:12px; color:#d97706; font-weight:600;">(รอลูกค้ายืนยัน ' + waitingCount + ')</span>' : '');
      }
      if (document.getElementById('stat-payment')) {
        document.getElementById('stat-payment').innerHTML = (paymentCount + slipCheckCount) + (slipCheckCount > 0 ? ' <span style="font-size:12px; color:#059669; font-weight:700;">(มีสลิป ' + slipCheckCount + ')</span>' : '');
      }
      if (document.getElementById('stat-confirmed')) document.getElementById('stat-confirmed').textContent = preparingCount + shippingCount + completedCount;
      if (document.getElementById('stat-sales')) document.getElementById('stat-sales').textContent = '฿' + confirmedTodaySales.toLocaleString();

      if (document.getElementById('count-all')) document.getElementById('count-all').textContent = allOrders.length;
      if (document.getElementById('count-pending')) document.getElementById('count-pending').textContent = checkingCount;
      if (document.getElementById('count-waiting')) document.getElementById('count-waiting').textContent = waitingCount;
      if (document.getElementById('count-payment')) document.getElementById('count-payment').textContent = paymentCount;
      if (document.getElementById('count-slip-check')) document.getElementById('count-slip-check').textContent = slipCheckCount;
      if (document.getElementById('count-preparing')) document.getElementById('count-preparing').textContent = preparingCount;
      if (document.getElementById('count-ready-to-ship')) document.getElementById('count-ready-to-ship').textContent = preparingCount;
      if (document.getElementById('count-shipping')) document.getElementById('count-shipping').textContent = shippingCount;
      if (document.getElementById('count-confirmed')) document.getElementById('count-confirmed').textContent = completedCount;
      if (document.getElementById('count-cancelled')) document.getElementById('count-cancelled').textContent = cancelledCount;

      const navBadge = document.getElementById('navUnreadBadge');
      if (navBadge) {
        const totalActionNeeded = checkingCount + waitingCount + slipCheckCount;
        const badgeCount = totalActionNeeded > 0 ? totalActionNeeded : unreadCount;
        if (badgeCount > 0) {
          navBadge.style.display = 'inline-block';
          navBadge.textContent = badgeCount;
        } else {
          navBadge.style.display = 'none';
        }
      }
    }

    function renderModalActions(order) {
      const actionsDiv = document.getElementById('modalActions');
      if (!actionsDiv) return;
      actionsDiv.innerHTML = '';

      if (isModalEditMode) {
        actionsDiv.innerHTML = '<button id="btnSaveEditOrder" class="btn-success" onclick="saveOrderChanges()">💾 บันทึกการแก้ไข & ส่งให้ลูกค้ายืนยัน</button>' +
          '<button id="btnCancelEditOrder" class="btn-secondary" onclick="toggleModalEditMode()">↩️ ยกเลิกการแก้ไข</button>';
        actionsDiv.style.display = 'flex';
      } else {
        let buttonsHtml = '';
        const isEditable = order.status !== 'จัดส่งสำเร็จ' && order.status !== 'ยืนยันแล้ว' && order.status !== 'ยกเลิก';
        if (isEditable) {
          buttonsHtml += '<button id="btnEditOrder" class="btn-warning" onclick="toggleModalEditMode()">✏️ แก้ไขรายการสินค้า (ของหมด/เปลี่ยนของ)</button>';
        }

        const isTransfer = (order.paymentMethod && (order.paymentMethod.includes('โอน') || order.paymentMethod.includes('บัญชีธนาคาร') || order.paymentMethod.includes('ผสม')));
        const isCod = !isTransfer;
        const currentMeta = getStatusMeta(order.status, order);
        const normStatus = currentMeta.name;

        // Quick Next Step Button ตาม Flow: รอตรวจของ -> รอลูกค้ายืนยัน -> รอชำระ / รอตรวจสลิป -> ต้องส่งรอบถัดไป -> กำลังจัดส่ง -> จัดส่งสำเร็จ
        let nextStepBtn = '';
        if (isCod) {
          if (normStatus === 'รอตรวจของ' || normStatus === 'รอลูกค้ายืนยัน') {
            nextStepBtn = '<button class="btn-success" onclick="updateStatus(\'ต้องส่งรอบถัดไป\')">📦 ยืนยันของครบ -> ต้องส่งรอบถัดไป</button>';
          } else if (normStatus === 'ต้องส่งรอบถัดไป') {
            nextStepBtn = '<button class="btn-success" onclick="updateStatus(\'กำลังจัดส่ง\')">🚚 แพ็คลงกล่องเสร็จ -> กำลังจัดส่ง</button>';
          } else if (normStatus === 'กำลังจัดส่ง') {
            nextStepBtn = '<button class="btn-success" onclick="updateStatus(\'จัดส่งสำเร็จ\')">✅ สินค้าถึงลูกค้าแล้ว -> จัดส่งสำเร็จ</button>';
          }
        } else {
          if (normStatus === 'รอตรวจของ') {
            nextStepBtn = '<button class="btn-success" onclick="updateStatus(\'ชำระเงิน\')">💳 ยืนยันของครบ & ส่ง QR เรียกเก็บเงิน</button>';
          } else if (normStatus === 'รอลูกค้ายืนยัน') {
            nextStepBtn = '<button class="btn-success" onclick="updateStatus(\'ชำระเงิน\')">💳 ลูกค้าตกลงแล้ว -> ส่ง QR เรียกเก็บเงิน</button>';
          } else if (normStatus === 'รอชำระ' || normStatus === 'รอตรวจสลิป') {
            nextStepBtn = '<button class="btn-success" onclick="updateStatus(\'ต้องส่งรอบถัดไป\')">✅ ตรวจยอดเงินแล้ว -> ต้องส่งรอบถัดไป</button>';
          } else if (normStatus === 'ต้องส่งรอบถัดไป') {
            nextStepBtn = '<button class="btn-success" onclick="updateStatus(\'กำลังจัดส่ง\')">🚚 แพ็คลงกล่องเสร็จ -> กำลังจัดส่ง</button>';
          } else if (normStatus === 'กำลังจัดส่ง') {
            nextStepBtn = '<button class="btn-success" onclick="updateStatus(\'จัดส่งสำเร็จ\')">✅ สินค้าถึงลูกค้าแล้ว -> จัดส่งสำเร็จ</button>';
          }
        }

        if (nextStepBtn) {
          buttonsHtml += nextStepBtn;
        }

        const statuses = isCod ? [
          { val: 'รอตรวจของ', match: 'รอตรวจของ', label: '⏳ 1. รอตรวจของ' },
          { val: 'รอลูกค้ายืนยัน', match: 'รอลูกค้ายืนยัน', label: '🗣️ 2. รอลูกค้ายืนยัน (หลังแก้ออเดอร์)' },
          { val: 'ต้องส่งรอบถัดไป', match: 'ต้องส่งรอบถัดไป', label: '📦 3. ต้องส่งรอบถัดไป (จัดเตรียมสินค้า)' },
          { val: 'กำลังจัดส่ง', match: 'กำลังจัดส่ง', label: '🚚 4. กำลังจัดส่ง' },
          { val: 'จัดส่งสำเร็จ', match: 'จัดส่งสำเร็จ', label: '✅ 5. จัดส่งสำเร็จ' },
          { val: 'ยกเลิก', match: 'ยกเลิก', label: '❌ ยกเลิกออเดอร์' }
        ] : [
          { val: 'รอตรวจของ', match: 'รอตรวจของ', label: '⏳ 1. รอตรวจของ' },
          { val: 'รอลูกค้ายืนยัน', match: 'รอลูกค้ายืนยัน', label: '🗣️ 2. รอลูกค้ายืนยัน (หลังแก้ออเดอร์)' },
          { val: 'ชำระเงิน', match: 'รอชำระ', label: '💳 3. รอชำระ (ส่ง QR ให้ลูกค้า)' },
          { val: 'รอตรวจสลิป', match: 'รอตรวจสลิป', label: '🧾 4. รอตรวจสลิป / ตรวจเงิน' },
          { val: 'ต้องส่งรอบถัดไป', match: 'ต้องส่งรอบถัดไป', label: '📦 5. ชำระแล้ว / ต้องส่งรอบถัดไป' },
          { val: 'กำลังจัดส่ง', match: 'กำลังจัดส่ง', label: '🚚 6. กำลังจัดส่ง' },
          { val: 'จัดส่งสำเร็จ', match: 'จัดส่งสำเร็จ', label: '✅ 7. จัดส่งสำเร็จ' },
          { val: 'ยกเลิก', match: 'ยกเลิก', label: '❌ ยกเลิกออเดอร์' }
        ];

        let optionsHtml = '';
        statuses.forEach(function (s) {
          optionsHtml += '<option value="' + s.val + '" ' + (currentMeta.name === s.match ? 'selected' : '') + '>' + s.label + '</option>';
        });

        buttonsHtml += '<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">' +
          '<label style="font-weight: 600; font-size: 13px;">เปลี่ยนสถานะ (' + (isCod ? 'ปลายทาง' : 'โอนจ่าย') + '):</label>' +
          '<select id="modalStatusSelect" onchange="updateStatus(this.value)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13.5px; font-weight: 600; background: white; cursor: pointer;">' +
          optionsHtml +
          '</select>' +
          '</div>';

        if (isEditable) {
          buttonsHtml += '<button class="btn-danger" onclick="updateStatus(\'ยกเลิก\')">❌ ยกเลิกออเดอร์</button>';
        }

        actionsDiv.innerHTML = buttonsHtml;
        actionsDiv.style.display = 'flex';
      }
    }

    async function fetchMembers(showLoading = true) {
      const loading = document.getElementById('membersLoadingIndicator');
      if (showLoading && loading) {
        loading.style.display = 'flex';
        document.getElementById('membersBody').innerHTML = '';
      }

      // ดึงข้อมูลสมาชิกผ่าน Cloudflare Worker API (D1 Edge) โดยตรงเพื่อความรวดเร็วสูงสุด
      await fetchMembersViaFetch(showLoading);
    }

    async function fetchMembersViaFetch(showLoading) {
      const loading = document.getElementById('membersLoadingIndicator');
      try {
        const res = await fetch(GOOGLE_SCRIPT_URL + '?action=getAllMembers&_t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data && (data.status === 'success' || Array.isArray(data.members))) {
            allMembers = data.members || [];
            renderMembers();
            updateMemberStats();
            renderOverviewDashboard();
          }
        }
      } catch (err) {
        console.error('fetchMembersViaFetch error:', err);
      }
      if (loading) loading.style.display = 'none';
    }

    // ===== อัปเดตไฟล์แค็ตตาล็อก: Export สินค้าจาก Cloudflare D1 → products.json =====
    async function syncCatalog() {
      const btn = document.getElementById('syncCatalogBtn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังอัปเดตไฟล์...'; }

      try {
        let products = allProducts;
        if (!products || products.length === 0) {
          const res = await fetch(GOOGLE_SCRIPT_URL + '?action=getProducts&all=true&_t=' + Date.now());
          const data = await res.json();
          if (data && data.status === 'success' && Array.isArray(data.products)) {
            products = data.products;
          }
        }

        if (!products || products.length === 0) {
          alert('❌ อัปเดตไม่สำเร็จ: ไม่พบข้อมูลสินค้าในฐานข้อมูล');
          if (btn) { btn.disabled = false; btn.textContent = '📥 อัปเดตไฟล์แค็ตตาล็อก'; }
          return;
        }

        const jsonStr = JSON.stringify({
          status: 'success',
          total: products.length,
          lastUpdated: new Date().toISOString(),
          products: products
        }, null, 2);

        // Download products.json
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products.json';
        a.click();
        URL.revokeObjectURL(url);

        if (btn) { btn.disabled = false; btn.textContent = '📥 อัปเดตไฟล์แค็ตตาล็อก'; }
        alert('✅ ดาวน์โหลดไฟล์แค็ตตาล็อก (products.json) สำเร็จแล้ว (' + products.length.toLocaleString() + ' รายการ)');
      } catch (err) {
        alert('❌ ไม่สามารถดึงข้อมูลสินค้าได้: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = '📥 อัปเดตไฟล์แค็ตตาล็อก'; }
      }
    }

    function getMemberShopName(m) {
      if (!m) return '';
      if (m.shopName && String(m.shopName).trim()) return String(m.shopName).trim();
      try {
        const shopMap = JSON.parse(LS.getItem('admin_member_shop_map') || '{}');
        if (m.userId && shopMap[m.userId]) return shopMap[m.userId];
      } catch (e) {}
      // ลองดึงจากประวัติออเดอร์ล่าสุดของลูกค้ารายนี้
      const cleanMemPhone = (m.phone || '').replace(/\D/g, '');
      const matchedOrder = allOrders.find(o =>
        (m.userId && o.userId && o.userId === m.userId) ||
        (cleanMemPhone && cleanMemPhone.length >= 9 && (o.phone || '').replace(/\D/g, '') === cleanMemPhone)
      );
      if (matchedOrder && matchedOrder.addressDetails) {
        const addr = String(matchedOrder.addressDetails).trim();
        const shopMatch = addr.match(/(ร้าน[^\s,]+)/);
        if (shopMatch) return shopMatch[1];
      }
      return '';
    }

    function getMemberOrderStats(m) {
      if (!m) return { count: 0, lastOrderDate: null, lastOrderTotal: 0, totalSpent: 0 };
      const cleanMemPhone = (m.phone || '').replace(/\D/g, '');
      const memberOrders = allOrders.filter(o => {
        if (o.status === 'ยกเลิก') return false;
        if (m.userId && o.userId && o.userId === m.userId) return true;
        if (cleanMemPhone && cleanMemPhone.length >= 9 && (o.phone || '').replace(/\D/g, '') === cleanMemPhone) return true;
        return false;
      });
      if (memberOrders.length === 0) {
        return { count: 0, lastOrderDate: null, lastOrderTotal: 0, totalSpent: 0 };
      }
      let latestTs = 0;
      let latestTotal = 0;
      let totalSpent = 0;
      memberOrders.forEach(o => {
        const p = Number(o.totalPrice || 0);
        totalSpent += p;
        const ts = o.timestamp ? new Date(o.timestamp).getTime() : 0;
        if (ts >= latestTs) {
          latestTs = ts;
          latestTotal = p;
        }
      });
      return {
        count: memberOrders.length,
        lastOrderDate: latestTs > 0 ? new Date(latestTs) : null,
        lastOrderTotal: latestTotal,
        totalSpent: totalSpent
      };
    }

    function renderMembers() {
      const tbody = document.getElementById('membersBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      const filtered = allMembers.filter(m => {
        if (!memberSearchQuery) return true;
        const shopName = getMemberShopName(m).toLowerCase();
        return (m.displayName && m.displayName.toLowerCase().includes(memberSearchQuery)) ||
          (shopName && shopName.includes(memberSearchQuery)) ||
          (m.phone && m.phone.includes(memberSearchQuery)) ||
          (m.userId && m.userId.toLowerCase().includes(memberSearchQuery)) ||
          (m.email && m.email.toLowerCase().includes(memberSearchQuery));
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr>' +
          '<td colspan="5" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">' +
          '<div style="font-size: 32px; margin-bottom: 8px;">👥</div>' +
          '<p style="font-weight: 500;">ยังไม่มีสมาชิกในระบบหรือหาไม่พบ</p>' +
          '</td>' +
          '</tr>';
        return;
      }

      filtered.forEach(m => {
        const tr = document.createElement('tr');
        const avatarHtml = m.pictureUrl
          ? '<img src="' + m.pictureUrl + '" alt="' + (m.displayName || '') + '" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-light);" />'
          : '<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px;">' + ((m.displayName || 'U').charAt(0)) + '</div>';

        const rawPhone = m.phone ? m.phone.replace(/'/g, "").trim() : '';
        let phoneDisplayHtml = '<span style="color: #94a3b8;">ยังไม่ระบุเบอร์โทร</span>';
        if (rawPhone) {
          if (isValidThaiPhone(rawPhone)) {
            phoneDisplayHtml = '<span style="font-weight: 600; color: #0f172a;">' + formatThaiPhoneNumber(rawPhone) + '</span>';
          } else {
            phoneDisplayHtml = '<span style="font-weight: 600; color: #dc2626; background: #fee2e2; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;" title="เบอร์โทรไม่ถูกต้อง">' +
              '⚠️ ' + rawPhone + ' (ไม่ถูกต้อง)' +
              '</span>';
          }
        }

        const editPhoneBtn = '<button type="button" class="btn-slip-action-sm" style="margin-left: 6px; padding: 2px 6px; font-size: 11px; cursor: pointer;" onclick="event.stopPropagation(); editMemberPhone(\'' + (m.userId || '') + '\', \'' + (rawPhone || '') + '\')" title="แก้ไขเบอร์โทรศัพท์">✏️</button>';

        const shopName = getMemberShopName(m);
        const shopDisplayHtml = shopName
          ? '<span style="font-weight: 700; color: #0369a1; background: #e0f2fe; border: 1px solid #bae6fd; padding: 3px 9px; border-radius: 6px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 4px;">🏪 ' + shopName + '</span>'
          : '<span style="color: #94a3b8; font-size: 12.5px;">ลูกค้าทั่วไป <button type="button" onclick="event.stopPropagation(); openMemberDetailModal(\'' + (m.userId || '') + '\')" style="border:none; background:none; color:#2563eb; cursor:pointer; font-size:11.5px; text-decoration:underline; padding:0; margin-left:4px;">+ระบุชื่อร้าน</button></span>';

        const orderStats = getMemberOrderStats(m);
        let lastPurchaseHtml = '<span style="color: #94a3b8; font-size: 12.5px;">ยังไม่เคยสั่งซื้อ</span>';
        if (orderStats.count > 0) {
          const lastDateTxt = orderStats.lastOrderDate
            ? orderStats.lastOrderDate.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
            : 'มีประวัติสั่งซื้อ';
          lastPurchaseHtml = '<div>' +
            '<div style="font-weight: 700; color: #0f172a; font-size: 13px;">🛒 ' + lastDateTxt + ' <span style="color:#16a34a;">(฿' + orderStats.lastOrderTotal.toLocaleString() + ')</span></div>' +
            '<div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">รวม ' + orderStats.count + ' ออเดอร์ • ยอดสะสม ฿' + orderStats.totalSpent.toLocaleString() + '</div>' +
            '</div>';
        }

        tr.innerHTML = '<td>' +
          '<div style="display: flex; align-items: center; gap: 12px;">' +
          avatarHtml +
          '<div>' +
          '<strong style="font-size: 14px; color: var(--text-main);">' + (m.displayName || 'ไม่ระบุชื่อ') + '</strong>' +
          '</div>' +
          '</div>' +
          '</td>' +
          '<td>' + shopDisplayHtml + '</td>' +
          '<td><div style="display: flex; align-items: center;">' + phoneDisplayHtml + editPhoneBtn + '</div></td>' +
          '<td>' + lastPurchaseHtml + '</td>' +
          '<td style="text-align: right;">' +
          '<button type="button" class="btn-action" onclick="openMemberDetailModal(\'' + (m.userId || '') + '\')">👁️ ดูรายละเอียด</button>' +
          '</td>';
        tbody.appendChild(tr);
      });
    }

    let currentViewingMemberId = null;

    function openMemberDetailModal(userId) {
      const m = allMembers.find(item => item.userId === userId);
      if (!m) return;
      currentViewingMemberId = userId;

      const modal = document.getElementById('memberDetailModal');
      if (!modal) return;

      const shopName = getMemberShopName(m);
      const orderStats = getMemberOrderStats(m);
      let regDateStr = m.registeredAt || '-';
      try {
        if (m.registeredAt) {
          const d = new Date(m.registeredAt);
          if (!isNaN(d.getTime())) regDateStr = d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
        }
      } catch (e) {}

      const nameEl = document.getElementById('memberModalName');
      const avatarEl = document.getElementById('memberModalAvatar');
      const phoneEl = document.getElementById('memberModalPhone');
      const shopInput = document.getElementById('memberModalShopInput');
      const lastPurchaseEl = document.getElementById('memberModalLastPurchase');
      const userIdEl = document.getElementById('memberModalUserId');
      const emailEl = document.getElementById('memberModalEmail');
      const regDateEl = document.getElementById('memberModalRegDate');

      if (nameEl) nameEl.textContent = m.displayName || 'ไม่ระบุชื่อ';
      if (avatarEl) {
        avatarEl.src = m.pictureUrl || 'https://placehold.co/100x100/e2e8f0/475569?text=U';
      }
      if (phoneEl) phoneEl.textContent = m.phone ? formatThaiPhoneNumber(m.phone.replace(/'/g, '')) : 'ยังไม่ระบุเบอร์โทรศัพท์';
      if (shopInput) shopInput.value = shopName || '';
      if (lastPurchaseEl) {
        if (orderStats.count > 0) {
          const dTxt = orderStats.lastOrderDate ? orderStats.lastOrderDate.toLocaleString('th-TH') : '-';
          lastPurchaseEl.innerHTML = 'สั่งล่าสุดเมื่อ <strong>' + dTxt + '</strong> (฿' + orderStats.lastOrderTotal.toLocaleString() + ') • สั่งซื้อรวมทั้งหมด <strong>' + orderStats.count + ' ครั้ง</strong> (ยอดสะสม ฿' + orderStats.totalSpent.toLocaleString() + ')';
        } else {
          lastPurchaseEl.textContent = 'ยังไม่มีประวัติการสั่งซื้อ';
        }
      }
      if (userIdEl) userIdEl.textContent = m.userId || '-';
      if (emailEl) emailEl.textContent = m.email || 'ไม่ได้ระบุอีเมล';
      if (regDateEl) regDateEl.textContent = regDateStr;

      modal.classList.add('active');
    }
    window.openMemberDetailModal = openMemberDetailModal;

    function closeMemberDetailModal() {
      const modal = document.getElementById('memberDetailModal');
      if (modal) modal.classList.remove('active');
      currentViewingMemberId = null;
    }
    window.closeMemberDetailModal = closeMemberDetailModal;

    function saveMemberShopName() {
      if (!currentViewingMemberId) return;
      const shopInput = document.getElementById('memberModalShopInput');
      const newShopName = shopInput ? shopInput.value.trim() : '';
      const m = allMembers.find(item => item.userId === currentViewingMemberId);
      if (m) m.shopName = newShopName;

      try {
        const shopMap = JSON.parse(LS.getItem('admin_member_shop_map') || '{}');
        shopMap[currentViewingMemberId] = newShopName;
        LS.setItem('admin_member_shop_map', JSON.stringify(shopMap));
      } catch (e) {}

      renderMembers();
      showToast('บันทึกชื่อร้านลูกค้าเรียบร้อยแล้ว 🏪', 'success');
    }
    window.saveMemberShopName = saveMemberShopName;

    function updateMemberStats() {
      const elTotal = document.getElementById('stat-total-members');
      const elPhone = document.getElementById('stat-phone-members');
      if (elTotal) elTotal.textContent = allMembers.length;
      let phoneCount = 0;
      allMembers.forEach(m => {
        if (m.phone && isValidThaiPhone(m.phone)) phoneCount++;
      });
      if (elPhone) elPhone.textContent = phoneCount;
    }

    async function editMemberPhone(userId, currentPhone) {
      if (!userId) return;
      const initialVal = (currentPhone === '001' || !isValidThaiPhone(currentPhone)) ? '' : currentPhone;
      const newPhone = prompt('กรุณาระบุเบอร์โทรศัพท์ใหม่ (10 หลัก ขึ้นต้นด้วย 0 เช่น 08X-XXX-XXXX)\n*หากต้องการล้างเบอร์ทิ้ง ให้กดตกลงโดยเว้นว่างไว้*:', initialVal);
      if (newPhone === null) return;

      const trimmed = newPhone.trim();
      const clean = cleanPhoneNumber(trimmed);
      if (trimmed !== '' && !isValidThaiPhone(clean)) {
        alert('⚠️ เบอร์โทรศัพท์ไม่ถูกต้อง!\nกรุณากรอกตัวเลข 10 หลัก ขึ้นต้นด้วย 0 เช่น 0812345678');
        return;
      }

      const toast = showToast('กำลังอัปเดตเบอร์โทรศัพท์...', 'loading');
      try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            userId: userId,
            phone: clean
          })
        });
        const result = await res.json();
        if (toast && toast.parentNode) toast.remove();
        if (result && result.status === 'success') {
          showToast('บันทึกเบอร์โทรศัพท์ใหม่เรียบร้อยแล้ว!', 'success');
          const mem = allMembers.find(m => m.userId === userId);
          if (mem) mem.phone = clean;
          renderMembers();
          updateMemberStats();
        } else {
          showToast('ไม่สามารถบันทึกได้: ' + (result?.message || 'Unknown error'), 'error');
        }
      } catch (err) {
        if (toast && toast.parentNode) toast.remove();
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        console.error('Update member phone error:', err);
      }
    }
    window.editMemberPhone = editMemberPhone;

    let isModalEditMode = false;

    function renderModalSlip(order) {
      const slipContainer = document.getElementById('modalSlipContent');
      const slipActions = document.getElementById('modalSlipActions');
      if (!slipContainer) return;

      const slipUrl = (order.slipUrl || '').trim();

      if (slipUrl) {
        if (slipActions) {
          slipActions.innerHTML = `
            <button type="button" class="btn-slip-action-sm" onclick="openSlipModal('${slipUrl}', '${order.orderId}')" title="ขยายรูปสลิป">🔍 ขยาย</button>
            <a href="${slipUrl}" target="_blank" rel="noopener noreferrer" class="btn-slip-action-sm" title="เปิดรูปในแท็บใหม่">🔗 เปิดเต็ม</a>
            <button type="button" class="btn-slip-action-sm" onclick="promptAdminAttachSlip('${order.orderId}')" title="เปลี่ยนรูปสลิป">✏️ เปลี่ยน</button>
          `;
        }
        slipContainer.innerHTML = `
          <div class="slip-card" onclick="openSlipModal('${slipUrl}', '${order.orderId}')">
            <div class="slip-thumb-wrapper">
              <img src="${slipUrl}" alt="สลิปโอนเงิน" class="slip-thumb-img" onerror="this.onerror=null; this.src='https://placehold.co/400x300/f8fafc/64748b?text=เปิดดูรูปสลิป';" />
              <div class="slip-thumb-hover">
                <span>🔍 คลิกเพื่อขยาย</span>
              </div>
            </div>
            <div style="flex: 1;">
              <div class="slip-status-tag">✅ แนบสลิปโอนเงินแล้ว</div>
              <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">คลิกที่รูปเพื่อเปิดดูสลิปขนาดใหญ่และตรวจสอบยอดเงิน</div>
            </div>
          </div>
        `;
      } else {
        if (slipActions) slipActions.innerHTML = '';
        slipContainer.innerHTML = `
          <div class="slip-empty-box">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🧾</span>
              <span style="font-size: 12px; color: #64748b;">ยังไม่มีสลิปแนบมากับออเดอร์นี้</span>
            </div>
            <button type="button" class="btn-admin-attach-slip" onclick="promptAdminAttachSlip('${order.orderId}')">📎 แนบสลิป</button>
          </div>
        `;
      }
    }

    function openSlipModal(slipUrl, orderId) {
      if (!slipUrl) return;
      const modal = document.getElementById('slipModal');
      const img = document.getElementById('slipModalImage');
      const orderIdEl = document.getElementById('slipModalOrderId');
      const openLink = document.getElementById('slipModalOpenLink');
      if (orderIdEl) orderIdEl.textContent = orderId ? `(${orderId})` : '';
      if (openLink) openLink.href = slipUrl;
      if (img) {
        img.src = slipUrl;
        img.onerror = function() {
          this.src = 'https://placehold.co/600x800/0f172a/94a3b8?text=ไม่สามารถโหลดรูปภาพสลิปได้';
        };
      }
      if (modal) modal.classList.add('active');
    }
    window.openSlipModal = openSlipModal;

    function closeSlipModal() {
      const modal = document.getElementById('slipModal');
      if (modal) modal.classList.remove('active');
    }
    window.closeSlipModal = closeSlipModal;

    async function promptAdminAttachSlip(orderId) {
      const inputUrl = prompt('กรุณากรอก URL รูปภาพสลิป หรือวางลิงก์รูปภาพ (Google Drive / ลิงก์ตรง):');
      if (!inputUrl || !inputUrl.trim()) return;

      const cleanUrl = inputUrl.trim();
      const order = allOrders.find(o => o.orderId === orderId);
      if (order) order.slipUrl = cleanUrl;

      // Update UI
      if (currentViewingOrderId === orderId && order) {
        renderModalSlip(order);
      }
      renderOrders();

      // Send to server
      try {
        showToast('กำลังบันทึกสลิป...', 'info');
        const res = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'uploadSlip', orderId: orderId, slipUrl: cleanUrl })
        });
        const result = await res.json();
        if (result.status === 'success') {
          showToast('บันทึกสลิปเรียบร้อยแล้ว', 'success');
        } else {
          showToast(result.message || 'บันทึกสลิปสำเร็จ (Local)', 'info');
        }
      } catch(e) {
        showToast('บันทึกสลิปสำเร็จ (Local Update)', 'success');
      }
    }
    window.promptAdminAttachSlip = promptAdminAttachSlip;

    function viewOrder(orderId) {
      currentViewingOrderId = orderId;
      isModalEditMode = false;
      const order = allOrders.find(o => o.orderId === orderId);
      if (!order) return;

      // Mark order as read (remove red dot) - lightweight, no full re-render
      if (!readOrderIds.includes(orderId)) {
        readOrderIds.push(orderId);
        try { LS.setItem('admin_read_orders', JSON.stringify(readOrderIds)); } catch (e) { }
        // Remove just the dot from the row instead of re-rendering entire table
        const dots = document.querySelectorAll('.unread-badge');
        dots.forEach(dot => {
          const row = dot.closest('tr');
          if (row && row.innerHTML.includes(orderId)) dot.remove();
        });
        updateStats();
      }

      document.getElementById('modalOrderId').textContent = order.orderId;
      document.getElementById('modalCustomerName').textContent = order.customerName;
      document.getElementById('modalPhone').textContent = (order.phone || '').replace(/'/g, "");
      if (document.getElementById('modalPayment')) {
        document.getElementById('modalPayment').textContent = order.paymentMethod || '-';
      }

      const roundInfoEl = document.getElementById('modalDeliveryRoundInfo');
      if (roundInfoEl) {
        const waitInfo = getOrderWaitingTimeInfo(order);
        roundInfoEl.innerHTML = getOrderDeliveryRoundHtml(order) + (waitInfo.badgeHtml ? ' ' + waitInfo.badgeHtml : '');
      }

      const currentStaff = getOrderStaffName(order) || (LS.getItem('admin_last_staff_name') || '');
      const modalStaffInput = document.getElementById('modalStaffNameInput');
      if (modalStaffInput) modalStaffInput.value = getOrderStaffName(order) || '';
      const editStaffInput = document.getElementById('editStaffNameInput');
      if (editStaffInput) editStaffInput.value = currentStaff;

      const noteBox = document.getElementById('editNoteContainer');
      if (noteBox) noteBox.style.display = 'none';
      const reasonSelect = document.getElementById('editReasonSelect');
      if (reasonSelect) reasonSelect.value = '';
      const noteInput = document.getElementById('editChangeNote');
      if (noteInput) noteInput.value = '';

      // === GPS / Map Section ===
      let gpsUrl = extractGpsUrl(order.gpsLocation, order.addressDetails, order.customerName);

      const gpsEl = document.getElementById('modalGps');
      const mapContainer = document.getElementById('modalMapContainer');
      const mapFrame = document.getElementById('modalMapFrame');
      if (mapContainer) mapContainer.style.display = 'none';
      if (mapFrame) mapFrame.innerHTML = '';

      if (gpsUrl) {
        if (mapContainer) mapContainer.dataset.gpsUrl = gpsUrl;
        gpsEl.innerHTML = '<a href="' + gpsUrl + '" target="_blank" rel="noopener noreferrer" class="gps-link">📌 เปิดแผนที่ Google Maps</a> ' +
          '<button class="btn-open-map" onclick="toggleMapEmbed(true)">🗺️ ดูแผนที่ในหน้านี้</button>';
      } else {
        gpsEl.textContent = order.gpsLocation || '-';
      }

      document.getElementById('modalAddress').textContent = order.addressDetails || '-';

      // === Slip Section ===
      renderModalSlip(order);

      // === Render Items ===
      renderModalItems(order, false);

      // === Render Edit History (Audit Log) ===
      renderOrderEditHistory(order);

      // Dynamic action buttons
      renderModalActions(order);

      document.getElementById('orderModal').classList.add('active');
    }

    function saveOrderStaffName() {
      if (!currentViewingOrderId) return;
      const input = document.getElementById('modalStaffNameInput');
      const staffName = input ? input.value.trim() : '';
      const order = allOrders.find(o => o.orderId === currentViewingOrderId);
      if (order) order.staffName = staffName;

      try {
        const staffMap = JSON.parse(LS.getItem('admin_order_staff_map') || '{}');
        staffMap[currentViewingOrderId] = staffName;
        LS.setItem('admin_order_staff_map', JSON.stringify(staffMap));
        if (staffName) LS.setItem('admin_last_staff_name', staffName);
      } catch (e) {}

      const editStaffInput = document.getElementById('editStaffNameInput');
      if (editStaffInput && staffName) editStaffInput.value = staffName;

      renderOrders();
      renderOverviewDashboard();
      showToast(staffName ? ('บันทึกผู้ดูแลออเดอร์: ' + staffName + ' 👤') : 'ล้างชื่อผู้ดูแลออเดอร์แล้ว', 'success');

      // ส่งอัปเดตไปเก็บที่ Server ด้วย
      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateOrderStaff',
          orderId: currentViewingOrderId,
          staffName: staffName
        })
      }).catch(() => {});
    }
    window.saveOrderStaffName = saveOrderStaffName;

    function onEditReasonSelectChange(val) {
      const noteInput = document.getElementById('editChangeNote');
      if (!noteInput) return;
      if (val && val !== 'อื่นๆ (ระบุในช่องรายละเอียดด้านล่าง)' && !noteInput.value.trim()) {
        noteInput.placeholder = 'ระบุรายละเอียดเพิ่มเติมสำหรับ "' + val + '" (ถ้ามี)...';
      }
    }
    window.onEditReasonSelectChange = onEditReasonSelectChange;

    function renderOrderEditHistory(order) {
      const section = document.getElementById('modalEditHistorySection');
      const listEl = document.getElementById('modalEditHistoryList');
      if (!section || !listEl) return;

      const history = getOrderEditHistory(order);
      if (!history || history.length === 0) {
        section.style.display = 'none';
        listEl.innerHTML = '';
        return;
      }

      section.style.display = 'block';
      listEl.innerHTML = history.map((entry, idx) => {
        const timeStr = entry.timestamp ? new Date(entry.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';
        const staff = entry.staffName || 'แอดมิน';
        const reason = entry.reason || 'แก้ไขรายการสินค้า';
        const oldTotalTxt = entry.oldTotal !== undefined ? ('฿' + Number(entry.oldTotal).toLocaleString()) : '-';
        const newTotalTxt = entry.newTotal !== undefined ? ('฿' + Number(entry.newTotal).toLocaleString()) : '-';
        const changesArr = Array.isArray(entry.changes) ? entry.changes : [];
        const changesHtml = changesArr.length > 0
          ? '<ul style="margin: 6px 0 0 18px; padding: 0; font-size: 12px; color: #334155; line-height: 1.5;">' +
            changesArr.map(c => '<li>' + c + '</li>').join('') +
            '</ul>'
          : '';

        return '<div style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 10px 12px; font-size: 12.5px;">' +
          '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">' +
          '<div><strong style="color: #0f172a;">ครั้งที่ ' + (idx + 1) + ' • 👤 ' + staff + '</strong> <span style="background:#fef3c7; color:#b45309; font-weight:700; padding:2px 7px; border-radius:5px; font-size:11.5px; margin-left:4px;">📌 ' + reason + '</span></div>' +
          '<span style="color: #64748b; font-size: 11.5px;">🕒 ' + timeStr + '</span>' +
          '</div>' +
          '<div style="margin-top: 5px; font-size: 12px; color: #475569;">💰 ยอดรวมเดิม: <del style="color:#94a3b8;">' + oldTotalTxt + '</del> ➔ ยอดรวมใหม่: <strong style="color:#16a34a;">' + newTotalTxt + '</strong></div>' +
          changesHtml +
          '</div>';
      }).join('');
    }
    window.renderOrderEditHistory = renderOrderEditHistory;

    function recordOrderEditAudit(order, entry) {
      if (!order || !order.orderId) return [];
      const history = getOrderEditHistory(order).slice();
      history.push(entry);
      order.editHistory = history;
      if (entry.staffName) order.staffName = entry.staffName;
      try {
        const histMap = JSON.parse(LS.getItem('admin_order_edit_history') || '{}');
        histMap[order.orderId] = history;
        LS.setItem('admin_order_edit_history', JSON.stringify(histMap));
        if (entry.staffName) {
          const staffMap = JSON.parse(LS.getItem('admin_order_staff_map') || '{}');
          staffMap[order.orderId] = entry.staffName;
          LS.setItem('admin_order_staff_map', JSON.stringify(staffMap));
          LS.setItem('admin_last_staff_name', entry.staffName);
        }
      } catch (e) {}
      return history;
    }

    let currentEditingOrder = null;

    function toggleModalEditMode() {
      if (!currentViewingOrderId) return;
      const order = allOrders.find(o => o.orderId === currentViewingOrderId);
      if (!order) return;

      isModalEditMode = !isModalEditMode;

      if (isModalEditMode) {
        currentEditingOrder = JSON.parse(JSON.stringify(order));
        const editStaffInput = document.getElementById('editStaffNameInput');
        const modalStaffInput = document.getElementById('modalStaffNameInput');
        if (editStaffInput && !editStaffInput.value.trim()) {
          editStaffInput.value = (modalStaffInput && modalStaffInput.value.trim()) || getOrderStaffName(order) || (LS.getItem('admin_last_staff_name') || '');
        }
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
        alert('ไม่พบสินค้ารหัส: ' + sku + '\n(โหลดข้อมูลมาได้ ' + adminProducts.length + ' รายการ)\n*หากเพิ่งอัปเดตโค้ด กรุณาทำ New Deployment หรือรีเฟรช*');
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

    function renderModalItems(order, isEditMode = false) {
      const itemsBody = document.getElementById('modalItemsBody');
      itemsBody.innerHTML = '';
      const isEditable = order.status !== 'ยืนยันแล้ว' && order.status !== 'ยกเลิก';

      if (order.items) {
        order.items.forEach((item, index) => {
          const itemPrice = Number(item.price || 0);
          const itemQty = Number(item.qty || 1);
          const itemSubtotal = Number(item.subtotal || (itemPrice * itemQty));

          const tr = document.createElement('tr');
          tr.dataset.index = index;

          if (isEditMode) {
            tr.innerHTML = '<td>' + (item.id || '-') + '</td>' +
              '<td><strong>' + (item.name || '-') + '</strong></td>' +
              '<td>' +
              '<input type="number" class="input-edit-qty" data-index="' + index + '" value="' + itemQty + '" min="1" oninput="onRowEditChange(' + index + ')">' +
              '</td>' +
              '<td>' +
              '<input type="number" class="input-edit-price" data-index="' + index + '" value="' + itemPrice + '" min="0" step="1" oninput="onRowEditChange(' + index + ')">' +
              '</td>' +
              '<td><span class="row-subtotal-text" id="rowSubtotal_' + index + '">฿' + itemSubtotal.toLocaleString() + '</span></td>' +
              '<td style="text-align:center;">' +
              (order.items.length > 1
                ? '<button class="btn-delete-item" onclick="deleteOrderItem(\'' + order.orderId + '\', ' + index + ')" title="ลบรายการนี้">🗑️</button>'
                : '<span style="color:#cbd5e1; font-size:14px;">—</span>') +
              '</td>';
          } else {
            tr.innerHTML = '<td>' + (item.id || '-') + '</td>' +
              '<td><strong>' + (item.name || '-') + '</strong></td>' +
              '<td>x' + itemQty + '</td>' +
              '<td>฿' + itemPrice.toLocaleString() + '</td>' +
              '<td>฿' + itemSubtotal.toLocaleString() + '</td>' +
              '<td style="text-align:center;">' +
              (isEditable && order.items.length > 1
                ? '<button class="btn-delete-item" onclick="deleteOrderItem(\'' + order.orderId + '\', ' + index + ')" title="ลบรายการนี้">🗑️</button>'
                : '<span style="color:#cbd5e1; font-size:14px;">—</span>') +
              '</td>';
          }
          itemsBody.appendChild(tr);
        });
      }

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
      if (subtotalEl) subtotalEl.textContent = '฿' + itemsSubtotal.toLocaleString();

      const feeEl = document.getElementById('modalShippingFee');
      if (feeEl) {
        if (isPickup) {
          feeEl.innerHTML = '<span style="color: #16a34a;">ฟรี ฿0 (รับหน้าร้าน)</span>';
        } else if (shippingFee === 0) {
          feeEl.innerHTML = '<span style="color: #16a34a;">ฟรี ฿0</span>';
        } else {
          feeEl.textContent = '฿' + shippingFee.toLocaleString();
        }
      }

      const optionLabelEl = document.getElementById('modalShippingOptionLabel');
      if (optionLabelEl) optionLabelEl.textContent = isPickup ? 'รับหน้าร้าน' : 'จัดส่ง';

      const totalEl = document.getElementById('modalTotalPrice');
      if (totalEl) totalEl.textContent = '฿' + grandTotal.toLocaleString();
    }

    function onRowEditChange(index) {
      const qtyInput = document.querySelector('.input-edit-qty[data-index="' + index + '"]');
      const priceInput = document.querySelector('.input-edit-price[data-index="' + index + '"]');
      const subtotalEl = document.getElementById('rowSubtotal_' + index);

      if (!qtyInput || !priceInput) return;

      const qty = Math.max(1, parseInt(qtyInput.value) || 1);
      const price = Math.max(0, parseFloat(priceInput.value) || 0);
      const subtotal = qty * price;

      if (subtotalEl) {
        subtotalEl.textContent = '฿' + subtotal.toLocaleString();
      }

      recalculateModalTotalFromInputs();
    }

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
      if (subtotalEl) subtotalEl.textContent = '฿' + itemsSubtotal.toLocaleString();

      const feeEl = document.getElementById('modalShippingFee');
      if (feeEl) {
        if (isPickup) {
          feeEl.innerHTML = '<span style="color: #16a34a;">ฟรี ฿0 (รับหน้าร้าน)</span>';
        } else if (shippingFee === 0) {
          feeEl.innerHTML = '<span style="color: #16a34a;">ฟรี ฿0</span>';
        } else {
          feeEl.textContent = '฿' + shippingFee.toLocaleString();
        }
      }

      const totalEl = document.getElementById('modalTotalPrice');
      if (totalEl) totalEl.textContent = '฿' + newGrandTotal.toLocaleString();
    }

    function saveOrderChanges() {
      if (!currentViewingOrderId) return;
      const order = currentEditingOrder || allOrders.find(o => o.orderId === currentViewingOrderId);
      if (!order) return;

      const reasonSelect = document.getElementById('editReasonSelect');
      const selectedReason = reasonSelect ? reasonSelect.value.trim() : '';
      const changeNoteInput = document.getElementById('editChangeNote');
      const customNote = changeNoteInput ? changeNoteInput.value.trim() : '';
      const editStaffInput = document.getElementById('editStaffNameInput');
      const modalStaffInput = document.getElementById('modalStaffNameInput');
      const staffName = (editStaffInput && editStaffInput.value.trim()) || (modalStaffInput && modalStaffInput.value.trim()) || getOrderStaffName(order) || '';

      if (!selectedReason && !customNote) {
        alert('⚠️ กรุณาเลือก "เหตุผลในการแก้ไข" (เช่น สินค้าบางรายการหมดชั่วคราว / เปลี่ยนยี่ห้อหรือขนาดทดแทน) ก่อนกดบันทึก');
        if (reasonSelect) reasonSelect.focus();
        return;
      }

      if (!staffName) {
        alert('⚠️ กรุณาระบุ "ชื่อพนักงานผู้แก้ไข" เพื่อบันทึกประวัติการแก้ไขออเดอร์');
        if (editStaffInput) editStaffInput.focus();
        return;
      }

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

      // คำนวณรายละเอียดการเปลี่ยนแปลง (ค่าเดิม -> ค่าใหม่)
      const diffs = [];
      const origItems = (originalOrder && Array.isArray(originalOrder.items)) ? originalOrder.items : [];
      origItems.forEach(oldItem => {
        const matchNew = updatedItems.find(n => String(n.id) === String(oldItem.id) && n.name === oldItem.name);
        if (!matchNew) {
          diffs.push('ลบรายการ: "' + (oldItem.name || '-') + '" (เดิม x' + (oldItem.qty || 1) + ' ฿' + Number(oldItem.price || 0).toLocaleString() + ')');
        } else {
          if (Number(matchNew.qty) !== Number(oldItem.qty) || Number(matchNew.price) !== Number(oldItem.price)) {
            diffs.push('แก้ไข "' + (oldItem.name || '-') + '": เดิม x' + oldItem.qty + ' (฿' + Number(oldItem.price || 0).toLocaleString() + ') ➔ ใหม่ x' + matchNew.qty + ' (฿' + Number(matchNew.price || 0).toLocaleString() + ')');
          }
        }
      });
      updatedItems.forEach(newItem => {
        const matchOld = origItems.find(o => String(o.id) === String(newItem.id) && o.name === newItem.name);
        if (!matchOld) {
          diffs.push('เพิ่มสินค้าใหม่: "' + (newItem.name || '-') + '" x' + newItem.qty + ' (฿' + Number(newItem.price || 0).toLocaleString() + ')');
        }
      });
      if (diffs.length === 0 && origTotal !== newGrandTotal) {
        diffs.push('ปรับยอดรวมสุทธิ: เดิม ฿' + origTotal.toLocaleString() + ' ➔ ใหม่ ฿' + newGrandTotal.toLocaleString());
      }

      const fullReasonText = selectedReason && customNote && selectedReason !== 'อื่นๆ (ระบุในช่องรายละเอียดด้านล่าง)'
        ? (selectedReason + ' (' + customNote + ')')
        : (customNote || selectedReason || 'แก้ไขรายการสินค้า');

      if (!confirm('ยืนยันการปรับเปลี่ยนข้อมูลออเดอร์ ' + currentViewingOrderId + '\nเหตุผล: ' + fullReasonText + '\nผู้แก้ไข: ' + staffName + '\n\nและส่งแจ้งเตือนให้ลูกค้ากดยืนยันผ่าน LINE หรือไม่?')) {
        return;
      }

      const auditEntry = {
        timestamp: new Date().toISOString(),
        staffName: staffName,
        reason: fullReasonText,
        oldTotal: origTotal,
        newTotal: newGrandTotal,
        changes: diffs
      };
      const updatedHistory = recordOrderEditAudit(originalOrder || order, auditEntry);

      const btnSave = document.getElementById('btnSaveEditOrder');
      const btnCancel = document.getElementById('btnCancelEditOrder');
      if (btnSave) { btnSave.disabled = true; btnSave.textContent = '⏳ กำลังบันทึก & แจ้งลูกค้า...'; }
      if (btnCancel) btnCancel.disabled = true;

      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateOrderItems',
          orderId: currentViewingOrderId,
          items: updatedItems,
          totalPrice: newGrandTotal,
          changeNote: fullReasonText + ( staffName ? ' [ผู้ดูแล: ' + staffName + ']' : '' ),
          staffName: staffName,
          editHistory: updatedHistory
        })
      })
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success') {
          alert('✅ บันทึกการแก้ไขข้อมูลและส่งแจ้งเตือนให้ลูกค้ากดยืนยันผ่าน LINE เรียบร้อยแล้ว!');
          if (originalOrder) {
            originalOrder.items = updatedItems;
            originalOrder.totalPrice = newGrandTotal;
            originalOrder.status = 'รอลูกค้ายืนยัน';
            originalOrder.staffName = staffName;
            originalOrder.editHistory = updatedHistory;
          }
          order.items = updatedItems;
          order.totalPrice = newGrandTotal;
          order.status = 'รอลูกค้ายืนยัน';
          order.staffName = staffName;
          order.editHistory = updatedHistory;

          isModalEditMode = false;
          currentEditingOrder = null;

          const noteBox = document.getElementById('editNoteContainer');
          if (noteBox) noteBox.style.display = 'none';
          if (modalStaffInput) modalStaffInput.value = staffName;

          renderModalItems(originalOrder || order, false);
          renderOrderEditHistory(originalOrder || order);
          renderModalActions(originalOrder || order);
          renderOrders();
          updateStats();
          renderOverviewDashboard();
        } else {
          alert('❌ ไม่สามารถบันทึกได้: ' + (result.message || 'Unknown error'));
          if (btnSave) { btnSave.disabled = false; btnSave.textContent = '💾 บันทึกการแก้ไข & ส่งให้ลูกค้ายืนยัน'; }
          if (btnCancel) btnCancel.disabled = false;
        }
      })
      .catch(err => {
        console.error('Save order error:', err);
        alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ');
        if (btnSave) { btnSave.disabled = false; btnSave.textContent = '💾 บันทึกการแก้ไข & ส่งให้ลูกค้ายืนยัน'; }
        if (btnCancel) btnCancel.disabled = false;
      });
    }

    function deleteOrderItem(orderId, itemIndex) {
      const order = currentEditingOrder || allOrders.find(o => o.orderId === orderId);
      if (!order || !order.items) return;
      const itemToDelete = order.items[itemIndex];
      if (!itemToDelete) return;

      const itemName = itemToDelete.name || 'รายการนี้';
      const defaultReason = 'สินค้าหมดชั่วคราว (ลบ "' + itemName + '")';
      const reasonInput = prompt('ระบุเหตุผลในการลบ "' + itemName + '" ออกจากออเดอร์ (เพื่อแจ้งลูกค้าและบันทึกประวัติ):', defaultReason);
      if (reasonInput === null) return;
      const reasonText = reasonInput.trim() || defaultReason;

      let staffName = getOrderStaffName(order) || (LS.getItem('admin_last_staff_name') || '');
      if (!staffName) {
        const staffPrompt = prompt('ระบุชื่อพนักงานผู้แก้ไข:', 'แอดมิน');
        if (staffPrompt === null) return;
        staffName = staffPrompt.trim() || 'แอดมิน';
      }

      const row = document.querySelector('#modalItemsBody tr[data-index="' + itemIndex + '"]');
      if (row) row.classList.add('item-row-deleting');

      setTimeout(() => {
        const origTotal = Number(order.totalPrice || 0);
        const newItems = order.items.filter((_, i) => i !== itemIndex);
        let newTotal = 0;
        newItems.forEach(item => {
          newTotal += Number(item.subtotal || (Number(item.price || 0) * Number(item.qty || 1)));
        });

        const originalOrder = allOrders.find(o => o.orderId === orderId);
        const auditEntry = {
          timestamp: new Date().toISOString(),
          staffName: staffName,
          reason: reasonText,
          oldTotal: origTotal,
          newTotal: newTotal,
          changes: ['ลบรายการ: "' + itemName + '" (เดิม x' + (itemToDelete.qty || 1) + ' ฿' + Number(itemToDelete.price || 0).toLocaleString() + ')']
        };
        const updatedHistory = recordOrderEditAudit(originalOrder || order, auditEntry);

        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateOrderItems',
            orderId: orderId,
            items: newItems,
            totalPrice: newTotal,
            changeNote: reasonText + ' [ผู้ดูแล: ' + staffName + ']',
            staffName: staffName,
            editHistory: updatedHistory
          })
        })
        .then(res => res.json())
        .then(result => {
          if (result.status === 'success') {
            order.items = newItems;
            order.totalPrice = newTotal;
            order.status = 'รอลูกค้ายืนยัน';
            order.staffName = staffName;
            order.editHistory = updatedHistory;
            if (originalOrder) {
              originalOrder.items = newItems;
              originalOrder.totalPrice = newTotal;
              originalOrder.status = 'รอลูกค้ายืนยัน';
              originalOrder.staffName = staffName;
              originalOrder.editHistory = updatedHistory;
            }
            const modalStaffInput = document.getElementById('modalStaffNameInput');
            if (modalStaffInput) modalStaffInput.value = staffName;
            renderModalItems(order, isModalEditMode);
            renderOrderEditHistory(originalOrder || order);
            renderModalActions(originalOrder || order);
            renderOrders();
            updateStats();
            renderOverviewDashboard();
          } else {
            alert('❌ ไม่สามารถบันทึกได้: ' + (result.message || 'Unknown error'));
          }
        })
        .catch(err => {
          console.error('Delete item error:', err);
          alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ');
        });
      }, 350);
    }

    // === Toggle Embedded Map ===
    function toggleMapEmbed(show) {
      const mapContainer = document.getElementById('modalMapContainer');
      const mapFrame = document.getElementById('modalMapFrame');
      if (show) {
        const gpsUrl = mapContainer.dataset.gpsUrl || '';
        if (!gpsUrl) return;
        let lat = '', lng = '';
        const atMatch = gpsUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        const qMatch = gpsUrl.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/) || gpsUrl.match(/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (atMatch) { lat = atMatch[1]; lng = atMatch[2]; }
        else if (qMatch) { lat = qMatch[1]; lng = qMatch[2]; }

        if (lat && lng) {
          mapFrame.innerHTML = '<iframe src="https://maps.google.com/maps?q=' + lat + ',' + lng + '&z=16&output=embed" allowfullscreen loading="lazy"></iframe>';
        } else {
          mapFrame.innerHTML = '<iframe src="https://maps.google.com/maps?q=' + encodeURIComponent(gpsUrl) + '&z=15&output=embed" allowfullscreen loading="lazy"></iframe>';
        }
        mapContainer.style.display = 'block';
      } else {
        mapContainer.style.display = 'none';
        mapFrame.innerHTML = '';
      }
    }

    function closeModal() {
      document.getElementById('orderModal').classList.remove('active');
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

      toast.innerHTML = '<span style="font-size: 40px; display: inline-flex; align-items: center;">' + icon + '</span> <span>' + message + '</span>';
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

    function updateStatus(newStatus) {
      if (!currentViewingOrderId) return;
      if (!confirm('ยืนยันการเปลี่ยนสถานะออเดอร์เป็น "' + newStatus + '" หรือไม่?')) return;

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
      const loadingToast = showToast('กำลังอัปเดตสถานะออเดอร์เป็น "' + newStatus + '"...', 'loading');

      // 2. Perform network request directly to Cloudflare Worker (D1 Edge)
      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateOrderStatus',
          orderId: orderId,
          status: newStatus
        })
      })
      .then(res => res.json())
      .then(result => {
        if (loadingToast && loadingToast.parentNode) loadingToast.remove();
        if (result.status === 'success') {
          showToast("อัปเดตสถานะออเดอร์สำเร็จ!");
          fetchOrders(false);
        } else {
          allOrders[orderIndex].status = originalStatus;
          renderOrders();
          updateStats();
          showToast("ไม่สามารถอัปเดตสถานะได้: " + (result.message || 'Unknown error'), 'error');
        }
      })
      .catch(err => {
        if (loadingToast && loadingToast.parentNode) loadingToast.remove();
        allOrders[orderIndex].status = originalStatus;
        renderOrders();
        updateStats();
        showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ", 'error');
        console.error("Update status error:", err);
      });
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
       Product Catalog Logic & Handlers (Admin Cloudflare D1)
       ========================================================================== */

    function getOptimizedImageUrl(url) {
      if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
        return 'https://placehold.co/400x400/f3f0ec/a88b62?text=No+Image';
      }
      let optimizedUrl = url.trim();
      if (optimizedUrl.includes('1779018898541-98193691087.jpg')) {
        return 'https://placehold.co/400x400/f3f0ec/a88b62?text=No+Image';
      }
      if (optimizedUrl.includes('drive.google.com') || optimizedUrl.includes('docs.google.com')) {
        let driveId = '';
        const match1 = optimizedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        const match2 = optimizedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match1) driveId = match1[1];
        else if (match2) driveId = match2[1];
        if (driveId) {
          optimizedUrl = 'https://lh3.googleusercontent.com/d/' + driveId;
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

      try {
        LS.removeItem('cached_admin_products');
      } catch (e) { }

      let fetchedData = null;

      // 1. ลองดึงข้อมูลสดจาก Cloudflare D1
      try {
        const res = await fetch(GOOGLE_SCRIPT_URL + '?action=getProducts&all=true&_t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === 'success' && Array.isArray(data.products) && data.products.length > 0) {
            fetchedData = data.products;
          }
        }
      } catch (err) {
        console.warn('Fetch products from D1 error:', err);
      }

      // 2. ถ้า D1 โดนบล็อกโควตาหรือคืนค่าผิดพลาด ให้สลับมาใช้ products.json สำรองทันที
      if (!fetchedData || fetchedData.length === 0) {
        console.warn('D1 unavailable or blocked, loading fallback products.json');
        try {
          const res = await fetch('./products.json?_t=' + Date.now(), { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.products || []);
            if (Array.isArray(list) && list.length > 0) {
              fetchedData = list;
              console.log('Admin loaded backup products from products.json:', fetchedData.length);
            }
          }
        } catch (e) {
          console.error('Fallback products.json error:', e);
        }
      }

      if (fetchedData && Array.isArray(fetchedData) && fetchedData.length > 0) {
        processIncomingProducts(fetchedData);
      } else if (allProducts.length === 0) {
        const tbody = document.getElementById('productsBody');
        if (tbody) {
          tbody.innerHTML = '<tr>' +
            '<td colspan="7" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">' +
            '<div style="font-size: 36px; margin-bottom: 8px;">⚠️</div>' +
            '<p style="font-weight: 600; color: #ef4444; margin-bottom: 6px;">ไม่สามารถดึงข้อมูลสินค้าได้</p>' +
            '<p style="font-size: 13px; margin-bottom: 16px;">กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือกดปุ่มรีเฟรชอีกครั้ง</p>' +
            '<button onclick="fetchProducts(true)" class="btn-primary">🔄 ลองใหม่อีกครั้ง</button>' +
            '</td>' +
            '</tr>';
        }
      }

      isProductsLoading = false;
      if (loading) loading.style.display = 'none';
    }

    function processIncomingProducts(products) {
      allProducts = products || [];
      adminProducts = allProducts;
      isAdminProductsLoaded = true;

      populateCategoryAndTagFilters();
      applyProductFilters();
      updateProductStats();
      renderOverviewDashboard();

      // ซิงค์สถานะสินค้าที่ถูกปิด (Inactive) จากเซิร์ฟเวอร์
      fetch(GOOGLE_SCRIPT_URL + '?action=getInactiveProducts&_t=' + Date.now())
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.inactiveIds) && data.inactiveIds.length > 0) {
            const set = new Set(data.inactiveIds.map(String));
            let changed = false;
            allProducts.forEach(p => {
              if (set.has(String(p.id)) && p.status !== 'inactive') {
                p.status = 'inactive';
                changed = true;
              }
            });
            if (changed) {
              applyProductFilters();
              updateProductStats();
            }
          }
        }).catch(err => {});
    }

    function populateCategoryAndTagFilters() {
      const catSelect = document.getElementById('productCategoryFilter');
      const tagSelect = document.getElementById('productTagFilter');
      const pillsContainer = document.getElementById('productCategoryPills');

      const currentCatVal = catSelect ? catSelect.value : 'all';
      const currentTagVal = tagSelect ? tagSelect.value : 'all';

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

      // 1. Populate Category Pills Bar (Horizontal Quick Tabs)
      if (pillsContainer) {
        let pillsHtml = '<button class="cat-pill ' + (productSelectedCategory === 'all' ? 'active' : '') + '" data-category="all" onclick="selectCategoryPill(\'all\')">' +
          'ทั้งหมด <span class="pill-count">' + allProducts.length.toLocaleString() + '</span>' +
          '</button>';

        sortedCats.forEach(c => {
          const count = allProducts.filter(p => p.category === c).length;
          const isActive = (productSelectedCategory === c) ? ' active' : '';
          pillsHtml += '<button class="cat-pill' + isActive + '" data-category="' + c + '" onclick="selectCategoryPill(\'' + c.replace(/'/g, "\\'") + '\')">' +
            c + ' <span class="pill-count">' + count.toLocaleString() + '</span>' +
            '</button>';
        });
        pillsContainer.innerHTML = pillsHtml;
      }

      // 2. Populate Dropdowns
      if (catSelect) {
        let catHtml = '<option value="all">📂 หมวดหมู่ทั้งหมด (' + allProducts.length.toLocaleString() + ')</option>';
        sortedCats.forEach(c => {
          const count = allProducts.filter(p => p.category === c).length;
          catHtml += '<option value="' + c + '">' + c + ' (' + count.toLocaleString() + ')</option>';
        });
        catSelect.innerHTML = catHtml;
        if (sortedCats.includes(currentCatVal)) catSelect.value = currentCatVal;
      }

      if (tagSelect) {
        let tagHtml = '<option value="all">🏷️ แท็ก: ทั้งหมด</option>';
        sortedTags.forEach(t => {
          const count = allProducts.filter(p => p.tag === t).length;
          tagHtml += '<option value="' + t + '">' + t + ' (' + count.toLocaleString() + ')</option>';
        });
        tagSelect.innerHTML = tagHtml;
        if (sortedTags.includes(currentTagVal)) tagSelect.value = currentTagVal;
      }
    }

    function selectCategoryPill(cat) {
      productSelectedCategory = cat;
      const catSelect = document.getElementById('productCategoryFilter');
      if (catSelect) catSelect.value = cat;

      document.querySelectorAll('.cat-pill').forEach(pill => {
        if (pill.dataset.category === cat) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });

      applyProductFilters();
    }

    function selectStatusPill(status) {
      productSelectedStatus = status;
      const statusSelect = document.getElementById('productStatusFilter');
      if (statusSelect) statusSelect.value = productSelectedStatus;

      syncStatusPillsUI();
      applyProductFilters();
    }

    function syncStatusPillsUI() {
      const segButtons = document.querySelectorAll('.status-seg-btn');
      segButtons.forEach(btn => {
        if (btn.dataset.status === productSelectedStatus) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    function clearProductSearch() {
      const input = document.getElementById('adminProductSearchInput');
      if (input) input.value = '';
      productSearchQuery = '';
      const clearBtn = document.getElementById('btnClearProductSearch');
      if (clearBtn) clearBtn.style.display = 'none';
      applyProductFilters();
    }

    function resetAllProductFilters() {
      productSelectedCategory = 'all';
      productSelectedTag = 'all';
      productSelectedStatus = 'all';
      productSearchQuery = '';
      productSortOrder = 'default';

      const catSelect = document.getElementById('productCategoryFilter');
      if (catSelect) catSelect.value = 'all';
      const tagSelect = document.getElementById('productTagFilter');
      if (tagSelect) tagSelect.value = 'all';
      const statusSelect = document.getElementById('productStatusFilter');
      if (statusSelect) statusSelect.value = 'all';
      const sortSelect = document.getElementById('productSortFilter');
      if (sortSelect) sortSelect.value = 'default';
      const searchInput = document.getElementById('adminProductSearchInput');
      if (searchInput) searchInput.value = '';
      const clearBtn = document.getElementById('btnClearProductSearch');
      if (clearBtn) clearBtn.style.display = 'none';

      document.querySelectorAll('.cat-pill').forEach(pill => {
        if (pill.dataset.category === 'all') pill.classList.add('active');
        else pill.classList.remove('active');
      });

      syncStatusPillsUI();
      applyProductFilters();
    }

    function applyProductFilters() {
      const search = productSearchQuery.toLowerCase();
      const statusSelect = document.getElementById('productStatusFilter');
      if (statusSelect) productSelectedStatus = statusSelect.value;

      filteredProducts = allProducts.filter(p => {
        const isInactive = (p.status && String(p.status).toLowerCase() === 'inactive');
        const rawStock = Number(p.stock !== undefined && p.stock !== null ? p.stock : 0);
        const stockQty = rawStock >= 1 ? Math.floor(rawStock) : 0;
        const isOutStock = stockQty < 1 || (p.status && p.status === 'out_of_stock');
        const isPointRedeem = isPointRedemptionProduct(p);
        const isZeroPrice = Number(p.price || 0) <= 0;

        if (productSelectedStatus === 'point_redeem') {
          if (!isPointRedeem) return false;
        } else if (productSelectedStatus === 'zero_price') {
          if (!isZeroPrice || isPointRedeem) return false;
        } else {
          // แยกรายการแลกแต้มออกจากหน้าสินค้าขายปกติโดยอัตโนมัติ (ยกเว้นค้นหาตรงตัว)
          if (!search && isPointRedeem) return false;
          if (productSelectedStatus === 'active' && isInactive) return false;
          if (productSelectedStatus === 'inactive' && !isInactive) return false;
          if (productSelectedStatus === 'in_stock' && isOutStock) return false;
          if (productSelectedStatus === 'out_of_stock' && !isOutStock) return false;
        }

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
      } else if (productSortOrder === 'stock_desc') {
        filteredProducts.sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0));
      } else if (productSortOrder === 'stock_asc') {
        filteredProducts.sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));
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
        let filterDesc = '';
        if (productSelectedStatus === 'active') filterDesc += ' (🟢 เฉพาะเปิดแสดง)';
        else if (productSelectedStatus === 'inactive') filterDesc += ' (🚫 เฉพาะที่ปิดการแสดงผล)';
        else if (productSelectedStatus === 'in_stock') filterDesc += ' (📦 เฉพาะที่มีสต็อก)';
        else if (productSelectedStatus === 'out_of_stock') filterDesc += ' (❌ เฉพาะที่สต็อกหมด)';
        else if (productSelectedStatus === 'point_redeem') filterDesc += ' (🎁 รายการแลกแต้มสะสม - แยกจากสินค้าขายปกติ)';
        else if (productSelectedStatus === 'zero_price') filterDesc += ' (⚠️ สินค้าราคา 0 บาท - รอตรวจสอบราคา)';
        if (productSelectedCategory !== 'all') filterDesc += ' (หมวด: ' + productSelectedCategory + ')';
        if (productSelectedTag !== 'all') filterDesc += ' (แท็ก: ' + productSelectedTag + ')';
        if (productSearchQuery) filterDesc += ' (ค้นหา: "' + productSearchQuery + '")';

        showingText.textContent = 'แสดง ' + countToDisplay.toLocaleString() + ' จากที่ค้นพบ ' + filteredProducts.length.toLocaleString() + ' รายการ' + filterDesc;
      }

      const btnReset = document.getElementById('btnResetFilters');
      if (btnReset) {
        const isFiltered = (productSelectedCategory !== 'all' || productSelectedTag !== 'all' || productSelectedStatus !== 'all' || productSearchQuery !== '');
        btnReset.style.display = isFiltered ? 'inline-block' : 'none';
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

    // ดึงหน่วยสินค้า (เช่น ใบ, แพ็ค, ลัง, หิ้ว, มัด, ขวด, ชิ้น) จากชื่อสินค้าโดยอัตโนมัติ
    function getProductUnitInfo(productOrName) {
      const rawName = typeof productOrName === 'object' ? (productOrName && productOrName.name ? productOrName.name : '') : String(productOrName || '');
      const str = rawName.trim();
      if (!str) return { unit: 'ชิ้น', badge: 'ชิ้น' };

      const parenMatch = str.match(/\(\s*(ลัง|แพ็ค|แพค|หิ้ว|มัด|กระสอบ|ถาด|แผง|กล่อง|แถว|โหล|ถุง)\s*([0-9xX\*]*)\s*\)/i);
      const innerMatch = str.match(/(?<!เบอร์\s*)(?<!รุ่น\s*)(\d+)\s*(ใบ|ชุด|เส้น|ชิ้น|ซอง|คัน|ก้าน|ม้วน|แผ่น|ดวง|หลอด|ก้อน|ขวด|กระป๋อง|กล่อง|ถ้วย|ถุง|เล่ม|คู่|อัน|ด้าม|ลูก)(?!\s*ละ)/);

      if (parenMatch) {
        const u = parenMatch[1] === 'แพค' ? 'แพ็ค' : parenMatch[1];
        const q = parenMatch[2] ? ' ' + parenMatch[2] : '';
        const innerTxt = innerMatch ? ' (' + innerMatch[1] + ' ' + innerMatch[2] + ')' : '';
        return { unit: u, badge: u + q + innerTxt };
      }

      const perUnitMatch = str.match(/(ฟอง|ใบ|ชิ้น|อัน|ซอง|ขวด|ก้อน|แผ่น|ม้วน|แพ็ค|แพค|ถุง|กล่อง|ลูก|เส้น|หลอด)ละ/);
      if (perUnitMatch) {
        const u = perUnitMatch[1] === 'แพค' ? 'แพ็ค' : perUnitMatch[1];
        return { unit: u, badge: u };
      }

      if (innerMatch) {
        return { unit: innerMatch[2], badge: innerMatch[1] + ' ' + innerMatch[2] };
      }

      if (/ไข่ไก่|ไข่เป็ด|ไข่เยี่ยวม้า|ไข่เค็ม/.test(str)) return { unit: 'ฟอง', badge: 'ฟอง' };
      if (/แกลลอน/.test(str)) return { unit: 'แกลลอน', badge: 'แกลลอน' };
      if (/กระปุก/.test(str)) return { unit: 'กระปุก', badge: 'กระปุก' };
      if (/กระป๋อง/.test(str)) return { unit: 'กระป๋อง', badge: 'กระป๋อง' };
      if (/ขวด/.test(str)) return { unit: 'ขวด', badge: 'ขวด' };
      if (/กล่อง/.test(str)) return { unit: 'กล่อง', badge: 'กล่อง' };
      if (/ถ้วย/.test(str)) return { unit: 'ถ้วย', badge: 'ถ้วย' };
      if (/ถาด/.test(str)) return { unit: 'ถาด', badge: 'ถาด' };
      if (/กระสอบ/.test(str)) return { unit: 'กระสอบ', badge: 'กระสอบ' };
      if (/ลัง/.test(str)) return { unit: 'ลัง', badge: 'ลัง' };
      if (/แพ็ค|แพค/.test(str)) return { unit: 'แพ็ค', badge: 'แพ็ค' };
      if (/หิ้ว/.test(str) && !/ถุงหิ้ว/.test(str)) return { unit: 'หิ้ว', badge: 'หิ้ว' };
      if (/มัด/.test(str)) return { unit: 'มัด', badge: 'มัด' };
      if (/แผง/.test(str)) return { unit: 'แผง', badge: 'แผง' };
      if (/ซอง/.test(str)) return { unit: 'ซอง', badge: 'ซอง' };
      if (/ม้วน/.test(str)) return { unit: 'ม้วน', badge: 'ม้วน' };
      if (/แผ่น/.test(str)) return { unit: 'แผ่น', badge: 'แผ่น' };
      if (/ก้อน/.test(str)) return { unit: 'ก้อน', badge: 'ก้อน' };
      if (/เล่ม|สมุด/.test(str)) return { unit: 'เล่ม', badge: 'เล่ม' };
      if (/ถุง/.test(str)) return { unit: 'แพ็ค', badge: 'แพ็ค' };
      if (/ใบ/.test(str) && !/ชาใบ|ใบชา|ใบเตย|ใบหยก|เรือใบ/.test(str)) return { unit: 'ใบ', badge: 'ใบ' };

      return { unit: 'ชิ้น', badge: 'ชิ้น' };
    }

    function renderProductsTable() {
      const tbody = document.getElementById('productsBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      const slice = filteredProducts.slice(0, productVisibleLimit);

      if (slice.length === 0) {
        tbody.innerHTML = '<tr>' +
          '<td colspan="6" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">' +
          '<div style="font-size: 36px; margin-bottom: 8px;">🔍</div>' +
          '<p style="font-weight: 600; font-size: 15px; color: var(--text-main);">ไม่พบสินค้าที่ตรงกับเงื่อนไขการค้นหา</p>' +
          '<p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">ลองเปลี่ยนคำค้นหา หรือกดเลือกหมวดหมู่ "ทั้งหมด"</p>' +
          '<button onclick="resetAllProductFilters()" class="btn-sound-toggle" style="margin-top: 12px; display: inline-flex; align-items: center; gap: 6px;">🔄 ล้างตัวกรองทั้งหมด</button>' +
          '</td>' +
          '</tr>';
        return;
      }

      slice.forEach(p => {
        const tr = document.createElement('tr');
        const imgUrl = getOptimizedImageUrl(p.img);
        const tagHtml = p.tag ? '<span class="tag-badge">⭐ ' + p.tag + '</span>' : '';
        const catName = p.category || 'ทั่วไป';
        const isInactive = (p.status && String(p.status).toLowerCase() === 'inactive');
        const isActive = !isInactive;

        const rawStock = Number(p.stock !== undefined && p.stock !== null ? p.stock : 0);
        const stockQty = rawStock >= 1 ? Math.floor(rawStock) : 0;
        const isOutStock = (stockQty < 1) || (p.status === 'out_of_stock');
        const isLowStock = !isOutStock && (stockQty <= 5);
        const unitInfo = getProductUnitInfo(p);

        let stockBoxBg = '#f0fdf4';
        let stockBoxBorder = '#bbf7d0';
        let stockBoxVal = '#15803d';

        if (isOutStock) {
          stockBoxBg = '#fef2f2';
          stockBoxBorder = '#fecaca';
          stockBoxVal = '#dc2626';
        } else if (isLowStock) {
          stockBoxBg = '#fffbeb';
          stockBoxBorder = '#fde68a';
          stockBoxVal = '#b45309';
        }

        if (!isActive) {
          tr.classList.add('product-row-inactive');
        }

        tr.innerHTML = '<td>' +
          '<div class="product-cell-main">' +
          '<img src="' + imgUrl + '" alt="' + (p.name || '') + '" class="product-thumb-large" onclick="openProductDetailModal(\'' + p.id + '\')" onerror="this.onerror=null; this.src=\'https://placehold.co/400x400/f3f0ec/a88b62?text=No+Image\';">' +
          '<div class="product-info-text">' +
          '<span class="product-title-text" onclick="openProductDetailModal(\'' + p.id + '\')">' + (p.name || 'ไม่มีชื่อสินค้า') + '</span>' +
          '<div class="product-sub-badges">' +
          '<span class="sku-chip" onclick="copyProductSku(\'' + p.id + '\', event)" title="คลิกเพื่อคัดลอกรหัสสินค้า">📋 ' + (p.id || '-') + '</span>' +
          '<span style="font-size: 11px; font-weight: 700; color: #0369a1; background: #e0f2fe; border: 1px solid #bae6fd; padding: 2px 7px; border-radius: 6px;">📦 หน่วย: ' + unitInfo.badge + '</span>' +
          tagHtml +
          (!isActive ? '<span class="status-pill status-pill-inactive" style="font-size: 11px;">⚪ ซ่อนอยู่</span>' : '') +
          '</div>' +
          '</div>' +
          '</div>' +
          '</td>' +
          '<td><span class="category-badge">📂 ' + catName + '</span></td>' +
          '<td><span class="price-tag-big">฿' + (Number(p.price) || 0).toLocaleString() + '</span> <small style="font-size:11px; color:#64748b; font-weight:600;">/ ' + unitInfo.unit + '</small></td>' +
          '<td style="text-align: center;">' +
          '<span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; background: ' + stockBoxBg + '; color: ' + stockBoxVal + '; border: 1px solid ' + stockBoxBorder + ';">' +
          (isOutStock ? '❌ 0 (หมด)' : '📦 ' + stockQty.toLocaleString() + ' ' + unitInfo.unit) +
          '</span>' +
          '</td>' +
          '<td style="text-align: center;">' +
          '<div class="product-status-toggle-wrapper" onclick="event.stopPropagation()">' +
          '<label class="switch-toggle" title="' + (isActive ? 'คลิกเพื่อปิดซ่อนสินค้านี้ไม่ให้ลูกค้าเห็น' : 'คลิกเพื่อเปิดให้ลูกค้าเห็นสินค้านี้') + '">' +
          '<input type="checkbox" ' + (isActive ? 'checked' : '') + ' onchange="toggleProductStatus(\'' + p.id + '\', this.checked, event)">' +
          '<span class="slider-round"></span>' +
          '</label>' +
          '<span class="status-pill ' + (isActive ? 'status-pill-active' : 'status-pill-inactive') + '">' +
          (isActive ? '🟢 เปิดแสดง' : '⚪ ปิดซ่อน') +
          '</span>' +
          '</div>' +
          '</td>' +
          '<td style="text-align: right;">' +
          '<button class="btn-view" onclick="openProductDetailModal(\'' + p.id + '\')" style="white-space: nowrap;">🔍 ดูข้อมูล</button>' +
          '</td>';
        tbody.appendChild(tr);
      });
    }

    function renderProductsGrid() {
      const container = document.getElementById('productCardsGrid');
      if (!container) return;
      container.innerHTML = '';

      const slice = filteredProducts.slice(0, productVisibleLimit);

      if (slice.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted);">' +
          '<div style="font-size: 36px; margin-bottom: 8px;">🔍</div>' +
          '<p style="font-weight: 600; font-size: 15px; color: var(--text-main);">ไม่พบสินค้าที่ตรงกับเงื่อนไขการค้นหา</p>' +
          '<p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">ลองเปลี่ยนคำค้นหา หรือกดเลือกหมวดหมู่ "ทั้งหมด"</p>' +
          '<button onclick="resetAllProductFilters()" class="btn-sound-toggle" style="margin-top: 12px; display: inline-flex; align-items: center; gap: 6px;">🔄 ล้างตัวกรองทั้งหมด</button>' +
          '</div>';
        return;
      }

      slice.forEach(p => {
        const card = document.createElement('div');
        card.className = 'admin-product-card';
        const imgUrl = getOptimizedImageUrl(p.img);
        const tagHtml = p.tag ? '<div class="admin-product-card-tag">⭐ ' + p.tag + '</div>' : '';
        const isInactive = (p.status && String(p.status).toLowerCase() === 'inactive');
        const isActive = !isInactive;

        const rawStock = Number(p.stock !== undefined && p.stock !== null ? p.stock : 0);
        const stockQty = rawStock >= 1 ? Math.floor(rawStock) : 0;
        const isOutStock = (stockQty < 1) || (p.status === 'out_of_stock');
        const isLowStock = !isOutStock && (stockQty <= 5);
        const unitInfo = getProductUnitInfo(p);

        let stockBadgeStyle = '';
        let stockBadgeText = '';
        let stockBoxBg = '';
        let stockBoxBorder = '';
        let stockBoxLabel = '';
        let stockBoxVal = '';

        if (isOutStock) {
          stockBadgeStyle = 'background: rgba(220, 38, 38, 0.92); color: #ffffff;';
          stockBadgeText = '❌ สต็อก 0 (หมด)';
          stockBoxBg = '#fef2f2';
          stockBoxBorder = '#fecaca';
          stockBoxLabel = '#991b1b';
          stockBoxVal = '#dc2626';
        } else if (isLowStock) {
          stockBadgeStyle = 'background: rgba(217, 119, 6, 0.92); color: #ffffff;';
          stockBadgeText = '⚠️ เหลือ ' + stockQty.toLocaleString() + ' ' + unitInfo.unit;
          stockBoxBg = '#fffbeb';
          stockBoxBorder = '#fde68a';
          stockBoxLabel = '#92400e';
          stockBoxVal = '#b45309';
        } else {
          stockBadgeStyle = 'background: rgba(16, 185, 129, 0.92); color: #ffffff;';
          stockBadgeText = '📦 คงเหลือ ' + stockQty.toLocaleString() + ' ' + unitInfo.unit;
          stockBoxBg = '#f0fdf4';
          stockBoxBorder = '#bbf7d0';
          stockBoxLabel = '#166534';
          stockBoxVal = '#15803d';
        }

        if (!isActive) {
          card.classList.add('card-inactive');
        }

        card.innerHTML = '<div class="admin-product-card-img-wrap" onclick="openProductDetailModal(\'' + p.id + '\')" style="cursor: pointer; position: relative;">' +
          '<img src="' + imgUrl + '" alt="' + (p.name || '') + '" class="admin-product-card-img" loading="lazy" onerror="this.onerror=null; this.src=\'https://placehold.co/400x400/f3f0ec/a88b62?text=No+Image\';">' +
          tagHtml +
          '<div class="admin-product-card-category-float">' + (p.category || 'ทั่วไป') + '</div>' +
          
          '<!-- ป้ายจำนวนสต็อกลอยบนรูป -->' +
          '<div style="position: absolute; top: 8px; right: 8px; ' + stockBadgeStyle + ' font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 700; backdrop-filter: blur(4px); box-shadow: 0 2px 6px rgba(0,0,0,0.2); z-index: 2; display: flex; align-items: center; gap: 4px;">' +
          stockBadgeText +
          '</div>' +

          (!isActive ? '<div style="position: absolute; top: 38px; right: 8px; background: rgba(15,23,42,0.85); color: #e2e8f0; font-size: 10.5px; padding: 2px 7px; border-radius: 5px; font-weight: 600; backdrop-filter: blur(4px); z-index: 2;">⚪ ซ่อนอยู่</div>' : '') +
          '</div>' +
          '<div class="admin-product-card-body">' +
          '<div class="admin-product-card-title" title="' + (p.name || '') + '" onclick="openProductDetailModal(\'' + p.id + '\')" style="cursor: pointer;">' + (p.name || 'ไม่มีชื่อสินค้า') + '</div>' +
          
          '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; gap: 4px; flex-wrap: wrap;">' +
          '<span class="sku-chip" onclick="copyProductSku(\'' + p.id + '\', event)" title="คลิกคัดลอก SKU">📋 ' + (p.id || '-') + '</span>' +
          '<span style="font-size: 10.5px; font-weight: 700; color: #0369a1; background: #e0f2fe; border: 1px solid #bae6fd; padding: 2px 6px; border-radius: 6px;">📦 ' + unitInfo.badge + '</span>' +
          '</div>' +

          '<!-- แถบแสดงจำนวนสต็อกคงเหลือชัดเจน -->' +
          '<div style="display: flex; align-items: center; justify-content: space-between; padding: 5px 9px; background: ' + stockBoxBg + '; border: 1px solid ' + stockBoxBorder + '; border-radius: 8px; margin-bottom: 7px;">' +
          '<span style="font-size: 11.5px; font-weight: 600; color: ' + stockBoxLabel + '; display: flex; align-items: center; gap: 4px;">' +
          '<span>📦 สต็อกสินค้า:</span>' +
          '</span>' +
          '<span style="font-size: 12.5px; font-weight: 800; color: ' + stockBoxVal + '; background: #ffffff; padding: 2px 8px; border-radius: 6px; border: 1px solid ' + stockBoxBorder + '; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">' +
          (isOutStock ? '❌ 0 (หมด)' : stockQty.toLocaleString() + ' ' + unitInfo.unit) +
          '</span>' +
          '</div>' +

          '<div style="display: flex; align-items: center; justify-content: space-between; padding: 5px 0; border-top: 1px dashed var(--border); margin-bottom: 8px;">' +
          '<span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">แสดงให้ลูกค้าเห็น:</span>' +
          '<div style="display: flex; align-items: center; gap: 6px;" onclick="event.stopPropagation()">' +
          '<label class="switch-toggle switch-toggle-sm" title="' + (isActive ? 'ปิดซ่อนสินค้านี้ไม่ให้ลูกค้าเห็น' : 'เปิดแสดงสินค้านี้ให้ลูกค้าเห็น') + '">' +
          '<input type="checkbox" ' + (isActive ? 'checked' : '') + ' onchange="toggleProductStatus(\'' + p.id + '\', this.checked, event)">' +
          '<span class="slider-round"></span>' +
          '</label>' +
          '<span style="font-size: 11.5px; font-weight: 600; color: ' + (isActive ? '#059669' : '#64748b') + ';">' + (isActive ? 'เปิด' : 'ปิด') + '</span>' +
          '</div>' +
          '</div>' +
          '<div class="admin-product-card-footer">' +
          '<div>' +
          '<div class="admin-product-card-price">฿' + (Number(p.price) || 0).toLocaleString() + '</div>' +
          '</div>' +
          '<button class="btn-view" onclick="openProductDetailModal(\'' + p.id + '\')">ดูข้อมูล</button>' +
          '</div>' +
          '</div>';
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

      // Status Switch in Detail Modal
      const isInactive = (product.status && String(product.status).toLowerCase() === 'inactive');
      const isActive = !isInactive;
      const cb = document.getElementById('detailProductStatusCheckbox');
      const badge = document.getElementById('detailProductStatusBadge');
      const hint = document.getElementById('detailProductStatusHint');
      if (cb) cb.checked = isActive;
      if (badge) {
        badge.className = 'status-pill ' + (isActive ? 'status-pill-active' : 'status-pill-inactive');
        badge.textContent = isActive ? '🟢 เปิดแสดง' : '⚪ ปิดซ่อน';
      }
      if (hint) {
        hint.textContent = isActive ? 'เปิดให้ลูกค้าเห็นและสั่งซื้อได้ตามปกติ' : 'สินค้านี้ถูกซ่อนอยู่ ลูกค้าจะไม่เห็นในหน้าร้าน';
      }

      // Stock Badge in Detail Modal
      const stockBadge = document.getElementById('detailProductStockBadge');
      if (stockBadge) {
        const rawStock = Number(product.stock !== undefined && product.stock !== null ? product.stock : 0);
        const stockQty = rawStock >= 1 ? Math.floor(rawStock) : 0;
        const unitInfo = getProductUnitInfo(product);
        if (stockQty < 1 || product.status === 'out_of_stock') {
          stockBadge.textContent = '❌ สินค้าหมดสต็อก (0 ' + unitInfo.unit + ')';
          stockBadge.style.color = '#dc2626';
          stockBadge.style.borderColor = '#fca5a5';
          stockBadge.style.background = '#fef2f2';
        } else if (stockQty <= 5) {
          stockBadge.textContent = '⚠️ เหลือ ' + stockQty.toLocaleString() + ' ' + unitInfo.unit + ' (ใกล้หมด)';
          stockBadge.style.color = '#d97706';
          stockBadge.style.borderColor = '#fde68a';
          stockBadge.style.background = '#fffbeb';
        } else {
          stockBadge.textContent = '📦 ' + stockQty.toLocaleString() + ' ' + unitInfo.unit;
          stockBadge.style.color = '#15803d';
          stockBadge.style.borderColor = '#86efac';
          stockBadge.style.background = '#ffffff';
        }
      }

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
        showToast('คัดลอกรหัสสินค้า ' + sku + ' แล้ว!', 'success');
      }).catch(() => {
        const temp = document.createElement('input');
        temp.value = sku;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
        showToast('คัดลอกรหัสสินค้า ' + sku + ' แล้ว!', 'success');
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
      const statusSelect = document.getElementById('productStatusFilter');
      const sortSelect = document.getElementById('productSortFilter');

      if (catSelect) productSelectedCategory = catSelect.value;
      if (tagSelect) productSelectedTag = tagSelect.value;
      if (statusSelect) productSelectedStatus = statusSelect.value;
      if (sortSelect) productSortOrder = sortSelect.value;

      syncStatusPillsUI();
      applyProductFilters();
    }

    function onProductSearch(val) {
      productSearchQuery = (val || '').trim();
      applyProductFilters();
    }

    function updateProductStats() {
      const statTotal = document.getElementById('stat-total-products');
      const statCat = document.getElementById('stat-total-categories');
      const statTagged = document.getElementById('stat-tagged-products');
      const statAvg = document.getElementById('stat-avg-price');

      let normalTotalCount = 0;
      let activeCount = 0;
      let inactiveCount = 0;
      let inStockCount = 0;
      let outStockCount = 0;
      let pointRedeemCount = 0;
      let zeroPriceCount = 0;
      const categories = new Set();
      let taggedCount = 0;
      let totalPriceSum = 0;
      let validPriceCount = 0;

      allProducts.forEach(p => {
        const isPointRedeem = isPointRedemptionProduct(p);
        const priceVal = Number(p.price) || 0;
        if (isPointRedeem) {
          pointRedeemCount++;
          return;
        }
        normalTotalCount++;
        if (priceVal <= 0) {
          zeroPriceCount++;
        } else {
          totalPriceSum += priceVal;
          validPriceCount++;
        }

        const isInactive = (p.status && String(p.status).toLowerCase() === 'inactive');
        if (isInactive) {
          inactiveCount++;
        } else {
          activeCount++;
        }
        const rawStock = Number(p.stock !== undefined && p.stock !== null ? p.stock : 0);
        const stockQty = rawStock >= 1 ? Math.floor(rawStock) : 0;
        if (stockQty >= 1 && p.status !== 'out_of_stock') {
          inStockCount++;
        } else {
          outStockCount++;
        }
        if (p.category) categories.add(p.category);
        if (p.tag) taggedCount++;
      });

      if (statTotal) {
        statTotal.innerHTML = normalTotalCount.toLocaleString() + ' <span style="font-size: 11px; font-weight: 600; color: #10b981; display: block; margin-top: 3px;">🟢 เปิด ' + activeCount.toLocaleString() + ' | 🚫 ปิด ' + inactiveCount.toLocaleString() + (pointRedeemCount > 0 ? ' | 🎁 แลกแต้ม ' + pointRedeemCount : '') + '</span>';
      }
      if (statCat) statCat.textContent = categories.size.toLocaleString();
      if (statTagged) statTagged.textContent = taggedCount.toLocaleString();

      const statInStock = document.getElementById('stat-instock-products');
      if (statInStock) statInStock.textContent = inStockCount.toLocaleString();

      const statOutStock = document.getElementById('stat-outstock-products');
      if (statOutStock) statOutStock.textContent = outStockCount.toLocaleString();

      const bAll = document.getElementById('badge-status-all');
      if (bAll) bAll.textContent = normalTotalCount.toLocaleString();
      const bActive = document.getElementById('badge-status-active');
      if (bActive) bActive.textContent = activeCount.toLocaleString();
      const bInactive = document.getElementById('badge-status-inactive');
      if (bInactive) bInactive.textContent = inactiveCount.toLocaleString();
      const bInStock = document.getElementById('badge-status-instock');
      if (bInStock) bInStock.textContent = inStockCount.toLocaleString();
      const bOutStock = document.getElementById('badge-status-outstock');
      if (bOutStock) bOutStock.textContent = outStockCount.toLocaleString();
      const bPointRedeem = document.getElementById('badge-status-pointredeem');
      if (bPointRedeem) bPointRedeem.textContent = pointRedeemCount.toLocaleString();
      const bZeroPrice = document.getElementById('badge-status-zeroprice');
      if (bZeroPrice) bZeroPrice.textContent = zeroPriceCount.toLocaleString();

      const avg = validPriceCount > 0 ? Math.round(totalPriceSum / validPriceCount) : 0;
      if (statAvg) statAvg.textContent = '฿' + avg.toLocaleString();
    }

    // Toggle Product Status (เปิด/ปิดสินค้า ไม่ให้ลูกค้าเห็น)
    async function toggleProductStatus(productId, isChecked, event) {
      if (event) event.stopPropagation();
      const product = allProducts.find(p => String(p.id) === String(productId));
      if (!product) return;

      const newStatus = isChecked ? 'active' : 'inactive';
      product.status = newStatus;

      // 1. บันทึกลง LocalStorage Cache ทันที (0ms)
      try {
        LS.setItem('cached_admin_products', JSON.stringify(allProducts));
      } catch (e) { }

      // อัปเดต Cache ของลูกค้าในเครื่องด้วย (ถ้ามีการเปิดหน้าร้านบนบราวเซอร์เดียวกัน)
      try {
        const custRaw = LS.getItem('cached_products_v2');
        if (custRaw) {
          const custObj = JSON.parse(custRaw);
          if (Array.isArray(custObj.products)) {
            const cp = custObj.products.find(p => String(p.id) === String(productId));
            if (cp) {
              cp.status = newStatus;
              LS.setItem('cached_products_v2', JSON.stringify(custObj));
            }
          }
        }
      } catch (e) { }

      // 2. ปรับปรุงหน้าจอทันที (Optimistic UI)
      renderProductsList();
      updateProductStats();

      const statusMsg = isChecked ? 'เปิดแสดงสินค้าให้ลูกค้าเห็นแล้ว 🟢' : 'ปิดซ่อนสินค้าไม่ให้ลูกค้าเห็นแล้ว ⚪';
      showToast((product.name ? '"' + product.name.substring(0, 25) + '..."' : 'สินค้า') + ' : ' + statusMsg, isChecked ? 'success' : 'info');

      // อัปเดต Detail Modal ถ้าเปิดอยู่
      if (currentViewingProduct && String(currentViewingProduct.id) === String(productId)) {
        const cb = document.getElementById('detailProductStatusCheckbox');
        const badge = document.getElementById('detailProductStatusBadge');
        const hint = document.getElementById('detailProductStatusHint');
        if (cb) cb.checked = isChecked;
        if (badge) {
          badge.className = 'status-pill ' + (isChecked ? 'status-pill-active' : 'status-pill-inactive');
          badge.textContent = isChecked ? '🟢 เปิดแสดง' : '⚪ ปิดซ่อน';
        }
        if (hint) {
          hint.textContent = isChecked ? 'เปิดให้ลูกค้าเห็นและสั่งซื้อได้ตามปกติ' : 'สินค้านี้ถูกซ่อนอยู่ ลูกค้าจะไม่เห็นในหน้าร้าน';
        }
      }

      // 3. ส่งข้อมูลไปอัปเดตบน Cloudflare D1 Database
      try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'updateProductStatus',
            id: productId,
            status: newStatus
          })
        });
        const result = await res.json();
        if (result && result.status === 'success') {
          console.log('Product status saved to server:', result);
        }
      } catch (err) {
        console.error('Backend update error:', err);
      }
    }
    window.toggleProductStatus = toggleProductStatus;

    function toggleProductStatusFromModal(isChecked) {
      if (currentViewingProduct && currentViewingProduct.id) {
        toggleProductStatus(currentViewingProduct.id, isChecked);
      }
    }
    window.toggleProductStatusFromModal = toggleProductStatusFromModal;
    window.selectStatusPill = selectStatusPill;
    window.selectCategoryPill = selectCategoryPill;
    window.syncStatusPillsUI = syncStatusPillsUI;

    // ==========================================
    // PROMO CODES / COUPONS MANAGEMENT SYSTEM
    // ==========================================
    let allPromoCodes = [];
    let promoFilterStatus = 'all'; // 'all' | 'active' | 'inactive' | 'expired'
    let promoSearchQuery = '';

    async function fetchPromoCodes(showLoading = true) {
      const loading = document.getElementById('promosLoadingIndicator');
      if (showLoading && allPromoCodes.length === 0 && loading) {
        loading.style.display = 'flex';
      }

      // 1. โหลดจากแคชก่อนทันที (0ms)
      try {
        const cached = localStorage.getItem('cached_admin_promos');
        if (cached && allPromoCodes.length === 0) {
          allPromoCodes = JSON.parse(cached);
          renderPromoCodes();
          updatePromoStats();
        }
      } catch (e) {}

      try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getPromoCodes&_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === 'success' && Array.isArray(data.promos)) {
            allPromoCodes = data.promos;
            try {
              localStorage.setItem('cached_admin_promos', JSON.stringify(allPromoCodes));
            } catch (e) {}
            renderPromoCodes();
            updatePromoStats();
          }
        }
      } catch (err) {
        console.error('Fetch promo codes error:', err);
      } finally {
        if (loading) loading.style.display = 'none';
      }
    }
    window.fetchPromoCodes = fetchPromoCodes;

    function getPromoStatusInfo(p) {
      const today = new Date().toISOString().slice(0, 10);
      const isActive = Number(p.is_active) === 1;

      if (!isActive) {
        return { status: 'inactive', label: '⚪ ปิดใช้งาน', class: 'status-pill-inactive', canUse: false };
      }
      if (p.start_date && p.start_date.trim() !== '' && today < p.start_date.trim()) {
        return { status: 'scheduled', label: `⏳ รอเริ่ม (${p.start_date})`, class: 'status-pill-inactive', canUse: false };
      }
      if (p.end_date && p.end_date.trim() !== '' && today > p.end_date.trim()) {
        return { status: 'expired', label: '🔴 หมดอายุแล้ว', class: 'status-pill-inactive', canUse: false };
      }
      return { status: 'active', label: '🟢 เปิดใช้งานอยู่', class: 'status-pill-active', canUse: true };
    }

    function renderPromoCodes() {
      const tbody = document.getElementById('promosBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      let filtered = allPromoCodes.filter(p => {
        // กรองด้วย search query
        if (promoSearchQuery) {
          const q = promoSearchQuery.toLowerCase();
          const matchCode = String(p.code || '').toLowerCase().includes(q);
          const matchDesc = String(p.description || '').toLowerCase().includes(q);
          if (!matchCode && !matchDesc) return false;
        }

        // กรองด้วย status filter
        const info = getPromoStatusInfo(p);
        if (promoFilterStatus === 'active') {
          return info.status === 'active';
        } else if (promoFilterStatus === 'inactive') {
          return info.status === 'inactive';
        } else if (promoFilterStatus === 'expired') {
          return info.status === 'expired' || info.status === 'scheduled';
        }
        return true;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
              <div style="font-size: 36px; margin-bottom: 8px;">🎟️</div>
              <p style="font-weight: 600; color: var(--text-main);">ไม่พบโค้ดโปรโมชั่นที่ตรงกับเงื่อนไข</p>
              <p style="font-size: 13px; margin-top: 4px;">แตะปุ่ม "+ สร้างโค้ดส่วนลดใหม่" เพื่อเริ่มสร้างโปรโมชั่นแรกของร้านคุณ</p>
            </td>
          </tr>
        `;
        return;
      }

      filtered.forEach(p => {
        const tr = document.createElement('tr');
        const info = getPromoStatusInfo(p);
        const isActive = Number(p.is_active) === 1;

        // สิทธิประโยชน์
        let benefitHtml = '';
        if (p.type === 'percent') {
          const maxDiscVal = Number(p.max_discount || p.maxDiscount || 0);
          const maxDiscTxt = maxDiscVal > 0
            ? ` <span style="font-size: 11.5px; color: #92400e; font-weight: 700;">(ลดสูงสุด ฿${maxDiscVal.toLocaleString()})</span>`
            : ` <span style="font-size: 11px; color: #dc2626; font-weight: 600;">(ไม่จำกัดยอดลดสูงสุด)</span>`;
          benefitHtml = `<span style="font-weight: 700; color: #b45309; background: #fef3c7; padding: 2px 8px; border-radius: 6px; font-size: 13px;">✨ ลด ${p.percent}%</span>${maxDiscTxt}`;
        } else if (p.type === 'shipping') {
          benefitHtml = `<span style="font-weight: 700; color: #047857; background: #dcfce7; padding: 2px 8px; border-radius: 6px; font-size: 13px;">🚚 ฟรีค่าจัดส่ง</span>`;
        } else {
          benefitHtml = `<span style="font-weight: 700; color: #1d4ed8; background: #dbeafe; padding: 2px 8px; border-radius: 6px; font-size: 13px;">💰 ลด ฿${Number(p.amount || 0).toLocaleString()}</span>`;
        }

        // ยอดซื้อขั้นต่ำ
        const minSpendText = Number(p.min_spend || 0) > 0 ? `฿${Number(p.min_spend).toLocaleString()}` : '<span style="color:#64748b;">ไม่มีขั้นต่ำ</span>';

        // ระยะเวลาโปรโมชั่น
        let dateRangeHtml = '';
        if (p.start_date || p.end_date) {
          const s = p.start_date ? p.start_date : 'เริ่มทันที';
          const e = p.end_date ? p.end_date : 'ไม่มีกำหนด';
          dateRangeHtml = `<div style="font-size: 12.5px; color: #334155; font-weight: 600;">📅 ${s} ถึง ${e}</div>`;
        } else {
          dateRangeHtml = `<span style="font-size: 12px; color: #16a34a; font-weight: 600; background: #f0fdf4; padding: 2px 8px; border-radius: 6px;">✨ ใช้ได้ตลอด (ไม่มีหมดอายุ)</span>`;
        }

        tr.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-family: monospace; font-size: 15px; font-weight: 800; color: #1e293b; background: #f1f5f9; border: 1.5px dashed #94a3b8; padding: 4px 10px; border-radius: 8px; letter-spacing: 0.5px;">${p.code}</span>
              <button type="button" class="btn-copy-sku" onclick="copyPromoCode('${p.code}', event)" title="คัดลอกรหัสโค้ด" style="padding: 3px 6px;">📋</button>
            </div>
          </td>
          <td>
            <div>${benefitHtml}</div>
            <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">${p.description || '-'}</div>
          </td>
          <td><strong style="color: var(--text-main); font-size: 13.5px;">${minSpendText}</strong></td>
          <td>${dateRangeHtml}</td>
          <td style="text-align: center;">
            <div class="product-status-toggle-wrapper" onclick="event.stopPropagation()">
              <label class="switch-toggle" title="${isActive ? 'คลิกเพื่อปิดการใช้งานโค้ดนี้' : 'คลิกเพื่อเปิดใช้งานโค้ดนี้'}">
                <input type="checkbox" ${isActive ? 'checked' : ''} onchange="togglePromoCode('${p.code}', this.checked, event)">
                <span class="slider-round"></span>
              </label>
            </div>
          </td>
          <td style="text-align: center;">
            <span class="status-pill ${info.class}" style="font-size: 11.5px;">${info.label}</span>
          </td>
          <td style="text-align: right;">
            <div style="display: flex; justify-content: flex-end; gap: 6px;">
              <button class="btn-action" onclick="openPromoModal('${p.code}')" style="padding: 5px 10px; font-size: 12px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px;">✏️ แก้ไข</button>
              <button class="btn-action" onclick="deletePromoCode('${p.code}')" style="padding: 5px 10px; font-size: 12px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px;">🗑️ ลบ</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    function updatePromoStats() {
      const today = new Date().toISOString().slice(0, 10);
      let total = allPromoCodes.length;
      let active = 0;
      let inactive = 0;
      let expired = 0;

      allPromoCodes.forEach(p => {
        const info = getPromoStatusInfo(p);
        if (info.status === 'active') active++;
        else if (info.status === 'inactive') inactive++;
        else if (info.status === 'expired' || info.status === 'scheduled') expired++;
      });

      const elTotal = document.getElementById('statPromoTotal');
      const elActive = document.getElementById('statPromoActive');
      const elInactive = document.getElementById('statPromoInactive');
      const elExpired = document.getElementById('statPromoExpired');

      if (elTotal) elTotal.textContent = total;
      if (elActive) elActive.textContent = active;
      if (elInactive) elInactive.textContent = inactive;
      if (elExpired) elExpired.textContent = expired;

      const fAll = document.getElementById('promoFilterAllCount');
      const fActive = document.getElementById('promoFilterActiveCount');
      const fInactive = document.getElementById('promoFilterInactiveCount');
      const fExpired = document.getElementById('promoFilterExpiredCount');

      if (fAll) fAll.textContent = total;
      if (fActive) fActive.textContent = active;
      if (fInactive) fInactive.textContent = inactive;
      if (fExpired) fExpired.textContent = expired;
    }

    function setPromoFilter(status, btn) {
      promoFilterStatus = status;
      document.querySelectorAll('#btnPromoFilterAll, #btnPromoFilterActive, #btnPromoFilterInactive, #btnPromoFilterExpired').forEach(b => {
        b.classList.remove('active');
      });
      if (btn) btn.classList.add('active');
      renderPromoCodes();
    }
    window.setPromoFilter = setPromoFilter;

    function onPromoSearch(val) {
      promoSearchQuery = (val || '').trim();
      renderPromoCodes();
    }
    window.onPromoSearch = onPromoSearch;

    function copyPromoCode(code, e) {
      if (e) e.stopPropagation();
      navigator.clipboard.writeText(code).then(() => {
        showToast(`คัดลอกโค้ด "${code}" สำเร็จ! 📋`, 'success');
      }).catch(() => {
        showToast('ไม่สามารถคัดลอกได้', 'error');
      });
    }
    window.copyPromoCode = copyPromoCode;

    function openPromoModal(codeOrObj = null) {
      const modal = document.getElementById('promoModal');
      const modalTitle = document.getElementById('promoModalTitle');
      const inputCode = document.getElementById('promoInputCode');
      const inputType = document.getElementById('promoInputType');
      const inputValue = document.getElementById('promoInputValue');
      const inputMinSpend = document.getElementById('promoInputMinSpend');
      const inputMaxDiscount = document.getElementById('promoInputMaxDiscount');
      const inputDesc = document.getElementById('promoInputDesc');
      const noExpiryCheck = document.getElementById('promoNoExpiryCheck');
      const inputStartDate = document.getElementById('promoInputStartDate');
      const inputEndDate = document.getElementById('promoInputEndDate');
      const inputIsActive = document.getElementById('promoInputIsActive');
      const editModeInput = document.getElementById('promoEditMode');

      if (!modal) return;

      let promo = null;
      if (codeOrObj) {
        if (typeof codeOrObj === 'object') promo = codeOrObj;
        else promo = allPromoCodes.find(p => p.code === codeOrObj);
      }

      if (promo) {
        // Edit Mode
        if (modalTitle) modalTitle.textContent = `✏️ แก้ไขโค้ดส่วนลด "${promo.code}"`;
        if (editModeInput) editModeInput.value = 'edit';
        if (inputCode) {
          inputCode.value = promo.code;
          inputCode.readOnly = true;
          inputCode.style.background = '#f8fafc';
        }
        if (inputType) inputType.value = promo.type || 'fixed';
        if (inputValue) inputValue.value = promo.type === 'percent' ? (promo.percent || 0) : (promo.amount || 0);
        if (inputMinSpend) inputMinSpend.value = promo.min_spend || 0;
        if (inputMaxDiscount) inputMaxDiscount.value = promo.max_discount || promo.maxDiscount || 0;
        if (inputDesc) inputDesc.value = promo.description || '';

        const hasDates = !!(promo.start_date || promo.end_date);
        if (noExpiryCheck) noExpiryCheck.checked = !hasDates;
        togglePromoDateFields(hasDates);
        if (inputStartDate) inputStartDate.value = promo.start_date || '';
        if (inputEndDate) inputEndDate.value = promo.end_date || '';
        if (inputIsActive) inputIsActive.checked = Number(promo.is_active) === 1;
      } else {
        // Create Mode
        if (modalTitle) modalTitle.textContent = '🎟️ สร้างโค้ดส่วนลดใหม่';
        if (editModeInput) editModeInput.value = 'create';
        if (inputCode) {
          inputCode.value = '';
          inputCode.readOnly = false;
          inputCode.style.background = '#ffffff';
          setTimeout(() => inputCode.focus(), 150);
        }
        if (inputType) inputType.value = 'fixed';
        if (inputValue) inputValue.value = '50';
        if (inputMinSpend) inputMinSpend.value = '0';
        if (inputMaxDiscount) inputMaxDiscount.value = '100';
        if (inputDesc) inputDesc.value = '';
        if (noExpiryCheck) noExpiryCheck.checked = true;
        togglePromoDateFields(false);
        if (inputStartDate) inputStartDate.value = '';
        if (inputEndDate) inputEndDate.value = '';
        if (inputIsActive) inputIsActive.checked = true;
      }

      onPromoTypeChange(inputType ? inputType.value : 'fixed');
      modal.classList.add('active');
    }
    window.openPromoModal = openPromoModal;

    function closePromoModal() {
      const modal = document.getElementById('promoModal');
      if (modal) modal.classList.remove('active');
    }
    window.closePromoModal = closePromoModal;

    function togglePromoDateFields(show) {
      const container = document.getElementById('promoDateFieldsContainer');
      const hint = document.getElementById('promoDateHint');
      if (container) container.style.display = show ? 'grid' : 'none';
      if (hint) hint.style.display = show ? 'block' : 'none';
    }
    window.togglePromoDateFields = togglePromoDateFields;

    function onPromoTypeChange(type) {
      const valLabel = document.getElementById('promoValueLabel');
      const valInput = document.getElementById('promoInputValue');
      const maxDiscountWrapper = document.getElementById('promoMaxDiscountWrapper');
      if (!valLabel || !valInput) return;

      if (maxDiscountWrapper) {
        maxDiscountWrapper.style.display = (type === 'percent') ? 'block' : 'none';
      }

      if (type === 'shipping') {
        valLabel.textContent = 'ส่วนลดค่าจัดส่ง';
        valInput.value = '0';
        valInput.disabled = true;
        valInput.style.background = '#f1f5f9';
      } else if (type === 'percent') {
        valLabel.textContent = 'เปอร์เซ็นต์ส่วนลด (%) *';
        valInput.disabled = false;
        valInput.style.background = '#ffffff';
        valInput.max = '100';
        if (Number(valInput.value) > 100 || Number(valInput.value) === 0) valInput.value = '10';
      } else {
        valLabel.textContent = 'จำนวนส่วนลด (บาท) *';
        valInput.disabled = false;
        valInput.style.background = '#ffffff';
        valInput.removeAttribute('max');
        if (Number(valInput.value) === 0) valInput.value = '50';
      }
    }
    window.onPromoTypeChange = onPromoTypeChange;

    async function handleSavePromo(e) {
      if (e && e.preventDefault) e.preventDefault();
      const codeInput = document.getElementById('promoInputCode');
      const code = (codeInput ? codeInput.value : '').trim().toUpperCase();
      if (!code) {
        alert('กรุณาระบุรหัสโค้ดส่วนลด');
        return;
      }

      const type = document.getElementById('promoInputType')?.value || 'fixed';
      const rawVal = Number(document.getElementById('promoInputValue')?.value) || 0;
      const minSpend = Number(document.getElementById('promoInputMinSpend')?.value) || 0;
      const maxDiscount = type === 'percent' ? (Number(document.getElementById('promoInputMaxDiscount')?.value) || 0) : 0;
      const description = (document.getElementById('promoInputDesc')?.value || '').trim();
      const noExpiry = document.getElementById('promoNoExpiryCheck')?.checked;
      const startDate = noExpiry ? '' : (document.getElementById('promoInputStartDate')?.value || '');
      const endDate = noExpiry ? '' : (document.getElementById('promoInputEndDate')?.value || '');
      const isActive = document.getElementById('promoInputIsActive')?.checked ? 1 : 0;

      if (type === 'percent' && maxDiscount <= 0) {
        if (!confirm('⚠️ คุณยังไม่ได้กำหนด "ลดสูงสุดกี่บาท" สำหรับคูปองแบบเปอร์เซ็นต์ (ระบบจะลดตาม % โดยไม่มีเพดานจำกัด)\n\nต้องการบันทึกโดยไม่จำกัดเพดานส่วนลดหรือไม่?')) {
          document.getElementById('promoInputMaxDiscount')?.focus();
          return;
        }
      }

      const amount = type === 'fixed' ? rawVal : 0;
      const percent = type === 'percent' ? rawVal : 0;

      const promoObj = {
        code,
        type,
        amount,
        percent,
        min_spend: minSpend,
        max_discount: maxDiscount,
        description,
        start_date: startDate,
        end_date: endDate,
        is_active: isActive
      };

      // Optimistic update
      const existingIdx = allPromoCodes.findIndex(p => p.code === code);
      if (existingIdx >= 0) {
        allPromoCodes[existingIdx] = { ...allPromoCodes[existingIdx], ...promoObj };
      } else {
        allPromoCodes.unshift(promoObj);
      }

      try {
        localStorage.setItem('cached_admin_promos', JSON.stringify(allPromoCodes));
      } catch (err) {}

      renderPromoCodes();
      updatePromoStats();
      closePromoModal();
      showToast(`บันทึกโค้ดส่วนลด "${code}" เรียบร้อยแล้ว! 🎟️`, 'success');

      // Send to server
      try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'savePromoCode',
            code,
            type,
            amount,
            percent,
            minSpend,
            maxDiscount,
            description,
            startDate,
            endDate,
            isActive
          })
        });
        const result = await res.json();
        if (result && result.status === 'success') {
          console.log('Promo saved on server:', result);
        }
      } catch (err) {
        console.error('Server save error:', err);
      }
    }
    window.handleSavePromo = handleSavePromo;

    async function togglePromoCode(code, isChecked, event) {
      if (event) event.stopPropagation();
      const promo = allPromoCodes.find(p => p.code === code);
      if (!promo) return;

      promo.is_active = isChecked ? 1 : 0;
      try {
        localStorage.setItem('cached_admin_promos', JSON.stringify(allPromoCodes));
      } catch (e) {}

      renderPromoCodes();
      updatePromoStats();

      const msg = isChecked ? `เปิดใช้งานโค้ด "${code}" แล้ว 🟢` : `ปิดใช้งานโค้ด "${code}" แล้ว ⚪`;
      showToast(msg, isChecked ? 'success' : 'info');

      try {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'togglePromoCode',
            code,
            isActive: isChecked
          })
        });
      } catch (err) {
        console.error('Toggle promo error:', err);
      }
    }
    window.togglePromoCode = togglePromoCode;

    async function deletePromoCode(code) {
      if (!confirm(`คุณต้องการลบโค้ดส่วนลด "${code}" ใช่หรือไม่?`)) return;

      allPromoCodes = allPromoCodes.filter(p => p.code !== code);
      try {
        localStorage.setItem('cached_admin_promos', JSON.stringify(allPromoCodes));
      } catch (e) {}

      renderPromoCodes();
      updatePromoStats();
      showToast(`ลบโค้ดส่วนลด "${code}" เรียบร้อยแล้ว`, 'info');

      try {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'deletePromoCode',
            code
          })
        });
      } catch (err) {
        console.error('Delete promo error:', err);
      }
    }
    window.deletePromoCode = deletePromoCode;

    // ==========================================
    // POSPOS STOCK SYNC (Admin Action with Progress Modal)
    // ==========================================
    window._isPosposSyncing = false;

    function openPosposSyncModal() {
      const modal = document.getElementById('posposSyncModal');
      if (!modal) return;
      modal.classList.add('active');
      modal.style.display = 'flex';

      const loadingState = document.getElementById('posposSyncLoadingState');
      const resultState = document.getElementById('posposSyncResultState');
      const btnDone = document.getElementById('btnPosposSyncDone');
      const btnClose = document.getElementById('btnClosePosposSyncModal');

      if (loadingState) loadingState.style.display = 'block';
      if (resultState) resultState.style.display = 'none';
      if (btnDone) btnDone.style.display = 'none';
      if (btnClose) btnClose.style.display = 'none';
    }
    window.openPosposSyncModal = openPosposSyncModal;

    function closePosposSyncModal(shouldRefresh = false) {
      if (window._isPosposSyncing) return;
      const modal = document.getElementById('posposSyncModal');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      if (shouldRefresh && typeof fetchProducts === 'function') {
        fetchProducts(true);
      }
    }
    window.closePosposSyncModal = closePosposSyncModal;

    async function syncPosposFromAdmin() {
      const btn = document.getElementById('btnSyncPospos');
      const originalHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> กำลังซิงค์...';
      }

      window._isPosposSyncing = true;
      openPosposSyncModal();

      try {
        // เตรียมรายชื่อสินค้าในระบบ Mini App ปัจจุบันส่งไปเพื่อความแม่นยำ 100%
        let payload = null;
        if (Array.isArray(allProducts) && allProducts.length > 0) {
          payload = {
            productIds: allProducts.map(p => ({
              id: String(p.id || '').trim(),
              price: Number(p.price || 0),
              stock: Number(p.stock ?? 0),
              status: String(p.status || 'active')
            }))
          };
        }

        const fetchOptions = {
          method: payload ? 'POST' : 'GET',
          headers: payload ? { 'Content-Type': 'application/json' } : {},
          body: payload ? JSON.stringify(payload) : undefined
        };

        const res = await fetch(GOOGLE_SCRIPT_URL + '?action=syncPospos&_t=' + Date.now(), fetchOptions);
        const data = await res.json();

        if (data.status === 'success') {
          const totalInApp = Number(data.totalInApp || (allProducts ? allProducts.length : 0));
          const totalFromPospos = Number(data.totalFromPospos || 0);
          const updated = Number(data.updated || 0);
          const unchanged = Number(data.unchanged || (data.processed ? Math.max(0, data.processed - updated) : 0));
          const notFound = Number(data.notFound || Math.max(0, totalInApp - (updated + unchanged)));
          const failed = Number(data.failed || 0);

          const loadingState = document.getElementById('posposSyncLoadingState');
          const resultState = document.getElementById('posposSyncResultState');
          const btnDone = document.getElementById('btnPosposSyncDone');
          const btnClose = document.getElementById('btnClosePosposSyncModal');

          if (loadingState) loadingState.style.display = 'none';
          if (resultState) resultState.style.display = 'block';
          if (btnDone) btnDone.style.display = 'inline-block';
          if (btnClose) btnClose.style.display = 'block';

          // อัปเดตตัวเลขในการ์ดสรุป
          const elInApp = document.getElementById('syncStatInApp');
          const elPospos = document.getElementById('syncStatPospos');
          const elUpdated = document.getElementById('syncStatUpdated');
          const elUnchanged = document.getElementById('syncStatUnchanged');
          if (elInApp) elInApp.textContent = totalInApp.toLocaleString();
          if (elPospos) elPospos.textContent = totalFromPospos.toLocaleString();
          if (elUpdated) elUpdated.textContent = updated.toLocaleString();
          if (elUnchanged) elUnchanged.textContent = unchanged.toLocaleString();

          // อัปเดต Legend
          const legUpdated = document.getElementById('legendUpdated');
          const legUnchanged = document.getElementById('legendUnchanged');
          const legNotFound = document.getElementById('legendNotFound');
          const legFailed = document.getElementById('legendFailed');
          const legFailedWrap = document.getElementById('legendFailedWrap');
          if (legUpdated) legUpdated.textContent = updated.toLocaleString();
          if (legUnchanged) legUnchanged.textContent = unchanged.toLocaleString();
          if (legNotFound) legNotFound.textContent = notFound.toLocaleString();
          if (legFailed) legFailed.textContent = failed.toLocaleString();
          if (legFailedWrap) legFailedWrap.style.display = failed > 0 ? 'inline-flex' : 'none';

          // คำนวณความกว้างของหลอดความคืบหน้า (Progress Bar)
          const baseTotal = totalInApp > 0 ? totalInApp : (updated + unchanged + notFound);
          if (baseTotal > 0) {
            const pctUpdated = (updated / baseTotal) * 100;
            const pctUnchanged = (unchanged / baseTotal) * 100;
            const pctNotFound = (notFound / baseTotal) * 100;
            const pctFailed = (failed / baseTotal) * 100;

            const barUpdated = document.getElementById('barUpdated');
            const barUnchanged = document.getElementById('barUnchanged');
            const barNotFound = document.getElementById('barNotFound');
            const barFailed = document.getElementById('barFailed');

            if (barUpdated) barUpdated.style.width = pctUpdated.toFixed(1) + '%';
            if (barUnchanged) barUnchanged.style.width = pctUnchanged.toFixed(1) + '%';
            if (barNotFound) barNotFound.style.width = pctNotFound.toFixed(1) + '%';
            if (barFailed) barFailed.style.width = pctFailed.toFixed(1) + '%';
          }

          const badge = document.getElementById('posposProgressBadge');
          if (badge) {
            if (failed > 0) {
              badge.style.background = '#fee2e2';
              badge.style.color = '#dc2626';
              badge.textContent = '⚠️ มีรายการบันทึกไม่สำเร็จ ' + failed + ' รายการ';
            } else {
              badge.style.background = '#dcfce7';
              badge.style.color = '#15803d';
              badge.textContent = '✅ ตรวจสอบครบ 100% (' + (updated + unchanged).toLocaleString() + ' / ' + totalInApp.toLocaleString() + ' รายการ)';
            }
          }

          if (typeof showToast === 'function') {
            showToast('✅ ซิงค์สต็อก POSPOS สำเร็จเรียบร้อย!', 'success');
          }
        } else {
          alert('⚠️ การซิงค์ไม่สำเร็จ: ' + (data.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์'));
          closePosposSyncModal(false);
        }
      } catch (err) {
        alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับ POSPOS: ' + err.message);
        closePosposSyncModal(false);
      } finally {
        window._isPosposSyncing = false;
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      }
    }
    window.syncPosposFromAdmin = syncPosposFromAdmin;
