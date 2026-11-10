// ★ 기존에 쓰시던 URL 그대로 유지하세요!
const API_URL = 'https://script.google.com/macros/s/AKfycbxoRToFFWcjmzjxxYkvPHourAy9C3FxTBWzoASIgiKBWkyofecavJCVyCo8hRy306gq/exec';

let rawData = [];
let chartInstances = {};
const state = { view: 'hq', year: 'All', month: 'All', hq: 'All', team: 'All' };

// 금액 단위 축소 금지 (정확한 원 단위 콤마 표기)
const formatMoney = (val) => val.toLocaleString('ko-KR');

function fetchData() {
  document.getElementById('loader').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  
  fetch(API_URL)
    .then(response => response.json())
    .then(data => initApp(data))
    .catch(error => alert("데이터 동기화 실패: " + error));
}

function initApp(response) {
  if (!response.success) { alert("오류: " + response.error); return; }
  rawData = response.data;
  
  // 기본 연도를 가장 최신 연도로 세팅하여 전년 대비(YoY)가 작동하도록 함
  const years = [...new Set(rawData.map(d => d.y))].sort((a,b)=>b-a);
  if(years.length > 0) state.year = years[0].toString();
  
  setupSidebar();
  buildTopFilters(); 
  updateDashboard();
  
  document.getElementById('loader').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

function setupSidebar() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      e.target.classList.add('active');
      state.view = e.target.getAttribute('data-view');
      
      const titles = { hq: '본부별 실적 리포트', team: '팀별 실적 리포트', client: '화주사별 상세 리포트' };
      document.getElementById('table-title').innerText = titles[state.view];
      
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
  
  populateSelect('f-year', [...new Set(filterDataFor('year').map(d => d.y))].sort((a,b)=>b-a), state.year, false); // 연도는 '전체' 제외
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
    buildTopFilters(); 
    updateDashboard();
  };
}

function updateDashboard() {
  const currYear = parseInt(state.year);
  
  // 현재 선택된 기간의 데이터 필터링
  const currData = rawData.filter(d => {
    if (d.y !== currYear) return false;
    if (state.month !== 'All' && String(d.m) !== state.month) return false;
    if (state.hq !== 'All' && d.hq !== state.hq) return false;
    if (state.team !== 'All' && d.team !== state.team) return false;
    return true;
  });

  // 전년 동기 데이터 필터링 (비교용)
  const prevData = rawData.filter(d => {
    if (d.y !== currYear - 1) return false;
    if (state.month !== 'All' && String(d.m) !== state.month) return false;
    if (state.hq !== 'All' && d.hq !== state.hq) return false;
    if (state.team !== 'All' && d.team !== state.team) return false;
    return true;
  });

  // KPI 계산
  const currStats = calculateStats(currData);
  const prevStats = calculateStats(prevData);

  document.getElementById('kpi-rev').innerText = formatMoney(currStats.revTotal);
  document.getElementById('kpi-var-cost').innerText = formatMoney(currStats.varC);
  document.getElementById('kpi-cm').innerText = formatMoney(currStats.cm);
  document.getElementById('kpi-cm-ratio').innerText = currStats.revTotal === 0 ? '0%' : ((currStats.cm / currStats.revTotal) * 100).toFixed(1) + '%';
  document.getElementById('kpi-fix-cost').innerText = formatMoney(currStats.fixC);
  document.getElementById('kpi-gp').innerText = formatMoney(currStats.gp);
  document.getElementById('kpi-gp-ratio').innerText = currStats.revTotal === 0 ? '0%' : ((currStats.gp / currStats.revTotal) * 100).toFixed(1) + '%';

  // YoY 증감률 적용
  applyYoYBadge('kpi-rev-yoy', currStats.revTotal, prevStats.revTotal);
  applyYoYBadge('kpi-gp-yoy', currStats.gp, prevStats.gp);

  drawCharts(currData, prevData, currStats);
  drawTable(currData, prevData);
}

function calculateStats(data) {
  let res = { revTotal: 0, revTrans: 0, revLease: 0, varC: 0, fixC: 0, cm: 0, gp: 0 };
  data.forEach(d => {
    if (d.type === '매출') { res.revTotal += d.amt; if (d.subject === '지입료수입') res.revLease += d.amt; else res.revTrans += d.amt; } 
    else if (d.type === '변동원가') res.varC += d.amt;
    else if (d.type === '고정원가') res.fixC += d.amt;
  });
  res.cm = res.revTotal - res.varC;
  res.gp = res.cm - res.fixC;
  return res;
}

function applyYoYBadge(elementId, currVal, prevVal) {
  const el = document.getElementById(elementId);
  if (prevVal === 0) {
    el.innerText = '전년 실적 없음';
    el.className = 'yoy-badge yoy-none';
    return;
  }
  const diff = currVal - prevVal;
  const ratio = (diff / prevVal) * 100;
  
  if (ratio > 0) {
    el.innerText = `▲ ${ratio.toFixed(1)}% (+${formatMoney(diff)})`;
    el.className = 'yoy-badge yoy-up';
  } else if (ratio < 0) {
    el.innerText = `▼ ${Math.abs(ratio).toFixed(1)}% (${formatMoney(diff)})`;
    el.className = 'yoy-badge yoy-down';
  } else {
    el.innerText = '전년과 동일';
    el.className = 'yoy-badge yoy-none';
  }
}

function drawCharts(currData, prevData, currStats) {
  Chart.defaults.font.family = "'Malgun Gothic', sans-serif";
  const render = (id, type, chartData, options) => {
    if (chartInstances[id]) chartInstances[id].destroy();
    chartInstances[id] = new Chart(document.getElementById(id), { type, data: chartData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, ...options } });
  };

  // 전년 대비 월별 매출 추이
  const mCurrRev = Array(12).fill(0), mPrevRev = Array(12).fill(0);
  currData.forEach(d => { if (d.type === '매출') mCurrRev[d.m - 1] += d.amt; });
  prevData.forEach(d => { if (d.type === '매출') mPrevRev[d.m - 1] += d.amt; });

  render('chart-yoy-trend', 'line', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [
      { label: `${state.year}년 매출`, data: mCurrRev, borderColor: '#00A6B2', backgroundColor: '#00A6B2', tension: 0.3, borderWidth: 3 },
      { label: `${state.year - 1}년 매출`, data: mPrevRev, borderColor: '#B0BEC5', backgroundColor: 'transparent', tension: 0.3, borderWidth: 2, borderDash: [5,5] }
    ]
  });

  // 비용 구조 도넛
  let gp = currStats.gp < 0 ? 0 : currStats.gp;
  render('chart-cost-structure', 'doughnut', { 
    labels: ['매출이익', '변동원가', '고정원가'], 
    datasets: [{ data: [gp, currStats.varC, currStats.fixC], backgroundColor: ['#00A6B2', '#2E79B5', '#E2E6EB'], borderWidth: 0 }] 
  });
}

function drawTable(currData, prevData) {
  const head = document.getElementById('detail-table-head');
  const tbody = document.querySelector('#detail-table tbody');
  
  // 뷰에 따른 동적 헤더 생성
  let headHtml = '<tr>';
  if (state.view === 'hq') headHtml += '<th>본부</th>';
  else if (state.view === 'team') headHtml += '<th>본부</th><th>팀</th>';
  else headHtml += '<th>본부</th><th>팀</th><th>화주사</th>';
  
  headHtml += `
    <th>당기 매출</th><th>전년 동기 매출</th><th>증감률</th>
    <th>운송수입</th><th>지입료수입</th><th>변동원가</th>
    <th>공헌이익</th><th>(이익률)</th><th>고정원가</th><th>매출이익</th>
  </tr>`;
  head.innerHTML = headHtml;
  tbody.innerHTML = '';

  const summary = {};
  
  // 데이터 그룹핑 함수
  const groupData = (data, isPrev) => {
    data.forEach(d => {
      let key = d.hq;
      if (state.view === 'team' || state.view === 'client') key += `|${d.team}`;
      if (state.view === 'client') key += `|${d.client}`;
      
      if (!summary[key]) summary[key] = { hq: d.hq, team: d.team, client: d.client, currRev: 0, prevRev: 0, trans: 0, lease: 0, varC: 0, fixC: 0 };
      
      if (isPrev) {
        if (d.type === '매출') summary[key].prevRev += d.amt;
      } else {
        if (d.type === '매출') { 
          summary[key].currRev += d.amt; 
          if(d.subject === '지입료수입') summary[key].lease += d.amt; else summary[key].trans += d.amt;
        }
        else if (d.type === '변동원가') summary[key].varC += d.amt;
        else if (d.type === '고정원가') summary[key].fixC += d.amt;
      }
    });
  };

  groupData(prevData, true);
  groupData(currData, false);

  Object.values(summary).forEach(row => {
    if (row.currRev === 0 && row.prevRev === 0 && row.varC === 0 && row.fixC === 0) return; 
    
    let yoyTxt = '-';
    let yoyColor = 'inherit';
    if (row.prevRev > 0) {
      const ratio = ((row.currRev - row.prevRev) / row.prevRev) * 100;
      yoyTxt = ratio > 0 ? `▲ ${ratio.toFixed(1)}%` : (ratio < 0 ? `▼ ${Math.abs(ratio).toFixed(1)}%` : '-');
      yoyColor = ratio > 0 ? '#2E7D32' : (ratio < 0 ? '#C62828' : 'inherit');
    } else if(row.currRev > 0) {
      yoyTxt = '신규(비교불가)';
    }

    const cm = row.currRev - row.varC;
    const cmRatio = row.currRev === 0 ? 0 : (cm / row.currRev) * 100;
    const gp = cm - row.fixC;
    
    let trHtml = '';
    trHtml += `<td class="text-center">${row.hq}</td>`;
    if (state.view === 'team' || state.view === 'client') trHtml += `<td class="text-center">${row.team}</td>`;
    if (state.view === 'client') trHtml += `<td class="text-center">${row.client}</td>`;

    trHtml += `
      <td style="font-weight:bold;">${formatMoney(row.currRev)}</td>
      <td style="color:#777;">${formatMoney(row.prevRev)}</td>
      <td style="color:${yoyColor}; font-weight:bold;">${yoyTxt}</td>
      <td>${formatMoney(row.trans)}</td>
      <td>${formatMoney(row.lease)}</td>
      <td>${formatMoney(row.varC)}</td>
      <td style="color:#00A6B2; font-weight:bold;">${formatMoney(cm)}</td>
      <td style="font-size:11px; color:#555;">${cmRatio.toFixed(1)}%</td>
      <td>${formatMoney(row.fixC)}</td>
      <td style="color:${gp < 0 ? '#E74C3C' : '#E67E22'}; font-weight:bold;">${formatMoney(gp)}</td>
    `;
    
    const tr = document.createElement('tr');
    tr.innerHTML = trHtml;
    tbody.appendChild(tr);
  });
}

window.onload = fetchData;
