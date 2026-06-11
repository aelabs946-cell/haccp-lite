// ══════════════════════════════
// INITIALIZATION
// ══════════════════════════════
document.addEventListener('DOMContentLoaded',()=>{
  $('loginForm')?.addEventListener('submit',handleLogin);
  $('registerForm')?.addEventListener('submit',handleRegister);
  $('forgotForm')?.addEventListener('submit',handleForgotPassword);
  $('btnDemo')?.addEventListener('click',enterDemo);
  $('btnLogout')?.addEventListener('click',handleLogout);
  
  $('showRegister')?.addEventListener('click',e=>{e.preventDefault();showRegisterForm()});
  $('showLogin')?.addEventListener('click',e=>{e.preventDefault();showLoginForm()});
  $('showForgot')?.addEventListener('click',e=>{e.preventDefault();showForgotForm()});
  
  $('btnSetResp')?.addEventListener('click',setResponsable);
  $('globalResponsable')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setResponsable()}});
  
  $('btnBack')?.addEventListener('click',()=>switchTab('tabDashboard'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  
  $('formPCC')?.addEventListener('submit',handlePCC);
  $('formLimpieza')?.addEventListener('submit',handleLimpieza);
  $('formTraza')?.addEventListener('submit',handleTraza);
  
  $('btnGenPDF')?.addEventListener('click',handleGenPDF);
  $('btnPreview')?.addEventListener('click',handlePreview);
  
  if(typeof initStatusButtons === 'function') initStatusButtons(); 
  if(typeof initRechazoToggle === 'function') initRechazoToggle();
  
  const today=new Date().toISOString().slice(0,10);
  if($('repDesde')) $('repDesde').value=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  if($('repHasta')) $('repHasta').value=today; 
  if($('trazaIngreso')) $('trazaIngreso').value=today;
  
  $('pccEquipo')?.addEventListener('change',onPCCChange);
  $('pccTemp')?.addEventListener('input',checkPCCRange);
  
  // Admin buttons
  $('btnSaveCompany')?.addEventListener('click',saveCompanyInfo);
  $('btnAddEquip')?.addEventListener('click',addEquipment);
  $('btnAddArea')?.addEventListener('click',addArea);
  $('btnAddChemClean')?.addEventListener('click',addChemClean);
  $('btnAddChemDesinf')?.addEventListener('click',addChemDesinf);
  $('btnAddCapacitacion')?.addEventListener('click',addCapacitacion);
  $('eqTipoMed')?.addEventListener('change',onEqTipoChange);
  
  // Photo listeners
  $('pccFoto')?.addEventListener('change',()=>onPhotoSelect('pcc','pccFoto','pccFotoPreview'));
  $('limpFoto')?.addEventListener('change',()=>onPhotoSelect('limp','limpFoto','limpFotoPreview'));
  $('trazaFoto')?.addEventListener('change',()=>onPhotoSelect('traza','trazaFoto','trazaFotoPreview'));
  
  // Custom Logo Listener
  $('cfgLogoInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      STATE.customLogo = event.target.result;
      if($('cfgLogoPreview')) $('cfgLogoPreview').src = STATE.customLogo;
    };
    reader.readAsDataURL(file);
  });
  
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
  
  if(typeof initVoice === 'function') initVoice();
  if(typeof checkSession === 'function') checkSession();
  
  window.addEventListener('online', () => {
    if(typeof syncPendingRecords === 'function') syncPendingRecords();
  });
});

if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Show the update banner
          const banner = document.getElementById('updateBanner');
          const btn = document.getElementById('btnReloadUpdate');
          if (banner && btn) {
            banner.style.display = 'flex';
            btn.onclick = () => {
              banner.style.display = 'none';
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            };
          }
        }
      });
    });
  }).catch(() => {});
}
