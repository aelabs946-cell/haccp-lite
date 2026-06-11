// ══════════════════════════════
// ADMIN PANEL
// ══════════════════════════════
async function loadAdminData(){
  if(STATE.role!=='admin'){
    $('adminContent').innerHTML='<div class="form-card"><p style="color:var(--danger)">🔒 Solo administradores</p></div>';
    return;
  }
  loadAdminCompany(); 
  loadAdminEquipment(); 
  loadAdminAreas(); 
  loadAdminChemicals(); 
  loadAdminChecklists(); 
  loadAdminUsers();
  loadAdminCapacitaciones();
}

async function loadAdminCompany(){
  if(STATE.isDemo) return;
  const r=STATE.restaurant_info||{};
  $('cfgNombre').value=r.nombre||''; 
  $('cfgNit').value=r.nit||''; 
  $('cfgDir').value=r.direccion||''; 
  $('cfgTel').value=r.telefono||'';
}

async function saveCompanyInfo(){
  if(STATE.isDemo){toast('No disponible en demo','error');return}
  const data = {
    nombre: $('cfgNombre').value.trim(),
    nit: $('cfgNit').value.trim(),
    direccion: $('cfgDir').value.trim(),
    telefono: $('cfgTel').value.trim(),
    logo_base64: STATE.customLogo || null
  };
  const {error} = await sb.from('restaurants').update(data).eq('id', STATE.restaurant_id);
  if(error) toast('Error: '+error.message, 'error'); 
  else {
    toast('✅ Identidad Corporativa actualizada', 'success');
    STATE.restaurant_info = {...STATE.restaurant_info, ...data};
    if(data.nombre) document.querySelectorAll('.footer-name, .login-title').forEach(el => el.textContent = data.nombre);
    if(data.logo_base64) document.querySelectorAll('.footer-logo, .login-logo img').forEach(img => img.src = data.logo_base64);
  }
}

// --- Config Dropdowns ---
async function loadConfig(){
  if(STATE.isDemo){ STATE.config={...DEFAULTS}; populateDropdowns(); return; }
  try{
    const{data:equip}=await sb.from('equipment').select('*').eq('activo',true).order('nombre');
    const{data:rest}=await sb.from('restaurants').select('config,nombre,nit,direccion,telefono,logo_base64').single();
    const c=rest?.config||{};
    STATE.config={
      equipment:equip||DEFAULTS.equipment,
      areas:c.areas_limpieza||DEFAULTS.areas,
      chemicals_clean:c.productos_limpieza||DEFAULTS.chemicals_clean,
      chemicals_desinf:c.productos_desinfeccion||DEFAULTS.chemicals_desinf,
      tipos_limpieza:c.tipos_limpieza||DEFAULTS.tipos_limpieza,
      metodos:c.metodos_limpieza||DEFAULTS.metodos,
      checklist_apertura:c.checklist_apertura||DEFAULTS.checklist_apertura,
      checklist_cierre:c.checklist_cierre||DEFAULTS.checklist_cierre,
      capacitaciones:c.capacitaciones||DEFAULTS.capacitaciones
    };
    STATE.restaurant_info=rest||{};
    if(rest){
      if(rest.nombre){
        document.querySelectorAll('.footer-name, .login-title').forEach(el => el.textContent = rest.nombre);
        if($('cfgNombre')) $('cfgNombre').value = rest.nombre;
      }
      if(rest.nit && $('cfgNit')) $('cfgNit').value = rest.nit;
      if(rest.telefono && $('cfgTel')) $('cfgTel').value = rest.telefono;
      if(rest.direccion && $('cfgDir')) $('cfgDir').value = rest.direccion;
      if(rest.logo_base64){
        document.querySelectorAll('.footer-logo, .login-logo img, #cfgLogoPreview').forEach(img => img.src = rest.logo_base64);
        STATE.customLogo = rest.logo_base64;
      }
    }
  }catch(err){console.error('Error loadConfig:',err); STATE.config={...DEFAULTS}; }
  populateDropdowns();
}

function populateDropdowns(){
  const C=STATE.config;
  // PCC Equipment
  const pcc=$('pccEquipo'); 
  if(pcc){
    pcc.innerHTML='<option value="">Seleccionar PCC...</option>';
    C.equipment.forEach(e=>{
      const tm=e.tipo_medicion||'temperatura', un=e.unidad||'°C';
      pcc.innerHTML+=`<option value="${e.nombre}" data-min="${e.temp_min}" data-max="${e.temp_max}" data-tipo="${tm}" data-unidad="${un}">${e.nombre} (${un})</option>`;
    });
  }
  // Limpieza Areas
  const area=$('limpArea'); 
  if(area){
    area.innerHTML='<option value="">Seleccionar...</option>';
    C.areas.forEach(a=>{ area.innerHTML+=`<option>${a}</option>`; });
  }
  // Tipo Limpieza
  const tipo=$('limpTipo'); 
  if(tipo){
    tipo.innerHTML='<option value="">Seleccionar...</option>';
    C.tipos_limpieza.forEach(t=>{ tipo.innerHTML+=`<option>${t}</option>`; });
  }
  // Metodo
  const met=$('limpMetodo'); 
  if(met){
    met.innerHTML='<option value="">—</option>';
    C.metodos.forEach(m=>{ met.innerHTML+=`<option>${m}</option>`; });
  }
  // Datalists
  let dl1=$('listaLimpieza'); if(!dl1){dl1=document.createElement('datalist');dl1.id='listaLimpieza';document.body.appendChild(dl1);}
  dl1.innerHTML=''; C.chemicals_clean.forEach(c=>{dl1.innerHTML+=`<option value="${c}">`;});
  let dl2=$('listaDesinf'); if(!dl2){dl2=document.createElement('datalist');dl2.id='listaDesinf';document.body.appendChild(dl2);}
  dl2.innerHTML=''; C.chemicals_desinf.forEach(c=>{dl2.innerHTML+=`<option value="${c}">`;});
  
  if(typeof renderAcademy === 'function') renderAcademy();
}

function renderConfigList(arr, containerId, deleteFnName){
  const c=$(containerId); if(!c)return;
  c.innerHTML='';
  arr.forEach((item,i)=>{
    c.innerHTML+=`<div class="config-item"><span class="config-name">${item}</span>${STATE.isDemo?'':`<button class="config-del" onclick="${deleteFnName}(${i})">✕</button>`}</div>`;
  });
}

// --- PCC Equipment ---
async function loadAdminEquipment(){
  const list=$('equipList'); if(!list) return;
  list.innerHTML='';
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
  
  if(STATE.isDemo){
    STATE.config.equipment.push({nombre,tipo_medicion:tipoMed,unidad,temp_min:min,temp_max:max});
    populateDropdowns();
    loadAdminEquipment();
    toast('✅ PCC agregado');
    $('eqNombre').value='';$('eqMin').value='';$('eqMax').value='';
    return;
  }
  
  const{error}=await sb.from('equipment').insert([{restaurant_id:STATE.restaurant_id,nombre,tipo_medicion:tipoMed,unidad,temp_min:min,temp_max:max}]);
  if(error) toast(error.message,'error');
  else {
    toast('✅ PCC agregado');
    $('eqNombre').value='';$('eqMin').value='';$('eqMax').value='';
    await loadConfig();
    loadAdminEquipment();
  }
}

async function deleteEquipment(id){
  if(STATE.isDemo) return;
  const{error}=await sb.from('equipment').update({activo:false}).eq('id',id);
  if(error) toast(error.message,'error');
  else {
    toast('🗑️ Eliminado');
    await loadConfig();
    loadAdminEquipment();
  }
}

function onEqTipoChange(){
  const tipo=$('eqTipoMed').value;
  if(tipo==='presencia_ausencia'){$('eqRangoFields').style.display='none';}
  else{
    $('eqRangoFields').style.display='flex';
    $('eqUnidadLabel').textContent=tipo==='concentracion'?'Unidad: ppm':'Unidad: °C';
  }
}

// --- Areas ---
function loadAdminAreas(){renderConfigList(STATE.config.areas,'areaList','deleteArea');}
async function addArea(){const v=$('newArea').value.trim();if(!v){toast('Escribe un nombre','error');return}STATE.config.areas.push(v);await ConfigManager.saveSection('areas_limpieza', STATE.config.areas);loadAdminAreas();$('newArea').value='';toast('✅ Área agregada');}
async function deleteArea(i){STATE.config.areas.splice(i,1);await ConfigManager.saveSection('areas_limpieza', STATE.config.areas);loadAdminAreas();toast('Área eliminada');}

// --- Chemicals ---
function loadAdminChemicals(){
  renderConfigList(STATE.config.chemicals_clean,'chemCleanList','deleteChemClean');
  renderConfigList(STATE.config.chemicals_desinf,'chemDesinfList','deleteChemDesinf');
}
async function addChemClean(){const v=$('newChemClean').value.trim();if(!v)return;STATE.config.chemicals_clean.push(v);await ConfigManager.saveSection('productos_limpieza', STATE.config.chemicals_clean);loadAdminChemicals();$('newChemClean').value='';toast('✅ Producto agregado');}
async function deleteChemClean(i){STATE.config.chemicals_clean.splice(i,1);await ConfigManager.saveSection('productos_limpieza', STATE.config.chemicals_clean);loadAdminChemicals();toast('Eliminado');}
async function addChemDesinf(){const v=$('newChemDesinf').value.trim();if(!v)return;STATE.config.chemicals_desinf.push(v);await ConfigManager.saveSection('productos_desinfeccion', STATE.config.chemicals_desinf);loadAdminChemicals();$('newChemDesinf').value='';toast('✅ Producto agregado');}
async function deleteChemDesinf(i){STATE.config.chemicals_desinf.splice(i,1);await ConfigManager.saveSection('productos_desinfeccion', STATE.config.chemicals_desinf);loadAdminChemicals();toast('Eliminado');}

// --- Checklists Admin ---
function loadAdminChecklists(){
  renderConfigList(STATE.config.checklist_apertura,'checkAperturaList','deleteCheckApertura');
  renderConfigList(STATE.config.checklist_cierre,'checkCierreList','deleteCheckCierre');
}
async function addCheckApertura(){const v=$('newCheckApertura').value.trim();if(!v)return;STATE.config.checklist_apertura.push(v);await ConfigManager.saveSection('checklist_apertura', STATE.config.checklist_apertura);loadAdminChecklists();$('newCheckApertura').value='';toast('✅ Item agregado');}
async function deleteCheckApertura(i){STATE.config.checklist_apertura.splice(i,1);await ConfigManager.saveSection('checklist_apertura', STATE.config.checklist_apertura);loadAdminChecklists();toast('Eliminado');}
async function addCheckCierre(){const v=$('newCheckCierre').value.trim();if(!v)return;STATE.config.checklist_cierre.push(v);await ConfigManager.saveSection('checklist_cierre', STATE.config.checklist_cierre);loadAdminChecklists();$('newCheckCierre').value='';toast('✅ Item agregado');}
async function deleteCheckCierre(i){STATE.config.checklist_cierre.splice(i,1);await ConfigManager.saveSection('checklist_cierre', STATE.config.checklist_cierre);loadAdminChecklists();toast('Eliminado');}

// --- Capacitaciones Admin ---
function loadAdminCapacitaciones(){
  const list = $('adminAcademyList');
  if(!list) return;
  list.innerHTML = '';
  STATE.config.capacitaciones.forEach(c => {
    list.innerHTML += `<div class="config-item"><span class="config-name">🎓 ${c.titulo}</span><button class="config-del" onclick="deleteCapacitacion('${c.id}')">🗑️</button></div>`;
  });
}
async function addCapacitacion(){
  const titulo = $('capNombre').value.trim();
  const contenido = $('capContenido').value.trim();
  if(!titulo || !contenido){ toast('Escribe el título y contenido', 'error'); return; }
  
  STATE.config.capacitaciones.push({
    id: crypto.randomUUID(),
    titulo: titulo,
    contenido: contenido
  });
  
  await ConfigManager.saveSection('capacitaciones', STATE.config.capacitaciones);
  $('capNombre').value = '';
  $('capContenido').value = '';
  toast('✅ Curso agregado');
  loadAdminCapacitaciones();
}

async function deleteCapacitacion(id){
  if(!confirm('¿Eliminar este curso?')) return;
  STATE.config.capacitaciones = STATE.config.capacitaciones.filter(c => c.id !== id);
  await ConfigManager.saveSection('capacitaciones', STATE.config.capacitaciones);
  loadAdminCapacitaciones();
  toast('Curso eliminado');
}

// --- Render Academy (User View) ---
function renderAcademy(){
  const list = $('academyList');
  if(!list) return;
  
  if(STATE.config.capacitaciones.length === 0){
    list.innerHTML = `<p style="text-align:center;color:var(--text3);padding:20px 0;font-size:13px">Aún no hay cursos disponibles en la Academia.</p>`;
    return;
  }
  
  list.innerHTML = STATE.config.capacitaciones.map(c => `
    <div class="training-item" onclick="openHelp('${c.id}', true)">
      <div class="training-icon">🎓</div>
      <div class="training-info">
        <h4>${c.titulo}</h4>
        <p>Toca para iniciar el entrenamiento</p>
      </div>
      <div class="training-action">Empezar</div>
    </div>
  `).join('');
}

// --- Users Admin ---
async function loadAdminUsers(){
  const list=$('userList');
  if(!list) return;
  if(STATE.isDemo){list.innerHTML='<p class="empty-state">No disponible en demo</p>';return}
  list.innerHTML='<p class="empty-state">Cargando...</p>';
  try{
    const{data:users}=await sb.from('users').select('id,nombre,email,rol,estado_usuario,fecha_creacion');
    if(!users||!users.length){list.innerHTML='<p class="empty-state">Sin usuarios</p>';return}
    
    STATE.admin_users = users;
    
    list.innerHTML='';
    users.forEach(u=>{
      const isMe=u.id===STATE.user.id;
      const estadoColor = u.estado_usuario === 'activo' ? 'var(--success)' : (u.estado_usuario === 'bloqueado' ? 'var(--danger)' : 'var(--warning)');
      
      list.innerHTML+=`<div class="config-item" style="flex-wrap:wrap;gap:8px; border-left:4px solid ${estadoColor}">
        <div style="flex:1;min-width:120px">
          <span class="config-name">${u.nombre||'Sin nombre'} <span style="font-size:10px; color:var(--text3)">${u.email||''}</span> ${isMe?' (Tú)':''}</span>
          <span class="config-detail">${new Date(u.fecha_creacion).toLocaleDateString('es-CO')}</span>
        </div>
        
        <select class="input" style="width:auto;min-width:110px;margin:0;padding:4px 8px;font-size:12px;" onchange="changeUserState('${u.id}',this.value)" ${isMe?'disabled':''}>
          <option value="activo" ${u.estado_usuario==='activo'?'selected':''}>✅ Activo</option>
          <option value="pendiente" ${u.estado_usuario==='pendiente'?'selected':''}>⏳ Pendiente</option>
          <option value="bloqueado" ${u.estado_usuario==='bloqueado'?'selected':''}>❌ Bloqueado</option>
        </select>

        <select class="input" style="width:auto;min-width:110px;margin:0;padding:4px 8px;font-size:12px;" onchange="changeUserRole('${u.id}',this.value)">
          <option value="admin" ${u.rol==='admin'?'selected':''}>👑 Admin</option>
          <option value="supervisor" ${u.rol==='supervisor'?'selected':''}>📋 Supervisor</option>
          <option value="empleado" ${u.rol==='empleado'?'selected':''}>👤 Empleado</option>
        </select></div>`;
    });
  }catch(e){list.innerHTML=`<p class="empty-state">Error: ${e.message}</p>`}
}

async function changeUserRole(id, newRole) {
  if (!confirm(`¿Estás seguro de cambiar el rol a ${newRole.toUpperCase()}?`)) {
    loadAdminUsers(); // Revert UI
    return;
  }
  try {
    const {error} = await sb.from('users').update({rol: newRole}).eq('id', id);
    if(error) throw error;
    toast('Rol actualizado correctamente', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
  loadAdminUsers();
}

async function changeUserState(id, newState) {
  if (!confirm(`¿Estás seguro de cambiar el estado a ${newState.toUpperCase()}?`)) {
    loadAdminUsers(); // Revert UI
    return;
  }
  try {
    const {error} = await sb.from('users').update({estado_usuario: newState}).eq('id', id);
    if(error) throw error;
    toast('Estado actualizado correctamente', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
  loadAdminUsers();
}
