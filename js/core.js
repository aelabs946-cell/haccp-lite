/* ===== HACCP-Lite v3.3 — GD FORGE ===== */

const SUPABASE_URL = 'https://shqfwclzkpgdtgveqmdk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNocWZ3Y2x6a3BnZHRndmVxbWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDA1ODYsImV4cCI6MjA4NzcxNjU4Nn0.EBi8Qxk8vA_xEYV5UX6LvhP_Hoj7Gsng62hTWs1tyLQ';
const HAS_SUPABASE = !SUPABASE_URL.includes('TU_');

const STATE = { 
  user:null, 
  restaurant_id:null, 
  records:[], 
  currentTab:'tabDashboard', 
  currentStatus:{}, 
  responsable:'', 
  isDemo:false, 
  role:'empleado',
  config:{ equipment:[], areas:[], chemicals_clean:[], chemicals_desinf:[], tipos_limpieza:[], metodos:[], checklist_apertura:[], checklist_cierre:[], capacitaciones:[] },
  photos:{ pcc:null, limp:null, traza:null }, 
  checklistType:'apertura', 
  checklistState:{},
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
  checklist_cierre:['Limpiar y desinfectar todas las superficies de trabajo','Sacar basura y lavar canecas','Cerrar llaves de gas','Apagar equipos de cocción','Verificar que neveras y congeladores estén cerrados','Registrar temperaturas finales de equipos','Barrer y trapear pisos','Verificar puertas y ventanas cerradas'],
  capacitaciones:[]
};

let sb = null;
if (HAS_SUPABASE && window.supabase) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);

// ═══ TOAST ═══
function toast(msg, type='success', parent='appToast'){
  const el=$(parent)||$('toast'); 
  if(!el) return;
  el.textContent=msg; 
  el.className='toast show '+type;
  setTimeout(()=>el.className='toast',3000);
}
