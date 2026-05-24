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

// -- DOM Elements --
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const syncStatus = document.getElementById('sync-status');
const syncText = document.getElementById('sync-text');
const colorPicker = document.getElementById('color-picker');

// Tools
const btnPen = document.getElementById('btn-pen');
const btnHighlighter = document.getElementById('btn-highlighter');
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
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = size;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    if (tool === 'highlighter') {
      ctx.globalAlpha = 0.3; 
    } else {
      ctx.globalAlpha = 1.0;
    }
  }
  
  ctx.stroke();
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = 'source-over';

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

  drawLine(lastX, lastY, pos.x, pos.y, currentColor, size, currentTool, true);
  lastX = pos.x;
  lastY = pos.y;
}, { passive: false });

canvas.addEventListener('touchend', () => isDrawing = false);

// -- UI Interactions --
function setActiveTool(btn, toolName) {
  [btnPen, btnHighlighter, btnEraser].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentTool = toolName;
}

btnPen.addEventListener('click', () => setActiveTool(btnPen, 'pen'));
btnHighlighter.addEventListener('click', () => setActiveTool(btnHighlighter, 'highlighter'));
btnEraser.addEventListener('click', () => setActiveTool(btnEraser, 'eraser'));

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
