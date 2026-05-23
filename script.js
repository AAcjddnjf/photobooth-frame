const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('camera');
const preview = document.getElementById('preview');

const frameInput = document.getElementById('frameInput');
const photoInput = document.getElementById('photoInput');
const startCameraBtn = document.getElementById('startCamera');
const switchCameraBtn = document.getElementById('switchCamera');
const takePhotoBtn = document.getElementById('takePhoto');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const fitCoverBtn = document.getElementById('fitCover');
const fitContainBtn = document.getElementById('fitContain');
const resetPhotoBtn = document.getElementById('resetPhoto');
const scaleRange = document.getElementById('scaleRange');
const xRange = document.getElementById('xRange');
const yRange = document.getElementById('yRange');

const state = {
  frame: null,
  photo: null,
  scale: 1,
  x: 0,
  y: 0,
  facingMode: 'user',
  stream: null,
  dragging: false,
  lastPointer: null,
};

function drawEmpty() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#191919';
  ctx.font = '700 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('프레임과 사진을 올려주세요', canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillStyle = '#777777';
  ctx.font = '32px sans-serif';
  ctx.fillText('1080 × 1920 저장용 캔버스', canvas.width / 2, canvas.height / 2 + 42);
}

function draw() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.photo) {
    const img = state.photo;
    const base = Math.max(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * base * state.scale;
    const h = img.height * base * state.scale;
    const x = (canvas.width - w) / 2 + state.x;
    const y = (canvas.height - h) / 2 + state.y;
    ctx.drawImage(img, x, y, w, h);
  } else if (!video.classList.contains('is-live')) {
    drawEmpty();
  }

  if (state.frame) {
    ctx.drawImage(state.frame, 0, 0, canvas.width, canvas.height);
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 불러오지 못했습니다.'));
    };
    img.src = url;
  });
}

async function handleFrameUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  state.frame = await loadImageFromFile(file);
  draw();
}

async function handlePhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  state.photo = await loadImageFromFile(file);
  stopCamera();
  fitPhoto('cover');
}

function fitPhoto(mode) {
  if (!state.photo) return;
  const img = state.photo;
  const cover = Math.max(canvas.width / img.width, canvas.height / img.height);
  const contain = Math.min(canvas.width / img.width, canvas.height / img.height);
  state.scale = mode === 'contain' ? contain / cover : 1;
  state.x = 0;
  state.y = 0;
  syncControls();
  draw();
}

function syncControls() {
  scaleRange.value = state.scale;
  xRange.value = state.x;
  yRange.value = state.y;
}

function updateFromControls() {
  state.scale = Number(scaleRange.value);
  state.x = Number(xRange.value);
  state.y = Number(yRange.value);
  draw();
}

async function startCamera() {
  stopCamera();
  try {
    const constraints = {
      video: {
        facingMode: state.facingMode,
        width: { ideal: 1080 },
        height: { ideal: 1920 },
      },
      audio: false,
    };
    state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = state.stream;
    video.classList.add('is-live');
    switchCameraBtn.disabled = false;
    takePhotoBtn.disabled = false;
    draw();
  } catch (error) {
    alert('카메라를 켤 수 없습니다. 브라우저 권한을 확인해 주세요.');
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }
  video.srcObject = null;
  video.classList.remove('is-live');
  switchCameraBtn.disabled = true;
  takePhotoBtn.disabled = true;
}

async function switchCamera() {
  state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
  await startCamera();
}

function takePhoto() {
  if (!state.stream || video.readyState < 2) return;
  const temp = document.createElement('canvas');
  temp.width = video.videoWidth || 1080;
  temp.height = video.videoHeight || 1920;
  const tctx = temp.getContext('2d');

  if (state.facingMode === 'user') {
    tctx.translate(temp.width, 0);
    tctx.scale(-1, 1);
  }

  tctx.drawImage(video, 0, 0, temp.width, temp.height);
  const img = new Image();
  img.onload = () => {
    state.photo = img;
    stopCamera();
    fitPhoto('cover');
  };
  img.src = temp.toDataURL('image/png');
}

function downloadImage() {
  draw();
  const link = document.createElement('a');
  link.download = `frame-photo-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function clearAll() {
  stopCamera();
  state.frame = null;
  state.photo = null;
  state.scale = 1;
  state.x = 0;
  state.y = 0;
  frameInput.value = '';
  photoInput.value = '';
  syncControls();
  drawEmpty();
}

function pointerPos(event) {
  const rect = preview.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

preview.addEventListener('pointerdown', event => {
  if (!state.photo) return;
  state.dragging = true;
  state.lastPointer = pointerPos(event);
  preview.setPointerCapture(event.pointerId);
});

preview.addEventListener('pointermove', event => {
  if (!state.dragging || !state.photo || !state.lastPointer) return;
  const pos = pointerPos(event);
  state.x += pos.x - state.lastPointer.x;
  state.y += pos.y - state.lastPointer.y;
  state.lastPointer = pos;
  syncControls();
  draw();
});

preview.addEventListener('pointerup', event => {
  state.dragging = false;
  state.lastPointer = null;
  try { preview.releasePointerCapture(event.pointerId); } catch (_) {}
});

frameInput.addEventListener('change', handleFrameUpload);
photoInput.addEventListener('change', handlePhotoUpload);
startCameraBtn.addEventListener('click', startCamera);
switchCameraBtn.addEventListener('click', switchCamera);
takePhotoBtn.addEventListener('click', takePhoto);
downloadBtn.addEventListener('click', downloadImage);
clearBtn.addEventListener('click', clearAll);
fitCoverBtn.addEventListener('click', () => fitPhoto('cover'));
fitContainBtn.addEventListener('click', () => fitPhoto('contain'));
resetPhotoBtn.addEventListener('click', () => fitPhoto('cover'));
[scaleRange, xRange, yRange].forEach(input => input.addEventListener('input', updateFromControls));

drawEmpty();
