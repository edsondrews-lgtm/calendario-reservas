// ═══ CONFIGURAÇÃO DO SUPABASE ═══
// ═══ CONFIGURAÇÃO DO SUPABASE ═══
// SUBSTITUA OS VALORES ABAIXO PELOS DADOS DO SEU PAINEL DO SUPABASE
const SUPABASE_URL = "https://pkpftazklvittlhzdhgz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Vtn77Q1yZqNB1ZOhxRz9YA_LHP8K2l1";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══ DADOS E CONFIGURAÇÕES DO CALENDÁRIO ═══
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const LAB_NAMES = { cyan: 'Laboratório Ciano', blue: 'Laboratório Azul' };

let currentDate = new Date();
let reservations = [];

// ═══ UTILITÁRIOS ═══
function pad(n) { return String(n).padStart(2,'0'); }
function toKey(y,m,d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
function todayKey() {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth(), t.getDate());
}

// ═══ BUSCAR DADOS DO BANCO (SUPABASE) ═══
async function fetchReservations() {
  try {
    const { data, error } = await _supabase
      .from('reservas')
      .select('*');
    
    if (error) throw error;
    
    reservations = data.map(r => ({
      id: r.id,
      date: r.date,
      lab: r.lab,
      prof: r.prof,
      curso: r.curso,
      fase: r.fase || '',
      start_time: r.start_time,
      end_time: r.end_time,
      prog: r.prog || '',
      obs: r.obs || ''
    }));
    
    render();
  } catch (err) {
    console.error('Erro ao buscar reservas:', err.message);
  }
}

// ═══ STATS ═══
function renderStats() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const monthKey = `${y}-${pad(m+1)}`;
  const thisMonth = reservations.filter(r => r.date.startsWith(monthKey));
  const cyanCount = thisMonth.filter(r => r.lab === 'cyan').length;
  const blueCount = thisMonth.filter(r => r.lab === 'blue').length;

  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon gray">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <div>
        <div class="stat-label">Total no mês</div>
        <div class="stat-value">${thisMonth.length}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon cyan">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <div>
        <div class="stat-label">Lab. Ciano</div>
        <div class="stat-value">${cyanCount}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon blue">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <div>
        <div class="stat-label">Lab. Azul</div>
        <div class="stat-value">${blueCount}</div>
      </div>
    </div>
  `;
}

// ═══ CALENDÁRIO ═══
function render() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  document.getElementById('cal-title').textContent = `${MONTHS[m]} ${y}`;

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const tk = todayKey();
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  let total = firstDay + daysInMonth;
  if (total % 7 !== 0) total += 7 - (total % 7);

  for (let i = 0; i < total; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';

    let day, dateKey, other = false;
    if (i < firstDay) {
      const pm = new Date(y, m, 0);
      day = pm.getDate() - firstDay + i + 1;
      dateKey = toKey(y, m-1 >= 0 ? m-1 : 11, day);
      other = true;
    } else if (i >= firstDay + daysInMonth) {
      day = i - firstDay - daysInMonth + 1;
      dateKey = toKey(y, m+1 <= 11 ? m+1 : 0, day);
      other = true;
    } else {
      day = i - firstDay + 1;
      dateKey = toKey(y, m, day);
    }

    if (other) cell.classList.add('other-month');
    if (dateKey === tk) cell.classList.add('today');

    const dn = document.createElement('div');
    dn.className = 'day-num';
    dn.textContent = day;
    cell.appendChild(dn);

    const rsvs = reservations.filter(r => r.date === dateKey)
      .sort((a,b) => a.start_time.localeCompare(b.start_time));

    const show = rsvs.slice(0, 3);
    show.forEach(r => {
      const chip = document.createElement('button');
      chip.className = `res-chip ${r.lab}`;
      chip.type = 'button';
      const shortName = r.prof.replace(/^Prof[a]?\.\s*/i, '');
      chip.innerHTML = `<span class="res-chip-name">${shortName}</span><span class="res-chip-sub">${r.start_time} · ${r.curso}</span>`;
      chip.addEventListener('click', (e) => { e.stopPropagation(); openDetail(r.id); });
      cell.appendChild(chip);
    });
    if (rsvs.length > 3) {
      const more = document.createElement('span');
      more.className = 'more-badge';
      more.textContent = `+${rsvs.length - 3} mais`;
      cell.appendChild(more);
    }

    cell.addEventListener('click', () => { if (!other) openNewDate(dateKey); });
    grid.appendChild(cell);
  }

  renderStats();
}

function changeMonth(d) {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + d, 1);
  render();
}
function goToday() {
  currentDate = new Date();
  render();
}

// ═══ MODAL NOVA RESERVA ═══
function openNew() {
  const t = new Date();
  document.getElementById('f-date').value = toKey(t.getFullYear(), t.getMonth(), t.getDate());
  clearForm();
  document.getElementById('overlay-new').classList.add('active');
}
function openNewDate(dateKey) {
  clearForm();
  document.getElementById('f-date').value = dateKey;
  document.getElementById('overlay-new').classList.add('active');
}
function clearForm() {
  ['f-prof','f-curso','f-fase','f-prog','f-obs'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-start').value = '08:00';
  document.getElementById('f-end').value = '10:00';
  document.getElementById('f-lab').value = 'cyan';
}

// SALVAR RESERVA DIRETAMENTE NO BANCO DE DADOS
async function saveReservation() {
  const date  = document.getElementById('f-date').value;
  const lab   = document.getElementById('f-lab').value;
  const prof  = document.getElementById('f-prof').value.trim();
  const curso = document.getElementById('f-curso').value.trim();
  const fase  = document.getElementById('f-fase').value.trim();
  const start = document.getElementById('f-start').value;
  const end   = document.getElementById('f-end').value;
  const prog  = document.getElementById('f-prog').value.trim();
  const obs   = document.getElementById('f-obs').value.trim();
  
  if (!date || !prof || !curso) {
    alert('Por favor, preencha a data, o professor e o curso.');
    return;
  }

  try {
    const { data, error } = await _supabase
      .from('reservas')
      .insert([
        { 
          date: date, 
          lab: lab, 
          prof: prof, 
          curso: curso, 
          fase: fase, 
          start_time: start, 
          end_time: end, 
          prog: prog, 
          obs: obs 
        }
      ])
      .select();

    if (error) throw error;

    closeModal('overlay-new');
    fetchReservations();
    
  } catch (err) {
    alert('Erro ao salvar a reserva: ' + err.message);
  }
}

// ═══ MODAL DETALHE ═══
function openDetail(id) {
  const r = reservations.find(x => x.id === id);
  if (!r) return;
  const labName = LAB_NAMES[r.lab];
  const obsHtml = r.obs
    ? `<p>${r.obs}</p>`
    : `<span class="detail-obs-empty">Nenhuma observação registrada.</span>`;

  let progHtml = '';
  if (r.prog) {
    progHtml = `
      <div class="detail-row">
        <div class="detail-row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
        </div>
        <div>
          <div class="detail-row-label">Programa / Software</div>
          <div class="detail-row-value">${r.prog}</div>
        </div>
      </div>`;
  }

  document.getElementById('modal-detail-content').innerHTML = `
    <div class="modal-head">
      <h2>Detalhes da Reserva</h2>
      <button class="btn-close" onclick="closeModal('overlay-detail')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="detail-lab-banner">
      <div class="detail-lab-icon ${r.lab}">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <div>
        <div class="detail-lab-name">${labName}</div>
        <span class="tag-lab ${r.lab}">${r.date.split('-').reverse().join('/')}</span>
      </div>
    </div>
    <div class="detail-body">
      <div class="detail-row">
        <div class="detail-row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div>
          <div class="detail-row-label">Professor(a)</div>
          <div class="detail-row-value">${r.prof}</div>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>
        <div>
          <div class="detail-row-label">Curso &amp; Fase</div>
          <div class="detail-row-value">${r.curso}${r.fase ? ' · ' + r.fase : ''}</div>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div>
          <div class="detail-row-label">Horário</div>
          <div class="detail-row-value">${r.start_time} – ${r.end_time}</div>
        </div>
      </div>
      ${progHtml}
      <hr class="detail-divider">
      <div class="detail-row-label" style="margin-bottom:8px">Observações</div>
      <div class="detail-obs-box">${obsHtml}</div>
    </div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeModal('overlay-detail')">Fechar</button>
    </div>
  `;
  document.getElementById('overlay-detail').classList.add('active');
}

// ═══ FECHAR MODAIS ═══
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function handleClose(e, id) { if (e.target.id === id) closeModal(id); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal('overlay-new');
    closeModal('overlay-detail');
  }
});

// ═══ INIT ═══
fetchReservations();