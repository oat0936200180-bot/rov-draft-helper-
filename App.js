const ROLES = { ALL: 'ทั้งหมด', DS: 'DS Lane', JG: 'Jungle', MID: 'Mid', AD: 'AD Carry', SUP: 'Support' };
const COLORS = { DS: '#dc2626', JG: '#16a34a', MID: '#7c3aed', AD: '#d97706', SUP: '#0891b2' };
const AXES = [['burst', 'Burst'], ['cc', 'CC'], ['poke', 'Poke'], ['sustain', 'Sustain'], ['tank', 'Tank'], ['mobile', 'Mobility']];
const KEY = 'rov-draft-v2';
const $ = (id) => document.getElementById(id);

let DATA = { heroes: [], rules: [] };
let state = load();
let roleFilter = 'ALL', query = '', chart;

function fresh() { return { blue: Array(5).fill(null), red: Array(5).fill(null), bans: [], active: { team: 'blue', i: 0 } }; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.blue && s.red) return s; } catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
const hero = (n) => DATA.heroes.find((h) => h.n === n);
const taken = (n) => state.bans.includes(n) || state.blue.includes(n) || state.red.includes(n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function avatar(h) {
  return `<div class="avatar" style="background:${COLORS[h.r]}">${esc(h.n[0])}</div>`;
}

/* ---- scoring ---- */
function score(h, enemies) {
  let s = 0; const good = [], bad = [];
  enemies.forEach((e) => {
    DATA.rules.forEach((r) => {
      if (h.t.includes(r.a) && e.t.includes(r.d)) { s += r.w; good.push(`ชนะ ${e.n}: ${r.why}`); }
      if (e.t.includes(r.a) && h.t.includes(r.d)) { s -= r.w; bad.push(`แพ้ ${e.n}: ${r.why}`); }
    });
  });
  return { s, good, bad };
}
function recommend() {
  const enemies = state.red.filter(Boolean).map(hero).filter(Boolean);
  const mine = state.blue.filter(Boolean).map(hero).filter(Boolean);
  const needRole = (r) => !mine.some((m) => m.r === r);
  const pool = DATA.heroes.filter((h) => !taken(h.n)).map((h) => {
    const r = score(h, enemies);
    const roleBonus = needRole(h.r) ? 1 : 0;
    return { h, total: r.s + roleBonus, good: r.good, bad: r.bad, roleBonus };
  });
  const sorted = pool.sort((a, b) => b.total - a.total);
  return { good: sorted.filter((x) => x.total > 0).slice(0, 5), bad: sorted.filter((x) => x.total < 0).reverse().slice(0, 5), hasEnemy: enemies.length > 0 };
}

/* ---- render ---- */
function renderSlots() {
  ['blue', 'red'].forEach((team) => {
    $(team + 'Slots').innerHTML = state[team].map((n, i) => {
      const h = n && hero(n), act = state.active.team === team && state.active.i === i;
      return `<div class="slot ${act ? 'active' : ''}" data-team="${team}" data-i="${i}" role="button" tabindex="0" aria-label="ช่อง ${i + 1}">
        ${h ? avatar(h) : '<div class="avatar bg-slate-700 text-slate-400">?</div>'}
        <div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">${h ? esc(h.n) : 'ว่าง'}</div>
        <div class="text-xs text-slate-400">${h ? ROLES[h.r] : 'ช่อง ' + (i + 1)}</div></div>
        ${h ? `<button class="clear text-slate-400 hover:text-red-400 px-2" aria-label="ลบ ${esc(h.n)}" data-team="${team}" data-i="${i}">✕</button>` : ''}</div>`;
    }).join('');
  });
  const a = state.active;
  $('activeSlotText').textContent = `กำลังเลือกให้: ${a.team === 'blue' ? 'ทีมเรา' : 'ทีมตรงข้าม'} (ช่อง ${a.i + 1})`;
}
function renderBans() {
  $('banCount').textContent = `(${state.bans.length})`;
  $('banContainer').innerHTML = state.bans.length
    ? state.bans.map((n) => `<button class="unban px-2 py-1 rounded-md bg-red-500/20 border border-red-500/40 text-xs text-red-200" data-n="${esc(n)}" title="คลิกเพื่อยกเลิกแบน">${esc(n)} ✕</button>`).join('')
    : '<p class="text-xs text-slate-400 italic">ยังไม่มีการแบน กดปุ่ม “แบน” บนการ์ดฮีโร่</p>';
}
function renderPool() {
  const list = DATA.heroes.filter((h) => (roleFilter === 'ALL' || h.r === roleFilter) && h.n.toLowerCase().includes(query));
  $('heroPool').innerHTML = list.map((h) => {
    const off = taken(h.n);
    return `<div class="hero-card ${off ? 'disabled' : 'cursor-pointer'}" data-n="${esc(h.n)}">
      <div class="flex items-center gap-2">${avatar(h)}<div class="min-w-0"><div class="text-sm font-medium truncate">${esc(h.n)}</div><div class="text-xs text-slate-400">${ROLES[h.r]}</div></div></div>
      ${off ? '' : `<button class="ban mt-2 w-full text-xs py-0.5 rounded bg-red-500/15 text-red-300 hover:bg-red-500/30" data-n="${esc(h.n)}">แบน</button>`}</div>`;
  }).join('') || '<p class="text-sm text-slate-400 col-span-full">ไม่พบฮีโร่</p>';
}
function renderRec() {
  const r = recommend();
  const row = (x, ok) => `<div class="flex items-start gap-2">${avatar(x.h)}<div class="text-xs"><div class="font-semibold">${esc(x.h.n)} <span class="${ok ? 'text-emerald-400' : 'text-rose-400'}">${x.total > 0 ? '+' : ''}${x.total}</span></div>
    <div class="text-slate-300">${esc((ok ? x.good : x.bad)[0] || (x.roleBonus ? 'ทีมยังขาดตำแหน่งนี้' : ''))}</div></div></div>`;
  const empty = '<p class="text-xs text-slate-400 italic">เลือกฮีโร่ฝั่งตรงข้ามเพื่อรับคำแนะนำ</p>';
  $('recommendedContainer').innerHTML = r.hasEnemy && r.good.length ? r.good.map((x) => row(x, true)).join('') : empty;
  $('avoidContainer').innerHTML = r.hasEnemy && r.bad.length ? r.bad.map((x) => row(x, false)).join('') : empty;
}
function renderRadar() {
  const mine = state.blue.filter(Boolean).map(hero).filter(Boolean);
  const vals = AXES.map(([k]) => mine.filter((h) => h.t.includes(k)).length);
  if (!window.Chart) return;
  const data = { labels: AXES.map((a) => a[1]), datasets: [{ data: vals, backgroundColor: 'rgba(34,211,238,.25)', borderColor: '#22d3ee', pointBackgroundColor: '#22d3ee' }] };
  if (chart) { chart.data = data; chart.update(); return; }
  chart = new Chart($('radarChart'), { type: 'radar', data, options: {
    maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { r: { min: 0, max: 5, ticks: { display: false, stepSize: 1 }, grid: { color: '#334155' }, angleLines: { color: '#334155' }, pointLabels: { color: '#cbd5e1', font: { family: 'Kanit' } } } } } });
}
function renderAll() { renderSlots(); renderBans(); renderPool(); renderRec(); renderRadar(); save(); }

/* ---- actions ---- */
function nextEmpty(team, from) {
  for (let k = 1; k <= 5; k++) { const i = (from + k) % 5; if (!state[team][i]) return i; }
  return from;
}
function pick(n) {
  if (taken(n)) return;
  const { team, i } = state.active;
  state[team][i] = n;
  state.active.i = nextEmpty(team, i);
  renderAll();
}
function ban(n) {
  if (taken(n)) return;
  state.bans.push(n); renderAll();
}

function bind() {
  $('heroPool').addEventListener('click', (e) => {
    const b = e.target.closest('.ban');
    if (b) return ban(b.dataset.n);
    const c = e.target.closest('.hero-card');
    if (c) pick(c.dataset.n);
  });
  ['blueSlots', 'redSlots'].forEach((id) => {
    const el = $(id);
    const act = (e) => {
      const clr = e.target.closest('.clear'), s = e.target.closest('.slot');
      if (clr) { state[clr.dataset.team][+clr.dataset.i] = null; }
      if (s) state.active = { team: s.dataset.team, i: +s.dataset.i };
      renderAll();
    };
    el.addEventListener('click', act);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('slot')) act(e); });
  });
  $('banContainer').addEventListener('click', (e) => {
    const u = e.target.closest('.unban');
    if (u) { state.bans = state.bans.filter((n) => n !== u.dataset.n); renderAll(); }
  });
  $('btnReset').addEventListener('click', () => { if (confirm('ล้างการดราฟทั้งหมด?')) { state = fresh(); renderAll(); } });
  $('searchInput').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); renderPool(); });
  $('roleFilters').innerHTML = Object.entries(ROLES).map(([k, v]) => `<button class="role-btn ${k === 'ALL' ? 'active' : ''} px-3 py-1 rounded-md text-xs font-medium" data-role="${k}">${v}</button>`).join('');
  $('roleFilters').addEventListener('click', (e) => {
    const b = e.target.closest('.role-btn'); if (!b) return;
    roleFilter = b.dataset.role;
    document.querySelectorAll('.role-btn').forEach((x) => x.classList.toggle('active', x === b));
    renderPool();
  });
}

async function init() {
  bind();
  try {
    const res = await fetch('heroes.json');
    if (!res.ok) throw new Error(res.status);
    DATA = await res.json();
    $('patchInfo').textContent = `ข้อมูล: ${DATA.patch} (อัปเดต ${DATA.updated})`;
  } catch (err) {
    $('errorBox').textContent = 'โหลด heroes.json ไม่สำเร็จ ถ้าเปิดไฟล์ตรง ๆ (file://) ให้รันผ่านเซิร์ฟเวอร์ เช่น "npx serve" หรือใช้ GitHub Pages';
    $('errorBox').classList.remove('hidden');
    $('patchInfo').textContent = 'ไม่มีข้อมูล';
  }
  // ลบชื่อที่ไม่มีในข้อมูลแล้ว (กรณีแพตช์เปลี่ยน)
  ['blue', 'red'].forEach((t) => (state[t] = state[t].map((n) => (n && hero(n) ? n : null))));
  state.bans = state.bans.filter((n) => hero(n));
  renderAll();
}
init();
