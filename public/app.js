/* =============================================
   GRAFCOIN — Frontend App
   ============================================= */

'use strict';

// ---- Constants ----
const BG_COLOR = '#111118';
const CANVAS_W = 700;
const CANVAS_H = 450;

// ---- State ----
let currentTool = 'spray';
let currentColor = '#ff2d55';
let brushSize = 20;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let adminPassword = null;

// ---- DOM refs ----
const canvas = document.getElementById('grafCanvas');
const ctx = canvas.getContext('2d');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
const toolBtns = document.querySelectorAll('.tool-btn');
const swatches = document.querySelectorAll('.swatch');
const customColorInput = document.getElementById('customColor');
const sizeSlider = document.getElementById('sizeSlider');
const sizeVal = document.getElementById('sizeVal');
const btnClear = document.getElementById('btnClear');
const btnSave = document.getElementById('btnSave');
const saveBtnText = document.getElementById('saveBtnText');
const authorInput = document.getElementById('authorInput');
const statusMsg = document.getElementById('statusMsg');
const galleryGrid = document.getElementById('galleryGrid');
const statCount = document.getElementById('statCount');

// Admin
const btnAdminOpen = document.getElementById('btnAdminOpen');
const footerAdminLink = document.getElementById('footerAdminLink');
const adminModal = document.getElementById('adminModal');
const modalClose = document.getElementById('modalClose');
const adminPassInput = document.getElementById('adminPassInput');
const modalError = document.getElementById('modalError');
const modalSub = document.getElementById('modalSub');
const btnAdminLogin = document.getElementById('btnAdminLogin');
const btnAdminLogout = document.getElementById('btnAdminLogout');

// =============================================
// CANVAS INIT
// =============================================
function initBgCanvas() {
  bgCtx.fillStyle = BG_COLOR;
  bgCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  drawBrickPattern(bgCtx);
}

function initCanvas() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawBrickPattern(c) {
  c.save();

  const brickH = 30;
  const brickW = 70;
  const lineColor = 'rgba(255,255,255,0.03)';

  c.strokeStyle = lineColor;
  c.lineWidth = 1.5;

  // Horizontal lines
  for (let y = brickH; y < CANVAS_H; y += brickH) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(CANVAS_W, y);
    c.stroke();
  }

  // Vertical staggered lines
  for (let row = 0; row * brickH < CANVAS_H; row++) {
    const offset = (row % 2 === 0) ? 0 : brickW / 2;
    const y1 = row * brickH;
    const y2 = y1 + brickH;

    for (let x = offset; x < CANVAS_W; x += brickW) {
      c.beginPath();
      c.moveTo(x, y1);
      c.lineTo(x, y2);
      c.stroke();
    }
  }

  c.restore();
}

// =============================================
// POSITION UTILITY
// =============================================
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_W / rect.width;
  const scaleY = CANVAS_H / rect.height;

  let clientX, clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

// =============================================
// DRAWING TOOLS
// =============================================

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function sprayPaint(x, y) {
  const radius = brushSize * 2.2;

  ctx.save();

  // Soft radial core — wet paint center
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.45);
  grad.addColorStop(0, hexToRgba(currentColor, 0.07));
  grad.addColorStop(1, hexToRgba(currentColor, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Fine mist — Gaussian distribution (dense center, fades out)
  const count = Math.max(55, Math.floor(brushSize * 3.2));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Box-Muller Gaussian, clamped to radius
    const gauss = Math.sqrt(-2 * Math.log(Math.random() || 1e-6)) * Math.cos(2 * Math.PI * Math.random());
    const r = Math.min(Math.abs(gauss) * radius * 0.4, radius);
    const dist = r / radius;

    const dx = Math.cos(angle) * r;
    const dy = Math.sin(angle) * r;

    const dotSize = 0.2 + Math.random() * (1.5 - dist * 0.9);
    const alpha = (0.02 + Math.random() * 0.1) * (1 - dist * 0.55);

    ctx.globalAlpha = Math.max(0.01, alpha);
    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, dotSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Overspray — stray particles beyond main radius
  const sprayCount = Math.floor(brushSize * 1.4);
  for (let i = 0; i < sprayCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = radius * (0.8 + Math.random() * 1.1);
    ctx.globalAlpha = 0.006 + Math.random() * 0.025;
    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(angle) * r,
      y + Math.sin(angle) * r,
      0.2 + Math.random() * 0.55,
      0, Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();
}

// =============================================
// DRIP SYSTEM (disabled)
// =============================================
const drips = [];
let dripRafId = null;

function animateDrips() {
  if (drips.length > 0) {
    dripRafId = requestAnimationFrame(animateDrips);
  } else {
    dripRafId = null;
  }
}

function startBrush(x, y) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.strokeStyle = currentColor;
  ctx.lineWidth = brushSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  lastX = x;
  lastY = y;
}

function continueBrush(x, y) {
  const midX = (lastX + x) / 2;
  const midY = (lastY + y) / 2;

  if (currentTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = currentColor;
  }
  ctx.lineWidth = brushSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.quadraticCurveTo(lastX, lastY, midX, midY);
  ctx.stroke();

  lastX = x;
  lastY = y;
}

// =============================================
// EVENT HANDLERS — DRAWING
// =============================================
function onDrawStart(e) {
  e.preventDefault();
  isDrawing = true;
  const pos = getPos(e);
  lastX = pos.x;
  lastY = pos.y;

  if (currentTool === 'brush' || currentTool === 'eraser') {
    startBrush(pos.x, pos.y);
  } else if (currentTool === 'spray') {
    sprayPaint(pos.x, pos.y);
  }
}

function onDrawMove(e) {
  e.preventDefault();
  if (!isDrawing) return;
  const pos = getPos(e);

  if (currentTool === 'spray') {
    sprayPaint(pos.x, pos.y);
  } else if (currentTool === 'brush' || currentTool === 'eraser') {
    continueBrush(pos.x, pos.y);
  }
}

function onDrawEnd(e) {
  if (e.cancelable) e.preventDefault();
  if (!isDrawing) return;
  isDrawing = false;

  if (currentTool === 'brush' || currentTool === 'eraser') {
    ctx.restore();
  }
}

// Mouse events
canvas.addEventListener('mousedown', onDrawStart);
canvas.addEventListener('mousemove', onDrawMove);
canvas.addEventListener('mouseup', onDrawEnd);
canvas.addEventListener('mouseleave', onDrawEnd);

// Touch events
canvas.addEventListener('touchstart', onDrawStart, { passive: false });
canvas.addEventListener('touchmove', onDrawMove, { passive: false });
canvas.addEventListener('touchend', onDrawEnd, { passive: false });
canvas.addEventListener('touchcancel', onDrawEnd, { passive: false });

// =============================================
// TOOLBAR INTERACTIONS
// =============================================

// Tool buttons
toolBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    toolBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (btn.id === 'toolSpray') currentTool = 'spray';
    else if (btn.id === 'toolBrush') currentTool = 'brush';
    else if (btn.id === 'toolEraser') currentTool = 'eraser';
  });
});

// Color swatches
swatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    swatches.forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    currentColor = swatch.dataset.color;
    customColorInput.value = currentColor;
    if (currentTool === 'eraser') {
      activateTool('spray');
    }
  });
});

// Custom color picker
customColorInput.addEventListener('input', (e) => {
  currentColor = e.target.value;
  swatches.forEach(s => s.classList.remove('active'));
  if (currentTool === 'eraser') {
    activateTool('spray');
  }
});

function activateTool(toolId) {
  currentTool = toolId;
  toolBtns.forEach(b => {
    b.classList.toggle('active', b.id === 'tool' + capitalize(toolId));
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Size slider
sizeSlider.addEventListener('input', () => {
  brushSize = parseInt(sizeSlider.value, 10);
  sizeVal.textContent = brushSize;
});

// Clear canvas
btnClear.addEventListener('click', () => {
  if (dripRafId) { cancelAnimationFrame(dripRafId); dripRafId = null; }
  drips.length = 0;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  clearStatus();
});

// =============================================
// STATUS MESSAGES
// =============================================
function showStatus(message, type = 'info') {
  statusMsg.textContent = message;
  statusMsg.className = 'status-msg ' + type;
}

function clearStatus() {
  statusMsg.textContent = '';
  statusMsg.className = 'status-msg';
}

// =============================================
// ESCAPE HTML (XSS prevention)
// =============================================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================
// SAVE GRAFFITI
// =============================================
btnSave.addEventListener('click', async () => {
  const merged = document.createElement('canvas');
  merged.width = CANVAS_W;
  merged.height = CANVAS_H;
  const mCtx = merged.getContext('2d');
  mCtx.drawImage(bgCanvas, 0, 0);
  mCtx.drawImage(canvas, 0, 0);
  const imageData = merged.toDataURL('image/png');
  const author = authorInput.value.trim().slice(0, 50);

  btnSave.disabled = true;
  saveBtnText.textContent = 'Saving...';
  clearStatus();

  try {
    const res = await fetch('/api/graffiti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, author })
    });

    const data = await res.json();

    if (res.status === 429) {
      showStatus(data.error || 'Too many requests. Limit: 3 graffiti per hour. Try again later.', 'error');
    } else if (!res.ok) {
      showStatus(data.error || 'Failed to save. Please try again.', 'error');
    } else {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      authorInput.value = '';
      showStatus('Graffiti saved! It will appear in the gallery shortly.', 'success');
      setTimeout(() => {
        loadGallery();
        clearStatus();
      }, 1200);
    }
  } catch (err) {
    console.error('Save error:', err);
    showStatus('Connection error. Check your internet and try again.', 'error');
  } finally {
    btnSave.disabled = false;
    saveBtnText.textContent = 'Save Graffiti';
  }
});

// =============================================
// GALLERY
// =============================================
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function loadGallery() {
  galleryGrid.innerHTML = `
    <div class="gallery-loading">
      <div class="loading-spinner"></div>
      <span>Loading...</span>
    </div>
  `;

  try {
    const res = await fetch('/api/graffiti');
    if (!res.ok) throw new Error('Server error');

    const items = await res.json();

    if (statCount) statCount.textContent = items.length;

    if (items.length === 0) {
      galleryGrid.innerHTML = `
        <div class="gallery-empty">
          <span class="empty-icon">🏙️</span>
          The wall is empty — be the first to leave your mark!
        </div>
      `;
      return;
    }

    galleryGrid.innerHTML = '';
    items.forEach(item => {
      const card = createGalleryCard(item);
      galleryGrid.appendChild(card);
    });

  } catch (err) {
    console.error('Gallery load error:', err);
    galleryGrid.innerHTML = `
      <div class="gallery-empty">
        <span class="empty-icon">⚠️</span>
        Failed to load gallery. Refresh the page.
      </div>
    `;
  }
}

function createGalleryCard(item) {
  const card = document.createElement('div');
  card.className = 'gallery-card';
  card.dataset.id = item.id;

  const safeName = escapeHtml(item.author || 'Anonymous');
  const dateStr = formatDate(item.created_at);

  card.innerHTML = `
    <img
      src="/uploads/${encodeURIComponent(item.id)}.png"
      alt="Graffiti by ${safeName}"
      loading="lazy"
    />
    <div class="card-meta">
      <span class="card-author">${safeName}</span>
      <span class="card-date">${dateStr}</span>
    </div>
    ${adminPassword ? `<button class="card-delete-btn" data-id="${escapeHtml(item.id)}">Delete</button>` : ''}
  `;

  if (adminPassword) {
    const deleteBtn = card.querySelector('.card-delete-btn');
    deleteBtn.addEventListener('click', () => deleteGraffiti(item.id));
  }

  return card;
}

// =============================================
// DELETE GRAFFITI
// =============================================
async function deleteGraffiti(id) {
  if (!confirm('Delete this graffiti? This action cannot be undone.')) return;

  try {
    const res = await fetch(`/api/graffiti/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword })
    });

    if (res.status === 403) {
      adminPassword = null;
      updateAdminUI();
      alert('Wrong admin password. Please log in again.');
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to delete.');
      return;
    }

    const card = galleryGrid.querySelector(`[data-id="${id}"]`);
    if (card) {
      card.style.transition = 'opacity 0.3s, transform 0.3s';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.9)';
      setTimeout(() => {
        card.remove();
        const cards = galleryGrid.querySelectorAll('.gallery-card');
        if (cards.length === 0) {
          galleryGrid.innerHTML = `
            <div class="gallery-empty">
              <span class="empty-icon">🏙️</span>
              The wall is empty — be the first to leave your mark!
            </div>
          `;
        }
        if (statCount) {
          const current = parseInt(statCount.textContent, 10);
          if (!isNaN(current)) statCount.textContent = current - 1;
        }
      }, 300);
    }

  } catch (err) {
    console.error('Delete error:', err);
    alert('Connection error while deleting.');
  }
}

// =============================================
// ADMIN MODAL
// =============================================
function openAdminModal() {
  adminModal.classList.add('open');
  adminPassInput.value = '';
  modalError.textContent = '';

  if (adminPassword) {
    btnAdminLogin.style.display = 'none';
    btnAdminLogout.style.display = 'flex';
    adminPassInput.style.display = 'none';
    modalSub.textContent = 'You are logged in as admin.';
  } else {
    btnAdminLogin.style.display = 'flex';
    btnAdminLogout.style.display = 'none';
    adminPassInput.style.display = 'block';
    modalSub.textContent = 'Enter password to access admin controls';
  }

  setTimeout(() => adminPassInput.focus(), 100);
}

function closeAdminModal() {
  adminModal.classList.remove('open');
}

function updateAdminUI() {
  if (adminPassword) {
    btnAdminOpen.textContent = 'Admin ✓';
    btnAdminOpen.style.color = 'var(--neon-green)';
    btnAdminOpen.style.borderColor = 'rgba(0,255,136,0.3)';
    btnAdminOpen.style.background = 'rgba(0,255,136,0.1)';
  } else {
    btnAdminOpen.textContent = 'Admin';
    btnAdminOpen.style.color = '';
    btnAdminOpen.style.borderColor = '';
    btnAdminOpen.style.background = '';
  }
}

btnAdminOpen.addEventListener('click', openAdminModal);
footerAdminLink.addEventListener('click', (e) => { e.preventDefault(); openAdminModal(); });
modalClose.addEventListener('click', closeAdminModal);
adminModal.addEventListener('click', (e) => {
  if (e.target === adminModal) closeAdminModal();
});

// Login
btnAdminLogin.addEventListener('click', async () => {
  const pw = adminPassInput.value.trim();
  if (!pw) {
    modalError.textContent = 'Please enter a password.';
    return;
  }

  btnAdminLogin.disabled = true;
  btnAdminLogin.textContent = 'Checking...';
  modalError.textContent = '';

  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    const data = await res.json();

    if (data.valid) {
      adminPassword = pw;
      updateAdminUI();
      closeAdminModal();
      loadGallery();
    } else {
      modalError.textContent = 'Wrong password. Try again.';
      adminPassInput.select();
    }
  } catch (err) {
    modalError.textContent = 'Connection error. Try again.';
  } finally {
    btnAdminLogin.disabled = false;
    btnAdminLogin.textContent = 'Login';
  }
});

// Logout
btnAdminLogout.addEventListener('click', () => {
  adminPassword = null;
  updateAdminUI();
  closeAdminModal();
  loadGallery();
});

// Enter key in password input
adminPassInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnAdminLogin.click();
});

// =============================================
// KEYBOARD SHORTCUTS
// =============================================
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key.toLowerCase()) {
    case 's': activateTool('spray'); break;
    case 'b': activateTool('brush'); break;
    case 'e': activateTool('eraser'); break;
    case 'escape': closeAdminModal(); break;
  }
});

// =============================================
// SMOOTH SCROLL
// =============================================
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// =============================================
// CA COPY
// =============================================
(function () {
  const CA_FULL = '0x0000000000000000000000000000000000000000';
  const copyBtn = document.getElementById('caCopy');
  if (!copyBtn) return;
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CA_FULL);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = CA_FULL;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    copyBtn.textContent = 'COPIED!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'COPY';
      copyBtn.classList.remove('copied');
    }, 2000);
  });
})();

// =============================================
// SECRET ADMIN ACCESS — click logo 5 times
// =============================================
(function () {
  const logo = document.querySelector('.logo');
  let clicks = 0;
  let timer;
  logo.addEventListener('click', function () {
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(() => { clicks = 0; }, 2000);
    if (clicks >= 5) {
      clicks = 0;
      clearTimeout(timer);
      openAdminModal();
    }
  });
})();

// =============================================
// AUDIO
// =============================================
(function () {
  const sndHover = new Audio('gr1.mp3');
  const sndDraw  = new Audio('gr2.mp3');
  sndHover.loop   = true;
  sndDraw.loop    = true;
  sndHover.volume = 0.55;
  sndDraw.volume  = 0.8;

  function startSound(snd) {
    if (snd.paused) {
      snd.currentTime = 0;
      snd.play().catch(() => {});
    }
  }

  function stopSound(snd) {
    if (!snd.paused) {
      snd.pause();
      snd.currentTime = 0;
    }
  }

  // Hover — play gr1 when mouse enters canvas (not drawing)
  canvas.addEventListener('mouseenter', () => {
    if (!isDrawing) {
      stopSound(sndDraw);
      startSound(sndHover);
    }
  });

  // Leave — stop all
  canvas.addEventListener('mouseleave', () => {
    stopSound(sndHover);
    stopSound(sndDraw);
  });

  // Draw start — switch to gr2
  canvas.addEventListener('mousedown', () => {
    stopSound(sndHover);
    startSound(sndDraw);
  });

  // Draw end — back to gr1 (still hovering)
  canvas.addEventListener('mouseup', () => {
    stopSound(sndDraw);
    startSound(sndHover);
  });

  // Touch
  canvas.addEventListener('touchstart', () => {
    stopSound(sndHover);
    startSound(sndDraw);
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    stopSound(sndDraw);
  }, { passive: true });
})();

// =============================================
// SPLASH SCREEN
// =============================================
(function () {
  const splash = document.getElementById('splash');
  const splashBtn = document.getElementById('splashBtn');
  if (!splash || !splashBtn) return;

  document.body.style.overflow = 'hidden';

  splashBtn.addEventListener('click', () => {
    splash.classList.add('hiding');
    document.body.style.overflow = '';
    setTimeout(() => { splash.style.display = 'none'; }, 700);
  });
})();

// =============================================
// INIT
// =============================================
initBgCanvas();
initCanvas();
loadGallery();
