// ═══ LOCAL STORAGE ═══
function getRecords(){ try{return JSON.parse(localStorage.getItem('haccp_records')||'[]')}catch{return[]} }
function saveRecords(r){ localStorage.setItem('haccp_records',JSON.stringify(r)) }

function getSyncQueue(){ try{return JSON.parse(localStorage.getItem('haccp_sync_queue')||'[]')}catch{return[]} }
function saveSyncQueue(q){ localStorage.setItem('haccp_sync_queue',JSON.stringify(q)) }

function discardFromSyncQueue(id){
  const q = getSyncQueue().filter(r => r.id !== id);
  saveSyncQueue(q);
  if(typeof showSyncModal === 'function') showSyncModal();
  if(typeof refreshDashboard === 'function') refreshDashboard();
  updateSyncBadge();
}

function addRecord(r){ 
  const rec={...r, id:r.id||crypto.randomUUID(), created_at:r.created_at||new Date().toISOString()}; 
  
  if (STATE.isDemo) {
    rec.synced = true;
    const recs=getRecords(); 
    recs.unshift(rec); 
    saveRecords(recs); 
    STATE.records=recs;
  } else {
    rec.synced = false;
    rec.sync_error = null;
    rec.restaurant_id = STATE.restaurant_id;
    rec.user_id = STATE.user.id;
    const q = getSyncQueue();
    q.push(rec);
    saveSyncQueue(q);
  }
  
  syncPendingRecords(); 
  return rec; 
}

function updateSyncBadge(){
  const pending = getSyncQueue();
  const badge=$('syncBadge');
  if(!badge) return;
  if(pending.length===0){
    badge.style.display='none';
  } else {
    badge.style.display='inline-block';
    badge.textContent=`⚠️ ${pending.length} pdtes`;
  }
}

async function syncPendingRecords(){
  if(STATE.isDemo) return;
  const pending = getSyncQueue();
  updateSyncBadge();
  if(pending.length===0) return;
  
  if(!navigator.onLine) {
    toast('No hay conexión a internet','warning');
    return;
  }
  
  const badge=$('syncBadge');
  if(badge) badge.textContent='🔄 Sincronizando...';
  let syncedCount=0;
  
  for(let i=0; i<pending.length; i++){
    const r=pending[i];
    const row={
      id:r.id, 
      restaurant_id:r.restaurant_id, 
      tipo:r.tipo, 
      datos:r.datos, 
      estado:r.estado, 
      observaciones:r.observaciones||null, 
      accion_correctiva:r.accion_correctiva||null, 
      registrado_por:r.user_id, 
      created_at:r.created_at
    };
    try{
      const{error}=await sb.from('control_records').insert([row]);
      if(!error || error.code === '23505'){ 
        // Success or already exists
        r.synced=true; 
        syncedCount++; 
        STATE.records.unshift(r); // Add to remote records
      } else {
        r.sync_error = error.message;
      }
    }catch(e){ 
      r.sync_error = e.message; 
    }
  }
  
  // Filter out synced records
  const remaining = pending.filter(r => r.synced !== true);
  saveSyncQueue(remaining);
  updateSyncBadge();
  
  if(syncedCount>0){
    saveRecords(STATE.records);
    toast(`✅ ${syncedCount} registros sincronizados a la nube`,'success');
    if(typeof refreshDashboard === 'function') refreshDashboard();
  } else if (remaining.length > 0) {
    toast(`Hubo errores al sincronizar. Revisa la cola.`,'error');
  }
  
  if($('syncQueueModal') && $('syncQueueModal').classList.contains('show')) {
    if(typeof renderSyncQueue === 'function') renderSyncQueue();
  }
}

const ConfigManager = {
  async fetchLatestConfig() {
    if(STATE.isDemo) return STATE.config;
    try {
      const {data, error} = await sb.from('restaurants').select('config').eq('id', STATE.restaurant_id).single();
      if(error) throw error;
      return data?.config || {};
    } catch(e) {
      console.error("Error fetching latest config:", e);
      return null;
    }
  },
  
  validateData(data) {
    if (data === null || data === undefined) return false;
    if (typeof data !== 'object') return false;
    return true; 
  },

  async saveSection(sectionKey, data) {
    if(STATE.isDemo) {
      if(typeof populateDropdowns === 'function') populateDropdowns();
      return true;
    }
    
    if (!this.validateData(data)) {
      toast('Error de validación: Datos corruptos', 'error');
      return false;
    }
    
    const latestConfig = await this.fetchLatestConfig();
    if (!latestConfig) {
      toast('Error al leer configuración de la nube', 'error');
      return false;
    }
    
    const updatedConfig = { ...latestConfig };
    updatedConfig[sectionKey] = data;
    
    const currentVersion = updatedConfig._metadata?.config_version || 0;
    updatedConfig._metadata = {
      config_version: currentVersion + 1,
      updated_at: new Date().toISOString()
    };
    
    try {
      const {error} = await sb.from('restaurants').update({config: updatedConfig}).eq('id', STATE.restaurant_id);
      if (error) throw error;
      if(typeof populateDropdowns === 'function') populateDropdowns();
      return true;
    } catch(e) {
      toast('Error al guardar: ' + e.message, 'error');
      return false;
    }
  }
};
