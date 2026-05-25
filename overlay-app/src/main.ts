import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { io, Socket } from 'socket.io-client';

// -- State --
let isDrawingMode = true; // Start in drawing mode
(window as any).__isDrawingMode = isDrawingMode;
let currentTool = 'pen'; // 'pen', 'eraser', 'laser'
let currentColor = '#00ffcc';
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let isHidden = false; // For Ctrl+H
let laserPoints: {x0: number, y0: number, x1: number, y1: number, time: number, color: string}[] = [];
let roomId = 'global-trading-room'; // Default room for MVP

// -- DOM Elements --
const canvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const laserCanvas = document.getElementById('laser-canvas') as HTMLCanvasElement;
const laserCtx = laserCanvas.getContext('2d')!;
const toolbar = document.getElementById('toolbar')!;
const notification = document.getElementById('notification')!;
const syncStatus = document.getElementById('sync-status')!;
const syncText = document.getElementById('sync-text')!;
const colorPicker = document.getElementById('color-picker') as HTMLInputElement;

// Tools
const btnPenMain = document.getElementById('btn-pen-main') as HTMLButtonElement;
const btnPen = document.getElementById('btn-pen') as HTMLButtonElement;
const btnLaser = document.getElementById('btn-laser') as HTMLButtonElement;
const btnEraser = document.getElementById('btn-eraser') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear')!;
const btnShare = document.getElementById('btn-share')!;

// -- Setup Canvas --
function resizeCanvas() {
  // Save current drawing before resize
  let imageData;
  if (canvas.width > 0 && canvas.height > 0) {
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Restore context settings (they reset on resize)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Restore previous drawing
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

// -- Tauri APIs (must be initialized before use) --
// -- Tauri APIs will be fetched locally when needed to prevent startup crashes --

// -- Socket.IO --
// We connect to the public URL so you can send this EXACT .exe to your friend.
// Forcing 'websocket' transport bypasses Localtunnel's strict CORS preflight checks!
const SERVER_URL = 'https://drawing-tool-68fi.onrender.com';
const PUBLIC_SHARE_URL = 'https://drawing-tool-68fi.onrender.com';

const socket: Socket = io(SERVER_URL, {
  transports: ['websocket'],
  extraHeaders: {
    "bypass-tunnel-reminder": "true"
  }
});

socket.on('connect', () => {
  syncStatus.className = 'dot connected';
  syncText.innerText = 'Connected';
  socket.emit('join-room', roomId);
});

socket.on('disconnect', () => {
  syncStatus.className = 'dot disconnected';
  syncText.innerText = 'Disconnected';
});

socket.on('draw-event', (data: any) => {
  drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.tool, false);
});

socket.on('clear-canvas', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// -- Drawing Logic --
function drawLine(x0: number, y0: number, x1: number, y1: number, color: string, size: number, tool: string, emit: boolean = true) {
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
  targetCtx.globalAlpha = 1.0; // Reset
  targetCtx.globalCompositeOperation = 'source-over'; // Reset

  if (!emit) return;

  socket.emit('draw-event', {
    roomId,
    x0, y0, x1, y1,
    color, size, tool
  });
}

function getCursorPosition(e: MouseEvent) {
  return { x: e.clientX, y: e.clientY };
}

canvas.addEventListener('mousedown', (e) => {
  if (!isDrawingMode) return;
  isDrawing = true;
  const pos = getCursorPosition(e);
  lastX = pos.x;
  lastY = pos.y;
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing || !isDrawingMode) return;
  const pos = getCursorPosition(e);
  
  let size = 3;
  if (currentTool === 'eraser') size = 30;
  if (currentTool === 'laser') size = 5;

  drawLine(lastX, lastY, pos.x, pos.y, currentColor, size, currentTool, true);
  lastX = pos.x;
  lastY = pos.y;
});

canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);

// -- UI Interactions --
function setActiveTool(btn: HTMLElement, toolName: string, label: string) {
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
  currentColor = (e.target as HTMLInputElement).value;
});

btnClear.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit('clear-canvas', roomId);
});



btnShare.addEventListener('click', () => {
  // Generate public link using the Localtunnel URL
  const inviteLink = `${PUBLIC_SHARE_URL}/room.html?id=${roomId}`;
  
  navigator.clipboard.writeText(inviteLink).then(() => {
    showNotification('Invite Link Copied!');
  }).catch(() => {
    showNotification('Failed to copy link', '#ff4757', '#fff');
  });
});

// -- Tauri Global Hotkey & Click Through --
function showNotification(text: string, bgColor: string = 'var(--accent-color)', color: string = '#000') {
  notification.innerText = text;
  notification.style.background = bgColor;
  notification.style.color = color;
  notification.classList.add('show');
  setTimeout(() => notification.classList.remove('show'), 2000);
}

async function toggleDrawingMode() {
  isDrawingMode = !isDrawingMode;
  (window as any).__isDrawingMode = isDrawingMode;
  const win = getCurrentWindow();
  
  if (isDrawingMode) {
    // Enable Drawing - Window intercepts clicks
    await win.setIgnoreCursorEvents(false);
    toolbar.classList.remove('hidden');
    canvas.style.pointerEvents = 'auto';
    showNotification('Drawing Mode Enabled');
  } else {
    // Disable Drawing - Clicks pass through to TradingView
    await win.setIgnoreCursorEvents(true);
    toolbar.classList.add('hidden');
    canvas.style.pointerEvents = 'none';
    showNotification('Click-Through Mode Enabled', '#ff4757', '#fff');
  }
}

// Expose toggleDrawingMode globally so Rust eval() can call it
(window as any).toggleDrawingMode = toggleDrawingMode;

// Listen for global shortcut events emitted from Rust backend
async function setupHotkey() {
  // 1. Toggle Drawing Mode (Ctrl+Shift+D)
  await listen('shortcut-toggle-draw', () => {
    toggleDrawingMode();
  });

  // 2. Toggle Minimize (Ctrl+M)
  await listen('shortcut-toggle-minimize', async () => {
    const win = getCurrentWindow();
    const isMinimized = await win.isMinimized();
    if (isMinimized) {
      await win.unminimize();
      await win.setFocus();
    } else {
      await win.minimize();
    }
  });

  // 3. Toggle Hide (Ctrl+H)
  await listen('shortcut-toggle-hide', () => {
    isHidden = !isHidden;
    if (isHidden) {
      document.body.style.opacity = '0';
      canvas.style.pointerEvents = 'none';
    } else {
      document.body.style.opacity = '1';
      canvas.style.pointerEvents = isDrawingMode ? 'auto' : 'none';
    }
  });

  showNotification('Hotkeys Ready!');
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    toggleDrawingMode();
  }
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
    const size = Math.max(1, 5 * (1 - (age / 2000)));
    laserCtx.globalAlpha = 1.0;
    laserCtx.lineWidth = size;
    laserCtx.strokeStyle = p.color;
    laserCtx.beginPath();
    laserCtx.moveTo(p.x0, p.y0);
    laserCtx.lineTo(p.x1, p.y1);
    laserCtx.stroke();
  }
}
setInterval(updateLaserFade, 16);

// Init
setupHotkey();
