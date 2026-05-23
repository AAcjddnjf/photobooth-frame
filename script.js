const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const screens = ['screenStart','screenSetup','screenShoot','screenResult'];
const state = {
  width:1080,height:1920,slotsCount:4,mode:'camera',activeSlot:0,
  frame:null,stream:null,isAuto:false,
  slots:[],photos:[],photoAdjust:[]
};
const defaultSlots = [
  {x:.08,y:.08,w:.84,h:.185},{x:.08,y:.295,w:.84,h:.185},{x:.08,y:.51,w:.84,h:.185},{x:.08,y:.725,w:.84,h:.185}
];
function initSlots(){
  state.slots = defaultSlots.map(s=>({...s}));
  state.photos=Array(state.slotsCount).fill(null);
  state.photoAdjust=Array.from({length:state.slotsCount},()=>({scale:1,dx:0,dy:0}));
  renderSlotTabs();syncSlotControls();drawLayout();
}
function show(id){
  screens.forEach(s=>$('#'+s).classList.toggle('active',s===id));
  if(id!=='screenShoot') stopCamera();
}
function fitCanvas(canvas){
  const ratio=state.width/state.height;
  let h=960,w=Math.round(h*ratio);
  if(w>540){w=540;h=Math.round(w/ratio)}
  canvas.width=w;canvas.height=h;
}
function drawCover(ctx,img,x,y,w,h,adj={scale:1,dx:0,dy:0}){
  const iw=img.videoWidth||img.naturalWidth||img.width, ih=img.videoHeight||img.naturalHeight||img.height;
  if(!iw||!ih)return;
  const scale=Math.max(w/iw,h/ih)*adj.scale;
  const dw=iw*scale, dh=ih*scale;
  const dx=x+(w-dw)/2+adj.dx*w, dy=y+(h-dh)/2+adj.dy*h;
  ctx.drawImage(img,dx,dy,dw,dh);
}
function drawComposite(canvas, opts={preview:false}){
  fitCanvas(canvas);
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  state.slots.forEach((slot,i)=>{
    const x=slot.x*canvas.width,y=slot.y*canvas.height,w=slot.w*canvas.width,h=slot.h*canvas.height;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    if(state.photos[i]) drawCover(ctx,state.photos[i],x,y,w,h,state.photoAdjust[i]);
    else{
      ctx.fillStyle='#f1eee9';ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#777';ctx.textAlign='center';ctx.font='20px sans-serif';
      ctx.fillText(`${i+1}컷`,x+w/2,y+h/2);
    }
    ctx.restore();
  });
  if(state.frame) ctx.drawImage(state.frame,0,0,canvas.width,canvas.height);
  if(opts.preview){
    const s=state.slots[state.activeSlot];
    ctx.strokeStyle='#111';ctx.lineWidth=4;ctx.setLineDash([10,8]);
    ctx.strokeRect(s.x*canvas.width,s.y*canvas.height,s.w*canvas.width,s.h*canvas.height);
    ctx.setLineDash([]);
  }
}
function drawLayout(){drawComposite($('#layoutCanvas'),{preview:true});}
function drawShoot(){drawComposite($('#shootCanvas'));positionLiveBox();renderThumbs();}
function positionLiveBox(){
  const box=$('#liveBox'), canvas=$('#shootCanvas');
  if(state.mode!=='camera') { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const slot=state.slots[state.activeSlot];
  const r=canvas.getBoundingClientRect();
  const parent=$('.booth').getBoundingClientRect();
  box.style.left=(r.left-parent.left+slot.x*r.width)+'px';
  box.style.top=(r.top-parent.top+slot.y*r.height)+'px';
  box.style.width=(slot.w*r.width)+'px';
  box.style.height=(slot.h*r.height)+'px';
}
function renderSlotTabs(){
  const wrap=$('#slotTabs');wrap.innerHTML='';
  for(let i=0;i<state.slotsCount;i++){
    const b=document.createElement('button');b.textContent=`${i+1}컷`;b.className=i===state.activeSlot?'active':'';
    b.onclick=()=>{state.activeSlot=i;renderSlotTabs();syncSlotControls();drawLayout();drawShoot();};
    wrap.appendChild(b);
  }
}
function syncSlotControls(){
  const s=state.slots[state.activeSlot];
  $('#slotX').value=Math.round(s.x*100);$('#slotY').value=Math.round(s.y*100);
  $('#slotW').value=Math.round(s.w*100);$('#slotH').value=Math.round(s.h*100);
}
function updateSlot(){
  const s=state.slots[state.activeSlot];
  s.x=$('#slotX').value/100;s.y=$('#slotY').value/100;s.w=$('#slotW').value/100;s.h=$('#slotH').value/100;
  drawLayout();drawShoot();
}
function renderThumbs(){
  const t=$('#thumbs');t.innerHTML='';
  for(let i=0;i<state.slotsCount;i++){
    const b=document.createElement('button');b.textContent=state.photos[i]?`${i+1}컷 ✓`:`${i+1}컷`;b.className=i===state.activeSlot?'active':'';
    b.onclick=()=>{state.activeSlot=i;$('#shotNow').textContent=i+1;renderSlotTabs();syncSlotControls();drawShoot();};
    t.appendChild(b);
  }
}
function loadImage(file){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=rej;img.src=URL.createObjectURL(file);});}
async function startCamera(){
  if(state.mode!=='camera')return;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    alert('이 브라우저에서는 카메라를 쓸 수 없어. Safari에서 github.io 주소로 열어.');return;
  }
  try{
    stopCamera();
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
    state.stream=stream;
    const video=$('#video');
    video.srcObject=stream;
    await video.play();
    drawShoot();
  }catch(e){
    alert('카메라가 안 켜져. github.io 주소에서 열고, Safari 사이트 설정의 카메라 권한을 허용해.');
  }
}
function stopCamera(){
  if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null;}
  const video=$('#video');
  if(video) video.srcObject=null;
}
function captureCurrent(){
  return new Promise((resolve,reject)=>{
    const v=$('#video');
    if(!v.videoWidth || !v.videoHeight){reject(new Error('camera-not-ready'));return;}
    const c=document.createElement('canvas');
    c.width=v.videoWidth;c.height=v.videoHeight;
    const ctx=c.getContext('2d');
    ctx.translate(c.width,0);ctx.scale(-1,1);
    ctx.drawImage(v,0,0,c.width,c.height);
    const img=new Image();
    img.onload=()=>{state.photos[state.activeSlot]=img;resolve(img);};
    img.onerror=reject;
    img.src=c.toDataURL('image/png');
  });
}
function advanceAfterShot(){
  if(state.activeSlot<state.slotsCount-1){
    state.activeSlot++;
    $('#shotNow').textContent=state.activeSlot+1;
    renderSlotTabs();syncSlotControls();drawShoot();
  }else finish();
}
function finish(){
  stopCamera();
  drawComposite($('#resultCanvas'));
  show('screenResult');
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function countdown(){
  const cd=$('#countdown');cd.classList.remove('hidden');
  for(const n of [3,2,1]){cd.textContent=n;await sleep(850)}
  cd.textContent='';cd.classList.add('hidden');
}
async function autoShoot(){
  if(state.mode!=='camera')return;
  state.isAuto=true;
  while(state.isAuto && state.activeSlot<state.slotsCount){
    $('#shotNow').textContent=state.activeSlot+1;
    drawShoot();
    await countdown();
    try{await captureCurrent();}catch(e){alert('카메라 화면이 아직 준비되지 않았어. 잠깐 뒤에 다시 눌러.');state.isAuto=false;break;}
    if(state.activeSlot>=state.slotsCount-1){finish();break;}
    state.activeSlot++;
    $('#shotNow').textContent=state.activeSlot+1;
    renderSlotTabs();syncSlotControls();drawShoot();
    await sleep(500);
  }
  state.isAuto=false;
}
function setMode(mode){
  state.mode=mode;
  $$('.mode').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
  $('#cameraButtons').classList.toggle('hidden',mode!=='camera');
  $('#uploadButtons').classList.toggle('hidden',mode!=='upload');
  if(mode==='camera') $('#liveBox').classList.remove('hidden'); else {$('#liveBox').classList.add('hidden');stopCamera();}
  drawShoot();
}
$('#startBtn').onclick=()=>show('screenSetup');
$$('.back').forEach(b=>b.onclick=()=>show(b.dataset.back));
$$('#sizeChoices .choice').forEach(b=>b.onclick=()=>{
  $$('#sizeChoices .choice').forEach(x=>x.classList.remove('selected'));
  b.classList.add('selected');
  $('#customBox').classList.toggle('hidden',b.dataset.size!=='custom');
  if(b.dataset.size==='custom'){state.width=Number($('#customW').value);state.height=Number($('#customH').value)}
  else{const [w,h]=b.dataset.size.split('x').map(Number);state.width=w;state.height=h}
  drawLayout();drawShoot();
});
$('#customW').oninput=$('#customH').oninput=()=>{state.width=Number($('#customW').value);state.height=Number($('#customH').value);drawLayout();drawShoot();};
$('#frameInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;state.frame=await loadImage(f);$('#frameLabel').textContent=f.name;drawLayout();};
['slotX','slotY','slotW','slotH'].forEach(id=>$('#'+id).oninput=updateSlot);
$$('.mode').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('#goShootBtn').onclick=async()=>{
  if(!state.frame&&!confirm('프레임 없이 진행할까?'))return;
  show('screenShoot');
  $('#shotTotal').textContent=state.slotsCount;$('#shotNow').textContent=state.activeSlot+1;
  drawShoot();
  if(state.mode==='camera') await startCamera();
};
$('#singleShootBtn').onclick=async()=>{await countdown();try{await captureCurrent();advanceAfterShot();}catch(e){alert('카메라 화면이 아직 준비되지 않았어. 잠깐 뒤에 다시 눌러.');}};
$('#autoShootBtn').onclick=autoShoot;
$('#photoInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;state.photos[state.activeSlot]=await loadImage(f);advanceAfterShot();e.target.value='';};
$('#multiPhotoInput').onchange=async e=>{const files=[...e.target.files].slice(0,state.slotsCount);for(let i=0;i<files.length;i++)state.photos[i]=await loadImage(files[i]);finish();};
$('#downloadBtn').onclick=()=>{
  const out=document.createElement('canvas');out.width=state.width;out.height=state.height;
  const ctx=out.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);
  state.slots.forEach((slot,i)=>{
    const x=slot.x*out.width,y=slot.y*out.height,w=slot.w*out.width,h=slot.h*out.height;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    if(state.photos[i])drawCover(ctx,state.photos[i],x,y,w,h,state.photoAdjust[i]);
    ctx.restore();
  });
  if(state.frame)ctx.drawImage(state.frame,0,0,out.width,out.height);
  const a=document.createElement('a');a.download=`photo-booth-${Date.now()}.png`;a.href=out.toDataURL('image/png');a.click();
};
$('#retryBtn').onclick=()=>{state.photos=Array(state.slotsCount).fill(null);state.activeSlot=0;show('screenShoot');drawShoot();if(state.mode==='camera')startCamera();};
$('#resetBtn').onclick=()=>location.reload();
window.addEventListener('resize',()=>{drawLayout();drawShoot();});
initSlots();setMode('camera');
