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
let editingReservationId = null; 
let pendingAuthAction = null;

// ═══ AUTENTICAÇÃO SIMPLES POR PIN ═══
const AUTH_PIN_HASH = '17887b'; // Hash simples do PIN configurado

function hashPin(pin) {
  return Array.from(pin)
    .reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) >>> 0, 0)
    .toString(16);
}

function isAuthenticated() {
  return sessionStorage.getItem('calendar_auth') === 'true';
}

function requireAuth(action) {
  if (isAuthenticated()) {
    action();
    return;
  }
  pendingAuthAction = action;
  document.getElementById('overlay-auth').classList.add('active');
  document.getElementById('auth-pin').focus();
}

function submitAuth() {
  const pin = document.getElementById('auth-pin').value.trim();
  if (!pin) {
    alert('Digite o PIN para continuar.');
    return;
  }
  if (hashPin(pin) !== AUTH_PIN_HASH) {
    alert('PIN incorreto.');
    return;
  }
  sessionStorage.setItem('calendar_auth', 'true');
  document.getElementById('overlay-auth').classList.remove('active');
  document.getElementById('auth-pin').value = '';
  if (pendingAuthAction) {
    const action = pendingAuthAction;
    pendingAuthAction = null;
    action();
  }
}

function resetAuth() {
  document.getElementById('auth-pin').value = '';
  document.getElementById('auth-pin').focus();
}

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

// ═══ MODAL NOVA RESERVA / EDIÇÃO ═══
function openNew() {
  requireAuth(() => {
    editingReservationId = null;
    document.querySelector('.modal-new h2').textContent = "Nova Reserva / Recorrência";
    document.getElementById('lbl-date-start').textContent = "Data de Início";
    document.getElementById('field-date-end').style.display = "block"; // Exibe opção de repetir
    const t = new Date();
    document.getElementById('f-date').value = toKey(t.getFullYear(), t.getMonth(), t.getDate());
    clearForm();
    document.getElementById('overlay-new').classList.add('active');
  });
}

function openNewDate(dateKey) {
  requireAuth(() => {
    editingReservationId = null;
    document.querySelector('.modal-new h2').textContent = "Nova Reserva / Recorrência";
    document.getElementById('lbl-date-start').textContent = "Data de Início";
    document.getElementById('field-date-end').style.display = "block"; // Exibe opção de repetir
    clearForm();
    document.getElementById('f-date').value = dateKey;
    document.getElementById('overlay-new').classList.add('active');
  });
}

function clearForm() {
  ['f-prof','f-curso','f-fase','f-prog','f-obs', 'f-date-end'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-start').value = '19:00'; // Alterado para 19:00 padrão
  document.getElementById('f-end').value = '22:35';   // Alterado para 22:35 padrão
  document.getElementById('f-lab').value = 'cyan';
}

// SALVAR RESERVA (ÚNICA OU EM LOTE RECORRENTE)
async function saveReservation() {
  const dateStartStr = document.getElementById('f-date').value;
  const dateEndStr   = document.getElementById('f-date-end').value;
  const lab          = document.getElementById('f-lab').value;
  const prof         = document.getElementById('f-prof').value.trim();
  const curso        = document.getElementById('f-curso').value.trim();
  const fase         = document.getElementById('f-fase').value.trim();
  const start        = document.getElementById('f-start').value;
  const end          = document.getElementById('f-end').value;
  const prog         = document.getElementById('f-prog').value.trim();
  const obs          = document.getElementById('f-obs').value.trim();
  
  if (!dateStartStr || !prof || !curso) {
    alert('Por favor, preencha a data de início, o professor e o curso.');
    return;
  }

  // Base do objeto para salvar
  const basePayload = { lab, prof, curso, fase, start_time: start, end_time: end, prog, obs };

  try {
    if (editingReservationId) {
      // ── MODO EDIÇÃO SINGLE ──
      const { error } = await _supabase
        .from('reservas')
        .update({ date: dateStartStr, ...basePayload })
        .eq('id', editingReservationId);

      if (error) throw error;
    } else {
      // ── MODO CRIAÇÃO (VERIFICA RECORRÊNCIA) ──
      let payloads = [];

      if (dateEndStr) {
        // Se preencheu a data final, gera a lista de datas com o mesmo dia da semana
        let dAtual = new Date(dateStartStr + 'T00:00:00');
        const dFim = new Date(dateEndStr + 'T00:00:00');

        if (dFim < dAtual) {
          alert('A data final não pode ser menor que a data de início!');
          return;
        }

        // Loop pulando de 7 em 7 dias
        while (dAtual <= dFim) {
          const key = toKey(dAtual.getFullYear(), dAtual.getMonth(), dAtual.getDate());
          payloads.push({ date: key, ...basePayload });
          dAtual.setDate(dAtual.getDate() + 7);
        }
      } else {
        // Reserva única tradicional
        payloads.push({ date: dateStartStr, ...basePayload });
      }

      // Envia em lote tudo pro Supabase de uma só vez!
      const { error } = await _supabase
        .from('reservas')
        .insert(payloads);

      if (error) throw error;
    }

    closeModal('overlay-new');
    fetchReservations();
    
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
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
    <div class="modal-foot-spaced">
      <button class="btn-danger" onclick="deleteReservation(${r.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        Excluir
      </button>
      <div>
        <button class="btn-ghost" onclick="startEdit(${r.id})" style="margin-right: 5px;">Editar</button>
        <button class="btn-primary" onclick="closeModal('overlay-detail')">Fechar</button>
      </div>
    </div>
  `;
  document.getElementById('overlay-detail').classList.add('active');
}

// ABRE O FORMULÁRIO COM OS DADOS PREENCHIDOS PARA EDITAR
function startEdit(id) {
  requireAuth(() => {
    const r = reservations.find(x => x.id === id);
    if (!r) return;

    editingReservationId = id;
    closeModal('overlay-detail');

    document.querySelector('.modal-new h2').textContent = "Editar Reserva";
    document.getElementById('lbl-date-start').textContent = "Data da Reserva";
    document.getElementById('field-date-end').style.display = "none"; // Oculta a recorrência na edição simples

    document.getElementById('f-date').value = r.date;
    document.getElementById('f-lab').value = r.lab;
    document.getElementById('f-prof').value = r.prof;
    document.getElementById('f-curso').value = r.curso;
    document.getElementById('f-fase').value = r.fase;
    document.getElementById('f-start').value = r.start_time;
    document.getElementById('f-end').value = r.end_time;
    document.getElementById('f-prog').value = r.prog;
    document.getElementById('f-obs').value = r.obs;

    document.getElementById('overlay-new').classList.add('active');
  });
}

// DELETAR RESERVA DO BANCO DE DADOS
async function deleteReservation(id) {
  requireAuth(async () => {
    if (!confirm("Tem certeza absoluta que deseja excluir esta reserva?")) return;

    try {
      const { error } = await _supabase
        .from('reservas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      closeModal('overlay-detail');
      fetchReservations(); 
    } catch (err) {
      alert('Erro ao excluir a reserva: ' + err.message);
    }
  });
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
if (isAuthenticated()) {
  document.getElementById('overlay-auth').classList.remove('active');
}
fetchReservations();
