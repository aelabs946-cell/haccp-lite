// ══════════════════════════════
// PHOTO EVIDENCE
// ══════════════════════════════
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
  if(prev)prev.innerHTML=''; 
  const inp=$({pcc:'pccFoto',limp:'limpFoto',traza:'trazaFoto'}[key]); 
  if(inp)inp.value='';
}
