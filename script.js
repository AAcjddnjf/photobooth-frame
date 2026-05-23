(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const screens = ['#guideScreen','#buildScreen','#shootScreen','#resultScreen'];

  const state = {
    w: 600, h: 1800, current: 0, stream: null, shooting: false, bw: false,
    bgColor: '#ffffff', bgImage: null, caption: '',
    slots: []
  };

  const presets = {
    '600x1800': { w:600, h:1800 },
    '1200x3600': { w:1200, h:3600 },
    '1200x1800': { w:1200, h:1800 },
    '1080x1920': { w:1080, h:1920 }
  };

  const video = document.createElement('video');
  video.autoplay = true; video.muted = true; video.playsInline = true; video.setAttribute('playsinline','');

  function bind(id, fn){ const el=$(id); if(!el) return; el.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); fn(e); }, {passive:false}); }
  function show(id){ screens.forEach(s=>$(s).classList.add('hidden')); $(id).classList.remove('hidden'); window.scrollTo({top:0,behavior:'instant'}); }
  function loadImage(file){ return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=URL.createObjectURL(file); }); }
  function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

  function setupSlots(){
    const marginX = Math.round(state.w * 0.08);
    const top = Math.round(state.h * 0.09);
    const gapY = Math.round(state.h * 0.028);
    const usableW = state.w - marginX * 2;
    const cellH = Math.round((state.h - top - Math.round(state.h * 0.14) - gapY * 3) / 4);
    state.slots = Array.from({length:4}, (_,i)=>(
      { x: marginX, y: top + i*(cellH+gapY), w: usableW, h: cellH, photo:null, char:null }
    ));
    $('#slotSizeText').textContent = `${usableW} × ${cellH}`;
    $$('.charInput').forEach((input,i)=>{
      input.parentElement.childNodes[0].textContent = `${i+1}컷 캐릭터 PNG `;
    });
  }

  function viewRatio(){ return `${state.w} / ${state.h}`; }
  function pct(slot){ return {left:slot.x/state.w*100, top:slot.y/state.h*100, width:slot.w/state.w*100, height:slot.h/state.h*100}; }
  function place(el, slot){ const p=pct(slot); el.style.left=p.left+'%'; el.style.top=p.top+'%'; el.style.width=p.width+'%'; el.style.height=p.height+'%'; }

  function addBg(stage){
    const bg=document.createElement('div'); bg.className='bgLayer'; bg.style.background=state.bgColor;
    if(state.bgImage){ const img=new Image(); img.src=state.bgImage.src; img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover'; if(state.bw) img.style.filter='grayscale(1)'; bg.appendChild(img); }
    if(state.bw && !state.bgImage) bg.style.filter='grayscale(1)';
    stage.appendChild(bg);
  }

  function renderStage(stage, live=false, guide=true){
    stage.innerHTML=''; stage.style.aspectRatio=viewRatio(); addBg(stage);
    const photoLayer=document.createElement('div'); photoLayer.className='photoLayer'; if(state.bw) photoLayer.style.filter='grayscale(1)';
    state.slots.forEach((slot,i)=>{
      const div=document.createElement('div'); div.className='slot'; place(div,slot);
      if(live && i===state.current && state.stream) div.appendChild(video);
      else if(slot.photo){ const img=new Image(); img.src=slot.photo.src; div.appendChild(img); }
      photoLayer.appendChild(div);
    });
    stage.appendChild(photoLayer);

    const charLayer=document.createElement('div'); charLayer.className='charLayer';
    state.slots.forEach(slot=>{ if(!slot.char) return; const img=new Image(); img.className='charImg'; img.src=slot.char.src; place(img,slot); charLayer.appendChild(img); });
    if(state.bw) charLayer.style.filter='grayscale(1)';
    stage.appendChild(charLayer);

    if(guide){
      const guideLayer=document.createElement('div'); guideLayer.className='guideLayer';
      state.slots.forEach((slot,i)=>{ const g=document.createElement('div'); g.className='guideBox'; g.textContent=`${i+1}컷`; place(g,slot); guideLayer.appendChild(g); });
      stage.appendChild(guideLayer);
    }

    const brand=document.createElement('div'); brand.className='brand'; brand.textContent='MY FOUR CUTS'; stage.appendChild(brand);
    if(state.caption){ const cap=document.createElement('div'); cap.className='caption'; cap.textContent=state.caption; stage.appendChild(cap); }
  }

  function renderThumbs(){
    const wrap=$('#thumbs'); if(!wrap) return; wrap.innerHTML='';
    state.slots.forEach((slot,i)=>{ const b=document.createElement('button'); b.type='button'; b.className='thumb'+(i===state.current?' active':''); b.innerHTML=slot.photo?`<img src="${slot.photo.src}" alt="${i+1}컷">`:`${i+1}컷`; b.addEventListener('click',e=>{e.preventDefault(); state.current=i; renderAll();}); wrap.appendChild(b); });
  }

  function renderAll(){
    if($('#framePreview')) renderStage($('#framePreview'), false, true);
    if($('#livePreview')) { renderStage($('#livePreview'), true, false); $('#shotNow').textContent = `${state.current+1}컷`; $('#finishBtn').classList.toggle('hidden', !state.slots.every(s=>s.photo)); renderThumbs(); }
  }

  async function startCamera(){
    try{
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ alert('Safari에서 github.io 주소로 열어야 카메라를 쓸 수 있어.'); return; }
      if(state.stream) state.stream.getTracks().forEach(t=>t.stop());
      state.stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}, audio:false});
      video.srcObject = state.stream; await video.play(); renderAll();
    }catch(e){ alert('카메라가 안 켜졌어. Safari 사이트 설정에서 카메라를 허용해.'); }
  }

  async function countdown(){ const c=$('#countdown'); c.classList.remove('hidden'); for(const n of [3,2,1]){ c.textContent=n; await wait(800);} c.textContent='촬영'; await wait(250); c.classList.add('hidden'); }

  function captureCurrent(){
    if(!state.stream || video.readyState < 2){ alert('카메라를 먼저 켜 줘.'); return false; }
    const slot=state.slots[state.current]; const cnv=document.createElement('canvas'); cnv.width=slot.w; cnv.height=slot.h; const ctx=cnv.getContext('2d');
    const vw=video.videoWidth, vh=video.videoHeight, tr=slot.w/slot.h, vr=vw/vh; let sx=0, sy=0, sw=vw, sh=vh;
    if(vr>tr){ sw=vh*tr; sx=(vw-sw)/2; } else { sh=vw/tr; sy=(vh-sh)/2; }
    if(state.bw) ctx.filter='grayscale(1)';
    ctx.translate(slot.w,0); ctx.scale(-1,1); ctx.drawImage(video,sx,sy,sw,sh,0,0,slot.w,slot.h);
    const img=new Image(); img.src=cnv.toDataURL('image/png'); state.slots[state.current].photo=img; return true;
  }

  async function shootOne(){ if(state.shooting) return; state.shooting=true; await countdown(); if(captureCurrent() && state.current<3) state.current++; state.shooting=false; renderAll(); }
  async function autoShoot(){ if(state.shooting) return; if(!state.stream){ await startCamera(); if(!state.stream) return; } state.shooting=true; for(let i=state.current;i<4;i++){ state.current=i; renderAll(); await countdown(); captureCurrent(); await wait(350); } state.current=3; state.shooting=false; renderAll(); }

  function drawCover(ctx,img,x,y,w,h){ const cover=Math.max(w/img.width,h/img.height); const dw=img.width*cover, dh=img.height*cover; ctx.drawImage(img, x+(w-dw)/2, y+(h-dh)/2, dw, dh); }

  function finalImage(){
    const cnv=$('#workCanvas'); cnv.width=state.w; cnv.height=state.h; const ctx=cnv.getContext('2d');
    if(state.bw) ctx.filter='grayscale(1)';
    ctx.fillStyle=state.bgColor; ctx.fillRect(0,0,state.w,state.h); if(state.bgImage) drawCover(ctx,state.bgImage,0,0,state.w,state.h);
    state.slots.forEach(slot=>{ ctx.save(); ctx.beginPath(); ctx.rect(slot.x,slot.y,slot.w,slot.h); ctx.clip(); if(slot.photo) drawCover(ctx,slot.photo,slot.x,slot.y,slot.w,slot.h); ctx.restore(); });
    state.slots.forEach(slot=>{ if(slot.char) ctx.drawImage(slot.char,slot.x,slot.y,slot.w,slot.h); });
    ctx.fillStyle = state.bgColor === '#111111' ? '#ffffff' : '#17141d';
    ctx.textAlign='center'; ctx.font=`900 ${Math.round(state.w*0.04)}px Apple SD Gothic Neo, Noto Sans KR, sans-serif`; ctx.fillText('MY FOUR CUTS', state.w/2, Math.round(state.h*0.052));
    if(state.caption){ ctx.font=`900 ${Math.round(state.w*0.034)}px Apple SD Gothic Neo, Noto Sans KR, sans-serif`; ctx.fillText(state.caption, state.w/2, state.h-Math.round(state.h*0.03)); }
    return cnv.toDataURL('image/png');
  }

  function playPrintAnimation(){
    const img = $('#printStrip');
    img.classList.remove('printing');
    void img.offsetWidth;
    img.classList.add('printing');
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setupSlots(); renderAll();
    bind('#startBtn', ()=>{ renderAll(); show('#buildScreen'); });
    bind('#backGuideBtn', ()=>show('#guideScreen'));
    bind('#backBuildBtn', ()=>show('#buildScreen'));

    $('#sizePreset').addEventListener('change', e=>{ const p=presets[e.target.value]; state.w=p.w; state.h=p.h; setupSlots(); renderAll(); });
    $('#captionText').addEventListener('input', e=>{ state.caption=e.target.value; renderAll(); });
    $('#bwToggle').addEventListener('change', e=>{ state.bw=e.target.checked; renderAll(); });
    $('#bgImage').addEventListener('change', async e=>{ const f=e.target.files && e.target.files[0]; if(!f) return; state.bgImage = await loadImage(f); renderAll(); });
    $('#colorChips').addEventListener('click', e=>{ const btn=e.target.closest('.colorChip'); if(!btn) return; $$('.colorChip').forEach(c=>c.classList.remove('active')); btn.classList.add('active'); state.bgColor=btn.dataset.color; renderAll(); });

    $$('.charInput').forEach(input=>{ input.addEventListener('change', async e=>{ const f=e.target.files && e.target.files[0]; if(!f) return; const i=Number(e.target.dataset.i); state.slots[i].char = await loadImage(f); renderAll(); }); });
    $$('.photoInput').forEach(input=>{ input.addEventListener('change', async e=>{ const f=e.target.files && e.target.files[0]; if(!f) return; const i=Number(e.target.dataset.i); state.slots[i].photo = await loadImage(f); state.current=Math.min(i+1,3); renderAll(); }); });

    bind('#toShootBtn', ()=>{ state.current=0; renderAll(); show('#shootScreen'); });
    bind('#cameraModeBtn', ()=>{ $('#cameraControls').classList.remove('hidden'); $('#uploadControls').classList.add('hidden'); });
    bind('#uploadModeBtn', ()=>{ $('#uploadControls').classList.remove('hidden'); $('#cameraControls').classList.add('hidden'); });
    bind('#startCameraBtn', startCamera); bind('#autoShootBtn', autoShoot); bind('#captureBtn', shootOne);
    bind('#finishBtn', ()=>{ $('#printStrip').src = finalImage(); show('#resultScreen'); setTimeout(playPrintAnimation, 80); });
    bind('#playPrintBtn', playPrintAnimation);
    bind('#downloadBtn', ()=>{ const a=document.createElement('a'); a.download='real-fourcut.png'; a.href=$('#printStrip').src; a.click(); });
    bind('#retryBtn', ()=>{ state.current=0; renderAll(); show('#shootScreen'); });
    bind('#resetBtn', ()=>window.location.reload());
  });

  window.addEventListener('pagehide', ()=>{ if(state.stream) state.stream.getTracks().forEach(t=>t.stop()); });
})();
