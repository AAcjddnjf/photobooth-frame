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

/* ── video element ── */
const video = document.createElement('video');
video.autoplay = true; video.muted = true; video.playsInline = true;
video.setAttribute('playsinline','');

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
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
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
      x: mx, y: top + i * (sh + gap), w: sw, h: sh,
      photo: old[i]?.photo || null, char: old[i]?.char || null
    }));
  } else {
    const mx  = Math.round(state.w * .075);
    const top = Math.round(state.h * .12);
    const gx  = Math.round(state.w * .035);
    const gy  = Math.round(state.h * .035);
    const usable = state.w - mx * 2;
    const sw = Math.round((usable - gx) / 2);
    const sh = Math.round((state.h - top - Math.round(state.h * .16) - gy) / 2);
    state.slots = Array.from({length:4}, (_, i) => ({
      x: mx + (i % 2) * (sw + gx),
      y: top + Math.floor(i / 2) * (sh + gy),
      w: sw, h: sh,
      photo: old[i]?.photo || null, char: old[i]?.char || null
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
  return `Create a ${w}x${h}px photobooth character overlay PNG for one photo slot.\n\nCanvas size: exactly ${w}x${h}px.\n\n캐릭터 설정:\n- 옷차림: [원하는 옷차림 예: 교복 / 캐주얼 후드티 / 드레스 / 한복]\n- 포즈: [원하는 포즈 예: 손 흔들기 / 브이 / 기대는 포즈 / 눈 찡긋]\n- 스타일: 애니메이션 / 일러스트 / 실사 중 선택\n\nRules:\n- Transparent PNG background (no white fill, no box)\n- Leave the center area fully transparent where a real person will appear\n- Character or decorative props around the edges or overlapping naturally\n- No text, no border, no extra margin\n- This PNG stays fixed above the live camera layer`;
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

/* ── stage rendering ── */
function addBase(stage) {
  const bg = document.createElement('div');
  bg.className = 'finalBgLayer';
  bg.style.background = state.outsideFrameColor;
  if (state.outsideFrameImage) {
    const img = new Image();
    img.src = state.outsideFrameImage.src;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    bg.appendChild(img);
  }
  stage.appendChild(bg);
  const paper = document.createElement('div'); paper.className = 'paperLayer';
  stage.appendChild(paper);
}

function makeSlot(slot, i, {live = false} = {}) {
  const isLive = live && i === state.current && state.cameraReady;
  const wrap = document.createElement('div');
  wrap.className = isLive ? 'liveSlot activeLive' : 'stillSlot';
  place(wrap, slot);

  const bg = document.createElement('div');
  bg.className = 'slotBg';
  bg.style.background = state.boothBgColor;
  wrap.appendChild(bg);

  if (isLive) {
    video.className = 'slotVideo';
    wrap.appendChild(video);
    const badge = document.createElement('div');
    badge.className = 'liveNotice'; badge.textContent = 'LIVE';
    wrap.appendChild(badge);
  } else if (slot.photo) {
    const img = new Image(); img.className = 'slotPhoto'; img.src = slot.photo.src;
    wrap.appendChild(img);
  } else {
    const empty = document.createElement('div');
    empty.className = 'emptyText'; empty.textContent = `${i+1}컷`;
    wrap.appendChild(empty);
  }

  if (slot.char) {
    const ch = new Image(); ch.className = 'slotChar'; ch.src = slot.char.src;
    wrap.appendChild(ch);
  }
  return wrap;
}

function renderStage(stage, {live = false, guide = false} = {}) {
  stage.innerHTML = '';
  stage.style.aspectRatio = `${state.w} / ${state.h}`;
  addBase(stage);

  const layer = document.createElement('div'); layer.className = 'slotLayer';
  state.slots.forEach((slot, i) => layer.appendChild(makeSlot(slot, i, {live})));
  stage.appendChild(layer);

  if (guide) {
    const gl = document.createElement('div'); gl.className = 'guideLayer';
    state.slots.forEach((slot, i) => {
      const g = document.createElement('div'); g.className = 'guideBox';
      g.textContent = `${i+1}컷`; place(g, slot); gl.appendChild(g);
    });
    stage.appendChild(gl);
  }

  // brandText: sits in the bottom outside-frame area
  const lastSlot = state.slots[3];
  const brand = document.createElement('div'); brand.className = 'brandText';
  brand.textContent = presets[state.presetKey]?.name || 'SKETCH BOOTH';
  const brandTopPct = (lastSlot.y + lastSlot.h) / state.h * 100;
  brand.style.top = 'auto';
  brand.style.bottom = '0';
  brand.style.height = `${100 - brandTopPct}%`;
  stage.appendChild(brand);
}

function renderCharacter() { renderStage($('#characterPreview'), {guide:true}); }
function renderBoothBg()   { renderStage($('#boothBgPreview')); }
function renderFinalBg()   { renderStage($('#finalBgPreview')); }

function renderPhoto() {
  renderStage($('#photoPreview'), {live:true});
  $('#currentShotText').textContent = `${state.current + 1}컷 촬영 중`;
  renderThumbs();
  const allDone = state.slots.every(s => s.photo);
  $('#toFinalBgBtn').classList.toggle('hidden', !allDone);
}

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
      renderPhoto();
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
    // wait for video to have actual dimensions
    await new Promise(res => {
      if (video.readyState >= 2) { res(); return; }
      video.addEventListener('canplay', res, {once:true});
    });
    state.cameraReady = true;
    $('#captureBtn').disabled = false;
    $('#autoShootBtn').disabled = false;
    renderPhoto();
  } catch(e) {
    alert('카메라가 안 켜졌어. 브라우저 설정에서 카메라 접근을 허용해줘.\n(' + e.message + ')');
  }
}

/* ── countdown ── */
async function countdown() {
  const c = $('#countdown');
  c.classList.remove('hidden');
  for (const n of [3, 2, 1]) {
    c.textContent = n;
    await wait(900);
  }
  c.textContent = '찰칵!';
  await wait(300);
  c.classList.add('hidden');
}

/* ── capture ── */
function drawSlotBg(ctx, x, y, w, h) {
  ctx.fillStyle = state.boothBgColor;
  ctx.fillRect(x, y, w, h);
}

function captureCurrent() {
  if (!state.stream || !state.cameraReady || video.readyState < 2) {
    alert('카메라를 먼저 켜 줘.');
    return false;
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
  ctx.translate(slot.w, 0); ctx.scale(-1, 1); // mirror
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
  renderPhoto();
}

async function autoShoot() {
  if (state.shooting) return;
  // ensure camera is running first
  if (!state.cameraReady) {
    await startCamera();
    if (!state.cameraReady) return; // camera failed
    await wait(500); // let preview settle
  }
  state.shooting = true;
  for (let i = state.current; i < 4; i++) {
    state.current = i;
    renderPhoto();
    await countdown();
    captureCurrent();
    await wait(400);
  }
  state.current = 3;
  state.shooting = false;
  renderPhoto();
}

/* ── final image ── */
function drawCover(ctx, img, x, y, w, h) {
  const cover = Math.max(w / img.width, h / img.height);
  const dw = img.width * cover, dh = img.height * cover;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function finalImage() {
  const cnv = $('#workCanvas'); cnv.width = state.w; cnv.height = state.h;
  const ctx = cnv.getContext('2d');
  // outside frame background
  ctx.fillStyle = state.outsideFrameColor; ctx.fillRect(0, 0, state.w, state.h);
  if (state.outsideFrameImage) drawCover(ctx, state.outsideFrameImage, 0, 0, state.w, state.h);
  // slot backgrounds
  state.slots.forEach(slot => drawSlotBg(ctx, slot.x, slot.y, slot.w, slot.h));
  // photos
  state.slots.forEach(slot => {
    ctx.save();
    ctx.beginPath(); ctx.rect(slot.x, slot.y, slot.w, slot.h); ctx.clip();
    if (slot.photo) drawCover(ctx, slot.photo, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
  });
  // characters
  state.slots.forEach(slot => {
    if (slot.char) ctx.drawImage(slot.char, slot.x, slot.y, slot.w, slot.h);
  });
  // brand label — centered in bottom outside-frame zone
  const lastSlot = state.slots[3];
  const bottomZoneTop = lastSlot.y + lastSlot.h;
  const bottomZoneH   = state.h - bottomZoneTop;
  const brandY = bottomZoneTop + bottomZoneH / 2 + Math.round(state.w * .015);
  const isDark = state.outsideFrameColor === '#191919' || state.outsideFrameColor === '#222222';
  ctx.fillStyle = isDark ? '#f0f0f4' : '#121017';
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(state.w * .038)}px Syne, Apple SD Gothic Neo, sans-serif`;
  ctx.fillText(presets[state.presetKey]?.name || 'SKETCH BOOTH', state.w / 2, brandY);
  try {
    return cnv.toDataURL('image/png');
  } catch(e) {
    return null;
  }
}

function playPrint() {
  const img = $('#printImg');
  img.classList.remove('printing');
  void img.offsetWidth;
  img.classList.add('printing');
}

function setResult() {
  const data = finalImage();
  if (!data) {
    alert('이미지 생성에 실패했어. 외부 URL 이미지를 쓰면 보안 정책 때문에 저장이 안 될 수 있어.');
    return;
  }
  state.resultData = data;
  $('#printImg').src = data;
  $('#saveError').classList.add('hidden');
  show('#resultScreen');
  setTimeout(playPrint, 80);
}

/* ── DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {

  /* navigation */
  bind('#startBtn',       () => show('#sizeScreen'));
  bind('#backHomeBtn',    () => show('#homeScreen'));
  bind('#backSizeBtn',    () => show('#sizeScreen'));
  bind('#backCharacterBtn',() => show('#characterScreen'));
  bind('#backBoothBgBtn', () => show('#boothBgScreen'));
  bind('#backPhotoBtn',   () => show('#photoScreen'));
  bind('#retryBtn',       () => show('#finalBgScreen'));
  bind('#resetBtn',       () => window.location.reload());

  /* size select */
  $$('.sizeCard').forEach(btn => btn.addEventListener('click', () => {
    $$('.sizeCard').forEach(c => c.classList.remove('selected'));
    btn.classList.add('selected');
    setupPreset(btn.dataset.preset);
    $('#toCharacterBtn').disabled = false;
  }));

  /* step transitions */
  bind('#toCharacterBtn', () => { renderCharacter(); show('#characterScreen'); });
  bind('#toBoothBgBtn',   () => { renderBoothBg(); show('#boothBgScreen'); });
  bind('#toPhotoBtn',     () => { state.current = 0; state.cameraReady = false; renderPhoto(); show('#photoScreen'); });
  bind('#toFinalBgBtn',   () => { renderFinalBg(); show('#finalBgScreen'); });
  bind('#toResultBtn',    setResult);
  bind('#skipFinalBgBtn', setResult);
  bind('#replayPrintBtn', playPrint);

  /* download */
  bind('#downloadBtn', () => {
    if (!state.resultData) { $('#saveError').classList.remove('hidden'); return; }
    try {
      const a = document.createElement('a');
      a.download = 'sketch-booth.png';
      a.href = state.resultData;
      document.body.appendChild(a); a.click(); a.remove();
    } catch(e) {
      $('#saveError').classList.remove('hidden');
    }
  });

  bind('#openImageBtn', () => {
    if (!state.resultData) { state.resultData = finalImage() || ''; }
    if (!state.resultData) { $('#saveError').classList.remove('hidden'); return; }
    const w = window.open();
    if (w) w.document.write(`<img src="${state.resultData}" style="width:100%;height:auto">`);
    else location.href = state.resultData;
  });

  /* camera mode tabs */
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

  /* camera buttons */
  bind('#startCameraBtn', startCamera);
  bind('#captureBtn',     shootOne);
  bind('#autoShootBtn',   autoShoot);

  /* character upload */
  $$('.charInput').forEach(input => input.addEventListener('change', async e => {
    const f = e.target.files?.[0]; if (!f) return;
    const i = Number(e.target.dataset.i);
    state.slots[i].char = await loadImage(f);
    renderCharacter();
  }));

  /* photo upload */
  $$('.photoInput').forEach(input => input.addEventListener('change', async e => {
    const f = e.target.files?.[0]; if (!f) return;
    const i = Number(e.target.dataset.i);
    state.slots[i].photo = await loadImage(f);
    state.current = Math.min(i + 1, 3);
    renderPhoto();
  }));

  /* booth color */
  $('#boothColorGrid').addEventListener('click', e => {
    const btn = e.target.closest('.colorChip'); if (!btn) return;
    $$('#boothColorGrid .colorChip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    state.boothBgColor = btn.dataset.color;
    renderBoothBg();
  });

  /* outside frame image */
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

  /* prompt copy */
  bind('#copyPromptBtn', async () => {
    try {
      await navigator.clipboard.writeText($('#promptText').value);
      const btn = $('#copyPromptBtn'); btn.textContent = '복사됨 ✓';
      setTimeout(() => { btn.textContent = '복사'; }, 1800);
    } catch(e) {
      $('#promptText').select(); document.execCommand('copy');
    }
  });

});

/* cleanup on page hide */
window.addEventListener('pagehide', () => {
  if (state.stream) state.stream.getTracks().forEach(t => t.stop());
});

})();
