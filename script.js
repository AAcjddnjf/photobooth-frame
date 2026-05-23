(() => {
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const screens = ['#homeScreen','#sizeScreen','#characterScreen','#boothBgScreen','#photoScreen','#finalBgScreen','#resultScreen'];

const presets = {
  strip:    {name:'세로 스트립',   w:600,  h:1800, layout:'strip'},
  strip_hd: {name:'세로 스트립 HD',w:1200, h:3600, layout:'strip'},
  card:     {name:'카드형 네컷',   w:1200, h:1800, layout:'grid'},
  mobile:   {name:'모바일형 네컷', w:1080, h:1920, layout:'grid'},
};

const state = {
  presetKey: null, w: 600, h: 1800,
  current: 0, stream: null, shooting: false,
  cameraReady: false,
  boothBgColor: '#f7f7f7',
  outsideFrameColor: '#ffffff',
  outsideFrameImage: null,
  slots: [],
  resultData: '',
};

/* ── persistent video element — never removed from DOM ── */
const video = document.createElement('video');
video.autoplay = true; video.muted = true; video.playsInline = true;
video.setAttribute('playsinline','');
video.style.cssText = `
  position:absolute; top:0; left:0; width:100%; height:100%;
  object-fit:cover; transform:scaleX(-1);
  display:block; z-index:3; pointer-events:none;
`;

/* ── helpers ── */
function bind(id, fn) {
  const el = $(id); if (!el) return;
  el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(e); }, {passive:false});
}
function show(id) {
  screens.forEach(s => { $(s).classList.add('hidden'); $(s).classList.remove('active'); });
  const el = $(id); el.classList.remove('hidden'); el.classList.add('active');
  window.scrollTo({top:0, behavior:'instant'});
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function loadImage(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = e.target.result;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

/* ── preset & slots ── */
function setupPreset(key) {
  const p = presets[key], old = state.slots;
  state.presetKey = key; state.w = p.w; state.h = p.h;
  if (p.layout === 'strip') {
    const mx = Math.round(state.w * .08);
    const top = Math.round(state.h * .09);
    const bottom = Math.round(state.h * .1);
    const gap = Math.round(state.h * .022);
    const sw = state.w - mx * 2;
    const sh = Math.round((state.h - top - bottom - gap * 3) / 4);
    state.slots = Array.from({length:4}, (_, i) => ({
      x: mx, y: top + i*(sh+gap), w: sw, h: sh,
      photo: old[i]?.photo||null, char: old[i]?.char||null
    }));
  } else {
    const mx  = Math.round(state.w * .075);
    const top = Math.round(state.h * .12);
    const gx  = Math.round(state.w * .035);
    const gy  = Math.round(state.h * .035);
    const sw  = Math.round((state.w - mx*2 - gx) / 2);
    const sh  = Math.round((state.h - top - Math.round(state.h*.16) - gy) / 2);
    state.slots = Array.from({length:4}, (_, i) => ({
      x: mx + (i%2)*(sw+gx), y: top + Math.floor(i/2)*(sh+gy), w: sw, h: sh,
      photo: old[i]?.photo||null, char: old[i]?.char||null
    }));
  }
  $('#outputSizeText').textContent = `${state.w} × ${state.h}`;
  $('#slotSizeText').textContent   = `${state.slots[0].w} × ${state.slots[0].h}`;
  $('#promptText').value = buildPrompt(state.slots[0].w, state.slots[0].h);
  ['#characterPreview','#boothBgPreview','#photoPreview','#finalBgPreview'].forEach(id => {
    if ($(id)) $(id).style.aspectRatio = `${state.w} / ${state.h}`;
  });
  $('#specPanel').classList.remove('hidden');
}

function buildPrompt(w, h) {
  return `Create a ${w}x${h}px photobooth character overlay PNG for one photo slot.

Canvas size: exactly ${w}x${h}px.

캐릭터 설정 (아래 항목을 원하는 대로 바꿔서 써):
- 옷차림: [예: 교복 / 캐주얼 후드티 / 드레스 / 한복 / 체크 셔츠]
- 포즈: [예: 손 흔들기 / 브이 포즈 / 기대는 포즈 / 눈 찡긋 / 팔짱]
- 스타일: [예: 애니메이션 일러스트 / 실사 / 수채화풍]
- 머리색/눈색: [예: 검은 머리 / 금발 / 갈색 눈]

Rules (수정하지 말 것):
- Transparent PNG background, no white fill, no solid background
- Center area must be fully transparent — real person appears here
- Character frame/props can appear at edges, corners, or overlapping naturally
- No text, no border, no extra margin
- This PNG will be placed on top of a live camera feed`;
}

function pct(slot) {
  return {
    left:   slot.x / state.w * 100,
    top:    slot.y / state.h * 100,
    width:  slot.w / state.w * 100,
    height: slot.h / state.h * 100,
  };
}
function place(el, slot) {
  const p = pct(slot);
  el.style.left   = p.left   + '%';
  el.style.top    = p.top    + '%';
  el.style.width  = p.width  + '%';
  el.style.height = p.height + '%';
}

/* ═══════════════════════════════════════════
   STAGE RENDERING
   - buildStageBase : 외부 배경 + 슬롯 배경색
   - buildSlotPhoto : 찍힌 사진 레이어
   - buildSlotChar  : 캐릭터 PNG 레이어
   - buildGuide     : 가이드 점선
   - buildBrand     : 하단 브랜드 텍스트
   ═══════════════════════════════════════════ */

function buildStageBase(stage) {
  // 외부 배경
  const bg = document.createElement('div');
  bg.style.cssText = `position:absolute;inset:0;z-index:0;background:${state.outsideFrameColor}`;
  if (state.outsideFrameImage) {
    const img = new Image(); img.src = state.outsideFrameImage.src;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    bg.appendChild(img);
  }
  stage.appendChild(bg);

  // 슬롯 배경색 (각 칸에 boothBgColor)
  state.slots.forEach(slot => {
    const sb = document.createElement('div');
    sb.style.cssText = `position:absolute;z-index:1;background:${state.boothBgColor}`;
    sb.style.left   = (slot.x / state.w * 100) + '%';
    sb.style.top    = (slot.y / state.h * 100) + '%';
    sb.style.width  = (slot.w / state.w * 100) + '%';
    sb.style.height = (slot.h / state.h * 100) + '%';
    stage.appendChild(sb);
  });
}

function buildSlotPhotos(stage) {
  state.slots.forEach(slot => {
    if (!slot.photo) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:absolute;z-index:2;overflow:hidden`;
    place(wrap, slot);
    const img = new Image(); img.src = slot.photo.src;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    wrap.appendChild(img);
    stage.appendChild(wrap);
  });
}

function buildSlotEmpty(stage) {
  state.slots.forEach((slot, i) => {
    if (slot.photo) return;
    const div = document.createElement('div');
    div.style.cssText = `position:absolute;z-index:2;display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,.25);font-size:13px;font-weight:700`;
    place(div, slot);
    div.textContent = `${i+1}컷`;
    stage.appendChild(div);
  });
}

function buildCharacters(stage, zIndex = 5) {
  state.slots.forEach(slot => {
    if (!slot.char) return;
    const img = new Image(); img.src = slot.char.src;
    img.style.cssText = `position:absolute;z-index:${zIndex};object-fit:fill`;
    place(img, slot);
    stage.appendChild(img);
  });
}

function buildGuide(stage) {
  state.slots.forEach((slot, i) => {
    const g = document.createElement('div');
    g.style.cssText = `position:absolute;z-index:8;border:2px dashed rgba(200,242,58,.5);border-radius:6px;display:flex;align-items:center;justify-content:center;color:rgba(200,242,58,.8);font-size:11px;font-weight:900`;
    place(g, slot); g.textContent = `${i+1}컷`;
    stage.appendChild(g);
  });
}

function buildBrand(stage) {
  const lastSlot = state.slots[3];
  const topPct = (lastSlot.y + lastSlot.h) / state.h * 100;
  const brand = document.createElement('div');
  brand.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${100-topPct}%;z-index:7;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:22px;font-weight:800;letter-spacing:.06em`;
  brand.textContent = presets[state.presetKey]?.name || 'SKETCH BOOTH';
  stage.appendChild(brand);
}

/* ── 일반 스테이지 렌더 (캐릭터 미리보기 / 배경색 미리보기 / 프레임 밖 미리보기) ── */
function renderStage(stage, {guide = false} = {}) {
  stage.innerHTML = '';
  stage.style.cssText = `position:relative;aspect-ratio:${state.w}/${state.h};overflow:hidden`;
  buildStageBase(stage);
  buildSlotPhotos(stage);
  buildSlotEmpty(stage);
  buildCharacters(stage);
  if (guide) buildGuide(stage);
  buildBrand(stage);
}

/* ════════════════════════════════════════════
   촬영 화면 — video를 절대 DOM에서 제거하지 않음
   preview 컨테이너 안에 video를 clip하는 방식
   ════════════════════════════════════════════ */
let liveOverlay = null; // 촬영 화면 위에 캐릭터+가이드 레이어

function renderPhotoScreen() {
  const stage = $('#photoPreview');
  stage.innerHTML = '';
  stage.style.cssText = `position:relative;aspect-ratio:${state.w}/${state.h};overflow:hidden`;

  // 1. 외부 배경
  const bg = document.createElement('div');
  bg.style.cssText = `position:absolute;inset:0;z-index:0;background:${state.outsideFrameColor}`;
  stage.appendChild(bg);

  // 2. 슬롯 배경색
  state.slots.forEach(slot => {
    const sb = document.createElement('div');
    sb.style.cssText = `position:absolute;z-index:1;background:${state.boothBgColor}`;
    sb.style.left   = (slot.x / state.w * 100) + '%';
    sb.style.top    = (slot.y / state.h * 100) + '%';
    sb.style.width  = (slot.w / state.w * 100) + '%';
    sb.style.height = (slot.h / state.h * 100) + '%';
    stage.appendChild(sb);
  });

  // 3. 찍힌 사진들 (다른 컷)
  state.slots.forEach((slot, i) => {
    if (i === state.current || !slot.photo) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:absolute;z-index:2;overflow:hidden`;
    place(wrap, slot);
    const img = new Image(); img.src = slot.photo.src;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    wrap.appendChild(img);
    stage.appendChild(wrap);
  });

  // 4. 현재 컷 — 카메라 켜져 있으면 video, 아니면 빈칸
  const currentSlot = state.slots[state.current];
  if (state.cameraReady) {
    // video를 현재 슬롯 위치에 clip해서 보여주는 wrapper
    const vWrap = document.createElement('div');
    vWrap.id = 'videoWrap';
    vWrap.style.cssText = `position:absolute;z-index:3;overflow:hidden`;
    place(vWrap, currentSlot);
    vWrap.appendChild(video); // video 이동 (스트림은 유지됨)
    stage.appendChild(vWrap);

    // LIVE 배지
    const badge = document.createElement('div');
    badge.style.cssText = `position:absolute;left:${(currentSlot.x/state.w*100)+1}%;top:${(currentSlot.y/state.h*100)+1}%;z-index:9;background:#c8f23a;color:#0a0a0f;font-size:11px;font-weight:900;border-radius:999px;padding:3px 9px`;
    badge.textContent = 'LIVE';
    stage.appendChild(badge);
  } else {
    // 카메라 미켜짐 — 빈 슬롯
    const empty = document.createElement('div');
    empty.style.cssText = `position:absolute;z-index:3;display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,.3);font-size:14px;font-weight:700`;
    place(empty, currentSlot);
    empty.textContent = '카메라를 켜 주세요';
    stage.appendChild(empty);
  }

  // 5. 캐릭터 PNG (z-index 5 — video 위)
  buildCharacters(stage, 5);

  // 6. 브랜드
  buildBrand(stage);

  // UI 업데이트
  $('#currentShotText').textContent = `${state.current + 1}컷 촬영 중`;
  renderThumbs();
  const allDone = state.slots.every(s => s.photo);
  $('#toFinalBgBtn').classList.toggle('hidden', !allDone);
}

function renderCharacter() { renderStage($('#characterPreview'), {guide:true}); }
function renderBoothBg()   { renderStage($('#boothBgPreview')); }
function renderFinalBg()   { renderStage($('#finalBgPreview')); }

function renderThumbs() {
  const wrap = $('#thumbs'); wrap.innerHTML = '';
  state.slots.forEach((slot, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb' + (i === state.current ? ' active' : '');
    if (slot.photo) {
      const img = new Image(); img.src = slot.photo.src; img.alt = `${i+1}컷`;
      b.appendChild(img);
    } else {
      b.textContent = `${i+1}컷`;
    }
    b.addEventListener('click', e => {
      e.preventDefault();
      state.current = i;
      renderPhotoScreen();
    });
    wrap.appendChild(b);
  });
}

/* ── camera ── */
async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('카메라를 쓰려면 HTTPS 환경(GitHub Pages 등)에서 열어야 해.');
      return;
    }
    if (state.stream) state.stream.getTracks().forEach(t => t.stop());
    state.stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}, audio:false});
    video.srcObject = state.stream;
    await video.play();
    await new Promise(res => {
      if (video.readyState >= 2) { res(); return; }
      video.addEventListener('canplay', res, {once:true});
    });
    state.cameraReady = true;
    $('#captureBtn').disabled = false;
    $('#autoShootBtn').disabled = false;
    renderPhotoScreen(); // video가 DOM에 붙음
  } catch(e) {
    alert('카메라가 안 켜졌어. 브라우저 설정에서 카메라 접근을 허용해 줘.\n(' + e.message + ')');
  }
}

/* ── countdown ── */
async function countdown() {
  const c = $('#countdown');
  c.classList.remove('hidden');
  for (const n of [3, 2, 1]) {
    c.textContent = n; await wait(900);
  }
  c.textContent = '찰칵!'; await wait(300);
  c.classList.add('hidden');
}

/* ── capture ── */
function drawSlotBg(ctx, x, y, w, h) {
  ctx.fillStyle = state.boothBgColor;
  ctx.fillRect(x, y, w, h);
}
function drawCover(ctx, img, x, y, w, h) {
  const cover = Math.max(w / img.width, h / img.height);
  const dw = img.width * cover, dh = img.height * cover;
  ctx.drawImage(img, x + (w-dw)/2, y + (h-dh)/2, dw, dh);
}

function captureCurrent() {
  if (!state.cameraReady || video.readyState < 2) {
    alert('카메라를 먼저 켜 줘.'); return false;
  }
  const slot = state.slots[state.current];
  const cnv = document.createElement('canvas');
  cnv.width = slot.w; cnv.height = slot.h;
  const ctx = cnv.getContext('2d');
  drawSlotBg(ctx, 0, 0, slot.w, slot.h);
  const vw = video.videoWidth, vh = video.videoHeight;
  const tr = slot.w / slot.h, vr = vw / vh;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (vr > tr) { sw = vh * tr; sx = (vw - sw) / 2; }
  else          { sh = vw / tr; sy = (vh - sh) / 2; }
  ctx.save();
  ctx.translate(slot.w, 0); ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, slot.w, slot.h);
  ctx.restore();
  const img = new Image(); img.src = cnv.toDataURL('image/png');
  state.slots[state.current].photo = img;
  return true;
}

async function shootOne() {
  if (state.shooting) return;
  if (!state.cameraReady) { alert('카메라를 먼저 켜 줘.'); return; }
  state.shooting = true;
  await countdown();
  if (captureCurrent() && state.current < 3) state.current++;
  state.shooting = false;
  renderPhotoScreen();
}

async function autoShoot() {
  if (state.shooting) return;
  if (!state.cameraReady) {
    await startCamera();
    if (!state.cameraReady) return;
    await wait(600);
  }
  state.shooting = true;
  for (let i = state.current; i < 4; i++) {
    state.current = i;
    renderPhotoScreen();
    await wait(200); // 화면 업데이트 후 카운트다운
    await countdown();
    captureCurrent();
    await wait(400);
  }
  state.current = 3;
  state.shooting = false;
  renderPhotoScreen();
}

/* ── final image export ── */
function finalImage() {
  const cnv = $('#workCanvas'); cnv.width = state.w; cnv.height = state.h;
  const ctx = cnv.getContext('2d');
  // 외부 배경
  ctx.fillStyle = state.outsideFrameColor; ctx.fillRect(0, 0, state.w, state.h);
  if (state.outsideFrameImage) drawCover(ctx, state.outsideFrameImage, 0, 0, state.w, state.h);
  // 슬롯 배경색
  state.slots.forEach(slot => drawSlotBg(ctx, slot.x, slot.y, slot.w, slot.h));
  // 사진
  state.slots.forEach(slot => {
    if (!slot.photo) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(slot.x, slot.y, slot.w, slot.h); ctx.clip();
    drawCover(ctx, slot.photo, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
  });
  // 캐릭터
  state.slots.forEach(slot => {
    if (slot.char) ctx.drawImage(slot.char, slot.x, slot.y, slot.w, slot.h);
  });
  // 브랜드 텍스트
  const lastSlot = state.slots[3];
  const bottomTop = lastSlot.y + lastSlot.h;
  const brandY = bottomTop + (state.h - bottomTop) / 2 + Math.round(state.w * .015);
  const isDark = ['#191919','#222222'].includes(state.outsideFrameColor);
  ctx.fillStyle = isDark ? '#f0f0f4' : '#121017';
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(state.w * .038)}px sans-serif`;
  ctx.fillText(presets[state.presetKey]?.name || 'SKETCH BOOTH', state.w / 2, brandY);
  try { return cnv.toDataURL('image/png'); } catch(e) { return null; }
}

function playPrint() {
  const img = $('#printImg');
  img.classList.remove('printing'); void img.offsetWidth; img.classList.add('printing');
}

function setResult() {
  const data = finalImage();
  if (!data) { alert('이미지 생성 실패. 캔버스 보안 오류일 수 있어.'); return; }
  state.resultData = data;
  $('#printImg').src = data;
  $('#saveError').classList.add('hidden');
  show('#resultScreen');
  setTimeout(playPrint, 80);
}

/* ── DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {

  bind('#startBtn',         () => show('#sizeScreen'));
  bind('#backHomeBtn',      () => show('#homeScreen'));
  bind('#backSizeBtn',      () => show('#sizeScreen'));
  bind('#backCharacterBtn', () => show('#characterScreen'));
  bind('#backBoothBgBtn',   () => show('#boothBgScreen'));
  bind('#backPhotoBtn',     () => show('#photoScreen'));
  bind('#retryBtn',         () => show('#finalBgScreen'));
  bind('#resetBtn',         () => window.location.reload());

  $$('.sizeCard').forEach(btn => btn.addEventListener('click', () => {
    $$('.sizeCard').forEach(c => c.classList.remove('selected'));
    btn.classList.add('selected');
    setupPreset(btn.dataset.preset);
    $('#toCharacterBtn').disabled = false;
  }));

  bind('#toCharacterBtn', () => { renderCharacter(); show('#characterScreen'); });
  bind('#toBoothBgBtn',   () => { renderBoothBg(); show('#boothBgScreen'); });
  bind('#toPhotoBtn', () => {
    state.current = 0;
    state.cameraReady = false;
    // photo preview aspect ratio 설정
    $('#photoPreview').style.aspectRatio = `${state.w} / ${state.h}`;
    renderPhotoScreen();
    show('#photoScreen');
  });
  bind('#toFinalBgBtn',   () => { renderFinalBg(); show('#finalBgScreen'); });
  bind('#toResultBtn',    setResult);
  bind('#skipFinalBgBtn', setResult);
  bind('#replayPrintBtn', playPrint);

  bind('#downloadBtn', () => {
    if (!state.resultData) { $('#saveError').classList.remove('hidden'); return; }
    try {
      const a = document.createElement('a');
      a.download = 'sketch-booth.png'; a.href = state.resultData;
      document.body.appendChild(a); a.click(); a.remove();
    } catch(e) { $('#saveError').classList.remove('hidden'); }
  });

  bind('#openImageBtn', () => {
    const d = state.resultData || finalImage();
    if (!d) { $('#saveError').classList.remove('hidden'); return; }
    const w = window.open();
    if (w) w.document.write(`<img src="${d}" style="width:100%;height:auto">`);
    else location.href = d;
  });

  bind('#cameraModeBtn', () => {
    $('#cameraControls').classList.remove('hidden');
    $('#uploadControls').classList.add('hidden');
    $('#cameraModeBtn').classList.add('active');
    $('#uploadModeBtn').classList.remove('active');
  });
  bind('#uploadModeBtn', () => {
    $('#uploadControls').classList.remove('hidden');
    $('#cameraControls').classList.add('hidden');
    $('#uploadModeBtn').classList.add('active');
    $('#cameraModeBtn').classList.remove('active');
  });

  bind('#startCameraBtn', startCamera);
  bind('#captureBtn',     shootOne);
  bind('#autoShootBtn',   autoShoot);

  $$('.charInput').forEach(input => input.addEventListener('change', async e => {
    const f = e.target.files?.[0]; if (!f) return;
    state.slots[Number(e.target.dataset.i)].char = await loadImage(f);
    renderCharacter();
  }));

  $$('.photoInput').forEach(input => input.addEventListener('change', async e => {
    const f = e.target.files?.[0]; if (!f) return;
    const i = Number(e.target.dataset.i);
    state.slots[i].photo = await loadImage(f);
    state.current = Math.min(i + 1, 3);
    renderPhotoScreen();
  }));

  $('#boothColorGrid').addEventListener('click', e => {
    const btn = e.target.closest('.colorChip'); if (!btn) return;
    $$('#boothColorGrid .colorChip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    state.boothBgColor = btn.dataset.color;
    renderBoothBg();
  });

  $('#finalBgImageInput').addEventListener('change', async e => {
    const f = e.target.files?.[0]; if (!f) return;
    state.outsideFrameImage = await loadImage(f);
    renderFinalBg();
  });

  bind('#clearFinalImageBtn', () => {
    state.outsideFrameImage = null;
    $('#finalBgImageInput').value = '';
    renderFinalBg();
  });

  bind('#copyPromptBtn', async () => {
    try {
      await navigator.clipboard.writeText($('#promptText').value);
      const btn = $('#copyPromptBtn'); btn.textContent = '복사됨 ✓';
      setTimeout(() => btn.textContent = '복사', 1800);
    } catch(e) { $('#promptText').select(); document.execCommand('copy'); }
  });

});

window.addEventListener('pagehide', () => {
  if (state.stream) state.stream.getTracks().forEach(t => t.stop());
});

})();
