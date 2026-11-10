const API_URL = '여기에_방금_새배포로_받은_URL을_넣으세요';

let rawData = [];
let chartInstances = {};
const state = { view: 'hq', year: 'All', month: 'All', hq: 'All', team: 'All', clientView: 'All' };
const formatMoney = (val) => val.toLocaleString('ko-KR');

function fetchData() {
  const loader = document.getElementById('loader');
  loader.style.display = 'flex'; loader.innerHTML = '<div class="spinner"></div><p>ERP 데이터 동기화 중...</p>';
  document.getElementById('app').style.display = 'none';
  fetch(API_URL).then(res => res.json()).then(data => initApp(data)).catch(err => {
    loader.innerHTML = `<div style="background:#FFF1F0; border:1px solid #FFA39E; padding:30px; border-radius:10px; text-align:center;"><h3 style="color:#CF1322;">🚨 연결 실패</h3><p>${err}</p></div>`;
  });
}

function initApp(response) {
  const loader = document.getElementById('loader');
  if (!response.success) { 
    loader.innerHTML = `<div style="background:#FFF1F0; padding:30px; border-radius:10px;"><h3 style="color:#CF1322;">🚨 로드 오류</h3><p>${response.error}</p></div>`;
    return; 
  }
  
  try {
    let fetchedData = response.data.filter(d => d.client !== '화주공통비');
    
    // 조직 이동 자동 추적: 가장 최신 연/월 데이터 기준으로 소속 고정
    const latestOrgMap = {};
    fetchedData.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.m - b.m)).forEach(d => {
      latestOrgMap[d.client] = { hq: d.hq, team: d.team };
    });
    fetchedData.forEach(d => {
      if (latestOrgMap[d.client]) { d.hq = latestOrgMap[d.client].hq; d.team = latestOrgMap[d.client].team; }
    });
    
    rawData = fetchedData; 

    // ★ 초기 로드 시 가장 최신 연도와 최신 월로 자동 세팅
    const years = [...new Set(rawData.map(d => d.y))].sort((a,b)=>b-a);
    if(years.length > 0) {
      state.year = years[0].toString();
      const maxMonth = Math.max(...rawData.filter(d => d.y === years[0]).map(d => d.m));
      state.month = maxMonth.toString();
    }
    
    setupSidebar(); buildTopFilters(); updateDashboard();
    loader.style.display = 'none'; document.getElementById('app').style.display = 'flex';
  } catch (e) {
    loader.innerHTML = `<div style="background:#FFF1F0; padding:30px; border-radius:10px;"><h3 style="color:#CF1322;">🚨 자바스크립트 에러</h3><p>${e.name} : ${e.message}</p></div>`;
  }
}

function setupSidebar() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      e.target.classList.add('active');
      state.view = e.target.getAttribute('data-view');
      state.clientView = 'All'; 
      if(state.view !== 'client') document.getElementById('table-title').innerText = state.view === 'hq' ? '본부별 실적 리포트' : '팀별 실적 리포트';
      updateDashboard();
    });
  });
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
  const el = document.getElementById(id); const key = id.replace('f-', '');
  let currentVal = selected;
  if (currentVal !== 'All' && !options.includes(currentVal) && !options.includes(Number(currentVal))) {
    currentVal = addAll ? 'All' : (options.length > 0 ? options[0] : ''); state[key] = currentVal; 
  }
  el.innerHTML = addAll ? '<option value="All">전체</option>' : '';
  options.forEach(opt => {
    const option = document.createElement('option'); option.value = opt; option.text = (id === 'f-month') ? opt + '월' : opt;
    if (String(opt) === String(currentVal)) option.selected = true; el.appendChild(option);
  });
  el.onchange = (e) => {
    state[key] = e.target.value;
    if (key === 'year') { state.month = 'All'; state.hq = 'All'; state.team = 'All'; }
    else if (key === 'month') { state.hq = 'All'; state.team = 'All'; }
    else if (key === 'hq') { state.team = 'All'; }
    buildTopFilters(); updateDashboard();
  };
}

// ★ 라우팅 및 월 필터 숨김 로직
function updateDashboard() {
  const vSum = document.getElementById('view-summary');
  const vCard = document.getElementById('view-cards');
  const vDet = document.getElementById('view-detail');
  const monthFilter = document.getElementById('filter-month-wrap'); // 월 필터

  if (state.view === 'hq' || state.view === 'team') {
    monthFilter.style.display = 'flex';
    vSum.style.display = 'flex'; vCard.style.display = 'none'; vDet.style.display = 'none';
    renderSummaryView();
  } else if (state.view === 'client') {
    if (state.clientView === 'All') {
      monthFilter.style.display = 'flex';
      vSum.style.display = 'none'; vCard.style.display = 'block'; vDet.style.display = 'none';
      renderCardGrid();
    } else {
      // 상세 분석 뷰 진입 시 월 필터를 감춥니다. (무조건 연간 전체를 조회하도록)
      monthFilter.style.display = 'none';
      vSum.style.display = 'none'; vCard.style.display = 'none'; vDet.style.display = 'flex';
      renderSingleClientDetail();
    }
  }
}

// --- 공통 유틸리티 ---
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
function applyYoYBadge(elementId, currVal, prevVal) {
  const el = document.getElementById(elementId);
  if (prevVal === 0) { el.innerText = '전년비 -'; el.className = 'yoy-badge yoy-none'; return; }
  const ratio = ((currVal - prevVal) / prevVal) * 100;
  if (ratio > 0) { el.innerText = `▲ ${ratio.toFixed(1)}%`; el.className = 'yoy-badge yoy-up'; } 
  else if (ratio < 0) { el.innerText = `▼ ${Math.abs(ratio).toFixed(1)}%`; el.className = 'yoy-badge yoy-down'; } 
  else { el.innerText = '-'; el.className = 'yoy-badge yoy-none'; }
}

// --- 뷰 1 ---
function renderSummaryView() {
  const currYear = parseInt(state.year);
  const currData = rawData.filter(d => d.y === currYear && (state.month === 'All' || String(d.m) === state.month) && (state.hq === 'All' || d.hq === state.hq) && (state.team === 'All' || d.team === state.team));
  const prevData = rawData.filter(d => d.y === currYear - 1 && (state.month === 'All' || String(d.m) === state.month) && (state.hq === 'All' || d.hq === state.hq) && (state.team === 'All' || d.team === state.team));

  const currStats = calculateStats(currData); const prevStats = calculateStats(prevData);
  document.getElementById('sum-kpi-rev').innerText = formatMoney(currStats.revTotal);
  document.getElementById('sum-kpi-cm').innerText = formatMoney(currStats.cm);
  document.getElementById('sum-kpi-cm-rate').innerText = currStats.revTotal === 0 ? '0%' : ((currStats.cm / currStats.revTotal) * 100).toFixed(1) + '%';
  document.getElementById('sum-kpi-gp').innerText = formatMoney(currStats.gp);
  document.getElementById('sum-kpi-gp-rate').innerText = currStats.revTotal === 0 ? '0%' : ((currStats.gp / currStats.revTotal) * 100).toFixed(1) + '%';
  applyYoYBadge('sum-kpi-yoy-rev', currStats.revTotal, prevStats.revTotal); applyYoYBadge('sum-kpi-yoy-gp', currStats.gp, prevStats.gp);

  const mCurrRev = Array(12).fill(0), mPrevRev = Array(12).fill(0);
  currData.forEach(d => { if (d.type === '매출') mCurrRev[d.m - 1] += d.amt; }); prevData.forEach(d => { if (d.type === '매출') mPrevRev[d.m - 1] += d.amt; });

  renderChart('sum-chart-trend', 'line', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [{ label: `${currYear}년 매출`, data: mCurrRev, borderColor: '#4A90E2', backgroundColor: '#4A90E2', tension: 0.3, borderWidth: 3 }, { label: `${currYear - 1}년 매출`, data: mPrevRev, borderColor: '#B0BEC5', tension: 0.3, borderWidth: 2, borderDash: [5,5] }]
  });
  renderChart('sum-chart-cost', 'doughnut', { 
    labels: ['매출이익', '변동원가', '고정원가'], datasets: [{ data: [currStats.gp<0?0:currStats.gp, currStats.varC, currStats.fixC], backgroundColor: ['#F39C12', '#2E79B5', '#E9ECEF'], borderWidth: 0 }] 
  });
  drawTable(currData, prevData, 'sum-table', 'sum-table-head', state.view);
}

// --- 뷰 2 ---
function renderCardGrid() {
  const currYear = parseInt(state.year);
  const currData = rawData.filter(d => d.y === currYear && (state.month === 'All' || String(d.m) === state.month) && (state.hq === 'All' || d.hq === state.hq) && (state.team === 'All' || d.team === state.team));
  
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
        <div class="card-row border-top"><span>공헌이익</span><span class="val ${cm < 0 ? 'txt-red' : ''}">${formatMoney(cm)}</span></div>
        <div class="card-row"><span>공헌이익률</span><span class="val ${cmRatio < 0 ? 'txt-red' : ''}">${cmRatio.toFixed(1)}%</span></div>
        <div class="card-row border-top"><span>고정원가</span><span class="val">${formatMoney(row.fixC)}</span></div>
        <div class="card-row border-top highlight"><span>매출이익</span><span class="val ${gp < 0 ? 'txt-red' : ''}">${formatMoney(gp)}</span></div>
        <div class="card-row highlight"><span>매출이익률</span><span class="val ${gpRatio < 0 ? 'txt-red' : ''}">${gpRatio.toFixed(1)}%</span></div>
      `;
      container.appendChild(card);
    });
  };

  buildCards(sumExist, 'card-container-exist');
  buildCards(sumNew, 'card-container-new');
}

// --- 뷰 3 ---
function renderSingleClientDetail() {
  const currYear = parseInt(state.year);
  const clientName = state.clientView;
  
  // 월 무시하고 1년치 데이터 풀 땡겨옴
  const annualCurr = rawData.filter(d => d.y === currYear && d.client === clientName);
  const annualPrev = rawData.filter(d => d.y === currYear - 1 && d.client === clientName);
  
  const hq = annualCurr.length > 0 ? annualCurr[0].hq : '-';
  const team = annualCurr.length > 0 ? annualCurr[0].team : '-';
  document.getElementById('detail-title').innerText = clientName;
  document.getElementById('detail-subtitle').innerText = `${hq} / ${team} / ${currYear}년 연간 통합 리포트`;
  
  const currStats = calculateStats(annualCurr); const prevStats = calculateStats(annualPrev);

  document.getElementById('det-kpi-rev').innerText = formatMoney(currStats.revTotal);
  document.getElementById('det-kpi-cm').innerText = formatMoney(currStats.cm);
  document.getElementById('det-kpi-cm-rate').innerText = currStats.revTotal === 0 ? '0%' : (currStats.cm/currStats.revTotal*100).toFixed(1)+'%';
  document.getElementById('det-kpi-gp').innerText = formatMoney(currStats.gp);
  document.getElementById('det-kpi-gp-rate').innerText = currStats.revTotal === 0 ? '0%' : (currStats.gp/currStats.revTotal*100).toFixed(1)+'%';
  applyYoYBadge('det-kpi-yoy-rev', currStats.revTotal, prevStats.revTotal); applyYoYBadge('det-kpi-yoy-gp', currStats.gp, prevStats.gp);

  const m1Rev = Array(12).fill(0), m1CM = Array(12).fill(0), m1GP = Array(12).fill(0);
  const m2Rev = Array(12).fill(0), m2CM = Array(12).fill(0), m2GP = Array(12).fill(0);
  
  annualCurr.forEach(d => { const i = d.m-1; if(d.type==='매출'){ m1Rev[i]+=d.amt; m1CM[i]+=d.amt; m1GP[i]+=d.amt; } else if(d.type==='변동원가'){ m1CM[i]-=d.amt; m1GP[i]-=d.amt; } else if(d.type==='고정원가') m1GP[i]-=d.amt; });
  annualPrev.forEach(d => { const i = d.m-1; if(d.type==='매출'){ m2Rev[i]+=d.amt; m2CM[i]+=d.amt; m2GP[i]+=d.amt; } else if(d.type==='변동원가'){ m2CM[i]-=d.amt; m2GP[i]-=d.amt; } else if(d.type==='고정원가') m2GP[i]-=d.amt; });
  
  const safeRate = (profit, rev) => rev === 0 ? 0 : (profit / rev) * 100;
  const cap = (val) => val > 100 ? 100 : (val < -100 ? -100 : val);

  const real1CM = Array(12).fill(0), real1GP = Array(12).fill(0), chart1CM = Array(12).fill(0), chart1GP = Array(12).fill(0);
  const real2CM = Array(12).fill(0), real2GP = Array(12).fill(0), chart2CM = Array(12).fill(0), chart2GP = Array(12).fill(0);

  for(let i=0; i<12; i++) {
    real1CM[i] = safeRate(m1CM[i], m1Rev[i]); real1GP[i] = safeRate(m1GP[i], m1Rev[i]);
    real2CM[i] = safeRate(m2CM[i], m2Rev[i]); real2GP[i] = safeRate(m2GP[i], m2Rev[i]);
    chart1CM[i] = cap(real1CM[i]); chart1GP[i] = cap(real1GP[i]);
    chart2CM[i] = cap(real2CM[i]); chart2GP[i] = cap(real2GP[i]);
  }

  renderChart('det-chart-yoy', 'bar', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [{ label: `${currYear}년 매출`, data: m1Rev, backgroundColor: '#4A90E2', borderRadius: 4 }, { label: `${currYear-1}년 매출`, data: m2Rev, backgroundColor: '#DEE2E6', borderRadius: 4 }]
  });

  renderChart('det-chart-margin', 'line', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [
      { label: `${currYear} 공헌이익률(%)`, data: chart1CM, realData: real1CM, borderColor: '#00A6B2', tension: 0.3, borderWidth: 3 },
      { label: `${currYear} 매출이익률(%)`, data: chart1GP, realData: real1GP, borderColor: '#F39C12', tension: 0.3, borderWidth: 3 },
      { label: `${currYear-1} 공헌이익률(%)`, data: chart2CM, realData: real2CM, borderColor: '#B0BEC5', tension: 0.3, borderDash: [5,5], borderWidth: 2 },
      { label: `${currYear-1} 매출이익률(%)`, data: chart2GP, realData: real2GP, borderColor: '#E8A37E', tension: 0.3, borderDash: [5,5], borderWidth: 2 }
    ]
  }, {
    scales: { y: { min: -100, max: 100, ticks: { callback: v => v + '%' } } },
    plugins: { tooltip: { callbacks: { label: function(c) { let r = c.dataset.realData[c.dataIndex]; let p = c.dataset.label + ': '; if (r < -100) return p + r.toFixed(1) + '% (적자)'; if (r > 100) return p + r.toFixed(1) + '% (초과)'; return p + r.toFixed(1) + '%'; } } } }
  });

  // ★ 기존/신규 분리 렌더링 함수
  const drawDetTable = (isNewType, tableId, wrapId) => {
    const dCurr = annualCurr.filter(d => (isNewType === '신규' ? d.isNew === '신규' : d.isNew !== '신규'));
    const dPrev = annualPrev.filter(d => (isNewType === '신규' ? d.isNew === '신규' : d.isNew !== '신규'));
    const wrap = document.getElementById(wrapId);
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';
    
    if(dCurr.length === 0 && dPrev.length === 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';

    for (let m = 1; m <= 12; m++) {
      const cData = dCurr.filter(d => d.m === m); const pData = dPrev.filter(d => d.m === m);
      let cRev = 0, cTrans = 0, cLease = 0, cVar = 0, cFix = 0, pRev = 0;
      cData.forEach(d => { if (d.type === '매출') { cRev += d.amt; if (d.subject === '지입료수입') cLease += d.amt; else cTrans += d.amt; } else if (d.type === '변동원가') cVar += d.amt; else if (d.type === '고정원가') cFix += d.amt; });
      pData.forEach(d => { if (d.type === '매출') pRev += d.amt; });
      if (cRev === 0 && pRev === 0 && cVar === 0 && cFix === 0) continue;
      
      let yoyTxt = '-'; let yoyColor = 'inherit';
      if (pRev > 0) { const ratio = ((cRev - pRev) / pRev) * 100; yoyTxt = ratio > 0 ? `▲ ${ratio.toFixed(1)}%` : (ratio < 0 ? `▼ ${Math.abs(ratio).toFixed(1)}%` : '-'); yoyColor = ratio > 0 ? '#2E7D32' : (ratio < 0 ? '#C62828' : 'inherit'); }
      
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

// 공통 테이블 그리기 (본부/팀 전용)
function drawTable(currData, prevData, tableId, headId, viewMode) {
  const head = document.getElementById(headId); const tbody = document.querySelector(`#${tableId} tbody`);
  let headHtml = '<tr>';
  if (viewMode === 'hq') headHtml += '<th>조직(본부)</th>'; else headHtml += '<th>본부</th><th>팀</th>';
  headHtml += `<th>당기 매출</th><th>전년 동기 매출</th><th>증감률</th><th>운송수입</th><th>지입료수입</th><th>변동원가</th><th>공헌이익</th><th>공헌이익률</th><th>고정원가</th><th>매출이익</th><th>매출이익률</th></tr>`;
  head.innerHTML = headHtml; tbody.innerHTML = '';

  const summary = {};
  const groupData = (data, isPrev) => {
    data.forEach(d => {
      let key = d.hq; if (viewMode === 'team') key += `|${d.team}`;
      if (!summary[key]) summary[key] = { hq: d.hq, team: d.team, currRev: 0, prevRev: 0, trans: 0, lease: 0, varC: 0, fixC: 0 };
      if (isPrev) { if (d.type === '매출') summary[key].prevRev += d.amt; } 
      else {
        if (d.type === '매출') { summary[key].currRev += d.amt; if(d.subject === '지입료수입') summary[key].lease += d.amt; else summary[key].trans += d.amt; }
        else if (d.type === '변동원가') summary[key].varC += d.amt; else if (d.type === '고정원가') summary[key].fixC += d.amt;
      }
    });
  };

  groupData(prevData, true); groupData(currData, false);

  Object.values(summary).forEach(row => {
    if (row.currRev === 0 && row.prevRev === 0 && row.varC === 0 && row.fixC === 0) return; 
    let yoyTxt = '-'; let yoyColor = 'inherit';
    if (row.prevRev > 0) {
      const ratio = ((row.currRev - row.prevRev) / row.prevRev) * 100;
      yoyTxt = ratio > 0 ? `▲ ${ratio.toFixed(1)}%` : (ratio < 0 ? `▼ ${Math.abs(ratio).toFixed(1)}%` : '-');
      yoyColor = ratio > 0 ? '#2E7D32' : (ratio < 0 ? '#C62828' : 'inherit');
    }

    const cm = row.currRev - row.varC; const cmRatio = row.currRev === 0 ? 0 : (cm / row.currRev) * 100;
    const gp = cm - row.fixC; const gpRatio = row.currRev === 0 ? 0 : (gp / row.currRev) * 100;
    
    let trHtml = `<td class="text-center">${row.hq}</td>`;
    if (viewMode === 'team') trHtml += `<td class="text-center">${row.team}</td>`;
    trHtml += `<td style="font-weight:900;">${formatMoney(row.currRev)}</td><td style="color:#6C757D;">${formatMoney(row.prevRev)}</td><td style="color:${yoyColor}; font-weight:900;">${yoyTxt}</td><td>${formatMoney(row.trans)}</td><td>${formatMoney(row.lease)}</td><td>${formatMoney(row.varC)}</td><td style="color:#00A6B2; font-weight:900;">${formatMoney(cm)}</td><td style="font-size:12px; color:#6C757D;">${cmRatio.toFixed(1)}%</td><td>${formatMoney(row.fixC)}</td><td style="color:${gp < 0 ? '#DC3545' : '#212529'}; font-weight:900;">${formatMoney(gp)}</td><td style="font-size:12px; color:#6C757D;">${gpRatio.toFixed(1)}%</td>`;
    const tr = document.createElement('tr'); tr.innerHTML = trHtml; tbody.appendChild(tr);
  });
}

window.onload = fetchData;
