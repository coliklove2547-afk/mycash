// ============================================================
// BUDGET//CTRL — Personal Finance Tracker
// โครงสร้างไฟล์นี้แบ่งเป็นหมวดตามหน้า/ฟีเจอร์ของแอป เรียงจากบนลงล่าง:
//   1) ค่าคงที่ & สถานะเริ่มต้นของระบบ
//   2) บันทึก/โหลดข้อมูล (Storage)
//   3) ฟังก์ชันช่วยเหลือทั่วไป (Utilities)
//   4) นำทาง & เมนู (Navigation)
//   5) ตัวกรองกระเป๋าเงิน (ใช้ร่วมกันหลายหน้า)
//   6) หน้าแรก — เพิ่มรายการ (Home)
//   7) หน้าค้นหา (Search)
//   8) ป๊อปอัปแก้ไข/ลบรายการ (Edit Modal)
//   9) นำเข้า/ส่งออกข้อมูล (Import / Export)
//   10) หน้ากระเป๋าเงิน (Wallet)
//   11) หน้ายืมเงิน (Loan)
//   12) หน้าผ่อนชำระ (Installment)
//   13) หน้าหมวดหมู่ (Category)
//   14) หน้าลิสต์ทูเพย์ (Bills)
//   15) หน้าสรุป/แดชบอร์ด (Summary)
//   16) หน้าตั้งค่า & จัดการข้อมูล (Settings)
//   17) เริ่มต้นแอป (App Init)
// ============================================================

// ------------------------------------------------------------
// 1) ค่าคงที่ & สถานะเริ่มต้นของระบบ
// ------------------------------------------------------------
const STORAGE_KEY = 'budgetCtrl_LocalData';

// สถานะข้อมูลหลักของแอปทั้งหมดรวมไว้ในที่เดียว (แทนการกระจาย window.* /
// let หลายตัวทั่วไฟล์) เพื่อให้เห็นภาพรวมของ "อะไรคือสถานะที่เปลี่ยนได้"
// ในที่เดียว และลดความเสี่ยงที่ชื่อตัวแปรจะชนกับโค้ดอื่นบนหน้าเว็บ
//
// ฟังก์ชันทั้งหมดยังเป็น top-level `function` ตามเดิม (ไม่ใช้ module)
// เพราะ index.html เรียกใช้งานผ่าน onclick="..." ซึ่งต้องหาฟังก์ชันจาก
// window ได้ — เปลี่ยนแค่ "ข้อมูล" ให้เข้าที่เดียว ไม่เปลี่ยนฟังก์ชัน
const App = {
  state: {
    items: [],          // รายการรายรับ/รายจ่ายทั้งหมด
    wallets: [],         // กระเป๋าเงิน/บัญชีทั้งหมด
    installments: [],    // รายการผ่อนชำระทั้งหมด
    categories: {},       // หมวดหมู่ แยกตาม income/expense
    bills: [],            // รายการในหน้าลิสต์ทูเพย์ (รายรับ/รายจ่ายที่ยังไม่เกิดขึ้นจริง)

    walletFilter: 'all',        // ตัวกรองกระเป๋าเงินของหน้าแรก
    walletFilterSearch: 'all',  // ตัวกรองกระเป๋าเงินของหน้าค้นหา
    editTargetId: null,         // id ของรายการที่กำลังแก้ไขอยู่ (ถ้ามี)

    filter: 'all',              // ตัวกรองประเภทรายการของหน้าแรก
    filterSearch: 'all',        // ตัวกรองประเภทรายการของหน้าค้นหา
    currentMode: 'income',      // โหมดรายรับ/รายจ่าย ที่เลือกอยู่ในฟอร์มหน้าแรก
    currentBillMode: 'expense', // โหมดรายรับ/รายจ่าย ที่เลือกอยู่ในฟอร์มหน้าลิสต์ทูเพย์
    chartBarType: 'expense',    // ประเภทข้อมูลที่แสดงในกราฟแท่ง (หน้าสรุป)
    chartDonutType: 'expense',  // ประเภทข้อมูลที่แสดงในกราฟโดนัท (หน้าสรุป)
    confirmResolver: null,      // ตัวรับผลลัพธ์ของป๊อปอัปยืนยัน (resolve ของ Promise)
    loanDisplayMode: 'person',  // มุมมองหน้ายืมเงิน: แยกตามคน/แสดงเป็นลิสต์
    instTab: 'phone',           // แท็บที่เลือกอยู่ในหน้าผ่อนชำระ
    catTab: 'income',           // แท็บที่เลือกอยู่ในหน้าหมวดหมู่
    searchDebounceTimer: null   // ตัวจับเวลา debounce ของช่องค้นหา
  }
};

// ชุดสีที่ใช้วาดกราฟแท่ง/โดนัทในหน้าสรุป
const COLORS_EXP = ['#ff4f64', '#ff8c5a', '#ffb347', '#ffd700', '#c8a84b', '#e07b9a', '#ff6b8a', '#ffaa44', '#e6861a', '#d4604a'];
const COLORS_INC = ['#39d98a', '#4f9bff', '#a78bfa', '#34d399', '#60a5fa', '#818cf8', '#2dd4bf', '#38bdf8', '#c084fc', '#86efac'];

// ข้อมูลเริ่มต้น ใช้ตอนเปิดแอปครั้งแรกหรือข้อมูลเสีย
const DEFAULT_DATA = {
  items: [],
  wallets: [
    { id: 1, name: 'Cash', init: 0 },
    { id: 2, name: 'Bangkok Bank', init: 0 }
  ],
  installments: [],
  categories: {
    income: ['เงินเดือน', 'ยืม', 'โอน', 'อื่นๆ'],
    expense: ['อาหาร', 'เดินทาง', 'ค่าเช่า', 'บันเทิง', 'ค่าน้ำไฟ', 'อินเทอร์เน็ต', 'ผ่อนมือถือ', 'ผ่อนสินเชื่อ', 'คืน', 'โอน', 'อื่นๆ']
  },
  bills: []
};

// วันนี้ตามเวลาเครื่อง (ปรับ timezone offset แล้ว) — ใช้เป็นค่าเริ่มต้นของวันที่ทั่วทั้งแอป
const tzoffset = (new Date()).getTimezoneOffset() * 60000;
const today = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];

// ------------------------------------------------------------
// 2) บันทึก/โหลดข้อมูล (Storage)
// ------------------------------------------------------------
/**
 * บันทึกข้อมูลทั้งหมดลง localStorage ของเบราว์เซอร์
 * @returns {boolean} true ถ้าบันทึกสำเร็จ, false ถ้าเกิดข้อผิดพลาด
 *   (เช่น localStorage เต็ม หรือถูกปิดใช้งานโดยเบราว์เซอร์)
 */
function saveLocalStorage() {
  const data = {
    items: App.state.items || [],
    wallets: App.state.wallets || [],
    installments: App.state.installments || [],
    categories: App.state.categories || {},
    bills: App.state.bills || []
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('saveLocalStorage failed:', e);
    showToast('บันทึกข้อมูลไม่สำเร็จ (พื้นที่จัดเก็บอาจเต็ม)');
    return false;
  }
}

/**
 * โหลดข้อมูลจาก localStorage ตอนเปิดแอป (ถ้าไม่มีให้ใช้ค่าเริ่มต้น)
 */
function loadLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      App.state.items = data.items || [];
      App.state.wallets = data.wallets || DEFAULT_DATA.wallets;
      App.state.installments = data.installments || [];
      App.state.categories = data.categories || DEFAULT_DATA.categories;
      App.state.bills = data.bills || [];

      // ถ้าเคยมีข้อมูล "รายการคาดว่าจะจ่าย" แบบเก่า ให้แปลงมาเป็นบิลใหม่อัตโนมัติ (ไม่ทำให้ข้อมูลหาย)
      let migrated = false;
      if (!data.bills && Array.isArray(data.upcoming) && data.upcoming.length) {
        App.state.bills = data.upcoming.map(u => ({
          id: u.id,
          name: u.name,
          amount: u.amount,
          type: 'expense',
          dueDate: today,
          status: 'unpaid',
          repeatMonthly: false,
          category: u.category || 'อื่นๆ',
          walletId: App.state.wallets[0]?.id || 1
        }));
        migrated = true;
      }
      if (App.state.categories.income && !App.state.categories.income.includes('โอน')) {
        App.state.categories.income.push('โอน');
        migrated = true;
      }
      if (App.state.categories.expense && !App.state.categories.expense.includes('โอน')) {
        App.state.categories.expense.push('โอน');
        migrated = true;
      }
      if (migrated) saveLocalStorage();
    } catch (e) {
      loadDefault();
    }
  } else {
    loadDefault();
  }
}

/**
 * ตั้งค่าข้อมูลเริ่มต้น (ใช้ตอนยังไม่เคยมีข้อมูล หรือข้อมูลเสีย)
 */
function loadDefault() {
  App.state.items = [...DEFAULT_DATA.items];
  App.state.wallets = [...DEFAULT_DATA.wallets];
  App.state.installments = [...DEFAULT_DATA.installments];
  App.state.categories = {
    income: [...DEFAULT_DATA.categories.income],
    expense: [...DEFAULT_DATA.categories.expense]
  };
  App.state.bills = [...DEFAULT_DATA.bills];
  saveLocalStorage();
}

/**
 * ------------------------------------------------------------
 * 3) ฟังก์ชันช่วยเหลือทั่วไป (Utilities)
 * ------------------------------------------------------------
 * แปลงอักขระพิเศษกันโค้ด HTML หลุด (ป้องกัน XSS)
 * @param {*} str
 */
function escapeHtml(str) {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

/**
 * แสดงข้อความแจ้งเตือนเล็กๆ ที่มุมจอ (toast)
 * @param {*} msg
 */
function showToast(msg) {
  const t = document.getElementById('toast');
  if (t) { t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }
}

/**
 * เปิดป๊อปอัปถามยืนยันก่อนทำรายการสำคัญ (ลบ/แก้ไข)
 * @param {*} message
 * @param {*} isDanger
 */
function showConfirmModal(message, isDanger = true) {
  return new Promise((resolve) => {
    const bg = document.getElementById('confirmModalBg');
    const title = document.getElementById('confirmTitle');
    const msg = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmYesBtn');

    msg.innerText = message;
    if (isDanger) {
      title.style.color = 'var(--red)';
      yesBtn.style.borderColor = 'var(--red) !important';
      yesBtn.style.color = 'var(--red)';
      title.innerText = '⚠️ ยืนยันการลบ';
    } else {
      title.style.color = 'var(--gold)';
      yesBtn.style.borderColor = 'var(--gold-dim) !important';
      yesBtn.style.color = 'var(--gold)';
      title.innerText = '⚠ ยืนยันการดำเนินการ';
    }
    bg.classList.add('open');
    App.state.confirmResolver = resolve;
  });
}

/**
 * เติมตัวเลือกหมวดหมู่ลงใน dropdown ตามประเภทรายรับ/รายจ่าย
 * @param {*} type
 * @param {*} selectId
 * @param {*} cur
 */
function updateCategoryDropdown(type, selectId, cur = '') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cats = App.state.categories[type] || [];
  sel.innerHTML = cats.map(c =>
    `<option value="${escapeHtml(c)}" ${c === cur ? 'selected' : ''}>${escapeHtml(c)}</option>`
  ).join('');
}

/**
 * คำนวณยอดเงินคงเหลือของกระเป๋าเงินใบหนึ่ง
 * @param {*} walletId
 */
function getWalletBalance(walletId) {
  const items = App.state.items || [];
  const inc = items.filter(i => i.type === 'income' && i.walletId === walletId).reduce((s, i) => s + i.amount, 0);
  const exp = items.filter(i => i.type === 'expense' && i.walletId === walletId).reduce((s, i) => s + i.amount, 0);
  const w = App.state.wallets.find(w => w.id === walletId);
  const init = w ? (w.init || 0) : 0;
  return init + inc - exp;
}

/**
 * แปลงวันที่ (yyyy-mm-dd) ให้เป็นรูปแบบ "Fri 24 Jul 2026"
 * @param {*} dateStr
 */
function formatBillDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * แสดงวันที่ปัจจุบันบนหัวแอป
 */
function displayCurrentDate() {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const el = document.getElementById('CurrentDate');
  if (el) el.textContent = ` ${formattedDate}`;
}

/**
 * ------------------------------------------------------------
 * 4) นำทาง & เมนู (Navigation)
 * ------------------------------------------------------------
 * สลับการแสดงผลไปยังหน้าที่เลือก (หัวใจของระบบนำทาง)
 * @param {*} id
 * @param {*} el
 */
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(id);
  if (pageEl) pageEl.classList.add('active');
  if (el) {
    el.classList.add('active');
    if (el.classList.contains('sidebar-btn')) {
      el.classList.add('active');
    }
  }

  switch(id) {
    case 'page-summary':
      initMonthSelect();
      render();
      break;
    case 'page-category':
      renderCatList();
      render();
      break;
    case 'page-loan':
      renderLoan();
      break;
    case 'page-install':
      renderInstallment();
      break;
    case 'page-wallet':
      renderWalletPage();
      break;
    case 'page-budget':
      renderBillsPage();
      break;
    case 'page-search':
      const inp = document.getElementById('searchInputPage');
      if (inp) setTimeout(() => inp.focus(), 100);
      renderSearchList();
      renderWalletFilterBar('walletFilterBarSearch', 'walletFilterSearch');
      break;
    case 'page-home':
      renderWalletFilterBar('walletFilterBar', 'walletFilter');
      break;
    case 'page-settings':
      renderSettingsPage();
      break;
  }

  update();
  closeMenu();
}

/**
 * เปิด/ปิดเมนู sidebar
 */
function toggleMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const btn = document.querySelector('.hamburger-btn');
  const isOpen = sidebar.classList.contains('open');

  if (isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    btn.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
  }
}

/**
 * ปิดเมนู sidebar
 */
function closeMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const btn = document.querySelector('.hamburger-btn');
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  btn.classList.remove('active');
  btn.setAttribute('aria-expanded', 'false');
}

/**
 * ------------------------------------------------------------
 * 5) ตัวกรองกระเป๋าเงิน (ใช้ร่วมกันหลายหน้า)
 * ------------------------------------------------------------
 * เติมรายชื่อกระเป๋าเงินลงใน dropdown ทุกจุดที่ใช้
 */
function updateWalletDropdowns() {
  const wallets = App.state.wallets || [];
  const opts = wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
  ['walletSelect', 'transferFrom', 'transferTo', 'instPayWallet', 'editWallet'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  const tTo = document.getElementById('transferTo');
  if (tTo && wallets.length > 1) tTo.value = wallets[1]?.id || wallets[0]?.id || '';
}

/**
 * วาดแถบตัวกรองกระเป๋าเงิน (ใช้ซ้ำได้หลายหน้า)
 * @param {*} targetId
 * @param {*} filterVar
 */
function renderWalletFilterBar(targetId = 'walletFilterBar', filterVar = 'walletFilter') {
  const bar = document.getElementById(targetId);
  if (!bar) return;
  const wallets = App.state.wallets || [];
  const currentFilter = App.state[filterVar] || 'all';
  const allActive = currentFilter === 'all';
  let html = `<button class="wallet-chip ${allActive ? 'active' : ''}" onclick="setWalletFilter('all','${targetId}','${filterVar}',this)">ทั้งหมด</button>`;
  wallets.forEach(w => {
    const active = currentFilter === w.id;
    html += `<button class="wallet-chip ${active ? 'active' : ''}" onclick="setWalletFilter(${w.id},'${targetId}','${filterVar}',this)">${escapeHtml(w.name)}</button>`;
  });
  bar.innerHTML = html;
}

/**
 * รีเฟรชแถบตัวกรองกระเป๋าเงินทั้งของหน้าแรกและหน้าค้นหาพร้อมกัน
 * เรียกใช้แทนการเขียน renderWalletFilterBar() สองบรรทัดซ้ำ ๆ ทุกจุด
 * ที่มีการเพิ่ม/ลบ/แก้ไขกระเป๋าเงินหรือรายการ
 */
function refreshWalletFilterBars() {
  renderWalletFilterBar('walletFilterBar', 'walletFilter');
  renderWalletFilterBar('walletFilterBarSearch', 'walletFilterSearch');
}

/**
 * ตั้งค่ากระเป๋าเงินที่ใช้กรองรายการ
 * @param {*} id
 * @param {*} targetId
 * @param {*} filterVar
 * @param {*} el
 */
function setWalletFilter(id, targetId, filterVar, el) {
  App.state[filterVar] = (id === 'all') ? 'all' : parseInt(id);
  const bar = document.getElementById(targetId);
  if (bar) {
    bar.querySelectorAll('.wallet-chip').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
  }
  if (targetId === 'walletFilterBar') {
    renderList();
  } else if (targetId === 'walletFilterBarSearch') {
    renderSearchList();
  }
}

/**
 * ------------------------------------------------------------
 * 6) หน้าแรก — เพิ่มรายการ (Home)
 * ------------------------------------------------------------
 * สลับโหมดรายรับ/รายจ่ายในฟอร์มหน้าแรก
 * @param {*} mode
 * @param {*} el
 */
function setMode(mode, el) {
  App.state.currentMode = mode;
  const scope = document.querySelectorAll('#homeModeToggle .mode-btn');
  scope.forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');

  scope.forEach(btn => {
    const isIncome = btn.dataset.mode === 'income';
    const isActive = btn.classList.contains('active');
    btn.textContent = isIncome
      ? (isActive ? '● รายรับ' : '○ รายรับ')
      : (isActive ? '● รายจ่าย' : '○ รายจ่าย');
  });

  updateCategoryDropdown(mode, 'categorySelect');
}

/**
 * เปิด/ปิดช่องกรอกหมายเหตุในฟอร์มเพิ่มรายการ
 */
function toggleNoteInput() {
  const input = document.getElementById('noteInput');
  const btn = document.getElementById('noteToggleBtn');
  if (!input || !btn) return;
  if (input.style.display === 'none' || !input.style.display) {
    input.style.display = 'block';
    btn.textContent = '✖';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = '';
    btn.textContent = '📝 หมายเหตุ';
  }
}

/**
 * เพิ่มรายการรายรับ/รายจ่ายใหม่ (จากฟอร์มหน้าแรก)
 */
function addItem() {
  const name = document.getElementById('nameInput').value.trim();
  const amount = parseFloat(document.getElementById('amountInput').value);
  const type = App.state.currentMode;
  const date = document.getElementById('dateInput').value || today;
  const note = document.getElementById('noteInput').value.trim();
  const category = document.getElementById('categorySelect').value;
  const walletId = parseInt(document.getElementById('walletSelect').value) || (App.state.wallets[0]?.id || 1);

  if (!name || isNaN(amount) || amount <= 0) return showToast('กรุณากรอกข้อมูลให้ครบ');

  App.state.items.push({ id: Date.now(), name, amount, type, date, note, category, walletId });
  saveLocalStorage();

  document.getElementById('nameInput').value = '';
  document.getElementById('amountInput').value = '';
  const noteInp = document.getElementById('noteInput');
  if (noteInp) { noteInp.value = ''; noteInp.style.display = 'none'; }
  const noteBtn = document.getElementById('noteToggleBtn');
  if (noteBtn) noteBtn.textContent = 'หมายเหตุ';

  renderList();
  update();
  renderWalletPage();
  refreshWalletFilterBars();
  showToast('บันทึกรายการแล้ว');
}

/**
 * ลบรายการรายรับ/รายจ่าย (ต้องกดยืนยันก่อน)
 * @param {*} id
 */
async function deleteItem(id) {
  if (await showConfirmModal('คุณแน่ใจว่าต้องการลบรายการนี้?')) {
    App.state.items = App.state.items.filter(i => i.id !== id);
    saveLocalStorage();
    renderList();
    renderSearchList();
    update();
    renderWalletPage();
    refreshWalletFilterBars();
    showToast('ลบแล้ว');
  }
}

/**
 * ตั้งค่าตัวกรองประเภทรายการในหน้าค้นหา
 * @param {*} val
 * @param {*} el
 */
function setFilter(val, el) {
  const isSearchPage = document.getElementById('page-search')?.classList.contains('active');
  if (isSearchPage) {
    App.state.filterSearch = val;
    document.querySelectorAll('#page-search .filter-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    renderSearchList();
  } else {
    App.state.filter = val;
    document.querySelectorAll('#page-home .filter-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    renderList();
  }
}

/**
 * วาดลิสต์รายการในหน้าแรก
 */
function renderList() {
  const items = App.state.items || [];
  let filtered = items.filter(i => {
    const matchFilter = App.state.filter === 'all' || i.type === App.state.filter;
    const matchWallet = App.state.walletFilter === 'all' || i.walletId === App.state.walletFilter;
    return matchFilter && matchWallet;
  });

  filtered = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const header = document.getElementById('listHeader');
  if (header) header.innerText = `รายการทั้งหมด (${filtered.length})`;

  const c = document.getElementById('list');
  if (!c) return;
  if (!filtered.length) { c.innerHTML = '<div class="empty">— ไม่พบรายการ —</div>'; return; }
  const wallets = App.state.wallets || [];

  c.innerHTML = filtered.map(i => `
    <div class="item ${i.type}">
      <div class="item-left" onclick="openEdit(${i.id})" style="cursor:pointer;flex:1">
        <div class="name">${escapeHtml(i.name)}${i.note ? `<span class="note-chip">${escapeHtml(i.note)}</span>` : ''}</div>
        <div class="meta">${escapeHtml(i.date)} · ${escapeHtml(i.category || '')} · ${escapeHtml(wallets.find(w => w.id === i.walletId)?.name || '')}</div>
      </div>
      <div class="item-right">
        <div class="amount">${i.type === 'income' ? '+' : '-'}${i.amount.toLocaleString()}</div>
        <button class="btn-del" onclick="deleteItem(${i.id})">✕</button>
      </div>
    </div>`).join('');
}

/**
 * อัปเดตยอดสรุป (รายรับ/รายจ่าย/คงเหลือ) ด้านบนของแอป
 */
function update() {
  const items = App.state.items || [];
  let inc = 0, exp = 0;
  items.forEach(i => { if (i.type === 'income') inc += i.amount; else exp += i.amount; });
  const incEl = document.getElementById('totalIncome');
  const expEl = document.getElementById('totalExpense');
  const balEl = document.getElementById('balance');
  if (incEl) incEl.innerText = inc.toLocaleString();
  if (expEl) expEl.innerText = exp.toLocaleString();
  if (balEl) balEl.innerText = (inc - exp).toLocaleString();
}

/**
 * ------------------------------------------------------------
 * 7) หน้าค้นหา (Search)
 * ------------------------------------------------------------
 * วาดลิสต์ผลลัพธ์ในหน้าค้นหา
 */
function renderSearchList() {
  const search = document.getElementById('searchInputPage')?.value.toLowerCase().trim() || '';
  const items = App.state.items || [];
  let filtered = items.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search) || (i.note || '').toLowerCase().includes(search) || (i.category || '').toLowerCase().includes(search);
    const matchFilter = App.state.filterSearch === 'all' || i.type === App.state.filterSearch;
    const matchWallet = App.state.walletFilterSearch === 'all' || i.walletId === App.state.walletFilterSearch;
    return matchSearch && matchFilter && matchWallet;
  });

  filtered = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const container = document.getElementById('searchList');
  const header = document.getElementById('searchListHeader');
  if (!container) return;

  const label = search ? `ผลลัพธ์ (${filtered.length} รายการ)` : `รายการทั้งหมด (${filtered.length})`;
  if (header) header.innerText = label;

  if (!filtered.length) {
    container.innerHTML = '<div class="empty">— ไม่พบรายการ —</div>';
    return;
  }

  const wallets = App.state.wallets || [];
  container.innerHTML = filtered.map(i => `
    <div class="item ${i.type}">
      <div class="item-left" onclick="openEdit(${i.id})" style="cursor:pointer;flex:1">
        <div class="name">${escapeHtml(i.name)}${i.note ? `<span class="note-chip">${escapeHtml(i.note)}</span>` : ''}</div>
        <div class="meta">${escapeHtml(i.date)} · ${escapeHtml(i.category || '')} · ${escapeHtml(wallets.find(w => w.id === i.walletId)?.name || '')}</div>
      </div>
      <div class="item-right">
        <div class="amount">${i.type === 'income' ? '+' : '-'}${i.amount.toLocaleString()}</div>
        <button class="btn-del" onclick="deleteItem(${i.id})">✕</button>
      </div>
    </div>
  `).join('');
}

/**
 * ------------------------------------------------------------
 * 8) ป๊อปอัปแก้ไข/ลบรายการ (Edit Modal — ใช้ร่วมกันหน้าแรก/ค้นหา)
 * ------------------------------------------------------------
 * เปิดป๊อปอัปแก้ไขรายการที่เลือก
 * @param {*} id
 */
function openEdit(id) {
  const item = App.state.items.find(i => i.id === id);
  if (!item) return;
  App.state.editTargetId = id;
  document.getElementById('editId').value = id;
  document.getElementById('editDate').value = item.date;
  document.getElementById('editName').value = item.name;
  document.getElementById('editNote').value = item.note || '';
  document.getElementById('editAmount').value = item.amount;
  document.getElementById('editType').value = item.type;

  updateWalletDropdowns();
  updateCategoryDropdown(item.type, 'editCategory', item.category);

  const editWalletSel = document.getElementById('editWallet');
  if (editWalletSel) editWalletSel.value = item.walletId;
  document.getElementById('modalBg').classList.add('open');
}

/**
 * ปิดป๊อปอัปแก้ไขรายการ
 */
function closeModal() { document.getElementById('modalBg').classList.remove('open'); }

/**
 * บันทึกการแก้ไขรายการ
 */
function saveEdit() {
  const id = parseFloat(document.getElementById('editId').value);
  const idx = App.state.items.findIndex(i => i.id === id);
  if (idx === -1) return;
  const amount = parseFloat(document.getElementById('editAmount').value);
  const name = document.getElementById('editName').value.trim();
  if (!name || isNaN(amount) || amount <= 0) return showToast('ข้อมูลไม่ถูกต้อง');

  const walletId = parseInt(document.getElementById('editWallet').value) || App.state.items[idx].walletId;
  App.state.items[idx] = {
    ...App.state.items[idx],
    date: document.getElementById('editDate').value,
    name,
    note: document.getElementById('editNote').value.trim(),
    amount,
    type: document.getElementById('editType').value,
    category: document.getElementById('editCategory').value,
    walletId
  };
  saveLocalStorage();
  closeModal();
  renderList();
  renderSearchList();
  update();
  renderWalletPage();
  refreshWalletFilterBars();
  showToast('บันทึกแล้ว');
}

/**
 * ------------------------------------------------------------
 * 9) นำเข้า/ส่งออกข้อมูล (Import / Export)
 * ------------------------------------------------------------
 * ส่งออกข้อมูลทั้งหมดเป็นไฟล์ CSV
 */
function downloadCSV() {
  if (!App.state.items.length) return showToast('ไม่มีข้อมูล');

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  const header = 'วันที่,รายการ,จำนวนเงิน,หมวดหมู่,ประเภท,หมายเหตุ';
  const rows = App.state.items.map(i => {
    const date = formatDate(i.date);
    const name = `"${i.name.replace(/"/g, '""')}"`;
    const amount = i.amount;
    const category = `"${(i.category || '').replace(/"/g, '""')}"`;
    const type = i.type === 'income' ? 'รายรับ' : 'รายจ่าย';
    const note = `"${(i.note || '').replace(/"/g, '""')}"`;
    return `${date},${name},${amount},${category},${type},${note}`;
  });

  const csv = '\uFEFF' + header + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `budget_${today}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('ดาวน์โหลด CSV สำเร็จ');
}

/**
 * ส่งออกข้อมูลทั้งหมดเป็นไฟล์ XLSX (ใช้ไลบรารี SheetJS)
 */
function downloadXLSX() {
  if (!App.state.items || App.state.items.length === 0) {
    showToast('ไม่มีข้อมูลที่จะส่งออก');
    return;
  }

  try {
    const rows = App.state.items.map(item => {
      const wallet = App.state.wallets.find(w => w.id === item.walletId);
      return {
        'วันที่': item.date || '',
        'รายการ': item.name || '',
        'จำนวน': item.amount || 0,
        'หมวดหมู่': item.category || '',
        'ประเภท': item.type === 'income' ? 'รายรับ' : 'รายจ่าย',
        'หมายเหตุ': item.note || '',
        'บัญชี': wallet ? wallet.name : ''
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Budget');
    XLSX.writeFile(wb, `budget_${today}.xlsx`);
    showToast('ดาวน์โหลด XLSX สำเร็จ');
  } catch (e) {
    console.error(e);
    showToast('เกิดข้อผิดพลาดในการส่งออก');
  }
}

/**
 * นำเข้าข้อมูลจากไฟล์ XLSX
 * @param {*} event
 */
function importXLSX(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      if (!json.length) {
        showToast('ไฟล์ไม่มีข้อมูล');
        return;
      }

      let added = 0;
      json.forEach(row => {
        const name = (row['รายการ'] || '').trim();
        const amount = parseFloat(row['จำนวน']) || 0;
        if (!name || amount <= 0) return;

        const type = row['ประเภท'] === 'รายรับ' ? 'income' : 'expense';
        const category = row['หมวดหมู่'] || 'อื่นๆ';
        const note = row['หมายเหตุ'] || '';
        let date = today;
        if (row['วันที่']) {
          const d = String(row['วันที่']).split('-');
          if (d.length === 3) {
            date = `${d[0]}-${d[1].padStart(2, '0')}-${d[2].padStart(2, '0')}`;
          }
        }
        const walletName = row['บัญชี'] || '';
        let walletId = App.state.wallets.find(w => w.name === walletName)?.id || App.state.wallets[0]?.id || 1;

        App.state.items.push({
          id: Date.now() + Math.random() * 1000,
          name,
          amount,
          type,
          date,
          note,
          category,
          walletId
        });
        added++;
      });

      saveLocalStorage();
      renderList();
      renderSearchList();
      update();
      renderWalletPage();
      refreshWalletFilterBars();
      showToast(`นำเข้า ${added} รายการสำเร็จ`);
    } catch (e) {
      console.error(e);
      showToast('นำเข้าไม่สำเร็จ');
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

/**
 * รวมข้อมูลทั้งหมดเป็น JSON สำหรับส่งออก/แชร์
 */
function exportForChat() {
  const payload = {
    source: 'budgetCtrl',
    exportedAt: new Date().toISOString(),
    items: App.state.items || [],
    wallets: App.state.wallets || [],
    installments: App.state.installments || [],
    categories: App.state.categories || {},
    bills: App.state.bills || []
  };
  const json = JSON.stringify(payload);

  const doCopy = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(json);
    }
    const ta = document.createElement('textarea');
    ta.value = json;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  };

  doCopy().then(() => {
    showToast('คัดลอกข้อมูลแล้ว ไปวางใน OPS//CHAT ได้เลย');
  }).catch(() => {
    showExportFallback(json);
  });
}

/**
 * แสดงข้อมูลสำรองถ้าส่งออกไฟล์แบบปกติไม่ได้
 * @param {*} json
 */
function showExportFallback(json) {
  let bg = document.getElementById('exportFallbackBg');
  if (!bg) {
    bg = document.createElement('div');
    bg.id = 'exportFallbackBg';
    bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px;';
    bg.innerHTML = `
      <div style="background:#0d1018;border:1px solid var(--gold-dim);border-radius:12px;padding:16px;max-width:360px;width:100%;">
        <div style="color:var(--gold);font-size:13px;margin-bottom:8px;">คัดลอกข้อความนี้ไปวางใน OPS//CHAT</div>
        <textarea id="exportFallbackText" readonly style="width:100%;height:120px;background:#000;color:#ccc;border:1px solid var(--gold-dim);border-radius:8px;padding:8px;font-size:10px;"></textarea>
        <button onclick="document.getElementById('exportFallbackBg').remove()" style="margin-top:10px;width:100%;padding:8px;background:var(--gold-dim);color:#fff;border:none;border-radius:8px;">ปิด</button>
      </div>`;
    document.body.appendChild(bg);
  }
  document.getElementById('exportFallbackText').value = json;
  document.getElementById('exportFallbackText').select();
}

/**
 * ------------------------------------------------------------
 * 10) หน้ากระเป๋าเงิน (Wallet)
 * ------------------------------------------------------------
 * เพิ่มกระเป๋าเงิน/บัญชีใหม่
 */
function addWallet() {
  const name = document.getElementById('walletNameInput').value.trim();
  const init = parseFloat(document.getElementById('walletInitInput').value) || 0;
  if (!name) return showToast('กรุณากรอกชื่อบัญชี');
  if (App.state.wallets.find(w => w.name === name)) return showToast('มีบัญชีนี้แล้ว');
  const id = Date.now();
  App.state.wallets.push({ id, name, init });
  saveLocalStorage();
  document.getElementById('walletNameInput').value = '';
  document.getElementById('walletInitInput').value = 0;
  renderWalletPage();
  updateWalletDropdowns();
  refreshWalletFilterBars();
  showToast('เพิ่มบัญชีแล้ว');
}

/**
 * ลบกระเป๋าเงิน (ต้องเหลืออย่างน้อย 1 ใบ)
 * @param {*} id
 */
async function deleteWallet(id) {
  if (App.state.wallets.length <= 1) return showToast('ต้องมีบัญชีอย่างน้อย 1 บัญชี');

  const hasTransfer = App.state.items.some(i => i.transferId && (i.walletId === id));
  if (hasTransfer && !await showConfirmModal('บัญชีนี้มีรายการโอนเงินอยู่ ยืนยันลบ?')) return;

  const used = App.state.items.some(i => i.walletId === id && !i.transferId);
  if (used && !await showConfirmModal('บัญชีนี้มีรายการอยู่ ยืนยันลบ?')) return;

  if (!await showConfirmModal('คุณแน่ใจว่าต้องการลบบัญชีนี้?')) return;

  App.state.wallets = App.state.wallets.filter(w => w.id !== id);
  saveLocalStorage();
  renderWalletPage();
  updateWalletDropdowns();
  refreshWalletFilterBars();
  renderList();
  renderSearchList();
  showToast('ลบบัญชีแล้ว');
}

/**
 * โอนเงินระหว่างกระเป๋าเงินสองใบ
 */
function doTransfer() {
  const fromId = parseInt(document.getElementById('transferFrom').value);
  const toId = parseInt(document.getElementById('transferTo').value);
  const amount = parseFloat(document.getElementById('transferAmount').value);
  const note = document.getElementById('transferNote').value.trim();
  if (fromId === toId) return showToast('บัญชีต้นทางและปลายทางห้ามเดียวกัน');
  if (isNaN(amount) || amount <= 0) return showToast('กรุณากรอกจำนวนเงิน');

  const fromName = App.state.wallets.find(w => w.id === fromId)?.name || '';
  const toName = App.state.wallets.find(w => w.id === toId)?.name || '';
  const transferId = `tr_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  App.state.items.push({ id: Date.now(), name: `โอน → ${toName}`, amount, type: 'expense', date: today, note: note || 'โอนเงิน', category: 'โอน', walletId: fromId, transferId });
  App.state.items.push({ id: Date.now() + Math.floor(Math.random() * 9000 + 1000), name: `รับโอน ← ${fromName}`, amount, type: 'income', date: today, note: note || 'โอนเงิน', category: 'โอน', walletId: toId, transferId });
  saveLocalStorage();
  document.getElementById('transferAmount').value = '';
  document.getElementById('transferNote').value = '';
  renderWalletPage();
  renderList();
  renderSearchList();
  update();
  refreshWalletFilterBars();
  showToast(`โอน ${amount.toLocaleString()} ฿ สำเร็จ`);
}

/**
 * วาดหน้ากระเป๋าเงิน (ลิสต์บัญชี + ยอดคงเหลือ)
 */
function renderWalletPage() {
  const wallets = App.state.wallets || [];
  const grid = document.getElementById('walletSummary');
  if (grid) {
    grid.innerHTML = wallets.map(w => {
      const bal = getWalletBalance(w.id);
      return `<div class="wsc-card"><div class="wsc-name">${escapeHtml(w.name)}</div><div class="wsc-bal" style="color:${bal >= 0 ? 'var(--gold)' : 'var(--red)'}">${bal.toLocaleString()} ฿</div></div>`;
    }).join('');
  }
  const list = document.getElementById('walletList');
  if (list) {
    if (!wallets.length) { list.innerHTML = '<div class="empty">— ไม่มีบัญชี —</div>'; return; }
    list.innerHTML = wallets.map(w => {
      const bal = getWalletBalance(w.id);
      const txCount = App.state.items.filter(i => i.walletId === w.id).length;
      return `<div class="wallet-card">
        <div><div class="wc-name">💲 ${escapeHtml(w.name)}</div><div class="wc-meta">${txCount} รายการ · ยอดเริ่ม ${(w.init || 0).toLocaleString()} ฿</div></div>
        <div style="display:flex;align-items:center;gap:0.7rem">
          <div class="wc-bal" style="color:${bal >= 0 ? 'var(--gold)' : 'var(--red)'}">${bal.toLocaleString()} ฿</div>
          ${wallets.length > 1 ? `<button class="btn-wallet-del" onclick="deleteWallet(${w.id})">✕</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }
  updateWalletDropdowns();
}

/**
 * ------------------------------------------------------------
 * 11) หน้ายืมเงิน (Loan)
 * ------------------------------------------------------------
 * สลับแท็บ ยืม/คืน ในหน้ายืมเงิน
 * @param {*} mode
 * @param {*} el
 */
function setLoanTab(mode, el) {
  App.state.loanDisplayMode = mode;
  document.querySelectorAll('.loan-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderLoan();
}

/**
 * วาดหน้ายืมเงิน (สรุปยอดยืม-คืน)
 */
function renderLoan() {
  const items = App.state.items || [];
  const borrows = items.filter(i => i.type === 'income' && i.category === 'ยืม');
  const repays = items.filter(i => i.type === 'expense' && i.category === 'คืน');
  const totalBorrow = borrows.reduce((s, i) => s + i.amount, 0);
  const totalRepaid = repays.reduce((s, i) => s + i.amount, 0);
  const remain = totalBorrow - totalRepaid;

  document.getElementById('loanTotalBorrow').innerText = totalBorrow.toLocaleString() + ' ฿';
  document.getElementById('loanTotalRepaid').innerText = totalRepaid.toLocaleString() + ' ฿';

  const remEl = document.getElementById('loanTotalRemain');
  const activeRemain = Math.max(remain, 0);
  remEl.innerText = activeRemain.toLocaleString() + ' ฿';
  remEl.style.color = activeRemain > 0 ? 'var(--red)' : 'var(--green)';

  if (App.state.loanDisplayMode === 'list') {
    document.getElementById('loanListHeader').innerText = `รายการทั้งหมด (${borrows.length + repays.length})`;
    const all = [...borrows.map(i => ({ ...i, ltype: 'borrow' })), ...repays.map(i => ({ ...i, ltype: 'repay' }))].sort((a, b) => b.date.localeCompare(a.date));
    document.getElementById('loanList').innerHTML = all.length ? all.map(i => `
      <div class="item ${i.ltype === 'borrow' ? 'income' : 'expense'}">
        <div class="item-left" style="flex:1">
          <div class="name">${escapeHtml(i.name)}<span style="font-size:0.62rem;color:var(--muted)"> ${i.ltype === 'borrow' ? '(ยืม)' : '(คืน)'}</span></div>
          <div class="meta">${escapeHtml(i.date)}${i.note ? ' · ' + escapeHtml(i.note) : ''}</div>
        </div>
        <div class="item-right">
          <div class="amount" style="color:${i.ltype === 'borrow' ? 'var(--red)' : 'var(--green)'}">${i.ltype === 'borrow' ? '+' : '-'}${i.amount.toLocaleString()}</div>
        </div>
      </div>`).join('') : '<div class="empty">— ไม่มีรายการ —</div>';
  } else {
    document.getElementById('loanListHeader').innerText = 'สรุปรายคน (ยังค้างอยู่)';

    const persons = new Map();
    borrows.forEach(i => {
      let p = persons.get(i.name) || { borrow: 0, repay: 0, txns: [] };
      p.borrow += i.amount;
      p.txns.push({ ...i, ltype: 'borrow' });
      persons.set(i.name, p);
    });
    repays.forEach(i => {
      let p = persons.get(i.name) || { borrow: 0, repay: 0, txns: [] };
      p.repay += i.amount;
      p.txns.push({ ...i, ltype: 'repay' });
      persons.set(i.name, p);
    });

    const filtered = [...persons.entries()]
      .filter(([name, data]) => (data.borrow - data.repay) > 0)
      .sort((a, b) => (b[1].borrow - b[1].repay) - (a[1].borrow - a[1].repay));

    if (!filtered.length) {
      document.getElementById('loanList').innerHTML = `
        <div class="empty-state" style="padding:2rem;text-align:center;color:var(--muted);">
          <div style="font-size:2rem;margin-bottom:0.5rem;">✅</div>
          <div style="font-size:0.9rem;">ไม่มีหนี้ค้าง — ทุกคนเคลียร์แล้ว!</div>
        </div>`;
      return;
    }

    document.getElementById('loanList').innerHTML = filtered.map(([name, data]) => {
      const rem = data.borrow - data.repay;
      const pct = data.borrow > 0 ? Math.min((data.repay / data.borrow) * 100, 100).toFixed(0) : 100;
      const rows = [...data.txns].sort((a, b) => b.date.localeCompare(a.date)).map(t => `
        <div class="person-txn-row">
          <span>${t.ltype === 'borrow' ? '📥 ยืม' : '📤 คืน'}</span>
          <span>${escapeHtml(t.date)}</span>
          <span style="color:${t.ltype === 'borrow' ? 'var(--red)' : 'var(--green)'}">${t.ltype === 'borrow' ? '+' : '-'}${t.amount.toLocaleString()} ฿</span>
        </div>`).join('');
      return `<div class="person-card">
        <div class="person-top">
          <span class="person-name">${escapeHtml(name)}</span>
          <span class="person-remain" style="color:var(--red)">${rem.toLocaleString()} ฿</span>
        </div>
        <div class="person-prog"><div class="person-prog-fill" style="width:${pct}%"></div></div>
        <div class="person-prog-text">คืนแล้ว ${data.repay.toLocaleString()} / ${data.borrow.toLocaleString()} ฿ (${pct}%)</div>
        <div class="person-txns">${rows}</div>
      </div>`;
    }).join('');
  }
}

/**
 * ------------------------------------------------------------
 * 12) หน้าผ่อนชำระ (Installment)
 * ------------------------------------------------------------
 * สลับแท็บประเภทในหน้าสินเชื่อ
 * @param {*} type
 * @param {*} el
 */
function setInstTab(type, el) {
  App.state.instTab = type;
  document.querySelectorAll('.inst-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderInstallment();
}

/**
 * เพิ่มรายการผ่อนชำระใหม่
 */
function addInstallment() {
  const name = document.getElementById('instName').value.trim();
  const total = parseFloat(document.getElementById('instTotal').value);
  const monthly = parseFloat(document.getElementById('instMonthly').value);
  const terms = parseInt(document.getElementById('instTerms').value);
  const paid = parseInt(document.getElementById('instPaid').value) || 0;
  const date = document.getElementById('instDate').value || today;
  const note = document.getElementById('instNote').value.trim();
  if (!name || isNaN(total) || isNaN(monthly) || isNaN(terms) || terms < 1) return showToast('กรอกข้อมูลให้ครบ');
  if (paid > terms) return showToast('งวดที่จ่ายเกินจำนวนงวด');

  App.state.installments.push({ id: Date.now(), name, total, monthly, terms, type: App.state.instTab, date, note, paidTerms: paid, payments: [] });
  saveLocalStorage();
  ['instName', 'instTotal', 'instMonthly', 'instTerms', 'instNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('instPaid').value = '0';
  renderInstallment();
  showToast('เพิ่มรายการแล้ว');
}

/**
 * ลบรายการผ่อนชำระ
 * @param {*} id
 */
async function deleteInstallment(id) {
  if (await showConfirmModal('คุณแน่ใจว่าต้องการลบรายการผ่อนนี้?')) {
    App.state.installments = App.state.installments.filter(i => i.id !== id);
    saveLocalStorage();
    renderInstallment();
    showToast('ลบแล้ว');
  }
}

/**
 * เปิดป๊อปอัปสำหรับจ่ายค่างวด
 * @param {*} id
 */
function openInstPayModal(id) {
  const inst = App.state.installments.find(i => i.id === id);
  if (!inst) return;
  const remTerms = inst.terms - inst.paidTerms;
  document.getElementById('instPayId').value = id;
  document.getElementById('instPayQty').value = 1;
  document.getElementById('instPayQty').max = remTerms;
  document.getElementById('instPayDate').value = today;
  document.getElementById('instPayNote').value = '';
  document.getElementById('instPayTitle').innerText = `💳 จ่ายงวด ${inst.name} (เหลือ ${remTerms} งวด × ${inst.monthly.toLocaleString()} ฿)`;
  updateWalletDropdowns();
  document.getElementById('instPayModalBg').classList.add('open');
}

/**
 * ปิดป๊อปอัปจ่ายค่างวด
 */
function closeInstPayModal() { document.getElementById('instPayModalBg').classList.remove('open'); }

/**
 * บันทึกการจ่ายค่างวด
 */
function saveInstPay() {
  const id = parseInt(document.getElementById('instPayId').value);
  const qty = parseInt(document.getElementById('instPayQty').value);
  const date = document.getElementById('instPayDate').value || today;
  const note = document.getElementById('instPayNote').value.trim();
  const walletId = parseInt(document.getElementById('instPayWallet').value) || (App.state.wallets[0]?.id || 1);
  if (isNaN(qty) || qty < 1) return showToast('กรุณากรอกจำนวนงวด');
  const inst = App.state.installments.find(i => i.id === id);
  if (!inst) return;
  const remTerms = inst.terms - inst.paidTerms;
  if (qty > remTerms) return showToast(`จ่ายได้สูงสุด ${remTerms} งวด`);

  inst.paidTerms += qty;
  const now = Date.now() + Math.random() * 1000;
  const amount = qty * inst.monthly;
  inst.payments.push({ id: now, qty, amount, date, note });

  App.state.items.push({
    id: now,
    name: `ผ่อนชำระ: ${inst.name} (งวดที่ ${inst.paidTerms})`,
    amount,
    type: 'expense',
    date,
    note: note || `จ่ายผ่อนชำระ ${qty} งวด`,
    category: inst.type === 'phone' ? 'ผ่อนมือถือ' : 'ผ่อนสินเชื่อ',
    walletId
  });

  saveLocalStorage();
  closeInstPayModal();
  renderInstallment();
  renderList();
  renderSearchList();
  update();
  renderWalletPage();
  refreshWalletFilterBars();
  showToast(`บันทึกจ่าย ${qty} งวดแล้ว`);
}

/**
 * วาดหน้าสินเชื่อ (ลิสต์รายการผ่อนทั้งหมด)
 */
function renderInstallment() {
  const insts = App.state.installments || [];
  let phoneRem = 0, paynextRem = 0;
  insts.forEach(inst => { const rem = (inst.terms - inst.paidTerms) * inst.monthly; if (rem > 0) inst.type === 'phone' ? phoneRem += rem : paynextRem += rem; });
  document.getElementById('instPhoneTotal').innerText = phoneRem.toLocaleString() + ' ฿';
  document.getElementById('instPaynextTotal').innerText = paynextRem.toLocaleString() + ' ฿';
  const filtered = insts.filter(i => i.type === App.state.instTab);
  document.getElementById('instListHeader').innerText = App.state.instTab === 'phone' ? `ผ่อนมือถือ (${filtered.length})` : `PayNext (${filtered.length})`;
  const container = document.getElementById('instList');
  if (!filtered.length) { container.innerHTML = '<div class="empty">— ยังไม่มีรายการ —</div>'; return; }

  container.innerHTML = [...filtered].reverse().map(inst => {
    const paidTerms = inst.paidTerms, remTerms = inst.terms - paidTerms;
    const pct = Math.min((paidTerms / inst.terms) * 100, 100).toFixed(0);
    const done = remTerms <= 0;
    const payRows = inst.payments.length ? `<div class="pay-history">${inst.payments.map(p => `<div class="pay-row"><span>${escapeHtml(p.date)} · ${p.qty} งวด${p.note ? ' · ' + escapeHtml(p.note) : ''}</span><span class="pr-amount">+${p.amount.toLocaleString()} ฿</span></div>`).join('')}</div>` : '';
    return `<div class="inst-item ${inst.type}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div class="inst-name">${escapeHtml(inst.name)} ${done ? '<span class="inst-done-badge">✓ ผ่อนหมด</span>' : ''}</div><div class="inst-meta">${escapeHtml(inst.date)}${inst.note ? ' · ' + escapeHtml(inst.note) : ''}</div></div>
        <div class="inst-remain">${(remTerms * inst.monthly).toLocaleString()} ฿</div>
      </div>
      <div class="inst-progress"><div class="inst-fill" style="width:${pct}%"></div></div>
      <div class="inst-progress-text">จ่ายแล้ว ${paidTerms}/${inst.terms} งวด (${pct}%)</div>
      <div class="inst-detail">
        <div class="inst-stat"><div class="inst-stat-label">งวดละ</div><div class="inst-stat-val">${inst.monthly.toLocaleString()} ฿</div></div>
        <div class="inst-stat"><div class="inst-stat-label">เหลืองวด</div><div class="inst-stat-val">${remTerms}</div></div>
        <div class="inst-stat"><div class="inst-stat-label">ยอดรวม</div><div class="inst-stat-val">${inst.total.toLocaleString()} ฿</div></div>
      </div>
      ${payRows}
      <div class="inst-actions">${!done ? `<button class="btn-pay" onclick="openInstPayModal(${inst.id})">💳 จ่ายงวด</button>` : ''}<button class="btn-del-sm" onclick="deleteInstallment(${inst.id})">🗑</button></div>
    </div>`;
  }).join('');
}

/**
 * ------------------------------------------------------------
 * 13) หน้าหมวดหมู่ (Category)
 * ------------------------------------------------------------
 * สลับแท็บรายรับ/รายจ่ายในหน้าหมวดหมู่
 * @param {*} type
 * @param {*} el
 */
function setCatTab(type, el) {
  App.state.catTab = type;
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderCatList();
}

/**
 * เพิ่มหมวดหมู่ใหม่
 */
function addCategory() {
  const name = document.getElementById('catNameInput').value.trim();
  if (!name) return showToast('กรุณากรอกชื่อหมวด');
  if (App.state.categories[App.state.catTab].includes(name)) return showToast('มีหมวดนี้แล้ว');
  App.state.categories[App.state.catTab].push(name);
  saveLocalStorage();
  document.getElementById('catNameInput').value = '';
  renderCatList();
  updateCategoryDropdown(App.state.currentMode, 'categorySelect');
}

/**
 * ลบหมวดหมู่
 * @param {*} type
 * @param {*} name
 */
async function deleteCategory(type, name) {
  if (DEFAULT_DATA.categories[type].includes(name)) return showToast('ไม่สามารถลบหมวดเริ่มต้น');
  if (!await showConfirmModal(`คุณแน่ใจว่าต้องการลบหมวด "${name}"?`)) return;
  App.state.categories[type] = App.state.categories[type].filter(c => c !== name);
  saveLocalStorage();
  renderCatList();
  updateCategoryDropdown(App.state.currentMode, 'categorySelect');
}

/**
 * รีเซ็ตหมวดหมู่กลับเป็นค่าเริ่มต้น
 */
async function resetCategories() {
  if (!await showConfirmModal('รีเซ็ตหมวดหมู่ทั้งหมดกลับเป็นค่าเริ่มต้น? หมวดที่เพิ่มไว้จะหายไป', false)) return;
  App.state.categories = {
    income: [...DEFAULT_DATA.categories.income],
    expense: [...DEFAULT_DATA.categories.expense]
  };
  saveLocalStorage();
  renderCatList();
  updateCategoryDropdown(App.state.currentMode, 'categorySelect');
  showToast('รีเซ็ตหมวดแล้ว');
}

/**
 * วาดลิสต์หมวดหมู่ในหน้าหมวดหมู่
 */
function renderCatList() {
  const el = document.getElementById('catList');
  if (!el) return;
  const cats = App.state.categories[App.state.catTab] || [];
  if (!cats.length) { el.innerHTML = '<div class="empty">— ยังไม่มีหมวดหมู่ —</div>'; return; }
  el.innerHTML = cats.map(c => `
    <div class="cat-item">
      <span>${escapeHtml(c)}${DEFAULT_DATA.categories[App.state.catTab].includes(c) ? '<span class="ci-default">default</span>' : ''}</span>
      <button class="btn-cat-del" onclick="deleteCategory('${App.state.catTab}','${escapeHtml(c)}')">✕</button>
    </div>`).join('');
}

/**
 * ------------------------------------------------------------
 * 14) หน้าลิสต์ทูเพย์ (Bills)
 * ------------------------------------------------------------
 * สลับโหมดรายรับ/รายจ่ายในฟอร์มหน้าลิสต์ทูเพย์ (บิล)
 * @param {*} mode
 * @param {*} el
 */
function setBillMode(mode, el) {
  App.state.currentBillMode = mode;
  const scope = document.querySelectorAll('#billModeToggle .mode-btn');
  scope.forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');

  scope.forEach(btn => {
    const isIncome = btn.dataset.mode === 'income';
    const isActive = btn.classList.contains('active');
    btn.textContent = isIncome
      ? (isActive ? '● รายรับ' : '○ รายรับ')
      : (isActive ? '● รายจ่าย' : '○ รายจ่าย');
  });

  updateCategoryDropdown(mode, 'billCategorySelect');
}

/**
 * เพิ่มรายการที่ต้องจ่ายใหม่ (บิลค้างจ่าย)
 */
function addBill() {
  const name = document.getElementById('billName').value.trim();
  const amount = parseFloat(document.getElementById('billAmount').value);
  const dueDate = document.getElementById('billDueDate').value;
  const category = document.getElementById('billCategorySelect').value;
  const walletId = parseInt(document.getElementById('billWalletSelect').value) || (App.state.wallets[0]?.id || 1);
  const repeatMonthly = document.getElementById('billRepeatMonthly').checked;
  const type = App.state.currentBillMode || 'expense';

  if (!name || isNaN(amount) || amount <= 0) return showToast('กรอกข้อมูลให้ครบถ้วน');

  App.state.bills.push({
    id: Date.now(),
    name,
    amount,
    type,
    dueDate: dueDate || today,
    status: 'unpaid',
    repeatMonthly,
    category: category || 'อื่นๆ',
    walletId
  });
  saveLocalStorage();

  document.getElementById('billName').value = '';
  document.getElementById('billAmount').value = '';
  document.getElementById('billDueDate').value = '';
  document.getElementById('billRepeatMonthly').checked = false;

  renderBillsPage();
  showToast('เพิ่มรายการแล้ว');
}

/**
 * ลบรายการที่ต้องจ่าย (ต้องกดยืนยันก่อน)
 * @param {*} id
 */
async function deleteBill(id) {
  if (await showConfirmModal('คุณแน่ใจว่าต้องการลบรายการนี้?')) {
    App.state.bills = App.state.bills.filter(b => b.id !== id);
    saveLocalStorage();
    renderBillsPage();
    showToast('ลบแล้ว');
  }
}

/**
 * กดปุ่ม "จ่ายแล้ว/ได้รับแล้ว": สร้างรายการจริง + ถ้าเป็นบิลรายเดือนให้เลื่อนวันครบกำหนดไปเดือนหน้า
 * @param {*} id
 */
async function markBillPaid(id) {
  const bill = App.state.bills.find(b => b.id === id);
  if (!bill) return;
  const type = bill.type || 'expense'; // ข้อมูลเก่าก่อนมี field type ให้ถือเป็นรายจ่าย
  const verb = type === 'income' ? 'ได้รับ' : 'จ่าย';
  if (!await showConfirmModal(`ยืนยันว่า${verb} "${bill.name}" (${bill.amount.toLocaleString()} ฿) แล้ว?`, false)) return;

  // บันทึกเป็นรายการจริงในหน้าแรก
  App.state.items.push({
    id: Date.now(),
    name: bill.name,
    amount: bill.amount,
    type,
    date: today,
    note: '',
    category: bill.category,
    walletId: bill.walletId
  });

  if (bill.repeatMonthly) {
    // บิลรายเดือน: เลื่อนวันครบกำหนด +1 เดือน แล้วเปิดให้ทำรายการรอบใหม่ (ไม่ลบทิ้ง)
    const nextDue = new Date(bill.dueDate + 'T00:00:00');
    nextDue.setMonth(nextDue.getMonth() + 1);
    bill.dueDate = nextDue.toISOString().split('T')[0];
    bill.status = 'unpaid';
    bill.id = Date.now() + 1;
  } else {
    // ครั้งเดียว: แค่ทำเครื่องหมายว่าจ่าย/ได้รับแล้ว
    bill.status = 'paid';
  }

  saveLocalStorage();
  renderBillsPage();
  renderList();
  renderSearchList();
  update();
  renderWalletPage();
  refreshWalletFilterBars();
  showToast(type === 'income' ? 'บันทึกรายรับแล้ว' : 'บันทึกการจ่ายแล้ว');
}

/**
 * วาดหน้าลิสต์ทูเพย์: เติม dropdown หมวดหมู่/บัญชี แล้วแสดงลิสต์เรียงจากที่บันทึกล่าสุด
 */
function renderBillsPage() {
  updateCategoryDropdown(App.state.currentBillMode || 'expense', 'billCategorySelect');
  const walletSelect = document.getElementById('billWalletSelect');
  if (walletSelect) {
    walletSelect.innerHTML = (App.state.wallets || []).map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
  }

  const listDiv = document.getElementById('billList');
  const listHeader = document.getElementById('billListHeader');
  if (!listDiv || !listHeader) return;

  // เรียงตามลำดับบันทึกล่าสุดก่อน (id มาก = เพิ่งบันทึก)
  const sorted = [...App.state.bills].sort((a, b) => b.id - a.id);

  if (sorted.length === 0) {
    listHeader.innerText = 'ยังไม่มีรายการ';
    listDiv.innerHTML = '<div class="empty">— เพิ่มรายการด้านบน —</div>';
    return;
  }

  listHeader.innerText = `รายการที่ต้องทำ (${sorted.length})`;
  listDiv.innerHTML = sorted.map(b => {
    const type = b.type || 'expense';
    const isIncome = type === 'income';
    const isPaid = b.status === 'paid';
    const isOverdue = !isPaid && b.dueDate < today; // เลยวันครบกำหนดแล้วและยังไม่ทำรายการ
    const dateColor = isPaid ? 'var(--muted)' : (isOverdue ? 'var(--red)' : 'var(--text)');
    const doneLabel = isIncome ? 'ได้รับแล้ว' : 'จ่ายแล้ว';
    const actionLabel = isIncome ? 'รับแล้ว' : 'จ่ายแล้ว';
    return `
      <div class="item ${type}" style="opacity:${isPaid ? 0.6 : 1}">
        <div class="item-left" style="flex:1">
          <div class="name">${escapeHtml(b.name)}</div>
          <div class="meta" style="color:${dateColor}">${formatBillDate(b.dueDate)} · ${escapeHtml(b.category)}${isPaid ? ` · ${doneLabel}` : (isOverdue ? ' · เลยกำหนด' : '')}</div>
        </div>
        <div class="item-right">
          <div class="amount">${isIncome ? '+' : '-'}${b.amount.toLocaleString()}</div>
          <div style="display:flex;gap:0.3rem;">
            ${isPaid ? '' : `<button class="btn-neon" style="padding:4px 8px;font-size:0.75rem;" onclick="markBillPaid(${b.id})">${actionLabel}</button>`}
            <button class="btn-del" onclick="deleteBill(${b.id})">✕</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

/**
 * ------------------------------------------------------------
 * 15) หน้าสรุป/แดชบอร์ด (Summary)
 * ------------------------------------------------------------
 * วาดหน้าแดชบอร์ด (กราฟ + สรุปทั้งหมด)
 */
function render() {
  const month = document.getElementById('sumMonthSelect').value || today.slice(0, 7);
  const items = App.state.items || [];
  const monthItems = items.filter(i => i.date.startsWith(month));
  let inc = 0, exp = 0;
  monthItems.forEach(i => { if (i.type === 'income') inc += i.amount; else exp += i.amount; });
  document.getElementById('sumIncome').innerText = inc.toLocaleString();
  document.getElementById('sumExpense').innerText = exp.toLocaleString();
  const bal = inc - exp;
  const balEl = document.getElementById('sumBalance');
  if (balEl) {
    balEl.innerText = (bal >= 0 ? '+' : '') + bal.toLocaleString() + ' บาท';
    balEl.style.color = bal >= 0 ? 'var(--green)' : 'var(--red)';
  }

  const loanBorrow = items.filter(i => i.type === 'income' && i.category === 'ยืม').reduce((s, i) => s + i.amount, 0);
  const loanRepay = items.filter(i => i.type === 'expense' && i.category === 'คืน').reduce((s, i) => s + i.amount, 0);
  const loanRemain = loanBorrow - loanRepay;
  const loanRemEl = document.getElementById('summaryLoanRemain');
  if (loanRemEl) loanRemEl.innerText = (loanRemain > 0 ? loanRemain.toLocaleString() : '0') + ' ฿';

  renderBar('expenseBar', monthItems, 'expense');
  renderBar('incomeBar', monthItems, 'income');
  drawBar(monthItems, App.state.chartBarType);
  drawDonut(monthItems, App.state.chartDonutType);

  const topExp = [...monthItems.filter(i => i.type === 'expense')].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const topExpEl = document.getElementById('topExpense');
  if (topExpEl) {
    topExpEl.innerHTML = topExp.length ? topExp.map(i => `<div class="top-item"><div>${escapeHtml(i.name)} <span style="font-size:0.62rem;color:var(--muted)">${escapeHtml(i.category || '')}</span></div><div class="ti-amount">-${i.amount.toLocaleString()}</div></div>`).join('') : '<div class="empty">— ไม่มีรายจ่าย —</div>';
  }
}

/**
 * วาดกราฟแท่งแยกตามหมวดหมู่
 * @param {*} elId
 * @param {*} monthItems
 * @param {*} type
 */
function renderBar(elId, monthItems, type) {
  const filtered = monthItems.filter(i => i.type === type);
  const catMap = new Map();
  filtered.forEach(i => { const cat = i.category || 'อื่นๆ'; catMap.set(cat, (catMap.get(cat) || 0) + i.amount); });
  const sorted = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, c) => s + c[1], 0);
  const el = document.getElementById(elId);
  if (!el) return;
  if (!sorted.length) { el.innerHTML = '<div class="empty">— ไม่มีข้อมูล —</div>'; return; }
  el.innerHTML = sorted.map(([cat, amt]) => `<div class="bar-row"><div class="bar-label">${escapeHtml(cat)}</div><div class="bar-track"><div class="bar-fill ${type}" style="width:${total ? (amt / total * 100).toFixed(1) : 0}%"></div></div><div class="bar-val">${amt.toLocaleString()}</div></div>`).join('');
}

/**
 * เติมตัวเลือกเดือนใน dropdown ของหน้าแดชบอร์ด
 */
function initMonthSelect() {
  const items = App.state.items || [];
  const months = [...new Set(items.map(i => i.date.slice(0, 7)))].sort().reverse();
  const thisMonth = today.slice(0, 7);
  if (!months.includes(thisMonth)) months.unshift(thisMonth);
  const sel = document.getElementById('sumMonthSelect');
  if (!sel) return;
  const curVal = sel.value;
  sel.innerHTML = months.map(m => { const [y, mo] = m.split('-'); return `<option value="${m}">${new Date(y, mo - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</option>`; }).join('');
  sel.value = curVal && months.includes(curVal) ? curVal : thisMonth;
}

/**
 * รวมยอดเงินแยกตามหมวดหมู่ สำหรับทำกราฟ
 * @param {*} monthItems
 * @param {*} type
 */
function getCatData(monthItems, type) {
  const filtered = monthItems.filter(i => i.type === type);
  const catMap = new Map();
  filtered.forEach(i => { const c = i.category || 'อื่นๆ'; catMap.set(c, (catMap.get(c) || 0) + i.amount); });
  return [...catMap.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * สลับแท็บกราฟแท่ง (รายรับ/รายจ่าย)
 * @param {*} type
 * @param {*} el
 */
function setChartTab(type, el) {
  App.state.chartBarType = type;
  document.querySelectorAll('#page-summary .chart-wrap:first-of-type .chart-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const month = document.getElementById('sumMonthSelect').value || today.slice(0, 7);
  const items = App.state.items || [];
  const monthItems = items.filter(i => i.date.startsWith(month));
  drawBar(monthItems, type);
}

/**
 * สลับแท็บกราฟโดนัท (รายรับ/รายจ่าย)
 * @param {*} type
 * @param {*} el
 */
function setDonutTab(type, el) {
  App.state.chartDonutType = type;
  const wraps = document.querySelectorAll('#page-summary .chart-wrap');
  if (wraps[1]) wraps[1].querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const month = document.getElementById('sumMonthSelect').value || today.slice(0, 7);
  const items = App.state.items || [];
  const monthItems = items.filter(i => i.date.startsWith(month));
  drawDonut(monthItems, type);
}

/**
 * วาดกราฟแท่งลงบน canvas
 * @param {*} monthItems
 * @param {*} type
 */
function drawBar(monthItems, type) {
  const canvas = document.getElementById('barCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = getCatData(monthItems, type);
  const colors = type === 'expense' ? COLORS_EXP : COLORS_INC;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 32;
  const H = 200;
  if (W <= 0) return;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  if (!data.length) {
    ctx.fillStyle = '#4a5568';
    ctx.font = '13px Pattaya';
    ctx.textAlign = 'center';
    ctx.fillText('— ไม่มีข้อมูล —', W / 2, H / 2);
    return;
  }
  const maxVal = Math.max(...data.map(d => d[1]));
  const padL = 70, padR = 10, padT = 10, padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barH = Math.min(28, (chartH / data.length) - 6);
  const gap = (chartH - barH * data.length) / (data.length + 1);
  data.forEach(([cat, amt], i) => {
    const y = padT + gap + i * (barH + gap);
    const barW = (amt / maxVal) * chartW;
    const color = colors[i % colors.length];
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(padL, y, barW, barH, 3);
    else ctx.rect(padL, y, barW, barH);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#cdd4e0';
    ctx.font = `11px Pattaya`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const label = cat.length > 7 ? cat.slice(0, 7) + '…' : cat;
    ctx.fillText(label, padL - 4, y + barH / 2);
    ctx.fillStyle = color;
    ctx.font = `10px Pattaya`;
    ctx.textAlign = 'left';
    ctx.fillText(amt.toLocaleString(), padL + barW + 4, y + barH / 2);
  });
}

/**
 * วาดกราฟโดนัทลงบน canvas
 * @param {*} monthItems
 * @param {*} type
 */
function drawDonut(monthItems, type) {
  const canvas = document.getElementById('donutCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = getCatData(monthItems, type);
  const colors = type === 'expense' ? COLORS_EXP : COLORS_INC;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 32;
  const H = 200;
  if (W <= 0) return;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const legend = document.getElementById('donutLegend');
  if (!data.length) {
    ctx.fillStyle = '#4a5568';
    ctx.font = '13px Pattaya';
    ctx.textAlign = 'center';
    ctx.fillText('— ไม่มีข้อมูล —', W / 2, H / 2);
    if (legend) legend.innerHTML = '';
    return;
  }
  const total = data.reduce((s, d) => s + d[1], 0);
  const cx = W / 2, cy = H / 2;
  const radius = Math.min(cx, cy) - 16;
  const inner = radius * 0.55;
  let startAngle = -Math.PI / 2;
  data.forEach(([cat, amt], i) => {
    const slice = (amt / total) * 2 * Math.PI;
    const color = colors[i % colors.length];
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
    ctx.arc(cx, cy, inner, startAngle + slice, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    startAngle += slice;
  });
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f1320';
  ctx.fill();
  ctx.fillStyle = '#c8a84b';
  ctx.font = `bold 13px Pattaya`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total.toLocaleString(), cx, cy - 7);
  ctx.fillStyle = '#4a5568';
  ctx.font = `10px Pattaya`;
  ctx.fillText('บาท', cx, cy + 9);

  if (legend) {
    legend.innerHTML = data.map(([cat, amt], i) => {
      const pct = ((amt / total) * 100).toFixed(1);
      return `<div class="legend-item"><div class="legend-dot" style="background:${colors[i % colors.length]}"></div><span>${escapeHtml(cat)} <span style="color:var(--muted)">${pct}%</span></span></div>`;
    }).join('');
  }
}

/**
 * ------------------------------------------------------------
 * 16) หน้าตั้งค่า & จัดการข้อมูล (Settings)
 * ------------------------------------------------------------
 * อัปเดตสถิติที่แสดงในหน้าตั้งค่า
 */
function renderSettingsPage() {
  const itemCountEl = document.getElementById('settingsItemCount');
  const walletCountEl = document.getElementById('settingsWalletCount');
  if (itemCountEl) itemCountEl.textContent = (App.state.items || []).length;
  if (walletCountEl) walletCountEl.textContent = (App.state.wallets || []).length;
}

/**
 * ล้างข้อมูลทั้งหมดในแอป (ต้องกดยืนยันก่อน)
 */
async function clearAll() {
  if (App.state.items.length && await showConfirmModal('ล้างข้อมูลทั้งหมด?')) {
    App.state.items = [];
    saveLocalStorage();
    renderList();
    renderSearchList();
    update();
    renderWalletPage();
    refreshWalletFilterBars();
    showToast('ล้างข้อมูลแล้ว');
  }
}

/**
 * ------------------------------------------------------------
 * 17) เริ่มต้นแอป (App Init)
 * ------------------------------------------------------------
 * จุดเริ่มต้นของแอป: โหลดข้อมูลแล้ววาดหน้าจอครั้งแรก
 */
function initApp() {
  loadLocalStorage();

  displayCurrentDate();

  updateCategoryDropdown(App.state.currentMode, 'categorySelect');
  updateCategoryDropdown('income', 'editCategory');

  updateWalletDropdowns();
  refreshWalletFilterBars();
  renderList();
  renderSearchList();
  update();
  renderWalletPage();

  ['dateInput', 'instDate', 'instPayDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  const monthLbl = document.getElementById('monthLabel');
  if (monthLbl) monthLbl.innerText = new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  const modalBg = document.getElementById('modalBg');
  if (modalBg) {
    modalBg.addEventListener('click', e => {
      if (e.target === modalBg) closeModal();
    });
  }
  const instPayModalBg = document.getElementById('instPayModalBg');
  if (instPayModalBg) {
    instPayModalBg.addEventListener('click', e => {
      if (e.target === instPayModalBg) closeInstPayModal();
    });
  }

  const confirmBg = document.getElementById('confirmModalBg');
  if (confirmBg) {
    confirmBg.addEventListener('click', e => {
      if (e.target === confirmBg) {
        confirmBg.classList.remove('open');
        if (App.state.confirmResolver) { App.state.confirmResolver(false); App.state.confirmResolver = null; }
      }
    });
  }
  document.getElementById('confirmYesBtn')?.addEventListener('click', () => {
    document.getElementById('confirmModalBg').classList.remove('open');
    if (App.state.confirmResolver) { App.state.confirmResolver(true); App.state.confirmResolver = null; }
  });
  document.getElementById('confirmNoBtn')?.addEventListener('click', () => {
    document.getElementById('confirmModalBg').classList.remove('open');
    if (App.state.confirmResolver) { App.state.confirmResolver(false); App.state.confirmResolver = null; }
  });

  document.getElementById('editType')?.addEventListener('change', function() {
    updateCategoryDropdown(this.value, 'editCategory');
  });

  const searchInput = document.getElementById('searchInputPage');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      clearTimeout(App.state.searchDebounceTimer);
      App.state.searchDebounceTimer = setTimeout(renderSearchList, 300);
    });
    searchInput.addEventListener('focus', function() { this.select(); });
  }

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const pageSummary = document.getElementById('page-summary');
      if (pageSummary && pageSummary.classList.contains('active')) {
        render();
      }
    }, 200);
  });

  console.log(' Budget//Ctrl พร้อมใช้งาน (Homepage ปรับโหมดแล้ว)');
}

initApp();