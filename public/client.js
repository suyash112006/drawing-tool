const socket = io({
  transports: ['websocket'],
  extraHeaders: {
    "bypass-tunnel-reminder": "true"
  }
});

// Parse room ID from URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('id') || 'global-trading-room';

document.getElementById('room-badge').innerText = `Room: ${roomId}`;

// -- State --
let currentTool = 'pen';
let currentColor = '#00ffcc';
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let laserPoints = [];

// -- DOM Elements --
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const laserCanvas = document.getElementById('laser-canvas');
const laserCtx = laserCanvas.getContext('2d');
const syncStatus = document.getElementById('sync-status');
const syncText = document.getElementById('sync-text');
const colorPicker = document.getElementById('color-picker');

const btnPenMain = document.getElementById('btn-pen-main');
const btnPen = document.getElementById('btn-pen');
const btnLaser = document.getElementById('btn-laser');
const btnEraser = document.getElementById('btn-eraser');
const btnClear = document.getElementById('btn-clear');
const btnShare = document.getElementById('btn-share');

// -- Setup Canvas --
function resizeCanvas() {
  let imageData;
  if (canvas.width > 0 && canvas.height > 0) {
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (imageData) {
    ctx.putImageData(imageData, 0, 0);
  }
  
  laserCanvas.width = window.innerWidth;
  laserCanvas.height = window.innerHeight;
  laserCtx.lineCap = 'round';
  laserCtx.lineJoin = 'round';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// -- Socket.IO --
socket.on('connect', () => {
  syncStatus.className = 'dot connected';
  syncText.innerText = 'Connected';
  socket.emit('join-room', roomId);
});

socket.on('disconnect', () => {
  syncStatus.className = 'dot disconnected';
  syncText.innerText = 'Disconnected';
});

socket.on('draw-event', (data) => {
  drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.tool, false);
});

socket.on('clear-canvas', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// -- Drawing Logic --
function drawLine(x0, y0, x1, y1, color, size, tool, emit = true) {
  if (tool === 'laser') {
    laserPoints.push({ x0, y0, x1, y1, time: Date.now(), color });
    if (!emit) return;
    socket.emit('draw-event', { roomId, x0, y0, x1, y1, color, size, tool });
    return;
  }

  let targetCtx = ctx;
  targetCtx.beginPath();
  targetCtx.moveTo(x0, y0);
  targetCtx.lineTo(x1, y1);
  
  if (tool === 'eraser') {
    targetCtx.globalCompositeOperation = 'destination-out';
    targetCtx.lineWidth = size;
    targetCtx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    targetCtx.globalCompositeOperation = 'source-over';
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = size;
    targetCtx.globalAlpha = 1.0;
  }
  
  targetCtx.stroke();
  targetCtx.globalAlpha = 1.0;
  targetCtx.globalCompositeOperation = 'source-over';

  if (!emit) return;

  socket.emit('draw-event', {
    roomId,
    x0, y0, x1, y1,
    color, size, tool
  });
}

function getCursorPosition(e) {
  return { x: e.clientX, y: e.clientY };
}

canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  const pos = getCursorPosition(e);
  lastX = pos.x;
  lastY = pos.y;
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  const pos = getCursorPosition(e);
  
  let size = 3;
  if (currentTool === 'highlighter') size = 15;
  if (currentTool === 'eraser') size = 30;
  if (currentTool === 'laser') size = 5;

  drawLine(lastX, lastY, pos.x, pos.y, currentColor, size, currentTool, true);
  lastX = pos.x;
  lastY = pos.y;
});

canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);

// -- Mobile Touch Events --
function getTouchPosition(e) {
  const touch = e.touches[0];
  return { x: touch.clientX, y: touch.clientY };
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault(); // Prevent scrolling while drawing
  isDrawing = true;
  const pos = getTouchPosition(e);
  lastX = pos.x;
  lastY = pos.y;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault(); // Prevent scrolling while drawing
  if (!isDrawing) return;
  const pos = getTouchPosition(e);
  
  let size = 3;
  if (currentTool === 'highlighter') size = 15;
  if (currentTool === 'eraser') size = 30;
  if (currentTool === 'laser') size = 5;

  drawLine(lastX, lastY, pos.x, pos.y, currentColor, size, currentTool, true);
  lastX = pos.x;
  lastY = pos.y;
}, { passive: false });

canvas.addEventListener('touchend', () => isDrawing = false);

// -- UI Interactions --
function setActiveTool(btn, toolName, label) {
  [btnPen, btnLaser, btnEraser].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentTool = toolName;
  if (label) btnPenMain.innerText = label;
}

btnPen.addEventListener('click', () => setActiveTool(btnPen, 'pen', '✏️ ▼'));
btnLaser.addEventListener('click', () => setActiveTool(btnLaser, 'laser', '🪄 ▼'));
btnEraser.addEventListener('click', () => {
  [btnPen, btnLaser, btnEraser].forEach(b => b.classList.remove('active'));
  btnEraser.classList.add('active');
  currentTool = 'eraser';
});

colorPicker.addEventListener('input', (e) => {
  currentColor = e.target.value;
});

btnClear.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit('clear-canvas', roomId);
});

btnShare.addEventListener('click', () => {
  const inviteLink = window.location.href;
  navigator.clipboard.writeText(inviteLink).then(() => {
    alert('Invite Link Copied to clipboard!');
  });
});

// Fade out laser strokes
function updateLaserFade() {
  laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
  const now = Date.now();
  laserPoints = laserPoints.filter(p => now - p.time < 2000);
  
  laserCtx.lineCap = 'round';
  laserCtx.lineJoin = 'round';
  laserCtx.lineWidth = 5;

  for (const p of laserPoints) {
    const age = now - p.time;
    const opacity = 1 - (age / 2000);
    laserCtx.globalAlpha = opacity;
    laserCtx.strokeStyle = p.color;
    laserCtx.beginPath();
    laserCtx.moveTo(p.x0, p.y0);
    laserCtx.lineTo(p.x1, p.y1);
    laserCtx.stroke();
  }
  requestAnimationFrame(updateLaserFade);
}
updateLaserFade();
