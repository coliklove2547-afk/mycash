(function(){
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
    return document.getElementById('monthSelect').value;
  }
  function populateDropdowns(selectedMonth){
    const yearSelect = document.getElementById('yearSelect');
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
    const monthSelect = document.getElementById('monthSelect');
    const year = parseInt(document.getElementById('yearSelect').value,10);
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
    document.getElementById('goalName').value = state.settings.name || '';
    document.getElementById('goalPercent').value = state.settings.percent;
    document.getElementById('pctLabel').textContent = state.settings.percent;
    document.getElementById('coverTitle').textContent = state.settings.name || 'สมุดบัญชีออมทรัพย์';
    const keys = activeMonthKeys();
    document.getElementById('bookNumber').textContent = keys.length
      ? ('เล่มที่ ' + keys[0].replace('-',''))
      : 'เล่มที่ —';
  }

  function renderMonthCard(){
    const key = currentMonthKey();
    const m = state.months[key];
    document.getElementById('salaryInput').value = (m && isFinite(m.salary) && m.salary !== null) ? m.salary : '';
    updateSuggestBox();
    renderRecordList();
  }

  function updateSuggestBox(){
    const salary = parseFloat(document.getElementById('salaryInput').value);
    const box = document.getElementById('suggestBox');
    const pct = state.settings.percent;
    if(isFinite(salary) && salary > 0){
      const suggested = salary * (pct/100);
      box.innerHTML = 'เป้าหมายของเดือนนี้ (' + pct + '%): <b class="mono">' + fmt(suggested) + '</b>';
    } else {
      box.innerHTML = 'กรอกเงินเดือนเพื่อดูเป้าหมายของเดือนนี้ (<span id="pctLabel">'+pct+'</span>%)';
    }
  }

  function renderRecordList(){
    const key = currentMonthKey();
    const list = document.getElementById('recordList');
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
      btn.addEventListener('click', ()=>{
        if(confirm('ลบรายการนี้ใช่ไหม?')){
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
    const hasAny = keys.length > 0;
    ['summaryCard','ledgerCard','overviewCard','chartCard'].forEach(id=>{
      document.getElementById(id).classList.toggle('hidden', !hasAny);
    });
    if(!hasAny) return;

    const target = totalTarget();
    const saved = totalSaved();
    const remain = target - saved;

    document.getElementById('sumSaved').textContent = fmt(saved);
    document.getElementById('sumTarget').textContent = fmt(target);
    document.getElementById('statMonthsCount').textContent = keys.length;
    document.getElementById('statRemainAmt').textContent = (remain >= 0 ? fmt(remain) : ('เกิน ' + fmt(-remain)));

    const pctBar = target > 0 ? Math.min(100, (saved/target)*100) : 0;
    document.getElementById('progressFill').style.width = pctBar.toFixed(1) + '%';

    const pill = document.getElementById('statusPill');
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
    const body = document.getElementById('ledgerBody');
    body.innerHTML = '';
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
    const tbody = document.getElementById('overviewTableBody');
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
    const canvas = document.getElementById('chartCanvas');
    if(!canvas || typeof Chart === 'undefined') return;
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
    document.getElementById('yearSelect').value = y;
    populateMonths(key);
    renderMonthCard();
    window.scrollTo({ top: document.getElementById('salaryInput').closest('.card').offsetTop - 12, behavior:'smooth' });
  }

  // ---------- events ----------
  document.getElementById('saveSettingsBtn').addEventListener('click', ()=>{
    const name = document.getElementById('goalName').value.trim();
    const percent = parseFloat(document.getElementById('goalPercent').value);
    state.settings.name = name;
    state.settings.percent = (isFinite(percent) && percent > 0) ? percent : 10;
    save();
    renderSettings();
    renderMonthCard();
    renderSummaryAndLists();
  });

  document.getElementById('yearSelect').addEventListener('change', ()=>{
    const sel = document.getElementById('monthSelect').value;
    populateMonths(sel);
    renderMonthCard();
  });
  document.getElementById('monthSelect').addEventListener('change', renderMonthCard);

  document.getElementById('salaryInput').addEventListener('input', updateSuggestBox);

  document.getElementById('saveSalaryBtn').addEventListener('click', ()=>{
    const key = currentMonthKey();
    const val = parseFloat(document.getElementById('salaryInput').value);
    if(!isFinite(val) || val < 0){
      alert('กรุณากรอกเงินเดือนที่ถูกต้อง');
      return;
    }
    const m = ensureMonth(key);
    m.salary = val;
    save();
    populateMonths(key);
    renderSummaryAndLists();
  });

  document.getElementById('deleteMonthBtn').addEventListener('click', ()=>{
    const key = currentMonthKey();
    if(!hasData(key)){
      alert('เดือนนี้ยังไม่มีข้อมูลให้ลบ');
      return;
    }
    if(confirm('ลบข้อมูลเดือน ' + monthLabel(key) + ' ทั้งหมดใช่ไหม?')){
      delete state.months[key];
      save();
      populateMonths(key);
      renderMonthCard();
      renderSummaryAndLists();
    }
  });

  document.getElementById('addRecordBtn').addEventListener('click', ()=>{
    const key = currentMonthKey();
    const date = document.getElementById('recordDate').value || todayIso();
    const amount = parseFloat(document.getElementById('recordAmount').value);
    if(!isFinite(amount) || amount <= 0){
      alert('กรุณากรอกจำนวนเงินที่ถูกต้อง (มากกว่า 0)');
      return;
    }
    const m = ensureMonth(key);
    m.records.push({ date, amount });
    save();
    document.getElementById('recordAmount').value = '';
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

  // ---------- refresh ----------
  document.getElementById('refreshBtn').addEventListener('click', ()=>{
    const sel = currentMonthKey();
    load();
    renderSettings();
    populateDropdowns(sel);
    renderMonthCard();
    renderSummaryAndLists();
  });

  // ---------- data tools: JSON ----------
  document.getElementById('exportJsonBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    downloadBlob(blob, baseFilename() + '.json');
  });

  function applyImportedState(newSettings, newMonths){
    if(confirm('นำเข้าไฟล์นี้จะแทนที่ข้อมูลปัจจุบันทั้งหมด ยืนยันหรือไม่?')){
      state.settings = Object.assign({name:'', percent:10}, newSettings || {});
      state.months = newMonths || {};
      Object.keys(state.months).forEach(k=>{
        if(!Array.isArray(state.months[k].records)) state.months[k].records = [];
      });
      save();
      const sel = document.getElementById('monthSelect').value;
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
        alert('ไม่สามารถนำเข้าไฟล์ JSON ได้: ไฟล์อาจเสียหายหรือไม่ใช่ไฟล์ที่ส่งออกจากแอปนี้');
      }
    };
    reader.readAsText(file);
  }

  // ---------- data tools: CSV / XLSX (via SheetJS) ----------
  const SHEET_NAME = 'สมุดออมเงิน';
  const HEADER_ROW = ['เดือน (YYYY-MM)', 'เงินเดือน', 'วันที่ออม (YYYY-MM-DD)', 'จำนวนเงิน'];

  function baseFilename(){
    return 'savings-passbook-' + (state.settings.name ? state.settings.name.replace(/\s+/g,'_') : 'data');
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
      alert('ไม่สามารถโหลดไลบรารีสำหรับไฟล์ CSV/Excel ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');
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
        alert('ไม่สามารถนำเข้าไฟล์ได้: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  document.getElementById('exportCsvBtn').addEventListener('click', ()=> exportSheet('csv'));
  document.getElementById('exportXlsxBtn').addEventListener('click', ()=> exportSheet('xlsx'));

  document.getElementById('importBtn').addEventListener('click', ()=>{
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if(ext === 'json') importJsonFile(file);
    else if(ext === 'csv' || ext === 'xlsx') importSheetFile(file);
    else alert('รองรับเฉพาะไฟล์ .json, .csv, .xlsx เท่านั้น');
    e.target.value = '';
  });

  document.getElementById('resetBtn').addEventListener('click', ()=>{
    if(confirm('ล้างข้อมูลทั้งหมด (การตั้งค่าและประวัติการออมทุกเดือน) ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')){
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
    document.getElementById('recordDate').value = todayIso();
    renderMonthCard();
    renderSummaryAndLists();
  }
  init();
})();
