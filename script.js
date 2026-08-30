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

  // ---------- data tools ----------
  document.getElementById('exportBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'savings-passbook-' + (state.settings.name ? state.settings.name.replace(/\s+/g,'_') : 'data') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('importBtn').addEventListener('click', ()=>{
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const parsed = JSON.parse(reader.result);
        if(!parsed || typeof parsed !== 'object' || !('months' in parsed)){
          throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
        }
        if(confirm('นำเข้าไฟล์นี้จะแทนที่ข้อมูลปัจจุบันทั้งหมด ยืนยันหรือไม่?')){
          state.settings = Object.assign({name:'', percent:10}, parsed.settings || {});
          state.months = parsed.months || {};
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
      }catch(err){
        alert('ไม่สามารถนำเข้าไฟล์ได้: ไฟล์อาจเสียหายหรือไม่ใช่ไฟล์ที่ส่งออกจากแอปนี้');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
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
