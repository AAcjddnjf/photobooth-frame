const $ = s => document.querySelector(s);
const screens = ['#startScreen','#setupScreen','#slotScreen','#shootScreen','#resultScreen'];
const state = {
  w:1080,h:1920,frame:null,frameURL:null,current:0,stream:null,auto:false,
  slots:[
    {x:90,y:170,w:420,h:560,scale:1,dx:0,dy:0,img:null},
    {x:570,y:170,w:420,h:560,scale:1,dx:0,dy:0,img:null},
    {x:90,y:820,w:420,h:560,scale:1,dx:0,dy:0,img:null},
    {x:570,y:820,w:420,h:560,scale:1,dx:0,dy:0,img:null}
  ]
};
const video = document.createElement('video');
video.autoplay = true; video.muted = true; video.playsInline = true; video.setAttribute('playsinline','');

function show(id){ screens.forEach(s=>$(s).classList.add('hidden')); $(id).classList.remove('hidden'); }
function setStageRatio(el){ el.style.aspectRatio = `${state.w}/${state.h}`; el.style.width = `min(100%, ${Math.min(430,state.w)}px)`; }
function pct(slot){return {left:slot.x/state.w*100,top:slot.y/state.h*100,width:slot.w/state.w*100,height:slot.h/state.h*100}}
function makeFrame(){ const d=document.createElement('div'); d.className='layer frameLayer'; if(state.frameURL){const img=new Image(); img.src=state.frameURL; d.appendChild(img);} return d; }
function drawPhotoElement(slot,i){ if(!slot.img) return null; const p=pct(slot); const img=document.createElement('img'); img.className='shotImg'; img.src=slot.img.src; img.style.left=p.left+'%'; img.style.top=p.top+'%'; img.style.width=p.width+'%'; img.style.height=p.height+'%'; img.style.objectPosition=`calc(50% + ${slot.dx}px) calc(50% + ${slot.dy}px)`; img.style.transform=`scale(${slot.scale})`; return img; }
function renderSlotPreview(){ const st=$('#slotPreview'); st.innerHTML=''; setStageRatio(st); state.slots.forEach((slot,i)=>{ const b=document.createElement('div'); b.className='slotBox'; const p=pct(slot); Object.assign(b.style,{left:p.left+'%',top:p.top+'%',width:p.width+'%',height:p.height+'%'}); b.textContent=i+1; st.appendChild(b); }); st.appendChild(makeFrame()); }
function renderLiveStage(){ const st=$('#liveStage'); st.innerHTML=''; setStageRatio(st); const photoLayer=document.createElement('div'); photoLayer.className='layer photoLayer'; state.slots.forEach((s,i)=>{ const el=drawPhotoElement(s,i); if(el) photoLayer.appendChild(el); }); st.appendChild(photoLayer); const slot=state.slots[state.current]; const live=document.createElement('div'); live.className='liveSlot'; const p=pct(slot); Object.assign(live.style,{left:p.left+'%',top:p.top+'%',width:p.width+'%',height:p.height+'%'}); if(state.stream){ live.appendChild(video); } else { live.innerHTML='<div style="color:white;height:100%;display:flex;align-items:center;justify-content:center;font-weight:800">카메라 대기</div>'; } st.appendChild(live); st.appendChild(makeFrame()); updateThumbs(); $('#shotLabel').textContent = `${state.current+1}컷`; $('#finishBtn').classList.toggle('hidden', !state.slots.every(s=>s.img)); }
function renderSlotControls(){ const box=$('#slotControls'); box.innerHTML=''; state.slots.forEach((slot,i)=>{ const card=document.createElement('div'); card.className='slotCard'; card.innerHTML=`<h3>${i+1}컷 위치</h3><div class="miniGrid">
<label>X<input type="number" data-i="${i}" data-k="x" value="${slot.x}"></label>
<label>Y<input type="number" data-i="${i}" data-k="y" value="${slot.y}"></label>
<label>가로<input type="number" data-i="${i}" data-k="w" value="${slot.w}"></label>
<label>세로<input type="number" data-i="${i}" data-k="h" value="${slot.h}"></label>
</div>`; box.appendChild(card); }); box.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',e=>{ const i=+e.target.dataset.i,k=e.target.dataset.k; state.slots[i][k]=+e.target.value||0; renderSlotPreview(); })); }
function updateThumbs(){ const t=$('#thumbs'); t.innerHTML=''; state.slots.forEach((s,i)=>{ const d=document.createElement('button'); d.className='thumb'+(i===state.current?' active':''); d.onclick=()=>{state.current=i;renderLiveStage()}; d.innerHTML=s.img?`<img src="${s.img.src}">`:`${i+1}컷`; t.appendChild(d); }); }
async function startCamera(){ try{ if(state.stream) state.stream.getTracks().forEach(t=>t.stop()); state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false}); video.srcObject=state.stream; await video.play(); renderLiveStage(); }catch(e){ alert('카메라가 안 켜졌습니다. Safari 사이트 설정에서 카메라 허용을 켜고 github.io 주소에서 다시 열어 주세요.'); } }
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
async function countdown(){ const c=$('#countdown'); c.classList.remove('hidden'); for(const n of [3,2,1]){c.textContent=n; await wait(800)} c.textContent='촬영'; await wait(300); c.classList.add('hidden'); }
function captureCurrent(){ if(!state.stream || video.readyState < 2){ alert('카메라를 먼저 켜 주세요.'); return false; } const slot=state.slots[state.current]; const cnv=document.createElement('canvas'); cnv.width=slot.w; cnv.height=slot.h; const ctx=cnv.getContext('2d'); const vw=video.videoWidth, vh=video.videoHeight; const targetRatio=slot.w/slot.h, videoRatio=vw/vh; let sx=0,sy=0,sw=vw,sh=vh; if(videoRatio>targetRatio){ sw=vh*targetRatio; sx=(vw-sw)/2; } else { sh=vw/targetRatio; sy=(vh-sh)/2; } ctx.translate(slot.w,0); ctx.scale(-1,1); ctx.drawImage(video,sx,sy,sw,sh,0,0,slot.w,slot.h); const img=new Image(); img.src=cnv.toDataURL('image/png'); state.slots[state.current].img=img; return true; }
async function shootOne(){ await countdown(); if(captureCurrent()){ if(state.current<3) state.current++; renderLiveStage(); } }
async function autoShoot(){ if(!state.stream){ await startCamera(); if(!state.stream) return; } for(let i=state.current;i<4;i++){ state.current=i; renderLiveStage(); await shootOne(); await wait(350); } renderLiveStage(); }
function loadImage(file){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=URL.createObjectURL(file); }); }
async function applyUploads(){ const files=[...$('#photoInput').files]; if(!files.length) return; for(let n=0;n<files.length;n++){ const i=Math.min(state.current+n,3); state.slots[i].img=await loadImage(files[n]); } state.current=Math.min(state.current+files.length,3); renderLiveStage(); }
function renderFinal(){ const cnv=$('#workCanvas'); cnv.width=state.w; cnv.height=state.h; const ctx=cnv.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,state.w,state.h); state.slots.forEach(slot=>{ if(!slot.img) return; ctx.save(); ctx.beginPath(); ctx.rect(slot.x,slot.y,slot.w,slot.h); ctx.clip(); const img=slot.img; const cover=Math.max(slot.w/img.width, slot.h/img.height)*slot.scale; const dw=img.width*cover, dh=img.height*cover; const dx=slot.x+(slot.w-dw)/2+slot.dx; const dy=slot.y+(slot.h-dh)/2+slot.dy; ctx.drawImage(img,dx,dy,dw,dh); ctx.restore(); }); if(state.frame){ ctx.drawImage(state.frame,0,0,state.w,state.h); } return cnv.toDataURL('image/png'); }
function updateCanvasSize(){ const v=$('#sizePreset').value; if(v!=='custom'){ const [w,h]=v.split('x').map(Number); state.w=w; state.h=h; $('#canvasW').value=w; $('#canvasH').value=h; } else { state.w=+$('#canvasW').value||1080; state.h=+$('#canvasH').value||1920; } const colW=Math.round(state.w*.39), colH=Math.round(state.h*.29), gapX=Math.round(state.w*.055), left=Math.round(state.w*.083), top=Math.round(state.h*.09), gapY=Math.round(state.h*.047); state.slots.forEach((s,i)=>Object.assign(s,{x:left+(i%2)*(colW+gapX),y:top+Math.floor(i/2)*(colH+gapY),w:colW,h:colH})); }
$('#startBtn').onclick=()=>show('#setupScreen');
$('#sizePreset').onchange=()=>updateCanvasSize(); $('#canvasW').oninput=()=>{state.w=+$('#canvasW').value||1080}; $('#canvasH').oninput=()=>{state.h=+$('#canvasH').value||1920};
$('#frameInput').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; state.frame=await loadImage(f); state.frameURL=state.frame.src; };
$('#toSlotsBtn').onclick=()=>{ updateCanvasSize(); renderSlotPreview(); renderSlotControls(); show('#slotScreen'); };
$('#toShootBtn').onclick=()=>{ state.current=0; renderLiveStage(); show('#shootScreen'); };
$('#backToSlotsBtn').onclick=()=>show('#slotScreen');
$('#cameraModeBtn').onclick=()=>{$('#cameraControls').classList.remove('hidden');$('#uploadControls').classList.add('hidden')};
$('#uploadModeBtn').onclick=()=>{$('#uploadControls').classList.remove('hidden');$('#cameraControls').classList.add('hidden')};
$('#startCameraBtn').onclick=startCamera; $('#captureOneBtn').onclick=shootOne; $('#autoShootBtn').onclick=autoShoot; $('#applyUploadBtn').onclick=applyUploads;
$('#finishBtn').onclick=()=>{ $('#resultImg').src=renderFinal(); show('#resultScreen'); };
$('#downloadBtn').onclick=()=>{ const a=document.createElement('a'); a.download='photobooth-frame.png'; a.href=$('#resultImg').src; a.click(); };
$('#retryBtn').onclick=()=>{ state.slots.forEach(s=>s.img=null); state.current=0; renderLiveStage(); show('#shootScreen'); };
$('#resetBtn').onclick=()=>location.reload();
window.addEventListener('pagehide',()=>{ if(state.stream) state.stream.getTracks().forEach(t=>t.stop()); });
