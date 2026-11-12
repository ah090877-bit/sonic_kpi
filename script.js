// ★ 반드시 최신 웹앱 URL을 입력해주세요!
const API_URL = 'https://script.google.com/macros/s/AKfycbxoRToFFWcjmzjxxYkvPHourAy9C3FxTBWzoASIgiKBWkyofecavJCVyCo8hRy306gq/exec';

let rawData = [];
let chartInstances = {};
const state = { view: 'main', year: 'All', month: 'All', hq: 'All', team: 'All', clientView: 'All' };
const formatMoney = (val) => val.toLocaleString('ko-KR');

function login() {
  const id = document.getElementById('login-id').value;
  const pw = document.getElementById('login-pw').value;
  const errBox = document.getElementById('login-error');
  
  if(!id || !pw) { errBox.style.display = 'block'; errBox.innerText = '아이디와 비밀번호를 모두 입력하세요.'; return; }
  
  errBox.style.display = 'none';
  document.getElementById('login-container').style.display = 'none';
  fetchData(); 
  
  fetch(`${API_URL}?action=login&id=${id}&pw=${pw}`)
    .then(res => res.json())
    .then(res => {
      if(!res.success) {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('login-container').style.display = 'flex';
        errBox.style.display = 'block'; errBox.innerText = '아이디 또는 비밀번호가 일치하지 않습니다.';
      }
    })
    .catch(err => {
      document.getElementById('loader').style.display = 'none';
      document.getElementById('login-container').style.display = 'flex';
      errBox.style.display = 'block'; errBox.innerText = '서버 연결에 실패했습니다.';
    });
}

function fetchData() {
  const loader = document.getElementById('loader');
  const app = document.getElementById('app');
  loader.style.display = 'flex';
  document.getElementById('loader-text').innerText = '최신 경영 실적을 동기화 중입니다...';
  app.style.display = 'none';
  
  fetch(API_URL).then(res => res.json()).then(data => initApp(data)).catch(err => {
    loader.innerHTML = `<div style="background:#FFF1F0; padding:30px; border-radius:10px;"><h3 style="color:#CF1322;">🚨 연결 실패</h3><p>${err}</p></div>`;
  });
}

function initApp(response) {
  if (!response.success) { alert("데이터 로드 오류"); return; }
  let fetchedData = response.data.filter(d => d.client !== '화주공통비');
  
  const latestOrgMap = {};
  fetchedData.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.m - b.m)).forEach(d => {
    latestOrgMap[d.client] = { hq: d.hq, team: d.team };
  });
  fetchedData.forEach(d => {
    if (latestOrgMap[d.client]) { d.hq = latestOrgMap[d.client].hq; d.team = latestOrgMap[d.client].team; }
  });
  
  rawData = fetchedData; 
  const years = [...new Set(rawData.map(d => d.y))].sort((a,b)=>b-a);
  if(years.length > 0) {
    state.year = years[0].toString();
    const maxMonth = Math.max(...rawData.filter(d => d.y === years[0]).map(d => d.m));
    state.month = maxMonth.toString(); 
  }
  
  setupSidebar(); buildTopFilters(); updateDashboard();
  document.getElementById('loader').style.display = 'none'; 
  document.getElementById('app').style.display = 'flex';
}

function setupSidebar() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      e.target.classList.add('active');
      state.view = e.target.getAttribute('data-view');
      state.clientView = 'All'; 
      updateDashboard();
    });
  });
}

function buildTopFilters() {
  const allYears = [...new Set(rawData.map(d => d.y))].sort((a,b)=>b-a);
  populateSelect('f-year', allYears, state.year, false);
  
  const filterDataFor = (skipKey) => rawData.filter(d => {
    if (String(d.y) !== state.year) return false;
    if (skipKey !== 'month' && state.month !== 'All' && String(d.m) !== state.month) return false;
    if (skipKey !== 'hq' && state.hq !== 'All' && d.hq !== state.hq) return false;
    if (skipKey !== 'team' && state.team !== 'All' && d.team !== state.team) return false;
    return true;
  });
  
  populateSelect('f-month', [...new Set(filterDataFor('month').map(d => d.m))].sort((a,b)=>a-b), state.month, true);
  populateSelect('f-hq', [...new Set(filterDataFor('hq').map(d => d.hq))].sort(), state.hq, true);
  populateSelect('f-team', [...new Set(filterDataFor('team').map(d => d.team))].sort(), state.team, true);
}

function populateSelect(id, options, selected, addAll) {
  const el = document.getElementById(id); const key = id.replace('f-', '');
  let currentVal = state[key]; 
  const strOptions = options.map(String);
  if (currentVal !== 'All' && !strOptions.includes(String(currentVal))) {
    currentVal = addAll ? 'All' : (options.length > 0 ? String(options[0]) : ''); 
    state[key] = currentVal; 
  }
  
  el.innerHTML = addAll ? '<option value="All">전체</option>' : '';
  options.forEach(opt => {
    const option = document.createElement('option'); option.value = opt; option.text = (id === 'f-month') ? opt + '월' : opt;
    if (String(opt) === String(currentVal)) option.selected = true; el.appendChild(option);
  });
  
  el.onchange = (e) => { state[key] = e.target.value; buildTopFilters(); updateDashboard(); };
}

function updateDashboard() {
  const vMain = document.getElementById('view-main');
  const vSum = document.getElementById('view-summary');
  const vCard = document.getElementById('view-cards');
  const vDet = document.getElementById('view-detail');
  const monthFilter = document.getElementById('filter-month-wrap'); 

  if (state.view === 'main') {
    monthFilter.style.display = 'flex';
    vMain.style.display = 'flex'; vSum.style.display = 'none'; vCard.style.display = 'none'; vDet.style.display = 'none';
    renderMainDashboard();
  } else if (state.view === 'team') {
    monthFilter.style.display = 'none';
    vMain.style.display = 'none'; vSum.style.display = 'flex'; vCard.style.display = 'none'; vDet.style.display = 'none';
    renderSummaryView();
  } else if (state.view === 'client') {
    if (state.clientView === 'All') {
      monthFilter.style.display = 'flex'; 
      vMain.style.display = 'none'; vSum.style.display = 'none'; vCard.style.display = 'block'; vDet.style.display = 'none';
      renderCardGrid();
    } else {
      monthFilter.style.display = 'none';
      vMain.style.display = 'none'; vSum.style.display = 'none'; vCard.style.display = 'none'; vDet.style.display = 'flex';
      renderSingleClientDetail();
    }
  }
}

function renderChart(id, type, dts, opt = {}) {
  if (chartInstances[id]) chartInstances[id].destroy();
  Chart.defaults.font.family = "'Noto Sans KR', sans-serif";
  chartInstances[id] = new Chart(document.getElementById(id), { 
    type, data: dts, 
    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { bottom: 15 } }, plugins: { legend: { position: 'bottom', labels: { padding: 15 } } }, ...opt } 
  });
}
function calculateStats(data) {
  let res = { revTotal: 0, revTrans: 0, revLease: 0, varC: 0, fixC: 0, cm: 0, gp: 0 };
  data.forEach(d => {
    if (d.type === '매출') { res.revTotal += d.amt; if (d.subject === '지입료수입') res.revLease += d.amt; else res.revTrans += d.amt; } 
    else if (d.type === '변동원가') res.varC += d.amt; else if (d.type === '고정원가') res.fixC += d.amt;
  });
  res.cm = res.revTotal - res.varC; res.gp = res.cm - res.fixC;
  return res;
}
function getRatio(curr, prev) {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}
function applyYoYBadge(elementId, currVal, prevVal, prefix = '전년비') {
  const el = document.getElementById(elementId);
  if (prevVal === 0) { el.innerText = `${prefix} -`; el.className = 'yoy-badge yoy-none'; return; }
  const ratio = getRatio(currVal, prevVal);
  if (ratio > 0) { el.innerText = `${prefix} ▲ ${ratio.toFixed(1)}%`; el.className = 'yoy-badge yoy-up'; } 
  else if (ratio < 0) { el.innerText = `${prefix} ▼ ${Math.abs(ratio).toFixed(1)}%`; el.className = 'yoy-badge yoy-down'; } 
  else { el.innerText = `${prefix} -`; el.className = 'yoy-badge yoy-none'; }
}

// 🌟 1. 경영 인사이트 (대기업 스탠다드 색상 통일)
function renderMainDashboard() {
  const currYear = parseInt(state.year);
  let targetMonth = state.month === 'All' ? Math.max(...rawData.filter(d => d.y === currYear).map(d => d.m)) : parseInt(state.month);
  if(!isFinite(targetMonth)) targetMonth = 1;
  
  let prevYear = targetMonth === 1 ? currYear - 1 : currYear;
  let prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;

  document.getElementById('main-title-text').innerText = `${currYear}년 ${targetMonth}월 경영 인사이트`;

  const tData = rawData.filter(d => d.y === currYear && d.m === targetMonth && (state.hq === 'All' || d.hq === state.hq) && (state.team === 'All' || d.team === state.team));
  const pData = rawData.filter(d => d.y === prevYear && d.m === prevMonth && (state.hq === 'All' || d.hq === state.hq) && (state.team === 'All' || d.team === state.team));

  const tStats = calculateStats(tData); const pStats = calculateStats(pData);

  document.getElementById('main-kpi-rev').innerText = formatMoney(tStats.revTotal);
  document.getElementById('main-kpi-cm').innerText = formatMoney(tStats.cm);
  document.getElementById('main-kpi-cm-rate').innerText = tStats.revTotal === 0 ? '0%' : ((tStats.cm/tStats.revTotal)*100).toFixed(1)+'%';
  document.getElementById('main-kpi-gp').innerText = formatMoney(tStats.gp);
  document.getElementById('main-kpi-gp-rate').innerText = tStats.revTotal === 0 ? '0%' : ((tStats.gp/tStats.revTotal)*100).toFixed(1)+'%';

  applyYoYBadge('main-kpi-mom-rev', tStats.revTotal, pStats.revTotal, '전월비');
  applyYoYBadge('main-kpi-mom-gp', tStats.gp, pStats.gp, '전월비');

  const clientMap = {};
  tData.forEach(d => {
    if(!clientMap[d.client]) clientMap[d.client] = { name: d.client, tRev: 0, pRev: 0, tVar: 0, pVar: 0, tFix: 0, pFix: 0 };
    if(d.type === '매출') clientMap[d.client].tRev += d.amt;
    else if(d.type === '변동원가') clientMap[d.client].tVar += d.amt;
    else if(d.type === '고정원가') clientMap[d.client].tFix += d.amt;
  });
  pData.forEach(d => {
    if(!clientMap[d.client]) clientMap[d.client] = { name: d.client, tRev: 0, pRev: 0, tVar: 0, pVar: 0, tFix: 0, pFix: 0 };
    if(d.type === '매출') clientMap[d.client].pRev += d.amt;
    else if(d.type === '변동원가') clientMap[d.client].pVar += d.amt;
    else if(d.type === '고정원가') clientMap[d.client].pFix += d.amt;
  });

  const clients = Object.values(clientMap);
  clients.forEach(c => {
    c.revDiff = c.tRev - c.pRev;
    c.tGp = c.tRev - c.tVar - c.tFix;
    c.pGp = c.pRev - c.pVar - c.pFix;
    c.gpDiff = c.tGp - c.pGp;
  });
  
  const revSorted = [...clients].sort((a,b) => b.revDiff - a.revDiff);
  const gpSorted = [...clients].sort((a,b) => b.gpDiff - a.gpDiff);
  
  let bestHTML = '<div class="insight-val" style="color:#888;">데이터 없음</div>';
  let worstHTML = '<div class="insight-val" style="color:#888;">데이터 없음</div>';
  
  if(revSorted.length > 0 && revSorted[0].revDiff > 0) {
    let c = revSorted[0];
    bestHTML = `<div class="insight-val">${c.name}</div><div class="insight-desc">전월 대비 매출액 ${formatMoney(c.revDiff)}원 상승 (▲${c.pRev===0?'100':getRatio(c.tRev, c.pRev).toFixed(1)}%)</div>`;
  }
  if(revSorted.length > 0 && revSorted[revSorted.length-1].revDiff < 0) {
    let c = revSorted[revSorted.length-1];
    worstHTML = `<div class="insight-val">${c.name}</div><div class="insight-desc">전월 대비 매출액 ${formatMoney(Math.abs(c.revDiff))}원 하락 (▼${c.pRev===0?'100':Math.abs(getRatio(c.tRev, c.pRev)).toFixed(1)}%)</div>`;
  }
  document.getElementById('insight-best').innerHTML = bestHTML;
  document.getElementById('insight-worst').innerHTML = worstHTML;

  const teamMap = {};
  tData.forEach(d => { 
    if(!teamMap[d.team]) teamMap[d.team]={ tRev:0, pRev:0, tVar:0, pVar:0, tFix:0, pFix:0 }; 
    if(d.type==='매출') teamMap[d.team].tRev += d.amt; 
    else if(d.type==='변동원가') teamMap[d.team].tVar += d.amt; 
    else if(d.type==='고정원가') teamMap[d.team].tFix += d.amt; 
  });
  pData.forEach(d => { 
    if(!teamMap[d.team]) teamMap[d.team]={ tRev:0, pRev:0, tVar:0, pVar:0, tFix:0, pFix:0 }; 
    if(d.type==='매출') teamMap[d.team].pRev += d.amt; 
    else if(d.type==='변동원가') teamMap[d.team].pVar += d.amt; 
    else if(d.type==='고정원가') teamMap[d.team].pFix += d.amt; 
  });
  const teamLabels = Object.keys(teamMap);
  
  // ★ 메인 뷰 차트 색상: 코퍼레이트 블루(#2E79B5) 및 오렌지(#F39C12)로 완전 통일
  renderChart('main-chart-team-rev', 'bar', {
    labels: teamLabels,
    datasets: [
      { label: `${prevMonth}월 전월 매출`, data: teamLabels.map(t => teamMap[t].pRev), backgroundColor: '#DEE2E6', borderRadius: 4 },
      { label: `${targetMonth}월 기준월 매출`, data: teamLabels.map(t => teamMap[t].tRev), backgroundColor: '#2E79B5', borderRadius: 4 }
    ]
  });

  renderChart('main-chart-team-gp', 'bar', {
    labels: teamLabels,
    datasets: [
      { label: `${prevMonth}월 전월 매출이익`, data: teamLabels.map(t => (teamMap[t].pRev - teamMap[t].pVar - teamMap[t].pFix)), backgroundColor: '#E2E8F0', borderRadius: 4 },
      { label: `${targetMonth}월 기준월 매출이익`, data: teamLabels.map(t => (teamMap[t].tRev - teamMap[t].tVar - teamMap[t].tFix)), backgroundColor: '#F39C12', borderRadius: 4 }
    ]
  });

  const revBody = document.getElementById('main-table-body-rev'); revBody.innerHTML = '';
  const topBotRev = revSorted.slice(0, 3).concat(revSorted.slice(-2).reverse()).filter((v,i,a)=>a.indexOf(v)===i);
  topBotRev.forEach(c => {
    if(c.tRev === 0 && c.pRev === 0) return;
    let ratio = getRatio(c.tRev, c.pRev);
    let txt = ratio === null ? '-' : (ratio > 0 ? `▲ ${ratio.toFixed(1)}%` : (ratio < 0 ? `▼ ${Math.abs(ratio).toFixed(1)}%` : '-'));
    let color = ratio === null ? 'inherit' : (ratio > 0 ? '#2E7D32' : (ratio < 0 ? '#C62828' : 'inherit'));
    revBody.innerHTML += `<tr><td class="text-center" style="font-weight:900;">${c.name}</td>
      <td style="color:#6C757D;">${formatMoney(c.pRev)}</td>
      <td style="font-weight:700;">${formatMoney(c.tRev)}</td>
      <td style="color:${color}; font-weight:900;">${txt}</td>
      <td style="color:${color};">${(c.revDiff > 0)?'+':''}${formatMoney(c.revDiff)}</td></tr>`;
  });

  const gpBody = document.getElementById('main-table-body-gp'); gpBody.innerHTML = '';
  const topBotGp = gpSorted.slice(0, 3).concat(gpSorted.slice(-2).reverse()).filter((v,i,a)=>a.indexOf(v)===i);
  topBotGp.forEach(c => {
    if(c.tGp === 0 && c.pGp === 0) return;
    let ratio = getRatio(c.tGp, c.pGp);
    let txt = ratio === null ? '-' : (ratio > 0 ? `▲ ${ratio.toFixed(1)}%` : (ratio < 0 ? `▼ ${Math.abs(ratio).toFixed(1)}%` : '-'));
    let color = ratio === null ? 'inherit' : (ratio > 0 ? '#2E7D32' : (ratio < 0 ? '#C62828' : 'inherit'));
    gpBody.innerHTML += `<tr><td class="text-center" style="font-weight:900;">${c.name}</td>
      <td style="color:#6C757D;">${formatMoney(c.pGp)}</td>
      <td style="font-weight:700;">${formatMoney(c.tGp)}</td>
      <td style="color:${color}; font-weight:900;">${txt}</td>
      <td style="color:${color};">${(c.gpDiff > 0)?'+':''}${formatMoney(c.gpDiff)}</td></tr>`;
  });
}

// 🌟 2. 팀별 연간 리포트 (대기업 스탠다드 컬러 적용)
function renderSummaryView() {
  const currYear = parseInt(state.year);
  const currData = rawData.filter(d => d.y === currYear && (state.hq === 'All' || d.hq === state.hq) && (state.team === 'All' || d.team === state.team));
  
  const maxDbMonth = currData.length > 0 ? Math.max(...currData.map(d => d.m)) : 12;
  const prevData = rawData.filter(d => d.y === currYear - 1 && d.m <= maxDbMonth && (state.hq === 'All' || d.hq === state.hq) && (state.team === 'All' || d.team === state.team));

  const currStats = calculateStats(currData); const prevStats = calculateStats(prevData);
  document.getElementById('sum-kpi-rev').innerText = formatMoney(currStats.revTotal);
  document.getElementById('sum-kpi-cm').innerText = formatMoney(currStats.cm);
  document.getElementById('sum-kpi-cm-rate').innerText = currStats.revTotal === 0 ? '0%' : ((currStats.cm / currStats.revTotal) * 100).toFixed(1) + '%';
  document.getElementById('sum-kpi-gp').innerText = formatMoney(currStats.gp);
  document.getElementById('sum-kpi-gp-rate').innerText = currStats.revTotal === 0 ? '0%' : ((currStats.gp / currStats.revTotal) * 100).toFixed(1) + '%';
  applyYoYBadge('sum-kpi-yoy-rev', currStats.revTotal, prevStats.revTotal, `전년 누계비(1~${maxDbMonth}월)`); 
  applyYoYBadge('sum-kpi-yoy-gp', currStats.gp, prevStats.gp, `전년 누계비(1~${maxDbMonth}월)`);

  const mCurrRev = Array(12).fill(0), mPrevRev = Array(12).fill(0);
  const mCurrVar = Array(12).fill(0), mCurrFix = Array(12).fill(0), mCurrGP = Array(12).fill(0), mCurrCM = Array(12).fill(0);

  currData.forEach(d => { 
    const i = d.m - 1;
    if (d.type === '매출') { mCurrRev[i] += d.amt; mCurrCM[i] += d.amt; mCurrGP[i] += d.amt; } 
    else if (d.type === '변동원가') { mCurrVar[i] += d.amt; mCurrCM[i] -= d.amt; mCurrGP[i] -= d.amt; }
    else if (d.type === '고정원가') { mCurrFix[i] += d.amt; mCurrGP[i] -= d.amt; }
  });
  
  const prevDataAll = rawData.filter(d => d.y === currYear - 1 && (state.hq === 'All' || d.hq === state.hq) && (state.team === 'All' || d.team === state.team));
  prevDataAll.forEach(d => { if (d.type === '매출') mPrevRev[d.m - 1] += d.amt; });

  // ★ 누적 막대 차트: 네이비, 시안, 오렌지, 그레이의 모던한 조합
  renderChart('sum-chart-trend', 'bar', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [
      { type: 'line', label: `${currYear}년 총매출 (추이)`, data: mCurrRev, borderColor: '#2C3E50', backgroundColor: '#2C3E50', pointBackgroundColor: '#FFF', pointBorderColor: '#2C3E50', tension: 0.2, borderWidth: 3, pointRadius: 4, fill: false }, 
      { type: 'line', label: `${currYear - 1}년 총매출`, data: mPrevRev, borderColor: '#CED4DA', tension: 0.3, borderWidth: 2, borderDash: [5,5], pointRadius: 0, fill: false },
      { type: 'bar', label: `매출이익`, data: mCurrGP, backgroundColor: '#F39C12', stack: 'Stack0' }, 
      { type: 'bar', label: `고정원가`, data: mCurrFix, backgroundColor: '#DEE2E6', stack: 'Stack0' }, 
      { type: 'bar', label: `변동원가`, data: mCurrVar, backgroundColor: '#00A6B2', stack: 'Stack0' } 
    ]
  }, {
    scales: { x: { stacked: true }, y: { stacked: true } }
  });
  
  const safeRate = (profit, rev) => rev === 0 ? null : (profit / rev) * 100;
  const capVal = (val) => { if(val === null) return null; if(val > 150) return 150; if(val < -150) return -150; return val; };

  const mCurrCMRate = Array(12).fill(null), mCurrGPRate = Array(12).fill(null);
  const realCurrCMRate = Array(12).fill(null), realCurrGPRate = Array(12).fill(null);

  for(let i=0; i<12; i++) {
    realCurrCMRate[i] = safeRate(mCurrCM[i], mCurrRev[i]); realCurrGPRate[i] = safeRate(mCurrGP[i], mCurrRev[i]);
    mCurrCMRate[i] = capVal(realCurrCMRate[i]); mCurrGPRate[i] = capVal(realCurrGPRate[i]);
  }

  // ★ 이익률 꺾은선: 시안 & 오렌지 (통일)
  renderChart('sum-chart-margin', 'line', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [
      { label: `공헌이익률(%)`, data: mCurrCMRate, realData: realCurrCMRate, borderColor: '#00A6B2', backgroundColor: '#00A6B2', tension: 0.3, borderWidth: 3, spanGaps: true },
      { label: `매출이익률(%)`, data: mCurrGPRate, realData: realCurrGPRate, borderColor: '#F39C12', backgroundColor: '#F39C12', tension: 0.3, borderWidth: 3, spanGaps: true }
    ]
  }, {
    scales: { y: { suggestedMin: -20, suggestedMax: 20, ticks: { stepSize: 5, callback: v => v + '%' } } },
    plugins: { tooltip: { callbacks: { label: function(c) { let r = c.dataset.realData[c.dataIndex]; if(r===null) return ''; let p = c.dataset.label + ': '; if (r < -150) return p + r.toFixed(1) + '% (적자)'; if (r > 150) return p + r.toFixed(1) + '% (초과)'; return p + r.toFixed(1) + '%'; } } } }
  });

  const head = document.getElementById('sum-table-head'); const tbody = document.getElementById('sum-table-body');
  head.innerHTML = `<tr><th>해당 월</th><th>당기 매출</th><th>전년 동기 매출</th><th>증감률</th><th>운송수입</th><th>지입료수입</th><th>변동원가</th><th>공헌이익</th><th>공헌이익률</th><th>고정원가</th><th>매출이익</th><th>매출이익률</th></tr>`;
  tbody.innerHTML = '';
  
  for (let m = 1; m <= 12; m++) {
    const cData = currData.filter(d => d.m === m); const pData = prevDataAll.filter(d => d.m === m);
    let cRev = 0, cTrans = 0, cLease = 0, cVar = 0, cFix = 0, pRev = 0;
    cData.forEach(d => { if (d.type === '매출') { cRev += d.amt; if (d.subject === '지입료수입') cLease += d.amt; else cTrans += d.amt; } else if (d.type === '변동원가') cVar += d.amt; else if (d.type === '고정원가') cFix += d.amt; });
    pData.forEach(d => { if (d.type === '매출') pRev += d.amt; });
    if (cRev === 0 && pRev === 0 && cVar === 0 && cFix === 0) continue;
    
    let ratio = getRatio(cRev, pRev);
    let yoyTxt = ratio === null ? '-' : (ratio > 0 ? `▲ ${ratio.toFixed(1)}%` : (ratio < 0 ? `▼ ${Math.abs(ratio).toFixed(1)}%` : '-'));
    let yoyColor = ratio === null ? 'inherit' : (ratio > 0 ? '#2E7D32' : (ratio < 0 ? '#C62828' : 'inherit'));
    
    const cm = cRev - cVar; const cmRatio = cRev === 0 ? 0 : (cm / cRev) * 100;
    const gp = cm - cFix; const gpRatio = cRev === 0 ? 0 : (gp / cRev) * 100;
    
    const tr = document.createElement('tr'); 
    tr.className = 'clickable-row'; 
    // ★ 표의 글자 색상도 코퍼레이트 블루/시안 적용
    tr.innerHTML = `<td class="text-center" style="font-weight:900; color:#2E79B5;">${m}월 ▾</td><td style="font-weight:900;">${formatMoney(cRev)}</td><td style="color:#6C757D;">${formatMoney(pRev)}</td><td style="color:${yoyColor}; font-weight:900;">${yoyTxt}</td><td>${formatMoney(cTrans)}</td><td>${formatMoney(cLease)}</td><td>${formatMoney(cVar)}</td><td style="color:#00A6B2; font-weight:900;">${formatMoney(cm)}</td><td style="font-size:12px; color:#6C757D;">${cmRatio.toFixed(1)}%</td><td>${formatMoney(cFix)}</td><td style="color:${gp < 0 ? '#DC3545' : '#212529'}; font-weight:900;">${formatMoney(gp)}</td><td style="font-size:12px; color:#6C757D;">${gpRatio.toFixed(1)}%</td>`;
    
    const dExist = cData.filter(d => d.isNew !== '신규'); const dNew = cData.filter(d => d.isNew === '신규');
    const stE = calculateStats(dExist); const stN = calculateStats(dNew);

    const makeSubHtml = (title, st, color) => {
      if(st.revTotal === 0 && st.varC === 0 && st.fixC === 0) return '';
      const cmRate = st.revTotal===0 ? 0 : (st.cm/st.revTotal)*100; const gpRate = st.revTotal===0 ? 0 : (st.gp/st.revTotal)*100;
      return `<td class="text-center" style="color:${color};">└ ${title}</td><td style="font-weight:700;">${formatMoney(st.revTotal)}</td><td>-</td><td>-</td><td>${formatMoney(st.revTrans)}</td><td>${formatMoney(st.revLease)}</td><td>${formatMoney(st.varC)}</td><td style="color:#00A6B2;">${formatMoney(st.cm)}</td><td style="font-size:12px;">${cmRate.toFixed(1)}%</td><td>${formatMoney(st.fixC)}</td><td style="color:${st.gp < 0 ? '#DC3545' : '#212529'};">${formatMoney(st.gp)}</td><td style="font-size:12px;">${gpRate.toFixed(1)}%</td>`;
    }

    const subTr1 = document.createElement('tr'); subTr1.className = `sub-row sub-${m}`; subTr1.innerHTML = makeSubHtml('기존 사업', stE, '#2E7D32');
    const subTr2 = document.createElement('tr'); subTr2.className = `sub-row sub-${m}`; subTr2.innerHTML = makeSubHtml('신규 사업', stN, '#C62828');

    tr.onclick = () => { document.querySelectorAll(`.sub-${m}`).forEach(sr => { if(sr.innerHTML !== '') sr.classList.toggle('active'); }); };
    tbody.appendChild(tr); tbody.appendChild(subTr1); tbody.appendChild(subTr2);
  }
}

// 🌟 3. 화주사별 요약 카드 뷰
function renderCardGrid() {
  const currYear = parseInt(state.year);
  let targetMonth = state.month === 'All' ? Math.max(...rawData.filter(d => d.y === currYear).map(d => d.m)) : parseInt(state.month);
  if(!isFinite(targetMonth)) targetMonth = 1;

  const currData = rawData.filter(d => d.y === currYear && d.m === targetMonth && (state.hq === 'All' || d.hq === state.hq) && (state.team === 'All' || d.team === state.team));
  
  const sumExist = {}, sumNew = {};
  currData.forEach(d => {
    const key = `${d.hq}|${d.team}|${d.client}`;
    const targetMap = (d.isNew === '신규') ? sumNew : sumExist;
    if (!targetMap[key]) targetMap[key] = { hq: d.hq, team: d.team, client: d.client, revTrans: 0, revLease: 0, varC: 0, fixC: 0 };
    if (d.type === '매출') { if (d.subject === '지입료수입') targetMap[key].revLease += d.amt; else targetMap[key].revTrans += d.amt; }
    else if (d.type === '변동원가') targetMap[key].varC += d.amt; else if (d.type === '고정원가') targetMap[key].fixC += d.amt;
  });

  const buildCards = (sumMap, containerId) => {
    const container = document.getElementById(containerId); container.innerHTML = '';
    const rows = Object.values(sumMap).sort((a,b) => (b.revTrans + b.revLease) - (a.revTrans + a.revLease));
    if(rows.length === 0) { container.innerHTML = '<div style="grid-column: 1/-1; padding: 20px; color:#888;">해당 조건의 화주사가 없습니다.</div>'; return; }
    
    rows.forEach(row => {
      const totalRev = row.revTrans + row.revLease; if (totalRev === 0 && row.varC === 0 && row.fixC === 0) return;
      const cm = totalRev - row.varC; const cmRatio = totalRev === 0 ? 0 : (cm / totalRev) * 100;
      const gp = cm - row.fixC; const gpRatio = totalRev === 0 ? 0 : (gp / totalRev) * 100;

      const card = document.createElement('div'); card.className = 'client-card';
      card.onclick = () => { state.clientView = row.client; updateDashboard(); }; 
      card.innerHTML = `
        <div class="card-title">${row.client}</div>
        <div class="card-team">${row.hq} / ${row.team}</div>
        <div class="card-row"><span>운송수입</span><span class="val">${formatMoney(row.revTrans)}</span></div>
        <div class="card-row"><span>지입료수입</span><span class="val">${formatMoney(row.revLease)}</span></div>
        <div class="card-row"><span>변동원가</span><span class="val">${formatMoney(row.varC)}</span></div>
        <div class="card-row border-top highlight"><span style="color:#00A6B2; font-weight:bold;">공헌이익</span><span class="val ${cm < 0 ? 'txt-red' : ''}" style="color:#00A6B2;">${formatMoney(cm)}</span></div>
        <div class="card-row"><span>공헌이익률</span><span class="val ${cmRatio < 0 ? 'txt-red' : ''}">${cmRatio.toFixed(1)}%</span></div>
        <div class="card-row border-top"><span>고정원가</span><span class="val">${formatMoney(row.fixC)}</span></div>
        <div class="card-row border-top highlight"><span style="color:#F39C12; font-weight:bold;">매출이익</span><span class="val ${gp < 0 ? 'txt-red' : ''}" style="color:#F39C12;">${formatMoney(gp)}</span></div>
        <div class="card-row highlight"><span>매출이익률</span><span class="val ${gpRatio < 0 ? 'txt-red' : ''}">${gpRatio.toFixed(1)}%</span></div>
      `;
      container.appendChild(card);
    });
  };
  buildCards(sumExist, 'card-container-exist'); buildCards(sumNew, 'card-container-new');
}

// 🌟 4. 화주사 상세 분석 뷰 🌟
function renderSingleClientDetail() {
  const currYear = parseInt(state.year);
  const clientName = state.clientView;
  
  const annualCurr = rawData.filter(d => d.y === currYear && d.client === clientName);
  const maxDbMonth = annualCurr.length > 0 ? Math.max(...annualCurr.map(d => d.m)) : 12;
  const prevYtdData = rawData.filter(d => d.y === currYear - 1 && d.m <= maxDbMonth && d.client === clientName);
  
  const hq = annualCurr.length > 0 ? annualCurr[0].hq : '-';
  const team = annualCurr.length > 0 ? annualCurr[0].team : '-';
  document.getElementById('detail-title').innerText = clientName;
  document.getElementById('detail-subtitle').innerText = `${hq} / ${team} / ${currYear}년 연간 통합 리포트`;
  
  const currStats = calculateStats(annualCurr); const prevStats = calculateStats(prevYtdData);

  document.getElementById('det-kpi-rev').innerText = formatMoney(currStats.revTotal);
  document.getElementById('det-kpi-cm').innerText = formatMoney(currStats.cm);
  document.getElementById('det-kpi-cm-rate').innerText = currStats.revTotal === 0 ? '0%' : (currStats.cm/currStats.revTotal*100).toFixed(1)+'%';
  document.getElementById('det-kpi-gp').innerText = formatMoney(currStats.gp);
  document.getElementById('det-kpi-gp-rate').innerText = currStats.revTotal === 0 ? '0%' : (currStats.gp/currStats.revTotal*100).toFixed(1)+'%';
  applyYoYBadge('det-kpi-yoy-rev', currStats.revTotal, prevStats.revTotal, `전년 누계비(1~${maxDbMonth}월)`); 
  applyYoYBadge('det-kpi-yoy-gp', currStats.gp, prevStats.gp, `전년 누계비(1~${maxDbMonth}월)`);

  const m1Rev = Array(12).fill(0), m1CM = Array(12).fill(0), m1GP = Array(12).fill(0);
  const m2Rev = Array(12).fill(0), m2CM = Array(12).fill(0), m2GP = Array(12).fill(0);
  
  annualCurr.forEach(d => { const i = d.m-1; if(d.type==='매출'){ m1Rev[i]+=d.amt; m1CM[i]+=d.amt; m1GP[i]+=d.amt; } else if(d.type==='변동원가'){ m1CM[i]-=d.amt; m1GP[i]-=d.amt; } else if(d.type==='고정원가') m1GP[i]-=d.amt; });
  const annualPrevAll = rawData.filter(d => d.y === currYear - 1 && d.client === clientName);
  annualPrevAll.forEach(d => { const i = d.m-1; if(d.type==='매출'){ m2Rev[i]+=d.amt; m2CM[i]+=d.amt; m2GP[i]+=d.amt; } else if(d.type==='변동원가'){ m2CM[i]-=d.amt; m2GP[i]-=d.amt; } else if(d.type==='고정원가') m2GP[i]-=d.amt; });
  
  const safeRate = (profit, rev) => rev === 0 ? null : (profit / rev) * 100;
  const capVal = (val) => { if(val === null) return null; if(val > 150) return 150; if(val < -150) return -150; return val; };

  const real1CM = Array(12).fill(null), real1GP = Array(12).fill(null);
  const real2CM = Array(12).fill(null), real2GP = Array(12).fill(null);
  const chart1CM = Array(12).fill(null), chart1GP = Array(12).fill(null);
  const chart2CM = Array(12).fill(null), chart2GP = Array(12).fill(null);

  for(let i=0; i<12; i++) {
    real1CM[i] = safeRate(m1CM[i], m1Rev[i]); real1GP[i] = safeRate(m1GP[i], m1Rev[i]);
    real2CM[i] = safeRate(m2CM[i], m2Rev[i]); real2GP[i] = safeRate(m2GP[i], m2Rev[i]);
    chart1CM[i] = capVal(real1CM[i]); chart1GP[i] = capVal(real1GP[i]);
    chart2CM[i] = capVal(real2CM[i]); chart2GP[i] = capVal(real2GP[i]);
  }

  // ★ 차트 블루/시안/오렌지 정렬
  renderChart('det-chart-yoy', 'bar', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [{ label: `${currYear-1}년 매출`, data: m2Rev, backgroundColor: '#DEE2E6', borderRadius: 4 }, { label: `${currYear}년 매출`, data: m1Rev, backgroundColor: '#2E79B5', borderRadius: 4 }]
  });

  renderChart('det-chart-margin', 'line', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [
      { label: `${currYear} 공헌이익률`, data: chart1CM, realData: real1CM, borderColor: '#00A6B2', backgroundColor: '#00A6B2', tension: 0.3, borderWidth: 3, spanGaps: true },
      { label: `${currYear} 매출이익률`, data: chart1GP, realData: real1GP, borderColor: '#F39C12', backgroundColor: '#F39C12', tension: 0.3, borderWidth: 3, spanGaps: true },
      { label: `${currYear-1} 공헌이익률`, data: chart2CM, realData: real2CM, borderColor: '#B0BEC5', tension: 0.3, borderDash: [5,5], borderWidth: 2, spanGaps: true },
      { label: `${currYear-1} 매출이익률`, data: chart2GP, realData: real2GP, borderColor: '#E8A37E', tension: 0.3, borderDash: [5,5], borderWidth: 2, spanGaps: true }
    ]
  }, {
    scales: { y: { suggestedMin: -20, suggestedMax: 20, ticks: { stepSize: 5, callback: v => v + '%' } } },
    plugins: { tooltip: { callbacks: { label: function(c) { let r = c.dataset.realData[c.dataIndex]; if(r===null) return ''; let p = c.dataset.label + ': '; if (r < -150) return p + r.toFixed(1) + '% (적자)'; if (r > 150) return p + r.toFixed(1) + '% (초과)'; return p + r.toFixed(1) + '%'; } } } }
  });

  const drawDetTable = (isNewType, tableId, wrapId) => {
    const dCurr = annualCurr.filter(d => (isNewType === '신규' ? d.isNew === '신규' : d.isNew !== '신규'));
    const dPrev = annualPrevAll.filter(d => (isNewType === '신규' ? d.isNew === '신규' : d.isNew !== '신규'));
    const wrap = document.getElementById(wrapId); const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';
    
    if(dCurr.length === 0 && dPrev.length === 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';

    for (let m = 1; m <= 12; m++) {
      const cData = dCurr.filter(d => d.m === m); const pData = dPrev.filter(d => d.m === m);
      let cRev = 0, cTrans = 0, cLease = 0, cVar = 0, cFix = 0, pRev = 0;
      cData.forEach(d => { if (d.type === '매출') { cRev += d.amt; if (d.subject === '지입료수입') cLease += d.amt; else cTrans += d.amt; } else if (d.type === '변동원가') cVar += d.amt; else if (d.type === '고정원가') cFix += d.amt; });
      pData.forEach(d => { if (d.type === '매출') pRev += d.amt; });
      if (cRev === 0 && pRev === 0 && cVar === 0 && cFix === 0) continue;
      
      let ratio = getRatio(cRev, pRev);
      let yoyTxt = ratio === null ? '-' : (ratio > 0 ? `▲ ${ratio.toFixed(1)}%` : (ratio < 0 ? `▼ ${Math.abs(ratio).toFixed(1)}%` : '-'));
      let yoyColor = ratio === null ? 'inherit' : (ratio > 0 ? '#2E7D32' : (ratio < 0 ? '#C62828' : 'inherit'));
      
      const cm = cRev - cVar; const cmRatio = cRev === 0 ? 0 : (cm / cRev) * 100;
      const gp = cm - cFix; const gpRatio = cRev === 0 ? 0 : (gp / cRev) * 100;
      
      const tr = document.createElement('tr'); 
      tr.innerHTML = `<td class="text-center">${m}월</td><td style="font-weight:900;">${formatMoney(cRev)}</td><td style="color:#6C757D;">${formatMoney(pRev)}</td><td style="color:${yoyColor}; font-weight:900;">${yoyTxt}</td><td>${formatMoney(cTrans)}</td><td>${formatMoney(cLease)}</td><td>${formatMoney(cVar)}</td><td style="color:#00A6B2; font-weight:900;">${formatMoney(cm)}</td><td style="font-size:12px; color:#6C757D;">${cmRatio.toFixed(1)}%</td><td>${formatMoney(cFix)}</td><td style="color:${gp < 0 ? '#DC3545' : '#212529'}; font-weight:900;">${formatMoney(gp)}</td><td style="font-size:12px; color:#6C757D;">${gpRatio.toFixed(1)}%</td>`;
      tbody.appendChild(tr);
    }
  }
  drawDetTable('기존', 'det-table-exist', 'detail-table-exist-wrap');
  drawDetTable('신규', 'det-table-new', 'detail-table-new-wrap');
}
function goBackToCards() { state.clientView = 'All'; updateDashboard(); }
window.onload = fetchData;
