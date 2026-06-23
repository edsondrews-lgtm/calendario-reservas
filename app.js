// ═══ CONFIGURAÇÃO DO SUPABASE ═══
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
let authPinHash = null;
let viewerPinHash = null;

// ═══ AUTENTICAÇÃO ═══
function hashPin(pin) {
  return Array.from(pin)
    .reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) >>> 0, 0)
    .toString(16);
}

async function loadPinHash() {
  try {
    const { data, error } = await _supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['auth_pin_hash', 'viewer_pin_hash']);
    if (error) throw error;
    data.forEach(row => {
      if (row.chave === 'auth_pin_hash')   authPinHash   = row.valor;
      if (row.chave === 'viewer_pin_hash') viewerPinHash = row.valor;
    });
  } catch (err) {
    console.error('Erro ao carregar PINs:', err);
  }
}

function getRole() {
  return sessionStorage.getItem('calendar_role');
}

function isAuthenticated() {
  return !!getRole();
}

function isAdmin() {
  return getRole() === 'admin';
}

function applyRole(role) {
  const isViewer = role === 'viewer';
  const btnNew = document.getElementById('btn-new-reserva');
  if (btnNew) btnNew.style.display = isViewer ? 'none' : '';
  const badge = document.getElementById('role-badge');
  if (badge) {
    badge.textContent = isViewer ? 'Modo Visualização' : 'Admin';
    badge.className = 'role-badge ' + (isViewer ? 'viewer' : 'admin');
    badge.style.display = '';
  }
}

function requireAuth(action) {
  if (isAdmin()) { action(); return; }
  pendingAuthAction = action;
  document.getElementById('overlay-auth').classList.add('active');
  document.getElementById('auth-pin').focus();
}

function submitAuth() {
  const pin = document.getElementById('auth-pin').value.trim();
  if (!pin) { showToast('Digite o PIN para continuar.', 'error'); return; }
  if (!authPinHash) { showToast('PIN ainda não foi carregado.', 'error'); return; }

  let role = null;
  if (hashPin(pin) === authPinHash)        role = 'admin';
  else if (viewerPinHash && hashPin(pin) === viewerPinHash) role = 'viewer';

  if (!role) { showToast('PIN incorreto.', 'error'); return; }

  sessionStorage.setItem('calendar_role', role);
  document.getElementById('overlay-auth').classList.remove('active');
  document.getElementById('auth-pin').value = '';
  applyRole(role);

  if (role === 'admin' && pendingAuthAction) {
    const action = pendingAuthAction;
    pendingAuthAction = null;
    action();
  }
  if (role === 'viewer') {
    pendingAuthAction = null;
    showToast('Acesso como visitante — somente visualização.');
  }
}

function resetAuth() {
  document.getElementById('auth-pin').value = '';
  document.getElementById('auth-pin').focus();
}

// ═══ TOAST DE NOTIFICAÇÃO ═══
function showToast(msg, type = 'success') {
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      ${type === 'success'
        ? '<polyline points="20 6 9 17 4 12"/>'
        : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
    </svg>
    <span>${msg}</span>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ═══ UTILITÁRIOS ═══
function pad(n) { return String(n).padStart(2, '0'); }
function toKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function todayKey() {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth(), t.getDate());
}

// ═══ BUSCAR DADOS DO BANCO ═══
async function fetchReservations() {
  try {
    const { data, error } = await _supabase.from('reservas').select('*');
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
      obs: r.obs || '',
      tipo: r.tipo || 'reserva'
    }));
    render();
  } catch (err) {
    console.error('Erro ao buscar reservas:', err.message);
    showToast('Erro ao carregar dados.', 'error');
  }
}

// ═══ TOGGLE DE CAMPOS DO FORMULÁRIO ═══
function toggleFormFields() {
  const tipo = document.getElementById('f-tipo').value;
  const isAviso = tipo === 'aviso';

  document.getElementById('field-lab').style.display    = isAviso ? 'none' : 'block';
  document.getElementById('field-curso').style.display  = isAviso ? 'none' : 'grid';
  document.getElementById('field-horario').style.display = isAviso ? 'none' : 'grid';
  document.getElementById('field-prog').style.display   = isAviso ? 'none' : 'block';
  document.getElementById('field-obs').style.display    = isAviso ? 'none' : 'block';
  document.getElementById('field-date-end').style.display = isAviso ? 'none' : 'block';

  document.getElementById('lbl-prof').textContent = isAviso ? 'Título do Aviso' : 'Professor(a)';

  document.getElementById('f-prof').placeholder = isAviso
    ? 'Ex: Dinâmica especial, Manutenção, Evento...'
    : 'Ex: Prof. Anderson';
}

// ═══ STATS ═══
function renderStats() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const monthKey = `${y}-${pad(m + 1)}`;
  const thisMonth = reservations.filter(r => r.date.startsWith(monthKey) && r.tipo !== 'aviso');
  const cyanCount = thisMonth.filter(r => r.lab === 'cyan').length;
  const blueCount = thisMonth.filter(r => r.lab === 'blue').length;

  renderAvisosDoMes(m + 1, y);

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

// ═══ RENDERIZAR AVISOS DO MÊS ═══
function renderAvisosDoMes(mes, ano) {
  const container = document.getElementById('container-avisos');
  if (!container) return;
  container.innerHTML = '';

  const monthKey = `${ano}-${pad(mes)}`;
  const avisos = reservations.filter(r => r.tipo === 'aviso' && r.date.startsWith(monthKey));

  avisos.forEach(aviso => {
    const div = document.createElement('div');
    div.className = 'tarja-aviso';
    const dataFormatada = aviso.date.split('-').reverse().join('/');
    div.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="flex-shrink:0">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span><strong>${dataFormatada}</strong> — ${aviso.prof || 'Sem título'}</span>
    `;
    container.appendChild(div);
  });
}

// ═══ CALENDÁRIO ═══
function render() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  document.getElementById('cal-title').textContent = `${MONTHS[m]} ${y}`;

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
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
      dateKey = toKey(y, m - 1 >= 0 ? m - 1 : 11, day);
      other = true;
    } else if (i >= firstDay + daysInMonth) {
      day = i - firstDay - daysInMonth + 1;
      dateKey = toKey(y, m + 1 <= 11 ? m + 1 : 0, day);
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

    // Reservas normais (sem avisos)
    const rsvs = reservations
      .filter(r => r.date === dateKey && r.tipo !== 'aviso')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    const show = rsvs.slice(0, 3);
    show.forEach(r => {
      const chip = document.createElement('button');
      chip.className = `res-chip ${r.lab}`;
      chip.type = 'button';
      const shortName = r.prof.replace(/^Prof[a]?\.\s*/i, '');
      chip.innerHTML = `<span class="res-chip-name">${shortName}</span><span class="res-chip-curso">${r.curso}</span>`;
      chip.addEventListener('click', e => { e.stopPropagation(); openDetail(r.id); });
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
function goToday() { currentDate = new Date(); render(); }

// ═══ MODAL NOVA RESERVA / EDIÇÃO ═══
function openNew() {
  requireAuth(() => {
    editingReservationId = null;
    document.querySelector('.modal-new h2').textContent = 'Nova Reserva / Recorrência';
    document.getElementById('lbl-date-start').textContent = 'Data de Início';
    const t = new Date();
    document.getElementById('f-date').value = toKey(t.getFullYear(), t.getMonth(), t.getDate());
    clearForm();
    document.getElementById('overlay-new').classList.add('active');
  });
}

function openNewDate(dateKey) {
  requireAuth(() => {
    editingReservationId = null;
    document.querySelector('.modal-new h2').textContent = 'Nova Reserva / Recorrência';
    document.getElementById('lbl-date-start').textContent = 'Data de Início';
    clearForm();
    document.getElementById('f-date').value = dateKey;
    document.getElementById('overlay-new').classList.add('active');
  });
}

function clearForm() {
  ['f-prof', 'f-curso', 'f-fase', 'f-prog', 'f-obs', 'f-date-end'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-start').value = '19:00';
  document.getElementById('f-end').value = '22:35';
  document.getElementById('f-lab').value = 'cyan';
  document.getElementById('f-tipo').value = 'reserva';
  toggleFormFields();
}

// ═══ VALIDAÇÃO DE CONFLITO DE HORÁRIO ═══
function verificarConflitos(payloads) {
  const conflitos = [];
  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  for (const payload of payloads) {
    const { date, lab, start_time, end_time } = payload;

    const reservasDoDia = reservations.filter(r =>
      r.date === date &&
      r.lab === lab &&
      r.tipo !== 'aviso' &&
      r.id !== editingReservationId
    );

    const novoInicio = toMin(start_time);
    const novoFim    = toMin(end_time);

    for (const r of reservasDoDia) {
      const existInicio = toMin(r.start_time);
      const existFim    = toMin(r.end_time);

      const overlap = novoInicio < existFim && novoFim > existInicio;
      if (overlap) {
        conflitos.push({
          date,
          lab: LAB_NAMES[lab] || lab,
          prof: r.prof,
          start_time: r.start_time,
          end_time: r.end_time
        });
      }
    }
  }

  return conflitos;
}

function montarMensagemConflito(conflitos) {
  const linhas = conflitos.map(c => {
    const data = c.date.split('-').reverse().join('/');
    return `• ${data} — ${c.lab}\n  ${c.prof} (${c.start_time}–${c.end_time})`;
  });
  return `⚠️ Conflito de horário detectado!\n\nJá existe reserva neste horário:\n\n${linhas.join('\n\n')}\n\nDeseja salvar mesmo assim?`;
}

// ═══ SALVAR RESERVA OU AVISO ═══
async function saveReservation() {
  const tipo         = document.getElementById('f-tipo').value;
  const dateStartStr = document.getElementById('f-date').value;
  const dateEndStr   = document.getElementById('f-date-end').value;
  const prof         = document.getElementById('f-prof').value.trim();
  const lab          = document.getElementById('f-lab').value;
  const curso        = document.getElementById('f-curso').value.trim();
  const fase         = document.getElementById('f-fase').value.trim();
  const start        = document.getElementById('f-start').value;
  const end          = document.getElementById('f-end').value;
  const prog         = document.getElementById('f-prog').value.trim();
  const obs          = document.getElementById('f-obs').value.trim();

  if (!dateStartStr || !prof) {
    showToast('Preencha a data e o ' + (tipo === 'aviso' ? 'título do aviso.' : 'nome do professor.'), 'error');
    return;
  }
  if (tipo === 'reserva' && !curso) {
    showToast('Preencha o curso.', 'error');
    return;
  }

  const basePayload = tipo === 'aviso'
    ? { prof, tipo, lab: 'cyan', curso: '', fase: '', start_time: '00:00', end_time: '00:00', prog: '', obs: '' }
    : { prof, tipo, lab, curso, fase, start_time: start, end_time: end, prog, obs };

  try {
    if (editingReservationId) {
      if (tipo !== 'aviso') {
        const conflitos = verificarConflitos([{ date: dateStartStr, lab, start_time: start, end_time: end }]);
        if (conflitos.length > 0) {
          if (!confirm(montarMensagemConflito(conflitos))) return;
        }
      }
      const { error } = await _supabase
        .from('reservas')
        .update({ date: dateStartStr, ...basePayload })
        .eq('id', editingReservationId);
      if (error) throw error;
      showToast('Reserva atualizada com sucesso!');
    } else {
      let payloads = [];

      if (tipo !== 'aviso' && dateEndStr) {
        let dAtual = new Date(dateStartStr + 'T00:00:00');
        const dFim = new Date(dateEndStr + 'T00:00:00');
        if (dFim < dAtual) {
          showToast('A data final não pode ser menor que a data de início!', 'error');
          return;
        }
        while (dAtual <= dFim) {
          const key = toKey(dAtual.getFullYear(), dAtual.getMonth(), dAtual.getDate());
          payloads.push({ date: key, ...basePayload });
          dAtual.setDate(dAtual.getDate() + 7);
        }
      } else {
        payloads.push({ date: dateStartStr, ...basePayload });
      }

      if (tipo !== 'aviso') {
        const conflitos = verificarConflitos(payloads);
        if (conflitos.length > 0) {
          if (!confirm(montarMensagemConflito(conflitos))) return;
        }
      }
      const { error } = await _supabase.from('reservas').insert(payloads);
      if (error) throw error;

      const msg = payloads.length > 1
        ? `${payloads.length} reservas criadas com sucesso!`
        : tipo === 'aviso' ? 'Aviso criado com sucesso!' : 'Reserva criada com sucesso!';
      showToast(msg);
    }

    closeModal('overlay-new');
    fetchReservations();
  } catch (err) {
    showToast('Erro ao salvar: ' + err.message, 'error');
  }
}

// ═══ MODAL DETALHE — AVISO ═══
function openDetailAviso(id) {
  const r = reservations.find(x => x.id === id);
  if (!r) return;
  const dataFormatada = r.date.split('-').reverse().join('/');

  document.getElementById('modal-detail-content').innerHTML = `
    <div class="modal-head">
      <h2>Detalhes do Aviso</h2>
      <button class="btn-close" onclick="closeModal('overlay-detail')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="detail-lab-banner" style="background: #fffde7; border-bottom-color: #fbc02d;">
      <div class="detail-lab-icon" style="background:#fff9c4;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#856404" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div>
        <div class="detail-lab-name">${r.prof || 'Aviso'}</div>
        <span class="tag-lab" style="background:#fff9c4;color:#856404;">${dataFormatada}</span>
      </div>
    </div>
    <div class="modal-foot-spaced">
      ${isAdmin() ? `
      <button class="btn-danger" onclick="deleteReservation(${r.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Excluir
      </button>
      ` : '<div></div>'}
      <button class="btn-primary" onclick="closeModal('overlay-detail')">Fechar</button>
    </div>
  `;
  document.getElementById('overlay-detail').classList.add('active');
}

// ═══ MODAL DETALHE — RESERVA ═══
function openDetail(id) {
  const r = reservations.find(x => x.id === id);
  if (!r) return;

  if (r.tipo === 'aviso') { openDetailAviso(id); return; }

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
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
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
      ${isAdmin() ? `
      <button class="btn-danger" onclick="deleteReservation(${r.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Excluir
      </button>
      <div>
        <button class="btn-ghost" onclick="startEdit(${r.id})" style="margin-right:5px">Editar</button>
        <button class="btn-primary" onclick="closeModal('overlay-detail')">Fechar</button>
      </div>
      ` : `
      <div></div>
      <button class="btn-primary" onclick="closeModal('overlay-detail')">Fechar</button>
      `}
    </div>
  `;
  document.getElementById('overlay-detail').classList.add('active');
}

// ═══ EDITAR RESERVA ═══
function startEdit(id) {
  requireAuth(() => {
    const r = reservations.find(x => x.id === id);
    if (!r) return;

    editingReservationId = id;
    closeModal('overlay-detail');

    document.querySelector('.modal-new h2').textContent = 'Editar Reserva';
    document.getElementById('lbl-date-start').textContent = 'Data da Reserva';

    document.getElementById('f-date').value  = r.date;
    document.getElementById('f-tipo').value  = r.tipo || 'reserva';
    document.getElementById('f-lab').value   = r.lab;
    document.getElementById('f-prof').value  = r.prof;
    document.getElementById('f-curso').value = r.curso;
    document.getElementById('f-fase').value  = r.fase;
    document.getElementById('f-start').value = r.start_time;
    document.getElementById('f-end').value   = r.end_time;
    document.getElementById('f-prog').value  = r.prog;
    document.getElementById('f-obs').value   = r.obs;
    document.getElementById('f-date-end').value = '';

    toggleFormFields();
    document.getElementById('field-date-end').style.display = 'none';

    document.getElementById('overlay-new').classList.add('active');
  });
}

// ═══ DELETAR ═══
async function deleteReservation(id) {
  requireAuth(async () => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
      const { error } = await _supabase.from('reservas').delete().eq('id', id);
      if (error) throw error;
      closeModal('overlay-detail');
      showToast('Registro excluído.');
      fetchReservations();
    } catch (err) {
      showToast('Erro ao excluir: ' + err.message, 'error');
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
(async () => {
  const role = getRole();
  if (role) {
    document.getElementById('overlay-auth').classList.remove('active');
    applyRole(role);
  }
  await loadPinHash();
  await fetchReservations();
})();
