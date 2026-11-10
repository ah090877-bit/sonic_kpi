// ★ 기존에 쓰시던 URL 그대로 유지하세요!
const API_URL = 'https://script.google.com/macros/s/AKfycbxoRToFFWcjmzjxxYkvPHourAy9C3FxTBWzoASIgiKBWkyofecavJCVyCo8hRy306gq/exec';

let rawData = [];
let chartInstances = {};
const state = { year: 'All', month: 'All', hq: 'All', team: 'All', client: 'All' };

const formatMoney = (val) => val.toLocaleString('ko-KR');

function fetchData() {
  document.getElementById('loader').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  fetch(API_URL).then(res => res.json()).then(data => initApp(data)).catch(err => alert("데이터 에러: " + err));
}

function initApp(response) {
  if (!response.success) { alert("오류: " + response.error); return; }
  
  // 요청사항: 화주공통비 제외
  rawData = response.data.filter(d => d.client !== '화주공통비');
  
  const years = [...new Set(rawData.map(d => d.y))].sort((a,b)=>b-a);
  if(years.length > 0) state.year = years[0].toString();
  
  buildTopFilters(); 
  buildClientSidebar();
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
    if (key === 'year') { state.month = 'All'; state.hq = 'All'; state.team = 'All'; state.client = 'All'; }
    else if (key === 'month') { state.hq = 'All'; state.team = 'All'; state.client = 'All'; }
    else if (key === 'hq') { state.team = 'All'; state.client = 'All'; }
    else if (key === 'team') { state.client = 'All'; }
    buildTopFilters(); 
    buildClientSidebar(); 
    updateDashboard();
  };
}

// 🌟 화주사 왼쪽 사이드바 생성
function buildClientSidebar() {
  const currData = rawData.filter(d => {
    if (state.year !== 'All' && String(d.y) !== state.year) return false;
    if (state.month !== 'All' && String(d.m) !== state.month) return false;
    if (state.hq !== 'All' && d.hq !== state.hq) return false;
    if (state.team !== 'All' && d.team !== state.team) return false;
    return true;
  });
  
  const clients = [...new Set(currData.map(d => d.client))].sort();
  const listEl = document.getElementById('client-list');
  listEl.innerHTML = '';
  
  if (state.client !== 'All' && !clients.includes(state.client)) { state.client = 'All'; }
  
  const liAll = document.createElement('li');
  liAll.className = 'client-item' + (state.client === 'All' ? ' active' : '');
  liAll.innerText = '🔹 화주사 전체 요약 뷰';
  liAll.onclick = () => selectClient('All');
  listEl.appendChild(liAll);
  
  clients.forEach(c => {
    const li = document.createElement('li');
    li.className = 'client-item' + (state.client === c ? ' active' : '');
    li.innerText = c;
    li.onclick = () => selectClient(c);
    listEl.appendChild(li);
  });
}

function selectClient(clientName) {
  state.client = clientName;
  document.querySelectorAll('.client-item').forEach(el => {
    el.classList.remove('active');
    if (el.innerText.includes(clientName === 'All' ? '전체 요약 뷰' : clientName)) {
      el.classList.add('active');
    }
  });
  updateDashboard();
}

// 🌟 대시보드 뷰 스위칭 (전체 카드 뷰 vs 단일 상세 뷰)
function updateDashboard() {
  if (state.client === 'All') {
    document.getElementById('view-multi').style.display = 'block';
    document.getElementById('view-single').style.display = 'none';
    renderCardGrid();
  } else {
    document.getElementById('view-multi').style.display = 'none';
    document.getElementById('view-single').style.display = 'block';
    renderSingleClientDetail();
  }
}

// 뷰 1: 모던한 화주사 요약 카드 생성
function renderCardGrid() {
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
    card.onclick = () => { selectClient(row.client); }; // 카드 클릭 시 해당 화주사 단일 뷰로 전환
    
    // 모던한 SaaS 스타일 텍스트 카드 렌더링
    card.innerHTML = `
      <div class="card-title">${row.client}</div>
      <div class="card-team">${row.hq} / ${row.team}</div>
      
      <div class="card-row"><span>운송수입</span><span class="val">${formatMoney(row.revTrans)}</span></div>
      <div class="card-row"><span>지입료수입</span><span class="val">${formatMoney(row.revLease)}</span></div>
      <div class="card-row"><span>변동원가</span><span class="val">${formatMoney(row.varC)}</span></div>
      
      <div class="card-row border-top bold"><span>공헌이익</span><span class="val ${cm < 0 ? 'txt-red' : ''}">${formatMoney(cm)}</span></div>
      <div class="card-row bold"><span>공헌이익률</span><span class="val ${cmRatio < 0 ? 'txt-red' : ''}">${cmRatio.toFixed(1)}%</span></div>
      
      <div class="card-row border-top"><span>고정원가</span><span class="val">${formatMoney(row.fixC)}</span></div>
      
      <div class="card-row border-top highlight"><span>매출이익</span><span class="val ${gp < 0 ? 'txt-red' : ''}">${formatMoney(gp)}</span></div>
      <div class="card-row highlight"><span>매출이익률</span><span class="val ${gpRatio < 0 ? 'txt-red' : ''}">${gpRatio.toFixed(1)}%</span></div>
    `;
    container.appendChild(card);
  });
}

// 뷰 2: 단일 화주사 상세 분석 (전년비, 차트)
function renderSingleClientDetail() {
  const currYear = parseInt(state.year);
  
  // 상단 타이틀 업데이트
  const currentDataCheck = rawData.find(d => d.client === state.client && d.y === currYear);
  const hq = currentDataCheck ? currentDataCheck.hq : '-';
  const team = currentDataCheck ? currentDataCheck.team : '-';
  document.getElementById('detail-title').innerText = state.client;
  document.getElementById('detail-subtitle').innerText = `${hq} / ${team} / ${currYear}년 ${state.month === 'All' ? '전체' : state.month+'월'}`;
  
  const mCurrData = rawData.filter(d => d.y === currYear && d.client === state.client && (state.month === 'All' || String(d.m) === state.month));
  const mPrevData = rawData.filter(d => d.y === currYear - 1 && d.client === state.client && (state.month === 'All' || String(d.m) === state.month));
  
  let currRev = 0, currVar = 0, currFix = 0;
  mCurrData.forEach(d => { if(d.type==='매출') currRev+=d.amt; else if(d.type==='변동원가') currVar+=d.amt; else if(d.type==='고정원가') currFix+=d.amt; });
  const currCm = currRev - currVar;
  const currGp = currCm - currFix;
  
  let prevRev = 0, prevVar = 0, prevFix = 0;
  mPrevData.forEach(d => { if(d.type==='매출') prevRev+=d.amt; else if(d.type==='변동원가') prevVar+=d.amt; else if(d.type==='고정원가') prevFix+=d.amt; });
  const prevGp = (prevRev - prevVar) - prevFix;

  document.getElementById('s-kpi-rev').innerText = formatMoney(currRev);
  document.getElementById('s-kpi-cm').innerText = formatMoney(currCm);
  document.getElementById('s-kpi-cm-ratio').innerText = currRev === 0 ? '0%' : (currCm/currRev*100).toFixed(1)+'%';
  document.getElementById('s-kpi-gp').innerText = formatMoney(currGp);
  document.getElementById('s-kpi-gp-ratio').innerText = currRev === 0 ? '0%' : (currGp/currRev*100).toFixed(1)+'%';
  
  applyYoYBadge('s-kpi-yoy-rev', currRev, prevRev);
  applyYoYBadge('s-kpi-yoy-gp', currGp, prevGp);

  const annualCurr = rawData.filter(d => d.y === currYear && d.client === state.client);
  const annualPrev = rawData.filter(d => d.y === currYear - 1 && d.client === state.client);
  
  const m1Rev = Array(12).fill(0), m1CM = Array(12).fill(0), m1GP = Array(12).fill(0);
  annualCurr.forEach(d => { const i = d.m-1; if(d.type==='매출'){ m1Rev[i]+=d.amt; m1CM[i]+=d.amt; m1GP[i]+=d.amt; } else if(d.type==='변동원가'){ m1CM[i]-=d.amt; m1GP[i]-=d.amt; } else if(d.type==='고정원가') m1GP[i]-=d.amt; });
  
  const m2Rev = Array(12).fill(0);
  annualPrev.forEach(d => { if(d.type==='매출') m2Rev[d.m-1]+=d.amt; });

  Chart.defaults.font.family = "'Malgun Gothic', sans-serif";
  const render = (id, type, dts, opt) => {
    if (chartInstances[id]) chartInstances[id].destroy();
    chartInstances[id] = new Chart(document.getElementById(id), { type, data: dts, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, ...opt } });
  };

  render('chart-single-trend', 'line', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [
      { label: '매출', data: m1Rev, borderColor: '#B0BEC5', backgroundColor: 'transparent', tension: 0.3, borderDash: [5,5] },
      { label: '공헌이익', data: m1CM, borderColor: '#00A6B2', backgroundColor: '#00A6B2', tension: 0.3, borderWidth: 3 },
      { label: '매출이익', data: m1GP, borderColor: '#F39C12', backgroundColor: '#F39C12', tension: 0.3, borderWidth: 3 }
    ]
  });

  render('chart-single-yoy', 'bar', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [
      { label: `${currYear}년 매출`, data: m1Rev, backgroundColor: '#00A6B2', borderRadius: 4 },
      { label: `${currYear-1}년 매출`, data: m2Rev, backgroundColor: '#E9ECEF', borderRadius: 4 }
    ]
  });
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
