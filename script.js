(function(){
  const $ = (id) => document.getElementById(id);

  // ---------- themed alert / confirm (replaces native alert/confirm) ----------
  function showAppAlert(message){
    return new Promise(resolve=>{
      $('appModalMessage').textContent = message;
      $('appModalIcon').textContent = '!';
      $('appModalCancelBtn').classList.add('hidden');
      $('appModalOkBtn').textContent = 'ตกลง';
      const overlay = $('appModalOverlay');
      overlay.classList.remove('hidden');
      const okBtn = $('appModalOkBtn');
      const onOk = ()=>{ cleanup(); resolve(true); };
      function cleanup(){
        overlay.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
      }
      okBtn.addEventListener('click', onOk);
    });
  }
  function showAppConfirm(message){
    return new Promise(resolve=>{
      $('appModalMessage').textContent = message;
      $('appModalIcon').textContent = '?';
      $('appModalCancelBtn').classList.remove('hidden');
      $('appModalOkBtn').textContent = 'ยืนยัน';
      const overlay = $('appModalOverlay');
      overlay.classList.remove('hidden');
      const okBtn = $('appModalOkBtn');
      const cancelBtn = $('appModalCancelBtn');
      function cleanup(){
        overlay.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
      }
      const onOk = ()=>{ cleanup(); resolve(true); };
      const onCancel = ()=>{ cleanup(); resolve(false); };
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
    });
  }

  const LS_KEY = 'savingsPassbookData_v3';
  const MONTH_NAMES = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  const fmt = n => '฿' + (isFinite(n) ? Math.round(n) : 0).toLocaleString('th-TH');
  const fmtNum = n => (isFinite(n) ? Math.round(n) : 0).toLocaleString('th-TH');
  const fmtDate = iso => {
    if(!iso) return '-';
    const d = new Date(iso+'T00:00:00');
    return d.toLocaleDateString('th-TH', {day:'2-digit', month:'short', year:'2-digit'});
  };
  const todayIso = () => new Date().toISOString().slice(0,10);
  const monthLabel = key => {
    const [y,m] = key.split('-');
    return MONTH_NAMES[parseInt(m,10)-1] + ' ' + y;
  };

  // state.months[key] = { salary: number|null, records: [{date, amount}] }
  let state = { settings: { name:'', percent:10 }, months: {} };
  let chartInstance = null;

  // ---------- persistence ----------
  function load(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && typeof parsed === 'object'){
          state.settings = Object.assign({name:'', percent:10}, parsed.settings || {});
          state.months = parsed.months || {};
          Object.keys(state.months).forEach(k=>{
            if(!Array.isArray(state.months[k].records)) state.months[k].records = [];
          });
        }
      }
    }catch(e){ console.error('โหลดข้อมูลไม่สำเร็จ', e); }
  }
  function save(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch(e){ console.error('บันทึกข้อมูลไม่สำเร็จ', e); }
  }

  // ---------- helpers ----------
  function ensureMonth(key){
    if(!state.months[key]) state.months[key] = { salary:null, records:[] };
    if(!Array.isArray(state.months[key].records)) state.months[key].records = [];
    return state.months[key];
  }
  function monthTarget(key){
    const m = state.months[key];
    if(!m || !isFinite(m.salary) || m.salary === null) return 0;
    return m.salary * (state.settings.percent/100);
  }
  function monthActual(key){
    const m = state.months[key];
    if(!m || !Array.isArray(m.records)) return 0;
    return m.records.reduce((s,r)=> s + (Number(r.amount)||0), 0);
  }
  function hasData(key){
    const m = state.months[key];
    return !!m && (isFinite(m.salary) && m.salary !== null || m.records.length > 0);
  }
  function activeMonthKeys(){
    return Object.keys(state.months).filter(hasData).sort();
  }
  function totalTarget(){
    return activeMonthKeys().reduce((s,k)=> s + monthTarget(k), 0);
  }
  function totalSaved(){
    return activeMonthKeys().reduce((s,k)=> s + monthActual(k), 0);
  }

  // ---------- year/month dropdowns ----------
  function getAvailableYears(){
    const years = new Set();
    Object.keys(state.months).forEach(k => years.add(parseInt(k.split('-')[0],10)));
    const cy = new Date().getFullYear();
    years.add(cy);
    for(let i = cy-10; i <= cy+1; i++) years.add(i);
    return Array.from(years).sort((a,b)=>a-b);
  }
  function currentMonthKey(){
    return $('monthSelect').value;
  }
  function populateDropdowns(selectedMonth){
    const yearSelect = $('yearSelect');
    const years = getAvailableYears();
    const cy = new Date().getFullYear();
    yearSelect.innerHTML = '';
    years.forEach(y=>{
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      yearSelect.appendChild(opt);
    });
    let selYear = cy;
    if(selectedMonth){
      const y = parseInt(selectedMonth.split('-')[0],10);
      if(years.includes(y)) selYear = y;
    }
    yearSelect.value = selYear;
    populateMonths(selectedMonth);
  }
  function populateMonths(selectedMonth){
    const monthSelect = $('monthSelect');
    const year = parseInt($('yearSelect').value,10);
    monthSelect.innerHTML = '';
    for(let m=1;m<=12;m++){
      const key = year + '-' + String(m).padStart(2,'0');
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = MONTH_NAMES[m-1] + (hasData(key) ? ' *' : '');
      monthSelect.appendChild(opt);
    }
    const now = new Date();
    let target = selectedMonth;
    if(target){
      const y = parseInt(target.split('-')[0],10);
      if(y !== year) target = null;
    }
    if(!target){
      target = (now.getFullYear() === year)
        ? year + '-' + String(now.getMonth()+1).padStart(2,'0')
        : year + '-01';
    }
    monthSelect.value = target;
  }

  // ---------- rendering ----------
  function renderSettings(){
    $('goalName').value = state.settings.name || '';
    $('goalPercent').value = state.settings.percent;
    document.querySelectorAll('.pct-value').forEach(el => el.textContent = state.settings.percent);
    $('coverTitle').textContent = state.settings.name || 'สมุดบัญชีออมทรัพย์';
    const keys = activeMonthKeys();
    $('bookNumber').textContent = keys.length
      ? ('เล่มที่ ' + keys[0].replace('-',''))
      : 'เล่มที่ —';
  }

  function renderMonthCard(){
    const key = currentMonthKey();
    const m = state.months[key];
    $('salaryInput').value = (m && isFinite(m.salary) && m.salary !== null) ? m.salary : '';
    updateSuggestBox();
    renderRecordList();
  }

  function updateSuggestBox(){
    const salary = parseFloat($('salaryInput').value);
    const emptyEl = $('suggestEmpty');
    const filledEl = $('suggestFilled');
    if(isFinite(salary) && salary > 0){
      const suggested = salary * (state.settings.percent/100);
      $('suggestedAmount').textContent = fmt(suggested);
      emptyEl.classList.add('hidden');
      filledEl.classList.remove('hidden');
    } else {
      emptyEl.classList.remove('hidden');
      filledEl.classList.add('hidden');
    }
  }

  function renderRecordList(){
    const key = currentMonthKey();
    const list = $('recordList');
    const records = (state.months[key] && state.months[key].records) || [];
    if(records.length === 0){
      list.innerHTML = '<div class="empty-msg">ยังไม่มีรายการในเดือนนี้</div>';
      return;
    }
    const sorted = records.map((r,i)=>({...r, i})).sort((a,b)=> b.date.localeCompare(a.date));
    list.innerHTML = sorted.map(r => `
      <div class="record-item">
        <span>${fmtDate(r.date)} &nbsp;→&nbsp; <span class="amt-txt">${fmtNum(r.amount)} บาท</span></span>
        <button class="del-btn" data-idx="${r.i}" aria-label="ลบรายการ">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('.del-btn').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const ok = await showAppConfirm('ลบรายการนี้ใช่ไหม?');
        if(ok){
          const idx = parseInt(btn.dataset.idx,10);
          const m = ensureMonth(key);
          m.records.splice(idx,1);
          save();
          renderRecordList();
          renderSummaryAndLists();
        }
      });
    });
  }

  function renderSummaryAndLists(){
    const keys = activeMonthKeys();

    const target = totalTarget();
    const saved = totalSaved();
    const remain = target - saved;

    $('sumSaved').textContent = fmt(saved);
    $('sumTarget').textContent = fmt(target);
    $('statMonthsCount').textContent = keys.length;
    $('statRemainAmt').textContent = (remain >= 0 ? fmt(remain) : ('เกิน ' + fmt(-remain)));

    const pctBar = target > 0 ? Math.min(100, (saved/target)*100) : 0;
    $('progressFill').style.width = pctBar.toFixed(1) + '%';

    const pill = $('statusPill');
    if(target === 0){
      pill.textContent = 'กรอกเงินเดือนเพื่อเริ่มตั้งเป้าหมาย';
      pill.className = 'status-pill status-empty';
    } else {
      const pct = (saved/target)*100;
      if(pct >= 100){
        pill.textContent = 'ออมได้ครบหรือเกินเป้าหมายสะสมแล้ว 🎉';
        pill.className = 'status-pill status-done';
      } else if(pct >= 70){
        pill.textContent = 'ใกล้เป้าหมายสะสมแล้ว (' + Math.round(pct) + '%)';
        pill.className = 'status-pill status-ontrack';
      } else {
        pill.textContent = 'ยังห่างจากเป้าหมายสะสม (' + Math.round(pct) + '%)';
        pill.className = 'status-pill status-behind';
      }
    }

    renderLedger(keys);
    renderOverview(keys);
    renderChart(keys);
  }

  function renderLedger(keys){
    const body = $('ledgerBody');
    body.innerHTML = '';
    if(keys.length === 0){
      body.innerHTML = '<div class="empty-note">ยังไม่มีข้อมูล กรุณากรอกเงินเดือนหรือเพิ่มรายการออมในหน้าหลักก่อน</div>';
      return;
    }
    let cum = 0;
    keys.forEach(key=>{
      const salary = state.months[key].salary;
      const tgt = monthTarget(key);
      const actual = monthActual(key);
      cum += actual;

      const row = document.createElement('div');
      row.className = 'ledger-row';
      row.innerHTML = `
        <div class="mth">${monthLabel(key)}<span class="plan">เงินเดือน ${isFinite(salary)&&salary!==null ? fmtNum(salary) : '—'} · เป้า ${fmt(tgt)}</span></div>
        <div class="amt">
          <span class="actual">${fmt(actual)}</span>
          <span class="cum">สะสม ${fmt(cum)}</span>
        </div>
        <div></div>
      `;
      const btnWrap = document.createElement('div');
      const btn = document.createElement('button');
      btn.className = 'edit-btn';
      btn.textContent = '✎';
      btn.setAttribute('aria-label', 'แก้ไขเดือนนี้');
      btn.addEventListener('click', ()=> selectMonth(key));
      btnWrap.appendChild(btn);
      row.lastElementChild.replaceWith(btnWrap);
      body.appendChild(row);
    });
  }

  function renderOverview(keys){
    const tbody = $('overviewTableBody');
    if(keys.length === 0){
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--muted);">ยังไม่มีข้อมูล</td></tr>';
      return;
    }
    tbody.innerHTML = keys.map(key=>{
      const salary = state.months[key].salary;
      const tgt = monthTarget(key);
      const actual = monthActual(key);
      const pct = tgt > 0 ? (actual/tgt)*100 : 0;
      return `
        <tr>
          <td>${monthLabel(key)}</td>
          <td class="text-right">${isFinite(salary)&&salary!==null ? fmtNum(salary) : '—'}</td>
          <td class="text-right">${fmtNum(tgt)}</td>
          <td class="text-right">${fmtNum(actual)}</td>
          <td class="text-right">${Math.round(pct)}%</td>
        </tr>
      `;
    }).join('');
  }

  function renderChart(keys){
    const canvas = $('chartCanvas');
    const fallback = $('chartFallback');
    if(typeof Chart === 'undefined'){
      if(canvas) canvas.classList.add('hidden');
      if(fallback) fallback.classList.remove('hidden');
      return;
    }
    if(canvas) canvas.classList.remove('hidden');
    if(fallback) fallback.classList.add('hidden');
    const ctx = canvas.getContext('2d');
    const labels = keys.map(monthLabel);
    const targets = keys.map(k => Math.round(monthTarget(k)));
    const actuals = keys.map(k => Math.round(monthActual(k)));

    if(chartInstance){ chartInstance.destroy(); }
    if(keys.length === 0){ chartInstance = null; return; }

    chartInstance = new Chart(ctx, {
      type:'bar',
      data:{
        labels,
        datasets:[
          { label:'เป้าหมาย', data:targets, backgroundColor:'rgba(184,137,43,0.55)', borderColor:'#B8892B', borderWidth:1, borderRadius:4 },
          { label:'ออมจริง', data:actuals, backgroundColor:'rgba(27,67,50,0.65)', borderColor:'#1B4332', borderWidth:1, borderRadius:4 }
        ]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{ position:'top' } },
        scales:{ y:{ beginAtZero:true, ticks:{ callback: v => v.toLocaleString('th-TH') + ' บาท' } } }
      }
    });
  }

  function selectMonth(key){
    const y = key.split('-')[0];
    $('yearSelect').value = y;
    populateMonths(key);
    renderMonthCard();
    showPage('pageHome');
  }

  // ---------- events ----------
  $('saveSettingsBtn').addEventListener('click', ()=>{
    const name = $('goalName').value.trim();
    let percent = parseFloat($('goalPercent').value);
    if(!isFinite(percent) || percent <= 0) percent = 10;
    percent = Math.min(100, Math.max(1, percent));
    state.settings.name = name;
    state.settings.percent = percent;
    $('goalPercent').value = percent;
    save();
    renderSettings();
    renderMonthCard();
    renderSummaryAndLists();
  });

  $('yearSelect').addEventListener('change', ()=>{
    const sel = $('monthSelect').value;
    populateMonths(sel);
    renderMonthCard();
  });
  $('monthSelect').addEventListener('change', renderMonthCard);

  $('salaryInput').addEventListener('input', updateSuggestBox);

  $('saveSalaryBtn').addEventListener('click', ()=>{
    const key = currentMonthKey();
    const val = parseFloat($('salaryInput').value);
    if(!isFinite(val) || val < 0){
      showAppAlert('กรุณากรอกเงินเดือนที่ถูกต้อง');
      return;
    }
    const m = ensureMonth(key);
    m.salary = val;
    save();
    populateMonths(key);
    renderSummaryAndLists();
  });

  $('deleteMonthBtn').addEventListener('click', async ()=>{
    const key = currentMonthKey();
    if(!hasData(key)){
      showAppAlert('เดือนนี้ยังไม่มีข้อมูลให้ลบ');
      return;
    }
    const ok = await showAppConfirm('ลบข้อมูลเดือน ' + monthLabel(key) + ' ทั้งหมดใช่ไหม?');
    if(ok){
      delete state.months[key];
      save();
      populateMonths(key);
      renderMonthCard();
      renderSummaryAndLists();
    }
  });

  $('addRecordBtn').addEventListener('click', ()=>{
    const key = currentMonthKey();
    const date = $('recordDate').value || todayIso();
    const amount = parseFloat($('recordAmount').value);
    if(!isFinite(amount) || amount <= 0){
      showAppAlert('กรุณากรอกจำนวนเงินที่ถูกต้อง (มากกว่า 0)');
      return;
    }
    const m = ensureMonth(key);
    m.records.push({ date, amount });
    save();
    $('recordAmount').value = '';
    renderRecordList();
    renderSummaryAndLists();
    populateMonths(key);
    playStampAnimation();
  });

  function playStampAnimation(){
    const wrap = document.createElement('div');
    wrap.className = 'stamp-anim';
    wrap.innerHTML = '<div class="stamp-mark">ออมแล้ว<br>' + new Date().toLocaleDateString('th-TH') + '</div>';
    document.body.appendChild(wrap);
    setTimeout(()=> wrap.remove(), 650);
  }

  // ---------- tab navigation ----------
  const PAGE_IDS = ['pageHome', 'pageSummary', 'pageSettings'];
  function showPage(pageId){
    PAGE_IDS.forEach(id=>{
      $(id).classList.toggle('hidden', id !== pageId);
    });
    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.page === pageId);
    });
    if(pageId === 'pageSummary' && chartInstance){
      requestAnimationFrame(()=> chartInstance.resize());
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function initTabNav(){
    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=> showPage(btn.dataset.page));
    });
    $('gotoSettingsBtn').addEventListener('click', ()=> showPage('pageSettings'));
    showPage('pageHome');
  }

  // ---------- refresh ----------
  $('refreshBtn').addEventListener('click', ()=>{
    const sel = currentMonthKey();
    load();
    renderSettings();
    populateDropdowns(sel);
    renderMonthCard();
    renderSummaryAndLists();
  });

  // ---------- data tools: JSON ----------
  $('exportJsonBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    downloadBlob(blob, baseFilename() + '.json');
  });

  function clampPercent(p){
    const n = parseFloat(p);
    if(!isFinite(n) || n <= 0) return 10;
    return Math.min(100, Math.max(1, n));
  }

  async function applyImportedState(newSettings, newMonths){
    const ok = await showAppConfirm('นำเข้าไฟล์นี้จะแทนที่ข้อมูลปัจจุบันทั้งหมด ยืนยันหรือไม่?');
    if(ok){
      state.settings = Object.assign({name:'', percent:10}, newSettings || {});
      state.settings.percent = clampPercent(state.settings.percent);
      state.months = newMonths || {};
      Object.keys(state.months).forEach(k=>{
        if(!Array.isArray(state.months[k].records)) state.months[k].records = [];
      });
      save();
      const sel = $('monthSelect').value;
      populateDropdowns(sel);
      renderSettings();
      renderMonthCard();
      renderSummaryAndLists();
    }
  }

  function importJsonFile(file){
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const parsed = JSON.parse(reader.result);
        if(!parsed || typeof parsed !== 'object' || !('months' in parsed)){
          throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
        }
        applyImportedState(parsed.settings, parsed.months);
      }catch(err){
        showAppAlert('ไม่สามารถนำเข้าไฟล์ JSON ได้: ไฟล์อาจเสียหายหรือไม่ใช่ไฟล์ที่ส่งออกจากแอปนี้');
      }
    };
    reader.readAsText(file);
  }

  // ---------- data tools: CSV / XLSX (via SheetJS) ----------
  const SHEET_NAME = 'สมุดออมเงิน';
  const HEADER_ROW = ['เดือน (YYYY-MM)', 'เงินเดือน', 'วันที่ออม (YYYY-MM-DD)', 'จำนวนเงิน'];

  function baseFilename(){
    const raw = (state.settings.name || '').trim();
    const safe = raw.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
    return 'savings-passbook-' + (safe || 'data');
  }
  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function checkSheetLib(){
    if(typeof XLSX === 'undefined'){
      showAppAlert('ไม่สามารถโหลดไลบรารีสำหรับไฟล์ CSV/Excel ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');
      return false;
    }
    return true;
  }
  function buildSheetAOA(){
    const rows = [];
    rows.push(['ชื่อสมุด', state.settings.name || '']);
    rows.push(['เปอร์เซ็นต์', state.settings.percent]);
    rows.push([]);
    rows.push(HEADER_ROW);
    Object.keys(state.months).sort().forEach(key=>{
      const m = state.months[key];
      const salary = (isFinite(m.salary) && m.salary !== null) ? m.salary : '';
      if(m.records && m.records.length){
        m.records.forEach((r, idx)=>{
          rows.push([key, idx === 0 ? salary : '', r.date, r.amount]);
        });
      } else {
        rows.push([key, salary, '', '']);
      }
    });
    return rows;
  }
  function exportSheet(bookType){
    if(!checkSheetLib()) return;
    const ws = XLSX.utils.aoa_to_sheet(buildSheetAOA());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
    XLSX.writeFile(wb, baseFilename() + '.' + bookType, { bookType });
  }
  function excelSerialToIso(serial){
    const parsed = XLSX.SSF && XLSX.SSF.parse_date_code ? XLSX.SSF.parse_date_code(serial) : null;
    if(!parsed) return todayIso();
    return parsed.y + '-' + String(parsed.m).padStart(2,'0') + '-' + String(parsed.d).padStart(2,'0');
  }
  function parseSheetAOA(aoa){
    let name = '', percent = 10, headerIdx = -1;
    for(let i=0;i<aoa.length;i++){
      const row = aoa[i];
      if(!row || row.length === 0) continue;
      const c0 = String(row[0]).trim();
      if(c0 === 'ชื่อสมุด'){ name = row[1] != null ? String(row[1]) : ''; }
      else if(c0 === 'เปอร์เซ็นต์'){ const p = parseFloat(row[1]); if(isFinite(p) && p > 0) percent = p; }
      else if(c0.indexOf('เดือน') === 0){ headerIdx = i; break; }
    }
    if(headerIdx === -1) throw new Error('ไม่พบหัวตารางในไฟล์ (ต้องมีคอลัมน์ที่ขึ้นต้นด้วย "เดือน")');

    const months = {};
    for(let i=headerIdx+1;i<aoa.length;i++){
      const row = aoa[i];
      if(!row || row.length === 0) continue;
      const key = String(row[0] || '').trim();
      if(!/^\d{4}-\d{2}$/.test(key)) continue;
      if(!months[key]) months[key] = { salary:null, records:[] };

      const salaryVal = row[1];
      if(salaryVal !== '' && salaryVal !== undefined && salaryVal !== null && isFinite(parseFloat(salaryVal))){
        months[key].salary = parseFloat(salaryVal);
      }
      const dateVal = row[2];
      const amtVal = row[3];
      if(dateVal !== '' && dateVal !== undefined && dateVal !== null &&
         amtVal !== '' && amtVal !== undefined && amtVal !== null && isFinite(parseFloat(amtVal))){
        const dateStr = (typeof dateVal === 'number') ? excelSerialToIso(dateVal) : String(dateVal).trim();
        months[key].records.push({ date: dateStr, amount: parseFloat(amtVal) });
      }
    }
    return { settings: { name, percent }, months };
  }
  function importSheetFile(file){
    if(!checkSheetLib()) return;
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type:'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:true });
        const { settings, months } = parseSheetAOA(aoa);
        applyImportedState(settings, months);
      }catch(err){
        showAppAlert('ไม่สามารถนำเข้าไฟล์ได้: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  $('exportCsvBtn').addEventListener('click', ()=> exportSheet('csv'));
  $('exportXlsxBtn').addEventListener('click', ()=> exportSheet('xlsx'));

  $('importBtn').addEventListener('click', ()=>{
    $('importFile').click();
  });
  $('importFile').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if(ext === 'json') importJsonFile(file);
    else if(ext === 'csv' || ext === 'xlsx') importSheetFile(file);
    else showAppAlert('รองรับเฉพาะไฟล์ .json, .csv, .xlsx เท่านั้น');
    e.target.value = '';
  });

  $('resetBtn').addEventListener('click', async ()=>{
    const ok = await showAppConfirm('ล้างข้อมูลทั้งหมด (การตั้งค่าและประวัติการออมทุกเดือน) ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้');
    if(ok){
      state = { settings:{name:'', percent:10}, months:{} };
      save();
      renderSettings();
      const today = todayIso().slice(0,7);
      populateDropdowns(today);
      renderMonthCard();
      renderSummaryAndLists();
    }
  });

  // ---------- init ----------
  function init(){
    load();
    renderSettings();
    const today = todayIso().slice(0,7);
    populateDropdowns(today);
    $('recordDate').value = todayIso();
    renderMonthCard();
    renderSummaryAndLists();
    initTabNav();
  }
  init();

  // ---------- PWA: register service worker (requires http/https, not file://) ----------
  if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('sw.js').catch(()=>{ /* silent: offline install just won't be available */ });
    });
  }
})();
