// ══════════════════════════════
// RENDER & DASHBOARD
// ══════════════════════════════
function badgeClass(e){return e==='conforme'?'badge-green':e==='no_conforme'?'badge-red':'badge-yellow'}
function statusLabel(e){return e==='conforme'?'✅':e==='no_conforme'?'❌':'⚠️'}
function timeAgo(iso){const d=(Date.now()-new Date(iso).getTime())/1000;if(d<60)return'Ahora';if(d<3600)return`${Math.floor(d/60)} min`;if(d<86400)return`${Math.floor(d/3600)}h`;return new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}
function tipoIcon(t){return{pcc:'🌡️',limpieza:'🧹',trazabilidad:'📦',checklist:'✅',etiqueta:'🏷️'}[t]||'📋'}

function recordHTML(r, isPending=false){
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
  const syncBadge=isPending?`<span style="font-size:10px;color:var(--warning);font-weight:700"> • ☁️⏳ Pendiente</span>`:'';
  
  return `<div class="record-item"><div class="record-badge ${badgeClass(r.estado)}"></div><div class="record-info"><div class="record-title">${tipoIcon(r.tipo)} ${title}</div><div class="record-meta">${timeAgo(r.created_at)} · ${statusLabel(r.estado)} ${r.estado}${resp?' · 👤'+resp:''}${acBadge}${syncBadge}</div></div><div class="record-value">${value}</div></div>`;
}

function refreshDashboard(){
  const pending = getSyncQueue();
  const recs=[...pending, ...STATE.records];
  const today=new Date().toISOString().slice(0,10);
  const hoy=recs.filter(r=>(r.created_at||'').slice(0,10)===today);
  const nc=hoy.filter(r=>r.estado!=='conforme');
  const acCount=recs.filter(r=>r.datos?.accion_correctiva && !r.datos.accion_correctiva.accion_resuelta).length;
  
  const kpiHoy=$('kpiHoy'); if(kpiHoy) kpiHoy.textContent=hoy.length;
  const kpiAlertas=$('kpiAlertas'); if(kpiAlertas) kpiAlertas.textContent=nc.length;
  const kpiConf=$('kpiConf'); if(kpiConf) kpiConf.textContent=(hoy.length?Math.round((hoy.length-nc.length)/hoy.length*100):100)+'%';
  const kpiAC=$('kpiAC'); if(kpiAC) kpiAC.textContent=acCount;
  
  const recent=$('recentList');
  if(recent) recent.innerHTML=recs.slice(0,10).map(r => recordHTML(r, r.synced===false)).join('')||'<p class="empty-state">Sin registros</p>';
  
  const badge=$('connBadge');
  if(badge) badge.innerHTML=STATE.isDemo?'<span style="color:var(--warning)">📱 Local</span>':'<span style="color:var(--accent)">☁️ Nube</span>';
}

function refreshPCCList(){
  const pending=getSyncQueue(); 
  const l=[...pending, ...STATE.records].filter(r=>r.tipo==='pcc').slice(0,10);
  const pccL=$('pccList');
  if(pccL) pccL.innerHTML=l.length?l.map(r => recordHTML(r, r.synced===false)).join(''):'<p class="empty-state">Sin registros PCC</p>';
}

function refreshLimpList(){
  const pending=getSyncQueue(); 
  const l=[...pending, ...STATE.records].filter(r=>r.tipo==='limpieza').slice(0,10);
  const limpL=$('limpList');
  if(limpL) limpL.innerHTML=l.length?l.map(r => recordHTML(r, r.synced===false)).join(''):'<p class="empty-state">Sin registros</p>';
}

function refreshTrazaList(){
  const pending=getSyncQueue(); 
  const l=[...pending, ...STATE.records].filter(r=>r.tipo==='trazabilidad').slice(0,10);
  const trazaL=$('trazaList');
  if(trazaL) trazaL.innerHTML=l.length?l.map(r => recordHTML(r, r.synced===false)).join(''):'<p class="empty-state">Sin registros</p>';
}

// ══════════════════════════════
// PDF & REPORTS
// ══════════════════════════════
function getFilteredRecords(){
  let r=STATE.records; 
  const t=$('repTipo')?.value, d=$('repDesde')?.value, h=$('repHasta')?.value;
  if(t) r=r.filter(x=>x.tipo===t);
  if(d) r=r.filter(x=>(x.created_at||'').slice(0,10)>=d);
  if(h) r=r.filter(x=>(x.created_at||'').slice(0,10)<=h);
  return r;
}

function handlePreview(){
  const recs=getFilteredRecords();
  if(!recs.length){toast('No hay registros','error');return}
  let h='<table class="report-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Resp.</th></tr></thead><tbody>';
  recs.forEach(r=>{
    const d=r.datos||{};let det='';
    if(r.tipo==='pcc')det=`${d.equipo}: ${d.valor||d.temperatura||''}${d.unidad||'°C'}`;
    else if(r.tipo==='limpieza')det=`${d.area} — ${d.producto_limpieza||''}`;
    else if(r.tipo==='trazabilidad'){det=`${d.lote} — ${d.producto}`;if(d.rechazado)det+=' [RECHAZADO → '+d.destino_rechazo+']';}
    h+=`<tr><td>${new Date(r.created_at).toLocaleDateString('es-CO')}</td><td>${r.tipo.toUpperCase()}</td><td>${det}</td><td>${statusLabel(r.estado)}</td><td>${d.responsable||''}</td></tr>`;
  }); 
  h+='</tbody></table>'; 
  const repT=$('reportTable'); if(repT) repT.innerHTML=h; 
  const repP=$('reportPreview'); if(repP) repP.style.display='block';
}

function handleGenPDF(){
  const recs=getFilteredRecords();
  if(!recs.length){toast('No hay registros','error');return}
  const{jsPDF}=window.jspdf, doc=new jsPDF();
  
  doc.setFillColor(26,58,92);doc.rect(0,0,210,36,'F');
  doc.setTextColor(255);doc.setFontSize(18);doc.setFont('helvetica','bold');doc.text('GD FORGE — HACCP-Lite',14,16);
  doc.setFontSize(9);doc.setFont('helvetica','normal');
  doc.text('Reporte de Control de Inocuidad Alimentaria',14,23);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')} | Giovanni Duarte MVZ`,14,29);
  
  let y=42;
  const tipo=$('repTipo')?.value;
  doc.setTextColor(40);doc.setFontSize(10);
  if(tipo) doc.text(`Tipo: ${tipo.toUpperCase()}`,14,y);
  
  const desde=$('repDesde')?.value, hasta=$('repHasta')?.value;
  if(desde||hasta) doc.text(`Período: ${desde||'...'} — ${hasta||'...'}`,tipo?80:14,y); 
  y+=8;
  
  const conf=recs.filter(r=>r.estado==='conforme').length, nc=recs.filter(r=>r.estado==='no_conforme').length;
  doc.setFontSize(9);
  doc.text(`Total: ${recs.length} | Conformes: ${conf} | No conformes: ${nc} | Conformidad: ${recs.length?Math.round(conf/recs.length*100):100}%`,14,y);
  
  const rows=recs.map(r=>{
    const d=r.datos||{};let det='';
    if(r.tipo==='pcc')det=`${d.equipo}: ${d.valor||d.temperatura||''}${d.unidad||'°C'} (${d.lim_inf}–${d.lim_sup})`;
    else if(r.tipo==='limpieza')det=`${d.area} | ${d.producto_limpieza||'-'} / ${d.producto_desinfeccion||'-'}`;
    else if(r.tipo==='trazabilidad'){det=`Lote: ${d.lote} | ${d.producto}`;if(d.rechazado)det+=' [RECHAZADO]';}
    return [new Date(r.created_at).toLocaleDateString('es-CO'),r.tipo.toUpperCase(),det,r.estado,d.responsable||'',r.observaciones||''];
  });
  
  doc.autoTable({
    startY:y+4,
    head:[['Fecha','Tipo','Detalle','Estado','Resp.','Obs.']],
    body:rows,
    styles:{fontSize:7,cellPadding:2},
    headStyles:{fillColor:[45,138,78],textColor:255,fontStyle:'bold'},
    alternateRowStyles:{fillColor:[245,245,245]},
    didParseCell:function(d){
      if(d.column.index===3&&d.section==='body'){
        if(d.cell.raw==='no_conforme')d.cell.styles.textColor=[239,68,68];
        else if(d.cell.raw==='conforme')d.cell.styles.textColor=[45,138,78];
      }
    }
  });
  
  const pc=doc.internal.getNumberOfPages();
  for(let i=1;i<=pc;i++){
    doc.setPage(i);doc.setFillColor(26,58,92);const ph=doc.internal.pageSize.height;
    doc.rect(0,ph-12,210,12,'F');doc.setTextColor(255);doc.setFontSize(7);
    doc.text(`GD FORGE — Giovanni Duarte MVZ | Consultor en Calidad e Inocuidad | Pág ${i}/${pc}`,105,ph-5,{align:'center'});
  }
  
  doc.save(`HACCP_GDForge_${new Date().toISOString().slice(0,10)}.pdf`);
  toast('✅ PDF descargado');
}

// ══════════════════════════════
// LABELS
// ══════════════════════════════
function generateLabel(){
  const prod=$('etProd').value.trim(),prep=$('etPrep').value,vence=$('etVence').value,resp=$('etResp').value.trim()||STATE.responsable;
  if(!prod){toast('Escribe el producto','error');return;}
  const preview=$('labelPreview');
  if(!preview) return;
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
  doc.save(`Etiqueta_${prod.replace(/\s/g,'_')}.pdf`);
  toast('✅ Etiqueta descargada');
}
