/* ===== HACCP-Lite v3.3 — GD FORGE — Fotos + Checklists + Etiquetas + Voz ===== */

const SUPABASE_URL = 'https://shqfwclzkpgdtgveqmdk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNocWZ3Y2x6a3BnZHRndmVxbWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDA1ODYsImV4cCI6MjA4NzcxNjU4Nn0.EBi8Qxk8vA_xEYV5UX6LvhP_Hoj7Gsng62hTWs1tyLQ';
const HAS_SUPABASE = !SUPABASE_URL.includes('TU_');

const STATE = { user:null, restaurant_id:null, records:[], currentTab:'tabDashboard', currentStatus:{}, responsable:'', isDemo:false, role:'empleado',
  config:{ equipment:[], areas:[], chemicals_clean:[], chemicals_desinf:[], tipos_limpieza:[], metodos:[], checklist_apertura:[], checklist_cierre:[] },
  photos:{ pcc:null, limp:null, traza:null }, checklistType:'apertura', checklistState:{},
  voiceActive:null
};
const DEFAULTS = {
  equipment:[
    {nombre:'Nevera Principal',tipo_medicion:'temperatura',unidad:'°C',temp_min:0,temp_max:5},
    {nombre:'Congelador 1',tipo_medicion:'temperatura',unidad:'°C',temp_min:-18,temp_max:-12},
    {nombre:'Congelador 2',tipo_medicion:'temperatura',unidad:'°C',temp_min:-18,temp_max:-12},
    {nombre:'Cuarto Frío',tipo_medicion:'temperatura',unidad:'°C',temp_min:0,temp_max:5},
    {nombre:'Zona de Despacho',tipo_medicion:'temperatura',unidad:'°C',temp_min:0,temp_max:7},
    {nombre:'Recepción MP',tipo_medicion:'temperatura',unidad:'°C',temp_min:0,temp_max:5},
    {nombre:'Cocción',tipo_medicion:'temperatura',unidad:'°C',temp_min:74,temp_max:100},
    {nombre:'Enfriamiento',tipo_medicion:'temperatura',unidad:'°C',temp_min:0,temp_max:5},
    {nombre:'Concentración Desinfectante',tipo_medicion:'concentracion',unidad:'ppm',temp_min:100,temp_max:200},
    {nombre:'Cristales de Sal',tipo_medicion:'presencia_ausencia',unidad:'Sí/No',temp_min:0,temp_max:0}
  ],
  areas:['Zona de Corte','Zona de Empaque','Cuarto Frío','Área de Despacho','Baños y Vestidores','Equipos y Utensilios','Pisos y Paredes','Zona de Recepción'],
  chemicals_clean:['Jabón desengrasante','Detergente alcalino','Detergente neutro','Desengrasante industrial'],
  chemicals_desinf:['Hipoclorito de sodio','Amonio cuaternario','Ácido peracético','Dióxido de cloro'],
  tipos_limpieza:['Pre-operativa','Operativa','Post-operativa'],
  metodos:['Aspersión','Inmersión','Frotado','Nebulización'],
  checklist_apertura:['Verificar temperatura de neveras y congeladores','Encender equipos de cocción','Verificar limpieza general de pisos y superficies','Verificar uniformes y EPP del personal','Verificar lavamanos funcional con jabón y toallas','Revisar fechas de vencimiento en almacén','Verificar stock de productos de limpieza','Verificar funcionamiento de trampas de grasa'],
  checklist_cierre:['Limpiar y desinfectar todas las superficies de trabajo','Sacar basura y lavar canecas','Cerrar llaves de gas','Apagar equipos de cocción','Verificar que neveras y congeladores estén cerrados','Registrar temperaturas finales de equipos','Barrer y trapear pisos','Verificar puertas y ventanas cerradas']
};

let sb = null;
if (HAS_SUPABASE) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);

// ═══ TOAST ═══
function toast(msg, type='success', parent='appToast'){
  const el=$(parent)||$('toast'); el.textContent=msg; el.className='toast show '+type;
  setTimeout(()=>el.className='toast',3000);
}

// ═══ LOCAL STORAGE ═══
function getRecords(){ try{return JSON.parse(localStorage.getItem('haccp_records')||'[]')}catch{return[]} }
function saveRecords(r){ localStorage.setItem('haccp_records',JSON.stringify(r)) }
function addRecord(r){ const rec={...r,id:crypto.randomUUID(),created_at:new Date().toISOString()}; const recs=getRecords(); recs.unshift(rec); saveRecords(recs); STATE.records=recs; return rec; }

// ══════════════════════════════
// CONFIG — Dynamic Dropdowns
// ══════════════════════════════
async function loadConfig(){
  if(STATE.isDemo){ STATE.config={...DEFAULTS}; populateDropdowns(); return; }
  try{
    const{data:equip}=await sb.from('equipment').select('*').eq('activo',true).order('nombre');
    const{data:rest}=await sb.from('restaurants').select('config,nombre,nit,direccion,telefono').single();
    const c=rest?.config||{};
    STATE.config={
      equipment:equip||DEFAULTS.equipment,
      areas:c.areas_limpieza||DEFAULTS.areas,
      chemicals_clean:c.productos_limpieza||DEFAULTS.chemicals_clean,
      chemicals_desinf:c.productos_desinfeccion||DEFAULTS.chemicals_desinf,
      tipos_limpieza:c.tipos_limpieza||DEFAULTS.tipos_limpieza,
      metodos:c.metodos_limpieza||DEFAULTS.metodos,
      checklist_apertura:c.checklist_apertura||DEFAULTS.checklist_apertura,
      checklist_cierre:c.checklist_cierre||DEFAULTS.checklist_cierre
    };
    STATE.restaurant_info=rest||{};
  }catch(e){ STATE.config={...DEFAULTS}; }
  populateDropdowns();
}

function populateDropdowns(){
  const C=STATE.config;
  // PCC Equipment
  const pcc=$('pccEquipo'); pcc.innerHTML='<option value="">Seleccionar PCC...</option>';
  C.equipment.forEach(e=>{
    const tm=e.tipo_medicion||'temperatura', un=e.unidad||'°C';
    pcc.innerHTML+=`<option value="${e.nombre}" data-min="${e.temp_min}" data-max="${e.temp_max}" data-tipo="${tm}" data-unidad="${un}">${e.nombre} (${un})</option>`;
  });
  // Limpieza Areas
  const area=$('limpArea'); area.innerHTML='<option value="">Seleccionar...</option>';
  C.areas.forEach(a=>{ area.innerHTML+=`<option>${a}</option>`; });
  // Tipo Limpieza
  const tipo=$('limpTipo'); tipo.innerHTML='<option value="">Seleccionar...</option>';
  C.tipos_limpieza.forEach(t=>{ tipo.innerHTML+=`<option>${t}</option>`; });
  // Metodo
  const met=$('limpMetodo'); met.innerHTML='<option value="">—</option>';
  C.metodos.forEach(m=>{ met.innerHTML+=`<option>${m}</option>`; });
  // Datalists
  let dl1=$('listaLimpieza'); if(!dl1){dl1=document.createElement('datalist');dl1.id='listaLimpieza';document.body.appendChild(dl1);}
  dl1.innerHTML=''; C.chemicals_clean.forEach(c=>{dl1.innerHTML+=`<option value="${c}">`;});
  let dl2=$('listaDesinf'); if(!dl2){dl2=document.createElement('datalist');dl2.id='listaDesinf';document.body.appendChild(dl2);}
  dl2.innerHTML=''; C.chemicals_desinf.forEach(c=>{dl2.innerHTML+=`<option value="${c}">`;});
}

// ══════════════════════════════
// AUTH
// ══════════════════════════════
function enterDemo(){
  STATE.isDemo=true; STATE.user={email:'demo@gdforge.app',id:'demo'}; STATE.restaurant_id='demo'; STATE.records=getRecords(); STATE.role='admin';
  $('loginScreen').style.display='none'; $('appMain').style.display='flex';
  $('headerUser').textContent='Modo Demo'; $('headerMode').textContent='DEMO'; $('headerMode').style.display='inline-block';
  const saved=localStorage.getItem('haccp_responsable');
  if(saved){STATE.responsable=saved; fillResponsable(saved); $('responsableBar').style.display='none';}
  else $('responsableBar').style.display='block';
  loadConfig().then(()=>{ refreshDashboard(); applyRole(); });
}

async function handleLogin(e){
  e.preventDefault();
  if(!HAS_SUPABASE){toast('Supabase no configurado','error','toast');return}
  const email=$('loginEmail').value.trim(), pass=$('loginPass').value;
  if(!email||!pass){toast('Completa email y contraseña','error','toast');return}
  $('btnLogin').textContent='Cargando...'; $('btnLogin').disabled=true;
  try{
    const{data,error}=await sb.auth.signInWithPassword({email,password:pass});
    $('btnLogin').textContent='Iniciar Sesión'; $('btnLogin').disabled=false;
    if(error){
      if(error.message.includes('Invalid login'))toast('Email o contraseña incorrectos','error','toast');
      else if(error.message.includes('Email not confirmed'))toast('Revisa tu email y confirma tu cuenta','error','toast');
      else toast(error.message,'error','toast'); return;
    }
    await enterApp(data.user);
  }catch(err){$('btnLogin').textContent='Iniciar Sesión';$('btnLogin').disabled=false;toast('Error de conexión','error','toast')}
}

async function handleRegister(e){
  e.preventDefault();
  if(!HAS_SUPABASE){toast('Supabase no configurado','error','toast');return}
  const email=$('regEmail').value.trim(), pass=$('regPass').value, name=$('regName').value.trim();
  if(!email||!pass||!name){toast('Completa todos los campos','error','toast');return}
  if(pass.length<6){toast('Mínimo 6 caracteres','error','toast');return}
  $('btnRegister').textContent='Creando...'; $('btnRegister').disabled=true;
  try{
    const{data,error}=await sb.auth.signUp({email,password:pass,options:{data:{full_name:name},emailRedirectTo:window.location.origin+window.location.pathname}});
    $('btnRegister').textContent='Crear Cuenta'; $('btnRegister').disabled=false;
    if(error){toast(error.message,'error','toast');return}
    if(data.user?.identities?.length===0){toast('Ya existe una cuenta con ese email','error','toast');return}
    toast('✅ ¡Cuenta creada! Inicia sesión.','success','toast'); showLoginForm();
  }catch(err){$('btnRegister').textContent='Crear Cuenta';$('btnRegister').disabled=false;toast('Error','error','toast')}
}

async function handleForgotPassword(e){
  e.preventDefault();
  const email=$('forgotEmail').value.trim();
  if(!email){toast('Escribe tu email','error','toast');return}
  $('btnForgot').textContent='Enviando...'; $('btnForgot').disabled=true;
  try{
    const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
    $('btnForgot').textContent='Enviar Link'; $('btnForgot').disabled=false;
    if(error){toast(error.message,'error','toast');return}
    toast('✅ Revisa tu email','success','toast'); showLoginForm();
  }catch(err){$('btnForgot').textContent='Enviar Link';$('btnForgot').disabled=false;toast('Error','error','toast')}
}

async function enterApp(user){
  STATE.isDemo=false; STATE.user=user;
  $('loginScreen').style.display='none'; $('appMain').style.display='flex';
  $('headerUser').textContent=user.email; $('headerMode').textContent='☁️'; $('headerMode').style.display='inline-block';
  try{
    const{data}=await sb.from('users').select('restaurant_id,nombre,rol').eq('id',user.id).single();
    if(data){
      STATE.restaurant_id=data.restaurant_id; STATE.role=data.rol||'empleado';
      if(data.nombre){STATE.responsable=data.nombre; fillResponsable(data.nombre); $('responsableBar').style.display='none';}
      else $('responsableBar').style.display='block';
    } else $('responsableBar').style.display='block';
  }catch(e){$('responsableBar').style.display='block'}
  await loadConfig(); await loadRecords(); refreshDashboard(); applyRole();
}

function applyRole(){
  const isAdmin=STATE.role==='admin';
  const nav=$('navAdmin'); if(nav) nav.style.display=isAdmin?'flex':'none';
}

async function handleLogout(){
  if(!STATE.isDemo&&sb) await sb.auth.signOut();
  STATE.user=null; STATE.isDemo=false; STATE.role='empleado'; STATE.records=[];
  $('appMain').style.display='none'; $('loginScreen').style.display='flex';
  $('headerMode').style.display='none'; showLoginForm();
}

async function checkSession(){
  if(!HAS_SUPABASE)return;
  try{ const{data:{session}}=await sb.auth.getSession(); if(session) await enterApp(session.user); }catch(e){}
}

// ═══ LOGIN NAV ═══
function showLoginForm(){$('loginForm').style.display='block';$('registerForm').style.display='none';$('forgotForm').style.display='none';$('loginToggle').style.display='block';$('showLoginLink').style.display='none';}
function showRegisterForm(){$('loginForm').style.display='none';$('registerForm').style.display='block';$('forgotForm').style.display='none';$('loginToggle').style.display='none';$('showLoginLink').style.display='block';}
function showForgotForm(){$('loginForm').style.display='none';$('registerForm').style.display='none';$('forgotForm').style.display='block';$('loginToggle').style.display='none';$('showLoginLink').style.display='block';}

// ═══ RESPONSABLE ═══
function fillResponsable(name){['pccResp','limpResp','trazaResp'].forEach(id=>{if($(id))$(id).value=name});}
function setResponsable(){const n=$('globalResponsable').value.trim();if(!n){toast('Escribe tu nombre','error');return;}STATE.responsable=n;localStorage.setItem('haccp_responsable',n);fillResponsable(n);$('responsableBar').style.display='none';toast('👤 '+n);}

// ═══ NAV ═══
function switchTab(tabId){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  $(tabId).classList.add('active'); document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
  STATE.currentTab=tabId;
  if(tabId==='tabAdmin') loadAdminData();
  if(tabId==='tabPCC') refreshPCCList();
  if(tabId==='tabLimpieza') refreshLimpList();
  if(tabId==='tabTraza') refreshTrazaList();
}

// ═══ STATUS BTNS ═══
function initStatusButtons(){
  document.querySelectorAll('.status-btns').forEach(g=>{
    const fid=g.closest('form')?.id||g.id; STATE.currentStatus[fid||g.id]='conforme';
    g.addEventListener('click',e=>{const b=e.target.closest('.status-btn');if(!b)return;
      g.querySelectorAll('.status-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); STATE.currentStatus[fid||g.id]=b.dataset.val;
      // Show/hide AC panel based on status
      const form=g.closest('form');
      if(form){
        const acPanel=form.querySelector('.ac-panel');
        if(acPanel) acPanel.style.display=(b.dataset.val!=='conforme')?'block':'none';
      }
    });
  });
  $('enjSi')?.addEventListener('click',()=>{$('enjSi').classList.add('active');$('enjNo').classList.remove('active');});
  $('enjNo')?.addEventListener('click',()=>{$('enjNo').classList.add('active');$('enjSi').classList.remove('active');});
}

// ═══ CORRECTIVE ACTION HELPERS ═══
const acResuelto={pcc:null,limp:null,traza:null};
function toggleACResuelto(key,val){
  acResuelto[key]=val;
  $(key+'ACResueltaSi').classList.toggle('active',val==='si');
  $(key+'ACResueltaNo').classList.toggle('active',val==='no');
}
function getACData(key){
  const desc=$(key+'ACDesc')?.value?.trim()||'';
  if(!desc) return null;
  return {accion_descripcion:desc, accion_resuelta:acResuelto[key]==='si', accion_fecha:new Date().toISOString()};
}
function resetAC(key){
  if($(key+'ACDesc')) $(key+'ACDesc').value='';
  if($(key+'ACPanel')) $(key+'ACPanel').style.display='none';
  acResuelto[key]=null;
  $(key+'ACResueltaSi')?.classList.remove('active');
  $(key+'ACResueltaNo')?.classList.remove('active');
}

// ══════════════════════════════
// DATA OPERATIONS
// ══════════════════════════════
async function loadRecords(){
  if(STATE.isDemo){STATE.records=getRecords();return}
  try{
    const{data,error}=await sb.from('control_records').select('*').order('created_at',{ascending:false}).limit(200);
    if(!error&&data){STATE.records=data;saveRecords(data)} else STATE.records=getRecords();
  }catch(e){STATE.records=getRecords()}
}

async function insertRecord(record){
  if(STATE.isDemo) return addRecord(record);
  try{
    const row={restaurant_id:STATE.restaurant_id,tipo:record.tipo,datos:record.datos,estado:record.estado,observaciones:record.observaciones||null,accion_correctiva:record.accion_correctiva||null,registrado_por:STATE.user.id};
    const{data,error}=await sb.from('control_records').insert([row]).select();
    if(error){toast('⚠️ Guardado local','error');return addRecord(record);}
    const ins=data[0]; STATE.records.unshift(ins); saveRecords(STATE.records); return ins;
  }catch(e){toast('⚠️ Guardado local','error');return addRecord(record);}
}

// ═══ PCC — Dynamic Form ═══
function onPCCChange(){
  const sel=$('pccEquipo'), opt=sel.options[sel.selectedIndex];
  if(!opt||!opt.value){
    $('pccMedicionNum').style.display='block'; $('pccMedicionBool').style.display='none';
    $('pccRangeIndicator').style.display='none'; return;
  }
  const tipo=opt.dataset.tipo||'temperatura', unidad=opt.dataset.unidad||'°C';
  const min=parseFloat(opt.dataset.min), max=parseFloat(opt.dataset.max);

  if(tipo==='presencia_ausencia'){
    $('pccMedicionNum').style.display='none'; $('pccMedicionBool').style.display='block';
    $('pccRangeIndicator').style.display='none';
    $('pccRange').textContent=`Verificar presencia o ausencia`;
    $('pccLimInf').value=0; $('pccLimSup').value=0;
  } else {
    $('pccMedicionNum').style.display='block'; $('pccMedicionBool').style.display='none';
    const label=tipo==='concentracion'?`Concentración (${unidad})`:`Temperatura ${unidad}`;
    $('pccTempLabel').textContent=label;
    $('pccTemp').placeholder=tipo==='concentracion'?'150':'0.0';
    if(!isNaN(min)&&!isNaN(max)){
      $('pccLimInf').value=min; $('pccLimSup').value=max;
      $('pccRange').textContent=`Rango aceptable: ${min}${unidad} – ${max}${unidad}`;
    }
    checkPCCRange();
  }
}

function checkPCCRange(){
  const sel=$('pccEquipo'), opt=sel.options[sel.selectedIndex];
  if(!opt||!opt.value){$('pccRangeIndicator').style.display='none';return}
  const tipo=opt.dataset.tipo||'temperatura';
  if(tipo==='presencia_ausencia')return;
  const min=parseFloat(opt.dataset.min), max=parseFloat(opt.dataset.max), val=parseFloat($('pccTemp').value);
  const unidad=opt.dataset.unidad||'°C';
  if(isNaN(min)||isNaN(max)||isNaN(val)){$('pccRangeIndicator').style.display='none';return}
  const ind=$('pccRangeIndicator'); ind.style.display='flex';
  if(val>=min&&val<=max){ind.className='range-indicator range-ok';ind.textContent=`✅ ${val}${unidad} dentro del rango (${min} a ${max}${unidad})`;}
  else{ind.className='range-indicator range-danger';ind.textContent=`❌ ${val}${unidad} FUERA DE RANGO (${min} a ${max}${unidad})`;}
}

// ═══ FORM HANDLERS ═══
async function handlePCC(e){
  e.preventDefault();
  const sel=$('pccEquipo'), opt=sel.options[sel.selectedIndex];
  if(!opt||!opt.value){toast('Selecciona un PCC','error');return}
  const equipo=opt.value, resp=$('pccResp').value.trim();
  if(!resp){toast('Escribe el responsable','error');return}
  const tipo_med=opt.dataset.tipo||'temperatura', unidad=opt.dataset.unidad||'°C';
  const limInf=parseFloat(opt.dataset.min)||0, limSup=parseFloat(opt.dataset.max)||0;
  let valor, fueraRango=false;

  if(tipo_med==='presencia_ausencia'){
    valor=$('pccBoolSi').classList.contains('active')?'Presente':'Ausente';
    fueraRango=false; // Admin decides what's conformeaccording to status buttons
  } else {
    valor=parseFloat($('pccTemp').value);
    if(isNaN(valor)){toast('Ingresa un valor','error');return}
    fueraRango=valor<limInf||valor>limSup;
  }
  const estado=STATE.currentStatus['formPCC']||'conforme';
  const foto=STATE.photos.pcc;
  const ac=getACData('pcc');
  const datos={equipo,tipo_medicion:tipo_med,valor,unidad,lim_inf:limInf,lim_sup:limSup,fuera_rango:fueraRango,responsable:resp,foto};
  if(ac) datos.accion_correctiva=ac;
  const r=await insertRecord({tipo:'pcc',datos,estado,observaciones:$('pccObs').value.trim(),accion_correctiva:ac?.accion_descripcion||''});
  if(r){toast('✅ PCC registrado');$('formPCC').reset();fillResponsable(STATE.responsable);clearPhoto('pcc');resetAC('pcc');$('pccRangeIndicator').style.display='none';$('pccMedicionBool').style.display='none';$('pccMedicionNum').style.display='block';refreshPCCList();refreshDashboard();if(navigator.vibrate)navigator.vibrate(150);}
}

async function handleLimpieza(e){
  e.preventDefault();
  const area=$('limpArea').value, prod=$('limpProducto').value.trim(), resp=$('limpResp').value.trim();
  if(!area||!prod||!resp){toast('Completa área, producto y responsable','error');return}
  const enjuague=$('enjSi').classList.contains('active')?'Sí':'No';
  const estado=STATE.currentStatus['formLimpieza']||STATE.currentStatus['limpStatus']||'conforme';
  const foto=STATE.photos.limp;
  const ac=getACData('limp');
  const datos={area,tipo_limpieza:$('limpTipo').value,producto_limpieza:prod,producto_desinfeccion:$('limpDesinf').value.trim(),concentracion:$('limpConc').value.trim(),tiempo_contacto:$('limpTiempo').value.trim(),metodo:$('limpMetodo').value,enjuague_final:enjuague,responsable:resp,foto};
  if(ac) datos.accion_correctiva=ac;
  const r=await insertRecord({tipo:'limpieza',datos,estado,observaciones:$('limpObs').value.trim()});
  if(r){toast('✅ Limpieza registrada');$('formLimpieza').reset();fillResponsable(STATE.responsable);clearPhoto('limp');resetAC('limp');refreshLimpList();refreshDashboard();if(navigator.vibrate)navigator.vibrate(150);}
}

async function handleTraza(e){
  e.preventDefault();
  const lote=$('trazaLote').value.trim(), prod=$('trazaProd').value.trim(), resp=$('trazaResp').value.trim();
  if(!lote||!prod||!resp){toast('Completa lote, producto y responsable','error');return}
  const estado=STATE.currentStatus['formTraza']||STATE.currentStatus['trazaStatus']||'conforme';
  const rechazado=$('trazaRechSi')?.classList.contains('active')||false;
  const datos={lote,producto:prod,proveedor:$('trazaProv').value.trim(),registro_invima:$('trazaInvima').value.trim(),
    cantidad:$('trazaCant').value.trim(),fecha_ingreso:$('trazaIngreso').value,fecha_vencimiento:$('trazaVence').value,
    temp_recepcion:parseFloat($('trazaTemp').value)||null,temp_vehiculo:parseFloat($('trazaTempVeh').value)||null,
    guia_transporte:$('trazaGuia').value.trim(),placa_vehiculo:$('trazaPlaca').value.trim(),
    vehiculo_limpieza:$('trazaVehLimp').value,vehiculo_refrigeracion:$('trazaVehRefri').value,
    rechazado,responsable:resp};
  if(rechazado){
    datos.motivo_rechazo=$('trazaMotivoRechazo').value.trim();
    datos.destino_rechazo=$('trazaDestinoRechazo').value;
  }
  datos.foto=STATE.photos.traza;
  const ac=getACData('traza');
  if(ac) datos.accion_correctiva=ac;
  const r=await insertRecord({tipo:'trazabilidad',datos,estado,observaciones:$('trazaObs').value.trim()});
  if(r){toast('✅ Trazabilidad registrada');$('formTraza').reset();fillResponsable(STATE.responsable);clearPhoto('traza');resetAC('traza');$('trazaRechazoFields').style.display='none';refreshTrazaList();refreshDashboard();if(navigator.vibrate)navigator.vibrate(150);}
}

// ═══ TRAZA RECHAZO TOGGLE ═══
function initRechazoToggle(){
  $('trazaRechSi')?.addEventListener('click',()=>{$('trazaRechSi').classList.add('active');$('trazaRechNo').classList.remove('active');$('trazaRechazoFields').style.display='block';});
  $('trazaRechNo')?.addEventListener('click',()=>{$('trazaRechNo').classList.add('active');$('trazaRechSi').classList.remove('active');$('trazaRechazoFields').style.display='none';});
}

// ═══ PHOTO EVIDENCE ═══
async function compressPhoto(file,maxW=800,q=0.5){
  return new Promise(res=>{
    const r=new FileReader(); r.onload=e=>{
      const img=new Image(); img.onload=()=>{
        const c=document.createElement('canvas'); let w=img.width,h=img.height;
        if(w>maxW){h=h*maxW/w;w=maxW;} c.width=w;c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        res(c.toDataURL('image/jpeg',q));
      }; img.src=e.target.result;
    }; r.readAsDataURL(file);
  });
}
async function onPhotoSelect(key,inputId,previewId){
  const file=$(inputId).files[0]; if(!file)return;
  const b64=await compressPhoto(file);
  STATE.photos[key]=b64;
  $(previewId).innerHTML=`<div class="photo-wrap"><img src="${b64}" class="photo-thumb"><button class="photo-remove" onclick="clearPhoto('${key}')">✕</button></div>`;
}
function clearPhoto(key){
  STATE.photos[key]=null;
  const prev=$({pcc:'pccFotoPreview',limp:'limpFotoPreview',traza:'trazaFotoPreview'}[key]);
  if(prev)prev.innerHTML=''; const inp=$({pcc:'pccFoto',limp:'limpFoto',traza:'trazaFoto'}[key]); if(inp)inp.value='';
}

// ═══ CHECKLISTS ═══
function showChecklist(type){
  STATE.checklistType=type; STATE.checklistState={};
  document.querySelectorAll('.check-toggle .btn').forEach(b=>b.classList.remove('active'));
  $(type==='apertura'?'btnCheckApertura':'btnCheckCierre').classList.add('active');
  const items=STATE.config['checklist_'+type]||[];
  const list=$('checklistItems');
  list.innerHTML=items.map((item,i)=>`<div class="check-item" onclick="toggleCheckItem(${i})"><div class="check-box" id="chk${i}"></div><span class="check-text">${item}</span></div>`).join('');
  updateCheckProgress();
  $('checkProgress').style.display='block';
}
function toggleCheckItem(i){
  STATE.checklistState[i]=!STATE.checklistState[i];
  const el=document.querySelectorAll('.check-item')[i];
  if(el){el.classList.toggle('checked',STATE.checklistState[i]); el.querySelector('.check-box').textContent=STATE.checklistState[i]?'✓':'';}
  updateCheckProgress();
}
function updateCheckProgress(){
  const items=STATE.config['checklist_'+STATE.checklistType]||[];
  const done=Object.values(STATE.checklistState).filter(Boolean).length;
  const pct=items.length?Math.round(done/items.length*100):0;
  $('checkProgressBar').style.width=pct+'%';
  $('checkProgressText').textContent=`${done}/${items.length} completados (${pct}%)`;
}
async function saveChecklist(){
  const items=STATE.config['checklist_'+STATE.checklistType]||[];
  const done=Object.values(STATE.checklistState).filter(Boolean).length;
  if(done===0){toast('Marca al menos un item','error');return;}
  const checkedItems=items.filter((_,i)=>STATE.checklistState[i]);
  const uncheckedItems=items.filter((_,i)=>!STATE.checklistState[i]);
  const r=await insertRecord({tipo:'checklist',datos:{tipo_checklist:STATE.checklistType,items_completados:checkedItems,items_pendientes:uncheckedItems,total:items.length,completados:done,porcentaje:Math.round(done/items.length*100),responsable:STATE.responsable},estado:done===items.length?'conforme':'no_conforme',observaciones:$('checkObs')?.value?.trim()||''});
  if(r){toast(`✅ Checklist ${STATE.checklistType} guardado (${done}/${items.length})`);STATE.checklistState={};showChecklist(STATE.checklistType);refreshDashboard();if(navigator.vibrate)navigator.vibrate(150);}
}

// ═══ ETIQUETAS ═══
function generateLabel(){
  const prod=$('etProd').value.trim(),prep=$('etPrep').value,vence=$('etVence').value,resp=$('etResp').value.trim()||STATE.responsable;
  if(!prod){toast('Escribe el producto','error');return;}
  const preview=$('labelPreview');
  preview.innerHTML=`<h3>🍽️ ${prod}</h3><p class="label-big">Prep: ${prep?new Date(prep+'T12:00').toLocaleDateString('es-CO'):'---'}</p><p class="label-big" style="color:var(--danger)">Vence: ${vence?new Date(vence+'T12:00').toLocaleDateString('es-CO'):'---'}</p><p>👤 ${resp}</p><p style="font-size:9px;margin-top:6px">${new Date().toLocaleString('es-CO')}</p>`;
  preview.style.display='block';
}
function printLabel(){
  const prod=$('etProd').value.trim(),prep=$('etPrep').value,vence=$('etVence').value,resp=$('etResp').value.trim()||STATE.responsable;
  if(!prod){toast('Escribe el producto','error');return;}
  const{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:[80,50]});
  doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text(prod,40,8,{align:'center'});
  doc.setDrawColor(150);doc.line(5,10,75,10);
  doc.setFontSize(9);doc.setFont('helvetica','normal');
  doc.text(`Prep: ${prep||'---'}`,5,16);doc.text(`Vence: ${vence||'---'}`,5,22);
  doc.text(`Resp: ${resp}`,5,28);
  doc.setFontSize(7);doc.text(new Date().toLocaleString('es-CO'),5,34);
  doc.text('GD FORGE — HACCP-Lite',40,46,{align:'center'});
  doc.save(`Etiqueta_${prod.replace(/\s/g,'_')}.pdf`);toast('✅ Etiqueta descargada');
}

// ═══ RENDER ═══
function badgeClass(e){return e==='conforme'?'badge-green':e==='no_conforme'?'badge-red':'badge-yellow'}
function statusLabel(e){return e==='conforme'?'✅':e==='no_conforme'?'❌':'⚠️'}
function timeAgo(iso){const d=(Date.now()-new Date(iso).getTime())/1000;if(d<60)return'Ahora';if(d<3600)return`${Math.floor(d/60)} min`;if(d<86400)return`${Math.floor(d/3600)}h`;return new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}
function tipoIcon(t){return{pcc:'🌡️',limpieza:'🧹',trazabilidad:'📦',checklist:'✅',etiqueta:'🏷️'}[t]||'📋'}
function recordHTML(r){
  const d=r.datos||{};let title='',value='',resp=d.responsable||'';
  if(r.tipo==='pcc'){
    title=d.equipo||'PCC';
    if(d.tipo_medicion==='presencia_ausencia') value=d.valor||'';
    else value=`${d.valor||d.temperatura||''}${d.unidad||'°C'}`;
    if(d.fuera_rango)value=`⚠️${value}`;
  }
  else if(r.tipo==='limpieza'){title=d.area||'Limpieza';value=d.tipo_limpieza||d.producto_limpieza||''}
  else if(r.tipo==='trazabilidad'){title=d.lote||'Lote';value=d.producto||'';if(d.rechazado)value='❌ RECHAZADO — '+value}
  else if(r.tipo==='checklist'){title=(d.tipo_checklist==='apertura'?'☀️ Apertura':'🌙 Cierre');value=`${d.completados}/${d.total}`}
  const hasAC=d.accion_correctiva;
  const acBadge=hasAC?`<span style="font-size:10px;color:${hasAC.accion_resuelta?'var(--success)':'var(--danger)'};font-weight:700"> • ${hasAC.accion_resuelta?'✅ AC Resuelta':'⚠️ AC Pendiente'}</span>`:'';
  return `<div class="record-item"><div class="record-badge ${badgeClass(r.estado)}"></div><div class="record-info"><div class="record-title">${tipoIcon(r.tipo)} ${title}</div><div class="record-meta">${timeAgo(r.created_at)} · ${statusLabel(r.estado)} ${r.estado}${resp?' · 👤'+resp:''}${acBadge}</div></div><div class="record-value">${value}</div></div>`;
}
function refreshDashboard(){
  const recs=STATE.records, today=new Date().toISOString().slice(0,10);
  const hoy=recs.filter(r=>(r.created_at||'').slice(0,10)===today);
  const nc=hoy.filter(r=>r.estado!=='conforme');
  const acCount=recs.filter(r=>r.datos?.accion_correctiva && !r.datos.accion_correctiva.accion_resuelta).length;
  $('kpiHoy').textContent=hoy.length; $('kpiAlertas').textContent=nc.length;
  $('kpiConf').textContent=(hoy.length?Math.round((hoy.length-nc.length)/hoy.length*100):100)+'%';
  $('kpiAC').textContent=acCount;
  $('recentList').innerHTML=recs.slice(0,10).map(recordHTML).join('')||'<p class="empty-state">Sin registros</p>';
  const badge=$('connBadge');
  if(badge) badge.innerHTML=STATE.isDemo?'<span style="color:var(--warning)">📱 Local</span>':'<span style="color:var(--accent)">☁️ Nube</span>';
}
function refreshPCCList(){const l=STATE.records.filter(r=>r.tipo==='pcc').slice(0,10);$('pccList').innerHTML=l.length?l.map(recordHTML).join(''):'<p class="empty-state">Sin registros PCC</p>';}
function refreshLimpList(){const l=STATE.records.filter(r=>r.tipo==='limpieza').slice(0,10);$('limpList').innerHTML=l.length?l.map(recordHTML).join(''):'<p class="empty-state">Sin registros</p>';}
function refreshTrazaList(){const l=STATE.records.filter(r=>r.tipo==='trazabilidad').slice(0,10);$('trazaList').innerHTML=l.length?l.map(recordHTML).join(''):'<p class="empty-state">Sin registros</p>';}

// ══════════════════════════════
// ADMIN PANEL
// ══════════════════════════════
async function loadAdminData(){
  if(STATE.role!=='admin'){$('adminContent').innerHTML='<div class="form-card"><p style="color:var(--danger)">🔒 Solo administradores</p></div>';return}
  loadAdminCompany(); loadAdminEquipment(); loadAdminAreas(); loadAdminChemicals(); loadAdminChecklists(); loadAdminUsers();
}

async function loadAdminCompany(){
  if(STATE.isDemo) return;
  const r=STATE.restaurant_info||{};
  $('cfgNombre').value=r.nombre||''; $('cfgNit').value=r.nit||''; $('cfgDir').value=r.direccion||''; $('cfgTel').value=r.telefono||'';
}
async function saveCompanyInfo(){
  if(STATE.isDemo){toast('No disponible en demo','error');return}
  const data={nombre:$('cfgNombre').value.trim(),nit:$('cfgNit').value.trim(),direccion:$('cfgDir').value.trim(),telefono:$('cfgTel').value.trim()};
  const{error}=await sb.from('restaurants').update(data).eq('id',STATE.restaurant_id);
  if(error)toast('Error: '+error.message,'error'); else{toast('✅ Empresa actualizada');STATE.restaurant_info={...STATE.restaurant_info,...data};}
}

// --- PCC Equipment ---
async function loadAdminEquipment(){
  const list=$('equipList'); list.innerHTML='';
  const tipoLabels={temperatura:'🌡️ Temp.',concentracion:'🧪 Conc.',presencia_ausencia:'🔍 Pres/Aus'};
  STATE.config.equipment.forEach(e=>{
    const tm=e.tipo_medicion||'temperatura', un=e.unidad||'°C';
    const detail=tm==='presencia_ausencia'?'Sí/No':`${e.temp_min}${un} — ${e.temp_max}${un}`;
    list.innerHTML+=`<div class="config-item"><span class="config-name">${tipoLabels[tm]||'📋'} ${e.nombre}</span><span class="config-detail">${detail}</span>${STATE.isDemo?'':`<button class="config-del" onclick="deleteEquipment('${e.id}')">✕</button>`}</div>`;
  });
}
async function addEquipment(){
  const nombre=$('eqNombre').value.trim(), tipoMed=$('eqTipoMed').value;
  if(!nombre){toast('Escribe un nombre','error');return}
  let min=0,max=0,unidad='°C';
  if(tipoMed==='presencia_ausencia'){unidad='Sí/No'; min=0; max=0;}
  else{
    min=parseFloat($('eqMin').value); max=parseFloat($('eqMax').value);
    if(isNaN(min)||isNaN(max)){toast('Completa los rangos','error');return}
    unidad=tipoMed==='concentracion'?($('eqUnidad').value||'ppm'):'°C';
  }
  if(STATE.isDemo){STATE.config.equipment.push({nombre,tipo_medicion:tipoMed,unidad,temp_min:min,temp_max:max});populateDropdowns();loadAdminEquipment();toast('✅ PCC agregado');$('eqNombre').value='';$('eqMin').value='';$('eqMax').value='';return}
  const{error}=await sb.from('equipment').insert([{restaurant_id:STATE.restaurant_id,nombre,tipo_medicion:tipoMed,unidad,temp_min:min,temp_max:max}]);
  if(error){toast('Error: '+error.message,'error');return}
  toast('✅ PCC agregado'); $('eqNombre').value='';$('eqMin').value='';$('eqMax').value='';
  await loadConfig(); loadAdminEquipment();
}
async function deleteEquipment(id){
  if(!confirm('¿Eliminar este PCC?'))return;
  const{error}=await sb.from('equipment').delete().eq('id',id);
  if(error){toast('Error','error');return}
  toast('PCC eliminado'); await loadConfig(); loadAdminEquipment();
}

// --- Areas ---
function renderConfigList(items, containerId, deleteFunc){
  const el=$(containerId); el.innerHTML='';
  items.forEach((item,i)=>{
    el.innerHTML+=`<div class="config-item"><span class="config-name">${item}</span><button class="config-del" onclick="${deleteFunc}(${i})">✕</button></div>`;
  });
}
async function updateRestaurantConfig(){
  if(STATE.isDemo)return;
  const config={areas_limpieza:STATE.config.areas,productos_limpieza:STATE.config.chemicals_clean,productos_desinfeccion:STATE.config.chemicals_desinf,tipos_limpieza:STATE.config.tipos_limpieza,metodos_limpieza:STATE.config.metodos,checklist_apertura:STATE.config.checklist_apertura,checklist_cierre:STATE.config.checklist_cierre};
  await sb.from('restaurants').update({config}).eq('id',STATE.restaurant_id);
  populateDropdowns();
}
function loadAdminAreas(){renderConfigList(STATE.config.areas,'areaList','deleteArea');}
async function addArea(){const v=$('newArea').value.trim();if(!v){toast('Escribe un nombre','error');return}STATE.config.areas.push(v);await updateRestaurantConfig();loadAdminAreas();$('newArea').value='';toast('✅ Área agregada');}
async function deleteArea(i){STATE.config.areas.splice(i,1);await updateRestaurantConfig();loadAdminAreas();toast('Área eliminada');}

// --- Chemicals ---
function loadAdminChemicals(){
  renderConfigList(STATE.config.chemicals_clean,'chemCleanList','deleteChemClean');
  renderConfigList(STATE.config.chemicals_desinf,'chemDesinfList','deleteChemDesinf');
}
async function addChemClean(){const v=$('newChemClean').value.trim();if(!v)return;STATE.config.chemicals_clean.push(v);await updateRestaurantConfig();loadAdminChemicals();$('newChemClean').value='';toast('✅ Producto agregado');}
async function deleteChemClean(i){STATE.config.chemicals_clean.splice(i,1);await updateRestaurantConfig();loadAdminChemicals();toast('Eliminado');}
async function addChemDesinf(){const v=$('newChemDesinf').value.trim();if(!v)return;STATE.config.chemicals_desinf.push(v);await updateRestaurantConfig();loadAdminChemicals();$('newChemDesinf').value='';toast('✅ Producto agregado');}
async function deleteChemDesinf(i){STATE.config.chemicals_desinf.splice(i,1);await updateRestaurantConfig();loadAdminChemicals();toast('Eliminado');}

// --- Checklists Admin ---
function loadAdminChecklists(){
  renderConfigList(STATE.config.checklist_apertura,'checkAperturaList','deleteCheckApertura');
  renderConfigList(STATE.config.checklist_cierre,'checkCierreList','deleteCheckCierre');
}
async function addCheckApertura(){const v=$('newCheckApertura').value.trim();if(!v)return;STATE.config.checklist_apertura.push(v);await updateRestaurantConfig();loadAdminChecklists();$('newCheckApertura').value='';toast('✅ Item agregado');}
async function deleteCheckApertura(i){STATE.config.checklist_apertura.splice(i,1);await updateRestaurantConfig();loadAdminChecklists();toast('Eliminado');}
async function addCheckCierre(){const v=$('newCheckCierre').value.trim();if(!v)return;STATE.config.checklist_cierre.push(v);await updateRestaurantConfig();loadAdminChecklists();$('newCheckCierre').value='';toast('✅ Item agregado');}
async function deleteCheckCierre(i){STATE.config.checklist_cierre.splice(i,1);await updateRestaurantConfig();loadAdminChecklists();toast('Eliminado');}

// --- Users ---
async function loadAdminUsers(){
  const list=$('userList');
  if(STATE.isDemo){list.innerHTML='<p class="empty-state">No disponible en demo</p>';return}
  list.innerHTML='<p class="empty-state">Cargando...</p>';
  try{
    const{data:users}=await sb.from('users').select('id,nombre,rol,fecha_creacion');
    if(!users||!users.length){list.innerHTML='<p class="empty-state">Sin usuarios</p>';return}
    list.innerHTML='';
    users.forEach(u=>{
      const isMe=u.id===STATE.user.id;
      list.innerHTML+=`<div class="config-item" style="flex-wrap:wrap;gap:8px">
        <div style="flex:1;min-width:120px"><span class="config-name">${u.nombre||'Sin nombre'}${isMe?' (Tú)':''}</span>
        <span class="config-detail">${new Date(u.fecha_creacion).toLocaleDateString('es-CO')}</span></div>
        <select class="input" style="width:auto;min-width:120px;margin:0;padding:8px" onchange="changeUserRole('${u.id}',this.value)" ${isMe?'disabled':''}>
          <option value="admin" ${u.rol==='admin'?'selected':''}>👑 Admin</option>
          <option value="supervisor" ${u.rol==='supervisor'?'selected':''}>📋 Supervisor</option>
          <option value="empleado" ${u.rol==='empleado'?'selected':''}>👤 Empleado</option>
        </select></div>`;
    });
  }catch(e){list.innerHTML=`<p class="empty-state">Error: ${e.message}</p>`}
}
async function changeUserRole(userId, newRole){
  const{error}=await sb.from('users').update({rol:newRole}).eq('id',userId);
  if(error)toast('Error: '+error.message,'error'); else toast(`✅ Rol cambiado a ${newRole}`);
}

// ═══ EQ TYPE TOGGLE ═══
function onEqTipoChange(){
  const tipo=$('eqTipoMed').value;
  if(tipo==='presencia_ausencia'){$('eqRangoFields').style.display='none';}
  else{$('eqRangoFields').style.display='flex';
    $('eqUnidadLabel').textContent=tipo==='concentracion'?'Unidad: ppm':'Unidad: °C';}
}

// ═══ PDF ═══
function getFilteredRecords(){
  let r=STATE.records; const t=$('repTipo').value,d=$('repDesde').value,h=$('repHasta').value;
  if(t)r=r.filter(x=>x.tipo===t);if(d)r=r.filter(x=>(x.created_at||'').slice(0,10)>=d);if(h)r=r.filter(x=>(x.created_at||'').slice(0,10)<=h);return r;
}
function handlePreview(){
  const recs=getFilteredRecords();if(!recs.length){toast('No hay registros','error');return}
  let h='<table class="report-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Resp.</th></tr></thead><tbody>';
  recs.forEach(r=>{const d=r.datos||{};let det='';
    if(r.tipo==='pcc')det=`${d.equipo}: ${d.valor||d.temperatura||''}${d.unidad||'°C'}`;
    else if(r.tipo==='limpieza')det=`${d.area} — ${d.producto_limpieza||''}`;
    else if(r.tipo==='trazabilidad'){det=`${d.lote} — ${d.producto}`;if(d.rechazado)det+=' [RECHAZADO → '+d.destino_rechazo+']';}
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
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')} | Giovanni Duarte MVZ`,14,29);
  let y=42;const tipo=$('repTipo').value;doc.setTextColor(40);doc.setFontSize(10);
  if(tipo)doc.text(`Tipo: ${tipo.toUpperCase()}`,14,y);
  const desde=$('repDesde').value,hasta=$('repHasta').value;
  if(desde||hasta)doc.text(`Período: ${desde||'...'} — ${hasta||'...'}`,tipo?80:14,y); y+=8;
  const conf=recs.filter(r=>r.estado==='conforme').length,nc=recs.filter(r=>r.estado==='no_conforme').length;
  doc.setFontSize(9);doc.text(`Total: ${recs.length} | Conformes: ${conf} | No conformes: ${nc} | Conformidad: ${recs.length?Math.round(conf/recs.length*100):100}%`,14,y);
  const rows=recs.map(r=>{const d=r.datos||{};let det='';
    if(r.tipo==='pcc')det=`${d.equipo}: ${d.valor||d.temperatura||''}${d.unidad||'°C'} (${d.lim_inf}–${d.lim_sup})`;
    else if(r.tipo==='limpieza')det=`${d.area} | ${d.producto_limpieza||'-'} / ${d.producto_desinfeccion||'-'}`;
    else if(r.tipo==='trazabilidad'){det=`Lote: ${d.lote} | ${d.producto}`;if(d.rechazado)det+=' [RECHAZADO]';}
    return[new Date(r.created_at).toLocaleDateString('es-CO'),r.tipo.toUpperCase(),det,r.estado,d.responsable||'',r.observaciones||''];
  });
  doc.autoTable({startY:y+4,head:[['Fecha','Tipo','Detalle','Estado','Resp.','Obs.']],body:rows,
    styles:{fontSize:7,cellPadding:2},headStyles:{fillColor:[45,138,78],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[245,245,245]},
    didParseCell:function(d){if(d.column.index===3&&d.section==='body'){if(d.cell.raw==='no_conforme')d.cell.styles.textColor=[239,68,68];else if(d.cell.raw==='conforme')d.cell.styles.textColor=[45,138,78];}}
  });
  const pc=doc.internal.getNumberOfPages();
  for(let i=1;i<=pc;i++){doc.setPage(i);doc.setFillColor(26,58,92);const ph=doc.internal.pageSize.height;
    doc.rect(0,ph-12,210,12,'F');doc.setTextColor(255);doc.setFontSize(7);
    doc.text(`GD FORGE — Giovanni Duarte MVZ | Consultor en Calidad e Inocuidad | Pág ${i}/${pc}`,105,ph-5,{align:'center'});}
  doc.save(`HACCP_GDForge_${new Date().toISOString().slice(0,10)}.pdf`);toast('✅ PDF descargado');
}

// ══════════════════════════════
// INIT
// ══════════════════════════════
document.addEventListener('DOMContentLoaded',()=>{
  $('loginForm').addEventListener('submit',handleLogin);
  $('registerForm').addEventListener('submit',handleRegister);
  $('forgotForm').addEventListener('submit',handleForgotPassword);
  $('btnDemo').addEventListener('click',enterDemo);
  $('btnLogout').addEventListener('click',handleLogout);
  $('showRegister').addEventListener('click',e=>{e.preventDefault();showRegisterForm()});
  $('showLogin').addEventListener('click',e=>{e.preventDefault();showLoginForm()});
  $('showForgot').addEventListener('click',e=>{e.preventDefault();showForgotForm()});
  $('btnSetResp').addEventListener('click',setResponsable);
  $('globalResponsable').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setResponsable()}});
  document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  $('formPCC').addEventListener('submit',handlePCC);
  $('formLimpieza').addEventListener('submit',handleLimpieza);
  $('formTraza').addEventListener('submit',handleTraza);
  $('btnGenPDF').addEventListener('click',handleGenPDF);
  $('btnPreview').addEventListener('click',handlePreview);
  initStatusButtons(); initRechazoToggle();
  const today=new Date().toISOString().slice(0,10);
  $('repDesde').value=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  $('repHasta').value=today; if($('trazaIngreso'))$('trazaIngreso').value=today;
  $('pccEquipo').addEventListener('change',onPCCChange);
  $('pccTemp').addEventListener('input',checkPCCRange);
  // Admin buttons
  $('btnSaveCompany')?.addEventListener('click',saveCompanyInfo);
  $('btnAddEquip')?.addEventListener('click',addEquipment);
  $('btnAddArea')?.addEventListener('click',addArea);
  $('btnAddChemClean')?.addEventListener('click',addChemClean);
  $('btnAddChemDesinf')?.addEventListener('click',addChemDesinf);
  $('eqTipoMed')?.addEventListener('change',onEqTipoChange);
  // Photo listeners
  $('pccFoto')?.addEventListener('change',()=>onPhotoSelect('pcc','pccFoto','pccFotoPreview'));
  $('limpFoto')?.addEventListener('change',()=>onPhotoSelect('limp','limpFoto','limpFotoPreview'));
  $('trazaFoto')?.addEventListener('change',()=>onPhotoSelect('traza','trazaFoto','trazaFotoPreview'));
  // Checklist listeners
  $('btnCheckApertura')?.addEventListener('click',()=>showChecklist('apertura'));
  $('btnCheckCierre')?.addEventListener('click',()=>showChecklist('cierre'));
  $('btnSaveCheck')?.addEventListener('click',saveChecklist);
  // Label listeners
  $('btnGenLabel')?.addEventListener('click',generateLabel);
  $('btnPrintLabel')?.addEventListener('click',printLabel);
  // Checklist admin listeners
  $('btnAddCheckApertura')?.addEventListener('click',addCheckApertura);
  $('btnAddCheckCierre')?.addEventListener('click',addCheckCierre);
  // Set default dates for labels
  if($('etPrep'))$('etPrep').value=today;
  initVoice();
  checkSession();
});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

// ══════════════════════════════
// VOICE DICTATION — Web Speech API
// ══════════════════════════════
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const VOICE_SUPPORTED = !!SpeechRecognition;

function initVoice(){
  if(!VOICE_SUPPORTED) return;
  // Find all text inputs and textareas inside form-cards
  const inputs = document.querySelectorAll('.form-card input[type="text"], .form-card textarea, #globalResponsable');
  inputs.forEach(inp => {
    if(inp.type==='file' || inp.type==='date' || inp.type==='number' || inp.classList.contains('photo-input')) return;
    if(inp.style.display === 'none' || inp.type === 'hidden') return;
    const wrap = document.createElement('div');
    wrap.className = 'voice-wrap';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'voice-btn';
    btn.title = 'Dictar por voz';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    btn.addEventListener('click', (e) => { e.preventDefault(); toggleVoice(inp, btn); });
    wrap.appendChild(btn);
  });
}

function toggleVoice(input, btn){
  // If already recording this input, stop
  if(STATE.voiceActive && STATE.voiceActive.input === input){
    STATE.voiceActive.recognition.stop();
    return;
  }
  // If recording another input, stop that first
  if(STATE.voiceActive){
    STATE.voiceActive.recognition.stop();
  }
  const recognition = new SpeechRecognition();
  recognition.lang = 'es-CO';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalTranscript = '';
  const startValue = input.value;

  recognition.onstart = () => {
    btn.classList.add('recording');
    input.classList.add('voice-active');
    toast('🎤 Escuchando... habla ahora');
    if(navigator.vibrate) navigator.vibrate(100);
  };

  recognition.onresult = (event) => {
    let finalT = '';
    let interimT = '';
    for(let i = 0; i < event.results.length; i++){
      if(event.results[i].isFinal){
        finalT += event.results[i][0].transcript + ' ';
      } else {
        interimT += event.results[i][0].transcript;
      }
    }
    finalTranscript = finalT; // save for onend if needed
    const separator = startValue && !startValue.endsWith(' ') ? ' ' : '';
    input.value = startValue + separator + finalT + interimT;
    // Trigger input event for any listeners
    input.dispatchEvent(new Event('input', {bubbles:true}));
  };

  recognition.onerror = (event) => {
    if(event.error === 'no-speech'){
      toast('🎤 No escuché nada, intenta de nuevo','error');
    } else if(event.error === 'not-allowed'){
      toast('⚠️ Permite el acceso al micrófono','error');
    }
    stopVoice(btn, input);
  };

  recognition.onend = () => {
    // Finalize the value
    const separator = startValue && !startValue.endsWith(' ') ? ' ' : '';
    input.value = startValue + separator + finalTranscript.trim();
    input.dispatchEvent(new Event('input', {bubbles:true}));
    stopVoice(btn, input);
    if(finalTranscript.trim()) toast('✅ Texto dictado correctamente');
  };

  recognition.start();
  STATE.voiceActive = { recognition, input, btn };
}

function stopVoice(btn, input){
  btn.classList.remove('recording');
  input.classList.remove('voice-active');
  STATE.voiceActive = null;
}
