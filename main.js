(() => {
const core = dojiPortalCore();
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2', { antialias: false });
if (!gl) { document.querySelector('.stage').textContent = 'This browser does not support WebGL 2, which this piece needs.'; return; }
const { u } = core.setup(gl);
const cursor = core.makeCursor();

const $ = id => document.getElementById(id);
const sliders = core.UNIFORMS;
const colors = core.COLORS;
const hex = core.hex;
// The only colors on offer: eight blues, then eight golds, dark to light.
const PALETTE = [
  ['Midnight', '#1a2a9c'], ['Doji', '#2c3ad6'], ['Royal', '#3550ff'], ['Cobalt', '#2f6bff'],
  ['Azure', '#3d8bff'], ['Sky', '#5aa8ff'], ['Ice', '#8cc4ff'], ['Glacier', '#b5dcff'],
  ['Bronze', '#b8762e'], ['Amber', '#e09a3a'], ['Gold', '#f2b84b'], ['Honey', '#ffc96b'],
  ['Glow', '#ffc49a'], ['Sand', '#ffd9a0'], ['Champagne', '#ffe7c2'], ['Ivory', '#fff3dd']
];

const units = { rot: '°', zoom: '×', mlag: 's' };
// Show as many decimals as the slider's step uses (at least 2 for fine steps), so tiny values like Spread don't read as 0.000.
function places(el){ const s = el.step, d = (s.split('.')[1] || '').length; return +s >= 0.1 ? d : Math.max(2, d); }
function outputs(){
  document.querySelectorAll('output').forEach(o => {
    const el = $(o.htmlFor.value);
    o.value = (+el.value).toFixed(places(el)) + (units[el.id] || '');
  });
  // White fill on each slider track up to the thumb
  document.querySelectorAll('input[type=range]').forEach(r => r.style.setProperty('--p', (r.value - r.min) / (r.max - r.min) * 100 + '%'));
  // Color fields show just the picked swatch and its name
  document.querySelectorAll('.cpick').forEach(b => {
    const v = $(b.dataset.for).value.toLowerCase(), hit = PALETTE.find(p => p[1] === v);
    b.querySelector('.sw i').style.background = v;
    b.querySelector('.cname').textContent = hit ? hit[0] : v.toUpperCase();
  });
  if (popFor) markSwatches();
}

let busy = false, sizeLock = false;
// ---- Camera: drag to move, scroll to zoom around the cursor ----
function camRot(){ const a = (+$('rot').value) * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; }
function toWorld(px, py, z){ const [c, s] = camRot(); return [c * px / z - s * py / z, s * px / z + c * py / z]; }
function setCenter(x, y){ $('cx').value = x.toFixed(4); $('cy').value = y.toFixed(4); outputs(); panel.dispatchEvent(new Event('input')); }
let drag = null;
canvas.style.touchAction = 'none';
canvas.style.cursor = 'grab';
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const H = canvas.clientHeight, z = +$('zoom').value;
  const [wx, wy] = toWorld((e.clientX - drag.x) / H, -(e.clientY - drag.y) / H, z);
  drag = { x: e.clientX, y: e.clientY };
  setCenter(+$('cx').value - wx, +$('cy').value - wy);
});
const endDrag = () => { drag = null; canvas.style.cursor = 'grab'; };
// Hover: the cursor carries its own small lens that bends the streams like the hole does.
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  cursor.move((e.clientX - r.left - r.width / 2) / r.height, -(e.clientY - r.top - r.height / 2) / r.height);
});
canvas.addEventListener('pointerleave', () => cursor.leave());
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect(), H = r.height;
  const px = (e.clientX - r.left - r.width / 2) / H, py = -(e.clientY - r.top - H / 2) / H;
  const z = +$('zoom').value, nz = Math.min(60, Math.max(1, z * Math.exp(-e.deltaY * 0.0015)));
  const [ax, ay] = toWorld(px, py, z), [bx, by] = toWorld(px, py, nz);
  $('zoom').value = nz.toFixed(2);
  setCenter(+$('cx').value + ax - bx, +$('cy').value + ay - by);
}, { passive: false });

function resize(){
  if (sizeLock) return;
  const W = window.innerWidth, H = window.innerHeight;
  const r = $('ratio').value;
  let w = W, h = H;
  if (r !== 'full') { const ar = +r; if (W / H > ar) { h = H; w = H * ar; } else { w = W; h = W / ar; } }
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);

const presets = {
  contour: { smode:0, lw:0.38, spread:0.0002, dens:0.06, stretch:0.49, front:0.78, corebend:0.37, halo:0.71, fill:0, reach:0.8, speed:0.05, off:-0.002, layers:8, depth:0.09, loff:0.042, tails:1, breathe:0.3, bspeed:0.12, hotamt:0, hotpos:0.33, mass:0.17, hor:0.58, warp:1.7, wfall:0.52, inner:0.19, twist:0, turb:0, zoom:1, rot:0, cx:0, cy:0 },
  doji:   { smode:0, lw:0.2, spread:0.0002, dens:1, stretch:0.49, front:0.78, halo:0, fill:0.34, reach:0.8, speed:0.08, off:0, layers:8, depth:0.09, loff:0.042, tails:1, hotamt:0, hotpos:0.33, mass:0.17, hor:0.58, warp:1.7, wfall:0.52, inner:0.19, twist:0, turb:0, bright:8 },
  clean:  { smode:0, lw:1, spread:0.001, dens:1, stretch:0.49, front:1, halo:0.52, fill:0.25, reach:0.5, speed:0.1, off:0.004, layers:7, depth:0.6, loff:0.018, tails:0.12, hotamt:0.55, hotpos:0.35, mass:0.19, hor:0.14, warp:1.7, wfall:0.52, inner:0.19, twist:0, turb:0, bright:3.5, grain:0.03 },
  vortex: { smode:0, lw:0.99, spread:0.006, dens:1, stretch:0.51, front:0, halo:1.08, fill:0.66, reach:0.5, speed:0.05, off:-0.014, layers:5, depth:1, loff:0.035, tails:0, hotamt:0.9, hotpos:0.3, mass:0.2, hor:0.1, warp:1.57, wfall:0.52, inner:0, twist:0.39, turb:0.44, bright:6.17, grain:0.03 },
  side:   { smode:0, lw:0.41, spread:0.0004, dens:1, stretch:0, front:1.43, corebend:0.63, halo:0, fill:0.1, reach:0.5, speed:0.02, off:0, layers:8, depth:0.4, loff:0.01, tails:1, breathe:0, bspeed:0.01, hotamt:0, hotpos:0.98, mass:0.16, hor:0.3, warp:1.57, wfall:0.46, inner:0, twist:0, turb:0, zoom:1, rot:0, cx:0.1364, cy:0.0002, fine:1, bright:8, grain:0.03, cBlue:'#2c3ad6', cHot:'#ffc49a' },
  star:   { smode:1, lw:0.2, spread:0.0002, dens:1, stretch:1, front:0.9, corebend:0.53, halo:0, fill:0.15, reach:0.5, speed:0.04, off:0, layers:8, depth:0.68, loff:0.017, tails:0, breathe:0, bspeed:0.01, hotamt:0, hotpos:0.38, mass:0.17, hor:0, warp:2.46, wfall:0.4, inner:0.8, twist:0, turb:0, zoom:1, rot:0, cx:0, cy:0, fine:1, bright:8, grain:0.3, cBlue:'#2c3ad6', cHot:'#ffc49a' }
};
// The last preset clicked stays lit until a slider or color is changed by hand.
const markPreset = name => document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('on', b.dataset.preset === name));
// A preset is a whole look: every look control it doesn't set goes back to its default first,
// so nothing (a camera shift, say) leaks over from the previous preset. Picked colors stay unless the preset sets them.
const LOOK = ['dots', 'stream', 'layers', 'warp', 'camera', 'look'].map(s => `.sec[data-sec="${s}"] input[type=range],.sec[data-sec="${s}"] select`).join(',');
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll(LOOK).forEach(el => { el.value = defaultsAll[el.id]; });
  Object.entries(presets[b.dataset.preset]).forEach(([k, val]) => { $(k).value = val; });
  outputs();
  markPreset(b.dataset.preset);
}));

const panel = $('panel');
panel.addEventListener('submit', e => e.preventDefault());
panel.addEventListener('input', e => {
  if (e.target.id === 'ratio') resize();
  if (e.target.matches('input[type=range],input[type=color]')) markPreset(null);
  outputs();
});
panel.addEventListener('change', e => { if (e.target.id === 'ratio') resize(); });

// ---- Color fields: click one to pick from the palette (a row of blues, a row of golds) in a popover ----
// The hidden color inputs hold the pick; the popover is shared and sits outside the panel so nothing clips it.
const pop = $('cpop'), swatchGrid = pop.querySelector('.swatches');
let popFor = null;
function markSwatches(){ const v = $(popFor.dataset.for).value.toLowerCase(); swatchGrid.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.color === v)); }
function placePop(){
  const r = popFor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = r.left; if (left + pw > innerWidth - 8) left = r.right - pw;
  let top = r.bottom + 6; if (top + ph > innerHeight - 8) top = r.top - ph - 6;
  pop.style.left = Math.max(8, left) + 'px'; pop.style.top = Math.max(8, top) + 'px';
}
function openPop(btn){
  closePop();
  popFor = btn; btn.setAttribute('aria-expanded', 'true');
  pop.setAttribute('aria-label', document.getElementById('l-' + btn.dataset.for).textContent);
  markSwatches(); pop.hidden = false; placePop();
  (swatchGrid.querySelector('[aria-checked=true]') || swatchGrid.querySelector('button')).focus();
}
function closePop(refocus){
  if (!popFor) return;
  const btn = popFor; popFor = null; pop.hidden = true; btn.setAttribute('aria-expanded', 'false');
  if (refocus) btn.focus();
}
for (const [name, c] of PALETTE) {
  const b = document.createElement('button');
  b.type = 'button'; b.title = name; b.dataset.color = c; b.style.background = c;
  b.setAttribute('role', 'radio'); b.setAttribute('aria-label', name);
  b.addEventListener('click', () => { const input = $(popFor.dataset.for); input.value = c; input.dispatchEvent(new Event('input', { bubbles: true })); closePop(true); });
  swatchGrid.appendChild(b);
}
document.querySelectorAll('.cpick').forEach(b => b.addEventListener('click', () => { if (popFor === b) closePop(); else openPop(b); }));
document.addEventListener('pointerdown', e => { if (popFor && !pop.contains(e.target) && !popFor.contains(e.target)) closePop(); });
pop.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.stopPropagation(); closePop(true); return; }
  // Arrow keys walk the 8-wide grid
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key];
  if (!step) return;
  const all = [...swatchGrid.children], i = all.indexOf(document.activeElement);
  if (i >= 0 && all[i + step]) { e.preventDefault(); all[i + step].focus(); }
});
$('panelBody').addEventListener('scroll', () => closePop());
window.addEventListener('resize', () => closePop());
// Colors from older saves or imports snap to the closest palette color.
function nearest(v){
  const c = hex(v); let best = PALETTE[0][1], bd = Infinity;
  for (const [, p] of PALETTE) { const q = hex(p), d = (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2 + (c[2] - q[2]) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}

let paused = false;
$('animate').addEventListener('change', () => { paused = !$('animate').checked; });
function setHidden(h){ closePop(); panel.hidden = h; $('brand').hidden = h; $('show').hidden = !h; }
$('show').addEventListener('click', () => setHidden(false));

// ---- Collapsing: the whole panel and each section, remembered between visits ----
const UI_KEY = 'doji-portal-ui-v1';
let ui = {};
try { ui = JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch (e) {}
function saveUI(){ try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) {} }
function setPanelOpen(open){ panel.classList.toggle('closed', !open); $('collapse').setAttribute('aria-expanded', open); $('collapse').setAttribute('aria-label', open ? 'Collapse panel' : 'Expand panel'); }
setPanelOpen(ui.panel ?? true);
panel.querySelector('.panel-head').addEventListener('click', e => {
  if (e.target.closest('#defaults')) return;
  ui.panel = panel.classList.contains('closed'); setPanelOpen(ui.panel); saveUI();
});
document.querySelectorAll('.sec[data-sec]').forEach(sec => {
  const id = sec.dataset.sec, btn = sec.querySelector('[data-collapse]');
  const set = open => { sec.classList.toggle('closed', !open); btn.setAttribute('aria-expanded', open); };
  set(ui[id] ?? !sec.hasAttribute('data-closed'));
  sec.querySelector('.sec-head').addEventListener('click', e => {
    if (e.target.closest('[data-reset]')) return;
    ui[id] = sec.classList.contains('closed'); set(ui[id]); saveUI();
  });
});
window.addEventListener('keydown', e => {
  if (e.key && e.key.toLowerCase() === 'h' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) setHidden(!panel.hidden);
});

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { $('time').value = 0.4; }

const KEY='doji-portal-settings-v2';
const defaultsAll={};
panel.querySelectorAll('input[type=range],input[type=color],select').forEach(el=>{ if(el.id) defaultsAll[el.id]=el.value; });
function current(){ const o={}; panel.querySelectorAll('input[type=range],input[type=color],select').forEach(el=>{ if(el.id) o[el.id]=el.value; }); return o; }
function apply(o){ Object.entries(o||{}).forEach(([k,v])=>{ const el=$(k); if(el && el.tagName!=='TEXTAREA') el.value=v; }); Object.keys(colors).forEach(id=>{ $(id).value=nearest($(id).value); }); outputs(); resize(); syncExportUI(); }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(current())); }catch(e){} }
try{ const saved=JSON.parse(localStorage.getItem(KEY)||'null'); if(saved) apply(saved); }catch(e){}
panel.addEventListener('input', save);
panel.addEventListener('change', save);
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click', save));
$('defaults').addEventListener('click', ()=>{ apply(defaultsAll); save(); markPreset(null); });
// Each section's reset puts just that section's controls back to their defaults.
document.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click', ()=>{
  const o={}; b.closest('.sec').querySelectorAll('input[type=range],input[type=color],select').forEach(el=>{ o[el.id]=defaultsAll[el.id]; });
  apply(o); save(); markPreset(null);
}));
$('copy').addEventListener('click', ()=>{
  const txt=JSON.stringify(current());
  const lbl=$('copy').querySelector('span');
  const show=()=>{ $('dump').hidden=false; $('dumpLabel').hidden=false; $('dump').value=txt; $('dump').focus(); $('dump').select(); };
  try{ navigator.clipboard.writeText(txt).then(()=>{ lbl.textContent='Copied'; setTimeout(()=>{lbl.textContent='Copy settings';},1500); }, show); }catch(e){ show(); }
});

outputs(); resize();

let t = 0, phase = 0, bph = 0, last = performance.now(), cur = { x: 0, y: 0, amp: 0 }, exporting = false;
function frame(now){
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (busy) { requestAnimationFrame(frame); return; }
  if (!paused) { t += dt * +$('time').value; phase += dt * +$('time').value * +$('speed').value; bph += dt * +$('time').value * +$('bspeed').value * 6.2832; }
  if (bph > 6283.2) bph -= 6283.2;
  // keep the clocks small so the GPU's float precision never degrades the dot pattern
  if (phase > 400) phase -= 400;
  if (t > 1800) t -= 1800;
  cur = cursor.step(dt, +$('mlag').value);
  draw();
  requestAnimationFrame(frame);
}
function draw(){
  gl.uniform1f(u('uPhase'), phase);
  gl.uniform1f(u('uBreathPh'), bph);
  gl.uniform2f(u('uRes'), canvas.width, canvas.height);
  gl.uniform1f(u('uT'), t);
  // Exports are always rendered clean, without the cursor lens.
  core.cursorUniforms(gl, u, exporting ? { x: 0, y: 0, amp: 0 } : cur, +$('mmass').value, +$('zoom').value, +$('rot').value, +$('cx').value, +$('cy').value);
  for (const [id, n] of Object.entries(sliders)) gl.uniform1f(u(n), +$(id).value);
  for (const [id, n] of Object.entries(colors)) gl.uniform3fv(u(n), hex($(id).value));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
requestAnimationFrame(frame);

// ---- Export: PNG, GIF, MP4 ----
let downloads = null;
(async () => {
  try { downloads = await window.claude?.use?.('downloads'); } catch (e) { downloads = null; }
  // Opened as a plain file outside Claude: save through a normal browser download.
  if (!downloads && !window.claude) downloads = { save: async ({ filename, data }) => { const a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data])); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return { status: 'saved' }; } };
  if (downloads) $('exportBox').hidden = false;
})();
const msg = t => { $('exportMsg').textContent = t; };
function target(cap){
  const cw = canvas.width, ch = canvas.height, m = Math.max(cw, ch);
  const sel = $('exportSize').value;
  let k = sel === 'small' ? 540 / m : sel === '2x' ? 2 : sel === '4k' ? 3840 / m : 1;
  k = Math.min(k, cap / m);
  const ev = v => Math.max(2, Math.round(v * k / 2) * 2);
  return [ev(cw), ev(ch)];
}
function setSize(w, h){ canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
// ---- Settings travel inside every export ----
// The same marked text is written into each format: a PNG text chunk, a GIF comment, an MP4 'free' box.
const MARK_A = 'DOJI-SETTINGS:', MARK_B = ':DOJI-END';
function settingsText(){ return MARK_A + JSON.stringify({ app: 'doji-portal', saved: new Date().toISOString(), settings: current() }) + MARK_B; }
const enc8 = s => new TextEncoder().encode(s);
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes){ let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function concat(parts){ const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
function u32(n){ return new Uint8Array([n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255]); }
async function embedSettings(name, blob){
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const src = new Uint8Array(await blob.arrayBuffer());
  const text = enc8(settingsText());
  let out = null;
  if (ext === 'png') {
    const body = concat([enc8('tEXt'), enc8('doji-settings'), new Uint8Array([0]), text]);
    const chunk = concat([u32(body.length - 4), body, u32(crc32(body))]);
    out = concat([src.subarray(0, 33), chunk, src.subarray(33)]);
  } else if (ext === 'gif') {
    const blocks = [new Uint8Array([0x21, 0xfe])];
    for (let i = 0; i < text.length; i += 255) { const part = text.subarray(i, i + 255); blocks.push(new Uint8Array([part.length]), part); }
    blocks.push(new Uint8Array([0]));
    const end = src[src.length - 1] === 0x3b ? src.length - 1 : src.length;
    out = concat([src.subarray(0, end), ...blocks, new Uint8Array([0x3b])]);
  } else if (ext === 'mp4') {
    out = concat([src, u32(text.length + 8), enc8('free'), text]);
  }
  return out ? new Blob([out], { type: blob.type }) : blob;
}
$('loadBtn').addEventListener('click', () => $('loadFile').click());
$('loadFile').addEventListener('change', async () => {
  const f = $('loadFile').files[0]; $('loadFile').value = '';
  if (!f) return;
  const say = t => { $('loadMsg').textContent = t; };
  try {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const s = new TextDecoder('latin1').decode(bytes);
    const a = s.lastIndexOf(MARK_A), b = s.indexOf(MARK_B, a);
    let settings = null;
    if (a >= 0 && b >= 0) settings = JSON.parse(s.slice(a + MARK_A.length, b)).settings;
    // A .json file holding what "Copy settings" puts on the clipboard
    else if (/\.json$/i.test(f.name)) { const j = JSON.parse(new TextDecoder().decode(bytes)); settings = j.settings || j; }
    if (!settings) { say('No Doji settings found in that file. Only files exported from here carry them.'); return; }
    // Files saved before Stretch type existed were drawn with the trail look.
    apply(Object.assign({ smode: '1' }, settings)); save(); markPreset(null);
    say('Loaded the settings from ' + f.name + '.');
  } catch (e) { say('Could not read settings from that file.'); }
});

async function saveFile(name, blob){
  const d = new Date(), z = n => String(n).padStart(2, '0');
  const stamp = d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
  const dot = name.lastIndexOf('.');
  name = name.slice(0, dot) + '-' + stamp + name.slice(dot);
  try { blob = await embedSettings(name, blob); } catch (e) { console.error(e); }
  try { await downloads.save({ filename: name, data: blob }); msg('Saved ' + name + ' (settings included)'); }
  catch (e) {
    msg(e && e.code === 'declined' ? 'Save cancelled.' : 'Could not save this file here.');
    if (e && (e.code === 'unavailable' || e.code === 'not_granted')) $('exportBox').hidden = true;
  }
}
const tick = () => new Promise(r => setTimeout(r, 0));

async function exportPNG(){
  const [w, h] = target(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  gl.uniform1f(u('uAlpha'), $('transparent').checked ? 1 : 0);
  setSize(w, h); draw();
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  gl.uniform1f(u('uAlpha'), 0);
  resize();
  if (blob) await saveFile('doji-portal-' + w + 'x' + h + '.png', blob); else msg('Export failed.');
}

function step(dt){ t += dt * +$('time').value; phase += dt * +$('time').value * +$('speed').value; bph += dt * +$('time').value * +$('bspeed').value * 6.2832; }

// GIF: render each frame at 2x and scale down, so the dots stay crisp instead of blurring at low resolution.
async function exportGIF(){
  msg('Loading GIF encoder…');
  let lib;
  try { lib = await import('https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js'); }
  catch (e) { msg('Could not load the GIF encoder.'); return; }
  const { GIFEncoder, quantize, applyPalette } = lib;
  const [w, h] = target(1080);
  const max = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
  const ss = Math.max(1, Math.min(2, Math.floor(max / Math.max(w, h))));
  const fps = 25, n = Math.round(+$('exportLen').value * fps), dt = 1 / fps;
  const enc = GIFEncoder();
  const down = document.createElement('canvas'); down.width = w; down.height = h;
  const ctx = down.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  busy = true;
  try {
    for (let i = 0; i < n; i++) {
      step(dt);
      setSize(w * ss, h * ss); draw();
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(canvas, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h).data;
      const pal = quantize(img, 256, { format: 'rgb444' });
      enc.writeFrame(applyPalette(img, pal, 'rgb444'), w, h, { palette: pal, delay: 1000 / fps });
      if (i % 3 === 0) { msg('Rendering GIF ' + Math.round(i / n * 100) + '%'); await tick(); }
    }
    enc.finish();
  } finally { busy = false; resize(); }
  await saveFile('doji-portal-' + w + 'x' + h + '.gif', new Blob([enc.bytes()], { type: 'image/gif' }));
}

// MP4: render frame by frame (no dropped frames) and encode at a high bitrate with the browser's H.264 encoder.
async function exportVideo(){
  if (!window.VideoEncoder) return exportVideoRealtime();
  msg('Loading MP4 writer…');
  let lib;
  try { lib = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs'); }
  catch (e) { return exportVideoRealtime(); }
  const { Muxer, ArrayBufferTarget } = lib;
  const fps = 60;
  let [w, h] = target(3840);
  const codecs = ['avc1.640034', 'avc1.640033', 'avc1.64002A', 'avc1.4D0034', 'avc1.42003E'];
  let config = null;
  for (let tries = 0; tries < 3 && !config; tries++) {
    const bitrate = Math.min(w * h * fps * 0.3, 120e6);
    for (const codec of codecs) {
      const c = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } };
      try { const r = await VideoEncoder.isConfigSupported(c); if (r.supported) { config = c; break; } } catch (e) {}
    }
    if (!config) { w = Math.round(w * 0.5 / 2) * 2; h = Math.round(h * 0.5 / 2) * 2; }
  }
  if (!config) return exportVideoRealtime();
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });
  let failed = null;
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failed = e; } });
  encoder.configure(config);
  const n = Math.round(+$('exportLen').value * fps), dt = 1 / fps, us = 1e6 / fps;
  busy = true;
  try {
    for (let i = 0; i < n && !failed; i++) {
      step(dt);
      setSize(w, h); draw();
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * us), duration: Math.round(us) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 4));
      if (i % 6 === 0) { msg('Rendering video ' + Math.round(i / n * 100) + '%'); await tick(); }
    }
    await encoder.flush();
  } finally { busy = false; resize(); }
  if (failed) { msg('Video encoding failed.'); return; }
  muxer.finalize();
  await saveFile('doji-portal-' + w + 'x' + h + '.mp4', new Blob([muxer.target.buffer], { type: 'video/mp4' }));
}

// Fallback for browsers without WebCodecs: record the live canvas.
async function exportVideoRealtime(){
  if (!window.MediaRecorder || !canvas.captureStream) { msg('This browser cannot record video.'); return; }
  const types = ['video/mp4;codecs=avc1.640034', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const mime = types.find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) { msg('This browser cannot record video.'); return; }
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const [w, h] = target(1920);
  const len = +$('exportLen').value;
  sizeLock = true; setSize(w, h);
  const stream = canvas.captureStream(60);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 60e6 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise(r => { rec.onstop = r; });
  rec.start(250);
  const t0 = performance.now();
  const iv = setInterval(() => msg('Recording ' + Math.min(len, Math.floor((performance.now() - t0) / 1000)) + ' / ' + len + ' s'), 250);
  await new Promise(r => setTimeout(r, len * 1000));
  rec.stop(); await done; clearInterval(iv);
  stream.getTracks().forEach(tr => tr.stop());
  sizeLock = false; resize();
  if (ext !== 'mp4') msg('This browser records WebM, not MP4. Saving WebM.');
  await saveFile('doji-portal-' + w + 'x' + h + '.' + ext, new Blob(chunks, { type: mime.split(';')[0] }));
}

// ---- Export code: one self-contained HTML file a developer can open as is, or lift into a landing page ----
// It carries the current look, the shader and the cursor lens, and nothing of the editor.
async function exportCode(){
  const skip = new Set(['ratio', 'exportFmt', 'exportSize', 'exportLen']);
  const lines = [];
  panel.querySelectorAll('input[type=range],input[type=color],select').forEach(el => {
    if (!el.id || skip.has(el.id)) return;
    const lab = document.querySelector('label[for="' + el.id + '"]') || $('l-' + el.id);
    const v = el.type === 'color' ? el.value : +el.value;
    lines.push('  ' + el.id + ': ' + JSON.stringify(v) + ',' + (lab ? ' // ' + lab.textContent.trim() : ''));
  });
  lines.push('  transparent: ' + $('transparent').checked + ', // true: see-through background, to layer over your own');
  lines.push('  maxPixelRatio: 2 // lower to 1.5 or 1 for faster rendering on large screens');
  const day = new Date().toISOString().slice(0, 10);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Doji Portal</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; }
  /* The portal fills this element, so size it however the page needs. Here it covers the window. */
  .doji-portal { position: relative; width: 100%; height: 100%; }
</style>
</head>
<body>

<!-- 1. Put this element where the portal should appear. Anything inside it sits on top of the animation. -->
<div class="doji-portal"></div>

<!-- 2. Add this script once, after the element (the end of <body> is best). No libraries, it needs WebGL 2.
     Every .doji-portal on the page gets a portal. From your own code (React etc.):
     const portal = DojiPortal.mount(element, { speed: 0.1 }); ...later: portal.destroy(); -->
<script>
(() => {
// Exported from Doji Portal on ${day}. Change these to tune the look, or export again from the editor.
const SETTINGS = {
${lines.join('\n')}
};

${dojiPortalCore.toString()}

${dojiPortalMount.toString()}

const core = dojiPortalCore();
window.DojiPortal = { mount: (el, overrides) => dojiPortalMount(el, Object.assign({}, SETTINGS, overrides), core) };
document.querySelectorAll('.doji-portal').forEach(el => window.DojiPortal.mount(el));
})();
</script>
<!-- ${settingsText()} -->
</body>
</html>
`;
  await saveFile('doji-portal-embed.html', new Blob([html], { type: 'text/html' }));
}

$('export').addEventListener('click', async () => {
  if (!downloads || exporting) return;
  exporting = true; $('export').disabled = true;
  try {
    const f = $('exportFmt').value;
    if (f === 'png') await exportPNG(); else if (f === 'gif') await exportGIF(); else if (f === 'code') await exportCode(); else await exportVideo();
  } catch (e) { msg('Export failed.'); console.error(e); }
  exporting = false; $('export').disabled = false;
});
function syncExportUI(){
  const f = $('exportFmt').value;
  $('exportLen').closest('.field').hidden = f === 'png' || f === 'code';
  $('exportSize').closest('.field').hidden = f === 'code';
  $('transparent').closest('.switch').hidden = f !== 'png' && f !== 'code';
  $('export').querySelector('span').textContent = f === 'code' ? 'Export code' : 'Export ' + f.toUpperCase();
}
$('exportFmt').addEventListener('change', syncExportUI); syncExportUI();
})();
