
// ===== Utilities =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const todayISO = () => new Date().toISOString().slice(0,10);
const toNumber = (v) => v === '' || v === null || isNaN(Number(v)) ? null : Number(v);
const e1rm = (w, r) => (w ?? 0) * (1 + (r ?? 0)/30);
const fmtNum = (n, dec=1) => (n === null || n === undefined || isNaN(n)) ? '' : (dec===0 ? Math.round(n).toString() : (Math.round(n*10**dec)/10**dec).toFixed(dec));
const escapeHtml = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// ===== Storage =====
const STORAGE_KEY = 'stDataV1';
const DEFAULT_EXERCISES = ['Back Squat','Bench Press','Deadlift','Overhead Press','Barbell Row','Pull-up','Dumbbell Bench','RDL'];

let state = { exercises: DEFAULT_EXERCISES, logs: [] };

function load() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.exercises = Array.isArray(parsed.exercises) && parsed.exercises.length ? parsed.exercises : DEFAULT_EXERCISES.slice();
      state.logs = Array.isArray(parsed.logs) ? parsed.logs : [];
    } catch {}
  }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ===== UI Init =====
function init() {
  load();
  // Tabs
  $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    $$('.tab').forEach(sec => sec.classList.remove('active'));
    $('#tab-' + tab).classList.add('active');
    if (tab === 'history') renderHistory();
    if (tab === 'progress') renderProgressSelectors();
  }));

  // Date default
  $('#log-date').value = todayISO();

  // Exercise selects
  renderExerciseSelects();

  // Add from settings
  $('#add-exercise-settings').addEventListener('click', () => {
    const name = $('#new-exercise-name').value.trim();
    if (!name) return;
    if (!state.exercises.includes(name)) {
      state.exercises.push(name);
      save();
      renderExerciseSelects();
      renderExerciseList();
      $('#new-exercise-name').value = '';
    }
  });

  // Add from log quick button
  $('#add-exercise-btn').addEventListener('click', () => {
    const name = prompt('New exercise name:');
    if (!name) return;
    const n = name.trim();
    if (!n) return;
    if (!state.exercises.includes(n)) {
      state.exercises.push(n);
      save();
      renderExerciseSelects();
      renderExerciseList();
      $('#log-exercise').value = n;
    }
  });

  // Log form
  $('#log-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const log = {
      id: crypto.randomUUID(),
      date: $('#log-date').value || todayISO(),
      exercise: $('#log-exercise').value,
      weight: toNumber($('#log-weight').value),
      reps: toNumber($('#log-reps').value),
      rpe: toNumber($('#log-rpe').value),
      notes: $('#log-notes').value.trim()
    };
    state.logs.push(log);
    save();
    renderToday();
    renderHistory();
    $('#log-notes').value = '';
    $('#log-weight').focus();
  });

  // Duplicate last
  $('#quick-duplicate').addEventListener('click', () => {
    const ex = $('#log-exercise').value;
    const last = [...state.logs].reverse().find(l => l.exercise === ex);
    if (last) {
      $('#log-weight').value = last.weight ?? '';
      $('#log-reps').value = last.reps ?? '';
      $('#log-rpe').value = last.rpe ?? '';
      $('#log-notes').value = last.notes ?? '';
    }
  });

  // History filters/exports
  $('#history-search').addEventListener('input', renderHistory);
  $('#export-json').addEventListener('click', exportJSON);
  $('#import-json').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', importJSON);
  $('#export-csv').addEventListener('click', exportCSV);

  // Settings
  $('#clear-data').addEventListener('click', () => {
    if (confirm('This will delete ALL workouts and exercises. Continue?')) {
      state = { exercises: DEFAULT_EXERCISES.slice(), logs: [] };
      save();
      renderExerciseSelects();
      renderExerciseList();
      renderToday();
      renderHistory();
      alert('Cleared.');
    }
  });

  renderExerciseList();
  renderToday();
  renderHistory();
  renderProgressSelectors();

  // iOS PWA hint (optional)
  if (!localStorage.getItem('pwaHintShown')) {
    setTimeout(()=>{
      if (window.navigator.standalone !== true) {
        alert('Tip: In Safari, tap Share → "Add to Home Screen" to install this app.');
      }
      localStorage.setItem('pwaHintShown', '1');
    }, 600);
  }
}

function renderExerciseSelects() {
  const opts = state.exercises.map(e => `<option value="${e}">${e}</option>`).join('');
  $('#log-exercise').innerHTML = opts;
  $('#progress-exercise').innerHTML = `<option value="">(select)</option>` + opts;
}

function renderExerciseList() {
  const wrap = $('#exercise-list');
  wrap.innerHTML = '';
  state.exercises.forEach(name => {
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = `
      <input value="${name}" data-name="${name}" />
      <button data-action="rename">Rename</button>
      <button data-action="delete">Delete</button>
    `;
    wrap.appendChild(div);
    const input = div.querySelector('input');
    div.querySelector('[data-action="rename"]').onclick = () => {
      const newName = input.value.trim();
      if (!newName) return;
      const idx = state.exercises.indexOf(name);
      if (idx >= 0) state.exercises[idx] = newName;
      state.logs.forEach(l => { if (l.exercise === name) l.exercise = newName; });
      save();
      renderExerciseSelects();
      renderHistory();
      renderToday();
    };
    div.querySelector('[data-action="delete"]').onclick = () => {
      if (!confirm(`Delete exercise "${name}"? Existing logs keep their old name.`)) return;
      state.exercises = state.exercises.filter(e => e !== name);
      save();
      renderExerciseSelects();
      renderExerciseList();
    };
  });
}

// Today's table (by selected date) + SUMMARY
function renderToday() {
  const d = $('#log-date').value || todayISO();
  const rows = state.logs.filter(l => l.date === d)
    .sort((a,b)=> a.exercise.localeCompare(b.exercise) || a.id.localeCompare(b.id));
  const tbody = $('#today-table tbody');
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.exercise}</td>
      <td>${fmtNum(r.weight)}</td>
      <td>${fmtNum(r.reps,0)}</td>
      <td>${fmtNum(r.rpe)}</td>
      <td>${fmtNum(e1rm(r.weight, r.reps))}</td>
      <td>${escapeHtml(r.notes || '')}</td>
      <td><button data-id="${r.id}" class="del">✕</button></td>
    </tr>
  `).join('');
  tbody.querySelectorAll('button.del').forEach(btn => btn.onclick = () => delLog(btn.dataset.id));

  // ===== Summary numbers =====
  const totalVolume = rows.reduce((t,s)=> t + (s.weight||0) * (s.reps||0), 0);
  const setsCount = rows.length;
  const distinctExercises = new Set(rows.map(r=>r.exercise)).size;
  const bestE1 = rows.length ? Math.max(...rows.map(r => e1rm(r.weight, r.reps))) : 0;

  $('#summary-volume').textContent = fmtNum(totalVolume, 0);
  $('#summary-sets').textContent = setsCount.toString();
  $('#summary-exercises').textContent = distinctExercises.toString();
  $('#summary-e1rm').textContent = fmtNum(bestE1);
}

function delLog(id) {
  state.logs = state.logs.filter(l => l.id !== id);
  save();
  renderToday();
  renderHistory();
}

// History table
function renderHistory() {
  const q = $('#history-search').value?.toLowerCase() ?? '';
  const rows = [...state.logs]
    .filter(l => !q || l.exercise.toLowerCase().includes(q) || (l.notes||'').toLowerCase().includes(q))
    .sort((a,b)=> a.date.localeCompare(b.date) || a.exercise.localeCompare(b.exercise));
  const tbody = $('#history-table tbody');
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.exercise}</td>
      <td>${fmtNum(r.weight)}</td>
      <td>${fmtNum(r.reps,0)}</td>
      <td>${fmtNum(r.rpe)}</td>
      <td>${fmtNum(e1rm(r.weight, r.reps))}</td>
      <td>${escapeHtml(r.notes || '')}</td>
      <td><button data-id="${r.id}" class="del">✕</button></td>
    </tr>
  `).join('');
  tbody.querySelectorAll('button.del').forEach(btn => btn.onclick = () => delLog(btn.dataset.id));
}

// Progress
let chart;
function renderProgressSelectors() {
  const exSel = $('#progress-exercise');
  if (!exSel.value && exSel.options.length > 1) exSel.value = exSel.options[1].value;
  $('#progress-exercise').onchange = renderChart;
  $('#progress-metric').onchange = renderChart;
  $('#progress-window').onchange = renderChart;
  renderChart();
}

function renderChart() {
  const ex = $('#progress-exercise').value;
  const metric = $('#progress-metric').value;
  const windowSel = $('#progress-window').value;

  if (!ex) return;

  let logs = state.logs.filter(l => l.exercise === ex);
  if (windowSel !== 'all') {
    const days = Number(windowSel);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    logs = logs.filter(l => new Date(l.date) >= cutoff);
  }

  // Aggregate by date
  const byDate = {};
  logs.forEach(l => {
    const key = l.date;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(l);
  });
  const labels = Object.keys(byDate).sort();
  const data = labels.map(d => {
    const sets = byDate[d];
    if (metric === 'e1rm') {
      return Math.max(...sets.map(s => e1rm(s.weight, s.reps)));
    } else if (metric === 'max_weight') {
      return Math.max(...sets.map(s => s.weight || 0));
    } else { // volume
      return sets.reduce((t,s)=> t + (s.weight||0) * (s.reps||0), 0);
    }
  });

  // PR cards (for the chosen exercise)
  const bestE1RM = logs.length ? Math.max(...logs.map(l => e1rm(l.weight,l.reps))) : 0;
  const bestWeight = logs.length ? Math.max(...logs.map(l => l.weight || 0)) : 0;
  const totalVolume = logs.reduce((t,s)=> t + (s.weight||0)*(s.reps||0),0);
  const sessions = new Set(logs.map(l => l.date)).size;

  const cards = $('#pr-cards');
  cards.innerHTML = `
    <div class="card"><strong>${ex}</strong><br><span class="dim">Exercise</span></div>
    <div class="card"><strong>${fmtNum(bestE1RM)}</strong><br><span class="dim">Best e1RM</span></div>
    <div class="card"><strong>${fmtNum(bestWeight)}</strong><br><span class="dim">Heaviest Set</span></div>
    <div class="card"><strong>${fmtNum(totalVolume,0)}</strong><br><span class="dim">Total Volume</span></div>
    <div class="card"><strong>${sessions}</strong><br><span class="dim">Sessions</span></div>
  `;

  const ctx = document.getElementById('progress-chart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: metricLabel(metric), data, tension: 0.25, fill: false }]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { color: '#c7d2fe' }, grid: { color: '#2c3446' } },
        y: { ticks: { color: '#c7d2fe' }, grid: { color: '#2c3446' } }
      },
      plugins: {
        legend: { labels: { color: '#e5e7eb' } }
      }
    }
  });
}

function metricLabel(m) {
  if (m === 'e1rm') return 'Estimated 1RM (lb)';
  if (m === 'max_weight') return 'Max Weight (lb)';
  return 'Total Volume (lb)';
}

// Export / Import
function exportJSON() {
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  download(url, 'strength-data.json');
}

function importJSON(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj || !Array.isArray(obj.logs) || !Array.isArray(obj.exercises)) throw new Error('Invalid file');
      state = { exercises: obj.exercises, logs: obj.logs };
      save();
      renderExerciseSelects();
      renderExerciseList();
      renderToday();
      renderHistory();
      alert('Data imported ✔️');
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
  };
  reader.readAsText(file);
}

function exportCSV() {
  const cols = ['date','exercise','weight','reps','rpe','e1rm','notes'];
  const lines = [cols.join(',')];
  state.logs.forEach(l => {
    const row = [
      l.date,
      `"${(l.exercise||'').replace(/"/g,'""')}"`,
      l.weight ?? '',
      l.reps ?? '',
      l.rpe ?? '',
      e1rm(l.weight, l.reps).toFixed(1),
      `"${(l.notes||'').replace(/"/g,'""')}"`
    ];
    lines.push(row.join(','));
  });
  const blob = new Blob([lines.join('\n')], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  download(url, 'strength-data.csv');
}

function download(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

// Init
document.addEventListener('DOMContentLoaded', init);
