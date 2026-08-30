(function(){
  const LS_KEY = 'savingsPassbookData_v2';
  const fmt = n => '฿' + (isFinite(n) ? Math.round(n) : 0).toLocaleString('th-TH');
  const fmtNum = n => (isFinite(n) ? Math.round(n) : 0).toLocaleString('th-TH');
  const fmtDate = iso => {
    if(!iso) return '-';
    const d = new Date(iso+'T00:00:00');
    return d.toLocaleDateString('th-TH', {day:'2-digit', month:'short', year:'2-digit'});
  };
  const todayIso = () => new Date().toISOString().slice(0,10);

  // entries[periodIndex] = { salary: number|null, records: [{date, amount}] }
  let state = { goal: null, entries: {} };
  let schedule = [];
  let currentModalPeriod = null;
  let chartInstance = null;

  // ---------- persistence ----------
  function load(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && typeof parsed === 'object'){
          state.goal = parsed.goal || null;
          state.entries = parsed.entries || {};
          // normalize old-format entries (single actual) into records array if present
          Object.keys(state.entries).forEach(k => {
            const e = state.entries[k];
            if(e && !Array.isArray(e.records)){
              e.records = (isFinite(e.actual) && e.actual !== null)
                ? [{ date: e.date || todayIso(), amount: Number(e.actual) }]
                : [];
              delete e.actual;
              delete e.date;
            }
          });
        }
      }
    }catch(e){ console.error('โหลดข้อมูลไม่สำเร็จ', e); }
  }
  function save(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch(e){ console.error('บันทึกข้อมูลไม่สำเร็จ', e); }
  }

  // ---------- schedule generation ----------
  function generateSchedule(goal){
    const out = [];
    if(!goal || !goal.start || !goal.end) return out;
    const start = new Date(goal.start+'T00:00:00');
    const end = new Date(goal.end+'T00:00:00');
    if(!(end > start)) return out;
    let cursor = new Date(start);
    let idx = 1;
    while(cursor < end && idx <= 1000){
      let due = new Date(cursor);
      if(goal.freq === 'weekly'){ due.setDate(due.getDate()+7); }
      else { due.setMonth(due.getMonth()+1); }
      if(due > end) due = new Date(end);
      out.push({ index: idx, due: due.toISOString().slice(0,10) });
      cursor = due;
      idx++;
      if(due.getTime() === end.getTime()) break;
    }
    return out;
  }

  function bookNumberFromStart(startIso){
    if(!startIso) return '—';
    return startIso.replace(/-/g,'');
  }

  function periodRecords(index){
    const e = state.entries[index];
    return e && Array.isArray(e.records) ? e.records : [];
  }
  function periodActual(index){
    return periodRecords(index).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }
  function totalSaved(){
    let sum = 0;
    Object.keys(state.entries).forEach(k => { sum += periodActual(k); });
    return sum;
  }

  // ---------- rendering: goal form ----------
  function renderGoalForm(){
    const g = state.goal;
    document.getElementById('goalError').style.display = 'none';
    if(g){
      document.getElementById('goalName').value = g.name;
      document.getElementById('goalTarget').value = g.target;
      document.getElementById('goalStart').value = g.start;
      document.getElementById('goalEnd').value = g.end;
      document.getElementById('goalFreq').value = g.freq;
      document.getElementById('goalPercent').value = g.percent;
      setFormDisabled(true);
      document.getElementById('editGoalBtn').classList.remove('hidden');
      document.getElementById('saveGoalBtn').textContent = 'อัปเดตแผน';
    } else {
      setFormDisabled(false);
      document.getElementById('editGoalBtn').classList.add('hidden');
      document.getElementById('saveGoalBtn').textContent = 'บันทึกแผนการออม';
    }
  }
  function setFormDisabled(disabled){
    ['goalName','goalTarget','goalStart','goalEnd','goalFreq','goalPercent'].forEach(id=>{
      document.getElementById(id).disabled = disabled;
    });
  }

  // ---------- main render ----------
  function renderAll(){
    const g = state.goal;
    renderGoalForm();
    document.getElementById('bookNumber').textContent = g ? ('เล่มที่ ' + bookNumberFromStart(g.start)) : 'เล่มที่ —';

    const hasGoal = !!g;
    ['summaryCard','ledgerCard','overviewCard','chartCard','dataCard'].forEach(id=>{
      document.getElementById(id).classList.toggle('hidden', !hasGoal);
    });
    if(!hasGoal) return;

    schedule = generateSchedule(g);
    const perPeriod = schedule.length ? g.target / schedule.length : 0;
    const saved = totalSaved();
    const doneCount = schedule.filter(p => periodRecords(p.index).length > 0).length;
    const remainAmt = Math.max(g.target - saved, 0);
    const today = todayIso();

    document.getElementById('sumSaved').textContent = fmt(saved);
    document.getElementById('sumTarget').textContent = fmt(g.target);
    document.getElementById('statPerPeriod').textContent = fmt(perPeriod);
    document.getElementById('statPeriodsLeft').textContent = Math.max(schedule.length - doneCount, 0);
    document.getElementById('statDone').textContent = doneCount + ' / ' + schedule.length;
    document.getElementById('statRemainAmt').textContent = fmt(remainAmt);

    const pct = g.target > 0 ? Math.min(100, (saved / g.target) * 100) : 0;
    document.getElementById('progressFill').style.width = pct.toFixed(1) + '%';

    const pill = document.getElementById('statusPill');
    if(saved >= g.target){
      pill.textContent = 'ออมครบเป้าหมายแล้ว 🎉';
      pill.className = 'status-pill status-done';
    } else {
      const dueSoFar = schedule.filter(p => p.due <= today).length;
      const plannedToDate = perPeriod * dueSoFar;
      if(saved + 0.01 >= plannedToDate){
        pill.textContent = 'ออมตามแผน ทันเวลา';
        pill.className = 'status-pill status-ontrack';
      } else {
        pill.textContent = 'ออมช้ากว่าแผนเล็กน้อย';
        pill.className = 'status-pill status-behind';
      }
    }

    renderLedger(perPeriod);
    renderOverview(perPeriod);
    renderChart(perPeriod);
  }

  function renderLedger(perPeriod){
    const body = document.getElementById('ledgerBody');
    body.innerHTML = '';
    if(schedule.length === 0){
      body.innerHTML = '<div class="empty-note">ยังไม่มีงวด กรุณาตรวจสอบวันที่เริ่ม/สิ้นสุด</div>';
      return;
    }
    let cum = 0;
    schedule.forEach(p => {
      const actual = periodActual(p.index);
      const hasRecords = periodRecords(p.index).length > 0;
      cum += actual;

      const row = document.createElement('div');
      row.className = 'ledger-row';
      row.innerHTML = `
        <div class="idx">#${String(p.index).padStart(2,'0')}</div>
        <div class="due">${fmtDate(p.due)}<span class="plan">แผน ${fmt(perPeriod)}</span></div>
        <div class="amt">
          <span class="actual">${hasRecords ? fmt(actual) : '—'}</span>
          <span class="cum">สะสม ${fmt(cum)}</span>
        </div>
        <div></div>
      `;
      const chkWrap = document.createElement('div');
      const chk = document.createElement('button');
      chk.className = 'chk' + (hasRecords ? ' done' : '');
      chk.setAttribute('aria-label', hasRecords ? 'ดู/แก้ไขงวดนี้' : 'บันทึกงวดนี้');
      chk.textContent = hasRecords ? '✓' : '';
      chk.addEventListener('click', () => openRecordModal(p));
      chkWrap.appendChild(chk);
      row.lastElementChild.replaceWith(chkWrap);
      body.appendChild(row);
    });
  }

  function renderOverview(perPeriod){
    const tbody = document.getElementById('overviewTableBody');
    if(schedule.length === 0){
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--muted);">ยังไม่มีข้อมูล</td></tr>';
      return;
    }
    let html = '';
    schedule.forEach(p => {
      const actual = periodActual(p.index);
      const percent = perPeriod > 0 ? (actual / perPeriod) * 100 : 0;
      html += `
        <tr>
          <td>#${String(p.index).padStart(2,'0')} · ${fmtDate(p.due)}</td>
          <td class="text-right">${fmtNum(perPeriod)}</td>
          <td class="text-right">${fmtNum(actual)}</td>
          <td class="text-right">${Math.round(percent)}%</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  function renderChart(perPeriod){
    const canvas = document.getElementById('chartCanvas');
    if(!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    const labels = schedule.map(p => '#' + p.index);
    const targets = schedule.map(() => Math.round(perPeriod));
    const actuals = schedule.map(p => Math.round(periodActual(p.index)));

    if(chartInstance){ chartInstance.destroy(); }
    if(schedule.length === 0){ chartInstance = null; return; }

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'แผน',
            data: targets,
            backgroundColor: 'rgba(184,137,43,0.55)',
            borderColor: '#B8892B',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'ออมจริง',
            data: actuals,
            backgroundColor: 'rgba(27,67,50,0.65)',
            borderColor: '#1B4332',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => v.toLocaleString('th-TH') + ' บาท' }
          }
        }
      }
    });
  }

  // ---------- goal form actions ----------
  document.getElementById('saveGoalBtn').addEventListener('click', () => {
    const name = document.getElementById('goalName').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);
    const start = document.getElementById('goalStart').value;
    const end = document.getElementById('goalEnd').value;
    const freq = document.getElementById('goalFreq').value;
    const percent = parseFloat(document.getElementById('goalPercent').value) || 10;

    const errBox = document.getElementById('goalError');
    if(!name || !isFinite(target) || target <= 0 || !start || !end){
      errBox.textContent = 'กรุณากรอกข้อมูลให้ครบและยอดเป้าหมายต้องมากกว่า 0';
      errBox.style.display = 'block';
      return;
    }
    if(new Date(end) <= new Date(start)){
      errBox.textContent = 'วันที่ครบกำหนดต้องอยู่หลังวันที่เริ่มออม';
      errBox.style.display = 'block';
      return;
    }
    errBox.style.display = 'none';
    state.goal = { name, target, start, end, freq, percent };
    save();
    renderAll();
  });

  document.getElementById('editGoalBtn').addEventListener('click', () => {
    setFormDisabled(false);
    document.getElementById('editGoalBtn').classList.add('hidden');
    document.getElementById('saveGoalBtn').textContent = 'อัปเดตแผน';
  });

  // ---------- record modal ----------
  function openRecordModal(period){
    currentModalPeriod = period;
    const e = state.entries[period.index];
    document.getElementById('modalTitle').textContent = 'งวดที่ ' + period.index;
    document.getElementById('modalSub').textContent = 'ครบกำหนด ' + fmtDate(period.due);
    document.getElementById('salaryInput').value = e && isFinite(e.salary) ? e.salary : '';
    document.getElementById('pctLabel').textContent = state.goal.percent;
    document.getElementById('recordDate').value = todayIso();
    document.getElementById('recordAmount').value = '';
    updateSuggestBox();
    renderRecordList();
    document.getElementById('recordOverlay').classList.add('open');
  }
  function closeModal(){
    document.getElementById('recordOverlay').classList.remove('open');
    currentModalPeriod = null;
    renderAll();
  }
  function updateSuggestBox(){
    const salary = parseFloat(document.getElementById('salaryInput').value);
    const box = document.getElementById('suggestBox');
    const pct = state.goal ? state.goal.percent : 10;
    if(isFinite(salary) && salary > 0){
      const suggested = salary * (pct/100);
      box.innerHTML = 'ยอดแนะนำจากเงินเดือน (' + pct + '%): <b class="mono">' + fmt(suggested) + '</b>';
    } else {
      box.innerHTML = 'กรอกเงินเดือนเพื่อดูยอดแนะนำ (<span id="pctLabel">'+pct+'</span>%)';
    }
  }
  function ensureEntry(index){
    if(!state.entries[index]) state.entries[index] = { salary: null, records: [] };
    if(!Array.isArray(state.entries[index].records)) state.entries[index].records = [];
    return state.entries[index];
  }
  function renderRecordList(){
    if(!currentModalPeriod) return;
    const list = document.getElementById('recordList');
    const records = periodRecords(currentModalPeriod.index);
    if(records.length === 0){
      list.innerHTML = '<div class="empty-msg">ยังไม่มีรายการในงวดนี้</div>';
      return;
    }
    const sorted = records.map((r, i) => ({...r, i})).sort((a,b) => b.date.localeCompare(a.date));
    list.innerHTML = sorted.map(r => `
      <div class="record-item">
        <span>${fmtDate(r.date)} &nbsp;→&nbsp; <span class="amt-txt">${fmtNum(r.amount)} บาท</span></span>
        <button class="del-btn" data-idx="${r.i}" aria-label="ลบรายการ">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const entry = ensureEntry(currentModalPeriod.index);
        if(confirm('ลบรายการนี้ใช่ไหม?')){
          entry.records.splice(idx, 1);
          save();
          renderRecordList();
        }
      });
    });
  }

  document.getElementById('salaryInput').addEventListener('input', () => {
    updateSuggestBox();
    if(currentModalPeriod){
      const entry = ensureEntry(currentModalPeriod.index);
      const val = parseFloat(document.getElementById('salaryInput').value);
      entry.salary = isFinite(val) ? val : null;
      save();
    }
  });

  document.getElementById('addRecordBtn').addEventListener('click', () => {
    if(!currentModalPeriod) return;
    const date = document.getElementById('recordDate').value || todayIso();
    const amount = parseFloat(document.getElementById('recordAmount').value);
    if(!isFinite(amount) || amount <= 0){
      alert('กรุณากรอกจำนวนเงินที่ถูกต้อง (มากกว่า 0)');
      return;
    }
    const entry = ensureEntry(currentModalPeriod.index);
    entry.records.push({ date, amount });
    save();
    document.getElementById('recordAmount').value = '';
    renderRecordList();
    playStampAnimation();
  });

  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('recordOverlay').addEventListener('click', (e) => {
    if(e.target.id === 'recordOverlay') closeModal();
  });

  function playStampAnimation(){
    const wrap = document.createElement('div');
    wrap.className = 'stamp-anim';
    wrap.innerHTML = '<div class="stamp-mark">ออมแล้ว<br>' + new Date().toLocaleDateString('th-TH') + '</div>';
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 650);
  }

  // ---------- data tools ----------
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'savings-passbook-' + (state.goal ? state.goal.name.replace(/\s+/g,'_') : 'data') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(reader.result);
        if(!parsed || typeof parsed !== 'object' || !('goal' in parsed) || !('entries' in parsed)){
          throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
        }
        if(confirm('นำเข้าไฟล์นี้จะแทนที่ข้อมูลปัจจุบันทั้งหมด ยืนยันหรือไม่?')){
          state.goal = parsed.goal || null;
          state.entries = parsed.entries || {};
          Object.keys(state.entries).forEach(k => {
            const en = state.entries[k];
            if(en && !Array.isArray(en.records)) en.records = [];
          });
          save();
          renderAll();
        }
      }catch(err){
        alert('ไม่สามารถนำเข้าไฟล์ได้: ไฟล์อาจเสียหายหรือไม่ใช่ไฟล์ที่ส่งออกจากแอปนี้');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if(confirm('ล้างข้อมูลทั้งหมด (แผนและประวัติการออม) ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')){
      state = { goal:null, entries:{} };
      save();
      document.getElementById('goalName').value = '';
      document.getElementById('goalTarget').value = '';
      document.getElementById('goalStart').value = '';
      document.getElementById('goalEnd').value = '';
      document.getElementById('goalFreq').value = 'monthly';
      document.getElementById('goalPercent').value = 10;
      renderAll();
    }
  });

  // ---------- init ----------
  load();
  renderAll();
})();
