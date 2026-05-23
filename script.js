(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const screens = ['#homeScreen','#sizeScreen','#characterScreen','#photoScreen','#backgroundScreen','#resultScreen'];

  const presets = {
    strip: { name:'클래식 세로 네컷', w:600, h:1800, layout:'strip' },
    strip_hd: { name:'고화질 세로 네컷', w:1200, h:3600, layout:'strip' },
    card: { name:'카드형 네컷', w:1200, h:1800, layout:'grid' },
    mobile: { name:'모바일형 네컷', w:1080, h:1920, layout:'grid' }
  };

  const state = { presetKey:null, w:600, h:1800, current:0, stream:null, shooting:false, bgColor:'#ffffff', bgImage:null, slots:[] };
  const video = document.createElement('video');
  video.autoplay = true; video.muted = true; video.playsInline = true; video.setAttribute('playsinline','');

  function bind(id, fn){ const el=$(id); if(!el) return; el.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); fn(e); }, {passive:false}); }
  function show(id){ screens.forEach(s=>$(s).classList.add('hidden')); $(id).classList.remove('hidden'); window.scrollTo({top:0,behavior:'instant'}); }
  function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
  function loadImage(file){ return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=URL.createObjectURL(file); }); }

  function setupPreset(key){
    const p = presets[key], old = state.slots;
    state.presetKey=key; state.w=p.w; state.h=p.h;

    if(p.layout === 'strip'){
      const marginX=Math.round(state.w*.08), top=Math.round(state.h*.09), bottom=Math.round(state.h*.1), gap=Math.round(state.h*.022);
      const slotW=state.w-marginX*2, slotH=Math.round((state.h-top-bottom-gap*3)/4);
      state.slots=Array.from({length:4},(_,i)=>({x:marginX,y:top+i*(slotH+gap),w:slotW,h:slotH,photo:old[i]?.photo||null,char:old[i]?.char||null}));
    } else {
      const marginX=Math.round(state.w*.075), top=Math.round(state.h*.12), gapX=Math.round(state.w*.035), gapY=Math.round(state.h*.035);
      const usableW=state.w-marginX*2, slotW=Math.round((usableW-gapX)/2), slotH=Math.round((state.h-top-Math.round(state.h*.16)-gapY)/2);
      state.slots=Array.from({length:4},(_,i)=>({x:marginX+(i%2)*(slotW+gapX),y:top+Math.floor(i/2)*(slotH+gapY),w:slotW,h:slotH,photo:old[i]?.photo||null,char:old[i]?.char||null}));
    }

    $('#outputSizeText').textContent = `${state.w} × ${state.h}`;
    $('#slotSizeText').textContent = `${state.slots[0].w} × ${state.slots[0].h}`;
    $('#promptBox').value = buildPrompt(state.slots[0].w, state.slots[0].h);
    ['#characterPreview','#photoPreview','#backgroundPreview'].forEach(id=>{ if($(id)) $(id).style.aspectRatio = `${state.w} / ${state.h}`; });
    $('#selectedSpec').classList.remove('hidden');
  }

  function buildPrompt(w,h){
    return `Create a ${w}x${h}px photobooth character overlay PNG for one single photo slot. Canvas size must be exactly ${w}x${h}px. Put a handsome relaxed anime-style character or props inside the cell, but leave the area where a real person should appear fully transparent. Transparent PNG background, no white box, no text, no border, no extra margin. Cute idol photobooth pose, fixed character layer for compositing over a real camera photo.`;
  }

  function pct(slot){ return {left:slot.x/state.w*100,top:slot.y/state.h*100,width:slot.w/state.w*100,height:slot.h/state.h*100}; }
  function place(el,slot){ const p=pct(slot); el.style.left=p.left+'%'; el.style.top=p.top+'%'; el.style.width=p.width+'%'; el.style.height=p.height+'%'; }

  function addBg(stage){
    const bg=document.createElement('div'); bg.className='bgLayer'; bg.style.background=state.bgColor;
    if(state.bgImage){ const img=new Image(); img.src=state.bgImage.src; img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover'; bg.appendChild(img); }
    stage.appendChild(bg);
  }

  function renderStage(stage,{live=false,guide=false}={}){
    stage.innerHTML=''; stage.style.aspectRatio=`${state.w} / ${state.h}`; addBg(stage);
    const photoLayer=document.createElement('div'); photoLayer.className='photoLayer';
    state.slots.forEach((slot,i)=>{
      const div=document.createElement('div'); div.className='slot'; place(div,slot);
      if(live && i===state.current && state.stream) div.appendChild(video);
      else if(slot.photo){ const img=new Image(); img.src=slot.photo.src; div.appendChild(img); }
      photoLayer.appendChild(div);
    });
    stage.appendChild(photoLayer);
    const charLayer=document.createElement('div'); charLayer.className='charLayer';
    state.slots.forEach(slot=>{ if(!slot.char) return; const img=new Image(); img.className='charImg'; img.src=slot.char.src; place(img,slot); charLayer.appendChild(img); });
    stage.appendChild(charLayer);
    if(guide){
      const guideLayer=document.createElement('div'); guideLayer.className='guideLayer';
      state.slots.forEach((slot,i)=>{ const g=document.createElement('div'); g.className='guideBox'; g.textContent=`${i+1}컷`; place(g,slot); guideLayer.appendChild(g); });
      stage.appendChild(guideLayer);
    }
    const brand=document.createElement('div'); brand.className='brand'; brand.textContent=presets[state.presetKey]?.name || 'SKETCH BOOTH'; stage.appendChild(brand);
  }

  function renderCharacterScreen(){ renderStage($('#characterPreview'), {guide:true}); }
  function renderPhotoScreen(){ renderStage($('#photoPreview'), {live:true}); $('#currentShotText').textContent=`${state.current+1}컷`; renderThumbs(); $('#toBackgroundBtn').classList.toggle('hidden', !state.slots.every(s=>s.photo)); }
  function renderBackgroundScreen(){ renderStage($('#backgroundPreview')); }

  function renderThumbs(){
    const wrap=$('#thumbs'); wrap.innerHTML='';
    state.slots.forEach((slot,i)=>{
      const b=document.createElement('button'); b.type='button'; b.className='thumb'+(i===state.current?' active':'');
      b.innerHTML = slot.photo ? `<img src="${slot.photo.src}" alt="${i+1}컷">` : `${i+1}컷`;
      b.addEventListener('click', e=>{ e.preventDefault(); state.current=i; renderPhotoScreen(); });
      wrap.appendChild(b);
    });
  }

  async function startCamera(){
    try{
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ alert('Safari에서 github.io 주소로 열어야 카메라를 쓸 수 있어.'); return; }
      if(state.stream) state.stream.getTracks().forEach(t=>t.stop());
      state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}, audio:false});
      video.srcObject=state.stream; await video.play(); renderPhotoScreen();
    }catch(err){ alert('카메라가 안 켜졌어. Safari 사이트 설정에서 카메라를 허용해.'); }
  }

  async function countdown(){ const c=$('#countdown'); c.classList.remove('hidden'); for(const n of [3,2,1]){ c.textContent=n; await wait(800); } c.textContent='촬영'; await wait(250); c.classList.add('hidden'); }

  function captureCurrent(){
    if(!state.stream || video.readyState < 2){ alert('카메라를 먼저 켜 줘.'); return false; }
    const slot=state.slots[state.current], cnv=document.createElement('canvas'); cnv.width=slot.w; cnv.height=slot.h;
    const ctx=cnv.getContext('2d'), vw=video.videoWidth, vh=video.videoHeight, tr=slot.w/slot.h, vr=vw/vh;
    let sx=0,sy=0,sw=vw,sh=vh;
    if(vr>tr){ sw=vh*tr; sx=(vw-sw)/2; } else { sh=vw/tr; sy=(vh-sh)/2; }
    ctx.translate(slot.w,0); ctx.scale(-1,1); ctx.drawImage(video,sx,sy,sw,sh,0,0,slot.w,slot.h);
    const img=new Image(); img.src=cnv.toDataURL('image/png'); state.slots[state.current].photo=img; return true;
  }

  async function shootOne(){ if(state.shooting) return; state.shooting=true; await countdown(); if(captureCurrent() && state.current<3) state.current++; state.shooting=false; renderPhotoScreen(); }
  async function autoShoot(){ if(state.shooting) return; if(!state.stream){ await startCamera(); if(!state.stream) return; } state.shooting=true; for(let i=state.current;i<4;i++){ state.current=i; renderPhotoScreen(); await countdown(); captureCurrent(); await wait(350); } state.current=3; state.shooting=false; renderPhotoScreen(); }

  function drawCover(ctx,img,x,y,w,h){ const cover=Math.max(w/img.width,h/img.height), dw=img.width*cover, dh=img.height*cover; ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh); }

  function finalImage(){
    const cnv=$('#workCanvas'); cnv.width=state.w; cnv.height=state.h; const ctx=cnv.getContext('2d');
    ctx.fillStyle=state.bgColor; ctx.fillRect(0,0,state.w,state.h); if(state.bgImage) drawCover(ctx,state.bgImage,0,0,state.w,state.h);
    state.slots.forEach(slot=>{ ctx.save(); ctx.beginPath(); ctx.rect(slot.x,slot.y,slot.w,slot.h); ctx.clip(); if(slot.photo) drawCover(ctx,slot.photo,slot.x,slot.y,slot.w,slot.h); ctx.restore(); });
    state.slots.forEach(slot=>{ if(slot.char) ctx.drawImage(slot.char,slot.x,slot.y,slot.w,slot.h); });
    ctx.fillStyle = state.bgColor === '#1a1a1a' ? '#fff' : '#111016'; ctx.textAlign='center'; ctx.font=`900 ${Math.round(state.w*.04)}px Apple SD Gothic Neo, Noto Sans KR, sans-serif`;
    ctx.fillText(presets[state.presetKey]?.name || 'SKETCH BOOTH', state.w/2, Math.round(state.h*.05));
    return cnv.toDataURL('image/png');
  }

  function playPrint(){ const img=$('#printImg'); img.classList.remove('printing'); void img.offsetWidth; img.classList.add('printing'); }

  document.addEventListener('DOMContentLoaded', ()=>{
    bind('#startBtn', ()=>show('#sizeScreen'));
    bind('#jumpGuideBtn', ()=>document.querySelector('#howTo').scrollIntoView({behavior:'smooth'}));
    bind('#sizeBackBtn', ()=>show('#homeScreen'));
    bind('#backToSizeBtn', ()=>show('#sizeScreen'));
    bind('#backToCharacterBtn', ()=>show('#characterScreen'));
    bind('#backToPhotoBtn', ()=>show('#photoScreen'));

    $$('.sizeCard').forEach(btn=>btn.addEventListener('click', ()=>{
      $$('.sizeCard').forEach(c=>c.classList.remove('selected'));
      btn.classList.add('selected'); setupPreset(btn.dataset.preset); $('#toCharacterBtn').disabled=false;
    }));

    bind('#toCharacterBtn', ()=>{ renderCharacterScreen(); show('#characterScreen'); });
    bind('#toPhotoBtn', ()=>{ state.current=0; renderPhotoScreen(); show('#photoScreen'); });
    bind('#toBackgroundBtn', ()=>{ renderBackgroundScreen(); show('#backgroundScreen'); });
    bind('#toResultBtn', ()=>{ $('#printImg').src=finalImage(); show('#resultScreen'); setTimeout(playPrint,80); });
    bind('#retryBtn', ()=>show('#backgroundScreen'));
    bind('#resetBtn', ()=>window.location.reload());
    bind('#replayPrintBtn', playPrint);
    bind('#downloadBtn', ()=>{ const a=document.createElement('a'); a.download='sketch-booth.png'; a.href=$('#printImg').src; a.click(); });

    bind('#copyPromptBtn', async ()=>{ try{ await navigator.clipboard.writeText($('#promptBox').value); alert('프롬프트 복사 완료'); }catch(e){ $('#promptBox').select(); document.execCommand('copy'); alert('프롬프트 복사 완료'); } });
    bind('#cameraModeBtn', ()=>{ $('#cameraControls').classList.remove('hidden'); $('#uploadControls').classList.add('hidden'); });
    bind('#uploadModeBtn', ()=>{ $('#uploadControls').classList.remove('hidden'); $('#cameraControls').classList.add('hidden'); });
    bind('#startCameraBtn', startCamera); bind('#autoShootBtn', autoShoot); bind('#captureBtn', shootOne);

    $$('.charInput').forEach(input=>input.addEventListener('change', async e=>{ const f=e.target.files && e.target.files[0]; if(!f) return; const i=Number(e.target.dataset.i); state.slots[i].char=await loadImage(f); renderCharacterScreen(); }));
    $$('.photoInput').forEach(input=>input.addEventListener('change', async e=>{ const f=e.target.files && e.target.files[0]; if(!f) return; const i=Number(e.target.dataset.i); state.slots[i].photo=await loadImage(f); state.current=Math.min(i+1,3); renderPhotoScreen(); }));

    $('#colorChips').addEventListener('click', e=>{ const btn=e.target.closest('.colorChip'); if(!btn) return; $$('.colorChip').forEach(c=>c.classList.remove('active')); btn.classList.add('active'); state.bgColor=btn.dataset.color; renderBackgroundScreen(); });
    $('#bgImageInput').addEventListener('change', async e=>{ const f=e.target.files && e.target.files[0]; if(!f) return; state.bgImage=await loadImage(f); renderBackgroundScreen(); });
  });

  window.addEventListener('pagehide', ()=>{ if(state.stream) state.stream.getTracks().forEach(t=>t.stop()); });
})();