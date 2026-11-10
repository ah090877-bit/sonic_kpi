// ★ 기존에 쓰시던 URL 유지하세요!
const API_URL = 'https://script.google.com/macros/s/AKfycbxoRToFFWcjmzjxxYkvPHourAy9C3FxTBWzoASIgiKBWkyofecavJCVyCo8hRy306gq/exec';

let rawData = [];
let chartInstances = {};
const state = { year: 'All', month: 'All', hq: 'All', team: 'All' };

const formatMoney = (val) => val.toLocaleString('ko-KR');

function fetchData() {
  document.getElementById('loader').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  fetch(API_URL).then(res => res.json()).then(data => initApp(data)).catch(err => alert("데이터 에러: " + err));
}

function initApp(response) {
  if (!response.success) { alert("오류: " + response.error); return; }
  
  // ★ 요청사항: '화주공통비'는 화주사별 분석에서 완전히 제외합니다.
  rawData = response.data.filter(d => d.client !== '화주공통비');
  
  const years = [...new Set(rawData.map(d => d.y))].sort((a,b)=>b-a);
  if(years.length > 0) state.year = years[0].toString();
  
  buildTopFilters(); 
  updateDashboard();
  
  document.getElementById('loader').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

function buildTopFilters() {
  const filterDataFor = (skipKey) => rawData.filter(d => {
    if (skipKey !== 'year' && state.year !== 'All' && String(d.y) !== state.year) return false;
    if (skipKey !== 'month' && state.month !== 'All' && String(d.m) !== state.month) return false;
    if (skipKey !== 'hq' && state.hq !== 'All' && d.hq !== state.hq) return false;
    if (skipKey !== 'team' && state.team !== 'All' && d.team !== state.team) return false;
    return true;
  });
  
  populateSelect('f-year', [...new Set(filterDataFor('year').map(d => d.y))].sort((a,b)=>b-a), state.year, false);
  populateSelect('f-month', [...new Set(filterDataFor('month').map(d => d.m))].sort((a,b)=>a-b), state.month, true);
  populateSelect('f-hq', [...new Set(filterDataFor('hq').map(d => d.hq))].sort(), state.hq, true);
  populateSelect('f-team', [...new Set(filterDataFor('team').map(d => d.team))].sort(), state.team, true);
}

function populateSelect(id, options, selected, addAll) {
  const el = document.getElementById(id);
  const key = id.replace('f-', '');
  let currentVal = selected;
  if (currentVal !== 'All' && !options.includes(currentVal) && !options.includes(Number(currentVal))) {
    currentVal = addAll ? 'All' : (options.length > 0 ? options[0] : ''); 
    state[key] = currentVal; 
  }
  el.innerHTML = addAll ? '<option value="All">전체</option>' : '';
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt; option.text = (id === 'f-month') ? opt + '월' : opt;
    if (String(opt) === String(currentVal)) option.selected = true;
    el.appendChild(option);
  });
  el.onchange = (e) => {
    state[key] = e.target.value;
    if (key === 'year') { state.month = 'All'; state.hq = 'All'; state.team = 'All'; }
    else if (key === 'month') { state.hq = 'All'; state.team = 'All'; }
    else if (key === 'hq') { state.team = 'All'; }
    buildTopFilters(); updateDashboard();
  };
}

// 🌟 메인 화면: 화주사 카드 그리기
function updateDashboard() {
  const currYear = parseInt(state.year);
  const container = document.getElementById('card-container');
  container.innerHTML = '';

  const currData = rawData.filter(d => {
    if (d.y !== currYear) return false;
    if (state.month !== 'All' && String(d.m) !== state.month) return false;
    if (state.hq !== 'All' && d.hq !== state.hq) return false;
    if (state.team !== 'All' && d.team !== state.team) return false;
    return true;
  });

  const summary = {};
  currData.forEach(d => {
    const key = `${d.hq}|${d.team}|${d.client}`;
    if (!summary[key]) summary[key] = { hq: d.hq, team: d.team, client: d.client, revTrans: 0, revLease: 0, varC: 0, fixC: 0 };
    
    if (d.type === '매출') { if (d.subject === '지입료수입') summary[key].revLease += d.amt; else summary[key].revTrans += d.amt; }
    else if (d.type === '변동원가') summary[key].varC += d.amt;
    else if (d.type === '고정원가') summary[key].fixC += d.amt;
  });

  Object.values(summary).sort((a,b) => (b.revTrans + b.revLease) - (a.revTrans + a.revLease)).forEach(row => {
    const totalRev = row.revTrans + row.revLease;
    if (totalRev === 0 && row.varC === 0 && row.fixC === 0) return;

    const cm = totalRev - row.varC;
    const cmRatio = totalRev === 0 ? 0 : (cm / totalRev) * 100;
    const gp = cm - row.fixC;
    const gpRatio = totalRev === 0 ? 0 : (gp / totalRev) * 100;

    const card = document.createElement('div');
    card.className = 'client-card';
    card.onclick = () => openModal(row.hq, row.team, row.client);
    
    // 첨부 이미지와 완벽히 동일한 표 렌더링
    card.innerHTML = `
      <div class="card-header">
        ${row.client}
        <div class="card-team-label">(${row.team})</div>
      </div>
      <table class="card-table">
        <tr><th>매출_운송수입</th><td>${formatMoney(row.revTrans)}</td></tr>
        <tr class="row-blue"><th>매출_지입료수입</th><td>${formatMoney(row.revLease)}</td></tr>
        <tr class="row-yellow"><th>변동원가</th><td>${formatMoney(row.varC)}</td></tr>
        <tr><th>공헌이익</th><td class="${cm < 0 ? 'txt-red' : ''}">${formatMoney(cm)}</td></tr>
        <tr><th>공헌이익율</th><td class="${cmRatio < 0 ? 'txt-red' : ''}">${cmRatio.toFixed(2)}%</td></tr>
        <tr class="row-yellow"><th>고정원가</th><td>${formatMoney(row.fixC)}</td></tr>
        <tr class="row-bold"><th>매출이익</th><td class="${gp < 0 ? 'txt-red' : ''}">${formatMoney(gp)}</td></tr>
        <tr class="row-bold"><th>매출이익율</th><td class="${gpRatio < 0 ? 'txt-red' : ''}">${gpRatio.toFixed(2)}%</td></tr>
      </table>
    `;
    container.appendChild(card);
  });
}

// 🌟 화주사 카드 클릭 시 팝업 띄우기
function openModal(hq, team, client) {
  const currYear = parseInt(state.year);
  
  document.getElementById('modal-title').innerText = client;
  document.getElementById('modal-subtitle').innerText = `${hq} / ${team} / ${currYear}년 ${state.month === 'All' ? '전체' : state.month+'월'} 실적`;
  
  // 모달용 데이터 (선택한 화주사/팀 고정)
  const mCurrData = rawData.filter(d => d.y === currYear && d.hq === hq && d.team === team && d.client === client && (state.month === 'All' || String(d.m) === state.month));
  const mPrevData = rawData.filter(d => d.y === currYear - 1 && d.hq === hq && d.team === team && d.client === client && (state.month === 'All' || String(d.m) === state.month));
  
  let currRev = 0, currVar = 0, currFix = 0;
  mCurrData.forEach(d => { if(d.type==='매출') currRev+=d.amt; else if(d.type==='변동원가') currVar+=d.amt; else if(d.type==='고정원가') currFix+=d.amt; });
  const currCm = currRev - currVar;
  const currGp = currCm - currFix;
  
  let prevRev = 0, prevVar = 0, prevFix = 0;
  mPrevData.forEach(d => { if(d.type==='매출') prevRev+=d.amt; else if(d.type==='변동원가') prevVar+=d.amt; else if(d.type==='고정원가') prevFix+=d.amt; });
  const prevGp = (prevRev - prevVar) - prevFix;

  document.getElementById('m-kpi-rev').innerText = formatMoney(currRev);
  document.getElementById('m-kpi-cm').innerText = formatMoney(currCm);
  document.getElementById('m-kpi-cm-rate').innerText = currRev === 0 ? '0%' : (currCm/currRev*100).toFixed(1)+'%';
  document.getElementById('m-kpi-gp').innerText = formatMoney(currGp);
  document.getElementById('m-kpi-gp-rate').innerText = currRev === 0 ? '0%' : (currGp/currRev*100).toFixed(1)+'%';
  
  applyYoYBadge('m-kpi-yoy-rev', currRev, prevRev);
  applyYoYBadge('m-kpi-yoy-gp', currGp, prevGp);

  // 모달 차트: 해당 화주사의 1년치 월별 데이터 추출
  const annualCurr = rawData.filter(d => d.y === currYear && d.hq === hq && d.team === team && d.client === client);
  const annualPrev = rawData.filter(d => d.y === currYear - 1 && d.hq === hq && d.team === team && d.client === client);
  
  const m1Rev = Array(12).fill(0), m1CM = Array(12).fill(0), m1GP = Array(12).fill(0);
  annualCurr.forEach(d => { const i = d.m-1; if(d.type==='매출'){ m1Rev[i]+=d.amt; m1CM[i]+=d.amt; m1GP[i]+=d.amt; } else if(d.type==='변동원가'){ m1CM[i]-=d.amt; m1GP[i]-=d.amt; } else if(d.type==='고정원가') m1GP[i]-=d.amt; });
  
  const m2Rev = Array(12).fill(0);
  annualPrev.forEach(d => { if(d.type==='매출') m2Rev[d.m-1]+=d.amt; });

  Chart.defaults.font.family = "'Malgun Gothic', sans-serif";
  const render = (id, type, dts, opt) => {
    if (chartInstances[id]) chartInstances[id].destroy();
    chartInstances[id] = new Chart(document.getElementById(id), { type, data: dts, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, ...opt } });
  };

  render('modal-chart-trend', 'line', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [
      { label: '매출', data: m1Rev, borderColor: '#777', backgroundColor: '#777', tension: 0.3, borderDash: [5,5] },
      { label: '공헌이익', data: m1CM, borderColor: '#00A6B2', backgroundColor: '#00A6B2', tension: 0.3 },
      { label: '매출이익', data: m1GP, borderColor: '#F39C12', backgroundColor: '#F39C12', tension: 0.3 }
    ]
  });

  render('modal-chart-yoy', 'bar', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [
      { label: `${currYear}년 매출`, data: m1Rev, backgroundColor: '#00A6B2' },
      { label: `${currYear-1}년 매출`, data: m2Rev, backgroundColor: '#E2E6EB' }
    ]
  });

  document.getElementById('detail-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('detail-modal').style.display = 'none';
}

function applyYoYBadge(elementId, currVal, prevVal) {
  const el = document.getElementById(elementId);
  if (prevVal === 0) { el.innerText = '전년 실적 없음'; el.className = 'yoy-badge yoy-none'; return; }
  const diff = currVal - prevVal;
  const ratio = (diff / prevVal) * 100;
  if (ratio > 0) { el.innerText = `▲ ${ratio.toFixed(1)}%`; el.className = 'yoy-badge yoy-up'; } 
  else if (ratio < 0) { el.innerText = `▼ ${Math.abs(ratio).toFixed(1)}%`; el.className = 'yoy-badge yoy-down'; } 
  else { el.innerText = '-'; el.className = 'yoy-badge yoy-none'; }
}

window.onload = fetchData;
