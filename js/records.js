// ══════════════════════════════
// DATA OPERATIONS
// ══════════════════════════════
async function loadRecords(){
  if(STATE.isDemo){STATE.records=getRecords();return}
  try{
    const{data,error}=await sb.from('control_records').select('*').order('created_at',{ascending:false}).limit(200);
    if(!error&&data){
      STATE.records = data;
      saveRecords(STATE.records);
      syncPendingRecords();
    } else STATE.records=getRecords();
  }catch(e){STATE.records=getRecords()}
  updateSyncBadge();
}

async function insertRecord(record){
  record.id = record.id || crypto.randomUUID();
  record.created_at = record.created_at || new Date().toISOString();
  if(STATE.isDemo) return addRecord(record);
  try{
    const row={
      id:record.id, 
      restaurant_id:STATE.restaurant_id,
      tipo:record.tipo,
      datos:record.datos,
      estado:record.estado,
      observaciones:record.observaciones||null,
      accion_correctiva:record.accion_correctiva||null,
      registrado_por:STATE.user.id,
      created_at:record.created_at
    };
    const{data,error}=await sb.from('control_records').insert([row]).select();
    if(error){
      if(error.code !== '23505') toast('💾 Guardado local (Sincronizará al haber señal)','warning');
      return addRecord(record);
    }
    const ins=data[0]; 
    STATE.records.unshift(ins); 
    saveRecords(STATE.records); 
    return ins;
  }catch(e){
    toast('💾 Guardado local (Sincronizará al haber señal)','warning');
    return addRecord(record);
  }
}

// ══════════════════════════════
// FORM HANDLERS & HELPERS
// ══════════════════════════════

// ═══ PCC ═══
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
  if(r){
    toast('✅ PCC registrado');
    $('formPCC').reset();
    fillResponsable(STATE.responsable);
    clearPhoto('pcc');
    resetAC('pcc');
    $('pccRangeIndicator').style.display='none';
    $('pccMedicionBool').style.display='none';
    $('pccMedicionNum').style.display='block';
    if(typeof refreshPCCList === 'function') refreshPCCList();
    if(typeof refreshDashboard === 'function') refreshDashboard();
    if(navigator.vibrate)navigator.vibrate(150);
  }
}

// ═══ LIMPIEZA ═══
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
  if(r){
    toast('✅ Limpieza registrada');
    $('formLimpieza').reset();
    fillResponsable(STATE.responsable);
    clearPhoto('limp');
    resetAC('limp');
    if(typeof refreshLimpList === 'function') refreshLimpList();
    if(typeof refreshDashboard === 'function') refreshDashboard();
    if(navigator.vibrate)navigator.vibrate(150);
  }
}

// ═══ TRAZABILIDAD ═══
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
  if(r){
    toast('✅ Trazabilidad registrada');
    $('formTraza').reset();
    fillResponsable(STATE.responsable);
    clearPhoto('traza');
    resetAC('traza');
    $('trazaRechazoFields').style.display='none';
    if(typeof refreshTrazaList === 'function') refreshTrazaList();
    if(typeof refreshDashboard === 'function') refreshDashboard();
    if(navigator.vibrate)navigator.vibrate(150);
  }
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
  const r=await insertRecord({
    tipo:'checklist',
    datos:{
      tipo_checklist:STATE.checklistType,
      items_completados:checkedItems,
      items_pendientes:uncheckedItems,
      total:items.length,
      completados:done,
      porcentaje:Math.round(done/items.length*100),
      responsable:STATE.responsable
    },
    estado:done===items.length?'conforme':'no_conforme',
    observaciones:$('checkObs')?.value?.trim()||''
  });
  if(r){
    toast(`✅ Checklist ${STATE.checklistType} guardado (${done}/${items.length})`);
    STATE.checklistState={};
    showChecklist(STATE.checklistType);
    if(typeof refreshDashboard === 'function') refreshDashboard();
    if(navigator.vibrate)navigator.vibrate(150);
  }
}
