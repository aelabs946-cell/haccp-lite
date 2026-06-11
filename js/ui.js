// ══════════════════════════════
// RESPONSABLE
// ══════════════════════════════
function fillResponsable(name){
  ['pccResp','limpResp','trazaResp'].forEach(id=>{
    if($(id))$(id).value=name;
  });
}

function setResponsable(){
  const n=$('globalResponsable').value.trim();
  if(!n){toast('Escribe tu nombre','error');return;}
  STATE.responsable=n;
  localStorage.setItem('haccp_responsable',n);
  fillResponsable(n);
  $('responsableBar').style.display='none';
  toast('👤 '+n);
}

// ══════════════════════════════
// NAV & TABS
// ══════════════════════════════
function switchTab(tabId){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  $(tabId).classList.add('active');
  STATE.currentTab=tabId;
  
  if(tabId==='tabDashboard'){
    $('btnBack').style.display='none';
    $('headerLogoImg').style.display='block';
  }else{
    $('btnBack').style.display='flex';
    $('headerLogoImg').style.display='none';
  }
  window.scrollTo(0,0);
  
  if(tabId==='tabAdmin') { if(typeof loadAdminData === 'function') loadAdminData(); }
  if(tabId==='tabPCC') { if(typeof refreshPCCList === 'function') refreshPCCList(); }
  if(tabId==='tabLimpieza') { if(typeof refreshLimpList === 'function') refreshLimpList(); }
  if(tabId==='tabTraza') { if(typeof refreshTrazaList === 'function') refreshTrazaList(); }
}

function openHelp(mod, isTraining = false){
  const content = $('helpContent');
  let html = '';
  let cursoNombre = '';
  if(mod === 'pcc') {
    cursoNombre = 'Manejo de PCC';
    html = `
      <div class="help-title">🌡️ Ayuda: Control PCC</div>
      <div class="help-q">¿Qué es un Punto Crítico de Control?</div>
      <div class="help-a">Es un punto en el proceso donde se puede aplicar un control para prevenir o eliminar un peligro de inocuidad.</div>
      <div class="help-q">¿Qué hago si la temperatura está fuera de rango?</div>
      <div class="help-a">El sistema marcará "No Conforme". Debes seleccionar una Acción Correctiva inmediatamente (ej. rechazar lote o ajustar equipo).</div>
      <div class="help-q">¿Por qué usar el micrófono?</div>
      <div class="help-a">Puedes dictar las observaciones rápidamente sin tener que quitarte los guantes o escribir en la pantalla.</div>
    `;
  } else if(mod === 'limpieza') {
    cursoNombre = 'POE de Limpieza';
    html = `
      <div class="help-title">🧹 Ayuda: Limpieza y Desinfección</div>
      <div class="help-q">¿Cómo registrar un área limpia?</div>
      <div class="help-a">Selecciona el área y los elementos limpiados. Si todo está en orden, marca "Conforme".</div>
      <div class="help-q">¿Qué pasa si encuentro suciedad?</div>
      <div class="help-a">Marca "No Conforme", toma una foto de la evidencia y documenta la acción correctiva (ej. volver a lavar).</div>
      <div class="help-q">¿Es obligatorio subir fotos?</div>
      <div class="help-a">Solo es obligatorio si el resultado es "No Conforme", para documentar el hallazgo.</div>
    `;
  } else {
    // Dynamic Training Course
    const course = STATE.config.capacitaciones.find(c => c.id === mod);
    if(course) {
      cursoNombre = course.titulo;
      const contHtml = course.contenido.split('\n').filter(p=>p.trim()).map(p=>`<p style="font-size:13px;color:var(--text2);margin-bottom:12px;line-height:1.6">${p}</p>`).join('');
      html = `
        <div class="help-title">🎓 ${course.titulo}</div>
        ${contHtml}
      `;
    }
  }
  
  if (isTraining && cursoNombre) {
    html += `
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--card-border);text-align:center">
        <p style="font-size:12px;color:var(--text2);margin-bottom:12px">Confirmo que he leído y comprendido los conceptos de este módulo.</p>
        <button class="btn btn-primary" style="width:100%" onclick="firmarCapacitacion('${cursoNombre}')">✅ Firmar Capacitación</button>
      </div>
    `;
  }
  
  content.innerHTML = html;
  $('helpModal').classList.add('show');
}

async function firmarCapacitacion(curso) {
  if(!STATE.user || !STATE.restaurant_id) return toast('Error de sesión', 'error');
  const record = {
    id: crypto.randomUUID(),
    user_id: STATE.user.id,
    restaurant_id: STATE.restaurant_id,
    modulo: 'capacitacion',
    data: { curso: curso, estado: 'Completado', responsable: STATE.responsable || STATE.user.email },
    sync: 0,
    created_at: new Date().toISOString()
  };
  
  // This will try to sync locally or remote immediately
  if(typeof saveRecordLocally === 'function') {
      await saveRecordLocally(record);
  } else if (typeof insertRecord === 'function') {
      await insertRecord({
          tipo: 'capacitacion', 
          datos: { curso: curso, estado: 'Completado', responsable: STATE.responsable || STATE.user.email },
          estado: 'conforme'
      });
  }
  
  $('helpModal').classList.remove('show');
  toast(`Capacitación firmada: ${curso}`, 'success');
  if(typeof triggerSync === 'function') triggerSync();
}

// ══════════════════════════════
// STATUS BTNS & HELPERS
// ══════════════════════════════
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

function initRechazoToggle(){
  $('trazaRechSi')?.addEventListener('click',()=>{$('trazaRechSi').classList.add('active');$('trazaRechNo').classList.remove('active');$('trazaRechazoFields').style.display='block';});
  $('trazaRechNo')?.addEventListener('click',()=>{$('trazaRechNo').classList.add('active');$('trazaRechSi').classList.remove('active');$('trazaRechazoFields').style.display='none';});
}
