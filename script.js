(() => {
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const screens=['#homeScreen','#sizeScreen','#characterScreen','#boothBgScreen','#photoScreen','#finalBgScreen','#resultScreen'];
const presets={strip:{name:'세로 스트립',w:600,h:1800,layout:'strip'},strip_hd:{name:'세로 스트립 HD',w:1200,h:3600,layout:'strip'},card:{name:'카드형 네컷',w:1200,h:1800,layout:'grid'},mobile:{name:'모바일형 네컷',w:1080,h:1920,layout:'grid'}};
const state={presetKey:null,w:600,h:1800,current:0,stream:null,shooting:false,boothBgColor:'#f7f7f7',finalBgColor:'#ffffff',finalBgImage:null,slots:[]};
const video=document.createElement('video'); video.autoplay=true; video.muted=true; video.playsInline=true; video.setAttribute('playsinline','');

function bind(id,fn){const el=$(id);if(!el)return;el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn(e)},{passive:false})}
function show(id){screens.forEach(s=>$(s).classList.add('hidden'));$(id).classList.remove('hidden');window.scrollTo({top:0,behavior:'instant'})}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function loadImage(file){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=rej;img.src=URL.createObjectURL(file)})}

function setupPreset(key){
 const p=presets[key],old=state.slots;state.presetKey=key;state.w=p.w;state.h=p.h;
 if(p.layout==='strip'){const mx=Math.round(state.w*.08),top=Math.round(state.h*.09),bottom=Math.round(state.h*.1),gap=Math.round(state.h*.022);const sw=state.w-mx*2,sh=Math.round((state.h-top-bottom-gap*3)/4);state.slots=Array.from({length:4},(_,i)=>({x:mx,y:top+i*(sh+gap),w:sw,h:sh,photo:old[i]?.photo||null,char:old[i]?.char||null}))}
 else{const mx=Math.round(state.w*.075),top=Math.round(state.h*.12),gx=Math.round(state.w*.035),gy=Math.round(state.h*.035);const usable=state.w-mx*2,sw=Math.round((usable-gx)/2),sh=Math.round((state.h-top-Math.round(state.h*.16)-gy)/2);state.slots=Array.from({length:4},(_,i)=>({x:mx+(i%2)*(sw+gx),y:top+Math.floor(i/2)*(sh+gy),w:sw,h:sh,photo:old[i]?.photo||null,char:old[i]?.char||null}))}
 $('#outputSizeText').textContent=`${state.w} × ${state.h}`;$('#slotSizeText').textContent=`${state.slots[0].w} × ${state.slots[0].h}`;$('#promptText').value=buildPrompt(state.slots[0].w,state.slots[0].h);['#characterPreview','#boothBgPreview','#photoPreview','#finalBgPreview'].forEach(id=>{if($(id))$(id).style.aspectRatio=`${state.w} / ${state.h}`});$('#specPanel').classList.remove('hidden');
}
function buildPrompt(w,h){return `Create a ${w}x${h}px photobooth character overlay PNG for one photo slot. Canvas size exactly ${w}x${h}px. Put a relaxed handsome anime-style character or props inside the slot, but leave the area where a real person should appear fully transparent. Transparent PNG background, no white box, no text, no border, no extra margin. This PNG will stay fixed above the live camera layer.`}
function pct(slot){return{left:slot.x/state.w*100,top:slot.y/state.h*100,width:slot.w/state.w*100,height:slot.h/state.h*100}}
function place(el,slot){const p=pct(slot);el.style.left=p.left+'%';el.style.top=p.top+'%';el.style.width=p.width+'%';el.style.height=p.height+'%'}

function addBase(stage){
 const bg=document.createElement('div');bg.className='finalBgLayer';bg.style.background=state.finalBgColor;
 if(state.finalBgImage){const img=new Image();img.src=state.finalBgImage.src;img.style.width='100%';img.style.height='100%';img.style.objectFit='cover';bg.appendChild(img)}
 stage.appendChild(bg);
 const paper=document.createElement('div');paper.className='paperLayer';stage.appendChild(paper);
}
function makeSlot(slot,i,{live=false}={}){
 const wrap=document.createElement('div');wrap.className=(live&&i===state.current&&state.stream)?'liveSlot':'stillSlot';place(wrap,slot);
 const bg=document.createElement('div');bg.className='slotBg';bg.style.background=state.boothBgColor;wrap.appendChild(bg);
 if(live&&i===state.current&&state.stream){video.className='slotVideo';wrap.appendChild(video)}
 else if(slot.photo){const img=new Image();img.className='slotPhoto';img.src=slot.photo.src;wrap.appendChild(img)}
 else{const empty=document.createElement('div');empty.className='emptyText';empty.textContent=`${i+1}컷`;wrap.appendChild(empty)}
 if(slot.char){const ch=new Image();ch.className='slotChar';ch.src=slot.char.src;wrap.appendChild(ch)}
 return wrap;
}
function renderStage(stage,{live=false,guide=false}={}){
 stage.innerHTML='';stage.style.aspectRatio=`${state.w} / ${state.h}`;addBase(stage);
 const layer=document.createElement('div');layer.className='slotLayer';state.slots.forEach((slot,i)=>layer.appendChild(makeSlot(slot,i,{live})));stage.appendChild(layer);
 if(guide){const gl=document.createElement('div');gl.className='guideLayer';state.slots.forEach((slot,i)=>{const g=document.createElement('div');g.className='guideBox';g.textContent=`${i+1}컷`;place(g,slot);gl.appendChild(g)});stage.appendChild(gl)}
 const brand=document.createElement('div');brand.className='brandText';brand.textContent=presets[state.presetKey]?.name||'SKETCH BOOTH';stage.appendChild(brand);
}
function renderCharacter(){renderStage($('#characterPreview'),{guide:true})}
function renderBoothBg(){renderStage($('#boothBgPreview'))}
function renderPhoto(){renderStage($('#photoPreview'),{live:true});$('#currentShotText').textContent=`${state.current+1}컷`;$('#shotGuideText').textContent=`${state.current+1}컷. 화면 그대로, 캐릭터는 고정이고 너만 움직여.`;renderThumbs();$('#toFinalBgBtn').classList.toggle('hidden',!state.slots.every(s=>s.photo))}
function renderFinalBg(){renderStage($('#finalBgPreview'))}
function renderThumbs(){const wrap=$('#thumbs');wrap.innerHTML='';state.slots.forEach((slot,i)=>{const b=document.createElement('button');b.type='button';b.className='thumb'+(i===state.current?' active':'');b.innerHTML=slot.photo?`<img src="${slot.photo.src}" alt="${i+1}컷">`:`${i+1}컷`;b.addEventListener('click',e=>{e.preventDefault();state.current=i;renderPhoto()});wrap.appendChild(b)})}

async function startCamera(){try{if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){alert('Safari에서 github.io 주소로 열어야 카메라를 쓸 수 있어.');return}if(state.stream)state.stream.getTracks().forEach(t=>t.stop());state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});video.srcObject=state.stream;await video.play();renderPhoto()}catch(e){alert('카메라가 안 켜졌어. Safari 사이트 설정에서 카메라를 허용해.')}}
async function countdown(){const c=$('#countdown');c.classList.remove('hidden');for(const n of[3,2,1]){c.textContent=n;await wait(800)}c.textContent='촬영';await wait(250);c.classList.add('hidden')}
function captureCurrent(){
 if(!state.stream||video.readyState<2){alert('카메라를 먼저 켜 줘.');return false}
 const slot=state.slots[state.current],cnv=document.createElement('canvas');cnv.width=slot.w;cnv.height=slot.h;const ctx=cnv.getContext('2d');
 ctx.fillStyle=state.boothBgColor;ctx.fillRect(0,0,slot.w,slot.h);
 const vw=video.videoWidth,vh=video.videoHeight,tr=slot.w/slot.h,vr=vw/vh;let sx=0,sy=0,sw=vw,sh=vh;
 if(vr>tr){sw=vh*tr;sx=(vw-sw)/2}else{sh=vw/tr;sy=(vh-sh)/2}
 ctx.translate(slot.w,0);ctx.scale(-1,1);ctx.drawImage(video,sx,sy,sw,sh,0,0,slot.w,slot.h);
 const img=new Image();img.src=cnv.toDataURL('image/png');state.slots[state.current].photo=img;return true;
}
async function shootOne(){if(state.shooting)return;state.shooting=true;await countdown();if(captureCurrent()&&state.current<3)state.current++;state.shooting=false;renderPhoto()}
async function autoShoot(){if(state.shooting)return;if(!state.stream){await startCamera();if(!state.stream)return}state.shooting=true;for(let i=state.current;i<4;i++){state.current=i;renderPhoto();await countdown();captureCurrent();await wait(350)}state.current=3;state.shooting=false;renderPhoto()}
function drawCover(ctx,img,x,y,w,h){const cover=Math.max(w/img.width,h/img.height),dw=img.width*cover,dh=img.height*cover;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
function finalImage(){
 const cnv=$('#workCanvas');cnv.width=state.w;cnv.height=state.h;const ctx=cnv.getContext('2d');
 ctx.fillStyle=state.finalBgColor;ctx.fillRect(0,0,state.w,state.h);if(state.finalBgImage)drawCover(ctx,state.finalBgImage,0,0,state.w,state.h);
 state.slots.forEach(slot=>{ctx.fillStyle=state.boothBgColor;ctx.fillRect(slot.x,slot.y,slot.w,slot.h)});
 state.slots.forEach(slot=>{ctx.save();ctx.beginPath();ctx.rect(slot.x,slot.y,slot.w,slot.h);ctx.clip();if(slot.photo)drawCover(ctx,slot.photo,slot.x,slot.y,slot.w,slot.h);ctx.restore()});
 state.slots.forEach(slot=>{if(slot.char)ctx.drawImage(slot.char,slot.x,slot.y,slot.w,slot.h)});
 ctx.fillStyle=state.finalBgColor==='#191919'?'#fff':'#121017';ctx.textAlign='center';ctx.font=`900 ${Math.round(state.w*.04)}px Apple SD Gothic Neo, Noto Sans KR, sans-serif`;ctx.fillText(presets[state.presetKey]?.name||'SKETCH BOOTH',state.w/2,Math.round(state.h*.05));
 return cnv.toDataURL('image/png');
}
function playPrint(){const img=$('#printImg');img.classList.remove('printing');void img.offsetWidth;img.classList.add('printing')}

document.addEventListener('DOMContentLoaded',()=>{
 bind('#startBtn',()=>show('#sizeScreen'));bind('#backHomeBtn',()=>show('#homeScreen'));bind('#backSizeBtn',()=>show('#sizeScreen'));bind('#backCharacterBtn',()=>show('#characterScreen'));bind('#backBoothBgBtn',()=>show('#boothBgScreen'));bind('#backPhotoBtn',()=>show('#photoScreen'));
 $$('.sizeCard').forEach(btn=>btn.addEventListener('click',()=>{$$('.sizeCard').forEach(c=>c.classList.remove('selected'));btn.classList.add('selected');setupPreset(btn.dataset.preset);$('#toCharacterBtn').disabled=false}));
 bind('#toCharacterBtn',()=>{renderCharacter();show('#characterScreen')});bind('#toBoothBgBtn',()=>{renderBoothBg();show('#boothBgScreen')});bind('#toPhotoBtn',()=>{state.current=0;renderPhoto();show('#photoScreen')});bind('#toFinalBgBtn',()=>{renderFinalBg();show('#finalBgScreen')});bind('#toResultBtn',()=>{$('#printImg').src=finalImage();show('#resultScreen');setTimeout(playPrint,80)});bind('#retryBtn',()=>show('#finalBgScreen'));bind('#resetBtn',()=>window.location.reload());bind('#replayPrintBtn',playPrint);bind('#downloadBtn',()=>{const a=document.createElement('a');a.download='sketch-booth.png';a.href=$('#printImg').src;a.click()});bind('#clearFinalImageBtn',()=>{state.finalBgImage=null;$('#finalBgImageInput').value='';renderFinalBg()});
 bind('#copyPromptBtn',async()=>{try{await navigator.clipboard.writeText($('#promptText').value);alert('프롬프트 복사 완료')}catch(e){$('#promptText').select();document.execCommand('copy');alert('프롬프트 복사 완료')}});
 bind('#cameraModeBtn',()=>{$('#cameraControls').classList.remove('hidden');$('#uploadControls').classList.add('hidden')});bind('#uploadModeBtn',()=>{$('#uploadControls').classList.remove('hidden');$('#cameraControls').classList.add('hidden')});bind('#startCameraBtn',startCamera);bind('#autoShootBtn',autoShoot);bind('#captureBtn',shootOne);
 $$('.charInput').forEach(input=>input.addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const i=Number(e.target.dataset.i);state.slots[i].char=await loadImage(f);renderCharacter()}));
 $$('.photoInput').forEach(input=>input.addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const i=Number(e.target.dataset.i);state.slots[i].photo=await loadImage(f);state.current=Math.min(i+1,3);renderPhoto()}));
 $('#boothColorGrid').addEventListener('click',e=>{const btn=e.target.closest('.colorChip');if(!btn)return;$$('#boothColorGrid .colorChip').forEach(c=>c.classList.remove('active'));btn.classList.add('active');state.boothBgColor=btn.dataset.color;renderBoothBg()});
 $('#finalColorGrid').addEventListener('click',e=>{const btn=e.target.closest('.colorChip');if(!btn)return;$$('#finalColorGrid .colorChip').forEach(c=>c.classList.remove('active'));btn.classList.add('active');state.finalBgColor=btn.dataset.color;renderFinalBg()});
 $('#finalBgImageInput').addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;state.finalBgImage=await loadImage(f);renderFinalBg()});
});
window.addEventListener('pagehide',()=>{if(state.stream)state.stream.getTracks().forEach(t=>t.stop())});
})();