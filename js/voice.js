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
