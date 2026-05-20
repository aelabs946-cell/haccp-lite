/* ===== HACCP-Lite v2.0 — GD FORGE ===== */

const SUPABASE_URL = 'https://trhogittkrnzoxseooze.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyaG9naXR0a3Juem94c2Vvb3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDQ2MjQsImV4cCI6MjA5MzkyMDYyNH0.FYbOBT4iha9DeeMc2nYUQp40IRLgJ7KNC7YILhaWKoE';
const DEMO_MODE = SUPABASE_URL.includes('TU_');

const STATE = { user:null, restaurant_id:null, records:[], currentTab:'tabDashboard', currentStatus:{}, responsable:'' };
const RANGES = {
  'Nevera Principal':[0,5],'Congelador 1':[-18,-12],'Congelador 2':[-18,-12],
  'Cuarto Frío':[0,5],'Zona de Despacho':[0,7],'Recepción MP':[0,5],
  'Cocción':[74,100],'Enfriamiento':[0,5]
};

let sb = null;
if (!DEMO_MODE) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);

// Toast
function toast(msg, type='success', parent='appToast'){
  const el=$(parent)||$('toast'); el.textContent=msg; el.className='toast show '+type;
  setTimeout(()=>el.className='toast',3000);
}

// Storage
function getRecords(){ try{return JSON.parse(localStorage.getItem('haccp_records')||'[]')}catch{return[]} }
function saveRecords(r){ localStorage.setItem('haccp_records',JSON.stringify(r)) }
function addRecord(r){ const rec={...r,id:crypto.randomUUID(),created_at:new Date().toISOString()}; const recs=getRecords(); recs.unshift(rec); saveRecords(recs); STATE.records=recs; return rec; }

// ═══ AUTH ═══
function enterDemo(){
  STATE.user={email:'demo@gdforge.app'}; STATE.restaurant_id='demo'; STATE.records=getRecords();
  $('loginScreen').style.display='none'; $('appMain').style.display='flex';
  $('headerUser').textContent='Modo Demo';
  const saved=localStorage.getItem('haccp_responsable');
  if(saved){STATE.responsable=saved; fillResponsable(saved); $('responsableBar').style.display='none';}
  else $('responsableBar').style.display='block';
  refreshDashboard();
}
async function handleLogin(e){
  e.preventDefault(); if(DEMO_MODE){enterDemo();return}
  const email=$('loginEmail').value.trim(), pass=$('loginPass').value;
  $('btnLogin').textContent='Cargando...'; $('btnLogin').disabled=true;
  const{data,error}=await sb.auth.signInWithPassword({email,password:pass});
  $('btnLogin').textContent='Iniciar Sesión'; $('btnLogin').disabled=false;
  if(error){toast(error.message,'error','toast');return} await enterApp(data.user);
}
async function handleRegister(e){
  e.preventDefault(); if(DEMO_MODE){enterDemo();return}
  const{data,error}=await sb.auth.signUp({email:$('regEmail').value.trim(),password:$('regPass').value,
    options:{data:{full_name:$('regName').value.trim()}}});
  if(error){toast(error.message,'error','toast');return}
  toast('¡Cuenta creada! Revisa tu email.','success','toast');
}
async function enterApp(user){
  STATE.user=user; $('loginScreen').style.display='none'; $('appMain').style.display='flex';
  $('headerUser').textContent=user.email;
  const{data}=await sb.from('users').select('restaurant_id,nombre').eq('id',user.id).single();
  if(data){STATE.restaurant_id=data.restaurant_id; if(data.nombre){STATE.responsable=data.nombre; fillResponsable(data.nombre);$('responsableBar').style.display='none';} else $('responsableBar').style.display='block';}
  await loadRecords(); refreshDashboard();
}
async function handleLogout(){ if(!DEMO_MODE&&sb)await sb.auth.signOut(); STATE.user=null; $('appMain').style.display='none'; $('loginScreen').style.display='flex'; }
async function checkSession(){ if(DEMO_MODE)return; const{data:{session}}=await sb.auth.getSession(); if(session)await enterApp(session.user); }

// ═══ RESPONSABLE ═══
function fillResponsable(name){ ['pccResp','limpResp','trazaResp'].forEach(id=>{if($(id))$(id).value=name}); }
function setResponsable(){ const n=$('globalResponsable').value.trim(); if(!n){toast('Escribe tu nombre','error');return;} STATE.responsable=n; localStorage.setItem('haccp_responsable',n); fillResponsable(n); $('responsableBar').style.display='none'; toast('👤 '+n); }

// ═══ NAV ═══
function switchTab(tabId){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  $(tabId).classList.add('active'); document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  STATE.currentTab=tabId;
}

// ═══ STATUS BTNS ═══
function initStatusButtons(){
  document.querySelectorAll('.status-btns').forEach(g=>{
    const fid=g.closest('form')?.id||g.id; STATE.currentStatus[fid||g.id]='conforme';
    g.addEventListener('click',e=>{const b=e.target.closest('.status-btn');if(!b)return;
      g.querySelectorAll('.status-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); STATE.currentStatus[fid||g.id]=b.dataset.val;
      const af=g.closest('form')?.querySelector('[id*="Accion"]');
      if(af)af.style.display=b.dataset.val==='accion_correctiva'?'block':'none';
    });
  });
  // Enjuague buttons
  $('enjSi')?.addEventListener('click',()=>{$('enjSi').classList.add('active');$('enjNo').classList.remove('active');});
  $('enjNo')?.addEventListener('click',()=>{$('enjNo').classList.add('active');$('enjSi').classList.remove('active');});
}

// ═══ DATA ═══
async function loadRecords(){
  if(DEMO_MODE){STATE.records=getRecords();return}
  const{data,error}=await sb.from('control_records').select('*').order('created_at',{ascending:false}).limit(200);
  if(!error&&data){STATE.records=data;saveRecords(data)}
}
async function insertRecord(record){
  if(DEMO_MODE)return addRecord(record);
  const row={restaurant_id:STATE.restaurant_id,tipo:record.tipo,datos:record.datos,
    estado:record.estado,observaciones:record.observaciones||null,
    accion_correctiva:record.accion_correctiva||null,registrado_por:STATE.user.id};
  const{data,error}=await sb.from('control_records').insert([row]).select();
  if(error){toast('Error: '+error.message,'error');return null}
  const ins=data[0]; STATE.records.unshift(ins); saveRecords(STATE.records); return ins;
}

// ═══ PCC RANGE CHECK ═══
function checkPCCRange(){
  const equipo=$('pccEquipo').value, temp=parseFloat($('pccTemp').value);
  const range=RANGES[equipo]; if(!range){$('pccRangeIndicator').style.display='none';return}
  $('pccLimInf').value=range[0]; $('pccLimSup').value=range[1];
  $('pccRange').textContent=`Rango aceptable: ${range[0]}°C – ${range[1]}°C`;
  if(isNaN(temp)){$('pccRangeIndicator').style.display='none';return}
  const ind=$('pccRangeIndicator'); ind.style.display='flex';
  if(temp>=range[0]&&temp<=range[1]){ind.className='range-indicator range-ok';ind.textContent=`✅ ${temp}°C dentro del rango (${range[0]} a ${range[1]}°C)`;}
  else{ind.className='range-indicator range-danger';ind.textContent=`❌ ${temp}°C FUERA DE RANGO (${range[0]} a ${range[1]}°C) — Acción correctiva requerida`;}
}

// ═══ FORM HANDLERS ═══
async function handlePCC(e){
  e.preventDefault();
  const equipo=$('pccEquipo').value, temp=parseFloat($('pccTemp').value), resp=$('pccResp').value.trim();
  if(!equipo||isNaN(temp)||!resp){toast('Completa equipo, temperatura y responsable','error');return}
  const range=RANGES[equipo]||[0,5]; const fueraRango=temp<range[0]||temp>range[1];
  const estado=STATE.currentStatus['formPCC']||'conforme';
  const r=await insertRecord({tipo:'pcc',
    datos:{equipo,temperatura:temp,unidad:'°C',lim_inf:range[0],lim_sup:range[1],fuera_rango:fueraRango,responsable:resp},
    estado, observaciones:$('pccObs').value.trim(), accion_correctiva:$('pccAccion')?.value?.trim()||''});
  if(r){toast('✅ PCC registrado');$('formPCC').reset();fillResponsable(STATE.responsable);$('pccRangeIndicator').style.display='none';refreshPCCList();refreshDashboard();if(navigator.vibrate)navigator.vibrate(150);}
}
async function handleLimpieza(e){
  e.preventDefault();
  const area=$('limpArea').value, prod=$('limpProducto').value.trim(), resp=$('limpResp').value.trim();
  if(!area||!prod||!resp){toast('Completa área, producto y responsable','error');return}
  const enjuague=$('enjSi').classList.contains('active')?'Sí':'No';
  const estado=STATE.currentStatus['formLimpieza']||STATE.currentStatus['limpStatus']||'conforme';
  const r=await insertRecord({tipo:'limpieza',
    datos:{area, tipo_limpieza:$('limpTipo').value, producto_limpieza:prod,
      producto_desinfeccion:$('limpDesinf').value.trim(), concentracion:$('limpConc').value.trim(),
      tiempo_contacto:$('limpTiempo').value.trim(), metodo:$('limpMetodo').value, enjuague_final:enjuague,responsable:resp},
    estado, observaciones:$('limpObs').value.trim()});
  if(r){toast('✅ Limpieza registrada');$('formLimpieza').reset();fillResponsable(STATE.responsable);refreshLimpList();refreshDashboard();if(navigator.vibrate)navigator.vibrate(150);}
}
async function handleTraza(e){
  e.preventDefault();
  const lote=$('trazaLote').value.trim(), prod=$('trazaProd').value.trim(), resp=$('trazaResp').value.trim();
  if(!lote||!prod||!resp){toast('Completa lote, producto y responsable','error');return}
  const estado=STATE.currentStatus['formTraza']||STATE.currentStatus['trazaStatus']||'conforme';
  const r=await insertRecord({tipo:'trazabilidad',
    datos:{lote,producto:prod,proveedor:$('trazaProv').value.trim(),registro_invima:$('trazaInvima').value.trim(),
      cantidad:$('trazaCant').value.trim(),fecha_ingreso:$('trazaIngreso').value,fecha_vencimiento:$('trazaVence').value,
      temp_recepcion:parseFloat($('trazaTemp').value)||null,temp_vehiculo:parseFloat($('trazaTempVeh').value)||null,
      guia_transporte:$('trazaGuia').value.trim(),placa_vehiculo:$('trazaPlaca').value.trim(),
      vehiculo_limpieza:$('trazaVehLimp').value,vehiculo_refrigeracion:$('trazaVehRefri').value,responsable:resp},
    estado, observaciones:$('trazaObs').value.trim()});
  if(r){toast('✅ Trazabilidad registrada');$('formTraza').reset();fillResponsable(STATE.responsable);refreshTrazaList();refreshDashboard();if(navigator.vibrate)navigator.vibrate(150);}
}

// ═══ RENDER ═══
function badgeClass(e){return e==='conforme'?'badge-green':e==='no_conforme'?'badge-red':'badge-yellow'}
function statusLabel(e){return e==='conforme'?'✅':e==='no_conforme'?'❌':'⚠️'}
function timeAgo(iso){const d=(Date.now()-new Date(iso).getTime())/1000;if(d<60)return'Hace unos seg.';if(d<3600)return`Hace ${Math.floor(d/60)} min`;if(d<86400)return`Hace ${Math.floor(d/3600)}h`;return new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}
function tipoIcon(t){return{pcc:'🌡️',limpieza:'🧹',trazabilidad:'📦',proceso:'⚙️'}[t]||'📋'}
function recordHTML(r){
  const d=r.datos||{}; let title='',value='',resp=d.responsable||'';
  if(r.tipo==='pcc'){title=d.equipo||'PCC';value=`${d.temperatura}°C`;if(d.fuera_rango)value=`⚠️${value}`}
  else if(r.tipo==='limpieza'){title=d.area||'Limpieza';value=d.tipo_limpieza||d.producto_limpieza||''}
  else if(r.tipo==='trazabilidad'){title=d.lote||'Lote';value=d.producto||''}
  return `<div class="record-item"><div class="record-badge ${badgeClass(r.estado)}"></div>
    <div class="record-info"><div class="record-title">${tipoIcon(r.tipo)} ${title}</div>
    <div class="record-meta">${timeAgo(r.created_at)} · ${statusLabel(r.estado)} ${r.estado}${resp?' · 👤 '+resp:''}</div></div>
    <div class="record-value">${value}</div></div>`;
}
function refreshDashboard(){
  const recs=STATE.records, today=new Date().toISOString().slice(0,10);
  const hoy=recs.filter(r=>(r.created_at||'').slice(0,10)===today);
  const mes=recs.filter(r=>new Date(r.created_at).getMonth()===new Date().getMonth());
  const nc=hoy.filter(r=>r.estado!=='conforme');
  $('kpiHoy').textContent=hoy.length; $('kpiAlertas').textContent=nc.length;
  $('kpiConf').textContent=(hoy.length?Math.round((hoy.length-nc.length)/hoy.length*100):100)+'%';
  $('kpiTotal').textContent=mes.length;
  $('recentList').innerHTML=recs.slice(0,10).map(recordHTML).join('')||'<p class="empty-state">Sin registros</p>';
}
function refreshPCCList(){const l=STATE.records.filter(r=>r.tipo==='pcc').slice(0,10);$('pccList').innerHTML=l.length?l.map(recordHTML).join(''):'<p class="empty-state">Sin registros PCC</p>';}
function refreshLimpList(){const l=STATE.records.filter(r=>r.tipo==='limpieza').slice(0,10);$('limpList').innerHTML=l.length?l.map(recordHTML).join(''):'<p class="empty-state">Sin registros</p>';}
function refreshTrazaList(){const l=STATE.records.filter(r=>r.tipo==='trazabilidad').slice(0,10);$('trazaList').innerHTML=l.length?l.map(recordHTML).join(''):'<p class="empty-state">Sin registros</p>';}

// ═══ PDF ═══
function getFilteredRecords(){
  let r=STATE.records; const t=$('repTipo').value,d=$('repDesde').value,h=$('repHasta').value;
  if(t)r=r.filter(x=>x.tipo===t);if(d)r=r.filter(x=>(x.created_at||'').slice(0,10)>=d);if(h)r=r.filter(x=>(x.created_at||'').slice(0,10)<=h);return r;
}
function handlePreview(){
  const recs=getFilteredRecords();if(!recs.length){toast('No hay registros','error');return}
  let h='<table class="report-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Responsable</th></tr></thead><tbody>';
  recs.forEach(r=>{const d=r.datos||{};let det='';
    if(r.tipo==='pcc')det=`${d.equipo}: ${d.temperatura}°C`;
    else if(r.tipo==='limpieza')det=`${d.area} — ${d.producto_limpieza||''} / ${d.producto_desinfeccion||''}`;
    else if(r.tipo==='trazabilidad')det=`${d.lote} — ${d.producto}`;
    h+=`<tr><td>${new Date(r.created_at).toLocaleDateString('es-CO')}</td><td>${r.tipo.toUpperCase()}</td><td>${det}</td><td>${statusLabel(r.estado)}</td><td>${d.responsable||''}</td></tr>`;
  }); h+='</tbody></table>'; $('reportTable').innerHTML=h; $('reportPreview').style.display='block';
}
function handleGenPDF(){
  const recs=getFilteredRecords();if(!recs.length){toast('No hay registros','error');return}
  const{jsPDF}=window.jspdf,doc=new jsPDF();
  doc.setFillColor(26,58,92);doc.rect(0,0,210,36,'F');
  doc.setTextColor(255);doc.setFontSize(18);doc.setFont('helvetica','bold');doc.text('GD FORGE — HACCP-Lite',14,16);
  doc.setFontSize(9);doc.setFont('helvetica','normal');
  doc.text('Reporte de Control de Inocuidad Alimentaria',14,23);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')} | Giovanni Duarte MVZ — Consultor en Calidad e Inocuidad`,14,29);
  let y=42; const tipo=$('repTipo').value;
  doc.setTextColor(40);doc.setFontSize(10);
  if(tipo)doc.text(`Tipo: ${tipo.toUpperCase()}`,14,y);
  const desde=$('repDesde').value,hasta=$('repHasta').value;
  if(desde||hasta){doc.text(`Período: ${desde||'...'} — ${hasta||'...'}`,tipo?80:14,y);}
  y+=8;
  const conf=recs.filter(r=>r.estado==='conforme').length,nc=recs.filter(r=>r.estado==='no_conforme').length;
  doc.setFontSize(9);
  doc.text(`Total: ${recs.length} | Conformes: ${conf} | No conformes: ${nc} | Conformidad: ${recs.length?Math.round(conf/recs.length*100):100}%`,14,y);
  const rows=recs.map(r=>{const d=r.datos||{};let det='';
    if(r.tipo==='pcc')det=`${d.equipo}: ${d.temperatura}°C (${d.lim_inf}–${d.lim_sup})`;
    else if(r.tipo==='limpieza')det=`${d.area} | Limp: ${d.producto_limpieza||'-'} | Des: ${d.producto_desinfeccion||'-'} ${d.concentracion||''}`;
    else if(r.tipo==='trazabilidad')det=`Lote: ${d.lote} | ${d.producto} | Prov: ${d.proveedor||'-'} | Guía: ${d.guia_transporte||'-'}`;
    return[new Date(r.created_at).toLocaleDateString('es-CO'),r.tipo.toUpperCase(),det,r.estado,d.responsable||'',r.observaciones||''];
  });
  doc.autoTable({startY:y+4,head:[['Fecha','Tipo','Detalle','Estado','Responsable','Obs.']],body:rows,
    styles:{fontSize:7,cellPadding:2},headStyles:{fillColor:[45,138,78],textColor:255,fontStyle:'bold'},
    alternateRowStyles:{fillColor:[245,245,245]},
    didParseCell:function(d){if(d.column.index===3&&d.section==='body'){if(d.cell.raw==='no_conforme')d.cell.styles.textColor=[239,68,68];else if(d.cell.raw==='conforme')d.cell.styles.textColor=[45,138,78];}}
  });
  const pc=doc.internal.getNumberOfPages();
  for(let i=1;i<=pc;i++){doc.setPage(i);doc.setFillColor(26,58,92);const ph=doc.internal.pageSize.height;
    doc.rect(0,ph-12,210,12,'F');doc.setTextColor(255);doc.setFontSize(7);
    doc.text(`GD FORGE — Giovanni Duarte MVZ | Consultor en Calidad e Inocuidad | Pág ${i}/${pc}`,105,ph-5,{align:'center'});}
  doc.save(`HACCP_GDForge_${new Date().toISOString().slice(0,10)}.pdf`);toast('✅ PDF descargado');
}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded',()=>{
  $('loginForm').addEventListener('submit',handleLogin);
  $('registerForm').addEventListener('submit',handleRegister);
  $('btnDemo').addEventListener('click',enterDemo);
  $('btnLogout').addEventListener('click',handleLogout);
  $('showRegister').addEventListener('click',e=>{e.preventDefault();$('loginForm').style.display='none';$('registerForm').style.display='block';document.querySelector('.login-toggle').style.display='none';$('showLoginLink').style.display='block';});
  $('showLogin').addEventListener('click',e=>{e.preventDefault();$('loginForm').style.display='block';$('registerForm').style.display='none';document.querySelector('.login-toggle').style.display='block';$('showLoginLink').style.display='none';});
  $('btnSetResp').addEventListener('click',setResponsable);
  $('globalResponsable').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setResponsable()}});
  document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{switchTab(b.dataset.tab);
    if(b.dataset.tab==='tabPCC')refreshPCCList();if(b.dataset.tab==='tabLimpieza')refreshLimpList();if(b.dataset.tab==='tabTraza')refreshTrazaList();}));
  $('formPCC').addEventListener('submit',handlePCC);
  $('formLimpieza').addEventListener('submit',handleLimpieza);
  $('formTraza').addEventListener('submit',handleTraza);
  $('btnGenPDF').addEventListener('click',handleGenPDF);
  $('btnPreview').addEventListener('click',handlePreview);
  initStatusButtons();
  const today=new Date().toISOString().slice(0,10);
  $('repDesde').value=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  $('repHasta').value=today; $('trazaIngreso').value=today;
  $('pccEquipo').addEventListener('change',checkPCCRange);
  $('pccTemp').addEventListener('input',checkPCCRange);
  checkSession();
});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
