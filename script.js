// ★ 복사해 둔 구글 앱스 스크립트 배포 URL을 입력하세요.
const API_URL = 'https://script.google.com/macros/s/AKfycbxoRToFFWcjmzjxxYkvPHourAy9C3FxTBWzoASIgiKBWkyofecavJCVyCo8hRy306gq/exec';

let rawData = [];
let chartInstances = {};
const state = { year: 'All', month: 'All', hq: 'All', team: 'All', isNew: 'All', client: 'All' };
const formatMoney = (val) => (val / 1000000).toLocaleString('ko-KR', { maximumFractionDigits: 0 });
const isRevenue = (type) => type === '매출';

function fetchData() {
  document.getElementById('loader').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  
  fetch(API_URL)
    .then(response => response.json())
    .then(data => initApp(data))
    .catch(error => alert("데이터 로드 실패: " + error));
}

function initApp(response) {
  if (!response.success) { alert("오류: " + response.error); return; }
  rawData = response.data;
  const years = [...new Set(rawData.map(d => d.y))].sort((a,b)=>b-a);
  if(years.length > 0) state.year = years[0].toString();
  buildFilters(); 
  updateDashboard();
  
  document.getElementById('loader').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

function buildFilters() {
  const filterDataFor = (skipKey) => rawData.filter(d => {
    if (skipKey !== 'year' && state.year !== 'All' && String(d.y) !== state.year) return false;
    if (skipKey !== 'month' && state.month !== 'All' && String(d.m) !== state.month) return false;
    if (skipKey !== 'hq' && state.hq !== 'All' && d.hq !== state.hq) return false;
    if (skipKey !== 'team' && state.team !== 'All' && d.team !== state.team) return false;
    if (skipKey !== 'isNew' && state.isNew !== 'All' && d.isNew !== state.isNew) return false;
    return true;
  });
  populateSelect('f-year', [...new Set(filterDataFor('year').map(d => d.y))].sort((a,b)=>b-a), state.year, true);
  populateSelect('f-month', [...new Set(filterDataFor('month').map(d => d.m))].sort((a,b)=>a-b), state.month, true);
  populateSelect('f-hq', [...new Set(filterDataFor('hq').map(d => d.hq))].sort(), state.hq, true);
  populateSelect('f-team', [...new Set(filterDataFor('team').map(d => d.team))].sort(), state.team, true);
  populateSelect('f-isnew', [...new Set(filterDataFor('isNew').map(d => d.isNew))].sort(), state.isNew, true);
  populateSelect('f-client', [...new Set(filterDataFor('client').map(d => d.client))].sort(), state.client, true);
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
    if (key === 'year') { state.month = 'All'; state.hq = 'All'; state.team = 'All'; state.client = 'All'; }
    else if (key === 'month') { state.hq = 'All'; state.team = 'All'; state.client = 'All'; }
    else if (key === 'hq') { state.team = 'All'; state.client = 'All'; }
    else if (key === 'team') { state.client = 'All'; }
    buildFilters(); updateDashboard();
  };
}

function getFilteredData() {
  return rawData.filter(d => {
    if (state.year !== 'All' && String(d.y) !== state.year) return false;
    if (state.month !== 'All' && String(d.m) !== state.month) return false;
    if (state.hq !== 'All' && d.hq !== state.hq) return false;
    if (state.team !== 'All' && d.team !== state.team) return false;
    if (state.isNew !== 'All' && d.isNew !== state.isNew) return false;
    if (state.client !== 'All' && d.client !== state.client) return false;
    return true;
  });
}

function updateDashboard() {
  const currentData = getFilteredData();
  updateKPIs(currentData); drawCharts(currentData); drawTable(currentData);
}

function updateKPIs(data) {
  let rev = 0, cost = 0, newRev = 0, existRev = 0;
  data.forEach(d => {
    if (isRevenue(d.type)) { rev += d.amt; if (d.isNew === '신규') newRev += d.amt; else existRev += d.amt; } 
    else { cost += d.amt; }
  });
  const profit = rev - cost;
  const margin = rev === 0 ? 0 : (profit / rev) * 100;
  let prevRev = 0, currRev = 0;
  if (state.year !== 'All') {
    const targetYear = parseInt(state.year);
    rawData.forEach(d => {
      let match = (state.month === 'All' || String(d.m) === state.month) && (state.hq === 'All' || d.hq === state.hq) && (state.team === 'All' || d.team === state.team);
      if (match && isRevenue(d.type)) { if (d.y === targetYear) currRev += d.amt; if (d.y === targetYear - 1) prevRev += d.amt; }
    });
  }
  const yoy = prevRev === 0 ? '-' : (((currRev - prevRev) / prevRev) * 100).toFixed(1) + '%';
  document.getElementById('kpi-rev').innerText = formatMoney(rev);
  document.getElementById('kpi-exist').innerText = formatMoney(existRev);
  document.getElementById('kpi-new').innerText = formatMoney(newRev);
  document.getElementById('kpi-cost').innerText = formatMoney(cost);
  document.getElementById('kpi-profit').innerText = formatMoney(profit);
  document.getElementById('kpi-margin').innerText = margin.toFixed(1) + '%';
  document.getElementById('kpi-yoy').innerText = yoy;
}

function drawCharts(data) {
  const render = (id, type, chartData, options) => {
    if (chartInstances[id]) chartInstances[id].destroy();
    chartInstances[id] = new Chart(document.getElementById(id), { type, data: chartData, options: { responsive: true, maintainAspectRatio: false, ...options } });
  };
  const monthlyRev = Array(12).fill(0), monthlyProf = Array(12).fill(0);
  data.forEach(d => { const idx = d.m - 1; if (isRevenue(d.type)) { monthlyRev[idx] += d.amt; monthlyProf[idx] += d.amt; } else monthlyProf[idx] -= d.amt; });
  render('chart-monthly-trend', 'bar', {
    labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    datasets: [{ type: 'line', label: '손익', data: monthlyProf, borderColor: '#0070F3', backgroundColor: '#0070F3', tension: 0.1 }, { type: 'bar', label: '매출', data: monthlyRev, backgroundColor: '#0A2540' }]
  });
  const typeAggr = { '기존': 0, '신규': 0 };
  data.filter(d => isRevenue(d.type)).forEach(d => { if(typeAggr[d.isNew] !== undefined) typeAggr[d.isNew] += d.amt; });
  render('chart-new-exist', 'doughnut', { labels: ['기존 사업', '신규 사업'], datasets: [{ data: [typeAggr['기존'], typeAggr['신규']], backgroundColor: ['#0A2540', '#0070F3'] }] });
  const hqMap = {}; data.filter(d=>isRevenue(d.type)).forEach(d => { hqMap[d.hq] = (hqMap[d.hq]||0) + d.amt; });
  render('chart-hq-share', 'pie', { labels: Object.keys(hqMap), datasets: [{ data: Object.values(hqMap), backgroundColor: ['#0A2540', '#0070F3', '#85C1E9', '#E5E7EB'] }] });
  const teamMap = {}; data.filter(d=>isRevenue(d.type)).forEach(d => { teamMap[d.team] = (teamMap[d.team]||0) + d.amt; });
  const sortedTeams = Object.entries(teamMap).sort((a,b)=>b[1]-a[1]).slice(0, 10);
  render('chart-team-comp', 'bar', { labels: sortedTeams.map(t => t[0]), datasets: [{ label: '매출', data: sortedTeams.map(t => t[1]), backgroundColor: '#0A2540' }] }, { indexAxis: 'y' });
}

function drawTable(data) {
  const tbody = document.querySelector('#detail-table tbody'); tbody.innerHTML = '';
  const summary = {};
  data.forEach(d => {
    const key = `${d.y}-${d.m}|${d.hq}|${d.team}|${d.client}|${d.unit}|${d.isNew}`;
    if(!summary[key]) summary[key] = { rev: 0, cost: 0 };
    if(isRevenue(d.type)) summary[key].rev += d.amt; else summary[key].cost += d.amt;
  });
  Object.keys(summary).forEach(key => {
    const row = summary[key];
    if (row.rev === 0 && row.cost === 0) return; 
    const [ym, hq, team, client, unit, isNew] = key.split('|');
    const profit = row.rev - row.cost;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${ym}</td><td>${hq}</td><td>${team}</td><td>${client}</td><td>${unit}</td><td>${isNew}</td><td>${formatMoney(row.rev)}</td><td>${formatMoney(row.cost)}</td><td style="color: ${profit < 0 ? 'red' : 'inherit'}">${formatMoney(profit)}</td>`;
    tbody.appendChild(tr);
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(btn.dataset.target).classList.add('active');
  });
});

window.onload = fetchData;
