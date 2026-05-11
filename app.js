/* ===== HACCP-Lite — App Logic ===== */

// ── CONFIG ──
const SUPABASE_URL = 'TU_SUPABASE_URL_AQUI';
const SUPABASE_KEY = 'TU_SUPABASE_ANON_KEY_AQUI';
const DEMO_MODE = SUPABASE_URL.includes('TU_');

// ── STATE ──
const STATE = {
  user: null, restaurant_id: null, records: [],
  currentTab: 'tabDashboard', currentStatus: {}
};

// ── SUPABASE INIT ──
let sb = null;
if (!DEMO_MODE) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ── DOM REFS ──
const $ = id => document.getElementById(id);

// ── TOAST ──
function toast(msg, type = 'success', parent = 'appToast') {
  const el = $(parent) || $('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => el.className = 'toast', 3000);
}

// ── LOCAL STORAGE HELPERS ──
function getRecords() {
  try { return JSON.parse(localStorage.getItem('haccp_records') || '[]'); } catch { return []; }
}
function saveRecords(records) {
  localStorage.setItem('haccp_records', JSON.stringify(records));
}
function addRecord(record) {
  const r = { ...record, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  const records = getRecords();
  records.unshift(r);
  saveRecords(records);
  STATE.records = records;
  return r;
}

// ══════════════════════════════
// AUTH
// ══════════════════════════════
function enterDemo() {
  STATE.user = { email: 'demo@haccp-lite.app', name: 'Usuario Demo' };
  STATE.restaurant_id = 'demo';
  STATE.records = getRecords();
  $('loginScreen').style.display = 'none';
  $('appMain').style.display = 'flex';
  $('headerUser').textContent = 'Modo Demo';
  refreshDashboard();
}

async function handleLogin(e) {
  e.preventDefault();
  if (DEMO_MODE) { enterDemo(); return; }
  const email = $('loginEmail').value.trim();
  const pass = $('loginPass').value;
  $('btnLogin').textContent = 'Cargando...'; $('btnLogin').disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  $('btnLogin').textContent = 'Iniciar Sesión'; $('btnLogin').disabled = false;
  if (error) { toast(error.message, 'error', 'toast'); return; }
  await enterApp(data.user);
}

async function handleRegister(e) {
  e.preventDefault();
  if (DEMO_MODE) { enterDemo(); return; }
  const email = $('regEmail').value.trim();
  const pass = $('regPass').value;
  const name = $('regName').value.trim();
  const { data, error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { full_name: name } }
  });
  if (error) { toast(error.message, 'error', 'toast'); return; }
  toast('¡Cuenta creada! Revisa tu email para confirmar.', 'success', 'toast');
}

async function enterApp(user) {
  STATE.user = user;
  $('loginScreen').style.display = 'none';
  $('appMain').style.display = 'flex';
  $('headerUser').textContent = user.email;
  // Get restaurant_id from users table
  const { data } = await sb.from('users').select('restaurant_id').eq('id', user.id).single();
  if (data) STATE.restaurant_id = data.restaurant_id;
  await loadRecords();
  refreshDashboard();
}

async function handleLogout() {
  if (!DEMO_MODE && sb) await sb.auth.signOut();
  STATE.user = null;
  $('appMain').style.display = 'none';
  $('loginScreen').style.display = 'flex';
}

async function checkSession() {
  if (DEMO_MODE) return;
  const { data: { session } } = await sb.auth.getSession();
  if (session) await enterApp(session.user);
}

// ══════════════════════════════
// NAVIGATION
// ══════════════════════════════
function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  $(tabId).classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  STATE.currentTab = tabId;
}

// ══════════════════════════════
// STATUS BUTTONS
// ══════════════════════════════
function initStatusButtons() {
  document.querySelectorAll('.status-btns').forEach(group => {
    const formId = group.closest('form')?.id || group.id;
    STATE.currentStatus[formId || group.id] = 'conforme';
    group.addEventListener('click', e => {
      const btn = e.target.closest('.status-btn');
      if (!btn) return;
      group.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.currentStatus[formId || group.id] = btn.dataset.val;
      // Show/hide accion correctiva field
      const accionField = group.closest('form')?.querySelector('[id*="Accion"]');
      if (accionField) accionField.style.display = btn.dataset.val === 'accion_correctiva' ? 'block' : 'none';
    });
  });
}

// ══════════════════════════════
// DATA OPERATIONS
// ══════════════════════════════
async function loadRecords() {
  if (DEMO_MODE) { STATE.records = getRecords(); return; }
  const { data, error } = await sb.from('control_records')
    .select('*').order('created_at', { ascending: false }).limit(100);
  if (!error && data) { STATE.records = data; saveRecords(data); }
}

async function insertRecord(record) {
  if (DEMO_MODE) return addRecord(record);
  const row = {
    restaurant_id: STATE.restaurant_id,
    tipo: record.tipo,
    datos: record.datos,
    estado: record.estado,
    observaciones: record.observaciones || null,
    accion_correctiva: record.accion_correctiva || null,
    registrado_por: STATE.user.id
  };
  const { data, error } = await sb.from('control_records').insert([row]).select();
  if (error) { toast('Error: ' + error.message, 'error'); return null; }
  const inserted = data[0];
  STATE.records.unshift(inserted);
  saveRecords(STATE.records);
  return inserted;
}

// ══════════════════════════════
// PCC FORM
// ══════════════════════════════
async function handlePCC(e) {
  e.preventDefault();
  const equipo = $('pccEquipo').value;
  const temp = parseFloat($('pccTemp').value);
  if (!equipo || isNaN(temp)) { toast('Completa equipo y temperatura', 'error'); return; }
  const estado = STATE.currentStatus['formPCC'] || 'conforme';
  const record = {
    tipo: 'pcc',
    datos: { equipo, temperatura: temp, unidad: '°C' },
    estado,
    observaciones: $('pccObs').value.trim(),
    accion_correctiva: $('pccAccion')?.value?.trim() || ''
  };
  const result = await insertRecord(record);
  if (result) {
    toast('✅ PCC registrado');
    $('formPCC').reset();
    refreshPCCList();
    refreshDashboard();
    if (navigator.vibrate) navigator.vibrate(150);
  }
}

// ══════════════════════════════
// LIMPIEZA FORM
// ══════════════════════════════
async function handleLimpieza(e) {
  e.preventDefault();
  const area = $('limpArea').value;
  const producto = $('limpProducto').value.trim();
  if (!area || !producto) { toast('Completa área y producto', 'error'); return; }
  const estado = STATE.currentStatus['formLimpieza'] || STATE.currentStatus['limpStatus'] || 'conforme';
  const record = {
    tipo: 'limpieza',
    datos: { area, producto, concentracion: $('limpConc').value.trim() },
    estado,
    observaciones: $('limpObs').value.trim()
  };
  const result = await insertRecord(record);
  if (result) {
    toast('✅ Limpieza registrada');
    $('formLimpieza').reset();
    refreshLimpList();
    refreshDashboard();
    if (navigator.vibrate) navigator.vibrate(150);
  }
}

// ══════════════════════════════
// TRAZABILIDAD FORM
// ══════════════════════════════
async function handleTraza(e) {
  e.preventDefault();
  const lote = $('trazaLote').value.trim();
  const prod = $('trazaProd').value.trim();
  if (!lote || !prod) { toast('Completa lote y producto', 'error'); return; }
  const estado = STATE.currentStatus['formTraza'] || STATE.currentStatus['trazaStatus'] || 'conforme';
  const record = {
    tipo: 'trazabilidad',
    datos: {
      lote, producto: prod, proveedor: $('trazaProv').value.trim(),
      temp_recepcion: parseFloat($('trazaTemp').value) || null,
      cantidad: $('trazaCant').value.trim(),
      fecha_ingreso: $('trazaIngreso').value, fecha_vencimiento: $('trazaVence').value
    },
    estado,
    observaciones: $('trazaObs').value.trim()
  };
  const result = await insertRecord(record);
  if (result) {
    toast('✅ Trazabilidad registrada');
    $('formTraza').reset();
    refreshTrazaList();
    refreshDashboard();
    if (navigator.vibrate) navigator.vibrate(150);
  }
}

// ══════════════════════════════
// RENDER FUNCTIONS
// ══════════════════════════════
function badgeClass(estado) {
  return estado === 'conforme' ? 'badge-green' : estado === 'no_conforme' ? 'badge-red' : 'badge-yellow';
}
function statusLabel(estado) {
  return estado === 'conforme' ? '✅' : estado === 'no_conforme' ? '❌' : '⚠️';
}
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Hace unos segundos';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}
function tipoIcon(tipo) {
  return { pcc: '🌡️', limpieza: '🧹', trazabilidad: '📦', proceso: '⚙️' }[tipo] || '📋';
}
function recordHTML(r) {
  const d = r.datos || {};
  let title = '', value = '';
  if (r.tipo === 'pcc') { title = d.equipo || 'PCC'; value = `${d.temperatura}°C`; }
  else if (r.tipo === 'limpieza') { title = d.area || 'Limpieza'; value = d.producto || ''; }
  else if (r.tipo === 'trazabilidad') { title = d.lote || 'Lote'; value = d.producto || ''; }
  else { title = r.tipo; value = ''; }
  return `<div class="record-item">
    <div class="record-badge ${badgeClass(r.estado)}"></div>
    <div class="record-info">
      <div class="record-title">${tipoIcon(r.tipo)} ${title}</div>
      <div class="record-meta">${timeAgo(r.created_at)} · ${statusLabel(r.estado)} ${r.estado}</div>
    </div>
    <div class="record-value">${value}</div>
  </div>`;
}

function refreshDashboard() {
  const records = STATE.records;
  const today = new Date().toISOString().slice(0, 10);
  const hoy = records.filter(r => (r.created_at || '').slice(0, 10) === today);
  const month = new Date().getMonth();
  const mes = records.filter(r => new Date(r.created_at).getMonth() === month);
  const noConf = hoy.filter(r => r.estado !== 'conforme');
  const conf = hoy.length > 0 ? Math.round((hoy.length - noConf.length) / hoy.length * 100) : 100;
  $('kpiHoy').textContent = hoy.length;
  $('kpiAlertas').textContent = noConf.length;
  $('kpiConf').textContent = conf + '%';
  $('kpiTotal').textContent = mes.length;
  const recent = records.slice(0, 8);
  $('recentList').innerHTML = recent.length
    ? recent.map(recordHTML).join('')
    : '<p class="empty-state">Sin registros aún. ¡Comienza registrando un control!</p>';
}

function refreshPCCList() {
  const list = STATE.records.filter(r => r.tipo === 'pcc').slice(0, 10);
  $('pccList').innerHTML = list.length ? list.map(recordHTML).join('') : '<p class="empty-state">Sin registros PCC</p>';
}
function refreshLimpList() {
  const list = STATE.records.filter(r => r.tipo === 'limpieza').slice(0, 10);
  $('limpList').innerHTML = list.length ? list.map(recordHTML).join('') : '<p class="empty-state">Sin registros de limpieza</p>';
}
function refreshTrazaList() {
  const list = STATE.records.filter(r => r.tipo === 'trazabilidad').slice(0, 10);
  $('trazaList').innerHTML = list.length ? list.map(recordHTML).join('') : '<p class="empty-state">Sin registros de trazabilidad</p>';
}

// ══════════════════════════════
// PDF REPORT
// ══════════════════════════════
function getFilteredRecords() {
  let records = STATE.records;
  const tipo = $('repTipo').value;
  const desde = $('repDesde').value;
  const hasta = $('repHasta').value;
  if (tipo) records = records.filter(r => r.tipo === tipo);
  if (desde) records = records.filter(r => (r.created_at || '').slice(0, 10) >= desde);
  if (hasta) records = records.filter(r => (r.created_at || '').slice(0, 10) <= hasta);
  return records;
}

function handlePreview() {
  const records = getFilteredRecords();
  if (!records.length) { toast('No hay registros para el filtro seleccionado', 'error'); return; }
  let html = '<table class="report-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Estado</th></tr></thead><tbody>';
  records.forEach(r => {
    const d = r.datos || {};
    let detail = '';
    if (r.tipo === 'pcc') detail = `${d.equipo}: ${d.temperatura}°C`;
    else if (r.tipo === 'limpieza') detail = `${d.area} — ${d.producto}`;
    else if (r.tipo === 'trazabilidad') detail = `${d.lote} — ${d.producto}`;
    html += `<tr><td>${new Date(r.created_at).toLocaleDateString('es-CO')}</td><td>${r.tipo.toUpperCase()}</td><td>${detail}</td><td>${statusLabel(r.estado)} ${r.estado}</td></tr>`;
  });
  html += '</tbody></table>';
  $('reportTable').innerHTML = html;
  $('reportPreview').style.display = 'block';
}

function handleGenPDF() {
  const records = getFilteredRecords();
  if (!records.length) { toast('No hay registros para generar PDF', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  // Header
  doc.setFontSize(20);
  doc.setTextColor(16, 185, 129);
  doc.text('HACCP-Lite', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Reporte de Control de Inocuidad', 14, 27);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 14, 33);
  const tipo = $('repTipo').value;
  if (tipo) doc.text(`Tipo: ${tipo.toUpperCase()}`, 14, 39);
  const desde = $('repDesde').value, hasta = $('repHasta').value;
  if (desde || hasta) doc.text(`Período: ${desde || '...'} — ${hasta || '...'}`, 14, tipo ? 45 : 39);
  // Summary
  const conf = records.filter(r => r.estado === 'conforme').length;
  const noConf = records.filter(r => r.estado === 'no_conforme').length;
  const startY = (desde || hasta) && tipo ? 52 : (desde || hasta) || tipo ? 46 : 40;
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.text(`Total registros: ${records.length}  |  Conformes: ${conf}  |  No conformes: ${noConf}  |  Conformidad: ${records.length ? Math.round(conf / records.length * 100) : 100}%`, 14, startY);
  // Table
  const rows = records.map(r => {
    const d = r.datos || {};
    let detail = '';
    if (r.tipo === 'pcc') detail = `${d.equipo}: ${d.temperatura}°C`;
    else if (r.tipo === 'limpieza') detail = `${d.area} — ${d.producto} (${d.concentracion || 'N/A'})`;
    else if (r.tipo === 'trazabilidad') detail = `${d.lote} — ${d.producto} (${d.proveedor || 'N/A'})`;
    return [
      new Date(r.created_at).toLocaleDateString('es-CO'),
      r.tipo.toUpperCase(),
      detail,
      r.estado,
      r.observaciones || ''
    ];
  });
  doc.autoTable({
    startY: startY + 6,
    head: [['Fecha', 'Tipo', 'Detalle', 'Estado', 'Observaciones']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    didParseCell: function (data) {
      if (data.column.index === 3 && data.section === 'body') {
        if (data.cell.raw === 'no_conforme') data.cell.styles.textColor = [239, 68, 68];
        else if (data.cell.raw === 'conforme') data.cell.styles.textColor = [16, 185, 129];
      }
    }
  });
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`HACCP-Lite — Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.height - 10);
  }
  doc.save(`reporte-haccp-${new Date().toISOString().slice(0, 10)}.pdf`);
  toast('✅ PDF descargado');
}

// ══════════════════════════════
// INIT
// ══════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Auth events
  $('loginForm').addEventListener('submit', handleLogin);
  $('registerForm').addEventListener('submit', handleRegister);
  $('btnDemo').addEventListener('click', enterDemo);
  $('btnLogout').addEventListener('click', handleLogout);
  $('showRegister').addEventListener('click', e => {
    e.preventDefault();
    $('loginForm').style.display = 'none';
    $('registerForm').style.display = 'block';
    document.querySelector('.login-toggle').style.display = 'none';
    $('showLoginLink').style.display = 'block';
  });
  $('showLogin').addEventListener('click', e => {
    e.preventDefault();
    $('loginForm').style.display = 'block';
    $('registerForm').style.display = 'none';
    document.querySelector('.login-toggle').style.display = 'block';
    $('showLoginLink').style.display = 'none';
  });

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      // Lazy load lists
      if (btn.dataset.tab === 'tabPCC') refreshPCCList();
      if (btn.dataset.tab === 'tabLimpieza') refreshLimpList();
      if (btn.dataset.tab === 'tabTraza') refreshTrazaList();
    });
  });

  // Forms
  $('formPCC').addEventListener('submit', handlePCC);
  $('formLimpieza').addEventListener('submit', handleLimpieza);
  $('formTraza').addEventListener('submit', handleTraza);

  // Reports
  $('btnGenPDF').addEventListener('click', handleGenPDF);
  $('btnPreview').addEventListener('click', handlePreview);

  // Status buttons
  initStatusButtons();

  // Set default dates for reports
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  $('repDesde').value = weekAgo;
  $('repHasta').value = today;
  $('trazaIngreso').value = today;

  // Temperature range hint
  $('pccEquipo').addEventListener('change', function () {
    const ranges = {
      'Nevera Principal': '0°C – 5°C', 'Congelador 1': '-18°C – -12°C',
      'Congelador 2': '-18°C – -12°C', 'Zona de Despacho': '0°C – 7°C',
      'Recepción MP': '0°C – 5°C'
    };
    $('pccRange').textContent = `Rango aceptable: ${ranges[this.value] || '—'}`;
  });

  // Check session
  checkSession();
});

// Service Worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
