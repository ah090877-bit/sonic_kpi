// ★ 반드시 새로 배포하여 발급받은 최신 URL로 수정해 주세요!
const API_URL = 'https://script.google.com/macros/s/AKfycbxoRToFFWcjmzjxxYkvPHourAy9C3FxTBWzoASIgiKBWkyofecavJCVyCo8hRy306gq/exec';

let rawData = [];
let chartInstances = {};
const state = { year: 'All', month: 'All', hq: 'All', team: 'All', client: 'All' };

const formatMoney = (val) => (val / 1000000).toLocaleString('ko-KR', { maximumFractionDigits: 0 });

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
  
  const years = [...new Set(rawData.map(d => d.y))].sort((a,b)=>b-a);
  if(years.length > 0) state.year = years[0].toString();
  
  buildTopFilters(); 
  buildClientSidebar(); // 왼쪽 화주사 메뉴 생성
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
  
  populateSelect('f-year', [...new Set(filterDataFor('year').map(d => d.y))].sort((a,b)=>b-a), state.year, true);
  populateSelect('f-month', [...new Set(filterDataFor('month').map(d => d.m))].sort((a,b)=>a-b), state.month, true);
  populateSelect('f-hq', [...new Set(filterDataFor('hq').map(d => d.hq))].sort(), state.hq, true);
  populateSelect('f-team', [...new Set(filterDataFor('team').map(d => d.team))].sort(), state.team, true);
}

function populateSelect(id, options, selected, addAll) {
  const el = document.getElementById(id);
  const key = id.replace('f-', '');
  let currentVal = selected;
  if (currentVal !== 'All' && !options.includes(currentVal) && !options.includes(Number(currentVal))) {
    currentVal = 'All'; state[key] = 'All'; 
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
    buildClientSidebar(); // 상단 필터 변경 시 화주사 리스트도 업데이트
    updateDashboard();
  };
}

function buildClientSidebar() {
  const currentData = rawData.filter(d => {
    if (state.year !== 'All' && String(d.y) !== state.year) return false;
    if (state.month !== 'All' && String(d.m) !== state.month) return false;
    if (state.hq !== 'All' && d.hq !== state.hq) return false;
    if (state.team !== 'All' && d.team !== state.team) return false;
    return true;
  });
  
  const clients = [...new Set(currentData.map(d => d.client))].sort();
  const listEl = document.getElementById('client-list');
  listEl.innerHTML = '';
  
  if (state.client !== 'All' && !clients.includes(state.client)) { state.client = 'All'; }
  
  const liAll = document.createElement('li');
  liAll.className = 'client-item' + (state.client === 'All' ? ' active' : '');
  liAll.innerText = '전체 화주사';
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
    if (el.innerText === (clientName === 'All' ? '전체 화주사' : clientName)) {
      el.classList.add('active');
    }
  });
  updateDashboard();
}

function getFilteredData() {
  return rawData.filter(d => {
    if (state.year !== 'All' && String(d.y) !== state.year) return false;
    if (state.month !== 'All' && String(d.m) !== state.month) return false;
    if (state.hq !== 'All' && d.hq !== state.hq) return false;
    if (state.team !== 'All' && d.team !== state.team) return false;
    if (state.client !== 'All' && d.client !== state.client) return false;
    return true;
  });
}

function updateDashboard() {
  const currentData = getFilteredData();
  
  // KPI 계산 로직 (요청하신 공식 반영)
  let revTrans = 0, revLease = 0, varCost = 0, fixCost = 0;
  
  currentData.forEach(d => {
    if (d.type === '매출') {
      if (d.subject === '지입료수입') revLease += d.amt;
      else revTrans += d.amt;
    } else if (d.type === '변동원가') { varCost += d.amt; } 
    else if (d.type === '고정원가') { fixCost += d.amt; }
  });

  const totalRev = revTrans + revLease;
  const cm = totalRev - varCost; // 공헌이익
  const cmRatio = totalRev === 0 ? 0 : (cm / totalRev) * 100;
  const gp = cm - fixCost; // 매출이익 (매출-변동-고정)
  const gpRatio = totalRev === 0 ? 0 : (gp / totalRev) * 100;

  document.getElementById('kpi-rev').innerText = formatMoney(totalRev);
  document.getElementById('kpi-rev-trans').innerText = formatMoney(revTrans);
  document.getElementById('kpi-rev-lease').innerText = formatMoney(revLease);
  document.getElementById('kpi-var-cost').innerText = formatMoney(varCost);
  document.getElementById('kpi-cm').innerText = formatMoney(cm);
  document.getElementById('kpi-cm-ratio').innerText = cmRatio.toFixed(1) + '%';
  document.getElementById('kpi-fix-cost').innerText = formatMoney(fixCost);
  document.getElementById('kpi-gp').innerText = formatMoney(gp);
  document.getElementById('kpi-gp-ratio').innerText = gpRatio.toFixed(1) + '%';

  drawCharts(currentData);
  drawTable(currentData);
}

function drawCharts(data) {
  Chart.defaults.font.family = "'Malgun Gothic', sans-serif";
  const render = (id, type, chartData, options) => {
    if (chartInstances[id]) chartInstances[id].destroy();
    chartInstances[id] = new Chart(document.getElementById(id), { type, data: chartData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, ...options } });
  };

  // 1. 월별 트렌드
  const mRev = Array(12).fill(0), mCM = Array(12).fill(0), mGP = Array(12).fill(0);
  data.forEach(d => { 
    const idx = d.m - 1; 
    if (d.type === '매출') { mRev[idx] += d.amt; mCM[idx] += d.amt; mGP[idx] += d.amt; } 
    else if (d.type === '변동원가') { mCM[idx] -= d.amt; mGP[idx] -= d.amt; }
    else if (d.type === '고정원가') { mGP[idx] -= d.amt; }
  });

  render('chart-monthly-trend', 'line', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [
      { label: '매출', data: mRev, borderColor: '#777', backgroundColor: '#777', tension: 0.3, borderWidth: 2, borderDash: [5,5] },
      { label: '공헌이익', data: mCM, borderColor: '#00A6B2', backgroundColor: '#00A6B2', tension: 0.3, borderWidth: 3 },
      { label: '매출이익', data: mGP, borderColor: '#F39C12', backgroundColor: '#F39C12', tension: 0.3, borderWidth: 3 }
    ]
  });

  // 2. 구조 비율 (도넛)
  let sumRev=0, sumVar=0, sumFix=0;
  data.forEach(d => {
    if(d.type === '매출') sumRev += d.amt;
    else if(d.type === '변동원가') sumVar += d.amt;
    else if(d.type === '고정원가') sumFix += d.amt;
  });
  let sumGP = sumRev - sumVar - sumFix;
  if(sumGP < 0) sumGP = 0; // 마이너스 이익일 경우 도넛 차트 방어 로직

  render('chart-cost-structure', 'doughnut', { 
    labels: ['매출이익', '변동원가', '고정원가'], 
    datasets: [{ data: [sumGP, sumVar, sumFix], backgroundColor: ['#00A6B2', '#2E79B5', '#E2E6EB'], borderWidth: 0 }] 
  });
}

function drawTable(data) {
  const tbody = document.querySelector('#detail-table tbody'); tbody.innerHTML = '';
  const summary = {};
  
  data.forEach(d => {
    const key = `${d.y}-${String(d.m).padStart(2,'0')}|${d.hq}|${d.team}|${d.client}|${d.unit}`;
    if(!summary[key]) summary[key] = { rev: 0, varC: 0, fixC: 0 };
    if(d.type === '매출') summary[key].rev += d.amt;
    else if (d.type === '변동원가') summary[key].varC += d.amt;
    else if (d.type === '고정원가') summary[key].fixC += d.amt;
  });

  Object.keys(summary).forEach(key => {
    const row = summary[key];
    if (row.rev === 0 && row.varC === 0 && row.fixC === 0) return; 
    
    const [ym, hq, team, client, unit] = key.split('|');
    const cm = row.rev - row.varC;
    const gp = cm - row.fixC;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ym}</td><td>${hq}</td><td>${team}</td><td>${client}</td><td>${unit}</td>
      <td style="font-weight:bold;">${formatMoney(row.rev)}</td>
      <td>${formatMoney(row.varC)}</td>
      <td style="color:#00A6B2; font-weight:bold;">${formatMoney(cm)}</td>
      <td>${formatMoney(row.fixC)}</td>
      <td style="color:${gp < 0 ? '#E74C3C' : '#F39C12'}; font-weight:bold;">${formatMoney(gp)}</td>
    `;
    tbody.appendChild(tr);
  });
}

window.onload = fetchData;
