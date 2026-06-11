// ══════════════════════════════
// AUTH
// ══════════════════════════════
function enterDemo(){
  STATE.isDemo=true; 
  STATE.user={email:'demo@gdforge.app',id:'demo'}; 
  STATE.restaurant_id='demo'; 
  STATE.records=getRecords(); 
  STATE.role='admin';
  $('loginScreen').style.display='none'; 
  $('appMain').style.display='flex';
  $('headerUser').textContent='Modo Demo'; 
  $('headerMode').textContent='DEMO'; 
  $('headerMode').style.display='inline-block';
  
  const saved=localStorage.getItem('haccp_responsable');
  if(saved){
    STATE.responsable=saved; 
    if(typeof fillResponsable === 'function') fillResponsable(saved); 
    $('responsableBar').style.display='none';
  } else {
    $('responsableBar').style.display='block';
  }
  
  if(typeof loadConfig === 'function'){
    loadConfig().then(()=>{ 
      if(typeof refreshDashboard === 'function') refreshDashboard(); 
      applyRole(); 
    });
  }
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
  $('loginScreen').style.display='none'; 
  
  try{
    const{data, error}=await sb.from('users').select('restaurant_id,nombre,rol,estado_usuario').eq('id',user.id).single();
    if(error) throw error;
    
    if(!data || data.estado_usuario !== 'activo' || !data.restaurant_id){
      $('appMain').style.display='none';
      const pendingScreen = $('pendingScreen');
      if (pendingScreen) {
        pendingScreen.style.display='flex';
        const st = data ? data.estado_usuario : 'pendiente';
        if (st === 'bloqueado') {
          $('pendingTitle').textContent = 'Acceso Bloqueado';
          $('pendingMessage').textContent = 'Tu cuenta ha sido suspendida. Contacta a un administrador.';
        } else {
          $('pendingTitle').textContent = 'Acceso Pendiente';
          $('pendingMessage').textContent = 'Tu cuenta fue creada pero aún no ha sido vinculada por un administrador de tu empresa.';
        }
      }
      return; 
    }
    
    // User is active and has a restaurant
    $('appMain').style.display='flex';
    $('headerUser').textContent='Control de Procesos e Inocuidad'; 
    $('headerMode').textContent='☁️ Cloud'; 
    $('headerMode').style.background='rgba(6, 182, 212, 0.2)'; 
    $('headerMode').style.color='var(--accent-light)';
    $('headerMode').style.display='inline-block';
    
    STATE.restaurant_id=data.restaurant_id; 
    STATE.role=data.rol||'empleado';
    if(data.nombre){
      STATE.responsable=data.nombre; 
      if(typeof fillResponsable === 'function') fillResponsable(data.nombre); 
      $('responsableBar').style.display='none';
    } else {
      $('responsableBar').style.display='block';
    }
    
  }catch(e){
    toast('Error fatal: '+e.message, 'error'); 
    $('responsableBar').style.display='block';
    $('appMain').style.display='flex';
  }
  
  if(typeof loadConfig === 'function') await loadConfig(); 
  if(typeof loadRecords === 'function') await loadRecords(); 
  if(typeof refreshDashboard === 'function') refreshDashboard(); 
  applyRole();
}

function applyRole(){
  const role = (STATE.role || '').trim().toLowerCase();
  const isAdmin = role === 'admin';
  const btnAdmin = $('btnAdminModule'); 
  if(btnAdmin) btnAdmin.style.display = isAdmin ? 'flex' : 'none';
}

async function handleLogout(){
  if(!STATE.isDemo&&sb) await sb.auth.signOut();
  STATE.user=null; STATE.isDemo=false; STATE.role='empleado'; STATE.records=[];
  $('appMain').style.display='none'; $('loginScreen').style.display='flex';
  $('headerMode').style.display='none'; showLoginForm();
}

async function checkSession(){
  if(!HAS_SUPABASE)return;
  try{ 
    const{data:{session}}=await sb.auth.getSession(); 
    if(session) await enterApp(session.user); 
  }catch(e){}
}

// ═══ LOGIN NAV ═══
function showLoginForm(){$('loginForm').style.display='block';$('registerForm').style.display='none';$('forgotForm').style.display='none';$('loginToggle').style.display='block';$('showLoginLink').style.display='none';}
function showRegisterForm(){$('loginForm').style.display='none';$('registerForm').style.display='block';$('forgotForm').style.display='none';$('loginToggle').style.display='none';$('showLoginLink').style.display='block';}
function showForgotForm(){$('loginForm').style.display='none';$('registerForm').style.display='none';$('forgotForm').style.display='block';$('loginToggle').style.display='none';$('showLoginLink').style.display='block';}
